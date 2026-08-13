// @vitest-environment happy-dom
/**
 * @file Tests for canvas-backed texture sizing policy.
 */

import {
  resolveTexturePixelSize,
  textureCanvasScaleFor,
} from "./texture-sizing.ts";

describe("texture sizing", () => {
  it("rounds generated texture dimensions to positive even pixels", () => {
    const size = resolveTexturePixelSize({
      logicalWidth: 101,
      logicalHeight: 37,
      pixelRatio: 1,
      rounding: "even",
    });

    expect(size).toEqual({ width: 102, height: 38 });
  });

  it("keeps power-of-two rounding explicit for callers that own UV semantics", () => {
    const size = resolveTexturePixelSize({
      logicalWidth: 129,
      logicalHeight: 65,
      pixelRatio: 1,
      rounding: "power-of-two",
    });

    expect(size).toEqual({ width: 256, height: 128 });
  });

  it("returns a draw scale that fills the rounded backing texture", () => {
    const size = resolveTexturePixelSize({
      logicalWidth: 101,
      logicalHeight: 37,
      pixelRatio: 1,
      rounding: "even",
    });
    const scale = textureCanvasScaleFor(101, 37, size);

    expect(scale.x).toBeCloseTo(102 / 101);
    expect(scale.y).toBeCloseTo(38 / 37);
  });
});
