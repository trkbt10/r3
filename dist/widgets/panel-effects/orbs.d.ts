import { UiPanelEffect } from './types.ts';
/** One orb anchor, in normalised panel coordinates (0..1 on each axis). */
export type OrbPosition = readonly [number, number];
export type OrbsOptions = {
    /** Orb colour. Default warm gold. */
    readonly color?: number;
    /** Solid-core radius in CSS pixels. Default 4. */
    readonly coreRadius?: number;
    /** Halo outer radius in CSS pixels (before blur). Default 12. */
    readonly haloRadius?: number;
    /** Halo blur radius in CSS pixels. Default 12. */
    readonly haloBlur?: number;
    /** Peak node alpha at the crest of the pulse. Default 1. */
    readonly alphaMax?: number;
    /** Trough node alpha at the valley. Default 0.35 — orbs never fully disappear. */
    readonly alphaMin?: number;
    /** Full pulse cycle length in milliseconds. Default 2400. */
    readonly periodMs?: number;
    /**
     * Phase offset between consecutive orbs as a fraction of
     * {@link periodMs}. Default 0.25 (quarter-cycle) — produces a
     * travelling chase when positions are laid out on a ring.
     */
    readonly phaseStagger?: number;
    /**
     * Anchor positions in normalised (0..1) panel coordinates. Default
     * is the four corners. The positions stick to the panel rect on
     * resize, so `[1, 1]` always lands on the bottom-right corner
     * regardless of panel width.
     */
    readonly positions?: readonly OrbPosition[];
};
export declare const ORBS_DEFAULTS: {
    readonly color: 16765562;
    readonly coreRadius: 4;
    readonly haloRadius: 12;
    readonly haloBlur: 12;
    readonly alphaMax: 1;
    readonly alphaMin: 0.35;
    readonly periodMs: 2400;
    readonly phaseStagger: 0.25;
    readonly positions: readonly OrbPosition[];
};
/**
 * Panel effect: pulsing orbs at configured panel-normalised
 * positions. Attaches to the `front` layer. Advances on
 * {@link UiPanelEffectHandle.tick tick} — the owner drives the clock.
 */
export declare function orbs(options?: OrbsOptions): UiPanelEffect;
