/**
 * @file FlatPanelRect.spec module.
 */
// @vitest-environment happy-dom

import { FlatPanelRect } from "./FlatPanelRect.ts";
import { rasterCacheStats, trimCachedTextures } from "./TextureCache.ts";
import {
  defaultTextureManager,
  resetTextureCanvasPolicyForTests,
} from "./texture-canvas";

beforeEach(() => {
  trimCachedTextures();
  resetTextureCanvasPolicyForTests();
});

describe("FlatPanelRect", () => {
  it("composes large flat panels from shared stretchable solid rects", () => {
    const before = rasterCacheStats();
    const panel = new FlatPanelRect({
      width: 1280,
      height: 720,
      fill: "#1d1913",
      fillAlpha: 0.38,
      strokeColor: "#b88a2c",
      strokeAlpha: 0.32,
      strokeWidth: 1,
      textureManager: defaultTextureManager,
    });

    const after = rasterCacheStats();
    expect(panel.width).toBe(1280);
    expect(panel.height).toBe(720);
    expect(after.entries - before.entries).toBe(2);
    expect(after.bytes - before.bytes).toBe(8);

    panel.destroy();
    expect(rasterCacheStats()).toEqual(before);
  });
});
