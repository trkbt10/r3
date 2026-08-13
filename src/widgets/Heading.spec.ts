/**
 * @file Heading.spec module.
 */
// @vitest-environment happy-dom

import { Stage } from "../Stage.ts";
import { defaultTextureManager } from "../texture-canvas";
import { createR3Heading } from "./Heading.ts";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 320, height: 240 },
    textureManager: defaultTextureManager,
  });
}

describe("createR3Heading", () => {
  it("keeps layout and cosmetic motion on separate nodes", () => {
    const stage = makeStage();
    const heading = createR3Heading({
      text: "全国制覇",
      font: { family: "serif", size: 48, weight: "bold" },
      color: "#ffffff",
      textureManager: defaultTextureManager,
    });
    stage.add(heading.node);
    heading.setRect(40, 50, 180, 70);

    heading.visualNode.setScale(1.08);

    expect(heading.node.x).toBe(130);
    expect(heading.node.y).toBe(85);
    expect(heading.node.scaleX).toBe(1);
    expect(heading.node.scaleY).toBe(1);
    expect(heading.visualNode.scaleX).toBe(1.08);
    heading.destroy();
    stage.destroy();
  });
});
