/**
 * Presse — le couloir : une rangée d'images vue en perspective fuyante, comme un mur très long vu de côté.
 *
 *   <ul data-couloir data-couloir-presets="micro" aria-label="Paysages">
 *     <li><img src="…" alt="…" width="960" height="640" /></li>          (ou <figure>, <a><img></a>, <button>…)
 *   </ul>
 *
 * Les panneaux de premier plan sont immenses et coupés par l'écran ; ils se réduisent vers un point de fuite
 * puis deviennent une fine bande qui file jusqu'au bord. Chaque panneau est un trapèze (une homographie posée en
 * `matrix3d` sur un élément de taille fixe : transform seulement, aucune mise en page par image), séparé du suivant
 * par un filet. Les images défilent sans fin, pilotées par le pointeur, le glisser, la molette ou le défilement ;
 * vite, les panneaux de tête se frangent de rouge et de bleu (aberration chromatique, filtre SVG) et se brouillent
 * dans le sens du mouvement. Sans JavaScript, la liste reste une liste d'images.
 *
 * Réglages (attributs `data-couloir-…`, défauts entre parenthèses ; `-presets` en donne d'abord une base) :
 *   -presets      `micro`, `tunnel`, `lookbook`, `doux` ou `rapide` : un point de départ, que les autres attributs
 *                 corrigent.
 *   -profondeur   force de la perspective, en panneaux (1.6) : petit = fuite brutale, grand = mur presque de face.
 *   -angle        inclinaison du mur, en degrés autour du point de fuite (0).
 *   -horizon      hauteur du point de fuite, en % (50). En mode plafond : la hauteur où la bande disparaît.
 *   -cote         `droite` (défaut) ou `gauche` : le côté vers lequel le mur fuit.
 *   -hauteur      hauteur du panneau de tête, × le plus petit côté du conteneur (1.2).
 *   -largeur      proportion d'un panneau, largeur ÷ hauteur, lue dans la bande lointaine (0.8).
 *   -bande        hauteur de la bande lointaine, × le plus petit côté (0.06) ; épaissie s'il le faut pour que le
 *                 coude tombe avant le 26ᵉ panneau.
 *   -ecart        filet entre deux panneaux, en px au premier plan (6) ; il s'amincit avec la distance.
 *   -filet        couleur du filet (#ffffff).
 *   -vitesse      vitesse de croisière, en panneaux par seconde, au pointeur tout à droite (0.8 ; × 0.35 en auto).
 *   -inertie      0 (sec) à 1 (glisse longtemps) (0.6).
 *   -pilotage     `pointeur`, `defilement`, `glisser`, `auto`, `molette`, combinables : "pointeur auto"
 *                 (défaut "pointeur glisser").
 *   -sens         `avant` (défaut : les images viennent vers soi) ou `arriere`.
 *   -sansfin      bouclage (défaut oui) ; "non" : la rangée a un début et une fin.
 *   -aberration   franges RVB proportionnelles à la vitesse, 0 = aucune (0.5) ; décalage plafonné à 10 px.
 *   -flou         flou de mouvement proportionnel à la vitesse, 0 = aucun (0.3) ; plafonné à 10 px.
 *   -vide         part de panneaux vides, gris pâle, de 0 à 0.6 (0) ; tirage fixe, le même à chaque visite.
 *   -survol       le panneau survolé grandit de cette fraction (0).
 *   -ouvre        `non` (défaut : un lien ou un bouton du panneau garde son clic) ou `visionneuse` (clic, Entrée :
 *                 la visionneuse Presse, sinon un dialogue simple).
 *   -fond         couleur du fond du couloir (transparent).
 *   -mur          `un` (défaut), `deux` (murs haut et bas : un tunnel) ou `trois`.
 *   -ouverture    l'écart entre les murs au premier plan, × le plus petit côté (0.35) ; nul au fond.
 *   -mode         `mur` (défaut) ou `plafond` : la même rangée posée au sol, qui fuit vers le haut (ou vers le bas).
 *   -commandes    `non` : pas de boutons précédent / suivant / pause (l'API reste) ; ou `#id` : où les poser.
 *
 * Accessibilité : liste (`role="list"`, chaque panneau `listitem`), un seul arrêt de Tab et les flèches (focus
 * itinérant), Début / Fin, Entrée ; le panneau qui prend le focus vient au premier plan. Boutons de 44 px.
 * Mouvement réduit : ni défilement automatique ni pointeur, ni franges ni flou ; flèches et boutons font un fondu.
 * Coût : un élément par panneau et par mur (44 au plus par mur, plus un cycle), transform et opacité seulement ;
 * le `matrix3d` suffit à donner une couche à chaque panneau : pas de `will-change` (il figerait l'échelle de
 * tramage, et un panneau né au fond resterait flou au premier plan) ; le filtre d'aberration ne touche que les
 * trois ou quatre panneaux de tête, et seulement en mouvement ; la classe `.couloir-bouge` marque le mouvement ;
 * la boucle s'arrête au repos, hors écran et onglet caché.
 *
 * API : `initCouloir()` → Map(élément → contrôle) ; `controleCouloir(el)` ; contrôle `.aller(i)`, `.suivant()`,
 * `.precedent()`, `.pause(oui?)`, `.regler()` (relit les attributs), `.index()`, `.detruire()`.
 * Événement `couloir:change` (detail : { index }) quand le panneau de tête change.
 */

/* ================================================================ pur (testé sous Node) */

export type Cote = "droite" | "gauche";
export type Pilotage = "pointeur" | "defilement" | "glisser" | "auto" | "molette";
export type Mur = "un" | "deux" | "trois";
export type Mode = "mur" | "plafond";
export type Ouvre = "non" | "visionneuse";
export type Preset = "micro" | "tunnel" | "lookbook" | "doux" | "rapide";

export interface Reglages {
  profondeur: number;
  angle: number;
  horizon: number;
  cote: Cote;
  hauteur: number;
  largeur: number;
  bande: number;
  ecart: number;
  filet: string;
  vitesse: number;
  inertie: number;
  pilotage: Pilotage[];
  sens: 1 | -1;
  sansfin: boolean;
  aberration: number;
  flou: number;
  vide: number;
  survol: number;
  ouvre: Ouvre;
  fond: string;
  mur: Mur;
  ouverture: number;
  mode: Mode;
  preset: Preset | null;
}

export const PILOTAGES: readonly Pilotage[] = ["pointeur", "defilement", "glisser", "auto", "molette"];
export const PRESETS_NOMS: readonly Preset[] = ["micro", "tunnel", "lookbook", "doux", "rapide"];

export const DEFAUTS: Readonly<Reglages> = Object.freeze({
  profondeur: 1.6,
  angle: 0,
  horizon: 50,
  cote: "droite",
  hauteur: 1.2,
  largeur: 0.8,
  bande: 0.06,
  ecart: 6,
  filet: "#ffffff",
  vitesse: 0.8,
  inertie: 0.6,
  pilotage: ["pointeur", "glisser"] as Pilotage[],
  sens: 1,
  sansfin: true,
  aberration: 0.5,
  flou: 0.3,
  vide: 0,
  survol: 0,
  ouvre: "non",
  fond: "",
  mur: "un",
  ouverture: 0.35,
  mode: "mur",
  preset: null,
} satisfies Reglages);

/** Les préréglages : une base, que les attributs explicites corrigent. */
export const PRESETS: Readonly<Record<Preset, Partial<Reglages>>> = {
  // Comme la référence : mur blanc cassé, fuite à droite, bande fine, franges au premier plan, quelques vides.
  micro: { profondeur: 1.4, hauteur: 1.25, largeur: 0.8, bande: 0.055, ecart: 6, filet: "#ffffff", vitesse: 0.9, inertie: 0.55, pilotage: ["pointeur", "auto", "glisser"], aberration: 0.75, flou: 0.45, vide: 0.14, fond: "#f2f3ef" },
  // Deux murs qui se rejoignent au fond, sur fond nuit.
  tunnel: { mur: "deux", ouverture: 0.42, hauteur: 0.62, profondeur: 1.05, bande: 0.035, largeur: 0.9, ecart: 4, filet: "#1c1d20", vitesse: 1.1, inertie: 0.55, pilotage: ["pointeur", "auto", "glisser"], aberration: 0.9, flou: 0.55, vide: 0.1, fond: "#0e0f11" },
  // Une vitrine : perspective douce, grands panneaux, le survol avance la pièce, rien qui frange.
  lookbook: { profondeur: 2.2, hauteur: 0.98, largeur: 0.75, bande: 0.085, ecart: 10, vitesse: 0.45, inertie: 0.75, pilotage: ["pointeur", "glisser"], aberration: 0.12, flou: 0, vide: 0, survol: 0.08 },
  doux: { profondeur: 2.8, hauteur: 1.1, vitesse: 0.32, inertie: 0.85, pilotage: ["auto", "pointeur", "glisser"], aberration: 0.12, flou: 0.08, vide: 0.06 },
  rapide: { profondeur: 1.1, hauteur: 1.3, vitesse: 2.2, inertie: 0.3, pilotage: ["pointeur", "auto", "glisser", "molette"], aberration: 1.2, flou: 0.9, vide: 0.1 },
};

export const borner = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Les bornes de chaque réglage numérique (le panneau de la démo s'en sert pour ses curseurs). */
export const BORNES = {
  profondeur: [0.4, 8],
  angle: [-30, 30],
  horizon: [5, 95],
  hauteur: [0.15, 2.5],
  largeur: [0.25, 3],
  bande: [0.01, 0.3],
  ecart: [0, 40],
  vitesse: [0, 6],
  inertie: [0, 1],
  aberration: [0, 2],
  flou: [0, 2],
  vide: [0, 0.6],
  survol: [0, 0.5],
  ouverture: [0, 1.5],
} as const satisfies Partial<Record<keyof Reglages, readonly [number, number]>>;
type CleNombre = keyof typeof BORNES;
const CLES_NOMBRES = Object.keys(BORNES) as CleNombre[];

/** Une couleur CSS raisonnable (pas de « ; », d'url ni d'accolade), sinon null. */
export function couleurSure(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t) return "";
  return t.length <= 64 && /^[#a-z0-9(),.%\s/-]+$/i.test(t) && !/url|expression/i.test(t) ? t : null;
}

const oui = (v: string) => v === "" || v === "oui" || v === "1" || v === "true";
const non = (v: string) => v === "non" || v === "0" || v === "false";

/** Les mots de pilotage d'un attribut ("pointeur auto", "glisser,molette"), dans l'ordre, sans doublon ni inconnu. */
export function lirePilotage(v: string): Pilotage[] {
  const vus = new Set<Pilotage>();
  for (const m of v.toLowerCase().split(/[\s,+|]+/)) if ((PILOTAGES as readonly string[]).includes(m)) vus.add(m as Pilotage);
  return [...vus];
}

/** Clé de dataset : "profondeur" → "couloirProfondeur". */
const cleDataset = (k: string) => "couloir" + k[0]!.toUpperCase() + k.slice(1);

/** Les réglages d'un dataset : défauts, puis le préréglage, puis les attributs explicites (bornés). */
export function lireReglages(ds: Record<string, string | undefined>): Reglages {
  const presetBrut = (ds.couloirPresets ?? "").trim().toLowerCase();
  const preset = (PRESETS_NOMS as readonly string[]).includes(presetBrut) ? (presetBrut as Preset) : null;
  const r: Reglages = { ...DEFAUTS, pilotage: [...DEFAUTS.pilotage], ...(preset ? PRESETS[preset] : {}), preset };
  if (preset && PRESETS[preset].pilotage) r.pilotage = [...PRESETS[preset].pilotage!];
  for (const k of CLES_NOMBRES) {
    const brut = ds[cleDataset(k)];
    if (brut == null || brut.trim() === "") continue;
    const n = Number(brut.replace(",", "."));
    if (Number.isFinite(n)) r[k] = borner(n, BORNES[k][0], BORNES[k][1]);
  }
  const cote = ds.couloirCote?.trim();
  if (cote === "droite" || cote === "gauche") r.cote = cote;
  const mur = ds.couloirMur?.trim();
  if (mur === "un" || mur === "deux" || mur === "trois") r.mur = mur;
  else if (mur === "1" || mur === "2" || mur === "3") r.mur = (["un", "deux", "trois"] as const)[Number(mur) - 1]!;
  const mode = ds.couloirMode?.trim();
  if (mode === "mur" || mode === "plafond") r.mode = mode;
  const ouvre = ds.couloirOuvre?.trim();
  if (ouvre === "non" || ouvre === "visionneuse") r.ouvre = ouvre;
  else if (ouvre === "" || ouvre === "oui") r.ouvre = "visionneuse";
  if (ds.couloirPilotage != null) r.pilotage = lirePilotage(ds.couloirPilotage);
  const sens = ds.couloirSens?.trim();
  if (sens === "arriere" || sens === "-1") r.sens = -1;
  else if (sens === "avant" || sens === "1") r.sens = 1;
  if (ds.couloirSansfin != null) {
    const v = ds.couloirSansfin.trim().toLowerCase();
    if (non(v)) r.sansfin = false;
    else if (oui(v)) r.sansfin = true;
  }
  const filet = couleurSure(ds.couloirFilet);
  if (filet) r.filet = filet;
  const fond = couleurSure(ds.couloirFond);
  if (fond != null) r.fond = fond;
  return r;
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Les attributs qui redonnent ces réglages : `data-couloir`, le préréglage, puis seulement ce qui diffère de lui
 * (ou des défauts). Ce que le bouton « copier les attributs » de la démo met dans le presse-papiers.
 */
export function attributsDe(r: Reglages): string {
  const base = lireReglages(r.preset ? { couloirPresets: r.preset } : {});
  const out: string[] = ["data-couloir"];
  if (r.preset) out.push(`data-couloir-presets="${r.preset}"`);
  const pose = (k: string, v: string) => out.push(`data-couloir-${k}="${v}"`);
  for (const k of ["mode", "mur", "cote"] as const) if (r[k] !== base[k]) pose(k, r[k]);
  for (const k of CLES_NOMBRES) if (Math.abs(r[k] - base[k]) > 1e-6) pose(k, fmt(r[k]));
  if (r.pilotage.join(" ") !== base.pilotage.join(" ")) pose("pilotage", r.pilotage.join(" "));
  if (r.sens !== base.sens) pose("sens", r.sens === 1 ? "avant" : "arriere");
  if (r.sansfin !== base.sansfin) pose("sansfin", r.sansfin ? "oui" : "non");
  if (r.ouvre !== base.ouvre) pose("ouvre", r.ouvre);
  if (r.filet !== base.filet) pose("filet", r.filet);
  if (r.fond !== base.fond) pose("fond", r.fond);
  return out.join(" ");
}

/* ---------------------------------------------------------------- géométrie */

/**
 * Le repère local : `u` le long du mur (0 au bord proche, croissant vers le point de fuite), `v` en travers.
 * Mode mur : u = x (côté droite) ou largeur − x (côté gauche), v = y. Mode plafond : u monte (ou descend), v = x.
 *
 * Le modèle : un mur plan vu en perspective (sa hauteur à l'écran décroît en ligne droite vers le point de fuite),
 * qui tourne au loin pour faire face à l'œil — à partir du coude, les panneaux gardent la hauteur de la bande et
 * avancent d'un pas constant jusqu'au bord. Juste avant le coude, les panneaux vus presque par la tranche ne sont
 * plus que de fines lamelles ; le coude est arrondi.
 */
export interface Geometrie {
  /** Longueur (le long du mur) et travers de l'écran, en px. */
  L: number;
  C: number;
  /** Le plus petit côté : l'unité des hauteurs (le couloir garde ses proportions en portrait). */
  R: number;
  /** u du panneau de tête (d = 0) et du point de fuite du mur plan. */
  u0: number;
  uf: number;
  P: number;
  /** Avancée en px par panneau dans la bande lointaine. */
  b: number;
  /** Hauteur du panneau de tête et de la bande lointaine, en px. */
  H0: number;
  hb: number;
  /** La profondeur du coude (où le mur plan atteint la hauteur de la bande). */
  dc: number;
  /** Travers du point de fuite, et pente du mur (tan de l'angle). */
  c0: number;
  pente: number;
  ecart: number;
  ouverture: number;
  murs: number;
  mode: Mode;
  cote: Cote;
}

/** Arrondi du coude, en panneaux. */
const COUDE = 1.1;
/** Le coude tombe au plus tard à ce rang : au-delà, la bande s'épaissit (sinon des dizaines de lamelles invisibles). */
export const COUDE_MAX = 26;

export function geometrie(r: Reglages, largeur: number, hauteur: number): Geometrie {
  const plafond = r.mode === "plafond";
  const L = Math.max(1, plafond ? hauteur : largeur);
  const C = Math.max(1, plafond ? largeur : hauteur);
  const R = Math.min(L, C);
  const P = r.profondeur;
  const H0 = Math.max(2, r.hauteur * R);
  const hb = Math.min(H0 / 1.01, Math.max(1, r.bande * R, (H0 * P) / (P + COUDE_MAX)));
  return {
    L,
    C,
    R,
    u0: 0.03 * L,
    uf: (plafond ? borner(1 - r.horizon / 100, 0.2, 0.95) : 0.78) * L,
    P,
    b: hb * r.largeur,
    H0,
    hb,
    dc: P * (H0 / hb - 1),
    c0: plafond ? C / 2 : (C * r.horizon) / 100,
    pente: Math.tan((r.angle * Math.PI) / 180),
    ecart: r.ecart,
    ouverture: r.ouverture * R,
    murs: r.mur === "trois" ? 3 : r.mur === "deux" ? 2 : 1,
    mode: r.mode,
    cote: r.cote,
  };
}

/**
 * L'échelle de perspective à la profondeur d (en panneaux) : 1 en tête, → 0 au loin (P / (P + d)).
 * Derrière la tête (d < 0), une exponentielle de même pente : finie partout, les panneaux qui sortent par le bord
 * grandissent vite sans jamais diverger.
 */
export const echelle = (d: number, P: number) => (d >= 0 ? P / (P + d) : Math.exp(-d / P));
/** −d(echelle)/dd. */
const pente = (d: number, P: number) => (d >= 0 ? P / (P + d) ** 2 : Math.exp(-d / P) / P);
/** max(0, t), arrondi sur w (softplus), et sa dérivée. */
const doux = (t: number, w: number) => (t / w > 30 ? t : w * Math.log1p(Math.exp(t / w)));
const sigmoide = (t: number, w: number) => 1 / (1 + Math.exp(-t / w));

/** Position le long du mur du bord d'un panneau à la profondeur d : le mur plan, puis la bande après le coude. */
export const uDe = (d: number, g: Geometrie) => g.uf - (g.uf - g.u0) * echelle(d, g.P) + g.b * doux(d - g.dc, COUDE);

/** du/dd : px par panneau à cette profondeur (toujours > 0). */
export const pasDe = (d: number, g: Geometrie) => (g.uf - g.u0) * pente(d, g.P) + g.b * sigmoide(d - g.dc, COUDE);

/** Hauteur d'un panneau à la profondeur d : celle du mur plan, jamais sous la bande (raccord arrondi, norme 4). */
export const hDe = (d: number, g: Geometrie) => ((g.H0 * echelle(d, g.P)) ** 4 + g.hb ** 4) ** 0.25;

/** La profondeur qui tombe à la position u (inverse de uDe, par dichotomie : uDe est strictement croissante). */
export function dDeU(u: number, g: Geometrie): number {
  let a = -8, z = 4000;
  for (let i = 0; i < 64; i++) {
    const m = (a + z) / 2;
    if (uDe(m, g) < u) a = m;
    else z = m;
  }
  return (a + z) / 2;
}

/** Épaisseur du filet en px à la profondeur d (il s'amincit avec la hauteur, jamais sous un demi-pixel s'il existe). */
export const filetDe = (d: number, g: Geometrie) => (g.ecart > 0 ? Math.max(0.5, (g.ecart * hDe(d, g)) / g.H0) : 0);

/** Le travers du centre de chaque mur à la profondeur d (h : hauteur du panneau, éventuellement agrandie). */
export function centres(d: number, g: Geometrie, h = hDe(d, g)): number[] {
  const c = g.c0 + g.pente * (uDe(d, g) - g.uf);
  if (g.murs === 1) return [c];
  const o = Math.max((g.ouverture * hDe(d, g)) / g.H0, filetDe(d, g));
  if (g.murs === 2) return [c - (h + o) / 2, c + (h + o) / 2];
  return [c - h - o, c, c + h + o];
}

/** Combien de panneaux (depuis d = 0) pour que le mur atteigne le bord de l'écran, plus une marge. */
export function panneauxUtiles(g: Geometrie, plafond = 400): number {
  for (let d = 1; d <= plafond; d++) if (uDe(d, g) > g.L + 8) return d + 1;
  return plafond;
}

/**
 * La profondeur de l'élément de rang j quand la rangée est avancée de `decalage` panneaux. Sans fin : bouclée dans
 * [−2, M − 2) — le saut de bouclage a lieu à d = −2, hors écran, ou au fond, sous le fondu.
 */
export function profondeurDe(j: number, decalage: number, M: number, sansfin: boolean): number {
  const d = j - decalage;
  if (!sansfin || M <= 0) return d;
  return (((d + 2) % M) + M) % M - 2;
}

/** L'écart le plus court (avec bouclage) pour aller de a à b sur un cercle de longueur M. */
export function ecartBoucle(a: number, b: number, M: number): number {
  if (!(M > 0)) return b - a;
  let e = (b - a) % M;
  if (e > M / 2) e -= M;
  if (e < -M / 2) e += M;
  return e;
}

/** Un tirage fixe dans [0, 1) pour l'entier k (les panneaux vides tombent toujours au même endroit). */
export function hasard(k: number, graine = 0): number {
  let x = (Math.imul(k + 1, 0x9e3779b1) ^ Math.imul(graine + 7, 0x85ebca6b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Un cycle de la rangée : les rangs des n images (0…n−1), avec des panneaux vides (−1) glissés avec la
 * fréquence `vide` — jamais deux vides de suite, jamais en tête.
 */
export function cycle(n: number, vide: number, graine = 0): number[] {
  const out: number[] = [];
  for (let i = 0, k = 0; i < n; k++) {
    if (out.length > 0 && out[out.length - 1] !== -1 && vide > 0 && hasard(k, graine) < vide) out.push(-1);
    else out.push(i++);
  }
  return out;
}

/** La rangée complète : assez de cycles pour couvrir `besoin` places (sans fin), un seul sinon. */
export function sequence(n: number, vide: number, besoin: number, sansfin: boolean, graine = 0): number[] {
  if (n <= 0) return [];
  const c = cycle(n, vide, graine);
  if (!sansfin) return c;
  const out = [...c];
  while (out.length < besoin) out.push(...c);
  return out;
}

/* ---------------------------------------------------------------- homographie */

export type Point = readonly [number, number];
/** H (3 × 3, rangée par rangée) : (s, t) du carré unité → l'écran, en coordonnées homogènes. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** L'homographie qui envoie le carré unité (0,0) (1,0) (1,1) (0,1) sur le quadrilatère p0 p1 p2 p3 (Heckbert). */
export function carreVersQuad(p0: Point, p1: Point, p2: Point, p3: Point): Mat3 {
  const [x0, y0] = p0, [x1, y1] = p1, [x2, y2] = p2, [x3, y3] = p3;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(det) > 1e-12) {
      g = (dx3 * dy2 - dx2 * dy3) / det;
      h = (dx1 * dy3 - dx3 * dy1) / det;
    }
  }
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

export function appliquer(m: Mat3, s: number, t: number): [number, number] {
  const w = m[6] * s + m[7] * t + m[8];
  return [(m[0] * s + m[1] * t + m[2]) / w, (m[3] * s + m[4] * t + m[5]) / w];
}

export function inverser(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g;
  const det = a * A + b * B + c * Cc || 1e-12;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

/** Le `matrix3d` CSS (16 nombres, par colonnes, origine 0 0) qui pose un élément w × h sur le quadrilatère. */
export function matrice3d(m: Mat3, w: number, h: number): number[] {
  const [a, b, c, d, e, f, g, hh, i] = m;
  return [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, i];
}

/* ---------------------------------------------------------------- un panneau */

export interface Pose {
  /** Coins à l'écran (haut-gauche, haut-droite, bas-droite, bas-gauche de l'image, qui reste à l'endroit). */
  quad: [Point, Point, Point, Point];
  /** Part de la profondeur occupée par l'image (le reste : le filet), dans le repère de l'élément. */
  part: number;
  /** u du bord proche et du bord lointain (pour savoir s'il est à l'écran). */
  uProche: number;
  uLoin: number;
}

/** Repère local (u, v) → écran (x, y). */
export function versEcran(u: number, v: number, g: Geometrie): [number, number] {
  if (g.mode === "plafond") return g.cote === "droite" ? [v, g.L - u] : [v, u];
  return g.cote === "droite" ? [u, v] : [g.L - u, v];
}

/** Écran → repère local (l'inverse de versEcran). */
export function versLocal(x: number, y: number, g: Geometrie): [number, number] {
  if (g.mode === "plafond") return g.cote === "droite" ? [g.L - y, x] : [y, x];
  return g.cote === "droite" ? [x, y] : [g.L - x, y];
}

/**
 * Le trapèze du panneau [d, d + 1] du mur `mur`. `agrandi` : facteur de hauteur (survol). Les coins sont rangés
 * pour que l'image reste à l'endroit quel que soit le côté ou le mode.
 */
export function poser(d: number, mur: number, g: Geometrie, agrandi = 1): Pose {
  const dP = d, dL = d + 1;
  const uP = uDe(dP, g), uL = uDe(dL, g);
  const hP = hDe(dP, g) * agrandi, hL = hDe(dL, g) * agrandi;
  const cP = centres(dP, g, hP)[mur] ?? 0, cL = centres(dL, g, hL)[mur] ?? 0;
  // A, B : bord proche (v−, v+) ; Cl, D : bord lointain.
  const A = versEcran(uP, cP - hP / 2, g), B = versEcran(uP, cP + hP / 2, g);
  const Cl = versEcran(uL, cL - hL / 2, g), D = versEcran(uL, cL + hL / 2, g);
  let quad: Pose["quad"];
  if (g.mode === "plafond") quad = g.cote === "droite" ? [Cl, D, B, A] : [A, B, D, Cl];
  else quad = g.cote === "droite" ? [A, Cl, D, B] : [Cl, A, B, D];
  // Le filet : l'image s'arrête un peu avant le bord lointain. Où tombe ce point dans le repère de l'élément ?
  let part = 1;
  const f = filetDe(dL, g);
  if (f > 0) {
    const dG = Math.max(dP + 0.05, dL - f / pasDe(dL, g));
    const t = (uDe(dG, g) - uP) / (uL - uP || 1);
    const pt = versEcran(uP + t * (uL - uP), cP - hP / 2 + t * (cL - hL / 2 - (cP - hP / 2)), g);
    const [s, tt] = appliquer(inverser(carreVersQuad(...quad)), pt[0], pt[1]);
    // La composante « profondeur » du repère de l'élément, mesurée depuis le bord proche.
    const prof = g.mode === "plafond" ? (g.cote === "droite" ? 1 - tt : tt) : g.cote === "droite" ? s : 1 - s;
    part = borner(prof, 0.05, 1);
  }
  return { quad, part, uProche: uP, uLoin: uL };
}

/* ---------------------------------------------------------------- mouvement */

/** Vitesse visée (panneaux/s) selon la position du pointeur le long du mur (0 au bord proche, 1 au fond). */
export const vitessePointeur = (p: number, vitesse: number) => vitesse * (0.12 + 1.88 * borner(p, 0, 1) ** 2);

/** Part de croisière du défilement automatique. */
export const PART_AUTO = 0.35;

/** Constante de temps (s) d'une inertie entre 0 et 1. */
export const tauDe = (inertie: number) => 0.06 + borner(inertie, 0, 1) * 1.1;

/** Rapproche x de la cible, indépendamment de la cadence (amortissement exponentiel). */
export const amortir = (x: number, cible: number, dt: number, tau: number) => cible + (x - cible) * Math.exp(-Math.max(0, dt) / Math.max(1e-3, tau));

/** Décalage RVB (px, dans le repère du panneau) pour une vitesse : proportionnel, plafonné. */
export const aberrationPx = (v: number, force: number, max = 10) => (force > 0 ? Math.min(max, Math.abs(v) * force * 4) : 0);

/** Flou de mouvement (écart type, px) pour une vitesse. */
export const flouPx = (v: number, force: number, max = 10) => (force > 0 ? Math.min(max, Math.abs(v) * force * 3) : 0);

/** Opacité au fond du mur : fondu sur les derniers panneaux quand le mur est plafonné avant le bord de l'écran. */
export const fonduFond = (d: number, dFin: number) => borner((dFin - d) / 2, 0, 1);

/** Nombre de panneaux par mur, au plus. */
export const PANNEAUX_MAX = 44;

/* ================================================================ DOM */

const NS = "http://www.w3.org/2000/svg";
/** Taille de l'élément d'un panneau, en px (côté « hauteur ») : la matrice le met à l'échelle. */
const K = 560;

const FEUILLE = `
.couloir { position: relative; overflow: hidden; display: block; margin: 0; padding: 0; list-style: none;
  contain: layout paint style; background: var(--couloir-fond, transparent); touch-action: pan-y;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.couloir.couloir-plafond { touch-action: pan-x; }
.couloir.couloir-glisse { cursor: grabbing; }
.couloir > .couloir-panneau { position: absolute; left: 0; top: 0; margin: 0; padding: 0; box-sizing: border-box;
  width: var(--couloir-w); height: var(--couloir-h); transform-origin: 0 0; overflow: hidden; visibility: hidden;
  background: var(--couloir-filet, #fff); backface-visibility: hidden; list-style: none; }
.couloir-contenu { display: block; width: 100%; height: 100%; margin: 0; padding: 0; transform-origin: var(--couloir-origine, 0 0);
  color: inherit; text-decoration: none; border: 0; background: none; font: inherit; cursor: inherit; }
.couloir-contenu img, img.couloir-contenu { display: block; width: 100%; height: 100%; object-fit: cover; -webkit-user-drag: none; }
.couloir-contenu > figure, .couloir-contenu > a, .couloir-contenu > button { display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; }
.couloir-panneau figcaption, .couloir-panneau .couloir-cache { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.couloir > .couloir-vide { background: var(--couloir-vide, color-mix(in srgb, var(--couloir-filet, #fff) 55%, #c9ccc6)); }
.couloir-ouvrable .couloir-panneau:not(.couloir-vide) { cursor: zoom-in; }
.couloir .couloir-cible:focus { outline: none; }
.couloir .couloir-cible:focus-visible { outline: 4px solid var(--couloir-focus, #1d4ed8); outline-offset: -4px; }
.couloir-commandes { position: relative; z-index: 3; display: flex; gap: 8px; width: max-content; height: 0;
  margin: 0 0 0 max(16px, env(safe-area-inset-left)); transform: translateY(calc(-100% - 16px)); align-items: end; }
.couloir-commandes button { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border-radius: 50%;
  border: 1px solid color-mix(in srgb, currentColor 35%, transparent); color: inherit; cursor: pointer;
  background: color-mix(in srgb, var(--couloir-fond-commandes, #fff) 82%, transparent); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.couloir-commandes button:hover { background: color-mix(in srgb, var(--couloir-fond-commandes, #fff) 96%, transparent); }
.couloir-commandes button:focus-visible { outline: 3px solid var(--couloir-focus, #1d4ed8); outline-offset: 2px; }
.couloir-commandes svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.couloir-commandes [hidden] { display: none !important; }
.couloir-dialogue { max-width: min(92vw, 1100px); max-height: 92vh; padding: 0; border: 0; background: #111; color: #f2f2f2; }
.couloir-dialogue::backdrop { background: rgba(10, 10, 12, 0.82); }
.couloir-dialogue img { display: block; max-width: 100%; max-height: calc(92vh - 56px); object-fit: contain; }
.couloir-dialogue p { margin: 0; padding: 10px 56px 12px 14px; font-size: 14px; }
.couloir-dialogue button { position: absolute; top: 6px; right: 6px; width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgba(0,0,0,.5); color: inherit; font-size: 20px; cursor: pointer; }
`;

const ICONES = {
  precedent: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`,
  suivant: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>`,
  lecture: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>`,
};

let cssPose = false;
let compteur = 0;
const reduitQ = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const FOCALISABLE = "a[href], button, [tabindex]:not([tabindex='-1']), input, select, textarea";

export interface ControleCouloir {
  aller(index: number, immediat?: boolean): void;
  suivant(): void;
  precedent(): void;
  /** Sans argument : bascule. Rend l'état. */
  pause(oui?: boolean): boolean;
  /** Relit les attributs data-couloir-* et rebâtit. */
  regler(): void;
  reglages(): Reglages;
  index(): number;
  /** Pour les essais : position et vitesse courantes. */
  etat(): { decalage: number; vitesse: number; actif: boolean; panneaux: number };
  detruire(): void;
}

const controles = new WeakMap<HTMLElement, ControleCouloir>();
export const controleCouloir = (el: HTMLElement) => controles.get(el) ?? null;

interface Panneau {
  el: HTMLElement;
  contenu: HTMLElement | null;
  /** Rang de l'image (−1 : vide). */
  rang: number;
  mur: number;
  j: number;
  // Ce qui est déjà écrit (on n'écrit que ce qui change).
  tf: string;
  ct: string;
  vu: boolean;
  op: string;
  fi: string;
}

export function couloir(root: HTMLElement): ControleCouloir | null {
  // Les panneaux d'origine : chaque enfant (un <li> garde sa place ; un autre élément est enveloppé).
  const enfants = [...root.children].filter((c) => !c.classList.contains("couloir-commandes")) as HTMLElement[];
  if (!enfants.length) return null;
  const id = `couloir-${++compteur}`;
  const estListe = root.tagName === "UL" || root.tagName === "OL";
  root.classList.add("couloir");
  root.setAttribute("role", "list");
  if (!root.hasAttribute("aria-roledescription")) root.setAttribute("aria-roledescription", "couloir d'images");

  const originaux: { el: HTMLElement; contenu: HTMLElement; cible: HTMLElement }[] = enfants.map((c) => {
    let panneau: HTMLElement, contenu: HTMLElement;
    if (estListe && c.tagName === "LI") {
      panneau = c;
      if (c.children.length === 1 && c.firstElementChild instanceof HTMLElement) contenu = c.firstElementChild;
      else {
        contenu = document.createElement("div");
        contenu.append(...c.childNodes);
        c.append(contenu);
      }
    } else {
      panneau = document.createElement("div");
      root.insertBefore(panneau, c);
      panneau.append(c);
      contenu = c;
    }
    panneau.classList.add("couloir-panneau");
    if (panneau.tagName !== "LI") panneau.setAttribute("role", "listitem");
    contenu.classList.add("couloir-contenu");
    for (const im of panneau.querySelectorAll("img")) {
      im.decoding = "async";
      im.draggable = false;
    }
    const f = contenu.matches(FOCALISABLE) ? contenu : panneau.querySelector<HTMLElement>(FOCALISABLE);
    const cible = f ?? panneau;
    cible.classList.add("couloir-cible");
    return { el: panneau, contenu, cible };
  });
  const n = originaux.length;

  // Les filtres d'aberration : deux intensités (premier plan, second plan).
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
  const filtre = (suffixe: string) => {
    const f = document.createElementNS(NS, "filter");
    f.id = `${id}-${suffixe}`;
    f.setAttribute("x", "-6%");
    f.setAttribute("y", "-6%");
    f.setAttribute("width", "112%");
    f.setAttribute("height", "112%");
    f.setAttribute("color-interpolation-filters", "sRGB");
    f.innerHTML = `<feGaussianBlur in="SourceGraphic" stdDeviation="0 0" result="f"/>
      <feColorMatrix in="f" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feOffset in="r" dx="0" dy="0" result="r2"/>
      <feColorMatrix in="f" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="f" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
      <feOffset in="b" dx="0" dy="0" result="b2"/>
      <feBlend in="r2" in2="g" mode="screen" result="rg"/>
      <feBlend in="rg" in2="b2" mode="screen"/>`;
    svg.append(f);
    const [flou, , o1, , , o2] = [...f.children] as SVGElement[];
    return { flou: flou!, r: o1!, b: o2!, ecrit: "" };
  };
  const filtres = [filtre("a"), filtre("b")];
  document.body.append(svg);

  // Les commandes.
  let commandes: HTMLElement | null = null;
  const btnPrec = document.createElement("button");
  const btnSuiv = document.createElement("button");
  const btnPause = document.createElement("button");
  for (const [b, label, icone] of [[btnPrec, "Image précédente", ICONES.precedent], [btnSuiv, "Image suivante", ICONES.suivant], [btnPause, "Mettre en pause le défilement", ICONES.pause]] as const) {
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.innerHTML = icone;
  }
  btnPause.setAttribute("aria-pressed", "false");
  const destCommandes = root.dataset.couloirCommandes?.trim();
  if (destCommandes !== "non") {
    commandes = document.createElement("div");
    commandes.className = "couloir-commandes";
    commandes.setAttribute("role", "group");
    commandes.setAttribute("aria-label", `Commandes : ${root.getAttribute("aria-label") ?? "couloir d'images"}`);
    commandes.append(btnPrec, btnSuiv, btnPause);
    const ailleurs = destCommandes && destCommandes.startsWith("#") ? document.querySelector<HTMLElement>(destCommandes) : null;
    if (ailleurs) {
      commandes.style.transform = "none";
      commandes.style.height = "auto";
      commandes.style.margin = "0";
      ailleurs.append(commandes);
    } else root.after(commandes);
  }

  // État.
  let r = lireReglages(root.dataset);
  let g = geometrie(r, root.clientWidth, root.clientHeight);
  let reduit = reduitQ();
  let panneaux: Panneau[] = [];
  let seq: number[] = [];
  let M = 0;
  let dFin = Infinity;
  let decalage = 0, v = 0, glisse: number | null = null;
  let pointeurP: number | null = null;
  let enPause = false;
  let visible = true;
  let raf = 0, dernier = 0;
  let tete = -1;
  let survole: HTMLElement | null = null;
  const survols = new Map<HTMLElement, number>();
  let tirage: { id: number; u: number; t: number; d: number; vit: number; parti: boolean; x: number; y: number } | null = null;
  let annulerClic = false;
  let largeurPx = 0, hauteurPx = 0;

  const pilote = (p: Pilotage) => r.pilotage.includes(p) && !(reduit && (p === "pointeur" || p === "auto"));
  const premierPlan = (d: number) => d < 1.15;

  const construire = () => {
    for (const p of panneaux) if (p.el.classList.contains("couloir-copie") || p.el.classList.contains("couloir-vide")) p.el.remove();
    for (const o of originaux) {
      o.el.style.transform = "";
      o.el.style.visibility = "";
      o.el.style.opacity = "";
      o.el.style.filter = "";
    }
    largeurPx = root.clientWidth;
    hauteurPx = root.clientHeight;
    g = geometrie(r, largeurPx, hauteurPx);
    const utiles = panneauxUtiles(g, 400);
    const besoin = Math.min(PANNEAUX_MAX, utiles + 2);
    dFin = utiles + 2 > PANNEAUX_MAX ? PANNEAUX_MAX - 2.5 : Infinity;
    seq = sequence(n, r.vide, besoin, r.sansfin, n);
    M = seq.length;
    const plafond = r.mode === "plafond";
    root.classList.toggle("couloir-plafond", plafond);
    root.classList.toggle("couloir-ouvrable", r.ouvre === "visionneuse");
    root.style.setProperty("--couloir-w", `${plafond ? K : Math.round(K * r.largeur)}px`);
    root.style.setProperty("--couloir-h", `${plafond ? Math.round(K * r.largeur) : K}px`);
    root.style.setProperty("--couloir-filet", r.filet);
    if (r.fond) root.style.setProperty("--couloir-fond", r.fond);
    else root.style.removeProperty("--couloir-fond");
    // L'image se contracte vers son bord proche ; le filet reste au bord lointain.
    root.style.setProperty("--couloir-origine", plafond ? (r.cote === "droite" ? "50% 100%" : "50% 0") : r.cote === "droite" ? "0 50%" : "100% 50%");
    const deja = new Set<number>();
    panneaux = [];
    for (let mur = 0; mur < g.murs; mur++) {
      seq.forEach((rang, j) => {
        let el: HTMLElement;
        let contenu: HTMLElement | null = null;
        if (rang < 0) {
          el = document.createElement(estListe ? "li" : "div");
          el.className = "couloir-panneau couloir-vide";
          el.setAttribute("aria-hidden", "true");
          el.setAttribute("role", "presentation");
        } else if (mur === 0 && !deja.has(rang)) {
          deja.add(rang);
          el = originaux[rang]!.el;
          contenu = originaux[rang]!.contenu;
        } else {
          el = originaux[rang]!.el.cloneNode(true) as HTMLElement;
          el.classList.add("couloir-copie");
          el.setAttribute("aria-hidden", "true");
          el.setAttribute("role", "presentation");
          el.removeAttribute("id");
          for (const x of el.querySelectorAll("[id]")) x.removeAttribute("id");
          for (const x of el.querySelectorAll<HTMLElement>(".couloir-cible, a[href], button, [tabindex]")) {
            x.tabIndex = -1;
            x.classList.remove("couloir-cible");
          }
          el.classList.remove("couloir-cible");
          if (el.hasAttribute("tabindex")) el.tabIndex = -1;
          contenu = el.querySelector<HTMLElement>(".couloir-contenu");
        }
        if (el.classList.contains("couloir-copie") || rang < 0) root.append(el);
        panneaux.push({ el, contenu, rang, mur, j, tf: "", ct: "", vu: false, op: "", fi: "" });
      });
    }
    for (const p of panneaux) p.el.style.visibility = "hidden";
    if (!r.sansfin) decalage = borner(decalage, 0, Math.max(0, M - 1));
    commandesEtat();
    peindre();
    reveiller();
  };

  /** Le rang (dans seq) le plus proche de la tête. */
  const rangEnTete = () => {
    let best = -1, bd = Infinity;
    for (let j = 0; j < M; j++) {
      if (seq[j]! < 0) continue;
      const d = profondeurDe(j, decalage, M, r.sansfin);
      const e = Math.abs(d - 0) + (d < -0.5 ? 0.6 : 0);
      if (e < bd) {
        bd = e;
        best = j;
      }
    }
    return best;
  };

  const peindre = () => {
    const echelleAb = reduit ? 0 : aberrationPx(v, r.aberration);
    const echelleFl = reduit ? 0 : flouPx(v, r.flou);
    const actifFiltre = echelleAb > 0.35 || echelleFl > 0.35;
    // Les filtres : décalages quantifiés au quart de pixel, écrits seulement s'ils changent.
    filtres.forEach((f, k) => {
      const q = (x: number) => Math.round(x * (k === 0 ? 1 : 0.45) * 4) / 4;
      const a = q(echelleAb), fl = q(echelleFl);
      const plaf = r.mode === "plafond";
      const signe = r.sens * (r.cote === "droite" ? 1 : -1) * (plaf ? -1 : 1);
      const cle = `${a}|${fl}|${plaf}|${signe}`;
      if (cle === f.ecrit) return;
      f.ecrit = cle;
      f.flou.setAttribute("stdDeviation", plaf ? `0 ${fl}` : `${fl} 0`);
      for (const [o, s] of [[f.r, 1], [f.b, -1]] as const) {
        o.setAttribute(plaf ? "dy" : "dx", String(a * s * signe));
        o.setAttribute(plaf ? "dx" : "dy", "0");
      }
    });
    const w = r.mode === "plafond" ? K : K * r.largeur;
    const h = r.mode === "plafond" ? K * r.largeur : K;
    for (const p of panneaux) {
      // Les autres murs montrent la même rangée, déphasée (pas la même image en face).
      const dd = profondeurDe(p.mur === 0 || !r.sansfin ? p.j : p.j + Math.round((M * p.mur) / g.murs) + 1, decalage, M, r.sansfin);
      const op = dFin === Infinity ? 1 : fonduFond(dd, dFin);
      const agr = 1 + (survols.get(p.el) ?? 0) * r.survol;
      const pose = poser(dd, p.mur, g, agr);
      const vu = op > 0.01 && pose.uLoin > -1 && pose.uProche < g.L + 1 && dd > -2.2;
      if (vu !== p.vu) {
        p.vu = vu;
        p.el.style.visibility = vu ? "visible" : "hidden";
      }
      if (!vu) {
        if (p.fi) p.el.style.filter = p.fi = "";
        continue;
      }
      const m = matrice3d(carreVersQuad(...pose.quad), w, h);
      const tf = `matrix3d(${m.map((x) => (Math.abs(x) < 1e-12 ? 0 : +x.toPrecision(7))).join(",")})`;
      if (tf !== p.tf) {
        p.tf = tf;
        p.el.style.transform = tf;
      }
      if (p.contenu) {
        const part = Math.round(pose.part * 2000) / 2000;
        const ct = part >= 0.9995 ? "" : r.mode === "plafond" ? `scale(1,${part})` : `scale(${part},1)`;
        if (ct !== p.ct) {
          p.ct = ct;
          p.contenu.style.transform = ct;
        }
      }
      const ops = op >= 0.999 ? "" : op.toFixed(3);
      if (ops !== p.op) {
        p.op = ops;
        p.el.style.opacity = ops;
      }
      const fi = actifFiltre && p.rang >= 0 ? (premierPlan(dd) ? `url(#${id}-a)` : dd < 3 ? `url(#${id}-b)` : "") : "";
      if (fi !== p.fi) {
        p.fi = fi;
        p.el.style.filter = fi;
      }
      const z = survole === p.el ? "5" : "";
      if (p.el.style.zIndex !== z) p.el.style.zIndex = z;
    }
    const j = rangEnTete();
    const i = j >= 0 ? seq[j]! : -1;
    if (i !== tete && i >= 0) {
      tete = i;
      root.dispatchEvent(new CustomEvent("couloir:change", { detail: { index: i } }));
    }
  };

  const vitesseCible = () => {
    if (enPause || tirage?.parti) return 0;
    if (pilote("pointeur") && pointeurP != null) return vitessePointeur(pointeurP, r.vitesse);
    if (pilote("auto") && visible) return r.vitesse * PART_AUTO;
    return 0;
  };

  const actif = () => {
    if (!visible || document.hidden) return false;
    if (glisse != null || tirage?.parti) return true;
    if (Math.abs(v) > 0.002 || Math.abs(vitesseCible()) > 0.002) return true;
    for (const [el, x] of survols) if (Math.abs(x - (el === survole ? 1 : 0)) > 0.002) return true;
    return false;
  };

  const image = (t: number) => {
    raf = 0;
    const dt = dernier ? Math.min(0.05, (t - dernier) / 1000) : 1 / 60;
    dernier = t;
    if (glisse != null) {
      decalage = amortir(decalage, glisse, dt, reduit ? 0.001 : 0.16);
      v = 0;
      if (Math.abs(decalage - glisse) < 0.0015) {
        decalage = glisse;
        glisse = null;
      }
    } else if (!tirage?.parti) {
      // En pause, on freine franchement (l'inertie ne doit pas faire attendre le repos).
      v = amortir(v, vitesseCible(), dt, enPause ? Math.min(0.25, tauDe(r.inertie)) : tauDe(r.inertie));
      if (Math.abs(v) < 0.002 && Math.abs(vitesseCible()) < 0.002) v = 0;
      decalage += v * r.sens * dt;
    }
    if (!r.sansfin) {
      const b = borner(decalage, 0, Math.max(0, M - 1));
      if (b !== decalage) {
        decalage = b;
        v = 0;
      }
    } else if (Math.abs(decalage) > M * 1000) decalage = ((decalage % M) + M) % M;
    for (const [el, x] of survols) {
      const c = el === survole ? 1 : 0;
      const nx = amortir(x, c, dt, 0.14);
      if (Math.abs(nx - c) < 0.002 && c === 0) survols.delete(el);
      else survols.set(el, Math.abs(nx - c) < 0.002 ? c : nx);
    }
    peindre();
    const encore = actif();
    root.classList.toggle("couloir-bouge", encore);
    if (encore) raf = requestAnimationFrame(image);
    else {
      dernier = 0;
      // Au repos : un dernier rendu sans franges.
      if (v === 0) peindre();
    }
  };

  const reveiller = () => {
    if (!raf && actif()) {
      dernier = 0;
      root.classList.add("couloir-bouge");
      raf = requestAnimationFrame(image);
    }
  };

  /** Va au panneau de rang i (dans l'ordre des images). */
  const aller = (i: number, immediat = false) => {
    if (!M) return;
    const k = ((i % n) + n) % n;
    let best = decalage, be = Infinity;
    for (let j = 0; j < M; j++) {
      if (seq[j] !== k) continue;
      const e = r.sansfin ? ecartBoucle(decalage, j, M) : j - decalage;
      if (Math.abs(e) < Math.abs(be)) {
        be = e;
        best = decalage + e;
      }
    }
    v = 0;
    if (immediat || reduit) {
      // Mouvement réduit : un fondu court, pas un glissement.
      if (reduit && !immediat && typeof root.animate === "function") root.animate([{ opacity: 1 }, { opacity: 0.35, offset: 0.4 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
      glisse = null;
      decalage = best;
      peindre();
    } else {
      glisse = best;
      reveiller();
    }
  };
  const suivant = () => aller(tete + 1);
  const precedent = () => aller(tete - 1);
  const pause = (oui?: boolean) => {
    enPause = oui ?? !enPause;
    btnPause.setAttribute("aria-pressed", String(enPause));
    const l = enPause ? "Reprendre le défilement" : "Mettre en pause le défilement";
    btnPause.setAttribute("aria-label", l);
    btnPause.title = l;
    btnPause.innerHTML = enPause ? ICONES.lecture : ICONES.pause;
    reveiller();
    return enPause;
  };
  const commandesEtat = () => {
    btnPause.hidden = reduit || !(r.pilotage.includes("auto") || r.pilotage.includes("pointeur"));
  };
  btnPrec.addEventListener("click", precedent);
  btnSuiv.addEventListener("click", suivant);
  btnPause.addEventListener("click", () => pause());

  /* ------------------------------------------------ entrées */

  const local = (e: { clientX: number; clientY: number }) => {
    const b = root.getBoundingClientRect();
    return versLocal(e.clientX - b.left, e.clientY - b.top, g);
  };
  const panneauSous = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>(".couloir-panneau") : null);

  const surMouvement = (e: PointerEvent) => {
    const [u] = local(e);
    if (e.pointerType === "mouse") {
      const avant = pointeurP;
      pointeurP = borner(u / g.L, 0, 1);
      // Le mouvement compte aussi : pousser vers le fond accélère.
      if (avant != null && pilote("pointeur") && !tirage?.parti) v += (pointeurP - avant) * r.vitesse * 3;
    }
    const s = panneauSous(e.target);
    const nouveau = r.survol > 0 && s && !s.classList.contains("couloir-vide") && !tirage?.parti ? s : null;
    if (nouveau !== survole) {
      survole = nouveau;
      if (nouveau && !survols.has(nouveau)) survols.set(nouveau, 0);
    }
    if (tirage && e.pointerId === tirage.id) {
      const dx = e.clientX - tirage.x, dy = e.clientY - tirage.y;
      const long = r.mode === "plafond" ? Math.abs(dy) : Math.abs(dx);
      const travers = r.mode === "plafond" ? Math.abs(dx) : Math.abs(dy);
      if (!tirage.parti && long > 6 && long > travers) {
        tirage.parti = true;
        annulerClic = true;
        root.classList.add("couloir-glisse");
        try {
          root.setPointerCapture(e.pointerId);
        } catch {
          /* pointeur déjà relâché */
        }
        glisse = null;
      }
      if (tirage.parti) {
        const du = u - tirage.u;
        const pas = pasDe(borner(dDeU(u, g), -1, 60), g);
        const dd = -du / pas;
        decalage += dd;
        const now = performance.now();
        const dt = Math.max(1, now - tirage.t) / 1000;
        tirage.vit = 0.7 * tirage.vit + 0.3 * (dd / dt);
        tirage.t = now;
        tirage.u = u;
        if (!r.sansfin) decalage = borner(decalage, 0, Math.max(0, M - 1));
        peindre();
      }
    }
    reveiller();
  };
  const surSortie = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && !tirage?.parti) pointeurP = null;
    survole = null;
    reveiller();
  };
  const surAppui = (e: PointerEvent) => {
    if (!pilote("glisser") || e.button !== 0) return;
    const [u] = local(e);
    tirage = { id: e.pointerId, u, t: performance.now(), d: decalage, vit: 0, parti: false, x: e.clientX, y: e.clientY };
    annulerClic = false;
  };
  const surRelache = (e: PointerEvent) => {
    if (!tirage || e.pointerId !== tirage.id) return;
    if (tirage.parti) {
      v = borner(tirage.vit, -8, 8) * r.sens;
      root.classList.remove("couloir-glisse");
      try {
        root.releasePointerCapture(e.pointerId);
      } catch {
        /* déjà libre */
      }
    }
    tirage = null;
    if (e.pointerType !== "mouse") pointeurP = null;
    reveiller();
  };
  const surMolette = (e: WheelEvent) => {
    if (!pilote("molette")) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!delta) return;
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? g.C : 1;
    v = borner(v + (delta * k * 0.006) * r.sens, -10, 10);
    glisse = null;
    reveiller();
  };
  let dernierY = typeof scrollY === "number" ? scrollY : 0;
  const surDefilement = () => {
    const y = scrollY;
    const dy = y - dernierY;
    dernierY = y;
    if (!pilote("defilement") || !visible || !dy) return;
    v = borner(v + (dy / Math.max(200, g.C)) * 4 * r.sens, -10, 10);
    glisse = null;
    reveiller();
  };
  const surClic = (e: MouseEvent) => {
    if (annulerClic) {
      annulerClic = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (r.ouvre !== "visionneuse") return;
    const p = panneauSous(e.target);
    if (!p || p.classList.contains("couloir-vide")) return;
    const pan = panneaux.find((x) => x.el === p);
    if (!pan || pan.rang < 0) return;
    e.preventDefault();
    e.stopPropagation();
    void ouvrir(pan.rang);
  };
  const ouvrir = async (i: number) => {
    const sel = ":scope > .couloir-panneau:not(.couloir-copie):not(.couloir-vide) img";
    try {
      const m = await import("./lightbox.ts");
      await m.openLightbox(root, i, sel);
    } catch {
      dialogueSimple(originaux[i]!.el.querySelector("img"));
    }
  };
  const surTouche = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const p = panneauSous(e.target);
    if (!p || r.ouvre !== "visionneuse" || (e.target as HTMLElement).matches("a[href], button")) return;
    const i = originaux.findIndex((o) => o.el === p);
    if (i < 0) return;
    e.preventDefault();
    void ouvrir(i);
  };
  const surFocus = (e: FocusEvent) => {
    const p = panneauSous(e.target);
    const i = originaux.findIndex((o) => o.el === p);
    if (i < 0) return;
    // Le panneau reçoit le focus : il vient au premier plan (le défilement automatique cède).
    if (i !== tete || Math.abs(profondeurDe(panneaux.find((x) => x.el === p)!.j, decalage, M, r.sansfin)) > 0.6) aller(i);
    root.scrollLeft = 0;
    root.scrollTop = 0;
  };

  root.addEventListener("pointermove", surMouvement, { passive: true });
  root.addEventListener("pointerleave", surSortie, { passive: true });
  root.addEventListener("pointerdown", surAppui, { passive: true });
  root.addEventListener("pointerup", surRelache, { passive: true });
  root.addEventListener("pointercancel", surRelache, { passive: true });
  root.addEventListener("wheel", surMolette, { passive: false });
  root.addEventListener("click", surClic, true);
  root.addEventListener("keydown", surTouche);
  root.addEventListener("focusin", surFocus);
  root.addEventListener("dragstart", (e) => e.preventDefault());
  addEventListener("scroll", surDefilement, { passive: true });

  // Le clavier : un seul arrêt de Tab, flèches, Début / Fin (comportement partagé).
  let focusIt: { detruire(): void } | null = null;
  void import("./comportements/focus-itinerant.ts").then(({ creerFocusItinerant }) => {
    if (detruit) return;
    focusIt = creerFocusItinerant(root, {
      elements: ":scope > .couloir-panneau:not(.couloir-copie) .couloir-cible, :scope > .couloir-panneau.couloir-cible:not(.couloir-copie)",
      orientation: r.mode === "plafond" ? "les-deux" : "horizontal",
      boucle: r.sansfin,
      cle: (el) => String(originaux.findIndex((o) => o.cible === el)),
      surDeplacement: (_el, i) => aller(i),
    });
  });

  const ro = new ResizeObserver(() => {
    if (root.clientWidth === largeurPx && root.clientHeight === hauteurPx) return;
    construire();
  });
  ro.observe(root);
  const io = new IntersectionObserver((es) => {
    visible = es[es.length - 1]!.isIntersecting;
    if (visible) reveiller();
  });
  io.observe(root);
  const surVisibilite = () => {
    if (!document.hidden) reveiller();
  };
  document.addEventListener("visibilitychange", surVisibilite);
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const surReduit = () => {
    reduit = reduitQ();
    commandesEtat();
    peindre();
    reveiller();
  };
  mq?.addEventListener("change", surReduit);

  let detruit = false;
  const ctl: ControleCouloir = {
    aller,
    suivant,
    precedent,
    pause,
    regler: () => {
      const avant = r.mode + r.sansfin;
      r = lireReglages(root.dataset);
      construire();
      if (avant !== r.mode + r.sansfin) {
        focusIt?.detruire();
        focusIt = null;
        void import("./comportements/focus-itinerant.ts").then(({ creerFocusItinerant }) => {
          if (detruit) return;
          focusIt = creerFocusItinerant(root, {
            elements: ":scope > .couloir-panneau:not(.couloir-copie) .couloir-cible, :scope > .couloir-panneau.couloir-cible:not(.couloir-copie)",
            orientation: r.mode === "plafond" ? "les-deux" : "horizontal",
            boucle: r.sansfin,
            cle: (el) => String(originaux.findIndex((o) => o.cible === el)),
            surDeplacement: (_el, i) => aller(i),
          });
        });
      }
    },
    reglages: () => ({ ...r, pilotage: [...r.pilotage] }),
    index: () => tete,
    etat: () => ({ decalage, vitesse: v, actif: raf !== 0, panneaux: panneaux.length }),
    detruire: () => {
      detruit = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      focusIt?.detruire();
      mq?.removeEventListener("change", surReduit);
      document.removeEventListener("visibilitychange", surVisibilite);
      removeEventListener("scroll", surDefilement);
      root.removeEventListener("pointermove", surMouvement);
      root.removeEventListener("pointerleave", surSortie);
      root.removeEventListener("pointerdown", surAppui);
      root.removeEventListener("pointerup", surRelache);
      root.removeEventListener("pointercancel", surRelache);
      root.removeEventListener("wheel", surMolette);
      root.removeEventListener("click", surClic, true);
      root.removeEventListener("keydown", surTouche);
      root.removeEventListener("focusin", surFocus);
      for (const p of panneaux) if (p.el.classList.contains("couloir-copie") || p.el.classList.contains("couloir-vide")) p.el.remove();
      svg.remove();
      commandes?.remove();
      controles.delete(root);
    },
  };
  controles.set(root, ctl);
  construire();
  return ctl;
}

/** Un dialogue simple, si la visionneuse ne se charge pas. */
function dialogueSimple(img: HTMLImageElement | null) {
  if (!img) return;
  const d = document.createElement("dialog");
  d.className = "couloir-dialogue";
  d.setAttribute("aria-label", img.alt || "Image");
  const grand = document.createElement("img");
  grand.src = img.currentSrc || img.src;
  grand.alt = img.alt;
  const p = document.createElement("p");
  p.textContent = img.alt;
  const f = document.createElement("button");
  f.type = "button";
  f.setAttribute("aria-label", "Fermer");
  f.textContent = "✕";
  f.addEventListener("click", () => d.close());
  d.append(grand, p, f);
  d.addEventListener("close", () => d.remove());
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
  document.body.append(d);
  d.showModal();
}

/** Arme tous les [data-couloir] de la page. */
export function initCouloir(root: ParentNode = document): Map<HTMLElement, ControleCouloir> {
  const out = new Map<HTMLElement, ControleCouloir>();
  if (typeof document === "undefined") return out;
  if (!cssPose) {
    const s = document.createElement("style");
    s.dataset.presse = "couloir";
    s.textContent = FEUILLE;
    document.head.prepend(s);
    cssPose = true;
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-couloir]")) {
    const deja = controles.get(el);
    if (deja) {
      out.set(el, deja);
      continue;
    }
    const c = couloir(el);
    if (c) out.set(el, c);
  }
  return out;
}
