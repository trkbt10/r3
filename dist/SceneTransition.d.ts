import { SceneData } from './Scene.ts';
import { SceneManager, StartOptions } from './SceneManager.ts';
import { Stage } from './Stage.ts';
import { TextureManager } from './texture-canvas';
export type R3FadeToSceneOptions = {
    readonly stage: Stage;
    readonly textureManager: TextureManager;
    readonly scenes: SceneManager;
    readonly toKey: string;
    readonly payload?: SceneData;
    /**
     * Mirror of {@link StartOptions} — defaults to `replace: true` so
     * a fade-to-scene stops every other active scene (the common case
     * for menu navigation; modal launches use `start` directly).
     */
    readonly startOptions?: StartOptions;
    readonly fadeOutMs?: number;
    readonly fadeInMs?: number;
};
/**
 * Fades the screen to black, swaps the active scene to `toKey`, then
 * fades back in. Returns nothing — callers use the SceneManager to
 * inspect the new active scene if needed.
 */
export declare function r3FadeToScene(options: R3FadeToSceneOptions): void;
/**
 * Fades the screen in from black without a scene swap. Useful for
 * the very first frame when the host wants the player to see the
 * initial scene appear from black rather than pop in.
 */
export declare function r3FadeIn(stage: Stage, textureManager: TextureManager, durationMs?: number): void;
