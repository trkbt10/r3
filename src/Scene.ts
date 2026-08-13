/**
 * @file Scene — base class for an r3 game scene.
 *
 * Mirrors the slice of the Phaser Scene contract the project actually
 * uses: an `enter` (= Phaser `init`+`create`), an `update`, and an
 * `exit` (= Phaser `shutdown`). The base class wires the scene's
 * root {@link Container} into the {@link Stage}, advances the
 * subtree's per-frame work, and tears it down on exit.
 *
 * ## Lifecycle
 *
 *   1. SceneManager constructs the Scene with `(stage, payload)`.
 *   2. SceneManager calls `enter()` exactly once. Subclasses do their
 *      setup here — building child nodes, registering pointer
 *      listeners, scheduling tweens.
 *   3. Each frame the manager calls `update(dtMs)` with real-time
 *      milliseconds since the previous tick. Subclasses run any
 *      per-frame bookkeeping (camera follow, timer countdowns, …).
 *   4. SceneManager calls `exit()` exactly once when the scene leaves
 *      the active set. The base class destroys the root container
 *      (which cascades through children) and removes any global
 *      pointer listeners the scene registered via `onPointer`.
 *
 * ## Multi-scene composition
 *
 * The Stage hosts ALL active scenes simultaneously, much like Phaser
 * lets multiple scenes coexist. The overlay/modal pattern lives as
 * "second active scene with higher depth"; SceneManager uses depth
 * to layer them.
 */

import { Container } from "./Container.ts";
import type { NodeListener, NodeEventName, PointerEvent } from "./Node.ts";
import type { Stage } from "./Stage.ts";

/** Optional payload passed into `enter`; per-scene shape. */
export type SceneData = Readonly<Record<string, unknown>>;

/**
 * Subclassed by every gameplay/menu scene. The payload type is left
 * generic so concrete scenes can tighten it.
 */
export abstract class Scene<TData extends SceneData = SceneData> {
  /** Stage this scene draws into. Provided by the SceneManager. */
  protected readonly stage: Stage;
  /** Container holding every node the scene owns; auto-disposed on exit. */
  protected readonly root: Container;
  /** Disposers for global pointer listeners + arbitrary cleanup. */
  protected readonly disposers: Array<() => void>;
  /** Display name; useful for logging and the SceneManager's bookkeeping. */
  readonly name: string;
  /** True after `enter` returned and before `exit` started. */
  private _active: boolean;

  constructor(stage: Stage, name: string) {
    this.stage = stage;
    this.name = name;
    this.root = new Container({ name: `r3:scene:${name}` });
    this.disposers = [];
    this._active = false;
  }

  get active(): boolean {
    return this._active;
  }

  /**
   * Applies a renderOrder offset to the scene's root container so it
   * paints above (higher) or below (lower) other active scenes.
   * SceneManager calls this before `enter` to honour the registered
   * depth — subclasses can also call it mid-life to re-layer.
   */
  setDepth(depth: number): this {
    this.root.setDepth(depth);
    return this;
  }

  /**
   * Adds the scene's root to the Stage and runs subclass `onEnter`.
   * Idempotent: a second call with no intervening `exit` is a no-op
   * so SceneManager bookkeeping doesn't accidentally double-enter.
   */
  enter(payload: TData): void {
    if (this._active) {
      return;
    }
    this._active = true;
    this.stage.root.add(this.root);
    this.onEnter(payload);
  }

  /**
   * Per-frame hook. Default: no-op. Subclasses override for camera /
   * countdown / etc. Called only while `active` is true.
   */
  update(dtMs: number): void {
    // Subclass override.
    void dtMs;
  }

  /**
   * Tears the scene down. Cascades through the root container,
   * runs every registered disposer, and clears state. Idempotent.
   */
  exit(): void {
    if (!this._active) {
      return;
    }
    this._active = false;
    this.onExit();
    for (const d of this.disposers) {
      d();
    }
    this.disposers.length = 0;
    this.root.destroy();
  }

  /**
   * Subclass hook for setup. Called by `enter` after the root is
   * attached to the stage. Default no-op.
   */
  protected onEnter(payload: TData): void {
    // Subclass override.
    void payload;
  }

  /**
   * Subclass hook for teardown. Runs BEFORE the root is destroyed —
   * subclasses can reach into root descendants here if needed.
   */
  protected onExit(): void {
    // Subclass override.
  }

  /**
   * Registers a global stage pointer listener and tracks its
   * disposer so `exit()` cleans it up. Mirrors the Phaser scene's
   * `scene.input.on(...)` shape.
   */
  protected onPointer(event: NodeEventName, listener: NodeListener): void {
    const dispose = this.stage.pointer.on(event, (e: PointerEvent) => {
      listener(e);
    });
    this.disposers.push(dispose);
  }

  /**
   * Tracks `dispose` so `exit()` runs it. Use for any non-r3 cleanup
   * the scene needs (DOM listeners, RAF handles, …).
   */
  protected addDisposer(dispose: () => void): void {
    this.disposers.push(dispose);
  }
}
