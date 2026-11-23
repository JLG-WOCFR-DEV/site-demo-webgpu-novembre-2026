/**
 * Vitrine — les vignettes de la bibliothèque : le croquis d'une variante (src/vitrine/types.ts, `Variante.croquis`)
 * dessiné en SVG, grille 100 × 60. Décoratif (`aria-hidden`) : le bouton porte le nom.
 */
import { e } from "./html.ts";

export function croquisSvg(c: string, classe = "vc"): string {
  let s = "";
  for (const brut of c.split(";")) {
    const [k, ...n] = brut.trim().split(/\s+/);
    const [x = 0, y = 0, l = 10, h = 10] = n.map(Number);
    if (k === "i") s += `<rect x="${x}" y="${y}" width="${l}" height="${h}" class="vc-img"/><path d="M${x} ${y + h}L${x + l * 0.4} ${y + h * 0.55}L${x + l * 0.6} ${y + h * 0.75}L${x + l * 0.78} ${y + h * 0.6}L${x + l} ${y + h}" class="vc-mont"/>`;
    else if (k === "t") s += `<rect x="${x}" y="${y}" width="${l}" height="1.6" rx=".8" class="vc-txt"/>`;
    else if (k === "T") s += `<rect x="${x}" y="${y}" width="${l}" height="3.4" rx="1" class="vc-titre"/>`;
    else if (k === "b") s += `<rect x="${x}" y="${y}" width="${l}" height="5" rx="1.2" class="vc-btn"/>`;
    else if (k === "r") s += `<rect x="${x}" y="${y}" width="${l}" height="${n.length > 3 ? h : 4}" class="vc-aplat"/>`;
    else if (k === "c") s += `<circle cx="${x}" cy="${y}" r="2.6" class="vc-rond"/>`;
  }
  return `<svg class="${e(classe)}" viewBox="0 0 100 60" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">${s}</svg>`;
}
