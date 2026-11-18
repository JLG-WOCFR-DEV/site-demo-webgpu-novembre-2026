//#region src/presse/couloir.ts
var e = [
	"pointeur",
	"defilement",
	"glisser",
	"auto",
	"molette"
], t = [
	"micro",
	"tunnel",
	"lookbook",
	"doux",
	"rapide"
], n = Object.freeze({
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
}), r = {
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
}, i = (e, t, n) => Math.max(t, Math.min(n, e)), a = {
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
}, o = Object.keys(a);
function s(e) {
	if (e == null) return null;
	let t = e.trim();
	return t ? t.length <= 64 && /^[#a-z0-9(),.%\s/-]+$/i.test(t) && !/url|expression/i.test(t) ? t : null : "";
}
var c = (e) => e === "" || e === "oui" || e === "1" || e === "true", l = (e) => e === "non" || e === "0" || e === "false";
function u(t) {
	let n = /* @__PURE__ */ new Set();
	for (let r of t.toLowerCase().split(/[\s,+|]+/)) e.includes(r) && n.add(r);
	return [...n];
}
var d = (e) => "couloir" + e[0].toUpperCase() + e.slice(1);
function f(e) {
	let f = (e.couloirPresets ?? "").trim().toLowerCase(), p = t.includes(f) ? f : null, m = {
		...n,
		pilotage: [...n.pilotage],
		...p ? r[p] : {},
		preset: p
	};
	p && r[p].pilotage && (m.pilotage = [...r[p].pilotage]);
	for (let t of o) {
		let n = e[d(t)];
		if (n == null || n.trim() === "") continue;
		let r = Number(n.replace(",", "."));
		Number.isFinite(r) && (m[t] = i(r, a[t][0], a[t][1]));
	}
	let h = e.couloirCote?.trim();
	(h === "droite" || h === "gauche") && (m.cote = h);
	let g = e.couloirMur?.trim();
	g === "un" || g === "deux" || g === "trois" ? m.mur = g : (g === "1" || g === "2" || g === "3") && (m.mur = [
		"un",
		"deux",
		"trois"
	][Number(g) - 1]);
	let _ = e.couloirMode?.trim();
	(_ === "mur" || _ === "plafond") && (m.mode = _);
	let v = e.couloirOuvre?.trim();
	v === "non" || v === "visionneuse" ? m.ouvre = v : (v === "" || v === "oui") && (m.ouvre = "visionneuse"), e.couloirPilotage != null && (m.pilotage = u(e.couloirPilotage));
	let y = e.couloirSens?.trim();
	if (y === "arriere" || y === "-1" ? m.sens = -1 : (y === "avant" || y === "1") && (m.sens = 1), e.couloirSansfin != null) {
		let t = e.couloirSansfin.trim().toLowerCase();
		l(t) ? m.sansfin = !1 : c(t) && (m.sansfin = !0);
	}
	let b = s(e.couloirFilet);
	b && (m.filet = b);
	let x = s(e.couloirFond);
	return x != null && (m.fond = x), m;
}
var p = 1.1;
function m(e, t, n) {
	let r = e.mode === "plafond", a = Math.max(1, r ? n : t), o = Math.max(1, r ? t : n), s = Math.min(a, o), c = e.profondeur, l = Math.max(2, e.hauteur * s), u = Math.min(l / 1.01, Math.max(1, e.bande * s, l * c / (c + 26)));
	return {
		L: a,
		C: o,
		R: s,
		u0: .03 * a,
		uf: (r ? i(1 - e.horizon / 100, .2, .95) : .78) * a,
		P: c,
		b: u * e.largeur,
		H0: l,
		hb: u,
		dc: c * (l / u - 1),
		c0: r ? o / 2 : o * e.horizon / 100,
		pente: Math.tan(e.angle * Math.PI / 180),
		ecart: e.ecart,
		ouverture: e.ouverture * s,
		murs: e.mur === "trois" ? 3 : e.mur === "deux" ? 2 : 1,
		mode: e.mode,
		cote: e.cote
	};
}
var h = (e, t) => e >= 0 ? t / (t + e) : Math.exp(-e / t), g = (e, t) => e >= 0 ? t / (t + e) ** 2 : Math.exp(-e / t) / t, _ = (e, t) => e / t > 30 ? e : t * Math.log1p(Math.exp(e / t)), v = (e, t) => 1 / (1 + Math.exp(-e / t)), y = (e, t) => t.uf - (t.uf - t.u0) * h(e, t.P) + t.b * _(e - t.dc, p), b = (e, t) => (t.uf - t.u0) * g(e, t.P) + t.b * v(e - t.dc, p), x = (e, t) => ((t.H0 * h(e, t.P)) ** 4 + t.hb ** 4) ** .25;
function S(e, t) {
	let n = -8, r = 4e3;
	for (let i = 0; i < 64; i++) {
		let i = (n + r) / 2;
		y(i, t) < e ? n = i : r = i;
	}
	return (n + r) / 2;
}
var C = (e, t) => t.ecart > 0 ? Math.max(.5, t.ecart * x(e, t) / t.H0) : 0;
function w(e, t, n = x(e, t)) {
	let r = t.c0 + t.pente * (y(e, t) - t.uf);
	if (t.murs === 1) return [r];
	let i = Math.max(t.ouverture * x(e, t) / t.H0, C(e, t));
	return t.murs === 2 ? [r - (n + i) / 2, r + (n + i) / 2] : [
		r - n - i,
		r,
		r + n + i
	];
}
function ee(e, t = 400) {
	for (let n = 1; n <= t; n++) if (y(n, e) > e.L + 8) return n + 1;
	return t;
}
function T(e, t, n, r) {
	let i = e - t;
	return !r || n <= 0 ? i : ((i + 2) % n + n) % n - 2;
}
function te(e, t, n) {
	if (!(n > 0)) return t - e;
	let r = (t - e) % n;
	return r > n / 2 && (r -= n), r < -n / 2 && (r += n), r;
}
function E(e, t = 0) {
	let n = (Math.imul(e + 1, 2654435761) ^ Math.imul(t + 7, 2246822507)) >>> 0;
	return n = Math.imul(n ^ n >>> 16, 2146121005) >>> 0, n = Math.imul(n ^ n >>> 15, 2221713035) >>> 0, ((n ^ n >>> 16) >>> 0) / 4294967296;
}
function D(e, t, n = 0) {
	let r = [];
	for (let i = 0, a = 0; i < e; a++) r.length > 0 && r[r.length - 1] !== -1 && t > 0 && E(a, n) < t ? r.push(-1) : r.push(i++);
	return r;
}
function ne(e, t, n, r, i = 0) {
	if (e <= 0) return [];
	let a = D(e, t, i);
	if (!r) return a;
	let o = [...a];
	for (; o.length < n;) o.push(...a);
	return o;
}
function re(e, t, n, r) {
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
function O(e, t, n) {
	let r = e[6] * t + e[7] * n + e[8];
	return [(e[0] * t + e[1] * n + e[2]) / r, (e[3] * t + e[4] * n + e[5]) / r];
}
function k(e) {
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
function ie(e, t, n) {
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
function A(e, t, n) {
	return n.mode === "plafond" ? n.cote === "droite" ? [t, n.L - e] : [t, e] : n.cote === "droite" ? [e, t] : [n.L - e, t];
}
function ae(e, t, n) {
	return n.mode === "plafond" ? n.cote === "droite" ? [n.L - t, e] : [t, e] : n.cote === "droite" ? [e, t] : [n.L - e, t];
}
function oe(e, t, n, r = 1) {
	let a = e, o = e + 1, s = y(a, n), c = y(o, n), l = x(a, n) * r, u = x(o, n) * r, d = w(a, n, l)[t] ?? 0, f = w(o, n, u)[t] ?? 0, p = A(s, d - l / 2, n), m = A(s, d + l / 2, n), h = A(c, f - u / 2, n), g = A(c, f + u / 2, n), _;
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
	let v = 1, S = C(o, n);
	if (S > 0) {
		let e = (y(Math.max(a + .05, o - S / b(o, n)), n) - s) / (c - s || 1), t = A(s + e * (c - s), d - l / 2 + e * (f - u / 2 - (d - l / 2)), n), [r, p] = O(k(re(..._)), t[0], t[1]);
		v = i(n.mode === "plafond" ? n.cote === "droite" ? 1 - p : p : n.cote === "droite" ? r : 1 - r, .05, 1);
	}
	return {
		quad: _,
		part: v,
		uProche: s,
		uLoin: c
	};
}
var se = (e, t) => t * (.12 + 1.88 * i(e, 0, 1) ** 2), ce = .35, le = (e) => .06 + i(e, 0, 1) * 1.1, j = (e, t, n, r) => t + (e - t) * Math.exp(-Math.max(0, n) / Math.max(.001, r)), ue = (e, t, n = 10) => t > 0 ? Math.min(n, Math.abs(e) * t * 4) : 0, de = (e, t, n = 10) => t > 0 ? Math.min(n, Math.abs(e) * t * 3) : 0, fe = (e, t) => i((t - e) / 2, 0, 1), pe = "http://www.w3.org/2000/svg", M = 560, N = "\n.couloir { position: relative; overflow: hidden; display: block; margin: 0; padding: 0; list-style: none;\n  contain: layout paint style; background: var(--couloir-fond, transparent); touch-action: pan-y;\n  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }\n.couloir.couloir-plafond { touch-action: pan-x; }\n.couloir.couloir-glisse { cursor: grabbing; }\n.couloir > .couloir-panneau { position: absolute; left: 0; top: 0; margin: 0; padding: 0; box-sizing: border-box;\n  width: var(--couloir-w); height: var(--couloir-h); transform-origin: 0 0; overflow: hidden; visibility: hidden;\n  background: var(--couloir-filet, #fff); backface-visibility: hidden; list-style: none; }\n.couloir-contenu { display: block; width: 100%; height: 100%; margin: 0; padding: 0; transform-origin: var(--couloir-origine, 0 0);\n  color: inherit; text-decoration: none; border: 0; background: none; font: inherit; cursor: inherit; }\n.couloir-contenu img, img.couloir-contenu { display: block; width: 100%; height: 100%; object-fit: cover; -webkit-user-drag: none; }\n.couloir-contenu > figure, .couloir-contenu > a, .couloir-contenu > button { display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; }\n.couloir-panneau figcaption, .couloir-panneau .couloir-cache { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;\n  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }\n.couloir > .couloir-vide { background: var(--couloir-vide, color-mix(in srgb, var(--couloir-filet, #fff) 55%, #c9ccc6)); }\n.couloir-ouvrable .couloir-panneau:not(.couloir-vide) { cursor: zoom-in; }\n.couloir .couloir-cible:focus { outline: none; }\n.couloir .couloir-cible:focus-visible { outline: 4px solid var(--couloir-focus, #1d4ed8); outline-offset: -4px; }\n.couloir-commandes { position: relative; z-index: 3; display: flex; gap: 8px; width: max-content; height: 0;\n  margin: 0 0 0 max(16px, env(safe-area-inset-left)); transform: translateY(calc(-100% - 16px)); align-items: end; }\n.couloir-commandes button { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border-radius: 50%;\n  border: 1px solid color-mix(in srgb, currentColor 35%, transparent); color: inherit; cursor: pointer;\n  background: color-mix(in srgb, var(--couloir-fond-commandes, #fff) 82%, transparent); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }\n.couloir-commandes button:hover { background: color-mix(in srgb, var(--couloir-fond-commandes, #fff) 96%, transparent); }\n.couloir-commandes button:focus-visible { outline: 3px solid var(--couloir-focus, #1d4ed8); outline-offset: 2px; }\n.couloir-commandes svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }\n.couloir-commandes [hidden] { display: none !important; }\n.couloir-dialogue { max-width: min(92vw, 1100px); max-height: 92vh; padding: 0; border: 0; background: #111; color: #f2f2f2; }\n.couloir-dialogue::backdrop { background: rgba(10, 10, 12, 0.82); }\n.couloir-dialogue img { display: block; max-width: 100%; max-height: calc(92vh - 56px); object-fit: contain; }\n.couloir-dialogue p { margin: 0; padding: 10px 56px 12px 14px; font-size: 14px; }\n.couloir-dialogue button { position: absolute; top: 6px; right: 6px; width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgba(0,0,0,.5); color: inherit; font-size: 20px; cursor: pointer; }\n", P = {
	precedent: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 5l-7 7 7 7\"/></svg>",
	suivant: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 5l7 7-7 7\"/></svg>",
	pause: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 6v12M15 6v12\"/></svg>",
	lecture: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5.5v13l10-6.5z\"/></svg>"
}, F = !1, me = 0, he = () => typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, ge = "a[href], button, [tabindex]:not([tabindex='-1']), input, select, textarea", I = /* @__PURE__ */ new WeakMap();
function L(e) {
	let t = [...e.children].filter((e) => !e.classList.contains("couloir-commandes"));
	if (!t.length) return null;
	let n = `couloir-${++me}`, r = e.tagName === "UL" || e.tagName === "OL";
	e.classList.add("couloir"), e.setAttribute("role", "list"), e.hasAttribute("aria-roledescription") || e.setAttribute("aria-roledescription", "couloir d'images");
	let a = t.map((t) => {
		let n, i;
		r && t.tagName === "LI" ? (n = t, t.children.length === 1 && t.firstElementChild instanceof HTMLElement ? i = t.firstElementChild : (i = document.createElement("div"), i.append(...t.childNodes), t.append(i))) : (n = document.createElement("div"), e.insertBefore(n, t), n.append(t), i = t), n.classList.add("couloir-panneau"), n.tagName !== "LI" && n.setAttribute("role", "listitem"), i.classList.add("couloir-contenu");
		for (let e of n.querySelectorAll("img")) e.decoding = "async", e.draggable = !1;
		let a = (i.matches(ge) ? i : n.querySelector(ge)) ?? n;
		return a.classList.add("couloir-cible"), {
			el: n,
			contenu: i,
			cible: a
		};
	}), o = a.length, s = document.createElementNS(pe, "svg");
	s.setAttribute("aria-hidden", "true"), s.setAttribute("width", "0"), s.setAttribute("height", "0"), s.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
	let c = (e) => {
		let t = document.createElementNS(pe, "filter");
		t.id = `${n}-${e}`, t.setAttribute("x", "-6%"), t.setAttribute("y", "-6%"), t.setAttribute("width", "112%"), t.setAttribute("height", "112%"), t.setAttribute("color-interpolation-filters", "sRGB"), t.innerHTML = "<feGaussianBlur in=\"SourceGraphic\" stdDeviation=\"0 0\" result=\"f\"/>\n      <feColorMatrix in=\"f\" type=\"matrix\" values=\"1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0\" result=\"r\"/>\n      <feOffset in=\"r\" dx=\"0\" dy=\"0\" result=\"r2\"/>\n      <feColorMatrix in=\"f\" type=\"matrix\" values=\"0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0\" result=\"g\"/>\n      <feColorMatrix in=\"f\" type=\"matrix\" values=\"0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0\" result=\"b\"/>\n      <feOffset in=\"b\" dx=\"0\" dy=\"0\" result=\"b2\"/>\n      <feBlend in=\"r2\" in2=\"g\" mode=\"screen\" result=\"rg\"/>\n      <feBlend in=\"rg\" in2=\"b2\" mode=\"screen\"/>", s.append(t);
		let [r, , i, , , a] = [...t.children];
		return {
			flou: r,
			r: i,
			b: a,
			ecrit: ""
		};
	}, l = [c("a"), c("b")];
	document.body.append(s);
	let u = null, d = document.createElement("button"), p = document.createElement("button"), h = document.createElement("button");
	for (let [e, t, n] of [
		[
			d,
			"Image précédente",
			P.precedent
		],
		[
			p,
			"Image suivante",
			P.suivant
		],
		[
			h,
			"Mettre en pause le défilement",
			P.pause
		]
	]) e.type = "button", e.setAttribute("aria-label", t), e.title = t, e.innerHTML = n;
	h.setAttribute("aria-pressed", "false");
	let g = e.dataset.couloirCommandes?.trim();
	if (g !== "non") {
		u = document.createElement("div"), u.className = "couloir-commandes", u.setAttribute("role", "group"), u.setAttribute("aria-label", `Commandes : ${e.getAttribute("aria-label") ?? "couloir d'images"}`), u.append(d, p, h);
		let t = g && g.startsWith("#") ? document.querySelector(g) : null;
		t ? (u.style.transform = "none", u.style.height = "auto", u.style.margin = "0", t.append(u)) : e.after(u);
	}
	let _ = f(e.dataset), v = m(_, e.clientWidth, e.clientHeight), y = he(), x = [], C = [], w = 0, E = Infinity, D = 0, O = 0, k = null, A = null, N = !1, F = !0, L = 0, R = 0, z = -1, B = null, V = /* @__PURE__ */ new Map(), H = null, U = !1, W = 0, G = 0, K = (e) => _.pilotage.includes(e) && (!y || e !== "pointeur" && e !== "auto"), ve = (e) => e < 1.15, q = () => {
		for (let e of x) (e.el.classList.contains("couloir-copie") || e.el.classList.contains("couloir-vide")) && e.el.remove();
		for (let e of a) e.el.style.transform = "", e.el.style.visibility = "", e.el.style.opacity = "", e.el.style.filter = "";
		W = e.clientWidth, G = e.clientHeight, v = m(_, W, G);
		let t = ee(v, 400), n = Math.min(44, t + 2);
		E = t + 2 > 44 ? 41.5 : Infinity, C = ne(o, _.vide, n, _.sansfin, o), w = C.length;
		let s = _.mode === "plafond";
		e.classList.toggle("couloir-plafond", s), e.classList.toggle("couloir-ouvrable", _.ouvre === "visionneuse"), e.style.setProperty("--couloir-w", `${s ? M : Math.round(M * _.largeur)}px`), e.style.setProperty("--couloir-h", `${s ? Math.round(M * _.largeur) : M}px`), e.style.setProperty("--couloir-filet", _.filet), _.fond ? e.style.setProperty("--couloir-fond", _.fond) : e.style.removeProperty("--couloir-fond"), e.style.setProperty("--couloir-origine", s ? _.cote === "droite" ? "50% 100%" : "50% 0" : _.cote === "droite" ? "0 50%" : "100% 50%");
		let c = /* @__PURE__ */ new Set();
		x = [];
		for (let t = 0; t < v.murs; t++) C.forEach((n, i) => {
			let o, s = null;
			if (n < 0) o = document.createElement(r ? "li" : "div"), o.className = "couloir-panneau couloir-vide", o.setAttribute("aria-hidden", "true"), o.setAttribute("role", "presentation");
			else if (t === 0 && !c.has(n)) c.add(n), o = a[n].el, s = a[n].contenu;
			else {
				o = a[n].el.cloneNode(!0), o.classList.add("couloir-copie"), o.setAttribute("aria-hidden", "true"), o.setAttribute("role", "presentation"), o.removeAttribute("id");
				for (let e of o.querySelectorAll("[id]")) e.removeAttribute("id");
				for (let e of o.querySelectorAll(".couloir-cible, a[href], button, [tabindex]")) e.tabIndex = -1, e.classList.remove("couloir-cible");
				o.classList.remove("couloir-cible"), o.hasAttribute("tabindex") && (o.tabIndex = -1), s = o.querySelector(".couloir-contenu");
			}
			(o.classList.contains("couloir-copie") || n < 0) && e.append(o), x.push({
				el: o,
				contenu: s,
				rang: n,
				mur: t,
				j: i,
				tf: "",
				ct: "",
				vu: !1,
				op: "",
				fi: ""
			});
		});
		for (let e of x) e.el.style.visibility = "hidden";
		_.sansfin || (D = i(D, 0, Math.max(0, w - 1))), Ee(), J(), Y();
	}, ye = () => {
		let e = -1, t = Infinity;
		for (let n = 0; n < w; n++) {
			if (C[n] < 0) continue;
			let r = T(n, D, w, _.sansfin), i = Math.abs(r - 0) + (r < -.5 ? .6 : 0);
			i < t && (t = i, e = n);
		}
		return e;
	}, J = () => {
		let t = y ? 0 : ue(O, _.aberration), r = y ? 0 : de(O, _.flou), i = t > .35 || r > .35;
		l.forEach((e, n) => {
			let i = (e) => Math.round(e * (n === 0 ? 1 : .45) * 4) / 4, a = i(t), o = i(r), s = _.mode === "plafond", c = _.sens * (_.cote === "droite" ? 1 : -1) * (s ? -1 : 1), l = `${a}|${o}|${s}|${c}`;
			if (l !== e.ecrit) {
				e.ecrit = l, e.flou.setAttribute("stdDeviation", s ? `0 ${o}` : `${o} 0`);
				for (let [t, n] of [[e.r, 1], [e.b, -1]]) t.setAttribute(s ? "dy" : "dx", String(a * n * c)), t.setAttribute(s ? "dx" : "dy", "0");
			}
		});
		let a = _.mode === "plafond" ? M : M * _.largeur, o = _.mode === "plafond" ? M * _.largeur : M;
		for (let e of x) {
			let t = T(e.mur === 0 || !_.sansfin ? e.j : e.j + Math.round(w * e.mur / v.murs) + 1, D, w, _.sansfin), r = E === Infinity ? 1 : fe(t, E), s = 1 + (V.get(e.el) ?? 0) * _.survol, c = oe(t, e.mur, v, s), l = r > .01 && c.uLoin > -1 && c.uProche < v.L + 1 && t > -2.2;
			if (l !== e.vu && (e.vu = l, e.el.style.visibility = l ? "visible" : "hidden"), !l) {
				e.fi && (e.el.style.filter = e.fi = "");
				continue;
			}
			let u = `matrix3d(${ie(re(...c.quad), a, o).map((e) => Math.abs(e) < 1e-12 ? 0 : +e.toPrecision(7)).join(",")})`;
			if (u !== e.tf && (e.tf = u, e.el.style.transform = u), e.contenu) {
				let t = Math.round(c.part * 2e3) / 2e3, n = t >= .9995 ? "" : _.mode === "plafond" ? `scale(1,${t})` : `scale(${t},1)`;
				n !== e.ct && (e.ct = n, e.contenu.style.transform = n);
			}
			let d = r >= .999 ? "" : r.toFixed(3);
			d !== e.op && (e.op = d, e.el.style.opacity = d);
			let f = i && e.rang >= 0 ? ve(t) ? `url(#${n}-a)` : t < 3 ? `url(#${n}-b)` : "" : "";
			f !== e.fi && (e.fi = f, e.el.style.filter = f);
			let p = B === e.el ? "5" : "";
			e.el.style.zIndex !== p && (e.el.style.zIndex = p);
		}
		let s = ye(), c = s >= 0 ? C[s] : -1;
		c !== z && c >= 0 && (z = c, e.dispatchEvent(new CustomEvent("couloir:change", { detail: { index: c } })));
	}, be = () => N || H?.parti ? 0 : K("pointeur") && A != null ? se(A, _.vitesse) : K("auto") && F ? _.vitesse * ce : 0, xe = () => {
		if (!F || document.hidden) return !1;
		if (k != null || H?.parti || Math.abs(O) > .002 || Math.abs(be()) > .002) return !0;
		for (let [e, t] of V) if (Math.abs(t - +(e === B)) > .002) return !0;
		return !1;
	}, Se = (t) => {
		L = 0;
		let n = R ? Math.min(.05, (t - R) / 1e3) : 1 / 60;
		if (R = t, k == null ? H?.parti || (O = j(O, be(), n, N ? Math.min(.25, le(_.inertie)) : le(_.inertie)), Math.abs(O) < .002 && Math.abs(be()) < .002 && (O = 0), D += O * _.sens * n) : (D = j(D, k, n, y ? .001 : .16), O = 0, Math.abs(D - k) < .0015 && (D = k, k = null)), _.sansfin) Math.abs(D) > w * 1e3 && (D = (D % w + w) % w);
		else {
			let e = i(D, 0, Math.max(0, w - 1));
			e !== D && (D = e, O = 0);
		}
		for (let [e, t] of V) {
			let r = +(e === B), i = j(t, r, n, .14);
			Math.abs(i - r) < .002 && r === 0 ? V.delete(e) : V.set(e, Math.abs(i - r) < .002 ? r : i);
		}
		J();
		let r = xe();
		e.classList.toggle("couloir-bouge", r), r ? L = requestAnimationFrame(Se) : (R = 0, O === 0 && J());
	}, Y = () => {
		!L && xe() && (R = 0, e.classList.add("couloir-bouge"), L = requestAnimationFrame(Se));
	}, X = (t, n = !1) => {
		if (!w) return;
		let r = (t % o + o) % o, i = D, a = Infinity;
		for (let e = 0; e < w; e++) {
			if (C[e] !== r) continue;
			let t = _.sansfin ? te(D, e, w) : e - D;
			Math.abs(t) < Math.abs(a) && (a = t, i = D + t);
		}
		O = 0, n || y ? (y && !n && typeof e.animate == "function" && e.animate([
			{ opacity: 1 },
			{
				opacity: .35,
				offset: .4
			},
			{ opacity: 1 }
		], {
			duration: 220,
			easing: "ease-out"
		}), k = null, D = i, J()) : (k = i, Y());
	}, Ce = () => X(z + 1), we = () => X(z - 1), Te = (e) => {
		N = e ?? !N, h.setAttribute("aria-pressed", String(N));
		let t = N ? "Reprendre le défilement" : "Mettre en pause le défilement";
		return h.setAttribute("aria-label", t), h.title = t, h.innerHTML = N ? P.lecture : P.pause, Y(), N;
	}, Ee = () => {
		h.hidden = y || !(_.pilotage.includes("auto") || _.pilotage.includes("pointeur"));
	};
	d.addEventListener("click", we), p.addEventListener("click", Ce), h.addEventListener("click", () => Te());
	let De = (t) => {
		let n = e.getBoundingClientRect();
		return ae(t.clientX - n.left, t.clientY - n.top, v);
	}, Z = (e) => e instanceof Element ? e.closest(".couloir-panneau") : null, Oe = (t) => {
		let [n] = De(t);
		if (t.pointerType === "mouse") {
			let e = A;
			A = i(n / v.L, 0, 1), e != null && K("pointeur") && !H?.parti && (O += (A - e) * _.vitesse * 3);
		}
		let r = Z(t.target), a = _.survol > 0 && r && !r.classList.contains("couloir-vide") && !H?.parti ? r : null;
		if (a !== B && (B = a, a && !V.has(a) && V.set(a, 0)), H && t.pointerId === H.id) {
			let r = t.clientX - H.x, a = t.clientY - H.y, o = _.mode === "plafond" ? Math.abs(a) : Math.abs(r), s = _.mode === "plafond" ? Math.abs(r) : Math.abs(a);
			if (!H.parti && o > 6 && o > s) {
				H.parti = !0, U = !0, e.classList.add("couloir-glisse");
				try {
					e.setPointerCapture(t.pointerId);
				} catch {}
				k = null;
			}
			if (H.parti) {
				let e = n - H.u, t = b(i(S(n, v), -1, 60), v), r = -e / t;
				D += r;
				let a = performance.now(), o = Math.max(1, a - H.t) / 1e3;
				H.vit = .7 * H.vit + r / o * .3, H.t = a, H.u = n, _.sansfin || (D = i(D, 0, Math.max(0, w - 1))), J();
			}
		}
		Y();
	}, ke = (e) => {
		e.pointerType === "mouse" && !H?.parti && (A = null), B = null, Y();
	}, Ae = (e) => {
		if (!K("glisser") || e.button !== 0) return;
		let [t] = De(e);
		H = {
			id: e.pointerId,
			u: t,
			t: performance.now(),
			d: D,
			vit: 0,
			parti: !1,
			x: e.clientX,
			y: e.clientY
		}, U = !1;
	}, Q = (t) => {
		if (H && t.pointerId === H.id) {
			if (H.parti) {
				O = i(H.vit, -8, 8) * _.sens, e.classList.remove("couloir-glisse");
				try {
					e.releasePointerCapture(t.pointerId);
				} catch {}
			}
			H = null, t.pointerType !== "mouse" && (A = null), Y();
		}
	}, je = (e) => {
		if (!K("molette")) return;
		let t = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		if (!t) return;
		e.preventDefault();
		let n = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? v.C : 1;
		O = i(O + t * n * .006 * _.sens, -10, 10), k = null, Y();
	}, Me = typeof scrollY == "number" ? scrollY : 0, Ne = () => {
		let e = scrollY, t = e - Me;
		Me = e, K("defilement") && F && t && (O = i(O + t / Math.max(200, v.C) * 4 * _.sens, -10, 10), k = null, Y());
	}, Pe = (e) => {
		if (U) {
			U = !1, e.preventDefault(), e.stopPropagation();
			return;
		}
		if (_.ouvre !== "visionneuse") return;
		let t = Z(e.target);
		if (!t || t.classList.contains("couloir-vide")) return;
		let n = x.find((e) => e.el === t);
		!n || n.rang < 0 || (e.preventDefault(), e.stopPropagation(), Fe(n.rang));
	}, Fe = async (t) => {
		try {
			await (await import("./lightbox-Clb504MI.js")).openLightbox(e, t, ":scope > .couloir-panneau:not(.couloir-copie):not(.couloir-vide) img");
		} catch {
			_e(a[t].el.querySelector("img"));
		}
	}, Ie = (e) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		let t = Z(e.target);
		if (!t || _.ouvre !== "visionneuse" || e.target.matches("a[href], button")) return;
		let n = a.findIndex((e) => e.el === t);
		n < 0 || (e.preventDefault(), Fe(n));
	}, Le = (t) => {
		let n = Z(t.target), r = a.findIndex((e) => e.el === n);
		r < 0 || ((r !== z || Math.abs(T(x.find((e) => e.el === n).j, D, w, _.sansfin)) > .6) && X(r), e.scrollLeft = 0, e.scrollTop = 0);
	};
	e.addEventListener("pointermove", Oe, { passive: !0 }), e.addEventListener("pointerleave", ke, { passive: !0 }), e.addEventListener("pointerdown", Ae, { passive: !0 }), e.addEventListener("pointerup", Q, { passive: !0 }), e.addEventListener("pointercancel", Q, { passive: !0 }), e.addEventListener("wheel", je, { passive: !1 }), e.addEventListener("click", Pe, !0), e.addEventListener("keydown", Ie), e.addEventListener("focusin", Le), e.addEventListener("dragstart", (e) => e.preventDefault()), addEventListener("scroll", Ne, { passive: !0 });
	let $ = null;
	import("./focus-itinerant-CCx8Ymxi.js").then(({ creerFocusItinerant: t }) => {
		Ue || ($ = t(e, {
			elements: ":scope > .couloir-panneau:not(.couloir-copie) .couloir-cible, :scope > .couloir-panneau.couloir-cible:not(.couloir-copie)",
			orientation: _.mode === "plafond" ? "les-deux" : "horizontal",
			boucle: _.sansfin,
			cle: (e) => String(a.findIndex((t) => t.cible === e)),
			surDeplacement: (e, t) => X(t)
		}));
	});
	let Re = new ResizeObserver(() => {
		(e.clientWidth !== W || e.clientHeight !== G) && q();
	});
	Re.observe(e);
	let ze = new IntersectionObserver((e) => {
		F = e[e.length - 1].isIntersecting, F && Y();
	});
	ze.observe(e);
	let Be = () => {
		document.hidden || Y();
	};
	document.addEventListener("visibilitychange", Be);
	let Ve = typeof matchMedia == "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null, He = () => {
		y = he(), Ee(), J(), Y();
	};
	Ve?.addEventListener("change", He);
	let Ue = !1, We = {
		aller: X,
		suivant: Ce,
		precedent: we,
		pause: Te,
		regler: () => {
			let t = _.mode + _.sansfin;
			_ = f(e.dataset), q(), t !== _.mode + _.sansfin && ($?.detruire(), $ = null, import("./focus-itinerant-CCx8Ymxi.js").then(({ creerFocusItinerant: t }) => {
				Ue || ($ = t(e, {
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
		index: () => z,
		etat: () => ({
			decalage: D,
			vitesse: O,
			actif: L !== 0,
			panneaux: x.length
		}),
		detruire: () => {
			Ue = !0, cancelAnimationFrame(L), Re.disconnect(), ze.disconnect(), $?.detruire(), Ve?.removeEventListener("change", He), document.removeEventListener("visibilitychange", Be), removeEventListener("scroll", Ne), e.removeEventListener("pointermove", Oe), e.removeEventListener("pointerleave", ke), e.removeEventListener("pointerdown", Ae), e.removeEventListener("pointerup", Q), e.removeEventListener("pointercancel", Q), e.removeEventListener("wheel", je), e.removeEventListener("click", Pe, !0), e.removeEventListener("keydown", Ie), e.removeEventListener("focusin", Le);
			for (let e of x) (e.el.classList.contains("couloir-copie") || e.el.classList.contains("couloir-vide")) && e.el.remove();
			s.remove(), u?.remove(), I.delete(e);
		}
	};
	return I.set(e, We), q(), We;
}
function _e(e) {
	if (!e) return;
	let t = document.createElement("dialog");
	t.className = "couloir-dialogue", t.setAttribute("aria-label", e.alt || "Image");
	let n = document.createElement("img");
	n.src = e.currentSrc || e.src, n.alt = e.alt;
	let r = document.createElement("p");
	r.textContent = e.alt;
	let i = document.createElement("button");
	i.type = "button", i.setAttribute("aria-label", "Fermer"), i.textContent = "✕", i.addEventListener("click", () => t.close()), t.append(n, r, i), t.addEventListener("close", () => t.remove()), t.addEventListener("click", (e) => {
		e.target === t && t.close();
	}), document.body.append(t), t.showModal();
}
function R(e = document) {
	let t = /* @__PURE__ */ new Map();
	if (typeof document > "u") return t;
	if (!F) {
		let e = document.createElement("style");
		e.dataset.presse = "couloir", e.textContent = N, document.head.prepend(e), F = !0;
	}
	for (let n of e.querySelectorAll("[data-couloir]")) {
		let e = I.get(n);
		if (e) {
			t.set(n, e);
			continue;
		}
		let r = L(n);
		r && t.set(n, r);
	}
	return t;
}
//#endregion
export { R as initCouloir };
