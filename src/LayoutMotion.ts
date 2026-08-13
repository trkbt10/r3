/**
 * @file Layout/motion transform roles for r3 containers.
 *
 * Public widget roots are layout anchors: layout code owns their
 * position/size-derived transform. Cosmetic motion, such as press
 * pulse, reject shake, or heartbeat, belongs on an inner motion root.
 * Keeping these as explicit domain classes lets static analysis catch
 * layout-root transform motion before the app is run.
 */

import { Container, type ContainerOptions } from "./Container.ts";
import type { EasingFn, EasingName } from "./Easing.ts";
import type { Rect } from "./Node.ts";
import type { TweenManager } from "./Tween.ts";

/** R3LayoutRoot provides the R3LayoutRoot API. */
export class R3LayoutRoot extends Container {
  readonly r3TransformRole = "layout-root";
}

/** R3MotionRoot provides the R3MotionRoot API. */
export class R3MotionRoot extends Container {
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
export function createR3LayoutRoot(options: ContainerOptions = {}): R3LayoutRoot {
  return new R3LayoutRoot(options);
}

/** createR3MotionRoot provides the createR3MotionRoot API. */
export function createR3MotionRoot(options: ContainerOptions = {}): R3MotionRoot {
  return new R3MotionRoot(options);
}

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
export function createR3MotionSurface(
  options: R3CenteredMotionSurfaceOptions,
): R3MotionSurface {
  const originX = options.originX ?? 0.5;
  const originY = options.originY ?? 0.5;
  const geom = {
    width: options.width,
    height: options.height,
  };
  const root = createR3LayoutRoot({
    x: options.x,
    y: options.y,
    name: options.name,
  });
  const pivot = createR3MotionRoot({
    x: geom.width * (0.5 - originX),
    y: geom.height * (0.5 - originY),
    name: options.pivotName ?? (options.name ? `${options.name}:pivot` : undefined),
  });
  const content = createR3MotionRoot({
    x: -geom.width / 2,
    y: -geom.height / 2,
    name: options.contentName ?? (options.name ? `${options.name}:content` : undefined),
  });
  root.add(pivot);
  pivot.add(content);

  return {
    root,
    pivot,
    content,
    setRect(x: number, y: number, width: number, height: number): void {
      geom.width = width;
      geom.height = height;
      root.setPosition(x + width * originX, y + height * originY);
      pivot.setPosition(width * (0.5 - originX), height * (0.5 - originY));
      content.setPosition(-width / 2, -height / 2);
    },
    getRect(): Rect {
      return {
        x: root.x - geom.width * originX,
        y: root.y - geom.height * originY,
        width: geom.width,
        height: geom.height,
      };
    },
    localRect(): Rect {
      return {
        x: -geom.width / 2,
        y: -geom.height / 2,
        width: geom.width,
        height: geom.height,
      };
    },
  };
}

/** Convenience wrapper for the common centre-anchored motion surface. */
export function createR3CenteredMotionSurface(
  options: R3CenteredMotionSurfaceOptions,
): R3CenteredMotionSurface {
  return createR3MotionSurface({
    ...options,
    originX: 0.5,
    originY: 0.5,
  });
}

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
export function tweenR3MotionScale(
  target: R3MotionRoot,
  tweens: TweenManager | undefined,
  options: R3MotionScaleTweenOptions,
): void {
  if (!tweens) {
    target.setScale(options.scale);
    return;
  }
  tweens.killTweensOf(target);
  tweens.add({
    targets: target,
    scaleX: options.scale,
    scaleY: options.scale,
    duration: options.durationMs,
    yoyo: options.yoyo,
    ease: options.ease ?? "Quad.easeOut",
  });
}

/** Restores an r3 motion root to its neutral cosmetic transform. */
export function resetR3MotionRoot(target: R3MotionRoot): void {
  target.setPosition(0, 0);
  target.setScale(1);
}

/** Standard r3 press pulse for interactive surfaces. */
export function playR3MotionPressPulse(
  target: R3MotionRoot,
  tweens: TweenManager | undefined,
  options: R3MotionPressPulseOptions = {},
): void {
  const scale = options.scale ?? 0.97;
  const durationMs = options.durationMs ?? 90;
  target.setScale(1);
  tweenR3MotionScale(target, tweens, {
    scale,
    durationMs,
    yoyo: true,
    ease: options.ease ?? "Quad.easeOut",
  });
}

/** Standard r3 reject shake for interactive surfaces. */
export function playR3MotionRejectShake(
  target: R3MotionRoot,
  tweens: TweenManager,
  options: R3MotionRejectShakeOptions = {},
): void {
  const amplitude = options.amplitude ?? 5;
  const segmentMs = options.segmentMs ?? 40;
  const repeats = options.repeats ?? 3;
  tweens.killTweensOf(target);
  target.setPosition(0, 0);
  tweens.add({
    targets: target,
    x: amplitude,
    duration: segmentMs,
    yoyo: true,
    repeat: repeats,
    ease: options.ease ?? "Sine.easeInOut",
    onComplete: () => {
      target.setPosition(0, 0);
      options.onComplete?.();
    },
  });
}
