import { AnchorName, LayoutRect } from '..';
import { LayoutEditorHost } from './types.ts';
/** Compass of resize handle positions on the selection rect. */
export type ResizeHandle = "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";
export declare const ALL_HANDLES: readonly ResizeHandle[];
/** On-screen handle square size in logical pixels. */
export declare const HANDLE_SIZE = 12;
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
export declare class LayoutEditor {
    private readonly host;
    private readonly viewport;
    private readonly events;
    private readonly skipKey;
    private state;
    /** Per-drag pointer-apply throttle — see {@link setDragThrottleMs}. */
    private dragThrottleMs;
    /** Timestamp of the most recent applyMove / applyResize call. */
    private lastApplyMs;
    /** Latest pointer position that the throttle hasn't yet flushed. */
    private pendingPointer;
    constructor(options: LayoutEditorOptions);
    getDragThrottleMs(): number;
    /** Minimum ms between drag applies (0 = no throttle, every frame). */
    setDragThrottleMs(ms: number): void;
    getState(): EditorState;
    getSelectedKey(): string | null;
    getSnapSize(): number;
    setSnapSize(px: number): void;
    select(key: string | null): void;
    /** An absolute child anywhere in the tree can be position-dragged. */
    isMovable(key: string): boolean;
    /**
     * Any node with numeric authored width/height is resizable —
     * leaves naturally, and flex containers whose content size is
     * authored (the recursive-layout case).
     */
    isResizable(key: string): boolean;
    onPointerDown(x: number, y: number): void;
    onPointerMove(x: number, y: number): void;
    onPointerUp(): void;
    /** Removes the selected node from the tree. */
    deleteSelected(): void;
    /**
     * Inserts a placeholder card via {@link LayoutEditorHost.addPlaceholder}
     * (if the host provides one) and selects it. Otherwise a no-op.
     */
    addPlaceholder(): void;
    private startMove;
    private startResize;
    private applyMove;
    private applyResize;
    private hitTestDeepest;
}
/** Local pixel rect of a given handle against a selection rect. */
export declare function handleRect(rect: LayoutRect, handle: ResizeHandle): LayoutRect;
/** Snaps a scalar to the nearest multiple of `step`. `step <= 1` rounds. */
export declare function snapTo(value: number, step: number): number;
/**
 * Inverse of {@link placeAnchor} — given a plaque's target (x, y) in
 * viewport coordinates and its intrinsic size, returns the insets
 * that reproduce that position under the given anchor.
 */
export declare function pointToInsets(anchor: AnchorName, parent: {
    width: number;
    height: number;
}, intrinsic: {
    width: number;
    height: number;
}, x: number, y: number): {
    insetX: number;
    insetY: number;
};
/**
 * Recomputes a rect when one of its handles has been dragged to
 * (pointerX, pointerY). The opposite corner / edge stays fixed so
 * the resize feels anchored, mirroring every DOM design tool's
 * behaviour. Pointer coordinates snap to `snap` before the rect
 * is derived.
 */
export declare function resizeRect(handle: ResizeHandle, startRect: LayoutRect, pointerX: number, pointerY: number, snap: number): {
    x: number;
    y: number;
    width: number;
    height: number;
};
export {};
