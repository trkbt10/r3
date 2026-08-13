/**
 * @file Plaque — the gold-framed HUD surface, now assembled from a
 * pluggable list of {@link UiPanelEffect panel effects}.
 *
 * Earlier iterations hard-coded a single soft drop shadow directly
 * into the plaque body: the Graphics was built, positioned, and
 * repainted by Plaque itself. That meant the plaque had exactly one
 * decoration option (shadow), exactly one place for it (behind the
 * chrome), and no way to express anything richer without editing this
 * file.
 *
 * The plaque now owns only the chrome (via
 * {@link createR3ResizableHudPanel}) plus two layer containers that
 * sandwich it — a `back` layer that paints first, and a `front` layer
 * that paints last. The caller supplies an `effects: UiPanelEffect[]`
 * list; each effect attaches its display objects to whichever layer
 * it needs, and Plaque forwards every resize + destroy to every
 * effect's handle.
 *
 * The old `shadow: true | R3PlaqueShadow | false` option is preserved
 * as sugar: `shadow: true` prepends {@link dropShadow} with the tuned
 * defaults, `shadow: false | undefined` omits it, and an object pokes
 * specific fields. Existing HUD call sites stay unchanged.
 *
 * Two exports:
 *
 *   - {@link createR3Plaque} — static decoration. `setRect` moves +
 *     resizes chrome + every effect in lockstep.
 *   - {@link createR3PlaqueButton} — interactive wrapper. Adds a
 *     container for the caller's content plus a `pointerdown` →
 *     `onActivate` wiring. Use for title-scene buttons or anywhere
 *     the HUD plaque should also be clickable.
 */

import { Container } from "../Container.ts";
import type { Node } from "../Node.ts";
import type { TextureManager } from "../texture-canvas";
import {
  dropShadow,
  type DropShadowOptions,
  type UiPanelEffect,
  type UiPanelEffectContext,
  type UiPanelEffectHandle,
  type UiPanelEffectRect,
} from "./panel-effects";
import { createR3ResizableHudPanel, type R3ResizableHudPanelHandle } from "./Panel.ts";

/**
 * Structural shape of anything new r3 nodes can be parented under:
 * r3 Stage, Container, or any subclass thereof. Both expose an
 * `add(child: Node) => unknown` — the return shape differs between
 * Stage (`void`) and Container (`this`) so we take the weaker
 * "unknown" form and ignore the return.
 */
export type R3PlaqueHost = { add: (child: Node) => unknown };

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
 * Builds a layer container only when the plaque has at least one
 * effect to host. `hasEffects === false` skips allocation entirely so
 * the no-decoration common case leaves a single child (the chrome) on
 * the host.
 */
function makeLayerContainer(hasEffects: boolean, name: string): Container | null {
  if (!hasEffects) {
    return null;
  }
  return new Container({ x: 0, y: 0, name });
}

function resolveEffects(
  shadow: R3PlaqueOptions["shadow"],
  explicit: readonly UiPanelEffect[] | undefined,
): readonly UiPanelEffect[] {
  const list: UiPanelEffect[] = [];
  if (shadow === true) {
    list.push(dropShadow());
  } else if (shadow) {
    // `shadow` is now narrowed to R3PlaqueShadow (an object override).
    // `false` was falsy and bypassed the previous branch; `undefined`
    // likewise. Only partial-override objects land here.
    list.push(dropShadow(shadow));
  }
  if (explicit) {
    list.push(...explicit);
  }
  return list;
}

/**
 * Creates a HUD plaque with the production wood-grain + double-frame
 * chrome plus any number of decoration effects (back layer → chrome →
 * front layer, in paint order).
 */
export function createR3Plaque(options: R3PlaqueOptions): R3PlaqueHandle {
  const { host, width, height } = options;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const radius = options.radius ?? 12;
  const effects = resolveEffects(options.shadow, options.effects);

  // Two container slots bracket the chrome so effects can choose
  // their z-position declaratively. The plaque guarantees paint
  // order:
  //
  //   host → [ backLayer, panel, frontLayer ]
  //
  // When no effects are registered neither slot is created — the
  // no-decoration plaque leaves a single child on the host.
  // When effects ARE registered both slots are created eagerly,
  // because back must be added to `host` before the chrome. We can't
  // defer the back container until an effect actually picks it
  // without losing that ordering guarantee. The cost is one empty
  // Container per layer in the rare case where every effect lives on
  // the other side — trivial versus the alternative.
  const hasEffects = effects.length > 0;
  const backLayer = makeLayerContainer(hasEffects, "r3:plaque:back");
  if (backLayer) {
    host.add(backLayer);
  }

  const panel = createR3ResizableHudPanel({
    x,
    y,
    width,
    height,
    radius,
    flatTop: options.flatTop,
    textureManager: options.textureManager,
  });
  host.add(panel.node);

  const frontLayer = makeLayerContainer(hasEffects, "r3:plaque:front");
  if (frontLayer) {
    host.add(frontLayer);
  }

  const ctx: UiPanelEffectContext = {
    hosts: {
      back: backLayer ?? host,
      front: frontLayer ?? host,
    },
    radius,
    textureManager: options.textureManager,
  };
  const initialRect: UiPanelEffectRect = { x, y, width, height };
  // `mounted` is mutated during tick when a self-terminating effect
  // returns true — we iterate over a snapshot and rebuild the backing
  // array by filtering, so in-flight ticks see consistent state.
  const mounted: UiPanelEffectHandle[] = effects.map((effect) =>
    effect(ctx, initialRect),
  );

  return {
    panel,
    setRect(nx, ny, nw, nh) {
      panel.setRect(nx, ny, nw, nh);
      const rect: UiPanelEffectRect = { x: nx, y: ny, width: nw, height: nh };
      for (const handle of mounted) {
        handle.setRect(rect);
      }
    },
    tick(dtSeconds) {
      if (mounted.length === 0) {
        return;
      }
      // Two-pass: first collect which handles signalled done so we can
      // destroy + splice them atomically without mutating during the
      // iteration. `tick` calls can be expensive (GPU uploads on
      // repaint) so we pay the allocation of a small "finished" array
      // only when at least one effect exposes tick.
      const finished: UiPanelEffectHandle[] = [];
      for (const handle of mounted) {
        if (!handle.tick) {
          continue;
        }
        if (handle.tick(dtSeconds)) {
          finished.push(handle);
        }
      }
      if (finished.length === 0) {
        return;
      }
      for (const handle of finished) {
        handle.destroy();
        const idx = mounted.indexOf(handle);
        if (idx >= 0) {
          mounted.splice(idx, 1);
        }
      }
    },
    destroy() {
      for (const handle of mounted) {
        handle.destroy();
      }
      mounted.length = 0;
      panel.destroy();
      backLayer?.destroy();
      frontLayer?.destroy();
    },
  };
}

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
export function createR3PlaqueButton(options: R3PlaqueButtonOptions): R3PlaqueButtonHandle {
  const { host, width, height } = options;
  const node = new Container({ x: options.x ?? 0, y: options.y ?? 0, name: "r3:plaque-button" });
  host.add(node);

  const plaque = createR3Plaque({
    host: node,
    x: 0,
    y: 0,
    width,
    height,
    radius: options.radius,
    shadow: options.shadow ?? true,
    effects: options.effects,
    textureManager: options.textureManager,
  });

  const contentState: { node: Node | null } = { node: null };
  const handlerState: { handler: (() => void) | null } = {
    handler: options.onActivate ?? null,
  };

  function setContent(next: Node | null): void {
    if (contentState.node) {
      node.removeChild(contentState.node);
    }
    contentState.node = next;
    if (next) {
      node.add(next);
    }
  }
  setContent(options.content ?? null);

  node.setInteractive({ x: 0, y: 0, width, height });
  node.on("pointerdown", () => {
    handlerState.handler?.();
  });

  return {
    node,
    plaque,
    setContent,
    setOnActivate(h) {
      handlerState.handler = h;
    },
    destroy() {
      node.destroy();
    },
  };
}
