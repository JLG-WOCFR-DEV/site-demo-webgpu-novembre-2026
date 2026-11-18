/**
 * Couloir — page de démo du module couloir (couloir.html) : le mur, et un panneau de réglages en direct.
 *
 * Chaque réglage du panneau devient un attribut data-couloir-… sur le mur, que le module relit (`regler()`) :
 * ce qu'on voit est exactement ce que donnent les attributs copiés. Les réglages sont gardés dans le
 * localStorage (s'il est disponible) ; `?neuf` repart du préréglage.
 */
import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource-variable/archivo/wdth.css";
import "./style.css";
import { mountPagesNav } from "../pages-nav.ts";
import { attributsDe, controleCouloir, initCouloir, lireReglages, type Reglages } from "../presse/couloir.ts";
import { creerPopup } from "../presse/comportements/popup.ts";

const CLE = "couloir:attributs";
const mur = document.querySelector<HTMLElement>("#mur")!;
const form = document.querySelector<HTMLFormElement>("#reglages")!;
const declencheur = document.querySelector<HTMLButtonElement>("#ouvrir-reglages")!;
const etat = document.querySelector<HTMLElement>("#copie-etat")!;
/** Les attributs fixes de la page (pas des réglages). */
const FIXES = new Set(["couloir", "couloirOuvre", "couloirCommandes"]);

const lireStock = (): Record<string, string> | null => {
  try {
    if (/[?&]neuf(=|&|$)/.test(location.search)) return null;
    const brut = localStorage.getItem(CLE);
    const o = brut ? (JSON.parse(brut) as unknown) : null;
    return o && typeof o === "object" ? (o as Record<string, string>) : null;
  } catch {
    return null;
  }
};
const ecrireStock = () => {
  try {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(mur.dataset)) if (k.startsWith("couloir") && !FIXES.has(k) && v != null) o[k] = v;
    localStorage.setItem(CLE, JSON.stringify(o));
  } catch {
    /* stockage indisponible : les réglages durent le temps de la visite */
  }
};

// Les réglages gardés, posés avant d'armer le module (il les lit dès la première image).
const garde = lireStock();
if (garde) {
  for (const k of Object.keys(mur.dataset)) if (k.startsWith("couloir") && !FIXES.has(k)) delete mur.dataset[k];
  for (const [k, v] of Object.entries(garde)) if (/^couloir[A-Z][a-z]+$/.test(k) && typeof v === "string") mur.dataset[k] = v;
}

const ctl = initCouloir().get(mur) ?? null;
mountPagesNav();

/* ---------------------------------------------------------------- le panneau */

const champ = <T extends Element>(nom: string) => [...form.querySelectorAll<T>(`[name="${nom}"]`)];
const CURSEURS = ["profondeur", "angle", "horizon", "hauteur", "largeur", "ecart", "vitesse", "aberration", "flou", "vide"] as const;
const unite: Partial<Record<(typeof CURSEURS)[number], string>> = { angle: "°", horizon: " %", ecart: " px" };

function peindrePanneau(r: Reglages) {
  champ<HTMLSelectElement>("presets")[0]!.value = r.preset ?? "micro";
  for (const nom of ["cote", "mode", "mur"] as const) for (const i of champ<HTMLInputElement>(nom)) i.checked = i.value === r[nom];
  for (const i of champ<HTMLInputElement>("pilotage")) i.checked = r.pilotage.includes(i.value as Reglages["pilotage"][number]);
  for (const nom of CURSEURS) {
    const i = champ<HTMLInputElement>(nom)[0]!;
    i.value = String(r[nom]);
    const o = i.nextElementSibling as HTMLOutputElement;
    const val = nom === "horizon" || nom === "ecart" ? String(Math.round(r[nom])) : String(Math.round(r[nom] * 100) / 100).replace(".", ",");
    o.textContent = val + (unite[nom] ?? "");
    i.setAttribute("aria-valuetext", o.textContent);
  }
}

const scene = document.querySelector<HTMLElement>(".scene")!;
/** Le texte de la page suit le mur : à gauche si le mur fuit à gauche, clair sur un fond sombre. */
function accorderScene(r: Reglages) {
  scene.classList.toggle("scene-gauche", r.cote === "gauche" && r.mode === "mur");
  const fond = r.fond.match(/^#([0-9a-f]{6})$/i)?.[1];
  const sombre = fond ? [0, 2, 4].map((k) => parseInt(fond.slice(k, k + 2), 16)).reduce((a, c) => a + c, 0) < 3 * 90 : false;
  scene.classList.toggle("scene-sombre", sombre);
  document.body.style.background = r.fond || "";
}

function appliquer() {
  (ctl ?? controleCouloir(mur))?.regler();
  const r = lireReglages(mur.dataset);
  peindrePanneau(r);
  accorderScene(r);
  ecrireStock();
}

form.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement | HTMLSelectElement;
  if (t.name === "presets") {
    // Un nouveau préréglage repart de zéro : ses valeurs, sans les retouches précédentes.
    for (const k of Object.keys(mur.dataset)) if (k.startsWith("couloir") && !FIXES.has(k)) delete mur.dataset[k];
    mur.dataset.couloirPresets = t.value;
  } else if (t.name === "pilotage") {
    mur.dataset.couloirPilotage = champ<HTMLInputElement>("pilotage").filter((i) => i.checked).map((i) => i.value).join(" ");
  } else if (t.name) {
    mur.setAttribute(`data-couloir-${t.name}`, t.value);
  }
  appliquer();
});
form.addEventListener("submit", (e) => e.preventDefault());

document.querySelector("#raz")!.addEventListener("click", () => {
  const p = mur.dataset.couloirPresets ?? "micro";
  for (const k of Object.keys(mur.dataset)) if (k.startsWith("couloir") && !FIXES.has(k)) delete mur.dataset[k];
  mur.dataset.couloirPresets = p;
  appliquer();
  etat.textContent = "Préréglage rétabli.";
});

document.querySelector("#copier")!.addEventListener("click", async () => {
  const texte = attributsDe(lireReglages(mur.dataset));
  try {
    await navigator.clipboard.writeText(texte);
    etat.textContent = "Attributs copiés.";
  } catch {
    // Presse-papiers refusé : le texte, à copier à la main.
    etat.textContent = texte;
  }
});

const popup = creerPopup(form, { cote: "haut", alignement: "debut", decalage: 10, marge: 12, fermerExterieur: false, fermerSurPerteFocus: false, role: "dialog" });
declencheur.addEventListener("click", () => popup.basculer(declencheur));
document.querySelector("#fermer-reglages")!.addEventListener("click", () => popup.fermer("programme"));

peindrePanneau(lireReglages(mur.dataset));
accorderScene(lireReglages(mur.dataset));

// Pour les essais.
Object.assign(window, { __couloir: { mur, ctl: () => controleCouloir(mur), popup, appliquer } });
