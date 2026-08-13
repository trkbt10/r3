/**
 * @file game r3 layout engine registry.
 */
import type { LayoutNode } from "./nodes.ts";
import { layoutFrameVisualBounds } from "./r3-binding.ts";
import type { LayoutFrame, LayoutRect } from "./types.ts";

export type LayoutTargetSnapshot = {
  readonly key: string;
  readonly rect: LayoutRect;
  readonly visualRect: LayoutRect;
  readonly kind: LayoutNode["kind"];
};

export type LayoutTargetRegistry = {
  readonly beginRelayout: () => void;
  readonly record: (node: LayoutNode, rect: LayoutFrame) => void;
  readonly endRelayout: () => void;
};











/** Registry of layout target rectangles keyed by layout node keys. */
export class LayoutKeyRegistry implements LayoutTargetRegistry {
  private readonly targets = new Map<string, LayoutTargetSnapshot>();
  private readonly manualTargets = new Map<string, LayoutTargetSnapshot>();
  private nextTargets = new Map<string, LayoutTargetSnapshot>();

  beginRelayout(): void {
    this.nextTargets = new Map();
  }

  record(node: LayoutNode, rect: LayoutFrame): void {
    if (!node.key) {
      return;
    }
    this.nextTargets.set(node.key, {
      key: node.key,
      kind: node.kind,
      rect: copyRect(rect),
      visualRect: layoutFrameVisualBounds(rect),
    });
  }

  overrideVisualRect(key: string, rect: LayoutRect): void {
    const next = this.nextTargets.get(key);
    if (next) {
      this.nextTargets.set(key, {
        ...next,
        visualRect: copyRect(rect),
      });
      return;
    }
    const current = this.targets.get(key);
    if (!current) {
      return;
    }
    this.targets.set(key, {
      ...current,
      visualRect: copyRect(rect),
    });
  }

  setManualTarget(key: string, rect: LayoutRect): void {
    const target = {
      key,
      kind: "leaf",
      rect: copyRect(rect),
      visualRect: copyRect(rect),
    } as const satisfies LayoutTargetSnapshot;
    this.manualTargets.set(key, target);
    this.targets.set(key, target);
  }

  delete(key: string): void {
    this.manualTargets.delete(key);
    this.targets.delete(key);
    this.nextTargets.delete(key);
  }

  endRelayout(): void {
    this.targets.clear();
    for (const [key, target] of this.nextTargets) {
      this.targets.set(key, target);
    }
    for (const [key, target] of this.manualTargets) {
      this.targets.set(key, target);
    }
    this.nextTargets.clear();
  }

  get(key: string): LayoutTargetSnapshot | null {
    return this.targets.get(key) ?? null;
  }

  require(key: string): LayoutTargetSnapshot {
    const target = this.get(key);
    if (!target) {
      throw new Error(`LayoutKeyRegistry: missing layout target "${key}"`);
    }
    return target;
  }

  has(key: string): boolean {
    return this.targets.has(key);
  }

  all(): readonly LayoutTargetSnapshot[] {
    return Array.from(this.targets.values());
  }

  keys(): readonly string[] {
    return Array.from(this.targets.keys());
  }
}

function copyRect(rect: LayoutRect): LayoutRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}
