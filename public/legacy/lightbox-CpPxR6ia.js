var e = {
	parametres: [],
	minimale: "Un seul attribut, sans valeur : la visionneuse se règle image par image (data-full, data-caption, figcaption), pas sur le groupe.",
	rendu: "Le vol et le fond flou sont dessinés en WebGPU ; sans carte graphique (l'aperçu ici), mêmes gestes et même dialogue sur des <img>, sans le fond flou.",
	demo: {
		racine: "[data-lightbox]",
		fond: "#151412",
		sombre: !0,
		consigne: "Cliquez une photo (ou Entrée) : ← → pour naviguer, Échap pour fermer, double-clic pour zoomer.",
		html: `<div class="scene-lightbox" data-lightbox>
${[
			[
				"yosemite",
				1728,
				1150,
				"La vallée de Yosemite, parois de granit"
			],
			[
				"alcatraz",
				1728,
				1150,
				"L'île d'Alcatraz dans la baie"
			],
			[
				"cerf",
				1728,
				1150,
				"Un cerf sur un sentier bordé de troncs"
			],
			[
				"glass",
				1728,
				1152,
				"Un verre épais couché sur le flanc"
			]
		].map(([e, t, n, r]) => `  <figure><img src="plates/${e}.jpg" width="${t}" height="${n}" alt="${r}" /><figcaption>${r}</figcaption></figure>`).join("\n")}
</div>`,
		css: ".scene-lightbox { min-height: 100vh; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; align-content: center; padding: 24px; margin: 0; }\n.scene-lightbox figure { margin: 0; }\n.scene-lightbox img { display: block; width: 100%; height: auto; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 8px; cursor: zoom-in; }\n.scene-lightbox figcaption { margin-top: 6px; color: #c9c2b3; font: 400 13px/1.4 \"Archivo Variable\", \"Archivo\", sans-serif; }"
	}
};
export { e as default };
