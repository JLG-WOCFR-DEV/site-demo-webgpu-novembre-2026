/**
 * Fiche Studio du ruban (src/presse/ruban.ts) : douze photos. Rendu WebGPU ; sans lui, une bande CSS à
 * `scroll-snap` (c'est ce que l'aperçu montre sans carte graphique). Hauteur, joint et rayon ont des défauts propres
 * à la figure : un paramètre par cas, montré selon la figure (`si`), qui écrivent le même attribut.
 */
import type { FicheParametres, Parametre } from "./types.ts";

const PLATES: [string, number, number, string][] = [
  ["pont", 1728, 1150, "Le Golden Gate au-dessus d'une plage, falaises vertes à droite."],
  ["jardin", 1728, 1150, "Un jardin japonais : azalées rouges, pelouse et maison de bois sous les pins."],
  ["fig", 1408, 1408, "Une demi-figue posée sur une pierre près d'une fenêtre."],
  ["yosemite", 1728, 1150, "La vallée de Yosemite : parois de granit, forêt au premier plan."],
  ["flower", 1408, 1408, "Une renoncule blanche sur fond gris."],
  ["alcatraz", 1728, 1150, "L'île d'Alcatraz et son phare au milieu de la baie bleue."],
  ["cerf", 1728, 1150, "Un cerf sur un sentier bordé de troncs, dans l'herbe verte."],
  ["steel", 1408, 1408, "Un cylindre d'acier sur une ardoise noire."],
  ["lac", 1728, 1150, "Un lac de barrage entre des collines dorées."],
  ["dunes", 1728, 1150, "Des dunes de sable clair, une branche morte, des montagnes au loin."],
];

const BANDE = ["torsade", "accordeon", "lentille"];
const px = (cle: string, libelle: string, min: number, max: number, defaut: number, attribut: string, figures: string[], aide?: string): Parametre => ({
  cle,
  type: "curseur",
  libelle,
  groupe: "Bande",
  min,
  max,
  pas: 1,
  unite: "px",
  defaut,
  attribut,
  si: { champ: "figure", valeurs: figures },
  ...(aide ? { aide } : {}),
});

export default {
  rendu: "La bande est dessinée en WebGPU ; sans carte graphique (l'aperçu ici), le repli du module : une bande CSS à scroll-snap, mêmes gestes, sans figure 3D.",
  parametres: [
    {
      cle: "figure",
      type: "selecteur",
      libelle: "Figure",
      groupe: "Figure",
      affichage: "segments",
      options: [
        { valeur: "torsade", libelle: "Torsade", icone: "torsade" },
        { valeur: "accordeon", libelle: "Accordéon", icone: "accordeon" },
        { valeur: "barillet", libelle: "Barillet", icone: "barillet" },
        { valeur: "lentille", libelle: "Lentille", icone: "lentille" },
        { valeur: "roue", libelle: "Roue", icone: "roue" },
      ],
      defaut: "torsade",
      attribut: "data-ruban",
    },
    px("hauteur", "Épaisseur", 120, 640, 300, "data-ruban-hauteur", BANDE, "L'épaisseur de la bande."),
    px("hauteurBarillet", "Hauteur", 240, 900, 520, "data-ruban-hauteur", ["barillet"], "La hauteur du composant."),
    px("hauteurRoue", "Hauteur", 240, 900, 460, "data-ruban-hauteur", ["roue"], "La hauteur du composant."),
    px("joint", "Joint", 0, 40, 6, "data-ruban-joint", ["torsade", "accordeon", "barillet", "roue"]),
    px("jointLentille", "Joint", 0, 40, 14, "data-ruban-joint", ["lentille"]),
    px("rayon", "Coins", 0, 48, 0, "data-ruban-rayon", ["torsade", "accordeon", "barillet", "roue"]),
    px("rayonLentille", "Coins", 0, 48, 18, "data-ruban-rayon", ["lentille"]),
    { cle: "repos", type: "curseur", libelle: "Torsion au repos", groupe: "Mouvement", min: 0, max: 1.5, pas: 0.05, defaut: 0.5, unite: "rad", attribut: "data-ruban-repos", si: { champ: "figure", valeurs: ["torsade"] }, aide: "0 : bande à plat. Elle respire au repos." },
    { cle: "auto", type: "curseur", libelle: "Défilement auto", groupe: "Mouvement", min: 0, max: 1, pas: 0.02, defaut: 0, unite: "écran/s", attribut: "data-ruban-auto", si: { champ: "figure", valeurs: ["torsade", "accordeon", "barillet", "lentille"] }, aide: "Suspendu au survol, au focus, pendant un geste et en mouvement réduit." },
  ],
  demo: {
    racine: "[data-ruban]",
    fond: "#efebe1",
    consigne: "Glissez, molette horizontale (ou Maj + molette), ou les flèches après Tab.",
    html: `<div class="scene-ruban">
  <div data-ruban="torsade" aria-label="Dix photos en ruban">
${PLATES.map(([n, w, h, alt]) => `    <img src="plates/${n}.jpg" width="${w}" height="${h}" alt="${alt}" />`).join("\n")}
  </div>
</div>`,
    css: `.scene-ruban { min-height: 100vh; display: grid; align-content: center; }
[data-ruban] { --ruban-accent: #d9472b; }`,
  },
} satisfies FicheParametres;
