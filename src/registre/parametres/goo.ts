/**
 * Fiche Studio de goo (src/presse/goo.ts) : la pâte et le trajet, sur le menu d'actions rond de goo.html.
 * Les décalages (`data-goo-x/y`) et les retards (`data-goo-delai`) sont propres à chaque pièce : la démo les fixe,
 * l'inspecteur ne les expose pas (un réglage global les écraserait tous).
 * Valeurs : FUSION_DEFAUT, OMBRE_DEFAUT, RESSORTS, DUREE_TRAJET du module (vérifiées par parametres.test.ts).
 */
import type { FicheParametres } from "./types.ts";

const OMBRE_DEFAUT = "0 4px 12px rgba(0,0,0,.14)";

export default {
  rendu: "La pâte (fusion, ponts, gouttes) est un champ de distance WebGPU ; sans carte graphique (l'aperçu ici), le module garde les mêmes ressorts et trajets, sans fusion : des pièces rondes qui s'écartent.",
  parametres: [
    { cle: "ouvert", type: "interrupteur", libelle: "Ouvert", icone: "ouvert", groupe: "État", defaut: false, attribut: "data-goo-ouvert", aide: "Présent : chaque pièce va à son décalage. Le bouton rond de l'aperçu bascule aussi." },
    { cle: "fill", type: "couleur", libelle: "Pâte", icone: "pot", groupe: "Pâte", defaut: "#ffffff", attribut: "data-goo-fill", aide: "Couleur de la pâte (défaut : le fond de la première pièce)." },
    { cle: "fusion", type: "curseur", libelle: "Fusion", icone: "fusion", groupe: "Pâte", min: 0, max: 60, pas: 1, defaut: 16, unite: "px", attribut: "data-goo-fusion", aide: "Rayon de fusion : en deçà, deux pièces se rejoignent par un pont." },
    { cle: "relief", type: "curseur", libelle: "Relief", icone: "relief", groupe: "Pâte", min: 0, max: 1, pas: 0.05, defaut: 0, attribut: "data-goo-relief", aide: "Liseré de lumière en haut de la forme." },
    {
      cle: "ombre",
      type: "selecteur",
      libelle: "Ombre",
      icone: "ombre",
      groupe: "Pâte",
      affichage: "segments",
      options: [
        { valeur: "aucune", libelle: "Aucune", icone: "ombre-aucune" },
        { valeur: "0 2px 6px rgba(0,0,0,.08)", libelle: "Légère", icone: "ombre-legere" },
        { valeur: OMBRE_DEFAUT, libelle: "Normale", icone: "ombre-normale" },
        { valeur: "0 10px 28px rgba(0,0,0,.28)", libelle: "Forte", icone: "ombre-forte" },
      ],
      defaut: OMBRE_DEFAUT,
      attribut: "data-goo-ombre",
    },
    {
      cle: "ressort",
      type: "selecteur",
      libelle: "Ressort",
      icone: "ressort",
      groupe: "Mouvement",
      affichage: "segments",
      options: [
        { valeur: "rebond", libelle: "Rebond", icone: "ressort-rebond" },
        { valeur: "vif", libelle: "Vif", icone: "ressort-vif" },
        { valeur: "doux", libelle: "Doux", icone: "ressort-doux" },
      ],
      defaut: "rebond",
      attribut: "data-goo-ressort",
      cible: "[data-goo-item]",
      aide: "Le ressort de chaque pièce, quand aucun trajet minuté n'est donné.",
    },
    { cle: "duree", type: "temps", libelle: "Durée", unite: "ms", min: 80, max: 2000, pas: 10, defaut: 520, attribut: "data-goo-duree", auto: "ressort", mouvement: "duree", aide: "Un trajet minuté au lieu du ressort." },
    { cle: "courbe", type: "courbe", libelle: "Courbe", defaut: "out", attribut: "data-goo-courbe", auto: "ressort", mouvement: "entree", aide: "La courbe du trajet minuté (520 ms si seule la courbe est donnée)." },
  ],
  demo: {
    racine: "[data-goo]",
    fond: "#efebe1",
    consigne: "Le bouton rond ouvre et ferme le menu ; Échap le ferme.",
    html: `<div class="scene-goo">
  <div class="menu" data-goo aria-label="Menu d'actions">
    <button class="base" type="button" data-goo-item aria-label="Actions"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
    <button class="sat" type="button" data-goo-item data-goo-x="-62" data-goo-y="-38" data-goo-delai="0" aria-label="Modifier"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg></button>
    <button class="sat" type="button" data-goo-item data-goo-x="0" data-goo-y="-72" data-goo-delai="45" aria-label="Partager"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" /></svg></button>
    <button class="sat" type="button" data-goo-item data-goo-x="62" data-goo-y="-38" data-goo-delai="90" aria-label="Aimer"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg></button>
  </div>
</div>`,
    css: `.scene-goo { min-height: 100vh; display: grid; place-items: center; padding-top: 80px; }
.menu { position: relative; width: 56px; height: 56px; }
.menu > [data-goo-item] { position: absolute; display: grid; place-items: center; border: 0; padding: 0; border-radius: 50%; background: #fff; color: #1d1b17; cursor: pointer; }
.menu > .base { inset: 0; }
.menu > .sat { left: 6px; top: 6px; width: 44px; height: 44px; }
.menu button:focus-visible { outline: 2px solid #d9472b; outline-offset: 3px; }
.ic { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.menu .base .ic { transition: rotate .35s cubic-bezier(.16, 1, .3, 1); }
.menu[data-goo-ouvert] .base .ic { rotate: 90deg; }
@media (prefers-reduced-motion: reduce) { .menu .base .ic { transition: none; } }`,
  },
} satisfies FicheParametres;
