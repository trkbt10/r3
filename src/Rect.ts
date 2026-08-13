/**
 * @file Rect — solid rectangle node with optional rounded corners +
 * stroke, backed by the shared texture cache.
 *
 * Replaces the two distinct Phaser idioms used today:
 *
 *  - `scene.add.rectangle(x, y, w, h, color, alpha)` — square corners.
 *  - `scene.add.graphics(); g.fillRoundedRect(...); g.strokeRoundedRect(...)`
 *    — rounded corners + stroke, used by every Dialog and panel chrome.
 *
 * ## Canvas / texture ownership
 *
 * Same shape as {@link import("./Text.ts").Text}: the canvas +
 * CanvasTexture live in {@link import("./TextureCache.ts").acquireRaster},
 * keyed by the full visual fingerprint (dims + fill + stroke + corner
 * radius + dpr). Two Rects with identical looks share a GPU texture;
 * a remount with the same shape pays zero rasterisation cost.
 *
 * Two cases deliberately do not key by full dimensions:
 *
 * - Fully transparent Rects are input-only and allocate no raster.
 * - Solid, square-corner, stroke-free Rects use a shared 1x1 raster
 *   stretched by the mesh. Large square-corner fill+stroke panels
 *   should be built with {@link import("./FlatPanelRect.ts").FlatPanelRect},
 *   which composes this path for fill plus border edges.
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import type { Plane } from "three";
import { Node, type NodeOptions, type Rect as HitRect } from "./Node.ts";
import {
  acquireRaster,
  releaseRaster,
  type RasterEntry,
  type RasterMetrics,
} from "./TextureCache.ts";
import {
  type TextureCanvas,
  type TextureCanvas2DContext,
  type TextureManager,
} from "./texture-canvas";
import {
  resolveCurrentUiTexturePixelRatio,
  textureCanvasScaleFor,
  type TexturePixelSize,
} from "./texture-sizing.ts";

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

function effectiveDpr(): number {
  return resolveCurrentUiTexturePixelRatio();
}

/** Solid (optionally rounded / stroked) rectangle. */
export class Rect extends Node {
  private _width: number;
  private _height: number;
  private _fill: string;
  private _fillAlpha: number;
  private _strokeColor: string | null;
  private _strokeWidth: number;
  private _strokeAlpha: number;
  private _cornerRadius: number;

  private _rasterKey: string | null;
  private _rasterEntry: RasterEntry | null;

  private readonly geometry: PlaneGeometry;
  private readonly material: MeshBasicMaterial;
  private readonly mesh: Mesh;
  private readonly textureManager: TextureManager;

  constructor(options: RectOptions) {
    super(options);
    this._width = options.width;
    this._height = options.height;
    this._fill = options.fill ?? "#ffffff";
    this._fillAlpha = options.fillAlpha ?? 1;
    this._strokeColor = options.strokeColor ?? null;
    this._strokeWidth = options.strokeWidth ?? 0;
    this._strokeAlpha = options.strokeAlpha ?? 1;
    this._cornerRadius = options.cornerRadius ?? 0;
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

    if (options.interactive === true) {
      this.setInteractive(this.computeAutoHitArea());
    }

    this.rebuild();
  }

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
  private computeAutoHitArea(): HitRect {
    return {
      x: -this._pivotX * this._width || 0,
      y: -this._pivotY * this._height || 0,
      width: this._width,
      height: this._height,
    };
  }

  /* ── geometry getters / setters ────────────────────────────────── */

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  setSize(width: number, height: number): this {
    if (width === this._width && height === this._height) {
      return this;
    }
    this._width = width;
    this._height = height;
    this.rebuild();
    if (this._hitArea) {
      this.setInteractive(this.computeAutoHitArea());
    }
    return this;
  }

  setStyle(style: RectStyle): this {
    if (style.fill !== undefined) {
      this._fill = style.fill;
    }
    if (style.fillAlpha !== undefined) {
      this._fillAlpha = style.fillAlpha;
    }
    if (style.strokeColor !== undefined) {
      this._strokeColor = style.strokeColor;
    }
    if (style.strokeWidth !== undefined) {
      this._strokeWidth = style.strokeWidth;
    }
    if (style.strokeAlpha !== undefined) {
      this._strokeAlpha = style.strokeAlpha;
    }
    if (style.cornerRadius !== undefined) {
      this._cornerRadius = style.cornerRadius;
    }
    this.rebuild();
    return this;
  }

  setFill(color: string, alpha = 1): this {
    if (color === this._fill && alpha === this._fillAlpha) {
      return this;
    }
    this._fill = color;
    this._fillAlpha = alpha;
    this.rebuild();
    return this;
  }

  setStroke(color: string | null, width = 1, alpha = 1): this {
    this._strokeColor = color;
    this._strokeWidth = width;
    this._strokeAlpha = alpha;
    this.rebuild();
    return this;
  }

  setCornerRadius(radius: number): this {
    if (radius === this._cornerRadius) {
      return this;
    }
    this._cornerRadius = radius;
    this.rebuild();
    return this;
  }

  /* ── rasterise pipeline ────────────────────────────────────────── */

  private rebuild(): void {
    if (this.isVisuallyEmpty()) {
      if (this._rasterKey !== null) {
        releaseRaster(this._rasterKey);
        this._rasterKey = null;
        this._rasterEntry = null;
      }
      this.material.map = null;
      this.material.needsUpdate = true;
      this.mesh.visible = false;
      this.mesh.scale.set(Math.max(1, this._width), Math.max(1, this._height), 1);
      this.applyMeshOffset();
      return;
    }
    const key = this.computeKey();
    if (key === this._rasterKey && this._rasterEntry) {
      this.mesh.scale.set(Math.max(1, this._width), Math.max(1, this._height), 1);
      this.applyMeshOffset();
      return;
    }
    const entry = acquireRaster(
      key,
      (canvas) => this.paintInto(canvas),
      this.textureManager,
      undefined,
      this.rasterDebugInfo(),
    );
    if (this._rasterKey !== null) {
      releaseRaster(this._rasterKey);
    }
    this._rasterKey = key;
    this._rasterEntry = entry;
    this.material.map = entry.texture;
    this.material.needsUpdate = true;
    this.mesh.visible = true;
    this.mesh.scale.set(Math.max(1, this._width), Math.max(1, this._height), 1);
    this.applyMeshOffset();
  }

  private isVisuallyEmpty(): boolean {
    const fillVisible = Boolean(this._fill) && this._fillAlpha > 0;
    const strokeVisible = Boolean(this._strokeColor) && this._strokeWidth > 0 && this._strokeAlpha > 0;
    return !fillVisible && !strokeVisible;
  }

  private computeKey(): string {
    if (this.usesStretchableSolidFill()) {
      return JSON.stringify({
        w: 1,
        h: 1,
        pw: 1,
        ph: 1,
        f: this._fill,
        fa: this._fillAlpha,
        sc: null,
        sw: 0,
        sa: 0,
        cr: 0,
        d: 1,
      });
    }
    const pixelSize = this.resolvePixelSize();
    return JSON.stringify({
      w: this._width,
      h: this._height,
      pw: pixelSize.width,
      ph: pixelSize.height,
      f: this._fill,
      fa: this._fillAlpha,
      sc: this._strokeColor,
      sw: this._strokeWidth,
      sa: this._strokeAlpha,
      cr: this._cornerRadius,
      d: effectiveDpr(),
    });
  }

  private paintInto(canvas: TextureCanvas): RasterMetrics {
    const cssW = Math.max(1, this._width);
    const cssH = Math.max(1, this._height);
    if (this.usesStretchableSolidFill()) {
      canvas.width = 1;
      canvas.height = 1;
      const solidCtx = this.textureManager.acquireCanvas2DContext(canvas);
      if (solidCtx) {
        solidCtx.setTransform(1, 0, 0, 1, 0, 0);
        solidCtx.clearRect(0, 0, 1, 1);
        solidCtx.globalAlpha = this._fillAlpha;
        solidCtx.fillStyle = this._fill;
        solidCtx.fillRect(0, 0, 1, 1);
        solidCtx.globalAlpha = 1;
      }
      return { cssWidth: 1, cssHeight: 1 };
    }
    const pixelSize = this.resolvePixelSize();
    const scale = textureCanvasScaleFor(cssW, cssH, pixelSize);
    canvas.width = pixelSize.width;
    canvas.height = pixelSize.height;

    const ctx = this.textureManager.acquireCanvas2DContext(canvas);
    if (!ctx) {
      return { cssWidth: cssW, cssHeight: cssH };
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scale.x, scale.y);
    ctx.clearRect(0, 0, cssW, cssH);

    const radius = Math.max(0, Math.min(this._cornerRadius, Math.min(cssW, cssH) / 2));
    const inset = this._strokeColor ? this._strokeWidth / 2 : 0;
    pathRoundedRect(ctx, inset, inset, cssW - inset * 2, cssH - inset * 2, radius);

    if (this._fill && this._fillAlpha > 0) {
      ctx.globalAlpha = this._fillAlpha;
      ctx.fillStyle = this._fill;
      ctx.fill();
    }
    if (this._strokeColor && this._strokeWidth > 0) {
      ctx.globalAlpha = this._strokeAlpha;
      ctx.strokeStyle = this._strokeColor;
      ctx.lineWidth = this._strokeWidth;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    return { cssWidth: cssW, cssHeight: cssH };
  }

  private resolvePixelSize(): TexturePixelSize {
    if (this.usesStretchableSolidFill()) {
      return { width: 1, height: 1 };
    }
    return this.textureManager.resolveTexturePixelSize({
      logicalWidth: Math.max(1, this._width),
      logicalHeight: Math.max(1, this._height),
      pixelRatio: effectiveDpr(),
      rounding: "even",
    });
  }

  private rasterDebugInfo(): { readonly kind: string; readonly label: string } {
    return {
      kind: "Rect",
      label: this.name,
    };
  }

  private usesStretchableSolidFill(): boolean {
    const strokeVisible = Boolean(this._strokeColor) && this._strokeWidth > 0 && this._strokeAlpha > 0;
    return Boolean(this._fill) &&
      this._fillAlpha > 0 &&
      !strokeVisible &&
      this._cornerRadius <= 0;
  }

  private applyMeshOffset(): void {
    const w = this._width;
    const h = this._height;
    const offsetX = (0.5 - this._pivotX) * w;
    const offsetY = -((0.5 - this._pivotY) * h);
    this.mesh.position.set(offsetX, offsetY, 0);
  }

  protected override onPivotChanged(): void {
    this.applyMeshOffset();
    // Hit area is in node-local pixels and was anchored against the
    // old pivot; re-anchor against the new pivot so clicks keep
    // landing on the visible plane.
    if (this._hitArea) {
      this.setInteractive(this.computeAutoHitArea());
    }
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
    this.material.clipShadows = false;
    this.material.needsUpdate = true;
  }

  override setInteractive(rect: HitRect | null): this {
    return super.setInteractive(rect);
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

/**
 * Stamps a rounded-rectangle path into the context. Extracted so
 * both fill and stroke share the same shape; we cannot use the
 * `roundRect()` Path2D API because it is unavailable on Safari
 * versions still in the support window.
 */
function pathRoundedRect(
  ctx: TextureCanvas2DContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
