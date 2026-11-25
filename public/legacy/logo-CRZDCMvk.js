import { COMMUNS as e, MATIERES as t, MATIERES_NOMS as n, POLICES as r, SURVOLS as i } from "./logo-DJ6z-YGZ.js";
// src/registre/parametres/logo.ts
var a = {
	"Répétition des bandes": "Répétition",
	"Distorsion intérieure": "Distorsion int.",
	"Largeur des cannelures": "Cannelures",
	"Le logo suit la feuille": "Suit la feuille"
}, o = (e) => a[e] ?? (e.length <= 20 ? e : `${e.slice(0, 19)}…`), s = (...e) => e.map((e) => e.replace(/-(\w)/g, (e, t) => t.toUpperCase())).map((e, t) => t ? e[0].toUpperCase() + e.slice(1) : e).join("");
function c(e, n) {
	let r = {
		cle: s(e, n.cle),
		libelle: o(n.libelle),
		groupe: t[e].nom,
		attribut: `data-logo-${n.cle}`,
		si: {
			champ: "matiere",
			valeurs: [e]
		},
		auto: "selon la matière et le préréglage"
	};
	return n.type === "nombre" ? {
		...r,
		type: "curseur",
		min: n.min ?? 0,
		max: n.max ?? 1,
		pas: n.pas ?? .01,
		defaut: n.defaut
	} : n.type === "couleur" ? {
		...r,
		type: "couleur",
		defaut: n.defaut
	} : n.type === "choix" ? {
		...r,
		type: "selecteur",
		affichage: (n.choix?.length ?? 0) <= 5 ? "segments" : "liste",
		options: n.choix.map(([e, , t]) => ({
			valeur: e,
			libelle: t
		})),
		defaut: n.defaut
	} : null;
}
function l(e) {
	let n = t[e].presets;
	return {
		cle: s("presets", e),
		type: "selecteur",
		libelle: "Préréglage",
		groupe: t[e].nom,
		affichage: "liste",
		options: [{
			valeur: "",
			libelle: "Aucun"
		}, ...Object.entries(n).map(([e, t]) => ({
			valeur: e,
			libelle: t.nom
		}))],
		defaut: "",
		attribut: "data-logo-presets",
		si: {
			champ: "matiere",
			valeurs: [e]
		},
		aide: "La base de la matière ; les réglages ci-dessous la complètent."
	};
}
var u = n.flatMap((e) => [l(e), ...t[e].reglages.filter((e) => e.principal).map((t) => c(e, t)).filter((e) => !!e)]), d = {
	rendu: "Rendu WebGL2 (Paper Shaders), joué tel quel dans l'aperçu quand le navigateur a WebGL2 ; sinon le module montre le logo d'origine (ici, le mot en HTML), et en mouvement réduit une image fixe à l'« instant beau » de la matière.",
	parametres: [
		{
			cle: "matiere",
			type: "selecteur",
			libelle: "Matière",
			icone: "texte",
			groupe: "Logo",
			affichage: "liste",
			options: n.map((e) => ({
				valeur: e,
				libelle: t[e].nom
			})),
			defaut: "liquide-metal",
			attribut: "data-logo"
		},
		{
			cle: "texte",
			type: "texte",
			libelle: "Texte",
			groupe: "Logo",
			defaut: "Presse",
			max: 40,
			requis: !0,
			attribut: "data-logo-texte",
			aide: "Un texte rastérisé (40 signes au plus) à la place d'un fichier."
		},
		{
			cle: "police",
			type: "selecteur",
			libelle: "Police",
			groupe: "Logo",
			affichage: "segments",
			options: r.map((e) => ({
				valeur: e,
				libelle: e === "archivo" ? "Archivo" : "Bodoni"
			})),
			defaut: "archivo",
			attribut: "data-logo-police"
		},
		{
			cle: "marge",
			type: "curseur",
			libelle: "Marge",
			groupe: "Logo",
			min: e.marge[0],
			max: e.marge[1],
			pas: .01,
			defaut: e.marge[2],
			attribut: "data-logo-marge",
			aide: "Autour du logo recadré, en part de son grand côté."
		},
		{
			cle: "masque",
			type: "interrupteur",
			libelle: "Masque",
			groupe: "Logo",
			defaut: !1,
			auto: "selon la matière (oui pour verre, trames, tramage)",
			attribut: "data-logo-masque",
			ecriture: {
				oui: "oui",
				non: "non"
			},
			aide: "L'effet est découpé à la silhouette du logo."
		},
		...u,
		{
			cle: "vitesse",
			type: "curseur",
			libelle: "Vitesse",
			groupe: "Animation",
			min: e.vitesse[0],
			max: e.vitesse[1],
			pas: .05,
			defaut: e.vitesse[2],
			attribut: "data-logo-vitesse"
		},
		{
			cle: "mouvement",
			type: "curseur",
			libelle: "Mouvement",
			groupe: "Animation",
			min: e.mouvement[0],
			max: e.mouvement[1],
			pas: .05,
			defaut: e.mouvement[2],
			attribut: "data-logo-mouvement",
			aide: "Le mouvement que Presse ajoute aux filtres fixes de Paper (trames, verre, lentille, papier)."
		},
		{
			cle: "pause",
			type: "interrupteur",
			libelle: "Pause",
			groupe: "Animation",
			defaut: !1,
			attribut: "data-logo-pause",
			ecriture: {
				oui: "oui",
				non: null
			},
			aide: "Une image fixe (à l'instant beau de la matière)."
		},
		{
			cle: "survol",
			type: "selecteur",
			libelle: "Survol",
			groupe: "Animation",
			affichage: "segments",
			options: i.map((e) => ({
				valeur: e,
				libelle: e === "aucun" ? "Aucun" : e === "vitesse" ? "Vitesse" : "Distorsion"
			})),
			defaut: "aucun",
			attribut: "data-logo-survol",
			aide: "La vitesse ou la distorsion suit le pointeur."
		}
	],
	demo: {
		racine: "[data-logo]",
		fond: "#151412",
		sombre: !0,
		consigne: "Survol : la vitesse ou la distorsion suit le pointeur (réglage Survol).",
		html: "<div class=\"scene-logo\">\n  <div class=\"logo\" data-logo=\"liquide-metal\" data-logo-texte=\"Presse\" role=\"img\" aria-label=\"Presse\"></div>\n</div>",
		css: ".scene-logo { min-height: 100vh; display: grid; place-items: center; padding: 24px; }\n.logo { width: min(640px, 90vw); aspect-ratio: 2 / 1; }"
	}
};
export { s as cleDe, d as default };
