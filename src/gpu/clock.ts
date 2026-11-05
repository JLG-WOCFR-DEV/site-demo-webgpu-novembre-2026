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
const real = () => (source ? source.now : performance.now());

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
  const k = Number(new URLSearchParams(location.search).get("presse-ralenti"));
  if (k > 0 && k !== 1) setTimeScale(k);
}
