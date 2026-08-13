/**
 * @file cornerOrnaments — four small L-shaped marks painted into the
 * corners of the plaque, on the front layer. Thematic to the game's
 * wood-lacquer plaque aesthetic, reminiscent of metal corner guards
 * on a lacquered box.
 *
 * Each corner gets two perpendicular strokes meeting at the inner
 * vertex of the rounded-rect silhouette. The arms extend inward
 * along the panel's edge for `armLength` pixels — short enough to
 * stay out of the way of any caption / glyph the plaque might host,
 * long enough to register as intentional ornament and not noise.
 *
 * This is the first effect in the library that emits *multiple*
 * {@link Graphics} nodes (one per corner). It still fits the single-
 * Node idiom of most effects by wrapping them in a {@link Container}
 * — from the plaque's perspective, one front-layer child is
 * attached, just like innerHighlight / borderPulse.
 */

import { Container } from "../../Container.ts";
import { Graphics } from "../../Graphics.ts";
import type {
  UiPanelEffect,
  UiPanelEffectContext,
  UiPanelEffectHandle,
  UiPanelEffectRect,
} from "./types.ts";

export type CornerOrnamentsOptions = {
  /** Stroke colour. Default warm gold — matches the HUD frame palette. */
  readonly color?: number;
  /** Stroke width in CSS pixels. Default 2. */
  readonly width?: number;
  /** Peak opacity of the strokes. Default 0.85. */
  readonly alpha?: number;
  /** Length of each L-arm in CSS pixels. Default 14. */
  readonly armLength?: number;
  /**
   * Inset of the L's inner vertex from the panel edge. Default 8 —
   * sits cleanly inside the rounded corner of the plaque chrome at
   * the standard radius of 12.
   */
  readonly inset?: number;
  /**
   * When `true`, the supplied {@link armLength} / {@link inset} / {@link width}
   * are interpreted as **design-time** values for a panel whose
   * `min(width, height) === referenceSize`, and they are scaled
   * proportionally with the live panel's `min(width, height)`. This
   * keeps the L-shape's silhouette balanced when the host plaque
   * shrinks for a compact viewport — without this, the fixed inset
   * eats most of the available space and the L-arms read as crushed.
   *
   * Off by default so existing callers (TitleScene buttons sized at
   * the original 48 px design height, panel-effects gallery cases)
   * keep their fixed-px decoration. Opt in from a host that knows it
   * will be re-sized: e.g. a footer CTA whose height differs by
   * breakpoint.
   */
  readonly scale?: boolean;
  /**
   * Min(width, height) at which the supplied inset / armLength / width
   * apply verbatim. Default 48 — the OrnateButton's PC footer height,
   * picked so the historical PC rendering is preserved when scaling is
   * enabled and the button is mounted at that height. Ignored when
   * {@link scale} is false.
   */
  readonly referenceSize?: number;
};

export const CORNER_ORNAMENTS_DEFAULTS: Required<CornerOrnamentsOptions> = {
  color: 0xffd27a,
  width: 2,
  alpha: 0.85,
  armLength: 14,
  inset: 8,
  scale: false,
  referenceSize: 48,
};

type Resolved = Required<CornerOrnamentsOptions>;

function resolve(options: CornerOrnamentsOptions): Resolved {
  return {
    color: options.color ?? CORNER_ORNAMENTS_DEFAULTS.color,
    width: options.width ?? CORNER_ORNAMENTS_DEFAULTS.width,
    alpha: options.alpha ?? CORNER_ORNAMENTS_DEFAULTS.alpha,
    armLength: options.armLength ?? CORNER_ORNAMENTS_DEFAULTS.armLength,
    inset: options.inset ?? CORNER_ORNAMENTS_DEFAULTS.inset,
    scale: options.scale ?? CORNER_ORNAMENTS_DEFAULTS.scale,
    referenceSize: options.referenceSize ?? CORNER_ORNAMENTS_DEFAULTS.referenceSize,
  };
}

function paint(
  g: Graphics,
  resolved: Resolved,
  width: number,
  height: number,
): void {
  g.clear();
  // When `scale` is on, derive a multiplier from live min-dim vs
  // referenceSize so the L-shape silhouette tracks the panel size.
  // The multiplier is clamped at 1 so callers don't get accidentally
  // larger ornaments on bigger panels — scaling is intended as a
  // "shrink with the chrome" affordance, not a "grow with the chrome"
  // one. Strokes also scale, but with a 1 px floor so the L stays
  // visible at very small sizes.
  const minDim = Math.min(width, height);
  const k = resolved.scale ? Math.min(1, minDim / resolved.referenceSize) : 1;
  const armLength = resolved.armLength * k;
  const inset = resolved.inset * k;
  const stroke = resolved.scale ? Math.max(1, resolved.width * k) : resolved.width;
  // Clamp the arm so it never crosses the panel centre when the
  // panel is narrower than 2 × (inset + armLength). Doing this per
  // axis independently means a very thin-and-wide panel keeps its
  // horizontal arm length while its vertical arm gets trimmed.
  const hArm = Math.max(0, Math.min(armLength, width / 2 - inset));
  const vArm = Math.max(0, Math.min(armLength, height / 2 - inset));
  if (hArm <= 0 || vArm <= 0) {
    return;
  }
  g.lineStyle(stroke, resolved.color, resolved.alpha);

  // Top-left: arms go right + down from (inset, inset).
  g.strokeLine(inset, inset, inset + hArm, inset);
  g.strokeLine(inset, inset, inset, inset + vArm);

  // Top-right: arms go left + down from (width - inset, inset).
  const rightX = width - inset;
  g.strokeLine(rightX, inset, rightX - hArm, inset);
  g.strokeLine(rightX, inset, rightX, inset + vArm);

  // Bottom-left: arms go right + up from (inset, height - inset).
  const bottomY = height - inset;
  g.strokeLine(inset, bottomY, inset + hArm, bottomY);
  g.strokeLine(inset, bottomY, inset, bottomY - vArm);

  // Bottom-right: arms go left + up from (width - inset, height - inset).
  g.strokeLine(rightX, bottomY, rightX - hArm, bottomY);
  g.strokeLine(rightX, bottomY, rightX, bottomY - vArm);
}

/**
 * Panel effect: four L-shaped corner ornaments on the plaque face.
 * Attaches to the `front` layer.
 */
export function cornerOrnaments(
  options: CornerOrnamentsOptions = {},
): UiPanelEffect {
  const resolved = resolve(options);
  return function mount(
    ctx: UiPanelEffectContext,
    rect: UiPanelEffectRect,
  ): UiPanelEffectHandle {
    const container = new Container({
      x: rect.x,
      y: rect.y,
      name: "r3:panel-effect:corner-ornaments",
    });
    // Single Graphics draws all four L-shapes in one surface — cheaper
    // than four tiny Graphics nodes and keeps the effect's host
    // footprint symmetrical with the other simple effects.
    const canvas = new Graphics({
      x: 0,
      y: 0,
      width: rect.width,
      height: rect.height,
      originX: 0,
      originY: 0,
      textureManager: ctx.textureManager,
    });
    container.add(canvas);
    paint(canvas, resolved, rect.width, rect.height);
    ctx.hosts.front.add(container);

    return {
      setRect(next: UiPanelEffectRect): void {
        container.setPosition(next.x, next.y);
        canvas.setSize(next.width, next.height);
        paint(canvas, resolved, next.width, next.height);
      },
      destroy(): void {
        container.destroy();
      },
    };
  };
}
