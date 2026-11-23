import { n as e, t } from "./device-Bprp8tGr.js";
import { a as n, r, t as i } from "./timeline-DUX9XWeC.js";
import { a, o } from "./tokens-Nj0c2PcI.js";
import { n as s, t as c } from "./motion-lint-EfEMk6cY.js";
// src/presse/typo.ts
var l = [
	"etire",
	"sphere",
	"encre",
	"trace",
	"eclats",
	"fragments"
], u = (e) => l.includes(e ?? "") ? e : null, d = [
	"entree",
	"chargement",
	"survol",
	"clic",
	"defilement",
	"manuel"
], f = (e) => d.includes(e ?? "") ? e : "entree", p = {
	etire: 1.2,
	sphere: 2.4,
	encre: 2.6,
	trace: 2.6,
	eclats: 2.4,
	fragments: 2.2
}, m = (e) => e < 0 ? 0 : e > 1 ? 1 : e, h = (e, t, n) => {
	let r = m((n - e) / (t - e));
	return r * r * (3 - 2 * r);
}, g = (e, t, n) => e + (t - e) * n;
function _(e, t = 0) {
	let n = 2166136261 ^ t;
	for (let t = 0; t < e.length; t++) n ^= e.charCodeAt(t), n = Math.imul(n, 16777619);
	return n ^= t * 374761393, n >>> 0;
}
function v(e) {
	let t = e >>> 0;
	return () => {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function y(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) {
		let r = e[n], i = e[(n + 1) % e.length];
		t += r[0] * i[1] - i[0] * r[1];
	}
	return t / 2;
}
function b(e) {
	let t = y(e);
	if (Math.abs(t) < 1e-12) {
		let t = e.length || 1;
		return [e.reduce((e, t) => e + t[0], 0) / t, e.reduce((e, t) => e + t[1], 0) / t];
	}
	let n = 0, r = 0;
	for (let t = 0; t < e.length; t++) {
		let i = e[t], a = e[(t + 1) % e.length], o = i[0] * a[1] - a[0] * i[1];
		n += (i[0] + a[0]) * o, r += (i[1] + a[1]) * o;
	}
	return [n / (6 * t), r / (6 * t)];
}
function x(e, t, n) {
	let r = (e) => (e[0] - t[0]) * n[0] + (e[1] - t[1]) * n[1], i = [];
	for (let t = 0; t < e.length; t++) {
		let n = e[t], a = e[(t + 1) % e.length], o = r(n), s = r(a);
		if (o >= 0 && i.push(n), o >= 0 != s >= 0) {
			let e = o / (o - s);
			i.push([n[0] + (a[0] - n[0]) * e, n[1] + (a[1] - n[1]) * e]);
		}
	}
	return i;
}
function S(e, t, n = .5) {
	let r = v(e), i = [[
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1]
	]];
	for (let e = 0; i.length < t && e < 64; e++) {
		let e = 0;
		for (let t = 1; t < i.length; t++) Math.abs(y(i[t])) > Math.abs(y(i[e])) && (e = t);
		let t = i[e], a = b(t), o = Math.sqrt(Math.abs(y(t))), s = [a[0] + (r() - .5) * .35 * o, a[1] + (r() - .5) * .35 * o], c = r() < n ? (r() - .5) * .5 : r() * Math.PI, l = [-Math.sin(c), Math.cos(c)], u = x(t, s, l), d = x(t, s, [-l[0], -l[1]]), f = Math.abs(y(t));
		u.length < 3 || d.length < 3 || Math.abs(y(u)) < f * .12 || Math.abs(y(d)) < f * .12 || (i = [
			...i.slice(0, e),
			u,
			d,
			...i.slice(e + 1)
		]);
	}
	return i;
}
function C(e, t) {
	let n = Math.sign(y(e)) || 1, r = e.length, i = (t) => {
		let i = e[t], a = e[(t + 1) % r], o = Math.hypot(a[0] - i[0], a[1] - i[1]) || 1;
		return [n * (a[1] - i[1]) / o, -n * (a[0] - i[0]) / o];
	};
	return e.map((e, n) => {
		let a = i((n - 1 + r) % r), o = i(n), s = a[0] + o[0], c = a[1] + o[1], l = (1 + a[0] * o[0] + a[1] * o[1]) / 2, u = Math.hypot(s, c) || 1, d = t * Math.min(4, 1 / Math.sqrt(Math.max(l, 1e-6)));
		return [e[0] + s / u * d, e[1] + c / u * d];
	});
}
function w(e, t, n, r) {
	let i = v(e ^ 2654435769), a = [];
	for (let e = 0; e < t; e++) {
		let e = n + (i() - .5) * 1.9, t = .7 + i() * 1.4;
		a.push({
			dx: Math.cos(e) * t,
			dy: Math.sin(e) * t,
			rot: (i() - .5) * 140,
			arc: (i() - .5) * 1.6,
			retard: Math.min(.55, r * .4 + i() * .15)
		});
	}
	return a;
}
var T = .45;
function E(e, t) {
	let n = m(t);
	if (n >= 1) return {
		x: 0,
		y: 0,
		rot: 0,
		o: 1,
		k: 0
	};
	let r = 1 - a(n * 1.15 > 1 ? 1 : n * 1.15, .7, 9), i = e.arc * r;
	return {
		x: (e.dx * Math.cos(i) - e.dy * Math.sin(i)) * r,
		y: (e.dx * Math.sin(i) + e.dy * Math.cos(i)) * r,
		rot: e.rot * r,
		o: h(0, .06, n),
		k: r
	};
}
function D(e, t, n, r, i = .9, a = .62) {
	let o = 1 - m(r), s = e / n + i * o, c = t / n, l = g(1, a, o), u = n * Math.sin(s) * Math.cos(c) * l, d = n * Math.sin(c) * l, f = n * (Math.cos(s) * Math.cos(c) - 1) * l, p = Math.cos(s) * Math.cos(c);
	return {
		x: (u - e) * o,
		y: (d - t) * o,
		z: f * o,
		ry: s * 180 / Math.PI * o,
		rx: -c * 180 / Math.PI * o,
		s: g(1, l, o),
		o: g(m(p * 3), 1, 1 - o)
	};
}
function O(e, t, n = 1800) {
	return m((1 - Math.exp(-Math.abs(e) / n)) * (.1 + .9 * h(.04, 1.05, Math.abs(t))) * 1.25);
}
function k(e) {
	return e === "entree" || e === "chargement" ? "attente" : e === "defilement" ? "suivi" : "fini";
}
function A(e, t, n, r = !1) {
	let i = {
		etat: t,
		action: "aucune"
	};
	return n === "arrive" ? t === "aller" ? {
		etat: "fini",
		action: "aucune"
	} : i : n === "parti" ? t === "retour" ? {
		etat: "attente",
		action: "aucune"
	} : i : e === "defilement" || e === "manuel" ? i : e === "entree" ? n === "visible" && t === "attente" ? {
		etat: "aller",
		action: "jouer"
	} : n === "invisible-bas" && r && t !== "attente" ? {
		etat: "attente",
		action: "remettre"
	} : i : e === "chargement" ? n === "pret" && t === "attente" ? {
		etat: "aller",
		action: "jouer"
	} : i : e === "survol" ? n === "survol" && t !== "aller" ? {
		etat: "aller",
		action: "rejouer"
	} : i : e === "clic" && n === "clic" && t !== "aller" ? {
		etat: "aller",
		action: "rejouer"
	} : i;
}
function j(e, t, n) {
	let r = n, i = n * .45 - t / 2;
	return m((r - e) / Math.max(1, r - i));
}
var ee = "\n.typo-voile, .typo-voile :not(.typo-calque):not(.typo-calque *) { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; }\n.typo-calque { position: absolute; inset: 0; pointer-events: none; user-select: none; -webkit-user-select: none; z-index: 1; overflow: visible; }\n.typo-calque > span { position: absolute; display: block; white-space: pre; margin: 0; padding: 0; border: 0; text-indent: 0; text-align: left; text-transform: none; transform-origin: 50% 50%; will-change: transform; }\n.typo-canvas { position: absolute !important; pointer-events: none; display: block; z-index: 1; margin: 0; padding: 0; border: 0; max-width: none !important; }\n.typo-etire-l.typo-etire-actif { transform: scale(calc(1 + var(--typo-etire, 0) * 0.85), calc(1 - var(--typo-etire, 0) * 0.08)); transform-origin: 50% 50%; }\n.typo-etire-in { display: inline-flex; justify-content: center; white-space: pre; max-width: none; vertical-align: top; }\n.typo-etire-actif > .typo-etire-in { letter-spacing: calc(var(--typo-ls0, 0px) + var(--typo-etire, 0) * 0.12em); }\n.typo-etire-wdth.typo-etire-actif > .typo-etire-in { font-stretch: calc(var(--typo-fs0, 100%) + var(--typo-etire, 0) * 25%); }\n", te = !1;
function ne() {
	if (te) return;
	te = !0;
	let e = document.createElement("style");
	e.dataset.presseTypo = "", e.textContent = ee, document.head.append(e);
}
function re(e) {
	let t = e.endsWith("%") ? Number.parseFloat(e) : {
		"ultra-condensed": 50,
		"extra-condensed": 62.5,
		condensed: 75,
		"semi-condensed": 87.5,
		"semi-expanded": 112.5,
		expanded: 125,
		"extra-expanded": 150,
		"ultra-expanded": 200
	}[e] ?? 100, n = [
		[50, "ultra-condensed"],
		[62.5, "extra-condensed"],
		[75, "condensed"],
		[87.5, "semi-condensed"],
		[100, "normal"],
		[112.5, "semi-expanded"],
		[125, "expanded"],
		[150, "extra-expanded"],
		[200, "ultra-expanded"]
	], r = n[4];
	for (let e of n) Math.abs(e[0] - t) < Math.abs(r[0] - t) && (r = e);
	return r[1];
}
function ie(e, t) {
	let n = t.get(e);
	if (n) return n;
	let r = getComputedStyle(e), i = Number.parseFloat(r.fontSize) || 16;
	return n = {
		font: `${r.fontStyle} ${r.fontWeight} ${i}px ${r.fontFamily}`,
		chasse: re(r.fontStretch),
		famille: r.fontFamily,
		taille: i,
		couleur: r.color,
		css: {
			fontFamily: r.fontFamily,
			fontSize: r.fontSize,
			fontWeight: r.fontWeight,
			fontStyle: r.fontStyle,
			fontStretch: r.fontStretch,
			fontVariationSettings: r.fontVariationSettings,
			fontFeatureSettings: r.fontFeatureSettings,
			fontKerning: r.fontKerning,
			fontOpticalSizing: r.fontOpticalSizing,
			color: r.color,
			webkitTextFillColor: r.color
		}
	}, t.set(e, n), n;
}
function ae(e) {
	let t = e.classList.contains("typo-voile");
	t && e.classList.remove("typo-voile");
	let n = e.getBoundingClientRect(), r = n.left + e.clientLeft, i = n.top + e.clientTop, a = /* @__PURE__ */ new Map(), o = [], s = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, { acceptNode: (e) => e.parentElement?.closest(".typo-calque, .typo-canvas, script, style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT }), c = document.createRange(), l = -1, u = -1e9;
	for (let t = s.nextNode(); t; t = s.nextNode()) {
		let n = t.textContent ?? "", s = ie(t.parentElement ?? e, a);
		for (let e = 0; e < n.length; e++) {
			let a = n[e].charCodeAt(0), d = a >= 55296 && a <= 56319 && e + 1 < n.length ? 2 : 1, f = n.slice(e, e + d);
			if (/\s/.test(f)) continue;
			c.setStart(t, e), c.setEnd(t, e + d), e += d - 1;
			let p = c.getBoundingClientRect();
			p.width && p.height && (Math.abs(p.top - u) > p.height * .5 && (l++, u = p.top), o.push({
				ch: f,
				x: p.left - r,
				y: p.top - i,
				w: p.width,
				h: p.height,
				ligne: l,
				rang: 0,
				ordre: 0,
				st: s
			}));
		}
	}
	t && e.classList.add("typo-voile");
	let d = l + 1, f = Array.from({ length: d }, () => [Infinity, -Infinity]);
	for (let e of o) {
		let t = f[e.ligne];
		t[0] = Math.min(t[0], e.x), t[1] = Math.max(t[1], e.x + e.w);
	}
	o.forEach((e, t) => {
		e.rang = o.length > 1 ? t / (o.length - 1) : 0;
		let n = f[e.ligne], r = (e.x + e.w / 2 - n[0]) / Math.max(1, n[1] - n[0]);
		e.ordre = (e.ligne + r * .92) / Math.max(1, d);
	});
	let p = o.length ? o.reduce((e, t) => Math.max(e, t.st.taille), 0) : Number.parseFloat(getComputedStyle(e).fontSize) || 16;
	return {
		W: e.clientWidth,
		H: e.clientHeight,
		lettres: o,
		nLignes: d,
		taille: p
	};
}
function M(e, t = 0) {
	let n = document.createElement("span");
	return n.textContent = e.ch, Object.assign(n.style, e.st.css), n.style.left = `${e.x - t}px`, n.style.top = `${e.y - t}px`, n.style.width = `${e.w + 2 * t}px`, n.style.height = `${e.h + 2 * t}px`, n.style.padding = `${t}px 0 0 ${t}px`, n.style.boxSizing = "border-box", n.style.lineHeight = `${e.h}px`, n.style.letterSpacing = "0px", n;
}
function N(e) {
	let t = document.createElement("div");
	return t.className = "typo-calque", t.setAttribute("aria-hidden", "true"), e.append(t), t;
}
var oe = class {
	voile = !1;
	el;
	constructor(e) {
		this.el = e;
	}
	poser(e) {
		this.el.style.opacity = String(Math.round(i.out(e) * 1e3) / 1e3);
	}
	nettoyer() {
		this.el.style.removeProperty("opacity");
	}
}, se = class {
	voile = !0;
	c;
	spans = [];
	m;
	constructor(e, t) {
		this.m = t, this.c = N(e);
		let n = Infinity, r = Infinity, i = -Infinity, a = -Infinity;
		for (let e of t.lettres) n = Math.min(n, e.x), r = Math.min(r, e.y), i = Math.max(i, e.x + e.w), a = Math.max(a, e.y + e.h);
		this.cx = (n + i) / 2, this.cy = (r + a) / 2, this.R = Math.max(i - n, a - r, 1) * .5, this.c.style.perspective = `${this.R * 1.9}px`, this.c.style.perspectiveOrigin = `${this.cx}px ${this.cy}px`;
		for (let e of t.lettres) this.spans.push(this.c.appendChild(M(e)));
	}
	cx = 0;
	cy = 0;
	R = 1;
	poser(e) {
		let t = this.m, { cx: n, cy: r, R: i } = this, a = Math.max(1, t.nLignes), o = a > 1 ? Math.min(.07, .25 / (a - 1)) : 0;
		t.lettres.forEach((t, l) => {
			let u = m((e - t.ligne * o) / (1 - (a - 1) * o)), d = h(.15, 1, u), f = D(t.x + t.w / 2 - n, t.y + t.h / 2 - r, i, d, 1.1, .6), p = this.spans[l];
			p.style.transform = `translate3d(${f.x.toFixed(2)}px, ${f.y.toFixed(2)}px, ${f.z.toFixed(2)}px) rotateY(${f.ry.toFixed(2)}deg) rotateX(${f.rx.toFixed(2)}deg) scale(${f.s.toFixed(4)})`, p.style.opacity = (f.o * h(0, .18, u)).toFixed(3);
			let g = (1 - d) * (1.5 + Math.abs(f.ry) * .05);
			p.style.textShadow = g > .05 ? `${(-g).toFixed(2)}px 0 rgba(255, 70, 20, 0.55), ${g.toFixed(2)}px 0 rgba(30, 80, 255, 0.55)` : "", l === 0 && c() && s(p, "x", f.x, performance.now());
		});
	}
	nettoyer() {
		this.c.remove();
	}
}, ce = class {
	voile = !0;
	c;
	bandes = [];
	taille;
	constructor(e, t) {
		this.c = N(e), this.taille = t.taille;
		let n = t.lettres.length;
		t.lettres.forEach((e, t) => {
			let r = v(_(e.ch, t * 7 + 3)), i = e.st.taille * .2, a = e.w + 2 * i, o = e.h + 2 * i, s = Math.PI / 2 + (r() - .5) * .9, c = Math.cos(s), l = Math.sin(s), u = -l, d = c, f = [
				[0, 0],
				[a, 0],
				[a, o],
				[0, o]
			], p = f.map(([e, t]) => e * u + t * d), m = Math.min(...p), h = Math.max(...p), g = [m - 1];
			for (let e = 1; e < 3; e++) g.push(m + (h - m) * (e + (r() - .5) * .5) / 3);
			g.push(h + 1);
			let y = [
				0,
				1,
				2
			].sort(() => r() - .5);
			for (let a = 0; a < 3; a++) {
				let o = x(f, [u * g[a], d * g[a]], [u, d]);
				if (o = x(o, [u * g[a + 1], d * g[a + 1]], [-u, -d]), o.length < 3) continue;
				o = C(o, .8);
				let s = M(e, i);
				s.style.clipPath = `polygon(${o.map(([e, t]) => `${e.toFixed(2)}px ${t.toFixed(2)}px`).join(", ")})`;
				let p = r() < .65 ? 1 : -1, m = Math.atan2(l * p, c * p) * 180 / Math.PI + 90, h = (n > 1 ? t / (n - 1) : 0) * .42 + y[a] * .1 + r() * .04;
				this.bandes.push({
					s,
					debut: h,
					ang: m,
					ux: c * p,
					uy: l * p
				}), this.c.appendChild(s);
			}
		});
	}
	poser(e) {
		for (let t of this.bandes) {
			let n = m((e - t.debut) / .32), r = i["in-out"](n), a = t.s;
			if (n <= 0) {
				a.style.visibility = "hidden";
				continue;
			}
			a.style.visibility = "";
			let o = r * 106 - 6, s = n >= 1 ? "none" : `linear-gradient(${t.ang.toFixed(1)}deg, #000 ${o.toFixed(1)}%, transparent ${(o + 6).toFixed(1)}%)`;
			a.style.maskImage = s, a.style.setProperty("-webkit-mask-image", s);
			let c = (1 - i.out(n)) * this.taille * .06;
			a.style.transform = c > .01 ? `translate(${(-t.ux * c).toFixed(2)}px, ${(-t.uy * c).toFixed(2)}px)` : "";
		}
	}
	nettoyer() {
		this.c.remove();
	}
}, le = class {
	voile = !0;
	c;
	pieces = [];
	constructor(e, t, n) {
		this.c = N(e);
		let r = v(_(n, 11))() < .5 ? .15 : Math.PI - .15;
		t.lettres.forEach((e, t) => {
			let n = _(e.ch, t), i = S(n, 3 + Math.floor(v(n)() * 3), .55), a = w(n, i.length, r, e.rang), o = e.st.taille * .25, s = e.w + 2 * o, c = e.h + 2 * o;
			i.forEach((t, n) => {
				let r = C(t.map(([e, t]) => [e * s, t * c]), .9).map(([e, t]) => [e <= .5 ? e - 4 : e >= s - .5 ? e + 4 : e, t <= .5 ? t - 4 : t >= c - .5 ? t + 4 : t]), i = M(e, o);
				i.style.clipPath = `polygon(${r.map(([e, t]) => `${e.toFixed(2)}px ${t.toFixed(2)}px`).join(", ")})`;
				let l = b(t);
				i.style.transformOrigin = `${(l[0] * s).toFixed(1)}px ${(l[1] * c).toFixed(1)}px`, this.pieces.push({
					s: i,
					v: a[n],
					taille: e.st.taille
				}), this.c.appendChild(i);
			});
		});
	}
	poser(e) {
		this.pieces.forEach((t, n) => {
			let r = (e - t.v.retard) / T, i = E(t.v, r), a = t.s;
			if (r <= 0) {
				a.style.visibility = "hidden";
				return;
			}
			a.style.visibility = "";
			let o = i.x * t.taille, l = i.y * t.taille;
			a.style.transform = i.k > 1e-4 ? `translate(${o.toFixed(2)}px, ${l.toFixed(2)}px) rotate(${i.rot.toFixed(2)}deg)` : "", a.style.opacity = i.o >= 1 ? "" : i.o.toFixed(3);
			let u = Math.min(4, i.k * 9);
			a.style.textShadow = u > .08 ? `${(-u).toFixed(2)}px 0 rgba(255, 40, 90, 0.85), ${u.toFixed(2)}px 0 rgba(20, 170, 255, 0.85)` : "", n === 0 && c() && (s(a, "x", o, performance.now()), s(a, "y", l, performance.now()));
		});
	}
	nettoyer() {
		this.c.remove();
	}
}, ue = class {
	voile = !0;
	c;
	ls = [];
	constructor(e, t) {
		this.c = N(e), t.lettres.forEach((e, t) => {
			let n = v(_(e.ch, t + 101)), r = this.c.appendChild(M(e, e.st.taille * .15));
			this.ls.push({
				s: r,
				debut: e.ordre * .7 + n() * .12,
				haut: n()
			});
		});
	}
	poser(e) {
		for (let t of this.ls) {
			let n = m((e - t.debut) / .18);
			if (n >= 1) {
				t.s.style.clipPath = "", t.s.style.visibility = "";
				continue;
			}
			t.s.style.visibility = n <= 0 ? "hidden" : "";
			let r = (1 - n) * 100, i = (1 - h(0, .6, n)) * 100;
			t.s.style.clipPath = t.haut < .5 ? `inset(0 ${r.toFixed(1)}% ${i.toFixed(1)}% 0)` : `inset(${i.toFixed(1)}% ${r.toFixed(1)}% 0 0)`;
		}
	}
	nettoyer() {
		this.c.remove();
	}
}, de = class {
	voile = !1;
	el;
	taille;
	constructor(e, t) {
		this.el = e, this.taille = t;
	}
	poser(e) {
		let t = i.out(e);
		this.el.style.filter = `blur(${((1 - t) * this.taille * .09).toFixed(2)}px)`, this.el.style.opacity = h(0, .3, e).toFixed(3);
	}
	nettoyer() {
		this.el.style.removeProperty("filter"), this.el.style.removeProperty("opacity");
	}
}, P = "\nstruct U {\n  a: vec4f,   // largeur, hauteur (px appareil), dpr, mode (0 encre, 1 fragments)\n  b: vec4f,   // progression, graine, taille de police (px appareil), —\n  c: vec4f,   // encre (rgb)\n  d: vec4f,   // frange extérieure (rgb)\n  e: vec4f,   // frange intérieure (rgb)\n};\n@group(0) @binding(0) var<uniform> u: U;\n@group(0) @binding(1) var samp: sampler;\n@group(0) @binding(2) var masque: texture_2d<f32>;\n\nstruct VO { @builtin(position) pos: vec4f, @location(0) px: vec2f };\n@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {\n  let c = vec2f(f32((i << 1u) & 2u), f32(i & 2u));\n  var o: VO;\n  o.pos = vec4f(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);\n  o.px = c * u.a.xy;\n  return o;\n}\nfn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }\nfn hash2(p: vec2f) -> vec2f { return fract(sin(vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)))) * 43758.5453); }\nfn bruit(p: vec2f) -> f32 {\n  let i = floor(p);\n  let f = fract(p);\n  let w = f * f * (3.0 - 2.0 * f);\n  let a = mix(hash(i), hash(i + vec2f(1.0, 0.0)), w.x);\n  let b = mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), w.x);\n  return mix(a, b, w.y) * 2.0 - 1.0;\n}\n// Bruit cellulaire : (distance au germe le plus proche, valeur de sa cellule).\nfn cellule(p: vec2f) -> vec2f {\n  let i = floor(p);\n  let f = fract(p);\n  var dm = 9.0;\n  var id = 0.0;\n  for (var y = -1; y <= 1; y++) {\n    for (var x = -1; x <= 1; x++) {\n      let g = vec2f(f32(x), f32(y));\n      let r = g + hash2(i + g) - f;\n      let d = dot(r, r);\n      if (d < dm) { dm = d; id = hash(i + g + vec2f(3.1, 7.7)); }\n    }\n  }\n  return vec2f(sqrt(dm), id);\n}\n\n@fragment fn fs(i: VO) -> @location(0) vec4f {\n  let W = u.a.xy;\n  let q = clamp(u.b.x, 0.0, 1.0);\n  let g = u.b.y * 31.7;\n  let taille = max(u.b.z, 1.0);\n  if (u.a.w < 0.5) {\n    // ── Encre : une tache molle qui se resserre en lettre. ──\n    let t = 1.0 - q;\n    // Le domaine coule : un bruit lent qui déforme, et une coulure vers le bas (on lit plus haut).\n    let sp = i.px / (taille * 0.42);\n    var w = vec2f(bruit(sp + vec2f(g, 0.0)), bruit(sp + vec2f(0.0, g + 4.2))) * taille * 0.10 * t * t;\n    w.y = w.y - abs(bruit(vec2f(i.px.x / (taille * 0.16), g))) * taille * 0.12 * t * t;\n    let m = textureSampleLevel(masque, samp, (i.px + w) / W, 0.0);\n    // Le champ : très flou (b), puis peu flou (g), puis net (r).\n    let k = smoothstep(0.0, 1.0, q);\n    var f = select(mix(m.g, m.r, (k - 0.55) / 0.45), mix(m.b, m.g, k / 0.55), k < 0.55);\n    f = f + bruit(i.px / (taille * 0.08) + vec2f(g)) * 0.07 * t;\n    // Le seuil : haut (rien), puis bas (la tache gonfle), puis 0,5 (la lettre).\n    let th = select(mix(0.36, 0.5, smoothstep(0.3, 1.0, q)), mix(1.02, 0.36, smoothstep(0.0, 0.3, q)), q < 0.3);\n    let soft = mix(0.1, 0.5, q * q);\n    let dl = 0.09 * t;\n    let a = smoothstep(th - soft, th + soft, f);\n    let aExt = smoothstep(th - dl - soft, th - dl + soft, f);\n    let aInt = smoothstep(th + dl - soft, th + dl + soft, f);\n    let col = u.c.rgb * aInt + mix(u.c.rgb, u.e.rgb, 0.85) * max(a - aInt, 0.0) + u.d.rgb * max(aExt - a, 0.0);\n    let fade = smoothstep(0.0, 0.1, q);\n    return vec4f(col * fade, aExt * fade);\n  }\n  // ── Fragments : le masque révélé par un bruit cellulaire seuillé, dans l'ordre de lecture. ──\n  let m = textureSampleLevel(masque, samp, i.px / W, 0.0);\n  let spread = 0.3;\n  let local = clamp((q * (1.0 + spread) - m.a) / spread, 0.0, 1.0);\n  let c1 = cellule(i.px / (taille * 0.24) + vec2f(g));\n  let c2 = bruit(i.px / (taille * 0.06) + vec2f(g * 1.3));\n  let n = c1.y * 0.8 + c1.x * 0.15 + c2 * 0.06;\n  let e = 0.035;\n  let v = smoothstep(n - e, n + e, local * 1.25 - 0.1);\n  let a = m.r * v;\n  return vec4f(u.c.rgb * a, a);\n}\n", F = null, I = "inconnu", L = null, R = "bgra8unorm", z = () => typeof globalThis < "u" && (!!globalThis.__presseBanc || typeof location < "u" && /[?&]presse-banc\b/.test(location.search)), fe = () => typeof location < "u" && /[?&]typo-repli\b/.test(location.search);
function pe(e) {
	let t = e.createShaderModule({
		code: P,
		label: "presse-typo"
	}), n = e.createBindGroupLayout({ entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
			buffer: { type: "uniform" }
		},
		{
			binding: 1,
			visibility: GPUShaderStage.FRAGMENT,
			sampler: {}
		},
		{
			binding: 2,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {}
		}
	] }), r = e.createSampler({
		magFilter: "linear",
		minFilter: "linear",
		addressModeU: "clamp-to-edge",
		addressModeV: "clamp-to-edge"
	});
	return {
		device: e,
		layout: n,
		mod: t,
		pipes: /* @__PURE__ */ new Map(),
		samp: r
	};
}
function B(e, t) {
	let n = e.pipes.get(t);
	return n || (n = e.device.createRenderPipeline({
		label: `presse-typo-${t}`,
		layout: e.device.createPipelineLayout({ bindGroupLayouts: [e.layout] }),
		vertex: {
			module: e.mod,
			entryPoint: "vs"
		},
		fragment: {
			module: e.mod,
			entryPoint: "fs",
			targets: [{
				format: t,
				blend: {
					color: {
						srcFactor: "one",
						dstFactor: "one-minus-src-alpha"
					},
					alpha: {
						srcFactor: "one",
						dstFactor: "one-minus-src-alpha"
					}
				}
			}]
		},
		primitive: { topology: "triangle-list" }
	}), e.pipes.set(t, n)), n;
}
function V() {
	return L || (fe() || typeof navigator > "u" || !navigator.gpu ? (I = "absent", L = Promise.resolve()) : (I = "attente", L = (async () => {
		try {
			let e = await t();
			F = pe(e), R = navigator.gpu.getPreferredCanvasFormat(), I = "pret", e.lost.then((t) => {
				t.reason === "destroyed" && F?.device === e && H();
			});
		} catch {
			I = "absent", F = null;
		}
	})(), L));
}
function H() {
	F = null, I = "absent";
	for (let e of K.values()) e.gpuPerdu();
}
function U(e = 2e3) {
	return Promise.race([V(), new Promise((t) => setTimeout(t, e))]);
}
function W(e, t, n, r) {
	let i = Float32Array.from(e), a = new Float32Array(t * n), o = (e, i, a) => {
		let o = a ? t : n, s = a ? n : t, c = 1 / (2 * r + 1);
		for (let n = 0; n < s; n++) {
			let s = (e) => a ? n * t + e : e * t + n, l = 0;
			for (let t = -r; t <= r; t++) l += e[s(Math.min(o - 1, Math.max(0, t)))];
			for (let t = 0; t < o; t++) i[s(t)] = l * c, l += e[s(Math.min(o - 1, t + r + 1))] - e[s(Math.max(0, t - r))];
		}
	};
	for (let e = 0; e < 3; e++) o(i, a, !0), o(a, i, !1);
	return i;
}
var me = (() => {
	let e = null;
	return (t) => {
		if (e ??= document.createElement("canvas").getContext("2d", { willReadFrequently: !0 }), !e) return [
			0,
			0,
			0
		];
		e.clearRect(0, 0, 1, 1), e.fillStyle = "#000", e.fillStyle = t, e.fillRect(0, 0, 1, 1);
		let n = e.getImageData(0, 0, 1, 1).data;
		return [
			n[0] / 255,
			n[1] / 255,
			n[2] / 255
		];
	};
})(), G = class {
	voile = !0;
	gpu = !0;
	canvas;
	ctx;
	ubuf;
	tex;
	bind;
	data = /* @__PURE__ */ new Float32Array(20);
	enVol = Promise.resolve();
	W;
	H;
	constructor(e, t, n, r) {
		let i = F, a = Math.min(devicePixelRatio || 1, 2), o = Math.ceil(t.taille * (n === 0 ? .35 : .15)), s = document.createElement("canvas");
		s.className = "typo-canvas", s.setAttribute("aria-hidden", "true"), Object.assign(s.style, {
			left: `${-o}px`,
			top: `${-o}px`,
			width: `${t.W + 2 * o}px`,
			height: `${t.H + 2 * o}px`
		});
		let c = this.W = Math.max(1, Math.round((t.W + 2 * o) * a)), l = this.H = Math.max(1, Math.round((t.H + 2 * o) * a));
		s.width = c, s.height = l, e.append(s), this.canvas = s, this.ctx = z() ? null : s.getContext("webgpu"), this.ctx?.configure({
			device: i.device,
			format: R,
			alphaMode: "premultiplied"
		});
		let u = document.createElement("canvas");
		u.width = c, u.height = l;
		let d = u.getContext("2d", { willReadFrequently: !0 });
		d.fillStyle = "#fff", d.textBaseline = "alphabetic";
		let f = new Float32Array(c * l), p = "", m = 0, h = 0;
		for (let e of t.lettres) {
			let t = e.st.font.replace(/(\d+(?:\.\d+)?)px/, (e, t) => `${Number(t) * a}px`);
			if (t + e.st.chasse !== p) {
				d.font = t, d.fontStretch = e.st.chasse, p = t + e.st.chasse, "letterSpacing" in d && (d.letterSpacing = "0px");
				let n = d.measureText("Hg");
				m = n.fontBoundingBoxAscent / a, h = n.fontBoundingBoxDescent / a;
			}
			let n = e.y + (e.h - (m + h)) / 2 + m;
			d.fillText(e.ch, (e.x + o) * a, (n + o) * a);
			let r = e.st.taille * .12, i = Math.max(0, Math.floor((e.x + o - r) * a)), s = Math.min(c, Math.ceil((e.x + e.w + o + r) * a)), u = Math.max(0, Math.floor((e.y + o - r) * a)), g = Math.min(l, Math.ceil((e.y + e.h + o + r) * a));
			for (let t = u; t < g; t++) for (let n = i; n < s; n++) f[t * c + n] = e.ordre;
		}
		let g = d.getImageData(0, 0, c, l).data, _ = new Float32Array(c * l);
		for (let e = 0; e < c * l; e++) _[e] = g[e * 4 + 3] / 255;
		let v = new Uint8Array(c * l * 4), y = null, b = null;
		if (n === 0) {
			y = W(_, c, l, Math.max(1, Math.round(t.taille * .035 * a))), b = W(_, c, l, Math.max(1, Math.round(t.taille * .11 * a)));
			let e = .001, n = .001;
			for (let t = 0; t < c * l; t++) e = Math.max(e, y[t]), n = Math.max(n, b[t]);
			for (let t = 0; t < c * l; t++) y[t] = Math.min(1, y[t] / e * 1.05), b[t] = Math.min(1, b[t] / n * 1.05);
		}
		for (let e = 0; e < c * l; e++) v[e * 4] = Math.round(_[e] * 255), v[e * 4 + 1] = y ? Math.round(y[e] * 255) : 0, v[e * 4 + 2] = b ? Math.round(b[e] * 255) : 0, v[e * 4 + 3] = Math.round(f[e] * 255);
		this.tex = i.device.createTexture({
			size: [c, l],
			format: "rgba8unorm",
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
		}), i.device.queue.writeTexture({ texture: this.tex }, v, { bytesPerRow: c * 4 }, [c, l]), this.ubuf = i.device.createBuffer({
			size: this.data.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		}), this.bind = i.device.createBindGroup({
			layout: i.layout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.ubuf }
				},
				{
					binding: 1,
					resource: i.samp
				},
				{
					binding: 2,
					resource: this.tex.createView()
				}
			]
		});
		let x = this.data;
		x[0] = c, x[1] = l, x[2] = a, x[3] = n, x[5] = r % 1e3 / 1e3, x[6] = t.taille * a, x.set(me(t.lettres[0]?.st.couleur ?? "#000"), 8), x.set([
			.42,
			.36,
			.92
		], 12), x.set([
			.98,
			.62,
			.18
		], 16);
	}
	poser(e) {
		let t = F;
		if (t) {
			if (this.data[4] = e, t.device.queue.writeBuffer(this.ubuf, 0, this.data), this.ctx) {
				let e = t.device.createCommandEncoder(), n = e.beginRenderPass({ colorAttachments: [{
					view: this.ctx.getCurrentTexture().createView(),
					loadOp: "clear",
					storeOp: "store",
					clearValue: [
						0,
						0,
						0,
						0
					]
				}] });
				n.setPipeline(B(t, R)), n.setBindGroup(0, this.bind), n.draw(3), n.end(), t.device.queue.submit([e.finish()]);
			} else return this.aPeindre = !0, this.peint || (this.peint = !0, this.enVol = (async () => {
				for (; this.aPeindre && !this.detruit;) this.aPeindre = !1, await this.peindreBanc(t);
				this.peint = !1;
			})()), this.enVol;
		}
	}
	aPeindre = !1;
	peint = !1;
	detruit = !1;
	async peindreBanc(e) {
		let { W: t, H: n } = this;
		e.device.queue.writeBuffer(this.ubuf, 0, this.data);
		let r = e.device.createTexture({
			size: [t, n],
			format: "rgba8unorm",
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
		}), i = Math.ceil(t * 4 / 256) * 256, a = e.device.createBuffer({
			size: i * n,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
		}), o = e.device.createCommandEncoder(), s = o.beginRenderPass({ colorAttachments: [{
			view: r.createView(),
			loadOp: "clear",
			storeOp: "store",
			clearValue: [
				0,
				0,
				0,
				0
			]
		}] });
		s.setPipeline(B(e, "rgba8unorm")), s.setBindGroup(0, this.bind), s.draw(3), s.end(), o.copyTextureToBuffer({ texture: r }, {
			buffer: a,
			bytesPerRow: i
		}, [t, n]), e.device.queue.submit([o.finish()]);
		try {
			await a.mapAsync(GPUMapMode.READ);
		} catch {
			r.destroy();
			return;
		}
		let c = new Uint8Array(a.getMappedRange()), l = new ImageData(t, n);
		for (let e = 0; e < n; e++) for (let n = 0; n < t; n++) {
			let r = e * i + n * 4, a = (e * t + n) * 4, o = c[r + 3];
			l.data[a] = o ? Math.min(255, c[r] * 255 / o) : 0, l.data[a + 1] = o ? Math.min(255, c[r + 1] * 255 / o) : 0, l.data[a + 2] = o ? Math.min(255, c[r + 2] * 255 / o) : 0, l.data[a + 3] = o;
		}
		a.unmap(), a.destroy(), r.destroy(), this.canvas.isConnected && !this.detruit && this.canvas.getContext("2d")?.putImageData(l, 0, 0);
	}
	nettoyer() {
		this.detruit = !0;
		try {
			this.ctx?.unconfigure();
		} catch {}
		this.tex.destroy(), this.ubuf.destroy(), this.canvas.remove();
	}
}, K = /* @__PURE__ */ new Map(), q = null, J = null, Y = /* @__PURE__ */ new Set(), X = null, he = !1, ge = !1, _e = class {
	effet;
	quand;
	etat;
	p;
	sens = 0;
	attente = 0;
	rendu = null;
	sale = !0;
	boucle = null;
	posPerso = !1;
	bancPromesse = Promise.resolve();
	pDefil = 0;
	haut = 0;
	hauteur = 0;
	el;
	constructor(e) {
		this.el = e, this.effet = u(e.dataset.typo), this.quand = f(e.dataset.typoQuand), this.etat = k(this.quand), this.p = +(this.etat === "fini"), ne(), getComputedStyle(e).position === "static" && (e.style.position = "relative", this.posPerso = !0), e.dataset.typoPret = "", this.etat !== "fini" && this.poser(this.p), this.quand === "entree" && q?.observe(e), J?.observe(e), this.quand === "survol" ? (e.addEventListener("pointerenter", this.surSurvol), e.addEventListener("focusin", this.surSurvol)) : this.quand === "clic" ? e.addEventListener("click", this.surClic) : this.quand === "chargement" ? xe().then(() => this.evenement("pret")) : this.quand === "defilement" && (Y.add(this), this.mesurerDefil(), Q()), (this.effet === "encre" || this.effet === "fragments") && V();
	}
	surSurvol = (e) => {
		e.pointerType !== "touch" && this.evenement("survol");
	};
	surClic = () => this.evenement("clic");
	get duree() {
		let e = Number.parseFloat(this.el.dataset.typoDuree ?? ""), t = Number.isFinite(e) && e > 0 ? e : p[this.effet];
		return n() ? Math.min(t, .35) : t;
	}
	get delai() {
		let e = Number.parseFloat(this.el.dataset.typoDelai ?? "");
		return Number.isFinite(e) && e > 0 ? e : 0;
	}
	evenement(e) {
		let t = A(this.quand, this.etat, e, this.el.dataset.typoRejoue !== void 0);
		this.etat = t.etat, t.action === "jouer" || t.action === "rejouer" ? this.lancer(t.action === "rejouer" ? 0 : this.p, 1) : t.action === "remettre" && (this.arreter(), this.poser(0));
	}
	jouer() {
		this.etat = "aller", this.lancer(0, 1);
	}
	retour() {
		this.etat = "retour", this.lancer(this.p, -1);
	}
	async lancer(e, t) {
		this.arreter(), (this.effet === "encre" || this.effet === "fragments") && await U(), this.p = e, this.sens = t, this.attente = t > 0 ? this.delai : 0, this.poser(this.p), this.el.dispatchEvent(new CustomEvent("typo:debut", { detail: { sens: t } })), this.boucle = r((e) => this.pas(e));
	}
	pas(e) {
		return this.attente > 0 ? (this.attente -= e, !0) : (this.p = m(this.p + this.sens * e / this.duree), this.poser(this.p), this.sens > 0 && this.p >= 1 || this.sens < 0 && this.p <= 0 ? (this.evenement(this.sens > 0 ? "arrive" : "parti"), this.el.dispatchEvent(new CustomEvent("typo:fin", { detail: { sens: this.sens } })), this.sens = 0, this.boucle = null, !1) : !0);
	}
	arreter() {
		this.boucle?.stop(), this.boucle = null, this.sens = 0;
	}
	async aller(e) {
		this.arreter(), (this.effet === "encre" || this.effet === "fragments") && await U(), this.p = m(e), this.etat = this.p >= 1 ? "fini" : this.p <= 0 ? "attente" : "aller", this.poser(this.p), await this.bancPromesse;
	}
	construire() {
		let e = this.el;
		if (n()) return new oe(e);
		let t = ae(e), r = e.textContent ?? "";
		switch (this.effet) {
			case "sphere": return new se(e, t);
			case "trace": return new ce(e, t);
			case "eclats": return new le(e, t, r);
			case "encre": return I === "pret" && F ? new G(e, t, 0, _(r)) : new de(e, t.taille);
			case "fragments": return I === "pret" && F ? new G(e, t, 1, _(r)) : new ue(e, t);
		}
	}
	poser(e) {
		let t = this.el;
		if (e >= 1) {
			this.nettoyer();
			return;
		}
		if (e <= 0 && !this.rendu) {
			n() ? t.style.opacity = "0" : t.classList.add("typo-voile");
			return;
		}
		(this.sale || !this.rendu) && (this.rendu?.nettoyer(), t.style.removeProperty("opacity"), this.rendu = this.construire(), this.sale = !1), t.classList.toggle("typo-voile", this.rendu.voile), t.classList.add("typo-encours");
		let r = this.rendu.poser(e);
		r && (this.bancPromesse = r);
	}
	nettoyer() {
		this.rendu?.nettoyer(), this.rendu = null, this.sale = !0, this.el.classList.remove("typo-voile", "typo-encours"), this.el.style.removeProperty("opacity");
	}
	invalider() {
		this.sale = !0, this.quand === "defilement" && this.mesurerDefil(), this.rendu && !this.boucle && this.poser(this.p);
	}
	gpuPerdu() {
		this.rendu?.gpu && (this.rendu.nettoyer(), this.rendu = null, this.sale = !0, !this.boucle && this.p > 0 && this.p < 1 && this.poser(this.p));
	}
	mesurerDefil() {
		let e = this.el.getBoundingClientRect();
		this.haut = e.top + scrollY, this.hauteur = e.height;
	}
	pasDefil(e) {
		let t = j(this.haut - scrollY, this.hauteur, innerHeight), r = n() ? 1 : 1 - Math.exp(-e / .08);
		return this.pDefil += (t - this.pDefil) * r, Math.abs(t - this.pDefil) < .001 && (this.pDefil = t), this.pDefil !== this.p && (this.p = this.pDefil, this.poser(this.p)), this.pDefil !== t;
	}
	detruire() {
		this.arreter(), this.nettoyer(), q?.unobserve(this.el), J?.unobserve(this.el), Y.delete(this), this.el.removeEventListener("pointerenter", this.surSurvol), this.el.removeEventListener("focusin", this.surSurvol), this.el.removeEventListener("click", this.surClic), this.posPerso && this.el.style.removeProperty("position"), delete this.el.dataset.typoPret, K.delete(this.el);
	}
}, ve = {
	k: 70,
	zeta: 1
}, ye = class {
	lignes = [];
	v = 0;
	vv = 0;
	dernierY = 0;
	boucle = null;
	impulsion = -1;
	calme = 0;
	force = null;
	onScroll = () => this.reveiller();
	el;
	constructor(e) {
		this.el = e, ne(), e.dataset.typoPret = "";
		let t = [...e.querySelectorAll("[data-typo-ligne]")];
		t.length || (t = e.children.length ? [...e.children] : [e]);
		let n = be(t[0]);
		for (let e of t) e.classList.add("typo-etire-l"), n && e.classList.add("typo-etire-wdth"), this.lignes.push({
			el: e,
			inner: null,
			y: 0,
			e: 0,
			une: !1,
			largeur: 0,
			aligne: "center"
		});
		this.envelopper(), this.mesurer(), this.dernierY = scrollY, addEventListener("scroll", this.onScroll, { passive: !0 }), J?.observe(e);
	}
	envelopper() {
		let e = this.lignes.map((e) => {
			let t = getComputedStyle(e.el), n = Number.parseFloat(t.lineHeight) || (Number.parseFloat(t.fontSize) || 16) * 1.2, r = document.createRange();
			r.selectNodeContents(e.el);
			let i = new Set([...r.getClientRects()].map((e) => Math.round(e.top))).size, a = t.textAlign;
			return {
				ls: t.letterSpacing === "normal" ? "0px" : t.letterSpacing,
				fs: t.fontStretch || "100%",
				une: i <= 1 && e.el.clientHeight < n * 1.6,
				largeur: e.el.clientWidth - (Number.parseFloat(t.paddingLeft) || 0) - (Number.parseFloat(t.paddingRight) || 0),
				aligne: a === "center" ? "center" : a === "right" || a === "end" ? "flex-end" : "flex-start"
			};
		});
		this.lignes.forEach((t, n) => {
			let r = e[n];
			t.el.style.setProperty("--typo-ls0", r.ls), t.el.style.setProperty("--typo-fs0", r.fs), Object.assign(t, {
				une: r.une,
				largeur: r.largeur,
				aligne: r.aligne
			}), t.inner && (t.inner.style.width = `${r.largeur}px`);
		});
	}
	ouvrir(e) {
		if (e.inner || !e.une) return;
		let t = document.createElement("span");
		for (t.className = "typo-etire-in", t.style.justifyContent = e.aligne, t.style.width = `${e.largeur}px`; e.el.firstChild;) t.appendChild(e.el.firstChild);
		e.el.appendChild(t), e.inner = t;
	}
	fermer(e) {
		let t = e.inner;
		if (t) {
			for (; t.firstChild;) e.el.insertBefore(t.firstChild, t);
			t.remove(), e.inner = null;
		}
	}
	mesurer() {
		let e = scrollY;
		for (let t of this.lignes) {
			let n = t.el.getBoundingClientRect();
			t.y = n.top + e + n.height / 2;
		}
	}
	invalider() {
		for (let e of this.lignes) this.fermer(e);
		this.envelopper(), this.mesurer();
		for (let e of this.lignes) e.e > 0 && this.ouvrir(e);
	}
	reveiller() {
		n() || this.force !== null || (this.calme = 0, this.boucle ? this.boucle.wake() : (this.dernierY = scrollY, this.boucle = r((e) => this.pas(e))));
	}
	pas(e) {
		if (e <= 0) return !0;
		let t = scrollY, n = t - this.dernierY;
		this.dernierY = t;
		let r = Math.abs(n) > innerHeight * .9 ? 0 : n / e;
		this.impulsion >= 0 && (this.impulsion += e, r = this.impulsion < .9 ? 2600 * Math.sin(Math.PI * this.impulsion / .9) : 0, this.impulsion >= .9 && (this.impulsion = -1)), [this.v, this.vv] = o(this.v, this.vv, r, Math.min(e, 1 / 30), ve), this.calme = r === 0 && this.impulsion < 0 ? this.calme + 1 : 0;
		let i = Math.abs(this.v) < 4 && Math.abs(this.vv) < 40 && this.calme > 8;
		return i && (this.v = 0, this.vv = 0), this.appliquer(this.v, t), !i || (this.boucle = null, !1);
	}
	appliquer(e, t) {
		let n = innerHeight / 2, r = performance.now();
		this.lignes.forEach((i, a) => {
			let o = O(e, (i.y - t - n) / n);
			o < .002 && (o = 0), Math.abs(o - i.e) < .002 && (o !== 0 || i.e === 0) || (i.e = o, o === 0 ? (i.el.classList.remove("typo-etire-actif"), i.el.style.removeProperty("--typo-etire"), this.fermer(i)) : (this.ouvrir(i), i.el.classList.add("typo-etire-actif"), i.el.style.setProperty("--typo-etire", o.toFixed(4))), a === 0 && c() && s(i.el, "width", o * 100, r));
		});
	}
	jouer() {
		n() || (this.force = null, this.impulsion = 0, this.reveiller());
	}
	async aller(e) {
		this.boucle?.stop(), this.boucle = null;
		let t = n() ? 0 : m(e);
		this.force = t > 0 && t < 1 ? t : null, this.v = 0, this.vv = 0, this.appliquer(t > 0 && t < 1 ? 2600 * Math.sin(Math.PI * t) : 0, scrollY);
	}
	retour() {
		this.aller(1);
	}
	detruire() {
		this.boucle?.stop(), removeEventListener("scroll", this.onScroll), J?.unobserve(this.el);
		for (let e of this.lignes) {
			e.el.classList.remove("typo-etire-l", "typo-etire-wdth", "typo-etire-actif");
			for (let t of [
				"--typo-etire",
				"--typo-ls0",
				"--typo-fs0"
			]) e.el.style.removeProperty(t);
			this.fermer(e);
		}
		delete this.el.dataset.typoPret, Z.delete(this.el);
	}
}, Z = /* @__PURE__ */ new Map();
function be(e) {
	if (!e) return !1;
	let t = document.createElement("span");
	t.textContent = "MOHAWK mohawk 0123", t.setAttribute("aria-hidden", "true"), Object.assign(t.style, {
		position: "absolute",
		visibility: "hidden",
		whiteSpace: "pre",
		fontStretch: "100%"
	}), e.appendChild(t);
	let n = t.getBoundingClientRect().width;
	t.style.fontStretch = "125%";
	let r = t.getBoundingClientRect().width;
	return t.remove(), Math.abs(r - n) > .5;
}
function xe() {
	return new Promise((e) => {
		let t = () => void (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(() => e()));
		document.readyState === "complete" ? t() : addEventListener("load", t, { once: !0 });
	});
}
function Q() {
	X ? X.wake() : X = r((e) => {
		let t = !1;
		for (let n of Y) n.pasDefil(e) && (t = !0);
		return t || (X = null), t;
	});
}
function $(e) {
	if (K.has(e) || Z.has(e)) return;
	let t = u(e.dataset.typo);
	t && (t === "etire" ? Z.set(e, new ye(e)) : K.set(e, new _e(e)));
}
function Se(e) {
	$(e);
	let t = K.get(e) ?? Z.get(e);
	if (!t) throw Error(`[presse:typo] data-typo inconnu : « ${e.dataset.typo ?? ""} » (${l.join(", ")})`);
	return t;
}
function Ce(t = document) {
	if (typeof document > "u") return;
	let n = (e) => {
		e instanceof HTMLElement && e.matches("[data-typo]") && $(e), e.querySelectorAll("[data-typo]").forEach($);
	};
	if (!he) {
		he = !0, q = new IntersectionObserver((e) => {
			for (let t of e) {
				let e = K.get(t.target);
				e && (t.isIntersecting ? e.evenement("visible") : e.evenement(t.boundingClientRect.top > 0 ? "invisible-bas" : "invisible-haut"));
			}
		}, { rootMargin: "0px 0px -15% 0px" });
		let t = 0;
		J = new ResizeObserver(() => {
			cancelAnimationFrame(t), t = requestAnimationFrame(() => {
				for (let e of Z.values()) e.invalider();
				for (let e of K.values()) e.invalider();
			});
		});
		let r = () => {
			for (let e of Z.values()) e.invalider();
			for (let e of K.values()) e.invalider();
		};
		addEventListener("resize", () => {
			for (let e of Y) e.mesurerDefil();
			Q();
		}), addEventListener("scroll", () => Y.size && Q(), { passive: !0 }), document.fonts?.ready.then(() => {
			ge = !0, r();
		}), document.fonts?.addEventListener?.("loadingdone", () => ge && r()), e(() => {
			H(), L = null, setTimeout(() => {
				V().then(() => {
					for (let e of K.values()) e.gpuPerdu();
				});
			}, 300);
		}), new MutationObserver((e) => {
			for (let t of e) if (t.type === "childList") for (let e of t.addedNodes) e instanceof HTMLElement && !e.classList.contains("typo-calque") && !e.classList.contains("typo-canvas") && !e.classList.contains("typo-etire-in") && n(e);
			else t.type === "attributes" && t.target instanceof HTMLElement && t.target.dataset.typo !== void 0 && $(t.target);
		}).observe(document.body, {
			childList: !0,
			subtree: !0,
			attributes: !0,
			attributeFilter: ["data-typo"]
		});
	}
	n(t);
}
async function we() {
	return await U(4e3), I;
}
async function Te() {
	return (await (await t()).createShaderModule({ code: P }).getCompilationInfo()).messages.map((e) => `${e.type} ${e.lineNum}:${e.linePos} ${e.message}`);
}
export { p as DUREES, l as EFFETS, d as QUANDS, T as VOL_ECLAT, P as WGSL, y as aire, v as aleaDe, b as centroide, re as chasseCanvas, m as clamp01, Te as compilerTypo, x as couper, O as courbeEtire, S as decouperEclats, C as dilater, u as effetDe, we as etatGpuTypo, k as etatInitial, W as flouBoite3, _ as graineDe, Ce as initTypo, h as lisse, z as modeBanc, E as poseEclat, j as progressionDefilement, D as projeterSphere, f as quandDe, A as transition, Se as typo, w as volsEclats };
