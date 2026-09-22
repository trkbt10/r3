import { Stage } from '../../Stage.ts';
import { TextureManager } from '../../texture-canvas';
import { LayoutRect } from '..';
/** Default depth — above every application overlay. */
export declare const LAYOUT_EDITOR_OVERLAY_DEPTH = 11000;
export type LayoutEditorOverlayOptions = {
    readonly stage: Stage;
    readonly textureManager: TextureManager;
    readonly viewport: {
        readonly width: number;
        readonly height: number;
    };
    readonly selectedRect: LayoutRect | null;
    readonly isMovable: boolean;
    readonly isResizable: boolean;
    readonly snapSize: number;
    readonly showGrid: boolean;
    readonly depth?: number;
};
export type LayoutEditorOverlayHandle = {
    readonly dispose: () => void;
};
/**
 * Installs the editor visual indicator on `stage`. Call
 * {@link LayoutEditorOverlayHandle.dispose} and re-install whenever
 * selection / snap / rect / grid-visibility changes.
 */
export declare function installLayoutEditorOverlay(options: LayoutEditorOverlayOptions): LayoutEditorOverlayHandle;
