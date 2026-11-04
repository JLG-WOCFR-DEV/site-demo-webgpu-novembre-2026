/**
 * Créateur — modèles de départ. Chacun montre une façon d'employer le kit : un portfolio photo, un studio, un
 * lancement. Construits avec makeBlock : de nouveaux identifiants à chaque fois.
 */
import { DEFAULT_PAGE, PHOTOS, makeBlock, makePage, photo, type Block, type Site } from "./model.ts";

const p = (src: string) => ({ src, alt: photo(src)!.alt, title: photo(src)!.title, cat: photo(src)!.cat, body: "" });

export type Template = { id: string; label: string; desc: string; make: () => Site };

/** Un site d'une page (l'accueil). */
const one = (name: string, page: Site["page"], blocks: Block[]): Site => ({ v: 2, name, page, pages: [makePage(page.title, "index", blocks)] });

/** Une page de projet : la photo de la carte d'accueil y atterrit (même photo), le titre aussi. */
export function projectPage(o: { title: string; slug: string; src: string; kicker?: string; body?: string; brand: string; others?: { title: string; slug: string; src: string }[]; dark?: boolean }) {
  const ph = photo(o.src)!;
  return makePage(o.title, o.slug, [
    makeBlock("nav", { brand: o.brand, cta: "", sticky: true }, [
      { label: "Accueil", href: "./index.html" },
      { label: "Projets", href: "./index.html#travaux" },
    ]),
    makeBlock("hero", { kicker: o.kicker ?? "Projet", title: o.title, lede: "", cta: "", cta2: "", size: "l", height: "auto", kinetic: "", stage: "" }),
    makeBlock("image", { src: o.src, alt: ph.alt, caption: "", width: "contenue", ratio: "", material: "", reveal: "", hover: "", space: "serre" }),
    makeBlock("texte", { kicker: "", title: "Le projet", body: o.body ?? "Racontez ici le projet : le lieu, la lumière, ce qui a été fait.\n\nUne ligne vide fait un nouveau paragraphe.", layout: "cote", rule: true }),
    ...(o.others?.length
      ? [makeBlock("projets", { kicker: "Suite", title: "Autres projets", cols: Math.min(3, o.others.length), anchor: "" }, o.others.map((x) => ({ src: x.src, title: x.title, text: "", page: `./${x.slug}.html`, alt: photo(x.src)!.alt })))]
      : []),
    makeBlock("pied", { brand: o.brand, legal: `© 2026 ${o.brand}` }, [{ label: "Accueil", href: "./index.html" }]),
  ]);
}

export const TEMPLATES: Template[] = [
  {
    id: "studio",
    label: "Studio",
    desc: "Agence de création : ouverture cinétique, cartes à matières, objet en verre, feu, appel en flammes",
    make: () =>
      one("Atelier Nord", { ...DEFAULT_PAGE }, [
        makeBlock("nav"),
        makeBlock("hero"),
        makeBlock("bandeau"),
        makeBlock("texte", { anchor: "studio" }),
        makeBlock("cartes"),
        makeBlock("objet"),
        makeBlock("galerie"),
        makeBlock("chiffres"),
        makeBlock("matiere", { side: "droite" }),
        makeBlock("appel"),
        makeBlock("pied"),
      ]),
  },
  {
    id: "portfolio",
    label: "Portfolio photo",
    desc: "Quatre pages, nuit, Didone : chaque projet a sa page, la photo et le titre y volent depuis l'accueil",
    make: () => {
      const brand = "Lumière rasante";
      const page = { ...DEFAULT_PAGE, title: brand, description: "Photographies, 2024–2026.", palette: "nuit", type: "didone", look: "argentique", transition: "revelateur", effects: ["loupe", "bloom", "grain"] };
      const projects = [
        { title: "Le pont", slug: "le-pont", src: "./plates/pont.jpg", body: "Le Golden Gate depuis la côte, à marée haute : l'écume au pied de la falaise, le pont dans la brume qui se lève." },
        { title: "Yosemite", slug: "yosemite", src: "./plates/yosemite.jpg", body: "La vallée vue d'en haut, au petit matin : parois de granit, une cascade, la brume au fond." },
        { title: "Le jardin", slug: "le-jardin", src: "./plates/jardin.jpg", body: "Un jardin japonais au printemps : azalées rouges, lanterne de pierre, maison de thé sous les pins." },
      ];
      const home = makePage(brand, "index", [
        makeBlock("nav", { brand, cta: "", sticky: true }, [
          { label: "Projets", href: "#travaux" },
          { label: "Le mur", href: "#mur" },
          { label: "À propos", href: "#apropos" },
        ]),
        makeBlock("hero", { kicker: "Photographies · 2024–2026", title: "Lumière\nrasante", lede: "Des paysages de la côte Ouest, tirés comme des épreuves. Ouvrez un projet : la photo vous suit.", cta: "", cta2: "", size: "xxl", kinetic: "vague", height: "ecran" }),
        makeBlock("projets", { kicker: "Projets", title: "Trois séries", anchor: "travaux", cols: 3 }, projects.map((x) => ({ src: x.src, title: x.title, text: x.body.split(" : ")[0]!.split(",")[0]!, page: `./${x.slug}.html`, alt: photo(x.src)!.alt }))),
        makeBlock("epingle", { src: "./plates/alcatraz.jpg", alt: photo("./plates/alcatraz.jpg")!.alt, words: "Une île, une seule lumière." }),
        makeBlock("duo", { kicker: "À propos", title: "Tirer comme autrefois", body: "Chaque photo est un plan GPU : au survol, elle se bombe sous le doigt comme un tirage qu'on soulève.", src: "./plates/cerf.jpg", alt: photo("./plates/cerf.jpg")!.alt, material: "", hover: "deplacement", reveal: "dissolution", ratio: "3/2", anchor: "apropos", side: "gauche" }),
        makeBlock("mur", { title: "Le mur", anchor: "mur" }, PHOTOS.slice(0, 10).map((x) => p(x.src))),
        makeBlock("citation", { quote: "« La lumière rasante dit la forme mieux que la lumière de midi. »", by: "Carnet, 2025", align: "centre" }),
        makeBlock("pied", { brand, legal: "© 2026 · Tirages sur demande." }),
      ]);
      const pages = projects.map((x) => projectPage({ ...x, kicker: "Série", brand, others: projects.filter((o) => o !== x) }));
      return { v: 2, name: brand, page, pages: [home, ...pages] };
    },
  },
  {
    id: "lancement",
    label: "Lancement",
    desc: "Produit, technique : typo étroite, éclair, verre, chiffres, fond de flammes",
    make: () =>
      one("Volt", { ...DEFAULT_PAGE, title: "Volt — le moteur", description: "Un moteur de rendu WebGPU pour le web éditorial.", palette: "encre", type: "technique", look: "nuit", transition: "trame", effects: ["loupe", "rvb", "bloom", "grain"], width: "large", radius: 4 }, [
        makeBlock("nav", { brand: "VOLT", cta: "Accès anticipé", ctaHref: "#acces" }, [
          { label: "Moteur", href: "#moteur" },
          { label: "Chiffres", href: "#chiffres" },
        ]),
        makeBlock("hero", { kicker: "Version 1.0 · novembre 2026", title: "Le web, imprimé par le GPU", lede: "Un canvas, toute la page, soixante images par seconde — et le HTML reste la source de vérité.", cta: "Accès anticipé", ctaHref: "#acces", cta2: "La doc", fire: true, kinetic: "contour", size: "xl" }),
        makeBlock("matiere", { kind: "eclair", word: "VOLT", kicker: "Énergie", title: "Foudre générée", body: "Point milieu, branches, arcs en retour ; HDR et halo. Chaque décharge est nouvelle.", anchor: "moteur", ratio: "4/3" }),
        makeBlock("chiffres", { kicker: "Mesuré", title: "Ce que coûte une page", anchor: "chiffres" }, [
          { value: "2,5 ms", label: "pour capturer la page entière" },
          { value: "−81 %", label: "d'octets d'images, AVIF et mips" },
          { value: "1", label: "appel de dessin par galerie" },
        ]),
        makeBlock("objet", { style: "particules", model: "dragon", kicker: "Calcul", title: "60 000 particules", body: "Une passe de calcul, des ressorts que le pointeur chasse.", side: "droite" }),
        makeBlock("cinetique", { lines: "Rapide\nNet\nLisible", mode: "mixte", size: "xxl" }),
        makeBlock("appel", { kicker: "Accès anticipé", title: "Essayez-le sur votre site.", cta: "Demander l'accès", stage: "flammes", fire: false, anchor: "acces" }),
        makeBlock("pied", { brand: "VOLT", legal: "© 2026 Volt · Sans WebGPU, la page reste son HTML." }),
      ]),
  },
  {
    id: "vide",
    label: "Page vide",
    desc: "Une ouverture et un pied ; à vous de composer",
    make: () => one("Nouveau site", { ...DEFAULT_PAGE, title: "Nouveau site" }, [makeBlock("hero", { kicker: "", lede: "", cta: "", cta2: "", title: "Titre du site", kinetic: "", height: "auto" }), makeBlock("pied", { brand: "Nouveau site" }, [])]),
  },
];
