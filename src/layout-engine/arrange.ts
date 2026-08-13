/**
 * @file Arrange pass — walks the tree top-down and writes each node's
 * final {@link LayoutRect} via a visitor callback.
 *
 * ## Algorithm
 *
 * For a flex container with outer rect R:
 *
 *   1. Derive the inner rect: R minus padding on every edge.
 *   2. Measure each flow child's intrinsic main-axis size. A leaf's
 *      authored number wins; "auto" reports 0 on the axis. Absolute
 *      children are excluded from this pass.
 *   3. Compute free main-axis space: inner.main − Σ children.main −
 *      gap × (n − 1).
 *   4. Distribute space:
 *        - If Σ flex > 0: each flex child receives `flex/Σflex × free`
 *          ADDED to its intrinsic size. Non-flex children keep their
 *          intrinsic size. justifyContent is ignored in this mode
 *          because there is no "leftover" to distribute — flex ate it.
 *        - Otherwise: children keep intrinsic sizes; `justifyContent`
 *          decides where the leftover lives (start / center / end /
 *          space-between / space-around / space-evenly).
 *   5. Resolve each child's cross-axis size:
 *        - `align: "stretch"` (or `alignSelf: "stretch"`) → inner.cross.
 *        - Otherwise → child's intrinsic cross size.
 *      Align the cross-axis offset by the same key (start/center/end).
 *   6. Recurse into each child with its resolved rect.
 *   7. For every absolute child, invoke its `place` function with the
 *      container's own outer rect (not inner) and recurse.
 *
 * Rects are integer-rounded at the point of child placement so r3
 * widgets never sit on sub-pixel positions (which on most DPRs paints
 * to fractional device pixels and reads as a blur). The runtime can
 * still tween through fractional intermediate positions because the
 * tween evaluates against a live mutable rect, not this pass's output.
 */

import { measureNode } from "./measure.ts";
import type {
  AlignItems,
  JustifyContent,
  LayoutRect,
  Size,
} from "./types.ts";
import type { FlexMode, FlexNode, LayoutNode, LeafNode } from "./nodes.ts";

/** Called for every node as soon as its rect is known. */
export type ArrangeVisitor = (node: LayoutNode, rect: LayoutRect) => void;

/**
 * Arranges the tree rooted at `node` inside `rect` and invokes
 * `visit` for every node (including the root). Visits are pre-order:
 * a parent's `visit` runs before its children's.
 */
export function arrangeTree(
  node: LayoutNode,
  rect: LayoutRect,
  visit: ArrangeVisitor,
): void {
  visit(node, rect);
  if (node.kind === "leaf") {
    return;
  }
  arrangeFlex(node, rect, visit);
}

/**
 * Arranges a flex node. Delegates to {@link arrangeFlexChildren} in
 * the default flow mode; in scale mode, the flex's authored
 * `width × height` becomes a natural content rect the children are
 * arranged against, and the visitor is wrapped to transform the
 * emitted rects into the outer rect the parent actually allocated.
 *
 * Nesting composes without any special case — each scale-mode flex
 * stacks its own transform on top of whatever the outer layers
 * already wrapped.
 */
function arrangeFlex(
  node: FlexNode,
  outer: LayoutRect,
  visit: ArrangeVisitor,
): void {
  if (node.mode.kind === "flow") {
    arrangeFlexChildren(node, outer, visit);
    return;
  }
  const naturalWidth = typeof node.width === "number" ? node.width : outer.width;
  const naturalHeight = typeof node.height === "number" ? node.height : outer.height;
  const transform = computeScaleTransform(outer, naturalWidth, naturalHeight, node.mode);
  const naturalOuter: LayoutRect = { x: 0, y: 0, width: naturalWidth, height: naturalHeight };
  const wrappedVisit: ArrangeVisitor = (inner, innerRect) => {
    visit(inner, {
      x: transform.offsetX + innerRect.x * transform.scaleX,
      y: transform.offsetY + innerRect.y * transform.scaleY,
      width: innerRect.width * transform.scaleX,
      height: innerRect.height * transform.scaleY,
    });
  };
  arrangeFlexChildren(node, naturalOuter, wrappedVisit);
}

function computeScaleTransform(
  outer: LayoutRect,
  naturalWidth: number,
  naturalHeight: number,
  mode: FlexMode & { kind: "scale" },
): { scaleX: number; scaleY: number; offsetX: number; offsetY: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { scaleX: 1, scaleY: 1, offsetX: outer.x, offsetY: outer.y };
  }
  const sx = outer.width / naturalWidth;
  const sy = outer.height / naturalHeight;
  if (mode.fit === "fill") {
    return { scaleX: sx, scaleY: sy, offsetX: outer.x, offsetY: outer.y };
  }
  // `contain` shrinks to fit; `cover` fills, cropping if need be.
  const unified = mode.fit === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
  const scaledW = naturalWidth * unified;
  const scaledH = naturalHeight * unified;
  return {
    scaleX: unified,
    scaleY: unified,
    offsetX: outer.x + (outer.width - scaledW) / 2,
    offsetY: outer.y + (outer.height - scaledH) / 2,
  };
}

function arrangeFlexChildren(
  container: FlexNode,
  outer: LayoutRect,
  visit: ArrangeVisitor,
): void {
  const inner = innerRect(container, outer);
  const isRow = container.direction === "row";

  const basis = container.children.map((child) => measureNode(child));
  const mainBasis = basis.map((size) => (isRow ? size.width : size.height));
  const crossBasis = basis.map((size) => (isRow ? size.height : size.width));
  const innerMain = isRow ? inner.width : inner.height;
  const innerCross = isRow ? inner.height : inner.width;

  const n = container.children.length;
  const totalGap = container.gap * Math.max(0, n - 1);
  const totalBasis = mainBasis.reduce((sum, v) => sum + v, 0);
  const free = innerMain - totalBasis - totalGap;
  const totalFlex = container.children.reduce((sum, c) => sum + c.flex, 0);

  const mainSizes = resolveMainSizes(container, mainBasis, free, totalFlex);

  // Starting offset along the main axis inside `inner`.
  const leadingMain = resolveMainLeading(container.justify, free, n, totalFlex);
  // Space-* modes ignore leading and insert variable per-slot padding.
  const slotGap = resolveSlotGap(container.justify, container.gap, free, n, totalFlex);

  const mainBase = isRow ? inner.x : inner.y;
  const crossBase = isRow ? inner.y : inner.x;
  const mainOffsets = computeMainOffsets(mainSizes, slotGap, mainBase + leadingMain);

  for (let i = 0; i < n; i++) {
    const child = container.children[i];
    const size = mainSizes[i];
    const mainOffset = mainOffsets[i];
    if (!child || size === undefined || mainOffset === undefined) {
      continue;
    }
    const childCross = resolveChildCrossSize(
      container,
      child,
      crossBasis[i] ?? 0,
      innerCross,
    );
    const childCrossOffset = resolveChildCrossOffset(
      container,
      child,
      innerCross,
      childCross,
    );

    const childRect = composeChildRect(
      isRow,
      mainOffset,
      crossBase + childCrossOffset,
      size,
      childCross,
    );

    arrangeTree(child, childRect, visit);
  }

  for (const abs of container.absolute) {
    const intrinsic = measureNode(abs.node);
    const childRect = abs.place(outer, intrinsic);
    arrangeTree(abs.node, childRect, visit);
  }
}

/**
 * Pre-computes the main-axis offset of every flow child. Using a
 * prefix-sum keeps the placement loop allocation-free of per-iteration
 * accumulator state (the lint rule against `let` is what motivated
 * lifting this out, but the scalar-prefix-sum is also a clearer
 * separation of "where does child i start?" from child rect assembly).
 */
function computeMainOffsets(
  mainSizes: readonly number[],
  slotGap: number,
  leading: number,
): number[] {
  const out: number[] = [];
  mainSizes.reduce<number>((cumulative, size, index) => {
    out.push(cumulative);
    const trailing = index < mainSizes.length - 1 ? slotGap : 0;
    return cumulative + size + trailing;
  }, leading);
  return out;
}

/**
 * Swaps main/cross axes into x/y based on {@link isRow}. Keeps the
 * arrange loop readable by hiding the axis pivot in one place.
 */
function composeChildRect(
  isRow: boolean,
  mainOffset: number,
  crossOffset: number,
  mainSize: number,
  crossSize: number,
): LayoutRect {
  const main = Math.round(mainOffset);
  const cross = Math.round(crossOffset);
  const mainSz = Math.round(mainSize);
  const crossSz = Math.round(crossSize);
  if (isRow) {
    return { x: main, y: cross, width: mainSz, height: crossSz };
  }
  return { x: cross, y: main, width: crossSz, height: mainSz };
}

function innerRect(container: FlexNode, outer: LayoutRect): LayoutRect {
  const { padding } = container;
  return {
    x: outer.x + padding.left,
    y: outer.y + padding.top,
    width: Math.max(0, outer.width - padding.left - padding.right),
    height: Math.max(0, outer.height - padding.top - padding.bottom),
  };
}

/**
 * Final main-axis size for every child. When any child flexes, the
 * positive `free` space is distributed proportionally by `flex`; a
 * negative `free` (overflow) is left alone — callers see a shrunk
 * parent rather than negative child sizes.
 */
function resolveMainSizes(
  container: FlexNode,
  mainBasis: readonly number[],
  free: number,
  totalFlex: number,
): number[] {
  if (totalFlex <= 0 || free <= 0) {
    return mainBasis.slice();
  }
  return container.children.map((child, i) => {
    const basis = mainBasis[i] ?? 0;
    if (child.flex <= 0) {
      return basis;
    }
    return basis + (child.flex / totalFlex) * free;
  });
}

/**
 * Returns the main-axis offset of the first child relative to the
 * inner rect. Only used when no flex eats the free space.
 */
function resolveMainLeading(
  justify: JustifyContent,
  free: number,
  childCount: number,
  totalFlex: number,
): number {
  if (totalFlex > 0 || free <= 0) {
    return 0;
  }
  if (justify === "start" || justify === "space-between") {
    return 0;
  }
  if (justify === "center") {
    return free / 2;
  }
  if (justify === "end") {
    return free;
  }
  if (justify === "space-around") {
    return childCount === 0 ? 0 : free / childCount / 2;
  }
  // space-evenly
  return childCount === 0 ? 0 : free / (childCount + 1);
}

/**
 * Per-slot gap supplement added to the authored `gap`. For
 * justify-content values other than the `space-*` family, every slot
 * uses the authored gap unchanged.
 */
function resolveSlotGap(
  justify: JustifyContent,
  baseGap: number,
  free: number,
  childCount: number,
  totalFlex: number,
): number {
  if (totalFlex > 0 || free <= 0 || childCount < 2) {
    return baseGap;
  }
  if (justify === "space-between") {
    return baseGap + free / (childCount - 1);
  }
  if (justify === "space-around") {
    return baseGap + free / childCount;
  }
  if (justify === "space-evenly") {
    return baseGap + free / (childCount + 1);
  }
  return baseGap;
}

function resolveChildCrossSize(
  container: FlexNode,
  child: LayoutNode,
  intrinsic: number,
  innerCross: number,
): number {
  const align = effectiveAlign(container, child);
  if (align === "stretch") {
    return innerCross;
  }
  return intrinsic;
}

function resolveChildCrossOffset(
  container: FlexNode,
  child: LayoutNode,
  innerCross: number,
  childCross: number,
): number {
  const align = effectiveAlign(container, child);
  if (align === "center") {
    return (innerCross - childCross) / 2;
  }
  if (align === "end") {
    return innerCross - childCross;
  }
  // "start" and "stretch" both begin at the inner origin; "stretch"
  // already produced a full-cross size so the offset is still zero.
  return 0;
}

function effectiveAlign(container: FlexNode, child: LayoutNode): AlignItems {
  return child.alignSelf ?? container.align;
}

/** Exposed for tests — the cross-axis resolver used while arranging. */
export function _testResolveChildCross(
  container: FlexNode,
  child: LeafNode,
  intrinsic: Size,
  innerCross: number,
): { size: number; offset: number } {
  const intrinsicCross = container.direction === "row" ? intrinsic.height : intrinsic.width;
  return {
    size: resolveChildCrossSize(container, child, intrinsicCross, innerCross),
    offset: resolveChildCrossOffset(
      container,
      child,
      innerCross,
      resolveChildCrossSize(container, child, intrinsicCross, innerCross),
    ),
  };
}
