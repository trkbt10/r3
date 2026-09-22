import { Size } from './types.ts';
import { LayoutNode } from './nodes.ts';
/**
 * Returns the node's intrinsic (content-driven) size. Any authored
 * numeric dimension wins; `"auto"` dimensions recurse into children.
 */
export declare function measureNode(node: LayoutNode): Size;
