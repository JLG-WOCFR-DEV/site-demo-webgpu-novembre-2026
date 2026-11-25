/**
 * Fiche Studio du logo (src/presse/logo.ts) : un mot rastérisé (`data-logo-texte`) sous une matière de Paper Shaders.
 * Tout vient de la partie pure du module (MATIERES, COMMUNS, SURVOLS, POLICES), sans DOM à l'import :
 *   - la matière (`data-logo`) et les réglages communs que `lirePaires` lit (vitesse, marge, mouvement, survol,
 *     pause, masque, texte, police) ;
 *   - par matière (montrés selon la matière, `si`) : son préréglage (`data-logo-presets`, ses clés de `presets`) et
 *     ses trois réglages « principaux » (`principal: true` dans MATIERES) — les autres restent dans logos.html, qui a
 *     son propre éditeur complet. Un préréglage change les défauts de ces réglages : ils sont `auto` (rien n'est écrit
 *     tant qu'on n'y touche pas, la matière ou le préréglage décide).
 * Écartés : les réglages à liste de couleurs (`-couleurs`), `-src` (un fichier), `-fond` (accepte `transparent`,
 * hors du genre couleur), `-instant`, `-sans-fond`.
 */
import { COMMUNS, MATIERES, MATIERES_NOMS, POLICES, SURVOLS, type DefReglage, type Matiere } from "../../presse/logo.ts";
import type { FicheParametres, Parametre } from "./types.ts";

/** Libellés courts (≤ 20 signes) quand celui du module est plus long. */
const COURTS: Record<string, string> = {
  "Répétition des bandes": "Répétition",
  "Distorsion intérieure": "Distorsion int.",
  "Largeur des cannelures": "Cannelures",
  "Le logo suit la feuille": "Suit la feuille",
};
const court = (l: string) => COURTS[l] ?? (l.length <= 20 ? l : `${l.slice(0, 19)}…`);
/** Une clé de fiche sans tiret (le lien de partage les garde lisibles) : `liquide-metal` → `liquideMetal`. */
export const cleDe = (...morceaux: string[]) => morceaux.map((m) => m.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())).map((m, i) => (i ? m[0]!.toUpperCase() + m.slice(1) : m)).join("");

function principal(m: Matiere, r: DefReglage): Parametre | null {
  const base = { cle: cleDe(m, r.cle), libelle: court(r.libelle), groupe: MATIERES[m].nom, attribut: `data-logo-${r.cle}`, si: { champ: "matiere", valeurs: [m] }, auto: "selon la matière et le préréglage" };
  if (r.type === "nombre") return { ...base, type: "curseur", min: r.min ?? 0, max: r.max ?? 1, pas: r.pas ?? 0.01, defaut: r.defaut as number };
  if (r.type === "couleur") return { ...base, type: "couleur", defaut: r.defaut as string };
  if (r.type === "choix") return { ...base, type: "selecteur", affichage: (r.choix?.length ?? 0) <= 5 ? "segments" : "liste", options: r.choix!.map(([v, , l]) => ({ valeur: v, libelle: l })), defaut: r.defaut as string };
  return null;
}

function presets(m: Matiere): Parametre {
  const p = MATIERES[m].presets;
  return {
    cle: cleDe("presets", m),
    type: "selecteur",
    libelle: "Préréglage",
    groupe: MATIERES[m].nom,
    affichage: "liste",
    options: [{ valeur: "", libelle: "Aucun" }, ...Object.entries(p).map(([v, d]) => ({ valeur: v, libelle: d.nom }))],
    defaut: "",
    attribut: "data-logo-presets",
    si: { champ: "matiere", valeurs: [m] },
    aide: "La base de la matière ; les réglages ci-dessous la complètent.",
  };
}

const parMatiere = MATIERES_NOMS.flatMap((m) => [presets(m), ...MATIERES[m].reglages.filter((r) => r.principal).map((r) => principal(m, r)).filter((p): p is Parametre => !!p)]);

export default {
  rendu: "Rendu WebGL2 (Paper Shaders), joué tel quel dans l'aperçu quand le navigateur a WebGL2 ; sinon le module montre le logo d'origine (ici, le mot en HTML), et en mouvement réduit une image fixe à l'« instant beau » de la matière.",
  parametres: [
    {
      cle: "matiere",
      type: "selecteur",
      libelle: "Matière",
      icone: "texte",
      groupe: "Logo",
      affichage: "liste",
      options: MATIERES_NOMS.map((m) => ({ valeur: m, libelle: MATIERES[m].nom })),
      defaut: "liquide-metal",
      attribut: "data-logo",
    },
    { cle: "texte", type: "texte", libelle: "Texte", groupe: "Logo", defaut: "Presse", max: 40, requis: true, attribut: "data-logo-texte", aide: "Un texte rastérisé (40 signes au plus) à la place d'un fichier." },
    {
      cle: "police",
      type: "selecteur",
      libelle: "Police",
      groupe: "Logo",
      affichage: "segments",
      options: POLICES.map((p) => ({ valeur: p, libelle: p === "archivo" ? "Archivo" : "Bodoni" })),
      defaut: "archivo",
      attribut: "data-logo-police",
    },
    { cle: "marge", type: "curseur", libelle: "Marge", groupe: "Logo", min: COMMUNS.marge[0], max: COMMUNS.marge[1], pas: 0.01, defaut: COMMUNS.marge[2], attribut: "data-logo-marge", aide: "Autour du logo recadré, en part de son grand côté." },
    { cle: "masque", type: "interrupteur", libelle: "Masque", groupe: "Logo", defaut: false, auto: "selon la matière (oui pour verre, trames, tramage)", attribut: "data-logo-masque", ecriture: { oui: "oui", non: "non" }, aide: "L'effet est découpé à la silhouette du logo." },
    ...parMatiere,
    { cle: "vitesse", type: "curseur", libelle: "Vitesse", groupe: "Animation", min: COMMUNS.vitesse[0], max: COMMUNS.vitesse[1], pas: 0.05, defaut: COMMUNS.vitesse[2], attribut: "data-logo-vitesse" },
    { cle: "mouvement", type: "curseur", libelle: "Mouvement", groupe: "Animation", min: COMMUNS.mouvement[0], max: COMMUNS.mouvement[1], pas: 0.05, defaut: COMMUNS.mouvement[2], attribut: "data-logo-mouvement", aide: "Le mouvement que Presse ajoute aux filtres fixes de Paper (trames, verre, lentille, papier)." },
    { cle: "pause", type: "interrupteur", libelle: "Pause", groupe: "Animation", defaut: false, attribut: "data-logo-pause", ecriture: { oui: "oui", non: null }, aide: "Une image fixe (à l'instant beau de la matière)." },
    {
      cle: "survol",
      type: "selecteur",
      libelle: "Survol",
      groupe: "Animation",
      affichage: "segments",
      options: SURVOLS.map((s) => ({ valeur: s, libelle: s === "aucun" ? "Aucun" : s === "vitesse" ? "Vitesse" : "Distorsion" })),
      defaut: "aucun",
      attribut: "data-logo-survol",
      aide: "La vitesse ou la distorsion suit le pointeur.",
    },
  ],
  demo: {
    racine: "[data-logo]",
    fond: "#151412",
    sombre: true,
    consigne: "Survol : la vitesse ou la distorsion suit le pointeur (réglage Survol).",
    html: `<div class="scene-logo">
  <div class="logo" data-logo="liquide-metal" data-logo-texte="Presse" role="img" aria-label="Presse"></div>
</div>`,
    css: `.scene-logo { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.logo { width: min(640px, 90vw); aspect-ratio: 2 / 1; }`,
  },
} satisfies FicheParametres;
