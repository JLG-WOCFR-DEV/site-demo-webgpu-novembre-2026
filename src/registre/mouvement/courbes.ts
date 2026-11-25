/**
 * Registre — les courbes de mouvement : une seule bibliothèque, lue par le moteur de temps (src/presse/timeline.ts,
 * `easeOf`), par les effets qui animent en Web Animations API (une chaîne CSS) et par l'éditeur de courbe
 * (src/registre/mouvement/editeur-courbe.ts).
 *
 * Une courbe s'écrit comme en CSS, ou par son nom :
 *   - un nom de la maison : `lineaire`, `out`, `in-out`, `in`, `expo`, `ressort` (les six courbes historiques de
 *     `data-anim-ease`, inchangées) ;
 *   - un préréglage de la bibliothèque (`PREREGLAGES`) : `in-quad`, `out-cubic`, `in-out-expo`, `out-recul`,
 *     `out-elastique`, `out-rebond`…, et les trois courbes d'interface `ui-sortie`, `ui-ecran`, `tiroir` ;
 *   - un mot-clé CSS : `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `step-start`, `step-end` ;
 *   - `cubic-bezier(x1, y1, x2, y2)` (x1 et x2 dans [0, 1], comme en CSS) ;
 *   - `steps(n[, jump-start | jump-end | jump-none | jump-both | start | end])` ;
 *   - `linear(y [x%] [x%], …)` : points reliés en ligne droite, entrées manquantes réparties, comme en CSS.
 *
 * Chaque courbe a deux formes, qui disent la même chose : une fonction JS t → y (`lireCourbe(…).f`, pour le moteur de
 * temps et le GPU) et une chaîne CSS (`courbeCss`, pour `animation-timing-function` et `Element.animate`). Les courbes
 * qui n'ont pas d'écriture CSS exacte (élastique, rebond, expo de la maison, ressort physique) deviennent un `linear()`
 * échantillonné de façon adaptative : l'écart entre la chaîne et la fonction reste sous `TOLERANCE_LINEAIRE`.
 *
 * Pur : ni DOM ni réseau (courbes.test.ts, sous Node).
 */
import { spring as ressortMaison } from "../../presse/tokens.ts";

export type Courbe = (t: number) => number;

/* ───────────────────────── Bézier cubique (le solveur du moteur de temps) ───────────────────────── */

/** Une courbe de Bézier cubique, comme en CSS (résolue par Newton, puis dichotomie). */
export function bezier(x1: number, y1: number, x2: number, y2: number): Courbe {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/* ───────────────────────── Marches (steps) ───────────────────────── */

export const POSITIONS_MARCHES = ["jump-start", "jump-end", "jump-none", "jump-both"] as const;
export type PositionMarches = (typeof POSITIONS_MARCHES)[number];

/** `steps(n, position)` selon la spécification CSS Easing (indicateur « avant » ignoré : une courbe, pas une animation). */
export function marches(n: number, position: PositionMarches = "jump-end"): Courbe {
  const sauts = position === "jump-none" ? n - 1 : position === "jump-both" ? n + 1 : n;
  return (t) => {
    let pas = Math.floor(t * n);
    if (position === "jump-start" || position === "jump-both") pas += 1;
    if (t >= 0 && pas < 0) pas = 0;
    if (t <= 1 && pas > sauts) pas = sauts;
    return pas / sauts;
  };
}

/* ───────────────────────── linear() ───────────────────────── */

export type Point = readonly [entree: number, sortie: number];

/** Un arrêt de `linear()` tel qu'écrit : une sortie, zéro, une ou deux entrées (en fraction, pas en %). */
export type Arret = { sortie: number; entrees: number[] };

/**
 * Les points canoniques d'une liste d'arrêts (CSS Easing 2, « canonicalize a linear() function ») : le premier sans
 * entrée prend 0, le dernier 1 (ou la plus grande entrée vue) ; une entrée plus petite qu'une précédente est relevée ;
 * les entrées manquantes sont réparties régulièrement entre leurs voisines connues.
 */
export function pointsCanoniques(arrets: readonly Arret[]): Point[] {
  const pts: { x: number | null; y: number }[] = [];
  for (const a of arrets) {
    if (!a.entrees.length) pts.push({ x: null, y: a.sortie });
    else for (const x of a.entrees.slice(0, 2)) pts.push({ x, y: a.sortie });
  }
  if (!pts.length) return [];
  if (pts[0]!.x === null) pts[0]!.x = 0;
  const dernier = pts[pts.length - 1]!;
  if (dernier.x === null) dernier.x = Math.max(1, ...pts.map((p) => p.x ?? -Infinity));
  let max = -Infinity;
  for (const p of pts) {
    if (p.x === null) continue;
    if (p.x < max) p.x = max;
    max = p.x;
  }
  for (let i = 0; i < pts.length; i++) {
    if (pts[i]!.x !== null) continue;
    const a = i - 1;
    let b = i;
    while (pts[b]!.x === null) b++;
    const xa = pts[a]!.x!;
    const xb = pts[b]!.x!;
    for (let k = i; k < b; k++) pts[k]!.x = xa + ((xb - xa) * (k - a)) / (b - a);
    i = b;
  }
  return pts.map((p) => [p.x!, p.y] as const);
}

/** Évalue une fonction `linear()` canonique (CSS Easing 2, « linear easing output progress »), extrapolée aux bouts. */
export function lineaire(points: readonly Point[]): Courbe {
  if (points.length < 2) {
    const y = points[0]?.[1] ?? 0;
    return () => y;
  }
  return (x) => {
    // Le dernier point dont l'entrée est ≤ x (0 s'il n'y en a pas) ; jamais le tout dernier.
    let ia = 0;
    for (let i = 0; i < points.length; i++) if (points[i]![0] <= x) ia = i;
    if (ia === points.length - 1) ia--;
    const [xa, ya] = points[ia]!;
    const [xb, yb] = points[ia + 1]!;
    if (xa === xb) return yb;
    return ya + ((x - xa) / (xb - xa)) * (yb - ya);
  };
}

/** L'écart toléré entre une courbe et le `linear()` qui l'échantillonne. */
export const TOLERANCE_LINEAIRE = 0.002;

const arr = (x: number, n: number) => {
  const k = 10 ** n;
  const v = Math.round(x * k) / k;
  return Object.is(v, -0) ? 0 : v;
};

/**
 * Échantillonne une fonction en points pour `linear()` : subdivision adaptative (là où ça tourne, plus de points),
 * jusqu'à ce que l'interpolation linéaire reste sous `tolerance` partout (contrôlé en trois points par segment).
 */
export function echantillonner(f: Courbe, tolerance = TOLERANCE_LINEAIRE, profondeurMax = 9): Point[] {
  const pts: Point[] = [[0, f(0)]];
  const couper = (a: number, ya: number, b: number, yb: number, prof: number) => {
    const m = (a + b) / 2;
    const ym = f(m);
    const ecart = (x: number, y: number) => Math.abs(y - (ya + ((x - a) / (b - a)) * (yb - ya)));
    const q1 = a + (b - a) / 4;
    const q3 = a + ((b - a) * 3) / 4;
    const trop = ecart(m, ym) > tolerance || ecart(q1, f(q1)) > tolerance || ecart(q3, f(q3)) > tolerance;
    if (trop && prof < profondeurMax) {
      couper(a, ya, m, ym, prof + 1);
      couper(m, ym, b, yb, prof + 1);
    } else pts.push([b, yb]);
  };
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = i / N;
    const b = (i + 1) / N;
    couper(a, pts[pts.length - 1]![1], b, f(b), 0);
  }
  pts[pts.length - 1] = [1, f(1)];
  // Retire les points alignés avec leurs voisins (à tolerance / 4 près) : la chaîne reste courte.
  const out: Point[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const [xa, ya] = out[out.length - 1]!;
    const [x, y] = pts[i]!;
    const [xb, yb] = pts[i + 1]!;
    if (Math.abs(y - (ya + ((x - xa) / (xb - xa)) * (yb - ya))) > tolerance / 4) out.push(pts[i]!);
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** Les points en chaîne `linear(…)` : sorties à 4 décimales, entrées en % (omises au premier et au dernier point). */
export function versLineaire(points: readonly Point[]): string {
  return `linear(${points
    .map(([x, y], i) => {
      const s = String(arr(y, 4));
      if ((i === 0 && x === 0) || (i === points.length - 1 && x === 1)) return s;
      return `${s} ${arr(x * 100, 2)}%`;
    })
    .join(", ")})`;
}

/* ───────────────────────── Ressort physique ───────────────────────── */

export type ParametresRessort = {
  /** Raideur k (N/m) : grand = rapide et nerveux. */
  raideur: number;
  /** Amortissement c (N·s/m) : petit = ça rebondit longtemps. */
  amortissement: number;
  /** Masse (kg), 1 par défaut. */
  masse?: number;
  /** Vitesse de départ, en longueurs par seconde (0 : au repos). */
  vitesse?: number;
};
export type Ressort = {
  /** La courbe normalisée sur la durée : 0 → 1, dépassement compris. */
  f: Courbe;
  /** La durée estimée (ms) : au-delà, l'écart à la cible reste sous 0,1 %. */
  dureeMs: number;
  /** ζ = c / (2√(km)) : < 1 rebondit, 1 critique, > 1 suramorti. */
  zeta: number;
  /** La chaîne `linear()` à poser avec `dureeMs`. */
  css: string;
};

export const RESSORT_DEFAUT: Required<ParametresRessort> = { raideur: 170, amortissement: 26, masse: 1, vitesse: 0 };

/** L'écart à la cible e(t) = x(t) − 1 d'un oscillateur amorti parti de 0 (solution exacte, trois régimes). */
export function ecartRessort(p: ParametresRessort): (t: number) => number {
  const m = Math.max(1e-3, p.masse ?? 1);
  const k = Math.max(1e-3, p.raideur);
  const c = Math.max(0, p.amortissement);
  const v0 = p.vitesse ?? 0;
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  if (Math.abs(z - 1) < 1e-6) {
    const B = v0 - w0;
    return (t) => (-1 + B * t) * Math.exp(-w0 * t);
  }
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const B = (v0 - z * w0) / wd;
    return (t) => Math.exp(-z * w0 * t) * (-Math.cos(wd * t) + B * Math.sin(wd * t));
  }
  const s = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - s);
  const r2 = -w0 * (z + s);
  const C2 = (v0 + r1) / (r2 - r1);
  const C1 = -1 - C2;
  return (t) => C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
}

/** Un ressort réel en courbe : durée estimée (écart < 0,1 % ensuite), fonction normalisée et `linear()`. */
export function ressort(p: ParametresRessort, seuil = 0.001): Ressort {
  const e = ecartRessort(p);
  const m = Math.max(1e-3, p.masse ?? 1);
  const zeta = Math.max(0, p.amortissement) / (2 * Math.sqrt(Math.max(1e-3, p.raideur) * m));
  // On balaie à la milliseconde jusqu'à 20 s : le dernier instant où l'écart dépasse le seuil.
  let fin = 0;
  for (let ms = 0; ms <= 20000; ms++) if (Math.abs(e(ms / 1000)) >= seuil) fin = ms;
  const dureeMs = Math.max(50, Math.min(20000, fin + 1));
  const T = dureeMs / 1000;
  const f: Courbe = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + e(t * T));
  return { f, dureeMs, zeta, css: versLineaire(echantillonner(f)) };
}

/* ───────────────────────── Fonctions de Penner (élastique, rebond) ───────────────────────── */

const outRebond: Courbe = (x) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};
const C4 = (2 * Math.PI) / 3;
const C5 = (2 * Math.PI) / 4.5;
const bornee = (f: Courbe): Courbe => (x) => (x <= 0 ? 0 : x >= 1 ? 1 : f(x));
const FONCTIONS = {
  "in-elastique": bornee((x) => -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * C4)),
  "out-elastique": bornee((x) => Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * C4) + 1),
  "in-out-elastique": bornee((x) => (x < 0.5 ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * C5)) / 2 : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * C5)) / 2 + 1)),
  "in-rebond": bornee((x) => 1 - outRebond(1 - x)),
  "out-rebond": bornee(outRebond),
  "in-out-rebond": bornee((x) => (x < 0.5 ? (1 - outRebond(1 - 2 * x)) / 2 : (1 + outRebond(2 * x - 1)) / 2)),
} satisfies Record<string, Courbe>;

/* ───────────────────────── La bibliothèque de préréglages ───────────────────────── */

export type Famille = "maison" | "interface" | "css" | "quad" | "cubic" | "quart" | "expo" | "circ" | "recul" | "elastique" | "rebond" | "ressort";

export type Prereglage = {
  nom: string;
  /** Pour l'interface et les lecteurs d'écran. */
  libelle: string;
  famille: Famille;
  /** Défini par ses poignées (CSS exact) … */
  bezier?: readonly [number, number, number, number];
  /** … ou par une fonction (CSS : un linear() échantillonné). */
  f?: Courbe;
  /** Une durée conseillée (ms), pour les ressorts. */
  dureeMs?: number;
  /** Les paramètres physiques, pour les ressorts (l'éditeur les reprend). */
  ressort?: ParametresRessort;
};

const bz = (nom: string, libelle: string, famille: Famille, b: readonly [number, number, number, number]): Prereglage => ({ nom, libelle, famille, bezier: b });
const fn = (nom: string, libelle: string, famille: Famille, f: Courbe): Prereglage => ({ nom, libelle, famille, f });
const rs = (nom: string, libelle: string, p: ParametresRessort): Prereglage => {
  const r = ressort(p);
  return { nom, libelle, famille: "ressort", f: r.f, dureeMs: r.dureeMs, ressort: p };
};

/**
 * Les préréglages, dans l'ordre de l'éditeur. Les familles polynomiales (quad, cubic, quart, expo, circ, recul) sont
 * les approximations en Bézier cubique d'easings.net des fonctions de Robert Penner : CSS natif, et la fonction JS est
 * le même Bézier (les deux formes coïncident exactement ; l'écart à la formule de Penner reste sous 0,03). Élastique,
 * rebond et ressorts sont des fonctions exactes, posées en CSS par un linear() échantillonné.
 */
export const PREREGLAGES: readonly Prereglage[] = [
  bz("lineaire", "Linéaire", "maison", [0, 0, 1, 1]),
  bz("out", "Sortie maison", "maison", [0.16, 1, 0.3, 1]),
  bz("in-out", "Aller-retour maison", "maison", [0.65, 0, 0.35, 1]),
  bz("in", "Départ maison", "maison", [0.55, 0, 1, 0.45]),
  // Famille « interface » : les trois courbes d'Emil Kowalski (docs/REFERENCES-MOUVEMENT.md §3), des défauts d'auteur
  // pour les micro-interactions (appui, entrée, tiroir). `out` et `in-out` restent les courbes maison (références
  // visuelles) ; ces trois-là sont aussi des variables CSS : --presse-ease-sortie, -ecran, -tiroir
  // (src/presse/jetons-mouvement.css).
  bz("ui-sortie", "Interface : entrée et sortie", "interface", [0.23, 1, 0.32, 1]),
  bz("ui-ecran", "Interface : déplacement à l'écran", "interface", [0.77, 0, 0.175, 1]),
  bz("tiroir", "Tiroir (à la iOS)", "interface", [0.32, 0.72, 0, 1]),
  bz("ease", "CSS ease", "css", [0.25, 0.1, 0.25, 1]),
  bz("ease-in", "CSS ease-in", "css", [0.42, 0, 1, 1]),
  bz("ease-out", "CSS ease-out", "css", [0, 0, 0.58, 1]),
  bz("ease-in-out", "CSS ease-in-out", "css", [0.42, 0, 0.58, 1]),
  bz("in-quad", "Quadratique, départ lent", "quad", [0.11, 0, 0.5, 0]),
  bz("out-quad", "Quadratique, arrivée douce", "quad", [0.5, 1, 0.89, 1]),
  bz("in-out-quad", "Quadratique, aller-retour", "quad", [0.45, 0, 0.55, 1]),
  bz("in-cubic", "Cubique, départ lent", "cubic", [0.32, 0, 0.67, 0]),
  bz("out-cubic", "Cubique, arrivée douce", "cubic", [0.33, 1, 0.68, 1]),
  bz("in-out-cubic", "Cubique, aller-retour", "cubic", [0.65, 0, 0.35, 1]),
  bz("in-quart", "Quartique, départ lent", "quart", [0.5, 0, 0.75, 0]),
  bz("out-quart", "Quartique, arrivée douce", "quart", [0.25, 1, 0.5, 1]),
  bz("in-out-quart", "Quartique, aller-retour", "quart", [0.76, 0, 0.24, 1]),
  bz("in-expo", "Exponentielle, départ lent", "expo", [0.7, 0, 0.84, 0]),
  bz("out-expo", "Exponentielle, arrivée douce", "expo", [0.16, 1, 0.3, 1]),
  bz("in-out-expo", "Exponentielle, aller-retour", "expo", [0.87, 0, 0.13, 1]),
  bz("in-circ", "Circulaire, départ lent", "circ", [0.55, 0, 1, 0.45]),
  bz("out-circ", "Circulaire, arrivée douce", "circ", [0, 0.55, 0.45, 1]),
  bz("in-out-circ", "Circulaire, aller-retour", "circ", [0.85, 0, 0.15, 1]),
  bz("in-recul", "Recul avant le départ", "recul", [0.36, 0, 0.66, -0.56]),
  bz("out-recul", "Dépasse puis revient", "recul", [0.34, 1.56, 0.64, 1]),
  bz("in-out-recul", "Recul et dépassement", "recul", [0.68, -0.6, 0.32, 1.6]),
  fn("in-elastique", "Élastique au départ", "elastique", FONCTIONS["in-elastique"]),
  fn("out-elastique", "Élastique à l'arrivée", "elastique", FONCTIONS["out-elastique"]),
  fn("in-out-elastique", "Élastique, aller-retour", "elastique", FONCTIONS["in-out-elastique"]),
  fn("in-rebond", "Rebonds au départ", "rebond", FONCTIONS["in-rebond"]),
  fn("out-rebond", "Rebonds à l'arrivée", "rebond", FONCTIONS["out-rebond"]),
  fn("in-out-rebond", "Rebonds, aller-retour", "rebond", FONCTIONS["in-out-rebond"]),
  rs("ressort-vif", "Ressort vif", { raideur: 300, amortissement: 20 }),
  rs("ressort-souple", "Ressort souple", { raideur: 120, amortissement: 9 }),
  rs("ressort-pose", "Ressort posé", { raideur: 170, amortissement: 26 }),
];

/**
 * Les six courbes historiques de `data-anim-ease` (src/presse/timeline.ts, `EASES`) : mêmes noms, mêmes fonctions
 * qu'avant cette bibliothèque. `expo` (1 − 2^−10t) et `ressort` (le ressort des jetons, src/presse/tokens.ts) n'ont
 * pas de Bézier : leur CSS est un linear().
 */
export const COURBES_MAISON: Readonly<Record<"lineaire" | "out" | "in-out" | "in" | "expo" | "ressort", Courbe>> = {
  lineaire: (t) => t,
  out: bezier(0.16, 1, 0.3, 1),
  "in-out": bezier(0.65, 0, 0.35, 1),
  in: bezier(0.55, 0, 1, 0.45),
  expo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  ressort: (t) => ressortMaison(t),
};

const PAR_NOM = new Map(PREREGLAGES.map((p) => [p.nom, p]));
export const prereglage = (nom: string): Prereglage | undefined => PAR_NOM.get(nom);

/* ───────────────────────── Lecture d'une valeur ───────────────────────── */

export type Genre = "nom" | "cubic-bezier" | "steps" | "linear";
export type Lecture =
  | {
      ok: true;
      genre: Genre;
      /** La chaîne CSS équivalente, normalisée (`cubic-bezier(0.2, 0, 0, 1)`, `steps(4, jump-end)`, `linear(…)`). */
      css: string;
      f: Courbe;
      nom?: string;
      bezier?: readonly [number, number, number, number];
      marches?: { n: number; position: PositionMarches };
      points?: readonly Point[];
    }
  | { ok: false; erreur: string };

const NOMBRE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const nombre = (s: string): number | null => (NOMBRE.test(s.trim()) ? Number(s.trim()) : null);
const POURCENT = /^([+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?)%$/i;
const fmt = (x: number) => String(arr(x, 4));

/** Les noms de CSS qui ne sont pas des préréglages de Bézier. */
const MOTS_CSS: Record<string, string> = { linear: "linear", "step-start": "steps(1, jump-start)", "step-end": "steps(1, jump-end)" };

const cache = new Map<string, Lecture>();

/** Lit une courbe (nom, préréglage, mot-clé CSS, `cubic-bezier()`, `steps()`, `linear()`) ; dit pourquoi si elle est illisible. */
export function lireCourbe(brut: string): Lecture {
  const s = brut.trim().toLowerCase().replace(/\s+/g, " ");
  const vu = cache.get(s);
  if (vu) return vu;
  const l = lire(s);
  if (cache.size > 500) cache.clear();
  cache.set(s, l);
  return l;
}

function lire(s: string): Lecture {
  if (!s) return { ok: false, erreur: "courbe vide" };
  if (s in COURBES_MAISON) {
    const nom = s as keyof typeof COURBES_MAISON;
    const p = PAR_NOM.get(nom);
    const f = COURBES_MAISON[nom];
    const css = nom === "lineaire" ? "linear" : p?.bezier ? cssBezier(p.bezier) : versLineaire(echantillonner(f));
    return { ok: true, genre: "nom", nom, css, f, ...(p?.bezier ? { bezier: p.bezier } : {}) };
  }
  const p = PAR_NOM.get(s);
  if (p) {
    if (p.bezier) return { ok: true, genre: "nom", nom: p.nom, css: cssBezier(p.bezier), f: bezier(...p.bezier), bezier: p.bezier };
    const pts = echantillonner(p.f!);
    return { ok: true, genre: "nom", nom: p.nom, css: versLineaire(pts), f: p.f!, points: pts };
  }
  if (s in MOTS_CSS) {
    if (s === "linear") return { ok: true, genre: "nom", nom: s, css: "linear", f: (t) => t };
    return lire(MOTS_CSS[s]!);
  }
  const m = /^([a-z-]+)\((.*)\)$/.exec(s);
  if (!m) return { ok: false, erreur: `« ${s} » : ni un nom connu, ni cubic-bezier(), steps() ou linear()` };
  const [, fonction, corps] = m as unknown as [string, string, string];
  const args = corps.split(",").map((x) => x.trim());
  if (fonction === "cubic-bezier") {
    if (args.length !== 4) return { ok: false, erreur: `cubic-bezier() attend quatre nombres, ${args.length} reçu(s)` };
    const n = args.map(nombre);
    if (n.some((x) => x === null || !Number.isFinite(x))) return { ok: false, erreur: "cubic-bezier() : un des nombres est illisible" };
    const [x1, y1, x2, y2] = n as [number, number, number, number];
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return { ok: false, erreur: `cubic-bezier() : x1 et x2 doivent être entre 0 et 1 (reçu ${fmt(x1)} et ${fmt(x2)})` };
    const b = [x1, y1, x2, y2] as const;
    return { ok: true, genre: "cubic-bezier", css: cssBezier(b), f: bezier(...b), bezier: b };
  }
  if (fonction === "steps") {
    if (args.length < 1 || args.length > 2) return { ok: false, erreur: "steps() attend un nombre de marches et, au choix, une position" };
    const n = nombre(args[0]!);
    if (n === null || !Number.isInteger(n) || n < 1) return { ok: false, erreur: `steps() : « ${args[0]} » n'est pas un entier ≥ 1` };
    const brutPos = args[1] ?? "jump-end";
    const position = (brutPos === "start" ? "jump-start" : brutPos === "end" ? "jump-end" : brutPos) as PositionMarches;
    if (!(POSITIONS_MARCHES as readonly string[]).includes(position)) return { ok: false, erreur: `steps() : position « ${brutPos} » inconnue (jump-start, jump-end, jump-none, jump-both, start, end)` };
    if (position === "jump-none" && n < 2) return { ok: false, erreur: "steps() : jump-none demande au moins deux marches" };
    return { ok: true, genre: "steps", css: `steps(${n}, ${position})`, f: marches(n, position), marches: { n, position } };
  }
  if (fonction === "linear") {
    if (args.length < 2) return { ok: false, erreur: "linear() attend au moins deux points" };
    const arrets: Arret[] = [];
    for (const a of args) {
      const morceaux = a.split(" ").filter(Boolean);
      let sortie: number | null = null;
      const entrees: number[] = [];
      for (const mo of morceaux) {
        const pc = POURCENT.exec(mo);
        if (pc) entrees.push(Number(pc[1]) / 100);
        else if (sortie === null && nombre(mo) !== null) sortie = nombre(mo);
        else return { ok: false, erreur: `linear() : « ${a} » illisible (un nombre et jusqu'à deux pourcentages)` };
      }
      if (sortie === null || entrees.length > 2) return { ok: false, erreur: `linear() : « ${a} » illisible (un nombre et jusqu'à deux pourcentages)` };
      arrets.push({ sortie, entrees });
    }
    const points = pointsCanoniques(arrets);
    return { ok: true, genre: "linear", css: cssLineaire(arrets), f: lineaire(points), points };
  }
  return { ok: false, erreur: `« ${fonction}() » : seulement cubic-bezier(), steps() et linear()` };
}

const cssBezier = (b: readonly number[]) => `cubic-bezier(${b.map(fmt).join(", ")})`;
const cssLineaire = (arrets: readonly Arret[]) => `linear(${arrets.map((a) => [fmt(a.sortie), ...a.entrees.map((x) => `${arr(x * 100, 4)}%`)].join(" ")).join(", ")})`;

/** La fonction t → y d'une courbe, ou `repli` si elle est illisible. */
export function courbeDe(valeur: string | undefined | null, repli: Courbe = COURBES_MAISON.out): Courbe {
  if (!valeur) return repli;
  const l = lireCourbe(valeur);
  return l.ok ? l.f : repli;
}

/**
 * La chaîne CSS d'une courbe (pour `animation-timing-function`, `Element.animate`), ou `null` si elle est illisible.
 * Les noms de la maison et les préréglages deviennent leur Bézier ou leur linear().
 */
export function courbeCss(valeur: string | undefined | null): string | null {
  if (!valeur) return null;
  const l = lireCourbe(valeur);
  return l.ok ? l.css : null;
}

/** Vrai si la valeur est une courbe lisible (ce que le validateur de pages peut appeler). */
export const estCourbe = (valeur: string) => lireCourbe(valeur).ok;

/** La courbe en chemin SVG (`d`), dans une boîte [0, l] × [0, h], y vers le haut ; `yMin`/`yMax` : l'étendue montrée. */
export function cheminSvg(f: Courbe, l: number, h: number, yMin = 0, yMax = 1, n = 96): string {
  const Y = (y: number) => arr(h - ((y - yMin) / (yMax - yMin)) * h, 2);
  let d = `M0 ${Y(f(0))}`;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    d += ` L${arr(t * l, 2)} ${Y(f(t))}`;
  }
  return d;
}
