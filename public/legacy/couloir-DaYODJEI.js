import { n as e, s as t } from "./timeline-DUX9XWeC.js";
import { t as n } from "./schema-pEBuhnZn.js";
// src/presse/couloir.ts
var r = [
	"pointeur",
	"defilement",
	"glisser",
	"auto",
	"molette"
], i = [
	"micro",
	"tunnel",
	"lookbook",
	"doux",
	"rapide"
], a = Object.freeze({
	duree: null,
	courbe: null,
	profondeur: 1.6,
	angle: 0,
	horizon: 50,
	cote: "droite",
	hauteur: 1.2,
	largeur: .8,
	bande: .06,
	ecart: 6,
	filet: "#ffffff",
	vitesse: .8,
	inertie: .6,
	pilotage: ["pointeur", "glisser"],
	sens: 1,
	sansfin: !0,
	aberration: .5,
	flou: .3,
	vide: 0,
	survol: 0,
	ouvre: "non",
	fond: "",
	mur: "un",
	ouverture: .35,
	mode: "mur",
	preset: null
}), o = {
	micro: {
		profondeur: 1.4,
		hauteur: 1.25,
		largeur: .8,
		bande: .055,
		ecart: 6,
		filet: "#ffffff",
		vitesse: .9,
		inertie: .55,
		pilotage: [
			"pointeur",
			"auto",
			"glisser"
		],
		aberration: .75,
		flou: .45,
		vide: .14,
		fond: "#f2f3ef"
	},
	tunnel: {
		mur: "deux",
		ouverture: .42,
		hauteur: .62,
		profondeur: 1.05,
		bande: .035,
		largeur: .9,
		ecart: 4,
		filet: "#1c1d20",
		vitesse: 1.1,
		inertie: .55,
		pilotage: [
			"pointeur",
			"auto",
			"glisser"
		],
		aberration: .9,
		flou: .55,
		vide: .1,
		fond: "#0e0f11"
	},
	lookbook: {
		profondeur: 2.2,
		hauteur: .98,
		largeur: .75,
		bande: .085,
		ecart: 10,
		vitesse: .45,
		inertie: .75,
		pilotage: ["pointeur", "glisser"],
		aberration: .12,
		flou: 0,
		vide: 0,
		survol: .08
	},
	doux: {
		profondeur: 2.8,
		hauteur: 1.1,
		vitesse: .32,
		inertie: .85,
		pilotage: [
			"auto",
			"pointeur",
			"glisser"
		],
		aberration: .12,
		flou: .08,
		vide: .06
	},
	rapide: {
		profondeur: 1.1,
		hauteur: 1.3,
		vitesse: 2.2,
		inertie: .3,
		pilotage: [
			"pointeur",
			"auto",
			"glisser",
			"molette"
		],
		aberration: 1.2,
		flou: .9,
		vide: .1
	}
}, s = (e, t, n) => Math.max(t, Math.min(n, e)), c = {
	profondeur: [.4, 8],
	angle: [-30, 30],
	horizon: [5, 95],
	hauteur: [.15, 2.5],
	largeur: [.25, 3],
	bande: [.01, .3],
	ecart: [0, 40],
	vitesse: [0, 6],
	inertie: [0, 1],
	aberration: [0, 2],
	flou: [0, 2],
	vide: [0, .6],
	survol: [0, .5],
	ouverture: [0, 1.5]
}, l = Object.keys(c);
function u(e) {
	if (e == null) return null;
	let t = e.trim();
	return t ? t.length <= 64 && /^[#a-z0-9(),.%\s/-]+$/i.test(t) && !/url|expression/i.test(t) ? t : null : "";
}
var d = (e) => e === "" || e === "oui" || e === "1" || e === "true", f = (e) => e === "non" || e === "0" || e === "false";
function p(e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of e.toLowerCase().split(/[\s,+|]+/)) r.includes(n) && t.add(n);
	return [...t];
}
var m = (e) => "couloir" + e[0].toUpperCase() + e.slice(1);
function h(e) {
	let r = (e.couloirPresets ?? "").trim().toLowerCase(), h = i.includes(r) ? r : null, g = {
		...a,
		pilotage: [...a.pilotage],
		...h ? o[h] : {},
		preset: h
	};
	h && o[h].pilotage && (g.pilotage = [...o[h].pilotage]);
	for (let t of l) {
		let n = e[m(t)];
		if (n == null || n.trim() === "") continue;
		let r = Number(n.replace(",", "."));
		Number.isFinite(r) && (g[t] = s(r, c[t][0], c[t][1]));
	}
	let _ = e.couloirCote?.trim();
	(_ === "droite" || _ === "gauche") && (g.cote = _);
	let v = e.couloirMur?.trim();
	v === "un" || v === "deux" || v === "trois" ? g.mur = v : (v === "1" || v === "2" || v === "3") && (g.mur = [
		"un",
		"deux",
		"trois"
	][Number(v) - 1]);
	let y = e.couloirMode?.trim();
	(y === "mur" || y === "plafond") && (g.mode = y);
	let b = e.couloirOuvre?.trim();
	b === "non" || b === "visionneuse" ? g.ouvre = b : (b === "" || b === "oui") && (g.ouvre = "visionneuse"), e.couloirPilotage != null && (g.pilotage = p(e.couloirPilotage));
	let x = e.couloirSens?.trim();
	if (x === "arriere" || x === "-1" ? g.sens = -1 : (x === "avant" || x === "1") && (g.sens = 1), e.couloirSansfin != null) {
		let t = e.couloirSansfin.trim().toLowerCase();
		f(t) ? g.sansfin = !1 : d(t) && (g.sansfin = !0);
	}
	let S = u(e.couloirFilet);
	S && (g.filet = S);
	let C = u(e.couloirFond);
	if (C != null && (g.fond = C), e.couloirDuree != null) {
		let t = n(e.couloirDuree, "s");
		t !== null && t > 0 && (g.duree = s(t, .05, 10));
	}
	if (e.couloirCourbe != null) {
		let n = t(e.couloirCourbe);
		n.ok && (g.courbe = n.genre === "nom" ? n.nom : n.css);
	}
	return g;
}
var g = .6, _ = (e) => String(Math.round(e * 1e3) / 1e3);
function v(e) {
	let t = h(e.preset ? { couloirPresets: e.preset } : {}), n = ["data-couloir"];
	e.preset && n.push(`data-couloir-presets="${e.preset}"`);
	let r = (e, t) => n.push(`data-couloir-${e}="${t}"`);
	for (let n of [
		"mode",
		"mur",
		"cote"
	]) e[n] !== t[n] && r(n, e[n]);
	for (let n of l) Math.abs(e[n] - t[n]) > 1e-6 && r(n, _(e[n]));
	return e.pilotage.join(" ") !== t.pilotage.join(" ") && r("pilotage", e.pilotage.join(" ")), e.sens !== t.sens && r("sens", e.sens === 1 ? "avant" : "arriere"), e.sansfin !== t.sansfin && r("sansfin", e.sansfin ? "oui" : "non"), e.ouvre !== t.ouvre && r("ouvre", e.ouvre), e.filet !== t.filet && r("filet", e.filet), e.fond !== t.fond && r("fond", e.fond), e.duree !== t.duree && e.duree !== null && r("duree", _(e.duree)), e.courbe !== t.courbe && e.courbe !== null && r("courbe", e.courbe), n.join(" ");
}
var y = 1.1, b = 26;
function x(e, t, n) {
	let r = e.mode === "plafond", i = Math.max(1, r ? n : t), a = Math.max(1, r ? t : n), o = Math.min(i, a), c = e.profondeur, l = Math.max(2, e.hauteur * o), u = Math.min(l / 1.01, Math.max(1, e.bande * o, l * c / (c + 26)));
	return {
		L: i,
		C: a,
		R: o,
		u0: .03 * i,
		uf: (r ? s(1 - e.horizon / 100, .2, .95) : .78) * i,
		P: c,
		b: u * e.largeur,
		H0: l,
		hb: u,
		dc: c * (l / u - 1),
		c0: r ? a / 2 : a * e.horizon / 100,
		pente: Math.tan(e.angle * Math.PI / 180),
		ecart: e.ecart,
		ouverture: e.ouverture * o,
		murs: e.mur === "trois" ? 3 : e.mur === "deux" ? 2 : 1,
		mode: e.mode,
		cote: e.cote
	};
}
var S = (e, t) => e >= 0 ? t / (t + e) : Math.exp(-e / t), C = (e, t) => e >= 0 ? t / (t + e) ** 2 : Math.exp(-e / t) / t, w = (e, t) => e / t > 30 ? e : t * Math.log1p(Math.exp(e / t)), T = (e, t) => 1 / (1 + Math.exp(-e / t)), E = (e, t) => t.uf - (t.uf - t.u0) * S(e, t.P) + t.b * w(e - t.dc, y), ee = (e, t) => (t.uf - t.u0) * C(e, t.P) + t.b * T(e - t.dc, y), D = (e, t) => ((t.H0 * S(e, t.P)) ** 4 + t.hb ** 4) ** .25;
function te(e, t) {
	let n = -8, r = 4e3;
	for (let i = 0; i < 64; i++) {
		let i = (n + r) / 2;
		E(i, t) < e ? n = i : r = i;
	}
	return (n + r) / 2;
}
var O = (e, t) => t.ecart > 0 ? Math.max(.5, t.ecart * D(e, t) / t.H0) : 0;
function k(e, t, n = D(e, t)) {
	let r = t.c0 + t.pente * (E(e, t) - t.uf);
	if (t.murs === 1) return [r];
	let i = Math.max(t.ouverture * D(e, t) / t.H0, O(e, t));
	return t.murs === 2 ? [r - (n + i) / 2, r + (n + i) / 2] : [
		r - n - i,
		r,
		r + n + i
	];
}
function ne(e, t = 400) {
	for (let n = 1; n <= t; n++) if (E(n, e) > e.L + 8) return n + 1;
	return t;
}
function A(e, t, n, r) {
	let i = e - t;
	return !r || n <= 0 ? i : ((i + 2) % n + n) % n - 2;
}
function re(e, t, n) {
	if (!(n > 0)) return t - e;
	let r = (t - e) % n;
	return r > n / 2 && (r -= n), r < -n / 2 && (r += n), r;
}
function j(e, t = 0) {
	let n = (Math.imul(e + 1, 2654435761) ^ Math.imul(t + 7, 2246822507)) >>> 0;
	return n = Math.imul(n ^ n >>> 16, 2146121005) >>> 0, n = Math.imul(n ^ n >>> 15, 2221713035) >>> 0, ((n ^ n >>> 16) >>> 0) / 4294967296;
}
function M(e, t, n = 0) {
	let r = [];
	for (let i = 0, a = 0; i < e; a++) r.length > 0 && r[r.length - 1] !== -1 && t > 0 && j(a, n) < t ? r.push(-1) : r.push(i++);
	return r;
}
function ie(e, t, n, r, i = 0) {
	if (e <= 0) return [];
	let a = M(e, t, i);
	if (!r) return a;
	let o = [...a];
	for (; o.length < n;) o.push(...a);
	return o;
}
function ae(e, t, n, r) {
	let [i, a] = e, [o, s] = t, [c, l] = n, [u, d] = r, f = o - c, p = u - c, m = i - o + c - u, h = s - l, g = d - l, _ = a - s + l - d, v = 0, y = 0;
	if (Math.abs(m) > 1e-9 || Math.abs(_) > 1e-9) {
		let e = f * g - p * h;
		Math.abs(e) > 1e-12 && (v = (m * g - p * _) / e, y = (f * _ - m * h) / e);
	}
	return [
		o - i + v * o,
		u - i + y * u,
		i,
		s - a + v * s,
		d - a + y * d,
		a,
		v,
		y,
		1
	];
}
function N(e, t, n) {
	let r = e[6] * t + e[7] * n + e[8];
	return [(e[0] * t + e[1] * n + e[2]) / r, (e[3] * t + e[4] * n + e[5]) / r];
}
function P(e) {
	let [t, n, r, i, a, o, s, c, l] = e, u = a * l - o * c, d = -(i * l - o * s), f = i * c - a * s, p = t * u + n * d + r * f || 1e-12;
	return [
		u / p,
		-(n * l - r * c) / p,
		(n * o - r * a) / p,
		d / p,
		(t * l - r * s) / p,
		-(t * o - r * i) / p,
		f / p,
		-(t * c - n * s) / p,
		(t * a - n * i) / p
	];
}
function oe(e, t, n) {
	let [r, i, a, o, s, c, l, u, d] = e;
	return [
		r / t,
		o / t,
		0,
		l / t,
		i / n,
		s / n,
		0,
		u / n,
		0,
		0,
		1,
		0,
		a,
		c,
		0,
		d
	];
}
function F(e, t, n) {
	return n.mode === "plafond" ? n.cote === "droite" ? [t, n.L - e] : [t, e] : n.cote === "droite" ? [e, t] : [n.L - e, t];
}
function se(e, t, n) {
	return n.mode === "plafond" ? n.cote === "droite" ? [n.L - t, e] : [t, e] : n.cote === "droite" ? [e, t] : [n.L - e, t];
}
function ce(e, t, n, r = 1) {
	let i = e, a = e + 1, o = E(i, n), c = E(a, n), l = D(i, n) * r, u = D(a, n) * r, d = k(i, n, l)[t] ?? 0, f = k(a, n, u)[t] ?? 0, p = F(o, d - l / 2, n), m = F(o, d + l / 2, n), h = F(c, f - u / 2, n), g = F(c, f + u / 2, n), _;
	_ = n.mode === "plafond" ? n.cote === "droite" ? [
		h,
		g,
		m,
		p
	] : [
		p,
		m,
		g,
		h
	] : n.cote === "droite" ? [
		p,
		h,
		g,
		m
	] : [
		h,
		p,
		m,
		g
	];
	let v = 1, y = O(a, n);
	if (y > 0) {
		let e = (E(Math.max(i + .05, a - y / ee(a, n)), n) - o) / (c - o || 1), t = F(o + e * (c - o), d - l / 2 + e * (f - u / 2 - (d - l / 2)), n), [r, p] = N(P(ae(..._)), t[0], t[1]);
		v = s(n.mode === "plafond" ? n.cote === "droite" ? 1 - p : p : n.cote === "droite" ? r : 1 - r, .05, 1);
	}
	return {
		quad: _,
		part: v,
		uProche: o,
		uLoin: c
	};
}
var le = (e, t) => t * (.12 + 1.88 * s(e, 0, 1) ** 2), ue = .35, de = (e) => .06 + s(e, 0, 1) * 1.1, I = (e, t, n, r) => t + (e - t) * Math.exp(-Math.max(0, n) / Math.max(.001, r)), fe = (e, t, n = 10) => t > 0 ? Math.min(n, Math.abs(e) * t * 4) : 0, pe = (e, t, n = 10) => t > 0 ? Math.min(n, Math.abs(e) * t * 3) : 0, me = (e, t) => s((t - e) / 2, 0, 1), L = 44, he = "http://www.w3.org/2000/svg", R = 560, z = "\n.couloir { position: relative; overflow: hidden; display: block; margin: 0; padding: 0; list-style: none;\n  contain: layout paint style; background: var(--couloir-fond, transparent); touch-action: pan-y;\n  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }\n.couloir.couloir-plafond { touch-action: pan-x; }\n.couloir.couloir-glisse { cursor: grabbing; }\n.couloir > .couloir-panneau { position: absolute; left: 0; top: 0; margin: 0; padding: 0; box-sizing: border-box;\n  width: var(--couloir-w); height: var(--couloir-h); transform-origin: 0 0; overflow: hidden; visibility: hidden;\n  background: var(--couloir-filet, #fff); backface-visibility: hidden; list-style: none; }\n.couloir-contenu { display: block; width: 100%; height: 100%; margin: 0; padding: 0; transform-origin: var(--couloir-origine, 0 0);\n  color: inherit; text-decoration: none; border: 0; background: none; font: inherit; cursor: inherit; }\n.couloir-contenu img, img.couloir-contenu { display: block; width: 100%; height: 100%; object-fit: cover; -webkit-user-drag: none; }\n.couloir-contenu > figure, .couloir-contenu > a, .couloir-contenu > button { display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; }\n.couloir-panneau figcaption, .couloir-panneau .couloir-cache { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;\n  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }\n.couloir > .couloir-vide { background: var(--couloir-vide, color-mix(in srgb, var(--couloir-filet, #fff) 55%, #c9ccc6)); }\n.couloir-ouvrable .couloir-panneau:not(.couloir-vide) { cursor: zoom-in; }\n.couloir .couloir-cible:focus { outline: none; }\n.couloir .couloir-cible:focus-visible { outline: 4px solid var(--couloir-focus, #1d4ed8); outline-offset: -4px; }\n.couloir-commandes { position: relative; z-index: 3; display: flex; gap: 8px; width: max-content; height: 0;\n  margin: 0 0 0 max(16px, env(safe-area-inset-left)); transform: translateY(calc(-100% - 16px)); align-items: end; }\n.couloir-commandes button { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border-radius: 50%;\n  border: 1px solid color-mix(in srgb, currentColor 35%, transparent); color: inherit; cursor: pointer;\n  background: color-mix(in srgb, var(--couloir-fond-commandes, #fff) 82%, transparent); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }\n.couloir-commandes button:hover { background: color-mix(in srgb, var(--couloir-fond-commandes, #fff) 96%, transparent); }\n.couloir-commandes button:focus-visible { outline: 3px solid var(--couloir-focus, #1d4ed8); outline-offset: 2px; }\n.couloir-commandes svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }\n.couloir-commandes [hidden] { display: none !important; }\n.couloir-dialogue { max-width: min(92vw, 1100px); max-height: 92vh; padding: 0; border: 0; background: #111; color: #f2f2f2; }\n.couloir-dialogue::backdrop { background: rgba(10, 10, 12, 0.82); }\n.couloir-dialogue img { display: block; max-width: 100%; max-height: calc(92vh - 56px); object-fit: contain; }\n.couloir-dialogue p { margin: 0; padding: 10px 56px 12px 14px; font-size: 14px; }\n.couloir-dialogue button { position: absolute; top: 6px; right: 6px; width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgba(0,0,0,.5); color: inherit; font-size: 20px; cursor: pointer; }\n", B = {
	precedent: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 5l-7 7 7 7\"/></svg>",
	suivant: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 5l7 7-7 7\"/></svg>",
	pause: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 6v12M15 6v12\"/></svg>",
	lecture: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5.5v13l10-6.5z\"/></svg>"
}, V = !1, ge = 0, _e = () => typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, ve = "a[href], button, [tabindex]:not([tabindex='-1']), input, select, textarea", H = /* @__PURE__ */ new WeakMap(), U = (e) => H.get(e) ?? null;
function W(t) {
	let n = [...t.children].filter((e) => !e.classList.contains("couloir-commandes"));
	if (!n.length) return null;
	let r = `couloir-${++ge}`, i = t.tagName === "UL" || t.tagName === "OL";
	t.classList.add("couloir"), t.setAttribute("role", "list"), t.hasAttribute("aria-roledescription") || t.setAttribute("aria-roledescription", "couloir d'images");
	let a = n.map((e) => {
		let n, r;
		i && e.tagName === "LI" ? (n = e, e.children.length === 1 && e.firstElementChild instanceof HTMLElement ? r = e.firstElementChild : (r = document.createElement("div"), r.append(...e.childNodes), e.append(r))) : (n = document.createElement("div"), t.insertBefore(n, e), n.append(e), r = e), n.classList.add("couloir-panneau"), n.tagName !== "LI" && n.setAttribute("role", "listitem"), r.classList.add("couloir-contenu");
		for (let e of n.querySelectorAll("img")) e.decoding = "async", e.draggable = !1;
		let a = (r.matches(ve) ? r : n.querySelector(ve)) ?? n;
		return a.classList.add("couloir-cible"), {
			el: n,
			contenu: r,
			cible: a
		};
	}), o = a.length, c = document.createElementNS(he, "svg");
	c.setAttribute("aria-hidden", "true"), c.setAttribute("width", "0"), c.setAttribute("height", "0"), c.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
	let l = (e) => {
		let t = document.createElementNS(he, "filter");
		t.id = `${r}-${e}`, t.setAttribute("x", "-6%"), t.setAttribute("y", "-6%"), t.setAttribute("width", "112%"), t.setAttribute("height", "112%"), t.setAttribute("color-interpolation-filters", "sRGB"), t.innerHTML = "<feGaussianBlur in=\"SourceGraphic\" stdDeviation=\"0 0\" result=\"f\"/>\n      <feColorMatrix in=\"f\" type=\"matrix\" values=\"1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0\" result=\"r\"/>\n      <feOffset in=\"r\" dx=\"0\" dy=\"0\" result=\"r2\"/>\n      <feColorMatrix in=\"f\" type=\"matrix\" values=\"0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0\" result=\"g\"/>\n      <feColorMatrix in=\"f\" type=\"matrix\" values=\"0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0\" result=\"b\"/>\n      <feOffset in=\"b\" dx=\"0\" dy=\"0\" result=\"b2\"/>\n      <feBlend in=\"r2\" in2=\"g\" mode=\"screen\" result=\"rg\"/>\n      <feBlend in=\"rg\" in2=\"b2\" mode=\"screen\"/>", c.append(t);
		let [n, , i, , , a] = [...t.children];
		return {
			flou: n,
			r: i,
			b: a,
			ecrit: ""
		};
	}, u = [l("a"), l("b")];
	document.body.append(c);
	let d = null, f = document.createElement("button"), p = document.createElement("button"), m = document.createElement("button");
	for (let [e, t, n] of [
		[
			f,
			"Image précédente",
			B.precedent
		],
		[
			p,
			"Image suivante",
			B.suivant
		],
		[
			m,
			"Mettre en pause le défilement",
			B.pause
		]
	]) e.type = "button", e.setAttribute("aria-label", t), e.title = t, e.innerHTML = n;
	m.setAttribute("aria-pressed", "false");
	let g = t.dataset.couloirCommandes?.trim();
	if (g !== "non") {
		d = document.createElement("div"), d.className = "couloir-commandes", d.setAttribute("role", "group"), d.setAttribute("aria-label", `Commandes : ${t.getAttribute("aria-label") ?? "couloir d'images"}`), d.append(f, p, m);
		let e = g && g.startsWith("#") ? document.querySelector(g) : null;
		e ? (d.style.transform = "none", d.style.height = "auto", d.style.margin = "0", e.append(d)) : t.after(d);
	}
	let _ = h(t.dataset), v = x(_, t.clientWidth, t.clientHeight), y = _e(), b = [], S = [], C = 0, w = Infinity, T = 0, E = 0, D = null, O = null, k = null, j = !1, M = !0, N = 0, P = 0, F = -1, L = null, z = /* @__PURE__ */ new Map(), V = null, U = !1, W = 0, G = 0, K = (e) => _.pilotage.includes(e) && (!y || e !== "pointeur" && e !== "auto"), be = (e) => e < 1.15, q = () => {
		for (let e of b) (e.el.classList.contains("couloir-copie") || e.el.classList.contains("couloir-vide")) && e.el.remove();
		for (let e of a) e.el.style.transform = "", e.el.style.visibility = "", e.el.style.opacity = "", e.el.style.filter = "";
		W = t.clientWidth, G = t.clientHeight, v = x(_, W, G);
		let e = ne(v, 400), n = Math.min(44, e + 2);
		w = e + 2 > 44 ? 41.5 : Infinity, S = ie(o, _.vide, n, _.sansfin, o), C = S.length;
		let r = _.mode === "plafond";
		t.classList.toggle("couloir-plafond", r), t.classList.toggle("couloir-ouvrable", _.ouvre === "visionneuse"), t.style.setProperty("--couloir-w", `${r ? R : Math.round(R * _.largeur)}px`), t.style.setProperty("--couloir-h", `${r ? Math.round(R * _.largeur) : R}px`), t.style.setProperty("--couloir-filet", _.filet), _.fond ? t.style.setProperty("--couloir-fond", _.fond) : t.style.removeProperty("--couloir-fond"), t.style.setProperty("--couloir-origine", r ? _.cote === "droite" ? "50% 100%" : "50% 0" : _.cote === "droite" ? "0 50%" : "100% 50%");
		let c = /* @__PURE__ */ new Set();
		b = [];
		for (let e = 0; e < v.murs; e++) S.forEach((n, r) => {
			let o, s = null;
			if (n < 0) o = document.createElement(i ? "li" : "div"), o.className = "couloir-panneau couloir-vide", o.setAttribute("aria-hidden", "true"), o.setAttribute("role", "presentation");
			else if (e === 0 && !c.has(n)) c.add(n), o = a[n].el, s = a[n].contenu;
			else {
				o = a[n].el.cloneNode(!0), o.classList.add("couloir-copie"), o.setAttribute("aria-hidden", "true"), o.setAttribute("role", "presentation"), o.removeAttribute("id");
				for (let e of o.querySelectorAll("[id]")) e.removeAttribute("id");
				for (let e of o.querySelectorAll(".couloir-cible, a[href], button, [tabindex]")) e.tabIndex = -1, e.classList.remove("couloir-cible");
				o.classList.remove("couloir-cible"), o.hasAttribute("tabindex") && (o.tabIndex = -1), s = o.querySelector(".couloir-contenu");
			}
			(o.classList.contains("couloir-copie") || n < 0) && t.append(o), b.push({
				el: o,
				contenu: s,
				rang: n,
				mur: e,
				j: r,
				tf: "",
				ct: "",
				vu: !1,
				op: "",
				fi: ""
			});
		});
		for (let e of b) e.el.style.visibility = "hidden";
		_.sansfin || (T = s(T, 0, Math.max(0, C - 1))), Oe(), J(), Y();
	}, xe = () => {
		let e = -1, t = Infinity;
		for (let n = 0; n < C; n++) {
			if (S[n] < 0) continue;
			let r = A(n, T, C, _.sansfin), i = Math.abs(r - 0) + (r < -.5 ? .6 : 0);
			i < t && (t = i, e = n);
		}
		return e;
	}, J = () => {
		let e = y ? 0 : fe(E, _.aberration), n = y ? 0 : pe(E, _.flou), i = e > .35 || n > .35;
		u.forEach((t, r) => {
			let i = (e) => Math.round(e * (r === 0 ? 1 : .45) * 4) / 4, a = i(e), o = i(n), s = _.mode === "plafond", c = _.sens * (_.cote === "droite" ? 1 : -1) * (s ? -1 : 1), l = `${a}|${o}|${s}|${c}`;
			if (l !== t.ecrit) {
				t.ecrit = l, t.flou.setAttribute("stdDeviation", s ? `0 ${o}` : `${o} 0`);
				for (let [e, n] of [[t.r, 1], [t.b, -1]]) e.setAttribute(s ? "dy" : "dx", String(a * n * c)), e.setAttribute(s ? "dx" : "dy", "0");
			}
		});
		let a = _.mode === "plafond" ? R : R * _.largeur, o = _.mode === "plafond" ? R * _.largeur : R;
		for (let e of b) {
			let t = A(e.mur === 0 || !_.sansfin ? e.j : e.j + Math.round(C * e.mur / v.murs) + 1, T, C, _.sansfin), n = w === Infinity ? 1 : me(t, w), s = 1 + (z.get(e.el) ?? 0) * _.survol, c = ce(t, e.mur, v, s), l = n > .01 && c.uLoin > -1 && c.uProche < v.L + 1 && t > -2.2;
			if (l !== e.vu && (e.vu = l, e.el.style.visibility = l ? "visible" : "hidden"), !l) {
				e.fi && (e.el.style.filter = e.fi = "");
				continue;
			}
			let u = `matrix3d(${oe(ae(...c.quad), a, o).map((e) => Math.abs(e) < 1e-12 ? 0 : +e.toPrecision(7)).join(",")})`;
			if (u !== e.tf && (e.tf = u, e.el.style.transform = u), e.contenu) {
				let t = Math.round(c.part * 2e3) / 2e3, n = t >= .9995 ? "" : _.mode === "plafond" ? `scale(1,${t})` : `scale(${t},1)`;
				n !== e.ct && (e.ct = n, e.contenu.style.transform = n);
			}
			let d = n >= .999 ? "" : n.toFixed(3);
			d !== e.op && (e.op = d, e.el.style.opacity = d);
			let f = i && e.rang >= 0 ? be(t) ? `url(#${r}-a)` : t < 3 ? `url(#${r}-b)` : "" : "";
			f !== e.fi && (e.fi = f, e.el.style.filter = f);
			let p = L === e.el ? "5" : "";
			e.el.style.zIndex !== p && (e.el.style.zIndex = p);
		}
		let s = xe(), c = s >= 0 ? S[s] : -1;
		c !== F && c >= 0 && (F = c, t.dispatchEvent(new CustomEvent("couloir:change", { detail: { index: c } })));
	}, Se = () => j || V?.parti ? 0 : K("pointeur") && k != null ? le(k, _.vitesse) : K("auto") && M ? _.vitesse * ue : 0, Ce = () => {
		if (!M || document.hidden) return !1;
		if (D != null || V?.parti || Math.abs(E) > .002 || Math.abs(Se()) > .002) return !0;
		for (let [e, t] of z) if (Math.abs(t - +(e === L)) > .002) return !0;
		return !1;
	}, we = (e) => {
		N = 0;
		let n = P ? Math.min(.05, (e - P) / 1e3) : 1 / 60;
		if (P = e, D != null && O && O.vers === D) {
			O.t0 ??= e - n * 1e3;
			let t = (e - O.t0) / O.dur;
			E = 0, t >= 1 ? (T = D, D = null, O = null) : T = O.de + (O.vers - O.de) * O.f(Math.max(0, t));
		} else D == null ? V?.parti || (E = I(E, Se(), n, j ? Math.min(.25, de(_.inertie)) : de(_.inertie)), Math.abs(E) < .002 && Math.abs(Se()) < .002 && (E = 0), T += E * _.sens * n) : (T = I(T, D, n, y ? .001 : .16), E = 0, Math.abs(T - D) < .0015 && (T = D, D = null));
		if (_.sansfin) Math.abs(T) > C * 1e3 && (T = (T % C + C) % C);
		else {
			let e = s(T, 0, Math.max(0, C - 1));
			e !== T && (T = e, E = 0);
		}
		for (let [e, t] of z) {
			let r = +(e === L), i = I(t, r, n, .14);
			Math.abs(i - r) < .002 && r === 0 ? z.delete(e) : z.set(e, Math.abs(i - r) < .002 ? r : i);
		}
		J();
		let r = Ce();
		t.classList.toggle("couloir-bouge", r), r ? N = requestAnimationFrame(we) : (P = 0, E === 0 && J());
	}, Y = () => {
		!N && Ce() && (P = 0, t.classList.add("couloir-bouge"), N = requestAnimationFrame(we));
	}, X = (n, r = !1) => {
		if (!C) return;
		let i = (n % o + o) % o, a = T, s = Infinity;
		for (let e = 0; e < C; e++) {
			if (S[e] !== i) continue;
			let t = _.sansfin ? re(T, e, C) : e - T;
			Math.abs(t) < Math.abs(s) && (s = t, a = T + t);
		}
		E = 0, r || y ? (y && !r && typeof t.animate == "function" && t.animate([
			{ opacity: 1 },
			{
				opacity: .35,
				offset: .4
			},
			{ opacity: 1 }
		], {
			duration: 220,
			easing: "ease-out"
		}), D = null, T = a, J()) : (D = a, O = _.duree !== null || _.courbe !== null ? {
			de: T,
			vers: a,
			t0: null,
			dur: (_.duree ?? .6) * 1e3,
			f: e(_.courbe ?? "out")
		} : null, Y());
	}, Te = () => X(F + 1), Ee = () => X(F - 1), De = (e) => {
		j = e ?? !j, m.setAttribute("aria-pressed", String(j));
		let t = j ? "Reprendre le défilement" : "Mettre en pause le défilement";
		return m.setAttribute("aria-label", t), m.title = t, m.innerHTML = j ? B.lecture : B.pause, Y(), j;
	}, Oe = () => {
		m.hidden = y || !(_.pilotage.includes("auto") || _.pilotage.includes("pointeur"));
	};
	f.addEventListener("click", Ee), p.addEventListener("click", Te), m.addEventListener("click", () => De());
	let ke = (e) => {
		let n = t.getBoundingClientRect();
		return se(e.clientX - n.left, e.clientY - n.top, v);
	}, Z = (e) => e instanceof Element ? e.closest(".couloir-panneau") : null, Ae = (e) => {
		let [n] = ke(e);
		if (e.pointerType === "mouse") {
			let e = k;
			k = s(n / v.L, 0, 1), e != null && K("pointeur") && !V?.parti && (E += (k - e) * _.vitesse * 3);
		}
		let r = Z(e.target), i = _.survol > 0 && r && !r.classList.contains("couloir-vide") && !V?.parti ? r : null;
		if (i !== L && (L = i, i && !z.has(i) && z.set(i, 0)), V && e.pointerId === V.id) {
			let r = e.clientX - V.x, i = e.clientY - V.y, a = _.mode === "plafond" ? Math.abs(i) : Math.abs(r), o = _.mode === "plafond" ? Math.abs(r) : Math.abs(i);
			if (!V.parti && a > 6 && a > o) {
				V.parti = !0, U = !0, t.classList.add("couloir-glisse");
				try {
					t.setPointerCapture(e.pointerId);
				} catch {}
				D = null;
			}
			if (V.parti) {
				let e = n - V.u, t = ee(s(te(n, v), -1, 60), v), r = -e / t;
				T += r;
				let i = performance.now(), a = Math.max(1, i - V.t) / 1e3;
				V.vit = .7 * V.vit + r / a * .3, V.t = i, V.u = n, _.sansfin || (T = s(T, 0, Math.max(0, C - 1))), J();
			}
		}
		Y();
	}, je = (e) => {
		e.pointerType === "mouse" && !V?.parti && (k = null), L = null, Y();
	}, Me = (e) => {
		if (!K("glisser") || e.button !== 0) return;
		let [t] = ke(e);
		V = {
			id: e.pointerId,
			u: t,
			t: performance.now(),
			d: T,
			vit: 0,
			parti: !1,
			x: e.clientX,
			y: e.clientY
		}, U = !1;
	}, Q = (e) => {
		if (V && e.pointerId === V.id) {
			if (V.parti) {
				E = s(V.vit, -8, 8) * _.sens, t.classList.remove("couloir-glisse");
				try {
					t.releasePointerCapture(e.pointerId);
				} catch {}
			}
			V = null, e.pointerType !== "mouse" && (k = null), Y();
		}
	}, Ne = (e) => {
		if (!K("molette")) return;
		let t = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		if (!t) return;
		e.preventDefault();
		let n = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? v.C : 1;
		E = s(E + t * n * .006 * _.sens, -10, 10), D = null, Y();
	}, Pe = typeof scrollY == "number" ? scrollY : 0, Fe = () => {
		let e = scrollY, t = e - Pe;
		Pe = e, K("defilement") && M && t && (E = s(E + t / Math.max(200, v.C) * 4 * _.sens, -10, 10), D = null, Y());
	}, Ie = (e) => {
		if (U) {
			U = !1, e.preventDefault(), e.stopPropagation();
			return;
		}
		if (_.ouvre !== "visionneuse") return;
		let t = Z(e.target);
		if (!t || t.classList.contains("couloir-vide")) return;
		let n = b.find((e) => e.el === t);
		!n || n.rang < 0 || (e.preventDefault(), e.stopPropagation(), Le(n.rang));
	}, Le = async (e) => {
		try {
			await (await import("./lightbox-z8H1tizc.js")).openLightbox(t, e, ":scope > .couloir-panneau:not(.couloir-copie):not(.couloir-vide) img");
		} catch {
			ye(a[e].el.querySelector("img"));
		}
	}, Re = (e) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		let t = Z(e.target);
		if (!t || _.ouvre !== "visionneuse" || e.target.matches("a[href], button")) return;
		let n = a.findIndex((e) => e.el === t);
		n < 0 || (e.preventDefault(), Le(n));
	}, ze = (e) => {
		let n = Z(e.target), r = a.findIndex((e) => e.el === n);
		r < 0 || ((r !== F || Math.abs(A(b.find((e) => e.el === n).j, T, C, _.sansfin)) > .6) && X(r), t.scrollLeft = 0, t.scrollTop = 0);
	};
	t.addEventListener("pointermove", Ae, { passive: !0 }), t.addEventListener("pointerleave", je, { passive: !0 }), t.addEventListener("pointerdown", Me, { passive: !0 }), t.addEventListener("pointerup", Q, { passive: !0 }), t.addEventListener("pointercancel", Q, { passive: !0 }), t.addEventListener("wheel", Ne, { passive: !1 }), t.addEventListener("click", Ie, !0), t.addEventListener("keydown", Re), t.addEventListener("focusin", ze), t.addEventListener("dragstart", (e) => e.preventDefault()), addEventListener("scroll", Fe, { passive: !0 });
	let $ = null;
	import("./focus-itinerant-D8W65vyv.js").then(({ creerFocusItinerant: e }) => {
		Ge || ($ = e(t, {
			elements: ":scope > .couloir-panneau:not(.couloir-copie) .couloir-cible, :scope > .couloir-panneau.couloir-cible:not(.couloir-copie)",
			orientation: _.mode === "plafond" ? "les-deux" : "horizontal",
			boucle: _.sansfin,
			cle: (e) => String(a.findIndex((t) => t.cible === e)),
			surDeplacement: (e, t) => X(t)
		}));
	});
	let Be = new ResizeObserver(() => {
		(t.clientWidth !== W || t.clientHeight !== G) && q();
	});
	Be.observe(t);
	let Ve = new IntersectionObserver((e) => {
		M = e[e.length - 1].isIntersecting, M && Y();
	});
	Ve.observe(t);
	let He = () => {
		document.hidden || Y();
	};
	document.addEventListener("visibilitychange", He);
	let Ue = typeof matchMedia == "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null, We = () => {
		y = _e(), Oe(), J(), Y();
	};
	Ue?.addEventListener("change", We);
	let Ge = !1, Ke = {
		aller: X,
		suivant: Te,
		precedent: Ee,
		pause: De,
		regler: () => {
			let e = _.mode + _.sansfin;
			_ = h(t.dataset), q(), e !== _.mode + _.sansfin && ($?.detruire(), $ = null, import("./focus-itinerant-D8W65vyv.js").then(({ creerFocusItinerant: e }) => {
				Ge || ($ = e(t, {
					elements: ":scope > .couloir-panneau:not(.couloir-copie) .couloir-cible, :scope > .couloir-panneau.couloir-cible:not(.couloir-copie)",
					orientation: _.mode === "plafond" ? "les-deux" : "horizontal",
					boucle: _.sansfin,
					cle: (e) => String(a.findIndex((t) => t.cible === e)),
					surDeplacement: (e, t) => X(t)
				}));
			}));
		},
		reglages: () => ({
			..._,
			pilotage: [..._.pilotage]
		}),
		index: () => F,
		etat: () => ({
			decalage: T,
			vitesse: E,
			actif: N !== 0,
			panneaux: b.length
		}),
		detruire: () => {
			Ge = !0, cancelAnimationFrame(N), Be.disconnect(), Ve.disconnect(), $?.detruire(), Ue?.removeEventListener("change", We), document.removeEventListener("visibilitychange", He), removeEventListener("scroll", Fe), t.removeEventListener("pointermove", Ae), t.removeEventListener("pointerleave", je), t.removeEventListener("pointerdown", Me), t.removeEventListener("pointerup", Q), t.removeEventListener("pointercancel", Q), t.removeEventListener("wheel", Ne), t.removeEventListener("click", Ie, !0), t.removeEventListener("keydown", Re), t.removeEventListener("focusin", ze);
			for (let e of b) (e.el.classList.contains("couloir-copie") || e.el.classList.contains("couloir-vide")) && e.el.remove();
			c.remove(), d?.remove(), H.delete(t);
		}
	};
	return H.set(t, Ke), q(), Ke;
}
function ye(e) {
	if (!e) return;
	let t = document.createElement("dialog");
	t.className = "couloir-dialogue", t.setAttribute("aria-label", e.alt || "Image");
	let n = document.createElement("img");
	n.src = e.currentSrc || e.src, n.alt = e.alt;
	let r = document.createElement("p");
	r.textContent = e.alt;
	let i = document.createElement("button");
	i.type = "button", i.setAttribute("aria-label", "Fermer"), i.textContent = "✕", i.addEventListener("click", () => t.close()), t.append(n, r, i), t.addEventListener("close", () => t.remove()), t.setAttribute("closedby", "any"), "closedBy" in HTMLDialogElement.prototype || t.addEventListener("click", (e) => {
		e.target === t && t.close();
	}), document.body.append(t), t.showModal();
}
function G(e = document) {
	let t = /* @__PURE__ */ new Map();
	if (typeof document > "u") return t;
	if (!V) {
		let e = document.createElement("style");
		e.dataset.presse = "couloir", e.textContent = z, document.head.prepend(e), V = !0;
	}
	for (let n of e.querySelectorAll("[data-couloir]")) {
		let e = H.get(n);
		if (e) {
			t.set(n, e);
			continue;
		}
		let r = W(n);
		r && t.set(n, r);
	}
	return t;
}
export { c as BORNES, b as COUDE_MAX, a as DEFAUTS, g as DUREE_TRAJET, L as PANNEAUX_MAX, ue as PART_AUTO, r as PILOTAGES, o as PRESETS, i as PRESETS_NOMS, fe as aberrationPx, I as amortir, N as appliquer, v as attributsDe, s as borner, ae as carreVersQuad, k as centres, U as controleCouloir, u as couleurSure, W as couloir, M as cycle, te as dDeU, re as ecartBoucle, S as echelle, O as filetDe, pe as flouPx, me as fonduFond, x as geometrie, D as hDe, j as hasard, G as initCouloir, P as inverser, p as lirePilotage, h as lireReglages, oe as matrice3d, ne as panneauxUtiles, ee as pasDe, ce as poser, A as profondeurDe, ie as sequence, de as tauDe, E as uDe, F as versEcran, se as versLocal, le as vitessePointeur };
