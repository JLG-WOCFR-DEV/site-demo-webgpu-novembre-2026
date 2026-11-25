/**
 * Fiche Studio de l'autocollant (src/presse/autocollant.ts) : trois cartes cibles. Lus par `armer()` du module :
 * le texte (valeur de `data-autocollant`, « clic »), `-forme` (FORMES de forme.ts, eclair par défaut), `-couleur`
 * (#e3122b), `-encre` (#fff), `-taille` (112 px, 32 au moins). Le module ne lit ni durée ni courbe (ressort fixe).
 * `data-autocollant-cible` est la structure (les cartes) : hors de l'inspecteur. Rien au tactile.
 */
import type { FicheParametres } from "./types.ts";

export default {
  parametres: [
    { cle: "texte", type: "texte", libelle: "Texte", icone: "texte", groupe: "Autocollant", defaut: "clic", max: 16, requis: true, attribut: "data-autocollant", aide: "Le mot imprimé sur l'autocollant." },
    {
      cle: "forme",
      type: "selecteur",
      libelle: "Forme",
      groupe: "Autocollant",
      affichage: "segments",
      options: [
        { valeur: "eclair", libelle: "Éclair" },
        { valeur: "goutte", libelle: "Goutte" },
        { valeur: "cercle", libelle: "Cercle" },
        { valeur: "etoile", libelle: "Étoile" },
      ],
      defaut: "eclair",
      attribut: "data-autocollant-forme",
    },
    { cle: "couleur", type: "couleur", libelle: "Fond", icone: "pot", groupe: "Couleurs", defaut: "#e3122b", attribut: "data-autocollant-couleur" },
    { cle: "encre", type: "couleur", libelle: "Encre", groupe: "Couleurs", defaut: "#ffffff", attribut: "data-autocollant-encre" },
    { cle: "taille", type: "curseur", libelle: "Taille", groupe: "Autocollant", min: 32, max: 240, pas: 2, defaut: 112, unite: "px", attribut: "data-autocollant-taille" },
  ],
  demo: {
    racine: "[data-autocollant]",
    fond: "#efebe1",
    consigne: "Passez le pointeur sur une carte : l'autocollant suit, avec retard et bascule (rien au tactile).",
    html: `<section class="scene-autocollant" data-autocollant="clic" aria-label="Trois pièces">
  <a class="carte" href="#un" data-autocollant-cible><img src="plates/bowl.jpg" width="1728" height="1152" alt="Un bol de céramique" /><span>Bol</span></a>
  <a class="carte" href="#deux" data-autocollant-cible><img src="plates/vanilla.jpg" width="1728" height="1152" alt="Des gousses de vanille" /><span>Vanille</span></a>
  <a class="carte" href="#trois" data-autocollant-cible><img src="plates/steel.jpg" width="1408" height="1408" alt="Un cylindre d'acier sur une ardoise" /><span>Acier</span></a>
</section>`,
    css: `.scene-autocollant { min-height: 100vh; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; align-content: center; padding: 24px; font-family: "Archivo Variable", "Archivo", "Helvetica Neue", Arial, sans-serif; }
.carte { display: grid; gap: 8px; color: #1d1b17; text-decoration: none; }
.carte img { width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; border-radius: 10px; }
.carte:focus-visible { outline: 2px solid #d9472b; outline-offset: 4px; }`,
  },
} satisfies FicheParametres;
