/**
 * Navigation — la taxonomie unique du dépôt : chaque page a un groupe, les effets viennent du registre
 * (src/registre/effets.ts). Données pures, importables par Node (taxonomie.test.ts) : ni DOM, ni CSS, ni alias.
 *
 * Lue par :
 *   - src/pages-nav.ts (`PAGES`, ré-exporté tel quel : API publique) et le méga-menu (src/nav/menu.ts) ;
 *   - la palette de commandes (src/nav/palette.ts, chargée à la demande) : pages, effets, attributs `data-*` ;
 *   - src/presse/presentation.ts (`mountSettings`) : l'ordre des démos du mode présentation = l'ordre de `PAGES`.
 *
 * Groupes : Studio (les éditeurs), Effets (par catégorie du registre), Interfaces (catégorie « interface » du registre
 * et démos d'interface), Sites & boutiques (démos), Outils, Docs, Labs (essais techniques).
 *
 * Ajouter une page : une entrée dans `PAGES` (avec son `groupe`) ET dans `vite.config.ts` (`input`) ; le test échoue
 * si l'une manque à l'autre (ou si la page est exclue sans raison : `EXCLUES`).
 */

import { EFFETS, type Categorie, type Manifeste } from "../registre/effets.ts";

export type GroupeId = "studio" | "effets" | "interfaces" | "sites" | "outils" | "docs" | "labs";

export type Page = {
  /** Depuis la racine du site (« goo.html », « legacy/index.html »). */
  href: string;
  name: string;
  text: string;
  groupe: GroupeId;
  /** Nom court dans le groupe (Studio : « Site » pour le Créateur). */
  court?: string;
  /** Mots de recherche en plus (palette). */
  mots?: readonly string[];
};

export const GROUPES: readonly { id: GroupeId; nom: string; resume: string }[] = [
  { id: "studio", nom: "Studio", resume: "Créer : un site, une boutique, un diaporama, une courbe, un effet" },
  { id: "effets", nom: "Effets", resume: "Le registre, par catégorie" },
  { id: "interfaces", nom: "Interfaces", resume: "Menus, gouttes, rails, défilements" },
  { id: "sites", nom: "Sites & boutiques", resume: "Des démos complètes" },
  { id: "outils", nom: "Outils", resume: "Logos, variations, samplers" },
  { id: "docs", nom: "Docs", resume: "Le guide et le framework" },
  { id: "labs", nom: "Labs", resume: "Essais techniques : simulation, HTML-in-Canvas" },
];

/**
 * Les pages du menu, dans l'ordre des démos du mode présentation (Maj + → / ←) : ne pas réordonner sans raison.
 * Les champs `href`, `name`, `text` sont l'API historique ; `groupe` (E6) les range.
 */
export const PAGES: readonly Page[] = [
  { href: "index.html", name: "WebGPU-demo-UBS", text: "La presse WebGPU : le guide et la démo", groupe: "docs", mots: ["pli", "accueil", "guide"] },
  { href: "sampler.html", name: "Sampler", text: "Un effet à la fois, par catégories", groupe: "outils", court: "Sampler PLI", mots: ["pli"] },
  { href: "sampler-presse.html", name: "Sampler Presse", text: "Les effets du registre : filtres par catégorie, rendu et statut, recherche, lien vers le Studio", groupe: "outils", mots: ["catalogue", "registre"] },
  { href: "studio-effet.html", name: "Studio · effet", text: "Régler un effet en direct : inspecteur généré, courbes, attributs, HTML, JSON, lien de partage", groupe: "studio", court: "Studio d'effet", mots: ["inspecteur", "réglages"] },
  { href: "liquide.html", name: "Liquide", text: "Glisser, mélanger, filtrer : des photos en verre qui fusionne", groupe: "effets" },
  { href: "grille.html", name: "Grille infinie", text: "Un mur sans fin ; chaque photo ouvre sa page, l'image vole", groupe: "interfaces" },
  { href: "galerie.html", name: "Galerie", text: "Dix arrangements 3D : tonneau, cartes, film, ruban, fond dégradé…", groupe: "interfaces" },
  { href: "orbite.html", name: "Orbite", text: "Un lanceur : quatre applications en anneau, des particules, la mise au point", groupe: "interfaces" },
  { href: "matieres.html", name: "Matières", text: "Paillettes qu'on brosse, lettres en eau, éclair et feu, diagramme de phase", groupe: "effets" },
  { href: "tissu.html", name: "Tissu", text: "Le HTML de la page imprimé sur une étoffe simulée en WebGPU : on la tire, on la décroche", groupe: "labs", mots: ["html-in-canvas", "étoffe"] },
  { href: "lave.html", name: "Lave", text: "Une liste de tâches qu'on range au glisser ; jetée dans la lave, la tâche brûle dans un feu simulé", groupe: "labs", mots: ["feu"] },
  { href: "defilement.html", name: "Défilement", text: "Roue de projets, mots qui roulent, liste qui s'ouvre, images au bruit, bento", groupe: "interfaces", mots: ["scroll"] },
  { href: "fluide.html", name: "Fluide", text: "Un fluide SPH qu'on remue : champ de particules, bassin, marbrure d'encres", groupe: "labs", mots: ["sph"] },
  { href: "atelier.html", name: "Atelier", text: "Un objet 3D en ASCII, tramé, à l'encre, en verre, en particules, en liquide", groupe: "effets", mots: ["ascii", "3d"] },
  { href: "presse.html", name: "Presse", text: "Le framework : un Webflow WebGPU, en attributs HTML", groupe: "docs", mots: ["documentation", "attributs"] },
  { href: "createur.html", name: "Créateur", text: "Composer un site Presse par blocs, aperçu WebGPU en direct, export", groupe: "studio", court: "Site", mots: ["éditeur", "site"] },
  { href: "courbes.html", name: "Courbes", text: "Éditeur de courbe : poignées, ressort, marches, comparaison de quatre courbes", groupe: "studio", mots: ["ease", "bezier", "ressort"] },
  { href: "variations.html", name: "Variations", text: "Des directions artistiques tirées en quelques secondes sur la même page : jetons, verrous, instantanés, export", groupe: "outils", mots: ["système", "thème", "jetons"] },
  { href: "kerguehennec.html", name: "Kerguéhennec, 1910", text: "Théâtre de papier, menu de cinq tableaux", groupe: "sites" },
  { href: "kerguehennec-styles.html", name: "Huit regards", text: "Le domaine en 3D, rendu de huit façons", groupe: "sites", mots: ["kerguéhennec"] },
  { href: "conference.html", name: "Conférence", text: "Un diaporama Presse : la 3D et l'IA, au clavier (F plein écran, P présentateur)", groupe: "sites", mots: ["diaporama"] },
  { href: "diapo-demos.html", name: "Diaporama · démos", text: "Transitions à deux images, Magic Move, mot à mot, chiffres, laser et loupe", groupe: "sites" },
  { href: "goo.html", name: "Goo", text: "Des pièces d'interface qui fusionnent comme une pâte : menu en gouttes, onglets, goutte suiveuse", groupe: "interfaces" },
  { href: "metal.html", name: "Métal", text: "Boutons, lettres et badges en chrome liquide, cinq métaux, reflet sur le voisin", groupe: "effets", mots: ["chrome"] },
  { href: "voix.html", name: "La voix", text: "Une lueur qui monte avec la voix sous un champ de saisie, puis balaie pendant la réponse", groupe: "interfaces", mots: ["micro"] },
  { href: "ruban.html", name: "Ruban", text: "Une bande d'images qui se vrille, se comprime, se bombe ; une lentille qui passe ; une roue de vignettes", groupe: "effets" },
  { href: "typo.html", name: "Typographie", text: "Six entrées de texte : étirement, sphère, encre, tracé, éclats, fragments", groupe: "effets" },
  { href: "cinetique.html", name: "Cinétique", text: "Texte animé en DOM : 18 entrées par ligne, mot ou lettre, et huit composants (roule, marque, défilé, reflet, cercle, coupe, brouille, frappe)", groupe: "effets" },
  { href: "rouleau.html", name: "Rouleau", text: "Menu roulant : les titres défilent, l'image ondule derrière comme une étoffe", groupe: "interfaces" },
  { href: "couloir.html", name: "Couloir", text: "Un mur d'images vu en fuite : il défile au pointeur, frange de couleur à la vitesse, réglable en direct", groupe: "effets" },
  { href: "logos.html", name: "Logos", text: "Une matière animée pour un logo : métal liquide, fumée, chaleur, eau, verre, trames ; PNG, séquence, WebM", groupe: "outils" },
  { href: "boutique.html", name: "Boutique", text: "Éclaircie, boutique de vêtements d'essai : déchirure, forme-masque, autocollant, rails, panier", groupe: "sites", mots: ["éclaircie", "panier"] },
  { href: "vitrine.html", name: "Vitrine", text: "Éditeur de boutique par sections : 50 variantes réglables, quatre préréglages, aperçu bureau et téléphone, export", groupe: "studio", court: "Boutique", mots: ["éditeur", "boutique"] },
  { href: "vitrine-maison.html", name: "Boutiques · Maison", text: "Luxe sobre : hero vidéo, bouton Menu, huit univers, grille compacte détourée", groupe: "sites" },
  { href: "vitrine-district.html", name: "Boutiques · District", text: "Mode contemporaine : mega-menus, diaporama, badges, stock, achat rapide, avis", groupe: "sites" },
  { href: "vitrine-tribus.html", name: "Boutiques · Tribus", text: "Artisanal : deux visuels, acheter par tissu, histoire, lookbook, lettre −10 %", groupe: "sites" },
  { href: "diapo-createur.html", name: "Créateur de diaporama", text: "Ordre des diapos, transitions, apparitions, textes et notes, avec l'aperçu WebGPU", groupe: "studio", court: "Diaporama", mots: ["éditeur", "powerpoint", "pptx"] },
  { href: "legacy/index.html", name: "WebGPU-demo-UBS v0", text: "La toute première version, générée par Grok", groupe: "docs", court: "PLI v0 (archive)" },
];

/** Pages construites mais hors menu : des cadres internes, ouverts par un éditeur. */
export const EXCLUES: Readonly<Record<string, string>> = {
  "createur-apercu.html": "cadre d'aperçu du Créateur",
  "createur-site.html": "page de site rendue dans le Créateur (gabarit d'export)",
  "vitrine-apercu.html": "cadre d'aperçu de Vitrine",
  "studio-apercu.html": "cadre d'aperçu du Studio d'effet",
};

/** L'ordre des éditeurs dans le groupe Studio (nom court affiché). */
const ORDRE_STUDIO = ["createur.html", "vitrine.html", "diapo-createur.html", "courbes.html", "studio-effet.html"];

export const NOMS_CATEGORIES: Readonly<Record<Categorie, string>> = { texte: "Texte", image: "Image", matiere: "Matière", interface: "Interface", transition: "Transition", forme: "Forme", dessin: "Dessin", page: "Page" };
const ORDRE_CATEGORIES: readonly Categorie[] = ["texte", "image", "matiere", "transition", "forme", "dessin", "page"];

/** Une ligne du méga-menu ou de la palette. */
export type Entree = {
  /** Unique : « page:goo.html », « effet:goo ». */
  id: string;
  nom: string;
  texte: string;
  /** Depuis la racine du site. */
  href: string;
  groupe: GroupeId;
  /** La page du dépôt (pour aria-current), sans requête. */
  page: string;
  /** Lien secondaire « ouvrir dans le Studio » (effet réglable). */
  studio?: string;
  effet?: string;
  mots: readonly string[];
};
export type Section = { id: string; nom: string; entrees: Entree[] };
export type Groupe = { id: GroupeId; nom: string; resume: string; sections: Section[] };

const versEntreePage = (p: Page): Entree => ({
  id: `page:${p.href}`,
  nom: p.court ?? p.name,
  texte: p.text,
  href: p.href,
  groupe: p.groupe,
  page: p.href,
  mots: [p.name, ...(p.mots ?? []), p.href.replace(/\.html$/, "")],
});

/** Un effet du registre : vers sa page d'exemple, sinon vers le Studio ; lien Studio en plus s'il est réglable. */
export function versEntreeEffet(m: Pick<Manifeste, "id" | "nom" | "categorie" | "resume" | "exemple" | "attributs"> & { parametres?: unknown }): Entree {
  const studio = m.parametres ? `studio-effet.html?effet=${m.id}` : undefined;
  const href = m.exemple ?? studio ?? "sampler-presse.html";
  return {
    id: `effet:${m.id}`,
    nom: m.nom,
    texte: m.resume,
    href,
    groupe: m.categorie === "interface" ? "interfaces" : "effets",
    page: href.split("?")[0]!,
    studio,
    effet: m.id,
    mots: [m.id, NOMS_CATEGORIES[m.categorie], ...m.attributs.slice(0, 3)],
  };
}

/**
 * La taxonomie complète, pour le méga-menu : sept groupes, chacun en sections. Effets et Interfaces : une section par
 * catégorie du registre (ses effets), puis « Démos » : les pages du groupe qui ne sont l'exemple d'aucun effet listé.
 */
export function construireTaxonomie(pages: readonly Page[] = PAGES, effets: readonly Pick<Manifeste, "id" | "nom" | "categorie" | "resume" | "exemple" | "attributs" | "parametres">[] = EFFETS): Groupe[] {
  return GROUPES.map((g) => {
    const lesPages = pages.filter((p) => p.groupe === g.id);
    const sections: Section[] = [];
    if (g.id === "studio") {
      const rang = (p: Page) => (ORDRE_STUDIO.indexOf(p.href) + 1 || 99);
      sections.push({ id: "studio", nom: "Éditeurs", entrees: [...lesPages].sort((a, b) => rang(a) - rang(b)).map(versEntreePage) });
    } else if (g.id === "effets" || g.id === "interfaces") {
      const cats = g.id === "effets" ? ORDRE_CATEGORIES : (["interface"] as const);
      const couvertes = new Set<string>();
      for (const c of cats) {
        const es = effets.filter((e) => e.categorie === c).map(versEntreeEffet);
        if (!es.length) continue;
        for (const e of es) couvertes.add(e.page);
        sections.push({ id: `categorie:${c}`, nom: NOMS_CATEGORIES[c], entrees: es });
      }
      const demos = lesPages.filter((p) => !couvertes.has(p.href)).map(versEntreePage);
      if (demos.length) sections.push({ id: `${g.id}:demos`, nom: "Démos", entrees: demos });
    } else {
      sections.push({ id: g.id, nom: g.nom, entrees: lesPages.map(versEntreePage) });
    }
    return { id: g.id, nom: g.nom, resume: g.resume, sections };
  });
}

/** Toutes les entrées, à plat (palette) : pages d'abord, puis effets ; sans doublon d'identifiant. */
export function entreesAPlat(pages: readonly Page[] = PAGES, effets: readonly Manifeste<any>[] = EFFETS): Entree[] {
  const vues = new Set<string>();
  const out: Entree[] = [];
  for (const e of [...pages.map(versEntreePage), ...effets.map(versEntreeEffet)]) {
    if (vues.has(e.id)) continue;
    vues.add(e.id);
    out.push(e);
  }
  return out;
}

/** La page précédente / suivante dans l'ordre de `PAGES` (hors archive), en boucle. */
export function voisine(ici: string, d: 1 | -1, pages: readonly Page[] = PAGES): Page {
  const liste = pages.filter((p) => !p.href.startsWith("legacy/"));
  const i = liste.findIndex((p) => p.href === ici);
  return liste[((i < 0 ? (d > 0 ? -1 : 0) : i) + d + liste.length) % liste.length]!;
}
