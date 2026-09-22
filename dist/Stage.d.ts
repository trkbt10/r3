import { OrthographicCamera, Scene, Camera, WebGLRenderer } from 'three';
import { Container } from './Container.ts';
import { Node } from './Node.ts';
import { TweenManager } from './Tween.ts';
import { PointerManager } from './Pointer.ts';
import { DragManager } from './Drag.ts';
import { Screen, Rect, Orientation } from './screen';
import { TextureManager } from './texture-canvas';
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
export declare class Stage {
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
    private frameCounter;
    /**
     * Optional perspective-3D layers rendered BEFORE the orthographic
     * UI scene. Each entry is a Scene + Camera pair owned by a Scene
     * subclass (typically Title / Ending which need an immersive
     * scrolling-board backdrop). Render order is registration order.
     */
    private readonly worldLayers;
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
    private readonly worldLayerFns;
    /**
     * Optional perspective-3D overlays rendered AFTER the orthographic
     * UI scene. Used by RareCard which wants its mesh to appear in
     * front of the UI with true perspective foreshortening. Render
     * order is registration order — later entries paint on top.
     */
    private readonly overlayLayers;
    /**
     * Optional overlay-layer RENDER CALLBACKS — same purpose as
     * {@link worldLayerFns}, but drawn as the final pass after both
     * orthographic UI and perspective overlay layers. Full-screen
     * post-process overlays such as the gacha intro and dissolve plate
     * use this path so they cover prep UI and rare-card overlay meshes
     * instead of becoming their background.
     */
    private readonly overlayLayerFns;
    /**
     * Per-frame callbacks run AFTER `composeWorldState` finishes but
     * BEFORE {@link render}. Mirrors Phaser's POST_RENDER hook at the
     * moment the anchor's matrixWorld is freshest. Used by RareCard
     * stage to advance its per-card uniforms from the latest anchor
     * transforms.
     */
    private readonly frameHooks;
    private readonly destroyHooks;
    /**
     * Subscribers fired after every successful {@link setScreen}. The
     * Screen domain is mutable wholesale and consumers (HUD schema
     * runtime, layout-engine roots, world cameras) need to react to
     * changes; this fan-out is the single notification path so each
     * consumer doesn't have to poll `stage.screen` per frame.
     */
    private readonly screenSubscribers;
    constructor(options: StageOptions);
    /**
     * Adds `node` directly to the root container. Convenience so callers
     * don't have to write `stage.root.add(node)`.
     */
    add<T extends Node>(node: T): T;
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
    setScreen(screen: StageScreenInput): void;
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
    onScreenChange(fn: (screen: Screen) => void): () => void;
    /**
     * Per-frame tick. `dtMs` is real-time milliseconds elapsed since
     * the previous tick; the tween scheduler uses it for progress.
     */
    tick(dtMs: number): void;
    /**
     * Runs the render-prep pass: world alpha + visibility + renderOrder
     * propagation. Exposed so headless tests can drive composition
     * without a real RAF loop.
     */
    composeFrame(): void;
    get pointerSnapshot(): PointerSnapshot;
    /**
     * Registers a perspective-3D scene + camera that paints BEFORE the
     * stage's orthographic UI. Used by Title / Ending screens that
     * want an immersive backdrop behind the buttons. Idempotent on
     * the same scene reference.
     */
    registerWorldLayer(scene: Scene, camera: Camera): void;
    /** Removes a layer registered via {@link registerWorldLayer}. */
    unregisterWorldLayer(scene: Scene): void;
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
    registerWorldLayerFn(fn: (renderer: WebGLRenderer) => void): () => void;
    /**
     * Registers a perspective-3D scene + camera that paints AFTER the
     * stage's orthographic UI. Used by features that want 3D content
     * (RareCard shader) floating on top of the UI. Idempotent on the
     * same scene reference.
     */
    registerOverlayLayer(scene: Scene, camera: Camera): void;
    /** Removes a layer registered via {@link registerOverlayLayer}. */
    unregisterOverlayLayer(scene: Scene): void;
    /**
     * Registers a callback that draws into the framebuffer during the
     * final post-UI overlay phase of {@link render}. Use this for
     * composer-backed overlays that should cover both normal
     * orthographic UI and perspective overlay layers.
     */
    registerOverlayLayerFn(fn: (renderer: WebGLRenderer) => void): () => void;
    /**
     * Registers a per-frame hook run after `composeWorldState` and
     * before {@link render}. The returned disposer removes the hook;
     * callers should hold onto it for cleanup.
     */
    onFrame(hook: () => void): () => void;
    /**
     * Registers teardown work owned by subsystems that live beside the
     * r3 node tree. Hooks run once at the start of {@link destroy}.
     */
    onDestroy(hook: () => void): () => void;
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
    render(renderer: WebGLRenderer): void;
    /**
     * Tears down the stage — removes every node and clears the Three
     * scene. The renderer outlives the stage.
     */
    destroy(): void;
}
