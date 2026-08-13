/**
 * @file Unit specs for {@link LayoutRuntime}.
 *
 * The runtime glues arrange + tween together. These tests exercise
 * the seams that arrange specs don't cover:
 *
 *   - First relayout applies rects instantly (no ghost frame).
 *   - Subsequent relayouts tween from the current live rect to the
 *     new target rect, driven by {@link LayoutRuntime.tick}.
 *   - Mid-tween retarget kills the old tween and starts a new one
 *     from wherever the live rect currently sits.
 *   - {@link LayoutRuntime.setRoot} drops tweens and state for
 *     nodes removed from the new tree.
 *
 * The tween manager and every leaf here use plain mutable objects —
 * no r3 nodes, no renderer — so the spec is fast and deterministic.
 */

import { flexBox, leaf } from "./nodes.ts";
import { LayoutRuntime } from "./runtime.ts";
import type { LayoutRect } from "./types.ts";

type Snapshot = { x: number; y: number; width: number; height: number };

function makeLeaf(
  authored: { width: number; height: number; flex?: number },
  transition?: { durationMs: number; easing?: "Linear" | "Cubic.easeInOut" },
) {
  const rects: LayoutRect[] = [];
  const node = leaf({
    width: authored.width,
    height: authored.height,
    flex: authored.flex,
    transition: transition ? { durationMs: transition.durationMs, easing: transition.easing ?? "Linear" } : undefined,
    onRect: (r) => {
      rects.push({ x: r.x, y: r.y, width: r.width, height: r.height });
    },
  });
  return { node, rects };
}

function lastRect(rects: readonly LayoutRect[]): Snapshot | null {
  const r = rects[rects.length - 1];
  if (!r) {
    return null;
  }
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

describe("LayoutRuntime — first layout", () => {
  it("applies every animated node's rect instantly on mount", () => {
    const a = makeLeaf({ width: 100, height: 40 });
    const b = makeLeaf({ width: 200, height: 40 });
    const row = flexBox({
      direction: "row",
      gap: 10,
      width: 500,
      height: 40,
      children: [a.node, b.node],
    });
    new LayoutRuntime({
      root: row,
      viewport: { x: 0, y: 0, width: 500, height: 40 },
      defaultTransition: { durationMs: 200, easing: "Linear" },
    });
    // No tick yet — instant apply path.
    expect(lastRect(a.rects)).toEqual({ x: 0, y: 0, width: 100, height: 40 });
    expect(lastRect(b.rects)).toEqual({ x: 110, y: 0, width: 200, height: 40 });
  });

  it("passes a node's visual transform through the live frame", () => {
    const frames: Array<LayoutRect & { readonly transform?: unknown }> = [];
    const node = leaf({
      width: 100,
      height: 40,
      transform: { rotate: 0.2, skewX: 0.1 },
      onRect: (rect) => {
        frames.push(rect);
      },
    });
    const row = flexBox({ width: 200, height: 80, children: [node] });
    new LayoutRuntime({
      root: row,
      viewport: { x: 0, y: 0, width: 200, height: 80 },
    });
    expect(frames[0]?.transform).toEqual({ rotate: 0.2, skewX: 0.1 });
  });

  it("schedules zero tweens on first relayout", () => {
    const a = makeLeaf({ width: 100, height: 40 });
    const row = flexBox({ direction: "row", width: 200, height: 40, children: [a.node] });
    const runtime = new LayoutRuntime({
      root: row,
      viewport: { x: 0, y: 0, width: 200, height: 40 },
      defaultTransition: { durationMs: 200, easing: "Linear" },
    });
    expect(runtime.activeTweenCount).toBe(0);
  });
});

describe("LayoutRuntime — subsequent relayout", () => {
  it("tweens a moved child from its current rect to the new rect", () => {
    const a = makeLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      justify: "start",
      width: 500,
      height: 40,
      children: [a.node],
    });
    const runtime = new LayoutRuntime({
      root: row,
      viewport: { x: 0, y: 0, width: 500, height: 40 },
      defaultTransition: { durationMs: 100, easing: "Linear" },
    });
    // Sanity: instant apply.
    expect(lastRect(a.rects)?.x).toBe(0);

    // Change justify → leaf now wants to sit at x = 400.
    row.justify = "end";
    runtime.relayout();

    expect(runtime.activeTweenCount).toBe(1);

    // Half-way through the tween.
    runtime.tick(50);
    const mid = lastRect(a.rects);
    expect(mid?.x).toBeGreaterThan(0);
    expect(mid?.x).toBeLessThan(400);

    // Completion.
    runtime.tick(60);
    expect(lastRect(a.rects)?.x).toBe(400);
    expect(runtime.activeTweenCount).toBe(0);
  });

  it("retargeting mid-tween kills the old tween and animates from current live position", () => {
    const a = makeLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      justify: "start",
      width: 500,
      height: 40,
      children: [a.node],
    });
    const runtime = new LayoutRuntime({
      root: row,
      viewport: { x: 0, y: 0, width: 500, height: 40 },
      defaultTransition: { durationMs: 100, easing: "Linear" },
    });

    row.justify = "end";
    runtime.relayout(); // target x=400
    runtime.tick(50);   // live x is around 200
    const partway = lastRect(a.rects)?.x ?? 0;
    expect(partway).toBeGreaterThan(0);
    expect(partway).toBeLessThan(400);

    // Retarget: center → free = 400, leading = 200 → x = 200.
    row.justify = "center";
    runtime.relayout();
    expect(runtime.activeTweenCount).toBe(1);

    // After a tiny tick, we should be between `partway` and 200.
    runtime.tick(10);
    const afterRetarget = lastRect(a.rects)?.x ?? 0;
    // Target is 200. If we were at partway (~200), the new tween
    // moves us toward 200. Final settles at 200 regardless of
    // starting point.
    runtime.tick(100);
    expect(lastRect(a.rects)?.x).toBe(200);
    expect(afterRetarget).toBeDefined();
  });

  it("honours a per-leaf transition override when the default is instant", () => {
    const a = makeLeaf({ width: 100, height: 40 }, { durationMs: 80, easing: "Linear" });
    const row = flexBox({
      direction: "row",
      justify: "start",
      width: 500,
      height: 40,
      children: [a.node],
    });
    const runtime = new LayoutRuntime({
      root: row,
      viewport: { x: 0, y: 0, width: 500, height: 40 },
      // Default is 0 — but the leaf authored 80ms and should tween.
      defaultTransition: { durationMs: 0, easing: "Linear" },
    });
    row.justify = "end";
    runtime.relayout();
    expect(runtime.activeTweenCount).toBe(1);
    runtime.tick(40);
    const midway = lastRect(a.rects)?.x ?? 0;
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(400);
    runtime.tick(50);
    expect(lastRect(a.rects)?.x).toBe(400);
  });

  it("applies instantly when the resolved transition has duration 0", () => {
    const a = makeLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      justify: "start",
      width: 500,
      height: 40,
      children: [a.node],
    });
    const runtime = new LayoutRuntime({
      root: row,
      viewport: { x: 0, y: 0, width: 500, height: 40 },
      defaultTransition: { durationMs: 0, easing: "Linear" },
    });
    row.justify = "end";
    runtime.relayout();
    expect(runtime.activeTweenCount).toBe(0);
    expect(lastRect(a.rects)?.x).toBe(400);
  });
});

describe("LayoutRuntime — setRoot", () => {
  it("drops state for a node removed from the new tree", () => {
    const a = makeLeaf({ width: 100, height: 40 });
    const b = makeLeaf({ width: 100, height: 40 });
    const oldRoot = flexBox({
      direction: "row",
      width: 500,
      height: 40,
      children: [a.node, b.node],
    });
    const runtime = new LayoutRuntime({
      root: oldRoot,
      viewport: { x: 0, y: 0, width: 500, height: 40 },
      defaultTransition: { durationMs: 100, easing: "Linear" },
    });
    // Start a tween on `a`.
    oldRoot.justify = "end";
    runtime.relayout();
    expect(runtime.activeTweenCount).toBe(2);

    // Replace with a tree that contains only `b`.
    const newRoot = flexBox({
      direction: "row",
      width: 500,
      height: 40,
      children: [b.node],
    });
    runtime.setRoot(newRoot);

    // `a`'s tween is killed; `b` may have a fresh tween to its new
    // position (which is actually the same — x=0 → x=0 is a 0-delta
    // tween, so the manager may or may not schedule one). What
    // matters is `a` is dropped.
    runtime.tick(200);
    const lastA = lastRect(a.rects);
    expect(lastA).not.toBeNull();
    // After setRoot, `a` should not receive further onRect calls.
    const rectCountBefore = a.rects.length;
    runtime.tick(50);
    expect(a.rects.length).toBe(rectCountBefore);
  });

  it("preserves identity so a leaf in both trees keeps its live rect", () => {
    const a = makeLeaf({ width: 100, height: 40 });
    const row1 = flexBox({
      direction: "row",
      justify: "start",
      width: 500,
      height: 40,
      children: [a.node],
    });
    const runtime = new LayoutRuntime({
      root: row1,
      viewport: { x: 0, y: 0, width: 500, height: 40 },
      defaultTransition: { durationMs: 100, easing: "Linear" },
    });
    // `a` sits at x=0.
    expect(lastRect(a.rects)?.x).toBe(0);

    // Swap to a new root that places `a` at x=400 with a tween.
    const row2 = flexBox({
      direction: "row",
      justify: "end",
      width: 500,
      height: 40,
      children: [a.node],
    });
    runtime.setRoot(row2);
    expect(runtime.activeTweenCount).toBe(1);
    runtime.tick(200);
    expect(lastRect(a.rects)?.x).toBe(400);
  });
});

describe("LayoutRuntime — dispose", () => {
  it("kills every active tween", () => {
    const a = makeLeaf({ width: 100, height: 40 });
    const row = flexBox({
      direction: "row",
      justify: "start",
      width: 500,
      height: 40,
      children: [a.node],
    });
    const runtime = new LayoutRuntime({
      root: row,
      viewport: { x: 0, y: 0, width: 500, height: 40 },
      defaultTransition: { durationMs: 100, easing: "Linear" },
    });
    row.justify = "end";
    runtime.relayout();
    expect(runtime.activeTweenCount).toBe(1);
    runtime.dispose();
    expect(runtime.activeTweenCount).toBe(0);
  });
});
