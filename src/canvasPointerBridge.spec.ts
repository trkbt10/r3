/**
 * @file canvasPointerBridge.spec module.
 */
// @vitest-environment happy-dom

import { Stage } from "./Stage.ts";
import { attachCanvasPointerBridge } from "./canvasPointerBridge.ts";
import { defaultTextureManager } from "./texture-canvas";

function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function makeTouchEvent(
  type: "touchstart" | "touchmove" | "touchend" | "touchcancel",
  point: { readonly identifier: number; readonly clientX: number; readonly clientY: number },
): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  const list = {
    length: 1,
    item: (index: number) => (index === 0 ? point : null),
    0: point,
    [Symbol.iterator]: function* touchIterator() {
      yield point;
    },
  };
  if (!isTouchList(list)) {
    throw new Error("canvasPointerBridge.spec: invalid touch list");
  }
  Object.defineProperty(event, "changedTouches", { value: list });
  Object.defineProperty(event, "touches", { value: type === "touchend" || type === "touchcancel" ? emptyTouchList() : list });
  return event;
}

function emptyTouchList(): TouchList {
  const list = {
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* emptyTouchIterator() {},
  };
  if (!isTouchList(list)) {
    throw new Error("canvasPointerBridge.spec: invalid empty touch list");
  }
  return list;
}

function isTouchList(value: unknown): value is TouchList {
  return typeof value === "object" && value !== null && "item" in value && Symbol.iterator in value;
}

describe("attachCanvasPointerBridge", () => {
  it("keeps one mouse press in the same mapping space across resize", () => {
    const stage = new Stage({
      screen: { width: 1000, height: 500 },
      textureManager: defaultTextureManager,
    });
    const canvas = document.createElement("canvas");
    const rect = { value: makeRect(0, 0, 100, 100) };
    canvas.getBoundingClientRect = () => rect.value;
    const points: Array<{ readonly type: string; readonly x: number; readonly y: number }> = [];
    stage.pointer.on("pointerdown", (e) => points.push({ type: e.type, x: e.x, y: e.y }));
    stage.pointer.on("pointerup", (e) => points.push({ type: e.type, x: e.x, y: e.y }));

    const handle = attachCanvasPointerBridge({ canvas, stage });
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 50, clientY: 50, button: 0, bubbles: true }));
    rect.value = makeRect(100, 80, 200, 160);
    stage.setScreen({ width: 2000, height: 1000 });
    canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: 50, clientY: 50, button: 0, bubbles: true }));

    expect(points).toEqual([
      { type: "pointerdown", x: 500, y: 250 },
      { type: "pointerup", x: 500, y: 250 },
    ]);
    handle.dispose();
    stage.destroy();
  });

  it("uses the current mapping for the next interaction after a resize", () => {
    const stage = new Stage({
      screen: { width: 1000, height: 500 },
      textureManager: defaultTextureManager,
    });
    const canvas = document.createElement("canvas");
    const rect = { value: makeRect(0, 0, 100, 100) };
    canvas.getBoundingClientRect = () => rect.value;
    const downs: Array<{ readonly x: number; readonly y: number }> = [];
    stage.pointer.on("pointerdown", (e) => downs.push({ x: e.x, y: e.y }));

    const handle = attachCanvasPointerBridge({ canvas, stage });
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 50, clientY: 50, button: 0, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: 50, clientY: 50, button: 0, bubbles: true }));
    rect.value = makeRect(100, 80, 200, 160);
    stage.setScreen({ width: 2000, height: 1000 });
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 200, clientY: 160, button: 0, bubbles: true }));

    expect(downs).toEqual([
      { x: 500, y: 250 },
      { x: 1000, y: 500 },
    ]);
    handle.dispose();
    stage.destroy();
  });

  it("keeps one touch press in the same mapping space across resize", () => {
    const stage = new Stage({
      screen: { width: 1000, height: 500 },
      textureManager: defaultTextureManager,
    });
    const canvas = document.createElement("canvas");
    const rect = { value: makeRect(0, 0, 100, 100) };
    canvas.getBoundingClientRect = () => rect.value;
    const points: Array<{ readonly type: string; readonly x: number; readonly y: number }> = [];
    stage.pointer.on("pointerdown", (e) => points.push({ type: e.type, x: e.x, y: e.y }));
    stage.pointer.on("pointerup", (e) => points.push({ type: e.type, x: e.x, y: e.y }));

    const handle = attachCanvasPointerBridge({ canvas, stage });
    canvas.dispatchEvent(makeTouchEvent("touchstart", { identifier: 12, clientX: 50, clientY: 50 }));
    rect.value = makeRect(100, 80, 200, 160);
    stage.setScreen({ width: 2000, height: 1000 });
    canvas.dispatchEvent(makeTouchEvent("touchend", { identifier: 12, clientX: 50, clientY: 50 }));

    expect(points).toEqual([
      { type: "pointerdown", x: 500, y: 250 },
      { type: "pointerup", x: 500, y: 250 },
    ]);
    handle.dispose();
    stage.destroy();
  });
});
