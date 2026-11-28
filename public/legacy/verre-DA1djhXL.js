// src/registre/parametres/verre.ts
var e = {
	parametres: [
		{
			cle: "materiau",
			type: "selecteur",
			libelle: "Matériau",
			groupe: "Verre",
			affichage: "segments",
			options: [{
				valeur: "clair",
				libelle: "Clair"
			}, {
				valeur: "teinte",
				libelle: "Teinté"
			}],
			defaut: "clair",
			attribut: "data-verre-groupe",
			aide: "Clair : le fond traverse. Teinté : un voile de couleur, utile pour la lisibilité du texte."
		},
		{
			cle: "moteur",
			type: "selecteur",
			libelle: "Moteur",
			groupe: "Verre",
			affichage: "segments",
			options: [{
				valeur: "css",
				libelle: "CSS"
			}, {
				valeur: "liquide",
				libelle: "Liquid Glass"
			}],
			defaut: "css",
			attribut: "data-verre-moteur",
			aide: "CSS : backdrop-filter et filtre SVG, aucun canvas. Liquid Glass : le moteur WebGL2 de Liquid Glass UI (MIT), chargé à la demande ; sans WebGL2, le verre CSS reste."
		},
		{
			cle: "vivant",
			type: "interrupteur",
			libelle: "Fond animé",
			groupe: "Verre",
			defaut: !1,
			attribut: "data-verre-vivant",
			si: {
				champ: "moteur",
				valeurs: ["liquide"]
			},
			ecriture: {
				oui: "",
				non: null
			},
			aide: "Repeint le fond à chaque image (vidéo, canvas qui bouge derrière le verre). Plus coûteux."
		},
		{
			cle: "voile",
			type: "curseur",
			libelle: "Voile",
			groupe: "Verre",
			min: 0,
			max: 1,
			pas: .02,
			defaut: .6,
			attribut: "data-verre-voile",
			si: {
				champ: "moteur",
				valeurs: ["liquide"]
			},
			aide: "Couvrance du voile du verre clair : 0 laisse tout passer, 1 couvre. Blanc sur une page claire, noir sur une page sombre (ou la teinte)."
		},
		{
			cle: "teinte",
			type: "couleur",
			libelle: "Teinte",
			groupe: "Verre",
			defaut: "#7aa8ff",
			attribut: "data-verre-teinte",
			si: {
				champ: "materiau",
				valeurs: ["teinte"]
			},
			aide: "Couleur du voile du verre teinté."
		},
		{
			cle: "refraction",
			type: "curseur",
			libelle: "Réfraction",
			groupe: "Lentille",
			min: 0,
			max: 80,
			pas: 1,
			unite: "px",
			defaut: 44,
			attribut: "data-verre-refraction",
			aide: "Déplacement du fond au bord, en px. 0 : plus de déformation (le flou reste)."
		},
		{
			cle: "biseau",
			type: "curseur",
			libelle: "Biseau",
			groupe: "Lentille",
			min: 6,
			max: 48,
			pas: 1,
			unite: "px",
			defaut: 18,
			attribut: "data-verre-biseau",
			aide: "Largeur de la bande du bord qui réfracte. Au centre, le fond passe sans bouger."
		},
		{
			cle: "flou",
			type: "curseur",
			libelle: "Flou",
			groupe: "Lentille",
			min: 0,
			max: 24,
			pas: 1,
			unite: "px",
			defaut: 6,
			attribut: "data-verre-flou",
			aide: "Flou du fond, appliqué après la déformation."
		},
		{
			cle: "ressort",
			type: "curseur",
			libelle: "Ressort ζ",
			groupe: "Appui",
			min: .2,
			max: 1,
			pas: .02,
			defaut: .42,
			attribut: "data-verre-ressort",
			si: {
				champ: "moteur",
				valeurs: ["css"]
			},
			aide: "Amortissement du retour d'appui : 0,2 rebondit, 1 revient sans dépasser. Fréquence fixe (4 Hz)."
		}
	],
	demo: {
		racine: "[data-verre-groupe]",
		fond: "#0d1020",
		sombre: !0,
		consigne: "Survolez pour le reflet, appuyez puis relâchez pour le ressort. La réfraction se voit sur les traits fins derrière le verre (moteur Chromium) ; ailleurs, le repli est un verre flou.",
		html: "<div class=\"scene-verre\" data-verre-groupe=\"clair\">\n  <div class=\"vr-rangee\">\n    <button type=\"button\" class=\"vr-bouton\" data-verre>Acheter</button>\n    <div class=\"vr-onglets\" role=\"tablist\" aria-label=\"Rayons\" data-verre>\n      <button type=\"button\" role=\"tab\" aria-selected=\"true\" onclick=\"for (const t of this.parentNode.children) t.setAttribute('aria-selected', String(t === this))\">Femme</button>\n      <button type=\"button\" role=\"tab\" aria-selected=\"false\" onclick=\"for (const t of this.parentNode.children) t.setAttribute('aria-selected', String(t === this))\">Homme</button>\n      <button type=\"button\" role=\"tab\" aria-selected=\"false\" onclick=\"for (const t of this.parentNode.children) t.setAttribute('aria-selected', String(t === this))\">Enfant</button>\n    </div>\n    <span class=\"vr-badge\" data-verre>Nouveau</span>\n  </div>\n  <article class=\"vr-carte\" data-verre>\n    <h2>Manteau de pluie</h2>\n    <p>Coton ciré, doublure chaude. 240 €</p>\n  </article>\n</div>",
		css: ".scene-verre { min-height: 100vh; box-sizing: border-box; display: grid; gap: 40px; align-content: center; justify-items: start; padding: 48px 28px; color: #fff; font: 16px/1.5 \"Archivo Variable\", system-ui, sans-serif;\n  background:\n    repeating-linear-gradient(0deg, rgb(255 255 255 / 0.55) 0 1px, transparent 1px 28px),\n    repeating-linear-gradient(90deg, rgb(255 255 255 / 0.28) 0 1px, transparent 1px 28px),\n    radial-gradient(circle at 18% 22%, #ff5f8d, transparent 42%),\n    radial-gradient(circle at 82% 70%, #35c8ff, transparent 46%),\n    #1b1f3a; }\n.vr-rangee { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; }\n.vr-bouton { min-height: 48px; padding: 0 26px; border: 0; border-radius: 999px; color: inherit; font: inherit; font-weight: 700; cursor: pointer; }\n.vr-onglets { display: flex; gap: 4px; padding: 4px; border-radius: 999px; }\n.vr-onglets [role=\"tab\"] { min-height: 40px; padding: 0 16px; border: 0; border-radius: 999px; background: transparent; color: inherit; font: inherit; cursor: pointer; }\n.vr-onglets [aria-selected=\"true\"] { background: rgb(255 255 255 / 0.28); }\n.vr-badge { padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 14px; }\n.vr-carte { width: min(360px, 100%); box-sizing: border-box; padding: 22px 24px; border-radius: 28px; }\n.vr-carte h2 { margin: 0 0 4px; font-size: 22px; }\n.vr-carte p { margin: 0; opacity: 0.9; }"
	}
};
export { e as default };
