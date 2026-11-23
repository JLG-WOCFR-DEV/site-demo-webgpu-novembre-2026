// src/registre/parametres/typo.ts
var e = {
	parametres: [
		{
			cle: "effet",
			type: "selecteur",
			libelle: "Effet",
			icone: "texte",
			groupe: "Texte",
			affichage: "liste",
			options: [
				{
					valeur: "eclats",
					libelle: "Éclats"
				},
				{
					valeur: "trace",
					libelle: "Tracé"
				},
				{
					valeur: "sphere",
					libelle: "Sphère"
				},
				{
					valeur: "etire",
					libelle: "Étirement (au défilement)"
				},
				{
					valeur: "encre",
					libelle: "Encre (WebGPU)"
				},
				{
					valeur: "fragments",
					libelle: "Fragments (WebGPU)"
				}
			],
			defaut: "eclats",
			attribut: "data-typo"
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
					libelle: "Au survol"
				},
				{
					valeur: "clic",
					libelle: "Au clic"
				},
				{
					valeur: "defilement",
					libelle: "Suit le défilement"
				},
				{
					valeur: "manuel",
					libelle: "Par script"
				}
			],
			defaut: "entree",
			attribut: "data-typo-quand"
		},
		{
			cle: "rejoue",
			type: "interrupteur",
			libelle: "Rejoue",
			icone: "boucle",
			groupe: "Déclencheur",
			defaut: !1,
			attribut: "data-typo-rejoue",
			aide: "Rejoue à chaque entrée dans l'écran."
		},
		{
			cle: "duree",
			type: "temps",
			libelle: "Durée",
			unite: "s",
			min: .2,
			max: 6,
			pas: .1,
			defaut: 2.4,
			auto: "selon l'effet",
			attribut: "data-typo-duree",
			mouvement: "duree"
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
			attribut: "data-typo-delai",
			mouvement: "delai"
		}
	],
	demo: {
		racine: "[data-typo]",
		fond: "#151412",
		sombre: !0,
		consigne: "Rejouer (R) relance l'entrée. Encre et Fragments demandent WebGPU (ici : leur repli).",
		html: "<div class=\"scene-typo\">\n  <h2 class=\"mot\" data-typo=\"eclats\" tabindex=\"0\">ALANDRIA</h2>\n</div>",
		css: ".scene-typo { min-height: 100vh; display: grid; place-items: center; padding: 24px; }\n.mot { margin: 0; font: 800 clamp(48px, 13vw, 168px)/1 \"Archivo Variable\", \"Archivo\", \"Helvetica Neue\", Arial, sans-serif; letter-spacing: -0.03em; color: #f1ead9; text-align: center; }\n.mot:focus-visible { outline: 2px solid #f0b429; outline-offset: 8px; border-radius: 4px; }"
	}
};
export { e as default };
