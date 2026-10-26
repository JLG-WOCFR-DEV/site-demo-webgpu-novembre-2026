/**
 * Presse — le défilement maîtrisé (feuille de route D1).
 *
 * Deux choses, séparables :
 *
 * 1. L'inertie douce (`<html data-presse-scroll="doux">`). La molette ne fait
 *    plus sauter la page de 100 px : elle déplace une cible, que la position
 *    rejoint en douceur (constante de temps ≈ 110 ms). Le défilement reste le
 *    défilement natif — on appelle scrollTo à chaque image — : ancres,
 *    `position: sticky`, recherche dans la page, barre de défilement, clavier
 *    et écrans tactiles marchent comme avant, et le moteur, qui lit scrollY,
 *    suit sans rien savoir. Une zone qui défile elle-même (code, liste) garde
 *    sa molette ; un composant qui la prend (grille, galerie) l'arrête
 *    (preventDefault). Mouvement réduit, Ctrl + molette (zoom) : natif.
 *
 * 2. La chorégraphie au défilement, en variables CSS, sur tout élément
 *    [data-scroll] (sans JavaScript à écrire) :
 *      --p   0 → 1 pendant que l'élément traverse l'écran (son haut entre en
 *            bas, son bas sort en haut) ;
 *      --in  0 → 1 pendant son entrée (son haut monte du bas de l'écran
 *            jusqu'aux deux tiers) ;
 *    data-scroll="pin" : une section haute dont le premier enfant reste
 *      épinglé (sticky) ; --p va de 0 (son haut touche le haut de l'écran) à
 *      1 (son bas touche le bas) : un défilement « scrubbé » ;
 *    data-scroll="reveal" : reçoit la classe .is-in une fois entré (au 85 %).
 *    Et sur <html> : --v, la vitesse de défilement (−1 … 1), pour pencher,
 *    étirer, flouter ce qui file.
 *
 * Un plan GPU (data-gl-img) suit son rectangle à chaque image : transformer
 * l'élément en CSS avec --p transforme aussi ce que peint le GPU.
 */

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Constante de temps de l'inertie (1/s) : plus grand, plus vif. */
const EASE = 9;

const CSS = `
html.presse-scroll-doux { scroll-behavior: auto !important; }
[data-scroll="pin"] { position: relative; }
[data-scroll="pin"] > :first-child { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: clip; }
`;

type Tracked = { el: HTMLElement; kind: string; on: boolean; last: string };
export type ScrollInfo = { y: number; v: number };
const subs = new Set<(s: ScrollInfo) => void>();
/** S'abonner au défilement (position, vitesse en px/s), à chaque image où il bouge. */
export function onScroll(fn: (s: ScrollInfo) => void) {
  subs.add(fn);
  return () => void subs.delete(fn);
}

let started = false;

export function initScroll() {
  if (started || typeof window === "undefined") return;
  started = true;
  const root = document.documentElement;
  const style = document.createElement("style");
  style.dataset.presseScroll = "";
  style.textContent = CSS;
  document.head.append(style);

  /* ───── Boucle : une seule, active seulement quand quelque chose bouge ───── */

  let raf = 0;
  let lastT = performance.now();
  let lastY = scrollY;
  let v = 0;
  let wake = 0;
  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(0.1, Math.max(0.001, (now - lastT) / 1000));
    lastT = now;
    let moving = smoothStep(dt);
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    // Un saut (ancre, retour en haut) n'est pas un geste.
    const inst = Math.abs(dy) > innerHeight * 0.9 ? 0 : dy / dt;
    v += (inst - v) * (1 - Math.exp(-dt * 10));
    if (Math.abs(v) < 2) v = 0;
    else moving = true;
    root.style.setProperty("--v", (Math.max(-1, Math.min(1, v / 3000))).toFixed(3));
    update();
    for (const fn of subs) fn({ y, v });
    if (moving || now < wake) raf = requestAnimationFrame(tick);
  };
  const kick = (ms = 120) => {
    wake = Math.max(wake, performance.now() + ms);
    if (!raf) {
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  /* ───── 1. Inertie douce ───── */

  const doux = () => root.dataset.presseScroll === "doux" && !reduced();
  let target = scrollY;
  let current = scrollY;
  let gliding = false;
  const maxY = () => document.documentElement.scrollHeight - innerHeight;
  function smoothStep(dt: number) {
    if (!gliding) return false;
    current += (target - current) * (1 - Math.exp(-dt * EASE));
    if (Math.abs(target - current) < 0.4) {
      current = target;
      gliding = false;
    }
    scrollTo(0, current);
    return gliding;
  }
  /** La molette tombe-t-elle sur une zone qui défile elle-même dans ce sens ? */
  const scrollsItself = (el: Element | null, dy: number, dx: number) => {
    for (let e = el; e && e !== document.body && e !== root; e = e.parentElement) {
      if (e instanceof HTMLElement && e.closest("[data-scroll-native]")) return true;
      const cs = getComputedStyle(e);
      const y = /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1;
      const x = /(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1;
      if (y && dy && ((dy > 0 && e.scrollTop + e.clientHeight < e.scrollHeight - 1) || (dy < 0 && e.scrollTop > 0))) return true;
      if (x && Math.abs(dx) > Math.abs(dy)) return true;
    }
    return false;
  };
  addEventListener(
    "wheel",
    (e) => {
      if (!doux() || e.defaultPrevented || e.ctrlKey || e.metaKey) return;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= innerHeight;
      if (!dy || Math.abs(e.deltaX) > Math.abs(dy) || scrollsItself(e.target as Element, dy, e.deltaX)) return;
      e.preventDefault();
      if (!gliding) current = target = scrollY;
      target = Math.max(0, Math.min(maxY(), target + dy));
      gliding = true;
      root.classList.add("presse-scroll-doux");
      kick();
    },
    { passive: false },
  );
  // Tout autre défilement (clavier, barre, ancre, recherche, tactile) reprend la main.
  addEventListener(
    "scroll",
    () => {
      if (gliding && Math.abs(scrollY - Math.round(current)) > 2) gliding = false;
      if (!gliding) current = target = scrollY;
      kick();
    },
    { passive: true },
  );
  if (doux()) root.classList.add("presse-scroll-doux");

  /* ───── 2. Chorégraphie : --p, --in, épinglage, révélation ───── */

  const tracked: Tracked[] = [];
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const t = tracked.find((x) => x.el === en.target);
        if (t) t.on = en.isIntersecting;
      }
      kick();
    },
    { rootMargin: "25% 0px" },
  );
  const collect = () => {
    for (const el of document.querySelectorAll<HTMLElement>("[data-scroll]")) {
      if (tracked.some((t) => t.el === el)) continue;
      tracked.push({ el, kind: el.dataset.scroll ?? "", on: false, last: "" });
      io.observe(el);
    }
  };
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  function update() {
    const H = innerHeight;
    for (const t of tracked) {
      if (!t.on) continue;
      const r = t.el.getBoundingClientRect();
      let p: number;
      if (t.kind === "pin") p = clamp01(-r.top / Math.max(1, r.height - H));
      else p = clamp01((H - r.top) / Math.max(1, H + r.height));
      const pin = clamp01((H - r.top) / (H * 0.66));
      const key = `${p.toFixed(4)}|${pin.toFixed(4)}`;
      if (key === t.last) continue;
      t.last = key;
      t.el.style.setProperty("--p", p.toFixed(4));
      t.el.style.setProperty("--in", pin.toFixed(4));
      if (t.kind === "reveal" && r.top < H * 0.85) t.el.classList.add("is-in");
    }
  }
  const start = () => {
    collect();
    // Le contenu change (composant monté, gabarit relu) : on relève les nouveaux.
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => ((queued = false), collect()));
    }).observe(document.body, { childList: true, subtree: true });
    kick(300);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  addEventListener("resize", () => kick(200));
}
