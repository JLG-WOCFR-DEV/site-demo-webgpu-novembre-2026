/**
 * Presse — « cinétique » : typographie cinétique en DOM pur (Web Animations API, sans WebGPU, sans dépendance).
 *
 * D'après les idées décrites dans le kit Taleframe (préréglages de mouvement, cascades, effets de texte), entièrement
 * réécrites pour le web : là-bas le temps est une image de film ; ici l'entrée se joue à l'apparition dans l'écran,
 * s'interrompt proprement (une sortie demandée en pleine entrée repart de l'état courant) et respecte le mouvement réduit.
 *
 *   <h2 data-cinetique="monte">Livrer vendredi.</h2>                         (les mots sortent de sous leur ligne)
 *   <p data-cinetique="net" data-cinetique-par="ligne">…</p>                  (ligne par ligne, le flou se résout)
 *   <p>Pensé pour <span data-roule="les graphistes|les développeurs">les graphistes</span>.</p>
 *   <p>Un <mark data-marque="cercle">mot</mark> entouré à la main.</p>
 *
 * Texte animé, attributs :
 *   data-cinetique           le préréglage, l'un de CINETIQUES (18, ci-dessous) ;
 *   data-cinetique-par       ligne | mot (défaut) | lettre : l'unité qui bouge et qui se décale dans la cascade ;
 *   data-cinetique-quand     entree (défaut : quand le haut de l'élément passe 85 % de la hauteur de l'écran, une fois),
 *                            chargement (après les polices), survol (au survol ou au focus : le texte sort puis rentre),
 *                            manuel (rien d'automatique : `cinetique(el).jouer()`) ;
 *   data-cinetique-rejoue    rejoue à chaque entrée (le texte se voile de nouveau quand il ressort par le bas) ;
 *   data-cinetique-duree     durée d'un morceau, en secondes (défaut selon l'unité et le préréglage, ex. 0,75 s par mot) ;
 *   data-cinetique-courbe    la courbe d'ensemble de l'entrée d'un morceau, à la place de celle du préréglage : un nom
 *                            (`out`, `in-out`, `expo`, `ressort`, `out-recul`…) ou une écriture CSS (`cubic-bezier(.2,0,0,1)`,
 *                            `steps(4)`, `linear(…)`), lue par la bibliothèque de courbes (src/registre/mouvement/courbes.ts,
 *                            la même que `easeOf`) ; illisible : celle du préréglage (avertissement en console). Les
 *                            préréglages à plusieurs étapes (tombe, etire…) gardent leurs courbes par étape : celle-ci
 *                            règle le temps qui les traverse. La sortie garde sa courbe ;
 *   data-cinetique-courbe-sortie  la courbe de la sortie (même écriture), à la place de celle du préréglage ;
 *   data-cinetique-delai     secondes avant le départ ;
 *   data-cinetique-cascade   secondes entre deux morceaux (défaut 0,12 par ligne, 0,06 par mot, 0,03 par lettre) ;
 *   data-cinetique-ordre     debut (défaut) | fin | centre | bords | hasard : l'ordre de la cascade ;
 *   data-cinetique-sortie    secondes après l'arrivée au bout desquelles le texte repart (sinon il reste).
 * Les secondes acceptent la virgule (« 0,5 »).
 *
 * Préréglages : monte (sort de sous sa ligne de base, masqué ; repart vers le haut), doux (petite montée et fondu),
 * net (un flou qui se résout), approche (interlettrage large qui se resserre ; par mot ou par ligne), graisse (du filet à
 * la pleine graisse sur une police variable ; fondu si la police n'a pas d'axe wght), balai (révélé par un bord qui
 * avance), volet (bascule 3D sur la ligne de base, façon tableau d'aéroport), porte (pivote autour de son bord gauche),
 * glisse (arrive de la droite, penché), penche (cisaillement qui se redresse), fonce (arrive de la caméra), parasite
 * (décalage rouge/cyan en pas saccadés, puis se cale), tombe (chute et un rebond), eclot (ressort avec dépassement),
 * houle (cascade en vague), etire (haut et mince puis s'écrase), vrille (tourne en grandissant), essaim (morceaux venus de
 * positions aléatoires à graine fixe). Les six derniers, joueurs, rebondissent ; les autres arrivent vite et se posent
 * longuement, sans rebond.
 *
 * Composants, même module, mêmes déclencheurs (data-cinetique-quand, -delai, -duree, -rejoue, -sortie) :
 *   data-roule="un|deux|trois"   une fente où un mot roule vers le suivant, la largeur suit (data-roule-tempo, 2,2 s) ;
 *   data-marque="surligneur|souligne|barre|cadre|cercle"   l'emphase se dessine à l'entrée (sur un <mark> ou un <span>) ;
 *                                couleur : --marque-couleur ; couleur du texte une fois marqué : --marque-texte ;
 *   data-defile                  rangées de texte répété sans fin, sens alternés : une rangée par enfant, sinon
 *                                data-defile-rangs (3) ; data-defile-vitesse (px/s, 80), data-defile-incline (degrés, 0),
 *                                data-defile-separateur (« — ») ;
 *   data-reflet                  un reflet traverse les lettres une fois (--reflet-couleur) ;
 *   data-cercle                  le texte posé sur un cercle qui tourne (data-cercle-rayon px, data-cercle-vitesse °/s, 18) ;
 *   data-coupe                   coupé en son milieu : les deux moitiés glissent en sens contraires et se verrouillent ;
 *   data-brouille                les caractères défilent puis se résolvent de gauche à droite (largeur stable) ;
 *   data-frappe                  frappé au clavier, rythme naturel reproductible, avec curseur (data-frappe-vitesse,
 *                                caractères par seconde, 16).
 *
 * JS : `initCinetique(root?)` arme ce qui est là et ce qui arrive ; `cinetique(el)` → { jouer(), sortir(), aller(p),
 * detruire() } (`aller(p)` fige l'entrée à la progression p ∈ [0, 1] : utile au banc d'essai). Événements
 * `cinetique:debut` et `cinetique:fin` (detail.sens : "entree" | "sortie") sur l'élément.
 *
 * Le texte reste du vrai texte. Pendant l'animation seulement, l'élément est découpé : ses nœuds d'origine (liens,
 * écouteurs compris) sont rangés tels quels dans un <span> lu par les lecteurs d'écran et invisible, et une copie
 * aria-hidden découpée en morceaux est montrée (balises en ligne recopiées, espaces et césures respectées, graphèmes
 * par Intl.Segmenter, chaque morceau à la largeur mesurée dans le texte d'origine : crénage compris, pas de saut). À la
 * fin, les nœuds d'origine reviennent : le rendu est exactement celui du texte non animé. Les morceaux bougent par
 * transform, opacity, filter et clip-path (graisse : font-variation-settings dans une boîte de largeur fixe).
 * Mouvement réduit : un fondu court, sans découpe ; les composants en boucle restent immobiles.
 */
import { reducedMotion } from "./timeline.ts";
import { courbeCss } from "../registre/mouvement/courbes.ts";

/* ───────────────────────── Fonctions pures (testées sous Node) ───────────────────────── */

export const CINETIQUES = [
  "monte",
  "doux",
  "net",
  "approche",
  "graisse",
  "balai",
  "volet",
  "porte",
  "glisse",
  "penche",
  "fonce",
  "parasite",
  "tombe",
  "eclot",
  "houle",
  "etire",
  "vrille",
  "essaim",
] as const;
export type Cinetique = (typeof CINETIQUES)[number];
export const COMPOSANTS = ["roule", "marque", "defile", "reflet", "cercle", "coupe", "brouille", "frappe"] as const;
export type Composant = (typeof COMPOSANTS)[number];
export const PARS = ["ligne", "mot", "lettre"] as const;
export type Par = (typeof PARS)[number];
export const QUANDS = ["entree", "chargement", "survol", "manuel"] as const;
export type Quand = (typeof QUANDS)[number];
export const ORDRES = ["debut", "fin", "centre", "bords", "hasard"] as const;
export type Ordre = (typeof ORDRES)[number];
export const MARQUES = ["surligneur", "souligne", "barre", "cadre", "cercle"] as const;
export type Marque = (typeof MARQUES)[number];

const parmi = <T extends string>(liste: readonly T[], v: string | null | undefined, defaut: T): T => ((liste as readonly string[]).includes((v ?? "").trim()) ? ((v ?? "").trim() as T) : defaut);
export const cinetiqueDe = (v: string | null | undefined): Cinetique | null => ((CINETIQUES as readonly string[]).includes((v ?? "").trim()) ? ((v ?? "").trim() as Cinetique) : null);
export const parDe = (v: string | null | undefined): Par => parmi(PARS, v, "mot");
export const quandDe = (v: string | null | undefined): Quand => parmi(QUANDS, v, "entree");
export const ordreDe = (v: string | null | undefined): Ordre => parmi(ORDRES, v, "debut");
export const marqueDe = (v: string | null | undefined): Marque => parmi(MARQUES, v, "souligne");

/** Un nombre de secondes lu dans un attribut (« 0,5 » comme « 0.5 ») ; hors de [min, max] ou illisible : le défaut. */
export function secondes(v: string | null | undefined, defaut: number, min = 0, max = 600): number {
  if (v === null || v === undefined) return defaut;
  const s = v.trim().replace(",", ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return defaut;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) && n >= min && n <= max ? n : defaut;
}
/** Un attribut booléen : présent (vide ou autre) = vrai, sauf « false », « 0 », « non ». */
export const drapeau = (v: string | null | undefined) => v !== null && v !== undefined && !/^(false|0|non)$/i.test(v.trim());

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const arrondi = (x: number, n = 3) => {
  const k = 10 ** n;
  const r = Math.round(x * k) / k;
  return Object.is(r, -0) ? 0 : r;
};

/** Durées et cascades par défaut (s), dans l'esprit du tableau « timing » du kit : mot 0,6–0,9 s, 0,04–0,08 s de cascade. */
export const TEMPS: Record<Par, { duree: number; cascade: number }> = {
  ligne: { duree: 0.9, cascade: 0.12 },
  mot: { duree: 0.75, cascade: 0.06 },
  lettre: { duree: 0.7, cascade: 0.03 },
};
/** Sortie : 0,35–0,5 s, 0,02–0,04 s de cascade. */
export const TEMPS_SORTIE: Record<Par, { duree: number; cascade: number }> = {
  ligne: { duree: 0.5, cascade: 0.06 },
  mot: { duree: 0.42, cascade: 0.03 },
  lettre: { duree: 0.38, cascade: 0.02 },
};

export type Reglages = {
  preset: Cinetique | null;
  par: Par;
  quand: Quand;
  rejoue: boolean;
  duree: number;
  delai: number;
  cascade: number;
  ordre: Ordre;
  sortie: number | null;
  dureeSortie: number;
  cascadeSortie: number;
  /** `data-cinetique-courbe`, en chaîne CSS ; `null` : la courbe du préréglage. */
  courbe: string | null;
  /** `data-cinetique-courbe-sortie`, en chaîne CSS ; `null` : la courbe de sortie du préréglage. */
  courbeSortie: string | null;
};
/** Les réglages d'un élément, d'après son dataset (ou tout objet de même forme). */
export function lireReglages(d: Record<string, string | undefined>): Reglages {
  const preset = cinetiqueDe(d.cinetique);
  const par = parDe(d.cinetiquePar);
  const facteur = preset ? PRESETS[preset].facteur ?? 1 : 1;
  const t = TEMPS[par];
  const ts = TEMPS_SORTIE[par];
  const sortie = d.cinetiqueSortie === undefined ? null : secondes(d.cinetiqueSortie, Number.NaN, 0, 600);
  return {
    preset,
    par,
    quand: quandDe(d.cinetiqueQuand),
    rejoue: drapeau(d.cinetiqueRejoue),
    duree: secondes(d.cinetiqueDuree, arrondi(t.duree * facteur, 3), 0.05, 30),
    delai: secondes(d.cinetiqueDelai, 0, 0, 120),
    cascade: secondes(d.cinetiqueCascade, t.cascade, 0, 10),
    ordre: ordreDe(d.cinetiqueOrdre),
    sortie: sortie !== null && Number.isFinite(sortie) ? sortie : null,
    dureeSortie: ts.duree,
    cascadeSortie: ts.cascade,
    courbe: courbeCss(d.cinetiqueCourbe),
    courbeSortie: courbeCss(d.cinetiqueCourbeSortie),
  };
}

/** Une graine entière à partir d'un texte et d'un numéro (FNV-1a). */
export function graineDe(s: string, n = 0) {
  let h = 2166136261 ^ n;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= Math.imul(n, 374761393);
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

/** Le rang de chaque morceau dans la cascade, selon l'ordre (rangs denses, à partir de 0). */
export function rangs(n: number, ordre: Ordre, graine = 0): number[] {
  const c = (n - 1) / 2;
  switch (ordre) {
    case "debut":
      return Array.from({ length: n }, (_, i) => i);
    case "fin":
      return Array.from({ length: n }, (_, i) => n - 1 - i);
    case "centre":
    case "bords": {
      const d = Array.from({ length: n }, (_, i) => Math.abs(i - c));
      const max = Math.max(0, ...d);
      const min = Math.min(...d, max);
      return d.map((x) => Math.round(ordre === "centre" ? x - min : max - x));
    }
    case "hasard": {
      const a = aleaDe(graine);
      const p = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(a() * (i + 1));
        [p[i], p[j]] = [p[j]!, p[i]!];
      }
      const r = new Array<number>(n);
      p.forEach((v, k) => (r[v] = k));
      return r;
    }
  }
}
/** Le calendrier d'une cascade : le départ de chaque morceau (s) et la durée totale (sans le délai). */
export function calendrier(n: number, cascade: number, duree: number, ordre: Ordre = "debut", graine = 0): { debuts: number[]; total: number } {
  const r = rangs(Math.max(0, n), ordre, graine);
  const debuts = r.map((k) => arrondi(k * cascade, 6));
  const total = arrondi((debuts.length ? Math.max(...debuts) : 0) + duree, 6);
  return { debuts, total };
}

/* ── Découpe du texte ── */

/** Les espaces où l'on peut couper la ligne (pas les insécables : « Bonjour ! » reste un seul mot). */
const ESPACE = /[ \t\n\r\f]+/;
const ESPACES = /([ \t\n\r\f]+)/;
/** Après ces caractères on peut couper (tiret, tiret insécable exclu) ; ceux-ci sont des coupures invisibles. */
const TIRETS = new Set(["-", "‐", "–", "—"]);
const COUPURES = new Set(["­", "​"]);

let segmenteur: { segment(s: string): Iterable<{ segment: string }> } | null | undefined;
/** Les graphèmes d'une chaîne (Intl.Segmenter ; repli : points de code). « é » décomposé, drapeaux, familles : un seul. */
export function graphemes(s: string): string[] {
  if (segmenteur === undefined) {
    const I = (globalThis as { Intl?: { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } } }).Intl;
    segmenteur = I?.Segmenter ? new I.Segmenter("fr", { granularity: "grapheme" }) : null;
  }
  if (!segmenteur) return Array.from(s);
  return Array.from(segmenteur.segment(s), (x) => x.segment);
}

export type Jeton =
  | { type: "espace"; t: string; debut: number; fin: number }
  | { type: "coupure"; t: string; debut: number; fin: number }
  | { type: "mot"; t: string; debut: number; fin: number; apresTiret: boolean; lettres: string[] };
/**
 * Découpe un nœud texte : espaces sécables (gardées telles quelles), coupures invisibles (trait d'union conditionnel,
 * espace sans chasse : gardées seules entre deux morceaux) et mots (coupés après un tiret, où le navigateur peut aller à
 * la ligne). `debut`/`fin` : décalages UTF-16 dans le texte (pour mesurer par Range).
 */
export function decouperTexte(s: string): Jeton[] {
  const out: Jeton[] = [];
  let pos = 0;
  for (const bout of s.split(ESPACES)) {
    if (!bout) continue;
    if (ESPACE.test(bout) && bout.trim() === "" && !/[^ \t\n\r\f]/.test(bout)) {
      out.push({ type: "espace", t: bout, debut: pos, fin: pos + bout.length });
      pos += bout.length;
      continue;
    }
    // Un mot : coupé après les tirets et autour des coupures invisibles.
    let cur = "";
    let cDebut = pos;
    let apres = false;
    const pousser = (fin: number) => {
      if (cur) out.push({ type: "mot", t: cur, debut: cDebut, fin, apresTiret: apres, lettres: graphemes(cur) });
      cur = "";
      cDebut = fin;
    };
    let i = 0;
    for (const ch of Array.from(bout)) {
      const at = pos + i;
      if (COUPURES.has(ch)) {
        pousser(at);
        out.push({ type: "coupure", t: ch, debut: at, fin: at + ch.length });
        cDebut = at + ch.length;
        apres = false;
      } else {
        cur += ch;
        if (TIRETS.has(ch)) {
          pousser(at + ch.length);
          apres = true;
        }
      }
      i += ch.length;
    }
    pousser(pos + bout.length);
    pos += bout.length;
  }
  return out;
}

/** Regroupe des boîtes (dans l'ordre du texte) en lignes : le numéro de ligne de chacune. */
export function grouperLignes(boites: readonly { left: number; top: number; width: number; height: number }[]): number[] {
  const out: number[] = [];
  let ligne = -1;
  let bas = -Infinity;
  let haut = -Infinity;
  let gauchePrec = Infinity;
  for (const b of boites) {
    const h = Math.max(1, b.height);
    const nouvelle = ligne < 0 || b.top >= bas - 0.3 * h || (b.left < gauchePrec - 0.5 && b.top > haut + 0.3 * h);
    if (nouvelle) {
      ligne++;
      haut = b.top;
      bas = b.top + h;
    } else {
      haut = Math.min(haut, b.top);
      bas = Math.max(bas, b.top + h);
    }
    gauchePrec = b.left;
    out.push(ligne);
  }
  return out;
}

/* ── Courbes ── */

/** Une courbe de Bézier cubique CSS (x1, y1, x2, y2) en fonction : progression → valeur. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x;
      const d = dX(t);
      if (Math.abs(e) < 1e-7) break;
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    if (t < 0 || t > 1 || Math.abs(X(t) - x) > 1e-5) {
      let a = 0;
      let b = 1;
      t = x;
      for (let i = 0; i < 40; i++) {
        if (X(t) < x) a = t;
        else b = t;
        t = (a + b) / 2;
      }
    }
    return ((ay * t + by) * t + cy) * t;
  };
}
/** Un ressort amorti (amortissement ζ, 0 < ζ < 1), réglé pour être posé à t = 1. */
export function ressort(t: number, amorti = 0.45) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const z = clamp(amorti, 0.05, 0.95);
  const w = Math.log(400) / z;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}
/** Le ressort en fonction d'accélération CSS `linear(…)`, échantillonnée. */
export function ressortLineaire(amorti = 0.45, n = 40): string {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) pts.push(String(i === n ? 1 : arrondi(ressort(i / n, amorti), 4)));
  return `linear(${pts.join(", ")})`;
}

/* ── Préréglages ── */

/** Débord du masque autour d'un morceau (em) : accents au-dessus, jambages en dessous, italiques sur les côtés. */
export const MASQUE = { haut: 0.42, bas: 0.32, cote: 0.3 } as const;
const H = MASQUE.haut;
const B = MASQUE.bas;
const C = MASQUE.cote;
const VOILE = arrondi(H + B, 3);
export const CLIP_REPOS = `inset(-${H}em -${C}em -${B}em -${C}em)`;
/** La fente de data-roule : plus serrée en haut (le mot qui sort ne déborde pas sur la ligne du dessus). */
const FENTE = { haut: 0.24, bas: 0.3 } as const;
const OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const NET = "cubic-bezier(0.2, 0.9, 0.25, 1)";
const VIF = "cubic-bezier(0.1, 0.9, 0.2, 1)";
const PART = "cubic-bezier(0.6, 0, 0.85, 0.4)";
const INOUT = "cubic-bezier(0.65, 0, 0.35, 1)";

/** Ce qu'un préréglage sait d'un morceau. Longueurs en px sauf mention. */
export type Ctx = {
  /** Rang du morceau, nombre de morceaux ; groupe (l'unité de la cascade), nombre de groupes. */
  i: number;
  n: number;
  g: number;
  ng: number;
  /** Aléa à graine fixe, propre au groupe (les morceaux d'une même ligne partagent leur tirage). */
  a: () => number;
  /** Centre du morceau − centre de son groupe ; bord gauche du morceau − bord gauche du groupe. */
  dx: number;
  gauche: number;
  largeur: number;
  /** Largeur du groupe ; position du morceau dans l'élément (−1 à gauche, 1 à droite). */
  lg: number;
  ex: number;
  /** Corps (px), graisse finale, réglages de variation (wght remplacé), la police a-t-elle un axe wght ? */
  em: number;
  poids: number;
  fvs: (w: number) => string;
  axe: boolean;
  /** Une courbe de ressort CSS (linear(), ou un repli cubic-bezier). */
  ressort: (amorti: number) => string;
};
export type Mouvement = { kf: Keyframe[]; easing: string };
export type Preset = {
  /** Le morceau est masqué par sa ligne (débord MASQUE). */
  masque?: boolean;
  /** Le préréglage découpe toujours en lettres (l'unité de la cascade reste par/mot/ligne). */
  lettres?: boolean;
  /** Joueur : rebonds et dépassements permis. */
  joueur?: boolean;
  /** 3D : face arrière cachée. */
  relief?: boolean;
  /** Durée par défaut × facteur. */
  facteur?: number;
  /** Point d'origine des transformations, en fractions de la boîte de l'unité (morceau, ou ligne entière). */
  origine: [number, number];
  entree(c: Ctx): Mouvement;
  sortie(c: Ctx): Mouvement;
  repos(c: Ctx): Keyframe;
};

const ombres = (r: number, c: number, a: number) => `drop-shadow(${arrondi(r)}em 0px 0px rgba(255, 40, 90, ${a})) drop-shadow(${arrondi(-c)}em 0px 0px rgba(0, 225, 255, ${a}))`;
const pas = "steps(1, end)";
const balaiCourbe = bezier(0.5, 0, 0.12, 1);
const balaiSortie = bezier(0.6, 0, 0.4, 1);

export const PRESETS: Record<Cinetique, Preset> = {
  monte: {
    masque: true,
    origine: [0.5, 1],
    entree: () => ({ kf: [{ transform: `translateY(calc(100% + ${VOILE}em))` }, { transform: "translateY(0px)" }], easing: OUT }),
    sortie: () => ({ kf: [{ transform: `translateY(calc(-100% - ${VOILE}em))` }], easing: PART }),
    repos: () => ({ transform: "translateY(0px)" }),
  },
  doux: {
    origine: [0.5, 1],
    entree: () => ({ kf: [{ opacity: 0, transform: "translateY(0.3em)" }, { opacity: 1, transform: "translateY(0em)" }], easing: OUT }),
    sortie: () => ({ kf: [{ opacity: 0, transform: "translateY(-0.2em)" }], easing: PART }),
    repos: () => ({ opacity: 1, transform: "translateY(0em)" }),
  },
  net: {
    origine: [0.5, 0.5],
    entree: () => ({
      kf: [{ opacity: 0, filter: "blur(0.16em)", transform: "scale(1.07)" }, { offset: 0.55, opacity: 1 }, { opacity: 1, filter: "blur(0em)", transform: "none" }],
      easing: OUT,
    }),
    sortie: () => ({ kf: [{ opacity: 0, filter: "blur(0.12em)", transform: "scale(0.97)" }], easing: PART }),
    repos: () => ({ opacity: 1, filter: "blur(0em)", transform: "none" }),
  },
  approche: {
    lettres: true,
    facteur: 1.5,
    origine: [0.5, 0.5],
    entree: (c) => ({
      kf: [
        { opacity: 0, filter: "blur(0.05em)", transform: `translateX(${arrondi(c.dx * 0.5, 2)}px)` },
        { offset: 0.5, opacity: 1 },
        { opacity: 1, filter: "blur(0em)", transform: "translateX(0px)" },
      ],
      easing: "cubic-bezier(0.12, 0.8, 0.2, 1)",
    }),
    sortie: (c) => ({ kf: [{ opacity: 0, filter: "blur(0.05em)", transform: `translateX(${arrondi(c.dx * 0.35, 2)}px)` }], easing: PART }),
    repos: () => ({ opacity: 1, filter: "blur(0em)", transform: "translateX(0px)" }),
  },
  graisse: {
    facteur: 1.3,
    origine: [0.5, 0.5],
    entree: (c) =>
      c.axe
        ? { kf: [{ fontVariationSettings: c.fvs(100), opacity: 0 }, { offset: 0.2, opacity: 1 }, { fontVariationSettings: c.fvs(c.poids), opacity: 1 }], easing: OUT }
        : { kf: [{ opacity: 0 }, { opacity: 1 }], easing: "cubic-bezier(0.3, 0, 0.3, 1)" },
    sortie: (c) => (c.axe ? { kf: [{ fontVariationSettings: c.fvs(100), opacity: 0 }], easing: PART } : { kf: [{ opacity: 0 }], easing: PART }),
    repos: (c) => (c.axe ? { fontVariationSettings: c.fvs(c.poids), opacity: 1 } : { opacity: 1 }),
  },
  balai: {
    facteur: 1.1,
    origine: [0, 0.5],
    entree: (c) => {
      const cp = C * c.em;
      const kf: Keyframe[] = [];
      const K = 12;
      for (let k = 0; k <= K; k++) {
        const t = k / K;
        const e = balaiCourbe(t) * (c.lg + 2 * cp) - cp;
        const r = clamp(c.gauche + c.largeur - e, -cp, c.largeur + cp);
        kf.push({ offset: t, clipPath: `inset(-${H}em ${arrondi(r, 2)}px -${B}em ${arrondi(-cp, 2)}px)` });
      }
      return { kf, easing: "linear" };
    },
    sortie: (c) => {
      const cp = C * c.em;
      const kf: Keyframe[] = [];
      const K = 10;
      for (let k = 1; k <= K; k++) {
        const t = k / K;
        const e = balaiSortie(t) * (c.lg + 2 * cp) - cp;
        const l = clamp(e - c.gauche, -cp, c.largeur + cp);
        kf.push({ offset: t, clipPath: `inset(-${H}em ${arrondi(-cp, 2)}px -${B}em ${arrondi(l, 2)}px)` });
      }
      return { kf, easing: "linear" };
    },
    repos: (c) => ({ clipPath: `inset(-${H}em ${arrondi(-C * c.em, 2)}px -${B}em ${arrondi(-C * c.em, 2)}px)` }),
  },
  volet: {
    relief: true,
    origine: [0.5, 1],
    entree: (c) => {
      const P = arrondi(Math.max(4 * c.em, c.lg * 1.2), 1);
      return {
        kf: [{ transform: `perspective(${P}px) rotateX(-96deg)`, opacity: 0 }, { offset: 0.3, opacity: 1 }, { transform: `perspective(${P}px) rotateX(0deg)`, opacity: 1 }],
        easing: NET,
      };
    },
    sortie: (c) => {
      const P = arrondi(Math.max(4 * c.em, c.lg * 1.2), 1);
      return { kf: [{ offset: 0.6, opacity: 1 }, { transform: `perspective(${P}px) rotateX(90deg)`, opacity: 0 }], easing: PART };
    },
    repos: (c) => ({ transform: `perspective(${arrondi(Math.max(4 * c.em, c.lg * 1.2), 1)}px) rotateX(0deg)`, opacity: 1 }),
  },
  porte: {
    relief: true,
    facteur: 1.2,
    origine: [0, 0.5],
    entree: (c) => {
      const P = arrondi(Math.max(5 * c.em, c.lg * 1.6), 1);
      return {
        kf: [{ transform: `perspective(${P}px) rotateY(82deg)`, opacity: 0 }, { offset: 0.35, opacity: 1 }, { transform: `perspective(${P}px) rotateY(0deg)`, opacity: 1 }],
        easing: OUT,
      };
    },
    sortie: (c) => {
      const P = arrondi(Math.max(5 * c.em, c.lg * 1.6), 1);
      return { kf: [{ transform: `perspective(${P}px) rotateY(-70deg)`, opacity: 0 }], easing: PART };
    },
    repos: (c) => ({ transform: `perspective(${arrondi(Math.max(5 * c.em, c.lg * 1.6), 1)}px) rotateY(0deg)`, opacity: 1 }),
  },
  glisse: {
    origine: [0.5, 1],
    entree: () => ({
      kf: [{ transform: "translateX(0.9em) skewX(-14deg)", opacity: 0 }, { offset: 0.4, opacity: 1 }, { transform: "none", opacity: 1 }],
      easing: OUT,
    }),
    sortie: () => ({ kf: [{ transform: "translateX(-0.7em) skewX(12deg)", opacity: 0 }], easing: PART }),
    repos: () => ({ transform: "none", opacity: 1 }),
  },
  penche: {
    origine: [0.5, 1],
    entree: () => ({
      kf: [{ transform: "translateX(0.3em) skewX(-38deg)", opacity: 0 }, { offset: 0.25, opacity: 1 }, { transform: "none", opacity: 1 }],
      easing: VIF,
    }),
    sortie: () => ({ kf: [{ transform: "translateX(-0.25em) skewX(30deg)", opacity: 0 }], easing: PART }),
    repos: () => ({ transform: "none", opacity: 1 }),
  },
  fonce: {
    facteur: 0.9,
    origine: [0.5, 0.5],
    entree: () => ({
      kf: [{ transform: "scale(2)", filter: "blur(0.12em)", opacity: 0 }, { offset: 0.35, opacity: 1 }, { transform: "none", filter: "blur(0em)", opacity: 1 }],
      easing: "cubic-bezier(0.1, 0.8, 0.2, 1)",
    }),
    sortie: () => ({ kf: [{ transform: "scale(1.9)", filter: "blur(0.1em)", opacity: 0 }], easing: "cubic-bezier(0.7, 0, 0.9, 0.4)" }),
    repos: () => ({ transform: "none", filter: "blur(0em)", opacity: 1 }),
  },
  parasite: {
    facteur: 0.85,
    origine: [0.5, 0.5],
    entree: (c) => {
      const kf: Keyframe[] = [];
      const opacites = [0, 1, 0.55, 1, 0.8, 1, 1];
      for (let k = 0; k < opacites.length; k++) {
        const fort = 1 - k / opacites.length;
        const j = arrondi((c.a() * 2 - 1) * 0.09 * fort, 3);
        const rx = arrondi((0.03 + c.a() * 0.07) * fort, 3);
        const cx = arrondi((0.03 + c.a() * 0.07) * fort, 3);
        const bande = c.a() < 0.45;
        const t0 = Math.round(c.a() * 55);
        const t1 = Math.round(c.a() * Math.max(0, 85 - t0 - 15));
        kf.push({
          offset: arrondi((k / opacites.length) * 0.8, 3),
          easing: pas,
          opacity: opacites[k]!,
          transform: `translateX(${j}em)`,
          filter: ombres(rx, cx, 0.85),
          clipPath: bande && k > 0 ? `inset(${t0}% -${C}em ${t1}% -${C}em)` : CLIP_REPOS,
        });
      }
      kf.push({ offset: 0.8, opacity: 1, transform: "translateX(0em)", filter: ombres(0, 0, 0), clipPath: CLIP_REPOS });
      kf.push({ offset: 1, opacity: 1, transform: "translateX(0em)", filter: ombres(0, 0, 0), clipPath: CLIP_REPOS });
      return { kf, easing: "linear" };
    },
    sortie: (c) => {
      const kf: Keyframe[] = [];
      for (let k = 1; k <= 4; k++) {
        const j = arrondi((c.a() * 2 - 1) * 0.08, 3);
        kf.push({ offset: arrondi(k * 0.2, 3), easing: pas, opacity: k % 2 ? 0.6 : 1, transform: `translateX(${j}em)`, filter: ombres(0.06, 0.05, 0.85), clipPath: CLIP_REPOS });
      }
      kf.push({ offset: 1, opacity: 0, transform: "translateX(0em)", filter: ombres(0, 0, 0), clipPath: CLIP_REPOS });
      return { kf, easing: "linear" };
    },
    repos: () => ({ opacity: 1, transform: "translateX(0em)", filter: ombres(0, 0, 0), clipPath: CLIP_REPOS }),
  },
  tombe: {
    joueur: true,
    facteur: 1.35,
    origine: [0.5, 1],
    entree: () => ({
      kf: [
        { offset: 0, transform: "translateY(-1.1em) rotate(0deg) scale(1, 1)", opacity: 0, easing: "cubic-bezier(0.5, 0, 0.9, 0.5)" },
        { offset: 0.18, opacity: 1 },
        { offset: 0.5, transform: "translateY(0em) rotate(0deg) scale(1.08, 0.9)", easing: "cubic-bezier(0.2, 0.6, 0.4, 1)" },
        { offset: 0.7, transform: "translateY(-0.24em) rotate(0deg) scale(0.98, 1.03)", easing: "cubic-bezier(0.6, 0, 0.8, 0.5)" },
        { offset: 0.86, transform: "translateY(0em) rotate(0deg) scale(1.03, 0.97)", easing: "cubic-bezier(0.2, 0.6, 0.4, 1)" },
        { offset: 1, transform: "none", opacity: 1 },
      ],
      easing: "linear",
    }),
    sortie: (c) => ({ kf: [{ transform: `translateY(1.8em) rotate(${c.a() < 0.5 ? -16 : 16}deg) scale(1, 1)`, opacity: 0 }], easing: "cubic-bezier(0.55, 0, 1, 0.45)" }),
    repos: () => ({ transform: "none", opacity: 1 }),
  },
  eclot: {
    joueur: true,
    facteur: 1.15,
    origine: [0.5, 0.5],
    entree: (c) => ({ kf: [{ transform: "scale(0)", opacity: 0 }, { offset: 0.12, opacity: 1 }, { transform: "none", opacity: 1 }], easing: c.ressort(0.42) }),
    sortie: () => ({ kf: [{ transform: "scale(0.5)", opacity: 0 }], easing: PART }),
    repos: () => ({ transform: "none", opacity: 1 }),
  },
  houle: {
    joueur: true,
    facteur: 1.2,
    origine: [0.5, 1],
    entree: (c) => ({ kf: [{ transform: "translateY(0.75em)", opacity: 0 }, { offset: 0.2, opacity: 1 }, { transform: "translateY(0em)", opacity: 1 }], easing: c.ressort(0.5) }),
    sortie: () => ({ kf: [{ transform: "translateY(-0.5em)", opacity: 0 }], easing: PART }),
    repos: () => ({ transform: "translateY(0em)", opacity: 1 }),
  },
  etire: {
    joueur: true,
    facteur: 1.3,
    origine: [0.5, 1],
    entree: () => ({
      kf: [
        { offset: 0, transform: "translateY(-0.3em) scale(0.35, 1.9)", opacity: 0, easing: "cubic-bezier(0.3, 0, 0.6, 1)" },
        { offset: 0.35, transform: "translateY(0em) scale(0.8, 1.32)", opacity: 1, easing: "cubic-bezier(0.3, 0.6, 0.5, 1)" },
        { offset: 0.55, transform: "translateY(0em) scale(1.18, 0.82)", easing: "cubic-bezier(0.4, 0, 0.5, 1)" },
        { offset: 0.74, transform: "translateY(0em) scale(0.95, 1.06)", easing: INOUT },
        { offset: 0.88, transform: "translateY(0em) scale(1.02, 0.98)", easing: INOUT },
        { offset: 1, transform: "none", opacity: 1 },
      ],
      easing: "linear",
    }),
    sortie: () => ({ kf: [{ transform: "translateY(-0.9em) scale(0.4, 2)", opacity: 0 }], easing: PART }),
    repos: () => ({ transform: "none", opacity: 1 }),
  },
  vrille: {
    joueur: true,
    facteur: 1.25,
    origine: [0.5, 0.5],
    entree: () => ({
      kf: [{ transform: "rotate(-210deg) scale(0.1)", opacity: 0 }, { offset: 0.3, opacity: 1 }, { transform: "none", opacity: 1 }],
      easing: "cubic-bezier(0.2, 0.9, 0.3, 1.1)",
    }),
    sortie: () => ({ kf: [{ transform: "rotate(180deg) scale(0.1)", opacity: 0 }], easing: PART }),
    repos: () => ({ transform: "none", opacity: 1 }),
  },
  essaim: {
    joueur: true,
    facteur: 1.35,
    origine: [0.5, 0.5],
    entree: (c) => {
      const x = arrondi((c.a() * 2 - 1) * 3.2, 3);
      const y = arrondi((c.a() * 2 - 1) * 2.2, 3);
      const r = arrondi((c.a() * 2 - 1) * 55, 1);
      const s = arrondi(0.5 + c.a() * 0.8, 3);
      return {
        kf: [{ transform: `translate(${x}em, ${y}em) rotate(${r}deg) scale(${s})`, opacity: 0 }, { offset: 0.3, opacity: 1 }, { transform: "none", opacity: 1 }],
        easing: OUT,
      };
    },
    sortie: (c) => {
      const sens = c.ex < 0 ? -1 : c.ex > 0 ? 1 : c.a() < 0.5 ? -1 : 1;
      const x = arrondi(sens * (1.2 + c.a() * 2.2), 3);
      const y = arrondi((c.a() * 2 - 1) * 2, 3);
      const r = arrondi((c.a() * 2 - 1) * 70, 1);
      return { kf: [{ transform: `translate(${x}em, ${y}em) rotate(${r}deg) scale(0.6)`, opacity: 0 }], easing: "cubic-bezier(0.3, 0, 0.8, 0.6)" };
    },
    repos: () => ({ transform: "none", opacity: 1 }),
  },
};

/* ── Composants : fonctions pures ── */

const PONCTUATION = /[.,;:!?…»)\]]/;
/**
 * Le rythme d'une frappe au clavier : l'instant (s) où paraît chaque caractère. Reproductible (graine) : irrégulier
 * autour de 1/cps, plus long après une espace et après la ponctuation, avec de rares hésitations.
 */
export function rythmeFrappe(lettres: readonly string[], graine: number, cps = 16): number[] {
  const a = aleaDe(graine);
  const base = 1 / Math.max(1, cps);
  const out: number[] = [];
  let t = 0;
  for (let i = 0; i < lettres.length; i++) {
    out.push(arrondi(t, 4));
    const ch = lettres[i]!;
    let d = base * (0.55 + a() * 0.9);
    if (ch.trim() === "") d += base * (0.3 + a() * 0.6);
    if (PONCTUATION.test(ch)) d += 0.16 + a() * 0.18;
    if (a() < 0.05) d += 0.18 + a() * 0.2;
    t += d;
  }
  return out;
}

const RESERVE = { maj: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", min: "abcdefghijklmnopqrstuvwxyz", chiffres: "0123456789" };
/** Le moment (fraction de la durée) où le caractère i de n se résout, et celui où il paraît. */
export const resolutionBrouille = (i: number, n: number) => 0.3 + 0.7 * (n > 1 ? i / (n - 1) : 1);
export const apparitionBrouille = (i: number, n: number) => 0.22 * (n > 1 ? i / (n - 1) : 0);
/**
 * Le texte brouillé à la progression p (0 → 1) et au pas d'horloge `pas` (un entier : le tirage change avec lui).
 * Les blancs et la ponctuation restent ; un chiffre se brouille en chiffres, une capitale en capitales. À p ≥ 1 : le texte.
 */
export function brouillage(lettres: readonly string[], p: number, graine: number, pasHorloge: number): { t: string; vu: boolean }[] {
  const n = lettres.length;
  return lettres.map((ch, i) => {
    const vu = p > 0 && p >= apparitionBrouille(i, n);
    if (p >= 1 || p >= resolutionBrouille(i, n)) return { t: ch, vu };
    let reserve = "";
    if (/^\p{Nd}$/u.test(ch)) reserve = RESERVE.chiffres;
    else if (/^\p{Lu}/u.test(ch)) reserve = RESERVE.maj;
    else if (/^\p{Ll}/u.test(ch)) reserve = RESERVE.min;
    if (!reserve) return { t: ch, vu };
    const a = aleaDe(graineDe(ch, graine + i * 7919 + pasHorloge * 104729));
    return { t: reserve[Math.floor(a() * reserve.length)] ?? ch, vu };
  });
}

const f1 = (x: number) => arrondi(x, 1);
/** Un trait tracé à la main de (x0, y0) à (x1, y1) : une courbe douce, légèrement irrégulière (graine fixe). */
export function traitMain(x0: number, y0: number, x1: number, y1: number, graine: number, flottement = 2): string {
  const a = aleaDe(graine);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const j1 = (a() * 2 - 1) * flottement;
  const j2 = (a() * 2 - 1) * flottement;
  const c1 = [x0 + dx * 0.3 + nx * j1, y0 + dy * 0.3 + ny * j1];
  const c2 = [x0 + dx * 0.7 + nx * j2, y0 + dy * 0.7 + ny * j2];
  return `M ${f1(x0)} ${f1(y0)} C ${f1(c1[0]!)} ${f1(c1[1]!)} ${f1(c2[0]!)} ${f1(c2[1]!)} ${f1(x1)} ${f1(y1)}`;
}
/** Une boucle de stylo autour d'un centre : un peu plus d'un tour au rayon inégal, puis un second passage plus court. */
export function boucleMain(cx: number, cy: number, rx: number, ry: number, graine: number): string {
  const a = aleaDe(graine);
  const p1 = a() * Math.PI * 2;
  const p2 = a() * Math.PI * 2;
  const depart = -Math.PI * (0.62 + a() * 0.12);
  const tours = 1.1 + a() * 0.08 + 0.42;
  const N = Math.ceil(tours * 72);
  const pts: [number, number][] = [];
  for (let k = 0; k <= N; k++) {
    const u = k / N;
    const th = depart + u * tours * Math.PI * 2;
    // Le second passage s'écarte un peu du premier (rayon qui dérive avec le tour).
    const derive = 1 + 0.07 * Math.max(0, u * tours - 0.9);
    const rho = (1 + 0.05 * Math.sin(2 * th + p1) + 0.035 * Math.sin(3 * th + p2)) * derive;
    pts.push([cx + Math.cos(th) * rx * rho, cy + Math.sin(th) * ry * rho]);
  }
  let d = `M ${f1(pts[0]![0])} ${f1(pts[0]![1])}`;
  for (let k = 1; k < pts.length - 1; k++) {
    const p = pts[k]!;
    const q = pts[k + 1]!;
    d += ` Q ${f1(p[0])} ${f1(p[1])} ${f1((p[0] + q[0]) / 2)} ${f1((p[1] + q[1]) / 2)}`;
  }
  const z = pts[pts.length - 1]!;
  return `${d} L ${f1(z[0])} ${f1(z[1])}`;
}
/** Un cadre tracé à la main : quatre coins à peine déplacés, un départ en haut à gauche et un léger dépassement. */
export function cadreMain(x: number, y: number, w: number, h: number, graine: number, jeu = 2): string {
  const a = aleaDe(graine);
  const j = () => (a() * 2 - 1) * jeu;
  const coins: [number, number][] = [
    [x + j(), y + j()],
    [x + w + j(), y + j()],
    [x + w + j(), y + h + j()],
    [x + j(), y + h + j()],
  ];
  const fin: [number, number] = [coins[0]![0] + Math.min(w * 0.18, 3 * jeu + 8), coins[0]![1] + j() * 0.5];
  let d = `M ${f1(coins[0]![0])} ${f1(coins[0]![1])}`;
  const suite = [coins[1]!, coins[2]!, coins[3]!, coins[0]!, fin];
  let prec = coins[0]!;
  for (const c of suite) {
    const mx = (prec[0] + c[0]) / 2 + j() * 0.6;
    const my = (prec[1] + c[1]) / 2 + j() * 0.6;
    d += ` Q ${f1(mx)} ${f1(my)} ${f1(c[0])} ${f1(c[1])}`;
    prec = c;
  }
  return d;
}
/** Un coup de surligneur : une bande aux bords inégaux, extrémités un peu biaises. */
export function surligneurMain(x: number, y: number, w: number, h: number, graine: number): string {
  const a = aleaDe(graine);
  const j = (k: number) => (a() * 2 - 1) * k;
  const e = Math.min(h * 0.12, 3);
  const pts: [number, number][] = [
    [x + j(e), y + j(e)],
    [x + w * 0.5, y + j(e)],
    [x + w + j(e), y + j(e) + e * 0.5],
    [x + w + j(e) + e, y + h + j(e)],
    [x + w * 0.5, y + h + j(e)],
    [x + j(e) - e * 0.6, y + h + j(e)],
  ];
  return `M ${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join(" L ")} Z`;
}

/* ───────────────────────── DOM ───────────────────────── */

const NS_SVG = "http://www.w3.org/2000/svg";
const ms = (s: number) => Math.max(0, s * 1000);
const enDom = () => typeof document !== "undefined";

const FEUILLE = `
.cin-lu{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;border:0!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;user-select:none;pointer-events:none}
.cin-m,.cin-p{display:inline-block;white-space:nowrap;text-indent:0}
.cin-masque{clip-path:${CLIP_REPOS}}
.cin-w{white-space:nowrap}
.cin-relief{backface-visibility:hidden}
.cin-centre>.cin-m>.cin-p,.cin-centre .cin-m>.cin-p{width:100%;text-align:center}
.cin-brouille .cin-p{font-variant-numeric:tabular-nums}
.cin-curseur{position:absolute;left:0;top:0;width:0.08em;background:currentColor;pointer-events:none;border-radius:0.02em}
.cin-fente{display:inline-block;position:relative;white-space:nowrap;vertical-align:baseline;clip-path:inset(-${FENTE.haut}em -0.12em -${FENTE.bas}em -0.12em);text-indent:0}
.cin-roule-mot{display:inline-block;white-space:nowrap}
.cin-roule-entrant{position:absolute;left:0;top:0}
.cin-roule-mesure{position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;pointer-events:none}
:where([data-marque]){background:transparent;color:inherit}
.cin-marque{position:relative;isolation:isolate}
.cin-marque-svg{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}
.cin-marque-surligneur>.cin-marque-svg{z-index:-1}
.cin-defile{overflow:clip;position:relative;contain:inline-size}
.cin-defile-scene{display:block;pointer-events:none}
.cin-rang{display:block;white-space:nowrap;overflow:visible}
.cin-piste{display:inline-block;white-space:nowrap}
.cin-motif{display:inline-block;white-space:pre}
.cin-motif>*{display:inline}
.cin-reflet-calque{position:absolute;pointer-events:none;color:transparent!important;-webkit-text-fill-color:transparent!important;background-repeat:no-repeat;background-size:300% 100%;-webkit-background-clip:text;background-clip:text;user-select:none}
.cin-reflet-calque *{color:transparent!important;-webkit-text-fill-color:transparent!important;background:none!important;text-decoration-color:transparent!important;border-color:transparent!important;box-shadow:none!important}
.cin-cercle-boite{display:inline-block;vertical-align:middle}
.cin-cercle-svg{display:block;overflow:visible}
.cin-coupe-env{display:block;position:relative}
.cin-coupe-moitie{display:block}
.cin-coupe-bas{position:absolute;left:0;top:0;width:100%}
`;
function poserCss() {
  if (!enDom() || document.getElementById("presse-cinetique-css")) return;
  const s = document.createElement("style");
  s.id = "presse-cinetique-css";
  s.textContent = FEUILLE;
  document.head.append(s);
}

/** linear() est-il compris ? (sinon un repli cubic-bezier à dépassement). */
let lineaireOk: boolean | null = null;
function courbeRessort(amorti: number) {
  lineaireOk ??= typeof globalThis.CSS?.supports === "function" && globalThis.CSS.supports("animation-timing-function", "linear(0, 0.5, 1)");
  return lineaireOk ? ressortLineaire(amorti) : "cubic-bezier(0.34, 1.56, 0.64, 1)";
}

/** Les polices : prêtes, ou au plus tard après 2,5 s. */
let promessePolices: Promise<void> | null = null;
function polices(): Promise<void> {
  if (!enDom() || !document.fonts) return Promise.resolve();
  if (document.fonts.status === "loaded") return Promise.resolve();
  promessePolices ??= Promise.race([document.fonts.ready.then(() => undefined), new Promise<void>((r) => setTimeout(r, 2500))]);
  return promessePolices;
}

const span = (classe: string, texte?: string | Node) => {
  const s = document.createElement("span");
  s.className = classe;
  if (texte !== undefined) s.append(texte);
  return s;
};
/** Après restauration : pas d'attribut class="" ou style="" laissé vide par le module. */
function attributsVides(el: Element) {
  if (el.getAttribute("class") === "") el.removeAttribute("class");
  if (el.getAttribute("style") === "") el.removeAttribute("style");
}
const estCalque = (n: Node) => n instanceof Element && (n.hasAttribute("data-cin-calque") || n.classList.contains("cin-lu"));
const REMPLACES = new Set(["IMG", "PICTURE", "VIDEO", "AUDIO", "CANVAS", "IFRAME", "OBJECT", "EMBED", "INPUT", "SELECT", "TEXTAREA", "BUTTON", "METER", "PROGRESS"]);
/** Une copie montrée : sans id, hors de l'ordre de tabulation, marquée comme copie (le module ne l'arme pas). */
function copier(e: Element, profond: boolean): Element {
  const c = e.cloneNode(profond) as Element;
  const nettoyer = (x: Element) => {
    x.removeAttribute("id");
    if (x instanceof HTMLElement && (x.tabIndex >= 0 || x.hasAttribute("tabindex"))) x.tabIndex = -1;
    if (x instanceof HTMLAnchorElement) x.tabIndex = -1;
  };
  nettoyer(c);
  if (profond) c.querySelectorAll("*").forEach(nettoyer);
  c.setAttribute("data-cin-copie", "");
  return c;
}

/** La graisse : la police calculée a-t-elle un axe wght ? (mesuré : la largeur change-t-elle de 100 à 900 ?) */
const axes = new Map<string, boolean>();
function aUnAxeGraisse(el: Element): boolean {
  const cs = getComputedStyle(el);
  const cle = `${cs.fontFamily}|${cs.fontStyle}|${cs.fontStretch}`;
  const connu = axes.get(cle);
  if (connu !== undefined) return connu;
  const s = document.createElement("span");
  s.textContent = "Hamburgefonstiv 0123";
  s.setAttribute("aria-hidden", "true");
  s.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-variation-settings:'wght' 100";
  el.append(s);
  const w1 = s.getBoundingClientRect().width;
  s.style.fontVariationSettings = "'wght' 900";
  const w2 = s.getBoundingClientRect().width;
  s.remove();
  const oui = Math.abs(w1 - w2) > 0.5;
  // Une réponse négative peut venir d'une police pas encore chargée : on ne la garde qu'une fois les polices prêtes.
  if (oui || document.fonts?.status === "loaded") axes.set(cle, oui);
  return oui;
}
function fvsAvec(base: string) {
  const autres = base === "normal" || !base ? [] : base.split(",").map((x) => x.trim()).filter((x) => !/^["']wght["']/.test(x));
  return (w: number) => [`"wght" ${Math.round(w)}`, ...autres].join(", ");
}

/* ── La découpe ── */

type ModeDecoupe = "mot" | "lettre" | "glyphe";
type Atome = { m: HTMLSpanElement; p: HTMLSpanElement; mot: number; ligne: number; g: number; texte: string; boite: DOMRect | null; cache?: boolean; orig?: Mesure };
type Mesure = { w: number; x: number; y: number };

/**
 * Découpe un élément : ses nœuds d'origine vont, tels quels, dans un <span class="cin-lu"> (lu, invisible) ; une copie
 * aria-hidden découpée prend leur place. « mot » et « lettre » : chaque morceau est un inline-block (masque `m`, pièce
 * animée `p`) à la largeur mesurée dans le texte d'origine ; « glyphe » : de simples <span> en ligne (frappe).
 */
class Decoupe {
  readonly lu: HTMLSpanElement;
  readonly atomes: Atome[] = [];
  readonly lignes: { left: number; top: number; right: number; bottom: number }[] = [];
  private restaure = false;
  readonly el: HTMLElement;
  constructor(el: HTMLElement, mode: ModeDecoupe, masque: boolean, classeEl = "") {
    this.el = el;
    const largeurs = mode === "glyphe" ? [] : mesurerLargeurs(el, mode);
    const frag = document.createDocumentFragment();
    let k = 0;
    let mot = -1;
    let prec: "rien" | "atome" | "espace" = "rien";
    const atome = (contenu: string | Node, texte: string): HTMLSpanElement => {
      if (mode === "glyphe") {
        const g = span("cin-g", contenu);
        this.atomes.push({ m: g, p: g, mot, ligne: 0, g: 0, texte, boite: null });
        return g;
      }
      const m = span(masque ? "cin-m cin-masque" : "cin-m");
      m.setAttribute("aria-hidden", "true");
      const p = span("cin-p", contenu);
      m.append(p);
      const o = largeurs[k++];
      if (o && o.w > 0) m.style.width = `${o.w}px`;
      this.atomes.push({ m, p, mot, ligne: 0, g: 0, texte, boite: null, orig: o });
      return m;
    };
    const joindre = (parent: Node) => {
      // Deux morceaux collés (un mot coupé par une balise) : un gluon empêche le retour à la ligne entre eux.
      if (prec === "atome" && mode !== "glyphe") parent.appendChild(document.createTextNode("⁠"));
    };
    const construire = (n: Node, parent: Node) => {
      if (n.nodeType === Node.TEXT_NODE) {
        for (const j of decouperTexte((n as Text).data)) {
          if (j.type !== "mot") {
            parent.appendChild(document.createTextNode(j.t));
            prec = "espace";
            continue;
          }
          if (!(j.apresTiret && prec === "atome")) joindre(parent);
          if (prec !== "atome") mot++;
          if (mode === "mot") parent.appendChild(atome(j.t, j.t));
          else {
            const w = mode === "lettre" ? span("cin-w") : null;
            for (const l of j.lettres) (w ?? parent).appendChild(atome(l, l));
            if (w) parent.appendChild(w);
          }
          prec = "atome";
        }
        return;
      }
      if (!(n instanceof Element) || estCalque(n)) return;
      if (n.tagName === "BR" || n.tagName === "WBR") {
        parent.appendChild(copier(n, false));
        prec = "espace";
        return;
      }
      if (REMPLACES.has(n.tagName) || n.namespaceURI !== "http://www.w3.org/1999/xhtml") {
        joindre(parent);
        if (prec !== "atome") mot++;
        const c = copier(n, true);
        if (mode === "glyphe") parent.appendChild(c);
        else parent.appendChild(atome(c, ""));
        prec = "atome";
        return;
      }
      const c = copier(n, false);
      for (const enfant of Array.from(n.childNodes)) construire(enfant, c);
      parent.appendChild(c);
    };
    for (const n of Array.from(el.childNodes)) construire(n, frag);
    for (const n of Array.from(frag.childNodes)) if (n instanceof Element) n.setAttribute("aria-hidden", "true");
    this.lu = span("cin-lu");
    this.lu.setAttribute("data-cin-calque", "");
    this.lu.append(...Array.from(el.childNodes));
    if (classeEl) el.classList.add(...classeEl.split(" ").filter(Boolean));
    this.classes = classeEl.split(" ").filter(Boolean);
    el.prepend(this.lu);
    el.append(frag);
    if (mode !== "glyphe") this.decorer();
  }
  /**
   * Les décorations (soulignement d'un lien…) ne passent pas aux inline-blocks : on recopie sur chaque morceau celle
   * de son plus proche ancêtre décoré (le trait suit alors le mot qui bouge).
   */
  private decorer() {
    const cache = new Map<Element, CSSStyleDeclaration | null>();
    for (const a of this.atomes) {
      let e: Element | null = a.m.parentElement;
      let deco: CSSStyleDeclaration | null = null;
      while (e && e !== this.el) {
        let cs = cache.get(e);
        if (cs === undefined) {
          const c = getComputedStyle(e);
          cs = c.textDecorationLine && c.textDecorationLine !== "none" ? c : null;
          cache.set(e, cs);
        }
        if (cs) {
          deco = cs;
          break;
        }
        e = e.parentElement;
      }
      if (!deco) continue;
      a.p.style.textDecorationLine = deco.textDecorationLine;
      a.p.style.textDecorationStyle = deco.textDecorationStyle;
      a.p.style.textDecorationColor = deco.textDecorationColor;
      a.p.style.textDecorationThickness = deco.textDecorationThickness;
    }
  }
  private classes: string[];
  /** Mesure les morceaux (une seule lecture en lot) et les range en lignes. */
  mesurer() {
    for (const a of this.atomes) a.boite = a.m.getBoundingClientRect();
    // Recaler chaque morceau sur sa position dans le texte d'origine : le crénage autour des espaces (une espace isolée
    // n'est plus crénée avec ses voisines) décalerait sinon les mots suivants. L'écart part dans la largeur du précédent.
    let corrige = false;
    for (let k = 1; k < this.atomes.length; k++) {
      const a = this.atomes[k - 1]!;
      const b = this.atomes[k]!;
      if (!a.orig || !b.orig || !a.boite || !b.boite || !a.m.style.width) continue;
      if (Math.abs(a.orig.y - b.orig.y) > 1 || Math.abs(a.boite.top - b.boite.top) > 1) continue;
      // Écart arrondi au 1/64 px (l'unité de mise en page) et appliqué à la largeur réelle de la boîte : exact.
      const err = Math.round((b.orig.x - a.orig.x - (b.boite.left - a.boite.left)) * 64) / 64;
      if (err === 0 || Math.abs(err) > a.boite.height) continue;
      a.m.style.width = `${a.boite.width + err}px`;
      corrige = true;
    }
    if (corrige) for (const a of this.atomes) a.boite = a.m.getBoundingClientRect();
    const num = grouperLignes(this.atomes.map((a) => a.boite!));
    this.lignes.length = 0;
    this.atomes.forEach((a, i) => {
      a.ligne = num[i] ?? 0;
      const b = a.boite!;
      const L = (this.lignes[a.ligne] ??= { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
      L.left = Math.min(L.left, b.left);
      L.top = Math.min(L.top, b.top);
      L.right = Math.max(L.right, b.right);
      L.bottom = Math.max(L.bottom, b.bottom);
    });
  }
  /** Rend le DOM d'origine. */
  restaurer() {
    if (this.restaure) return;
    this.restaure = true;
    this.el.replaceChildren(...Array.from(this.lu.childNodes));
    if (this.classes.length) this.el.classList.remove(...this.classes);
    attributsVides(this.el);
  }
}
/** Largeur et position des morceaux dans le texte d'origine (Range), dans l'ordre de la découpe. */
function mesurerLargeurs(el: HTMLElement, mode: "mot" | "lettre"): (Mesure | undefined)[] {
  const out: (Mesure | undefined)[] = [];
  const r = document.createRange();
  const une = (n: Text, a: number, b: number) => {
    r.setStart(n, a);
    r.setEnd(n, b);
    const rs = r.getClientRects();
    out.push(rs.length === 1 ? { w: rs[0]!.width, x: rs[0]!.left, y: rs[0]!.top } : undefined);
  };
  const parcourir = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n as Text;
      for (const j of decouperTexte(t.data)) {
        if (j.type !== "mot") continue;
        if (mode === "mot") une(t, j.debut, j.fin);
        else {
          let o = j.debut;
          for (const l of j.lettres) {
            une(t, o, o + l.length);
            o += l.length;
          }
        }
      }
      return;
    }
    if (!(n instanceof Element) || estCalque(n) || n.tagName === "BR" || n.tagName === "WBR") return;
    if (REMPLACES.has(n.tagName) || n.namespaceURI !== "http://www.w3.org/1999/xhtml") {
      out.push(undefined);
      return;
    }
    n.childNodes.forEach(parcourir);
  };
  el.childNodes.forEach(parcourir);
  r.detach?.();
  return out;
}

/* ── Le pilote commun : déclencheurs, événements ── */

export type CinetiqueApi = { jouer(): void; sortir(): void; aller(p: number): void; detruire(): void };

const instances = new Map<HTMLElement, Piece>();
let io85: IntersectionObserver | null = null;
let io0: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;
let mo: MutationObserver | null = null;
let arme = false;

abstract class Piece implements CinetiqueApi {
  readonly quand: Quand;
  readonly rejoue: boolean;
  readonly delai: number;
  readonly sortieAuto: number | null;
  protected vu = false;
  protected enVueNow = false;
  private minuteurSortie = 0;
  protected detruit = false;
  readonly el: HTMLElement;
  constructor(el: HTMLElement) {
    this.el = el;
    const d = el.dataset;
    this.quand = quandDe(d.cinetiqueQuand);
    this.rejoue = drapeau(d.cinetiqueRejoue);
    this.delai = secondes(d.cinetiqueDelai, 0, 0, 120);
    const s = d.cinetiqueSortie === undefined ? Number.NaN : secondes(d.cinetiqueSortie, Number.NaN, 0, 600);
    this.sortieAuto = Number.isFinite(s) ? s : null;
    poserCss();
    instances.set(el, this);
  }
  /** Branche les déclencheurs (à la fin du constructeur de chaque composant). */
  protected brancher() {
    io0?.observe(this.el);
    ro?.observe(this.el);
    if (this.quand === "entree") io85?.observe(this.el);
    else if (this.quand === "chargement") void quandCharge().then(() => !this.detruit && this.jouer());
    else if (this.quand === "survol") {
      this.el.addEventListener("pointerenter", this.surSurvol);
      this.el.addEventListener("focusin", this.surSurvol);
    }
  }
  private surSurvol = (e: Event) => {
    if ((e as PointerEvent).pointerType === "touch") return;
    this.survol();
  };
  protected survol() {
    this.jouer();
  }
  /** Entrée dans les 85 % hauts de l'écran. */
  visible() {
    if (this.quand !== "entree" || this.vu) return;
    this.vu = true;
    void polices().then(() => !this.detruit && this.jouer());
  }
  /** Visibilité dans l'écran (pour les boucles) et sortie par le bas (pour rejouer). */
  vue(v: boolean, sortiBas: boolean) {
    this.enVueNow = v;
    this.enVue(v);
    if (!v && sortiBas && this.rejoue && this.vu && this.quand === "entree") {
      this.vu = false;
      this.annulerSortie();
      this.cacher();
    }
  }
  protected enVue(_v: boolean) {}
  protected signal(type: "debut" | "fin", sens: "entree" | "sortie") {
    this.el.dispatchEvent(new CustomEvent(`cinetique:${type}`, { detail: { sens } }));
  }
  /** L'entrée est posée : événement, et sortie automatique si demandée. */
  protected arrive() {
    this.signal("fin", "entree");
    this.annulerSortie();
    if (this.sortieAuto !== null) this.minuteurSortie = window.setTimeout(() => this.sortir(), ms(this.sortieAuto));
  }
  protected annulerSortie() {
    clearTimeout(this.minuteurSortie);
  }
  /** Le texte est-il voilé en attendant son entrée ? */
  protected get attend() {
    return this.quand === "entree" || this.quand === "chargement";
  }
  abstract jouer(): void;
  abstract sortir(): void;
  abstract aller(p: number): void;
  /** Remet l'état d'attente (avant l'entrée). */
  abstract cacher(): void;
  /** Mesures à refaire (redimensionnement, polices). */
  invalider(_force: boolean) {}
  detruire() {
    this.detruit = true;
    this.annulerSortie();
    io85?.unobserve(this.el);
    io0?.unobserve(this.el);
    ro?.unobserve(this.el);
    this.el.removeEventListener("pointerenter", this.surSurvol);
    this.el.removeEventListener("focusin", this.surSurvol);
    instances.delete(this.el);
  }
}

function quandCharge(): Promise<void> {
  const charge = document.readyState === "complete" ? Promise.resolve() : new Promise<void>((r) => addEventListener("load", () => r(), { once: true }));
  return Promise.all([charge, polices()]).then(() => undefined);
}

/** Toutes les animations terminées (rejetée si l'une est annulée : on l'ignore alors). */
const fini = (as: Animation[]) => Promise.all(as.map((a) => a.finished)).then(() => true, () => false);

/* ── Texte animé (data-cinetique) ── */

type EtatTexte = "repos" | "cache" | "entre" | "suspendu" | "sort" | "sorti";

class Texte extends Piece {
  readonly r: Reglages;
  readonly preset: Preset;
  private d: Decoupe | null = null;
  private anims: Animation[] = [];
  private ctxs: Omit<Ctx, "a">[] = [];
  private ng = 0;
  private total = 0;
  private etat: EtatTexte = "repos";
  private gen = 0;
  private largeurVue = 0;
  private fondu: Animation | null = null;
  private apresSortie: (() => void) | null = null;
  private readonly graine: number;
  constructor(el: HTMLElement) {
    super(el);
    this.r = lireReglages(el.dataset as Record<string, string | undefined>);
    if (el.dataset.cinetiqueCourbe !== undefined && !this.r.courbe) console.warn(`[presse:cinetique] data-cinetique-courbe="${el.dataset.cinetiqueCourbe}" illisible : courbe du préréglage`, el);
    this.preset = PRESETS[this.r.preset!];
    this.graine = graineDe(el.textContent ?? "", CINETIQUES.indexOf(this.r.preset!));
    if (this.attend) this.cacher();
    this.brancher();
  }
  private get mode(): "mot" | "lettre" {
    return this.r.par === "lettre" || this.preset.lettres ? "lettre" : "mot";
  }
  /** Découpe (de zéro), mesure, groupe, et prépare ce que chaque préréglage doit savoir. */
  private fendre() {
    this.annuler();
    this.d?.restaurer();
    const classes = ["cin-anime", this.r.preset === "graisse" ? "cin-centre" : ""].join(" ");
    const d = new Decoupe(this.el, this.mode, !!this.preset.masque, classes);
    this.d = d;
    d.mesurer();
    this.largeurVue = this.el.clientWidth;
    const par = this.r.par;
    // Les groupes : l'unité de la cascade.
    const cle = (a: Atome, i: number) => (par === "ligne" ? a.ligne : par === "mot" || this.preset.lettres ? a.mot * 4096 + a.ligne : i);
    const numeros = new Map<number, number>();
    d.atomes.forEach((a, i) => {
      const k = cle(a, i);
      if (!numeros.has(k)) numeros.set(k, numeros.size);
      a.g = numeros.get(k)!;
    });
    this.ng = numeros.size;
    const boitesG: { left: number; top: number; right: number; bottom: number }[] = [];
    for (const a of d.atomes) {
      const b = a.boite!;
      const G = (boitesG[a.g] ??= { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
      G.left = Math.min(G.left, b.left);
      G.top = Math.min(G.top, b.top);
      G.right = Math.max(G.right, b.right);
      G.bottom = Math.max(G.bottom, b.bottom);
    }
    const er = this.el.getBoundingClientRect();
    const cxEl = er.left + er.width / 2;
    // Corps, graisse et police par parent (les <strong>, <em> ont les leurs).
    const parParent = new Map<Element, { em: number; poids: number; fvs: (w: number) => string; axe: boolean }>();
    const infos = (e: Element) => {
      let x = parParent.get(e);
      if (!x) {
        const cs = getComputedStyle(e);
        x = { em: Number.parseFloat(cs.fontSize) || 16, poids: Number.parseFloat(cs.fontWeight) || 400, fvs: fvsAvec(cs.fontVariationSettings), axe: this.r.preset === "graisse" ? aUnAxeGraisse(e) : false };
        parParent.set(e, x);
      }
      return x;
    };
    const [fx, fy] = this.preset.origine;
    this.ctxs = d.atomes.map((a, i) => {
      const b = a.boite!;
      const G = boitesG[a.g]!;
      const inf = infos(a.m.parentElement ?? this.el);
      // L'origine des transformations : celle de l'unité (en ligne : un point de la ligne, commun à ses mots).
      if (par === "ligne" || this.preset.lettres) a.p.style.transformOrigin = `${arrondi(G.left + fx * (G.right - G.left) - b.left, 2)}px ${arrondi(G.top + fy * (G.bottom - G.top) - b.top, 2)}px`;
      else a.p.style.transformOrigin = `${fx * 100}% ${fy * 100}%`;
      if (this.preset.relief) a.p.classList.add("cin-relief");
      return {
        i,
        n: d.atomes.length,
        g: a.g,
        ng: this.ng,
        dx: b.left + b.width / 2 - (G.left + G.right) / 2,
        gauche: b.left - G.left,
        largeur: b.width,
        lg: G.right - G.left,
        ex: er.width > 0 ? clamp((b.left + b.width / 2 - cxEl) / (er.width / 2), -1, 1) : 0,
        em: inf.em,
        poids: inf.poids,
        fvs: inf.fvs,
        axe: inf.axe,
        ressort: courbeRessort,
      };
    });
  }
  private ctx(i: number): Ctx {
    const c = this.ctxs[i]!;
    return { ...c, a: aleaDe(graineDe(String(this.graine), c.g + 1)) };
  }
  private annuler() {
    this.gen++;
    for (const a of this.anims) a.cancel();
    this.anims = [];
  }
  private restaurer() {
    this.annuler();
    this.d?.restaurer();
    this.d = null;
    this.etat = "repos";
  }
  /** Construit l'entrée (fill both), posée au temps t (ms, délai compris), en pause ou jouée. */
  private construireEntree(t: number, jouer: boolean) {
    this.annuler();
    const d = this.d!;
    const cal = calendrier(this.ng, this.r.cascade, this.r.duree, this.r.ordre, this.graine);
    this.total = cal.total;
    d.atomes.forEach((a, i) => {
      a.cache = false;
      const { kf, easing } = this.preset.entree(this.ctx(i));
      const debut = cal.debuts[a.g] ?? 0;
      const an = a.p.animate(kf, {
        duration: ms(this.r.duree),
        delay: ms(this.r.delai + debut),
        endDelay: ms(cal.total - debut - this.r.duree),
        fill: "both",
        easing: this.r.courbe ?? easing,
      });
      an.pause();
      an.currentTime = t;
      this.anims.push(an);
    });
    if (jouer) this.lancerEntree();
  }
  private lancerEntree() {
    this.etat = "entre";
    for (const a of this.anims) a.play();
    this.signal("debut", "entree");
    const g = this.gen;
    void fini(this.anims).then((ok) => {
      if (!ok || g !== this.gen || this.detruit) return;
      this.restaurer();
      this.arrive();
    });
  }
  /** Fige l'état courant en styles en ligne (interruption propre) ; note les morceaux pas encore partis. */
  private figer() {
    const d = this.d;
    if (!d) return;
    this.anims.forEach((an, i) => {
      const a = d.atomes[i];
      if (!a) return;
      const delai = Number(an.effect?.getTiming().delay ?? 0);
      const t = Number(an.currentTime ?? 0);
      a.cache = this.etat !== "sort" && t <= delai + 0.5;
      try {
        an.commitStyles();
      } catch {
        /* élément non rendu : rien à figer */
      }
    });
    this.annuler();
  }
  private construireSortie() {
    const d = this.d!;
    const cal = calendrier(this.ng, this.r.cascadeSortie, this.r.dureeSortie, this.r.ordre, this.graine);
    d.atomes.forEach((a, i) => {
      if (a.cache) return;
      const c = this.ctx(i);
      const { kf, easing } = this.preset.sortie(c);
      const debut = cal.debuts[a.g] ?? 0;
      this.anims.push(
        a.p.animate(kf, { duration: ms(this.r.dureeSortie), delay: ms(debut), endDelay: ms(cal.total - debut - this.r.dureeSortie), fill: "forwards", easing: this.r.courbeSortie ?? easing }),
      );
    });
    this.etat = "sort";
    this.signal("debut", "sortie");
    const g = this.gen;
    void fini(this.anims).then((ok) => {
      if (!ok || g !== this.gen || this.detruit) return;
      this.etat = "sorti";
      this.signal("fin", "sortie");
      const f = this.apresSortie;
      this.apresSortie = null;
      f?.();
    });
  }
  /** Pose les valeurs de repos en ligne (pour qu'une sortie parte d'un état interpolable). */
  private poserRepos() {
    this.d?.atomes.forEach((a, i) => {
      a.cache = false;
      const r = this.preset.repos(this.ctx(i));
      for (const [k, v] of Object.entries(r)) if (k !== "offset" && k !== "easing" && v !== undefined && v !== null) a.p.style.setProperty(k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), String(v));
    });
  }

  /* Mouvement réduit : un fondu court sur l'élément entier, sans découpe. */
  private opaciteAvant: string | null = null;
  private fonduVers(o: 0 | 1, apres?: () => void) {
    this.fondu?.cancel();
    this.opaciteAvant ??= this.el.style.opacity;
    const de = Number.parseFloat(getComputedStyle(this.el).opacity);
    const f = this.el.animate([{ opacity: de }, { opacity: o }], { duration: o ? 260 : 200, easing: "ease-out", fill: "both" });
    this.fondu = f;
    void f.finished.then(
      () => {
        if (this.fondu !== f) return;
        if (o) {
          f.cancel();
          this.el.style.opacity = this.opaciteAvant ?? "";
          this.opaciteAvant = null;
          this.fondu = null;
        }
        apres?.();
      },
      () => {},
    );
  }

  jouer() {
    this.annulerSortie();
    if (reducedMotion()) {
      if (this.d) this.restaurer();
      this.etat = "entre";
      this.signal("debut", "entree");
      this.fonduVers(1, () => {
        this.etat = "repos";
        this.arrive();
      });
      return;
    }
    switch (this.etat) {
      case "entre":
        return;
      case "cache":
      case "suspendu":
        if (!this.d) {
          this.fendre();
          this.construireEntree(0, false);
        }
        this.lancerEntree();
        return;
      case "sort":
        return this.versRepos();
      case "sorti":
      case "repos":
        this.fendre();
        this.construireEntree(0, true);
        return;
    }
  }
  /** D'une sortie interrompue, retour au repos depuis l'état courant. */
  private versRepos() {
    this.figer();
    const d = this.d!;
    d.atomes.forEach((a, i) => {
      const r = this.preset.repos(this.ctx(i));
      this.anims.push(a.p.animate([r], { duration: 450, easing: OUT, fill: "forwards" }));
    });
    this.etat = "entre";
    this.signal("debut", "entree");
    const g = this.gen;
    void fini(this.anims).then((ok) => {
      if (!ok || g !== this.gen || this.detruit) return;
      this.restaurer();
      this.arrive();
    });
  }
  sortir() {
    this.annulerSortie();
    if (reducedMotion()) {
      if (this.d) this.restaurer();
      this.etat = "sort";
      this.signal("debut", "sortie");
      this.fonduVers(0, () => {
        this.etat = "sorti";
        this.signal("fin", "sortie");
        const f = this.apresSortie;
        this.apresSortie = null;
        f?.();
      });
      return;
    }
    switch (this.etat) {
      case "sort":
      case "sorti":
        return;
      case "cache":
        this.etat = "sorti";
        return;
      case "repos":
        this.fendre();
        this.poserRepos();
        this.construireSortie();
        return;
      case "entre":
      case "suspendu":
        this.figer();
        this.construireSortie();
        return;
    }
  }
  protected survol() {
    if (this.etat !== "repos") return;
    if (reducedMotion()) return;
    this.apresSortie = () => this.jouer();
    this.sortir();
  }
  cacher() {
    this.annulerSortie();
    this.apresSortie = null;
    if (reducedMotion()) {
      if (this.d) this.restaurer();
      this.fondu?.cancel();
      this.fondu = null;
      this.opaciteAvant ??= this.el.style.opacity;
      this.el.style.opacity = "0";
      this.etat = "cache";
      return;
    }
    this.fendre();
    this.construireEntree(0, false);
    this.etat = "cache";
  }
  aller(p: number) {
    this.annulerSortie();
    p = clamp01(p);
    if (reducedMotion()) {
      if (this.d) this.restaurer();
      this.fondu?.cancel();
      this.fondu = null;
      this.opaciteAvant ??= this.el.style.opacity;
      this.el.style.opacity = p >= 1 ? this.opaciteAvant ?? "" : String(p);
      if (p >= 1) this.opaciteAvant = null;
      this.etat = p >= 1 ? "repos" : p <= 0 ? "cache" : "suspendu";
      return;
    }
    if (p >= 1) {
      this.restaurer();
      return;
    }
    this.fendre();
    const cal = calendrier(this.ng, this.r.cascade, this.r.duree, this.r.ordre, this.graine);
    this.construireEntree(ms(this.r.delai + p * cal.total), false);
    this.etat = p <= 0 ? "cache" : "suspendu";
  }
  invalider(force: boolean) {
    if (!this.d || this.detruit) return;
    if (!force && Math.abs(this.el.clientWidth - this.largeurVue) < 0.5) return;
    const etat = this.etat;
    const t = Number(this.anims[0]?.currentTime ?? 0);
    if (etat === "cache" || etat === "suspendu" || etat === "entre") {
      this.fendre();
      this.construireEntree(t, false);
      if (etat === "entre") this.lancerEntree();
      else this.etat = etat;
    } else if (etat === "sort" || etat === "sorti") {
      // Refaire la découpe et poser directement la fin de la sortie.
      this.fendre();
      this.poserRepos();
      this.construireSortie();
      for (const a of this.anims) a.finish();
    }
  }
  detruire() {
    this.annuler();
    this.fondu?.cancel();
    if (this.opaciteAvant !== null) this.el.style.opacity = this.opaciteAvant;
    this.d?.restaurer();
    attributsVides(this.el);
    this.d = null;
    super.detruire();
  }
}

/* ── data-roule : un mot roule vers le suivant ── */

const ROULE = "cubic-bezier(0.76, 0, 0.24, 1)";
const VOILE_FENTE = arrondi(FENTE.haut + FENTE.bas, 3);
class Roule extends Piece {
  readonly mots: string[];
  readonly tempo: number;
  readonly duree: number;
  private i = 0;
  private readonly origine: Node[];
  private readonly fente: HTMLSpanElement;
  private courant: HTMLSpanElement;
  private largeurs: number[] = [];
  private actif = false;
  private minuteur = 0;
  private anims: Animation[] = [];
  private entrant: HTMLSpanElement | null = null;
  constructor(el: HTMLElement) {
    super(el);
    const mots = (el.dataset.roule ?? "").split("|").map((s) => s.trim()).filter(Boolean);
    this.mots = mots.length ? mots : [(el.textContent ?? "").trim()];
    this.tempo = secondes(el.dataset.rouleTempo, 2.2, 0.6, 120);
    this.duree = secondes(el.dataset.cinetiqueDuree, 0.55, 0.1, 5);
    this.origine = Array.from(el.childNodes);
    const lu = span("cin-lu", this.mots.join(", "));
    lu.setAttribute("data-cin-calque", "");
    this.fente = span("cin-fente");
    this.fente.setAttribute("aria-hidden", "true");
    this.fente.setAttribute("data-cin-calque", "");
    this.courant = span("cin-roule-mot", this.mots[0]!);
    this.fente.append(this.courant);
    el.replaceChildren(lu, this.fente);
    this.mesurer();
    this.brancher();
  }
  private mesurer() {
    this.largeurs = this.mots.map((m) => {
      const s = span("cin-roule-mesure", m);
      this.fente.append(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return w;
    });
    this.fente.style.width = `${this.largeurs[this.i] ?? 0}px`;
  }
  private planifier() {
    clearTimeout(this.minuteur);
    if (!this.actif || !this.enVueNow || reducedMotion() || this.detruit || this.mots.length < 2) return;
    this.minuteur = window.setTimeout(() => void this.rouler().then(() => this.planifier()), ms(this.tempo));
  }
  /** Prépare le roulement vers le mot suivant (en pause) ; rend les animations. */
  private preparer(): Animation[] {
    this.finirRoulement();
    const j = (this.i + 1) % this.mots.length;
    const e = span("cin-roule-mot cin-roule-entrant", this.mots[j]!);
    this.fente.append(e);
    this.entrant = e;
    const t = { duration: ms(this.duree), easing: ROULE, fill: "both" as const };
    this.anims = [
      this.courant.animate([{ transform: "translateY(0px)" }, { transform: `translateY(calc(-100% - ${VOILE_FENTE}em))` }], t),
      e.animate([{ transform: `translateY(calc(100% + ${VOILE_FENTE}em))` }, { transform: "translateY(0px)" }], t),
      this.fente.animate([{ width: `${this.largeurs[this.i]}px` }, { width: `${this.largeurs[j]}px` }], t),
    ];
    for (const a of this.anims) a.pause();
    return this.anims;
  }
  private finirRoulement() {
    if (!this.entrant) return;
    for (const a of this.anims) a.cancel();
    this.anims = [];
    this.courant.remove();
    this.courant = this.entrant;
    this.courant.classList.remove("cin-roule-entrant");
    this.entrant = null;
    this.i = (this.i + 1) % this.mots.length;
    this.fente.style.width = `${this.largeurs[this.i]}px`;
  }
  private async rouler() {
    const as = this.preparer();
    for (const a of as) a.play();
    if (await fini(as)) this.finirRoulement();
  }
  jouer() {
    this.annulerSortie();
    this.courant.getAnimations().forEach((a) => a.cancel());
    if (!this.actif) {
      this.actif = true;
      this.signal("debut", "entree");
      this.planifier();
      this.arrive();
      return;
    }
    if (reducedMotion() || this.entrant) return;
    clearTimeout(this.minuteur);
    void this.rouler().then(() => this.planifier());
  }
  sortir() {
    this.actif = false;
    clearTimeout(this.minuteur);
    this.finirRoulement();
    this.signal("debut", "sortie");
    if (reducedMotion()) return this.signal("fin", "sortie");
    const a = this.courant.animate([{ transform: `translateY(calc(-100% - ${VOILE_FENTE}em))` }], { duration: ms(0.42), easing: PART, fill: "forwards" });
    void fini([a]).then((ok) => ok && this.signal("fin", "sortie"));
  }
  aller(p: number) {
    clearTimeout(this.minuteur);
    const as = this.preparer();
    for (const a of as) a.currentTime = clamp01(p) * ms(this.duree);
  }
  cacher() {
    this.actif = false;
    clearTimeout(this.minuteur);
    this.finirRoulement();
    this.courant.getAnimations().forEach((a) => a.cancel());
  }
  protected enVue(v: boolean) {
    if (v) this.planifier();
    else clearTimeout(this.minuteur);
  }
  invalider() {
    this.mesurer();
  }
  detruire() {
    clearTimeout(this.minuteur);
    for (const a of this.anims) a.cancel();
    this.el.replaceChildren(...this.origine);
    super.detruire();
  }
}

/* ── data-marque : l'emphase se dessine ── */

const DUREES_MARQUE: Record<Marque, number> = { surligneur: 0.6, souligne: 0.55, barre: 0.45, cadre: 0.8, cercle: 0.95 };
class Marquage extends Piece {
  readonly type: Marque;
  private readonly svg: SVGSVGElement;
  private formes: { el: SVGPathElement; L: number; part: number }[] = [];
  private anims: Animation[] = [];
  private p = 1;
  private readonly graine: number;
  private couleurAvant: string;
  constructor(el: HTMLElement) {
    super(el);
    this.type = marqueDe(el.dataset.marque);
    this.graine = graineDe(el.textContent ?? "", MARQUES.indexOf(this.type) + 11);
    this.couleurAvant = el.style.color;
    el.classList.add("cin-marque", `cin-marque-${this.type}`);
    this.svg = document.createElementNS(NS_SVG, "svg");
    this.svg.setAttribute("aria-hidden", "true");
    this.svg.setAttribute("data-cin-calque", "");
    this.svg.setAttribute("class", "cin-marque-svg");
    el.append(this.svg);
    this.p = this.attend ? 0 : 1;
    this.dessiner();
    this.brancher();
  }
  private get duree() {
    return secondes(this.el.dataset.cinetiqueDuree, DUREES_MARQUE[this.type], 0.05, 20);
  }
  private dessiner() {
    this.svg.replaceChildren();
    this.formes = [];
    const o = this.svg.getBoundingClientRect();
    const em = Number.parseFloat(getComputedStyle(this.el).fontSize) || 16;
    const rects = Array.from(this.el.getClientRects()).filter((r) => r.width > 0.5);
    const couleur = this.type === "surligneur" ? "var(--marque-couleur, #ffe25a)" : this.type === "barre" ? "var(--marque-couleur, currentColor)" : "var(--marque-couleur, #ff4a2b)";
    const total = rects.reduce((s, r) => s + r.width, 0) || 1;
    rects.forEach((r, k) => {
      const x = r.left - o.left;
      const y = r.top - o.top;
      const w = r.width;
      const h = r.height;
      const g = this.graine + k * 31;
      let d = "";
      let plein = false;
      let epais = 0.075 * em;
      switch (this.type) {
        case "surligneur":
          d = surligneurMain(x - 0.08 * em, y + 0.3 * h, w + 0.16 * em, 0.58 * h, g);
          plein = true;
          break;
        case "souligne":
          d = traitMain(x - 0.04 * em, y + 0.9 * h, x + w + 0.1 * em, y + 0.88 * h - 0.04 * em, g, 0.06 * em);
          break;
        case "barre":
          d = traitMain(x - 0.06 * em, y + 0.56 * h, x + w + 0.06 * em, y + 0.53 * h, g, 0.03 * em);
          epais = 0.065 * em;
          break;
        case "cadre":
          d = cadreMain(x - 0.16 * em, y + 0.02 * h, w + 0.32 * em, h * 0.98, g, 0.05 * em);
          epais = 0.06 * em;
          break;
        case "cercle":
          d = boucleMain(x + w / 2, y + h * 0.52, w / 2 + 0.5 * em, h / 2 + 0.2 * em, g);
          epais = 0.065 * em;
          break;
      }
      const p = document.createElementNS(NS_SVG, "path");
      p.setAttribute("d", d);
      if (plein) {
        p.style.fill = couleur;
        p.style.transformBox = "fill-box";
        p.style.transformOrigin = "0 50%";
      } else {
        p.style.fill = "none";
        p.style.stroke = couleur;
        p.style.strokeWidth = `${arrondi(epais, 2)}px`;
        p.style.strokeLinecap = "round";
        p.style.strokeLinejoin = "round";
      }
      this.svg.append(p);
      const L = plein ? 0 : p.getTotalLength();
      if (!plein) p.style.strokeDasharray = `${L} ${L + 1}`;
      this.formes.push({ el: p, L, part: w / total });
    });
    this.poser(this.p);
  }
  /** Pose l'état p (0 rien, 1 tout dessiné), fragment après fragment. */
  private poser(p: number) {
    this.p = p;
    let deb = 0;
    for (const f of this.formes) {
      const q = clamp01((p - deb) / Math.max(1e-6, f.part));
      deb += f.part;
      if (f.L) f.el.style.strokeDashoffset = String(arrondi(f.L * (1 - q), 2));
      else f.el.style.transform = `scaleX(${arrondi(q, 4)})`;
    }
  }
  private animer(vers: 0 | 1, duree: number, delai: number) {
    for (const a of this.anims) a.cancel();
    this.anims = [];
    const easing = this.type === "cercle" || this.type === "cadre" ? "cubic-bezier(0.45, 0, 0.25, 1)" : "cubic-bezier(0.3, 0, 0.2, 1)";
    let deb = delai;
    const formes = vers ? this.formes : [...this.formes].reverse();
    for (const f of formes) {
      const d = duree * f.part;
      const kf: Keyframe[] = f.L
        ? [{ strokeDashoffset: f.el.style.strokeDashoffset || "0" }, { strokeDashoffset: vers ? "0" : String(f.L) }]
        : [{ transform: f.el.style.transform || "scaleX(1)" }, { transform: `scaleX(${vers})` }];
      this.anims.push(f.el.animate(kf, { duration: ms(d), delay: ms(deb), easing: this.formes.length > 1 ? "cubic-bezier(0.4, 0, 0.6, 1)" : easing, fill: "both" }));
      deb += d;
    }
    return this.anims;
  }
  jouer() {
    this.annulerSortie();
    this.signal("debut", "entree");
    const fin = () => {
      for (const a of this.anims) a.cancel();
      this.anims = [];
      this.poser(1);
      const t = getComputedStyle(this.el).getPropertyValue("--marque-texte").trim();
      if (t) this.el.style.color = t;
      this.arrive();
    };
    if (reducedMotion()) return fin();
    if (this.p >= 1) this.poser(0);
    const as = this.animer(1, this.duree, this.delai);
    void fini(as).then((ok) => ok && fin());
  }
  sortir() {
    this.annulerSortie();
    this.signal("debut", "sortie");
    const fin = () => {
      for (const a of this.anims) a.cancel();
      this.anims = [];
      this.poser(0);
      this.el.style.color = this.couleurAvant;
      this.signal("fin", "sortie");
    };
    if (reducedMotion()) return fin();
    void fini(this.animer(0, 0.35, 0)).then((ok) => ok && fin());
  }
  aller(p: number) {
    for (const a of this.anims) a.cancel();
    this.anims = [];
    this.poser(clamp01(p));
  }
  cacher() {
    this.aller(0);
    this.el.style.color = this.couleurAvant;
  }
  invalider() {
    if (this.anims.length) return;
    this.dessiner();
  }
  detruire() {
    for (const a of this.anims) a.cancel();
    this.svg.remove();
    this.el.classList.remove("cin-marque", `cin-marque-${this.type}`);
    this.el.style.color = this.couleurAvant;
    attributsVides(this.el);
    super.detruire();
  }
}

/* ── data-defile : rangées de texte répété sans fin ── */

class Defile extends Piece {
  private readonly origine: Node[];
  private readonly lu: HTMLSpanElement;
  private scene: HTMLDivElement | null = null;
  private anims: Animation[] = [];
  private actif = false;
  private phase = 0;
  private readonly vitesse: number;
  private readonly incline: number;
  private largeurVue = 0;
  constructor(el: HTMLElement) {
    super(el);
    this.vitesse = secondes(el.dataset.defileVitesse, 80, 1, 5000);
    const inc = Number.parseFloat((el.dataset.defileIncline ?? "0").replace(",", "."));
    this.incline = Number.isFinite(inc) ? clamp(inc, -45, 45) : 0;
    this.origine = Array.from(el.childNodes);
    this.lu = span("cin-lu");
    this.lu.setAttribute("data-cin-calque", "");
    this.lu.append(...this.origine);
    el.classList.add("cin-defile");
    el.replaceChildren(this.lu);
    this.construire();
    this.brancher();
  }
  private construire() {
    const el = this.el;
    this.phase = Number(this.anims[0]?.currentTime ?? this.phase);
    for (const a of this.anims) a.cancel();
    this.anims = [];
    this.scene?.remove();
    const sep = el.dataset.defileSeparateur ?? " — ";
    const enfants = this.origine.filter((n): n is Element => n instanceof Element);
    const rangs = Math.round(secondes(el.dataset.defileRangs, 3, 1, 40));
    const sources: (Element | string)[] = enfants.length ? enfants : Array.from({ length: rangs }, () => (el.textContent ?? "").replace(/\s+/g, " ").trim());
    const scene = document.createElement("div");
    scene.className = "cin-defile-scene";
    scene.setAttribute("aria-hidden", "true");
    scene.setAttribute("data-cin-calque", "");
    el.append(scene);
    const W = el.clientWidth || 1;
    const th = (this.incline * Math.PI) / 180;
    // Penchée, la scène doit dépasser pour couvrir les coins.
    const rangsEl = sources.map(() => {
      const r = document.createElement("div");
      r.className = "cin-rang";
      scene.append(r);
      return r;
    });
    const Hs = () => scene.getBoundingClientRect().height;
    sources.forEach((src, k) => {
      const r = rangsEl[k]!;
      const piste = span("cin-piste");
      const motif = span("cin-motif");
      motif.append(typeof src === "string" ? document.createTextNode(src) : copier(src, true), span("cin-sep", sep));
      piste.append(motif);
      r.append(piste);
    });
    const largeurScene = th ? W / Math.cos(th) + Hs() * Math.abs(Math.tan(th)) + 40 : W;
    if (th) {
      scene.style.width = `${largeurScene}px`;
      scene.style.marginLeft = `${-(largeurScene - W) / 2}px`;
      scene.style.transform = `rotate(${this.incline}deg)`;
      const marge = (W / 2) * Math.abs(Math.sin(th));
      scene.style.marginBlock = `${marge}px`;
    }
    rangsEl.forEach((r, k) => {
      const piste = r.firstElementChild as HTMLElement;
      const motif = piste.firstElementChild as HTMLElement;
      const w = motif.getBoundingClientRect().width || 1;
      const copies = Math.ceil((largeurScene * 1.2) / w) + 1;
      for (let c = 1; c < copies; c++) piste.append(motif.cloneNode(true));
      const a = piste.animate([{ transform: "translateX(0px)" }, { transform: `translateX(${-w}px)` }], {
        duration: ms(w / this.vitesse),
        iterations: Infinity,
        easing: "linear",
        direction: k % 2 ? "reverse" : "normal",
      });
      a.pause();
      a.currentTime = this.phase;
      this.anims.push(a);
    });
    this.scene = scene;
    this.largeurVue = W;
    this.appliquer();
  }
  private appliquer() {
    const go = this.actif && this.enVueNow && !reducedMotion();
    for (const a of this.anims) (go ? a.play() : a.pause());
  }
  jouer() {
    this.actif = true;
    this.signal("debut", "entree");
    this.appliquer();
    this.arrive();
  }
  sortir() {
    this.actif = false;
    this.appliquer();
    this.signal("fin", "sortie");
  }
  aller(p: number) {
    this.actif = false;
    for (const a of this.anims) {
      a.pause();
      a.currentTime = clamp01(p) * Number(a.effect?.getTiming().duration ?? 0);
    }
  }
  cacher() {}
  protected enVue() {
    this.appliquer();
  }
  invalider(force: boolean) {
    if (!force && Math.abs(this.el.clientWidth - this.largeurVue) < 0.5) return;
    this.construire();
  }
  detruire() {
    for (const a of this.anims) a.cancel();
    this.el.classList.remove("cin-defile");
    attributsVides(this.el);
    this.el.replaceChildren(...this.origine);
    super.detruire();
  }
}

/* ── Calque recopié par-dessus le texte (reflet) ── */

/** Une copie aria-hidden du contenu, posée exactement sur la boîte de contenu de l'élément. */
function calqueSur(el: HTMLElement, classe: string): HTMLDivElement {
  const cs = getComputedStyle(el);
  const c = document.createElement("div");
  c.className = classe;
  c.setAttribute("aria-hidden", "true");
  c.setAttribute("data-cin-calque", "");
  const bl = Number.parseFloat(cs.borderLeftWidth) || 0;
  const bt = Number.parseFloat(cs.borderTopWidth) || 0;
  const r = el.getBoundingClientRect();
  const pl = Number.parseFloat(cs.paddingLeft) || 0;
  const pr = Number.parseFloat(cs.paddingRight) || 0;
  const pt = Number.parseFloat(cs.paddingTop) || 0;
  const pb = Number.parseFloat(cs.paddingBottom) || 0;
  const br = Number.parseFloat(cs.borderRightWidth) || 0;
  const bb = Number.parseFloat(cs.borderBottomWidth) || 0;
  c.style.left = `${pl}px`;
  c.style.top = `${pt}px`;
  c.style.width = `${r.width - bl - br - pl - pr}px`;
  c.style.height = `${r.height - bt - bb - pt - pb}px`;
  for (const n of Array.from(el.childNodes)) {
    if (estCalque(n)) continue;
    c.append(n instanceof Element ? copier(n, true) : n.cloneNode(true));
  }
  el.append(c);
  return c;
}

class Reflet extends Piece {
  private calque: HTMLDivElement | null = null;
  private anim: Animation | null = null;
  private posPerso = false;
  constructor(el: HTMLElement) {
    super(el);
    this.brancher();
  }
  private get duree() {
    return secondes(this.el.dataset.cinetiqueDuree, 1.4, 0.1, 20);
  }
  private poser() {
    this.enlever();
    if (getComputedStyle(this.el).position === "static") {
      this.el.style.position = "relative";
      this.posPerso = true;
    }
    const c = calqueSur(this.el, "cin-reflet-calque");
    c.style.backgroundImage = "linear-gradient(105deg, transparent 0%, transparent 45.5%, var(--reflet-couleur, rgba(255, 255, 255, 0.92)) 50%, transparent 54.5%, transparent 100%)";
    this.calque = c;
    this.anim = c.animate([{ backgroundPosition: "100% 0" }, { backgroundPosition: "0% 0" }], { duration: ms(this.duree), delay: ms(this.delai), easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "both" });
    this.anim.pause();
    return this.anim;
  }
  private enlever() {
    this.anim?.cancel();
    this.anim = null;
    this.calque?.remove();
    this.calque = null;
    if (this.posPerso) {
      this.el.style.position = "";
      this.posPerso = false;
    }
    attributsVides(this.el);
  }
  jouer() {
    this.annulerSortie();
    this.signal("debut", "entree");
    if (reducedMotion()) return this.arrive();
    const a = this.poser();
    a.play();
    void fini([a]).then((ok) => {
      if (!ok || this.anim !== a) return;
      this.enlever();
      this.arrive();
    });
  }
  sortir() {
    this.enlever();
  }
  aller(p: number) {
    if (p >= 1 || p <= 0) return this.enlever();
    const a = this.poser();
    a.currentTime = ms(this.delai) + clamp01(p) * ms(this.duree);
  }
  cacher() {
    this.enlever();
  }
  detruire() {
    this.enlever();
    super.detruire();
  }
}

/* ── data-cercle : le texte sur un cercle qui tourne ── */

let numCercle = 0;
class Cercle extends Piece {
  private readonly origine: Node[];
  private boite: HTMLSpanElement | null = null;
  private svg: SVGSVGElement | null = null;
  private tour: Animation | null = null;
  private entree: Animation | null = null;
  private actif = false;
  private readonly texte: string;
  private readonly id = `cin-cercle-${++numCercle}`;
  constructor(el: HTMLElement) {
    super(el);
    this.texte = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    this.origine = Array.from(el.childNodes);
    this.construire(true);
    this.brancher();
  }
  private construire(premier = false) {
    const el = this.el;
    const angle = Number(this.tour?.currentTime ?? 0);
    this.tour?.cancel();
    const lu = span("cin-lu");
    lu.setAttribute("data-cin-calque", "");
    // La longueur du texte à plat (dans la police de l'élément), pour un cercle à l'espacement naturel.
    const mesure = span("cin-roule-mesure", this.texte);
    el.append(mesure);
    this.largeurTexte = mesure.getBoundingClientRect().width;
    mesure.remove();
    lu.append(...this.origine);
    const em = Number.parseFloat(getComputedStyle(el).fontSize) || 16;
    const rayon = secondes(el.dataset.cercleRayon, Math.max(this.largeurTexte / (2 * Math.PI), 2 * em), 4, 5000);
    const S = 2 * (rayon + em * 1.1);
    const c = S / 2;
    const svg = document.createElementNS(NS_SVG, "svg");
    svg.setAttribute("class", "cin-cercle-svg");
    svg.setAttribute("width", String(arrondi(S, 2)));
    svg.setAttribute("height", String(arrondi(S, 2)));
    svg.setAttribute("viewBox", `0 0 ${arrondi(S, 2)} ${arrondi(S, 2)}`);
    const path = document.createElementNS(NS_SVG, "path");
    path.setAttribute("id", this.id);
    path.setAttribute("fill", "none");
    path.setAttribute("d", `M ${arrondi(c, 2)} ${arrondi(c - rayon, 2)} a ${arrondi(rayon, 2)} ${arrondi(rayon, 2)} 0 1 1 0 ${arrondi(2 * rayon, 2)} a ${arrondi(rayon, 2)} ${arrondi(rayon, 2)} 0 1 1 0 ${arrondi(-2 * rayon, 2)}`);
    const text = document.createElementNS(NS_SVG, "text");
    text.setAttribute("fill", "currentColor");
    const tp = document.createElementNS(NS_SVG, "textPath");
    tp.setAttribute("href", `#${this.id}`);
    tp.setAttribute("textLength", String(arrondi(2 * Math.PI * rayon - 0.5, 2)));
    tp.setAttribute("lengthAdjust", "spacing");
    tp.textContent = this.texte;
    text.append(tp);
    svg.append(path, text);
    const boite = span("cin-cercle-boite");
    boite.setAttribute("aria-hidden", "true");
    boite.setAttribute("data-cin-calque", "");
    boite.append(svg);
    el.replaceChildren(lu, boite);
    this.boite = boite;
    this.svg = svg;
    const v = Number.parseFloat((el.dataset.cercleVitesse ?? "18").replace(",", "."));
    const vit = Number.isFinite(v) && v !== 0 ? v : 18;
    svg.style.transformOrigin = "50% 50%";
    this.tour = svg.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: ms(360 / Math.abs(vit)), iterations: Infinity, easing: "linear", direction: vit < 0 ? "reverse" : "normal" });
    this.tour.pause();
    this.tour.currentTime = angle;
    if (premier && this.attend && !reducedMotion()) boite.style.opacity = "0";
    this.appliquer();
  }
  private largeurTexte = 0;
  private appliquer() {
    const go = this.actif && this.enVueNow && !reducedMotion();
    if (go) this.tour?.play();
    else this.tour?.pause();
  }
  jouer() {
    this.annulerSortie();
    this.actif = true;
    this.signal("debut", "entree");
    this.appliquer();
    const b = this.boite!;
    if (reducedMotion()) {
      b.style.opacity = "";
      return this.arrive();
    }
    this.entree?.cancel();
    this.entree = b.animate([{ opacity: 0, transform: "scale(0.86) rotate(-40deg)" }, { opacity: 1, transform: "scale(1) rotate(0deg)" }], { duration: ms(secondes(this.el.dataset.cinetiqueDuree, 0.9, 0.05, 20)), delay: ms(this.delai), easing: OUT, fill: "both" });
    b.style.opacity = "";
    void fini([this.entree]).then((ok) => {
      if (!ok) return;
      this.entree?.cancel();
      this.entree = null;
      this.arrive();
    });
  }
  sortir() {
    this.actif = false;
    this.appliquer();
    this.signal("fin", "sortie");
  }
  aller(p: number) {
    this.actif = false;
    this.entree?.cancel();
    this.boite!.style.opacity = "";
    this.tour?.pause();
    if (this.tour) this.tour.currentTime = clamp01(p) * Number(this.tour.effect?.getTiming().duration ?? 0);
  }
  cacher() {
    this.actif = false;
    this.appliquer();
    if (!reducedMotion() && this.boite) this.boite.style.opacity = "0";
  }
  protected enVue() {
    this.appliquer();
  }
  invalider(force: boolean) {
    if (force) this.construire();
  }
  detruire() {
    this.tour?.cancel();
    this.entree?.cancel();
    this.el.replaceChildren(...this.origine);
    super.detruire();
  }
}

/* ── data-coupe : coupé en son milieu, les moitiés glissent et se verrouillent ── */

class Coupe extends Piece {
  private origine: Node[] | null = null;
  private haut: HTMLSpanElement | null = null;
  private bas: HTMLSpanElement | null = null;
  private anims: Animation[] = [];
  private etat: "repos" | "cache" | "entre" | "suspendu" | "sort" | "sorti" = "repos";
  private largeurVue = 0;
  constructor(el: HTMLElement) {
    super(el);
    if (this.attend) this.cacher();
    this.brancher();
  }
  private get duree() {
    return secondes(this.el.dataset.cinetiqueDuree, 0.9, 0.05, 20);
  }
  private fendre() {
    this.restaurer();
    const el = this.el;
    this.origine = Array.from(el.childNodes);
    const lu = span("cin-lu");
    lu.setAttribute("data-cin-calque", "");
    const env = span("cin-coupe-env");
    env.setAttribute("aria-hidden", "true");
    env.setAttribute("data-cin-calque", "");
    const moitie = (cl: string) => {
      const m = span(`cin-coupe-moitie ${cl}`);
      for (const n of this.origine!) if (!estCalque(n)) m.append(n instanceof Element ? copier(n, true) : n.cloneNode(true));
      return m;
    };
    const haut = moitie("cin-coupe-haut");
    const bas = moitie("cin-coupe-bas");
    env.append(haut, bas);
    lu.append(...this.origine);
    el.replaceChildren(lu, env);
    // Les lignes : partage de la hauteur entre lignes, coupure au milieu de chacune.
    const r = document.createRange();
    r.selectNodeContents(haut);
    const o = haut.getBoundingClientRect();
    const rects = Array.from(r.getClientRects()).filter((x) => x.width > 0.5);
    const num = grouperLignes(rects);
    const L: { top: number; bottom: number }[] = [];
    rects.forEach((x, i) => {
      const k = num[i]!;
      const l = (L[k] ??= { top: Infinity, bottom: -Infinity });
      l.top = Math.min(l.top, x.top - o.top);
      l.bottom = Math.max(l.bottom, x.bottom - o.top);
    });
    const G = -4000;
    const D = o.width + 4000;
    let dH = "";
    let dB = "";
    L.forEach((l, i) => {
      const prec = i > 0 ? (L[i - 1]!.bottom + l.top) / 2 : -4000;
      const suiv = i < L.length - 1 ? (l.bottom + L[i + 1]!.top) / 2 : o.height + 4000;
      const mi = l.top + 0.53 * (l.bottom - l.top);
      dH += `M ${G} ${f1(prec)} H ${f1(D)} V ${f1(mi)} H ${G} Z `;
      dB += `M ${G} ${f1(mi)} H ${f1(D)} V ${f1(suiv)} H ${G} Z `;
    });
    if (!L.length) dH = dB = `M ${G} -4000 H ${f1(D)} V ${f1(o.height + 4000)} H ${G} Z`;
    haut.style.clipPath = `path("${dH.trim()}")`;
    bas.style.clipPath = `path("${dB.trim()}")`;
    this.haut = haut;
    this.bas = bas;
    this.largeurVue = el.clientWidth;
  }
  private restaurer() {
    for (const a of this.anims) a.cancel();
    this.anims = [];
    if (this.origine) this.el.replaceChildren(...this.origine);
    this.origine = null;
    this.haut = this.bas = null;
    this.etat = "repos";
  }
  private construire(t: number) {
    for (const a of this.anims) a.cancel();
    const d = "0.9em";
    const o = { duration: ms(this.duree), delay: ms(this.delai), easing: "cubic-bezier(0.12, 0.9, 0.2, 1)", fill: "both" as const };
    this.anims = [
      this.haut!.animate([{ transform: `translateX(-${d})`, opacity: 0 }, { offset: 0.25, opacity: 1 }, { transform: "translateX(0em)", opacity: 1 }], o),
      this.bas!.animate([{ transform: `translateX(${d})`, opacity: 0 }, { offset: 0.25, opacity: 1 }, { transform: "translateX(0em)", opacity: 1 }], o),
    ];
    for (const a of this.anims) {
      a.pause();
      a.currentTime = t;
    }
  }
  jouer() {
    this.annulerSortie();
    if (reducedMotion()) {
      this.restaurer();
      return this.arrive();
    }
    if (this.etat === "entre") return;
    if (this.etat !== "cache" && this.etat !== "suspendu") {
      this.fendre();
      this.construire(0);
    }
    this.etat = "entre";
    this.signal("debut", "entree");
    for (const a of this.anims) a.play();
    const as = this.anims;
    void fini(as).then((ok) => {
      if (!ok || as !== this.anims) return;
      this.restaurer();
      this.arrive();
    });
  }
  sortir() {
    this.annulerSortie();
    if (this.etat === "sort" || this.etat === "sorti") return;
    if (reducedMotion()) return this.signal("fin", "sortie");
    if (!this.haut) this.fendre();
    for (const a of this.anims) {
      try {
        a.commitStyles();
      } catch {
        /* rien */
      }
      a.cancel();
    }
    const o = { duration: ms(0.45), easing: PART, fill: "forwards" as const };
    this.anims = [this.haut!.animate([{ transform: "translateX(-0.9em)", opacity: 0 }], o), this.bas!.animate([{ transform: "translateX(0.9em)", opacity: 0 }], o)];
    this.etat = "sort";
    this.signal("debut", "sortie");
    const as = this.anims;
    void fini(as).then((ok) => {
      if (!ok || as !== this.anims) return;
      this.etat = "sorti";
      this.signal("fin", "sortie");
    });
  }
  aller(p: number) {
    p = clamp01(p);
    if (p >= 1 || reducedMotion()) return this.restaurer();
    this.fendre();
    this.construire(ms(this.delai) + p * ms(this.duree));
    this.etat = p <= 0 ? "cache" : "suspendu";
  }
  cacher() {
    if (reducedMotion()) return this.restaurer();
    this.fendre();
    this.construire(0);
    this.etat = "cache";
  }
  invalider(force: boolean) {
    if (!this.haut || (!force && Math.abs(this.el.clientWidth - this.largeurVue) < 0.5)) return;
    const t = Number(this.anims[0]?.currentTime ?? 0);
    const e = this.etat;
    if (e === "cache" || e === "suspendu" || e === "entre") {
      this.fendre();
      this.construire(t);
      this.etat = e === "entre" ? "suspendu" : e;
      if (e === "entre") this.jouer();
    }
  }
  detruire() {
    this.restaurer();
    super.detruire();
  }
}

/* ── data-brouille et data-frappe : le texte change caractère par caractère ── */

/** Une boucle requestAnimationFrame sur [0, duree] (s), arrêtable. */
function boucle(duree: number, pas: (t: number) => void, fin: () => void) {
  let id = 0;
  let t0 = -1;
  const f = (now: number) => {
    if (t0 < 0) t0 = now;
    const t = (now - t0) / 1000;
    pas(Math.min(t, duree));
    if (t >= duree) return fin();
    id = requestAnimationFrame(f);
  };
  id = requestAnimationFrame(f);
  return () => cancelAnimationFrame(id);
}

class Brouille extends Piece {
  private d: Decoupe | null = null;
  private lettres: string[] = [];
  private stop: (() => void) | null = null;
  private readonly graine: number;
  private largeurVue = 0;
  private p = 1;
  constructor(el: HTMLElement) {
    super(el);
    this.graine = graineDe(el.textContent ?? "", 5);
    if (this.attend) this.cacher();
    this.brancher();
  }
  private get duree() {
    return secondes(this.el.dataset.cinetiqueDuree, 1.2, 0.05, 30);
  }
  private fendre() {
    this.d?.restaurer();
    this.d = new Decoupe(this.el, "lettre", false, "cin-brouille cin-centre");
    this.lettres = this.d.atomes.map((a) => a.texte);
    this.largeurVue = this.el.clientWidth;
  }
  private poser(p: number) {
    this.p = p;
    if (!this.d) this.fendre();
    const etats = brouillage(this.lettres, p, this.graine, Math.floor(p * this.duree * 18));
    this.d!.atomes.forEach((a, i) => {
      const e = etats[i]!;
      if (!a.texte) return;
      if (a.p.textContent !== e.t) a.p.textContent = e.t;
      a.p.style.opacity = e.vu ? "" : "0";
    });
  }
  private arreter() {
    this.stop?.();
    this.stop = null;
  }
  private restaurer() {
    this.arreter();
    this.d?.restaurer();
    this.d = null;
    this.p = 1;
  }
  jouer() {
    this.annulerSortie();
    this.arreter();
    if (reducedMotion()) {
      this.restaurer();
      return this.arrive();
    }
    this.fendre();
    this.signal("debut", "entree");
    const D = this.duree;
    const t = this.delai;
    this.poser(0);
    this.stop = boucle(t + D, (x) => this.poser(clamp01((x - t) / D)), () => {
      this.restaurer();
      this.arrive();
    });
  }
  sortir() {
    this.annulerSortie();
    this.arreter();
    if (reducedMotion()) return;
    if (!this.d) this.fendre();
    const p0 = this.p;
    const D = this.duree * 0.6 * p0;
    this.signal("debut", "sortie");
    this.stop = boucle(D, (x) => this.poser(p0 * (1 - x / Math.max(1e-6, D))), () => {
      this.poser(0);
      this.stop = null;
      this.signal("fin", "sortie");
    });
  }
  aller(p: number) {
    this.arreter();
    p = clamp01(p);
    if (p >= 1 || reducedMotion()) return this.restaurer();
    this.fendre();
    this.poser(p);
  }
  cacher() {
    this.aller(0);
  }
  invalider(force: boolean) {
    if (!this.d || (!force && Math.abs(this.el.clientWidth - this.largeurVue) < 0.5)) return;
    const p = this.p;
    this.fendre();
    this.poser(p);
  }
  detruire() {
    this.restaurer();
    super.detruire();
  }
}

class Frappe extends Piece {
  private d: Decoupe | null = null;
  private temps: number[] = [];
  private total = 0;
  private curseur: HTMLSpanElement | null = null;
  private clignote: Animation | null = null;
  private stop: (() => void) | null = null;
  private posPerso = false;
  private readonly graine: number;
  private t = 0;
  private minuteurFin = 0;
  constructor(el: HTMLElement) {
    super(el);
    this.graine = graineDe(el.textContent ?? "", 9);
    if (this.attend) this.cacher();
    this.brancher();
  }
  private fendre() {
    this.d?.restaurer();
    this.d = new Decoupe(this.el, "glyphe", false, "cin-frappe");
    const lettres = this.d.atomes.map((a) => a.texte);
    this.temps = rythmeFrappe(lettres, this.graine, secondes(this.el.dataset.frappeVitesse, 16, 1, 200));
    const brut = (this.temps[this.temps.length - 1] ?? 0) + 0.05;
    const voulu = secondes(this.el.dataset.cinetiqueDuree, brut, 0.05, 120);
    const k = brut > 0 ? voulu / brut : 1;
    this.temps = this.temps.map((x) => x * k);
    this.total = voulu;
    if (!this.curseur) {
      if (getComputedStyle(this.el).position === "static") {
        this.el.style.position = "relative";
        this.posPerso = true;
      }
      const c = span("cin-curseur");
      c.setAttribute("aria-hidden", "true");
      c.setAttribute("data-cin-calque", "");
      this.curseur = c;
    }
    this.el.append(this.curseur);
  }
  /** Pose l'instant t (s) : les caractères parus, le curseur après le dernier. */
  private poser(t: number) {
    this.t = t;
    if (!this.d) this.fendre();
    const as = this.d!.atomes;
    let k = 0;
    as.forEach((a, i) => {
      const vu = (this.temps[i] ?? 0) <= t && t > 0;
      if (vu) k = i + 1;
      a.p.style.visibility = vu ? "" : "hidden";
    });
    const c = this.curseur!;
    const er = this.el.getBoundingClientRect();
    const ref = k > 0 ? as[k - 1] : as[0];
    if (!ref) return;
    const r = ref.p.getBoundingClientRect();
    const x = (k > 0 ? r.right : r.left) - er.left - this.el.clientLeft;
    const y = r.top - er.top - this.el.clientTop;
    c.style.height = `${r.height}px`;
    c.style.transform = `translate(${arrondi(x, 2)}px, ${arrondi(y, 2)}px)`;
  }
  private clignoter(oui: boolean) {
    this.clignote?.cancel();
    this.clignote = null;
    if (oui && this.curseur && !reducedMotion()) this.clignote = this.curseur.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], { duration: 1000, iterations: Infinity });
  }
  private arreter() {
    this.stop?.();
    this.stop = null;
    clearTimeout(this.minuteurFin);
  }
  private restaurer() {
    this.arreter();
    this.clignoter(false);
    this.curseur?.remove();
    this.curseur = null;
    this.d?.restaurer();
    this.d = null;
    if (this.posPerso) {
      this.el.style.position = "";
      this.posPerso = false;
    }
    attributsVides(this.el);
  }
  jouer() {
    this.annulerSortie();
    this.arreter();
    if (reducedMotion()) {
      this.restaurer();
      return this.arrive();
    }
    this.fendre();
    if (this.curseur) this.curseur.style.opacity = "";
    this.signal("debut", "entree");
    this.poser(0);
    this.clignoter(true);
    const t0 = this.delai;
    this.stop = boucle(t0 + this.total, (x) => {
      // Le curseur ne clignote pas pendant qu'on tape.
      if (x > t0 && this.clignote) this.clignoter(false);
      this.poser(Math.max(0, x - t0));
    }, () => {
      this.stop = null;
      this.poser(this.total + 1);
      this.clignoter(true);
      this.minuteurFin = window.setTimeout(() => {
        this.restaurer();
        this.arrive();
      }, 1600);
    });
  }
  sortir() {
    this.annulerSortie();
    this.arreter();
    if (reducedMotion()) return;
    if (!this.d) {
      this.fendre();
      this.poser(this.total + 1);
    }
    const t0 = Math.min(this.t, this.total);
    const D = t0 / 3;
    this.signal("debut", "sortie");
    this.clignoter(false);
    this.stop = boucle(D, (x) => this.poser(Math.max(0, t0 - x * 3)), () => {
      this.stop = null;
      this.poser(0);
      this.clignoter(true);
      this.signal("fin", "sortie");
    });
  }
  aller(p: number) {
    this.arreter();
    p = clamp01(p);
    if (p >= 1 || reducedMotion()) return this.restaurer();
    this.fendre();
    this.clignoter(false);
    this.poser(p * this.total);
  }
  cacher() {
    this.arreter();
    if (reducedMotion()) return this.restaurer();
    this.fendre();
    this.clignoter(false);
    this.poser(0);
    // Le curseur ne paraît qu'au départ.
    if (this.curseur) this.curseur.style.opacity = "0";
  }
  invalider() {
    if (this.d) this.poser(this.t);
  }
  detruire() {
    this.restaurer();
    super.detruire();
  }
}

/* ───────────────────────── Armement ───────────────────────── */

const SELECTEUR = "[data-cinetique],[data-roule],[data-marque],[data-defile],[data-reflet],[data-cercle],[data-coupe],[data-brouille],[data-frappe]";
const estCopie = (el: Element) => !!el.closest("[data-cin-copie],[data-cin-calque]");

function armer(el: HTMLElement): Piece | null {
  const deja = instances.get(el);
  if (deja) return deja;
  if (estCopie(el)) return null;
  const d = el.dataset;
  if (d.cinetique !== undefined) return cinetiqueDe(d.cinetique) ? new Texte(el) : null;
  if (d.roule !== undefined) return new Roule(el);
  if (d.marque !== undefined) return new Marquage(el);
  if (d.defile !== undefined) return new Defile(el);
  if (d.reflet !== undefined) return new Reflet(el);
  if (d.cercle !== undefined) return new Cercle(el);
  if (d.coupe !== undefined) return new Coupe(el);
  if (d.brouille !== undefined) return new Brouille(el);
  if (d.frappe !== undefined) return new Frappe(el);
  return null;
}

/** Le contrôleur d'un élément (armé au besoin). */
export function cinetique(el: HTMLElement): CinetiqueApi {
  installer();
  const p = armer(el);
  if (!p) throw new Error(`[presse:cinetique] élément sans effet connu (data-cinetique : ${CINETIQUES.join(", ")} ; ou ${COMPOSANTS.map((c) => `data-${c}`).join(", ")})`);
  return p;
}

function installer() {
  if (arme || !enDom()) return;
  arme = true;
  poserCss();
  io85 = new IntersectionObserver(
    (es) => {
      for (const e of es) if (e.isIntersecting) instances.get(e.target as HTMLElement)?.visible();
    },
    { rootMargin: "0px 0px -15% 0px" },
  );
  io0 = new IntersectionObserver((es) => {
    for (const e of es) instances.get(e.target as HTMLElement)?.vue(e.isIntersecting, !e.isIntersecting && e.boundingClientRect.top > 0);
  });
  let attente = 0;
  ro = new ResizeObserver(() => {
    cancelAnimationFrame(attente);
    attente = requestAnimationFrame(() => {
      for (const p of instances.values()) p.invalider(false);
    });
  });
  const tout = () => {
    for (const p of instances.values()) p.invalider(true);
  };
  void document.fonts?.ready.then(tout);
  document.fonts?.addEventListener?.("loadingdone", tout);
  mo = new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "childList") {
        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement) || estCopie(n)) continue;
          if (n.matches(SELECTEUR)) armer(n);
          n.querySelectorAll<HTMLElement>(SELECTEUR).forEach((x) => armer(x));
        }
        for (const n of m.removedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          // Retiré de la page (pas déplacé par nous) : on oublie l'instance.
          for (const [el, p] of instances) if (!el.isConnected && (n === el || n.contains(el))) p.detruire();
        }
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

/** Arme les éléments présents et à venir sous `root`. */
export function initCinetique(root: ParentNode = document) {
  if (!enDom()) return;
  installer();
  if (root instanceof HTMLElement && root.matches(SELECTEUR)) armer(root);
  root.querySelectorAll<HTMLElement>(SELECTEUR).forEach((el) => armer(el));
}
