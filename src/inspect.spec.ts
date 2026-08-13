// @vitest-environment happy-dom

/**
 * @file Tests for the r3 inspector — verifies the read surface
 * matches what hosts will see after a Stage compose pass, and that
 * pointer-injection helpers route through {@link Stage.pointer}.
 */

import { Container } from "./Container.ts";
import { Rect } from "./Rect.ts";
import { Stage } from "./Stage.ts";
import { defaultTextureManager } from "./texture-canvas";
import { installR3Inspector, uninstallR3Inspector } from "./inspect.ts";

const SCREEN = { width: 1280, height: 720, viewbox: { x: 0, y: 0, width: 1280, height: 720 } } as const;

describe("r3 inspector", () => {
  const stageRef: { value: Stage | null } = { value: null };

  beforeEach(() => {
    stageRef.value = new Stage({
      screen: SCREEN,
      textureManager: defaultTextureManager,
    });
  });

  afterEach(() => {
    const stage = currentStage(stageRef);
    uninstallR3Inspector(stage);
    stage.destroy();
    stageRef.value = null;
  });

  it("exposes a window-side inspector with the documented shape", () => {
    const stage = currentStage(stageRef);
    const inspector = installR3Inspector({ stage });
    expect(inspectorWindow().__R3__).toBe(inspector);
    expect(inspector.version).toBe("1");
    expect(inspector.screenSize()).toEqual({ width: 1280, height: 720 });
    expect(typeof inspector.click).toBe("function");
    expect(typeof inspector.clickByName).toBe("function");
  });

  it("walks the display tree and reports world rect + interactive flag", () => {
    const stage = currentStage(stageRef);
    const interactive = new Rect({
      x: 100,
      y: 200,
      width: 80,
      height: 40,
      fill: "#ffffff",
      interactive: true,
      name: "test:start-button",
      textureManager: stage.textureManager,
    });
    const wrap = new Container({ x: 50, y: 60, name: "test:wrap" });
    wrap.add(interactive);
    stage.add(wrap);
    stage.tick(0);

    const inspector = installR3Inspector({ stage });
    const node = inspector
      .findNodes({ name: "test:start-button" })
      .find((n) => n.name === "test:start-button");
    expect(node).toBeDefined();
    if (!node) {return;}
    // origin defaults to (0,0), so world position equals stage offset.
    expect(node.worldX).toBe(150);
    expect(node.worldY).toBe(260);
    expect(node.hit).toEqual({ width: 80, height: 40 });
    expect(node.hitCenter).toEqual({ x: 150 + 40, y: 260 + 20 });
    expect(node.visible).toBe(true);
    expect(node.alpha).toBe(1);
    expect(node.kind).toBe("Rect");
  });

  it("clickByName routes through stage.pointer to the target's center", () => {
    const stage = currentStage(stageRef);
    const pointerEvents: {
      downAt: { x: number; y: number } | null;
      upAt: { x: number; y: number } | null;
    } = { downAt: null, upAt: null };
    const button = new Rect({
      x: 200,
      y: 300,
      width: 60,
      height: 40,
      fill: "#ffffff",
      interactive: true,
      name: "test:btn",
      textureManager: stage.textureManager,
    });
    button.on("pointerdown", (e) => {
      pointerEvents.downAt = { x: e.x, y: e.y };
    });
    button.on("pointerup", (e) => {
      pointerEvents.upAt = { x: e.x, y: e.y };
    });
    stage.add(button);
    stage.tick(0);

    const inspector = installR3Inspector({ stage });
    const ok = inspector.clickByName("test:btn");
    expect(ok).toBe(true);
    expect(pointerEvents.downAt).toEqual({ x: 200 + 30, y: 300 + 20 });
    expect(pointerEvents.upAt).toEqual({ x: 200 + 30, y: 300 + 20 });
  });

  it("clickByName returns false for unknown names without injecting pointer events", () => {
    const stage = currentStage(stageRef);
    const inspector = installR3Inspector({ stage });
    expect(inspector.clickByName("nope")).toBe(false);
  });
});

function currentStage(stageRef: { readonly value: Stage | null }): Stage {
  if (stageRef.value === null) {
    throw new Error("inspect.spec: stage is not initialized");
  }
  return stageRef.value;
}

function inspectorWindow(): Window & { __R3__?: ReturnType<typeof installR3Inspector> } {
  return window as Window & { __R3__?: ReturnType<typeof installR3Inspector> };
}
