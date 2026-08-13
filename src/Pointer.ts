/**
 * @file Pointer — pointer-event router for the r3 stage.
 *
 * Owns the per-stage state of "where is the pointer" and translates
 * raw DOM-derived viewport coordinates into typed
 * {@link PointerEvent} payloads dispatched to:
 *
 *   - the topmost interactive Node hit by the pointer (per-node listeners)
 *   - the global stage listeners (similar to Phaser's `scene.input.on`)
 *
 * Coordinate space is logical viewport pixels — the caller (the game
 * shell) is responsible for translating from CSS-pixel client coords
 * into viewport-logical coords before calling `feed*` on this manager.
 *
 * ## Hit testing
 *
 * The router walks the Stage's tree DFS in *paint order*. Within a
 * container, later children paint on top of earlier ones, so we walk
 * children in reverse to find the topmost interactive node first.
 * The `depth` field on a Container or Node biases the order: a node
 * with `depth: 960` paints (and therefore catches input) above any
 * sibling with `depth: 0`, regardless of insertion order.
 *
 * Each interactive node carries a `hitArea` rect in node-local pixels.
 * The router transforms the pointer's viewport coords into the node's
 * local space using the node's accumulated world transform (Three's
 * `matrixWorld` inverse) and tests against the rect.
 */

import { Matrix4, Vector3 } from "three";
import type {
  Node,
  NodeEventName,
  PointerEvent as R3PointerEvent,
} from "./Node.ts";
import type { Container } from "./Container.ts";
import type { Stage } from "./Stage.ts";

/** Latest known pointer state. Read via `Stage.pointerSnapshot`. */
export type PointerSnapshot = {
  readonly x: number;
  readonly y: number;
  readonly isDown: boolean;
};

type GlobalListener = (e: R3PointerEvent) => void;

/**
 * Routes pointer events from the host environment (DOM canvas, test
 * harness, …) into r3 nodes.
 */
export class PointerManager {
  private readonly stage: Stage;
  private _x: number;
  private _y: number;
  private _isDown: boolean;
  private _activeButton: number;
  private _pointerId: number;
  private _hoveredNode: Node | null;
  private _downNode: Node | null;
  /** Toggled false by `dispose()`; suppresses further dispatch. */
  private alive: boolean;

  /** Global listeners keyed by event name. */
  private readonly globalListeners: Map<NodeEventName, Set<GlobalListener>>;

  constructor(stage: Stage) {
    this.stage = stage;
    this._x = 0;
    this._y = 0;
    this._isDown = false;
    this._activeButton = -1;
    this._pointerId = -1;
    this._hoveredNode = null;
    this._downNode = null;
    this.alive = true;
    this.globalListeners = new Map();
  }

  get snapshot(): PointerSnapshot {
    return { x: this._x, y: this._y, isDown: this._isDown };
  }

  get hovered(): Node | null {
    return this._hoveredNode;
  }

  /* ── global listener API (mirrors `scene.input.on(...)`) ───────── */

  on(event: NodeEventName, listener: GlobalListener): () => void {
    const slot = this.globalListeners.get(event) ?? new Set<GlobalListener>();
    slot.add(listener);
    this.globalListeners.set(event, slot);
    return () => this.off(event, listener);
  }

  off(event: NodeEventName, listener: GlobalListener): void {
    const slot = this.globalListeners.get(event);
    if (slot) {
      slot.delete(listener);
    }
  }

  /* ── feed methods invoked by the shell / tests ─────────────────── */

  /**
   * Updates pointer coords and dispatches `pointermove` to the
   * topmost interactive node + any over/out transitions to/from
   * previously hovered nodes.
   */
  feedMove(x: number, y: number, pointerId = -1): void {
    if (!this.alive) {
      return;
    }
    this._x = x;
    this._y = y;
    this._pointerId = pointerId;
    const hit = this.pickAt(x, y);
    if (hit !== this._hoveredNode) {
      if (this._hoveredNode) {
        this.dispatch(this._hoveredNode, "pointerout", x, y);
      }
      if (hit) {
        this.dispatch(hit, "pointerover", x, y);
      }
      this._hoveredNode = hit;
    }
    if (hit) {
      this.dispatch(hit, "pointermove", x, y);
    }
    this.dispatchGlobal("pointermove", x, y);
  }

  feedDown(x: number, y: number, button = 0, pointerId = -1): void {
    if (!this.alive) {
      return;
    }
    this._x = x;
    this._y = y;
    this._isDown = true;
    this._activeButton = button;
    this._pointerId = pointerId;
    const hit = this.pickAt(x, y);
    this._downNode = hit;
    if (hit) {
      this.dispatch(hit, "pointerdown", x, y, button);
    }
    this.dispatchGlobal("pointerdown", x, y, button);
  }

  /**
   * Releases the pointer. Fires `pointerup` on the node that was
   * under the pointer at the time of release; if that node is the
   * same as the down-node, also fires `click`. Phaser similarly
   * scopes "click" to "down + up on the same target".
   */
  feedUp(x: number, y: number, button = 0, pointerId = -1): void {
    if (!this.alive) {
      return;
    }
    this._x = x;
    this._y = y;
    this._isDown = false;
    this._activeButton = -1;
    this._pointerId = pointerId;
    const hit = this.pickAt(x, y);
    if (hit) {
      this.dispatch(hit, "pointerup", x, y, button);
    }
    if (this._downNode && hit === this._downNode) {
      this.dispatch(hit, "click", x, y, button);
    }
    if (this._downNode && this._downNode !== hit) {
      // Fire pointerup on the original down-node too so drag-style
      // interactions can clean up without requiring the up to land
      // back on themselves.
      this.dispatch(this._downNode, "pointerup", x, y, button);
    }
    this._downNode = null;
    this.dispatchGlobal("pointerup", x, y, button);
  }

  /**
   * Cancels any in-flight pointer interaction without dispatching a
   * click. Used when the host-level pointer is captured by another
   * element (window blur, touchcancel).
   */
  feedCancel(): void {
    if (!this.alive) {
      return;
    }
    this._isDown = false;
    this._downNode = null;
  }

  feedWheel(x: number, y: number, deltaY: number): void {
    if (!this.alive) {
      return;
    }
    this._x = x;
    this._y = y;
    const hit = this.pickAt(x, y);
    if (hit) {
      this.dispatch(hit, "wheel", x, y, 0, deltaY);
    }
    this.dispatchGlobal("wheel", x, y, 0, deltaY);
  }

  feedPinch(x: number, y: number, scaleDelta: number): void {
    if (!this.alive) {
      return;
    }
    this._x = x;
    this._y = y;
    this.dispatchGlobal("pinch", x, y, 0, 0, scaleDelta);
  }

  /* ── tree walking ─────────────────────────────────────────────── */

  /**
   * Returns the topmost interactive node whose `hitArea` contains
   * the pointer (in node-local pixels), or `null`. Walks the tree
   * in paint order, considering depth.
   */
  pickAt(x: number, y: number): Node | null {
    return pickRecursive(this.stage.root, x, y);
  }

  /* ── dispatch helpers ─────────────────────────────────────────── */

  private dispatch(
    node: Node,
    type: NodeEventName,
    x: number,
    y: number,
    button = 0,
    deltaY = 0,
    scaleDelta?: number,
  ): void {
    const local = transformViewportToLocal(node, x, y);
    const event: R3PointerEvent = {
      type,
      x,
      y,
      localX: local.x,
      localY: local.y,
      isDown: this._isDown,
      pointerId: this._pointerId,
      button,
      deltaY,
      ...(scaleDelta !== undefined ? { scaleDelta } : {}),
    };
    node._emit(type, event);
  }

  private dispatchGlobal(
    type: NodeEventName,
    x: number,
    y: number,
    button = 0,
    deltaY = 0,
    scaleDelta?: number,
  ): void {
    const slot = this.globalListeners.get(type);
    if (!slot || slot.size === 0) {
      return;
    }
    const event: R3PointerEvent = {
      type,
      x,
      y,
      localX: x,
      localY: y,
      isDown: this._isDown,
      pointerId: this._pointerId,
      button,
      deltaY,
      ...(scaleDelta !== undefined ? { scaleDelta } : {}),
    };
    const snapshot = Array.from(slot);
    for (const cb of snapshot) {
      cb(event);
    }
  }

  dispose(): void {
    this.alive = false;
    this.globalListeners.clear();
    this._hoveredNode = null;
    this._downNode = null;
  }

  /**
   * Called by `Node.destroy()` to evict a destroyed node from the
   * hover/down slots. Without this, the destroyed node would linger
   * in the manager until the next pointer event moved the cursor
   * elsewhere (eventually self-healing, but the node is retained in
   * the interim and would still receive dispatches — which are
   * already no-ops because its listener map is cleared, but the
   * reference retention is avoidable).
   */
  notifyNodeDestroyed(node: Node): void {
    if (this._hoveredNode === node) {
      this._hoveredNode = null;
    }
    if (this._downNode === node) {
      this._downNode = null;
    }
  }
}

/* ── tree traversal ──────────────────────────────────────────────── */

/** Structural shape a Container's `children` property probe narrows to. */
type ChildrenBearing = { readonly children?: readonly unknown[] };

/**
 * Narrows to {@link ChildrenBearing} via an `in` runtime check — no
 * `Container` value import (would create a cyclic file dependency),
 * and no `as any` / `as unknown` cast, since `in` narrowing on an
 * intersection type is enough for TypeScript to permit reading
 * `.children` afterward.
 */
function hasChildrenProperty(node: Node): node is Node & ChildrenBearing {
  return "children" in node;
}

/**
 * Type guard for Containers — keeps the picker code from importing
 * `Container` (would create a cyclic file dependency). A Container
 * exposes a `children` readonly array; leaves don't.
 */
function isContainer(node: Node): node is Container {
  // Use property-shape probe rather than instanceof so the picker
  // works in tests that stub a Container.
  return hasChildrenProperty(node) && Array.isArray(node.children);
}

/** DFS in paint order. Within a container, later children paint on top. */
function pickRecursive(node: Node, x: number, y: number): Node | null {
  if (!node.worldVisible) {
    return null;
  }
  if (!isInsideInputClippingPlanes(node, x, y)) {
    return null;
  }
  if (isContainer(node)) {
    // Sort children by their own depth + insertion order so the
    // topmost depth wins regardless of where the child sits in the
    // children list. Walk in reverse so later (top) wins.
    const ordered = orderForPicking(node.children);
    for (let i = ordered.length - 1; i >= 0; i--) {
      const child = ordered[i];
      if (!child) {
        continue;
      }
      const found = pickRecursive(child, x, y);
      if (found) {
        return found;
      }
    }
  }
  if (!node.hitArea) {
    return null;
  }
  const local = transformViewportToLocal(node, x, y);
  if (
    local.x < node.hitArea.x ||
    local.x > node.hitArea.x + node.hitArea.width ||
    local.y < node.hitArea.y ||
    local.y > node.hitArea.y + node.hitArea.height
  ) {
    return null;
  }
  return node;
}

function isInsideInputClippingPlanes(node: Node, x: number, y: number): boolean {
  const planes = node.inputClippingPlanes;
  if (!planes || planes.length === 0) {
    return true;
  }
  scratchVec.set(x, -y, 0);
  for (const plane of planes) {
    if (plane.distanceToPoint(scratchVec) < 0) {
      return false;
    }
  }
  return true;
}

/**
 * Returns children sorted ascending by depth, breaking ties by
 * original index. The caller walks the result in reverse so the
 * highest-depth (topmost-paint) child is tested first.
 */
function orderForPicking(children: readonly Node[]): readonly Node[] {
  const indexed = children.map((c, i) => ({ c, i }));
  indexed.sort((a, b) => {
    if (a.c.depth !== b.c.depth) {
      return a.c.depth - b.c.depth;
    }
    return a.i - b.i;
  });
  return indexed.map((entry) => entry.c);
}

const scratchVec = new Vector3();
const scratchInv = new Matrix4();

/**
 * Transforms a viewport-pixel point into the node's local pixel
 * frame using the node's `matrixWorld` inverse. The Y axis is
 * negated on entry/exit to swap between Phaser's y-down and Three's
 * y-up. (Three's matrixWorld already handles the rotation/scale
 * mixing across the parent chain.)
 */
function transformViewportToLocal(
  node: Node,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  node.obj3d.updateWorldMatrix(true, false);
  scratchInv.copy(node.obj3d.matrixWorld).invert();
  scratchVec.set(x, -y, 0).applyMatrix4(scratchInv);
  return { x: scratchVec.x, y: -scratchVec.y };
}
