import { UiPanelEffect } from './types.ts';
export type BorderPulseOptions = {
    /** Stroke colour. Default warm gold. */
    readonly color?: number;
    /** Stroke width in CSS pixels. Default 2. */
    readonly width?: number;
    /** Stroke inset from the panel edge. Default 2 — sits just inside the outer frame. */
    readonly inset?: number;
    /** Peak (crest) opacity. Default 0.9. */
    readonly peakAlpha?: number;
    /** Trough opacity. Default 0.25 — non-zero so the outline never vanishes. */
    readonly troughAlpha?: number;
    /** Full breath-cycle length in milliseconds. Default 1800. */
    readonly periodMs?: number;
};
export declare const BORDER_PULSE_DEFAULTS: Required<BorderPulseOptions>;
/**
 * Panel effect: breathing coloured outline on top of the plaque
 * chrome. Attaches to the `front` layer. Advances with {@link tick}
 * — the plaque / sandbox owner drives the clock.
 */
export declare function borderPulse(options?: BorderPulseOptions): UiPanelEffect;
