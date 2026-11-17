import { i as e } from "./timeline-DCSKPj1x.js";
//#region src/presse/cinetique.ts
var t = [
	"monte",
	"doux",
	"net",
	"approche",
	"graisse",
	"balai",
	"volet",
	"porte",
	"glisse",
	"penche",
	"fonce",
	"parasite",
	"tombe",
	"eclot",
	"houle",
	"etire",
	"vrille",
	"essaim"
], n = [
	"ligne",
	"mot",
	"lettre"
], r = [
	"entree",
	"chargement",
	"survol",
	"manuel"
], i = [
	"debut",
	"fin",
	"centre",
	"bords",
	"hasard"
], a = [
	"surligneur",
	"souligne",
	"barre",
	"cadre",
	"cercle"
], o = (e, t, n) => e.includes((t ?? "").trim()) ? (t ?? "").trim() : n, s = (e) => t.includes((e ?? "").trim()) ? (e ?? "").trim() : null, c = (e) => o(n, e, "mot"), l = (e) => o(r, e, "entree"), u = (e) => o(i, e, "debut"), d = (e) => o(a, e, "souligne");
function f(e, t, n = 0, r = 600) {
	if (e == null) return t;
	let i = e.trim().replace(",", ".");
	if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(i)) return t;
	let a = Number.parseFloat(i);
	return Number.isFinite(a) && a >= n && a <= r ? a : t;
}
var p = (e) => e != null && !/^(false|0|non)$/i.test(e.trim()), m = (e) => e < 0 ? 0 : e > 1 ? 1 : e, h = (e, t, n) => e < t ? t : e > n ? n : e, g = (e, t = 3) => {
	let n = 10 ** t, r = Math.round(e * n) / n;
	return Object.is(r, -0) ? 0 : r;
}, _ = {
	ligne: {
		duree: .9,
		cascade: .12
	},
	mot: {
		duree: .75,
		cascade: .06
	},
	lettre: {
		duree: .7,
		cascade: .03
	}
}, v = {
	ligne: {
		duree: .5,
		cascade: .06
	},
	mot: {
		duree: .42,
		cascade: .03
	},
	lettre: {
		duree: .38,
		cascade: .02
	}
};
function ee(e) {
	let t = s(e.cinetique), n = c(e.cinetiquePar), r = t ? ve[t].facteur ?? 1 : 1, i = _[n], a = v[n], o = e.cinetiqueSortie === void 0 ? null : f(e.cinetiqueSortie, NaN, 0, 600);
	return {
		preset: t,
		par: n,
		quand: l(e.cinetiqueQuand),
		rejoue: p(e.cinetiqueRejoue),
		duree: f(e.cinetiqueDuree, g(i.duree * r, 3), .05, 30),
		delai: f(e.cinetiqueDelai, 0, 0, 120),
		cascade: f(e.cinetiqueCascade, i.cascade, 0, 10),
		ordre: u(e.cinetiqueOrdre),
		sortie: o !== null && Number.isFinite(o) ? o : null,
		dureeSortie: a.duree,
		cascadeSortie: a.cascade
	};
}
function y(e, t = 0) {
	let n = 2166136261 ^ t;
	for (let t = 0; t < e.length; t++) n ^= e.charCodeAt(t), n = Math.imul(n, 16777619);
	return n ^= Math.imul(t, 374761393), n >>> 0;
}
function b(e) {
	let t = e >>> 0;
	return () => {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function te(e, t, n = 0) {
	let r = (e - 1) / 2;
	switch (t) {
		case "debut": return Array.from({ length: e }, (e, t) => t);
		case "fin": return Array.from({ length: e }, (t, n) => e - 1 - n);
		case "centre":
		case "bords": {
			let n = Array.from({ length: e }, (e, t) => Math.abs(t - r)), i = Math.max(0, ...n), a = Math.min(...n, i);
			return n.map((e) => Math.round(t === "centre" ? e - a : i - e));
		}
		case "hasard": {
			let t = b(n), r = Array.from({ length: e }, (e, t) => t);
			for (let n = e - 1; n > 0; n--) {
				let e = Math.floor(t() * (n + 1));
				[r[n], r[e]] = [r[e], r[n]];
			}
			let i = Array(e);
			return r.forEach((e, t) => i[e] = t), i;
		}
	}
}
function x(e, t, n, r = "debut", i = 0) {
	let a = te(Math.max(0, e), r, i).map((e) => g(e * t, 6));
	return {
		debuts: a,
		total: g((a.length ? Math.max(...a) : 0) + n, 6)
	};
}
var ne = /[ \t\n\r\f]+/, re = /([ \t\n\r\f]+)/, ie = /* @__PURE__ */ new Set([
	"-",
	"‐",
	"–",
	"—"
]), ae = /* @__PURE__ */ new Set(["­", "​"]), S;
function oe(e) {
	if (S === void 0) {
		let e = globalThis.Intl;
		S = e?.Segmenter ? new e.Segmenter("fr", { granularity: "grapheme" }) : null;
	}
	return S ? Array.from(S.segment(e), (e) => e.segment) : Array.from(e);
}
function se(e) {
	let t = [], n = 0;
	for (let r of e.split(re)) {
		if (!r) continue;
		if (ne.test(r) && r.trim() === "" && !/[^ \t\n\r\f]/.test(r)) {
			t.push({
				type: "espace",
				t: r,
				debut: n,
				fin: n + r.length
			}), n += r.length;
			continue;
		}
		let e = "", i = n, a = !1, o = (n) => {
			e && t.push({
				type: "mot",
				t: e,
				debut: i,
				fin: n,
				apresTiret: a,
				lettres: oe(e)
			}), e = "", i = n;
		}, s = 0;
		for (let c of Array.from(r)) {
			let r = n + s;
			ae.has(c) ? (o(r), t.push({
				type: "coupure",
				t: c,
				debut: r,
				fin: r + c.length
			}), i = r + c.length, a = !1) : (e += c, ie.has(c) && (o(r + c.length), a = !0)), s += c.length;
		}
		o(n + r.length), n += r.length;
	}
	return t;
}
function ce(e) {
	let t = [], n = -1, r = -Infinity, i = -Infinity, a = Infinity;
	for (let o of e) {
		let e = Math.max(1, o.height);
		n < 0 || o.top >= r - .3 * e || o.left < a - .5 && o.top > i + .3 * e ? (n++, i = o.top, r = o.top + e) : (i = Math.min(i, o.top), r = Math.max(r, o.top + e)), a = o.left, t.push(n);
	}
	return t;
}
function C(e, t, n, r) {
	let i = 3 * e, a = 3 * (n - e) - i, o = 1 - i - a, s = 3 * t, c = 3 * (r - t) - s, l = 1 - s - c, u = (e) => ((o * e + a) * e + i) * e, d = (e) => (3 * o * e + 2 * a) * e + i;
	return (e) => {
		if (e <= 0) return 0;
		if (e >= 1) return 1;
		let t = e;
		for (let n = 0; n < 8; n++) {
			let n = u(t) - e, r = d(t);
			if (Math.abs(n) < 1e-7 || Math.abs(r) < 1e-6) break;
			t -= n / r;
		}
		if (t < 0 || t > 1 || Math.abs(u(t) - e) > 1e-5) {
			let n = 0, r = 1;
			t = e;
			for (let i = 0; i < 40; i++) u(t) < e ? n = t : r = t, t = (n + r) / 2;
		}
		return ((l * t + c) * t + s) * t;
	};
}
function le(e, t = .45) {
	if (e <= 0) return 0;
	if (e >= 1) return 1;
	let n = h(t, .05, .95), r = Math.log(400) / n, i = r * Math.sqrt(1 - n * n);
	return 1 - Math.exp(-n * r * e) * (Math.cos(i * e) + n * r / i * Math.sin(i * e));
}
function ue(e = .45, t = 40) {
	let n = [];
	for (let r = 0; r <= t; r++) n.push(String(r === t ? 1 : g(le(r / t, e), 4)));
	return `linear(${n.join(", ")})`;
}
var w = {
	haut: .42,
	bas: .32,
	cote: .3
}, T = w.haut, E = w.bas, D = w.cote, de = g(T + E, 3), O = `inset(-${T}em -${D}em -${E}em -${D}em)`, k = {
	haut: .24,
	bas: .3
}, A = "cubic-bezier(0.16, 1, 0.3, 1)", fe = "cubic-bezier(0.2, 0.9, 0.25, 1)", pe = "cubic-bezier(0.1, 0.9, 0.2, 1)", j = "cubic-bezier(0.6, 0, 0.85, 0.4)", me = "cubic-bezier(0.65, 0, 0.35, 1)", M = (e, t, n) => `drop-shadow(${g(e)}em 0px 0px rgba(255, 40, 90, ${n})) drop-shadow(${g(-t)}em 0px 0px rgba(0, 225, 255, ${n}))`, he = "steps(1, end)", ge = C(.5, 0, .12, 1), _e = C(.6, 0, .4, 1), ve = {
	monte: {
		masque: !0,
		origine: [.5, 1],
		entree: () => ({
			kf: [{ transform: `translateY(calc(100% + ${de}em))` }, { transform: "translateY(0px)" }],
			easing: A
		}),
		sortie: () => ({
			kf: [{ transform: `translateY(calc(-100% - ${de}em))` }],
			easing: j
		}),
		repos: () => ({ transform: "translateY(0px)" })
	},
	doux: {
		origine: [.5, 1],
		entree: () => ({
			kf: [{
				opacity: 0,
				transform: "translateY(0.3em)"
			}, {
				opacity: 1,
				transform: "translateY(0em)"
			}],
			easing: A
		}),
		sortie: () => ({
			kf: [{
				opacity: 0,
				transform: "translateY(-0.2em)"
			}],
			easing: j
		}),
		repos: () => ({
			opacity: 1,
			transform: "translateY(0em)"
		})
	},
	net: {
		origine: [.5, .5],
		entree: () => ({
			kf: [
				{
					opacity: 0,
					filter: "blur(0.16em)",
					transform: "scale(1.07)"
				},
				{
					offset: .55,
					opacity: 1
				},
				{
					opacity: 1,
					filter: "blur(0em)",
					transform: "none"
				}
			],
			easing: A
		}),
		sortie: () => ({
			kf: [{
				opacity: 0,
				filter: "blur(0.12em)",
				transform: "scale(0.97)"
			}],
			easing: j
		}),
		repos: () => ({
			opacity: 1,
			filter: "blur(0em)",
			transform: "none"
		})
	},
	approche: {
		lettres: !0,
		facteur: 1.5,
		origine: [.5, .5],
		entree: (e) => ({
			kf: [
				{
					opacity: 0,
					filter: "blur(0.05em)",
					transform: `translateX(${g(e.dx * .5, 2)}px)`
				},
				{
					offset: .5,
					opacity: 1
				},
				{
					opacity: 1,
					filter: "blur(0em)",
					transform: "translateX(0px)"
				}
			],
			easing: "cubic-bezier(0.12, 0.8, 0.2, 1)"
		}),
		sortie: (e) => ({
			kf: [{
				opacity: 0,
				filter: "blur(0.05em)",
				transform: `translateX(${g(e.dx * .35, 2)}px)`
			}],
			easing: j
		}),
		repos: () => ({
			opacity: 1,
			filter: "blur(0em)",
			transform: "translateX(0px)"
		})
	},
	graisse: {
		facteur: 1.3,
		origine: [.5, .5],
		entree: (e) => e.axe ? {
			kf: [
				{
					fontVariationSettings: e.fvs(100),
					opacity: 0
				},
				{
					offset: .2,
					opacity: 1
				},
				{
					fontVariationSettings: e.fvs(e.poids),
					opacity: 1
				}
			],
			easing: A
		} : {
			kf: [{ opacity: 0 }, { opacity: 1 }],
			easing: "cubic-bezier(0.3, 0, 0.3, 1)"
		},
		sortie: (e) => e.axe ? {
			kf: [{
				fontVariationSettings: e.fvs(100),
				opacity: 0
			}],
			easing: j
		} : {
			kf: [{ opacity: 0 }],
			easing: j
		},
		repos: (e) => e.axe ? {
			fontVariationSettings: e.fvs(e.poids),
			opacity: 1
		} : { opacity: 1 }
	},
	balai: {
		facteur: 1.1,
		origine: [0, .5],
		entree: (e) => {
			let t = D * e.em, n = [];
			for (let r = 0; r <= 12; r++) {
				let i = r / 12, a = ge(i) * (e.lg + 2 * t) - t, o = h(e.gauche + e.largeur - a, -t, e.largeur + t);
				n.push({
					offset: i,
					clipPath: `inset(-${T}em ${g(o, 2)}px -${E}em ${g(-t, 2)}px)`
				});
			}
			return {
				kf: n,
				easing: "linear"
			};
		},
		sortie: (e) => {
			let t = D * e.em, n = [];
			for (let r = 1; r <= 10; r++) {
				let i = r / 10, a = h(_e(i) * (e.lg + 2 * t) - t - e.gauche, -t, e.largeur + t);
				n.push({
					offset: i,
					clipPath: `inset(-${T}em ${g(-t, 2)}px -${E}em ${g(a, 2)}px)`
				});
			}
			return {
				kf: n,
				easing: "linear"
			};
		},
		repos: (e) => ({ clipPath: `inset(-${T}em ${g(-D * e.em, 2)}px -${E}em ${g(-D * e.em, 2)}px)` })
	},
	volet: {
		relief: !0,
		origine: [.5, 1],
		entree: (e) => {
			let t = g(Math.max(4 * e.em, e.lg * 1.2), 1);
			return {
				kf: [
					{
						transform: `perspective(${t}px) rotateX(-96deg)`,
						opacity: 0
					},
					{
						offset: .3,
						opacity: 1
					},
					{
						transform: `perspective(${t}px) rotateX(0deg)`,
						opacity: 1
					}
				],
				easing: fe
			};
		},
		sortie: (e) => ({
			kf: [{
				offset: .6,
				opacity: 1
			}, {
				transform: `perspective(${g(Math.max(4 * e.em, e.lg * 1.2), 1)}px) rotateX(90deg)`,
				opacity: 0
			}],
			easing: j
		}),
		repos: (e) => ({
			transform: `perspective(${g(Math.max(4 * e.em, e.lg * 1.2), 1)}px) rotateX(0deg)`,
			opacity: 1
		})
	},
	porte: {
		relief: !0,
		facteur: 1.2,
		origine: [0, .5],
		entree: (e) => {
			let t = g(Math.max(5 * e.em, e.lg * 1.6), 1);
			return {
				kf: [
					{
						transform: `perspective(${t}px) rotateY(82deg)`,
						opacity: 0
					},
					{
						offset: .35,
						opacity: 1
					},
					{
						transform: `perspective(${t}px) rotateY(0deg)`,
						opacity: 1
					}
				],
				easing: A
			};
		},
		sortie: (e) => ({
			kf: [{
				transform: `perspective(${g(Math.max(5 * e.em, e.lg * 1.6), 1)}px) rotateY(-70deg)`,
				opacity: 0
			}],
			easing: j
		}),
		repos: (e) => ({
			transform: `perspective(${g(Math.max(5 * e.em, e.lg * 1.6), 1)}px) rotateY(0deg)`,
			opacity: 1
		})
	},
	glisse: {
		origine: [.5, 1],
		entree: () => ({
			kf: [
				{
					transform: "translateX(0.9em) skewX(-14deg)",
					opacity: 0
				},
				{
					offset: .4,
					opacity: 1
				},
				{
					transform: "none",
					opacity: 1
				}
			],
			easing: A
		}),
		sortie: () => ({
			kf: [{
				transform: "translateX(-0.7em) skewX(12deg)",
				opacity: 0
			}],
			easing: j
		}),
		repos: () => ({
			transform: "none",
			opacity: 1
		})
	},
	penche: {
		origine: [.5, 1],
		entree: () => ({
			kf: [
				{
					transform: "translateX(0.3em) skewX(-38deg)",
					opacity: 0
				},
				{
					offset: .25,
					opacity: 1
				},
				{
					transform: "none",
					opacity: 1
				}
			],
			easing: pe
		}),
		sortie: () => ({
			kf: [{
				transform: "translateX(-0.25em) skewX(30deg)",
				opacity: 0
			}],
			easing: j
		}),
		repos: () => ({
			transform: "none",
			opacity: 1
		})
	},
	fonce: {
		facteur: .9,
		origine: [.5, .5],
		entree: () => ({
			kf: [
				{
					transform: "scale(2)",
					filter: "blur(0.12em)",
					opacity: 0
				},
				{
					offset: .35,
					opacity: 1
				},
				{
					transform: "none",
					filter: "blur(0em)",
					opacity: 1
				}
			],
			easing: "cubic-bezier(0.1, 0.8, 0.2, 1)"
		}),
		sortie: () => ({
			kf: [{
				transform: "scale(1.9)",
				filter: "blur(0.1em)",
				opacity: 0
			}],
			easing: "cubic-bezier(0.7, 0, 0.9, 0.4)"
		}),
		repos: () => ({
			transform: "none",
			filter: "blur(0em)",
			opacity: 1
		})
	},
	parasite: {
		facteur: .85,
		origine: [.5, .5],
		entree: (e) => {
			let t = [], n = [
				0,
				1,
				.55,
				1,
				.8,
				1,
				1
			];
			for (let r = 0; r < n.length; r++) {
				let i = 1 - r / n.length, a = g((e.a() * 2 - 1) * .09 * i, 3), o = g((.03 + e.a() * .07) * i, 3), s = g((.03 + e.a() * .07) * i, 3), c = e.a() < .45, l = Math.round(e.a() * 55), u = Math.round(e.a() * Math.max(0, 85 - l - 15));
				t.push({
					offset: g(r / n.length * .8, 3),
					easing: he,
					opacity: n[r],
					transform: `translateX(${a}em)`,
					filter: M(o, s, .85),
					clipPath: c && r > 0 ? `inset(${l}% -${D}em ${u}% -${D}em)` : O
				});
			}
			return t.push({
				offset: .8,
				opacity: 1,
				transform: "translateX(0em)",
				filter: M(0, 0, 0),
				clipPath: O
			}), t.push({
				offset: 1,
				opacity: 1,
				transform: "translateX(0em)",
				filter: M(0, 0, 0),
				clipPath: O
			}), {
				kf: t,
				easing: "linear"
			};
		},
		sortie: (e) => {
			let t = [];
			for (let n = 1; n <= 4; n++) {
				let r = g((e.a() * 2 - 1) * .08, 3);
				t.push({
					offset: g(n * .2, 3),
					easing: he,
					opacity: n % 2 ? .6 : 1,
					transform: `translateX(${r}em)`,
					filter: M(.06, .05, .85),
					clipPath: O
				});
			}
			return t.push({
				offset: 1,
				opacity: 0,
				transform: "translateX(0em)",
				filter: M(0, 0, 0),
				clipPath: O
			}), {
				kf: t,
				easing: "linear"
			};
		},
		repos: () => ({
			opacity: 1,
			transform: "translateX(0em)",
			filter: M(0, 0, 0),
			clipPath: O
		})
	},
	tombe: {
		joueur: !0,
		facteur: 1.35,
		origine: [.5, 1],
		entree: () => ({
			kf: [
				{
					offset: 0,
					transform: "translateY(-1.1em) rotate(0deg) scale(1, 1)",
					opacity: 0,
					easing: "cubic-bezier(0.5, 0, 0.9, 0.5)"
				},
				{
					offset: .18,
					opacity: 1
				},
				{
					offset: .5,
					transform: "translateY(0em) rotate(0deg) scale(1.08, 0.9)",
					easing: "cubic-bezier(0.2, 0.6, 0.4, 1)"
				},
				{
					offset: .7,
					transform: "translateY(-0.24em) rotate(0deg) scale(0.98, 1.03)",
					easing: "cubic-bezier(0.6, 0, 0.8, 0.5)"
				},
				{
					offset: .86,
					transform: "translateY(0em) rotate(0deg) scale(1.03, 0.97)",
					easing: "cubic-bezier(0.2, 0.6, 0.4, 1)"
				},
				{
					offset: 1,
					transform: "none",
					opacity: 1
				}
			],
			easing: "linear"
		}),
		sortie: (e) => ({
			kf: [{
				transform: `translateY(1.8em) rotate(${e.a() < .5 ? -16 : 16}deg) scale(1, 1)`,
				opacity: 0
			}],
			easing: "cubic-bezier(0.55, 0, 1, 0.45)"
		}),
		repos: () => ({
			transform: "none",
			opacity: 1
		})
	},
	eclot: {
		joueur: !0,
		facteur: 1.15,
		origine: [.5, .5],
		entree: (e) => ({
			kf: [
				{
					transform: "scale(0)",
					opacity: 0
				},
				{
					offset: .12,
					opacity: 1
				},
				{
					transform: "none",
					opacity: 1
				}
			],
			easing: e.ressort(.42)
		}),
		sortie: () => ({
			kf: [{
				transform: "scale(0.5)",
				opacity: 0
			}],
			easing: j
		}),
		repos: () => ({
			transform: "none",
			opacity: 1
		})
	},
	houle: {
		joueur: !0,
		facteur: 1.2,
		origine: [.5, 1],
		entree: (e) => ({
			kf: [
				{
					transform: "translateY(0.75em)",
					opacity: 0
				},
				{
					offset: .2,
					opacity: 1
				},
				{
					transform: "translateY(0em)",
					opacity: 1
				}
			],
			easing: e.ressort(.5)
		}),
		sortie: () => ({
			kf: [{
				transform: "translateY(-0.5em)",
				opacity: 0
			}],
			easing: j
		}),
		repos: () => ({
			transform: "translateY(0em)",
			opacity: 1
		})
	},
	etire: {
		joueur: !0,
		facteur: 1.3,
		origine: [.5, 1],
		entree: () => ({
			kf: [
				{
					offset: 0,
					transform: "translateY(-0.3em) scale(0.35, 1.9)",
					opacity: 0,
					easing: "cubic-bezier(0.3, 0, 0.6, 1)"
				},
				{
					offset: .35,
					transform: "translateY(0em) scale(0.8, 1.32)",
					opacity: 1,
					easing: "cubic-bezier(0.3, 0.6, 0.5, 1)"
				},
				{
					offset: .55,
					transform: "translateY(0em) scale(1.18, 0.82)",
					easing: "cubic-bezier(0.4, 0, 0.5, 1)"
				},
				{
					offset: .74,
					transform: "translateY(0em) scale(0.95, 1.06)",
					easing: me
				},
				{
					offset: .88,
					transform: "translateY(0em) scale(1.02, 0.98)",
					easing: me
				},
				{
					offset: 1,
					transform: "none",
					opacity: 1
				}
			],
			easing: "linear"
		}),
		sortie: () => ({
			kf: [{
				transform: "translateY(-0.9em) scale(0.4, 2)",
				opacity: 0
			}],
			easing: j
		}),
		repos: () => ({
			transform: "none",
			opacity: 1
		})
	},
	vrille: {
		joueur: !0,
		facteur: 1.25,
		origine: [.5, .5],
		entree: () => ({
			kf: [
				{
					transform: "rotate(-210deg) scale(0.1)",
					opacity: 0
				},
				{
					offset: .3,
					opacity: 1
				},
				{
					transform: "none",
					opacity: 1
				}
			],
			easing: "cubic-bezier(0.2, 0.9, 0.3, 1.1)"
		}),
		sortie: () => ({
			kf: [{
				transform: "rotate(180deg) scale(0.1)",
				opacity: 0
			}],
			easing: j
		}),
		repos: () => ({
			transform: "none",
			opacity: 1
		})
	},
	essaim: {
		joueur: !0,
		facteur: 1.35,
		origine: [.5, .5],
		entree: (e) => ({
			kf: [
				{
					transform: `translate(${g((e.a() * 2 - 1) * 3.2, 3)}em, ${g((e.a() * 2 - 1) * 2.2, 3)}em) rotate(${g((e.a() * 2 - 1) * 55, 1)}deg) scale(${g(.5 + e.a() * .8, 3)})`,
					opacity: 0
				},
				{
					offset: .3,
					opacity: 1
				},
				{
					transform: "none",
					opacity: 1
				}
			],
			easing: A
		}),
		sortie: (e) => ({
			kf: [{
				transform: `translate(${g((e.ex < 0 ? -1 : e.ex > 0 ? 1 : e.a() < .5 ? -1 : 1) * (1.2 + e.a() * 2.2), 3)}em, ${g((e.a() * 2 - 1) * 2, 3)}em) rotate(${g((e.a() * 2 - 1) * 70, 1)}deg) scale(0.6)`,
				opacity: 0
			}],
			easing: "cubic-bezier(0.3, 0, 0.8, 0.6)"
		}),
		repos: () => ({
			transform: "none",
			opacity: 1
		})
	}
}, ye = /[.,;:!?…»)\]]/;
function be(e, t, n = 16) {
	let r = b(t), i = 1 / Math.max(1, n), a = [], o = 0;
	for (let t = 0; t < e.length; t++) {
		a.push(g(o, 4));
		let n = e[t], s = i * (.55 + r() * .9);
		n.trim() === "" && (s += i * (.3 + r() * .6)), ye.test(n) && (s += .16 + r() * .18), r() < .05 && (s += .18 + r() * .2), o += s;
	}
	return a;
}
var N = {
	maj: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
	min: "abcdefghijklmnopqrstuvwxyz",
	chiffres: "0123456789"
}, xe = (e, t) => .3 + .7 * (t > 1 ? e / (t - 1) : 1), Se = (e, t) => .22 * (t > 1 ? e / (t - 1) : 0);
function Ce(e, t, n, r) {
	let i = e.length;
	return e.map((e, a) => {
		let o = t > 0 && t >= Se(a, i);
		if (t >= 1 || t >= xe(a, i)) return {
			t: e,
			vu: o
		};
		let s = "";
		if (/^\p{Nd}$/u.test(e) ? s = N.chiffres : /^\p{Lu}/u.test(e) ? s = N.maj : /^\p{Ll}/u.test(e) && (s = N.min), !s) return {
			t: e,
			vu: o
		};
		let c = b(y(e, n + a * 7919 + r * 104729));
		return {
			t: s[Math.floor(c() * s.length)] ?? e,
			vu: o
		};
	});
}
var P = (e) => g(e, 1);
function we(e, t, n, r, i, a = 2) {
	let o = b(i), s = n - e, c = r - t, l = Math.hypot(s, c) || 1, u = -c / l, d = s / l, f = (o() * 2 - 1) * a, p = (o() * 2 - 1) * a, m = [e + s * .3 + u * f, t + c * .3 + d * f], h = [e + s * .7 + u * p, t + c * .7 + d * p];
	return `M ${P(e)} ${P(t)} C ${P(m[0])} ${P(m[1])} ${P(h[0])} ${P(h[1])} ${P(n)} ${P(r)}`;
}
function Te(e, t, n, r, i) {
	let a = b(i), o = a() * Math.PI * 2, s = a() * Math.PI * 2, c = -Math.PI * (.62 + a() * .12), l = 1.1 + a() * .08 + .42, u = Math.ceil(l * 72), d = [];
	for (let i = 0; i <= u; i++) {
		let a = i / u, f = c + a * l * Math.PI * 2, p = 1 + .07 * Math.max(0, a * l - .9), m = (1 + .05 * Math.sin(2 * f + o) + .035 * Math.sin(3 * f + s)) * p;
		d.push([e + Math.cos(f) * n * m, t + Math.sin(f) * r * m]);
	}
	let f = `M ${P(d[0][0])} ${P(d[0][1])}`;
	for (let e = 1; e < d.length - 1; e++) {
		let t = d[e], n = d[e + 1];
		f += ` Q ${P(t[0])} ${P(t[1])} ${P((t[0] + n[0]) / 2)} ${P((t[1] + n[1]) / 2)}`;
	}
	let p = d[d.length - 1];
	return `${f} L ${P(p[0])} ${P(p[1])}`;
}
function Ee(e, t, n, r, i, a = 2) {
	let o = b(i), s = () => (o() * 2 - 1) * a, c = [
		[e + s(), t + s()],
		[e + n + s(), t + s()],
		[e + n + s(), t + r + s()],
		[e + s(), t + r + s()]
	], l = [c[0][0] + Math.min(n * .18, 3 * a + 8), c[0][1] + s() * .5], u = `M ${P(c[0][0])} ${P(c[0][1])}`, d = [
		c[1],
		c[2],
		c[3],
		c[0],
		l
	], f = c[0];
	for (let e of d) {
		let t = (f[0] + e[0]) / 2 + s() * .6, n = (f[1] + e[1]) / 2 + s() * .6;
		u += ` Q ${P(t)} ${P(n)} ${P(e[0])} ${P(e[1])}`, f = e;
	}
	return u;
}
function De(e, t, n, r, i) {
	let a = b(i), o = (e) => (a() * 2 - 1) * e, s = Math.min(r * .12, 3);
	return `M ${[
		[e + o(s), t + o(s)],
		[e + n * .5, t + o(s)],
		[e + n + o(s), t + o(s) + s * .5],
		[e + n + o(s) + s, t + r + o(s)],
		[e + n * .5, t + r + o(s)],
		[e + o(s) - s * .6, t + r + o(s)]
	].map((e) => `${P(e[0])} ${P(e[1])}`).join(" L ")} Z`;
}
var F = "http://www.w3.org/2000/svg", I = (e) => Math.max(0, e * 1e3), L = () => typeof document < "u", Oe = `
.cin-lu{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;border:0!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;user-select:none;pointer-events:none}
.cin-m,.cin-p{display:inline-block;white-space:nowrap;text-indent:0}
.cin-masque{clip-path:${O}}
.cin-w{white-space:nowrap}
.cin-relief{backface-visibility:hidden}
.cin-centre>.cin-m>.cin-p,.cin-centre .cin-m>.cin-p{width:100%;text-align:center}
.cin-brouille .cin-p{font-variant-numeric:tabular-nums}
.cin-curseur{position:absolute;left:0;top:0;width:0.08em;background:currentColor;pointer-events:none;border-radius:0.02em}
.cin-fente{display:inline-block;position:relative;white-space:nowrap;vertical-align:baseline;clip-path:inset(-${k.haut}em -0.12em -${k.bas}em -0.12em);text-indent:0}
.cin-roule-mot{display:inline-block;white-space:nowrap}
.cin-roule-entrant{position:absolute;left:0;top:0}
.cin-roule-mesure{position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;pointer-events:none}
:where([data-marque]){background:transparent;color:inherit}
.cin-marque{position:relative;isolation:isolate}
.cin-marque-svg{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}
.cin-marque-surligneur>.cin-marque-svg{z-index:-1}
.cin-defile{overflow:clip;position:relative;contain:inline-size}
.cin-defile-scene{display:block;pointer-events:none}
.cin-rang{display:block;white-space:nowrap;overflow:visible}
.cin-piste{display:inline-block;white-space:nowrap}
.cin-motif{display:inline-block;white-space:pre}
.cin-motif>*{display:inline}
.cin-reflet-calque{position:absolute;pointer-events:none;color:transparent!important;-webkit-text-fill-color:transparent!important;background-repeat:no-repeat;background-size:300% 100%;-webkit-background-clip:text;background-clip:text;user-select:none}
.cin-reflet-calque *{color:transparent!important;-webkit-text-fill-color:transparent!important;background:none!important;text-decoration-color:transparent!important;border-color:transparent!important;box-shadow:none!important}
.cin-cercle-boite{display:inline-block;vertical-align:middle}
.cin-cercle-svg{display:block;overflow:visible}
.cin-coupe-env{display:block;position:relative}
.cin-coupe-moitie{display:block}
.cin-coupe-bas{position:absolute;left:0;top:0;width:100%}
`;
function ke() {
	if (!L() || document.getElementById("presse-cinetique-css")) return;
	let e = document.createElement("style");
	e.id = "presse-cinetique-css", e.textContent = Oe, document.head.append(e);
}
var R = null;
function Ae(e) {
	return R ??= typeof globalThis.CSS?.supports == "function" && globalThis.CSS.supports("animation-timing-function", "linear(0, 0.5, 1)"), R ? ue(e) : "cubic-bezier(0.34, 1.56, 0.64, 1)";
}
var je = null;
function Me() {
	return !L() || !document.fonts || document.fonts.status === "loaded" ? Promise.resolve() : (je ??= Promise.race([document.fonts.ready.then(() => void 0), new Promise((e) => setTimeout(e, 2500))]), je);
}
var z = (e, t) => {
	let n = document.createElement("span");
	return n.className = e, t !== void 0 && n.append(t), n;
};
function B(e) {
	e.getAttribute("class") === "" && e.removeAttribute("class"), e.getAttribute("style") === "" && e.removeAttribute("style");
}
var V = (e) => e instanceof Element && (e.hasAttribute("data-cin-calque") || e.classList.contains("cin-lu")), Ne = /* @__PURE__ */ new Set([
	"IMG",
	"PICTURE",
	"VIDEO",
	"AUDIO",
	"CANVAS",
	"IFRAME",
	"OBJECT",
	"EMBED",
	"INPUT",
	"SELECT",
	"TEXTAREA",
	"BUTTON",
	"METER",
	"PROGRESS"
]);
function H(e, t) {
	let n = e.cloneNode(t), r = (e) => {
		e.removeAttribute("id"), e instanceof HTMLElement && (e.tabIndex >= 0 || e.hasAttribute("tabindex")) && (e.tabIndex = -1), e instanceof HTMLAnchorElement && (e.tabIndex = -1);
	};
	return r(n), t && n.querySelectorAll("*").forEach(r), n.setAttribute("data-cin-copie", ""), n;
}
var Pe = /* @__PURE__ */ new Map();
function Fe(e) {
	let t = getComputedStyle(e), n = `${t.fontFamily}|${t.fontStyle}|${t.fontStretch}`, r = Pe.get(n);
	if (r !== void 0) return r;
	let i = document.createElement("span");
	i.textContent = "Hamburgefonstiv 0123", i.setAttribute("aria-hidden", "true"), i.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-variation-settings:'wght' 100", e.append(i);
	let a = i.getBoundingClientRect().width;
	i.style.fontVariationSettings = "'wght' 900";
	let o = i.getBoundingClientRect().width;
	i.remove();
	let s = Math.abs(a - o) > .5;
	return (s || document.fonts?.status === "loaded") && Pe.set(n, s), s;
}
function Ie(e) {
	let t = e === "normal" || !e ? [] : e.split(",").map((e) => e.trim()).filter((e) => !/^["']wght["']/.test(e));
	return (e) => [`"wght" ${Math.round(e)}`, ...t].join(", ");
}
var U = class {
	lu;
	atomes = [];
	lignes = [];
	restaure = !1;
	el;
	constructor(e, t, n, r = "") {
		this.el = e;
		let i = t === "glyphe" ? [] : Le(e, t), a = document.createDocumentFragment(), o = 0, s = -1, c = "rien", l = (e, r) => {
			if (t === "glyphe") {
				let t = z("cin-g", e);
				return this.atomes.push({
					m: t,
					p: t,
					mot: s,
					ligne: 0,
					g: 0,
					texte: r,
					boite: null
				}), t;
			}
			let a = z(n ? "cin-m cin-masque" : "cin-m");
			a.setAttribute("aria-hidden", "true");
			let c = z("cin-p", e);
			a.append(c);
			let l = i[o++];
			return l && l.w > 0 && (a.style.width = `${l.w}px`), this.atomes.push({
				m: a,
				p: c,
				mot: s,
				ligne: 0,
				g: 0,
				texte: r,
				boite: null,
				orig: l
			}), a;
		}, u = (e) => {
			c === "atome" && t !== "glyphe" && e.appendChild(document.createTextNode("⁠"));
		}, d = (e, n) => {
			if (e.nodeType === Node.TEXT_NODE) {
				for (let r of se(e.data)) if (r.type !== "mot") n.appendChild(document.createTextNode(r.t)), c = "espace";
				else {
					if (r.apresTiret && c === "atome" || u(n), c !== "atome" && s++, t === "mot") n.appendChild(l(r.t, r.t));
					else {
						let e = t === "lettre" ? z("cin-w") : null;
						for (let t of r.lettres) (e ?? n).appendChild(l(t, t));
						e && n.appendChild(e);
					}
					c = "atome";
				}
				return;
			}
			if (!(e instanceof Element) || V(e)) return;
			if (e.tagName === "BR" || e.tagName === "WBR") {
				n.appendChild(H(e, !1)), c = "espace";
				return;
			}
			if (Ne.has(e.tagName) || e.namespaceURI !== "http://www.w3.org/1999/xhtml") {
				u(n), c !== "atome" && s++;
				let r = H(e, !0);
				t === "glyphe" ? n.appendChild(r) : n.appendChild(l(r, "")), c = "atome";
				return;
			}
			let r = H(e, !1);
			for (let t of Array.from(e.childNodes)) d(t, r);
			n.appendChild(r);
		};
		for (let t of Array.from(e.childNodes)) d(t, a);
		for (let e of Array.from(a.childNodes)) e instanceof Element && e.setAttribute("aria-hidden", "true");
		this.lu = z("cin-lu"), this.lu.setAttribute("data-cin-calque", ""), this.lu.append(...Array.from(e.childNodes)), r && e.classList.add(...r.split(" ").filter(Boolean)), this.classes = r.split(" ").filter(Boolean), e.prepend(this.lu), e.append(a), t !== "glyphe" && this.decorer();
	}
	decorer() {
		let e = /* @__PURE__ */ new Map();
		for (let t of this.atomes) {
			let n = t.m.parentElement, r = null;
			for (; n && n !== this.el;) {
				let t = e.get(n);
				if (t === void 0) {
					let r = getComputedStyle(n);
					t = r.textDecorationLine && r.textDecorationLine !== "none" ? r : null, e.set(n, t);
				}
				if (t) {
					r = t;
					break;
				}
				n = n.parentElement;
			}
			r && (t.p.style.textDecorationLine = r.textDecorationLine, t.p.style.textDecorationStyle = r.textDecorationStyle, t.p.style.textDecorationColor = r.textDecorationColor, t.p.style.textDecorationThickness = r.textDecorationThickness);
		}
	}
	classes;
	mesurer() {
		for (let e of this.atomes) e.boite = e.m.getBoundingClientRect();
		let e = !1;
		for (let t = 1; t < this.atomes.length; t++) {
			let n = this.atomes[t - 1], r = this.atomes[t];
			if (!n.orig || !r.orig || !n.boite || !r.boite || !n.m.style.width || Math.abs(n.orig.y - r.orig.y) > 1 || Math.abs(n.boite.top - r.boite.top) > 1) continue;
			let i = Math.round((r.orig.x - n.orig.x - (r.boite.left - n.boite.left)) * 64) / 64;
			i === 0 || Math.abs(i) > n.boite.height || (n.m.style.width = `${n.boite.width + i}px`, e = !0);
		}
		if (e) for (let e of this.atomes) e.boite = e.m.getBoundingClientRect();
		let t = ce(this.atomes.map((e) => e.boite));
		this.lignes.length = 0, this.atomes.forEach((e, n) => {
			e.ligne = t[n] ?? 0;
			let r = e.boite, i = this.lignes[e.ligne] ??= {
				left: Infinity,
				top: Infinity,
				right: -Infinity,
				bottom: -Infinity
			};
			i.left = Math.min(i.left, r.left), i.top = Math.min(i.top, r.top), i.right = Math.max(i.right, r.right), i.bottom = Math.max(i.bottom, r.bottom);
		});
	}
	restaurer() {
		this.restaure || (this.restaure = !0, this.el.replaceChildren(...Array.from(this.lu.childNodes)), this.classes.length && this.el.classList.remove(...this.classes), B(this.el));
	}
};
function Le(e, t) {
	let n = [], r = document.createRange(), i = (e, t, i) => {
		r.setStart(e, t), r.setEnd(e, i);
		let a = r.getClientRects();
		n.push(a.length === 1 ? {
			w: a[0].width,
			x: a[0].left,
			y: a[0].top
		} : void 0);
	}, a = (e) => {
		if (e.nodeType === Node.TEXT_NODE) {
			let n = e;
			for (let e of se(n.data)) if (e.type === "mot") {
				if (t === "mot") i(n, e.debut, e.fin);
				else {
					let t = e.debut;
					for (let r of e.lettres) i(n, t, t + r.length), t += r.length;
				}
			}
		} else e instanceof Element && !V(e) && e.tagName !== "BR" && e.tagName !== "WBR" && (Ne.has(e.tagName) || e.namespaceURI !== "http://www.w3.org/1999/xhtml" ? n.push(void 0) : e.childNodes.forEach(a));
	};
	return e.childNodes.forEach(a), r.detach?.(), n;
}
var W = /* @__PURE__ */ new Map(), G = null, K = null, q = null, Re = null, ze = !1, J = class {
	quand;
	rejoue;
	delai;
	sortieAuto;
	vu = !1;
	enVueNow = !1;
	minuteurSortie = 0;
	detruit = !1;
	el;
	constructor(e) {
		this.el = e;
		let t = e.dataset;
		this.quand = l(t.cinetiqueQuand), this.rejoue = p(t.cinetiqueRejoue), this.delai = f(t.cinetiqueDelai, 0, 0, 120);
		let n = t.cinetiqueSortie === void 0 ? NaN : f(t.cinetiqueSortie, NaN, 0, 600);
		this.sortieAuto = Number.isFinite(n) ? n : null, ke(), W.set(e, this);
	}
	brancher() {
		K?.observe(this.el), q?.observe(this.el), this.quand === "entree" ? G?.observe(this.el) : this.quand === "chargement" ? Be().then(() => !this.detruit && this.jouer()) : this.quand === "survol" && (this.el.addEventListener("pointerenter", this.surSurvol), this.el.addEventListener("focusin", this.surSurvol));
	}
	surSurvol = (e) => {
		e.pointerType !== "touch" && this.survol();
	};
	survol() {
		this.jouer();
	}
	visible() {
		this.quand !== "entree" || this.vu || (this.vu = !0, Me().then(() => !this.detruit && this.jouer()));
	}
	vue(e, t) {
		this.enVueNow = e, this.enVue(e), !e && t && this.rejoue && this.vu && this.quand === "entree" && (this.vu = !1, this.annulerSortie(), this.cacher());
	}
	enVue(e) {}
	signal(e, t) {
		this.el.dispatchEvent(new CustomEvent(`cinetique:${e}`, { detail: { sens: t } }));
	}
	arrive() {
		this.signal("fin", "entree"), this.annulerSortie(), this.sortieAuto !== null && (this.minuteurSortie = window.setTimeout(() => this.sortir(), I(this.sortieAuto)));
	}
	annulerSortie() {
		clearTimeout(this.minuteurSortie);
	}
	get attend() {
		return this.quand === "entree" || this.quand === "chargement";
	}
	invalider(e) {}
	detruire() {
		this.detruit = !0, this.annulerSortie(), G?.unobserve(this.el), K?.unobserve(this.el), q?.unobserve(this.el), this.el.removeEventListener("pointerenter", this.surSurvol), this.el.removeEventListener("focusin", this.surSurvol), W.delete(this.el);
	}
};
function Be() {
	let e = document.readyState === "complete" ? Promise.resolve() : new Promise((e) => addEventListener("load", () => e(), { once: !0 }));
	return Promise.all([e, Me()]).then(() => void 0);
}
var Y = (e) => Promise.all(e.map((e) => e.finished)).then(() => !0, () => !1), Ve = class extends J {
	r;
	preset;
	d = null;
	anims = [];
	ctxs = [];
	ng = 0;
	total = 0;
	etat = "repos";
	gen = 0;
	largeurVue = 0;
	fondu = null;
	apresSortie = null;
	graine;
	constructor(e) {
		super(e), this.r = ee(e.dataset), this.preset = ve[this.r.preset], this.graine = y(e.textContent ?? "", t.indexOf(this.r.preset)), this.attend && this.cacher(), this.brancher();
	}
	get mode() {
		return this.r.par === "lettre" || this.preset.lettres ? "lettre" : "mot";
	}
	fendre() {
		this.annuler(), this.d?.restaurer();
		let e = ["cin-anime", this.r.preset === "graisse" ? "cin-centre" : ""].join(" "), t = new U(this.el, this.mode, !!this.preset.masque, e);
		this.d = t, t.mesurer(), this.largeurVue = this.el.clientWidth;
		let n = this.r.par, r = (e, t) => n === "ligne" ? e.ligne : n === "mot" || this.preset.lettres ? e.mot * 4096 + e.ligne : t, i = /* @__PURE__ */ new Map();
		t.atomes.forEach((e, t) => {
			let n = r(e, t);
			i.has(n) || i.set(n, i.size), e.g = i.get(n);
		}), this.ng = i.size;
		let a = [];
		for (let e of t.atomes) {
			let t = e.boite, n = a[e.g] ??= {
				left: Infinity,
				top: Infinity,
				right: -Infinity,
				bottom: -Infinity
			};
			n.left = Math.min(n.left, t.left), n.top = Math.min(n.top, t.top), n.right = Math.max(n.right, t.right), n.bottom = Math.max(n.bottom, t.bottom);
		}
		let o = this.el.getBoundingClientRect(), s = o.left + o.width / 2, c = /* @__PURE__ */ new Map(), l = (e) => {
			let t = c.get(e);
			if (!t) {
				let n = getComputedStyle(e);
				t = {
					em: Number.parseFloat(n.fontSize) || 16,
					poids: Number.parseFloat(n.fontWeight) || 400,
					fvs: Ie(n.fontVariationSettings),
					axe: this.r.preset === "graisse" && Fe(e)
				}, c.set(e, t);
			}
			return t;
		}, [u, d] = this.preset.origine;
		this.ctxs = t.atomes.map((e, r) => {
			let i = e.boite, c = a[e.g], f = l(e.m.parentElement ?? this.el);
			return n === "ligne" || this.preset.lettres ? e.p.style.transformOrigin = `${g(c.left + u * (c.right - c.left) - i.left, 2)}px ${g(c.top + d * (c.bottom - c.top) - i.top, 2)}px` : e.p.style.transformOrigin = `${u * 100}% ${d * 100}%`, this.preset.relief && e.p.classList.add("cin-relief"), {
				i: r,
				n: t.atomes.length,
				g: e.g,
				ng: this.ng,
				dx: i.left + i.width / 2 - (c.left + c.right) / 2,
				gauche: i.left - c.left,
				largeur: i.width,
				lg: c.right - c.left,
				ex: o.width > 0 ? h((i.left + i.width / 2 - s) / (o.width / 2), -1, 1) : 0,
				em: f.em,
				poids: f.poids,
				fvs: f.fvs,
				axe: f.axe,
				ressort: Ae
			};
		});
	}
	ctx(e) {
		let t = this.ctxs[e];
		return {
			...t,
			a: b(y(String(this.graine), t.g + 1))
		};
	}
	annuler() {
		this.gen++;
		for (let e of this.anims) e.cancel();
		this.anims = [];
	}
	restaurer() {
		this.annuler(), this.d?.restaurer(), this.d = null, this.etat = "repos";
	}
	construireEntree(e, t) {
		this.annuler();
		let n = this.d, r = x(this.ng, this.r.cascade, this.r.duree, this.r.ordre, this.graine);
		this.total = r.total, n.atomes.forEach((t, n) => {
			t.cache = !1;
			let { kf: i, easing: a } = this.preset.entree(this.ctx(n)), o = r.debuts[t.g] ?? 0, s = t.p.animate(i, {
				duration: I(this.r.duree),
				delay: I(this.r.delai + o),
				endDelay: I(r.total - o - this.r.duree),
				fill: "both",
				easing: a
			});
			s.pause(), s.currentTime = e, this.anims.push(s);
		}), t && this.lancerEntree();
	}
	lancerEntree() {
		this.etat = "entre";
		for (let e of this.anims) e.play();
		this.signal("debut", "entree");
		let e = this.gen;
		Y(this.anims).then((t) => {
			t && e === this.gen && !this.detruit && (this.restaurer(), this.arrive());
		});
	}
	figer() {
		let e = this.d;
		e && (this.anims.forEach((t, n) => {
			let r = e.atomes[n];
			if (!r) return;
			let i = Number(t.effect?.getTiming().delay ?? 0), a = Number(t.currentTime ?? 0);
			r.cache = this.etat !== "sort" && a <= i + .5;
			try {
				t.commitStyles();
			} catch {}
		}), this.annuler());
	}
	construireSortie() {
		let e = this.d, t = x(this.ng, this.r.cascadeSortie, this.r.dureeSortie, this.r.ordre, this.graine);
		e.atomes.forEach((e, n) => {
			if (e.cache) return;
			let r = this.ctx(n), { kf: i, easing: a } = this.preset.sortie(r), o = t.debuts[e.g] ?? 0;
			this.anims.push(e.p.animate(i, {
				duration: I(this.r.dureeSortie),
				delay: I(o),
				endDelay: I(t.total - o - this.r.dureeSortie),
				fill: "forwards",
				easing: a
			}));
		}), this.etat = "sort", this.signal("debut", "sortie");
		let n = this.gen;
		Y(this.anims).then((e) => {
			if (!e || n !== this.gen || this.detruit) return;
			this.etat = "sorti", this.signal("fin", "sortie");
			let t = this.apresSortie;
			this.apresSortie = null, t?.();
		});
	}
	poserRepos() {
		this.d?.atomes.forEach((e, t) => {
			e.cache = !1;
			let n = this.preset.repos(this.ctx(t));
			for (let [t, r] of Object.entries(n)) t !== "offset" && t !== "easing" && r != null && e.p.style.setProperty(t.replace(/[A-Z]/g, (e) => `-${e.toLowerCase()}`), String(r));
		});
	}
	opaciteAvant = null;
	fonduVers(e, t) {
		this.fondu?.cancel(), this.opaciteAvant ??= this.el.style.opacity;
		let n = Number.parseFloat(getComputedStyle(this.el).opacity), r = this.el.animate([{ opacity: n }, { opacity: e }], {
			duration: e ? 260 : 200,
			easing: "ease-out",
			fill: "both"
		});
		this.fondu = r, r.finished.then(() => {
			this.fondu === r && (e && (r.cancel(), this.el.style.opacity = this.opaciteAvant ?? "", this.opaciteAvant = null, this.fondu = null), t?.());
		}, () => {});
	}
	jouer() {
		if (this.annulerSortie(), e()) this.d && this.restaurer(), this.etat = "entre", this.signal("debut", "entree"), this.fonduVers(1, () => {
			this.etat = "repos", this.arrive();
		});
		else switch (this.etat) {
			case "entre": return;
			case "cache":
			case "suspendu":
				this.d || (this.fendre(), this.construireEntree(0, !1)), this.lancerEntree();
				return;
			case "sort": return this.versRepos();
			case "sorti":
			case "repos":
				this.fendre(), this.construireEntree(0, !0);
				return;
		}
	}
	versRepos() {
		this.figer(), this.d.atomes.forEach((e, t) => {
			let n = this.preset.repos(this.ctx(t));
			this.anims.push(e.p.animate([n], {
				duration: 450,
				easing: A,
				fill: "forwards"
			}));
		}), this.etat = "entre", this.signal("debut", "entree");
		let e = this.gen;
		Y(this.anims).then((t) => {
			t && e === this.gen && !this.detruit && (this.restaurer(), this.arrive());
		});
	}
	sortir() {
		if (this.annulerSortie(), e()) this.d && this.restaurer(), this.etat = "sort", this.signal("debut", "sortie"), this.fonduVers(0, () => {
			this.etat = "sorti", this.signal("fin", "sortie");
			let e = this.apresSortie;
			this.apresSortie = null, e?.();
		});
		else switch (this.etat) {
			case "sort":
			case "sorti": return;
			case "cache":
				this.etat = "sorti";
				return;
			case "repos":
				this.fendre(), this.poserRepos(), this.construireSortie();
				return;
			case "entre":
			case "suspendu":
				this.figer(), this.construireSortie();
				return;
		}
	}
	survol() {
		this.etat === "repos" && (e() || (this.apresSortie = () => this.jouer(), this.sortir()));
	}
	cacher() {
		this.annulerSortie(), this.apresSortie = null, e() ? (this.d && this.restaurer(), this.fondu?.cancel(), this.fondu = null, this.opaciteAvant ??= this.el.style.opacity, this.el.style.opacity = "0", this.etat = "cache") : (this.fendre(), this.construireEntree(0, !1), this.etat = "cache");
	}
	aller(t) {
		if (this.annulerSortie(), t = m(t), e()) {
			this.d && this.restaurer(), this.fondu?.cancel(), this.fondu = null, this.opaciteAvant ??= this.el.style.opacity, this.el.style.opacity = t >= 1 ? this.opaciteAvant ?? "" : String(t), t >= 1 && (this.opaciteAvant = null), this.etat = t >= 1 ? "repos" : t <= 0 ? "cache" : "suspendu";
			return;
		}
		if (t >= 1) {
			this.restaurer();
			return;
		}
		this.fendre();
		let n = x(this.ng, this.r.cascade, this.r.duree, this.r.ordre, this.graine);
		this.construireEntree(I(this.r.delai + t * n.total), !1), this.etat = t <= 0 ? "cache" : "suspendu";
	}
	invalider(e) {
		if (!this.d || this.detruit || !e && Math.abs(this.el.clientWidth - this.largeurVue) < .5) return;
		let t = this.etat, n = Number(this.anims[0]?.currentTime ?? 0);
		if (t === "cache" || t === "suspendu" || t === "entre") this.fendre(), this.construireEntree(n, !1), t === "entre" ? this.lancerEntree() : this.etat = t;
		else if (t === "sort" || t === "sorti") {
			this.fendre(), this.poserRepos(), this.construireSortie();
			for (let e of this.anims) e.finish();
		}
	}
	detruire() {
		this.annuler(), this.fondu?.cancel(), this.opaciteAvant !== null && (this.el.style.opacity = this.opaciteAvant), this.d?.restaurer(), B(this.el), this.d = null, super.detruire();
	}
}, He = "cubic-bezier(0.76, 0, 0.24, 1)", X = g(k.haut + k.bas, 3), Ue = class extends J {
	mots;
	tempo;
	duree;
	i = 0;
	origine;
	fente;
	courant;
	largeurs = [];
	actif = !1;
	minuteur = 0;
	anims = [];
	entrant = null;
	constructor(e) {
		super(e);
		let t = (e.dataset.roule ?? "").split("|").map((e) => e.trim()).filter(Boolean);
		this.mots = t.length ? t : [(e.textContent ?? "").trim()], this.tempo = f(e.dataset.rouleTempo, 2.2, .6, 120), this.duree = f(e.dataset.cinetiqueDuree, .55, .1, 5), this.origine = Array.from(e.childNodes);
		let n = z("cin-lu", this.mots.join(", "));
		n.setAttribute("data-cin-calque", ""), this.fente = z("cin-fente"), this.fente.setAttribute("aria-hidden", "true"), this.fente.setAttribute("data-cin-calque", ""), this.courant = z("cin-roule-mot", this.mots[0]), this.fente.append(this.courant), e.replaceChildren(n, this.fente), this.mesurer(), this.brancher();
	}
	mesurer() {
		this.largeurs = this.mots.map((e) => {
			let t = z("cin-roule-mesure", e);
			this.fente.append(t);
			let n = t.getBoundingClientRect().width;
			return t.remove(), n;
		}), this.fente.style.width = `${this.largeurs[this.i] ?? 0}px`;
	}
	planifier() {
		clearTimeout(this.minuteur), !(!this.actif || !this.enVueNow || e() || this.detruit || this.mots.length < 2) && (this.minuteur = window.setTimeout(() => void this.rouler().then(() => this.planifier()), I(this.tempo)));
	}
	preparer() {
		this.finirRoulement();
		let e = (this.i + 1) % this.mots.length, t = z("cin-roule-mot cin-roule-entrant", this.mots[e]);
		this.fente.append(t), this.entrant = t;
		let n = {
			duration: I(this.duree),
			easing: He,
			fill: "both"
		};
		this.anims = [
			this.courant.animate([{ transform: "translateY(0px)" }, { transform: `translateY(calc(-100% - ${X}em))` }], n),
			t.animate([{ transform: `translateY(calc(100% + ${X}em))` }, { transform: "translateY(0px)" }], n),
			this.fente.animate([{ width: `${this.largeurs[this.i]}px` }, { width: `${this.largeurs[e]}px` }], n)
		];
		for (let e of this.anims) e.pause();
		return this.anims;
	}
	finirRoulement() {
		if (this.entrant) {
			for (let e of this.anims) e.cancel();
			this.anims = [], this.courant.remove(), this.courant = this.entrant, this.courant.classList.remove("cin-roule-entrant"), this.entrant = null, this.i = (this.i + 1) % this.mots.length, this.fente.style.width = `${this.largeurs[this.i]}px`;
		}
	}
	async rouler() {
		let e = this.preparer();
		for (let t of e) t.play();
		await Y(e) && this.finirRoulement();
	}
	jouer() {
		this.annulerSortie(), this.courant.getAnimations().forEach((e) => e.cancel()), this.actif ? e() || this.entrant || (clearTimeout(this.minuteur), this.rouler().then(() => this.planifier())) : (this.actif = !0, this.signal("debut", "entree"), this.planifier(), this.arrive());
	}
	sortir() {
		if (this.actif = !1, clearTimeout(this.minuteur), this.finirRoulement(), this.signal("debut", "sortie"), e()) return this.signal("fin", "sortie");
		Y([this.courant.animate([{ transform: `translateY(calc(-100% - ${X}em))` }], {
			duration: I(.42),
			easing: j,
			fill: "forwards"
		})]).then((e) => e && this.signal("fin", "sortie"));
	}
	aller(e) {
		clearTimeout(this.minuteur);
		let t = this.preparer();
		for (let n of t) n.currentTime = m(e) * I(this.duree);
	}
	cacher() {
		this.actif = !1, clearTimeout(this.minuteur), this.finirRoulement(), this.courant.getAnimations().forEach((e) => e.cancel());
	}
	enVue(e) {
		e ? this.planifier() : clearTimeout(this.minuteur);
	}
	invalider() {
		this.mesurer();
	}
	detruire() {
		clearTimeout(this.minuteur);
		for (let e of this.anims) e.cancel();
		this.el.replaceChildren(...this.origine), super.detruire();
	}
}, We = {
	surligneur: .6,
	souligne: .55,
	barre: .45,
	cadre: .8,
	cercle: .95
}, Ge = class extends J {
	type;
	svg;
	formes = [];
	anims = [];
	p = 1;
	graine;
	couleurAvant;
	constructor(e) {
		super(e), this.type = d(e.dataset.marque), this.graine = y(e.textContent ?? "", a.indexOf(this.type) + 11), this.couleurAvant = e.style.color, e.classList.add("cin-marque", `cin-marque-${this.type}`), this.svg = document.createElementNS(F, "svg"), this.svg.setAttribute("aria-hidden", "true"), this.svg.setAttribute("data-cin-calque", ""), this.svg.setAttribute("class", "cin-marque-svg"), e.append(this.svg), this.p = +!this.attend, this.dessiner(), this.brancher();
	}
	get duree() {
		return f(this.el.dataset.cinetiqueDuree, We[this.type], .05, 20);
	}
	dessiner() {
		this.svg.replaceChildren(), this.formes = [];
		let e = this.svg.getBoundingClientRect(), t = Number.parseFloat(getComputedStyle(this.el).fontSize) || 16, n = Array.from(this.el.getClientRects()).filter((e) => e.width > .5), r = this.type === "surligneur" ? "var(--marque-couleur, #ffe25a)" : this.type === "barre" ? "var(--marque-couleur, currentColor)" : "var(--marque-couleur, #ff4a2b)", i = n.reduce((e, t) => e + t.width, 0) || 1;
		n.forEach((n, a) => {
			let o = n.left - e.left, s = n.top - e.top, c = n.width, l = n.height, u = this.graine + a * 31, d = "", f = !1, p = .075 * t;
			switch (this.type) {
				case "surligneur":
					d = De(o - .08 * t, s + .3 * l, c + .16 * t, .58 * l, u), f = !0;
					break;
				case "souligne":
					d = we(o - .04 * t, s + .9 * l, o + c + .1 * t, s + .88 * l - .04 * t, u, .06 * t);
					break;
				case "barre":
					d = we(o - .06 * t, s + .56 * l, o + c + .06 * t, s + .53 * l, u, .03 * t), p = .065 * t;
					break;
				case "cadre":
					d = Ee(o - .16 * t, s + .02 * l, c + .32 * t, l * .98, u, .05 * t), p = .06 * t;
					break;
				case "cercle": d = Te(o + c / 2, s + l * .52, c / 2 + .5 * t, l / 2 + .2 * t, u), p = .065 * t;
			}
			let m = document.createElementNS(F, "path");
			m.setAttribute("d", d), f ? (m.style.fill = r, m.style.transformBox = "fill-box", m.style.transformOrigin = "0 50%") : (m.style.fill = "none", m.style.stroke = r, m.style.strokeWidth = `${g(p, 2)}px`, m.style.strokeLinecap = "round", m.style.strokeLinejoin = "round"), this.svg.append(m);
			let h = f ? 0 : m.getTotalLength();
			f || (m.style.strokeDasharray = `${h} ${h + 1}`), this.formes.push({
				el: m,
				L: h,
				part: c / i
			});
		}), this.poser(this.p);
	}
	poser(e) {
		this.p = e;
		let t = 0;
		for (let n of this.formes) {
			let r = m((e - t) / Math.max(1e-6, n.part));
			t += n.part, n.L ? n.el.style.strokeDashoffset = String(g(n.L * (1 - r), 2)) : n.el.style.transform = `scaleX(${g(r, 4)})`;
		}
	}
	animer(e, t, n) {
		for (let e of this.anims) e.cancel();
		this.anims = [];
		let r = this.type === "cercle" || this.type === "cadre" ? "cubic-bezier(0.45, 0, 0.25, 1)" : "cubic-bezier(0.3, 0, 0.2, 1)", i = n, a = e ? this.formes : [...this.formes].reverse();
		for (let n of a) {
			let a = t * n.part, o = n.L ? [{ strokeDashoffset: n.el.style.strokeDashoffset || "0" }, { strokeDashoffset: e ? "0" : String(n.L) }] : [{ transform: n.el.style.transform || "scaleX(1)" }, { transform: `scaleX(${e})` }];
			this.anims.push(n.el.animate(o, {
				duration: I(a),
				delay: I(i),
				easing: this.formes.length > 1 ? "cubic-bezier(0.4, 0, 0.6, 1)" : r,
				fill: "both"
			})), i += a;
		}
		return this.anims;
	}
	jouer() {
		this.annulerSortie(), this.signal("debut", "entree");
		let t = () => {
			for (let e of this.anims) e.cancel();
			this.anims = [], this.poser(1);
			let e = getComputedStyle(this.el).getPropertyValue("--marque-texte").trim();
			e && (this.el.style.color = e), this.arrive();
		};
		if (e()) return t();
		this.p >= 1 && this.poser(0), Y(this.animer(1, this.duree, this.delai)).then((e) => e && t());
	}
	sortir() {
		this.annulerSortie(), this.signal("debut", "sortie");
		let t = () => {
			for (let e of this.anims) e.cancel();
			this.anims = [], this.poser(0), this.el.style.color = this.couleurAvant, this.signal("fin", "sortie");
		};
		if (e()) return t();
		Y(this.animer(0, .35, 0)).then((e) => e && t());
	}
	aller(e) {
		for (let e of this.anims) e.cancel();
		this.anims = [], this.poser(m(e));
	}
	cacher() {
		this.aller(0), this.el.style.color = this.couleurAvant;
	}
	invalider() {
		this.anims.length || this.dessiner();
	}
	detruire() {
		for (let e of this.anims) e.cancel();
		this.svg.remove(), this.el.classList.remove("cin-marque", `cin-marque-${this.type}`), this.el.style.color = this.couleurAvant, B(this.el), super.detruire();
	}
}, Ke = class extends J {
	origine;
	lu;
	scene = null;
	anims = [];
	actif = !1;
	phase = 0;
	vitesse;
	incline;
	largeurVue = 0;
	constructor(e) {
		super(e), this.vitesse = f(e.dataset.defileVitesse, 80, 1, 5e3);
		let t = Number.parseFloat((e.dataset.defileIncline ?? "0").replace(",", "."));
		this.incline = Number.isFinite(t) ? h(t, -45, 45) : 0, this.origine = Array.from(e.childNodes), this.lu = z("cin-lu"), this.lu.setAttribute("data-cin-calque", ""), this.lu.append(...this.origine), e.classList.add("cin-defile"), e.replaceChildren(this.lu), this.construire(), this.brancher();
	}
	construire() {
		let e = this.el;
		this.phase = Number(this.anims[0]?.currentTime ?? this.phase);
		for (let e of this.anims) e.cancel();
		this.anims = [], this.scene?.remove();
		let t = e.dataset.defileSeparateur ?? " — ", n = this.origine.filter((e) => e instanceof Element), r = Math.round(f(e.dataset.defileRangs, 3, 1, 40)), i = n.length ? n : Array.from({ length: r }, () => (e.textContent ?? "").replace(/\s+/g, " ").trim()), a = document.createElement("div");
		a.className = "cin-defile-scene", a.setAttribute("aria-hidden", "true"), a.setAttribute("data-cin-calque", ""), e.append(a);
		let o = e.clientWidth || 1, s = this.incline * Math.PI / 180, c = i.map(() => {
			let e = document.createElement("div");
			return e.className = "cin-rang", a.append(e), e;
		}), l = () => a.getBoundingClientRect().height;
		i.forEach((e, n) => {
			let r = c[n], i = z("cin-piste"), a = z("cin-motif");
			a.append(typeof e == "string" ? document.createTextNode(e) : H(e, !0), z("cin-sep", t)), i.append(a), r.append(i);
		});
		let u = s ? o / Math.cos(s) + l() * Math.abs(Math.tan(s)) + 40 : o;
		if (s) {
			a.style.width = `${u}px`, a.style.marginLeft = `${-(u - o) / 2}px`, a.style.transform = `rotate(${this.incline}deg)`;
			let e = o / 2 * Math.abs(Math.sin(s));
			a.style.marginBlock = `${e}px`;
		}
		c.forEach((e, t) => {
			let n = e.firstElementChild, r = n.firstElementChild, i = r.getBoundingClientRect().width || 1, a = Math.ceil(u * 1.2 / i) + 1;
			for (let e = 1; e < a; e++) n.append(r.cloneNode(!0));
			let o = n.animate([{ transform: "translateX(0px)" }, { transform: `translateX(${-i}px)` }], {
				duration: I(i / this.vitesse),
				iterations: Infinity,
				easing: "linear",
				direction: t % 2 ? "reverse" : "normal"
			});
			o.pause(), o.currentTime = this.phase, this.anims.push(o);
		}), this.scene = a, this.largeurVue = o, this.appliquer();
	}
	appliquer() {
		let t = this.actif && this.enVueNow && !e();
		for (let e of this.anims) t ? e.play() : e.pause();
	}
	jouer() {
		this.actif = !0, this.signal("debut", "entree"), this.appliquer(), this.arrive();
	}
	sortir() {
		this.actif = !1, this.appliquer(), this.signal("fin", "sortie");
	}
	aller(e) {
		this.actif = !1;
		for (let t of this.anims) t.pause(), t.currentTime = m(e) * Number(t.effect?.getTiming().duration ?? 0);
	}
	cacher() {}
	enVue() {
		this.appliquer();
	}
	invalider(e) {
		!e && Math.abs(this.el.clientWidth - this.largeurVue) < .5 || this.construire();
	}
	detruire() {
		for (let e of this.anims) e.cancel();
		this.el.classList.remove("cin-defile"), B(this.el), this.el.replaceChildren(...this.origine), super.detruire();
	}
};
function qe(e, t) {
	let n = getComputedStyle(e), r = document.createElement("div");
	r.className = t, r.setAttribute("aria-hidden", "true"), r.setAttribute("data-cin-calque", "");
	let i = Number.parseFloat(n.borderLeftWidth) || 0, a = Number.parseFloat(n.borderTopWidth) || 0, o = e.getBoundingClientRect(), s = Number.parseFloat(n.paddingLeft) || 0, c = Number.parseFloat(n.paddingRight) || 0, l = Number.parseFloat(n.paddingTop) || 0, u = Number.parseFloat(n.paddingBottom) || 0, d = Number.parseFloat(n.borderRightWidth) || 0, f = Number.parseFloat(n.borderBottomWidth) || 0;
	r.style.left = `${s}px`, r.style.top = `${l}px`, r.style.width = `${o.width - i - d - s - c}px`, r.style.height = `${o.height - a - f - l - u}px`;
	for (let t of Array.from(e.childNodes)) V(t) || r.append(t instanceof Element ? H(t, !0) : t.cloneNode(!0));
	return e.append(r), r;
}
var Je = class extends J {
	calque = null;
	anim = null;
	posPerso = !1;
	constructor(e) {
		super(e), this.brancher();
	}
	get duree() {
		return f(this.el.dataset.cinetiqueDuree, 1.4, .1, 20);
	}
	poser() {
		this.enlever(), getComputedStyle(this.el).position === "static" && (this.el.style.position = "relative", this.posPerso = !0);
		let e = qe(this.el, "cin-reflet-calque");
		return e.style.backgroundImage = "linear-gradient(105deg, transparent 0%, transparent 45.5%, var(--reflet-couleur, rgba(255, 255, 255, 0.92)) 50%, transparent 54.5%, transparent 100%)", this.calque = e, this.anim = e.animate([{ backgroundPosition: "100% 0" }, { backgroundPosition: "0% 0" }], {
			duration: I(this.duree),
			delay: I(this.delai),
			easing: "cubic-bezier(0.45, 0, 0.25, 1)",
			fill: "both"
		}), this.anim.pause(), this.anim;
	}
	enlever() {
		this.anim?.cancel(), this.anim = null, this.calque?.remove(), this.calque = null, this.posPerso &&= (this.el.style.position = "", !1), B(this.el);
	}
	jouer() {
		if (this.annulerSortie(), this.signal("debut", "entree"), e()) return this.arrive();
		let t = this.poser();
		t.play(), Y([t]).then((e) => {
			e && this.anim === t && (this.enlever(), this.arrive());
		});
	}
	sortir() {
		this.enlever();
	}
	aller(e) {
		if (e >= 1 || e <= 0) return this.enlever();
		let t = this.poser();
		t.currentTime = I(this.delai) + m(e) * I(this.duree);
	}
	cacher() {
		this.enlever();
	}
	detruire() {
		this.enlever(), super.detruire();
	}
}, Ye = 0, Xe = class extends J {
	origine;
	boite = null;
	svg = null;
	tour = null;
	entree = null;
	actif = !1;
	texte;
	id = `cin-cercle-${++Ye}`;
	constructor(e) {
		super(e), this.texte = (e.textContent ?? "").replace(/\s+/g, " ").trim(), this.origine = Array.from(e.childNodes), this.construire(!0), this.brancher();
	}
	construire(t = !1) {
		let n = this.el, r = Number(this.tour?.currentTime ?? 0);
		this.tour?.cancel();
		let i = z("cin-lu");
		i.setAttribute("data-cin-calque", "");
		let a = z("cin-roule-mesure", this.texte);
		n.append(a), this.largeurTexte = a.getBoundingClientRect().width, a.remove(), i.append(...this.origine);
		let o = Number.parseFloat(getComputedStyle(n).fontSize) || 16, s = f(n.dataset.cercleRayon, Math.max(this.largeurTexte / (2 * Math.PI), 2 * o), 4, 5e3), c = 2 * (s + o * 1.1), l = c / 2, u = document.createElementNS(F, "svg");
		u.setAttribute("class", "cin-cercle-svg"), u.setAttribute("width", String(g(c, 2))), u.setAttribute("height", String(g(c, 2))), u.setAttribute("viewBox", `0 0 ${g(c, 2)} ${g(c, 2)}`);
		let d = document.createElementNS(F, "path");
		d.setAttribute("id", this.id), d.setAttribute("fill", "none"), d.setAttribute("d", `M ${g(l, 2)} ${g(l - s, 2)} a ${g(s, 2)} ${g(s, 2)} 0 1 1 0 ${g(2 * s, 2)} a ${g(s, 2)} ${g(s, 2)} 0 1 1 0 ${g(-2 * s, 2)}`);
		let p = document.createElementNS(F, "text");
		p.setAttribute("fill", "currentColor");
		let m = document.createElementNS(F, "textPath");
		m.setAttribute("href", `#${this.id}`), m.setAttribute("textLength", String(g(2 * Math.PI * s - .5, 2))), m.setAttribute("lengthAdjust", "spacing"), m.textContent = this.texte, p.append(m), u.append(d, p);
		let h = z("cin-cercle-boite");
		h.setAttribute("aria-hidden", "true"), h.setAttribute("data-cin-calque", ""), h.append(u), n.replaceChildren(i, h), this.boite = h, this.svg = u;
		let _ = Number.parseFloat((n.dataset.cercleVitesse ?? "18").replace(",", ".")), v = Number.isFinite(_) && _ !== 0 ? _ : 18;
		u.style.transformOrigin = "50% 50%", this.tour = u.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
			duration: I(360 / Math.abs(v)),
			iterations: Infinity,
			easing: "linear",
			direction: v < 0 ? "reverse" : "normal"
		}), this.tour.pause(), this.tour.currentTime = r, t && this.attend && !e() && (h.style.opacity = "0"), this.appliquer();
	}
	largeurTexte = 0;
	appliquer() {
		this.actif && this.enVueNow && !e() ? this.tour?.play() : this.tour?.pause();
	}
	jouer() {
		this.annulerSortie(), this.actif = !0, this.signal("debut", "entree"), this.appliquer();
		let t = this.boite;
		if (e()) return t.style.opacity = "", this.arrive();
		this.entree?.cancel(), this.entree = t.animate([{
			opacity: 0,
			transform: "scale(0.86) rotate(-40deg)"
		}, {
			opacity: 1,
			transform: "scale(1) rotate(0deg)"
		}], {
			duration: I(f(this.el.dataset.cinetiqueDuree, .9, .05, 20)),
			delay: I(this.delai),
			easing: A,
			fill: "both"
		}), t.style.opacity = "", Y([this.entree]).then((e) => {
			e && (this.entree?.cancel(), this.entree = null, this.arrive());
		});
	}
	sortir() {
		this.actif = !1, this.appliquer(), this.signal("fin", "sortie");
	}
	aller(e) {
		this.actif = !1, this.entree?.cancel(), this.boite.style.opacity = "", this.tour?.pause(), this.tour && (this.tour.currentTime = m(e) * Number(this.tour.effect?.getTiming().duration ?? 0));
	}
	cacher() {
		this.actif = !1, this.appliquer(), !e() && this.boite && (this.boite.style.opacity = "0");
	}
	enVue() {
		this.appliquer();
	}
	invalider(e) {
		e && this.construire();
	}
	detruire() {
		this.tour?.cancel(), this.entree?.cancel(), this.el.replaceChildren(...this.origine), super.detruire();
	}
}, Ze = class extends J {
	origine = null;
	haut = null;
	bas = null;
	anims = [];
	etat = "repos";
	largeurVue = 0;
	constructor(e) {
		super(e), this.attend && this.cacher(), this.brancher();
	}
	get duree() {
		return f(this.el.dataset.cinetiqueDuree, .9, .05, 20);
	}
	fendre() {
		this.restaurer();
		let e = this.el;
		this.origine = Array.from(e.childNodes);
		let t = z("cin-lu");
		t.setAttribute("data-cin-calque", "");
		let n = z("cin-coupe-env");
		n.setAttribute("aria-hidden", "true"), n.setAttribute("data-cin-calque", "");
		let r = (e) => {
			let t = z(`cin-coupe-moitie ${e}`);
			for (let e of this.origine) V(e) || t.append(e instanceof Element ? H(e, !0) : e.cloneNode(!0));
			return t;
		}, i = r("cin-coupe-haut"), a = r("cin-coupe-bas");
		n.append(i, a), t.append(...this.origine), e.replaceChildren(t, n);
		let o = document.createRange();
		o.selectNodeContents(i);
		let s = i.getBoundingClientRect(), c = Array.from(o.getClientRects()).filter((e) => e.width > .5), l = ce(c), u = [];
		c.forEach((e, t) => {
			let n = l[t], r = u[n] ??= {
				top: Infinity,
				bottom: -Infinity
			};
			r.top = Math.min(r.top, e.top - s.top), r.bottom = Math.max(r.bottom, e.bottom - s.top);
		});
		let d = -4e3, f = s.width + 4e3, p = "", m = "";
		u.forEach((e, t) => {
			let n = t > 0 ? (u[t - 1].bottom + e.top) / 2 : -4e3, r = t < u.length - 1 ? (e.bottom + u[t + 1].top) / 2 : s.height + 4e3, i = e.top + .53 * (e.bottom - e.top);
			p += `M ${d} ${P(n)} H ${P(f)} V ${P(i)} H ${d} Z `, m += `M ${d} ${P(i)} H ${P(f)} V ${P(r)} H ${d} Z `;
		}), u.length || (p = m = `M ${d} -4000 H ${P(f)} V ${P(s.height + 4e3)} H ${d} Z`), i.style.clipPath = `path("${p.trim()}")`, a.style.clipPath = `path("${m.trim()}")`, this.haut = i, this.bas = a, this.largeurVue = e.clientWidth;
	}
	restaurer() {
		for (let e of this.anims) e.cancel();
		this.anims = [], this.origine && this.el.replaceChildren(...this.origine), this.origine = null, this.haut = this.bas = null, this.etat = "repos";
	}
	construire(e) {
		for (let e of this.anims) e.cancel();
		let t = "0.9em", n = {
			duration: I(this.duree),
			delay: I(this.delai),
			easing: "cubic-bezier(0.12, 0.9, 0.2, 1)",
			fill: "both"
		};
		this.anims = [this.haut.animate([
			{
				transform: `translateX(-${t})`,
				opacity: 0
			},
			{
				offset: .25,
				opacity: 1
			},
			{
				transform: "translateX(0em)",
				opacity: 1
			}
		], n), this.bas.animate([
			{
				transform: `translateX(${t})`,
				opacity: 0
			},
			{
				offset: .25,
				opacity: 1
			},
			{
				transform: "translateX(0em)",
				opacity: 1
			}
		], n)];
		for (let t of this.anims) t.pause(), t.currentTime = e;
	}
	jouer() {
		if (this.annulerSortie(), e()) return this.restaurer(), this.arrive();
		if (this.etat === "entre") return;
		this.etat !== "cache" && this.etat !== "suspendu" && (this.fendre(), this.construire(0)), this.etat = "entre", this.signal("debut", "entree");
		for (let e of this.anims) e.play();
		let t = this.anims;
		Y(t).then((e) => {
			e && t === this.anims && (this.restaurer(), this.arrive());
		});
	}
	sortir() {
		if (this.annulerSortie(), this.etat === "sort" || this.etat === "sorti") return;
		if (e()) return this.signal("fin", "sortie");
		this.haut || this.fendre();
		for (let e of this.anims) {
			try {
				e.commitStyles();
			} catch {}
			e.cancel();
		}
		let t = {
			duration: I(.45),
			easing: j,
			fill: "forwards"
		};
		this.anims = [this.haut.animate([{
			transform: "translateX(-0.9em)",
			opacity: 0
		}], t), this.bas.animate([{
			transform: "translateX(0.9em)",
			opacity: 0
		}], t)], this.etat = "sort", this.signal("debut", "sortie");
		let n = this.anims;
		Y(n).then((e) => {
			e && n === this.anims && (this.etat = "sorti", this.signal("fin", "sortie"));
		});
	}
	aller(t) {
		if (t = m(t), t >= 1 || e()) return this.restaurer();
		this.fendre(), this.construire(I(this.delai) + t * I(this.duree)), this.etat = t <= 0 ? "cache" : "suspendu";
	}
	cacher() {
		if (e()) return this.restaurer();
		this.fendre(), this.construire(0), this.etat = "cache";
	}
	invalider(e) {
		if (!this.haut || !e && Math.abs(this.el.clientWidth - this.largeurVue) < .5) return;
		let t = Number(this.anims[0]?.currentTime ?? 0), n = this.etat;
		(n === "cache" || n === "suspendu" || n === "entre") && (this.fendre(), this.construire(t), this.etat = n === "entre" ? "suspendu" : n, n === "entre" && this.jouer());
	}
	detruire() {
		this.restaurer(), super.detruire();
	}
};
function Z(e, t, n) {
	let r = 0, i = -1, a = (o) => {
		i < 0 && (i = o);
		let s = (o - i) / 1e3;
		if (t(Math.min(s, e)), s >= e) return n();
		r = requestAnimationFrame(a);
	};
	return r = requestAnimationFrame(a), () => cancelAnimationFrame(r);
}
var Qe = class extends J {
	d = null;
	lettres = [];
	stop = null;
	graine;
	largeurVue = 0;
	p = 1;
	constructor(e) {
		super(e), this.graine = y(e.textContent ?? "", 5), this.attend && this.cacher(), this.brancher();
	}
	get duree() {
		return f(this.el.dataset.cinetiqueDuree, 1.2, .05, 30);
	}
	fendre() {
		this.d?.restaurer(), this.d = new U(this.el, "lettre", !1, "cin-brouille cin-centre"), this.lettres = this.d.atomes.map((e) => e.texte), this.largeurVue = this.el.clientWidth;
	}
	poser(e) {
		this.p = e, this.d || this.fendre();
		let t = Ce(this.lettres, e, this.graine, Math.floor(e * this.duree * 18));
		this.d.atomes.forEach((e, n) => {
			let r = t[n];
			e.texte && (e.p.textContent !== r.t && (e.p.textContent = r.t), e.p.style.opacity = r.vu ? "" : "0");
		});
	}
	arreter() {
		this.stop?.(), this.stop = null;
	}
	restaurer() {
		this.arreter(), this.d?.restaurer(), this.d = null, this.p = 1;
	}
	jouer() {
		if (this.annulerSortie(), this.arreter(), e()) return this.restaurer(), this.arrive();
		this.fendre(), this.signal("debut", "entree");
		let t = this.duree, n = this.delai;
		this.poser(0), this.stop = Z(n + t, (e) => this.poser(m((e - n) / t)), () => {
			this.restaurer(), this.arrive();
		});
	}
	sortir() {
		if (this.annulerSortie(), this.arreter(), e()) return;
		this.d || this.fendre();
		let t = this.p, n = this.duree * .6 * t;
		this.signal("debut", "sortie"), this.stop = Z(n, (e) => this.poser(t * (1 - e / Math.max(1e-6, n))), () => {
			this.poser(0), this.stop = null, this.signal("fin", "sortie");
		});
	}
	aller(t) {
		if (this.arreter(), t = m(t), t >= 1 || e()) return this.restaurer();
		this.fendre(), this.poser(t);
	}
	cacher() {
		this.aller(0);
	}
	invalider(e) {
		if (!this.d || !e && Math.abs(this.el.clientWidth - this.largeurVue) < .5) return;
		let t = this.p;
		this.fendre(), this.poser(t);
	}
	detruire() {
		this.restaurer(), super.detruire();
	}
}, $e = class extends J {
	d = null;
	temps = [];
	total = 0;
	curseur = null;
	clignote = null;
	stop = null;
	posPerso = !1;
	graine;
	t = 0;
	minuteurFin = 0;
	constructor(e) {
		super(e), this.graine = y(e.textContent ?? "", 9), this.attend && this.cacher(), this.brancher();
	}
	fendre() {
		this.d?.restaurer(), this.d = new U(this.el, "glyphe", !1, "cin-frappe");
		let e = this.d.atomes.map((e) => e.texte);
		this.temps = be(e, this.graine, f(this.el.dataset.frappeVitesse, 16, 1, 200));
		let t = (this.temps[this.temps.length - 1] ?? 0) + .05, n = f(this.el.dataset.cinetiqueDuree, t, .05, 120), r = t > 0 ? n / t : 1;
		if (this.temps = this.temps.map((e) => e * r), this.total = n, !this.curseur) {
			getComputedStyle(this.el).position === "static" && (this.el.style.position = "relative", this.posPerso = !0);
			let e = z("cin-curseur");
			e.setAttribute("aria-hidden", "true"), e.setAttribute("data-cin-calque", ""), this.curseur = e;
		}
		this.el.append(this.curseur);
	}
	poser(e) {
		this.t = e, this.d || this.fendre();
		let t = this.d.atomes, n = 0;
		t.forEach((t, r) => {
			let i = (this.temps[r] ?? 0) <= e && e > 0;
			i && (n = r + 1), t.p.style.visibility = i ? "" : "hidden";
		});
		let r = this.curseur, i = this.el.getBoundingClientRect(), a = n > 0 ? t[n - 1] : t[0];
		if (!a) return;
		let o = a.p.getBoundingClientRect(), s = (n > 0 ? o.right : o.left) - i.left - this.el.clientLeft, c = o.top - i.top - this.el.clientTop;
		r.style.height = `${o.height}px`, r.style.transform = `translate(${g(s, 2)}px, ${g(c, 2)}px)`;
	}
	clignoter(t) {
		this.clignote?.cancel(), this.clignote = null, t && this.curseur && !e() && (this.clignote = this.curseur.animate([
			{ opacity: 1 },
			{
				opacity: 1,
				offset: .5
			},
			{
				opacity: 0,
				offset: .5
			},
			{ opacity: 0 }
		], {
			duration: 1e3,
			iterations: Infinity
		}));
	}
	arreter() {
		this.stop?.(), this.stop = null, clearTimeout(this.minuteurFin);
	}
	restaurer() {
		this.arreter(), this.clignoter(!1), this.curseur?.remove(), this.curseur = null, this.d?.restaurer(), this.d = null, this.posPerso &&= (this.el.style.position = "", !1), B(this.el);
	}
	jouer() {
		if (this.annulerSortie(), this.arreter(), e()) return this.restaurer(), this.arrive();
		this.fendre(), this.curseur && (this.curseur.style.opacity = ""), this.signal("debut", "entree"), this.poser(0), this.clignoter(!0);
		let t = this.delai;
		this.stop = Z(t + this.total, (e) => {
			e > t && this.clignote && this.clignoter(!1), this.poser(Math.max(0, e - t));
		}, () => {
			this.stop = null, this.poser(this.total + 1), this.clignoter(!0), this.minuteurFin = window.setTimeout(() => {
				this.restaurer(), this.arrive();
			}, 1600);
		});
	}
	sortir() {
		if (this.annulerSortie(), this.arreter(), e()) return;
		this.d || (this.fendre(), this.poser(this.total + 1));
		let t = Math.min(this.t, this.total), n = t / 3;
		this.signal("debut", "sortie"), this.clignoter(!1), this.stop = Z(n, (e) => this.poser(Math.max(0, t - e * 3)), () => {
			this.stop = null, this.poser(0), this.clignoter(!0), this.signal("fin", "sortie");
		});
	}
	aller(t) {
		if (this.arreter(), t = m(t), t >= 1 || e()) return this.restaurer();
		this.fendre(), this.clignoter(!1), this.poser(t * this.total);
	}
	cacher() {
		if (this.arreter(), e()) return this.restaurer();
		this.fendre(), this.clignoter(!1), this.poser(0), this.curseur && (this.curseur.style.opacity = "0");
	}
	invalider() {
		this.d && this.poser(this.t);
	}
	detruire() {
		this.restaurer(), super.detruire();
	}
}, Q = "[data-cinetique],[data-roule],[data-marque],[data-defile],[data-reflet],[data-cercle],[data-coupe],[data-brouille],[data-frappe]", et = (e) => !!e.closest("[data-cin-copie],[data-cin-calque]");
function $(e) {
	let t = W.get(e);
	if (t) return t;
	if (et(e)) return null;
	let n = e.dataset;
	return n.cinetique === void 0 ? n.roule === void 0 ? n.marque === void 0 ? n.defile === void 0 ? n.reflet === void 0 ? n.cercle === void 0 ? n.coupe === void 0 ? n.brouille === void 0 ? n.frappe === void 0 ? null : new $e(e) : new Qe(e) : new Ze(e) : new Xe(e) : new Je(e) : new Ke(e) : new Ge(e) : new Ue(e) : s(n.cinetique) ? new Ve(e) : null;
}
function tt() {
	if (ze || !L()) return;
	ze = !0, ke(), G = new IntersectionObserver((e) => {
		for (let t of e) t.isIntersecting && W.get(t.target)?.visible();
	}, { rootMargin: "0px 0px -15% 0px" }), K = new IntersectionObserver((e) => {
		for (let t of e) W.get(t.target)?.vue(t.isIntersecting, !t.isIntersecting && t.boundingClientRect.top > 0);
	});
	let e = 0;
	q = new ResizeObserver(() => {
		cancelAnimationFrame(e), e = requestAnimationFrame(() => {
			for (let e of W.values()) e.invalider(!1);
		});
	});
	let t = () => {
		for (let e of W.values()) e.invalider(!0);
	};
	document.fonts?.ready.then(t), document.fonts?.addEventListener?.("loadingdone", t), Re = new MutationObserver((e) => {
		for (let t of e) if (t.type === "childList") {
			for (let e of t.addedNodes) e instanceof HTMLElement && !et(e) && (e.matches(Q) && $(e), e.querySelectorAll(Q).forEach((e) => $(e)));
			for (let e of t.removedNodes) if (e instanceof HTMLElement) for (let [t, n] of W) !t.isConnected && (e === t || e.contains(t)) && n.detruire();
		}
	}), Re.observe(document.body, {
		childList: !0,
		subtree: !0
	});
}
function nt(e = document) {
	L() && (tt(), e instanceof HTMLElement && e.matches(Q) && $(e), e.querySelectorAll(Q).forEach((e) => $(e)));
}
//#endregion
export { nt as initCinetique };
