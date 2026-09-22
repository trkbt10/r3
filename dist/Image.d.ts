import { Mesh, MeshBasicMaterial, Texture, Plane, Wrapping } from 'three';
import { Node, NodeOptions } from './Node.ts';
import { TextureCanvas, TextureManager } from './texture-canvas';
export type ImageSource = {
    readonly kind: "element";
    readonly element: HTMLImageElement;
} | {
    readonly kind: "canvas";
    readonly canvas: TextureCanvas;
} | {
    readonly kind: "texture";
    readonly texture: Texture;
};
export type ImageTextureCrop = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
};
export type ImageTextureLowerFade = {
    readonly startY: number;
};
export type ImageOptions = NodeOptions & {
    readonly source: ImageSource;
    /** Explicit display width; defaults to the source's intrinsic width. */
    readonly width?: number;
    /** Explicit display height; defaults to the source's intrinsic height. */
    readonly height?: number;
    /** Tint multiplied onto every sampled pixel. Default: white (no tint). */
    readonly tint?: number;
    readonly interactive?: boolean;
    /**
     * True only when this Image owns `source.canvas` and no other live
     * object will repaint or rebind it after destroy/replacement.
     */
    readonly releaseCanvasOnDestroy?: boolean;
    readonly textureManager: TextureManager;
    /**
     * Wrapping mode applied to the source texture. Defaults to
     * {@link ClampToEdgeWrapping}. NineSlice re-uses Image via a
     * subclass and tweaks this to `RepeatWrapping` for the stretched
     * interior strip.
     */
    readonly wrap?: Wrapping;
    /**
     * Normalized source rectangle in top-left image coordinates. This
     * changes only the plane UVs; it does not allocate a canvas.
     */
    readonly textureCrop?: ImageTextureCrop;
    /**
     * Normalized lower-edge alpha fade in display/crop coordinates.
     * Implemented in the material shader; no canvas is allocated.
     */
    readonly textureLowerFade?: ImageTextureLowerFade;
};
/** Textured unit plane. */
export declare class R3Image extends Node {
    protected _width: number;
    protected _height: number;
    protected _tint: number;
    protected texture: Texture;
    /** True when we own the texture (must dispose on destroy). */
    private ownsTexture;
    private readonly releasesCanvasSources;
    private readonly textureManager;
    private readonly wrap;
    private readonly geometry;
    private textureCrop;
    private textureLowerFade;
    protected readonly material: MeshBasicMaterial;
    protected readonly mesh: Mesh;
    constructor(options: ImageOptions);
    /**
     * Pivot-aware auto hit-area. With pivot (0.5, 0.5) the visible
     * mesh is centred on the node origin, so the hit rectangle has to
     * be shifted to (-w/2, -h/2) to keep clicks landing on the visible
     * texture. See Rect.computeAutoHitArea for the same fix-up.
     *
     * `|| 0` normalises the signed-zero that `-0 * w` returns when
     * pivot is exactly 0 (kept in sync with Rect).
     */
    private computeAutoHitArea;
    get width(): number;
    get height(): number;
    setSize(width: number, height: number): this;
    setTint(color: number): this;
    /**
     * Forces the GPU texture to re-upload from its source canvas/
     * element. Call after writing to the source canvas, or after an
     * image finishes loading post-construction.
     */
    invalidateTexture(): this;
    /**
     * Replaces a canvas-backed texture with a fresh CanvasTexture.
     *
     * Use this instead of resizing a canvas that is already bound to the
     * current texture. Chrome's WebGL copy path can otherwise attempt a
     * sub-texture upload against the old dimensions and emit
     * `glCopySubTextureCHROMIUM: Offset overflows texture dimensions`.
     */
    replaceCanvasSource(canvas: TextureCanvas): this;
    replaceElementSource(element: HTMLImageElement): this;
    setTextureCrop(crop: ImageTextureCrop | undefined): this;
    setTextureLowerFade(fade: ImageTextureLowerFade | undefined): this;
    private applyMeshOffset;
    protected onPivotChanged(): void;
    protected applyMaterialAlpha(alpha: number): void;
    protected assignRenderOrderForSelf(counter: number, depthOffset: number): number;
    setClippingPlanes(planes: readonly Plane[] | null): void;
    destroy(): void;
    private replaceTexture;
}
/** Return texture lower fade uniforms. */
export declare function textureLowerFadeUniforms(crop: ImageTextureCrop, fade: ImageTextureLowerFade | null): {
    readonly startV: number;
    readonly endV: number;
};
