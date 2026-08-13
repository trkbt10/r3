/**
 * @file Barrel for the panel-effects library.
 *
 * Consumers import the factory they want (`dropShadow`, `outerGlow`,
 * `innerHighlight`, `borderPulse`, `cornerOrnaments`, …) and the
 * framework types (`UiPanelEffect` etc.) from here. Mirrors how
 * `src/scenes/world/board3d/effects` exposes a flat set of factory
 * functions — no registration, no central enum.
 */

export type {
  UiPanelEffect,
  UiPanelEffectContext,
  UiPanelEffectHandle,
  UiPanelEffectHost,
  UiPanelEffectHosts,
  UiPanelEffectRect,
} from "./types.ts";
export {
  DROP_SHADOW_DEFAULTS,
  dropShadow,
  type DropShadowOptions,
} from "./dropShadow.ts";
export {
  INNER_HIGHLIGHT_DEFAULTS,
  innerHighlight,
  type InnerHighlightOptions,
} from "./innerHighlight.ts";
export {
  OUTER_GLOW_DEFAULTS,
  outerGlow,
  type OuterGlowOptions,
} from "./outerGlow.ts";
export {
  BORDER_PULSE_DEFAULTS,
  borderPulse,
  type BorderPulseOptions,
} from "./borderPulse.ts";
export {
  CORNER_ORNAMENTS_DEFAULTS,
  cornerOrnaments,
  type CornerOrnamentsOptions,
} from "./cornerOrnaments.ts";
export {
  ELECTRIC_ARC_DEFAULTS,
  electricArc,
  type ElectricArcOptions,
} from "./electricArc.ts";
export {
  ORBS_DEFAULTS,
  orbs,
  type OrbPosition,
  type OrbsOptions,
} from "./orbs.ts";
export {
  AURORA_GLOW_DEFAULTS,
  auroraGlow,
  type AuroraGlowOptions,
} from "./auroraGlow.ts";
export {
  LIGHTNING_DEFAULTS,
  lightning,
  type LightningOptions,
} from "./lightning.ts";
export {
  PLASMA_ORBS_DEFAULTS,
  plasmaOrbs,
  type PlasmaOrbPosition,
  type PlasmaOrbsOptions,
} from "./plasmaOrbs.ts";
