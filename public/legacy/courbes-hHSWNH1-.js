import { a as e } from "./tokens-Nj0c2PcI.js";
// src/registre/mouvement/courbes.ts
function t(e, t, n, r) {
	let i = 3 * e, a = 3 * (n - e) - i, o = 1 - i - a, s = 3 * t, c = 3 * (r - t) - s, l = 1 - s - c, u = (e) => ((o * e + a) * e + i) * e, d = (e) => ((l * e + c) * e + s) * e, f = (e) => (3 * o * e + 2 * a) * e + i;
	return (e) => {
		if (e <= 0) return 0;
		if (e >= 1) return 1;
		let t = e;
		for (let n = 0; n < 6; n++) {
			let n = u(t) - e;
			if (Math.abs(n) < 1e-6) return d(t);
			let r = f(t);
			if (Math.abs(r) < 1e-6) break;
			t -= n / r;
		}
		let n = 0, r = 1;
		t = e;
		for (let i = 0; i < 30; i++) {
			let i = u(t);
			if (Math.abs(i - e) < 1e-6) break;
			i < e ? n = t : r = t, t = (n + r) / 2;
		}
		return d(t);
	};
}
var n = [
	"jump-start",
	"jump-end",
	"jump-none",
	"jump-both"
];
function r(e, t = "jump-end") {
	let n = t === "jump-none" ? e - 1 : t === "jump-both" ? e + 1 : e;
	return (r) => {
		let i = Math.floor(r * e);
		return (t === "jump-start" || t === "jump-both") && (i += 1), r >= 0 && i < 0 && (i = 0), r <= 1 && i > n && (i = n), i / n;
	};
}
function i(e) {
	let t = [];
	for (let n of e) if (!n.entrees.length) t.push({
		x: null,
		y: n.sortie
	});
	else for (let e of n.entrees.slice(0, 2)) t.push({
		x: e,
		y: n.sortie
	});
	if (!t.length) return [];
	t[0].x === null && (t[0].x = 0);
	let n = t[t.length - 1];
	n.x === null && (n.x = Math.max(1, ...t.map((e) => e.x ?? -Infinity)));
	let r = -Infinity;
	for (let e of t) e.x !== null && (e.x < r && (e.x = r), r = e.x);
	for (let e = 0; e < t.length; e++) {
		if (t[e].x !== null) continue;
		let n = e - 1, r = e;
		for (; t[r].x === null;) r++;
		let i = t[n].x, a = t[r].x;
		for (let o = e; o < r; o++) t[o].x = i + (a - i) * (o - n) / (r - n);
		e = r;
	}
	return t.map((e) => [e.x, e.y]);
}
function a(e) {
	if (e.length < 2) {
		let t = e[0]?.[1] ?? 0;
		return () => t;
	}
	return (t) => {
		let n = 0;
		for (let r = 0; r < e.length; r++) e[r][0] <= t && (n = r);
		n === e.length - 1 && n--;
		let [r, i] = e[n], [a, o] = e[n + 1];
		return r === a ? o : i + (t - r) / (a - r) * (o - i);
	};
}
var o = .002, s = (e, t) => {
	let n = 10 ** t, r = Math.round(e * n) / n;
	return Object.is(r, -0) ? 0 : r;
};
function c(e, t = o, n = 9) {
	let r = [[0, e(0)]], i = (a, o, s, c, l) => {
		let u = (a + s) / 2, d = e(u), f = (e, t) => Math.abs(t - (o + (e - a) / (s - a) * (c - o))), p = a + (s - a) / 4, m = a + (s - a) * 3 / 4;
		(f(u, d) > t || f(p, e(p)) > t || f(m, e(m)) > t) && l < n ? (i(a, o, u, d, l + 1), i(u, d, s, c, l + 1)) : r.push([s, c]);
	};
	for (let t = 0; t < 8; t++) {
		let n = t / 8, a = (t + 1) / 8;
		i(n, r[r.length - 1][1], a, e(a), 0);
	}
	r[r.length - 1] = [1, e(1)];
	let a = [r[0]];
	for (let e = 1; e < r.length - 1; e++) {
		let [n, i] = a[a.length - 1], [o, s] = r[e], [c, l] = r[e + 1];
		Math.abs(s - (i + (o - n) / (c - n) * (l - i))) > t / 4 && a.push(r[e]);
	}
	return a.push(r[r.length - 1]), a;
}
function l(e) {
	return `linear(${e.map(([t, n], r) => {
		let i = String(s(n, 4));
		return r === 0 && t === 0 || r === e.length - 1 && t === 1 ? i : `${i} ${s(t * 100, 2)}%`;
	}).join(", ")})`;
}
function u(e) {
	let t = Math.max(.001, e.masse ?? 1), n = Math.max(.001, e.raideur), r = Math.max(0, e.amortissement), i = e.vitesse ?? 0, a = Math.sqrt(n / t), o = r / (2 * Math.sqrt(n * t));
	if (Math.abs(o - 1) < 1e-6) {
		let e = i - a;
		return (t) => (-1 + e * t) * Math.exp(-a * t);
	}
	if (o < 1) {
		let e = a * Math.sqrt(1 - o * o), t = (i - o * a) / e;
		return (n) => Math.exp(-o * a * n) * (-Math.cos(e * n) + t * Math.sin(e * n));
	}
	let s = Math.sqrt(o * o - 1), c = -a * (o - s), l = -a * (o + s), u = (i + c) / (l - c), d = -1 - u;
	return (e) => d * Math.exp(c * e) + u * Math.exp(l * e);
}
function d(e, t = .001) {
	let n = u(e), r = Math.max(.001, e.masse ?? 1), i = Math.max(0, e.amortissement) / (2 * Math.sqrt(Math.max(.001, e.raideur) * r)), a = 0;
	for (let e = 0; e <= 2e4; e++) Math.abs(n(e / 1e3)) >= t && (a = e);
	let o = Math.max(50, Math.min(2e4, a + 1)), s = o / 1e3, d = (e) => e <= 0 ? 0 : e >= 1 ? 1 : 1 + n(e * s);
	return {
		f: d,
		dureeMs: o,
		zeta: i,
		css: l(c(d))
	};
}
var f = (e) => {
	let t = 7.5625, n = 2.75;
	return e < 1 / n ? t * e * e : e < 2 / n ? t * (e -= 1.5 / n) * e + .75 : e < 2.5 / n ? t * (e -= 2.25 / n) * e + .9375 : t * (e -= 2.625 / n) * e + .984375;
}, p = 2 * Math.PI / 3, m = 2 * Math.PI / 4.5, h = (e) => (t) => t <= 0 ? 0 : t >= 1 ? 1 : e(t), g = {
	"in-elastique": h((e) => -(2 ** (10 * e - 10)) * Math.sin((e * 10 - 10.75) * p)),
	"out-elastique": h((e) => 2 ** (-10 * e) * Math.sin((e * 10 - .75) * p) + 1),
	"in-out-elastique": h((e) => e < .5 ? -(2 ** (20 * e - 10) * Math.sin((20 * e - 11.125) * m)) / 2 : 2 ** (-20 * e + 10) * Math.sin((20 * e - 11.125) * m) / 2 + 1),
	"in-rebond": h((e) => 1 - f(1 - e)),
	"out-rebond": h(f),
	"in-out-rebond": h((e) => e < .5 ? (1 - f(1 - 2 * e)) / 2 : (1 + f(2 * e - 1)) / 2)
}, _ = (e, t, n, r) => ({
	nom: e,
	libelle: t,
	famille: n,
	bezier: r
}), v = (e, t, n, r) => ({
	nom: e,
	libelle: t,
	famille: n,
	f: r
}), y = (e, t, n) => {
	let r = d(n);
	return {
		nom: e,
		libelle: t,
		famille: "ressort",
		f: r.f,
		dureeMs: r.dureeMs,
		ressort: n
	};
}, b = [
	_("lineaire", "Linéaire", "maison", [
		0,
		0,
		1,
		1
	]),
	_("out", "Sortie maison", "maison", [
		.16,
		1,
		.3,
		1
	]),
	_("in-out", "Aller-retour maison", "maison", [
		.65,
		0,
		.35,
		1
	]),
	_("in", "Départ maison", "maison", [
		.55,
		0,
		1,
		.45
	]),
	_("ui-sortie", "Interface : entrée et sortie", "interface", [
		.23,
		1,
		.32,
		1
	]),
	_("ui-ecran", "Interface : déplacement à l'écran", "interface", [
		.77,
		0,
		.175,
		1
	]),
	_("tiroir", "Tiroir (à la iOS)", "interface", [
		.32,
		.72,
		0,
		1
	]),
	_("ease", "CSS ease", "css", [
		.25,
		.1,
		.25,
		1
	]),
	_("ease-in", "CSS ease-in", "css", [
		.42,
		0,
		1,
		1
	]),
	_("ease-out", "CSS ease-out", "css", [
		0,
		0,
		.58,
		1
	]),
	_("ease-in-out", "CSS ease-in-out", "css", [
		.42,
		0,
		.58,
		1
	]),
	_("in-quad", "Quadratique, départ lent", "quad", [
		.11,
		0,
		.5,
		0
	]),
	_("out-quad", "Quadratique, arrivée douce", "quad", [
		.5,
		1,
		.89,
		1
	]),
	_("in-out-quad", "Quadratique, aller-retour", "quad", [
		.45,
		0,
		.55,
		1
	]),
	_("in-cubic", "Cubique, départ lent", "cubic", [
		.32,
		0,
		.67,
		0
	]),
	_("out-cubic", "Cubique, arrivée douce", "cubic", [
		.33,
		1,
		.68,
		1
	]),
	_("in-out-cubic", "Cubique, aller-retour", "cubic", [
		.65,
		0,
		.35,
		1
	]),
	_("in-quart", "Quartique, départ lent", "quart", [
		.5,
		0,
		.75,
		0
	]),
	_("out-quart", "Quartique, arrivée douce", "quart", [
		.25,
		1,
		.5,
		1
	]),
	_("in-out-quart", "Quartique, aller-retour", "quart", [
		.76,
		0,
		.24,
		1
	]),
	_("in-expo", "Exponentielle, départ lent", "expo", [
		.7,
		0,
		.84,
		0
	]),
	_("out-expo", "Exponentielle, arrivée douce", "expo", [
		.16,
		1,
		.3,
		1
	]),
	_("in-out-expo", "Exponentielle, aller-retour", "expo", [
		.87,
		0,
		.13,
		1
	]),
	_("in-circ", "Circulaire, départ lent", "circ", [
		.55,
		0,
		1,
		.45
	]),
	_("out-circ", "Circulaire, arrivée douce", "circ", [
		0,
		.55,
		.45,
		1
	]),
	_("in-out-circ", "Circulaire, aller-retour", "circ", [
		.85,
		0,
		.15,
		1
	]),
	_("in-recul", "Recul avant le départ", "recul", [
		.36,
		0,
		.66,
		-.56
	]),
	_("out-recul", "Dépasse puis revient", "recul", [
		.34,
		1.56,
		.64,
		1
	]),
	_("in-out-recul", "Recul et dépassement", "recul", [
		.68,
		-.6,
		.32,
		1.6
	]),
	v("in-elastique", "Élastique au départ", "elastique", g["in-elastique"]),
	v("out-elastique", "Élastique à l'arrivée", "elastique", g["out-elastique"]),
	v("in-out-elastique", "Élastique, aller-retour", "elastique", g["in-out-elastique"]),
	v("in-rebond", "Rebonds au départ", "rebond", g["in-rebond"]),
	v("out-rebond", "Rebonds à l'arrivée", "rebond", g["out-rebond"]),
	v("in-out-rebond", "Rebonds, aller-retour", "rebond", g["in-out-rebond"]),
	y("ressort-vif", "Ressort vif", {
		raideur: 300,
		amortissement: 20
	}),
	y("ressort-souple", "Ressort souple", {
		raideur: 120,
		amortissement: 9
	}),
	y("ressort-pose", "Ressort posé", {
		raideur: 170,
		amortissement: 26
	})
], x = {
	lineaire: (e) => e,
	out: t(.16, 1, .3, 1),
	"in-out": t(.65, 0, .35, 1),
	in: t(.55, 0, 1, .45),
	expo: (e) => e >= 1 ? 1 : 1 - 2 ** (-10 * e),
	ressort: (t) => e(t)
}, S = new Map(b.map((e) => [e.nom, e])), C = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i, w = (e) => C.test(e.trim()) ? Number(e.trim()) : null, T = /^([+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?)%$/i, E = (e) => String(s(e, 4)), D = {
	linear: "linear",
	"step-start": "steps(1, jump-start)",
	"step-end": "steps(1, jump-end)"
}, O = /* @__PURE__ */ new Map();
function k(e) {
	let t = e.trim().toLowerCase().replace(/\s+/g, " "), n = O.get(t);
	if (n) return n;
	let r = A(t);
	return O.size > 500 && O.clear(), O.set(t, r), r;
}
function A(e) {
	if (!e) return {
		ok: !1,
		erreur: "courbe vide"
	};
	if (e in x) {
		let t = e, n = S.get(t), r = x[t];
		return {
			ok: !0,
			genre: "nom",
			nom: t,
			css: t === "lineaire" ? "linear" : n?.bezier ? j(n.bezier) : l(c(r)),
			f: r,
			...n?.bezier ? { bezier: n.bezier } : {}
		};
	}
	let o = S.get(e);
	if (o) {
		if (o.bezier) return {
			ok: !0,
			genre: "nom",
			nom: o.nom,
			css: j(o.bezier),
			f: t(...o.bezier),
			bezier: o.bezier
		};
		let e = c(o.f);
		return {
			ok: !0,
			genre: "nom",
			nom: o.nom,
			css: l(e),
			f: o.f,
			points: e
		};
	}
	if (e in D) return e === "linear" ? {
		ok: !0,
		genre: "nom",
		nom: e,
		css: "linear",
		f: (e) => e
	} : A(D[e]);
	let s = /^([a-z-]+)\((.*)\)$/.exec(e);
	if (!s) return {
		ok: !1,
		erreur: `« ${e} » : ni un nom connu, ni cubic-bezier(), steps() ou linear()`
	};
	let [, u, d] = s, f = d.split(",").map((e) => e.trim());
	if (u === "cubic-bezier") {
		if (f.length !== 4) return {
			ok: !1,
			erreur: `cubic-bezier() attend quatre nombres, ${f.length} reçu(s)`
		};
		let e = f.map(w);
		if (e.some((e) => e === null || !Number.isFinite(e))) return {
			ok: !1,
			erreur: "cubic-bezier() : un des nombres est illisible"
		};
		let [n, r, i, a] = e;
		if (n < 0 || n > 1 || i < 0 || i > 1) return {
			ok: !1,
			erreur: `cubic-bezier() : x1 et x2 doivent être entre 0 et 1 (reçu ${E(n)} et ${E(i)})`
		};
		let o = [
			n,
			r,
			i,
			a
		];
		return {
			ok: !0,
			genre: "cubic-bezier",
			css: j(o),
			f: t(...o),
			bezier: o
		};
	}
	if (u === "steps") {
		if (f.length < 1 || f.length > 2) return {
			ok: !1,
			erreur: "steps() attend un nombre de marches et, au choix, une position"
		};
		let e = w(f[0]);
		if (e === null || !Number.isInteger(e) || e < 1) return {
			ok: !1,
			erreur: `steps() : « ${f[0]} » n'est pas un entier ≥ 1`
		};
		let t = f[1] ?? "jump-end", i = t === "start" ? "jump-start" : t === "end" ? "jump-end" : t;
		return n.includes(i) ? i === "jump-none" && e < 2 ? {
			ok: !1,
			erreur: "steps() : jump-none demande au moins deux marches"
		} : {
			ok: !0,
			genre: "steps",
			css: `steps(${e}, ${i})`,
			f: r(e, i),
			marches: {
				n: e,
				position: i
			}
		} : {
			ok: !1,
			erreur: `steps() : position « ${t} » inconnue (jump-start, jump-end, jump-none, jump-both, start, end)`
		};
	}
	if (u === "linear") {
		if (f.length < 2) return {
			ok: !1,
			erreur: "linear() attend au moins deux points"
		};
		let e = [];
		for (let t of f) {
			let n = t.split(" ").filter(Boolean), r = null, i = [];
			for (let e of n) {
				let n = T.exec(e);
				if (n) i.push(Number(n[1]) / 100);
				else if (r === null && w(e) !== null) r = w(e);
				else return {
					ok: !1,
					erreur: `linear() : « ${t} » illisible (un nombre et jusqu'à deux pourcentages)`
				};
			}
			if (r === null || i.length > 2) return {
				ok: !1,
				erreur: `linear() : « ${t} » illisible (un nombre et jusqu'à deux pourcentages)`
			};
			e.push({
				sortie: r,
				entrees: i
			});
		}
		let t = i(e);
		return {
			ok: !0,
			genre: "linear",
			css: M(e),
			f: a(t),
			points: t
		};
	}
	return {
		ok: !1,
		erreur: `« ${u}() » : seulement cubic-bezier(), steps() et linear()`
	};
}
var j = (e) => `cubic-bezier(${e.map(E).join(", ")})`, M = (e) => `linear(${e.map((e) => [E(e.sortie), ...e.entrees.map((e) => `${s(e * 100, 4)}%`)].join(" ")).join(", ")})`;
function N(e, t = x.out) {
	if (!e) return t;
	let n = k(e);
	return n.ok ? n.f : t;
}
function P(e) {
	if (!e) return null;
	let t = k(e);
	return t.ok ? t.css : null;
}
export { k as i, P as n, N as r, x as t };
