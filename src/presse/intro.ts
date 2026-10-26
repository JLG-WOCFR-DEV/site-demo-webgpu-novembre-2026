/**
 * Presse — la chorégraphie d'entrée (feuille de route D3).
 * `<html data-presse-intro="#05060a" data-presse-intro-label="Orbite">`
 *
 * Un rideau posé avant le premier dessin (script en ligne, presse/build/flight.ts)
 * compte de 0 à 100 sur ce que la page attend vraiment : les fontes, les images
 * visibles, la première image de chaque composant WebGPU (ou du moteur). Puis
 * il se lève, et les éléments marqués [data-intro] entrent l'un après l'autre,
 * dans l'ordre du document, avec les jetons de mouvement de Presse.
 *
 * Une fois par session et par page ; jamais en arrivant par le balayage (qui
 * fait déjà ce travail) ; jamais avec le mouvement réduit. Au plus 4 s.
 */
import { DUR, EASE } from "./tokens.ts";

const CSS = `
html.presse-intro-pending [data-intro] { opacity: 0; translate: 0 26px; filter: blur(6px); }
html.presse-intro-done [data-intro] { transition: opacity ${DUR[3]}ms ${EASE.out}, translate ${DUR[3]}ms ${EASE.out}, filter ${DUR[3]}ms ${EASE.out}; transition-delay: calc(var(--intro-i, 0) * 70ms + 120ms); }
.presse-intro .pi-num { font-variant-numeric: tabular-nums; }
`;

type Intro = { el: HTMLElement; num: HTMLElement; bar: HTMLElement; t0: number };

const GL = ["liquide", "grille", "galerie", "objet", "orbite"];

export function initIntro() {
  const w = window as { __presseIntro?: Intro };
  const intro = w.__presseIntro;
  const root = document.documentElement;
  // Les éléments à faire entrer reçoivent leur rang (même sans rideau : il ne coûte rien).
  const order = () => document.querySelectorAll<HTMLElement>("[data-intro]").forEach((el, i) => el.style.setProperty("--intro-i", el.dataset.intro || String(i)));
  if (!intro) return;
  delete w.__presseIntro;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);

  let target = 0;
  let shown = 0;
  let done = 0;
  let total = 0;
  const track = (p: Promise<unknown>) => {
    total++;
    void p.catch(() => undefined).then(() => {
      done++;
      target = done / total;
    });
  };
  const timeout = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const begin = () => {
    order();
    track(document.fonts?.ready ?? Promise.resolve());
    // Les images visibles au premier écran.
    for (const im of document.images) {
      const r = im.getBoundingClientRect();
      if (r.width > 0 && r.top < innerHeight && r.bottom > 0) track(Promise.race([im.decode(), timeout(3500)]));
    }
    // La première image de chaque composant WebGPU visible.
    for (const el of document.querySelectorAll<HTMLElement>("[data-presse-component]")) {
      if (!GL.includes(el.dataset.presseComponent ?? "")) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      track(Promise.race([el.dataset.painted !== undefined ? Promise.resolve() : new Promise((res) => el.addEventListener("presse:painted", res, { once: true })), timeout(3800)]));
    }
    // Le moteur de Presse (pages à data-gl-*) : il pose html.gl-on quand il dessine.
    if (document.querySelector("[data-gl-text], [data-gl-img], [data-gl-print]")) {
      track(
        Promise.race([
          new Promise<void>((res) => {
            if (root.classList.contains("gl-on")) return res();
            const mo = new MutationObserver(() => root.classList.contains("gl-on") && (mo.disconnect(), res()));
            mo.observe(root, { attributes: true, attributeFilter: ["class"] });
          }),
          timeout(3800),
        ]),
      );
    }
    if (!total) target = 1;
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", begin, { once: true });
  else begin();

  // Le compteur rattrape la vraie progression, sans jamais aller plus vite qu'un tour en 900 ms.
  let last = performance.now();
  const tick = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    const cap = (now - intro.t0) / DUR[3];
    const want = Math.min(target, cap, 1);
    shown += (want - shown) * (1 - Math.exp(-dt * 7));
    if (want >= 1 && shown > 0.995) shown = 1;
    if (now - intro.t0 > 4000) shown = 1;
    intro.num.textContent = String(Math.round(shown * 100)).padStart(3, "0");
    intro.bar.style.scale = `${shown} 1`;
    if (shown < 1) return void requestAnimationFrame(tick);
    leave();
  };
  requestAnimationFrame(tick);

  const leave = () => {
    // Le rideau se lève ; la page entre derrière lui, élément par élément.
    const a = intro.el.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }], { duration: DUR[3], easing: EASE.inOut, fill: "forwards" });
    window.setTimeout(() => {
      root.classList.add("presse-intro-done");
      root.classList.remove("presse-intro-pending");
    }, DUR[3] * 0.35);
    void a.finished.then(() => intro.el.remove());
  };
}
