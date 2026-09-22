import { Matrix4 } from 'three';
import { Node } from '../Node.ts';
import { Rect } from '../Rect.ts';
import { LayoutFrame, LayoutRect, LayoutTransform } from './types.ts';
import { OnRect } from './nodes.ts';
/**
 * Writes `rect.x` / `rect.y` onto the node on every layout tick and
 * ignores size. Size-insensitive bindings are the common case — most
 * r3 widgets hold their visual dimensions as construction-time
 * constants and only the anchor point moves.
 */
export declare function bindPosition(node: Node): OnRect;
/**
 * Writes position + size to a {@link Rect}. Calling `setSize` on
 * every tween frame is fine for flat-shaded rectangles (no texture
 * upload); do not use this for widgets whose resize requires a full
 * canvas re-raster (e.g. Graphics) — author a bespoke `onRect` that
 * stages the size change to a sensible moment instead.
 */
export declare function bindRect(rect: Rect): OnRect;
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
export declare function bindPositionAndSize(target: PositionAndSizeTarget): OnRect;
/**
 * Applies or clears the r3 matrix associated with a layout frame.
 * Bindings call this after writing position / size.
 */
export declare function applyLayoutTransform(node: Node, frame: LayoutFrame): void;
/**
 * Builds the Three matrix for a layout-authored visual transform.
 * The matrix operates in the node's local coordinate space.
 */
export declare function layoutTransformMatrix(rect: LayoutRect, transform: LayoutTransform): Matrix4;
/** Return layout frame visual bounds. */
export declare function layoutFrameVisualBounds(frame: LayoutFrame): LayoutRect;
/** Return node local rect world bounds. */
export declare function nodeLocalRectWorldBounds(node: Node, rect: LayoutRect): LayoutRect;
