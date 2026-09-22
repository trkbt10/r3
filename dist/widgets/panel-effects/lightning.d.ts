import { UiPanelEffect } from './types.ts';
export type LightningOptions = {
    /** Bright bolt-core colour. Default icy white. */
    readonly color?: number;
    /** Outer glow colour the halo tints toward. Default saturated indigo. */
    readonly glowColor?: number;
    /** Master intensity multiplier. Default 1. */
    readonly intensity?: number;
    /**
     * Noise scroll speed in shader-seconds-per-second. Higher = the
     * bolts wiggle and flicker faster. Default 1.8.
     */
    readonly speed?: number;
    /**
     * Horizontal warp amplitude in UV units (0..0.5). Default 0.12 — a
     * meaningful sway without any single bolt crossing more than a
     * fifth of the panel width.
     */
    readonly warp?: number;
    /** Core half-width in CSS pixels. Default 1.2. */
    readonly coreWidthPx?: number;
    /** Halo half-width in CSS pixels. Default 14. */
    readonly haloWidthPx?: number;
};
export declare const LIGHTNING_DEFAULTS: Required<LightningOptions>;
/**
 * Panel effect: shader-rendered lightning bolts. Attaches to the
 * `front` layer so the bolts paint over the chrome. Animated —
 * the plaque owner drives `tick`.
 */
export declare function lightning(options?: LightningOptions): UiPanelEffect;
