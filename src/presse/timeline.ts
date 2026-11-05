/**
 * Presse — le moteur de temps.
 *
 * « Timing engines are where most custom frameworks quietly die » (sous la vidéo d'Aristide Benoist, novembre 2026).
 * Celui-ci tient en quatre règles :
 *
 * 1. **Une seule horloge.** `clockNow()` : performance.now(), ou l'horloge virtuelle de l'enregistreur pendant une
 *    capture vidéo. Une boucle unique, qui ne tourne que s'il y a quelque chose à animer ; un onglet revenu de l'arrière-plan
 *    ne fait pas sauter les animations (lissage du retard : au-delà d'une seconde, une image compte pour 1/60 s). Les tests
 *    l'avancent à la main (`advance`).
 * 2. **Le temps se cale.** Une timeline n'est pas une suite d'événements mais une fonction du temps : `seek(t)` donne le
 *    même état quel que soit le chemin pour y arriver. D'où le reste gratuit : jouer, renverser à mi-course, piloter au
 *    défilement (`progress`), rejouer, sauter à la fin (mouvement réduit).
 * 3. **Interrompable.** Renverser repart de l'état courant, à la même vitesse ; un ressort (`ressort`) garde sa vitesse
 *    quand sa cible change.
 * 4. **Le DOM fait foi.** Les pistes écrivent des propriétés CSS (`translate`, `scale`, `rotate`, `opacity`, `filter`,
 *    `clip-path`, variables `--x`) : les plans et le texte du GPU suivent la boîte de leur élément, sans rien savoir.
 *
 * En HTML, sans script à écrire (`initAnim`) :
 *   <h2 data-anim="monte">…</h2>
 *   <ul data-anim="monte" data-anim-stagger="0.06">…</ul>             (les enfants, l'un après l'autre)
 *   <figure data-anim="y 0 -80; scale 1 1.08" data-anim-trigger="defilement">…</figure>
 *   <a data-anim="x 0 6; --fleche 0 1" data-anim-trigger="survol">…</a>
 * Déclencheurs : entree (par défaut, une fois, à 85 % de l'écran), defilement (piloté par la traversée de l'écran),
 * survol, appui, chargement (après le rideau d'entrée). Options : data-anim-dur, -delay, -ease, -stagger, -repeat.
 */
import { clockNow } from "../gpu/clock.ts";
import { DUR, spring as springCurve, springStep, SPRINGS, type Spring } from "./tokens.ts";

/* ───────────────────────── Courbes ───────────────────────── */

export type Ease = (t: number) => number;

/** Une courbe de Bézier cubique, comme en CSS (résolue par Newton, puis dichotomie). */
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
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

/** Les courbes de la maison, mêmes noms qu'en CSS (jetons de mouvement). */
export const EASES: Record<string, Ease> = {
  lineaire: (t) => t,
  out: bezier(0.16, 1, 0.3, 1),
  "in-out": bezier(0.65, 0, 0.35, 1),
  in: bezier(0.55, 0, 1, 0.45),
  expo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  ressort: (t) => springCurve(t),
};
const easeOf = (e: string | Ease | undefined): Ease => (typeof e === "function" ? e : EASES[e ?? "out"] ?? EASES.out!);

/* ───────────────────────── L'horloge ───────────────────────── */

type Ticking = { step(dt: number): boolean };
const ticking = new Set<Ticking>();
let raf = 0;
let last = 0;
let manual = false;

function frame() {
  raf = 0;
  const now = clockNow();
  let dt = (now - last) / 1000;
  last = now;
  // Lissage du retard : un onglet revenu de l'arrière-plan (rAF suspendu) ne fait pas sauter les animations. En deçà
  // d'une seconde, c'est une machine lente : le temps réel compte, l'animation garde sa durée au lieu de se traîner.
  if (dt > 1) dt = 1 / 60;
  run(dt);
  if (ticking.size && !manual) raf = requestAnimationFrame(frame);
}
function run(dt: number) {
  for (const t of [...ticking]) if (!t.step(dt)) ticking.delete(t);
  for (const f of afterFrame) f();
  flush();
}
const afterFrame = new Set<() => void>();
function wake(t: Ticking) {
  ticking.add(t);
  if (manual || raf || typeof requestAnimationFrame === "undefined") return;
  last = clockNow();
  raf = requestAnimationFrame(frame);
}
/**
 * Une fonction appelée à chaque image de l'horloge commune (dt en secondes), tant qu'elle ne renvoie pas false et qu'on
 * ne l'a pas arrêtée. Pour les composants qui ont leur propre physique (tambour…) : même horloge, même lissage du retard.
 */
export function everyFrame(fn: (dt: number) => boolean | void) {
  let alive = true;
  const t: Ticking = { step: (dt) => alive && fn(dt) !== false };
  wake(t);
  return {
    stop: () => void (alive = false),
    wake: () => {
      if (alive && !ticking.has(t)) wake(t);
    },
  };
}

/** Tests et captures : l'horloge n'avance plus que par `advance`. */
export function manualClock(on = true) {
  manual = on;
  if (on && raf) (cancelAnimationFrame(raf), (raf = 0));
}
/** Avance l'horloge de `dt` secondes (horloge manuelle). */
export function advance(dt: number, step = 1 / 60) {
  for (let t = 0; t < dt - 1e-9; t += step) run(Math.min(step, dt - t));
}

let reducedQuery: MediaQueryList | null = null;
/** Mouvement réduit : les animations sautent à leur état final. Forçable (tests). */
export let forceReduced: boolean | null = null;
export function setReduced(v: boolean | null) {
  forceReduced = v;
}
export function reducedMotion() {
  if (forceReduced !== null) return forceReduced;
  if (typeof matchMedia === "undefined") return false;
  reducedQuery ??= matchMedia("(prefers-reduced-motion: reduce)");
  return reducedQuery.matches;
}

/* ───────────────────────── Écriture des propriétés ───────────────────────── */

/** Ce qui reçoit les valeurs : un élément, ou tout objet qui a un style (les tests). */
export type Target = { style: { setProperty(name: string, value: string): void } };
type Val = { n: number; unit: string };
type State = Map<string, Val>;
const states = new WeakMap<Target, State>();
const dirty = new Set<Target>();

/** Unité par défaut de chaque propriété. */
const UNIT: Record<string, string> = { x: "px", y: "px", rotate: "deg", blur: "px", clip: "%", "clip-x": "%", "clip-top": "%" };
const DEFAULT: Record<string, number> = { scale: 1, opacity: 1 };
export const PROPS = ["x", "y", "scale", "rotate", "opacity", "blur", "clip", "clip-x", "clip-top"] as const;

function parse(v: number | string, prop: string): Val {
  if (typeof v === "number") return { n: v, unit: UNIT[prop] ?? "" };
  const m = /^(-?[\d.]+(?:e-?\d+)?)([a-z%]*)$/i.exec(v.trim());
  if (!m) throw new Error(`[presse:anim] valeur illisible pour ${prop} : « ${v} »`);
  return { n: Number(m[1]), unit: m[2] || UNIT[prop] || "" };
}
function current(t: Target, prop: string): Val {
  return states.get(t)?.get(prop) ?? { n: DEFAULT[prop] ?? 0, unit: UNIT[prop] ?? "" };
}
function set(t: Target, prop: string, v: Val) {
  let s = states.get(t);
  if (!s) states.set(t, (s = new Map()));
  s.set(prop, v);
  dirty.add(t);
}
const fmt = (v: Val | undefined, fallback: string) => (v ? `${+v.n.toFixed(4)}${v.unit}` : fallback);
/** Écrit, une fois par image, ce qui a changé. */
function flush() {
  for (const t of dirty) {
    const s = states.get(t)!;
    const st = t.style;
    if (s.has("x") || s.has("y")) st.setProperty("translate", `${fmt(s.get("x"), "0px")} ${fmt(s.get("y"), "0px")}`);
    if (s.has("scale")) st.setProperty("scale", fmt(s.get("scale"), "1"));
    if (s.has("rotate")) st.setProperty("rotate", fmt(s.get("rotate"), "0deg"));
    if (s.has("opacity")) st.setProperty("opacity", String(+Math.min(1, Math.max(0, s.get("opacity")!.n)).toFixed(4)));
    if (s.has("blur")) {
      const b = s.get("blur")!;
      st.setProperty("filter", b.n > 0.01 ? `blur(${fmt(b, "0px")})` : "");
    }
    if (s.has("clip") || s.has("clip-x") || s.has("clip-top")) {
      // Un masque qui se lève : inset(haut droite bas gauche).
      st.setProperty("clip-path", `inset(${fmt(s.get("clip-top"), "0%")} ${fmt(s.get("clip-x"), "0%")} ${fmt(s.get("clip"), "0%")} 0%)`);
    }
    for (const [k, v] of s) if (k.startsWith("--")) st.setProperty(k, fmt(v, "0"));
  }
  dirty.clear();
}

/* ───────────────────────── La timeline ───────────────────────── */

export type Vars = Partial<Record<(typeof PROPS)[number] | `--${string}`, number | string>>;
export type TrackOpts = { dur?: number; ease?: string | Ease; stagger?: number };
type Track = { t: Target; prop: string; from: Val | null; to: Val; start: number; dur: number; ease: Ease; lazy: boolean };
type Call = { at: number; fn: () => void; done: boolean };

/** Une timeline : des pistes posées dans le temps (secondes). */
export class Timeline implements Ticking {
  private tracks: Track[] = [];
  private calls: Call[] = [];
  private labels = new Map<string, number>();
  private prevStart = 0;
  private prevEnd = 0;
  duration = 0;
  time = 0;
  /** Sens et vitesse de lecture (1 : avant, −1 : arrière). */
  rate = 1;
  playing = false;
  private resolveDone: (() => void) | null = null;
  /** Appelé à chaque image où le temps a bougé. */
  onUpdate: ((tl: Timeline) => void) | null = null;

  /** Où poser une piste : nombre (absolu), "<" (début de la précédente), ">" (sa fin, par défaut), "+=0.2", "-=0.1", "<0.1", une étiquette, "étiquette+=0.2". */
  private at(pos: number | string | undefined) {
    if (typeof pos === "number") return pos;
    if (pos === undefined || pos === ">") return this.prevEnd;
    if (pos === "<") return this.prevStart;
    const m = /^([<>]|[^+\-<>]+)?([+-]=?)?(-?[\d.]+)?$/.exec(pos);
    if (!m) throw new Error(`[presse:anim] position illisible : « ${pos} »`);
    const [, base, op, num] = m;
    let b = this.prevEnd;
    if (base === "<") b = this.prevStart;
    else if (base && base !== ">") {
      if (!this.labels.has(base)) throw new Error(`[presse:anim] étiquette inconnue : « ${base} »`);
      b = this.labels.get(base)!;
    }
    const n = Number(num ?? 0);
    return b + (op?.startsWith("-") ? -n : n);
  }

  label(name: string, pos?: number | string) {
    this.labels.set(name, this.at(pos));
    return this;
  }

  private add(targets: Target | Target[], from: Vars | null, to: Vars, o: TrackOpts & { at?: number | string }, lazy: boolean) {
    const list = Array.isArray(targets) ? targets : [targets];
    const start = this.at(o.at);
    const dur = Math.max(0, o.dur ?? DUR[3] / 1000);
    const ease = easeOf(o.ease);
    const stagger = o.stagger ?? 0;
    list.forEach((t, i) => {
      for (const [prop, v] of Object.entries(to)) {
        if (v === undefined) continue;
        const tv = parse(v, prop);
        const fv = from && from[prop as keyof Vars] !== undefined ? parse(from[prop as keyof Vars]!, prop) : null;
        if (fv && fv.unit !== tv.unit && fv.n !== 0 && tv.n !== 0) throw new Error(`[presse:anim] ${prop} : unités différentes (${fv.unit} → ${tv.unit})`);
        // 0 sans unité prend celle de l'autre bout.
        if (fv && fv.unit !== tv.unit) (fv.n === 0 ? (fv.unit = tv.unit) : (tv.unit = fv.unit));
        this.tracks.push({ t, prop, from: fv, to: tv, start: start + i * stagger, dur, ease, lazy: lazy && !fv });
      }
    });
    this.prevStart = start;
    this.prevEnd = start + dur + Math.max(0, list.length - 1) * stagger;
    this.duration = Math.max(this.duration, this.prevEnd);
    this.tracks.sort((a, b) => a.start - b.start);
    return this;
  }
  /** Des valeurs courantes vers `to`. */
  to(targets: Target | Target[], to: Vars, o: TrackOpts & { at?: number | string } = {}) {
    return this.add(targets, null, to, o, true);
  }
  /** De `from` vers les valeurs courantes (ou les valeurs par défaut). */
  from(targets: Target | Target[], from: Vars, o: TrackOpts & { at?: number | string } = {}) {
    const list = Array.isArray(targets) ? targets : [targets];
    const to: Vars = {};
    for (const k of Object.keys(from)) {
      const c = current(list[0]!, k);
      (to as Record<string, string>)[k] = `${c.n}${parse(from[k as keyof Vars]!, k).unit || c.unit}`;
    }
    return this.add(targets, from, to, o, false);
  }
  fromTo(targets: Target | Target[], from: Vars, to: Vars, o: TrackOpts & { at?: number | string } = {}) {
    return this.add(targets, from, to, o, false);
  }
  /** Une fonction appelée quand la tête de lecture passe `at` (en avant seulement). */
  call(fn: () => void, at?: number | string) {
    const t = this.at(at);
    this.calls.push({ at: t, fn, done: false });
    this.duration = Math.max(this.duration, t);
    return this;
  }

  /** Pose l'état à l'instant t (secondes), sans jouer. */
  seek(t: number) {
    const prev = this.time;
    this.time = Math.min(this.duration, Math.max(0, t));
    this.render(prev);
    return this;
  }
  /** Progression 0 → 1 (défilement). */
  progress(p: number) {
    return this.seek(p * this.duration);
  }
  play() {
    return this.go(1);
  }
  reverse() {
    return this.go(-1);
  }
  restart() {
    this.calls.forEach((c) => (c.done = false));
    this.seek(0);
    return this.play();
  }
  pause() {
    this.playing = false;
    return this;
  }
  /** Promesse tenue quand la lecture en cours arrive au bout. */
  finished() {
    return this.playing ? new Promise<void>((r) => (this.resolveDone = r)) : Promise.resolve();
  }
  private go(dir: 1 | -1) {
    this.rate = dir;
    if (reducedMotion()) {
      this.playing = false;
      this.seek(dir > 0 ? this.duration : 0);
      return this;
    }
    if ((dir > 0 && this.time >= this.duration) || (dir < 0 && this.time <= 0)) {
      this.playing = false;
      this.render(this.time);
      return this;
    }
    this.playing = true;
    wake(this);
    return this;
  }
  step(dt: number) {
    if (!this.playing) return false;
    const prev = this.time;
    this.time = Math.min(this.duration, Math.max(0, this.time + dt * this.rate));
    this.render(prev);
    const end = this.rate > 0 ? this.time >= this.duration : this.time <= 0;
    if (end) {
      this.playing = false;
      this.resolveDone?.();
      this.resolveDone = null;
    }
    return !end;
  }

  private render(prev: number) {
    const t = this.time;
    // Une propriété d'un élément est tenue par la dernière piste commencée ; avant la première, par sa valeur de départ.
    const held = new Map<Target, Map<string, Val>>();
    for (const k of this.tracks) {
      let m = held.get(k.t);
      if (!m) held.set(k.t, (m = new Map()));
      const first = !m.has(k.prop);
      if (t < k.start && !first) continue;
      if (k.lazy && !k.from && t >= k.start) {
        k.from = { ...current(k.t, k.prop) };
        if (k.from.unit !== k.to.unit && k.from.n === 0) k.from.unit = k.to.unit;
      }
      const from = k.from ?? current(k.t, k.prop);
      const p = k.dur === 0 ? (t >= k.start ? 1 : 0) : Math.min(1, Math.max(0, (t - k.start) / k.dur));
      const e = k.ease(p);
      m.set(k.prop, { n: from.n + (k.to.n - from.n) * e, unit: k.to.unit || from.unit });
    }
    for (const [tg, m] of held) for (const [prop, v] of m) set(tg, prop, v);
    if (t > prev) for (const c of this.calls) if (!c.done && c.at > prev && c.at <= t) ((c.done = true), c.fn());
    if (t < prev) for (const c of this.calls) if (c.at > t) c.done = false;
    this.onUpdate?.(this);
    if (!ticking.has(this)) flush();
  }
}

export const timeline = () => new Timeline();

/* ───────────────────────── Ressort ───────────────────────── */

/**
 * Une propriété menée par un ressort : `r.set(cible)` à tout moment, la vitesse est gardée. Les ressorts de la maison
 * (vif, ouverture, ample) par leur nom, ou { k, zeta }.
 */
export function ressort(t: Target, prop: string, o: { spring?: keyof typeof SPRINGS | Spring; value?: number | string } = {}) {
  const s: Spring = typeof o.spring === "object" ? o.spring : SPRINGS[o.spring ?? "vif"];
  const start = o.value !== undefined ? parse(o.value, prop) : current(t, prop);
  const unit = start.unit;
  let x = start.n;
  let v = 0;
  let target = x;
  set(t, prop, { n: x, unit });
  flush();
  const r: Ticking & { set(to: number | string): void; readonly value: number; readonly velocity: number } = {
    step(dt) {
      // Sous-pas fixes : le même mouvement à 60 ou 144 Hz.
      for (let left = dt; left > 1e-9; left -= 1 / 240) [x, v] = springStep(x, v, target, Math.min(1 / 240, left), s);
      const rest = Math.abs(x - target) < 1e-3 && Math.abs(v) < 1e-2;
      if (rest) ((x = target), (v = 0));
      set(t, prop, { n: x, unit });
      return !rest;
    },
    set(to) {
      target = parse(to, prop).n;
      if (reducedMotion()) {
        x = target;
        v = 0;
        set(t, prop, { n: x, unit });
        flush();
        return;
      }
      wake(r);
    },
    get value() {
      return x;
    },
    get velocity() {
      return v;
    },
  };
  return r;
}

/* ───────────────────────── Déclaratif : data-anim ───────────────────────── */

/** Les motifs nommés (de → vers). */
export const PRESETS: Record<string, string> = {
  monte: "y 1.1em 0em; opacity 0 1",
  fondu: "opacity 0 1",
  glisse: "x -1.5em 0em; opacity 0 1",
  zoom: "scale 0.92 1; opacity 0 1",
  masque: "clip 100 0; y 0.35em 0em",
  rideau: "clip-x 100 0",
  flou: "blur 14 0; opacity 0 1",
  bascule: "rotate -5 0; y 0.8em 0em; opacity 0 1",
};
export const TRIGGERS = ["entree", "defilement", "survol", "appui", "chargement"] as const;

/** « y 1.1em 0; opacity 0 1 » → [de, vers]. */
export function parseAnim(spec: string): [Vars, Vars] {
  const src = PRESETS[spec.trim()] ?? spec;
  const from: Record<string, string> = {};
  const to: Record<string, string> = {};
  for (const part of src.split(";")) {
    const w = part.trim().split(/\s+/).filter(Boolean);
    if (!w.length) continue;
    if (w.length !== 3) throw new Error(`[presse:anim] « ${part.trim()} » : il faut « propriété de vers »`);
    const [p, a, b] = w as [string, string, string];
    if (!p.startsWith("--") && !(PROPS as readonly string[]).includes(p)) throw new Error(`[presse:anim] propriété inconnue : « ${p} » (${PROPS.join(", ")}, ou --variable)`);
    from[p] = a;
    to[p] = b;
  }
  return [from as Vars, to as Vars];
}

type Bound = { el: HTMLElement; tl: Timeline; trigger: string; repeat: boolean; smooth: number; p: number; visible: boolean };
const bound = new WeakMap<HTMLElement, Bound>();
const scrubbing = new Set<Bound>();
let io: IntersectionObserver | null = null;
let scrubIo: IntersectionObserver | null = null;

/** Pilote au défilement : progression lissée vers la traversée de l'écran ; réveillé par le défilement. */
const scrubTicker: Ticking = {
  step(dt) {
    let moving = false;
    for (const b of scrubbing) {
      if (!b.visible) continue;
      const r = b.el.getBoundingClientRect();
      const vh = innerHeight;
      const target = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      const k = reducedMotion() || b.smooth <= 0 ? 1 : 1 - Math.exp(-dt / b.smooth);
      b.p += (target - b.p) * k;
      if (Math.abs(target - b.p) < 1e-4) b.p = target;
      else moving = true;
      b.tl.progress(b.p);
    }
    return moving;
  },
};
let scrollHooked = false;

function bind(el: HTMLElement) {
  if (bound.has(el)) return;
  const d = el.dataset;
  let from: Vars;
  let to: Vars;
  try {
    [from, to] = parseAnim(d.anim ?? "");
  } catch (e) {
    console.warn(e, el);
    el.dataset.animReady = "";
    return;
  }
  const trigger = (TRIGGERS as readonly string[]).includes(d.animTrigger ?? "") ? d.animTrigger! : "entree";
  const stagger = Number(d.animStagger ?? 0);
  const targets = stagger > 0 ? ([...el.children] as HTMLElement[]) : [el];
  const tl = new Timeline().fromTo(targets, from, to, {
    dur: d.animDur ? Number(d.animDur) : trigger === "survol" || trigger === "appui" ? DUR[2] / 1000 : DUR[3] / 1000,
    ease: d.animEase ?? (trigger === "defilement" ? "lineaire" : "out"),
    stagger,
    at: Number(d.animDelay ?? 0),
  });
  const b: Bound = { el, tl, trigger, repeat: d.animRepeat !== undefined, smooth: Number(d.animSmooth ?? 0.08), p: 0, visible: false };
  bound.set(el, b);
  tl.seek(0);
  el.dataset.animReady = "";
  if (trigger === "entree") {
    io ??= new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const x = bound.get(e.target as HTMLElement);
          if (!x) continue;
          if (e.isIntersecting) {
            x.tl.play();
            if (!x.repeat) io!.unobserve(x.el);
          } else if (x.repeat && e.boundingClientRect.top > 0) x.tl.reverse();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
  } else if (trigger === "defilement") {
    scrubbing.add(b);
    scrubIo ??= new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const x = [...scrubbing].find((s) => s.el === e.target);
          if (x) x.visible = e.isIntersecting;
        }
        wake(scrubTicker);
      },
      { rootMargin: "20% 0px" },
    );
    scrubIo.observe(el);
    if (!scrollHooked) {
      scrollHooked = true;
      addEventListener("scroll", () => wake(scrubTicker), { passive: true });
      addEventListener("resize", () => wake(scrubTicker));
    }
  } else if (trigger === "survol") {
    el.addEventListener("pointerenter", (e) => e.pointerType !== "touch" && tl.play());
    el.addEventListener("pointerleave", () => tl.reverse());
    el.addEventListener("focusin", () => tl.play());
    el.addEventListener("focusout", () => tl.reverse());
  } else if (trigger === "appui") {
    el.addEventListener("pointerdown", () => tl.play());
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, () => tl.reverse());
  } else if (trigger === "chargement") {
    const root = document.documentElement;
    const go = () => tl.play();
    if (!root.classList.contains("presse-intro-pending")) requestAnimationFrame(go);
    else {
      const mo = new MutationObserver(() => {
        if (root.classList.contains("presse-intro-pending")) return;
        mo.disconnect();
        go();
      });
      mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    }
  }
}

/** Arme tous les [data-anim] de la page, et ceux qui arrivent ensuite (Créateur, CMS). */
export function initAnim(root: ParentNode = document) {
  if (typeof document === "undefined") return;
  (window as { __presseAnim?: boolean }).__presseAnim = true;
  const scan = (n: ParentNode) => n.querySelectorAll<HTMLElement>("[data-anim]").forEach(bind);
  scan(root);
  if (root === document) {
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement) (n.matches("[data-anim]") && bind(n), scan(n));
    }).observe(document.body, { childList: true, subtree: true });
  }
}
/** La timeline d'un élément [data-anim] (pour la piloter à la main). */
export const animOf = (el: HTMLElement) => bound.get(el)?.tl ?? null;
