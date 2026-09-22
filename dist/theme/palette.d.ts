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
    BROWN_TAB_DISABLED: string;
    BROWN_SOFT: string;
    BROWN_BORDER: string;
    BROWN_HINT: string;
    BROWN_DISABLED: string;
    BROWN_DIM: string;
    BROWN_CELL_FIXED: string;
    GOLD: string;
    GOLD_HOVER: string;
    GOLD_LIGHT: string;
    GOLD_LIGHTEST: string;
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
    CUTIN_ACCENT: string;
    VICTORY_TOTAL: string;
    DEFEAT: string;
    STAMP_STROKE: string;
    RARITY_COMMON_FILL: string;
    RARITY_COMMON_TEXT: string;
    RARITY_RARE_FILL: string;
    RARITY_RARE_TEXT: string;
};
export type ColorToken = keyof ColorPalette;
export type ColorValue = ColorPalette[ColorToken];
/** Live token table widgets read colors from — `COLOR.GOLD`, `COLOR.INK_PANEL`, etc. */
export declare const COLOR: ColorPalette;
export declare const COLOR_HEX: {
    readonly [K in ColorToken]: number;
};
/**
 * Applies a partial palette override in place, then recomputes
 * {@link COLOR_HEX} so the two representations never drift apart.
 * Called by {@link "./index.ts".configureR3Theme}.
 */
export declare function patchColorPalette(partial: Partial<ColorPalette>): void;
