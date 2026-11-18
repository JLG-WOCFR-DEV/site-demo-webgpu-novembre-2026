/** Créateur — messages entre l'éditeur et l'aperçu (postMessage, marqués `cr: 1`). */
import type { Site } from "./model.ts";

export type ToPreview =
  | { type: "site"; site: Site; page: string; selected?: string }
  | { type: "select"; id: string; reveal?: boolean }
  | { type: "mode"; edit: boolean }
  | { type: "scroll"; top: number };

export type FromPreview =
  | { type: "ready"; gpu: boolean; page: string }
  | { type: "select"; id: string }
  | { type: "action"; id: string; op: "up" | "down" | "dup" | "del" }
  | { type: "edit"; id: string; field: string; item?: number; para?: number; line?: number; value: string; live?: boolean }
  | { type: "key"; key: string; meta: boolean; shift: boolean; alt: boolean }
  /** Ctrl/⌘ + molette ou pincement sur l'aperçu : l'éditeur zoome l'aperçu (x, y : px de la page de l'aperçu). */
  | { type: "zoom"; deltaY: number; deltaMode: number; x: number; y: number }
  /** Bouton du milieu tiré sur l'aperçu : l'éditeur le déplace (px de l'écran). */
  | { type: "pan"; dx: number; dy: number }
  | { type: "gpu"; ok: boolean };
