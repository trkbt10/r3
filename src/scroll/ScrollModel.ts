/**
 * @file ScrollModel — engine-free scroll state + input logic backing
 * {@link "../widgets/ScrollablePanel.ts".R3ScrollablePanel}.
 *
 * An axis knob lets the same class drive both vertical lists and a
 * horizontal card row. The module never touches a rendering engine —
 * it is pure state + math, and consumers feed pointer events into
 * its handlers.
 *
 * ## Axis
 *
 * `axis: "y"` scrolls vertically (the default). `axis: "x"` scrolls
 * horizontally — swipe / wheel move on the X axis, and the model
 * reads the relevant pointer coordinate. One model never handles
 * both axes at once; callers that need a grid of scrollable regions
 * instantiate separate models.
 */

/** Pixel threshold below which a drag is treated as a tap, not a swipe. */
const SWIPE_THRESHOLD = 6;

/** Fraction of the remaining distance covered per frame by the lerp. */
const SCROLL_LERP_FACTOR = 0.3;

/** Remaining-distance threshold at which lerp snaps to target. */
const SCROLL_SNAP_THRESHOLD = 0.5;

/** Which axis the scroll model operates on. */
export type ScrollAxis = "y" | "x";

export type AxisGestureIntent = "undecided" | "scroll" | "cross";






/** classifyAxisGesture provides the classifyAxisGesture API. */
export function classifyAxisGesture(
  axis: ScrollAxis,
  dx: number,
  dy: number,
): AxisGestureIntent {
  const primary = axis === "y" ? Math.abs(dy) : Math.abs(dx);
  const cross = axis === "y" ? Math.abs(dx) : Math.abs(dy);
  if (Math.hypot(dx, dy) < SWIPE_THRESHOLD) {
    return "undecided";
  }
  return primary > cross ? "scroll" : "cross";
}

export type ScrollModelConfig = {
  readonly width: number;
  readonly height: number;
  /**
   * For vertical scroll this is the total authored content height;
   * for horizontal scroll it is the total content width. In either
   * case, when the measure is ≤ the cross dimension the model
   * reports `scrollable: false`.
   */
  readonly contentHeight: number;
  /** Mouse-wheel step in pixels per notch. */
  readonly scrollStep: number;
  /**
   * Axis the model operates on. Defaults to `"y"` (vertical) so
   * legacy callers keep working without passing the option.
   */
  readonly axis?: ScrollAxis;
};

/** Axis-aware scroll state + input model (no Phaser dependency). */
export class ScrollModel {
  private scrollY = 0;
  private targetScrollY = 0;
  private contentHeight: number;
  private readonly width: number;
  private readonly height: number;
  private readonly scrollStep: number;
  private readonly axis: ScrollAxis;

  /** Drag tracking. `null` when the pointer is not down inside bounds. */
  private dragState: {
    startPrimaryCoord: number;
    startCrossCoord: number | null;
    lastPrimaryCoord: number;
    scrollYAtStart: number;
  } | null = null;
  /** True when the latest drag exceeded the swipe threshold. */
  private _wasSwiping = false;
  /** Defers the swipe-flag reset by one frame so pointerup handlers can read it. */
  private pendingSwipeReset = false;

  constructor(config: ScrollModelConfig) {
    this.width = config.width;
    this.height = config.height;
    this.contentHeight = config.contentHeight;
    this.scrollStep = config.scrollStep;
    this.axis = config.axis ?? "y";
  }

  /**
   * For axis "y", the cross dimension is the panel height; for "x"
   * it is the panel width. The cross dimension bounds scrollable
   * space — max scroll = max(0, content - cross).
   */
  private get crossExtent(): number {
    return this.axis === "y" ? this.height : this.width;
  }

  /** Maximum valid scroll offset — zero when the content fits. */
  get maxScrollY(): number {
    return Math.max(0, this.contentHeight - this.crossExtent);
  }

  get scrollable(): boolean {
    return this.contentHeight > this.crossExtent;
  }

  get wasSwiping(): boolean {
    return this._wasSwiping;
  }

  getScrollY(): number {
    return this.scrollY;
  }

  get dragging(): boolean {
    return this.dragState !== null;
  }

  /** Adds `delta` to the target (accumulates for repeated wheel ticks). */
  scrollBy(delta: number): void {
    this.scrollTo(this.targetScrollY + delta);
  }

  /** Sets the target; returns true when the target actually changed. */
  scrollTo(y: number): boolean {
    const newY = clamp(y, 0, this.maxScrollY);
    if (newY === this.targetScrollY) {
      return false;
    }
    this.targetScrollY = newY;
    return true;
  }

  /** Hard-set scrollY without lerp. */
  setScrollY(y: number): void {
    const newY = clamp(y, 0, this.maxScrollY);
    this.scrollY = newY;
    this.targetScrollY = newY;
  }

  resetScroll(): void {
    this.scrollY = 0;
    this.targetScrollY = 0;
  }

  setContentHeight(height: number): void {
    this.contentHeight = height;
    this.scrollY = clamp(this.scrollY, 0, this.maxScrollY);
    this.targetScrollY = this.scrollY;
  }

  /**
   * Per-frame tick — advances the lerp and resets the swipe flag.
   * Returns true when `scrollY` actually changed.
   */
  update(): boolean {
    if (this.pendingSwipeReset) {
      this._wasSwiping = false;
      this.pendingSwipeReset = false;
    }
    return this.lerpScroll();
  }

  /**
   * Wheel handler. Scrolls only when the pointer is inside the panel
   * bounds — the caller passes world coordinates for both the pointer
   * and the panel's top-left.
   *
   * For horizontal panels a mouse wheel's `deltaY` still drives the
   * X scroll (most wheels only have Y). Trackpads that deliver real
   * `deltaX` can be passed to a sibling overload later if needed.
   */
  handleWheel(
    pointerX: number,
    pointerY: number,
    panelWorldX: number,
    panelWorldY: number,
    deltaY: number,
  ): boolean {
    if (!this.isPointerInBounds(pointerX, pointerY, panelWorldX, panelWorldY)) {
      return false;
    }
    const step = deltaY > 0 ? this.scrollStep : -this.scrollStep;
    this.scrollBy(step);
    return true;
  }

  handlePointerDown(
    pointerX: number,
    pointerY: number,
    panelWorldX: number,
    panelWorldY: number,
  ): void {
    if (!this.scrollable) {
      return;
    }
    if (!this.isPointerInBounds(pointerX, pointerY, panelWorldX, panelWorldY)) {
      return;
    }
    const coord = this.axis === "y" ? pointerY : pointerX;
    const crossCoord = this.axis === "y" ? pointerX : pointerY;
    this.dragState = {
      startPrimaryCoord: coord,
      startCrossCoord: crossCoord,
      lastPrimaryCoord: coord,
      scrollYAtStart: this.scrollY,
    };
  }

  handlePointerMove(pointerY: number, pointerX?: number): boolean {
    if (!this.dragState) {
      return false;
    }
    const coord = this.axis === "y" ? pointerY : pointerX !== undefined ? pointerX : pointerY;
    const crossCoord = this.axis === "y" ? pointerX : pointerY;
    const primaryDelta = this.dragState.startPrimaryCoord - coord;
    if (this.dragState.startCrossCoord !== null && crossCoord !== undefined) {
      const crossDelta = this.dragState.startCrossCoord - crossCoord;
      const intent = classifyScrollAxisGesture(this.axis, primaryDelta, crossDelta);
      if (intent === "undecided") {
        this.dragState.lastPrimaryCoord = coord;
        return false;
      }
      if (intent === "cross") {
        this.dragState = null;
        return false;
      }
    }
    if (Math.abs(primaryDelta) >= SWIPE_THRESHOLD) {
      this._wasSwiping = true;
      this.scrollToImmediate(this.dragState.scrollYAtStart + primaryDelta);
      this.dragState.lastPrimaryCoord = coord;
      return true;
    }
    this.dragState.lastPrimaryCoord = coord;
    return false;
  }

  handlePointerUp(): void {
    if (!this.dragState) {
      return;
    }
    if (this._wasSwiping) {
      this.pendingSwipeReset = true;
    }
    this.dragState = null;
  }

  isPointerInBounds(
    pointerX: number,
    pointerY: number,
    panelWorldX: number,
    panelWorldY: number,
  ): boolean {
    return (
      pointerX >= panelWorldX &&
      pointerX <= panelWorldX + this.width &&
      pointerY >= panelWorldY &&
      pointerY <= panelWorldY + this.height
    );
  }

  private scrollToImmediate(y: number): void {
    const newY = clamp(y, 0, this.maxScrollY);
    this.scrollY = newY;
    this.targetScrollY = newY;
  }

  private lerpScroll(): boolean {
    if (this.dragState) {
      return false;
    }
    const diff = this.targetScrollY - this.scrollY;
    if (Math.abs(diff) < SCROLL_SNAP_THRESHOLD) {
      if (diff !== 0) {
        this.scrollY = this.targetScrollY;
        return true;
      }
      return false;
    }
    this.scrollY += diff * SCROLL_LERP_FACTOR;
    return true;
  }
}

function classifyScrollAxisGesture(
  axis: ScrollAxis,
  primaryDelta: number,
  crossDelta: number,
): AxisGestureIntent {
  if (axis === "y") {
    return classifyAxisGesture(axis, crossDelta, primaryDelta);
  }
  return classifyAxisGesture(axis, primaryDelta, crossDelta);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
