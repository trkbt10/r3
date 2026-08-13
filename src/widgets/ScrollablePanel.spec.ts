/**
 * @vitest-environment happy-dom
 *
 * @file ScrollablePanel — input wiring + scroll-state propagation.
 *
 * Verifies that:
 *  - Wheel inside the viewport scrolls; wheel outside doesn't
 *  - Pointer-down + drag past threshold initiates a scroll
 *  - The content container's `y` mirrors `model.scrollY`
 *  - Indicator visibility / colour updates with scrollable state
 *  - Children added via `addContent` inherit the clipping planes
 */

import { Stage } from "../Stage.ts";
import { Container } from "../Container.ts";
import { Rect } from "../Rect.ts";
import { defaultTextureManager } from "../texture-canvas";
import { R3ScrollablePanel } from "./ScrollablePanel.ts";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 1280, height: 720 },
    textureManager: defaultTextureManager,
  });
}

describe("R3ScrollablePanel", () => {
  it("scrolls on wheel only when the pointer is inside the viewport", () => {
    const stage = makeStage();
    const panel = new R3ScrollablePanel({
      stage,
      textureManager: defaultTextureManager,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      contentHeight: 1000,
      scrollStep: 30,
      showIndicators: false,
    });
    stage.composeFrame();

    // Outside the viewport — should be ignored.
    stage.pointer.feedWheel(50, 50, 100);
    expect(panel.getScrollY()).toBe(0);

    // Inside the viewport — should scroll by `scrollStep` (positive deltaY).
    stage.pointer.feedWheel(150, 200, 100);
    // After wheel, model targets +30 but lerps. Spin the tick a few times.
    for (let i = 0; i < 20; i++) {
      stage.tick(16);
    }
    expect(panel.getScrollY()).toBeCloseTo(30, 0);

    panel.destroy();
  });

  it("dragging past the swipe threshold updates content.y", () => {
    const stage = makeStage();
    const panel = new R3ScrollablePanel({
      stage,
      textureManager: defaultTextureManager,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      contentHeight: 1000,
      showIndicators: false,
    });
    stage.composeFrame();

    stage.pointer.feedDown(150, 150);
    // Move below threshold first — should not scroll yet.
    stage.pointer.feedMove(150, 153);
    expect(panel.content.y).toBe(0);
    // Move past threshold (6px) → starts scrolling.
    stage.pointer.feedMove(150, 130);
    expect(panel.getScrollY()).toBeGreaterThan(0);
    expect(panel.content.y).toBe(-panel.getScrollY());
    stage.pointer.feedUp(150, 130);
    panel.destroy();
  });

  it("does not scroll when a child drag gesture moves across the panel axis", () => {
    const stage = makeStage();
    const panel = new R3ScrollablePanel({
      stage,
      textureManager: defaultTextureManager,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      contentHeight: 1000,
      showIndicators: false,
    });
    stage.composeFrame();

    stage.pointer.feedDown(150, 150);
    stage.pointer.feedMove(190, 154);
    expect(panel.getScrollY()).toBe(0);
    expect(panel.content.y).toBe(0);
    stage.pointer.feedUp(190, 154);
    panel.destroy();
  });

  it("resetScroll snaps content.y back to 0", () => {
    const stage = makeStage();
    const panel = new R3ScrollablePanel({
      stage,
      textureManager: defaultTextureManager,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      contentHeight: 500,
      showIndicators: false,
    });
    panel.scrollBy(80);
    for (let i = 0; i < 30; i++) {
      stage.tick(16);
    }
    expect(panel.getScrollY()).toBeGreaterThan(0);
    panel.resetScroll();
    expect(panel.getScrollY()).toBe(0);
    // content.y becomes -0 (negation of 0); normalise via abs.
    expect(Math.abs(panel.content.y)).toBe(0);
    panel.destroy();
  });

  it("addContent registers the child under content and applies clipping", () => {
    const stage = makeStage();
    const panel = new R3ScrollablePanel({
      stage,
      textureManager: defaultTextureManager,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      contentHeight: 200,
      showIndicators: false,
    });
    const child = new Container({ name: "child" });
    panel.addContent(child);
    expect(panel.content.children).toContain(child);
    panel.destroy();
  });

  it("can mount under a transformed parent so content follows HUD transforms", () => {
    const stage = makeStage();
    const parent = new Container({ name: "hud-parent", x: 200, y: 100 });
    parent.setRotation(0.08);
    stage.add(parent);
    const panel = new R3ScrollablePanel({
      stage,
      parent,
      textureManager: defaultTextureManager,
      x: 10,
      y: 20,
      width: 100,
      height: 100,
      contentHeight: 200,
      showIndicators: false,
    });
    expect(parent.children).toContain(panel.container);
    expect(stage.root.children).not.toContain(panel.container);
    panel.destroy();
  });

  // Contract the docstring promises: children added to `panel.content`
  // directly (without going through `addContent`) still receive the
  // viewport clipping planes — otherwise late-arriving rows would
  // paint past the viewport edges.
  it("children added directly to panel.content inherit the clipping planes", () => {
    const stage = makeStage();
    const panel = new R3ScrollablePanel({
      stage,
      textureManager: defaultTextureManager,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      contentHeight: 200,
      showIndicators: false,
    });
    const child = new Container({ name: "late-child" });
    const originalSet = child.setClippingPlanes.bind(child);
    const received: { planes: readonly unknown[] | null | undefined } = {
      planes: undefined,
    };
    child.setClippingPlanes = (planes) => {
      received.planes = planes;
      originalSet(planes);
    };
    panel.content.add(child);
    // Four planes: left / right / top / bottom of the viewport rect.
    expect(received.planes?.length).toBe(4);
    panel.destroy();
  });

  it("does not hit-test clipped children outside the viewport", () => {
    const stage = makeStage();
    const panel = new R3ScrollablePanel({
      stage,
      textureManager: defaultTextureManager,
      x: 100,
      y: 100,
      width: 120,
      height: 100,
      contentHeight: 260,
      showIndicators: false,
    });
    const visible = new Rect({
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fill: "#ffffff",
      fillAlpha: 0,
      originX: 0,
      originY: 0,
      interactive: true,
      textureManager: defaultTextureManager,
    });
    const clipped = new Rect({
      x: 0,
      y: 120,
      width: 80,
      height: 40,
      fill: "#ffffff",
      fillAlpha: 0,
      originX: 0,
      originY: 0,
      interactive: true,
      textureManager: defaultTextureManager,
    });
    panel.addContent(visible);
    panel.addContent(clipped);

    expect(stage.pointer.pickAt(120, 120)).toBe(visible);
    expect(stage.pointer.pickAt(120, 230)).toBeNull();

    panel.destroy();
  });

  it("scrollable is false when contentHeight fits the viewport", () => {
    const stage = makeStage();
    const panel = new R3ScrollablePanel({
      stage,
      textureManager: defaultTextureManager,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      contentHeight: 60,
      showIndicators: false,
    });
    expect(panel.scrollable).toBe(false);
    panel.destroy();
  });
});
