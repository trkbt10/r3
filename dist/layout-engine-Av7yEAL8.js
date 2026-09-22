import { c as e } from "./Graphics-DukR35Yh.js";
import { Matrix4 as t, Vector3 as n } from "three";
//#region src/Easing.ts
var r = (e) => e, i = (e) => e * e, a = (e) => 1 - (1 - e) * (1 - e), o = (e) => {
	if (e < .5) return 2 * e * e;
	let t = 1 - e;
	return 1 - 2 * t * t;
}, s = (e) => e * e * e, c = (e) => {
	let t = 1 - e;
	return 1 - t * t * t;
}, l = (e) => {
	if (e < .5) return 4 * e * e * e;
	let t = 1 - e;
	return 1 - 4 * t * t * t;
}, u = Math.PI / 2, d = (e) => 1 - Math.cos(e * u), f = (e) => Math.sin(e * u), p = (e) => .5 * (1 - Math.cos(e * Math.PI)), m = (e) => e * e * e * e * e, h = (e) => {
	let t = 1 - e;
	return 1 - t * t * t * t * t;
}, g = (e) => {
	if (e < .5) return 16 * e * e * e * e * e;
	let t = 1 - e;
	return 1 - 16 * t * t * t * t * t;
}, _ = 1.70158, v = (e) => (_ + 1) * e * e * e - _ * e * e, y = (e) => {
	let t = e - 1;
	return 1 + (_ + 1) * t * t * t + _ * t * t;
}, b = (e) => {
	let t = _ * 1.525;
	if (e < .5) {
		let n = 2 * e;
		return ((t + 1) * n * n * n - t * n * n) / 2;
	}
	let n = 2 * e - 2;
	return ((t + 1) * n * n * n + t * n * n + 2) / 2;
}, x = {
	Linear: r,
	"Linear.None": r,
	"Quad.easeIn": i,
	"Quad.easeOut": a,
	"Quad.easeInOut": o,
	"Cubic.easeIn": s,
	"Cubic.easeOut": c,
	"Cubic.easeInOut": l,
	"Sine.easeIn": d,
	"Sine.easeOut": f,
	"Sine.easeInOut": p,
	"Quint.easeIn": m,
	"Quint.easeOut": h,
	"Quint.easeInOut": g,
	"Back.easeIn": v,
	"Back.easeOut": y,
	"Back.easeInOut": b
};
function ee(e) {
	if (typeof e == "function") return e;
	let t = x[e];
	if (!t) throw Error(`r3/Easing: unknown easing "${String(e)}"`);
	return t;
}
//#endregion
//#region src/Tween.ts
var te = new Set([
	"targets",
	"duration",
	"delay",
	"ease",
	"yoyo",
	"repeat",
	"onUpdate",
	"onComplete"
]), ne = class {
	active;
	nextId;
	constructor() {
		this.active = [], this.nextId = 1;
	}
	add(e) {
		let t = re(e.targets), n = ee(e.ease ?? "Linear"), r = ie(e), i = {
			id: this.nextId,
			targets: t,
			duration: Math.max(0, e.duration),
			easing: n,
			yoyo: e.yoyo === !0,
			repeat: e.repeat ?? 0,
			props: r,
			states: [],
			started: !1,
			elapsed: 0,
			delay: e.delay ?? 0,
			playsCompleted: 0,
			reversing: !1,
			killed: !1,
			onUpdate: e.onUpdate,
			onComplete: e.onComplete
		};
		return this.nextId += 1, this.active.push(i), {
			id: i.id,
			kill: () => {
				i.killed = !0;
			},
			get completed() {
				return i.killed || i.playsCompleted > i.repeat;
			}
		};
	}
	killTweensOf(e) {
		for (let t of this.active) t.targets.includes(e) && (t.killed = !0);
	}
	killAll() {
		for (let e of this.active) e.killed = !0;
	}
	get activeCount() {
		return this.active.filter((e) => !e.killed).length;
	}
	advance(e) {
		if (this.active.length === 0) return;
		let t = Math.max(0, e);
		for (let e = 0; e < this.active.length; e++) {
			let n = this.active[e];
			!n || n.killed || this.advanceOne(n, t);
		}
		for (let e = this.active.length - 1; e >= 0; e--) {
			let t = this.active[e];
			if (t) {
				if (t.killed) {
					this.active.splice(e, 1);
					continue;
				}
				t.repeat !== -1 && t.playsCompleted > t.repeat && this.active.splice(e, 1);
			}
		}
	}
	advanceOne(e, t) {
		if (e.delay > 0) {
			if (e.delay -= t, e.delay > 0) return;
			let n = -e.delay;
			e.delay = 0, this.startTween(e), this.applyTime(e, n);
			return;
		}
		e.started || this.startTween(e), this.applyTime(e, t);
	}
	startTween(e) {
		if (!e.started) {
			e.started = !0, e.states = e.targets.map((t) => oe(t, e.props));
			for (let t = 0; t < e.targets.length; t++) {
				let n = e.targets[t], r = e.states[t];
				if (!(!n || !r)) for (let e of r) S(n, e.key, e.start);
			}
		}
	}
	applyTime(e, t) {
		e.elapsed += t;
		let n = e.duration === 0 ? 1 : Math.min(1, e.elapsed / e.duration), r = e.easing(n), i = e.reversing ? 1 - r : r;
		for (let t = 0; t < e.targets.length; t++) {
			let n = e.targets[t], r = e.states[t];
			if (!(!n || !r)) for (let e of r) S(n, e.key, le(e.start, e.end, i));
		}
		if (e.onUpdate?.(), !(n < 1)) {
			if (e.yoyo && !e.reversing) {
				e.reversing = !0, e.elapsed = 0;
				return;
			}
			if (e.playsCompleted += 1, e.repeat === -1 || e.playsCompleted <= e.repeat) {
				e.reversing = !1, e.elapsed = 0;
				for (let t = 0; t < e.targets.length; t++) {
					let n = e.targets[t], r = e.states[t];
					if (!(!n || !r)) for (let e of r) S(n, e.key, e.start);
				}
				return;
			}
			e.killed || e.onComplete?.();
		}
	}
};
function re(e) {
	return Array.isArray(e) ? e.slice() : [e];
}
function ie(e) {
	let t = {};
	for (let n of Object.keys(e)) {
		if (te.has(n)) continue;
		let r = e[n];
		if (typeof r == "number") {
			t[n] = r;
			continue;
		}
		ae(r) && (t[n] = r);
	}
	return t;
}
function ae(e) {
	if (typeof e != "object" || !e) return !1;
	let t = e;
	return !(typeof t.to != "number" || t.from !== void 0 && typeof t.from != "number");
}
function oe(e, t) {
	let n = [];
	for (let r of Object.keys(t)) {
		let i = t[r];
		if (i === void 0) continue;
		let a = se(e, r);
		n.push({
			key: r,
			start: ce(i, a),
			end: typeof i == "number" ? i : i.to
		});
	}
	return n;
}
function se(e, t) {
	let n = e[t];
	return typeof n == "number" ? n : 0;
}
function S(e, t, n) {
	let r = e;
	r[t] = n;
}
function ce(e, t) {
	return typeof e == "number" || e.from === void 0 ? t : e.from;
}
function le(e, t, n) {
	return e + (t - e) * n;
}
//#endregion
//#region src/layout-engine/types.ts
var C = {
	durationMs: 0,
	easing: "Linear"
};
function w(e) {
	return e === void 0 ? {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0
	} : typeof e == "number" ? {
		top: e,
		right: e,
		bottom: e,
		left: e
	} : {
		top: e.top ?? 0,
		right: e.right ?? 0,
		bottom: e.bottom ?? 0,
		left: e.left ?? 0
	};
}
function T(e) {
	return e.left + e.right;
}
function E(e) {
	return e.top + e.bottom;
}
//#endregion
//#region src/layout-engine/nodes.ts
var D = { kind: "flow" };
function O(e = {}) {
	return {
		kind: "flex",
		key: e.key ?? null,
		direction: e.direction ?? "row",
		justify: e.justify ?? "start",
		align: e.align ?? "start",
		padding: w(e.padding),
		gap: e.gap ?? 0,
		width: e.width ?? "auto",
		height: e.height ?? "auto",
		flex: e.flex ?? 0,
		alignSelf: e.alignSelf ?? null,
		transition: e.transition ?? null,
		transform: e.transform ?? null,
		onRect: e.onRect ?? null,
		mode: e.mode ?? D,
		children: e.children ? e.children.slice() : [],
		absolute: e.absolute ? e.absolute.slice() : []
	};
}
function k(e) {
	return {
		kind: "leaf",
		key: e.key ?? null,
		width: e.width ?? "auto",
		height: e.height ?? "auto",
		flex: e.flex ?? 0,
		alignSelf: e.alignSelf ?? null,
		transition: e.transition ?? null,
		transform: e.transform ?? null,
		onRect: e.onRect
	};
}
function ue(e = {}) {
	return {
		kind: "leaf",
		key: e.key ?? null,
		width: e.width ?? "auto",
		height: e.height ?? "auto",
		flex: e.flex ?? 0,
		alignSelf: e.alignSelf ?? null,
		transition: e.transition ?? C,
		transform: e.transform ?? null,
		onRect: null
	};
}
function de(e) {
	return {
		node: e.node,
		place: e.place
	};
}
function A(e, t = {}) {
	let n = t.x ?? 0, r = t.y ?? 0, i = t.outerWidth, a = t.outerHeight, o = ((t, o) => {
		let s = i ?? o.width, c = a ?? o.height;
		return {
			x: fe(e, t, {
				width: s,
				height: c
			}, n),
			y: pe(e, t, {
				width: s,
				height: c
			}, r),
			width: s,
			height: c
		};
	});
	return o.__anchor = {
		anchor: e,
		insetX: n,
		insetY: r,
		outerWidth: i,
		outerHeight: a
	}, o;
}
function j(e) {
	return Object.prototype.hasOwnProperty.call(e, "__anchor");
}
function fe(e, t, n, r) {
	return e.endsWith("-left") ? t.x + r : e.endsWith("-right") ? t.x + t.width - r - n.width : t.x + Math.round((t.width - n.width) / 2) + r;
}
function pe(e, t, n, r) {
	return e.startsWith("top-") ? t.y + r : e.startsWith("bottom-") ? t.y + t.height - r - n.height : t.y + Math.round((t.height - n.height) / 2) + r;
}
//#endregion
//#region src/layout-engine/serialize.ts
function M(e) {
	return e.kind === "leaf" ? me(e) : he(e);
}
function me(e) {
	return F({
		kind: "leaf",
		key: e.key ?? void 0,
		width: e.width,
		height: e.height,
		flex: e.flex,
		alignSelf: e.alignSelf ?? void 0,
		transition: e.transition ?? void 0,
		transform: e.transform ?? void 0
	});
}
function he(e) {
	return F({
		kind: "flex",
		key: e.key ?? void 0,
		direction: e.direction,
		justify: e.justify,
		align: e.align,
		padding: e.padding,
		gap: e.gap,
		width: e.width,
		height: e.height,
		flex: e.flex,
		alignSelf: e.alignSelf ?? void 0,
		transition: e.transition ?? void 0,
		transform: e.transform ?? void 0,
		mode: e.mode.kind === "flow" ? void 0 : e.mode,
		children: e.children.map(M),
		absolute: e.absolute.map(ge)
	});
}
function ge(e) {
	if (!j(e.place)) throw Error("serializeTree: absolute child has a non-anchor place(). Use placeAnchor() so the placement can round-trip through JSON.");
	let t = e.place.__anchor, n = {
		kind: "anchor",
		anchor: t.anchor,
		insetX: t.insetX,
		insetY: t.insetY,
		...t.outerWidth === void 0 ? {} : { outerWidth: t.outerWidth },
		...t.outerHeight === void 0 ? {} : { outerHeight: t.outerHeight }
	};
	return {
		node: M(e.node),
		placement: n
	};
}
function _e(e, t = {}, n = null) {
	return N(e, t, n ? Se(n) : /* @__PURE__ */ new Map());
}
function N(e, t, n) {
	return e.kind === "leaf" ? ve(e, t, n) : ye(e, t, n);
}
function ve(e, t, n) {
	let r = e.key === void 0 ? null : t[e.key] ?? null, i = be(e.key, n);
	return i ? (i.width = e.width, i.height = e.height, i.flex = e.flex, i.alignSelf = e.alignSelf ?? null, i.transition = e.transition ?? null, i.transform = e.transform ?? null, i.onRect = r, i) : k({
		key: e.key,
		width: e.width,
		height: e.height,
		flex: e.flex,
		alignSelf: e.alignSelf,
		transition: e.transition,
		transform: e.transform,
		onRect: r ?? (() => void 0)
	});
}
function ye(e, t, n) {
	let r = e.key === void 0 ? null : t[e.key] ?? null, i = xe(e.key, n), a = e.children.map((e) => N(e, t, n)), o = e.absolute.map((e) => ({
		node: N(e.node, t, n),
		place: A(e.placement.anchor, {
			x: e.placement.insetX,
			y: e.placement.insetY,
			outerWidth: e.placement.outerWidth,
			outerHeight: e.placement.outerHeight
		})
	})), s = e.mode ?? { kind: "flow" };
	return i ? (i.direction = e.direction, i.justify = e.justify, i.align = e.align, i.padding = w(e.padding), i.gap = e.gap, i.width = e.width, i.height = e.height, i.flex = e.flex, i.alignSelf = e.alignSelf ?? null, i.transition = e.transition ?? null, i.transform = e.transform ?? null, i.onRect = r, i.mode = s, i.children = a, i.absolute = o, i) : O({
		key: e.key,
		direction: e.direction,
		justify: e.justify,
		align: e.align,
		padding: e.padding,
		gap: e.gap,
		width: e.width,
		height: e.height,
		flex: e.flex,
		alignSelf: e.alignSelf,
		transition: e.transition,
		transform: e.transform,
		onRect: r ?? void 0,
		mode: s,
		children: a,
		absolute: o
	});
}
function be(e, t) {
	if (e === void 0) return null;
	let n = t.get(e);
	return !n || n.kind !== "leaf" ? null : n;
}
function xe(e, t) {
	if (e === void 0) return null;
	let n = t.get(e);
	return !n || n.kind !== "flex" ? null : n;
}
function Se(e) {
	let t = /* @__PURE__ */ new Map();
	return P(e, t), t;
}
function P(e, t) {
	if (e.key !== null && t.set(e.key, e), e.kind === "flex") {
		for (let n of e.children) P(n, t);
		for (let n of e.absolute) P(n.node, t);
	}
}
function F(e) {
	let t = {};
	for (let [n, r] of Object.entries(e)) r !== void 0 && (t[n] = r);
	return t;
}
//#endregion
//#region src/layout-engine/measure.ts
function I(e) {
	return e.kind === "leaf" ? Ce(e) : we(e);
}
function Ce(e) {
	return {
		width: typeof e.width == "number" ? e.width : 0,
		height: typeof e.height == "number" ? e.height : 0
	};
}
function we(e) {
	let t = e.children.map((e) => I(e)), n = e.gap * Math.max(0, e.children.length - 1), r = t.reduce((t, n) => t + (e.direction === "row" ? n.width : n.height), 0), i = t.reduce((t, n) => Math.max(t, e.direction === "row" ? n.height : n.width), 0), a = r + n, o = i, s = e.width === "auto", c = e.height === "auto";
	return {
		width: s ? e.direction === "row" ? a + T(e.padding) : o + T(e.padding) : e.width,
		height: c ? e.direction === "row" ? o + E(e.padding) : a + E(e.padding) : e.height
	};
}
//#endregion
//#region src/layout-engine/arrange.ts
function L(e, t, n) {
	n(e, t), e.kind !== "leaf" && Te(e, t, n);
}
function Te(e, t, n) {
	if (e.mode.kind === "flow") {
		R(e, t, n);
		return;
	}
	let r = typeof e.width == "number" ? e.width : t.width, i = typeof e.height == "number" ? e.height : t.height, a = Ee(t, r, i, e.mode);
	R(e, {
		x: 0,
		y: 0,
		width: r,
		height: i
	}, (e, t) => {
		n(e, {
			x: a.offsetX + t.x * a.scaleX,
			y: a.offsetY + t.y * a.scaleY,
			width: t.width * a.scaleX,
			height: t.height * a.scaleY
		});
	});
}
function Ee(e, t, n, r) {
	if (t <= 0 || n <= 0) return {
		scaleX: 1,
		scaleY: 1,
		offsetX: e.x,
		offsetY: e.y
	};
	let i = e.width / t, a = e.height / n;
	if (r.fit === "fill") return {
		scaleX: i,
		scaleY: a,
		offsetX: e.x,
		offsetY: e.y
	};
	let o = r.fit === "contain" ? Math.min(i, a) : Math.max(i, a), s = t * o, c = n * o;
	return {
		scaleX: o,
		scaleY: o,
		offsetX: e.x + (e.width - s) / 2,
		offsetY: e.y + (e.height - c) / 2
	};
}
function R(e, t, n) {
	let r = ke(e, t), i = e.direction === "row", a = e.children.map((e) => I(e)), o = a.map((e) => i ? e.width : e.height), s = a.map((e) => i ? e.height : e.width), c = i ? r.width : r.height, l = i ? r.height : r.width, u = e.children.length, d = e.gap * Math.max(0, u - 1), f = c - o.reduce((e, t) => e + t, 0) - d, p = e.children.reduce((e, t) => e + t.flex, 0), m = Ae(e, o, f, p), h = je(e.justify, f, u, p), g = Me(e.justify, e.gap, f, u, p), _ = i ? r.x : r.y, v = i ? r.y : r.x, y = De(m, g, _ + h);
	for (let t = 0; t < u; t++) {
		let r = e.children[t], a = m[t], o = y[t];
		if (!r || a === void 0 || o === void 0) continue;
		let c = Ne(e, r, s[t] ?? 0, l);
		L(r, Oe(i, o, v + Pe(e, r, l, c), a, c), n);
	}
	for (let r of e.absolute) {
		let e = I(r.node), i = r.place(t, e);
		L(r.node, i, n);
	}
}
function De(e, t, n) {
	let r = [];
	return e.reduce((n, i, a) => {
		r.push(n);
		let o = a < e.length - 1 ? t : 0;
		return n + i + o;
	}, n), r;
}
function Oe(e, t, n, r, i) {
	let a = Math.round(t), o = Math.round(n), s = Math.round(r), c = Math.round(i);
	return e ? {
		x: a,
		y: o,
		width: s,
		height: c
	} : {
		x: o,
		y: a,
		width: c,
		height: s
	};
}
function ke(e, t) {
	let { padding: n } = e;
	return {
		x: t.x + n.left,
		y: t.y + n.top,
		width: Math.max(0, t.width - n.left - n.right),
		height: Math.max(0, t.height - n.top - n.bottom)
	};
}
function Ae(e, t, n, r) {
	return r <= 0 || n <= 0 ? t.slice() : e.children.map((e, i) => {
		let a = t[i] ?? 0;
		return e.flex <= 0 ? a : a + e.flex / r * n;
	});
}
function je(e, t, n, r) {
	return r > 0 || t <= 0 || e === "start" || e === "space-between" ? 0 : e === "center" ? t / 2 : e === "end" ? t : e === "space-around" ? n === 0 ? 0 : t / n / 2 : n === 0 ? 0 : t / (n + 1);
}
function Me(e, t, n, r, i) {
	return i > 0 || n <= 0 || r < 2 ? t : e === "space-between" ? t + n / (r - 1) : e === "space-around" ? t + n / r : e === "space-evenly" ? t + n / (r + 1) : t;
}
function Ne(e, t, n, r) {
	return z(e, t) === "stretch" ? r : n;
}
function Pe(e, t, n, r) {
	let i = z(e, t);
	return i === "center" ? (n - r) / 2 : i === "end" ? n - r : 0;
}
function z(e, t) {
	return t.alignSelf ?? e.align;
}
//#endregion
//#region src/layout-engine/runtime.ts
function B(e, t, n) {
	if (t.transform) {
		e.transform = V(t.transform, n);
		return;
	}
	delete e.transform;
}
function V(e, t) {
	if (!e.vanishingPoint || !("ref" in e.vanishingPoint)) return e;
	let n = Fe(e.vanishingPoint, t);
	return {
		...e,
		vanishingPoint: n
	};
}
function Fe(e, t) {
	let n = t[e.ref];
	if (!n) throw Error(`LayoutRuntime: unknown vanishing point ref "${e.ref}"`);
	let { ref: r, ...i } = e;
	return {
		...n,
		...i,
		x: n.x,
		y: n.y
	};
}
function H(e, t) {
	if (e) return V(e, t);
}
var U = class {
	root;
	viewport;
	defaultTransition;
	tweens;
	vanishingPoints;
	state;
	registry;
	mounted;
	forceInstant = !1;
	constructor(e) {
		this.root = e.root, this.viewport = e.viewport, this.defaultTransition = e.defaultTransition ?? {
			durationMs: 0,
			easing: "Linear"
		}, this.tweens = new ne(), this.vanishingPoints = e.vanishingPoints ?? {}, this.state = /* @__PURE__ */ new Map(), this.registry = e.registry ?? null, this.mounted = e.animateOnMount === !0, this.relayout();
	}
	tick(e) {
		this.tweens.advance(e);
	}
	get activeTweenCount() {
		return this.tweens.activeCount;
	}
	setRoot(e) {
		this.root = e, this.relayout();
	}
	setViewport(e) {
		this.viewport = e, this.relayout();
	}
	setVanishingPoints(e) {
		this.vanishingPoints = e, this.relayout();
	}
	relayout() {
		let e = /* @__PURE__ */ new Set();
		this.registry?.beginRelayout();
		let t = (t, n) => {
			let r = H(t.transform, this.vanishingPoints);
			this.registry?.record(t, r ? {
				...n,
				transform: r
			} : n), t.onRect && (e.add(t), this.applyRect(t, n));
		};
		try {
			L(this.root, this.viewport, t), this.dropOrphans(e), this.mounted = !0;
		} finally {
			this.registry?.endRelayout();
		}
	}
	relayoutInstant() {
		this.forceInstant = !0;
		try {
			this.relayout();
		} finally {
			this.forceInstant = !1;
		}
	}
	dispose() {
		this.tweens.killAll(), this.state.clear();
	}
	applyRect(e, t) {
		let n = e.onRect;
		if (!n) return;
		let r = this.state.get(e);
		if (!r) {
			let r = H(e.transform, this.vanishingPoints), i = {
				x: t.x,
				y: t.y,
				width: t.width,
				height: t.height,
				...r ? { transform: r } : {}
			};
			this.state.set(e, { liveRect: i }), n(i);
			return;
		}
		let i = e.transition ?? this.defaultTransition;
		if (this.tweens.killTweensOf(r.liveRect), !this.mounted || i.durationMs <= 0 || this.forceInstant) {
			r.liveRect.x = t.x, r.liveRect.y = t.y, r.liveRect.width = t.width, r.liveRect.height = t.height, B(r.liveRect, e, this.vanishingPoints), n(r.liveRect);
			return;
		}
		B(r.liveRect, e, this.vanishingPoints), this.tweens.add({
			targets: r.liveRect,
			duration: i.durationMs,
			delay: i.delayMs,
			ease: i.easing,
			x: t.x,
			y: t.y,
			width: t.width,
			height: t.height,
			onUpdate: () => {
				n(r.liveRect);
			},
			onComplete: () => {
				n(r.liveRect);
			}
		});
	}
	dropOrphans(e) {
		for (let [t, n] of this.state) e.has(t) || (this.tweens.killTweensOf(n.liveRect), this.state.delete(t));
	}
};
//#endregion
//#region src/layout-engine/r3-binding.ts
function Ie(e) {
	return (t) => {
		e.setPosition(t.x, t.y), W(e, t);
	};
}
function Le(e) {
	return (t) => {
		e.setPosition(t.x, t.y), e.setSize(t.width, t.height), W(e, t);
	};
}
function Re(e) {
	return (t) => {
		e.setPosition(t.x, t.y), e.setSize(t.width, t.height), et(e) && W(e, t);
	};
}
function W(e, t) {
	if (!t.transform) {
		e.setLayoutMatrix(null);
		return;
	}
	e.setLayoutMatrix(G(t, t.transform));
}
function G(e, t) {
	let n = t.originX ?? .5, r = t.originY ?? .5, i = e.width * n, a = -e.height * r, o = t.skewX ?? 0, s = t.skewY ?? 0;
	return Z.identity(), t.vanishingPoint && Z.multiply(Ve(e, t)), Z.multiply(Q.makeTranslation(i, a, 0)), Z.multiply(Q.makeRotationZ(-(t.rotate ?? 0))), Z.multiply(Q.makeRotationX(t.tiltX ?? 0)), Z.multiply(Q.makeRotationY(-(t.tiltY ?? 0))), Z.multiply(Qe(o, s)), Z.multiply(Q.makeScale(t.scaleX ?? 1, t.scaleY ?? 1, 1)), t.perspective !== void 0 && t.perspective !== 0 && Z.multiply($e(t.perspective)), Z.multiply(Q.makeTranslation(-i, -a, 0)), Z.clone();
}
function ze(e) {
	if (!e.transform) return {
		x: e.x,
		y: e.y,
		width: e.width,
		height: e.height
	};
	let t = G(e, e.transform), r = [
		new n(0, 0, 0),
		new n(e.width, 0, 0),
		new n(e.width, -e.height, 0),
		new n(0, -e.height, 0)
	].map((e) => e.applyMatrix4(t)), i = r.map((t) => e.x + t.x), a = r.map((t) => e.y - t.y), o = Math.min(...i), s = Math.max(...i), c = Math.min(...a), l = Math.max(...a);
	return {
		x: o,
		y: c,
		width: Math.max(0, s - o),
		height: Math.max(0, l - c)
	};
}
function Be(e, t) {
	e.obj3d.updateWorldMatrix(!0, !1);
	let n = [
		K(e, t.x, t.y),
		K(e, t.x + t.width, t.y),
		K(e, t.x + t.width, t.y + t.height),
		K(e, t.x, t.y + t.height)
	], r = n.map((e) => e.x), i = n.map((e) => e.y), a = Math.min(...r), o = Math.max(...r), s = Math.min(...i), c = Math.max(...i);
	return {
		x: a,
		y: s,
		width: Math.max(0, o - a),
		height: Math.max(0, c - s)
	};
}
function K(e, t, n) {
	let r = it.set(t, -n, 0).applyMatrix4(e.obj3d.matrixWorld);
	return {
		x: r.x,
		y: -r.y
	};
}
function Ve(e, t) {
	let n = t.vanishingPoint;
	if (!n) return rt.identity();
	if ("ref" in n) throw Error(`layoutTransformMatrix: unresolved vanishing point ref "${n.ref}"`);
	let r = Je(n.depth ?? .16), i = We(e, n, r, Ue(e, n, r));
	return Xe(e.width, e.height, i);
}
function He(e) {
	return [
		{
			x: e.x,
			y: e.y
		},
		{
			x: e.x + e.width,
			y: e.y
		},
		{
			x: e.x + e.width,
			y: e.y + e.height
		},
		{
			x: e.x,
			y: e.y + e.height
		}
	];
}
function Ue(e, t, n) {
	let r = He(e);
	return Ge(e, t) === "x" ? Ke(e, t, n, r) : qe(e, t, n, r);
}
function We(e, t, n, r) {
	if (t.projectionDistance === void 0 || t.referenceDepth === void 0) return r;
	let i = Math.max(.001, t.projectionDistance), a = t.depthScale ?? 1, o = Ye(i / (i + (t.referenceDepth - n) * a));
	return r.map((n) => {
		let r = {
			x: e.x + n.x,
			y: e.y + n.y
		};
		return {
			x: t.x + (r.x - t.x) * o - e.x,
			y: t.y + (r.y - t.y) * o - e.y
		};
	});
}
function Ge(e, t) {
	let n = e.x + e.width / 2, r = e.y + e.height / 2;
	return t.axis === "x" ? "x" : t.axis === "y" ? "y" : Math.abs(n - t.x) >= Math.abs(r - t.y) ? "x" : "y";
}
function Ke(e, t, n, r) {
	let [i, a, o, s] = r;
	if (e.x + e.width / 2 >= t.x) return [
		X(Y(i, q(t, a, e.x), n), e),
		X(a, e),
		X(o, e),
		X(Y(s, q(t, o, e.x), n), e)
	];
	let c = e.x + e.width;
	return [
		X(i, e),
		X(Y(a, q(t, i, c), n), e),
		X(Y(o, q(t, s, c), n), e),
		X(s, e)
	];
}
function qe(e, t, n, r) {
	let [i, a, o, s] = r;
	if (e.y + e.height / 2 <= t.y) {
		let r = e.y + e.height;
		return [
			X(i, e),
			X(a, e),
			X(Y(o, J(t, a, r), n), e),
			X(Y(s, J(t, i, r), n), e)
		];
	}
	return [
		X(Y(i, J(t, s, e.y), n), e),
		X(Y(a, J(t, o, e.y), n), e),
		X(o, e),
		X(s, e)
	];
}
function q(e, t, n) {
	let r = t.x - e.x;
	if (Math.abs(r) < 1e-6) return {
		x: n,
		y: t.y
	};
	let i = (n - e.x) / r;
	return {
		x: n,
		y: e.y + (t.y - e.y) * i
	};
}
function J(e, t, n) {
	let r = t.y - e.y;
	if (Math.abs(r) < 1e-6) return {
		x: t.x,
		y: n
	};
	let i = (n - e.y) / r;
	return {
		x: e.x + (t.x - e.x) * i,
		y: n
	};
}
function Y(e, t, n) {
	return {
		x: e.x + (t.x - e.x) * n,
		y: e.y + (t.y - e.y) * n
	};
}
function X(e, t) {
	return {
		x: e.x - t.x,
		y: e.y - t.y
	};
}
function Je(e) {
	return Math.max(0, Math.min(.45, e));
}
function Ye(e) {
	return Math.max(.72, Math.min(1.18, e));
}
function Xe(e, t, n) {
	let r = n[0] ?? {
		x: 0,
		y: 0
	}, i = n[1] ?? {
		x: e,
		y: 0
	}, a = n[2] ?? {
		x: e,
		y: t
	}, o = n[3] ?? {
		x: 0,
		y: t
	}, s = i.x - a.x, c = o.x - a.x, l = r.x - i.x + a.x - o.x, u = i.y - a.y, d = o.y - a.y, f = r.y - i.y + a.y - o.y, p = Ze(s * d - c * u, s, c, l, u, d, f), m = p.x, h = p.y, g = i.x - r.x + m * i.x, _ = o.x - r.x + h * o.x, v = r.x, y = i.y - r.y + m * i.y, b = o.y - r.y + h * o.y, x = r.y;
	return rt.set(g / e, -_ / t, 0, v, -y / e, b / t, 0, -x, 0, 0, 1, 0, m / e, -h / t, 0, 1);
}
function Ze(e, t, n, r, i, a, o) {
	return Math.abs(e) < 1e-6 ? {
		x: 0,
		y: 0
	} : {
		x: (r * a - n * o) / e,
		y: (t * o - r * i) / e
	};
}
function Qe(e, t) {
	return tt.set(1, Math.tan(e), 0, 0, Math.tan(t), 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
}
function $e(e) {
	return nt.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, e, 1);
}
function et(t) {
	return t instanceof e;
}
var Z = new t(), Q = new t(), tt = new t(), nt = new t(), rt = new t(), it = new n(), at = class {
	targets = /* @__PURE__ */ new Map();
	manualTargets = /* @__PURE__ */ new Map();
	nextTargets = /* @__PURE__ */ new Map();
	beginRelayout() {
		this.nextTargets = /* @__PURE__ */ new Map();
	}
	record(e, t) {
		e.key && this.nextTargets.set(e.key, {
			key: e.key,
			kind: e.kind,
			rect: $(t),
			visualRect: ze(t)
		});
	}
	overrideVisualRect(e, t) {
		let n = this.nextTargets.get(e);
		if (n) {
			this.nextTargets.set(e, {
				...n,
				visualRect: $(t)
			});
			return;
		}
		let r = this.targets.get(e);
		r && this.targets.set(e, {
			...r,
			visualRect: $(t)
		});
	}
	setManualTarget(e, t) {
		let n = {
			key: e,
			kind: "leaf",
			rect: $(t),
			visualRect: $(t)
		};
		this.manualTargets.set(e, n), this.targets.set(e, n);
	}
	delete(e) {
		this.manualTargets.delete(e), this.targets.delete(e), this.nextTargets.delete(e);
	}
	endRelayout() {
		this.targets.clear();
		for (let [e, t] of this.nextTargets) this.targets.set(e, t);
		for (let [e, t] of this.manualTargets) this.targets.set(e, t);
		this.nextTargets.clear();
	}
	get(e) {
		return this.targets.get(e) ?? null;
	}
	require(e) {
		let t = this.get(e);
		if (!t) throw Error(`LayoutKeyRegistry: missing layout target "${e}"`);
		return t;
	}
	has(e) {
		return this.targets.has(e);
	}
	all() {
		return Array.from(this.targets.values());
	}
	keys() {
		return Array.from(this.targets.keys());
	}
};
function $(e) {
	return {
		x: e.x,
		y: e.y,
		width: e.width,
		height: e.height
	};
}
//#endregion
//#region src/layout-engine/SceneResponsiveLayout.ts
var ot = class {
	runtime;
	unsubscribe;
	stage;
	plan;
	disposed = !1;
	constructor(e) {
		this.stage = e.stage, this.plan = e.plan;
		let t = this.stage.screen;
		this.runtime = new U({
			root: this.plan(t),
			viewport: {
				x: 0,
				y: 0,
				width: t.width,
				height: t.height
			},
			defaultTransition: e.defaultTransition ?? {
				durationMs: 0,
				easing: "Linear"
			},
			registry: e.registry
		}), this.runtime.relayoutInstant(), this.unsubscribe = this.stage.onScreenChange((e) => {
			this.disposed || (this.runtime.setViewport({
				x: 0,
				y: 0,
				width: e.width,
				height: e.height
			}), this.runtime.setRoot(this.plan(e)));
		});
	}
	tick(e) {
		this.disposed || this.runtime.tick(e);
	}
	relayout() {
		this.disposed || this.runtime.setRoot(this.plan(this.stage.screen));
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.unsubscribe(), this.runtime.dispose());
	}
};
//#endregion
//#region src/layout-engine/oneshot.ts
function st(e, t, n = {}) {
	L(e, t, (e, t) => {
		e.onRect?.(t), n.visit?.(e, t);
	});
}
//#endregion
//#region src/layout-engine/containedRect.ts
function ct(e) {
	return {
		x: lt(e.bounds.x, e.bounds.width, e.width, e.alignX ?? "start"),
		y: lt(e.bounds.y, e.bounds.height, e.height, e.alignY ?? "start"),
		width: e.width,
		height: e.height
	};
}
function lt(e, t, n, r) {
	return r === "end" ? e + Math.max(0, t - n) : r === "center" ? e + Math.max(0, Math.floor((t - n) / 2)) : e;
}
//#endregion
export { C, ne as D, w as E, r as O, ue as S, E as T, de as _, W as a, k as b, Le as c, U as d, L as f, D as g, M as h, at as i, ee as k, G as l, _e as m, st as n, Ie as o, I as p, ot as r, Re as s, ct as t, Be as u, O as v, T as w, A as x, j as y };
