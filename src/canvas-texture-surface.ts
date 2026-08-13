/**
 * @file Safe mutable CanvasTexture surface.
 *
 * Resizing a canvas that is already the image source of a live
 * `CanvasTexture`, then flipping `texture.needsUpdate`, can make
 * Chrome's WebGL copy path attempt a sub-texture update against stale
 * dimensions (`glCopySubTextureCHROMIUM: Offset overflows texture
 * dimensions`). This helper makes the safe path explicit: if physical
 * dimensions change, allocate a fresh canvas + CanvasTexture and let
 * the owner swap the material map.
 */

import {
  createMutableRasterSurface,
  disposeMutableRasterSurface,
  resizeMutableRasterSurface,
  type RasterDebugInfo,
  type MutableRasterSurface,
} from "./TextureCache.ts";
import {
  type TextureCanvas,
  type TextureCanvas2DContext,
  type TextureManager,
} from "./texture-canvas";
import {
  type TextureCanvasScale,
  type TexturePixelRounding,
} from "./texture-sizing.ts";

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
export function createCanvasTextureSurface(
  options: CanvasTextureSurfaceOptions,
): CanvasTextureSurface {
  return createMutableRasterSurface({
    ...options,
    debugInfo: options.debugInfo ?? { kind: "CanvasTextureSurface" },
  });
}

/**
 * Resizes a surface safely. Physical-size changes allocate a fresh
 * canvas + CanvasTexture and dispose the old texture; same-size
 * changes preserve the texture and only update logical scale metadata.
 */
export function resizeCanvasTextureSurface(
  surface: CanvasTextureSurface,
  options: CanvasTextureSurfaceOptions,
): CanvasTextureSurface {
  return resizeMutableRasterSurface(surface, {
    ...options,
    debugInfo: options.debugInfo ?? { kind: "CanvasTextureSurface" },
  });
}

/** Disposes the GPU texture and canvas backing store owned by a surface. */
export function disposeCanvasTextureSurface(surface: CanvasTextureSurface): void {
  disposeMutableRasterSurface(surface);
}
