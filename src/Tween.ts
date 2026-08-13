/**
 * @file Tween — small property-tween scheduler with Phaser-flavoured config.
 *
 * Mirrors the subset of Phaser's `tweens.add({ ... })` actually used
 * across the codebase:
 *
 *  - `targets`: object or array of objects whose numeric properties
 *    will animate.
 *  - `duration`: total milliseconds.
 *  - `delay`: milliseconds to wait before starting.
 *  - `ease`: name (see {@link EasingName}) or function.
 *  - `yoyo`: animates to the destination then back to the origin.
 *  - `repeat`: -1 for infinite or a positive number of additional plays.
 *  - `onUpdate`, `onComplete`: callbacks.
 *  - Per-property numeric targets folded onto the config — anything
 *    typed as `number | TweenPropConfig` is interpolated.
 *
 * The manager calls `advance(dtMs)` once per frame; tweens whose
 * targets are no longer needed should be killed via
 * `killTweensOf(target)` (matches Phaser's API).
 */

import { resolveEasing, type EasingFn, type EasingName } from "./Easing.ts";

/** A single property's tween-specific config (rare; usually a number suffices). */
export type TweenPropConfig = {
  /**
   * If specified, the start value is used regardless of the target's
   * current value when the tween begins. Lets a tween set the
   * starting state up-front so simultaneous tweens can race.
   */
  readonly from?: number;
  /** Destination value. Required. */
  readonly to: number;
};

/**
 * Single object reference being animated. Accepts any non-null
 * object — the manager indexes properties by key at runtime and
 * verifies they are numeric. Typed at `object` (not a concrete
 * record) so Container/Node/Rect etc. with their many typed
 * properties can be passed without an index-signature cast at the
 * call site.
 */
export type TweenTarget = object;

/**
 * Per-tween numeric property values. Each entry is either a plain
 * number (interpreted as the destination) or a {@link TweenPropConfig}.
 *
 * The set of property names is open — the tween records the current
 * value of each named property as the start when it begins, then
 * lerps toward `to`.
 */
export type TweenProps = Readonly<Record<string, number | TweenPropConfig>>;

export type TweenConfig = {
  readonly targets: TweenTarget | readonly TweenTarget[];
  readonly duration: number;
  readonly delay?: number;
  readonly ease?: EasingName | EasingFn;
  readonly yoyo?: boolean;
  /**
   * Number of *additional* plays after the first (-1 = infinite).
   * `repeat: 1` plays the tween twice in total. Matches Phaser.
   */
  readonly repeat?: number;
  /**
   * Properties to animate. Each is either a number (destination) or
   * a {@link TweenPropConfig}.
   *
   * Caller writes the numeric properties directly on the config,
   * Phaser-style (`{ alpha: 1, scaleX: 1.2 }`); the manager treats
   * every numeric or TweenPropConfig field that is NOT one of the
   * reserved tween-config keys as an animated property.
   */
  readonly [propName: string]:
    | TweenTarget
    | readonly TweenTarget[]
    | number
    | TweenPropConfig
    | EasingName
    | EasingFn
    | boolean
    | (() => void)
    | undefined;
  readonly onUpdate?: () => void;
  readonly onComplete?: () => void;
};

/** Reserved keys that are NOT animated properties. */
const RESERVED_KEYS = new Set<string>([
  "targets",
  "duration",
  "delay",
  "ease",
  "yoyo",
  "repeat",
  "onUpdate",
  "onComplete",
]);

/** Per-property runtime state of a single tween for a single target. */
type PropertyState = {
  readonly key: string;
  readonly start: number;
  readonly end: number;
};

/** Active tween record. */
type ActiveTween = {
  readonly id: number;
  readonly targets: TweenTarget[];
  readonly duration: number;
  readonly easing: EasingFn;
  readonly yoyo: boolean;
  readonly repeat: number;
  readonly props: TweenProps;
  /** Captured per-(target, prop) start/end values — first per target. */
  states: PropertyState[][];
  /** True after first `advance` tick — start values latched. */
  started: boolean;
  /** Real-time elapsed within the current play (ignoring delay). */
  elapsed: number;
  /** Delay countdown; once <= 0 the tween becomes active. */
  delay: number;
  /** Number of plays completed within this tween (for repeat counting). */
  playsCompleted: number;
  /** True when on the return leg of a yoyo. */
  reversing: boolean;
  /** Marked for removal at end of advance(). */
  killed: boolean;
  readonly onUpdate?: () => void;
  readonly onComplete?: () => void;
};

/**
 * Public handle to a scheduled tween. Mostly used for kill (or to
 * stop chaining a tween that is part of a sequence).
 */
export type TweenHandle = {
  readonly id: number;
  /** Removes the tween at the next advance(). */
  kill(): void;
  /** True when the tween's onComplete has fired (or it was killed). */
  readonly completed: boolean;
};

/** Time-driven property tween scheduler. */
export class TweenManager {
  private readonly active: ActiveTween[];
  private nextId: number;

  constructor() {
    this.active = [];
    this.nextId = 1;
  }

  /**
   * Schedules a tween. Returns a handle the caller can use to kill it
   * mid-animation. Property names mirror Phaser's chainable config:
   * `{ targets, duration, alpha: 1, ... }`.
   */
  add(config: TweenConfig): TweenHandle {
    const targets = normaliseTargets(config.targets);
    const easing = resolveEasing(config.ease ?? "Linear");
    const props = extractProps(config);

    const tween: ActiveTween = {
      id: this.nextId,
      targets,
      duration: Math.max(0, config.duration),
      easing,
      yoyo: config.yoyo === true,
      repeat: config.repeat ?? 0,
      props,
      states: [],
      started: false,
      elapsed: 0,
      delay: config.delay ?? 0,
      playsCompleted: 0,
      reversing: false,
      killed: false,
      onUpdate: config.onUpdate,
      onComplete: config.onComplete,
    };
    this.nextId += 1;
    this.active.push(tween);

    const handle: TweenHandle = {
      id: tween.id,
      kill: () => {
        tween.killed = true;
      },
      get completed(): boolean {
        return tween.killed || tween.playsCompleted > tween.repeat;
      },
    };
    return handle;
  }

  /**
   * Kills any active tween whose targets list contains `target`. Does
   * not fire `onComplete`. Matches Phaser's killTweensOf semantics.
   */
  killTweensOf(target: TweenTarget): void {
    for (const t of this.active) {
      if (t.targets.includes(target)) {
        t.killed = true;
      }
    }
  }

  killAll(): void {
    for (const t of this.active) {
      t.killed = true;
    }
  }

  get activeCount(): number {
    return this.active.filter((t) => !t.killed).length;
  }

  /**
   * Per-frame advance. `dtMs` is the milliseconds elapsed since the
   * last call. Tweens whose start delay has not yet elapsed simply
   * count down; tweens that finish during this tick fire their
   * `onComplete` (unless killed) and are removed.
   */
  advance(dtMs: number): void {
    if (this.active.length === 0) {
      return;
    }
    const dt = Math.max(0, dtMs);
    // Iterate by index — handlers may add/kill tweens.
    for (let i = 0; i < this.active.length; i++) {
      const t = this.active[i];
      if (!t || t.killed) {
        continue;
      }
      this.advanceOne(t, dt);
    }
    // Drop completed/killed tweens. Walk in reverse so splice indices
    // stay valid. `repeat: -1` (infinite) tweens are NEVER dropped on
    // play-completion — they only leave the active list when killed
    // explicitly. The original drop test mistakenly compared
    // playsCompleted against -1, which is always true after the first
    // play, so infinite tweens were silently leaving the loop.
    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = this.active[i];
      if (!t) {
        continue;
      }
      if (t.killed) {
        this.active.splice(i, 1);
        continue;
      }
      if (t.repeat === -1) {
        continue;
      }
      if (t.playsCompleted > t.repeat) {
        this.active.splice(i, 1);
      }
    }
  }

  private advanceOne(t: ActiveTween, dtMs: number): void {
    if (t.delay > 0) {
      t.delay -= dtMs;
      if (t.delay > 0) {
        return;
      }
      // Carry the overshoot into elapsed so dt isn't lost.
      const overshoot = -t.delay;
      t.delay = 0;
      this.startTween(t);
      this.applyTime(t, overshoot);
      return;
    }
    if (!t.started) {
      this.startTween(t);
    }
    this.applyTime(t, dtMs);
  }

  private startTween(t: ActiveTween): void {
    if (t.started) {
      return;
    }
    t.started = true;
    t.states = t.targets.map((target) => buildStates(target, t.props));
    // If a `from` was provided, set it now so the first tick already
    // reflects it. (Without this, the first frame would still show
    // the target's pre-tween value.)
    for (let ti = 0; ti < t.targets.length; ti++) {
      const target = t.targets[ti];
      const states = t.states[ti];
      if (!target || !states) {
        continue;
      }
      for (const s of states) {
        writeTargetNumber(target, s.key, s.start);
      }
    }
  }

  private applyTime(t: ActiveTween, dtMs: number): void {
    t.elapsed += dtMs;
    const phaseProgress = t.duration === 0 ? 1 : Math.min(1, t.elapsed / t.duration);
    const easedRaw = t.easing(phaseProgress);
    const eased = t.reversing ? 1 - easedRaw : easedRaw;
    for (let ti = 0; ti < t.targets.length; ti++) {
      const target = t.targets[ti];
      const states = t.states[ti];
      if (!target || !states) {
        continue;
      }
      for (const s of states) {
        writeTargetNumber(target, s.key, lerp(s.start, s.end, eased));
      }
    }
    t.onUpdate?.();
    if (phaseProgress < 1) {
      return;
    }
    // Phase ended.
    if (t.yoyo && !t.reversing) {
      // Run the return leg.
      t.reversing = true;
      t.elapsed = 0;
      return;
    }
    // End of one play (forward, or forward+yoyo).
    t.playsCompleted += 1;
    if (t.repeat === -1 || t.playsCompleted <= t.repeat) {
      t.reversing = false;
      t.elapsed = 0;
      // Reset values to start so the next play replays cleanly.
      for (let ti = 0; ti < t.targets.length; ti++) {
        const target = t.targets[ti];
        const states = t.states[ti];
        if (!target || !states) {
          continue;
        }
        for (const s of states) {
          writeTargetNumber(target, s.key, s.start);
        }
      }
      return;
    }
    // No more repeats: fire onComplete and let the manager drop us.
    if (!t.killed) {
      t.onComplete?.();
    }
  }
}

/* ── helpers ─────────────────────────────────────────────────────── */

function normaliseTargets(input: TweenConfig["targets"]): TweenTarget[] {
  if (Array.isArray(input)) {
    return input.slice();
  }
  return [input as TweenTarget];
}

function extractProps(config: TweenConfig): TweenProps {
  const out: Record<string, number | TweenPropConfig> = {};
  for (const key of Object.keys(config)) {
    if (RESERVED_KEYS.has(key)) {
      continue;
    }
    const value = config[key];
    if (typeof value === "number") {
      out[key] = value;
      continue;
    }
    if (isPropConfig(value)) {
      out[key] = value;
    }
  }
  return out;
}

function isPropConfig(v: unknown): v is TweenPropConfig {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const candidate = v as Record<string, unknown>;
  if (typeof candidate.to !== "number") {
    return false;
  }
  if (candidate.from !== undefined && typeof candidate.from !== "number") {
    return false;
  }
  return true;
}

function buildStates(target: TweenTarget, props: TweenProps): PropertyState[] {
  const out: PropertyState[] = [];
  for (const key of Object.keys(props)) {
    const config = props[key];
    if (config === undefined) {
      continue;
    }
    const current = readTargetNumber(target, key);
    out.push({
      key,
      start: resolveStartValue(config, current),
      end: typeof config === "number" ? config : config.to,
    });
  }
  return out;
}

/**
 * Reads a numeric property by key. Falls back to 0 when the property
 * is absent or non-numeric — matches Phaser's tween, which silently
 * tweens off zero rather than blowing up on a missing field.
 *
 * The cast to `Record<string, unknown>` is a structural-view cast,
 * not a `as any`/`as unknown` widening — every JS object IS
 * assignable to that record at runtime; TypeScript just needs the
 * hint to permit dynamic indexing.
 */
function readTargetNumber(target: TweenTarget, key: string): number {
  const view = target as Record<string, unknown>;
  const raw = view[key];
  if (typeof raw === "number") {
    return raw;
  }
  return 0;
}

/**
 * Writes a numeric property by key. The structural-view cast lets
 * the manager assign through getter/setter pairs uniformly across
 * plain objects (test fixtures) and r3 Nodes (production targets).
 */
function writeTargetNumber(target: TweenTarget, key: string, value: number): void {
  const view = target as Record<string, number>;
  view[key] = value;
}

/**
 * Decides the start value for a property's tween: a config without
 * `from` latches the target's current value; a config with `from`
 * uses that value directly so simultaneous tweens can race from a
 * known origin.
 */
function resolveStartValue(config: number | TweenPropConfig, current: number): number {
  if (typeof config === "number") {
    return current;
  }
  if (config.from !== undefined) {
    return config.from;
  }
  return current;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
