/**
 * @file Shared painter for back-layer effects that project a blurred
 * rounded-rect silhouette (drop shadow, outer glow, and anything else
 * shaped like "a coloured echo of the panel outline at a tuned
 * offset / blur").
 *
 * Every effect in this family has the same four knobs — colour, alpha,
 * blur, offset — and the same padding contract on the drawing
 * surface: `ctx.filter = "blur(Npx)"` expands the visible halo by
 * about 2.5–3× the blur radius, so the Graphics canvas must include
 * that much padding on every side or the halo clips against the edge
 * and the stepped-falloff look returns. Centralising the padding
 * arithmetic here means the shadow effect and the glow effect can't
 * drift apart on this one detail (which would be a subtle regression:
 * one halo reads smooth, the other banded).
 *
 * The shape is kept pure — `paintBlurredSilhouette` only draws into a
 * {@link Graphics} that the caller owns — so the caller retains
 * control of when to create / reposition / destroy the Graphics
 * node. Effects that want lifecycle automation build on top of this.
 */

import { Graphics } from "../../Graphics.ts";
import type { TextureManager } from "../../texture-canvas";

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
export function blurredSilhouettePadding(blur: number): number {
  return Math.max(8, Math.ceil(blur * 3));
}

/**
 * Paints the blurred silhouette into `target`. The rounded-rect is
 * drawn at `(pad, pad)` inside the surface so the halo spreads into
 * the padding rather than clipping against the canvas edge.
 * `target` must already be sized to `width + pad*2` × `height + pad*2`.
 */
export function paintBlurredSilhouette(
  target: Graphics,
  params: BlurredSilhouetteParams,
  radius: number,
  width: number,
  height: number,
): void {
  const pad = blurredSilhouettePadding(params.blur);
  target.clear();
  target.fillStyle(params.color, params.alpha);
  target.fillBlurredRoundedRect(pad, pad, width, height, radius, params.blur);
}

/**
 * Builds a sized-and-positioned Graphics ready for
 * {@link paintBlurredSilhouette}. The offset / padding convention is
 * encoded here so callers don't re-derive it — one line of shadow
 * effect code becomes one `buildBlurredSilhouetteSurface` call.
 */
export function buildBlurredSilhouetteSurface(
  params: BlurredSilhouetteParams,
  textureManager: TextureManager,
  x: number,
  y: number,
  width: number,
  height: number,
): Graphics {
  const pad = blurredSilhouettePadding(params.blur);
  return new Graphics({
    x: x + params.offsetX - pad,
    y: y + params.offsetY - pad,
    width: width + pad * 2,
    height: height + pad * 2,
    originX: 0,
    originY: 0,
    textureManager,
  });
}

/**
 * Moves + resizes a silhouette surface in place. Mirrors the position
 * + size arithmetic of {@link buildBlurredSilhouetteSurface} so setRect
 * handlers can repaint without recomputing the padding contract.
 */
export function repositionBlurredSilhouetteSurface(
  target: Graphics,
  params: BlurredSilhouetteParams,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const pad = blurredSilhouettePadding(params.blur);
  target.setPosition(x + params.offsetX - pad, y + params.offsetY - pad);
  target.setSize(width + pad * 2, height + pad * 2);
}
