/**
 * @file Node — base class for every r3 display object.
 *
 * ## Coordinate system
 *
 * r3 keeps Phaser's convention so the migration path stays mechanical:
 *  - X grows to the right, Y grows DOWNWARD.
 *  - Origin (0, 0) is the top-left corner of the logical viewport
 *    (1280×720 by default).
 *  - Units are logical pixels.
 *
 * Internally, every Node owns a `THREE.Group` whose `position.y` is the
 * NEGATION of the logical Y. This is the only place the y-flip is
 * applied; all consumer code reads/writes Phaser-style coords. Child
 * nodes are added to the parent Group, so transforms compose normally
 * via Three's scene graph.
 *
 * Rotation is similarly negated when writing to Three so that a
 * positive `setRotation(rad)` rotates clockwise — matching Phaser's
 * convention in a y-down screen.
 *
 * ## Pivot ("origin" in Phaser-speak)
 *
 * Pivot defaults to the top-left (0, 0) which matches Phaser's
 * non-text default. Text and Rect callers that want a centred anchor
 * pass `{ originX: 0.5, originY: 0.5 }` — the anchor maps to the
 * node's logical (x, y) just like Phaser's setOrigin.
 *
 * The visible mesh inside a leaf Node (see {@link Rect}, {@link Image},
 * {@link Text}) is offset from the Node's origin so that the pivot
 * point of the mesh lands on the node's (0, 0). The math:
 *
 *   meshLocalX = (0.5 - pivotX) * width
 *   meshLocalY = -((0.5 - pivotY) * height)   // y-down → y-up flip
 *
 * Each leaf class folds its (width, height) into the mesh's local
 * scale (Plane geometry is unit-sized) and re-runs the offset
 * formula whenever pivot or size changes.
 *
 * ## Alpha / visibility composition
 *
 * Local alpha and worldAlpha are tracked separately. The Stage walks
 * the tree once per frame (after consumer updates) and pushes
 * worldAlpha to each leaf's `material.opacity`. Visibility behaves the
 * same way: `visible` is local, `worldVisible` is the AND across
 * ancestors, and the Three Group's `.visible` is set to
 * `worldVisible`. This matches Phaser Container semantics: setting a
 * parent invisible / alpha 0 hides the entire subtree without the
 * children needing to know.
 *
 * ## Depth
 *
 * Depth is an integer used for explicit z-ordering ("put modal above
 * board"). The Stage walks the tree DFS, assigning every leaf mesh a
 * `renderOrder` = (depth offset accumulated from ancestors) * 1000 +
 * a per-frame counter. UI materials disable depth-test so the
 * renderOrder fully determines paint order.
 */

import * as THREE from "three";
import type { Plane } from "three";
import type { Container } from "./Container.ts";
import type { Stage } from "./Stage.ts";

/** Pivot ("origin" in Phaser) expressed as a fraction in [0, 1] of size. */
export type Pivot = {
  readonly x: number;
  readonly y: number;
};

/** Axis-aligned rectangle in node-local coordinates. */
export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type NodeEventName =
  | "pointerover"
  | "pointerout"
  | "pointerdown"
  | "pointerup"
  | "pointermove"
  | "click"
  | "wheel"
  | "pinch";

/**
 * Pointer event payload delivered to interactive nodes. Coordinates
 * are in logical (viewport) pixels — same space as the Stage. The
 * `localX/Y` fields express the pointer's position in the node's
 * own coordinate frame after accounting for scale + rotation, so
 * hit-respondent code can decide e.g. "did the user click the left
 * half of this button" without redoing the transform.
 */
export type PointerEvent = {
  readonly type: NodeEventName;
  /** Pointer position in viewport (logical) pixels. */
  readonly x: number;
  readonly y: number;
  /** Pointer position in the node's local pixel space. */
  readonly localX: number;
  readonly localY: number;
  /** True while a primary pointer button is depressed. */
  readonly isDown: boolean;
  /** Pointer-id from the source DOM event (-1 for touch fallback). */
  readonly pointerId: number;
  /** `0`=left, `1`=middle, `2`=right (matches DOM `MouseEvent.button`). */
  readonly button: number;
  /** Wheel delta — only meaningful for `"wheel"` events. */
  readonly deltaY: number;
  /** Multiplicative pinch scale, >1 zooms in and <1 zooms out. */
  readonly scaleDelta?: number;
};

export type NodeListener = (e: PointerEvent) => void;

/** Constructor options every Node accepts. */
export type NodeOptions = {
  readonly x?: number;
  readonly y?: number;
  readonly originX?: number;
  readonly originY?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly rotation?: number;
  readonly alpha?: number;
  readonly visible?: boolean;
  readonly depth?: number;
  /**
   * Optional name — used by debugging / inspector tools and as a tag
   * for selection. Has no effect on rendering.
   */
  readonly name?: string;
};

/** Base for every r3 display node. */
export abstract class Node {
  /**
   * Three.js group that owns this node's transform. Subclasses (Rect,
   * Image, Text) add their visible Mesh as a child. Containers add
   * other Nodes' groups as children.
   */
  readonly obj3d: THREE.Group;

  /** Logical (Phaser-style) X. Top-left is (0, 0); X grows rightward. */
  protected _x: number;
  /** Logical (Phaser-style) Y. Top-left is (0, 0); Y grows downward. */
  protected _y: number;
  protected _pivotX: number;
  protected _pivotY: number;
  protected _scaleX: number;
  protected _scaleY: number;
  /** Rotation in radians; positive rotates CLOCKWISE in screen space. */
  protected _rotation: number;
  protected _alpha: number;
  protected _visible: boolean;
  protected _depth: number;
  private _layoutMatrix: THREE.Matrix4 | null;
  /** Composed alpha after walking up to the root. Stage refreshes each frame. */
  protected _worldAlpha: number;
  protected _worldVisible: boolean;

  /** Parent in the r3 tree. `null` for nodes not yet attached. */
  protected _parent: Container | null;

  /** Owning stage — set when attached to a Stage's root container. */
  protected _stage: Stage | null;

  /** Display name for debugging. */
  readonly name: string;

  /**
   * Hit-testing rectangle in node-local pixel space. `null` means
   * "not interactive" — the node never receives pointer events. Set
   * via `setInteractive(rect)`. Subclasses may default it to their
   * visible bounds.
   */
  protected _hitArea: Rect | null;
  private _inputClippingPlanes: readonly Plane[] | null;

  /**
   * Per-event listeners. Map from event name to a Set of callbacks
   * so duplicate registration is idempotent (matches Phaser's
   * `EventEmitter` behaviour for unique listeners — close enough).
   */
  private readonly listeners: Map<NodeEventName, Set<NodeListener>>;

  /**
   * Set true on every transform/visual change; the Stage uses it as a
   * cheap "this subtree might have moved or restyled" hint when
   * propagating worldAlpha / renderOrder.
   */
  protected _transformDirty: boolean;

  constructor(options: NodeOptions) {
    this.obj3d = new THREE.Group();
    this.obj3d.name = options.name ?? "";
    this.name = options.name ?? "";
    this._x = options.x ?? 0;
    this._y = options.y ?? 0;
    this._pivotX = options.originX ?? 0;
    this._pivotY = options.originY ?? 0;
    this._scaleX = options.scaleX ?? 1;
    this._scaleY = options.scaleY ?? 1;
    this._rotation = options.rotation ?? 0;
    this._alpha = options.alpha ?? 1;
    this._visible = options.visible ?? true;
    this._depth = options.depth ?? 0;
    this._layoutMatrix = null;
    this._worldAlpha = this._alpha;
    this._worldVisible = this._visible;
    this._parent = null;
    this._stage = null;
    this._hitArea = null;
    this._inputClippingPlanes = null;
    this.listeners = new Map();
    this._transformDirty = true;
    this.applyTransform();
  }

  /* ── transform getters/setters ─────────────────────────────────── */

  get x(): number {
    return this._x;
  }

  get y(): number {
    return this._y;
  }

  get pivotX(): number {
    return this._pivotX;
  }

  get pivotY(): number {
    return this._pivotY;
  }

  get scaleX(): number {
    return this._scaleX;
  }

  get scaleY(): number {
    return this._scaleY;
  }

  get rotation(): number {
    return this._rotation;
  }

  get alpha(): number {
    return this._alpha;
  }

  get visible(): boolean {
    return this._visible;
  }

  get depth(): number {
    return this._depth;
  }

  get worldAlpha(): number {
    return this._worldAlpha;
  }

  get worldVisible(): boolean {
    return this._worldVisible;
  }

  get parent(): Container | null {
    return this._parent;
  }

  get stage(): Stage | null {
    return this._stage;
  }

  setPosition(x: number, y: number): this {
    if (x === this._x && y === this._y) {
      return this;
    }
    this._x = x;
    this._y = y;
    this.applyTransform();
    return this;
  }

  set x(value: number) {
    if (value === this._x) {
      return;
    }
    this._x = value;
    this.applyTransform();
  }

  set y(value: number) {
    if (value === this._y) {
      return;
    }
    this._y = value;
    this.applyTransform();
  }

  setOrigin(originX: number, originY?: number): this {
    const ny = originY ?? originX;
    if (originX === this._pivotX && ny === this._pivotY) {
      return this;
    }
    this._pivotX = originX;
    this._pivotY = ny;
    this.onPivotChanged();
    return this;
  }

  setScale(sx: number, sy?: number): this {
    const ny = sy ?? sx;
    if (sx === this._scaleX && ny === this._scaleY) {
      return this;
    }
    this._scaleX = sx;
    this._scaleY = ny;
    this.applyTransform();
    return this;
  }

  set scaleX(value: number) {
    if (value === this._scaleX) {
      return;
    }
    this._scaleX = value;
    this.applyTransform();
  }

  set scaleY(value: number) {
    if (value === this._scaleY) {
      return;
    }
    this._scaleY = value;
    this.applyTransform();
  }

  setRotation(rad: number): this {
    if (rad === this._rotation) {
      return this;
    }
    this._rotation = rad;
    this.applyTransform();
    return this;
  }

  set rotation(value: number) {
    this.setRotation(value);
  }

  setAlpha(alpha: number): this {
    const clamped = Math.max(0, Math.min(1, alpha));
    if (clamped === this._alpha) {
      return this;
    }
    this._alpha = clamped;
    return this;
  }

  set alpha(value: number) {
    this.setAlpha(value);
  }

  setVisible(visible: boolean): this {
    if (visible === this._visible) {
      return this;
    }
    this._visible = visible;
    return this;
  }

  set visible(value: boolean) {
    this.setVisible(value);
  }

  setDepth(depth: number): this {
    if (depth === this._depth) {
      return this;
    }
    this._depth = depth;
    return this;
  }

  set depth(value: number) {
    this.setDepth(value);
  }

  /**
   * Optional post-transform supplied by layout bindings. This lets
   * layout-authored chrome apply skew / perspective-like panel warps
   * while ordinary x/y/scale/rotation setters keep working.
   */
  setLayoutMatrix(matrix: THREE.Matrix4 | null): this {
    if (matrix === null) {
      this._layoutMatrix = null;
      this.applyTransform();
      return this;
    }
    this._layoutMatrix = matrix.clone();
    this.applyTransform();
    return this;
  }

  /* ── parenting / attachment ────────────────────────────────────── */

  /**
   * Internal — invoked by Container.add. Subclasses should not call
   * this directly; use Container.add / removeChild on the parent.
   */
  _attachToParent(parent: Container | null): void {
    this._parent = parent;
    this.propagateStage(parent?.stage ?? null);
  }

  /**
   * Internal — used by {@link Stage} to attach its root container.
   * Bypasses the parent linkage (the root has no parent) and
   * propagates stage downward through any pre-existing children.
   */
  _attachToStage(stage: Stage | null): void {
    this.propagateStage(stage);
  }

  /**
   * Walks descendants assigning the resolved Stage. Triggered when a
   * subtree is reparented. Stage is needed for input registration and
   * for the per-frame composite pass.
   */
  protected propagateStage(stage: Stage | null): void {
    this._stage = stage;
    // Subclasses with children override this method to recurse.
  }

  /* ── hit testing ───────────────────────────────────────────────── */

  /**
   * Marks this node as interactive with `rect` in node-local pixels.
   * Pass `null` to clear interactivity. Subclasses with a natural
   * bounds (Rect, Image, Text) call this with their own size by
   * default when their config asks for `interactive: true`.
   */
  setInteractive(rect: Rect | null): this {
    this._hitArea = rect;
    return this;
  }

  get hitArea(): Rect | null {
    return this._hitArea;
  }

  get inputClippingPlanes(): readonly Plane[] | null {
    return this._inputClippingPlanes;
  }

  /* ── events ────────────────────────────────────────────────────── */

  on(event: NodeEventName, listener: NodeListener): this {
    const slot = this.listeners.get(event) ?? new Set<NodeListener>();
    slot.add(listener);
    this.listeners.set(event, slot);
    return this;
  }

  off(event: NodeEventName, listener: NodeListener): this {
    const slot = this.listeners.get(event);
    if (slot) {
      slot.delete(listener);
    }
    return this;
  }

  once(event: NodeEventName, listener: NodeListener): this {
    const wrapper: NodeListener = (e) => {
      this.off(event, wrapper);
      listener(e);
    };
    return this.on(event, wrapper);
  }

  removeAllListeners(event?: NodeEventName): this {
    if (event === undefined) {
      this.listeners.clear();
      return this;
    }
    this.listeners.delete(event);
    return this;
  }

  /**
   * Emits an event to local listeners. Pointer events are emitted by
   * the Stage's PointerManager after hit-testing; gameplay code does
   * not call this directly.
   */
  _emit(event: NodeEventName, payload: PointerEvent): void {
    const slot = this.listeners.get(event);
    if (!slot || slot.size === 0) {
      return;
    }
    // Snapshot to avoid re-entrancy issues if a handler unsubscribes.
    const snapshot = Array.from(slot);
    for (const cb of snapshot) {
      cb(payload);
    }
  }

  hasListener(event: NodeEventName): boolean {
    const slot = this.listeners.get(event);
    if (!slot) {
      return false;
    }
    return slot.size > 0;
  }

  /* ── world-state composition (called by Stage's per-frame walk) ── */

  /**
   * Re-derives `worldAlpha` and `worldVisible` from this node's local
   * values + the parent's already-resolved world values. Containers
   * override to recurse into children. Leaf classes also update their
   * material opacity to reflect the new alpha.
   */
  composeWorldState(parentAlpha: number, parentVisible: boolean): void {
    this._worldAlpha = this._alpha * parentAlpha;
    this._worldVisible = this._visible && parentVisible;
    this.obj3d.visible = this._worldVisible;
    this.applyMaterialAlpha(this._worldAlpha);
  }

  /**
   * Hook for leaf classes — Container has no material, so it ignores;
   * Rect/Image/Text override to push opacity into their MeshBasicMaterial.
   */
  protected applyMaterialAlpha(alpha: number): void {
    // Default: no-op for non-leaf nodes.
    void alpha;
  }

  /**
   * Pushes a list of world-space clipping planes into this node's
   * material(s). Pass `null` to clear. Containers recurse into their
   * children. Used by ScrollablePanel to clip overflowing content
   * to its viewport rect.
   *
   * Default: no-op for non-leaf nodes; leaves override to push the
   * planes into their `MeshBasicMaterial`. Three's renderer must
   * have `localClippingEnabled = true` for the planes to take
   * effect.
   */
  setClippingPlanes(planes: readonly Plane[] | null): void {
    this._inputClippingPlanes = planes;
  }

  /**
   * Walks descendants and assigns each visible mesh a renderOrder.
   * The walk runs DFS; the counter passed in is the next available
   * order. The depth field shifts the entire subtree by `depth *
   * DEPTH_SCALE` so an explicit `setDepth(960)` moves a modal above
   * a renderOrder=200 sibling without ordering arithmetic.
   *
   * Returns the next-available counter so siblings are numbered
   * sequentially.
   */
  composeRenderOrder(counter: number, ancestorDepthOffset: number): number {
    const localOffset = ancestorDepthOffset + this._depth * DEPTH_SCALE;
    return this.assignRenderOrderForSelf(counter, localOffset);
  }

  /**
   * Hook for leaves to set their mesh's `renderOrder`. Containers
   * recurse into children. Returns the next counter to use.
   */
  protected assignRenderOrderForSelf(counter: number, depthOffset: number): number {
    // Default: claim one counter slot. Subclasses override.
    void depthOffset;
    return counter + 1;
  }

  /* ── transform application ─────────────────────────────────────── */

  /**
   * Pushes (x, y, rotation, scale) into the underlying Three.Group.
   * Y is negated (Phaser y-down → Three y-up) and rotation is
   * negated (clockwise screen → counter-clockwise three).
   */
  protected applyTransform(): void {
    if (this._layoutMatrix === null) {
      this.obj3d.matrixAutoUpdate = true;
      this.obj3d.position.set(this._x, -this._y, 0);
      this.obj3d.rotation.set(0, 0, -this._rotation);
      this.obj3d.scale.set(this._scaleX, this._scaleY, 1);
      this.obj3d.updateMatrix();
      this._transformDirty = true;
      return;
    }
    this.obj3d.matrixAutoUpdate = false;
    this.obj3d.matrix
      .makeTranslation(this._x, -this._y, 0)
      .multiply(TMP_MATRIX.makeRotationZ(-this._rotation))
      .multiply(TMP_MATRIX.makeScale(this._scaleX, this._scaleY, 1))
      .multiply(this._layoutMatrix);
    this.obj3d.matrixWorldNeedsUpdate = true;
    this._transformDirty = true;
  }

  /**
   * Hook for leaf classes that need to recompute their visible mesh's
   * pivot offset when the pivot changes (the offset depends on size,
   * which the leaf owns).
   */
  protected onPivotChanged(): void {
    // Default: no-op.
  }

  /**
   * Tears down this node — removes from parent, disposes Three
   * resources owned by this node. Subclasses override to dispose
   * geometries/textures/materials they created.
   *
   * Any tween that targeted this node is killed before the node is
   * detached from its stage. Without this, infinite (`repeat: -1`)
   * tweens would retain the node via their `targets` array — the
   * tween scheduler never splices infinite tweens on its own — and
   * every scene that fires one would leak per transition.
   */
  destroy(): void {
    this._stage?.tweens.killTweensOf(this);
    this._stage?.pointer.notifyNodeDestroyed(this);
    this._stage?.drag.notifyNodeDestroyed(this);
    if (this._parent) {
      this._parent.removeChild(this);
    }
    this.listeners.clear();
    // Detach from any Three parent (defensive — Container.removeChild
    // already removes the obj3d from the parent group).
    if (this.obj3d.parent) {
      this.obj3d.parent.remove(this.obj3d);
      //      this.obj3d.removeFromParent()
    }
  }

  /**
   * Computes the world-space top-left of this node by walking up the
   * parent chain. Used by hit-testing and by code that needs to
   * place an unrelated overlay (e.g. tooltip) at a node's screen
   * location. Excludes scale/rotation — the top-left is in viewport
   * pixels at the node's untransformed origin.
   */
  getWorldPosition(): { readonly x: number; readonly y: number } {
    // We can ask Three for the world matrix, but a quick walk is
    // cheaper and deterministic without needing matrixWorldNeedsUpdate.
    this.obj3d.updateWorldMatrix(true, false);
    const v = scratchVec3;
    v.set(0, 0, 0);
    v.applyMatrix4(this.obj3d.matrixWorld);
    return { x: v.x, y: -v.y };
  }
}

/** Scale factor that turns the integer `depth` field into a renderOrder slot. */
export const DEPTH_SCALE = 1000;

const scratchVec3 = new THREE.Vector3();
const TMP_MATRIX = new THREE.Matrix4();
