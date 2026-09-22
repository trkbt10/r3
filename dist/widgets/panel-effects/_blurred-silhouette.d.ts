import { Graphics } from '../../Graphics.ts';
import { TextureManager } from '../../texture-canvas';
export type BlurredSilhouetteParams = {
    readonly offsetX: number;
    readonly offsetY: number;
    readonly color: number;
    readonly alpha: number;
    /** Gaussian blur radius in CSS pixels. */
    readonly blur: number;
};
/**
 * Padding (CSS pixels) the Graphics surface must leave on every side
 * so the blur halo has room to fade out. `blur(Npx)` spreads pixels
 * by roughly 2.5–3× the blur radius — 3× with an 8 px floor is the
 * margin that keeps tiny-blur halos non-clipping without wasting
 * pixels for the large-blur case.
 */
export declare function blurredSilhouettePadding(blur: number): number;
/**
 * Paints the blurred silhouette into `target`. The rounded-rect is
 * drawn at `(pad, pad)` inside the surface so the halo spreads into
 * the padding rather than clipping against the canvas edge.
 * `target` must already be sized to `width + pad*2` × `height + pad*2`.
 */
export declare function paintBlurredSilhouette(target: Graphics, params: BlurredSilhouetteParams, radius: number, width: number, height: number): void;
/**
 * Builds a sized-and-positioned Graphics ready for
 * {@link paintBlurredSilhouette}. The offset / padding convention is
 * encoded here so callers don't re-derive it — one line of shadow
 * effect code becomes one `buildBlurredSilhouetteSurface` call.
 */
export declare function buildBlurredSilhouetteSurface(params: BlurredSilhouetteParams, textureManager: TextureManager, x: number, y: number, width: number, height: number): Graphics;
/**
 * Moves + resizes a silhouette surface in place. Mirrors the position
 * + size arithmetic of {@link buildBlurredSilhouetteSurface} so setRect
 * handlers can repaint without recomputing the padding contract.
 */
export declare function repositionBlurredSilhouetteSurface(target: Graphics, params: BlurredSilhouetteParams, x: number, y: number, width: number, height: number): void;
