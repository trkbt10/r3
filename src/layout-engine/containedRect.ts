/**
 * @file Contained rectangle placement for r3 layout consumers.
 */

import type { LayoutRect } from "./types.ts";

export type ContainedRectAlignment = "start" | "center" | "end";

export type ContainedRectOptions = {
  readonly bounds: LayoutRect;
  readonly width: number;
  readonly height: number;
  readonly alignX?: ContainedRectAlignment;
  readonly alignY?: ContainedRectAlignment;
};

/**
 * Places a fixed-size child rectangle inside a parent layout rect.
 *
 * Oversized children pin to the parent's start edge on the overflowing
 * axis, matching the defensive layout arithmetic older call sites used
 * to write by hand with `Math.max(0, ...)`.
 */
export function containedRectWithin(options: ContainedRectOptions): LayoutRect {
  return {
    x: alignedOffset(options.bounds.x, options.bounds.width, options.width, options.alignX ?? "start"),
    y: alignedOffset(options.bounds.y, options.bounds.height, options.height, options.alignY ?? "start"),
    width: options.width,
    height: options.height,
  };
}

function alignedOffset(
  start: number,
  parentSize: number,
  childSize: number,
  alignment: ContainedRectAlignment,
): number {
  if (alignment === "end") {
    return start + Math.max(0, parentSize - childSize);
  }
  if (alignment === "center") {
    return start + Math.max(0, Math.floor((parentSize - childSize) / 2));
  }
  return start;
}
