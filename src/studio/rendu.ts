/** Studio — le rendu d'un effet dit pour une puce : ce qu'il faut au navigateur, et si on l'a ici. */
import type { Manifeste } from "../registre/effets.ts";

export function puceRendu(m: Pick<Manifeste, "rendu">, gpu: boolean): { texte: string; classe: string; titre: string } {
  if (m.rendu === "DOM") return { texte: "DOM", classe: "st-puce-dom", titre: "Rendu DOM : marche partout, sans carte graphique." };
  if (m.rendu === "canvas 2D") return { texte: "Canvas 2D", classe: "st-puce-dom", titre: "Rendu canvas 2D : marche partout." };
  if (m.rendu === "WebGL2") return { texte: "WebGL2", classe: "st-puce-gpu", titre: "Rendu WebGL2." };
  const requis = m.rendu === "WebGPU" ? "WebGPU requis" : "DOM + WebGPU";
  return gpu
    ? { texte: requis, classe: "st-puce-gpu", titre: "Rendu WebGPU, disponible dans ce navigateur." }
    : { texte: `${requis} · repli`, classe: "st-puce-gpu st-puce-repli", titre: "WebGPU est absent de ce navigateur : l'aperçu montre le repli DOM de l'effet." };
}


let promesse: Promise<boolean> | null = null;
/**
 * WebGPU est-il vraiment là ? `navigator.gpu` ne suffit pas (Chromium sans carte : l'objet existe, aucun adaptateur).
 * Une seule demande d'adaptateur par page, bornée à 1,5 s.
 */
export function gpuDisponible(): Promise<boolean> {
  if (promesse) return promesse;
  const gpu = (globalThis.navigator as Navigator | undefined)?.gpu;
  if (!gpu) return (promesse = Promise.resolve(false));
  promesse = Promise.race([
    gpu.requestAdapter().then(
      (a) => !!a,
      () => false,
    ),
    new Promise<boolean>((r) => setTimeout(() => r(false), 1500)),
  ]);
  return promesse;
}

/** Repose les puces de rendu (`[data-puce-rendu]`, avec `data-rendu`) une fois WebGPU sondé. */
export async function majPucesRendu(racine: ParentNode): Promise<void> {
  const ok = await gpuDisponible();
  for (const el of racine.querySelectorAll<HTMLElement>("[data-puce-rendu]")) {
    const r = puceRendu({ rendu: el.dataset.rendu as Manifeste["rendu"] }, ok);
    el.className = `st-puce ${r.classe}`;
    el.title = r.titre;
    const t = el.querySelector("span");
    if (t) t.textContent = r.texte;
  }
}
