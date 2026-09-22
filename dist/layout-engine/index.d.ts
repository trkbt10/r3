/**
 * @file r3 layout engine — public entry point.
 *
 * A small Yoga-flavoured flex layout system for r3. Build a tree of
 * {@link flexBox} + {@link leaf} nodes, hand it to a
 * {@link LayoutRuntime}, and every layout change — authored tweak or
 * viewport resize — animates through the shared r3 tween system.
 *
 * ## Position in the layout stack
 *
 * This module is the placement primitive every r3 scene's chrome
 * should compose against. It lays out into whatever viewport size the
 * host application derives — typically a {@link "../screen/index.ts".Screen}'s
 * width/height/viewbox — and host-specific reservations (band
 * heights, safe-area gaps) are the host's own layer on top of the
 * trees this module builds. Sandbox / one-off fixtures may use
 * one-shot helpers (e.g. {@link arrangeOneShot}) when they don't need
 * an animated tree.
 *
 * ## Quickstart
 *
 * ```ts
 * import { flexBox, leaf, LayoutRuntime, bindPosition } from "@trkbt10/r3/layout-engine";
 *
 * const menuBtn = createMenuButton(...); // r3 widget
 * const topBand = flexBox({
 *   direction: "row",
 *   padding: 16,
 *   gap: 8,
 *   justify: "space-between",
 *   align: "start",
 *   children: [
 *     leaf({ width: 44, height: 44, onRect: bindPosition(menuBtn.node) }),
 *     leaf({ width: 300, height: 44, flex: 1, onRect: bindPosition(campaignBadge.node) }),
 *     leaf({ width: 180, height: 44, onRect: bindPosition(walletBadge.node) }),
 *   ],
 * });
 *
 * const runtime = new LayoutRuntime({
 *   root: flexBox({ direction: "column", width: 1280, height: 720, children: [topBand] }),
 *   viewport: { x: 0, y: 0, width: 1280, height: 720 },
 *   defaultTransition: { durationMs: 200, easing: "Cubic.easeInOut" },
 * });
 *
 * stage.onUpdate((dtMs) => runtime.tick(dtMs));
 *
 * // later — any authored field change on any node:
 * topBand.padding = { top: 24, right: 24, bottom: 24, left: 24 };
 * runtime.relayout();  // every affected widget tweens into place
 * ```
 *
 * ## Concepts at a glance
 *
 *   - **flexBox**: container node. Carries direction, justify, align,
 *     padding, gap, outer size, optional flow `children`, and
 *     optional `absolute` children placed by a `place` function.
 *   - **leaf**: terminal node. Authored `width`/`height` (pixel or
 *     `"auto"`) plus an `onRect` callback that writes the computed
 *     rect to a real widget.
 *   - **spacer**: a leaf with no callback, used to consume space.
 *   - **absolute**: wraps a child so it pins to a corner / edge of
 *     the parent via `placeAnchor` (or a bespoke function). Absolute
 *     children are excluded from flex distribution.
 *   - **Transition**: every animated node may carry its own; if it
 *     doesn't, the runtime falls back to its `defaultTransition`.
 *   - **Identity**: nodes are mutable objects. The runtime uses
 *     object identity to correlate an animated node across
 *     relayouts, so callers should hold onto node references if they
 *     want animated retargeting.
 *
 * ## What this engine is NOT
 *
 *   - Not a CSS-complete implementation: no percent sizing, no
 *     wrapping, no min/max, no margin (use padding + gap).
 *   - Not reactive: layout never recomputes on its own. Call
 *     {@link LayoutRuntime.relayout} after mutating authored fields,
 *     or {@link LayoutRuntime.setRoot} to swap the tree.
 *   - Not a scene graph: the engine never touches r3 nodes directly.
 *     Every write goes through the leaf's `onRect` callback. Use the
 *     helpers in `./r3-binding.ts` or roll your own.
 */
export { flexBox, leaf, spacer, absolute, placeAnchor, isAnchorPlace, DEFAULT_FLEX_MODE, type AnchorName, type AnchorMeta, type AnchorPlaceFn, type AbsoluteChild, type FlexMode, type FlexNode, type LeafNode, type LayoutNode, type FlexBoxOptions, type LeafOptions, type SpacerOptions, type OnRect, } from './nodes.ts';
export { serializeTree, hydrateTree, type SerialNode, type SerialFlexNode, type SerialLeafNode, type SerialAbsoluteChild, type SerialAnchorPlacement, type LeafBindings, } from './serialize.ts';
export { LayoutRuntime, type LayoutRuntimeOptions, } from './runtime.ts';
export { LayoutKeyRegistry, type LayoutTargetRegistry, type LayoutTargetSnapshot, } from './registry.ts';
export { SceneResponsiveLayout, type SceneResponsiveLayoutOptions, } from './SceneResponsiveLayout.ts';
export { arrangeTree, type ArrangeVisitor, } from './arrange.ts';
export { arrangeOneShot, type ArrangeOneShotOptions, } from './oneshot.ts';
export { measureNode } from './measure.ts';
export { containedRectWithin, type ContainedRectAlignment, type ContainedRectOptions, } from './containedRect.ts';
export { bindPosition, bindRect, bindPositionAndSize, applyLayoutTransform, nodeLocalRectWorldBounds, layoutTransformMatrix, type PositionAndSizeTarget, } from './r3-binding.ts';
export { INSTANT, normaliseEdge, edgeHorizontal, edgeVertical, type LayoutRect, type LayoutFrame, type Size, type SizeValue, type EdgeBox, type EdgeInput, type FlexDirection, type JustifyContent, type AlignItems, type Transition, type LayoutPoint, type LayoutTransform, type LayoutVanishingPoint, type LayoutVanishingPointAxis, type LayoutVanishingPointPreset, type LayoutVanishingPointPresets, type LayoutVanishingPointProjection, } from './types.ts';
export { LayoutEditor, installLayoutEditorOverlay, LAYOUT_EDITOR_OVERLAY_DEPTH, ALL_HANDLES as LAYOUT_EDITOR_HANDLES, HANDLE_SIZE as LAYOUT_EDITOR_HANDLE_SIZE, handleRect, pointToInsets, resizeRect, snapTo, type AnchorPlacement, type EditorEvents as LayoutEditorEvents, type EditorState as LayoutEditorState, type EditorViewport as LayoutEditorViewport, type LayoutEditorHost, type LayoutEditorOptions, type LayoutEditorOverlayHandle, type LayoutEditorOverlayOptions, type ResizeHandle as LayoutResizeHandle, type SkipKeyPredicate as LayoutEditorSkipKey, } from './editor';
