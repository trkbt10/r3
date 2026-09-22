import { n as e } from "../texture-sizing-RyEQJdmo.js";
import { CanvasTexture as t } from "three";
//#region src/texture-canvas/createTextureCanvas.ts
var n = 2048, r = { value: "unknown" }, i = { maxTextureSize: n };
function a() {
	if (typeof OffscreenCanvas > "u") return !1;
	try {
		return new OffscreenCanvas(1, 1).getContext("2d") !== null;
	} catch (e) {
		return console.info("OffscreenCanvas probe failed", e), !1;
	}
}
function o() {
	return r.value === "unknown" && (r.value = a() ? "offscreen" : "html"), r.value;
}
function s() {
	return o() === "offscreen";
}
function c() {
	r.value = "unknown";
}
function l(e) {
	i.maxTextureSize = Math.min(n, f(e));
}
function u() {
	i.maxTextureSize = n;
}
function d(t) {
	return e({
		...t,
		maxTextureSize: Math.min(i.maxTextureSize, f(t.maxTextureSize))
	});
}
function f(e) {
	if (e === void 0 || !Number.isFinite(e)) return n;
	let t = Math.max(1, Math.floor(e));
	return t === 1 || t % 2 == 0 ? t : t - 1;
}
function p(e = 1, t = 1) {
	let n = Math.max(1, Math.round(e)), r = Math.max(1, Math.round(t));
	if (o() === "offscreen") return new OffscreenCanvas(n, r);
	if (typeof document > "u") throw Error("r3/texture-canvas: runtime exposes neither a usable OffscreenCanvas nor document.createElement — cannot allocate a canvas");
	let i = document.createElement("canvas");
	return i.width = n, i.height = r, i;
}
function m(e) {
	e.width = 0, e.height = 0;
}
function h(e) {
	m(e);
}
var g = class extends t {
	disposed = !1;
	constructor(e) {
		super(e), this.sourceCanvas = e;
	}
	dispose() {
		this.disposed || (this.disposed = !0, super.dispose(), m(this.sourceCanvas));
	}
};
function _(e) {
	return new g(e);
}
function v(e) {
	return new t(e);
}
function y(e) {
	return typeof OffscreenCanvas < "u" && e instanceof OffscreenCanvas, e.getContext("2d");
}
var b = {
	createCanvas: p,
	createOwnedCanvasTexture: _,
	createBorrowedCanvasTexture: v,
	disposeCanvasSource: h,
	acquireCanvas2DContext: y,
	resolveTexturePixelSize: d,
	configureMaxTextureSize: l,
	isOffscreenCanvasActive: s,
	resetStrategyForTests: c,
	resetPolicyForTests: u
};
function x(e = 1, t = 1) {
	return b.createCanvas(e, t);
}
function S(e) {
	return b.createOwnedCanvasTexture(e);
}
function C(e) {
	b.disposeCanvasSource(e);
}
function w(e) {
	return b.acquireCanvas2DContext(e);
}
function T(e) {
	return b.resolveTexturePixelSize(e);
}
function E(e) {
	b.configureMaxTextureSize(e);
}
function D(e) {
	let t = e.getParameter(e.MAX_TEXTURE_SIZE);
	typeof t == "number" && E(t);
}
function O() {
	return b.isOffscreenCanvasActive();
}
function k() {
	b.resetStrategyForTests();
}
function A() {
	b.resetPolicyForTests();
}
//#endregion
export { n as DEFAULT_TEXTURE_CANVAS_MAX_TEXTURE_SIZE, w as acquireTextureCanvas2DContext, E as configureTextureCanvasMaxTextureSize, D as configureTextureCanvasMaxTextureSizeFromContext, S as createManagedCanvasTexture, x as createTextureCanvas, b as defaultTextureManager, C as disposeTextureCanvasSource, O as isOffscreenCanvasActive, A as resetTextureCanvasPolicyForTests, k as resetTextureCanvasStrategyForTests, T as resolveTextureCanvasPixelSize };
