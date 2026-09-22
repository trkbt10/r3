import { UiPanelEffect } from './types.ts';
export type DropShadowOptions = {
    /** Horizontal offset of the shadow silhouette. Default 0. */
    readonly offsetX?: number;
    /** Vertical offset. Default 6 — shadow falls "below" the plaque. */
    readonly offsetY?: number;
    /** Shadow colour as a 0xRRGGBB hex number. Default 0x000000. */
    readonly color?: number;
    /** Peak opacity at the centre of the blurred silhouette. Default 0.45. */
    readonly alpha?: number;
    /**
     * Gaussian blur radius in CSS pixels, fed directly to
     * `ctx.filter = "blur(Npx)"`. Larger = softer + more spread.
     * Default 12.
     */
    readonly blur?: number;
};
/**
 * Default drop-shadow parameters. Exported so call sites that want to
 * tweak a single field can spread the rest (and so the matching code
 * in HudPart's back-compat sugar can reference the same constants).
 */
export declare const DROP_SHADOW_DEFAULTS: Required<DropShadowOptions>;
/**
 * Panel effect: soft Gaussian drop shadow behind the plaque chrome.
 * Attaches to the `back` layer.
 */
export declare function dropShadow(options?: DropShadowOptions): UiPanelEffect;
