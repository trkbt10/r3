/**
 * @file Panel — shared rounded-rect panel chrome for r3 widgets.
 *
 * The app's visual language uses three panel silhouettes:
 *
 *   1. **Flat-top** panels that dock flush against the tab bar (prep
 *      pages — PadEditPage, BoardEditPage, ShopPage, SkillEditPage,
 *      InventoryPanel, ComingSoonPage). The top corners are squared
 *      by stamping a rect across the rounded-rect's top band; same
 *      trick TabBar uses for the folder-tab shape.
 *   2. **Fully rounded** cream panels for the prep-scene chrome.
 *   3. **Gold-framed dark** panels used across the in-battle HUD
 *      (the one shown in the game-scene reference image): a dark wood
 *      fill with a thin outer gold hairline and a slightly inset
 *      warmer inner border. {@link innerOutline} draws the second
 *      hairline; set to `false` to fall back to a single border.
 *
 * Every call site that used to hand-roll the Graphics calls flows
 * through `createR3Panel` — a single place to tune line weight,
 * stroke alpha, or corner radius policy.
 */

import { Container } from "../Container.ts";
import { Graphics } from "../Graphics.ts";
import type { TextureManager } from "../texture-canvas";
import { ensureImage, onAssetReady } from "../image-loading";

export type R3PanelOptions = {
  /** Top-left X in stage-logical pixels. */
  readonly x: number;
  /** Top-left Y in stage-logical pixels. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  /** Fill colour as a 0xRRGGBB integer. */
  readonly fill: number;
  /** Fill alpha. Defaults to 1. */
  readonly fillAlpha?: number;
  /** Border colour as a 0xRRGGBB integer. */
  readonly border: number;
  readonly textureManager: TextureManager;
  /** Border alpha. Defaults to 1. */
  readonly borderAlpha?: number;
  /** Border line width. Defaults to 1. */
  readonly borderWidth?: number;
  /**
   * Square the top corners by stamping a flat strip across the
   * rounded-rect's top band. Use for panels that dock flush against
   * a tab bar or other flat edge above them. Defaults to `false`
   * (fully rounded).
   */
  readonly flatTop?: boolean;
  /**
   * When set, draws a second inset stroke 4 px inside the outer border
   * using this colour. The gold-framed HUD panels use this to produce
   * the double-line frame that reads as a lacquered plaque.
   */
  readonly innerOutline?: {
    readonly color: number;
    readonly alpha?: number;
    readonly width?: number;
    /** Inset from the outer rect edge. Defaults to 4 px. */
    readonly inset?: number;
  };
};

/**
 * Builds a panel Graphics node at (x, y). The caller attaches it to
 * its parent container. Origin is the top-left (unlike most r3
 * primitives which default to centre) to match the layout arithmetic
 * prep pages already do in their `computeLayout` helpers.
 */
export function createR3Panel(options: R3PanelOptions): Graphics {
  const {
    x,
    y,
    width,
    height,
    radius,
    fill,
    fillAlpha = 1,
    border,
    borderAlpha = 1,
    borderWidth = 1,
    flatTop = false,
    innerOutline,
  } = options;

  const panel = new Graphics({
    x,
    y,
    width,
    height,
    originX: 0,
    originY: 0,
    textureManager: options.textureManager,
  });

  panel.fillStyle(fill, fillAlpha);
  panel.fillRoundedRect(0, 0, width, height, radius);
  if (flatTop) {
    // Overlay a flat strip across the rounded-rect's top band so the
    // top corners square off against whatever (tab bar, page header,
    // etc.) sits above the panel.
    panel.fillRect(0, 0, width, radius);
  }

  panel.lineStyle(borderWidth, border, borderAlpha);
  panel.strokeRoundedRect(0, 0, width, height, radius);
  if (flatTop) {
    // Re-stroke the top edge as a flat line so the outline reads as
    // flat-top + rounded-bottom.
    panel.strokeLine(0, 0, width, 0);
  }

  if (innerOutline) {
    const inset = innerOutline.inset ?? 4;
    const innerW = Math.max(0, width - inset * 2);
    const innerH = Math.max(0, height - inset * 2);
    const innerR = Math.max(0, radius - inset);
    if (innerW > 0 && innerH > 0) {
      panel.lineStyle(
        innerOutline.width ?? 1,
        innerOutline.color,
        innerOutline.alpha ?? 1,
      );
      panel.strokeRoundedRect(inset, inset, innerW, innerH, innerR);
    }
  }

  return panel;
}

/**
 * Convenience preset for the in-battle HUD panels (gold-framed dark
 * plaques). Central so the chrome stays coherent across every widget
 * in the game scene — corner-anchored readouts, dialpad, log ticker.
 *
 * The caller supplies only geometry; the palette is fixed so changing
 * the HUD frame colour is a one-line edit here.
 */
export type R3HudPanelGeometry = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Defaults to 12. Keep in [6, 16] to match the HUD silhouette. */
  readonly radius?: number;
  /**
   * Square off the top two corners so the plaque can dock flush
   * against a tab bar / drawer seam above it. The fill, wood-grain
   * overlay, outer gold stroke, and inner bronze stroke are all
   * stamped over the rounded top band so the silhouette reads
   * flat-top / rounded-bottom in one pass (no second Graphics
   * overlay bleeding past the rounded corner).
   *
   * Defaults to `false` (fully rounded plaque).
   */
  readonly flatTop?: boolean;
  readonly textureManager: TextureManager;
};

/** HUD fill: deep wood-lacquer ink. Used only here. */
const HUD_PANEL_FILL = 0x120d07;
/** HUD outer border: warm gold hairline. Used only here. */
const HUD_PANEL_OUTER = 0xbf923a;
/** HUD inner trace: subtler bronze to read as a double frame. */
const HUD_PANEL_INNER = 0x7a5a32;
/**
 * Key for the subtle wood-grain overlay tiled across every HUD
 * panel, passed to the configured
 * {@link "../image-loading/index.ts".ImageSlotProvider}. Under the
 * default provider the key is used directly as the image URL — a
 * host that wants a real overlay either configures its own provider
 * (mapping this key to a real asset) or points this key at a real
 * URL. Left unresolved, the overlay silently stays absent and the
 * panel paints its solid dark fill.
 */
const HUD_TEXTURE_KEY = "textures/hud-panel-bg";

/** Logical tile size for the wood-grain overlay. Matches the prior impl. */
const HUD_TEXTURE_TILE = 256;
/** Opacity the wood-grain reads at over the dark fill. */
const HUD_TEXTURE_ALPHA = 0.35;
/** Inset of the bronze inner stroke from the outer gold stroke. */
const HUD_INNER_INSET = 4;

/**
 * Renders (or re-renders) the HUD plaque into a single {@link Graphics}
 * canvas. Drawing everything through one canvas — dark fill, clipped
 * wood-grain overlay, outer gold stroke, inner bronze stroke — means
 * the rounded-rect silhouette is the only shape on the surface. The
 * overlay is {@link Graphics.fillPatternRoundedRect clipped by the same
 * path} as the fill, so the corners are physically *cut* rather than
 * visually *covered* by a layered rectangle. This is the fix for the
 * earlier bug where a rectangular texture plate bled into the rounded
 * corners whenever the panel was drawn over a non-black background.
 */
function paintHudPanel(
  target: Graphics,
  width: number,
  height: number,
  radius: number,
  tile: CanvasImageSource | null,
  flatTop: boolean,
): void {
  target.clear();
  target.fillStyle(HUD_PANEL_FILL, 1);
  target.fillRoundedRect(0, 0, width, height, radius);
  if (flatTop) {
    // Stamp the fill over the rounded-top band so the top corners
    // square off. The wood-grain pattern below then paints its own
    // top band flat, and the stroke re-traces the squared-top edge.
    target.fillRect(0, 0, width, radius);
  }

  if (tile) {
    target.fillPatternRoundedRect(
      0,
      0,
      width,
      height,
      radius,
      tile,
      HUD_TEXTURE_ALPHA,
      HUD_TEXTURE_TILE,
      HUD_TEXTURE_TILE,
    );
    // Under flatTop, the `radius × radius` corner squares above the
    // rounded-rect's arc carry the dark fill (stamped earlier) but
    // not the wood-grain pattern — the pattern is clipped to the
    // rounded silhouette. The loss is confined to those corner
    // squares; the top band BETWEEN the corners already picks up
    // grain via the rounded-rect path.
  }

  target.lineStyle(1, HUD_PANEL_OUTER, 0.95);
  target.strokeRoundedRect(0, 0, width, height, radius);
  if (flatTop) {
    // Re-stroke the top edge as a flat line so the outline reads as
    // flat-top + rounded-bottom.
    target.strokeLine(0, 0, width, 0);
  }

  const innerW = width - HUD_INNER_INSET * 2;
  const innerH = height - HUD_INNER_INSET * 2;
  if (innerW > 0 && innerH > 0) {
    target.lineStyle(1, HUD_PANEL_INNER, 0.8);
    target.strokeRoundedRect(
      HUD_INNER_INSET,
      HUD_INNER_INSET,
      innerW,
      innerH,
      Math.max(0, radius - HUD_INNER_INSET),
    );
    if (flatTop) {
      target.strokeLine(
        HUD_INNER_INSET,
        HUD_INNER_INSET,
        HUD_INNER_INSET + innerW,
        HUD_INNER_INSET,
      );
    }
  }
}

/**
 * Container that owns a list of cleanup disposers and runs them in
 * destroy. Used by {@link createR3HudPanel} to unsubscribe from the
 * texture-image listener when the plaque is torn down — otherwise an
 * asset that loads *after* the container was destroyed would repaint a
 * disposed Graphics canvas.
 */
class HudPanelContainer extends Container {
  private readonly disposers: Array<() => void> = [];

  addDisposer(fn: () => void): void {
    this.disposers.push(fn);
  }

  override destroy(): void {
    for (const dispose of this.disposers) {
      dispose();
    }
    this.disposers.length = 0;
    super.destroy();
  }
}

/**
 * Builds a gold-framed HUD plaque as a {@link Container} holding one
 * {@link Graphics}. The canvas composites:
 *
 *   1. Opaque dark rounded-rect fill.
 *   2. Wood-grain tiled pattern, clipped to the rounded silhouette.
 *   3. Outer gold stroke + inner bronze stroke for the double frame.
 *
 * The wood-grain image loads asynchronously. Until it's ready, the
 * panel paints as a solid dark rounded rect; the grain is stamped in
 * as soon as {@link ensureImage} settles. This matches the original
 * behaviour (no blocking on asset boot) while fixing the rounded-
 * corner bleed that the previous R3Image-overlay implementation had.
 */
export function createR3HudPanel(geometry: R3HudPanelGeometry): Container {
  const radius = geometry.radius ?? 12;
  const flatTop = geometry.flatTop ?? false;
  const { width, height } = geometry;

  const container = new HudPanelContainer({ x: geometry.x, y: geometry.y });

  const canvas = new Graphics({
    x: 0,
    y: 0,
    width,
    height,
    originX: 0,
    originY: 0,
    textureManager: geometry.textureManager,
  });
  container.add(canvas);

  const slot = ensureImage(HUD_TEXTURE_KEY);
  paintHudPanel(canvas, width, height, radius, slot.loaded ? slot.image : null, flatTop);
  if (!slot.loaded) {
    const dispose = onAssetReady(HUD_TEXTURE_KEY, () => {
      paintHudPanel(canvas, width, height, radius, slot.image, flatTop);
    });
    container.addDisposer(dispose);
  }

  return container;
}

/**
 * Resizable variant of {@link createR3HudPanel}. Keeps a single
 * {@link Graphics} node and re-paints the plaque chrome whenever
 * {@link R3ResizableHudPanelHandle.setRect} is called — same wood-
 * grain overlay, same double-frame (outer gold + inner bronze),
 * same dark fill. Use this for layout-engine-driven widgets whose
 * outer rect changes at runtime; the static {@link createR3HudPanel}
 * is still appropriate for panels with fixed authored geometry.
 */
export type R3ResizableHudPanelHandle = {
  readonly node: Container;
  /** The Graphics node the chrome is painted into. */
  readonly canvas: Graphics;
  /** Current radius; read-only. */
  readonly radius: number;
  /**
   * Moves + resizes the panel. Repaints the chrome at the new
   * dimensions. No-op when width / height are unchanged.
   */
  readonly setRect: (x: number, y: number, width: number, height: number) => void;
  readonly destroy: () => void;
};

/**
 * Builds a resizable HUD panel chrome node. Geometry changes repaint
 * the same backing canvas so callers can keep a stable scene object.
 */
export function createR3ResizableHudPanel(
  geometry: R3HudPanelGeometry,
): R3ResizableHudPanelHandle {
  const radius = geometry.radius ?? 12;
  const flatTop = geometry.flatTop ?? false;

  const container = new HudPanelContainer({ x: geometry.x, y: geometry.y });

  const canvas = new Graphics({
    x: 0,
    y: 0,
    width: geometry.width,
    height: geometry.height,
    originX: 0,
    originY: 0,
    textureManager: geometry.textureManager,
  });
  container.add(canvas);

  const slot = ensureImage(HUD_TEXTURE_KEY);
  const state = { width: geometry.width, height: geometry.height };

  function repaint(): void {
    paintHudPanel(
      canvas,
      state.width,
      state.height,
      radius,
      slot.loaded ? slot.image : null,
      flatTop,
    );
  }

  repaint();
  if (!slot.loaded) {
    const dispose = onAssetReady(HUD_TEXTURE_KEY, () => {
      repaint();
    });
    container.addDisposer(dispose);
  }

  return {
    node: container,
    canvas,
    radius,
    setRect(x, y, width, height) {
      container.setPosition(x, y);
      if (width === state.width && height === state.height) {
        return;
      }
      state.width = width;
      state.height = height;
      canvas.setSize(width, height);
      repaint();
    },
    destroy() {
      container.destroy();
    },
  };
}
