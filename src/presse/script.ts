import { clockNow } from "../gpu/clock.ts";

/**
 * Des tests rejouables (d'après l'outillage sans fenêtre de Rune) :
 *
 * - `window.__presse.tree()` : l'arbre présenté — chaque élément qui compte (composant, `data-gl-*`, `data-anim`,
 *   `data-presse-match`, lien, bouton, champ, titre) avec un identifiant stable (son id, sinon son chemin), son rôle, son
 *   nom accessible, son rectangle présenté (transformations comprises), son opacité. Comparé d'une version à l'autre
 *   avant les pixels : on sait *quoi* a bougé, pas seulement *combien* de pixels.
 * - `?presse-script=<json ou chemin>` (ou `__presse.play(script)`) : rejoue des gestes horodatés sur l'horloge de la
 *   page — `tap`, `drag`, `key`, `type`, `scroll`, `wait` — sur un sélecteur ou à des coordonnées. Avec l'horloge
 *   virtuelle de l'enregistreur ou le ralenti, le même script donne les mêmes images.
 *
 *   [{ "at": 0.5, "type": "tap", "target": "[data-presse-match='m-lac']" },
 *    { "at": 2, "type": "drag", "target": ".lv-card:nth-child(2)", "dy": 300, "dur": 0.6 },
 *    { "at": 3.5, "type": "key", "key": "Escape" }]
 */

export type Step =
  | { at: number; type: "tap"; target?: string; x?: number; y?: number }
  | { at: number; type: "drag"; target?: string; x?: number; y?: number; dx: number; dy: number; dur?: number }
  | { at: number; type: "key"; key: string; target?: string }
  | { at: number; type: "type"; text: string; target?: string }
  | { at: number; type: "scroll"; dy: number }
  | { at: number; type: "wait" };

export type Node = { id: string; role: string; name: string; rect: [number, number, number, number]; opacity: number };

const KEEP = "[data-presse-component], [data-gl-text], [data-gl-img], [data-gl-filter], [data-anim], [data-presse-match], a[href], button, input, select, textarea, h1, h2, h3, [role]";

function stableId(el: Element): string {
  if (el.id) return `#${el.id}`;
  const key = el.getAttribute("data-presse-match") ?? el.getAttribute("data-id") ?? el.getAttribute("name");
  const parts: string[] = [];
  let e: Element | null = el;
  while (e && e !== document.body) {
    if (e.id) {
      parts.unshift(`#${e.id}`);
      break;
    }
    const p: Element | null = e.parentElement;
    const i = p ? [...p.children].filter((c) => c.tagName === e!.tagName).indexOf(e) : 0;
    parts.unshift(`${e.tagName.toLowerCase()}${i ? `:${i}` : ""}`);
    e = p;
  }
  return key ? `${parts.join(">")}[${key}]` : parts.join(">");
}
const roleOf = (el: Element) => el.getAttribute("role") ?? ({ A: "lien", BUTTON: "bouton", INPUT: "champ", SELECT: "choix", TEXTAREA: "champ", H1: "titre", H2: "titre", H3: "titre", IMG: "image" } as Record<string, string>)[el.tagName] ?? (el.hasAttribute("data-presse-component") ? `composant:${el.getAttribute("data-presse-component")}` : "bloc");
const nameOf = (el: Element) => (el.getAttribute("aria-label") ?? el.getAttribute("alt") ?? el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
function opacityOf(el: Element) {
  let o = 1;
  for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity) || 0;
  return +o.toFixed(3);
}

export function tree(): Node[] {
  return [...document.querySelectorAll(KEEP)]
    .filter((el) => !el.closest("[hidden], .pk"))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { id: stableId(el), role: roleOf(el), name: nameOf(el), rect: [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)] as [number, number, number, number], opacity: opacityOf(el) };
    })
    .filter((n) => n.rect[2] > 0 && n.rect[3] > 0);
}

/* ───────────────────────── Le joueur ───────────────────────── */

const center = (s: { target?: string; x?: number; y?: number }) => {
  if (s.target) {
    const el = document.querySelector(s.target);
    if (!el) throw new Error(`[presse:script] introuvable : ${s.target}`);
    const r = el.getBoundingClientRect();
    return { el, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  const x = s.x ?? innerWidth / 2;
  const y = s.y ?? innerHeight / 2;
  return { el: document.elementFromPoint(x, y) ?? document.body, x, y };
};
const pointer = (el: Element, type: string, x: number, y: number, buttons: number) =>
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 7, pointerType: "mouse", isPrimary: true, button: 0, buttons }));
const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
/** Attend l'instant `at` (s) de l'horloge de la page, compté depuis le départ du script. */
async function until(t0: number, at: number) {
  while (clockNow() - t0 < at * 1000) await frame();
}

export async function play(steps: Step[]) {
  const t0 = clockNow();
  const done: string[] = [];
  for (const s of [...steps].sort((a, b) => a.at - b.at)) {
    await until(t0, s.at);
    if (s.type === "wait") continue;
    if (s.type === "scroll") {
      scrollBy({ top: s.dy, behavior: "instant" });
    } else if (s.type === "key") {
      const el = (s.target ? document.querySelector(s.target) : document.activeElement) ?? document.body;
      for (const type of ["keydown", "keyup"]) el.dispatchEvent(new KeyboardEvent(type, { key: s.key, bubbles: true, cancelable: true }));
    } else if (s.type === "type") {
      const el = (s.target ? document.querySelector<HTMLInputElement>(s.target) : (document.activeElement as HTMLInputElement)) ?? null;
      if (el && "value" in el) {
        el.value += s.text;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } else {
      const c = center(s);
      pointer(c.el, "pointerover", c.x, c.y, 0);
      pointer(c.el, "pointerdown", c.x, c.y, 1);
      if (s.type === "drag") {
        // Une main régulière : une position par image, sur la durée demandée, horloge de la page.
        const dur = (s.dur ?? 0.4) * 1000;
        const start = clockNow();
        let k = 0;
        while (k < 1) {
          await frame();
          k = Math.min(1, (clockNow() - start) / dur);
          const e = k * k * (3 - 2 * k);
          pointer(c.el, "pointermove", c.x + s.dx * e, c.y + s.dy * e, 1);
        }
        pointer(c.el, "pointerup", c.x + s.dx, c.y + s.dy, 0);
      } else {
        pointer(c.el, "pointerup", c.x, c.y, 0);
        (c.el as HTMLElement).click?.();
      }
    }
    done.push(`${s.at}s ${s.type}`);
  }
  return done;
}

export function mountScript() {
  const w = window as unknown as { __presse?: Record<string, unknown> };
  w.__presse = Object.assign(w.__presse ?? {}, { tree, play });
  const q = new URLSearchParams(location.search).get("presse-script");
  if (!q) return;
  void (async () => {
    const steps: Step[] = q.trim().startsWith("[") ? JSON.parse(q) : await (await fetch(q)).json();
    await new Promise((r) => setTimeout(r, 300));
    const done = await play(steps);
    document.documentElement.dataset.presseScript = "fini";
    console.info(`[presse:script] ${done.length} gestes rejoués`);
  })();
}
