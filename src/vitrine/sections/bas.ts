/**
 * Vitrine — le bas de page : pied de page (colonnes, plan du site, minimal) et pop-up promotionnelle.
 */
import type { Champ } from "../schema.ts";
import type { Contexte, DefinitionSection, Section } from "../types.ts";
import { attrs, cls, e, imgPhoto } from "../html.ts";
import { icone } from "../icones.ts";
import { CATEGORIES_VITRINE, MATIERES, PAYS } from "../donnees.ts";
import { image, inter, photoOu, texte } from "./communs.ts";

/* ═════════════════════════ Pied de page ═════════════════════════ */

const CHAMPS_PIED: Champ[] = [
  {
    cle: "colonnes", type: "liste", libelle: "Colonnes de liens", icone: "colonnes", min: 1, max: 5, titre: "titre",
    element: [texte("titre", "Titre", "Aide", { max: 30, requis: true }), texte("liens", "Liens (un par ligne)", "Livraison\nRetours", { max: 400, multiligne: true })],
    defaut: [
      { titre: "Aide", liens: "Livraison\nRetours et échanges\nGuide des tailles\nNous contacter" },
      { titre: "La maison", liens: "Notre histoire\nL'atelier\nEngagements\nJournal" },
      { titre: "Services", liens: "Cartes cadeaux\nRetouches\nRendez-vous en boutique\nProgramme de reprise" },
    ],
  },
  inter("newsletter", "Lettre d'information", true, "mail"),
  texte("texteNewsletter", "Texte de la lettre", "Les nouveautés, une fois par mois.", { max: 120, si: { champ: "newsletter" } }),
  inter("reseaux", "Réseaux sociaux", true, "photo"),
  inter("paiements", "Moyens de paiement", true, "cadenas"),
  inter("pays", "Pays et devise", true, "globe"),
  inter("grandLogo", "Grand logo", false, "titre", { si: { variantes: ["colonnes", "plan"] } }),
  texte("mention", "Mention", "© 2026 — boutique fictive de démonstration", { max: 120 }),
  {
    cle: "couleur", type: "selecteur", libelle: "Fond", icone: "goutte", defaut: "sombre", affichage: "segments",
    options: [
      { valeur: "papier", libelle: "Fond de page", icone: "bouton-contour" },
      { valeur: "surface", libelle: "Surface", icone: "calque" },
      { valeur: "sombre", libelle: "Sombre", icone: "bouton-plein" },
    ],
  },
];

const slug = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function rendrePied(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const cols = g.colonnes as Record<string, unknown>[];
  const liste = (titre: string, liens: string[], id: string) => `<nav class="v-pied-col" aria-labelledby="${id}"><h2 class="v-pied-titre" id="${id}">${e(titre)}</h2><ul>${liens.map((l) => `<li><a href="#${slug(l)}">${e(l)}</a></li>`).join("")}</ul></nav>`;
  const colonnes = cols.map((c, i) => liste(String(c.titre), String(c.liens ?? "").split("\n").map((x) => x.trim()).filter(Boolean), `v-pied-${s.id}-${i}`)).join("");
  const idNl = `v-pied-nl-${s.id}`;
  const nl = g.newsletter ? `<form class="v-pied-nl" data-v-newsletter novalidate><h2 class="v-pied-titre" id="${idNl}-t">Lettre d'information</h2><p>${e(g.texteNewsletter)}</p><div class="v-nl-ligne"><label for="${idNl}" class="v-cache">Votre adresse électronique</label><input class="v-champ" id="${idNl}" name="courriel" type="email" autocomplete="email" required placeholder="vous@exemple.fr"><button type="submit" class="v-btn v-btn--inverse" aria-label="S'inscrire">${icone("fleche-longue", 20)}</button></div><p class="v-nl-message" role="status"></p></form>` : "";
  const reseaux = g.reseaux ? `<ul class="v-reseaux" aria-label="Réseaux sociaux">${[["photo", "Photos"], ["video", "Vidéos"], ["epingle", "Tableaux d'inspiration"], ["mail", "Lettre"]].map(([i, n]) => `<li><a class="v-rond v-rond--petit" href="#${slug(n!)}" aria-label="${e(n)}">${icone(i!, 18)}</a></li>`).join("")}</ul>` : "";
  // Aucun logo de marque de paiement : des pastilles de texte.
  const paiements = g.paiements ? `<ul class="v-paiements" aria-label="Moyens de paiement acceptés">${["Carte bancaire", "Virement", "En trois fois", "Carte cadeau"].map((p) => `<li>${e(p)}</li>`).join("")}</ul>` : "";
  const pays = g.pays ? `<div class="v-pays v-pays--pied"><label for="v-pays-p-${s.id}">${icone("globe", 18)} Pays et devise</label><select id="v-pays-p-${s.id}" data-v-pays>${PAYS.map((p) => `<option value="${p.id}">${e(p.nom)} (${p.devise})</option>`).join("")}</select></div>` : "";
  const bas = `<div class="v-pied-bas">${pays}${paiements}<p class="v-pied-mention">${e(g.mention)}</p></div>`;
  const logo = g.grandLogo ? `<p class="v-pied-logo" aria-hidden="true">${e(ctx.marque)}</p>` : "";
  let corps: string;
  if (s.variante === "minimal") corps = `<div class="v-conteneur v-pied-minimal"><span class="v-logo v-logo--petit">${e(ctx.marque)}</span><nav aria-label="Liens utiles"><ul>${cols.flatMap((c) => String(c.liens ?? "").split("\n").slice(0, 2)).map((l) => l.trim()).filter(Boolean).map((l) => `<li><a href="#${slug(l)}">${e(l)}</a></li>`).join("")}</ul></nav>${reseaux}${bas}</div>`;
  else if (s.variante === "plan") {
    const plan = `<div class="v-pied-plan">${liste("Collections", CATEGORIES_VITRINE.map((c) => c.nom), `v-pied-${s.id}-c`)}${liste("Matières", MATIERES.map((m) => m.nom), `v-pied-${s.id}-m`)}${colonnes}</div>`;
    corps = `<div class="v-conteneur">${nl ? `<div class="v-pied-haut">${nl}${reseaux}</div>` : reseaux}${plan}${logo}${bas}</div>`;
  } else corps = `<div class="v-conteneur"><div class="v-pied-grille" style="--v-pied-modele:1.2fr repeat(${cols.length}, minmax(0, 1fr))${nl ? " 1.5fr" : ""}"><div class="v-pied-marque"><p class="v-logo">${e(ctx.marque)}</p>${reseaux}</div>${colonnes}${nl}</div>${logo}${bas}</div>`;
  return `<footer${attrs({ class: cls("v-s", "v-pied", `v-pied--${s.variante}`, `v-fond--${g.couleur}`), id: `s-${s.id}`, "data-v-section": s.id, "data-v-type": s.type })}>${corps}</footer>`;
}

export const PIED: DefinitionSection = {
  type: "pied",
  nom: "Pied de page",
  icone: "pied",
  description: "Liens, lettre, réseaux, paiements, pays et devise.",
  famille: "bas",
  unique: true,
  place: "bas",
  variantes: [
    { id: "colonnes", nom: "Colonnes", icone: "colonnes", description: "La marque, trois colonnes de liens et la lettre.", croquis: "r 0 0 100 60; T 4 8 16; t 26 8 12; t 26 14 14; t 26 19 10; t 46 8 12; t 46 14 14; t 66 8 16; r 66 16 28 6; t 4 50 92" },
    { id: "plan", nom: "Plan du site", icone: "densite", description: "Toutes les collections et matières, la lettre en haut, le grand logo.", croquis: "r 0 0 100 60; r 4 6 40 6; t 4 18 12; t 4 23 14; t 24 18 12; t 24 23 14; t 44 18 12; t 64 18 12; T 4 38 92; t 4 52 92" },
    { id: "minimal", nom: "Minimal", icone: "densite-compacte", description: "Une ou deux lignes : marque, quelques liens, mentions.", croquis: "r 0 34 100 26; T 4 42 14; t 30 43 10; t 42 43 10; t 54 43 10; c 90 44; t 4 52 60" },
  ],
  champs: CHAMPS_PIED,
  rendre: rendrePied,
};

/* ═════════════════════════ Pop-up promotionnelle ═════════════════════════ */

const CHAMPS_POPUP: Champ[] = [
  texte("titre", "Titre", "Bienvenue", { max: 60 }),
  texte("texte", "Texte", "Inscrivez-vous à la lettre et recevez 10 % sur votre première commande.", { max: 200 }),
  inter("formulaire", "Formulaire d'inscription", true, "mail"),
  texte("code", "Code promo affiché", "", { max: 20, si: { champ: "formulaire", valeurs: [false] } }),
  image("image", "Image", "accueilCouleur", { si: { variantes: ["image"] } }),
  { cle: "delai", type: "curseur", libelle: "Apparaît après", icone: "minuterie", min: 0, max: 30, pas: 1, defaut: 6, unite: "s" },
  inter("uneFois", "Une fois par session", true, "recent"),
];

function rendrePopup(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const idT = `v-pop-t-${s.id}`;
  const idF = `v-pop-f-${s.id}`;
  const form = g.formulaire
    ? `<form class="v-nl" data-v-newsletter novalidate><div class="v-nl-ligne"><label for="${idF}" class="v-cache">Votre adresse électronique</label><input class="v-champ" id="${idF}" type="email" name="courriel" autocomplete="email" required placeholder="vous@exemple.fr"><button type="submit" class="v-btn">Recevoir</button></div><p class="v-nl-message" role="status"></p></form>`
    : g.code
      ? `<p class="v-pop-code">Code : <strong>${e(g.code)}</strong></p>`
      : "";
  const contenu = `${s.variante === "image" ? `<div class="v-pop-media">${imgPhoto(photoOu(g.image), ctx, { sizes: "320px", alt: "" })}</div>` : ""}<div class="v-pop-textes"><h2 class="v-titre" id="${idT}">${e(g.titre)}</h2><p>${e(g.texte)}</p>${form}<button type="button" class="v-lien-discret" data-v-fermer>Non merci</button></div><button type="button" class="v-pop-fermer v-rond v-rond--petit" data-v-fermer aria-label="Fermer">${icone("fermer", 18)}</button>`;
  const dialog = `<dialog class="v-pop v-pop--${s.variante}" aria-labelledby="${idT}" data-v-popup data-delai="${g.delai}" data-une-fois="${g.uneFois}" data-cle="${e(s.id)}">${contenu}</dialog>`;
  // Dans l'éditeur, la fenêtre ne s'ouvre pas seule : une bande la représente, avec un bouton pour l'ouvrir.
  const bande = ctx.edition ? `<div class="v-pop-bande">${icone("fenetre", 18)} Fenêtre « ${e(g.titre)} » : s'ouvre après ${g.delai} s${g.uneFois ? ", une fois par session" : ""}. <button type="button" class="v-btn v-btn--2" data-v-ouvrir-popup>Voir la fenêtre</button></div>` : "";
  return `<div${attrs({ class: cls("v-s", "v-popup"), id: `s-${s.id}`, "data-v-section": s.id, "data-v-type": s.type })}>${bande}${dialog}</div>`;
}

export const POPUP: DefinitionSection = {
  type: "popup",
  nom: "Fenêtre promotionnelle",
  icone: "fenetre",
  description: "Une fenêtre qui s'ouvre après quelques secondes, une fois par session ; Échap la ferme.",
  famille: "bas",
  unique: true,
  place: "bas",
  variantes: [
    { id: "simple", nom: "Texte", icone: "texte", description: "Titre, texte, formulaire.", croquis: "r 0 0 100 60; r 25 10 50 40; T 32 18 36; t 32 26 36; r 32 34 26 6; b 60 34 10" },
    { id: "image", nom: "Avec image", icone: "image", description: "Une photo à gauche, le texte à droite.", croquis: "r 0 0 100 60; i 18 10 28 40; r 46 10 36 40; T 50 18 26; t 50 26 28; b 50 36 20" },
  ],
  champs: CHAMPS_POPUP,
  rendre: rendrePopup,
};
