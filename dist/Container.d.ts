import { Node, NodeOptions, Rect } from './Node.ts';
import { Plane } from 'three';
import { Stage } from './Stage.ts';
export type ContainerOptions = NodeOptions;
/** Ordered collection of child Nodes. */
export declare class Container extends Node {
    protected readonly _children: Node[];
    /**
     * Remembered clipping planes, if any, set via
     * {@link setClippingPlanes}. Stored so that children added *after*
     * the planes were installed still inherit them — consumers like
     * {@link import("./widgets/ScrollablePanel.ts").R3ScrollablePanel}
     * depend on this to keep late-arriving rows clipped to the viewport.
     */
    private _clippingPlanes;
    constructor(options?: ContainerOptions);
    get children(): readonly Node[];
    get length(): number;
    /**
     * Appends `child` to the end of the list so it paints on top of
     * earlier children. Removes from any previous parent first.
     */
    add(child: Node): this;
    /** Convenience for adding many children at once. */
    addAll(children: readonly Node[]): this;
    /**
     * Detaches `child` from this container without destroying it. Use
     * `destroy()` on the child (or `removeAll(true)` here) when the
     * caller also wants the Three resources released.
     */
    removeChild(child: Node): this;
    /**
     * Removes every child. When `destroyChildren` is true, each child's
     * `destroy()` runs (releasing its Three resources) — matches
     * `Phaser.GameObjects.Container#removeAll(true)`.
     */
    removeAll(destroyChildren?: boolean): this;
    /**
     * Interactive rect whose top-left coincides with the container's
     * origin. Containers without a hit area still let pointer events
     * flow through to descendants.
     */
    setInteractiveRect(width: number, height: number): this;
    /**
     * Clears a previously set interactive rect. Equivalent to
     * `setInteractive(null)`.
     */
    disableInteractive(): this;
    composeWorldState(parentAlpha: number, parentVisible: boolean): void;
    composeRenderOrder(counter: number, ancestorDepthOffset: number): number;
    propagateStage(stage: Stage | null): void;
    setClippingPlanes(planes: readonly Plane[] | null): void;
    destroy(): void;
    /** Interactive rect override: containers default `hitArea` to null. */
    get hitArea(): Rect | null;
}
