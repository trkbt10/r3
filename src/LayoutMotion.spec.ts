/**
 * @file Layout/motion transform-role helpers.
 */

import { TweenManager } from "./Tween.ts";
import {
  createR3CenteredMotionSurface,
  createR3MotionSurface,
  playR3MotionPressPulse,
  playR3MotionRejectShake,
  tweenR3MotionScale,
} from "./LayoutMotion.ts";

describe("createR3CenteredMotionSurface", () => {
  it("keeps layout placement and motion scale on separate roots", () => {
    const surface = createR3CenteredMotionSurface({
      x: 120,
      y: 80,
      width: 200,
      height: 60,
      name: "test:surface",
    });

    expect(surface.root.r3TransformRole).toBe("layout-root");
    expect(surface.pivot.r3TransformRole).toBe("motion-root");
    expect(surface.root.children).toEqual([surface.pivot]);
    expect(surface.pivot.children).toEqual([surface.content]);
    expect(surface.getRect()).toEqual({ x: 20, y: 50, width: 200, height: 60 });
    expect(surface.localRect()).toEqual({ x: -100, y: -30, width: 200, height: 60 });

    surface.setRect(300, 200, 160, 44);

    expect(surface.root.x).toBe(380);
    expect(surface.root.y).toBe(222);
    expect(surface.pivot.x).toBe(0);
    expect(surface.pivot.y).toBe(0);
    expect(surface.localRect()).toEqual({ x: -80, y: -22, width: 160, height: 44 });
  });

  it("only accepts a motion root for scale animation", () => {
    const surface = createR3CenteredMotionSurface({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    });
    const tweens = new TweenManager();

    tweenR3MotionScale(surface.pivot, tweens, {
      scale: 0.96,
      durationMs: 100,
    });
    tweens.advance(0);
    tweens.advance(100);

    expect(surface.root.scaleX).toBe(1);
    expect(surface.root.scaleY).toBe(1);
    expect(surface.pivot.scaleX).toBeCloseTo(0.96);
    expect(surface.pivot.scaleY).toBeCloseTo(0.96);
  });

  it("runs standard press pulse on the motion root", () => {
    const surface = createR3CenteredMotionSurface({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    });
    const tweens = new TweenManager();

    surface.pivot.setScale(0.5);
    playR3MotionPressPulse(surface.pivot, tweens, {
      scale: 0.9,
      durationMs: 80,
    });
    tweens.advance(0);
    tweens.advance(20);
    tweens.advance(20);
    tweens.advance(20);
    tweens.advance(20);

    expect(surface.root.scaleX).toBe(1);
    expect(surface.pivot.scaleX).toBeCloseTo(0.9);

    tweens.advance(1_000);

    expect(surface.pivot.scaleX).toBeCloseTo(1);
  });

  it("runs standard reject shake and restores neutral position", () => {
    const surface = createR3CenteredMotionSurface({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    });
    const tweens = new TweenManager();

    playR3MotionRejectShake(surface.pivot, tweens, {
      amplitude: 6,
      segmentMs: 20,
      repeats: 0,
    });
    tweens.advance(0);
    tweens.advance(20);
    tweens.advance(20);

    expect(surface.root.x).toBe(0);
    expect(surface.pivot.x).toBe(0);
    expect(surface.pivot.y).toBe(0);
  });

  it("uses origin to support non-centre layout anchors with centre motion pivots", () => {
    const surface = createR3MotionSurface({
      x: 20,
      y: 30,
      width: 200,
      height: 60,
      originX: 0,
      originY: 0,
      name: "test:top-left",
    });

    expect(surface.getRect()).toEqual({ x: 20, y: 30, width: 200, height: 60 });
    expect(surface.pivot.x).toBe(100);
    expect(surface.pivot.y).toBe(30);
    expect(surface.content.x).toBe(-100);
    expect(surface.content.y).toBe(-30);
    expect(surface.localRect()).toEqual({ x: -100, y: -30, width: 200, height: 60 });

    surface.setRect(10, 12, 80, 44);

    expect(surface.root.x).toBe(10);
    expect(surface.root.y).toBe(12);
    expect(surface.pivot.x).toBe(40);
    expect(surface.pivot.y).toBe(22);
    expect(surface.content.x).toBe(-40);
    expect(surface.content.y).toBe(-22);
  });

  it("uses the same origin mechanism for right and bottom anchors", () => {
    const surface = createR3MotionSurface({
      x: 220,
      y: 90,
      width: 200,
      height: 60,
      originX: 1,
      originY: 1,
    });

    expect(surface.getRect()).toEqual({ x: 20, y: 30, width: 200, height: 60 });
    expect(surface.pivot.x).toBe(-100);
    expect(surface.pivot.y).toBe(-30);

    surface.setRect(10, 12, 80, 44);

    expect(surface.root.x).toBe(90);
    expect(surface.root.y).toBe(56);
    expect(surface.pivot.x).toBe(-40);
    expect(surface.pivot.y).toBe(-22);
    expect(surface.getRect()).toEqual({ x: 10, y: 12, width: 80, height: 44 });
  });
});
