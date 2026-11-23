import { n as e, t } from "./look-BnXlF57J.js";
import { n, t as r } from "./tokens-Nj0c2PcI.js";
// src/state.ts
var i = [
	"impression",
	"trame",
	"quadri",
	"buvard",
	"massicot",
	"fondu",
	"rouleau",
	"composition",
	"ligne",
	"revelateur",
	"pli",
	"aucune",
	"tri"
];
typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
// src/gpu/slide-transition.ts
var a = [
	"enchaine",
	"feuille",
	"bavure",
	"mosaique",
	"fonte",
	"onde",
	"portes",
	"points",
	"vague",
	"zoom",
	"tranches",
	"parasite",
	"pile",
	"foyer",
	"bascule",
	"prisme",
	"sable",
	"rayons",
	"marbrure"
], o = (e) => e <= .04045 ? e / 12.92 : ((e + .055) / 1.055) ** 2.4, s = (e) => e <= .0031308 ? 12.92 * e : 1.055 * e ** (1 / 2.4) - .055;
function c([e, t, n]) {
	let r = t * Math.cos(n * Math.PI / 180), i = t * Math.sin(n * Math.PI / 180), a = (e + .3963377774 * r + .2158037573 * i) ** 3, o = (e - .1055613458 * r - .0638541728 * i) ** 3, s = (e - .0894841775 * r - 1.291485548 * i) ** 3;
	return [
		4.0767416621 * a - 3.3077115913 * o + .2309699292 * s,
		-1.2684380046 * a + 2.6097574011 * o - .3413193965 * s,
		-.0041960863 * a - .7034186147 * o + 1.707614701 * s
	];
}
var l = (e, t = 1e-4) => e.every((e) => e >= -t && e <= 1 + t);
function u(e) {
	let t = Math.min(1, Math.max(0, e[0])), n = c([
		t,
		e[1],
		e[2]
	]);
	if (!l(n)) {
		let r = 0, i = e[1];
		for (let n = 0; n < 24; n++) {
			let n = (r + i) / 2;
			l(c([
				t,
				n,
				e[2]
			])) ? r = n : i = n;
		}
		n = c([
			t,
			r,
			e[2]
		]);
	}
	return n.map((e) => s(Math.min(1, Math.max(0, e))));
}
var d = (e) => "#" + e.map((e) => Math.round(Math.min(1, Math.max(0, e)) * 255).toString(16).padStart(2, "0")).join("");
function f(e) {
	let t = /^#?([0-9a-f]{6})$/i.exec(e.trim());
	if (!t) throw Error(`couleur illisible : ${e}`);
	let n = Number.parseInt(t[1], 16);
	return [
		(n >> 16 & 255) / 255,
		(n >> 8 & 255) / 255,
		(n & 255) / 255
	];
}
var p = (e) => d(u(e)), m = ([e, t, n]) => .2126 * o(e) + .7152 * o(t) + .0722 * o(n);
function h(e, t) {
	let n = (e) => f(e), [r, i] = [m(n(e)), m(n(t))].sort((e, t) => t - e);
	return (r + .05) / (i + .05);
}
function g(e, n) {
	let r = t[n];
	if (!r) return e;
	let [i, a, o] = e;
	if (r.saturate !== void 0 && r.saturate !== 1) {
		let e = r.saturate, t = (.213 + .787 * e) * i + (.715 - .715 * e) * a + (.072 - .072 * e) * o, n = (.213 - .213 * e) * i + (.715 + .285 * e) * a + (.072 - .072 * e) * o, s = (.213 - .213 * e) * i + (.715 - .715 * e) * a + (.072 + .928 * e) * o;
		[i, a, o] = [
			t,
			n,
			s
		].map((e) => Math.min(1, Math.max(0, e)));
	}
	if (r.curves) {
		let e = r.curves.map(ee);
		[i, a, o] = [
			_(e[0], i),
			_(e[1], a),
			_(e[2], o)
		];
	}
	return [
		i,
		a,
		o
	];
}
var ee = ([e, t, n]) => Array.from({ length: 33 }, (r, i) => +(e + (n - e) * (i / 32) ** t).toFixed(4));
function _(e, t) {
	let n = e.length - 1, r = Math.min(n - 1, Math.floor(t * n));
	return e[r] + (t * n - r) * (e[r + 1] - e[r]);
}
function te(e, t, n) {
	return h(d(g(f(e), n)), d(g(f(t), n)));
}
var v = (e, t) => Math.round(e * 10 ** t) / 10 ** t + 0, y = ([e, t, n]) => [
	v(Math.min(1, Math.max(0, e)), 4),
	v(Math.max(0, t), 4),
	v((n % 360 + 360) % 360, 2)
];
function b(e, t, n = "neutre") {
	let r = p(e), i = Infinity;
	for (let e of t) {
		let t = p(e);
		i = Math.min(i, h(r, t), te(r, t, n));
	}
	return i;
}
function x(e, t, n, r = "neutre") {
	let i = (e) => b(e, t, r) >= n, a = y(e);
	if (i(a)) return {
		couleur: a,
		ajuste: !1
	};
	let o = t.reduce((e, t) => e + t[0], 0) / Math.max(1, t.length);
	for (let e of o >= .6 ? [0, 1] : [1, 0]) {
		let t = a[0];
		for (let n = 1; n <= 48; n++) {
			let r = a[0] + (e - a[0]) * n / 48;
			if (i(y([
				r,
				a[1],
				a[2]
			]))) {
				let e = t, n = r;
				for (let t = 0; t < 18; t++) {
					let t = (e + n) / 2;
					i(y([
						t,
						a[1],
						a[2]
					])) ? n = t : e = t;
				}
				return {
					couleur: y([
						n,
						a[1],
						a[2]
					]),
					ajuste: !0
				};
			}
			t = r;
		}
	}
	let s = [
		0,
		0,
		0
	], c = [
		1,
		0,
		0
	];
	return {
		couleur: b(s, t, r) >= b(c, t, r) ? s : c,
		ajuste: !0
	};
}
function S(e, t, n) {
	let r = (e) => [
		e[0],
		e[1] * Math.cos(e[2] * Math.PI / 180),
		e[1] * Math.sin(e[2] * Math.PI / 180)
	], [i, a, o] = r(e), [s, c, l] = r(t), u = i + (s - i) * n, d = a + (c - a) * n, f = o + (l - o) * n, p = Math.atan2(f, d) * 180 / Math.PI;
	return p < 0 && (p += 360), [
		u,
		Math.hypot(d, f),
		p
	];
}
// src/presse/variations.ts
var C = [
	"analogue",
	"complementaire",
	"scindee",
	"triade",
	"tetrade",
	"monochrome"
], ne = {
	analogue: [
		0,
		32,
		-32
	],
	complementaire: [
		0,
		180,
		20
	],
	scindee: [
		0,
		150,
		210
	],
	triade: [
		0,
		120,
		240
	],
	tetrade: [
		0,
		90,
		180
	],
	monochrome: [
		0,
		0,
		0
	]
}, w = {
	archivo: {
		nom: "Archivo",
		pile: "\"Archivo Variable\", Arial, sans-serif",
		graisses: [100, 900],
		largeur: !0,
		titre: !0,
		texte: !0
	},
	bodoni: {
		nom: "Bodoni Moda",
		pile: "\"Bodoni Moda Variable\", \"Bodoni 72\", Georgia, serif",
		graisses: [400, 900],
		largeur: !1,
		titre: !0,
		texte: !1
	},
	cormorant: {
		nom: "Cormorant Garamond",
		pile: "\"Cormorant Garamond\", Garamond, Georgia, serif",
		graisses: [400, 700],
		largeur: !1,
		titre: !0,
		texte: !0
	},
	plex: {
		nom: "IBM Plex Mono",
		pile: "\"IBM Plex Mono\", ui-monospace, monospace",
		graisses: [400, 600],
		largeur: !1,
		titre: !0,
		texte: !0
	}
}, T = Object.keys(w), re = [
	1.125,
	1.2,
	1.25,
	1.333,
	1.414,
	1.5,
	1.618
], E = {
	out: n.out,
	inOut: n.inOut,
	ressort: "",
	net: "cubic-bezier(0.2, 0, 0, 1)"
}, ie = [
	"sobre",
	"normal",
	"expressif"
], ae = i.filter((e) => e !== "aucune"), D = a, O = Object.keys(t), k = [
	"loupe",
	"rvb",
	"trame",
	"bloom",
	"grain",
	"courbure"
], A = 4.5;
function j(e) {
	let t = e >>> 0;
	return () => {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function M(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t = Math.imul(t ^ e.charCodeAt(n), 16777619);
	return t >>> 0;
}
var N = (e, t) => j(M(`${e >>> 0}:${t}`)), P = (e, t, n) => t + (n - t) * e(), F = (e, t) => t[Math.floor(e() * t.length) % t.length], I = (e, t) => {
	let n = t.reduce((e, [, t]) => e + t, 0), r = e() * n;
	for (let [e, n] of t) if ((r -= n) < 0) return e;
	return t[t.length - 1][0];
}, L = (e, t = 3) => Math.round(e * 10 ** t) / 10 ** t + 0, R = (e, t, n) => Math.min(n, Math.max(t, e)), z = (e) => (e % 360 + 360) % 360;
function oe(e, t) {
	let n = t.sombre ?? e() < .3, r = t.harmonie ?? F(e, C), i = L(z(t.teinte ?? e() * 360), 2), a = t.accents ?? I(e, [
		[1, 2],
		[2, 3],
		[3, 2]
	]), o = ne[r], s = z(i + (e() < .5 ? 0 : 180) + P(e, -12, 12)), c = n ? [
		P(e, .14, .23),
		P(e, .006, .035),
		s
	] : [
		P(e, .935, .985),
		P(e, .004, .03),
		s
	], l = n ? [
		P(e, .9, .97),
		P(e, .005, .03),
		i
	] : [
		P(e, .14, .3),
		P(e, .01, .05),
		i
	], u = [];
	for (let t = 0; t < a; t++) {
		let a = z(i + o[t] + P(e, -8, 8));
		r === "monochrome" ? u.push(n ? [
			P(e, .62, .86),
			P(e, .06, .16),
			a
		] : [
			P(e, .38, .62),
			P(e, .06, .16),
			a
		]) : u.push(n ? [
			P(e, .66, .82),
			P(e, .09, .19),
			a
		] : [
			P(e, .45, .62),
			P(e, .1, .21),
			a
		]);
	}
	let d = P(e, .02, .045), f = d + P(e, .025, .05), p = n ? 1 : -1;
	return {
		harmonie: r,
		sombre: n,
		teinte: i,
		brut: {
			harmonie: r,
			sombre: n,
			teinte: i,
			papier: c,
			encre: l,
			accents: u,
			surfaces: [[
				c[0] + p * d,
				c[1] + .006,
				c[2]
			], [
				c[0] + p * f,
				c[1] + .012,
				c[2]
			]]
		}
	};
}
function se(e, t = "neutre", n = A) {
	let r = y(e.papier), i = e.surfaces.map(y), a = [r, ...i], o = [], s = x(e.encre, a, Math.max(n, A), t);
	s.ajuste && o.push("encre");
	let c = e.accents.slice(0, 3).map((e, r) => {
		let i = x(e, a, r === 0 ? Math.max(n, A) : 3, t);
		return i.ajuste && o.push(`accent ${r + 1}`), i.couleur;
	});
	return c.length || c.push(x([
		.5,
		.15,
		e.teinte
	], a, n, t).couleur), {
		palette: {
			harmonie: e.harmonie,
			sombre: e.sombre,
			teinte: L(z(e.teinte), 2),
			papier: r,
			encre: s.couleur,
			accents: c,
			surfaces: i
		},
		retouches: o
	};
}
function ce(e, t) {
	let n = I(e, (t.titres?.length ? t.titres : T.filter((e) => w[e].titre)).map((e) => [e, e === "plex" ? 1 : 3])), r = (t.textes?.length ? t.textes : T.filter((e) => w[e].texte)).filter((e) => w[e].texte), i = I(e, (r.length ? r : ["archivo"]).map((e) => [e, e === "archivo" ? 3 : e === n ? 2 : 1])), [a, o] = w[n].graisses, s = Math.round(P(e, Math.max(a, n === "archivo" ? 500 : a), o) / 50) * 50, c = i === "cormorant" ? 500 : i === "archivo" ? F(e, [
		350,
		400,
		400,
		450
	]) : 400, l = n === "plex" ? e() < .6 : n === "archivo" ? e() < .28 : e() < .06;
	return {
		titre: n,
		texte: i,
		rapport: F(e, re),
		base: Math.round(P(e, 15, 19.99)),
		graisseTitre: s,
		graisseTexte: c,
		largeur: n === "archivo" ? Math.round(P(e, 62, 125)) : 100,
		interlignage: L(P(e, 1.4, 1.7), 2),
		interlignageTitre: L(l ? P(e, .88, 1.02) : P(e, .92, 1.12), 2),
		approche: L(l ? P(e, -.01, .03) : P(e, -.045, .005), 3),
		capitales: l
	};
}
function le(e) {
	return {
		espace: Math.round(P(e, 4, 10.99)),
		rayon: I(e, [
			[0, 3],
			[2, 2],
			[4, 2],
			[8, 2],
			[12, 2],
			[18, 1],
			[28, 1]
		]),
		filet: I(e, [
			[1, 4],
			[2, 2],
			[0, 1]
		]),
		ombre: L(I(e, [
			[0, 4],
			[.3, 2],
			[.6, 2],
			[1, 1]
		]), 2)
	};
}
function ue(e) {
	return {
		echelle: L(P(e, .7, 1.5), 2),
		courbe: I(e, [
			["out", 4],
			["inOut", 2],
			["ressort", 2],
			["net", 2]
		]),
		transitionPage: F(e, ae),
		transitionDiapo: F(e, D),
		intensite: I(e, [
			["sobre", 2],
			["normal", 3],
			["expressif", 2]
		])
	};
}
function B(e, n) {
	let r = F(e, n.looks?.length ? n.looks.filter((e) => t[e]) : O), i = t[r] ?? t.neutre, a = ["loupe", ...k.filter((t) => t !== "loupe" && e() < (t === "bloom" || t === "grain" ? .55 : .22))];
	return {
		nom: r,
		grain: L(R(i.grain + P(e, -.02, .025), 0, .12), 3),
		vignette: L(R(i.vignette + P(e, -.1, .1), 0, .6), 2),
		effets: a
	};
}
var de = [
	"Atlas",
	"Gazette",
	"Rotative",
	"Galerie",
	"Carnet",
	"Revue",
	"Affiche",
	"Manifeste",
	"Herbier",
	"Archive",
	"Fanzine",
	"Chronique"
], fe = [
	"brûlé",
	"salé",
	"nocturne",
	"poudré",
	"minéral",
	"solaire",
	"givré",
	"fauve",
	"lunaire",
	"marin",
	"boréal",
	"cuivré"
], V = (e) => {
	let t = j(M(`nom:${e >>> 0}`));
	return `${F(t, de)} ${F(t, fe)}`;
};
function pe(e, t = {}, n = {}) {
	e >>>= 0;
	let r = t.contraste ?? 4.5, i = n.look ? H(n.look) : B(N(e, "look"), t), a;
	if (n.palette) {
		if (a = H(n.palette), !n.look) {
			let n = N(e, "look-repli");
			for (let e = 0; e < 12 && !U(a, i.nom, r); e++) i = B(n, t);
			U(a, i.nom, r) || (i = {
				...i,
				nom: "neutre"
			});
		}
	} else a = se(oe(N(e, "palette"), t).brut, i.nom, r).palette;
	return {
		v: 1,
		nom: V(e),
		graine: e,
		palette: a,
		typo: n.typo ? H(n.typo) : ce(N(e, "typo"), t),
		forme: n.forme ? H(n.forme) : le(N(e, "forme")),
		mouvement: n.mouvement ? H(n.mouvement) : ue(N(e, "mouvement")),
		look: i
	};
}
var H = (e) => structuredClone(e);
function U(e, t, n = A) {
	let r = [e.papier, ...e.surfaces];
	return b(e.encre, r, t) >= Math.max(n, 4.5) && e.accents.every((e, i) => b(e, r, t) >= (i === 0 ? Math.max(n, 4.5) : 3));
}
var me = pe(1), W = (e, t, n = -Infinity, r = Infinity) => typeof e == "number" && Number.isFinite(e) ? R(e, n, r) : t, G = (e, t, n) => typeof e == "string" && t.includes(e) ? e : n, K = (e, t) => Array.isArray(e) && e.length === 3 && e.every((e) => typeof e == "number" && Number.isFinite(e)) ? y(e) : t;
function he(e) {
	let t = typeof e == "string" ? JSON.parse(e) : e;
	if (!t || typeof t != "object") throw Error("Système illisible : un objet JSON est attendu.");
	if (t.format !== void 0 && t.format !== "presse-systeme") throw Error(`Ce n'est pas un système Presse (format « ${String(t.format)} »).`);
	if (t.v !== void 0 && t.v !== 1) throw Error(`Version de système inconnue : ${String(t.v)} (attendu : 1).`);
	let n = me, r = t.palette ?? {}, a = t.typo ?? {}, o = t.forme ?? {}, s = t.mouvement ?? {}, c = t.look ?? {}, l = Array.isArray(r.accents) && r.accents.length ? r.accents.slice(0, 3).map((e, t) => K(e, n.palette.accents[t] ?? n.palette.accents[0])) : n.palette.accents.map((e) => [...e]), u = Array.isArray(r.surfaces) ? r.surfaces : [], d = G(a.titre, T, n.typo.titre), f = G(a.texte, T.filter((e) => w[e].texte), n.typo.texte), p = W(t.graine, n.graine, 0, 4294967295) >>> 0;
	return {
		v: 1,
		nom: typeof t.nom == "string" && t.nom.trim() ? t.nom.trim().slice(0, 60) : V(p),
		graine: p,
		palette: {
			harmonie: G(r.harmonie, C, n.palette.harmonie),
			sombre: typeof r.sombre == "boolean" ? r.sombre : n.palette.sombre,
			teinte: L(z(W(r.teinte, n.palette.teinte)), 2),
			papier: K(r.papier, n.palette.papier),
			encre: K(r.encre, n.palette.encre),
			accents: l,
			surfaces: [K(u[0], n.palette.surfaces[0]), K(u[1], n.palette.surfaces[1])]
		},
		typo: {
			titre: d,
			texte: f,
			rapport: W(a.rapport, n.typo.rapport, 1, 2),
			base: W(a.base, n.typo.base, 10, 28),
			graisseTitre: W(a.graisseTitre, n.typo.graisseTitre, 100, 900),
			graisseTexte: W(a.graisseTexte, n.typo.graisseTexte, 100, 900),
			largeur: W(a.largeur, n.typo.largeur, 62, 125),
			interlignage: W(a.interlignage, n.typo.interlignage, 1, 2.2),
			interlignageTitre: W(a.interlignageTitre, n.typo.interlignageTitre, .7, 1.6),
			approche: W(a.approche, n.typo.approche, -.1, .2),
			capitales: typeof a.capitales == "boolean" ? a.capitales : n.typo.capitales
		},
		forme: {
			espace: W(o.espace, n.forme.espace, 2, 16),
			rayon: W(o.rayon, n.forme.rayon, 0, 48),
			filet: W(o.filet, n.forme.filet, 0, 4),
			ombre: W(o.ombre, n.forme.ombre, 0, 1)
		},
		mouvement: {
			echelle: W(s.echelle, n.mouvement.echelle, .3, 3),
			courbe: G(s.courbe, Object.keys(E), n.mouvement.courbe),
			transitionPage: G(s.transitionPage, i, n.mouvement.transitionPage),
			transitionDiapo: G(s.transitionDiapo, D, n.mouvement.transitionDiapo),
			intensite: G(s.intensite, ie, n.mouvement.intensite)
		},
		look: {
			nom: G(c.nom, O, n.look.nom),
			grain: W(c.grain, n.look.grain, 0, .3),
			vignette: W(c.vignette, n.look.vignette, 0, 1),
			effets: Array.isArray(c.effets) ? [...new Set(c.effets.filter((e) => typeof e == "string" && k.includes(e)))] : [...n.look.effets]
		}
	};
}
function ge(e) {
	let t = atob(e.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((e.length + 3) % 4));
	return new TextDecoder().decode(Uint8Array.from(t, (e) => e.charCodeAt(0)));
}
function _e(e) {
	let t = e.trim();
	return he(t.startsWith("{") ? t : ge(t));
}
function ve(e) {
	let t = e.palette, n = [t.papier, ...t.surfaces], r = e.look.nom, i = x(S(t.encre, t.papier, .28), n, A, r).couleur, a = t.accents.map((e) => x(e, n, A, r).couleur), o = S(t.encre, t.papier, .82);
	return {
		papier: t.papier,
		encre: t.encre,
		encreDouce: i,
		accents: t.accents,
		accentsTexte: a,
		surfaces: t.surfaces,
		filet: o
	};
}
var q = (e) => `${+e.toFixed(2)}px`, ye = (e) => e === "ressort" ? n.spring : E[e];
function be(e) {
	let t = ve(e), n = e.typo, i = {
		"--presse-papier": p(t.papier),
		"--presse-encre": p(t.encre),
		"--presse-encre-douce": p(t.encreDouce),
		"--presse-surface-1": p(t.surfaces[0]),
		"--presse-surface-2": p(t.surfaces[1]),
		"--presse-filet": p(t.filet)
	};
	for (let e = 0; e < 3; e++) {
		let n = t.accents[e] ?? t.accents[0], r = t.accentsTexte[e] ?? t.accentsTexte[0];
		i[`--presse-accent-${e + 1}`] = p(n), i[`--presse-accent-${e + 1}-texte`] = p(r);
	}
	i["--presse-f-titre"] = w[n.titre].pile, i["--presse-f-texte"] = w[n.texte].pile, i["--presse-f-mono"] = w.plex.pile, i["--presse-graisse-titre"] = String(n.graisseTitre), i["--presse-graisse-texte"] = String(n.graisseTexte), i["--presse-largeur-titre"] = String(n.titre === "archivo" ? n.largeur : 100), i["--presse-casse-titre"] = n.capitales ? "uppercase" : "none", i["--presse-approche"] = `${n.approche}em`, i["--presse-interlignage"] = String(n.interlignage), i["--presse-interlignage-titre"] = String(n.interlignageTitre);
	for (let e = 0; e <= 6; e++) i[`--presse-t-${e}`] = q(n.base * n.rapport ** (e - 1));
	let a = e.forme;
	for (let e = 1; e <= 6; e++) i[`--presse-espace-${e}`] = q(a.espace * [
		1,
		2,
		3,
		4,
		6,
		10
	][e - 1]);
	i["--presse-rayon"] = q(a.rayon), i["--presse-rayon-petit"] = q(Math.round(a.rayon / 2)), i["--presse-filet-epaisseur"] = q(a.filet);
	let o = +(.06 + .22 * a.ombre).toFixed(3);
	i["--presse-ombre"] = a.ombre <= 0 ? "none" : `0 ${q(2 + 10 * a.ombre)} ${q(6 + 30 * a.ombre)} rgb(0 0 0 / ${e.palette.sombre ? Math.min(.6, o * 2) : o})`;
	let s = e.mouvement;
	for (let [e, t] of Object.entries(r)) i[`--dur-${e}`] = `${Math.round(t * s.echelle)}ms`;
	return i["--presse-courbe"] = ye(s.courbe), i;
}
var xe = {
	kit: {
		"--paper": "--presse-papier",
		"--ink": "--presse-encre",
		"--ink-soft": "--presse-encre-douce",
		"--spot": "--presse-accent-1-texte",
		"--rule": "--presse-filet",
		"--ps-radius": "--presse-rayon",
		"--ps-f-display": "--presse-f-titre",
		"--ps-f-text": "--presse-f-texte",
		"--ps-f-mono": "--presse-f-mono",
		"--ps-display-wght": "--presse-graisse-titre",
		"--ps-display-wdth": "--presse-largeur-titre",
		"--ps-display-track": "--presse-approche",
		"--ps-display-case": "--presse-casse-titre"
	},
	boutique: {
		"--papier": "--presse-papier",
		"--gris": "--presse-surface-1",
		"--gris-froid": "--presse-surface-2",
		"--gris-chaud": "--presse-surface-2",
		"--encre": "--presse-encre",
		"--encre-douce": "--presse-encre-douce",
		"--blanc": "--presse-papier",
		"--rouge": "--presse-accent-1",
		"--rouge-texte": "--presse-accent-1-texte",
		"--rouge-vif": "--presse-accent-1",
		"--pervenche": "--presse-accent-2-texte",
		"--rouille": "--presse-accent-3-texte",
		"--f-titre": "--presse-f-titre",
		"--f-texte": "--presse-f-texte",
		"--f-mono": "--presse-f-mono"
	}
};
function Se(e, t = {}) {
	let n = t.racine ?? ":root", r = t.commentaires ?? !0, i = be(e), a = (e, t = "  ") => Object.entries(e).map(([e, n]) => `${t}${e}: ${n};`).join("\n"), o = [
		["Couleurs (contraste AA tenu, étalonnage compris)", (e) => /papier|encre|surface|filet$|accent/.test(e)],
		["Typographie", (e) => /-f-|graisse|largeur|casse|approche|interlignage|-t-/.test(e)],
		["Forme", (e) => /espace|rayon|filet-epaisseur|ombre/.test(e)],
		["Mouvement", (e) => /dur-|courbe/.test(e)]
	], s = r ? `/* Système « ${e.nom} » — Presse Variations, graine ${e.graine}. */\n` : "";
	s += `${n} {\n`;
	let c = /* @__PURE__ */ new Set();
	for (let [e, t] of o) {
		let n = Object.fromEntries(Object.entries(i).filter(([e]) => !c.has(e) && t(e)));
		Object.keys(n).length && (Object.keys(n).forEach((e) => c.add(e)), s += `${r ? `  /* ${e} */\n` : ""}${a(n)}\n`);
	}
	if (s += "}\n", t.alias !== !1) {
		let e = {};
		for (let t of Object.values(xe)) for (let [n, r] of Object.entries(t)) e[n] = `var(${r})`;
		let t = n === ":root" ? ":root, :root *" : `${n}, ${n} *`;
		s += `${r ? "/* Les noms des pages Presse (kit de sections, boutique), branchés sur le système. */\n" : ""}${t} {\n${a(e)}\n}\n`;
	}
	return s;
}
function J(e) {
	return e.titre === "bodoni" ? "didone" : e.titre === "cormorant" ? "garalde" : e.titre === "plex" || e.texte === "plex" || e.capitales && e.largeur < 90 ? "technique" : "grotesque";
}
function Ce(e) {
	let t = {
		"data-presse-look": e.look.nom,
		"data-presse-grain": String(e.look.grain),
		"data-presse-vignette": String(e.look.vignette),
		"data-presse-effects": e.look.effets.join(" "),
		"data-presse-transition": e.mouvement.transitionPage,
		"data-presse-motion": e.mouvement.intensite,
		"data-ps-type": J(e.typo)
	};
	return e.palette.sombre && (t["data-ps-dark"] = ""), t;
}
// src/presse/systeme.ts
var we = {
	archivo: () => [Promise.resolve({         })],
	bodoni: () => [Promise.resolve({                })],
	cormorant: () => [
		Promise.resolve({        }),
		Promise.resolve({        }),
		Promise.resolve({        })
	],
	plex: () => [
		Promise.resolve({        }),
		Promise.resolve({        }),
		Promise.resolve({        })
	]
}, Y = /* @__PURE__ */ new Set();
function X(e) {
	let t = /* @__PURE__ */ new Set([
		e.typo.titre,
		e.typo.texte,
		"plex"
	]);
	return Promise.all([...t].filter((e) => !Y.has(e)).flatMap((e) => (Y.add(e), we[e]())));
}
var Z = null;
function Q(t, n = {}) {
	let r = n.doc ?? document, i = r.documentElement, a = r.querySelector("style[data-presse-systeme]");
	a || (a = r.createElement("style"), a.setAttribute("data-presse-systeme", ""), r.head.append(a)), a.textContent = Se(t, {
		racine: ":root[data-systeme-actif]",
		commentaires: !1
	});
	let o = Ce(t);
	if (!Z) {
		Z = {};
		for (let e of [...Object.keys(o), "data-ps-dark"]) Z[e] = i.getAttribute(e);
	}
	t.palette.sombre || i.removeAttribute("data-ps-dark");
	for (let [e, t] of Object.entries(o)) i.setAttribute(e, t);
	i.setAttribute("data-systeme-actif", t.nom);
	let s = n.look ?? !0;
	return typeof s == "function" ? s(t.look.nom, {
		grain: t.look.grain,
		vignette: t.look.vignette
	}) : s && e(t.look.nom, {
		grain: t.look.grain,
		vignette: t.look.vignette
	}), (n.polices ?? !0) && X(t).then(() => document.fonts.ready).then(() => dispatchEvent(new Event("resize"))), a;
}
function Te(t = {}) {
	let n = t.doc ?? document, r = n.documentElement;
	if (n.querySelector("style[data-presse-systeme]")?.remove?.(), r.removeAttribute("data-systeme-actif"), Z) for (let [e, t] of Object.entries(Z)) t === null ? r.removeAttribute(e) : r.setAttribute(e, t);
	Z = null;
	let i = t.look ?? !0, a = r.getAttribute("data-presse-look") ?? "neutre";
	typeof i == "function" ? i(a, {
		grain: Number(r.getAttribute("data-presse-grain") ?? NaN),
		vignette: Number(r.getAttribute("data-presse-vignette") ?? NaN)
	}) : i && e(a);
}
function $(e, t) {
	let n = new URLSearchParams(e).get("systeme") ?? t;
	return n ? _e(n) : null;
}
function Ee() {
	if (typeof document > "u") return null;
	try {
		let e = $(location.search, document.documentElement.getAttribute("data-systeme"));
		return e && Q(e), e;
	} catch (e) {
		return console.warn("[presse] système illisible (?systeme= ou data-systeme) :", e.message), null;
	}
}
export { Q as appliquerSysteme, X as chargerPolices, Ee as initSysteme, Te as retirerSysteme, $ as systemeDemande };
