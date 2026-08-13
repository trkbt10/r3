/**
 * @file Specs for flex-with-mode — the "layout applied recursively"
 * primitive. A flex with `mode: { kind: "flow" }` reflows its
 * children against any outer rect the parent allocates. A flex with
 * `mode: { kind: "scale", fit: ... }` arranges children against its
 * own authored `width × height` (natural coords) and transforms the
 * emitted rects to fit the outer rect. Both compose transparently
 * under nesting because the arrange visitor stacks.
 */

import { flexBox, leaf, type LayoutNode } from "./nodes.ts";
import { arrangeTree } from "./arrange.ts";
import { measureNode } from "./measure.ts";
import type { LayoutRect } from "./types.ts";

function collect(root: LayoutNode, rect?: LayoutRect): Map<LayoutNode, LayoutRect> {
  const outer =
    rect ??
    (() => {
      const size = measureNode(root);
      return { x: 0, y: 0, width: size.width, height: size.height };
    })();
  const out = new Map<LayoutNode, LayoutRect>();
  arrangeTree(root, outer, (n, r) => out.set(n, r));
  return out;
}

function stubLeaf(w: number, h: number) {
  return leaf({ width: w, height: h, onRect: () => undefined });
}

describe("flex mode — flow (default)", () => {
  it("reflows internal children when the outer rect shrinks", () => {
    const a = stubLeaf(100, 40);
    const b = stubLeaf(100, 40);
    const c = stubLeaf(100, 40);
    const panel = flexBox({
      direction: "row",
      justify: "space-between",
      width: 600,
      height: 40,
      children: [a, b, c],
    });
    // Outer 600: space-between → [0..100, 250..350, 500..600]
    const wide = collect(panel);
    expect(wide.get(a)?.x).toBe(0);
    expect(wide.get(c)?.x).toBe(500);

    // Shrink to 400 wide: children reflow
    const narrow = collect(panel, { x: 0, y: 0, width: 400, height: 40 });
    expect(narrow.get(a)?.x).toBe(0);
    expect(narrow.get(c)?.x).toBe(300);
    expect(narrow.get(a)?.width).toBe(100);
    expect(narrow.get(c)?.width).toBe(100);
  });
});

describe("flex mode — scale (fill)", () => {
  it("arranges children in natural coords and scales into outer rect", () => {
    const a = stubLeaf(100, 40);
    const b = stubLeaf(100, 40);
    const panel = flexBox({
      direction: "row",
      gap: 20,
      width: 220,
      height: 40,
      mode: { kind: "scale", fit: "fill" },
      children: [a, b],
    });
    // Outer 440 × 80: scaleX = 2, scaleY = 2, no offset
    const rects = collect(panel, { x: 0, y: 0, width: 440, height: 80 });
    expect(rects.get(a)).toEqual({ x: 0, y: 0, width: 200, height: 80 });
    expect(rects.get(b)).toEqual({ x: 240, y: 0, width: 200, height: 80 });
  });

  it("offsets the outer origin through the transform", () => {
    const a = stubLeaf(50, 50);
    const panel = flexBox({
      width: 100,
      height: 100,
      mode: { kind: "scale", fit: "fill" },
      children: [a],
    });
    const rects = collect(panel, { x: 200, y: 300, width: 100, height: 100 });
    expect(rects.get(a)).toEqual({ x: 200, y: 300, width: 50, height: 50 });
  });
});

describe("flex mode — scale (contain)", () => {
  it("preserves aspect ratio and centres inside the outer rect", () => {
    const a = stubLeaf(100, 100);
    const panel = flexBox({
      width: 100,
      height: 100,
      mode: { kind: "scale", fit: "contain" },
      children: [a],
    });
    // Outer 200 × 100: unified = min(2, 1) = 1. Scaled content 100×100
    // centred horizontally inside 200 → offset x = 50.
    const rects = collect(panel, { x: 0, y: 0, width: 200, height: 100 });
    expect(rects.get(a)).toEqual({ x: 50, y: 0, width: 100, height: 100 });
  });
});

describe("flex mode — scale (cover)", () => {
  it("overfills preserving aspect ratio", () => {
    const a = stubLeaf(100, 100);
    const panel = flexBox({
      width: 100,
      height: 100,
      mode: { kind: "scale", fit: "cover" },
      children: [a],
    });
    // Outer 200 × 100: unified = max(2, 1) = 2. Scaled 200×200
    // overflows the outer vertically — offset y = -50.
    const rects = collect(panel, { x: 0, y: 0, width: 200, height: 100 });
    expect(rects.get(a)).toEqual({ x: 0, y: -50, width: 200, height: 200 });
  });
});

describe("flex mode — nested recursion", () => {
  it("outer scale and inner scale compose", () => {
    const a = stubLeaf(50, 50);
    const innerFlex = flexBox({
      width: 100,
      height: 100,
      mode: { kind: "scale", fit: "fill" },
      children: [a],
    });
    const outer = flexBox({
      width: 100,
      height: 100,
      mode: { kind: "scale", fit: "fill" },
      children: [innerFlex],
    });
    // Outer allocated 400×400: outer natural 100 → scale 4.
    // Inner natural 100, inner outer (in content coords of outer) 100
    // → scale 1. Leaf at (0,0,50,50) → inner wrap keeps (0,0,50,50)
    // → outer wrap × 4 → (0,0,200,200).
    const rects = collect(outer, { x: 0, y: 0, width: 400, height: 400 });
    expect(rects.get(a)).toEqual({ x: 0, y: 0, width: 200, height: 200 });
  });

  it("flow-inside-scale: inner reflows against its scaled allocation", () => {
    const a = stubLeaf(50, 50);
    const b = stubLeaf(50, 50);
    const inner = flexBox({
      direction: "row",
      justify: "space-between",
      width: 100,
      height: 50,
      children: [a, b],
    });
    // Outer is scale × 2. Inner is flow — it reflows within its
    // allocated content rect (0, 0, 100, 50). space-between at
    // width 100 with 2 leaves of 50 → a at x=0, b at x=50.
    // Outer scale 2 → viewport rects: a (0, 0, 100, 100) and
    // b (100, 0, 100, 100).
    const outer = flexBox({
      width: 100,
      height: 50,
      mode: { kind: "scale", fit: "fill" },
      children: [inner],
    });
    const rects = collect(outer, { x: 0, y: 0, width: 200, height: 100 });
    expect(rects.get(a)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(rects.get(b)).toEqual({ x: 100, y: 0, width: 100, height: 100 });
  });
});
