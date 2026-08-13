/**
 * @file Easing functions used by the r3 tween system.
 *
 * Mirrors the Phaser easing names actually used in the codebase
 * (`Quad.easeOut`, `Back.easeOut`, `Quad.easeIn`, `Sine.easeInOut`,
 * `Cubic.easeInOut`, `Quint.easeOut`) so the migration of every
 * `scene.tweens.add({ ease: "X" })` call site can remain a 1:1 swap.
 *
 * Adding a new easing here is preferred over inlining a math
 * expression at the call site — keeping every `t -> t'` curve named
 * makes the visual language of the game's motion auditable in one
 * file.
 */

/** Easing function: maps progress in [0, 1] to eased progress in [0, 1]. */
export type EasingFn = (t: number) => number;

/** Linear pass-through. */
export const Linear: EasingFn = (t) => t;

/* ── Quadratic (t^2) ───────────────────────────────────────────── */

const quadIn: EasingFn = (t) => t * t;
const quadOut: EasingFn = (t) => 1 - (1 - t) * (1 - t);
const quadInOut: EasingFn = (t) => {
  if (t < 0.5) {
    return 2 * t * t;
  }
  const u = 1 - t;
  return 1 - 2 * u * u;
};

/* ── Cubic (t^3) ───────────────────────────────────────────────── */

const cubicIn: EasingFn = (t) => t * t * t;
const cubicOut: EasingFn = (t) => {
  const u = 1 - t;
  return 1 - u * u * u;
};
const cubicInOut: EasingFn = (t) => {
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  const u = 1 - t;
  return 1 - 4 * u * u * u;
};

/* ── Sine (cosine-blend) ───────────────────────────────────────── */

const HALF_PI = Math.PI / 2;
const sineIn: EasingFn = (t) => 1 - Math.cos(t * HALF_PI);
const sineOut: EasingFn = (t) => Math.sin(t * HALF_PI);
const sineInOut: EasingFn = (t) => 0.5 * (1 - Math.cos(t * Math.PI));

/* ── Quint (t^5) ───────────────────────────────────────────────── */

const quintIn: EasingFn = (t) => t * t * t * t * t;
const quintOut: EasingFn = (t) => {
  const u = 1 - t;
  return 1 - u * u * u * u * u;
};
const quintInOut: EasingFn = (t) => {
  if (t < 0.5) {
    return 16 * t * t * t * t * t;
  }
  const u = 1 - t;
  return 1 - 16 * u * u * u * u * u;
};

/* ── Back (overshoots its endpoint) ─────────────────────────────── */

const BACK_OVERSHOOT = 1.70158;
const backIn: EasingFn = (t) => {
  return (BACK_OVERSHOOT + 1) * t * t * t - BACK_OVERSHOOT * t * t;
};
const backOut: EasingFn = (t) => {
  const u = t - 1;
  return 1 + (BACK_OVERSHOOT + 1) * u * u * u + BACK_OVERSHOOT * u * u;
};
const backInOut: EasingFn = (t) => {
  const c2 = BACK_OVERSHOOT * 1.525;
  if (t < 0.5) {
    const u = 2 * t;
    return ((c2 + 1) * u * u * u - c2 * u * u) / 2;
  }
  const u = 2 * t - 2;
  return ((c2 + 1) * u * u * u + c2 * u * u + 2) / 2;
};

/**
 * Easing identifier: matches Phaser's tween-config string format
 * (`"Family.easeMode"`) so callers translated from Phaser keep the
 * same names. `"Linear"` and `"Linear.None"` are both accepted as a
 * pass-through so the tween config can stay verbatim.
 */
export type EasingName =
  | "Linear"
  | "Linear.None"
  | "Quad.easeIn"
  | "Quad.easeOut"
  | "Quad.easeInOut"
  | "Cubic.easeIn"
  | "Cubic.easeOut"
  | "Cubic.easeInOut"
  | "Sine.easeIn"
  | "Sine.easeOut"
  | "Sine.easeInOut"
  | "Quint.easeIn"
  | "Quint.easeOut"
  | "Quint.easeInOut"
  | "Back.easeIn"
  | "Back.easeOut"
  | "Back.easeInOut";

const REGISTRY: Record<EasingName, EasingFn> = {
  "Linear": Linear,
  "Linear.None": Linear,
  "Quad.easeIn": quadIn,
  "Quad.easeOut": quadOut,
  "Quad.easeInOut": quadInOut,
  "Cubic.easeIn": cubicIn,
  "Cubic.easeOut": cubicOut,
  "Cubic.easeInOut": cubicInOut,
  "Sine.easeIn": sineIn,
  "Sine.easeOut": sineOut,
  "Sine.easeInOut": sineInOut,
  "Quint.easeIn": quintIn,
  "Quint.easeOut": quintOut,
  "Quint.easeInOut": quintInOut,
  "Back.easeIn": backIn,
  "Back.easeOut": backOut,
  "Back.easeInOut": backInOut,
};

/**
 * Resolves an easing name (or function) to a function. Throws on an
 * unknown string — silently falling back to Linear would mask wiring
 * bugs from migrated `ease: "Foo"` configs.
 */
export function resolveEasing(input: EasingName | EasingFn): EasingFn {
  if (typeof input === "function") {
    return input;
  }
  const fn = REGISTRY[input];
  if (!fn) {
    throw new Error(`r3/Easing: unknown easing "${String(input)}"`);
  }
  return fn;
}
