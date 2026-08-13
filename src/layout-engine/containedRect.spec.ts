/**
 * @file containedRectWithin tests.
 */

import { containedRectWithin } from "./containedRect.ts";

describe("containedRectWithin", () => {
  it("places a fixed-size rect at the requested alignment inside bounds", () => {
    const bounds = { x: 10, y: 20, width: 101, height: 81 };

    expect(containedRectWithin({ bounds, width: 30, height: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 20,
    });
    expect(containedRectWithin({ bounds, width: 30, height: 20, alignX: "center", alignY: "center" })).toEqual({
      x: 45,
      y: 50,
      width: 30,
      height: 20,
    });
    expect(containedRectWithin({ bounds, width: 30, height: 20, alignX: "end", alignY: "end" })).toEqual({
      x: 81,
      y: 81,
      width: 30,
      height: 20,
    });
  });

  it("pins oversized children to the start edge on overflowing axes", () => {
    const bounds = { x: 10, y: 20, width: 50, height: 40 };

    expect(containedRectWithin({ bounds, width: 80, height: 60, alignX: "center", alignY: "end" })).toEqual({
      x: 10,
      y: 20,
      width: 80,
      height: 60,
    });
  });
});
