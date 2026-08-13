/**
 * @file Graphics — imperative draw surface that mirrors Phaser's
 * GameObjects.Graphics shape closely enough for the existing call
 * sites (`g.fillStyle`, `g.fillRoundedRect`, `g.strokeRoundedRect`,
 * `g.lineStyle`, `g.fillRect`, `g.clear`, `g.fillTriangle`,
 * `g.beginPath`/`closePath`/`fillPath`/`strokePath`, …) to be ported
 * with minor renames where necessary.
 *
 * Implementation: Graphics owns a Canvas of fixed dimensions
 * (defaulting to the viewport size). Calls into the public API are
 * forwarded to its Canvas 2D context with `dpr` scaling and the
 * typical `transparent: true; depthTest: false; depthWrite: false`
 * material so depth-based UI ordering still works.
 *
 * Where the Phaser surface diverges from the native Canvas API (it
 * uses 0xRRGGBB hex numbers + an alpha float, not CSS strings) we
 * preserve the Phaser ergonomics and convert internally — keeping
 * the call sites mechanical.
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import type { Plane } from "three";
import { Node, type NodeOptions } from "./Node.ts";
import {
  createCanvasTextureSurface,
  disposeCanvasTextureSurface,
  resizeCanvasTextureSurface,
  type CanvasTextureSurface,
} from "./canvas-texture-surface.ts";
import {
  type TextureCanvas,
  type TextureCanvas2DContext,
  type TextureManager,
} from "./texture-canvas";
import { resolveCurrentUiTexturePixelRatio } from "./texture-sizing.ts";

export type GraphicsOptions = NodeOptions & {
  /** Drawing surface width in logical pixels. */
  readonly width: number;
  /** Drawing surface height in logical pixels. */
  readonly height: number;
  readonly textureManager: TextureManager;
};

/** Converts a 0xRRGGBB hex number + alpha to a CSS rgba() string. */
function rgbaFromHex(hex: number, alpha: number): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

/** State held by Graphics for the current draw style. */
type StyleState = {
  fillColor: string;
  fillAlpha: number;
  strokeColor: string;
  strokeAlpha: number;
  lineWidth: number;
};

/** Imperative draw API. Drawing-state matches Phaser's Graphics shape. */
export class Graphics extends Node {
  private _width: number;
  private _height: number;
  private surface: CanvasTextureSurface;
  /**
   * Canvas 2D context. `null` only in headless test environments
   * — every draw method becomes a no-op when context is absent so
   * the surrounding scene graph stays usable for hit-testing /
   * event coverage.
   *
   * The context flavour (CanvasRenderingContext2D vs
   * OffscreenCanvasRenderingContext2D) follows from the texture-canvas
   * SSoT's runtime decision. All of the 2D methods used below are
   * part of the shared interface set, so the union can be consumed
   * without narrowing at every call site.
   */
  private readonly geometry: PlaneGeometry;
  private readonly material: MeshBasicMaterial;
  private readonly mesh: Mesh;
  private readonly textureManager: TextureManager;

  private readonly style: StyleState;

  constructor(options: GraphicsOptions) {
    super(options);
    this._width = options.width;
    this._height = options.height;
    this.textureManager = options.textureManager;
    this.surface = createCanvasTextureSurface({
      logicalWidth: this._width,
      logicalHeight: this._height,
      pixelRatio: resolveCurrentUiTexturePixelRatio(),
      rounding: "even",
      textureManager: this.textureManager,
      debugInfo: this.rasterDebugInfo(),
    });
    this.applyCanvasTransform();

    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.geometry = new PlaneGeometry(1, 1);
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.scale.set(this._width, this._height, 1);
    this.obj3d.add(this.mesh);

    this.style = {
      fillColor: "#ffffff",
      fillAlpha: 1,
      strokeColor: "#ffffff",
      strokeAlpha: 1,
      lineWidth: 1,
    };
    this.applyMeshOffset();
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  private get canvas(): TextureCanvas {
    return this.surface.canvas;
  }

  private get ctx(): TextureCanvas2DContext | null {
    this.ensureSurfaceMatchesSettings();
    return this.surface.ctx;
  }

  private get texture() {
    return this.surface.texture;
  }

  /**
   * Resizes the drawing surface. The canvas backing is replaced at
   * the new DPR-adjusted size, the context transform is reapplied,
   * and the mesh's geometry scale is updated so the plane still
   * covers the logical width × height. The canvas is BLANK after
   * this call — the caller must re-paint (same contract as
   * {@link clear} but with new dimensions).
   *
   * Kept separate from `clear()` because resize triggers a GPU
   * texture re-allocation (the CanvasTexture's backing store
   * tracks the HTML canvas), which is more expensive than a simple
   * clear. Callers should debounce resizes when possible.
   */
  setSize(width: number, height: number): this {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    if (w === this._width && h === this._height) {
      return this;
    }
    this._width = w;
    this._height = h;
    this.resizeSurfaceForCurrentSettings();
    this.mesh.scale.set(w, h, 1);
    this.texture.needsUpdate = true;
    this.applyMeshOffset();
    return this;
  }

  /**
   * Resets the canvas to fully transparent and clears any in-progress
   * path. Mirrors Phaser's `Graphics.clear()`. No-op when the
   * runtime can't provide a 2D context (headless tests).
   */
  clear(): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this.ctx.beginPath();
    this.texture.needsUpdate = true;
    return this;
  }

  /* ── style configuration ───────────────────────────────────────── */

  fillStyle(color: number, alpha = 1): this {
    this.style.fillColor = rgbaFromHex(color, alpha);
    this.style.fillAlpha = alpha;
    return this;
  }

  lineStyle(width: number, color: number, alpha = 1): this {
    this.style.strokeColor = rgbaFromHex(color, alpha);
    this.style.strokeAlpha = alpha;
    this.style.lineWidth = width;
    return this;
  }

  /* ── primitive draws ───────────────────────────────────────────── */

  fillRect(x: number, y: number, w: number, h: number): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.fillStyle = this.style.fillColor;
    this.ctx.fillRect(x, y, w, h);
    this.texture.needsUpdate = true;
    return this;
  }

  strokeRect(x: number, y: number, w: number, h: number): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.strokeStyle = this.style.strokeColor;
    this.ctx.lineWidth = this.style.lineWidth;
    this.ctx.strokeRect(x, y, w, h);
    this.texture.needsUpdate = true;
    return this;
  }

  fillRoundedRect(x: number, y: number, w: number, h: number, radius: number): this {
    if (!this.ctx) {
      return this;
    }
    this.pathRoundedRect(x, y, w, h, radius);
    this.ctx.fillStyle = this.style.fillColor;
    this.ctx.fill();
    this.texture.needsUpdate = true;
    return this;
  }

  strokeRoundedRect(x: number, y: number, w: number, h: number, radius: number): this {
    if (!this.ctx) {
      return this;
    }
    this.pathRoundedRect(x, y, w, h, radius);
    this.ctx.strokeStyle = this.style.strokeColor;
    this.ctx.lineWidth = this.style.lineWidth;
    this.ctx.stroke();
    this.texture.needsUpdate = true;
    return this;
  }

  /**
   * Fills a rounded rectangle with a CSS-filter Gaussian blur
   * applied. This is the "real" soft shadow primitive — unlike
   * stacking multiple semi-transparent rects (which produces a
   * step-function falloff), `ctx.filter = "blur(Npx)"` runs the
   * raster through a true Gaussian convolution, so the result is
   * continuously graded.
   *
   * The filter expands the visible footprint by roughly 2–3× `blurPx`
   * in every direction, so the drawing surface (this Graphics'
   * width × height) must include padding on all sides; otherwise the
   * edges clip to a hard line and you get back the stepped look you
   * were trying to avoid. A typical pattern is:
   *
   *   const pad = Math.ceil(blurPx * 3);
   *   const shadow = new Graphics({
   *     width: w + pad * 2,
   *     height: h + pad * 2,
   *     x: panelX + offsetX - pad,
   *     y: panelY + offsetY - pad,
   *     originX: 0,
   *     originY: 0,
   *   });
   *   shadow.fillStyle(0x000000, 0.5);
   *   shadow.fillBlurredRoundedRect(pad, pad, w, h, radius, blurPx);
   *
   * Headless environments that return a null 2D context (unit tests)
   * are a no-op. The previous `ctx.filter` value is preserved +
   * restored so the Graphics object's draw state is unaffected.
   */
  fillBlurredRoundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    blurPx: number,
  ): this {
    if (!this.ctx) {
      return this;
    }
    this.pathRoundedRect(x, y, w, h, radius);
    const prevFilter = this.ctx.filter;
    this.ctx.filter = blurPx > 0 ? `blur(${String(blurPx)}px)` : "none";
    this.ctx.fillStyle = this.style.fillColor;
    this.ctx.fill();
    this.ctx.filter = prevFilter;
    this.texture.needsUpdate = true;
    return this;
  }

  /**
   * Fills a rounded-rect region with a tiled image overlay. Unlike a
   * separate textured {@link Node.Image} plane laid on top of the
   * panel, the image here is clipped by the rounded path itself — the
   * corners are *cut* rather than *covered*, so there is no texture
   * bleed outside the silhouette when the panel sits over a non-black
   * background.
   *
   * Tiles step in logical pixels at `tileWidth × tileHeight` (defaulting
   * to the image's intrinsic size). `alpha` multiplies the tile's
   * opacity so callers can lay the grain in as a subtle overlay
   * without touching the outer `fillStyle`. The method composes with
   * an existing fill — call {@link fillRoundedRect} first for the
   * base colour, then this for the overlay.
   */
  fillPatternRoundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    image: CanvasImageSource,
    alpha = 1,
    tileWidth?: number,
    tileHeight?: number,
  ): this {
    if (!this.ctx) {
      return this;
    }
    const intrinsicW = canvasSourceWidth(image);
    const intrinsicH = canvasSourceHeight(image);
    if (intrinsicW <= 0 || intrinsicH <= 0) {
      return this;
    }
    const tw = tileWidth ?? intrinsicW;
    const th = tileHeight ?? intrinsicH;
    if (tw <= 0 || th <= 0 || w <= 0 || h <= 0) {
      return this;
    }
    this.pathRoundedRect(x, y, w, h, radius);
    this.ctx.save();
    this.ctx.clip();
    const prevAlpha = this.ctx.globalAlpha;
    this.ctx.globalAlpha = prevAlpha * Math.max(0, Math.min(1, alpha));
    // Anchor the grid at (x, y) so tiles start on the rect's top-left
    // corner regardless of the panel's viewport offset. Step by tile
    // size — the clip handles the right / bottom overruns.
    for (let ty = y; ty < y + h; ty += th) {
      for (let tx = x; tx < x + w; tx += tw) {
        this.ctx.drawImage(image, tx, ty, tw, th);
      }
    }
    this.ctx.restore();
    this.texture.needsUpdate = true;
    return this;
  }

  fillCircle(cx: number, cy: number, radius: number): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.closePath();
    this.ctx.fillStyle = this.style.fillColor;
    this.ctx.fill();
    this.texture.needsUpdate = true;
    return this;
  }

  strokeCircle(cx: number, cy: number, radius: number): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.closePath();
    this.ctx.strokeStyle = this.style.strokeColor;
    this.ctx.lineWidth = this.style.lineWidth;
    this.ctx.stroke();
    this.texture.needsUpdate = true;
    return this;
  }

  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.closePath();
    this.ctx.fillStyle = this.style.fillColor;
    this.ctx.fill();
    this.texture.needsUpdate = true;
    return this;
  }

  strokeLine(x1: number, y1: number, x2: number, y2: number): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.strokeStyle = this.style.strokeColor;
    this.ctx.lineWidth = this.style.lineWidth;
    this.ctx.stroke();
    this.texture.needsUpdate = true;
    return this;
  }

  /* ── path API (matches Phaser begin/move/line/close pattern) ───── */

  beginPath(): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.beginPath();
    return this;
  }

  moveTo(x: number, y: number): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.moveTo(x, y);
    return this;
  }

  lineTo(x: number, y: number): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.lineTo(x, y);
    return this;
  }

  closePath(): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.closePath();
    return this;
  }

  fillPath(): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.fillStyle = this.style.fillColor;
    this.ctx.fill();
    this.texture.needsUpdate = true;
    return this;
  }

  strokePath(): this {
    if (!this.ctx) {
      return this;
    }
    this.ctx.strokeStyle = this.style.strokeColor;
    this.ctx.lineWidth = this.style.lineWidth;
    this.ctx.stroke();
    this.texture.needsUpdate = true;
    return this;
  }

  /**
   * Stamps a rounded-rectangle path into the context. Internal
   * helper used by both fill/stroke variants. Caller is responsible
   * for the null-context guard.
   */
  private pathRoundedRect(x: number, y: number, w: number, h: number, r: number): void {
    if (!this.ctx) {
      return;
    }
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    this.ctx.beginPath();
    if (radius <= 0) {
      this.ctx.rect(x, y, w, h);
      return;
    }
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + w - radius, y);
    this.ctx.arcTo(x + w, y, x + w, y + radius, radius);
    this.ctx.lineTo(x + w, y + h - radius);
    this.ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    this.ctx.lineTo(x + radius, y + h);
    this.ctx.arcTo(x, y + h, x, y + h - radius, radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.arcTo(x, y, x + radius, y, radius);
    this.ctx.closePath();
  }

  private applyMeshOffset(): void {
    const w = this._width;
    const h = this._height;
    // Graphics defaults to top-left pivot to match Phaser's Graphics.
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
    this.material.dispose();
    disposeCanvasTextureSurface(this.surface);
    this.geometry.dispose();
    super.destroy();
  }

  private ensureSurfaceMatchesSettings(): void {
    this.resizeSurfaceForCurrentSettings();
  }

  private resizeSurfaceForCurrentSettings(): void {
    const previousTexture = this.surface.texture;
    const next = resizeCanvasTextureSurface(this.surface, {
      logicalWidth: this._width,
      logicalHeight: this._height,
      pixelRatio: resolveCurrentUiTexturePixelRatio(),
      rounding: "even",
      textureManager: this.textureManager,
      debugInfo: this.rasterDebugInfo(),
    });
    this.surface = next;
    this.applyCanvasTransform();
    if (next.texture === previousTexture) {
      return;
    }
    this.material.map = next.texture;
    this.material.needsUpdate = true;
  }

  private applyCanvasTransform(): void {
    const ctx = this.surface.ctx;
    if (!ctx) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(this.surface.scale.x, this.surface.scale.y);
  }

  private rasterDebugInfo(): { readonly kind: string; readonly label: string } {
    return {
      kind: "Graphics",
      label: this.name,
    };
  }
}

/**
 * Source width in pixels for a {@link CanvasImageSource}. Prefers
 * `naturalWidth` on {@link HTMLImageElement} because its `width`
 * reflects the CSS / attribute value (which may be zero if unset),
 * not the decoded bitmap dimensions.
 */
function canvasSourceWidth(image: CanvasImageSource): number {
  if (typeof (image as { naturalWidth?: unknown }).naturalWidth === "number") {
    return (image as HTMLImageElement).naturalWidth;
  }
  if (typeof (image as { videoWidth?: unknown }).videoWidth === "number") {
    return (image as HTMLVideoElement).videoWidth;
  }
  return (image as { width: number }).width;
}

function canvasSourceHeight(image: CanvasImageSource): number {
  if (typeof (image as { naturalHeight?: unknown }).naturalHeight === "number") {
    return (image as HTMLImageElement).naturalHeight;
  }
  if (typeof (image as { videoHeight?: unknown }).videoHeight === "number") {
    return (image as HTMLVideoElement).videoHeight;
  }
  return (image as { height: number }).height;
}
