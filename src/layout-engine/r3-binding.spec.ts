/**
 * @file Specs for r3 layout bindings.
 *
 * These focus on the transform-aware binding layer: layout still
 * emits axis-aligned rects, but r3 nodes receive an additional Three
 * matrix so rendering and hit-testing share the same geometry.
 */

import { Container } from "../Container.ts";
import { Stage } from "../Stage.ts";
import { defaultTextureManager } from "../texture-canvas";
import { Matrix4, Vector3 } from "three";
import { bindPosition, layoutTransformMatrix } from "./r3-binding.ts";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 1280, height: 720 },
    textureManager: defaultTextureManager,
  });
}

describe("r3 layout bindings", () => {
  it("applies transform metadata as a pickable node matrix", () => {
    const stage = makeStage();
    const panel = new Container({ name: "tilted" });
    panel.setInteractiveRect(100, 100);
    stage.add(panel);

    const bind = bindPosition(panel);
    bind({
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      transform: { originX: 0, originY: 0, rotate: Math.PI / 2 },
    });
    stage.composeFrame();

    expect(stage.pointer.pickAt(50, 150)?.name).toBe("tilted");
    expect(stage.pointer.pickAt(150, 150)).toBeNull();
  });

  it("clears the layout matrix when transform metadata disappears", () => {
    const panel = new Container({ name: "panel" });
    const bind = bindPosition(panel);
    bind({
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      transform: { skewX: 0.2 },
    });
    expect(panel.obj3d.matrixAutoUpdate).toBe(false);

    bind({ x: 100, y: 100, width: 100, height: 100 });
    expect(panel.obj3d.matrixAutoUpdate).toBe(true);
  });

  it("uses the global vanishing point to converge a right-side panel inward", () => {
    const rect = { x: 844, y: 16, width: 420, height: 44 };
    const matrix = layoutTransformMatrix(rect, {
      vanishingPoint: { x: 640, y: 360, depth: 0.095, axis: "x" },
    });
    const topLeft = new Vector3(0, 0, 0).applyMatrix4(matrix);
    const topRight = new Vector3(rect.width, 0, 0).applyMatrix4(matrix);
    const bottomLeft = new Vector3(0, -rect.height, 0).applyMatrix4(matrix);
    const bottomRight = new Vector3(rect.width, -rect.height, 0).applyMatrix4(matrix);

    expect(topLeft.y).toBeLessThan(0);
    expect(bottomLeft.y).toBeLessThan(-rect.height);
    expect(topRight.x).toBeCloseTo(rect.width);
    expect(topRight.y).toBeCloseTo(0);
    expect(bottomRight.x).toBeCloseTo(rect.width);
    expect(bottomRight.y).toBeCloseTo(-rect.height);
  });

  it("projects shallower depth smaller toward the same vanishing point", () => {
    const rect = { x: 460, y: 16, width: 360, height: 44 };
    const near = layoutTransformMatrix(rect, {
      vanishingPoint: {
        x: 640,
        y: 360,
        depth: 0.024,
        axis: "radial",
        projectionDistance: 1,
        referenceDepth: 0.024,
        depthScale: 1.8,
      },
    });
    const back = layoutTransformMatrix(rect, {
      vanishingPoint: {
        x: 640,
        y: 360,
        depth: 0.004,
        axis: "radial",
        projectionDistance: 1,
        referenceDepth: 0.024,
        depthScale: 1.8,
      },
    });
    const nearWidth = projectedTopWidth(near, rect.width);
    const backWidth = projectedTopWidth(back, rect.width);

    expect(backWidth).toBeLessThan(nearWidth);
  });
});

function projectedTopWidth(matrix: Matrix4, width: number): number {
  const left = new Vector3(0, 0, 0).applyMatrix4(matrix);
  const right = new Vector3(width, 0, 0).applyMatrix4(matrix);
  return Math.abs(right.x - left.x);
}
