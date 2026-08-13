/**
 * @file Intrinsic-size pass.
 *
 * Resolves the outer size of every node when one or both of its
 * authored dimensions is `"auto"`. Leaves whose dimension is `"auto"`
 * report zero on that axis — a leaf is a terminal, so it carries no
 * content to measure against; callers who want a non-zero leaf size
 * should author a number or rely on `align: "stretch"` from the
 * parent to fill the cross-axis.
 *
 * Flex containers compute their auto-size from their flow children:
 *
 *   - **Main axis**: sum of children's main-axis intrinsic sizes +
 *     gaps between them + main-axis padding.
 *   - **Cross axis**: max of children's cross-axis intrinsic sizes +
 *     cross-axis padding.
 *
 * Absolute children are ignored during measurement — they are
 * positioned against the parent's final rect, not the parent's
 * content size, so they contribute no intrinsic footprint.
 */

import { edgeHorizontal, edgeVertical, type Size } from "./types.ts";
import type { FlexNode, LayoutNode, LeafNode } from "./nodes.ts";

/**
 * Returns the node's intrinsic (content-driven) size. Any authored
 * numeric dimension wins; `"auto"` dimensions recurse into children.
 */
export function measureNode(node: LayoutNode): Size {
  if (node.kind === "leaf") {
    return measureLeaf(node);
  }
  return measureFlex(node);
}

function measureLeaf(leaf: LeafNode): Size {
  return {
    width: typeof leaf.width === "number" ? leaf.width : 0,
    height: typeof leaf.height === "number" ? leaf.height : 0,
  };
}

function measureFlex(flex: FlexNode): Size {
  const childSizes = flex.children.map((child) => measureNode(child));

  const mainGap = flex.gap * Math.max(0, flex.children.length - 1);
  const contentMain = childSizes.reduce((sum, size) => {
    return sum + (flex.direction === "row" ? size.width : size.height);
  }, 0);
  const contentCross = childSizes.reduce((acc, size) => {
    return Math.max(acc, flex.direction === "row" ? size.height : size.width);
  }, 0);

  const mainIntrinsic = contentMain + mainGap;
  const crossIntrinsic = contentCross;

  const widthAuto = flex.width === "auto";
  const heightAuto = flex.height === "auto";

  const width = ((): number => {
    if (!widthAuto) {
      return flex.width as number;
    }
    if (flex.direction === "row") {
      return mainIntrinsic + edgeHorizontal(flex.padding);
    }
    return crossIntrinsic + edgeHorizontal(flex.padding);
  })();

  const height = ((): number => {
    if (!heightAuto) {
      return flex.height as number;
    }
    if (flex.direction === "row") {
      return crossIntrinsic + edgeVertical(flex.padding);
    }
    return mainIntrinsic + edgeVertical(flex.padding);
  })();

  return { width, height };
}
