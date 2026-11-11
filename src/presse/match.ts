import { REGLAGES, Ressort, type Reglage } from "./gesture.ts";
import { lintOn, lintSample } from "./motion-lint.ts";

/**
 * Un élément partagé entre deux mises en page (d'après `El::matched` de Rune, le `matchedGeometryEffect` de SwiftUI,
 * le `layoutId` de Motion) : `match(() => { …changer le DOM… })`.
 *
 * Avant le changement, on relève le rectangle présenté de chaque `[data-presse-match="id"]` visible ; après, chaque
 * id qui existe encore (le même élément déplacé, ou un autre qui prend le relais) part d'où l'on voyait l'ancien, avec
 * sa vitesse s'il était déjà en vol, et rejoint sa place sur des ressorts.
 *
 * - **Mise à l'échelle, pas de remise en page** : le contenu garde sa mise en page finale, mis à l'échelle
 *   uniformément pour couvrir le cadre qui vole, et découpé à ce cadre (clip-path) ; une image ne se déforme pas.
 * - **Au-dessus de tout** pendant le vol (z-index), puis rendu à sa place.
 * - **Interrompable** : un nouveau `match()` en plein vol repart du rectangle présenté, vitesse comprise.
 * - **Mouvement réduit** : pas de vol, le changement est immédiat.
 */

type Flight = { el: HTMLElement; x: Ressort; y: Ressort; w: Ressort; h: Ressort; to: DOMRect };
const flights = new Map<string, Flight>();
let raf = 0;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const visible = (el: HTMLElement) => {
  if (el.closest("[hidden]")) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

export function match(mutate: () => void, o: { reglage?: Reglage; root?: ParentNode } = {}) {
  const root = o.root ?? document;
  const before = new Map<string, { r: DOMRect; v: [number, number, number, number] }>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-presse-match]")) {
    if (!visible(el)) continue;
    const id = el.dataset.presseMatch!;
    const f = flights.get(id);
    before.set(id, { r: el.getBoundingClientRect(), v: f ? [f.x.v, f.y.v, f.w.v, f.h.v] : [0, 0, 0, 0] });
  }
  mutate();
  if (reduced()) {
    for (const f of flights.values()) clear(f.el);
    flights.clear();
    return;
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-presse-match]")) {
    const id = el.dataset.presseMatch!;
    const from = before.get(id);
    if (!from || !visible(el)) continue;
    // La place d'arrivée, sans le vol en cours.
    const old = flights.get(id);
    if (old && old.el !== el) clear(old.el);
    clear(el);
    const to = el.getBoundingClientRect();
    if (Math.abs(to.left - from.r.left) < 0.5 && Math.abs(to.top - from.r.top) < 0.5 && Math.abs(to.width - from.r.width) < 0.5 && Math.abs(to.height - from.r.height) < 0.5) {
      flights.delete(id);
      continue;
    }
    const reg = o.reglage ?? REGLAGES.lacher;
    const mk = (a: number, b: number, v: number) => {
      const r = new Ressort(a, reg);
      r.lacher(v, b);
      return r;
    };
    flights.set(id, { el, to, x: mk(from.r.left, to.left, from.v[0]), y: mk(from.r.top, to.top, from.v[1]), w: mk(from.r.width, to.width, from.v[2]), h: mk(from.r.height, to.height, from.v[3]) });
    paint(flights.get(id)!);
  }
  if (!raf && flights.size) {
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      for (const [id, f] of flights) {
        const m = [f.x.pas(dt), f.y.pas(dt), f.w.pas(dt), f.h.pas(dt)].some(Boolean);
        if (m) paint(f);
        else {
          clear(f.el);
          flights.delete(id);
        }
        // Le linter (?presse-lint) : le cadre présenté ; à la pose, la place d'arrivée — un écart restant y sauterait.
        if (lintOn()) {
          lintSample(`match-${id}`, "x", m ? f.x.x : f.to.left, t);
          lintSample(`match-${id}`, "y", m ? f.y.x : f.to.top, t);
          lintSample(`match-${id}`, "width", m ? Math.max(1, f.w.x) : f.to.width, t);
        }
      }
      raf = flights.size ? requestAnimationFrame(tick) : 0;
    };
    raf = requestAnimationFrame(tick);
  }
}

/** Le cadre qui vole : x, y, w, h ; le contenu, à sa taille d'arrivée, mis à l'échelle pour le couvrir, découpé. */
function paint(f: Flight) {
  const { el, to } = f;
  const w = Math.max(1, f.w.x);
  const h = Math.max(1, f.h.x);
  const s = Math.max(w / to.width, h / to.height);
  // Centré dans le cadre, puis découpé à lui.
  const cw = to.width * s;
  const ch = to.height * s;
  const ox = f.x.x - (cw - w) / 2;
  const oy = f.y.x - (ch - h) / 2;
  el.style.transformOrigin = "0 0";
  el.style.transform = `translate(${ox - to.left}px, ${oy - to.top}px) scale(${s})`;
  const ix = (cw - w) / 2 / s;
  const iy = (ch - h) / 2 / s;
  el.style.clipPath = `inset(${iy}px ${ix}px ${iy}px ${ix}px round ${parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0}px)`;
  el.style.zIndex = "1000";
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.dataset.presseFlying = "";
}
function clear(el: HTMLElement) {
  el.style.transform = "";
  el.style.transformOrigin = "";
  el.style.clipPath = "";
  el.style.zIndex = "";
  if (el.dataset.presseFlying !== undefined && el.style.position === "relative") el.style.position = "";
  delete el.dataset.presseFlying;
}
