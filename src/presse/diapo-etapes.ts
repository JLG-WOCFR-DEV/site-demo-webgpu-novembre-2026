/**
 * Presse — l'ordre des apparitions d'une diapo (sans DOM : le diaporama et le Créateur le partagent).
 *
 * Chaque étape (`data-step`) peut porter :
 *   - `data-step-ordre="n"` : sa place, triée de façon stable ; sans elle, sa place dans le document (1, 2, 3…) ;
 *   - `data-step-depart="avec"` : elle part en même temps que la précédente, sans nouvel appui ;
 *     `data-step-depart="apres"` : elle part d'elle-même à la fin de la précédente.
 * Une étape « avec » ou « après » en tête de diapo part à l'arrivée de la diapo (appui 0).
 */
export type Depart = "appui" | "avec" | "apres";
export type StepAttrs = { ordre?: string | null; depart?: string | null };
/** Une étape à sa place : `index` dans l'ordre du document, `click` l'appui qui la lance (0 : l'arrivée de la diapo). */
export type StepPlan = { index: number; depart: Depart; click: number };

export const departOf = (v: string | null | undefined): Depart => (v === "avec" || v === "apres" ? v : "appui");

/** Les étapes dans l'ordre où elles partent, chacune avec son appui. */
export function planSteps(items: readonly StepAttrs[]): StepPlan[] {
  const keyed = items.map((it, index) => {
    const n = Number.parseFloat(it.ordre ?? "");
    return { index, key: Number.isFinite(n) ? n : index + 1, depart: departOf(it.depart) };
  });
  // Array.prototype.sort est stable : à clé égale, l'ordre du document.
  keyed.sort((a, b) => a.key - b.key);
  let click = 0;
  return keyed.map((k) => {
    if (k.depart === "appui") click++;
    return { index: k.index, depart: k.depart, click };
  });
}

/** Le repère d'une étape dans la liste du Créateur : « 2 », « 2+ » (avec la précédente), « 2› » (après). */
export const stepMark = (p: StepPlan) => `${p.click}${p.depart === "avec" ? "+" : p.depart === "apres" ? "›" : ""}`;

/**
 * Déplacer une étape d'un cran (−1 : plus tôt, +1 : plus tard). Rend les nouvelles valeurs de `data-step-ordre`, dans
 * l'ordre du document (null : l'attribut est retiré — quand l'ordre obtenu est celui du document), ou null si rien ne bouge.
 */
export function moveStep(items: readonly StepAttrs[], index: number, dir: -1 | 1): (string | null)[] | null {
  const order = planSteps(items).map((p) => p.index);
  const at = order.indexOf(index);
  const to = at + dir;
  if (at < 0 || to < 0 || to >= order.length) return null;
  [order[at], order[to]] = [order[to]!, order[at]!];
  const natural = order.every((v, k) => v === k);
  const out: (string | null)[] = items.map(() => null);
  if (!natural) order.forEach((idx, k) => (out[idx] = String(k + 1)));
  return out;
}
