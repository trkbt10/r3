/**
 * @file Tween — exercises the property-tween scheduler against a
 * synthetic target object. WebGL is irrelevant; the manager only
 * mutates plain numeric fields, so these tests run headless.
 */

import { TweenManager } from "./Tween.ts";

/** Minimal call-tracking helper used in place of vi.fn (banned). */
function makeCounter(): { fn: () => void; calls: number } {
  const state = { calls: 0 };
  return {
    get calls(): number {
      return state.calls;
    },
    fn(): void {
      state.calls += 1;
    },
  };
}

describe("TweenManager", () => {
  it("interpolates a numeric property to its destination over the duration", () => {
    const target = { alpha: 0, scale: 1 };
    const mgr = new TweenManager();
    mgr.add({
      targets: target,
      duration: 100,
      alpha: 1,
      scale: 2,
      ease: "Linear",
    });
    mgr.advance(50); // half-way
    expect(target.alpha).toBeCloseTo(0.5, 5);
    expect(target.scale).toBeCloseTo(1.5, 5);
    mgr.advance(50); // done
    expect(target.alpha).toBeCloseTo(1, 5);
    expect(target.scale).toBeCloseTo(2, 5);
  });

  it("delays the start by `delay` ms before any property mutates", () => {
    const target = { x: 0 };
    const mgr = new TweenManager();
    mgr.add({
      targets: target,
      duration: 100,
      delay: 50,
      x: 100,
      ease: "Linear",
    });
    mgr.advance(40);
    expect(target.x).toBe(0);
    mgr.advance(20); // delay expires after 10ms; tween advances 10ms further (10/100)
    expect(target.x).toBeCloseTo(10, 5);
    mgr.advance(90);
    expect(target.x).toBeCloseTo(100, 5);
  });

  it("fires onComplete exactly once after the final tick", () => {
    const target = { x: 0 };
    const counter = makeCounter();
    const mgr = new TweenManager();
    mgr.add({
      targets: target,
      duration: 50,
      x: 10,
      onComplete: counter.fn,
      ease: "Linear",
    });
    mgr.advance(25);
    expect(counter.calls).toBe(0);
    mgr.advance(25);
    expect(counter.calls).toBe(1);
    // After completion the manager drops the tween.
    expect(mgr.activeCount).toBe(0);
  });

  it("yoyo runs forward then back to origin", () => {
    const target = { y: 0 };
    const mgr = new TweenManager();
    mgr.add({
      targets: target,
      duration: 100,
      y: 100,
      yoyo: true,
      ease: "Linear",
    });
    mgr.advance(100); // forward leg done; values at end value
    expect(target.y).toBeCloseTo(100, 5);
    mgr.advance(100); // return leg done; back to start
    expect(target.y).toBeCloseTo(0, 5);
    expect(mgr.activeCount).toBe(0);
  });

  it("killTweensOf drops tweens for the given target without firing onComplete", () => {
    const target = { x: 0 };
    const counter = makeCounter();
    const mgr = new TweenManager();
    mgr.add({
      targets: target,
      duration: 100,
      x: 100,
      onComplete: counter.fn,
      ease: "Linear",
    });
    mgr.advance(40);
    mgr.killTweensOf(target);
    mgr.advance(100);
    expect(counter.calls).toBe(0);
    expect(mgr.activeCount).toBe(0);
  });

  it("respects the eased curve when ease is non-linear", () => {
    const target = { v: 0 };
    const mgr = new TweenManager();
    mgr.add({
      targets: target,
      duration: 100,
      v: 1,
      ease: "Quad.easeIn", // f(t) = t^2
    });
    mgr.advance(50);
    expect(target.v).toBeCloseTo(0.25, 5);
  });

  it("from/to overrides start the tween at `from`", () => {
    const target = { x: 999 };
    const mgr = new TweenManager();
    mgr.add({
      targets: target,
      duration: 100,
      x: { from: 0, to: 100 },
      ease: "Linear",
    });
    mgr.advance(0); // first tick latches start
    expect(target.x).toBeCloseTo(0, 5);
    mgr.advance(50);
    expect(target.x).toBeCloseTo(50, 5);
  });

  it("repeat: -1 keeps the tween alive across many cycles", () => {
    const target = { x: 0 };
    const counter = makeCounter();
    const mgr = new TweenManager();
    mgr.add({
      targets: target,
      duration: 50,
      x: 10,
      repeat: -1,
      ease: "Linear",
      onUpdate: counter.fn,
    });
    // Advance enough to span many cycles. The tween must still be
    // active throughout — a regression that drops infinite tweens
    // after the first play would leave activeCount == 0 and the
    // counter at exactly 1.
    for (let i = 0; i < 30; i++) {
      mgr.advance(50);
    }
    expect(mgr.activeCount).toBe(1);
    expect(counter.calls).toBeGreaterThan(20);
  });

  it("animates multiple targets with the same config", () => {
    const a = { x: 0 };
    const b = { x: 0 };
    const mgr = new TweenManager();
    mgr.add({
      targets: [a, b],
      duration: 100,
      x: 50,
      ease: "Linear",
    });
    mgr.advance(100);
    expect(a.x).toBeCloseTo(50, 5);
    expect(b.x).toBeCloseTo(50, 5);
  });
});
