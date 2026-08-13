/**
 * @vitest-environment happy-dom
 *
 * @file TabBar — selection bookkeeping + disabled-tab inertness.
 */

import { Stage } from "../Stage.ts";
import { defaultTextureManager } from "../texture-canvas";
import { createR3TabBar } from "./TabBar.ts";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 1280, height: 720 },
    textureManager: defaultTextureManager,
  });
}

/** Counter helper used in place of vi.fn (banned by lint config). */
function makeCounter<T>(): {
  fn: (value: T) => void;
  calls: T[];
} {
  const log: T[] = [];
  return {
    fn(value: T): void {
      log.push(value);
    },
    get calls(): T[] {
      return log;
    },
  };
}

describe("createR3TabBar", () => {
  it("fires onSelect with the clicked tab id", () => {
    const stage = makeStage();
    const onSelect = makeCounter<string>();
    const bar = createR3TabBar({
      stage,
      textureManager: defaultTextureManager,
      x: 100,
      y: 200,
      tabs: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      initialId: "a",
      onSelect: onSelect.fn,
    });
    stage.composeFrame();
    // First tab — already active, click should be a no-op.
    stage.pointer.feedDown(150, 218);
    stage.pointer.feedUp(150, 218);
    expect(onSelect.calls).toEqual([]);

    // Click well past the first tab's width.
    stage.pointer.feedDown(280, 218);
    stage.pointer.feedUp(280, 218);
    expect(onSelect.calls).toEqual(["b"]);
    bar.destroy();
  });

  it("disabled tabs never fire onSelect", () => {
    const stage = makeStage();
    const onSelect = makeCounter<string>();
    const bar = createR3TabBar({
      stage,
      textureManager: defaultTextureManager,
      x: 0,
      y: 0,
      tabs: [
        { id: "a", label: "A" },
        { id: "b", label: "B", disabled: true },
      ],
      initialId: "a",
      onSelect: onSelect.fn,
    });
    stage.composeFrame();
    // Click in the b-tab area — disabled, should not fire.
    stage.pointer.feedDown(180, 18);
    stage.pointer.feedUp(180, 18);
    expect(onSelect.calls).toEqual([]);
    bar.destroy();
  });

  it("setActive updates internal state without firing onSelect", () => {
    const stage = makeStage();
    const onSelect = makeCounter<string>();
    const bar = createR3TabBar({
      stage,
      textureManager: defaultTextureManager,
      x: 0,
      y: 0,
      tabs: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      initialId: "a",
      onSelect: onSelect.fn,
    });
    bar.setActive("b");
    expect(onSelect.calls).toEqual([]);
    // Now clicking on the b-area should be inert (already active).
    stage.composeFrame();
    stage.pointer.feedDown(180, 18);
    stage.pointer.feedUp(180, 18);
    expect(onSelect.calls).toEqual([]);
    bar.destroy();
  });
});
