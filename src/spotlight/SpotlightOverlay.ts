/**
 * @file game r3 spotlight SpotlightOverlay.
 */
import { Container } from "../Container.ts";
import { Graphics } from "../Graphics.ts";
import type { Stage } from "../Stage.ts";
import type { TextureManager } from "../texture-canvas";
import {
  absolute,
  arrangeOneShot,
  flexBox,
  leaf,
  type LayoutKeyRegistry,
  type LayoutNode,
  type LayoutRect,
  type LayoutTargetSnapshot,
} from "../layout-engine";

export const SPOTLIGHT_OVERLAY_DEPTH = 10_500;

export type SpotlightAnchorSide = "top" | "right" | "bottom" | "left";

export type SpotlightTarget = {
  readonly targetKey: string;
  readonly preferredSide?: SpotlightAnchorSide;
};

export type SpotlightOverlayLayout = {
  readonly target: LayoutRect;
  readonly focus: LayoutRect;
  readonly callout: LayoutRect;
  readonly connectorStart: { readonly x: number; readonly y: number };
  readonly connectorEnd: { readonly x: number; readonly y: number };
  readonly side: SpotlightAnchorSide;
};

export type SpotlightAdornmentRenderContext = {
  readonly root: Container;
  readonly graphics: Graphics;
  readonly layout: SpotlightOverlayLayout;
  readonly viewport: LayoutRect;
  readonly textureManager: TextureManager;
};

export type SpotlightAdornmentRenderer = (context: SpotlightAdornmentRenderContext) => void;

export type SpotlightOverlayOptions = {
  readonly stage: Stage;
  readonly registry: LayoutKeyRegistry;
  readonly target: SpotlightTarget;
  readonly textureManager?: TextureManager;
  readonly adornmentRenderer?: SpotlightAdornmentRenderer;
  readonly onActivate?: () => void;
  readonly depth?: number;
};

export type SpotlightOverlayHandle = {
  readonly node: Container;
  readonly layout: () => SpotlightOverlayLayout | null;
  readonly setTarget: (target: SpotlightTarget) => void;
  readonly refresh: () => void;
  readonly dispose: () => void;
};

const OVERLAY = {
  dim: 0x050608,
  ring: 0xf4d47a,
  arrow: 0xf4d47a,
} as const;

const FOCUS_PAD = 8;
const CALLOUT_GAP = 24;
const EDGE_PAD = 16;
const CALLOUT_MAX_WIDTH = 360;
const CALLOUT_MIN_WIDTH = 220;
const CALLOUT_HEIGHT = 132;
const FIRST_SHOW_MS = 140;
const FOLLOW_LAYOUT_MS = 180;
const STEP_SWITCH_MS = 120;






/** Return install spotlight overlay. */
export function installSpotlightOverlay(
  options: SpotlightOverlayOptions,
): SpotlightOverlayHandle {
  const textureManager = options.textureManager ?? options.stage.textureManager;
  const root = new Container({ name: "r3:spotlight-overlay" });
  root.setDepth(options.depth ?? SPOTLIGHT_OVERLAY_DEPTH);
  root.setAlpha(0);
  options.stage.add(root);

  const mask = new Graphics({
    width: options.stage.screen.width,
    height: options.stage.screen.height,
    originX: 0,
    originY: 0,
    textureManager,
  });
  const chrome = new Graphics({
    width: options.stage.screen.width,
    height: options.stage.screen.height,
    originX: 0,
    originY: 0,
    textureManager,
  });
  const adornment = new Graphics({
    width: options.stage.screen.width,
    height: options.stage.screen.height,
    originX: 0,
    originY: 0,
    textureManager,
  });
  const adornmentRoot = new Container({ name: "r3:spotlight-overlay:adornment-root" });

  root.add(mask);
  root.add(chrome);
  root.add(adornment);
  root.add(adornmentRoot);
  root.setInteractiveRect(options.stage.screen.width, options.stage.screen.height);
  if (options.onActivate) {
    root.on("pointerdown", () => options.onActivate?.());
  }

  const overlayState: {
    target: SpotlightTarget;
    latest: SpotlightOverlayLayout | null;
  } = {
    target: options.target,
    latest: null,
  };
  const animation = createLayoutAnimationState();

  const draw = (layout: SpotlightOverlayLayout): void => {
    overlayState.latest = layout;
    const screen = options.stage.screen;
    mask.setSize(screen.width, screen.height);
    chrome.setSize(screen.width, screen.height);
    adornment.setSize(screen.width, screen.height);
    root.setInteractiveRect(screen.width, screen.height);
    drawMask(mask, screen.width, screen.height, layout.focus);
    drawChrome(chrome, layout);
    adornment.clear();
    options.adornmentRenderer?.({
      root: adornmentRoot,
      graphics: adornment,
      layout,
      viewport: { x: 0, y: 0, width: screen.width, height: screen.height },
      textureManager,
    });
  };

  const switchStepTo = (next: SpotlightOverlayLayout): void => {
    root.setVisible(true);
    options.stage.tweens.killTweensOf(animation);
    options.stage.tweens.killTweensOf(chrome);
    options.stage.tweens.killTweensOf(adornment);
    options.stage.tweens.killTweensOf(adornmentRoot);
    chrome.setAlpha(0);
    adornment.setAlpha(0);
    adornmentRoot.setAlpha(0);
    draw(next);
    options.stage.tweens.add({
      targets: [chrome, adornment, adornmentRoot],
      alpha: 1,
      duration: STEP_SWITCH_MS,
      ease: "Quad.easeOut",
    });
  };

  const animateTo = (next: SpotlightOverlayLayout): void => {
    root.setVisible(true);
    if (!overlayState.latest) {
      chrome.setAlpha(1);
      adornment.setAlpha(1);
      adornmentRoot.setAlpha(1);
      writeAnimationState(animation, next);
      draw(next);
      options.stage.tweens.killTweensOf(root);
      options.stage.tweens.add({
        targets: root,
        alpha: 1,
        duration: FIRST_SHOW_MS,
        ease: "Quad.easeOut",
      });
      return;
    }
    writeAnimationState(animation, overlayState.latest);
    options.stage.tweens.killTweensOf(animation);
    options.stage.tweens.add({
      targets: animation,
      duration: FOLLOW_LAYOUT_MS,
      ease: "Cubic.easeOut",
      focusX: next.focus.x,
      focusY: next.focus.y,
      focusWidth: next.focus.width,
      focusHeight: next.focus.height,
      calloutX: next.callout.x,
      calloutY: next.callout.y,
      calloutWidth: next.callout.width,
      calloutHeight: next.callout.height,
      connectorStartX: next.connectorStart.x,
      connectorStartY: next.connectorStart.y,
      connectorEndX: next.connectorEnd.x,
      connectorEndY: next.connectorEnd.y,
      onUpdate: () => {
        draw(layoutFromAnimationState(animation, next));
      },
      onComplete: () => {
        draw(next);
      },
    });
  };

  const computeNextLayout = (): SpotlightOverlayLayout | null => {
    const snapshot = options.registry.get(overlayState.target.targetKey);
    if (!snapshot) {
      return null;
    }
    return computeSpotlightOverlayLayout({
      viewport: {
        x: 0,
        y: 0,
        width: options.stage.screen.width,
        height: options.stage.screen.height,
      },
      target: snapshot,
      preferredSide: overlayState.target.preferredSide,
    });
  };

  const repaint = (mode: "follow-layout" | "switch-step" = "follow-layout"): void => {
    const next = computeNextLayout();
    if (!next) {
      overlayState.latest = null;
      root.setVisible(false);
      return;
    }
    if (mode === "switch-step") {
      switchStepTo(next);
      return;
    }
    animateTo(next);
  };

  repaint();
  const unsubscribe = options.stage.onScreenChange(() => repaint());

  return {
    node: root,
    layout: () => overlayState.latest,
    setTarget(next): void {
      overlayState.target = next;
      repaint("switch-step");
    },
    refresh: repaint,
    dispose(): void {
      unsubscribe();
      options.stage.tweens.killTweensOf(animation);
      options.stage.tweens.killTweensOf(root);
      options.stage.tweens.killTweensOf(chrome);
      options.stage.tweens.killTweensOf(adornment);
      options.stage.tweens.killTweensOf(adornmentRoot);
      root.destroy();
    },
  };
}






/** Create spotlight arrow renderer. */
export function createSpotlightArrowRenderer(options: {
  readonly color?: number;
  readonly alpha?: number;
  readonly width?: number;
} = {}): SpotlightAdornmentRenderer {
  const color = options.color ?? OVERLAY.arrow;
  const alpha = options.alpha ?? 0.95;
  const width = options.width ?? 3;
  return ({ graphics, layout }) => {
    graphics.lineStyle(width, color, alpha);
    graphics.strokeLine(
      layout.connectorStart.x,
      layout.connectorStart.y,
      layout.connectorEnd.x,
      layout.connectorEnd.y,
    );
    drawArrowHead(graphics, layout.connectorStart, layout.connectorEnd, color, alpha);
  };
}






/** Compute spotlight overlay layout. */
export function computeSpotlightOverlayLayout(options: {
  readonly viewport: LayoutRect;
  readonly target: LayoutTargetSnapshot | LayoutRect;
  readonly preferredSide?: SpotlightAnchorSide;
}): SpotlightOverlayLayout {
  const target = "rect" in options.target ? options.target.visualRect : options.target;
  const viewport = options.viewport;
  const paddedFocus = insetRect(target, -FOCUS_PAD, viewport);
  const calloutWidth = Math.min(
    CALLOUT_MAX_WIDTH,
    Math.max(CALLOUT_MIN_WIDTH, viewport.width - EDGE_PAD * 2),
  );
  const candidates = orderedSides(options.preferredSide);
  const side = candidates.find((candidate) =>
    spaceForSide(candidate, paddedFocus, viewport, calloutWidth, CALLOUT_HEIGHT),
  ) ?? sideWithMostSpace(paddedFocus, viewport);
  const placement: { focus: LayoutRect; callout: LayoutRect } = {
    focus: paddedFocus,
    callout: {
      x: viewport.x + EDGE_PAD,
      y: viewport.y + EDGE_PAD,
      width: calloutWidth,
      height: CALLOUT_HEIGHT,
    },
  };
  arrangeOneShot(
    spotlightLayoutTree({
      focus: paddedFocus,
      side,
      viewport,
      calloutWidth,
      calloutHeight: CALLOUT_HEIGHT,
      onFocus: (rect) => {
        placement.focus = rect;
      },
      onCallout: (rect) => {
        placement.callout = rect;
      },
    }),
    viewport,
  );
  return {
    target,
    focus: placement.focus,
    callout: placement.callout,
    side,
    connectorStart: rectBoundaryPointToward(placement.callout, placement.focus),
    connectorEnd: rectBoundaryPointToward(placement.focus, placement.callout),
  };
}

function spotlightLayoutTree(options: {
  readonly focus: LayoutRect;
  readonly side: SpotlightAnchorSide;
  readonly viewport: LayoutRect;
  readonly calloutWidth: number;
  readonly calloutHeight: number;
  readonly onFocus: (rect: LayoutRect) => void;
  readonly onCallout: (rect: LayoutRect) => void;
}): LayoutNode {
  return flexBox({
    width: options.viewport.width,
    height: options.viewport.height,
    absolute: [
      absolute({
        node: leaf({
          width: options.focus.width,
          height: options.focus.height,
          onRect: options.onFocus,
        }),
        place: () => options.focus,
      }),
      absolute({
        node: leaf({
          width: options.calloutWidth,
          height: options.calloutHeight,
          onRect: options.onCallout,
        }),
        place: (viewport) =>
          placeCallout(
            options.side,
            options.focus,
            viewport,
            options.calloutWidth,
            options.calloutHeight,
          ),
      }),
    ],
  });
}

function drawMask(
  graphics: Graphics,
  width: number,
  height: number,
  focus: LayoutRect,
): void {
  graphics.clear();
  graphics.fillStyle(OVERLAY.dim, 0.62);
  graphics.fillRect(0, 0, width, Math.max(0, focus.y));
  graphics.fillRect(0, focus.y + focus.height, width, Math.max(0, height - focus.y - focus.height));
  graphics.fillRect(0, focus.y, Math.max(0, focus.x), focus.height);
  graphics.fillRect(focus.x + focus.width, focus.y, Math.max(0, width - focus.x - focus.width), focus.height);
}

function drawChrome(graphics: Graphics, layout: SpotlightOverlayLayout): void {
  graphics.clear();
  graphics.lineStyle(3, OVERLAY.ring, 0.95);
  graphics.strokeRoundedRect(layout.focus.x, layout.focus.y, layout.focus.width, layout.focus.height, 10);
}

function drawArrowHead(
  graphics: Graphics,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  color: number,
  alpha: number,
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const len = 12;
  const spread = 0.55;
  const left = {
    x: to.x - Math.cos(angle - spread) * len,
    y: to.y - Math.sin(angle - spread) * len,
  };
  const right = {
    x: to.x - Math.cos(angle + spread) * len,
    y: to.y - Math.sin(angle + spread) * len,
  };
  graphics.fillStyle(color, alpha);
  graphics.fillTriangle(to.x, to.y, left.x, left.y, right.x, right.y);
}

function insetRect(rect: LayoutRect, amount: number, bounds: LayoutRect): LayoutRect {
  const x = clamp(rect.x + amount, bounds.x, bounds.x + bounds.width);
  const y = clamp(rect.y + amount, bounds.y, bounds.y + bounds.height);
  const right = clamp(rect.x + rect.width - amount, bounds.x, bounds.x + bounds.width);
  const bottom = clamp(rect.y + rect.height - amount, bounds.y, bounds.y + bounds.height);
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

function orderedSides(preferred: SpotlightAnchorSide | undefined): readonly SpotlightAnchorSide[] {
  const all: readonly SpotlightAnchorSide[] = ["bottom", "top", "right", "left"];
  if (!preferred) {
    return all;
  }
  return [preferred, ...all.filter((side) => side !== preferred)];
}

function spaceForSide(
  side: SpotlightAnchorSide,
  focus: LayoutRect,
  viewport: LayoutRect,
  width: number,
  height: number,
): boolean {
  if (side === "top") {
    return focus.y - viewport.y >= height + CALLOUT_GAP + EDGE_PAD;
  }
  if (side === "bottom") {
    return viewport.y + viewport.height - (focus.y + focus.height) >= height + CALLOUT_GAP + EDGE_PAD;
  }
  if (side === "left") {
    return focus.x - viewport.x >= width + CALLOUT_GAP + EDGE_PAD;
  }
  return viewport.x + viewport.width - (focus.x + focus.width) >= width + CALLOUT_GAP + EDGE_PAD;
}

function sideWithMostSpace(focus: LayoutRect, viewport: LayoutRect): SpotlightAnchorSide {
  const spaces: Readonly<Record<SpotlightAnchorSide, number>> = {
    top: focus.y - viewport.y,
    bottom: viewport.y + viewport.height - (focus.y + focus.height),
    left: focus.x - viewport.x,
    right: viewport.x + viewport.width - (focus.x + focus.width),
  };
  return (Object.entries(spaces) as Array<[SpotlightAnchorSide, number]>)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "bottom";
}

function placeCallout(
  side: SpotlightAnchorSide,
  focus: LayoutRect,
  viewport: LayoutRect,
  width: number,
  height: number,
): LayoutRect {
  if (side === "top" || side === "bottom") {
    return {
      x: clamp(focus.x + focus.width / 2 - width / 2, viewport.x + EDGE_PAD, viewport.x + viewport.width - width - EDGE_PAD),
      y: clamp(
        side === "top" ? focus.y - CALLOUT_GAP - height : focus.y + focus.height + CALLOUT_GAP,
        viewport.y + EDGE_PAD,
        viewport.y + viewport.height - height - EDGE_PAD,
      ),
      width,
      height,
    };
  }
  return {
    x: clamp(
      side === "left" ? focus.x - CALLOUT_GAP - width : focus.x + focus.width + CALLOUT_GAP,
      viewport.x + EDGE_PAD,
      viewport.x + viewport.width - width - EDGE_PAD,
    ),
    y: clamp(focus.y + focus.height / 2 - height / 2, viewport.y + EDGE_PAD, viewport.y + viewport.height - height - EDGE_PAD),
    width,
    height,
  };
}

function rectBoundaryPointToward(
  rect: LayoutRect,
  toward: LayoutRect,
): { readonly x: number; readonly y: number } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const tx = toward.x + toward.width / 2;
  const ty = toward.y + toward.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }
  const halfW = Math.max(0.001, rect.width / 2);
  const halfH = Math.max(0.001, rect.height / 2);
  const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

type SpotlightAnimationState = {
  focusX: number;
  focusY: number;
  focusWidth: number;
  focusHeight: number;
  calloutX: number;
  calloutY: number;
  calloutWidth: number;
  calloutHeight: number;
  connectorStartX: number;
  connectorStartY: number;
  connectorEndX: number;
  connectorEndY: number;
};

function createLayoutAnimationState(): SpotlightAnimationState {
  return {
    focusX: 0,
    focusY: 0,
    focusWidth: 0,
    focusHeight: 0,
    calloutX: 0,
    calloutY: 0,
    calloutWidth: 0,
    calloutHeight: 0,
    connectorStartX: 0,
    connectorStartY: 0,
    connectorEndX: 0,
    connectorEndY: 0,
  };
}

function writeAnimationState(
  state: SpotlightAnimationState,
  layout: SpotlightOverlayLayout,
): void {
  state.focusX = layout.focus.x;
  state.focusY = layout.focus.y;
  state.focusWidth = layout.focus.width;
  state.focusHeight = layout.focus.height;
  state.calloutX = layout.callout.x;
  state.calloutY = layout.callout.y;
  state.calloutWidth = layout.callout.width;
  state.calloutHeight = layout.callout.height;
  state.connectorStartX = layout.connectorStart.x;
  state.connectorStartY = layout.connectorStart.y;
  state.connectorEndX = layout.connectorEnd.x;
  state.connectorEndY = layout.connectorEnd.y;
}

function layoutFromAnimationState(
  state: SpotlightAnimationState,
  next: SpotlightOverlayLayout,
): SpotlightOverlayLayout {
  return {
    ...next,
    focus: {
      x: state.focusX,
      y: state.focusY,
      width: state.focusWidth,
      height: state.focusHeight,
    },
    callout: {
      x: state.calloutX,
      y: state.calloutY,
      width: state.calloutWidth,
      height: state.calloutHeight,
    },
    connectorStart: {
      x: state.connectorStartX,
      y: state.connectorStartY,
    },
    connectorEnd: {
      x: state.connectorEndX,
      y: state.connectorEndY,
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}
