/**
 * @file text-raster — SSoT for Canvas-API text rasterisation.
 *
 * Extracted from `Text.ts` so every text-rendering call site in the
 * codebase rasterises through the same pipeline + raster cache. Two
 * classes of consumer use this:
 *
 *   1. `Text` (r3 node) — owns a mesh whose material samples the
 *      cached `CanvasTexture` directly. Cache refcount tracks the
 *      Text node's lifecycle; release on destroy.
 *
 *   2. Face bakers (shader-mode rare-card, etc.) — composite text
 *      into one large "face" canvas. Hot paths can call
 *      `layoutTextRaster` + `paintTextRasterLayoutIntoContext` to draw
 *      directly into the target canvas, while consumers that need a
 *      reusable fragment canvas can call `acquireTextCanvasRaster`.
 *      Neither path creates a `CanvasTexture` for fragments that are
 *      never sampled by a mesh.
 *
 * The face bakers previously called `ctx.fillText` / `ctx.strokeText`
 * directly. That produced subtle quality + metrics differences vs the
 * r3 Text path (Japanese actualBoundingBox jitter, DPR mismatches,
 * drift in the padding/ascent derivation) and violated the SSoT
 * principle — two parallel Canvas-API text paths with diverging rules.
 * Everything now funnels through `paintTextIntoCanvas`.
 */

import {
  acquireRaster,
  releaseRaster,
  type RasterEntry,
  type RasterMetrics,
} from "./TextureCache.ts";
import {
  type TextureCanvas,
  type TextureCanvas2DContext,
  type TextureManager,
} from "./texture-canvas";
import {
  buildFontShorthand,
  snapshotMetrics,
  wrapText,
  type FontStyleSpec,
  type WrappedLine,
} from "./text-metrics.ts";
import {
  resolveCurrentUiTexturePixelRatio,
  textureCanvasScaleFor,
} from "./texture-sizing.ts";

/** Horizontal alignment of wrapped lines within the rasterised box. */
export type TextAlign = "left" | "center" | "right";

/** Stroke applied behind the fill (rimmed glyphs). */
export type TextStrokeSpec = {
  readonly color: string;
  readonly width: number;
};

/**
 * Full input to {@link paintTextIntoCanvas} / {@link acquireTextRaster}.
 *
 * The field set mirrors what `Text.paintInto` closes over: content,
 * font, colour, alignment, padding, line-height, wrap width, line cap,
 * ellipsis policy, optional stroke, optional letter-spacing, and an
 * optional DPR override. A stable `JSON.stringify`able shape is
 * deliberate — the cache key is the JSON serialisation, and two specs
 * with the same fingerprint share a rasterised canvas + GPU texture.
 */
export type TextRasterSpec = {
  readonly text: string;
  readonly font: FontStyleSpec;
  readonly color: string;
  readonly align?: TextAlign;
  readonly lineHeight?: number;
  readonly maxWidth?: number;
  readonly maxLines?: number;
  readonly ellipsis?: boolean;
  readonly padding?: number;
  readonly stroke?: TextStrokeSpec | null;
  /**
   * Inter-glyph spacing in CSS pixels. Honored by Canvas 2D's
   * `letterSpacing` (Chrome 99+, Safari 15.4+, Firefox 96+); the
   * measurement context is configured with the same value so wrap
   * widths stay accurate. `0` (the default) leaves spacing at the
   * font's natural advance.
   */
  readonly letterSpacing?: number;
  /**
   * Drawing-buffer pixel ratio to bake at. Defaults to
   * {@link effectiveDpr}. Callers that bake into a canvas of a
   * specific `resolution` (rare-card face baker, etc.) should pass
   * `Math.max(resolution, effectiveDpr())` so the text raster is at
   * least as dense as its target surface.
   */
  readonly dpr?: number;
};

/** Canvas-only raster entry for consumers that immediately blit text
 * into a larger texture surface and never sample the fragment directly
 * from a Three.js material. */
export type TextCanvasRasterEntry = {
  readonly canvas: TextureCanvas;
  readonly cssWidth: number;
  readonly cssHeight: number;
};

export type TextRasterLayout = RasterMetrics & {
  readonly lines: readonly WrappedLine[];
  readonly fontShorthand: string;
  readonly align: TextAlign;
  readonly padding: number;
  readonly ascent: number;
  readonly lineAdvance: number;
  readonly color: string;
  readonly stroke: TextStrokeSpec | null;
  readonly letterSpacing: number;
};

const DEFAULT_LINE_HEIGHT = 1.2;
const DEFAULT_PADDING = 2;
const DEFAULT_LETTER_SPACING = 0;
const FONT_METRIC_PROBE_TEXT = "Hgあア漢国Ｍ";

/**
 * Applies `letterSpacing` (CSS pixels) to a Canvas 2D context if the
 * runtime supports the property. Browsers without support silently
 * skip the assignment; the wrap pipeline still produces a correct (if
 * tighter) layout because the same context is used for measurement.
 */
function applyLetterSpacing(ctx: TextureCanvas2DContext, letterSpacingPx: number): void {
  if (!("letterSpacing" in ctx)) {
    return;
  }
  const ctxWithLetterSpacing = ctx as TextureCanvas2DContext & {
    letterSpacing?: string;
  };
  ctxWithLetterSpacing.letterSpacing = `${String(letterSpacingPx)}px`;
}

/** Drawing-buffer pixel ratio for crisp rasterisation. Clamped 1..2. */
export function effectiveDpr(): number {
  return resolveCurrentUiTexturePixelRatio();
}

/**
 * Module-level measurement context. `measureText` does not depend on
 * any prior draw state besides `font`, so a single context is enough
 * — sharing one avoids allocating a fresh canvas per rasterisation.
 *
 * The backing canvas is allocated through the r3 texture-canvas SSoT
 * so measurement runs on an `OffscreenCanvas` where available, and
 * falls back to `HTMLCanvasElement` otherwise.
 */
const measurementCache: {
  readonly contexts: WeakMap<TextureManager, TextureCanvas2DContext | null>;
} = { contexts: new WeakMap() };

type TextCanvasRasterInternalEntry = TextCanvasRasterEntry & {
  readonly key: string;
  readonly byteSize: number;
};

type TextCanvasRasterCacheState = {
  readonly entries: Map<string, TextCanvasRasterInternalEntry>;
  totalBytes: number;
};

const textCanvasRasterCacheState: TextCanvasRasterCacheState = {
  entries: new Map(),
  totalBytes: 0,
};

const MAX_TEXT_CANVAS_RASTER_ENTRIES = 512;
const MAX_TEXT_CANVAS_RASTER_BYTES = 16 * 1024 * 1024;

function getMeasurementContext(textureManager: TextureManager): TextureCanvas2DContext | null {
  if (measurementCache.contexts.has(textureManager)) {
    return measurementCache.contexts.get(textureManager) ?? null;
  }
  const canvas = tryCreateMeasurementCanvas(textureManager);
  if (!canvas) {
    measurementCache.contexts.set(textureManager, null);
    return null;
  }
  const ctx = textureManager.acquireCanvas2DContext(canvas);
  if (!ctx) {
    measurementCache.contexts.set(textureManager, null);
    return null;
  }
  measurementCache.contexts.set(textureManager, ctx);
  return ctx;
}

function tryCreateMeasurementCanvas(textureManager: TextureManager): TextureCanvas | null {
  try {
    return textureManager.createCanvas(1, 1);
  } catch (err) {
    console.info("failed to create measurement canvas", err);
    return null;
  }
}

/**
 * Builds a deterministic cache-key string for `spec`. Two specs with
 * the same key share the rasterised canvas + texture via the raster
 * cache's refcount — no repeated paint, no duplicate GPU upload.
 */
export function textRasterKey(spec: TextRasterSpec): string {
  const fp = {
    t: spec.text,
    f: spec.font,
    c: spec.color,
    a: spec.align ?? "left",
    lh: spec.lineHeight ?? DEFAULT_LINE_HEIGHT,
    mw: spec.maxWidth === undefined || spec.maxWidth === Infinity ? -1 : spec.maxWidth,
    ml: spec.maxLines === undefined || spec.maxLines === Infinity ? -1 : spec.maxLines,
    el: spec.ellipsis ?? true,
    p: spec.padding ?? DEFAULT_PADDING,
    s: spec.stroke ?? null,
    ls: spec.letterSpacing ?? DEFAULT_LETTER_SPACING,
    d: spec.dpr ?? effectiveDpr(),
  };
  return `text:${JSON.stringify(fp)}`;
}

/**
 * Paints `spec` into `canvas`, returning the logical (CSS-pixel) size
 * the canvas content occupies. The canvas is resized to `cssW*dpr ×
 * cssH*dpr`; the 2D transform is set so drawing coords are in CSS
 * pixels. Safe to call on a freshly-created 1×1 canvas — this is the
 * exact shape the raster cache hands to paint callbacks.
 *
 * Layout semantics match the former `Text.paintInto`:
 *   - Wrap via {@link wrapText} (行頭禁則-aware) at `maxWidth`.
 *   - Constrain line count to `maxLines`, ellipsising the tail when
 *     `ellipsis` is true (default).
 *   - Baseline at `padding + ascent + idx × lineAdvance`.
 *   - Optional stroke rendered behind the fill.
 */
export function paintTextIntoCanvas(
  canvas: TextureCanvas,
  spec: TextRasterSpec,
  textureManager: TextureManager,
): RasterMetrics & { readonly lines: readonly WrappedLine[] } {
  const dpr = spec.dpr ?? effectiveDpr();
  const ctx = textureManager.acquireCanvas2DContext(canvas);
  if (!ctx) {
    const fallback = layoutTextRaster(spec, null, textureManager);
    return {
      cssWidth: fallback.cssWidth,
      cssHeight: fallback.cssHeight,
      lines: fallback.lines,
    };
  }

  const layout = layoutTextRaster(spec, ctx, textureManager);
  const pixelSize = textureManager.resolveTexturePixelSize({
    logicalWidth: layout.cssWidth,
    logicalHeight: layout.cssHeight,
    pixelRatio: dpr,
    rounding: "even",
  });
  const scale = textureCanvasScaleFor(layout.cssWidth, layout.cssHeight, pixelSize);
  canvas.width = pixelSize.width;
  canvas.height = pixelSize.height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(scale.x, scale.y);
  ctx.clearRect(0, 0, layout.cssWidth, layout.cssHeight);
  paintTextRasterLayoutIntoContext(ctx, layout);

  return {
    cssWidth: layout.cssWidth,
    cssHeight: layout.cssHeight,
    lines: layout.lines,
  };
}

/** Computes the shared text layout without allocating a raster canvas. */
export function layoutTextRaster(
  spec: TextRasterSpec,
  fallbackCtx: TextureCanvas2DContext | null = null,
  textureManager?: TextureManager,
): TextRasterLayout {
  const align = spec.align ?? "left";
  const lineHeight = spec.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const padding = spec.padding ?? DEFAULT_PADDING;
  const maxWidth = spec.maxWidth ?? Infinity;
  const maxLines = spec.maxLines ?? Infinity;
  const ellipsis = spec.ellipsis ?? true;
  const stroke = spec.stroke ?? null;
  const letterSpacing = spec.letterSpacing ?? DEFAULT_LETTER_SPACING;
  const fontShorthand = buildFontShorthand(spec.font);
  const measureCtx = textureManager ? getMeasurementContext(textureManager) : null;
  const ctx = measureCtx ?? fallbackCtx;
  if (!ctx) {
    return fallbackTextRasterLayout({
      spec,
      align,
      lineHeight,
      padding,
      stroke,
      letterSpacing,
      fontShorthand,
    });
  }
  ctx.font = fontShorthand;
  applyLetterSpacing(ctx, letterSpacing);
  const measureFn = (text: string): number => {
    if (text.length === 0) {
      return 0;
    }
    return ctx.measureText(text).width;
  };

  const lines = textRasterLines({
    text: spec.text,
    maxWidth,
    maxLines,
    ellipsis,
    measure: measureFn,
  });

  const probe = probeFontMetrics(ctx, spec.font.size);
  const ascent = probe.ascent;
  const descent = probe.descent;
  const lineAdvance = spec.font.size * lineHeight;
  const widestLine = lines.reduce<number>((max, l) => Math.max(max, l.width), 0);

  const cssWidth = Math.max(1, Math.ceil(widestLine + padding * 2));
  const totalContentHeight = computeTotalContentHeight(lines.length, ascent, descent, lineAdvance);
  const cssHeight = Math.max(1, Math.ceil(totalContentHeight + padding * 2));

  return {
    cssWidth,
    cssHeight,
    lines,
    fontShorthand,
    align,
    padding,
    ascent,
    lineAdvance,
    color: spec.color,
    stroke,
    letterSpacing,
  };
}

/** Paints a precomputed text layout into the current canvas transform. */
export function paintTextRasterLayoutIntoContext(
  ctx: TextureCanvas2DContext,
  layout: TextRasterLayout,
): void {
  ctx.font = layout.fontShorthand;
  applyLetterSpacing(ctx, layout.letterSpacing);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = layout.color;
  if (layout.stroke) {
    ctx.strokeStyle = layout.stroke.color;
    ctx.lineWidth = layout.stroke.width;
    ctx.lineJoin = "round";
  }

  layout.lines.forEach((line, idx) => {
    const baseline = layout.padding + layout.ascent + idx * layout.lineAdvance;
    const x = horizontalOffsetFor(
      layout.align,
      layout.padding,
      layout.cssWidth,
      line.width,
    );
    if (layout.stroke) {
      ctx.strokeText(line.text, x, baseline);
    }
    ctx.fillText(line.text, x, baseline);
  });
}

/**
 * Acquires (or builds) the rasterised canvas + texture for `spec`.
 * Refcount bumped; caller must pair with {@link releaseTextRaster}.
 */
export function acquireTextRaster(
  spec: TextRasterSpec,
  textureManager: TextureManager,
): RasterEntry {
  const key = textRasterKey(spec);
  return acquireRaster(key, (canvas) => {
    const { cssWidth, cssHeight } = paintTextIntoCanvas(canvas, spec, textureManager);
    return { cssWidth, cssHeight };
  }, textureManager);
}

/** Decrements the raster's refcount. Pair 1:1 with acquire. */
export function releaseTextRaster(spec: TextRasterSpec): void {
  releaseRaster(textRasterKey(spec));
}

/**
 * Acquires a canvas-only text raster for face bakers. This uses the
 * exact same text layout and paint code as {@link acquireTextRaster},
 * but skips `CanvasTexture` creation because the caller only needs
 * `ctx.drawImage(entry.canvas, ...)`.
 */
export function acquireTextCanvasRaster(
  spec: TextRasterSpec,
  textureManager: TextureManager,
): TextCanvasRasterEntry {
  const key = textRasterKey(spec);
  const existing = textCanvasRasterCacheState.entries.get(key);
  if (existing) {
    markTextCanvasRasterRecent(existing);
    return existing;
  }
  const canvas = textureManager.createCanvas(1, 1);
  const { cssWidth, cssHeight } = paintTextIntoCanvas(canvas, spec, textureManager);
  const entry: TextCanvasRasterInternalEntry = {
    key,
    canvas,
    cssWidth,
    cssHeight,
    byteSize: Math.max(1, canvas.width * canvas.height * 4),
  };
  textCanvasRasterCacheState.entries.set(key, entry);
  textCanvasRasterCacheState.totalBytes += entry.byteSize;
  trimTextCanvasRasterCacheToCap();
  return entry;
}

/** Telemetry helper for tests and perf debug panels. */
export function textCanvasRasterCacheStats(): {
  readonly entries: number;
  readonly bytes: number;
} {
  return {
    entries: textCanvasRasterCacheState.entries.size,
    bytes: textCanvasRasterCacheState.totalBytes,
  };
}

/** Clears every canvas-only text raster. Intended for tests/lifecycle cleanup. */
export function trimTextCanvasRasterCache(): void {
  textCanvasRasterCacheState.entries.clear();
  textCanvasRasterCacheState.totalBytes = 0;
}

/* ── shared layout helpers ───────────────────────────────────────── */

function fallbackTextRasterLayout(args: {
  readonly spec: TextRasterSpec;
  readonly align: TextAlign;
  readonly lineHeight: number;
  readonly padding: number;
  readonly stroke: TextStrokeSpec | null;
  readonly letterSpacing: number;
  readonly fontShorthand: string;
}): TextRasterLayout {
  const fallbackLines: WrappedLine[] = [
    {
      text: args.spec.text,
      width: args.spec.text.length * args.spec.font.size * 0.5,
    },
  ];
  const cssWidth = Math.max(
    1,
    Math.ceil((fallbackLines[0]?.width ?? 1) + args.padding * 2),
  );
  const cssHeight = Math.max(
    1,
    Math.ceil(args.spec.font.size * args.lineHeight + args.padding * 2),
  );
  return {
    cssWidth,
    cssHeight,
    lines: fallbackLines,
    fontShorthand: args.fontShorthand,
    align: args.align,
    padding: args.padding,
    ascent: args.spec.font.size * 0.8,
    lineAdvance: args.spec.font.size * args.lineHeight,
    color: args.spec.color,
    stroke: args.stroke,
    letterSpacing: args.letterSpacing,
  };
}

function textRasterLines(args: {
  readonly text: string;
  readonly maxWidth: number;
  readonly maxLines: number;
  readonly ellipsis: boolean;
  readonly measure: (text: string) => number;
}): WrappedLine[] {
  if (canUseSingleLineFastPath(args.text, args.maxWidth, args.maxLines)) {
    return [{ text: args.text, width: args.measure(args.text) }];
  }
  const wrapped = wrapText(args.text, {
    maxWidth: args.maxWidth,
    measure: args.measure,
  });
  return constrainLines(
    wrapped,
    args.maxLines,
    args.ellipsis,
    args.maxWidth,
    args.measure,
  );
}

function canUseSingleLineFastPath(
  text: string,
  maxWidth: number,
  maxLines: number,
): boolean {
  if (text.includes("\n")) {
    return false;
  }
  if (Number.isFinite(maxWidth)) {
    return false;
  }
  return !Number.isFinite(maxLines) || maxLines >= 1;
}

function markTextCanvasRasterRecent(entry: TextCanvasRasterInternalEntry): void {
  textCanvasRasterCacheState.entries.delete(entry.key);
  textCanvasRasterCacheState.entries.set(entry.key, entry);
}

function trimTextCanvasRasterCacheToCap(): void {
  while (
    (textCanvasRasterCacheState.entries.size > MAX_TEXT_CANVAS_RASTER_ENTRIES
      || textCanvasRasterCacheState.totalBytes > MAX_TEXT_CANVAS_RASTER_BYTES)
    && textCanvasRasterCacheState.entries.size > 1
  ) {
    evictOldestTextCanvasRaster();
  }
}

function evictOldestTextCanvasRaster(): void {
  const key = oldestTextCanvasRasterKey();
  if (key === null) {
    return;
  }
  const entry = textCanvasRasterCacheState.entries.get(key);
  if (!entry) {
    return;
  }
  textCanvasRasterCacheState.entries.delete(key);
  textCanvasRasterCacheState.totalBytes = Math.max(
    0,
    textCanvasRasterCacheState.totalBytes - entry.byteSize,
  );
}

function oldestTextCanvasRasterKey(): string | null {
  const result = textCanvasRasterCacheState.entries.keys().next();
  if (result.done === true) {
    return null;
  }
  return result.value;
}

function constrainLines(
  lines: WrappedLine[],
  maxLines: number,
  ellipsis: boolean,
  maxWidth: number,
  measure: (text: string) => number,
): WrappedLine[] {
  if (!Number.isFinite(maxLines) || maxLines <= 0 || lines.length <= maxLines) {
    return lines;
  }
  const kept = lines.slice(0, Math.max(0, maxLines - 1));
  const tail = lines.slice(Math.max(0, maxLines - 1)).map((line) => line.text).join("");
  if (!ellipsis) {
    const limited = kept.slice();
    if (limited.length < maxLines && tail.length > 0) {
      limited.push({ text: tail, width: measure(tail) });
    }
    return limited;
  }
  const finalText = ellipsizeToWidth(tail, maxWidth, measure);
  kept.push({ text: finalText, width: measure(finalText) });
  return kept;
}

function ellipsizeToWidth(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string {
  if (!Number.isFinite(maxWidth) || measure(text) <= maxWidth) {
    return text;
  }
  const chars = Array.from(text);
  const ellipsis = "…";
  while (chars.length > 0) {
    chars.pop();
    const candidate = `${chars.join("")}${ellipsis}`;
    if (measure(candidate) <= maxWidth) {
      return candidate;
    }
  }
  return ellipsis;
}

function horizontalOffsetFor(
  align: TextAlign,
  padding: number,
  cssWidth: number,
  lineWidth: number,
): number {
  if (align === "center") {
    return (cssWidth - lineWidth) / 2;
  }
  if (align === "right") {
    return cssWidth - padding - lineWidth;
  }
  return padding;
}

function computeTotalContentHeight(
  lineCount: number,
  ascent: number,
  descent: number,
  lineAdvance: number,
): number {
  if (lineCount === 0) {
    return ascent + descent;
  }
  return ascent + descent + (lineCount - 1) * lineAdvance;
}

function probeFontMetrics(
  ctx: TextureCanvas2DContext,
  fontSize: number,
): { readonly ascent: number; readonly descent: number; readonly width: number } {
  return snapshotMetrics(ctx.measureText(FONT_METRIC_PROBE_TEXT), fontSize);
}
