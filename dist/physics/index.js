//#region src/physics/viscous-lattice.ts
var e = (e, t, n) => Math.min(n, Math.max(t, Number.isFinite(e) ? e : 0));
function t(t) {
	let n = new Float64Array(81), r = new Float64Array(81), i = new Float64Array(81), a = new Float64Array(27), o = e(t.softness, 0, 1), s = e(t.viscosity, 0, 1), c = e(t.elasticity, 0, 1), l = e(t.stickiness, 0, 1), u = 18 + c * 65 + (1 - o) * 28, d = 3 + s * 25 + l * 3, f = {
		held: !1,
		adhesion: 0,
		target: [
			0,
			0,
			0
		]
	}, p = [];
	for (let e = 0; e < 3; e += 1) for (let t = 0; t < 3; t += 1) for (let n = 0; n < 3; n += 1) {
		let r = n + t * 3 + e * 9;
		n < 2 && p.push([r, r + 1]), t < 2 && p.push([r, r + 3]), e < 2 && p.push([r, r + 9]);
	}
	return {
		grab(t) {
			f.held = !0, f.adhesion = 1, f.target.fill(0);
			for (let n = 0; n < 27; n += 1) {
				let r = n % 3 / 2 - .5 - e(t[0], -.5, .5), i = Math.floor(n / 3) % 3 / 2 - .5 - e(t[1], -.5, .5), o = Math.floor(n / 9) / 2 - .5 - e(t[2], -.5, .5);
				a[n] = Math.exp(-(r * r + i * i + o * o) * 5);
			}
		},
		drag(t) {
			for (let n = 0; n < 3; n += 1) f.target[n] = e(t[n] ?? 0, -.4, .4);
		},
		release() {
			f.held = !1;
		},
		pulse(t) {
			let n = e(t, 0, 1) * (.5 + o);
			for (let e = 0; e < 27; e += 1) {
				let t = e % 3 / 2 - .5, i = Math.floor(e / 3) % 3 / 2 - .5, a = Math.floor(e / 9) / 2 - .5;
				r[e * 3] = (r[e * 3] ?? 0) + t * n, r[e * 3 + 1] = (r[e * 3 + 1] ?? 0) - (i + .5) * n, r[e * 3 + 2] = (r[e * 3 + 2] ?? 0) + a * n;
			}
		},
		step(t) {
			let c = e(t, 0, 1 / 15), m = Math.max(1, Math.ceil(c * 120)), h = c / m;
			for (let t = 0; t < m; t += 1) {
				f.held || (f.adhesion *= Math.exp(-h / (.025 + l * .35)));
				for (let e = 0; e < 81; e += 1) i[e] = -(n[e] ?? 0) * u - (r[e] ?? 0) * d;
				for (let [e, t] of p) for (let a = 0; a < 3; a += 1) {
					let c = e * 3 + a, l = t * 3 + a, u = ((n[l] ?? 0) - (n[c] ?? 0)) * (12 + (1 - o) * 30) + ((r[l] ?? 0) - (r[c] ?? 0)) * s * 6;
					i[c] = (i[c] ?? 0) + u, i[l] = (i[l] ?? 0) - u;
				}
				for (let t = 0; t < 81; t += 1) {
					let s = ((f.target[t % 3] ?? 0) * (a[Math.floor(t / 3)] ?? 0) - (n[t] ?? 0)) * (70 + o * 80) * f.adhesion, c = f.adhesion > 1e-4 ? s : 0;
					r[t] = e((r[t] ?? 0) + ((i[t] ?? 0) + c) * h, -3, 3), n[t] = e((n[t] ?? 0) + (r[t] ?? 0) * h, -.45, .45);
				}
			}
		},
		sample(t, r) {
			let i = e((t[0] + .5) * 2, 0, 2), a = e((t[1] + .5) * 2, 0, 2), o = e((t[2] + .5) * 2, 0, 2), s = Math.min(1, Math.floor(i)), c = Math.min(1, Math.floor(a)), l = Math.min(1, Math.floor(o)), u = i - s, d = a - c, f = o - l;
			r[0] = 0, r[1] = 0, r[2] = 0;
			for (let e = 0; e < 2; e += 1) for (let t = 0; t < 2; t += 1) for (let i = 0; i < 2; i += 1) {
				let a = (i ? u : 1 - u) * (t ? d : 1 - d) * (e ? f : 1 - f), o = s + i + (c + t) * 3 + (l + e) * 9;
				for (let e = 0; e < 3; e += 1) r[e] = (r[e] ?? 0) + (n[o * 3 + e] ?? 0) * a;
			}
		},
		get held() {
			return f.held;
		},
		get maxDisplacement() {
			return Math.max(...n.map(Math.abs));
		}
	};
}
//#endregion
export { t as createViscousLattice };
