/**
 * Fiche Studio de la forme-masque (src/presse/forme.ts) : une photo vue à travers une forme qui grandit. Lus par
 * `monter()` : la forme (valeur de `data-forme`, FORMES ou l'id d'un path), `-quand` (defilement par défaut, entree),
 * `-hauteur` (en défilement, 260vh, posée en variable CSS), `-taille` (0,42), et en entrée `-duree` (1400 ms) et
 * `-fin` (0–1, 1). Le module ne lit pas de courbe : le mouvement d'entrée a sa propre douceur (`lisser`).
 * Hors de l'inspecteur : `data-forme-scene` et `data-forme-media` (structure de la démo).
 */
import type { FicheParametres } from "./types.ts";

export default {
  parametres: [
    {
      cle: "forme",
      type: "selecteur",
      libelle: "Forme",
      groupe: "Forme",
      affichage: "segments",
      options: [
        { valeur: "eclair", libelle: "Éclair" },
        { valeur: "goutte", libelle: "Goutte" },
        { valeur: "cercle", libelle: "Cercle" },
        { valeur: "etoile", libelle: "Étoile" },
      ],
      defaut: "goutte",
      attribut: "data-forme",
    },
    { cle: "taille", type: "curseur", libelle: "Taille au départ", groupe: "Forme", min: 0.05, max: 1, pas: 0.01, defaut: 0.42, attribut: "data-forme-taille", aide: "Hauteur de la forme au départ, en part du petit côté de la scène." },
    {
      cle: "quand",
      type: "selecteur",
      libelle: "Quand",
      groupe: "Déclencheur",
      affichage: "segments",
      options: [
        { valeur: "defilement", libelle: "Au défilement" },
        { valeur: "entree", libelle: "À l'entrée" },
      ],
      defaut: "defilement",
      attribut: "data-forme-quand",
      aide: "Au défilement : la scène colle et la forme suit le défilement ; à l'entrée : elle grandit une fois.",
    },
    { cle: "hauteur", type: "curseur", libelle: "Hauteur", groupe: "Déclencheur", min: 120, max: 600, pas: 10, defaut: 260, unite: "vh", attribut: "data-forme-hauteur", ecriture: { suffixe: "vh" }, si: { champ: "quand", valeurs: ["defilement"] }, aide: "Longueur de défilement de la section." },
    { cle: "fin", type: "curseur", libelle: "Fin", groupe: "Déclencheur", min: 0, max: 1, pas: 0.01, defaut: 1, attribut: "data-forme-fin", si: { champ: "quand", valeurs: ["entree"] }, aide: "Où s'arrêter : 1 couvre l'écran." },
    { cle: "duree", type: "temps", libelle: "Durée", unite: "ms", min: 200, max: 5000, pas: 50, defaut: 1400, attribut: "data-forme-duree", mouvement: "duree", si: { champ: "quand", valeurs: ["entree"] } },
  ],
  demo: {
    racine: "[data-forme]",
    fond: "#1d1b17",
    sombre: true,
    consigne: "Faites défiler l'aperçu (mode « Au défilement ») ; « À l'entrée » se rejoue avec R.",
    html: `<section class="film" data-forme="goutte">
  <div data-forme-scene>
    <img data-forme-media src="plates/dunes.jpg" width="1728" height="1150" alt="Des dunes de sable clair vues à travers une goutte qui grandit" />
    <h2 class="titre">Automne</h2>
  </div>
</section>
<p class="suite">La suite de la page.</p>`,
    css: `.film [data-forme-media] { width: 100%; height: 100%; object-fit: cover; }
.film .titre { position: absolute; left: 24px; bottom: 24px; margin: 0; color: #f4f1ea; font: 700 clamp(40px, 9vw, 96px)/1 "Archivo Variable", "Archivo", "Helvetica Neue", Arial, sans-serif; opacity: calc(1 - var(--forme-p, 0)); }
.suite { min-height: 60vh; margin: 0; padding: 48px 24px; color: #f4f1ea; font: 400 18px/1.5 "Archivo Variable", "Archivo", sans-serif; }`,
  },
} satisfies FicheParametres;
