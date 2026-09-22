import { CanvasTexture } from 'three';
import { TexturePixelSize, TexturePixelSizeInput } from '../texture-sizing.ts';
/**
 * Canvas source r3 hands to `CanvasTexture`. Three.js accepts both
 * `HTMLCanvasElement` and `OffscreenCanvas` as a `TexImageSource`.
 */
export type TextureCanvas = OffscreenCanvas | HTMLCanvasElement;
/**
 * 2D rendering context union for {@link TextureCanvas}. The two
 * backing types share the entire Canvas 2D drawing surface — every
 * method r3 calls (`fillRect`, `measureText`, `setTransform`,
 * `fillText`, `arcTo`, …) exists on both. Consumers can therefore
 * type-annotate against this alias and avoid per-call narrowing.
 */
export type TextureCanvas2DContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
export type TextureManager = {
    readonly createCanvas: (width?: number, height?: number) => TextureCanvas;
    readonly createOwnedCanvasTexture: (canvas: TextureCanvas) => CanvasTexture;
    readonly createBorrowedCanvasTexture: (canvas: TextureCanvas) => CanvasTexture;
    readonly disposeCanvasSource: (canvas: TextureCanvas) => void;
    readonly acquireCanvas2DContext: (canvas: TextureCanvas) => TextureCanvas2DContext | null;
    readonly resolveTexturePixelSize: (input: TexturePixelSizeInput) => TexturePixelSize;
    readonly configureMaxTextureSize: (maxTextureSize: number) => void;
    readonly isOffscreenCanvasActive: () => boolean;
    readonly resetStrategyForTests: () => void;
    readonly resetPolicyForTests: () => void;
};
export type TextureMaxSizeSource = {
    readonly MAX_TEXTURE_SIZE: number;
    readonly getParameter: (pname: number) => unknown;
};
export declare const DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE = 2048;
export declare const defaultTextureManager: TextureManager;
/** Compatibility wrapper; production code should depend on a TextureManager. */
export declare function createTextureCanvas(width?: number, height?: number): TextureCanvas;
/** Compatibility wrapper; production code should depend on a TextureManager. */
export declare function createManagedCanvasTexture(canvas: TextureCanvas): CanvasTexture;
/** Compatibility wrapper; production code should depend on a TextureManager. */
export declare function disposeTextureCanvasSource(canvas: TextureCanvas): void;
/** Compatibility wrapper; production code should depend on a TextureManager. */
export declare function acquireTextureCanvas2DContext(canvas: TextureCanvas): TextureCanvas2DContext | null;
/** Compatibility wrapper; production code should depend on a TextureManager. */
export declare function resolveTextureCanvasPixelSize(input: TexturePixelSizeInput): TexturePixelSize;
/** Compatibility wrapper; composition roots should call this from renderer capabilities. */
export declare function configureTextureCanvasMaxTextureSize(maxTextureSize: number): void;
/** Reads `MAX_TEXTURE_SIZE` from a WebGL-like context and applies the texture policy cap. */
export declare function configureTextureCanvasMaxTextureSizeFromContext(source: TextureMaxSizeSource): void;
/** Compatibility wrapper; production code should depend on a TextureManager. */
export declare function isOffscreenCanvasActive(): boolean;
/** Compatibility wrapper; production code should depend on a TextureManager. */
export declare function resetTextureCanvasStrategyForTests(): void;
/** Compatibility wrapper for tests that need the default sizing policy. */
export declare function resetTextureCanvasPolicyForTests(): void;
