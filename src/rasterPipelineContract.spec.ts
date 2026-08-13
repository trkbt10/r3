/**
 * @file rasterPipelineContract.spec module.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function local(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

describe("r3 raster pipeline contract", () => {
  it("keeps raster sizing free of byte-cap policy", () => {
    const textureSizing = readFileSync(local("./texture-sizing.ts"), "utf8");
    const textureCache = readFileSync(local("./TextureCache.ts"), "utf8");

    expect(textureSizing).not.toContain("maxTextureBytes");
    expect(textureCache).not.toContain("maxTextureBytes");
  });

  it("uses Rect as the SoT for transparent and stretchable-solid raster behavior", () => {
    const rect = readFileSync(local("./Rect.ts"), "utf8");

    expect(rect).toContain("isVisuallyEmpty");
    expect(rect).toContain("usesStretchableSolidFill");
    expect(rect).toContain("canvas.width = 1");
    expect(rect).toContain("canvas.height = 1");
  });

  it("exports FlatPanelRect as the SoT for large square-corner panels", () => {
    const index = readFileSync(local("./index.ts"), "utf8");
    const flatPanel = readFileSync(local("./FlatPanelRect.ts"), "utf8");

    expect(index).toContain('export { FlatPanelRect } from "./FlatPanelRect.ts";');
    expect(flatPanel).toContain("class FlatPanelRect extends Container");
    expect(flatPanel).toContain("edgeRect");
    expect(flatPanel).not.toContain("Graphics");
  });
});
