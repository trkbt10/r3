import { Stage } from './Stage.ts';
export type CanvasPointerBridgeOptions = {
    readonly canvas: HTMLCanvasElement;
    readonly stage: Stage;
};
export type CanvasPointerBridgeHandle = {
    /** Detaches every listener the bridge installed. */
    readonly dispose: () => void;
};
/**
 * Attaches mouse + touch + wheel + contextmenu listeners to the
 * canvas and forwards them to the stage's pointer manager. Returns
 * a handle whose `dispose()` removes every listener so hot-reload
 * re-boots don't accumulate duplicates.
 */
export declare function attachCanvasPointerBridge(options: CanvasPointerBridgeOptions): CanvasPointerBridgeHandle;
