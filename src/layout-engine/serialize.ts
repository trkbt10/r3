/**
 * @file JSON serialisation for the layout tree.
 *
 * Runtime {@link LayoutNode}s hold both pure layout data (direction,
 * sizes, etc.) and runtime-only plumbing (`onRect` callbacks, custom
 * `place` functions, tween state). JSON can express the former but
 * not the latter; this module walks both directions.
 *
 *   - **{@link serializeTree}**: LayoutNode → {@link SerialNode}.
 *     Pure data; anchor-based absolute placements survive because
 *     {@link placeAnchor} stamps `__anchor` metadata on its returned
 *     function. Any custom `place` callback throws — if you want to
 *     edit HUD layout as JSON, stick to anchor placements.
 *   - **{@link hydrateTree}**: {@link SerialNode} → LayoutNode. An
 *     optional `bindings` map wires each leaf's `onRect` by `key`.
 *     An optional `existing` tree is walked in parallel: nodes whose
 *     keys match an existing node are mutated in place so the caller
 *     can pass the new tree to {@link LayoutRuntime.setRoot} and have
 *     tween state survive (the runtime keys its state by object
 *     identity, and we honour that by reusing objects).
 *
 * The schema is intentionally literal-shape: every authored field
 * maps to a JSON field with the same name, plus a top-level `kind`
 * discriminator. No shorthands. A human writing JSON sees the tree
 * exactly as the engine sees it.
 */

import {
  flexBox,
  leaf,
  placeAnchor,
  isAnchorPlace,
  type AbsoluteChild,
  type AnchorName,
  type FlexMode,
  type FlexNode,
  type LayoutNode,
  type LeafNode,
  type OnRect,
} from "./nodes.ts";
import {
  normaliseEdge,
  type AlignItems,
  type EdgeBox,
  type FlexDirection,
  type JustifyContent,
  type LayoutTransform,
  type SizeValue,
  type Transition,
} from "./types.ts";

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
export function serializeTree(node: LayoutNode): SerialNode {
  if (node.kind === "leaf") {
    return serialiseLeaf(node);
  }
  return serialiseFlex(node);
}

function serialiseLeaf(node: LeafNode): SerialLeafNode {
  return filterUndefined<SerialLeafNode>({
    kind: "leaf",
    key: node.key ?? undefined,
    width: node.width,
    height: node.height,
    flex: node.flex,
    alignSelf: node.alignSelf ?? undefined,
    transition: node.transition ?? undefined,
    transform: node.transform ?? undefined,
  });
}

function serialiseFlex(node: FlexNode): SerialFlexNode {
  return filterUndefined<SerialFlexNode>({
    kind: "flex",
    key: node.key ?? undefined,
    direction: node.direction,
    justify: node.justify,
    align: node.align,
    padding: node.padding,
    gap: node.gap,
    width: node.width,
    height: node.height,
    flex: node.flex,
    alignSelf: node.alignSelf ?? undefined,
    transition: node.transition ?? undefined,
    transform: node.transform ?? undefined,
    // Emit `mode` only when it's non-default so the JSON stays terse
    // for the common case.
    mode: node.mode.kind === "flow" ? undefined : node.mode,
    children: node.children.map(serializeTree),
    absolute: node.absolute.map(serialiseAbsolute),
  });
}

function serialiseAbsolute(child: AbsoluteChild): SerialAbsoluteChild {
  if (!isAnchorPlace(child.place)) {
    throw new Error(
      "serializeTree: absolute child has a non-anchor place(). " +
        "Use placeAnchor() so the placement can round-trip through JSON.",
    );
  }
  const meta = child.place.__anchor;
  const placement: SerialAnchorPlacement = {
    kind: "anchor",
    anchor: meta.anchor,
    insetX: meta.insetX,
    insetY: meta.insetY,
    ...(meta.outerWidth !== undefined ? { outerWidth: meta.outerWidth } : {}),
    ...(meta.outerHeight !== undefined ? { outerHeight: meta.outerHeight } : {}),
  };
  return {
    node: serializeTree(child.node),
    placement,
  };
}

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
export function hydrateTree(
  serial: SerialNode,
  bindings: LeafBindings = {},
  existing: LayoutNode | null = null,
): LayoutNode {
  const existingIndex = existing ? indexByKey(existing) : new Map<string, LayoutNode>();
  return hydrateNode(serial, bindings, existingIndex);
}

function hydrateNode(
  serial: SerialNode,
  bindings: LeafBindings,
  existing: Map<string, LayoutNode>,
): LayoutNode {
  if (serial.kind === "leaf") {
    return hydrateLeaf(serial, bindings, existing);
  }
  return hydrateFlex(serial, bindings, existing);
}

function hydrateLeaf(
  serial: SerialLeafNode,
  bindings: LeafBindings,
  existing: Map<string, LayoutNode>,
): LeafNode {
  const onRect = serial.key !== undefined ? bindings[serial.key] ?? null : null;
  const reused = reuseLeaf(serial.key, existing);
  if (reused) {
    reused.width = serial.width;
    reused.height = serial.height;
    reused.flex = serial.flex;
    reused.alignSelf = serial.alignSelf ?? null;
    reused.transition = serial.transition ?? null;
    reused.transform = serial.transform ?? null;
    reused.onRect = onRect;
    return reused;
  }
  return leaf({
    key: serial.key,
    width: serial.width,
    height: serial.height,
    flex: serial.flex,
    alignSelf: serial.alignSelf,
    transition: serial.transition,
    transform: serial.transform,
    onRect: onRect ?? (() => undefined),
  });
}

function hydrateFlex(
  serial: SerialFlexNode,
  bindings: LeafBindings,
  existing: Map<string, LayoutNode>,
): FlexNode {
  const onRect = serial.key !== undefined ? bindings[serial.key] ?? null : null;
  const reused = reuseFlex(serial.key, existing);
  const children = serial.children.map((child) => hydrateNode(child, bindings, existing));
  const absolute: AbsoluteChild[] = serial.absolute.map((abs) => ({
    node: hydrateNode(abs.node, bindings, existing),
    place: placeAnchor(abs.placement.anchor, {
      x: abs.placement.insetX,
      y: abs.placement.insetY,
      outerWidth: abs.placement.outerWidth,
      outerHeight: abs.placement.outerHeight,
    }),
  }));

  const mode = serial.mode ?? { kind: "flow" as const };
  if (reused) {
    reused.direction = serial.direction;
    reused.justify = serial.justify;
    reused.align = serial.align;
    reused.padding = normaliseEdge(serial.padding);
    reused.gap = serial.gap;
    reused.width = serial.width;
    reused.height = serial.height;
    reused.flex = serial.flex;
    reused.alignSelf = serial.alignSelf ?? null;
    reused.transition = serial.transition ?? null;
    reused.transform = serial.transform ?? null;
    reused.onRect = onRect;
    reused.mode = mode;
    reused.children = children;
    reused.absolute = absolute;
    return reused;
  }

  return flexBox({
    key: serial.key,
    direction: serial.direction,
    justify: serial.justify,
    align: serial.align,
    padding: serial.padding,
    gap: serial.gap,
    width: serial.width,
    height: serial.height,
    flex: serial.flex,
    alignSelf: serial.alignSelf,
    transition: serial.transition,
    transform: serial.transform,
    onRect: onRect ?? undefined,
    mode,
    children,
    absolute,
  });
}

function reuseLeaf(
  key: string | undefined,
  index: Map<string, LayoutNode>,
): LeafNode | null {
  if (key === undefined) {
    return null;
  }
  const existing = index.get(key);
  if (!existing || existing.kind !== "leaf") {
    return null;
  }
  return existing;
}

function reuseFlex(
  key: string | undefined,
  index: Map<string, LayoutNode>,
): FlexNode | null {
  if (key === undefined) {
    return null;
  }
  const existing = index.get(key);
  if (!existing || existing.kind !== "flex") {
    return null;
  }
  return existing;
}

/** Walks `node` and returns every node that carries a non-empty `key`. */
function indexByKey(node: LayoutNode): Map<string, LayoutNode> {
  const out = new Map<string, LayoutNode>();
  walk(node, out);
  return out;
}

function walk(node: LayoutNode, into: Map<string, LayoutNode>): void {
  if (node.key !== null) {
    into.set(node.key, node);
  }
  if (node.kind === "flex") {
    for (const child of node.children) {
      walk(child, into);
    }
    for (const abs of node.absolute) {
      walk(abs.node, into);
    }
  }
}

/**
 * JSON.stringify omits explicit `undefined` values anyway, but
 * constructing the object with explicit `key: undefined` fields
 * means the runtime shape has more noise than the author's source.
 * This helper yields a minimal literal.
 */
function filterUndefined<T extends object>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}
