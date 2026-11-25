/**
 * Fiche Studio du rail (src/presse/rail.ts) : six cartes à faire glisser. Lus par `rail()` du module :
 * `data-rail-seuil` (6 px, 1 au moins), `data-rail-aimant="0"` (aimanté sinon), `data-rail-sansfin` (présent),
 * `data-rail-vitesse` (36 px/s, négatif : vers la droite). Le module ne lit ni durée ni courbe : l'inertie et
 * l'aimantation ont leur constante (`projeter`, τ = 0,32 s).
 * Hors de l'inspecteur : `data-rail-piste`, `-barre`, `-precedent`, `-suivant` (structure : où sont la piste, la
 * barre et les boutons).
 */
import type { FicheParametres } from "./types.ts";

const CARTES: [string, number, number, string][] = [
  ["pont", 1728, 1150, "Le pont rouge au-dessus d'une baie"],
  ["fig", 1408, 1408, "Une figue ouverte sur une pierre"],
  ["lac", 1728, 1150, "Un lac entre des collines dorées"],
  ["flower", 1408, 1408, "Une renoncule blanche"],
  ["jardin", 1728, 1150, "Un jardin japonais, azalées rouges"],
  ["dunes", 1728, 1150, "Des dunes de sable clair"],
];

export default {
  parametres: [
    { cle: "seuil", type: "curseur", libelle: "Seuil", groupe: "Geste", min: 1, max: 40, pas: 1, defaut: 6, unite: "px", attribut: "data-rail-seuil", aide: "Distance avant qu'un appui devienne un glisser : en deçà, le clic passe." },
    { cle: "aimant", type: "interrupteur", libelle: "Aimantation", groupe: "Geste", defaut: true, attribut: "data-rail-aimant", ecriture: { oui: null, non: "0" }, aide: "À l'arrêt, le rail se cale sur le début d'une carte." },
    { cle: "sansfin", type: "interrupteur", libelle: "Sans fin", icone: "boucle", groupe: "Défilement", defaut: false, attribut: "data-rail-sansfin", aide: "Ruban sans fin : copies inertes, défilement lent automatique (en pause au survol, au focus, hors écran)." },
    { cle: "vitesse", type: "curseur", libelle: "Vitesse", groupe: "Défilement", min: -200, max: 200, pas: 2, defaut: 36, unite: "px/s", attribut: "data-rail-vitesse", si: { champ: "sansfin", valeurs: [true] }, aide: "Négative : vers la droite. Mouvement réduit : pas de défilement automatique." },
  ],
  demo: {
    racine: "[data-rail]",
    fond: "#efebe1",
    consigne: "Glissez (souris ou doigt), Maj + molette, ou ← → après Tab ; le seuil préserve les clics.",
    html: `<div class="scene-rail">
  <div class="rail" data-rail role="region" aria-label="Six photos : faites glisser ou utilisez les flèches">
    <ul class="cartes" data-rail-piste>
${CARTES.map(([n, w, h, alt]) => `      <li><a href="#${n}"><img src="plates/${n}.jpg" width="${w}" height="${h}" alt="${alt}" /></a></li>`).join("\n")}
    </ul>
  </div>
</div>`,
    css: `.scene-rail { min-height: 100vh; display: grid; align-content: center; padding: 24px 0; }
.rail { overflow: hidden; padding: 0 24px; }
.cartes { display: flex; gap: 16px; margin: 0; padding: 0; list-style: none; }
.cartes li { flex: 0 0 min(280px, 70vw); }
.cartes img { display: block; width: 100%; height: auto; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 12px; }
.cartes a:focus-visible { outline: 2px solid #d9472b; outline-offset: 3px; display: block; border-radius: 12px; }`,
  },
} satisfies FicheParametres;
