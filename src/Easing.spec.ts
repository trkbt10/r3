/**
 * @file Easing — boundary + monotonicity sanity checks.
 *
 * The pre-tween migration plan calls every `ease: "Foo"` Phaser uses;
 * these tests pin (a) f(0) === 0 and f(1) === 1 for every named curve
 * (so a yoyo never lands on a wrong endpoint) and (b) Back.easeOut
 * actually overshoots above 1 in its sweet spot (so a regression to a
 * monotonic curve gets caught — the visual brief leans on the bounce
 * for buttons, modal pops, etc.).
 */

import { resolveEasing, type EasingName } from "./Easing.ts";

/**
 * Wrapper that accepts any string at the runtime boundary so the
 * "unknown easing name throws" test can pass an off-registry value
 * without needing an `as` cast at the call site (the lint config
 * bans `as` outside type guards).
 */
function tryResolve(name: string): void {
  resolveEasing(name as EasingName);
}

const NAMES: EasingName[] = [
  "Linear",
  "Linear.None",
  "Quad.easeIn",
  "Quad.easeOut",
  "Quad.easeInOut",
  "Cubic.easeIn",
  "Cubic.easeOut",
  "Cubic.easeInOut",
  "Sine.easeIn",
  "Sine.easeOut",
  "Sine.easeInOut",
  "Quint.easeIn",
  "Quint.easeOut",
  "Quint.easeInOut",
  "Back.easeIn",
  "Back.easeOut",
  "Back.easeInOut",
];

describe("Easing", () => {
  it("resolves every registered name", () => {
    for (const name of NAMES) {
      const fn = resolveEasing(name);
      expect(typeof fn).toBe("function");
    }
  });

  it("anchors every curve at f(0)=0 and f(1)=1", () => {
    for (const name of NAMES) {
      const fn = resolveEasing(name);
      expect(fn(0)).toBeCloseTo(0, 6);
      expect(fn(1)).toBeCloseTo(1, 6);
    }
  });

  it("Back.easeOut overshoots above 1 in its overshoot zone", () => {
    const fn = resolveEasing("Back.easeOut");
    // Around t=0.7 the back-out curve sits comfortably above 1.
    const peak = Math.max(fn(0.65), fn(0.7), fn(0.75));
    expect(peak).toBeGreaterThan(1);
  });

  it("throws on an unknown name to surface wiring bugs", () => {
    expect(() => tryResolve("Bogus.easeFoo")).toThrow(/unknown easing/);
  });

  it("passes a function through unchanged", () => {
    const f = (t: number): number => t * 2;
    expect(resolveEasing(f)).toBe(f);
  });

  it("Quad/Cubic/Quint InOut curves are monotonically increasing", () => {
    const monoNames: EasingName[] = [
      "Quad.easeIn",
      "Quad.easeOut",
      "Quad.easeInOut",
      "Cubic.easeIn",
      "Cubic.easeOut",
      "Cubic.easeInOut",
      "Quint.easeIn",
      "Quint.easeOut",
      "Quint.easeInOut",
      "Sine.easeIn",
      "Sine.easeOut",
      "Sine.easeInOut",
    ];
    for (const name of monoNames) {
      const fn = resolveEasing(name);
      const samples: number[] = [];
      for (let i = 0; i <= 20; i++) {
        samples.push(fn(i / 20));
      }
      for (let i = 1; i < samples.length; i++) {
        const prev = samples[i - 1];
        const curr = samples[i];
        if (prev === undefined || curr === undefined) {
          throw new Error("unreachable: sample range is fixed");
        }
        expect(curr).toBeGreaterThanOrEqual(prev - 1e-9);
      }
    }
  });
});
