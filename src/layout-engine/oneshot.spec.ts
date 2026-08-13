/**
 * @file game r3 layout engine oneshot.spec.
 */
import { flexBox, leaf } from "./nodes.ts";
import { arrangeOneShot } from "./oneshot.ts";

describe("arrangeOneShot", () => {
  it("fires authored onRect callbacks while still allowing rect collection", () => {
    const calls: string[] = [];
    const child = leaf({
      key: "child",
      width: 40,
      height: 20,
      onRect: (rect) => {
        calls.push(`child:${rect.x},${rect.y},${rect.width},${rect.height}`);
      },
    });
    const root = flexBox({
      key: "root",
      width: 120,
      height: 80,
      children: [child],
      onRect: (rect) => {
        calls.push(`root:${rect.width}x${rect.height}`);
      },
    });
    const visited: string[] = [];

    arrangeOneShot(root, { x: 10, y: 20, width: 120, height: 80 }, {
      visit: (node, rect) => {
        if (node.key) {
          visited.push(`${node.key}:${rect.x},${rect.y}`);
        }
      },
    });

    expect(calls).toEqual(["root:120x80", "child:10,20,40,20"]);
    expect(visited).toEqual(["root:10,20", "child:10,20"]);
  });
});
