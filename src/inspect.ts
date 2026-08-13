/**
 * @file r3 inspector — exposes a small read+poke surface on `window`
 *  so external automation (Playwright tests, screenshot capture,
 *  replay scripts) can query the live r3 display tree and drive
 *  pointer input without going through DOM hit-testing.
 *
 * The inspector is intentionally a *first-class part of r3*, not a
 * debug-only flag. Any host that mounts a {@link Stage} can opt in by
 * calling {@link installR3Inspector} once. Two reasons:
 *
 *  1. r3 paints into a single `<canvas>`. None of its widgets surface
 *     in the accessibility tree or as DOM elements, so the standard
 *     web-automation primitives (CSS / role / text locators) cannot
 *     reach them. A canvas-only UI framework needs a dedicated
 *     introspection contract or it is effectively un-automatable.
 *  2. Hit-testing, world rects, and interactive flags are already
 *     computed on every frame by the existing Stage compose pass.
 *     Re-using them through a thin read API costs ~nothing and avoids
 *     each consumer reinventing canvas-coordinate guesses.
 *
 * The exposed surface is:
 *
 * ```ts
 * window.__R3__ = {
 *   version: string,
 *   getStage(): Stage,
 *   getActiveScenes(): readonly string[],
 *   screenSize(): { width: number; height: number },
 *   listNodes(): readonly InspectedNode[],
 *   findNodes(query: NodeQuery): readonly InspectedNode[],
 *   click(x: number, y: number): void,
 *   pointerDown(x: number, y: number): void,
 *   pointerUp(x: number, y: number): void,
 *   clickByName(name: string | RegExp): boolean,
 * };
 * ```
 *
 * Coordinates are stage-logical pixels (the same space {@link Stage}'s
 * pointer feed expects). `listNodes()` reports a node's world rect
 * after the most recent compose pass so callers see what is actually
 * on screen this frame.
 */

import { Container } from "./Container.ts";
import type { Node } from "./Node.ts";
import type { SceneManager } from "./SceneManager.ts";
import type { Stage } from "./Stage.ts";

export const R3_INSPECTOR_VERSION = "1";

/**
 * A snapshot of one node's identity, its world rect, and its
 * interactivity. Field shapes are kept primitive so they survive a
 * `JSON.stringify` (Playwright `evaluate` boundary).
 */
export type InspectedNode = {
  /** Stable display name set on the node (`Node.name`). May be empty. */
  readonly name: string;
  /** Class name of the concrete node (e.g. `"Container"`, `"Rect"`). */
  readonly kind: string;
  /** Path of names from the stage root to this node (root → leaf). */
  readonly path: readonly string[];
  /** Top-left in stage-logical pixels (matches Stage.screen units). */
  readonly worldX: number;
  readonly worldY: number;
  /** Hit-area size if the node is interactive; null otherwise. */
  readonly hit: { readonly width: number; readonly height: number } | null;
  /** Center of the hit area in stage-logical pixels, or null. */
  readonly hitCenter: { readonly x: number; readonly y: number } | null;
  /** Effective world visibility this frame. */
  readonly visible: boolean;
  /** Effective world alpha this frame. */
  readonly alpha: number;
};

export type NodeQuery = {
  /** Exact match against `Node.name`. */
  readonly name?: string;
  /** Regex match against `Node.name`. */
  readonly nameLike?: RegExp;
  /** Class name match (e.g. `"Text"`). */
  readonly kind?: string;
  /** Restrict to interactive nodes (those with a hit area). */
  readonly interactive?: boolean;
};

export type R3Inspector = {
  readonly version: string;
  readonly getStage: () => Stage;
  readonly getActiveScenes: () => readonly string[];
  readonly screenSize: () => { readonly width: number; readonly height: number };
  readonly listNodes: () => readonly InspectedNode[];
  readonly findNodes: (query: NodeQuery) => readonly InspectedNode[];
  readonly click: (x: number, y: number) => void;
  readonly pointerDown: (x: number, y: number) => void;
  readonly pointerUp: (x: number, y: number) => void;
  readonly clickByName: (name: string | RegExp) => boolean;
};

export type InstallR3InspectorOptions = {
  readonly stage: Stage;
  readonly scenes?: SceneManager;
};

/**
 * Installs the inspector singleton on `window`. Subsequent calls with
 * the same stage are no-ops; with a different stage, the previous
 * binding is replaced (useful for host hot-reload).
 */
export function installR3Inspector(options: InstallR3InspectorOptions): R3Inspector {
  const { stage, scenes } = options;
  if (typeof window === "undefined") {
    // Headless build — there is no window to install onto. Return a
    // detached inspector so callers can still drive the stage in tests
    // that provide their own globals.
    return buildInspector(stage, scenes);
  }
  const inspector = buildInspector(stage, scenes);
  inspectorWindow().__R3__ = inspector;
  return inspector;
}

/**
 * Frees the global binding if it points at this stage. Hosts call this
 * during tear-down so a stale reference doesn't survive a reboot.
 */
export function uninstallR3Inspector(stage: Stage): void {
  if (typeof window === "undefined") {
    return;
  }
  const target = inspectorWindow();
  if (target.__R3__ && target.__R3__.getStage() === stage) {
    delete target.__R3__;
  }
}

function inspectorWindow(): Window & { __R3__?: R3Inspector } {
  return window as Window & { __R3__?: R3Inspector };
}

function buildInspector(stage: Stage, scenes?: SceneManager): R3Inspector {
  return {
    version: R3_INSPECTOR_VERSION,
    getStage: () => stage,
    getActiveScenes: () => {
      if (!scenes) {
        return [];
      }
      // Scene.name は SceneManager がコンストラクタに渡す登録キー
      // と同一なので、active scenes をその key 列で報告する。
      return scenes.activeScenes.map((scene) => scene.name);
    },
    screenSize: () => ({ width: stage.screen.width, height: stage.screen.height }),
    listNodes: () => collectNodes(stage),
    findNodes: (query) => collectNodes(stage).filter((node) => matchesQuery(node, query)),
    click: (x, y) => {
      stage.pointer.feedMove(x, y);
      stage.pointer.feedDown(x, y, 0);
      stage.pointer.feedUp(x, y, 0);
    },
    pointerDown: (x, y) => {
      stage.pointer.feedMove(x, y);
      stage.pointer.feedDown(x, y, 0);
    },
    pointerUp: (x, y) => {
      stage.pointer.feedMove(x, y);
      stage.pointer.feedUp(x, y, 0);
    },
    clickByName: (name) => {
      const match = (n: InspectedNode): boolean =>
        typeof name === "string" ? n.name === name : name.test(n.name);
      const hits = collectNodes(stage).filter(
        (node) => node.hit !== null && node.visible && match(node),
      );
      const target = hits[0];
      if (!target || !target.hitCenter) {
        return false;
      }
      stage.pointer.feedMove(target.hitCenter.x, target.hitCenter.y);
      stage.pointer.feedDown(target.hitCenter.x, target.hitCenter.y, 0);
      stage.pointer.feedUp(target.hitCenter.x, target.hitCenter.y, 0);
      return true;
    },
  };
}

function collectNodes(stage: Stage): readonly InspectedNode[] {
  const out: InspectedNode[] = [];
  walk(stage.root, [], out);
  return out;
}

function walk(node: Node, path: readonly string[], out: InspectedNode[]): void {
  const entry = inspectOne(node, path);
  out.push(entry);
  if (node instanceof Container) {
    const childPath = [...path, node.name];
    for (const child of node.children) {
      walk(child, childPath, out);
    }
  }
}

function inspectOne(node: Node, parentPath: readonly string[]): InspectedNode {
  const world = node.getWorldPosition();
  const hitArea = node.hitArea;
  const hit = hitArea ? { width: hitArea.width, height: hitArea.height } : null;
  const hitCenter = hitCenterOf(world, hitArea);
  return {
    name: node.name,
    kind: node.constructor.name,
    path: [...parentPath, node.name],
    worldX: world.x,
    worldY: world.y,
    hit,
    hitCenter,
    // 親階層の visibility / alpha も折り込んだ最終値を読む。Stage.tick
    // 内の compose パスがフレームごとに書き込み済みで、Inspector が
    // 呼ばれる時点では最新値が入っている。
    visible: node.worldVisible,
    alpha: node.worldAlpha,
  };
}

function hitCenterOf(
  world: { readonly x: number; readonly y: number },
  hitArea: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null,
): { readonly x: number; readonly y: number } | null {
  if (!hitArea) {
    return null;
  }
  return {
    x: world.x + hitArea.x + hitArea.width / 2,
    y: world.y + hitArea.y + hitArea.height / 2,
  };
}

function matchesQuery(node: InspectedNode, query: NodeQuery): boolean {
  if (query.name !== undefined && node.name !== query.name) {
    return false;
  }
  if (query.nameLike !== undefined && !query.nameLike.test(node.name)) {
    return false;
  }
  if (query.kind !== undefined && node.kind !== query.kind) {
    return false;
  }
  if (query.interactive !== undefined) {
    const isInteractive = node.hit !== null;
    if (isInteractive !== query.interactive) {
      return false;
    }
  }
  return true;
}
