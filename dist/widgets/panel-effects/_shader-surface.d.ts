import { ShaderMaterial, Blending, IUniform, Plane } from 'three';
import { Node, NodeOptions } from '../../Node.ts';
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
export declare class ShaderSurfaceNode extends Node {
    private _width;
    private _height;
    private readonly geometry;
    readonly material: ShaderMaterial;
    private readonly mesh;
    /** Seconds since mount — advanced by {@link tick}. Exposed via `uTime`. */
    private _elapsed;
    constructor(options: ShaderSurfaceOptions);
    get width(): number;
    get height(): number;
    /** Updates a specific uniform's `.value`. No-op when the uniform isn't declared. */
    setUniform(name: string, value: unknown): this;
    /**
     * Resizes the plane to new logical dimensions. `uSize` is refreshed
     * so shaders that scale edges to pixels stay pixel-accurate. Pivot
     * offset is re-derived so the top-left alignment stays correct.
     */
    setSize(width: number, height: number): this;
    /**
     * Advances the shader clock. The owner — typically the plaque's
     * `tick` fan-out — calls this each frame with a delta in seconds.
     * Effects that want a time-varying shader read `uTime` in the
     * fragment source.
     */
    tick(dtSeconds: number): void;
    /** Current elapsed seconds. Useful for effects that phase-offset from their neighbours. */
    get elapsed(): number;
    protected applyMaterialAlpha(alpha: number): void;
    protected assignRenderOrderForSelf(counter: number, depthOffset: number): number;
    setClippingPlanes(planes: readonly Plane[] | null): void;
    /**
     * Positions the visible mesh inside the Node's local frame so the
     * Node's logical top-left (0, 0) sits at the top-left of the
     * rendered quad — same convention as {@link Graphics.applyMeshOffset}.
     * Subclasses / pivot changes re-run this.
     */
    private applyMeshOffset;
    protected onPivotChanged(): void;
    destroy(): void;
}
