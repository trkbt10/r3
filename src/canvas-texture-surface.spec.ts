// @vitest-environment happy-dom
/**
 * @file Tests for safe mutable CanvasTexture surfaces.
 */

import {
  createCanvasTextureSurface,
  disposeCanvasTextureSurface,
  resizeCanvasTextureSurface,
} from "./canvas-texture-surface.ts";
import { rasterCacheStats } from "./TextureCache.ts";
import { defaultTextureManager } from "./texture-canvas";

describe("canvas texture surface", () => {
  it("keeps the same texture when logical size changes without changing physical size", () => {
    const before = rasterCacheStats();
    const surface = createCanvasTextureSurface({
      logicalWidth: 11.1,
      logicalHeight: 7.1,
      pixelRatio: 1,
      rounding: "even",
      textureManager: defaultTextureManager,
    });

    const resized = resizeCanvasTextureSurface(surface, {
      logicalWidth: 11.2,
      logicalHeight: 7.2,
      pixelRatio: 1,
      rounding: "even",
      textureManager: defaultTextureManager,
    });

    expect(resized.texture).toBe(surface.texture);
    expect(resized.canvas).toBe(surface.canvas);
    expect(resized.pixelWidth).toBe(12);
    expect(resized.pixelHeight).toBe(8);
    expect(rasterCacheStats().entries - before.entries).toBe(1);

    disposeCanvasTextureSurface(resized);
    expect(rasterCacheStats()).toEqual(before);
  });

  it("replaces and disposes the texture when physical dimensions change", () => {
    const before = rasterCacheStats();
    const surface = createCanvasTextureSurface({
      logicalWidth: 10,
      logicalHeight: 10,
      pixelRatio: 1,
      rounding: "even",
      textureManager: defaultTextureManager,
    });
    const disposed = { value: false };
    surface.texture.addEventListener("dispose", () => {
      disposed.value = true;
    });

    const resized = resizeCanvasTextureSurface(surface, {
      logicalWidth: 13,
      logicalHeight: 10,
      pixelRatio: 1,
      rounding: "even",
      textureManager: defaultTextureManager,
    });

    expect(resized.texture).not.toBe(surface.texture);
    expect(resized.canvas).not.toBe(surface.canvas);
    expect(resized.pixelWidth).toBe(14);
    expect(resized.pixelHeight).toBe(10);
    expect(disposed.value).toBe(true);
    expect(surface.canvas.width).toBe(0);
    expect(surface.canvas.height).toBe(0);
    expect(rasterCacheStats().entries - before.entries).toBe(1);

    disposeCanvasTextureSurface(resized);
    expect(rasterCacheStats()).toEqual(before);
  });

  it("releases the canvas backing store on dispose", () => {
    const before = rasterCacheStats();
    const surface = createCanvasTextureSurface({
      logicalWidth: 10,
      logicalHeight: 10,
      pixelRatio: 1,
      textureManager: defaultTextureManager,
    });

    disposeCanvasTextureSurface(surface);

    expect(surface.canvas.width).toBe(0);
    expect(surface.canvas.height).toBe(0);
    expect(rasterCacheStats()).toEqual(before);
  });
});
