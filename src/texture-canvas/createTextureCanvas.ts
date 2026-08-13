/**
 * @file createTextureCanvas — single point of allocation for every
 * canvas surface that r3 hands to Three.js as a `CanvasTexture`
 * source or uses for 2D measurement.
 *
 * ## Why a SSoT
 *
 * Multiple r3 nodes (Text, Rect, Graphics) and the shared raster
 * cache each used to call `document.createElement("canvas")`
 * directly. Three problems with that:
 *
 *  - The DOM allocation path is needlessly tied to the main document.
 *    Even though we never parent the canvas to the DOM tree, the
 *    element is still a full `HTMLCanvasElement` — it participates in
 *    GC with live DOM references and forces the 2D backing store to
 *    sit alongside layout objects.
 *  - `OffscreenCanvas`, where available, lets the browser keep the
 *    bitmap entirely off the main-document heap. Three.js'
 *    `CanvasTexture` accepts it as a source verbatim, so uploading a
 *    rasterised r3 Text to the GPU stays a pure bitmap transfer with
 *    no DOM touch.
 *  - Having the allocation split across files means a future change
 *    (e.g. adding a shared pool, or instrumenting texture memory) has
 *    to be applied in N places and kept in sync.
 *
 * Consolidating through this module fixes all three: a single call
 * site, an OffscreenCanvas-preferred runtime strategy, and a shared
 * `TextureCanvas` / `TextureCanvas2DContext` type surface for
 * consumers so the union is handled once here, not replicated at
 * every leaf.
 *
 * ## Runtime strategy
 *
 * 1. If the runtime exposes `OffscreenCanvas` **and** an
 *    `OffscreenCanvas(1,1).getContext("2d")` actually returns a usable
 *    context, use `OffscreenCanvas` from here on. This rules out
 *    happy-dom / jsdom builds that expose the constructor but don't
 *    implement the 2D backing.
 * 2. Otherwise, if `document` is available, fall back to
 *    `document.createElement("canvas")`.
 * 3. Otherwise throw — a no-canvas environment is not something r3
 *    can silently paper over without producing invisible nodes.
 *
 * The decision is made once at first allocation and cached for the
 * process lifetime. Mixed strategies within one session would break
 * the shared raster cache's assumption that all entries have the
 * same canvas flavour (and therefore the same CanvasTexture upload
 * path).
 */

import { CanvasTexture } from "three";
import {
  resolveTexturePixelSize as resolveTexturePixelSizeRaw,
  type TexturePixelSize,
  type TexturePixelSizeInput,
} from "../texture-sizing.ts";

/**
 * Canvas source r3 hands to `CanvasTexture`. Three.js accepts both
 * `HTMLCanvasElement` and `OffscreenCanvas` as a `TexImageSource`.
 */
export type TextureCanvas = OffscreenCanvas | HTMLCanvasElement;

/**
 * 2D rendering context union for {@link TextureCanvas}. The two
 * backing types share the entire Canvas 2D drawing surface — every
 * method r3 calls (`fillRect`, `measureText`, `setTransform`,
 * `fillText`, `arcTo`, …) exists on both. Consumers can therefore
 * type-annotate against this alias and avoid per-call narrowing.
 */
export type TextureCanvas2DContext =
  | OffscreenCanvasRenderingContext2D
  | CanvasRenderingContext2D;

export type TextureManager = {
  readonly createCanvas: (width?: number, height?: number) => TextureCanvas;
  readonly createOwnedCanvasTexture: (canvas: TextureCanvas) => CanvasTexture;
  readonly createBorrowedCanvasTexture: (canvas: TextureCanvas) => CanvasTexture;
  readonly disposeCanvasSource: (canvas: TextureCanvas) => void;
  readonly acquireCanvas2DContext: (canvas: TextureCanvas) => TextureCanvas2DContext | null;
  readonly resolveTexturePixelSize: (input: TexturePixelSizeInput) => TexturePixelSize;
  readonly configureMaxTextureSize: (maxTextureSize: number) => void;
  readonly isOffscreenCanvasActive: () => boolean;
  readonly resetStrategyForTests: () => void;
  readonly resetPolicyForTests: () => void;
};

export type TextureMaxSizeSource = {
  readonly MAX_TEXTURE_SIZE: number;
  readonly getParameter: (pname: number) => unknown;
};

export const DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE = 2048;

/**
 * Three states for the OffscreenCanvas strategy decision:
 *   - `"unknown"` — not yet probed; next allocation triggers the probe.
 *   - `"offscreen"` — OffscreenCanvas is usable; prefer it from now on.
 *   - `"html"` — OffscreenCanvas is missing or unusable; fall back to
 *     HTMLCanvasElement.
 */
type Strategy = "unknown" | "offscreen" | "html";

const strategyState: { value: Strategy } = { value: "unknown" };

const texturePolicyState: {
  maxTextureSize: number;
} = {
  maxTextureSize: DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE,
};

/**
 * Feature-probe. Returns `true` only if `OffscreenCanvas` exists
 * AND its 2D context can be acquired. `getContext("2d")` may return
 * `null` on browsers where the implementation is present but the
 * 2D backing store was disabled (rare but documented), and on
 * environments like older happy-dom builds that ship a stub
 * constructor without the backing code.
 */
function probeOffscreenCanvas(): boolean {
  if (typeof OffscreenCanvas === "undefined") {
    return false;
  }
  try {
    const probe = new OffscreenCanvas(1, 1);
    return probe.getContext("2d") !== null;
  } catch (err) {
    // Constructor throws on environments that gate OffscreenCanvas
    // behind a permission prompt or that stub the constructor to
    // always reject. Treat any throw as "not available".
    console.info("OffscreenCanvas probe failed", err);
    return false;
  }
}

function resolveStrategy(): Exclude<Strategy, "unknown"> {
  if (strategyState.value === "unknown") {
    strategyState.value = probeOffscreenCanvas() ? "offscreen" : "html";
  }
  return strategyState.value;
}

/**
 * Public query. Useful for tests and for debug UIs that want to
 * report which canvas backend is active. Does **not** force the
 * probe — if no canvas has been allocated yet the return value is
 * computed on first call and cached thereafter.
 */
function isOffscreenCanvasActiveImpl(): boolean {
  return resolveStrategy() === "offscreen";
}

/**
 * Test / lifecycle hook: forget the cached strategy so the next
 * allocation re-probes. Only useful when a test wants to simulate
 * a backend switch; production code should never call this.
 */
function resetTextureCanvasStrategyForTestsImpl(): void {
  strategyState.value = "unknown";
}

function configureMaxTextureSizeImpl(maxTextureSize: number): void {
  texturePolicyState.maxTextureSize = Math.min(
    DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE,
    sanitizeTextureMaxSize(maxTextureSize),
  );
}

function resetTexturePolicyForTestsImpl(): void {
  texturePolicyState.maxTextureSize = DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE;
}

function resolveTexturePixelSizeImpl(input: TexturePixelSizeInput): TexturePixelSize {
  return resolveTexturePixelSizeRaw({
    ...input,
    maxTextureSize: Math.min(
      texturePolicyState.maxTextureSize,
      sanitizeTextureMaxSize(input.maxTextureSize),
    ),
  });
}

function sanitizeTextureMaxSize(maxTextureSize: number | undefined): number {
  if (maxTextureSize === undefined || !Number.isFinite(maxTextureSize)) {
    return DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE;
  }
  const integer = Math.max(1, Math.floor(maxTextureSize));
  if (integer === 1 || integer % 2 === 0) {
    return integer;
  }
  return integer - 1;
}

/**
 * Allocates a fresh canvas surface. Dimensions default to 1×1
 * because many callers resize the canvas inside their paint step
 * once they know the rasterised content size.
 *
 * Throws a clear error (rather than returning a broken stub) when
 * no canvas backend is available — r3 is a rendering library, and
 * silently ignoring a no-canvas environment would surface much
 * later as invisible text or a blank HUD.
 */
function createTextureCanvasImpl(width = 1, height = 1): TextureCanvas {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const strategy = resolveStrategy();
  if (strategy === "offscreen") {
    return new OffscreenCanvas(safeWidth, safeHeight);
  }
  if (typeof document === "undefined") {
    throw new Error(
      "r3/texture-canvas: runtime exposes neither a usable OffscreenCanvas nor document.createElement — cannot allocate a canvas",
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  return canvas;
}

/**
 * Releases the CPU-side backing store held by a canvas source after
 * its owning Three texture has been disposed. Safari/iOS keeps canvas
 * backing stores under a separate budget, so dropping JS references is
 * not a strong enough lifecycle boundary for churn-heavy UI surfaces.
 */
function releaseTextureCanvasBackingStore(canvas: TextureCanvas): void {
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Disposes a canvas source that is owned directly rather than through
 * a Three Texture wrapper.
 */
function disposeTextureCanvasSourceImpl(canvas: TextureCanvas): void {
  releaseTextureCanvasBackingStore(canvas);
}

/**
 * CanvasTexture variant for generated canvases whose CPU-side backing
 * store belongs to the texture. Callers dispose it like a normal
 * Three texture; the canvas release is part of the texture lifecycle.
 */
class ManagedCanvasTexture extends CanvasTexture {
  private disposed = false;

  constructor(private readonly sourceCanvas: TextureCanvas) {
    super(sourceCanvas as HTMLCanvasElement);
  }

  override dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    super.dispose();
    releaseTextureCanvasBackingStore(this.sourceCanvas);
  }
}

/** Creates a CanvasTexture that releases its source canvas on dispose. */
function createOwnedCanvasTextureImpl(canvas: TextureCanvas): CanvasTexture {
  return new ManagedCanvasTexture(canvas);
}

function createBorrowedCanvasTextureImpl(canvas: TextureCanvas): CanvasTexture {
  return new CanvasTexture(canvas as HTMLCanvasElement);
}

/**
 * Acquires a 2D context from a {@link TextureCanvas}. Both backing
 * types expose `getContext("2d")`; TypeScript can't pick the right
 * overload on a union (HTMLCanvasElement's `getContext(string)`
 * returns `RenderingContext | null`, which includes
 * `ImageBitmapRenderingContext`), so we narrow explicitly and call
 * through the concrete type.
 *
 * Returns `null` when the context cannot be obtained. Callers must
 * handle that — r3 leaves paint steps as no-ops in that case so
 * layout logic continues to work (size getters, hit areas, …).
 */
function acquireTextureCanvas2DContextImpl(
  canvas: TextureCanvas,
): TextureCanvas2DContext | null {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    return canvas.getContext("2d");
  }
  return (canvas as HTMLCanvasElement).getContext("2d");
}

export const defaultTextureManager: TextureManager = {
  createCanvas: createTextureCanvasImpl,
  createOwnedCanvasTexture: createOwnedCanvasTextureImpl,
  createBorrowedCanvasTexture: createBorrowedCanvasTextureImpl,
  disposeCanvasSource: disposeTextureCanvasSourceImpl,
  acquireCanvas2DContext: acquireTextureCanvas2DContextImpl,
  resolveTexturePixelSize: resolveTexturePixelSizeImpl,
  configureMaxTextureSize: configureMaxTextureSizeImpl,
  isOffscreenCanvasActive: isOffscreenCanvasActiveImpl,
  resetStrategyForTests: resetTextureCanvasStrategyForTestsImpl,
  resetPolicyForTests: resetTexturePolicyForTestsImpl,
};

/** Compatibility wrapper; production code should depend on a TextureManager. */
export function createTextureCanvas(width = 1, height = 1): TextureCanvas {
  return defaultTextureManager.createCanvas(width, height);
}

/** Compatibility wrapper; production code should depend on a TextureManager. */
export function createManagedCanvasTexture(canvas: TextureCanvas): CanvasTexture {
  return defaultTextureManager.createOwnedCanvasTexture(canvas);
}

/** Compatibility wrapper; production code should depend on a TextureManager. */
export function disposeTextureCanvasSource(canvas: TextureCanvas): void {
  defaultTextureManager.disposeCanvasSource(canvas);
}

/** Compatibility wrapper; production code should depend on a TextureManager. */
export function acquireTextureCanvas2DContext(
  canvas: TextureCanvas,
): TextureCanvas2DContext | null {
  return defaultTextureManager.acquireCanvas2DContext(canvas);
}

/** Compatibility wrapper; production code should depend on a TextureManager. */
export function resolveTextureCanvasPixelSize(input: TexturePixelSizeInput): TexturePixelSize {
  return defaultTextureManager.resolveTexturePixelSize(input);
}

/** Compatibility wrapper; composition roots should call this from renderer capabilities. */
export function configureTextureCanvasMaxTextureSize(maxTextureSize: number): void {
  defaultTextureManager.configureMaxTextureSize(maxTextureSize);
}

/** Reads `MAX_TEXTURE_SIZE` from a WebGL-like context and applies the texture policy cap. */
export function configureTextureCanvasMaxTextureSizeFromContext(
  source: TextureMaxSizeSource,
): void {
  const maxTextureSize = source.getParameter(source.MAX_TEXTURE_SIZE);
  if (typeof maxTextureSize === "number") {
    configureTextureCanvasMaxTextureSize(maxTextureSize);
  }
}

/** Compatibility wrapper; production code should depend on a TextureManager. */
export function isOffscreenCanvasActive(): boolean {
  return defaultTextureManager.isOffscreenCanvasActive();
}

/** Compatibility wrapper; production code should depend on a TextureManager. */
export function resetTextureCanvasStrategyForTests(): void {
  defaultTextureManager.resetStrategyForTests();
}

/** Compatibility wrapper for tests that need the default sizing policy. */
export function resetTextureCanvasPolicyForTests(): void {
  defaultTextureManager.resetPolicyForTests();
}
