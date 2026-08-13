/**
 * @file Direct-manipulation editor for a layout-engine tree.
 *
 * `LayoutEditor` owns selection + pointer-state-machine for any
 * application that implements the {@link LayoutEditorHost} contract.
 * The host provides tree lookups / mutations / relayout hooks; the
 * editor turns raw pointer coordinates into `select`, `drag`, and
 * `resize` intents and routes each back through the host.
 *
 * The editor is stateless with respect to rendering — call
 * {@link installLayoutEditorOverlay} to get the visual indicator.
 *
 * ## Pointer state machine
 *
 *   idle
 *     │  mouseDown on resize handle of current selection → resizing
 *     │  mouseDown on a keyed node body → select + (if movable) dragging
 *     │  mouseDown on empty space → deselect
 *     │
 *   dragging
 *     │  mouseMove → pointToInsets → host.setAnchorPlacement
 *     │  mouseUp → idle
 *     │
 *   resizing
 *        mouseMove → resizeRect → host.setLeafSize (+ setAnchorPlacement
 *                                 if absolute to keep the opposite
 *                                 corner pinned)
 *        mouseUp → idle
 *
 * ## Flow-child auto-promotion
 *
 * A click-and-drag on a flow child (nested inside a flex cluster)
 * would normally do nothing, because the flex parent decides that
 * child's position. Instead, the editor calls
 * {@link LayoutEditorHost.promoteFlowToAbsolute} right before
 * `startMove`, silently re-parenting the node so the drag can
 * proceed. The user perceives every keyed node as draggable.
 */

import type { AnchorName, LayoutNode, LayoutRect } from "..";
import type { LayoutEditorHost } from "./types.ts";

/** Compass of resize handle positions on the selection rect. */
export type ResizeHandle = "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";

export const ALL_HANDLES: readonly ResizeHandle[] = [
  "tl",
  "tc",
  "tr",
  "ml",
  "mr",
  "bl",
  "bc",
  "br",
];

/** On-screen handle square size in logical pixels. */
export const HANDLE_SIZE = 12;

/** Minimum rectangle extent after a resize. */
const MIN_SIZE = 16;

export type EditorViewport = {
  readonly width: number;
  readonly height: number;
};

export type EditorState = {
  readonly selectedKey: string | null;
  readonly snapSize: number;
  readonly drag: DragState | null;
};

type DragMove = {
  readonly kind: "move";
  readonly key: string;
  readonly anchor: AnchorName;
  readonly startInsetX: number;
  readonly startInsetY: number;
  readonly startRect: LayoutRect;
  readonly startPointerX: number;
  readonly startPointerY: number;
};

type DragResize = {
  readonly kind: "resize";
  readonly key: string;
  readonly handle: ResizeHandle;
  readonly anchor: AnchorName | null;
  readonly startInsetX: number | null;
  readonly startInsetY: number | null;
  readonly startRect: LayoutRect;
  readonly startPointerX: number;
  readonly startPointerY: number;
};

type DragState = DragMove | DragResize;

export type EditorEvents = {
  /** Any state change — selection, snap, drag begin/end, inflight move. */
  readonly onStateChange?: () => void;
};

/** Keys the editor should refuse to select. */
export type SkipKeyPredicate = (key: string) => boolean;

export type LayoutEditorOptions = {
  readonly host: LayoutEditorHost;
  readonly viewport: EditorViewport;
  /**
   * Optional starting snap size in pixels. Defaults to 7 — a factor
   * of the HUD's default 21 px grid, which feels coarse enough for
   * intent-driven moves without feeling jumpy.
   */
  readonly initialSnap?: number;
  /**
   * Minimum ms between successive applyMove / applyResize calls
   * during a drag. Raw pointermove events fire at 60+ Hz; when the
   * tree is deep and every arrange re-walks dozens of leaves, that
   * rate makes the editor feel sluggish. The default 60 ms coalesces
   * moves to ~16 Hz — still responsive but with far fewer layout
   * passes per second. On pointerUp the most-recent pending pointer
   * is flushed so the final position is always accurate.
   */
  readonly initialDragThrottleMs?: number;
  /**
   * Keys the editor must skip during hit-test. Typical uses: a
   * "root", "spacer", or "board" wrapper the user never wants to
   * grab. Defaults to always-false (every keyed node is selectable).
   */
  readonly skipKey?: SkipKeyPredicate;
  readonly events?: EditorEvents;
};

/** Editor controller — instantiate once and forward pointer events. */
export class LayoutEditor {
  private readonly host: LayoutEditorHost;
  private readonly viewport: EditorViewport;
  private readonly events: EditorEvents;
  private readonly skipKey: SkipKeyPredicate;
  private state: EditorState;
  /** Per-drag pointer-apply throttle — see {@link setDragThrottleMs}. */
  private dragThrottleMs: number;
  /** Timestamp of the most recent applyMove / applyResize call. */
  private lastApplyMs = 0;
  /** Latest pointer position that the throttle hasn't yet flushed. */
  private pendingPointer: { x: number; y: number } | null = null;

  constructor(options: LayoutEditorOptions) {
    this.host = options.host;
    this.viewport = options.viewport;
    this.events = options.events ?? {};
    this.skipKey = options.skipKey ?? (() => false);
    this.state = {
      selectedKey: null,
      snapSize: options.initialSnap ?? 7,
      drag: null,
    };
    this.dragThrottleMs = Math.max(0, options.initialDragThrottleMs ?? 60);
  }

  getDragThrottleMs(): number {
    return this.dragThrottleMs;
  }

  /** Minimum ms between drag applies (0 = no throttle, every frame). */
  setDragThrottleMs(ms: number): void {
    this.dragThrottleMs = Math.max(0, ms);
  }

  getState(): EditorState {
    return this.state;
  }

  getSelectedKey(): string | null {
    return this.state.selectedKey;
  }

  getSnapSize(): number {
    return this.state.snapSize;
  }

  setSnapSize(px: number): void {
    if (px <= 0) {
      return;
    }
    this.state = { ...this.state, snapSize: px };
    this.events.onStateChange?.();
  }

  select(key: string | null): void {
    if (this.state.selectedKey === key) {
      return;
    }
    this.state = { ...this.state, selectedKey: key };
    this.events.onStateChange?.();
  }

  /** An absolute child anywhere in the tree can be position-dragged. */
  isMovable(key: string): boolean {
    return this.host.findAbsoluteWrapper(key) !== null;
  }

  /**
   * Any node with numeric authored width/height is resizable —
   * leaves naturally, and flex containers whose content size is
   * authored (the recursive-layout case).
   */
  isResizable(key: string): boolean {
    const node = this.host.findNode(key);
    if (!node) {
      return false;
    }
    return typeof node.width === "number" && typeof node.height === "number";
  }

  onPointerDown(x: number, y: number): void {
    const selectedKey = this.state.selectedKey;
    // Resize-handle probe takes priority over plaque bodies since
    // handles are drawn outside the selected rect.
    if (selectedKey !== null && this.isResizable(selectedKey)) {
      const selRect = this.host.rects[selectedKey];
      if (selRect) {
        const handle = handleAtPoint(selRect, x, y);
        if (handle) {
          this.startResize(selectedKey, handle, x, y, selRect);
          return;
        }
      }
    }
    const hit = this.hitTestDeepest(x, y);
    if (hit === null) {
      this.select(null);
      return;
    }
    this.select(hit);
    // Flow children aren't inherently draggable, but the user intent
    // of click-and-drag is obvious. Auto-promote to absolute at the
    // current on-screen position so the drag can proceed. Works for
    // both leaves and flex widgets — `promoteFlowToAbsolute` no-ops
    // when the node is already absolute, so a broad call is safe.
    if (!this.isMovable(hit)) {
      this.host.promoteFlowToAbsolute(hit);
    }
    if (this.isMovable(hit)) {
      this.startMove(hit, x, y);
    }
  }

  onPointerMove(x: number, y: number): void {
    const drag = this.state.drag;
    if (!drag) {
      return;
    }
    const now = performance.now();
    if (now - this.lastApplyMs < this.dragThrottleMs) {
      // Coalesce: remember the latest pointer, skip the apply. The
      // next move past the throttle window picks up the freshest
      // position; pointerUp flushes any leftover.
      this.pendingPointer = { x, y };
      return;
    }
    this.lastApplyMs = now;
    this.pendingPointer = null;
    if (drag.kind === "move") {
      this.applyMove(drag, x, y);
    } else {
      this.applyResize(drag, x, y);
    }
  }

  onPointerUp(): void {
    if (!this.state.drag) {
      return;
    }
    // Flush any throttled-out pointer so the FINAL apply always
    // reflects the user's last position.
    if (this.pendingPointer) {
      const pending = this.pendingPointer;
      this.pendingPointer = null;
      if (this.state.drag.kind === "move") {
        this.applyMove(this.state.drag, pending.x, pending.y);
      } else {
        this.applyResize(this.state.drag, pending.x, pending.y);
      }
    }
    this.host.endInstant();
    this.host.relayout();
    this.state = { ...this.state, drag: null };
    this.events.onStateChange?.();
  }

  /** Removes the selected node from the tree. */
  deleteSelected(): void {
    const key = this.state.selectedKey;
    if (key === null) {
      return;
    }
    if (!this.host.removeByKey(key)) {
      return;
    }
    this.state = { ...this.state, selectedKey: null, drag: null };
    this.events.onStateChange?.();
  }

  /**
   * Inserts a placeholder card via {@link LayoutEditorHost.addPlaceholder}
   * (if the host provides one) and selects it. Otherwise a no-op.
   */
  addPlaceholder(): void {
    const snap = this.state.snapSize;
    const create = this.host.addPlaceholder;
    if (!create) {
      return;
    }
    const key = create({
      anchor: "top-left",
      insetX: snapTo(snap * 10, snap),
      insetY: snapTo(snap * 10, snap),
    });
    this.select(key);
  }

  private startMove(key: string, pointerX: number, pointerY: number): void {
    const placement = this.host.getAnchorPlacement(key);
    const rect = this.host.rects[key];
    if (!placement || !rect) {
      return;
    }
    this.host.beginInstant();
    const drag: DragMove = {
      kind: "move",
      key,
      anchor: placement.anchor,
      startInsetX: placement.insetX,
      startInsetY: placement.insetY,
      startRect: rect,
      startPointerX: pointerX,
      startPointerY: pointerY,
    };
    this.state = { ...this.state, drag };
    this.events.onStateChange?.();
  }

  private startResize(
    key: string,
    handle: ResizeHandle,
    pointerX: number,
    pointerY: number,
    rect: LayoutRect,
  ): void {
    const placement = this.host.getAnchorPlacement(key);
    this.host.beginInstant();
    const drag: DragResize = {
      kind: "resize",
      key,
      handle,
      anchor: placement?.anchor ?? null,
      startInsetX: placement?.insetX ?? null,
      startInsetY: placement?.insetY ?? null,
      startRect: rect,
      startPointerX: pointerX,
      startPointerY: pointerY,
    };
    this.state = { ...this.state, drag };
    this.events.onStateChange?.();
  }

  private applyMove(drag: DragMove, x: number, y: number): void {
    const dx = x - drag.startPointerX;
    const dy = y - drag.startPointerY;
    const snap = this.state.snapSize;
    const targetX = snapTo(drag.startRect.x + dx, snap);
    const targetY = snapTo(drag.startRect.y + dy, snap);
    const { insetX, insetY } = pointToInsets(
      drag.anchor,
      this.viewport,
      { width: drag.startRect.width, height: drag.startRect.height },
      targetX,
      targetY,
    );
    this.host.setAnchorPlacement(drag.key, {
      anchor: drag.anchor,
      insetX,
      insetY,
    });
  }

  private applyResize(drag: DragResize, x: number, y: number): void {
    const snap = this.state.snapSize;
    const next = resizeRect(drag.handle, drag.startRect, x, y, snap);
    this.host.setNodeSize(drag.key, next.width, next.height);
    if (drag.anchor === null) {
      return;
    }
    const { insetX, insetY } = pointToInsets(
      drag.anchor,
      this.viewport,
      { width: next.width, height: next.height },
      next.x,
      next.y,
    );
    this.host.setAnchorPlacement(drag.key, {
      anchor: drag.anchor,
      insetX,
      insetY,
    });
  }

  private hitTestDeepest(x: number, y: number): string | null {
    const root = this.host.tree.current;
    return hitTestNode(root, x, y, this.host.rects, this.skipKey);
  }
}

function hitTestNode(
  node: LayoutNode,
  x: number,
  y: number,
  rects: Readonly<Record<string, LayoutRect>>,
  skipKey: SkipKeyPredicate,
): string | null {
  if (node.kind === "flex") {
    // Descend absolute children first (drawn on top conceptually).
    for (let i = node.absolute.length - 1; i >= 0; i--) {
      const abs = node.absolute[i];
      if (!abs) {
        continue;
      }
      const hit = hitTestNode(abs.node, x, y, rects, skipKey);
      if (hit !== null) {
        return hit;
      }
    }
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i];
      if (!child) {
        continue;
      }
      const hit = hitTestNode(child, x, y, rects, skipKey);
      if (hit !== null) {
        return hit;
      }
    }
  }
  const key = node.key;
  if (key === null) {
    return null;
  }
  if (skipKey(key)) {
    return null;
  }
  const rect = rects[key];
  if (!rect || !rectContains(rect, x, y)) {
    return null;
  }
  return key;
}

function rectContains(rect: LayoutRect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

/** Local pixel rect of a given handle against a selection rect. */
export function handleRect(rect: LayoutRect, handle: ResizeHandle): LayoutRect {
  const h = HANDLE_SIZE;
  const hx = handleCenterX(rect, handle);
  const hy = handleCenterY(rect, handle);
  return { x: hx - h / 2, y: hy - h / 2, width: h, height: h };
}

function handleCenterX(rect: LayoutRect, handle: ResizeHandle): number {
  if (handle === "tl" || handle === "ml" || handle === "bl") {
    return rect.x;
  }
  if (handle === "tr" || handle === "mr" || handle === "br") {
    return rect.x + rect.width;
  }
  return rect.x + rect.width / 2;
}

function handleCenterY(rect: LayoutRect, handle: ResizeHandle): number {
  if (handle === "tl" || handle === "tc" || handle === "tr") {
    return rect.y;
  }
  if (handle === "bl" || handle === "bc" || handle === "br") {
    return rect.y + rect.height;
  }
  return rect.y + rect.height / 2;
}

function handleAtPoint(rect: LayoutRect, x: number, y: number): ResizeHandle | null {
  for (const handle of ALL_HANDLES) {
    const hr = handleRect(rect, handle);
    if (rectContains(hr, x, y)) {
      return handle;
    }
  }
  return null;
}

/** Snaps a scalar to the nearest multiple of `step`. `step <= 1` rounds. */
export function snapTo(value: number, step: number): number {
  if (step <= 1) {
    return Math.round(value);
  }
  return Math.round(value / step) * step;
}

/**
 * Inverse of {@link placeAnchor} — given a plaque's target (x, y) in
 * viewport coordinates and its intrinsic size, returns the insets
 * that reproduce that position under the given anchor.
 */
export function pointToInsets(
  anchor: AnchorName,
  parent: { width: number; height: number },
  intrinsic: { width: number; height: number },
  x: number,
  y: number,
): { insetX: number; insetY: number } {
  const insetX = (() => {
    if (anchor.endsWith("-left")) {
      return x;
    }
    if (anchor.endsWith("-right")) {
      return parent.width - intrinsic.width - x;
    }
    return x - (parent.width - intrinsic.width) / 2;
  })();
  const insetY = (() => {
    if (anchor.startsWith("top-")) {
      return y;
    }
    if (anchor.startsWith("bottom-")) {
      return parent.height - intrinsic.height - y;
    }
    return y - (parent.height - intrinsic.height) / 2;
  })();
  return { insetX, insetY };
}

/**
 * Recomputes a rect when one of its handles has been dragged to
 * (pointerX, pointerY). The opposite corner / edge stays fixed so
 * the resize feels anchored, mirroring every DOM design tool's
 * behaviour. Pointer coordinates snap to `snap` before the rect
 * is derived.
 */
export function resizeRect(
  handle: ResizeHandle,
  startRect: LayoutRect,
  pointerX: number,
  pointerY: number,
  snap: number,
): { x: number; y: number; width: number; height: number } {
  const left = handle === "tl" || handle === "ml" || handle === "bl";
  const right = handle === "tr" || handle === "mr" || handle === "br";
  const top = handle === "tl" || handle === "tc" || handle === "tr";
  const bottom = handle === "bl" || handle === "bc" || handle === "br";

  const startLeft = startRect.x;
  const startRight = startRect.x + startRect.width;
  const startTop = startRect.y;
  const startBottom = startRect.y + startRect.height;

  const newLeft = left ? clampMax(snapTo(pointerX, snap), startRight - MIN_SIZE) : startLeft;
  const newRight = right ? clampMin(snapTo(pointerX, snap), startLeft + MIN_SIZE) : startRight;
  const newTop = top ? clampMax(snapTo(pointerY, snap), startBottom - MIN_SIZE) : startTop;
  const newBottom = bottom ? clampMin(snapTo(pointerY, snap), startTop + MIN_SIZE) : startBottom;

  return {
    x: newLeft,
    y: newTop,
    width: newRight - newLeft,
    height: newBottom - newTop,
  };
}

function clampMin(value: number, min: number): number {
  return value < min ? min : value;
}

function clampMax(value: number, max: number): number {
  return value > max ? max : value;
}
