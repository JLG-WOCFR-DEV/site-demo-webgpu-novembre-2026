/**
 * Le linter de mouvement (d'après le « motion-lint » de Rune) : il regarde chaque valeur réellement écrite, image par
 * image, et signale ce qui se voit comme un défaut.
 *
 * - **saut** : une position qui bouge de plus de `jump` px en une image, sans vitesse avant (une téléportation) ;
 * - **apparition sèche / disparition sèche** : une opacité qui change de plus d'un tiers en une image ;
 * - **arrêt net** : une valeur lancée qui s'arrête d'une image à l'autre (une courbe linéaire, un ressort coupé) ;
 * - **saut de vitesse** : une accélération absurde au milieu d'un mouvement (une cible changée sans garder la vitesse) ;
 * - **tremblement** : la vitesse qui change de signe plus de deux fois en 200 ms, sur de petites amplitudes.
 *
 * Activé par `?presse-lint` (ou `enableLint()`), branché sur l'écrivain du moteur de temps : tout `data-anim`,
 * toute timeline et tout ressort passent par lui. Une page peut aussi lui donner ses propres valeurs (`lintSample`).
 * Les constats vont dans la console (groupés) et dans `window.__presse.lint`. Sans DOM : testé sous Node.
 */

export type Rule = "saut" | "apparition-seche" | "disparition-seche" | "arret-net" | "saut-de-vitesse" | "tremblement";
export type Finding = { rule: Rule; id: string; prop: string; t: number; detail: string };
type Channel = { t: number; v: number; vel: number; flips: number[]; started: boolean };

const SPATIAL = new Set(["x", "y", "translate", "left", "top", "width", "height", "scale-px"]);
const OPACITY = new Set(["opacity", "alpha"]);

export type LintOptions = {
  /** Px par image au-delà desquels un déplacement sans vitesse préalable est un saut. */
  jump?: number;
  /** Part d'opacité par image au-delà de laquelle c'est une apparition ou une disparition sèche. */
  opacityStep?: number;
  /** Vitesse (px/s) au-delà de laquelle un arrêt à zéro en une image est un « arrêt net ». */
  stopSpeed?: number;
  /** Accélération (px/s²) jugée absurde au milieu d'un mouvement. */
  maxAccel?: number;
};

export class MotionLint {
  readonly findings: Finding[] = [];
  private ch = new Map<string, Channel>();
  private o: Required<LintOptions>;
  onFinding: ((f: Finding) => void) | null = null;
  constructor(o: LintOptions = {}) {
    this.o = { jump: 48, opacityStep: 0.34, stopSpeed: 300, maxAccel: 60000, ...o };
  }

  /** Une valeur présentée à l'instant t (ms). `intent` : un saut voulu (une coupure, un premier affichage). */
  sample(id: string, prop: string, v: number, t: number, intent = false) {
    const key = `${id}\u0000${prop}`;
    const c = this.ch.get(key);
    if (!c) {
      this.ch.set(key, { t, v, vel: 0, flips: [], started: false });
      return;
    }
    const dt = (t - c.t) / 1000;
    if (dt <= 0) {
      c.v = v;
      return;
    }
    const vel = (v - c.v) / dt;
    const dv = v - c.v;
    const spatial = SPATIAL.has(prop) || prop.endsWith("-px");
    const opacity = OPACITY.has(prop);
    // Une image « normale » : au plus 50 ms (un onglet revenu de l'arrière-plan n'est pas un saut).
    const frame = dt <= 0.05;
    if (!intent && frame) {
      // Le seuil est par image à 60 Hz : une image lente (30 Hz, un GPU logiciel) en parcourt deux fois plus sans sauter.
      if (spatial && Math.abs(dv) > this.o.jump * Math.max(1, dt * 60) && Math.abs(c.vel) < 1) this.add("saut", id, prop, t, `${dv.toFixed(1)} px en une image`);
      if (opacity && Math.abs(dv) > this.o.opacityStep) this.add(dv > 0 ? "apparition-seche" : "disparition-seche", id, prop, t, `${c.v.toFixed(2)} → ${v.toFixed(2)} en une image`);
      // Seuil d'arrêt : en px/s pour une position, en unités d'opacité par seconde (3 : le tiers d'une seconde).
      const stopThr = opacity ? 3 : this.o.stopSpeed;
      // (Une opacité qui vient de sauter — plus de 20/s — est déjà signalée comme apparition ou disparition sèche.)
      const snapped = opacity && Math.abs(c.vel) > 20;
      if ((spatial || opacity) && !snapped && c.started && Math.abs(c.vel) > stopThr && Math.abs(vel) < Math.abs(c.vel) * 0.04)
        this.add("arret-net", id, prop, t, `${c.vel.toFixed(opacity ? 2 : 0)} → ${vel.toFixed(opacity ? 2 : 0)} /s`);
      const acc = Math.abs(vel - c.vel) / dt;
      if (spatial && c.started && Math.abs(c.vel) > 50 && acc > this.o.maxAccel && Math.sign(vel) !== Math.sign(c.vel) && Math.abs(vel) > 50)
        this.add("saut-de-vitesse", id, prop, t, `${Math.round(c.vel)} → ${Math.round(vel)} px/s`);
      // Tremblement : la vitesse change de signe souvent, sur peu d'amplitude.
      if (Math.sign(vel) !== Math.sign(c.vel) && Math.abs(vel) > 1e-3 && Math.abs(c.vel) > 1e-3 && Math.abs(dv) < (spatial ? 3 : 0.03)) {
        c.flips.push(t);
        while (c.flips.length && t - c.flips[0]! > 200) c.flips.shift();
        if (c.flips.length > 2) {
          this.add("tremblement", id, prop, t, `${c.flips.length} changements de sens en 200 ms`);
          c.flips.length = 0;
        }
      }
    }
    c.started = Math.abs(vel) > 1e-6;
    c.t = t;
    c.v = v;
    c.vel = intent ? 0 : vel;
  }
  /** Le canal disparaît (élément démonté) : la prochaine valeur repart de zéro. */
  forget(id: string) {
    for (const k of [...this.ch.keys()]) if (k.startsWith(`${id}\u0000`)) this.ch.delete(k);
  }
  private last = new Map<string, number>();
  private add(rule: Rule, id: string, prop: string, t: number, detail: string) {
    // Un même défaut sur le même canal : signalé au plus une fois par seconde.
    const k = `${rule}\u0000${id}\u0000${prop}`;
    if (t - (this.last.get(k) ?? -1e9) < 1000) return;
    this.last.set(k, t);
    const f = { rule, id, prop, t, detail };
    this.findings.push(f);
    this.onFinding?.(f);
  }
}

/* ───────────────────────── Dans la page ───────────────────────── */

let lint: MotionLint | null = null;
const names = new WeakMap<object, string>();
let n = 0;
/** Un nom lisible et stable pour un élément : #id, data-anim, classe, puis un numéro. */
export function describe(el: object) {
  let s = names.get(el);
  if (s) return s;
  const e = el as Partial<Element>;
  const cls = typeof e.className === "string" ? e.className.split(/\s+/).filter(Boolean)[0] : "";
  s = e.id ? `#${e.id}` : `${e.tagName?.toLowerCase() ?? "objet"}${cls ? `.${cls}` : ""}#${++n}`;
  names.set(el, s);
  return s;
}
export function enableLint(o?: LintOptions) {
  lint ??= new MotionLint(o);
  const w = window as unknown as { __presse?: Record<string, unknown> };
  w.__presse ??= {};
  w.__presse.lint = lint.findings;
  let pending: Finding[] = [];
  let timer = 0;
  lint.onFinding = (f) => {
    pending.push(f);
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      console.groupCollapsed(`[presse:mouvement] ${pending.length} constat(s)`);
      for (const p of pending) console.warn(`${p.rule} — ${p.id} ${p.prop} : ${p.detail} (à ${Math.round(p.t)} ms)`);
      console.groupEnd();
      pending = [];
    }, 400);
  };
  return lint;
}
export const lintOn = () => lint !== null;
/** Une valeur présentée, pour les pages qui animent elles-mêmes (sans le moteur de temps). */
export function lintSample(el: object | string, prop: string, v: number, t: number, intent = false) {
  if (!lint) return;
  lint.sample(typeof el === "string" ? el : describe(el), prop, v, t, intent);
}
if (typeof location !== "undefined" && new URLSearchParams(location.search).has("presse-lint")) enableLint();
