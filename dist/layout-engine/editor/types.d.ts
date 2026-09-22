import { AnchorName, AbsoluteChild, FlexNode, LayoutNode, LeafNode } from '../nodes.ts';
import { LayoutRect } from '../types.ts';
/** Anchor placement stamped onto an absolute child's wrapper. */
export type AnchorPlacement = {
    readonly anchor: AnchorName;
    readonly insetX: number;
    readonly insetY: number;
};
/**
 * Every callback the editor needs to drive an application's layout
 * tree. Group-by-concern so implementors see the contract at a
 * glance; the editor code itself never reaches into implementation
 * details.
 */
export type LayoutEditorHost = {
    /** The live tree root (mutable ref). */
    readonly tree: {
        readonly current: LayoutNode;
    };
    /** Live per-key rect snapshots written by the runtime's tween pass. */
    readonly rects: Readonly<Record<string, LayoutRect>>;
    readonly findNode: (key: string) => LayoutNode | null;
    readonly findLeaf: (key: string) => LeafNode | null;
    readonly findAbsoluteWrapper: (key: string) => {
        wrapper: AbsoluteChild;
        parent: FlexNode;
    } | null;
    readonly getAnchorPlacement: (key: string) => AnchorPlacement | null;
    readonly setAnchorPlacement: (key: string, placement: AnchorPlacement) => void;
    /**
     * Mutates the authored `width` / `height` of any keyed node (leaf
     * OR flex). For a flex, this updates its natural content size —
     * which in turn drives both flow-mode reflow of its children and
     * scale-mode transform of its subtree.
     */
    readonly setNodeSize: (key: string, width: number, height: number) => void;
    readonly removeByKey: (key: string) => boolean;
    readonly promoteFlowToAbsolute: (key: string) => boolean;
    readonly relayout: () => void;
    /** Switch into "no-tween" mode for the duration of a pointer drag. */
    readonly beginInstant: () => void;
    readonly endInstant: () => void;
    /**
     * Creates and inserts a new leaf into the tree as an absolute
     * child of the root. Optional — when absent, the page UI should
     * hide its "Add card" affordance. Returns the new node's key so
     * the editor can auto-select it.
     */
    readonly addPlaceholder?: (placement: {
        readonly anchor: AnchorName;
        readonly insetX: number;
        readonly insetY: number;
        readonly width?: number;
        readonly height?: number;
    }) => string;
};
