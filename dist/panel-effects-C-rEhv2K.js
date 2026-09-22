import { c as e, o as t, t as n } from "./Graphics-DukR35Yh.js";
import { AdditiveBlending as r, Color as i, Mesh as a, PlaneGeometry as o, ShaderMaterial as s, Vector2 as c } from "three";
//#region src/widgets/panel-effects/_blurred-silhouette.ts
function l(e) {
	return Math.max(8, Math.ceil(e * 3));
}
function u(e, t, n, r, i) {
	let a = l(t.blur);
	e.clear(), e.fillStyle(t.color, t.alpha), e.fillBlurredRoundedRect(a, a, r, i, n, t.blur);
}
function d(e, t, r, i, a, o) {
	let s = l(e.blur);
	return new n({
		x: r + e.offsetX - s,
		y: i + e.offsetY - s,
		width: a + s * 2,
		height: o + s * 2,
		originX: 0,
		originY: 0,
		textureManager: t
	});
}
function f(e, t, n, r, i, a) {
	let o = l(t.blur);
	e.setPosition(n + t.offsetX - o, r + t.offsetY - o), e.setSize(i + o * 2, a + o * 2);
}
//#endregion
//#region src/widgets/panel-effects/dropShadow.ts
var p = {
	offsetX: 0,
	offsetY: 6,
	color: 0,
	alpha: .45,
	blur: 12
};
function m(e) {
	return {
		offsetX: e.offsetX ?? p.offsetX,
		offsetY: e.offsetY ?? p.offsetY,
		color: e.color ?? p.color,
		alpha: e.alpha ?? p.alpha,
		blur: e.blur ?? p.blur
	};
}
function h(e = {}) {
	let t = m(e);
	return function(e, n) {
		let r = d(t, e.textureManager, n.x, n.y, n.width, n.height);
		return u(r, t, e.radius, n.width, n.height), e.hosts.back.add(r), {
			setRect(n) {
				f(r, t, n.x, n.y, n.width, n.height), u(r, t, e.radius, n.width, n.height);
			},
			destroy() {
				r.destroy();
			}
		};
	};
}
//#endregion
//#region src/widgets/panel-effects/innerHighlight.ts
var g = {
	color: 16773336,
	alpha: .22,
	coverage: .5,
	blur: 10,
	inset: 6
};
function _(e) {
	return {
		color: e.color ?? g.color,
		alpha: e.alpha ?? g.alpha,
		coverage: e.coverage ?? g.coverage,
		blur: e.blur ?? g.blur,
		inset: e.inset ?? g.inset
	};
}
function v(e, t, n, r, i) {
	e.clear();
	let a = Math.max(0, r - t.inset * 2), o = Math.max(0, Math.min(i - t.inset, i * t.coverage));
	if (a <= 0 || o <= 0) return;
	let s = Math.max(0, n - t.inset);
	e.fillStyle(t.color, t.alpha), e.fillBlurredRoundedRect(t.inset, t.inset, a, o, s, t.blur);
}
function ee(e = {}) {
	let t = _(e);
	return function(e, r) {
		let i = new n({
			x: r.x,
			y: r.y,
			width: r.width,
			height: r.height,
			originX: 0,
			originY: 0,
			textureManager: e.textureManager
		});
		return v(i, t, e.radius, r.width, r.height), e.hosts.front.add(i), {
			setRect(n) {
				i.setPosition(n.x, n.y), i.setSize(n.width, n.height), v(i, t, e.radius, n.width, n.height);
			},
			destroy() {
				i.destroy();
			}
		};
	};
}
//#endregion
//#region src/widgets/panel-effects/outerGlow.ts
var y = {
	color: 16765562,
	alpha: .55,
	blur: 22,
	offsetX: 0,
	offsetY: 0
};
function b(e) {
	return {
		color: e.color ?? y.color,
		alpha: e.alpha ?? y.alpha,
		blur: e.blur ?? y.blur,
		offsetX: e.offsetX ?? y.offsetX,
		offsetY: e.offsetY ?? y.offsetY
	};
}
function x(e = {}) {
	let t = b(e);
	return function(e, n) {
		let r = d(t, e.textureManager, n.x, n.y, n.width, n.height);
		return u(r, t, e.radius, n.width, n.height), e.hosts.back.add(r), {
			setRect(n) {
				f(r, t, n.x, n.y, n.width, n.height), u(r, t, e.radius, n.width, n.height);
			},
			destroy() {
				r.destroy();
			}
		};
	};
}
//#endregion
//#region src/widgets/panel-effects/borderPulse.ts
var S = {
	color: 16765562,
	width: 2,
	inset: 2,
	peakAlpha: .9,
	troughAlpha: .25,
	periodMs: 1800
};
function te(e) {
	return {
		color: e.color ?? S.color,
		width: e.width ?? S.width,
		inset: e.inset ?? S.inset,
		peakAlpha: e.peakAlpha ?? S.peakAlpha,
		troughAlpha: e.troughAlpha ?? S.troughAlpha,
		periodMs: e.periodMs ?? S.periodMs
	};
}
function C(e, t, n, r, i) {
	e.clear();
	let a = Math.max(0, r - t.inset * 2), o = Math.max(0, i - t.inset * 2);
	a <= 0 || o <= 0 || (e.lineStyle(t.width, t.color, 1), e.strokeRoundedRect(t.inset, t.inset, a, o, Math.max(0, n - t.inset)));
}
function ne(e = {}) {
	let t = te(e);
	return function(e, r) {
		let i = new n({
			x: r.x,
			y: r.y,
			width: r.width,
			height: r.height,
			originX: 0,
			originY: 0,
			textureManager: e.textureManager
		});
		C(i, t, e.radius, r.width, r.height), e.hosts.front.add(i);
		let a = { elapsedMs: 0 };
		return i.setAlpha((t.peakAlpha + t.troughAlpha) / 2), {
			setRect(n) {
				i.setPosition(n.x, n.y), i.setSize(n.width, n.height), C(i, t, e.radius, n.width, n.height);
			},
			tick(e) {
				a.elapsedMs += e * 1e3;
				let n = a.elapsedMs / t.periodMs * Math.PI * 2, r = .5 - .5 * Math.cos(n), o = t.troughAlpha + (t.peakAlpha - t.troughAlpha) * r;
				return i.setAlpha(o), !1;
			},
			destroy() {
				i.destroy();
			}
		};
	};
}
//#endregion
//#region src/widgets/panel-effects/cornerOrnaments.ts
var w = {
	color: 16765562,
	width: 2,
	alpha: .85,
	armLength: 14,
	inset: 8,
	scale: !1,
	referenceSize: 48
};
function T(e) {
	return {
		color: e.color ?? w.color,
		width: e.width ?? w.width,
		alpha: e.alpha ?? w.alpha,
		armLength: e.armLength ?? w.armLength,
		inset: e.inset ?? w.inset,
		scale: e.scale ?? w.scale,
		referenceSize: e.referenceSize ?? w.referenceSize
	};
}
function E(e, t, n, r) {
	e.clear();
	let i = Math.min(n, r), a = t.scale ? Math.min(1, i / t.referenceSize) : 1, o = t.armLength * a, s = t.inset * a, c = t.scale ? Math.max(1, t.width * a) : t.width, l = Math.max(0, Math.min(o, n / 2 - s)), u = Math.max(0, Math.min(o, r / 2 - s));
	if (l <= 0 || u <= 0) return;
	e.lineStyle(c, t.color, t.alpha), e.strokeLine(s, s, s + l, s), e.strokeLine(s, s, s, s + u);
	let d = n - s;
	e.strokeLine(d, s, d - l, s), e.strokeLine(d, s, d, s + u);
	let f = r - s;
	e.strokeLine(s, f, s + l, f), e.strokeLine(s, f, s, f - u), e.strokeLine(d, f, d - l, f), e.strokeLine(d, f, d, f - u);
}
function D(e = {}) {
	let r = T(e);
	return function(e, i) {
		let a = new t({
			x: i.x,
			y: i.y,
			name: "r3:panel-effect:corner-ornaments"
		}), o = new n({
			x: 0,
			y: 0,
			width: i.width,
			height: i.height,
			originX: 0,
			originY: 0,
			textureManager: e.textureManager
		});
		return a.add(o), E(o, r, i.width, i.height), e.hosts.front.add(a), {
			setRect(e) {
				a.setPosition(e.x, e.y), o.setSize(e.width, e.height), E(o, r, e.width, e.height);
			},
			destroy() {
				a.destroy();
			}
		};
	};
}
//#endregion
//#region src/widgets/panel-effects/electricArc.ts
var O = {
	color: 15266559,
	glowColor: 6983167,
	arcCount: 3,
	cycleMs: 420,
	activeRatio: .45,
	coreWidth: 1.6,
	glowWidth: 5,
	segments: 6,
	jitter: 14
};
function k(e) {
	return {
		color: e.color ?? O.color,
		glowColor: e.glowColor ?? O.glowColor,
		arcCount: e.arcCount ?? O.arcCount,
		cycleMs: e.cycleMs ?? O.cycleMs,
		activeRatio: e.activeRatio ?? O.activeRatio,
		coreWidth: e.coreWidth ?? O.coreWidth,
		glowWidth: e.glowWidth ?? O.glowWidth,
		segments: e.segments ?? O.segments,
		jitter: e.jitter ?? O.jitter
	};
}
function A(e, t) {
	let n = 2 * (e + t), r = Math.random() * n;
	return r < e ? [r, 0] : r < e + t ? [e, r - e] : r < e * 2 + t ? [e * 2 + t - r, t] : [0, n - r];
}
function j(e, t, n) {
	let r = t[0] - e[0], i = t[1] - e[1], a = Math.hypot(r, i);
	if (a === 0) return [e, t];
	let o = -i / a, s = r / a, c = [e], l = n.segments;
	for (let t = 1; t <= l; t++) {
		let a = t / (l + 1), u = Math.sin(a * Math.PI), d = (Math.random() * 2 - 1) * n.jitter * u, f = e[0] + r * a + o * d, p = e[1] + i * a + s * d;
		c.push([f, p]);
	}
	return c.push(t), c;
}
function M(e, t) {
	return {
		points: j(A(t.width, t.height), A(t.width, t.height), e),
		elapsedMs: 0
	};
}
function re(e, t) {
	if (t >= e.activeRatio) return 0;
	let n = t / e.activeRatio, r = .2, i = .7;
	return n < r ? n / r : n > i ? Math.max(0, 1 - (n - i) / (1 - i)) : 1;
}
function ie(e, t, n, r) {
	if (r <= 0 || n.points.length < 2) return;
	let i = [
		[
			t.glowWidth,
			t.glowColor,
			r * .25
		],
		[
			t.glowWidth * .5,
			t.glowColor,
			r * .55
		],
		[
			t.coreWidth,
			t.color,
			r
		]
	];
	for (let [t, r, a] of i) {
		e.lineStyle(t, r, a), e.beginPath();
		let i = n.points[0];
		if (i) {
			e.moveTo(i[0], i[1]);
			for (let t = 1; t < n.points.length; t++) {
				let r = n.points[t];
				r && e.lineTo(r[0], r[1]);
			}
			e.strokePath();
		}
	}
}
function N(e = {}) {
	let t = k(e);
	return function(e, r) {
		let i = { rect: r }, a = new n({
			x: r.x,
			y: r.y,
			width: r.width,
			height: r.height,
			originX: 0,
			originY: 0,
			textureManager: e.textureManager
		});
		e.hosts.front.add(a);
		let o = [];
		for (let e = 0; e < t.arcCount; e++) {
			let n = M(t, r);
			n.elapsedMs = t.cycleMs * e / t.arcCount, o.push(n);
		}
		function s() {
			a.clear();
			for (let e of o) ie(a, t, e, re(t, e.elapsedMs / t.cycleMs));
		}
		return s(), {
			setRect(e) {
				a.setPosition(e.x, e.y), a.setSize(e.width, e.height), i.rect = e;
				for (let n of o) n.points = M(t, e).points;
				s();
			},
			tick(e) {
				let n = e * 1e3;
				for (let e of o) for (e.elapsedMs += n; e.elapsedMs >= t.cycleMs;) e.elapsedMs -= t.cycleMs, e.points = M(t, i.rect).points;
				return s(), !1;
			},
			destroy() {
				a.destroy();
			}
		};
	};
}
var P = {
	color: 16765562,
	coreRadius: 4,
	haloRadius: 12,
	haloBlur: 12,
	alphaMax: 1,
	alphaMin: .35,
	periodMs: 2400,
	phaseStagger: .25,
	positions: [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1]
	]
};
function F(e) {
	return {
		color: e.color ?? P.color,
		coreRadius: e.coreRadius ?? P.coreRadius,
		haloRadius: e.haloRadius ?? P.haloRadius,
		haloBlur: e.haloBlur ?? P.haloBlur,
		alphaMax: e.alphaMax ?? P.alphaMax,
		alphaMin: e.alphaMin ?? P.alphaMin,
		periodMs: e.periodMs ?? P.periodMs,
		phaseStagger: e.phaseStagger ?? P.phaseStagger,
		positions: e.positions ?? P.positions
	};
}
function I(e) {
	return Math.max(6, Math.ceil(e * 3));
}
function L(e) {
	return I(e.haloBlur) * 2 + e.haloRadius * 2;
}
function R(e, t) {
	let n = I(t.haloBlur), r = n + t.haloRadius, i = n + t.haloRadius;
	e.clear(), e.fillStyle(t.color, .7), e.fillBlurredRoundedRect(n, n, t.haloRadius * 2, t.haloRadius * 2, t.haloRadius, t.haloBlur), e.fillStyle(t.color, 1), e.fillCircle(r, i, t.coreRadius);
}
function z(e, t, n) {
	let r = (t + n) / e.periodMs, i = .5 - .5 * Math.cos(r * Math.PI * 2);
	return e.alphaMin + (e.alphaMax - e.alphaMin) * i;
}
function B(e, t, n) {
	let r = I(t.haloBlur), i = n.x + e.normalised[0] * n.width, a = n.y + e.normalised[1] * n.height;
	e.node.setPosition(i - (r + t.haloRadius), a - (r + t.haloRadius));
}
function V(e = {}) {
	let r = F(e);
	return function(e, i) {
		let a = new t({
			x: 0,
			y: 0,
			name: "r3:panel-effect:orbs"
		});
		e.hosts.front.add(a);
		let o = L(r), s = r.positions.map((t, s) => {
			let c = new n({
				x: 0,
				y: 0,
				width: o,
				height: o,
				originX: 0,
				originY: 0,
				textureManager: e.textureManager
			});
			R(c, r), a.add(c);
			let l = {
				node: c,
				phaseOffsetMs: r.periodMs * r.phaseStagger * s,
				normalised: t
			};
			return B(l, r, i), c.setAlpha(z(r, 0, l.phaseOffsetMs)), l;
		}), c = { elapsedMs: 0 };
		return {
			setRect(e) {
				for (let t of s) B(t, r, e);
			},
			tick(e) {
				c.elapsedMs += e * 1e3;
				for (let e of s) e.node.setAlpha(z(r, c.elapsedMs, e.phaseOffsetMs));
				return !1;
			},
			destroy() {
				a.destroy();
			}
		};
	};
}
//#endregion
//#region src/widgets/panel-effects/_shader-surface.ts
var H = "\n  varying vec2 vUv;\n  void main() {\n    vUv = uv;\n    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n  }\n", U = class extends e {
	_width;
	_height;
	geometry;
	material;
	mesh;
	_elapsed;
	constructor(e) {
		super(e), this._width = e.width, this._height = e.height, this._elapsed = 0;
		let t = { ...e.uniforms ?? {} };
		t.uTime = { value: 0 }, t.uSize = { value: new c(e.width, e.height) }, t.uAlpha = { value: this.alpha }, this.material = new s({
			vertexShader: e.vertexShader ?? H,
			fragmentShader: e.fragmentShader,
			uniforms: t,
			transparent: e.transparent ?? !0,
			depthTest: e.depthTest ?? !1,
			depthWrite: e.depthWrite ?? !1,
			blending: e.blending ?? r
		}), this.geometry = new o(1, 1), this.mesh = new a(this.geometry, this.material), this.mesh.frustumCulled = !1, this.mesh.scale.set(this._width, this._height, 1), this.obj3d.add(this.mesh), this.applyMeshOffset();
	}
	get width() {
		return this._width;
	}
	get height() {
		return this._height;
	}
	setUniform(e, t) {
		let n = this.material.uniforms[e];
		return n && (n.value = t), this;
	}
	setSize(e, t) {
		let n = Math.max(1, e), r = Math.max(1, t);
		if (n === this._width && r === this._height) return this;
		this._width = n, this._height = r, this.mesh.scale.set(n, r, 1);
		let i = this.material.uniforms.uSize;
		return i && i.value.set(n, r), this.applyMeshOffset(), this;
	}
	tick(e) {
		this._elapsed += e;
		let t = this.material.uniforms.uTime;
		t && (t.value = this._elapsed);
	}
	get elapsed() {
		return this._elapsed;
	}
	applyMaterialAlpha(e) {
		let t = this.material.uniforms.uAlpha;
		t && (t.value = e);
	}
	assignRenderOrderForSelf(e, t) {
		return this.mesh.renderOrder = t + e, e + 1;
	}
	setClippingPlanes(e) {
		super.setClippingPlanes(e), this.material.clippingPlanes = e ? e.slice() : null, this.material.needsUpdate = !0;
	}
	applyMeshOffset() {
		let e = (.5 - this.pivotX) * this._width, t = -((.5 - this.pivotY) * this._height);
		this.mesh.position.set(e, t, 0);
	}
	onPivotChanged() {
		this.applyMeshOffset();
	}
	destroy() {
		this.material.dispose(), this.geometry.dispose(), super.destroy();
	}
}, W = "\n  precision highp float;\n\n  varying vec2 vUv;\n  uniform float uTime;\n  uniform float uAlpha;\n  uniform vec2 uSize;           // plane size (panel + padding)\n  uniform vec2 uPanelHalf;      // half-size of the panel in px\n  uniform float uRadius;        // panel corner radius in px\n  uniform float uSpread;        // glow reach outside the panel, px\n  uniform float uIntensity;     // master multiplier\n  uniform vec3 uColorInner;\n  uniform vec3 uColorOuter;\n  uniform float uFlowSpeed;\n  uniform float uNoiseScale;\n\n  // --- SDF to a rounded rectangle centred at origin ---\n  float sdRoundedRect(vec2 p, vec2 halfSize, float r) {\n    vec2 q = abs(p) - halfSize + vec2(r);\n    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;\n  }\n\n  // --- Hash + value noise + FBM ---\n  float hash(vec2 p) {\n    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);\n  }\n  float noise(vec2 p) {\n    vec2 i = floor(p);\n    vec2 f = fract(p);\n    vec2 u = f * f * (3.0 - 2.0 * f);\n    return mix(\n      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),\n      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),\n      u.y\n    );\n  }\n  float fbm(vec2 p) {\n    float v = 0.0;\n    float a = 0.5;\n    for (int i = 0; i < 4; i++) {\n      v += a * noise(p);\n      p *= 2.02;\n      a *= 0.5;\n    }\n    return v;\n  }\n\n  void main() {\n    // Pixel position relative to the plane centre. The panel is\n    // co-centred, so this is also the offset from the panel centre.\n    vec2 p = (vUv - 0.5) * uSize;\n    float sdf = sdRoundedRect(p, uPanelHalf, uRadius);\n\n    // Inside the panel or right on its outline we draw nothing — the\n    // chrome will cover us, and leaking alpha there would dim the\n    // frame.\n    if (sdf <= 0.0) {\n      discard;\n    }\n\n    // Primary falloff: exponential drop-off over the spread distance.\n    float falloff = exp(-sdf / max(uSpread * 0.4, 1.0));\n\n    // Secondary rim-light: a sharper, brighter contribution within\n    // ~8% of spread from the edge. Gives the silhouette a crisp\n    // \"lit outline\" read on top of the soft bloom.\n    float rim = smoothstep(uSpread * 0.08, 0.0, sdf) * 0.6;\n\n    // Ribbon hue mix — sweeps with time.\n    float sweep = sin(uTime * uFlowSpeed + sdf * 0.015 + vUv.x * 4.0 - vUv.y * 2.5);\n    float mixT = 0.5 + 0.5 * sweep;\n    vec3 color = mix(uColorInner, uColorOuter, mixT);\n\n    // Aurora-flow texture: FBM scrolling along the panel's long axis.\n    // Subtle multiplier so the glow retains overall coherence without\n    // turning into a noise field.\n    float flow = fbm(vUv * uNoiseScale + vec2(uTime * uFlowSpeed * 0.3, uTime * uFlowSpeed * -0.2));\n    float modulated = 0.78 + 0.22 * flow;\n\n    float intensity = (falloff + rim) * modulated * uIntensity;\n    gl_FragColor = vec4(color * intensity, intensity * uAlpha);\n  }\n", G = {
	colorInner: 16765562,
	colorOuter: 16739292,
	intensity: 1,
	spread: 42,
	flowSpeed: .9,
	noiseScale: 2.6
};
function K(e) {
	return {
		colorInner: e.colorInner ?? G.colorInner,
		colorOuter: e.colorOuter ?? G.colorOuter,
		intensity: e.intensity ?? G.intensity,
		spread: e.spread ?? G.spread,
		flowSpeed: e.flowSpeed ?? G.flowSpeed,
		noiseScale: e.noiseScale ?? G.noiseScale
	};
}
function q(e) {
	let t = new i(e);
	return [
		t.r,
		t.g,
		t.b
	];
}
function J(e = {}) {
	let t = K(e);
	return function(e, n) {
		let { spread: r } = t, i = new U({
			name: "r3:panel-effect:aurora-glow",
			width: n.width + r * 2,
			height: n.height + r * 2,
			fragmentShader: W,
			uniforms: {
				uPanelHalf: { value: [n.width * .5, n.height * .5] },
				uRadius: { value: e.radius },
				uSpread: { value: r },
				uIntensity: { value: t.intensity },
				uColorInner: { value: q(t.colorInner) },
				uColorOuter: { value: q(t.colorOuter) },
				uFlowSpeed: { value: t.flowSpeed },
				uNoiseScale: { value: t.noiseScale }
			}
		});
		return i.setPosition(n.x - r, n.y - r), e.hosts.back.add(i), {
			setRect(e) {
				i.setSize(e.width + r * 2, e.height + r * 2), i.setPosition(e.x - r, e.y - r);
				let t = i.material.uniforms.uPanelHalf;
				t && (t.value = [e.width * .5, e.height * .5]);
			},
			tick(e) {
				return i.tick(e), !1;
			},
			destroy() {
				i.destroy();
			}
		};
	};
}
//#endregion
//#region src/widgets/panel-effects/lightning.ts
var ae = "\n  precision highp float;\n\n  varying vec2 vUv;\n  uniform float uTime;\n  uniform float uAlpha;\n  uniform vec2 uSize;\n  uniform vec3 uCoreColor;\n  uniform vec3 uGlowColor;\n  uniform float uIntensity;\n  uniform float uSpeed;\n  uniform float uWarp;         // warp amplitude in UV units (0..0.5)\n  uniform float uCoreWidthPx;  // core half-width in pixels\n  uniform float uHaloWidthPx;  // halo half-width in pixels\n\n  float hash(vec2 p) {\n    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);\n  }\n  float noise(vec2 p) {\n    vec2 i = floor(p);\n    vec2 f = fract(p);\n    vec2 u = f * f * (3.0 - 2.0 * f);\n    return mix(\n      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),\n      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),\n      u.y\n    );\n  }\n  float fbm(vec2 p) {\n    float v = 0.0;\n    float a = 0.5;\n    for (int i = 0; i < 4; i++) {\n      v += a * noise(p);\n      p *= 2.03;\n      a *= 0.5;\n    }\n    return v;\n  }\n\n  /**\n   * Contribution of one bolt centred at (xCenter, y-axis) with a\n   * per-bolt noise seed. Returns intensity in [0, ~1]; caller sums\n   * multiple bolts.\n   */\n  float boltContribution(vec2 uv, float xCenter, float seed) {\n    // Warp the bolt's X coordinate along its length. Two octaves so\n    // there are both broad sweeps and fine jitter — a single octave\n    // looks like a waveform; two reads as a lightning path.\n    float warp =\n      (fbm(vec2(uv.y * 3.5 + uTime * uSpeed, seed)) - 0.5) * uWarp * 1.2 +\n      (fbm(vec2(uv.y * 9.0 - uTime * uSpeed * 1.6, seed + 4.2)) - 0.5) * uWarp * 0.45;\n    float warpedX = xCenter + warp;\n\n    // Pixel-space distance from this fragment to the warped channel.\n    float pxDist = abs(uv.x - warpedX) * uSize.x;\n\n    // Core: hard line of ~uCoreWidthPx pixels; smoothstep avoids a\n    // shimmery aliased edge on sub-pixel movement.\n    float core = 1.0 - smoothstep(0.0, uCoreWidthPx, pxDist);\n    // Halo: much wider, much softer; sums with the core.\n    float halo = 1.0 - smoothstep(0.0, uHaloWidthPx, pxDist);\n\n    // Per-bolt vertical flicker: noise along the bolt's length,\n    // thresholded so the bolt is visible only where flicker > 0.45.\n    // Multiplied with the time-sweep so the \"on\" segments travel.\n    float flicker =\n      fbm(vec2(uv.y * 7.0 + uTime * uSpeed * 2.0, seed * 3.1 + uTime * 0.6));\n    float gate = smoothstep(0.45, 0.75, flicker);\n\n    // Rare whole-bolt blackout — when a slow noise crosses below a\n    // threshold the bolt goes dark for a moment, giving the pool of\n    // bolts a natural \"gap\" rhythm without looking identical.\n    float pulse = fbm(vec2(uTime * uSpeed * 0.9, seed * 17.0));\n    float alive = smoothstep(0.35, 0.55, pulse);\n\n    return (core + halo * 0.55) * gate * alive;\n  }\n\n  void main() {\n    // Three bolts distributed across the panel.\n    float total = 0.0;\n    total += boltContribution(vUv, 0.2, 0.11);\n    total += boltContribution(vUv, 0.5, 0.43);\n    total += boltContribution(vUv, 0.8, 0.77);\n\n    // Scale by master intensity.\n    total *= uIntensity;\n\n    // Colour: white-hot core transitioning into the glow tint at\n    // lower intensity. smoothstep so the transition is an obvious\n    // hot centre rather than a linear ramp.\n    vec3 col = mix(uGlowColor, uCoreColor, smoothstep(0.6, 1.2, total));\n    float alpha = clamp(total, 0.0, 1.0);\n    gl_FragColor = vec4(col * alpha, alpha * uAlpha);\n  }\n", Y = {
	color: 15922943,
	glowColor: 5930495,
	intensity: 1,
	speed: 1.8,
	warp: .12,
	coreWidthPx: 1.2,
	haloWidthPx: 14
};
function oe(e) {
	return {
		color: e.color ?? Y.color,
		glowColor: e.glowColor ?? Y.glowColor,
		intensity: e.intensity ?? Y.intensity,
		speed: e.speed ?? Y.speed,
		warp: e.warp ?? Y.warp,
		coreWidthPx: e.coreWidthPx ?? Y.coreWidthPx,
		haloWidthPx: e.haloWidthPx ?? Y.haloWidthPx
	};
}
function X(e) {
	let t = new i(e);
	return [
		t.r,
		t.g,
		t.b
	];
}
function se(e = {}) {
	let t = oe(e);
	return function(e, n) {
		let r = new U({
			name: "r3:panel-effect:lightning",
			width: n.width,
			height: n.height,
			fragmentShader: ae,
			uniforms: {
				uCoreColor: { value: X(t.color) },
				uGlowColor: { value: X(t.glowColor) },
				uIntensity: { value: t.intensity },
				uSpeed: { value: t.speed },
				uWarp: { value: t.warp },
				uCoreWidthPx: { value: t.coreWidthPx },
				uHaloWidthPx: { value: t.haloWidthPx }
			}
		});
		return r.setPosition(n.x, n.y), e.hosts.front.add(r), {
			setRect(e) {
				r.setSize(e.width, e.height), r.setPosition(e.x, e.y);
			},
			tick(e) {
				return r.tick(e), !1;
			},
			destroy() {
				r.destroy();
			}
		};
	};
}
//#endregion
//#region src/widgets/panel-effects/plasmaOrbs.ts
var ce = "\n  precision highp float;\n\n  varying vec2 vUv;\n  uniform float uTime;\n  uniform float uAlpha;\n  uniform vec3 uColor;\n  uniform vec3 uCoreColor;\n  uniform float uSpeed;\n  uniform float uSeed;\n  uniform float uIntensity;\n\n  float hash(vec2 p) {\n    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);\n  }\n  float noise(vec2 p) {\n    vec2 i = floor(p);\n    vec2 f = fract(p);\n    vec2 u = f * f * (3.0 - 2.0 * f);\n    return mix(\n      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),\n      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),\n      u.y\n    );\n  }\n  float fbm(vec2 p) {\n    float v = 0.0;\n    float a = 0.5;\n    for (int i = 0; i < 4; i++) {\n      v += a * noise(p);\n      p *= 2.03;\n      a *= 0.5;\n    }\n    return v;\n  }\n\n  void main() {\n    // Shift UV origin to the disc centre and scale to [-1, 1] so r\n    // directly measures \"how far out we are\" — 0 at centre, 1 at\n    // rim, >1 outside.\n    vec2 p = (vUv - 0.5) * 2.0;\n    float r = length(p);\n    if (r > 1.0) {\n      discard;\n    }\n\n    // Radial body: generous core, soft falloff to rim.\n    float body = exp(-r * 2.4);\n\n    // Rotate the plasma sample coordinate over time so the swirls\n    // orbit the orb centre rather than just translating.\n    float rot = uTime * uSpeed * 0.45 + uSeed * 6.2831;\n    float c = cos(rot);\n    float s = sin(rot);\n    vec2 swirled = vec2(p.x * c - p.y * s, p.x * s + p.y * c);\n\n    // Two FBM layers at different frequencies/directions: the\n    // mixture reads as a liquid plasma rather than a single-wave\n    // pattern.\n    float n1 = fbm(swirled * 2.2 + vec2(uTime * uSpeed * 0.6, uSeed * 11.0));\n    float n2 = fbm(p * 4.0 - vec2(0.0, uTime * uSpeed * 0.8) + uSeed * 3.17);\n    float plasma = pow(mix(n1, n2, 0.5), 1.8);\n\n    // Sharp bright centre so the orb always has a clear \"hot spot\".\n    float coreBoost = exp(-r * 9.0) * 1.8;\n\n    // Rim highlight: a thin bright ring just inside the edge gives\n    // the orb a crystal-ball quality.\n    float rim = smoothstep(0.82, 0.96, r) * smoothstep(1.0, 0.95, r) * 0.9;\n\n    float intensity = body + plasma * 0.55 * body + coreBoost + rim;\n    intensity *= uIntensity;\n\n    // Colour mixing: cool base tint modulated toward the hot core\n    // where the core boost is strong; plasma adds variegated base\n    // tint.\n    vec3 col = mix(uColor, uCoreColor, clamp(coreBoost, 0.0, 1.0));\n    col += uColor * plasma * 0.35;\n    col += uCoreColor * rim;\n\n    // Soft edge fade so the circular silhouette never shows a\n    // rasterised stair-step.\n    float edge = 1.0 - smoothstep(0.94, 1.0, r);\n    float alpha = clamp(intensity, 0.0, 1.0) * edge;\n\n    gl_FragColor = vec4(col * clamp(intensity, 0.0, 1.4), alpha * uAlpha);\n  }\n", Z = {
	color: 10053375,
	coreColor: 15919871,
	size: 38,
	intensity: 1,
	speed: 1,
	positions: [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1]
	]
};
function le(e) {
	return {
		color: e.color ?? Z.color,
		coreColor: e.coreColor ?? Z.coreColor,
		size: e.size ?? Z.size,
		intensity: e.intensity ?? Z.intensity,
		speed: e.speed ?? Z.speed,
		positions: e.positions ?? Z.positions
	};
}
function Q(e) {
	let t = new i(e);
	return [
		t.r,
		t.g,
		t.b
	];
}
function $(e, t, n) {
	let r = n.x + e.normalised[0] * n.width, i = n.y + e.normalised[1] * n.height;
	e.node.setPosition(r - t * .5, i - t * .5);
}
function ue(e = {}) {
	let t = le(e);
	return function(e, n) {
		let r = Q(t.color), i = Q(t.coreColor), a = t.positions.map((a, o) => {
			let s = new U({
				name: "r3:panel-effect:plasma-orb",
				width: t.size,
				height: t.size,
				fragmentShader: ce,
				uniforms: {
					uColor: { value: r },
					uCoreColor: { value: i },
					uSpeed: { value: t.speed },
					uIntensity: { value: t.intensity },
					uSeed: { value: o / 7.3 }
				}
			});
			e.hosts.front.add(s);
			let c = {
				node: s,
				normalised: a
			};
			return $(c, t.size, n), c;
		});
		return {
			setRect(e) {
				for (let n of a) $(n, t.size, e);
			},
			tick(e) {
				for (let t of a) t.node.tick(e);
				return !1;
			},
			destroy() {
				for (let e of a) e.node.destroy();
			}
		};
	};
}
//#endregion
export { g as _, G as a, h as b, V as c, w as d, D as f, x as g, y as h, se as i, O as l, ne as m, ue as n, J as o, S as p, Y as r, P as s, Z as t, N as u, ee as v, p as y };
