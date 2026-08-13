/**
 * @file Visual indicator for {@link LayoutEditor}.
 *
 * Draws a selection outline around the currently-selected node and
 * 8 resize handles at its corners / edge mid-points. When the node
 * isn't movable (flow child before auto-promotion) the selection
 * takes a muted tone; handle fills likewise swap so a glance tells
 * the user whether the drag will actually move anything.
 *
 * Also renders an optional snap grid at the editor's current
 * `snapSize` — a hint so the user can read where items will land.
 *
 * This is an r3 Graphics overlay stacked above the application's
 * own HUD / inspector overlays.
 */

import { Container } from "../../Container.ts";
import { Graphics } from "../../Graphics.ts";
import type { Stage } from "../../Stage.ts";
import type { TextureManager } from "../../texture-canvas";
import type { LayoutRect } from "..";
import { ALL_HANDLES, HANDLE_SIZE, handleRect } from "./editor.ts";

/** Default depth — above every application overlay. */
export const LAYOUT_EDITOR_OVERLAY_DEPTH = 11_000;

const COLORS = {
  selection: 0x5ad0ff,
  selectionFlow: 0xf0cc80,
  handleFill: 0xffffff,
  handleFillFlow: 0x8a7050,
  handleStroke: 0x5ad0ff,
  grid: 0xffffff,
} as const;

export type LayoutEditorOverlayOptions = {
  readonly stage: Stage;
  readonly textureManager: TextureManager;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly selectedRect: LayoutRect | null;
  readonly isMovable: boolean;
  readonly isResizable: boolean;
  readonly snapSize: number;
  readonly showGrid: boolean;
  readonly depth?: number;
};

export type LayoutEditorOverlayHandle = {
  readonly dispose: () => void;
};

/**
 * Installs the editor visual indicator on `stage`. Call
 * {@link LayoutEditorOverlayHandle.dispose} and re-install whenever
 * selection / snap / rect / grid-visibility changes.
 */
export function installLayoutEditorOverlay(
  options: LayoutEditorOverlayOptions,
): LayoutEditorOverlayHandle {
  const {
    stage,
    viewport,
    selectedRect,
    isMovable,
    isResizable,
    snapSize,
    showGrid,
  } = options;

  const root = new Container({ name: "r3:layout-editor:overlay" });
  root.setDepth(options.depth ?? LAYOUT_EDITOR_OVERLAY_DEPTH);
  stage.add(root);

  const canvas = new Graphics({
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
    originX: 0,
    originY: 0,
    textureManager: options.textureManager,
  });
  root.add(canvas);

  if (showGrid && snapSize > 1) {
    drawSnapGrid(canvas, viewport.width, viewport.height, snapSize);
  }

  if (selectedRect) {
    drawSelection(canvas, selectedRect, isMovable);
    if (isResizable) {
      drawHandles(canvas, selectedRect, isMovable);
    }
  }

  return {
    dispose: () => {
      root.destroy();
    },
  };
}

function drawSnapGrid(
  graphics: Graphics,
  width: number,
  height: number,
  step: number,
): void {
  graphics.lineStyle(1, COLORS.grid, 0.06);
  for (let x = step; x < width; x += step) {
    graphics.strokeLine(x, 0, x, height);
  }
  for (let y = step; y < height; y += step) {
    graphics.strokeLine(0, y, width, y);
  }
}

function drawSelection(
  graphics: Graphics,
  rect: LayoutRect,
  isMovable: boolean,
): void {
  const color = isMovable ? COLORS.selection : COLORS.selectionFlow;
  graphics.lineStyle(2, color, 0.95);
  graphics.strokeRect(
    rect.x - 1,
    rect.y - 1,
    Math.max(0, rect.width + 2),
    Math.max(0, rect.height + 2),
  );
}

function drawHandles(graphics: Graphics, rect: LayoutRect, isMovable: boolean): void {
  const fill = isMovable ? COLORS.handleFill : COLORS.handleFillFlow;
  for (const handle of ALL_HANDLES) {
    const hr = handleRect(rect, handle);
    graphics.fillStyle(fill, 1);
    graphics.fillRect(hr.x, hr.y, HANDLE_SIZE, HANDLE_SIZE);
    graphics.lineStyle(1, COLORS.handleStroke, 1);
    graphics.strokeRect(hr.x + 0.5, hr.y + 0.5, HANDLE_SIZE - 1, HANDLE_SIZE - 1);
  }
}
