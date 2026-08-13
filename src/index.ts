/**
 * @file r3 — a retained-mode, Phaser-style display-list UI framework
 * built on top of `three`.
 *
 * The framework is intentionally narrow:
 *
 *  - {@link Stage} owns a `Three.Scene` + orthographic camera and a
 *    root {@link Container}. Host applications render the stage's
 *    scene over (or instead of) any other Three.js content.
 *  - {@link Node} / {@link Container} are the display-graph base
 *    classes; transform / alpha / depth / interactivity work the
 *    same as Phaser's Container.
 *  - {@link Rect}, {@link FlatPanelRect}, {@link R3Image},
 *    {@link Text}, {@link Graphics} are the renderable primitives.
 *    Rect owns transparent / stretchable-solid raster policy;
 *    FlatPanelRect is the SoT for large square-corner fill+stroke
 *    panels that should not bake viewport-sized canvases.
 *  - {@link TweenManager}, {@link PointerManager}, {@link DragManager}
 *    cover the dynamic-behaviour surface Phaser provided.
 *  - {@link Screen} describes the logical drawing surface a Stage
 *    composes against; {@link ScrollModel} backs
 *    {@link R3ScrollablePanel}'s drag/wheel input.
 *
 * Widgets that live here are **generic** — Button, Dialog,
 * ScrollablePanel, TabBar, LayoutCursor, Panel. Application-specific
 * surfaces (game HUD, prep pages, world view) are expected to live
 * in the consuming application and compose these primitives.
 *
 * Sub-barrels not re-exported here — `layout-engine/index.ts`,
 * `layout-engine/editor/index.ts`, `widgets/panel-effects/index.ts`,
 * `spotlight/index.ts` (re-exported below), `texture-canvas/index.ts`
 * (types re-exported below) — are published as npm subpath exports;
 * import them directly (e.g. `@trkbt10/r3/layout-engine`) when needed.
 *
 * Migration policy: prefer `import { Foo } from "@trkbt10/r3"` over
 * deep file imports so the package surface stays stable as
 * implementations move between files.
 */

// Screen domain — the logical drawing surface a Stage composes against.
export { makeScreen, withViewbox, PC_SCREEN } from "./screen";
export type { Screen, Rect as ScreenRect, Orientation } from "./screen";

// Core display graph
export { Stage } from "./Stage.ts";
export type { StageOptions, PointerSnapshot } from "./Stage.ts";
export { Node, DEPTH_SCALE } from "./Node.ts";
export type {
  NodeOptions,
  NodeListener,
  NodeEventName,
  PointerEvent,
  Pivot,
  Rect as NodeHitRect,
} from "./Node.ts";
export { Container } from "./Container.ts";
export type { ContainerOptions } from "./Container.ts";
export {
  R3LayoutRoot,
  R3MotionRoot,
  createR3CenteredMotionSurface,
  createR3LayoutRoot,
  createR3MotionRoot,
  createR3MotionSurface,
  playR3MotionPressPulse,
  playR3MotionRejectShake,
  resetR3MotionRoot,
  tweenR3MotionScale,
} from "./LayoutMotion.ts";
export type {
  R3CenteredMotionSurface,
  R3CenteredMotionSurfaceOptions,
  R3MotionSurface,
  R3MotionPressPulseOptions,
  R3MotionRejectShakeOptions,
  R3MotionScaleTweenOptions,
} from "./LayoutMotion.ts";
export { Rect } from "./Rect.ts";
export type { RectOptions, RectStyle } from "./Rect.ts";
export { FlatPanelRect } from "./FlatPanelRect.ts";
export type { FlatPanelRectOptions, FlatPanelRectStyle } from "./FlatPanelRect.ts";
export { R3Image } from "./Image.ts";
export type { ImageOptions, ImageSource } from "./Image.ts";
export { Text } from "./Text.ts";
export type { TextOptions } from "./Text.ts";
export type { TextAlign } from "./text-raster.ts";
export { Graphics } from "./Graphics.ts";
export type { GraphicsOptions } from "./Graphics.ts";

// Dynamic behaviour
export { TweenManager } from "./Tween.ts";
export type {
  TweenConfig,
  TweenHandle,
  TweenTarget,
  TweenProps,
  TweenPropConfig,
} from "./Tween.ts";
export { PointerManager } from "./Pointer.ts";
export { DragManager } from "./Drag.ts";
export type { DragOptions, DragHandlers } from "./Drag.ts";

// Scene lifecycle
export { Scene } from "./Scene.ts";
export type { SceneData } from "./Scene.ts";
export { SceneManager } from "./SceneManager.ts";
export type { SceneFactory, SceneRegistration, StartOptions } from "./SceneManager.ts";
export { r3FadeToScene, r3FadeIn } from "./SceneTransition.ts";
export type { R3FadeToSceneOptions } from "./SceneTransition.ts";

// Audio bridge
export { bindR3SfxPlayer, playR3Sfx } from "./audio.ts";
export type { R3SfxPlayer } from "./audio.ts";

// Raster-texture cache (used by any widget that paints into a canvas)
export {
  acquireRaster,
  releaseRaster,
  trimCachedTextures,
  rasterCacheStats,
} from "./TextureCache.ts";
export type { RasterEntry, RasterMetrics, RasterPaint } from "./TextureCache.ts";

export type { TextureCanvas, TextureCanvas2DContext } from "./texture-canvas";

// Easing + font primitives
export { resolveEasing, Linear } from "./Easing.ts";
export type { EasingName, EasingFn } from "./Easing.ts";
export {
  wrapText,
  buildFontShorthand,
  snapshotMetrics,
} from "./text-metrics.ts";
export type {
  WrapOptions,
  WrappedLine,
  MeasureFn,
  FontStyleSpec,
  CanvasMetricSnapshot,
} from "./text-metrics.ts";

// Generic widgets — reusable UI primitives that only depend on r3
// core + the shared theme. App-specific widgets (game HUD, prep
// pages, overlays) live under src/scenes/ and do NOT ship through
// this barrel.
export { createR3Button } from "./widgets/Button.ts";
export type {
  R3ButtonOptions,
  R3ButtonHandle,
  R3ButtonVariant,
  R3ButtonClickSfx,
} from "./widgets/Button.ts";
export { createR3OrnateButton } from "./widgets/OrnateButton.ts";
export type {
  R3OrnateButtonOptions,
  R3OrnateButtonHandle,
  R3OrnateButtonVariant,
  R3OrnateButtonClickSfx,
} from "./widgets/OrnateButton.ts";
export { createR3Heading } from "./widgets/Heading.ts";
export type {
  R3HeadingOptions,
  R3HeadingHandle,
  R3HeadingStroke,
} from "./widgets/Heading.ts";
export { openR3Dialog } from "./widgets/Dialog.ts";
export type {
  R3DialogOptions,
  R3DialogHandle,
  R3DialogSize,
  R3DialogVisual,
  R3DialogTiming,
  R3DialogBuildContext,
} from "./widgets/Dialog.ts";
export { R3ScrollablePanel } from "./widgets/ScrollablePanel.ts";
export type { R3ScrollablePanelConfig } from "./widgets/ScrollablePanel.ts";
export { ScrollModel, classifyAxisGesture } from "./scroll/ScrollModel.ts";
export type {
  ScrollAxis,
  AxisGestureIntent,
  ScrollModelConfig,
} from "./scroll/ScrollModel.ts";
export { createR3TabBar } from "./widgets/TabBar.ts";
export type { R3TabBarOptions, R3TabBarHandle, R3TabSpec } from "./widgets/TabBar.ts";
export { R3LayoutCursor } from "./widgets/LayoutCursor.ts";
export type { R3LayoutCursorConfig } from "./widgets/LayoutCursor.ts";
export { createR3Panel, createR3HudPanel } from "./widgets/Panel.ts";
export type {
  R3PanelOptions,
  R3HudPanelGeometry,
} from "./widgets/Panel.ts";
export { createR3TextInput, isR3TextInputElement } from "./widgets/TextInput.ts";
export type { R3TextInputOptions, R3TextInputHandle } from "./widgets/TextInput.ts";

export {
  SPOTLIGHT_OVERLAY_DEPTH,
  createSpotlightArrowRenderer,
  computeSpotlightOverlayLayout,
  installSpotlightOverlay,
} from "./spotlight";
export type {
  SpotlightAdornmentRenderContext,
  SpotlightAdornmentRenderer,
  SpotlightAnchorSide,
  SpotlightOverlayHandle,
  SpotlightOverlayLayout,
  SpotlightOverlayOptions,
  SpotlightTarget,
} from "./spotlight";

// External-automation contract — see ./inspect.ts for the rationale.
export {
  installR3Inspector,
  uninstallR3Inspector,
  R3_INSPECTOR_VERSION,
} from "./inspect.ts";
export type {
  R3Inspector,
  InspectedNode,
  NodeQuery,
  InstallR3InspectorOptions,
} from "./inspect.ts";

// Default theme — color / font tokens widgets read, overridable in place.
export { COLOR, COLOR_HEX, FONT, configureR3Theme } from "./theme";
export type {
  ColorToken,
  ColorValue,
  FontStack,
  R3ThemeOverrides,
} from "./theme";

// Graphics policy — pixel-density policy for canvas-backed textures.
export {
  configureR3GraphicsPolicy,
  getGraphicsPolicy,
} from "./graphics-policy";
export type {
  GraphicsPolicy,
  UiTexturePixelRatioMode,
} from "./graphics-policy";

// Image loading — keyed image-slot provider consumed by widgets/Panel.ts.
export {
  configureR3ImageSlotProvider,
  createUrlImageSlotProvider,
} from "./image-loading";
export type { ImageSlot, ImageSlotProvider } from "./image-loading";
