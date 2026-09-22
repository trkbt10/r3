import { LayoutNode } from './nodes.ts';
import { LayoutFrame, LayoutRect } from './types.ts';
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
export declare class LayoutKeyRegistry implements LayoutTargetRegistry {
    private readonly targets;
    private readonly manualTargets;
    private nextTargets;
    beginRelayout(): void;
    record(node: LayoutNode, rect: LayoutFrame): void;
    overrideVisualRect(key: string, rect: LayoutRect): void;
    setManualTarget(key: string, rect: LayoutRect): void;
    delete(key: string): void;
    endRelayout(): void;
    get(key: string): LayoutTargetSnapshot | null;
    require(key: string): LayoutTargetSnapshot;
    has(key: string): boolean;
    all(): readonly LayoutTargetSnapshot[];
    keys(): readonly string[];
}
