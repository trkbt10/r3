import { UiPanelEffect } from './types.ts';
export type AuroraGlowOptions = {
    /** Primary colour near the panel edge. Default warm gold. */
    readonly colorInner?: number;
    /** Secondary colour the flow sweeps toward. Default cool magenta. */
    readonly colorOuter?: number;
    /** Overall intensity multiplier. Default 1. */
    readonly intensity?: number;
    /** How far the glow reaches outside the panel edge, in CSS pixels. Default 42. */
    readonly spread?: number;
    /**
     * Flow speed in radians / second of shader-time — higher = faster
     * colour sweep and noise drift. Default 0.9 (a calm breathing
     * pace).
     */
    readonly flowSpeed?: number;
    /** Noise scale — how busy the aurora-ribbon flow looks. Default 2.6. */
    readonly noiseScale?: number;
};
export declare const AURORA_GLOW_DEFAULTS: Required<AuroraGlowOptions>;
/**
 * Panel effect: shader-rendered aurora-like outer glow. Attaches to
 * the `back` layer. Animated — the plaque owner drives `tick`.
 */
export declare function auroraGlow(options?: AuroraGlowOptions): UiPanelEffect;
