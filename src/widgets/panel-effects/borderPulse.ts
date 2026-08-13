/**
 * @file borderPulse — animated perimeter stroke that breathes in
 * opacity. Sits on the front layer so it overlays the plaque chrome
 * rather than being occluded by it.
 *
 * Intended as an attention marker — "this panel is active / ready /
 * yours to interact with". The breathing cadence is slow enough to
 * read as intentional (not a seizure-grade strobe) and the alpha
 * range clamps to a non-zero minimum so the stroke never fully
 * disappears between breaths, keeping the panel recognisable as
 * active even at the trough.
 *
 * This is the first effect in the library that uses {@link tick} —
 * its animation progresses with real time. The plaque doesn't drive
 * ticks itself; whichever owner integrates with a frame loop is
 * responsible for calling the handle's `tick(dtSeconds)`. In the
 * sandbox harness that's done explicitly via {@link SandboxCaseHandle.onFrame};
 * in the production HUD it would hook off {@link Stage.onFrame}.
 *
 * Implementation note: the stroke is painted *once* at full
 * {@link OuterGlowOptions.alpha peak alpha}; the per-frame breath
 * modulates the {@link Node.setAlpha node alpha} rather than
 * repainting the Graphics canvas. Repainting every frame would
 * quadruple the texture uploads for no visible gain at this
 * geometric simplicity.
 */

import { Graphics } from "../../Graphics.ts";
import type {
  UiPanelEffect,
  UiPanelEffectContext,
  UiPanelEffectHandle,
  UiPanelEffectRect,
} from "./types.ts";

export type BorderPulseOptions = {
  /** Stroke colour. Default warm gold. */
  readonly color?: number;
  /** Stroke width in CSS pixels. Default 2. */
  readonly width?: number;
  /** Stroke inset from the panel edge. Default 2 — sits just inside the outer frame. */
  readonly inset?: number;
  /** Peak (crest) opacity. Default 0.9. */
  readonly peakAlpha?: number;
  /** Trough opacity. Default 0.25 — non-zero so the outline never vanishes. */
  readonly troughAlpha?: number;
  /** Full breath-cycle length in milliseconds. Default 1800. */
  readonly periodMs?: number;
};

export const BORDER_PULSE_DEFAULTS: Required<BorderPulseOptions> = {
  color: 0xffd27a,
  width: 2,
  inset: 2,
  peakAlpha: 0.9,
  troughAlpha: 0.25,
  periodMs: 1800,
};

type Resolved = Required<BorderPulseOptions>;

function resolve(options: BorderPulseOptions): Resolved {
  return {
    color: options.color ?? BORDER_PULSE_DEFAULTS.color,
    width: options.width ?? BORDER_PULSE_DEFAULTS.width,
    inset: options.inset ?? BORDER_PULSE_DEFAULTS.inset,
    peakAlpha: options.peakAlpha ?? BORDER_PULSE_DEFAULTS.peakAlpha,
    troughAlpha: options.troughAlpha ?? BORDER_PULSE_DEFAULTS.troughAlpha,
    periodMs: options.periodMs ?? BORDER_PULSE_DEFAULTS.periodMs,
  };
}

function paint(
  g: Graphics,
  resolved: Resolved,
  radius: number,
  width: number,
  height: number,
): void {
  g.clear();
  const innerW = Math.max(0, width - resolved.inset * 2);
  const innerH = Math.max(0, height - resolved.inset * 2);
  if (innerW <= 0 || innerH <= 0) {
    return;
  }
  // Paint the stroke at peak alpha; per-frame alpha modulation lives
  // on the Node (setAlpha) so we never re-rasterise.
  g.lineStyle(resolved.width, resolved.color, 1);
  g.strokeRoundedRect(
    resolved.inset,
    resolved.inset,
    innerW,
    innerH,
    Math.max(0, radius - resolved.inset),
  );
}

/**
 * Panel effect: breathing coloured outline on top of the plaque
 * chrome. Attaches to the `front` layer. Advances with {@link tick}
 * — the plaque / sandbox owner drives the clock.
 */
export function borderPulse(
  options: BorderPulseOptions = {},
): UiPanelEffect {
  const resolved = resolve(options);
  return function mount(
    ctx: UiPanelEffectContext,
    rect: UiPanelEffectRect,
  ): UiPanelEffectHandle {
    const node = new Graphics({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      originX: 0,
      originY: 0,
      textureManager: ctx.textureManager,
    });
    paint(node, resolved, ctx.radius, rect.width, rect.height);
    ctx.hosts.front.add(node);

    const state = { elapsedMs: 0 };
    // Initial alpha: at phase 0 the sin wave is at its mid-point, so
    // start the node at the mid alpha rather than snapping in at
    // peak; avoids a jarring first frame.
    node.setAlpha((resolved.peakAlpha + resolved.troughAlpha) / 2);

    return {
      setRect(next: UiPanelEffectRect): void {
        node.setPosition(next.x, next.y);
        node.setSize(next.width, next.height);
        paint(node, resolved, ctx.radius, next.width, next.height);
      },
      tick(dtSeconds: number): boolean {
        state.elapsedMs += dtSeconds * 1000;
        // Full breath cycle in radians. cos phase keeps the alpha at
        // peak when elapsed === 0.5 * period, which looks more
        // alive than sin's zero-crossing start.
        const phase = (state.elapsedMs / resolved.periodMs) * Math.PI * 2;
        const breath = 0.5 - 0.5 * Math.cos(phase);
        const alpha =
          resolved.troughAlpha + (resolved.peakAlpha - resolved.troughAlpha) * breath;
        node.setAlpha(alpha);
        return false;
      },
      destroy(): void {
        node.destroy();
      },
    };
  };
}
