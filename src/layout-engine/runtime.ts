/**
 * @file LayoutRuntime — glues the tree (measure + arrange) to the
 * existing r3 tween system so layout changes read as animated, not
 * teleported.
 *
 * ## Lifecycle
 *
 *   - Construct with a tree root, viewport rect, and a default
 *     {@link Transition}.
 *   - On the first {@link relayout}, every animated node's rect is
 *     applied instantly — the screen should be correct on the first
 *     paint, not slide in from the origin.
 *   - On subsequent relayouts, each animated node's live rect is
 *     tweened from its current value to the new computed rect using
 *     the node's {@link LeafOptions.transition} override (or the
 *     runtime default). Any in-flight tween for the same live rect
 *     is killed first so retargeting mid-animation is smooth.
 *   - {@link setRoot} swaps the tree; nodes present in the old tree
 *     but missing from the new one have their tweens killed and their
 *     state dropped. Their bound r3 widgets are left untouched — the
 *     caller that constructed them owns their destruction.
 *
 * ## Why per-node live rect
 *
 * The tween manager mutates numeric properties in place on a target
 * object. Every animated node therefore owns a private
 * {@link LiveRect} that the manager writes through; the node's
 * `onRect` callback fires on each tween tick with that same live
 * object. Downstream bindings (see `./r3-binding.ts`) copy x/y/w/h
 * onto the real r3 node during `onRect`; the abstraction stays
 * framework-free.
 */

import { TweenManager } from "../Tween.ts";
import { arrangeTree, type ArrangeVisitor } from "./arrange.ts";
import type { LayoutNode } from "./nodes.ts";
import type { LayoutTargetRegistry } from "./registry.ts";
import {
  type LayoutPoint,
  type LayoutRect,
  type LayoutTransform,
  type LayoutVanishingPoint,
  type LayoutVanishingPointPresets,
  type Transition,
} from "./types.ts";

/** Mutable numeric rect targeted by the tween manager. */
type LiveRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  transform?: LayoutTransform;
};

type LiveState = {
  readonly liveRect: LiveRect;
};

function syncTransform(
  frame: LiveRect,
  node: LayoutNode,
  vanishingPoints: LayoutVanishingPointPresets,
): void {
  if (node.transform) {
    frame.transform = resolveTransformRefs(node.transform, vanishingPoints);
    return;
  }
  delete frame.transform;
}

function resolveTransformRefs(
  transform: LayoutTransform,
  vanishingPoints: LayoutVanishingPointPresets,
): LayoutTransform {
  if (!transform.vanishingPoint || !("ref" in transform.vanishingPoint)) {
    return transform;
  }
  const resolved = resolveVanishingPointRef(transform.vanishingPoint, vanishingPoints);
  return {
    ...transform,
    vanishingPoint: resolved,
  };
}

function resolveVanishingPointRef(
  point: LayoutVanishingPoint & { readonly ref: string },
  vanishingPoints: LayoutVanishingPointPresets,
): LayoutVanishingPoint & LayoutPoint {
  const preset = vanishingPoints[point.ref];
  if (!preset) {
    throw new Error(`LayoutRuntime: unknown vanishing point ref "${point.ref}"`);
  }
  const { ref: _ref, ...overrides } = point;
  void _ref;
  return {
    ...preset,
    ...overrides,
    x: preset.x,
    y: preset.y,
  };
}

function resolveOptionalTransform(
  transform: LayoutTransform | null,
  vanishingPoints: LayoutVanishingPointPresets,
): LayoutTransform | undefined {
  if (!transform) {
    return undefined;
  }
  return resolveTransformRefs(transform, vanishingPoints);
}

export type LayoutRuntimeOptions = {
  readonly root: LayoutNode;
  readonly viewport: LayoutRect;
  /**
   * Transition applied when a node's authored transition is `null`.
   * Defaults to `{ durationMs: 0, easing: "Linear" }` — i.e. no
   * animation, callers opt in per node. Set a non-zero default to
   * animate every layout change by default.
   */
  readonly defaultTransition?: Transition;
  readonly vanishingPoints?: LayoutVanishingPointPresets;
  readonly registry?: LayoutTargetRegistry;
  /**
   * Skip the "first layout applies instantly" behaviour. Turn this
   * on when mounting an already-visible tree that should animate
   * into a new configuration (e.g. swapping pages).
   */
  readonly animateOnMount?: boolean;
};

/**
 * Layout orchestrator. Owns the tween manager, the live-rect state
 * map, and the tree root. Callers should:
 *
 *   1. Construct with their root tree and viewport.
 *   2. Call {@link tick} once per frame with the elapsed ms.
 *   3. Call {@link relayout} whenever they mutate authored fields on
 *      any node, or pass a replacement tree to {@link setRoot}.
 *   4. Call {@link dispose} on tear-down to kill any in-flight
 *      tweens so they don't dangle past the scene's life.
 */
export class LayoutRuntime {
  private root: LayoutNode;
  private viewport: LayoutRect;
  private readonly defaultTransition: Transition;
  private readonly tweens: TweenManager;
  private vanishingPoints: LayoutVanishingPointPresets;
  private readonly state: Map<LayoutNode, LiveState>;
  private readonly registry: LayoutTargetRegistry | null;
  private mounted: boolean;
  /**
   * When true, {@link applyRect} skips the tween and writes values
   * directly to the live rect on every affected node. Callers flip
   * this on during interactive drags (where a trailing tween reads
   * as input lag) and off again on pointer-up.
   */
  private forceInstant = false;

  constructor(options: LayoutRuntimeOptions) {
    this.root = options.root;
    this.viewport = options.viewport;
    this.defaultTransition = options.defaultTransition ?? {
      durationMs: 0,
      easing: "Linear",
    };
    this.tweens = new TweenManager();
    this.vanishingPoints = options.vanishingPoints ?? {};
    this.state = new Map();
    this.registry = options.registry ?? null;
    this.mounted = options.animateOnMount === true;
    this.relayout();
  }

  /** Advances the internal tween manager. */
  tick(dtMs: number): void {
    this.tweens.advance(dtMs);
  }

  /** Returns the count of in-flight layout tweens (useful for tests). */
  get activeTweenCount(): number {
    return this.tweens.activeCount;
  }

  setRoot(root: LayoutNode): void {
    this.root = root;
    this.relayout();
  }

  setViewport(viewport: LayoutRect): void {
    this.viewport = viewport;
    this.relayout();
  }

  setVanishingPoints(vanishingPoints: LayoutVanishingPointPresets): void {
    this.vanishingPoints = vanishingPoints;
    this.relayout();
  }

  /**
   * Recomputes rects from the current tree + viewport and animates
   * every animated node toward its new rect.
   */
  relayout(): void {
    const seen = new Set<LayoutNode>();
    this.registry?.beginRelayout();
    const visit: ArrangeVisitor = (node, rect) => {
      const transform = resolveOptionalTransform(node.transform, this.vanishingPoints);
      this.registry?.record(node, transform ? { ...rect, transform } : rect);
      if (!node.onRect) {
        return;
      }
      seen.add(node);
      this.applyRect(node, rect);
    };
    try {
      arrangeTree(this.root, this.viewport, visit);
      this.dropOrphans(seen);
      this.mounted = true;
    } finally {
      this.registry?.endRelayout();
    }
  }

  /**
   * Same as {@link relayout} but writes every new rect instantly —
   * no tween. Use during interactive drags to avoid perceived input
   * lag. Safe to call repeatedly per frame; it never allocates
   * tween records.
   */
  relayoutInstant(): void {
    this.forceInstant = true;
    try {
      this.relayout();
    } finally {
      this.forceInstant = false;
    }
  }

  dispose(): void {
    this.tweens.killAll();
    this.state.clear();
  }

  private applyRect(node: LayoutNode, rect: LayoutRect): void {
    // The visitor already filtered out nodes without onRect, but
    // TypeScript does not narrow across the callback boundary. Latch
    // a typed local so the tween closures can call it directly.
    const onRect = node.onRect;
    if (!onRect) {
      return;
    }

    const existing = this.state.get(node);
    if (!existing) {
      const transform = resolveOptionalTransform(node.transform, this.vanishingPoints);
      const liveRect: LiveRect = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        ...(transform ? { transform } : {}),
      };
      this.state.set(node, { liveRect });
      onRect(liveRect);
      return;
    }

    const transition = node.transition ?? this.defaultTransition;

    // Always kill any in-flight tween on this live rect so the new
    // target wins without a double-animator race.
    this.tweens.killTweensOf(existing.liveRect);

    if (!this.mounted || transition.durationMs <= 0 || this.forceInstant) {
      existing.liveRect.x = rect.x;
      existing.liveRect.y = rect.y;
      existing.liveRect.width = rect.width;
      existing.liveRect.height = rect.height;
      syncTransform(existing.liveRect, node, this.vanishingPoints);
      onRect(existing.liveRect);
      return;
    }

    syncTransform(existing.liveRect, node, this.vanishingPoints);
    this.tweens.add({
      targets: existing.liveRect,
      duration: transition.durationMs,
      delay: transition.delayMs,
      ease: transition.easing,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      onUpdate: () => {
        onRect(existing.liveRect);
      },
      onComplete: () => {
        onRect(existing.liveRect);
      },
    });
  }

  private dropOrphans(seen: ReadonlySet<LayoutNode>): void {
    for (const [node, entry] of this.state) {
      if (seen.has(node)) {
        continue;
      }
      this.tweens.killTweensOf(entry.liveRect);
      this.state.delete(node);
    }
  }
}
