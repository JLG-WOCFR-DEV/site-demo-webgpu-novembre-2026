/**
 * Presse — la voix (« voice glow ») : une lueur colorée monte du bas d'un champ de saisie, ou de tout un écran, quand
 * on parle ; elle suit le niveau de la voix et sa couleur (graves à gauche, aigus à droite). Pendant que la réponse
 * se prépare, un lobe plus étroit balaie le champ d'un bord à l'autre, avec une traîne.
 *
 *   <div data-voix data-voix-palette="aurore" data-voix-auto="reflexion 2.5">
 *     <textarea placeholder="Parlez, ou écrivez…"></textarea>
 *     <button type="button" data-voix-micro aria-label="Parler">…</button>
 *   </div>
 *
 * États (data-voix-etat, tenu à jour par le module ; la page peut aussi l'écrire) :
 *   repos      rien (ou une braise, data-voix-braise) ; aucune image calculée une fois la lueur éteinte ;
 *   ecoute     micro ouvert (ou flux branché, ou démonstration) : la lueur monte avec le niveau de la voix ;
 *   reflexion  balayage gauche ↔ droite, régulier, sans micro ;
 *   parole     la lueur suit un flux de sortie branché par la page (la voix de la réponse).
 * Tout passage d'un état à l'autre est fondu par des ressorts. Quitter « ecoute » referme le micro.
 *
 * Attributs : data-voix (« ecran » : la lueur monte du bas de tout le conteneur), data-voix-palette (aurore, ocean,
 * braise, mono), data-voix-couleur (teinte de « mono »), data-voix-force (0–2, 1), data-voix-hauteur (0–1, 0.9 ;
 * 0.6 en écran), data-voix-debord (px, 24 ; 0 en écran), data-voix-fond (clair, sombre ; deviné sinon),
 * data-voix-auto (« reflexion 2.5 [1.2] » : après 1,2 s de silence en écoute, réflexion 2,5 s puis repos),
 * data-voix-demo (sans micro, un niveau synthétique crédible), data-voix-braise (une braise au repos).
 *
 * JS : initVoix(root?) arme les [data-voix] présents et à venir ; voix(el) → { ecouter, arreter, etat, niveau,
 * brancher, demo, detruire }. Événements DOM : voix:etat { etat, precedent, cause }, voix:niveau { niveau, bandes }
 * (au plus ~15 par seconde).
 *
 * VIE PRIVÉE : le micro n'est demandé qu'au clic sur [data-voix-micro] (ou par ecouter()). Le son est analysé sur
 * place, image par image (un niveau et quatre bandes de fréquence), puis oublié : il n'est jamais enregistré, ni
 * stocké, ni envoyé où que ce soit. Arrêter coupe les pistes du micro et ferme le contexte audio.
 *
 * Rendu : un canvas WebGPU sous le contenu du conteneur (appareil partagé, un canvas par composant), shader original
 * (nappes de couleur déformées par un bruit lent, liseré sur le bord bas, halo débordant). Sur fond clair, la lueur se
 * compose en « multiplier » (elle teinte le papier sans jamais l'éclaircir) ; sur fond sombre, elle éclaire. Sans
 * WebGPU : un dégradé CSS piloté par --voix-niveau, --voix-x et --voix-opacite. Mouvement réduit : ni ondulation ni
 * balayage, le niveau reste lisible (lissé lentement), la réflexion devient une lente pulsation d'opacité.
 */
import { getDevice, onDeviceLost } from "../components/device.ts";
import { springStep, type Spring } from "./tokens.ts";

/* ───────────────────────── Partie pure (testée sans DOM) ───────────────────────── */

export type Etat = "repos" | "ecoute" | "reflexion" | "parole";
export const ETATS: readonly Etat[] = ["repos", "ecoute", "reflexion", "parole"];
export const estEtat = (s: unknown): s is Etat => typeof s === "string" && (ETATS as readonly string[]).includes(s);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Enveloppe à deux vitesses : attaque rapide quand le signal monte, relâchement lent quand il descend (constantes en s). */
export function enveloppe(prec: number, x: number, dt: number, attaque: number, relache: number): number {
  const tau = x > prec ? attaque : relache;
  return prec + (x - prec) * (1 - Math.exp(-dt / Math.max(1e-4, tau)));
}

/** Niveau efficace (RMS) d'un bloc d'échantillons, en dB (−140 dB pour un silence numérique). */
export function rmsDb(buf: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i]!;
    s += v * v;
  }
  const rms = Math.sqrt(s / Math.max(1, buf.length));
  return 20 * Math.log10(Math.max(1e-7, rms));
}

/** Du dB au niveau 0–1, au-dessus du plancher : marge (dB) sous laquelle rien ne s'allume, plage (dB) jusqu'au plein. */
export function niveauDepuisDb(db: number, plancher: number, marge = 9, plage = 30): number {
  const x = clamp((db - plancher - marge) / plage, 0, 1);
  return Math.pow(x, 0.85);
}

/**
 * Plancher de bruit adaptatif (en dB), par « statistiques de minimum » : on garde le minimum du signal sur une fenêtre
 * glissante d'environ 2 s (8 tranches de 0,25 s). La parole a toujours des creux entre syllabes, le souffle ambiant
 * n'en a pas : ce minimum, c'est le bruit. Le plancher descend vite vers un signal plus faible que lui (0,35 s), monte
 * vers ce minimum en ~0,6 s, et reste plafonné (une parole sans creux ne devient jamais « le bruit »).
 */
export class PlancherBruit {
  plancher: number;
  readonly plafond: number;
  private tranches = new Float32Array(8).fill(Infinity);
  private k = 0;
  private dansTranche = 0;
  private minTranche = Infinity;
  constructor(depart = -62, plafond = -30) {
    this.plancher = depart;
    this.plafond = plafond;
  }
  /** Un pas : le niveau 0–1 au-dessus du plancher (après mise à jour). */
  pas(db: number, dt: number): number {
    this.minTranche = Math.min(this.minTranche, db);
    this.dansTranche += dt;
    if (this.dansTranche >= 0.25) {
      this.tranches[this.k] = this.minTranche;
      this.k = (this.k + 1) % this.tranches.length;
      this.minTranche = Infinity;
      this.dansTranche = 0;
    }
    let m = this.minTranche;
    for (let i = 0; i < this.tranches.length; i++) m = Math.min(m, this.tranches[i]!);
    const f = this.plancher;
    if (db < f) this.plancher = f + (db - f) * (1 - Math.exp(-dt / 0.35));
    else if (m > f && Number.isFinite(m)) this.plancher = f + (Math.min(m, this.plafond) - f) * (1 - Math.exp(-dt / 0.6));
    this.plancher = clamp(this.plancher, -120, Math.max(this.plafond, f));
    return niveauDepuisDb(db, this.plancher);
  }
}

/** Bornes (Hz) des quatre bandes : graves, bas-médium, haut-médium, aigus. */
export const BORNES: readonly number[] = [80, 320, 1000, 3000, 8000];

/**
 * Découpe un spectre (dB par case, comme getFloatFrequencyData, fftSize/2 cases) en bandes 0–1 : puissance moyenne
 * de chaque bande, une pente compensée (+4 dB par bande : la voix s'affaiblit vers les aigus), ramenée sur 70 dB.
 * Écrit dans `out` (aucune allocation).
 */
export function bandes(spectreDb: ArrayLike<number>, frequenceEch: number, out: { length: number; [i: number]: number }, bornes: readonly number[] = BORNES) {
  const n = spectreDb.length;
  const hz = frequenceEch / (2 * n);
  for (let b = 0; b < bornes.length - 1 && b < out.length; b++) {
    const i0 = Math.max(0, Math.floor(bornes[b]! / hz));
    const i1 = Math.min(n, Math.max(i0 + 1, Math.ceil(bornes[b + 1]! / hz)));
    let p = 0;
    for (let i = i0; i < i1; i++) {
      const d = spectreDb[i]!;
      p += Number.isFinite(d) ? Math.pow(10, d / 10) : 0;
    }
    const db = 10 * Math.log10(Math.max(1e-14, p / Math.max(1, i1 - i0)));
    out[b] = clamp((db + 4 * b + 100) / 70, 0, 1);
  }
}

/** La répartition relative des bandes (la plus forte vaut 1), pour piloter la position et la largeur des nappes. */
export function repartition(b: ArrayLike<number>, out: { length: number; [i: number]: number }) {
  let m = 1e-3;
  for (let i = 0; i < b.length; i++) m = Math.max(m, b[i]!);
  for (let i = 0; i < b.length && i < out.length; i++) out[i] = clamp(b[i]! / m, 0, 1);
}

export type Auto = { etat: Etat; duree: number; silence: number };
/** Lit data-voix-auto : « reflexion 2.5 » ou « reflexion 2.5 1.2 » (état, durée, silence en s). */
export function lireAuto(s: string | null | undefined): Auto | null {
  if (s == null) return null;
  const [e = "reflexion", d, sil] = s.trim().split(/\s+/).filter(Boolean);
  if (!estEtat(e) || e === "ecoute") return null;
  const duree = Number.parseFloat(d ?? "");
  const silence = Number.parseFloat(sil ?? "");
  return { etat: e, duree: Number.isFinite(duree) && duree > 0 ? duree : 2.5, silence: Number.isFinite(silence) && silence > 0 ? silence : 1.2 };
}

/** Seuils (niveau brut 0–1) : au-dessus de PAROLE on parle ; sous SILENCE on se tait ; entre deux, rien ne change. */
export const SEUIL_PAROLE = 0.12;
export const SEUIL_SILENCE = 0.05;

/**
 * L'automate d'états. `aller` applique un état ; `pas` propose (sans l'appliquer) l'état suivant que l'automatisme
 * demande : réflexion après un silence qui suit une parole entendue, puis repos à la fin de la durée.
 */
export class Automate {
  etat: Etat = "repos";
  auto: Auto | null;
  /** Silence continu depuis la dernière parole (s). */
  silence = 0;
  /** Vrai dès qu'une parole a été entendue depuis l'entrée en écoute. */
  entendu = false;
  /** Temps restant d'un état posé par l'automatisme (s) ; 0 : l'état tient. */
  reste = 0;
  constructor(auto: Auto | null = null) {
    this.auto = auto;
  }
  aller(e: Etat, parAuto = false): boolean {
    if (e === this.etat) return false;
    this.etat = e;
    this.silence = 0;
    this.entendu = false;
    this.reste = parAuto && this.auto && e === this.auto.etat ? this.auto.duree : 0;
    return true;
  }
  pas(dt: number, niveauBrut: number): Etat | null {
    const a = this.auto;
    if (!a) return null;
    if (this.etat === "ecoute") {
      if (niveauBrut > SEUIL_PAROLE) {
        this.entendu = true;
        this.silence = 0;
      } else if (niveauBrut < SEUIL_SILENCE && this.entendu) {
        this.silence += dt;
        if (this.silence >= a.silence) return a.etat;
      }
    } else if (this.reste > 0) {
      this.reste -= dt;
      if (this.reste <= 0) return "repos";
    }
    return null;
  }
}

/** Un petit générateur pseudo-aléatoire déterministe (mulberry32). */
export function alea(graine: number) {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quelques « timbres » de syllabe (énergie relative par bande) : voyelles graves, ouvertes, claires, sifflantes. */
const TIMBRES: readonly (readonly number[])[] = [
  [1, 0.62, 0.32, 0.16],
  [0.78, 1, 0.55, 0.24],
  [0.55, 0.75, 1, 0.42],
  [0.42, 0.45, 0.7, 1],
  [0.9, 0.85, 0.45, 0.3],
];

/**
 * Une parole synthétique crédible (démonstrations, captures) : syllabes de 0,11–0,25 s à attaque vive, petits
 * silences entre syllabes, plus longs entre mots, et une vraie pause (1,8–2,7 s) entre phrases de 3 à 7 mots.
 * Déterministe pour une graine donnée.
 */
export class ParoleSynthetique {
  niveau = 0;
  readonly bandes = new Float32Array([0.8, 0.8, 0.5, 0.3]);
  private r: () => number;
  private seg = 0.3;
  private duree = 0.3;
  private pic = 0;
  private syll = 0;
  private mots = 0;
  private t = 0;
  private cible = new Float32Array([0.8, 0.8, 0.5, 0.3]);
  constructor(graine = 7) {
    this.r = alea(graine);
  }
  pas(dt: number): number {
    this.t += dt;
    this.seg -= dt;
    let garde = 0;
    while (this.seg <= 0 && garde++ < 16) this.suivant();
    const p = clamp(1 - this.seg / this.duree, 0, 1);
    let v = 0;
    if (this.pic > 0) {
      // Attaque vive, chute plus douce, un léger trémolo (la voix n'est jamais plate).
      v = this.pic * Math.pow(Math.sin(Math.PI * Math.pow(p, 0.6)), 1.25);
      v *= 0.9 + 0.1 * Math.sin(this.t * 41 + this.pic * 9);
    }
    this.niveau = clamp(v, 0, 1);
    const k = 1 - Math.exp(-dt / 0.06);
    for (let i = 0; i < 4; i++) this.bandes[i] = this.bandes[i]! + (this.cible[i]! - this.bandes[i]!) * k;
    return this.niveau;
  }
  private dur(d: number) {
    this.seg += d;
    this.duree = d;
  }
  private suivant() {
    const r = this.r;
    if (this.pic > 0) {
      this.pic = 0;
      this.syll--;
      if (this.syll > 0) this.dur(0.03 + r() * 0.06);
      else {
        this.mots--;
        if (this.mots > 0) {
          this.dur(0.12 + r() * 0.18);
          this.syll = 1 + Math.floor(r() * 3);
        } else this.dur(1.8 + r() * 0.9);
      }
      return;
    }
    if (this.mots <= 0) {
      this.mots = 3 + Math.floor(r() * 5);
      this.syll = 1 + Math.floor(r() * 3);
    }
    this.pic = 0.45 + r() * 0.55;
    this.dur(0.11 + r() * 0.14);
    const tb = TIMBRES[Math.floor(r() * TIMBRES.length)]!;
    for (let i = 0; i < 4; i++) this.cible[i] = clamp(tb[i]! * (0.85 + r() * 0.3), 0, 1);
  }
}

/** Les palettes : quatre teintes, des graves (gauche) aux aigus (droite). */
export const PALETTES: Record<string, readonly string[]> = {
  aurore: ["#3d6dff", "#8f5bff", "#ff4f9a", "#ff8a3d"],
  ocean: ["#1f5cff", "#00a6e0", "#14c9a5", "#6fe3ff"],
  braise: ["#d92b1f", "#ff5a1a", "#ff9a1f", "#ffc94a"],
};

/** "#rgb", "#rrggbb", "rgb(r, g, b)" → [r, g, b] en 0–1 (null si illisible). */
export function lireCouleur(s: string): [number, number, number] | null {
  const t = s.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(t);
  if (m) return [0, 1, 2].map((i) => Number.parseInt(m![1]![i]! + m![1]![i]!, 16) / 255) as [number, number, number];
  m = /^#([0-9a-f]{6})$/i.exec(t);
  if (m) return [0, 2, 4].map((i) => Number.parseInt(m![1]!.slice(i, i + 2), 16) / 255) as [number, number, number];
  const r = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(t);
  if (r) return [Number(r[1]) / 255, Number(r[2]) / 255, Number(r[3]) / 255];
  return null;
}

/** Une teinte unique déclinée en quatre (plus sombre et plus froide à gauche, plus claire à droite). */
export function declinaison(c: [number, number, number]): [number, number, number][] {
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return [
    [c[0] * 0.62, c[1] * 0.62, c[2] * 0.7],
    [c[0] * 0.85, c[1] * 0.85, c[2] * 0.88],
    c,
    [mix(c[0], 1, 0.22), mix(c[1], 1, 0.22), mix(c[2], 1, 0.22)],
  ];
}

/* ───────────────────────── Rendu ───────────────────────── */

const WGSL = /* wgsl */ `
struct U {
  taille: vec4f, // largeur, hauteur de la toile (px), dpr, temps (s)
  boite: vec4f,  // x, y, largeur, hauteur du conteneur dans la toile (px)
  p: vec4f,      // rayon des coins (px), débord (px), hauteur atteinte à plein niveau (0–1), force (0–2)
  e: vec4f,      // poids écoute/parole, poids réflexion, poids braise, niveau (0–1)
  f: vec4f,      // phase du balayage (rad), fond clair (1) ou sombre (0), mouvement réduit (1), pulsation (0–1)
  b: vec4f,      // bandes relatives, graves → aigus
  c: array<vec4f, 4>, // palette
};
@group(0) @binding(0) var<uniform> u: U;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let x = f32((i << 1u) & 2u);
  let y = f32(i & 2u);
  return vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
}

fn hache(p: vec2f) -> f32 {
  var q = fract(vec3f(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
fn bruit(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(hache(i), hache(i + vec2f(1.0, 0.0)), w.x), mix(hache(i + vec2f(0.0, 1.0)), hache(i + vec2f(1.0, 1.0)), w.x), w.y);
}
fn fbm(p: vec2f) -> f32 {
  return 0.58 * bruit(p) + 0.29 * bruit(p * 2.03 + vec2f(5.2, 1.3)) + 0.13 * bruit(p * 4.11 + vec2f(2.7, 8.1));
}
fn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}
fn couleur(i: i32) -> vec3f {
  let c = u.c[i].rgb;
  // Sur papier, la teinte est approfondie : en « multiplier », une couleur claire ne se verrait pas.
  return select(c, pow(c, vec3f(1.35)), u.f.y > 0.5);
}
fn teinte(x: f32) -> vec3f {
  let s = clamp(x, 0.0, 1.0) * 3.0;
  let i = min(i32(s), 2);
  return mix(couleur(i), couleur(i + 1), s - f32(i));
}
// Profil vertical d'une nappe : plein au bord bas, s'éteint doucement vers la hauteur h.
fn monte(v: f32, h: f32) -> f32 {
  return exp(-pow(v / max(h, 0.015), 1.6) * 2.4);
}

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let dpr = u.taille.z;
  let t = u.taille.w;
  let bx = u.boite;
  let half = bx.zw * 0.5;
  let rayon = min(u.p.x, min(half.x, half.y));
  let sd = sdrb(pos.xy - (bx.xy + half), half, rayon);
  let uu = (pos.x - bx.x) / bx.z;
  let dBas = bx.y + bx.w - pos.y;          // distance au bord bas (px), négative dessous
  let vh = max(dBas, 0.0) / bx.w;           // 0 en bas, 1 en haut
  let reduit = u.f.z > 0.5;
  let H = u.p.z;
  let ecoute = u.e.x;
  let refl = u.e.y;
  let lvl = u.e.w;

  // Le bruit lent qui fait vivre les nappes (figé en mouvement réduit : le temps n'avance pas).
  let n1 = fbm(vec2f(uu * 2.3, vh * 1.7 - t * 0.34));
  let n2 = fbm(vec2f(uu * 1.6 + 7.3, vh * 2.4 - t * 0.52));
  let uw = uu + (n1 - 0.5) * 0.13;
  let vw = vh * (0.72 + n2 * 0.56);

  var lum = vec3f(0.0); // lumière accumulée (mélange « écran » : additif adouci)
  var reste = 1.0;      // produit des (1 − a)
  var ligne = 0.0;      // intensité du liseré du bord bas

  if (ecoute > 0.001) {
    for (var i = 0; i < 4; i++) {
      let bi = u.b[i];
      let fi = f32(i);
      let cx = (fi + 0.5) / 4.0 + (bi - 0.5) * 0.07 + sin(t * 0.37 + fi * 1.9) * 0.035;
      let w = 0.12 + 0.11 * bi + 0.1 * lvl;
      let h = H * (0.1 + 0.9 * lvl) * (0.42 + 0.58 * bi);
      let dx = (uw - cx) / w;
      let gx = exp(-dx * dx);
      let a = clamp(gx * monte(vw, h) * ecoute * (0.5 + 0.5 * lvl), 0.0, 1.0);
      lum = 1.0 - (1.0 - lum) * (1.0 - couleur(i) * a);
      reste *= 1.0 - a;
      ligne += gx * ecoute * (0.3 + 0.7 * lvl) * (0.5 + 0.5 * bi);
    }
  }
  if (refl > 0.001) {
    if (reduit) {
      // Mouvement réduit : pas de balayage, une nappe large dont l'opacité pulse lentement.
      let a = clamp(monte(vw, H * 0.4) * refl * (0.25 + 0.55 * u.f.w), 0.0, 1.0);
      lum = 1.0 - (1.0 - lum) * (1.0 - teinte(uu) * a);
      reste *= 1.0 - a;
      ligne += refl * (0.3 + 0.5 * u.f.w);
    } else {
      // Un lobe étroit qui va et vient ; sa traîne, ce sont ses positions passées, de plus en plus larges et pâles.
      for (var k = 0; k < 8; k++) {
        let fk = f32(k);
        let x = (0.5 - 0.5 * cos(u.f.x - fk * 0.1)) * 1.12 - 0.06;
        let poids = pow(1.0 - fk / 8.0, 1.7);
        // Au moins ~40 px de large : sur un écran étroit, un lobe trop fin ferait une arête.
        let w = max(0.075, 40.0 * dpr / bx.z) * (1.0 + 0.24 * fk);
        let dx = (uw - x) / w;
        let gx = exp(-dx * dx);
        let a = clamp(gx * monte(vw, H * 0.48) * poids * refl * 0.92, 0.0, 1.0);
        lum = 1.0 - (1.0 - lum) * (1.0 - teinte(x) * a);
        reste *= 1.0 - a;
        ligne += gx * poids * refl * 0.55;
      }
    }
  }
  if (u.e.z > 0.001) {
    let dx = (uu - 0.5) / 0.24;
    let a = clamp(exp(-dx * dx) * monte(vh, 0.22) * u.e.z * 0.22, 0.0, 1.0);
    lum = 1.0 - (1.0 - lum) * (1.0 - teinte(uu) * a);
    reste *= 1.0 - a;
    ligne += exp(-dx * dx) * u.e.z * 0.25;
  }

  // Le liseré : une fine ligne de lumière sur le bord bas, qui suit l'arrondi des coins.
  let anneau = exp(-abs(sd + 1.1 * dpr) / (1.1 * dpr));
  let basP = 1.0 - smoothstep(0.0, max(rayon * 1.15, 10.0 * dpr), dBas);
  let la = clamp(anneau * basP * min(ligne, 1.0) * 0.9, 0.0, 1.0);
  let cl = mix(teinte(uu), vec3f(1.0), select(0.45, 0.1, u.f.y > 0.5));
  lum = 1.0 - (1.0 - lum) * (1.0 - cl * la);
  reste *= 1.0 - la;

  var a = 1.0 - reste;
  // Sur fond sombre, le cœur des nappes blanchit un peu (une lumière, pas une peinture).
  if (u.f.y < 0.5) { lum += (vec3f(a) - lum) * smoothstep(0.55, 1.0, a) * 0.3; }

  // Dedans : plein ; dehors : un halo qui s'éteint sur la largeur du débord.
  let dedans = clamp(0.5 - sd / dpr, 0.0, 1.0);
  let halo = exp(-max(sd, 0.0) / max(u.p.y * 0.36, 1.0)) * 0.6;
  // Sur fond sombre, une lumière doit porter un peu plus qu'une teinte sur papier.
  let m = mix(halo, 1.0, dedans) * u.p.w * select(1.0, 1.3, u.f.y < 0.5);
  let a2 = clamp(a * m, 0.0, 1.0);
  let k = a2 / max(a, 1e-5);
  return vec4f(lum * k, a2);
}
`;

/** Le shader de la lueur (exporté pour les bancs d'essai : compilation, rendu hors écran). */
export const WGSL_VOIX = WGSL;
/** Taille des uniformes (octets) : 6 vec4 + 4 couleurs. */
export const TAILLE_UNIFORMES = 160;

/** Ce que le shader reçoit (unités : px de la cible, sauf mention). */
export type ParamsVoix = {
  largeur: number; hauteur: number; dpr: number; temps: number;
  boite: { x: number; y: number; l: number; h: number };
  rayon: number; debord: number; hauteurLueur: number; force: number;
  ecoute: number; reflexion: number; braise: number; niveau: number;
  phase: number; clair: boolean; reduit: boolean; pulse: number;
  bandes: ArrayLike<number>; couleurs: ArrayLike<number>; // 4 bandes ; 4 × rgba (0–1)
};
/** Remplit les 40 flottants des uniformes (aucune allocation). */
export function remplirUniformes(u: Float32Array, p: ParamsVoix) {
  u[0] = p.largeur; u[1] = p.hauteur; u[2] = p.dpr; u[3] = p.temps;
  u[4] = p.boite.x; u[5] = p.boite.y; u[6] = p.boite.l; u[7] = p.boite.h;
  u[8] = p.rayon; u[9] = p.debord; u[10] = p.hauteurLueur; u[11] = p.force;
  u[12] = p.ecoute; u[13] = p.reflexion; u[14] = p.braise; u[15] = clamp(p.niveau, 0, 1);
  u[16] = p.phase; u[17] = p.clair ? 1 : 0; u[18] = p.reduit ? 1 : 0; u[19] = p.pulse;
  for (let i = 0; i < 4; i++) u[20 + i] = p.bandes[i] ?? 0;
  for (let i = 0; i < 16; i++) u[24 + i] = p.couleurs[i] ?? 0;
}

type Pipe = { pipe: GPURenderPipeline; layout: GPUBindGroupLayout };
const pipes = new WeakMap<GPUDevice, Map<GPUTextureFormat, Pipe>>();
function pipeOf(device: GPUDevice, format: GPUTextureFormat): Pipe {
  let parFormat = pipes.get(device);
  if (!parFormat) pipes.set(device, (parFormat = new Map()));
  let p = parFormat.get(format);
  if (p) return p;
  const mod = device.createShaderModule({ code: WGSL, label: "presse:voix" });
  const layout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }] });
  const blend: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } };
  const pipe = device.createRenderPipeline({
    label: "presse:voix",
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs", targets: [{ format, blend }] },
    primitive: { topology: "triangle-list" },
  });
  p = { pipe, layout };
  parFormat.set(format, p);
  return p;
}

/**
 * Le rendu de la lueur dans une vue de texture quelconque (celle du canvas en vrai ; une texture hors écran dans un
 * banc d'essai). Sortie en alpha prémultiplié, à composer en « source-over » (fond sombre) ou « multiplier » (clair).
 */
export class RenduVoix {
  readonly device: GPUDevice;
  private ubuf: GPUBuffer;
  private bind: GPUBindGroup;
  private p: Pipe;
  constructor(device: GPUDevice, format: GPUTextureFormat) {
    this.device = device;
    this.p = pipeOf(device, format);
    this.ubuf = device.createBuffer({ size: TAILLE_UNIFORMES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.bind = device.createBindGroup({ layout: this.p.layout, entries: [{ binding: 0, resource: { buffer: this.ubuf } }] });
  }
  /** Dessine (u : 40 flottants, voir remplirUniformes) ; vide : efface seulement. */
  draw(view: GPUTextureView, u: Float32Array<ArrayBuffer>, vide = false) {
    const enc = this.device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    if (!vide) {
      this.device.queue.writeBuffer(this.ubuf, 0, u);
      pass.setPipeline(this.p.pipe);
      pass.setBindGroup(0, this.bind);
      pass.draw(3);
    }
    pass.end();
    this.device.queue.submit([enc.finish()]);
  }
  detruire() {
    this.ubuf.destroy();
  }
}

/** Le canvas d'un composant : sa texture courante, à chaque image. */
class GpuVoix {
  readonly device: GPUDevice;
  private ctx: GPUCanvasContext;
  private rendu: RenduVoix;
  private canvas: HTMLCanvasElement;
  /** Vrai si la dernière image était vide (inutile de la redessiner vide). */
  vide = false;
  constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.device = device;
    this.canvas = canvas;
    const format = navigator.gpu.getPreferredCanvasFormat();
    this.ctx = canvas.getContext("webgpu")!;
    this.ctx.configure({ device, format, alphaMode: "premultiplied" });
    this.rendu = new RenduVoix(device, format);
  }
  draw(u: Float32Array<ArrayBuffer>, vide: boolean) {
    if (vide && this.vide) return;
    this.vide = vide;
    if (!this.canvas.width || !this.canvas.height) return;
    this.rendu.draw(this.ctx.getCurrentTexture().createView(), u, vide);
  }
  detruire() {
    this.rendu.detruire();
    try {
      this.ctx.unconfigure();
    } catch {
      /* déjà rendu */
    }
  }
}

/* ───────────────────────── Le composant ───────────────────────── */

const CSS = `
:where([data-voix]) { position: relative; isolation: isolate; }
.voix-toile, .voix-repli { position: absolute; display: block; pointer-events: none; z-index: -1; }
.voix-toile[hidden], .voix-repli[hidden] { display: none; }
.voix-clair > .voix-toile, .voix-clair > .voix-repli { mix-blend-mode: multiply; }
.voix-repli {
  inset: 0; border-radius: inherit;
  opacity: var(--voix-opacite, 0);
  background:
    linear-gradient(to top, color-mix(in srgb, var(--voix-c2) 80%, white) 0 2px, transparent 3px),
    radial-gradient(calc(18% + 22% * var(--voix-niveau, 0)) calc(10% + 110% * var(--voix-niveau, 0)) at var(--voix-x, 50%) 100%, var(--voix-c2), transparent),
    radial-gradient(calc(26% + 18% * var(--voix-niveau, 0)) calc(8% + 90% * var(--voix-niveau, 0)) at calc(var(--voix-x, 50%) - 30%) 100%, var(--voix-c1), transparent),
    radial-gradient(calc(26% + 18% * var(--voix-niveau, 0)) calc(8% + 90% * var(--voix-niveau, 0)) at calc(var(--voix-x, 50%) + 30%) 100%, var(--voix-c3), transparent),
    radial-gradient(40% calc(6% + 70% * var(--voix-niveau, 0)) at 0% 100%, var(--voix-c0), transparent);
}
.voix-message { position: absolute; left: 0; top: calc(100% + 8px); margin: 0; max-width: 100%; font: 500 12px/1.35 var(--f-mono, ui-monospace, monospace); letter-spacing: 0.02em; opacity: 0.78; color: inherit; }
.voix-message:empty { display: none; }
[data-voix-micro] { touch-action: manipulation; }
`;

let cssPose = false;
function poserCss() {
  if (cssPose) return;
  cssPose = true;
  const st = document.createElement("style");
  st.dataset.presseVoix = "";
  st.textContent = CSS;
  document.head.append(st);
}

const FONDU: Spring = { k: 55, zeta: 1 };
const NIVEAU: Spring = { k: 170, zeta: 0.92 };
const reducedQ = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** L'interface publique d'un composant voix. */
export type VoixApi = {
  /** Demande le micro (au geste de l'utilisateur) et passe en écoute. */
  ecouter(): Promise<void>;
  /** Coupe le micro et les flux, arrête la démonstration, revient au repos. */
  arreter(): void;
  /** Change d'état (fondu). Quitter « ecoute » referme le micro. */
  etat(e: Etat): void;
  /** Force le niveau (0–1) ; null rend la main à la source (micro, flux, démonstration). */
  niveau(v: number | null): void;
  /** Analyse un flux fourni par la page (ses pistes restent à elle) ; au repos, passe en écoute. null le débranche. */
  brancher(stream: MediaStream | null): void;
  /** Démonstration : un niveau synthétique, sans micro (écoute). */
  demo(): void;
  detruire(): void;
};

type Source = "micro" | "flux" | null;

class Voix {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private repli: HTMLElement;
  private message: HTMLElement;
  private messageCree: boolean;
  private gpu: GpuVoix | null = null;
  private gpuEchec = false;
  private automate: Automate;
  // Audio
  private ctx: AudioContext | null = null;
  private analyseur: AnalyserNode | null = null;
  private noeud: MediaStreamAudioSourceNode | null = null;
  private muet: GainNode | null = null;
  private micro: MediaStream | null = null;
  private flux: MediaStream | null = null;
  private source: Source = null;
  private ticket = 0;
  private attente = false;
  private tampon = new Float32Array(1024);
  private spectre = new Float32Array(512);
  private plancher = new PlancherBruit();
  private synth: ParoleSynthetique | null = null;
  private force: number | null = null;
  // Signal
  private brut = 0;
  private env = 0;
  private bandesBrutes = new Float32Array(4);
  private bandesRel = new Float32Array([0.8, 0.85, 0.6, 0.45]);
  private bandesAff = new Float32Array([0.8, 0.85, 0.6, 0.45]);
  private aff = 0;
  private affV = 0;
  // Fondus
  private wE = 0;
  private wEv = 0;
  private wR = 0;
  private wRv = 0;
  private wB = 0;
  private wBv = 0;
  private temps = Math.random() * 50;
  private phase = 0;
  private pulse = 0;
  private horloge = 0;
  // Boucle
  private raf = 0;
  private minuterie = 0;
  private dernier = 0;
  private visible = true;
  private dernierEnvoi = 0;
  private dernierEnvoye = -1;
  private messageMinuterie = 0;
  // Réglages lus sur les attributs
  private ecran = false;
  private debord = 24;
  private hauteur = 0.9;
  private intensite = 1;
  private clair = true;
  private braise = false;
  private demoAttr = false;
  private rayon = 0;
  private couleurs = new Float32Array(16);
  private couleursCss: string[] = [];
  private u = new Float32Array(40);
  private params: ParamsVoix = { largeur: 0, hauteur: 0, dpr: 1, temps: 0, boite: { x: 0, y: 0, l: 0, h: 0 }, rayon: 0, debord: 0, hauteurLueur: 0.9, force: 1, ecoute: 0, reflexion: 0, braise: 0, niveau: 0, phase: 0, clair: true, reduit: false, pulse: 0, bandes: this.bandesAff, couleurs: this.couleurs };
  private pertes: number[] = [];
  private W = 0;
  private H = 0;
  private dpr = 1;
  private reduit = reducedQ();
  private ro: ResizeObserver;
  private mo: MutationObserver;
  private boutons: HTMLElement[] = [];
  private offPerte: () => void;
  private detruit = false;
  private mq: MediaQueryList | null = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  constructor(el: HTMLElement) {
    this.el = el;
    poserCss();
    this.automate = new Automate(lireAuto(el.dataset.voixAuto));
    this.canvas = document.createElement("canvas");
    this.canvas.className = "voix-toile";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.hidden = true;
    this.repli = document.createElement("div");
    this.repli.className = "voix-repli";
    this.repli.setAttribute("aria-hidden", "true");
    this.repli.hidden = true;
    el.prepend(this.canvas, this.repli);
    const m = el.querySelector<HTMLElement>("[data-voix-message]");
    this.messageCree = !m;
    this.message = m ?? document.createElement("p");
    if (!m) {
      this.message.className = "voix-message";
      el.append(this.message);
    }
    this.message.setAttribute("aria-live", "polite");
    this.message.setAttribute("role", "status");

    this.lireReglages();
    const e0 = el.dataset.voixEtat;
    el.dataset.voixEtat = "repos";

    this.boutons = [...el.querySelectorAll<HTMLElement>("[data-voix-micro]")];
    for (const b of this.boutons) {
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", this.surBouton);
    }

    this.ro = new ResizeObserver(() => this.mesurer());
    this.ro.observe(el);
    this.mo = new MutationObserver((ms) => {
      let regl = false;
      for (const mu of ms) {
        if (mu.attributeName === "data-voix-etat") {
          const v = el.dataset.voixEtat;
          if (estEtat(v) && v !== this.automate.etat) this.aller(v, "attribut");
          else if (!estEtat(v)) el.dataset.voixEtat = this.automate.etat;
        } else regl = true;
      }
      if (regl) {
        this.lireReglages();
        this.mesurer();
        this.reveiller();
      }
    });
    this.mo.observe(el, { attributes: true, attributeFilter: ["data-voix", "data-voix-etat", "data-voix-palette", "data-voix-couleur", "data-voix-force", "data-voix-hauteur", "data-voix-debord", "data-voix-fond", "data-voix-auto", "data-voix-demo", "data-voix-braise"] });
    observateur().observe(el);
    document.addEventListener("visibilitychange", this.surVisibilite);
    this.mq?.addEventListener?.("change", this.surReduit);
    // Perte de l'appareil (relayée par device.ts, ou vue directement sur device.lost, voir initGpu).
    this.offPerte = onDeviceLost(() => this.perte(this.gpu?.device ?? null));
    this.mesurer();
    this.initGpu();
    if (estEtat(e0) && e0 !== "repos") this.aller(e0, "attribut");
  }

  /* ── Réglages ── */
  private lireReglages() {
    const d = this.el.dataset;
    this.ecran = d.voix === "ecran";
    const num = (s: string | undefined, def: number, a: number, b: number) => {
      const v = Number.parseFloat(s ?? "");
      return Number.isFinite(v) ? clamp(v, a, b) : def;
    };
    this.debord = num(d.voixDebord, this.ecran ? 0 : 24, 0, 200);
    this.hauteur = num(d.voixHauteur, this.ecran ? 0.6 : 0.9, 0.05, 1.5);
    this.intensite = num(d.voixForce, 1, 0, 2);
    this.braise = d.voixBraise !== undefined && d.voixBraise !== "false";
    this.demoAttr = d.voixDemo !== undefined && d.voixDemo !== "false";
    this.automate.auto = lireAuto(d.voixAuto);
    this.clair = d.voixFond === "sombre" ? false : d.voixFond === "clair" ? true : devinerClair(this.el);
    this.el.classList.toggle("voix-clair", this.clair);
    this.el.classList.toggle("voix-sombre", !this.clair);
    // Palette
    let cols: [number, number, number][];
    const pal = d.voixPalette ?? "aurore";
    if (pal === "mono") {
      const c = lireCouleurCss(this.el, d.voixCouleur ?? "#8f5bff") ?? [0.56, 0.36, 1];
      cols = declinaison(c);
    } else cols = (PALETTES[pal] ?? PALETTES.aurore!).map((h) => lireCouleur(h)!);
    cols.forEach((c, i) => this.couleurs.set([c[0], c[1], c[2], 1], i * 4));
    this.couleursCss = cols.map((c) => `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`);
    this.couleursCss.forEach((c, i) => this.repli.style.setProperty(`--voix-c${i}`, c));
    this.dessinerSiArrete();
  }

  private mesurer() {
    const el = this.el;
    const cs = getComputedStyle(el);
    const bl = Number.parseFloat(cs.borderLeftWidth) || 0;
    const br = Number.parseFloat(cs.borderRightWidth) || 0;
    const bt = Number.parseFloat(cs.borderTopWidth) || 0;
    const bb = Number.parseFloat(cs.borderBottomWidth) || 0;
    this.rayon = Math.max(Number.parseFloat(cs.borderBottomLeftRadius) || 0, Number.parseFloat(cs.borderBottomRightRadius) || 0);
    this.W = el.offsetWidth;
    this.H = el.offsetHeight;
    const d = this.debord;
    Object.assign(this.canvas.style, { left: `${-d - bl}px`, right: `${-d - br}px`, top: `${-bt}px`, bottom: `${-d - bb}px` });
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.round((this.W + 2 * d) * this.dpr));
    const ch = Math.max(1, Math.round((this.H + d) * this.dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      if (this.gpu) this.gpu.vide = false;
    }
    this.dessinerSiArrete();
  }

  private initGpu() {
    if (this.detruit) return;
    getDevice()
      .then((device) => {
        if (this.detruit) return;
        this.gpu = new GpuVoix(device, this.canvas);
        // device.ts ne relaie pas une perte de raison « destroyed » : on la guette aussi nous-mêmes.
        void device.lost.then(() => this.perte(device));
        this.canvas.hidden = false;
        this.repli.hidden = true;
        this.el.dataset.voixRendu = "webgpu";
        this.dessinerSiArrete();
      })
      .catch(() => this.passerAuRepli());
  }

  /** Reprise après perte, au plus trois fois par minute ; au-delà, repli CSS (le composant reste vivant). */
  private perte(device: GPUDevice | null) {
    if (this.detruit || !device || this.gpu?.device !== device) return;
    this.gpu = null;
    const now = performance.now();
    this.pertes = this.pertes.filter((t) => now - t < 60_000);
    this.pertes.push(now);
    if (this.pertes.length >= 3) return this.passerAuRepli();
    this.canvas.hidden = true;
    setTimeout(() => this.initGpu(), 300);
  }

  private passerAuRepli() {
    if (this.detruit) return;
    this.gpu?.detruire();
    this.gpu = null;
    this.gpuEchec = true;
    this.canvas.hidden = true;
    this.repli.hidden = false;
    this.el.dataset.voixRendu = "css";
    this.dessinerSiArrete();
  }

  /* ── États ── */
  private aller(e: Etat, cause: string) {
    const prec = this.automate.etat;
    if (!this.automate.aller(e, cause === "auto")) return;
    // Le micro n'est ouvert qu'en écoute.
    if (prec === "ecoute" && this.source === "micro") this.fermerAudio();
    if (e === "repos") this.synth = null;
    if (e !== "ecoute" && e !== "parole") this.brut = 0;
    this.el.dataset.voixEtat = e;
    this.majBoutons();
    this.el.dispatchEvent(new CustomEvent("voix:etat", { bubbles: true, detail: { etat: e, precedent: prec, cause } }));
    this.reveiller();
  }

  private majBoutons() {
    const on = this.source === "micro";
    for (const b of this.boutons) {
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("voix-micro-ouvert", on);
    }
  }

  private annoncer(txt: string) {
    clearTimeout(this.messageMinuterie);
    this.message.textContent = txt;
    if (txt) this.messageMinuterie = window.setTimeout(() => (this.message.textContent = ""), 7000);
  }

  private surBouton = (ev: Event) => {
    ev.preventDefault();
    // Un second clic coupe le micro, ou annule la demande d'autorisation en cours.
    if (this.source === "micro" || this.attente) this.arreter();
    else void this.ecouter();
  };

  async ecouter() {
    if (this.source === "micro") return;
    const t = ++this.ticket;
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!window.isSecureContext || !md?.getUserMedia) {
      this.annoncer(`Micro indisponible : la page doit être servie en https.${this.demoAttr ? " Démonstration à la place." : ""}`);
      if (this.demoAttr) this.demo();
      return;
    }
    for (const b of this.boutons) b.setAttribute("aria-busy", "true");
    this.attente = true;
    let stream: MediaStream;
    try {
      stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      this.attente = false;
      for (const b of this.boutons) b.removeAttribute("aria-busy");
      if (t !== this.ticket) return;
      const nom = (e as DOMException)?.name;
      const suite = this.demoAttr ? " Démonstration à la place." : " Vous pouvez écrire.";
      this.annoncer(nom === "NotAllowedError" || nom === "SecurityError" ? `Micro refusé.${suite}` : nom === "NotFoundError" || nom === "OverconstrainedError" ? `Aucun micro trouvé.${suite}` : `Micro indisponible.${suite}`);
      if (this.demoAttr) this.demo();
      return;
    }
    this.attente = false;
    for (const b of this.boutons) b.removeAttribute("aria-busy");
    // Arrêté (ou détruit) pendant la demande d'autorisation : on rend le micro aussitôt.
    if (t !== this.ticket || this.detruit) {
      for (const tr of stream.getTracks()) tr.stop();
      return;
    }
    this.fermerAudio();
    this.micro = stream;
    for (const tr of stream.getAudioTracks())
      tr.addEventListener("ended", () => {
        if (this.micro !== stream) return;
        this.annoncer("Le micro s'est interrompu.");
        this.arreter();
      });
    this.ouvrirAnalyse(stream, "micro");
    this.synth = null;
    this.annoncer("À l'écoute.");
    if (this.automate.etat === "ecoute") this.majBoutons();
    else this.aller("ecoute", "micro");
  }

  private ouvrirAnalyse(stream: MediaStream, source: Source) {
    try {
      this.ctx ??= new AudioContext();
      void this.ctx.resume();
      const a = this.ctx.createAnalyser();
      a.fftSize = 1024;
      a.smoothingTimeConstant = 0.55;
      const n = this.ctx.createMediaStreamSource(stream);
      // Le son ne va nulle part : un gain nul ferme le graphe (sans lui, certains moteurs ne tirent pas l'analyseur).
      const g = this.ctx.createGain();
      g.gain.value = 0;
      n.connect(a);
      a.connect(g);
      g.connect(this.ctx.destination);
      this.analyseur = a;
      this.noeud = n;
      this.muet = g;
      this.source = source;
      this.plancher = new PlancherBruit();
      if (this.tampon.length !== a.fftSize) this.tampon = new Float32Array(a.fftSize);
      if (this.spectre.length !== a.frequencyBinCount) this.spectre = new Float32Array(a.frequencyBinCount);
    } catch (e) {
      console.warn("[presse:voix] analyse audio impossible", e);
      this.annoncer("Analyse du son impossible dans ce navigateur.");
    }
  }

  /** Coupe le micro (pistes arrêtées), débranche le flux (ses pistes restent à la page), ferme le contexte audio. */
  private fermerAudio() {
    this.ticket++;
    try {
      this.noeud?.disconnect();
      this.analyseur?.disconnect();
      this.muet?.disconnect();
    } catch {
      /* déjà débranché */
    }
    this.noeud = null;
    this.analyseur = null;
    this.muet = null;
    if (this.micro) for (const tr of this.micro.getTracks()) tr.stop();
    this.micro = null;
    this.flux = null;
    this.source = null;
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.brut = 0;
    this.majBoutons();
  }

  arreter() {
    const ouvert = this.source === "micro";
    this.fermerAudio();
    this.synth = null;
    this.force = null;
    if (ouvert) this.annoncer("Micro coupé.");
    this.aller("repos", "api");
    this.majBoutons();
  }

  etat(e: Etat) {
    if (!estEtat(e)) return;
    this.aller(e, "api");
  }

  niveau(v: number | null) {
    this.force = v == null || !Number.isFinite(v) ? null : clamp(v, 0, 1);
    this.reveiller();
  }

  brancher(stream: MediaStream | null) {
    this.fermerAudio();
    if (!stream) return this.reveiller();
    this.flux = stream;
    this.ouvrirAnalyse(stream, "flux");
    if (this.automate.etat === "repos") this.aller("ecoute", "flux");
    this.reveiller();
  }

  demo() {
    if (this.source === "micro") this.fermerAudio();
    this.synth = new ParoleSynthetique(1 + Math.floor(Math.random() * 1e6));
    if (this.automate.etat === "ecoute") this.reveiller();
    else this.aller("ecoute", "demo");
  }

  detruire() {
    if (this.detruit) return;
    this.fermerAudio();
    this.detruit = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.minuterie);
    clearTimeout(this.messageMinuterie);
    this.raf = this.minuterie = 0;
    this.ro.disconnect();
    this.mo.disconnect();
    observateur().unobserve(this.el);
    document.removeEventListener("visibilitychange", this.surVisibilite);
    this.mq?.removeEventListener?.("change", this.surReduit);
    this.offPerte();
    this.gpu?.detruire();
    this.gpu = null;
    for (const b of this.boutons) b.removeEventListener("click", this.surBouton);
    this.canvas.remove();
    this.repli.remove();
    if (this.messageCree) this.message.remove();
    this.el.classList.remove("voix-clair", "voix-sombre");
    delete this.el.dataset.voixRendu;
    delete this.el.dataset.voixPret;
    instances.delete(this.el);
  }

  /* ── Boucle ── */
  private surVisibilite = () => this.reveiller();
  private surReduit = () => {
    this.reduit = reducedQ();
    this.reveiller();
  };
  setVisible(v: boolean) {
    this.visible = v;
    this.reveiller();
  }

  /** Vrai tant qu'il reste quelque chose à animer ou à suivre. */
  private actif() {
    const e = this.automate.etat;
    if (e !== "repos") return true;
    const tB = this.braise ? 1 : 0;
    return this.wE > 0.002 || Math.abs(this.wEv) > 0.002 || this.wR > 0.002 || Math.abs(this.wRv) > 0.002 || Math.abs(this.wB - tB) > 0.002 || Math.abs(this.wBv) > 0.002 || this.aff > 0.002;
  }

  /** Relance la boucle (depuis l'arrêt : l'horloge repart de maintenant). */
  reveiller() {
    if (this.detruit || this.raf) return;
    if (!this.minuterie) this.dernier = performance.now();
    this.continuer();
  }

  private continuer() {
    if (this.detruit || this.raf) return;
    const montre = this.visible && !document.hidden;
    if (montre) {
      if (this.minuterie) (clearTimeout(this.minuterie), (this.minuterie = 0));
      this.raf = requestAnimationFrame(this.image);
    } else if (!this.minuterie && this.automate.etat !== "repos") {
      // Hors écran ou onglet caché : plus de rendu, mais l'analyse, l'automate et les événements suivent (10 par s).
      this.minuterie = window.setTimeout(() => {
        this.minuterie = 0;
        const now = performance.now();
        this.pas(Math.min(0.25, (now - this.dernier) / 1000));
        this.dernier = now;
        this.continuer();
      }, 100);
    }
  }

  private image = (now: number) => {
    this.raf = 0;
    const dt = clamp((now - this.dernier) / 1000, 0.001, 0.05);
    this.dernier = now;
    this.pas(dt);
    this.dessiner();
    if (this.actif()) this.continuer();
  };

  private dessinerSiArrete() {
    if (!this.raf && !this.detruit) this.dessiner();
  }

  /** Un pas de simulation : la source, l'enveloppe, l'automate, les fondus. Aucune allocation. */
  private pas(dt: number) {
    const e = this.automate.etat;
    const r = this.reduit;
    this.horloge += dt;
    // 1. Le niveau brut et les bandes, selon la source.
    let brut = 0;
    const ecoute = e === "ecoute" || e === "parole";
    if (ecoute) {
      if (this.force != null) {
        brut = this.force;
        const t = this.horloge;
        for (let i = 0; i < 4; i++) this.bandesRel[i] = 0.65 + 0.35 * Math.sin(t * (0.7 + i * 0.23) + i * 1.7);
      } else if (this.analyseur && this.ctx) {
        this.analyseur.getFloatTimeDomainData(this.tampon);
        brut = this.plancher.pas(rmsDb(this.tampon), dt);
        this.analyseur.getFloatFrequencyData(this.spectre);
        bandes(this.spectre, this.ctx.sampleRate, this.bandesBrutes);
        repartition(this.bandesBrutes, this.bandesRel);
      } else if (this.synth || this.demoAttr) {
        this.synth ??= new ParoleSynthetique(11);
        brut = this.synth.pas(dt);
        this.bandesRel.set(this.synth.bandes);
      }
    }
    this.brut = brut;
    this.env = enveloppe(this.env, brut, dt, r ? 0.18 : 0.03, r ? 0.7 : 0.22);
    const kb = 1 - Math.exp(-dt / (r ? 0.6 : 0.12));
    for (let i = 0; i < 4; i++) this.bandesAff[i] = this.bandesAff[i]! + (this.bandesRel[i]! - this.bandesAff[i]!) * kb;
    if (r) {
      this.aff += (this.env - this.aff) * (1 - Math.exp(-dt / 0.25));
      this.affV = 0;
    } else [this.aff, this.affV] = springStep(this.aff, this.affV, this.env, dt, NIVEAU);
    this.aff = clamp(this.aff, 0, 1.1);

    // 2. L'automate (data-voix-auto).
    const suite = this.automate.pas(dt, brut);
    if (suite) this.aller(suite, "auto");
    const e2 = this.automate.etat;

    // 3. Les fondus entre états.
    const tE = e2 === "ecoute" || e2 === "parole" ? 1 : 0;
    const tR = e2 === "reflexion" ? 1 : 0;
    const tB = e2 === "repos" && this.braise ? 1 : 0;
    [this.wE, this.wEv] = springStep(this.wE, this.wEv, tE, dt, FONDU);
    [this.wR, this.wRv] = springStep(this.wR, this.wRv, tR, dt, FONDU);
    [this.wB, this.wBv] = springStep(this.wB, this.wBv, tB, dt, FONDU);
    if (Math.abs(this.wE - tE) < 0.001 && Math.abs(this.wEv) < 0.001) ((this.wE = tE), (this.wEv = 0));
    if (Math.abs(this.wR - tR) < 0.001 && Math.abs(this.wRv) < 0.001) ((this.wR = tR), (this.wRv = 0));
    if (Math.abs(this.wB - tB) < 0.001 && Math.abs(this.wBv) < 0.001) ((this.wB = tB), (this.wBv = 0));
    if (!tE && this.wE === 0 && this.aff < 0.002) ((this.aff = 0), (this.affV = 0), (this.env = 0));

    // 4. Le temps du bruit et du balayage (figés en mouvement réduit), la pulsation.
    if (!r) {
      this.temps = (this.temps + dt) % 1000;
      if (this.wR > 0.001) this.phase = (this.phase + dt * (Math.PI / 1.45)) % (Math.PI * 2000);
    }
    if (this.wR > 0.001) this.pulse = 0.5 - 0.5 * Math.cos((this.horloge * Math.PI * 2) / 2.6);

    // 5. L'événement voix:niveau (au plus ~15 par seconde, seulement quand il change).
    const now = this.horloge;
    if (now - this.dernierEnvoi >= 1 / 15) {
      const v = Math.round(this.env * 1000) / 1000;
      if (v !== this.dernierEnvoye || (ecoute && v > 0)) {
        this.dernierEnvoi = now;
        this.dernierEnvoye = v;
        this.el.dispatchEvent(new CustomEvent("voix:niveau", { bubbles: true, detail: { niveau: v, bandes: Array.from(this.bandesAff, (b) => Math.round(b * 1000) / 1000) } }));
      }
    }
  }

  private dessiner() {
    const vide = this.wE < 0.001 && this.wR < 0.001 && this.wB < 0.001;
    if (this.gpu) {
      const p = this.params;
      const d = this.debord * this.dpr;
      p.largeur = this.canvas.width;
      p.hauteur = this.canvas.height;
      p.dpr = this.dpr;
      p.temps = this.temps;
      p.boite.x = d;
      p.boite.y = 0;
      p.boite.l = this.W * this.dpr;
      p.boite.h = this.H * this.dpr;
      p.rayon = this.rayon * this.dpr;
      p.debord = d;
      p.hauteurLueur = this.hauteur;
      p.force = this.intensite;
      p.ecoute = this.wE;
      p.reflexion = this.wR;
      p.braise = this.wB;
      p.niveau = this.aff;
      p.phase = this.phase;
      p.clair = this.clair;
      p.reduit = this.reduit;
      p.pulse = this.pulse;
      remplirUniformes(this.u, p);
      this.gpu.draw(this.u, vide);
    } else if (this.gpuEchec) {
      // Repli CSS : mêmes états, un dégradé.
      const s = this.repli.style;
      const lvl = clamp(this.aff, 0, 1);
      let x = 50;
      if (this.wR > this.wE) x = this.reduit ? 50 : (0.5 - 0.5 * Math.cos(this.phase)) * 112 - 6;
      else {
        let sw = 0;
        let sx = 0;
        for (let i = 0; i < 4; i++) ((sw += this.bandesAff[i]!), (sx += this.bandesAff[i]! * (i + 0.5) * 25));
        x = sw > 0 ? 50 + (sx / sw - 50) * 0.8 : 50;
      }
      const h = this.hauteur * (this.wE * (0.22 + 0.78 * lvl) + this.wR * 0.45 + this.wB * 0.15);
      const op = clamp((this.wE * (0.55 + 0.45 * lvl) + this.wR * (this.reduit ? 0.3 + 0.55 * this.pulse : 0.85) + this.wB * 0.25) * this.intensite, 0, 1);
      s.setProperty("--voix-niveau", (Math.round(h * 1000) / 1000).toString());
      s.setProperty("--voix-x", `${x.toFixed(1)}%`);
      s.setProperty("--voix-opacite", op.toFixed(3));
    }
  }
}

/** Fond clair ou sombre : la première couleur de fond opaque en remontant les ancêtres (clair par défaut). */
function devinerClair(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const c = lireCouleur(getComputedStyle(n).backgroundColor);
    const a = /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(getComputedStyle(n).backgroundColor);
    if (c && (!a || Number(a[1]) > 0.5)) return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.5;
  }
  return !(typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches);
}

/** N'importe quelle couleur CSS → [r, g, b] (via le style calculé). */
function lireCouleurCss(el: HTMLElement, s: string): [number, number, number] | null {
  const direct = lireCouleur(s);
  if (direct) return direct;
  const sp = document.createElement("span");
  sp.style.color = s;
  sp.style.display = "none";
  el.append(sp);
  const c = lireCouleur(getComputedStyle(sp).color);
  sp.remove();
  return c;
}

const instances = new Map<HTMLElement, Voix>();
let io: IntersectionObserver | null = null;
function observateur() {
  io ??= new IntersectionObserver(
    (es) => {
      for (const e of es) instances.get(e.target as HTMLElement)?.setVisible(e.isIntersecting);
    },
    { rootMargin: "64px" },
  );
  return io;
}

function apiDe(v: Voix): VoixApi {
  return {
    ecouter: () => v.ecouter(),
    arreter: () => v.arreter(),
    etat: (e) => v.etat(e),
    niveau: (x) => v.niveau(x),
    brancher: (s) => v.brancher(s),
    demo: () => v.demo(),
    detruire: () => v.detruire(),
  };
}

/** Le composant voix d'un élément (armé au besoin). */
export function voix(el: HTMLElement): VoixApi {
  let v = instances.get(el);
  if (!v) {
    if (!el.hasAttribute("data-voix")) el.setAttribute("data-voix", "");
    v = new Voix(el);
    instances.set(el, v);
    el.dataset.voixPret = "";
  }
  return apiDe(v);
}

let suivi = false;
/** Arme tous les [data-voix] de la page (ou de `root`) et ceux qui arrivent ensuite. */
export function initVoix(root: ParentNode = document) {
  if (typeof document === "undefined") return;
  root.querySelectorAll<HTMLElement>("[data-voix]").forEach((el) => voix(el));
  if (root === document && !suivi) {
    suivi = true;
    new MutationObserver((ms) => {
      for (const m of ms) {
        for (const n of m.addedNodes) if (n instanceof HTMLElement) (n.matches("[data-voix]") ? [n] : [...n.querySelectorAll<HTMLElement>("[data-voix]")]).forEach((el) => voix(el));
        for (const n of m.removedNodes)
          if (n instanceof HTMLElement)
            for (const [el, v] of instances) if (n === el || n.contains(el)) if (!el.isConnected) v.detruire();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
}
