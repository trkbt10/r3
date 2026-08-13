// @vitest-environment happy-dom
/**
 * @file Tests for text raster cache variants.
 */

import { rasterCacheStats, trimCachedTextures } from "./TextureCache.ts";
import { defaultTextureManager } from "./texture-canvas";
import {
  acquireTextCanvasRaster,
  layoutTextRaster,
  textCanvasRasterCacheStats,
  trimTextCanvasRasterCache,
  type TextRasterSpec,
} from "./text-raster.ts";

const SPEC: TextRasterSpec = {
  text: "金",
  font: { family: "serif", size: 24, weight: "bold" },
  color: "#fff",
  align: "center",
  dpr: 1,
};

afterEach(() => {
  trimTextCanvasRasterCache();
  trimCachedTextures();
});

describe("text canvas rasters", () => {
  it("cache canvas-only face fragments without creating texture entries", () => {
    const before = rasterCacheStats();
    const entry = acquireTextCanvasRaster(SPEC, defaultTextureManager);
    const after = rasterCacheStats();

    expect(entry.cssWidth).toBeGreaterThan(0);
    expect(entry.cssHeight).toBeGreaterThan(0);
    expect(after).toEqual(before);
  });

  it("reuses the same canvas for identical text raster specs", () => {
    const first = acquireTextCanvasRaster(SPEC, defaultTextureManager);
    const second = acquireTextCanvasRaster(SPEC, defaultTextureManager);

    expect(second.canvas).toBe(first.canvas);
    expect(textCanvasRasterCacheStats().entries).toBe(1);
  });
});

describe("text raster layout", () => {
  it("keeps font metrics stable across changing visible text", () => {
    const ctx = {
      font: "",
      measureText(text: string) {
        const isProbe = text.includes("漢");
        const hasDescender = /[gjpqy]/.test(text);
        return {
          width: text.length * 10,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: text.length * 10,
          actualBoundingBoxAscent: isProbe ? 18 : 10,
          actualBoundingBoxDescent: isProbe || hasDescender ? 6 : 2,
          alphabeticBaseline: 0,
          emHeightAscent: 18,
          emHeightDescent: 6,
          fontBoundingBoxAscent: 18,
          fontBoundingBoxDescent: 6,
          hangingBaseline: 0,
          ideographicBaseline: 0,
        };
      },
    } as CanvasRenderingContext2D;

    const base = {
      font: { family: "serif", size: 24 },
      color: "#fff",
      lineHeight: 1.7,
      padding: 0,
      dpr: 1,
    } satisfies Omit<TextRasterSpec, "text">;
    const withoutDescender = layoutTextRaster({ ...base, text: "HHH" }, ctx, undefined);
    const withDescender = layoutTextRaster({ ...base, text: "ggg" }, ctx, undefined);

    expect(withDescender.ascent).toBe(withoutDescender.ascent);
    expect(withDescender.cssHeight).toBe(withoutDescender.cssHeight);
  });
});
