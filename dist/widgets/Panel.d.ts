import { Container } from '../Container.ts';
import { Graphics } from '../Graphics.ts';
import { TextureManager } from '../texture-canvas';
export type R3PanelOptions = {
    /** Top-left X in stage-logical pixels. */
    readonly x: number;
    /** Top-left Y in stage-logical pixels. */
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly radius: number;
    /** Fill colour as a 0xRRGGBB integer. */
    readonly fill: number;
    /** Fill alpha. Defaults to 1. */
    readonly fillAlpha?: number;
    /** Border colour as a 0xRRGGBB integer. */
    readonly border: number;
    readonly textureManager: TextureManager;
    /** Border alpha. Defaults to 1. */
    readonly borderAlpha?: number;
    /** Border line width. Defaults to 1. */
    readonly borderWidth?: number;
    /**
     * Square the top corners by stamping a flat strip across the
     * rounded-rect's top band. Use for panels that dock flush against
     * a tab bar or other flat edge above them. Defaults to `false`
     * (fully rounded).
     */
    readonly flatTop?: boolean;
    /**
     * When set, draws a second inset stroke 4 px inside the outer border
     * using this colour. The gold-framed HUD panels use this to produce
     * the double-line frame that reads as a lacquered plaque.
     */
    readonly innerOutline?: {
        readonly color: number;
        readonly alpha?: number;
        readonly width?: number;
        /** Inset from the outer rect edge. Defaults to 4 px. */
        readonly inset?: number;
    };
};
/**
 * Builds a panel Graphics node at (x, y). The caller attaches it to
 * its parent container. Origin is the top-left (unlike most r3
 * primitives which default to centre) to match the layout arithmetic
 * prep pages already do in their `computeLayout` helpers.
 */
export declare function createR3Panel(options: R3PanelOptions): Graphics;
/**
 * Convenience preset for the in-battle HUD panels (gold-framed dark
 * plaques). Central so the chrome stays coherent across every widget
 * in the game scene — corner-anchored readouts, dialpad, log ticker.
 *
 * The caller supplies only geometry; the palette is fixed so changing
 * the HUD frame colour is a one-line edit here.
 */
export type R3HudPanelGeometry = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    /** Defaults to 12. Keep in [6, 16] to match the HUD silhouette. */
    readonly radius?: number;
    /**
     * Square off the top two corners so the plaque can dock flush
     * against a tab bar / drawer seam above it. The fill, wood-grain
     * overlay, outer gold stroke, and inner bronze stroke are all
     * stamped over the rounded top band so the silhouette reads
     * flat-top / rounded-bottom in one pass (no second Graphics
     * overlay bleeding past the rounded corner).
     *
     * Defaults to `false` (fully rounded plaque).
     */
    readonly flatTop?: boolean;
    readonly textureManager: TextureManager;
};
/**
 * Builds a gold-framed HUD plaque as a {@link Container} holding one
 * {@link Graphics}. The canvas composites:
 *
 *   1. Opaque dark rounded-rect fill.
 *   2. Wood-grain tiled pattern, clipped to the rounded silhouette.
 *   3. Outer gold stroke + inner bronze stroke for the double frame.
 *
 * The wood-grain image loads asynchronously. Until it's ready, the
 * panel paints as a solid dark rounded rect; the grain is stamped in
 * as soon as {@link ensureImage} settles. This matches the original
 * behaviour (no blocking on asset boot) while fixing the rounded-
 * corner bleed that the previous R3Image-overlay implementation had.
 */
export declare function createR3HudPanel(geometry: R3HudPanelGeometry): Container;
/**
 * Resizable variant of {@link createR3HudPanel}. Keeps a single
 * {@link Graphics} node and re-paints the plaque chrome whenever
 * {@link R3ResizableHudPanelHandle.setRect} is called — same wood-
 * grain overlay, same double-frame (outer gold + inner bronze),
 * same dark fill. Use this for layout-engine-driven widgets whose
 * outer rect changes at runtime; the static {@link createR3HudPanel}
 * is still appropriate for panels with fixed authored geometry.
 */
export type R3ResizableHudPanelHandle = {
    readonly node: Container;
    /** The Graphics node the chrome is painted into. */
    readonly canvas: Graphics;
    /** Current radius; read-only. */
    readonly radius: number;
    /**
     * Moves + resizes the panel. Repaints the chrome at the new
     * dimensions. No-op when width / height are unchanged.
     */
    readonly setRect: (x: number, y: number, width: number, height: number) => void;
    readonly destroy: () => void;
};
/**
 * Builds a resizable HUD panel chrome node. Geometry changes repaint
 * the same backing canvas so callers can keep a stable scene object.
 */
export declare function createR3ResizableHudPanel(geometry: R3HudPanelGeometry): R3ResizableHudPanelHandle;
