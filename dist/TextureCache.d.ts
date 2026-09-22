import { CanvasTexture } from 'three';
import { TextureCanvas, TextureCanvas2DContext, TextureManager } from './texture-canvas';
import { TextureCanvasScale, TexturePixelRounding } from './texture-sizing.ts';
/**
 * Paint callback supplied to {@link acquireRaster}. Receives a fresh
 * {@link TextureCanvas} (currently 1×1 — the paint is expected to
 * resize it to the required dimensions before drawing). The canvas
 * is an `OffscreenCanvas` on runtimes that support it, otherwise a
 * real `HTMLCanvasElement`; the common 2D API covers everything the
 * paint callback needs. Returns the logical (CSS-pixel) dimensions
 * the caller's mesh should be scaled to — typically smaller than the
 * physical canvas size when DPR > 1.
 */
export type RasterPaint = (canvas: TextureCanvas) => RasterMetrics;
export type RasterTextureConfigurator = (texture: CanvasTexture<TextureCanvas>) => void;
export type RasterDebugInfo = {
    readonly kind: string;
    readonly label?: string;
};
export type RasterMetrics = {
    /** Logical width consumers should feed into `mesh.scale.x`. */
    readonly cssWidth: number;
    /** Logical height consumers should feed into `mesh.scale.y`. */
    readonly cssHeight: number;
};
export type MutableRasterSurfaceOptions = {
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly pixelRatio: number;
    readonly rounding?: TexturePixelRounding;
    readonly maxTextureSize?: number;
    readonly textureManager: TextureManager;
    readonly configureTexture?: RasterTextureConfigurator;
    readonly debugInfo?: RasterDebugInfo;
};
export type MutableRasterSurface = {
    readonly cacheKey: string;
    readonly canvas: TextureCanvas;
    readonly ctx: TextureCanvas2DContext | null;
    readonly texture: CanvasTexture<TextureCanvas>;
    readonly pixelWidth: number;
    readonly pixelHeight: number;
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly scale: TextureCanvasScale;
};
/**
 * Public view of a live cache entry. `texture` and `canvas` outlive
 * the acquiring node (they stay in the cache until evicted); callers
 * must not dispose the texture directly — instead
 * {@link releaseRaster} so the cache's refcount stays correct.
 */
export type RasterEntry = {
    readonly canvas: TextureCanvas;
    readonly texture: CanvasTexture<TextureCanvas>;
    readonly cssWidth: number;
    readonly cssHeight: number;
};
export type RasterProvider<TInput, THandle> = {
    readonly acquire: (input: TInput) => THandle;
    readonly release: (handle: THandle) => void;
};
export type RasterProviderSpec<TInput, THandle> = {
    readonly key: (input: TInput) => string;
    readonly paint: (canvas: TextureCanvas, input: TInput) => RasterMetrics;
    readonly configureTexture?: RasterTextureConfigurator;
    readonly handle: (key: string, entry: RasterEntry, input: TInput) => THandle;
    readonly releaseKey: (handle: THandle) => string;
    readonly textureManager: TextureManager;
};
/**
 * Looks up (or builds) the raster for `key`. Ref-counts the entry so
 * multiple owners of the same content share a single GPU texture.
 */
export declare function acquireRaster(key: string, paint: RasterPaint, textureManager: TextureManager, configureTexture?: RasterTextureConfigurator, debugInfo?: RasterDebugInfo): RasterEntry;
/**
 * Builds a typed provider over the shared raster cache. Feature code
 * owns fingerprinting and paint semantics; TextureCache owns acquire,
 * refcount and release mechanics.
 */
export declare function createRasterProvider<TInput, THandle>(spec: RasterProviderSpec<TInput, THandle>): RasterProvider<TInput, THandle>;
/** Allocates a mutable one-owner canvas texture surface under TextureCache accounting. */
export declare function createMutableRasterSurface(options: MutableRasterSurfaceOptions): MutableRasterSurface;
/** Resizes a mutable surface, preserving the texture when physical dimensions are unchanged. */
export declare function resizeMutableRasterSurface(surface: MutableRasterSurface, options: MutableRasterSurfaceOptions): MutableRasterSurface;
/** Releases a mutable surface allocated by {@link createMutableRasterSurface}. */
export declare function disposeMutableRasterSurface(surface: MutableRasterSurface): void;
/**
 * Decrements the refCount for `key`. When it hits zero, the entry is
 * immediately removed and disposed; no scene is expected to remember
 * to trim idle textures.
 */
export declare function releaseRaster(key: string): void;
/**
 * Historical test/dev hook. Live entries are never trimmed here;
 * zero-ref entries are disposed synchronously by {@link releaseRaster}.
 */
export declare function trimCachedTextures(): void;
/** Telemetry helper for tests + dev UIs. */
export declare function rasterCacheStats(): {
    readonly entries: number;
    readonly bytes: number;
    readonly idle: number;
};
/** Configures a raster texture that stores display colour. */
export declare function configureColorRasterTexture(texture: CanvasTexture<TextureCanvas>): void;
/** Configures a raster texture that stores data masks rather than colour. */
export declare function configureDataRasterTexture(texture: CanvasTexture<TextureCanvas>): void;
