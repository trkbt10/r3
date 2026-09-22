/**
 * @file texture-canvas — SSoT for canvas-backed GPU texture sources.
 *
 * Every canvas that r3 paints into and hands to Three.js'
 * `CanvasTexture` goes through this submodule. OffscreenCanvas is
 * preferred when the runtime supports it (painting stays off the
 * DOM's main-document heap and uploads to the GPU bypass element
 * boxes); we fall back to `document.createElement("canvas")` when
 * OffscreenCanvas is missing or unusable (jsdom / happy-dom stubs,
 * older Safari, etc.).
 *
 * Consumers should import from `./texture-canvas/index.ts` — the
 * module files are not part of the public surface even within r3.
 */
export { acquireTextureCanvas2DContext, configureTextureCanvasMaxTextureSize, configureTextureCanvasMaxTextureSizeFromContext, createManagedCanvasTexture, createTextureCanvas, DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE, defaultTextureManager, disposeTextureCanvasSource, isOffscreenCanvasActive, resetTextureCanvasPolicyForTests, resetTextureCanvasStrategyForTests, resolveTextureCanvasPixelSize, } from './createTextureCanvas.ts';
export type { TextureCanvas, TextureCanvas2DContext, TextureManager, } from './createTextureCanvas.ts';
