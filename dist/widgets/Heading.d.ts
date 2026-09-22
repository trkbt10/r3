import { R3LayoutRoot, R3MotionRoot } from '../LayoutMotion.ts';
import { TextureManager } from '../texture-canvas';
import { FontStyleSpec } from '../text-metrics.ts';
export type R3HeadingStroke = {
    readonly color: string;
    readonly width: number;
};
export type R3HeadingOptions = {
    /** Top-left X. Caller may move this later via {@link R3HeadingHandle.setRect}. */
    readonly x?: number;
    /** Top-left Y. Caller may move this later via {@link R3HeadingHandle.setRect}. */
    readonly y?: number;
    readonly text: string;
    readonly font: FontStyleSpec;
    readonly color: string;
    readonly textureManager: TextureManager;
    /** Optional outline drawn under the fill — typical for title plates. */
    readonly stroke?: R3HeadingStroke;
};
export type R3HeadingHandle = {
    /** Container the caller attaches to its scene root. */
    readonly node: R3LayoutRoot;
    /** Visual subtree for cosmetic motion; callers must keep `node` as layout SoT. */
    readonly visualNode: R3MotionRoot;
    /**
     * Intrinsic size of the rasterised text. Stable for the life of this
     * handle — call {@link setText} for content swaps, which refreshes
     * this value on the returned handle is not needed because the next
     * `setRect` keeps using the live measurement of the underlying Text.
     * Use this to author the layout-engine leaf's `width` / `height`.
     */
    readonly naturalSize: () => {
        readonly width: number;
        readonly height: number;
    };
    readonly setRect: (x: number, y: number, width: number, height: number) => void;
    readonly setText: (text: string) => void;
    readonly setFont: (font: FontStyleSpec) => void;
    readonly setColor: (color: string) => void;
    readonly setStroke: (stroke: R3HeadingStroke | null) => void;
    readonly destroy: () => void;
};
/**
 * Builds a centred-pivot Text wrapped in a Container that exposes the
 * standard `setRect` shape. The container's local origin is the
 * heading's visual centre, so attach handlers / decorations rooted on
 * `node` and they will move with the heading on resize.
 */
export declare function createR3Heading(options: R3HeadingOptions): R3HeadingHandle;
