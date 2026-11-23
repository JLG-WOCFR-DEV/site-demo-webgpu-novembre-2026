// src/registre/parametres/rouleau.ts
var e = [
	[
		"pont",
		"Pont.",
		"pont"
	],
	[
		"lac",
		"Lac.",
		"lac"
	],
	[
		"dunes",
		"Dunes.",
		"dunes"
	],
	[
		"yosemite",
		"Yosemite.",
		"yosemite"
	],
	[
		"jardin",
		"Jardin.",
		"jardin"
	],
	[
		"alcatraz",
		"Alcatraz.",
		"alcatraz"
	],
	[
		"cerf",
		"Cerf.",
		"cerf"
	],
	[
		"verre",
		"Verre.",
		"glass"
	]
], t = {
	parametres: [
		{
			cle: "hauteur",
			type: "curseur",
			libelle: "Hauteur",
			groupe: "Composant",
			min: 40,
			max: 100,
			pas: 1,
			defaut: 100,
			unite: "vh",
			attribut: "data-rouleau-hauteur",
			ecriture: { suffixe: "vh" },
			aide: "Hauteur du composant (défaut : tout l'écran)."
		},
		{
			cle: "depart",
			type: "curseur",
			libelle: "Départ",
			groupe: "Composant",
			min: 0,
			max: e.length - 1,
			pas: 1,
			defaut: 0,
			attribut: "data-rouleau-depart",
			aide: "Le titre centré au départ (à partir de 0)."
		},
		{
			cle: "invite",
			type: "texte",
			libelle: "Invite",
			groupe: "Composant",
			defaut: "Glisser pour explorer.",
			max: 60,
			attribut: "data-rouleau-invite",
			aide: "Le texte en bas à droite ; vide : aucun."
		},
		{
			cle: "largeur",
			type: "curseur",
			libelle: "Largeur",
			groupe: "Bandeau",
			min: .2,
			max: 1,
			pas: .005,
			defaut: .655,
			auto: "0,655 ; 0,88 sous 640 px",
			attribut: "data-rouleau-largeur",
			aide: "Largeur du bandeau, en fraction de la largeur."
		},
		{
			cle: "decalage",
			type: "curseur",
			libelle: "Décalage",
			groupe: "Bandeau",
			min: -.5,
			max: .5,
			pas: .005,
			defaut: .03,
			auto: "0,03 ; 0,04 sous 640 px",
			attribut: "data-rouleau-decalage",
			aide: "Décalage du centre du bandeau vers la droite."
		},
		{
			cle: "ecart",
			type: "curseur",
			libelle: "Écart",
			groupe: "Bandeau",
			min: 1,
			max: 4,
			pas: .05,
			defaut: 1.85,
			attribut: "data-rouleau-ecart",
			aide: "Écart entre deux bandeaux, en pas de titre ; 1 : collés à leur titre."
		},
		{
			cle: "respire",
			type: "interrupteur",
			libelle: "Respire",
			icone: "respire",
			groupe: "Mouvement",
			defaut: !0,
			attribut: "data-rouleau-respire",
			ecriture: {
				oui: null,
				non: "0"
			},
			aide: "Le bandeau respire au repos (sinon la boucle s'arrête tout à fait)."
		}
	],
	demo: {
		racine: "[data-rouleau]",
		fond: "#d9d9d9",
		consigne: "Glissez à la verticale, molette, ou ↑ ↓ après Tab.",
		html: `<nav data-rouleau aria-label="Lieux">
${e.map(([e, t, n]) => `  <a href="#${e}" data-rouleau-img="plates/${n}.jpg">${t}</a>`).join("\n")}
</nav>`,
		css: "[data-rouleau] { font-family: \"Archivo Variable\", \"Archivo\", \"Helvetica Neue\", Arial, sans-serif; font-variation-settings: \"wdth\" 100; }"
	}
};
export { t as default };
