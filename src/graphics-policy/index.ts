/**
 * @file Graphics policy — minimal pixel-density policy consumed by
 * {@link "../texture-sizing.ts"} when sizing canvas-backed textures.
 *
 * `texture-sizing.ts` needs exactly one runtime signal from the host
 * application: how aggressively to follow the display's device pixel
 * ratio (DPR) when rasterising UI textures (Text, Rect fills,
 * Graphics canvases). This module is the library's own minimal
 * source of truth for that signal — a `"logical" | "device"` mode
 * plus a DPR resolver — rather than pulling in an application's full
 * renderer-settings stack (tone mapping, shadows, board pixel ratio,
 * persisted storage, live-renderer fan-out), none of which
 * `texture-sizing.ts` needs.
 *
 * A host that already owns a richer graphics-settings system injects
 * its own policy via {@link configureR3GraphicsPolicy}; by default r3
 * follows the display's DPR (clamped to [1, 2], matching the
 * historical behaviour of the game this framework was extracted
 * from).
 */

/** How aggressively UI textures follow the display's device pixel ratio. */
export type UiTexturePixelRatioMode = "logical" | "device";

/** The subset of graphics policy r3's texture sizing reads. */
export type GraphicsPolicy = {
  /**
   * `"logical"` pins UI textures to 1 px per logical unit regardless
   * of DPR — cheap on low-end GPUs but soft on high-density
   * displays. `"device"` follows the (clamped) DPR so UI textures
   * match the display's native pixel grid.
   */
  readonly uiTexturePixelRatio: UiTexturePixelRatioMode;
};

/** Values r3 ships with. Override via {@link configureR3GraphicsPolicy}. */
const DEFAULT_GRAPHICS_POLICY: GraphicsPolicy = {
  uiTexturePixelRatio: "device",
};

/**
 * Mutable policy state. Held inside an object (rather than a
 * top-level `let`) so {@link configureR3GraphicsPolicy} can patch it
 * in place — matches the module-singleton pattern used by
 * {@link "../TextureCache.ts"}.
 */
const state: { policy: GraphicsPolicy } = {
  policy: { ...DEFAULT_GRAPHICS_POLICY },
};

/**
 * Returns a defensive copy of the current graphics policy. Callers
 * must not mutate the returned object — use
 * {@link configureR3GraphicsPolicy} to change values.
 */
export function getGraphicsPolicy(): GraphicsPolicy {
  return { ...state.policy };
}

/**
 * Overrides the graphics policy in place. Call once at application
 * startup, before constructing widgets that bake canvas textures, so
 * every subsequent texture bake observes the new policy.
 */
export function configureR3GraphicsPolicy(partial: Partial<GraphicsPolicy>): void {
  Object.assign(state.policy, partial);
}

/**
 * Clamps a device pixel ratio to the range r3's canvas-backed
 * textures are sized for. Values below 1 would blur UI content on
 * legacy hardware; values above 2 waste fragment work for no
 * perceptible gain at the texture sizes r3 bakes.
 */
export function clampDevicePixelRatio(dpr: number): number {
  if (!Number.isFinite(dpr)) {
    return 1;
  }
  if (dpr < 1) {
    return 1;
  }
  if (dpr > 2) {
    return 2;
  }
  return dpr;
}

/**
 * Resolves the current UI-texture pixel ratio: reads
 * `window.devicePixelRatio` (or `1` when no `window` is present —
 * server-side / headless test contexts) and applies the configured
 * {@link UiTexturePixelRatioMode}.
 */
export function resolveUiTexturePixelRatio(): number {
  const mode = state.policy.uiTexturePixelRatio;
  if (mode === "logical") {
    return 1;
  }
  const dpr = typeof window === "undefined" ? 1 : (window.devicePixelRatio ?? 1);
  return clampDevicePixelRatio(dpr);
}
