import { o as e, t } from "./Graphics-DukR35Yh.js";
//#region src/layout-engine/editor/editor.ts
var n = [
	"tl",
	"tc",
	"tr",
	"ml",
	"mr",
	"bl",
	"bc",
	"br"
], r = 12, i = 16, a = class {
	host;
	viewport;
	events;
	skipKey;
	state;
	dragThrottleMs;
	lastApplyMs = 0;
	pendingPointer = null;
	constructor(e) {
		this.host = e.host, this.viewport = e.viewport, this.events = e.events ?? {}, this.skipKey = e.skipKey ?? (() => !1), this.state = {
			selectedKey: null,
			snapSize: e.initialSnap ?? 7,
			drag: null
		}, this.dragThrottleMs = Math.max(0, e.initialDragThrottleMs ?? 60);
	}
	getDragThrottleMs() {
		return this.dragThrottleMs;
	}
	setDragThrottleMs(e) {
		this.dragThrottleMs = Math.max(0, e);
	}
	getState() {
		return this.state;
	}
	getSelectedKey() {
		return this.state.selectedKey;
	}
	getSnapSize() {
		return this.state.snapSize;
	}
	setSnapSize(e) {
		e <= 0 || (this.state = {
			...this.state,
			snapSize: e
		}, this.events.onStateChange?.());
	}
	select(e) {
		this.state.selectedKey !== e && (this.state = {
			...this.state,
			selectedKey: e
		}, this.events.onStateChange?.());
	}
	isMovable(e) {
		return this.host.findAbsoluteWrapper(e) !== null;
	}
	isResizable(e) {
		let t = this.host.findNode(e);
		return t ? typeof t.width == "number" && typeof t.height == "number" : !1;
	}
	onPointerDown(e, t) {
		let n = this.state.selectedKey;
		if (n !== null && this.isResizable(n)) {
			let r = this.host.rects[n];
			if (r) {
				let i = d(r, e, t);
				if (i) {
					this.startResize(n, i, e, t, r);
					return;
				}
			}
		}
		let r = this.hitTestDeepest(e, t);
		if (r === null) {
			this.select(null);
			return;
		}
		this.select(r), this.isMovable(r) || this.host.promoteFlowToAbsolute(r), this.isMovable(r) && this.startMove(r, e, t);
	}
	onPointerMove(e, t) {
		let n = this.state.drag;
		if (!n) return;
		let r = performance.now();
		if (r - this.lastApplyMs < this.dragThrottleMs) {
			this.pendingPointer = {
				x: e,
				y: t
			};
			return;
		}
		this.lastApplyMs = r, this.pendingPointer = null, n.kind === "move" ? this.applyMove(n, e, t) : this.applyResize(n, e, t);
	}
	onPointerUp() {
		if (this.state.drag) {
			if (this.pendingPointer) {
				let e = this.pendingPointer;
				this.pendingPointer = null, this.state.drag.kind === "move" ? this.applyMove(this.state.drag, e.x, e.y) : this.applyResize(this.state.drag, e.x, e.y);
			}
			this.host.endInstant(), this.host.relayout(), this.state = {
				...this.state,
				drag: null
			}, this.events.onStateChange?.();
		}
	}
	deleteSelected() {
		let e = this.state.selectedKey;
		e !== null && this.host.removeByKey(e) && (this.state = {
			...this.state,
			selectedKey: null,
			drag: null
		}, this.events.onStateChange?.());
	}
	addPlaceholder() {
		let e = this.state.snapSize, t = this.host.addPlaceholder;
		if (!t) return;
		let n = t({
			anchor: "top-left",
			insetX: f(e * 10, e),
			insetY: f(e * 10, e)
		});
		this.select(n);
	}
	startMove(e, t, n) {
		let r = this.host.getAnchorPlacement(e), i = this.host.rects[e];
		if (!r || !i) return;
		this.host.beginInstant();
		let a = {
			kind: "move",
			key: e,
			anchor: r.anchor,
			startInsetX: r.insetX,
			startInsetY: r.insetY,
			startRect: i,
			startPointerX: t,
			startPointerY: n
		};
		this.state = {
			...this.state,
			drag: a
		}, this.events.onStateChange?.();
	}
	startResize(e, t, n, r, i) {
		let a = this.host.getAnchorPlacement(e);
		this.host.beginInstant();
		let o = {
			kind: "resize",
			key: e,
			handle: t,
			anchor: a?.anchor ?? null,
			startInsetX: a?.insetX ?? null,
			startInsetY: a?.insetY ?? null,
			startRect: i,
			startPointerX: n,
			startPointerY: r
		};
		this.state = {
			...this.state,
			drag: o
		}, this.events.onStateChange?.();
	}
	applyMove(e, t, n) {
		let r = t - e.startPointerX, i = n - e.startPointerY, a = this.state.snapSize, o = f(e.startRect.x + r, a), s = f(e.startRect.y + i, a), { insetX: c, insetY: l } = p(e.anchor, this.viewport, {
			width: e.startRect.width,
			height: e.startRect.height
		}, o, s);
		this.host.setAnchorPlacement(e.key, {
			anchor: e.anchor,
			insetX: c,
			insetY: l
		});
	}
	applyResize(e, t, n) {
		let r = this.state.snapSize, i = m(e.handle, e.startRect, t, n, r);
		if (this.host.setNodeSize(e.key, i.width, i.height), e.anchor === null) return;
		let { insetX: a, insetY: o } = p(e.anchor, this.viewport, {
			width: i.width,
			height: i.height
		}, i.x, i.y);
		this.host.setAnchorPlacement(e.key, {
			anchor: e.anchor,
			insetX: a,
			insetY: o
		});
	}
	hitTestDeepest(e, t) {
		let n = this.host.tree.current;
		return o(n, e, t, this.host.rects, this.skipKey);
	}
};
function o(e, t, n, r, i) {
	if (e.kind === "flex") {
		for (let a = e.absolute.length - 1; a >= 0; a--) {
			let s = e.absolute[a];
			if (!s) continue;
			let c = o(s.node, t, n, r, i);
			if (c !== null) return c;
		}
		for (let a = e.children.length - 1; a >= 0; a--) {
			let s = e.children[a];
			if (!s) continue;
			let c = o(s, t, n, r, i);
			if (c !== null) return c;
		}
	}
	let a = e.key;
	if (a === null || i(a)) return null;
	let c = r[a];
	return !c || !s(c, t, n) ? null : a;
}
function s(e, t, n) {
	return t >= e.x && t <= e.x + e.width && n >= e.y && n <= e.y + e.height;
}
function c(e, t) {
	let n = l(e, t), r = u(e, t);
	return {
		x: n - 12 / 2,
		y: r - 12 / 2,
		width: 12,
		height: 12
	};
}
function l(e, t) {
	return t === "tl" || t === "ml" || t === "bl" ? e.x : t === "tr" || t === "mr" || t === "br" ? e.x + e.width : e.x + e.width / 2;
}
function u(e, t) {
	return t === "tl" || t === "tc" || t === "tr" ? e.y : t === "bl" || t === "bc" || t === "br" ? e.y + e.height : e.y + e.height / 2;
}
function d(e, t, r) {
	for (let i of n) if (s(c(e, i), t, r)) return i;
	return null;
}
function f(e, t) {
	return t <= 1 ? Math.round(e) : Math.round(e / t) * t;
}
function p(e, t, n, r, i) {
	return {
		insetX: e.endsWith("-left") ? r : e.endsWith("-right") ? t.width - n.width - r : r - (t.width - n.width) / 2,
		insetY: e.startsWith("top-") ? i : e.startsWith("bottom-") ? t.height - n.height - i : i - (t.height - n.height) / 2
	};
}
function m(e, t, n, r, a) {
	let o = e === "tl" || e === "ml" || e === "bl", s = e === "tr" || e === "mr" || e === "br", c = e === "tl" || e === "tc" || e === "tr", l = e === "bl" || e === "bc" || e === "br", u = t.x, d = t.x + t.width, p = t.y, m = t.y + t.height, _ = o ? g(f(n, a), d - i) : u, v = s ? h(f(n, a), u + i) : d, y = c ? g(f(r, a), m - i) : p, b = l ? h(f(r, a), p + i) : m;
	return {
		x: _,
		y,
		width: v - _,
		height: b - y
	};
}
function h(e, t) {
	return e < t ? t : e;
}
function g(e, t) {
	return e > t ? t : e;
}
//#endregion
//#region src/layout-engine/editor/overlay.ts
var _ = 11e3, v = {
	selection: 5951743,
	selectionFlow: 15780992,
	handleFill: 16777215,
	handleFillFlow: 9072720,
	handleStroke: 5951743,
	grid: 16777215
};
function y(n) {
	let { stage: r, viewport: i, selectedRect: a, isMovable: o, isResizable: s, snapSize: c, showGrid: l } = n, u = new e({ name: "r3:layout-editor:overlay" });
	u.setDepth(n.depth ?? 11e3), r.add(u);
	let d = new t({
		x: 0,
		y: 0,
		width: i.width,
		height: i.height,
		originX: 0,
		originY: 0,
		textureManager: n.textureManager
	});
	return u.add(d), l && c > 1 && b(d, i.width, i.height, c), a && (x(d, a, o), s && S(d, a, o)), { dispose: () => {
		u.destroy();
	} };
}
function b(e, t, n, r) {
	e.lineStyle(1, v.grid, .06);
	for (let i = r; i < t; i += r) e.strokeLine(i, 0, i, n);
	for (let i = r; i < n; i += r) e.strokeLine(0, i, t, i);
}
function x(e, t, n) {
	let r = n ? v.selection : v.selectionFlow;
	e.lineStyle(2, r, .95), e.strokeRect(t.x - 1, t.y - 1, Math.max(0, t.width + 2), Math.max(0, t.height + 2));
}
function S(e, t, r) {
	let i = r ? v.handleFill : v.handleFillFlow;
	for (let r of n) {
		let n = c(t, r);
		e.fillStyle(i, 1), e.fillRect(n.x, n.y, 12, 12), e.lineStyle(1, v.handleStroke, 1), e.strokeRect(n.x + .5, n.y + .5, 11, 11);
	}
}
//#endregion
export { a, m as c, r as i, f as l, y as n, c as o, n as r, p as s, _ as t };
