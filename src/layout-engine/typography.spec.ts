/**
 * @file Typography projection tests.
 */

import { projectTypography } from "./typography.ts";

describe("projectTypography", () => {
  it("projects authored type sizes with the same scale used by schema layout", () => {
    expect(projectTypography({ titleSize: 30, bodySize: 19 }, 0.5)).toEqual({
      titleSize: 15,
      bodySize: 10,
    });
  });

  it("applies caller-provided minimums without per-scene sizing code", () => {
    expect(projectTypography({ titleSize: 30, bodySize: 19 }, 0.5, {
      titleSize: 16,
      bodySize: 13,
    })).toEqual({
      titleSize: 16,
      bodySize: 13,
    });
  });
});
