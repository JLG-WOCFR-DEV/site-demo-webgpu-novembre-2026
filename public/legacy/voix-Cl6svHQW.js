// src/registre/parametres/voix.ts
var e = {
	rendu: "La lueur est un shader WebGPU ; sans carte graphique (l'aperçu ici), le module pose son repli : des dégradés CSS pilotés par le niveau, la même machine d'états.",
	parametres: [
		{
			cle: "etat",
			type: "selecteur",
			libelle: "État",
			groupe: "État",
			affichage: "segments",
			options: [
				{
					valeur: "repos",
					libelle: "Repos"
				},
				{
					valeur: "ecoute",
					libelle: "Écoute"
				},
				{
					valeur: "reflexion",
					libelle: "Réflexion"
				},
				{
					valeur: "parole",
					libelle: "Parole"
				}
			],
			defaut: "repos",
			attribut: "data-voix-etat",
			aide: "L'état de départ ; le module le tient ensuite à jour. Écoute n'ouvre pas le micro (il faut un clic)."
		},
		{
			cle: "demo",
			type: "interrupteur",
			libelle: "Démonstration",
			groupe: "État",
			defaut: !0,
			attribut: "data-voix-demo",
			aide: "Sans micro (refusé, page non sécurisée) : un niveau synthétique crédible à la place."
		},
		{
			cle: "auto",
			type: "texte",
			libelle: "Après silence",
			groupe: "État",
			defaut: "",
			max: 40,
			attribut: "data-voix-auto",
			aide: "« reflexion 2.5 [1.2] » : après 1,2 s de silence en écoute, réflexion 2,5 s puis repos. Vide : rien."
		},
		{
			cle: "ecran",
			type: "interrupteur",
			libelle: "Plein écran",
			groupe: "Lueur",
			defaut: !1,
			attribut: "data-voix",
			ecriture: {
				oui: "ecran",
				non: ""
			},
			aide: "La lueur monte du bas de tout le conteneur."
		},
		{
			cle: "palette",
			type: "selecteur",
			libelle: "Palette",
			groupe: "Lueur",
			affichage: "segments",
			options: [
				{
					valeur: "aurore",
					libelle: "Aurore"
				},
				{
					valeur: "ocean",
					libelle: "Océan"
				},
				{
					valeur: "braise",
					libelle: "Braise"
				},
				{
					valeur: "mono",
					libelle: "Mono"
				}
			],
			defaut: "aurore",
			attribut: "data-voix-palette"
		},
		{
			cle: "couleur",
			type: "couleur",
			libelle: "Teinte",
			groupe: "Lueur",
			defaut: "#8f5bff",
			attribut: "data-voix-couleur",
			si: {
				champ: "palette",
				valeurs: ["mono"]
			}
		},
		{
			cle: "force",
			type: "curseur",
			libelle: "Force",
			groupe: "Lueur",
			min: 0,
			max: 2,
			pas: .05,
			defaut: 1,
			attribut: "data-voix-force"
		},
		{
			cle: "hauteur",
			type: "curseur",
			libelle: "Hauteur",
			groupe: "Lueur",
			min: .05,
			max: 1.5,
			pas: .05,
			defaut: .9,
			auto: "0,9 ; 0,6 en plein écran",
			attribut: "data-voix-hauteur",
			aide: "Jusqu'où la lueur monte, en part de la hauteur du champ."
		},
		{
			cle: "debord",
			type: "curseur",
			libelle: "Débord",
			groupe: "Lueur",
			min: 0,
			max: 200,
			pas: 1,
			defaut: 24,
			unite: "px",
			auto: "24 px ; 0 en plein écran",
			attribut: "data-voix-debord",
			aide: "Le halo qui déborde du champ."
		},
		{
			cle: "fond",
			type: "selecteur",
			libelle: "Fond",
			groupe: "Lueur",
			affichage: "segments",
			options: [{
				valeur: "clair",
				libelle: "Clair (multiplier)"
			}, {
				valeur: "sombre",
				libelle: "Sombre (éclairer)"
			}],
			defaut: "clair",
			auto: "deviné sur le fond de la page",
			attribut: "data-voix-fond"
		}
	],
	demo: {
		racine: "[data-voix]",
		fond: "#efebe1",
		consigne: "Le bouton micro ouvre le micro (jamais avant) ; refusé ou indisponible ici : la démonstration prend le relais.",
		html: "<div class=\"scene-voix\">\n  <div class=\"champ\" data-voix data-voix-demo>\n    <textarea aria-label=\"Message\" placeholder=\"Parlez, ou écrivez…\" rows=\"1\"></textarea>\n    <button type=\"button\" class=\"rond\" data-voix-micro aria-label=\"Parler\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><rect x=\"9\" y=\"3\" width=\"6\" height=\"12\" rx=\"3\" /><path d=\"M5 11a7 7 0 0 0 14 0M12 18v3\" /></svg></button>\n  </div>\n</div>",
		css: ".scene-voix { min-height: 100vh; display: grid; place-items: center; padding: 24px; }\n.champ { width: min(560px, 100%); display: flex; align-items: flex-end; gap: 10px; padding: 12px 12px 12px 18px; border-radius: 22px; background: #fbf9f4; border: 1px solid #ddd6c6; }\n.champ textarea { flex: 1; min-height: 52px; resize: none; border: 0; outline: 0; background: transparent; font: 400 16px/1.5 \"Archivo Variable\", \"Archivo\", \"Helvetica Neue\", Arial, sans-serif; color: #1d1b17; padding: 6px 0; }\n.rond { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 99px; border: 1px solid #d8d1c1; background: #fff; color: #1d1b17; cursor: pointer; }\n.rond svg { width: 18px; height: 18px; }\n.rond[aria-pressed=\"true\"] { background: #1d1b18; color: #fff; }\n.rond:focus-visible { outline: 2px solid #d9472b; outline-offset: 3px; }"
	}
};
export { e as default };
