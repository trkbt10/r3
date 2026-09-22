import { Container } from '../Container.ts';
import { Stage } from '../Stage.ts';
import { TextureManager } from '../texture-canvas';
export type R3TabSpec = {
    readonly id: string;
    readonly label: string;
    readonly disabled?: boolean;
};
export type R3TabBarOptions = {
    readonly stage: Stage;
    readonly textureManager: TextureManager;
    /** Left edge of the tab bar. */
    readonly x: number;
    /** Top edge of the inactive tab baseline. */
    readonly y: number;
    readonly tabs: readonly R3TabSpec[];
    /** ID of the tab drawn active on construction. */
    readonly initialId: string;
    /** Called when the user picks a tab. Disabled tabs never fire. */
    readonly onSelect: (id: string) => void;
    readonly height?: number;
    readonly gap?: number;
    readonly minTabWidth?: number;
    /**
     * Width (px) of the drawer-seam line. If omitted, no seam is drawn.
     * Pass the full content-area width so the seam extends from the
     * leftmost tab to the right edge of the content panels below.
     */
    readonly trayWidth?: number;
    /**
     * Container the tab-bar's root attaches to. Defaults to
     * `stage.root` — the existing contract — so pre-existing callers
     * (scene-level mounts) don't change. Dialog-hosted consumers pass
     * the dialog's `content` container so the tab bar inherits the
     * dialog's open/close fade and teardown.
     */
    readonly parent?: Container;
};
export type R3TabBarHandle = {
    readonly node: Container;
    readonly height: number;
    /** Sets which tab is drawn active without firing `onSelect`. */
    readonly setActive: (id: string) => void;
    readonly destroy: () => void;
};
/**
 * Builds a horizontal tab bar with folder-style tabs. Returns a
 * handle whose `setActive(id)` syncs the visual state from an
 * external transition (typically the page-stack cross-fade).
 */
export declare function createR3TabBar(options: R3TabBarOptions): R3TabBarHandle;
