/**
 * @file SceneManager — orchestrates active r3 {@link Scene}s.
 *
 * Plays the role of `Phaser.Scenes.SceneManager` for the r3 layer.
 * Concrete scenes are registered by string key; the manager creates
 * one instance on first `start` and reuses it on subsequent starts
 * unless the caller passes `recreate: true`.
 *
 * The manager owns no rendering — it forwards `tick(dtMs)` to every
 * active scene's `update`, and the host (the {@link Stage}'s render
 * pass) handles the actual draw.
 *
 * ## Multi-active scenes
 *
 * `start(key)` adds a scene to the active set; previous scenes keep
 * running unless the caller calls `stop(otherKey)`. This matches the
 * Phaser pattern where `scene.start()` swaps and `scene.launch()`
 * adds — we expose a single `start` with a `replace?: boolean` flag
 * so callers can pick.
 *
 * Depth ordering: scenes register a default depth (the higher, the
 * later it paints — modal/overlay scenes naturally read above
 * gameplay). Each scene's root container's depth is set to the
 * registered value when it activates.
 */

import type { Scene, SceneData } from "./Scene.ts";
import type { Stage } from "./Stage.ts";

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

type Slot = {
  readonly registration: SceneRegistration;
  /** Cached instance; null until first activation. */
  instance: Scene | null;
};

/**
 * Routes scene-lifecycle calls (start/stop/restart) at a per-Stage
 * registry of named factories. Mirrors the shape of Phaser's
 * SceneManager closely enough for the existing scene-launch call
 * sites to translate one-to-one.
 */
export class SceneManager {
  private readonly stage: Stage;
  private readonly slots: Map<string, Slot>;
  private readonly active: Set<Scene>;
  private readonly enterListeners: Array<(key: string) => void>;

  constructor(stage: Stage) {
    this.stage = stage;
    this.slots = new Map();
    this.active = new Set();
    this.enterListeners = [];
  }

  /**
   * Subscribes to every scene activation, across every key. Fired
   * once per {@link start} call, right before the scene's own
   * `enter` runs — hosts use this for cross-scene lifecycle hooks
   * (analytics, audio ducking, layout-editor rebind) that shouldn't
   * live inside each scene implementation. Returns a disposer that
   * removes the listener.
   */
  onSceneEnter(listener: (key: string) => void): () => void {
    this.enterListeners.push(listener);
    return () => {
      const index = this.enterListeners.indexOf(listener);
      if (index !== -1) {
        this.enterListeners.splice(index, 1);
      }
    };
  }

  /** Register a scene factory under `key`. Re-registering replaces. */
  register(registration: SceneRegistration): this {
    const slot = this.slots.get(registration.key);
    if (slot) {
      // If the cached instance is currently active, exit it first;
      // the next `start` will re-create.
      if (slot.instance && this.active.has(slot.instance)) {
        slot.instance.exit();
        this.active.delete(slot.instance);
      }
      slot.instance = null;
    }
    this.slots.set(registration.key, {
      registration,
      instance: null,
    });
    return this;
  }

  /**
   * Activates the scene registered under `key`. Returns the live
   * instance so callers can reach into scene-specific state if
   * needed.
   */
  start<TData extends SceneData = SceneData>(
    key: string,
    payload?: TData,
    options: StartOptions = {},
  ): Scene {
    const slot = this.slots.get(key);
    if (!slot) {
      throw new Error(`SceneManager.start: no scene registered for "${key}"`);
    }
    if (options.replace === true) {
      this.stopAll();
    }
    if (options.recreate === true && slot.instance) {
      if (this.active.has(slot.instance)) {
        slot.instance.exit();
        this.active.delete(slot.instance);
      }
      slot.instance = null;
    }
    const scene = slot.instance ?? slot.registration.factory(this.stage, key);
    slot.instance = scene;
    if (this.active.has(scene)) {
      // Already running; restart by exit/enter so onEnter sees the
      // fresh payload.
      scene.exit();
      this.active.delete(scene);
    }
    if (slot.registration.depth !== undefined) {
      scene.setDepth(slot.registration.depth);
    }
    for (const listener of this.enterListeners) {
      listener(key);
    }
    scene.enter(payload ?? ({} as TData));
    this.active.add(scene);
    return scene;
  }

  /** Stops the named scene if it is active. No-op if it isn't. */
  stop(key: string): void {
    const slot = this.slots.get(key);
    if (!slot || !slot.instance) {
      return;
    }
    if (this.active.has(slot.instance)) {
      slot.instance.exit();
      this.active.delete(slot.instance);
    }
  }

  /** Exits every currently-active scene. */
  stopAll(): void {
    const snapshot = Array.from(this.active);
    for (const scene of snapshot) {
      scene.exit();
    }
    this.active.clear();
  }

  /** True when the named scene is currently active. */
  isActive(key: string): boolean {
    const slot = this.slots.get(key);
    if (!slot || !slot.instance) {
      return false;
    }
    return this.active.has(slot.instance);
  }

  /** Returns the live instance of `key`, or null. */
  get(key: string): Scene | null {
    return this.slots.get(key)?.instance ?? null;
  }

  /** Snapshot of currently-active scenes (insertion order). */
  get activeScenes(): readonly Scene[] {
    return Array.from(this.active);
  }

  /**
   * Per-frame tick — forwards dt to each active scene's `update`.
   * The Stage's `tick(dtMs)` is the right place to call this from
   * the host loop; the manager doesn't tick the Stage on its own
   * because the host owns frame timing.
   */
  update(dtMs: number): void {
    for (const scene of this.active) {
      scene.update(dtMs);
    }
  }
}
