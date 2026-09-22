import { UiPanelEffect } from './types.ts';
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
export declare const INNER_HIGHLIGHT_DEFAULTS: Required<InnerHighlightOptions>;
/**
 * Panel effect: static top-edge specular highlight, painted above
 * the chrome layer. Attaches to the `front` host.
 */
export declare function innerHighlight(options?: InnerHighlightOptions): UiPanelEffect;
