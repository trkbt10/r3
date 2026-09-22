/**
 * @file Default font stacks for the r3 UI framework.
 *
 * Widgets read font families from {@link FONT} rather than embedding
 * a hard-coded CSS font-stack string, so a consuming application can
 * swap typefaces once via {@link configureR3Theme} instead of editing
 * every widget that draws text.
 */
/** Mutable font-stack table. A plain object so {@link patchFontStacks} can override individual roles in place. */
export type FontStacks = {
    /** Primary body/heading family used across widgets. */
    MINCHO: string;
    /** Heavy display family for numeric/badge text that needs legibility at small sizes. */
    SANS_DISPLAY: string;
};
export type FontStack = FontStacks[keyof FontStacks];
/** Live token table widgets read font stacks from — `FONT.MINCHO`, `FONT.SANS_DISPLAY`. */
export declare const FONT: FontStacks;
/**
 * Applies a partial font-stack override in place. Called by
 * {@link "./index.ts".configureR3Theme}.
 */
export declare function patchFontStacks(partial: Partial<FontStacks>): void;
