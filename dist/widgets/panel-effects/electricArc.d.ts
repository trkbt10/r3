import { UiPanelEffect } from './types.ts';
export type ElectricArcOptions = {
    /** Bright core stroke colour. Default icy white with a cool-blue tint. */
    readonly color?: number;
    /** Outer glow colour painted beneath the core. Default saturated indigo. */
    readonly glowColor?: number;
    /** Simultaneous arcs. Default 3 — enough to always have at least one visible. */
    readonly arcCount?: number;
    /** Full cycle (active + gap) per arc in milliseconds. Default 420. */
    readonly cycleMs?: number;
    /**
     * Fraction of the cycle the arc is visible (fade-in + hold +
     * fade-out combined). Default 0.45 — the remaining 0.55 is a dark
     * gap until respawn, which gives the flicker a natural rhythm.
     */
    readonly activeRatio?: number;
    /** Core stroke width in CSS pixels. Default 1.6. */
    readonly coreWidth?: number;
    /** Outer glow stroke width. Default 5 — reads as a bloomed halo. */
    readonly glowWidth?: number;
    /** Number of intermediate jagged points per arc. Default 6. */
    readonly segments?: number;
    /**
     * Maximum perpendicular jitter applied at each intermediate point,
     * in CSS pixels. Default 14 — enough to look angular without
     * crossing the panel repeatedly.
     */
    readonly jitter?: number;
};
export declare const ELECTRIC_ARC_DEFAULTS: Required<ElectricArcOptions>;
/**
 * Panel effect: crackling lightning arcs across the panel face.
 * Attaches to the `front` layer. Advances on
 * {@link UiPanelEffectHandle.tick tick} — the owner drives the clock.
 */
export declare function electricArc(options?: ElectricArcOptions): UiPanelEffect;
