import { r as e, t } from "./texture-sizing-RyEQJdmo.js";
import * as n from "three";
import { LinearFilter as r, Mesh as i, MeshBasicMaterial as a, PlaneGeometry as o, SRGBColorSpace as s } from "three";
//#region src/Node.ts
var c = class {
	obj3d;
	_x;
	_y;
	_pivotX;
	_pivotY;
	_scaleX;
	_scaleY;
	_rotation;
	_alpha;
	_visible;
	_depth;
	_layoutMatrix;
	_worldAlpha;
	_worldVisible;
	_parent;
	_stage;
	name;
	_hitArea;
	_inputClippingPlanes;
	listeners;
	_transformDirty;
	constructor(e) {
		this.obj3d = new n.Group(), this.obj3d.name = e.name ?? "", this.name = e.name ?? "", this._x = e.x ?? 0, this._y = e.y ?? 0, this._pivotX = e.originX ?? 0, this._pivotY = e.originY ?? 0, this._scaleX = e.scaleX ?? 1, this._scaleY = e.scaleY ?? 1, this._rotation = e.rotation ?? 0, this._alpha = e.alpha ?? 1, this._visible = e.visible ?? !0, this._depth = e.depth ?? 0, this._layoutMatrix = null, this._worldAlpha = this._alpha, this._worldVisible = this._visible, this._parent = null, this._stage = null, this._hitArea = null, this._inputClippingPlanes = null, this.listeners = /* @__PURE__ */ new Map(), this._transformDirty = !0, this.applyTransform();
	}
	get x() {
		return this._x;
	}
	get y() {
		return this._y;
	}
	get pivotX() {
		return this._pivotX;
	}
	get pivotY() {
		return this._pivotY;
	}
	get scaleX() {
		return this._scaleX;
	}
	get scaleY() {
		return this._scaleY;
	}
	get rotation() {
		return this._rotation;
	}
	get alpha() {
		return this._alpha;
	}
	get visible() {
		return this._visible;
	}
	get depth() {
		return this._depth;
	}
	get worldAlpha() {
		return this._worldAlpha;
	}
	get worldVisible() {
		return this._worldVisible;
	}
	get parent() {
		return this._parent;
	}
	get stage() {
		return this._stage;
	}
	setPosition(e, t) {
		return e === this._x && t === this._y ? this : (this._x = e, this._y = t, this.applyTransform(), this);
	}
	set x(e) {
		e !== this._x && (this._x = e, this.applyTransform());
	}
	set y(e) {
		e !== this._y && (this._y = e, this.applyTransform());
	}
	setOrigin(e, t) {
		let n = t ?? e;
		return e === this._pivotX && n === this._pivotY ? this : (this._pivotX = e, this._pivotY = n, this.onPivotChanged(), this);
	}
	setScale(e, t) {
		let n = t ?? e;
		return e === this._scaleX && n === this._scaleY ? this : (this._scaleX = e, this._scaleY = n, this.applyTransform(), this);
	}
	set scaleX(e) {
		e !== this._scaleX && (this._scaleX = e, this.applyTransform());
	}
	set scaleY(e) {
		e !== this._scaleY && (this._scaleY = e, this.applyTransform());
	}
	setRotation(e) {
		return e === this._rotation ? this : (this._rotation = e, this.applyTransform(), this);
	}
	set rotation(e) {
		this.setRotation(e);
	}
	setAlpha(e) {
		let t = Math.max(0, Math.min(1, e));
		return t === this._alpha || (this._alpha = t), this;
	}
	set alpha(e) {
		this.setAlpha(e);
	}
	setVisible(e) {
		return e === this._visible || (this._visible = e), this;
	}
	set visible(e) {
		this.setVisible(e);
	}
	setDepth(e) {
		return e === this._depth || (this._depth = e), this;
	}
	set depth(e) {
		this.setDepth(e);
	}
	setLayoutMatrix(e) {
		return e === null ? (this._layoutMatrix = null, this.applyTransform(), this) : (this._layoutMatrix = e.clone(), this.applyTransform(), this);
	}
	_attachToParent(e) {
		this._parent = e, this.propagateStage(e?.stage ?? null);
	}
	_attachToStage(e) {
		this.propagateStage(e);
	}
	propagateStage(e) {
		this._stage = e;
	}
	setInteractive(e) {
		return this._hitArea = e, this;
	}
	get hitArea() {
		return this._hitArea;
	}
	get inputClippingPlanes() {
		return this._inputClippingPlanes;
	}
	on(e, t) {
		let n = this.listeners.get(e) ?? /* @__PURE__ */ new Set();
		return n.add(t), this.listeners.set(e, n), this;
	}
	off(e, t) {
		let n = this.listeners.get(e);
		return n && n.delete(t), this;
	}
	once(e, t) {
		let n = (r) => {
			this.off(e, n), t(r);
		};
		return this.on(e, n);
	}
	removeAllListeners(e) {
		return e === void 0 ? (this.listeners.clear(), this) : (this.listeners.delete(e), this);
	}
	_emit(e, t) {
		let n = this.listeners.get(e);
		if (!n || n.size === 0) return;
		let r = Array.from(n);
		for (let e of r) e(t);
	}
	hasListener(e) {
		let t = this.listeners.get(e);
		return t ? t.size > 0 : !1;
	}
	composeWorldState(e, t) {
		this._worldAlpha = this._alpha * e, this._worldVisible = this._visible && t, this.obj3d.visible = this._worldVisible, this.applyMaterialAlpha(this._worldAlpha);
	}
	applyMaterialAlpha(e) {}
	setClippingPlanes(e) {
		this._inputClippingPlanes = e;
	}
	composeRenderOrder(e, t) {
		let n = t + this._depth * l;
		return this.assignRenderOrderForSelf(e, n);
	}
	assignRenderOrderForSelf(e, t) {
		return e + 1;
	}
	applyTransform() {
		if (this._layoutMatrix === null) {
			this.obj3d.matrixAutoUpdate = !0, this.obj3d.position.set(this._x, -this._y, 0), this.obj3d.rotation.set(0, 0, -this._rotation), this.obj3d.scale.set(this._scaleX, this._scaleY, 1), this.obj3d.updateMatrix(), this._transformDirty = !0;
			return;
		}
		this.obj3d.matrixAutoUpdate = !1, this.obj3d.matrix.makeTranslation(this._x, -this._y, 0).multiply(d.makeRotationZ(-this._rotation)).multiply(d.makeScale(this._scaleX, this._scaleY, 1)).multiply(this._layoutMatrix), this.obj3d.matrixWorldNeedsUpdate = !0, this._transformDirty = !0;
	}
	onPivotChanged() {}
	destroy() {
		this._stage?.tweens.killTweensOf(this), this._stage?.pointer.notifyNodeDestroyed(this), this._stage?.drag.notifyNodeDestroyed(this), this._parent && this._parent.removeChild(this), this.listeners.clear(), this.obj3d.parent && this.obj3d.parent.remove(this.obj3d);
	}
	getWorldPosition() {
		this.obj3d.updateWorldMatrix(!0, !1);
		let e = u;
		return e.set(0, 0, 0), e.applyMatrix4(this.obj3d.matrixWorld), {
			x: e.x,
			y: -e.y
		};
	}
}, l = 1e3, u = new n.Vector3(), d = new n.Matrix4(), f = class extends c {
	_children;
	_clippingPlanes = null;
	constructor(e = {}) {
		super(e), this._children = [];
	}
	get children() {
		return this._children;
	}
	get length() {
		return this._children.length;
	}
	add(e) {
		if (e === this) throw Error("Container.add: cannot add container to itself");
		let t = e.parent;
		if (t) {
			if (t === this) return this;
			t.removeChild(e);
		}
		return this._children.push(e), this.obj3d.add(e.obj3d), e._attachToParent(this), this._clippingPlanes !== null && e.setClippingPlanes(this._clippingPlanes), this;
	}
	addAll(e) {
		for (let t of e) this.add(t);
		return this;
	}
	removeChild(e) {
		let t = this._children.indexOf(e);
		return t < 0 ? this : (this._children.splice(t, 1), this.obj3d.remove(e.obj3d), e._attachToParent(null), this);
	}
	removeAll(e = !1) {
		let t = this._children.slice();
		for (let n of t) this.removeChild(n), e && n.destroy();
		return this;
	}
	setInteractiveRect(e, t) {
		return this.setInteractive({
			x: 0,
			y: 0,
			width: e,
			height: t
		}), this;
	}
	disableInteractive() {
		return this.setInteractive(null), this;
	}
	composeWorldState(e, t) {
		super.composeWorldState(e, t);
		for (let e of this._children) e.composeWorldState(this._worldAlpha, this._worldVisible);
	}
	composeRenderOrder(e, t) {
		let n = t + this.depth * p;
		return this._children.reduce((e, t) => t.composeRenderOrder(e, n), e);
	}
	propagateStage(e) {
		super.propagateStage(e);
		for (let t of this._children) t._attachToStage(e);
	}
	setClippingPlanes(e) {
		this._clippingPlanes = e, super.setClippingPlanes(e);
		for (let t of this._children) t.setClippingPlanes(e);
	}
	destroy() {
		this.removeAll(!0), super.destroy();
	}
	get hitArea() {
		return this._hitArea;
	}
}, p = 1e3, m = {
	entries: /* @__PURE__ */ new Map(),
	totalBytes: 0,
	entryCount: 0,
	lastBudgetWarningEntries: 0,
	lastBudgetWarningBytes: 0,
	nextMutableSurfaceId: 0
}, h = 512, g = 64 * 1024 * 1024;
function _(e, t, n, r = I, i) {
	let a = n, o = m.entries.get(e);
	if (o) return o.refCount += 1, o;
	let s = a.createCanvas(1, 1), c = t(s), l = a.createOwnedCanvasTexture(s);
	r(l);
	let u = Math.max(1, s.width * s.height * 4), d = {
		key: e,
		canvas: s,
		texture: l,
		cssWidth: c.cssWidth,
		cssHeight: c.cssHeight,
		byteSize: u,
		debugInfo: i,
		refCount: 1
	};
	return m.entries.set(e, d), m.totalBytes += u, m.entryCount += 1, D(d), d;
}
function v(e) {
	let t = e.textureManager.resolveTexturePixelSize(e), n = e.textureManager.createCanvas(t.width, t.height), r = e.textureManager.createOwnedCanvasTexture(n);
	(e.configureTexture ?? I)(r);
	let i = S(e.debugInfo), a = {
		key: i,
		canvas: n,
		texture: r,
		cssWidth: Math.max(1, e.logicalWidth),
		cssHeight: Math.max(1, e.logicalHeight),
		byteSize: Math.max(1, n.width * n.height * 4),
		debugInfo: e.debugInfo ?? { kind: "MutableRasterSurface" },
		refCount: 1
	};
	return m.entries.set(i, a), m.totalBytes += a.byteSize, m.entryCount += 1, D(a), w(a, e, t.width, t.height);
}
function y(t, n) {
	let r = n.textureManager.resolveTexturePixelSize(n);
	if (t.pixelWidth === r.width && t.pixelHeight === r.height) return C(t.cacheKey, n), {
		...t,
		logicalWidth: Math.max(1, n.logicalWidth),
		logicalHeight: Math.max(1, n.logicalHeight),
		scale: e(n.logicalWidth, n.logicalHeight, r)
	};
	let i = v(n);
	return b(t), i;
}
function b(e) {
	let t = m.entries.get(e.cacheKey);
	!t || t.texture !== e.texture || O(t);
}
function x(e) {
	let t = m.entries.get(e);
	t && (--t.refCount, !(t.refCount > 0) && O(t));
}
function S(e) {
	return m.nextMutableSurfaceId += 1, `mutable-raster:${e?.kind ?? "MutableRasterSurface"}:${String(m.nextMutableSurfaceId)}`;
}
function C(e, t) {
	let n = m.entries.get(e);
	n && (n.cssWidth = Math.max(1, t.logicalWidth), n.cssHeight = Math.max(1, t.logicalHeight));
}
function w(t, n, r, i) {
	return {
		cacheKey: t.key,
		canvas: t.canvas,
		ctx: n.textureManager.acquireCanvas2DContext(t.canvas),
		texture: t.texture,
		pixelWidth: r,
		pixelHeight: i,
		logicalWidth: Math.max(1, n.logicalWidth),
		logicalHeight: Math.max(1, n.logicalHeight),
		scale: e(n.logicalWidth, n.logicalHeight, {
			width: r,
			height: i
		})
	};
}
function T() {}
function E() {
	return {
		entries: m.entryCount,
		bytes: m.totalBytes,
		idle: 0
	};
}
function D(e) {
	m.entryCount <= h && m.totalBytes <= g || m.entryCount <= m.lastBudgetWarningEntries && m.totalBytes <= m.lastBudgetWarningBytes || (m.lastBudgetWarningEntries = m.entryCount, m.lastBudgetWarningBytes = m.totalBytes, console.warn([
		"TextureCache: live raster budget exceeded; continuing with the new raster.",
		`caps=${String(h)} entries / ${F(g)}`,
		`live=${String(m.entryCount)} entries / ${F(m.totalBytes)}`,
		`incoming=${A(e)}`,
		`largestLive=${k(8)}`
	].join(" ")));
}
function O(e) {
	m.entries.delete(e.key), m.totalBytes -= e.byteSize, --m.entryCount, m.entryCount <= h && m.totalBytes <= g && (m.lastBudgetWarningEntries = 0, m.lastBudgetWarningBytes = 0), e.texture.dispose();
}
function k(e) {
	return `[${Array.from(m.entries.values()).sort((e, t) => t.byteSize - e.byteSize).slice(0, e).map(A).join(", ")}]`;
}
function A(e) {
	return j(e).join(" ");
}
function j(e) {
	let t = M(e.debugInfo);
	return t.length === 0 ? [
		"{",
		`key=${JSON.stringify(N(e.key))}`,
		`canvas=${String(e.canvas.width)}x${String(e.canvas.height)}`,
		`css=${P(e.cssWidth)}x${P(e.cssHeight)}`,
		`bytes=${F(e.byteSize)}`,
		`refs=${String(e.refCount)}`,
		"}"
	] : [
		"{",
		t,
		`key=${JSON.stringify(N(e.key))}`,
		`canvas=${String(e.canvas.width)}x${String(e.canvas.height)}`,
		`css=${P(e.cssWidth)}x${P(e.cssHeight)}`,
		`bytes=${F(e.byteSize)}`,
		`refs=${String(e.refCount)}`,
		"}"
	];
}
function M(e) {
	return e === void 0 ? "" : e.label === void 0 || e.label.length === 0 ? `kind=${JSON.stringify(e.kind)}` : `kind=${JSON.stringify(e.kind)} label=${JSON.stringify(e.label)}`;
}
function N(e) {
	return e.length <= 180 ? e : `${e.slice(0, 179)}…`;
}
function P(e) {
	return Number.isFinite(e) ? Number.isInteger(e) ? String(e) : e.toFixed(2) : String(e);
}
function F(e) {
	let t = e / (1024 * 1024);
	return `${String(e)} bytes (${t.toFixed(2)} MiB)`;
}
function I(e) {
	e.colorSpace = s, e.minFilter = r, e.magFilter = r, e.generateMipmaps = !1, e.needsUpdate = !0;
}
//#endregion
//#region src/canvas-texture-surface.ts
function L(e) {
	return v({
		...e,
		debugInfo: e.debugInfo ?? { kind: "CanvasTextureSurface" }
	});
}
function R(e, t) {
	return y(e, {
		...t,
		debugInfo: t.debugInfo ?? { kind: "CanvasTextureSurface" }
	});
}
function z(e) {
	b(e);
}
//#endregion
//#region src/Graphics.ts
function B(e, t) {
	let n = e >> 16 & 255, r = e >> 8 & 255, i = e & 255;
	return `rgba(${String(n)}, ${String(r)}, ${String(i)}, ${String(t)})`;
}
var V = class extends c {
	_width;
	_height;
	surface;
	geometry;
	material;
	mesh;
	textureManager;
	style;
	constructor(e) {
		super(e), this._width = e.width, this._height = e.height, this.textureManager = e.textureManager, this.surface = L({
			logicalWidth: this._width,
			logicalHeight: this._height,
			pixelRatio: t(),
			rounding: "even",
			textureManager: this.textureManager,
			debugInfo: this.rasterDebugInfo()
		}), this.applyCanvasTransform(), this.material = new a({
			map: this.texture,
			transparent: !0,
			depthTest: !1,
			depthWrite: !1
		}), this.geometry = new o(1, 1), this.mesh = new i(this.geometry, this.material), this.mesh.frustumCulled = !1, this.mesh.scale.set(this._width, this._height, 1), this.obj3d.add(this.mesh), this.style = {
			fillColor: "#ffffff",
			fillAlpha: 1,
			strokeColor: "#ffffff",
			strokeAlpha: 1,
			lineWidth: 1
		}, this.applyMeshOffset();
	}
	get width() {
		return this._width;
	}
	get height() {
		return this._height;
	}
	get canvas() {
		return this.surface.canvas;
	}
	get ctx() {
		return this.ensureSurfaceMatchesSettings(), this.surface.ctx;
	}
	get texture() {
		return this.surface.texture;
	}
	setSize(e, t) {
		let n = Math.max(1, e), r = Math.max(1, t);
		return n === this._width && r === this._height ? this : (this._width = n, this._height = r, this.resizeSurfaceForCurrentSettings(), this.mesh.scale.set(n, r, 1), this.texture.needsUpdate = !0, this.applyMeshOffset(), this);
	}
	clear() {
		return this.ctx ? (this.ctx.save(), this.ctx.setTransform(1, 0, 0, 1, 0, 0), this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height), this.ctx.restore(), this.ctx.beginPath(), this.texture.needsUpdate = !0, this) : this;
	}
	fillStyle(e, t = 1) {
		return this.style.fillColor = B(e, t), this.style.fillAlpha = t, this;
	}
	lineStyle(e, t, n = 1) {
		return this.style.strokeColor = B(t, n), this.style.strokeAlpha = n, this.style.lineWidth = e, this;
	}
	fillRect(e, t, n, r) {
		return this.ctx ? (this.ctx.fillStyle = this.style.fillColor, this.ctx.fillRect(e, t, n, r), this.texture.needsUpdate = !0, this) : this;
	}
	strokeRect(e, t, n, r) {
		return this.ctx ? (this.ctx.strokeStyle = this.style.strokeColor, this.ctx.lineWidth = this.style.lineWidth, this.ctx.strokeRect(e, t, n, r), this.texture.needsUpdate = !0, this) : this;
	}
	fillRoundedRect(e, t, n, r, i) {
		return this.ctx ? (this.pathRoundedRect(e, t, n, r, i), this.ctx.fillStyle = this.style.fillColor, this.ctx.fill(), this.texture.needsUpdate = !0, this) : this;
	}
	strokeRoundedRect(e, t, n, r, i) {
		return this.ctx ? (this.pathRoundedRect(e, t, n, r, i), this.ctx.strokeStyle = this.style.strokeColor, this.ctx.lineWidth = this.style.lineWidth, this.ctx.stroke(), this.texture.needsUpdate = !0, this) : this;
	}
	fillBlurredRoundedRect(e, t, n, r, i, a) {
		if (!this.ctx) return this;
		this.pathRoundedRect(e, t, n, r, i);
		let o = this.ctx.filter;
		return this.ctx.filter = a > 0 ? `blur(${String(a)}px)` : "none", this.ctx.fillStyle = this.style.fillColor, this.ctx.fill(), this.ctx.filter = o, this.texture.needsUpdate = !0, this;
	}
	fillPatternRoundedRect(e, t, n, r, i, a, o = 1, s, c) {
		if (!this.ctx) return this;
		let l = H(a), u = U(a);
		if (l <= 0 || u <= 0) return this;
		let d = s ?? l, f = c ?? u;
		if (d <= 0 || f <= 0 || n <= 0 || r <= 0) return this;
		this.pathRoundedRect(e, t, n, r, i), this.ctx.save(), this.ctx.clip();
		let p = this.ctx.globalAlpha;
		this.ctx.globalAlpha = p * Math.max(0, Math.min(1, o));
		for (let i = t; i < t + r; i += f) for (let t = e; t < e + n; t += d) this.ctx.drawImage(a, t, i, d, f);
		return this.ctx.restore(), this.texture.needsUpdate = !0, this;
	}
	fillCircle(e, t, n) {
		return this.ctx ? (this.ctx.beginPath(), this.ctx.arc(e, t, n, 0, Math.PI * 2), this.ctx.closePath(), this.ctx.fillStyle = this.style.fillColor, this.ctx.fill(), this.texture.needsUpdate = !0, this) : this;
	}
	strokeCircle(e, t, n) {
		return this.ctx ? (this.ctx.beginPath(), this.ctx.arc(e, t, n, 0, Math.PI * 2), this.ctx.closePath(), this.ctx.strokeStyle = this.style.strokeColor, this.ctx.lineWidth = this.style.lineWidth, this.ctx.stroke(), this.texture.needsUpdate = !0, this) : this;
	}
	fillTriangle(e, t, n, r, i, a) {
		return this.ctx ? (this.ctx.beginPath(), this.ctx.moveTo(e, t), this.ctx.lineTo(n, r), this.ctx.lineTo(i, a), this.ctx.closePath(), this.ctx.fillStyle = this.style.fillColor, this.ctx.fill(), this.texture.needsUpdate = !0, this) : this;
	}
	strokeLine(e, t, n, r) {
		return this.ctx ? (this.ctx.beginPath(), this.ctx.moveTo(e, t), this.ctx.lineTo(n, r), this.ctx.strokeStyle = this.style.strokeColor, this.ctx.lineWidth = this.style.lineWidth, this.ctx.stroke(), this.texture.needsUpdate = !0, this) : this;
	}
	beginPath() {
		return this.ctx && this.ctx.beginPath(), this;
	}
	moveTo(e, t) {
		return this.ctx && this.ctx.moveTo(e, t), this;
	}
	lineTo(e, t) {
		return this.ctx && this.ctx.lineTo(e, t), this;
	}
	closePath() {
		return this.ctx && this.ctx.closePath(), this;
	}
	fillPath() {
		return this.ctx ? (this.ctx.fillStyle = this.style.fillColor, this.ctx.fill(), this.texture.needsUpdate = !0, this) : this;
	}
	strokePath() {
		return this.ctx ? (this.ctx.strokeStyle = this.style.strokeColor, this.ctx.lineWidth = this.style.lineWidth, this.ctx.stroke(), this.texture.needsUpdate = !0, this) : this;
	}
	pathRoundedRect(e, t, n, r, i) {
		if (!this.ctx) return;
		let a = Math.max(0, Math.min(i, Math.min(n, r) / 2));
		if (this.ctx.beginPath(), a <= 0) {
			this.ctx.rect(e, t, n, r);
			return;
		}
		this.ctx.moveTo(e + a, t), this.ctx.lineTo(e + n - a, t), this.ctx.arcTo(e + n, t, e + n, t + a, a), this.ctx.lineTo(e + n, t + r - a), this.ctx.arcTo(e + n, t + r, e + n - a, t + r, a), this.ctx.lineTo(e + a, t + r), this.ctx.arcTo(e, t + r, e, t + r - a, a), this.ctx.lineTo(e, t + a), this.ctx.arcTo(e, t, e + a, t, a), this.ctx.closePath();
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
		this.material.dispose(), z(this.surface), this.geometry.dispose(), super.destroy();
	}
	ensureSurfaceMatchesSettings() {
		this.resizeSurfaceForCurrentSettings();
	}
	resizeSurfaceForCurrentSettings() {
		let e = this.surface.texture, n = R(this.surface, {
			logicalWidth: this._width,
			logicalHeight: this._height,
			pixelRatio: t(),
			rounding: "even",
			textureManager: this.textureManager,
			debugInfo: this.rasterDebugInfo()
		});
		this.surface = n, this.applyCanvasTransform(), n.texture !== e && (this.material.map = n.texture, this.material.needsUpdate = !0);
	}
	applyCanvasTransform() {
		let e = this.surface.ctx;
		e && (e.setTransform(1, 0, 0, 1, 0, 0), e.scale(this.surface.scale.x, this.surface.scale.y));
	}
	rasterDebugInfo() {
		return {
			kind: "Graphics",
			label: this.name
		};
	}
};
function H(e) {
	return typeof e.naturalWidth == "number" ? e.naturalWidth : typeof e.videoWidth == "number" ? e.videoWidth : e.width;
}
function U(e) {
	return typeof e.naturalHeight == "number" ? e.naturalHeight : typeof e.videoHeight == "number" ? e.videoHeight : e.height;
}
//#endregion
export { T as a, c, x as i, _ as n, f as o, E as r, l as s, V as t };
