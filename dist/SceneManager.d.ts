import { Scene, SceneData } from './Scene.ts';
import { Stage } from './Stage.ts';
/**
 * Concrete-scene factory. Each call yields a brand-new instance —
 * the manager handles caching.
 */
export type SceneFactory = (stage: Stage, key: string) => Scene;
export type SceneRegistration = {
    readonly key: string;
    readonly factory: SceneFactory;
    /**
     * Default depth applied to the scene's root container when it
     * activates. Higher = paints on top. Modals typically register
     * at 1000+.
     */
    readonly depth?: number;
};
export type StartOptions = {
    /**
     * If true, every other currently-active scene is exited before
     * this one enters (matches Phaser `scene.start`). Defaults to
     * false (matches Phaser `scene.launch`).
     */
    readonly replace?: boolean;
    /**
     * Force a fresh instance even if a cached one exists. Used when
     * the scene wants to start in a known initial state.
     */
    readonly recreate?: boolean;
};
/**
 * Routes scene-lifecycle calls (start/stop/restart) at a per-Stage
 * registry of named factories. Mirrors the shape of Phaser's
 * SceneManager closely enough for the existing scene-launch call
 * sites to translate one-to-one.
 */
export declare class SceneManager {
    private readonly stage;
    private readonly slots;
    private readonly active;
    private readonly enterListeners;
    constructor(stage: Stage);
    /**
     * Subscribes to every scene activation, across every key. Fired
     * once per {@link start} call, right before the scene's own
     * `enter` runs — hosts use this for cross-scene lifecycle hooks
     * (analytics, audio ducking, layout-editor rebind) that shouldn't
     * live inside each scene implementation. Returns a disposer that
     * removes the listener.
     */
    onSceneEnter(listener: (key: string) => void): () => void;
    /** Register a scene factory under `key`. Re-registering replaces. */
    register(registration: SceneRegistration): this;
    /**
     * Activates the scene registered under `key`. Returns the live
     * instance so callers can reach into scene-specific state if
     * needed.
     */
    start<TData extends SceneData = SceneData>(key: string, payload?: TData, options?: StartOptions): Scene;
    /** Stops the named scene if it is active. No-op if it isn't. */
    stop(key: string): void;
    /** Exits every currently-active scene. */
    stopAll(): void;
    /** True when the named scene is currently active. */
    isActive(key: string): boolean;
    /** Returns the live instance of `key`, or null. */
    get(key: string): Scene | null;
    /** Snapshot of currently-active scenes (insertion order). */
    get activeScenes(): readonly Scene[];
    /**
     * Per-frame tick — forwards dt to each active scene's `update`.
     * The Stage's `tick(dtMs)` is the right place to call this from
     * the host loop; the manager doesn't tick the Stage on its own
     * because the host owns frame timing.
     */
    update(dtMs: number): void;
}
