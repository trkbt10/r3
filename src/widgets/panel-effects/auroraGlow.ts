/**
 * @file auroraGlow — back-layer glow that sits around the panel
 * silhouette, shaded entirely on the GPU. Replaces the "blurred
 * rectangle silhouette" look of the canvas {@link outerGlow} with a
 * true fragment-shader halo: a signed-distance-field falloff around
 * a rounded-rect panel outline, modulated by fractal Brownian motion
 * noise that flows with {@link uTime}, and a two-colour hue mix that
 * sweeps around the rim. The result reads as a living, breathing
 * aurora clinging to the panel rather than a flat static stamp.
 *
 * ## Surface sizing
 *
 * The shader plane is larger than the panel by `spread` pixels on
 * every side — the glow needs somewhere to fade into. The plane's
 * centre aligns with the panel's centre, so the rounded-rect SDF
 * evaluated at the fragment's position gives the signed distance
 * from the panel outline directly. On `setRect` we resize the
 * plane to track the panel but keep the same spread padding.
 *
 * ## Why two colours plus fbm
 *
 * A single-hue bloom reads as "static glow". Aurora is *alive* —
 * shifting cold-to-warm as the ribbon moves. Two base colours
 * mixed by a time-animated sine of the distance + UV produces the
 * ribbon effect; fractal noise mixed into the intensity breaks the
 * radial-symmetric look so the glow doesn't look like a mathematical
 * perfectly-circular fall-off.
 */

import { Color } from "three";
import { ShaderSurfaceNode } from "./_shader-surface.ts";
import type {
  UiPanelEffect,
  UiPanelEffectContext,
  UiPanelEffectHandle,
  UiPanelEffectRect,
} from "./types.ts";

/**
 * Fragment shader source. The outer fade-off, rim-light concentration,
 * and aurora-ribbon colour mix all live here. `uTime` is the surface's
 * elapsed-seconds uniform; fbm is seeded with `vUv + uTime * speed`
 * so the flow scrolls rather than pulsing in place.
 */
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uAlpha;
  uniform vec2 uSize;           // plane size (panel + padding)
  uniform vec2 uPanelHalf;      // half-size of the panel in px
  uniform float uRadius;        // panel corner radius in px
  uniform float uSpread;        // glow reach outside the panel, px
  uniform float uIntensity;     // master multiplier
  uniform vec3 uColorInner;
  uniform vec3 uColorOuter;
  uniform float uFlowSpeed;
  uniform float uNoiseScale;

  // --- SDF to a rounded rectangle centred at origin ---
  float sdRoundedRect(vec2 p, vec2 halfSize, float r) {
    vec2 q = abs(p) - halfSize + vec2(r);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  // --- Hash + value noise + FBM ---
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
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Pixel position relative to the plane centre. The panel is
    // co-centred, so this is also the offset from the panel centre.
    vec2 p = (vUv - 0.5) * uSize;
    float sdf = sdRoundedRect(p, uPanelHalf, uRadius);

    // Inside the panel or right on its outline we draw nothing — the
    // chrome will cover us, and leaking alpha there would dim the
    // frame.
    if (sdf <= 0.0) {
      discard;
    }

    // Primary falloff: exponential drop-off over the spread distance.
    float falloff = exp(-sdf / max(uSpread * 0.4, 1.0));

    // Secondary rim-light: a sharper, brighter contribution within
    // ~8% of spread from the edge. Gives the silhouette a crisp
    // "lit outline" read on top of the soft bloom.
    float rim = smoothstep(uSpread * 0.08, 0.0, sdf) * 0.6;

    // Ribbon hue mix — sweeps with time.
    float sweep = sin(uTime * uFlowSpeed + sdf * 0.015 + vUv.x * 4.0 - vUv.y * 2.5);
    float mixT = 0.5 + 0.5 * sweep;
    vec3 color = mix(uColorInner, uColorOuter, mixT);

    // Aurora-flow texture: FBM scrolling along the panel's long axis.
    // Subtle multiplier so the glow retains overall coherence without
    // turning into a noise field.
    float flow = fbm(vUv * uNoiseScale + vec2(uTime * uFlowSpeed * 0.3, uTime * uFlowSpeed * -0.2));
    float modulated = 0.78 + 0.22 * flow;

    float intensity = (falloff + rim) * modulated * uIntensity;
    gl_FragColor = vec4(color * intensity, intensity * uAlpha);
  }
`;

export type AuroraGlowOptions = {
  /** Primary colour near the panel edge. Default warm gold. */
  readonly colorInner?: number;
  /** Secondary colour the flow sweeps toward. Default cool magenta. */
  readonly colorOuter?: number;
  /** Overall intensity multiplier. Default 1. */
  readonly intensity?: number;
  /** How far the glow reaches outside the panel edge, in CSS pixels. Default 42. */
  readonly spread?: number;
  /**
   * Flow speed in radians / second of shader-time — higher = faster
   * colour sweep and noise drift. Default 0.9 (a calm breathing
   * pace).
   */
  readonly flowSpeed?: number;
  /** Noise scale — how busy the aurora-ribbon flow looks. Default 2.6. */
  readonly noiseScale?: number;
};

export const AURORA_GLOW_DEFAULTS: Required<AuroraGlowOptions> = {
  colorInner: 0xffd27a,
  colorOuter: 0xff6bdc,
  intensity: 1,
  spread: 42,
  flowSpeed: 0.9,
  noiseScale: 2.6,
};

type Resolved = Required<AuroraGlowOptions>;

function resolve(options: AuroraGlowOptions): Resolved {
  return {
    colorInner: options.colorInner ?? AURORA_GLOW_DEFAULTS.colorInner,
    colorOuter: options.colorOuter ?? AURORA_GLOW_DEFAULTS.colorOuter,
    intensity: options.intensity ?? AURORA_GLOW_DEFAULTS.intensity,
    spread: options.spread ?? AURORA_GLOW_DEFAULTS.spread,
    flowSpeed: options.flowSpeed ?? AURORA_GLOW_DEFAULTS.flowSpeed,
    noiseScale: options.noiseScale ?? AURORA_GLOW_DEFAULTS.noiseScale,
  };
}

function hexToVec3(hex: number): [number, number, number] {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

/**
 * Panel effect: shader-rendered aurora-like outer glow. Attaches to
 * the `back` layer. Animated — the plaque owner drives `tick`.
 */
export function auroraGlow(options: AuroraGlowOptions = {}): UiPanelEffect {
  const resolved = resolve(options);
  return function mount(
    ctx: UiPanelEffectContext,
    rect: UiPanelEffectRect,
  ): UiPanelEffectHandle {
    const { spread } = resolved;
    const surfaceW = rect.width + spread * 2;
    const surfaceH = rect.height + spread * 2;

    const node = new ShaderSurfaceNode({
      name: "r3:panel-effect:aurora-glow",
      width: surfaceW,
      height: surfaceH,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uPanelHalf: { value: [rect.width * 0.5, rect.height * 0.5] },
        uRadius: { value: ctx.radius },
        uSpread: { value: spread },
        uIntensity: { value: resolved.intensity },
        uColorInner: { value: hexToVec3(resolved.colorInner) },
        uColorOuter: { value: hexToVec3(resolved.colorOuter) },
        uFlowSpeed: { value: resolved.flowSpeed },
        uNoiseScale: { value: resolved.noiseScale },
      },
    });
    // Position the plane so its centre aligns with the panel centre —
    // `node` uses a top-left pivot so we offset by the spread on each
    // axis to extend beyond the panel rect symmetrically.
    node.setPosition(rect.x - spread, rect.y - spread);
    ctx.hosts.back.add(node);

    return {
      setRect(next: UiPanelEffectRect): void {
        node.setSize(next.width + spread * 2, next.height + spread * 2);
        node.setPosition(next.x - spread, next.y - spread);
        const u = node.material.uniforms.uPanelHalf;
        if (u) {
          u.value = [next.width * 0.5, next.height * 0.5];
        }
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
