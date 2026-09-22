import { R3LayoutRoot } from '../LayoutMotion.ts';
import { TweenManager } from '../Tween.ts';
import { TextureManager } from '../texture-canvas';
export type R3ButtonVariant = "primary" | "secondary";
export type R3ButtonClickSfx = "title-button-click" | "shop-click" | null;
export type R3ButtonOptions = {
    /** Centre X of the button rectangle in stage-logical pixels. */
    readonly x: number;
    /** Centre Y of the button rectangle in stage-logical pixels. */
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly label: string;
    readonly onClick: () => void;
    readonly textureManager: TextureManager;
    readonly variant?: R3ButtonVariant;
    readonly disabled?: boolean;
    /**
     * SFX id played on click. Defaults to "title-button-click". Pass
     * `null` to opt out (useful when the caller plays its own sound).
     */
    readonly clickSfx?: R3ButtonClickSfx;
    /**
     * Optional tween manager for the press-pulse animation. When not
     * supplied the press visual still runs (immediate scale flick) but
     * does not animate. In production every Stage carries its own
     * tweens, so callers usually pass `stage.tweens`.
     */
    readonly tweens?: TweenManager;
};
export type R3ButtonHandle = {
    /** The root container — attach to a scene/stage to render. */
    readonly node: R3LayoutRoot;
    readonly setDisabled: (disabled: boolean) => void;
    readonly setLabel: (label: string) => void;
    /**
     * Move + resize the button against a top-left rectangle. Mirrors the
     * `setRect` shape every HUD widget exposes so the layout-engine
     * `bindPositionAndSize` adapter can drive the button without bespoke
     * arithmetic in the caller. The visual centre tracks the rect centre
     * so the press-pulse scale animates symmetrically (the bg Rect is
     * pinned at originX/Y = 0.5 inside the container).
     */
    readonly setRect: (x: number, y: number, width: number, height: number) => void;
    /** Read-only access to the live outer rect (top-left + width/height). */
    readonly getRect: () => {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
    };
    readonly destroy: () => void;
};
/**
 * Builds an r3 button. Returns a handle whose `node` is a Container
 * the caller adds to its scene/stage. Destroying the handle disposes
 * the underlying r3 nodes (which release their textures).
 */
export declare function createR3Button(options: R3ButtonOptions): R3ButtonHandle;
