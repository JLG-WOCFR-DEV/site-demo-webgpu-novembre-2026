/**
 * Fiche Studio (minimale) de la visionneuse (src/presse/lightbox.ts) : quatre photos d'un groupe `data-lightbox`.
 * Le module n'a qu'un attribut, sans valeur : il se règle par le contenu de chaque image (`data-full`, `data-caption`,
 * `figcaption`, le `href` d'un lien qui l'entoure), pas par des réglages du groupe. Aucun paramètre n'est inventé.
 */
import type { FicheParametres } from "./types.ts";

const PHOTOS: [string, number, number, string][] = [
  ["yosemite", 1728, 1150, "La vallée de Yosemite, parois de granit"],
  ["alcatraz", 1728, 1150, "L'île d'Alcatraz dans la baie"],
  ["cerf", 1728, 1150, "Un cerf sur un sentier bordé de troncs"],
  ["glass", 1728, 1152, "Un verre épais couché sur le flanc"],
];

export default {
  parametres: [],
  minimale: "Un seul attribut, sans valeur : la visionneuse se règle image par image (data-full, data-caption, figcaption), pas sur le groupe.",
  rendu: "Le vol et le fond flou sont dessinés en WebGPU ; sans carte graphique (l'aperçu ici), mêmes gestes et même dialogue sur des <img>, sans le fond flou.",
  demo: {
    racine: "[data-lightbox]",
    fond: "#151412",
    sombre: true,
    consigne: "Cliquez une photo (ou Entrée) : ← → pour naviguer, Échap pour fermer, double-clic pour zoomer.",
    html: `<div class="scene-lightbox" data-lightbox>
${PHOTOS.map(([n, w, h, alt]) => `  <figure><img src="plates/${n}.jpg" width="${w}" height="${h}" alt="${alt}" /><figcaption>${alt}</figcaption></figure>`).join("\n")}
</div>`,
    css: `.scene-lightbox { min-height: 100vh; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; align-content: center; padding: 24px; margin: 0; }
.scene-lightbox figure { margin: 0; }
.scene-lightbox img { display: block; width: 100%; height: auto; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 8px; cursor: zoom-in; }
.scene-lightbox figcaption { margin-top: 6px; color: #c9c2b3; font: 400 13px/1.4 "Archivo Variable", "Archivo", sans-serif; }`,
  },
} satisfies FicheParametres;
