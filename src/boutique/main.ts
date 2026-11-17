/**
 * Éclaircie — boutique d'essai (boutique.html).
 *
 * Construite avec les modules Presse : dechirure (bords de papier, coupe
 * couleur / noir et blanc, ici sur des photos détourées), derriere (le nom
 * qui passe derrière la silhouette), graffiti (le mot pulvérisé à la bombe
 * du manifeste), forme (la campagne vue à travers une goutte qui
 * grandit), autocollant (l'éclair « clic » qui suit le pointeur), rail
 * (nouveautés au glisser, ruban sans fin des catégories) et panier (état,
 * localStorage, événements).
 *
 * Paramètres d'essai : ?intro (rejouer l'intro), ?sans-intro, ?sans-photos
 * (tous les cadres d'attente, sans demander une seule photo).
 */
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/rubik-wet-paint/latin-400.css";
import "./style.css";
import { mountPagesNav } from "../pages-nav.ts";
import { initDechirure } from "../presse/dechirure.ts";
import { initDerriere } from "../presse/derriere.ts";
import { initGraffiti } from "../presse/graffiti.ts";
import { initForme } from "../presse/forme.ts";
import { initAutocollant } from "../presse/autocollant.ts";
import { initRail } from "../presse/rail.ts";
import { cleLigne, estFavori, formaterCentimes, formaterPrix, initPanier, nombreArticles, QTE_MAX, totalCentimes, type EtatPanier, type Raison } from "../presse/panier.ts";
import { CATALOGUE, CATEGORIES, PHOTOS, chercher, nombreDans, nomCategorie, pieceParId, type IdCategorie, type Photo, type Piece } from "./catalogue.ts";
import { surveillerPhoto } from "./silhouettes.ts";

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const param = (n: string) => new RegExp(`[?&]${n}(=|&|$)`).test(location.search);
const SANS_PHOTOS = param("sans-photos");
const SEUIL_LIVRAISON = 120;

/* ---------------------------------------------------------------- photos */

const cheminPhoto = (p: Photo, l: number) => `boutique/${p.fichier}${l === p.grand ? "" : `-${l}`}.jpg`;
/** Les photos détourées (WebP à fond transparent) : `nom-d-<petit>.webp` et `nom-d.webp`. */
const cheminDetoure = (p: Photo, l: number) => `boutique/${p.fichier}-d${l === p.grand ? "" : `-${l}`}.webp`;

/** Une silhouette détourée, chargée seulement là où elle sert (paresseuse, dimensions données). */
function imageDetouree(p: Photo, alt: string, sizes: string): HTMLImageElement {
  const img = new Image();
  img.alt = alt;
  img.width = p.grand;
  img.height = Math.round((p.grand * p.ratio[1]) / p.ratio[0]);
  img.loading = "lazy";
  img.decoding = "async";
  img.draggable = false;
  if (!SANS_PHOTOS) {
    img.srcset = `${cheminDetoure(p, p.petit)} ${p.petit}w, ${cheminDetoure(p, p.grand)} ${p.grand}w`;
    img.sizes = sizes;
    img.src = cheminDetoure(p, p.petit);
  }
  surveillerPhoto(img, p, { forcer: SANS_PHOTOS });
  return img;
}

function imagePhoto(p: Photo, alt: string, sizes: string, cadrage?: string): HTMLImageElement {
  const img = new Image();
  img.alt = alt;
  img.width = p.grand;
  img.height = Math.round((p.grand * p.ratio[1]) / p.ratio[0]);
  img.loading = "lazy";
  img.decoding = "async";
  img.draggable = false;
  if (cadrage) img.style.objectPosition = cadrage;
  if (!SANS_PHOTOS) {
    if (p.petit < p.grand) {
      img.srcset = `${cheminPhoto(p, p.petit)} ${p.petit}w, ${cheminPhoto(p, p.grand)} ${p.grand}w`;
      img.sizes = sizes;
    }
    img.src = cheminPhoto(p, p.petit);
  }
  surveillerPhoto(img, p, { forcer: SANS_PHOTOS });
  return img;
}

// Les images écrites dans le HTML : data-photo="clé de PHOTOS".
for (const img of $$<HTMLImageElement>("img[data-photo]")) {
  const p = (PHOTOS as Record<string, Photo>)[img.dataset.photo ?? ""];
  if (p) surveillerPhoto(img, p, { forcer: SANS_PHOTOS, sombre: img.hasAttribute("data-forme-media") || img.hasAttribute("data-parallaxe") });
}

/* ---------------------------------------------------------------- cartes */

const COEUR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.6-4.7-9.4-9.6C1.3 7.3 3.6 4 7 4c2.1 0 3.9 1.2 5 3 1.1-1.8 2.9-3 5-3 3.4 0 5.7 3.3 4.4 6.9-1.8 4.9-9.4 9.6-9.4 9.6Z"/></svg>`;
const plageTailles = (p: Piece) => (p.tailles.length > 1 ? `${p.tailles[0]}–${p.tailles[p.tailles.length - 1]}` : "TU");
const CLASSE_ETIQUETTE: Record<NonNullable<Piece["etiquette"]>, string> = { "Best-seller": "", Nouveau: "nouveau", "Dernières pièces": "dernieres" };

function carte(p: Piece, sizes: string): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "carte";
  li.dataset.id = p.id;
  li.dataset.categorie = p.categorie;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "carte-ouvrir";
  b.dataset.ouvrirPiece = p.id;
  b.setAttribute("data-autocollant-cible", "");
  b.setAttribute("aria-haspopup", "dialog");
  const ph = document.createElement("span");
  ph.className = "carte-photo";
  ph.append(imagePhoto(p.photo, "", sizes, p.cadrage));
  const infos = document.createElement("span");
  infos.className = "carte-infos";
  infos.innerHTML = `<span class="carte-nom"></span><span class="carte-tailles" aria-hidden="true"></span><span class="carte-prix"></span>`;
  $(".carte-nom", infos).textContent = p.nom;
  $(".carte-tailles", infos).textContent = plageTailles(p);
  $(".carte-prix", infos).textContent = formaterPrix(p.prix);
  b.append(ph, infos);
  li.append(b);
  if (p.etiquette) {
    const e = document.createElement("span");
    e.className = `etiquette ${CLASSE_ETIQUETTE[p.etiquette]}`.trim();
    e.textContent = p.etiquette;
    e.dataset.dechirure = "droite";
    e.dataset.dechirureAmplitude = "7";
    e.dataset.dechirureFibre = "1.6";
    e.dataset.dechirureGraine = `${p.id}-etiquette`;
    li.append(e);
  }
  const f = document.createElement("button");
  f.type = "button";
  f.className = "carte-fav";
  f.dataset.favori = p.id;
  f.setAttribute("aria-label", `Favori : ${p.nom}`);
  f.setAttribute("aria-pressed", "false");
  f.innerHTML = COEUR;
  li.append(f);
  return li;
}

// Nouveautés (rail), bijoux, et la grille complète.
const NOUVEAUTES = ["haut-glycine", "mariniere-grenadine", "haut-brique", "pantalon-nuit", "echarpe-cassis", "haut-griotte", "pantalon-ciel"];
const pisteNouv = $("#piste-nouv");
for (const id of NOUVEAUTES) {
  const p = pieceParId(id);
  if (p) pisteNouv.append(carte(p, "(max-width: 900px) 66vw, 21vw"));
}
$("#nouv-total").textContent = String(NOUVEAUTES.length).padStart(2, "0");
for (const p of CATALOGUE.filter((x) => x.categorie === "bijoux")) $("#liste-bijoux").append(carte(p, "(max-width: 800px) 50vw, 28vw"));
const grille = $("#grille");
CATALOGUE.forEach((p, i) => {
  const c = carte(p, "(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 25vw");
  c.style.setProperty("--i", String(i));
  grille.append(c);
});

// Ruban des catégories : des silhouettes détourées sur le papier, le nom vertical passe derrière (décor),
// et un vrai libellé horizontal, lisible, qui nomme le bouton.
const pisteCat = $("#piste-cat");
for (const c of CATEGORIES) {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "tuile";
  b.dataset.filtre = c.id;
  const nom = document.createElement("span");
  nom.className = "tuile-nom titre";
  nom.textContent = c.court;
  nom.setAttribute("aria-hidden", "true");
  const ph = document.createElement("span");
  ph.className = "tuile-photo";
  ph.append(imageDetouree(c.photo, "", "(max-width: 700px) 74vw, 26vw"));
  const libelle = document.createElement("span");
  libelle.className = "tuile-libelle";
  libelle.innerHTML = `<span class="tuile-libelle-nom"></span> <span class="tuile-libelle-n"></span><span class="tuile-fleche" aria-hidden="true">→</span>`;
  $(".tuile-libelle-nom", libelle).textContent = c.nom;
  $(".tuile-libelle-n", libelle).textContent = `· ${nombreDans(c.id)} pièces`;
  b.append(nom, ph, libelle);
  li.append(b);
  pisteCat.append(li);
}
// Les copies du ruban sans fin sont inertes (rail.ts) : sans ce relais, un clic sur une tuile copiée,
// pourtant visible, ne ferait rien. Un clic (pas un glisser) sur une copie vaut un clic sur l'originale.
{
  const ruban = pisteCat.closest<HTMLElement>(".ruban")!;
  let appui = { x: 0, y: 0 };
  ruban.addEventListener("pointerdown", (e) => (appui = { x: e.clientX, y: e.clientY }), { passive: true });
  ruban.addEventListener("click", (e) => {
    if ((e.target as Element).closest(".tuile") || Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > 6) return;
    const copie = $$<HTMLElement>("[data-rail-copie] .tuile", pisteCat).find((t) => {
      const r = t.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });
    const originale = copie && $$<HTMLElement>(".tuile", pisteCat).find((t) => !t.closest("[data-rail-copie]") && t.dataset.filtre === copie.dataset.filtre);
    originale?.click();
  });
}
$("#cat-compte").textContent = `${CATEGORIES.length} familles · ${CATALOGUE.length} pièces`;
for (const el of $$("[data-compte]")) el.textContent = `[${nombreDans(el.dataset.compte as IdCategorie)}]`;

// Filtres.
const filtres = $("#filtres");
for (const c of [{ id: "tout" as const, nom: "Tout", n: CATALOGUE.length }, ...CATEGORIES.map((c) => ({ id: c.id, nom: c.nom, n: nombreDans(c.id) }))]) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "filtre";
  b.dataset.choix = c.id;
  b.setAttribute("aria-pressed", String(c.id === "tout"));
  b.innerHTML = `<span></span><sup aria-hidden="true">${c.n}</sup>`;
  $("span", b).textContent = c.nom;
  filtres.append(b);
}

/* ---------------------------------------------------------------- panier */

const magasin = initPanier(document, undefined, { cle: "eclaircie:panier", idsConnus: CATALOGUE.map((p) => p.id) });

/* ---------------------------------------------------------------- modules */

mountPagesNav();
initDechirure();
initDerriere();
const graffitis = initGraffiti();
const rails = initRail();
const formes = initForme();
initAutocollant();

// L'index du rail des nouveautés.
const railNouv = $("#rail-nouv");
railNouv.addEventListener("rail:change", (e) => {
  $("#nouv-index").textContent = String((e as CustomEvent<{ index: number }>).detail.index + 1).padStart(2, "0");
});

/* ---------------------------------------------------------------- annonce */

const annonce = $("#annonce");
let tempoAnnonce = 0;
function annoncer(t: string) {
  annonce.textContent = t;
  annonce.classList.add("visible");
  clearTimeout(tempoAnnonce);
  tempoAnnonce = window.setTimeout(() => {
    annonce.classList.remove("visible");
    tempoAnnonce = window.setTimeout(() => (annonce.textContent = ""), 400);
  }, 2600);
}

/* ---------------------------------------------------------------- fenêtres */

const fenetresOuvertes: HTMLDialogElement[] = [];
function ouvrir(d: HTMLDialogElement) {
  if (d.open) return;
  d.showModal();
  fenetresOuvertes.push(d);
  if (reduit()) d.classList.add("ouvert");
  else requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add("ouvert")));
}
function fermer(d: HTMLDialogElement, ensuite?: () => void) {
  if (!d.open) return ensuite?.();
  d.classList.remove("ouvert");
  const fin = () => {
    if (d.open) d.close();
    ensuite?.();
  };
  if (reduit()) return fin();
  let fait = false;
  const une = () => {
    if (fait) return;
    fait = true;
    fin();
  };
  d.addEventListener("transitionend", (e) => e.target === d && une(), { once: true });
  setTimeout(une, 560);
}
for (const d of $$<HTMLDialogElement>("dialog")) {
  d.addEventListener("cancel", (e) => {
    e.preventDefault(); // Échap : fermer avec l'animation
    fermer(d);
  });
  d.addEventListener("close", () => {
    d.classList.remove("ouvert");
    const i = fenetresOuvertes.indexOf(d);
    if (i >= 0) fenetresOuvertes.splice(i, 1);
  });
  // Un clic sur le fond (hors de la boîte) ferme.
  d.addEventListener("click", (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) fermer(d);
  });
  for (const b of $$("[data-fermer]", d)) b.addEventListener("click", () => fermer(d));
}
for (const a of $$("[data-fermer-lien]")) a.addEventListener("click", () => fermer(a.closest("dialog")!));

/* ---------------------------------------------------------------- fiche produit */

const fiche = $<HTMLDialogElement>("#fiche");
const ficheForm = $<HTMLFormElement>("#fiche-form");
const ficheTailles = $("#fiche-tailles");
const ficheErreur = $("#fiche-erreur");
const ficheOk = $("#fiche-ok");
const ficheFav = $<HTMLButtonElement>("#fiche-favori");
let pieceCourante: Piece | null = null;

function peindreFavFiche() {
  if (!pieceCourante) return;
  const oui = estFavori(magasin.etat(), pieceCourante.id);
  ficheFav.innerHTML = oui ? "♥ En favori" : "♡ Favori";
  ficheFav.setAttribute("aria-pressed", String(oui));
}

function ouvrirFiche(id: string) {
  const p = pieceParId(id);
  if (!p) return;
  pieceCourante = p;
  const ph = $("#fiche-photo");
  ph.replaceChildren(imagePhoto(p.photo, `${p.nom}, porté`, "(max-width: 760px) 100vw, 560px", p.cadrage && p.categorie === "bijoux" ? p.cadrage : undefined));
  const img = $("img", ph) as HTMLImageElement;
  img.loading = "eager";
  $("#fiche-cat").textContent = nomCategorie(p.categorie);
  $("#fiche-nom").textContent = p.nom;
  $("#fiche-prix").textContent = formaterPrix(p.prix);
  $("#fiche-desc").textContent = p.description;
  $("#fiche-matiere").textContent = `${p.matiere} · ${p.tailles.length > 1 ? "coupe ample, prenez votre taille habituelle" : "taille unique"}`;
  const nomCouleur = $("#fiche-couleur-nom");
  const pastilles = $(".pastilles", fiche);
  pastilles.replaceChildren();
  p.couleurs.forEach((c, i) => {
    const l = document.createElement("label");
    l.className = "pastille";
    l.innerHTML = `<input type="radio" name="couleur"><span aria-hidden="true"></span><span class="visuellement-cache"></span>`;
    const input = $<HTMLInputElement>("input", l);
    input.value = c.nom;
    input.checked = i === 0;
    ($("span[aria-hidden]", l) as HTMLElement).style.setProperty("--c", c.hex);
    $(".visuellement-cache", l).textContent = c.nom;
    input.addEventListener("change", () => (nomCouleur.textContent = c.nom));
    pastilles.append(l);
  });
  nomCouleur.textContent = p.couleurs[0]?.nom ?? "";
  const tailles = $(".tailles", fiche);
  tailles.replaceChildren();
  for (const t of p.tailles) {
    const l = document.createElement("label");
    l.className = "taille";
    l.innerHTML = `<input type="radio" name="taille" required><span></span>`;
    const input = $<HTMLInputElement>("input", l);
    input.value = t;
    input.checked = p.tailles.length === 1;
    $("span", l).textContent = t;
    input.addEventListener("change", () => {
      ficheTailles.classList.remove("invalide", "secoue");
      ficheTailles.removeAttribute("aria-invalid");
      ficheErreur.textContent = "";
    });
    tailles.append(l);
  }
  ficheTailles.classList.remove("invalide", "secoue");
  ficheTailles.removeAttribute("aria-invalid");
  ficheErreur.textContent = "";
  ficheOk.replaceChildren();
  ficheFav.dataset.favori = p.id;
  peindreFavFiche();
  ouvrir(fiche);
  // Le focus va au titre : on lit d'abord ce qu'on regarde.
  const h = $("#fiche-nom");
  h.tabIndex = -1;
  h.focus({ preventScroll: true });
  ficheForm.scrollTop = 0;
}

ficheForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!pieceCourante) return;
  const fd = new FormData(ficheForm);
  const taille = String(fd.get("taille") ?? "");
  const couleur = String(fd.get("couleur") ?? "");
  if (!taille) {
    ficheErreur.textContent = "Choisissez une taille avant d'ajouter au panier.";
    ficheTailles.setAttribute("aria-invalid", "true");
    ficheTailles.classList.remove("secoue");
    void ficheTailles.offsetWidth; // relancer la secousse
    ficheTailles.classList.add("invalide", "secoue");
    $<HTMLInputElement>("input", ficheTailles).focus();
    return;
  }
  magasin.ajouter({ id: pieceCourante.id, taille, couleur });
  ficheOk.replaceChildren();
  const t = document.createElement("span");
  t.textContent = `Ajouté : ${pieceCourante.nom}, ${taille}${couleur ? `, ${couleur}` : ""}.`;
  const voir = document.createElement("button");
  voir.type = "button";
  voir.textContent = "Voir le panier →";
  voir.addEventListener("click", () => fermer(fiche, () => ouvrirPanier()));
  ficheOk.append(t, voir);
});

/* ---------------------------------------------------------------- panier et favoris */

const panier = $<HTMLDialogElement>("#panier");
const favoris = $<HTMLDialogElement>("#favoris");
const recap = $<HTMLDialogElement>("#recap");

function petitePhoto(p: Piece) {
  const d = document.createElement("div");
  d.className = "ligne-photo";
  d.append(imagePhoto(p.photo, "", "72px", p.cadrage));
  return d;
}

function peindrePanier(e: EtatPanier) {
  const ul = $("#panier-lignes");
  // Garder le focus sur le même contrôle à travers le nouveau rendu.
  const actif = document.activeElement as HTMLElement | null;
  const garde = actif && ul.contains(actif) ? { cle: actif.dataset.cle, action: actif.dataset.action } : null;
  const ordre = e.lignes.map(cleLigne);
  const indexAvant = garde?.cle ? [...ul.children].findIndex((li) => (li as HTMLElement).dataset.cle === garde.cle) : -1;
  ul.replaceChildren();
  for (const l of e.lignes) {
    const p = pieceParId(l.id);
    if (!p) continue;
    const cle = cleLigne(l);
    const li = document.createElement("li");
    li.className = "ligne";
    li.dataset.cle = cle;
    li.append(petitePhoto(p));
    const nom = document.createElement("p");
    nom.className = "ligne-nom";
    nom.textContent = p.nom;
    const det = document.createElement("p");
    det.className = "ligne-detail";
    det.textContent = [l.taille, l.couleur].filter(Boolean).join(" · ");
    const prix = document.createElement("p");
    prix.className = "ligne-prix";
    prix.textContent = formaterCentimes(Math.round(p.prix * 100) * l.qte);
    const act = document.createElement("div");
    act.className = "ligne-actions";
    const qte = document.createElement("div");
    qte.className = "qte";
    qte.setAttribute("role", "group");
    qte.setAttribute("aria-label", `Quantité de ${p.nom}, ${l.taille}`);
    const moins = document.createElement("button");
    moins.type = "button";
    moins.textContent = "−";
    moins.setAttribute("aria-label", `Retirer un ${p.nom}`);
    moins.dataset.cle = cle;
    moins.dataset.action = "moins";
    const out = document.createElement("output");
    out.textContent = String(l.qte);
    out.setAttribute("aria-live", "polite");
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `Ajouter un ${p.nom}`);
    plus.disabled = l.qte >= QTE_MAX;
    plus.dataset.cle = cle;
    plus.dataset.action = "plus";
    moins.addEventListener("click", () => magasin.changerQuantite(cle, l.qte - 1));
    plus.addEventListener("click", () => magasin.changerQuantite(cle, l.qte + 1));
    qte.append(moins, out, plus);
    const ret = document.createElement("button");
    ret.type = "button";
    ret.className = "ligne-retirer";
    ret.textContent = "Retirer";
    ret.setAttribute("aria-label", `Retirer ${p.nom} (${l.taille}) du panier`);
    ret.dataset.cle = cle;
    ret.dataset.action = "retirer";
    ret.addEventListener("click", () => magasin.retirer(cle));
    act.append(qte, ret);
    li.append(nom, prix, det, act);
    ul.append(li);
  }
  if (garde?.cle) {
    const meme = ul.querySelector<HTMLElement>(`[data-cle="${CSS.escape(garde.cle)}"][data-action="${garde.action}"]`);
    if (meme && !(meme as HTMLButtonElement).disabled) meme.focus();
    else if (meme) ul.querySelector<HTMLElement>(`[data-cle="${CSS.escape(garde.cle)}"][data-action="moins"]`)?.focus();
    else {
      // La ligne est partie : la suivante, sinon la précédente, sinon le bouton de fermeture.
      const voisine = ordre[Math.min(indexAvant, ordre.length - 1)];
      const cible = voisine ? ul.querySelector<HTMLElement>(`[data-cle="${CSS.escape(voisine)}"][data-action="retirer"]`) : null;
      (cible ?? $("[data-fermer]", panier)).focus();
    }
  }
  const n = nombreArticles(e);
  const total = totalCentimes(e, (id) => pieceParId(id)?.prix);
  $("#panier-n").textContent = `(${n})`;
  $("#panier-total").textContent = formaterCentimes(total);
  const manque = SEUIL_LIVRAISON * 100 - total;
  $("#panier-livraison").textContent = manque > 0 ? `Livraison offerte dès ${formaterPrix(SEUIL_LIVRAISON)} : encore ${formaterCentimes(manque)}.` : "Livraison offerte (enfin, elle le serait).";
  $("#panier-vide").hidden = n > 0;
  $("#panier-pied").hidden = n === 0;
  ul.hidden = n === 0;
}

function peindreFavoris(e: EtatPanier) {
  const ul = $("#favoris-lignes");
  ul.replaceChildren();
  for (const id of e.favoris) {
    const p = pieceParId(id);
    if (!p) continue;
    const li = document.createElement("li");
    li.className = "ligne";
    li.append(petitePhoto(p));
    li.insertAdjacentHTML("beforeend", `<p class="ligne-nom"></p><p class="ligne-prix"></p><p class="ligne-detail"></p><div class="ligne-actions"><button type="button" class="ligne-ouvrir"></button><button type="button" class="ligne-retirer">Retirer</button></div>`);
    $(".ligne-nom", li).textContent = p.nom;
    $(".ligne-prix", li).textContent = formaterPrix(p.prix);
    $(".ligne-detail", li).textContent = nomCategorie(p.categorie);
    const voir = $<HTMLButtonElement>(".ligne-ouvrir", li);
    voir.textContent = "Choisir une taille →";
    voir.setAttribute("aria-label", `Ouvrir ${p.nom}`);
    voir.addEventListener("click", () => fermer(favoris, () => ouvrirFiche(p.id)));
    const ret = $<HTMLButtonElement>(".ligne-retirer", li);
    ret.setAttribute("aria-label", `Retirer ${p.nom} des favoris`);
    ret.addEventListener("click", () => {
      magasin.basculerFavori(p.id);
      (ul.querySelector<HTMLElement>(".ligne-retirer") ?? $("[data-fermer]", favoris)).focus();
    });
    ul.append(li);
  }
  $("#favoris-n").textContent = `(${e.favoris.length})`;
  $("#favoris-vide").hidden = e.favoris.length > 0;
  ul.hidden = e.favoris.length === 0;
}

function ouvrirPanier() {
  peindrePanier(magasin.etat());
  ouvrir(panier);
}

magasin.ecouter((e: EtatPanier, r: Raison) => {
  peindrePanier(e);
  peindreFavoris(e);
  peindreFavFiche();
  if (r === "ajout" && !reduit()) {
    for (const c of $$("[data-panier-nombre]")) {
      c.classList.remove("bond");
      void c.offsetWidth;
      c.classList.add("bond");
    }
  }
});
peindrePanier(magasin.etat());
peindreFavoris(magasin.etat());

// Annonces des favoris (les compteurs, eux, sont muets).
document.addEventListener("click", (ev) => {
  const b = (ev.target as Element).closest<HTMLElement>(".carte-fav");
  if (!b) return;
  const p = pieceParId(b.dataset.favori ?? "");
  if (p) annoncer(estFavori(magasin.etat(), p.id) ? `${p.nom} : ajouté aux favoris` : `${p.nom} : retiré des favoris`);
});

for (const b of $$("[data-ouvrir]")) {
  b.addEventListener("click", () => {
    if (b.dataset.ouvrir === "panier") ouvrirPanier();
    else {
      peindreFavoris(magasin.etat());
      ouvrir(favoris);
    }
  });
}

$("#commander").addEventListener("click", () => {
  const e = magasin.etat();
  const ul = $("#recap-lignes");
  ul.replaceChildren();
  for (const l of e.lignes) {
    const p = pieceParId(l.id);
    if (!p) continue;
    const li = document.createElement("li");
    const a = document.createElement("span");
    a.textContent = `${l.qte} × ${p.nom} · ${[l.taille, l.couleur].filter(Boolean).join(" · ")}`;
    const b = document.createElement("span");
    b.textContent = formaterCentimes(Math.round(p.prix * 100) * l.qte);
    li.append(a, b);
    ul.append(li);
  }
  $("#recap-total").textContent = formaterCentimes(totalCentimes(e, (id) => pieceParId(id)?.prix));
  ouvrir(recap);
});
$("#recap-fin").addEventListener("click", () => {
  magasin.vider();
  fermer(recap, () => fermer(panier, () => annoncer("Démo terminée : le panier est vide.")));
});

// Ouvrir une pièce depuis une carte.
document.addEventListener("click", (ev) => {
  const b = (ev.target as Element).closest<HTMLElement>("[data-ouvrir-piece]");
  if (b) ouvrirFiche(b.dataset.ouvrirPiece!);
});

/* ---------------------------------------------------------------- filtre et recherche */

const recherche = $<HTMLInputElement>("#recherche");
let categorie: IdCategorie | "tout" = "tout";

function appliquerFiltre(animer = true) {
  const trouvees = new Set(chercher(CATALOGUE, recherche.value, categorie).map((p) => p.id));
  let i = 0;
  for (const c of $$<HTMLLIElement>(".carte", grille)) {
    const ok = trouvees.has(c.dataset.id!);
    c.hidden = !ok;
    c.classList.remove("apparait");
    if (ok) c.style.setProperty("--i", String(i++));
  }
  if (animer && !reduit()) {
    void grille.offsetWidth;
    for (const c of $$<HTMLLIElement>(".carte:not([hidden])", grille)) c.classList.add("apparait");
  }
  for (const b of $$("[data-choix]", filtres)) b.setAttribute("aria-pressed", String(b.dataset.choix === categorie));
  const n = trouvees.size;
  const nomCat = categorie === "tout" ? "Tout" : CATEGORIES.find((c) => c.id === categorie)!.court;
  $(".boutique-titre").firstChild!.textContent = nomCat;
  $("#boutique-accroche").textContent = `(${n})`;
  const q = recherche.value.trim();
  $("#resultat").textContent = `${n} pièce${n > 1 ? "s" : ""}${categorie !== "tout" ? ` · ${nomCategorie(categorie)}` : ""}${q ? ` · « ${q} »` : ""}`;
  $("#vide").hidden = n > 0;
  $("#vide-texte").textContent = q ? `Aucune pièce pour « ${q} »${categorie !== "tout" ? ` dans ${nomCategorie(categorie)}` : ""}.` : "Aucune pièce ne correspond.";
}

filtres.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLElement>("[data-choix]");
  if (!b) return;
  categorie = b.dataset.choix as IdCategorie | "tout";
  appliquerFiltre();
});
let tempoRecherche = 0;
recherche.addEventListener("input", () => {
  clearTimeout(tempoRecherche);
  tempoRecherche = window.setTimeout(() => appliquerFiltre(), 120);
});
$("#vide-raz").addEventListener("click", () => {
  categorie = "tout";
  recherche.value = "";
  appliquerFiltre();
  recherche.focus();
});

// Tout élément [data-filtre] (tuiles, vignettes, liens) : filtre puis va à la boutique.
document.addEventListener("click", (e) => {
  const el = (e.target as Element).closest<HTMLElement>("[data-filtre]");
  if (!el) return;
  categorie = el.dataset.filtre as IdCategorie;
  recherche.value = "";
  appliquerFiltre();
  if (el.tagName !== "A") $("#boutique").scrollIntoView({ behavior: reduit() ? "auto" : "smooth" });
  annoncer(`Filtre : ${nomCategorie(categorie)}`);
});

$("[data-ouvrir-recherche]").addEventListener("click", () => {
  $("#boutique").scrollIntoView({ behavior: reduit() ? "auto" : "smooth" });
  recherche.focus({ preventScroll: true });
});
appliquerFiltre(false);

/* ---------------------------------------------------------------- lettre */

const lettre = $<HTMLFormElement>("#lettre");
const courriel = $<HTMLInputElement>("#courriel");
lettre.addEventListener("submit", (e) => {
  e.preventDefault();
  const etat = $("#lettre-etat");
  if (!courriel.value.trim() || !courriel.checkValidity()) {
    courriel.setAttribute("aria-invalid", "true");
    etat.textContent = "Cette adresse ne semble pas valide.";
    courriel.focus();
    return;
  }
  courriel.removeAttribute("aria-invalid");
  etat.textContent = "Merci ! (Démonstration : l'adresse n'est envoyée nulle part.)";
  lettre.reset();
});

/* ---------------------------------------------------------------- titres qui reprennent leur largeur */

const etires = $$("[data-etire]");
const accueil = $(".accueil");
const dansAccueil = (el: Element) => accueil.contains(el);

if (!reduit()) {
  const io = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        e.target.classList.remove("etire-attente");
        e.target.classList.add("etire-joue");
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.15 },
  );
  for (const el of etires) {
    if (dansAccueil(el)) continue;
    el.classList.add("etire-attente");
    io.observe(el);
  }
}

/* ---------------------------------------------------------------- intro */

const intro = $(".intro");
const CLE_INTRO = "eclaircie:intro";
let introVue = false;
try {
  introVue = sessionStorage.getItem(CLE_INTRO) === "1";
} catch {
  /* rien */
}
const jouerIntro = !reduit() && !param("sans-intro") && (param("intro") || !introVue);
if (jouerIntro) {
  try {
    sessionStorage.setItem(CLE_INTRO, "1");
  } catch {
    /* rien */
  }
  const titres = etires.filter(dansAccueil);
  titres.forEach((el, i) => {
    el.style.setProperty("--etire-delai", `${0.5 + i * 0.06}s`);
    el.classList.add("etire-joue");
  });
  intro.hidden = false;
  intro.classList.add("joue");
  document.documentElement.style.overflow = "hidden";
  let fini = false;
  const finir = (saute: boolean) => {
    if (fini) return;
    fini = true;
    intro.hidden = true;
    document.documentElement.style.overflow = "";
    if (saute) for (const el of titres) el.classList.remove("etire-joue");
    removeEventListener("keydown", surTouche, true);
  };
  const surTouche = (e: KeyboardEvent) => {
    if (e.key === "Tab") return; // laisser atteindre le bouton
    finir(true);
  };
  intro.addEventListener("click", () => finir(true));
  addEventListener("keydown", surTouche, true);
  setTimeout(() => finir(false), 1320);
}

/* ---------------------------------------------------------------- parallaxe de la campagne */

for (const img of $$<HTMLImageElement>("img[data-parallaxe]")) {
  const sec = img.closest("section")!;
  let visible = false, raf = 0;
  const pas = () => {
    raf = 0;
    const r = sec.getBoundingClientRect();
    const p = (r.top + r.height / 2 - innerHeight / 2) / (innerHeight / 2 + r.height / 2);
    img.style.transform = `translate3d(0, ${(-Math.max(-1, Math.min(1, p)) * 7).toFixed(3)}%, 0)`;
  };
  const demander = () => {
    if (visible && !raf && !reduit()) raf = requestAnimationFrame(pas);
  };
  new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    demander();
  }).observe(sec);
  addEventListener("scroll", demander, { passive: true });
}

/* ---------------------------------------------------------------- le nom géant du pied, à la largeur exacte */

const marque = $(".pied-marque");
const ajusterMarque = () => {
  marque.style.fontSize = "100px";
  const l = marque.getBoundingClientRect().width;
  const dispo = marque.parentElement!.clientWidth - parseFloat(getComputedStyle(marque.parentElement!).paddingLeft) * 2;
  if (l > 0) marque.style.fontSize = `${Math.floor(((100 * dispo) / l) * 10) / 10}px`;
};
new ResizeObserver(ajusterMarque).observe(marque.parentElement!);
void document.fonts.ready.then(ajusterMarque);

/* ---------------------------------------------------------------- banc d'essai */

Object.assign(window as object, {
  __boutique: { magasin, ouvrirFiche, ouvrirPanier, rails, formes, graffitis, annoncer },
});
