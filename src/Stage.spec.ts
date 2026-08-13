/**
 * @file Stage spec — focused on the screen domain SoT and the
 * `setScreen` / `onScreenChange` notification mechanism.
 */

import { Stage } from "./Stage.ts";
import { makeScreen, type Screen } from "./screen";
import { defaultTextureManager } from "./texture-canvas";
import { PerspectiveCamera, Scene, type WebGLRenderer } from "three";

const PC: Screen = makeScreen({ width: 1280, height: 720 });
const PORTRAIT: Screen = makeScreen({ width: 390, height: 844 });

describe("Stage.screen as SoT", () => {
  it("constructs with the supplied screen and exposes it as the SoT", () => {
    const stage = new Stage({ screen: PC, textureManager: defaultTextureManager });
    expect(stage.screen.width).toBe(PC.width);
    expect(stage.screen.height).toBe(PC.height);
  });

  it("setScreen replaces the screen reference and updates the camera bounds", () => {
    const stage = new Stage({ screen: PC, textureManager: defaultTextureManager });
    stage.setScreen(PORTRAIT);
    expect(stage.screen.width).toBe(PORTRAIT.width);
    expect(stage.screen.height).toBe(PORTRAIT.height);
    expect(stage.camera.right).toBe(PORTRAIT.width);
    expect(stage.camera.bottom).toBe(-PORTRAIT.height);
  });

  it("setScreen is a no-op when the screen dimensions are unchanged", () => {
    const stage = new Stage({ screen: PC, textureManager: defaultTextureManager });
    const state = { calls: 0 };
    stage.onScreenChange(() => {
      state.calls += 1;
    });
    stage.setScreen(makeScreen({ width: PC.width, height: PC.height }));
    expect(state.calls).toBe(0);
  });
});

describe("Stage.onScreenChange", () => {
  it("does NOT fire on subscribe (changes only)", () => {
    const stage = new Stage({ screen: PC, textureManager: defaultTextureManager });
    const state = { calls: 0 };
    stage.onScreenChange(() => {
      state.calls += 1;
    });
    expect(state.calls).toBe(0);
  });

  it("fires after every successful setScreen with the new screen", () => {
    const stage = new Stage({ screen: PC, textureManager: defaultTextureManager });
    const seen: Screen[] = [];
    stage.onScreenChange((s) => {
      seen.push(s);
    });
    stage.setScreen(PORTRAIT);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual(PORTRAIT);
    const small = makeScreen({ width: 800, height: 600 });
    stage.setScreen(small);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual(small);
  });

  it("dispose unsubscribes", () => {
    const stage = new Stage({ screen: PC, textureManager: defaultTextureManager });
    const state = { calls: 0 };
    const dispose = stage.onScreenChange(() => {
      state.calls += 1;
    });
    dispose();
    stage.setScreen(PORTRAIT);
    expect(state.calls).toBe(0);
  });

  it("safe to unsubscribe during notify (snapshots the listener set)", () => {
    const stage = new Stage({ screen: PC, textureManager: defaultTextureManager });
    const aCalls: Screen[] = [];
    const bCalls: Screen[] = [];
    const offRef: { off: () => void } = { off: () => {} };
    offRef.off = stage.onScreenChange((s) => {
      aCalls.push(s);
      offRef.off();
    });
    stage.onScreenChange((s) => {
      bCalls.push(s);
    });
    stage.setScreen(PORTRAIT);
    // a runs once and unsubscribes; b still runs in the same notify
    // because the listener set was snapshotted before iteration.
    expect(aCalls).toHaveLength(1);
    expect(bCalls).toHaveLength(1);
    stage.setScreen(makeScreen({ width: 800, height: 600 }));
    // a is gone now; b still receives.
    expect(aCalls).toHaveLength(1);
    expect(bCalls).toHaveLength(2);
  });
});

describe("Stage.onDestroy", () => {
  it("runs destroy hooks once and supports self-unsubscribe", () => {
    const stage = new Stage({ screen: PC, textureManager: defaultTextureManager });
    const calls: string[] = [];
    const offRef: { off: () => void } = { off: () => {} };
    offRef.off = stage.onDestroy(() => {
      calls.push("a");
      offRef.off();
    });
    stage.onDestroy(() => {
      calls.push("b");
    });

    stage.destroy();
    stage.destroy();

    expect(calls).toEqual(["a", "b"]);
  });
});

describe("Stage.render", () => {
  it("clears depth between world, UI, and overlay passes while preserving color composition", () => {
    const stage = new Stage({ screen: PC, textureManager: defaultTextureManager });
    const world = new Scene();
    const worldCamera = new PerspectiveCamera();
    const overlay = new Scene();
    const overlayCamera = new PerspectiveCamera();
    const calls: string[] = [];
    const renderer = {
      render(scene: Scene): void {
        if (scene === world) {
          calls.push("world");
          return;
        }
        if (scene === overlay) {
          calls.push("overlay");
          return;
        }
        if (scene === stage.scene) {
          calls.push("ui");
          return;
        }
        calls.push("unknown");
      },
      clearDepth(): void {
        calls.push("clearDepth");
      },
    };
    assertWebGLRendererForStageTest(renderer);

    stage.registerWorldLayer(world, worldCamera);
    stage.registerOverlayLayer(overlay, overlayCamera);
    stage.render(renderer);

    expect(calls).toEqual(["world", "clearDepth", "ui", "clearDepth", "overlay"]);
  });
});

function assertWebGLRendererForStageTest(renderer: unknown): asserts renderer is WebGLRenderer {
  if (typeof renderer !== "object" || renderer === null || !("render" in renderer) || !("clearDepth" in renderer)) {
    throw new Error("Stage.spec: renderer double is missing render hooks");
  }
}
