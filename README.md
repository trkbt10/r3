# @trkbt10/r3

A retained-mode, Phaser-style display-list UI framework built on top
of [`three`](https://www.npmjs.com/package/three). It gives a
[`three.js`](https://threejs.org/) scene an orthographic-camera
display list — nodes, containers, transforms, depth ordering,
pointer/drag input, tweening, canvas-backed text/graphics
rendering — with an API shaped like Phaser's `GameObject` /
`Container` model, so it reads familiarly to anyone who has built UI
on top of a 2D game engine, while the actual rendering goes through
`three`'s `WebGLRenderer`.

r3 does not assume a game engine underneath it. It composes directly
against a `three.js` `WebGLRenderer`, so it works equally well as the
UI layer for a game, a data-visualisation tool, or any other
`three.js` application that wants a retained scene-graph UI on top of
its 3D content.

## Install

```bash
npm install @trkbt10/r3 three
```

The package is not yet published to the npm registry — until it is, install
the prebuilt `release` branch directly from GitHub (kept in sync with `main`
by CI, with `dist/` included and no lifecycle scripts, so it installs under
package managers that skip a git dependency's devDependencies, such as bun):

```bash
bun add "git+https://github.com/trkbt10/r3.git#release" three
```

`three` is a **peer dependency** (`^0.184.0`), not a bundled
dependency — install it alongside r3 so both share the same `three`
module instance (required for `instanceof` checks on `three` classes
to work correctly across the two packages). `@trkbt10/r3` ships
ESM-only: `three` itself has shipped no usable CommonJS entry point
since 0.184, so a CommonJS build of this package would be unusable in
practice (it would `require("three")` and fail). Import it with
`import`, not `require`.

## Quickstart

```ts
import {
  Stage,
  createR3Button,
  PC_SCREEN,
} from "@trkbt10/r3";
import { defaultTextureManager } from "@trkbt10/r3/texture-canvas";
import { WebGLRenderer } from "three";

const canvas = document.querySelector("canvas")!;
const renderer = new WebGLRenderer({ canvas, alpha: true });

const stage = new Stage({
  screen: PC_SCREEN, // { width: 1280, height: 720, viewbox, orientation }
  renderer,
  textureManager: defaultTextureManager,
});

const button = createR3Button({
  x: 640,
  y: 360,
  width: 220,
  height: 64,
  label: "Start",
  onClick: () => console.log("clicked"),
  textureManager: defaultTextureManager,
});
stage.add(button.node);

const state = { last: performance.now() };
function frame(now: number): void {
  const dtMs = Math.min(100, now - state.last);
  state.last = now;
  stage.tick(dtMs); // advances tweens, then composes world transforms
  stage.render(renderer); // renderer.render(stage.scene, stage.camera)
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

`Stage` owns a `three.Scene` plus an orthographic camera sized to the
supplied `screen`, and a root `Container` every node attaches under.
The host application owns the `WebGLRenderer` and the render loop;
`stage.render(renderer)` issues the actual `renderer.render(...)`
call (and any registered `registerWorldLayer` passes), so nothing
about r3 prevents it from composing alongside other `three.js`
content the host renders in the same frame.

## Scene graph

`Node` (transform, alpha, depth, hit-testing, event listeners) and
`Container` (adds children) are the base classes every display
primitive extends: `Rect`, `FlatPanelRect`, `R3Image`, `Text`,
`Graphics`. Building a custom display object means subclassing `Node`
or `Container` — this is r3's one deliberate exception to
function-first style: a retained-mode scene graph's consumer
contract *is* subclassing, the same way Phaser's or PixiJS's is.

```ts
import { Container, Rect } from "@trkbt10/r3";
import type { TextureManager } from "@trkbt10/r3/texture-canvas";

class Badge extends Container {
  constructor(textureManager: TextureManager) {
    super({ x: 0, y: 0 });
    this.add(
      new Rect({
        x: 0,
        y: 0,
        width: 96,
        height: 32,
        fill: "#222633",
        cornerRadius: 6,
        textureManager,
      }),
    );
  }
}
```

## Scenes

`Scene` (subclass, override `enter(payload)` / `exit()` / `update(dtMs)`)
plus `SceneManager` (registers scenes by string key, starts/stops
them, forwards `update`) cover Phaser's scene-lifecycle role. The
host constructs one `SceneManager` per `Stage` and drives it from the
same frame loop that calls `stage.tick`:

```ts
import { Scene, SceneManager, type SceneData } from "@trkbt10/r3";

class TitleScene extends Scene {
  override enter(payload: SceneData): void {
    /* build widgets under this.root */
  }
  override exit(): void {
    /* destroy widgets */
  }
}

const scenes = new SceneManager(stage);
scenes.register({ key: "title", factory: (s, key) => new TitleScene(s, key) });
scenes.start("title");

// Fires once per `start()` call, before the scene's own `enter` runs —
// useful for cross-scene hooks (analytics, audio ducking) that
// shouldn't live inside every scene implementation.
const unsubscribe = scenes.onSceneEnter((key) => console.log("entered", key));

// In the frame loop, alongside stage.tick(dtMs):
scenes.update(dtMs);
```

## Layout engine

`@trkbt10/r3/layout-engine` is a small flex-layout system (direction,
justify, align, padding, gap — no percent sizing, no wrapping) that
drives widget position/size through tweened `onRect` callbacks
instead of destroying and rebuilding widgets on every relayout:

```ts
import { flexBox, leaf, LayoutRuntime, bindPosition } from "@trkbt10/r3/layout-engine";

const runtime = new LayoutRuntime({
  root: flexBox({
    direction: "row",
    width: 1280,
    height: 64,
    padding: 16,
    gap: 8,
    children: [leaf({ width: 220, height: 44, onRect: bindPosition(button.node) })],
  }),
  viewport: { x: 0, y: 0, width: 1280, height: 720 },
  defaultTransition: { durationMs: 200, easing: "Cubic.easeInOut" },
});

// In the frame loop, alongside stage.tick(dtMs):
runtime.tick(dtMs);
```

## Configuring the default theme, graphics policy, and image loading

Three small injection seams let a host application override r3's
defaults without forking widget code. Call these once at startup,
before constructing any widgets — widgets read the current value at
construction time.

```ts
import {
  configureR3Theme,
  configureR3GraphicsPolicy,
  configureR3ImageSlotProvider,
} from "@trkbt10/r3";

// Override any subset of color / font tokens widgets read as
// `COLOR.GOLD`, `FONT.MINCHO`, etc.
configureR3Theme({
  colors: { GOLD: "#ffcc00" },
  fonts: { MINCHO: "'Noto Serif JP', serif" },
});

// Pixel-density policy for canvas-backed textures (Text, Rect fills,
// Graphics). Defaults to following the display's device pixel ratio,
// clamped to [1, 2].
configureR3GraphicsPolicy({ uiTexturePixelRatio: "logical" });

// The keyed image-slot provider widgets/Panel.ts uses for its
// optional wood-grain HUD overlay. The default provider treats the
// key as a URL and loads it with a bare `Image()`; a host with a
// richer asset pipeline injects its own provider here.
configureR3ImageSlotProvider({
  ensureImage(key) {
    /* … */
  },
  onAssetReady(key, cb) {
    /* … */
  },
});
```

## Subpath exports

Sub-barrels are published as separate npm subpath exports so a
consumer that only needs one doesn't pull in the rest of the package:

| Subpath                         | Contents                                                                 |
| -------------------------------- | ------------------------------------------------------------------------ |
| `@trkbt10/r3`                    | Core display graph, widgets, scenes, theme/policy configuration.        |
| `@trkbt10/r3/layout-engine`       | The flex layout system (`flexBox`, `leaf`, `LayoutRuntime`, bindings).  |
| `@trkbt10/r3/layout-engine/editor` | Direct-manipulation layout editor overlay (`LayoutEditor`, handles).  |
| `@trkbt10/r3/widgets/panel-effects` | Pluggable panel decorations (`dropShadow`, `outerGlow`, `lightning`, …) consumed by the `Plaque` widget. |
| `@trkbt10/r3/spotlight`           | Tutorial-style spotlight/arrow overlay (`installSpotlightOverlay`).      |
| `@trkbt10/r3/texture-canvas`      | Canvas-backed GPU texture source management (`TextureManager`, `defaultTextureManager`). |

## Widgets

`Button`, `OrnateButton`, `Heading`, `Dialog`, `ScrollablePanel`,
`TabBar`, `Select`, `Plaque`, `TextInput`, `LayoutCursor`, `Panel`
(including the HUD-plaque preset) are exported from the root barrel.
They only depend on r3's core primitives and the default theme, so
they render consistently regardless of the host application's own
visual language — override tokens via `configureR3Theme` to restyle
them.

| Widget           | Factory / export                                                                 | Notes                                                                 |
| ----------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Button            | `createR3Button`                                                                  | Primary/secondary variants, optional click SFX.                      |
| OrnateButton       | `createR3OrnateButton`                                                            | Decorated button variant for title/menu-style chrome.                |
| Heading            | `createR3Heading`                                                                 | Styled section heading text.                                         |
| Dialog             | `openR3Dialog`                                                                    | Modal overlay with backdrop, sized content area, close animation.    |
| ScrollablePanel    | `R3ScrollablePanel` (class), backed by `ScrollModel`                             | Drag/wheel-scrollable clipped viewport.                               |
| TabBar             | `createR3TabBar`                                                                  | Folder-tab-style horizontal tab strip.                                |
| Select             | `createR3Select`                                                                  | Compact single-choice dropdown; popup renders above later siblings via an overlay render layer. |
| Plaque             | `createR3Plaque`, `createR3PlaqueButton`                                         | Gold-framed HUD chrome (via `createR3ResizableHudPanel`) plus a pluggable `effects` list from `@trkbt10/r3/widgets/panel-effects`; `createR3PlaqueButton` adds a `pointerdown` → `onActivate` wrapper. |
| TextInput          | `createR3TextInput`, `isR3TextInputElement`                                       | Backed by a hidden native `<input>` for IME-correct text entry.       |
| LayoutCursor       | `R3LayoutCursor` (class)                                                          | Keyboard/gamepad focus-cursor helper for layout-engine grids.         |
| Panel              | `createR3Panel`, `createR3HudPanel`, `createR3ResizableHudPanel`                  | Shared rounded-rect chrome; the HUD variants add the gold-framed double-border plaque look, resizable or fixed. |

## Pointer input

A `Stage` never listens to the DOM on its own — it exposes
`stage.pointer` (a `PointerManager`) that expects `feedDown` /
`feedMove` / `feedUp` / `feedWheel` / `feedPinch` / `feedCancel` calls
in stage-logical pixel coordinates. `attachCanvasPointerBridge` is the
root-barrel helper that does that translation for a real
`HTMLCanvasElement`: it maps the canvas's `getBoundingClientRect()`
against `stage.screen` and forwards mouse, touch (including
multi-touch pinch), and wheel events, staying correct across resizes
because every event re-reads the current mapping rather than caching
fixed width/height arguments.

```ts
import { Stage, attachCanvasPointerBridge } from "@trkbt10/r3";

const canvas = document.querySelector("canvas")!;
const stage = new Stage({ /* … */ });

const bridge = attachCanvasPointerBridge({ canvas, stage });
// Later, on teardown (route change, component unmount, hot reload):
bridge.dispose();
```

Without this call (or an equivalent hand-rolled forwarder feeding
`stage.pointer` directly), widgets render but never receive clicks —
`stage.pointer` has nothing feeding it events.

## Testing

The test suite (`bun run test` / `vitest`) uses the globals
(`describe`/`it`/`expect`) the runner injects rather than importing
them. Most specs run under Vitest's default `"node"` environment;
specs that touch canvas / `HTMLImageElement` / pointer DOM events opt
into a DOM per-file via a `@vitest-environment happy-dom` pragma
comment.

## Development

A `Makefile` at the repository root maps each delegation target onto
this package's `bun` toolchain:

| Target      | Runs                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| `install`   | `bun install`                                                            |
| `typecheck` | `tsc -p tsconfig.json --noEmit` (`src/` + `spec/` only)                  |
| `lint`      | `eslint .` (repo-wide, including `scripts/` and `fixture/`)              |
| `test`      | `vitest --run`                                                           |
| `build`     | `vite build`, then `scripts/verify-consumer.ts` against the built `dist/` output |
| `dev`       | Builds the library, then starts the `fixture/` demo's Vite dev server    |
| `fixture`   | Rebuilds the library and vite-builds `fixture/` as a static site into `DIR` |

`make build` does not stop at the bundler: it chains
`bun run verify:consumer`, a plain Node script
(`scripts/verify-consumer.ts`) that imports the built `dist/` output
through every subpath declared in this package's `exports` map and
exercises real behaviour — Stage/Scene/TweenManager/layout-engine/
ScrollModel/theme/`wrapText` — the way an external consumer would,
never importing `src/` directly.

### Fixture demo

`fixture/` is a small Vite app that imports `@trkbt10/r3` and its
subpaths through an alias table pointed at `../dist` (again, never
`src/`), so it renders exactly what a real consumer would get. Run
`make dev` to build the library and open the demo's Vite dev server,
or `make fixture DIR=<path>` to produce a static build of it at
`<path>` (defaults to `/tmp/r3-fixture`; rebuilt from scratch on
every run).

The demo picks one of four deterministic states via the `?state=`
URL query parameter:

| `?state=`   | Renders                                                                  |
| ----------- | --------------------------------------------------------------------------- |
| `showcase`  | (default) Heading-style button with a click counter, a Panel, a TextInput, a Select, a Plaque, and a ScrollablePanel, laid out via the `layout-engine` subpath, wired to pointer input via `attachCanvasPointerBridge` |
| `empty`     | A bare Stage with nothing mounted                                       |
| `dialog`    | The showcase scene plus an `openR3Dialog` modal already open            |
| `spotlight` | The showcase scene plus a `spotlight` subpath overlay anchored on the button |

`window.__R3__` (see `installR3Inspector`) is installed
unconditionally so external automation can inspect and drive the
running scene.
