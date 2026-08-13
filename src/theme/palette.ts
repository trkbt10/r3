/**
 * @file Default color palette for the r3 UI framework.
 *
 * r3 widgets read color tokens by role (ink / brown / gold / cream /
 * accent) rather than hard-coded hex literals, so a consuming
 * application can restyle every widget by overriding tokens once
 * through {@link configureR3Theme} instead of hunting down literal
 * colors across the widget tree.
 *
 * The token set and default values below are the ones the framework
 * shipped with historically (a cold near-black ground lit by a
 * sodium-amber "gold" accent and a bone-white "cream" text family).
 * They are a reasonable default, not a mandate — override any subset
 * via {@link configureR3Theme} before constructing widgets.
 */

/** Mutable palette state. A plain object (not `const … as const`) so {@link configureR3Theme} can patch individual tokens in place. */
export type ColorPalette = {
  // --- Ink / dark ---
  INK_ABYSS: string;
  INK_OVERLAY: string;
  INK_SCENE: string;
  INK_VIEWPORT: string;
  INK_PANEL: string;
  INK_CARD: string;
  INK_BUTTON: string;
  INK_TEXT: string;
  INK_BUTTON_HOVER: string;
  INK_DISABLED_FILL: string;
  INK_SKILL_SOFT: string;

  // --- Brown / muted ---
  BROWN_TAB_DISABLED: string;
  BROWN_SOFT: string;
  BROWN_BORDER: string;
  BROWN_HINT: string;
  BROWN_DISABLED: string;
  BROWN_DIM: string;
  BROWN_CELL_FIXED: string;

  // --- Gold / accent ---
  GOLD: string;
  GOLD_HOVER: string;
  GOLD_LIGHT: string;
  GOLD_LIGHTEST: string;

  // --- Cream / bone (text on dark) ---
  CREAM_TEXT: string;
  CREAM_CARD: string;
  CREAM_ROW: string;
  CREAM_CELL_EDITABLE: string;
  CREAM_STAT_LABEL: string;
  CREAM_HIGHLIGHT: string;
  CREAM_HOVER: string;
  CREAM_HERO: string;
  CREAM_COMPATIBLE: string;
  CREAM_STAT_VALUE: string;
  CREAM_DIM: string;
  STAMP_TEXT: string;
  SKILL_MISSING: string;
  SETTINGS_BORDER: string;
  WHITE: string;
  BLACK: string;

  // --- Accent extremes (verdicts / emphasis) ---
  CUTIN_ACCENT: string;
  VICTORY_TOTAL: string;
  DEFEAT: string;
  STAMP_STROKE: string;

  // --- Rarity ---
  RARITY_COMMON_FILL: string;
  RARITY_COMMON_TEXT: string;
  RARITY_RARE_FILL: string;
  RARITY_RARE_TEXT: string;
};

export type ColorToken = keyof ColorPalette;
export type ColorValue = ColorPalette[ColorToken];

/** Values r3 ships with. Override any subset via {@link configureR3Theme}. */
const DEFAULT_COLOR_PALETTE: ColorPalette = {
  INK_ABYSS: "#030304",
  INK_OVERLAY: "#050507",
  INK_SCENE: "#08090c",
  INK_VIEWPORT: "#0b0c10",
  INK_PANEL: "#101218",
  INK_CARD: "#0e1014",
  INK_BUTTON: "#171a22",
  INK_TEXT: "#14161c",
  INK_BUTTON_HOVER: "#222633",
  INK_DISABLED_FILL: "#1c1e24",
  INK_SKILL_SOFT: "#272a33",

  BROWN_TAB_DISABLED: "#565a64",
  BROWN_SOFT: "#5d6470",
  BROWN_BORDER: "#3d4350",
  BROWN_HINT: "#6f7682",
  BROWN_DISABLED: "#646a76",
  BROWN_DIM: "#838a98",
  BROWN_CELL_FIXED: "#8d94a2",

  GOLD: "#b8862c",
  GOLD_HOVER: "#d6a544",
  GOLD_LIGHT: "#e8c87e",
  GOLD_LIGHTEST: "#f2dba0",

  CREAM_TEXT: "#d6d2c6",
  CREAM_CARD: "#d8d4c8",
  CREAM_ROW: "#c4c0b4",
  CREAM_CELL_EDITABLE: "#cac6ba",
  CREAM_STAT_LABEL: "#bcb8ac",
  CREAM_HIGHLIGHT: "#cfcaba",
  CREAM_HOVER: "#e2ddcd",
  CREAM_HERO: "#efe9d8",
  CREAM_COMPATIBLE: "#dedacd",
  CREAM_STAT_VALUE: "#f4efe0",
  CREAM_DIM: "#9a968c",
  STAMP_TEXT: "#f2ead0",
  SKILL_MISSING: "#efeae0",
  SETTINGS_BORDER: "#4a505c",
  WHITE: "#ffffff",
  BLACK: "#000000",

  CUTIN_ACCENT: "#ffd98c",
  VICTORY_TOTAL: "#a31f1f",
  DEFEAT: "#8c1a1a",
  STAMP_STROKE: "#6e1410",

  RARITY_COMMON_FILL: "#5a2a22",
  RARITY_COMMON_TEXT: "#f2ead8",
  RARITY_RARE_FILL: "#2c3c58",
  RARITY_RARE_TEXT: "#eef2fa",
};

/**
 * Live palette state. Held as a mutable object (rather than a
 * top-level `let`) so {@link patchColorPalette} can update fields in
 * place; every module that imported {@link COLOR} keeps seeing the
 * same object identity, so a `configureR3Theme` call after import
 * still takes effect for widgets built afterward.
 */
const state: { palette: ColorPalette } = {
  palette: { ...DEFAULT_COLOR_PALETTE },
};

/** Live token table widgets read colors from — `COLOR.GOLD`, `COLOR.INK_PANEL`, etc. */
export const COLOR: ColorPalette = state.palette;

/**
 * Numeric-hex mirror of {@link COLOR}, recomputed whenever the
 * palette changes. Use at API boundaries that want a number
 * (Three.js `Color(0xRRGGBB)`, `Graphics.fillStyle`).
 */
const hexState: { table: { [K in ColorToken]: number } } = {
  table: computeColorHex(state.palette),
};

export const COLOR_HEX: { readonly [K in ColorToken]: number } = hexState.table;

function computeColorHex(palette: ColorPalette): { [K in ColorToken]: number } {
  const entries = Object.entries(palette).map(([key, value]) => [key, Number.parseInt(value.slice(1), 16)]);
  return Object.fromEntries(entries) as { [K in ColorToken]: number };
}

/**
 * Applies a partial palette override in place, then recomputes
 * {@link COLOR_HEX} so the two representations never drift apart.
 * Called by {@link "./index.ts".configureR3Theme}.
 */
export function patchColorPalette(partial: Partial<ColorPalette>): void {
  Object.assign(state.palette, partial);
  Object.assign(hexState.table, computeColorHex(state.palette));
}
