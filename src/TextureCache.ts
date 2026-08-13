/**
 * @file TextureCache — module-level SoT for canvas-backed rasterised
 * textures.
 *
 * ## Problem this solves
 *
 * Every `Text` / `Rect` leaf needs a Canvas2D surface painted with
 * its current content and stamped onto a {@link CanvasTexture}. Two
 * naive implementations both hurt:
 *
 *   - **Per-node, always repaint**: resizing the canvas between
 *     rebuilds forces Three.js (and Chrome's CopyTexture path) to
 *     reallocate the GPU texture. `glCopySubTextureCHROMIUM: Offset
 *     overflows texture dimensions` fires when the fast-path cache
 *     of prior dims goes stale, and even when it doesn't, every
 *     text mutation churns a GPU alloc.
 *   - **Per-node, duplicated rasters**: fixes the GL error but makes
 *     every identical Text / Rect pay its own GPU allocation.
 *
 * ## What we do instead
 *
 * A single shared live-entry registry keyed by the full *visual
 * fingerprint* of the content (text + font + color + … for Text;
 * dims + fill + stroke for Rect). Callers:
 *
 *   1. Compute a fingerprint key for their current content.
 *   2. Call {@link acquireRaster} — on hit, the existing live canvas
 *      + texture are returned and the refCount bumps; on miss, the
 *      provided `paint` closure runs once.
 *   3. Call {@link releaseRaster} when the content changes
 *      (previous key) or when the node is destroyed (current key).
 *
 * Entries whose refCount drops to zero are disposed immediately.
 * That is the texture lifecycle boundary: once no live node owns a
 * raster, the GPU texture and Safari-sensitive canvas backing store
 * are released by the cache itself, not by scene-level cleanup hooks.
 *
 * ## Non-goals
 *
 * This is a shared *rasterisation* cache, not a texture atlas. Each
 * entry is a separate CanvasTexture + canvas pair. Atlasing (packing
 * multiple rasters into a single GPU texture) is a future
 * optimisation; it would halve upload calls but requires UV
 * remapping on the consumer side that the current leaves don't do.
 */

import { CanvasTexture, LinearFilter, NoColorSpace, SRGBColorSpace } from "three";
import {
  type TextureCanvas,
  type TextureCanvas2DContext,
  type TextureManager,
} from "./texture-canvas";
import {
  textureCanvasScaleFor,
  type TextureCanvasScale,
  type TexturePixelRounding,
} from "./texture-sizing.ts";

/**
 * Paint callback supplied to {@link acquireRaster}. Receives a fresh
 * {@link TextureCanvas} (currently 1×1 — the paint is expected to
 * resize it to the required dimensions before drawing). The canvas
 * is an `OffscreenCanvas` on runtimes that support it, otherwise a
 * real `HTMLCanvasElement`; the common 2D API covers everything the
 * paint callback needs. Returns the logical (CSS-pixel) dimensions
 * the caller's mesh should be scaled to — typically smaller than the
 * physical canvas size when DPR > 1.
 */
export type RasterPaint = (canvas: TextureCanvas) => RasterMetrics;
export type RasterTextureConfigurator = (texture: CanvasTexture<TextureCanvas>) => void;

export type RasterDebugInfo = {
  readonly kind: string;
  readonly label?: string;
};

export type RasterMetrics = {
  /** Logical width consumers should feed into `mesh.scale.x`. */
  readonly cssWidth: number;
  /** Logical height consumers should feed into `mesh.scale.y`. */
  readonly cssHeight: number;
};

export type MutableRasterSurfaceOptions = {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly pixelRatio: number;
  readonly rounding?: TexturePixelRounding;
  readonly maxTextureSize?: number;
  readonly textureManager: TextureManager;
  readonly configureTexture?: RasterTextureConfigurator;
  readonly debugInfo?: RasterDebugInfo;
};

export type MutableRasterSurface = {
  readonly cacheKey: string;
  readonly canvas: TextureCanvas;
  readonly ctx: TextureCanvas2DContext | null;
  readonly texture: CanvasTexture<TextureCanvas>;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly scale: TextureCanvasScale;
};

/**
 * Public view of a live cache entry. `texture` and `canvas` outlive
 * the acquiring node (they stay in the cache until evicted); callers
 * must not dispose the texture directly — instead
 * {@link releaseRaster} so the cache's refcount stays correct.
 */
export type RasterEntry = {
  readonly canvas: TextureCanvas;
  readonly texture: CanvasTexture<TextureCanvas>;
  readonly cssWidth: number;
  readonly cssHeight: number;
};

export type RasterProvider<TInput, THandle> = {
  readonly acquire: (input: TInput) => THandle;
  readonly release: (handle: THandle) => void;
};

export type RasterProviderSpec<TInput, THandle> = {
  readonly key: (input: TInput) => string;
  readonly paint: (canvas: TextureCanvas, input: TInput) => RasterMetrics;
  readonly configureTexture?: RasterTextureConfigurator;
  readonly handle: (key: string, entry: RasterEntry, input: TInput) => THandle;
  readonly releaseKey: (handle: THandle) => string;
  readonly textureManager: TextureManager;
};

type InternalEntry = {
  readonly key: string;
  readonly canvas: TextureCanvas;
  readonly texture: CanvasTexture<TextureCanvas>;
  cssWidth: number;
  cssHeight: number;
  /** Approx GPU bytes (w × h × 4 for RGBA8). Used for the bytes cap. */
  readonly byteSize: number;
  readonly debugInfo?: RasterDebugInfo;
  refCount: number;
};

/**
 * Cache state. Held inside an object so the module can mutate fields
 * without top-level `let` (forbidden by the project lint rule).
 */
type CacheState = {
  readonly entries: Map<string, InternalEntry>;
  totalBytes: number;
  entryCount: number;
  lastBudgetWarningEntries: number;
  lastBudgetWarningBytes: number;
  nextMutableSurfaceId: number;
};

const state: CacheState = {
  entries: new Map(),
  totalBytes: 0,
  entryCount: 0,
  lastBudgetWarningEntries: 0,
  lastBudgetWarningBytes: 0,
  nextMutableSurfaceId: 0,
};

/** Hard caps while entries are actively referenced by live nodes. */
const MAX_ENTRIES = 512;
const MAX_BYTES = 64 * 1024 * 1024;

/**
 * Looks up (or builds) the raster for `key`. Ref-counts the entry so
 * multiple owners of the same content share a single GPU texture.
 */
export function acquireRaster(
  key: string,
  paint: RasterPaint,
  textureManager: TextureManager,
  configureTexture: RasterTextureConfigurator = configureColorRasterTexture,
  debugInfo?: RasterDebugInfo,
): RasterEntry {
  const manager = textureManager;
  const existing = state.entries.get(key);
  if (existing) {
    existing.refCount += 1;
    return existing;
  }
  const canvas = manager.createCanvas(1, 1);
  const metrics = paint(canvas);
  const texture = manager.createOwnedCanvasTexture(canvas);
  configureTexture(texture);

  const byteSize = Math.max(1, canvas.width * canvas.height * 4);
  const entry: InternalEntry = {
    key,
    canvas,
    texture,
    cssWidth: metrics.cssWidth,
    cssHeight: metrics.cssHeight,
    byteSize,
    debugInfo,
    refCount: 1,
  };
  state.entries.set(key, entry);
  state.totalBytes += byteSize;
  state.entryCount += 1;
  warnIfOverCap(entry);
  return entry;
}

/**
 * Builds a typed provider over the shared raster cache. Feature code
 * owns fingerprinting and paint semantics; TextureCache owns acquire,
 * refcount and release mechanics.
 */
export function createRasterProvider<TInput, THandle>(
  spec: RasterProviderSpec<TInput, THandle>,
): RasterProvider<TInput, THandle> {
  return {
    acquire(input: TInput): THandle {
      const key = spec.key(input);
      const entry = acquireRaster(
        key,
        (canvas) => spec.paint(canvas, input),
        spec.textureManager,
        spec.configureTexture,
      );
      return spec.handle(key, entry, input);
    },
    release(handle: THandle): void {
      releaseRaster(spec.releaseKey(handle));
    },
  };
}

/** Allocates a mutable one-owner canvas texture surface under TextureCache accounting. */
export function createMutableRasterSurface(
  options: MutableRasterSurfaceOptions,
): MutableRasterSurface {
  const pixelSize = options.textureManager.resolveTexturePixelSize(options);
  const canvas = options.textureManager.createCanvas(pixelSize.width, pixelSize.height);
  const texture = options.textureManager.createOwnedCanvasTexture(canvas);
  const configureTexture = options.configureTexture ?? configureColorRasterTexture;
  configureTexture(texture);
  const key = nextMutableSurfaceKey(options.debugInfo);
  const entry: InternalEntry = {
    key,
    canvas,
    texture,
    cssWidth: Math.max(1, options.logicalWidth),
    cssHeight: Math.max(1, options.logicalHeight),
    byteSize: Math.max(1, canvas.width * canvas.height * 4),
    debugInfo: options.debugInfo ?? { kind: "MutableRasterSurface" },
    refCount: 1,
  };
  state.entries.set(key, entry);
  state.totalBytes += entry.byteSize;
  state.entryCount += 1;
  warnIfOverCap(entry);
  return mutableSurfaceFromEntry(entry, options, pixelSize.width, pixelSize.height);
}

/** Resizes a mutable surface, preserving the texture when physical dimensions are unchanged. */
export function resizeMutableRasterSurface(
  surface: MutableRasterSurface,
  options: MutableRasterSurfaceOptions,
): MutableRasterSurface {
  const pixelSize = options.textureManager.resolveTexturePixelSize(options);
  if (surface.pixelWidth === pixelSize.width && surface.pixelHeight === pixelSize.height) {
    updateMutableSurfaceMetrics(surface.cacheKey, options);
    return {
      ...surface,
      logicalWidth: Math.max(1, options.logicalWidth),
      logicalHeight: Math.max(1, options.logicalHeight),
      scale: textureCanvasScaleFor(options.logicalWidth, options.logicalHeight, pixelSize),
    };
  }
  const next = createMutableRasterSurface(options);
  disposeMutableRasterSurface(surface);
  return next;
}

/** Releases a mutable surface allocated by {@link createMutableRasterSurface}. */
export function disposeMutableRasterSurface(surface: MutableRasterSurface): void {
  const entry = state.entries.get(surface.cacheKey);
  if (!entry || entry.texture !== surface.texture) {
    return;
  }
  evictEntry(entry);
}

/**
 * Decrements the refCount for `key`. When it hits zero, the entry is
 * immediately removed and disposed; no scene is expected to remember
 * to trim idle textures.
 */
export function releaseRaster(key: string): void {
  const entry = state.entries.get(key);
  if (!entry) {
    return;
  }
  entry.refCount -= 1;
  if (entry.refCount > 0) {
    return;
  }
  evictEntry(entry);
}

function nextMutableSurfaceKey(info: RasterDebugInfo | undefined): string {
  state.nextMutableSurfaceId += 1;
  const kind = info?.kind ?? "MutableRasterSurface";
  return `mutable-raster:${kind}:${String(state.nextMutableSurfaceId)}`;
}

function updateMutableSurfaceMetrics(
  key: string,
  options: MutableRasterSurfaceOptions,
): void {
  const entry = state.entries.get(key);
  if (!entry) {
    return;
  }
  entry.cssWidth = Math.max(1, options.logicalWidth);
  entry.cssHeight = Math.max(1, options.logicalHeight);
}

function mutableSurfaceFromEntry(
  entry: InternalEntry,
  options: MutableRasterSurfaceOptions,
  pixelWidth: number,
  pixelHeight: number,
): MutableRasterSurface {
  return {
    cacheKey: entry.key,
    canvas: entry.canvas,
    ctx: options.textureManager.acquireCanvas2DContext(entry.canvas),
    texture: entry.texture,
    pixelWidth,
    pixelHeight,
    logicalWidth: Math.max(1, options.logicalWidth),
    logicalHeight: Math.max(1, options.logicalHeight),
    scale: textureCanvasScaleFor(options.logicalWidth, options.logicalHeight, {
      width: pixelWidth,
      height: pixelHeight,
    }),
  };
}

/**
 * Historical test/dev hook. Live entries are never trimmed here;
 * zero-ref entries are disposed synchronously by {@link releaseRaster}.
 */
export function trimCachedTextures(): void {
  // Intentionally empty.
}

/** Telemetry helper for tests + dev UIs. */
export function rasterCacheStats(): {
  readonly entries: number;
  readonly bytes: number;
  readonly idle: number;
} {
  return {
    entries: state.entryCount,
    bytes: state.totalBytes,
    idle: 0,
  };
}

function warnIfOverCap(incoming: InternalEntry): void {
  if (state.entryCount <= MAX_ENTRIES && state.totalBytes <= MAX_BYTES) {
    return;
  }
  if (
    state.entryCount <= state.lastBudgetWarningEntries &&
    state.totalBytes <= state.lastBudgetWarningBytes
  ) {
    return;
  }
  state.lastBudgetWarningEntries = state.entryCount;
  state.lastBudgetWarningBytes = state.totalBytes;

  console.warn(
    [
      "TextureCache: live raster budget exceeded; continuing with the new raster.",
      `caps=${String(MAX_ENTRIES)} entries / ${formatBytes(MAX_BYTES)}`,
      `live=${String(state.entryCount)} entries / ${formatBytes(state.totalBytes)}`,
      `incoming=${formatEntrySummary(incoming)}`,
      `largestLive=${formatLargestEntries(8)}`,
    ].join(" "),
  );
}

function evictEntry(entry: InternalEntry): void {
  state.entries.delete(entry.key);
  state.totalBytes -= entry.byteSize;
  state.entryCount -= 1;
  if (state.entryCount <= MAX_ENTRIES && state.totalBytes <= MAX_BYTES) {
    state.lastBudgetWarningEntries = 0;
    state.lastBudgetWarningBytes = 0;
  }
  entry.texture.dispose();
}

function formatLargestEntries(limit: number): string {
  const entries = Array.from(state.entries.values()).sort((a, b) => b.byteSize - a.byteSize);
  return `[${entries.slice(0, limit).map(formatEntrySummary).join(", ")}]`;
}

function formatEntrySummary(entry: InternalEntry): string {
  return formatEntrySummaryParts(entry).join(" ");
}

function formatEntrySummaryParts(entry: InternalEntry): readonly string[] {
  const debugInfo = formatDebugInfo(entry.debugInfo);
  if (debugInfo.length === 0) {
    return [
      "{",
      `key=${JSON.stringify(truncateKey(entry.key))}`,
      `canvas=${String(entry.canvas.width)}x${String(entry.canvas.height)}`,
      `css=${formatNumber(entry.cssWidth)}x${formatNumber(entry.cssHeight)}`,
      `bytes=${formatBytes(entry.byteSize)}`,
      `refs=${String(entry.refCount)}`,
      "}",
    ];
  }
  return [
    "{",
    debugInfo,
    `key=${JSON.stringify(truncateKey(entry.key))}`,
    `canvas=${String(entry.canvas.width)}x${String(entry.canvas.height)}`,
    `css=${formatNumber(entry.cssWidth)}x${formatNumber(entry.cssHeight)}`,
    `bytes=${formatBytes(entry.byteSize)}`,
    `refs=${String(entry.refCount)}`,
    "}",
  ];
}

function formatDebugInfo(info: RasterDebugInfo | undefined): string {
  if (info === undefined) {
    return "";
  }
  if (info.label === undefined || info.label.length === 0) {
    return `kind=${JSON.stringify(info.kind)}`;
  }
  return `kind=${JSON.stringify(info.kind)} label=${JSON.stringify(info.label)}`;
}

function truncateKey(key: string): string {
  const maxLength = 180;
  if (key.length <= maxLength) {
    return key;
  }
  return `${key.slice(0, maxLength - 1)}…`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatBytes(bytes: number): string {
  const mib = bytes / (1024 * 1024);
  return `${String(bytes)} bytes (${mib.toFixed(2)} MiB)`;
}

/** Configures a raster texture that stores display colour. */
export function configureColorRasterTexture(texture: CanvasTexture<TextureCanvas>): void {
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
}

/** Configures a raster texture that stores data masks rather than colour. */
export function configureDataRasterTexture(texture: CanvasTexture<TextureCanvas>): void {
  texture.colorSpace = NoColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
}
