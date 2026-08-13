/**
 * @file TabBar — folder-style horizontal tab row (r3 port).
 *
 * 1:1 port of `src/scenes/ui/TabBar.ts`. Visual policy is identical:
 *
 *  - **Active tab** lifts {@link ACTIVE_RAISE} pixels above the
 *    baseline, fills with the accent gold, accent border thickens
 *    to 1.5px. Label shifts up by half the raise so it stays
 *    centred.
 *  - **Inactive tabs** sit on the baseline with the muted dark
 *    fill and cream label. Hover lightens the fill.
 *  - **Disabled tabs** use a darker fill, dimmer label, and are
 *    inert (no hover, no click).
 *
 * The "drawer seam" (a 1px gold line spanning the full tray width)
 * is rendered FIRST and each tab fills over its own segment, so
 * the seam shows only in the gaps + outer edges of the row.
 *
 * ## Hit-test stability
 *
 * Hit zones are pinned to the inactive tab bounds even when the tab
 * is active. The active raise is decorative; extending the hit zone
 * upward when active would not improve clickability and would let
 * the cursor "miss" a hover-highlighted tab at the moment of click.
 */

import { Container } from "../Container.ts";
import { Graphics } from "../Graphics.ts";
import { Rect } from "../Rect.ts";
import { Text } from "../Text.ts";
import type { Stage } from "../Stage.ts";
import type { TextureManager } from "../texture-canvas";
import { playR3Sfx } from "../audio.ts";
import { COLOR, COLOR_HEX, FONT } from "../theme";

const ACTIVE_FILL = COLOR_HEX.GOLD;
const ACTIVE_TEXT = COLOR.INK_TEXT;
const INACTIVE_FILL = COLOR_HEX.INK_BUTTON;
const INACTIVE_FILL_HOVER = COLOR_HEX.INK_BUTTON_HOVER;
const INACTIVE_TEXT = COLOR.CREAM_DIM;
/** Disabled-tab fill — ink-button-equivalent, slightly more muted. */
const DISABLED_FILL = 0x2a2a26;
const DISABLED_TEXT = COLOR.BROWN_TAB_DISABLED;
const BORDER_COLOR = COLOR_HEX.BROWN_BORDER;
const BORDER_COLOR_ACTIVE = COLOR_HEX.GOLD;
const SEAM_COLOR = COLOR.GOLD;
const SEAM_ALPHA = 0.95;

const CORNER_RADIUS = 12;
const DEFAULT_HEIGHT = 36;
const DEFAULT_GAP = 6;
const TAB_INNER_PAD_X = 20;
const TAB_MIN_WIDTH = 96;
const ACTIVE_RAISE = 5;
const TAB_SURFACE_PAD = 1;

const FONT_FAMILY = FONT.MINCHO;
const TAB_FONT_SIZE = 14;
/** Approximate per-character width when measureText is unavailable. */
const APPROX_GLYPH_WIDTH = TAB_FONT_SIZE * 0.6;

export type R3TabSpec = {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
};

export type R3TabBarOptions = {
  readonly stage: Stage;
  readonly textureManager: TextureManager;
  /** Left edge of the tab bar. */
  readonly x: number;
  /** Top edge of the inactive tab baseline. */
  readonly y: number;
  readonly tabs: readonly R3TabSpec[];
  /** ID of the tab drawn active on construction. */
  readonly initialId: string;
  /** Called when the user picks a tab. Disabled tabs never fire. */
  readonly onSelect: (id: string) => void;
  readonly height?: number;
  readonly gap?: number;
  readonly minTabWidth?: number;
  /**
   * Width (px) of the drawer-seam line. If omitted, no seam is drawn.
   * Pass the full content-area width so the seam extends from the
   * leftmost tab to the right edge of the content panels below.
   */
  readonly trayWidth?: number;
  /**
   * Container the tab-bar's root attaches to. Defaults to
   * `stage.root` — the existing contract — so pre-existing callers
   * (scene-level mounts) don't change. Dialog-hosted consumers pass
   * the dialog's `content` container so the tab bar inherits the
   * dialog's open/close fade and teardown.
   */
  readonly parent?: Container;
};

export type R3TabBarHandle = {
  readonly node: Container;
  readonly height: number;
  /** Sets which tab is drawn active without firing `onSelect`. */
  readonly setActive: (id: string) => void;
  readonly destroy: () => void;
};

type TabView = {
  readonly spec: R3TabSpec;
  readonly bg: Graphics;
  readonly label: Text;
  readonly hit: Rect;
  readonly width: number;
  readonly x: number;
  active: boolean;
  hovered: boolean;
};

/** Approximate label width for tab sizing — Canvas may be unavailable in headless tests. */
function approxLabelWidth(label: string): number {
  return Math.ceil(Array.from(label).length * APPROX_GLYPH_WIDTH);
}

/**
 * Stamps a folder-shaped path (rounded top corners, flat bottom)
 * into the graphics surface. The active raise is folded in so the
 * tab visually lifts above the baseline.
 *
 * r3 Graphics has no native top-only rounded-rect, so we draw a
 * full rounded-rect and overlay a flat strip across the bottom
 * radius so the bottom corners read square. The border is then
 * drawn the same way: a rounded-rect outline plus a re-stroke of
 * the bottom edge so it caps cleanly against the drawer seam.
 */
function drawTabShape(
  graphics: Graphics,
  width: number,
  baselineHeight: number,
  fillHex: number,
  borderHex: number,
  isActive: boolean,
): void {
  const topY = (isActive ? 0 : ACTIVE_RAISE) + TAB_SURFACE_PAD;
  const totalHeight = isActive ? baselineHeight + ACTIVE_RAISE : baselineHeight;
  const bottomY = topY + totalHeight;
  const radius = CORNER_RADIUS;

  graphics.clear();
  graphics.fillStyle(fillHex, 1);
  graphics.fillRoundedRect(0, topY, width, totalHeight, radius);
  // Square off the bottom corners by re-filling the bottom strip.
  graphics.fillRect(0, bottomY - radius, width, radius);

  graphics.lineStyle(isActive ? 1.5 : 1, borderHex, 0.95);
  graphics.strokeRoundedRect(0, topY, width, totalHeight, radius);
  graphics.strokeLine(0, bottomY, width, bottomY);
}

/**
 * Builds a horizontal tab bar with folder-style tabs. Returns a
 * handle whose `setActive(id)` syncs the visual state from an
 * external transition (typically the page-stack cross-fade).
 */
export function createR3TabBar(options: R3TabBarOptions): R3TabBarHandle {
  const height = options.height ?? DEFAULT_HEIGHT;
  const gap = options.gap ?? DEFAULT_GAP;

  const widths = options.tabs.map((tab) => {
    const labelWidth = approxLabelWidth(tab.label);
    return Math.max(options.minTabWidth ?? TAB_MIN_WIDTH, labelWidth + TAB_INNER_PAD_X * 2);
  });

  const xs = widths.map((_, i) => widths.slice(0, i).reduce((acc, w) => acc + w + gap, 0));

  const root = new Container({ name: "r3:tab-bar" });
  const parent = options.parent ?? options.stage.root;
  parent.add(root);

  // Drawer seam — drawn FIRST so each tab's fill paints over its
  // own segment of seam (only the gaps + outer edges show).
  if (options.trayWidth !== undefined && options.trayWidth > 0) {
    const seam = new Rect({
      x: options.x,
      y: options.y + height,
      width: options.trayWidth,
      height: 1,
      fill: SEAM_COLOR,
      fillAlpha: SEAM_ALPHA,
      originX: 0,
      originY: 1,
      textureManager: options.textureManager,
    });
    root.add(seam);
  }

  const views: TabView[] = options.tabs.map((spec, i) => {
    const w = widths[i] ?? TAB_MIN_WIDTH;
    const tabX = options.x + (xs[i] ?? 0);

    // Graphics surface big enough to hold both the baseline shape
    // and the active raise above the top edge.
    const bg = new Graphics({
      x: tabX,
      y: options.y - ACTIVE_RAISE - TAB_SURFACE_PAD,
      width: w,
      height: height + ACTIVE_RAISE + TAB_SURFACE_PAD * 2,
      originX: 0,
      originY: 0,
      textureManager: options.textureManager,
    });
    root.add(bg);

    const label = new Text({
      x: tabX + w / 2,
      y: options.y + height / 2,
      text: spec.label,
      font: { family: FONT_FAMILY, size: TAB_FONT_SIZE, weight: "bold" },
      color: INACTIVE_TEXT,
      originX: 0.5,
      originY: 0.5,
      textureManager: options.textureManager,
    });
    root.add(label);

    // Hit area pinned to the inactive bounds (see file header).
    const hit = new Rect({
      x: tabX,
      y: options.y,
      width: w,
      height,
      fill: COLOR.BLACK,
      fillAlpha: 0,
      originX: 0,
      originY: 0,
      interactive: spec.disabled !== true,
      textureManager: options.textureManager,
    });
    root.add(hit);

    return {
      spec,
      bg,
      label,
      hit,
      width: w,
      x: tabX,
      active: spec.id === options.initialId,
      hovered: false,
    };
  });

  function paint(view: TabView): void {
    if (view.spec.disabled === true) {
      drawTabShape(view.bg, view.width, height, DISABLED_FILL, BORDER_COLOR, false);
      view.label.setColor(DISABLED_TEXT);
      view.label.y = options.y + height / 2;
      return;
    }
    if (view.active) {
      drawTabShape(view.bg, view.width, height, ACTIVE_FILL, BORDER_COLOR_ACTIVE, true);
      view.label.setColor(ACTIVE_TEXT);
      view.label.y = options.y + height / 2 - ACTIVE_RAISE / 2;
      return;
    }
    const fill = view.hovered ? INACTIVE_FILL_HOVER : INACTIVE_FILL;
    drawTabShape(view.bg, view.width, height, fill, BORDER_COLOR, false);
    view.label.setColor(INACTIVE_TEXT);
    view.label.y = options.y + height / 2;
  }

  for (const view of views) {
    paint(view);
    view.hit.on("pointerover", () => {
      if (view.spec.disabled === true || view.active) {
        return;
      }
      view.hovered = true;
      paint(view);
      playR3Sfx("title-button-hover");
    });
    view.hit.on("pointerout", () => {
      if (view.spec.disabled === true) {
        return;
      }
      view.hovered = false;
      paint(view);
    });
    view.hit.on("pointerdown", () => {
      if (view.spec.disabled === true || view.active) {
        return;
      }
      playR3Sfx("title-button-click");
      options.onSelect(view.spec.id);
    });
  }

  return {
    node: root,
    height,
    setActive(id: string): void {
      for (const view of views) {
        const next = view.spec.id === id;
        if (view.active === next) {
          continue;
        }
        view.active = next;
        if (!next) {
          view.hovered = false;
        }
        paint(view);
      }
    },
    destroy(): void {
      root.destroy();
    },
  };
}
