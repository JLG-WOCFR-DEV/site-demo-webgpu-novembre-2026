// src/registre/parametres/trace.ts
var e = {
	parametres: [
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
					valeur: "defilement",
					libelle: "Suit le défilement"
				},
				{
					valeur: "manuel",
					libelle: "Par script"
				}
			],
			defaut: "entree",
			attribut: "data-trace-quand"
		},
		{
			cle: "rejoue",
			type: "interrupteur",
			libelle: "Rejoue",
			icone: "boucle",
			groupe: "Déclencheur",
			defaut: !1,
			attribut: "data-trace-rejoue",
			aide: "Redessine à chaque nouvelle entrée dans l'écran."
		},
		{
			cle: "duree",
			type: "temps",
			libelle: "Durée",
			unite: "ms",
			min: 50,
			max: 4e3,
			pas: 10,
			defaut: 700,
			attribut: "data-trace-duree",
			mouvement: "duree",
			aide: "Durée d'un élément (× 0,7 construction, × 0,9 cote, × 0,35 hachure)."
		},
		{
			cle: "delai",
			type: "temps",
			libelle: "Délai",
			unite: "ms",
			min: 0,
			max: 5e3,
			pas: 10,
			defaut: 0,
			attribut: "data-trace-delai",
			mouvement: "delai"
		},
		{
			cle: "cascade",
			type: "temps",
			libelle: "Cascade",
			unite: "ms",
			min: 0,
			max: 1e3,
			pas: 5,
			defaut: 90,
			attribut: "data-trace-cascade",
			mouvement: "cascade",
			aide: "Écart entre deux éléments d'un même rôle (× 0,35 pour les hachures)."
		},
		{
			cle: "coteTaille",
			type: "curseur",
			libelle: "Corps des cotes",
			groupe: "Cotes",
			min: 9,
			max: 24,
			pas: 1,
			defaut: 13,
			unite: "px",
			attribut: "data-trace-cote-taille",
			cible: "[data-trace-cote]"
		},
		{
			cle: "coteFleche",
			type: "curseur",
			libelle: "Flèches",
			groupe: "Cotes",
			min: 3,
			max: 16,
			pas: .5,
			defaut: 7,
			unite: "px",
			attribut: "data-trace-cote-fleche",
			cible: "[data-trace-cote]"
		},
		{
			cle: "coteDecalage",
			type: "curseur",
			libelle: "Décalage",
			groupe: "Cotes",
			min: -24,
			max: 24,
			pas: 1,
			defaut: 6,
			unite: "px",
			attribut: "data-trace-cote-decalage",
			cible: "[data-trace-cote]",
			aide: "Écart texte / ligne ; positif : à gauche du sens de tracé (au-dessus d'une ligne tracée de gauche à droite)."
		}
	],
	demo: {
		racine: "[data-trace]",
		fond: "#f4f1ea",
		consigne: "Rejouer (R) redessine le plan, étape par étape : construction, formes, cotes, hachures.",
		html: "<div class=\"scene-trace\">\n  <svg class=\"plan\" data-trace viewBox=\"0 0 420 300\" role=\"img\" aria-labelledby=\"plan-titre\">\n    <title id=\"plan-titre\">Plan d'un bol : 180 de diamètre, 90 de hauteur</title>\n    <g data-trace-role=\"construction\"><line x1=\"210\" y1=\"20\" x2=\"210\" y2=\"250\" /><line x1=\"40\" y1=\"200\" x2=\"380\" y2=\"200\" /></g>\n    <path d=\"M120 80 Q120 200 210 200 Q300 200 300 80\" />\n    <path d=\"M110 80 H310\" />\n    <line x1=\"120\" y1=\"270\" x2=\"300\" y2=\"270\" data-trace-cote=\"180\" />\n    <line x1=\"350\" y1=\"200\" x2=\"350\" y2=\"80\" data-trace-cote=\"90\" />\n    <g data-trace-role=\"hachure\"><line x1=\"130\" y1=\"120\" x2=\"150\" y2=\"100\" /><line x1=\"140\" y1=\"140\" x2=\"170\" y2=\"110\" /><line x1=\"155\" y1=\"160\" x2=\"195\" y2=\"120\" /></g>\n  </svg>\n</div>",
		css: ".scene-trace { min-height: 100vh; display: grid; place-items: center; padding: 24px; }\n.plan { width: min(640px, 100%); height: auto; fill: none; stroke: #1d1b17; stroke-width: 1.5; stroke-linecap: round; }\n.plan [data-trace-role=\"construction\"] { stroke: #8c8578; stroke-dasharray: 4 4; stroke-width: 1; }"
	}
};
export { e as default };
