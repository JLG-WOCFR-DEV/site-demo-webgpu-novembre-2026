/**
 * Le gouverneur de cadence (feuille de route D2) : une seule mesure par page,
 * partagée par le moteur et tous les composants.
 *
 * Il écoute l'intervalle entre deux images (requestAnimationFrame), en déduit
 * la cadence de l'écran (60, 90, 120 Hz…) et, si la page n'arrive plus à la
 * tenir, baisse l'échelle de rendu des canvas WebGPU par paliers (× 0,85,
 * jusqu'à la moitié de la densité de l'écran). Revenue confortablement sous
 * le budget, la page regagne sa netteté, palier par palier. Un changement par
 * seconde au plus, et jamais pendant que l'onglet dort.
 *
 *   renderScale()  → facteur à appliquer à devicePixelRatio (0,5 … 1)
 *   <html data-presse-quality="fixe"> : pas d'adaptation.
 *
 * Mieux vaut une image un peu plus douce que des images qui sautent : un site
 * qui saccade paraît cassé, un site un peu moins net ne se remarque pas.
 */

const MIN = 0.5;
const DOWN = 0.85;
const UP = 1.1;

let scale = 1;
let started = false;
let interval = 1000 / 60;
let ema = interval;
let over = 0;
let under = 0;
let lastChange = 0;
const subs = new Set<(s: number) => void>();

function start() {
  started = true;
  if (document.documentElement.dataset.presseQuality === "fixe") return;
  const mins: number[] = [];
  let last = performance.now();
  const tick = (now: number) => {
    const dt = now - last;
    last = now;
    requestAnimationFrame(tick);
    // Pause, onglet en arrière-plan, gros chargement : ce n'est pas la cadence.
    if (document.hidden || dt <= 0 || dt > 250) return;
    // La cadence de l'écran : le plus court des intervalles récents, arrondi à un écran connu.
    mins.push(dt);
    if (mins.length > 120) mins.shift();
    const best = Math.min(...mins);
    interval = [1000 / 144, 1000 / 120, 1000 / 90, 1000 / 75, 1000 / 60, 1000 / 30].find((x) => best <= x * 1.12) ?? 1000 / 30;
    ema += (dt - ema) * 0.08;
    const secs = dt / 1000;
    if (ema > interval * 1.35) ((over += secs), (under = 0));
    else if (ema < interval * 1.08) ((under += secs), (over = 0));
    else over = under = 0;
    if (now - lastChange < 1000) return;
    let next = scale;
    if (over > 0.6 && scale > MIN) next = Math.max(MIN, scale * DOWN);
    else if (under > 4 && scale < 1) next = Math.min(1, scale * UP);
    if (next !== scale) {
      scale = Math.round(next * 100) / 100;
      lastChange = now;
      over = under = 0;
      for (const fn of subs) fn(scale);
    }
  };
  requestAnimationFrame(tick);
}

/** Facteur d'échelle du rendu (multiplie devicePixelRatio). */
export function renderScale() {
  if (!started) start();
  return scale;
}

/** Être prévenu d'un changement d'échelle (le panneau de débogage l'affiche). */
export function onRenderScale(fn: (s: number) => void) {
  subs.add(fn);
  return () => void subs.delete(fn);
}

/** Pour l'inspection : cadence estimée (Hz), temps moyen par image (ms), échelle. */
export function governorState() {
  return { hz: Math.round(1000 / interval), ms: Math.round(ema * 10) / 10, scale };
}
