/**
 * @file outerGlow — coloured halo behind the plaque, with no vertical
 * offset. Visually a sibling of {@link dropShadow}: both paint a
 * blurred rounded-rect silhouette on the back layer, both share the
 * painting primitive, but they serve different semantic purposes.
 *
 *  - `dropShadow` sits *below* the plaque (positive offsetY, neutral
 *    colour, ~0.45α) so the plaque reads as floating over the scene.
 *  - `outerGlow` sits *around* the plaque (zero offset, warm colour,
 *    wider blur, higher α) so the plaque reads as emitting light —
 *    useful for attention states ("this panel is active",
 *    "reward available here", "hovered").
 *
 * Separating them by name is the point. A call site saying
 * `outerGlow({ color: 0xffd27a })` communicates "highlight / make
 * this pop" more clearly than `dropShadow({ offsetY: 0, alpha: 0.7,
 * blur: 24, color: 0xffd27a })`, and the defaults pre-tune the
 * mundane fields so authors only override what they care about.
 *
 * Stacking is fine: a plaque can mount both a dropShadow AND an
 * outerGlow and get a grounded-AND-glowing look. The plaque paints
 * back-layer effects in array order, so `[dropShadow(), outerGlow()]`
 * puts the glow closest to the plaque (painted later, on top of the
 * shadow) — exactly what you want for the grounded-glow case.
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

export type OuterGlowOptions = {
  /** Glow colour. Default warm gold — matches the HUD frame palette. */
  readonly color?: number;
  /** Peak opacity of the blurred halo. Default 0.55. */
  readonly alpha?: number;
  /** Blur radius in CSS pixels. Default 22 — noticeably softer than the shadow. */
  readonly blur?: number;
  /** Horizontal offset. Default 0 — glow hugs the panel symmetrically. */
  readonly offsetX?: number;
  /** Vertical offset. Default 0 — glow hugs the panel symmetrically. */
  readonly offsetY?: number;
};

/**
 * Default outer-glow parameters. Warm gold, moderately opaque,
 * wider blur than the shadow so the two effects read as distinctly
 * different when stacked.
 */
export const OUTER_GLOW_DEFAULTS: Required<OuterGlowOptions> = {
  color: 0xffd27a,
  alpha: 0.55,
  blur: 22,
  offsetX: 0,
  offsetY: 0,
};

function resolve(options: OuterGlowOptions): BlurredSilhouetteParams {
  return {
    color: options.color ?? OUTER_GLOW_DEFAULTS.color,
    alpha: options.alpha ?? OUTER_GLOW_DEFAULTS.alpha,
    blur: options.blur ?? OUTER_GLOW_DEFAULTS.blur,
    offsetX: options.offsetX ?? OUTER_GLOW_DEFAULTS.offsetX,
    offsetY: options.offsetY ?? OUTER_GLOW_DEFAULTS.offsetY,
  };
}

/**
 * Panel effect: coloured outer halo behind the plaque chrome. Attaches
 * to the `back` layer. Use for "this panel is active / hot / available"
 * states.
 */
export function outerGlow(options: OuterGlowOptions = {}): UiPanelEffect {
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
