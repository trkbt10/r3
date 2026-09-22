import { UiPanelEffect } from './types.ts';
/** One orb anchor in normalised (0..1) panel coords. */
export type PlasmaOrbPosition = readonly [number, number];
export type PlasmaOrbsOptions = {
    /** Base orb tint. Default royal-violet. */
    readonly color?: number;
    /** Hot-core colour. Default near-white with a cool bias. */
    readonly coreColor?: number;
    /** Orb diameter in CSS pixels. Default 38. */
    readonly size?: number;
    /** Master intensity multiplier. Default 1. */
    readonly intensity?: number;
    /** Swirl speed in shader-seconds. Default 1. */
    readonly speed?: number;
    /** Normalised (0..1) positions on the panel. Default four corners. */
    readonly positions?: readonly PlasmaOrbPosition[];
};
export declare const PLASMA_ORBS_DEFAULTS: {
    readonly color: 10053375;
    readonly coreColor: 15919871;
    readonly size: 38;
    readonly intensity: 1;
    readonly speed: 1;
    readonly positions: readonly PlasmaOrbPosition[];
};
/**
 * Panel effect: N plasma-swirl orbs at configurable normalised
 * positions. Attaches to the `front` layer. Animated — the plaque
 * owner drives `tick`.
 */
export declare function plasmaOrbs(options?: PlasmaOrbsOptions): UiPanelEffect;
