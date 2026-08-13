/**
 * @file DOM canvas → `stage.pointer` forwarder.
 *
 * Every r3 host (the game entry in `src/main.ts`, the catalog preview
 * harness, the sandbox harness, the HUD preview) needs to translate
 * browser pointer events (mouse + touch + wheel) into the logical
 * coordinate space of the stage and feed them to
 * {@link PointerManager}. Before this helper existed each host wrote
 * its own copy of the forwarding loop; they drifted subtly — the
 * sandbox harness in particular was missing the bridge entirely, so
 * every sandbox case rendered correctly but accepted no clicks.
 *
 * Centralising the bridge here means:
 *
 *  - a single site to fix pointer-coordinate mapping when the canvas
 *    layout policy evolves;
 *  - sandbox cases become interactive by default once the harness
 *    opts in — no per-case `addEventListener` boilerplate;
 *  - touch handling (multi-finger → primary-pointer reduction,
 *    passive flag on wheel) stays consistent across surfaces.
 *
 * The bridge does NOT assume a particular CSS sizing. The logical
 * extent comes from the {@link Stage} that's handed in: every event
 * is mapped against `stage.screen`. Hosts no longer pass loose
 * width/height — making the contract structural instead of arithmetic
 * means a future stage-resize automatically retargets the pointer
 * mapping without each host updating two extra arguments.
 */

import type { Stage } from "./Stage.ts";

export type CanvasPointerBridgeOptions = {
  readonly canvas: HTMLCanvasElement;
  readonly stage: Stage;
};

export type CanvasPointerBridgeHandle = {
  /** Detaches every listener the bridge installed. */
  readonly dispose: () => void;
};

/** Result of mapping a DOM client point into stage-logical pixels. */
type LogicalPoint = { readonly x: number; readonly y: number };

type MappingSnapshot = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
};

function currentMappingSnapshot(canvas: HTMLCanvasElement, stage: Stage): MappingSnapshot | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    logicalWidth: stage.screen.width,
    logicalHeight: stage.screen.height,
  };
}

function mapClientToLogical(
  snapshot: MappingSnapshot,
  clientX: number,
  clientY: number,
): LogicalPoint {
  return {
    x: ((clientX - snapshot.left) / snapshot.width) * snapshot.logicalWidth,
    y: ((clientY - snapshot.top) / snapshot.height) * snapshot.logicalHeight,
  };
}

/**
 * Attaches mouse + touch + wheel + contextmenu listeners to the
 * canvas and forwards them to the stage's pointer manager. Returns
 * a handle whose `dispose()` removes every listener so hot-reload
 * re-boots don't accumulate duplicates.
 */
export function attachCanvasPointerBridge(
  options: CanvasPointerBridgeOptions,
): CanvasPointerBridgeHandle {
  const { canvas, stage } = options;
  const disposers: Array<() => void> = [];

  function addListener<K extends keyof HTMLElementEventMap>(
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void {
    canvas.addEventListener(type, handler, options);
    disposers.push(() => {
      canvas.removeEventListener(type, handler, options);
    });
  }

  function addWindowListener<K extends keyof WindowEventMap>(
    type: K,
    handler: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void {
    window.addEventListener(type, handler, options);
    disposers.push(() => {
      window.removeEventListener(type, handler, options);
    });
  }

  const activeMouseMapping: { value: MappingSnapshot | null } = { value: null };
  const activeTouchMappings = new Map<number, MappingSnapshot>();
  const pinchState: { lastDistance: number | null; snapshot: MappingSnapshot | null } = {
    lastDistance: null,
    snapshot: null,
  };

  const forwardMouse = (type: "mousedown" | "mousemove" | "mouseup", e: MouseEvent): void => {
    if (type === "mousedown") {
      activeMouseMapping.value = currentMappingSnapshot(canvas, stage);
    }
    const snapshot = activeMouseMapping.value ?? currentMappingSnapshot(canvas, stage);
    if (!snapshot) {
      return;
    }
    const mapped = mapClientToLogical(snapshot, e.clientX, e.clientY);
    if (type === "mousedown") {
      stage.pointer.feedDown(mapped.x, mapped.y, e.button);
    } else if (type === "mouseup") {
      stage.pointer.feedUp(mapped.x, mapped.y, e.button);
      activeMouseMapping.value = null;
    } else {
      stage.pointer.feedMove(mapped.x, mapped.y);
    }
    if (e.cancelable) {
      e.preventDefault();
    }
  };

  addListener("mousedown", (e) => forwardMouse("mousedown", e));
  addListener("mousemove", (e) => forwardMouse("mousemove", e));
  addListener("mouseup", (e) => forwardMouse("mouseup", e));
  addListener("mouseleave", () => {
    if (activeMouseMapping.value === null) {
      return;
    }
    // Keep a pressed drag alive after leaving the canvas; window-level
    // move/up below will settle it. A non-pressed hover can cancel.
    if (!stage.pointerSnapshot.isDown) {
      activeMouseMapping.value = null;
      stage.pointer.feedCancel();
    }
  });
  addWindowListener("mousemove", (e) => {
    if (activeMouseMapping.value === null || !stage.pointerSnapshot.isDown) {
      return;
    }
    forwardMouse("mousemove", e);
  });
  addWindowListener("mouseup", (e) => {
    if (activeMouseMapping.value === null) {
      return;
    }
    forwardMouse("mouseup", e);
  });
  addWindowListener("blur", () => {
    activeMouseMapping.value = null;
    activeTouchMappings.clear();
    stage.pointer.feedCancel();
  });

  addListener(
    "wheel",
    (e: WheelEvent) => {
      const snapshot = currentMappingSnapshot(canvas, stage);
      if (!snapshot) {
        return;
      }
      const mapped = mapClientToLogical(snapshot, e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        stage.pointer.feedPinch(mapped.x, mapped.y, Math.exp(-e.deltaY * 0.002));
        e.preventDefault();
        return;
      }
      stage.pointer.feedWheel(mapped.x, mapped.y, e.deltaY);
      e.preventDefault();
    },
    { passive: false },
  );

  const forwardTouch = (type: "touchstart" | "touchmove" | "touchend" | "touchcancel", e: TouchEvent): void => {
    if (e.touches.length >= 2) {
      const snapshot = pinchState.snapshot ?? currentMappingSnapshot(canvas, stage);
      const a = e.touches.item(0);
      const b = e.touches.item(1);
      if (!snapshot || !a || !b) {
        return;
      }
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const center = mapClientToLogical(snapshot, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      if (type === "touchstart" || pinchState.lastDistance === null) {
        pinchState.snapshot = snapshot;
        pinchState.lastDistance = distance;
      } else if (distance > 1 && pinchState.lastDistance > 1) {
        stage.pointer.feedPinch(center.x, center.y, distance / pinchState.lastDistance);
        pinchState.lastDistance = distance;
      }
      if (e.cancelable) {
        e.preventDefault();
      }
      return;
    }
    if (type === "touchend" || type === "touchcancel") {
      pinchState.lastDistance = null;
      pinchState.snapshot = null;
    }
    // Multi-touch isn't modelled — UI use cases are single-pointer.
    // Take the first changedTouch (falls back to the primary active
    // touch) and drop the rest.
    const t = e.changedTouches.item(0) ?? e.touches.item(0);
    if (!t) {
      if (type === "touchend" || type === "touchcancel") {
        activeTouchMappings.clear();
        stage.pointer.feedCancel();
      }
      return;
    }
    if (type === "touchstart") {
      const snapshot = currentMappingSnapshot(canvas, stage);
      if (!snapshot) {
        return;
      }
      activeTouchMappings.set(t.identifier, snapshot);
    }
    const snapshot = activeTouchMappings.get(t.identifier) ?? currentMappingSnapshot(canvas, stage);
    if (!snapshot) {
      return;
    }
    const mapped = mapClientToLogical(snapshot, t.clientX, t.clientY);
    if (type === "touchstart") {
      stage.pointer.feedDown(mapped.x, mapped.y, 0, t.identifier);
    } else if (type === "touchmove") {
      stage.pointer.feedMove(mapped.x, mapped.y, t.identifier);
    } else if (type === "touchend") {
      stage.pointer.feedUp(mapped.x, mapped.y, 0, t.identifier);
      activeTouchMappings.delete(t.identifier);
    } else {
      activeTouchMappings.delete(t.identifier);
      stage.pointer.feedCancel();
    }
    if (e.cancelable) {
      e.preventDefault();
    }
  };

  addListener("touchstart", (e) => forwardTouch("touchstart", e), { passive: false });
  addListener("touchmove", (e) => forwardTouch("touchmove", e), { passive: false });
  addListener("touchend", (e) => forwardTouch("touchend", e), { passive: false });
  addListener("touchcancel", (e) => forwardTouch("touchcancel", e), { passive: false });

  addListener("contextmenu", (e) => {
    e.preventDefault();
  });

  return {
    dispose: () => {
      activeMouseMapping.value = null;
      activeTouchMappings.clear();
      for (const d of disposers) {
        d();
      }
    },
  };
}
