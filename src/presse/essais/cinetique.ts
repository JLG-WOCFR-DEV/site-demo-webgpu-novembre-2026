/** Page d'essai du module cinétique (cinetique.html) : dix-huit préréglages et huit composants de texte animé. */
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/archivo/standard-italic.css";
import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource-variable/bodoni-moda/opsz-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { initCinetique, cinetique, CINETIQUES, PRESETS, type Cinetique } from "../cinetique.ts";
import { mountPagesNav } from "../../pages-nav.ts";

/** Le mur : une carte par préréglage, le mot porte son nom. */
const DESCRIPTIONS: Record<Cinetique, string> = {
  monte: "sort de sous sa ligne de base, masqué",
  doux: "petite montée et fondu",
  net: "un flou qui se résout",
  approche: "l'interlettrage se resserre",
  graisse: "du filet à la pleine graisse",
  balai: "révélé par un bord qui avance",
  volet: "bascule sur sa ligne de base",
  porte: "pivote autour de son bord gauche",
  glisse: "arrive de la droite, penché",
  penche: "un cisaillement qui se redresse",
  fonce: "arrive de la caméra",
  parasite: "rouge et cyan, par saccades",
  tombe: "chute, un rebond",
  eclot: "ressort avec dépassement",
  houle: "une vague dans la cascade",
  etire: "haut et mince, puis s'écrase",
  vrille: "tourne en grandissant",
  essaim: "morceaux venus d'ailleurs",
};
const PAR_MOT = new Set<Cinetique>(["net", "approche", "balai", "glisse", "fonce"]);
const mur = document.getElementById("mur");
if (mur) {
  CINETIQUES.forEach((nom, i) => {
    const li = document.createElement("li");
    li.className = PRESETS[nom].joueur ? "carte joueur" : "carte";
    const num = document.createElement("span");
    num.className = "num";
    num.setAttribute("aria-hidden", "true");
    num.textContent = String(i + 1).padStart(2, "0");
    const h = document.createElement("h3");
    h.className = "nom";
    h.id = `p-${nom}`;
    h.textContent = nom;
    h.dataset.cinetique = nom;
    h.dataset.cinetiquePar = PAR_MOT.has(nom) ? "mot" : "lettre";
    h.dataset.cinetiqueRejoue = "";
    const p = document.createElement("p");
    p.textContent = `${DESCRIPTIONS[nom]} · par ${PAR_MOT.has(nom) ? "mot" : "lettre"}`;
    const b = document.createElement("button");
    b.className = "rejouer";
    b.type = "button";
    b.textContent = "Rejouer";
    b.dataset.rejouer = `#p-${nom}`;
    b.setAttribute("aria-label", `Rejouer ${nom}`);
    li.append(num, h, p, b);
    mur.append(li);
  });
}

mountPagesNav();
// ?cinetique-off : la page sans le module (le texte tel quel, pour comparer).
if (!/[?&]cinetique-off\b/.test(location.search)) initCinetique();

// Les boutons « Rejouer » : data-rejouer="<sélecteur>".
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-rejouer]")) {
  b.addEventListener("click", () => {
    for (const el of document.querySelectorAll<HTMLElement>(b.dataset.rejouer ?? "")) cinetique(el).jouer();
  });
}

// Banc d'essai : pilotage depuis Playwright.
Object.assign(window as object, { __cinetique: cinetique });
