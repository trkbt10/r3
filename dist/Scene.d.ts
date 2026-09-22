import { Container } from './Container.ts';
import { NodeListener, NodeEventName } from './Node.ts';
import { Stage } from './Stage.ts';
/** Optional payload passed into `enter`; per-scene shape. */
export type SceneData = Readonly<Record<string, unknown>>;
/**
 * Subclassed by every gameplay/menu scene. The payload type is left
 * generic so concrete scenes can tighten it.
 */
export declare abstract class Scene<TData extends SceneData = SceneData> {
    /** Stage this scene draws into. Provided by the SceneManager. */
    protected readonly stage: Stage;
    /** Container holding every node the scene owns; auto-disposed on exit. */
    protected readonly root: Container;
    /** Disposers for global pointer listeners + arbitrary cleanup. */
    protected readonly disposers: Array<() => void>;
    /** Display name; useful for logging and the SceneManager's bookkeeping. */
    readonly name: string;
    /** True after `enter` returned and before `exit` started. */
    private _active;
    constructor(stage: Stage, name: string);
    get active(): boolean;
    /**
     * Applies a renderOrder offset to the scene's root container so it
     * paints above (higher) or below (lower) other active scenes.
     * SceneManager calls this before `enter` to honour the registered
     * depth — subclasses can also call it mid-life to re-layer.
     */
    setDepth(depth: number): this;
    /**
     * Adds the scene's root to the Stage and runs subclass `onEnter`.
     * Idempotent: a second call with no intervening `exit` is a no-op
     * so SceneManager bookkeeping doesn't accidentally double-enter.
     */
    enter(payload: TData): void;
    /**
     * Per-frame hook. Default: no-op. Subclasses override for camera /
     * countdown / etc. Called only while `active` is true.
     */
    update(dtMs: number): void;
    /**
     * Tears the scene down. Cascades through the root container,
     * runs every registered disposer, and clears state. Idempotent.
     */
    exit(): void;
    /**
     * Subclass hook for setup. Called by `enter` after the root is
     * attached to the stage. Default no-op.
     */
    protected onEnter(payload: TData): void;
    /**
     * Subclass hook for teardown. Runs BEFORE the root is destroyed —
     * subclasses can reach into root descendants here if needed.
     */
    protected onExit(): void;
    /**
     * Registers a global stage pointer listener and tracks its
     * disposer so `exit()` cleans it up. Mirrors the Phaser scene's
     * `scene.input.on(...)` shape.
     */
    protected onPointer(event: NodeEventName, listener: NodeListener): void;
    /**
     * Tracks `dispose` so `exit()` runs it. Use for any non-r3 cleanup
     * the scene needs (DOM listeners, RAF handles, …).
     */
    protected addDisposer(dispose: () => void): void;
}
