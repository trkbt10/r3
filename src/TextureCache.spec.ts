// @vitest-environment happy-dom
/**
 * @file Tests for shared raster texture cache configuration.
 */

import { NoColorSpace, SRGBColorSpace } from "three";
import {
  acquireRaster,
  configureDataRasterTexture,
  releaseRaster,
  rasterCacheStats,
  trimCachedTextures,
} from "./TextureCache.ts";
import { defaultTextureManager } from "./texture-canvas";

afterEach(() => {
  trimCachedTextures();
});

describe("TextureCache raster texture configuration", () => {
  it("defaults acquired rasters to display colour textures", () => {
    const entry = acquireRaster(
      "texture-cache-spec:color",
      (canvas) => {
        canvas.width = 2;
        canvas.height = 2;
        return { cssWidth: 2, cssHeight: 2 };
      },
      defaultTextureManager,
    );

    expect(entry.texture.colorSpace).toBe(SRGBColorSpace);
    expect(entry.texture.generateMipmaps).toBe(false);

    releaseRaster("texture-cache-spec:color");
  });

  it("lets data-mask providers opt out of colour conversion", () => {
    const entry = acquireRaster(
      "texture-cache-spec:data",
      (canvas) => {
        canvas.width = 2;
        canvas.height = 2;
        return { cssWidth: 2, cssHeight: 2 };
      },
      defaultTextureManager,
      configureDataRasterTexture,
    );

    expect(entry.texture.colorSpace).toBe(NoColorSpace);
    expect(entry.texture.generateMipmaps).toBe(false);

    releaseRaster("texture-cache-spec:data");
  });

  it("releases raster texture and canvas backing store when the last owner releases it", () => {
    const entry = acquireRaster(
      "texture-cache-spec:release",
      (canvas) => {
        canvas.width = 8;
        canvas.height = 4;
        return { cssWidth: 8, cssHeight: 4 };
      },
      defaultTextureManager,
    );

    expect(entry.canvas.width).toBe(8);
    expect(entry.canvas.height).toBe(4);

    releaseRaster("texture-cache-spec:release");

    expect(entry.canvas.width).toBe(0);
    expect(entry.canvas.height).toBe(0);
  });

  it("reuses an existing raster and defers disposal until the final release", () => {
    const key = "texture-cache-spec:shared-refcount";
    const paintCalls = { value: 0 };
    const paint = (canvas: { width: number; height: number }): { cssWidth: number; cssHeight: number } => {
      paintCalls.value += 1;
      canvas.width = 16;
      canvas.height = 8;
      return { cssWidth: 16, cssHeight: 8 };
    };

    const before = rasterCacheStats();
    const first = acquireRaster(key, paint, defaultTextureManager);
    const second = acquireRaster(key, paint, defaultTextureManager);
    const afterAcquire = rasterCacheStats();

    expect(second.canvas).toBe(first.canvas);
    expect(second.texture).toBe(first.texture);
    expect(paintCalls.value).toBe(1);
    expect(afterAcquire.entries - before.entries).toBe(1);
    expect(afterAcquire.bytes - before.bytes).toBe(16 * 8 * 4);

    releaseRaster(key);
    const afterFirstRelease = rasterCacheStats();
    expect(afterFirstRelease.entries).toBe(afterAcquire.entries);
    expect(first.canvas.width).toBe(16);
    expect(first.canvas.height).toBe(8);

    releaseRaster(key);
    const afterFinalRelease = rasterCacheStats();
    expect(afterFinalRelease.entries).toBe(before.entries);
    expect(afterFinalRelease.bytes).toBe(before.bytes);
    expect(first.canvas.width).toBe(0);
    expect(first.canvas.height).toBe(0);
  });

  it("warns with incoming raster details instead of throwing when the live budget is exceeded", () => {
    const warnings: unknown[] = [];
    const originalWarn = console.warn;
    console.warn = (message?: unknown): void => {
      warnings.push(message);
    };

    try {
      const entry = acquireRaster(
        "texture-cache-spec:oversize",
        (canvas) => {
          canvas.width = 4097;
          canvas.height = 4097;
          return { cssWidth: 4097, cssHeight: 4097 };
        },
        defaultTextureManager,
        undefined,
        { kind: "spec", label: "oversize" },
      );

      expect(entry.canvas.width).toBe(4097);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("incoming=");
      expect(warnings[0]).toContain("kind=\"spec\" label=\"oversize\"");
      expect(warnings[0]).toContain("texture-cache-spec:oversize");
      expect(warnings[0]).toContain("largestLive=");

      releaseRaster("texture-cache-spec:oversize");
    } finally {
      console.warn = originalWarn;
    }
  });
});
