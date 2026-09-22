import { Stage } from '../Stage.ts';
import { Screen } from '../screen';
import { LayoutNode } from './nodes.ts';
import { LayoutTargetRegistry } from './registry.ts';
import { Transition } from './types.ts';
export type SceneResponsiveLayoutOptions = {
    /** Stage to subscribe to and to read the initial screen from. */
    readonly stage: Stage;
    /**
     * Returns the layout tree for a given screen. Called once at mount
     * and once per screen change. The tree's leaves' `onRect`
     * callbacks should rebind widgets that already exist on the scene
     * — never construct or destroy widgets here.
     */
    readonly plan: (screen: Screen) => LayoutNode;
    /**
     * Optional default transition for animated rect changes. Defaults
     * to instant — most scenes want their layout to track screen
     * changes without lag.
     */
    readonly defaultTransition?: Transition;
    readonly registry?: LayoutTargetRegistry;
};
/** SceneResponsiveLayout provides the SceneResponsiveLayout API. */
export declare class SceneResponsiveLayout {
    private readonly runtime;
    private readonly unsubscribe;
    private readonly stage;
    private readonly plan;
    private disposed;
    constructor(options: SceneResponsiveLayoutOptions);
    /**
     * Per-frame tick — forwards to the underlying runtime so animated
     * transitions advance. Most scenes call this from their own
     * `update(dtMs)`. Safe to call after disposal (no-op).
     */
    tick(dtMs: number): void;
    /**
     * Forces a relayout against the current screen. Useful when the
     * scene mutates an authored size on a widget and needs to re-flow
     * without waiting for a screen change.
     */
    relayout(): void;
    dispose(): void;
}
