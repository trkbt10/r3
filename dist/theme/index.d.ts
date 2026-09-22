import { COLOR, COLOR_HEX, ColorPalette, ColorToken, ColorValue } from './palette.ts';
import { FONT, FontStacks, FontStack } from './typography.ts';
export { COLOR, COLOR_HEX, FONT };
export type { ColorToken, ColorValue, FontStack };
/** Partial theme override accepted by {@link configureR3Theme}. */
export type R3ThemeOverrides = {
    readonly colors?: Partial<ColorPalette>;
    readonly fonts?: Partial<FontStacks>;
};
/**
 * Overrides r3's default theme tokens in place. Call once at
 * application startup, before constructing any r3 widgets — widgets
 * read `COLOR.*` / `FONT.*` at construction time, so a widget built
 * before this call keeps the value it read then.
 */
export declare function configureR3Theme(overrides: R3ThemeOverrides): void;
