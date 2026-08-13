// @vitest-environment happy-dom
/**
 * @file Rect — pivot / auto-hit-area alignment.
 *
 * Regression cover for the bug where `Rect`'s auto `setInteractive`
 * ignored pivot, so a centre-pivot Rect's visible mesh sat at
 * (-w/2, -h/2 .. w/2, h/2) in node-local coords while its hit rect
 * still started at (0, 0) — pointer hits landed w/2, h/2 south-east
 * of the visible button.
 *
 * The fix (`computeAutoHitArea`) anchors the hit rect at
 * `(-pivotX * w, -pivotY * h)` so it matches the mesh AABB.
 *
 * These tests pin that invariant from two angles:
 *
 *   1. Structural: the public `hitArea` getter reports exactly what
 *      the mesh math predicts for a given (w, h, pivot).
 *   2. Behavioural: PointerManager picks the corners of the visible
 *      plane and misses a pixel outside — end-to-end through the
 *      actual transform stack, so a future refactor that breaks the
 *      pivot→mesh or mesh→hit mapping shows up as a miss.
 *
 * The DOM environment (`happy-dom`) is required because Rect goes
 * through the r3 texture-canvas SSoT during `rebuild()`: on happy-dom
 * the SSoT falls back to `document.createElement("canvas")` because
 * happy-dom's OffscreenCanvas (if present) does not implement a usable
 * 2D context. Without a DOM the SSoT has no backend and throws at
 * construction.
 */

import { rasterCacheStats, trimCachedTextures } from "./TextureCache.ts";
import { Rect } from "./Rect.ts";
import { Stage } from "./Stage.ts";
import {
  DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE,
  defaultTextureManager,
  resetTextureCanvasPolicyForTests,
} from "./texture-canvas";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 1280, height: 720 },
    textureManager: defaultTextureManager,
  });
}

beforeEach(() => {
  // Each test builds a fresh Rect, but the TextureCache is a module
  // singleton — stale entries from prior tests would inflate memory
  // and, more importantly, could hide a missing release if a future
  // change forgot one. Trim so each test starts at a known state.
  trimCachedTextures();
  resetTextureCanvasPolicyForTests();
});

describe("Rect auto hit-area vs pivot", () => {
  it("routes large fullscreen raster sizing through the texture manager cap", () => {
    const before = rasterCacheStats();
    const rect = new Rect({
      textureManager: defaultTextureManager,
      width: 2163,
      height: 1217,
      fill: "#14100a",
      fillAlpha: 0.96,
      strokeColor: "#221100",
      strokeWidth: 1,
    });
    const after = rasterCacheStats();
    const pixelSize = defaultTextureManager.resolveTexturePixelSize({
      logicalWidth: 2163,
      logicalHeight: 1217,
      pixelRatio: 1,
      rounding: "even",
    });

    expect(rect.width).toBe(2163);
    expect(pixelSize.width).toBe(DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE);
    expect(after.bytes - before.bytes).toBe(pixelSize.width * pixelSize.height * 4);
    rect.destroy();
  });

  it("uses one shared pixel for stretchable solid fill rects", () => {
    const before = rasterCacheStats();
    const first = new Rect({
      textureManager: defaultTextureManager,
      width: 1280,
      height: 720,
      fill: "#080603",
      fillAlpha: 0.74,
    });
    const second = new Rect({
      textureManager: defaultTextureManager,
      width: 320,
      height: 180,
      fill: "#080603",
      fillAlpha: 0.74,
    });

    const after = rasterCacheStats();
    expect(after.entries - before.entries).toBe(1);
    expect(after.bytes - before.bytes).toBe(4);

    first.destroy();
    expect(rasterCacheStats().entries).toBe(after.entries);
    second.destroy();
    expect(rasterCacheStats()).toEqual(before);
  });

  it("releases the previous raster when resize allocates a replacement", () => {
    const before = rasterCacheStats();
    const rect = new Rect({
      textureManager: defaultTextureManager,
      width: 12,
      height: 10,
      fill: "#123456",
      fillAlpha: 0.77,
      strokeColor: "#654321",
      strokeWidth: 1,
    });
    const initialSize = defaultTextureManager.resolveTexturePixelSize({
      logicalWidth: 12,
      logicalHeight: 10,
      pixelRatio: 1,
      rounding: "even",
    });

    expect(rasterCacheStats().bytes - before.bytes).toBe(
      initialSize.width * initialSize.height * 4,
    );

    rect.setSize(22, 10);
    const resizedSize = defaultTextureManager.resolveTexturePixelSize({
      logicalWidth: 22,
      logicalHeight: 10,
      pixelRatio: 1,
      rounding: "even",
    });
    const afterResize = rasterCacheStats();

    expect(afterResize.entries - before.entries).toBe(1);
    expect(afterResize.bytes - before.bytes).toBe(
      resizedSize.width * resizedSize.height * 4,
    );

    rect.destroy();
    expect(rasterCacheStats()).toEqual(before);
  });

  it("uses hit testing without allocating a raster for fully transparent rects", () => {
    const before = rasterCacheStats();
    const rect = new Rect({
      textureManager: defaultTextureManager,
      width: 640,
      height: 360,
      fill: "#000000",
      fillAlpha: 0,
      interactive: true,
    });

    expect(rect.hitArea).toStrictEqual({ x: 0, y: 0, width: 640, height: 360 });
    expect(rasterCacheStats()).toEqual(before);

    rect.setFill("#000000", 0.5);
    expect(rasterCacheStats().entries - before.entries).toBe(1);

    rect.setFill("#000000", 0);
    expect(rasterCacheStats()).toEqual(before);
    rect.destroy();
  });

  it("hit area coincides with the visible mesh at top-left pivot", () => {
    const rect = new Rect({
      textureManager: defaultTextureManager,
      width: 120,
      height: 80,
      originX: 0,
      originY: 0,
      interactive: true,
    });
    expect(rect.hitArea).toStrictEqual({ x: 0, y: 0, width: 120, height: 80 });
    expect(rect.pivotX).toBe(0);
    expect(rect.pivotY).toBe(0);
  });

  it("hit area coincides with the visible mesh at centre pivot", () => {
    const rect = new Rect({
      textureManager: defaultTextureManager,
      width: 120,
      height: 80,
      originX: 0.5,
      originY: 0.5,
      interactive: true,
    });
    expect(rect.hitArea).toStrictEqual({
      x: -60,
      y: -40,
      width: 120,
      height: 80,
    });
  });

  it("hit area coincides with the visible mesh at bottom-right pivot", () => {
    const rect = new Rect({
      textureManager: defaultTextureManager,
      width: 120,
      height: 80,
      originX: 1,
      originY: 1,
      interactive: true,
    });
    expect(rect.hitArea).toStrictEqual({
      x: -120,
      y: -80,
      width: 120,
      height: 80,
    });
  });

  it("handles asymmetric fractional pivots", () => {
    const rect = new Rect({
      textureManager: defaultTextureManager,
      width: 200,
      height: 100,
      originX: 0.25,
      originY: 0.75,
      interactive: true,
    });
    expect(rect.hitArea).toStrictEqual({
      x: -50,
      y: -75,
      width: 200,
      height: 100,
    });
  });

  it("recomputes hit area when setOrigin runs after construction", () => {
    const rect = new Rect({
      textureManager: defaultTextureManager,
      width: 100,
      height: 100,
      interactive: true,
    });
    expect(rect.hitArea).toStrictEqual({ x: 0, y: 0, width: 100, height: 100 });
    rect.setOrigin(0.5, 0.5);
    expect(rect.hitArea).toStrictEqual({
      x: -50,
      y: -50,
      width: 100,
      height: 100,
    });
  });

  it("recomputes hit area when setSize runs while interactive", () => {
    const rect = new Rect({
      textureManager: defaultTextureManager,
      width: 100,
      height: 100,
      originX: 0.5,
      originY: 0.5,
      interactive: true,
    });
    rect.setSize(200, 50);
    expect(rect.hitArea).toStrictEqual({
      x: -100,
      y: -25,
      width: 200,
      height: 50,
    });
  });

  it("leaves hitArea null on non-interactive Rect, even across pivot changes", () => {
    const rect = new Rect({
      textureManager: defaultTextureManager,
      width: 80,
      height: 80,
      // no `interactive: true` — the auto-hit path must not engage
    });
    expect(rect.hitArea).toBeNull();
    rect.setOrigin(0.5, 0.5);
    expect(rect.hitArea).toBeNull();
    rect.setSize(10, 10);
    expect(rect.hitArea).toBeNull();
  });

  it("respects an explicit setInteractive(rect) override regardless of pivot", () => {
    const rect = new Rect({
      textureManager: defaultTextureManager,
      width: 100,
      height: 100,
      originX: 0.5,
      originY: 0.5,
      interactive: true,
    });
    // Hand-rolled hit rect — e.g. a button that wants a wider touch
    // target than its visual skin. The node must keep it as-is.
    rect.setInteractive({ x: -70, y: -70, width: 140, height: 140 });
    expect(rect.hitArea).toStrictEqual({
      x: -70,
      y: -70,
      width: 140,
      height: 140,
    });
    // But a later pivot change should re-auto-derive against the
    // current pivot — the previous hand-rolled rect was valid for the
    // pivot at the time it was set, not forever. This matches the
    // existing `onPivotChanged` behaviour (see Rect.ts).
    rect.setOrigin(0, 0);
    expect(rect.hitArea).toStrictEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });
});

describe("Rect pointer alignment (behavioural)", () => {
  /**
   * Positions a Rect at viewport (cx, cy) with the supplied pivot and
   * asserts that PointerManager picks it at every visible corner
   * (strictly inside by 1 px) and misses a pixel outside each edge.
   *
   * End-to-end coverage: a regression that breaks either the mesh
   * pivot offset OR the hit-area pivot offset surfaces as a
   * missed/spurious pick — whichever side drifted.
   */
  function assertVisibleRectPickable(
    pivotX: number,
    pivotY: number,
    width: number,
    height: number,
  ): void {
    const stage = makeStage();
    const cx = 400;
    const cy = 300;
    const rect = new Rect({
      textureManager: defaultTextureManager,
      x: cx,
      y: cy,
      width,
      height,
      originX: pivotX,
      originY: pivotY,
      interactive: true,
    });
    stage.add(rect);
    stage.composeFrame();

    const visibleLeft = cx - pivotX * width;
    const visibleTop = cy - pivotY * height;
    const visibleRight = visibleLeft + width;
    const visibleBottom = visibleTop + height;

    const picks: Array<[number, number, "hit" | "miss", string]> = [
      [visibleLeft + 1, visibleTop + 1, "hit", "inside top-left"],
      [visibleRight - 1, visibleTop + 1, "hit", "inside top-right"],
      [visibleLeft + 1, visibleBottom - 1, "hit", "inside bottom-left"],
      [visibleRight - 1, visibleBottom - 1, "hit", "inside bottom-right"],
      [visibleLeft - 2, visibleTop + 10, "miss", "2px left of left edge"],
      [visibleRight + 2, visibleTop + 10, "miss", "2px right of right edge"],
      [visibleLeft + 10, visibleTop - 2, "miss", "2px above top edge"],
      [visibleLeft + 10, visibleBottom + 2, "miss", "2px below bottom edge"],
    ];

    for (const [px, py, kind, label] of picks) {
      const hit = stage.pointer.pickAt(px, py);
      if (kind === "hit") {
        expect(
          hit,
          `pivot=(${String(pivotX)},${String(pivotY)}) ${label} at (${String(px)},${String(py)}) should hit`,
        ).toBe(rect);
      } else {
        expect(
          hit,
          `pivot=(${String(pivotX)},${String(pivotY)}) ${label} at (${String(px)},${String(py)}) should miss`,
        ).toBeNull();
      }
    }
  }

  it("picks inside the visible rect and misses outside for top-left pivot", () => {
    assertVisibleRectPickable(0, 0, 120, 80);
  });

  it("picks inside the visible rect and misses outside for centre pivot", () => {
    assertVisibleRectPickable(0.5, 0.5, 120, 80);
  });

  it("picks inside the visible rect and misses outside for bottom-right pivot", () => {
    assertVisibleRectPickable(1, 1, 120, 80);
  });

  it("picks correctly for asymmetric fractional pivots", () => {
    assertVisibleRectPickable(0.25, 0.75, 200, 100);
  });
});
