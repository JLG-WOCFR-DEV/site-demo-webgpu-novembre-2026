var e = {
	parametres: [
		{
			cle: "seuil",
			type: "curseur",
			libelle: "Seuil",
			groupe: "Geste",
			min: 1,
			max: 40,
			pas: 1,
			defaut: 6,
			unite: "px",
			attribut: "data-rail-seuil",
			aide: "Distance avant qu'un appui devienne un glisser : en deçà, le clic passe."
		},
		{
			cle: "aimant",
			type: "interrupteur",
			libelle: "Aimantation",
			groupe: "Geste",
			defaut: !0,
			attribut: "data-rail-aimant",
			ecriture: {
				oui: null,
				non: "0"
			},
			aide: "À l'arrêt, le rail se cale sur le début d'une carte."
		},
		{
			cle: "sansfin",
			type: "interrupteur",
			libelle: "Sans fin",
			icone: "boucle",
			groupe: "Défilement",
			defaut: !1,
			attribut: "data-rail-sansfin",
			aide: "Ruban sans fin : copies inertes, défilement lent automatique (en pause au survol, au focus, hors écran)."
		},
		{
			cle: "vitesse",
			type: "curseur",
			libelle: "Vitesse",
			groupe: "Défilement",
			min: -200,
			max: 200,
			pas: 2,
			defaut: 36,
			unite: "px/s",
			attribut: "data-rail-vitesse",
			si: {
				champ: "sansfin",
				valeurs: [!0]
			},
			aide: "Négative : vers la droite. Mouvement réduit : pas de défilement automatique."
		}
	],
	demo: {
		racine: "[data-rail]",
		fond: "#efebe1",
		consigne: "Glissez (souris ou doigt), Maj + molette, ou ← → après Tab ; le seuil préserve les clics.",
		html: `<div class="scene-rail">
  <div class="rail" data-rail role="region" aria-label="Six photos : faites glisser ou utilisez les flèches">
    <ul class="cartes" data-rail-piste>
${[
			[
				"pont",
				1728,
				1150,
				"Le pont rouge au-dessus d'une baie"
			],
			[
				"fig",
				1408,
				1408,
				"Une figue ouverte sur une pierre"
			],
			[
				"lac",
				1728,
				1150,
				"Un lac entre des collines dorées"
			],
			[
				"flower",
				1408,
				1408,
				"Une renoncule blanche"
			],
			[
				"jardin",
				1728,
				1150,
				"Un jardin japonais, azalées rouges"
			],
			[
				"dunes",
				1728,
				1150,
				"Des dunes de sable clair"
			]
		].map(([e, t, n, r]) => `      <li><a href="#${e}"><img src="plates/${e}.jpg" width="${t}" height="${n}" alt="${r}" /></a></li>`).join("\n")}
    </ul>
  </div>
</div>`,
		css: ".scene-rail { min-height: 100vh; display: grid; align-content: center; padding: 24px 0; }\n.rail { overflow: hidden; padding: 0 24px; }\n.cartes { display: flex; gap: 16px; margin: 0; padding: 0; list-style: none; }\n.cartes li { flex: 0 0 min(280px, 70vw); }\n.cartes img { display: block; width: 100%; height: auto; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 12px; }\n.cartes a:focus-visible { outline: 2px solid #d9472b; outline-offset: 3px; display: block; border-radius: 12px; }"
	}
};
export { e as default };
