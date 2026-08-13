/**
 * @file lightning — front-layer lightning effect done entirely in a
 * fragment shader. Replaces the canvas-CPU-polyline approach of
 * {@link electricArc} (which regenerates point lists every cycle and
 * repaints them into a 2D canvas) with a pure per-pixel
 * signed-distance field to a set of noise-warped vertical channels.
 *
 * ## What the shader does
 *
 * Three independent bolts run top-to-bottom across the panel. Each
 * bolt:
 *
 *   1. has a base X position (distributed evenly across the panel
 *      so they don't all stack on top of each other),
 *   2. warps that X at every sample-Y by reading fractal-noise
 *      advanced with `uTime`, so the bolt's path wanders
 *      continuously — no respawn, no popping,
 *   3. flickers along its length using a second noise lookup so the
 *      bolt appears / fades / re-appears in segments the way real
 *      lightning does,
 *   4. gets a sharp pixel-width core, a wider soft halo, and a
 *      colour-mixed rim; the halo contribution multiplies into the
 *      final alpha so the outer glow doesn't look separately opaque
 *      from the core.
 *
 * `uSize` (panel pixel dimensions) is what lets the bolt widths be
 * pixel-accurate across panel resizes — we convert the shader's
 * UV-space distance to pixels before applying smoothstep thresholds.
 *
 * Because noise is sampled every frame as a function of `uTime`, the
 * bolts are constantly moving. There's no CPU-side state to sync;
 * a resize just changes `uSize` and the next frame is already in
 * the correct pixel budget.
 */

import { Color } from "three";
import { ShaderSurfaceNode } from "./_shader-surface.ts";
import type {
  UiPanelEffect,
  UiPanelEffectContext,
  UiPanelEffectHandle,
  UiPanelEffectRect,
} from "./types.ts";

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uAlpha;
  uniform vec2 uSize;
  uniform vec3 uCoreColor;
  uniform vec3 uGlowColor;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform float uWarp;         // warp amplitude in UV units (0..0.5)
  uniform float uCoreWidthPx;  // core half-width in pixels
  uniform float uHaloWidthPx;  // halo half-width in pixels

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

  /**
   * Contribution of one bolt centred at (xCenter, y-axis) with a
   * per-bolt noise seed. Returns intensity in [0, ~1]; caller sums
   * multiple bolts.
   */
  float boltContribution(vec2 uv, float xCenter, float seed) {
    // Warp the bolt's X coordinate along its length. Two octaves so
    // there are both broad sweeps and fine jitter — a single octave
    // looks like a waveform; two reads as a lightning path.
    float warp =
      (fbm(vec2(uv.y * 3.5 + uTime * uSpeed, seed)) - 0.5) * uWarp * 1.2 +
      (fbm(vec2(uv.y * 9.0 - uTime * uSpeed * 1.6, seed + 4.2)) - 0.5) * uWarp * 0.45;
    float warpedX = xCenter + warp;

    // Pixel-space distance from this fragment to the warped channel.
    float pxDist = abs(uv.x - warpedX) * uSize.x;

    // Core: hard line of ~uCoreWidthPx pixels; smoothstep avoids a
    // shimmery aliased edge on sub-pixel movement.
    float core = 1.0 - smoothstep(0.0, uCoreWidthPx, pxDist);
    // Halo: much wider, much softer; sums with the core.
    float halo = 1.0 - smoothstep(0.0, uHaloWidthPx, pxDist);

    // Per-bolt vertical flicker: noise along the bolt's length,
    // thresholded so the bolt is visible only where flicker > 0.45.
    // Multiplied with the time-sweep so the "on" segments travel.
    float flicker =
      fbm(vec2(uv.y * 7.0 + uTime * uSpeed * 2.0, seed * 3.1 + uTime * 0.6));
    float gate = smoothstep(0.45, 0.75, flicker);

    // Rare whole-bolt blackout — when a slow noise crosses below a
    // threshold the bolt goes dark for a moment, giving the pool of
    // bolts a natural "gap" rhythm without looking identical.
    float pulse = fbm(vec2(uTime * uSpeed * 0.9, seed * 17.0));
    float alive = smoothstep(0.35, 0.55, pulse);

    return (core + halo * 0.55) * gate * alive;
  }

  void main() {
    // Three bolts distributed across the panel.
    float total = 0.0;
    total += boltContribution(vUv, 0.2, 0.11);
    total += boltContribution(vUv, 0.5, 0.43);
    total += boltContribution(vUv, 0.8, 0.77);

    // Scale by master intensity.
    total *= uIntensity;

    // Colour: white-hot core transitioning into the glow tint at
    // lower intensity. smoothstep so the transition is an obvious
    // hot centre rather than a linear ramp.
    vec3 col = mix(uGlowColor, uCoreColor, smoothstep(0.6, 1.2, total));
    float alpha = clamp(total, 0.0, 1.0);
    gl_FragColor = vec4(col * alpha, alpha * uAlpha);
  }
`;

export type LightningOptions = {
  /** Bright bolt-core colour. Default icy white. */
  readonly color?: number;
  /** Outer glow colour the halo tints toward. Default saturated indigo. */
  readonly glowColor?: number;
  /** Master intensity multiplier. Default 1. */
  readonly intensity?: number;
  /**
   * Noise scroll speed in shader-seconds-per-second. Higher = the
   * bolts wiggle and flicker faster. Default 1.8.
   */
  readonly speed?: number;
  /**
   * Horizontal warp amplitude in UV units (0..0.5). Default 0.12 — a
   * meaningful sway without any single bolt crossing more than a
   * fifth of the panel width.
   */
  readonly warp?: number;
  /** Core half-width in CSS pixels. Default 1.2. */
  readonly coreWidthPx?: number;
  /** Halo half-width in CSS pixels. Default 14. */
  readonly haloWidthPx?: number;
};

export const LIGHTNING_DEFAULTS: Required<LightningOptions> = {
  color: 0xf2f6ff,
  glowColor: 0x5a7dff,
  intensity: 1,
  speed: 1.8,
  warp: 0.12,
  coreWidthPx: 1.2,
  haloWidthPx: 14,
};

type Resolved = Required<LightningOptions>;

function resolve(options: LightningOptions): Resolved {
  return {
    color: options.color ?? LIGHTNING_DEFAULTS.color,
    glowColor: options.glowColor ?? LIGHTNING_DEFAULTS.glowColor,
    intensity: options.intensity ?? LIGHTNING_DEFAULTS.intensity,
    speed: options.speed ?? LIGHTNING_DEFAULTS.speed,
    warp: options.warp ?? LIGHTNING_DEFAULTS.warp,
    coreWidthPx: options.coreWidthPx ?? LIGHTNING_DEFAULTS.coreWidthPx,
    haloWidthPx: options.haloWidthPx ?? LIGHTNING_DEFAULTS.haloWidthPx,
  };
}

function hexToVec3(hex: number): [number, number, number] {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

/**
 * Panel effect: shader-rendered lightning bolts. Attaches to the
 * `front` layer so the bolts paint over the chrome. Animated —
 * the plaque owner drives `tick`.
 */
export function lightning(options: LightningOptions = {}): UiPanelEffect {
  const resolved = resolve(options);
  return function mount(
    ctx: UiPanelEffectContext,
    rect: UiPanelEffectRect,
  ): UiPanelEffectHandle {
    const node = new ShaderSurfaceNode({
      name: "r3:panel-effect:lightning",
      width: rect.width,
      height: rect.height,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uCoreColor: { value: hexToVec3(resolved.color) },
        uGlowColor: { value: hexToVec3(resolved.glowColor) },
        uIntensity: { value: resolved.intensity },
        uSpeed: { value: resolved.speed },
        uWarp: { value: resolved.warp },
        uCoreWidthPx: { value: resolved.coreWidthPx },
        uHaloWidthPx: { value: resolved.haloWidthPx },
      },
    });
    node.setPosition(rect.x, rect.y);
    ctx.hosts.front.add(node);

    return {
      setRect(next: UiPanelEffectRect): void {
        node.setSize(next.width, next.height);
        node.setPosition(next.x, next.y);
      },
      tick(dtSeconds: number): boolean {
        node.tick(dtSeconds);
        return false;
      },
      destroy(): void {
        node.destroy();
      },
    };
  };
}
