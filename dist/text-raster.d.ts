import { RasterEntry, RasterMetrics } from './TextureCache.ts';
import { TextureCanvas, TextureCanvas2DContext, TextureManager } from './texture-canvas';
import { FontStyleSpec, WrappedLine } from './text-metrics.ts';
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
/** Drawing-buffer pixel ratio for crisp rasterisation. Clamped 1..2. */
export declare function effectiveDpr(): number;
/**
 * Builds a deterministic cache-key string for `spec`. Two specs with
 * the same key share the rasterised canvas + texture via the raster
 * cache's refcount — no repeated paint, no duplicate GPU upload.
 */
export declare function textRasterKey(spec: TextRasterSpec): string;
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
export declare function paintTextIntoCanvas(canvas: TextureCanvas, spec: TextRasterSpec, textureManager: TextureManager): RasterMetrics & {
    readonly lines: readonly WrappedLine[];
};
/** Computes the shared text layout without allocating a raster canvas. */
export declare function layoutTextRaster(spec: TextRasterSpec, fallbackCtx?: TextureCanvas2DContext | null, textureManager?: TextureManager): TextRasterLayout;
/** Paints a precomputed text layout into the current canvas transform. */
export declare function paintTextRasterLayoutIntoContext(ctx: TextureCanvas2DContext, layout: TextRasterLayout): void;
/**
 * Acquires (or builds) the rasterised canvas + texture for `spec`.
 * Refcount bumped; caller must pair with {@link releaseTextRaster}.
 */
export declare function acquireTextRaster(spec: TextRasterSpec, textureManager: TextureManager): RasterEntry;
/** Decrements the raster's refcount. Pair 1:1 with acquire. */
export declare function releaseTextRaster(spec: TextRasterSpec): void;
/**
 * Acquires a canvas-only text raster for face bakers. This uses the
 * exact same text layout and paint code as {@link acquireTextRaster},
 * but skips `CanvasTexture` creation because the caller only needs
 * `ctx.drawImage(entry.canvas, ...)`.
 */
export declare function acquireTextCanvasRaster(spec: TextRasterSpec, textureManager: TextureManager): TextCanvasRasterEntry;
/** Telemetry helper for tests and perf debug panels. */
export declare function textCanvasRasterCacheStats(): {
    readonly entries: number;
    readonly bytes: number;
};
/** Clears every canvas-only text raster. Intended for tests/lifecycle cleanup. */
export declare function trimTextCanvasRasterCache(): void;
