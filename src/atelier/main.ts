import "./style.css";
import { type ObjetStyle, objetOf } from "../components/objet/objet.ts";
import { mountDebugPanel } from "../debug-panel.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { mountComponents } from "../presse/components.ts";

/**
 * Page « Atelier » : <x-objet> en plein écran, et ses réglages. D'après les
 * composants « Object » de Canvas UI (ASCII, Dithered, Ink, Glass, Particle,
 * Liquid), refaits en WebGPU : aucun code repris.
 */
mountPagesNav();
mountDebugPanel();

const TEXT: Record<ObjetStyle, [string, string]> = {
  ascii: ["ASCII", "L'objet redessiné en caractères, du plus léger au plus dense selon la lumière : l'ombre se remplit, les reflets se vident. Les plus hautes lumières passent à l'encre rouge."],
  tramage: ["Tramé", "Un seul bit par point : un seuil ordonné de Bayer sur des pixels de 3 px, l'objet et l'ombre au sol compris."],
  encre: ["Encre", "Hachures croisées qui s'épaississent dans l'ombre, contours au pinceau là où la profondeur ou la surface cassent, encre pressée à la main sur un papier qui a du grain."],
  verre: ["Verre", "Le verre dévie la composition qui est derrière selon sa surface, disperse les couleurs sur les bords, se givre au réglage, et prend un reflet au bord (Fresnel)."],
  particules: ["Particules", "60 000 points tirés sur la surface. Chacun est un ressort vers sa place ; le pointeur les chasse, ils reviennent. Une passe de calcul, un appel de dessin."],
  liquide: ["Liquide", "L'objet traîné dans un liquide invisible : il tourbillonne sous le pointeur, et la lumière se sépare en trois couleurs qui ne suivent pas tout à fait."],
};

const root = document.querySelector<HTMLElement>(".x-objet")!;
const code = document.querySelector<HTMLElement>("[data-at-code]")!;
await mountComponents();
const api = objetOf(root);

const writeCode = () => {
  if (!api) return;
  const c = api.config;
  const extra = [
    c.cell !== 1 ? ` cell="${c.cell}"` : "",
    c.amount !== 1 ? ` amount="${c.amount}"` : "",
    c.style === "verre" && c.frost !== 0.25 ? ` frost="${c.frost}"` : "",
    c.spin !== 1 ? ` spin="${c.spin}"` : "",
  ].join("");
  code.textContent = `<x-objet style="${c.style}" model="${c.model}"${extra}></x-objet>`;
};
const showStyle = (s: ObjetStyle) => {
  document.querySelector("[data-at-title]")!.textContent = TEXT[s][0];
  document.querySelector("[data-at-lede]")!.textContent = TEXT[s][1];
  document.querySelector<HTMLElement>("[data-at-frost]")!.hidden = s !== "verre";
  document.body.dataset.style = s;
};

const start = new URLSearchParams(location.search);
for (const r of document.querySelectorAll<HTMLInputElement>("input[name=at-style]")) {
  if (start.get("rendu") === r.value) r.checked = true;
  r.addEventListener("change", () => {
    if (!r.checked) return;
    api?.set({ style: r.value as ObjetStyle });
    showStyle(r.value as ObjetStyle);
    writeCode();
    const u = new URL(location.href);
    u.searchParams.set("rendu", r.value);
    history.replaceState(null, "", u);
  });
}
for (const r of document.querySelectorAll<HTMLInputElement>("input[name=at-model]")) {
  r.addEventListener("change", () => {
    if (!r.checked) return;
    api?.set({ model: r.value });
    writeCode();
  });
}
document.querySelector<HTMLInputElement>("[data-at-file]")!.addEventListener("change", (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f || !api) return;
  for (const r of document.querySelectorAll<HTMLInputElement>("input[name=at-model]")) r.checked = false;
  void api.load(f);
});
for (const input of document.querySelectorAll<HTMLInputElement>(".at-range input")) {
  const out = input.parentElement!.querySelector("output")!;
  input.addEventListener("input", () => {
    out.textContent = input.value.replace(".", ",");
    api?.set({ [input.name]: Number(input.value) });
    writeCode();
  });
}
const initial = (start.get("rendu") ?? "ascii") as ObjetStyle;
api?.set({ style: initial });
showStyle(initial);
writeCode();
