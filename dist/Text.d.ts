import { Plane } from 'three';
import { Node, NodeOptions } from './Node.ts';
import { TextAlign, TextStrokeSpec } from './text-raster.ts';
import { FontStyleSpec, WrappedLine } from './text-metrics.ts';
import { TextureManager } from './texture-canvas';
export type TextOptions = NodeOptions & {
    readonly text?: string;
    readonly font: FontStyleSpec;
    readonly color?: string;
    readonly align?: TextAlign;
    readonly lineHeight?: number;
    readonly letterSpacing?: number;
    readonly maxWidth?: number;
    readonly maxLines?: number;
    readonly ellipsis?: boolean;
    readonly padding?: number;
    readonly stroke?: TextStrokeSpec;
    readonly textureManager: TextureManager;
};
/** Plane-rendered Canvas-API text. */
export declare class Text extends Node {
    private _text;
    private _font;
    private _color;
    private _align;
    private _lineHeight;
    private _letterSpacing;
    private _maxWidth;
    private _maxLines;
    private _ellipsis;
    private _padding;
    private _stroke;
    /**
     * Latest wrapped lines snapshot — reserved for a future `get lines()`
     * accessor. Currently unused; left in place so downstream consumers
     * that previously relied on it can be wired up without changing the
     * cache signature.
     */
    private _lines;
    private _cssWidth;
    private _cssHeight;
    /** Current cache key. `null` before the first successful rebuild. */
    private _rasterKey;
    /** Current cache entry. Mirrors `_rasterKey` — released in lockstep. */
    private _rasterEntry;
    private readonly geometry;
    private readonly material;
    private readonly mesh;
    private readonly textureManager;
    constructor(options: TextOptions);
    get text(): string;
    setText(text: string): this;
    setColor(color: string): this;
    setStyle(font: FontStyleSpec): this;
    setAlign(align: TextAlign): this;
    setMaxWidth(maxWidth: number): this;
    setMaxLines(maxLines: number): this;
    setLineHeight(lineHeight: number): this;
    setLetterSpacing(letterSpacing: number): this;
    setStroke(stroke: TextStrokeSpec | null): this;
    get width(): number;
    get height(): number;
    get lines(): readonly WrappedLine[];
    /**
     * Acquires (or rebuilds) the cached raster for the current content,
     * swaps material.map to the cached texture, and scales the mesh to
     * the logical pixel footprint.
     */
    private rebuild;
    private currentSpec;
    private applyMeshOffset;
    protected onPivotChanged(): void;
    protected applyMaterialAlpha(alpha: number): void;
    protected assignRenderOrderForSelf(counter: number, depthOffset: number): number;
    setClippingPlanes(planes: readonly Plane[] | null): void;
    destroy(): void;
}
