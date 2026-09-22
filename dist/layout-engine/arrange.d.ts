import { LayoutRect, Size } from './types.ts';
import { FlexNode, LayoutNode, LeafNode } from './nodes.ts';
/** Called for every node as soon as its rect is known. */
export type ArrangeVisitor = (node: LayoutNode, rect: LayoutRect) => void;
/**
 * Arranges the tree rooted at `node` inside `rect` and invokes
 * `visit` for every node (including the root). Visits are pre-order:
 * a parent's `visit` runs before its children's.
 */
export declare function arrangeTree(node: LayoutNode, rect: LayoutRect, visit: ArrangeVisitor): void;
/** Exposed for tests — the cross-axis resolver used while arranging. */
export declare function _testResolveChildCross(container: FlexNode, child: LeafNode, intrinsic: Size, innerCross: number): {
    size: number;
    offset: number;
};
