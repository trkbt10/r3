/**
 * @file game r3 layout engine registry.spec.
 */
import { makeScreen, type Screen } from "../screen";
import { Stage } from "../Stage.ts";
import { defaultTextureManager } from "../texture-canvas";
import { flexBox, leaf, spacer } from "./nodes.ts";
import { LayoutKeyRegistry } from "./registry.ts";
import { LayoutRuntime } from "./runtime.ts";
import { SceneResponsiveLayout } from "./SceneResponsiveLayout.ts";

describe("LayoutKeyRegistry", () => {
  it("records keyed flex, leaf, and spacer nodes from the current relayout", () => {
    const registry = new LayoutKeyRegistry();
    const root = flexBox({
      key: "root",
      direction: "row",
      width: 320,
      height: 80,
      children: [
        leaf({ key: "button", width: 120, height: 40, onRect: () => {} }),
        spacer({ key: "gap", width: 24, height: 40 }),
      ],
    });

    new LayoutRuntime({
      root,
      viewport: { x: 0, y: 0, width: 320, height: 80 },
      registry,
    });

    expect(registry.require("root").rect).toEqual({ x: 0, y: 0, width: 320, height: 80 });
    expect(registry.require("button")).toEqual({
      key: "button",
      kind: "leaf",
      rect: { x: 0, y: 0, width: 120, height: 40 },
      visualRect: { x: 0, y: 0, width: 120, height: 40 },
    });
    expect(registry.require("gap").rect).toEqual({ x: 120, y: 0, width: 24, height: 40 });
  });

  it("drops keys that disappear after setRoot", () => {
    const registry = new LayoutKeyRegistry();
    const runtime = new LayoutRuntime({
      root: flexBox({
        key: "root",
        width: 300,
        height: 80,
        children: [leaf({ key: "old", width: 100, height: 40, onRect: () => {} })],
      }),
      viewport: { x: 0, y: 0, width: 300, height: 80 },
      registry,
    });

    runtime.setRoot(flexBox({
      key: "root",
      width: 300,
      height: 80,
      children: [leaf({ key: "next", width: 100, height: 40, onRect: () => {} })],
    }));

    expect(registry.has("old")).toBe(false);
    expect(registry.has("next")).toBe(true);
  });

  it("keeps manual targets across relayouts until explicitly deleted", () => {
    const registry = new LayoutKeyRegistry();
    const runtime = new LayoutRuntime({
      root: flexBox({
        key: "root",
        width: 300,
        height: 80,
        children: [leaf({ key: "managed", width: 100, height: 40, onRect: () => {} })],
      }),
      viewport: { x: 0, y: 0, width: 300, height: 80 },
      registry,
    });

    registry.setManualTarget("manual", { x: 12, y: 24, width: 56, height: 32 });
    runtime.setViewport({ x: 0, y: 0, width: 420, height: 120 });

    expect(registry.require("manual").rect).toEqual({ x: 12, y: 24, width: 56, height: 32 });
    registry.delete("manual");
    expect(registry.has("manual")).toBe(false);
  });

  it("records visual bounds after layout transforms", () => {
    const registry = new LayoutKeyRegistry();

    new LayoutRuntime({
      root: flexBox({
        key: "root",
        width: 320,
        height: 120,
        children: [
          leaf({
            key: "tilted",
            width: 100,
            height: 50,
            transform: { originX: 0, originY: 0, rotate: Math.PI / 2 },
            onRect: () => {},
          }),
        ],
      }),
      viewport: { x: 0, y: 0, width: 320, height: 120 },
      registry,
    });

    expect(registry.require("tilted").rect).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    const visual = registry.require("tilted").visualRect;
    expect(visual.x).toBeCloseTo(-50);
    expect(visual.y).toBeCloseTo(0);
    expect(visual.width).toBeCloseTo(50);
    expect(visual.height).toBeCloseTo(100);
  });

  it.each([
    ["pc", makeScreen({ width: 1440, height: 900 })],
    ["landscape", makeScreen({ width: 932, height: 430 })],
    ["portrait", makeScreen({ width: 390, height: 844 })],
  ] as const)("tracks responsive target geometry on %s screens", (_name, screen) => {
    const stage = new Stage({ screen, textureManager: defaultTextureManager });
    const registry = new LayoutKeyRegistry();
    const layout = new SceneResponsiveLayout({
      stage,
      registry,
      plan: (current) => planTutorialProbe(current),
    });

    expect(registry.require("tutorial:primary-action").rect).toEqual(primaryActionRect(screen));

    const portrait = makeScreen({ width: 390, height: 844 });
    stage.setScreen(portrait);
    expect(registry.require("tutorial:primary-action").rect).toEqual(primaryActionRect(portrait));

    layout.dispose();
  });
});

function planTutorialProbe(screen: Screen) {
  const rect = primaryActionRect(screen);
  return flexBox({
    key: "root",
    width: screen.width,
    height: screen.height,
    absolute: [
      {
        node: leaf({
          key: "tutorial:primary-action",
          width: rect.width,
          height: rect.height,
          onRect: () => {},
        }),
        place: () => rect,
      },
    ],
  });
}

function primaryActionRect(screen: Screen) {
  if (screen.orientation === "portrait") {
    return { x: 24, y: screen.height - 88, width: screen.width - 48, height: 56 };
  }
  return { x: screen.width - 248, y: screen.height - 72, width: 220, height: 48 };
}
