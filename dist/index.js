import { a as e, c as t, i as n, n as r, o as i, r as a, s as o, t as s } from "./Graphics-DukR35Yh.js";
import { D as c, O as l, k as u } from "./layout-engine-Av7yEAL8.js";
import { a as d, i as f, r as p, t as m } from "./texture-sizing-RyEQJdmo.js";
import { b as h, f as g, v as _ } from "./panel-effects-C-rEhv2K.js";
import { i as v, n as y, r as b, t as x } from "./spotlight-pLdKC3QG.js";
import { BufferAttribute as S, LinearFilter as C, Matrix4 as w, Mesh as T, MeshBasicMaterial as E, OrthographicCamera as D, Plane as O, PlaneGeometry as k, SRGBColorSpace as ee, Scene as te, Texture as ne, Vector3 as A } from "three";
//#region src/screen/index.ts
function j(e) {
	let t = e.viewbox ?? {
		x: 0,
		y: 0,
		width: e.width,
		height: e.height
	}, n = e.orientation ?? (e.width >= e.height ? "landscape" : "portrait");
	return Object.freeze({
		width: e.width,
		height: e.height,
		viewbox: Object.freeze(t),
		orientation: n
	});
}
function re(e, t) {
	return j({
		width: e.width,
		height: e.height,
		viewbox: t,
		orientation: e.orientation
	});
}
var ie = j({
	width: 1280,
	height: 720
}), M = class {
	stage;
	_x;
	_y;
	_isDown;
	_activeButton;
	_pointerId;
	_hoveredNode;
	_downNode;
	alive;
	globalListeners;
	constructor(e) {
		this.stage = e, this._x = 0, this._y = 0, this._isDown = !1, this._activeButton = -1, this._pointerId = -1, this._hoveredNode = null, this._downNode = null, this.alive = !0, this.globalListeners = /* @__PURE__ */ new Map();
	}
	get snapshot() {
		return {
			x: this._x,
			y: this._y,
			isDown: this._isDown
		};
	}
	get hovered() {
		return this._hoveredNode;
	}
	on(e, t) {
		let n = this.globalListeners.get(e) ?? /* @__PURE__ */ new Set();
		return n.add(t), this.globalListeners.set(e, n), () => this.off(e, t);
	}
	off(e, t) {
		let n = this.globalListeners.get(e);
		n && n.delete(t);
	}
	feedMove(e, t, n = -1) {
		if (!this.alive) return;
		this._x = e, this._y = t, this._pointerId = n;
		let r = this.pickAt(e, t);
		r !== this._hoveredNode && (this._hoveredNode && this.dispatch(this._hoveredNode, "pointerout", e, t), r && this.dispatch(r, "pointerover", e, t), this._hoveredNode = r), r && this.dispatch(r, "pointermove", e, t), this.dispatchGlobal("pointermove", e, t);
	}
	feedDown(e, t, n = 0, r = -1) {
		if (!this.alive) return;
		this._x = e, this._y = t, this._isDown = !0, this._activeButton = n, this._pointerId = r;
		let i = this.pickAt(e, t);
		this._downNode = i, i && this.dispatch(i, "pointerdown", e, t, n), this.dispatchGlobal("pointerdown", e, t, n);
	}
	feedUp(e, t, n = 0, r = -1) {
		if (!this.alive) return;
		this._x = e, this._y = t, this._isDown = !1, this._activeButton = -1, this._pointerId = r;
		let i = this.pickAt(e, t);
		i && this.dispatch(i, "pointerup", e, t, n), this._downNode && i === this._downNode && this.dispatch(i, "click", e, t, n), this._downNode && this._downNode !== i && this.dispatch(this._downNode, "pointerup", e, t, n), this._downNode = null, this.dispatchGlobal("pointerup", e, t, n);
	}
	feedCancel() {
		this.alive && (this._isDown = !1, this._downNode = null);
	}
	feedWheel(e, t, n) {
		if (!this.alive) return;
		this._x = e, this._y = t;
		let r = this.pickAt(e, t);
		r && this.dispatch(r, "wheel", e, t, 0, n), this.dispatchGlobal("wheel", e, t, 0, n);
	}
	feedPinch(e, t, n) {
		this.alive && (this._x = e, this._y = t, this.dispatchGlobal("pinch", e, t, 0, 0, n));
	}
	pickAt(e, t) {
		return se(this.stage.root, e, t);
	}
	dispatch(e, t, n, r, i = 0, a = 0, o) {
		let s = de(e, n, r), c = {
			type: t,
			x: n,
			y: r,
			localX: s.x,
			localY: s.y,
			isDown: this._isDown,
			pointerId: this._pointerId,
			button: i,
			deltaY: a,
			...o === void 0 ? {} : { scaleDelta: o }
		};
		e._emit(t, c);
	}
	dispatchGlobal(e, t, n, r = 0, i = 0, a) {
		let o = this.globalListeners.get(e);
		if (!o || o.size === 0) return;
		let s = {
			type: e,
			x: t,
			y: n,
			localX: t,
			localY: n,
			isDown: this._isDown,
			pointerId: this._pointerId,
			button: r,
			deltaY: i,
			...a === void 0 ? {} : { scaleDelta: a }
		}, c = Array.from(o);
		for (let e of c) e(s);
	}
	dispose() {
		this.alive = !1, this.globalListeners.clear(), this._hoveredNode = null, this._downNode = null;
	}
	notifyNodeDestroyed(e) {
		this._hoveredNode === e && (this._hoveredNode = null), this._downNode === e && (this._downNode = null);
	}
};
function ae(e) {
	return "children" in e;
}
function oe(e) {
	return ae(e) && Array.isArray(e.children);
}
function se(e, t, n) {
	if (!e.worldVisible || !ce(e, t, n)) return null;
	if (oe(e)) {
		let r = le(e.children);
		for (let e = r.length - 1; e >= 0; e--) {
			let i = r[e];
			if (!i) continue;
			let a = se(i, t, n);
			if (a) return a;
		}
	}
	if (!e.hitArea) return null;
	let r = de(e, t, n);
	return r.x < e.hitArea.x || r.x > e.hitArea.x + e.hitArea.width || r.y < e.hitArea.y || r.y > e.hitArea.y + e.hitArea.height ? null : e;
}
function ce(e, t, n) {
	let r = e.inputClippingPlanes;
	if (!r || r.length === 0) return !0;
	N.set(t, -n, 0);
	for (let e of r) if (e.distanceToPoint(N) < 0) return !1;
	return !0;
}
function le(e) {
	let t = e.map((e, t) => ({
		c: e,
		i: t
	}));
	return t.sort((e, t) => e.c.depth === t.c.depth ? e.i - t.i : e.c.depth - t.c.depth), t.map((e) => e.c);
}
var N = new A(), ue = new w();
function de(e, t, n) {
	return e.obj3d.updateWorldMatrix(!0, !1), ue.copy(e.obj3d.matrixWorld).invert(), N.set(t, -n, 0).applyMatrix4(ue), {
		x: N.x,
		y: -N.y
	};
}
//#endregion
//#region src/Drag.ts
var fe = class {
	pointer;
	registrations;
	gesture;
	disposers;
	constructor(e) {
		this.pointer = e, this.registrations = /* @__PURE__ */ new Map(), this.gesture = null, this.disposers = [], this.disposers.push(this.pointer.on("pointermove", (e) => {
			this.onPointerMove(e.x, e.y);
		})), this.disposers.push(this.pointer.on("pointerup", (e) => {
			this.onPointerUp(e.x, e.y);
		}));
	}
	attach(e, t = {}) {
		let n = {
			node: e,
			...t
		};
		this.registrations.set(e, n);
		let r = (e) => {
			this.onPointerDown(n, e.x, e.y);
		};
		return e.on("pointerdown", r), () => {
			e.off("pointerdown", r), this.registrations.delete(e), this.gesture && this.gesture.registration.node === e && (this.gesture.registration.onDragCancel?.(), this.gesture = null);
		};
	}
	get dragging() {
		return this.gesture?.began === !0;
	}
	get draggingNode() {
		return !this.gesture || !this.gesture.began ? null : this.gesture.registration.node;
	}
	onPointerDown(e, t, n) {
		this.gesture && this.gesture.began || (this.gesture = {
			registration: e,
			startX: t,
			startY: n,
			began: !1
		});
	}
	onPointerMove(e, t) {
		if (!this.gesture) return;
		let n = this.gesture, r = e - n.startX, i = t - n.startY;
		if (!n.began) {
			let e = n.registration.threshold ?? pe;
			if (Math.hypot(r, i) < e) return;
			n.began = !0, n.registration.onDragStart?.({
				x: n.startX,
				y: n.startY
			});
		}
		n.registration.onDrag?.({
			x: e,
			y: t,
			dx: r,
			dy: i
		});
	}
	onPointerUp(e, t) {
		if (!this.gesture) return;
		let n = this.gesture;
		if (this.gesture = null, n.began) {
			n.registration.onDragEnd?.({
				x: e,
				y: t
			});
			return;
		}
		n.registration.onDragCancel?.();
	}
	notifyNodeDestroyed(e) {
		this.registrations.has(e) && (this.registrations.delete(e), this.gesture && this.gesture.registration.node === e && (this.gesture = null));
	}
	cancel() {
		if (!this.gesture) return;
		let e = this.gesture;
		this.gesture = null, e.began && e.registration.onDragCancel?.();
	}
	dispose() {
		for (let e of this.disposers) e();
		this.disposers.length = 0, this.registrations.clear(), this.gesture = null;
	}
}, pe = 6, me = class {
	scene;
	camera;
	root;
	renderer;
	textureManager;
	tweens;
	pointer;
	drag;
	screen;
	frameCounter;
	worldLayers;
	worldLayerFns;
	overlayLayers;
	overlayLayerFns;
	frameHooks;
	destroyHooks;
	screenSubscribers;
	constructor(e) {
		this.screen = j(e.screen), this.frameCounter = 0, this.renderer = e.renderer ?? null, this.textureManager = e.textureManager, this.scene = new te();
		let t = e.near ?? -1e3, n = e.far ?? 1e3;
		this.camera = new D(0, this.screen.width, 0, -this.screen.height, t, n), this.camera.position.set(0, 0, 0), this.root = new i({ name: "r3:root" }), this.root._attachToStage(this), this.scene.add(this.root.obj3d), this.tweens = new c(), this.pointer = new M(this), this.drag = new fe(this.pointer), this.worldLayers = [], this.worldLayerFns = [], this.overlayLayers = [], this.overlayLayerFns = [], this.frameHooks = [], this.destroyHooks = [], this.screenSubscribers = /* @__PURE__ */ new Set();
	}
	add(e) {
		return this.root.add(e), e;
	}
	setScreen(e) {
		let t = j(e);
		if (this.screen.width === t.width && this.screen.height === t.height && this.screen.viewbox.x === t.viewbox.x && this.screen.viewbox.y === t.viewbox.y && this.screen.viewbox.width === t.viewbox.width && this.screen.viewbox.height === t.viewbox.height && this.screen.orientation === t.orientation) return;
		this.screen = t;
		let n = this.camera;
		n.left = 0, n.right = t.width, n.top = 0, n.bottom = -t.height, n.updateProjectionMatrix();
		let r = Array.from(this.screenSubscribers);
		for (let e of r) e(t);
	}
	onScreenChange(e) {
		return this.screenSubscribers.add(e), () => {
			this.screenSubscribers.delete(e);
		};
	}
	tick(e) {
		if (this.frameCounter += 1, this.tweens.advance(e), this.composeFrame(), this.frameHooks.length > 0) {
			let e = this.frameHooks.slice();
			for (let t of e) t();
		}
	}
	composeFrame() {
		this.root.composeWorldState(1, !0), this.root.composeRenderOrder(0, 0);
	}
	get pointerSnapshot() {
		return this.pointer.snapshot;
	}
	registerWorldLayer(e, t) {
		this.worldLayers.some((t) => t.scene === e) || this.worldLayers.push({
			scene: e,
			camera: t
		});
	}
	unregisterWorldLayer(e) {
		let t = this.worldLayers.findIndex((t) => t.scene === e);
		t < 0 || this.worldLayers.splice(t, 1);
	}
	registerWorldLayerFn(e) {
		return this.worldLayerFns.push(e), () => {
			let t = this.worldLayerFns.indexOf(e);
			t >= 0 && this.worldLayerFns.splice(t, 1);
		};
	}
	registerOverlayLayer(e, t) {
		this.overlayLayers.some((t) => t.scene === e) || this.overlayLayers.push({
			scene: e,
			camera: t
		});
	}
	unregisterOverlayLayer(e) {
		let t = this.overlayLayers.findIndex((t) => t.scene === e);
		t < 0 || this.overlayLayers.splice(t, 1);
	}
	registerOverlayLayerFn(e) {
		return this.overlayLayerFns.push(e), () => {
			let t = this.overlayLayerFns.indexOf(e);
			t >= 0 && this.overlayLayerFns.splice(t, 1);
		};
	}
	onFrame(e) {
		return this.frameHooks.push(e), () => {
			let t = this.frameHooks.indexOf(e);
			t >= 0 && this.frameHooks.splice(t, 1);
		};
	}
	onDestroy(e) {
		return this.destroyHooks.push(e), () => {
			let t = this.destroyHooks.indexOf(e);
			t >= 0 && this.destroyHooks.splice(t, 1);
		};
	}
	render(e) {
		for (let t of this.worldLayers) e.render(t.scene, t.camera);
		for (let t of this.worldLayerFns) t(e);
		e.clearDepth(), e.render(this.scene, this.camera), e.clearDepth();
		for (let t of this.overlayLayers) e.render(t.scene, t.camera);
		for (let t of this.overlayLayerFns) t(e);
	}
	destroy() {
		let e = this.destroyHooks.slice();
		this.destroyHooks.length = 0;
		for (let t of e) t();
		this.tweens.killAll(), this.pointer.dispose(), this.drag.dispose(), this.root.destroy(), this.scene.remove(...this.scene.children), this.worldLayers.length = 0, this.worldLayerFns.length = 0, this.overlayLayers.length = 0, this.overlayLayerFns.length = 0, this.frameHooks.length = 0, this.screenSubscribers.clear();
	}
}, he = class extends i {
	r3TransformRole = "layout-root";
}, ge = class extends i {
	r3TransformRole = "motion-root";
};
function _e(e = {}) {
	return new he(e);
}
function ve(e = {}) {
	return new ge(e);
}
function ye(e) {
	let t = e.originX ?? .5, n = e.originY ?? .5, r = {
		width: e.width,
		height: e.height
	}, i = _e({
		x: e.x,
		y: e.y,
		name: e.name
	}), a = ve({
		x: r.width * (.5 - t),
		y: r.height * (.5 - n),
		name: e.pivotName ?? (e.name ? `${e.name}:pivot` : void 0)
	}), o = ve({
		x: -r.width / 2,
		y: -r.height / 2,
		name: e.contentName ?? (e.name ? `${e.name}:content` : void 0)
	});
	return i.add(a), a.add(o), {
		root: i,
		pivot: a,
		content: o,
		setRect(e, s, c, l) {
			r.width = c, r.height = l, i.setPosition(e + c * t, s + l * n), a.setPosition(c * (.5 - t), l * (.5 - n)), o.setPosition(-c / 2, -l / 2);
		},
		getRect() {
			return {
				x: i.x - r.width * t,
				y: i.y - r.height * n,
				width: r.width,
				height: r.height
			};
		},
		localRect() {
			return {
				x: -r.width / 2,
				y: -r.height / 2,
				width: r.width,
				height: r.height
			};
		}
	};
}
function be(e) {
	return ye({
		...e,
		originX: .5,
		originY: .5
	});
}
function xe(e, t, n) {
	if (!t) {
		e.setScale(n.scale);
		return;
	}
	t.killTweensOf(e), t.add({
		targets: e,
		scaleX: n.scale,
		scaleY: n.scale,
		duration: n.durationMs,
		yoyo: n.yoyo,
		ease: n.ease ?? "Quad.easeOut"
	});
}
function Se(e) {
	e.setPosition(0, 0), e.setScale(1);
}
function Ce(e, t, n = {}) {
	let r = n.scale ?? .97, i = n.durationMs ?? 90;
	e.setScale(1), xe(e, t, {
		scale: r,
		durationMs: i,
		yoyo: !0,
		ease: n.ease ?? "Quad.easeOut"
	});
}
function we(e, t, n = {}) {
	let r = n.amplitude ?? 5, i = n.segmentMs ?? 40, a = n.repeats ?? 3;
	t.killTweensOf(e), e.setPosition(0, 0), t.add({
		targets: e,
		x: r,
		duration: i,
		yoyo: !0,
		repeat: a,
		ease: n.ease ?? "Sine.easeInOut",
		onComplete: () => {
			e.setPosition(0, 0), n.onComplete?.();
		}
	});
}
//#endregion
//#region src/Rect.ts
function Te() {
	return m();
}
var P = class extends t {
	_width;
	_height;
	_fill;
	_fillAlpha;
	_strokeColor;
	_strokeWidth;
	_strokeAlpha;
	_cornerRadius;
	_rasterKey;
	_rasterEntry;
	geometry;
	material;
	mesh;
	textureManager;
	constructor(e) {
		super(e), this._width = e.width, this._height = e.height, this._fill = e.fill ?? "#ffffff", this._fillAlpha = e.fillAlpha ?? 1, this._strokeColor = e.strokeColor ?? null, this._strokeWidth = e.strokeWidth ?? 0, this._strokeAlpha = e.strokeAlpha ?? 1, this._cornerRadius = e.cornerRadius ?? 0, this._rasterKey = null, this._rasterEntry = null, this.textureManager = e.textureManager, this.material = new E({
			transparent: !0,
			depthTest: !1,
			depthWrite: !1
		}), this.geometry = new k(1, 1), this.mesh = new T(this.geometry, this.material), this.mesh.frustumCulled = !1, this.obj3d.add(this.mesh), e.interactive === !0 && this.setInteractive(this.computeAutoHitArea()), this.rebuild();
	}
	computeAutoHitArea() {
		return {
			x: -this._pivotX * this._width || 0,
			y: -this._pivotY * this._height || 0,
			width: this._width,
			height: this._height
		};
	}
	get width() {
		return this._width;
	}
	get height() {
		return this._height;
	}
	setSize(e, t) {
		return e === this._width && t === this._height ? this : (this._width = e, this._height = t, this.rebuild(), this._hitArea && this.setInteractive(this.computeAutoHitArea()), this);
	}
	setStyle(e) {
		return e.fill !== void 0 && (this._fill = e.fill), e.fillAlpha !== void 0 && (this._fillAlpha = e.fillAlpha), e.strokeColor !== void 0 && (this._strokeColor = e.strokeColor), e.strokeWidth !== void 0 && (this._strokeWidth = e.strokeWidth), e.strokeAlpha !== void 0 && (this._strokeAlpha = e.strokeAlpha), e.cornerRadius !== void 0 && (this._cornerRadius = e.cornerRadius), this.rebuild(), this;
	}
	setFill(e, t = 1) {
		return e === this._fill && t === this._fillAlpha ? this : (this._fill = e, this._fillAlpha = t, this.rebuild(), this);
	}
	setStroke(e, t = 1, n = 1) {
		return this._strokeColor = e, this._strokeWidth = t, this._strokeAlpha = n, this.rebuild(), this;
	}
	setCornerRadius(e) {
		return e === this._cornerRadius ? this : (this._cornerRadius = e, this.rebuild(), this);
	}
	rebuild() {
		if (this.isVisuallyEmpty()) {
			this._rasterKey !== null && (n(this._rasterKey), this._rasterKey = null, this._rasterEntry = null), this.material.map = null, this.material.needsUpdate = !0, this.mesh.visible = !1, this.mesh.scale.set(Math.max(1, this._width), Math.max(1, this._height), 1), this.applyMeshOffset();
			return;
		}
		let e = this.computeKey();
		if (e === this._rasterKey && this._rasterEntry) {
			this.mesh.scale.set(Math.max(1, this._width), Math.max(1, this._height), 1), this.applyMeshOffset();
			return;
		}
		let t = r(e, (e) => this.paintInto(e), this.textureManager, void 0, this.rasterDebugInfo());
		this._rasterKey !== null && n(this._rasterKey), this._rasterKey = e, this._rasterEntry = t, this.material.map = t.texture, this.material.needsUpdate = !0, this.mesh.visible = !0, this.mesh.scale.set(Math.max(1, this._width), Math.max(1, this._height), 1), this.applyMeshOffset();
	}
	isVisuallyEmpty() {
		let e = !!this._fill && this._fillAlpha > 0, t = !!this._strokeColor && this._strokeWidth > 0 && this._strokeAlpha > 0;
		return !e && !t;
	}
	computeKey() {
		if (this.usesStretchableSolidFill()) return JSON.stringify({
			w: 1,
			h: 1,
			pw: 1,
			ph: 1,
			f: this._fill,
			fa: this._fillAlpha,
			sc: null,
			sw: 0,
			sa: 0,
			cr: 0,
			d: 1
		});
		let e = this.resolvePixelSize();
		return JSON.stringify({
			w: this._width,
			h: this._height,
			pw: e.width,
			ph: e.height,
			f: this._fill,
			fa: this._fillAlpha,
			sc: this._strokeColor,
			sw: this._strokeWidth,
			sa: this._strokeAlpha,
			cr: this._cornerRadius,
			d: Te()
		});
	}
	paintInto(e) {
		let t = Math.max(1, this._width), n = Math.max(1, this._height);
		if (this.usesStretchableSolidFill()) {
			e.width = 1, e.height = 1;
			let t = this.textureManager.acquireCanvas2DContext(e);
			return t && (t.setTransform(1, 0, 0, 1, 0, 0), t.clearRect(0, 0, 1, 1), t.globalAlpha = this._fillAlpha, t.fillStyle = this._fill, t.fillRect(0, 0, 1, 1), t.globalAlpha = 1), {
				cssWidth: 1,
				cssHeight: 1
			};
		}
		let r = this.resolvePixelSize(), i = p(t, n, r);
		e.width = r.width, e.height = r.height;
		let a = this.textureManager.acquireCanvas2DContext(e);
		if (!a) return {
			cssWidth: t,
			cssHeight: n
		};
		a.setTransform(1, 0, 0, 1, 0, 0), a.scale(i.x, i.y), a.clearRect(0, 0, t, n);
		let o = Math.max(0, Math.min(this._cornerRadius, Math.min(t, n) / 2)), s = this._strokeColor ? this._strokeWidth / 2 : 0;
		return Ee(a, s, s, t - s * 2, n - s * 2, o), this._fill && this._fillAlpha > 0 && (a.globalAlpha = this._fillAlpha, a.fillStyle = this._fill, a.fill()), this._strokeColor && this._strokeWidth > 0 && (a.globalAlpha = this._strokeAlpha, a.strokeStyle = this._strokeColor, a.lineWidth = this._strokeWidth, a.stroke()), a.globalAlpha = 1, {
			cssWidth: t,
			cssHeight: n
		};
	}
	resolvePixelSize() {
		return this.usesStretchableSolidFill() ? {
			width: 1,
			height: 1
		} : this.textureManager.resolveTexturePixelSize({
			logicalWidth: Math.max(1, this._width),
			logicalHeight: Math.max(1, this._height),
			pixelRatio: Te(),
			rounding: "even"
		});
	}
	rasterDebugInfo() {
		return {
			kind: "Rect",
			label: this.name
		};
	}
	usesStretchableSolidFill() {
		let e = !!this._strokeColor && this._strokeWidth > 0 && this._strokeAlpha > 0;
		return !!this._fill && this._fillAlpha > 0 && !e && this._cornerRadius <= 0;
	}
	applyMeshOffset() {
		let e = this._width, t = this._height, n = (.5 - this._pivotX) * e, r = -((.5 - this._pivotY) * t);
		this.mesh.position.set(n, r, 0);
	}
	onPivotChanged() {
		this.applyMeshOffset(), this._hitArea && this.setInteractive(this.computeAutoHitArea());
	}
	applyMaterialAlpha(e) {
		this.material.opacity = e;
	}
	assignRenderOrderForSelf(e, t) {
		return this.mesh.renderOrder = t + e, e + 1;
	}
	setClippingPlanes(e) {
		super.setClippingPlanes(e), this.material.clippingPlanes = e ? e.slice() : null, this.material.clipShadows = !1, this.material.needsUpdate = !0;
	}
	setInteractive(e) {
		return super.setInteractive(e);
	}
	destroy() {
		this._rasterKey !== null && (n(this._rasterKey), this._rasterKey = null, this._rasterEntry = null), this.material.dispose(), this.geometry.dispose(), super.destroy();
	}
};
function Ee(e, t, n, r, i, a) {
	if (e.beginPath(), a <= 0) {
		e.rect(t, n, r, i);
		return;
	}
	e.moveTo(t + a, n), e.lineTo(t + r - a, n), e.arcTo(t + r, n, t + r, n + a, a), e.lineTo(t + r, n + i - a), e.arcTo(t + r, n + i, t + r - a, n + i, a), e.lineTo(t + a, n + i), e.arcTo(t, n + i, t, n + i - a, a), e.lineTo(t, n + a), e.arcTo(t, n, t + a, n, a), e.closePath();
}
//#endregion
//#region src/FlatPanelRect.ts
var De = class extends i {
	textureManager;
	_width;
	_height;
	_style;
	constructor(e) {
		super(e), this.textureManager = e.textureManager, this._width = Math.max(1, e.width), this._height = Math.max(1, e.height), this._style = Oe(e), this.rebuild();
	}
	get width() {
		return this._width;
	}
	get height() {
		return this._height;
	}
	setSize(e, t) {
		let n = Math.max(1, e), r = Math.max(1, t);
		return n === this._width && r === this._height ? this : (this._width = n, this._height = r, this.rebuild(), this);
	}
	setStyle(e) {
		return this._style = Oe({
			...this._style,
			...e
		}), this.rebuild(), this;
	}
	rebuild() {
		this.removeAll(!0);
		let { fill: e, fillAlpha: t, strokeColor: n, strokeAlpha: r, strokeWidth: i } = this._style;
		this.add(new P({
			x: 0,
			y: 0,
			width: this._width,
			height: this._height,
			fill: e,
			fillAlpha: t,
			originX: 0,
			originY: 0,
			textureManager: this.textureManager
		})), !(!n || i <= 0 || r <= 0) && (this.add(F(0, 0, this._width, i, this._style, this.textureManager)), this.add(F(0, this._height - i, this._width, i, this._style, this.textureManager)), this.add(F(0, 0, i, this._height, this._style, this.textureManager)), this.add(F(this._width - i, 0, i, this._height, this._style, this.textureManager)));
	}
};
function Oe(e) {
	return {
		fill: e.fill,
		fillAlpha: e.fillAlpha ?? 1,
		strokeColor: e.strokeColor ?? "",
		strokeAlpha: e.strokeAlpha ?? 1,
		strokeWidth: Math.max(0, e.strokeWidth ?? 0)
	};
}
function F(e, t, n, r, i, a) {
	return new P({
		x: e,
		y: t,
		width: n,
		height: r,
		fill: i.strokeColor,
		fillAlpha: i.strokeAlpha,
		originX: 0,
		originY: 0,
		textureManager: a
	});
}
//#endregion
//#region src/Image.ts
var ke = class extends t {
	_width;
	_height;
	_tint;
	texture;
	ownsTexture;
	releasesCanvasSources;
	textureManager;
	wrap;
	geometry;
	textureCrop;
	textureLowerFade;
	material;
	mesh;
	constructor(e) {
		super(e), je(e);
		let t = Me(e.source);
		this._width = e.width ?? t.width, this._height = e.height ?? t.height, this._tint = e.tint ?? 16777215;
		let n = e.releaseCanvasOnDestroy === !0, r = e.textureManager, { texture: i, owns: a } = Ne(e.source, n, r);
		this.texture = i, this.ownsTexture = a, this.releasesCanvasSources = n, this.textureManager = r, this.wrap = e.wrap, this.textureCrop = Re(e.textureCrop), this.textureLowerFade = ze(e.textureLowerFade), Fe(this.texture, this.wrap), this.material = new E({
			map: this.texture,
			transparent: !0,
			depthTest: !1,
			depthWrite: !1
		}), Ie(this.material, () => Le(this.textureCrop, this.textureLowerFade)), this.material.color.setHex(this._tint), this.geometry = new k(1, 1), Be(this.geometry, this.textureCrop), this.mesh = new T(this.geometry, this.material), this.mesh.frustumCulled = !1, this.obj3d.add(this.mesh), this.mesh.scale.set(Math.max(1, this._width), Math.max(1, this._height), 1), this.applyMeshOffset(), e.interactive === !0 && this.setInteractive(this.computeAutoHitArea());
	}
	computeAutoHitArea() {
		return {
			x: -this._pivotX * this._width || 0,
			y: -this._pivotY * this._height || 0,
			width: this._width,
			height: this._height
		};
	}
	get width() {
		return this._width;
	}
	get height() {
		return this._height;
	}
	setSize(e, t) {
		return e === this._width && t === this._height ? this : (this._width = e, this._height = t, this.mesh.scale.set(Math.max(1, e), Math.max(1, t), 1), this.applyMeshOffset(), this._hitArea && this.setInteractive(this.computeAutoHitArea()), this);
	}
	setTint(e) {
		return e === this._tint ? this : (this._tint = e, this.material.color.setHex(e), this);
	}
	invalidateTexture() {
		return this.texture.needsUpdate = !0, this;
	}
	replaceCanvasSource(e) {
		let t = Pe(e, this.releasesCanvasSources, this.textureManager);
		return this.replaceTexture(t, !0), this;
	}
	replaceElementSource(e) {
		let t = new ne(e);
		return t.needsUpdate = !0, this.replaceTexture(t, !0), this;
	}
	setTextureCrop(e) {
		let t = Re(e);
		return t.x === this.textureCrop.x && t.y === this.textureCrop.y && t.width === this.textureCrop.width && t.height === this.textureCrop.height ? this : (this.textureCrop = t, Be(this.geometry, this.textureCrop), this.material.needsUpdate = !0, this);
	}
	setTextureLowerFade(e) {
		let t = ze(e);
		return t?.startY === this.textureLowerFade?.startY ? this : (this.textureLowerFade = t, this.material.needsUpdate = !0, this);
	}
	applyMeshOffset() {
		let e = this._width, t = this._height, n = (.5 - this._pivotX) * e, r = -((.5 - this._pivotY) * t);
		this.mesh.position.set(n, r, 0);
	}
	onPivotChanged() {
		this.applyMeshOffset();
	}
	applyMaterialAlpha(e) {
		this.material.opacity = e;
	}
	assignRenderOrderForSelf(e, t) {
		return this.mesh.renderOrder = t + e, e + 1;
	}
	setClippingPlanes(e) {
		super.setClippingPlanes(e), this.material.clippingPlanes = e ? e.slice() : null, this.material.needsUpdate = !0;
	}
	destroy() {
		let e = this.texture, t = this.ownsTexture;
		this.material.map = null, this.material.needsUpdate = !0, this.material.dispose(), Ae(e, t), this.geometry.dispose(), super.destroy();
	}
	replaceTexture(e, t) {
		let n = this.texture, r = this.ownsTexture;
		this.texture = e, this.ownsTexture = t, Fe(this.texture, this.wrap), this.material.map = this.texture, this.material.needsUpdate = !0, this.texture.needsUpdate = !0, Ae(n, r);
	}
};
function Ae(e, t) {
	t && e.dispose();
}
function je(e) {
	if (e.releaseCanvasOnDestroy === !0 && e.source.kind !== "canvas") throw Error("R3Image: releaseCanvasOnDestroy requires a canvas source owned by the image.");
}
function Me(e) {
	if (e.kind === "element") return {
		width: e.element.naturalWidth || e.element.width || 1,
		height: e.element.naturalHeight || e.element.height || 1
	};
	if (e.kind === "canvas") return {
		width: e.canvas.width,
		height: e.canvas.height
	};
	let t = e.texture.image;
	return {
		width: t?.width ?? 1,
		height: t?.height ?? 1
	};
}
function Ne(e, t, n) {
	if (e.kind === "texture") return {
		texture: e.texture,
		owns: !1
	};
	if (e.kind === "canvas") return {
		texture: Pe(e.canvas, t, n),
		owns: !0
	};
	let r = new ne(e.element);
	return r.needsUpdate = !0, {
		texture: r,
		owns: !0
	};
}
function Pe(e, t, n) {
	return t ? n.createOwnedCanvasTexture(e) : n.createBorrowedCanvasTexture(e);
}
function Fe(e, t) {
	e.colorSpace = ee, e.minFilter = C, e.magFilter = C, e.generateMipmaps = !1, t !== void 0 && (e.wrapS = t, e.wrapT = t);
}
function Ie(e, t) {
	e.onBeforeCompile = (t) => {
		t.uniforms.uR3TextureLowerFadeStartV = { value: -1 }, t.uniforms.uR3TextureLowerFadeEndV = { value: -1 }, t.fragmentShader = t.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uR3TextureLowerFadeStartV;\nuniform float uR3TextureLowerFadeEndV;").replace("#include <alphamap_fragment>", "#include <alphamap_fragment>\nif (uR3TextureLowerFadeStartV >= 0.0) {\n  float r3LowerFadeAlpha = smoothstep(uR3TextureLowerFadeEndV, uR3TextureLowerFadeStartV, vMapUv.y);\n  diffuseColor.a *= r3LowerFadeAlpha;\n}"), e.userData.r3TextureLowerFadeUniforms = t.uniforms;
	}, e.onBeforeRender = () => {
		let n = e.userData.r3TextureLowerFadeUniforms;
		if (!n?.uR3TextureLowerFadeStartV || !n.uR3TextureLowerFadeEndV) return;
		let r = t();
		n.uR3TextureLowerFadeStartV.value = r.startV, n.uR3TextureLowerFadeEndV.value = r.endV;
	}, e.customProgramCacheKey = () => "r3-image-texture-lower-fade-v1";
}
function Le(e, t) {
	if (!t) return {
		startV: -1,
		endV: -1
	};
	let n = 1 - e.y, r = 1 - e.y - e.height;
	return {
		startV: n - e.height * t.startY,
		endV: r
	};
}
function Re(e) {
	if (!e) return {
		x: 0,
		y: 0,
		width: 1,
		height: 1
	};
	let t = I(e.x), n = I(e.y);
	return {
		x: t,
		y: n,
		width: Math.max(.01, Math.min(I(e.width), 1 - t)),
		height: Math.max(.01, Math.min(I(e.height), 1 - n))
	};
}
function ze(e) {
	return e ? { startY: I(e.startY) } : null;
}
function Be(e, t) {
	let n = t.x, r = t.x + t.width, i = 1 - t.y, a = 1 - t.y - t.height;
	e.setAttribute("uv", new S(new Float32Array([
		n,
		i,
		r,
		i,
		n,
		a,
		r,
		a
	]), 2));
	let o = e.getAttribute("uv");
	o.needsUpdate = !0;
}
function I(e) {
	return Math.min(1, Math.max(0, e));
}
//#endregion
//#region src/text-metrics.ts
var Ve = new Set(/* @__PURE__ */ "、(。(，(．(,(.(・(･(：(:(；(;(？(?(！(!(‼(⁇(⁈(⁉(）()(］(](｝(}(」(』(〕(〉(》(〙(〗(»(›(’(”(｠(〟(ﾞ(ﾟ(ー(～(〜(ゝ(ゞ(ヽ(ヾ(々(〻(…(‥(—(―(–(‐(ぁ(ぃ(ぅ(ぇ(ぉ(っ(ゃ(ゅ(ょ(ゎ(ゕ(ゖ(ァ(ィ(ゥ(ェ(ォ(ッ(ャ(ュ(ョ(ヮ(ヵ(ヶ(ｧ(ｨ(ｩ(ｪ(ｫ(ｬ(ｭ(ｮ(ｯ(ｰ".split("(")), He = new Set([
	"（",
	"(",
	"［",
	"[",
	"｛",
	"{",
	"「",
	"『",
	"〔",
	"〈",
	"《",
	"〘",
	"〖",
	"«",
	"‹",
	"‘",
	"“",
	"｟",
	"〝"
]);
function Ue(e, t) {
	let { maxWidth: n, measure: r } = t;
	if (e.length === 0) return [{
		text: "",
		width: 0
	}];
	let i = [], a = e.split("\n");
	for (let e of a) {
		let t = Ke(e, n, r);
		for (let e of t) i.push(e);
	}
	return i;
}
function L(e, t) {
	let n = e.join("");
	return {
		text: n,
		width: t(n)
	};
}
function We(e, t) {
	return Array.from({ length: e.length }, (t, n) => e.length - n).find((n) => {
		let r = n < e.length ? e[n] : t, i = e[n - 1];
		return r !== void 0 && i !== void 0 && !Ve.has(r) && !He.has(i);
	}) ?? 0;
}
function Ge(e, t) {
	if (e[t] === void 0) return {
		consumed: [],
		nextIndex: t
	};
	let n = (() => {
		let n = e.slice(t + 1), r = n.findIndex((e) => !Ve.has(e));
		return r === -1 ? n.length : r;
	})();
	return {
		consumed: e.slice(t, t + 1 + n),
		nextIndex: t + 1 + n
	};
}
function R(e, t, n, r, i, a) {
	if (t >= e.length) return n.length > 0 ? [...a, L(n, i)] : a;
	let o = e[t];
	if (o === void 0) return R(e, t + 1, n, r, i, a);
	let s = [...n, o];
	if (i(s.join("")) <= r) return R(e, t + 1, s, r, i, a);
	if (n.length === 0) return R(e, t + 1, [], r, i, [...a, L(s, i)]);
	let c = We(n, o);
	if (c === 0) {
		let o = Ge(e, t);
		return R(e, o.nextIndex, [], r, i, [...a, L([...n, ...o.consumed], i)]);
	}
	return R(e, t, n.slice(c), r, i, [...a, L(n.slice(0, c), i)]);
}
function Ke(e, t, n) {
	return e.length === 0 ? [{
		text: "",
		width: 0
	}] : !Number.isFinite(t) || t <= 0 ? [{
		text: e,
		width: n(e)
	}] : qe([...R(Array.from(e), 0, [], t, n, [])], n);
}
function qe(e, t) {
	if (e.length < 2) return e;
	let n = e.map((e) => ({
		text: e.text,
		width: e.width
	}));
	for (let e = 1; e < n.length; e += 1) {
		let r = n[e], i = n[e - 1];
		if (!r || !i) continue;
		let a = Array.from(r.text), o = Array.from(i.text);
		if (a.length !== 1 || o.length <= 1 || !Je(a[0] ?? "") || !Je(o[o.length - 1] ?? "")) continue;
		let s = o[o.length - 2];
		if (s !== void 0 && He.has(s)) continue;
		let c = o.pop();
		if (!c) continue;
		let l = o.join(""), u = c + r.text;
		n[e - 1] = {
			text: l,
			width: t(l)
		}, n[e] = {
			text: u,
			width: t(u)
		};
	}
	return n.filter((e) => e.text.length > 0);
}
function Je(e) {
	return /\p{Script=Han}/u.test(e);
}
function Ye(e) {
	return `${e.style ?? "normal"} ${String(e.weight ?? "normal")} ${String(e.size)}px ${e.family}`;
}
function Xe(e, t) {
	let n = e.actualBoundingBoxAscent ?? t * .8, r = e.actualBoundingBoxDescent ?? t * .2;
	return {
		width: e.width,
		ascent: n,
		descent: r
	};
}
//#endregion
//#region src/text-raster.ts
var Ze = 1.2, Qe = 2, $e = 0, et = "Hgあア漢国Ｍ";
function tt(e, t) {
	if (!("letterSpacing" in e)) return;
	let n = e;
	n.letterSpacing = `${String(t)}px`;
}
function nt() {
	return m();
}
var z = { contexts: /* @__PURE__ */ new WeakMap() };
function rt(e) {
	if (z.contexts.has(e)) return z.contexts.get(e) ?? null;
	let t = it(e);
	if (!t) return z.contexts.set(e, null), null;
	let n = e.acquireCanvas2DContext(t);
	return n ? (z.contexts.set(e, n), n) : (z.contexts.set(e, null), null);
}
function it(e) {
	try {
		return e.createCanvas(1, 1);
	} catch (e) {
		return console.info("failed to create measurement canvas", e), null;
	}
}
function at(e) {
	let t = {
		t: e.text,
		f: e.font,
		c: e.color,
		a: e.align ?? "left",
		lh: e.lineHeight ?? Ze,
		mw: e.maxWidth === void 0 || e.maxWidth === Infinity ? -1 : e.maxWidth,
		ml: e.maxLines === void 0 || e.maxLines === Infinity ? -1 : e.maxLines,
		el: e.ellipsis ?? !0,
		p: e.padding ?? Qe,
		s: e.stroke ?? null,
		ls: e.letterSpacing ?? $e,
		d: e.dpr ?? nt()
	};
	return `text:${JSON.stringify(t)}`;
}
function ot(e, t, n) {
	let r = t.dpr ?? nt(), i = n.acquireCanvas2DContext(e);
	if (!i) {
		let e = st(t, null, n);
		return {
			cssWidth: e.cssWidth,
			cssHeight: e.cssHeight,
			lines: e.lines
		};
	}
	let a = st(t, i, n), o = n.resolveTexturePixelSize({
		logicalWidth: a.cssWidth,
		logicalHeight: a.cssHeight,
		pixelRatio: r,
		rounding: "even"
	}), s = p(a.cssWidth, a.cssHeight, o);
	return e.width = o.width, e.height = o.height, i.setTransform(1, 0, 0, 1, 0, 0), i.scale(s.x, s.y), i.clearRect(0, 0, a.cssWidth, a.cssHeight), ct(i, a), {
		cssWidth: a.cssWidth,
		cssHeight: a.cssHeight,
		lines: a.lines
	};
}
function st(e, t = null, n) {
	let r = e.align ?? "left", i = e.lineHeight ?? Ze, a = e.padding ?? Qe, o = e.maxWidth ?? Infinity, s = e.maxLines ?? Infinity, c = e.ellipsis ?? !0, l = e.stroke ?? null, u = e.letterSpacing ?? $e, d = Ye(e.font), f = (n ? rt(n) : null) ?? t;
	if (!f) return ut({
		spec: e,
		align: r,
		lineHeight: i,
		padding: a,
		stroke: l,
		letterSpacing: u,
		fontShorthand: d
	});
	f.font = d, tt(f, u);
	let p = dt({
		text: e.text,
		maxWidth: o,
		maxLines: s,
		ellipsis: c,
		measure: (e) => e.length === 0 ? 0 : f.measureText(e).width
	}), m = _t(f, e.font.size), h = m.ascent, g = m.descent, _ = e.font.size * i, v = p.reduce((e, t) => Math.max(e, t.width), 0), y = Math.max(1, Math.ceil(v + a * 2)), b = gt(p.length, h, g, _);
	return {
		cssWidth: y,
		cssHeight: Math.max(1, Math.ceil(b + a * 2)),
		lines: p,
		fontShorthand: d,
		align: r,
		padding: a,
		ascent: h,
		lineAdvance: _,
		color: e.color,
		stroke: l,
		letterSpacing: u
	};
}
function ct(e, t) {
	e.font = t.fontShorthand, tt(e, t.letterSpacing), e.textBaseline = "alphabetic", e.textAlign = "left", e.fillStyle = t.color, t.stroke && (e.strokeStyle = t.stroke.color, e.lineWidth = t.stroke.width, e.lineJoin = "round"), t.lines.forEach((n, r) => {
		let i = t.padding + t.ascent + r * t.lineAdvance, a = ht(t.align, t.padding, t.cssWidth, n.width);
		t.stroke && e.strokeText(n.text, a, i), e.fillText(n.text, a, i);
	});
}
function lt(e, t) {
	return r(at(e), (n) => {
		let { cssWidth: r, cssHeight: i } = ot(n, e, t);
		return {
			cssWidth: r,
			cssHeight: i
		};
	}, t);
}
function ut(e) {
	let t = [{
		text: e.spec.text,
		width: e.spec.text.length * e.spec.font.size * .5
	}];
	return {
		cssWidth: Math.max(1, Math.ceil((t[0]?.width ?? 1) + e.padding * 2)),
		cssHeight: Math.max(1, Math.ceil(e.spec.font.size * e.lineHeight + e.padding * 2)),
		lines: t,
		fontShorthand: e.fontShorthand,
		align: e.align,
		padding: e.padding,
		ascent: e.spec.font.size * .8,
		lineAdvance: e.spec.font.size * e.lineHeight,
		color: e.spec.color,
		stroke: e.stroke,
		letterSpacing: e.letterSpacing
	};
}
function dt(e) {
	return ft(e.text, e.maxWidth, e.maxLines) ? [{
		text: e.text,
		width: e.measure(e.text)
	}] : pt(Ue(e.text, {
		maxWidth: e.maxWidth,
		measure: e.measure
	}), e.maxLines, e.ellipsis, e.maxWidth, e.measure);
}
function ft(e, t, n) {
	return e.includes("\n") || Number.isFinite(t) ? !1 : !Number.isFinite(n) || n >= 1;
}
function pt(e, t, n, r, i) {
	if (!Number.isFinite(t) || t <= 0 || e.length <= t) return e;
	let a = e.slice(0, Math.max(0, t - 1)), o = e.slice(Math.max(0, t - 1)).map((e) => e.text).join("");
	if (!n) {
		let e = a.slice();
		return e.length < t && o.length > 0 && e.push({
			text: o,
			width: i(o)
		}), e;
	}
	let s = mt(o, r, i);
	return a.push({
		text: s,
		width: i(s)
	}), a;
}
function mt(e, t, n) {
	if (!Number.isFinite(t) || n(e) <= t) return e;
	let r = Array.from(e);
	for (; r.length > 0;) {
		r.pop();
		let e = `${r.join("")}…`;
		if (n(e) <= t) return e;
	}
	return "…";
}
function ht(e, t, n, r) {
	return e === "center" ? (n - r) / 2 : e === "right" ? n - t - r : t;
}
function gt(e, t, n, r) {
	return e === 0 ? t + n : t + n + (e - 1) * r;
}
function _t(e, t) {
	return Xe(e.measureText(et), t);
}
//#endregion
//#region src/Text.ts
var B = class extends t {
	_text;
	_font;
	_color;
	_align;
	_lineHeight;
	_letterSpacing;
	_maxWidth;
	_maxLines;
	_ellipsis;
	_padding;
	_stroke;
	_lines;
	_cssWidth;
	_cssHeight;
	_rasterKey;
	_rasterEntry;
	geometry;
	material;
	mesh;
	textureManager;
	constructor(e) {
		super(e), this._text = e.text ?? "", this._font = e.font, this._color = e.color ?? "#ffffff", this._align = e.align ?? "left", this._lineHeight = e.lineHeight ?? 1.2, this._letterSpacing = e.letterSpacing ?? 0, this._maxWidth = e.maxWidth ?? Infinity, this._maxLines = e.maxLines ?? Infinity, this._ellipsis = e.ellipsis ?? !0, this._padding = e.padding ?? 2, this._stroke = e.stroke ?? null, this._lines = [], this._cssWidth = 0, this._cssHeight = 0, this._rasterKey = null, this._rasterEntry = null, this.textureManager = e.textureManager, this.material = new E({
			transparent: !0,
			depthTest: !1,
			depthWrite: !1
		}), this.geometry = new k(1, 1), this.mesh = new T(this.geometry, this.material), this.mesh.frustumCulled = !1, this.obj3d.add(this.mesh), this.rebuild();
	}
	get text() {
		return this._text;
	}
	setText(e) {
		return e === this._text ? this : (this._text = e, this.rebuild(), this);
	}
	setColor(e) {
		return e === this._color ? this : (this._color = e, this.rebuild(), this);
	}
	setStyle(e) {
		return this._font = e, this.rebuild(), this;
	}
	setAlign(e) {
		return e === this._align ? this : (this._align = e, this.rebuild(), this);
	}
	setMaxWidth(e) {
		return e === this._maxWidth ? this : (this._maxWidth = e, this.rebuild(), this);
	}
	setMaxLines(e) {
		return e === this._maxLines ? this : (this._maxLines = e, this.rebuild(), this);
	}
	setLineHeight(e) {
		return e === this._lineHeight ? this : (this._lineHeight = e, this.rebuild(), this);
	}
	setLetterSpacing(e) {
		return e === this._letterSpacing ? this : (this._letterSpacing = e, this.rebuild(), this);
	}
	setStroke(e) {
		return this._stroke = e, this.rebuild(), this;
	}
	get width() {
		return this._cssWidth;
	}
	get height() {
		return this._cssHeight;
	}
	get lines() {
		return this._lines;
	}
	rebuild() {
		let e = this.currentSpec(), t = at(e);
		if (t === this._rasterKey && this._rasterEntry) return;
		let r = lt(e, this.textureManager);
		this._rasterKey !== null && n(this._rasterKey), this._rasterKey = t, this._rasterEntry = r, this._cssWidth = r.cssWidth, this._cssHeight = r.cssHeight, this.material.map = r.texture, this.material.needsUpdate = !0, this.mesh.scale.set(Math.max(1, r.cssWidth), Math.max(1, r.cssHeight), 1), this.applyMeshOffset();
	}
	currentSpec() {
		return {
			text: this._text,
			font: this._font,
			color: this._color,
			align: this._align,
			lineHeight: this._lineHeight,
			letterSpacing: this._letterSpacing,
			maxWidth: this._maxWidth,
			maxLines: this._maxLines,
			ellipsis: this._ellipsis,
			padding: this._padding,
			stroke: this._stroke
		};
	}
	applyMeshOffset() {
		let e = this._cssWidth, t = this._cssHeight, n = (.5 - this._pivotX) * e, r = -((.5 - this._pivotY) * t);
		this.mesh.position.set(n, r, 0);
	}
	onPivotChanged() {
		this.applyMeshOffset();
	}
	applyMaterialAlpha(e) {
		this.material.opacity = e;
	}
	assignRenderOrderForSelf(e, t) {
		return this.mesh.renderOrder = t + e, e + 1;
	}
	setClippingPlanes(e) {
		super.setClippingPlanes(e), this.material.clippingPlanes = e ? e.slice() : null, this.material.needsUpdate = !0;
	}
	destroy() {
		this._rasterKey !== null && (n(this._rasterKey), this._rasterKey = null, this._rasterEntry = null), this.material.dispose(), this.geometry.dispose(), super.destroy();
	}
}, vt = class {
	stage;
	root;
	disposers;
	name;
	_active;
	constructor(e, t) {
		this.stage = e, this.name = t, this.root = new i({ name: `r3:scene:${t}` }), this.disposers = [], this._active = !1;
	}
	get active() {
		return this._active;
	}
	setDepth(e) {
		return this.root.setDepth(e), this;
	}
	enter(e) {
		this._active || (this._active = !0, this.stage.root.add(this.root), this.onEnter(e));
	}
	update(e) {}
	exit() {
		if (this._active) {
			this._active = !1, this.onExit();
			for (let e of this.disposers) e();
			this.disposers.length = 0, this.root.destroy();
		}
	}
	onEnter(e) {}
	onExit() {}
	onPointer(e, t) {
		let n = this.stage.pointer.on(e, (e) => {
			t(e);
		});
		this.disposers.push(n);
	}
	addDisposer(e) {
		this.disposers.push(e);
	}
}, yt = class {
	stage;
	slots;
	active;
	enterListeners;
	constructor(e) {
		this.stage = e, this.slots = /* @__PURE__ */ new Map(), this.active = /* @__PURE__ */ new Set(), this.enterListeners = [];
	}
	onSceneEnter(e) {
		return this.enterListeners.push(e), () => {
			let t = this.enterListeners.indexOf(e);
			t !== -1 && this.enterListeners.splice(t, 1);
		};
	}
	register(e) {
		let t = this.slots.get(e.key);
		return t && (t.instance && this.active.has(t.instance) && (t.instance.exit(), this.active.delete(t.instance)), t.instance = null), this.slots.set(e.key, {
			registration: e,
			instance: null
		}), this;
	}
	start(e, t, n = {}) {
		let r = this.slots.get(e);
		if (!r) throw Error(`SceneManager.start: no scene registered for "${e}"`);
		n.replace === !0 && this.stopAll(), n.recreate === !0 && r.instance && (this.active.has(r.instance) && (r.instance.exit(), this.active.delete(r.instance)), r.instance = null);
		let i = r.instance ?? r.registration.factory(this.stage, e);
		r.instance = i, this.active.has(i) && (i.exit(), this.active.delete(i)), r.registration.depth !== void 0 && i.setDepth(r.registration.depth);
		for (let t of this.enterListeners) t(e);
		return i.enter(t ?? {}), this.active.add(i), i;
	}
	stop(e) {
		let t = this.slots.get(e);
		!t || !t.instance || this.active.has(t.instance) && (t.instance.exit(), this.active.delete(t.instance));
	}
	stopAll() {
		let e = Array.from(this.active);
		for (let t of e) t.exit();
		this.active.clear();
	}
	isActive(e) {
		let t = this.slots.get(e);
		return !t || !t.instance ? !1 : this.active.has(t.instance);
	}
	get(e) {
		return this.slots.get(e)?.instance ?? null;
	}
	get activeScenes() {
		return Array.from(this.active);
	}
	update(e) {
		for (let t of this.active) t.update(e);
	}
}, V = { palette: {
	INK_ABYSS: "#030304",
	INK_OVERLAY: "#050507",
	INK_SCENE: "#08090c",
	INK_VIEWPORT: "#0b0c10",
	INK_PANEL: "#101218",
	INK_CARD: "#0e1014",
	INK_BUTTON: "#171a22",
	INK_TEXT: "#14161c",
	INK_BUTTON_HOVER: "#222633",
	INK_DISABLED_FILL: "#1c1e24",
	INK_SKILL_SOFT: "#272a33",
	BROWN_TAB_DISABLED: "#565a64",
	BROWN_SOFT: "#5d6470",
	BROWN_BORDER: "#3d4350",
	BROWN_HINT: "#6f7682",
	BROWN_DISABLED: "#646a76",
	BROWN_DIM: "#838a98",
	BROWN_CELL_FIXED: "#8d94a2",
	GOLD: "#b8862c",
	GOLD_HOVER: "#d6a544",
	GOLD_LIGHT: "#e8c87e",
	GOLD_LIGHTEST: "#f2dba0",
	CREAM_TEXT: "#d6d2c6",
	CREAM_CARD: "#d8d4c8",
	CREAM_ROW: "#c4c0b4",
	CREAM_CELL_EDITABLE: "#cac6ba",
	CREAM_STAT_LABEL: "#bcb8ac",
	CREAM_HIGHLIGHT: "#cfcaba",
	CREAM_HOVER: "#e2ddcd",
	CREAM_HERO: "#efe9d8",
	CREAM_COMPATIBLE: "#dedacd",
	CREAM_STAT_VALUE: "#f4efe0",
	CREAM_DIM: "#9a968c",
	STAMP_TEXT: "#f2ead0",
	SKILL_MISSING: "#efeae0",
	SETTINGS_BORDER: "#4a505c",
	WHITE: "#ffffff",
	BLACK: "#000000",
	CUTIN_ACCENT: "#ffd98c",
	VICTORY_TOTAL: "#a31f1f",
	DEFEAT: "#8c1a1a",
	STAMP_STROKE: "#6e1410",
	RARITY_COMMON_FILL: "#5a2a22",
	RARITY_COMMON_TEXT: "#f2ead8",
	RARITY_RARE_FILL: "#2c3c58",
	RARITY_RARE_TEXT: "#eef2fa"
} }, H = V.palette, bt = { table: xt(V.palette) }, U = bt.table;
function xt(e) {
	let t = Object.entries(e).map(([e, t]) => [e, Number.parseInt(t.slice(1), 16)]);
	return Object.fromEntries(t);
}
function St(e) {
	Object.assign(V.palette, e), Object.assign(bt.table, xt(V.palette));
}
//#endregion
//#region src/theme/typography.ts
var Ct = { stacks: {
	MINCHO: "'Shippori Mincho B1', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
	SANS_DISPLAY: "'Helvetica Neue', 'Arial Black', 'Arial', sans-serif"
} }, W = Ct.stacks;
function wt(e) {
	Object.assign(Ct.stacks, e);
}
//#endregion
//#region src/theme/index.ts
function Tt(e) {
	e.colors && St(e.colors), e.fonts && wt(e.fonts);
}
//#endregion
//#region src/SceneTransition.ts
var Et = 360, Dt = 420, Ot = 9e3;
function kt(e) {
	let t = e.fadeOutMs ?? Et, n = e.fadeInMs ?? Dt, { width: r, height: a } = e.stage.screen, o = new i({ name: "r3:fade-overlay" });
	o.setDepth(Ot);
	let s = new P({
		x: 0,
		y: 0,
		width: r,
		height: a,
		fill: H.BLACK,
		fillAlpha: 1,
		interactive: !0,
		alpha: 0,
		textureManager: e.textureManager
	});
	o.add(s), e.stage.root.add(o), e.stage.tweens.add({
		targets: s,
		alpha: 1,
		duration: t,
		ease: "Quad.easeIn",
		onComplete: () => {
			let t = e.startOptions ?? { replace: !0 };
			e.scenes.start(e.toKey, e.payload, t), e.stage.tweens.add({
				targets: s,
				alpha: 0,
				duration: n,
				ease: "Quad.easeOut",
				onComplete: () => {
					o.destroy();
				}
			});
		}
	});
}
function At(e, t, n = Dt) {
	let r = new i({ name: "r3:fade-in-overlay" });
	r.setDepth(Ot);
	let a = new P({
		x: 0,
		y: 0,
		width: e.screen.width,
		height: e.screen.height,
		fill: H.BLACK,
		fillAlpha: 1,
		interactive: !0,
		alpha: 1,
		textureManager: t
	});
	r.add(a), e.root.add(r), e.tweens.add({
		targets: a,
		alpha: 0,
		duration: n,
		ease: "Quad.easeOut",
		onComplete: () => {
			r.destroy();
		}
	});
}
//#endregion
//#region src/audio.ts
var jt = { player: null };
function Mt(e) {
	jt.player = e;
}
function G(e) {
	jt.player && jt.player(e);
}
//#endregion
//#region src/widgets/Button.ts
var Nt = H.GOLD, Pt = H.GOLD_HOVER, Ft = H.INK_TEXT, It = H.INK_BUTTON, Lt = H.INK_BUTTON_HOVER, Rt = H.CREAM_TEXT, zt = H.GOLD, Bt = H.INK_DISABLED_FILL, Vt = H.BROWN_DISABLED, Ht = .97, Ut = 80, Wt = W.MINCHO, Gt = "title-button-hover";
function Kt(e) {
	return e === "primary" ? {
		fill: Nt,
		hover: Pt,
		text: Ft
	} : {
		fill: It,
		hover: Lt,
		text: Rt
	};
}
function qt(e) {
	return e === void 0 ? "title-button-click" : e;
}
function Jt(e) {
	return Math.max(16, Math.floor(e * .38));
}
function Yt(e) {
	let t = Kt(e.variant ?? "secondary"), n = {
		width: e.width,
		height: e.height
	}, r = be({
		x: e.x,
		y: e.y,
		width: n.width,
		height: n.height,
		name: "r3:button",
		pivotName: "r3:button-pivot"
	}), { root: i, pivot: a } = r, o = new P({
		width: n.width,
		height: n.height,
		fill: t.fill,
		fillAlpha: 1,
		strokeColor: zt,
		strokeWidth: 2,
		strokeAlpha: 1,
		originX: .5,
		originY: .5,
		interactive: !0,
		textureManager: e.textureManager
	});
	a.add(o);
	let s = new B({
		text: e.label,
		font: {
			family: Wt,
			size: Jt(n.height),
			weight: "bold"
		},
		color: t.text,
		originX: .5,
		originY: .5,
		textureManager: e.textureManager
	});
	a.add(s);
	let c = { disabled: e.disabled === !0 };
	function l() {
		return {
			x: -n.width / 2,
			y: -n.height / 2,
			width: n.width,
			height: n.height
		};
	}
	function u() {
		if (c.disabled) {
			o.setFill(Bt, 1), s.setColor(Vt), o.setInteractive(null);
			return;
		}
		o.setFill(t.fill, 1), s.setColor(t.text), o.setInteractive(l());
	}
	return u(), o.on("pointerover", () => {
		c.disabled || (o.setFill(t.hover, 1), G(Gt));
	}), o.on("pointerout", () => {
		c.disabled || o.setFill(t.fill, 1);
	}), o.on("pointerdown", () => {
		c.disabled || Xt(a, e.tweens);
	}), o.on("click", () => {
		if (c.disabled) return;
		let t = qt(e.clickSfx);
		t !== null && G(t), e.onClick();
	}), {
		node: i,
		setDisabled(e) {
			c.disabled = e, u();
		},
		setLabel(e) {
			s.setText(e);
		},
		setRect(e, t, i, a) {
			n.width = i, n.height = a, r.setRect(e, t, i, a), o.setSize(i, a), s.setStyle({
				family: Wt,
				size: Jt(a),
				weight: "bold"
			}), c.disabled || o.setInteractive(l());
		},
		getRect() {
			return r.getRect();
		},
		destroy() {
			e.tweens?.killTweensOf(a), i.destroy();
		}
	};
}
function Xt(e, t) {
	Ce(e, t, {
		scale: Ht,
		durationMs: Ut
	});
}
//#endregion
//#region src/image-loading/index.ts
function Zt() {
	let e = /* @__PURE__ */ new Map();
	function t(e) {
		let t = Array.from(e.listeners);
		e.listeners.clear();
		for (let e of t) e();
	}
	function n(n) {
		let r = e.get(n);
		if (r) return r;
		let i = new Image(), a = {
			image: i,
			loaded: !1,
			failed: !1,
			listeners: /* @__PURE__ */ new Set()
		};
		return i.addEventListener("load", () => {
			a.loaded = !0, t(a);
		}), i.addEventListener("error", () => {
			a.failed = !0, t(a);
		}), i.src = n, e.set(n, a), a;
	}
	function r(e, t) {
		let r = n(e);
		if (r.loaded) return t(), () => void 0;
		if (r.failed) return () => void 0;
		let i = () => {
			r.loaded && t();
		};
		return r.listeners.add(i), () => {
			r.listeners.delete(i);
		};
	}
	return {
		ensureImage: n,
		onAssetReady: r
	};
}
var Qt = { provider: Zt() };
function $t(e) {
	Qt.provider = e;
}
function en(e) {
	return Qt.provider.ensureImage(e);
}
function tn(e, t) {
	return Qt.provider.onAssetReady(e, t);
}
//#endregion
//#region src/widgets/Panel.ts
function nn(e) {
	let { x: t, y: n, width: r, height: i, radius: a, fill: o, fillAlpha: c = 1, border: l, borderAlpha: u = 1, borderWidth: d = 1, flatTop: f = !1, innerOutline: p } = e, m = new s({
		x: t,
		y: n,
		width: r,
		height: i,
		originX: 0,
		originY: 0,
		textureManager: e.textureManager
	});
	if (m.fillStyle(o, c), m.fillRoundedRect(0, 0, r, i, a), f && m.fillRect(0, 0, r, a), m.lineStyle(d, l, u), m.strokeRoundedRect(0, 0, r, i, a), f && m.strokeLine(0, 0, r, 0), p) {
		let e = p.inset ?? 4, t = Math.max(0, r - e * 2), n = Math.max(0, i - e * 2), o = Math.max(0, a - e);
		t > 0 && n > 0 && (m.lineStyle(p.width ?? 1, p.color, p.alpha ?? 1), m.strokeRoundedRect(e, e, t, n, o));
	}
	return m;
}
var rn = 1182983, an = 12554810, on = 8018482, sn = "textures/hud-panel-bg", cn = 256, ln = .35, K = 4;
function un(e, t, n, r, i, a) {
	e.clear(), e.fillStyle(rn, 1), e.fillRoundedRect(0, 0, t, n, r), a && e.fillRect(0, 0, t, r), i && e.fillPatternRoundedRect(0, 0, t, n, r, i, ln, cn, cn), e.lineStyle(1, an, .95), e.strokeRoundedRect(0, 0, t, n, r), a && e.strokeLine(0, 0, t, 0);
	let o = t - K * 2, s = n - K * 2;
	o > 0 && s > 0 && (e.lineStyle(1, on, .8), e.strokeRoundedRect(K, K, o, s, Math.max(0, r - K)), a && e.strokeLine(K, K, K + o, K));
}
var dn = class extends i {
	disposers = [];
	addDisposer(e) {
		this.disposers.push(e);
	}
	destroy() {
		for (let e of this.disposers) e();
		this.disposers.length = 0, super.destroy();
	}
};
function fn(e) {
	let t = e.radius ?? 12, n = e.flatTop ?? !1, { width: r, height: i } = e, a = new dn({
		x: e.x,
		y: e.y
	}), o = new s({
		x: 0,
		y: 0,
		width: r,
		height: i,
		originX: 0,
		originY: 0,
		textureManager: e.textureManager
	});
	a.add(o);
	let c = en(sn);
	if (un(o, r, i, t, c.loaded ? c.image : null, n), !c.loaded) {
		let e = tn(sn, () => {
			un(o, r, i, t, c.image, n);
		});
		a.addDisposer(e);
	}
	return a;
}
function pn(e) {
	let t = e.radius ?? 12, n = e.flatTop ?? !1, r = new dn({
		x: e.x,
		y: e.y
	}), i = new s({
		x: 0,
		y: 0,
		width: e.width,
		height: e.height,
		originX: 0,
		originY: 0,
		textureManager: e.textureManager
	});
	r.add(i);
	let a = en(sn), o = {
		width: e.width,
		height: e.height
	};
	function c() {
		un(i, o.width, o.height, t, a.loaded ? a.image : null, n);
	}
	if (c(), !a.loaded) {
		let e = tn(sn, () => {
			c();
		});
		r.addDisposer(e);
	}
	return {
		node: r,
		canvas: i,
		radius: t,
		setRect(e, t, n, a) {
			r.setPosition(e, t), !(n === o.width && a === o.height) && (o.width = n, o.height = a, i.setSize(n, a), c());
		},
		destroy() {
			r.destroy();
		}
	};
}
//#endregion
//#region src/widgets/Plaque.ts
function mn(e, t) {
	return e ? new i({
		x: 0,
		y: 0,
		name: t
	}) : null;
}
function hn(e, t) {
	let n = [];
	return e === !0 ? n.push(h()) : e && n.push(h(e)), t && n.push(...t), n;
}
function gn(e) {
	let { host: t, width: n, height: r } = e, i = e.x ?? 0, a = e.y ?? 0, o = e.radius ?? 12, s = hn(e.shadow, e.effects), c = s.length > 0, l = mn(c, "r3:plaque:back");
	l && t.add(l);
	let u = pn({
		x: i,
		y: a,
		width: n,
		height: r,
		radius: o,
		flatTop: e.flatTop,
		textureManager: e.textureManager
	});
	t.add(u.node);
	let d = mn(c, "r3:plaque:front");
	d && t.add(d);
	let f = {
		hosts: {
			back: l ?? t,
			front: d ?? t
		},
		radius: o,
		textureManager: e.textureManager
	}, p = {
		x: i,
		y: a,
		width: n,
		height: r
	}, m = s.map((e) => e(f, p));
	return {
		panel: u,
		setRect(e, t, n, r) {
			u.setRect(e, t, n, r);
			let i = {
				x: e,
				y: t,
				width: n,
				height: r
			};
			for (let e of m) e.setRect(i);
		},
		tick(e) {
			if (m.length === 0) return;
			let t = [];
			for (let n of m) n.tick && n.tick(e) && t.push(n);
			if (t.length !== 0) for (let e of t) {
				e.destroy();
				let t = m.indexOf(e);
				t >= 0 && m.splice(t, 1);
			}
		},
		destroy() {
			for (let e of m) e.destroy();
			m.length = 0, u.destroy(), l?.destroy(), d?.destroy();
		}
	};
}
function _n(e) {
	let { host: t, width: n, height: r } = e, a = new i({
		x: e.x ?? 0,
		y: e.y ?? 0,
		name: "r3:plaque-button"
	});
	t.add(a);
	let o = gn({
		host: a,
		x: 0,
		y: 0,
		width: n,
		height: r,
		radius: e.radius,
		shadow: e.shadow ?? !0,
		effects: e.effects,
		textureManager: e.textureManager
	}), s = { node: null }, c = { handler: e.onActivate ?? null };
	function l(e) {
		s.node && a.removeChild(s.node), s.node = e, e && a.add(e);
	}
	return l(e.content ?? null), a.setInteractive({
		x: 0,
		y: 0,
		width: n,
		height: r
	}), a.on("pointerdown", () => {
		c.handler?.();
	}), {
		node: a,
		plaque: o,
		setContent: l,
		setOnActivate(e) {
			c.handler = e;
		},
		destroy() {
			a.destroy();
		}
	};
}
//#endregion
//#region src/widgets/OrnateButton.ts
var vn = H.GOLD, yn = .18, bn = 140, xn = .45, Sn = .97, Cn = 90, wn = W.MINCHO, Tn = "title-button-hover";
function En(e) {
	return e === "primary" ? { text: H.CREAM_HERO } : { text: H.CREAM_TEXT };
}
function Dn(e) {
	return e === void 0 ? "title-button-click" : e;
}
function On(e) {
	return Math.max(16, Math.floor(e * .38));
}
function kn(e, t) {
	return e ? [
		h(),
		_(),
		g({
			scale: !0,
			referenceSize: t
		})
	] : [
		h(),
		_(),
		g()
	];
}
function An(e) {
	let t = En(e.variant ?? "primary"), n = e.accent ?? {}, r = n.text ?? t.text, i = n.hover ?? vn, a = n.hoverAlpha ?? yn, o = e.radius ?? 14, s = e.effects ?? kn(e.scaleDecorations === !0, e.decorationReferenceSize ?? 48), c = {
		width: e.width,
		height: e.height
	}, l = be({
		x: e.x,
		y: e.y,
		width: c.width,
		height: c.height,
		name: e.name ?? "r3:ornate-button",
		pivotName: "r3:ornate-button:pivot"
	}), { root: u, pivot: d } = l, f = gn({
		host: d,
		x: -c.width / 2,
		y: -c.height / 2,
		width: c.width,
		height: c.height,
		radius: o,
		shadow: !1,
		effects: s,
		textureManager: e.textureManager
	}), p = new P({
		x: 0,
		y: 0,
		width: c.width,
		height: c.height,
		fill: i,
		fillAlpha: 1,
		originX: .5,
		originY: .5,
		alpha: 0,
		textureManager: e.textureManager
	});
	d.add(p);
	let m = new B({
		x: 0,
		y: 0,
		text: e.label,
		font: {
			family: wn,
			size: On(c.height),
			weight: "bold"
		},
		color: r,
		originX: .5,
		originY: .5,
		textureManager: e.textureManager
	});
	d.add(m);
	let h = { disabled: e.disabled === !0 };
	function g() {
		return {
			x: -c.width / 2,
			y: -c.height / 2,
			width: c.width,
			height: c.height
		};
	}
	function _() {
		if (h.disabled) {
			u.setAlpha(xn), u.setInteractive(null), e.tweens?.killTweensOf(p), p.alpha = 0;
			return;
		}
		u.setAlpha(1), u.setInteractive(g());
	}
	_();
	function v(t) {
		if (!e.tweens) {
			p.alpha = t;
			return;
		}
		e.tweens.killTweensOf(p), e.tweens.add({
			targets: p,
			alpha: t,
			duration: bn,
			ease: "Quad.easeOut"
		});
	}
	return u.on("pointerover", () => {
		h.disabled || (v(a), G(Tn));
	}), u.on("pointerout", () => {
		h.disabled || v(0);
	}), u.on("pointerdown", () => {
		h.disabled || jn(d, e.tweens);
	}), u.on("click", () => {
		if (h.disabled) return;
		let t = Dn(e.clickSfx);
		t !== null && G(t), e.onClick();
	}), {
		node: u,
		setDisabled(e) {
			h.disabled = e, _();
		},
		setLabel(e) {
			m.setText(e);
		},
		setRect(e, t, n, r) {
			c.width = n, c.height = r, l.setRect(e, t, n, r), f.setRect(-n / 2, -r / 2, n, r), p.setSize(n, r), m.setStyle({
				family: wn,
				size: On(r),
				weight: "bold"
			}), h.disabled || u.setInteractive(g());
		},
		getRect() {
			return l.getRect();
		},
		getSize() {
			return {
				width: c.width,
				height: c.height
			};
		},
		tick(e) {
			f.tick(e);
		},
		destroy() {
			e.tweens?.killTweensOf(u), e.tweens?.killTweensOf(d), e.tweens?.killTweensOf(p), f.destroy(), u.destroy();
		}
	};
}
function jn(e, t) {
	Ce(e, t, {
		scale: Sn,
		durationMs: Cn
	});
}
//#endregion
//#region src/widgets/Heading.ts
function Mn(e) {
	let t = _e({
		x: e.x ?? 0,
		y: e.y ?? 0,
		name: "r3:heading"
	}), n = ve({
		x: 0,
		y: 0,
		name: "r3:heading-visual"
	});
	t.add(n);
	let r = new B({
		text: e.text,
		font: e.font,
		color: e.color,
		originX: .5,
		originY: .5,
		stroke: e.stroke,
		textureManager: e.textureManager
	});
	return n.add(r), {
		node: t,
		visualNode: n,
		naturalSize: () => ({
			width: r.width,
			height: r.height
		}),
		setRect(e, n, r, i) {
			t.setPosition(e + r / 2, n + i / 2);
		},
		setText(e) {
			r.setText(e);
		},
		setFont(e) {
			r.setStyle(e);
		},
		setColor(e) {
			r.setColor(e);
		},
		setStroke(e) {
			r.setStroke(e);
		},
		destroy() {
			t.destroy();
		}
	};
}
//#endregion
//#region src/widgets/Dialog.ts
var Nn = 960, Pn = U.INK_ABYSS, Fn = .55, In = U.CREAM_CARD, Ln = U.BROWN_BORDER, Rn = U.GOLD, zn = 22, Bn = 240, Vn = 260, Hn = 180, Un = 220, Wn = 180, Gn = 220;
function Kn(e) {
	return {
		fillColor: e?.fillColor ?? In,
		borderColor: e?.borderColor ?? Ln,
		accentColor: e?.accentColor ?? Rn,
		backdropColor: e?.backdropColor ?? Pn,
		backdropAlpha: e?.backdropAlpha ?? Fn,
		radius: e?.radius ?? zn
	};
}
function qn(e) {
	return {
		backdropFadeMs: e?.backdropFadeMs ?? Bn,
		cardOpenMs: e?.cardOpenMs ?? Vn,
		contentDelayMs: e?.contentDelayMs ?? Hn,
		contentFadeMs: e?.contentFadeMs ?? Un,
		closeFadeMs: e?.closeFadeMs ?? Wn,
		closeHoldMs: e?.closeHoldMs ?? Gn
	};
}
function Jn(e) {
	return `#${e.toString(16).padStart(6, "0")}`;
}
function Yn(e, t) {
	return {
		width: e + 16,
		height: t + 16
	};
}
function Xn(e, t, n, r) {
	e.clear(), e.fillStyle(r.fillColor, 1), e.fillRoundedRect(8, 8, t, n, r.radius), e.lineStyle(3, r.borderColor, 1), e.strokeRoundedRect(8, 8, t, n, r.radius), e.lineStyle(1, r.accentColor, .7);
	let i = Math.max(0, r.radius - 4);
	e.strokeRoundedRect(14, 14, t - 12, n - 12, i);
}
var Zn = .94;
function Qn(e, t, n, r) {
	let i = n * Zn, a = r * Zn;
	return e <= i && t <= a ? 1 : Math.min(i / e, a / t);
}
function $n(e) {
	let { stage: t, size: n, build: r, onClose: a } = e, o = Kn(e.visual), c = qn(e.timing), l = e.depth ?? Nn, { width: u, height: d, viewbox: f } = t.screen, p = f.x + f.width / 2, m = f.y + f.height / 2, h = p - n.width / 2, g = m - n.height / 2, _ = Qn(n.width, n.height, f.width, f.height), v = new i({ name: "r3:dialog" });
	v.setDepth(l);
	let y = new P({
		x: 0,
		y: 0,
		width: u,
		height: d,
		fill: Jn(o.backdropColor),
		fillAlpha: o.backdropAlpha,
		interactive: !0,
		alpha: 0,
		textureManager: e.textureManager
	});
	v.add(y);
	let b = new i({
		x: p,
		y: m,
		alpha: 0,
		scaleX: .9 * _,
		scaleY: .9 * _
	}), x = Yn(n.width, n.height), S = new s({
		width: x.width,
		height: x.height,
		originX: .5,
		originY: .5,
		textureManager: e.textureManager
	});
	Xn(S, n.width, n.height, o), b.add(S), v.add(b);
	let C = new i({
		x: p,
		y: m,
		scaleX: _,
		scaleY: _
	}), w = new i({
		x: -p,
		y: -m,
		alpha: 0
	});
	C.add(w), v.add(C), t.root.add(v), t.tweens.add({
		targets: y,
		alpha: 1,
		duration: c.backdropFadeMs,
		ease: "Quad.easeOut"
	}), t.tweens.add({
		targets: b,
		alpha: 1,
		scaleX: _,
		scaleY: _,
		duration: c.cardOpenMs,
		ease: "Back.easeOut"
	}), t.tweens.add({
		targets: w,
		alpha: 1,
		delay: c.contentDelayMs,
		duration: c.contentFadeMs,
		ease: "Quad.easeOut"
	});
	let T = {
		closed: !1,
		torn: !1,
		pendingTimeouts: []
	};
	function E(e, t) {
		if (T.torn) return;
		let n = window.setTimeout(() => {
			let t = T.pendingTimeouts.indexOf(n);
			t >= 0 && T.pendingTimeouts.splice(t, 1), e();
		}, t);
		T.pendingTimeouts.push(n);
	}
	let D = { off: null };
	function O() {
		if (!T.torn) {
			T.torn = !0, D.off &&= (D.off(), null);
			for (let e of T.pendingTimeouts) window.clearTimeout(e);
			T.pendingTimeouts = [], t.tweens.killTweensOf(y), t.tweens.killTweensOf(b), t.tweens.killTweensOf(C), t.tweens.killTweensOf(w), v.destroy();
		}
	}
	function k() {
		T.closed || (T.closed = !0, y.setInteractive(null), t.tweens.add({
			targets: [
				y,
				b,
				w
			],
			alpha: 0,
			duration: c.closeFadeMs,
			ease: "Quad.easeIn"
		}), E(() => {
			O(), a?.();
		}, c.closeHoldMs));
	}
	e.dismissOnBackdrop === !0 && y.on("pointerdown", () => {
		k();
	}), r({
		stage: t,
		textureManager: e.textureManager,
		content: w,
		cardX: h,
		cardY: g,
		width: n.width,
		height: n.height,
		centerX: p,
		centerY: m,
		close: k,
		scheduleTimeout: E
	});
	function ee() {
		if (T.torn || T.closed) return;
		let e = t.screen, r = e.viewbox.x + e.viewbox.width / 2, i = e.viewbox.y + e.viewbox.height / 2, a = Qn(n.width, n.height, e.viewbox.width, e.viewbox.height);
		y.setSize(e.width, e.height), b.setPosition(r, i), b.setScale(a, a), C.setPosition(r, i), C.setScale(a, a);
	}
	return D.off = t.onScreenChange(() => {
		ee();
	}), {
		node: v,
		destroy: O
	};
}
//#endregion
//#region src/scroll/ScrollModel.ts
var er = 6, tr = .3, nr = .5;
function rr(e, t, n) {
	let r = e === "y" ? Math.abs(n) : Math.abs(t), i = e === "y" ? Math.abs(t) : Math.abs(n);
	return Math.hypot(t, n) < er ? "undecided" : r > i ? "scroll" : "cross";
}
var ir = class {
	scrollY = 0;
	targetScrollY = 0;
	contentHeight;
	width;
	height;
	scrollStep;
	axis;
	dragState = null;
	_wasSwiping = !1;
	pendingSwipeReset = !1;
	constructor(e) {
		this.width = e.width, this.height = e.height, this.contentHeight = e.contentHeight, this.scrollStep = e.scrollStep, this.axis = e.axis ?? "y";
	}
	get crossExtent() {
		return this.axis === "y" ? this.height : this.width;
	}
	get maxScrollY() {
		return Math.max(0, this.contentHeight - this.crossExtent);
	}
	get scrollable() {
		return this.contentHeight > this.crossExtent;
	}
	get wasSwiping() {
		return this._wasSwiping;
	}
	getScrollY() {
		return this.scrollY;
	}
	get dragging() {
		return this.dragState !== null;
	}
	scrollBy(e) {
		this.scrollTo(this.targetScrollY + e);
	}
	scrollTo(e) {
		let t = or(e, 0, this.maxScrollY);
		return t === this.targetScrollY ? !1 : (this.targetScrollY = t, !0);
	}
	setScrollY(e) {
		let t = or(e, 0, this.maxScrollY);
		this.scrollY = t, this.targetScrollY = t;
	}
	resetScroll() {
		this.scrollY = 0, this.targetScrollY = 0;
	}
	setContentHeight(e) {
		this.contentHeight = e, this.scrollY = or(this.scrollY, 0, this.maxScrollY), this.targetScrollY = this.scrollY;
	}
	update() {
		return this.pendingSwipeReset &&= (this._wasSwiping = !1, !1), this.lerpScroll();
	}
	handleWheel(e, t, n, r, i) {
		if (!this.isPointerInBounds(e, t, n, r)) return !1;
		let a = i > 0 ? this.scrollStep : -this.scrollStep;
		return this.scrollBy(a), !0;
	}
	handlePointerDown(e, t, n, r) {
		if (!this.scrollable || !this.isPointerInBounds(e, t, n, r)) return;
		let i = this.axis === "y" ? t : e;
		this.dragState = {
			startPrimaryCoord: i,
			startCrossCoord: this.axis === "y" ? e : t,
			lastPrimaryCoord: i,
			scrollYAtStart: this.scrollY
		};
	}
	handlePointerMove(e, t) {
		if (!this.dragState) return !1;
		let n = this.axis === "y" || t === void 0 ? e : t, r = this.axis === "y" ? t : e, i = this.dragState.startPrimaryCoord - n;
		if (this.dragState.startCrossCoord !== null && r !== void 0) {
			let e = this.dragState.startCrossCoord - r, t = ar(this.axis, i, e);
			if (t === "undecided") return this.dragState.lastPrimaryCoord = n, !1;
			if (t === "cross") return this.dragState = null, !1;
		}
		return Math.abs(i) >= er ? (this._wasSwiping = !0, this.scrollToImmediate(this.dragState.scrollYAtStart + i), this.dragState.lastPrimaryCoord = n, !0) : (this.dragState.lastPrimaryCoord = n, !1);
	}
	handlePointerUp() {
		this.dragState &&= (this._wasSwiping && (this.pendingSwipeReset = !0), null);
	}
	isPointerInBounds(e, t, n, r) {
		return e >= n && e <= n + this.width && t >= r && t <= r + this.height;
	}
	scrollToImmediate(e) {
		let t = or(e, 0, this.maxScrollY);
		this.scrollY = t, this.targetScrollY = t;
	}
	lerpScroll() {
		if (this.dragState) return !1;
		let e = this.targetScrollY - this.scrollY;
		return Math.abs(e) < nr ? e === 0 ? !1 : (this.scrollY = this.targetScrollY, !0) : (this.scrollY += e * tr, !0);
	}
};
function ar(e, t, n) {
	return e === "y" ? rr(e, n, t) : rr(e, t, n);
}
function or(e, t, n) {
	return Math.max(t, Math.min(n, e));
}
//#endregion
//#region src/widgets/ScrollablePanel.ts
var sr = H.GOLD, cr = H.GOLD_LIGHTEST, q = H.BROWN_SOFT, J = 14, Y = 16, lr = W.MINCHO, ur = 24, dr = 48, fr = {
	start: "▲",
	end: "▼"
}, pr = {
	start: "◀",
	end: "▶"
}, mr = class {
	container;
	content;
	model;
	stage;
	config;
	axis;
	showIndicators;
	defaultStep;
	startIndicator = null;
	endIndicator = null;
	clippingPlanes;
	disposers;
	tickHandle;
	get wasSwiping() {
		return this.model.wasSwiping;
	}
	get scrollable() {
		return this.model.scrollable;
	}
	get viewHeight() {
		return this.axis === "y" ? this.config.height : this.config.width;
	}
	constructor(e) {
		this.stage = e.stage, this.config = e, this.axis = e.axis ?? "y", this.showIndicators = e.showIndicators ?? !0, this.defaultStep = this.axis === "y" ? ur : dr;
		let t = e.scrollStep ?? this.defaultStep;
		this.model = new ir({
			width: e.width,
			height: e.height,
			contentHeight: e.contentHeight,
			scrollStep: t,
			axis: this.axis
		}), this.container = new i({
			x: e.x,
			y: e.y,
			name: this.axis === "y" ? "r3:scroll-panel" : "r3:hscroll-panel"
		}), this.content = new i({
			x: 0,
			y: 0,
			name: this.axis === "y" ? "r3:scroll-panel:content" : "r3:hscroll-panel:content"
		}), this.container.add(this.content), this.disposers = [], this.clippingPlanes = hr(e.x, e.y, e.width, e.height), this.refreshClippingPlanes(), this.content.setClippingPlanes(this.clippingPlanes), this.disposers.push(this.stage.pointer.on("wheel", (t) => {
			this.containsViewportPoint(t.x, t.y) && this.model.handleWheel(t.x, t.y, e.x, e.y, t.deltaY) && this.updateIndicatorsFor(this.model.getScrollY());
		})), this.disposers.push(this.stage.pointer.on("pointerdown", (t) => {
			e.canDragScroll?.() !== !1 && this.model.handlePointerDown(t.x, t.y, e.x, e.y);
		})), this.disposers.push(this.stage.pointer.on("pointermove", (t) => {
			if (e.canDragScroll?.() !== !1) {
				if (this.axis === "y") {
					this.model.handlePointerMove(t.y, t.x) && this.applyScroll();
					return;
				}
				this.model.handlePointerMove(t.y, t.x) && this.applyScroll();
			}
		})), this.disposers.push(this.stage.pointer.on("pointerup", () => {
			this.model.handlePointerUp();
		})), this.tickHandle = this.stage.tweens.add({
			targets: { _t: 0 },
			_t: 1,
			duration: 16,
			repeat: -1,
			ease: "Linear",
			onUpdate: () => {
				this.refreshClippingPlanes(), this.model.update() && this.writeContentOffset();
			}
		}), this.showIndicators && this.buildIndicators(), this.updateIndicators(), (e.parent ?? this.stage.root).add(this.container);
	}
	setContentHeight(e) {
		this.model.setContentHeight(e), this.applyScroll();
	}
	resetScroll() {
		this.model.resetScroll(), this.applyScroll();
	}
	setScrollY(e) {
		this.model.setScrollY(e), this.applyScroll();
	}
	getScrollY() {
		return this.model.getScrollY();
	}
	scrollBy(e) {
		this.model.scrollBy(e), this.updateIndicatorsFor(this.model.getScrollY());
	}
	scrollTo(e) {
		this.model.scrollTo(e) && this.updateIndicatorsFor(this.model.getScrollY());
	}
	addContent(e) {
		return this.content.add(e), e.setClippingPlanes(this.clippingPlanes), e;
	}
	clearContent() {
		this.content.removeAll(!0), this.model.resetScroll(), this.applyScroll();
	}
	destroy() {
		this.tickHandle.kill();
		for (let e of this.disposers) e();
		this.disposers.length = 0, this.container.destroy();
	}
	applyScroll() {
		this.writeContentOffset(), this.updateIndicators();
	}
	writeContentOffset() {
		let e = -this.model.getScrollY();
		this.axis === "y" ? this.content.y = e : this.content.x = e;
	}
	buildIndicators() {
		let e = this.axis === "y" ? fr : pr;
		this.axis === "y" ? this.buildVerticalIndicators(e) : this.buildHorizontalIndicators(e);
	}
	buildVerticalIndicators(e) {
		let t = this.config.width / 2;
		this.startIndicator = new B({
			x: t,
			y: -J + 2,
			text: e.start,
			font: {
				family: lr,
				size: 12
			},
			color: q,
			originX: .5,
			originY: 0,
			textureManager: this.config.textureManager
		}), this.startIndicator.setInteractive({
			x: -J,
			y: 0,
			width: J * 2,
			height: J
		}), this.wireIndicator(this.startIndicator, "start"), this.container.add(this.startIndicator), this.endIndicator = new B({
			x: t,
			y: this.config.height + 2,
			text: e.end,
			font: {
				family: lr,
				size: 12
			},
			color: q,
			originX: .5,
			originY: 0,
			textureManager: this.config.textureManager
		}), this.endIndicator.setInteractive({
			x: -J,
			y: 0,
			width: J * 2,
			height: J
		}), this.wireIndicator(this.endIndicator, "end"), this.container.add(this.endIndicator);
	}
	buildHorizontalIndicators(e) {
		let t = this.config.height / 2;
		this.startIndicator = new B({
			x: -Y + 2,
			y: t,
			text: e.start,
			font: {
				family: lr,
				size: 14
			},
			color: q,
			originX: 0,
			originY: .5,
			textureManager: this.config.textureManager
		}), this.startIndicator.setInteractive({
			x: 0,
			y: -Y,
			width: Y,
			height: Y * 2
		}), this.wireIndicator(this.startIndicator, "start"), this.container.add(this.startIndicator), this.endIndicator = new B({
			x: this.config.width + 2,
			y: t,
			text: e.end,
			font: {
				family: lr,
				size: 14
			},
			color: q,
			originX: 0,
			originY: .5,
			textureManager: this.config.textureManager
		}), this.endIndicator.setInteractive({
			x: 0,
			y: -Y,
			width: Y,
			height: Y * 2
		}), this.wireIndicator(this.endIndicator, "end"), this.container.add(this.endIndicator);
	}
	wireIndicator(e, t) {
		e.on("pointerover", () => {
			this.canScrollToward(t) && e.setColor(cr);
		}), e.on("pointerout", () => {
			e.setColor(this.colorForSide(t));
		}), e.on("pointerdown", () => {
			G("title-button-click");
			let e = this.config.scrollStep ?? this.defaultStep;
			this.scrollBy(t === "start" ? -e : e);
		});
	}
	canScrollToward(e) {
		let t = this.model.getScrollY();
		return e === "start" ? t > 0 : t < this.model.maxScrollY;
	}
	colorForSide(e) {
		return this.canScrollToward(e) ? sr : q;
	}
	updateIndicators() {
		this.updateIndicatorsFor(this.model.getScrollY());
	}
	updateIndicatorsFor(e) {
		if (this.showIndicators && (this.startIndicator && (this.startIndicator.setColor(e > 0 ? sr : q), this.startIndicator.setVisible(this.model.scrollable)), this.endIndicator)) {
			let t = e < this.model.maxScrollY;
			this.endIndicator.setColor(t ? sr : q), this.endIndicator.setVisible(this.model.scrollable);
		}
	}
	containsViewportPoint(e, t) {
		this.container.obj3d.updateWorldMatrix(!0, !1), yr.copy(this.container.obj3d.matrixWorld).invert(), br.set(e, -t, 0).applyMatrix4(yr);
		let n = br.x;
		return vr(n, -br.y, 0, 0, this.config.width, this.config.height);
	}
	refreshClippingPlanes() {
		this.container.obj3d.updateWorldMatrix(!0, !1);
		let e = gr(this.container.obj3d.matrixWorld, this.config.width, this.config.height), t = X(this.container.obj3d.matrixWorld, this.config.width / 2, this.config.height / 2);
		_r(this.clippingPlanes[0], e[0], e[1], t), _r(this.clippingPlanes[1], e[1], e[2], t), _r(this.clippingPlanes[2], e[2], e[3], t), _r(this.clippingPlanes[3], e[3], e[0], t), this.content.setClippingPlanes(this.clippingPlanes);
	}
};
function hr(e, t, n, r) {
	let i = e, a = e + n, o = t, s = t + r;
	return [
		new O(new A(1, 0, 0), -i),
		new O(new A(-1, 0, 0), a),
		new O(new A(0, -1, 0), -o),
		new O(new A(0, 1, 0), s)
	];
}
function gr(e, t, n) {
	return [
		X(e, 0, 0, Sr),
		X(e, t, 0, Cr),
		X(e, t, n, wr),
		X(e, 0, n, Tr)
	];
}
function X(e, t, n, r = xr) {
	return r.set(t, -n, 0).applyMatrix4(e);
}
function _r(e, t, n, r) {
	!e || !t || !n || (Er.copy(t).add(Dr), e.setFromCoplanarPoints(t, n, Er), e.distanceToPoint(r) < 0 && e.negate());
}
function vr(e, t, n, r, i, a) {
	return e >= n && e <= n + i && t >= r && t <= r + a;
}
var yr = new w(), br = new A(), xr = new A(), Sr = new A(), Cr = new A(), wr = new A(), Tr = new A(), Er = new A(), Dr = new A(0, 0, 1), Or = U.GOLD, kr = H.INK_TEXT, Ar = U.INK_BUTTON, jr = U.INK_BUTTON_HOVER, Mr = H.CREAM_DIM, Nr = 2763302, Pr = H.BROWN_TAB_DISABLED, Fr = U.BROWN_BORDER, Ir = U.GOLD, Lr = H.GOLD, Rr = .95, zr = 12, Br = 36, Vr = 6, Hr = 20, Ur = 96, Z = 5, Wr = 1, Gr = W.MINCHO, Kr = 14, qr = Kr * .6;
function Jr(e) {
	return Math.ceil(Array.from(e).length * qr);
}
function Yr(e, t, n, r, i, a) {
	let o = (a ? 0 : Z) + Wr, s = a ? n + Z : n, c = o + s, l = zr;
	e.clear(), e.fillStyle(r, 1), e.fillRoundedRect(0, o, t, s, l), e.fillRect(0, c - l, t, l), e.lineStyle(a ? 1.5 : 1, i, .95), e.strokeRoundedRect(0, o, t, s, l), e.strokeLine(0, c, t, c);
}
function Xr(e) {
	let t = e.height ?? Br, n = e.gap ?? Vr, r = e.tabs.map((t) => {
		let n = Jr(t.label);
		return Math.max(e.minTabWidth ?? Ur, n + Hr * 2);
	}), a = r.map((e, t) => r.slice(0, t).reduce((e, t) => e + t + n, 0)), o = new i({ name: "r3:tab-bar" });
	if ((e.parent ?? e.stage.root).add(o), e.trayWidth !== void 0 && e.trayWidth > 0) {
		let n = new P({
			x: e.x,
			y: e.y + t,
			width: e.trayWidth,
			height: 1,
			fill: Lr,
			fillAlpha: Rr,
			originX: 0,
			originY: 1,
			textureManager: e.textureManager
		});
		o.add(n);
	}
	let c = e.tabs.map((n, i) => {
		let c = r[i] ?? Ur, l = e.x + (a[i] ?? 0), u = new s({
			x: l,
			y: e.y - Z - Wr,
			width: c,
			height: t + Z + Wr * 2,
			originX: 0,
			originY: 0,
			textureManager: e.textureManager
		});
		o.add(u);
		let d = new B({
			x: l + c / 2,
			y: e.y + t / 2,
			text: n.label,
			font: {
				family: Gr,
				size: Kr,
				weight: "bold"
			},
			color: Mr,
			originX: .5,
			originY: .5,
			textureManager: e.textureManager
		});
		o.add(d);
		let f = new P({
			x: l,
			y: e.y,
			width: c,
			height: t,
			fill: H.BLACK,
			fillAlpha: 0,
			originX: 0,
			originY: 0,
			interactive: n.disabled !== !0,
			textureManager: e.textureManager
		});
		return o.add(f), {
			spec: n,
			bg: u,
			label: d,
			hit: f,
			width: c,
			x: l,
			active: n.id === e.initialId,
			hovered: !1
		};
	});
	function l(n) {
		if (n.spec.disabled === !0) {
			Yr(n.bg, n.width, t, Nr, Fr, !1), n.label.setColor(Pr), n.label.y = e.y + t / 2;
			return;
		}
		if (n.active) {
			Yr(n.bg, n.width, t, Or, Ir, !0), n.label.setColor(kr), n.label.y = e.y + t / 2 - Z / 2;
			return;
		}
		let r = n.hovered ? jr : Ar;
		Yr(n.bg, n.width, t, r, Fr, !1), n.label.setColor(Mr), n.label.y = e.y + t / 2;
	}
	for (let t of c) l(t), t.hit.on("pointerover", () => {
		t.spec.disabled === !0 || t.active || (t.hovered = !0, l(t), G("title-button-hover"));
	}), t.hit.on("pointerout", () => {
		t.spec.disabled !== !0 && (t.hovered = !1, l(t));
	}), t.hit.on("pointerdown", () => {
		t.spec.disabled === !0 || t.active || (G("title-button-click"), e.onSelect(t.spec.id));
	});
	return {
		node: o,
		height: t,
		setActive(e) {
			for (let t of c) {
				let n = t.spec.id === e;
				t.active !== n && (t.active = n, n || (t.hovered = !1), l(t));
			}
		},
		destroy() {
			o.destroy();
		}
	};
}
//#endregion
//#region src/widgets/LayoutCursor.ts
var Zr = class {
	yCursor;
	contentX;
	contentWidth;
	pad;
	container;
	textureManager;
	constructor(e) {
		this.yCursor = e.startY, this.contentX = e.x, this.contentWidth = e.width, this.pad = e.padding ?? 24, this.container = e.container, this.textureManager = e.textureManager;
	}
	y() {
		return this.yCursor;
	}
	left() {
		return this.contentX + this.pad;
	}
	right() {
		return this.contentX + this.contentWidth - this.pad;
	}
	centerX() {
		return this.contentX + this.contentWidth / 2;
	}
	innerWidth() {
		return this.contentWidth - this.pad * 2;
	}
	advance(e) {
		this.yCursor += e;
	}
	separator(e, t, n = .6) {
		let r = this.left(), i = this.right() - r, a = new s({
			x: r,
			y: this.yCursor,
			width: Math.max(1, i),
			height: 1,
			originX: 0,
			originY: 0,
			textureManager: this.textureManager
		});
		return a.lineStyle(1, t, n), a.strokeLine(0, 0, i, 0), this.container.add(a), this.yCursor += e, a;
	}
	attach(...e) {
		for (let t of e) this.container.add(t);
	}
	moveTo(e) {
		this.yCursor = e;
	}
}, Qr = H.GOLD, $r = "#f2cf6b", ei = "#f8edd8", ti = H.INK_TEXT, ni = H.BROWN_SOFT, ri = H.INK_TEXT, ii = H.GOLD, ai = 1.4, oi = 16;
function si(e) {
	return e instanceof HTMLInputElement && e.dataset.r3TextInput === "true";
}
function ci(e) {
	let t = new i({
		x: e.x,
		y: e.y,
		name: "r3:text-input"
	}), n = e.maxLength ?? 40, r = Math.max(18, Math.floor(e.height * .42)), a = {
		family: W.MINCHO,
		size: r,
		weight: "bold"
	}, o = -e.width / 2 + oi, s = e.width - oi * 2, c = e.height / 2, l = li({
		maxLength: n,
		value: e.value ?? "",
		fontSize: r,
		width: s,
		height: e.height,
		ariaLabel: e.ariaLabel ?? "",
		autocomplete: e.autocomplete ?? "off"
	}), u = fi(a), d = {
		focused: !1,
		composing: !1,
		compositionStart: 0
	}, f = {
		lines: [{
			text: "",
			width: 0
		}],
		labelTop: -e.height / 2,
		padding: 2,
		ascent: r * .8,
		descent: r * .2,
		lineAdvance: r * ai,
		boxHeight: e.height
	}, p = { dispose: null }, m = new P({
		width: e.width,
		height: e.height,
		fill: ei,
		fillAlpha: 1,
		strokeColor: Qr,
		strokeWidth: 2,
		strokeAlpha: 1,
		cornerRadius: e.cornerRadius ?? 0,
		originX: .5,
		originY: .5,
		interactive: !0,
		textureManager: e.textureManager
	});
	t.add(m);
	let h = new B({
		text: "",
		font: a,
		color: ti,
		align: "left",
		lineHeight: ai,
		maxWidth: s,
		ellipsis: !1,
		padding: 2,
		originX: 0,
		originY: 0,
		textureManager: e.textureManager
	});
	h.setPosition(o, f.labelTop), t.add(h);
	let g = new P({
		width: 2,
		height: Math.max(24, Math.floor(e.height * .54)),
		fill: ri,
		fillAlpha: 1,
		originX: .5,
		originY: .5,
		visible: !1,
		textureManager: e.textureManager
	});
	t.add(g);
	let _ = [];
	function v(e) {
		return {
			text: e,
			font: a,
			color: ti,
			align: "left",
			lineHeight: ai,
			letterSpacing: 0,
			maxWidth: s,
			maxLines: Infinity,
			ellipsis: !1,
			padding: 2,
			stroke: null
		};
	}
	function y() {
		return l.value.length > 0 ? l.value : e.placeholder ?? "";
	}
	function b() {
		let t = y(), n = l.value.length > 0;
		h.setText(t), h.setColor(n ? ti : ni), m.setStroke(d.focused ? $r : Qr, d.focused ? 3 : 2);
		let r = st(v(t), null, e.textureManager), i = Math.max(1, r.lines.length), a = Math.max(0, r.cssHeight - r.padding * 2 - r.ascent - (i - 1) * r.lineAdvance), s = Math.ceil(r.ascent + a + r.padding * 2), u = Math.max(0, (e.height - s) / 2), p = Math.max(e.height, r.cssHeight + u * 2), g = c - p;
		f.lines = n ? r.lines : [{
			text: "",
			width: 0
		}], f.labelTop = g + u, f.padding = r.padding, f.ascent = r.ascent, f.descent = a, f.lineAdvance = r.lineAdvance, m.setSize(e.width, p), m.setPosition(0, c - p / 2), h.setPosition(o, f.labelTop), D(), O(), N(), p !== f.boxHeight && (f.boxHeight = p, e.onHeightChange?.(p));
	}
	function x(t) {
		l.value = t.slice(0, n), b(), e.onChange?.(l.value);
	}
	function S(e) {
		return Math.max(0, Math.min(l.value.length, e));
	}
	function C() {
		return S(l.selectionStart ?? l.value.length);
	}
	function w(e, t) {
		let n = f.lines, r = { remaining: S(e) };
		for (let e = 0; e < n.length; e++) {
			let i = n[e]?.text.length ?? 0;
			if (r.remaining < i || r.remaining === i && (t === "backward" || e === n.length - 1)) return {
				line: e,
				offset: r.remaining
			};
			r.remaining -= i;
		}
		let i = n.length - 1;
		return {
			line: i,
			offset: n[i]?.text.length ?? 0
		};
	}
	function T(e) {
		return f.labelTop + f.padding + e * f.lineAdvance;
	}
	function E(e) {
		let t = u((f.lines[e.line]?.text ?? "").slice(0, e.offset));
		return o + f.padding + Math.min(s, t);
	}
	function D() {
		if (g.setVisible(d.focused), !g.visible) return;
		let e = w(C(), "forward"), t = f.ascent + f.descent;
		g.setSize(2, Math.ceil(t) + 2), g.setPosition(E(e), T(e.line) + t / 2);
	}
	function O() {
		if (!(d.focused && d.composing)) {
			for (let e of _) e.setVisible(!1);
			return;
		}
		let e = S(d.compositionStart), t = C(), n = w(Math.min(e, t), "forward"), r = w(Math.max(e, t), "backward"), i = (e) => T(e) + f.ascent + f.descent + 2, a = (e) => o + f.padding + Math.min(s, f.lines[e]?.width ?? 0), c = { drawn: 0 };
		for (let e = n.line; e <= r.line; e++) {
			let t = e === n.line ? E(n) : o + f.padding, s = e === r.line ? E(r) : a(e), l = k(c.drawn);
			l.setVisible(!0), l.setPosition(t, i(e)), l.setSize(Math.max(2, s - t), 2), c.drawn += 1;
		}
		for (let e = c.drawn; e < _.length; e++) _[e]?.setVisible(!1);
	}
	function k(n) {
		let r = _[n];
		if (r) return r;
		let i = new P({
			width: 1,
			height: 2,
			fill: ii,
			fillAlpha: 1,
			originX: 0,
			originY: .5,
			visible: !1,
			textureManager: e.textureManager
		});
		return t.add(i), _.push(i), i;
	}
	function ee(e, t) {
		return e.slice(0, t).reduce((e, t) => e + t.text.length, 0);
	}
	function te(e, t) {
		let n = f.lines, r = Math.floor((t - f.labelTop - f.padding) / f.lineAdvance), i = Math.max(0, Math.min(n.length - 1, r)), a = e - (o + f.padding), s = ee(n, i), c = n[i]?.text ?? "", l = Array.from(c), d = { consumed: "" };
		for (let e of l) {
			if (a < (u(d.consumed) + u(d.consumed + e)) / 2) return s + d.consumed.length;
			d.consumed += e;
		}
		return s + c.length;
	}
	function ne(e) {
		return e.isComposing || d.composing || e.keyCode === 229;
	}
	let A = () => {
		b(), !d.composing && e.onChange?.(l.value);
	}, j = (t) => {
		ne(t) || (t.key === "Enter" && (t.preventDefault(), e.onSubmit?.(l.value)), t.key === "Escape" && (t.preventDefault(), e.onCancel?.()));
	}, re = () => {
		d.focused = !0, ce(), b();
	}, ie = () => {
		d.focused = !1, d.composing = !1, le(), b();
	}, M = () => {
		d.composing = !0, d.compositionStart = l.selectionStart ?? l.value.length, b();
	}, ae = () => {
		d.composing = !0, b();
	}, oe = () => {
		d.composing = !1, b(), e.onChange?.(l.value);
	}, se = () => {
		document.activeElement === l && b();
	};
	return l.addEventListener("input", A), l.addEventListener("keydown", j), l.addEventListener("focus", re), l.addEventListener("blur", ie), l.addEventListener("compositionstart", M), l.addEventListener("compositionupdate", ae), l.addEventListener("compositionend", oe), l.addEventListener("keyup", b), l.addEventListener("mouseup", b), document.addEventListener("selectionchange", se), m.on("pointerdown", (e) => {
		if (l.focus(), !d.composing) {
			let t = c - f.boxHeight / 2, n = te(e.localX, t + e.localY);
			l.setSelectionRange(n, n);
		}
		b();
	}), b(), {
		node: t,
		value: () => l.value,
		setValue: x,
		focus: () => {
			l.focus();
		},
		boxHeight: () => f.boxHeight,
		destroy: () => {
			l.removeEventListener("input", A), l.removeEventListener("keydown", j), l.removeEventListener("focus", re), l.removeEventListener("blur", ie), l.removeEventListener("compositionstart", M), l.removeEventListener("compositionupdate", ae), l.removeEventListener("compositionend", oe), l.removeEventListener("keyup", b), l.removeEventListener("mouseup", b), document.removeEventListener("selectionchange", se), le(), l.remove(), t.destroy();
		}
	};
	function ce() {
		if (N(), p.dispose !== null) return;
		let e = t.stage;
		e !== null && (p.dispose = e.onFrame(N));
	}
	function le() {
		p.dispose?.(), p.dispose = null;
	}
	function N() {
		let e = w(C(), "forward"), n = f.ascent + f.descent;
		di(l, ui({
			root: t,
			localLeft: o,
			localTop: T(e.line) - 2,
			width: s,
			height: n + 4,
			fontSize: r
		}));
	}
}
function li(e) {
	let t = document.createElement("input");
	return t.type = "text", t.dataset.r3TextInput = "true", t.setAttribute("autocomplete", e.autocomplete), t.inputMode = "text", t.maxLength = e.maxLength, t.value = e.value.slice(0, e.maxLength), t.setAttribute("aria-label", e.ariaLabel), t.style.position = "fixed", t.style.left = "0", t.style.top = "0", t.style.width = `${String(Math.max(1, e.width))}px`, t.style.height = `${String(Math.max(1, e.height))}px`, t.style.opacity = "0.01", t.style.pointerEvents = "none", t.style.zIndex = "0", t.style.margin = "0", t.style.padding = "0", t.style.border = "0", t.style.outline = "0", t.style.background = "transparent", t.style.color = "transparent", t.style.caretColor = "transparent", t.style.fontFamily = W.MINCHO, t.style.fontSize = `${String(e.fontSize)}px`, t.style.fontWeight = "bold", t.style.lineHeight = `${String(e.height)}px`, document.body.append(t), t;
}
function ui(e) {
	let t = e.root.stage, n = (t?.renderer?.domElement ?? null)?.getBoundingClientRect(), r = e.root.getWorldPosition(), i = n && t !== null && t.screen.width > 0 ? n.width / t.screen.width : 1, a = n && t !== null && t.screen.height > 0 ? n.height / t.screen.height : 1;
	return {
		left: (n?.left ?? 0) + (r.x + e.localLeft) * i,
		top: (n?.top ?? 0) + (r.y + e.localTop) * a,
		width: Math.max(1, e.width * i),
		height: Math.max(1, e.height * a),
		fontSize: Math.max(1, e.fontSize * a)
	};
}
function di(e, t) {
	e.style.left = `${String(t.left)}px`, e.style.top = `${String(t.top)}px`, e.style.width = `${String(t.width)}px`, e.style.height = `${String(t.height)}px`, e.style.fontSize = `${String(t.fontSize)}px`, e.style.lineHeight = `${String(t.height)}px`;
}
function fi(e) {
	let t = document.createElement("canvas").getContext("2d");
	return t === null ? (t) => t.length * e.size * .55 : (t.font = Ye(e), (e) => e.length === 0 ? 0 : t.measureText(e).width);
}
//#endregion
//#region src/widgets/Select.ts
function pi(e) {
	let t = new i({ name: e.name ?? "r3:select" });
	e.parent.add(t);
	let n = {
		value: e.value,
		rect: {
			x: 0,
			y: 0,
			width: 120,
			height: 34
		},
		open: !1,
		popup: null,
		overlayPopup: null,
		overlayScene: null,
		overlayDisposer: null
	}, r = new P({
		x: 0,
		y: 0,
		width: n.rect.width,
		height: n.rect.height,
		fill: H.INK_BUTTON,
		fillAlpha: .9,
		strokeColor: H.GOLD,
		strokeAlpha: .5,
		strokeWidth: 1,
		cornerRadius: 7,
		originX: 0,
		originY: 0,
		interactive: !0,
		textureManager: e.textureManager
	});
	t.add(r);
	let a = new B({
		x: 10,
		y: n.rect.height / 2,
		text: s(n.value),
		font: {
			family: W.MINCHO,
			size: 13,
			weight: "bold"
		},
		color: H.CREAM_TEXT,
		originX: 0,
		originY: .5,
		maxWidth: n.rect.width - 34,
		maxLines: 1,
		textureManager: e.textureManager
	});
	t.add(a);
	let o = new B({
		x: n.rect.width - 16,
		y: n.rect.height / 2,
		text: "▼",
		font: {
			family: W.MINCHO,
			size: 11,
			weight: "bold"
		},
		color: H.GOLD,
		originX: .5,
		originY: .5,
		textureManager: e.textureManager
	});
	t.add(o);
	function s(t) {
		return e.options.find((e) => e.value === t)?.label ?? "";
	}
	function c() {
		r.setPosition(n.rect.x, n.rect.y), r.setSize(n.rect.width, n.rect.height), a.setPosition(n.rect.x + 10, n.rect.y + n.rect.height / 2), a.setMaxWidth(Math.max(1, n.rect.width - 34)), a.setText(s(n.value)), o.setPosition(n.rect.x + n.rect.width - 16, n.rect.y + n.rect.height / 2);
	}
	function l() {
		n.popup?.destroy(), n.popup = null, n.overlayDisposer?.(), n.overlayDisposer = null, n.overlayPopup?.destroy(), n.overlayPopup = null, n.overlayScene?.clear(), n.overlayScene = null, n.open = !1;
	}
	function u() {
		l(), n.open = !0;
		let t = new i({ name: "r3:select-popup" });
		t.setDepth(200), e.parent.add(t);
		let r = new te(), a = new i({ name: "r3:select-popup:overlay" });
		r.add(a.obj3d), n.overlayScene = r, n.overlayPopup = a, n.overlayDisposer = e.stage.registerOverlayLayerFn((t) => {
			a.composeWorldState(1, !0), a.composeRenderOrder(0, 1e5), t.clearDepth(), t.render(r, e.stage.camera);
		});
		let o = n.rect.height, s = o * e.options.length;
		d(t, s, !0), d(a, s, !1), e.options.forEach((r, i) => {
			let s = n.rect.y + n.rect.height + 4 + o * i, c = r.value === n.value, u = new P({
				x: n.rect.x,
				y: s,
				width: n.rect.width,
				height: o,
				fill: c ? H.GOLD : H.BLACK,
				fillAlpha: c ? .2 : 0,
				originX: 0,
				originY: 0,
				interactive: !0,
				textureManager: e.textureManager
			});
			u.on("pointerup", () => {
				G("title-button-click"), p.setValue(r.value), l(), e.onChange(r.value);
			}), t.add(u), f(t, r.label, s, c), f(a, r.label, s, c);
		}), n.popup = t;
	}
	function d(t, r, i) {
		t.add(new P({
			x: n.rect.x,
			y: n.rect.y + n.rect.height + 4,
			width: n.rect.width,
			height: r,
			fill: H.INK_PANEL,
			fillAlpha: .98,
			strokeColor: H.GOLD,
			strokeAlpha: .72,
			strokeWidth: 1,
			cornerRadius: 7,
			originX: 0,
			originY: 0,
			interactive: i,
			textureManager: e.textureManager
		}));
	}
	function f(t, r, i, a) {
		t.add(new B({
			x: n.rect.x + 10,
			y: i + n.rect.height / 2,
			text: r,
			font: {
				family: W.MINCHO,
				size: 13,
				weight: a ? "bold" : "normal"
			},
			color: a ? H.GOLD : H.CREAM_TEXT,
			originX: 0,
			originY: .5,
			maxWidth: Math.max(1, n.rect.width - 20),
			maxLines: 1,
			textureManager: e.textureManager
		}));
	}
	r.on("pointerup", () => {
		G("title-button-click"), n.open ? l() : u();
	});
	let p = {
		node: t,
		get value() {
			return n.value;
		},
		setRect(e) {
			n.rect = e, c(), n.open && u();
		},
		setValue(e) {
			n.value = e, c();
		},
		close: l,
		destroy() {
			l(), t.destroy();
		}
	};
	return c(), p;
}
//#endregion
//#region src/canvasPointerBridge.ts
function Q(e, t) {
	let n = e.getBoundingClientRect();
	return n.width === 0 || n.height === 0 ? null : {
		left: n.left,
		top: n.top,
		width: n.width,
		height: n.height,
		logicalWidth: t.screen.width,
		logicalHeight: t.screen.height
	};
}
function $(e, t, n) {
	return {
		x: (t - e.left) / e.width * e.logicalWidth,
		y: (n - e.top) / e.height * e.logicalHeight
	};
}
function mi(e) {
	let { canvas: t, stage: n } = e, r = [];
	function i(e, n, i) {
		t.addEventListener(e, n, i), r.push(() => {
			t.removeEventListener(e, n, i);
		});
	}
	function a(e, t, n) {
		window.addEventListener(e, t, n), r.push(() => {
			window.removeEventListener(e, t, n);
		});
	}
	let o = { value: null }, s = /* @__PURE__ */ new Map(), c = {
		lastDistance: null,
		snapshot: null
	}, l = (e, r) => {
		e === "mousedown" && (o.value = Q(t, n));
		let i = o.value ?? Q(t, n);
		if (!i) return;
		let a = $(i, r.clientX, r.clientY);
		e === "mousedown" ? n.pointer.feedDown(a.x, a.y, r.button) : e === "mouseup" ? (n.pointer.feedUp(a.x, a.y, r.button), o.value = null) : n.pointer.feedMove(a.x, a.y), r.cancelable && r.preventDefault();
	};
	i("mousedown", (e) => l("mousedown", e)), i("mousemove", (e) => l("mousemove", e)), i("mouseup", (e) => l("mouseup", e)), i("mouseleave", () => {
		o.value !== null && (n.pointerSnapshot.isDown || (o.value = null, n.pointer.feedCancel()));
	}), a("mousemove", (e) => {
		o.value === null || !n.pointerSnapshot.isDown || l("mousemove", e);
	}), a("mouseup", (e) => {
		o.value !== null && l("mouseup", e);
	}), a("blur", () => {
		o.value = null, s.clear(), n.pointer.feedCancel();
	}), i("wheel", (e) => {
		let r = Q(t, n);
		if (!r) return;
		let i = $(r, e.clientX, e.clientY);
		if (e.ctrlKey || e.metaKey) {
			n.pointer.feedPinch(i.x, i.y, Math.exp(-e.deltaY * .002)), e.preventDefault();
			return;
		}
		n.pointer.feedWheel(i.x, i.y, e.deltaY), e.preventDefault();
	}, { passive: !1 });
	let u = (e, r) => {
		if (r.touches.length >= 2) {
			let i = c.snapshot ?? Q(t, n), a = r.touches.item(0), o = r.touches.item(1);
			if (!i || !a || !o) return;
			let s = Math.hypot(a.clientX - o.clientX, a.clientY - o.clientY), l = $(i, (a.clientX + o.clientX) / 2, (a.clientY + o.clientY) / 2);
			e === "touchstart" || c.lastDistance === null ? (c.snapshot = i, c.lastDistance = s) : s > 1 && c.lastDistance > 1 && (n.pointer.feedPinch(l.x, l.y, s / c.lastDistance), c.lastDistance = s), r.cancelable && r.preventDefault();
			return;
		}
		(e === "touchend" || e === "touchcancel") && (c.lastDistance = null, c.snapshot = null);
		let i = r.changedTouches.item(0) ?? r.touches.item(0);
		if (!i) {
			(e === "touchend" || e === "touchcancel") && (s.clear(), n.pointer.feedCancel());
			return;
		}
		if (e === "touchstart") {
			let e = Q(t, n);
			if (!e) return;
			s.set(i.identifier, e);
		}
		let a = s.get(i.identifier) ?? Q(t, n);
		if (!a) return;
		let o = $(a, i.clientX, i.clientY);
		e === "touchstart" ? n.pointer.feedDown(o.x, o.y, 0, i.identifier) : e === "touchmove" ? n.pointer.feedMove(o.x, o.y, i.identifier) : e === "touchend" ? (n.pointer.feedUp(o.x, o.y, 0, i.identifier), s.delete(i.identifier)) : (s.delete(i.identifier), n.pointer.feedCancel()), r.cancelable && r.preventDefault();
	};
	return i("touchstart", (e) => u("touchstart", e), { passive: !1 }), i("touchmove", (e) => u("touchmove", e), { passive: !1 }), i("touchend", (e) => u("touchend", e), { passive: !1 }), i("touchcancel", (e) => u("touchcancel", e), { passive: !1 }), i("contextmenu", (e) => {
		e.preventDefault();
	}), { dispose: () => {
		o.value = null, s.clear();
		for (let e of r) e();
	} };
}
//#endregion
//#region src/inspect.ts
var hi = "1";
function gi(e) {
	let { stage: t, scenes: n } = e;
	if (typeof window > "u") return yi(t, n);
	let r = yi(t, n);
	return vi().__R3__ = r, r;
}
function _i(e) {
	if (typeof window > "u") return;
	let t = vi();
	t.__R3__ && t.__R3__.getStage() === e && delete t.__R3__;
}
function vi() {
	return window;
}
function yi(e, t) {
	return {
		version: "1",
		getStage: () => e,
		getActiveScenes: () => t ? t.activeScenes.map((e) => e.name) : [],
		screenSize: () => ({
			width: e.screen.width,
			height: e.screen.height
		}),
		listNodes: () => bi(e),
		findNodes: (t) => bi(e).filter((e) => wi(e, t)),
		click: (t, n) => {
			e.pointer.feedMove(t, n), e.pointer.feedDown(t, n, 0), e.pointer.feedUp(t, n, 0);
		},
		pointerDown: (t, n) => {
			e.pointer.feedMove(t, n), e.pointer.feedDown(t, n, 0);
		},
		pointerUp: (t, n) => {
			e.pointer.feedMove(t, n), e.pointer.feedUp(t, n, 0);
		},
		clickByName: (t) => {
			let n = (e) => typeof t == "string" ? e.name === t : t.test(e.name), r = bi(e).filter((e) => e.hit !== null && e.visible && n(e))[0];
			return !r || !r.hitCenter ? !1 : (e.pointer.feedMove(r.hitCenter.x, r.hitCenter.y), e.pointer.feedDown(r.hitCenter.x, r.hitCenter.y, 0), e.pointer.feedUp(r.hitCenter.x, r.hitCenter.y, 0), !0);
		}
	};
}
function bi(e) {
	let t = [];
	return xi(e.root, [], t), t;
}
function xi(e, t, n) {
	let r = Si(e, t);
	if (n.push(r), e instanceof i) {
		let r = [...t, e.name];
		for (let t of e.children) xi(t, r, n);
	}
}
function Si(e, t) {
	let n = e.getWorldPosition(), r = e.hitArea, i = r ? {
		width: r.width,
		height: r.height
	} : null, a = Ci(n, r);
	return {
		name: e.name,
		kind: e.constructor.name,
		path: [...t, e.name],
		worldX: n.x,
		worldY: n.y,
		hit: i,
		hitCenter: a,
		visible: e.worldVisible,
		alpha: e.worldAlpha
	};
}
function Ci(e, t) {
	return t ? {
		x: e.x + t.x + t.width / 2,
		y: e.y + t.y + t.height / 2
	} : null;
}
function wi(e, t) {
	return !(t.name !== void 0 && e.name !== t.name || t.nameLike !== void 0 && !t.nameLike.test(e.name) || t.kind !== void 0 && e.kind !== t.kind || t.interactive !== void 0 && e.hit !== null !== t.interactive);
}
//#endregion
export { H as COLOR, U as COLOR_HEX, i as Container, o as DEPTH_SCALE, fe as DragManager, W as FONT, De as FlatPanelRect, s as Graphics, l as Linear, t as Node, ie as PC_SCREEN, M as PointerManager, ke as R3Image, Zr as R3LayoutCursor, he as R3LayoutRoot, ge as R3MotionRoot, mr as R3ScrollablePanel, hi as R3_INSPECTOR_VERSION, P as Rect, x as SPOTLIGHT_OVERLAY_DEPTH, vt as Scene, yt as SceneManager, ir as ScrollModel, me as Stage, B as Text, c as TweenManager, r as acquireRaster, mi as attachCanvasPointerBridge, Mt as bindR3SfxPlayer, Ye as buildFontShorthand, rr as classifyAxisGesture, y as computeSpotlightOverlayLayout, f as configureR3GraphicsPolicy, $t as configureR3ImageSlotProvider, Tt as configureR3Theme, Yt as createR3Button, be as createR3CenteredMotionSurface, Mn as createR3Heading, fn as createR3HudPanel, _e as createR3LayoutRoot, ve as createR3MotionRoot, ye as createR3MotionSurface, An as createR3OrnateButton, nn as createR3Panel, gn as createR3Plaque, _n as createR3PlaqueButton, pn as createR3ResizableHudPanel, pi as createR3Select, Xr as createR3TabBar, ci as createR3TextInput, b as createSpotlightArrowRenderer, Zt as createUrlImageSlotProvider, d as getGraphicsPolicy, gi as installR3Inspector, v as installSpotlightOverlay, si as isR3TextInputElement, j as makeScreen, $n as openR3Dialog, Ce as playR3MotionPressPulse, we as playR3MotionRejectShake, G as playR3Sfx, At as r3FadeIn, kt as r3FadeToScene, a as rasterCacheStats, n as releaseRaster, Se as resetR3MotionRoot, u as resolveEasing, Xe as snapshotMetrics, e as trimCachedTextures, xe as tweenR3MotionScale, _i as uninstallR3Inspector, re as withViewbox, Ue as wrapText };
