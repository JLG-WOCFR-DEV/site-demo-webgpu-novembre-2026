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
  | { type: "gpu"; ok: boolean };
