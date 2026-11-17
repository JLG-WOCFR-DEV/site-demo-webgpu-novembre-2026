/**
 * Presse — « typo » : six entrées de texte cinétiques, d'après deux vidéos d'Aristide Benoist (novembre 2026). On refait
 * les idées, pas le code.
 *
 *   <ul data-typo="etire"> <li>2023 PACARI LA</li> … </ul>                 (les lignes s'étirent avec le défilement)
 *   <p data-typo="sphere">M AGRIPPA …</p>                                   (posé sur une boule, puis à plat)
 *   <p data-typo="encre">20</p>                                             (une tache molle qui se resserre en lettre)
 *   <p data-typo="trace">1932</p>                                           (écrit trait par trait, au pinceau)
 *   <h2 data-typo="eclats" data-typo-quand="entree">ALANDRIA</h2>           (des éclats de lettres qui s'emboîtent)
 *   <p data-typo="fragments">19 Rue des Rosiers …</p>                       (des bouts de lettres qui se remplissent)
 *
 * Attributs :
 *   data-typo           etire | sphere | encre | trace | eclats | fragments ;
 *   data-typo-quand     entree (défaut : à l'entrée dans l'écran, une fois), chargement, survol, clic, defilement (la
 *                       progression suit la traversée de l'écran), manuel (seulement par script) ;
 *   data-typo-duree     secondes (défaut propre à chaque effet) ;
 *   data-typo-delai     secondes avant le départ ;
 *   data-typo-rejoue    rejoue à chaque entrée (l'élément sorti par le bas se voile de nouveau) ;
 *   data-typo-ligne     (etire) marque les lignes à étirer ; sans eux, les enfants de l'élément, ou l'élément.
 * JS : `initTypo(root?)` arme ce qui est là et ce qui arrive ; `typo(el)` → { jouer(), aller(p), retour(), detruire() }
 * (`aller` rend une promesse, tenue quand l'image est posée : utile au banc d'essai). Événements `typo:debut` et
 * `typo:fin` (detail.sens : 1 à l'arrivée, −1 au retour) sur l'élément.
 *
 * Le texte reste le texte. On ne découpe jamais le DOM de l'élément : son texte d'origine reste en place (lu une seule
 * fois par les lecteurs d'écran, sélectionnable, la mise en page ne bouge pas), rendu transparent pendant l'effet, et
 * l'effet est peint par-dessus dans un calque `aria-hidden` (des copies de lettres posées aux positions mesurées par
 * Range) ou dans un canvas WebGPU. À la fin, calque et styles sont retirés : l'élément redevient du texte ordinaire —
 * exactement le même rendu. Seul `etire` agit sur les lignes elles-mêmes (une transformation et un espacement dans une
 * enveloppe de largeur fixe, posés seulement pendant le mouvement).
 *
 * Techniques :
 *   etire      CSS : --typo-etire (0…1) par ligne, d'après la vitesse de défilement lissée par un ressort et la distance
 *              au centre de l'écran ; scale() + letter-spacing (+ font-stretch si la police a un axe wdth, détecté).
 *   sphere     lettres en transformations 3D CSS : chaque lettre posée sur une sphère (longitude, latitude), qui
 *              tourne et grandit, puis se remet à plat, ligne après ligne ; une frange colorée tant qu'elle penche.
 *   encre      WebGPU : seuil mobile sur un champ de distance approché (masque net + deux flous) déformé par un bruit ;
 *              frange colorée au bord. Repli : flou CSS animé.
 *   trace      lettres coupées en trois bandes obliques (clip-path) révélées chacune par un dégradé de masque qui
 *              balaie dans le sens du trait, décalées : des coups de pinceau.
 *   eclats     chaque lettre coupée en 3 à 5 éclats (clip-path polygonaux, graine stable par lettre) qui arrivent en vol,
 *              tournés, par un ressort, avec des retards échelonnés ; polygones dilatés d'un pixel (pas de liseré).
 *   fragments  WebGPU : le masque des lettres révélé par un bruit cellulaire seuillé, ligne par ligne, de gauche à
 *              droite. Repli : lettres révélées par clip-path, en désordre réglé.
 * Mouvement réduit : un fondu court (rien pour etire). Rien ne tourne au repos ; mesures en lot au départ, au
 * redimensionnement et à l'arrivée des polices. Banc d'essai (`?presse-banc`) : comme goo et metal, les effets WebGPU
 * dessinent hors écran, relisent la texture et la peignent en 2D dans leur canvas. `?typo-repli` force le repli.
 */
import { getDevice, onDeviceLost } from "../components/device.ts";
import { everyFrame, EASES, reducedMotion } from "./timeline.ts";
import { spring, springStep, type Spring } from "./tokens.ts";
import { lintOn, lintSample } from "./motion-lint.ts";

/* ───────────────────────── Fonctions pures (testées sous Node) ───────────────────────── */

export const EFFETS = ["etire", "sphere", "encre", "trace", "eclats", "fragments"] as const;
export type Effet = (typeof EFFETS)[number];
export const effetDe = (v: string | null | undefined): Effet | null => ((EFFETS as readonly string[]).includes(v ?? "") ? (v as Effet) : null);
export const QUANDS = ["entree", "chargement", "survol", "clic", "defilement", "manuel"] as const;
export type Quand = (typeof QUANDS)[number];
export const quandDe = (v: string | null | undefined): Quand => ((QUANDS as readonly string[]).includes(v ?? "") ? (v as Quand) : "entree");
/** Durées par défaut (s). */
export const DUREES: Record<Effet, number> = { etire: 1.2, sphere: 2.4, encre: 2.6, trace: 2.6, eclats: 2.4, fragments: 2.2 };

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lisse = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Une graine entière à partir d'un texte et d'un numéro (FNV-1a). */
export function graineDe(s: string, n = 0) {
  let h = 2166136261 ^ n;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= n * 374761393;
  return h >>> 0;
}
/** Un générateur pseudo-aléatoire déterministe (mulberry32) : même graine, même suite. */
export function aleaDe(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Pt = [number, number];
/** Aire (signée, positive dans le sens horaire de l'écran) d'un polygone. */
export function aire(p: readonly Pt[]) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}
/** Centre de gravité d'un polygone (non dégénéré). */
export function centroide(p: readonly Pt[]): Pt {
  const A = aire(p);
  if (Math.abs(A) < 1e-12) {
    const n = p.length || 1;
    return [p.reduce((s, q) => s + q[0], 0) / n, p.reduce((s, q) => s + q[1], 0) / n];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const c = a[0] * b[1] - b[0] * a[1];
    cx += (a[0] + b[0]) * c;
    cy += (a[1] + b[1]) * c;
  }
  return [cx / (6 * A), cy / (6 * A)];
}
/** La partie d'un polygone convexe du côté où n·(x − o) ≥ 0 (Sutherland–Hodgman, un seul plan). */
export function couper(p: readonly Pt[], o: Pt, n: Pt): Pt[] {
  const s = (q: Pt) => (q[0] - o[0]) * n[0] + (q[1] - o[1]) * n[1];
  const out: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const sa = s(a);
    const sb = s(b);
    if (sa >= 0) out.push(a);
    if (sa >= 0 !== sb >= 0) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
/**
 * La découpe d'une lettre en `n` éclats : le carré unité partagé par des coupes droites successives (on coupe toujours
 * le plus grand morceau, par un point près de son centre). `lamelles` (0–1) : part des coupes presque horizontales (les
 * lamelles des références). Les morceaux pavent exactement le carré (aucun trou, aucun recouvrement). Déterministe.
 */
export function decouperEclats(graine: number, n: number, lamelles = 0.5): Pt[][] {
  const r = aleaDe(graine);
  let pieces: Pt[][] = [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  ];
  for (let guard = 0; pieces.length < n && guard < 64; guard++) {
    let k = 0;
    for (let i = 1; i < pieces.length; i++) if (Math.abs(aire(pieces[i]!)) > Math.abs(aire(pieces[k]!))) k = i;
    const p = pieces[k]!;
    const c = centroide(p);
    const ech = Math.sqrt(Math.abs(aire(p)));
    const o: Pt = [c[0] + (r() - 0.5) * 0.35 * ech, c[1] + (r() - 0.5) * 0.35 * ech];
    const a = r() < lamelles ? (r() - 0.5) * 0.5 : r() * Math.PI;
    const nv: Pt = [-Math.sin(a), Math.cos(a)];
    const A = couper(p, o, nv);
    const B = couper(p, o, [-nv[0], -nv[1]]);
    const total = Math.abs(aire(p));
    if (A.length < 3 || B.length < 3 || Math.abs(aire(A)) < total * 0.12 || Math.abs(aire(B)) < total * 0.12) continue;
    pieces = [...pieces.slice(0, k), A, B, ...pieces.slice(k + 1)];
  }
  return pieces;
}
/**
 * Pousse chaque arête d'un polygone convexe de `d` vers l'extérieur (sommets en onglet, limité à 4 d sur les angles
 * aigus) : deux voisins se chevauchent d'au moins d le long de leur coupe, sans liseré.
 */
export function dilater(p: readonly Pt[], d: number): Pt[] {
  const s = Math.sign(aire(p)) || 1;
  const n = p.length;
  // Normale extérieure de l'arête i (de p[i] à p[i+1]).
  const nrm = (i: number): Pt => {
    const a = p[i]!;
    const b = p[(i + 1) % n]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(s * (b[1] - a[1])) / l, (-s * (b[0] - a[0])) / l];
  };
  return p.map((v, i) => {
    const n1 = nrm((i - 1 + n) % n);
    const n2 = nrm(i);
    const bx = n1[0] + n2[0];
    const by = n1[1] + n2[1];
    const cos2 = (1 + n1[0] * n2[0] + n1[1] * n2[1]) / 2; // cos² du demi-angle entre les normales
    const l = Math.hypot(bx, by) || 1;
    // Le sommet en onglet : le long de la bissectrice des normales, à d / cos(demi-angle).
    const m = d * Math.min(4, 1 / Math.sqrt(Math.max(cos2, 1e-6)));
    return [v[0] + (bx / l) * m, v[1] + (by / l) * m] as Pt;
  });
}

/** Le vol d'un éclat : d'où il part (en tailles de police), de combien il tourne, son arc, son retard (0–0,55). */
export type Vol = { dx: number; dy: number; rot: number; arc: number; retard: number };
/**
 * Les vols des éclats d'une lettre. `base` : la direction d'où viennent la plupart des éclats (radians) ; `rang` : la
 * place de la lettre dans le mot (0–1), qui échelonne les arrivées.
 */
export function volsEclats(graine: number, n: number, base: number, rang: number): Vol[] {
  const r = aleaDe(graine ^ 0x9e3779b9);
  const out: Vol[] = [];
  for (let i = 0; i < n; i++) {
    const a = base + (r() - 0.5) * 1.9;
    const d = 0.7 + r() * 1.4;
    out.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, rot: (r() - 0.5) * 140, arc: (r() - 0.5) * 1.6, retard: Math.min(0.55, rang * 0.4 + r() * 0.15) });
  }
  return out;
}
/** Durée (en part de la progression) du vol d'un éclat ; retard + vol ≤ 1. */
export const VOL_ECLAT = 0.45;
/**
 * La pose d'un éclat à l'instant local t (0 → 1) : décalage (en tailles de police), rotation (degrés), opacité. Un
 * ressort amorti (léger dépassement), et un arc : le décalage tourne en revenant. À t = 1 : exactement à sa place.
 */
export function poseEclat(v: Vol, t: number) {
  const tt = clamp01(t);
  if (tt >= 1) return { x: 0, y: 0, rot: 0, o: 1, k: 0 };
  const s = spring(tt * 1.15 > 1 ? 1 : tt * 1.15, 0.7, 9);
  const k = 1 - s;
  const a = v.arc * k;
  const x = (v.dx * Math.cos(a) - v.dy * Math.sin(a)) * k;
  const y = (v.dx * Math.sin(a) + v.dy * Math.cos(a)) * k;
  return { x, y, rot: v.rot * k, o: lisse(0, 0.06, tt), k };
}

/**
 * Une lettre sur la sphère. (dx, dy) : centre de la lettre par rapport au centre du texte (px) ; R : rayon (px) ;
 * q : 0 = sur la sphère, 1 = à plat ; tourne : rotation de la sphère (radians) à q = 0 ; echelle : taille de la
 * sphère à q = 0. Rend le décalage à ajouter à la position à plat (px), les rotations (degrés) et l'opacité (les
 * lettres de l'autre face s'effacent). À q = 1 : décalage nul, rotations nulles, opacité 1.
 */
export function projeterSphere(dx: number, dy: number, R: number, q: number, tourne = 0.9, echelle = 0.62) {
  const k = 1 - clamp01(q);
  const th = dx / R + tourne * k;
  const ph = dy / R;
  const sg = mix(1, echelle, k);
  const X = R * Math.sin(th) * Math.cos(ph) * sg;
  const Y = R * Math.sin(ph) * sg;
  const Z = R * (Math.cos(th) * Math.cos(ph) - 1) * sg;
  const vis = Math.cos(th) * Math.cos(ph);
  return {
    x: (X - dx) * k,
    y: (Y - dy) * k,
    z: Z * k,
    ry: ((th * 180) / Math.PI) * k,
    rx: ((-ph * 180) / Math.PI) * k,
    s: mix(1, sg, k),
    o: mix(clamp01(vis * 3), 1, 1 - k),
  };
}

/**
 * L'étirement d'une ligne (0–1) d'après la vitesse de défilement v (px/s) et sa distance au centre de l'écran d (−1 au
 * bord haut, 0 au centre, 1 au bord bas). Nul au repos ; croît avec la vitesse (sature) et avec la distance au centre.
 */
export function courbeEtire(v: number, d: number, vRef = 1800) {
  const vit = 1 - Math.exp(-Math.abs(v) / vRef);
  const dist = lisse(0.04, 1.05, Math.abs(d));
  return clamp01(vit * (0.1 + 0.9 * dist) * 1.25);
}

/* L'automate des déclencheurs. */
export type Etat = "attente" | "aller" | "fini" | "retour" | "suivi";
export type Evenement = "visible" | "invisible-bas" | "invisible-haut" | "pret" | "survol" | "survol-fin" | "clic" | "arrive" | "parti";
export type Action = "jouer" | "rejouer" | "remettre" | "aucune";
/** L'état de départ : voilé en attente (entree, chargement), suivi (defilement), ou texte normal (survol, clic, manuel). */
export function etatInitial(q: Quand): Etat {
  return q === "entree" || q === "chargement" ? "attente" : q === "defilement" ? "suivi" : "fini";
}
/** Ce que fait un événement, selon le déclencheur et l'état. `rejoue` : data-typo-rejoue. */
export function transition(q: Quand, e: Etat, ev: Evenement, rejoue = false): { etat: Etat; action: Action } {
  const reste = { etat: e, action: "aucune" as Action };
  if (ev === "arrive") return e === "aller" ? { etat: "fini", action: "aucune" } : reste;
  if (ev === "parti") return e === "retour" ? { etat: "attente", action: "aucune" } : reste;
  if (q === "defilement" || q === "manuel") return reste;
  if (q === "entree") {
    if (ev === "visible" && e === "attente") return { etat: "aller", action: "jouer" };
    if (ev === "invisible-bas" && rejoue && e !== "attente") return { etat: "attente", action: "remettre" };
    return reste;
  }
  if (q === "chargement") return ev === "pret" && e === "attente" ? { etat: "aller", action: "jouer" } : reste;
  if (q === "survol") return ev === "survol" && e !== "aller" ? { etat: "aller", action: "rejouer" } : reste;
  if (q === "clic") return ev === "clic" && e !== "aller" ? { etat: "aller", action: "rejouer" } : reste;
  return reste;
}
/** La progression pilotée au défilement : 0 quand le haut de l'élément entre en bas de l'écran, 1 quand son centre atteint 45 % de la hauteur. */
export function progressionDefilement(haut: number, h: number, vh: number) {
  const debut = vh;
  const fin = vh * 0.45 - h / 2;
  return clamp01((debut - haut) / Math.max(1, debut - fin));
}

/* ───────────────────────── CSS ───────────────────────── */

const CSS = `
.typo-voile, .typo-voile :not(.typo-calque):not(.typo-calque *) { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; }
.typo-calque { position: absolute; inset: 0; pointer-events: none; user-select: none; -webkit-user-select: none; z-index: 1; overflow: visible; }
.typo-calque > span { position: absolute; display: block; white-space: pre; margin: 0; padding: 0; border: 0; text-indent: 0; text-align: left; text-transform: none; transform-origin: 50% 50%; will-change: transform; }
.typo-canvas { position: absolute !important; pointer-events: none; display: block; z-index: 1; margin: 0; padding: 0; border: 0; max-width: none !important; }
.typo-etire-l.typo-etire-actif { transform: scale(calc(1 + var(--typo-etire, 0) * 0.85), calc(1 - var(--typo-etire, 0) * 0.08)); transform-origin: 50% 50%; }
.typo-etire-in { display: inline-flex; justify-content: center; white-space: pre; max-width: none; vertical-align: top; }
.typo-etire-actif > .typo-etire-in { letter-spacing: calc(var(--typo-ls0, 0px) + var(--typo-etire, 0) * 0.12em); }
.typo-etire-wdth.typo-etire-actif > .typo-etire-in { font-stretch: calc(var(--typo-fs0, 100%) + var(--typo-etire, 0) * 25%); }
`;
let cssPose = false;
function poserCss() {
  if (cssPose) return;
  cssPose = true;
  const st = document.createElement("style");
  st.dataset.presseTypo = "";
  st.textContent = CSS;
  document.head.append(st);
}

/* ───────────────────────── Mesure : les lettres aux positions du DOM ───────────────────────── */

type Style = { font: string; chasse: string; famille: string; taille: number; couleur: string; css: Partial<Record<string, string>> };
/** La chasse CSS (pourcentage) en mot-clé de canvas (le raccourci `font` du canvas n'admet pas de pourcentage). */
export function chasseCanvas(v: string) {
  const n = v.endsWith("%") ? Number.parseFloat(v) : ({ "ultra-condensed": 50, "extra-condensed": 62.5, condensed: 75, "semi-condensed": 87.5, "semi-expanded": 112.5, expanded: 125, "extra-expanded": 150, "ultra-expanded": 200 } as Record<string, number>)[v] ?? 100;
  const mots: [number, string][] = [[50, "ultra-condensed"], [62.5, "extra-condensed"], [75, "condensed"], [87.5, "semi-condensed"], [100, "normal"], [112.5, "semi-expanded"], [125, "expanded"], [150, "extra-expanded"], [200, "ultra-expanded"]];
  let best = mots[4]!;
  for (const m of mots) if (Math.abs(m[0] - n) < Math.abs(best[0] - n)) best = m;
  return best[1];
}
type Lettre = { ch: string; x: number; y: number; w: number; h: number; ligne: number; rang: number; ordre: number; st: Style };
type Mesure = { W: number; H: number; lettres: Lettre[]; nLignes: number; taille: number };

function styleDe(el: Element, cache: Map<Element, Style>): Style {
  let s = cache.get(el);
  if (s) return s;
  const cs = getComputedStyle(el);
  const taille = Number.parseFloat(cs.fontSize) || 16;
  s = {
    font: `${cs.fontStyle} ${cs.fontWeight} ${taille}px ${cs.fontFamily}`,
    chasse: chasseCanvas(cs.fontStretch),
    famille: cs.fontFamily,
    taille,
    couleur: cs.color,
    css: {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      fontStretch: cs.fontStretch,
      fontVariationSettings: cs.fontVariationSettings,
      fontFeatureSettings: cs.fontFeatureSettings,
      fontKerning: cs.fontKerning,
      fontOpticalSizing: (cs as unknown as { fontOpticalSizing: string }).fontOpticalSizing,
      color: cs.color,
      webkitTextFillColor: cs.color,
    },
  };
  cache.set(el, s);
  return s;
}

/** Les lettres de l'élément (hors calque), en px CSS relatifs à sa boîte de remplissage. Une seule passe de lecture. */
function mesurer(el: HTMLElement): Mesure {
  const voile = el.classList.contains("typo-voile");
  if (voile) el.classList.remove("typo-voile"); // les couleurs d'origine
  const r = el.getBoundingClientRect();
  const ox = r.left + el.clientLeft;
  const oy = r.top + el.clientTop;
  const cache = new Map<Element, Style>();
  const lettres: Lettre[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(".typo-calque, .typo-canvas, script, style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const range = document.createRange();
  let ligne = -1;
  let haut = -1e9;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent ?? "";
    const st = styleDe(n.parentElement ?? el, cache);
    for (let i = 0; i < t.length; i++) {
      const ch = t[i]!;
      // Paires de substitution (emoji…) : un seul caractère.
      const code = ch.charCodeAt(0);
      const long = code >= 0xd800 && code <= 0xdbff && i + 1 < t.length ? 2 : 1;
      const c = t.slice(i, i + long);
      if (/\s/.test(c)) continue;
      range.setStart(n, i);
      range.setEnd(n, i + long);
      i += long - 1;
      const rc = range.getBoundingClientRect();
      if (!rc.width || !rc.height) continue;
      if (Math.abs(rc.top - haut) > rc.height * 0.5) {
        ligne++;
        haut = rc.top;
      }
      lettres.push({ ch: c, x: rc.left - ox, y: rc.top - oy, w: rc.width, h: rc.height, ligne, rang: 0, ordre: 0, st });
    }
  }
  if (voile) el.classList.add("typo-voile");
  const nLignes = ligne + 1;
  // Rang dans le texte (0–1) et ordre de lecture (ligne par ligne, de gauche à droite, 0–1).
  const bornes = Array.from({ length: nLignes }, () => [Infinity, -Infinity] as [number, number]);
  for (const l of lettres) {
    const b = bornes[l.ligne]!;
    b[0] = Math.min(b[0], l.x);
    b[1] = Math.max(b[1], l.x + l.w);
  }
  lettres.forEach((l, i) => {
    l.rang = lettres.length > 1 ? i / (lettres.length - 1) : 0;
    const b = bornes[l.ligne]!;
    const xf = (l.x + l.w / 2 - b[0]) / Math.max(1, b[1] - b[0]);
    l.ordre = (l.ligne + xf * 0.92) / Math.max(1, nLignes);
  });
  const taille = lettres.length ? lettres.reduce((s, l) => Math.max(s, l.st.taille), 0) : Number.parseFloat(getComputedStyle(el).fontSize) || 16;
  return { W: el.clientWidth, H: el.clientHeight, lettres, nLignes, taille };
}

/** Une copie de lettre dans le calque : même police, même couleur, posée sur la boîte mesurée (marge m autour). */
function copie(l: Lettre, m = 0): HTMLSpanElement {
  const s = document.createElement("span");
  s.textContent = l.ch;
  Object.assign(s.style, l.st.css);
  s.style.left = `${l.x - m}px`;
  s.style.top = `${l.y - m}px`;
  s.style.width = `${l.w + 2 * m}px`;
  s.style.height = `${l.h + 2 * m}px`;
  s.style.padding = `${m}px 0 0 ${m}px`;
  s.style.boxSizing = "border-box";
  s.style.lineHeight = `${l.h}px`;
  s.style.letterSpacing = "0px";
  return s;
}
function calque(el: HTMLElement) {
  const c = document.createElement("div");
  c.className = "typo-calque";
  c.setAttribute("aria-hidden", "true");
  el.append(c);
  return c;
}

/* ───────────────────────── Les rendus ───────────────────────── */

interface Rendu {
  /** Pose l'état à la progression p (0 < p < 1). Peut rendre une promesse (banc d'essai : l'image est peinte). */
  poser(p: number): void | Promise<void>;
  /** Retire tout ce que le rendu a posé. */
  nettoyer(): void;
  /** Le texte d'origine est-il voilé pendant l'effet (le rendu le repeint) ? */
  voile: boolean;
  gpu?: boolean;
}

/** Mouvement réduit : un fondu court. */
class Fondu implements Rendu {
  voile = false;
  private el: HTMLElement;
  constructor(el: HTMLElement) {
    this.el = el;
  }
  poser(p: number) {
    this.el.style.opacity = String(Math.round(EASES.out!(p) * 1000) / 1000);
  }
  nettoyer() {
    this.el.style.removeProperty("opacity");
  }
}

/** La sphère : chaque lettre en 3D CSS. */
class Sphere implements Rendu {
  voile = true;
  private c: HTMLDivElement;
  private spans: HTMLSpanElement[] = [];
  private m: Mesure;
  constructor(el: HTMLElement, m: Mesure) {
    this.m = m;
    this.c = calque(el);
    // La boule est taillée sur le texte (pas sur la boîte de l'élément, souvent bien plus large).
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const l of m.lettres) ((x0 = Math.min(x0, l.x)), (y0 = Math.min(y0, l.y)), (x1 = Math.max(x1, l.x + l.w)), (y1 = Math.max(y1, l.y + l.h)));
    this.cx = (x0 + x1) / 2;
    this.cy = (y0 + y1) / 2;
    this.R = Math.max(x1 - x0, y1 - y0, 1) * 0.5;
    this.c.style.perspective = `${this.R * 1.9}px`;
    this.c.style.perspectiveOrigin = `${this.cx}px ${this.cy}px`;
    for (const l of m.lettres) this.spans.push(this.c.appendChild(copie(l)));
  }
  private cx = 0;
  private cy = 0;
  private R = 1;
  poser(p: number) {
    const m = this.m;
    const { cx, cy, R } = this;
    const L = Math.max(1, m.nLignes);
    const st = L > 1 ? Math.min(0.07, 0.25 / (L - 1)) : 0;
    m.lettres.forEach((l, i) => {
      const ql = clamp01((p - l.ligne * st) / (1 - (L - 1) * st));
      // Longtemps sur la boule, puis à plat sans à-coup (courbe lisse aux deux bouts).
      const e = lisse(0.15, 1, ql);
      const pr = projeterSphere(l.x + l.w / 2 - cx, l.y + l.h / 2 - cy, R, e, 1.1, 0.6);
      const s = this.spans[i]!;
      s.style.transform = `translate3d(${pr.x.toFixed(2)}px, ${pr.y.toFixed(2)}px, ${pr.z.toFixed(2)}px) rotateY(${pr.ry.toFixed(2)}deg) rotateX(${pr.rx.toFixed(2)}deg) scale(${pr.s.toFixed(4)})`;
      s.style.opacity = (pr.o * lisse(0, 0.18, ql)).toFixed(3);
      // Une frange colorée tant que la lettre penche (la référence a ce dédoublement rouge / bleu).
      const a = (1 - e) * (1.5 + Math.abs(pr.ry) * 0.05);
      s.style.textShadow = a > 0.05 ? `${(-a).toFixed(2)}px 0 rgba(255, 70, 20, 0.55), ${a.toFixed(2)}px 0 rgba(30, 80, 255, 0.55)` : "";
      if (i === 0 && lintOn()) lintSample(s, "x", pr.x, performance.now());
    });
  }
  nettoyer() {
    this.c.remove();
  }
}

/** Le tracé : trois bandes obliques par lettre, chacune balayée par un dégradé de masque. */
class Trace implements Rendu {
  voile = true;
  private c: HTMLDivElement;
  private bandes: { s: HTMLSpanElement; debut: number; ang: number; ux: number; uy: number }[] = [];
  private taille: number;
  constructor(el: HTMLElement, m: Mesure) {
    this.c = calque(el);
    this.taille = m.taille;
    const n = m.lettres.length;
    m.lettres.forEach((l, i) => {
      const r = aleaDe(graineDe(l.ch, i * 7 + 3));
      const mg = l.st.taille * 0.2;
      const W = l.w + 2 * mg;
      const H = l.h + 2 * mg;
      // La direction du trait : proche de la verticale, inclinée au hasard.
      const a = Math.PI / 2 + (r() - 0.5) * 0.9;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const nx = -uy;
      const ny = ux;
      // Les bandes : tranches perpendiculaires à la normale (n), sur l'étendue de la boîte projetée.
      const coins: Pt[] = [
        [0, 0],
        [W, 0],
        [W, H],
        [0, H],
      ];
      const proj = coins.map(([x, y]) => x * nx + y * ny);
      const lo = Math.min(...proj);
      const hi = Math.max(...proj);
      const S = 3;
      const coupes = [lo - 1];
      for (let k = 1; k < S; k++) coupes.push(lo + ((hi - lo) * (k + (r() - 0.5) * 0.5)) / S);
      coupes.push(hi + 1);
      const ordreBandes = [0, 1, 2].sort(() => r() - 0.5);
      for (let k = 0; k < S; k++) {
        let poly = couper(coins, [nx * coupes[k]!, ny * coupes[k]!], [nx, ny]);
        poly = couper(poly, [nx * coupes[k + 1]!, ny * coupes[k + 1]!], [-nx, -ny]);
        if (poly.length < 3) continue;
        poly = dilater(poly, 0.8);
        const s = copie(l, mg);
        s.style.clipPath = `polygon(${poly.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(", ")})`;
        // Le sens du coup de pinceau : vers le bas ou vers le haut.
        const sens = r() < 0.65 ? 1 : -1;
        const ang = (Math.atan2(uy * sens, ux * sens) * 180) / Math.PI + 90;
        const debut = (n > 1 ? i / (n - 1) : 0) * 0.42 + ordreBandes[k]! * 0.1 + r() * 0.04;
        this.bandes.push({ s, debut, ang, ux: ux * sens, uy: uy * sens });
        this.c.appendChild(s);
      }
    });
  }
  poser(p: number) {
    for (const b of this.bandes) {
      const t = clamp01((p - b.debut) / 0.32);
      const e = EASES["in-out"]!(t);
      const s = b.s;
      if (t <= 0) {
        s.style.visibility = "hidden";
        continue;
      }
      s.style.visibility = "";
      // Le front du trait est net (6 % de fondu), comme un pinceau chargé.
      const g = e * 106 - 6;
      const mask = t >= 1 ? "none" : `linear-gradient(${b.ang.toFixed(1)}deg, #000 ${g.toFixed(1)}%, transparent ${(g + 6).toFixed(1)}%)`;
      s.style.maskImage = mask;
      s.style.setProperty("-webkit-mask-image", mask);
      // Le trait arrive en balayant : un petit glissement dans son sens, qui se résorbe.
      const d = (1 - EASES.out!(t)) * this.taille * 0.06;
      s.style.transform = d > 0.01 ? `translate(${(-b.ux * d).toFixed(2)}px, ${(-b.uy * d).toFixed(2)}px)` : "";
    }
  }
  nettoyer() {
    this.c.remove();
  }
}

/** Les éclats : 3 à 5 morceaux par lettre, en vol. */
class Eclats implements Rendu {
  voile = true;
  private c: HTMLDivElement;
  private pieces: { s: HTMLSpanElement; v: Vol; taille: number }[] = [];
  constructor(el: HTMLElement, m: Mesure, texte: string) {
    this.c = calque(el);
    const base = aleaDe(graineDe(texte, 11))() < 0.5 ? 0.15 : Math.PI - 0.15; // la plupart viennent de droite, ou de gauche
    m.lettres.forEach((l, i) => {
      const g = graineDe(l.ch, i);
      const n = 3 + Math.floor(aleaDe(g)() * 3);
      const polys = decouperEclats(g, n, 0.55);
      const vols = volsEclats(g, polys.length, base, l.rang);
      const mg = l.st.taille * 0.25;
      const W = l.w + 2 * mg;
      const H = l.h + 2 * mg;
      polys.forEach((poly, k) => {
        // Les bords du carré unité débordent un peu (rien n'est rogné), les coupes intérieures se chevauchent d'un pixel.
        const px = dilater(
          poly.map(([u, v]) => [u * W, v * H] as Pt),
          0.9,
        ).map(([x, y]) => [x <= 0.5 ? x - 4 : x >= W - 0.5 ? x + 4 : x, y <= 0.5 ? y - 4 : y >= H - 0.5 ? y + 4 : y] as Pt);
        const s = copie(l, mg);
        s.style.clipPath = `polygon(${px.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(", ")})`;
        const c = centroide(poly);
        s.style.transformOrigin = `${(c[0] * W).toFixed(1)}px ${(c[1] * H).toFixed(1)}px`;
        this.pieces.push({ s, v: vols[k]!, taille: l.st.taille });
        this.c.appendChild(s);
      });
    });
  }
  poser(p: number) {
    this.pieces.forEach((pc, i) => {
      const t = (p - pc.v.retard) / VOL_ECLAT;
      const e = poseEclat(pc.v, t);
      const s = pc.s;
      if (t <= 0) {
        s.style.visibility = "hidden";
        return;
      }
      s.style.visibility = "";
      const x = e.x * pc.taille;
      const y = e.y * pc.taille;
      s.style.transform = e.k > 1e-4 ? `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${e.rot.toFixed(2)}deg)` : "";
      s.style.opacity = e.o >= 1 ? "" : e.o.toFixed(3);
      // Frange chromatique en vol (comme la référence), qui s'éteint à l'arrivée.
      const a = Math.min(4, e.k * 9);
      s.style.textShadow = a > 0.08 ? `${(-a).toFixed(2)}px 0 rgba(255, 40, 90, 0.85), ${a.toFixed(2)}px 0 rgba(20, 170, 255, 0.85)` : "";
      if (i === 0 && lintOn()) {
        lintSample(s, "x", x, performance.now());
        lintSample(s, "y", y, performance.now());
      }
    });
  }
  nettoyer() {
    this.c.remove();
  }
}

/** Repli des fragments sans WebGPU : chaque lettre se découvre par un clip-path, dans l'ordre de lecture, en désordre réglé. */
class FragmentsRepli implements Rendu {
  voile = true;
  private c: HTMLDivElement;
  private ls: { s: HTMLSpanElement; debut: number; haut: number }[] = [];
  constructor(el: HTMLElement, m: Mesure) {
    this.c = calque(el);
    m.lettres.forEach((l, i) => {
      const r = aleaDe(graineDe(l.ch, i + 101));
      const s = this.c.appendChild(copie(l, l.st.taille * 0.15));
      this.ls.push({ s, debut: l.ordre * 0.7 + r() * 0.12, haut: r() });
    });
  }
  poser(p: number) {
    for (const l of this.ls) {
      const t = clamp01((p - l.debut) / 0.18);
      if (t >= 1) {
        l.s.style.clipPath = "";
        l.s.style.visibility = "";
        continue;
      }
      l.s.style.visibility = t <= 0 ? "hidden" : "";
      // Le haut ou le bas d'abord, puis la droite : des bouts de lettre.
      const a = (1 - t) * 100;
      const v = (1 - lisse(0, 0.6, t)) * 100;
      l.s.style.clipPath = l.haut < 0.5 ? `inset(0 ${a.toFixed(1)}% ${v.toFixed(1)}% 0)` : `inset(${v.toFixed(1)}% ${a.toFixed(1)}% 0 0)`;
    }
  }
  nettoyer() {
    this.c.remove();
  }
}

/** Repli de l'encre sans WebGPU : un flou qui se resserre. */
class EncreRepli implements Rendu {
  voile = false;
  private el: HTMLElement;
  private taille: number;
  constructor(el: HTMLElement, taille: number) {
    this.el = el;
    this.taille = taille;
  }
  poser(p: number) {
    const e = EASES.out!(p);
    this.el.style.filter = `blur(${((1 - e) * this.taille * 0.09).toFixed(2)}px)`;
    this.el.style.opacity = lisse(0, 0.3, p).toFixed(3);
  }
  nettoyer() {
    this.el.style.removeProperty("filter");
    this.el.style.removeProperty("opacity");
  }
}

/* ───────────────────────── WebGPU : encre et fragments ───────────────────────── */

export const WGSL = /* wgsl */ `
struct U {
  a: vec4f,   // largeur, hauteur (px appareil), dpr, mode (0 encre, 1 fragments)
  b: vec4f,   // progression, graine, taille de police (px appareil), —
  c: vec4f,   // encre (rgb)
  d: vec4f,   // frange extérieure (rgb)
  e: vec4f,   // frange intérieure (rgb)
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var masque: texture_2d<f32>;

struct VO { @builtin(position) pos: vec4f, @location(0) px: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let c = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VO;
  o.pos = vec4f(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);
  o.px = c * u.a.xy;
  return o;
}
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn hash2(p: vec2f) -> vec2f { return fract(sin(vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)))) * 43758.5453); }
fn bruit(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = mix(hash(i), hash(i + vec2f(1.0, 0.0)), w.x);
  let b = mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), w.x);
  return mix(a, b, w.y) * 2.0 - 1.0;
}
// Bruit cellulaire : (distance au germe le plus proche, valeur de sa cellule).
fn cellule(p: vec2f) -> vec2f {
  let i = floor(p);
  let f = fract(p);
  var dm = 9.0;
  var id = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let g = vec2f(f32(x), f32(y));
      let r = g + hash2(i + g) - f;
      let d = dot(r, r);
      if (d < dm) { dm = d; id = hash(i + g + vec2f(3.1, 7.7)); }
    }
  }
  return vec2f(sqrt(dm), id);
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let W = u.a.xy;
  let q = clamp(u.b.x, 0.0, 1.0);
  let g = u.b.y * 31.7;
  let taille = max(u.b.z, 1.0);
  if (u.a.w < 0.5) {
    // ── Encre : une tache molle qui se resserre en lettre. ──
    let t = 1.0 - q;
    // Le domaine coule : un bruit lent qui déforme, et une coulure vers le bas (on lit plus haut).
    let sp = i.px / (taille * 0.42);
    var w = vec2f(bruit(sp + vec2f(g, 0.0)), bruit(sp + vec2f(0.0, g + 4.2))) * taille * 0.10 * t * t;
    w.y = w.y - abs(bruit(vec2f(i.px.x / (taille * 0.16), g))) * taille * 0.12 * t * t;
    let m = textureSampleLevel(masque, samp, (i.px + w) / W, 0.0);
    // Le champ : très flou (b), puis peu flou (g), puis net (r).
    let k = smoothstep(0.0, 1.0, q);
    var f = select(mix(m.g, m.r, (k - 0.55) / 0.45), mix(m.b, m.g, k / 0.55), k < 0.55);
    f = f + bruit(i.px / (taille * 0.08) + vec2f(g)) * 0.07 * t;
    // Le seuil : haut (rien), puis bas (la tache gonfle), puis 0,5 (la lettre).
    let th = select(mix(0.36, 0.5, smoothstep(0.3, 1.0, q)), mix(1.02, 0.36, smoothstep(0.0, 0.3, q)), q < 0.3);
    let soft = mix(0.1, 0.5, q * q);
    let dl = 0.09 * t;
    let a = smoothstep(th - soft, th + soft, f);
    let aExt = smoothstep(th - dl - soft, th - dl + soft, f);
    let aInt = smoothstep(th + dl - soft, th + dl + soft, f);
    let col = u.c.rgb * aInt + mix(u.c.rgb, u.e.rgb, 0.85) * max(a - aInt, 0.0) + u.d.rgb * max(aExt - a, 0.0);
    let fade = smoothstep(0.0, 0.1, q);
    return vec4f(col * fade, aExt * fade);
  }
  // ── Fragments : le masque révélé par un bruit cellulaire seuillé, dans l'ordre de lecture. ──
  let m = textureSampleLevel(masque, samp, i.px / W, 0.0);
  let spread = 0.3;
  let local = clamp((q * (1.0 + spread) - m.a) / spread, 0.0, 1.0);
  let c1 = cellule(i.px / (taille * 0.24) + vec2f(g));
  let c2 = bruit(i.px / (taille * 0.06) + vec2f(g * 1.3));
  let n = c1.y * 0.8 + c1.x * 0.15 + c2 * 0.06;
  let e = 0.035;
  let v = smoothstep(n - e, n + e, local * 1.25 - 0.1);
  let a = m.r * v;
  return vec4f(u.c.rgb * a, a);
}
`;

type Partage = { device: GPUDevice; layout: GPUBindGroupLayout; mod: GPUShaderModule; pipes: Map<GPUTextureFormat, GPURenderPipeline>; samp: GPUSampler };
let gpu: Partage | null = null;
let gpuEtat: "inconnu" | "attente" | "pret" | "absent" = "inconnu";
let gpuPromesse: Promise<void> | null = null;
let format: GPUTextureFormat = "bgra8unorm";

/** Mode banc d'essai (`globalThis.__presseBanc = true` ou `?presse-banc`) : pas de contexte WebGPU à l'écran. */
export const modeBanc = () => typeof globalThis !== "undefined" && (!!(globalThis as { __presseBanc?: boolean }).__presseBanc || (typeof location !== "undefined" && /[?&]presse-banc\b/.test(location.search)));
const forceRepli = () => typeof location !== "undefined" && /[?&]typo-repli\b/.test(location.search);

function partageDe(device: GPUDevice): Partage {
  const mod = device.createShaderModule({ code: WGSL, label: "presse-typo" });
  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ],
  });
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  return { device, layout, mod, pipes: new Map(), samp };
}
function pipeDe(s: Partage, f: GPUTextureFormat) {
  let p = s.pipes.get(f);
  if (!p) {
    const blend: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } };
    p = s.device.createRenderPipeline({
      label: `presse-typo-${f}`,
      layout: s.device.createPipelineLayout({ bindGroupLayouts: [s.layout] }),
      vertex: { module: s.mod, entryPoint: "vs" },
      fragment: { module: s.mod, entryPoint: "fs", targets: [{ format: f, blend }] },
      primitive: { topology: "triangle-list" },
    });
    s.pipes.set(f, p);
  }
  return p;
}
/** Démarre WebGPU (une fois) ; la promesse est tenue quand on sait (prêt ou absent). */
function demarrerGpu(): Promise<void> {
  if (gpuPromesse) return gpuPromesse;
  if (forceRepli() || typeof navigator === "undefined" || !navigator.gpu) {
    gpuEtat = "absent";
    return (gpuPromesse = Promise.resolve());
  }
  gpuEtat = "attente";
  gpuPromesse = (async () => {
    try {
      const device = await getDevice();
      gpu = partageDe(device);
      format = navigator.gpu.getPreferredCanvasFormat();
      gpuEtat = "pret";
      void device.lost.then((info) => {
        if (info.reason === "destroyed" && gpu?.device === device) perdreGpu();
      });
    } catch {
      gpuEtat = "absent";
      gpu = null;
    }
  })();
  return gpuPromesse;
}
function perdreGpu() {
  gpu = null;
  gpuEtat = "absent";
  for (const t of instances.values()) t.gpuPerdu();
}
/** Attend que l'état de WebGPU soit connu, au plus `ms` millisecondes. */
function gpuDecide(ms = 2000) {
  return Promise.race([demarrerGpu(), new Promise<void>((r) => setTimeout(r, ms))]);
}

/** Les trois flous de boîte séparables de rayon r (≈ un gaussien), en flottant. */
export function flouBoite3(src: Float32Array, W: number, H: number, r: number) {
  let a = Float32Array.from(src);
  const b = new Float32Array(W * H);
  const passe = (from: Float32Array, to: Float32Array, horiz: boolean) => {
    const n = horiz ? W : H;
    const lignes = horiz ? H : W;
    const inv = 1 / (2 * r + 1);
    for (let l = 0; l < lignes; l++) {
      const at = (i: number) => (horiz ? l * W + i : i * W + l);
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += from[at(Math.min(n - 1, Math.max(0, i)))]!;
      for (let i = 0; i < n; i++) {
        to[at(i)] = acc * inv;
        acc += from[at(Math.min(n - 1, i + r + 1))]! - from[at(Math.max(0, i - r))]!;
      }
    }
  };
  for (let k = 0; k < 3; k++) {
    passe(a, b, true);
    passe(b, a, false);
  }
  return a;
}

const couleurRgb = (() => {
  let c: CanvasRenderingContext2D | null = null;
  return (css: string): [number, number, number] => {
    c ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!c) return [0, 0, 0];
    c.clearRect(0, 0, 1, 1);
    c.fillStyle = "#000";
    c.fillStyle = css;
    c.fillRect(0, 0, 1, 1);
    const d = c.getImageData(0, 0, 1, 1).data;
    return [d[0]! / 255, d[1]! / 255, d[2]! / 255];
  };
})();

/** Encre et fragments en WebGPU : un canvas posé dans l'élément, le masque des lettres en texture. */
class RenduGpu implements Rendu {
  voile = true;
  gpu = true;
  private canvas: HTMLCanvasElement;
  private ctx: GPUCanvasContext | null;
  private ubuf: GPUBuffer;
  private tex: GPUTexture;
  private bind: GPUBindGroup;
  private data = new Float32Array(20);
  private enVol: Promise<void> = Promise.resolve();
  private W: number;
  private H: number;
  constructor(el: HTMLElement, m: Mesure, mode: 0 | 1, graine: number) {
    const s = gpu!;
    const k = Math.min(devicePixelRatio || 1, 2);
    const M = Math.ceil(m.taille * (mode === 0 ? 0.35 : 0.15));
    const c = document.createElement("canvas");
    c.className = "typo-canvas";
    c.setAttribute("aria-hidden", "true");
    Object.assign(c.style, { left: `${-M}px`, top: `${-M}px`, width: `${m.W + 2 * M}px`, height: `${m.H + 2 * M}px` });
    const W = (this.W = Math.max(1, Math.round((m.W + 2 * M) * k)));
    const H = (this.H = Math.max(1, Math.round((m.H + 2 * M) * k)));
    c.width = W;
    c.height = H;
    el.append(c);
    this.canvas = c;
    this.ctx = modeBanc() ? null : c.getContext("webgpu");
    this.ctx?.configure({ device: s.device, format, alphaMode: "premultiplied" });
    // Le masque : lettres nettes (r), floutées (g, b), ordre de lecture (a).
    const net = document.createElement("canvas");
    net.width = W;
    net.height = H;
    const g = net.getContext("2d", { willReadFrequently: true })!;
    g.fillStyle = "#fff";
    g.textBaseline = "alphabetic";
    const ordre = new Float32Array(W * H);
    let fontCourante = "";
    let asc = 0;
    let desc = 0;
    for (const l of m.lettres) {
      const f = l.st.font.replace(/(\d+(?:\.\d+)?)px/, (_, n: string) => `${Number(n) * k}px`);
      if (f + l.st.chasse !== fontCourante) {
        g.font = f;
        (g as unknown as { fontStretch: string }).fontStretch = l.st.chasse;
        fontCourante = f + l.st.chasse;
        if ("letterSpacing" in g) (g as unknown as { letterSpacing: string }).letterSpacing = "0px";
        const met = g.measureText("Hg");
        asc = met.fontBoundingBoxAscent / k;
        desc = met.fontBoundingBoxDescent / k;
      }
      const base = l.y + (l.h - (asc + desc)) / 2 + asc;
      g.fillText(l.ch, (l.x + M) * k, (base + M) * k);
      const mg = l.st.taille * 0.12;
      const x0 = Math.max(0, Math.floor((l.x + M - mg) * k));
      const x1 = Math.min(W, Math.ceil((l.x + l.w + M + mg) * k));
      const y0 = Math.max(0, Math.floor((l.y + M - mg) * k));
      const y1 = Math.min(H, Math.ceil((l.y + l.h + M + mg) * k));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) ordre[y * W + x] = l.ordre;
    }
    const a = g.getImageData(0, 0, W, H).data;
    const n01 = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) n01[i] = a[i * 4 + 3]! / 255;
    const px = new Uint8Array(W * H * 4);
    let f1: Float32Array | null = null;
    let f2: Float32Array | null = null;
    if (mode === 0) {
      f1 = flouBoite3(n01, W, H, Math.max(1, Math.round(m.taille * 0.035 * k)));
      f2 = flouBoite3(n01, W, H, Math.max(1, Math.round(m.taille * 0.11 * k)));
      // Normalisés : le cœur des fûts atteint 1, le seuil 0,5 tombe près du bord.
      let m1 = 1e-3;
      let m2 = 1e-3;
      for (let i = 0; i < W * H; i++) ((m1 = Math.max(m1, f1[i]!)), (m2 = Math.max(m2, f2[i]!)));
      for (let i = 0; i < W * H; i++) ((f1[i] = Math.min(1, (f1[i]! / m1) * 1.05)), (f2[i] = Math.min(1, (f2[i]! / m2) * 1.05)));
    }
    for (let i = 0; i < W * H; i++) {
      px[i * 4] = Math.round(n01[i]! * 255);
      px[i * 4 + 1] = f1 ? Math.round(f1[i]! * 255) : 0;
      px[i * 4 + 2] = f2 ? Math.round(f2[i]! * 255) : 0;
      px[i * 4 + 3] = Math.round(ordre[i]! * 255);
    }
    this.tex = s.device.createTexture({ size: [W, H], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    s.device.queue.writeTexture({ texture: this.tex }, px, { bytesPerRow: W * 4 }, [W, H]);
    this.ubuf = s.device.createBuffer({ size: this.data.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.bind = s.device.createBindGroup({
      layout: s.layout,
      entries: [
        { binding: 0, resource: { buffer: this.ubuf } },
        { binding: 1, resource: s.samp },
        { binding: 2, resource: this.tex.createView() },
      ],
    });
    const d = this.data;
    d[0] = W;
    d[1] = H;
    d[2] = k;
    d[3] = mode;
    d[5] = (graine % 1000) / 1000;
    d[6] = m.taille * k;
    d.set(couleurRgb(m.lettres[0]?.st.couleur ?? "#000"), 8);
    d.set([0.42, 0.36, 0.92], 12); // frange extérieure : violet-bleu
    d.set([0.98, 0.62, 0.18], 16); // frange intérieure : orangé
  }
  poser(p: number) {
    const s = gpu;
    if (!s) return;
    this.data[4] = p;
    s.device.queue.writeBuffer(this.ubuf, 0, this.data);
    if (this.ctx) {
      const enc = s.device.createCommandEncoder();
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
      pass.setPipeline(pipeDe(s, format));
      pass.setBindGroup(0, this.bind);
      pass.draw(3);
      pass.end();
      s.device.queue.submit([enc.finish()]);
      return;
    }
    // Banc d'essai : hors écran, relu, peint en 2D. Une relecture à la fois ; pendant qu'elle court, seule la dernière
    // progression demandée sera peinte ensuite.
    this.aPeindre = true;
    if (!this.peint) {
      this.peint = true;
      this.enVol = (async () => {
        while (this.aPeindre && !this.detruit) {
          this.aPeindre = false;
          await this.peindreBanc(s);
        }
        this.peint = false;
      })();
    }
    return this.enVol;
  }
  private aPeindre = false;
  private peint = false;
  private detruit = false;
  private async peindreBanc(s: Partage) {
    const { W, H } = this;
    s.device.queue.writeBuffer(this.ubuf, 0, this.data);
    const tex = s.device.createTexture({ size: [W, H], format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    const bpr = Math.ceil((W * 4) / 256) * 256;
    const buf = s.device.createBuffer({ size: bpr * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = s.device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: tex.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    pass.setPipeline(pipeDe(s, "rgba8unorm"));
    pass.setBindGroup(0, this.bind);
    pass.draw(3);
    pass.end();
    enc.copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: bpr }, [W, H]);
    s.device.queue.submit([enc.finish()]);
    try {
      await buf.mapAsync(GPUMapMode.READ);
    } catch {
      tex.destroy();
      return;
    }
    const src = new Uint8Array(buf.getMappedRange());
    const img = new ImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * bpr + x * 4;
        const o = (y * W + x) * 4;
        const a = src[i + 3]!;
        img.data[o] = a ? Math.min(255, (src[i]! * 255) / a) : 0;
        img.data[o + 1] = a ? Math.min(255, (src[i + 1]! * 255) / a) : 0;
        img.data[o + 2] = a ? Math.min(255, (src[i + 2]! * 255) / a) : 0;
        img.data[o + 3] = a;
      }
    buf.unmap();
    buf.destroy();
    tex.destroy();
    if (this.canvas.isConnected && !this.detruit) this.canvas.getContext("2d")?.putImageData(img, 0, 0);
  }
  nettoyer() {
    this.detruit = true;
    try {
      this.ctx?.unconfigure();
    } catch {
      /* appareil perdu */
    }
    this.tex.destroy();
    this.ubuf.destroy();
    this.canvas.remove();
  }
}

/* ───────────────────────── Un élément typo ───────────────────────── */

export type TypoApi = { jouer(): void; aller(p: number): Promise<void>; retour(): void; detruire(): void };

const instances = new Map<HTMLElement, Typo>();
let io: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;
const defilants = new Set<Typo>();
let boucleDefil: { stop(): void; wake(): void } | null = null;
let arme = false;
let fontesPretes = false;

class Typo implements TypoApi {
  readonly effet: Exclude<Effet, "etire">;
  readonly quand: Quand;
  private etat: Etat;
  private p: number;
  private sens = 0;
  private attente = 0;
  private rendu: Rendu | null = null;
  private sale = true;
  private boucle: { stop(): void; wake(): void } | null = null;
  private posPerso = false;
  private bancPromesse: Promise<void> = Promise.resolve();
  private pDefil = 0;
  private haut = 0;
  private hauteur = 0;
  readonly el: HTMLElement;
  constructor(el: HTMLElement) {
    this.el = el;
    this.effet = effetDe(el.dataset.typo) as Exclude<Effet, "etire">;
    this.quand = quandDe(el.dataset.typoQuand);
    this.etat = etatInitial(this.quand);
    this.p = this.etat === "fini" ? 1 : 0;
    poserCss();
    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
      this.posPerso = true;
    }
    el.dataset.typoPret = "";
    if (this.etat !== "fini") this.poser(this.p);
    if (this.quand === "entree") io?.observe(el);
    ro?.observe(el);
    if (this.quand === "survol") {
      el.addEventListener("pointerenter", this.surSurvol);
      el.addEventListener("focusin", this.surSurvol);
    } else if (this.quand === "clic") el.addEventListener("click", this.surClic);
    else if (this.quand === "chargement") void quandCharge().then(() => this.evenement("pret"));
    else if (this.quand === "defilement") {
      defilants.add(this);
      this.mesurerDefil();
      reveillerDefil();
    }
    if (this.effet === "encre" || this.effet === "fragments") void demarrerGpu();
  }
  private surSurvol = (e: Event) => {
    if ((e as PointerEvent).pointerType === "touch") return;
    this.evenement("survol");
  };
  private surClic = () => this.evenement("clic");
  private get duree() {
    const d = Number.parseFloat(this.el.dataset.typoDuree ?? "");
    const base = Number.isFinite(d) && d > 0 ? d : DUREES[this.effet];
    return reducedMotion() ? Math.min(base, 0.35) : base;
  }
  private get delai() {
    const d = Number.parseFloat(this.el.dataset.typoDelai ?? "");
    return Number.isFinite(d) && d > 0 ? d : 0;
  }
  evenement(ev: Evenement) {
    const r = transition(this.quand, this.etat, ev, this.el.dataset.typoRejoue !== undefined);
    this.etat = r.etat;
    if (r.action === "jouer" || r.action === "rejouer") this.lancer(r.action === "rejouer" ? 0 : this.p, 1);
    else if (r.action === "remettre") {
      this.arreter();
      this.poser(0);
    }
  }
  /** Joue depuis le début. */
  jouer() {
    this.etat = "aller";
    this.lancer(0, 1);
  }
  retour() {
    this.etat = "retour";
    this.lancer(this.p, -1);
  }
  private async lancer(depuis: number, sens: 1 | -1) {
    this.arreter();
    if (this.effet === "encre" || this.effet === "fragments") await gpuDecide();
    this.p = depuis;
    this.sens = sens;
    this.attente = sens > 0 ? this.delai : 0;
    this.poser(this.p);
    this.el.dispatchEvent(new CustomEvent("typo:debut", { detail: { sens } }));
    this.boucle = everyFrame((dt) => this.pas(dt));
  }
  private pas(dt: number) {
    if (this.attente > 0) {
      this.attente -= dt;
      return true;
    }
    this.p = clamp01(this.p + (this.sens * dt) / this.duree);
    this.poser(this.p);
    if ((this.sens > 0 && this.p >= 1) || (this.sens < 0 && this.p <= 0)) {
      this.evenement(this.sens > 0 ? "arrive" : "parti");
      this.el.dispatchEvent(new CustomEvent("typo:fin", { detail: { sens: this.sens } }));
      this.sens = 0;
      this.boucle = null;
      return false;
    }
    return true;
  }
  private arreter() {
    this.boucle?.stop();
    this.boucle = null;
    this.sens = 0;
  }
  async aller(p: number) {
    this.arreter();
    if (this.effet === "encre" || this.effet === "fragments") await gpuDecide();
    this.p = clamp01(p);
    this.etat = this.p >= 1 ? "fini" : this.p <= 0 ? "attente" : "aller";
    this.poser(this.p);
    await this.bancPromesse;
  }
  /** Le rendu à construire, selon l'effet, le mouvement réduit et WebGPU. */
  private construire(): Rendu {
    const el = this.el;
    if (reducedMotion()) return new Fondu(el);
    const m = mesurer(el);
    const texte = el.textContent ?? "";
    switch (this.effet) {
      case "sphere":
        return new Sphere(el, m);
      case "trace":
        return new Trace(el, m);
      case "eclats":
        return new Eclats(el, m, texte);
      case "encre":
        return gpuEtat === "pret" && gpu ? new RenduGpu(el, m, 0, graineDe(texte)) : new EncreRepli(el, m.taille);
      case "fragments":
        return gpuEtat === "pret" && gpu ? new RenduGpu(el, m, 1, graineDe(texte)) : new FragmentsRepli(el, m);
    }
  }
  /** Pose l'état p : 1 = texte ordinaire (rien), 0 = voilé (en attente), entre les deux = l'effet. */
  private poser(p: number) {
    const el = this.el;
    if (p >= 1) {
      this.nettoyer();
      return;
    }
    if (p <= 0 && !this.rendu) {
      // En attente : texte voilé (toujours lu par les lecteurs d'écran), ou transparent en mouvement réduit.
      if (reducedMotion()) el.style.opacity = "0";
      else el.classList.add("typo-voile");
      return;
    }
    if (this.sale || !this.rendu) {
      this.rendu?.nettoyer();
      el.style.removeProperty("opacity");
      this.rendu = this.construire();
      this.sale = false;
    }
    el.classList.toggle("typo-voile", this.rendu.voile);
    el.classList.add("typo-encours");
    const r = this.rendu.poser(p);
    if (r) this.bancPromesse = r;
  }
  private nettoyer() {
    this.rendu?.nettoyer();
    this.rendu = null;
    this.sale = true;
    this.el.classList.remove("typo-voile", "typo-encours");
    this.el.style.removeProperty("opacity");
  }
  /** Redimensionnement, polices arrivées : on remesure (au prochain pas, ou tout de suite si un état est posé). */
  invalider() {
    this.sale = true;
    if (this.quand === "defilement") this.mesurerDefil();
    if (this.rendu && !this.boucle) this.poser(this.p);
  }
  gpuPerdu() {
    if (this.rendu?.gpu) {
      this.rendu.nettoyer();
      this.rendu = null;
      this.sale = true;
      if (!this.boucle && this.p > 0 && this.p < 1) this.poser(this.p);
    }
  }
  mesurerDefil() {
    const r = this.el.getBoundingClientRect();
    this.haut = r.top + scrollY;
    this.hauteur = r.height;
  }
  /** Défilement : la progression suit, lissée. Rend vrai tant qu'elle bouge. */
  pasDefil(dt: number) {
    const cible = progressionDefilement(this.haut - scrollY, this.hauteur, innerHeight);
    const k = reducedMotion() ? 1 : 1 - Math.exp(-dt / 0.08);
    this.pDefil += (cible - this.pDefil) * k;
    if (Math.abs(cible - this.pDefil) < 1e-3) this.pDefil = cible;
    if (this.pDefil !== this.p) {
      this.p = this.pDefil;
      this.poser(this.p);
    }
    return this.pDefil !== cible;
  }
  detruire() {
    this.arreter();
    this.nettoyer();
    io?.unobserve(this.el);
    ro?.unobserve(this.el);
    defilants.delete(this);
    this.el.removeEventListener("pointerenter", this.surSurvol);
    this.el.removeEventListener("focusin", this.surSurvol);
    this.el.removeEventListener("click", this.surClic);
    if (this.posPerso) this.el.style.removeProperty("position");
    delete this.el.dataset.typoPret;
    instances.delete(this.el);
  }
}

/* ───────────────────────── etire : les lignes au défilement ───────────────────────── */

const RESSORT_VITESSE: Spring = { k: 70, zeta: 1 };
type Ligne = { el: HTMLElement; inner: HTMLElement | null; y: number; e: number; une: boolean; largeur: number; aligne: string };

class Etire implements TypoApi {
  private lignes: Ligne[] = [];
  private v = 0;
  private vv = 0;
  private dernierY = 0;
  private boucle: { stop(): void; wake(): void } | null = null;
  private impulsion = -1;
  private calme = 0;
  private force: number | null = null;
  private onScroll = () => this.reveiller();
  readonly el: HTMLElement;
  constructor(el: HTMLElement) {
    this.el = el;
    poserCss();
    el.dataset.typoPret = "";
    let ls = [...el.querySelectorAll<HTMLElement>("[data-typo-ligne]")];
    if (!ls.length) ls = el.children.length ? ([...el.children] as HTMLElement[]) : [el];
    const wdth = detecterWdth(ls[0]);
    for (const l of ls) {
      l.classList.add("typo-etire-l");
      if (wdth) l.classList.add("typo-etire-wdth");
      this.lignes.push({ el: l, inner: null, y: 0, e: 0, une: false, largeur: 0, aligne: "center" });
    }
    this.envelopper();
    this.mesurer();
    this.dernierY = scrollY;
    addEventListener("scroll", this.onScroll, { passive: true });
    ro?.observe(el);
  }
  /**
   * Pendant le mouvement, chaque ligne d'une seule ligne de texte reçoit une enveloppe inline-flex de la largeur de sa
   * boîte, alignée comme le texte : l'espacement grandit sans changer la mise en page (le débordement se fait des deux
   * côtés, pas de retour à la ligne). Au repos, l'enveloppe est retirée : la ligne redevient exactement elle-même. Une
   * ligne qui en fait déjà plusieurs n'est que transformée. Les mesures (largeur, alignement) sont lues en lot.
   */
  private envelopper() {
    const lectures = this.lignes.map((l) => {
      const cs = getComputedStyle(l.el);
      const lh = Number.parseFloat(cs.lineHeight) || (Number.parseFloat(cs.fontSize) || 16) * 1.2;
      const r = document.createRange();
      r.selectNodeContents(l.el);
      const n = new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
      const ta = cs.textAlign;
      return {
        ls: cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing,
        fs: cs.fontStretch || "100%",
        une: n <= 1 && l.el.clientHeight < lh * 1.6,
        largeur: l.el.clientWidth - (Number.parseFloat(cs.paddingLeft) || 0) - (Number.parseFloat(cs.paddingRight) || 0),
        aligne: ta === "center" ? "center" : ta === "right" || ta === "end" ? "flex-end" : "flex-start",
      };
    });
    this.lignes.forEach((l, i) => {
      const x = lectures[i]!;
      l.el.style.setProperty("--typo-ls0", x.ls);
      l.el.style.setProperty("--typo-fs0", x.fs);
      Object.assign(l, { une: x.une, largeur: x.largeur, aligne: x.aligne });
      if (l.inner) l.inner.style.width = `${x.largeur}px`;
    });
  }
  private ouvrir(l: Ligne) {
    if (l.inner || !l.une) return;
    const inner = document.createElement("span");
    inner.className = "typo-etire-in";
    inner.style.justifyContent = l.aligne;
    inner.style.width = `${l.largeur}px`;
    while (l.el.firstChild) inner.appendChild(l.el.firstChild);
    l.el.appendChild(inner);
    l.inner = inner;
  }
  private fermer(l: Ligne) {
    const inner = l.inner;
    if (!inner) return;
    while (inner.firstChild) l.el.insertBefore(inner.firstChild, inner);
    inner.remove();
    l.inner = null;
  }
  /** Les centres des lignes, en coordonnées de document : lus en lot, au départ et au redimensionnement. */
  mesurer() {
    const sy = scrollY;
    for (const l of this.lignes) {
      const r = l.el.getBoundingClientRect();
      l.y = r.top + sy + r.height / 2;
    }
  }
  invalider() {
    // Au repos (sans enveloppe), on relit largeurs et alignements ; les centres toujours.
    for (const l of this.lignes) this.fermer(l);
    this.envelopper();
    this.mesurer();
    for (const l of this.lignes) if (l.e > 0) this.ouvrir(l);
  }
  private reveiller() {
    if (reducedMotion() || this.force !== null) return;
    this.calme = 0;
    if (this.boucle) this.boucle.wake();
    else {
      this.dernierY = scrollY;
      this.boucle = everyFrame((dt) => this.pas(dt));
    }
  }
  private pas(dt: number) {
    if (dt <= 0) return true;
    const y = scrollY;
    const dy = y - this.dernierY;
    this.dernierY = y;
    let brut = Math.abs(dy) > innerHeight * 0.9 ? 0 : dy / dt;
    if (this.impulsion >= 0) {
      // jouer() : un lancer simulé, sans défiler.
      this.impulsion += dt;
      brut = this.impulsion < 0.9 ? 2600 * Math.sin((Math.PI * this.impulsion) / 0.9) : 0;
      if (this.impulsion >= 0.9) this.impulsion = -1;
    }
    [this.v, this.vv] = springStep(this.v, this.vv, brut, Math.min(dt, 1 / 30), RESSORT_VITESSE);
    // Le repos : plusieurs images de suite sans défilement (le premier pas après un événement voit souvent dy = 0).
    this.calme = brut === 0 && this.impulsion < 0 ? this.calme + 1 : 0;
    const repos = Math.abs(this.v) < 4 && Math.abs(this.vv) < 40 && this.calme > 8;
    if (repos) ((this.v = 0), (this.vv = 0));
    this.appliquer(this.v, y);
    if (repos) {
      this.boucle = null;
      return false;
    }
    return true;
  }
  private appliquer(v: number, y: number) {
    const mi = innerHeight / 2;
    const now = performance.now();
    this.lignes.forEach((l, i) => {
      const d = (l.y - y - mi) / mi;
      let e = courbeEtire(v, d);
      if (e < 0.002) e = 0;
      if (Math.abs(e - l.e) < 0.002 && !(e === 0 && l.e !== 0)) return;
      l.e = e;
      if (e === 0) {
        l.el.classList.remove("typo-etire-actif");
        l.el.style.removeProperty("--typo-etire");
        this.fermer(l);
      } else {
        this.ouvrir(l);
        l.el.classList.add("typo-etire-actif");
        l.el.style.setProperty("--typo-etire", e.toFixed(4));
      }
      if (i === 0 && lintOn()) lintSample(l.el, "width", e * 100, now);
    });
  }
  jouer() {
    if (reducedMotion()) return;
    this.force = null;
    this.impulsion = 0;
    this.reveiller();
  }
  async aller(p: number) {
    this.boucle?.stop();
    this.boucle = null;
    const q = reducedMotion() ? 0 : clamp01(p); // mouvement réduit : etire ne fait rien
    this.force = q > 0 && q < 1 ? q : null;
    this.v = 0;
    this.vv = 0;
    this.appliquer(q > 0 && q < 1 ? 2600 * Math.sin(Math.PI * q) : 0, scrollY);
  }
  retour() {
    void this.aller(1);
  }
  detruire() {
    this.boucle?.stop();
    removeEventListener("scroll", this.onScroll);
    ro?.unobserve(this.el);
    for (const l of this.lignes) {
      l.el.classList.remove("typo-etire-l", "typo-etire-wdth", "typo-etire-actif");
      for (const p of ["--typo-etire", "--typo-ls0", "--typo-fs0"]) l.el.style.removeProperty(p);
      this.fermer(l);
    }
    delete this.el.dataset.typoPret;
    etires.delete(this.el);
  }
}
const etires = new Map<HTMLElement, Etire>();

/** La police de la ligne a-t-elle un axe de chasse (wdth) ? On mesure la même chaîne à 100 % et à 125 %. */
function detecterWdth(l: HTMLElement | undefined) {
  if (!l) return false;
  const s = document.createElement("span");
  s.textContent = "MOHAWK mohawk 0123";
  s.setAttribute("aria-hidden", "true");
  Object.assign(s.style, { position: "absolute", visibility: "hidden", whiteSpace: "pre", fontStretch: "100%" });
  l.appendChild(s);
  const a = s.getBoundingClientRect().width;
  s.style.fontStretch = "125%";
  const b = s.getBoundingClientRect().width;
  s.remove();
  return Math.abs(b - a) > 0.5;
}

/* ───────────────────────── Armement ───────────────────────── */

function quandCharge() {
  return new Promise<void>((res) => {
    const go = () => void (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(() => res()));
    if (document.readyState === "complete") go();
    else addEventListener("load", go, { once: true });
  });
}
function reveillerDefil() {
  if (boucleDefil) boucleDefil.wake();
  else
    boucleDefil = everyFrame((dt) => {
      let bouge = false;
      for (const t of defilants) if (t.pasDefil(dt)) bouge = true;
      if (!bouge) boucleDefil = null;
      return bouge;
    });
}

function armer(el: HTMLElement) {
  if (instances.has(el) || etires.has(el)) return;
  const e = effetDe(el.dataset.typo);
  if (!e) return;
  if (e === "etire") etires.set(el, new Etire(el));
  else instances.set(el, new Typo(el));
}

/** L'API d'un élément [data-typo] (armé au besoin). */
export function typo(el: HTMLElement): TypoApi {
  armer(el);
  const t = instances.get(el) ?? etires.get(el);
  if (!t) throw new Error(`[presse:typo] data-typo inconnu : « ${el.dataset.typo ?? ""} » (${EFFETS.join(", ")})`);
  return t;
}

/** Arme les [data-typo] présents et à venir. */
export function initTypo(root: ParentNode = document) {
  if (typeof document === "undefined") return;
  const scan = (r: ParentNode) => {
    if (r instanceof HTMLElement && r.matches("[data-typo]")) armer(r);
    r.querySelectorAll<HTMLElement>("[data-typo]").forEach(armer);
  };
  if (!arme) {
    arme = true;
    io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const t = instances.get(e.target as HTMLElement);
          if (!t) continue;
          if (e.isIntersecting) t.evenement("visible");
          else t.evenement(e.boundingClientRect.top > 0 ? "invisible-bas" : "invisible-haut");
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    let attente = 0;
    ro = new ResizeObserver(() => {
      // Mesures en lot, une image après la rafale de redimensionnements.
      cancelAnimationFrame(attente);
      attente = requestAnimationFrame(() => {
        for (const t of etires.values()) t.invalider();
        for (const t of instances.values()) t.invalider();
      });
    });
    const toutInvalider = () => {
      for (const t of etires.values()) t.invalider();
      for (const t of instances.values()) t.invalider();
    };
    addEventListener("resize", () => {
      for (const t of defilants) t.mesurerDefil();
      reveillerDefil();
    });
    addEventListener("scroll", () => defilants.size && reveillerDefil(), { passive: true });
    void document.fonts?.ready.then(() => {
      fontesPretes = true;
      toutInvalider();
    });
    document.fonts?.addEventListener?.("loadingdone", () => fontesPretes && toutInvalider());
    onDeviceLost(() => {
      perdreGpu();
      gpuPromesse = null;
      setTimeout(() => {
        void demarrerGpu().then(() => {
          for (const t of instances.values()) t.gpuPerdu();
        });
      }, 300);
    });
    new MutationObserver((ms) => {
      for (const mu of ms) {
        if (mu.type === "childList") {
          for (const n of mu.addedNodes) if (n instanceof HTMLElement && !n.classList.contains("typo-calque") && !n.classList.contains("typo-canvas") && !n.classList.contains("typo-etire-in")) scan(n);
        } else if (mu.type === "attributes" && mu.target instanceof HTMLElement && mu.target.dataset.typo !== undefined) armer(mu.target);
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-typo"] });
  }
  scan(root);
}

/** Banc d'essai : WebGPU est-il prêt (ou absent) ? Rend « pret » ou « absent ». */
export async function etatGpuTypo() {
  await gpuDecide(4000);
  return gpuEtat;
}
/** Banc d'essai : diagnostic de compilation du shader. */
export async function compilerTypo(): Promise<string[]> {
  const d = await getDevice();
  const info = await d.createShaderModule({ code: WGSL }).getCompilationInfo();
  return info.messages.map((x) => `${x.type} ${x.lineNum}:${x.linePos} ${x.message}`);
}
