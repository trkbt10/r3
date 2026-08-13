/**
 * @file Image — textured rectangle backed by an HTMLImageElement or
 * a Three texture.
 *
 * Serves as the r3 replacement for `scene.add.image(x, y, key)`. The
 * source can be:
 *
 *  - an {@link HTMLImageElement} (typically from {@link AssetLoader})
 *  - a pre-built {@link Three.Texture} (for subclasses that do their
 *    own rasterisation — e.g. SkillIcon)
 *
 * Display size: `options.width/height` override the source's intrinsic
 * size; leaving them out falls back to `image.naturalWidth` /
 * `naturalHeight` (available after load). The node will re-layout if
 * the image is still loading when constructed — the caller can pass
 * a `loaded` image or subscribe and call `invalidate()`.
 */

import {
  BufferAttribute,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
  type Plane,
  type Wrapping,
} from "three";
import { Node, type NodeOptions } from "./Node.ts";
import {
  type TextureCanvas,
  type TextureManager,
} from "./texture-canvas";

export type ImageSource =
  | { readonly kind: "element"; readonly element: HTMLImageElement }
  | { readonly kind: "canvas"; readonly canvas: TextureCanvas }
  | { readonly kind: "texture"; readonly texture: Texture };

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
export class R3Image extends Node {
  protected _width: number;
  protected _height: number;
  protected _tint: number;

  protected texture: Texture;
  /** True when we own the texture (must dispose on destroy). */
  private ownsTexture: boolean;
  private readonly releasesCanvasSources: boolean;
  private readonly textureManager: TextureManager;
  private readonly wrap: Wrapping | undefined;
  private readonly geometry: PlaneGeometry;
  private textureCrop: ImageTextureCrop;
  private textureLowerFade: ImageTextureLowerFade | null;
  protected readonly material: MeshBasicMaterial;
  protected readonly mesh: Mesh;

  constructor(options: ImageOptions) {
    super(options);
    validateCanvasReleasePolicy(options);
    const intrinsic = intrinsicSizeFor(options.source);
    this._width = options.width ?? intrinsic.width;
    this._height = options.height ?? intrinsic.height;
    this._tint = options.tint ?? 0xffffff;

    const releasesCanvasSources = options.releaseCanvasOnDestroy === true;
    const textureManager = options.textureManager;
    const { texture, owns } = buildTexture(
      options.source,
      releasesCanvasSources,
      textureManager,
    );
    this.texture = texture;
    this.ownsTexture = owns;
    this.releasesCanvasSources = releasesCanvasSources;
    this.textureManager = textureManager;
    this.wrap = options.wrap;
    this.textureCrop = normalizeTextureCrop(options.textureCrop);
    this.textureLowerFade = normalizeTextureLowerFade(options.textureLowerFade);
    configureTexture(this.texture, this.wrap);

    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    configureTextureLowerFadeMaterial(this.material, () => textureLowerFadeUniforms(
      this.textureCrop,
      this.textureLowerFade,
    ));
    this.material.color.setHex(this._tint);
    this.geometry = new PlaneGeometry(1, 1);
    applyTextureCropToGeometry(this.geometry, this.textureCrop);
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.obj3d.add(this.mesh);

    this.mesh.scale.set(Math.max(1, this._width), Math.max(1, this._height), 1);
    this.applyMeshOffset();

    if (options.interactive === true) {
      this.setInteractive(this.computeAutoHitArea());
    }
  }

  /**
   * Pivot-aware auto hit-area. With pivot (0.5, 0.5) the visible
   * mesh is centred on the node origin, so the hit rectangle has to
   * be shifted to (-w/2, -h/2) to keep clicks landing on the visible
   * texture. See Rect.computeAutoHitArea for the same fix-up.
   *
   * `|| 0` normalises the signed-zero that `-0 * w` returns when
   * pivot is exactly 0 (kept in sync with Rect).
   */
  private computeAutoHitArea(): { x: number; y: number; width: number; height: number } {
    return {
      x: -this._pivotX * this._width || 0,
      y: -this._pivotY * this._height || 0,
      width: this._width,
      height: this._height,
    };
  }

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
    this.mesh.scale.set(Math.max(1, width), Math.max(1, height), 1);
    this.applyMeshOffset();
    if (this._hitArea) {
      this.setInteractive(this.computeAutoHitArea());
    }
    return this;
  }

  setTint(color: number): this {
    if (color === this._tint) {
      return this;
    }
    this._tint = color;
    this.material.color.setHex(color);
    return this;
  }

  /**
   * Forces the GPU texture to re-upload from its source canvas/
   * element. Call after writing to the source canvas, or after an
   * image finishes loading post-construction.
   */
  invalidateTexture(): this {
    this.texture.needsUpdate = true;
    return this;
  }

  /**
   * Replaces a canvas-backed texture with a fresh CanvasTexture.
   *
   * Use this instead of resizing a canvas that is already bound to the
   * current texture. Chrome's WebGL copy path can otherwise attempt a
   * sub-texture upload against the old dimensions and emit
   * `glCopySubTextureCHROMIUM: Offset overflows texture dimensions`.
   */
  replaceCanvasSource(canvas: TextureCanvas): this {
    const next = createImageCanvasTexture(
      canvas,
      this.releasesCanvasSources,
      this.textureManager,
    );
    this.replaceTexture(next, true);
    return this;
  }

  replaceElementSource(element: HTMLImageElement): this {
    const next = new Texture(element);
    next.needsUpdate = true;
    this.replaceTexture(next, true);
    return this;
  }

  setTextureCrop(crop: ImageTextureCrop | undefined): this {
    const next = normalizeTextureCrop(crop);
    if (
      next.x === this.textureCrop.x &&
      next.y === this.textureCrop.y &&
      next.width === this.textureCrop.width &&
      next.height === this.textureCrop.height
    ) {
      return this;
    }
    this.textureCrop = next;
    applyTextureCropToGeometry(this.geometry, this.textureCrop);
    this.material.needsUpdate = true;
    return this;
  }

  setTextureLowerFade(fade: ImageTextureLowerFade | undefined): this {
    const next = normalizeTextureLowerFade(fade);
    if (next?.startY === this.textureLowerFade?.startY) {
      return this;
    }
    this.textureLowerFade = next;
    this.material.needsUpdate = true;
    return this;
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
    const texture = this.texture;
    const ownsTexture = this.ownsTexture;
    this.material.map = null;
    this.material.needsUpdate = true;
    this.material.dispose();
    disposeTextureIfOwned(texture, ownsTexture);
    this.geometry.dispose();
    super.destroy();
  }

  private replaceTexture(next: Texture, ownsNext: boolean): void {
    const previous = this.texture;
    const ownedPrevious = this.ownsTexture;
    this.texture = next;
    this.ownsTexture = ownsNext;
    configureTexture(this.texture, this.wrap);
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    this.texture.needsUpdate = true;
    disposeTextureIfOwned(previous, ownedPrevious);
  }
}

function disposeTextureIfOwned(texture: Texture, ownsTexture: boolean): void {
  if (!ownsTexture) {
    return;
  }
  texture.dispose();
}

function validateCanvasReleasePolicy(options: ImageOptions): void {
  if (options.releaseCanvasOnDestroy !== true) {
    return;
  }
  if (options.source.kind !== "canvas") {
    throw new Error(
      "R3Image: releaseCanvasOnDestroy requires a canvas source owned by the image.",
    );
  }
}

function intrinsicSizeFor(source: ImageSource): { width: number; height: number } {
  if (source.kind === "element") {
    const w = source.element.naturalWidth || source.element.width || 1;
    const h = source.element.naturalHeight || source.element.height || 1;
    return { width: w, height: h };
  }
  if (source.kind === "canvas") {
    return { width: source.canvas.width, height: source.canvas.height };
  }
  const texture = source.texture;
  const image = texture.image as
    | { readonly width?: number; readonly height?: number }
    | null
    | undefined;
  return {
    width: image?.width ?? 1,
    height: image?.height ?? 1,
  };
}

function buildTexture(
  source: ImageSource,
  releaseCanvasOnDestroy: boolean,
  textureManager: TextureManager,
): { texture: Texture; owns: boolean } {
  if (source.kind === "texture") {
    return { texture: source.texture, owns: false };
  }
  if (source.kind === "canvas") {
    return {
      texture: createImageCanvasTexture(
        source.canvas,
        releaseCanvasOnDestroy,
        textureManager,
      ),
      owns: true,
    };
  }
  // `new Texture(element)` supports an HTMLImageElement; we must set
  // needsUpdate so the first frame uploads the pixels.
  const tex = new Texture(source.element);
  tex.needsUpdate = true;
  return { texture: tex, owns: true };
}

function createImageCanvasTexture(
  canvas: TextureCanvas,
  releaseCanvasOnDestroy: boolean,
  textureManager: TextureManager,
): Texture {
  if (releaseCanvasOnDestroy) {
    return textureManager.createOwnedCanvasTexture(canvas);
  }
  return textureManager.createBorrowedCanvasTexture(canvas);
}

function configureTexture(texture: Texture, wrap: Wrapping | undefined): void {
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  if (wrap !== undefined) {
    texture.wrapS = wrap;
    texture.wrapT = wrap;
  }
}

function configureTextureLowerFadeMaterial(
  material: MeshBasicMaterial,
  uniformsForFrame: () => { readonly startV: number; readonly endV: number },
): void {
  material.onBeforeCompile = (shader: {
    readonly uniforms: Record<string, { value: number }>;
    fragmentShader: string;
  }): void => {
    shader.uniforms.uR3TextureLowerFadeStartV = { value: -1 };
    shader.uniforms.uR3TextureLowerFadeEndV = { value: -1 };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uR3TextureLowerFadeStartV;\nuniform float uR3TextureLowerFadeEndV;",
      )
      .replace(
        "#include <alphamap_fragment>",
        "#include <alphamap_fragment>\nif (uR3TextureLowerFadeStartV >= 0.0) {\n  float r3LowerFadeAlpha = smoothstep(uR3TextureLowerFadeEndV, uR3TextureLowerFadeStartV, vMapUv.y);\n  diffuseColor.a *= r3LowerFadeAlpha;\n}",
      );
    material.userData.r3TextureLowerFadeUniforms = shader.uniforms;
  };
  material.onBeforeRender = (): void => {
    const uniforms = material.userData.r3TextureLowerFadeUniforms as
      | {
          readonly uR3TextureLowerFadeStartV?: { value: number };
          readonly uR3TextureLowerFadeEndV?: { value: number };
        }
      | undefined;
    if (!uniforms?.uR3TextureLowerFadeStartV || !uniforms.uR3TextureLowerFadeEndV) {
      return;
    }
    const next = uniformsForFrame();
    uniforms.uR3TextureLowerFadeStartV.value = next.startV;
    uniforms.uR3TextureLowerFadeEndV.value = next.endV;
  };
  material.customProgramCacheKey = () => "r3-image-texture-lower-fade-v1";
}






/** Return texture lower fade uniforms. */
export function textureLowerFadeUniforms(
  crop: ImageTextureCrop,
  fade: ImageTextureLowerFade | null,
): { readonly startV: number; readonly endV: number } {
  if (!fade) {
    return { startV: -1, endV: -1 };
  }
  const top = 1 - crop.y;
  const bottom = 1 - crop.y - crop.height;
  return {
    startV: top - crop.height * fade.startY,
    endV: bottom,
  };
}

function normalizeTextureCrop(crop: ImageTextureCrop | undefined): ImageTextureCrop {
  if (!crop) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  const x = clampRatio(crop.x);
  const y = clampRatio(crop.y);
  const width = Math.max(0.01, Math.min(clampRatio(crop.width), 1 - x));
  const height = Math.max(0.01, Math.min(clampRatio(crop.height), 1 - y));
  return { x, y, width, height };
}

function normalizeTextureLowerFade(fade: ImageTextureLowerFade | undefined): ImageTextureLowerFade | null {
  if (!fade) {
    return null;
  }
  return { startY: clampRatio(fade.startY) };
}

function applyTextureCropToGeometry(geometry: PlaneGeometry, crop: ImageTextureCrop): void {
  const left = crop.x;
  const right = crop.x + crop.width;
  const top = 1 - crop.y;
  const bottom = 1 - crop.y - crop.height;
  geometry.setAttribute(
    "uv",
    new BufferAttribute(new Float32Array([
      left,
      top,
      right,
      top,
      left,
      bottom,
      right,
      bottom,
    ]), 2),
  );
  const uv = geometry.getAttribute("uv");
  uv.needsUpdate = true;
}

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}
