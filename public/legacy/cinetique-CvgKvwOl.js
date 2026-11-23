// src/registre/parametres/cinetique.ts
var e = [
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
], t = {
	eclot: "Éclot",
	etire: "Étire"
}, n = (e) => t[e] ?? e[0].toUpperCase() + e.slice(1), r = {
	parametres: [
		{
			cle: "preset",
			type: "selecteur",
			libelle: "Entrée",
			icone: "texte",
			groupe: "Texte",
			affichage: "liste",
			options: e.map((e) => ({
				valeur: e,
				libelle: n(e)
			})),
			defaut: "monte",
			attribut: "data-cinetique",
			aide: "Le préréglage : comment chaque morceau entre."
		},
		{
			cle: "par",
			type: "selecteur",
			libelle: "Par",
			groupe: "Texte",
			affichage: "segments",
			options: [
				{
					valeur: "ligne",
					libelle: "Par ligne",
					icone: "par-ligne"
				},
				{
					valeur: "mot",
					libelle: "Par mot",
					icone: "par-mot"
				},
				{
					valeur: "lettre",
					libelle: "Par lettre",
					icone: "par-lettre"
				}
			],
			defaut: "mot",
			attribut: "data-cinetique-par"
		},
		{
			cle: "ordre",
			type: "selecteur",
			libelle: "Ordre",
			groupe: "Texte",
			affichage: "segments",
			options: [
				{
					valeur: "debut",
					libelle: "Du début",
					icone: "ordre-debut"
				},
				{
					valeur: "fin",
					libelle: "De la fin",
					icone: "ordre-fin"
				},
				{
					valeur: "centre",
					libelle: "Du centre",
					icone: "ordre-centre"
				},
				{
					valeur: "bords",
					libelle: "Des bords",
					icone: "ordre-bords"
				},
				{
					valeur: "hasard",
					libelle: "Au hasard",
					icone: "ordre-hasard"
				}
			],
			defaut: "debut",
			attribut: "data-cinetique-ordre"
		},
		{
			cle: "quand",
			type: "selecteur",
			libelle: "Quand",
			groupe: "Déclencheur",
			affichage: "liste",
			options: [
				{
					valeur: "entree",
					libelle: "À l'entrée dans l'écran"
				},
				{
					valeur: "chargement",
					libelle: "Au chargement"
				},
				{
					valeur: "survol",
					libelle: "Au survol ou au focus"
				},
				{
					valeur: "manuel",
					libelle: "Par script"
				}
			],
			defaut: "entree",
			attribut: "data-cinetique-quand"
		},
		{
			cle: "rejoue",
			type: "interrupteur",
			libelle: "Rejoue",
			icone: "boucle",
			groupe: "Déclencheur",
			defaut: !1,
			attribut: "data-cinetique-rejoue",
			aide: "Rejoue à chaque entrée dans l'écran."
		},
		{
			cle: "duree",
			type: "temps",
			libelle: "Durée",
			unite: "s",
			min: .05,
			max: 4,
			pas: .05,
			defaut: .75,
			auto: "selon l'unité et le préréglage",
			attribut: "data-cinetique-duree",
			mouvement: "duree",
			aide: "Durée d'un morceau."
		},
		{
			cle: "delai",
			type: "temps",
			libelle: "Délai",
			unite: "s",
			min: 0,
			max: 5,
			pas: .05,
			defaut: 0,
			attribut: "data-cinetique-delai",
			mouvement: "delai"
		},
		{
			cle: "cascade",
			type: "temps",
			libelle: "Cascade",
			unite: "s",
			min: 0,
			max: .5,
			pas: .005,
			defaut: .06,
			auto: "selon l'unité",
			attribut: "data-cinetique-cascade",
			mouvement: "cascade",
			aide: "Écart entre deux morceaux."
		},
		{
			cle: "sortie",
			type: "temps",
			libelle: "Sortie après",
			unite: "s",
			min: .2,
			max: 10,
			pas: .1,
			defaut: 2,
			auto: "reste",
			attribut: "data-cinetique-sortie",
			mouvement: "delai",
			aide: "Secondes après l'arrivée au bout desquelles le texte repart."
		},
		{
			cle: "courbe",
			type: "courbe",
			libelle: "Entrée",
			defaut: "out",
			auto: "celle du préréglage",
			attribut: "data-cinetique-courbe",
			mouvement: "entree",
			aide: "La courbe d'entrée d'un morceau (ease-out conseillé)."
		},
		{
			cle: "courbeSortie",
			type: "courbe",
			libelle: "Sortie",
			defaut: "in",
			auto: "celle du préréglage",
			attribut: "data-cinetique-courbe-sortie",
			mouvement: "sortie",
			aide: "La courbe de sortie (ease-in conseillé) : au survol, avec « Sortie après » ou « Rejoue »."
		}
	],
	demo: {
		racine: "[data-cinetique]",
		fond: "#f4f1ea",
		consigne: "Rejouer (R) relance l'entrée ; « Quand : au survol » se joue au pointeur ou au focus.",
		html: "<div class=\"scene-cinetique\">\n  <h2 class=\"titre\" data-cinetique=\"monte\" tabindex=\"0\">Livrer vendredi.<br />Dormir samedi.</h2>\n</div>",
		css: ".scene-cinetique { min-height: 100vh; display: grid; place-items: center; padding: 24px; }\n.titre { margin: 0; font: 500 clamp(44px, 9vw, 112px)/1.02 \"Bodoni Moda Variable\", \"Bodoni Moda\", Didot, Georgia, serif; letter-spacing: -0.02em; color: #1d1b17; text-align: center; }\n.titre:focus-visible { outline: 2px solid #d9472b; outline-offset: 8px; border-radius: 4px; }"
	}
};
export { r as default };
