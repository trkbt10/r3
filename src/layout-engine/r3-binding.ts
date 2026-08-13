/**
 * @file Ready-made `onRect` adapters for common r3 node shapes.
 *
 * The layout engine itself is framework-free — it only ever calls a
 * caller-provided `onRect(rect)`. These helpers encode the two
 * patterns that appear repeatedly:
 *
 *   - **position-only**: most r3 widgets (Container, Graphics, Text,
 *     Image) have a fixed drawing surface authored at construction,
 *     so a layout change only writes the top-left pixel. Use
 *     {@link bindPosition}.
 *   - **position + resize**: {@link Rect} carries its own width /
 *     height and exposes `setSize`. Use {@link bindRect}. Also works
 *     for any node with a compatible setter pair, exposed via
 *     {@link bindPositionAndSize}.
 *
 * Passing a bespoke widget? Just author `onRect: (r) => { ... }`
 * inline and call whatever your widget uses.
 */

import { Matrix4, Vector3 } from "three";
import { Node } from "../Node.ts";
import type { Rect } from "../Rect.ts";
import type { LayoutFrame, LayoutPoint, LayoutRect, LayoutTransform } from "./types.ts";
import type { OnRect } from "./nodes.ts";

/**
 * Writes `rect.x` / `rect.y` onto the node on every layout tick and
 * ignores size. Size-insensitive bindings are the common case — most
 * r3 widgets hold their visual dimensions as construction-time
 * constants and only the anchor point moves.
 */
export function bindPosition(node: Node): OnRect {
  return (rect: LayoutFrame) => {
    node.setPosition(rect.x, rect.y);
    applyLayoutTransform(node, rect);
  };
}

/**
 * Writes position + size to a {@link Rect}. Calling `setSize` on
 * every tween frame is fine for flat-shaded rectangles (no texture
 * upload); do not use this for widgets whose resize requires a full
 * canvas re-raster (e.g. Graphics) — author a bespoke `onRect` that
 * stages the size change to a sensible moment instead.
 */
export function bindRect(rect: Rect): OnRect {
  return (r: LayoutFrame) => {
    rect.setPosition(r.x, r.y);
    rect.setSize(r.width, r.height);
    applyLayoutTransform(rect, r);
  };
}

/**
 * Structural binding for any object that exposes `setPosition` +
 * `setSize`. Lets the caller plug in bespoke widgets (e.g. a wrapper
 * that recomputes an internal mask on resize) without reaching back
 * into the concrete Rect import.
 */
/** Structural shape of any widget that can accept position + size writes. */
export type PositionAndSizeTarget = {
  setPosition: (x: number, y: number) => unknown;
  setSize: (width: number, height: number) => unknown;
};

/**
 * Writes position + size onto any widget that implements
 * {@link PositionAndSizeTarget}. Useful for composite widgets whose
 * public surface exposes these two setters.
 */
export function bindPositionAndSize(target: PositionAndSizeTarget): OnRect {
  return (r: LayoutFrame) => {
    target.setPosition(r.x, r.y);
    target.setSize(r.width, r.height);
    if (isLayoutMatrixTarget(target)) {
      applyLayoutTransform(target, r);
    }
  };
}

/**
 * Applies or clears the r3 matrix associated with a layout frame.
 * Bindings call this after writing position / size.
 */
export function applyLayoutTransform(node: Node, frame: LayoutFrame): void {
  if (!frame.transform) {
    node.setLayoutMatrix(null);
    return;
  }
  node.setLayoutMatrix(layoutTransformMatrix(frame, frame.transform));
}

/**
 * Builds the Three matrix for a layout-authored visual transform.
 * The matrix operates in the node's local coordinate space.
 */
export function layoutTransformMatrix(
  rect: LayoutRect,
  transform: LayoutTransform,
): Matrix4 {
  const originX = transform.originX ?? 0.5;
  const originY = transform.originY ?? 0.5;
  const pivotX = rect.width * originX;
  const pivotY = -rect.height * originY;
  const skewX = transform.skewX ?? 0;
  const skewY = transform.skewY ?? 0;

  TMP_MATRIX.identity();
  if (transform.vanishingPoint) {
    TMP_MATRIX.multiply(vanishingPointMatrix(rect, transform));
  }
  TMP_MATRIX.multiply(TMP_STEP.makeTranslation(pivotX, pivotY, 0));
  TMP_MATRIX.multiply(TMP_STEP.makeRotationZ(-(transform.rotate ?? 0)));
  TMP_MATRIX.multiply(TMP_STEP.makeRotationX(transform.tiltX ?? 0));
  TMP_MATRIX.multiply(TMP_STEP.makeRotationY(-(transform.tiltY ?? 0)));
  TMP_MATRIX.multiply(skewMatrix(skewX, skewY));
  TMP_MATRIX.multiply(TMP_STEP.makeScale(transform.scaleX ?? 1, transform.scaleY ?? 1, 1));
  if (transform.perspective !== undefined && transform.perspective !== 0) {
    TMP_MATRIX.multiply(perspectiveMatrix(transform.perspective));
  }
  TMP_MATRIX.multiply(TMP_STEP.makeTranslation(-pivotX, -pivotY, 0));
  return TMP_MATRIX.clone();
}






/** Return layout frame visual bounds. */
export function layoutFrameVisualBounds(frame: LayoutFrame): LayoutRect {
  if (!frame.transform) {
    return {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
    };
  }
  const matrix = layoutTransformMatrix(frame, frame.transform);
  const points = [
    new Vector3(0, 0, 0),
    new Vector3(frame.width, 0, 0),
    new Vector3(frame.width, -frame.height, 0),
    new Vector3(0, -frame.height, 0),
  ].map((point) => point.applyMatrix4(matrix));
  const xs = points.map((point) => frame.x + point.x);
  const ys = points.map((point) => frame.y - point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}






/** Return node local rect world bounds. */
export function nodeLocalRectWorldBounds(
  node: Node,
  rect: LayoutRect,
): LayoutRect {
  node.obj3d.updateWorldMatrix(true, false);
  const points = [
    logicalLocalToWorld(node, rect.x, rect.y),
    logicalLocalToWorld(node, rect.x + rect.width, rect.y),
    logicalLocalToWorld(node, rect.x + rect.width, rect.y + rect.height),
    logicalLocalToWorld(node, rect.x, rect.y + rect.height),
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function logicalLocalToWorld(
  node: Node,
  x: number,
  y: number,
): LayoutPoint {
  const point = TMP_VECTOR.set(x, -y, 0).applyMatrix4(node.obj3d.matrixWorld);
  return {
    x: point.x,
    y: -point.y,
  };
}

function vanishingPointMatrix(
  rect: LayoutRect,
  transform: LayoutTransform,
): Matrix4 {
  const vp = transform.vanishingPoint;
  if (!vp) {
    return TMP_VANISH.identity();
  }
  if ("ref" in vp) {
    throw new Error(`layoutTransformMatrix: unresolved vanishing point ref "${vp.ref}"`);
  }
  const depth = clampDepth(vp.depth ?? 0.16);
  const quad = projectDepthQuad(rect, vp, depth, vanishingQuad(rect, vp, depth));
  return homographyMatrix(rect.width, rect.height, quad);
}

function rectCorners(rect: LayoutRect): [LayoutPoint, LayoutPoint, LayoutPoint, LayoutPoint] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

function vanishingQuad(
  rect: LayoutRect,
  vp: LayoutTransform["vanishingPoint"] & LayoutPoint,
  depth: number,
): readonly LayoutPoint[] {
  const corners = rectCorners(rect);
  const axis = resolveVanishingAxis(rect, vp);
  if (axis === "x") {
    return vanishingQuadX(rect, vp, depth, corners);
  }
  return vanishingQuadY(rect, vp, depth, corners);
}

function projectDepthQuad(
  rect: LayoutRect,
  vp: LayoutTransform["vanishingPoint"] & LayoutPoint,
  depth: number,
  quad: readonly LayoutPoint[],
): readonly LayoutPoint[] {
  if (vp.projectionDistance === undefined || vp.referenceDepth === undefined) {
    return quad;
  }
  // Depth projection is the only place where background/foreground
  // size differences are introduced. Callers author a logical depth;
  // they must not pre-scale nodes just to imply distance.
  const distance = Math.max(0.001, vp.projectionDistance);
  const depthScale = vp.depthScale ?? 1;
  const z = (vp.referenceDepth - depth) * depthScale;
  const scale = clampProjectionScale(distance / (distance + z));
  return quad.map((point) => {
    const global = {
      x: rect.x + point.x,
      y: rect.y + point.y,
    };
    return {
      x: vp.x + (global.x - vp.x) * scale - rect.x,
      y: vp.y + (global.y - vp.y) * scale - rect.y,
    };
  });
}

function resolveVanishingAxis(
  rect: LayoutRect,
  vp: LayoutTransform["vanishingPoint"] & LayoutPoint,
): "x" | "y" {
  const centreX = rect.x + rect.width / 2;
  const centreY = rect.y + rect.height / 2;
  if (vp.axis === "x") {
    return "x";
  }
  if (vp.axis === "y") {
    return "y";
  }
  if (Math.abs(centreX - vp.x) >= Math.abs(centreY - vp.y)) {
    return "x";
  }
  return "y";
}

function vanishingQuadX(
  rect: LayoutRect,
  vp: LayoutTransform["vanishingPoint"] & LayoutPoint,
  depth: number,
  corners: [LayoutPoint, LayoutPoint, LayoutPoint, LayoutPoint],
): readonly LayoutPoint[] {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const centreX = rect.x + rect.width / 2;
  if (centreX >= vp.x) {
    return [
      toLocal(lerpPoint(topLeft, pointOnLineAtX(vp, topRight, rect.x), depth), rect),
      toLocal(topRight, rect),
      toLocal(bottomRight, rect),
      toLocal(lerpPoint(bottomLeft, pointOnLineAtX(vp, bottomRight, rect.x), depth), rect),
    ];
  }
  const rightX = rect.x + rect.width;
  return [
    toLocal(topLeft, rect),
    toLocal(lerpPoint(topRight, pointOnLineAtX(vp, topLeft, rightX), depth), rect),
    toLocal(lerpPoint(bottomRight, pointOnLineAtX(vp, bottomLeft, rightX), depth), rect),
    toLocal(bottomLeft, rect),
  ];
}

function vanishingQuadY(
  rect: LayoutRect,
  vp: LayoutTransform["vanishingPoint"] & LayoutPoint,
  depth: number,
  corners: [LayoutPoint, LayoutPoint, LayoutPoint, LayoutPoint],
): readonly LayoutPoint[] {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const centreY = rect.y + rect.height / 2;
  if (centreY <= vp.y) {
    const bottomY = rect.y + rect.height;
    return [
      toLocal(topLeft, rect),
      toLocal(topRight, rect),
      toLocal(lerpPoint(bottomRight, pointOnLineAtY(vp, topRight, bottomY), depth), rect),
      toLocal(lerpPoint(bottomLeft, pointOnLineAtY(vp, topLeft, bottomY), depth), rect),
    ];
  }
  return [
    toLocal(lerpPoint(topLeft, pointOnLineAtY(vp, bottomLeft, rect.y), depth), rect),
    toLocal(lerpPoint(topRight, pointOnLineAtY(vp, bottomRight, rect.y), depth), rect),
    toLocal(bottomRight, rect),
    toLocal(bottomLeft, rect),
  ];
}

function pointOnLineAtX(from: LayoutPoint, through: LayoutPoint, x: number): LayoutPoint {
  const dx = through.x - from.x;
  if (Math.abs(dx) < 0.000001) {
    return { x, y: through.y };
  }
  const t = (x - from.x) / dx;
  return {
    x,
    y: from.y + (through.y - from.y) * t,
  };
}

function pointOnLineAtY(from: LayoutPoint, through: LayoutPoint, y: number): LayoutPoint {
  const dy = through.y - from.y;
  if (Math.abs(dy) < 0.000001) {
    return { x: through.x, y };
  }
  const t = (y - from.y) / dy;
  return {
    x: from.x + (through.x - from.x) * t,
    y,
  };
}

function lerpPoint(from: LayoutPoint, to: LayoutPoint, t: number): LayoutPoint {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

function toLocal(point: LayoutPoint, rect: LayoutRect): LayoutPoint {
  return {
    x: point.x - rect.x,
    y: point.y - rect.y,
  };
}

function clampDepth(value: number): number {
  return Math.max(0, Math.min(0.45, value));
}

function clampProjectionScale(value: number): number {
  return Math.max(0.72, Math.min(1.18, value));
}

function homographyMatrix(
  width: number,
  height: number,
  quad: readonly LayoutPoint[],
): Matrix4 {
  const p0 = quad[0] ?? { x: 0, y: 0 };
  const p1 = quad[1] ?? { x: width, y: 0 };
  const p2 = quad[2] ?? { x: width, y: height };
  const p3 = quad[3] ?? { x: 0, y: height };
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  const project = resolveProjectiveTerms(denominator, dx1, dx2, dx3, dy1, dy2, dy3);
  const projectX = project.x;
  const projectY = project.y;
  const a = p1.x - p0.x + projectX * p1.x;
  const b = p3.x - p0.x + projectY * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + projectX * p1.y;
  const e = p3.y - p0.y + projectY * p3.y;
  const f = p0.y;

  return TMP_VANISH.set(
    a / width,
    -b / height,
    0,
    c,
    -d / width,
    e / height,
    0,
    -f,
    0,
    0,
    1,
    0,
    projectX / width,
    -projectY / height,
    0,
    1,
  );
}

function resolveProjectiveTerms(
  denominator: number,
  dx1: number,
  dx2: number,
  dx3: number,
  dy1: number,
  dy2: number,
  dy3: number,
): LayoutPoint {
  if (Math.abs(denominator) < 0.000001) {
    return { x: 0, y: 0 };
  }
  return {
    x: (dx3 * dy2 - dx2 * dy3) / denominator,
    y: (dx1 * dy3 - dx3 * dy1) / denominator,
  };
}

function skewMatrix(skewX: number, skewY: number): Matrix4 {
  return TMP_SKEW.set(
    1,
    Math.tan(skewX),
    0,
    0,
    Math.tan(skewY),
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
  );
}

function perspectiveMatrix(strength: number): Matrix4 {
  return TMP_PERSPECTIVE.set(
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    strength,
    1,
  );
}

function isLayoutMatrixTarget(target: PositionAndSizeTarget): target is PositionAndSizeTarget & Node {
  return target instanceof Node;
}

const TMP_MATRIX = new Matrix4();
const TMP_STEP = new Matrix4();
const TMP_SKEW = new Matrix4();
const TMP_PERSPECTIVE = new Matrix4();
const TMP_VANISH = new Matrix4();
const TMP_VECTOR = new Vector3();
