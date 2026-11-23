/**
 * Vitrine — le haut de page : bandeau d'annonce (4 variantes) et en-tête (3 variantes ; collant, transparent sur le
 * hero, mega-menu, recherche à suggestions, compte, favoris, panier, pays et devise ; tiroir de navigation).
 */
import type { Champ } from "../schema.ts";
import type { Contexte, DefinitionSection, Section } from "../types.ts";
import { attrs, cls, e, imgPhoto } from "../html.ts";
import { icone } from "../icones.ts";
import { CATEGORIES_VITRINE, MATIERES, PAYS } from "../donnees.ts";
import { champCollection, inter, lienDe, photoOu, r, texte, image } from "./communs.ts";

/* ═════════════════════════ Bandeau d'annonce ═════════════════════════ */

const CHAMPS_ANNONCE: Champ[] = [
  {
    cle: "messages", type: "liste", libelle: "Messages", icone: "annonce", min: 1, max: 5, titre: "texte",
    element: [texte("texte", "Message", "Livraison offerte dès 120 €", { requis: true, max: 90 }), texte("lien", "Texte du lien", "", { max: 30, icone: "lien" }), champCollection("cible", "Lien vers", "tout")],
    defaut: [
      { texte: "Livraison offerte dès 120 €", lien: "", cible: "tout" },
      { texte: "Retours gratuits sous 30 jours", lien: "", cible: "tout" },
      { texte: "Nouvelle collection automne", lien: "Découvrir", cible: "nouveautes" },
    ],
  },
  { cle: "vitesse", type: "curseur", libelle: "Vitesse du défilé", icone: "mouvement", min: 10, max: 80, pas: 2, defaut: 36, unite: "px/s", si: { variantes: ["defilant"] } },
  { cle: "delai", type: "curseur", libelle: "Changement toutes les", icone: "minuterie", min: 3, max: 12, pas: 1, defaut: 5, unite: "s", si: { variantes: ["rotatif"] } },
  { cle: "remise", type: "curseur", libelle: "Remise offerte", icone: "promo", min: 5, max: 30, pas: 5, defaut: 10, unite: "%", si: { variantes: ["newsletter"] } },
  {
    cle: "couleur", type: "selecteur", libelle: "Couleur", icone: "goutte", defaut: "encre", affichage: "segments",
    options: [
      { valeur: "encre", libelle: "Encre", icone: "bouton-plein" },
      { valeur: "accent", libelle: "Accent", icone: "etoile" },
      { valeur: "surface", libelle: "Surface", icone: "calque" },
    ],
  },
  inter("fermable", "Bouton fermer", false, "fermer"),
];

function messageHtml(m: Record<string, unknown>, ctx: Contexte) {
  const lien = String(m.lien ?? "");
  return `${e(m.texte)}${lien ? ` <a href="${e(lienDe(ctx, m.cible))}">${e(lien)}</a>` : ""}`;
}

function rendreAnnonce(s: Section, ctx: Contexte): string {
  const msgs = r<Record<string, unknown>[]>(s, "messages");
  const fermer = r<boolean>(s, "fermable") ? `<button type="button" class="v-annonce-fermer" data-v-fermer-annonce aria-label="Fermer le bandeau">${icone("fermer", 18)}</button>` : "";
  let corps = "";
  if (s.variante === "fixe") corps = `<p class="v-annonce-texte">${msgs.map((m) => `<span>${messageHtml(m, ctx)}</span>`).join('<span class="v-annonce-sep" aria-hidden="true">·</span>')}</p>`;
  else if (s.variante === "defilant") {
    const suite = msgs.map((m) => `<span class="v-defile-item">${messageHtml(m, ctx)}</span>`).join("");
    // La piste est doublée (copie inerte, aria-hidden) pour boucler sans saut ; le bouton met en pause (WCAG 2.2.2).
    corps = `<div class="v-defile" data-v-defile style="--v-vitesse:${r<number>(s, "vitesse")}"><div class="v-defile-piste"><div class="v-defile-groupe">${suite}</div><div class="v-defile-groupe" aria-hidden="true" inert>${suite}</div></div></div><button type="button" class="v-annonce-pause" data-v-pause-defile aria-pressed="false" aria-label="Mettre le défilé en pause">${icone("pause", 14)}</button>`;
  } else if (s.variante === "rotatif") {
    corps = `<div class="v-rotatif" data-v-rotatif data-delai="${r<number>(s, "delai")}">
<button type="button" class="v-rotatif-prec" data-v-prec aria-label="Message précédent">${icone("fleche-g", 16)}</button>
<ul class="v-rotatif-liste" aria-live="off">${msgs.map((m, i) => `<li class="v-rotatif-msg"${i ? " hidden" : ""}>${messageHtml(m, ctx)}</li>`).join("")}</ul>
<button type="button" class="v-rotatif-suiv" data-v-suiv aria-label="Message suivant">${icone("fleche-d", 16)}</button></div>`;
  } else {
    const id = `v-nl-${s.id}`;
    corps = `<form class="v-annonce-nl" data-v-newsletter novalidate><p class="v-annonce-texte"><strong>−${r<number>(s, "remise")} %</strong> sur votre première commande<span class="v-large-seul"> en vous inscrivant à la lettre</span>.</p>
<label class="v-cache" for="${id}">Votre adresse électronique</label><input id="${id}" name="courriel" type="email" autocomplete="email" required placeholder="Adresse électronique" class="v-annonce-champ"><button class="v-annonce-ok" type="submit">S'inscrire</button><p class="v-nl-message" role="status"></p></form>`;
  }
  return `<div${attrs({ class: cls("v-s", "v-annonce", `v-annonce--${s.variante}`, `v-annonce--${r(s, "couleur")}`), id: `s-${s.id}`, "data-v-section": s.id, "data-v-type": s.type, role: "region", "aria-label": "Annonces" })}>${corps}${fermer}</div>`;
}

export const ANNONCE: DefinitionSection = {
  type: "annonce",
  nom: "Bandeau d'annonce",
  icone: "annonce",
  description: "Une ligne au-dessus de l'en-tête : livraison, retours, nouveautés, lettre d'information.",
  famille: "haut",
  unique: true,
  place: "haut",
  variantes: [
    { id: "fixe", nom: "Fixe", icone: "texte", description: "Les messages côte à côte, centrés.", croquis: "r 0 0 100 8; t 30 3 40; r 0 8 100 8; T 4 11 14; i 0 16 100 44" },
    { id: "defilant", nom: "Défilant", icone: "mouvement", description: "Un ruban qui défile en continu, avec pause.", croquis: "r 0 0 100 8; t 2 3 25; t 35 3 25; t 68 3 25; r 0 8 100 8; T 4 11 14; i 0 16 100 44" },
    { id: "rotatif", nom: "Rotatif", icone: "fleches", description: "Un message à la fois, flèches et changement automatique.", croquis: "r 0 0 100 8; c 5 4; t 35 3 30; c 95 4; r 0 8 100 8; T 4 11 14; i 0 16 100 44" },
    { id: "newsletter", nom: "Lettre −x %", icone: "mail", description: "Une remise contre une inscription, formulaire en ligne.", croquis: "r 0 0 100 8; t 10 3 40; r 55 1.5 25 5; b 82 1.5 12; r 0 8 100 8; T 4 11 14; i 0 16 100 44" },
  ],
  champs: CHAMPS_ANNONCE,
  rendre: rendreAnnonce,
};

/* ═════════════════════════ En-tête ═════════════════════════ */

const CHAMPS_ENTETE: Champ[] = [
  texte("logo", "Texte du logo", "", { max: 40, aide: "Vide : le nom de la marque." }),
  {
    cle: "menu", type: "liste", libelle: "Menu", icone: "menu", min: 1, max: 7, titre: "libelle",
    element: [texte("libelle", "Libellé", "Nouveautés", { requis: true, max: 24 }), champCollection("collection", "Collection", "nouveautes"), inter("mega", "Mega-menu", true, "collection"), image("image", "Visuel du mega-menu", "campagne")],
    defaut: [
      { libelle: "Nouveautés", collection: "nouveautes", mega: false, image: "campagne" },
      { libelle: "Vêtements", collection: "tout", mega: true, image: "rouille" },
      { libelle: "Accessoires", collection: "categorie:echarpes", mega: true, image: "echarpeCouleur" },
      { libelle: "Bijoux", collection: "categorie:bijoux", mega: false, image: "bijouFleur" },
    ],
  },
  inter("collant", "En-tête collant", true, "haut", { groupe: "Comportement" }),
  inter("transparent", "Transparent sur le hero", false, "calque", { groupe: "Comportement", aide: "Seulement si un hero suit l'en-tête." }),
  inter("mega", "Mega-menus", true, "collection", { groupe: "Comportement" }),
  {
    cle: "ouverture", type: "selecteur", libelle: "Ouverture des menus", icone: "survol", defaut: "survol", affichage: "segments", groupe: "Comportement",
    options: [
      { valeur: "survol", libelle: "Au survol", icone: "survol" },
      { valeur: "clic", libelle: "Au clic", icone: "point" },
    ],
  },
  inter("recherche", "Recherche", true, "loupe", { groupe: "Actions" }),
  inter("compte", "Compte", true, "compte", { groupe: "Actions" }),
  inter("favoris", "Favoris", true, "coeur", { groupe: "Actions" }),
  inter("pays", "Pays et devise", true, "globe", { groupe: "Actions" }),
  {
    cle: "libelles", type: "selecteur", libelle: "Actions en", icone: "texte", defaut: "icones", affichage: "segments", groupe: "Actions",
    options: [
      { valeur: "icones", libelle: "Icônes", icone: "sac" },
      { valeur: "texte", libelle: "Texte", icone: "texte" },
    ],
  },
  {
    cle: "couleur", type: "selecteur", libelle: "Fond", icone: "goutte", defaut: "papier", affichage: "segments",
    options: [
      { valeur: "papier", libelle: "Fond de page", icone: "bouton-contour" },
      { valeur: "surface", libelle: "Surface", icone: "calque" },
      { valeur: "sombre", libelle: "Sombre", icone: "bouton-plein" },
    ],
  },
];

/** Vrai si la première section visible après l'en-tête (bandeau d'annonce mis à part) est un hero. */
export function heroSousEntete(ctx: Contexte, idEntete: string): boolean {
  const v = ctx.plan.sections.filter((x) => !x.masque);
  const i = v.findIndex((x) => x.id === idEntete);
  const suivante = v.slice(i + 1).find((x) => x.type !== "annonce" && x.type !== "popup");
  return !!suivante && suivante.type === "hero";
}

function colonnesMega(ctx: Contexte) {
  const col = (titre: string, liens: [string, string][]) => `<div class="v-mega-col"><p class="v-mega-titre">${e(titre)}</p><ul>${liens.map(([t, h]) => `<li><a href="${e(h)}">${e(t)}</a></li>`).join("")}</ul></div>`;
  return (
    col("Catégories", CATEGORIES_VITRINE.map((c) => [c.nom, ctx.lienCollection(c.collection)])) +
    col("Matières", MATIERES.map((m) => [m.nom, ctx.lienCollection(`matiere:${m.id}`)])) +
    col("Sélections", [
      ["Nouveautés", ctx.lienCollection("nouveautes")],
      ["Meilleures ventes", ctx.lienCollection("meilleures-ventes")],
      ["Promotions", ctx.lienCollection("promotions")],
      ["Cartes cadeaux", "#cartes-cadeaux"],
    ])
  );
}

function selectPays(id: string, classe = "v-pays") {
  return `<div class="${classe}"><label for="${id}" class="v-cache">Pays et devise</label>${icone("globe", 18)}<select id="${id}" data-v-pays>${PAYS.map((p) => `<option value="${p.id}">${e(p.nom)} (${p.devise}${p.devise === "EUR" ? " €" : ""})</option>`).join("")}</select></div>`;
}

function rendreEntete(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const logo = (g.logo as string) || ctx.marque;
  const menu = g.menu as Record<string, unknown>[];
  const avecMega = g.mega as boolean;
  const texteSeul = g.libelles === "texte";
  const sousHero = (g.transparent as boolean) && heroSousEntete(ctx, s.id);
  const idT = `v-tiroir-${s.id}`;
  const idR = `v-recherche-${s.id}`;
  const action = (nom: string, ic: string, extra: string) => `${texteSeul ? `<span class="v-action-texte">${e(nom)}</span>` : icone(ic, 22)}${extra}`;

  const items = menu
    .map((m, i) => {
      const lib = e(m.libelle);
      const href = e(lienDe(ctx, m.collection));
      if (!(avecMega && m.mega)) return `<li class="v-nav-item"><a class="v-nav-lien" href="${href}">${lib}</a></li>`;
      const idM = `v-mega-${s.id}-${i}`;
      const visuel = `<a class="v-mega-visuel" href="${href}">${imgPhoto(photoOu(m.image), ctx, { sizes: "260px", classe: "v-mega-img", alt: "" })}<span class="v-mega-legende">${lib} <span aria-hidden="true">→</span></span></a>`;
      return `<li class="v-nav-item v-nav-item--mega" data-v-mega-item><button type="button" class="v-nav-lien" aria-expanded="false" aria-controls="${idM}">${lib}${icone("chevron-bas", 14, "v-ic v-nav-chevron")}</button>
<div class="v-mega" id="${idM}" data-v-mega><div class="v-mega-int">${colonnesMega(ctx)}${visuel}<a class="v-mega-tout" href="${href}">Toute la sélection ${lib.toLowerCase()} <span aria-hidden="true">→</span></a></div></div></li>`;
    })
    .join("");

  const nav = `<nav class="v-nav" aria-label="Navigation principale"><ul class="v-nav-liste">${items}</ul></nav>`;
  const burger = `<button type="button" class="v-burger" data-v-ouvrir-tiroir aria-controls="${idT}" aria-haspopup="dialog" aria-expanded="false" aria-label="Ouvrir le menu">${icone("menu", 22)}${s.variante === "menu" ? '<span class="v-burger-texte">Menu</span>' : ""}</button>`;
  const btnRecherche = g.recherche ? `<button type="button" class="v-action" data-v-ouvrir-recherche aria-controls="${idR}" aria-expanded="false" aria-label="Rechercher">${action("Recherche", "loupe", "")}</button>` : "";
  const actions = `<div class="v-actions">
${s.variante !== "menu" ? btnRecherche : ""}
${g.pays ? selectPays(`v-pays-${s.id}`, "v-pays v-large-seul") : ""}
${g.compte ? `<a class="v-action v-large-seul" href="#compte" aria-label="Mon compte">${action("Compte", "compte", "")}</a>` : ""}
${g.favoris ? `<a class="v-action" href="#favoris" data-v-ouvrir-favoris aria-label="Favoris">${action("Favoris", "coeur", ' <span class="v-compteur" data-favoris-nombre>0</span>')}</a>` : ""}
<button type="button" class="v-action" data-v-ouvrir-panier aria-haspopup="dialog">${action("Panier", "sac", ' <span class="v-compteur" data-panier-nombre>0</span>')}<span class="v-cache"> : articles dans le panier</span></button>
</div>`;
  const logoHtml = `<a class="v-logo" href="#haut">${e(logo)}</a>`;

  let barre: string;
  if (s.variante === "centre") barre = `<div class="v-entete-barre">${burger}<div class="v-entete-gauche" aria-hidden="true"></div>${logoHtml}${actions}</div><div class="v-entete-nav">${nav}</div>`;
  else if (s.variante === "menu") barre = `<div class="v-entete-barre"><div class="v-entete-gauche">${burger}${btnRecherche}</div>${logoHtml}${actions}</div>`;
  else barre = `<div class="v-entete-barre">${burger}${logoHtml}${nav}${actions}</div>`;

  // Le tiroir : la navigation sur téléphone, et le menu « Menu » de la variante du même nom (à tous les écrans).
  const tiroirItems = menu
    .map((m) => {
      const href = e(lienDe(ctx, m.collection));
      if (!m.mega) return `<li><a class="v-tiroir-lien" href="${href}">${e(m.libelle)}</a></li>`;
      return `<li><details class="v-tiroir-groupe"><summary class="v-tiroir-lien">${e(m.libelle)}${icone("chevron-bas", 16)}</summary><ul>${CATEGORIES_VITRINE.map((c) => `<li><a href="${e(ctx.lienCollection(c.collection))}">${e(c.nom)}</a></li>`).join("")}<li><a href="${href}"><strong>Tout voir</strong></a></li></ul></details></li>`;
    })
    .join("");
  const tiroir = `<dialog class="v-tiroir${s.variante === "menu" ? " v-tiroir--large" : ""}" id="${idT}" aria-label="Menu" data-v-tiroir>
<div class="v-tiroir-tete"><span class="v-logo v-logo--petit">${e(logo)}</span><button type="button" class="v-action" data-v-fermer aria-label="Fermer le menu">${icone("fermer", 22)}</button></div>
<nav aria-label="Navigation du menu"><ul class="v-tiroir-liste">${tiroirItems}</ul></nav>
<ul class="v-tiroir-secondaire"><li><a href="#compte">${icone("compte", 18)} Mon compte</a></li><li><a href="#favoris" data-v-ouvrir-favoris>${icone("coeur", 18)} Favoris</a></li><li><a href="#service">${icone("bulle", 18)} Service client</a></li></ul>
${g.pays ? selectPays(`v-pays-t-${s.id}`, "v-pays v-pays--tiroir") : ""}
${s.variante === "menu" ? `<a class="v-tiroir-visuel" href="${e(lienDe(ctx, menu[0]?.collection))}">${imgPhoto(photoOu(menu[0]?.image), ctx, { sizes: "360px", alt: "" })}<span>${e(menu[0]?.libelle ?? "")}</span></a>` : ""}
</dialog>`;

  const recherche = g.recherche
    ? `<div class="v-recherche" id="${idR}" data-v-recherche hidden role="dialog" aria-label="Recherche">
<form class="v-recherche-form" role="search" action="#recherche"><label for="${idR}-q" class="v-cache">Rechercher un produit</label>${icone("loupe", 22)}
<input id="${idR}-q" class="v-recherche-champ" type="search" name="q" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="${idR}-l" placeholder="Rechercher : lin, marinière, argent…">
<button type="button" class="v-action" data-v-fermer aria-label="Fermer la recherche">${icone("fermer", 22)}</button></form>
<div class="v-recherche-res"><ul class="v-recherche-liste" id="${idR}-l" role="listbox" aria-label="Suggestions et produits"></ul></div>
<p class="v-cache" role="status" data-v-recherche-etat></p></div>`
    : "";

  return `<header${attrs({
    class: cls("v-s", "v-entete", `v-entete--${s.variante}`, `v-entete--${g.couleur}`, (g.collant as boolean) && "v-entete--collant", sousHero && "v-entete--sur-hero"),
    id: `s-${s.id}`,
    "data-v-section": s.id,
    "data-v-type": s.type,
    "data-v-entete": "",
    "data-ouverture": g.ouverture as string,
  })}>${barre}${recherche}${tiroir}</header>`;
}

export const ENTETE: DefinitionSection = {
  type: "entete",
  nom: "En-tête",
  icone: "entete",
  description: "Logo, navigation et mega-menus, recherche, compte, favoris, panier, pays.",
  famille: "haut",
  unique: true,
  place: "haut",
  variantes: [
    { id: "classique", nom: "Classique", icone: "aligne-g", description: "Logo à gauche, menu au centre, actions à droite.", croquis: "r 0 0 100 12; T 3 4 14; t 30 5 8; t 41 5 8; t 52 5 8; c 85 6; c 91 6; c 97 6; i 0 12 100 48" },
    { id: "centre", nom: "Logo centré", icone: "aligne-c", description: "Le logo au centre, le menu dessous.", croquis: "r 0 0 100 18; T 40 3 20; c 91 5; c 97 5; t 28 13 8; t 40 13 8; t 52 13 8; t 64 13 8; i 0 18 100 42" },
    { id: "menu", nom: "Bouton « Menu »", icone: "menu", description: "Logo central, bouton Menu et recherche à gauche : tout le menu dans un grand tiroir.", croquis: "r 0 0 100 12; t 3 5 10; c 18 6; T 40 4 20; c 85 6; c 91 6; c 97 6; i 0 12 100 48" },
  ],
  champs: CHAMPS_ENTETE,
  rendre: rendreEntete,
};

