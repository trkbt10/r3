/**
 * @file LayoutNode tree constructors.
 *
 * Two node kinds: {@link FlexNode} (container) and {@link LeafNode}
 * (authored-size rectangle that reports its computed rect via a
 * callback). Both carry a stable identity by reference — the runtime
 * recognises "the same node" across relayouts by object identity, so
 * re-invoking {@link flexBox}/{@link leaf} produces a fresh,
 * un-tweened pair every time. Callers who want animation between
 * layouts must hold onto the returned instances.
 *
 * The returned objects expose their fields as `readonly` at the type
 * level but are physically mutable; the engine mutates computed state
 * internally and the author may also mutate authored fields (e.g.
 * `flexNode.padding = { ... }`) and call {@link LayoutRuntime.relayout}
 * to pick up the change without replacing the tree.
 */

import {
  INSTANT,
  normaliseEdge,
  type AlignItems,
  type EdgeBox,
  type EdgeInput,
  type FlexDirection,
  type JustifyContent,
  type LayoutRect,
  type LayoutFrame,
  type LayoutTransform,
  type Size,
  type SizeValue,
  type Transition,
} from "./types.ts";

export type OnRect = (rect: LayoutFrame) => void;

export type FlexBoxOptions = {
  /**
   * Optional stable identifier. Not used by the arrange or runtime
   * passes — they key state by object identity. The key is read by
   * {@link serialize.ts} to round-trip through JSON: a serialised
   * node carries its key; on hydrate the key lets the new tree match
   * its counterpart in the prior live tree so tween state survives
   * a reload.
   */
  readonly key?: string;
  /** Main axis. Defaults to `"row"`. */
  readonly direction?: FlexDirection;
  /** Main-axis distribution. Defaults to `"start"`. */
  readonly justify?: JustifyContent;
  /** Cross-axis alignment for all children. Defaults to `"start"`. */
  readonly align?: AlignItems;
  /** Padding (inner inset) applied to every edge. */
  readonly padding?: EdgeInput;
  /** Gap between successive flow children along the main axis. */
  readonly gap?: number;
  /** Outer width in pixels or `"auto"` to fit contents. Defaults to `"auto"`. */
  readonly width?: SizeValue;
  /** Outer height in pixels or `"auto"` to fit contents. Defaults to `"auto"`. */
  readonly height?: SizeValue;
  /** Flex weight within the parent's main axis (0 = no grow). */
  readonly flex?: number;
  /** Per-child cross-axis override of the parent's `align`. */
  readonly alignSelf?: AlignItems;
  /** Transition applied when this node's rect changes. */
  readonly transition?: Transition;
  /** Visual transform applied by r3 bindings after layout placement. */
  readonly transform?: LayoutTransform;
  /** Optional callback — fires with the node's own rect every time it changes. */
  readonly onRect?: OnRect;
  /** Flow children (participate in flex distribution). */
  readonly children?: readonly LayoutNode[];
  /**
   * Absolute-positioned children. These do NOT participate in the
   * main-axis or cross-axis distribution; the `place` callback
   * computes their rect from the parent's rect and the child's
   * intrinsic size, mirroring CSS `position: absolute` semantics.
   */
  readonly absolute?: readonly AbsoluteChild[];
  /**
   * Resize behaviour (flow vs scale). Defaults to `{ kind: "flow" }`.
   * Scale mode lets this flex act as a recursively-applied layout
   * whose internal arrangement is frozen against the authored size
   * and scaled into any outer rect the parent gives it.
   */
  readonly mode?: FlexMode;
};

export type LeafOptions = {
  /** Stable identifier (see {@link FlexBoxOptions.key}). */
  readonly key?: string;
  /** Authored outer width (pixels or `"auto"`). Default `"auto"`. */
  readonly width?: SizeValue;
  /** Authored outer height (pixels or `"auto"`). Default `"auto"`. */
  readonly height?: SizeValue;
  /** Flex weight within the parent's main axis. */
  readonly flex?: number;
  /** Per-child cross-axis override. */
  readonly alignSelf?: AlignItems;
  /** Transition applied when the leaf's rect changes. */
  readonly transition?: Transition;
  /** Visual transform applied by r3 bindings after layout placement. */
  readonly transform?: LayoutTransform;
  /** Callback invoked every time the live rect advances. */
  readonly onRect: OnRect;
};

export type SpacerOptions = Omit<LeafOptions, "onRect">;

export type AbsoluteChild = {
  readonly node: LayoutNode;
  /**
   * Given the parent's final rect and the child's intrinsic size,
   * returns the child's rect. Intentionally a function (not a static
   * offset) so callers can express corner anchors, proportional
   * offsets, or any bespoke pinning in one place.
   */
  readonly place: (parent: LayoutRect, intrinsic: Size) => LayoutRect;
};

export type FlexNode = {
  readonly kind: "flex";
  key: string | null;
  direction: FlexDirection;
  justify: JustifyContent;
  align: AlignItems;
  padding: EdgeBox;
  gap: number;
  width: SizeValue;
  height: SizeValue;
  flex: number;
  alignSelf: AlignItems | null;
  transition: Transition | null;
  transform: LayoutTransform | null;
  onRect: OnRect | null;
  /**
   * How this flex responds when its outer rect differs from its
   * authored content size. Default `{ kind: "flow" }`. Set to
   * `{ kind: "scale", fit: ... }` to render as a fixed-layout
   * canvas that scales into its parent allocation.
   */
  mode: FlexMode;
  children: LayoutNode[];
  absolute: AbsoluteChild[];
};

export type LeafNode = {
  readonly kind: "leaf";
  key: string | null;
  width: SizeValue;
  height: SizeValue;
  flex: number;
  alignSelf: AlignItems | null;
  transition: Transition | null;
  transform: LayoutTransform | null;
  onRect: OnRect | null;
};

/**
 * How a {@link FlexNode} responds when its outer rect diverges from
 * the authored content size. Conceptually modelled on CSS
 * `object-fit`:
 *
 *   - **flow** (default): the children are re-arranged against the
 *     outer rect. This is the classic HTML-flex behaviour — shrink
 *     the parent, items reflow.
 *   - **scale**: children are arranged against the flex's own
 *     authored `width × height` (treated as a natural content
 *     coordinate system), then emitted rects are transformed so
 *     the whole layout fits the outer rect per the chosen fit:
 *       - `contain`: preserve aspect ratio, fit entirely inside.
 *       - `cover`: preserve aspect ratio, fill (may overflow).
 *       - `fill`: non-uniform scale — fill the outer rect exactly.
 *
 * Every flex node carries a mode; this is the core "layout applied
 * recursively" primitive. Nested flex nodes compose without any
 * separate sub-layout concept — each level decides its own
 * flow/scale behaviour.
 */
export type FlexMode =
  | { readonly kind: "flow" }
  | {
      readonly kind: "scale";
      readonly fit: "contain" | "cover" | "fill";
    };

export const DEFAULT_FLEX_MODE: FlexMode = { kind: "flow" };

export type LayoutNode = FlexNode | LeafNode;

/** Constructs a flex container node. */
export function flexBox(options: FlexBoxOptions = {}): FlexNode {
  return {
    kind: "flex",
    key: options.key ?? null,
    direction: options.direction ?? "row",
    justify: options.justify ?? "start",
    align: options.align ?? "start",
    padding: normaliseEdge(options.padding),
    gap: options.gap ?? 0,
    width: options.width ?? "auto",
    height: options.height ?? "auto",
    flex: options.flex ?? 0,
    alignSelf: options.alignSelf ?? null,
    transition: options.transition ?? null,
    transform: options.transform ?? null,
    onRect: options.onRect ?? null,
    mode: options.mode ?? DEFAULT_FLEX_MODE,
    children: options.children ? options.children.slice() : [],
    absolute: options.absolute ? options.absolute.slice() : [],
  };
}

/**
 * Constructs a leaf node. A leaf does not have children; it is the
 * engine's "bind this rectangle to some r3 object" primitive. The
 * `onRect` callback is invoked on every tween tick — do not perform
 * heavy work inside it; write to the bound r3 node's position / size
 * and return.
 */
export function leaf(options: LeafOptions): LeafNode {
  return {
    kind: "leaf",
    key: options.key ?? null,
    width: options.width ?? "auto",
    height: options.height ?? "auto",
    flex: options.flex ?? 0,
    alignSelf: options.alignSelf ?? null,
    transition: options.transition ?? null,
    transform: options.transform ?? null,
    onRect: options.onRect,
  };
}

/**
 * Constructs an invisible leaf that only takes up space. Useful when
 * a section needs a flex gap wider than {@link FlexBoxOptions.gap} in
 * a single spot, or a full-width divider.
 */
export function spacer(options: SpacerOptions = {}): LeafNode {
  return {
    kind: "leaf",
    key: options.key ?? null,
    width: options.width ?? "auto",
    height: options.height ?? "auto",
    flex: options.flex ?? 0,
    alignSelf: options.alignSelf ?? null,
    transition: options.transition ?? INSTANT,
    transform: options.transform ?? null,
    onRect: null,
  };
}

/**
 * Wraps a node as an absolute-positioned child. The `place` callback
 * is called after the parent's rect has been finalised; its return is
 * the child's rect (overriding whatever the flex distribution would
 * have produced). See {@link placeAnchor} for the common preset.
 */
export function absolute(options: {
  readonly node: LayoutNode;
  readonly place: (parent: LayoutRect, intrinsic: Size) => LayoutRect;
}): AbsoluteChild {
  return { node: options.node, place: options.place };
}

export type AnchorName =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * Metadata attached to functions produced by {@link placeAnchor}.
 * Read by `./serialize.ts` so an anchor-based placement can round-trip
 * through JSON without introspecting closure variables.
 */
export type AnchorMeta = {
  readonly anchor: AnchorName;
  readonly insetX: number;
  readonly insetY: number;
  /**
   * Optional outer size override. When present, the place callback
   * returns a rect whose width/height come from the override instead
   * of the child's intrinsic size — useful when a scale-mode flex
   * wants its parent to allocate it a specific canvas size.
   */
  readonly outerWidth?: number;
  readonly outerHeight?: number;
};

/** A `place` callback that remembers how it was constructed. */
export type AnchorPlaceFn = ((parent: LayoutRect, intrinsic: Size) => LayoutRect) & {
  __anchor: AnchorMeta;
};

/**
 * Preset `place` function for {@link absolute}. Pins the child to one
 * of the parent's nine anchors with an optional inward inset (CSS-ish
 * "margin from the anchored edge" semantics). The returned function
 * also carries {@link AnchorMeta} under `__anchor` so the placement
 * survives a JSON round-trip via `./serialize.ts`.
 *
 * Pass `outerWidth` / `outerHeight` to force an allocation rect that
 * differs from the child's intrinsic size. The anchor side still
 * decides WHERE the rect sits, but the rect itself is the authored
 * size — this is what drives scale-mode flex nodes: the parent
 * allocates a specific outer canvas and the scale-mode flex projects
 * its natural content onto that canvas.
 */
export function placeAnchor(
  anchor: AnchorName,
  inset: {
    readonly x?: number;
    readonly y?: number;
    readonly outerWidth?: number;
    readonly outerHeight?: number;
  } = {},
): AnchorPlaceFn {
  const insetX = inset.x ?? 0;
  const insetY = inset.y ?? 0;
  const overrideW = inset.outerWidth;
  const overrideH = inset.outerHeight;
  const fn = ((parent: LayoutRect, intrinsic: Size): LayoutRect => {
    const width = overrideW ?? intrinsic.width;
    const height = overrideH ?? intrinsic.height;
    return {
      x: horizontalAnchorOffset(anchor, parent, { width, height }, insetX),
      y: verticalAnchorOffset(anchor, parent, { width, height }, insetY),
      width,
      height,
    };
  }) as AnchorPlaceFn;
  fn.__anchor = {
    anchor,
    insetX,
    insetY,
    outerWidth: overrideW,
    outerHeight: overrideH,
  };
  return fn;
}

/** Narrowing helper — detect placements authored via {@link placeAnchor}. */
export function isAnchorPlace(
  fn: (parent: LayoutRect, intrinsic: Size) => LayoutRect,
): fn is AnchorPlaceFn {
  return Object.prototype.hasOwnProperty.call(fn, "__anchor");
}

/** Horizontal edge resolution for {@link placeAnchor}. */
function horizontalAnchorOffset(
  anchor: AnchorName,
  parent: LayoutRect,
  intrinsic: Size,
  insetX: number,
): number {
  if (anchor.endsWith("-left")) {
    return parent.x + insetX;
  }
  if (anchor.endsWith("-right")) {
    return parent.x + parent.width - insetX - intrinsic.width;
  }
  return parent.x + Math.round((parent.width - intrinsic.width) / 2) + insetX;
}

/** Vertical edge resolution for {@link placeAnchor}. */
function verticalAnchorOffset(
  anchor: AnchorName,
  parent: LayoutRect,
  intrinsic: Size,
  insetY: number,
): number {
  if (anchor.startsWith("top-")) {
    return parent.y + insetY;
  }
  if (anchor.startsWith("bottom-")) {
    return parent.y + parent.height - insetY - intrinsic.height;
  }
  return parent.y + Math.round((parent.height - intrinsic.height) / 2) + insetY;
}
