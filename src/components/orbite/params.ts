/**
 * Les réglages de l'orbite : une seule table, d'où sortent les défauts, la
 * lecture des attributs HTML (data-…), le panneau de réglages de la page et
 * la balise exportée. Sans DOM : la construction (presse/build) la lit aussi.
 *
 * Les valeurs par défaut du disque et de la lumière sont celles de
 * « Black Hole Particles Bokeh » (compute.toys #202).
 */

export type ParamDef = {
  key: string;
  label: string;
  group: string;
  type: "range" | "select" | "check";
  def: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  choices?: [string, string][];
  /** Demande de refaire les particules (nombre). */
  rebuild?: boolean;
  hint?: string;
};

export const GROUPS = ["Cartes", "Caméra", "Mise au point", "Disque", "Lumière"] as const;

export const PARAMS: ParamDef[] = [
  /* Cartes */
  { key: "layout", label: "Disposition", group: "Cartes", type: "select", def: "tonneau", choices: [["tonneau", "Tonneau"], ["anneau", "Anneau"], ["fond", "Au fond"]], hint: "Tonneau : un cylindre de cartes autour du trou noir. Anneau : des cartes face à vous. Au fond : la carte choisie derrière le trou noir." },
  { key: "radius", label: "Rayon", group: "Cartes", type: "range", def: 16, min: 2, max: 30, step: 0.5 },
  { key: "repeat", label: "Répétitions", group: "Cartes", type: "range", def: 3, min: 1, max: 6, step: 1, hint: "Chaque application revient n fois autour du tonneau." },
  { key: "cardHeight", label: "Hauteur des cartes", group: "Cartes", type: "range", def: 2.6, min: 1, max: 9, step: 0.1 },
  { key: "cardY", label: "Hauteur de l'anneau", group: "Cartes", type: "range", def: 0, min: -12, max: 12, step: 0.5 },
  { key: "selectedScale", label: "Carte choisie (taille)", group: "Cartes", type: "range", def: 1.15, min: 1, max: 2, step: 0.05 },
  { key: "lift", label: "Carte choisie (avancée)", group: "Cartes", type: "range", def: 1.2, min: 0, max: 8, step: 0.1 },
  { key: "ghost", label: "Autres cartes (opacité)", group: "Cartes", type: "range", def: 0.9, min: 0, max: 1, step: 0.05 },
  { key: "fade", label: "Effacer les cartes floues", group: "Cartes", type: "range", def: 0.35, min: 0, max: 1, step: 0.05, hint: "Plus une carte est floue, plus elle s'efface (0 : jamais)." },
  { key: "brightness", label: "Luminosité", group: "Cartes", type: "range", def: 1, min: 0.2, max: 1.5, step: 0.05 },
  { key: "cardBlur", label: "Flou des cartes", group: "Cartes", type: "range", def: 0.6, min: 0, max: 2, step: 0.05, hint: "Part du flou des particules que reçoivent les cartes (1 : le même)." },
  { key: "backFace", label: "Dos des cartes", group: "Cartes", type: "select", def: "miroir", choices: [["sombre", "Sombre"], ["miroir", "Miroir"], ["cache", "Caché"]] },
  { key: "occlude", label: "Les cartes cachent les particules", group: "Cartes", type: "select", def: "toutes", choices: [["choisie", "La choisie"], ["toutes", "Toutes"], ["aucune", "Aucune"]] },

  /* Caméra */
  { key: "distance", label: "Distance", group: "Caméra", type: "range", def: 50.5, min: 15, max: 120, step: 0.5 },
  { key: "elevation", label: "Élévation (°)", group: "Caméra", type: "range", def: 32, min: -80, max: 80, step: 1 },
  { key: "fov", label: "Champ (°)", group: "Caméra", type: "range", def: 43.6, min: 15, max: 100, step: 0.5 },
  { key: "lensShift", label: "Décentrement", group: "Caméra", type: "range", def: 0.1, min: -0.5, max: 0.5, step: 0.01 },
  { key: "dragVertical", label: "Glisser haut / bas : élévation", group: "Caméra", type: "check", def: true },
  { key: "autoRotate", label: "Rotation seule (°/s)", group: "Caméra", type: "range", def: 0, min: -30, max: 30, step: 0.5 },
  { key: "parallax", label: "Parallaxe du pointeur", group: "Caméra", type: "range", def: 1, min: 0, max: 3, step: 0.05 },
  { key: "dive", label: "Plonger dans la carte à l'ouverture", group: "Caméra", type: "check", def: true },

  /* Mise au point */
  { key: "focus", label: "Mise au point", group: "Mise au point", type: "select", def: "carte", choices: [["carte", "Sur la carte"], ["fixe", "Distance fixe"]] },
  { key: "focusDist", label: "Distance fixe", group: "Mise au point", type: "range", def: 53, min: 5, max: 140, step: 0.5 },
  { key: "focusOffset", label: "Décalage", group: "Mise au point", type: "range", def: 0, min: -20, max: 20, step: 0.5 },
  { key: "focusSpeed", label: "Vitesse de mise au point", group: "Mise au point", type: "range", def: 4, min: 0.5, max: 20, step: 0.5 },
  { key: "blur", label: "Flou (px par unité)", group: "Mise au point", type: "range", def: 0.743, min: 0, max: 3, step: 0.01 },
  { key: "maxBlur", label: "Flou maximal (px)", group: "Mise au point", type: "range", def: 32, min: 2, max: 80, step: 1 },

  /* Disque */
  { key: "particles", label: "Particules", group: "Disque", type: "range", def: 16384, min: 1024, max: 131072, step: 1024, rebuild: true },
  { key: "kerrA", label: "Rotation du trou noir (a)", group: "Disque", type: "range", def: 0.876, min: 0, max: 0.99, step: 0.005 },
  { key: "initSpeed", label: "Vitesse initiale", group: "Disque", type: "range", def: 0.719, min: 0.5, max: 1, step: 0.005 },
  { key: "initThick", label: "Épaisseur initiale", group: "Disque", type: "range", def: 0.22, min: 0.01, max: 1, step: 0.01 },
  { key: "timeStep", label: "Pas de temps", group: "Disque", type: "range", def: 0.072, min: 0.005, max: 0.2, step: 0.001 },
  { key: "simSpeed", label: "Vitesse de la simulation", group: "Disque", type: "range", def: 1, min: 0, max: 3, step: 0.05 },

  /* Lumière */
  { key: "exposure", label: "Exposition", group: "Lumière", type: "range", def: 0.369, min: 0.02, max: 2, step: 0.005 },
  { key: "gamma", label: "Gamma", group: "Lumière", type: "range", def: 0.827, min: 0.2, max: 1.6, step: 0.005 },
  { key: "energy", label: "Énergie d'une particule", group: "Lumière", type: "range", def: 20, min: 2, max: 80, step: 0.5 },
  { key: "minSize", label: "Taille nette (px)", group: "Lumière", type: "range", def: 1.5, min: 0.5, max: 6, step: 0.1 },
  { key: "hueShift", label: "Décalage de teinte", group: "Lumière", type: "range", def: 0, min: 0, max: 1, step: 0.01 },
  { key: "hueSpread", label: "Dispersion de teinte", group: "Lumière", type: "range", def: 0.33, min: 0, max: 1, step: 0.01 },
  { key: "saturation", label: "Saturation", group: "Lumière", type: "range", def: 1, min: 0, max: 2, step: 0.05 },
];

/** Réglages conseillés par disposition (appliqués quand on en change dans le panneau). */
export const LAYOUT_DEFAULTS: Record<string, Record<string, number | string>> = {
  tonneau: { radius: 16, repeat: 3, cardHeight: 2.6, lift: 1.2, ghost: 0.9, fade: 0.35, selectedScale: 1.15, cardBlur: 0.6, occlude: "toutes", backFace: "miroir" },
  anneau: { radius: 9, repeat: 1, cardHeight: 3.1, lift: 1.6, ghost: 0.5, fade: 0.7, selectedScale: 1.4, cardBlur: 1, occlude: "choisie", backFace: "sombre" },
  fond: { radius: 9, repeat: 1, cardHeight: 3.1, lift: 1.6, ghost: 0.5, fade: 0.7, selectedScale: 1.4, cardBlur: 1, occlude: "choisie", backFace: "sombre" },
};

export type OrbiteConfig = Record<string, number | string | boolean>;

/** Le nom d'attribut d'un réglage : kerrA → kerr-a (data-kerr-a sur la section). */
export const attrOf = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
export const ATTRS = PARAMS.map((p) => attrOf(p.key));

export const defaults = (): OrbiteConfig => Object.fromEntries(PARAMS.map((p) => [p.key, p.def]));

/** Une valeur lue (attribut, stockage) ramenée à son type et à ses bornes. */
export function coerce(p: ParamDef, v: unknown): number | string | boolean {
  if (v === undefined || v === null) return p.def;
  // Un attribut booléen présent sans valeur vaut « oui ».
  if (p.type === "check") return v === true || v === "" || v === "true" || v === "1";
  if (v === "") return p.def;
  if (p.type === "select") return p.choices!.some(([c]) => c === v) ? String(v) : p.def;
  const n = Number(v);
  if (!Number.isFinite(n)) return p.def;
  return Math.min(p.max ?? n, Math.max(p.min ?? n, n));
}

/** Les réglages d'après les attributs data-… d'un élément (dataset). */
export function fromDataset(d: Record<string, string | undefined>): OrbiteConfig {
  const c = defaults();
  for (const p of PARAMS) if (d[p.key] !== undefined) c[p.key] = coerce(p, d[p.key]);
  // Ancien sens de « aperture » (1 = le flou de l'original).
  if (d.aperture !== undefined && d.blur === undefined) c.blur = 0.743 * (Number(d.aperture) || 1);
  return c;
}

/** La balise qui reproduit les réglages : seulement ce qui diffère des défauts. */
export function toAttributes(c: OrbiteConfig) {
  const out: string[] = [];
  for (const p of PARAMS) {
    const v = c[p.key];
    if (v === p.def) continue;
    if (p.type === "check") out.push(v ? attrOf(p.key) : `${attrOf(p.key)}="false"`);
    else out.push(`${attrOf(p.key)}="${typeof v === "number" ? +v.toFixed(4) : v}"`);
  }
  return out.join(" ");
}
