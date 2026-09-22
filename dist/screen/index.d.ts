/**
 * @file Screen domain — the logical drawing surface a {@link Stage}
 * composes against, plus the inner viewbox interactive content
 * should keep inside.
 *
 * Three concepts in one type:
 *
 *   1. **Size** (`width × height`) — the renderer's logical pixel
 *      grid. The orthographic camera bounds and the source of truth
 *      every scene mounted on a Stage reads from.
 *   2. **Viewbox** — an inner {@link Rect} where interactive content
 *      (HUD, dialogs, chrome) should draw. The viewbox excludes host
 *      chrome (notch / home indicator / browser URL bar) so the
 *      operative parts of the UI never sit under a thumb-blocking
 *      strip. Background fills (vignettes, backdrops) draw against
 *      the *full screen*; everything interactive draws inside the
 *      viewbox.
 *   3. **Orientation** — derived `"portrait" | "landscape"` so
 *      layout rules can branch on it without re-deriving from
 *      `width >= height` everywhere.
 *
 * ## Why viewbox is a domain field, not a parameter
 *
 * The screen-as-a-thing carries both "the surface" and "the safe
 * inner zone" together because every consumer that needs one needs
 * the other in lock-step. Bundling them on one frozen object makes
 * the contract atomic: inject one Screen, get both.
 *
 * The viewbox defaults to the full screen (no inset). Hosts with a
 * notch / home indicator construct screens whose viewbox is the
 * safe-area-padded inner rect.
 */
/** Inclusive top-left rect with width / height. */
export type Rect = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
};
export type Orientation = "portrait" | "landscape";
/** Logical drawing surface. */
export type Screen = {
    readonly width: number;
    readonly height: number;
    /**
     * Inner rect interactive widgets should stay inside of. Background
     * fills can paint the full screen; the viewbox is for content the
     * user taps, reads, or drags.
     */
    readonly viewbox: Rect;
    /** Derived from `width >= height`. */
    readonly orientation: Orientation;
};
/** Builds a frozen Screen, deriving missing fields. */
export declare function makeScreen(opts: {
    readonly width: number;
    readonly height: number;
    readonly viewbox?: Rect;
    readonly orientation?: Orientation;
}): Screen;
/**
 * Returns a fresh Screen with the same width / height but the given
 * `viewbox`. Used to push live safe-area changes (browser URL bar
 * collapsing, fullscreen entry removing host chrome) through to a
 * Stage.
 */
export declare function withViewbox(screen: Screen, viewbox: Rect): Screen;
/** Standard PC landscape screen (1280 × 720, full viewbox). Convenience default for hosts that don't compute their own. */
export declare const PC_SCREEN: Screen;
