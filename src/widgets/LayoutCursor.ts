/**
 * @file LayoutCursor — vertical-stack layout helper for r3 panels.
 *
 * 1:1 port of `src/scenes/ui/LayoutCursor.ts` with Phaser
 * Container/Graphics replaced by their r3 equivalents. Same write
 * cursor + horizontal padding model so call sites translated from
 * the Phaser version stay structurally identical.
 *
 * Each method places an element at the current Y and advances the
 * cursor past it (or registers the element and lets the caller call
 * `advance()`). Horizontal placement is derived from the configured
 * content rectangle.
 */

import { Container } from "../Container.ts";
import { Graphics } from "../Graphics.ts";
import type { Node } from "../Node.ts";
import type { TextureManager } from "../texture-canvas";

export type R3LayoutCursorConfig = {
  /** Content rect's left X in stage-local pixels. */
  readonly x: number;
  readonly width: number;
  readonly startY: number;
  /** Inner padding applied to `left`/`right`/`innerWidth`. Default 24px. */
  readonly padding?: number;
  /** Container the cursor writes its sub-elements into. */
  readonly container: Container;
  readonly textureManager: TextureManager;
};

/** Tracks a vertical write cursor within a rectangular content region. */
export class R3LayoutCursor {
  private yCursor: number;
  private readonly contentX: number;
  private readonly contentWidth: number;
  private readonly pad: number;
  private readonly container: Container;
  private readonly textureManager: TextureManager;

  constructor(config: R3LayoutCursorConfig) {
    this.yCursor = config.startY;
    this.contentX = config.x;
    this.contentWidth = config.width;
    this.pad = config.padding ?? 24;
    this.container = config.container;
    this.textureManager = config.textureManager;
  }

  /** Current Y coordinate. */
  y(): number {
    return this.yCursor;
  }

  /** Left edge X after applying inner padding. */
  left(): number {
    return this.contentX + this.pad;
  }

  /** Right edge X after applying inner padding. */
  right(): number {
    return this.contentX + this.contentWidth - this.pad;
  }

  /** Horizontal centre X. */
  centerX(): number {
    return this.contentX + this.contentWidth / 2;
  }

  /** Width of the inner padded box. */
  innerWidth(): number {
    return this.contentWidth - this.pad * 2;
  }

  /** Advance the cursor by a raw pixel amount (positive goes down). */
  advance(amount: number): void {
    this.yCursor += amount;
  }

  /**
   * Draws a horizontal separator line at the current Y and advances
   * the cursor by `gap`. Returns the underlying Graphics so the
   * caller can chain further draws if needed.
   */
  separator(gap: number, colorHex: number, alpha = 0.6): Graphics {
    const innerLeft = this.left();
    const innerRight = this.right();
    const widthPx = innerRight - innerLeft;
    const g = new Graphics({
      x: innerLeft,
      y: this.yCursor,
      width: Math.max(1, widthPx),
      height: 1,
      originX: 0,
      originY: 0,
      textureManager: this.textureManager,
    });
    g.lineStyle(1, colorHex, alpha);
    g.strokeLine(0, 0, widthPx, 0);
    this.container.add(g);
    this.yCursor += gap;
    return g;
  }

  /**
   * Registers pre-built nodes with the owning container. The cursor
   * does NOT advance — callers control `advance()` separately so
   * mixed horizontal layouts can attach multiple elements at the
   * same Y. Any r3 Node (Container, Text, Rect, Image, Graphics)
   * works because Container.add accepts the base class.
   */
  attach(...nodes: readonly Node[]): void {
    for (const node of nodes) {
      this.container.add(node);
    }
  }

  /** Resets the cursor to a specific Y. Useful for multi-column writes. */
  moveTo(y: number): void {
    this.yCursor = y;
  }
}
