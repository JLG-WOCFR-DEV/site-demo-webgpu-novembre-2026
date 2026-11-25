/**
 * Fiche Studio de la typographie cinétique (src/presse/typo.ts) : un mot en capitales. `encre` et `fragments` sont
 * dessinés en WebGPU (sans lui : flou CSS, clip-path) ; les quatre autres sont en DOM. La durée par défaut dépend de
 * l'effet (`DUREES`) : `auto`. Listes : EFFETS, QUANDS du module (vérifiées par parametres.test.ts).
 */
import type { FicheParametres } from "./types.ts";

export default {
  rendu: "Encre et Fragments sont dessinés en WebGPU ; sans carte graphique (l'aperçu ici), leur repli CSS (flou, clip-path). Les quatre autres effets sont en DOM et identiques.",
  parametres: [
    {
      cle: "effet",
      type: "selecteur",
      libelle: "Effet",
      icone: "texte",
      groupe: "Texte",
      affichage: "liste",
      options: [
        { valeur: "eclats", libelle: "Éclats" },
        { valeur: "trace", libelle: "Tracé" },
        { valeur: "sphere", libelle: "Sphère" },
        { valeur: "etire", libelle: "Étirement (au défilement)" },
        { valeur: "encre", libelle: "Encre (WebGPU)" },
        { valeur: "fragments", libelle: "Fragments (WebGPU)" },
      ],
      defaut: "eclats",
      attribut: "data-typo",
    },
    {
      cle: "quand",
      type: "selecteur",
      libelle: "Quand",
      groupe: "Déclencheur",
      affichage: "liste",
      options: [
        { valeur: "entree", libelle: "À l'entrée dans l'écran" },
        { valeur: "chargement", libelle: "Au chargement" },
        { valeur: "survol", libelle: "Au survol" },
        { valeur: "clic", libelle: "Au clic" },
        { valeur: "defilement", libelle: "Suit le défilement" },
        { valeur: "manuel", libelle: "Par script" },
      ],
      defaut: "entree",
      attribut: "data-typo-quand",
    },
    { cle: "rejoue", type: "interrupteur", libelle: "Rejoue", icone: "boucle", groupe: "Déclencheur", defaut: false, attribut: "data-typo-rejoue", aide: "Rejoue à chaque entrée dans l'écran." },
    { cle: "duree", type: "temps", libelle: "Durée", unite: "s", min: 0.2, max: 6, pas: 0.1, defaut: 2.4, auto: "selon l'effet", attribut: "data-typo-duree", mouvement: "duree" },
    { cle: "delai", type: "temps", libelle: "Délai", unite: "s", min: 0, max: 5, pas: 0.05, defaut: 0, attribut: "data-typo-delai", mouvement: "delai" },
  ],
  demo: {
    racine: "[data-typo]",
    fond: "#151412",
    sombre: true,
    consigne: "Rejouer (R) relance l'entrée. Encre et Fragments demandent WebGPU (ici : leur repli).",
    html: `<div class="scene-typo">
  <h2 class="mot" data-typo="eclats" tabindex="0">ALANDRIA</h2>
</div>`,
    css: `.scene-typo { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.mot { margin: 0; font: 800 clamp(48px, 13vw, 168px)/1 "Archivo Variable", "Archivo", "Helvetica Neue", Arial, sans-serif; letter-spacing: -0.03em; color: #f1ead9; text-align: center; }
.mot:focus-visible { outline: 2px solid #f0b429; outline-offset: 8px; border-radius: 4px; }`,
  },
} satisfies FicheParametres;
