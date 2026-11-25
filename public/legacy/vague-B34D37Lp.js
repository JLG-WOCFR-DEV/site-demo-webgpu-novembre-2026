// src/registre/parametres/vague.ts
var e = {
	minimale: "Trois réglages seulement : le module ne lit rien d'autre ; les vues et les contrôles sont la structure du HTML.",
	rendu: "La vague est dessinée par le moteur Presse (WebGPU), absent de l'aperçu : on y voit le repli du module, un fondu enchaîné entre les deux vues (comme sans WebGPU ou en mouvement réduit).",
	parametres: [
		{
			cle: "type",
			type: "selecteur",
			libelle: "Forme",
			groupe: "Vague",
			affichage: "segments",
			options: [
				{
					valeur: "verticale",
					libelle: "Verticale"
				},
				{
					valeur: "horizontale",
					libelle: "Horizontale"
				},
				{
					valeur: "centre",
					libelle: "Depuis le centre"
				}
			],
			defaut: "verticale",
			attribut: "data-vague-type",
			aide: "Verticale : elle monte depuis le bouton ; horizontale : elle traverse depuis un bord ; centre : un anneau s'ouvre."
		},
		{
			cle: "palette",
			type: "selecteur",
			libelle: "Palette",
			groupe: "Vague",
			affichage: "liste",
			options: [
				{
					valeur: "coloree",
					libelle: "Colorée"
				},
				{
					valeur: "verte",
					libelle: "Verte"
				},
				{
					valeur: "ocean",
					libelle: "Océan"
				},
				{
					valeur: "couchant",
					libelle: "Couchant"
				},
				{
					valeur: "mono",
					libelle: "Mono"
				}
			],
			defaut: "coloree",
			attribut: "data-vague-palette"
		},
		{
			cle: "duree",
			type: "temps",
			libelle: "Durée",
			unite: "s",
			min: .3,
			max: 3,
			pas: .05,
			defaut: 1.1,
			attribut: "data-vague-duree",
			mouvement: "duree",
			aide: "La traversée de la vague (avec le moteur) ; le fondu de repli garde 0,35 s."
		}
	],
	demo: {
		racine: "[data-vague]",
		fond: "#efebe1",
		consigne: "Confirmer lance la vague, Revenir la referme.",
		html: "<div class=\"scene-vague\">\n  <div class=\"carte-vague\" data-vague>\n    <section data-vague-vue>\n      <p class=\"k\">Virement</p>\n      <p class=\"n\">240,00 €</p>\n      <p class=\"t\">À Axelle Charlet · aujourd'hui</p>\n      <button type=\"button\" data-vague-vers=\"suivante\">Confirmer</button>\n    </section>\n    <section data-vague-vue hidden>\n      <p class=\"k\">Reçu</p>\n      <p class=\"n\">Envoyé ✓</p>\n      <p class=\"t\">Référence KRG-2026-1113</p>\n      <button type=\"button\" class=\"fantome\" data-vague-vers=\"retour\">Revenir</button>\n    </section>\n  </div>\n</div>",
		css: ".scene-vague { min-height: 100vh; display: grid; place-items: center; padding: 24px; }\n.carte-vague { width: min(360px, 100%); border-radius: 22px; background: #1d1b17; color: #f4f1ea; font-family: \"Archivo Variable\", \"Archivo\", \"Helvetica Neue\", Arial, sans-serif; }\n.carte-vague section { padding: 28px; }\n.carte-vague .k { margin: 0; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; opacity: .7; }\n.carte-vague .n { margin: 10px 0 4px; font-size: 40px; font-weight: 700; }\n.carte-vague .t { margin: 0 0 24px; opacity: .75; }\n.carte-vague button { min-height: 44px; padding: 0 20px; border: 0; border-radius: 999px; background: #f4f1ea; color: #1d1b17; font: 600 15px/1 inherit; cursor: pointer; }\n.carte-vague button.fantome { background: transparent; color: #f4f1ea; box-shadow: inset 0 0 0 1px currentColor; }\n.carte-vague button:focus-visible { outline: 2px solid #f0b429; outline-offset: 3px; }"
	}
};
export { e as default };
