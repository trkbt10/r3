/**
 * @file Button — shared full-rectangle button primitive for r3.
 *
 * 1:1 port of `src/scenes/ui/Button.ts` keeping the design language
 * identical (warm-bronze accents, dark fill, cream text, hover lift,
 * press pulse). The only API difference vs Phaser is that the caller
 * owns the parent container — `createR3Button` returns a Container
 * Node that the caller attaches to its scene root via `scene.root.add`
 * (or directly to the Stage).
 *
 * Visual brief, copied verbatim so future visual review can audit
 * here:
 *
 *  - Dark fill (`#2a1f14`), warm accent border (`#b88a2c`), cream label.
 *  - Hover lightens the fill; press nudges scale, release activates.
 *  - Primary (accent-filled) and secondary (dark-filled) variants share
 *    dimensions so swapping between them doesn't reflow the page.
 *  - Disabled state mutes the fill and disables the pointer handlers;
 *    the same button can be re-enabled later without re-creating it.
 *
 * ## Sizing
 *
 * The `width` / `height` arguments set the outer rectangle. The label
 * auto-centres inside. No padding arithmetic is exposed to callers —
 * the button encapsulates its layout so consumers only pass the two
 * dimensions they care about.
 */

import {
  createR3CenteredMotionSurface,
  playR3MotionPressPulse,
  type R3LayoutRoot,
  type R3MotionRoot,
} from "../LayoutMotion.ts";
import { Rect } from "../Rect.ts";
import { Text } from "../Text.ts";
import type { TweenManager } from "../Tween.ts";
import type { TextureManager } from "../texture-canvas";
import { playR3Sfx } from "../audio.ts";
import { COLOR, FONT } from "../theme";

const PRIMARY_FILL = COLOR.GOLD;
const PRIMARY_FILL_HOVER = COLOR.GOLD_HOVER;
const PRIMARY_TEXT = COLOR.INK_TEXT;

const SECONDARY_FILL = COLOR.INK_BUTTON;
const SECONDARY_FILL_HOVER = COLOR.INK_BUTTON_HOVER;
const SECONDARY_TEXT = COLOR.CREAM_TEXT;

const BORDER_COLOR = COLOR.GOLD;
const DISABLED_FILL = COLOR.INK_DISABLED_FILL;
const DISABLED_TEXT = COLOR.BROWN_DISABLED;

const PRESS_SCALE = 0.97;
const PRESS_MS = 80;

const FONT_FAMILY = FONT.MINCHO;
const HOVER_SFX_ID = "title-button-hover";

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
  readonly getRect: () => { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly destroy: () => void;
};

type Palette = {
  readonly fill: string;
  readonly hover: string;
  readonly text: string;
};

function paletteFor(variant: R3ButtonVariant): Palette {
  if (variant === "primary") {
    return { fill: PRIMARY_FILL, hover: PRIMARY_FILL_HOVER, text: PRIMARY_TEXT };
  }
  return { fill: SECONDARY_FILL, hover: SECONDARY_FILL_HOVER, text: SECONDARY_TEXT };
}

/** Returns the click SFX id with the default applied. */
function resolveClickSfx(spec: R3ButtonClickSfx | undefined): string | null {
  if (spec === undefined) {
    return "title-button-click";
  }
  return spec;
}

/** Derives the label font size from the button height (matches Phaser version). */
function labelFontSize(height: number): number {
  return Math.max(16, Math.floor(height * 0.38));
}

/**
 * Builds an r3 button. Returns a handle whose `node` is a Container
 * the caller adds to its scene/stage. Destroying the handle disposes
 * the underlying r3 nodes (which release their textures).
 */
export function createR3Button(options: R3ButtonOptions): R3ButtonHandle {
  const variant = options.variant ?? "secondary";
  const palette = paletteFor(variant);

  // Live geometry. The container sits at the rect centre and the bg is
  // anchored at (0.5, 0.5) inside it so the press-pulse scale tween
  // grows/shrinks the plaque symmetrically. `setRect` mutates these
  // values rather than rebuilding the widget so layout retargeting
  // doesn't drop the bound onClick handler or destroy the cached label
  // raster.
  const geom = {
    width: options.width,
    height: options.height,
  };

  const surface = createR3CenteredMotionSurface({
    x: options.x,
    y: options.y,
    width: geom.width,
    height: geom.height,
    name: "r3:button",
    pivotName: "r3:button-pivot",
  });
  const { root, pivot } = surface;

  const bg = new Rect({
    width: geom.width,
    height: geom.height,
    fill: palette.fill,
    fillAlpha: 1,
    strokeColor: BORDER_COLOR,
    strokeWidth: 2,
    strokeAlpha: 1,
    originX: 0.5,
    originY: 0.5,
    interactive: true,
    textureManager: options.textureManager,
  });
  // Centre-anchored: bg fills the button's outer rectangle, with the
  // pivot at (0.5, 0.5) so the press-pulse scale animates around the
  // visual centre rather than the top-left.
  pivot.add(bg);

  const label = new Text({
    text: options.label,
    font: {
      family: FONT_FAMILY,
      size: labelFontSize(geom.height),
      weight: "bold",
    },
    color: palette.text,
    originX: 0.5,
    originY: 0.5,
    textureManager: options.textureManager,
  });
  pivot.add(label);

  const state = { disabled: options.disabled === true };

  function hitRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: -geom.width / 2,
      y: -geom.height / 2,
      width: geom.width,
      height: geom.height,
    };
  }

  function applyState(): void {
    if (state.disabled) {
      bg.setFill(DISABLED_FILL, 1);
      label.setColor(DISABLED_TEXT);
      bg.setInteractive(null);
      return;
    }
    bg.setFill(palette.fill, 1);
    label.setColor(palette.text);
    bg.setInteractive(hitRect());
  }

  applyState();

  bg.on("pointerover", () => {
    if (state.disabled) {
      return;
    }
    bg.setFill(palette.hover, 1);
    playR3Sfx(HOVER_SFX_ID);
  });

  bg.on("pointerout", () => {
    if (state.disabled) {
      return;
    }
    bg.setFill(palette.fill, 1);
  });

  bg.on("pointerdown", () => {
    if (state.disabled) {
      return;
    }
    pressPulse(pivot, options.tweens);
  });

  bg.on("click", () => {
    if (state.disabled) {
      return;
    }
    const sfx = resolveClickSfx(options.clickSfx);
    if (sfx !== null) {
      playR3Sfx(sfx);
    }
    options.onClick();
  });

  return {
    node: root,
    setDisabled(disabled: boolean): void {
      state.disabled = disabled;
      applyState();
    },
    setLabel(next: string): void {
      label.setText(next);
    },
    setRect(nx: number, ny: number, nw: number, nh: number): void {
      geom.width = nw;
      geom.height = nh;
      surface.setRect(nx, ny, nw, nh);
      bg.setSize(nw, nh);
      label.setStyle({
        family: FONT_FAMILY,
        size: labelFontSize(nh),
        weight: "bold",
      });
      // Re-publish the hit rect so a resize doesn't leave a stale
      // bounding box (the rect lives in node-local pixels, so the size
      // change has to be pushed through explicitly).
      if (!state.disabled) {
        bg.setInteractive(hitRect());
      }
    },
    getRect() {
      return surface.getRect();
    },
    destroy(): void {
      options.tweens?.killTweensOf(pivot);
      root.destroy();
    },
  };
}

/**
 * Press-pulse animation: scale-down then back. With a tween manager
 * we get the smooth Phaser-style pulse; without one we apply an
 * immediate flick so the visual still acknowledges the press.
 */
function pressPulse(pivot: R3MotionRoot, tweens: TweenManager | undefined): void {
  playR3MotionPressPulse(pivot, tweens, {
    scale: PRESS_SCALE,
    durationMs: PRESS_MS,
  });
}
