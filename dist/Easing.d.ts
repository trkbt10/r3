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
export declare const Linear: EasingFn;
/**
 * Easing identifier: matches Phaser's tween-config string format
 * (`"Family.easeMode"`) so callers translated from Phaser keep the
 * same names. `"Linear"` and `"Linear.None"` are both accepted as a
 * pass-through so the tween config can stay verbatim.
 */
export type EasingName = "Linear" | "Linear.None" | "Quad.easeIn" | "Quad.easeOut" | "Quad.easeInOut" | "Cubic.easeIn" | "Cubic.easeOut" | "Cubic.easeInOut" | "Sine.easeIn" | "Sine.easeOut" | "Sine.easeInOut" | "Quint.easeIn" | "Quint.easeOut" | "Quint.easeInOut" | "Back.easeIn" | "Back.easeOut" | "Back.easeInOut";
/**
 * Resolves an easing name (or function) to a function. Throws on an
 * unknown string — silently falling back to Linear would mask wiring
 * bugs from migrated `ease: "Foo"` configs.
 */
export declare function resolveEasing(input: EasingName | EasingFn): EasingFn;
