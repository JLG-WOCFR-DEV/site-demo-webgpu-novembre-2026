/**
 * L'horloge des animations. Pendant une capture (src/gpu/recorder.ts), elle avance d'un pas fixe par image rendue ;
 * sinon, c'est performance.now(). Toute animation qui veut apparaître juste dans une vidéo doit lire l'heure ici.
 * Module à part, sans dépendance : le moteur de temps s'en sert aussi sous Node (tests).
 *
 * Ralenti : `?presse-ralenti=4` dans l'adresse (ou `setTimeScale(4)`) fait tourner toute la page quatre fois moins vite
 * — moteur, révélations, timelines, composants qui lisent cette horloge. Pour régler une chorégraphie à l'œil, et pour
 * les captures de vérification sur une machine lente.
 */
let source: { readonly now: number } | null = null;
let scale = 1;
let anchorReal = 0;
let anchorVirt = 0;

/*
 * L'heure d'affichage (Rune, recherche 15 ; Android, Chrome) : pendant une image, les animations sont évaluées à
 * l'instant où l'image sera montrée — horodatage du rAF + un intervalle d'image — et non à « maintenant », qui
 * dépend du moment où le code tourne. Une image en retard montre alors la bonne position, sans à-coup de vitesse.
 * Hors image (un événement), c'est performance.now(), jamais en arrière de la dernière valeur rendue.
 *
 * Actif par défaut ; `?presse-heure=maintenant` (ou `setPresentTime(false)`) revient à performance.now().
 */
let presentOn = true;
/** Évaluer les animations à l'heure d'affichage (par défaut) ou à « maintenant ». */
export function setPresentTime(on: boolean) {
  presentOn = on;
  if (!on) presentAt = -1;
}
let interval = 1000 / 60;
let lastRaf = -1;
let presentAt = -1;
let lastOut = 0;
/** À appeler en tête de chaque boucle rAF, avec son horodatage. Plusieurs boucles dans la même image : sans effet. */
export function beginFrame(rafT: number) {
  if (!presentOn || rafT === lastRaf) return;
  // Un horodatage d'une autre base de temps (performance.now() simulé par un outil de test, par exemple) : on l'ignore,
  // l'horloge reste celle de performance.now().
  if (Math.abs(rafT - performance.now()) > 250) {
    presentAt = -1;
    lastRaf = -1;
    return;
  }
  if (lastRaf > 0) {
    const d = rafT - lastRaf;
    // Intervalle d'image lissé ; les trous (onglet caché, gros retard) ne comptent pas.
    if (d > 3 && d < 50) interval += (d - interval) * 0.1;
  }
  lastRaf = rafT;
  presentAt = rafT + interval;
}
/** L'intervalle entre deux images, estimé (ms). */
export const frameInterval = () => interval;
const wall = () => {
  const n = performance.now();
  // Dans l'image en cours : l'heure de son affichage. Après : l'heure réelle.
  const t = presentAt > 0 && n - lastRaf < interval ? presentAt : n;
  return (lastOut = Math.max(lastOut, t));
};
const real = () => (source ? source.now : wall());

export function clockNow() {
  const r = real();
  return scale === 1 && anchorReal === 0 ? r : anchorVirt + (r - anchorReal) / scale;
}
/** Ralentit (k > 1) ou accélère (k < 1) toute l'horloge, sans saut. */
export function setTimeScale(k: number) {
  const v = clockNow();
  anchorReal = real();
  anchorVirt = v;
  scale = k > 0 ? k : 1;
}
export const timeScale = () => scale;
/** L'enregistreur prend l'horloge (ou la rend, avec null). */
export function setClockSource(s: { readonly now: number } | null) {
  const v = clockNow();
  source = s;
  if (anchorReal !== 0 || scale !== 1) {
    anchorReal = real();
    anchorVirt = v;
  }
}
/** L'horloge est-elle tenue par cette source ? */
export const clockHeldBy = (s: object) => source === s;

if (typeof location !== "undefined") {
  if (new URLSearchParams(location.search).get("presse-heure") === "maintenant") presentOn = false;
  const k = Number(new URLSearchParams(location.search).get("presse-ralenti"));
  if (k > 0 && k !== 1) setTimeScale(k);
}
