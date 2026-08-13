/**
 * @file Heading — shared single-line text widget for r3.
 *
 * Wraps an r3 {@link Text} as a layout-engine-friendly widget: the
 * caller authors the styling (family / size / weight / colour, optional
 * stroke), the widget bakes the raster, and the resulting natural size
 * is exposed via {@link R3HeadingHandle.naturalSize} so the caller can
 * feed it into a {@link leaf} as the authored width / height.
 *
 * `setRect` recentres the text inside the assigned layout rect — the
 * underlying Text node carries pivot (0.5, 0.5) so the press-pulse-
 * style symmetric scaling that the layout system might apply via
 * scale-mode flexes still rotates around the visual centre.
 *
 * This widget is intentionally cosmetic-only — it has no interactivity.
 * Use {@link createR3Button} when the heading should also be clickable.
 *
 * ## Why a widget rather than a raw Text
 *
 *  - The layout engine routes rects through `setRect(x, y, w, h)`
 *    callbacks (the same shape every HUD widget already speaks). A raw
 *    Text exposes only `setPosition` and reasons about its own size,
 *    so consumer code would have to hand-translate top-left rects into
 *    centre-anchored coords each time. The widget consolidates that
 *    arithmetic.
 *  - Title-style headings reach for the same stroke / family / weight
 *    triple repeatedly; centralising it here keeps future visual
 *    re-tuning a single-file edit.
 */

import {
  createR3LayoutRoot,
  createR3MotionRoot,
  type R3LayoutRoot,
  type R3MotionRoot,
} from "../LayoutMotion.ts";
import { Text } from "../Text.ts";
import type { TextureManager } from "../texture-canvas";
import type { FontStyleSpec } from "../text-metrics.ts";

export type R3HeadingStroke = {
  readonly color: string;
  readonly width: number;
};

export type R3HeadingOptions = {
  /** Top-left X. Caller may move this later via {@link R3HeadingHandle.setRect}. */
  readonly x?: number;
  /** Top-left Y. Caller may move this later via {@link R3HeadingHandle.setRect}. */
  readonly y?: number;
  readonly text: string;
  readonly font: FontStyleSpec;
  readonly color: string;
  readonly textureManager: TextureManager;
  /** Optional outline drawn under the fill — typical for title plates. */
  readonly stroke?: R3HeadingStroke;
};

export type R3HeadingHandle = {
  /** Container the caller attaches to its scene root. */
  readonly node: R3LayoutRoot;
  /** Visual subtree for cosmetic motion; callers must keep `node` as layout SoT. */
  readonly visualNode: R3MotionRoot;
  /**
   * Intrinsic size of the rasterised text. Stable for the life of this
   * handle — call {@link setText} for content swaps, which refreshes
   * this value on the returned handle is not needed because the next
   * `setRect` keeps using the live measurement of the underlying Text.
   * Use this to author the layout-engine leaf's `width` / `height`.
   */
  readonly naturalSize: () => { readonly width: number; readonly height: number };
  readonly setRect: (x: number, y: number, width: number, height: number) => void;
  readonly setText: (text: string) => void;
  readonly setFont: (font: FontStyleSpec) => void;
  readonly setColor: (color: string) => void;
  readonly setStroke: (stroke: R3HeadingStroke | null) => void;
  readonly destroy: () => void;
};

/**
 * Builds a centred-pivot Text wrapped in a Container that exposes the
 * standard `setRect` shape. The container's local origin is the
 * heading's visual centre, so attach handlers / decorations rooted on
 * `node` and they will move with the heading on resize.
 */
export function createR3Heading(options: R3HeadingOptions): R3HeadingHandle {
  const root = createR3LayoutRoot({
    x: options.x ?? 0,
    y: options.y ?? 0,
    name: "r3:heading",
  });
  const visualNode = createR3MotionRoot({ x: 0, y: 0, name: "r3:heading-visual" });
  root.add(visualNode);

  const text = new Text({
    text: options.text,
    font: options.font,
    color: options.color,
    originX: 0.5,
    originY: 0.5,
    stroke: options.stroke,
    textureManager: options.textureManager,
  });
  visualNode.add(text);

  return {
    node: root,
    visualNode,
    naturalSize: () => ({ width: text.width, height: text.height }),
    setRect(x, y, width, height) {
      // Pivot of the Text is (0.5, 0.5), so its "position" is the
      // centre of its own rasterised box. Place the centre of the
      // assigned layout rect, regardless of whether the rect is taller
      // / wider than the text — the text stays visually centred so a
      // larger leaf reads as breathing room rather than an off-axis
      // glyph.
      root.setPosition(x + width / 2, y + height / 2);
    },
    setText(next: string) {
      text.setText(next);
    },
    setFont(next: FontStyleSpec) {
      text.setStyle(next);
    },
    setColor(next: string) {
      text.setColor(next);
    },
    setStroke(next: R3HeadingStroke | null) {
      text.setStroke(next);
    },
    destroy() {
      root.destroy();
    },
  };
}
