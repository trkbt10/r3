/**
 * @file Default theme — barrel export for r3's visual design tokens.
 *
 * Widgets import `COLOR` / `FONT` from this module. The token tables
 * ship with a default palette and font stack (see `palette.ts` /
 * `typography.ts`); a consuming application overrides any subset of
 * tokens once at startup via {@link configureR3Theme}, before
 * constructing widgets, so every widget that reads `COLOR.GOLD` or
 * `FONT.MINCHO` afterward observes the overridden value.
 */

import {
  COLOR,
  COLOR_HEX,
  patchColorPalette,
  type ColorPalette,
  type ColorToken,
  type ColorValue,
} from "./palette.ts";
import { FONT, patchFontStacks, type FontStacks, type FontStack } from "./typography.ts";

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
export function configureR3Theme(overrides: R3ThemeOverrides): void {
  if (overrides.colors) {
    patchColorPalette(overrides.colors);
  }
  if (overrides.fonts) {
    patchFontStacks(overrides.fonts);
  }
}
