/**
 * @file Consumer-side smoke test for the built @trkbt10/r3 package.
 *
 * This is not a unit test and does not run under Vitest. It is a
 * plain Node script that imports the package the way an external
 * consumer would: through the compiled `dist/` output, resolved via
 * the exact subpaths declared in `package.json`'s `exports` map
 * (`.`, `./layout-engine`, `./layout-engine/editor`,
 * `./widgets/panel-effects`, `./spotlight`, `./texture-canvas`).
 * `src/` is never imported here — a bug that only manifests in the
 * bundled/typed dist/ output (a barrel forgetting to re-export a
 * symbol, a subpath losing a type, …) is exactly what this script
 * exists to catch, and importing `src/` directly would hide it.
 *
 * `make build` runs `vite build` and then this script back-to-back:
 * a library build is not considered proven until something outside
 * the library has actually imported and exercised the built output.
 *
 * ## Why a DOM shim, and why it is not a mock
 *
 * Plain Node has neither `window`/`document` nor a working
 * `OffscreenCanvas` 2D backing store. Two library seams read those
 * globals directly:
 *
 *   - `src/widgets/Dialog.ts` schedules its close animation via
 *     `window.setTimeout`/`window.clearTimeout`.
 *   - `src/widgets/TextInput.ts` owns a hidden native `<input>` via
 *     `document.createElement`/`document.body.append` (IME-correct
 *     text entry is the entire point of that widget — see its file
 *     header) and reads `document.activeElement`.
 *
 * Rather than fake or stub those two APIs (forbidden — this
 * repository bans mock-style test doubles; see
 * eslint/rules/rules-no-mocks.js), this script installs `happy-dom`'s
 * real `Window` implementation as the global `window`/`document`
 * before importing the built package, exactly the way this
 * repository's own Vitest specs opt into a DOM via the
 * `@vitest-environment happy-dom` pragma (see src/Image.spec.ts and
 * others) — just wired by hand here since this script is not run by
 * Vitest. `happy-dom` is already a `devDependency` of this package
 * (see package.json), so this adds no new dependency.
 *
 * One thing happy-dom's DOM shim does NOT provide is a working
 * Canvas 2D rendering backend: `canvas.getContext("2d")` returns
 * `null` under happy-dom (verified empirically — see below), the
 * same as it would in plain Node with no `document` at all. This
 * turns out not to matter for this script's purpose: every r3 paint
 * path that acquires a 2D context already handles a `null` context
 * as a defined, production no-op —
 *
 *   src/Rect.ts:
 *     `const ctx = this.textureManager.acquireCanvas2DContext(canvas);
 *      if (!ctx) { return { cssWidth: cssW, cssHeight: cssH }; }`
 *
 *   src/text-raster.ts:
 *     `const ctx = textureManager.acquireCanvas2DContext(canvas);
 *      if (!ctx) { const fallback = layoutTextRaster(spec, null, textureManager); ... }`
 *
 * — so widget construction, layout, hit-testing, tweening, and scene
 * lifecycle all run through their real, unmodified code paths; only
 * the final rasterised-pixel output is skipped, which no check below
 * inspects. This script therefore uses the package's real, exported
 * `defaultTextureManager` (from the `texture-canvas` subpath) rather
 * than a hand-rolled fake TextureManager.
 *
 * ## What is deliberately NOT exercised here
 *
 * `R3ScrollablePanel`'s constructor and `openR3Dialog` both work
 * headlessly (proven below), but this script does not drive a
 * rendered frame through a real `WebGLRenderer` — there is no GPU in
 * this environment. Actual pixel-level visual verification (does the
 * button look right, does the dialog backdrop dim correctly, …) is
 * the fixture/ demo app's job: it runs in a real browser via Vite,
 * imports the same dist/ output, and is meant for screenshot-based
 * review (see fixture/README usage in the package README's
 * "Development" section).
 */

import { strict as assert } from "node:assert";

/**
 * Installs happy-dom's Window/Document implementation as the global
 * `window`/`document`/`OffscreenCanvas` as a side effect, before any
 * `@trkbt10/r3` module is imported below. ESM evaluates every
 * statically-imported module (in source order, depth-first) before
 * running any of *this* module's own top-level code, so importing the
 * installer module first — rather than calling an install function
 * inline in this file, after the `@trkbt10/r3` imports in source
 * order — would not be early enough: the `@trkbt10/r3` imports below
 * are themselves static imports, and ESM resolves/evaluates all of a
 * module's static imports before that module's own body runs. Putting
 * the installer in its own module and importing it first guarantees
 * ordering without resorting to a dynamic `import()` (banned by this
 * repo's ESLint config — see eslint/rules/rules-restricted-syntax.js).
 */
import "./verify-consumer-dom.ts";

import {
  Container,
  createR3Button,
  Node as R3Node,
  R3ScrollablePanel,
  Scene,
  SceneManager,
  Stage,
  TweenManager,
  configureR3Theme,
  COLOR,
  COLOR_HEX,
  makeScreen,
  wrapText,
} from "../dist/index.js";
import { defaultTextureManager } from "../dist/texture-canvas/index.js";
import { arrangeOneShot, flexBox, leaf } from "../dist/layout-engine/index.js";
import { LayoutEditor } from "../dist/layout-engine/editor/index.js";
import { dropShadow } from "../dist/widgets/panel-effects/index.js";
import { installSpotlightOverlay } from "../dist/spotlight/index.js";

/** One check's outcome, printed as a single PASS/FAIL line. */
type CheckResult = { readonly name: string; readonly ok: boolean; readonly detail?: string };

const results: CheckResult[] = [];

/**
 * Runs `fn`, records PASS on a normal return and FAIL on any thrown
 * error (including a failed `assert`). Never throws itself, so every
 * check in `main()` runs even if an earlier one fails — the report at
 * the end shows the full picture, not just the first failure.
 */
function check(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, detail });
  }
}

/** Root barrel: every exports-map entry point resolves and the primary symbols are the right kind of value. */
function checkRootAndSubpathSymbols(): void {
  assert.equal(typeof Stage, "function", "Stage should be a class (function)");
  assert.equal(typeof Scene, "function", "Scene should be a class (function)");
  assert.equal(typeof SceneManager, "function", "SceneManager should be a class (function)");
  assert.equal(typeof Container, "function", "Container should be a class (function)");
  assert.equal(typeof R3Node, "function", "Node should be a class (function)");
  assert.equal(typeof TweenManager, "function", "TweenManager should be a class (function)");
  assert.equal(typeof createR3Button, "function", "createR3Button should be a function");
  assert.equal(typeof makeScreen, "function", "makeScreen should be a function");
  assert.equal(typeof wrapText, "function", "wrapText should be a function");
  assert.equal(typeof configureR3Theme, "function", "configureR3Theme should be a function");
  assert.equal(typeof COLOR, "object", "COLOR should be an object of tokens");
  assert.equal(typeof defaultTextureManager, "object", "texture-canvas: defaultTextureManager should resolve");
  assert.equal(typeof defaultTextureManager.createCanvas, "function", "TextureManager.createCanvas");
  assert.equal(typeof flexBox, "function", "layout-engine: flexBox should be a function");
  assert.equal(typeof leaf, "function", "layout-engine: leaf should be a function");
  assert.equal(typeof arrangeOneShot, "function", "layout-engine: arrangeOneShot should be a function");
  assert.equal(typeof LayoutEditor, "function", "layout-engine/editor: LayoutEditor should be a class (function)");
  assert.equal(typeof dropShadow, "function", "widgets/panel-effects: dropShadow should be a function");
  assert.equal(typeof installSpotlightOverlay, "function", "spotlight: installSpotlightOverlay should be a function");
}

/** Builds a Stage headlessly using the package's real defaultTextureManager. */
function buildStage(): Stage {
  return new Stage({
    screen: makeScreen({ width: 1280, height: 720 }),
    textureManager: defaultTextureManager,
  });
}

/** Stage + a button attached to root; clicking its world-space centre fires onClick exactly once. */
function checkStageAndButtonClick(): void {
  const stage = buildStage();
  const clicks: number[] = [];
  const button = createR3Button({
    x: 200,
    y: 150,
    width: 220,
    height: 64,
    label: "Verify",
    onClick: () => clicks.push(1),
    textureManager: defaultTextureManager,
    tweens: stage.tweens,
  });
  stage.add(button.node);
  // One compose pass so worldVisible / worldAlpha / matrixWorld are
  // fresh before hit-testing, matching a real frame loop's first tick.
  stage.tick(0);

  stage.pointer.feedMove(200, 150);
  stage.pointer.feedDown(200, 150, 0);
  stage.pointer.feedUp(200, 150, 0);
  assert.equal(clicks.length, 1, "clicking the button's centre should fire onClick exactly once");

  stage.pointer.feedMove(1000, 700);
  stage.pointer.feedDown(1000, 700, 0);
  stage.pointer.feedUp(1000, 700, 0);
  assert.equal(clicks.length, 1, "clicking outside the button's hit rect must not fire onClick");
}

/** SceneManager registers a scene, starts it, and onSceneEnter fires before the scene's own enter body runs. */
function checkSceneManagerOnSceneEnter(): void {
  const stage = buildStage();
  const order: string[] = [];
  const scenes = new SceneManager(stage);

  class SmokeScene extends Scene {
    protected override onEnter(): void {
      order.push("scene:enter");
    }
  }

  const unsubscribe = scenes.onSceneEnter((key) => {
    order.push(`hook:${key}`);
  });

  scenes.register({ key: "smoke", factory: (s, k) => new SmokeScene(s, k) });
  const started = scenes.start("smoke");

  assert.equal(started.active, true, "scene should be active after start()");
  assert.deepEqual(order, ["hook:smoke", "scene:enter"], "onSceneEnter must fire before the scene's own onEnter body");
  unsubscribe();
}

/** TweenManager advances a plain numeric target property toward its destination over successive ticks. */
function checkTweenAdvances(): void {
  const tweens = new TweenManager();
  const target: { value: number } = { value: 0 };
  tweens.add({ targets: target, duration: 200, ease: "Linear", value: 100 });

  tweens.advance(0);
  const atStart = target.value;
  tweens.advance(100);
  const atHalf = target.value;
  tweens.advance(100);
  const atEnd = target.value;

  assert.equal(atStart, 0, "tween should start at its recorded start value (0) before any elapsed time");
  assert.ok(atHalf > atStart, "value should have advanced toward the destination after 100ms of a 200ms tween");
  assert.ok(atHalf < 100, "value should not yet have reached the destination halfway through the tween");
  assert.equal(atEnd, 100, "value should reach the destination once the full duration has elapsed");
}

/** layout-engine: flexBox + leaf build a tree; arrangeOneShot reports the exact rects the flex algorithm computes. */
function checkLayoutEngineArrangeOneShot(): void {
  const calls: string[] = [];
  const child = leaf({
    key: "child",
    width: 40,
    height: 20,
    onRect: (rect) => calls.push(`child:${rect.x},${rect.y},${rect.width},${rect.height}`),
  });
  const root = flexBox({
    key: "root",
    width: 120,
    height: 80,
    children: [child],
    onRect: (rect) => calls.push(`root:${rect.width}x${rect.height}`),
  });

  arrangeOneShot(root, { x: 10, y: 20, width: 120, height: 80 });

  assert.deepEqual(
    calls,
    ["root:120x80", "child:10,20,40,20"],
    "arrangeOneShot should place the leaf at the root's origin (no padding/gap authored) with its authored size",
  );
}

/** ScrollModel: scrollBy sets a lerped target; repeated update() ticks converge scrollY on the clamped target. */
function checkScrollModelStepping(): void {
  const stage = buildStage();
  const panel = new R3ScrollablePanel({
    stage,
    textureManager: defaultTextureManager,
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    contentHeight: 800,
    axis: "y",
  });

  assert.equal(panel.model.scrollable, true, "content (800) taller than viewport (200) should be scrollable");
  assert.equal(panel.model.getScrollY(), 0, "scroll should start at 0");

  panel.model.scrollBy(120);
  // The model lerps 30%/tick toward the target (see ScrollModel.ts
  // SCROLL_LERP_FACTOR) and snaps once within a small threshold, so a
  // bounded number of ticks is needed to converge — not a single call.
  Array.from({ length: 60 }, () => panel.model.update());

  assert.equal(panel.model.getScrollY(), 120, "scrollY should converge to the requested target after enough ticks");

  panel.model.scrollBy(10_000);
  Array.from({ length: 60 }, () => panel.model.update());
  assert.equal(
    panel.model.getScrollY(),
    panel.model.maxScrollY,
    "scrolling far past the content should clamp to maxScrollY, not overshoot",
  );
}

/** configureR3Theme overrides a color token in place; every existing reference to COLOR observes the new value. */
function checkThemeOverrideReflectsInColorReferences(): void {
  const before = COLOR.GOLD;
  const beforeHex = COLOR_HEX.GOLD;
  try {
    configureR3Theme({ colors: { GOLD: "#123456" } });
    assert.equal(COLOR.GOLD, "#123456", "COLOR.GOLD should reflect the override — COLOR is a live, patched object");
    assert.equal(
      COLOR_HEX.GOLD,
      0x123456,
      "COLOR_HEX.GOLD should be recomputed from the same override (numeric mirror of COLOR)",
    );
    assert.notEqual(COLOR.GOLD, before, "override should actually have changed the token, not been a no-op");
  } finally {
    // Restore process-wide mutable state so this check does not leak
    // into checks that run after it in the same process (COLOR is a
    // module-level singleton — see src/theme/palette.ts).
    configureR3Theme({ colors: { GOLD: before } });
    assert.equal(COLOR_HEX.GOLD, beforeHex, "restoring the token should restore its numeric mirror too");
  }
}

/** wrapText's 行頭禁則 (line-start prohibition) never places a prohibited character at the start of a wrapped line. */
function checkWrapTextKinsoku(): void {
  // "、" (U+3001 ideographic comma) may not start a line. Every
  // character is 1 unit wide under this measure function, so wrapping
  // at maxWidth=3 forces a break right before the comma unless the
  // 行頭禁則 pass pushes it back onto the previous line instead.
  const text = "あいう、えお";
  const lines = wrapText(text, { maxWidth: 3, measure: (s) => s.length });

  assert.ok(lines.length > 1, "text longer than maxWidth should wrap into multiple lines");
  for (const line of lines) {
    if (line.text.length === 0) {
      continue;
    }
    const firstChar = line.text.charAt(0);
    assert.notEqual(firstChar, "、", `line "${line.text}" must not start with the prohibited character '、'`);
  }
  const rejoined = lines.map((l) => l.text).join("");
  assert.equal(rejoined, text, "wrapping must not drop or reorder characters");
}

function main(): void {
  check("root + subpath exports resolve to the expected symbol kinds", checkRootAndSubpathSymbols);
  check("Stage + createR3Button: clicking the button's world rect fires onClick", checkStageAndButtonClick);
  check("SceneManager: onSceneEnter fires on start(), before the scene's own enter", checkSceneManagerOnSceneEnter);
  check("TweenManager: advance() moves a numeric target toward its destination over time", checkTweenAdvances);
  check("layout-engine: flexBox/leaf + arrangeOneShot report the expected rects", checkLayoutEngineArrangeOneShot);
  check("ScrollModel: scrollBy + update() converge and clamp to maxScrollY", checkScrollModelStepping);
  check(
    "configureR3Theme: color override is reflected through COLOR/COLOR_HEX",
    checkThemeOverrideReflectsInColorReferences,
  );
  check("wrapText: 行頭禁則 characters never start a wrapped line", checkWrapTextKinsoku);

  for (const result of results) {
    const status = result.ok ? "PASS" : "FAIL";
    const suffix = result.detail ? ` — ${result.detail}` : "";
    console.log(`[${status}] ${result.name}${suffix}`);
  }

  const failureCount = results.filter((r) => !r.ok).length;
  console.log(`\n${String(results.length - failureCount)}/${String(results.length)} checks passed.`);
  if (failureCount > 0) {
    process.exitCode = 1;
  }
}

main();
