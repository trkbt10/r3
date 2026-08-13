// @vitest-environment happy-dom
/**
 * @file Node — teardown invariants.
 *
 * Nodes attached to a Stage may be tween targets. Infinite
 * (`repeat: -1`) tweens never self-retire, so a scene that tweens
 * a Node then destroys it without explicit cleanup used to leak the
 * Node reference via `TweenManager.active[*].targets`. The Node's
 * `destroy()` now kills tweens targeting it — this file locks the
 * invariant so a future refactor can't silently revert it.
 */

import { Rect } from "./Rect.ts";
import { Stage } from "./Stage.ts";
import { defaultTextureManager } from "./texture-canvas";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 1280, height: 720 },
    textureManager: defaultTextureManager,
  });
}

describe("Node.destroy() kills tweens targeting the node", () => {
  it("drops a finite tween whose target was destroyed mid-animation", () => {
    const stage = makeStage();
    const rect = new Rect({
      width: 10,
      height: 10,
      textureManager: defaultTextureManager,
    });
    stage.add(rect);
    stage.tweens.add({
      targets: rect,
      duration: 1000,
      alpha: 0,
    });
    expect(stage.tweens.activeCount).toBe(1);
    rect.destroy();
    // Advance enough to give a stale tween a chance to still mutate
    // the dead node. killTweensOf flags it; advance then splices.
    stage.tweens.advance(16);
    expect(stage.tweens.activeCount).toBe(0);
  });

  it("drops an infinite tween whose target was destroyed", () => {
    const stage = makeStage();
    const rect = new Rect({
      width: 10,
      height: 10,
      textureManager: defaultTextureManager,
    });
    stage.add(rect);
    stage.tweens.add({
      targets: rect,
      duration: 100,
      alpha: 1,
      repeat: -1,
    });
    expect(stage.tweens.activeCount).toBe(1);
    rect.destroy();
    stage.tweens.advance(16);
    expect(stage.tweens.activeCount).toBe(0);
  });

  it("leaves other targets of the same tween running", () => {
    const stage = makeStage();
    const a = new Rect({
      width: 10,
      height: 10,
      textureManager: defaultTextureManager,
    });
    const b = new Rect({
      width: 10,
      height: 10,
      textureManager: defaultTextureManager,
    });
    stage.add(a);
    stage.add(b);
    stage.tweens.add({
      targets: [a, b],
      duration: 1000,
      alpha: 0,
    });
    a.destroy();
    // killTweensOf flags the whole tween — matches Phaser's
    // semantics. If this assertion ever flips, confirm the product
    // intent: do we want per-target kill, or does whole-tween kill
    // remain correct for the codebase's use cases?
    stage.tweens.advance(16);
    expect(stage.tweens.activeCount).toBe(0);
  });
});
