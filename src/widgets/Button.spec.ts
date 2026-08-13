/**
 * @vitest-environment happy-dom
 *
 * @file Button — interaction + state-toggle coverage.
 *
 * Runs in a happy-dom environment because the underlying r3 leaves
 * (Rect, Text) rasterise into a real `<canvas>`. The test exercises
 * the click → SFX → onClick path, the disabled gate, and the label
 * setter.
 */

import { Stage } from "../Stage.ts";
import { bindR3SfxPlayer } from "../audio.ts";
import { defaultTextureManager } from "../texture-canvas";
import { createR3Button } from "./Button.ts";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 1280, height: 720 },
    textureManager: defaultTextureManager,
  });
}

/** Counter helper used in place of vi.fn (banned by lint config). */
function makeCounter(): { fn: () => void; calls: number } {
  const state = { calls: 0 };
  return {
    get calls(): number {
      return state.calls;
    },
    fn(): void {
      state.calls += 1;
    },
  };
}

describe("createR3Button", () => {
  it("invokes onClick exactly once per click on the button rect", () => {
    const stage = makeStage();
    const onClick = makeCounter();
    const button = createR3Button({
      x: 100,
      y: 50,
      width: 200,
      height: 60,
      label: "OK",
      onClick: onClick.fn,
      textureManager: defaultTextureManager,
      tweens: stage.tweens,
      clickSfx: null,
    });
    stage.add(button.node);
    stage.composeFrame();

    // Down inside, then up inside the same target → click fires.
    stage.pointer.feedDown(100, 50);
    stage.pointer.feedUp(100, 50);
    expect(onClick.calls).toBe(1);

    button.destroy();
  });

  it("does not invoke onClick until the pointer is released on the same button", () => {
    const stage = makeStage();
    const onClick = makeCounter();
    const button = createR3Button({
      x: 100,
      y: 50,
      width: 200,
      height: 60,
      label: "OK",
      onClick: onClick.fn,
      textureManager: defaultTextureManager,
      tweens: stage.tweens,
      clickSfx: null,
    });
    stage.add(button.node);
    stage.composeFrame();

    stage.pointer.feedDown(100, 50);
    expect(onClick.calls).toBe(0);

    stage.pointer.feedUp(100, 50);
    expect(onClick.calls).toBe(1);

    stage.pointer.feedDown(100, 50);
    stage.pointer.feedUp(400, 400);
    expect(onClick.calls).toBe(1);

    button.destroy();
  });

  it("does NOT invoke onClick when the button is disabled", () => {
    const stage = makeStage();
    const onClick = makeCounter();
    const button = createR3Button({
      x: 100,
      y: 50,
      width: 200,
      height: 60,
      label: "OK",
      onClick: onClick.fn,
      textureManager: defaultTextureManager,
      disabled: true,
      tweens: stage.tweens,
      clickSfx: null,
    });
    stage.add(button.node);
    stage.composeFrame();

    stage.pointer.feedDown(100, 50);
    stage.pointer.feedUp(100, 50);
    expect(onClick.calls).toBe(0);

    // Re-enable and verify it now fires.
    button.setDisabled(false);
    stage.composeFrame();
    stage.pointer.feedDown(100, 50);
    stage.pointer.feedUp(100, 50);
    expect(onClick.calls).toBe(1);
  });

  it("plays the configured click SFX through the bound player", () => {
    const stage = makeStage();
    const sfxIds: string[] = [];
    bindR3SfxPlayer((id) => sfxIds.push(id));
    const button = createR3Button({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      label: "Go",
      onClick: () => {
        // intentional no-op
      },
      textureManager: defaultTextureManager,
      tweens: stage.tweens,
      clickSfx: "shop-click",
    });
    stage.add(button.node);
    stage.composeFrame();
    stage.pointer.feedDown(0, 0);
    stage.pointer.feedUp(0, 0);
    expect(sfxIds).toContain("shop-click");
    bindR3SfxPlayer(null);
  });

  it("setLabel swaps the visible text without rebuilding the node", () => {
    const stage = makeStage();
    const button = createR3Button({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      label: "before",
      onClick: () => {
        // no-op
      },
      textureManager: defaultTextureManager,
      tweens: stage.tweens,
      clickSfx: null,
    });
    stage.add(button.node);
    button.setLabel("after");
    // The public root remains stable; visual leaves are owned by an
    // inner pivot so press feedback cannot mutate layout transforms.
    expect(button.node.children.length).toBe(1);
    expect(button.node.children[0]?.name).toBe("r3:button-pivot");
  });

  it("keeps the public layout transform during press feedback", () => {
    const stage = makeStage();
    const button = createR3Button({
      x: 100,
      y: 50,
      width: 200,
      height: 60,
      label: "OK",
      onClick: () => {
        // no-op
      },
      textureManager: defaultTextureManager,
      tweens: stage.tweens,
      clickSfx: null,
    });
    stage.add(button.node);
    button.node.setScale(0.75);
    stage.composeFrame();

    stage.pointer.feedDown(100, 50);

    expect(button.node.scaleX).toBe(0.75);
    expect(button.node.scaleY).toBe(0.75);
    expect(button.node.x).toBe(100);
    expect(button.node.y).toBe(50);
  });
});
