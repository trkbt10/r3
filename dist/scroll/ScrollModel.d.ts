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
/** Which axis the scroll model operates on. */
export type ScrollAxis = "y" | "x";
export type AxisGestureIntent = "undecided" | "scroll" | "cross";
/** classifyAxisGesture provides the classifyAxisGesture API. */
export declare function classifyAxisGesture(axis: ScrollAxis, dx: number, dy: number): AxisGestureIntent;
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
export declare class ScrollModel {
    private scrollY;
    private targetScrollY;
    private contentHeight;
    private readonly width;
    private readonly height;
    private readonly scrollStep;
    private readonly axis;
    /** Drag tracking. `null` when the pointer is not down inside bounds. */
    private dragState;
    /** True when the latest drag exceeded the swipe threshold. */
    private _wasSwiping;
    /** Defers the swipe-flag reset by one frame so pointerup handlers can read it. */
    private pendingSwipeReset;
    constructor(config: ScrollModelConfig);
    /**
     * For axis "y", the cross dimension is the panel height; for "x"
     * it is the panel width. The cross dimension bounds scrollable
     * space — max scroll = max(0, content - cross).
     */
    private get crossExtent();
    /** Maximum valid scroll offset — zero when the content fits. */
    get maxScrollY(): number;
    get scrollable(): boolean;
    get wasSwiping(): boolean;
    getScrollY(): number;
    get dragging(): boolean;
    /** Adds `delta` to the target (accumulates for repeated wheel ticks). */
    scrollBy(delta: number): void;
    /** Sets the target; returns true when the target actually changed. */
    scrollTo(y: number): boolean;
    /** Hard-set scrollY without lerp. */
    setScrollY(y: number): void;
    resetScroll(): void;
    setContentHeight(height: number): void;
    /**
     * Per-frame tick — advances the lerp and resets the swipe flag.
     * Returns true when `scrollY` actually changed.
     */
    update(): boolean;
    /**
     * Wheel handler. Scrolls only when the pointer is inside the panel
     * bounds — the caller passes world coordinates for both the pointer
     * and the panel's top-left.
     *
     * For horizontal panels a mouse wheel's `deltaY` still drives the
     * X scroll (most wheels only have Y). Trackpads that deliver real
     * `deltaX` can be passed to a sibling overload later if needed.
     */
    handleWheel(pointerX: number, pointerY: number, panelWorldX: number, panelWorldY: number, deltaY: number): boolean;
    handlePointerDown(pointerX: number, pointerY: number, panelWorldX: number, panelWorldY: number): void;
    handlePointerMove(pointerY: number, pointerX?: number): boolean;
    handlePointerUp(): void;
    isPointerInBounds(pointerX: number, pointerY: number, panelWorldX: number, panelWorldY: number): boolean;
    private scrollToImmediate;
    private lerpScroll;
}
