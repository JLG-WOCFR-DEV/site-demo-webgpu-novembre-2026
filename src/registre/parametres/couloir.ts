/**
 * Fiche Studio du couloir (src/presse/couloir.ts). Bornes, défauts et préréglages viennent du module lui-même
 * (`BORNES`, `DEFAUTS`, `PRESETS`) : la partie pure du module, sans DOM à l'import. `data-couloir-presets` donne une
 * base que les autres attributs corrigent : les défauts affichés suivent le préréglage (`prereglages`).
 * Non exposé : `data-couloir-commandes` (un #id de la page).
 */
import { BORNES, DEFAUTS, PILOTAGES, PRESETS, PRESETS_NOMS, type Reglages } from "../../presse/couloir.ts";
import type { Valeur } from "../schema/index.ts";
import type { FicheParametres, Parametre } from "./types.ts";

type CleNombre = keyof typeof BORNES;
/** Un curseur borné par le module. */
const curseur = (cle: CleNombre, libelle: string, groupe: string, pas: number, extra: Partial<Parametre> & { unite?: string; aide?: string; icone?: string } = {}): Parametre =>
  ({ cle, type: "curseur", libelle, groupe, min: BORNES[cle][0], max: BORNES[cle][1], pas, defaut: DEFAUTS[cle] as number, attribut: `data-couloir-${cle}`, ...extra }) as Parametre;

/** Les mots de pilotage, dans l'ordre canonique du module (l'ordre n'a pas de sens pour lui). */
export const pilotageTexte = (p: readonly string[]) => PILOTAGES.filter((x) => p.includes(x)).join(" ");

/** Un préréglage du module, dit avec les valeurs des paramètres. */
function valeursDe(p: Partial<Reglages>): Record<string, Valeur> {
  const out: Record<string, Valeur> = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === "pilotage") out.pilotage = pilotageTexte(v as string[]);
    else if (k === "sens") out.sens = v === -1 ? "arriere" : "avant";
    else if (v !== null && v !== undefined) out[k] = v as Valeur;
  }
  return out;
}

const IMAGES: [string, number, number, string][] = [
  ["pont", 960, 639, "Le pont rouge au-dessus d'une baie, une plage et des vagues au premier plan"],
  ["fig", 960, 960, "Une figue ouverte, rouge vif, posée sur un rebord de pierre au soleil"],
  ["lac", 960, 639, "Un lac de montagne entre des collines sèches, sous un ciel strié"],
  ["flower", 960, 960, "Une renoncule blanche, seule, sur un fond gris"],
  ["jardin", 960, 639, "Un jardin fleuri de rouge devant une maison de bois, sous les pins"],
  ["glass", 960, 640, "Un verre épais couché sur le flanc, reflets noirs et ambrés"],
  ["yosemite", 960, 639, "Une vallée glaciaire entre des falaises de granit, des forêts au premier plan"],
  ["dunes", 960, 639, "Des dunes de sable clair, une branche morte, des montagnes au loin"],
  ["cerf", 960, 639, "Un cerf sur un sentier bordé de troncs, dans l'herbe verte"],
];

export default {
  parametres: [
    {
      cle: "presets",
      type: "selecteur",
      libelle: "Base",
      icone: "base",
      groupe: "Préréglage",
      affichage: "liste",
      options: [{ valeur: "", libelle: "Aucune" }, ...PRESETS_NOMS.map((n) => ({ valeur: n, libelle: n[0]!.toUpperCase() + n.slice(1) }))],
      defaut: "",
      attribut: "data-couloir-presets",
      aide: "Un point de départ ; les autres réglages le corrigent.",
    },
    curseur("profondeur", "Profondeur", "Perspective", 0.05, { aide: "Force de la perspective, en panneaux : petit = fuite brutale." }),
    { cle: "angle", type: "angle", libelle: "Angle", groupe: "Perspective", min: BORNES.angle[0], max: BORNES.angle[1], pas: 1, defaut: DEFAUTS.angle, boucle: false, attribut: "data-couloir-angle", aide: "Inclinaison du mur autour du point de fuite." },
    curseur("horizon", "Horizon", "Perspective", 1, { unite: "%" }),
    {
      cle: "cote",
      type: "selecteur",
      libelle: "Fuite",
      groupe: "Perspective",
      affichage: "segments",
      options: [
        { valeur: "gauche", libelle: "Vers la gauche", icone: "fleche-gauche" },
        { valeur: "droite", libelle: "Vers la droite", icone: "fleche-droite" },
      ],
      defaut: DEFAUTS.cote,
      attribut: "data-couloir-cote",
    },
    {
      cle: "mode",
      type: "selecteur",
      libelle: "Pose",
      groupe: "Perspective",
      affichage: "segments",
      options: [
        { valeur: "mur", libelle: "Mur", icone: "mur" },
        { valeur: "plafond", libelle: "Au sol", icone: "sol" },
      ],
      defaut: DEFAUTS.mode,
      attribut: "data-couloir-mode",
    },
    {
      cle: "mur",
      type: "selecteur",
      libelle: "Murs",
      groupe: "Perspective",
      affichage: "segments",
      options: [
        { valeur: "un", libelle: "Un mur", icone: "murs-un" },
        { valeur: "deux", libelle: "Deux murs (tunnel)", icone: "murs-deux" },
        { valeur: "trois", libelle: "Trois murs", icone: "murs-trois" },
      ],
      defaut: DEFAUTS.mur,
      attribut: "data-couloir-mur",
    },
    curseur("ouverture", "Ouverture", "Perspective", 0.01, { si: { champ: "mur", valeurs: ["deux", "trois"] }, aide: "Écart entre les murs au premier plan." }),
    curseur("hauteur", "Hauteur", "Panneaux", 0.01, { aide: "Panneau de tête, × le plus petit côté." }),
    curseur("largeur", "Proportion", "Panneaux", 0.01, { aide: "Largeur ÷ hauteur d'un panneau." }),
    curseur("bande", "Bande", "Panneaux", 0.005, { aide: "Hauteur de la bande lointaine." }),
    curseur("ecart", "Écart", "Panneaux", 1, { unite: "px" }),
    { cle: "filet", type: "couleur", libelle: "Filet", groupe: "Panneaux", defaut: DEFAUTS.filet, attribut: "data-couloir-filet" },
    curseur("vide", "Vides", "Panneaux", 0.01, { aide: "Part de panneaux vides, gris pâle." }),
    curseur("survol", "Survol", "Panneaux", 0.01, { aide: "Le panneau survolé grandit de cette fraction." }),
    { cle: "fond", type: "couleur", libelle: "Fond", groupe: "Panneaux", defaut: "#f2f3ef", auto: "transparent", attribut: "data-couloir-fond" },
    curseur("vitesse", "Vitesse", "Mouvement", 0.01, { aide: "Panneaux par seconde, pointeur tout à droite." }),
    curseur("inertie", "Inertie", "Mouvement", 0.01, { aide: "0 : sec ; 1 : glisse longtemps." }),
    {
      cle: "pilotage",
      type: "selecteur",
      libelle: "Pilotage",
      groupe: "Mouvement",
      affichage: "liste",
      options: [
        { valeur: "pointeur glisser", libelle: "Pointeur et glisser" },
        { valeur: "pointeur glisser auto", libelle: "Pointeur, glisser, automatique" },
        { valeur: "pointeur glisser auto molette", libelle: "Pointeur, glisser, automatique, molette" },
        { valeur: "glisser molette", libelle: "Glisser et molette" },
        { valeur: "defilement", libelle: "Défilement de la page" },
        { valeur: "auto", libelle: "Automatique seulement" },
      ],
      defaut: pilotageTexte(DEFAUTS.pilotage),
      attribut: "data-couloir-pilotage",
    },
    {
      cle: "sens",
      type: "selecteur",
      libelle: "Sens",
      groupe: "Mouvement",
      affichage: "segments",
      options: [
        { valeur: "avant", libelle: "Vers soi", icone: "sens-avant" },
        { valeur: "arriere", libelle: "Vers le fond", icone: "sens-arriere" },
      ],
      defaut: "avant",
      attribut: "data-couloir-sens",
    },
    { cle: "sansfin", type: "interrupteur", libelle: "Sans fin", icone: "boucle", groupe: "Mouvement", defaut: DEFAUTS.sansfin, attribut: "data-couloir-sansfin", ecriture: { oui: "oui", non: "non" } },
    { cle: "duree", type: "temps", libelle: "Durée", unite: "s", min: 0.05, max: 10, pas: 0.05, defaut: 0.6, auto: "amorti", attribut: "data-couloir-duree", mouvement: "duree", aide: "Aller à un panneau (flèches, boutons) en un trajet minuté." },
    { cle: "courbe", type: "courbe", libelle: "Courbe", defaut: "out", auto: "amorti", attribut: "data-couloir-courbe", mouvement: "entree", aide: "La courbe de ce trajet. Le défilement libre garde l'inertie." },
    curseur("aberration", "Franges", "Vitesse", 0.01, { aide: "Franges RVB selon la vitesse ; 0 : aucune." }),
    curseur("flou", "Flou", "Vitesse", 0.01, { aide: "Flou de mouvement selon la vitesse." }),
    {
      cle: "ouvre",
      type: "selecteur",
      libelle: "Clic",
      groupe: "Interaction",
      affichage: "segments",
      options: [
        { valeur: "non", libelle: "Rien (le lien garde son clic)", icone: "clic-aucun" },
        { valeur: "visionneuse", libelle: "Visionneuse", icone: "visionneuse" },
      ],
      defaut: DEFAUTS.ouvre,
      attribut: "data-couloir-ouvre",
    },
  ],
  prereglages: {
    cle: "presets",
    valeurs: Object.fromEntries(PRESETS_NOMS.map((n) => [n, valeursDe(PRESETS[n])])),
  },
  demo: {
    racine: "[data-couloir]",
    fond: "#f2f3ef",
    consigne: "Le pointeur pilote la vitesse ; glissez, ou prenez le couloir au clavier (Tab puis flèches).",
    html: `<ul class="mur" data-couloir aria-label="Paysages en couloir : flèches pour avancer">
${IMAGES.map(([n, w, h, alt]) => `  <li><img src="img/${n}-960.webp" width="${w}" height="${h}" alt="${alt}" /></li>`).join("\n")}
</ul>`,
    css: `.mur { position: absolute; inset: 0; }
.mur:not(.couloir) { display: flex; gap: 6px; overflow-x: auto; align-items: center; padding: 0 16px; list-style: none; margin: 0; }
.mur:not(.couloir) li { flex: 0 0 auto; height: 60vh; }
.mur:not(.couloir) img { height: 100%; width: auto; }`,
  },
} satisfies FicheParametres;
