import { UiPanelEffect } from './types.ts';
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
export declare const CORNER_ORNAMENTS_DEFAULTS: Required<CornerOrnamentsOptions>;
/**
 * Panel effect: four L-shaped corner ornaments on the plaque face.
 * Attaches to the `front` layer.
 */
export declare function cornerOrnaments(options?: CornerOrnamentsOptions): UiPanelEffect;
