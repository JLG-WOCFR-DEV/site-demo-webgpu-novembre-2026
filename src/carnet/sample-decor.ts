/**
 * Carnet — le décor du carnet d'exemple (P7-L1) : quelques autocollants de saison, un trait de
 * surligneur sous une tâche, un petit cœur à l'encre. Il montre dès la première seconde ce que le
 * carnet sait faire.
 *
 * Posé une fois, juste après le premier rendu du carnet d'exemple : les positions viennent de la page
 * telle qu'elle est dessinée (le surligneur passe sous la bonne ligne). Déterministe pour un jour donné.
 */
import type { Pages } from "./pages.ts";
import { addDays, type Day } from "./model.ts";
import { seasonOf, type Season } from "./stickers.ts";

/** Le surligneur : la teinte la plus claire et chaude de la saison (un vrai surligneur, pas une encre). */
const MARKER: Record<Season, string> = { printemps: "#f7d774", ete: "#f2b134", automne: "#e0a33a", hiver: "#7fa7c9" };

const BY_SEASON: Record<Season, [string, string]> = {
  printemps: ["saison/fleur", "saison/escargot"],
  ete: ["saison/soleil", "saison/nuage"],
  automne: ["saison/feuille", "saison/champignon"],
  hiver: ["saison/flocon", "saison/sapin"],
};

/** Un petit cœur au trait, de taille `r`, pression variable (plus appuyé dans les courbes). */
function heart(r: number): number[] {
  const out: number[] = [];
  const n = 44;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    out.push((x * r) / 16, (y * r) / 16, 0.35 + 0.5 * Math.abs(Math.sin(t)));
  }
  return out;
}

export function seedDecor(root: HTMLElement, pages: Pages, now: Day) {
  const season = seasonOf(now);
  const [s1, s2] = BY_SEASON[season];
  const block = root.querySelector<HTMLElement>(`[data-block="day:${now}"]`);
  if (!block) return;
  const key = `day:${now}`;
  const w = block.clientWidth || 600;
  const br = block.getBoundingClientRect();
  const rel = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - br.left, y: r.top - br.top, w: r.width, h: r.height };
  };
  const rowText = (needle: string) => [...block.querySelectorAll(".cn-row:not(.cn-ghost) .cn-text")].find((t) => t.textContent?.includes(needle));
  // À côté du nom du jour : là, il ne cache ni une ligne ni un bouton, sur ordinateur comme sur téléphone.
  const nameSpot = (b: HTMLElement) => {
    const n = b.querySelector(".cn-dname");
    const bb = b.getBoundingClientRect();
    const r = n?.getBoundingClientRect();
    return r ? { x: Math.min(b.clientWidth - 34, r.right - bb.left + 76), y: r.top - bb.top + r.height / 2 } : { x: b.clientWidth / 2, y: 24 };
  };
  pages.mutate(key, (p) => {
    // À côté du nom du jour, un autocollant de saison, un peu de travers.
    const at = nameSpot(block);
    p.addSticker(s1, season, at.x, at.y, w, -8, 0.78);
    // À côté de la course, l'autocollant « sport ».
    const run = rowText("Course");
    if (run) {
      const r = rel(run);
      p.addSticker("activite/sport", season, Math.min(w - 36, r.x + r.w + 40), r.y + r.h / 2, w, 7, 0.6);
    }
    // Un trait de surligneur sous la tâche prioritaire, tiré à main levée.
    const brief = rowText("Finir le brief");
    if (brief) {
      const r = rel(brief);
      const pts: number[] = [];
      const len = r.w + 6;
      for (let x = 0; x <= len; x += 6) pts.push(x, Math.sin(x / 37) * 1.2 + (x / len) * -1.5, 0.5);
      p.addStroke("surligneur", MARKER[season], 2.4, r.x - 3, r.y + r.h - 8, w, new Float32Array(pts));
    }
    // Un petit cœur à l'encre de l'atelier, dans la marge basse du jour.
    const ink = getComputedStyle(block).getPropertyValue("--accent").trim() || "#2c6a56";
    p.addStroke("encre", ink, 1.4, w - 64, Math.max(60, block.clientHeight - 34), w, new Float32Array(heart(11)));
  });
  // La veille : le second autocollant de saison.
  const yb = root.querySelector<HTMLElement>(`[data-block="day:${addDays(now, -1)}"]`);
  if (!yb) return;
  const at = nameSpot(yb);
  pages.mutate(`day:${addDays(now, -1)}`, (p) => p.addSticker(s2, season, at.x, at.y, yb.clientWidth || w, 9, 0.66));
}
