import { RasterDebugInfo, MutableRasterSurface } from './TextureCache.ts';
import { TextureCanvas, TextureCanvas2DContext, TextureManager } from './texture-canvas';
import { TextureCanvasScale, TexturePixelRounding } from './texture-sizing.ts';
export type CanvasTextureSurfaceOptions = {
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly pixelRatio: number;
    readonly rounding?: TexturePixelRounding;
    readonly maxTextureSize?: number;
    readonly textureManager: TextureManager;
    readonly debugInfo?: RasterDebugInfo;
};
export type CanvasTextureSurface = MutableRasterSurface & {
    readonly canvas: TextureCanvas;
    readonly ctx: TextureCanvas2DContext | null;
    readonly pixelWidth: number;
    readonly pixelHeight: number;
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly scale: TextureCanvasScale;
};
/** Allocates a fresh canvas, 2D context and configured CanvasTexture. */
export declare function createCanvasTextureSurface(options: CanvasTextureSurfaceOptions): CanvasTextureSurface;
/**
 * Resizes a surface safely. Physical-size changes allocate a fresh
 * canvas + CanvasTexture and dispose the old texture; same-size
 * changes preserve the texture and only update logical scale metadata.
 */
export declare function resizeCanvasTextureSurface(surface: CanvasTextureSurface, options: CanvasTextureSurfaceOptions): CanvasTextureSurface;
/** Disposes the GPU texture and canvas backing store owned by a surface. */
export declare function disposeCanvasTextureSurface(surface: CanvasTextureSurface): void;
