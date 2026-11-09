/**
 * Carnet — la question du jour : une invitation à écrire, au crayon, comme les suggestions.
 *
 * Une par jour, la même sur tous les appareils (tirée du jour lui-même, pas du hasard), seulement
 * aujourd'hui. « Écrire » en fait une note longue (la question, puis ta réponse en dessous) ; « Écarter »
 * la range jusqu'au lendemain. Les deux sont notés dans le carnet (clé `prompt:AAAA-MM-JJ`), donc la
 * question ne revient pas une fois traitée. Se désactive dans le pied de page.
 */

/** Toute l'année. Courtes, ouvertes, sans injonction au bonheur. */
const ALL = [
  "Qu'est-ce qui t'a fait sourire aujourd'hui ?",
  "Une chose que tu as apprise cette semaine ?",
  "Qu'est-ce que tu remets à plus tard, et pourquoi ?",
  "Une conversation qui t'est restée en tête ?",
  "Qu'est-ce qui t'a demandé du courage récemment ?",
  "Un petit plaisir que tu aimerais t'offrir ?",
  "De quoi es-tu reconnaissant, sans chercher loin ?",
  "Qu'est-ce qui t'a fatigué aujourd'hui ?",
  "Un endroit où tu te sens bien, et ce qui te plaît là-bas ?",
  "Qu'aimerais-tu dire à quelqu'un, sans l'avoir encore dit ?",
  "Une décision que tu es content d'avoir prise ?",
  "Qu'est-ce que tu ferais d'une heure libre, là, maintenant ?",
  "Un livre, un film ou une chanson qui t'accompagne en ce moment ?",
  "Qu'est-ce qui a changé pour toi depuis un an ?",
  "Une habitude que tu aimerais garder, une que tu aimerais quitter ?",
  "Qu'est-ce qui te rend fier, même un peu ?",
  "Quelqu'un à qui tu penses aujourd'hui ?",
  "Qu'est-ce que tu attends avec impatience ?",
  "Un souvenir d'enfance qui t'est revenu ?",
  "Qu'est-ce qui t'a surpris cette semaine ?",
  "Une chose simple qui a bien marché aujourd'hui ?",
  "Qu'est-ce que tu as fait pour toi aujourd'hui ?",
  "Un mot pour décrire ta journée, et pourquoi celui-là ?",
  "Qu'est-ce qui te préoccupe, et qu'est-ce qui en dépend de toi ?",
  "Une personne qui t'a aidé récemment ?",
  "Qu'est-ce que tu aimerais apprendre ?",
  "Une odeur, un son, une couleur de ta journée ?",
  "Qu'est-ce que tu dirais à toi-même d'il y a cinq ans ?",
  "Ce que tu veux retenir de cette semaine ?",
  "Qu'est-ce qui te ferait du bien demain ?",
];

/** Selon la saison (hémisphère nord), un jour sur sept. */
const SEASON: Record<"printemps" | "ete" | "automne" | "hiver", string[]> = {
  printemps: ["Qu'est-ce qui recommence pour toi ce printemps ?", "Ce que tu aimerais planter, au jardin ou ailleurs ?"],
  ete: ["Un moment de cet été que tu veux garder ?", "Où étais-tu à la même heure l'été dernier ?"],
  automne: ["Qu'est-ce que tu veux ranger avant l'hiver ?", "Une chose que tu aimes dans les jours qui raccourcissent ?"],
  hiver: ["Qu'est-ce qui te réchauffe ces jours-ci ?", "Ce que tu espères de l'année qui vient ?"],
};

const seasonOf = (m: number) => (m <= 2 || m === 12 ? "hiver" : m <= 5 ? "printemps" : m <= 8 ? "ete" : "automne");

/** La question d'un jour (AAAA-MM-JJ) : déterministe, jamais la même deux jours de suite. Un jour sur sept,
 * une question de saison ; les autres jours, la liste est parcourue de 7 en 7 (7 et sa longueur sont premiers
 * entre eux : toutes y passent avant qu'une revienne). */
export function promptFor(day: string): string {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  const ord = Math.round(Date.UTC(y, m - 1, Number(day.slice(8, 10))) / 864e5);
  if (ord % 7 === 0) {
    const s = SEASON[seasonOf(m)];
    return s[Math.floor(ord / 7) % s.length]!;
  }
  return ALL[(ord * 7 + y * 11) % ALL.length]!;
}

export const promptKey = (day: string) => `prompt:${day}`;

const KEY = "carnet.questions";
export function promptsOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "non";
  } catch {
    return true;
  }
}
export function setPromptsOn(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? "oui" : "non");
  } catch {
    /* rien */
  }
}
