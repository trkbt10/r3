/**
 * @file innerHighlight — soft specular sheen painted on top of the
 * panel chrome.
 *
 * Exists primarily as the "second real effect" in the panel-effects
 * library: it exercises the `front` layer (dropShadow only uses
 * `back`), so composing a plaque with both `[dropShadow(), innerHighlight()]`
 * produces a visibly different result than either alone. Visually it
 * reads as a faint light source from above — the plaque looks lit
 * rather than flat.
 *
 * Implementation: paint a blurred rounded-rect inside the panel's
 * silhouette, biased toward the top edge, with a bright low-alpha
 * fill. The surface matches the panel rect exactly so the blur halo
 * fades out within the panel rather than bleeding into the canvas
 * below. The highlight's own rounded corners are matched to the
 * panel's corner radius so it hugs the top edge cleanly.
 *
 * No per-frame tick — a static highlight re-paints only on resize.
 */

import { Graphics } from "../../Graphics.ts";
import type {
  UiPanelEffect,
  UiPanelEffectContext,
  UiPanelEffectHandle,
  UiPanelEffectRect,
} from "./types.ts";

export type InnerHighlightOptions = {
  /** Highlight colour. Default warm white — reads as a gold-tinted gloss. */
  readonly color?: number;
  /** Peak opacity of the blurred highlight fill. Default 0.22. */
  readonly alpha?: number;
  /**
   * Fraction of the panel height the highlight occupies, measured from
   * the top edge. Default 0.5 — roughly the upper half fades into the
   * lower half. Clamp to (0, 1].
   */
  readonly coverage?: number;
  /**
   * Blur radius in CSS pixels. Default 10 — enough to hide the
   * highlight's source rectangle outline while staying sharp enough
   * to read as a specular hit rather than diffuse glow.
   */
  readonly blur?: number;
  /**
   * Horizontal inset from the panel edge. Default 6 — keeps the
   * highlight from crowding the outer gold hairline when the panel is
   * narrow.
   */
  readonly inset?: number;
};

export const INNER_HIGHLIGHT_DEFAULTS: Required<InnerHighlightOptions> = {
  color: 0xfff0d8,
  alpha: 0.22,
  coverage: 0.5,
  blur: 10,
  inset: 6,
};

type Resolved = Required<InnerHighlightOptions>;

function resolve(options: InnerHighlightOptions): Resolved {
  return {
    color: options.color ?? INNER_HIGHLIGHT_DEFAULTS.color,
    alpha: options.alpha ?? INNER_HIGHLIGHT_DEFAULTS.alpha,
    coverage: options.coverage ?? INNER_HIGHLIGHT_DEFAULTS.coverage,
    blur: options.blur ?? INNER_HIGHLIGHT_DEFAULTS.blur,
    inset: options.inset ?? INNER_HIGHLIGHT_DEFAULTS.inset,
  };
}

function paint(
  g: Graphics,
  resolved: Resolved,
  radius: number,
  width: number,
  height: number,
): void {
  g.clear();
  const highlightWidth = Math.max(0, width - resolved.inset * 2);
  const highlightHeight = Math.max(
    0,
    Math.min(height - resolved.inset, height * resolved.coverage),
  );
  if (highlightWidth <= 0 || highlightHeight <= 0) {
    return;
  }
  // Keep the highlight's corner radius aligned with the panel's so
  // the top edge tracks the chrome silhouette. The bottom edge rides
  // inside the panel's interior where its rounding isn't visible.
  const highlightRadius = Math.max(0, radius - resolved.inset);
  g.fillStyle(resolved.color, resolved.alpha);
  g.fillBlurredRoundedRect(
    resolved.inset,
    resolved.inset,
    highlightWidth,
    highlightHeight,
    highlightRadius,
    resolved.blur,
  );
}

/**
 * Panel effect: static top-edge specular highlight, painted above
 * the chrome layer. Attaches to the `front` host.
 */
export function innerHighlight(
  options: InnerHighlightOptions = {},
): UiPanelEffect {
  const resolved = resolve(options);
  return function mount(
    ctx: UiPanelEffectContext,
    rect: UiPanelEffectRect,
  ): UiPanelEffectHandle {
    const node = new Graphics({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      originX: 0,
      originY: 0,
      textureManager: ctx.textureManager,
    });
    paint(node, resolved, ctx.radius, rect.width, rect.height);
    ctx.hosts.front.add(node);

    return {
      setRect(next: UiPanelEffectRect): void {
        node.setPosition(next.x, next.y);
        node.setSize(next.width, next.height);
        paint(node, resolved, ctx.radius, next.width, next.height);
      },
      destroy(): void {
        node.destroy();
      },
    };
  };
}
