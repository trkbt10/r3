import { LayoutNode } from './nodes.ts';
import { LayoutTargetRegistry } from './registry.ts';
import { LayoutRect, LayoutVanishingPointPresets, Transition } from './types.ts';
export type LayoutRuntimeOptions = {
    readonly root: LayoutNode;
    readonly viewport: LayoutRect;
    /**
     * Transition applied when a node's authored transition is `null`.
     * Defaults to `{ durationMs: 0, easing: "Linear" }` — i.e. no
     * animation, callers opt in per node. Set a non-zero default to
     * animate every layout change by default.
     */
    readonly defaultTransition?: Transition;
    readonly vanishingPoints?: LayoutVanishingPointPresets;
    readonly registry?: LayoutTargetRegistry;
    /**
     * Skip the "first layout applies instantly" behaviour. Turn this
     * on when mounting an already-visible tree that should animate
     * into a new configuration (e.g. swapping pages).
     */
    readonly animateOnMount?: boolean;
};
/**
 * Layout orchestrator. Owns the tween manager, the live-rect state
 * map, and the tree root. Callers should:
 *
 *   1. Construct with their root tree and viewport.
 *   2. Call {@link tick} once per frame with the elapsed ms.
 *   3. Call {@link relayout} whenever they mutate authored fields on
 *      any node, or pass a replacement tree to {@link setRoot}.
 *   4. Call {@link dispose} on tear-down to kill any in-flight
 *      tweens so they don't dangle past the scene's life.
 */
export declare class LayoutRuntime {
    private root;
    private viewport;
    private readonly defaultTransition;
    private readonly tweens;
    private vanishingPoints;
    private readonly state;
    private readonly registry;
    private mounted;
    /**
     * When true, {@link applyRect} skips the tween and writes values
     * directly to the live rect on every affected node. Callers flip
     * this on during interactive drags (where a trailing tween reads
     * as input lag) and off again on pointer-up.
     */
    private forceInstant;
    constructor(options: LayoutRuntimeOptions);
    /** Advances the internal tween manager. */
    tick(dtMs: number): void;
    /** Returns the count of in-flight layout tweens (useful for tests). */
    get activeTweenCount(): number;
    setRoot(root: LayoutNode): void;
    setViewport(viewport: LayoutRect): void;
    setVanishingPoints(vanishingPoints: LayoutVanishingPointPresets): void;
    /**
     * Recomputes rects from the current tree + viewport and animates
     * every animated node toward its new rect.
     */
    relayout(): void;
    /**
     * Same as {@link relayout} but writes every new rect instantly —
     * no tween. Use during interactive drags to avoid perceived input
     * lag. Safe to call repeatedly per frame; it never allocates
     * tween records.
     */
    relayoutInstant(): void;
    dispose(): void;
    private applyRect;
    private dropOrphans;
}
