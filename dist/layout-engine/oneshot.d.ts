import { ArrangeVisitor } from './arrange.ts';
import { LayoutNode } from './nodes.ts';
import { LayoutRect } from './types.ts';
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
export declare function arrangeOneShot(root: LayoutNode, viewport: LayoutRect, options?: ArrangeOneShotOptions): void;
