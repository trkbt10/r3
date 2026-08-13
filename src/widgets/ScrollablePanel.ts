/**
 * @file ScrollablePanel — viewport-clipped single-axis scroller (r3).
 *
 * One class drives both vertical (ShopPage list, SkillEditPage
 * columns) and horizontal (ShopPage card shelf) scrolling. The axis
 * is picked at construction via `axis: "y" | "x"`; the pure scroll
 * state lives in {@link ScrollModel} and is already axis-aware, so
 * this module only has to:
 *
 *  - Translate the content container along the scroll axis.
 *  - Draw ▲/▼ (vertical) or ◀/▶ (horizontal) indicator arrows at the
 *    correct edges with the correct hitboxes.
 *  - Keep method naming (`getScrollY`, `setContentHeight`,
 *    `maxScrollY`) axis-agnostic the same way ScrollModel does —
 *    "Y" is the scroll-axis convention, not a literal axis claim.
 *
 * ## Clipping
 *
 * Three.js's `material.clippingPlanes` is enabled at the renderer
 * level (see `main.ts`'s `renderer.localClippingEnabled`). Each panel
 * computes 4 world-space planes — left / right / top / bottom of the
 * panel rect — and applies them to every leaf material in the
 * panel's content subtree via `Container.setClippingPlanes`. New
 * children added later inherit the planes through the same
 * mechanism. The conversion from r3 logical coords (Y down) to Three
 * world coords (Y up) happens here so the planes sit on the right
 * side of each material's fragments.
 *
 * ## Input model
 *
 * Wheel + drag-swipe scroll, plus optional indicator arrows. The
 * "drag below threshold = tap" gate inside ScrollModel keeps inner
 * buttons clickable (a tap on a button passes through to the
 * button's click handler instead of being absorbed by the scroller).
 */

import { Matrix4, Plane, Vector3 } from "three";
import { Container } from "../Container.ts";
import type { Node } from "../Node.ts";
import { Text } from "../Text.ts";
import { ScrollModel, type ScrollAxis } from "../scroll/ScrollModel.ts";
import type { Stage } from "../Stage.ts";
import type { TextureManager } from "../texture-canvas";
import { playR3Sfx } from "../audio.ts";
import { COLOR, FONT } from "../theme";

const INDICATOR_COLOR = COLOR.GOLD;
const INDICATOR_HOVER_COLOR = COLOR.GOLD_LIGHTEST;
const INDICATOR_DISABLED_COLOR = COLOR.BROWN_SOFT;
/** Vertical-axis indicator hit-target breadth (px). */
const INDICATOR_Y_HEIGHT = 14;
/** Horizontal-axis indicator hit-target breadth (px). */
const INDICATOR_X_WIDTH = 16;
const FONT_FAMILY = FONT.MINCHO;

const DEFAULT_SCROLL_STEP_Y = 24;
const DEFAULT_SCROLL_STEP_X = 48;

export type R3ScrollablePanelConfig = {
  readonly stage: Stage;
  readonly textureManager: TextureManager;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /**
   * Total authored content size along the scroll axis — content
   * height for `axis: "y"`, content width for `axis: "x"`. When it's
   * ≤ the viewport's matching dimension the panel reports
   * `scrollable: false` and the indicators hide themselves.
   */
  readonly contentHeight: number;
  readonly scrollStep?: number;
  readonly showIndicators?: boolean;
  /**
   * Scroll axis. Defaults to `"y"` (vertical). Horizontal panels
   * re-use the same API — `contentHeight` means "content width",
   * `getScrollY()` means "the scroll offset along X".
   */
  readonly axis?: ScrollAxis;
  /**
   * Optional gesture gate for pointer-drag scrolling. Wheel and
   * indicator scrolling remain available; this only arbitrates touch /
   * mouse swipe scroll against nested drag gestures.
   */
  readonly canDragScroll?: () => boolean;
  /** Optional parent; defaults to the stage root. */
  readonly parent?: Container;
};

type IndicatorGlyphs = {
  readonly start: string;
  readonly end: string;
};

const INDICATOR_GLYPHS_Y: IndicatorGlyphs = { start: "▲", end: "▼" };
const INDICATOR_GLYPHS_X: IndicatorGlyphs = { start: "◀", end: "▶" };

/** Mask-clipped scroll container with wheel + swipe + indicator input. */
export class R3ScrollablePanel {
  /** Outer container — placed at the panel's (x, y); paints chrome. */
  readonly container: Container;
  /** Inner container — children scroll here; clipping applied. */
  readonly content: Container;
  readonly model: ScrollModel;

  private readonly stage: Stage;
  private readonly config: R3ScrollablePanelConfig;
  private readonly axis: ScrollAxis;
  private readonly showIndicators: boolean;
  private readonly defaultStep: number;

  /** "Start" = up (y-axis) / left (x-axis); "end" = down / right. */
  private startIndicator: Text | null = null;
  private endIndicator: Text | null = null;

  /** Cached clipping planes — built once, applied to every new child. */
  private readonly clippingPlanes: Plane[];

  /** Disposers for stage-level pointer/wheel listeners. */
  private readonly disposers: Array<() => void>;

  /** Frame ticker hook id. The Stage has no `events.on('update')` like
   * Phaser — we subscribe to the same per-frame composition pass via a
   * post-tick hook the panel runs from a tween that loops forever. */
  private readonly tickHandle: { kill: () => void };

  /** True while the user is mid-swipe; suppresses external pointer-up handling. */
  get wasSwiping(): boolean {
    return this.model.wasSwiping;
  }

  get scrollable(): boolean {
    return this.model.scrollable;
  }

  /** Pixel extent of the clipped viewport along the scroll axis. */
  get viewHeight(): number {
    return this.axis === "y" ? this.config.height : this.config.width;
  }

  constructor(config: R3ScrollablePanelConfig) {
    this.stage = config.stage;
    this.config = config;
    this.axis = config.axis ?? "y";
    this.showIndicators = config.showIndicators ?? true;
    this.defaultStep = this.axis === "y" ? DEFAULT_SCROLL_STEP_Y : DEFAULT_SCROLL_STEP_X;

    const scrollStep = config.scrollStep ?? this.defaultStep;
    this.model = new ScrollModel({
      width: config.width,
      height: config.height,
      contentHeight: config.contentHeight,
      scrollStep,
      axis: this.axis,
    });

    this.container = new Container({
      x: config.x,
      y: config.y,
      name: this.axis === "y" ? "r3:scroll-panel" : "r3:hscroll-panel",
    });
    this.content = new Container({
      x: 0,
      y: 0,
      name: this.axis === "y" ? "r3:scroll-panel:content" : "r3:hscroll-panel:content",
    });
    this.container.add(this.content);
    this.disposers = [];

    this.clippingPlanes = buildPlanesFor(config.x, config.y, config.width, config.height);
    this.refreshClippingPlanes();
    this.content.setClippingPlanes(this.clippingPlanes);

    // Wheel — only fires when the pointer is inside the viewport rect.
    this.disposers.push(this.stage.pointer.on("wheel", (e) => {
      if (!this.containsViewportPoint(e.x, e.y)) {
        return;
      }
      // Most wheels deliver only deltaY; for horizontal axis the
      // model folds that into X scroll internally.
      if (this.model.handleWheel(e.x, e.y, config.x, config.y, e.deltaY)) {
        this.updateIndicatorsFor(this.model.getScrollY());
      }
    }));

    this.disposers.push(this.stage.pointer.on("pointerdown", (e) => {
      if (config.canDragScroll?.() === false) {
        return;
      }
      this.model.handlePointerDown(e.x, e.y, config.x, config.y);
    }));
    this.disposers.push(this.stage.pointer.on("pointermove", (e) => {
      if (config.canDragScroll?.() === false) {
        return;
      }
      // `handlePointerMove` signature: (primaryCoord, crossCoord?).
      // For vertical the primary coord is Y and the cross coord
      // isn't consulted; for horizontal the primary coord is still
      // Y (pointer raw Y) and the cross coord X is what drives the
      // scroll delta — see ScrollModel's axis mapping.
      if (this.axis === "y") {
        const advanced = this.model.handlePointerMove(e.y, e.x);
        if (advanced) {
          this.applyScroll();
        }
        return;
      }
      const advanced = this.model.handlePointerMove(e.y, e.x);
      if (advanced) {
        this.applyScroll();
      }
    }));
    this.disposers.push(this.stage.pointer.on("pointerup", () => {
      this.model.handlePointerUp();
    }));

    // Per-frame lerp tick. We use a degenerate 0-duration repeat=-1
    // tween whose onUpdate runs every frame — same advance rate as
    // the Stage's tween manager. (The Phaser version listened on
    // `scene.events.on('update')`; r3 has no equivalent stage event,
    // so we ride the tween scheduler.)
    const tickTarget = { _t: 0 };
    this.tickHandle = this.stage.tweens.add({
      targets: tickTarget,
      _t: 1,
      duration: 16,
      repeat: -1,
      ease: "Linear",
      onUpdate: () => {
        this.refreshClippingPlanes();
        if (this.model.update()) {
          this.writeContentOffset();
        }
      },
    });

    if (this.showIndicators) {
      this.buildIndicators();
    }
    this.updateIndicators();

    (config.parent ?? this.stage.root).add(this.container);
  }

  /**
   * Updates total content size along the scroll axis. "Height" here
   * is axis-agnostic (matches ScrollModel's convention) — for
   * horizontal panels it's the content width.
   */
  setContentHeight(size: number): void {
    this.model.setContentHeight(size);
    this.applyScroll();
  }

  resetScroll(): void {
    this.model.resetScroll();
    this.applyScroll();
  }

  setScrollY(y: number): void {
    this.model.setScrollY(y);
    this.applyScroll();
  }

  /** Current scroll offset along the axis (y for vertical, x for horizontal). */
  getScrollY(): number {
    return this.model.getScrollY();
  }

  scrollBy(delta: number): void {
    this.model.scrollBy(delta);
    this.updateIndicatorsFor(this.model.getScrollY());
  }

  scrollTo(offset: number): void {
    if (this.model.scrollTo(offset)) {
      this.updateIndicatorsFor(this.model.getScrollY());
    }
  }

  /**
   * Adds a child to the scrollable content. Re-applies the clipping
   * planes so the new child's leaf materials inherit the viewport
   * clip; without this a freshly-added Text/Rect would draw past the
   * panel's viewport edge until something else triggered a clip-plane
   * propagation.
   */
  addContent<T extends Node>(child: T): T {
    this.content.add(child);
    child.setClippingPlanes(this.clippingPlanes);
    return child;
  }

  /** Destroys every child of `content` and resets scrollY to 0. */
  clearContent(): void {
    this.content.removeAll(true);
    this.model.resetScroll();
    this.applyScroll();
  }

  destroy(): void {
    this.tickHandle.kill();
    for (const d of this.disposers) {
      d();
    }
    this.disposers.length = 0;
    this.container.destroy();
  }

  private applyScroll(): void {
    this.writeContentOffset();
    this.updateIndicators();
  }

  /** Moves the content container to mirror model's current scroll offset. */
  private writeContentOffset(): void {
    const offset = -this.model.getScrollY();
    if (this.axis === "y") {
      this.content.y = offset;
    } else {
      this.content.x = offset;
    }
  }

  private buildIndicators(): void {
    const glyphs = this.axis === "y" ? INDICATOR_GLYPHS_Y : INDICATOR_GLYPHS_X;
    if (this.axis === "y") {
      this.buildVerticalIndicators(glyphs);
    } else {
      this.buildHorizontalIndicators(glyphs);
    }
  }

  private buildVerticalIndicators(glyphs: IndicatorGlyphs): void {
    const cx = this.config.width / 2;
    this.startIndicator = new Text({
      x: cx,
      y: -INDICATOR_Y_HEIGHT + 2,
      text: glyphs.start,
      font: { family: FONT_FAMILY, size: 12 },
      color: INDICATOR_DISABLED_COLOR,
      originX: 0.5,
      originY: 0,
      textureManager: this.config.textureManager,
    });
    this.startIndicator.setInteractive({
      x: -INDICATOR_Y_HEIGHT,
      y: 0,
      width: INDICATOR_Y_HEIGHT * 2,
      height: INDICATOR_Y_HEIGHT,
    });
    this.wireIndicator(this.startIndicator, "start");
    this.container.add(this.startIndicator);

    this.endIndicator = new Text({
      x: cx,
      y: this.config.height + 2,
      text: glyphs.end,
      font: { family: FONT_FAMILY, size: 12 },
      color: INDICATOR_DISABLED_COLOR,
      originX: 0.5,
      originY: 0,
      textureManager: this.config.textureManager,
    });
    this.endIndicator.setInteractive({
      x: -INDICATOR_Y_HEIGHT,
      y: 0,
      width: INDICATOR_Y_HEIGHT * 2,
      height: INDICATOR_Y_HEIGHT,
    });
    this.wireIndicator(this.endIndicator, "end");
    this.container.add(this.endIndicator);
  }

  private buildHorizontalIndicators(glyphs: IndicatorGlyphs): void {
    const cy = this.config.height / 2;
    this.startIndicator = new Text({
      x: -INDICATOR_X_WIDTH + 2,
      y: cy,
      text: glyphs.start,
      font: { family: FONT_FAMILY, size: 14 },
      color: INDICATOR_DISABLED_COLOR,
      originX: 0,
      originY: 0.5,
      textureManager: this.config.textureManager,
    });
    this.startIndicator.setInteractive({
      x: 0,
      y: -INDICATOR_X_WIDTH,
      width: INDICATOR_X_WIDTH,
      height: INDICATOR_X_WIDTH * 2,
    });
    this.wireIndicator(this.startIndicator, "start");
    this.container.add(this.startIndicator);

    this.endIndicator = new Text({
      x: this.config.width + 2,
      y: cy,
      text: glyphs.end,
      font: { family: FONT_FAMILY, size: 14 },
      color: INDICATOR_DISABLED_COLOR,
      originX: 0,
      originY: 0.5,
      textureManager: this.config.textureManager,
    });
    this.endIndicator.setInteractive({
      x: 0,
      y: -INDICATOR_X_WIDTH,
      width: INDICATOR_X_WIDTH,
      height: INDICATOR_X_WIDTH * 2,
    });
    this.wireIndicator(this.endIndicator, "end");
    this.container.add(this.endIndicator);
  }

  private wireIndicator(indicator: Text, side: "start" | "end"): void {
    indicator.on("pointerover", () => {
      if (this.canScrollToward(side)) {
        indicator.setColor(INDICATOR_HOVER_COLOR);
      }
    });
    indicator.on("pointerout", () => {
      indicator.setColor(this.colorForSide(side));
    });
    indicator.on("pointerdown", () => {
      playR3Sfx("title-button-click");
      const step = this.config.scrollStep ?? this.defaultStep;
      this.scrollBy(side === "start" ? -step : step);
    });
  }

  private canScrollToward(side: "start" | "end"): boolean {
    const y = this.model.getScrollY();
    if (side === "start") {
      return y > 0;
    }
    return y < this.model.maxScrollY;
  }

  private colorForSide(side: "start" | "end"): string {
    return this.canScrollToward(side) ? INDICATOR_COLOR : INDICATOR_DISABLED_COLOR;
  }

  private updateIndicators(): void {
    this.updateIndicatorsFor(this.model.getScrollY());
  }

  private updateIndicatorsFor(offset: number): void {
    if (!this.showIndicators) {
      return;
    }
    if (this.startIndicator) {
      this.startIndicator.setColor(offset > 0 ? INDICATOR_COLOR : INDICATOR_DISABLED_COLOR);
      this.startIndicator.setVisible(this.model.scrollable);
    }
    if (this.endIndicator) {
      const atEnd = offset < this.model.maxScrollY;
      this.endIndicator.setColor(atEnd ? INDICATOR_COLOR : INDICATOR_DISABLED_COLOR);
      this.endIndicator.setVisible(this.model.scrollable);
    }
  }

  private containsViewportPoint(x: number, y: number): boolean {
    this.container.obj3d.updateWorldMatrix(true, false);
    TMP_INV.copy(this.container.obj3d.matrixWorld).invert();
    TMP_POINT.set(x, -y, 0).applyMatrix4(TMP_INV);
    const localX = TMP_POINT.x;
    const localY = -TMP_POINT.y;
    return isInsideRect(localX, localY, 0, 0, this.config.width, this.config.height);
  }

  private refreshClippingPlanes(): void {
    this.container.obj3d.updateWorldMatrix(true, false);
    const corners = worldCornersFor(this.container.obj3d.matrixWorld, this.config.width, this.config.height);
    const centre = worldPoint(this.container.obj3d.matrixWorld, this.config.width / 2, this.config.height / 2);
    setEdgePlane(this.clippingPlanes[0], corners[0], corners[1], centre);
    setEdgePlane(this.clippingPlanes[1], corners[1], corners[2], centre);
    setEdgePlane(this.clippingPlanes[2], corners[2], corners[3], centre);
    setEdgePlane(this.clippingPlanes[3], corners[3], corners[0], centre);
    this.content.setClippingPlanes(this.clippingPlanes);
  }
}

/**
 * Builds the four world-space clipping planes that confine fragments
 * to the panel's viewport rect.
 *
 * In r3 logical space Y grows downward; the Stage's Three world
 * inverts that (Y up) by negating Y at every Node transform write.
 * We therefore convert each rect edge accordingly:
 *
 *   r3 left  (x = x1)         → world plane normal=( 1,0,0), constant=-x1
 *   r3 right (x = x1 + w)     → world plane normal=(-1,0,0), constant= x1+w
 *   r3 top   (y = y1)         → world plane normal=(0,-1,0), constant=-y1
 *   r3 bot   (y = y1 + h)     → world plane normal=(0, 1,0), constant= y1+h
 *
 * Clipping keeps fragments where `n · p + constant > 0`. The plane
 * normals point INTO the kept half-space.
 */
function buildPlanesFor(x: number, y: number, width: number, height: number): Plane[] {
  const x1 = x;
  const x2 = x + width;
  const y1 = y;
  const y2 = y + height;
  return [
    new Plane(new Vector3(1, 0, 0), -x1),
    new Plane(new Vector3(-1, 0, 0), x2),
    // For the Y planes the world-space Y is the negation of r3's Y.
    // "Keep r3 y >= y1" → "keep world y <= -y1" → normal=(0,-1,0),
    // constant=-y1. "Keep r3 y <= y2" → "keep world y >= -y2" →
    // normal=(0,1,0), constant=y2.
    new Plane(new Vector3(0, -1, 0), -y1),
    new Plane(new Vector3(0, 1, 0), y2),
  ];
}

function worldCornersFor(
  matrix: Matrix4,
  width: number,
  height: number,
): readonly [Vector3, Vector3, Vector3, Vector3] {
  return [
    worldPoint(matrix, 0, 0, TMP_C0),
    worldPoint(matrix, width, 0, TMP_C1),
    worldPoint(matrix, width, height, TMP_C2),
    worldPoint(matrix, 0, height, TMP_C3),
  ];
}

function worldPoint(matrix: Matrix4, x: number, y: number, out = TMP_POINT2): Vector3 {
  return out.set(x, -y, 0).applyMatrix4(matrix);
}

function setEdgePlane(
  plane: Plane | undefined,
  a: Vector3 | undefined,
  b: Vector3 | undefined,
  centre: Vector3,
): void {
  if (!plane || !a || !b) {
    return;
  }
  TMP_EDGE_Z.copy(a).add(Z_AXIS);
  plane.setFromCoplanarPoints(a, b, TMP_EDGE_Z);
  if (plane.distanceToPoint(centre) < 0) {
    plane.negate();
  }
}

function isInsideRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

const TMP_INV = new Matrix4();
const TMP_POINT = new Vector3();
const TMP_POINT2 = new Vector3();
const TMP_C0 = new Vector3();
const TMP_C1 = new Vector3();
const TMP_C2 = new Vector3();
const TMP_C3 = new Vector3();
const TMP_EDGE_Z = new Vector3();
const Z_AXIS = new Vector3(0, 0, 1);
