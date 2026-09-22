import { EasingFn, EasingName } from './Easing.ts';
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
    readonly [propName: string]: TweenTarget | readonly TweenTarget[] | number | TweenPropConfig | EasingName | EasingFn | boolean | (() => void) | undefined;
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
export declare class TweenManager {
    private readonly active;
    private nextId;
    constructor();
    /**
     * Schedules a tween. Returns a handle the caller can use to kill it
     * mid-animation. Property names mirror Phaser's chainable config:
     * `{ targets, duration, alpha: 1, ... }`.
     */
    add(config: TweenConfig): TweenHandle;
    /**
     * Kills any active tween whose targets list contains `target`. Does
     * not fire `onComplete`. Matches Phaser's killTweensOf semantics.
     */
    killTweensOf(target: TweenTarget): void;
    killAll(): void;
    get activeCount(): number;
    /**
     * Per-frame advance. `dtMs` is the milliseconds elapsed since the
     * last call. Tweens whose start delay has not yet elapsed simply
     * count down; tweens that finish during this tick fire their
     * `onComplete` (unless killed) and are removed.
     */
    advance(dtMs: number): void;
    private advanceOne;
    private startTween;
    private applyTime;
}
