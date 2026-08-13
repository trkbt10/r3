/**
 * @file plasmaOrbs — front-layer orbs with liquid-plasma interiors
 * rendered by a fragment shader, one shader-material instance per
 * orb. Replaces the "static halo + per-frame alpha multiplier"
 * canvas {@link orbs} approach with per-pixel FBM swirls that flow
 * inside the disc. The surface boundary is a discarded-outside
 * circle so there's no square halo rectangle showing through.
 *
 * ## Per-orb instance
 *
 * Each orb is its own {@link ShaderSurfaceNode} at a square plane
 * sized to the orb's diameter. The orb's centre aligns with the
 * plane's centre, so `vUv = 0.5` is the orb centre. A single
 * `ShaderSurfaceNode` per orb lets each one animate at its own
 * phase offset — the shader receives a `uSeed` uniform which
 * selects a distinct noise well, so two orbs with the same time
 * still read as visually different.
 *
 * ## Positioning
 *
 * Positions are supplied as normalised panel coordinates (0..1 on
 * each axis) like {@link orbs}. On `setRect` we reproject each orb
 * from its normalised position into pixel space so the orbs stick
 * to anchors through resizes (corner orbs stay at corners).
 */

import { Color } from "three";
import { ShaderSurfaceNode } from "./_shader-surface.ts";
import type {
  UiPanelEffect,
  UiPanelEffectContext,
  UiPanelEffectHandle,
  UiPanelEffectRect,
} from "./types.ts";

/** One orb anchor in normalised (0..1) panel coords. */
export type PlasmaOrbPosition = readonly [number, number];

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uAlpha;
  uniform vec3 uColor;
  uniform vec3 uCoreColor;
  uniform float uSpeed;
  uniform float uSeed;
  uniform float uIntensity;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Shift UV origin to the disc centre and scale to [-1, 1] so r
    // directly measures "how far out we are" — 0 at centre, 1 at
    // rim, >1 outside.
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) {
      discard;
    }

    // Radial body: generous core, soft falloff to rim.
    float body = exp(-r * 2.4);

    // Rotate the plasma sample coordinate over time so the swirls
    // orbit the orb centre rather than just translating.
    float rot = uTime * uSpeed * 0.45 + uSeed * 6.2831;
    float c = cos(rot);
    float s = sin(rot);
    vec2 swirled = vec2(p.x * c - p.y * s, p.x * s + p.y * c);

    // Two FBM layers at different frequencies/directions: the
    // mixture reads as a liquid plasma rather than a single-wave
    // pattern.
    float n1 = fbm(swirled * 2.2 + vec2(uTime * uSpeed * 0.6, uSeed * 11.0));
    float n2 = fbm(p * 4.0 - vec2(0.0, uTime * uSpeed * 0.8) + uSeed * 3.17);
    float plasma = pow(mix(n1, n2, 0.5), 1.8);

    // Sharp bright centre so the orb always has a clear "hot spot".
    float coreBoost = exp(-r * 9.0) * 1.8;

    // Rim highlight: a thin bright ring just inside the edge gives
    // the orb a crystal-ball quality.
    float rim = smoothstep(0.82, 0.96, r) * smoothstep(1.0, 0.95, r) * 0.9;

    float intensity = body + plasma * 0.55 * body + coreBoost + rim;
    intensity *= uIntensity;

    // Colour mixing: cool base tint modulated toward the hot core
    // where the core boost is strong; plasma adds variegated base
    // tint.
    vec3 col = mix(uColor, uCoreColor, clamp(coreBoost, 0.0, 1.0));
    col += uColor * plasma * 0.35;
    col += uCoreColor * rim;

    // Soft edge fade so the circular silhouette never shows a
    // rasterised stair-step.
    float edge = 1.0 - smoothstep(0.94, 1.0, r);
    float alpha = clamp(intensity, 0.0, 1.0) * edge;

    gl_FragColor = vec4(col * clamp(intensity, 0.0, 1.4), alpha * uAlpha);
  }
`;

export type PlasmaOrbsOptions = {
  /** Base orb tint. Default royal-violet. */
  readonly color?: number;
  /** Hot-core colour. Default near-white with a cool bias. */
  readonly coreColor?: number;
  /** Orb diameter in CSS pixels. Default 38. */
  readonly size?: number;
  /** Master intensity multiplier. Default 1. */
  readonly intensity?: number;
  /** Swirl speed in shader-seconds. Default 1. */
  readonly speed?: number;
  /** Normalised (0..1) positions on the panel. Default four corners. */
  readonly positions?: readonly PlasmaOrbPosition[];
};

const DEFAULT_POSITIONS: readonly PlasmaOrbPosition[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

export const PLASMA_ORBS_DEFAULTS = {
  color: 0x9966ff,
  coreColor: 0xf2eaff,
  size: 38,
  intensity: 1,
  speed: 1.0,
  positions: DEFAULT_POSITIONS,
} as const;

type Resolved = {
  readonly color: number;
  readonly coreColor: number;
  readonly size: number;
  readonly intensity: number;
  readonly speed: number;
  readonly positions: readonly PlasmaOrbPosition[];
};

function resolve(options: PlasmaOrbsOptions): Resolved {
  return {
    color: options.color ?? PLASMA_ORBS_DEFAULTS.color,
    coreColor: options.coreColor ?? PLASMA_ORBS_DEFAULTS.coreColor,
    size: options.size ?? PLASMA_ORBS_DEFAULTS.size,
    intensity: options.intensity ?? PLASMA_ORBS_DEFAULTS.intensity,
    speed: options.speed ?? PLASMA_ORBS_DEFAULTS.speed,
    positions: options.positions ?? PLASMA_ORBS_DEFAULTS.positions,
  };
}

function hexToVec3(hex: number): [number, number, number] {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

type MountedOrb = {
  readonly node: ShaderSurfaceNode;
  readonly normalised: PlasmaOrbPosition;
};

function reposition(orb: MountedOrb, size: number, rect: UiPanelEffectRect): void {
  const cx = rect.x + orb.normalised[0] * rect.width;
  const cy = rect.y + orb.normalised[1] * rect.height;
  // ShaderSurfaceNode uses a top-left pivot like Graphics, so shift
  // up-and-left by half the orb's size to centre the disc on (cx, cy).
  orb.node.setPosition(cx - size * 0.5, cy - size * 0.5);
}

/**
 * Panel effect: N plasma-swirl orbs at configurable normalised
 * positions. Attaches to the `front` layer. Animated — the plaque
 * owner drives `tick`.
 */
export function plasmaOrbs(
  options: PlasmaOrbsOptions = {},
): UiPanelEffect {
  const resolved = resolve(options);
  return function mount(
    ctx: UiPanelEffectContext,
    rect: UiPanelEffectRect,
  ): UiPanelEffectHandle {
    const colorVec = hexToVec3(resolved.color);
    const coreVec = hexToVec3(resolved.coreColor);
    const mounted: MountedOrb[] = resolved.positions.map((pos, i) => {
      const node = new ShaderSurfaceNode({
        name: "r3:panel-effect:plasma-orb",
        width: resolved.size,
        height: resolved.size,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: colorVec },
          uCoreColor: { value: coreVec },
          uSpeed: { value: resolved.speed },
          uIntensity: { value: resolved.intensity },
          // Per-orb seed so two orbs at the same phase still look
          // distinct — 1/7.3 is an arbitrary irrational step that
          // avoids seeds clustering into visible groups.
          uSeed: { value: i / 7.3 },
        },
      });
      ctx.hosts.front.add(node);
      const entry: MountedOrb = { node, normalised: pos };
      reposition(entry, resolved.size, rect);
      return entry;
    });

    return {
      setRect(next: UiPanelEffectRect): void {
        for (const m of mounted) {
          reposition(m, resolved.size, next);
        }
      },
      tick(dtSeconds: number): boolean {
        for (const m of mounted) {
          m.node.tick(dtSeconds);
        }
        return false;
      },
      destroy(): void {
        for (const m of mounted) {
          m.node.destroy();
        }
      },
    };
  };
}
