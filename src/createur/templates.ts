/**
 * Créateur — modèles de départ. Chacun montre une façon d'employer le kit : un portfolio photo, un studio, un
 * lancement. Construits avec makeBlock : de nouveaux identifiants à chaque fois.
 */
import { DEFAULT_PAGE, PHOTOS, makeBlock, photo, type Site } from "./model.ts";

const p = (src: string) => ({ src, alt: photo(src)!.alt, title: photo(src)!.title, cat: photo(src)!.cat, body: "" });

export type Template = { id: string; label: string; desc: string; make: () => Site };

export const TEMPLATES: Template[] = [
  {
    id: "studio",
    label: "Studio",
    desc: "Agence de création : ouverture cinétique, cartes à matières, objet en verre, feu, appel en flammes",
    make: () => ({
      v: 1,
      name: "Atelier Nord",
      page: { ...DEFAULT_PAGE },
      blocks: [
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
      ],
    }),
  },
  {
    id: "portfolio",
    label: "Portfolio photo",
    desc: "Nuit, Didone : une photo épinglée, la galerie en tonneau, le mur infini, un duo",
    make: () => ({
      v: 1,
      name: "Lumière rasante",
      page: { ...DEFAULT_PAGE, title: "Lumière rasante", description: "Photographies, 2024–2026.", palette: "nuit", type: "didone", look: "argentique", transition: "revelateur", effects: ["loupe", "bloom", "grain"] },
      blocks: [
        makeBlock("nav", { brand: "Lumière rasante", cta: "", sticky: true }, [
          { label: "Séries", href: "#series" },
          { label: "Le mur", href: "#mur" },
          { label: "À propos", href: "#apropos" },
        ]),
        makeBlock("hero", { kicker: "Photographies · 2024–2026", title: "Lumière\nrasante", lede: "Des paysages de la côte Ouest, tirés comme des épreuves : chaque image entre par un révélateur.", cta: "", cta2: "", size: "xxl", kinetic: "vague", height: "ecran" }),
        makeBlock("epingle", { src: "./plates/yosemite.jpg", alt: photo("./plates/yosemite.jpg")!.alt, words: "Une vallée, une seule lumière." }),
        makeBlock("galerie", { kicker: "Séries", title: "La côte, l'eau, la pierre", arrange: "barrel", selection: "detail", anchor: "series" }, [p("./plates/pont.jpg"), p("./plates/alcatraz.jpg"), p("./plates/lac.jpg"), p("./plates/dunes.jpg"), p("./plates/cerf.jpg"), p("./plates/jardin.jpg"), p("./plates/yosemite.jpg")]),
        makeBlock("duo", { kicker: "À propos", title: "Tirer comme autrefois", body: "Chaque photo est un plan GPU : au survol, elle se bombe sous le doigt comme un tirage qu'on soulève.", src: "./plates/cerf.jpg", alt: photo("./plates/cerf.jpg")!.alt, material: "", hover: "deplacement", reveal: "dissolution", ratio: "3/2", anchor: "apropos", side: "gauche" }),
        makeBlock("mur", { title: "Le mur", anchor: "mur" }, PHOTOS.slice(0, 10).map((x) => p(x.src))),
        makeBlock("citation", { quote: "« La lumière rasante dit la forme mieux que la lumière de midi. »", by: "Carnet, 2025", align: "centre" }),
        makeBlock("pied", { brand: "Lumière rasante", legal: "© 2026 · Tirages sur demande." }),
      ],
    }),
  },
  {
    id: "lancement",
    label: "Lancement",
    desc: "Produit, technique : typo étroite, éclair, verre, chiffres, fond de flammes",
    make: () => ({
      v: 1,
      name: "Volt",
      page: { ...DEFAULT_PAGE, title: "Volt — le moteur", description: "Un moteur de rendu WebGPU pour le web éditorial.", palette: "encre", type: "technique", look: "nuit", transition: "trame", effects: ["loupe", "rvb", "bloom", "grain"], width: "large", radius: 4 },
      blocks: [
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
      ],
    }),
  },
  {
    id: "vide",
    label: "Page vide",
    desc: "Une ouverture et un pied ; à vous de composer",
    make: () => ({ v: 1, name: "Nouveau site", page: { ...DEFAULT_PAGE, title: "Nouveau site" }, blocks: [makeBlock("hero", { kicker: "", lede: "", cta: "", cta2: "", title: "Titre du site", kinetic: "", height: "auto" }), makeBlock("pied", { brand: "Nouveau site" }, [])] }),
  },
];
