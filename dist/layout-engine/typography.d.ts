/**
 * @file Typography projection helpers for r3 schema layouts.
 */
export type ProjectedTypography<T extends Record<string, number>> = {
    readonly [K in keyof T]: number;
};
/** Return project typography. */
export declare function projectTypography<T extends Record<string, number>>(source: T, scale: number, min?: Partial<T>): ProjectedTypography<T>;
