/**
 * Le geste direct : ce qui fait qu'un glisser-déposer « colle » à la main et qu'un lâcher part avec elle.
 *
 * Repris des règles que Rune (anomalyco/rune, recherche 15) a relevées chez Android, iOS et Material :
 *
 * 1. **Pendant le geste, rien n'anime la main** : l'objet suit le pointeur 1:1 (pas de ressort sur la position tenue).
 * 2. **La vitesse au lâcher** vient de l'estimateur « impulsion » d'Android (`VelocityTracker`) : le pointeur est un
 *    objet dont l'énergie cinétique au lâcher égale le travail fourni ; robuste au bruit, sans rebond. Historique de
 *    100 ms ; si le pointeur s'est arrêté plus de 40 ms avant le lâcher, la vitesse est nulle.
 * 3. **On projette le lancer** (WWDC18, « Designing Fluid Interfaces ») : là où la décélération d'iOS l'amènerait,
 *    `x + v/1000 · r/(1 − r)`, puis on choisit la cible d'après ce point.
 * 4. **Le ressort part avec la vitesse du doigt** (`Ressort.lacher`), évalué en forme exacte : le même mouvement à
 *    30, 60 ou 144 Hz, interrompable à tout moment sans saut de position ni de vitesse.
 * 5. **Deux familles de ressorts** (Material 3 Expressive) : `espace` (position, taille, rotation) peut dépasser ;
 *    `effet` (opacité, couleur, flou, lueur) ne dépasse jamais sa cible ni son départ.
 * 6. **Au-delà d'un bord, l'élastique** d'iOS : `(1 − 1/(x·c/d + 1))·d`, c = 0,55.
 *
 * Module sans DOM : il tourne aussi sous Node (gesture.test.ts).
 */

/* ───────────────────────── Vitesse ───────────────────────── */

const HORIZON = 100; // ms
const STOPPED = 40; // ms
const MAX_SAMPLES = 20;

/** Vitesse d'un axe, en unités par seconde. `add(t_ms, x)` à chaque événement (coalescés compris), `get(t_ms)`. */
export class Vitesse {
  private t: number[] = [];
  private x: number[] = [];
  add(t: number, x: number) {
    const n = this.t.length;
    if (n && t < this.t[n - 1]!) this.reset();
    // Deux échantillons au même instant : le dernier compte.
    if (n && t === this.t[this.t.length - 1]) this.x[this.x.length - 1] = x;
    else {
      this.t.push(t);
      this.x.push(x);
    }
    while (this.t.length > MAX_SAMPLES || (this.t.length > 2 && t - this.t[0]! > HORIZON)) {
      this.t.shift();
      this.x.shift();
    }
  }
  reset() {
    this.t.length = 0;
    this.x.length = 0;
  }
  /** Vitesse à l'instant `now` (par défaut : le dernier échantillon). */
  get(now?: number) {
    const n = this.t.length;
    if (n < 2) return 0;
    const last = this.t[n - 1]!;
    if (now !== undefined && now - last > STOPPED) return 0;
    // Échantillons dans l'horizon ; on s'arrête aussi à une pause de plus de 40 ms (le geste a recommencé après).
    let i0 = n - 1;
    while (i0 > 0 && last - this.t[i0 - 1]! <= HORIZON && this.t[i0]! - this.t[i0 - 1]! <= STOPPED) i0--;
    if (i0 === n - 1) return 0;
    // AOSP VelocityTracker, stratégie impulsion : du plus ancien au plus récent.
    let work = 0;
    for (let i = i0 + 1; i < n; i++) {
      const dt = (this.t[i]! - this.t[i - 1]!) / 1000;
      if (dt <= 0) continue;
      const vPrev = energyToV(work);
      const vCur = (this.x[i]! - this.x[i - 1]!) / dt;
      work += (vCur - vPrev) * Math.abs(vCur);
      // Condition initiale : l'objet n'était pas au repos au premier échantillon.
      if (i === i0 + 1) work *= 0.5;
    }
    return energyToV(work);
  }
}
const energyToV = (w: number) => Math.sign(w) * Math.sqrt(2 * Math.abs(w));

/** Les deux axes d'un pointeur. */
export class Vitesse2 {
  readonly x = new Vitesse();
  readonly y = new Vitesse();
  add(t: number, x: number, y: number) {
    this.x.add(t, x);
    this.y.add(t, y);
  }
  /** Ajoute un événement de pointeur, avec ses événements coalescés quand le navigateur les donne. */
  addEvent(e: { timeStamp: number; clientX: number; clientY: number; getCoalescedEvents?: () => { timeStamp: number; clientX: number; clientY: number }[] }) {
    const list = e.getCoalescedEvents?.() ?? [];
    if (list.length) for (const c of list) this.add(c.timeStamp, c.clientX, c.clientY);
    else this.add(e.timeStamp, e.clientX, e.clientY);
  }
  reset() {
    this.x.reset();
    this.y.reset();
  }
  get(now?: number): [number, number] {
    return [this.x.get(now), this.y.get(now)];
  }
}

/* ───────────────────────── Lancer, élastique ───────────────────────── */

/** Décélération d'iOS (UIScrollView), par milliseconde. */
export const DECELERATION = { normale: 0.998, rapide: 0.99 } as const;

/** Où un lancer parti de `x` à `v` (unités/s) s'arrête sous la décélération `rate` (par ms). */
export function projette(x: number, v: number, rate: number = DECELERATION.normale) {
  return x + (v / 1000) * (rate / (1 - rate));
}

/** Élastique d'iOS : de combien bouge un contenu tiré `over` au-delà de son bord, sur une longueur `dim`. */
export function elastique(over: number, dim: number, c = 0.55) {
  if (dim <= 0) return 0;
  const x = Math.abs(over);
  return Math.sign(over) * (1 - 1 / ((x * c) / dim + 1)) * dim;
}

/** Ramène `x` dans [min, max], l'excédent passé à l'élastique. */
export function elastiqueEntre(x: number, min: number, max: number, dim: number, c = 0.55) {
  if (x < min) return min + elastique(x - min, dim, c);
  if (x > max) return max + elastique(x - max, dim, c);
  return x;
}

/* ───────────────────────── Ressort exact ───────────────────────── */

export type Classe = "espace" | "effet";
/** Un ressort par sa réponse (s, période sans amortissement) et son rebond (0 : aucun ; 0,3 : vif) — comme SwiftUI. */
export type Reglage = { reponse: number; rebond: number };
export const REGLAGES = {
  /** Le lâcher d'un glisser : franc, un rien de rebond. */
  lacher: { reponse: 0.38, rebond: 0.18 },
  /** Les voisins qui font place : sans rebond, pour que la liste ne tremble pas. */
  place: { reponse: 0.32, rebond: 0 },
  /** Un retour au repos, doux. */
  doux: { reponse: 0.55, rebond: 0 },
  /** Un effet (opacité, lueur) : rapide, jamais de dépassement. */
  effet: { reponse: 0.22, rebond: 0 },
} as const satisfies Record<string, Reglage>;

/** Position et vitesse d'un oscillateur amorti après `t` s, déplacement `y0` et vitesse `v0` au départ (forme exacte). */
export function oscille(y0: number, v0: number, t: number, w0: number, zeta: number): [number, number] {
  if (t <= 0) return [y0, v0];
  if (zeta < 1 - 1e-6) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * w0 * t);
    const c = Math.cos(wd * t);
    const s = Math.sin(wd * t);
    const b = (v0 + zeta * w0 * y0) / wd;
    const y = e * (y0 * c + b * s);
    const v = e * (-y0 * wd * s + b * wd * c) - zeta * w0 * y;
    return [y, v];
  }
  if (zeta <= 1 + 1e-6) {
    const e = Math.exp(-w0 * t);
    const b = v0 + w0 * y0;
    return [(y0 + b * t) * e, (v0 - w0 * t * b) * e];
  }
  const r = w0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * w0 + r;
  const r2 = -zeta * w0 - r;
  const c2 = (v0 - r1 * y0) / (r2 - r1);
  const c1 = y0 - c2;
  const e1 = Math.exp(r1 * t);
  const e2 = Math.exp(r2 * t);
  return [c1 * e1 + c2 * e2, c1 * r1 * e1 + c2 * r2 * e2];
}

/**
 * Une valeur menée par un ressort. `vers(cible)` à tout moment garde la position et la vitesse présentes ; `tiens(x)`
 * la met sous la main (1:1, sans animation) ; `lacher(v)` la rend au ressort avec la vitesse du geste.
 * `pas(dt)` avance (forme exacte, indépendante de la cadence) et dit si elle bouge encore.
 */
export class Ressort {
  x: number;
  v = 0;
  cible: number;
  private w0: number;
  private zeta: number;
  private lo = -Infinity;
  private hi = Infinity;
  private tenu = false;
  readonly classe: Classe;
  /** En deçà, le ressort est posé (unités de la valeur : 1/64 px pour une position, 1/256 pour une opacité). */
  readonly eps: number;
  constructor(x: number, reglage: Reglage = REGLAGES.lacher, classe: Classe = "espace", eps = classe === "effet" ? 1 / 256 : 1 / 64) {
    this.classe = classe;
    this.eps = eps;
    this.x = this.cible = x;
    this.w0 = 0;
    this.zeta = 1;
    this.regle(reglage);
  }
  regle(r: Reglage) {
    this.w0 = (2 * Math.PI) / Math.max(0.02, r.reponse);
    // Un effet ne rebondit jamais (amorti critique au moins).
    this.zeta = this.classe === "effet" ? Math.max(1, 1 - r.rebond) : 1 - Math.min(0.95, Math.max(-1, r.rebond));
    return this;
  }
  vers(cible: number) {
    this.tenu = false;
    this.cible = cible;
    this.borne();
    return this;
  }
  /** Sous la main : la valeur suit, sa vitesse est celle de la main (pour un lâcher sans couture). */
  tiens(x: number, v = this.v) {
    this.tenu = true;
    this.x = this.cible = x;
    this.v = v;
  }
  lacher(v: number, cible = this.cible) {
    this.tenu = false;
    this.v = v;
    this.cible = cible;
    this.borne();
    return this;
  }
  /** Pose immédiatement (mouvement réduit, premier affichage). */
  pose(x: number) {
    this.tenu = false;
    this.x = this.cible = x;
    this.v = 0;
  }
  get repos() {
    return !this.tenu && this.x === this.cible && this.v === 0;
  }
  pas(dt: number) {
    if (this.tenu || this.repos) return false;
    const [y, v] = oscille(this.x - this.cible, this.v, dt, this.w0, this.zeta);
    this.x = this.cible + y;
    this.v = v;
    if (this.classe === "effet") this.x = Math.min(this.hi, Math.max(this.lo, this.x));
    // Posé : l'instant où il ne bouge plus d'une fraction de pixel, puis exactement à sa place.
    if (Math.abs(y) < this.eps && Math.abs(v) < this.eps * 8) {
      this.x = this.cible;
      this.v = 0;
      return false;
    }
    return true;
  }
  private borne() {
    this.lo = Math.min(this.x, this.cible);
    this.hi = Math.max(this.x, this.cible);
  }
}
