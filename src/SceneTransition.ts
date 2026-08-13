/**
 * @file Fade-based r3 scene transition helper.
 *
 * Mirrors `src/scenes/SceneTransition.ts` semantics — fade out the
 * current view to black, swap to the target scene, fade in — but
 * uses a stage-level overlay rect (instead of a Phaser camera fade)
 * so it works regardless of which scene is active.
 *
 * The overlay sits at a very high depth so it paints above every
 * normal scene root. Its alpha is tweened to 1 (fade-out) then
 * straight back to 0 (fade-in) once the manager has switched the
 * active scene at the dark midpoint.
 */

import { Container } from "./Container.ts";
import { Rect } from "./Rect.ts";
import type { SceneData } from "./Scene.ts";
import type { SceneManager, StartOptions } from "./SceneManager.ts";
import type { Stage } from "./Stage.ts";
import type { TextureManager } from "./texture-canvas";
import { COLOR } from "./theme";

const FADE_OUT_MS = 360;
const FADE_IN_MS = 420;
/** Sits above any normal scene depth (modals top out around 2000). */
const FADE_OVERLAY_DEPTH = 9000;

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
export function r3FadeToScene(options: R3FadeToSceneOptions): void {
  const fadeOutMs = options.fadeOutMs ?? FADE_OUT_MS;
  const fadeInMs = options.fadeInMs ?? FADE_IN_MS;
  // Veil sizes itself to the host stage's screen — no override path,
  // so a missing injection can't be silently filled in.
  const { width: viewportWidth, height: viewportHeight } = options.stage.screen;

  const overlayRoot = new Container({ name: "r3:fade-overlay" });
  overlayRoot.setDepth(FADE_OVERLAY_DEPTH);
  const veil = new Rect({
    x: 0,
    y: 0,
    width: viewportWidth,
    height: viewportHeight,
    fill: COLOR.BLACK,
    fillAlpha: 1,
    interactive: true,
    alpha: 0,
    textureManager: options.textureManager,
  });
  overlayRoot.add(veil);
  options.stage.root.add(overlayRoot);

  options.stage.tweens.add({
    targets: veil,
    alpha: 1,
    duration: fadeOutMs,
    ease: "Quad.easeIn",
    onComplete: () => {
      // Swap the scene at the dark midpoint so the player never sees
      // the new scene flash into existence — it's already painting
      // beneath the opaque veil when the fade-in starts.
      const startOpts = options.startOptions ?? { replace: true };
      options.scenes.start(options.toKey, options.payload, startOpts);
      options.stage.tweens.add({
        targets: veil,
        alpha: 0,
        duration: fadeInMs,
        ease: "Quad.easeOut",
        onComplete: () => {
          overlayRoot.destroy();
        },
      });
    },
  });
}

/**
 * Fades the screen in from black without a scene swap. Useful for
 * the very first frame when the host wants the player to see the
 * initial scene appear from black rather than pop in.
 */
export function r3FadeIn(
  stage: Stage,
  textureManager: TextureManager,
  durationMs = FADE_IN_MS,
): void {
  const overlayRoot = new Container({ name: "r3:fade-in-overlay" });
  overlayRoot.setDepth(FADE_OVERLAY_DEPTH);
  const veil = new Rect({
    x: 0,
    y: 0,
    width: stage.screen.width,
    height: stage.screen.height,
    fill: COLOR.BLACK,
    fillAlpha: 1,
    interactive: true,
    alpha: 1,
    textureManager,
  });
  overlayRoot.add(veil);
  stage.root.add(overlayRoot);
  stage.tweens.add({
    targets: veil,
    alpha: 0,
    duration: durationMs,
    ease: "Quad.easeOut",
    onComplete: () => {
      overlayRoot.destroy();
    },
  });
}
