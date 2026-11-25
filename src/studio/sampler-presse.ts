/**
 * Le Sampler Presse (sampler-presse.html) : une grille alimentée par le registre (src/registre/effets.ts), filtrée
 * par catégorie, rendu, statut et « réglable dans le Studio », avec une recherche. Chaque carte : une vignette
 * dessinée (src/studio/vignettes.ts), le nom, le résumé, le rendu (« DOM », « WebGPU requis », et le repli si
 * WebGPU manque ici), le coût (GPU estimé, JS mesuré en ko gzip : src/registre/couts.json), les liens vers la page d'effet du Studio et la page d'exemple. Les filtres vivent dans la
 * requête de l'adresse. Le Sampler PLI (sampler.html, généré par tools/build-sampler.py) reste à part.
 */
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/bodoni-moda/opsz.css";
import "./jetons.css";
import "./sampler-presse.css";
import { mountPagesNav } from "../pages-nav.ts";
import { EFFETS, type Categorie, type Manifeste } from "../registre/effets.ts";
import { ecrireFiltres, FAMILLES_RENDU, familleDe, filtrer, lireFiltres, type Filtres } from "./filtres.ts";
import { majPucesRendu, puceCout, puceRendu } from "./rendu.ts";
import { ic } from "./icones.ts";
import { vignette } from "./vignettes.ts";

const NOMS: Record<Categorie, string> = { texte: "Texte", image: "Image", matiere: "Matière", interface: "Interface", transition: "Transition", forme: "Forme", dessin: "Dessin", page: "Page" };
const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const declencheur = document.querySelector<HTMLButtonElement>("[data-pages-trigger]");
if (declencheur) declencheur.innerHTML = ic("pages");
mountPagesNav();

let f: Filtres = lireFiltres(location.search);
const grille = document.getElementById("sp-grille")!;
const compte = document.getElementById("sp-compte")!;
const q = document.getElementById("sp-q") as HTMLInputElement;
const groupes = document.getElementById("sp-groupes")!;
q.value = f.q;

const categories = [...new Set(EFFETS.map((x) => x.categorie))];
const rendus = FAMILLES_RENDU.filter((r) => EFFETS.some((x) => familleDe(x.rendu) === r));
const puces = (nom: string, libelle: string, options: { v: string; l: string; n?: number }[], actuel: string) =>
  `<fieldset class="sp-groupe"><legend>${e(libelle)}</legend><div class="sp-puces">${options
    .map((o) => `<label class="sp-puce"><input type="radio" name="${nom}" value="${e(o.v)}"${o.v === actuel ? " checked" : ""} /><span>${e(o.l)}${o.n !== undefined ? ` <span class="sp-n">${o.n}</span>` : ""}</span></label>`)
    .join("")}</div></fieldset>`;

function dessinerFiltres() {
  groupes.innerHTML =
    puces("categorie", "Catégorie", [{ v: "", l: "Toutes" }, ...categories.map((c) => ({ v: c, l: NOMS[c], n: EFFETS.filter((x) => x.categorie === c).length }))], f.categorie) +
    puces("rendu", "Rendu", [{ v: "", l: "Tous" }, ...rendus.map((r) => ({ v: r, l: r === "canvas 2D" ? "Canvas 2D" : r, n: EFFETS.filter((x) => familleDe(x.rendu) === r).length }))], f.rendu) +
    puces("statut", "Statut", [{ v: "", l: "Tous" }, { v: "stable", l: "Stable" }, { v: "essai", l: "Essai" }].filter((o) => !o.v || EFFETS.some((x) => x.statut === o.v)), f.statut) +
    `<label class="sp-studio"><input type="checkbox" role="switch" class="ins-bascule" id="sp-studio"${f.studio ? " checked" : ""} /><span>Réglable dans le Studio <span class="sp-n">${EFFETS.filter((x) => x.parametres).length}</span></span></label>`;
}

function carte(m: Manifeste): string {
  const r = puceRendu(m, true);
  const c = puceCout(m);
  const studio = m.parametres ? `<a class="sp-action sp-action-studio" href="studio-effet.html?effet=${m.id}">${ic("studio", 18)}<span>Ouvrir dans le Studio</span></a>` : "";
  const exemple = m.exemple ? `<a class="sp-action" href="${e(m.exemple)}" aria-label="Page d'exemple de ${e(m.nom)} : ${e(m.exemple)}" title="Page d'exemple : ${e(m.exemple)}">${ic("page", 18)}<span>${e(m.exemple.replace(/\.html$/, ""))}</span></a>` : "";
  return `<li class="sp-carte" data-effet="${m.id}" data-rendu="${e(familleDe(m.rendu))}">
  <article aria-labelledby="sp-t-${m.id}">
    <div class="sp-image">${vignette(m.id, m.categorie)}</div>
    <div class="sp-texte">
      <h2 id="sp-t-${m.id}">${e(m.nom)}</h2>
      <p>${e(m.resume)}</p>
      <ul class="sp-etiquettes" aria-label="Caractéristiques">
        <li class="st-puce">${e(NOMS[m.categorie])}</li>
        <li class="st-puce ${r.classe}" title="${e(r.titre)}" data-puce-rendu data-rendu="${e(m.rendu)}">${ic(familleDe(m.rendu) === "DOM" || m.rendu === "canvas 2D" ? "dom" : "gpu", 14)}<span>${e(r.texte)}</span></li>
        <li class="st-puce ${c.classe}" title="${e(c.titre)}" data-puce-cout>${ic("poids", 14)}<span>${e(c.texte)}</span></li>
        ${m.statut === "essai" ? '<li class="st-puce">Essai</li>' : ""}
        <li class="sp-attr"><code>${e(m.attributs[0]!)}</code></li>
      </ul>
    </div>
    <div class="sp-actions">${studio}${exemple}</div>
  </article>
</li>`;
}

function dessiner() {
  const res = filtrer(EFFETS, f);
  grille.innerHTML = res.length ? res.map(carte).join("") : `<li class="sp-vide">Aucun effet ne répond à ces filtres. <button type="button" class="sp-lien" id="sp-tout">Tout montrer</button></li>`;
  compte.textContent = `${res.length} effet${res.length > 1 ? "s" : ""} sur ${EFFETS.length}`;
  history.replaceState(null, "", `${location.pathname}${ecrireFiltres(f)}`);
  void majPucesRendu(grille);
}

groupes.addEventListener("change", (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === "sp-studio") f = { ...f, studio: t.checked };
  else if (t.name === "categorie") f = { ...f, categorie: t.value as Filtres["categorie"] };
  else if (t.name === "rendu") f = { ...f, rendu: t.value as Filtres["rendu"] };
  else if (t.name === "statut") f = { ...f, statut: t.value as Filtres["statut"] };
  dessiner();
});
q.addEventListener("input", () => {
  f = { ...f, q: q.value };
  dessiner();
});
grille.addEventListener("click", (ev) => {
  if ((ev.target as Element).closest("#sp-tout")) {
    f = { q: "", categorie: "", rendu: "", statut: "", studio: false };
    q.value = "";
    dessinerFiltres();
    dessiner();
    q.focus();
  }
});
// « / » amène à la recherche, comme sur bien des catalogues.
addEventListener("keydown", (ev) => {
  const t = ev.target as HTMLElement;
  if (ev.key === "/" && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) {
    ev.preventDefault();
    q.focus();
  }
});

dessinerFiltres();
dessiner();
