import { EasingFn, EasingName } from '../Easing.ts';
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
export type LayoutVanishingPoint = LayoutVanishingPointProjection & (LayoutPoint | {
    readonly ref: string;
});
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
export type JustifyContent = "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
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
export declare const INSTANT: Transition;
/**
 * Expands the shorthand {@link EdgeInput} into a full {@link EdgeBox}.
 * Missing sides in a partial object fall back to 0 — same rule as CSS
 * shorthand: "padding: 16" sets every edge to 16, "padding: { top: 8 }"
 * leaves the other three at zero.
 */
export declare function normaliseEdge(input: EdgeInput | undefined): EdgeBox;
/** Sum of opposite edges along the horizontal axis. */
export declare function edgeHorizontal(edge: EdgeBox): number;
/** Sum of opposite edges along the vertical axis. */
export declare function edgeVertical(edge: EdgeBox): number;
