/**
 * Presse — le curseur (feuille de route D5). `<html data-presse-cursor>`.
 *
 * Un point qui suit exactement, un anneau qui suit avec un ressort, en mode
 * différence (il s'inverse sur toute couleur). Il lit ce qu'il survole :
 *   lien, bouton                 l'anneau s'ouvre ;
 *   [data-cursor="Ouvrir"]       l'anneau porte le mot ;
 *   [data-cursor="glisser"], canvas d'un composant   « ↔ » ;
 *   [data-magnet]                l'élément est attiré par le pointeur, et
 *                                l'anneau épouse sa forme ;
 *   champ de texte               le curseur du système revient.
 * Jamais sur un écran tactile ou sans survol, ni avec le mouvement réduit :
 * le curseur du système reste alors le curseur.
 */
import { EASE } from "./tokens.ts";

const CSS = `
html.presse-cursor-on, html.presse-cursor-on * { cursor: none !important; }
html.presse-cursor-on :is(input, textarea, select, [contenteditable=""], [contenteditable="true"]) { cursor: text !important; }
.presse-cursor { position: fixed; inset: 0 auto auto 0; z-index: 2147482990; pointer-events: none; mix-blend-mode: difference; opacity: 0; transition: opacity 0.25s; }
.presse-cursor.is-on { opacity: 1; }
.presse-cursor.is-text { opacity: 0; }
.pc-dot, .pc-ring { position: fixed; left: 0; top: 0; border-radius: 999px; will-change: transform; }
.pc-dot { width: 6px; height: 6px; margin: -3px 0 0 -3px; background: #fff; transition: scale 0.25s ${EASE.out}; }
.pc-ring { box-sizing: border-box; border: 1.5px solid #fff; display: grid; place-items: center; transition: width 0.35s ${EASE.out}, height 0.35s ${EASE.out}, border-radius 0.35s ${EASE.out}, background 0.25s, border-width 0.25s; }
.pc-label { font: 500 11px/1 "IBM Plex Mono", ui-monospace, monospace; letter-spacing: 0.1em; text-transform: uppercase; color: #000; white-space: nowrap; opacity: 0; transition: opacity 0.2s; }
.presse-cursor.is-link .pc-dot { scale: 0; }
.presse-cursor.is-label .pc-ring { background: #fff; }
.presse-cursor.is-label .pc-label { opacity: 1; }
.presse-cursor.is-down .pc-ring { border-width: 3px; }
.presse-cursor.is-stuck .pc-dot { scale: 0; }
.presse-cursor.is-stuck .pc-ring { background: transparent; }
[data-magnet] { transition: translate 0.5s ${EASE.out}; }
`;

const LINKS = "a[href], button, [role=button], label[for], summary, input[type=checkbox], input[type=radio], input[type=range]";
const DRAG = ".gr-gl, .gx-gl, .or-gl, .ob-gl, .lq-card, [data-cursor=glisser]";
const TEXT = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]), textarea, select, [contenteditable=""], [contenteditable="true"]';

let started = false;

export function initCursor() {
  if (started || typeof window === "undefined") return;
  const root = document.documentElement;
  if (root.dataset.presseCursor === undefined) return;
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  started = true;

  const style = document.createElement("style");
  style.dataset.presseCursor = "";
  style.textContent = CSS;
  document.head.append(style);
  const el = document.createElement("div");
  el.className = "presse-cursor";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<span class="pc-ring"><span class="pc-label"></span></span><span class="pc-dot"></span>';
  root.append(el);
  root.classList.add("presse-cursor-on");
  const dot = el.querySelector<HTMLElement>(".pc-dot")!;
  const ring = el.querySelector<HTMLElement>(".pc-ring")!;
  const label = el.querySelector<HTMLElement>(".pc-label")!;

  const p = { x: -100, y: -100 };
  const r = { x: -100, y: -100, w: 34, h: 34 };
  let target: Element | null = null;
  let magnet: HTMLElement | null = null;
  let raf = 0;
  let last = performance.now();

  const state = (t: Element | null) => {
    target = t;
    const cue = t?.closest<HTMLElement>("[data-cursor]");
    const text = !!t?.closest(TEXT);
    const link = !!t?.closest(LINKS);
    const drag = !link && !!t?.closest(DRAG);
    const word = cue && cue.dataset.cursor !== "glisser" ? cue.dataset.cursor! : drag || cue?.dataset.cursor === "glisser" ? "↔" : "";
    label.textContent = word;
    el.classList.toggle("is-text", text);
    el.classList.toggle("is-link", link || !!word);
    el.classList.toggle("is-label", !!word);
    const m = t?.closest<HTMLElement>("[data-magnet]") ?? null;
    if (m !== magnet) {
      if (magnet) magnet.style.translate = "";
      magnet = m;
    }
  };

  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let w = label.textContent ? Math.max(64, label.offsetWidth + 28) : el.classList.contains("is-link") ? 56 : 34;
    let h = label.textContent ? Math.max(64, w * 0.5) : w;
    if (label.textContent && label.textContent.length > 2) h = 40;
    let tx = p.x;
    let ty = p.y;
    let radius = "999px";
    el.classList.toggle("is-stuck", !!magnet);
    if (magnet) {
      // Aimant : l'élément vient vers le pointeur ; l'anneau prend sa forme.
      const b = magnet.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      const k = Number(magnet.dataset.magnet) || 0.3;
      magnet.style.translate = `${((p.x - cx) * k).toFixed(1)}px ${((p.y - cy) * k).toFixed(1)}px`;
      tx = cx + (p.x - cx) * k * 1.2;
      ty = cy + (p.y - cy) * k * 1.2;
      w = b.width + 12;
      h = b.height + 12;
      radius = getComputedStyle(magnet).borderTopLeftRadius || "12px";
    }
    const f = 1 - Math.exp(-dt * 18);
    r.x += (tx - r.x) * f;
    r.y += (ty - r.y) * f;
    r.w = w;
    r.h = h;
    dot.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    ring.style.transform = `translate3d(${(r.x - r.w / 2).toFixed(1)}px, ${(r.y - r.h / 2).toFixed(1)}px, 0)`;
    ring.style.width = `${r.w}px`;
    ring.style.height = `${r.h}px`;
    ring.style.borderRadius = radius;
    if (Math.abs(tx - r.x) > 0.2 || Math.abs(ty - r.y) > 0.2) raf = requestAnimationFrame(tick);
  };
  const kick = () => {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      p.x = e.clientX;
      p.y = e.clientY;
      el.classList.add("is-on");
      const t = e.target as Element | null;
      if (t !== target) state(t);
      kick();
    },
    { passive: true },
  );
  addEventListener("pointerdown", () => el.classList.add("is-down"), { passive: true });
  addEventListener("pointerup", () => el.classList.remove("is-down"), { passive: true });
  root.addEventListener("pointerleave", () => {
    el.classList.remove("is-on");
    if (magnet) magnet.style.translate = "";
    magnet = null;
  });
  // Le contenu sous un pointeur immobile change (défilement, ouverture) : on relit la cible.
  addEventListener("scroll", () => (state(document.elementFromPoint(p.x, p.y)), kick()), { passive: true });
}
