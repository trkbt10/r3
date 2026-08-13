// @vitest-environment happy-dom
/**
 * @file createTextureCanvas — feature-probe + factory behaviour.
 *
 * The factory has three observable behaviours that matter to r3:
 *
 *  1. When `OffscreenCanvas` is usable, `createTextureCanvas` returns
 *     an `OffscreenCanvas` (so the browser keeps the bitmap off the
 *     DOM heap and Three's `CanvasTexture` uploads bypass layout).
 *  2. When `OffscreenCanvas` is missing or its 2D context can't be
 *     acquired, the factory falls back to a real `HTMLCanvasElement`
 *     allocated via `document.createElement`.
 *  3. The decision is made once and cached — nobody wants the raster
 *     cache to hold entries backed by two different canvas flavours.
 *
 * We test all three against a mutable `OffscreenCanvas` global, using
 * `resetTextureCanvasStrategyForTests` to force a re-probe between
 * cases. happy-dom provides `document.createElement("canvas")`; we
 * stub `OffscreenCanvas` per test so behaviour is deterministic
 * regardless of the happy-dom version.
 */

import {
  acquireTextureCanvas2DContext,
  configureTextureCanvasMaxTextureSize,
  createTextureCanvas,
  DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE,
  isOffscreenCanvasActive,
  resetTextureCanvasPolicyForTests,
  resetTextureCanvasStrategyForTests,
  resolveTextureCanvasPixelSize,
  type TextureCanvas,
} from "./createTextureCanvas.ts";

type OffscreenCtor = typeof globalThis extends { OffscreenCanvas: infer T } ? T : unknown;

function restoreOriginalOffscreen(original: OffscreenCtor | undefined): void {
  if (original === undefined) {
    delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    return;
  }
  (globalThis as { OffscreenCanvas: unknown }).OffscreenCanvas = original;
}

describe("createTextureCanvas", () => {
  const originalOffscreen = (globalThis as { OffscreenCanvas?: OffscreenCtor }).OffscreenCanvas;

  beforeEach(() => {
    // Every case starts from an "unknown" strategy so the probe runs
    // against whatever stub the case installed on `globalThis`.
    resetTextureCanvasPolicyForTests();
    resetTextureCanvasStrategyForTests();
  });

  afterEach(() => {
    restoreOriginalOffscreen(originalOffscreen);
    resetTextureCanvasPolicyForTests();
    resetTextureCanvasStrategyForTests();
  });

  it("prefers OffscreenCanvas when available and its 2D context is usable", () => {
    class FakeOffscreenCanvas {
      readonly width: number;
      readonly height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      getContext(type: "2d"): { width: number; height: number } | null {
        // Minimal stand-in: the probe only checks for a truthy return.
        return type === "2d" ? { width: this.width, height: this.height } : null;
      }
    }
    (globalThis as { OffscreenCanvas: unknown }).OffscreenCanvas = FakeOffscreenCanvas;

    const canvas = createTextureCanvas(32, 16);
    expect(canvas).toBeInstanceOf(FakeOffscreenCanvas);
    expect(canvas.width).toBe(32);
    expect(canvas.height).toBe(16);
    expect(isOffscreenCanvasActive()).toBe(true);
  });

  it("falls back to HTMLCanvasElement when OffscreenCanvas is absent", () => {
    delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;

    const canvas = createTextureCanvas(10, 20);
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(10);
    expect(canvas.height).toBe(20);
    expect(isOffscreenCanvasActive()).toBe(false);
  });

  it("falls back to HTMLCanvasElement when OffscreenCanvas exists but its 2D context is unusable", () => {
    class StubOffscreenCanvas {
      constructor(public width: number, public height: number) {}
      getContext(): null {
        // Mirrors happy-dom / jsdom builds that ship a stub
        // constructor but no 2D backing store.
        return null;
      }
    }
    (globalThis as { OffscreenCanvas: unknown }).OffscreenCanvas = StubOffscreenCanvas;

    const canvas = createTextureCanvas(4, 8);
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(8);
    expect(isOffscreenCanvasActive()).toBe(false);
  });

  it("clamps non-positive / fractional sizes to at least 1×1", () => {
    delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;

    const zero = createTextureCanvas(0, 0);
    expect(zero.width).toBe(1);
    expect(zero.height).toBe(1);

    const frac = createTextureCanvas(3.4, 7.7);
    expect(frac.width).toBe(3);
    expect(frac.height).toBe(8);
  });

  it("caches the strategy decision across allocations", () => {
    class FakeOffscreenCanvas {
      constructor(public width: number, public height: number) {}
      getContext(type: "2d"): object | null {
        return type === "2d" ? {} : null;
      }
    }
    (globalThis as { OffscreenCanvas: unknown }).OffscreenCanvas = FakeOffscreenCanvas;

    const first = createTextureCanvas();
    expect(first).toBeInstanceOf(FakeOffscreenCanvas);

    // Now swap OffscreenCanvas for a broken stub. Because the first
    // allocation cached "offscreen", the factory must NOT re-probe
    // and must keep handing out instances of the original class.
    class ReplacementOffscreen {
      constructor(public width: number, public height: number) {}
      getContext(): null {
        return null;
      }
    }
    (globalThis as { OffscreenCanvas: unknown }).OffscreenCanvas = ReplacementOffscreen;

    const second = createTextureCanvas();
    expect(second).toBeInstanceOf(ReplacementOffscreen);
    // The factory kept the offscreen-preferred strategy: it allocated
    // via `new OffscreenCanvas(...)` which at call time resolves to
    // whatever binding `globalThis.OffscreenCanvas` currently holds.
    // The test's point is that the strategy was not re-evaluated
    // (otherwise the broken stub would have forced a DOM fallback).
    expect(isOffscreenCanvasActive()).toBe(true);
  });

  it("delegates to the canvas's own getContext('2d') for HTMLCanvasElement", () => {
    // happy-dom's HTMLCanvasElement.getContext("2d") returns null —
    // consistent with jsdom. The helper's contract is NOT to fabricate
    // a context; it is to select the right `getContext("2d")` overload
    // on the union. So we only assert the helper returns exactly what
    // the canvas itself would return.
    delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;

    const canvas = createTextureCanvas(64, 64);
    const direct = (canvas as HTMLCanvasElement).getContext("2d");
    const viaHelper = acquireTextureCanvas2DContext(canvas);
    expect(viaHelper).toBe(direct);
  });

  it("delegates to the canvas's own getContext('2d') for OffscreenCanvas", () => {
    class FakeOffscreenCanvas {
      readonly shared = { marker: "offscreen-2d-ctx" };
      constructor(public width: number, public height: number) {}
      getContext(type: "2d"): { marker: string } | null {
        return type === "2d" ? this.shared : null;
      }
    }
    function isFakeOffscreenCanvas(value: TextureCanvas): value is TextureCanvas & FakeOffscreenCanvas {
      return "shared" in value;
    }
    (globalThis as { OffscreenCanvas: unknown }).OffscreenCanvas = FakeOffscreenCanvas;

    const canvas = createTextureCanvas(8, 8);
    expect(isFakeOffscreenCanvas(canvas)).toBe(true);
    if (!isFakeOffscreenCanvas(canvas)) {
      return;
    }
    // Helper must return the same instance the canvas itself gives
    // back — proving that the union dispatch picks the OffscreenCanvas
    // overload when the argument is an OffscreenCanvas instance.
    const viaHelper = acquireTextureCanvas2DContext(canvas);
    expect(viaHelper).toBe(canvas.shared);
  });

  it("resolves generated texture sizes through the capped texture policy", () => {
    const defaultCapped = resolveTextureCanvasPixelSize({
      logicalWidth: DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE + 200,
      logicalHeight: DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE + 100,
      pixelRatio: 2,
      rounding: "even",
    });

    expect(defaultCapped).toEqual({
      width: DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE,
      height: DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE,
    });

    configureTextureCanvasMaxTextureSize(1024);
    const capabilityCapped = resolveTextureCanvasPixelSize({
      logicalWidth: 900,
      logicalHeight: 900,
      pixelRatio: 2,
      rounding: "even",
    });

    expect(capabilityCapped).toEqual({ width: 1024, height: 1024 });
  });

  it("keeps the texture policy cap on an even boundary", () => {
    configureTextureCanvasMaxTextureSize(1025);
    const size = resolveTextureCanvasPixelSize({
      logicalWidth: 900,
      logicalHeight: 900,
      pixelRatio: 2,
      rounding: "even",
    });

    expect(size).toEqual({ width: 1024, height: 1024 });
  });
});
