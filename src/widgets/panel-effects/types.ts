/**
 * @file Pluggable panel-effect types — the contract every effect in
 * this folder obeys, mirroring the {@link ../../../scenes/world/board3d/effects}
 * shape (factory → handle with `setRect` / optional `tick` / `destroy`)
 * but specialised for UI panel decoration instead of 3D scene particles.
 *
 * ## Where effects attach
 *
 * A panel effect paints around a rectangular UI silhouette. Because the
 * silhouette has an opaque chrome layer in the middle (the gold-framed
 * HUD plaque), the z-stack splits naturally into two slots:
 *
 *   - **back** — painted beneath the chrome. Drop shadow, rim glow,
 *     outer bloom go here. The back host is where the effect adds
 *     its display objects if it should render *behind* the plaque.
 *   - **front** — painted above the chrome. Inner highlights, sheens,
 *     sparkles, border overlays go here. Any effect that has to mask
 *     or decorate the face of the plaque attaches here.
 *
 * Effects choose their layer by picking which host they call `.add(...)`
 * on in their factory body. The owner (Plaque) guarantees the two hosts
 * sandwich the chrome in render order.
 *
 * ## Lifecycle
 *
 *  1. `effect(ctx, initialRect)` — factory builds its display objects
 *     and attaches them to the chosen host(s). Returns a handle.
 *  2. `handle.setRect(rect)` — owner forwards every rect change. The
 *     effect repositions / re-paints its surfaces.
 *  3. `handle.tick?(dtSeconds)` — optional. Called per frame when the
 *     owner has a frame loop available. Returning `true` signals the
 *     effect is finished and can be disposed.
 *  4. `handle.destroy()` — owner calls on teardown. Effect releases
 *     its display objects + any subscriptions.
 *
 * ## Why not a registry
 *
 * The board3d effects library is a flat collection of factory
 * functions, each imported directly where it's needed. No central
 * registry, no discriminated `kind: "dropShadow"` unions. We mirror
 * that here: consumers import `dropShadow`, `innerHighlight`, etc. and
 * assemble their own `effects: UiPanelEffect[]` list. Keeps the type
 * surface tiny and lets effects be tree-shaken.
 */

import type { Node } from "../../Node.ts";
import type { TextureManager } from "../../texture-canvas";

/**
 * Minimum-viable container shape an effect needs to attach child
 * nodes. Matches {@link R3PlaqueHost} structurally (`Stage.root`,
 * `Container`, or any object with an `add(child)` method).
 */
export type UiPanelEffectHost = { add: (child: Node) => unknown };

/**
 * The pair of layer hosts an effect may attach to. The owner
 * guarantees `back` is drawn beneath the panel chrome and `front` on
 * top; insertion order within each layer is the effect author's
 * responsibility (effects created earlier in the `effects` array
 * paint first within their layer).
 */
export type UiPanelEffectHosts = {
  /** Host for nodes that must paint behind the panel chrome. */
  readonly back: UiPanelEffectHost;
  /** Host for nodes that must paint in front of the panel chrome. */
  readonly front: UiPanelEffectHost;
};

/**
 * Static per-panel context shared with every effect for its whole
 * lifetime. Rect-dependent data (width, height, position) is NOT on
 * this context — it flows through `setRect` instead — so effects never
 * cache a stale rect from construction.
 */
export type UiPanelEffectContext = {
  readonly hosts: UiPanelEffectHosts;
  readonly textureManager: TextureManager;
  /**
   * Corner radius of the panel silhouette. Effects that want to hug
   * the outline (shadow, rim glow, inner highlight) read this so the
   * caller doesn't have to pass it on every setRect. The panel's
   * radius is static after construction — if future effects need a
   * dynamic radius, upgrade this to a rect field instead.
   */
  readonly radius: number;
};

/**
 * The rect the effect should decorate. Coordinates are relative to
 * the shared host origin (i.e. the same coordinate space the panel
 * chrome itself lives in — typically (0, 0, width, height) under a
 * HudPart root).
 */
export type UiPanelEffectRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Handle the owner holds onto. `setRect` is called on every resize;
 * `tick` is optional and only called when the owner drives a frame
 * loop (HudPart registers an `onFrame` hook when at least one effect
 * exposes tick); `destroy` is called exactly once on teardown.
 */
export type UiPanelEffectHandle = {
  readonly setRect: (rect: UiPanelEffectRect) => void;
  /**
   * Optional per-frame advance. Return `true` to signal the effect
   * has self-terminated (e.g. a one-shot pulse hit its fade-out
   * window); the owner will dispose it and drop it from its list.
   * Return `false` to keep running.
   */
  readonly tick?: (dtSeconds: number) => boolean;
  readonly destroy: () => void;
};

/**
 * Factory function. Takes a context and the initial rect, attaches
 * its display objects, returns a handle the owner manages.
 */
export type UiPanelEffect = (
  ctx: UiPanelEffectContext,
  initialRect: UiPanelEffectRect,
) => UiPanelEffectHandle;
