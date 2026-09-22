import { Plane } from 'three';
import { Node, NodeOptions, Rect as HitRect } from './Node.ts';
import { TextureManager } from './texture-canvas';
export type RectStyle = {
    /** Fill colour as a CSS string (`"#ffeecc"` / `"rgba(...)"`). */
    readonly fill?: string;
    readonly fillAlpha?: number;
    readonly strokeColor?: string;
    readonly strokeWidth?: number;
    readonly strokeAlpha?: number;
    readonly cornerRadius?: number;
};
export type RectOptions = NodeOptions & RectStyle & {
    readonly width: number;
    readonly height: number;
    readonly interactive?: boolean;
    readonly textureManager: TextureManager;
};
/** Solid (optionally rounded / stroked) rectangle. */
export declare class Rect extends Node {
    private _width;
    private _height;
    private _fill;
    private _fillAlpha;
    private _strokeColor;
    private _strokeWidth;
    private _strokeAlpha;
    private _cornerRadius;
    private _rasterKey;
    private _rasterEntry;
    private readonly geometry;
    private readonly material;
    private readonly mesh;
    private readonly textureManager;
    constructor(options: RectOptions);
    /**
     * Auto hit-area honouring the current pivot. Without this, a Rect
     * with `originX/Y = 0.5` would have its visible mesh centred on
     * the node origin but its hit rectangle anchored at (0, 0) → bottom-
     * right of origin — clicks register at (w/2, h/2) offset from the
     * visual centre. Mirrors Button's manual fix-up.
     *
     * `|| 0` normalises the signed-zero that `-0 * w` returns when
     * pivot is exactly 0, so the public hit-area never leaks `-0` into
     * downstream equality checks.
     */
    private computeAutoHitArea;
    get width(): number;
    get height(): number;
    setSize(width: number, height: number): this;
    setStyle(style: RectStyle): this;
    setFill(color: string, alpha?: number): this;
    setStroke(color: string | null, width?: number, alpha?: number): this;
    setCornerRadius(radius: number): this;
    private rebuild;
    private isVisuallyEmpty;
    private computeKey;
    private paintInto;
    private resolvePixelSize;
    private rasterDebugInfo;
    private usesStretchableSolidFill;
    private applyMeshOffset;
    protected onPivotChanged(): void;
    protected applyMaterialAlpha(alpha: number): void;
    protected assignRenderOrderForSelf(counter: number, depthOffset: number): number;
    setClippingPlanes(planes: readonly Plane[] | null): void;
    setInteractive(rect: HitRect | null): this;
    destroy(): void;
}
