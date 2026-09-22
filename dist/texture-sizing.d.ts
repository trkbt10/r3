/**
 * @file Texture sizing helpers for canvas-backed r3 textures.
 *
 * CanvasTexture upload stability depends on two things:
 *
 *   1. Every generated bitmap has explicit, integer physical pixel
 *      dimensions derived from the app's UI texture resolution policy.
 *   2. Callers that choose a rounded backing size draw through a
 *      matching Canvas2D transform, so the logical content fills the
 *      whole texture instead of leaving a 1px transparent edge.
 *
 * This module centralises that math so Text, Rect, Graphics and future
 * canvas-baked surfaces use the same DPR + 2n rounding rules.
 */
export type TexturePixelRounding = "integer" | "even" | "power-of-two";
export type TexturePixelSize = {
    readonly width: number;
    readonly height: number;
};
export type TextureCanvasScale = {
    readonly x: number;
    readonly y: number;
};
export type TexturePixelSizeInput = {
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly pixelRatio: number;
    /**
     * - "integer": ceil to a positive integer.
     * - "even": ceil to a positive even integer (`2n` rounding).
     * - "power-of-two": ceil to the next power of two. Use only when the
     *   caller owns UVs / repeat semantics; most UI surfaces should use
     *   "even" to avoid waste.
     */
    readonly rounding?: TexturePixelRounding;
    /** Optional hard cap for defensive memory bounding. */
    readonly maxTextureSize?: number;
};
/**
 * Resolves the current UI texture pixel ratio through r3's graphics
 * policy. Safe to call before the host calls
 * {@link "./graphics-policy/index.ts".configureR3GraphicsPolicy} —
 * the policy module ships DPR-following defaults.
 */
export declare function resolveCurrentUiTexturePixelRatio(): number;
/** Resolves logical dimensions + pixel ratio into physical texture pixels. */
export declare function resolveTexturePixelSize(input: TexturePixelSizeInput): TexturePixelSize;
/** Computes the Canvas2D scale that maps logical drawing units to the full backing texture. */
export declare function textureCanvasScaleFor(logicalWidth: number, logicalHeight: number, pixelSize: TexturePixelSize): TextureCanvasScale;
