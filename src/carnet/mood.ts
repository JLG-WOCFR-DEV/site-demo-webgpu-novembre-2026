/**
 * Carnet — humeur du jour (P4c) : cinq niveaux, pour l'« année en pixels » de la vue Année.
 * Les couleurs vont du bleu froid (difficile) à l'ocre chaud (très bien), lisibles en clair et en sombre ;
 * elles ne portent jamais seules le sens : chaque niveau a un nom.
 */
export const MOODS = [
  { level: 1, name: "Très difficile" },
  { level: 2, name: "Difficile" },
  { level: 3, name: "Entre les deux" },
  { level: 4, name: "Bien" },
  { level: 5, name: "Très bien" },
] as const;

export const moodName = (l: number) => MOODS.find((m) => m.level === l)?.name ?? "";

const KEY = "carnet.annee";
/** Ce que montre la vue Année : l'activité de chaque jour, ou son humeur. */
export function yearMode(): "activite" | "humeur" {
  try {
    return localStorage.getItem(KEY) === "humeur" ? "humeur" : "activite";
  } catch {
    return "activite";
  }
}
export function setYearMode(m: "activite" | "humeur") {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* rien */
  }
}
