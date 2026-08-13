/**
 * @file Drag — drag-and-drop layer atop {@link PointerManager}.
 *
 * The Phaser-side equivalents (`scene.input.setDraggable`, the
 * `dragstart`/`drag`/`dragend` event family) are heavily used by the
 * skill / pad editors. This module implements the same shape:
 *
 *  - A Node opts in via `drag.attach(node, options)`. Subsequent
 *    pointer-down on the node starts a *candidate* drag — the drag
 *    only "begins" once the pointer has moved more than `threshold`
 *    pixels from its origin. Below the threshold the gesture remains
 *    a tap, so a button inside a draggable card still receives clicks.
 *  - Once dragging, `onDrag` fires with the latest pointer position
 *    on every pointermove. The handler is responsible for updating
 *    the node's position (or animating a ghost). The drag manager
 *    itself does NOT mutate the node — Phaser also leaves placement
 *    to the caller.
 *  - `onDragEnd` fires on pointerup or cancel; `onDragCancel` fires
 *    when the drag never began (release before threshold).
 *
 * Multi-pointer is intentionally NOT supported (the existing Phaser
 * usage assumes single-pointer DnD). The first active drag wins
 * until release.
 */

import type { PointerManager } from "./Pointer.ts";
import type { Node } from "./Node.ts";

export type DragHandlers = {
  /** Pointer position at drag start (in viewport pixels). */
  readonly onDragStart?: (info: { x: number; y: number }) => void;
  /** Latest pointer position (viewport pixels) and delta from start. */
  readonly onDrag?: (info: { x: number; y: number; dx: number; dy: number }) => void;
  /** Fires on release while dragging. Mirrors Phaser dragend. */
  readonly onDragEnd?: (info: { x: number; y: number }) => void;
  /** Fires on release before the drag threshold was crossed. */
  readonly onDragCancel?: () => void;
};

export type DragOptions = DragHandlers & {
  /**
   * Pixel movement required from the pointer-down origin before the
   * gesture is considered a drag rather than a tap. Defaults to 6
   * (matches the swipe threshold used by ScrollModel).
   */
  readonly threshold?: number;
};

type DragRegistration = DragOptions & {
  readonly node: Node;
};

type DragGesture = {
  readonly registration: DragRegistration;
  readonly startX: number;
  readonly startY: number;
  /** Set true once the gesture crossed the threshold. */
  began: boolean;
};

/** Drag-and-drop coordinator built on a {@link PointerManager}. */
export class DragManager {
  private readonly pointer: PointerManager;
  private readonly registrations: Map<Node, DragRegistration>;
  private gesture: DragGesture | null;
  private readonly disposers: Array<() => void>;

  constructor(pointer: PointerManager) {
    this.pointer = pointer;
    this.registrations = new Map();
    this.gesture = null;
    this.disposers = [];

    // Drag is driven by global pointer events on the stage so the
    // gesture survives the pointer leaving the originating node mid-
    // drag (which would happen as soon as the node is dragged out
    // from under the pointer otherwise).
    this.disposers.push(this.pointer.on("pointermove", (e) => {
      this.onPointerMove(e.x, e.y);
    }));
    this.disposers.push(this.pointer.on("pointerup", (e) => {
      this.onPointerUp(e.x, e.y);
    }));
  }

  /**
   * Marks `node` draggable. Each node has at most one registration —
   * a second `attach` for the same node replaces the prior options.
   * Returns a disposer that removes the registration.
   *
   * The node must have a `hitArea` for the underlying pointerdown
   * to fire — `attach` does not implicitly call setInteractive(),
   * because the right hit-area depends on the node type (a Rect
   * defaults to its full extent; a Container needs an explicit
   * setInteractiveRect call).
   */
  attach(node: Node, options: DragOptions = {}): () => void {
    const registration: DragRegistration = { node, ...options };
    this.registrations.set(node, registration);

    const downListener = (e: { readonly x: number; readonly y: number }): void => {
      this.onPointerDown(registration, e.x, e.y);
    };
    node.on("pointerdown", downListener);

    return () => {
      node.off("pointerdown", downListener);
      this.registrations.delete(node);
      if (this.gesture && this.gesture.registration.node === node) {
        // Cancel a live gesture if its node was unregistered.
        this.gesture.registration.onDragCancel?.();
        this.gesture = null;
      }
    };
  }

  /** True while a drag is currently being followed (post-threshold). */
  get dragging(): boolean {
    return this.gesture?.began === true;
  }

  /** The node currently being dragged, or null. */
  get draggingNode(): Node | null {
    if (!this.gesture || !this.gesture.began) {
      return null;
    }
    return this.gesture.registration.node;
  }

  private onPointerDown(registration: DragRegistration, x: number, y: number): void {
    // Only one active gesture at a time; a fresh down replaces an
    // earlier candidate that hadn't yet crossed the threshold.
    if (this.gesture && this.gesture.began) {
      // Mid-drag tap on another draggable — Phaser treats this as a
      // no-op (the original drag continues until pointerup).
      return;
    }
    this.gesture = {
      registration,
      startX: x,
      startY: y,
      began: false,
    };
  }

  private onPointerMove(x: number, y: number): void {
    if (!this.gesture) {
      return;
    }
    const g = this.gesture;
    const dx = x - g.startX;
    const dy = y - g.startY;
    if (!g.began) {
      const threshold = g.registration.threshold ?? DEFAULT_THRESHOLD;
      if (Math.hypot(dx, dy) < threshold) {
        return;
      }
      g.began = true;
      g.registration.onDragStart?.({ x: g.startX, y: g.startY });
    }
    g.registration.onDrag?.({ x, y, dx, dy });
  }

  private onPointerUp(x: number, y: number): void {
    if (!this.gesture) {
      return;
    }
    const g = this.gesture;
    this.gesture = null;
    if (g.began) {
      g.registration.onDragEnd?.({ x, y });
      return;
    }
    g.registration.onDragCancel?.();
  }

  /**
   * Called by {@link Node.destroy} to evict a destroyed node from
   * `registrations` and abort any live gesture that referenced it.
   * Mirrors `PointerManager.notifyNodeDestroyed`. Without this,
   * callers that forget to hold the disposer returned by
   * {@link attach} leak the Node (and its closures) as a Map key
   * living on the stage-wide {@link DragManager}.
   *
   * No user callback fires — the caller-controlled disposer path
   * is the place to wire "cancel-on-detach" semantics. This method
   * exists only to release the reference.
   */
  notifyNodeDestroyed(node: Node): void {
    if (!this.registrations.has(node)) {
      return;
    }
    this.registrations.delete(node);
    if (this.gesture && this.gesture.registration.node === node) {
      this.gesture = null;
    }
  }

  /**
   * Cancels any in-flight gesture without firing onDragEnd. Used when
   * the host environment (DOM) loses the pointer.
   */
  cancel(): void {
    if (!this.gesture) {
      return;
    }
    const g = this.gesture;
    this.gesture = null;
    if (g.began) {
      g.registration.onDragCancel?.();
    }
  }

  dispose(): void {
    for (const d of this.disposers) {
      d();
    }
    this.disposers.length = 0;
    this.registrations.clear();
    this.gesture = null;
  }
}

const DEFAULT_THRESHOLD = 6;
