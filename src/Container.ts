/**
 * @file Container — group of child r3 Nodes.
 *
 * Containers hold no visible geometry of their own; their job is
 * transform propagation (Three's scene graph does the math for us)
 * plus alpha / visibility / renderOrder composition.
 *
 * ## Semantic parity with Phaser
 *
 * Phaser's `GameObjects.Container` has a transform, an alpha, a
 * visibility flag, a depth, and an ordered children list. All of
 * those are preserved. One intentional divergence: `setSize(w, h)` is
 * omitted because every consumer that used it was combining it with
 * `setInteractive()` — we surface that as `setInteractiveRect(w, h)`
 * instead, which keeps the hit area explicit and decoupled from the
 * render box (containers don't render, so a "render box" was always
 * a lie in Phaser too).
 */

import { Node, type NodeOptions, type Rect } from "./Node.ts";
import type { Plane } from "three";
import type { Stage } from "./Stage.ts";

export type ContainerOptions = NodeOptions;

/** Ordered collection of child Nodes. */
export class Container extends Node {
  protected readonly _children: Node[];
  /**
   * Remembered clipping planes, if any, set via
   * {@link setClippingPlanes}. Stored so that children added *after*
   * the planes were installed still inherit them — consumers like
   * {@link import("./widgets/ScrollablePanel.ts").R3ScrollablePanel}
   * depend on this to keep late-arriving rows clipped to the viewport.
   */
  private _clippingPlanes: readonly Plane[] | null = null;

  constructor(options: ContainerOptions = {}) {
    super(options);
    this._children = [];
  }

  get children(): readonly Node[] {
    return this._children;
  }

  get length(): number {
    return this._children.length;
  }

  /**
   * Appends `child` to the end of the list so it paints on top of
   * earlier children. Removes from any previous parent first.
   */
  add(child: Node): this {
    if (child === (this as Node)) {
      throw new Error("Container.add: cannot add container to itself");
    }
    const existingParent = child.parent;
    if (existingParent) {
      if (existingParent === this) {
        return this;
      }
      existingParent.removeChild(child);
    }
    this._children.push(child);
    this.obj3d.add(child.obj3d);
    child._attachToParent(this);
    if (this._clippingPlanes !== null) {
      child.setClippingPlanes(this._clippingPlanes);
    }
    return this;
  }

  /** Convenience for adding many children at once. */
  addAll(children: readonly Node[]): this {
    for (const c of children) {
      this.add(c);
    }
    return this;
  }

  /**
   * Detaches `child` from this container without destroying it. Use
   * `destroy()` on the child (or `removeAll(true)` here) when the
   * caller also wants the Three resources released.
   */
  removeChild(child: Node): this {
    const idx = this._children.indexOf(child);
    if (idx < 0) {
      return this;
    }
    this._children.splice(idx, 1);
    this.obj3d.remove(child.obj3d);
    child._attachToParent(null);
    return this;
  }

  /**
   * Removes every child. When `destroyChildren` is true, each child's
   * `destroy()` runs (releasing its Three resources) — matches
   * `Phaser.GameObjects.Container#removeAll(true)`.
   */
  removeAll(destroyChildren = false): this {
    const snapshot = this._children.slice();
    for (const c of snapshot) {
      this.removeChild(c);
      if (destroyChildren) {
        c.destroy();
      }
    }
    return this;
  }

  /**
   * Interactive rect whose top-left coincides with the container's
   * origin. Containers without a hit area still let pointer events
   * flow through to descendants.
   */
  setInteractiveRect(width: number, height: number): this {
    this.setInteractive({ x: 0, y: 0, width, height });
    return this;
  }

  /**
   * Clears a previously set interactive rect. Equivalent to
   * `setInteractive(null)`.
   */
  disableInteractive(): this {
    this.setInteractive(null);
    return this;
  }

  /* ── world-state composition ───────────────────────────────────── */

  override composeWorldState(parentAlpha: number, parentVisible: boolean): void {
    super.composeWorldState(parentAlpha, parentVisible);
    for (const child of this._children) {
      child.composeWorldState(this._worldAlpha, this._worldVisible);
    }
  }

  override composeRenderOrder(counter: number, ancestorDepthOffset: number): number {
    const localOffset = ancestorDepthOffset + this.depth * CONTAINER_DEPTH_MULT;
    // Container itself doesn't claim a renderOrder slot; its children
    // do. Recurse in order so later children paint on top.
    return this._children.reduce<number>(
      (acc, child) => child.composeRenderOrder(acc, localOffset),
      counter,
    );
  }

  override propagateStage(stage: Stage | null): void {
    super.propagateStage(stage);
    for (const child of this._children) {
      child._attachToStage(stage);
    }
  }

  override setClippingPlanes(planes: readonly Plane[] | null): void {
    this._clippingPlanes = planes;
    super.setClippingPlanes(planes);
    for (const child of this._children) {
      child.setClippingPlanes(planes);
    }
  }

  override destroy(): void {
    this.removeAll(true);
    super.destroy();
  }

  /** Interactive rect override: containers default `hitArea` to null. */
  override get hitArea(): Rect | null {
    return this._hitArea;
  }
}

/**
 * Multiplier on `depth` when propagating into the renderOrder of a
 * container's descendants. Same scale as {@link Node.DEPTH_SCALE}; a
 * copy here keeps the dependency one-way (Node has no knowledge of
 * Container).
 */
const CONTAINER_DEPTH_MULT = 1000;
