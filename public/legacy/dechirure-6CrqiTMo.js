// src/registre/parametres/dechirure.ts
var e = {
	parametres: [
		{
			cle: "cote",
			type: "selecteur",
			libelle: "Côté",
			groupe: "Bord",
			affichage: "segments",
			options: [
				{
					valeur: "haut",
					libelle: "Haut",
					icone: "sens-avant"
				},
				{
					valeur: "bas",
					libelle: "Bas",
					icone: "sens-arriere"
				},
				{
					valeur: "gauche",
					libelle: "Gauche",
					icone: "fleche-gauche"
				},
				{
					valeur: "droite",
					libelle: "Droite",
					icone: "fleche-droite"
				}
			],
			defaut: "haut",
			attribut: "data-dechirure",
			aide: "Le côté déchiré : le papier dépasse de ce côté, par-dessus la voisine."
		},
		{
			cle: "graine",
			type: "texte",
			libelle: "Graine",
			groupe: "Bord",
			defaut: "pied",
			max: 40,
			attribut: "data-dechirure-graine",
			aide: "Un nombre ou un mot : la même graine donne la même déchirure."
		},
		{
			cle: "amplitude",
			type: "curseur",
			libelle: "Amplitude",
			groupe: "Bord",
			min: 2,
			max: 80,
			pas: 1,
			defaut: 22,
			unite: "px",
			attribut: "data-dechirure-amplitude",
			aide: "Profondeur de la déchirure."
		},
		{
			cle: "fibre",
			type: "curseur",
			libelle: "Fibre",
			groupe: "Papier",
			min: 0,
			max: 20,
			pas: .5,
			defaut: 5,
			unite: "px",
			attribut: "data-dechirure-fibre",
			aide: "Largeur moyenne du liseré blanc ; 0 : aucun."
		},
		{
			cle: "couleur",
			type: "couleur",
			libelle: "Papier",
			icone: "pot",
			groupe: "Papier",
			defaut: "#1d1b17",
			auto: "le fond calculé de l'élément",
			attribut: "data-dechirure-couleur"
		},
		{
			cle: "ombre",
			type: "interrupteur",
			libelle: "Ombre",
			icone: "ombre",
			groupe: "Papier",
			defaut: !0,
			attribut: "data-dechirure-ombre",
			ecriture: {
				oui: null,
				non: "0"
			},
			aide: "L'ombre portée sur la section voisine."
		}
	],
	demo: {
		racine: "[data-dechirure]",
		fond: "#efebe1",
		consigne: "Changez la graine pour tirer une autre déchirure ; le bord est recalculé au redimensionnement.",
		html: "<div class=\"scene-dechirure\">\n  <section class=\"haut\"><h2>Nouveautés</h2><p>Le papier du pied de page dépasse sur cette section, avec un liseré de fibre et une ombre.</p></section>\n  <footer class=\"pied\" data-dechirure=\"haut\" data-dechirure-graine=\"pied\"><p>Presse · atelier de papier</p></footer>\n</div>",
		css: ".scene-dechirure { min-height: 100vh; display: grid; grid-template-rows: 1fr auto; font-family: \"Archivo Variable\", \"Archivo\", \"Helvetica Neue\", Arial, sans-serif; }\n.scene-dechirure .haut { padding: 48px 24px; background: #efebe1; color: #1d1b17; }\n.scene-dechirure h2 { margin: 0 0 8px; font-size: 32px; }\n.scene-dechirure .pied { padding: 64px 24px; background: #1d1b17; color: #f4f1ea; }"
	}
};
export { e as default };
