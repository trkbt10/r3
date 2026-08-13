/**
 * @file Typography projection helpers for r3 schema layouts.
 */

export type ProjectedTypography<T extends Record<string, number>> = {
  readonly [K in keyof T]: number;
};






/** Return project typography. */
export function projectTypography<T extends Record<string, number>>(
  source: T,
  scale: number,
  min: Partial<T> = {},
): ProjectedTypography<T> {
  const entries = Object.entries(source).map(([key, value]) => {
    const minValue = Number(min[key as keyof T] ?? 1);
    return [key, Math.max(minValue, Math.round(value * scale))];
  });
  return Object.fromEntries(entries) as ProjectedTypography<T>;
}
