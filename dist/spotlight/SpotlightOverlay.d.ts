import { Container } from '../Container.ts';
import { Graphics } from '../Graphics.ts';
import { Stage } from '../Stage.ts';
import { TextureManager } from '../texture-canvas';
import { LayoutKeyRegistry, LayoutRect, LayoutTargetSnapshot } from '../layout-engine';
export declare const SPOTLIGHT_OVERLAY_DEPTH = 10500;
export type SpotlightAnchorSide = "top" | "right" | "bottom" | "left";
export type SpotlightTarget = {
    readonly targetKey: string;
    readonly preferredSide?: SpotlightAnchorSide;
};
export type SpotlightOverlayLayout = {
    readonly target: LayoutRect;
    readonly focus: LayoutRect;
    readonly callout: LayoutRect;
    readonly connectorStart: {
        readonly x: number;
        readonly y: number;
    };
    readonly connectorEnd: {
        readonly x: number;
        readonly y: number;
    };
    readonly side: SpotlightAnchorSide;
};
export type SpotlightAdornmentRenderContext = {
    readonly root: Container;
    readonly graphics: Graphics;
    readonly layout: SpotlightOverlayLayout;
    readonly viewport: LayoutRect;
    readonly textureManager: TextureManager;
};
export type SpotlightAdornmentRenderer = (context: SpotlightAdornmentRenderContext) => void;
export type SpotlightOverlayOptions = {
    readonly stage: Stage;
    readonly registry: LayoutKeyRegistry;
    readonly target: SpotlightTarget;
    readonly textureManager?: TextureManager;
    readonly adornmentRenderer?: SpotlightAdornmentRenderer;
    readonly onActivate?: () => void;
    readonly depth?: number;
};
export type SpotlightOverlayHandle = {
    readonly node: Container;
    readonly layout: () => SpotlightOverlayLayout | null;
    readonly setTarget: (target: SpotlightTarget) => void;
    readonly refresh: () => void;
    readonly dispose: () => void;
};
/** Return install spotlight overlay. */
export declare function installSpotlightOverlay(options: SpotlightOverlayOptions): SpotlightOverlayHandle;
/** Create spotlight arrow renderer. */
export declare function createSpotlightArrowRenderer(options?: {
    readonly color?: number;
    readonly alpha?: number;
    readonly width?: number;
}): SpotlightAdornmentRenderer;
/** Compute spotlight overlay layout. */
export declare function computeSpotlightOverlayLayout(options: {
    readonly viewport: LayoutRect;
    readonly target: LayoutTargetSnapshot | LayoutRect;
    readonly preferredSide?: SpotlightAnchorSide;
}): SpotlightOverlayLayout;
