/**
 * @file game r3 layout engine oneshot.
 */
import { arrangeTree, type ArrangeVisitor } from "./arrange.ts";
import type { LayoutNode } from "./nodes.ts";
import type { LayoutRect } from "./types.ts";

export type ArrangeOneShotOptions = {
  /**
   * Optional observer for callers that need to collect rects. Node
   * callbacks still fire first, matching LayoutRuntime's contract.
   */
  readonly visit?: ArrangeVisitor;
};

/**
 * Runs a single layout pass and invokes each node's own `onRect`.
 *
 * Use this instead of calling `arrangeTree` directly when the layout
 * result is consumed by authored callbacks. `arrangeTree` is the raw
 * traversal primitive; it only reports rects to its visitor.
 */
export function arrangeOneShot(
  root: LayoutNode,
  viewport: LayoutRect,
  options: ArrangeOneShotOptions = {},
): void {
  arrangeTree(root, viewport, (node, rect) => {
    node.onRect?.(rect);
    options.visit?.(node, rect);
  });
}
