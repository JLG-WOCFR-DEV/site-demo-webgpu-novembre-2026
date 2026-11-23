/**
 * Page d'essai des courbes (courbes.html) : l'éditeur de courbe du registre, quatre courbes comparées en Web
 * Animations API, et les attributs des effets qui acceptent la valeur produite.
 */
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";
import { mountPagesNav } from "../pages-nav.ts";
import { creerEditeurCourbe, type DetailCourbe } from "../registre/mouvement/editeur-courbe.ts";
import { cheminSvg, lireCourbe, PREREGLAGES, type Courbe } from "../registre/mouvement/courbes.ts";

mountPagesNav();

const icone = (d: string) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONE_REJOUER = icone('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>');
const ICONE_COPIER = icone('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>');
const ICONE_COPIE = icone('<path d="M5 12.5l4.5 4.5L19 7"/>');

const hote = document.getElementById("editeur")!;
const editeur = creerEditeurCourbe(hote, { valeur: "cubic-bezier(0.2, 0, 0, 1)", id: "ed" });
// Pour les essais (Playwright) : l'éditeur et sa fonction.
(window as unknown as { __editeurCourbe: typeof editeur }).__editeurCourbe = editeur;

/* ───────── Comparer : quatre pistes ───────── */

const mq = matchMedia("(prefers-reduced-motion: reduce)");
const PISTES = [
  { cle: "editeur", libelle: "Éditeur", defaut: "" },
  { cle: "b", libelle: "Courbe 2", defaut: "out" },
  { cle: "c", libelle: "Courbe 3", defaut: "ease" },
  { cle: "d", libelle: "Courbe 4", defaut: "out-rebond" },
];
const liste = document.getElementById("comparer")!;
const duree = document.getElementById("cmp-duree") as HTMLInputElement;
const dureeSortie = document.getElementById("cmp-duree-sortie")!;
const rejouer = document.getElementById("cmp-rejouer") as HTMLButtonElement;
rejouer.innerHTML = ICONE_REJOUER;

const options = PREREGLAGES.map((p) => `<option value="${p.nom}">${p.libelle} · ${p.nom}</option>`).join("");
liste.innerHTML = PISTES.map(
  (p, i) => `
  <li class="cmp-piste-ligne" style="--teinte: var(--t${i + 1})" data-piste="${p.cle}">
    <div class="cmp-tete">
      <span class="cmp-vignette" aria-hidden="true"></span>
      ${
        p.cle === "editeur"
          ? `<span class="cmp-nom">${p.libelle}</span>`
          : `<label class="cmp-sr" for="cmp-${p.cle}">${p.libelle}</label><select id="cmp-${p.cle}" class="cmp-choix">${options}</select>`
      }
      <code class="cmp-css"></code>
    </div>
    <div class="cmp-piste" aria-hidden="true"><div class="cmp-rail"><span class="cmp-balle"></span></div><div class="cmp-fantomes"></div></div>
  </li>`,
).join("");
for (const p of PISTES) if (p.defaut) (document.getElementById(`cmp-${p.cle}`) as HTMLSelectElement).value = p.defaut;

const valeurDe = (cle: string) => (cle === "editeur" ? editeur.valeur : (document.getElementById(`cmp-${cle}`) as HTMLSelectElement).value);
let anims: Animation[] = [];

function vignette(f: Courbe) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i <= 64; i++) ((lo = Math.min(lo, f(i / 64))), (hi = Math.max(hi, f(i / 64))));
  return `<svg viewBox="0 0 40 40" width="40" height="40"><rect x="4" y="4" width="32" height="32" rx="4" class="cmp-vignette-fond"/><path d="${cheminSvg(f, 28, 28, lo, hi, 96)}" transform="translate(6 6)" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function jouerTout() {
  for (const a of anims) a.cancel();
  anims = [];
  const ms = Number(duree.value);
  dureeSortie.textContent = `${ms.toLocaleString("fr-FR")} ms`;
  for (const li of liste.querySelectorAll<HTMLLIElement>("[data-piste]")) {
    const l = lireCourbe(valeurDe(li.dataset.piste!));
    if (!l.ok) continue;
    li.querySelector(".cmp-vignette")!.innerHTML = vignette(l.f);
    const code = li.querySelector<HTMLElement>(".cmp-css")!;
    code.textContent = l.css;
    code.title = l.css;
    const rail = li.querySelector<HTMLElement>(".cmp-rail")!;
    const fantomes = li.querySelector<HTMLElement>(".cmp-fantomes")!;
    fantomes.innerHTML = "";
    li.classList.toggle("cmp-reduit", mq.matches);
    if (mq.matches) {
      // Mouvement réduit : la course en neuf positions fixes.
      fantomes.innerHTML = Array.from({ length: 9 }, (_, i) => `<span class="cmp-fantome" style="--p:${l.f(i / 8).toFixed(4)};--o:${(0.18 + (0.82 * i) / 8).toFixed(3)}"></span>`).join("");
      rail.style.transform = "";
      continue;
    }
    rail.style.transform = "";
    anims.push(rail.animate([{ transform: "translateX(0%)" }, { transform: "translateX(100%)" }], { duration: ms, endDelay: 600, iterations: Infinity, easing: l.css, fill: "both" }));
  }
}
liste.addEventListener("change", jouerTout);
duree.addEventListener("input", jouerTout);
rejouer.addEventListener("click", jouerTout);
mq.addEventListener("change", jouerTout);

/* ───────── Dans une page : les attributs ───────── */

const extrait = document.getElementById("extrait")!;
const copier = document.getElementById("extrait-copier") as HTMLButtonElement;
const message = document.getElementById("extrait-message")!;
copier.innerHTML = ICONE_COPIER;
const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let texteExtrait = "";
function ecrireExtrait(d: DetailCourbe) {
  const v = d.nom ?? d.valeur;
  const ms = d.dureeMs;
  const lignes = [
    `<h2 data-anim="monte" data-anim-ease="${v}"${ms ? ` data-anim-dur="${+(ms / 1000).toFixed(3)}"` : ""}>…</h2>`,
    `<p data-cinetique="monte" data-cinetique-courbe="${v}"${ms ? ` data-cinetique-duree="${+(ms / 1000).toFixed(3)}"` : ""}>…</p>`,
    `<div data-goo data-goo-courbe="${v}" data-goo-duree="${ms ?? 520}">…</div>`,
    `<ul data-couloir data-couloir-courbe="${v}" data-couloir-duree="${+((ms ?? 600) / 1000).toFixed(3)}">…</ul>`,
  ];
  texteExtrait = lignes.join("\n");
  extrait.innerHTML = lignes.map((l) => echapper(l).replace(/(data-[a-z-]+)=(&quot;.*?&quot;)/g, '<span class="x-attr">$1</span>=<span class="x-val">$2</span>')).join("\n");
}
copier.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(texteExtrait);
    message.textContent = "Attributs copiés.";
    copier.innerHTML = ICONE_COPIE;
    setTimeout(() => (copier.innerHTML = ICONE_COPIER), 1400);
  } catch {
    message.textContent = "Copie refusée par le navigateur : sélectionnez le texte.";
  }
});

editeur.element.addEventListener("change", (e) => {
  ecrireExtrait((e as CustomEvent<DetailCourbe>).detail);
  jouerTout();
});
ecrireExtrait(editeur.detail);
jouerTout();
