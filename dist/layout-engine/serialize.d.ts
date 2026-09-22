import { AnchorName, FlexMode, LayoutNode, OnRect } from './nodes.ts';
import { AlignItems, EdgeBox, FlexDirection, JustifyContent, LayoutTransform, SizeValue, Transition } from './types.ts';
/** Anchor-based absolute placement — the only kind that round-trips. */
export type SerialAnchorPlacement = {
    readonly kind: "anchor";
    readonly anchor: AnchorName;
    readonly insetX: number;
    readonly insetY: number;
    /** Outer-size override — used when the parent wants to allocate a
     * specific canvas to a scale-mode flex. Optional; undefined = use
     * the child's intrinsic size. */
    readonly outerWidth?: number;
    readonly outerHeight?: number;
};
export type SerialAbsoluteChild = {
    readonly node: SerialNode;
    readonly placement: SerialAnchorPlacement;
};
export type SerialFlexNode = {
    readonly kind: "flex";
    readonly key?: string;
    readonly direction: FlexDirection;
    readonly justify: JustifyContent;
    readonly align: AlignItems;
    readonly padding: EdgeBox;
    readonly gap: number;
    readonly width: SizeValue;
    readonly height: SizeValue;
    readonly flex: number;
    readonly alignSelf?: AlignItems;
    readonly transition?: Transition;
    readonly transform?: LayoutTransform;
    /** Resize mode. Optional — omitted for the default `flow`. */
    readonly mode?: FlexMode;
    readonly children: readonly SerialNode[];
    readonly absolute: readonly SerialAbsoluteChild[];
};
export type SerialLeafNode = {
    readonly kind: "leaf";
    readonly key?: string;
    readonly width: SizeValue;
    readonly height: SizeValue;
    readonly flex: number;
    readonly alignSelf?: AlignItems;
    readonly transition?: Transition;
    readonly transform?: LayoutTransform;
};
export type SerialNode = SerialFlexNode | SerialLeafNode;
/** Mapping from leaf `key` → `onRect` callback used during hydration. */
export type LeafBindings = Readonly<Record<string, OnRect>>;
/**
 * Converts a runtime tree to its JSON-ready representation. Throws
 * when an absolute child's `place` is a bespoke function (not from
 * {@link placeAnchor}) — serialization would silently drop the
 * positioning rule, which is never the behaviour the caller wants.
 */
export declare function serializeTree(node: LayoutNode): SerialNode;
/**
 * Rebuilds a runtime tree from JSON.
 *
 *   - `bindings`: maps a node's `key` to the r3 `onRect` callback
 *     that should fire when the node's rect changes. Nodes whose
 *     key is absent from `bindings` receive no callback — handy for
 *     spacers (no widget to position) and the in-tree "board" leaf
 *     that only exists so the overlay can read its rect.
 *   - `existing`: an optional prior tree. When present, hydrate
 *     walks it in parallel with the serial tree; nodes whose `key`
 *     matches are mutated in place (authored fields overwritten,
 *     children re-parented) so the returned tree reuses those
 *     objects. This is what preserves {@link LayoutRuntime} tween
 *     state across a JSON edit.
 */
export declare function hydrateTree(serial: SerialNode, bindings?: LeafBindings, existing?: LayoutNode | null): LayoutNode;
