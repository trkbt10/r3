/**
 * @file OrnateButton — chrome-framed CTA built on the panel-effects
 * decoration system.
 *
 * Same input contract as {@link createR3Button} (centre-anchored
 * authoring, hover / press / disabled visual states, optional press-
 * pulse tween, click SFX, layout-engine `setRect`), but the visible
 * surface is a {@link createR3Plaque} with an {@link UiPanelEffect}
 * stack rather than a flat {@link Rect}. Pass `effects: [...]` to
 * decorate the chrome (drop shadows, glows, ornaments, electric arcs,
 * …); the framework lives in `src/r3/widgets/panel-effects/`.
 *
 * Flat Button vs OrnateButton — guidance:
 *
 *   - Use {@link createR3Button} for utility CTAs that want a clean
 *     fill + border (footer rows, dense modals where a plaque feels
 *     heavy).
 *   - Use this widget for hero CTAs and ceremonial moments — title
 *     start / settings, ending "return to title", result-modal
 *     acknowledgement — where the button is a focal element and the
 *     gold-framed plaque language reads as visual gravity.
 *
 * ## Hover / press / disabled
 *
 *   - **Hover**: a translucent gold tint Rect fades in over the
 *     chrome. The plaque's wood-grain stays visible underneath; the
 *     overlay lifts the surface read without the brittleness of
 *     repainting the chrome canvas every hover frame.
 *   - **Press**: scale-down → snap-back tween on a centre pivot, the
 *     same pattern flat Button uses, so the two widgets feel
 *     identical to the touch. Activation waits for release on the
 *     same target so a tap feels like a completed press.
 *   - **Disabled**: container alpha drops to a muted value and the
 *     interactive area is removed; a future re-enable restores the
 *     hit area without rebuilding the chrome / effects (the cached
 *     plaque keeps its baked Graphics surface).
 *
 * ## Centre-pivot composition
 *
 * The widget mirrors the {@link MenuButton} layout: a `pivot`
 * Container sits at the chrome's centre and every visual child hangs
 * off it with `-w/2 / -h/2` offsets. Scaling the pivot is therefore a
 * symmetric grow/shrink around the visual centre — required so the
 * press-pulse doesn't drift the chrome toward (0, 0).
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
import { createR3Plaque, type R3PlaqueHandle } from "./Plaque.ts";
import {
  cornerOrnaments,
  dropShadow,
  innerHighlight,
  type UiPanelEffect,
} from "./panel-effects";

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
  readonly getRect: () => { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** Live width / height after the most recent {@link setRect}. */
  readonly getSize: () => { readonly width: number; readonly height: number };
  /** Forwards to the plaque's tick — drives any animated effects. */
  readonly tick: (dtSeconds: number) => void;
  readonly destroy: () => void;
};

/** Default tint for the cursor-acknowledge overlay. */
const DEFAULT_HOVER_COLOR = COLOR.GOLD;
const DEFAULT_HOVER_ALPHA = 0.18;
const HOVER_FADE_MS = 140;
const DISABLED_ALPHA = 0.45;
const PRESS_SCALE = 0.97;
const PRESS_MS = 90;

const FONT_FAMILY = FONT.MINCHO;
const HOVER_SFX_ID = "title-button-hover";

type Palette = {
  readonly text: string;
};

function paletteFor(variant: R3OrnateButtonVariant): Palette {
  // Primary lifts the label to the brighter cream so a hero CTA reads
  // as "act on me first"; secondary uses the muted card cream so two
  // ornate buttons stacked together don't flatten into a single
  // visual mass.
  if (variant === "primary") {
    return { text: COLOR.CREAM_HERO };
  }
  return { text: COLOR.CREAM_TEXT };
}

function resolveClickSfx(spec: R3OrnateButtonClickSfx | undefined): string | null {
  if (spec === undefined) {
    return "title-button-click";
  }
  return spec;
}

function labelFontSize(height: number): number {
  // Matches flat Button's derivation so the two widgets have the same
  // text rhythm at equivalent heights.
  return Math.max(16, Math.floor(height * 0.38));
}

/**
 * Default decoration stack — drop shadow under the chrome, inner
 * highlight inside the chrome, corner ornaments on top. Heavy enough
 * to read as "ceremonial" without crossing into busy territory; the
 * panel-effects gallery's `ornate` preset is the same recipe.
 *
 * When `scale` is true, the corner-ornament L-shapes scale with the
 * live panel min-dim against `referenceSize` (see
 * {@link CornerOrnamentsOptions.scale}). The other effects are size-
 * agnostic by design: dropShadow projects from the chrome silhouette
 * regardless of size, and innerHighlight's `coverage` is already a
 * ratio so it never visibly crushes at compact heights.
 */
function defaultEffects(scale: boolean, referenceSize: number): readonly UiPanelEffect[] {
  if (!scale) {
    return [dropShadow(), innerHighlight(), cornerOrnaments()];
  }
  return [dropShadow(), innerHighlight(), cornerOrnaments({ scale: true, referenceSize })];
}

/**
 * Builds an ornate plaque-chrome button. Returns a handle that the
 * caller attaches to a scene root via `scene.root.add(handle.node)`.
 */
export function createR3OrnateButton(options: R3OrnateButtonOptions): R3OrnateButtonHandle {
  const variant = options.variant ?? "primary";
  const variantPalette = paletteFor(variant);
  const accent = options.accent ?? {};
  const labelColor = accent.text ?? variantPalette.text;
  const hoverColor = accent.hover ?? DEFAULT_HOVER_COLOR;
  const hoverAlpha = accent.hoverAlpha ?? DEFAULT_HOVER_ALPHA;
  const radius = options.radius ?? 14;
  const effects = options.effects ?? defaultEffects(
    options.scaleDecorations === true,
    options.decorationReferenceSize ?? 48,
  );

  // Live geometry. setRect updates both fields and republishes them
  // through the chrome / hover overlay / hit area. Stored as a single
  // record so the layout closures don't drift between width and height.
  const geom = { width: options.width, height: options.height };

  // Outer container is positioned at the visual centre — same shape
  // as flat Button's authoring API. layout-engine setRect remaps to
  // (top-left + width/2, top-left + height/2).
  const surface = createR3CenteredMotionSurface({
    x: options.x,
    y: options.y,
    width: geom.width,
    height: geom.height,
    name: options.name ?? "r3:ornate-button",
    pivotName: "r3:ornate-button:pivot",
  });
  const { root, pivot } = surface;

  // Chrome — the wood-grain plaque + caller-supplied effect stack.
  // Attached to the pivot so the press-pulse scales chrome + every
  // effect together (effects parented under the plaque's back/front
  // layers, which themselves live under pivot).
  const plaque: R3PlaqueHandle = createR3Plaque({
    host: pivot,
    x: -geom.width / 2,
    y: -geom.height / 2,
    width: geom.width,
    height: geom.height,
    radius,
    shadow: false,
    effects,
    textureManager: options.textureManager,
  });

  // Hover overlay — a centre-anchored Rect at pivot-local (0, 0)
  // that sits over the chrome. Alpha tweens 0 → HOVER_OVERLAY_ALPHA
  // on pointerover; back to 0 on pointerout. We start the alpha at 0
  // so the overlay is invisible by default.
  const hoverOverlay = new Rect({
    x: 0,
    y: 0,
    width: geom.width,
    height: geom.height,
    fill: hoverColor,
    fillAlpha: 1,
    originX: 0.5,
    originY: 0.5,
    alpha: 0,
    textureManager: options.textureManager,
  });
  pivot.add(hoverOverlay);

  // Label — same centre-anchored Text the flat button uses, sized
  // off the current height so a future setRect resize can rebuild
  // the font without a node swap.
  const label = new Text({
    x: 0,
    y: 0,
    text: options.label,
    font: { family: FONT_FAMILY, size: labelFontSize(geom.height), weight: "bold" },
    color: labelColor,
    originX: 0.5,
    originY: 0.5,
    textureManager: options.textureManager,
  });
  pivot.add(label);

  const state = { disabled: options.disabled === true };

  function hitRect(): { x: number; y: number; width: number; height: number } {
    // The interactive surface is on `root` (top-left coordinate space)
    // because that's where every other r3 widget puts it; the visuals
    // live on pivot but the pointer system reads root-local coords for
    // hit-testing.
    return { x: -geom.width / 2, y: -geom.height / 2, width: geom.width, height: geom.height };
  }

  function applyState(): void {
    if (state.disabled) {
      root.setAlpha(DISABLED_ALPHA);
      root.setInteractive(null);
      // Cancel any in-flight hover tween so the overlay doesn't
      // stay half-faded under the dim layer.
      options.tweens?.killTweensOf(hoverOverlay);
      hoverOverlay.alpha = 0;
      return;
    }
    root.setAlpha(1);
    root.setInteractive(hitRect());
  }

  applyState();

  function fadeHover(targetAlpha: number): void {
    if (!options.tweens) {
      hoverOverlay.alpha = targetAlpha;
      return;
    }
    options.tweens.killTweensOf(hoverOverlay);
    options.tweens.add({
      targets: hoverOverlay,
      alpha: targetAlpha,
      duration: HOVER_FADE_MS,
      ease: "Quad.easeOut",
    });
  }

  root.on("pointerover", () => {
    if (state.disabled) {
      return;
    }
    fadeHover(hoverAlpha);
    playR3Sfx(HOVER_SFX_ID);
  });

  root.on("pointerout", () => {
    if (state.disabled) {
      return;
    }
    fadeHover(0);
  });

  root.on("pointerdown", () => {
    if (state.disabled) {
      return;
    }
    pressPulse(pivot, options.tweens);
  });

  root.on("click", () => {
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
    setRect(nx, ny, nw, nh): void {
      geom.width = nw;
      geom.height = nh;
      // Layout-engine rect is top-left; the widget centres around its
      // (x, y) so we shift root by half-extents.
      surface.setRect(nx, ny, nw, nh);
      // Repaint chrome + republish to every effect.
      plaque.setRect(-nw / 2, -nh / 2, nw, nh);
      hoverOverlay.setSize(nw, nh);
      label.setStyle({
        family: FONT_FAMILY,
        size: labelFontSize(nh),
        weight: "bold",
      });
      if (!state.disabled) {
        root.setInteractive(hitRect());
      }
    },
    getRect() {
      return surface.getRect();
    },
    getSize() {
      return { width: geom.width, height: geom.height };
    },
    tick(dtSeconds: number): void {
      plaque.tick(dtSeconds);
    },
    destroy() {
      options.tweens?.killTweensOf(root);
      options.tweens?.killTweensOf(pivot);
      options.tweens?.killTweensOf(hoverOverlay);
      // Plaque destroy disposes its chrome canvas + every effect's
      // GPU resources. Root.destroy then cascades through the pivot
      // and removes the interactive listener.
      plaque.destroy();
      root.destroy();
    },
  };
}

/**
 * Press-pulse animation. With a tween manager we get the smooth
 * Phaser-style scale dip; without one we apply an immediate flick
 * so the visual still acknowledges the press.
 *
 * Animates `pivot` (not the root) so the hit area on root stays at
 * its authored size — scaling the root would shrink the hit area
 * mid-press, which on a touch device can drop the click if the
 * finger drifts a few px.
 */
function pressPulse(pivot: R3MotionRoot, tweens: TweenManager | undefined): void {
  playR3MotionPressPulse(pivot, tweens, {
    scale: PRESS_SCALE,
    durationMs: PRESS_MS,
  });
}
