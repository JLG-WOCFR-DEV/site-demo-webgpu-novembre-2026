/**
 * Fiche Studio du métal (src/presse/metal.ts) : un bouton à bordure de chrome. Lus par `lire()` du module :
 * le préréglage (la valeur de `data-metal`, PRESETS), `data-metal-forme` (anneau, plein, cercle, disque),
 * `data-metal-force` (0–1, 1), `data-metal-epaisseur` (px, 3 ; 1,5 sur un badge), `data-metal-ombre` (présent = oui).
 * Hors de l'inspecteur : `data-metal-texte` / `-badge` (un autre élément, une autre démo) et `-nom` / `-reflet`
 * (un couple d'éléments nommés). Listes et défauts vérifiés contre le module (parametres.test.ts).
 */
import type { FicheParametres } from "./types.ts";

export default {
  rendu: "Le chrome est un shader WebGPU ; sans carte graphique (l'aperçu ici), le module pose son repli : un dégradé CSS métallisé, statique, aux couleurs du préréglage.",
  parametres: [
    {
      cle: "preset",
      type: "selecteur",
      libelle: "Métal",
      groupe: "Matière",
      affichage: "segments",
      options: [
        { valeur: "chromatique", libelle: "Chromatique" },
        { valeur: "argent", libelle: "Argent" },
        { valeur: "or", libelle: "Or" },
        { valeur: "cuivre", libelle: "Cuivre" },
        { valeur: "noir", libelle: "Noir" },
      ],
      defaut: "chromatique",
      attribut: "data-metal",
    },
    { cle: "force", type: "curseur", libelle: "Force", groupe: "Matière", min: 0, max: 1, pas: 0.05, defaut: 1, attribut: "data-metal-force", aide: "Écoulement, dispersion, halo et attraction du pointeur." },
    {
      cle: "forme",
      type: "selecteur",
      libelle: "Forme",
      groupe: "Forme",
      affichage: "segments",
      options: [
        { valeur: "anneau", libelle: "Anneau (la bordure)" },
        { valeur: "plein", libelle: "Plein" },
        { valeur: "cercle", libelle: "Cercle" },
        { valeur: "disque", libelle: "Disque" },
      ],
      defaut: "anneau",
      attribut: "data-metal-forme",
    },
    { cle: "epaisseur", type: "curseur", libelle: "Épaisseur", groupe: "Forme", min: 1, max: 16, pas: 0.5, defaut: 3, unite: "px", attribut: "data-metal-epaisseur", si: { champ: "forme", valeurs: ["anneau", "cercle"] }, aide: "Épaisseur de l'anneau." },
    { cle: "ombre", type: "interrupteur", libelle: "Ombre intérieure", icone: "ombre", groupe: "Forme", defaut: false, attribut: "data-metal-ombre" },
  ],
  demo: {
    racine: "[data-metal]",
    fond: "#151412",
    sombre: true,
    consigne: "Le pointeur tire les bandes de reflets (avec WebGPU).",
    html: `<div class="scene-metal">
  <button type="button" class="pro" data-metal="chromatique">Passer à Pro</button>
</div>`,
    css: `.scene-metal { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.pro { min-height: 56px; padding: 0 34px; border: 0; border-radius: 999px; background: #141416; color: #f4f5f6; font: 600 18px/1 "Archivo Variable", "Archivo", "Helvetica Neue", Arial, sans-serif; cursor: pointer; }
.pro:focus-visible { outline: 2px solid #f0b429; outline-offset: 4px; }`,
  },
} satisfies FicheParametres;
