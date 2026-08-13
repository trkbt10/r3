/**
 * @file ShaderSurfaceNode — an r3 Node that draws a shader-materialed
 * quad. Serves as the shared substrate for GPU-heavy panel effects
 * (auroraGlow, lightning, plasmaOrbs) the way {@link Graphics} serves
 * the canvas-rasterised ones.
 *
 * ## Why not just use Graphics
 *
 * `Graphics` rasterises via the 2D Canvas API, uploads as a
 * {@link CanvasTexture}, and paints a flat sprite. Effects that need
 * per-pixel procedural noise, smooth smoothstep-shaped falloffs,
 * continuous animation without re-uploading pixel data, or
 * additive-blending energy-shader looks can't afford the
 * rasterise-then-upload round trip — every frame would re-pay the
 * whole canvas. Running the shading on the GPU via a
 * {@link ShaderMaterial} keeps those per-pixel computations on the
 * card and only touches a handful of scalar uniforms from JS.
 *
 * ## Convention — common uniforms
 *
 * Every shader built on this surface inherits three uniforms without
 * having to declare them explicitly:
 *
 *   - `uTime`    — elapsed seconds since the surface mounted. Advances
 *                  on {@link ShaderSurfaceNode.tick}; the owner drives
 *                  the clock.
 *   - `uSize`    — `vec2(widthPx, heightPx)` in logical pixels. Useful
 *                  for aspect-ratio-aware falloffs (e.g. stroking a
 *                  2 px rim regardless of plane shape).
 *   - `uAlpha`   — composed world alpha from the r3 tree walk. The
 *                  fragment shader is expected to multiply
 *                  `gl_FragColor.a` by this uniform so the Stage's
 *                  worldAlpha propagation actually reaches these
 *                  effects — ShaderMaterial ignores `material.opacity`.
 *
 * Fragment shaders can declare additional uniforms freely through
 * the `uniforms` option; they merge with the base three at
 * construction time.
 *
 * ## Rendering concerns
 *
 * - `transparent: true`, `depthTest: false`, `depthWrite: false` by
 *   default so these surfaces composite into the HUD like any other
 *   transparent r3 node.
 * - Blending defaults to {@link AdditiveBlending} — the typical energy-
 *   effect mode. Callers that want standard alpha blending pass
 *   `blending: NormalBlending` on construction.
 * - The mesh uses a unit PlaneGeometry scaled by logical (width,
 *   height). `vUv` in the fragment shader ranges 0..1 across the
 *   full panel rect — same convention board3d effects use.
 */

import {
  AdditiveBlending,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  type Blending,
  type IUniform,
  type Plane,
} from "three";
import { Node, type NodeOptions } from "../../Node.ts";

const DEFAULT_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export type ShaderSurfaceUniforms = Record<string, IUniform>;

export type ShaderSurfaceOptions = NodeOptions & {
  readonly width: number;
  readonly height: number;
  /** Fragment shader source. `vUv`, `uTime`, `uSize`, `uAlpha` are in scope. */
  readonly fragmentShader: string;
  /** Optional vertex shader override. Defaults to a straight-through UV pass. */
  readonly vertexShader?: string;
  /**
   * Caller uniforms. Merged with the built-in `uTime` / `uSize` /
   * `uAlpha` — the surface owns those keys, caller-supplied values
   * for them are overwritten.
   */
  readonly uniforms?: ShaderSurfaceUniforms;
  /** Three.js blending mode. Defaults to additive (energy look). */
  readonly blending?: Blending;
  /** Default `true`. Set `false` for opaque passes. */
  readonly transparent?: boolean;
  /** Default `false` — UI order, not depth-order, for compositing. */
  readonly depthTest?: boolean;
  /** Default `false`. */
  readonly depthWrite?: boolean;
};

/**
 * r3 Node whose visible mesh is a full-panel plane shaded by a
 * custom fragment shader. Mirrors {@link Graphics}'s node integration
 * (pivot, render order, world alpha) but runs the paint on the GPU.
 */
export class ShaderSurfaceNode extends Node {
  private _width: number;
  private _height: number;
  private readonly geometry: PlaneGeometry;
  readonly material: ShaderMaterial;
  private readonly mesh: Mesh;
  /** Seconds since mount — advanced by {@link tick}. Exposed via `uTime`. */
  private _elapsed: number;

  constructor(options: ShaderSurfaceOptions) {
    super(options);
    this._width = options.width;
    this._height = options.height;
    this._elapsed = 0;

    const uniforms: ShaderSurfaceUniforms = { ...(options.uniforms ?? {}) };
    uniforms.uTime = { value: 0 };
    uniforms.uSize = {
      value: new Vector2(options.width, options.height),
    };
    uniforms.uAlpha = { value: this.alpha };

    this.material = new ShaderMaterial({
      vertexShader: options.vertexShader ?? DEFAULT_VERTEX_SHADER,
      fragmentShader: options.fragmentShader,
      uniforms,
      transparent: options.transparent ?? true,
      depthTest: options.depthTest ?? false,
      depthWrite: options.depthWrite ?? false,
      blending: options.blending ?? AdditiveBlending,
    });

    this.geometry = new PlaneGeometry(1, 1);
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.scale.set(this._width, this._height, 1);
    this.obj3d.add(this.mesh);
    this.applyMeshOffset();
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  /** Updates a specific uniform's `.value`. No-op when the uniform isn't declared. */
  setUniform(name: string, value: unknown): this {
    const u = this.material.uniforms[name];
    if (!u) {
      return this;
    }
    u.value = value;
    return this;
  }

  /**
   * Resizes the plane to new logical dimensions. `uSize` is refreshed
   * so shaders that scale edges to pixels stay pixel-accurate. Pivot
   * offset is re-derived so the top-left alignment stays correct.
   */
  setSize(width: number, height: number): this {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    if (w === this._width && h === this._height) {
      return this;
    }
    this._width = w;
    this._height = h;
    this.mesh.scale.set(w, h, 1);
    const uSize = this.material.uniforms.uSize;
    if (uSize) {
      const vec = uSize.value as Vector2;
      vec.set(w, h);
    }
    this.applyMeshOffset();
    return this;
  }

  /**
   * Advances the shader clock. The owner — typically the plaque's
   * `tick` fan-out — calls this each frame with a delta in seconds.
   * Effects that want a time-varying shader read `uTime` in the
   * fragment source.
   */
  tick(dtSeconds: number): void {
    this._elapsed += dtSeconds;
    const u = this.material.uniforms.uTime;
    if (u) {
      u.value = this._elapsed;
    }
  }

  /** Current elapsed seconds. Useful for effects that phase-offset from their neighbours. */
  get elapsed(): number {
    return this._elapsed;
  }

  protected override applyMaterialAlpha(alpha: number): void {
    // ShaderMaterial doesn't hook `.opacity` automatically — the
    // fragment shader has to sample a uniform. The surface pushes
    // the world alpha into `uAlpha`; shaders multiply their output
    // alpha by it.
    const u = this.material.uniforms.uAlpha;
    if (u) {
      u.value = alpha;
    }
  }

  protected override assignRenderOrderForSelf(
    counter: number,
    depthOffset: number,
  ): number {
    this.mesh.renderOrder = depthOffset + counter;
    return counter + 1;
  }

  override setClippingPlanes(planes: readonly Plane[] | null): void {
    super.setClippingPlanes(planes);
    this.material.clippingPlanes = planes ? planes.slice() : null;
    this.material.needsUpdate = true;
  }

  /**
   * Positions the visible mesh inside the Node's local frame so the
   * Node's logical top-left (0, 0) sits at the top-left of the
   * rendered quad — same convention as {@link Graphics.applyMeshOffset}.
   * Subclasses / pivot changes re-run this.
   */
  private applyMeshOffset(): void {
    const offsetX = (0.5 - this.pivotX) * this._width;
    const offsetY = -((0.5 - this.pivotY) * this._height);
    this.mesh.position.set(offsetX, offsetY, 0);
  }

  protected override onPivotChanged(): void {
    this.applyMeshOffset();
  }

  override destroy(): void {
    this.material.dispose();
    this.geometry.dispose();
    super.destroy();
  }
}
