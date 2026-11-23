// src/presse/logo.ts
var e = [
	"liquide-metal",
	"gemme-fumee",
	"chaleur",
	"eau",
	"verre-cannele",
	"trame-cmjn",
	"trame-points",
	"tramage",
	"lentille",
	"papier"
], t = {
	"liquide-metal": "<path d=\"M5 15c0-5 3-11 7-11s7 6 7 11a7 7 0 0 1-14 0z\" /><path d=\"M9 15c1 2 3 2.5 5 1.5\" />",
	"gemme-fumee": "<path d=\"M7 4h10l4 5-9 11L3 9z\" /><path d=\"M3 9h18M9 4l3 5 3-5M12 9v11\" />",
	chaleur: "<path d=\"M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-3-2 2-3 4-3 7a6 6 0 0 0 6 6z\" />",
	eau: "<path d=\"M2 8c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5 0M2 13c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5 0M2 18c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5 0\" />",
	"verre-cannele": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" /><path d=\"M7.5 3v18M12 3v18M16.5 3v18\" />",
	"trame-cmjn": "<circle cx=\"8\" cy=\"8\" r=\"3.5\" /><circle cx=\"16\" cy=\"8\" r=\"2.5\" /><circle cx=\"8\" cy=\"16\" r=\"2.5\" /><circle cx=\"16\" cy=\"16\" r=\"1.5\" />",
	"trame-points": "<circle cx=\"6\" cy=\"6\" r=\"2\" /><circle cx=\"12\" cy=\"6\" r=\"1.4\" /><circle cx=\"18\" cy=\"6\" r=\"0.8\" /><circle cx=\"6\" cy=\"12\" r=\"2.4\" /><circle cx=\"12\" cy=\"12\" r=\"2\" /><circle cx=\"18\" cy=\"12\" r=\"1.4\" /><circle cx=\"6\" cy=\"18\" r=\"2.8\" /><circle cx=\"12\" cy=\"18\" r=\"2.4\" /><circle cx=\"18\" cy=\"18\" r=\"2\" />",
	tramage: "<path d=\"M4 4h4v4H4zM12 4h4v4h-4zM8 8h4v4H8zM16 8h4v4h-4zM4 12h4v4H4zM12 12h4v4h-4zM8 16h4v4H8zM16 16h4v4h-4z\" />",
	lentille: "<circle cx=\"9\" cy=\"12\" r=\"6\" /><circle cx=\"15\" cy=\"12\" r=\"6\" /><path d=\"M12 7v10\" />",
	papier: "<path d=\"M5 3h10l4 4v14H5z\" /><path d=\"M15 3v4h4M8 11l3 2 2-3 3 4\" />",
	teinte: "<circle cx=\"12\" cy=\"12\" r=\"8\" /><path d=\"M12 4a8 8 0 0 0 0 16z\" />",
	couleur: "<path d=\"M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z\" />",
	couleurs: "<circle cx=\"8\" cy=\"9\" r=\"4.5\" /><circle cx=\"16\" cy=\"9\" r=\"4.5\" /><circle cx=\"12\" cy=\"16\" r=\"4.5\" />",
	repetition: "<path d=\"M4 4l16 16M4 10l10 10M10 4l10 10M4 16l4 4M16 4l4 4\" />",
	adoucissement: "<circle cx=\"12\" cy=\"12\" r=\"8\" stroke-dasharray=\"2 2.6\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
	frangeRouge: "<circle cx=\"10\" cy=\"12\" r=\"6\" /><path d=\"M16 7a6 6 0 0 1 0 10\" />",
	frangeBleue: "<circle cx=\"14\" cy=\"12\" r=\"6\" /><path d=\"M8 7a6 6 0 0 0 0 10\" />",
	distorsion: "<path d=\"M3 12c3-6 5 6 9 0s6 6 9 0\" />",
	contour: "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"4\" /><rect x=\"8\" y=\"8\" width=\"8\" height=\"8\" rx=\"1.5\" />",
	angle: "<path d=\"M3 20h18M3 20L17 6\" /><path d=\"M10 20a7 7 0 0 0-2-5\" />",
	echelle: "<path d=\"M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7\" />",
	taille: "<rect x=\"3\" y=\"3\" width=\"8\" height=\"8\" /><rect x=\"13\" y=\"13\" width=\"8\" height=\"8\" />",
	lueurIn: "<circle cx=\"12\" cy=\"12\" r=\"8\" /><circle cx=\"12\" cy=\"12\" r=\"4\" fill=\"currentColor\" stroke=\"none\" opacity=\".35\" />",
	lueurOut: "<circle cx=\"12\" cy=\"12\" r=\"4\" /><path d=\"M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2\" />",
	decalage: "<path d=\"M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4\" />",
	grain: "<circle cx=\"6\" cy=\"7\" r=\".8\" /><circle cx=\"12\" cy=\"5\" r=\".8\" /><circle cx=\"17\" cy=\"9\" r=\".8\" /><circle cx=\"8\" cy=\"13\" r=\".8\" /><circle cx=\"15\" cy=\"15\" r=\".8\" /><circle cx=\"6\" cy=\"19\" r=\".8\" /><circle cx=\"19\" cy=\"18\" r=\".8\" />",
	vagues: "<path d=\"M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-2.5 5 0\" />",
	caustique: "<path d=\"M4 8c4 2 6-3 9 0s5 1 7-1M3 15c3-2 6 2 9 0s6-3 9 1\" />",
	couches: "<path d=\"M12 4l9 4.5-9 4.5-9-4.5z\" /><path d=\"M3 13l9 4.5 9-4.5\" />",
	bords: "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" /><path d=\"M4 9h16M4 15h16\" stroke-dasharray=\"1.5 2\" />",
	reflets: "<path d=\"M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6\" />",
	ombre: "<circle cx=\"10\" cy=\"10\" r=\"6\" /><path d=\"M16 10a6 6 0 0 1-6 6 6 6 0 0 0 8 2 6 6 0 0 0-2-8z\" fill=\"currentColor\" stroke=\"none\" opacity=\".4\" />",
	motif: "<path d=\"M4 20V4M9 20V4M14 20V4M19 20V4\" />",
	relief: "<path d=\"M3 18l5-12 4 8 3-5 6 9z\" />",
	etirement: "<path d=\"M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4\" />",
	flou: "<path d=\"M2 8h8M4 12h10M2 16h8\" /><circle cx=\"17\" cy=\"12\" r=\"4\" />",
	contraste: "<circle cx=\"12\" cy=\"12\" r=\"8\" /><path d=\"M12 4v16a8 8 0 0 0 0-16z\" fill=\"currentColor\" stroke=\"none\" />",
	bruit: "<path d=\"M3 12l2-4 2 7 2-9 2 11 2-8 2 5 2-3 2 4 2-3\" />",
	type: "<circle cx=\"7\" cy=\"12\" r=\"3.5\" /><path d=\"M14 8.5h7v7h-7z\" />",
	rayon: "<circle cx=\"12\" cy=\"12\" r=\"8\" /><path d=\"M12 12h8\" />",
	grille: "<path d=\"M4 4h16v16H4zM4 12h16M12 4v16\" />",
	inverse: "<circle cx=\"12\" cy=\"12\" r=\"8\" /><path d=\"M12 4a8 8 0 0 1 0 16\" fill=\"currentColor\" stroke=\"none\" />",
	image: "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\" /><circle cx=\"9\" cy=\"10\" r=\"2\" /><path d=\"M21 16l-5-5-8 8\" />",
	pixel: "<rect x=\"5\" y=\"5\" width=\"6\" height=\"6\" /><rect x=\"13\" y=\"13\" width=\"6\" height=\"6\" /><rect x=\"13\" y=\"5\" width=\"6\" height=\"6\" opacity=\".4\" />",
	niveaux: "<path d=\"M4 20h3v-6H4zM10.5 20h3V9h-3zM17 20h3V4h-3z\" />",
	ecart: "<circle cx=\"7\" cy=\"12\" r=\"4\" /><circle cx=\"17\" cy=\"12\" r=\"4\" /><path d=\"M11 12h2\" />",
	biais: "<path d=\"M4 18h16M6 18L12 6l6 12\" /><path d=\"M12 6v12\" stroke-dasharray=\"1.5 2\" />",
	perspective: "<path d=\"M4 6l16-3v18L4 18z\" />",
	nombre: "<path d=\"M9 4L7 20M17 4l-2 16M4 9h16M3 15h16\" />",
	spectre: "<path d=\"M4 18a8 8 0 0 1 16 0M7 18a5 5 0 0 1 10 0M10 18a2 2 0 0 1 4 0\" />",
	tourbillon: "<path d=\"M12 12a2 2 0 1 1 2-2 4 4 0 1 1-4-4 6 6 0 1 1-6 6\" />",
	bombement: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" /><path d=\"M3 12c6-3 12-3 18 0M12 3c-3 6-3 12 0 18\" />",
	centre: "<circle cx=\"12\" cy=\"12\" r=\"8\" /><circle cx=\"12\" cy=\"12\" r=\"1.5\" fill=\"currentColor\" />",
	papierCouleur: "<path d=\"M5 3h10l4 4v14H5z\" />",
	melange: "<circle cx=\"9\" cy=\"12\" r=\"6\" /><circle cx=\"15\" cy=\"12\" r=\"6\" opacity=\".5\" />",
	graine: "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"3\" /><circle cx=\"9\" cy=\"9\" r=\"1.2\" /><circle cx=\"15\" cy=\"15\" r=\"1.2\" /><circle cx=\"15\" cy=\"9\" r=\"1.2\" /><circle cx=\"9\" cy=\"15\" r=\"1.2\" />",
	rugosite: "<path d=\"M3 15l2-2 2 2 2-3 2 3 2-2 2 2 2-3 2 3 2-2\" />",
	fibres: "<path d=\"M4 8c3 0 3 4 6 4s3-4 6-4 3 4 4 4M4 16c3 0 3-3 6-3s3 3 6 3\" />",
	plis: "<path d=\"M3 4h18v16H3zM12 4v16M3 12h18\" />",
	froissage: "<path d=\"M3 5l5 3 4-4 4 5 5-2-2 6 2 5-6-1-3 4-3-4-6 1 2-5z\" />",
	gouttes: "<circle cx=\"7\" cy=\"8\" r=\"2\" /><circle cx=\"15\" cy=\"6\" r=\"1.2\" /><circle cx=\"17\" cy=\"15\" r=\"2.5\" /><circle cx=\"8\" cy=\"17\" r=\"1.5\" />",
	decoupe: "<path d=\"M6 3v18M18 3v18M3 6h18M3 18h18\" stroke-dasharray=\"2 2\" />",
	vitesse: "<path d=\"M4 18a9 9 0 1 1 16 0\" /><path d=\"M12 14l5-5\" />",
	mouvement: "<path d=\"M4 12h3l2-6 4 12 2-6h5\" />",
	marge: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"1\" stroke-dasharray=\"2 2\" /><rect x=\"7\" y=\"7\" width=\"10\" height=\"10\" rx=\"1\" />",
	fond: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" /><path d=\"M3 9h6V3M15 3v6h6M3 15h6v6M15 21v-6h6\" />",
	survol: "<path d=\"M5 3l13 8-6 1.5L9 19z\" />"
}, n = (e, t, n, r, i, a, o, s = .01, c = {}) => ({
	cle: e,
	uniforme: t,
	type: "nombre",
	libelle: n,
	icone: r,
	defaut: i,
	min: a,
	max: o,
	pas: s,
	...c
}), r = (e, t, n, r, i, a = {}) => ({
	cle: e,
	uniforme: t,
	type: "couleur",
	libelle: n,
	icone: r,
	defaut: i,
	...a
}), i = (e, t, n, r, i) => ({
	cle: e,
	uniforme: t,
	type: "bool",
	libelle: n,
	icone: r,
	defaut: i
}), a = (e, t, n, r, i, a, o = {}) => ({
	cle: e,
	uniforme: t,
	type: "choix",
	libelle: n,
	icone: r,
	defaut: i,
	choix: a,
	...o
}), o = (e, r, i, a = 360, o = {}) => n("angle", e, r, t.angle, i, 0, a, 1, {
	angle: !0,
	...o
}), s = (e) => n("echelle", "u_scale", "Échelle", t.echelle, e, .2, 1.6), c = (e = "u_grainOverlay", r = 0) => n("grain", e, "Grain", t.grain, r, 0, 1), l = 2 * Math.PI, u = {
	"liquide-metal": {
		id: "liquide-metal",
		nom: "Métal liquide",
		description: "Chrome qui coule dans la forme du logo, franges de couleur sur les bords",
		shader: "liquidMetalFragmentShader",
		preparation: "liquide-metal",
		temps: !0,
		periode: null,
		fixes: {
			u_isImage: !0,
			u_shape: 0
		},
		reglages: [
			r("teinte", "u_colorTint", "Teinte du métal", t.teinte, "#ffffff", { principal: !0 }),
			n("repetition", "u_repetition", "Répétition des bandes", t.repetition, 2, 1, 10, .1, { principal: !0 }),
			n("adoucissement", "u_softness", "Adoucissement", t.adoucissement, .1, 0, 1),
			n("frange-rouge", "u_shiftRed", "Frange rouge", t.frangeRouge, .3, -1, 1),
			n("frange-bleue", "u_shiftBlue", "Frange bleue", t.frangeBleue, .3, -1, 1),
			n("distorsion", "u_distortion", "Distorsion", t.distorsion, .07, 0, 1, .01, { principal: !0 }),
			n("contour", "u_contour", "Contour", t.contour, .4, 0, 1),
			o("u_angle", "Angle de l'écoulement", 70),
			s(.86)
		],
		presets: {
			chrome: {
				nom: "Chrome",
				valeurs: {}
			},
			noir: {
				nom: "Noir",
				valeurs: {
					teinte: "#606060",
					adoucissement: .45,
					repetition: 1.5,
					"frange-rouge": 0,
					"frange-bleue": 0,
					distorsion: 0,
					contour: 0,
					angle: 90
				}
			},
			or: {
				nom: "Or",
				valeurs: {
					teinte: "#f2c26b",
					repetition: 2.5,
					"frange-rouge": .15,
					"frange-bleue": -.1,
					distorsion: .1,
					contour: .5
				}
			},
			cuivre: {
				nom: "Cuivre",
				valeurs: {
					teinte: "#e3946a",
					repetition: 3,
					"frange-rouge": .2,
					"frange-bleue": 0,
					distorsion: .12,
					contour: .45,
					angle: 40
				}
			},
			rayures: {
				nom: "Rayures",
				valeurs: {
					teinte: "#2c5d72",
					adoucissement: .8,
					repetition: 6,
					"frange-rouge": 1,
					"frange-bleue": -1,
					distorsion: .4,
					contour: .4,
					angle: 0
				}
			}
		},
		instantBeau: 1400,
		cleSurvol: "distorsion",
		masqueDefaut: !1,
		icone: t["liquide-metal"]
	},
	"gemme-fumee": {
		id: "gemme-fumee",
		nom: "Gemme de fumée",
		description: "Une gemme de verre où tournent des volutes colorées, débordant en halo",
		shader: "gemSmokeFragmentShader",
		preparation: "gemme-fumee",
		temps: !0,
		periode: l * 1e3,
		fixes: {
			u_isImage: !0,
			u_shape: 0
		},
		reglages: [
			{
				cle: "couleurs",
				uniforme: "u_colors",
				type: "couleurs",
				libelle: "Couleurs de la fumée",
				icone: t.couleurs,
				defaut: ["#333333", "#e7e6df"],
				nombre: 6,
				principal: !0
			},
			r("interieur", "u_colorInner", "Couleur intérieure", t.couleur, "#fafaf5"),
			n("distorsion-interieure", "u_innerDistortion", "Distorsion intérieure", t.distorsion, .8, 0, 1, .01, { principal: !0 }),
			n("distorsion-exterieure", "u_outerDistortion", "Distorsion extérieure", t.vagues, .6, 0, 1),
			n("lueur-interieure", "u_innerGlow", "Lueur intérieure", t.lueurIn, 1, 0, 1),
			n("lueur-exterieure", "u_outerGlow", "Lueur extérieure", t.lueurOut, .55, 0, 1, .01, { principal: !0 }),
			n("decalage", "u_offset", "Décalage vertical", t.decalage, 0, -1, 1),
			o("u_angle", "Direction de la fumée", 0),
			n("taille", "u_size", "Taille de la fumée", t.taille, .8, 0, 1),
			s(.82)
		],
		presets: {
			fumee: {
				nom: "Fumée",
				valeurs: {}
			},
			feu: {
				nom: "Feu",
				valeurs: {
					couleurs: [
						"#fe5b16",
						"#f7ff61",
						"#ffffff"
					],
					interieur: "#000000",
					"lueur-exterieure": 1,
					"lueur-interieure": .65,
					"distorsion-interieure": .6,
					"distorsion-exterieure": .8
				}
			},
			fluo: {
				nom: "Fluorescent",
				valeurs: {
					couleurs: [
						"#2fb64c",
						"#cdff61",
						"#ffffff"
					],
					interieur: "#000000",
					"lueur-exterieure": 0,
					"lueur-interieure": 1,
					"distorsion-interieure": 1,
					"distorsion-exterieure": .8
				}
			},
			infrarouge: {
				nom: "Infrarouge",
				valeurs: {
					couleurs: [
						"#ff9900",
						"#fff67a",
						"#dcff52",
						"#00ffbb",
						"#0077ff"
					],
					interieur: "#cd28dc",
					"lueur-exterieure": 1,
					"lueur-interieure": 1,
					"distorsion-interieure": 1,
					"distorsion-exterieure": 1,
					decalage: .2,
					taille: 1
				}
			}
		},
		instantBeau: 2200,
		cleSurvol: "distorsion-interieure",
		masqueDefaut: !1,
		halo: (e) => .05 + .2 * e,
		icone: t["gemme-fumee"]
	},
	chaleur: {
		id: "chaleur",
		nom: "Chaleur",
		description: "Une image thermique : la chaleur court dans le logo et rayonne autour",
		shader: "heatmapFragmentShader",
		preparation: "chaleur",
		temps: !0,
		periode: 1e4,
		fixes: {},
		reglages: [
			{
				cle: "couleurs",
				uniforme: "u_colors",
				type: "couleurs",
				libelle: "Dégradé de chaleur",
				icone: t.couleurs,
				defaut: [
					"#11206a",
					"#1f3ba2",
					"#2f63e7",
					"#6bd7ff",
					"#ffe679",
					"#ff991e",
					"#ff4c00"
				],
				nombre: 10,
				principal: !0
			},
			n("contour", "u_contour", "Chaleur des bords", t.contour, .5, 0, 1, .01, { principal: !0 }),
			o("u_angle", "Direction des vagues de chaleur", 0),
			n("grain", "u_noise", "Grain", t.grain, 0, 0, 1),
			n("lueur-interieure", "u_innerGlow", "Lueur intérieure", t.lueurIn, .75, 0, 1),
			n("lueur-exterieure", "u_outerGlow", "Lueur extérieure", t.lueurOut, .5, 0, 1, .01, { principal: !0 }),
			s(.8)
		],
		presets: {
			thermique: {
				nom: "Thermique",
				valeurs: {}
			},
			sepia: {
				nom: "Sépia",
				valeurs: {
					couleurs: ["#997f45", "#ffffff"],
					grain: .75
				}
			},
			braise: {
				nom: "Braise",
				valeurs: {
					couleurs: [
						"#1a0503",
						"#6b0f06",
						"#d23a0b",
						"#ff9a1f",
						"#ffe9a8"
					],
					contour: .7,
					"lueur-exterieure": .35
				}
			},
			givre: {
				nom: "Givre",
				valeurs: {
					couleurs: [
						"#0b1430",
						"#2a4fa8",
						"#8fd3ff",
						"#ffffff"
					],
					contour: .6,
					"lueur-interieure": .35,
					"lueur-exterieure": .25
				}
			}
		},
		instantBeau: 3e3,
		cleSurvol: "lueur-exterieure",
		masqueDefaut: !1,
		halo: (e) => .04 + .14 * e,
		icone: t.chaleur
	},
	eau: {
		id: "eau",
		nom: "Eau",
		description: "Le logo vu sous une eau qui ondule, caustiques et reflets",
		shader: "waterFragmentShader",
		preparation: null,
		temps: !0,
		periode: null,
		fixes: {},
		reglages: [
			n("caustique", "u_caustic", "Caustique", t.caustique, .1, 0, 1, .01, { principal: !0 }),
			n("vagues", "u_waves", "Vagues", t.vagues, .3, 0, 1, .01, { principal: !0 }),
			n("couches", "u_layering", "Seconde couche", t.couches, .5, 0, 1),
			n("bords", "u_edges", "Bords", t.bords, .8, 0, 1),
			n("taille", "u_size", "Taille du motif", t.taille, 1, .01, 7, .01, { principal: !0 }),
			r("reflet", "u_colorHighlight", "Couleur des reflets", t.couleur, "#ffffff"),
			n("reflets", "u_highlights", "Reflets", t.reflets, 0, 0, 1),
			s(.9)
		],
		presets: {
			onde: {
				nom: "Onde",
				valeurs: {}
			},
			courant: {
				nom: "Courant",
				valeurs: {
					reflets: 0,
					couches: 0,
					bords: 0,
					vagues: .5,
					caustique: 0,
					taille: .5
				}
			},
			piscine: {
				nom: "Piscine",
				valeurs: {
					reflets: .4,
					couches: .3,
					bords: .6,
					vagues: .2,
					caustique: .4,
					taille: .7
				}
			},
			abstrait: {
				nom: "Abstrait",
				valeurs: {
					couches: 0,
					bords: 1,
					vagues: 1,
					caustique: .4,
					taille: .15
				}
			}
		},
		instantBeau: 1800,
		cleSurvol: "vagues",
		masqueDefaut: !1,
		icone: t.eau
	},
	"verre-cannele": {
		id: "verre-cannele",
		nom: "Verre cannelé",
		description: "Le logo derrière un verre strié qui glisse lentement",
		shader: "flutedGlassFragmentShader",
		preparation: null,
		temps: !1,
		periode: 8e3,
		mouvement: {
			cle: "decalage",
			forme: "sinus",
			ampleur: .5,
			periode: 8e3
		},
		fixes: {
			u_marginLeft: 0,
			u_marginRight: 0,
			u_marginTop: 0,
			u_marginBottom: 0,
			u_grainMixer: 0
		},
		reglages: [
			n("taille", "u_size", "Largeur des cannelures", t.taille, .55, 0, 1, .01, { principal: !0 }),
			n("distorsion", "u_distortion", "Distorsion", t.distorsion, .8, 0, 1, .01, { principal: !0 }),
			a("motif", "u_shape", "Motif", t.motif, "lignes", [
				[
					"lignes",
					1,
					"Lignes"
				],
				[
					"irregulier",
					2,
					"Lignes irrégulières"
				],
				[
					"vague",
					3,
					"Vague"
				],
				[
					"zigzag",
					4,
					"Zigzag"
				],
				[
					"motif",
					5,
					"Motif"
				]
			], { principal: !0 }),
			a("relief", "u_distortionShape", "Relief de la cannelure", t.relief, "prisme", [
				[
					"prisme",
					1,
					"Prisme"
				],
				[
					"lentille",
					2,
					"Lentille"
				],
				[
					"contour",
					3,
					"Contour"
				],
				[
					"cascade",
					4,
					"Cascade"
				],
				[
					"plat",
					5,
					"Plat"
				]
			]),
			n("decalage", "u_shift", "Décalage", t.decalage, 0, -1, 1),
			n("etirement", "u_stretch", "Étirement", t.etirement, 0, 0, 1),
			n("flou", "u_blur", "Flou", t.flou, 0, 0, 1),
			n("bords", "u_edges", "Bords", t.bords, .25, 0, 1),
			r("ombre", "u_colorShadow", "Couleur des ombres", t.ombre, "#000000"),
			n("ombres", "u_shadows", "Ombres", t.ombre, .25, 0, 1),
			r("reflet", "u_colorHighlight", "Couleur des reflets", t.couleur, "#ffffff"),
			n("reflets", "u_highlights", "Reflets", t.reflets, .1, 0, 1),
			o("u_angle", "Direction des cannelures", 0, 180),
			c(),
			s(.9)
		],
		presets: {
			prisme: {
				nom: "Prisme",
				valeurs: {}
			},
			vagues: {
				nom: "Vagues",
				valeurs: {
					ombres: 0,
					taille: .9,
					relief: "contour",
					reflets: 0,
					motif: "vague",
					flou: .1,
					bords: .5,
					etirement: 1,
					grain: .05
				}
			},
			plis: {
				nom: "Plis",
				valeurs: {
					ombres: .4,
					taille: .4,
					relief: "cascade",
					reflets: 0,
					distorsion: .75,
					flou: .25,
					bords: .5
				}
			},
			abstrait: {
				nom: "Abstrait",
				valeurs: {
					ombres: 0,
					taille: .7,
					angle: 30,
					relief: "plat",
					reflets: 0,
					motif: "irregulier",
					distorsion: 1,
					flou: 1,
					bords: .5,
					etirement: 1,
					grain: .1
				}
			}
		},
		instantBeau: 2e3,
		cleSurvol: "distorsion",
		masqueDefaut: !0,
		icone: t["verre-cannele"]
	},
	"trame-cmjn": {
		id: "trame-cmjn",
		nom: "Trame CMJN",
		description: "Quadrichromie en points d'encre, comme une affiche imprimée",
		shader: "halftoneCmykFragmentShader",
		preparation: null,
		temps: !1,
		periode: 6e3,
		mouvement: {
			cle: "taille",
			forme: "sinus",
			ampleur: .035,
			periode: 6e3
		},
		bruit: !0,
		fixes: {
			u_grainSize: .5,
			u_grainMixer: 0,
			u_floodC: .15,
			u_floodM: 0,
			u_floodY: 0,
			u_floodK: 0,
			u_gainC: .3,
			u_gainM: 0,
			u_gainY: .2,
			u_gainK: 0
		},
		reglages: [
			n("taille", "u_size", "Taille des points", t.taille, .2, 0, 1, .01, { principal: !0 }),
			n("contraste", "u_contrast", "Contraste", t.contraste, 1, 0, 2, .01, { principal: !0 }),
			n("adoucissement", "u_softness", "Adoucissement", t.adoucissement, 1, 0, 1),
			n("bruit", "u_gridNoise", "Bruit de la grille", t.bruit, .2, 0, 1),
			a("type", "u_type", "Forme des points", t.type, "encre", [
				[
					"points",
					0,
					"Points"
				],
				[
					"encre",
					1,
					"Encre"
				],
				[
					"net",
					2,
					"Net"
				]
			], { principal: !0 }),
			r("cyan", "u_colorC", "Encre cyan", t.couleur, "#00b4ff"),
			r("magenta", "u_colorM", "Encre magenta", t.couleur, "#fc519f"),
			r("jaune", "u_colorY", "Encre jaune", t.couleur, "#ffd800"),
			r("noir", "u_colorK", "Encre noire", t.couleur, "#231f20"),
			c(),
			s(.9)
		],
		presets: {
			quadri: {
				nom: "Quadri",
				valeurs: {}
			},
			gouttes: {
				nom: "Gouttes",
				valeurs: {
					cyan: "#00b2ff",
					magenta: "#fc4f4f",
					jaune: "#ffd900",
					taille: .88,
					contraste: 1.15,
					adoucissement: 0,
					bruit: .5,
					grain: .25
				}
			},
			ancien: {
				nom: "Ancien",
				valeurs: {
					cyan: "#59afc5",
					magenta: "#d8697c",
					jaune: "#fad85c",
					noir: "#2d2824",
					contraste: 1.25,
					adoucissement: .4,
					bruit: .45,
					grain: .1,
					type: "net"
				}
			}
		},
		instantBeau: 0,
		cleSurvol: "taille",
		masqueDefaut: !0,
		icone: t["trame-cmjn"]
	},
	"trame-points": {
		id: "trame-points",
		nom: "Trame de points",
		description: "Le logo en points d'une seule encre, qui respirent",
		shader: "halftoneDotsFragmentShader",
		preparation: null,
		temps: !1,
		periode: 5e3,
		mouvement: {
			cle: "rayon",
			forme: "sinus",
			ampleur: .22,
			periode: 5e3
		},
		fixes: {
			u_grainMixer: .2,
			u_grainSize: .5
		},
		reglages: [
			r("encre", "u_colorFront", "Encre", t.couleur, "#2b2b2b", { principal: !0 }),
			n("taille", "u_size", "Taille de la grille", t.taille, .5, 0, 1, .01, { principal: !0 }),
			n("rayon", "u_radius", "Rayon des points", t.rayon, 1.25, 0, 2, .01, { principal: !0 }),
			n("contraste", "u_contrast", "Contraste", t.contraste, .4, 0, 1),
			a("grille", "u_grid", "Grille", t.grille, "hex", [[
				"carre",
				0,
				"Carrée"
			], [
				"hex",
				1,
				"Hexagonale"
			]]),
			a("type", "u_type", "Forme des points", t.type, "gluant", [
				[
					"classique",
					0,
					"Classique"
				],
				[
					"gluant",
					1,
					"Gluant"
				],
				[
					"trous",
					2,
					"Trous"
				],
				[
					"doux",
					3,
					"Doux"
				]
			]),
			i("inverse", "u_inverted", "Inverser la luminance", t.inverse, !1),
			i("couleurs-image", "u_originalColors", "Couleurs du logo", t.image, !0),
			c("u_grainOverlay", .2),
			s(.9)
		],
		presets: {
			encre: {
				nom: "Encre",
				valeurs: {}
			},
			led: {
				nom: "Écran LED",
				valeurs: {
					encre: "#29ff7b",
					rayon: 1.5,
					contraste: .3,
					grain: 0,
					grille: "carre",
					type: "doux",
					"couleurs-image": !1
				}
			},
			mosaique: {
				nom: "Mosaïque",
				valeurs: {
					encre: "#b2aeae",
					taille: .6,
					rayon: 2,
					contraste: .01,
					grain: 0,
					type: "classique"
				}
			},
			trous: {
				nom: "Rond et carré",
				valeurs: {
					encre: "#ff8000",
					taille: .8,
					rayon: 1,
					contraste: 1,
					inverse: !0,
					grain: .3,
					grille: "carre",
					type: "trous",
					"couleurs-image": !1
				}
			}
		},
		instantBeau: 1250,
		cleSurvol: "rayon",
		masqueDefaut: !0,
		icone: t["trame-points"]
	},
	tramage: {
		id: "tramage",
		nom: "Tramage",
		description: "Pixels tramés d'écran ancien, le logo respire à travers la grille",
		shader: "imageDitheringFragmentShader",
		preparation: null,
		temps: !1,
		periode: 4e3,
		mouvement: {
			cle: "echelle",
			forme: "sinus",
			ampleur: .02,
			periode: 4e3
		},
		fixes: {},
		reglages: [
			r("encre", "u_colorFront", "Encre", t.couleur, "#1d2bd8", { principal: !0 }),
			r("reflet", "u_colorHighlight", "Seconde encre", t.couleur, "#ff5a36"),
			r("sombre", "u_colorBack", "Couleur des creux", t.ombre, "transparent"),
			a("type", "u_type", "Trame", t.type, "8x8", [
				[
					"aleatoire",
					1,
					"Aléatoire"
				],
				[
					"2x2",
					2,
					"Bayer 2 × 2"
				],
				[
					"4x4",
					3,
					"Bayer 4 × 4"
				],
				[
					"8x8",
					4,
					"Bayer 8 × 8"
				]
			], { principal: !0 }),
			n("pixel", "u_pxSize", "Taille des pixels", t.pixel, 2, .5, 20, .5, { principal: !0 }),
			n("niveaux", "u_colorSteps", "Niveaux", t.niveaux, 2, 1, 7, 1),
			i("inverse", "u_inverted", "Inverser la luminance", t.inverse, !0),
			i("couleurs-image", "u_originalColors", "Couleurs du logo", t.image, !1),
			s(.9)
		],
		presets: {
			encre: {
				nom: "Encre",
				valeurs: {}
			},
			phosphore: {
				nom: "Phosphore",
				valeurs: {
					encre: "#94ffaf",
					reflet: "#eaff94",
					sombre: "#000c38"
				}
			},
			retro: {
				nom: "Rétro",
				valeurs: {
					encre: "#eeeeee",
					reflet: "#eeeeee",
					sombre: "#5452ff",
					type: "2x2",
					pixel: 3,
					niveaux: 1,
					"couleurs-image": !0
				}
			},
			bruit: {
				nom: "Bruit",
				valeurs: {
					encre: "#a2997c",
					reflet: "#ededed",
					type: "aleatoire",
					pixel: 1,
					niveaux: 1
				}
			},
			naturel: {
				nom: "Naturel",
				valeurs: {
					encre: "#ffffff",
					reflet: "#ffffff",
					pixel: 2,
					niveaux: 5,
					"couleurs-image": !0
				}
			}
		},
		instantBeau: 0,
		cleSurvol: "pixel",
		masqueDefaut: !0,
		icone: t.tramage
	},
	lentille: {
		id: "lentille",
		nom: "Lentille",
		description: "Aberration chromatique d'une lentille qui tourne autour du logo",
		shader: "lensDistortionFragmentShader",
		preparation: null,
		temps: !1,
		periode: 9e3,
		mouvement: {
			cle: "angle",
			forme: "tour",
			ampleur: 360,
			periode: 9e3
		},
		fixes: {
			u_dispersionShift: 0,
			u_noise: 0,
			u_noiseFrequency: .25,
			u_noiseOffset: 0,
			u_lensCircle: 0,
			u_grainMixer: 0,
			u_imageX: 0,
			u_imageY: 0
		},
		reglages: [
			n("ecart", "u_spread", "Écart des couleurs", t.ecart, .25, 0, 1, .01, { principal: !0 }),
			n("dispersion", "u_dispersion", "Dispersion", t.spectre, 1, 0, 1, .01, { principal: !0 }),
			n("tourbillon", "u_swirl", "Tourbillon", t.tourbillon, .35, -1, 1, .01, { principal: !0 }),
			n("biais", "u_bias", "Biais", t.biais, 1, -1, 1),
			o("u_angle", "Direction de l'écart", 0),
			n("perspective", "u_perspective", "Perspective", t.perspective, .1, 0, 1),
			n("nombre", "u_count", "Nombre de couches", t.nombre, 24, 2, 50, 1),
			n("spectre", "u_dispersionColor", "Teinte du spectre", t.teinte, .6, 0, 1),
			n("centre", "u_focusCenter", "Netteté au centre", t.centre, .5, 0, 1),
			n("bords", "u_focusEdges", "Netteté aux bords", t.bords, 0, 0, 1),
			n("bombement", "u_lensBulge", "Bombement", t.bombement, 0, -1, 1),
			c(),
			s(.8)
		],
		presets: {
			prisme: {
				nom: "Prisme",
				valeurs: {}
			},
			fisheye: {
				nom: "Fisheye",
				valeurs: {
					ecart: .5,
					perspective: .75,
					nombre: 15,
					spectre: .7,
					centre: .9,
					tourbillon: 1,
					bombement: .6
				}
			},
			bichromie: {
				nom: "Bichromie",
				valeurs: {
					ecart: .1,
					biais: 0,
					perspective: 0,
					nombre: 2,
					spectre: .1,
					centre: 0,
					bords: 0,
					tourbillon: 0,
					grain: .3
				}
			},
			fumee: {
				nom: "Fumée",
				valeurs: {
					ecart: .5,
					biais: -1,
					perspective: .4,
					nombre: 50,
					dispersion: 0,
					spectre: .31,
					centre: 0,
					bords: .6,
					tourbillon: 0
				}
			}
		},
		instantBeau: 1500,
		cleSurvol: "ecart",
		masqueDefaut: !1,
		icone: t.lentille
	},
	papier: {
		id: "papier",
		nom: "Papier",
		description: "Le logo à l'encre sur un papier froissé : fibres, plis, la lumière tourne",
		shader: "paperTextureFragmentShader",
		preparation: null,
		temps: !1,
		periode: 12e3,
		mouvement: {
			cle: "angle",
			forme: "tour",
			ampleur: 360,
			periode: 12e3
		},
		bruit: !0,
		fixes: {
			u_isImage: !0,
			u_roughnessSize: .5,
			u_roughnessRows: 0,
			u_fiberSize: .5,
			u_foldSizeX: 1,
			u_foldSizeY: 1,
			u_foldOffsetX: 0,
			u_foldOffsetY: 0,
			u_wrinkleSize: .65,
			u_crumpleCount: 6
		},
		reglages: [
			n("froissage", "u_wrinkles", "Froissage", t.froissage, 1, 0, 1, .01, { principal: !0 }),
			n("plis", "u_folds", "Plis", t.plis, .5, 0, 1, .01, { principal: !0 }),
			n("distorsion", "u_distortion", "Le logo suit la feuille", t.distorsion, .75, -1, 1, .01, { principal: !0 }),
			r("papier", "u_colorPaper", "Couleur du papier", t.papierCouleur, "#ffffff"),
			r("ombre", "u_colorShadow", "Couleur des reliefs", t.ombre, "#cccccc"),
			n("melange", "u_blending", "Mélange encre et papier", t.melange, 1, 0, 1),
			o("u_angle", "Direction de la lumière", 300),
			n("graine", "u_seed", "Graine", t.graine, 4, 0, 1e3, 1),
			n("rugosite", "u_roughness", "Rugosité", t.rugosite, .4, 0, 1),
			n("fibres", "u_fiber", "Fibres", t.fibres, .4, 0, 1),
			n("froisses", "u_crumples", "Grands froissés", t.froissage, 0, 0, 1),
			n("gouttes", "u_drops", "Taches", t.gouttes, .4, 0, 1),
			i("feuille-coupee", "u_clip", "Feuille coupée au cadre du logo", t.decoupe, !0),
			s(.9)
		],
		presets: {
			froisse: {
				nom: "Froissé",
				valeurs: {}
			},
			plie: {
				nom: "Plié",
				valeurs: {
					ombre: "#b3b3b3",
					distorsion: -.5,
					angle: 60,
					graine: 49,
					froissage: 0,
					plis: 0,
					froisses: 1,
					gouttes: 0
				}
			},
			calque: {
				nom: "Calque",
				valeurs: {
					papier: "#ffffffb5",
					ombre: "#b3b3b3",
					distorsion: -.3,
					angle: 236,
					graine: 613,
					rugosite: .15,
					fibres: .5,
					plis: 1,
					froissage: 0,
					gouttes: 0
				}
			},
			verge: {
				nom: "Vergé",
				valeurs: {
					papier: "#ffffffa8",
					ombre: "#b3b3b3",
					distorsion: 0,
					angle: 0,
					graine: 455,
					rugosite: 1,
					fibres: .7,
					plis: 0,
					froissage: 0,
					gouttes: .2
				}
			}
		},
		instantBeau: 3e3,
		cleSurvol: "distorsion",
		masqueDefaut: !1,
		icone: t.papier
	}
}, d = (t) => typeof t == "string" && e.includes(t), f = (e) => d(e) ? e : "liquide-metal", p = [
	"aucun",
	"vitesse",
	"distorsion"
], m = ["archivo", "bodoni"], h = {
	vitesse: [
		0,
		4,
		1
	],
	marge: [
		0,
		.5,
		.12
	],
	mouvement: [
		0,
		1,
		1
	]
}, g = (e, t, n) => Math.min(n, Math.max(t, e)), _ = (e, t = .001) => {
	let n = Math.round(e / t) * t, r = Math.max(0, -Math.floor(Math.log10(t) + 1e-9));
	return Number(n.toFixed(Math.min(6, r + 1)));
};
function v(e) {
	let t = e.trim().toLowerCase();
	if (t === "transparent" || t === "aucun" || t === "") return [
		0,
		0,
		0,
		0
	];
	let n = /^#([0-9a-f]{3,8})$/.exec(t);
	if (!n) return null;
	let r = n[1];
	if ((r.length === 3 || r.length === 4) && (r = [...r].map((e) => e + e).join("")), r.length !== 6 && r.length !== 8) return null;
	let i = (e) => parseInt(r.slice(e, e + 2), 16) / 255;
	return [
		i(0),
		i(2),
		i(4),
		r.length === 8 ? i(6) : 1
	];
}
var y = (e) => typeof e == "string" && v(e) !== null;
function b(e, t) {
	let n = v(e);
	if (!n) return t;
	if (n[3] === 0) return "transparent";
	let r = (e) => Math.round(e * 255).toString(16).padStart(2, "0");
	return `#${r(n[0])}${r(n[1])}${r(n[2])}${n[3] < 1 ? r(n[3]) : ""}`;
}
function x(e, t) {
	switch (e.type) {
		case "nombre": {
			let n = typeof t == "number" ? t : Number(String(t ?? "").replace(",", "."));
			return !Number.isFinite(n) || String(t ?? "").trim() === "" ? e.defaut : _(g(n, e.min ?? -Infinity, e.max ?? Infinity), e.pas ?? .001);
		}
		case "couleur": return typeof t == "string" ? b(t, e.defaut) : e.defaut;
		case "couleurs": {
			let n = (Array.isArray(t) ? t.map(String) : typeof t == "string" ? t.split(/[\s,]+/) : []).filter(y).slice(0, e.nombre ?? 10).map((e) => b(e, "#000000"));
			return n.length ? n : [...e.defaut];
		}
		case "choix": {
			let n = String(t ?? "");
			return e.choix?.some(([e]) => e === n) ? n : e.defaut;
		}
		case "bool": return typeof t == "boolean" ? t : t === "" || t === "oui" || t === "true" || t === "1" ? !0 : t === "non" || t === "false" || t === "0" ? !1 : e.defaut;
	}
}
function S(e, t = "", n = {}) {
	let r = u[e], i = r.presets[t]?.valeurs ?? {}, a = {};
	for (let e of r.reglages) {
		let t = e.cle in n ? n[e.cle] : e.cle in i ? i[e.cle] : e.defaut;
		a[e.cle] = x(e, t);
	}
	return a;
}
function C(e = "liquide-metal") {
	return {
		matiere: e,
		src: "",
		texte: "",
		police: "archivo",
		preset: "",
		fond: "transparent",
		vitesse: 1,
		pause: !1,
		instant: -1,
		survol: "aucun",
		marge: h.marge[2],
		masque: u[e].masqueDefaut,
		sansFond: !1,
		mouvement: 1,
		valeurs: S(e)
	};
}
var w = (e) => e != null && e !== "non" && e !== "false" && e !== "0";
function T(e) {
	let t = /* @__PURE__ */ new Map();
	for (let [n, r] of e) t.set(n === "logo" ? "" : n, r);
	let n = f(t.get("")), r = u[n], i = C(n);
	i.src = (t.get("src") ?? "").trim(), i.texte = (t.get("texte") ?? "").slice(0, 40), i.police = m.includes(t.get("police") ?? "") ? t.get("police") : "archivo", i.preset = t.get("presets") && r.presets[t.get("presets")] ? t.get("presets") : "", i.fond = b(t.get("fond") ?? "transparent", "transparent");
	let a = (e) => {
		let [n, r, i] = h[e], a = Number(t.get(e));
		return t.has(e) && t.get(e) !== "" && Number.isFinite(a) ? _(g(a, n, r), .01) : i;
	};
	i.vitesse = a("vitesse"), i.marge = a("marge"), i.mouvement = a("mouvement"), i.pause = t.has("pause") && w(t.get("pause"));
	let o = Number(t.get("instant"));
	i.instant = t.has("instant") && Number.isFinite(o) && o >= 0 ? Math.round(o) : -1, i.survol = p.includes(t.get("survol") ?? "") ? t.get("survol") : "aucun", i.masque = t.has("masque") ? w(t.get("masque")) : r.masqueDefaut, i.sansFond = t.has("sans-fond") && w(t.get("sans-fond"));
	let s = {};
	for (let e of r.reglages) t.has(e.cle) && (s[e.cle] = t.get(e.cle));
	return i.valeurs = S(n, i.preset, s), i;
}
function E(e) {
	let t = [];
	for (let n = 0; n < e.attributes.length; n++) {
		let r = e.attributes[n];
		r.name === "data-logo" ? t.push(["", r.value]) : r.name.startsWith("data-logo-") && t.push([r.name.slice(10), r.value]);
	}
	return t;
}
function D(e, t, n, r, i) {
	let a = n / e.periode * 2 * Math.PI, o = e.forme === "tour" ? t + e.ampleur * r * (n / e.periode % 1) : t + e.ampleur * r * Math.sin(a);
	return e.forme === "tour" && (o = (o % 360 + 360) % 360), i && e.forme !== "tour" && (o = g(o, i.min ?? -Infinity, i.max ?? Infinity)), o;
}
function O(e, t = 0, n = 0) {
	let r = u[e.matiere], i = {
		u_colorBack: [
			0,
			0,
			0,
			0
		],
		...r.fixes,
		u_fit: 1,
		u_scale: 1,
		u_rotation: 0,
		u_offsetX: 0,
		u_offsetY: 0,
		u_originX: .5,
		u_originY: .5,
		u_worldWidth: 0,
		u_worldHeight: 0
	};
	for (let a of r.reglages) {
		let o = e.valeurs[a.cle] ?? a.defaut;
		switch (r.mouvement && r.mouvement.cle === a.cle && typeof o == "number" && (o = D(r.mouvement, o, t, e.mouvement, a)), n > 0 && a.cle === r.cleSurvol && typeof o == "number" && (o = g(o + ((a.max ?? 1) - o) * .6 * n, a.min ?? -Infinity, a.max ?? Infinity)), a.type) {
			case "nombre":
				i[a.uniforme] = o;
				break;
			case "couleur":
				i[a.uniforme] = v(String(o)) ?? [
					0,
					0,
					0,
					1
				];
				break;
			case "couleurs": {
				let e = o.map((e) => v(e) ?? [
					0,
					0,
					0,
					1
				]);
				i[a.uniforme] = e, i[`${a.uniforme}Count`] = e.length;
				break;
			}
			case "choix":
				i[a.uniforme] = a.choix.find(([e]) => e === o)?.[1] ?? 0;
				break;
			case "bool": i[a.uniforme] = !!o;
		}
	}
	return i;
}
function k(e) {
	let t = u[e.matiere];
	if (!t.halo) return null;
	let n = Number(e.valeurs["lueur-exterieure"] ?? .5);
	return Math.round(t.halo(e.survol === "distorsion" && t.cleSurvol === "lueur-exterieure" ? 1 : n) * 100) / 100;
}
function A(e, t, n, r = 8) {
	let i = t, a = n, o = -1, s = -1;
	for (let c = 0; c < n; c++) {
		let n = c * t * 4;
		for (let l = 0; l < t; l++) e[n + l * 4 + 3] > r && (l < i && (i = l), l > o && (o = l), c < a && (a = c), c > s && (s = c));
	}
	return o < 0 ? null : {
		x: i,
		y: a,
		l: o - i + 1,
		h: s - a + 1
	};
}
function j(e, t) {
	let n = Math.round(Math.max(e.l, e.h) * g(t, 0, .5));
	return {
		sx: e.x,
		sy: e.y,
		sl: e.l,
		sh: e.h,
		l: e.l + 2 * n,
		h: e.h + 2 * n,
		m: n
	};
}
function M(e, t, n, r = 4194304) {
	let i = e > 0 && Number.isFinite(e) ? e : 1, a = Math.round(g(t * Math.min(2, Math.max(1, n)), 512, 2048)), o = i >= 1 ? a : Math.round(a * i), s = i >= 1 ? Math.round(a / i) : a;
	if (o * s > r) {
		let e = Math.sqrt(r / (o * s));
		a = Math.floor(a * e), o = Math.max(1, Math.floor(o * e)), s = Math.max(1, Math.floor(s * e));
	}
	return {
		l: Math.max(1, o),
		h: Math.max(1, s)
	};
}
function N(e, t, n) {
	let r = [
		0,
		t - 1,
		(n - 1) * t,
		n * t - 1
	].map((t) => [
		e[t * 4],
		e[t * 4 + 1],
		e[t * 4 + 2],
		e[t * 4 + 3]
	]);
	if (r.some((e) => e[3] < 250)) return null;
	let i = [
		0,
		1,
		2
	].map((e) => r.reduce((t, n) => t + n[e], 0) / 4);
	return Math.max(...r.map((e) => Math.abs(e[0] - i[0]) + Math.abs(e[1] - i[1]) + Math.abs(e[2] - i[2]))) < 40 ? i : null;
}
function P(e, t, n = 48) {
	for (let r = 0; r < e.length; r += 4) {
		let i = e[r] - t[0], a = e[r + 1] - t[1], o = e[r + 2] - t[2], s = Math.sqrt(i * i + a * a + o * o);
		if (s >= n * 2) continue;
		let c = s <= n ? 0 : (s - n) / n, l = c > 0 ? 1 / c : 0;
		if (c > 0) for (let n = 0; n < 3; n++) e[r + n] = Math.round(g(t[n] + (e[r + n] - t[n]) * l, 0, 255));
		e[r + 3] = Math.round(e[r + 3] * c);
	}
}
function F(e, t = 6) {
	for (let n = 3; n < e.length; n += 4) e[n] <= t && (e[n] = 0);
}
var I = /* @__PURE__ */ new WeakMap(), L = (e, t) => t ? I.set(e, t) : I.delete(e);
async function R(e = document) {
	let t = [...e.querySelectorAll("[data-logo]")];
	e.matches?.("[data-logo]") && t.unshift(e);
	let n = t.filter((e) => !I.has(e));
	if (!n.length) return t.map((e) => I.get(e)).filter(Boolean);
	let { monterLogo: r } = await import("./logo-rendu-Cv1_tqXP.js");
	for (let e of n) I.has(e) || I.set(e, r(e));
	return t.map((e) => I.get(e)).filter(Boolean);
}
export { u as MATIERES, L as _enregistrer, A as boiteAlpha, N as couleurDesCoins, v as couleurRVBA, R as initLogo, T as lirePaires, F as nettoyerAlpha, E as pairesElement, k as rayonHalo, j as recadrage, P as retirerFond, M as tailleRaster, O as uniformesDe };
