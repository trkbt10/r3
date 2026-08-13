/**
 * @file @trkbt10/r3 consumer fixture — a real browser app that
 * exercises the built package for visual / consumer-side review.
 *
 * Every import below resolves through `vite.config.ts`'s alias table
 * onto `../dist` (never `../src` — see that file's header for why).
 * The app renders one of four deterministic states, chosen by the
 * `?state=` URL query parameter:
 *
 *   - `showcase` (default) — heading, a clickable Button whose click
 *     count renders back into the scene, a Panel, a TextInput, a
 *     ScrollablePanel with several rows, all placed via the
 *     layout-engine subpath.
 *   - `empty` — a bare Stage with nothing mounted (the zero state).
 *   - `dialog` — the showcase scene plus an `openR3Dialog` modal
 *     already open on load.
 *   - `spotlight` — the showcase scene plus a spotlight overlay
 *     (from the `spotlight` subpath) pointed at the button.
 *
 * No random or wall-clock-derived data feeds into scene content —
 * only `requestAnimationFrame`'s frame-to-frame delta (tween
 * progression), which is expected motion, not nondeterministic
 * content. `window.__R3__` (see `installR3Inspector`) is installed
 * unconditionally so external automation can inspect and drive the
 * scene without relying on canvas pixel matching alone.
 */
import { WebGLRenderer } from "three";
import {
  Stage,
  SceneManager,
  Scene,
  Container,
  configureR3Theme,
  createR3Button,
  createR3Panel,
  createR3TextInput,
  makeScreen,
  installR3Inspector,
  openR3Dialog,
  R3ScrollablePanel,
  type R3ButtonHandle,
} from "@trkbt10/r3";
import { defaultTextureManager } from "@trkbt10/r3/texture-canvas";
import { flexBox, leaf, LayoutRuntime, LayoutKeyRegistry, bindPosition } from "@trkbt10/r3/layout-engine";
import { installSpotlightOverlay } from "@trkbt10/r3/spotlight";

const SCREEN_WIDTH = 1280;
const SCREEN_HEIGHT = 720;

/** URL states this fixture renders. See this file's header for what each looks like. */
type FixtureState = "showcase" | "empty" | "dialog" | "spotlight";

function resolveState(): FixtureState {
  const raw = new URLSearchParams(window.location.search).get("state");
  if (raw === "empty" || raw === "dialog" || raw === "spotlight") {
    return raw;
  }
  return "showcase";
}

/** Mounts a canvas filling `#app` and returns it. */
function mountCanvas(): HTMLCanvasElement {
  const host = document.querySelector<HTMLDivElement>("#app");
  if (!host) {
    throw new Error("fixture: #app host element is missing from index.html");
  }
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  host.append(canvas);
  return canvas;
}

/**
 * Minimal mouse-only forwarder from the DOM canvas to `stage.pointer`.
 * The library's own richer bridge (touch, pinch, wheel) is an
 * internal module not published on the package's public surface;
 * this fixture only needs single-pointer mouse click/drag, so it
 * maps just that subset directly against `stage.screen` rather than
 * depending on that internal module.
 */
function attachMousePointerForwarding(canvas: HTMLCanvasElement, stage: Stage): void {
  function toLogical(event: MouseEvent): { readonly x: number; readonly y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * stage.screen.width,
      y: ((event.clientY - rect.top) / rect.height) * stage.screen.height,
    };
  }
  canvas.addEventListener("mousemove", (event) => {
    const p = toLogical(event);
    stage.pointer.feedMove(p.x, p.y);
  });
  canvas.addEventListener("mousedown", (event) => {
    const p = toLogical(event);
    stage.pointer.feedDown(p.x, p.y, event.button);
  });
  canvas.addEventListener("mouseup", (event) => {
    const p = toLogical(event);
    stage.pointer.feedUp(p.x, p.y, event.button);
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      const p = toLogical(event);
      stage.pointer.feedWheel(p.x, p.y, event.deltaY);
      event.preventDefault();
    },
    { passive: false },
  );
}

/**
 * Builds the showcase content (heading, button, panel, text input,
 * scrollable panel) under `parent`, laid out via the layout-engine
 * subpath. Returns the button handle so callers (the `dialog` /
 * `spotlight` states) can anchor further UI against it.
 */
function buildShowcaseContent(stage: Stage, parent: Container): { readonly button: R3ButtonHandle } {
  const clickState = { count: 0 };
  const button = createR3Button({
    x: 0,
    y: 0,
    width: 220,
    height: 56,
    label: `Clicked: ${String(clickState.count)}`,
    variant: "primary",
    textureManager: defaultTextureManager,
    tweens: stage.tweens,
    onClick: () => {
      clickState.count += 1;
      button.setLabel(`Clicked: ${String(clickState.count)}`);
    },
  });
  parent.add(button.node);

  const panel = createR3Panel({
    x: 0,
    y: 0,
    width: 360,
    height: 220,
    radius: 12,
    fill: 0x101218,
    border: 0xb88a2c,
    borderWidth: 2,
    textureManager: defaultTextureManager,
  });
  parent.add(panel);

  const textInput = createR3TextInput({
    x: 0,
    y: 0,
    width: 320,
    height: 44,
    placeholder: "Type here…",
    textureManager: defaultTextureManager,
  });
  parent.add(textInput.node);

  const scrollPanel = new R3ScrollablePanel({
    stage,
    textureManager: defaultTextureManager,
    x: 0,
    y: 0,
    width: 320,
    height: 200,
    contentHeight: 640,
    axis: "y",
  });
  parent.add(scrollPanel.container);
  for (let index = 0; index < 8; index += 1) {
    const row = createR3Panel({
      x: 0,
      y: index * 72,
      width: 296,
      height: 60,
      radius: 8,
      fill: 0x171a22,
      border: 0x3d4350,
      borderWidth: 1,
      textureManager: defaultTextureManager,
    });
    scrollPanel.content.add(row);
  }

  const root = flexBox({
    key: "root",
    direction: "column",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    padding: 32,
    gap: 24,
    children: [
      flexBox({
        key: "top-row",
        direction: "row",
        gap: 24,
        height: 220,
        children: [
          leaf({ key: "button", width: 220, height: 56, onRect: bindPosition(button.node) }),
          leaf({ key: "panel", width: 360, height: 220, onRect: bindPosition(panel) }),
        ],
      }),
      flexBox({
        key: "bottom-row",
        direction: "row",
        gap: 24,
        children: [
          leaf({ key: "text-input", width: 320, height: 44, onRect: bindPosition(textInput.node) }),
          leaf({ key: "scroll-panel", width: 320, height: 200, onRect: bindPosition(scrollPanel.container) }),
        ],
      }),
    ],
  });

  const runtime = new LayoutRuntime({
    root,
    viewport: { x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
    defaultTransition: { durationMs: 0, easing: "Linear" },
  });
  runtime.relayout();

  return { button };
}

class ShowcaseScene extends Scene {
  protected override onEnter(): void {
    buildShowcaseContent(this.stage, this.root);
  }
}

class EmptyScene extends Scene {
  protected override onEnter(): void {
    // Deliberately empty — the zero state has no content under this.root.
  }
}

class DialogScene extends Scene {
  protected override onEnter(): void {
    buildShowcaseContent(this.stage, this.root);
    openR3Dialog({
      stage: this.stage,
      textureManager: defaultTextureManager,
      size: { width: 440, height: 260 },
      build: (ctx) => {
        const heading = createR3Panel({
          x: 24,
          y: 24,
          width: ctx.width - 48,
          height: ctx.height - 48,
          radius: 8,
          fill: 0x1c1e24,
          border: 0xb88a2c,
          borderWidth: 1,
          textureManager: ctx.textureManager,
        });
        ctx.content.add(heading);
      },
    });
  }
}

class SpotlightScene extends Scene {
  protected override onEnter(): void {
    const { button } = buildShowcaseContent(this.stage, this.root);
    const registry = new LayoutKeyRegistry();
    const worldPos = button.node.getWorldPosition();
    registry.setManualTarget("spotlight-target", {
      x: worldPos.x - 110,
      y: worldPos.y - 28,
      width: 220,
      height: 56,
    });
    installSpotlightOverlay({
      stage: this.stage,
      registry,
      target: { targetKey: "spotlight-target", preferredSide: "bottom" },
      textureManager: defaultTextureManager,
    });
  }
}

/**
 * Narrow view of `window` carrying the fixture-state marker `main()`
 * sets, so external automation can read
 * `window.__R3_FIXTURE_STATE__` to confirm the `?state=` query
 * parameter actually took effect. Same pattern the library's own
 * `src/inspect.ts` uses for `window.__R3__` (`window as Window &
 * {...}` — an intersection with the real `Window` type, not `as
 * any`/`as unknown`, so it stays outside this repo's ESLint ban on
 * those two).
 */
function fixtureWindow(): Window & { __R3_FIXTURE_STATE__?: FixtureState } {
  return window as Window & { __R3_FIXTURE_STATE__?: FixtureState };
}

function main(): void {
  configureR3Theme({});

  const canvas = mountCanvas();
  // The renderer's drawing-buffer size stays fixed at the Stage's
  // logical screen size — the orthographic camera is built for
  // exactly SCREEN_WIDTH x SCREEN_HEIGHT (see Stage's constructor).
  // The canvas element's CSS size (set in mountCanvas: 100% x 100%)
  // is what actually fills the viewport; the browser scales the
  // fixed-resolution drawing buffer to fit, the same way a game
  // renders at a fixed internal resolution and scales to the window.
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT, false);

  const stage = new Stage({
    screen: makeScreen({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }),
    renderer,
    textureManager: defaultTextureManager,
  });

  attachMousePointerForwarding(canvas, stage);

  const scenes = new SceneManager(stage);
  scenes.register({ key: "showcase", factory: (s, k) => new ShowcaseScene(s, k) });
  scenes.register({ key: "empty", factory: (s, k) => new EmptyScene(s, k) });
  scenes.register({ key: "dialog", factory: (s, k) => new DialogScene(s, k) });
  scenes.register({ key: "spotlight", factory: (s, k) => new SpotlightScene(s, k) });

  // Unconditional per this fixture's contract (see file header): any
  // state needs to be inspectable/driveable by external automation.
  installR3Inspector({ stage, scenes });

  const state = resolveState();
  fixtureWindow().__R3_FIXTURE_STATE__ = state;
  scenes.start(state);

  const clock = { last: performance.now() };
  function frame(now: number): void {
    const dtMs = Math.min(100, now - clock.last);
    clock.last = now;
    stage.tick(dtMs);
    scenes.update(dtMs);
    stage.render(renderer);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
