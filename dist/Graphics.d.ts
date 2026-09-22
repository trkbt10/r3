import { Plane } from 'three';
import { Node, NodeOptions } from './Node.ts';
import { TextureManager } from './texture-canvas';
export type GraphicsOptions = NodeOptions & {
    /** Drawing surface width in logical pixels. */
    readonly width: number;
    /** Drawing surface height in logical pixels. */
    readonly height: number;
    readonly textureManager: TextureManager;
};
/** Imperative draw API. Drawing-state matches Phaser's Graphics shape. */
export declare class Graphics extends Node {
    private _width;
    private _height;
    private surface;
    /**
     * Canvas 2D context. `null` only in headless test environments
     * — every draw method becomes a no-op when context is absent so
     * the surrounding scene graph stays usable for hit-testing /
     * event coverage.
     *
     * The context flavour (CanvasRenderingContext2D vs
     * OffscreenCanvasRenderingContext2D) follows from the texture-canvas
     * SSoT's runtime decision. All of the 2D methods used below are
     * part of the shared interface set, so the union can be consumed
     * without narrowing at every call site.
     */
    private readonly geometry;
    private readonly material;
    private readonly mesh;
    private readonly textureManager;
    private readonly style;
    constructor(options: GraphicsOptions);
    get width(): number;
    get height(): number;
    private get canvas();
    private get ctx();
    private get texture();
    /**
     * Resizes the drawing surface. The canvas backing is replaced at
     * the new DPR-adjusted size, the context transform is reapplied,
     * and the mesh's geometry scale is updated so the plane still
     * covers the logical width × height. The canvas is BLANK after
     * this call — the caller must re-paint (same contract as
     * {@link clear} but with new dimensions).
     *
     * Kept separate from `clear()` because resize triggers a GPU
     * texture re-allocation (the CanvasTexture's backing store
     * tracks the HTML canvas), which is more expensive than a simple
     * clear. Callers should debounce resizes when possible.
     */
    setSize(width: number, height: number): this;
    /**
     * Resets the canvas to fully transparent and clears any in-progress
     * path. Mirrors Phaser's `Graphics.clear()`. No-op when the
     * runtime can't provide a 2D context (headless tests).
     */
    clear(): this;
    fillStyle(color: number, alpha?: number): this;
    lineStyle(width: number, color: number, alpha?: number): this;
    fillRect(x: number, y: number, w: number, h: number): this;
    strokeRect(x: number, y: number, w: number, h: number): this;
    fillRoundedRect(x: number, y: number, w: number, h: number, radius: number): this;
    strokeRoundedRect(x: number, y: number, w: number, h: number, radius: number): this;
    /**
     * Fills a rounded rectangle with a CSS-filter Gaussian blur
     * applied. This is the "real" soft shadow primitive — unlike
     * stacking multiple semi-transparent rects (which produces a
     * step-function falloff), `ctx.filter = "blur(Npx)"` runs the
     * raster through a true Gaussian convolution, so the result is
     * continuously graded.
     *
     * The filter expands the visible footprint by roughly 2–3× `blurPx`
     * in every direction, so the drawing surface (this Graphics'
     * width × height) must include padding on all sides; otherwise the
     * edges clip to a hard line and you get back the stepped look you
     * were trying to avoid. A typical pattern is:
     *
     *   const pad = Math.ceil(blurPx * 3);
     *   const shadow = new Graphics({
     *     width: w + pad * 2,
     *     height: h + pad * 2,
     *     x: panelX + offsetX - pad,
     *     y: panelY + offsetY - pad,
     *     originX: 0,
     *     originY: 0,
     *   });
     *   shadow.fillStyle(0x000000, 0.5);
     *   shadow.fillBlurredRoundedRect(pad, pad, w, h, radius, blurPx);
     *
     * Headless environments that return a null 2D context (unit tests)
     * are a no-op. The previous `ctx.filter` value is preserved +
     * restored so the Graphics object's draw state is unaffected.
     */
    fillBlurredRoundedRect(x: number, y: number, w: number, h: number, radius: number, blurPx: number): this;
    /**
     * Fills a rounded-rect region with a tiled image overlay. Unlike a
     * separate textured {@link Node.Image} plane laid on top of the
     * panel, the image here is clipped by the rounded path itself — the
     * corners are *cut* rather than *covered*, so there is no texture
     * bleed outside the silhouette when the panel sits over a non-black
     * background.
     *
     * Tiles step in logical pixels at `tileWidth × tileHeight` (defaulting
     * to the image's intrinsic size). `alpha` multiplies the tile's
     * opacity so callers can lay the grain in as a subtle overlay
     * without touching the outer `fillStyle`. The method composes with
     * an existing fill — call {@link fillRoundedRect} first for the
     * base colour, then this for the overlay.
     */
    fillPatternRoundedRect(x: number, y: number, w: number, h: number, radius: number, image: CanvasImageSource, alpha?: number, tileWidth?: number, tileHeight?: number): this;
    fillCircle(cx: number, cy: number, radius: number): this;
    strokeCircle(cx: number, cy: number, radius: number): this;
    fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this;
    strokeLine(x1: number, y1: number, x2: number, y2: number): this;
    beginPath(): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    closePath(): this;
    fillPath(): this;
    strokePath(): this;
    /**
     * Stamps a rounded-rectangle path into the context. Internal
     * helper used by both fill/stroke variants. Caller is responsible
     * for the null-context guard.
     */
    private pathRoundedRect;
    private applyMeshOffset;
    protected onPivotChanged(): void;
    protected applyMaterialAlpha(alpha: number): void;
    protected assignRenderOrderForSelf(counter: number, depthOffset: number): number;
    setClippingPlanes(planes: readonly Plane[] | null): void;
    destroy(): void;
    private ensureSurfaceMatchesSettings;
    private resizeSurfaceForCurrentSettings;
    private applyCanvasTransform;
    private rasterDebugInfo;
}
