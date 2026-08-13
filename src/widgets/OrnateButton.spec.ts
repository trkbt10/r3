/**
 * @vitest-environment happy-dom
 *
 * @file OrnateButton — release-to-activate interaction coverage.
 */

import { Stage } from "../Stage.ts";
import { defaultTextureManager } from "../texture-canvas";
import { createR3OrnateButton } from "./OrnateButton.ts";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 1280, height: 720 },
    textureManager: defaultTextureManager,
  });
}

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

describe("createR3OrnateButton", () => {
  it("waits for click release before invoking onClick", () => {
    const stage = makeStage();
    const onClick = makeCounter();
    const button = createR3OrnateButton({
      x: 100,
      y: 50,
      width: 220,
      height: 64,
      label: "Start",
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
    stage.pointer.feedUp(420, 420);
    expect(onClick.calls).toBe(1);

    button.destroy();
  });
});
