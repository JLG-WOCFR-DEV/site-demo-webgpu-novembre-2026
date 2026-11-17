/**
 * Éclaircie — le cadre d'attente : ce qu'on montre quand une photo manque.
 * Un aplat un peu plus sombre que le papier, des croix de repérage fines, le
 * nom du fichier et sa proportion en mono, et une silhouette de vêtement
 * dessinée au trait (boîte 100 × 140).
 */
import type { Photo, Silhouette } from "./catalogue.ts";

const TRAITS: Record<Silhouette, string> = {
  // Haut ample : épaules tombantes, manches trois-quarts.
  haut: "M38 30 Q50 36 62 30 L84 38 L96 74 L84 78 L76 56 L76 108 Q50 112 24 108 L24 56 L16 78 L4 74 L16 38 Z",
  // Pantalon large.
  pantalon: "M28 14 L72 14 L74 30 L86 128 L58 130 L50 52 L42 130 L14 128 L26 30 Z M28 22 L72 22",
  // Marinière : le haut, et ses rayures.
  mariniere: "M38 30 Q50 36 62 30 L84 38 L96 74 L84 78 L76 56 L76 108 Q50 112 24 108 L24 56 L16 78 L4 74 L16 38 Z M24 58 H76 M24 68 H76 M24 78 H76 M24 88 H76 M24 98 H76 M19 46 H81",
  // Écharpe : une boucle autour du cou, deux pans, des franges.
  echarpe: "M30 20 Q50 40 70 20 Q78 34 66 46 L72 118 L56 120 L54 50 Q50 52 46 50 L40 112 L26 110 L34 46 Q22 34 30 20 Z M57 120 v6 M61 120 v7 M65 119 v6 M69 119 v6 M28 110 v6 M32 111 v7 M36 111 v6",
  // Boucle d'oreille : crochet, tige, ovale ajouré.
  bijou: "M50 18 Q60 18 60 28 Q60 36 50 38 L50 62 M50 62 m-18 34 a18 30 0 1 0 36 0 a18 30 0 1 0 -36 0 Z M50 74 L50 118 M36 96 H64",
  robe: "M40 12 L44 30 L56 30 L60 12 L66 34 L62 52 L86 128 Q50 136 14 128 L38 52 L34 34 Z",
  veste: "M36 14 L50 34 L64 14 L86 24 L94 96 L82 98 L78 52 L78 124 L22 124 L22 52 L18 98 L6 96 L14 24 Z M50 34 L50 124 M50 60 h-4 M50 80 h-4 M50 100 h-4",
  sac: "M30 50 Q30 20 50 20 Q70 20 70 50 M18 50 H82 L88 124 H12 Z M18 70 H82",
};

const echapper = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Le cadre d'attente d'une photo (élément prêt à poser à la place de l'image). */
export function cadreAttente(photo: Photo, sombre = false): HTMLElement {
  const el = document.createElement("div");
  el.className = "attente" + (sombre ? " attente-sombre" : "");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `Photo à venir : ${photo.fichier}.jpg`);
  const croix = (x: string, y: string) => `<path d="M${x} ${y}m-7 0h14m-7 -7v14" />`;
  el.innerHTML = `
    <svg class="attente-reperes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
    <span class="attente-croix" aria-hidden="true"><svg viewBox="-8 -8 16 16">${croix("0", "0")}<circle r="3.2"/></svg></span>
    <span class="attente-croix" aria-hidden="true"><svg viewBox="-8 -8 16 16">${croix("0", "0")}<circle r="3.2"/></svg></span>
    <span class="attente-croix" aria-hidden="true"><svg viewBox="-8 -8 16 16">${croix("0", "0")}<circle r="3.2"/></svg></span>
    <span class="attente-croix" aria-hidden="true"><svg viewBox="-8 -8 16 16">${croix("0", "0")}<circle r="3.2"/></svg></span>
    <svg class="attente-silhouette" viewBox="0 0 100 140" aria-hidden="true"><path d="${TRAITS[photo.silhouette]}"/></svg>
    <span class="attente-legende" aria-hidden="true">${echapper(photo.fichier)}.jpg<br>${photo.ratio[0]}:${photo.ratio[1]} · ${photo.grand} px</span>`;
  return el;
}
