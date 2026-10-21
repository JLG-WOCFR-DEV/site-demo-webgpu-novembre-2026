import { DEFAULT_LAB, MaterialClock, type LabSettings } from "./lab.ts";

/** État des réglages, écrit par l'interface et lu par la boucle de rendu. */
export type Settings = {
  dom: { boxes: boolean; hideGpu: boolean };
  quad: { radius: number; shadow: number; lift: number; wire: boolean };
  glyph: { wave: number; ink: number; scatter: number; atlas: boolean };
  chain: { distort: boolean; rgb: boolean; trame: boolean; bloom: boolean; grain: boolean; split: boolean };
  trame: { cell: number; gain: number; misreg: number; mix: number };
  light: { bloom: number; threshold: number; naive: boolean };
  lab: LabSettings;
};

export const settings: Settings = {
  dom: { boxes: false, hideGpu: false },
  quad: { radius: 6, shadow: 0.45, lift: 0.3, wire: false },
  glyph: { wave: 0.35, ink: 0, scatter: 0, atlas: false },
  chain: { distort: true, rgb: true, trame: true, bloom: true, grain: true, split: false },
  trame: { cell: 7, gain: 0.08, misreg: 0.15, mix: 1 },
  light: { bloom: 0.6, threshold: 0.03, naive: false },
  lab: { ...DEFAULT_LAB },
};

export const labClock = new MaterialClock();

export type Pointer = { x: number; y: number; inside: boolean };
export const pointer: Pointer = { x: 0, y: 0, inside: false };

export const motion = {
  reduced: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
};
