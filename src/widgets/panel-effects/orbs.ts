/**
 * @file orbs — glowing spheres pinned to configurable positions on the
 * panel, each pulsing in and out of phase with the others. Sits on
 * the front layer so the halos overlay the plaque chrome rather than
 * being occluded by it.
 *
 * Default placement is the four corners, which reads as "magical /
 * empowered panel". A caller that wants a single centred orb, two
 * orbs flanking the top edge, or an arbitrary constellation passes
 * `positions` in normalised panel coordinates — `[0, 0]` is the
 * top-left, `[1, 1]` is the bottom-right. Positions are resolved to
 * pixel coordinates on every rect change so orbs stick to their
 * anchors when the panel resizes rather than drifting with the
 * old absolute position.
 *
 * Each orb is one {@link Graphics} node: a blurred halo layer plus a
 * sharp bright core, painted once at full alpha. Per-frame the
 * pulse modulates the node's alpha via {@link setAlpha} — we never
 * re-rasterise the canvas just to breathe intensity. Phase
 * offsets between orbs ({@link OrbsOptions.phaseStagger}) produce
 * the travelling-chase look characteristic of fantasy-game
 * "rune circle" panels.
 */

import { Container } from "../../Container.ts";
import { Graphics } from "../../Graphics.ts";
import type {
  UiPanelEffect,
  UiPanelEffectContext,
  UiPanelEffectHandle,
  UiPanelEffectRect,
} from "./types.ts";

/** One orb anchor, in normalised panel coordinates (0..1 on each axis). */
export type OrbPosition = readonly [number, number];

export type OrbsOptions = {
  /** Orb colour. Default warm gold. */
  readonly color?: number;
  /** Solid-core radius in CSS pixels. Default 4. */
  readonly coreRadius?: number;
  /** Halo outer radius in CSS pixels (before blur). Default 12. */
  readonly haloRadius?: number;
  /** Halo blur radius in CSS pixels. Default 12. */
  readonly haloBlur?: number;
  /** Peak node alpha at the crest of the pulse. Default 1. */
  readonly alphaMax?: number;
  /** Trough node alpha at the valley. Default 0.35 — orbs never fully disappear. */
  readonly alphaMin?: number;
  /** Full pulse cycle length in milliseconds. Default 2400. */
  readonly periodMs?: number;
  /**
   * Phase offset between consecutive orbs as a fraction of
   * {@link periodMs}. Default 0.25 (quarter-cycle) — produces a
   * travelling chase when positions are laid out on a ring.
   */
  readonly phaseStagger?: number;
  /**
   * Anchor positions in normalised (0..1) panel coordinates. Default
   * is the four corners. The positions stick to the panel rect on
   * resize, so `[1, 1]` always lands on the bottom-right corner
   * regardless of panel width.
   */
  readonly positions?: readonly OrbPosition[];
};

const DEFAULT_POSITIONS: readonly OrbPosition[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

export const ORBS_DEFAULTS = {
  color: 0xffd27a,
  coreRadius: 4,
  haloRadius: 12,
  haloBlur: 12,
  alphaMax: 1,
  alphaMin: 0.35,
  periodMs: 2400,
  phaseStagger: 0.25,
  positions: DEFAULT_POSITIONS,
} as const;

type Resolved = {
  readonly color: number;
  readonly coreRadius: number;
  readonly haloRadius: number;
  readonly haloBlur: number;
  readonly alphaMax: number;
  readonly alphaMin: number;
  readonly periodMs: number;
  readonly phaseStagger: number;
  readonly positions: readonly OrbPosition[];
};

function resolve(options: OrbsOptions): Resolved {
  return {
    color: options.color ?? ORBS_DEFAULTS.color,
    coreRadius: options.coreRadius ?? ORBS_DEFAULTS.coreRadius,
    haloRadius: options.haloRadius ?? ORBS_DEFAULTS.haloRadius,
    haloBlur: options.haloBlur ?? ORBS_DEFAULTS.haloBlur,
    alphaMax: options.alphaMax ?? ORBS_DEFAULTS.alphaMax,
    alphaMin: options.alphaMin ?? ORBS_DEFAULTS.alphaMin,
    periodMs: options.periodMs ?? ORBS_DEFAULTS.periodMs,
    phaseStagger: options.phaseStagger ?? ORBS_DEFAULTS.phaseStagger,
    positions: options.positions ?? ORBS_DEFAULTS.positions,
  };
}

/**
 * Padding (CSS pixels) around each orb Graphics surface. The halo
 * blur spreads by ~3× the blur radius, so we size the surface so
 * the halo has room to fade before hitting the canvas edge.
 */
function orbSurfacePadding(haloBlur: number): number {
  return Math.max(6, Math.ceil(haloBlur * 3));
}

function orbSurfaceSide(resolved: Resolved): number {
  return orbSurfacePadding(resolved.haloBlur) * 2 + resolved.haloRadius * 2;
}

/**
 * Paints an orb into `g`: a blurred halo filling most of the surface,
 * then a bright sharp core at the centre. Both drawn at full alpha;
 * per-frame alpha modulation lives on the node via setAlpha.
 */
function paintOrb(g: Graphics, resolved: Resolved): void {
  const pad = orbSurfacePadding(resolved.haloBlur);
  const cx = pad + resolved.haloRadius;
  const cy = pad + resolved.haloRadius;
  g.clear();
  // Halo: a blurred filled rounded-rect with radius = halfSide so it
  // resolves as a circle. `fillBlurredRoundedRect` is the only
  // Graphics primitive that runs the canvas blur filter, so we use
  // that rather than fillCircle + manual gaussian.
  g.fillStyle(resolved.color, 0.7);
  g.fillBlurredRoundedRect(
    pad,
    pad,
    resolved.haloRadius * 2,
    resolved.haloRadius * 2,
    resolved.haloRadius,
    resolved.haloBlur,
  );
  // Bright sharp core on top of the halo.
  g.fillStyle(resolved.color, 1);
  g.fillCircle(cx, cy, resolved.coreRadius);
}

type Mounted = {
  readonly node: Graphics;
  readonly phaseOffsetMs: number;
  readonly normalised: OrbPosition;
};

function orbAlpha(
  resolved: Resolved,
  elapsedMs: number,
  phaseOffsetMs: number,
): number {
  const t = (elapsedMs + phaseOffsetMs) / resolved.periodMs;
  // cos-based breath keeps alpha at the top of the range for a good
  // fraction of the cycle rather than spiking through it, which
  // reads as "glowing" rather than "strobing".
  const breath = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
  return resolved.alphaMin + (resolved.alphaMax - resolved.alphaMin) * breath;
}

function repositionOrb(
  mounted: Mounted,
  resolved: Resolved,
  rect: UiPanelEffectRect,
): void {
  const pad = orbSurfacePadding(resolved.haloBlur);
  const cx = rect.x + mounted.normalised[0] * rect.width;
  const cy = rect.y + mounted.normalised[1] * rect.height;
  // Position the surface top-left so its centre lands on (cx, cy).
  mounted.node.setPosition(cx - (pad + resolved.haloRadius), cy - (pad + resolved.haloRadius));
}

/**
 * Panel effect: pulsing orbs at configured panel-normalised
 * positions. Attaches to the `front` layer. Advances on
 * {@link UiPanelEffectHandle.tick tick} — the owner drives the clock.
 */
export function orbs(options: OrbsOptions = {}): UiPanelEffect {
  const resolved = resolve(options);
  return function mount(
    ctx: UiPanelEffectContext,
    rect: UiPanelEffectRect,
  ): UiPanelEffectHandle {
    const container = new Container({
      x: 0,
      y: 0,
      name: "r3:panel-effect:orbs",
    });
    ctx.hosts.front.add(container);

    const side = orbSurfaceSide(resolved);
    const mounted: Mounted[] = resolved.positions.map((pos, i) => {
      const node = new Graphics({
        x: 0,
        y: 0,
        width: side,
        height: side,
        originX: 0,
        originY: 0,
        textureManager: ctx.textureManager,
      });
      paintOrb(node, resolved);
      container.add(node);
      const entry: Mounted = {
        node,
        phaseOffsetMs: resolved.periodMs * resolved.phaseStagger * i,
        normalised: pos,
      };
      repositionOrb(entry, resolved, rect);
      // Initial alpha — evaluated at elapsed 0 with the orb's own
      // phase so the grid renders its chase on the very first
      // frame, not a flat-alpha frame before the first tick.
      node.setAlpha(orbAlpha(resolved, 0, entry.phaseOffsetMs));
      return entry;
    });

    const state = { elapsedMs: 0 };

    return {
      setRect(next: UiPanelEffectRect): void {
        for (const m of mounted) {
          repositionOrb(m, resolved, next);
        }
      },
      tick(dtSeconds: number): boolean {
        state.elapsedMs += dtSeconds * 1000;
        for (const m of mounted) {
          m.node.setAlpha(orbAlpha(resolved, state.elapsedMs, m.phaseOffsetMs));
        }
        return false;
      },
      destroy(): void {
        container.destroy();
      },
    };
  };
}
