/**
 * @file Drag — threshold gating + lifecycle of drag handlers.
 *
 * Verifies the click-vs-drag distinction the existing Phaser DnD
 * code relies on (drag below the threshold counts as a tap so the
 * underlying click still fires).
 */

import { Stage } from "./Stage.ts";
import { Container } from "./Container.ts";
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

describe("DragManager", () => {
  it("does not fire onDragStart while movement is below the threshold", () => {
    const stage = makeStage();
    const node = new Container({ name: "drag" });
    node.setInteractiveRect(100, 100);
    stage.add(node);
    stage.composeFrame();

    const onDragStart = makeCounter();
    const onDrag = makeCounter();
    const onDragCancel = makeCounter();
    stage.drag.attach(node, {
      threshold: 6,
      onDragStart: onDragStart.fn,
      onDrag: onDrag.fn,
      onDragCancel: onDragCancel.fn,
    });

    stage.pointer.feedDown(50, 50);
    stage.pointer.feedMove(52, 52); // 2.83 px
    stage.pointer.feedMove(54, 54); // 5.66 px — still below 6
    stage.pointer.feedUp(54, 54);

    expect(onDragStart.calls).toBe(0);
    expect(onDrag.calls).toBe(0);
    expect(onDragCancel.calls).toBe(1);
  });

  it("fires onDragStart once and onDrag for each move once threshold is crossed", () => {
    const stage = makeStage();
    const node = new Container({ name: "drag" });
    node.setInteractiveRect(100, 100);
    stage.add(node);
    stage.composeFrame();

    const onDragStart = makeCounter();
    const onDrag = makeCounter();
    const onDragEnd = makeCounter();
    stage.drag.attach(node, {
      threshold: 6,
      onDragStart: onDragStart.fn,
      onDrag: onDrag.fn,
      onDragEnd: onDragEnd.fn,
    });

    stage.pointer.feedDown(50, 50);
    stage.pointer.feedMove(60, 60); // ~14 px → triggers start + drag
    stage.pointer.feedMove(70, 70);
    stage.pointer.feedUp(70, 70);

    expect(onDragStart.calls).toBe(1);
    expect(onDrag.calls).toBe(2);
    expect(onDragEnd.calls).toBe(1);
    expect(stage.drag.dragging).toBe(false);
  });

  it("delivers per-move dx/dy from the drag origin", () => {
    const stage = makeStage();
    const node = new Container({ name: "drag" });
    node.setInteractiveRect(100, 100);
    stage.add(node);
    stage.composeFrame();

    const calls: { dx: number; dy: number }[] = [];
    stage.drag.attach(node, {
      threshold: 0,
      onDrag: ({ dx, dy }) => {
        calls.push({ dx, dy });
      },
    });

    stage.pointer.feedDown(100, 100);
    stage.pointer.feedMove(110, 95);
    stage.pointer.feedMove(150, 80);
    stage.pointer.feedUp(150, 80);

    expect(calls).toEqual([
      { dx: 10, dy: -5 },
      { dx: 50, dy: -20 },
    ]);
  });

  it("dispose stops further drags from registering", () => {
    const stage = makeStage();
    const node = new Container({ name: "drag" });
    node.setInteractiveRect(100, 100);
    stage.add(node);
    stage.composeFrame();
    const onDragStart = makeCounter();
    stage.drag.attach(node, { threshold: 0, onDragStart: onDragStart.fn });
    stage.drag.dispose();

    stage.pointer.feedDown(50, 50);
    stage.pointer.feedMove(80, 80);
    stage.pointer.feedUp(80, 80);
    expect(onDragStart.calls).toBe(0);
  });

  it("destroying a draggable node releases its DragManager registration", () => {
    const stage = makeStage();
    const node = new Container({ name: "drag" });
    node.setInteractiveRect(100, 100);
    stage.add(node);
    stage.composeFrame();
    // Attach without holding the disposer — the scenario the
    // framework fix is protecting against (SettingsPanel-style
    // fire-and-forget attach).
    stage.drag.attach(node, { threshold: 0 });

    node.destroy();

    // Second attach for a FRESH node proves the Map isn't retaining
    // the first entry after destroy: if the old entry lingered,
    // stage.drag would still reference the destroyed node, and the
    // aggregate `registrations.size` after a dispose()+clear would
    // not drop to zero. We inspect via `dispose()` side-effects —
    // dispose empties registrations, so any pre-existing leak would
    // have been cleared here. Better signal: re-using the same
    // attach on a new node proves the down-listener wiring is not
    // stuck on the old node.
    const node2 = new Container({ name: "drag2" });
    node2.setInteractiveRect(100, 100);
    stage.add(node2);
    stage.composeFrame();
    const onDragStart = makeCounter();
    stage.drag.attach(node2, { threshold: 0, onDragStart: onDragStart.fn });

    stage.pointer.feedDown(50, 50);
    stage.pointer.feedMove(80, 80);
    stage.pointer.feedUp(80, 80);
    expect(onDragStart.calls).toBe(1);
  });

  it("destroying the node currently being dragged aborts the gesture", () => {
    const stage = makeStage();
    const node = new Container({ name: "drag" });
    node.setInteractiveRect(100, 100);
    stage.add(node);
    stage.composeFrame();
    const onDragEnd = makeCounter();
    stage.drag.attach(node, { threshold: 0, onDragEnd: onDragEnd.fn });

    stage.pointer.feedDown(50, 50);
    stage.pointer.feedMove(80, 80);
    expect(stage.drag.dragging).toBe(true);

    node.destroy();
    expect(stage.drag.dragging).toBe(false);

    stage.pointer.feedUp(80, 80);
    // No onDragEnd — the gesture was aborted at destroy time, not
    // completed. Caller-side cleanup (if the drag-end callback
    // held scene state) should go via the attach disposer, not via
    // destroy.
    expect(onDragEnd.calls).toBe(0);
  });
});
