import { n as e, t } from "./motion-lint-EfEMk6cY.js";
import { a as n, t as r } from "./tokens-Nj0c2PcI.js";
// src/gpu/clock.ts
var i = 1, a = 0, o = 0, s = !0, c = 1e3 / 60, l = -1, u = -1, d = 0;
function f(e) {
	if (s && e !== l) {
		if (Math.abs(e - performance.now()) > 250) u = -1, l = -1;
		else {
			if (l > 0) {
				let t = e - l;
				t > 3 && t < 50 && (c += (t - c) * .1);
			}
			l = e, u = e + c;
		}
	}
}
var p = () => {
	let e = performance.now(), t = u > 0 && e - l < c ? u : e;
	return d = Math.max(d, t);
}, m = () => p();
function h() {
	let e = m();
	return i === 1 && a === 0 ? e : o + (e - a) / i;
}
function ee(e) {
	let t = h();
	a = m(), o = t, i = e > 0 ? e : 1;
}
if (typeof location < "u") {
	new URLSearchParams(location.search).get("presse-heure") === "maintenant" && (s = !1);
	let e = Number(new URLSearchParams(location.search).get("presse-ralenti"));
	e > 0 && e !== 1 && ee(e);
}
// src/registre/mouvement/courbes.ts
function g(e, t, n, r) {
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
var te = [
	"jump-start",
	"jump-end",
	"jump-none",
	"jump-both"
];
function ne(e, t = "jump-end") {
	let n = t === "jump-none" ? e - 1 : t === "jump-both" ? e + 1 : e;
	return (r) => {
		let i = Math.floor(r * e);
		return (t === "jump-start" || t === "jump-both") && (i += 1), r >= 0 && i < 0 && (i = 0), r <= 1 && i > n && (i = n), i / n;
	};
}
function re(e) {
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
function ie(e) {
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
var ae = .002, _ = (e, t) => {
	let n = 10 ** t, r = Math.round(e * n) / n;
	return Object.is(r, -0) ? 0 : r;
};
function v(e, t = ae, n = 9) {
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
function y(e) {
	return `linear(${e.map(([t, n], r) => {
		let i = String(_(n, 4));
		return r === 0 && t === 0 || r === e.length - 1 && t === 1 ? i : `${i} ${_(t * 100, 2)}%`;
	}).join(", ")})`;
}
function oe(e) {
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
function se(e, t = .001) {
	let n = oe(e), r = Math.max(.001, e.masse ?? 1), i = Math.max(0, e.amortissement) / (2 * Math.sqrt(Math.max(.001, e.raideur) * r)), a = 0;
	for (let e = 0; e <= 2e4; e++) Math.abs(n(e / 1e3)) >= t && (a = e);
	let o = Math.max(50, Math.min(2e4, a + 1)), s = o / 1e3, c = (e) => e <= 0 ? 0 : e >= 1 ? 1 : 1 + n(e * s);
	return {
		f: c,
		dureeMs: o,
		zeta: i,
		css: y(v(c))
	};
}
var b = (e) => {
	let t = 7.5625, n = 2.75;
	return e < 1 / n ? t * e * e : e < 2 / n ? t * (e -= 1.5 / n) * e + .75 : e < 2.5 / n ? t * (e -= 2.25 / n) * e + .9375 : t * (e -= 2.625 / n) * e + .984375;
}, x = 2 * Math.PI / 3, S = 2 * Math.PI / 4.5, C = (e) => (t) => t <= 0 ? 0 : t >= 1 ? 1 : e(t), w = {
	"in-elastique": C((e) => -(2 ** (10 * e - 10)) * Math.sin((e * 10 - 10.75) * x)),
	"out-elastique": C((e) => 2 ** (-10 * e) * Math.sin((e * 10 - .75) * x) + 1),
	"in-out-elastique": C((e) => e < .5 ? -(2 ** (20 * e - 10) * Math.sin((20 * e - 11.125) * S)) / 2 : 2 ** (-20 * e + 10) * Math.sin((20 * e - 11.125) * S) / 2 + 1),
	"in-rebond": C((e) => 1 - b(1 - e)),
	"out-rebond": C(b),
	"in-out-rebond": C((e) => e < .5 ? (1 - b(1 - 2 * e)) / 2 : (1 + b(2 * e - 1)) / 2)
}, T = (e, t, n, r) => ({
	nom: e,
	libelle: t,
	famille: n,
	bezier: r
}), E = (e, t, n, r) => ({
	nom: e,
	libelle: t,
	famille: n,
	f: r
}), D = (e, t, n) => {
	let r = se(n);
	return {
		nom: e,
		libelle: t,
		famille: "ressort",
		f: r.f,
		dureeMs: r.dureeMs,
		ressort: n
	};
}, ce = [
	T("lineaire", "Linéaire", "maison", [
		0,
		0,
		1,
		1
	]),
	T("out", "Sortie maison", "maison", [
		.16,
		1,
		.3,
		1
	]),
	T("in-out", "Aller-retour maison", "maison", [
		.65,
		0,
		.35,
		1
	]),
	T("in", "Départ maison", "maison", [
		.55,
		0,
		1,
		.45
	]),
	T("ease", "CSS ease", "css", [
		.25,
		.1,
		.25,
		1
	]),
	T("ease-in", "CSS ease-in", "css", [
		.42,
		0,
		1,
		1
	]),
	T("ease-out", "CSS ease-out", "css", [
		0,
		0,
		.58,
		1
	]),
	T("ease-in-out", "CSS ease-in-out", "css", [
		.42,
		0,
		.58,
		1
	]),
	T("in-quad", "Quadratique, départ lent", "quad", [
		.11,
		0,
		.5,
		0
	]),
	T("out-quad", "Quadratique, arrivée douce", "quad", [
		.5,
		1,
		.89,
		1
	]),
	T("in-out-quad", "Quadratique, aller-retour", "quad", [
		.45,
		0,
		.55,
		1
	]),
	T("in-cubic", "Cubique, départ lent", "cubic", [
		.32,
		0,
		.67,
		0
	]),
	T("out-cubic", "Cubique, arrivée douce", "cubic", [
		.33,
		1,
		.68,
		1
	]),
	T("in-out-cubic", "Cubique, aller-retour", "cubic", [
		.65,
		0,
		.35,
		1
	]),
	T("in-quart", "Quartique, départ lent", "quart", [
		.5,
		0,
		.75,
		0
	]),
	T("out-quart", "Quartique, arrivée douce", "quart", [
		.25,
		1,
		.5,
		1
	]),
	T("in-out-quart", "Quartique, aller-retour", "quart", [
		.76,
		0,
		.24,
		1
	]),
	T("in-expo", "Exponentielle, départ lent", "expo", [
		.7,
		0,
		.84,
		0
	]),
	T("out-expo", "Exponentielle, arrivée douce", "expo", [
		.16,
		1,
		.3,
		1
	]),
	T("in-out-expo", "Exponentielle, aller-retour", "expo", [
		.87,
		0,
		.13,
		1
	]),
	T("in-circ", "Circulaire, départ lent", "circ", [
		.55,
		0,
		1,
		.45
	]),
	T("out-circ", "Circulaire, arrivée douce", "circ", [
		0,
		.55,
		.45,
		1
	]),
	T("in-out-circ", "Circulaire, aller-retour", "circ", [
		.85,
		0,
		.15,
		1
	]),
	T("in-recul", "Recul avant le départ", "recul", [
		.36,
		0,
		.66,
		-.56
	]),
	T("out-recul", "Dépasse puis revient", "recul", [
		.34,
		1.56,
		.64,
		1
	]),
	T("in-out-recul", "Recul et dépassement", "recul", [
		.68,
		-.6,
		.32,
		1.6
	]),
	E("in-elastique", "Élastique au départ", "elastique", w["in-elastique"]),
	E("out-elastique", "Élastique à l'arrivée", "elastique", w["out-elastique"]),
	E("in-out-elastique", "Élastique, aller-retour", "elastique", w["in-out-elastique"]),
	E("in-rebond", "Rebonds au départ", "rebond", w["in-rebond"]),
	E("out-rebond", "Rebonds à l'arrivée", "rebond", w["out-rebond"]),
	E("in-out-rebond", "Rebonds, aller-retour", "rebond", w["in-out-rebond"]),
	D("ressort-vif", "Ressort vif", {
		raideur: 300,
		amortissement: 20
	}),
	D("ressort-souple", "Ressort souple", {
		raideur: 120,
		amortissement: 9
	}),
	D("ressort-pose", "Ressort posé", {
		raideur: 170,
		amortissement: 26
	})
], O = {
	lineaire: (e) => e,
	out: g(.16, 1, .3, 1),
	"in-out": g(.65, 0, .35, 1),
	in: g(.55, 0, 1, .45),
	expo: (e) => e >= 1 ? 1 : 1 - 2 ** (-10 * e),
	ressort: (e) => n(e)
}, le = new Map(ce.map((e) => [e.nom, e])), ue = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i, k = (e) => ue.test(e.trim()) ? Number(e.trim()) : null, de = /^([+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?)%$/i, A = (e) => String(_(e, 4)), fe = {
	linear: "linear",
	"step-start": "steps(1, jump-start)",
	"step-end": "steps(1, jump-end)"
}, j = /* @__PURE__ */ new Map();
function M(e) {
	let t = e.trim().toLowerCase().replace(/\s+/g, " "), n = j.get(t);
	if (n) return n;
	let r = pe(t);
	return j.size > 500 && j.clear(), j.set(t, r), r;
}
function pe(e) {
	if (!e) return {
		ok: !1,
		erreur: "courbe vide"
	};
	if (e in O) {
		let t = e, n = le.get(t), r = O[t];
		return {
			ok: !0,
			genre: "nom",
			nom: t,
			css: t === "lineaire" ? "linear" : n?.bezier ? N(n.bezier) : y(v(r)),
			f: r,
			...n?.bezier ? { bezier: n.bezier } : {}
		};
	}
	let t = le.get(e);
	if (t) {
		if (t.bezier) return {
			ok: !0,
			genre: "nom",
			nom: t.nom,
			css: N(t.bezier),
			f: g(...t.bezier),
			bezier: t.bezier
		};
		let e = v(t.f);
		return {
			ok: !0,
			genre: "nom",
			nom: t.nom,
			css: y(e),
			f: t.f,
			points: e
		};
	}
	if (e in fe) return e === "linear" ? {
		ok: !0,
		genre: "nom",
		nom: e,
		css: "linear",
		f: (e) => e
	} : pe(fe[e]);
	let n = /^([a-z-]+)\((.*)\)$/.exec(e);
	if (!n) return {
		ok: !1,
		erreur: `« ${e} » : ni un nom connu, ni cubic-bezier(), steps() ou linear()`
	};
	let [, r, i] = n, a = i.split(",").map((e) => e.trim());
	if (r === "cubic-bezier") {
		if (a.length !== 4) return {
			ok: !1,
			erreur: `cubic-bezier() attend quatre nombres, ${a.length} reçu(s)`
		};
		let e = a.map(k);
		if (e.some((e) => e === null || !Number.isFinite(e))) return {
			ok: !1,
			erreur: "cubic-bezier() : un des nombres est illisible"
		};
		let [t, n, r, i] = e;
		if (t < 0 || t > 1 || r < 0 || r > 1) return {
			ok: !1,
			erreur: `cubic-bezier() : x1 et x2 doivent être entre 0 et 1 (reçu ${A(t)} et ${A(r)})`
		};
		let o = [
			t,
			n,
			r,
			i
		];
		return {
			ok: !0,
			genre: "cubic-bezier",
			css: N(o),
			f: g(...o),
			bezier: o
		};
	}
	if (r === "steps") {
		if (a.length < 1 || a.length > 2) return {
			ok: !1,
			erreur: "steps() attend un nombre de marches et, au choix, une position"
		};
		let e = k(a[0]);
		if (e === null || !Number.isInteger(e) || e < 1) return {
			ok: !1,
			erreur: `steps() : « ${a[0]} » n'est pas un entier ≥ 1`
		};
		let t = a[1] ?? "jump-end", n = t === "start" ? "jump-start" : t === "end" ? "jump-end" : t;
		return te.includes(n) ? n === "jump-none" && e < 2 ? {
			ok: !1,
			erreur: "steps() : jump-none demande au moins deux marches"
		} : {
			ok: !0,
			genre: "steps",
			css: `steps(${e}, ${n})`,
			f: ne(e, n),
			marches: {
				n: e,
				position: n
			}
		} : {
			ok: !1,
			erreur: `steps() : position « ${t} » inconnue (jump-start, jump-end, jump-none, jump-both, start, end)`
		};
	}
	if (r === "linear") {
		if (a.length < 2) return {
			ok: !1,
			erreur: "linear() attend au moins deux points"
		};
		let e = [];
		for (let t of a) {
			let n = t.split(" ").filter(Boolean), r = null, i = [];
			for (let e of n) {
				let n = de.exec(e);
				if (n) i.push(Number(n[1]) / 100);
				else if (r === null && k(e) !== null) r = k(e);
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
		let t = re(e);
		return {
			ok: !0,
			genre: "linear",
			css: me(e),
			f: ie(t),
			points: t
		};
	}
	return {
		ok: !1,
		erreur: `« ${r}() » : seulement cubic-bezier(), steps() et linear()`
	};
}
var N = (e) => `cubic-bezier(${e.map(A).join(", ")})`, me = (e) => `linear(${e.map((e) => [A(e.sortie), ...e.entrees.map((e) => `${_(e * 100, 4)}%`)].join(" ")).join(", ")})`;
function he(e, t = O.out) {
	if (!e) return t;
	let n = M(e);
	return n.ok ? n.f : t;
}
function ge(e) {
	if (!e) return null;
	let t = M(e);
	return t.ok ? t.css : null;
}
// src/presse/timeline.ts
var P = { ...O }, F = (e) => typeof e == "function" ? e : e ? P[e] ?? he(e, P.out) : P.out, I = /* @__PURE__ */ new Set(), L = 0, R = 0;
function z(e) {
	L = 0, e !== void 0 && f(e);
	let t = h(), n = (t - R) / 1e3;
	R = t, n > 1 && (n = 1 / 60), _e(n), I.size && (L = requestAnimationFrame(z));
}
function _e(e) {
	for (let t of [...I]) t.step(e) || I.delete(t);
	for (let e of ve) e();
	J();
}
var ve = /* @__PURE__ */ new Set();
function B(e) {
	I.add(e), L || typeof requestAnimationFrame > "u" || (R = h(), L = requestAnimationFrame(z));
}
function ye(e) {
	let t = !0, n = { step: (n) => t && e(n) !== !1 };
	return B(n), {
		stop: () => void (t = !1),
		wake: () => {
			t && !I.has(n) && B(n);
		}
	};
}
var be = null, xe = null;
function V() {
	return xe === null ? typeof matchMedia > "u" ? !1 : (be ??= matchMedia("(prefers-reduced-motion: reduce)"), be.matches) : xe;
}
var H = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new Set(), W = {
	x: "px",
	y: "px",
	rotate: "deg",
	blur: "px",
	clip: "%",
	"clip-x": "%",
	"clip-top": "%"
}, Se = {
	scale: 1,
	opacity: 1
}, Ce = [
	"x",
	"y",
	"scale",
	"rotate",
	"opacity",
	"blur",
	"clip",
	"clip-x",
	"clip-top"
];
function G(e, t) {
	if (typeof e == "number") return {
		n: e,
		unit: W[t] ?? ""
	};
	let n = /^(-?[\d.]+(?:e-?\d+)?)([a-z%]*)$/i.exec(e.trim());
	if (!n) throw Error(`[presse:anim] valeur illisible pour ${t} : « ${e} »`);
	return {
		n: Number(n[1]),
		unit: n[2] || W[t] || ""
	};
}
function K(e, t) {
	return H.get(e)?.get(t) ?? {
		n: Se[t] ?? 0,
		unit: W[t] ?? ""
	};
}
function we(e, t, n) {
	let r = H.get(e);
	r || H.set(e, r = /* @__PURE__ */ new Map()), r.set(t, n), U.add(e);
}
var q = (e, t) => e ? `${+e.n.toFixed(4)}${e.unit}` : t;
function J() {
	if (t()) {
		let t = h();
		for (let n of U) for (let [r, i] of H.get(n)) e(n, r, i.n, t);
	}
	for (let e of U) {
		let t = H.get(e), n = e.style;
		if ((t.has("x") || t.has("y")) && n.setProperty("translate", `${q(t.get("x"), "0px")} ${q(t.get("y"), "0px")}`), t.has("scale") && n.setProperty("scale", q(t.get("scale"), "1")), t.has("rotate") && n.setProperty("rotate", q(t.get("rotate"), "0deg")), t.has("opacity") && n.setProperty("opacity", String(+Math.min(1, Math.max(0, t.get("opacity").n)).toFixed(4))), t.has("blur")) {
			let e = t.get("blur");
			n.setProperty("filter", e.n > .01 ? `blur(${q(e, "0px")})` : "");
		}
		(t.has("clip") || t.has("clip-x") || t.has("clip-top")) && n.setProperty("clip-path", `inset(${q(t.get("clip-top"), "0%")} ${q(t.get("clip-x"), "0%")} ${q(t.get("clip"), "0%")} 0%)`);
		for (let [e, r] of t) e.startsWith("--") && n.setProperty(e, q(r, "0"));
	}
	U.clear();
}
var Te = class {
	tracks = [];
	calls = [];
	labels = /* @__PURE__ */ new Map();
	prevStart = 0;
	prevEnd = 0;
	duration = 0;
	time = 0;
	rate = 1;
	playing = !1;
	resolveDone = null;
	onUpdate = null;
	at(e) {
		if (typeof e == "number") return e;
		if (e === void 0 || e === ">") return this.prevEnd;
		if (e === "<") return this.prevStart;
		let t = /^([<>]|[^+\-<>]+)?([+-]=?)?(-?[\d.]+)?$/.exec(e);
		if (!t) throw Error(`[presse:anim] position illisible : « ${e} »`);
		let [, n, r, i] = t, a = this.prevEnd;
		if (n === "<") a = this.prevStart;
		else if (n && n !== ">") {
			if (!this.labels.has(n)) throw Error(`[presse:anim] étiquette inconnue : « ${n} »`);
			a = this.labels.get(n);
		}
		let o = Number(i ?? 0);
		return a + (r?.startsWith("-") ? -o : o);
	}
	label(e, t) {
		return this.labels.set(e, this.at(t)), this;
	}
	add(e, t, n, i, a) {
		let o = Array.isArray(e) ? e : [e], s = this.at(i.at), c = Math.max(0, i.dur ?? r[3] / 1e3), l = F(i.ease), u = i.stagger ?? 0;
		return o.forEach((e, r) => {
			for (let [i, o] of Object.entries(n)) {
				if (o === void 0) continue;
				let n = G(o, i), d = t && t[i] !== void 0 ? G(t[i], i) : null;
				if (d && d.unit !== n.unit && d.n !== 0 && n.n !== 0) throw Error(`[presse:anim] ${i} : unités différentes (${d.unit} → ${n.unit})`);
				d && d.unit !== n.unit && (d.n === 0 ? d.unit = n.unit : n.unit = d.unit), this.tracks.push({
					t: e,
					prop: i,
					from: d,
					to: n,
					start: s + r * u,
					dur: c,
					ease: l,
					lazy: a && !d
				});
			}
		}), this.prevStart = s, this.prevEnd = s + c + Math.max(0, o.length - 1) * u, this.duration = Math.max(this.duration, this.prevEnd), this.tracks.sort((e, t) => e.start - t.start), this;
	}
	to(e, t, n = {}) {
		return this.add(e, null, t, n, !0);
	}
	from(e, t, n = {}) {
		let r = Array.isArray(e) ? e : [e], i = {};
		for (let e of Object.keys(t)) {
			let n = K(r[0], e);
			i[e] = `${n.n}${G(t[e], e).unit || n.unit}`;
		}
		return this.add(e, t, i, n, !1);
	}
	fromTo(e, t, n, r = {}) {
		return this.add(e, t, n, r, !1);
	}
	call(e, t) {
		let n = this.at(t);
		return this.calls.push({
			at: n,
			fn: e,
			done: !1
		}), this.duration = Math.max(this.duration, n), this;
	}
	seek(e) {
		let t = this.time;
		return this.time = Math.min(this.duration, Math.max(0, e)), this.render(t), this;
	}
	progress(e) {
		return this.seek(e * this.duration);
	}
	play() {
		return this.go(1);
	}
	reverse() {
		return this.go(-1);
	}
	restart() {
		return this.calls.forEach((e) => e.done = !1), this.seek(0), this.play();
	}
	pause() {
		return this.playing = !1, this;
	}
	finished() {
		return this.playing ? new Promise((e) => this.resolveDone = e) : Promise.resolve();
	}
	go(e) {
		return this.rate = e, V() ? (this.playing = !1, this.seek(e > 0 ? this.duration : 0), this) : e > 0 && this.time >= this.duration || e < 0 && this.time <= 0 ? (this.playing = !1, this.render(this.time), this) : (this.playing = !0, B(this), this);
	}
	step(e) {
		if (!this.playing) return !1;
		let t = this.time;
		this.time = Math.min(this.duration, Math.max(0, this.time + e * this.rate)), this.render(t);
		let n = this.rate > 0 ? this.time >= this.duration : this.time <= 0;
		return n && (this.playing = !1, this.resolveDone?.(), this.resolveDone = null), !n;
	}
	render(e) {
		let t = this.time, n = /* @__PURE__ */ new Map();
		for (let e of this.tracks) {
			let r = n.get(e.t);
			r || n.set(e.t, r = /* @__PURE__ */ new Map());
			let i = !r.has(e.prop);
			if (t < e.start && !i) continue;
			e.lazy && !e.from && t >= e.start && (e.from = { ...K(e.t, e.prop) }, e.from.unit !== e.to.unit && e.from.n === 0 && (e.from.unit = e.to.unit));
			let a = e.from ?? K(e.t, e.prop), o = e.dur === 0 ? +(t >= e.start) : Math.min(1, Math.max(0, (t - e.start) / e.dur)), s = e.ease(o);
			r.set(e.prop, {
				n: a.n + (e.to.n - a.n) * s,
				unit: e.to.unit || a.unit
			});
		}
		for (let [e, t] of n) for (let [n, r] of t) we(e, n, r);
		if (t > e) for (let n of this.calls) !n.done && n.at > e && n.at <= t && (n.done = !0, n.fn());
		if (t < e) for (let e of this.calls) e.at > t && (e.done = !1);
		this.onUpdate?.(this), I.has(this) || J();
	}
}, Ee = {
	monte: "y 1.1em 0em; opacity 0 1",
	fondu: "opacity 0 1",
	glisse: "x -1.5em 0em; opacity 0 1",
	zoom: "scale 0.92 1; opacity 0 1",
	masque: "clip 100 0; y 0.35em 0em",
	rideau: "clip-x 100 0",
	flou: "blur 14 0; opacity 0 1",
	bascule: "rotate -5 0; y 0.8em 0em; opacity 0 1"
}, De = [
	"entree",
	"defilement",
	"survol",
	"appui",
	"chargement"
];
function Oe(e) {
	let t = Ee[e.trim()] ?? e, n = {}, r = {};
	for (let e of t.split(";")) {
		let t = e.trim().split(/\s+/).filter(Boolean);
		if (!t.length) continue;
		if (t.length !== 3) throw Error(`[presse:anim] « ${e.trim()} » : il faut « propriété de vers »`);
		let [i, a, o] = t;
		if (!i.startsWith("--") && !Ce.includes(i)) throw Error(`[presse:anim] propriété inconnue : « ${i} » (${Ce.join(", ")}, ou --variable)`);
		n[i] = a, r[i] = o;
	}
	return [n, r];
}
var Y = /* @__PURE__ */ new WeakMap(), X = /* @__PURE__ */ new Set(), Z = null, ke = null, Q = { step(e) {
	let t = !1;
	for (let n of X) {
		if (!n.visible) continue;
		let r = n.el.getBoundingClientRect(), i = innerHeight, a = Math.min(1, Math.max(0, (i - r.top) / (i + r.height))), o = V() || n.smooth <= 0 ? 1 : 1 - Math.exp(-e / n.smooth);
		n.p += (a - n.p) * o, Math.abs(a - n.p) < 1e-4 ? n.p = a : t = !0, n.tl.progress(n.p);
	}
	return t;
} }, Ae = !1;
function $(e) {
	if (Y.has(e)) return;
	let t = e.dataset, n, i;
	try {
		[n, i] = Oe(t.anim ?? "");
	} catch (t) {
		console.warn(t, e), e.dataset.animReady = "";
		return;
	}
	let a = De.includes(t.animTrigger ?? "") ? t.animTrigger : "entree", o = Number(t.animStagger ?? 0), s = o > 0 ? [...e.children] : [e], c = new Te().fromTo(s, n, i, {
		dur: t.animDur ? Number(t.animDur) : a === "survol" || a === "appui" ? r[2] / 1e3 : r[3] / 1e3,
		ease: t.animEase ?? (a === "defilement" ? "lineaire" : "out"),
		stagger: o,
		at: Number(t.animDelay ?? 0)
	}), l = {
		el: e,
		tl: c,
		trigger: a,
		repeat: t.animRepeat !== void 0,
		smooth: Number(t.animSmooth ?? .08),
		p: 0,
		visible: !1
	};
	if (Y.set(e, l), c.seek(0), e.dataset.animReady = "", a === "entree") Z ??= new IntersectionObserver((e) => {
		for (let t of e) {
			let e = Y.get(t.target);
			e && (t.isIntersecting ? (e.tl.play(), e.repeat || Z.unobserve(e.el)) : e.repeat && t.boundingClientRect.top > 0 && e.tl.reverse());
		}
	}, { rootMargin: "0px 0px -15% 0px" }), Z.observe(e);
	else if (a === "defilement") X.add(l), ke ??= new IntersectionObserver((e) => {
		for (let t of e) {
			let e = [...X].find((e) => e.el === t.target);
			e && (e.visible = t.isIntersecting);
		}
		B(Q);
	}, { rootMargin: "20% 0px" }), ke.observe(e), Ae || (Ae = !0, addEventListener("scroll", () => B(Q), { passive: !0 }), addEventListener("resize", () => B(Q)));
	else if (a === "survol") e.addEventListener("pointerenter", (e) => e.pointerType !== "touch" && c.play()), e.addEventListener("pointerleave", () => c.reverse()), e.addEventListener("focusin", () => c.play()), e.addEventListener("focusout", () => c.reverse());
	else if (a === "appui") {
		e.addEventListener("pointerdown", () => c.play());
		for (let t of [
			"pointerup",
			"pointercancel",
			"pointerleave"
		]) e.addEventListener(t, () => c.reverse());
	} else if (a === "chargement") {
		let e = document.documentElement, t = () => c.play();
		if (!e.classList.contains("presse-intro-pending")) requestAnimationFrame(t);
		else {
			let n = new MutationObserver(() => {
				e.classList.contains("presse-intro-pending") || (n.disconnect(), t());
			});
			n.observe(e, {
				attributes: !0,
				attributeFilter: ["class"]
			});
		}
	}
}
function je(e = document) {
	if (typeof document > "u") return;
	window.__presseAnim = !0;
	let t = (e) => e.querySelectorAll("[data-anim]").forEach($);
	t(e), e === document && new MutationObserver((e) => {
		for (let n of e) for (let e of n.addedNodes) e instanceof HTMLElement && (e.matches("[data-anim]") && $(e), t(e));
	}).observe(document.body, {
		childList: !0,
		subtree: !0
	});
}
export { V as a, h as c, je as i, F as n, ge as o, ye as r, M as s, P as t };
