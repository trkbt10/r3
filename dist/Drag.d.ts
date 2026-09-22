import { PointerManager } from './Pointer.ts';
import { Node } from './Node.ts';
export type DragHandlers = {
    /** Pointer position at drag start (in viewport pixels). */
    readonly onDragStart?: (info: {
        x: number;
        y: number;
    }) => void;
    /** Latest pointer position (viewport pixels) and delta from start. */
    readonly onDrag?: (info: {
        x: number;
        y: number;
        dx: number;
        dy: number;
    }) => void;
    /** Fires on release while dragging. Mirrors Phaser dragend. */
    readonly onDragEnd?: (info: {
        x: number;
        y: number;
    }) => void;
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
/** Drag-and-drop coordinator built on a {@link PointerManager}. */
export declare class DragManager {
    private readonly pointer;
    private readonly registrations;
    private gesture;
    private readonly disposers;
    constructor(pointer: PointerManager);
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
    attach(node: Node, options?: DragOptions): () => void;
    /** True while a drag is currently being followed (post-threshold). */
    get dragging(): boolean;
    /** The node currently being dragged, or null. */
    get draggingNode(): Node | null;
    private onPointerDown;
    private onPointerMove;
    private onPointerUp;
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
    notifyNodeDestroyed(node: Node): void;
    /**
     * Cancels any in-flight gesture without firing onDragEnd. Used when
     * the host environment (DOM) loses the pointer.
     */
    cancel(): void;
    dispose(): void;
}
