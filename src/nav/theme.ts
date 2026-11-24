/**
 * Navigation — le thème de l'interface Presse (menu Pages, palette, Studio, Sampler Presse) : celui du système, ou
 * « clair » / « sombre » choisi dans la palette (gardé : `presse:nav.theme@1`). Posé sur <html> en
 * `data-presse-theme` ; les feuilles de l'interface le lisent (`:root[data-presse-theme="sombre"]`). Les pages
 * elles-mêmes gardent leurs couleurs (une démo n'est pas re-thémée).
 */
import { CLES, ecrire, lire, retirer } from "../registre/stockage.ts";

export type Theme = "clair" | "sombre";

/** Le choix de cette visite, si le stockage l'a refusé. */
let enMemoire: Theme | null | undefined;

export function themeChoisi(): Theme | null {
  if (enMemoire !== undefined) return enMemoire;
  const v = lire(CLES.navTheme);
  return v === "clair" || v === "sombre" ? v : null;
}

export function themeSysteme(): Theme {
  try {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "sombre" : "clair";
  } catch {
    return "clair";
  }
}

export const themeEffectif = (): Theme => themeChoisi() ?? themeSysteme();

export function appliquerTheme(t: Theme | null = themeChoisi()) {
  const h = document.documentElement;
  if (t) h.dataset.presseTheme = t;
  else delete h.dataset.presseTheme;
}

/** Clair ⇄ sombre (le choix revient au système quand il retombe sur lui). */
export function basculerTheme(): Theme {
  const neuf: Theme = themeEffectif() === "sombre" ? "clair" : "sombre";
  const choix = neuf === themeSysteme() ? null : neuf;
  if (choix === null) retirer(CLES.navTheme);
  enMemoire = choix === null || ecrire(CLES.navTheme, choix) ? undefined : choix;
  appliquerTheme(choix);
  return neuf;
}
