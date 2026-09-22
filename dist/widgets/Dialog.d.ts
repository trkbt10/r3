import { Container } from '../Container.ts';
import { Stage } from '../Stage.ts';
import { TextureManager } from '../texture-canvas';
export type R3DialogVisual = {
    readonly fillColor: number;
    readonly borderColor: number;
    readonly accentColor: number;
    readonly backdropColor: number;
    readonly backdropAlpha: number;
    readonly radius: number;
};
export type R3DialogTiming = {
    readonly backdropFadeMs: number;
    readonly cardOpenMs: number;
    readonly contentDelayMs: number;
    readonly contentFadeMs: number;
    readonly closeFadeMs: number;
    readonly closeHoldMs: number;
};
export type R3DialogSize = {
    readonly width: number;
    readonly height: number;
};
export type R3DialogBuildContext = {
    /** Stage hosting the dialog — exposed for build-callbacks that need tweens, pointer, etc. */
    readonly stage: Stage;
    readonly textureManager: TextureManager;
    /**
     * Container the dialog content lives in. Starts at alpha 0 and
     * fades in `contentDelayMs` after the card pop begins. Anything
     * pushed in here therefore gets the staged reveal for free; nodes
     * added after the initial reveal still render correctly (they
     * just skip the shared fade because the container is already at
     * alpha 1).
     */
    readonly content: Container;
    /** Top-left corner of the card in viewport coordinates. */
    readonly cardX: number;
    readonly cardY: number;
    readonly width: number;
    readonly height: number;
    /** Card centre in viewport coordinates — convenient for centred text. */
    readonly centerX: number;
    readonly centerY: number;
    /**
     * Runs the close animation and (after `closeHoldMs`) tears the
     * dialog down + invokes `onClose`. Idempotent: subsequent calls
     * are no-ops.
     */
    readonly close: () => void;
    /**
     * Schedules a one-shot callback owned by the dialog lifecycle.
     * The returned handle is cleared automatically when the dialog
     * tears down (either via `close()` animation completion or a
     * scene-driven `handle.destroy()`), so callers don't need their
     * own bookkeeping. Use this in preference to a bare
     * `window.setTimeout` — bare timeouts outlive the dialog and
     * fire their callback against a torn-down context.
     */
    readonly scheduleTimeout: (handler: () => void, delayMs: number) => void;
};
export type R3DialogOptions = {
    readonly stage: Stage;
    readonly textureManager: TextureManager;
    readonly size: R3DialogSize;
    readonly visual?: Partial<R3DialogVisual>;
    readonly timing?: Partial<R3DialogTiming>;
    readonly depth?: number;
    /**
     * If true, clicking the backdrop runs `close()`. Defaults to
     * false because summary cards (victory/defeat) demand an explicit
     * choice on the confirm button.
     */
    readonly dismissOnBackdrop?: boolean;
    readonly build: (ctx: R3DialogBuildContext) => void;
    /** Invoked exactly once, after the close animation completes. */
    readonly onClose?: () => void;
};
export type R3DialogHandle = {
    /** The root container — already added to the stage. */
    readonly node: Container;
    /**
     * Tears the dialog down immediately (no close animation, no
     * `onClose`). Used by scene shutdown / cinematic disposers. Safe
     * to call multiple times; also safe after a user-driven close.
     */
    readonly destroy: () => void;
};
/**
 * Padding (per side) added to the Graphics canvas so the outer stroke
 * doesn't clip at the canvas edge. Exported so tests and downstream
 * tooling can assert the invariant without duplicating the constant.
 */
export declare const R3_DIALOG_CARD_PAD = 8;
/**
 * Minimum drawing surface {@link drawCardLocal} needs — the caller
 * must construct its Graphics with these dimensions. Centralised so
 * the "what size does my card Graphics need" answer lives next to
 * the draw function that decides the layout.
 */
export declare function cardGraphicsSize(width: number, height: number): {
    readonly width: number;
    readonly height: number;
};
/**
 * Minimal structural subset of {@link Graphics} that {@link drawCardLocal}
 * touches. Used so tests can hand in a recording fake without spinning
 * up a real Canvas2D; the production `Graphics` class still satisfies
 * the contract automatically (TypeScript widens `this` return into
 * `void`).
 */
export type R3CardDrawTarget = {
    clear(): void;
    fillStyle(color: number, alpha?: number): void;
    fillRoundedRect(x: number, y: number, w: number, h: number, r: number): void;
    lineStyle(width: number, color: number, alpha?: number): void;
    strokeRoundedRect(x: number, y: number, w: number, h: number, r: number): void;
};
/**
 * Draws the card chrome into `graphics`. The Graphics surface is
 * (width + 16) × (height + 16) — the +16 is padding so the outer
 * stroke doesn't clip at the canvas edge. We draw with an 8 px
 * inset so the card sits centred in the padded canvas; because
 * the Graphics node uses `originX: 0.5, originY: 0.5`, the UV
 * mapping then aligns the card's visual centre with the owning
 * container's origin, and the container's `scaleX / scaleY = 0.9
 * → 1` open-pop tween scales around the visual centre.
 *
 * Note: r3 Graphics is a rasterised Canvas2D surface — drawing at
 * negative coords falls outside the canvas and produces no pixels.
 * The Phaser-port-era `x = -width/2` pattern was wrong because it
 * assumed a vector-style origin at the node centre.
 *
 * Exported so regression tests can drive this directly against a
 * recording fake — the invariant "all draw offsets stay ≥ 0" is the
 * whole reason this function exists and must not be relitigated
 * silently.
 */
export declare function drawCardLocal(graphics: R3CardDrawTarget, width: number, height: number, visual: R3DialogVisual): void;
/** Opens an r3 dialog. Mirrors `openDialog(scene, options)` semantics. */
export declare function openR3Dialog(options: R3DialogOptions): R3DialogHandle;
