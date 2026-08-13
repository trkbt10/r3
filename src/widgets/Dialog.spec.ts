/**
 * @vitest-environment happy-dom
 *
 * @file Dialog — open/build/close lifecycle.
 *
 * Verifies that the open + close flow runs the same number of
 * tweens regardless of which path tore the dialog down (caller-
 * destroy vs animated close), and that the build callback gets a
 * usable content container.
 */

import { Stage } from "../Stage.ts";
import { Container } from "../Container.ts";
import { defaultTextureManager } from "../texture-canvas";
import {
  R3_DIALOG_CARD_PAD,
  cardGraphicsSize,
  drawCardLocal,
  openR3Dialog,
  type R3CardDrawTarget,
  type R3DialogVisual,
} from "./Dialog.ts";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 1280, height: 720 },
    textureManager: defaultTextureManager,
  });
}

describe("openR3Dialog", () => {
  it("attaches the dialog root to the stage and runs the build callback", () => {
    const stage = makeStage();
    const built: Container[] = [];
    const handle = openR3Dialog({
      stage,
      textureManager: defaultTextureManager,
      size: { width: 600, height: 400 },
      build(ctx) {
        built.push(ctx.content);
      },
    });
    expect(stage.root.children).toContain(handle.node);
    expect(built).toHaveLength(1);
    handle.destroy();
    expect(stage.root.children).not.toContain(handle.node);
  });

  it("close() fires onClose exactly once and tears the dialog down", () => {
    const stage = makeStage();
    const closes: number[] = [];
    const handle = openR3Dialog({
      stage,
      textureManager: defaultTextureManager,
      size: { width: 600, height: 400 },
      build(ctx) {
        ctx.close();
        ctx.close(); // second close should be a no-op
      },
      onClose() {
        closes.push(1);
      },
    });
    // Wait past closeHoldMs (default 220ms).
    stage.tick(300);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(closes).toHaveLength(1);
        expect(stage.root.children).not.toContain(handle.node);
        resolve();
      }, 250);
    });
  });

  it("dismissOnBackdrop wires backdrop pointerdown to close()", () => {
    const stage = makeStage();
    const closes: number[] = [];
    const handle = openR3Dialog({
      stage,
      textureManager: defaultTextureManager,
      size: { width: 200, height: 100 },
      dismissOnBackdrop: true,
      build() {
        // no-op
      },
      onClose() {
        closes.push(1);
      },
    });
    stage.composeFrame();
    // Click in the corner — outside the card, on the backdrop.
    stage.pointer.feedDown(10, 10);
    stage.pointer.feedUp(10, 10);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(closes).toHaveLength(1);
        handle.destroy();
        resolve();
      }, 250);
    });
  });

  it("destroy after a user-driven close is a safe no-op", () => {
    const stage = makeStage();
    const closes: number[] = [];
    const handle = openR3Dialog({
      stage,
      textureManager: defaultTextureManager,
      size: { width: 200, height: 100 },
      build(ctx) {
        ctx.close();
      },
      onClose() {
        closes.push(1);
      },
    });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(closes).toHaveLength(1);
        // Manual destroy after close should not double-fire onClose
        // and must not throw.
        expect(() => handle.destroy()).not.toThrow();
        resolve();
      }, 250);
    });
  });

  it("scales the card down when the authored size exceeds the screen viewbox", () => {
    // Mobile portrait (390 × 844) — a 720-wide settings-style card
    // would overflow without the fit-to-viewbox scale.
    const stage = new Stage({
    screen: { width: 390, height: 844 },
    textureManager: defaultTextureManager,
  });
    const handle = openR3Dialog({
      stage,
      textureManager: defaultTextureManager,
      size: { width: 720, height: 540 },
      build() {},
    });
    // The card chrome lives one level under the dialog root. Its
    // scale carries the fit factor — < 1 means we shrunk to fit.
    const root = handle.node;
    // root.children: [backdrop, cardWrap, contentWrap]
    const cardWrap = root.children[1];
    expect(cardWrap).toBeDefined();
    if (cardWrap) {
      // After the open animation the scale settles at the fit factor
      // (around 390 * 0.94 / 720 ≈ 0.51); we read the *initial* state
      // here, which is `0.9 × fit` — both should be < 1.
      expect(cardWrap.scaleX).toBeLessThan(1);
      expect(cardWrap.scaleY).toBeLessThan(1);
      expect(cardWrap.scaleX).toBe(cardWrap.scaleY);
    }
    handle.destroy();
  });

  it("keeps card scale at 1 when the authored size fits the viewbox", () => {
    // PC viewport — the historical 600 × 400 dialog must stay
    // pixel-equivalent. Initial scale is 0.9 (the open-pop start).
    const stage = makeStage();
    const handle = openR3Dialog({
      stage,
      textureManager: defaultTextureManager,
      size: { width: 600, height: 400 },
      build() {},
    });
    const cardWrap = handle.node.children[1];
    expect(cardWrap).toBeDefined();
    if (cardWrap) {
      // Initial pop scale is `0.9 × fit` = 0.9 × 1 = 0.9.
      expect(cardWrap.scaleX).toBe(0.9);
      expect(cardWrap.scaleY).toBe(0.9);
    }
    handle.destroy();
  });
});

/* ── card-draw regression cover ──────────────────────────────────── */

/**
 * The bug this section pins: `drawCardLocal` used to draw at
 * `x = -width/2` assuming the Graphics had a Phaser-style vector
 * origin at the node centre. r3's Graphics is a rasterised Canvas2D
 * surface — any negative offset falls outside the allocated bitmap
 * and produces no pixels. The fix draws at `(pad, pad)` with
 * `pad = 8` against a Graphics whose canvas is sized
 * `(w + 16) × (h + 16)`.
 *
 * {@link RecordingCardTarget} stands in for a real Graphics so
 * these tests can assert exact draw arguments without paying for a
 * Canvas2D context. Production `Graphics` still satisfies
 * {@link R3CardDrawTarget} structurally.
 */

type RecordedCall =
  | { readonly kind: "clear" }
  | { readonly kind: "fillStyle"; readonly color: number; readonly alpha: number | undefined }
  | {
      readonly kind: "lineStyle";
      readonly width: number;
      readonly color: number;
      readonly alpha: number | undefined;
    }
  | {
      readonly kind: "fillRoundedRect";
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly r: number;
    }
  | {
      readonly kind: "strokeRoundedRect";
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly r: number;
    };

type RectCall = Extract<RecordedCall, { kind: "fillRoundedRect" | "strokeRoundedRect" }>;

class RecordingCardTarget implements R3CardDrawTarget {
  readonly calls: RecordedCall[] = [];

  clear(): void {
    this.calls.push({ kind: "clear" });
  }
  fillStyle(color: number, alpha?: number): void {
    this.calls.push({ kind: "fillStyle", color, alpha });
  }
  lineStyle(width: number, color: number, alpha?: number): void {
    this.calls.push({ kind: "lineStyle", width, color, alpha });
  }
  fillRoundedRect(x: number, y: number, w: number, h: number, r: number): void {
    this.calls.push({ kind: "fillRoundedRect", x, y, w, h, r });
  }
  strokeRoundedRect(x: number, y: number, w: number, h: number, r: number): void {
    this.calls.push({ kind: "strokeRoundedRect", x, y, w, h, r });
  }

  rectCalls(): readonly RectCall[] {
    const out: RectCall[] = [];
    for (const call of this.calls) {
      if (call.kind === "fillRoundedRect" || call.kind === "strokeRoundedRect") {
        out.push(call);
      }
    }
    return out;
  }
}

const SAMPLE_VISUAL: R3DialogVisual = {
  fillColor: 0xf5e6c6,
  borderColor: 0x7a5a32,
  accentColor: 0xb88a2c,
  backdropColor: 0x080603,
  backdropAlpha: 0.55,
  radius: 22,
};

describe("cardGraphicsSize", () => {
  it("adds 2×pad to both axes so the outer stroke has breathing room", () => {
    const pad = R3_DIALOG_CARD_PAD;
    expect(cardGraphicsSize(400, 300)).toStrictEqual({
      width: 400 + pad * 2,
      height: 300 + pad * 2,
    });
  });

  it("scales with arbitrary card sizes", () => {
    const pad = R3_DIALOG_CARD_PAD;
    const tall = cardGraphicsSize(100, 900);
    expect(tall.width).toBe(100 + pad * 2);
    expect(tall.height).toBe(900 + pad * 2);
  });
});

describe("drawCardLocal", () => {
  function runDraw(width: number, height: number): RecordingCardTarget {
    const target = new RecordingCardTarget();
    drawCardLocal(target, width, height, SAMPLE_VISUAL);
    return target;
  }

  it("starts with a clear so a redraw doesn't composite on stale pixels", () => {
    const target = runDraw(400, 300);
    expect(target.calls[0]).toStrictEqual({ kind: "clear" });
  });

  it("every rect draw uses non-negative offsets — the original Canvas2D out-of-bounds regression", () => {
    const target = runDraw(400, 300);
    for (const call of target.rectCalls()) {
      expect(call.x, `${call.kind} x must stay ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(call.y, `${call.kind} y must stay ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(call.w, `${call.kind} width must stay positive`).toBeGreaterThan(0);
      expect(call.h, `${call.kind} height must stay positive`).toBeGreaterThan(0);
    }
  });

  it("draws the outer card at the padded top-left with the caller-provided radius", () => {
    const target = runDraw(400, 300);
    const outerFill = target.rectCalls().find((c) => c.kind === "fillRoundedRect");
    expect(outerFill).toStrictEqual({
      kind: "fillRoundedRect",
      x: R3_DIALOG_CARD_PAD,
      y: R3_DIALOG_CARD_PAD,
      w: 400,
      h: 300,
      r: SAMPLE_VISUAL.radius,
    });
  });

  it("keeps every rect fully inside the canvas that cardGraphicsSize promises", () => {
    const width = 400;
    const height = 300;
    const canvas = cardGraphicsSize(width, height);
    const target = runDraw(width, height);
    for (const call of target.rectCalls()) {
      expect(call.x + call.w, `${call.kind} right edge must stay in canvas`)
        .toBeLessThanOrEqual(canvas.width);
      expect(call.y + call.h, `${call.kind} bottom edge must stay in canvas`)
        .toBeLessThanOrEqual(canvas.height);
    }
  });

  it("nests the inner accent stroke strictly inside the outer card outline", () => {
    const target = runDraw(400, 300);
    const strokes = target.rectCalls().filter((c) => c.kind === "strokeRoundedRect");
    expect(strokes.length).toBe(2);
    const outer = strokes[0];
    const inner = strokes[1];
    if (!outer || !inner) {
      throw new Error("stroke pair missing — drawCardLocal contract changed");
    }
    expect(inner.x).toBeGreaterThan(outer.x);
    expect(inner.y).toBeGreaterThan(outer.y);
    expect(inner.x + inner.w).toBeLessThan(outer.x + outer.w);
    expect(inner.y + inner.h).toBeLessThan(outer.y + outer.h);
  });

  it("clamps the inner radius at 0 when the caller requests a tight radius", () => {
    const target = new RecordingCardTarget();
    drawCardLocal(target, 400, 300, { ...SAMPLE_VISUAL, radius: 2 });
    const strokes = target.rectCalls().filter((c) => c.kind === "strokeRoundedRect");
    const inner = strokes[1];
    if (!inner) {
      throw new Error("inner stroke missing");
    }
    // radius: 2 → innerRadius = max(0, 2 - 4) = 0; the helper should
    // clamp rather than letting a negative radius leak through, which
    // would silently collapse the accent into a sharp-cornered box.
    expect(inner.r).toBe(0);
  });

  it("sets the outer border style before the inner accent style", () => {
    const target = runDraw(400, 300);
    const outerLineStyle = target.calls.findIndex(
      (c) => c.kind === "lineStyle" && c.width === 3,
    );
    const innerLineStyle = target.calls.findIndex(
      (c) => c.kind === "lineStyle" && c.width === 1,
    );
    expect(outerLineStyle).toBeGreaterThanOrEqual(0);
    expect(innerLineStyle).toBeGreaterThan(outerLineStyle);
  });
});
