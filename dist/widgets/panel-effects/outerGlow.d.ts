import { UiPanelEffect } from './types.ts';
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
export declare const OUTER_GLOW_DEFAULTS: Required<OuterGlowOptions>;
/**
 * Panel effect: coloured outer halo behind the plaque chrome. Attaches
 * to the `back` layer. Use for "this panel is active / hot / available"
 * states.
 */
export declare function outerGlow(options?: OuterGlowOptions): UiPanelEffect;
