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

/** Values r3 ships with. Override any subset via {@link configureR3Theme}. */
const DEFAULT_FONT_STACKS: FontStacks = {
  MINCHO: "'Shippori Mincho B1', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
  SANS_DISPLAY: "'Helvetica Neue', 'Arial Black', 'Arial', sans-serif",
};

/**
 * Live font-stack state, held as a mutable object (rather than a
 * top-level `let`) so {@link patchFontStacks} can update fields in
 * place while every importer of {@link FONT} keeps the same object
 * identity.
 */
const state: { stacks: FontStacks } = {
  stacks: { ...DEFAULT_FONT_STACKS },
};

/** Live token table widgets read font stacks from — `FONT.MINCHO`, `FONT.SANS_DISPLAY`. */
export const FONT: FontStacks = state.stacks;

/**
 * Applies a partial font-stack override in place. Called by
 * {@link "./index.ts".configureR3Theme}.
 */
export function patchFontStacks(partial: Partial<FontStacks>): void {
  Object.assign(state.stacks, partial);
}
