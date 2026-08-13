// @vitest-environment happy-dom
/**
 * @file Tests for Graphics texture allocation lifecycle.
 */

import { Graphics } from "./Graphics.ts";
import { rasterCacheStats } from "./TextureCache.ts";
import {
  defaultTextureManager,
  resetTextureCanvasPolicyForTests,
} from "./texture-canvas";

beforeEach(() => {
  resetTextureCanvasPolicyForTests();
});

describe("Graphics texture lifecycle", () => {
  it("accounts for its mutable surface in TextureCache and releases it on destroy", () => {
    const before = rasterCacheStats();
    const graphics = new Graphics({
      width: 64,
      height: 32,
      textureManager: defaultTextureManager,
    });
    const afterCreate = rasterCacheStats();

    expect(afterCreate.entries - before.entries).toBe(1);
    expect(afterCreate.bytes - before.bytes).toBe(64 * 32 * 4);

    graphics.destroy();
    expect(rasterCacheStats()).toEqual(before);
  });

  it("releases the previous mutable surface when resize changes physical dimensions", () => {
    const before = rasterCacheStats();
    const graphics = new Graphics({
      width: 64,
      height: 32,
      textureManager: defaultTextureManager,
    });

    graphics.setSize(128, 32);
    const afterResize = rasterCacheStats();

    expect(afterResize.entries - before.entries).toBe(1);
    expect(afterResize.bytes - before.bytes).toBe(128 * 32 * 4);

    graphics.destroy();
    expect(rasterCacheStats()).toEqual(before);
  });
});
