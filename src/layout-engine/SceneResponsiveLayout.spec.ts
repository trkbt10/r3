/**
 * @file Specs for SceneResponsiveLayout's screen SSoT contract.
 */

import { makeScreen, type Screen } from "../screen";
import { Stage } from "../Stage.ts";
import { defaultTextureManager } from "../texture-canvas";
import { flexBox, leaf } from "./nodes.ts";
import { SceneResponsiveLayout } from "./SceneResponsiveLayout.ts";
import type { LayoutRect } from "./types.ts";

describe("SceneResponsiveLayout", () => {
  it("uses Stage.screen as the single source of truth on mount and screen changes", () => {
    const portrait = makeScreen({
      width: 390,
      height: 844,
      viewbox: { x: 0, y: 47, width: 390, height: 763 },
    });
    const landscape = makeScreen({
      width: 932,
      height: 430,
      viewbox: { x: 59, y: 0, width: 814, height: 409 },
    });
    const stage = new Stage({ screen: portrait, textureManager: defaultTextureManager });
    const plannedScreens: Screen[] = [];
    const rects: LayoutRect[] = [];

    const layout = new SceneResponsiveLayout({
      stage,
      plan: (screen) => {
        plannedScreens.push(screen);
        return flexBox({
          key: "root",
          direction: "column",
          width: screen.width,
          height: screen.height,
          padding: {
            top: screen.viewbox.y,
            right: screen.width - (screen.viewbox.x + screen.viewbox.width),
            bottom: screen.height - (screen.viewbox.y + screen.viewbox.height),
            left: screen.viewbox.x,
          },
          children: [
            leaf({
              key: "content",
              alignSelf: "stretch",
              flex: 1,
              onRect: (rect) => {
                rects.push(rect);
              },
            }),
          ],
        });
      },
    });

    expect(plannedScreens).toEqual([portrait]);
    expect(rects.at(-1)).toEqual(portrait.viewbox);

    stage.setScreen(landscape);

    expect(plannedScreens).toEqual([portrait, landscape]);
    expect(rects.at(-1)).toEqual(landscape.viewbox);

    layout.dispose();
  });

  it("recomputes viewbox-derived content rects for every screen transition", () => {
    const screens = [
      makeScreen({
        width: 390,
        height: 844,
        viewbox: { x: 0, y: 47, width: 390, height: 763 },
      }),
      makeScreen({
        width: 932,
        height: 430,
        viewbox: { x: 59, y: 0, width: 814, height: 409 },
      }),
      makeScreen({
        width: 1440,
        height: 900,
        viewbox: { x: 0, y: 45, width: 1440, height: 810 },
      }),
      makeScreen({
        width: 390,
        height: 844,
        viewbox: { x: 0, y: 0, width: 390, height: 844 },
      }),
    ];
    const stage = new Stage({ screen: screens[0]!, textureManager: defaultTextureManager });
    const rects: LayoutRect[] = [];

    const layout = new SceneResponsiveLayout({
      stage,
      plan: (screen) =>
        flexBox({
          key: "root",
          direction: "column",
          width: screen.width,
          height: screen.height,
          padding: screenToViewboxPadding(screen),
          children: [
            leaf({
              key: "content",
              alignSelf: "stretch",
              flex: 1,
              onRect: (rect) => rects.push(rect),
            }),
          ],
        }),
    });

    expect(rects.at(-1)).toEqual(screens[0]!.viewbox);
    for (const screen of screens.slice(1)) {
      stage.setScreen(screen);
      expect(rects.at(-1)).toEqual(screen.viewbox);
    }

    layout.dispose();
  });

  it("relayouts against the latest Stage.screen and stops after dispose", () => {
    const portrait = makeScreen({
      width: 390,
      height: 844,
      viewbox: { x: 0, y: 47, width: 390, height: 763 },
    });
    const landscape = makeScreen({
      width: 932,
      height: 430,
      viewbox: { x: 59, y: 0, width: 814, height: 409 },
    });
    const stage = new Stage({ screen: portrait, textureManager: defaultTextureManager });
    const rects: LayoutRect[] = [];

    const layout = new SceneResponsiveLayout({
      stage,
      plan: (screen) =>
        flexBox({
          key: "root",
          direction: "column",
          width: screen.width,
          height: screen.height,
          padding: screenToViewboxPadding(screen),
          children: [
            leaf({
              key: "content",
              alignSelf: "stretch",
              flex: 1,
              onRect: (rect) => rects.push(rect),
            }),
          ],
        }),
    });

    stage.setScreen(landscape);
    layout.relayout();
    expect(rects.at(-1)).toEqual(landscape.viewbox);

    const countBeforeDispose = rects.length;
    layout.dispose();
    stage.setScreen(portrait);
    layout.relayout();
    expect(rects).toHaveLength(countBeforeDispose);
  });
});

function screenToViewboxPadding(screen: Screen) {
  return {
    top: screen.viewbox.y,
    right: screen.width - (screen.viewbox.x + screen.viewbox.width),
    bottom: screen.height - (screen.viewbox.y + screen.viewbox.height),
    left: screen.viewbox.x,
  };
}
