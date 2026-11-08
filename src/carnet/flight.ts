/**
 * Carnet — le vol entre les vues (semaine ↔ jour).
 *
 * Deux mouvements, chacun chez celui qui sait le faire :
 *   - les lettres : chaque ligne du jour porte data-gl-morph-from vers son
 *     ancienne place, et Presse fait voyager ses glyphes (main.ts) ;
 *   - le cadre : un contour de feuille part du rectangle du bloc et s'étend à
 *     celui de la page (FLIP, Web Animations). Il est transparent : posé au-dessus
 *     du canvas, un fond opaque masquerait l'encre que le GPU imprime dessous.
 *
 * Mêmes courbe et durée que le morphing de Presse, pour un seul geste.
 */
import { DUR, EASE } from "../presse/tokens.ts";

export function flyBetween(first: DOMRect, to: HTMLElement) {
  const last = to.getBoundingClientRect();
  if (last.width < 2 || last.height < 2) return;
  const sheet = document.createElement("div");
  sheet.className = "cn-flysheet";
  sheet.setAttribute("aria-hidden", "true");
  Object.assign(sheet.style, {
    left: `${last.left + scrollX}px`,
    top: `${last.top + scrollY}px`,
    width: `${last.width}px`,
    height: `${last.height}px`,
  });
  document.body.append(sheet);
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;
  const anim = sheet.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 1 },
      { transform: "none", opacity: 1, offset: 0.75 },
      { transform: "none", opacity: 0 },
    ],
    { duration: DUR[3] + 250, easing: EASE.out, fill: "forwards" },
  );
  anim.onfinish = () => sheet.remove();
  anim.oncancel = () => sheet.remove();
}
