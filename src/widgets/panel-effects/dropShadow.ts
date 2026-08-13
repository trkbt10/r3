/**
 * @file dropShadow — the original HUD soft-shadow expressed as a
 * pluggable panel effect.
 *
 * Historically this was baked into {@link createR3Plaque}: the plaque
 * built a single {@link Graphics} behind the chrome, painted via
 * `ctx.filter = "blur(Npx)"`, and repositioned it on every resize.
 * That coupling meant there was no way to have a plaque without this
 * specific shadow, or with a second back-layer decoration.
 *
 * Extracting it here:
 *
 *  - preserves the tuned defaults (offset 0, 6; blur 12 px; α 0.45)
 *    so every existing HUD widget keeps its current look unchanged;
 *  - preserves the padding contract ("3× blur, minimum 8") via the
 *    shared {@link ./_blurred-silhouette} helper, which the outer-glow
 *    effect reuses — both sit in the same "coloured blurred rounded
 *    rect on the back layer" family, so keeping them on one painter
 *    prevents them drifting apart on halo smoothness;
 *  - makes the shadow opt-in per-panel via the `effects` array
 *    rather than a boolean field, so a caller can omit it, stack
 *    two shadows (warm + cool), or substitute something else
 *    entirely without editing Plaque.
 */

import {
  buildBlurredSilhouetteSurface,
  paintBlurredSilhouette,
  repositionBlurredSilhouetteSurface,
  type BlurredSilhouetteParams,
} from "./_blurred-silhouette.ts";
import type {
  UiPanelEffect,
  UiPanelEffectContext,
  UiPanelEffectHandle,
  UiPanelEffectRect,
} from "./types.ts";

export type DropShadowOptions = {
  /** Horizontal offset of the shadow silhouette. Default 0. */
  readonly offsetX?: number;
  /** Vertical offset. Default 6 — shadow falls "below" the plaque. */
  readonly offsetY?: number;
  /** Shadow colour as a 0xRRGGBB hex number. Default 0x000000. */
  readonly color?: number;
  /** Peak opacity at the centre of the blurred silhouette. Default 0.45. */
  readonly alpha?: number;
  /**
   * Gaussian blur radius in CSS pixels, fed directly to
   * `ctx.filter = "blur(Npx)"`. Larger = softer + more spread.
   * Default 12.
   */
  readonly blur?: number;
};

/**
 * Default drop-shadow parameters. Exported so call sites that want to
 * tweak a single field can spread the rest (and so the matching code
 * in HudPart's back-compat sugar can reference the same constants).
 */
export const DROP_SHADOW_DEFAULTS: Required<DropShadowOptions> = {
  offsetX: 0,
  offsetY: 6,
  color: 0x000000,
  alpha: 0.45,
  blur: 12,
};

function resolve(options: DropShadowOptions): BlurredSilhouetteParams {
  return {
    offsetX: options.offsetX ?? DROP_SHADOW_DEFAULTS.offsetX,
    offsetY: options.offsetY ?? DROP_SHADOW_DEFAULTS.offsetY,
    color: options.color ?? DROP_SHADOW_DEFAULTS.color,
    alpha: options.alpha ?? DROP_SHADOW_DEFAULTS.alpha,
    blur: options.blur ?? DROP_SHADOW_DEFAULTS.blur,
  };
}

/**
 * Panel effect: soft Gaussian drop shadow behind the plaque chrome.
 * Attaches to the `back` layer.
 */
export function dropShadow(options: DropShadowOptions = {}): UiPanelEffect {
  const params = resolve(options);
  return function mount(
    ctx: UiPanelEffectContext,
    rect: UiPanelEffectRect,
  ): UiPanelEffectHandle {
    const node = buildBlurredSilhouetteSurface(
      params,
      ctx.textureManager,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );
    paintBlurredSilhouette(node, params, ctx.radius, rect.width, rect.height);
    ctx.hosts.back.add(node);

    return {
      setRect(next: UiPanelEffectRect): void {
        repositionBlurredSilhouetteSurface(
          node,
          params,
          next.x,
          next.y,
          next.width,
          next.height,
        );
        paintBlurredSilhouette(node, params, ctx.radius, next.width, next.height);
      },
      destroy(): void {
        node.destroy();
      },
    };
  };
}
