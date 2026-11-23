/**
 * Presse — Variations : un « système de design » sérialisable, et son générateur à graine.
 *
 * Un système, c'est cinq familles de jetons :
 *   palette     papier, encre, 1 à 3 accents, 2 surfaces, en OKLCH, nés d'une harmonie de teintes ;
 *   typo        familles parmi les fontes déjà embarquées, échelle (rapport, base), graisses, interlignage, approche ;
 *   forme       espacement, rayons, filets, ombres ;
 *   mouvement   durées (les jetons de src/presse/tokens.ts, mis à l'échelle), courbe, transition de page (13), de
 *               diapo (19), intensité (data-presse-motion) ;
 *   look        l'étalonnage de src/presse/look.ts (préréglage, grain, vignette) et les effets de chaîne du moteur
 *               (data-presse-effects : loupe, rvb — l'aberration —, trame, bloom, grain, courbure).
 *
 * Sorties : variables CSS (`--presse-*`, et les noms que les pages emploient déjà : le kit `--paper`, `--ink`…, la
 * boutique `--papier`, `--encre`…), attributs Presse du look et du mouvement, réglages de page du Créateur, JSON versionné.
 *
 * Le générateur est déterministe (une graine → un système) et tient des contraintes : contraste AA encre / papier et
 * de chaque accent employé en texte, contre le papier et chaque surface, brut ET une fois passé par l'étalonnage du
 * look — un solveur déplace la clarté OKLCH au lieu de rejeter le tirage. Chaque famille tire dans son propre flux :
 * verrouiller la palette et re-tirer la typographie ne change que la typographie.
 *
 * Pur : ni DOM ni réseau (src/presse/variations.test.ts). L'application à une page : src/presse/systeme.ts.
 */
import { LOOKS } from "./look.ts";
import { DUR, EASE } from "./tokens.ts";
import { TRANSITIONS } from "../state.ts";
import { SLIDE_TRANSITIONS } from "../gpu/slide-transition.ts";
import { ajusterContraste, arrondir, contrasteMin, cssOklch, hex, melanger, type Oklch } from "./oklch.ts";

/* ───────────────────────── Vocabulaire ───────────────────────── */

export const FAMILLES = ["palette", "typo", "forme", "mouvement", "look"] as const;
export type Famille = (typeof FAMILLES)[number];
export const NOMS_FAMILLES: Record<Famille, string> = { palette: "Palette", typo: "Typographie", forme: "Forme", mouvement: "Mouvement", look: "Look" };

export const HARMONIES = ["analogue", "complementaire", "scindee", "triade", "tetrade", "monochrome"] as const;
export type Harmonie = (typeof HARMONIES)[number];
export const NOMS_HARMONIES: Record<Harmonie, string> = {
  analogue: "Analogue",
  complementaire: "Complémentaire",
  scindee: "Complémentaire scindée",
  triade: "Triade",
  tetrade: "Tétrade",
  monochrome: "Monochrome",
};
/** Décalages de teinte (degrés) des accents, depuis la teinte de base. */
export const DECALAGES: Record<Harmonie, number[]> = {
  analogue: [0, 32, -32],
  complementaire: [0, 180, 20],
  scindee: [0, 150, 210],
  triade: [0, 120, 240],
  tetrade: [0, 90, 180],
  monochrome: [0, 0, 0],
};

/** Les fontes déjà embarquées par le dépôt (fontsource) : aucune requête vers un tiers. */
export const POLICES = {
  archivo: { nom: "Archivo", pile: '"Archivo Variable", Arial, sans-serif', graisses: [100, 900], largeur: true, titre: true, texte: true },
  bodoni: { nom: "Bodoni Moda", pile: '"Bodoni Moda Variable", "Bodoni 72", Georgia, serif', graisses: [400, 900], largeur: false, titre: true, texte: false },
  cormorant: { nom: "Cormorant Garamond", pile: '"Cormorant Garamond", Garamond, Georgia, serif', graisses: [400, 700], largeur: false, titre: true, texte: true },
  plex: { nom: "IBM Plex Mono", pile: '"IBM Plex Mono", ui-monospace, monospace', graisses: [400, 600], largeur: false, titre: true, texte: true },
} as const;
export type Police = keyof typeof POLICES;
export const POLICES_IDS = Object.keys(POLICES) as Police[];
/** Rapports d'échelle typographique classiques. */
export const RAPPORTS = [1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618] as const;

export const COURBES = { out: EASE.out, inOut: EASE.inOut, ressort: "", net: "cubic-bezier(0.2, 0, 0, 1)" } as const;
export type Courbe = keyof typeof COURBES;
export const NOMS_COURBES: Record<Courbe, string> = { out: "Sortie douce", inOut: "Aller-retour", ressort: "Ressort", net: "Net" };
export const INTENSITES = ["sobre", "normal", "expressif"] as const;
export type Intensite = (typeof INTENSITES)[number];
export const TRANSITIONS_PAGE = TRANSITIONS.filter((t) => t !== "aucune");
export const TRANSITIONS_DIAPO = SLIDE_TRANSITIONS;
export const LOOKS_IDS = Object.keys(LOOKS);
/** Les effets de chaîne du moteur (data-presse-effects). `rvb` : l'aberration chromatique. */
export const EFFETS = ["loupe", "rvb", "trame", "bloom", "grain", "courbure"] as const;

export type Palette = {
  harmonie: Harmonie;
  sombre: boolean;
  /** Teinte de base (degrés). */
  teinte: number;
  papier: Oklch;
  encre: Oklch;
  /** 1 à 3 ; le premier sert au texte (≥ 4,5:1), les autres aux grands éléments et au décor (≥ 3:1). */
  accents: Oklch[];
  /** Deux fonds voisins du papier (cartes, bandeaux). */
  surfaces: [Oklch, Oklch];
};
export type Typo = {
  titre: Police;
  texte: Police;
  rapport: number;
  /** Corps du texte (px). */
  base: number;
  graisseTitre: number;
  graisseTexte: number;
  /** Largeur (axe wdth d'Archivo, 62 à 125) : ignorée par les autres familles. */
  largeur: number;
  interlignage: number;
  interlignageTitre: number;
  /** Approche des titres (em). */
  approche: number;
  capitales: boolean;
};
export type Forme = { espace: number; rayon: number; filet: number; ombre: number };
export type Mouvement = { echelle: number; courbe: Courbe; transitionPage: string; transitionDiapo: string; intensite: Intensite };
export type Look = { nom: string; grain: number; vignette: number; effets: string[] };
export type Systeme = { v: 1; nom: string; graine: number; palette: Palette; typo: Typo; forme: Forme; mouvement: Mouvement; look: Look };

export type Contraintes = {
  sombre?: boolean;
  harmonie?: Harmonie;
  teinte?: number;
  accents?: 1 | 2 | 3;
  /** Contraste visé du texte (4,5 par défaut : AA ; 7 : AAA). Le grand texte et le décor : 3. */
  contraste?: number;
  titres?: Police[];
  textes?: Police[];
  looks?: string[];
};
/** Familles verrouillées : leurs valeurs, recopiées telles quelles. */
export type Verrous = Partial<Pick<Systeme, Famille>>;

export const CONTRASTE_TEXTE = 4.5;
export const CONTRASTE_GRAND = 3;

/* ───────────────────────── Hasard à graine ───────────────────────── */

/** Mulberry32 : rapide, 32 bits, assez bon pour tirer des jetons. */
export function prng(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Empreinte FNV-1a d'un texte (une graine à partir d'un nom). */
export function empreinte(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
/** Le flux d'une famille : indépendant des autres, pour que les verrous ne décalent pas les tirages. */
const flux = (graine: number, famille: string) => prng(empreinte(`${graine >>> 0}:${famille}`));
type Rng = () => number;
const entre = (r: Rng, a: number, b: number) => a + (b - a) * r();
const choisir = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length]!;
const pondere = <T>(r: Rng, xs: readonly (readonly [T, number])[]): T => {
  const tot = xs.reduce((s, [, w]) => s + w, 0);
  let x = r() * tot;
  for (const [v, w] of xs) if ((x -= w) < 0) return v;
  return xs[xs.length - 1]![0];
};
/** Arrondi à d décimales ; « + 0 » change -0 en 0 (le JSON l'écrirait 0, l'aller-retour ne serait plus exact). */
const arr = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d + 0;
const borne = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const tourner = (h: number) => ((h % 360) + 360) % 360;

/* ───────────────────────── Tirages par famille ───────────────────────── */

function tirerPalette(r: Rng, c: Contraintes): Omit<Palette, "papier" | "encre" | "accents" | "surfaces"> & { brut: Palette } {
  const sombre = c.sombre ?? r() < 0.3;
  const harmonie = c.harmonie ?? choisir(r, HARMONIES);
  const teinte = arr(tourner(c.teinte ?? r() * 360), 2);
  const n = c.accents ?? pondere(r, [[1, 2], [2, 3], [3, 2]] as const);
  const dec = DECALAGES[harmonie];
  // Papier : légèrement teinté (de la base, ou de sa complémentaire, plus calme).
  const hp = tourner(teinte + (r() < 0.5 ? 0 : 180) + entre(r, -12, 12));
  const papier: Oklch = sombre ? [entre(r, 0.14, 0.23), entre(r, 0.006, 0.035), hp] : [entre(r, 0.935, 0.985), entre(r, 0.004, 0.03), hp];
  const encre: Oklch = sombre ? [entre(r, 0.9, 0.97), entre(r, 0.005, 0.03), teinte] : [entre(r, 0.14, 0.3), entre(r, 0.01, 0.05), teinte];
  const accents: Oklch[] = [];
  for (let i = 0; i < n; i++) {
    const h = tourner(teinte + dec[i]! + entre(r, -8, 8));
    if (harmonie === "monochrome") accents.push(sombre ? [entre(r, 0.62, 0.86), entre(r, 0.06, 0.16), h] : [entre(r, 0.38, 0.62), entre(r, 0.06, 0.16), h]);
    else accents.push(sombre ? [entre(r, 0.66, 0.82), entre(r, 0.09, 0.19), h] : [entre(r, 0.45, 0.62), entre(r, 0.1, 0.21), h]);
  }
  const d1 = entre(r, 0.02, 0.045),
    d2 = d1 + entre(r, 0.025, 0.05);
  const sgn = sombre ? 1 : -1;
  const surfaces: [Oklch, Oklch] = [
    [papier[0] + sgn * d1, papier[1] + 0.006, papier[2]],
    [papier[0] + sgn * d2, papier[1] + 0.012, papier[2]],
  ];
  return { harmonie, sombre, teinte, brut: { harmonie, sombre, teinte, papier, encre, accents, surfaces } };
}

/**
 * La palette rendue sûre : papier et surfaces arrondis, encre et accents ajustés par le solveur contre le papier ET
 * chaque surface, brut et sous l'étalonnage du look. Renvoie aussi la liste des retouches (pour le dire dans l'UI).
 */
export function resoudrePalette(p: Palette, nomLook = "neutre", cible = CONTRASTE_TEXTE): { palette: Palette; retouches: string[] } {
  const papier = arrondir(p.papier);
  const surfaces = p.surfaces.map(arrondir) as [Oklch, Oklch];
  const fonds = [papier, ...surfaces];
  const retouches: string[] = [];
  const encreSous = ajusterContraste(p.encre, fonds, Math.max(cible, CONTRASTE_TEXTE), nomLook);
  if (encreSous.ajuste) retouches.push("encre");
  const accents = p.accents.slice(0, 3).map((a, i) => {
    const r = ajusterContraste(a, fonds, i === 0 ? Math.max(cible, CONTRASTE_TEXTE) : CONTRASTE_GRAND, nomLook);
    if (r.ajuste) retouches.push(`accent ${i + 1}`);
    return r.couleur;
  });
  if (!accents.length) accents.push(ajusterContraste([0.5, 0.15, p.teinte], fonds, cible, nomLook).couleur);
  return { palette: { harmonie: p.harmonie, sombre: p.sombre, teinte: arr(tourner(p.teinte), 2), papier, encre: encreSous.couleur, accents, surfaces }, retouches };
}

function tirerTypo(r: Rng, c: Contraintes): Typo {
  const titres = c.titres?.length ? c.titres : POLICES_IDS.filter((f) => POLICES[f].titre);
  const titre = pondere(r, titres.map((f) => [f, f === "plex" ? 1 : 3] as const));
  const textesPossibles = (c.textes?.length ? c.textes : POLICES_IDS.filter((f) => POLICES[f].texte)).filter((f) => POLICES[f].texte);
  const textes = textesPossibles.length ? textesPossibles : (["archivo"] as Police[]);
  // Un titre à empattements appelle souvent un texte sans : on le favorise, sans l'imposer.
  const texte = pondere(r, textes.map((f) => [f, f === "archivo" ? 3 : f === titre ? 2 : 1] as const));
  const [g0, g1] = POLICES[titre].graisses;
  const graisseTitre = Math.round(entre(r, Math.max(g0, titre === "archivo" ? 500 : g0), g1) / 50) * 50;
  const graisseTexte = texte === "cormorant" ? 500 : texte === "archivo" ? choisir(r, [350, 400, 400, 450]) : 400;
  const capitales = titre === "plex" ? r() < 0.6 : titre === "archivo" ? r() < 0.28 : r() < 0.06;
  return {
    titre,
    texte,
    rapport: choisir(r, RAPPORTS),
    base: Math.round(entre(r, 15, 19.99)),
    graisseTitre,
    graisseTexte,
    largeur: titre === "archivo" ? Math.round(entre(r, 62, 125)) : 100,
    interlignage: arr(entre(r, 1.4, 1.7), 2),
    interlignageTitre: arr(capitales ? entre(r, 0.88, 1.02) : entre(r, 0.92, 1.12), 2),
    approche: arr(capitales ? entre(r, -0.01, 0.03) : entre(r, -0.045, 0.005), 3),
    capitales,
  };
}

function tirerForme(r: Rng): Forme {
  return {
    espace: Math.round(entre(r, 4, 10.99)),
    rayon: pondere(r, [[0, 3], [2, 2], [4, 2], [8, 2], [12, 2], [18, 1], [28, 1]] as const),
    filet: pondere(r, [[1, 4], [2, 2], [0, 1]] as const),
    ombre: arr(pondere(r, [[0, 4], [0.3, 2], [0.6, 2], [1, 1]] as const), 2),
  };
}

function tirerMouvement(r: Rng): Mouvement {
  return {
    echelle: arr(entre(r, 0.7, 1.5), 2),
    courbe: pondere(r, [["out", 4], ["inOut", 2], ["ressort", 2], ["net", 2]] as const),
    transitionPage: choisir(r, TRANSITIONS_PAGE),
    transitionDiapo: choisir(r, TRANSITIONS_DIAPO),
    intensite: pondere(r, [["sobre", 2], ["normal", 3], ["expressif", 2]] as const),
  };
}

function tirerLook(r: Rng, c: Contraintes): Look {
  const nom = choisir(r, c.looks?.length ? c.looks.filter((l) => LOOKS[l]) : LOOKS_IDS);
  const base = LOOKS[nom] ?? LOOKS.neutre!;
  const effets = ["loupe", ...EFFETS.filter((e) => e !== "loupe" && r() < (e === "bloom" || e === "grain" ? 0.55 : 0.22))];
  return {
    nom,
    grain: arr(borne(base.grain + entre(r, -0.02, 0.025), 0, 0.12), 3),
    vignette: arr(borne(base.vignette + entre(r, -0.1, 0.1), 0, 0.6), 2),
    effets,
  };
}

/** Le nom d'un système : deux mots tirés de sa graine (« Atlas brûlé »). */
const MOTS_A = ["Atlas", "Gazette", "Rotative", "Galerie", "Carnet", "Revue", "Affiche", "Manifeste", "Herbier", "Archive", "Fanzine", "Chronique"];
const MOTS_B = ["brûlé", "salé", "nocturne", "poudré", "minéral", "solaire", "givré", "fauve", "lunaire", "marin", "boréal", "cuivré"];
export const nomDe = (graine: number) => {
  const r = prng(empreinte(`nom:${graine >>> 0}`));
  return `${choisir(r, MOTS_A)} ${choisir(r, MOTS_B)}`;
};

/**
 * Un système complet, déterministe : même graine, mêmes contraintes, mêmes verrous → même système. Les familles
 * verrouillées sont recopiées telles quelles ; si la palette est verrouillée, un look qui la rendrait illisible est
 * re-tiré (jusqu'à 12 fois, puis « neutre », qui ne touche à rien).
 */
export function genererSysteme(graine: number, contraintes: Contraintes = {}, verrous: Verrous = {}): Systeme {
  graine = graine >>> 0;
  const cible = contraintes.contraste ?? CONTRASTE_TEXTE;
  let look = verrous.look ? copie(verrous.look) : tirerLook(flux(graine, "look"), contraintes);
  let palette: Palette;
  if (verrous.palette) {
    palette = copie(verrous.palette);
    if (!verrous.look) {
      const rl = flux(graine, "look-repli");
      for (let i = 0; i < 12 && !paletteTient(palette, look.nom, cible); i++) look = tirerLook(rl, contraintes);
      if (!paletteTient(palette, look.nom, cible)) look = { ...look, nom: "neutre" };
    }
  } else palette = resoudrePalette(tirerPalette(flux(graine, "palette"), contraintes).brut, look.nom, cible).palette;
  return {
    v: 1,
    nom: nomDe(graine),
    graine,
    palette,
    typo: verrous.typo ? copie(verrous.typo) : tirerTypo(flux(graine, "typo"), contraintes),
    forme: verrous.forme ? copie(verrous.forme) : tirerForme(flux(graine, "forme")),
    mouvement: verrous.mouvement ? copie(verrous.mouvement) : tirerMouvement(flux(graine, "mouvement")),
    look,
  };
}
const copie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
/** Les verrous d'un système : ses familles nommées, recopiées. */
export const verrousDe = (s: Systeme, familles: Iterable<Famille>): Verrous => Object.fromEntries([...familles].map((f) => [f, copie(s[f])])) as Verrous;

/** La palette tient-elle ses contrastes sous ce look ? */
export function paletteTient(p: Palette, nomLook: string, cible = CONTRASTE_TEXTE) {
  const fonds = [p.papier, ...p.surfaces];
  return (
    contrasteMin(p.encre, fonds, nomLook) >= Math.max(cible, CONTRASTE_TEXTE) &&
    p.accents.every((a, i) => contrasteMin(a, fonds, nomLook) >= (i === 0 ? Math.max(cible, CONTRASTE_TEXTE) : CONTRASTE_GRAND))
  );
}

/**
 * Une variation proche : chaque famille non verrouillée bouge d'autant plus que `intensite` (0 → 1) est grande —
 * valeurs continues décalées, choix discrets changés avec une probabilité qui croît. Le solveur repasse sur la palette.
 */
export function muterSysteme(s: Systeme, graine: number, intensite = 0.3, verrous: Iterable<Famille> = []): Systeme {
  const k = borne(intensite, 0, 1);
  const fige = new Set(verrous);
  const out = copie(s);
  out.graine = empreinte(`${s.graine}:mut:${graine >>> 0}:${k}`);
  out.nom = nomDe(out.graine);
  const bouge = (r: Rng, v: number, amp: number, a: number, b: number, d = 3) => arr(borne(v + (r() * 2 - 1) * amp * k, a, b), d);
  const change = (r: Rng) => r() < k * 0.6;
  if (!fige.has("look")) {
    const r = flux(out.graine, "look");
    if (change(r)) out.look.nom = choisir(r, LOOKS_IDS);
    out.look.grain = bouge(r, out.look.grain, 0.05, 0, 0.12);
    out.look.vignette = bouge(r, out.look.vignette, 0.3, 0, 0.6, 2);
    if (change(r)) {
      const e = choisir(r, EFFETS.filter((x) => x !== "loupe"));
      out.look.effets = out.look.effets.includes(e) ? out.look.effets.filter((x) => x !== e) : [...out.look.effets, e];
    }
  }
  if (!fige.has("palette")) {
    const r = flux(out.graine, "palette");
    const p = out.palette;
    const dh = (r() * 2 - 1) * 70 * k;
    p.teinte = arr(tourner(p.teinte + dh), 2);
    const tourne = (o: Oklch, amp = 1): Oklch => [o[0] + (r() * 2 - 1) * 0.08 * k * amp, Math.max(0, o[1] * (1 + (r() * 2 - 1) * 0.5 * k)), tourner(o[2] + dh + (r() * 2 - 1) * 15 * k)];
    p.papier = tourne(p.papier, 0.3);
    p.papier[0] = p.sombre ? borne(p.papier[0], 0.12, 0.25) : borne(p.papier[0], 0.92, 0.99);
    p.surfaces = p.surfaces.map((x) => {
      const d = x[0] - s.palette.papier[0];
      return [p.papier[0] + d, x[1], p.papier[2]] as Oklch;
    }) as [Oklch, Oklch];
    p.encre = tourne(p.encre, 0.5);
    p.accents = p.accents.map((a) => tourne(a));
    if (change(r) && r() < 0.5) p.harmonie = choisir(r, HARMONIES);
    out.palette = resoudrePalette(p, out.look.nom).palette;
  } else if (!paletteTient(out.palette, out.look.nom)) out.look.nom = s.look.nom;
  if (!fige.has("typo")) {
    const r = flux(out.graine, "typo");
    const t = out.typo;
    if (change(r)) t.titre = choisir(r, POLICES_IDS.filter((f) => POLICES[f].titre));
    if (change(r) && r() < 0.5) t.texte = choisir(r, POLICES_IDS.filter((f) => POLICES[f].texte));
    const i = RAPPORTS.indexOf(t.rapport as (typeof RAPPORTS)[number]);
    t.rapport = RAPPORTS[borne((i < 0 ? 2 : i) + Math.round((r() * 2 - 1) * 2 * k), 0, RAPPORTS.length - 1)]!;
    t.base = Math.round(bouge(r, t.base, 2.5, 14, 21, 0));
    const [g0, g1] = POLICES[t.titre].graisses;
    t.graisseTitre = Math.round(borne(t.graisseTitre + (r() * 2 - 1) * 300 * k, g0, g1) / 50) * 50;
    t.largeur = t.titre === "archivo" ? Math.round(bouge(r, t.largeur, 40, 62, 125, 0)) : 100;
    t.interlignage = bouge(r, t.interlignage, 0.2, 1.3, 1.8, 2);
    t.interlignageTitre = bouge(r, t.interlignageTitre, 0.12, 0.85, 1.2, 2);
    t.approche = bouge(r, t.approche, 0.03, -0.05, 0.05, 3);
    if (change(r) && r() < 0.4) t.capitales = !t.capitales;
  }
  if (!fige.has("forme")) {
    const r = flux(out.graine, "forme");
    const f = out.forme;
    f.espace = Math.round(bouge(r, f.espace, 4, 3, 12, 0));
    f.rayon = Math.round(bouge(r, f.rayon, 16, 0, 32, 0));
    f.filet = Math.round(bouge(r, f.filet, 1.4, 0, 3, 0));
    f.ombre = bouge(r, f.ombre, 0.6, 0, 1, 2);
  }
  if (!fige.has("mouvement")) {
    const r = flux(out.graine, "mouvement");
    const m = out.mouvement;
    m.echelle = bouge(r, m.echelle, 0.5, 0.6, 1.6, 2);
    if (change(r)) m.courbe = choisir(r, Object.keys(COURBES) as Courbe[]);
    if (change(r)) m.transitionPage = choisir(r, TRANSITIONS_PAGE);
    if (change(r)) m.transitionDiapo = choisir(r, TRANSITIONS_DIAPO);
    if (change(r) && r() < 0.5) m.intensite = choisir(r, INTENSITES);
  }
  return out;
}

/**
 * Un croisement : chaque famille vient de A ou de B (tirée), sauf les verrouillées, qui restent celles de A. Les
 * formes se mélangent à mi-chemin ; la palette, une fois sur trois, prend le papier de l'un et les accents de l'autre.
 */
export function croiserSystemes(a: Systeme, b: Systeme, graine: number, verrous: Iterable<Famille> = []): Systeme {
  const fige = new Set(verrous);
  const g = empreinte(`${a.graine}x${b.graine}:${graine >>> 0}`);
  const r = prng(g);
  const out: Systeme = copie(a);
  out.graine = g;
  out.nom = nomDe(g);
  for (const f of FAMILLES) if (!fige.has(f) && r() < 0.5) (out as Record<Famille, unknown>)[f] = copie(b[f]);
  if (!fige.has("forme")) {
    const t = entre(r, 0.3, 0.7);
    out.forme = {
      espace: Math.round(a.forme.espace + (b.forme.espace - a.forme.espace) * t),
      rayon: Math.round(a.forme.rayon + (b.forme.rayon - a.forme.rayon) * t),
      filet: Math.round(a.forme.filet + (b.forme.filet - a.forme.filet) * t),
      ombre: arr(a.forme.ombre + (b.forme.ombre - a.forme.ombre) * t, 2),
    };
  }
  if (!fige.has("palette") && r() < 0.34) {
    const [fond, acc] = r() < 0.5 ? [a.palette, b.palette] : [b.palette, a.palette];
    out.palette = { ...copie(fond), accents: copie(acc.accents), harmonie: acc.harmonie };
  }
  if (!fige.has("palette")) out.palette = resoudrePalette(out.palette, out.look.nom).palette;
  else if (!paletteTient(out.palette, out.look.nom)) out.look.nom = a.look.nom;
  return out;
}

/* ───────────────────────── Lecture, sérialisation ───────────────────────── */

export const FORMAT = "presse-systeme";
export const DEFAUT: Systeme = genererSysteme(1);

const num = (v: unknown, d: number, a = -Infinity, b = Infinity) => (typeof v === "number" && Number.isFinite(v) ? borne(v, a, b) : d);
const de = <T extends string>(v: unknown, xs: readonly T[], d: T): T => (typeof v === "string" && (xs as readonly string[]).includes(v) ? (v as T) : d);
const ok = (v: unknown, d: Oklch): Oklch => (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? arrondir(v as Oklch) : d);

/**
 * Un système lu depuis un JSON (texte ou objet) : format et version vérifiés, champs bornés, manquants remis par
 * défaut. Lève une erreur en français si ce n'est pas un système Presse.
 */
export function lireSysteme(x: unknown): Systeme {
  const o = (typeof x === "string" ? JSON.parse(x) : x) as Record<string, unknown> | null;
  if (!o || typeof o !== "object") throw new Error("Système illisible : un objet JSON est attendu.");
  if (o.format !== undefined && o.format !== FORMAT) throw new Error(`Ce n'est pas un système Presse (format « ${String(o.format)} »).`);
  if (o.v !== undefined && o.v !== 1) throw new Error(`Version de système inconnue : ${String(o.v)} (attendu : 1).`);
  const D = DEFAUT;
  const p = (o.palette ?? {}) as Record<string, unknown>;
  const t = (o.typo ?? {}) as Record<string, unknown>;
  const f = (o.forme ?? {}) as Record<string, unknown>;
  const m = (o.mouvement ?? {}) as Record<string, unknown>;
  const l = (o.look ?? {}) as Record<string, unknown>;
  const accents = Array.isArray(p.accents) && p.accents.length ? p.accents.slice(0, 3).map((a, i) => ok(a, D.palette.accents[i] ?? D.palette.accents[0]!)) : D.palette.accents.map((a) => [...a] as Oklch);
  const surf = Array.isArray(p.surfaces) ? p.surfaces : [];
  const titre = de(t.titre, POLICES_IDS, D.typo.titre);
  const texte = de(t.texte, POLICES_IDS.filter((x) => POLICES[x].texte), D.typo.texte);
  const graine = num(o.graine, D.graine, 0, 4294967295) >>> 0;
  return {
    v: 1,
    nom: typeof o.nom === "string" && o.nom.trim() ? o.nom.trim().slice(0, 60) : nomDe(graine),
    graine,
    palette: {
      harmonie: de(p.harmonie, HARMONIES, D.palette.harmonie),
      sombre: typeof p.sombre === "boolean" ? p.sombre : D.palette.sombre,
      teinte: arr(tourner(num(p.teinte, D.palette.teinte)), 2),
      papier: ok(p.papier, D.palette.papier),
      encre: ok(p.encre, D.palette.encre),
      accents,
      surfaces: [ok(surf[0], D.palette.surfaces[0]), ok(surf[1], D.palette.surfaces[1])],
    },
    typo: {
      titre,
      texte,
      rapport: num(t.rapport, D.typo.rapport, 1, 2),
      base: num(t.base, D.typo.base, 10, 28),
      graisseTitre: num(t.graisseTitre, D.typo.graisseTitre, 100, 900),
      graisseTexte: num(t.graisseTexte, D.typo.graisseTexte, 100, 900),
      largeur: num(t.largeur, D.typo.largeur, 62, 125),
      interlignage: num(t.interlignage, D.typo.interlignage, 1, 2.2),
      interlignageTitre: num(t.interlignageTitre, D.typo.interlignageTitre, 0.7, 1.6),
      approche: num(t.approche, D.typo.approche, -0.1, 0.2),
      capitales: typeof t.capitales === "boolean" ? t.capitales : D.typo.capitales,
    },
    forme: { espace: num(f.espace, D.forme.espace, 2, 16), rayon: num(f.rayon, D.forme.rayon, 0, 48), filet: num(f.filet, D.forme.filet, 0, 4), ombre: num(f.ombre, D.forme.ombre, 0, 1) },
    mouvement: {
      echelle: num(m.echelle, D.mouvement.echelle, 0.3, 3),
      courbe: de(m.courbe, Object.keys(COURBES) as Courbe[], D.mouvement.courbe),
      transitionPage: de(m.transitionPage, TRANSITIONS as readonly string[], D.mouvement.transitionPage),
      transitionDiapo: de(m.transitionDiapo, TRANSITIONS_DIAPO as readonly string[], D.mouvement.transitionDiapo),
      intensite: de(m.intensite, INTENSITES, D.mouvement.intensite),
    },
    look: {
      nom: de(l.nom, LOOKS_IDS, D.look.nom),
      grain: num(l.grain, D.look.grain, 0, 0.3),
      vignette: num(l.vignette, D.look.vignette, 0, 1),
      effets: Array.isArray(l.effets) ? [...new Set(l.effets.filter((e): e is string => typeof e === "string" && (EFFETS as readonly string[]).includes(e)))] : [...D.look.effets],
    },
  };
}
/** Le JSON d'un système (`presse-systeme.json`), avec son format et sa version. */
export const serialiser = (s: Systeme, indent = 2) => JSON.stringify({ format: FORMAT, ...s }, null, indent);

/** base64url (RFC 4648 §5) d'un texte UTF-8, sans remplissage : pour `?systeme=`. */
export function versBase64url(texte: string) {
  const o = new TextEncoder().encode(texte);
  let s = "";
  for (const b of o) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function depuisBase64url(b: string) {
  const s = atob(b.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
}
/** Le système en une valeur d'adresse ou d'attribut (JSON compact en base64url). */
export const encoderSysteme = (s: Systeme) => versBase64url(JSON.stringify({ format: FORMAT, ...s }));
/** L'inverse : base64url, ou JSON tel quel (commence par « { »). */
export function decoderSysteme(valeur: string): Systeme {
  const v = valeur.trim();
  return lireSysteme(v.startsWith("{") ? v : depuisBase64url(v));
}

/* ───────────────────────── Sorties ───────────────────────── */

/** Les couleurs dérivées : encre douce et une version « texte » (≥ 4,5:1) de chaque accent, résolues sous le look. */
export function couleurs(s: Systeme) {
  const p = s.palette;
  const fonds = [p.papier, ...p.surfaces];
  const L = s.look.nom;
  const encreDouce = ajusterContraste(melanger(p.encre, p.papier, 0.28), fonds, CONTRASTE_TEXTE, L).couleur;
  const accentsTexte = p.accents.map((a) => ajusterContraste(a, fonds, CONTRASTE_TEXTE, L).couleur);
  const filet = melanger(p.encre, p.papier, 0.82);
  return { papier: p.papier, encre: p.encre, encreDouce, accents: p.accents, accentsTexte, surfaces: p.surfaces, filet };
}

const px = (v: number) => `${+v.toFixed(2)}px`;
/** La courbe CSS d'un nom de courbe. */
export const courbeCss = (c: Courbe) => (c === "ressort" ? EASE.spring : COURBES[c]);

/** Les variables canoniques `--presse-*` (et les jetons de mouvement de tokens.ts, mis à l'échelle). */
export function variables(s: Systeme): Record<string, string> {
  const c = couleurs(s);
  const t = s.typo;
  const v: Record<string, string> = {
    "--presse-papier": hex(c.papier),
    "--presse-encre": hex(c.encre),
    "--presse-encre-douce": hex(c.encreDouce),
    "--presse-surface-1": hex(c.surfaces[0]),
    "--presse-surface-2": hex(c.surfaces[1]),
    "--presse-filet": hex(c.filet),
  };
  for (let i = 0; i < 3; i++) {
    const a = c.accents[i] ?? c.accents[0]!;
    const at = c.accentsTexte[i] ?? c.accentsTexte[0]!;
    v[`--presse-accent-${i + 1}`] = hex(a);
    v[`--presse-accent-${i + 1}-texte`] = hex(at);
  }
  v["--presse-f-titre"] = POLICES[t.titre].pile;
  v["--presse-f-texte"] = POLICES[t.texte].pile;
  v["--presse-f-mono"] = POLICES.plex.pile;
  v["--presse-graisse-titre"] = String(t.graisseTitre);
  v["--presse-graisse-texte"] = String(t.graisseTexte);
  v["--presse-largeur-titre"] = String(t.titre === "archivo" ? t.largeur : 100);
  v["--presse-casse-titre"] = t.capitales ? "uppercase" : "none";
  v["--presse-approche"] = `${t.approche}em`;
  v["--presse-interlignage"] = String(t.interlignage);
  v["--presse-interlignage-titre"] = String(t.interlignageTitre);
  // Échelle : t-0 (légende) … t-6 (titre d'affiche), autour du corps t-1.
  for (let k = 0; k <= 6; k++) v[`--presse-t-${k}`] = px(t.base * Math.pow(t.rapport, k - 1));
  const f = s.forme;
  for (let k = 1; k <= 6; k++) v[`--presse-espace-${k}`] = px(f.espace * [1, 2, 3, 4, 6, 10][k - 1]!);
  v["--presse-rayon"] = px(f.rayon);
  v["--presse-rayon-petit"] = px(Math.round(f.rayon / 2));
  v["--presse-filet-epaisseur"] = px(f.filet);
  const ombreA = +(0.06 + 0.22 * f.ombre).toFixed(3);
  v["--presse-ombre"] = f.ombre <= 0 ? "none" : `0 ${px(2 + 10 * f.ombre)} ${px(6 + 30 * f.ombre)} rgb(0 0 0 / ${s.palette.sombre ? Math.min(0.6, ombreA * 2) : ombreA})`;
  const m = s.mouvement;
  for (const [k, d] of Object.entries(DUR)) v[`--dur-${k}`] = `${Math.round(d * m.echelle)}ms`;
  v["--presse-courbe"] = courbeCss(m.courbe);
  return v;
}

/**
 * Les noms que les pages emploient déjà, branchés sur les variables canoniques : le kit de sections
 * (src/presse/sections.css) et la boutique (src/boutique/style.css). Posés sur tous les éléments de la page, ils
 * l'emportent sur les surcharges locales (une section qui redéfinit `--rouge-texte` pour son fond).
 */
export const ALIAS: Record<string, Record<string, string>> = {
  kit: {
    "--paper": "--presse-papier",
    "--ink": "--presse-encre",
    "--ink-soft": "--presse-encre-douce",
    "--spot": "--presse-accent-1-texte",
    "--rule": "--presse-filet",
    "--ps-radius": "--presse-rayon",
    "--ps-f-display": "--presse-f-titre",
    "--ps-f-text": "--presse-f-texte",
    "--ps-f-mono": "--presse-f-mono",
    "--ps-display-wght": "--presse-graisse-titre",
    "--ps-display-wdth": "--presse-largeur-titre",
    "--ps-display-track": "--presse-approche",
    "--ps-display-case": "--presse-casse-titre",
  },
  boutique: {
    "--papier": "--presse-papier",
    "--gris": "--presse-surface-1",
    "--gris-froid": "--presse-surface-2",
    "--gris-chaud": "--presse-surface-2",
    "--encre": "--presse-encre",
    "--encre-douce": "--presse-encre-douce",
    "--blanc": "--presse-papier",
    "--rouge": "--presse-accent-1",
    "--rouge-texte": "--presse-accent-1-texte",
    "--rouge-vif": "--presse-accent-1",
    "--pervenche": "--presse-accent-2-texte",
    "--rouille": "--presse-accent-3-texte",
    "--f-titre": "--presse-f-titre",
    "--f-texte": "--presse-f-texte",
    "--f-mono": "--presse-f-mono",
  },
};

/**
 * Le bloc CSS du système : variables canoniques sur `:root`, puis (option `alias`) les noms des pages, sur la racine
 * et sur tous ses descendants. `actif` : le sélecteur que src/presse/systeme.ts pose (`:root[data-systeme-actif]`).
 */
export function css(s: Systeme, o: { alias?: boolean; racine?: string; commentaires?: boolean } = {}) {
  const racine = o.racine ?? ":root";
  const com = o.commentaires ?? true;
  const v = variables(s);
  const lignes = (obj: Record<string, string>, pad = "  ") =>
    Object.entries(obj)
      .map(([k, x]) => `${pad}${k}: ${x};`)
      .join("\n");
  const groupes: [string, (k: string) => boolean][] = [
    ["Couleurs (contraste AA tenu, étalonnage compris)", (k) => /papier|encre|surface|filet$|accent/.test(k)],
    ["Typographie", (k) => /-f-|graisse|largeur|casse|approche|interlignage|-t-/.test(k)],
    ["Forme", (k) => /espace|rayon|filet-epaisseur|ombre/.test(k)],
    ["Mouvement", (k) => /dur-|courbe/.test(k)],
  ];
  let out = com ? `/* Système « ${s.nom} » — Presse Variations, graine ${s.graine}. */\n` : "";
  out += `${racine} {\n`;
  const vus = new Set<string>();
  for (const [titre, test] of groupes) {
    const sous = Object.fromEntries(Object.entries(v).filter(([k]) => !vus.has(k) && test(k)));
    if (!Object.keys(sous).length) continue;
    Object.keys(sous).forEach((k) => vus.add(k));
    out += `${com ? `  /* ${titre} */\n` : ""}${lignes(sous)}\n`;
  }
  out += `}\n`;
  if (o.alias !== false) {
    const al: Record<string, string> = {};
    for (const groupe of Object.values(ALIAS)) for (const [k, cible] of Object.entries(groupe)) al[k] = `var(${cible})`;
    const sel = racine === ":root" ? ":root, :root *" : `${racine}, ${racine} *`;
    out += `${com ? "/* Les noms des pages Presse (kit de sections, boutique), branchés sur le système. */\n" : ""}${sel} {\n${lignes(al)}\n}\n`;
  }
  return out;
}

/** Le type de titre du kit et du Créateur (data-ps-type) le plus proche de la typographie du système. */
export function typeKit(t: Typo): "grotesque" | "didone" | "garalde" | "technique" {
  if (t.titre === "bodoni") return "didone";
  if (t.titre === "cormorant") return "garalde";
  if (t.titre === "plex" || t.texte === "plex" || (t.capitales && t.largeur < 90)) return "technique";
  return "grotesque";
}

/** Les attributs Presse de `<html>` : look, effets, transition de page, mouvement, type, palette sombre. */
export function attributs(s: Systeme): Record<string, string> {
  const a: Record<string, string> = {
    "data-presse-look": s.look.nom,
    "data-presse-grain": String(s.look.grain),
    "data-presse-vignette": String(s.look.vignette),
    "data-presse-effects": s.look.effets.join(" "),
    "data-presse-transition": s.mouvement.transitionPage,
    "data-presse-motion": s.mouvement.intensite,
    "data-ps-type": typeKit(s.typo),
  };
  if (s.palette.sombre) a["data-ps-dark"] = "";
  return a;
}
/** Les attributs, en texte à copier (avec la transition de diapo, qui se pose sur chaque `section[data-diapo-slide]`). */
export function attributsTexte(s: Systeme) {
  const a = Object.entries(attributs(s))
    .map(([k, v]) => (v === "" ? k : `${k}="${v}"`))
    .join("\n      ");
  return `<html lang="fr"\n      ${a}>\n\n<!-- Diaporama : sur chaque diapo -->\n<section data-diapo-slide data-transition="${s.mouvement.transitionDiapo}">`;
}

/**
 * Les réglages de page du Créateur (src/createur/model.ts, type Page) que ce système remplit : palette libre (papier,
 * encre, accent), type, look, transition, effets, mouvement, arrondi. Le Créateur n'a pas (encore) de place pour les
 * accents 2 et 3, les surfaces, l'échelle typographique, l'espacement, les ombres, les durées ni le grain fin.
 */
export function versCreateur(s: Systeme) {
  const c = couleurs(s);
  return {
    palette: "libre",
    paper: hex(c.papier),
    ink: hex(c.encre),
    spot: hex(c.accentsTexte[0]!),
    type: typeKit(s.typo),
    look: s.look.nom,
    transition: s.mouvement.transitionPage,
    effects: s.look.effets.filter((e) => e !== "courbure"),
    motion: s.mouvement.intensite,
    radius: Math.round(s.forme.rayon),
  };
}

/** Résumé lisible (nom accessible d'une vignette). */
export const resume = (s: Systeme) =>
  `${s.nom} — ${NOMS_HARMONIES[s.palette.harmonie].toLowerCase()}${s.palette.sombre ? ", sombre" : ""}, ${POLICES[s.typo.titre].nom} et ${POLICES[s.typo.texte].nom}, look ${s.look.nom}`;

/** Pour l'export : la palette en OKLCH (CSS Color 4), à côté des « #rrggbb » de repli. */
export const paletteOklch = (s: Systeme) => {
  const c = couleurs(s);
  return { papier: cssOklch(c.papier), encre: cssOklch(c.encre), accents: c.accents.map(cssOklch), surfaces: c.surfaces.map(cssOklch) };
};
