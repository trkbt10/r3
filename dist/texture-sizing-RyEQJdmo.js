//#region src/graphics-policy/index.ts
var e = { policy: { uiTexturePixelRatio: "device" } };
function t() {
	return { ...e.policy };
}
function n(t) {
	Object.assign(e.policy, t);
}
function r(e) {
	return !Number.isFinite(e) || e < 1 ? 1 : e > 2 ? 2 : e;
}
function i() {
	return e.policy.uiTexturePixelRatio === "logical" ? 1 : r(typeof window > "u" ? 1 : window.devicePixelRatio ?? 1);
}
//#endregion
//#region src/texture-sizing.ts
function a() {
	return i();
}
function o(e) {
	let t = e.rounding ?? "integer", n = c(e.maxTextureSize);
	return {
		width: Math.min(l(e.logicalWidth * e.pixelRatio, t), n),
		height: Math.min(l(e.logicalHeight * e.pixelRatio, t), n)
	};
}
function s(e, t, n) {
	return {
		x: n.width / Math.max(1, e),
		y: n.height / Math.max(1, t)
	};
}
function c(e) {
	return e === void 0 || !Number.isFinite(e) ? 2 ** 53 - 1 : Math.max(1, Math.floor(e));
}
function l(e, t) {
	let n = Math.max(1, Math.ceil(Number.isFinite(e) ? e : 1));
	return t === "power-of-two" ? u(n) : t === "even" && n % 2 != 0 ? n + 1 : n;
}
function u(e) {
	return 2 ** Math.ceil(Math.log2(Math.max(1, e)));
}
//#endregion
export { t as a, n as i, o as n, s as r, a as t };
