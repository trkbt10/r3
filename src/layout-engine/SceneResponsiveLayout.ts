/**
 * @file SceneResponsiveLayout — domain object for "scene's layout
 * reacts to screen changes" without any per-mount teardown.
 *
 * # Why this exists
 *
 * Before this helper, every scene reimplemented the same dance:
 *
 *   1. compute geometry by hand (compact-vs-PC if/else, Y math, etc.)
 *   2. build widgets at the computed positions
 *   3. subscribe to {@link Stage.onScreenChange}
 *   4. on every change, dispose every widget and rebuild from scratch
 *
 * Step 4 is the bug: it loses widget state (hover, scroll, drag,
 * selection) and burns CPU. It also forces every scene to author its
 * own compact-mode branching, which scatters layout logic across the
 * codebase with no SSoT.
 *
 * The right pattern is "build widgets ONCE, push new rects on every
 * screen change". {@link LayoutRuntime} already supports this via
 * {@link LayoutRuntime.setViewport} and {@link LayoutRuntime.setRoot}.
 * `SceneResponsiveLayout` wraps that API as the single way scenes
 * subscribe to screen changes:
 *
 *   - The scene authors ONE function `plan(screen)` that returns a
 *     flex tree with `onRect` callbacks bound to widgets that already
 *     exist on the scene.
 *   - The plan can branch on `screen.orientation` / viewbox dimensions
 *     to express compact vs PC layouts — but only at this one
 *     location, not scattered across hand-rolled `applyLayout`
 *     implementations.
 *   - `SceneResponsiveLayout` constructs a runtime once, subscribes
 *     to `stage.onScreenChange`, and on every fire calls
 *     `runtime.setRoot(plan(next))` + `runtime.setViewport(...)`.
 *     Widgets receive new rects via their bound `onRect`; nothing
 *     is destroyed, no widget state is lost.
 *
 * # Usage
 *
 *   class MyScene extends Scene {
 *     onEnter(payload) {
 *       this.header = createR3Heading({ stage, text: "Title" });
 *       this.tabStrip = createR3TabBar({ stage, tabs });
 *
 *       this.layout = new SceneResponsiveLayout({
 *         stage: this.stage,
 *         plan: (screen) => {
 *           const compact = screen.orientation === "portrait";
 *           return flexBox({
 *             direction: "column",
 *             width: screen.width, height: screen.height,
 *             children: [
 *               leaf({
 *                 height: compact ? 48 : 72,
 *                 alignSelf: "stretch",
 *                 onRect: (r) => this.header.setRect(r.x, r.y, r.width, r.height),
 *               }),
 *               leaf({
 *                 flex: 1, alignSelf: "stretch",
 *                 onRect: (r) => this.tabStrip.setRect(r.x, r.y, r.width, r.height),
 *               }),
 *             ],
 *           });
 *         },
 *       });
 *     }
 *
 *     onExit() {
 *       this.layout.dispose();
 *       this.header.destroy();
 *       this.tabStrip.destroy();
 *     }
 *   }
 *
 * # Contract
 *
 * The plan function must:
 *   - be pure (depend only on `screen`)
 *   - reference widgets that already exist on the scene
 *   - return a tree whose `onRect` callbacks rebind the widgets'
 *     positions / sizes — never construct or destroy widgets
 *
 * The runtime guarantees:
 *   - the initial layout fires synchronously inside the constructor
 *     (every widget gets its first rect before the constructor returns)
 *   - every subsequent screen change re-runs the plan and pushes new
 *     rects via the same `onRect` callbacks — no teardown, no rebuild
 *   - {@link dispose} unsubscribes and disposes the runtime; widgets
 *     are NOT destroyed (the scene owns their lifecycle separately)
 */

import type { Stage } from "../Stage.ts";
import type { Screen } from "../screen";
import { LayoutRuntime } from "./runtime.ts";
import type { LayoutNode } from "./nodes.ts";
import type { LayoutTargetRegistry } from "./registry.ts";
import type { Transition } from "./types.ts";

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
export class SceneResponsiveLayout {
  private readonly runtime: LayoutRuntime;
  private readonly unsubscribe: () => void;
  private readonly stage: Stage;
  private readonly plan: (screen: Screen) => LayoutNode;
  private disposed = false;

  constructor(options: SceneResponsiveLayoutOptions) {
    this.stage = options.stage;
    this.plan = options.plan;
    const screen = this.stage.screen;
    this.runtime = new LayoutRuntime({
      root: this.plan(screen),
      viewport: { x: 0, y: 0, width: screen.width, height: screen.height },
      defaultTransition: options.defaultTransition ?? { durationMs: 0, easing: "Linear" },
      registry: options.registry,
    });
    // First paint must be instant so widgets get their initial rects
    // before the next composite — without this, the scene would render
    // one frame with widgets at their default (0, 0, 0, 0) positions
    // before the first relayout fires.
    this.runtime.relayoutInstant();
    this.unsubscribe = this.stage.onScreenChange((next) => {
      if (this.disposed) {
        return;
      }
      this.runtime.setViewport({ x: 0, y: 0, width: next.width, height: next.height });
      this.runtime.setRoot(this.plan(next));
    });
  }

  /**
   * Per-frame tick — forwards to the underlying runtime so animated
   * transitions advance. Most scenes call this from their own
   * `update(dtMs)`. Safe to call after disposal (no-op).
   */
  tick(dtMs: number): void {
    if (this.disposed) {
      return;
    }
    this.runtime.tick(dtMs);
  }

  /**
   * Forces a relayout against the current screen. Useful when the
   * scene mutates an authored size on a widget and needs to re-flow
   * without waiting for a screen change.
   */
  relayout(): void {
    if (this.disposed) {
      return;
    }
    this.runtime.setRoot(this.plan(this.stage.screen));
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribe();
    this.runtime.dispose();
  }
}
