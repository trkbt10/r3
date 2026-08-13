/**
 * @file Core value types for the r3 layout engine.
 *
 * The engine is a simplified, Yoga-flavoured flex system: a tree of
 * {@link FlexNode} + {@link LeafNode} resolves to concrete
 * {@link LayoutRect}s in two passes (measure → arrange). This file
 * defines every type the tree is parameterised on so the rest of the
 * module has a single set of names to reach for.
 *
 * ## Size resolution
 *
 *   - A `number` is taken literally as an outer pixel size.
 *   - `"auto"` defers to the measure pass: a flex container sums its
 *     children's main-axis sizes + gap + padding; a leaf reports zero
 *     (leaves are expected to carry their own intrinsic size unless
 *     the parent stretches them via `align: "stretch"`).
 *
 * ## Edge insets
 *
 *   - Authored as a single `number` (all four edges) or a partial
 *     {@link EdgeBox}; {@link normaliseEdge} expands either to a full
 *     box. The engine only ever works against the full box.
 *
 * ## Animation
 *
 *   - {@link Transition} specifies how a leaf's live rect moves
 *     toward its new computed rect. The runtime drives these through
 *     the existing r3 {@link TweenManager}, so any {@link EasingName}
 *     the rest of the codebase speaks is accepted verbatim.
 */

import type { EasingFn, EasingName } from "../Easing.ts";

export type LayoutRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type LayoutPoint = {
  readonly x: number;
  readonly y: number;
};

export type LayoutVanishingPointAxis = "x" | "y" | "radial";

export type LayoutVanishingPointProjection = {
  /**
   * Logical depth layer in the vanishing-point camera space.
   *
   * This is not a manual "tilt strength" or "scale amount". It says
   * where the rect lives along the depth axis: values below
   * `referenceDepth` are farther away and therefore project smaller /
   * closer to the vanishing point; values above `referenceDepth` are
   * closer to the viewer and project larger / more foreground.
   */
  readonly depth?: number;
  /** Which edge decides near/far. `radial` chooses the dominant screen axis. */
  readonly axis?: LayoutVanishingPointAxis;
  /**
   * Camera distance for depth projection. Larger values flatten the
   * visible size/tilt differences caused by depth. Used with
   * `referenceDepth` and `depthScale`; omitted = no depth-derived
   * size projection.
   */
  readonly projectionDistance?: number;
  /**
   * Depth that projects at authored size. This is the reference plane
   * for the layout: smaller depths are behind it, larger depths are in
   * front of it.
   */
  readonly referenceDepth?: number;
  /** Multiplier applied to the depth difference before perspective projection. */
  readonly depthScale?: number;
  readonly strength?: number;
};

export type LayoutVanishingPoint = LayoutVanishingPointProjection &
  (LayoutPoint | { readonly ref: string });

export type LayoutVanishingPointPreset = LayoutPoint & LayoutVanishingPointProjection;

export type LayoutVanishingPointPresets = Readonly<Record<string, LayoutVanishingPointPreset>>;

/**
 * Optional visual transform applied after a node receives its layout
 * rect. The flex engine still measures and arranges axis-aligned
 * rectangles; bindings may then render those rectangles tilted,
 * skewed, or biased toward a vanishing point.
 */
export type LayoutTransform = {
  /** Transform origin as a fraction of the rect. Defaults to centre. */
  readonly originX?: number;
  readonly originY?: number;
  /** Clockwise screen-space rotation in radians. */
  readonly rotate?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  /** Screen-space skew in radians. */
  readonly skewX?: number;
  readonly skewY?: number;
  /** Three-space panel tilt in radians. Positive values recede the far edge. */
  readonly tiltX?: number;
  readonly tiltY?: number;
  /**
   * Projective strength. `0` disables it. Small values such as
   * `0.001` are enough for HUD chrome; larger values can invert a
   * panel.
   */
  readonly perspective?: number;
  /**
   * Convenience authoring control for "fan toward this screen point".
   * The binding converts it into additional skew based on the node's
   * rect centre.
   */
  readonly vanishingPoint?: LayoutVanishingPoint;
};

export type LayoutFrame = LayoutRect & {
  readonly transform?: LayoutTransform;
};

export type Size = {
  readonly width: number;
  readonly height: number;
};

/** Pixel number or `"auto"` (resolve from children / stretch). */
export type SizeValue = number | "auto";

export type EdgeBox = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

/** Either a single number applied to every edge or a partial box. */
export type EdgeInput = number | Partial<EdgeBox>;

export type FlexDirection = "row" | "column";

export type JustifyContent =
  | "start"
  | "center"
  | "end"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type AlignItems = "start" | "center" | "end" | "stretch";

export type Transition = {
  /** Total animation time in milliseconds. `0` = apply instantly. */
  readonly durationMs: number;
  /**
   * Easing name or function. Uses the same registry as r3's
   * {@link TweenManager} so layout transitions and widget tweens
   * speak the same language.
   */
  readonly easing: EasingName | EasingFn;
  /** Optional start delay. */
  readonly delayMs?: number;
};

export const INSTANT: Transition = { durationMs: 0, easing: "Linear" };

/**
 * Expands the shorthand {@link EdgeInput} into a full {@link EdgeBox}.
 * Missing sides in a partial object fall back to 0 — same rule as CSS
 * shorthand: "padding: 16" sets every edge to 16, "padding: { top: 8 }"
 * leaves the other three at zero.
 */
export function normaliseEdge(input: EdgeInput | undefined): EdgeBox {
  if (input === undefined) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  if (typeof input === "number") {
    return { top: input, right: input, bottom: input, left: input };
  }
  return {
    top: input.top ?? 0,
    right: input.right ?? 0,
    bottom: input.bottom ?? 0,
    left: input.left ?? 0,
  };
}

/** Sum of opposite edges along the horizontal axis. */
export function edgeHorizontal(edge: EdgeBox): number {
  return edge.left + edge.right;
}

/** Sum of opposite edges along the vertical axis. */
export function edgeVertical(edge: EdgeBox): number {
  return edge.top + edge.bottom;
}
