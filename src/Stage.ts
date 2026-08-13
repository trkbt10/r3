/**
 * @file Stage — root of an r3 UI scene.
 *
 * A Stage owns:
 *  - a `THREE.Scene` (the UI render scene)
 *  - an `OrthographicCamera` configured so logical pixel (0, 0) lands
 *    at the top-left and (width, height) at the bottom-right
 *  - a root {@link Container} that consumer code populates with Nodes
 *  - a {@link TweenManager} that ticks each frame
 *  - a {@link PointerManager} for hit-testing and event dispatch
 *  - a {@link DragManager} layered on top of the pointer manager
 *
 * The stage does NOT own a `WebGLRenderer`. A single renderer for the
 * whole game lives in `ThreeShell`; the stage exposes its scene +
 * camera so the shell can `renderer.render(stage.scene, stage.camera)`
 * each frame after the world (3D board) layer.
 *
 * ## Camera convention
 *
 * The camera uses `OrthographicCamera(0, width, 0, -height, near,
 * far)`. Top is 0, bottom is -height. Combined with the Y-negation
 * applied at every Node's `applyTransform()`, this gives the
 * Phaser-style y-down logical coordinate system at the consumer
 * boundary while staying inside Three's right-handed convention.
 *
 * ## Frame loop
 *
 * Consumers call `stage.tick(dtMs)` once per frame:
 *   1. The TweenManager advances; tween callbacks run (which may
 *      mutate node positions / alphas / sizes).
 *   2. `composeFrame()` walks the tree assigning world alpha,
 *      visibility, and renderOrder. Leaf materials get `.opacity`
 *      pushed into them so transparency reflects the latest state.
 *   3. The render itself is the caller's responsibility (so the
 *      shell can interleave world + UI draws).
 */

import { OrthographicCamera, Scene } from "three";
import type { Camera, WebGLRenderer } from "three";

/**
 * Optional handle to the app's single renderer. Stage does not own the
 * renderer (see the file-level doc), but features mounted as world or
 * overlay layers occasionally need synchronous access during setup —
 * most notably {@link PMREMGenerator}-driven environment maps, which
 * have to compile their shader before the first render. Exposing the
 * renderer on the stage gives those features a well-defined handle
 * without having to thread it through every scene factory.
 */
import { Container } from "./Container.ts";
import type { Node } from "./Node.ts";
import { TweenManager } from "./Tween.ts";
import { PointerManager } from "./Pointer.ts";
import { DragManager } from "./Drag.ts";
import { makeScreen, type Screen, type Rect, type Orientation } from "./screen";
import type { TextureManager } from "./texture-canvas";

/**
 * Screen-shaped input the Stage accepts at construction / setScreen.
 * `viewbox` and `orientation` are derived if omitted, so test and
 * sandbox callers can hand in just `{ width, height }`. The Stage
 * itself stores a fully-resolved {@link Screen} on `this.screen`.
 */
export type StageScreenInput = {
  readonly width: number;
  readonly height: number;
  readonly viewbox?: Rect;
  readonly orientation?: Orientation;
};

export type StageOptions = {
  /**
   * Logical drawing surface the Stage paints into. Width / height
   * become the orthographic camera bounds and the SoT every scene
   * mounted on this Stage reads from (`stage.screen.width / stage.screen.height`).
   *
   * Required as an explicit dependency — the Stage no longer falls
   * back to ambient constants. Production constructs `PC_SCREEN`;
   * sandbox / test harnesses can build their own.
   */
  readonly screen: StageScreenInput;
  /**
   * Near plane in world units. Default −1000. A positive depth field
   * on a Node maps to a renderOrder offset, not to a Z translation —
   * UI nodes all sit at z=0 in three space — so the depth range is
   * bookkeeping. Keep the planes generous so future per-node z
   * offsets (e.g. shadow plates) have headroom.
   */
  readonly near?: number;
  readonly far?: number;
  /**
   * The app's renderer, surfaced so world / overlay layers can grab it
   * synchronously during their own setup (see the {@link Stage.renderer}
   * doc). Optional because headless tests construct a Stage without a
   * GL context.
   */
  readonly renderer?: WebGLRenderer;
  readonly textureManager: TextureManager;
};

/**
 * Per-frame snapshot of pointer state, used by tween-driven UIs that
 * want to know "is the pointer down" without subscribing to every
 * pointermove. Exposed as `stage.pointerSnapshot`.
 */
export type PointerSnapshot = {
  readonly x: number;
  readonly y: number;
  readonly isDown: boolean;
};

/**
 * The r3 stage — root of an orthographic Three.js UI scene plus its
 * tween, pointer, and drag managers. One stage per active UI surface.
 */
export class Stage {
  /** Three.js scene the renderer draws. Public so the shell can render it. */
  readonly scene: Scene;
  /** Orthographic camera matching the logical viewport. */
  readonly camera: OrthographicCamera;
  /** Root container — every UI node ends up under here. */
  readonly root: Container;
  /**
   * Optional reference to the app's renderer. Set when the owning host
   * passes one through {@link StageOptions.renderer}; world / overlay
   * layers that need PMREM etc. can read this instead of having the
   * renderer threaded through every scene factory. Undefined in
   * headless / test contexts.
   */
  readonly renderer: WebGLRenderer | null;
  readonly textureManager: TextureManager;
  /** Time-driven tween scheduler. */
  readonly tweens: TweenManager;
  /** Pointer event router (owned by the stage, fed by the shell). */
  readonly pointer: PointerManager;
  /** Drag-and-drop manager built on top of {@link pointer}. */
  readonly drag: DragManager;

  /**
   * The logical drawing surface this Stage paints into — the SoT for
   * "how big is the screen we're laying out for". Held as a {@link Screen}
   * domain object, *not* destructured into raw `width: number; height: number;`
   * fields, so the type signature carries the intent and the codebase
   * never accidentally treats two unrelated numbers as a screen.
   *
   * Mutable wholesale: {@link setScreen} replaces the reference and
   * updates the camera in lockstep. Pixel-piecewise mutation is forbidden
   * because the Screen is `readonly`; callers wanting a different size
   * construct a new {@link Screen} and hand it through `setScreen`.
   */
  screen: Screen;
  /**
   * Monotonic per-frame counter; tweens compute their elapsed time
   * from a real-time clock so this is informational, not load-bearing.
   */
  private frameCounter: number;

  /**
   * Optional perspective-3D layers rendered BEFORE the orthographic
   * UI scene. Each entry is a Scene + Camera pair owned by a Scene
   * subclass (typically Title / Ending which need an immersive
   * scrolling-board backdrop). Render order is registration order.
   */
  private readonly worldLayers: Array<{ readonly scene: Scene; readonly camera: Camera }>;

  /**
   * Optional world-layer RENDER CALLBACKS — used by features that
   * need to draw into the framebuffer with a non-trivial pass setup
   * (post-processing composers, raymarched volumetrics) that the
   * `renderer.render(scene, camera)` path does not support.
   *
   * Callbacks fire AFTER the plain {@link worldLayers} but BEFORE
   * the ortho UI scene renders, so UI draws composite on top of
   * whatever the callback painted. Registration order is honoured.
   */
  private readonly worldLayerFns: Array<(renderer: WebGLRenderer) => void>;

  /**
   * Optional perspective-3D overlays rendered AFTER the orthographic
   * UI scene. Used by RareCard which wants its mesh to appear in
   * front of the UI with true perspective foreshortening. Render
   * order is registration order — later entries paint on top.
   */
  private readonly overlayLayers: Array<{ readonly scene: Scene; readonly camera: Camera }>;

  /**
   * Optional overlay-layer RENDER CALLBACKS — same purpose as
   * {@link worldLayerFns}, but drawn as the final pass after both
   * orthographic UI and perspective overlay layers. Full-screen
   * post-process overlays such as the gacha intro and dissolve plate
   * use this path so they cover prep UI and rare-card overlay meshes
   * instead of becoming their background.
   */
  private readonly overlayLayerFns: Array<(renderer: WebGLRenderer) => void>;

  /**
   * Per-frame callbacks run AFTER `composeWorldState` finishes but
   * BEFORE {@link render}. Mirrors Phaser's POST_RENDER hook at the
   * moment the anchor's matrixWorld is freshest. Used by RareCard
   * stage to advance its per-card uniforms from the latest anchor
   * transforms.
   */
  private readonly frameHooks: Array<() => void>;
  private readonly destroyHooks: Array<() => void>;

  /**
   * Subscribers fired after every successful {@link setScreen}. The
   * Screen domain is mutable wholesale and consumers (HUD schema
   * runtime, layout-engine roots, world cameras) need to react to
   * changes; this fan-out is the single notification path so each
   * consumer doesn't have to poll `stage.screen` per frame.
   */
  private readonly screenSubscribers: Set<(screen: Screen) => void>;

  constructor(options: StageOptions) {
    this.screen = makeScreen(options.screen);
    this.frameCounter = 0;
    this.renderer = options.renderer ?? null;
    this.textureManager = options.textureManager;

    this.scene = new Scene();
    const near = options.near ?? -1000;
    const far = options.far ?? 1000;
    this.camera = new OrthographicCamera(0, this.screen.width, 0, -this.screen.height, near, far);
    this.camera.position.set(0, 0, 0);

    this.root = new Container({ name: "r3:root" });
    // The root container is "attached" to the stage manually — it has
    // no parent Container, so we patch its stage reference and add its
    // obj3d to the scene directly.
    this.root._attachToStage(this);
    this.scene.add(this.root.obj3d);

    this.tweens = new TweenManager();
    this.pointer = new PointerManager(this);
    this.drag = new DragManager(this.pointer);
    this.worldLayers = [];
    this.worldLayerFns = [];
    this.overlayLayers = [];
    this.overlayLayerFns = [];
    this.frameHooks = [];
    this.destroyHooks = [];
    this.screenSubscribers = new Set();
  }

  /**
   * Adds `node` directly to the root container. Convenience so callers
   * don't have to write `stage.root.add(node)`.
   */
  add<T extends Node>(node: T): T {
    this.root.add(node);
    return node;
  }

  /**
   * Re-targets the logical drawing surface. Updates the orthographic
   * camera so world-space coordinates keep their 1-pixel-per-unit
   * identity at the new screen. No-op on a structurally identical
   * screen (same width × height) so a resize-observer that fires
   * repeatedly during a drag doesn't burn re-projections.
   *
   * Takes a {@link Screen} domain object — not a `(width, height)`
   * pair — so the call site has to declare what it's handing in. The
   * old positional `(w, h)` signature let any two numbers stand in
   * for "the screen", which the SoT design forbids.
   *
   * Scene contents are NOT repositioned — that's the caller's job
   * (typically via a {@link LayoutRuntime} that relayouts after this
   * call).
   */
  setScreen(screen: StageScreenInput): void {
    const next = makeScreen(screen);
    if (
      this.screen.width === next.width &&
      this.screen.height === next.height &&
      this.screen.viewbox.x === next.viewbox.x &&
      this.screen.viewbox.y === next.viewbox.y &&
      this.screen.viewbox.width === next.viewbox.width &&
      this.screen.viewbox.height === next.viewbox.height &&
      this.screen.orientation === next.orientation
    ) {
      return;
    }
    this.screen = next;
    const ortho = this.camera as OrthographicCamera;
    ortho.left = 0;
    ortho.right = next.width;
    ortho.top = 0;
    ortho.bottom = -next.height;
    ortho.updateProjectionMatrix();
    // Snapshot before iterating — a subscriber that unsubscribes
    // during its own callback (or schedules a follow-up setScreen)
    // must not perturb iteration of sibling subscribers.
    const snapshot = Array.from(this.screenSubscribers);
    for (const fn of snapshot) {
      fn(next);
    }
  }

  /**
   * Subscribes to {@link setScreen} events. Fires after the camera
   * and `this.screen` have been updated, with the new {@link Screen}.
   * Returns a disposer.
   *
   * Does NOT fire immediately with the current screen — subscribers
   * are responsible for laying out against `stage.screen` at mount
   * time. The notification path is purely for *changes*, so a
   * consumer that mounts at boot doesn't get a redundant initial
   * callback that conflicts with its own first-frame layout.
   */
  onScreenChange(fn: (screen: Screen) => void): () => void {
    this.screenSubscribers.add(fn);
    return () => {
      this.screenSubscribers.delete(fn);
    };
  }

  /**
   * Per-frame tick. `dtMs` is real-time milliseconds elapsed since
   * the previous tick; the tween scheduler uses it for progress.
   */
  tick(dtMs: number): void {
    this.frameCounter += 1;
    this.tweens.advance(dtMs);
    this.composeFrame();
    if (this.frameHooks.length > 0) {
      const snapshot = this.frameHooks.slice();
      for (const hook of snapshot) {
        hook();
      }
    }
  }

  /**
   * Runs the render-prep pass: world alpha + visibility + renderOrder
   * propagation. Exposed so headless tests can drive composition
   * without a real RAF loop.
   */
  composeFrame(): void {
    this.root.composeWorldState(1, true);
    this.root.composeRenderOrder(0, 0);
  }

  get pointerSnapshot(): PointerSnapshot {
    return this.pointer.snapshot;
  }

  /**
   * Registers a perspective-3D scene + camera that paints BEFORE the
   * stage's orthographic UI. Used by Title / Ending screens that
   * want an immersive backdrop behind the buttons. Idempotent on
   * the same scene reference.
   */
  registerWorldLayer(scene: Scene, camera: Camera): void {
    if (this.worldLayers.some((layer) => layer.scene === scene)) {
      return;
    }
    this.worldLayers.push({ scene, camera });
  }

  /** Removes a layer registered via {@link registerWorldLayer}. */
  unregisterWorldLayer(scene: Scene): void {
    const idx = this.worldLayers.findIndex((layer) => layer.scene === scene);
    if (idx < 0) {
      return;
    }
    this.worldLayers.splice(idx, 1);
  }

  /**
   * Registers a callback that draws into the framebuffer during the
   * world-layer phase of {@link render}. Used by features whose
   * rendering can't be expressed as a plain
   * `renderer.render(scene, camera)` — most notably post-processing
   * composers (EffectComposer + radial-blur god-rays, etc.) which
   * own their own pass chain and need to call `composer.render()`
   * directly.
   *
   * Callbacks fire AFTER every plain world layer but BEFORE the
   * ortho UI scene, so UI composites on top of whatever the
   * callback painted. Returns a disposer.
   */
  registerWorldLayerFn(fn: (renderer: WebGLRenderer) => void): () => void {
    this.worldLayerFns.push(fn);
    return () => {
      const idx = this.worldLayerFns.indexOf(fn);
      if (idx >= 0) {
        this.worldLayerFns.splice(idx, 1);
      }
    };
  }

  /**
   * Registers a perspective-3D scene + camera that paints AFTER the
   * stage's orthographic UI. Used by features that want 3D content
   * (RareCard shader) floating on top of the UI. Idempotent on the
   * same scene reference.
   */
  registerOverlayLayer(scene: Scene, camera: Camera): void {
    if (this.overlayLayers.some((layer) => layer.scene === scene)) {
      return;
    }
    this.overlayLayers.push({ scene, camera });
  }

  /** Removes a layer registered via {@link registerOverlayLayer}. */
  unregisterOverlayLayer(scene: Scene): void {
    const idx = this.overlayLayers.findIndex((layer) => layer.scene === scene);
    if (idx < 0) {
      return;
    }
    this.overlayLayers.splice(idx, 1);
  }

  /**
   * Registers a callback that draws into the framebuffer during the
   * final post-UI overlay phase of {@link render}. Use this for
   * composer-backed overlays that should cover both normal
   * orthographic UI and perspective overlay layers.
   */
  registerOverlayLayerFn(fn: (renderer: WebGLRenderer) => void): () => void {
    this.overlayLayerFns.push(fn);
    return () => {
      const idx = this.overlayLayerFns.indexOf(fn);
      if (idx >= 0) {
        this.overlayLayerFns.splice(idx, 1);
      }
    };
  }

  /**
   * Registers a per-frame hook run after `composeWorldState` and
   * before {@link render}. The returned disposer removes the hook;
   * callers should hold onto it for cleanup.
   */
  onFrame(hook: () => void): () => void {
    this.frameHooks.push(hook);
    return () => {
      const idx = this.frameHooks.indexOf(hook);
      if (idx >= 0) {
        this.frameHooks.splice(idx, 1);
      }
    };
  }

  /**
   * Registers teardown work owned by subsystems that live beside the
   * r3 node tree. Hooks run once at the start of {@link destroy}.
   */
  onDestroy(hook: () => void): () => void {
    this.destroyHooks.push(hook);
    return () => {
      const idx = this.destroyHooks.indexOf(hook);
      if (idx >= 0) {
        this.destroyHooks.splice(idx, 1);
      }
    };
  }

  /**
   * Renders the stage's full visual stack into `renderer`:
   *   1. Each registered world layer (perspective scene + camera) in
   *      registration order. Caller is expected to have set
   *      `renderer.autoClear = false` so these passes composite into
   *      whatever the host already drew below us.
   *   2. The orthographic UI scene on top of all world layers.
   *   3. Each registered overlay layer above the UI.
   *
   * The host (ThreeShell) handles clearing on its own first pass and
   * disables autoClear before invoking us; we only paint into the
   * existing framebuffer.
   */
  render(renderer: WebGLRenderer): void {
    for (const layer of this.worldLayers) {
      renderer.render(layer.scene, layer.camera);
    }
    for (const fn of this.worldLayerFns) {
      fn(renderer);
    }
    // Keep the color buffer but discard perspective-world depth
    // before UI and overlay passes. With autoClear disabled, a title
    // or board world layer can otherwise leave depth values that
    // occlude later rare-card overlay meshes while normal UI text and
    // frames still appear.
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.clearDepth();
    for (const layer of this.overlayLayers) {
      renderer.render(layer.scene, layer.camera);
    }
    for (const fn of this.overlayLayerFns) {
      fn(renderer);
    }
  }

  /**
   * Tears down the stage — removes every node and clears the Three
   * scene. The renderer outlives the stage.
   */
  destroy(): void {
    const destroyHooks = this.destroyHooks.slice();
    this.destroyHooks.length = 0;
    for (const hook of destroyHooks) {
      hook();
    }
    this.tweens.killAll();
    this.pointer.dispose();
    this.drag.dispose();
    this.root.destroy();
    this.scene.remove(...this.scene.children);
    // Release scene/camera pairs registered by overlay subsystems
    // (e.g. `R3RareCardStage`) and any frame hooks they installed.
    // Symmetric with `worldLayers`; without this, a second Stage
    // built over the same process (tests / HMR) would see stale
    // references pinned by the previous stage's registry.
    this.worldLayers.length = 0;
    this.worldLayerFns.length = 0;
    this.overlayLayers.length = 0;
    this.overlayLayerFns.length = 0;
    this.frameHooks.length = 0;
    this.screenSubscribers.clear();
  }
}
