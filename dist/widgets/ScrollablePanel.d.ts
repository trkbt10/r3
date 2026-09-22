import { Container } from '../Container.ts';
import { Node } from '../Node.ts';
import { ScrollModel, ScrollAxis } from '../scroll/ScrollModel.ts';
import { Stage } from '../Stage.ts';
import { TextureManager } from '../texture-canvas';
export type R3ScrollablePanelConfig = {
    readonly stage: Stage;
    readonly textureManager: TextureManager;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    /**
     * Total authored content size along the scroll axis — content
     * height for `axis: "y"`, content width for `axis: "x"`. When it's
     * ≤ the viewport's matching dimension the panel reports
     * `scrollable: false` and the indicators hide themselves.
     */
    readonly contentHeight: number;
    readonly scrollStep?: number;
    readonly showIndicators?: boolean;
    /**
     * Scroll axis. Defaults to `"y"` (vertical). Horizontal panels
     * re-use the same API — `contentHeight` means "content width",
     * `getScrollY()` means "the scroll offset along X".
     */
    readonly axis?: ScrollAxis;
    /**
     * Optional gesture gate for pointer-drag scrolling. Wheel and
     * indicator scrolling remain available; this only arbitrates touch /
     * mouse swipe scroll against nested drag gestures.
     */
    readonly canDragScroll?: () => boolean;
    /** Optional parent; defaults to the stage root. */
    readonly parent?: Container;
};
/** Mask-clipped scroll container with wheel + swipe + indicator input. */
export declare class R3ScrollablePanel {
    /** Outer container — placed at the panel's (x, y); paints chrome. */
    readonly container: Container;
    /** Inner container — children scroll here; clipping applied. */
    readonly content: Container;
    readonly model: ScrollModel;
    private readonly stage;
    private readonly config;
    private readonly axis;
    private readonly showIndicators;
    private readonly defaultStep;
    /** "Start" = up (y-axis) / left (x-axis); "end" = down / right. */
    private startIndicator;
    private endIndicator;
    /** Cached clipping planes — built once, applied to every new child. */
    private readonly clippingPlanes;
    /** Disposers for stage-level pointer/wheel listeners. */
    private readonly disposers;
    /** Frame ticker hook id. The Stage has no `events.on('update')` like
     * Phaser — we subscribe to the same per-frame composition pass via a
     * post-tick hook the panel runs from a tween that loops forever. */
    private readonly tickHandle;
    /** True while the user is mid-swipe; suppresses external pointer-up handling. */
    get wasSwiping(): boolean;
    get scrollable(): boolean;
    /** Pixel extent of the clipped viewport along the scroll axis. */
    get viewHeight(): number;
    constructor(config: R3ScrollablePanelConfig);
    /**
     * Updates total content size along the scroll axis. "Height" here
     * is axis-agnostic (matches ScrollModel's convention) — for
     * horizontal panels it's the content width.
     */
    setContentHeight(size: number): void;
    resetScroll(): void;
    setScrollY(y: number): void;
    /** Current scroll offset along the axis (y for vertical, x for horizontal). */
    getScrollY(): number;
    scrollBy(delta: number): void;
    scrollTo(offset: number): void;
    /**
     * Adds a child to the scrollable content. Re-applies the clipping
     * planes so the new child's leaf materials inherit the viewport
     * clip; without this a freshly-added Text/Rect would draw past the
     * panel's viewport edge until something else triggered a clip-plane
     * propagation.
     */
    addContent<T extends Node>(child: T): T;
    /** Destroys every child of `content` and resets scrollY to 0. */
    clearContent(): void;
    destroy(): void;
    private applyScroll;
    /** Moves the content container to mirror model's current scroll offset. */
    private writeContentOffset;
    private buildIndicators;
    private buildVerticalIndicators;
    private buildHorizontalIndicators;
    private wireIndicator;
    private canScrollToward;
    private colorForSide;
    private updateIndicators;
    private updateIndicatorsFor;
    private containsViewportPoint;
    private refreshClippingPlanes;
}
