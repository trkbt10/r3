/**
 * @file Unit specs for the arrange pass.
 *
 * These tests hit the pure layout math — no r3 nodes, no tween
 * manager. We arrange a tree inside a fixed viewport and collect
 * every leaf's final rect through the visitor; the specs then assert
 * concrete pixel values. Keeping the assertions numeric (rather than
 * relative) makes regression diffs read as "cell X moved from Y1 to
 * Y2" instead of "something shifted".
 */

import { flexBox, leaf, spacer, absolute, placeAnchor, type LayoutNode } from "./nodes.ts";
import { arrangeTree } from "./arrange.ts";
import { measureNode } from "./measure.ts";
import type { LayoutRect } from "./types.ts";

/**
 * Arranges a tree using the root's intrinsic size as the outer rect.
 * Every test below authors explicit root dimensions, so this keeps
 * the assertions framed against the node's own coords (0, 0) instead
 * of a synthetic viewport offset.
 */
function collectRects(root: LayoutNode, rect?: LayoutRect): Map<LayoutNode, LayoutRect> {
  const effective =
    rect ??
    (() => {
      const size = measureNode(root);
      return { x: 0, y: 0, width: size.width, height: size.height };
    })();
  const out = new Map<LayoutNode, LayoutRect>();
  arrangeTree(root, effective, (node, r) => {
    out.set(node, r);
  });
  return out;
}

function stubLeaf(size: { width: number; height: number }, extra: Partial<Parameters<typeof leaf>[0]> = {}) {
  return leaf({
    width: size.width,
    height: size.height,
    onRect: () => {},
    ...extra,
  });
}

describe("arrange — row flow", () => {
  it("justify:start packs children to the left and honours gap", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const b = stubLeaf({ width: 150, height: 40 });
    const c = stubLeaf({ width: 50, height: 40 });
    const row = flexBox({
      direction: "row",
      justify: "start",
      align: "start",
      gap: 10,
      width: 600,
      height: 60,
      children: [a, b, c],
    });
    const rects = collectRects(row);
    expect(rects.get(a)).toEqual({ x: 0, y: 0, width: 100, height: 40 });
    expect(rects.get(b)).toEqual({ x: 110, y: 0, width: 150, height: 40 });
    expect(rects.get(c)).toEqual({ x: 270, y: 0, width: 50, height: 40 });
  });

  it("padding shrinks the inner rect and offsets all flow children", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      padding: { top: 10, left: 20, right: 20, bottom: 10 },
      width: 300,
      height: 80,
      children: [a],
    });
    const rects = collectRects(row);
    expect(rects.get(a)).toEqual({ x: 20, y: 10, width: 100, height: 40 });
  });

  it("justify:space-between puts first child at start, last at end", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const b = stubLeaf({ width: 100, height: 40 });
    const c = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      justify: "space-between",
      width: 600,
      height: 60,
      children: [a, b, c],
    });
    const rects = collectRects(row);
    expect(rects.get(a)?.x).toBe(0);
    expect(rects.get(c)?.x).toBe(500);
    const middleX = rects.get(b)?.x ?? 0;
    expect(middleX).toBeGreaterThan(0);
    expect(middleX).toBeLessThan(500);
    // Equal gap either side.
    const gapLeft = middleX - 100;
    const gapRight = 500 - (middleX + 100);
    expect(Math.abs(gapLeft - gapRight)).toBeLessThanOrEqual(1);
  });

  it("justify:center centres the whole pack", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const b = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      justify: "center",
      gap: 20,
      width: 400,
      height: 60,
      children: [a, b],
    });
    const rects = collectRects(row);
    // Total children + gap = 220. Free = 180, half = 90.
    expect(rects.get(a)?.x).toBe(90);
    expect(rects.get(b)?.x).toBe(210);
  });

  it("justify:end right-aligns the whole pack", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const b = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      justify: "end",
      gap: 10,
      width: 400,
      height: 60,
      children: [a, b],
    });
    const rects = collectRects(row);
    expect(rects.get(b)?.x).toBe(300);
    expect(rects.get(a)?.x).toBe(190);
  });

  it("justify:space-around halves the edge gap", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const b = stubLeaf({ width: 100, height: 40 });
    const c = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      justify: "space-around",
      width: 600,
      height: 60,
      children: [a, b, c],
    });
    const rects = collectRects(row);
    // free = 300; per-item share = 100; half-share leading = 50.
    expect(rects.get(a)?.x).toBe(50);
    expect(rects.get(b)?.x).toBe(250);
    expect(rects.get(c)?.x).toBe(450);
  });

  it("justify:space-evenly distributes equal gaps including edges", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const b = stubLeaf({ width: 100, height: 40 });
    const c = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      justify: "space-evenly",
      width: 600,
      height: 60,
      children: [a, b, c],
    });
    const rects = collectRects(row);
    // free = 300; per-edge = 300 / 4 = 75.
    expect(rects.get(a)?.x).toBe(75);
    expect(rects.get(b)?.x).toBe(250);
    expect(rects.get(c)?.x).toBe(425);
  });
});

describe("arrange — align (cross axis)", () => {
  it("align:start sits children on the top edge", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({ direction: "row", align: "start", width: 200, height: 200, children: [a] });
    expect(collectRects(row).get(a)?.y).toBe(0);
  });

  it("align:center centres cross-axis", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({ direction: "row", align: "center", width: 200, height: 200, children: [a] });
    expect(collectRects(row).get(a)?.y).toBe(80);
  });

  it("align:end pins to the bottom edge", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({ direction: "row", align: "end", width: 200, height: 200, children: [a] });
    expect(collectRects(row).get(a)?.y).toBe(160);
  });

  it("align:stretch expands cross-axis to the container's inner height", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      align: "stretch",
      padding: 10,
      width: 200,
      height: 200,
      children: [a],
    });
    const rect = collectRects(row).get(a);
    expect(rect?.height).toBe(180);
    expect(rect?.y).toBe(10);
  });

  it("alignSelf overrides container align per child", () => {
    const a = stubLeaf({ width: 100, height: 40 }, { alignSelf: "end" });
    const b = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      align: "start",
      gap: 10,
      width: 400,
      height: 200,
      children: [a, b],
    });
    const rects = collectRects(row);
    expect(rects.get(a)?.y).toBe(160);
    expect(rects.get(b)?.y).toBe(0);
  });
});

describe("arrange — flex weights", () => {
  it("distributes free space proportionally when any child flexes", () => {
    const fixed = stubLeaf({ width: 100, height: 40 });
    const flexA = stubLeaf({ width: 0, height: 40 }, { flex: 1 });
    const flexB = stubLeaf({ width: 0, height: 40 }, { flex: 2 });
    const row = flexBox({
      direction: "row",
      width: 400,
      height: 60,
      children: [fixed, flexA, flexB],
    });
    const rects = collectRects(row);
    // Free = 400 - 100 = 300. flexA = 100, flexB = 200.
    expect(rects.get(fixed)?.width).toBe(100);
    expect(rects.get(flexA)?.width).toBe(100);
    expect(rects.get(flexB)?.width).toBe(200);
    expect(rects.get(fixed)?.x).toBe(0);
    expect(rects.get(flexA)?.x).toBe(100);
    expect(rects.get(flexB)?.x).toBe(200);
  });

  it("column direction distributes along the y axis", () => {
    const a = stubLeaf({ width: 40, height: 0 }, { flex: 1 });
    const b = stubLeaf({ width: 40, height: 0 }, { flex: 1 });
    const col = flexBox({
      direction: "column",
      width: 100,
      height: 200,
      children: [a, b],
    });
    const rects = collectRects(col);
    expect(rects.get(a)?.height).toBe(100);
    expect(rects.get(b)?.height).toBe(100);
    expect(rects.get(a)?.y).toBe(0);
    expect(rects.get(b)?.y).toBe(100);
  });

  it("a spacer with flex:1 eats the middle gap", () => {
    const a = stubLeaf({ width: 100, height: 40 });
    const sp = spacer({ flex: 1 });
    const b = stubLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      width: 400,
      height: 60,
      children: [a, sp, b],
    });
    const rects = collectRects(row);
    expect(rects.get(a)?.x).toBe(0);
    expect(rects.get(b)?.x).toBe(300);
  });
});

describe("arrange — absolute children", () => {
  it("places an absolute child via placeAnchor ignoring flow sizing", () => {
    const flow = stubLeaf({ width: 100, height: 40 });
    const tag = stubLeaf({ width: 60, height: 20 });
    const container = flexBox({
      direction: "row",
      width: 400,
      height: 200,
      children: [flow],
      absolute: [absolute({ node: tag, place: placeAnchor("bottom-right", { x: 10, y: 10 }) })],
    });
    const rects = collectRects(container);
    expect(rects.get(flow)?.x).toBe(0); // unaffected
    expect(rects.get(tag)).toEqual({
      x: 400 - 10 - 60,
      y: 200 - 10 - 20,
      width: 60,
      height: 20,
    });
  });

  it("placeAnchor:top-center centres horizontally", () => {
    const tag = stubLeaf({ width: 60, height: 20 });
    const container = flexBox({
      direction: "row",
      width: 400,
      height: 200,
      absolute: [absolute({ node: tag, place: placeAnchor("top-center") })],
    });
    const rect = collectRects(container).get(tag);
    expect(rect?.x).toBe(Math.round((400 - 60) / 2));
    expect(rect?.y).toBe(0);
  });
});

describe("arrange — auto sizing (nested contribution)", () => {
  it("auto-sized inner flex contributes its intrinsic width to parent distribution", () => {
    // Inner row auto-sizes to 100 + 10 + 100 = 210, no padding.
    const innerA = stubLeaf({ width: 100, height: 40 });
    const innerB = stubLeaf({ width: 100, height: 40 });
    const inner = flexBox({
      direction: "row",
      gap: 10,
      width: "auto",
      height: 40,
      children: [innerA, innerB],
    });
    // Outer row: fixed leading 50 + inner + flex spacer + trailing 50.
    const leading = stubLeaf({ width: 50, height: 40 });
    const sp = spacer({ flex: 1 });
    const trailing = stubLeaf({ width: 50, height: 40 });
    const outer = flexBox({
      direction: "row",
      width: 500,
      height: 40,
      children: [leading, inner, sp, trailing],
    });
    const rects = collectRects(outer);
    // 500 − (50 + 210 + 50) = 190 of flex space absorbed by the spacer.
    expect(rects.get(leading)?.x).toBe(0);
    expect(rects.get(inner)?.x).toBe(50);
    expect(rects.get(inner)?.width).toBe(210);
    expect(rects.get(trailing)?.x).toBe(450);
    // Inner children arranged within the inner rect.
    expect(rects.get(innerA)?.x).toBe(50);
    expect(rects.get(innerB)?.x).toBe(160);
  });
});
