/**
 * Intensité du mouvement, commune à toutes les pages : sobre, normal ou
 * expressif. « Sobre » suit l'idée d'Aristide Benoist pour les sites
 * éditoriaux : le même geste, en plus discret. Chaque effet multiplie son
 * amplitude par motionScale() ; le choix suit d'une page à l'autre.
 * Le mouvement réduit du système reste prioritaire : il coupe tout.
 */

export type MotionLevel = "sobre" | "normal" | "expressif";
const FACTOR: Record<MotionLevel, number> = { sobre: 0.4, normal: 1, expressif: 1.6 };
const KEY = "ubs-motion";

let level: MotionLevel = "normal";
try {
  const v = sessionStorage.getItem(KEY);
  if (v === "sobre" || v === "normal" || v === "expressif") level = v;
} catch {
  /* stockage indisponible */
}
const listeners = new Set<(l: MotionLevel) => void>();

export const motionLevel = () => level;
export const motionScale = () => FACTOR[level];
export function setMotionLevel(l: MotionLevel) {
  level = l;
  try {
    sessionStorage.setItem(KEY, l);
  } catch {
    /* rien */
  }
  for (const f of listeners) f(l);
}
export function onMotionLevel(f: (l: MotionLevel) => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}
