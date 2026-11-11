/**
 * Mettre le moteur Presse en pause depuis n'importe quel module, sans le connaître : un événement `window`.
 *
 *   dispatchEvent(new CustomEvent("presse:pause", { detail: { on: true, by: "visionneuse" } }))
 *
 * Chaque demandeur (`by`) tient sa propre pause : le moteur dort tant qu'au moins un la tient. Sans moteur sur la
 * page, l'événement ne réveille personne. En pause, le canvas du moteur garde sa dernière image (rien n'y est
 * présenté) ; à la reprise, les intégrateurs repartent d'un pas d'image normal (voir engine.ts).
 */
export const PAUSE_EVENT = "presse:pause";
export type PauseDetail = { on: boolean; by?: string };

/** Demande (on = true) ou rend (on = false) la pause du moteur, au nom de `by`. */
export function holdEngine(by: string, on: boolean) {
  if (typeof dispatchEvent !== "function") return;
  dispatchEvent(new CustomEvent<PauseDetail>(PAUSE_EVENT, { detail: { on, by } }));
}
