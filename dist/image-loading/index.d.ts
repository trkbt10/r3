/**
 * @file Image loading — minimal keyed image-slot provider consumed
 * by {@link "../widgets/Panel.ts"} for its wood-grain HUD texture
 * overlay.
 *
 * `Panel.ts` needs exactly two operations to paint an optional
 * texture overlay without blocking on it: "give me the current load
 * state for this key" ({@link ImageSlotProvider.ensureImage}) and
 * "tell me when it becomes ready" ({@link ImageSlotProvider.onAssetReady}).
 * This module is the library's own minimal source of truth for that
 * contract — a small keyed image cache — rather than pulling in an
 * application's full asset-registry stack (spec registration,
 * preload strategies, SVG rasterisation, settlement bookkeeping
 * across many asset kinds), none of which `Panel.ts` needs.
 *
 * The default provider treats the key itself as the image URL and
 * loads it with a bare `HTMLImageElement` — the "naive" strategy the
 * contract promises when no host provider is configured. A host that
 * already owns a richer asset pipeline (keyed specs, preloading,
 * CDN URL resolution) injects its own provider via
 * {@link configureR3ImageSlotProvider}, keeping the same key space
 * `Panel.ts` already calls with (e.g. `"textures/hud-panel-bg"`) by
 * mapping keys to real URLs inside the injected provider.
 */
/** A load slot for one keyed image. `loaded` flips to `true` exactly once, when the underlying `HTMLImageElement`'s `load` event fires. */
export type ImageSlot = {
    readonly image: HTMLImageElement;
    loaded: boolean;
    failed: boolean;
};
/**
 * The contract {@link "../widgets/Panel.ts"} programs against.
 * Implementations may resolve `key` however they like (a URL
 * directly, a lookup into a registered spec table, …) as long as
 * `ensureImage` is idempotent per key and `onAssetReady` fires
 * exactly once per subscription.
 */
export type ImageSlotProvider = {
    /**
     * Ensures the image for `key` is loading (or already loaded/failed).
     * Returns the live slot so callers can inspect `loaded` / `failed`
     * synchronously without awaiting. Idempotent: repeated calls with
     * the same key return the same slot and never start a second load.
     */
    ensureImage(key: string): ImageSlot;
    /**
     * Fires `cb` exactly once when the image for `key` becomes ready.
     * Already-ready: fires synchronously. Already-failed: never fires.
     * Returns a disposer that removes the callback if it hasn't fired
     * yet.
     */
    onAssetReady(key: string, cb: () => void): () => void;
};
/**
 * Builds the naive default provider: treats `key` as a URL and loads
 * it via `new Image()`. Exported (rather than only instantiated as
 * the module singleton) so hosts that want the default *behaviour*
 * with isolated state — tests, multiple independent Stages — can
 * construct their own instance instead of sharing the singleton.
 */
export declare function createUrlImageSlotProvider(): ImageSlotProvider;
/**
 * Replaces the image-slot provider every r3 widget calls through.
 * Call once at application startup, before constructing widgets that
 * load images, so every subsequent `ensureImage` / `onAssetReady`
 * call routes through the injected provider.
 */
export declare function configureR3ImageSlotProvider(provider: ImageSlotProvider): void;
/** {@link ImageSlotProvider.ensureImage} on the currently configured provider. */
export declare function ensureImage(key: string): ImageSlot;
/** {@link ImageSlotProvider.onAssetReady} on the currently configured provider. */
export declare function onAssetReady(key: string, cb: () => void): () => void;
