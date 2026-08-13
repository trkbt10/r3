// @vitest-environment happy-dom
/**
 * @file Spotlight overlay layout + arrow-renderer coverage. Needs a
 * DOM (happy-dom) because {@link SpyGraphics} constructs a real
 * {@link Graphics} node, which bakes a canvas-backed texture.
 */
import {
  computeSpotlightOverlayLayout,
  createSpotlightArrowRenderer,
} from "./SpotlightOverlay.ts";
import { Container } from "../Container.ts";
import { Graphics } from "../Graphics.ts";
import { defaultTextureManager, type TextureManager } from "../texture-canvas";

class SpyGraphics extends Graphics {
  constructor(private readonly calls: string[]) {
    super({ width: 1, height: 1, textureManager: defaultTextureManager });
  }

  override lineStyle(): this {
    this.calls.push("lineStyle");
    return this;
  }

  override strokeLine(): this {
    this.calls.push("strokeLine");
    return this;
  }

  override fillStyle(): this {
    this.calls.push("fillStyle");
    return this;
  }

  override fillTriangle(): this {
    this.calls.push("fillTriangle");
    return this;
  }
}

describe("spotlight overlay layout", () => {
  it.each([
    [
      "pc",
      { x: 0, y: 0, width: 1440, height: 900 },
      { x: 1040, y: 760, width: 220, height: 56 },
    ],
    [
      "landscape",
      { x: 0, y: 0, width: 932, height: 430 },
      { x: 664, y: 340, width: 220, height: 48 },
    ],
    [
      "portrait",
      { x: 0, y: 0, width: 390, height: 844 },
      { x: 24, y: 756, width: 342, height: 56 },
    ],
  ] as const)("keeps callout and connector inside the %s viewport", (_name, viewport, target) => {
    const layout = computeSpotlightOverlayLayout({
      viewport,
      target,
      preferredSide: "bottom",
    });

    expect(layout.focus.x).toBeLessThanOrEqual(target.x);
    expect(layout.focus.y).toBeLessThanOrEqual(target.y);
    expect(layout.focus.x + layout.focus.width).toBeGreaterThanOrEqual(target.x + target.width);
    expect(layout.focus.y + layout.focus.height).toBeGreaterThanOrEqual(target.y + target.height);
    expect(layout.callout.x).toBeGreaterThanOrEqual(16);
    expect(layout.callout.y).toBeGreaterThanOrEqual(16);
    expect(layout.callout.x + layout.callout.width).toBeLessThanOrEqual(viewport.width - 16);
    expect(layout.callout.y + layout.callout.height).toBeLessThanOrEqual(viewport.height - 16);
    expect(layout.connectorEnd.x).toBeGreaterThanOrEqual(layout.focus.x);
    expect(layout.connectorEnd.x).toBeLessThanOrEqual(layout.focus.x + layout.focus.width);
  });

  it("falls back from a preferred side when there is no room", () => {
    const layout = computeSpotlightOverlayLayout({
      viewport: { x: 0, y: 0, width: 390, height: 844 },
      target: { x: 24, y: 756, width: 342, height: 56 },
      preferredSide: "bottom",
    });

    expect(layout.side).toBe("top");
    expect(layout.callout.y + layout.callout.height).toBeLessThan(layout.focus.y);
  });

  it("keeps the callout inside the viewport for large board-sized targets", () => {
    const layout = computeSpotlightOverlayLayout({
      viewport: { x: 0, y: 0, width: 1280, height: 720 },
      target: { x: 370, y: 80, width: 540, height: 540 },
      preferredSide: "top",
    });

    expect(layout.callout.x).toBeGreaterThanOrEqual(16);
    expect(layout.callout.y).toBeGreaterThanOrEqual(16);
    expect(layout.callout.x + layout.callout.width).toBeLessThanOrEqual(1264);
    expect(layout.callout.y + layout.callout.height).toBeLessThanOrEqual(704);
  });

  it("places the callout near a top-right HUD target instead of clamping to the viewport origin", () => {
    const layout = computeSpotlightOverlayLayout({
      viewport: { x: 0, y: 0, width: 1280, height: 720 },
      target: { x: 836, y: 16, width: 240, height: 44 },
      preferredSide: "bottom",
    });

    expect(layout.side).toBe("bottom");
    expect(layout.callout.x).toBeGreaterThan(700);
    expect(layout.callout.y).toBeGreaterThan(layout.focus.y + layout.focus.height);
  });

  it("provides arrow drawing as an optional renderer rather than overlay policy", () => {
    const calls: string[] = [];
    const graphics = new SpyGraphics(calls);
    const renderer = createSpotlightArrowRenderer();

    renderer({
      root: new Container({ name: "test" }),
      graphics,
      textureManager: {} as TextureManager,
      viewport: { x: 0, y: 0, width: 640, height: 360 },
      layout: computeSpotlightOverlayLayout({
        viewport: { x: 0, y: 0, width: 640, height: 360 },
        target: { x: 100, y: 100, width: 120, height: 48 },
      }),
    });

    expect(calls).toEqual(["lineStyle", "strokeLine", "fillStyle", "fillTriangle"]);
  });
});
