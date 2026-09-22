import { SceneManager } from './SceneManager.ts';
import { Stage } from './Stage.ts';
export declare const R3_INSPECTOR_VERSION = "1";
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
    readonly hit: {
        readonly width: number;
        readonly height: number;
    } | null;
    /** Center of the hit area in stage-logical pixels, or null. */
    readonly hitCenter: {
        readonly x: number;
        readonly y: number;
    } | null;
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
    readonly screenSize: () => {
        readonly width: number;
        readonly height: number;
    };
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
export declare function installR3Inspector(options: InstallR3InspectorOptions): R3Inspector;
/**
 * Frees the global binding if it points at this stage. Hosts call this
 * during tear-down so a stale reference doesn't survive a reboot.
 */
export declare function uninstallR3Inspector(stage: Stage): void;
