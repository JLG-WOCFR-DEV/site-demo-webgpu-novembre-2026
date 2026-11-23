/**
 * Vitrine — les jetons de style d'une boutique : un objet plat, décrit par le même schéma que les sections (l'éditeur
 * en tire l'inspecteur « Style global »), puis converti en système Presse (src/presse/variations.ts) pour profiter de
 * son solveur de contraste (encre et accent texte ≥ 4,5:1 sur le papier et les surfaces) et de ses variables
 * `--presse-*`. La vitrine ajoute ses propres variables (`--v-*`) : densité, boutons, largeur de page, casse.
 *
 * Pur : ni DOM ni réseau.
 */
import { genererSysteme, resoudrePalette, variables, POLICES, DEFAUT as SYSTEME_DEFAUT, type Police, type Systeme } from "../presse/variations.ts";
import { hex, rvbDeHex, versOklch, melanger, type Oklch } from "../presse/oklch.ts";
import { validerReglages, valeursParDefaut, type Champ, type Reglages } from "./schema.ts";

const optPolices = (Object.keys(POLICES) as Police[]).map((p) => ({ valeur: p, libelle: POLICES[p].nom }));

export const CHAMPS_JETONS: readonly Champ[] = [
  { cle: "papier", type: "couleur", libelle: "Fond", icone: "goutte", defaut: "#ffffff", groupe: "Couleurs" },
  { cle: "surface", type: "couleur", libelle: "Surface (cartes, bandeaux)", icone: "calque", defaut: "#f3f1ec", groupe: "Couleurs" },
  { cle: "encre", type: "couleur", libelle: "Texte", icone: "texte", defaut: "#1a1a1a", groupe: "Couleurs" },
  { cle: "accent", type: "couleur", libelle: "Accent", icone: "etoile", defaut: "#b2541c", groupe: "Couleurs", aide: "Boutons, badges, liens ; éclairci ou foncé au besoin pour tenir 4,5:1." },
  { cle: "titre", type: "selecteur", libelle: "Police des titres", icone: "titre", options: optPolices, defaut: "cormorant", affichage: "liste", groupe: "Typographie" },
  { cle: "texte", type: "selecteur", libelle: "Police du texte", icone: "texte", options: optPolices.filter((o) => POLICES[o.valeur as Police].texte), defaut: "archivo", affichage: "liste", groupe: "Typographie" },
  { cle: "graisseTitre", type: "curseur", libelle: "Graisse des titres", icone: "graisse", min: 300, max: 900, pas: 50, defaut: 400, groupe: "Typographie" },
  { cle: "largeurTitre", type: "curseur", libelle: "Chasse des titres (Archivo)", icone: "chasse", min: 62, max: 125, pas: 1, defaut: 100, groupe: "Typographie", si: { champ: "titre", valeurs: ["archivo"] } },
  { cle: "capitales", type: "interrupteur", libelle: "Titres en capitales", icone: "capitales", defaut: false, groupe: "Typographie" },
  { cle: "approche", type: "curseur", libelle: "Approche des titres", icone: "approche", min: -0.05, max: 0.2, pas: 0.005, defaut: 0, unite: "em", groupe: "Typographie" },
  { cle: "base", type: "curseur", libelle: "Corps du texte", icone: "taille", min: 14, max: 19, pas: 1, defaut: 16, unite: "px", groupe: "Typographie" },
  { cle: "rapport", type: "curseur", libelle: "Échelle des titres", icone: "echelle", min: 1.125, max: 1.5, pas: 0.025, defaut: 1.25, groupe: "Typographie" },
  { cle: "rayon", type: "curseur", libelle: "Arrondi", icone: "arrondi", min: 0, max: 28, pas: 1, defaut: 0, unite: "px", groupe: "Forme" },
  {
    cle: "densite", type: "selecteur", libelle: "Densité", icone: "densite", defaut: "normale", affichage: "segments", groupe: "Forme",
    options: [
      { valeur: "compacte", libelle: "Compacte", icone: "densite-compacte" },
      { valeur: "normale", libelle: "Normale", icone: "densite-normale" },
      { valeur: "aeree", libelle: "Aérée", icone: "densite-aeree" },
    ],
  },
  { cle: "ombre", type: "curseur", libelle: "Ombres", icone: "ombre", min: 0, max: 1, pas: 0.05, defaut: 0, groupe: "Forme" },
  {
    cle: "bouton", type: "selecteur", libelle: "Boutons", icone: "bouton", defaut: "plein", affichage: "segments", groupe: "Forme",
    options: [
      { valeur: "plein", libelle: "Pleins", icone: "bouton-plein" },
      { valeur: "contour", libelle: "Contour", icone: "bouton-contour" },
      { valeur: "souligne", libelle: "Soulignés", icone: "bouton-souligne" },
    ],
  },
  { cle: "largeur", type: "curseur", libelle: "Largeur de page", icone: "largeur", min: 1080, max: 1680, pas: 20, defaut: 1360, unite: "px", groupe: "Forme" },
  { cle: "mouvement", type: "curseur", libelle: "Vitesse des animations", icone: "mouvement", min: 0.5, max: 2, pas: 0.1, defaut: 1, unite: "×", groupe: "Mouvement", aide: "Multiplie les durées ; le mouvement réduit du système reste respecté." },
];

export interface Jetons {
  papier: string;
  surface: string;
  encre: string;
  accent: string;
  titre: Police;
  texte: Police;
  graisseTitre: number;
  largeurTitre: number;
  capitales: boolean;
  approche: number;
  base: number;
  rapport: number;
  rayon: number;
  densite: "compacte" | "normale" | "aeree";
  ombre: number;
  bouton: "plein" | "contour" | "souligne";
  largeur: number;
  mouvement: number;
}

export const JETONS_DEFAUT = valeursParDefaut(CHAMPS_JETONS) as unknown as Jetons;

export function lireJetons(brut: unknown): { jetons: Jetons; corrections: string[] } {
  const r = validerReglages(CHAMPS_JETONS, brut);
  return { jetons: r.reglages as unknown as Jetons, corrections: r.corrections };
}

const ok = (h: string): Oklch => versOklch(rvbDeHex(h));
const ESPACE = { compacte: 6, normale: 8, aeree: 10 } as const;

/** Le système Presse équivalent : palette résolue (contraste AA tenu), typo, forme, mouvement ; look neutre. */
export function systemeDe(j: Jetons): { systeme: Systeme; retouches: string[] } {
  const papier = ok(j.papier);
  const sombre = papier[0] < 0.5;
  const surface = ok(j.surface);
  const surface2 = melanger(surface, ok(j.encre), 0.06);
  const { palette, retouches } = resoudrePalette({ harmonie: "monochrome", sombre, teinte: ok(j.accent)[2], papier, encre: ok(j.encre), accents: [ok(j.accent)], surfaces: [surface, surface2] });
  const D = SYSTEME_DEFAUT;
  const systeme: Systeme = {
    v: 1,
    nom: "Vitrine",
    graine: 0,
    palette,
    typo: {
      titre: j.titre,
      texte: j.texte,
      rapport: j.rapport,
      base: j.base,
      graisseTitre: j.graisseTitre,
      graisseTexte: j.texte === "cormorant" ? 500 : 400,
      largeur: j.largeurTitre,
      interlignage: 1.55,
      interlignageTitre: j.capitales ? 1 : 1.06,
      approche: j.approche,
      capitales: j.capitales,
    },
    forme: { espace: ESPACE[j.densite], rayon: j.rayon, filet: 1, ombre: j.ombre },
    mouvement: { ...D.mouvement, echelle: j.mouvement, courbe: "out", intensite: "sobre" },
    look: { nom: "neutre", grain: 0, vignette: 0, effets: [] },
  };
  return { systeme, retouches };
}

/** Les jetons tirés d'un système de Variations (bouton « Tirer » de l'éditeur) : on garde densité, boutons, largeur. */
export function jetonsDepuisSysteme(s: Systeme, garde: Jetons = JETONS_DEFAUT): Jetons {
  const p = s.palette;
  const brut = {
    ...garde,
    papier: hex(p.papier),
    surface: hex(p.surfaces[0]),
    encre: hex(p.encre),
    accent: hex(p.accents[0]!),
    titre: s.typo.titre,
    texte: s.typo.texte,
    graisseTitre: s.typo.graisseTitre,
    largeurTitre: s.typo.largeur,
    capitales: s.typo.capitales,
    approche: s.typo.approche,
    base: s.typo.base,
    rapport: Math.min(1.5, s.typo.rapport),
    rayon: Math.min(28, Math.round(s.forme.rayon)),
    ombre: s.forme.ombre,
  };
  return lireJetons(brut).jetons;
}

/** Un tirage de Variations (graine) converti en jetons. */
export const tirerJetons = (graine: number, garde?: Jetons) => jetonsDepuisSysteme(genererSysteme(graine, { looks: ["neutre"], accents: 2 }), garde);

/**
 * Le CSS des jetons, posé sur `racine` (défaut `.vitrine`) : les variables `--presse-*` du système, puis celles de la
 * vitrine (`--v-*`), branchées dessus.
 */
export function cssJetons(j: Jetons, racine = ".vitrine"): string {
  const { systeme } = systemeDe(j);
  const v = variables(systeme);
  const sombre = systeme.palette.sombre;
  const lignes = Object.entries(v).map(([k, x]) => `  ${k}: ${x};`);
  const e = ESPACE[j.densite];
  const extra: Record<string, string> = {
    "--v-papier": "var(--presse-papier)",
    "--v-surface": "var(--presse-surface-1)",
    "--v-surface-2": "var(--presse-surface-2)",
    "--v-encre": "var(--presse-encre)",
    "--v-encre-douce": "var(--presse-encre-douce)",
    "--v-accent": "var(--presse-accent-1)",
    "--v-accent-texte": "var(--presse-accent-1-texte)",
    "--v-filet": "var(--presse-filet)",
    "--v-f-titre": "var(--presse-f-titre)",
    "--v-f-texte": "var(--presse-f-texte)",
    "--v-f-mono": "var(--presse-f-mono)",
    "--v-graisse-titre": "var(--presse-graisse-titre)",
    "--v-largeur-titre": "var(--presse-largeur-titre)",
    "--v-casse-titre": "var(--presse-casse-titre)",
    "--v-approche": "var(--presse-approche)",
    "--v-interlignage": "var(--presse-interlignage)",
    "--v-interlignage-titre": "var(--presse-interlignage-titre)",
    "--v-rayon": "var(--presse-rayon)",
    "--v-rayon-petit": "var(--presse-rayon-petit)",
    "--v-ombre": "var(--presse-ombre)",
    "--v-courbe": "var(--presse-courbe)",
    "--v-e": `${e}px`,
    "--v-gouttiere": `${e * 3}px`,
    "--v-section": `${e * (j.densite === "compacte" ? 7 : j.densite === "aeree" ? 11.5 : 10)}px`,
    "--v-largeur": `${j.largeur}px`,
    "--v-t-0": "var(--presse-t-0)",
    "--v-t-1": "var(--presse-t-1)",
    "--v-t-2": "var(--presse-t-2)",
    "--v-t-3": "var(--presse-t-3)",
    "--v-t-4": "var(--presse-t-4)",
    "--v-t-5": "var(--presse-t-5)",
    "--v-t-6": "var(--presse-t-6)",
    // Texte posé sur l'accent : blanc ou encre, le plus lisible.
    "--v-sur-accent": contrasteSurAccent(hex(systeme.palette.accents[0]!)),
    "--v-sombre": sombre ? "1" : "0",
  };
  return `${racine} {\n${lignes.join("\n")}\n${Object.entries(extra)
    .map(([k, x]) => `  ${k}: ${x};`)
    .join("\n")}\n  color-scheme: ${sombre ? "dark" : "light"};\n}\n`;
}

/** Blanc ou presque noir, selon ce qui contraste le mieux avec la couleur (luminance WCAG). */
export function contrasteSurAccent(h: string): string {
  const [r, g, b] = rvbDeHex(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05) / (L + 0.05) >= (L + 0.05) / 0.05 ? "#ffffff" : "#111111";
}

/** Les familles de polices à charger pour ces jetons. */
export const policesDe = (j: Jetons): Police[] => [...new Set<Police>([j.titre, j.texte, "plex"])];
export type { Reglages };
