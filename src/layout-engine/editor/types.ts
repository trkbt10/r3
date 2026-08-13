/**
 * @file Host interface — the minimal surface a {@link LayoutEditor}
 * needs from the application that owns the tree.
 *
 * The editor itself is stateless with respect to the application's
 * data model: every tree mutation, every lookup, every relayout
 * goes through this interface. Any consumer of the layout engine
 * can wire an editor by implementing these methods against their
 * own composition (HUD preview, in-game editor, external tool,
 * etc.).
 *
 * Implementations are expected to:
 *
 *   - mutate the tree in place (runtime state is keyed by node
 *     identity, so reused references keep their tween state);
 *   - after each mutation, either call {@link relayout} so the
 *     runtime picks up the change, or rely on the editor's
 *     {@link beginInstant} / {@link endInstant} pair to batch
 *     pointer-move relayouts into the instant (no-tween) path.
 */

import type { AnchorName } from "../nodes.ts";
import type {
  AbsoluteChild,
  FlexNode,
  LayoutNode,
  LeafNode,
} from "../nodes.ts";
import type { LayoutRect } from "../types.ts";

/** Anchor placement stamped onto an absolute child's wrapper. */
export type AnchorPlacement = {
  readonly anchor: AnchorName;
  readonly insetX: number;
  readonly insetY: number;
};

/**
 * Every callback the editor needs to drive an application's layout
 * tree. Group-by-concern so implementors see the contract at a
 * glance; the editor code itself never reaches into implementation
 * details.
 */
export type LayoutEditorHost = {
  /** The live tree root (mutable ref). */
  readonly tree: { readonly current: LayoutNode };
  /** Live per-key rect snapshots written by the runtime's tween pass. */
  readonly rects: Readonly<Record<string, LayoutRect>>;

  /* ── lookups ─────────────────────────────────────────────────── */

  readonly findNode: (key: string) => LayoutNode | null;
  readonly findLeaf: (key: string) => LeafNode | null;
  readonly findAbsoluteWrapper: (
    key: string,
  ) => { wrapper: AbsoluteChild; parent: FlexNode } | null;
  readonly getAnchorPlacement: (key: string) => AnchorPlacement | null;

  /* ── mutations ───────────────────────────────────────────────── */

  readonly setAnchorPlacement: (key: string, placement: AnchorPlacement) => void;
  /**
   * Mutates the authored `width` / `height` of any keyed node (leaf
   * OR flex). For a flex, this updates its natural content size —
   * which in turn drives both flow-mode reflow of its children and
   * scale-mode transform of its subtree.
   */
  readonly setNodeSize: (key: string, width: number, height: number) => void;
  readonly removeByKey: (key: string) => boolean;
  readonly promoteFlowToAbsolute: (key: string) => boolean;

  /* ── runtime control ─────────────────────────────────────────── */

  readonly relayout: () => void;
  /** Switch into "no-tween" mode for the duration of a pointer drag. */
  readonly beginInstant: () => void;
  readonly endInstant: () => void;

  /* ── optional creators ───────────────────────────────────────── */

  /**
   * Creates and inserts a new leaf into the tree as an absolute
   * child of the root. Optional — when absent, the page UI should
   * hide its "Add card" affordance. Returns the new node's key so
   * the editor can auto-select it.
   */
  readonly addPlaceholder?: (placement: {
    readonly anchor: AnchorName;
    readonly insetX: number;
    readonly insetY: number;
    readonly width?: number;
    readonly height?: number;
  }) => string;
};
