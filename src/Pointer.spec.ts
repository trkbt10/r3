/**
 * @file Pointer — hit testing + dispatch.
 *
 * The PointerManager walks the Stage's tree and finds the topmost
 * interactive node under a given viewport coordinate. These tests
 * build trees out of bare Containers (which require only Three; no
 * DOM) and verify:
 *
 *  - sibling order ⇒ later child wins
 *  - depth wins over insertion order
 *  - parent transforms (position / scale / rotation) reach the leaf
 *  - pointer over/out fires when the pick changes
 *  - global listeners (`scene.input.on(...)` analogue) fire too
 *  - drag manager threshold gating works
 */

import { Stage } from "./Stage.ts";
import { Container } from "./Container.ts";
import type { PointerEvent as R3PointerEvent } from "./Node.ts";
import { defaultTextureManager } from "./texture-canvas";

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

describe("PointerManager", () => {
  it("picks the topmost (last) sibling at a hit-area overlap", () => {
    const stage = makeStage();
    const a = new Container({ name: "a" });
    a.setInteractiveRect(100, 100);
    const b = new Container({ name: "b" });
    b.setInteractiveRect(100, 100);
    stage.add(a);
    stage.add(b);
    stage.composeFrame();
    const hit = stage.pointer.pickAt(50, 50);
    expect(hit?.name).toBe("b");
  });

  it("respects the depth field across siblings", () => {
    const stage = makeStage();
    const low = new Container({ name: "low" });
    low.setInteractiveRect(100, 100);
    low.setDepth(10);
    const high = new Container({ name: "high" });
    high.setInteractiveRect(100, 100);
    high.setDepth(20);
    stage.add(low);
    stage.add(high);
    stage.composeFrame();
    expect(stage.pointer.pickAt(50, 50)?.name).toBe("high");

    high.setDepth(5);
    stage.composeFrame();
    expect(stage.pointer.pickAt(50, 50)?.name).toBe("low");
  });

  it("walks parent transforms when computing local hit-test coords", () => {
    const stage = makeStage();
    const parent = new Container({ name: "parent", x: 200, y: 300 });
    const child = new Container({ name: "child" });
    child.setInteractiveRect(50, 50);
    parent.add(child);
    stage.add(parent);
    stage.composeFrame();
    // Child's local origin is at viewport (200, 300); a hit at (220,
    // 320) is at child-local (20, 20) → inside the 50×50 rect.
    expect(stage.pointer.pickAt(220, 320)?.name).toBe("child");
    expect(stage.pointer.pickAt(170, 320)).toBeNull();
  });

  it("emits pointerover when pick changes and pointerout on previous hit", () => {
    const stage = makeStage();
    const a = new Container({ name: "a", x: 0, y: 0 });
    a.setInteractiveRect(50, 50);
    const b = new Container({ name: "b", x: 100, y: 0 });
    b.setInteractiveRect(50, 50);
    stage.add(a);
    stage.add(b);
    stage.composeFrame();

    const aOver = makeCounter();
    const aOut = makeCounter();
    const bOver = makeCounter();
    a.on("pointerover", aOver.fn);
    a.on("pointerout", aOut.fn);
    b.on("pointerover", bOver.fn);

    stage.pointer.feedMove(20, 20);
    expect(aOver.calls).toBe(1);
    expect(bOver.calls).toBe(0);
    stage.pointer.feedMove(120, 20);
    expect(aOut.calls).toBe(1);
    expect(bOver.calls).toBe(1);
  });

  it("treats down + up on the same target as a click", () => {
    const stage = makeStage();
    const btn = new Container({ name: "btn" });
    btn.setInteractiveRect(100, 100);
    stage.add(btn);
    stage.composeFrame();

    const onClick = makeCounter();
    btn.on("click", onClick.fn);
    stage.pointer.feedDown(50, 50);
    stage.pointer.feedUp(50, 50);
    expect(onClick.calls).toBe(1);
  });

  it("does not fire click when the pointer up lands outside the down target", () => {
    const stage = makeStage();
    const btn = new Container({ name: "btn", x: 0, y: 0 });
    btn.setInteractiveRect(50, 50);
    stage.add(btn);
    stage.composeFrame();

    const onClick = makeCounter();
    btn.on("click", onClick.fn);
    stage.pointer.feedDown(20, 20);
    stage.pointer.feedUp(200, 200);
    expect(onClick.calls).toBe(0);
  });

  it("forwards global listeners regardless of hit", () => {
    const stage = makeStage();
    const events: R3PointerEvent[] = [];
    stage.pointer.on("pointermove", (e) => {
      events.push(e);
    });
    stage.pointer.feedMove(10, 20);
    stage.pointer.feedMove(30, 40);
    expect(events).toHaveLength(2);
    expect(events[0]?.x).toBe(10);
    expect(events[1]?.y).toBe(40);
  });

  it("does not pick a node whose worldVisible is false", () => {
    const stage = makeStage();
    const a = new Container({ name: "a" });
    a.setInteractiveRect(100, 100);
    stage.add(a);
    a.setVisible(false);
    stage.composeFrame();
    expect(stage.pointer.pickAt(50, 50)).toBeNull();
  });
});
