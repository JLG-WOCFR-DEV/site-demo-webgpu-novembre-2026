// src/presse/gesture.ts
var e = class {
	t = [];
	x = [];
	add(e, t) {
		let n = this.t.length;
		for (n && e < this.t[n - 1] && this.reset(), n && e === this.t[this.t.length - 1] ? this.x[this.x.length - 1] = t : (this.t.push(e), this.x.push(t)); this.t.length > 20 || this.t.length > 2 && e - this.t[0] > 100;) this.t.shift(), this.x.shift();
	}
	reset() {
		this.t.length = 0, this.x.length = 0;
	}
	get(e) {
		let n = this.t.length;
		if (n < 2) return 0;
		let r = this.t[n - 1];
		if (e !== void 0 && e - r > 40) return 0;
		let i = n - 1;
		for (; i > 0 && r - this.t[i - 1] <= 100 && this.t[i] - this.t[i - 1] <= 40;) i--;
		if (i === n - 1) return 0;
		let a = 0;
		for (let e = i + 1; e < n; e++) {
			let n = (this.t[e] - this.t[e - 1]) / 1e3;
			if (n <= 0) continue;
			let r = t(a), o = (this.x[e] - this.x[e - 1]) / n;
			a += (o - r) * Math.abs(o), e === i + 1 && (a *= .5);
		}
		return t(a);
	}
}, t = (e) => Math.sign(e) * Math.sqrt(2 * Math.abs(e)), n = {
	normale: .998,
	rapide: .99
};
function r(e, t, r = n.normale) {
	return e + t / 1e3 * (r / (1 - r));
}
var i = {
	lacher: {
		reponse: .38,
		rebond: .18
	},
	place: {
		reponse: .32,
		rebond: 0
	},
	doux: {
		reponse: .55,
		rebond: 0
	},
	effet: {
		reponse: .22,
		rebond: 0
	}
};
function a(e, t, n, r, i) {
	if (n <= 0) return [e, t];
	if (i < 1 - 1e-6) {
		let a = r * Math.sqrt(1 - i * i), o = Math.exp(-i * r * n), s = Math.cos(a * n), c = Math.sin(a * n), l = (t + i * r * e) / a, u = o * (e * s + l * c);
		return [u, o * (-e * a * c + l * a * s) - i * r * u];
	}
	if (i <= 1 + 1e-6) {
		let i = Math.exp(-r * n), a = t + r * e;
		return [(e + a * n) * i, (t - r * n * a) * i];
	}
	let a = r * Math.sqrt(i * i - 1), o = -i * r + a, s = -i * r - a, c = (t - o * e) / (s - o), l = e - c, u = Math.exp(o * n), d = Math.exp(s * n);
	return [l * u + c * d, l * o * u + c * s * d];
}
var o = class {
	x;
	v = 0;
	cible;
	w0;
	zeta;
	lo = -Infinity;
	hi = Infinity;
	tenu = !1;
	classe;
	eps;
	constructor(e, t = i.lacher, n = "espace", r = n === "effet" ? 1 / 256 : 1 / 64) {
		this.classe = n, this.eps = r, this.x = this.cible = e, this.w0 = 0, this.zeta = 1, this.regle(t);
	}
	regle(e) {
		return this.w0 = 2 * Math.PI / Math.max(.02, e.reponse), this.zeta = this.classe === "effet" ? Math.max(1, 1 - e.rebond) : 1 - Math.min(.95, Math.max(-1, e.rebond)), this;
	}
	vers(e) {
		return this.tenu = !1, this.cible = e, this.borne(), this;
	}
	tiens(e, t = this.v) {
		this.tenu = !0, this.x = this.cible = e, this.v = t;
	}
	lacher(e, t = this.cible) {
		return this.tenu = !1, this.v = e, this.cible = t, this.borne(), this;
	}
	pose(e) {
		this.tenu = !1, this.x = this.cible = e, this.v = 0;
	}
	get repos() {
		return !this.tenu && this.x === this.cible && this.v === 0;
	}
	pas(e) {
		if (this.tenu || this.repos) return !1;
		let [t, n] = a(this.x - this.cible, this.v, e, this.w0, this.zeta);
		return this.x = this.cible + t, this.v = n, this.classe === "effet" && (this.x = Math.min(this.hi, Math.max(this.lo, this.x))), Math.abs(t) < this.eps && Math.abs(n) < this.eps * 8 ? (this.x = this.cible, this.v = 0, !1) : !0;
	}
	borne() {
		this.lo = Math.min(this.x, this.cible), this.hi = Math.max(this.x, this.cible);
	}
};
function s(e, t, n, r = typeof devicePixelRatio == "number" ? devicePixelRatio : 1) {
	let i = t === "x" && n ? 4 * r : r;
	return Math.round(e * i) / i;
}
export { s as a, e as i, i as n, a as o, o as r, r as s, n as t };
