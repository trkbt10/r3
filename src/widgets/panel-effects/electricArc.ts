/**
 * @file electricArc — crackling lightning arcs that leap across the
 * panel face. Paints on the front layer because the arcs should be
 * visible over any chrome / content.
 *
 * ## Shape of the effect
 *
 * A fixed pool of `arcCount` arcs lives for the effect's lifetime.
 * Each arc has:
 *
 *   - a jagged polyline from one perimeter point to another (regenerated
 *     every cycle),
 *   - an `elapsedMs` cursor running from 0 to `cycleMs`,
 *   - a phase offset so the pool's arcs don't flash in sync.
 *
 * Within a cycle the arc is visible only during the first
 * `activeRatio` of the duration — fade in, hold, fade out — then
 * dark until respawn. This flicker-with-gaps pattern reads as
 * natural lightning; sustained non-zero alpha reads as "solid neon
 * wire" which is a different effect.
 *
 * ## Drawing technique
 *
 * A visible lightning bolt looks like a bright core with a soft
 * outer bloom. We don't have post-processing blur for strokes, so
 * we fake it by triple-stroking the same polyline:
 *
 *   1. Wide + soft + low-alpha glow (outer halo).
 *   2. Medium width + brighter glow colour (mid wash).
 *   3. Narrow + bright core colour (the "bolt" itself).
 *
 * The pass ordering matters — passes 1 and 2 share the glow colour
 * and sit beneath the bright core. Stacking is painted into a
 * single {@link Graphics} canvas per frame (cleared at the start of
 * each tick).
 *
 * ## Why not seeded randomness
 *
 * The arcs are visual flavour; test coverage is the framework tests
 * in {@link Plaque.spec.ts}, not the arc geometry itself. Using
 * {@link Math.random} keeps the implementation compact and avoids
 * another subsystem (PRNG) for a purely decorative effect.
 */

import { Graphics } from "../../Graphics.ts";
import type {
  UiPanelEffect,
  UiPanelEffectContext,
  UiPanelEffectHandle,
  UiPanelEffectRect,
} from "./types.ts";

export type ElectricArcOptions = {
  /** Bright core stroke colour. Default icy white with a cool-blue tint. */
  readonly color?: number;
  /** Outer glow colour painted beneath the core. Default saturated indigo. */
  readonly glowColor?: number;
  /** Simultaneous arcs. Default 3 — enough to always have at least one visible. */
  readonly arcCount?: number;
  /** Full cycle (active + gap) per arc in milliseconds. Default 420. */
  readonly cycleMs?: number;
  /**
   * Fraction of the cycle the arc is visible (fade-in + hold +
   * fade-out combined). Default 0.45 — the remaining 0.55 is a dark
   * gap until respawn, which gives the flicker a natural rhythm.
   */
  readonly activeRatio?: number;
  /** Core stroke width in CSS pixels. Default 1.6. */
  readonly coreWidth?: number;
  /** Outer glow stroke width. Default 5 — reads as a bloomed halo. */
  readonly glowWidth?: number;
  /** Number of intermediate jagged points per arc. Default 6. */
  readonly segments?: number;
  /**
   * Maximum perpendicular jitter applied at each intermediate point,
   * in CSS pixels. Default 14 — enough to look angular without
   * crossing the panel repeatedly.
   */
  readonly jitter?: number;
};

export const ELECTRIC_ARC_DEFAULTS: Required<ElectricArcOptions> = {
  color: 0xe8f2ff,
  glowColor: 0x6a8dff,
  arcCount: 3,
  cycleMs: 420,
  activeRatio: 0.45,
  coreWidth: 1.6,
  glowWidth: 5,
  segments: 6,
  jitter: 14,
};

type Resolved = Required<ElectricArcOptions>;

function resolve(options: ElectricArcOptions): Resolved {
  return {
    color: options.color ?? ELECTRIC_ARC_DEFAULTS.color,
    glowColor: options.glowColor ?? ELECTRIC_ARC_DEFAULTS.glowColor,
    arcCount: options.arcCount ?? ELECTRIC_ARC_DEFAULTS.arcCount,
    cycleMs: options.cycleMs ?? ELECTRIC_ARC_DEFAULTS.cycleMs,
    activeRatio: options.activeRatio ?? ELECTRIC_ARC_DEFAULTS.activeRatio,
    coreWidth: options.coreWidth ?? ELECTRIC_ARC_DEFAULTS.coreWidth,
    glowWidth: options.glowWidth ?? ELECTRIC_ARC_DEFAULTS.glowWidth,
    segments: options.segments ?? ELECTRIC_ARC_DEFAULTS.segments,
    jitter: options.jitter ?? ELECTRIC_ARC_DEFAULTS.jitter,
  };
}

type Point = readonly [number, number];

type Arc = {
  /** Mutable so respawn can swap in new geometry without reallocating the struct. */
  points: readonly Point[];
  elapsedMs: number;
};

/**
 * Picks a random point on the rect perimeter. Uses a single uniform
 * random over the total perimeter length so points are
 * length-weighted (longer edges get proportionally more hits) rather
 * than edge-count-weighted.
 */
function randomPerimeterPoint(width: number, height: number): Point {
  const perimeter = 2 * (width + height);
  const t = Math.random() * perimeter;
  if (t < width) {
    return [t, 0];
  }
  if (t < width + height) {
    return [width, t - width];
  }
  if (t < width * 2 + height) {
    return [width * 2 + height - t, height];
  }
  return [0, perimeter - t];
}

/**
 * Builds a jagged polyline from `start` to `end` with
 * {@link Resolved.segments} intermediate points, each offset
 * perpendicular to the start-end line by a random amount bounded by
 * {@link Resolved.jitter}. The first and last points are the
 * unjittered endpoints so the arc always visibly connects the two
 * perimeter picks.
 */
function buildArcPoints(
  start: Point,
  end: Point,
  resolved: Resolved,
): readonly Point[] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return [start, end];
  }
  // Perpendicular unit vector to the start-end direction.
  const perpX = -dy / length;
  const perpY = dx / length;

  const pts: Point[] = [start];
  const inner = resolved.segments;
  for (let i = 1; i <= inner; i++) {
    const t = i / (inner + 1);
    // Taper the jitter toward the endpoints so the polyline anchors
    // cleanly at start/end (sin curve is 0 at 0 and 1, max at 0.5).
    const taper = Math.sin(t * Math.PI);
    const jitter = (Math.random() * 2 - 1) * resolved.jitter * taper;
    const bx = start[0] + dx * t + perpX * jitter;
    const by = start[1] + dy * t + perpY * jitter;
    pts.push([bx, by]);
  }
  pts.push(end);
  return pts;
}

function spawnArc(resolved: Resolved, rect: UiPanelEffectRect): Arc {
  const start = randomPerimeterPoint(rect.width, rect.height);
  const end = randomPerimeterPoint(rect.width, rect.height);
  return {
    points: buildArcPoints(start, end, resolved),
    elapsedMs: 0,
  };
}

/**
 * Alpha envelope within a cycle. The active phase runs from
 * `t = 0` to `t = activeRatio`; after that the arc is dark until
 * respawn. The active phase itself is a triangle (fade in, hold at
 * peak, fade out) with the peak spanning roughly the middle third.
 */
function arcAlpha(resolved: Resolved, phase01: number): number {
  if (phase01 >= resolved.activeRatio) {
    return 0;
  }
  const local = phase01 / resolved.activeRatio; // 0..1 within the active span
  const attack = 0.2;
  const release = 0.7;
  if (local < attack) {
    return local / attack;
  }
  if (local > release) {
    return Math.max(0, 1 - (local - release) / (1 - release));
  }
  return 1;
}

function drawArc(g: Graphics, resolved: Resolved, arc: Arc, alpha: number): void {
  if (alpha <= 0 || arc.points.length < 2) {
    return;
  }
  // Three-pass stack: outer halo → mid wash → bright core.
  const passes: readonly [number, number, number][] = [
    [resolved.glowWidth, resolved.glowColor, alpha * 0.25],
    [resolved.glowWidth * 0.5, resolved.glowColor, alpha * 0.55],
    [resolved.coreWidth, resolved.color, alpha],
  ];
  for (const [width, color, a] of passes) {
    g.lineStyle(width, color, a);
    g.beginPath();
    const first = arc.points[0];
    if (!first) {
      continue;
    }
    g.moveTo(first[0], first[1]);
    for (let i = 1; i < arc.points.length; i++) {
      const p = arc.points[i];
      if (!p) {
        continue;
      }
      g.lineTo(p[0], p[1]);
    }
    g.strokePath();
  }
}

/**
 * Panel effect: crackling lightning arcs across the panel face.
 * Attaches to the `front` layer. Advances on
 * {@link UiPanelEffectHandle.tick tick} — the owner drives the clock.
 */
export function electricArc(
  options: ElectricArcOptions = {},
): UiPanelEffect {
  const resolved = resolve(options);
  return function mount(
    ctx: UiPanelEffectContext,
    rect: UiPanelEffectRect,
  ): UiPanelEffectHandle {
    const state = { rect };
    const node = new Graphics({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      originX: 0,
      originY: 0,
      textureManager: ctx.textureManager,
    });
    ctx.hosts.front.add(node);

    // Seed the arc pool with staggered phase offsets so the first
    // frame isn't a synchronised flash — the pool settles into an
    // overlapping flicker rhythm from the very first paint.
    const arcs: Arc[] = [];
    for (let i = 0; i < resolved.arcCount; i++) {
      const arc = spawnArc(resolved, rect);
      arc.elapsedMs = (resolved.cycleMs * i) / resolved.arcCount;
      arcs.push(arc);
    }

    function repaint(): void {
      node.clear();
      for (const arc of arcs) {
        const phase = arc.elapsedMs / resolved.cycleMs;
        drawArc(node, resolved, arc, arcAlpha(resolved, phase));
      }
    }

    repaint();

    return {
      setRect(next: UiPanelEffectRect): void {
        node.setPosition(next.x, next.y);
        node.setSize(next.width, next.height);
        state.rect = next;
        // Regenerate all arcs — existing geometry is stale for the
        // new dimensions. Preserving elapsedMs keeps each arc at
        // the same point in its fade so the visual rhythm
        // doesn't pop on resize, only the path changes.
        for (const arc of arcs) {
          const fresh = spawnArc(resolved, next);
          arc.points = fresh.points;
        }
        repaint();
      },
      tick(dtSeconds: number): boolean {
        const dtMs = dtSeconds * 1000;
        for (const arc of arcs) {
          arc.elapsedMs += dtMs;
          // Guard against pathological long frames (tab-switch etc.)
          // by snapping through any missed cycles instead of looping.
          while (arc.elapsedMs >= resolved.cycleMs) {
            arc.elapsedMs -= resolved.cycleMs;
            const fresh = spawnArc(resolved, state.rect);
            arc.points = fresh.points;
          }
        }
        repaint();
        return false;
      },
      destroy(): void {
        node.destroy();
      },
    };
  };
}
