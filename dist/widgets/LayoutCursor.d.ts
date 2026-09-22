import { Container } from '../Container.ts';
import { Graphics } from '../Graphics.ts';
import { Node } from '../Node.ts';
import { TextureManager } from '../texture-canvas';
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
export declare class R3LayoutCursor {
    private yCursor;
    private readonly contentX;
    private readonly contentWidth;
    private readonly pad;
    private readonly container;
    private readonly textureManager;
    constructor(config: R3LayoutCursorConfig);
    /** Current Y coordinate. */
    y(): number;
    /** Left edge X after applying inner padding. */
    left(): number;
    /** Right edge X after applying inner padding. */
    right(): number;
    /** Horizontal centre X. */
    centerX(): number;
    /** Width of the inner padded box. */
    innerWidth(): number;
    /** Advance the cursor by a raw pixel amount (positive goes down). */
    advance(amount: number): void;
    /**
     * Draws a horizontal separator line at the current Y and advances
     * the cursor by `gap`. Returns the underlying Graphics so the
     * caller can chain further draws if needed.
     */
    separator(gap: number, colorHex: number, alpha?: number): Graphics;
    /**
     * Registers pre-built nodes with the owning container. The cursor
     * does NOT advance — callers control `advance()` separately so
     * mixed horizontal layouts can attach multiple elements at the
     * same Y. Any r3 Node (Container, Text, Rect, Image, Graphics)
     * works because Container.add accepts the base class.
     */
    attach(...nodes: readonly Node[]): void;
    /** Resets the cursor to a specific Y. Useful for multi-column writes. */
    moveTo(y: number): void;
}
