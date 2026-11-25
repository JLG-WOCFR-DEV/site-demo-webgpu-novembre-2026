/**
 * Fiche Studio du menu roulant (src/presse/rouleau.ts) : huit lieux. Rendu WebGPU (le bandeau ondule) ; sans lui,
 * chaque bandeau est une image en `object-fit: cover`, même défilement. Largeur et décalage changent sous 640 px :
 * `auto`. Les variables CSS (--rouleau-corps…) ne sont pas des attributs : hors de l'inspecteur.
 */
import type { FicheParametres } from "./types.ts";

const LIEUX: [string, string, string][] = [
  ["pont", "Pont.", "pont"],
  ["lac", "Lac.", "lac"],
  ["dunes", "Dunes.", "dunes"],
  ["yosemite", "Yosemite.", "yosemite"],
  ["jardin", "Jardin.", "jardin"],
  ["alcatraz", "Alcatraz.", "alcatraz"],
  ["cerf", "Cerf.", "cerf"],
  ["verre", "Verre.", "glass"],
];

export default {
  rendu: "Le bandeau-tissu est dessiné en WebGPU ; sans carte graphique (l'aperçu ici), chaque bandeau est une image fixe en object-fit: cover, même défilement des titres.",
  parametres: [
    { cle: "hauteur", type: "curseur", libelle: "Hauteur", groupe: "Composant", min: 40, max: 100, pas: 1, defaut: 100, unite: "vh", attribut: "data-rouleau-hauteur", ecriture: { suffixe: "vh" }, aide: "Hauteur du composant (défaut : tout l'écran)." },
    { cle: "depart", type: "curseur", libelle: "Départ", groupe: "Composant", min: 0, max: LIEUX.length - 1, pas: 1, defaut: 0, attribut: "data-rouleau-depart", aide: "Le titre centré au départ (à partir de 0)." },
    { cle: "invite", type: "texte", libelle: "Invite", groupe: "Composant", defaut: "Glisser pour explorer.", max: 60, attribut: "data-rouleau-invite", aide: "Le texte en bas à droite ; vide : aucun." },
    { cle: "largeur", type: "curseur", libelle: "Largeur", groupe: "Bandeau", min: 0.2, max: 1, pas: 0.005, defaut: 0.655, auto: "0,655 ; 0,88 sous 640 px", attribut: "data-rouleau-largeur", aide: "Largeur du bandeau, en fraction de la largeur." },
    { cle: "decalage", type: "curseur", libelle: "Décalage", groupe: "Bandeau", min: -0.5, max: 0.5, pas: 0.005, defaut: 0.03, auto: "0,03 ; 0,04 sous 640 px", attribut: "data-rouleau-decalage", aide: "Décalage du centre du bandeau vers la droite." },
    { cle: "ecart", type: "curseur", libelle: "Écart", groupe: "Bandeau", min: 1, max: 4, pas: 0.05, defaut: 1.85, attribut: "data-rouleau-ecart", aide: "Écart entre deux bandeaux, en pas de titre ; 1 : collés à leur titre." },
    { cle: "respire", type: "interrupteur", libelle: "Respire", icone: "respire", groupe: "Mouvement", defaut: true, attribut: "data-rouleau-respire", ecriture: { oui: null, non: "0" }, aide: "Le bandeau respire au repos (sinon la boucle s'arrête tout à fait)." },
  ],
  demo: {
    racine: "[data-rouleau]",
    fond: "#d9d9d9",
    consigne: "Glissez à la verticale, molette, ou ↑ ↓ après Tab.",
    html: `<nav data-rouleau aria-label="Lieux">
${LIEUX.map(([id, t, img]) => `  <a href="#${id}" data-rouleau-img="plates/${img}.jpg">${t}</a>`).join("\n")}
</nav>`,
    css: `[data-rouleau] { font-family: "Archivo Variable", "Archivo", "Helvetica Neue", Arial, sans-serif; font-variation-settings: "wdth" 100; }`,
  },
} satisfies FicheParametres;
