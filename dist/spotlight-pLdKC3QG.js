import { o as e, t } from "./Graphics-DukR35Yh.js";
import { _ as n, b as r, n as i, v as a } from "./layout-engine-Av7yEAL8.js";
//#region src/spotlight/SpotlightOverlay.ts
var o = 10500, s = {
	dim: 329224,
	ring: 16045178,
	arrow: 16045178
}, c = 8, l = 24, u = 16, d = 360, f = 220, p = 132, m = 140, h = 180, g = 120;
function _(n) {
	let r = n.textureManager ?? n.stage.textureManager, i = new e({ name: "r3:spotlight-overlay" });
	i.setDepth(n.depth ?? 10500), i.setAlpha(0), n.stage.add(i);
	let a = new t({
		width: n.stage.screen.width,
		height: n.stage.screen.height,
		originX: 0,
		originY: 0,
		textureManager: r
	}), o = new t({
		width: n.stage.screen.width,
		height: n.stage.screen.height,
		originX: 0,
		originY: 0,
		textureManager: r
	}), s = new t({
		width: n.stage.screen.width,
		height: n.stage.screen.height,
		originX: 0,
		originY: 0,
		textureManager: r
	}), c = new e({ name: "r3:spotlight-overlay:adornment-root" });
	i.add(a), i.add(o), i.add(s), i.add(c), i.setInteractiveRect(n.stage.screen.width, n.stage.screen.height), n.onActivate && i.on("pointerdown", () => n.onActivate?.());
	let l = {
		target: n.target,
		latest: null
	}, u = A(), d = (e) => {
		l.latest = e;
		let t = n.stage.screen;
		a.setSize(t.width, t.height), o.setSize(t.width, t.height), s.setSize(t.width, t.height), i.setInteractiveRect(t.width, t.height), x(a, t.width, t.height, e.focus), S(o, e), s.clear(), n.adornmentRenderer?.({
			root: c,
			graphics: s,
			layout: e,
			viewport: {
				x: 0,
				y: 0,
				width: t.width,
				height: t.height
			},
			textureManager: r
		});
	}, f = (e) => {
		i.setVisible(!0), n.stage.tweens.killTweensOf(u), n.stage.tweens.killTweensOf(o), n.stage.tweens.killTweensOf(s), n.stage.tweens.killTweensOf(c), o.setAlpha(0), s.setAlpha(0), c.setAlpha(0), d(e), n.stage.tweens.add({
			targets: [
				o,
				s,
				c
			],
			alpha: 1,
			duration: g,
			ease: "Quad.easeOut"
		});
	}, p = (e) => {
		if (i.setVisible(!0), !l.latest) {
			o.setAlpha(1), s.setAlpha(1), c.setAlpha(1), j(u, e), d(e), n.stage.tweens.killTweensOf(i), n.stage.tweens.add({
				targets: i,
				alpha: 1,
				duration: m,
				ease: "Quad.easeOut"
			});
			return;
		}
		j(u, l.latest), n.stage.tweens.killTweensOf(u), n.stage.tweens.add({
			targets: u,
			duration: h,
			ease: "Cubic.easeOut",
			focusX: e.focus.x,
			focusY: e.focus.y,
			focusWidth: e.focus.width,
			focusHeight: e.focus.height,
			calloutX: e.callout.x,
			calloutY: e.callout.y,
			calloutWidth: e.callout.width,
			calloutHeight: e.callout.height,
			connectorStartX: e.connectorStart.x,
			connectorStartY: e.connectorStart.y,
			connectorEndX: e.connectorEnd.x,
			connectorEndY: e.connectorEnd.y,
			onUpdate: () => {
				d(M(u, e));
			},
			onComplete: () => {
				d(e);
			}
		});
	}, _ = () => {
		let e = n.registry.get(l.target.targetKey);
		return e ? y({
			viewport: {
				x: 0,
				y: 0,
				width: n.stage.screen.width,
				height: n.stage.screen.height
			},
			target: e,
			preferredSide: l.target.preferredSide
		}) : null;
	}, v = (e = "follow-layout") => {
		let t = _();
		if (!t) {
			l.latest = null, i.setVisible(!1);
			return;
		}
		if (e === "switch-step") {
			f(t);
			return;
		}
		p(t);
	};
	v();
	let b = n.stage.onScreenChange(() => v());
	return {
		node: i,
		layout: () => l.latest,
		setTarget(e) {
			l.target = e, v("switch-step");
		},
		refresh: v,
		dispose() {
			b(), n.stage.tweens.killTweensOf(u), n.stage.tweens.killTweensOf(i), n.stage.tweens.killTweensOf(o), n.stage.tweens.killTweensOf(s), n.stage.tweens.killTweensOf(c), i.destroy();
		}
	};
}
function v(e = {}) {
	let t = e.color ?? s.arrow, n = e.alpha ?? .95, r = e.width ?? 3;
	return ({ graphics: e, layout: i }) => {
		e.lineStyle(r, t, n), e.strokeLine(i.connectorStart.x, i.connectorStart.y, i.connectorEnd.x, i.connectorEnd.y), C(e, i.connectorStart, i.connectorEnd, t, n);
	};
}
function y(e) {
	let t = "rect" in e.target ? e.target.visualRect : e.target, n = e.viewport, r = w(t, -c, n), a = Math.min(d, Math.max(f, n.width - u * 2)), o = T(e.preferredSide).find((e) => E(e, r, n, a, p)) ?? D(r, n), s = {
		focus: r,
		callout: {
			x: n.x + u,
			y: n.y + u,
			width: a,
			height: p
		}
	};
	return i(b({
		focus: r,
		side: o,
		viewport: n,
		calloutWidth: a,
		calloutHeight: p,
		onFocus: (e) => {
			s.focus = e;
		},
		onCallout: (e) => {
			s.callout = e;
		}
	}), n), {
		target: t,
		focus: s.focus,
		callout: s.callout,
		side: o,
		connectorStart: k(s.callout, s.focus),
		connectorEnd: k(s.focus, s.callout)
	};
}
function b(e) {
	return a({
		width: e.viewport.width,
		height: e.viewport.height,
		absolute: [n({
			node: r({
				width: e.focus.width,
				height: e.focus.height,
				onRect: e.onFocus
			}),
			place: () => e.focus
		}), n({
			node: r({
				width: e.calloutWidth,
				height: e.calloutHeight,
				onRect: e.onCallout
			}),
			place: (t) => O(e.side, e.focus, t, e.calloutWidth, e.calloutHeight)
		})]
	});
}
function x(e, t, n, r) {
	e.clear(), e.fillStyle(s.dim, .62), e.fillRect(0, 0, t, Math.max(0, r.y)), e.fillRect(0, r.y + r.height, t, Math.max(0, n - r.y - r.height)), e.fillRect(0, r.y, Math.max(0, r.x), r.height), e.fillRect(r.x + r.width, r.y, Math.max(0, t - r.x - r.width), r.height);
}
function S(e, t) {
	e.clear(), e.lineStyle(3, s.ring, .95), e.strokeRoundedRect(t.focus.x, t.focus.y, t.focus.width, t.focus.height, 10);
}
function C(e, t, n, r, i) {
	let a = Math.atan2(n.y - t.y, n.x - t.x), o = .55, s = {
		x: n.x - Math.cos(a - o) * 12,
		y: n.y - Math.sin(a - o) * 12
	}, c = {
		x: n.x - Math.cos(a + o) * 12,
		y: n.y - Math.sin(a + o) * 12
	};
	e.fillStyle(r, i), e.fillTriangle(n.x, n.y, s.x, s.y, c.x, c.y);
}
function w(e, t, n) {
	let r = N(e.x + t, n.x, n.x + n.width), i = N(e.y + t, n.y, n.y + n.height), a = N(e.x + e.width - t, n.x, n.x + n.width), o = N(e.y + e.height - t, n.y, n.y + n.height);
	return {
		x: r,
		y: i,
		width: Math.max(0, a - r),
		height: Math.max(0, o - i)
	};
}
function T(e) {
	let t = [
		"bottom",
		"top",
		"right",
		"left"
	];
	return e ? [e, ...t.filter((t) => t !== e)] : t;
}
function E(e, t, n, r, i) {
	return e === "top" ? t.y - n.y >= i + l + u : e === "bottom" ? n.y + n.height - (t.y + t.height) >= i + l + u : e === "left" ? t.x - n.x >= r + l + u : n.x + n.width - (t.x + t.width) >= r + l + u;
}
function D(e, t) {
	let n = {
		top: e.y - t.y,
		bottom: t.y + t.height - (e.y + e.height),
		left: e.x - t.x,
		right: t.x + t.width - (e.x + e.width)
	};
	return Object.entries(n).sort((e, t) => t[1] - e[1])[0]?.[0] ?? "bottom";
}
function O(e, t, n, r, i) {
	return e === "top" || e === "bottom" ? {
		x: N(t.x + t.width / 2 - r / 2, n.x + u, n.x + n.width - r - u),
		y: N(e === "top" ? t.y - l - i : t.y + t.height + l, n.y + u, n.y + n.height - i - u),
		width: r,
		height: i
	} : {
		x: N(e === "left" ? t.x - l - r : t.x + t.width + l, n.x + u, n.x + n.width - r - u),
		y: N(t.y + t.height / 2 - i / 2, n.y + u, n.y + n.height - i - u),
		width: r,
		height: i
	};
}
function k(e, t) {
	let n = e.x + e.width / 2, r = e.y + e.height / 2, i = t.x + t.width / 2, a = t.y + t.height / 2, o = i - n, s = a - r;
	if (o === 0 && s === 0) return {
		x: n,
		y: r
	};
	let c = Math.max(.001, e.width / 2), l = Math.max(.001, e.height / 2), u = 1 / Math.max(Math.abs(o) / c, Math.abs(s) / l);
	return {
		x: n + o * u,
		y: r + s * u
	};
}
function A() {
	return {
		focusX: 0,
		focusY: 0,
		focusWidth: 0,
		focusHeight: 0,
		calloutX: 0,
		calloutY: 0,
		calloutWidth: 0,
		calloutHeight: 0,
		connectorStartX: 0,
		connectorStartY: 0,
		connectorEndX: 0,
		connectorEndY: 0
	};
}
function j(e, t) {
	e.focusX = t.focus.x, e.focusY = t.focus.y, e.focusWidth = t.focus.width, e.focusHeight = t.focus.height, e.calloutX = t.callout.x, e.calloutY = t.callout.y, e.calloutWidth = t.callout.width, e.calloutHeight = t.callout.height, e.connectorStartX = t.connectorStart.x, e.connectorStartY = t.connectorStart.y, e.connectorEndX = t.connectorEnd.x, e.connectorEndY = t.connectorEnd.y;
}
function M(e, t) {
	return {
		...t,
		focus: {
			x: e.focusX,
			y: e.focusY,
			width: e.focusWidth,
			height: e.focusHeight
		},
		callout: {
			x: e.calloutX,
			y: e.calloutY,
			width: e.calloutWidth,
			height: e.calloutHeight
		},
		connectorStart: {
			x: e.connectorStartX,
			y: e.connectorStartY
		},
		connectorEnd: {
			x: e.connectorEndX,
			y: e.connectorEndY
		}
	};
}
function N(e, t, n) {
	return n < t ? t : Math.max(t, Math.min(n, e));
}
//#endregion
export { _ as i, y as n, v as r, o as t };
