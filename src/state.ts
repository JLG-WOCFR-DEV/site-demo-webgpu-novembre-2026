/** État des réglages, écrit par l'interface et lu par la boucle de rendu. */
export type Settings = {
  dom: { boxes: boolean; hideGpu: boolean };
  quad: { radius: number; shadow: number; lift: number; wire: boolean; peel: number; hoverPeel: boolean };
  glyph: { wave: number; ink: number; scatter: number; atlas: boolean };
  chain: { distort: boolean; rgb: boolean; trame: boolean; bloom: boolean; grain: boolean; print: boolean; split: boolean };
  trame: { cell: number; gain: number; misreg: number; mix: number };
  light: { bloom: number; threshold: number; naive: boolean };
  /** Chapitre 06. source : 0 photo, 1 dégradé maillé, 2 encre marbrée, 3 ondes, 4 métaballes. */
  filter: { kind: number; size: number; amount: number; source: number };
  ink: { flow: number; stir: number };
  a11y: { reader: boolean; fade: number; vision: number; spacing: boolean };
  fluid: { force: number; dry: number };
  /** Chapitre 04.2 : pile de calques, du dessous vers le dessus. */
  /**
   * Transitions au défilement (leçon 04.1 et panneau de la barre).
   * style : 0 impression, 1 trame, 2 quadrichromie, 3 buvard, 4 massicot,
   * 5 fondu, 6 rouleau, 7 composition, 8 ligne à ligne, 9 révélateur, 10 pli,
   * 11 aucune. speed : taux de l'amorti (1/s). line : hauteur de la
   * ligne d'impression (part de l'écran). width : largeur du front (part de l'écran).
   */
  transition: { style: number; speed: number; line: number; width: number };
  /** Leçon 06.1 : intensité des matières sur le HTML vivant. */
  matter: { intensity: number };
  /** Grain et fibre : 1 = le dosage réel, à peine visible ; au-delà, une loupe pour le sampler. */
  grain: { amp: number };
  layers: { order: LayerId[]; mode: Record<LayerId, number>; opacity: Record<LayerId, number>; visible: Record<LayerId, boolean>; mask: number };
};

export const TRANSITIONS = ["impression", "trame", "quadri", "buvard", "massicot", "fondu", "rouleau", "composition", "ligne", "revelateur", "pli", "aucune"] as const;
export const TRANSITION_NONE = 11;

export type LayerId = "glass" | "flower" | "spot";

export const settings: Settings = {
  dom: { boxes: false, hideGpu: false },
  quad: { radius: 6, shadow: 0.45, lift: 0.3, wire: false, peel: 0, hoverPeel: true },
  glyph: { wave: 0.35, ink: 0, scatter: 0, atlas: false },
  chain: { distort: true, rgb: true, trame: true, bloom: true, grain: true, print: true, split: false },
  trame: { cell: 7, gain: 0.08, misreg: 0.15, mix: 1 },
  light: { bloom: 0.6, threshold: 0.03, naive: false },
  filter: { kind: 1, size: 6, amount: 0.5, source: 0 },
  grain: { amp: 1 },
  ink: { flow: 1, stir: 1 },
  a11y: { reader: false, fade: 0, vision: 0, spacing: false },
  fluid: { force: 1, dry: 0.5 },
  transition: { style: 0, speed: 4.5, line: 0.86, width: 0.22 },
  matter: { intensity: 1 },
  layers: {
    order: ["glass", "flower", "spot"],
    mode: { glass: 0, flower: 1, spot: 3 },
    opacity: { glass: 1, flower: 0.9, spot: 0.7 },
    visible: { glass: true, flower: true, spot: true },
    mask: 1,
  },
};

export type Pointer = { x: number; y: number; inside: boolean };
export const pointer: Pointer = { x: 0, y: 0, inside: false };

export const motion = {
  /** Préférence système. */
  system: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  /** Bouton Pause de la page (critère 2.2.2). */
  paused: false,
  /** Ce que lit le moteur : l'un ou l'autre suffit. */
  get reduced() {
    return this.system || this.paused;
  },
};
