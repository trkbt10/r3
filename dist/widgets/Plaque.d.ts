import { Container } from '../Container.ts';
import { Node } from '../Node.ts';
import { TextureManager } from '../texture-canvas';
import { DropShadowOptions, UiPanelEffect } from './panel-effects';
import { R3ResizableHudPanelHandle } from './Panel.ts';
/**
 * Structural shape of anything new r3 nodes can be parented under:
 * r3 Stage, Container, or any subclass thereof. Both expose an
 * `add(child: Node) => unknown` — the return shape differs between
 * Stage (`void`) and Container (`this`) so we take the weaker
 * "unknown" form and ignore the return.
 */
export type R3PlaqueHost = {
    add: (child: Node) => unknown;
};
/**
 * Legacy shadow parameter shape. Kept as a structural alias over
 * {@link DropShadowOptions} so existing HUD widgets that import
 * `R3PlaqueShadow` from this module compile unchanged.
 */
export type R3PlaqueShadow = DropShadowOptions;
export type R3PlaqueOptions = {
    readonly host: R3PlaqueHost;
    readonly textureManager: TextureManager;
    readonly x?: number;
    readonly y?: number;
    readonly width: number;
    readonly height: number;
    /** Panel corner radius. Defaults to 12 (matches createR3HudPanel). */
    readonly radius?: number;
    /**
     * Square off the top corners so the plaque can dock flush against
     * a tab bar or drawer seam above it. Forwarded verbatim to
     * {@link createR3ResizableHudPanel}; bottom corners stay rounded.
     */
    readonly flatTop?: boolean;
    /**
     * Legacy soft drop-shadow sugar.
     *
     *   - `true` (back-compat default for existing widgets): prepend
     *     {@link dropShadow} with the tuned HUD defaults.
     *   - `false` or `undefined`: no automatic shadow. The caller may
     *     still add one explicitly via `effects`.
     *   - object: `dropShadow({...})` with the supplied overrides.
     *
     * Prefer the `effects` array for new call sites.
     */
    readonly shadow?: true | R3PlaqueShadow | false;
    /**
     * Panel-decoration effects (shadows, glows, highlights, overlays).
     * Each effect attaches to either the `back` layer (painted beneath
     * the chrome) or the `front` layer (painted on top) based on how
     * it's implemented; the plaque only guarantees the two layers
     * sandwich the chrome correctly.
     *
     * Effects are mounted in array order — earlier effects paint
     * *earlier* within their layer. For the back layer that means
     * earlier effects are farther behind; for the front layer,
     * earlier effects are farther behind the later ones on top.
     */
    readonly effects?: readonly UiPanelEffect[];
};
export type R3PlaqueHandle = {
    /** The resizable HUD panel Container holding the chrome. */
    readonly panel: R3ResizableHudPanelHandle;
    /**
     * Moves + resizes the plaque. The panel re-paints internally; every
     * registered effect's `setRect` fires with the new rect.
     */
    readonly setRect: (x: number, y: number, width: number, height: number) => void;
    /**
     * Advances every animated effect by `dtSeconds`. Effects without a
     * `tick` implementation are skipped silently; effects whose `tick`
     * returns `true` self-terminate — the plaque disposes their handle
     * and drops them from its internal list so subsequent ticks ignore
     * them. Callers with a frame loop (sandbox / stage onFrame) invoke
     * this each frame; static-only plaques can ignore it.
     */
    readonly tick: (dtSeconds: number) => void;
    readonly destroy: () => void;
};
/**
 * Creates a HUD plaque with the production wood-grain + double-frame
 * chrome plus any number of decoration effects (back layer → chrome →
 * front layer, in paint order).
 */
export declare function createR3Plaque(options: R3PlaqueOptions): R3PlaqueHandle;
export type R3PlaqueButtonOptions = {
    readonly host: R3PlaqueHost;
    readonly textureManager: TextureManager;
    readonly x?: number;
    readonly y?: number;
    readonly width: number;
    readonly height: number;
    readonly radius?: number;
    readonly shadow?: true | R3PlaqueShadow | false;
    readonly effects?: readonly UiPanelEffect[];
    /** Optional initial child (icon / label) nested inside the button. */
    readonly content?: Node;
    /** Click handler. Fires on `pointerdown` over the plaque. */
    readonly onActivate?: () => void;
};
export type R3PlaqueButtonHandle = {
    /** Outer container — position this to place the button on screen. */
    readonly node: Container;
    readonly plaque: R3PlaqueHandle;
    /** Swap the centred content node (icon / label). `null` clears it. */
    readonly setContent: (content: Node | null) => void;
    readonly setOnActivate: (handler: (() => void) | null) => void;
    readonly destroy: () => void;
};
/**
 * Interactive plaque button — same chrome + effect slots as the HUD
 * plaque, plus a `pointerdown` handler and a centred content slot.
 * Use for title-scene buttons so they share the HUD's visual
 * language without copy-pasted chrome.
 */
export declare function createR3PlaqueButton(options: R3PlaqueButtonOptions): R3PlaqueButtonHandle;
