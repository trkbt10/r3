/**
 * @file Specs for the layout tree JSON serialisation.
 *
 * Covers: round-trip symmetry, anchor-placement preservation, binding
 * attachment on hydrate, and node reuse so LayoutRuntime identity
 * survives a JSON edit.
 */

import {
  flexBox,
  leaf,
  spacer,
  absolute,
  placeAnchor,
  type LayoutNode,
  type LeafNode,
} from "./nodes.ts";
import { serializeTree, hydrateTree } from "./serialize.ts";

function authoredTree(): LayoutNode {
  return flexBox({
    key: "root",
    direction: "column",
    width: 1280,
    height: 720,
    children: [
      flexBox({
        key: "topBand",
        direction: "row",
        padding: 16,
        gap: 8,
        justify: "space-between",
        children: [
          leaf({ key: "menuBtn", width: 44, height: 44, onRect: () => undefined }),
          leaf({ key: "log", width: 440, height: 64, onRect: () => undefined }),
        ],
      }),
      spacer({ key: "mid", flex: 1 }),
    ],
    absolute: [
      absolute({
        node: leaf({ key: "dialPad", width: 220, height: 192, onRect: () => undefined }),
        place: placeAnchor("bottom-right", { x: 16, y: 16 }),
      }),
    ],
  });
}

describe("serializeTree", () => {
  it("round-trips through JSON.stringify", () => {
    const tree = authoredTree();
    const serial = serializeTree(tree);
    const clone = JSON.parse(JSON.stringify(serial));
    // JSON.parse loses no information because every field is a
    // primitive / plain array / plain object.
    expect(clone).toEqual(serial);
  });

  it("emits a flex node with every authored field", () => {
    const tree = authoredTree();
    const serial = serializeTree(tree);
    expect(serial.kind).toBe("flex");
    if (serial.kind !== "flex") {
      throw new Error("expected flex root");
    }
    expect(serial.key).toBe("root");
    expect(serial.direction).toBe("column");
    expect(serial.width).toBe(1280);
    expect(serial.children.length).toBe(2);
    expect(serial.absolute.length).toBe(1);
    expect(serial.absolute[0]?.placement.kind).toBe("anchor");
    expect(serial.absolute[0]?.placement.anchor).toBe("bottom-right");
  });

  it("preserves authored visual transforms", () => {
    const tree = flexBox({
      key: "tilted",
      width: 200,
      height: 120,
      transform: {
        originX: 0.5,
        originY: 0.5,
        rotate: 0.12,
        skewX: 0.2,
        tiltY: 0.18,
        vanishingPoint: { x: 640, y: 180, strength: 0.001 },
      },
      children: [leaf({ key: "button", width: 80, height: 40, onRect: () => undefined })],
    });
    const serial = serializeTree(tree);
    if (serial.kind !== "flex") {
      throw new Error("expected flex root");
    }
    expect(serial.transform).toEqual({
      originX: 0.5,
      originY: 0.5,
      rotate: 0.12,
      skewX: 0.2,
      tiltY: 0.18,
      vanishingPoint: { x: 640, y: 180, strength: 0.001 },
    });

    const hydrated = hydrateTree(serial, {});
    if (hydrated.kind !== "flex") {
      throw new Error("expected hydrated flex root");
    }
    expect(hydrated.transform).toEqual(serial.transform);
  });

  it("throws on a non-anchor `place` function", () => {
    const tree = flexBox({
      absolute: [
        absolute({
          node: leaf({ width: 10, height: 10, onRect: () => undefined }),
          // A bespoke place function — can't round-trip.
          place: (parent) => ({ x: parent.x + 5, y: parent.y + 5, width: 10, height: 10 }),
        }),
      ],
    });
    expect(() => serializeTree(tree)).toThrow(/non-anchor place/);
  });

  it("omits undefined fields from the emitted object", () => {
    const bare = leaf({ width: 10, height: 10, onRect: () => undefined });
    const serial = serializeTree(bare);
    expect(Object.prototype.hasOwnProperty.call(serial, "key")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(serial, "alignSelf")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(serial, "transition")).toBe(false);
  });
});

describe("hydrateTree", () => {
  it("wires leaf onRect from bindings by key", () => {
    const tree = authoredTree();
    const serial = serializeTree(tree);
    const calls = { menuBtn: 0, log: 0, dialPad: 0 };
    const bindings = {
      menuBtn: () => {
        calls.menuBtn += 1;
      },
      log: () => {
        calls.log += 1;
      },
      dialPad: () => {
        calls.dialPad += 1;
      },
    };
    const hydrated = hydrateTree(serial, bindings);
    // Find the menuBtn leaf and invoke its onRect.
    const menuNode = findByKey(hydrated, "menuBtn");
    expect(menuNode).not.toBeNull();
    menuNode?.onRect?.({ x: 0, y: 0, width: 0, height: 0 });
    expect(calls.menuBtn).toBe(1);
  });

  it("wires flex onRect from bindings by key", () => {
    const tree = authoredTree();
    const serial = serializeTree(tree);
    const calls = { topBand: 0 };
    const hydrated = hydrateTree(serial, {
      topBand: () => {
        calls.topBand += 1;
      },
    });
    const topBand = findByKey(hydrated, "topBand");
    expect(topBand?.kind).toBe("flex");
    topBand?.onRect?.({ x: 0, y: 0, width: 352, height: 44 });
    expect(calls.topBand).toBe(1);
  });

  it("leaves onRect as a no-op when no binding exists for the key", () => {
    const serial = serializeTree(spacer({ key: "mid", flex: 1 }));
    const hydrated = hydrateTree(serial, {});
    const node = hydrated;
    // Spacers have no binding — calling onRect should be safe (no-op).
    expect(() => node.onRect?.({ x: 0, y: 0, width: 0, height: 0 })).not.toThrow();
  });

  it("preserves anchor placement through a round-trip", () => {
    const tree = authoredTree();
    const serial = serializeTree(tree);
    const hydrated = hydrateTree(serial, {});
    if (hydrated.kind !== "flex") {
      throw new Error("expected flex root");
    }
    expect(hydrated.absolute.length).toBe(1);
    const abs = hydrated.absolute[0];
    if (!abs) {
      throw new Error("missing absolute");
    }
    const rect = abs.place(
      { x: 0, y: 0, width: 1280, height: 720 },
      { width: 220, height: 192 },
    );
    // bottom-right with insets (16, 16): x = 1280 - 16 - 220 = 1044,
    //                                     y = 720 - 16 - 192 = 512.
    expect(rect).toEqual({ x: 1044, y: 512, width: 220, height: 192 });
  });

  it("reuses existing nodes keyed the same so tween state survives", () => {
    const tree = authoredTree();
    const menuOrig = findByKey(tree, "menuBtn") as LeafNode;
    expect(menuOrig).toBeDefined();

    // Edit the serial: widen the menu button.
    const serial = serializeTree(tree);
    if (serial.kind !== "flex") {
      throw new Error("expected flex root");
    }
    const topBand = serial.children[0];
    if (!topBand || topBand.kind !== "flex") {
      throw new Error("expected topBand flex");
    }
    const menuSerial = topBand.children[0];
    if (!menuSerial || menuSerial.kind !== "leaf") {
      throw new Error("expected leaf");
    }
    // Produce an edited clone with a new width.
    const edited: typeof menuSerial = { ...menuSerial, width: 60 };
    const editedTop: typeof topBand = { ...topBand, children: [edited, ...topBand.children.slice(1)] };
    const editedRoot: typeof serial = {
      ...serial,
      children: [editedTop, ...serial.children.slice(1)],
    };

    const hydrated = hydrateTree(editedRoot, {}, tree);
    const menuAfter = findByKey(hydrated, "menuBtn") as LeafNode;
    // Same object reference (mutated) — object identity preserved.
    expect(menuAfter).toBe(menuOrig);
    expect(menuAfter.width).toBe(60);
  });

  it("creates fresh nodes for keys that were not present in existing", () => {
    // Capture the original leaf object BEFORE hydration, because
    // hydrate mutates the reused root's `children` array — looking
    // up keys on the old tree after the fact would see the
    // post-hydration structure, not the prior one.
    const originalA = leaf({ key: "a", width: 10, height: 10, onRect: () => undefined });
    const oldTree = flexBox({ key: "root", children: [originalA] });
    const newSerial = serializeTree(
      flexBox({
        key: "root",
        children: [
          leaf({ key: "a", width: 10, height: 10, onRect: () => undefined }),
          leaf({ key: "b", width: 20, height: 20, onRect: () => undefined }),
        ],
      }),
    );
    const hydrated = hydrateTree(newSerial, {}, oldTree);
    const a = findByKey(hydrated, "a");
    const b = findByKey(hydrated, "b");
    expect(a).toBe(originalA); // reused by key
    expect(b).not.toBeNull();
    expect(b).not.toBe(originalA); // sanity: different node
  });
});

function findByKey(node: LayoutNode, key: string): LayoutNode | null {
  if (node.key === key) {
    return node;
  }
  if (node.kind === "leaf") {
    return null;
  }
  for (const child of node.children) {
    const found = findByKey(child, key);
    if (found) {
      return found;
    }
  }
  for (const abs of node.absolute) {
    const found = findByKey(abs.node, key);
    if (found) {
      return found;
    }
  }
  return null;
}
