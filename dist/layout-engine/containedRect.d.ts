import { LayoutRect } from './types.ts';
export type ContainedRectAlignment = "start" | "center" | "end";
export type ContainedRectOptions = {
    readonly bounds: LayoutRect;
    readonly width: number;
    readonly height: number;
    readonly alignX?: ContainedRectAlignment;
    readonly alignY?: ContainedRectAlignment;
};
/**
 * Places a fixed-size child rectangle inside a parent layout rect.
 *
 * Oversized children pin to the parent's start edge on the overflowing
 * axis, matching the defensive layout arithmetic older call sites used
 * to write by hand with `Math.max(0, ...)`.
 */
export declare function containedRectWithin(options: ContainedRectOptions): LayoutRect;
