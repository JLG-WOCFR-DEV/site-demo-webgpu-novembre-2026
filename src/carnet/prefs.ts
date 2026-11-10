/**
 * Carnet — préférences du carnet (P7-L0), lues avec leurs valeurs par défaut.
 *
 * Elles vivent dans le carnet (`meta.prefs`, crates/carnet-core/src/prefs.rs) : elles suivent la
 * sauvegarde, les versions et la restauration. Les réglages d'un appareil (stylet, lumière de l'heure,
 * bandeau d'exemple refermé) restent en localStorage, ailleurs.
 *
 * Une valeur inconnue (écrite par une version plus récente, ou abîmée) est ignorée : on rend le défaut.
 */

type PrefSource = { pref(key: string): string | undefined; prefs(): [string, string][] };

/** Les préférences à choix fermé : valeurs permises, la première est le défaut. */
export const CHOICES = {
  titres: ["sobre", "banniere", "cadre", "souligne", "pastille", "etiquette"],
  fond: ["points", "lignes", "carreaux", "blanc", "kraft"],
  encre: ["nuit", "noire", "sepia", "bouteille", "prune"],
  ecriture: ["non", "oui"],
  "mois.vue": ["auto", "grille", "liste"],
  "annee.vue": ["auto", "activite", "humeur"],
  "nav.aide": ["oui", "non"],
} as const;

export type ChoiceKey = keyof typeof CHOICES;
export type Choice<K extends ChoiceKey> = (typeof CHOICES)[K][number];

/** Une préférence à choix fermé, ou son défaut. */
export function choice<K extends ChoiceKey>(src: PrefSource, key: K): Choice<K> {
  const v = src.pref(key);
  const allowed = CHOICES[key] as readonly string[];
  return (v !== undefined && allowed.includes(v) ? v : allowed[0]) as Choice<K>;
}

/** Thème choisi pour un mois (« AAAA-MM ») : un identifiant, « aucun », ou null (automatique). */
export function monthTheme(src: PrefSource, month: string): string | null {
  const v = src.pref(`theme:${month}`);
  return v && /^[a-z0-9-]{1,32}$/.test(v) ? v : null;
}

/** Une préférence en JSON (rubans, clé des puces) ; `fallback` si absente ou illisible. */
export function json<T>(src: PrefSource, key: string, fallback: T, ok: (v: unknown) => v is T): T {
  const raw = src.pref(key);
  if (raw === undefined) return fallback;
  try {
    const v: unknown = JSON.parse(raw);
    return ok(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Signature de toutes les préférences : `draw()` la compare à la précédente et ne réapplique
 * l'apparence (thème, fond, encre) que si elle a changé — ici, dans un autre onglet ou par une restauration.
 */
export function signature(src: PrefSource): string {
  return src
    .prefs()
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}
