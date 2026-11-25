/**
 * Vitrine — l'éditeur (vitrine.html), façon éditeur de thème de boutique :
 *   à gauche   la liste des sections (choisir, réordonner au clavier et au pointeur, masquer, dupliquer, supprimer),
 *              l'ajout depuis la bibliothèque (vignettes de chaque variante) ;
 *   au centre  l'aperçu en direct (iframe vitrine-apercu.html), bureau / tablette / téléphone, mis à l'échelle ;
 *   à droite   l'inspecteur, généré depuis le schéma de la section ; l'onglet Style pour les jetons (et un tirage de
 *              Variations) ;
 *   en haut    quatre préréglages, annuler / rétablir, export (HTML autonome, JSON, lien), import, sauvegarde locale.
 */
import "@fontsource-variable/archivo/wdth.css";
import "./editeur.css";
import { mountPagesNav } from "../pages-nav.ts";
import { creerPopup, creerReordonner, creerFocusItinerant } from "../presse/comportements/index.ts";
import { definition, definitions } from "./bibliotheque.ts";
import { ajouterSection, basculerMasque, changerReglage, changerVariante, creerSection, decoder, deplacerSection, documentDe, dupliquerSection, migrer, resumeSection, retirerSection } from "./modele.ts";
import { PREREGLAGES, prereglage } from "./prereglages.ts";
import { CHAMPS_JETONS, lireJetons, systemeDe, tirerJetons, type Jetons } from "./jetons.ts";
import { rendreInspecteur } from "./inspecteur.ts";
import { croquisSvg } from "./croquis.ts";
import { icone } from "./icones.ts";
import { e } from "./html.ts";
import { monterCoque } from "../studio/coque.ts";
import { SCHEMA_VITRINE } from "../studio/coque-plan.ts";
import { CLES } from "../registre/stockage.ts";
import { copier, htmlAutonome, jsonDocument, lienPartage, telecharger } from "./export.ts";
import { NOMS_FAMILLES, type DocumentVitrine, type Famille, type Plan, type Section } from "./types.ts";
import type { Champ, Valeur } from "./schema.ts";

mountPagesNav();

const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
const CLE_SAUVEGARDE = "vitrine:editeur";
const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ═════════════════════════ État et historique ═════════════════════════ */

function documentInitial(): DocumentVitrine {
  const m = /[#&]v=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (m) {
    try {
      return decoder(m[1]!);
    } catch (err) {
      console.warn("[vitrine] lien illisible :", (err as Error).message);
    }
  }
  try {
    const s = localStorage.getItem(CLE_SAUVEGARDE);
    if (s) return migrer(s).document;
  } catch {
    /* stockage refusé ou document abîmé : on repart d'un préréglage */
  }
  const p = prereglage(new URLSearchParams(location.search).get("prereglage") ?? "") ?? PREREGLAGES[0]!;
  return documentDe(p.plan, p.jetons, p.id);
}

let doc = documentInitial();
let selection: string | null = doc.plan.sections.find((s) => s.type === "hero")?.id ?? doc.plan.sections[0]?.id ?? null;
/*
 * La coque commune (src/studio/coque.ts) : sections | aperçu | inspecteur, deux poignées, l'onglet de l'inspecteur,
 * gardés en JSON versionné ; sous le seuil étroit, des onglets Sections / Aperçu / Réglages, une vue à la fois. Le
 * document (sections, jetons, historique) reste celui de Vitrine.
 */
const coque = monterCoque($(".ve-corps"), {
  schema: SCHEMA_VITRINE,
  cle: CLES.coqueVitrine,
  poignees: [
    { decoupe: "corps", index: 0, panneau: "sections", libelle: "Largeur de la liste des sections", zone: "apercu", cible: $(".ve-gauche") },
    { decoupe: "corps", index: 1, panneau: "inspecteur", libelle: "Largeur de l'inspecteur", zone: "ins", cible: $("#ve-inspecteur") },
  ],
  vues: { sections: $(".ve-gauche"), apercu: $("#ve-centre"), inspecteur: $("#ve-inspecteur") },
  libelleVues: "Panneaux de l'éditeur",
});
// Le lien d'évitement mène à l'inspecteur, même quand le mode étroit montre une autre vue.
$(".ve-evitement").addEventListener("click", () => coque.mode() === "etroit" && coque.choisirVue("inspecteur"));
let onglet: "section" | "style" = coque.onglet("inspecteur") === "style" ? "style" : "section";
const pile: DocumentVitrine[] = [doc];
let rang = 0;
let derniereFusion = { cle: "", t: 0 };

type Quoi = { section: string } | "plan" | "jetons" | "tout";

/** Applique un nouveau document : historique (fusionné pour les petits pas), aperçu, interface, sauvegarde. */
function appliquer(suivant: DocumentVitrine, quoi: Quoi, o: { fusion?: string; inspecteur?: boolean } = {}) {
  const maintenant = performance.now();
  if (o.fusion && o.fusion === derniereFusion.cle && maintenant - derniereFusion.t < 1200 && rang === pile.length - 1 && rang > 0) pile[rang] = suivant;
  else {
    pile.splice(rang + 1);
    pile.push(suivant);
    if (pile.length > 200) pile.shift();
    rang = pile.length - 1;
  }
  derniereFusion = { cle: o.fusion ?? "", t: maintenant };
  doc = suivant;
  synchroniser(quoi);
  peindreListe();
  if (o.inspecteur !== false) peindreInspecteur();
  peindreOutils();
  sauver();
}

function voyager(pas: number) {
  const k = rang + pas;
  if (k < 0 || k >= pile.length) return;
  rang = k;
  doc = pile[k]!;
  derniereFusion = { cle: "", t: 0 };
  if (selection && !doc.plan.sections.some((s) => s.id === selection)) selection = doc.plan.sections[0]?.id ?? null;
  synchroniser("tout");
  peindreListe();
  peindreInspecteur();
  peindreOutils();
  sauver();
  dire(pas < 0 ? "Annulé." : "Rétabli.");
}

let tSauve = 0;
function sauver() {
  clearTimeout(tSauve);
  $("#ve-sauve").dataset.etat = "attente";
  tSauve = window.setTimeout(() => {
    try {
      localStorage.setItem(CLE_SAUVEGARDE, jsonDocument(doc));
      $("#ve-sauve").dataset.etat = "ok";
    } catch {
      $("#ve-sauve").dataset.etat = "refuse";
    }
  }, 400);
}

const avecPlan = (plan: Plan): DocumentVitrine => ({ ...doc, plan });
const avecJetons = (jetons: Jetons): DocumentVitrine => ({ ...doc, jetons });
const sectionDe = (id: string | null) => doc.plan.sections.find((s) => s.id === id) ?? null;

/* ═════════════════════════ Annonces ═════════════════════════ */

const statut = $("#ve-statut");
function dire(m: string) {
  statut.textContent = "";
  setTimeout(() => (statut.textContent = m), 30);
}
let tBulle = 0;
function bulle(m: string) {
  const b = $("#ve-bulle");
  b.textContent = m;
  b.hidden = false;
  clearTimeout(tBulle);
  tBulle = window.setTimeout(() => (b.hidden = true), 2600);
  dire(m);
}

/* ═════════════════════════ Aperçu ═════════════════════════ */

const iframe = $<HTMLIFrameElement>("#ve-iframe");
type Api = { charger(d: DocumentVitrine): void; majSection(s: Section, p: Plan): void; majPlan(p: Plan): void; majJetons(j: Jetons): void; selectionner(id: string, defiler?: boolean): void };
let api: Api | null = null;
function synchroniser(quoi: Quoi) {
  if (!api) return;
  if (quoi === "tout") api.charger(doc);
  else if (quoi === "jetons") api.majJetons(doc.jetons);
  else if (quoi === "plan") api.majPlan(doc.plan);
  else {
    const s = sectionDe(quoi.section);
    // L'en-tête et le hero se regardent (transparence) : on redessine tout s'ils changent.
    if (!s || s.masque || s.type === "entete" || s.type === "hero") api.majPlan(doc.plan);
    else api.majSection(s, doc.plan);
  }
  if (selection) api.selectionner(selection, false);
}
addEventListener("message", (ev) => {
  if (ev.origin !== location.origin) return;
  const d = ev.data as { type?: string; id?: string };
  if (d.type === "vitrine:pret") {
    api = (iframe.contentWindow as unknown as { vitrineApercu: Api }).vitrineApercu;
    api.charger(doc);
    if (selection) api.selectionner(selection, false);
  } else if (d.type === "vitrine:selection" && d.id && d.id !== selection) {
    selection = d.id;
    onglet = "section";
    peindreListe();
    peindreInspecteur();
  }
});

// Appareils : la largeur vraie (1440, 834, 390), mise à l'échelle dans la colonne.
const LARGEURS = { bureau: 1440, tablette: 834, mobile: 390 } as const;
let appareil: keyof typeof LARGEURS = "bureau";
const cadre = $("#ve-cadre");
const centre = $("#ve-centre");
function cadrer() {
  // Aperçu caché (mode étroit, autre onglet) : rien à mesurer ; le ResizeObserver rappelle à son retour.
  if (!centre.clientWidth) return;
  const l = LARGEURS[appareil];
  const dispo = centre.clientWidth - 32;
  const haut = centre.clientHeight - 32;
  const k = Math.min(1, dispo / l);
  iframe.style.width = `${l}px`;
  iframe.style.height = `${Math.round(haut / k)}px`;
  iframe.style.transform = `scale(${k})`;
  cadre.style.width = `${Math.round(l * k)}px`;
  cadre.style.height = `${haut}px`;
  cadre.dataset.appareil = appareil;
  $("#ve-echelle").textContent = `${l} px · ${Math.round(k * 100)} %`;
}
new ResizeObserver(cadrer).observe(centre);

/* ═════════════════════════ Barre d'outils ═════════════════════════ */

function peindrePrereglages() {
  const g = $("#ve-prereglages");
  g.innerHTML = PREREGLAGES.map((p) => `<button type="button" role="radio" aria-checked="${doc.depuis === p.id}" data-prereglage="${p.id}" title="${e(p.description)}"><span class="ve-pastille" style="--a:${p.jetons.papier};--b:${p.jetons.accent};--c:${p.jetons.encre}" aria-hidden="true"></span>${e(p.nom)}</button>`).join("");
}
$("#ve-prereglages").addEventListener("click", (ev) => {
  const b = (ev.target as Element).closest<HTMLElement>("[data-prereglage]");
  if (!b) return;
  const p = prereglage(b.dataset.prereglage!)!;
  selection = p.plan.sections.find((s) => s.type === "hero")?.id ?? p.plan.sections[0]!.id;
  appliquer(documentDe(structuredClone(p.plan), { ...p.jetons }, p.id), "tout");
  peindrePrereglages();
  bulle(`Préréglage « ${p.nom} » chargé (annulable).`);
});
creerFocusItinerant($("#ve-prereglages"), { elements: "[role=radio]", orientation: "horizontal" });

function peindreOutils() {
  $<HTMLButtonElement>("#ve-annuler").disabled = rang === 0;
  $<HTMLButtonElement>("#ve-retablir").disabled = rang >= pile.length - 1;
  for (const b of document.querySelectorAll<HTMLElement>("#ve-prereglages [role=radio]")) b.setAttribute("aria-checked", String(b.dataset.prereglage === doc.depuis));
}
$("#ve-annuler").addEventListener("click", () => voyager(-1));
$("#ve-retablir").addEventListener("click", () => voyager(1));
addEventListener("keydown", (ev) => {
  const t = ev.target as HTMLElement;
  if (t.matches("input[type=text], input[type=search], textarea, [contenteditable]")) return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
    ev.preventDefault();
    voyager(ev.shiftKey ? 1 : -1);
  } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") {
    ev.preventDefault();
    voyager(1);
  }
});

const appareils = $("#ve-appareils");
appareils.addEventListener("click", (ev) => {
  const b = (ev.target as Element).closest<HTMLElement>("[data-appareil]");
  if (!b) return;
  appareil = b.dataset.appareil as keyof typeof LARGEURS;
  for (const x of appareils.querySelectorAll("[role=radio]")) x.setAttribute("aria-checked", String(x === b));
  cadrer();
  dire(`Aperçu : ${b.getAttribute("aria-label")}.`);
});
creerFocusItinerant(appareils, { elements: "[role=radio]", orientation: "horizontal" });

// Export, import, lien.
const menuExport = $("#ve-menu-export");
const popExport = creerPopup(menuExport, { role: "menu", cote: "bas", alignement: "fin", focusInitial: ["[role=menuitem]"] });
creerFocusItinerant(menuExport, { elements: "[role=menuitem]", orientation: "vertical" });
$("#ve-exporter").addEventListener("click", (ev) => popExport.basculer(ev.currentTarget as HTMLElement));
menuExport.addEventListener("click", async (ev) => {
  const b = (ev.target as Element).closest<HTMLElement>("[data-export]");
  if (!b) return;
  popExport.fermer("programme");
  const nom = doc.plan.marque.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vitrine";
  switch (b.dataset.export) {
    case "copier-html":
      bulle((await copier(await htmlAutonome(doc, { polices: iframe.contentDocument ?? document }))) ? "HTML autonome copié." : "Copie refusée par le navigateur : utilisez Télécharger.");
      break;
    case "html":
      telecharger(`${nom}.html`, await htmlAutonome(doc, { polices: iframe.contentDocument ?? document }), "text/html");
      bulle(`${nom}.html téléchargé.`);
      break;
    case "json":
      telecharger(`${nom}.vitrine.json`, jsonDocument(doc), "application/json");
      bulle(`${nom}.vitrine.json téléchargé.`);
      break;
    case "lien": {
      const l = lienPartage(doc);
      history.replaceState(null, "", l);
      bulle((await copier(l)) ? "Lien copié : il contient toute la page." : "Lien posé dans la barre d'adresse.");
      break;
    }
  }
});
const fichier = $<HTMLInputElement>("#ve-fichier");
$("#ve-importer").addEventListener("click", () => fichier.click());
fichier.addEventListener("change", async () => {
  const f = fichier.files?.[0];
  fichier.value = "";
  if (!f) return;
  try {
    const { document: d, rapport } = migrer(await f.text());
    selection = d.plan.sections[0]?.id ?? null;
    appliquer(d, "tout");
    const n = rapport.corrections.length + rapport.ecartees.length;
    bulle(`« ${f.name} » importé${rapport.depuisVersion === 1 ? " (converti depuis la v1)" : ""}${n ? `, ${n} correction${n > 1 ? "s" : ""}` : ""}.`);
    if (n) console.info("[vitrine] import :", rapport);
  } catch (err) {
    bulle(`Import impossible : ${(err as Error).message}`);
  }
});

/* ═════════════════════════ Liste des sections ═════════════════════════ */

const liste = $("#ve-liste");
const HAUT = new Set(["annonce", "entete"]);
const BAS = new Set(["pied", "popup"]);
function peindreListe() {
  const focus = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("#ve-liste [data-cle]");
  const cleFocus = focus?.dataset.cle;
  const actionFocus = (document.activeElement as HTMLElement | null)?.dataset.action;
  liste.innerHTML = doc.plan.sections
    .map((s) => {
      const r = resumeSection(s);
      const fixe = HAUT.has(s.type) || BAS.has(s.type);
      const unique = definition(s.type)?.unique;
      return `<li data-cle="${e(s.id)}" class="ve-item${s.masque ? " ve-item--masque" : ""}${fixe ? " ve-item--fixe" : ""}" tabindex="-1" aria-current="${s.id === selection}" aria-label="${e(`${r.nom}, ${r.variante}${s.masque ? ", masquée" : ""}`)}"${fixe ? ' data-fixe=""' : ""}>
<span class="ve-poignee" aria-hidden="true">${fixe ? icone("cadenas", 14) : icone("poignee", 16)}</span>
<button type="button" class="ve-item-choisir" data-action="choisir" aria-pressed="${s.id === selection}">${icone(r.icone, 18)}<span class="ve-item-textes"><span class="ve-item-nom">${e(r.nom)}</span><span class="ve-item-variante">${e(r.variante)}</span></span></button>
<span class="ve-item-actions"><button type="button" class="ve-ico" data-action="masquer" aria-pressed="${!!s.masque}" aria-label="${e(`${s.masque ? "Afficher" : "Masquer"} : ${r.nom}`)}" title="${s.masque ? "Afficher" : "Masquer"}">${icone(s.masque ? "oeil-barre" : "oeil", 16)}</button>${unique ? "" : `<button type="button" class="ve-ico" data-action="dupliquer" aria-label="${e(`Dupliquer : ${r.nom}`)}" title="Dupliquer">${icone("dupliquer", 16)}</button>`}<button type="button" class="ve-ico" data-action="supprimer" aria-label="${e(`Supprimer : ${r.nom}`)}" title="Supprimer">${icone("corbeille", 16)}</button></span></li>`;
    })
    .join("");
  // Un seul arrêt de tabulation : l'élément choisi (les flèches passent aux autres).
  const cible = liste.querySelector<HTMLElement>(`[data-cle="${CSS.escape(cleFocus ?? selection ?? "")}"]`) ?? liste.querySelector<HTMLElement>("[data-cle]");
  cible?.setAttribute("tabindex", "0");
  if (cleFocus) {
    const li = liste.querySelector<HTMLElement>(`[data-cle="${CSS.escape(cleFocus)}"]`);
    (li?.querySelector<HTMLElement>(`[data-action="${actionFocus}"]`) ?? li)?.focus();
  }
  $("#ve-nombre").textContent = `${doc.plan.sections.length} sections`;
}

function choisir(id: string, defiler = true) {
  selection = id;
  onglet = "section";
  peindreListe();
  peindreInspecteur();
  api?.selectionner(id, defiler);
}

liste.addEventListener("click", (ev) => {
  const b = (ev.target as Element).closest<HTMLElement>("[data-action]");
  const li = (ev.target as Element).closest<HTMLElement>("[data-cle]");
  if (!li) return;
  const id = li.dataset.cle!;
  const s = sectionDe(id)!;
  const nom = resumeSection(s).nom;
  switch (b?.dataset.action ?? "choisir") {
    case "choisir":
      choisir(id);
      break;
    case "masquer":
      appliquer(avecPlan(basculerMasque(doc.plan, id)), "plan");
      dire(`${nom} ${s.masque ? "affichée" : "masquée"}.`);
      break;
    case "dupliquer": {
      const p = dupliquerSection(doc.plan, id);
      const copie = p.sections[p.sections.findIndex((x) => x.id === id) + 1]!;
      selection = copie.id;
      appliquer(avecPlan(p), "plan");
      liste.querySelector<HTMLElement>(`[data-cle="${CSS.escape(copie.id)}"] [data-action="choisir"]`)?.focus();
      dire(`${nom} dupliquée.`);
      break;
    }
    case "supprimer": {
      const i = doc.plan.sections.findIndex((x) => x.id === id);
      const p = retirerSection(doc.plan, id);
      if (selection === id) selection = p.sections[Math.min(i, p.sections.length - 1)]?.id ?? null;
      appliquer(avecPlan(p), "plan");
      liste.querySelector<HTMLElement>(`[data-cle="${CSS.escape(selection ?? "")}"]`)?.focus();
      bulle(`${nom} supprimée — Ctrl+Z pour annuler.`);
      break;
    }
  }
});
// Flèches haut / bas entre les sections (Alt + flèches : réordonner).
liste.addEventListener("keydown", (ev) => {
  const li = (ev.target as Element).closest<HTMLElement>("[data-cle]");
  if (!li || ev.altKey || ev.ctrlKey || ev.metaKey || ev.defaultPrevented) return;
  const items = [...liste.querySelectorAll<HTMLElement>("[data-cle]")];
  const i = items.indexOf(li);
  const aller = (k: number) => {
    const c = items[Math.max(0, Math.min(items.length - 1, k))]!;
    items.forEach((x) => x.setAttribute("tabindex", x === c ? "0" : "-1"));
    c.focus();
  };
  if (ev.target === li && ev.key === "ArrowDown") (ev.preventDefault(), aller(i + 1));
  else if (ev.target === li && ev.key === "ArrowUp") (ev.preventDefault(), aller(i - 1));
  else if (ev.target === li && ev.key === "Enter") (ev.preventDefault(), choisir(li.dataset.cle!));
});
creerReordonner(liste, {
  elements: "[data-cle]",
  cle: (el) => el.dataset.cle!,
  nom: (el) => el.querySelector(".ve-item-nom")?.textContent ?? "section",
  ignorer: "button.ve-ico, input, select",
  desactive: (el) => el.hasAttribute("data-fixe"),
  surOrdre(de, vers) {
    const p = deplacerSection(doc.plan, de, vers);
    // L'en-tête reste en haut, le pied en bas.
    const types = p.sections.map((s) => (HAUT.has(s.type) ? 0 : BAS.has(s.type) ? 2 : 1));
    if (types.some((t, k) => k > 0 && t < types[k - 1]!)) {
      bulle("Une section de contenu reste entre l'en-tête et le pied de page.");
      return false;
    }
    appliquer(avecPlan(p), "plan");
  },
});

/* ═════════════════════════ Bibliothèque ═════════════════════════ */

const biblio = $<HTMLDialogElement>("#ve-bibliotheque");
const popBiblio = creerPopup(biblio, { modal: true, sansPosition: true, focusInitial: ["#ve-biblio-filtre"] });
function peindreBibliotheque(filtre = "") {
  const q = filtre.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  const familles = new Map<Famille, string[]>();
  for (const d of definitions()) {
    const texte = `${d.nom} ${d.description} ${d.variantes.map((v) => `${v.nom} ${v.description}`).join(" ")}`.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    if (q && !texte.includes(q)) continue;
    const deja = d.unique && doc.plan.sections.some((s) => s.type === d.type);
    const html = `<section class="ve-type" aria-labelledby="ve-b-${d.type}"><div class="ve-type-tete">${icone(d.icone, 20)}<div><h3 id="ve-b-${d.type}">${e(d.nom)}</h3><p>${e(d.description)}</p></div>${deja ? '<span class="ve-deja">Déjà sur la page</span>' : ""}</div><ul class="ve-variantes">${d.variantes.map((v) => `<li><button type="button" class="ve-variante" data-ajouter="${d.type}" data-variante="${v.id}"${deja ? " disabled" : ""} aria-describedby="ve-b-${d.type}-${v.id}">${croquisSvg(v.croquis)}<span class="ve-variante-nom">${e(v.nom)}</span><span class="ve-variante-desc" id="ve-b-${d.type}-${v.id}">${e(v.description)}</span></button></li>`).join("")}</ul></section>`;
    if (!familles.has(d.famille)) familles.set(d.famille, []);
    familles.get(d.famille)!.push(html);
  }
  $("#ve-biblio-liste").innerHTML = familles.size ? [...familles].map(([f, xs]) => `<h2 class="ve-famille">${e(NOMS_FAMILLES[f])}</h2>${xs.join("")}`).join("") : `<p class="ve-vide">Aucune section pour « ${e(filtre)} ».</p>`;
}
$("#ve-ajouter").addEventListener("click", (ev) => {
  peindreBibliotheque();
  $<HTMLInputElement>("#ve-biblio-filtre").value = "";
  popBiblio.ouvrir(ev.currentTarget as HTMLElement);
});
$("#ve-biblio-filtre").addEventListener("input", (ev) => peindreBibliotheque((ev.target as HTMLInputElement).value));
biblio.addEventListener("click", (ev) => {
  const t = ev.target as Element;
  if (t.closest("[data-fermer]")) return popBiblio.fermer("programme");
  const b = t.closest<HTMLElement>("[data-ajouter]");
  if (!b) return;
  const s = creerSection(b.dataset.ajouter!, doc.plan, b.dataset.variante);
  const p = ajouterSection(doc.plan, s, selection ?? undefined);
  selection = s.id;
  popBiblio.fermer("programme");
  appliquer(avecPlan(p), "plan");
  api?.selectionner(s.id, true);
  liste.querySelector<HTMLElement>(`[data-cle="${CSS.escape(s.id)}"]`)?.focus();
  bulle(`${resumeSection(s).nom} · ${resumeSection(s).variante} ajoutée.`);
});

/* ═════════════════════════ Inspecteur ═════════════════════════ */

const insp = $("#ve-inspecteur-corps");
const onglets = $("#ve-onglets");
onglets.addEventListener("click", (ev) => {
  const b = (ev.target as Element).closest<HTMLElement>("[data-onglet]");
  if (!b) return;
  onglet = b.dataset.onglet as typeof onglet;
  coque.choisirOnglet("inspecteur", onglet);
  peindreInspecteur();
});
creerFocusItinerant(onglets, { elements: "[role=tab]", orientation: "horizontal", activation: "auto" });

function peindreInspecteur() {
  for (const b of onglets.querySelectorAll<HTMLElement>("[role=tab]")) {
    const sel = b.dataset.onglet === onglet;
    b.setAttribute("aria-selected", String(sel));
  }
  // Le champ qui a le focus le retrouve après le redessin (ids stables : préfixe + clé).
  const actif = document.activeElement;
  const focusId = actif instanceof HTMLElement && insp.contains(actif) && actif.id ? actif.id : "";
  if (onglet === "style") return peindreStyle(focusId);
  const s = sectionDe(selection);
  if (!s) {
    insp.innerHTML = `<p class="ve-vide">Choisissez une section à gauche, ou dans l'aperçu.</p>`;
    return;
  }
  const d = definition(s.type)!;
  const r = resumeSection(s);
  insp.innerHTML = `<div class="ve-insp-tete">${icone(d.icone, 22)}<div><h2>${e(d.nom)}</h2><p>${e(d.description)}</p></div></div>
<fieldset class="ve-variantes-choix"><legend>Variante</legend><div role="radiogroup" aria-label="Variante" id="ve-variante">${d.variantes.map((v) => `<button type="button" role="radio" aria-checked="${v.id === s.variante}" data-variante="${v.id}" title="${e(v.description)}">${croquisSvg(v.croquis)}<span>${e(v.nom)}</span></button>`).join("")}</div></fieldset>
<div id="ve-champs"></div>`;
  const rv = $("#ve-variante", insp);
  creerFocusItinerant(rv, { elements: "[role=radio]", orientation: "les-deux" });
  rv.addEventListener("click", (ev) => {
    const b = (ev.target as Element).closest<HTMLElement>("[data-variante]");
    if (!b || b.dataset.variante === s.variante) return;
    appliquer(avecPlan(changerVariante(doc.plan, s.id, b.dataset.variante!)), { section: s.id });
    $(`#ve-variante [data-variante="${CSS.escape(b.dataset.variante!)}"]`, insp)?.focus();
    dire(`Variante : ${b.textContent?.trim()}.`);
  });
  rendreInspecteur($("#ve-champs", insp), {
    champs: d.champs,
    valeurs: s.reglages,
    variante: s.variante,
    prefixe: `vi-${s.id}`,
    surChange(cle, valeur, o) {
      appliquer(avecPlan(changerReglage(doc.plan, s.id, cle, valeur)), { section: s.id }, { fusion: o.fusion ? `${s.id}:${o.fusion}` : undefined, inspecteur: !!o.structure });
    },
  });
  void r;
  if (focusId) document.getElementById(focusId)?.focus();
}

/** Le nom de la marque : un champ de texte du schéma, comme les autres. */
const CHAMP_MARQUE: Champ = { type: "texte", cle: "marque", libelle: "Nom de la marque", icone: "titre", defaut: "Boutique", max: 40, groupe: "Marque" };

function peindreStyle(focusId?: string) {
  const { retouches } = systemeDe(doc.jetons);
  insp.innerHTML = `<div class="ve-insp-tete">${icone("pinceau", 22)}<div><h2>Style de la boutique</h2><p>Les jetons : couleurs, typographie, forme, mouvement. Branchés sur les systèmes de Variations.</p></div></div>
<div id="ve-marque-champ"></div>
<div class="ve-tirage"><button type="button" class="ve-btn" id="ve-tirer">${icone("de", 18)} Tirer une direction</button><span>couleurs et polices d'un système Variations au hasard ; densité, boutons et largeur gardés</span></div>
${retouches.length ? `<p class="ve-note">${icone("info", 16)} Contraste : ${e(retouches.join(", "))} ajusté${retouches.length > 1 ? "s" : ""} pour tenir 4,5:1.</p>` : ""}
<div id="ve-jetons"></div>`;
  rendreInspecteur($("#ve-marque-champ", insp), {
    champs: [CHAMP_MARQUE],
    valeurs: { marque: doc.plan.marque },
    prefixe: "ve",
    surChange(_cle, valeur) {
      const v = String(valeur).trim() || "Boutique";
      appliquer(avecPlan({ ...doc.plan, marque: v }), "plan", { fusion: "marque", inspecteur: false });
    },
  });
  $("#ve-tirer", insp).addEventListener("click", () => {
    appliquer(avecJetons(tirerJetons((Math.random() * 2 ** 32) >>> 0, doc.jetons)), "jetons");
    bulle("Nouvelle direction tirée (Ctrl+Z pour revenir).");
  });
  rendreInspecteur($("#ve-jetons", insp), {
    champs: CHAMPS_JETONS,
    valeurs: doc.jetons as unknown as Record<string, Valeur>,
    prefixe: "vj",
    surChange(cle, valeur, o) {
      const j = lireJetons({ ...doc.jetons, [cle]: valeur }).jetons;
      appliquer(avecJetons(j), "jetons", { fusion: o.fusion ? `jetons:${o.fusion}` : undefined, inspecteur: !!o.structure || cle === "papier" || cle === "encre" || cle === "accent" ? !o.fusion : false });
    },
  });
  if (focusId) document.getElementById(focusId)?.focus();
}

/* ═════════════════════════ Départ ═════════════════════════ */

peindrePrereglages();
peindreListe();
peindreInspecteur();
peindreOutils();
cadrer();
if (reduit()) document.documentElement.dataset.reduit = "";
(window as unknown as { editeur: unknown }).editeur = { document: () => doc, historique: () => ({ rang, taille: pile.length }) };
