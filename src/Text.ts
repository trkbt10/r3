/**
 * @file Text — Canvas-API-rasterised text node, backed by the shared
 * {@link import("./TextureCache.ts").acquireRaster} cache via
 * {@link ./text-raster.ts}.
 *
 * Text is rendered into an offscreen canvas sized to the measured
 * dimensions of the wrapped text, uploaded to the GPU as a
 * {@link CanvasTexture}, and shown on a unit-PlaneGeometry scaled to
 * the canvas's CSS-pixel footprint.
 *
 * ## Canvas / texture ownership
 *
 * The canvas + texture are **not** owned by this node. They live in
 * the shared rasterisation cache keyed by the content fingerprint
 * (text + font + color + align + padding + lineHeight + maxWidth +
 * stroke). On any style/content mutation we release the old key,
 * compute the new fingerprint, and acquire — a cache hit returns the
 * pre-existing texture without repainting. When the node is
 * destroyed we release; refCount-zero entries park in an LRU until
 * evicted (so a later remount of the same content is zero-cost).
 *
 * ## Why this file is thin
 *
 * All rasterisation (wrap, measurement, canvas sizing, baseline
 * placement, stroke/fill) lives in `./text-raster.ts` — the same
 * module the rare-card face baker uses to composite text into its
 * shader-target canvas. Keeping Text.ts as a node-lifecycle wrapper
 * (mesh + material + cache handle) preserves the SSoT: every text
 * raster in the app runs through one code path.
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import type { Plane } from "three";
import { Node, type NodeOptions } from "./Node.ts";
import { releaseRaster, type RasterEntry } from "./TextureCache.ts";
import {
  acquireTextRaster,
  textRasterKey,
  type TextAlign,
  type TextRasterSpec,
  type TextStrokeSpec,
} from "./text-raster.ts";
import type { FontStyleSpec, WrappedLine } from "./text-metrics.ts";
import type { TextureManager } from "./texture-canvas";

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
export class Text extends Node {
  private _text: string;
  private _font: FontStyleSpec;
  private _color: string;
  private _align: TextAlign;
  private _lineHeight: number;
  private _letterSpacing: number;
  private _maxWidth: number;
  private _maxLines: number;
  private _ellipsis: boolean;
  private _padding: number;
  private _stroke: TextStrokeSpec | null;

  /**
   * Latest wrapped lines snapshot — reserved for a future `get lines()`
   * accessor. Currently unused; left in place so downstream consumers
   * that previously relied on it can be wired up without changing the
   * cache signature.
   */
  private _lines: readonly WrappedLine[];
  private _cssWidth: number;
  private _cssHeight: number;

  /** Current cache key. `null` before the first successful rebuild. */
  private _rasterKey: string | null;
  /** Current cache entry. Mirrors `_rasterKey` — released in lockstep. */
  private _rasterEntry: RasterEntry | null;

  private readonly geometry: PlaneGeometry;
  private readonly material: MeshBasicMaterial;
  private readonly mesh: Mesh;
  private readonly textureManager: TextureManager;

  constructor(options: TextOptions) {
    super(options);
    this._text = options.text ?? "";
    this._font = options.font;
    this._color = options.color ?? "#ffffff";
    this._align = options.align ?? "left";
    this._lineHeight = options.lineHeight ?? 1.2;
    this._letterSpacing = options.letterSpacing ?? 0;
    this._maxWidth = options.maxWidth ?? Infinity;
    this._maxLines = options.maxLines ?? Infinity;
    this._ellipsis = options.ellipsis ?? true;
    this._padding = options.padding ?? 2;
    this._stroke = options.stroke ?? null;
    this._lines = [];
    this._cssWidth = 0;
    this._cssHeight = 0;
    this._rasterKey = null;
    this._rasterEntry = null;
    this.textureManager = options.textureManager;

    this.material = new MeshBasicMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.geometry = new PlaneGeometry(1, 1);
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.obj3d.add(this.mesh);

    this.rebuild();
  }

  /* ── content getters / setters ─────────────────────────────────── */

  get text(): string {
    return this._text;
  }

  setText(text: string): this {
    if (text === this._text) {
      return this;
    }
    this._text = text;
    this.rebuild();
    return this;
  }

  setColor(color: string): this {
    if (color === this._color) {
      return this;
    }
    this._color = color;
    this.rebuild();
    return this;
  }

  setStyle(font: FontStyleSpec): this {
    this._font = font;
    this.rebuild();
    return this;
  }

  setAlign(align: TextAlign): this {
    if (align === this._align) {
      return this;
    }
    this._align = align;
    this.rebuild();
    return this;
  }

  setMaxWidth(maxWidth: number): this {
    if (maxWidth === this._maxWidth) {
      return this;
    }
    this._maxWidth = maxWidth;
    this.rebuild();
    return this;
  }

  setMaxLines(maxLines: number): this {
    if (maxLines === this._maxLines) {
      return this;
    }
    this._maxLines = maxLines;
    this.rebuild();
    return this;
  }

  setLineHeight(lineHeight: number): this {
    if (lineHeight === this._lineHeight) {
      return this;
    }
    this._lineHeight = lineHeight;
    this.rebuild();
    return this;
  }

  setLetterSpacing(letterSpacing: number): this {
    if (letterSpacing === this._letterSpacing) {
      return this;
    }
    this._letterSpacing = letterSpacing;
    this.rebuild();
    return this;
  }

  setStroke(stroke: TextStrokeSpec | null): this {
    this._stroke = stroke;
    this.rebuild();
    return this;
  }

  get width(): number {
    return this._cssWidth;
  }

  get height(): number {
    return this._cssHeight;
  }

  get lines(): readonly WrappedLine[] {
    return this._lines;
  }

  /* ── rasterise pipeline ────────────────────────────────────────── */

  /**
   * Acquires (or rebuilds) the cached raster for the current content,
   * swaps material.map to the cached texture, and scales the mesh to
   * the logical pixel footprint.
   */
  private rebuild(): void {
    const spec: TextRasterSpec = this.currentSpec();
    const key = textRasterKey(spec);
    if (key === this._rasterKey && this._rasterEntry) {
      return;
    }
    const entry = acquireTextRaster(spec, this.textureManager);
    if (this._rasterKey !== null) {
      releaseRaster(this._rasterKey);
    }
    this._rasterKey = key;
    this._rasterEntry = entry;
    this._cssWidth = entry.cssWidth;
    this._cssHeight = entry.cssHeight;
    this.material.map = entry.texture;
    this.material.needsUpdate = true;
    this.mesh.scale.set(Math.max(1, entry.cssWidth), Math.max(1, entry.cssHeight), 1);
    this.applyMeshOffset();
  }

  private currentSpec(): TextRasterSpec {
    return {
      text: this._text,
      font: this._font,
      color: this._color,
      align: this._align,
      lineHeight: this._lineHeight,
      letterSpacing: this._letterSpacing,
      maxWidth: this._maxWidth,
      maxLines: this._maxLines,
      ellipsis: this._ellipsis,
      padding: this._padding,
      stroke: this._stroke,
    };
  }

  private applyMeshOffset(): void {
    const w = this._cssWidth;
    const h = this._cssHeight;
    const offsetX = (0.5 - this._pivotX) * w;
    const offsetY = -((0.5 - this._pivotY) * h);
    this.mesh.position.set(offsetX, offsetY, 0);
  }

  protected override onPivotChanged(): void {
    this.applyMeshOffset();
  }

  protected override applyMaterialAlpha(alpha: number): void {
    this.material.opacity = alpha;
  }

  protected override assignRenderOrderForSelf(counter: number, depthOffset: number): number {
    this.mesh.renderOrder = depthOffset + counter;
    return counter + 1;
  }

  override setClippingPlanes(planes: readonly Plane[] | null): void {
    super.setClippingPlanes(planes);
    this.material.clippingPlanes = planes ? planes.slice() : null;
    this.material.needsUpdate = true;
  }

  override destroy(): void {
    if (this._rasterKey !== null) {
      releaseRaster(this._rasterKey);
      this._rasterKey = null;
      this._rasterEntry = null;
    }
    this.material.dispose();
    this.geometry.dispose();
    super.destroy();
  }
}
