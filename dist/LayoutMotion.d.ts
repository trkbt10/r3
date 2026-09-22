import { Container, ContainerOptions } from './Container.ts';
import { EasingFn, EasingName } from './Easing.ts';
import { Rect } from './Node.ts';
import { TweenManager } from './Tween.ts';
/** R3LayoutRoot provides the R3LayoutRoot API. */
export declare class R3LayoutRoot extends Container {
    readonly r3TransformRole = "layout-root";
}
/** R3MotionRoot provides the R3MotionRoot API. */
export declare class R3MotionRoot extends Container {
    readonly r3TransformRole = "motion-root";
}
export type R3CenteredMotionSurfaceOptions = {
    /** Anchor X of the surface rectangle in stage-logical pixels. */
    readonly x: number;
    /** Anchor Y of the surface rectangle in stage-logical pixels. */
    readonly y: number;
    readonly width: number;
    readonly height: number;
    /** Anchor origin within the rect. Defaults to centre. */
    readonly originX?: number;
    /** Anchor origin within the rect. Defaults to centre. */
    readonly originY?: number;
    readonly name?: string;
    readonly pivotName?: string;
    readonly contentName?: string;
};
export type R3MotionSurface = {
    readonly root: R3LayoutRoot;
    readonly pivot: R3MotionRoot;
    /**
     * Content coordinate root whose (0, 0) is the visual rect's
     * top-left. Attach existing top-left-layout children here; attach
     * centre-local children directly to `pivot`.
     */
    readonly content: R3MotionRoot;
    readonly setRect: (x: number, y: number, width: number, height: number) => void;
    readonly getRect: () => Rect;
    /** Visual rect in pivot-local coordinates. */
    readonly localRect: () => Rect;
};
export type R3CenteredMotionSurface = R3MotionSurface;
/** createR3LayoutRoot provides the createR3LayoutRoot API. */
export declare function createR3LayoutRoot(options?: ContainerOptions): R3LayoutRoot;
/** createR3MotionRoot provides the createR3MotionRoot API. */
export declare function createR3MotionRoot(options?: ContainerOptions): R3MotionRoot;
/**
 * Creates the standard r3 composition for an interactive surface:
 *
 *   layout root at the visual centre
 *     -> motion root at (0, 0)
 *        -> visual children in centre-local coordinates
 *
 * Layout code moves/resizes `root`; interaction animation scales
 * `pivot`. This makes centre-origin press feedback the default for
 * buttons without changing `Node.setScale` semantics globally.
 */
export declare function createR3MotionSurface(options: R3CenteredMotionSurfaceOptions): R3MotionSurface;
/** Convenience wrapper for the common centre-anchored motion surface. */
export declare function createR3CenteredMotionSurface(options: R3CenteredMotionSurfaceOptions): R3CenteredMotionSurface;
export type R3MotionScaleTweenOptions = {
    readonly scale: number;
    readonly durationMs: number;
    readonly ease?: EasingName | EasingFn;
    readonly yoyo?: boolean;
};
export type R3MotionPressPulseOptions = {
    readonly scale?: number;
    readonly durationMs?: number;
    readonly ease?: EasingName | EasingFn;
};
export type R3MotionRejectShakeOptions = {
    readonly amplitude?: number;
    readonly segmentMs?: number;
    readonly repeats?: number;
    readonly ease?: EasingName | EasingFn;
    readonly onComplete?: () => void;
};
/** Animates a motion root's scale. Layout roots are intentionally not accepted. */
export declare function tweenR3MotionScale(target: R3MotionRoot, tweens: TweenManager | undefined, options: R3MotionScaleTweenOptions): void;
/** Restores an r3 motion root to its neutral cosmetic transform. */
export declare function resetR3MotionRoot(target: R3MotionRoot): void;
/** Standard r3 press pulse for interactive surfaces. */
export declare function playR3MotionPressPulse(target: R3MotionRoot, tweens: TweenManager | undefined, options?: R3MotionPressPulseOptions): void;
/** Standard r3 reject shake for interactive surfaces. */
export declare function playR3MotionRejectShake(target: R3MotionRoot, tweens: TweenManager, options?: R3MotionRejectShakeOptions): void;
