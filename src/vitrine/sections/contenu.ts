/**
 * Vitrine — le contenu et la réassurance : cartes éditoriales « La Maison », histoire de la marque, avis clients, FAQ,
 * badges de confiance, logos presse, lettre d'information, journal (blog).
 */
import type { Champ } from "../schema.ts";
import type { Contexte, DefinitionSection, Section } from "../types.ts";
import { bouton, e, etoiles, imgPhoto, paragraphes } from "../html.ts";
import { icone } from "../icones.ts";
import { PRODUITS, produit } from "../donnees.ts";
import { avecCommuns, enveloppe, idTitre, image, inter, photoOu, r, teteSection, texte } from "./communs.ts";
import { carrousel } from "./produits.ts";

/* ═════════════════════════ Cartes éditoriales « La Maison » ═════════════════════════ */

const CHAMPS_MAISON: Champ[] = avecCommuns([
  texte("titre", "Titre", "La Maison", { max: 80 }),
  {
    cle: "cartes", type: "liste", libelle: "Cartes", icone: "journal", min: 2, max: 4, titre: "titre",
    element: [image("image", "Image", "accueilCouleur"), texte("titre", "Titre", "Titre", { max: 60, requis: true }), texte("texte", "Texte", "", { max: 200 }), texte("lien", "Texte du lien", "En savoir plus", { max: 30 })],
    defaut: [
      { image: "accueilCouleur", titre: "L'atelier", texte: "Nos pièces sont coupées et cousues en petites séries, à deux heures de route de nos bureaux.", lien: "Visiter l'atelier" },
      { image: "echarpeNb", titre: "Les matières", texte: "Coton biologique, lin lavé, laine mérinos : des fibres choisies pour durer.", lien: "Nos engagements" },
      { image: "bijouOvale", titre: "Le geste", texte: "Chaque bijou est gravé à la main ; aucun n'est tout à fait le même.", lien: "Rencontrer les artisans" },
    ],
  },
]);

function rendreMaison(s: Section, ctx: Contexte): string {
  const cartes = r<Record<string, unknown>[]>(s, "cartes");
  const items = cartes.map((c, i) => `<li class="v-edito"><a class="v-edito-lien" href="#maison-${i + 1}"><span class="v-edito-media">${imgPhoto(photoOu(c.image), ctx, { sizes: "(max-width: 700px) 90vw, 33vw", alt: "" })}</span><span class="v-edito-titre">${e(c.titre)}</span>${c.texte ? `<span class="v-edito-texte">${e(c.texte)}</span>` : ""}${c.lien ? `<span class="v-edito-plus">${e(c.lien)}<span aria-hidden="true"> →</span></span>` : ""}</a></li>`).join("");
  const titre = r<string>(s, "titre");
  return enveloppe(s, `<div class="v-conteneur">${teteSection(s, titre, "", undefined, "centre")}<ul class="v-grille v-editos v-editos--${s.variante}" style="--v-cols:${cartes.length}">${items}</ul></div>`, { titre: !!titre, etiquette: "La Maison" });
}

export const MAISON: DefinitionSection = {
  type: "maison",
  nom: "Cartes éditoriales",
  icone: "journal",
  description: "Trois cartes sur la maison : l'atelier, les matières, les artisans.",
  famille: "contenu",
  variantes: [
    { id: "alignees", nom: "Alignées", icone: "colonnes", description: "Trois cartes de même hauteur.", croquis: "T 38 2 24; i 2 10 31 34; i 34.5 10 31 34; i 67 10 31 34; T 2 47 16; T 34.5 47 16; T 67 47 16; t 2 53 26" },
    { id: "decalees", nom: "Décalées", icone: "mouvement", description: "La carte du milieu descend : un rythme de magazine.", croquis: "T 38 2 24; i 2 8 31 34; i 34.5 18 31 34; i 67 8 31 34; T 2 45 16; T 67 45 16" },
  ],
  champs: CHAMPS_MAISON,
  rendre: rendreMaison,
};

/* ═════════════════════════ Histoire de la marque ═════════════════════════ */

const CHAMPS_HISTOIRE: Champ[] = avecCommuns([
  texte("etiquette", "Étiquette", "Notre histoire", { max: 40 }),
  texte("titre", "Titre", "Des vêtements qu'on garde", { max: 90 }),
  texte("texte", "Texte", "Tout a commencé par une écharpe tissée pour une amie.\nAujourd'hui, nous dessinons peu de pièces, en matières naturelles, et nous les refaisons tant qu'on nous les demande.", { max: 900, multiligne: true }),
  image("image", "Image", "accueilNb", { si: { variantes: ["image-texte"] } }),
  texte("bouton", "Bouton", "Lire la suite", { max: 30 }),
  texte("signature", "Signature", "Les fondatrices", { max: 60, si: { variantes: ["citation"] } }),
  {
    cle: "cote", type: "selecteur", libelle: "Image", icone: "colonnes", defaut: "gauche", affichage: "segments", si: { variantes: ["image-texte"] },
    options: [
      { valeur: "gauche", libelle: "À gauche", icone: "aligne-g" },
      { valeur: "droite", libelle: "À droite", icone: "aligne-d" },
    ],
  },
]);

function rendreHistoire(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const tete = `${g.etiquette ? `<p class="v-etiquette">${e(g.etiquette)}</p>` : ""}<h2 class="v-titre v-titre--grand" id="${idTitre(s)}">${e(g.titre)}</h2>`;
  if (s.variante === "citation") {
    return enveloppe(s, `<div class="v-conteneur v-conteneur--etroit v-histoire-citation">${tete}<blockquote class="v-citation">${paragraphes(g.texte as string)}${g.signature ? `<footer>— ${e(g.signature)}</footer>` : ""}</blockquote>${g.bouton ? bouton(g.bouton as string, "#notre-histoire", true) : ""}</div>`, { titre: true });
  }
  return enveloppe(s, `<div class="v-conteneur v-histoire-grille${g.cote === "droite" ? " v-histoire-grille--inverse" : ""}"><div class="v-histoire-media">${imgPhoto(photoOu(g.image), ctx, { sizes: "(max-width: 700px) 100vw, 45vw" })}</div><div class="v-histoire-texte">${tete}<div class="v-prose">${paragraphes(g.texte as string)}</div>${g.bouton ? bouton(g.bouton as string, "#notre-histoire", true) : ""}</div></div>`, { titre: true });
}

export const HISTOIRE: DefinitionSection = {
  type: "histoire",
  nom: "Histoire de la marque",
  icone: "citation",
  description: "Qui fait les pièces, et pourquoi : image et texte, ou grande citation.",
  famille: "contenu",
  variantes: [
    { id: "image-texte", nom: "Image et texte", icone: "colonnes", description: "Une photo, un titre, quelques paragraphes.", croquis: "i 4 4 42 52; t 54 14 16; T 54 20 38; t 54 30 40; t 54 35 36; t 54 40 38; b 54 48 18" },
    { id: "citation", nom: "Citation", icone: "citation", description: "Le texte en grand, signé, centré.", croquis: "t 42 8 16; T 20 16 60; T 25 24 50; T 30 32 40; t 42 42 16; b 42 50 16" },
  ],
  champs: CHAMPS_HISTOIRE,
  rendre: rendreHistoire,
};

/* ═════════════════════════ Avis clients ═════════════════════════ */

const OPT_PRODUITS = [{ valeur: "", libelle: "Aucun" }, ...PRODUITS.map((p) => ({ valeur: p.id, libelle: p.nom }))];

const CHAMPS_AVIS: Champ[] = avecCommuns([
  texte("titre", "Titre", "Ce que vous en dites", { max: 80 }),
  { cle: "note", type: "curseur", libelle: "Note moyenne", icone: "etoile", min: 1, max: 5, pas: 0.1, defaut: 4.8 },
  { cle: "total", type: "curseur", libelle: "Nombre d'avis", icone: "bulle", min: 0, max: 20000, pas: 10, defaut: 1240 },
  {
    cle: "avis", type: "liste", libelle: "Avis", icone: "bulle", min: 1, max: 8, titre: "nom",
    element: [texte("nom", "Prénom", "Claire", { max: 30, requis: true }), texte("ville", "Ville", "", { max: 30 }), { cle: "note", type: "curseur", libelle: "Note", icone: "etoile", min: 1, max: 5, pas: 1, defaut: 5 }, texte("texte", "Avis", "", { max: 400, multiligne: true }), { cle: "produit", type: "selecteur", libelle: "Produit acheté", icone: "sac", options: OPT_PRODUITS, defaut: "", affichage: "liste" }],
    defaut: [
      { nom: "Claire", ville: "Nantes", note: 5, texte: "La coupe est parfaite, ample sans être informe. Après dix lavages, la couleur n'a pas bougé.", produit: "haut-brique" },
      { nom: "Inès", ville: "Lyon", note: 5, texte: "L'écharpe est immense et douce. Je l'ai déjà prêtée trois fois.", produit: "echarpe-cassis" },
      { nom: "Marc", ville: "Bruxelles", note: 4, texte: "Très beau jean, un peu raide au début ; il se fait en deux semaines.", produit: "jean-averse" },
      { nom: "Louise", ville: "Genève", note: 5, texte: "Emballage soigné, sans plastique, et un petit mot écrit à la main.", produit: "boucles-fleur" },
    ],
  },
  texte("lien", "Texte du lien", "Lire tous les avis", { max: 40 }),
]);

function rendreAvis(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const avis = g.avis as Record<string, unknown>[];
  const items = avis
    .map((a) => {
      const p = a.produit ? produit(String(a.produit)) : undefined;
      return `<li class="v-avis-carte"><figure>${etoiles(a.note as number, 16)}<blockquote>${paragraphes(String(a.texte ?? ""))}</blockquote><figcaption><span><strong>${e(a.nom)}</strong>${a.ville ? `, ${e(a.ville)}` : ""}</span>${p ? `<span class="v-avis-produit">a acheté <a href="${e(ctx.lienProduit(p))}" data-v-apercu="${e(p.id)}">${e(p.nom)}</a></span>` : ""}<span class="v-avis-verifie">${icone("coche", 14)} Achat vérifié</span></figcaption></figure></li>`;
    })
    .join("");
  const titre = g.titre as string;
  const resume = `<p class="v-avis-resume">${etoiles(g.note as number, 18)} <span><strong>${(g.note as number).toLocaleString("fr-FR")}</strong> sur 5 · ${(g.total as number).toLocaleString("fr-FR")} avis</span>${g.lien ? ` <a href="#avis">${e(g.lien)}<span aria-hidden="true"> →</span></a>` : ""}</p>`;
  const corps = s.variante === "carrousel" ? carrousel(items, { fleches: "tete", points: false, curseur: false, etiquette: titre || "Avis", classe: "v-carrousel--rail v-carrousel--avis" }) : `<ul class="v-grille v-avis-grille">${items}</ul>`;
  return enveloppe(s, `<div class="v-conteneur" style="--v-cols:${Math.min(4, avis.length)};--v-cols-m:1;--v-ecart:16px">${teteSection(s, titre)}${resume}${corps}</div>`, { titre: !!titre, etiquette: "Avis clients" });
}

export const AVIS: DefinitionSection = {
  type: "avis",
  nom: "Avis clients",
  icone: "bulle",
  description: "Note moyenne, avis signés et vérifiés, en grille ou en carrousel.",
  famille: "confiance",
  variantes: [
    { id: "grille", nom: "Grille", icone: "collection", description: "Tous les avis visibles.", croquis: "T 2 2 30; t 2 10 30; r 2 16 23 38; r 26.5 16 23 38; r 51 16 23 38; r 75.5 16 23 38" },
    { id: "carrousel", nom: "Carrousel", icone: "fleches", description: "Les avis en rail, flèches en haut.", croquis: "T 2 2 30; c 90 4; c 96 4; r 2 16 30 38; r 34 16 30 38; r 66 16 30 38" },
  ],
  champs: CHAMPS_AVIS,
  rendre: rendreAvis,
};

/* ═════════════════════════ FAQ ═════════════════════════ */

const CHAMPS_FAQ: Champ[] = avecCommuns([
  texte("titre", "Titre", "Questions fréquentes", { max: 80 }),
  texte("intro", "Introduction", "Une autre question ? Écrivez-nous, nous répondons sous 24 heures.", { max: 200 }),
  {
    cle: "questions", type: "liste", libelle: "Questions", icone: "question", min: 1, max: 10, titre: "question",
    element: [texte("question", "Question", "Question", { max: 120, requis: true }), texte("reponse", "Réponse", "", { max: 600, multiligne: true })],
    defaut: [
      { question: "Quels sont les délais de livraison ?", reponse: "Deux à trois jours ouvrés en France métropolitaine, quatre à six jours en Europe. Un numéro de suivi vous est envoyé dès l'expédition." },
      { question: "Comment retourner une pièce ?", reponse: "Vous avez 30 jours pour changer d'avis. L'étiquette de retour est imprimable depuis votre compte ; le remboursement part dès réception." },
      { question: "Comment choisir ma taille ?", reponse: "Nos coupes sont amples : prenez votre taille habituelle pour un tombé décontracté, une taille en dessous pour un effet plus ajusté. Chaque fiche donne les mesures à plat." },
      { question: "Comment entretenir le lin et la laine ?", reponse: "Lavage à 30 °C sur programme délicat, séchage à plat. La laine mérinos se lave peu : l'aérer suffit le plus souvent." },
    ],
  },
  inter("exclusif", "Une seule réponse ouverte à la fois", true, "question"),
]);

function rendreFaq(s: Section): string {
  const g = s.reglages;
  const nom = `faq-${s.id}`;
  const qs = (g.questions as Record<string, unknown>[]).map((q, i) => `<details class="v-faq-item"${g.exclusif ? ` name="${nom}"` : ""}${i === 0 && s.variante === "colonnes" ? " open" : ""}><summary class="v-faq-q">${e(q.question)}${icone("plus", 20, "v-ic v-faq-ic")}</summary><div class="v-faq-r">${paragraphes(String(q.reponse ?? ""))}</div></details>`).join("");
  const tete = `<div class="v-faq-tete">${g.titre ? `<h2 class="v-titre" id="${idTitre(s)}">${e(g.titre)}</h2>` : ""}${g.intro ? `<p class="v-sous-titre">${e(g.intro)}</p>` : ""}${s.variante === "colonnes" ? `<a class="v-btn v-btn--2" href="#service">${icone("bulle", 18)} Nous écrire</a>` : ""}</div>`;
  return enveloppe(s, `<div class="v-conteneur ${s.variante === "colonnes" ? "v-faq-colonnes" : "v-conteneur--etroit"}">${tete}<div class="v-faq-liste">${qs}</div></div>`, { titre: !!g.titre, etiquette: "Questions fréquentes" });
}

export const FAQ: DefinitionSection = {
  type: "faq",
  nom: "FAQ",
  icone: "question",
  description: "Questions en accordéon (éléments details natifs, clavier compris).",
  famille: "confiance",
  variantes: [
    { id: "accordeon", nom: "Accordéon", icone: "densite", description: "Centré, une colonne.", croquis: "T 30 4 40; t 30 11 40; r 20 18 60 7; r 20 27 60 7; r 20 36 60 7; r 20 45 60 7" },
    { id: "colonnes", nom: "Deux colonnes", icone: "colonnes", description: "Le titre et un bouton à gauche, les questions à droite.", croquis: "T 2 6 28; t 2 14 26; b 2 22 16; r 38 6 60 7; r 38 15 60 14; r 38 31 60 7; r 38 40 60 7" },
  ],
  champs: CHAMPS_FAQ,
  rendre: (s) => rendreFaq(s),
};

/* ═════════════════════════ Badges de confiance / services ═════════════════════════ */

const ICONES_SERVICES = ["camion", "retour", "cadenas", "bulle", "cadeau", "feuille", "aiguille", "globe"];
const CHAMPS_CONFIANCE: Champ[] = avecCommuns([
  texte("titre", "Titre (facultatif)", "", { max: 80 }),
  {
    cle: "elements", type: "liste", libelle: "Services", icone: "bouclier", min: 2, max: 5, titre: "titre",
    element: [
      { cle: "icone", type: "selecteur", libelle: "Icône", icone: "etoile", defaut: "camion", affichage: "liste", options: ICONES_SERVICES.map((i) => ({ valeur: i, libelle: { camion: "Livraison", retour: "Retours", cadenas: "Paiement", bulle: "Service client", cadeau: "Cadeau", feuille: "Matière", aiguille: "Atelier", globe: "Monde" }[i]!, icone: i })) },
      texte("titre", "Titre", "Titre", { max: 40, requis: true }),
      texte("texte", "Texte", "", { max: 120 }),
    ],
    defaut: [
      { icone: "camion", titre: "Livraison offerte", texte: "Dès 120 € d'achat, en deux à trois jours." },
      { icone: "retour", titre: "Retours sous 30 jours", texte: "Gratuits, depuis votre compte." },
      { icone: "cadenas", titre: "Paiement sécurisé", texte: "Carte, virement ou en trois fois." },
      { icone: "bulle", titre: "Un service qui répond", texte: "Du lundi au samedi, par écrit ou au téléphone." },
    ],
  },
], "surface", "serre");

function rendreConfiance(s: Section): string {
  const els = r<Record<string, unknown>[]>(s, "elements");
  const titre = r<string>(s, "titre");
  const items = els.map((x) => `<li class="v-service">${icone(String(x.icone), s.variante === "bandeau" ? 22 : 30)}<span class="v-service-textes"><strong class="v-service-titre">${e(x.titre)}</strong>${x.texte && s.variante !== "bandeau" ? `<span class="v-service-texte">${e(x.texte)}</span>` : ""}</span></li>`).join("");
  return enveloppe(s, `<div class="v-conteneur">${teteSection(s, titre, "", undefined, "centre")}<ul class="v-services v-services--${s.variante}" style="--v-n:${els.length}">${items}</ul></div>`, { titre: !!titre, etiquette: "Nos services" });
}

export const CONFIANCE: DefinitionSection = {
  type: "confiance",
  nom: "Services et réassurance",
  icone: "bouclier",
  description: "Livraison, retours, paiement sécurisé, service client : en icônes ou en bandeau.",
  famille: "confiance",
  variantes: [
    { id: "icones", nom: "Icônes et textes", icone: "collection", description: "Une icône, un titre, une phrase par service.", croquis: "c 14 18; T 6 28 16; t 4 34 20; c 39 18; T 31 28 16; t 29 34 20; c 64 18; T 56 28 16; t 54 34 20; c 89 18; T 81 28 16" },
    { id: "bandeau", nom: "Bandeau", icone: "densite-compacte", description: "Une ligne compacte, séparée par des filets.", croquis: "r 0 22 100 16; c 6 30; t 10 29 14; c 31 30; t 35 29 14; c 56 30; t 60 29 14; c 81 30; t 85 29 12" },
  ],
  champs: CHAMPS_CONFIANCE,
  rendre: rendreConfiance,
};

/* ═════════════════════════ Logos presse ═════════════════════════ */

const CHAMPS_PRESSE: Champ[] = avecCommuns([
  texte("titre", "Titre", "Ils en parlent", { max: 80 }),
  {
    cle: "titres", type: "liste", libelle: "Publications", icone: "journaux", min: 2, max: 6, titre: "nom",
    element: [
      texte("nom", "Nom (fictif)", "La Gazette", { max: 30, requis: true }),
      {
        cle: "style", type: "selecteur", libelle: "Typographie", icone: "texte", defaut: "serif", affichage: "segments",
        options: [
          { valeur: "serif", libelle: "Romain", icone: "titre" },
          { valeur: "italique", libelle: "Italique", icone: "texte" },
          { valeur: "capitales", libelle: "Capitales", icone: "capitales" },
          { valeur: "mono", libelle: "Machine", icone: "code" },
        ],
      },
      texte("citation", "Citation", "", { max: 160 }),
    ],
    defaut: [
      { nom: "Le Quotidien du Port", style: "serif", citation: "« Des basiques qui n'ont rien de basique. »" },
      { nom: "Fil & Trame", style: "italique", citation: "« La marinière la mieux coupée de la saison. »" },
      { nom: "ATELIERS", style: "capitales", citation: "« Une maison qui prend le temps. »" },
      { nom: "revue_matière", style: "mono", citation: "« Lin, laine, argent : rien n'est laissé au hasard. »" },
    ],
  },
], "papier", "serre");

function rendrePresse(s: Section): string {
  const t = r<Record<string, unknown>[]>(s, "titres");
  const titre = r<string>(s, "titre");
  if (s.variante === "citation") {
    const id = `v-pr-${s.id}`;
    return enveloppe(s, `<div class="v-conteneur v-presse-citation" data-v-onglets>${titre ? `<h2 class="v-surtitre" id="${idTitre(s)}">${e(titre)}</h2>` : ""}<div class="v-presse-panneaux">${t.map((x, i) => `<blockquote class="v-presse-q" id="${id}-${i}" role="tabpanel" aria-labelledby="${id}-o${i}"${i ? " hidden" : ""}><p>${e(x.citation)}</p></blockquote>`).join("")}</div><div class="v-presse-logos" role="tablist" aria-label="Publications">${t.map((x, i) => `<button type="button" role="tab" class="v-presse-logo v-presse-logo--${x.style}" id="${id}-o${i}" aria-controls="${id}-${i}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${e(x.nom)}</button>`).join("")}</div></div>`, { titre: !!titre, etiquette: "Presse" });
  }
  return enveloppe(s, `<div class="v-conteneur v-presse">${titre ? `<h2 class="v-surtitre" id="${idTitre(s)}">${e(titre)}</h2>` : ""}<ul class="v-presse-liste">${t.map((x) => `<li class="v-presse-logo v-presse-logo--${x.style}">${e(x.nom)}</li>`).join("")}</ul></div>`, { titre: !!titre, etiquette: "Presse" });
}

export const PRESSE: DefinitionSection = {
  type: "presse",
  nom: "Logos presse",
  icone: "journaux",
  description: "Les publications qui en parlent (noms fictifs, en typographie) ; ou leurs citations en onglets.",
  famille: "confiance",
  variantes: [
    { id: "logos", nom: "Logos en ligne", icone: "densite-compacte", description: "Une rangée de noms, en gris.", croquis: "t 40 14 20; T 4 30 18; T 28 30 18; T 52 30 18; T 76 30 18" },
    { id: "citation", nom: "Citations en onglets", icone: "citation", description: "La citation en grand ; les noms servent d'onglets (flèches du clavier).", croquis: "T 15 14 70; T 25 22 50; t 6 42 16; t 30 42 16; t 54 42 16; t 78 42 16; r 6 46 16 1" },
  ],
  champs: CHAMPS_PRESSE,
  rendre: rendrePresse,
};

/* ═════════════════════════ Lettre d'information ═════════════════════════ */

const CHAMPS_NEWSLETTER: Champ[] = avecCommuns([
  texte("titre", "Titre", "−10 % sur votre première commande", { max: 80 }),
  texte("texte", "Texte", "Les nouveautés, les coulisses de l'atelier et quelques offres, une fois par mois. Pas plus.", { max: 240 }),
  texte("bouton", "Bouton", "S'inscrire", { max: 24 }),
  texte("mention", "Mention", "Désinscription en un clic. Votre adresse ne sert qu'à cette lettre.", { max: 200 }),
  image("image", "Image", "accueilCouleur", { si: { variantes: ["image"] } }),
], "surface");

function formulaireNewsletter(s: Section, bouton: string, mention: string) {
  const id = `v-nl-${s.id}`;
  return `<form class="v-nl" data-v-newsletter novalidate><div class="v-nl-ligne"><label for="${id}" class="v-cache">Votre adresse électronique</label><input class="v-champ" id="${id}" name="courriel" type="email" autocomplete="email" required placeholder="vous@exemple.fr" aria-describedby="${id}-m"><button type="submit" class="v-btn">${e(bouton)}</button></div><p class="v-nl-message" id="${id}-m" role="status"></p>${mention ? `<p class="v-nl-mention">${e(mention)}</p>` : ""}</form>`;
}

function rendreNewsletter(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const textes = `<h2 class="v-titre" id="${idTitre(s)}">${e(g.titre)}</h2>${g.texte ? `<p class="v-sous-titre">${e(g.texte)}</p>` : ""}${formulaireNewsletter(s, g.bouton as string, g.mention as string)}`;
  if (s.variante === "image") return enveloppe(s, `<div class="v-conteneur v-nl-grille"><div class="v-nl-media">${imgPhoto(photoOu(g.image), ctx, { sizes: "(max-width: 700px) 100vw, 40vw", alt: "" })}</div><div class="v-nl-textes">${textes}</div></div>`, { titre: true });
  return enveloppe(s, `<div class="v-conteneur v-conteneur--etroit v-nl-centre">${icone("mail", 28)}${textes}</div>`, { titre: true });
}

export const NEWSLETTER: DefinitionSection = {
  type: "newsletter",
  nom: "Lettre d'information",
  icone: "mail",
  description: "Une inscription à la lettre, adresse validée, remise annoncée.",
  famille: "contenu",
  variantes: [
    { id: "simple", nom: "Centrée", icone: "aligne-c", description: "Titre, texte, champ et bouton, centrés.", croquis: "c 50 10; T 25 18 50; t 30 26 40; r 25 34 36 7; b 62 34 13; t 30 46 40" },
    { id: "image", nom: "Avec image", icone: "colonnes", description: "Une photo d'un côté, le formulaire de l'autre.", croquis: "i 0 0 45 60; T 52 16 40; t 52 24 36; r 52 32 30 7; b 83 32 13" },
  ],
  champs: CHAMPS_NEWSLETTER,
  rendre: rendreNewsletter,
};

/* ═════════════════════════ Journal (blog) ═════════════════════════ */

const CHAMPS_BLOG: Champ[] = avecCommuns([
  texte("titre", "Titre", "Le journal", { max: 80 }),
  {
    cle: "articles", type: "liste", libelle: "Articles", icone: "journal", min: 2, max: 3, titre: "titre",
    element: [image("image", "Image", "campagne"), texte("rubrique", "Rubrique", "Atelier", { max: 30 }), texte("titre", "Titre", "Titre", { max: 100, requis: true }), texte("date", "Date", "12 novembre 2026", { max: 30 }), texte("extrait", "Extrait", "", { max: 240 })],
    defaut: [
      { image: "echarpeCouleur", rubrique: "Matières", titre: "Pourquoi nos écharpes mettent trois semaines à naître", date: "12 novembre 2026", extrait: "Du fil teint à la frange nouée à la main, le voyage d'une écharpe à carreaux." },
      { image: "campagne", rubrique: "Style", titre: "Cinq façons de porter un haut ample", date: "4 novembre 2026", extrait: "Rentré, noué, superposé : un seul haut, une semaine de tenues." },
      { image: "bijouFleur", rubrique: "Rencontre", titre: "Dans l'atelier de la graveuse", date: "28 octobre 2026", extrait: "Elle grave chaque pendant à la main, au burin, depuis vingt ans." },
    ],
  },
  texte("lien", "Lien « tous les articles »", "Tous les articles", { max: 40 }),
]);

function rendreBlog(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const arts = g.articles as Record<string, unknown>[];
  const items = arts.map((a, i) => `<li class="v-article${s.variante === "une" && i === 0 ? " v-article--une" : ""}"><a class="v-article-lien" href="#journal-${i + 1}"><span class="v-article-media">${imgPhoto(photoOu(a.image), ctx, { sizes: s.variante === "une" && i === 0 ? "(max-width: 700px) 100vw, 60vw" : "(max-width: 700px) 100vw, 33vw", alt: "" })}</span><span class="v-article-meta"><span class="v-article-rubrique">${e(a.rubrique)}</span>${a.date ? ` · <time>${e(a.date)}</time>` : ""}</span><span class="v-article-titre">${e(a.titre)}</span>${a.extrait ? `<span class="v-article-extrait">${e(a.extrait)}</span>` : ""}</a></li>`).join("");
  const titre = g.titre as string;
  return enveloppe(s, `<div class="v-conteneur">${teteSection(s, titre, "", g.lien ? { texte: g.lien as string, href: "#journal" } : undefined)}<ul class="v-grille v-articles v-articles--${s.variante}" style="--v-cols:${arts.length}">${items}</ul></div>`, { titre: !!titre, etiquette: "Journal" });
}

export const BLOG: DefinitionSection = {
  type: "blog",
  nom: "Journal",
  icone: "journal",
  description: "Trois articles du journal de la marque.",
  famille: "contenu",
  variantes: [
    { id: "trois", nom: "Trois colonnes", icone: "colonnes", description: "Trois articles égaux.", croquis: "T 2 2 26; i 2 10 31 26; i 34.5 10 31 26; i 67 10 31 26; t 2 40 12; T 2 45 28; t 34.5 40 12; T 34.5 45 28; t 67 40 12; T 67 45 28" },
    { id: "une", nom: "À la une", icone: "journal", description: "Un grand article, deux petits à côté.", croquis: "T 2 2 26; i 2 10 58 34; T 2 48 40; i 64 10 34 15; t 64 27 30; i 64 34 34 15; t 64 51 30" },
  ],
  champs: CHAMPS_BLOG,
  rendre: rendreBlog,
};

