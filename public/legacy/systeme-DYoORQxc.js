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
		let e = r.curves.map(_);
		[i, a, o] = [
			v(e[0], i),
			v(e[1], a),
			v(e[2], o)
		];
	}
	return [
		i,
		a,
		o
	];
}
var _ = ([e, t, n]) => Array.from({ length: 33 }, (r, i) => +(e + (n - e) * (i / 32) ** t).toFixed(4));
function v(e, t) {
	let n = e.length - 1, r = Math.min(n - 1, Math.floor(t * n));
	return e[r] + (t * n - r) * (e[r + 1] - e[r]);
}
function y(e, t, n) {
	return h(d(g(f(e), n)), d(g(f(t), n)));
}
var b = (e, t) => Math.round(e * 10 ** t) / 10 ** t + 0, x = ([e, t, n]) => [
	b(Math.min(1, Math.max(0, e)), 4),
	b(Math.max(0, t), 4),
	b((n % 360 + 360) % 360, 2)
];
function S(e, t, n = "neutre") {
	let r = p(e), i = Infinity;
	for (let e of t) {
		let t = p(e);
		i = Math.min(i, h(r, t), y(r, t, n));
	}
	return i;
}
function C(e, t, n, r = "neutre") {
	let i = (e) => S(e, t, r) >= n, a = x(e);
	if (i(a)) return {
		couleur: a,
		ajuste: !1
	};
	let o = t.reduce((e, t) => e + t[0], 0) / Math.max(1, t.length);
	for (let e of o >= .6 ? [0, 1] : [1, 0]) {
		let t = a[0];
		for (let n = 1; n <= 48; n++) {
			let r = a[0] + (e - a[0]) * n / 48;
			if (i(x([
				r,
				a[1],
				a[2]
			]))) {
				let e = t, n = r;
				for (let t = 0; t < 18; t++) {
					let t = (e + n) / 2;
					i(x([
						t,
						a[1],
						a[2]
					])) ? n = t : e = t;
				}
				return {
					couleur: x([
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
		couleur: S(s, t, r) >= S(c, t, r) ? s : c,
		ajuste: !0
	};
}
function w(e, t, n) {
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
var T = [
	"analogue",
	"complementaire",
	"scindee",
	"triade",
	"tetrade",
	"monochrome"
], ee = {
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
}, E = {
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
}, D = Object.keys(E), te = [
	1.125,
	1.2,
	1.25,
	1.333,
	1.414,
	1.5,
	1.618
], O = {
	out: n.out,
	inOut: n.inOut,
	ressort: "",
	net: "cubic-bezier(0.2, 0, 0, 1)"
}, ne = [
	"sobre",
	"normal",
	"expressif"
], re = i.filter((e) => e !== "aucune"), k = a, A = Object.keys(t), j = [
	"loupe",
	"rvb",
	"trame",
	"bloom",
	"grain",
	"courbure"
], M = 4.5;
function N(e) {
	let t = e >>> 0;
	return () => {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function P(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t = Math.imul(t ^ e.charCodeAt(n), 16777619);
	return t >>> 0;
}
var F = (e, t) => N(P(`${e >>> 0}:${t}`)), I = (e, t, n) => t + (n - t) * e(), L = (e, t) => t[Math.floor(e() * t.length) % t.length], R = (e, t) => {
	let n = t.reduce((e, [, t]) => e + t, 0), r = e() * n;
	for (let [e, n] of t) if ((r -= n) < 0) return e;
	return t[t.length - 1][0];
}, z = (e, t = 3) => Math.round(e * 10 ** t) / 10 ** t + 0, B = (e, t, n) => Math.min(n, Math.max(t, e)), V = (e) => (e % 360 + 360) % 360;
function ie(e, t) {
	let n = t.sombre ?? e() < .3, r = t.harmonie ?? L(e, T), i = z(V(t.teinte ?? e() * 360), 2), a = t.accents ?? R(e, [
		[1, 2],
		[2, 3],
		[3, 2]
	]), o = ee[r], s = V(i + (e() < .5 ? 0 : 180) + I(e, -12, 12)), c = n ? [
		I(e, .14, .23),
		I(e, .006, .035),
		s
	] : [
		I(e, .935, .985),
		I(e, .004, .03),
		s
	], l = n ? [
		I(e, .9, .97),
		I(e, .005, .03),
		i
	] : [
		I(e, .14, .3),
		I(e, .01, .05),
		i
	], u = [];
	for (let t = 0; t < a; t++) {
		let a = V(i + o[t] + I(e, -8, 8));
		r === "monochrome" ? u.push(n ? [
			I(e, .62, .86),
			I(e, .06, .16),
			a
		] : [
			I(e, .38, .62),
			I(e, .06, .16),
			a
		]) : u.push(n ? [
			I(e, .66, .82),
			I(e, .09, .19),
			a
		] : [
			I(e, .45, .62),
			I(e, .1, .21),
			a
		]);
	}
	let d = I(e, .02, .045), f = d + I(e, .025, .05), p = n ? 1 : -1;
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
function ae(e, t = "neutre", n = M) {
	let r = x(e.papier), i = e.surfaces.map(x), a = [r, ...i], o = [], s = C(e.encre, a, Math.max(n, M), t);
	s.ajuste && o.push("encre");
	let c = e.accents.slice(0, 3).map((e, r) => {
		let i = C(e, a, r === 0 ? Math.max(n, M) : 3, t);
		return i.ajuste && o.push(`accent ${r + 1}`), i.couleur;
	});
	return c.length || c.push(C([
		.5,
		.15,
		e.teinte
	], a, n, t).couleur), {
		palette: {
			harmonie: e.harmonie,
			sombre: e.sombre,
			teinte: z(V(e.teinte), 2),
			papier: r,
			encre: s.couleur,
			accents: c,
			surfaces: i
		},
		retouches: o
	};
}
function oe(e, t) {
	let n = R(e, (t.titres?.length ? t.titres : D.filter((e) => E[e].titre)).map((e) => [e, e === "plex" ? 1 : 3])), r = (t.textes?.length ? t.textes : D.filter((e) => E[e].texte)).filter((e) => E[e].texte), i = R(e, (r.length ? r : ["archivo"]).map((e) => [e, e === "archivo" ? 3 : e === n ? 2 : 1])), [a, o] = E[n].graisses, s = Math.round(I(e, Math.max(a, n === "archivo" ? 500 : a), o) / 50) * 50, c = i === "cormorant" ? 500 : i === "archivo" ? L(e, [
		350,
		400,
		400,
		450
	]) : 400, l = n === "plex" ? e() < .6 : n === "archivo" ? e() < .28 : e() < .06;
	return {
		titre: n,
		texte: i,
		rapport: L(e, te),
		base: Math.round(I(e, 15, 19.99)),
		graisseTitre: s,
		graisseTexte: c,
		largeur: n === "archivo" ? Math.round(I(e, 62, 125)) : 100,
		interlignage: z(I(e, 1.4, 1.7), 2),
		interlignageTitre: z(l ? I(e, .88, 1.02) : I(e, .92, 1.12), 2),
		approche: z(l ? I(e, -.01, .03) : I(e, -.045, .005), 3),
		capitales: l
	};
}
function se(e) {
	return {
		espace: Math.round(I(e, 4, 10.99)),
		rayon: R(e, [
			[0, 3],
			[2, 2],
			[4, 2],
			[8, 2],
			[12, 2],
			[18, 1],
			[28, 1]
		]),
		filet: R(e, [
			[1, 4],
			[2, 2],
			[0, 1]
		]),
		ombre: z(R(e, [
			[0, 4],
			[.3, 2],
			[.6, 2],
			[1, 1]
		]), 2)
	};
}
function ce(e) {
	return {
		echelle: z(I(e, .7, 1.5), 2),
		courbe: R(e, [
			["out", 4],
			["inOut", 2],
			["ressort", 2],
			["net", 2]
		]),
		transitionPage: L(e, re),
		transitionDiapo: L(e, k),
		intensite: R(e, [
			["sobre", 2],
			["normal", 3],
			["expressif", 2]
		])
	};
}
function H(e, n) {
	let r = L(e, n.looks?.length ? n.looks.filter((e) => t[e]) : A), i = t[r] ?? t.neutre, a = ["loupe", ...j.filter((t) => t !== "loupe" && e() < (t === "bloom" || t === "grain" ? .55 : .22))];
	return {
		nom: r,
		grain: z(B(i.grain + I(e, -.02, .025), 0, .12), 3),
		vignette: z(B(i.vignette + I(e, -.1, .1), 0, .6), 2),
		effets: a
	};
}
var U = [
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
], W = [
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
], G = (e) => {
	let t = N(P(`nom:${e >>> 0}`));
	return `${L(t, U)} ${L(t, W)}`;
};
function le(e, t = {}, n = {}) {
	e >>>= 0;
	let r = t.contraste ?? 4.5, i = n.look ? K(n.look) : H(F(e, "look"), t), a;
	if (n.palette) {
		if (a = K(n.palette), !n.look) {
			let n = F(e, "look-repli");
			for (let e = 0; e < 12 && !q(a, i.nom, r); e++) i = H(n, t);
			q(a, i.nom, r) || (i = {
				...i,
				nom: "neutre"
			});
		}
	} else a = ae(ie(F(e, "palette"), t).brut, i.nom, r).palette;
	return {
		v: 1,
		nom: G(e),
		graine: e,
		palette: a,
		typo: n.typo ? K(n.typo) : oe(F(e, "typo"), t),
		forme: n.forme ? K(n.forme) : se(F(e, "forme")),
		mouvement: n.mouvement ? K(n.mouvement) : ce(F(e, "mouvement")),
		look: i
	};
}
var K = (e) => structuredClone(e);
function q(e, t, n = M) {
	let r = [e.papier, ...e.surfaces];
	return S(e.encre, r, t) >= Math.max(n, 4.5) && e.accents.every((e, i) => S(e, r, t) >= (i === 0 ? Math.max(n, 4.5) : 3));
}
var ue = le(1), J = (e, t, n = -Infinity, r = Infinity) => typeof e == "number" && Number.isFinite(e) ? B(e, n, r) : t, Y = (e, t, n) => typeof e == "string" && t.includes(e) ? e : n, X = (e, t) => Array.isArray(e) && e.length === 3 && e.every((e) => typeof e == "number" && Number.isFinite(e)) ? x(e) : t;
function de(e) {
	let t = typeof e == "string" ? JSON.parse(e) : e;
	if (!t || typeof t != "object") throw Error("Système illisible : un objet JSON est attendu.");
	if (t.format !== void 0 && t.format !== "presse-systeme") throw Error(`Ce n'est pas un système Presse (format « ${String(t.format)} »).`);
	if (t.v !== void 0 && t.v !== 1) throw Error(`Version de système inconnue : ${String(t.v)} (attendu : 1).`);
	let n = ue, r = t.palette ?? {}, a = t.typo ?? {}, o = t.forme ?? {}, s = t.mouvement ?? {}, c = t.look ?? {}, l = Array.isArray(r.accents) && r.accents.length ? r.accents.slice(0, 3).map((e, t) => X(e, n.palette.accents[t] ?? n.palette.accents[0])) : n.palette.accents.map((e) => [...e]), u = Array.isArray(r.surfaces) ? r.surfaces : [], d = Y(a.titre, D, n.typo.titre), f = Y(a.texte, D.filter((e) => E[e].texte), n.typo.texte), p = J(t.graine, n.graine, 0, 4294967295) >>> 0;
	return {
		v: 1,
		nom: typeof t.nom == "string" && t.nom.trim() ? t.nom.trim().slice(0, 60) : G(p),
		graine: p,
		palette: {
			harmonie: Y(r.harmonie, T, n.palette.harmonie),
			sombre: typeof r.sombre == "boolean" ? r.sombre : n.palette.sombre,
			teinte: z(V(J(r.teinte, n.palette.teinte)), 2),
			papier: X(r.papier, n.palette.papier),
			encre: X(r.encre, n.palette.encre),
			accents: l,
			surfaces: [X(u[0], n.palette.surfaces[0]), X(u[1], n.palette.surfaces[1])]
		},
		typo: {
			titre: d,
			texte: f,
			rapport: J(a.rapport, n.typo.rapport, 1, 2),
			base: J(a.base, n.typo.base, 10, 28),
			graisseTitre: J(a.graisseTitre, n.typo.graisseTitre, 100, 900),
			graisseTexte: J(a.graisseTexte, n.typo.graisseTexte, 100, 900),
			largeur: J(a.largeur, n.typo.largeur, 62, 125),
			interlignage: J(a.interlignage, n.typo.interlignage, 1, 2.2),
			interlignageTitre: J(a.interlignageTitre, n.typo.interlignageTitre, .7, 1.6),
			approche: J(a.approche, n.typo.approche, -.1, .2),
			capitales: typeof a.capitales == "boolean" ? a.capitales : n.typo.capitales
		},
		forme: {
			espace: J(o.espace, n.forme.espace, 2, 16),
			rayon: J(o.rayon, n.forme.rayon, 0, 48),
			filet: J(o.filet, n.forme.filet, 0, 4),
			ombre: J(o.ombre, n.forme.ombre, 0, 1)
		},
		mouvement: {
			echelle: J(s.echelle, n.mouvement.echelle, .3, 3),
			courbe: Y(s.courbe, Object.keys(O), n.mouvement.courbe),
			transitionPage: Y(s.transitionPage, i, n.mouvement.transitionPage),
			transitionDiapo: Y(s.transitionDiapo, k, n.mouvement.transitionDiapo),
			intensite: Y(s.intensite, ne, n.mouvement.intensite)
		},
		look: {
			nom: Y(c.nom, A, n.look.nom),
			grain: J(c.grain, n.look.grain, 0, .3),
			vignette: J(c.vignette, n.look.vignette, 0, 1),
			effets: Array.isArray(c.effets) ? [...new Set(c.effets.filter((e) => typeof e == "string" && j.includes(e)))] : [...n.look.effets]
		}
	};
}
function fe(e) {
	let t = atob(e.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((e.length + 3) % 4));
	return new TextDecoder().decode(Uint8Array.from(t, (e) => e.charCodeAt(0)));
}
function pe(e) {
	let t = e.trim();
	return de(t.startsWith("{") ? t : fe(t));
}
function me(e) {
	let t = e.palette, n = [t.papier, ...t.surfaces], r = e.look.nom, i = C(w(t.encre, t.papier, .28), n, M, r).couleur, a = t.accents.map((e) => C(e, n, M, r).couleur), o = w(t.encre, t.papier, .82);
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
var Z = (e) => `${+e.toFixed(2)}px`, he = (e) => e === "ressort" ? n.spring : O[e];
function ge(e) {
	let t = me(e), n = e.typo, i = {
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
	i["--presse-f-titre"] = E[n.titre].pile, i["--presse-f-texte"] = E[n.texte].pile, i["--presse-f-mono"] = E.plex.pile, i["--presse-graisse-titre"] = String(n.graisseTitre), i["--presse-graisse-texte"] = String(n.graisseTexte), i["--presse-largeur-titre"] = String(n.titre === "archivo" ? n.largeur : 100), i["--presse-casse-titre"] = n.capitales ? "uppercase" : "none", i["--presse-approche"] = `${n.approche}em`, i["--presse-interlignage"] = String(n.interlignage), i["--presse-interlignage-titre"] = String(n.interlignageTitre);
	for (let e = 0; e <= 6; e++) i[`--presse-t-${e}`] = Z(n.base * n.rapport ** (e - 1));
	let a = e.forme;
	for (let e = 1; e <= 6; e++) i[`--presse-espace-${e}`] = Z(a.espace * [
		1,
		2,
		3,
		4,
		6,
		10
	][e - 1]);
	i["--presse-rayon"] = Z(a.rayon), i["--presse-rayon-petit"] = Z(Math.round(a.rayon / 2)), i["--presse-filet-epaisseur"] = Z(a.filet);
	let o = +(.06 + .22 * a.ombre).toFixed(3);
	i["--presse-ombre"] = a.ombre <= 0 ? "none" : `0 ${Z(2 + 10 * a.ombre)} ${Z(6 + 30 * a.ombre)} rgb(0 0 0 / ${e.palette.sombre ? Math.min(.6, o * 2) : o})`;
	let s = e.mouvement;
	for (let [e, t] of Object.entries(r)) i[`--dur-${e}`] = `${Math.round(t * s.echelle)}ms`;
	return i["--presse-courbe"] = he(s.courbe), i;
}
var _e = {
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
function ve(e, t = {}) {
	let n = t.racine ?? ":root", r = t.commentaires ?? !0, i = ge(e), a = (e, t = "  ") => Object.entries(e).map(([e, n]) => `${t}${e}: ${n};`).join("\n"), o = [
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
		for (let t of Object.values(_e)) for (let [n, r] of Object.entries(t)) e[n] = `var(${r})`;
		let t = n === ":root" ? ":root, :root *" : `${n}, ${n} *`;
		s += `${r ? "/* Les noms des pages Presse (kit de sections, boutique), branchés sur le système. */\n" : ""}${t} {\n${a(e)}\n}\n`;
	}
	return s;
}
function ye(e) {
	return e.titre === "bodoni" ? "didone" : e.titre === "cormorant" ? "garalde" : e.titre === "plex" || e.texte === "plex" || e.capitales && e.largeur < 90 ? "technique" : "grotesque";
}
function be(e) {
	let t = {
		"data-presse-look": e.look.nom,
		"data-presse-grain": String(e.look.grain),
		"data-presse-vignette": String(e.look.vignette),
		"data-presse-effects": e.look.effets.join(" "),
		"data-presse-transition": e.mouvement.transitionPage,
		"data-presse-motion": e.mouvement.intensite,
		"data-ps-type": ye(e.typo)
	};
	return e.palette.sombre && (t["data-ps-dark"] = ""), t;
}
// src/presse/systeme.ts
var xe = {
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
}, Q = /* @__PURE__ */ new Set();
function Se(e) {
	let t = /* @__PURE__ */ new Set([
		e.typo.titre,
		e.typo.texte,
		"plex"
	]);
	return Promise.all([...t].filter((e) => !Q.has(e)).flatMap((e) => (Q.add(e), xe[e]())));
}
var $ = null;
function Ce(t, n = {}) {
	let r = n.doc ?? document, i = r.documentElement, a = r.querySelector("style[data-presse-systeme]");
	a || (a = r.createElement("style"), a.setAttribute("data-presse-systeme", ""), r.head.append(a)), a.textContent = ve(t, {
		racine: ":root[data-systeme-actif]",
		commentaires: !1
	});
	let o = be(t);
	if (!$) {
		$ = {};
		for (let e of [...Object.keys(o), "data-ps-dark"]) $[e] = i.getAttribute(e);
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
	}), (n.polices ?? !0) && Se(t).then(() => document.fonts.ready).then(() => dispatchEvent(new Event("resize"))), a;
}
function we(e, t) {
	let n = new URLSearchParams(e).get("systeme") ?? t;
	return n ? pe(n) : null;
}
function Te() {
	if (typeof document > "u") return null;
	try {
		let e = we(location.search, document.documentElement.getAttribute("data-systeme"));
		return e && Ce(e), e;
	} catch (e) {
		return console.warn("[presse] système illisible (?systeme= ou data-systeme) :", e.message), null;
	}
}
export { Te as initSysteme };
