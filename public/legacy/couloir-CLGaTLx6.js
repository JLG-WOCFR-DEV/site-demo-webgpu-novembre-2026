import { BORNES as e, DEFAUTS as t, PILOTAGES as n, PRESETS as r, PRESETS_NOMS as i } from "./couloir-CzNE_ibs.js";
// src/registre/parametres/couloir.ts
var a = (n, r, i, a, o = {}) => ({
	cle: n,
	type: "curseur",
	libelle: r,
	groupe: i,
	min: e[n][0],
	max: e[n][1],
	pas: a,
	defaut: t[n],
	attribut: `data-couloir-${n}`,
	...o
}), o = (e) => n.filter((t) => e.includes(t)).join(" ");
function s(e) {
	let t = {};
	for (let [n, r] of Object.entries(e)) n === "pilotage" ? t.pilotage = o(r) : n === "sens" ? t.sens = r === -1 ? "arriere" : "avant" : r != null && (t[n] = r);
	return t;
}
var c = [
	[
		"pont",
		960,
		639,
		"Le pont rouge au-dessus d'une baie, une plage et des vagues au premier plan"
	],
	[
		"fig",
		960,
		960,
		"Une figue ouverte, rouge vif, posée sur un rebord de pierre au soleil"
	],
	[
		"lac",
		960,
		639,
		"Un lac de montagne entre des collines sèches, sous un ciel strié"
	],
	[
		"flower",
		960,
		960,
		"Une renoncule blanche, seule, sur un fond gris"
	],
	[
		"jardin",
		960,
		639,
		"Un jardin fleuri de rouge devant une maison de bois, sous les pins"
	],
	[
		"glass",
		960,
		640,
		"Un verre épais couché sur le flanc, reflets noirs et ambrés"
	],
	[
		"yosemite",
		960,
		639,
		"Une vallée glaciaire entre des falaises de granit, des forêts au premier plan"
	],
	[
		"dunes",
		960,
		639,
		"Des dunes de sable clair, une branche morte, des montagnes au loin"
	],
	[
		"cerf",
		960,
		639,
		"Un cerf sur un sentier bordé de troncs, dans l'herbe verte"
	]
], l = {
	parametres: [
		{
			cle: "presets",
			type: "selecteur",
			libelle: "Base",
			icone: "base",
			groupe: "Préréglage",
			affichage: "liste",
			options: [{
				valeur: "",
				libelle: "Aucune"
			}, ...i.map((e) => ({
				valeur: e,
				libelle: e[0].toUpperCase() + e.slice(1)
			}))],
			defaut: "",
			attribut: "data-couloir-presets",
			aide: "Un point de départ ; les autres réglages le corrigent."
		},
		a("profondeur", "Profondeur", "Perspective", .05, { aide: "Force de la perspective, en panneaux : petit = fuite brutale." }),
		{
			cle: "angle",
			type: "angle",
			libelle: "Angle",
			groupe: "Perspective",
			min: e.angle[0],
			max: e.angle[1],
			pas: 1,
			defaut: t.angle,
			boucle: !1,
			attribut: "data-couloir-angle",
			aide: "Inclinaison du mur autour du point de fuite."
		},
		a("horizon", "Horizon", "Perspective", 1, { unite: "%" }),
		{
			cle: "cote",
			type: "selecteur",
			libelle: "Fuite",
			groupe: "Perspective",
			affichage: "segments",
			options: [{
				valeur: "gauche",
				libelle: "Vers la gauche",
				icone: "fleche-gauche"
			}, {
				valeur: "droite",
				libelle: "Vers la droite",
				icone: "fleche-droite"
			}],
			defaut: t.cote,
			attribut: "data-couloir-cote"
		},
		{
			cle: "mode",
			type: "selecteur",
			libelle: "Pose",
			groupe: "Perspective",
			affichage: "segments",
			options: [{
				valeur: "mur",
				libelle: "Mur",
				icone: "mur"
			}, {
				valeur: "plafond",
				libelle: "Au sol",
				icone: "sol"
			}],
			defaut: t.mode,
			attribut: "data-couloir-mode"
		},
		{
			cle: "mur",
			type: "selecteur",
			libelle: "Murs",
			groupe: "Perspective",
			affichage: "segments",
			options: [
				{
					valeur: "un",
					libelle: "Un mur",
					icone: "murs-un"
				},
				{
					valeur: "deux",
					libelle: "Deux murs (tunnel)",
					icone: "murs-deux"
				},
				{
					valeur: "trois",
					libelle: "Trois murs",
					icone: "murs-trois"
				}
			],
			defaut: t.mur,
			attribut: "data-couloir-mur"
		},
		a("ouverture", "Ouverture", "Perspective", .01, {
			si: {
				champ: "mur",
				valeurs: ["deux", "trois"]
			},
			aide: "Écart entre les murs au premier plan."
		}),
		a("hauteur", "Hauteur", "Panneaux", .01, { aide: "Panneau de tête, × le plus petit côté." }),
		a("largeur", "Proportion", "Panneaux", .01, { aide: "Largeur ÷ hauteur d'un panneau." }),
		a("bande", "Bande", "Panneaux", .005, { aide: "Hauteur de la bande lointaine." }),
		a("ecart", "Écart", "Panneaux", 1, { unite: "px" }),
		{
			cle: "filet",
			type: "couleur",
			libelle: "Filet",
			groupe: "Panneaux",
			defaut: t.filet,
			attribut: "data-couloir-filet"
		},
		a("vide", "Vides", "Panneaux", .01, { aide: "Part de panneaux vides, gris pâle." }),
		a("survol", "Survol", "Panneaux", .01, { aide: "Le panneau survolé grandit de cette fraction." }),
		{
			cle: "fond",
			type: "couleur",
			libelle: "Fond",
			groupe: "Panneaux",
			defaut: "#f2f3ef",
			auto: "transparent",
			attribut: "data-couloir-fond"
		},
		a("vitesse", "Vitesse", "Mouvement", .01, { aide: "Panneaux par seconde, pointeur tout à droite." }),
		a("inertie", "Inertie", "Mouvement", .01, { aide: "0 : sec ; 1 : glisse longtemps." }),
		{
			cle: "pilotage",
			type: "selecteur",
			libelle: "Pilotage",
			groupe: "Mouvement",
			affichage: "liste",
			options: [
				{
					valeur: "pointeur glisser",
					libelle: "Pointeur et glisser"
				},
				{
					valeur: "pointeur glisser auto",
					libelle: "Pointeur, glisser, automatique"
				},
				{
					valeur: "pointeur glisser auto molette",
					libelle: "Pointeur, glisser, automatique, molette"
				},
				{
					valeur: "glisser molette",
					libelle: "Glisser et molette"
				},
				{
					valeur: "defilement",
					libelle: "Défilement de la page"
				},
				{
					valeur: "auto",
					libelle: "Automatique seulement"
				}
			],
			defaut: o(t.pilotage),
			attribut: "data-couloir-pilotage"
		},
		{
			cle: "sens",
			type: "selecteur",
			libelle: "Sens",
			groupe: "Mouvement",
			affichage: "segments",
			options: [{
				valeur: "avant",
				libelle: "Vers soi",
				icone: "sens-avant"
			}, {
				valeur: "arriere",
				libelle: "Vers le fond",
				icone: "sens-arriere"
			}],
			defaut: "avant",
			attribut: "data-couloir-sens"
		},
		{
			cle: "sansfin",
			type: "interrupteur",
			libelle: "Sans fin",
			icone: "boucle",
			groupe: "Mouvement",
			defaut: t.sansfin,
			attribut: "data-couloir-sansfin",
			ecriture: {
				oui: "oui",
				non: "non"
			}
		},
		{
			cle: "duree",
			type: "temps",
			libelle: "Durée",
			unite: "s",
			min: .05,
			max: 10,
			pas: .05,
			defaut: .6,
			auto: "amorti",
			attribut: "data-couloir-duree",
			mouvement: "duree",
			aide: "Aller à un panneau (flèches, boutons) en un trajet minuté."
		},
		{
			cle: "courbe",
			type: "courbe",
			libelle: "Courbe",
			defaut: "out",
			auto: "amorti",
			attribut: "data-couloir-courbe",
			mouvement: "entree",
			aide: "La courbe de ce trajet. Le défilement libre garde l'inertie."
		},
		a("aberration", "Franges", "Vitesse", .01, { aide: "Franges RVB selon la vitesse ; 0 : aucune." }),
		a("flou", "Flou", "Vitesse", .01, { aide: "Flou de mouvement selon la vitesse." }),
		{
			cle: "ouvre",
			type: "selecteur",
			libelle: "Clic",
			groupe: "Interaction",
			affichage: "segments",
			options: [{
				valeur: "non",
				libelle: "Rien (le lien garde son clic)",
				icone: "clic-aucun"
			}, {
				valeur: "visionneuse",
				libelle: "Visionneuse",
				icone: "visionneuse"
			}],
			defaut: t.ouvre,
			attribut: "data-couloir-ouvre"
		}
	],
	prereglages: {
		cle: "presets",
		valeurs: Object.fromEntries(i.map((e) => [e, s(r[e])]))
	},
	demo: {
		racine: "[data-couloir]",
		fond: "#f2f3ef",
		consigne: "Le pointeur pilote la vitesse ; glissez, ou prenez le couloir au clavier (Tab puis flèches).",
		html: `<ul class="mur" data-couloir aria-label="Paysages en couloir : flèches pour avancer">
${c.map(([e, t, n, r]) => `  <li><img src="img/${e}-960.webp" width="${t}" height="${n}" alt="${r}" /></li>`).join("\n")}
</ul>`,
		css: ".mur { position: absolute; inset: 0; }\n.mur:not(.couloir) { display: flex; gap: 6px; overflow-x: auto; align-items: center; padding: 0 16px; list-style: none; margin: 0; }\n.mur:not(.couloir) li { flex: 0 0 auto; height: 60vh; }\n.mur:not(.couloir) img { height: 100%; width: auto; }"
	}
};
export { l as default, o as pilotageTexte };
