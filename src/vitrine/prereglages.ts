/**
 * Vitrine — quatre boutiques fictives complètes (plan + jetons), bien différentes :
 *
 *   Maison    luxe sobre : blanc, romain léger, bouton « Menu », hero vidéo, huit catégories, grille compacte détourée ;
 *   District  commerce de mode contemporain : bandeau rotatif, en-tête collant à mega-menus, diaporama, badges,
 *             stock, achat rapide, prix barrés, avis, vus récemment, pop-up ;
 *   Tribus    artisanal : lin et terre cuite, deux visuels, catégories et matières, histoire, lookbook, avis, lettre ;
 *   Atelier   éditorial : le style d'Éclaircie (gris des photos, capitales étroites, rouge), mur en mosaïque.
 *
 * Les marques sont inventées ; les structures s'inspirent de grands thèmes de boutique, sans en reprendre un texte.
 */
import { validerPlan } from "./modele.ts";
import { lireJetons, type Jetons } from "./jetons.ts";
import type { Prereglage, Section } from "./types.ts";

type Brute = { type: string; variante: string; reglages?: Record<string, unknown>; id?: string };
function plan(marque: string, sections: Brute[]) {
  const p = validerPlan({ marque, sections: sections.map((s) => ({ ...s, reglages: s.reglages ?? {} })) });
  return p;
}
const jetons = (j: Partial<Jetons>) => lireJetons(j).jetons;

/* ═════════════════════════ Maison ═════════════════════════ */

const MAISON: Prereglage = {
  id: "maison",
  nom: "Maison",
  description: "Luxe sobre : blanc, romain léger, bouton « Menu », hero vidéo, grille compacte détourée.",
  jetons: jetons({ papier: "#ffffff", surface: "#f3f1ed", encre: "#1c1a17", accent: "#7a4e26", titre: "cormorant", texte: "archivo", graisseTitre: 500, capitales: false, approche: 0.005, base: 15, rapport: 1.3, rayon: 0, densite: "aeree", ombre: 0, bouton: "contour", largeur: 1440, mouvement: 1.2 }),
  plan: plan("Maison Brume", [
    { type: "annonce", variante: "fixe", reglages: { couleur: "surface", messages: [{ texte: "Livraison et retours offerts", lien: "", cible: "tout" }, { texte: "Emballage cadeau sur demande", lien: "", cible: "tout" }] } },
    {
      type: "entete", variante: "menu",
      reglages: { collant: true, transparent: true, ouverture: "clic", libelles: "icones", menu: [{ libelle: "Nouveautés", collection: "nouveautes", mega: true, image: "campagne" }, { libelle: "Prêt-à-porter", collection: "tout", mega: true, image: "accueilCouleur" }, { libelle: "Écharpes", collection: "categorie:echarpes", mega: true, image: "echarpeCouleur" }, { libelle: "Bijoux", collection: "categorie:bijoux", mega: true, image: "bijouFleur" }, { libelle: "La Maison", collection: "tout", mega: false, image: "accueilNb" }] },
    },
    { type: "hero", variante: "video", reglages: { etiquette: "Automne-hiver", titre: "Les heures douces", texte: "", bouton1: "Découvrir", lien1: "nouveautes", bouton2: "La collection", lien2: "tout", hauteur: "plein", position: "bas-centre", voile: 0.35, espace: "aucun" } },
    {
      type: "categories", variante: "grille",
      reglages: {
        titre: "Les univers", sousTitre: "", colonnes: 4, ratio: "carre", legende: "dessous", nombre: false,
        tuiles: [
          { collection: "nouveautes", image: "campagne", titre: "Nouveautés", accroche: "" },
          { collection: "categorie:hauts", image: "rouille", titre: "", accroche: "" },
          { collection: "categorie:pantalons", image: "pervenche", titre: "", accroche: "" },
          { collection: "categorie:rayures", image: "rayuresNoires", titre: "", accroche: "" },
          { collection: "categorie:echarpes", image: "echarpeNb", titre: "", accroche: "" },
          { collection: "categorie:bijoux", image: "bijouOvale", titre: "", accroche: "" },
          { collection: "matiere:laine", image: "violetEcharpe", titre: "Laine", accroche: "" },
          { collection: "meilleures-ventes", image: "accueilNb", titre: "Les essentiels", accroche: "" },
        ],
      },
    },
    { type: "collection", variante: "carrousel", reglages: { titre: "Nouveautés", sousTitre: "", collection: "nouveautes", nombre: 8, colonnes: 4, fleches: "tete", points: false, presentation: "detouree", survol: "seconde", badges: false, pastilles: false, stock: false, favoris: true, achatRapide: "panneau", alignement: "centre", espacement: 4, ratio: "portrait" } },
    { type: "hero", variante: "diaporama", reglages: { hauteur: "grand", transition: "glissement", fleches: true, points: false, progression: false, compteur: true, auto: false, position: "bas-gauche", voile: 0.25, espace: "normal", diapos: [
      { image: "echarpeCouleur", etiquette: "Découvrez l'univers", titre: "La laine, tissée lentement", texte: "", bouton: "Les écharpes", lien: "categorie:echarpes" },
      { image: "bijouFleur", etiquette: "Découvrez l'univers", titre: "L'argent, gravé à la main", texte: "", bouton: "Les bijoux", lien: "categorie:bijoux" },
      { image: "rayuresNoires", etiquette: "Découvrez l'univers", titre: "La rayure, élargie", texte: "", bouton: "Les rayures", lien: "categorie:rayures" },
      { image: "pervenche", etiquette: "Découvrez l'univers", titre: "Le pantalon, très large", texte: "", bouton: "Les pantalons", lien: "categorie:pantalons" },
      { image: "accueilNb", etiquette: "Découvrez l'univers", titre: "Le portrait, en noir et blanc", texte: "", bouton: "Toute la collection", lien: "tout" },
    ] } },
    { type: "collection", variante: "compacte", reglages: { titre: "La sélection", sousTitre: "Vingt pièces pour l'hiver", collection: "tout", nombre: 12, colonnes: 4, presentation: "detouree", survol: "seconde", badges: false, pastilles: false, stock: false, favoris: true, achatRapide: "aucun", alignement: "centre", espacement: 24, ratio: "portrait", lienTout: true } },
    { type: "maison", variante: "alignees", reglages: { titre: "La Maison" } },
    { type: "confiance", variante: "icones", reglages: { titre: "Nos services", fond: "papier", espace: "normal", elements: [
      { icone: "camion", titre: "Livraison offerte", texte: "En deux à trois jours, partout en Europe." },
      { icone: "retour", titre: "Retours sous 30 jours", texte: "Gratuits, et sans justification." },
      { icone: "bulle", titre: "Service client", texte: "Une conseillère vous répond, du lundi au samedi." },
      { icone: "cadenas", titre: "Paiement sécurisé", texte: "Vos données ne quittent pas la banque." },
    ] } },
    { type: "pied", variante: "plan", reglages: { couleur: "surface", grandLogo: true, newsletter: true, reseaux: true, paiements: true, pays: true, mention: "© 2026 Maison Brume — boutique fictive de démonstration" } },
  ]),
};

/* ═════════════════════════ District ═════════════════════════ */

const DISTRICT: Prereglage = {
  id: "district",
  nom: "District",
  description: "Mode contemporaine : en-tête collant, mega-menus, badges, stock, achat rapide, prix barrés.",
  jetons: jetons({ papier: "#ffffff", surface: "#f1f1ef", encre: "#111111", accent: "#d23a1e", titre: "archivo", texte: "archivo", graisseTitre: 800, largeurTitre: 78, capitales: true, approche: 0.005, base: 15, rapport: 1.25, rayon: 4, densite: "compacte", ombre: 0, bouton: "plein", largeur: 1480, mouvement: 0.9 }),
  plan: plan("Quai Nord", [
    { type: "annonce", variante: "rotatif", reglages: { couleur: "encre", delai: 5, messages: [{ texte: "Livraison offerte dès 120 €", lien: "", cible: "tout" }, { texte: "Jusqu'à −25 % sur une sélection", lien: "En profiter", cible: "promotions" }, { texte: "Retours gratuits sous 30 jours", lien: "", cible: "tout" }] } },
    { type: "entete", variante: "classique", reglages: { collant: true, transparent: false, ouverture: "survol", libelles: "icones", menu: [{ libelle: "Nouveautés", collection: "nouveautes", mega: false, image: "campagne" }, { libelle: "Femme", collection: "tout", mega: true, image: "rouille" }, { libelle: "Accessoires", collection: "categorie:echarpes", mega: true, image: "echarpeCouleur" }, { libelle: "Meilleures ventes", collection: "meilleures-ventes", mega: false, image: "pervenche" }, { libelle: "Promotions", collection: "promotions", mega: false, image: "sapin" }] } },
    { type: "hero", variante: "diaporama", reglages: { hauteur: "grand", transition: "zoom", fleches: true, points: true, progression: true, compteur: false, auto: true, delai: 6, pauseSurvol: true, position: "bas-gauche", voile: 0.35, espace: "aucun", diapos: [
      { image: "campagne", etiquette: "Nouvelle saison", titre: "Couleurs franches", texte: "Pulls, hauts amples et pantalons larges.", bouton: "Acheter les nouveautés", lien: "nouveautes" },
      { image: "rayuresRouges", etiquette: "Best-seller", titre: "La marinière", texte: "En rouge ou en encre, coupe ample.", bouton: "Voir les rayures", lien: "categorie:rayures" },
      { image: "sapin", etiquette: "Jusqu'à −25 %", titre: "Dernières tailles", texte: "Une sélection à prix doux, jusqu'à épuisement.", bouton: "Voir les promotions", lien: "promotions" },
    ] } },
    { type: "confiance", variante: "bandeau", reglages: { fond: "surface", espace: "serre" } },
    { type: "categories", variante: "carrousel", reglages: { titre: "Acheter par catégorie", colonnes: 5, ratio: "portrait", legende: "dessus", nombre: true, espace: "normal", tuiles: [
      { collection: "categorie:hauts", image: "rouille", titre: "", accroche: "" },
      { collection: "categorie:pantalons", image: "pervenche", titre: "", accroche: "" },
      { collection: "categorie:rayures", image: "rayuresRouges", titre: "", accroche: "" },
      { collection: "categorie:echarpes", image: "echarpeCouleur", titre: "", accroche: "" },
      { collection: "categorie:bijoux", image: "bijouFleur", titre: "", accroche: "" },
      { collection: "promotions", image: "sapin", titre: "Promotions", accroche: "" },
    ] } },
    { type: "collection", variante: "grille", reglages: { titre: "Meilleures ventes", sousTitre: "Les pièces qu'on nous redemande", collection: "meilleures-ventes", nombre: 8, colonnes: 4, colonnesMobile: "2", espacement: 16, ratio: "portrait", presentation: "photo", survol: "seconde", bord: "aucun", badges: true, pastilles: true, stock: true, prixBarre: true, favoris: true, achatRapide: "popover", alignement: "gauche" } },
    { type: "promo", variante: "trois", reglages: { hauteur: "moyenne" } },
    { type: "collection", variante: "curseur", reglages: { titre: "Promotions", sousTitre: "Jusqu'à −25 %, dans la limite des stocks", collection: "promotions", nombre: 6, colonnes: 3, fleches: "tete", espacement: 16, ratio: "portrait", presentation: "photo", survol: "zoom", badges: true, pastilles: true, stock: true, prixBarre: true, favoris: true, achatRapide: "panneau", fond: "surface" } },
    { type: "phare", variante: "classique", reglages: { produit: "mariniere-grenadine", etiquette: "La pièce de la saison", achat: true, cote: "gauche", fond: "papier" } },
    { type: "avis", variante: "carrousel", reglages: { titre: "Avis clients", fond: "surface" } },
    { type: "selection", variante: "recents", reglages: { titre: "Vus récemment", nombre: 6, achatRapide: "popover", pastilles: false, stock: false } },
    { type: "faq", variante: "colonnes", reglages: {} },
    { type: "newsletter", variante: "simple", reglages: { titre: "−10 % sur votre première commande", fond: "sombre" } },
    { type: "pied", variante: "colonnes", reglages: { couleur: "sombre", newsletter: false, reseaux: true, paiements: true, pays: true, mention: "© 2026 Quai Nord — boutique fictive de démonstration" } },
    { type: "popup", variante: "image", reglages: { titre: "Bienvenue chez Quai Nord", texte: "Inscrivez-vous et recevez 10 % sur votre première commande.", delai: 8, uneFois: true, image: "rayuresRouges" } },
  ]),
};

/* ═════════════════════════ Tribus ═════════════════════════ */

const TRIBUS: Prereglage = {
  id: "tribus",
  nom: "Tribus",
  description: "Artisanal : lin et terre cuite, deux visuels, catégories par matière, histoire, avis, lettre −10 %.",
  jetons: jetons({ papier: "#f6f1e7", surface: "#ebe2d0", encre: "#2a241d", accent: "#9b4a26", titre: "bodoni", texte: "archivo", graisseTitre: 450, capitales: false, approche: -0.01, base: 16, rapport: 1.3, rayon: 14, densite: "normale", ombre: 0.15, bouton: "plein", largeur: 1360, mouvement: 1 }),
  plan: plan("Fil & Terre", [
    { type: "annonce", variante: "newsletter", reglages: { couleur: "accent", remise: 10 } },
    { type: "entete", variante: "centre", reglages: { collant: true, ouverture: "survol", libelles: "icones", menu: [{ libelle: "Nouveautés", collection: "nouveautes", mega: false, image: "campagne" }, { libelle: "Meilleures ventes", collection: "meilleures-ventes", mega: false, image: "rouille" }, { libelle: "Vêtements", collection: "tout", mega: true, image: "lilas" }, { libelle: "Accessoires", collection: "categorie:echarpes", mega: true, image: "violetEcharpe" }, { libelle: "Par matière", collection: "matiere:lin", mega: true, image: "sauge" }] } },
    { type: "hero", variante: "duo", reglages: { etiquette: "", titre: "Tissé, teint, cousu", texte: "Des vêtements en fibres naturelles, faits pour durer.", bouton1: "Découvrir", lien1: "nouveautes", bouton2: "", image: "accueilCouleur", image2: "violetEcharpe", hauteur: "grand", position: "bas-centre", voile: 0.3, espace: "aucun" } },
    { type: "categories", variante: "grille", reglages: { titre: "", colonnes: 4, ratio: "carre", legende: "dessous", nombre: true, espace: "normal", tuiles: [
      { collection: "categorie:hauts", image: "lilas", titre: "", accroche: "" },
      { collection: "categorie:pantalons", image: "olive", titre: "", accroche: "" },
      { collection: "categorie:echarpes", image: "violetEcharpe", titre: "", accroche: "" },
      { collection: "categorie:bijoux", image: "bijouOvale", titre: "", accroche: "" },
    ] } },
    { type: "phare", variante: "plein", reglages: { produit: "echarpe-cassis", etiquette: "La pièce phare", titre: "La grande écharpe", texte: "Deux mètres de carreaux magenta et prune, tissés sur un métier à bras, frangés à la main. Elle se drape, se noue, se prête — et revient toujours.", image: "echarpeCouleur", achat: true, fond: "papier", espace: "aucun" } },
    { type: "categories", variante: "matieres", reglages: { titre: "Acheter par tissu", sousTitre: "Quatre fibres, choisies pour la peau et pour la terre.", colonnes: 4, ratio: "portrait", fond: "surface", tuiles: [
      { collection: "matiere:coton", image: "rouille", titre: "Coton biologique", accroche: "Doux dès le premier jour, plus doux au centième." },
      { collection: "matiere:lin", image: "lilas", titre: "Lin lavé", accroche: "Frais l'été, froissé juste ce qu'il faut." },
      { collection: "matiere:laine", image: "echarpeCouleur", titre: "Laine mérinos", accroche: "Chaude sans piquer, tissée lentement." },
      { collection: "matiere:denim", image: "sapin", titre: "Denim recyclé", accroche: "Treize onces de coton qui a déjà vécu." },
    ] } },
    { type: "collection", variante: "rail", reglages: { titre: "Nouveautés", sousTitre: "", collection: "nouveautes", nombre: 8, colonnes: 4, espacement: 20, ratio: "portrait", presentation: "photo", survol: "seconde", bord: "aucun", badges: true, pastilles: true, stock: false, favoris: true, achatRapide: "popover", alignement: "gauche" } },
    { type: "histoire", variante: "image-texte", reglages: { etiquette: "Notre histoire", titre: "Des fils qui viennent de quelque part", texte: "Nous travaillons avec trois ateliers familiaux : une filature, une teinturerie végétale, un atelier de couture.\nNous les connaissons par leur prénom ; nous savons ce qu'ils gagnent.\nC'est plus lent. C'est le but.", image: "accueilNb", cote: "gauche", fond: "papier" } },
    { type: "lookbook", variante: "liste", reglages: { titre: "Le look du mois", texte: "", image: "echarpeCouleur", fond: "surface" } },
    { type: "avis", variante: "grille", reglages: { titre: "Vos mots", note: 4.9, total: 860, lien: "Lire les 860 avis" } },
    { type: "presse", variante: "citation", reglages: { titre: "Ils en parlent" } },
    { type: "newsletter", variante: "image", reglages: { titre: "−10 % sur votre première commande", image: "sauge", fond: "surface" } },
    { type: "pied", variante: "colonnes", reglages: { couleur: "sombre", newsletter: false, reseaux: true, paiements: true, pays: true, mention: "© 2026 Fil & Terre — boutique fictive de démonstration" } },
  ]),
};

/* ═════════════════════════ Atelier (le style d'Éclaircie) ═════════════════════════ */

const ATELIER: Prereglage = {
  id: "atelier",
  nom: "Atelier",
  description: "Éditorial : le gris des photos d'Éclaircie, capitales étroites, rouge ; mur en mosaïque, lookbook.",
  jetons: jetons({ papier: "#e6e2df", surface: "#d6d0cd", encre: "#121014", accent: "#a8121f", titre: "archivo", texte: "archivo", graisseTitre: 800, largeurTitre: 62, capitales: true, approche: -0.01, base: 16, rapport: 1.414, rayon: 0, densite: "normale", ombre: 0, bouton: "souligne", largeur: 1520, mouvement: 1 }),
  plan: plan("Éclaircie", [
    { type: "annonce", variante: "defilant", reglages: { couleur: "accent", vitesse: 40, messages: [{ texte: "Le chic après la pluie", lien: "", cible: "tout" }, { texte: "Collection A/H 26", lien: "Voir", cible: "nouveautes" }, { texte: "Livraison offerte dès 120 €", lien: "", cible: "tout" }] } },
    { type: "entete", variante: "classique", reglages: { collant: true, ouverture: "clic", libelles: "texte", pays: false, compte: false, menu: [{ libelle: "Boutique", collection: "tout", mega: true, image: "campagne" }, { libelle: "Rayures", collection: "categorie:rayures", mega: false, image: "rayuresRouges" }, { libelle: "Écharpes", collection: "categorie:echarpes", mega: false, image: "echarpeCouleur" }, { libelle: "Bijoux", collection: "categorie:bijoux", mega: false, image: "bijouFleur" }] } },
    { type: "hero", variante: "partage", reglages: { etiquette: "A/H — 26", titre: "Le chic après la pluie", texte: "Des couleurs franches sous un ciel gris : rouille, pervenche, grenadine.", bouton1: "La boutique", lien1: "tout", bouton2: "Le lookbook", lien2: "nouveautes", image: "echarpeCouleur", cote: "droite", hauteur: "grand", espace: "aucun", fond: "surface" } },
    { type: "collection", variante: "mosaique", reglages: { titre: "Nouveautés", sousTitre: "Douze pièces pour la saison des averses.", collection: "nouveautes", nombre: 7, colonnes: 4, espacement: 8, ratio: "portrait", presentation: "photo", survol: "seconde", badges: true, pastilles: false, stock: false, favoris: true, achatRapide: "popover", lienTout: true } },
    { type: "lookbook", variante: "points", reglages: { titre: "Lookbook", texte: "Touchez un point : la pièce, son prix, et l'achat.", image: "campagne", points: [{ produit: "haut-griotte", x: 52, y: 40 }, { produit: "pantalon-nuit", x: 55, y: 78 }], fond: "sombre" } },
    { type: "collection", variante: "rail", reglages: { titre: "Rayures", collection: "categorie:rayures", nombre: 6, colonnes: 3, espacement: 8, ratio: "portrait", presentation: "detouree", survol: "seconde", badges: true, pastilles: true, favoris: true, achatRapide: "panneau", fond: "surface" } },
    { type: "maison", variante: "decalees", reglages: { titre: "L'atelier" } },
    { type: "selection", variante: "recommandes", reglages: { titre: "Avec l'écharpe Cassis", produit: "echarpe-cassis", nombre: 4 } },
    { type: "histoire", variante: "citation", reglages: { etiquette: "Manifeste", titre: "On s'habille pour l'éclaircie", texte: "Pas pour la pluie, pas pour le soleil : pour le moment entre les deux, quand les couleurs reviennent.", signature: "Éclaircie", bouton: "", fond: "surface" } },
    { type: "presse", variante: "logos", reglages: {} },
    { type: "faq", variante: "accordeon", reglages: {} },
    { type: "pied", variante: "minimal", reglages: { couleur: "sombre", pays: false, mention: "© 2026 Éclaircie — boutique d'essai Presse" } },
  ]),
};

export const PREREGLAGES: readonly Prereglage[] = [MAISON, DISTRICT, TRIBUS, ATELIER];
export const prereglage = (id: string) => PREREGLAGES.find((p) => p.id === id);
export type { Section };
