/** État des réglages, écrit par l'interface et lu par la boucle de rendu. */
export type Settings = {
  dom: { boxes: boolean; hideGpu: boolean };
  quad: { radius: number; shadow: number; lift: number; wire: boolean; peel: number };
  glyph: { wave: number; ink: number; scatter: number; atlas: boolean };
  chain: { distort: boolean; rgb: boolean; trame: boolean; bloom: boolean; grain: boolean; print: boolean; split: boolean };
  trame: { cell: number; gain: number; misreg: number; mix: number };
  light: { bloom: number; threshold: number; naive: boolean };
  filter: { kind: number; size: number; amount: number };
  ink: { flow: number; stir: number };
  a11y: { reader: boolean; fade: number; vision: number; spacing: boolean };
  /** Chapitre 04.2 : pile de calques, du dessous vers le dessus. */
  layers: { order: LayerId[]; mode: Record<LayerId, number>; opacity: Record<LayerId, number>; visible: Record<LayerId, boolean>; mask: number };
};

export type LayerId = "glass" | "flower" | "spot";

export const settings: Settings = {
  dom: { boxes: false, hideGpu: false },
  quad: { radius: 6, shadow: 0.45, lift: 0.3, wire: false, peel: 0 },
  glyph: { wave: 0.35, ink: 0, scatter: 0, atlas: false },
  chain: { distort: true, rgb: true, trame: true, bloom: true, grain: true, print: true, split: false },
  trame: { cell: 7, gain: 0.08, misreg: 0.15, mix: 1 },
  light: { bloom: 0.6, threshold: 0.03, naive: false },
  filter: { kind: 1, size: 6, amount: 0.5 },
  ink: { flow: 1, stir: 1 },
  a11y: { reader: false, fade: 0, vision: 0, spacing: false },
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
