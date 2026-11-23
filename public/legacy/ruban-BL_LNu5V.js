// src/registre/parametres/ruban.ts
var e = [
	[
		"pont",
		1728,
		1150,
		"Le Golden Gate au-dessus d'une plage, falaises vertes à droite."
	],
	[
		"jardin",
		1728,
		1150,
		"Un jardin japonais : azalées rouges, pelouse et maison de bois sous les pins."
	],
	[
		"fig",
		1408,
		1408,
		"Une demi-figue posée sur une pierre près d'une fenêtre."
	],
	[
		"yosemite",
		1728,
		1150,
		"La vallée de Yosemite : parois de granit, forêt au premier plan."
	],
	[
		"flower",
		1408,
		1408,
		"Une renoncule blanche sur fond gris."
	],
	[
		"alcatraz",
		1728,
		1150,
		"L'île d'Alcatraz et son phare au milieu de la baie bleue."
	],
	[
		"cerf",
		1728,
		1150,
		"Un cerf sur un sentier bordé de troncs, dans l'herbe verte."
	],
	[
		"steel",
		1408,
		1408,
		"Un cylindre d'acier sur une ardoise noire."
	],
	[
		"lac",
		1728,
		1150,
		"Un lac de barrage entre des collines dorées."
	],
	[
		"dunes",
		1728,
		1150,
		"Des dunes de sable clair, une branche morte, des montagnes au loin."
	]
], t = [
	"torsade",
	"accordeon",
	"lentille"
], n = (e, t, n, r, i, a, o, s) => ({
	cle: e,
	type: "curseur",
	libelle: t,
	groupe: "Bande",
	min: n,
	max: r,
	pas: 1,
	unite: "px",
	defaut: i,
	attribut: a,
	si: {
		champ: "figure",
		valeurs: o
	},
	...s ? { aide: s } : {}
}), r = {
	parametres: [
		{
			cle: "figure",
			type: "selecteur",
			libelle: "Figure",
			groupe: "Figure",
			affichage: "segments",
			options: [
				{
					valeur: "torsade",
					libelle: "Torsade",
					icone: "torsade"
				},
				{
					valeur: "accordeon",
					libelle: "Accordéon",
					icone: "accordeon"
				},
				{
					valeur: "barillet",
					libelle: "Barillet",
					icone: "barillet"
				},
				{
					valeur: "lentille",
					libelle: "Lentille",
					icone: "lentille"
				},
				{
					valeur: "roue",
					libelle: "Roue",
					icone: "roue"
				}
			],
			defaut: "torsade",
			attribut: "data-ruban"
		},
		n("hauteur", "Épaisseur", 120, 640, 300, "data-ruban-hauteur", t, "L'épaisseur de la bande."),
		n("hauteurBarillet", "Hauteur", 240, 900, 520, "data-ruban-hauteur", ["barillet"], "La hauteur du composant."),
		n("hauteurRoue", "Hauteur", 240, 900, 460, "data-ruban-hauteur", ["roue"], "La hauteur du composant."),
		n("joint", "Joint", 0, 40, 6, "data-ruban-joint", [
			"torsade",
			"accordeon",
			"barillet",
			"roue"
		]),
		n("jointLentille", "Joint", 0, 40, 14, "data-ruban-joint", ["lentille"]),
		n("rayon", "Coins", 0, 48, 0, "data-ruban-rayon", [
			"torsade",
			"accordeon",
			"barillet",
			"roue"
		]),
		n("rayonLentille", "Coins", 0, 48, 18, "data-ruban-rayon", ["lentille"]),
		{
			cle: "repos",
			type: "curseur",
			libelle: "Torsion au repos",
			groupe: "Mouvement",
			min: 0,
			max: 1.5,
			pas: .05,
			defaut: .5,
			unite: "rad",
			attribut: "data-ruban-repos",
			si: {
				champ: "figure",
				valeurs: ["torsade"]
			},
			aide: "0 : bande à plat. Elle respire au repos."
		},
		{
			cle: "auto",
			type: "curseur",
			libelle: "Défilement auto",
			groupe: "Mouvement",
			min: 0,
			max: 1,
			pas: .02,
			defaut: 0,
			unite: "écran/s",
			attribut: "data-ruban-auto",
			si: {
				champ: "figure",
				valeurs: [
					"torsade",
					"accordeon",
					"barillet",
					"lentille"
				]
			},
			aide: "Suspendu au survol, au focus, pendant un geste et en mouvement réduit."
		}
	],
	demo: {
		racine: "[data-ruban]",
		fond: "#efebe1",
		consigne: "Glissez, molette horizontale (ou Maj + molette), ou les flèches après Tab.",
		html: `<div class="scene-ruban">
  <div data-ruban="torsade" aria-label="Dix photos en ruban">
${e.map(([e, t, n, r]) => `    <img src="plates/${e}.jpg" width="${t}" height="${n}" alt="${r}" />`).join("\n")}
  </div>
</div>`,
		css: ".scene-ruban { min-height: 100vh; display: grid; align-content: center; }\n[data-ruban] { --ruban-accent: #d9472b; }"
	}
};
export { r as default };
