/**
 * @vitest-environment happy-dom
 *
 * @file Select — popup layering and input shielding.
 */

import { PerspectiveCamera, Scene, type WebGLRenderer } from "three";
import { Rect } from "../Rect.ts";
import { Stage } from "../Stage.ts";
import { Text } from "../Text.ts";
import { defaultTextureManager } from "../texture-canvas";
import { createR3Select } from "./Select.ts";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 320, height: 240 },
    textureManager: defaultTextureManager,
  });
}

describe("createR3Select", () => {
  it("opens its popup above later siblings and shields clicks behind it", () => {
    const stage = makeStage();
    const state = { changed: "", behindClicks: 0 };
    const select = createR3Select({
      stage,
      parent: stage.root,
      textureManager: defaultTextureManager,
      value: "all",
      options: [
        { value: "all", label: "すべて" },
        { value: "seen", label: "既知" },
      ],
      onChange: (value) => {
        state.changed = value;
      },
    });
    select.setRect({ x: 20, y: 20, width: 140, height: 34 });

    const behind = new Rect({
      x: 20,
      y: 58,
      width: 140,
      height: 68,
      fill: "#000000",
      fillAlpha: 0,
      originX: 0,
      originY: 0,
      interactive: true,
      name: "behind-card-hit",
      textureManager: defaultTextureManager,
    });
    behind.on("pointerup", () => {
      state.behindClicks += 1;
    });
    stage.root.add(behind);

    stage.composeFrame();
    stage.pointer.feedDown(30, 30);
    stage.pointer.feedUp(30, 30);
    stage.composeFrame();

    expect(stage.pointer.pickAt(30, 94)?.name).not.toBe("behind-card-hit");
    stage.pointer.feedDown(30, 94);
    stage.pointer.feedUp(30, 94);

    expect(state.changed).toBe("seen");
    expect(state.behindClicks).toBe(0);
    select.destroy();
  });

  it("uses a dropdown glyph instead of a bare v", () => {
    const stage = makeStage();
    const select = createR3Select({
      stage,
      parent: stage.root,
      textureManager: defaultTextureManager,
      value: "all",
      options: [{ value: "all", label: "すべて" }],
      onChange: () => undefined,
    });

    const arrow = select.node.children.find((child) => child instanceof Text && child.text === "▼");
    expect(arrow).toBeTruthy();
    select.destroy();
  });

  it("renders the popup after perspective overlay layers", () => {
    const stage = makeStage();
    const select = createR3Select({
      stage,
      parent: stage.root,
      textureManager: defaultTextureManager,
      value: "all",
      options: [
        { value: "all", label: "すべて" },
        { value: "seen", label: "既知" },
      ],
      onChange: () => undefined,
    });
    select.setRect({ x: 20, y: 20, width: 140, height: 34 });
    const rareOverlay = new Scene();
    stage.registerOverlayLayer(rareOverlay, new PerspectiveCamera());

    stage.pointer.feedDown(30, 30);
    stage.pointer.feedUp(30, 30);
    stage.composeFrame();
    const calls: string[] = [];
    const renderer = {
      clearDepth(): void {
        calls.push("clearDepth");
      },
      render(scene: Scene): void {
        if (scene === stage.scene) {
          calls.push("ui");
          return;
        }
        if (scene === rareOverlay) {
          calls.push("rare-overlay");
          return;
        }
        calls.push("select-popup");
      },
    };
    assertWebGLRendererForSelectTest(renderer);

    stage.render(renderer);

    expect(calls.at(-1)).toBe("select-popup");
    expect(calls).toEqual([
      "clearDepth",
      "ui",
      "clearDepth",
      "rare-overlay",
      "clearDepth",
      "select-popup",
    ]);
    select.destroy();
  });
});

function assertWebGLRendererForSelectTest(renderer: unknown): asserts renderer is WebGLRenderer {
  if (typeof renderer !== "object" || renderer === null || !("render" in renderer) || !("clearDepth" in renderer)) {
    throw new Error("Select.spec: renderer double is missing render hooks");
  }
}
