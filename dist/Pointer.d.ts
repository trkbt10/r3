import { Node, NodeEventName, PointerEvent as R3PointerEvent } from './Node.ts';
import { Stage } from './Stage.ts';
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
export declare class PointerManager {
    private readonly stage;
    private _x;
    private _y;
    private _isDown;
    private _activeButton;
    private _pointerId;
    private _hoveredNode;
    private _downNode;
    /** Toggled false by `dispose()`; suppresses further dispatch. */
    private alive;
    /** Global listeners keyed by event name. */
    private readonly globalListeners;
    constructor(stage: Stage);
    get snapshot(): PointerSnapshot;
    get hovered(): Node | null;
    on(event: NodeEventName, listener: GlobalListener): () => void;
    off(event: NodeEventName, listener: GlobalListener): void;
    /**
     * Updates pointer coords and dispatches `pointermove` to the
     * topmost interactive node + any over/out transitions to/from
     * previously hovered nodes.
     */
    feedMove(x: number, y: number, pointerId?: number): void;
    feedDown(x: number, y: number, button?: number, pointerId?: number): void;
    /**
     * Releases the pointer. Fires `pointerup` on the node that was
     * under the pointer at the time of release; if that node is the
     * same as the down-node, also fires `click`. Phaser similarly
     * scopes "click" to "down + up on the same target".
     */
    feedUp(x: number, y: number, button?: number, pointerId?: number): void;
    /**
     * Cancels any in-flight pointer interaction without dispatching a
     * click. Used when the host-level pointer is captured by another
     * element (window blur, touchcancel).
     */
    feedCancel(): void;
    feedWheel(x: number, y: number, deltaY: number): void;
    feedPinch(x: number, y: number, scaleDelta: number): void;
    /**
     * Returns the topmost interactive node whose `hitArea` contains
     * the pointer (in node-local pixels), or `null`. Walks the tree
     * in paint order, considering depth.
     */
    pickAt(x: number, y: number): Node | null;
    private dispatch;
    private dispatchGlobal;
    dispose(): void;
    /**
     * Called by `Node.destroy()` to evict a destroyed node from the
     * hover/down slots. Without this, the destroyed node would linger
     * in the manager until the next pointer event moved the cursor
     * elsewhere (eventually self-healing, but the node is retained in
     * the interim and would still receive dispatches — which are
     * already no-ops because its listener map is cleared, but the
     * reference retention is avoidable).
     */
    notifyNodeDestroyed(node: Node): void;
}
export {};
