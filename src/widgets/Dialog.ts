/**
 * @file Dialog — shared modal shell for the r3 layer.
 *
 * 1:1 port of `src/scenes/overlays/Dialog.ts` keeping the UX
 * contract identical: identical backdrop fade, identical centred
 * card pop, content fades in slightly after the card pops, an
 * idempotent close path that runs the close tween then fires
 * `onClose` once. Caller-owned `handle.destroy()` tears the dialog
 * down without an animation (used by scene shutdown / cinematic
 * disposers); `ctx.close()` runs the animated close + onClose path.
 *
 * The two paths are guarded against double-invocation so a manual
 * destroy after a user-driven close is safe.
 *
 * Visual brief, kept verbatim from the Phaser version so a future
 * audit reads here:
 *
 *   - Card fill: cream `#f5e6c6`; outer border: warm bronze
 *     `#7a5a32`; inner accent: `#b88a2c` at α=0.7.
 *   - Backdrop: ink `#080603` at α=0.55 over the full viewport.
 *   - Card pop: `Back.easeOut` over `cardOpenMs` from scale 0.9 → 1.
 *   - Backdrop fade: `Quad.easeOut` over `backdropFadeMs`.
 *   - Content fade: starts `contentDelayMs` after the card pop,
 *     `Quad.easeOut` over `contentFadeMs`.
 *   - Close: backdrop / card / content fade out together with
 *     `Quad.easeIn` over `closeFadeMs`; teardown happens
 *     `closeHoldMs` later so the user reads the wipe.
 */

import { Container } from "../Container.ts";
import { Graphics } from "../Graphics.ts";
import { Rect } from "../Rect.ts";
import type { Stage } from "../Stage.ts";
import type { TextureManager } from "../texture-canvas";
import { COLOR_HEX } from "../theme";

const DEFAULT_DEPTH = 960;
const DEFAULT_BACKDROP_COLOR = COLOR_HEX.INK_ABYSS;
const DEFAULT_BACKDROP_ALPHA = 0.55;
const DEFAULT_CARD_FILL = COLOR_HEX.CREAM_CARD;
const DEFAULT_CARD_BORDER = COLOR_HEX.BROWN_BORDER;
const DEFAULT_CARD_ACCENT = COLOR_HEX.GOLD;
const DEFAULT_CARD_RADIUS = 22;

const DEFAULT_BACKDROP_FADE_MS = 240;
const DEFAULT_CARD_OPEN_MS = 260;
const DEFAULT_CONTENT_DELAY_MS = 180;
const DEFAULT_CONTENT_FADE_MS = 220;
const DEFAULT_CLOSE_FADE_MS = 180;
const DEFAULT_CLOSE_HOLD_MS = 220;

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

function resolveVisual(partial: Partial<R3DialogVisual> | undefined): R3DialogVisual {
  return {
    fillColor: partial?.fillColor ?? DEFAULT_CARD_FILL,
    borderColor: partial?.borderColor ?? DEFAULT_CARD_BORDER,
    accentColor: partial?.accentColor ?? DEFAULT_CARD_ACCENT,
    backdropColor: partial?.backdropColor ?? DEFAULT_BACKDROP_COLOR,
    backdropAlpha: partial?.backdropAlpha ?? DEFAULT_BACKDROP_ALPHA,
    radius: partial?.radius ?? DEFAULT_CARD_RADIUS,
  };
}

function resolveTiming(partial: Partial<R3DialogTiming> | undefined): R3DialogTiming {
  return {
    backdropFadeMs: partial?.backdropFadeMs ?? DEFAULT_BACKDROP_FADE_MS,
    cardOpenMs: partial?.cardOpenMs ?? DEFAULT_CARD_OPEN_MS,
    contentDelayMs: partial?.contentDelayMs ?? DEFAULT_CONTENT_DELAY_MS,
    contentFadeMs: partial?.contentFadeMs ?? DEFAULT_CONTENT_FADE_MS,
    closeFadeMs: partial?.closeFadeMs ?? DEFAULT_CLOSE_FADE_MS,
    closeHoldMs: partial?.closeHoldMs ?? DEFAULT_CLOSE_HOLD_MS,
  };
}

function colorHexString(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

/**
 * Padding (per side) added to the Graphics canvas so the outer stroke
 * doesn't clip at the canvas edge. Exported so tests and downstream
 * tooling can assert the invariant without duplicating the constant.
 */
export const R3_DIALOG_CARD_PAD = 8;

/**
 * Minimum drawing surface {@link drawCardLocal} needs — the caller
 * must construct its Graphics with these dimensions. Centralised so
 * the "what size does my card Graphics need" answer lives next to
 * the draw function that decides the layout.
 */
export function cardGraphicsSize(width: number, height: number): {
  readonly width: number;
  readonly height: number;
} {
  return { width: width + R3_DIALOG_CARD_PAD * 2, height: height + R3_DIALOG_CARD_PAD * 2 };
}

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
export function drawCardLocal(
  graphics: R3CardDrawTarget,
  width: number,
  height: number,
  visual: R3DialogVisual,
): void {
  const pad = R3_DIALOG_CARD_PAD;
  graphics.clear();
  graphics.fillStyle(visual.fillColor, 1);
  graphics.fillRoundedRect(pad, pad, width, height, visual.radius);
  graphics.lineStyle(3, visual.borderColor, 1);
  graphics.strokeRoundedRect(pad, pad, width, height, visual.radius);
  graphics.lineStyle(1, visual.accentColor, 0.7);
  const innerRadius = Math.max(0, visual.radius - 4);
  graphics.strokeRoundedRect(pad + 6, pad + 6, width - 12, height - 12, innerRadius);
}

/**
 * Maximum fraction of the viewbox a dialog is allowed to occupy
 * before it gets uniformly scaled down. 0.94 leaves a small margin
 * so the modal doesn't kiss the safe-area edge.
 */
const DIALOG_VIEWBOX_BUDGET = 0.94;

/**
 * Computes the uniform scale factor that keeps a `(authoredW, authoredH)`
 * card inside the screen's viewbox with the configured budget.
 * Returns 1 when the authored size already fits — PC stays
 * pixel-equivalent to the historical behaviour.
 */
function fitDialogScale(
  authoredW: number,
  authoredH: number,
  viewboxW: number,
  viewboxH: number,
): number {
  const maxW = viewboxW * DIALOG_VIEWBOX_BUDGET;
  const maxH = viewboxH * DIALOG_VIEWBOX_BUDGET;
  if (authoredW <= maxW && authoredH <= maxH) {
    return 1;
  }
  return Math.min(maxW / authoredW, maxH / authoredH);
}

/** Opens an r3 dialog. Mirrors `openDialog(scene, options)` semantics. */
export function openR3Dialog(options: R3DialogOptions): R3DialogHandle {
  const { stage, size, build, onClose } = options;
  const visual = resolveVisual(options.visual);
  const timing = resolveTiming(options.timing);
  const depth = options.depth ?? DEFAULT_DEPTH;
  // Backdrop / centring extent is the stage's screen — no override
  // option, so a missing injection can't be silently filled in.
  const { width: viewportWidth, height: viewportHeight, viewbox } = stage.screen;

  // Centre the dialog inside the *viewbox* (not the full screen) so
  // notch / home-indicator areas stay clear. Falls back to screen
  // centre when the viewbox spans the whole screen (PC).
  const centerX = viewbox.x + viewbox.width / 2;
  const centerY = viewbox.y + viewbox.height / 2;
  // Authored card top-left (used by build() for content positioning).
  const cardX = centerX - size.width / 2;
  const cardY = centerY - size.height / 2;
  // Uniform scale so the card always fits inside the viewbox — PC
  // stays at scale 1 (authored sizes already fit 1280×720); mobile
  // shrinks proportionally so a 720×540 settings panel fits a
  // 390-wide phone without overflowing.
  const scale = fitDialogScale(size.width, size.height, viewbox.width, viewbox.height);

  const root = new Container({ name: "r3:dialog" });
  root.setDepth(depth);

  // Backdrop swallows pointer events so nothing behind the dialog
  // can be interacted with — even when the caller opts out of
  // backdrop-dismiss.
  const backdrop = new Rect({
    x: 0,
    y: 0,
    width: viewportWidth,
    height: viewportHeight,
    fill: colorHexString(visual.backdropColor),
    fillAlpha: visual.backdropAlpha,
    interactive: true,
    alpha: 0,
    textureManager: options.textureManager,
  });
  root.add(backdrop);

  // Card-wrap at viewbox centre with origin centre so the open pop
  // scales around the visual centre. Final scale is `scale`; the
  // open animation tweens from `0.9 * scale` to `scale` so the
  // historical pop-in shape is preserved while the dialog as a
  // whole shrinks to fit the viewbox.
  const cardWrap = new Container({
    x: centerX,
    y: centerY,
    alpha: 0,
    scaleX: 0.9 * scale,
    scaleY: 0.9 * scale,
  });
  // Graphics surface wide enough to comfortably hold the card plus
  // an outer stroke. Dimensions are derived from `cardGraphicsSize`
  // so the padding constant stays in lockstep with `drawCardLocal`'s
  // offsets — a regression where one side changes without the other
  // would either clip the stroke or push draws outside the canvas.
  const graphicsSize = cardGraphicsSize(size.width, size.height);
  const card = new Graphics({
    width: graphicsSize.width,
    height: graphicsSize.height,
    originX: 0.5,
    originY: 0.5,
    textureManager: options.textureManager,
  });
  drawCardLocal(card, size.width, size.height, visual);
  cardWrap.add(card);
  root.add(cardWrap);

  // Content container: build() callbacks place widgets at *world*
  // coordinates (using the cardX/cardY/centerX/centerY values they
  // receive). To make the whole dialog scale uniformly, those
  // widgets live inside a wrapper that translates by -(centerX, centerY)
  // *after* the wrapper is placed at (centerX, centerY) and scaled.
  // The net effect: a widget at world (centerX, centerY) lands on the
  // visual centre regardless of `scale`; everything around it shrinks
  // toward the centre with the card.
  const contentWrap = new Container({
    x: centerX,
    y: centerY,
    scaleX: scale,
    scaleY: scale,
  });
  const content = new Container({ x: -centerX, y: -centerY, alpha: 0 });
  contentWrap.add(content);
  root.add(contentWrap);

  stage.root.add(root);

  // Open animations.
  stage.tweens.add({
    targets: backdrop,
    alpha: 1,
    duration: timing.backdropFadeMs,
    ease: "Quad.easeOut",
  });
  stage.tweens.add({
    targets: cardWrap,
    alpha: 1,
    scaleX: scale,
    scaleY: scale,
    duration: timing.cardOpenMs,
    ease: "Back.easeOut",
  });
  stage.tweens.add({
    targets: content,
    alpha: 1,
    delay: timing.contentDelayMs,
    duration: timing.contentFadeMs,
    ease: "Quad.easeOut",
  });

  // Close-path bookkeeping. `closed` guards the user-driven close;
  // `torn` guards the destroy path so the two cooperate without a
  // double-teardown if the scene shuts down mid-close. `pendingTimeouts`
  // holds every dialog-owned timeout (the internal close-animation
  // teardown plus any `scheduleTimeout` callbacks the build function
  // registers) so a scene-driven destroy cancels all of them before
  // they fire against a torn-down root.
  const state: { closed: boolean; torn: boolean; pendingTimeouts: number[] } = {
    closed: false,
    torn: false,
    pendingTimeouts: [],
  };

  function scheduleTimeout(handler: () => void, delayMs: number): void {
    if (state.torn) {
      return;
    }
    const handle = window.setTimeout(() => {
      const idx = state.pendingTimeouts.indexOf(handle);
      if (idx >= 0) {
        state.pendingTimeouts.splice(idx, 1);
      }
      handler();
    }, delayMs);
    state.pendingTimeouts.push(handle);
  }

  // Filled in below once the screen subscription exists. Hoisted into
  // closure so both `teardown` and the screen-change handler can see
  // the same reference; teardown calls it to release the subscription
  // regardless of which close path (animated `close()` or forced
  // `destroy()`) ran the teardown.
  const screenSubscription: { off: (() => void) | null } = { off: null };

  function teardown(): void {
    if (state.torn) {
      return;
    }
    state.torn = true;
    if (screenSubscription.off) {
      screenSubscription.off();
      screenSubscription.off = null;
    }
    for (const handle of state.pendingTimeouts) {
      window.clearTimeout(handle);
    }
    state.pendingTimeouts = [];
    stage.tweens.killTweensOf(backdrop);
    stage.tweens.killTweensOf(cardWrap);
    stage.tweens.killTweensOf(contentWrap);
    stage.tweens.killTweensOf(content);
    root.destroy();
  }

  function close(): void {
    if (state.closed) {
      return;
    }
    state.closed = true;
    backdrop.setInteractive(null);
    stage.tweens.add({
      targets: [backdrop, cardWrap, content],
      alpha: 0,
      duration: timing.closeFadeMs,
      ease: "Quad.easeIn",
    });
    scheduleTimeout(() => {
      teardown();
      onClose?.();
    }, timing.closeHoldMs);
  }

  if (options.dismissOnBackdrop === true) {
    backdrop.on("pointerdown", () => {
      close();
    });
  }

  build({
    stage,
    textureManager: options.textureManager,
    content,
    cardX,
    cardY,
    width: size.width,
    height: size.height,
    centerX,
    centerY,
    close,
    scheduleTimeout,
  });

  // Re-center + re-scale on screen change so a rotation while a
  // dialog is open keeps it inside the new viewbox. Strategy:
  //
  //  - Backdrop: resize to the new screen (it's an absolute-positioned
  //    fullscreen rect).
  //  - cardWrap & contentWrap: reposition to the new viewbox centre
  //    and re-scale to the new fit.
  //  - content.x/y: NEVER touch after build. The build callback placed
  //    children at *world* coordinates relative to the original
  //    centerX/centerY; freezing content's local offset means each
  //    child's authored offset from the original centre is preserved
  //    across rebuilds (just translated + scaled by the wrappers).
  //    This is the same trick that makes the open-pop tween scale
  //    around the visual centre.
  //
  // The current open animation is allowed to continue — we re-issue
  // tweens against the wrappers' final scale so the in-flight Back.easeOut
  // doesn't snap back to the old number when it lands.
  function applyScreen(): void {
    if (state.torn || state.closed) {
      return;
    }
    const next = stage.screen;
    const nextCenterX = next.viewbox.x + next.viewbox.width / 2;
    const nextCenterY = next.viewbox.y + next.viewbox.height / 2;
    const nextScale = fitDialogScale(
      size.width,
      size.height,
      next.viewbox.width,
      next.viewbox.height,
    );
    backdrop.setSize(next.width, next.height);
    cardWrap.setPosition(nextCenterX, nextCenterY);
    cardWrap.setScale(nextScale, nextScale);
    contentWrap.setPosition(nextCenterX, nextCenterY);
    contentWrap.setScale(nextScale, nextScale);
  }
  screenSubscription.off = stage.onScreenChange(() => {
    applyScreen();
  });

  return {
    node: root,
    destroy: teardown,
  };
}
