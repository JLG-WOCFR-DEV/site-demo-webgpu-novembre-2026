/**
 * Page d'essai du composant « voix » (voix.html) : trois usages, et pour chacun une démonstration (niveau
 * synthétique, sans micro) et des boutons d'état.
 */
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource-variable/bodoni-moda/index.css";
import { initVoix, voix, estEtat, type Etat } from "../voix.ts";
import { mountPagesNav } from "../../pages-nav.ts";

mountPagesNav();
initVoix();

const PHRASES: Record<Etat, string> = {
  repos: "Je vous écoute.",
  ecoute: "À l'écoute…",
  reflexion: "Je cherche…",
  parole: "Demain, ciel dégagé, 14 degrés.",
};

for (const cmd of document.querySelectorAll<HTMLElement>(".cmd[data-pour]")) {
  const el = document.getElementById(cmd.dataset.pour!)!;
  const v = voix(el);
  const etatLu = cmd.querySelector<HTMLElement>("[data-lire=etat]");
  const jauge = cmd.querySelector<HTMLElement>(".jauge");
  const curseur = cmd.querySelector<HTMLInputElement>("input[data-faire=niveau]");

  cmd.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button[data-faire]");
    if (!b) return;
    const f = b.dataset.faire!;
    if (f === "demo") v.demo();
    else if (f === "repos") v.arreter();
    else if (f === "fond") {
      const nuit = el.classList.toggle("nuit");
      el.dataset.voixFond = nuit ? "sombre" : "clair";
      b.setAttribute("aria-pressed", String(nuit));
    } else if (estEtat(f)) v.etat(f);
  });
  curseur?.addEventListener("input", () => {
    const x = Number(curseur.value);
    v.niveau(x > 0 ? x : null);
    if (x > 0 && el.dataset.voixEtat !== "ecoute") v.etat("ecoute");
  });

  const majEtat = () => {
    const e = el.dataset.voixEtat ?? "repos";
    if (etatLu) etatLu.textContent = e;
    for (const b of cmd.querySelectorAll<HTMLButtonElement>("button[data-faire]")) if (estEtat(b.dataset.faire)) b.setAttribute("aria-pressed", String(b.dataset.faire === e));
    const phrase = el.querySelector<HTMLElement>("[data-lire=phrase]");
    if (phrase && estEtat(e)) phrase.textContent = PHRASES[e];
  };
  el.addEventListener("voix:etat", majEtat);
  el.addEventListener("voix:niveau", (e) => jauge?.style.setProperty("--n", String((e as CustomEvent<{ niveau: number }>).detail.niveau)));
  majEtat();
}

// Le téléphone : les quatre palettes.
const tel = document.getElementById("v2")!;
for (const r of document.querySelectorAll<HTMLInputElement>("input[name=pal]")) r.addEventListener("change", () => r.checked && (tel.dataset.voixPalette = r.value));
document.querySelector<HTMLInputElement>("input[data-faire=couleur]")?.addEventListener("input", (e) => {
  tel.dataset.voixCouleur = (e.target as HTMLInputElement).value;
  tel.dataset.voixPalette = "mono";
  const r = document.querySelector<HTMLInputElement>("input[name=pal][value=mono]");
  if (r) r.checked = true;
});

// La dictée : une fausse transcription qui avance avec la démonstration (rien n'est reconnu : c'est un décor).
const dictee = document.getElementById("v3")!;
const texte = dictee.querySelector<HTMLElement>("[data-lire=dictee]")!;
const MOTS = "Penser à rappeler l'atelier lundi matin, réserver la salle du château pour la conférence et relire les épreuves avant jeudi.".split(" ");
let n = 0;
let fort = false;
dictee.addEventListener("voix:niveau", (e) => {
  const x = (e as CustomEvent<{ niveau: number }>).detail.niveau;
  if (dictee.dataset.voixEtat !== "ecoute") return;
  if (x > 0.35 && !fort) {
    fort = true;
    if (n === 0) texte.textContent = "";
    if (n < MOTS.length) texte.textContent += (n ? " " : "") + MOTS[n++];
  } else if (x < 0.15) fort = false;
});
dictee.addEventListener("voix:etat", (e) => {
  if ((e as CustomEvent<{ etat: string }>).detail.etat === "ecoute" && n >= MOTS.length) n = 0;
});
