/**
 * Carnet — papier éclairé (P5) : la lumière de l'heure sur la feuille.
 *
 * Le matin, elle vient de la gauche, basse et chaude ; à midi, d'en haut, presque neutre ; le soir,
 * de la droite, dorée ; la nuit, une lampe de bureau en haut à gauche, dont la flaque s'assombrit
 * doucement vers les bords. Lever et coucher suivent la saison (latitude moyenne de la France,
 * sans géolocalisation : la lumière n'a pas besoin de savoir où l'on est).
 *
 * Fonction pure de la date : testable, et le moteur la relit au plus toutes les cinq minutes.
 * Les valeurs vont telles quelles dans shaders/carnet-fx.wgsl (cfx_paper_light).
 */

export type PaperLight = {
  /** Direction vers la lumière à l'écran (x droite, y bas) ; sa longueur dit la lumière rasante. Relief : 0 éteint. */
  light: [number, number, number, number];
  /** Chaleur (−1 froid … 1 chaud), force de la flaque de lampe (0…1), centre de la flaque (uv). */
  lamp: [number, number, number, number];
};

export const LIGHT_OFF: PaperLight = { light: [0, 0, 0, 0], lamp: [0, 0, 0.3, 0.15] };

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Durée du jour (h) selon le jour de l'année : de 8 h 20 en décembre à 16 h en juin, vers 47° N. */
export function dayLength(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1);
  const doy = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 864e5);
  return 12.15 + 3.85 * Math.cos((2 * Math.PI * (doy - 172)) / 365.25);
}

/** Heure locale décimale, ou celle imposée (?heure=21.5, pour les captures et la recette). */
export function hourOf(d: Date) {
  return d.getHours() + d.getMinutes() / 60;
}

export function paperLight(d: Date, hour = hourOf(d)): PaperLight {
  // Midi solaire vers 13 h 30 en été, 12 h 30 en hiver (heure légale française).
  const summer = d.getTimezoneOffset() < new Date(d.getFullYear(), 0, 1).getTimezoneOffset();
  const noon = summer ? 13.6 : 12.6;
  const L = dayLength(d);
  const rise = noon - L / 2;
  const set = noon + L / 2;
  const s = (hour - rise) / (set - rise); // 0 lever … 1 coucher
  const sun = Math.sin(Math.PI * clamp(s)); // hauteur du soleil, 0…1
  // Jour (1) ↔ nuit (0), avec trois quarts d'heure de crépuscule de chaque côté.
  const day = smooth(rise - 0.75, rise + 0.75, hour) * (1 - smooth(set - 0.75, set + 0.75, hour));

  // Soleil : il traverse la page de gauche à droite, rasant au lever et au coucher.
  const az = Math.PI * clamp(s); // 0 à gauche, π à droite
  const rake = 0.85 - 0.5 * sun;
  const sunDir: [number, number] = [-Math.cos(az) * rake, -(0.35 + 0.4 * sun) * rake];
  const sunWarm = clamp(1 - 1.7 * sun, -0.25, 1);
  // Lampe : en haut à gauche, chaude, assez rasante pour montrer la fibre.
  const lampDir: [number, number] = [-0.5, -0.55];

  const mix = (a: number, b: number) => a + (b - a) * day;
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return {
    light: [r3(mix(lampDir[0], sunDir[0])), r3(mix(lampDir[1], sunDir[1])), r3(mix(0.7, 0.55 + 0.45 * (1 - sun))), 0],
    lamp: [r3(mix(0.85, sunWarm)), r3(1 - day), 0.28, 0.12],
  };
}

/** Deux lumières diffèrent-elles assez pour repeindre ? */
export function lightChanged(a: PaperLight, b: PaperLight) {
  return [...a.light, ...a.lamp].some((v, i) => Math.abs(v - [...b.light, ...b.lamp][i]!) > 0.01);
}
