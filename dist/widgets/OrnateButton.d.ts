import { R3LayoutRoot } from '../LayoutMotion.ts';
import { TweenManager } from '../Tween.ts';
import { TextureManager } from '../texture-canvas';
import { UiPanelEffect } from './panel-effects';
/**
 * Behaviour-only variants. The two values map onto the same chrome
 * (the gold-framed plaque) but pick different text colours so primary
 * CTAs have a brighter cream label than secondary actions. Effects
 * are not derived from the variant — they are caller-supplied via
 * {@link R3OrnateButtonOptions.effects}.
 */
export type R3OrnateButtonVariant = "primary" | "secondary";
/**
 * Per-call colour overrides. Only the fields that need to deviate
 * from the variant default need to be supplied. Used to align the
 * button with a hosting surface — e.g. a "next match" CTA on the
 * prep tab's dark-wood backdrop wants the default gold tint, but a
 * future destructive CTA might prefer a warm-red wash without
 * authoring a bespoke effect stack.
 */
export type R3OrnateButtonAccent = {
    /** Label colour. Falls back to the variant default. */
    readonly text?: string;
    /**
     * Hover overlay fill. Tweens 0 → `hoverAlpha` on pointerover.
     * Defaults to {@link COLOR.GOLD}; the chrome is gold-framed so
     * gold tint reads as "this surface is responding to the cursor"
     * regardless of the host page palette.
     */
    readonly hover?: string;
    /** Maximum alpha the hover overlay reaches. Defaults to 0.18. */
    readonly hoverAlpha?: number;
};
export type R3OrnateButtonClickSfx = "title-button-click" | "shop-click" | null;
export type R3OrnateButtonOptions = {
    /** Centre X of the button rectangle. */
    readonly x: number;
    /** Centre Y of the button rectangle. */
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly label: string;
    readonly onClick: () => void;
    readonly textureManager: TextureManager;
    readonly variant?: R3OrnateButtonVariant;
    readonly disabled?: boolean;
    /**
     * Panel-effect stack passed verbatim to the underlying plaque. If
     * omitted, defaults to a tasteful preset (drop shadow + inner
     * highlight + corner ornaments) so callers that just want "more
     * decorated than the flat button" don't have to author the stack.
     * Pass `[]` to opt out of every effect except the plaque chrome.
     */
    readonly effects?: readonly UiPanelEffect[];
    /**
     * Per-call colour overrides. Useful when the hosting surface needs
     * the button to read as "primary on this dark page" with a tint
     * that isn't the default gold (e.g. a defeat-context CTA pinned to
     * the defeat-red palette). Omit for the variant defaults.
     */
    readonly accent?: R3OrnateButtonAccent;
    readonly clickSfx?: R3OrnateButtonClickSfx;
    /**
     * Plaque corner radius. Forwarded to {@link createR3Plaque};
     * defaults to 14, matching the value the plaque would use without
     * an override but spelled out here so future re-tuning is
     * widget-local.
     */
    readonly radius?: number;
    /**
     * Optional tween manager for the press-pulse animation. Without one
     * the press still flicks scale down for one frame so the visual
     * acknowledgement isn't lost; supplying `stage.tweens` upgrades
     * that to a smooth scale → restore tween.
     */
    readonly tweens?: TweenManager;
    /**
     * Stable identifier exposed via the r3 inspector ({@link Stage} →
     * `window.__R3__`) so external automation can locate this button by
     * a meaningful name (e.g. `"title:start-button"`). Defaults to the
     * generic `"r3:ornate-button"` so behaviour is unchanged when the
     * caller doesn't opt in.
     */
    readonly name?: string;
    /**
     * Opt-in proportional decoration scaling for the *default* effect
     * stack. When `true`, the corner-ornament L-shapes shrink with the
     * button's live `min(width, height)` instead of staying at the fixed
     * design-pixel size. Use this for footer CTAs whose height changes
     * by breakpoint (e.g. 48 px on PC, 30 px on mobile-landscape) — the
     * fixed-inset rendering crushes the L's vertical leg below ~36 px.
     *
     * Ignored when {@link effects} is supplied (the caller is responsible
     * for the stack's behaviour). Off by default so existing callers
     * sized for the historical 48 px button height keep their pixel-
     * exact ornaments.
     */
    readonly scaleDecorations?: boolean;
    /**
     * Reference height used by the scaled default-effect stack. Pixel
     * values in the stack's effects (cornerOrnaments arm/inset, etc.)
     * apply verbatim when `min(width, height) === referenceSize`, and
     * scale proportionally below that. Defaults to 48 — the historical
     * OrnateButton design height — so a button that is ever rendered at
     * 48 px or larger preserves the original look. Ignored when
     * {@link scaleDecorations} is false or {@link effects} is supplied.
     */
    readonly decorationReferenceSize?: number;
};
export type R3OrnateButtonHandle = {
    /** Root Container. Attach to a scene/stage to render. */
    readonly node: R3LayoutRoot;
    readonly setDisabled: (disabled: boolean) => void;
    readonly setLabel: (label: string) => void;
    /** Move + resize via a top-left rect (layout-engine compatible). */
    readonly setRect: (x: number, y: number, width: number, height: number) => void;
    readonly getRect: () => {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
    };
    /** Live width / height after the most recent {@link setRect}. */
    readonly getSize: () => {
        readonly width: number;
        readonly height: number;
    };
    /** Forwards to the plaque's tick — drives any animated effects. */
    readonly tick: (dtSeconds: number) => void;
    readonly destroy: () => void;
};
/**
 * Builds an ornate plaque-chrome button. Returns a handle that the
 * caller attaches to a scene root via `scene.root.add(handle.node)`.
 */
export declare function createR3OrnateButton(options: R3OrnateButtonOptions): R3OrnateButtonHandle;
