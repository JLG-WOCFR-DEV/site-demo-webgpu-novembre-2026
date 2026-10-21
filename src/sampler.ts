import "./main.ts";
import { openMenu } from "./menu.ts";
import { EXPLORE_EFFECTS } from "./sampler-catalog.ts";
import { resetExploreClock } from "./sampler-runtime.ts";
import { motion, settings } from "./state.ts";

/**
 * Le sampler : un effet à la fois. Chaque échantillon remet la page à zéro
 * (chaîne coupée, pas d'impression, pas de grain), puis n'active que lui sur
 * un spécimen fixe : le même titre, le même texte, la même photo.
 * « Dans le contexte » rallume la chaîne complète pour comparer.
 */

type Photo = "fig" | "glass" | "fluid" | "none";
type ExploreEffect = (typeof EXPLORE_EFFECTS)[number];
type Sample = {
  id: string;
  label: string;
  text: string;
  stage?: string;
  photo?: Photo;
  blocks?: string[];
  forms?: string[];
  /** Matière posée par attribut (data-gl-material) sur les éléments visés. */
  material?: { sel: string; name: string };
  patch?: () => void;
  action?: { label: string; run: () => void };
  explore?: ExploreEffect;
};
type Category = { id: string; name: string; intro: string; samples: Sample[] };

const TRANSITIONS = ["Impression", "Trame", "Quadrichromie", "Buvard", "Massicot", "Fondu", "Rouleau", "Composition", "Ligne à ligne", "Révélateur", "Pli", "Aucune"];
const TRANSITION_TEXT = [
  "Un front d'encre irrégulier, plus sombre là où l'encre est encore humide.",
  "Des points de trame qui grossissent jusqu'à se toucher, puis l'aplat.",
  "Le jaune, puis le magenta, puis le cyan : des épreuves progressives.",
  "L'encre gagne par taches, avec un halo plus sombre.",
  "Une coupe nette, en biais, sans bavure.",
  "Un dégradé d'opacité : ce que ferait une transition CSS, pour comparer.",
  "Les stries d'un rouleau peu chargé ; son ombre passe devant l'encre.",
  "Des blocs de plomb posés un à un, au hasard dans la ligne.",
  "Comme une linotype : chaque ligne se compose de gauche à droite derrière un curseur.",
  "Comme une épreuve dans le bain : les noirs montent d'abord, le rouge traîne.",
  "La feuille se déplie, avec l'ombre au creux du pli.",
  "Rien : la page est imprimée d'avance. Le point de comparaison.",
];
const FILTERS = [
  ["Trame noire", "Une grille de points dont la taille porte la valeur."],
  ["Tramage riso", "Un tramage ordonné de Bayer, en deux encres de risographe."],
  ["Verre cannelé", "Des cannelures verticales qui réfractent ce qui est derrière."],
  ["Lentille", "Une distorsion en barillet sous le pointeur, avec aberration chromatique."],
  ["Papier froissé", "Un relief de bruit éclairé de biais, multiplié sur l'image."],
  ["Casse de plomb", "Chaque cellule devient le caractère dont la noirceur lui correspond : de l'ASCII typographique."],
];
const SOURCES = [
  ["Dégradé maillé", "Cinq taches de couleur qui dérivent, mêlées à travers un champ déformé."],
  ["Encre marbrée", "Du bruit replié sur lui-même : trois encres sur papier."],
  ["Ondes", "Deux sources qui interfèrent, en courbes de niveau."],
  ["Métaballes", "Des gouttes de mercure qui se rejoignent, éclairées."],
];
const MATTERS = [
  ["flammes", "Flammes", "Le feu monte du pied de la plaque, en HDR avant le bloom ; l'air ondule, la fumée voile le haut."],
  ["nuages", "Brume", "Un voile qui floute et dévie le texte. Passez le pointeur : il s'écarte, puis revient."],
  ["toile", "Toile", "Le contenu peint sur une toile de lin. Tirez la peinture avec le pointeur."],
  ["gouttes", "Gouttes", "Buée, gouttes-lentilles, gouttes qui coulent. Le pointeur essuie la vitre."],
  ["givre", "Givre", "Une vitre gelée. Gardez le pointeur dessus : elle fond, puis regèle."],
];
const MENUS = [
  ["leporello", "Leporello", "Un dépliant en accordéon : plis alternés, creux assombris."],
  ["index", "Index", "De grands titres ; l'épreuve s'imprime avec la transition choisie."],
  ["ramette", "Ramette", "Une pile de feuilles : la première s'envole, puis revient se poser."],
  ["planche", "Planche contact", "Des vues de pellicule, un cercle au crayon gras."],
  ["nuancier", "Nuancier", "Des bandes rivetées qui pivotent en éventail."],
  ["bande", "Bande", "Une bande sans fin ; la vitesse décale les plaques de couleur."],
  ["rotative", "Rotative", "Des feuilles sur un cylindre à facettes."],
  ["galerie", "Galerie", "Des feuilles suspendues dans la profondeur."],
  ["salle", "Salle", "Au centre d'une pièce ronde : les feuilles tournent autour de vous."],
];
const VISIONS = ["Protanopie", "Deutéranopie", "Tritanopie", "Achromatopsie"];

const radio = (name: string, value: string) => {
  const r = document.querySelector<HTMLInputElement>(`input[name='${name}'][value='${value}']`);
  if (!r) return;
  r.checked = true;
  r.dispatchEvent(new Event("change", { bubbles: true }));
};
const openSommaire = (style: string, screen = "0") => {
  radio("menu-style", style);
  radio("menu-screen", screen);
  openMenu(document.querySelector<HTMLElement>("[data-sp-action]") ?? undefined);
};

const CATS: Category[] = [
  {
    id: "explores",
    name: "Effets explorés",
    intro: "Douze études WebGPU sur les mêmes photographies. Choisissez un effet, dosez-le, puis comparez. Chaque étude commence sur une image fixe ; les effets animés se lancent à votre demande.",
    samples: EXPLORE_EFFECTS.map((effect) => ({
      id: `explore-${effect.id}`,
      label: effect.name,
      text: effect.description,
      stage: "explore",
      photo: "fig",
      forms: ["explore"],
      blocks: ["hic"],
      explore: effect,
      patch: () => resetExplorePreset(effect),
    })),
  },
  {
    id: "transitions",
    name: "Transitions",
    intro: "Le front d'impression, style par style. Seule l'impression est active ; le spécimen se réimprime à chaque choix.",
    samples: TRANSITIONS.map((label, i) => ({
      id: `transition-${i}`,
      label,
      text: TRANSITION_TEXT[i]!,
      // La chaîne aussi : on combine l'impression avec le repérage au défilement, le grain ou le bloom.
      forms: ["transition", "chain"],
      patch: () => {
        settings.chain.print = true;
        settings.transition.style = i;
      },
      action: { label: "Rejouer", run: replay },
    })),
  },
  {
    id: "filtres",
    name: "Filtres d'image",
    intro: "Les filtres de la passe composite, sur le texte et la photo du spécimen.",
    samples: FILTERS.map(([label, text], i) => ({
      id: `filtre-${i}`,
      label: label!,
      text: text!,
      stage: "filtre",
      forms: ["filter"],
      patch: () => {
        settings.filter.kind = i;
      },
    })),
  },
  {
    id: "sources",
    name: "Sources animées",
    intro: "Des shaders animés à la place de la photo, sans filtre. Posez un filtre dessus depuis la catégorie précédente.",
    samples: SOURCES.map(([label, text], i) => ({
      id: `source-${i + 1}`,
      label: label!,
      text: text!,
      patch: () => {
        settings.filter.source = i + 1;
      },
    })),
  },
  {
    id: "matieres",
    name: "Matières",
    intro: "Des matières sur du HTML vivant : le texte reste dans le DOM, sélectionnable.",
    samples: [
      ...MATTERS.map(([stage, label, text]) => ({ id: `matiere-${stage}`, label: label!, text: text!, stage, forms: ["matter"] })),
      {
        id: "matiere-enveloppe",
        label: "Enveloppe de feu",
        text: "Une bordure de flammes autour d'un vrai bouton, peint par le DOM. Plus vive au survol.",
        blocks: ["wrap"],
        forms: ["matter"],
      },
    ],
  },
  {
    id: "plans",
    name: "Plans et images",
    intro: "Une photo est un rectangle dessiné par fonctions de distance : coins, ombre, élévation, décollement, calques.",
    samples: [
      { id: "plan-sdf", label: "Coins, ombre, élévation", text: "Coins arrondis et ombre portée calculés pixel par pixel ; survolez pour soulever le plan.", forms: ["quad"] },
      { id: "plan-wire", label: "Les deux triangles", text: "Un plan n'est que deux triangles, générés dans le vertex shader.", forms: ["quad"], patch: () => (settings.quad.wire = true) },
      { id: "plan-peel", label: "Décollement", text: "La partie proche du coin s'enroule sur un cylindre ; dessous, la plaque offset en négatif.", forms: ["quad"], patch: () => (settings.quad.peel = 0.55) },
      { id: "plan-calques", label: "Calques et fusion", text: "Trois calques et leurs modes de fusion, évalués par le shader.", photo: "none", blocks: ["layers"], forms: ["layers"] },
    ],
  },
  {
    id: "chaine",
    name: "Chaîne de rendu",
    intro: "Les passes après la scène, une par une. « Dans le contexte » les rallume toutes.",
    samples: [
      { id: "chaine-bloom", label: "Bloom", text: "Seules les vraies hautes lumières débordent : le reflet sur le verre.", photo: "glass", forms: ["light"], patch: () => (settings.chain.bloom = true) },
      {
        id: "chaine-grain",
        label: "Grain et fibre",
        text: "Un bruit animé d'un pas de pixel, et une fibre lente sur le papier. Au dosage réel, on ne le voit pas : il casse les dégradés en marches du rendu 8 bits et ôte au papier son aspect d'aplat numérique. La loupe le grossit ; à gauche du pointeur, la page sans lui.",
        forms: ["grain", "chain"],
        patch: () => {
          Object.assign(settings.chain, { grain: true, split: true });
          settings.grain.amp = 6;
          settings.filter.source = 1;
        },
      },
      { id: "chaine-rvb", label: "Repérage au défilement", text: "L'aberration chromatique du défilement : faites défiler vite, les plaques rouge, verte et bleue glissent comme une feuille qui file sous les rouleaux.", forms: ["chain"], patch: () => (settings.chain.rgb = true) },
      { id: "chaine-trame", label: "Trame CMJN", text: "Quatre grilles de points tournées, une par encre, superposées par soustraction.", stage: "trame", forms: ["trame"], patch: () => (settings.chain.trame = true) },
      {
        id: "chaine-split",
        label: "Brut et composite",
        text: "Ce que la scène a dessiné, à gauche du pointeur, et ce qui sort de la chaîne, à droite. Bougez le pointeur sur la photo : la trame, le bloom, le grain et la vision n'existent qu'à droite. C'est l'outil pour savoir quelle passe fait quoi.",
        stage: "trame",
        forms: ["chain", "trame"],
        patch: () => Object.assign(settings.chain, { rgb: true, bloom: true, grain: true, trame: true, split: true }),
      },
    ],
  },
  {
    id: "papier",
    name: "Papier",
    intro: "Trois idées tirées de Paper Shaders sur Codrops : les shaders ne restent pas dans un fond, ils touchent les éléments de la page, posés par un simple attribut HTML.",
    samples: [
      {
        id: "papier-froisse",
        label: "Page froissée",
        text: "Passez le pointeur vite sur la page : elle se plie autour de lui, texte et images compris, puis se défroisse lentement. Les plis tiennent au papier : ils défilent avec lui.",
        forms: ["crease"],
        patch: () => (settings.crease.on = true),
      },
      {
        id: "papier-dechirure",
        label: "Bords déchirés",
        text: "Chaque planche commence par une déchirure qui ondule. Elle s'ouvre quand on défile vite et se tord vers le pointeur. Faites défiler.",
        forms: ["tear"],
        material: { sel: ".sp-page", name: "dechirure" },
      },
      {
        id: "papier-lentille",
        label: "Loupe au survol",
        text: "Une loupe discrète sur chaque photo : son centre suit le pointeur avec retard et elle ne s'allume qu'au survol. Discrète, elle passe pour du verre ; forte, pour un filtre.",
        forms: ["lens"],
        material: { sel: "[data-sp-stage] .sp-plate, .sp-page-plate", name: "lentille" },
      },
    ],
  },
  {
    id: "texte",
    name: "Texte",
    intro: "Le texte est lu sur le DOM et redessiné par le GPU, glyphe par glyphe.",
    samples: [
      { id: "texte-atlas", label: "Atlas SDF", text: "Chaque caractère dessiné une fois dans un atlas de distances signées.", photo: "none", blocks: ["type"], forms: ["glyph"], patch: () => (settings.glyph.atlas = true) },
      { id: "texte-onde", label: "Onde", text: "Les lettres ondulent, chacune avec son décalage.", photo: "none", blocks: ["type"], forms: ["glyph"], patch: () => (settings.glyph.wave = 0.7) },
      { id: "texte-encre", label: "Encre", text: "Le seuil du champ de distance : la lettre engraisse ou maigrit.", photo: "none", blocks: ["type"], forms: ["glyph"], patch: () => (settings.glyph.ink = 0.6) },
      { id: "texte-dispersion", label: "Dispersion", text: "Les glyphes s'écartent et tournent.", photo: "none", blocks: ["type"], forms: ["glyph"], patch: () => (settings.glyph.scatter = 0.5) },
      { id: "texte-ressorts", label: "Lettres à ressorts", text: "Une passe de calcul fait de chaque lettre un ressort amorti : passez le pointeur.", photo: "none", blocks: ["hero"] },
    ],
  },
  {
    id: "calcul",
    name: "Calcul",
    intro: "Des passes de calcul : le GPU simule, puis dessine.",
    samples: [
      { id: "calcul-encre", label: "Encre en bruit rotationnel", text: "Des dizaines de milliers de gouttes portées par un courant sans divergence.", photo: "none", blocks: ["ink"], forms: ["ink"] },
      { id: "calcul-fluide", label: "Encre fraîche", text: "Des fluides stables (Stam, 1999) : la photo elle-même devient liquide.", photo: "fluid", forms: ["fluid"] },
    ],
  },
  {
    id: "sommaire",
    name: "Sommaire",
    intro: "Les présentations du sommaire en feuilles, et les écrans posés par-dessus.",
    samples: [
      ...MENUS.map(([style, label, text]) => ({
        id: `sommaire-${style}`,
        label: label!,
        text: text!,
        action: { label: "Ouvrir le sommaire", run: () => openSommaire(style!) },
      })),
      { id: "sommaire-crt", label: "Écran CRT", text: "Image bombée, lignes de balayage, masque RVB, sur la présentation Salle.", action: { label: "Ouvrir le sommaire", run: () => openSommaire("salle", "1") } },
      { id: "sommaire-projecteur", label: "Projecteur", text: "Sépia, scintillement, poussières et rayures.", action: { label: "Ouvrir le sommaire", run: () => openSommaire("salle", "2") } },
    ],
  },
  {
    id: "a11y",
    name: "Accessibilité",
    intro: "Voir l'image finale comme une autre personne, et faire tomber le contraste exprès.",
    samples: [
      ...VISIONS.map((label, i) => ({
        id: `vision-${i + 1}`,
        label,
        text: "Une matrice 3×3 en lumière linéaire, appliquée à toute l'image (Machado, 2009).",
        forms: ["a11y"],
        patch: () => {
          settings.a11y.vision = i + 1;
          settings.filter.source = 1;
        },
      })),
      { id: "a11y-fade", label: "Encre délavée", text: "L'encre se délave vers le papier : le contraste du texte tombe sous le seuil.", forms: ["a11y"], patch: () => (settings.a11y.fade = 0.65) },
    ],
  },
];

/* ───── Construction de la colonne ───── */

const side = document.querySelector<HTMLElement>("[data-sp-cats]")!;
const toc = document.querySelector<HTMLOListElement>(".toc");
const byId = new Map<string, { cat: Category; s: Sample }>();
for (const cat of CATS) {
  const d = document.createElement("details");
  d.id = `ch-cat-${cat.id}`;
  d.className = "sp-cat";
  if (cat.id === "explores") d.classList.add("sp-cat--explore");
  const sum = document.createElement("summary");
  sum.innerHTML = `<h2 class="sp-cat-name"></h2><span class="sp-count"></span>`;
  sum.querySelector("h2")!.textContent = cat.name;
  sum.querySelector(".sp-count")!.textContent = String(cat.samples.length);
  const ul = document.createElement("ul");
  for (const s of cat.samples) {
    byId.set(s.id, { cat, s });
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.sample = s.id;
    b.dataset.search = searchable(`${cat.name} ${s.label} ${s.text}`);
    b.textContent = s.label;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => select(s.id));
    li.append(b);
    ul.append(li);
  }
  d.append(sum, ul);
  side.append(d);
  if (toc) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#ch-cat-${cat.id}`;
    a.textContent = cat.name;
    a.addEventListener("click", () => {
      clearSearch();
      d.open = true;
    });
    li.append(a);
    toc.append(li);
  }
}

/* ───── Isolation ───── */

const context = document.querySelector<HTMLInputElement>("[data-sp-context]")!;
const contextHelp = document.querySelector<HTMLElement>("[data-sp-context-help]")!;

function neutral() {
  Object.assign(settings.chain, { distort: false, rgb: false, trame: false, bloom: false, grain: false, print: false, split: false });
  Object.assign(settings.glyph, { wave: 0, ink: 0, scatter: 0, atlas: false });
  Object.assign(settings.quad, { radius: 6, shadow: 0.45, lift: 0.3, wire: false, peel: 0, hoverPeel: false });
  Object.assign(settings.a11y, { fade: 0, vision: 0 });
  settings.filter.source = 0;
  settings.dom.boxes = false;
  settings.grain.amp = 1;
  settings.crease.on = false;
  settings.explore.active = false;
  for (const el of document.querySelectorAll<HTMLElement>("[data-gl-material]")) delete el.dataset.glMaterial;
}

/** Recopie les réglages dans les formulaires (les sorties numériques comprises). */
function refreshForms() {
  for (const form of document.querySelectorAll<HTMLFormElement>("form[data-controls]")) {
    const key = form.dataset.controls as keyof typeof settings;
    const target = settings[key] as unknown as Record<string, number | boolean> | undefined;
    if (!target) continue;
    for (const input of form.querySelectorAll<HTMLInputElement>("input[name]")) {
      if (!(input.name in target)) continue;
      const v = target[input.name];
      if (input.type === "checkbox") input.checked = Boolean(v);
      else if (input.type === "radio") input.checked = Number(input.value) === v;
      else {
        input.value = String(v);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }
}

function replay() {
  document.querySelector<HTMLButtonElement>("[data-sp-form='transition'] [data-action='replay']")?.click();
}

const stageEl = document.querySelector<HTMLElement>("[data-sp-stage]")!;
const SPREAD = new Set(["filtre", "trame", "flammes", "nuages", "toile", "gouttes", "givre"]);
const info = {
  cat: document.querySelector<HTMLElement>("[data-sp-catname]")!,
  title: document.querySelector<HTMLElement>("[data-sp-title]")!,
  text: document.querySelector<HTMLElement>("[data-sp-text]")!,
  intro: document.querySelector<HTMLElement>("[data-sp-intro]")!,
  action: document.querySelector<HTMLButtonElement>("[data-sp-action]")!,
};
let current = "";

function select(id: string, fromHash = false) {
  const found = byId.get(id);
  if (!found) return;
  const { cat, s } = found;
  current = id;
  neutral();
  if (cat.id === "plans") settings.quad.hoverPeel = true;
  if (s.material) for (const el of document.querySelectorAll<HTMLElement>(s.material.sel)) el.dataset.glMaterial = s.material.name;
  s.patch?.();
  context.disabled = Boolean(s.explore);
  contextHelp.hidden = !s.explore;
  if (context.checked && !s.explore) Object.assign(settings.chain, { rgb: true, bloom: true, grain: true, print: true });
  refreshForms();

  // Spécimen : plaque, photo et blocs annexes de l'échantillon.
  if (s.stage && !s.explore) stageEl.dataset.glStage = s.stage;
  else delete stageEl.dataset.glStage;
  // Les planches du dessous reçoivent le même filtre, la même trame ou la
  // même matière : un effet se juge sur plusieurs images, pas sur la seule
  // première. Chaque plaque de matière a sa propre mémoire du pointeur.
  // Le pli au survol n'appartient qu'aux échantillons « Plans et images ».
  for (const f of document.querySelectorAll<HTMLElement>(".sp-page-plate")) {
    if (s.stage && !s.explore && SPREAD.has(s.stage)) f.dataset.glStage = s.stage;
    else delete f.dataset.glStage;
  }
  const photo = s.photo ?? "fig";
  for (const f of document.querySelectorAll<HTMLElement>("[data-sp-photo]")) f.hidden = f.dataset.spPhoto !== photo;
  if (s.explore) {
    for (const img of document.querySelectorAll<HTMLElement>(`.sp-page-plate img[data-gl-img], [data-sp-photo='${photo}'] img[data-gl-img]`)) {
      img.dataset.glMaterial = "explore";
    }
  }
  const blocks = new Set(s.blocks ?? []);
  stageEl.hidden = blocks.has("layers") || blocks.has("ink") || blocks.has("type") || blocks.has("hero") || blocks.has("wrap");
  for (const b of document.querySelectorAll<HTMLElement>("[data-sp-block]")) b.hidden = !blocks.has(b.dataset.spBlock!);
  for (const f of document.querySelectorAll<HTMLElement>("[data-sp-form]")) f.hidden = !(s.forms ?? []).includes(f.dataset.spForm!);

  info.cat.textContent = cat.name;
  info.title.textContent = s.label;
  info.text.textContent = s.text;
  info.intro.textContent = cat.intro;
  info.action.hidden = !s.action;
  if (s.action) info.action.textContent = s.action.label;
  showExploreDetails(s.explore);

  for (const b of side.querySelectorAll<HTMLButtonElement>("[data-sample]")) b.setAttribute("aria-pressed", String(b.dataset.sample === id));
  const det = document.getElementById(`ch-cat-${cat.id}`) as HTMLDetailsElement | null;
  if (det) det.open = true;
  // Sur téléphone, seule la catégorie en cours reste dépliée.
  if (matchMedia("(max-width: 860px)").matches) {
    for (const d of side.querySelectorAll<HTMLDetailsElement>("details")) if (d !== det) d.open = false;
  }
  if (!fromHash) {
    if (location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
    // Sur téléphone, la liste est sous le spécimen : on y remonte.
    if (matchMedia("(max-width: 860px)").matches) {
      document.getElementById("ch-specimen")?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      if (s.explore) stageEl.focus({ preventScroll: true });
    }
  }
  dispatchEvent(new Event("pli:relayout"));
  notifyExplore();
  if (cat.id === "transitions") requestAnimationFrame(() => replay());
}

/* ───── Les études : commandes locales, sans toucher aux formulaires historiques ───── */

const exploreForm = document.querySelector<HTMLFormElement>("[data-explore-controls]")!;
const exploreUi = {
  details: document.querySelector<HTMLElement>("[data-explore-details]")!,
  technique: document.querySelector<HTMLElement>("[data-explore-technique]")!,
  interaction: document.querySelector<HTMLElement>("[data-explore-interaction]")!,
  reference: document.querySelector<HTMLAnchorElement>("[data-explore-reference]")!,
  htmlScope: document.querySelector<HTMLElement>("[data-explore-html-scope]")!,
  help: document.querySelector<HTMLElement>("[data-explore-help]")!,
  motion: document.querySelector<HTMLElement>("[data-explore-motion]")!,
  play: document.querySelector<HTMLButtonElement>("[data-explore-play]")!,
  replay: document.querySelector<HTMLButtonElement>("[data-explore-replay]")!,
  speed: document.querySelector<HTMLElement>("[data-explore-speed]")!,
  position: document.querySelector<HTMLElement>("[data-explore-position]")!,
  split: document.querySelector<HTMLElement>("[data-explore-split]")!,
  comparison: document.querySelector<HTMLElement>("[data-explore-comparison]")!,
  divider: document.querySelector<HTMLElement>("[data-explore-divider]")!,
  navigation: document.querySelector<HTMLElement>("[data-explore-navigation]")!,
  previous: document.querySelector<HTMLButtonElement>("[data-explore-previous]")!,
  next: document.querySelector<HTMLButtonElement>("[data-explore-next]")!,
  count: document.querySelector<HTMLElement>("[data-explore-count]")!,
};
const numericExploreKeys = ["amount", "scale", "speed", "split", "x", "y"] as const;
type ExploreNumber = (typeof numericExploreKeys)[number];
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const percent = (v: number) => `${Math.round(v * 100)} %`;

function resetExplorePreset(effect: ExploreEffect) {
  Object.assign(settings.explore, {
    active: true, mode: effect.mode, amount: 0.85, scale: effect.scale,
    speed: 1, paused: true, compare: false, split: 0.5, x: 0.5, y: 0.5,
  });
  settings.quad.lift = 0;
  settings.quad.radius = 0;
  resetExploreClock();
}

function currentExplore() {
  return byId.get(current)?.s.explore;
}

function showExploreDetails(effect?: ExploreEffect) {
  exploreUi.details.hidden = !effect;
  exploreUi.help.hidden = !effect?.hasCenter;
  exploreUi.navigation.hidden = !effect;
  stageEl.classList.toggle("sp-explore-stage", Boolean(effect));
  stageEl.classList.toggle("sp-explore-centered", Boolean(effect?.hasCenter));
  document.body.classList.toggle("sp-exploring", Boolean(effect));
  if (!effect) {
    stageEl.removeAttribute("tabindex");
    stageEl.removeAttribute("role");
    stageEl.removeAttribute("aria-label");
    stageEl.removeAttribute("aria-describedby");
    return;
  }
  stageEl.tabIndex = effect.hasCenter ? 0 : -1;
  stageEl.setAttribute("role", "group");
  stageEl.setAttribute("aria-label", `Photographie${effect.hasCenter ? " interactive" : ""} : ${effect.name}`);
  stageEl.setAttribute("aria-describedby", `${effect.hasCenter ? "sp-explore-help " : ""}sp-explore-interaction`);
  exploreUi.technique.textContent = effect.technique;
  exploreUi.interaction.textContent = effect.interaction;
  exploreUi.reference.textContent = effect.reference.label;
  exploreUi.reference.href = effect.reference.url;
  exploreUi.htmlScope.textContent = effect.htmlSafe
    ? "Cet effet peut aussi colorer ou tramer la carte HTML ci-dessous, si le navigateur expose la capture HTML-in-Canvas. Les contrôles conservent leur position."
    : "Cet effet déplace les pixels : il reste réservé aux photographies. La carte HTML conserve son rendu d'origine pour que ses contrôles restent à leur place.";
  const index = EXPLORE_EFFECTS.indexOf(effect);
  exploreUi.count.textContent = `${index + 1} / ${EXPLORE_EFFECTS.length}`;
  exploreUi.previous.disabled = index <= 0;
  exploreUi.next.disabled = index >= EXPLORE_EFFECTS.length - 1;
  const previous = EXPLORE_EFFECTS[index - 1];
  const next = EXPLORE_EFFECTS[index + 1];
  exploreUi.previous.setAttribute("aria-label", previous ? `Effet précédent : ${previous.name}` : "Premier effet de la collection");
  exploreUi.next.setAttribute("aria-label", next ? `Effet suivant : ${next.name}` : "Dernier effet de la collection");
}

function syncExploreControls() {
  const effect = currentExplore();
  const value = settings.explore;
  const ready = document.documentElement.classList.contains("gl-on");
  for (const input of exploreForm.querySelectorAll<HTMLInputElement>("input[name]")) {
    input.disabled = !ready;
    if (input.name === "compare") input.checked = value.compare;
    else if (numericExploreKeys.includes(input.name as ExploreNumber)) {
      const name = input.name as ExploreNumber;
      input.value = String(value[name]);
      const formatted = name === "speed"
        ? `× ${value.speed.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`
        : percent(value[name]);
      const output = input.parentElement?.querySelector("output");
      if (output) output.textContent = formatted;
      input.setAttribute("aria-valuetext", name === "split" ? `${formatted} de l'image sans l'effet` : formatted);
      if (name === "speed") input.disabled = !ready || !effect?.animated || motion.reduced;
      if (name === "split") input.disabled = !ready || !value.compare;
      if (name === "x" || name === "y") input.disabled = !ready || !effect?.hasCenter;
    }
  }
  for (const button of exploreForm.querySelectorAll<HTMLButtonElement>("button")) button.disabled = !ready;
  const running = Boolean(effect?.animated && ready && !value.paused && !motion.reduced);
  exploreUi.play.textContent = running ? "Mettre en pause" : "Lire l'effet";
  exploreUi.play.setAttribute("aria-pressed", String(running));
  exploreUi.play.disabled = !ready || !effect?.animated || motion.reduced;
  exploreUi.replay.disabled = !ready || !effect?.animated;
  exploreUi.speed.hidden = !effect?.animated;
  exploreUi.position.hidden = !effect?.hasCenter;
  exploreUi.split.hidden = !effect || !value.compare;
  exploreUi.comparison.hidden = !effect || !value.compare;
  exploreUi.divider.hidden = !effect || !value.compare || !ready;
  stageEl.style.setProperty("--explore-split", `${value.split * 100}%`);
  stageEl.style.setProperty("--explore-x", `${value.x * 100}%`);
  stageEl.style.setProperty("--explore-y", `${value.y * 100}%`);
  const fixedControls = effect?.hasCenter ? "Les réglages et le centre au clavier restent disponibles." : "Les réglages restent disponibles.";
  const message = !ready
    ? "HTML seul : les photos et la carte restent lisibles. Activez WebGPU pour essayer les réglages."
    : motion.system
      ? `Votre système demande moins de mouvement : aperçu fixe. ${fixedControls}`
      : motion.paused
        ? "La pause générale de la page est active. Reprenez-la pour pouvoir lancer cet effet."
        : !effect?.animated
          ? `Effet fixe : la lecture et la vitesse ne sont pas nécessaires. ${fixedControls}`
          : value.paused
            ? `Image en pause. Lancez la lecture pour animer l'effet. ${fixedControls}`
            : `Lecture en cours. ${effect.hasCenter ? "Déplacez le pointeur sur la photo ; mettez" : "Mettez"} en pause pour conserver cet instant.`;
  if (exploreUi.motion.textContent !== message) exploreUi.motion.textContent = message;
}

function notifyExplore() {
  window.dispatchEvent(new Event("pli:explore-change"));
}

exploreForm.addEventListener("submit", (event) => event.preventDefault());
for (const input of exploreForm.querySelectorAll<HTMLInputElement>("input[name]")) {
  input.addEventListener("input", () => {
    if (!currentExplore()) return;
    if (input.name === "compare") settings.explore.compare = input.checked;
    else if (numericExploreKeys.includes(input.name as ExploreNumber) && Number.isFinite(input.valueAsNumber)) {
      const name = input.name as ExploreNumber;
      settings.explore[name] = name === "speed" ? clamp(input.valueAsNumber, 0.25, 2) : clamp(input.valueAsNumber);
    }
    notifyExplore();
  });
}
exploreUi.play.addEventListener("click", () => {
  if (!currentExplore()?.animated || motion.reduced) return;
  settings.explore.paused = !settings.explore.paused;
  notifyExplore();
});
exploreUi.replay.addEventListener("click", () => {
  resetExploreClock();
  notifyExplore();
});
document.querySelector("[data-explore-reset]")!.addEventListener("click", () => {
  const effect = currentExplore();
  if (!effect) return;
  resetExplorePreset(effect);
  notifyExplore();
});
document.querySelector("[data-explore-center]")!.addEventListener("click", () => {
  settings.explore.x = settings.explore.y = 0.5;
  notifyExplore();
});
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-explore-preset]")) {
  button.addEventListener("click", () => {
    settings.explore.amount = button.dataset.explorePreset === "soft" ? 0.35 : 1;
    notifyExplore();
  });
}

stageEl.addEventListener("pointermove", (event) => {
  if (!currentExplore()?.hasCenter || settings.explore.paused || motion.reduced) return;
  const photo = stageEl.querySelector<HTMLImageElement>("[data-sp-photo]:not([hidden]) img[data-gl-img]");
  if (!photo) return;
  const rect = photo.getBoundingClientRect();
  if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
  settings.explore.x = clamp((event.clientX - rect.left) / rect.width);
  settings.explore.y = clamp((event.clientY - rect.top) / rect.height);
  notifyExplore();
});
stageEl.addEventListener("keydown", (event) => {
  if (!currentExplore()?.hasCenter || event.target !== stageEl || event.altKey || event.ctrlKey || event.metaKey || !document.documentElement.classList.contains("gl-on")) return;
  const step = event.shiftKey ? 0.01 : 0.05;
  if (event.key === "Home") settings.explore.x = settings.explore.y = 0.5;
  else if (event.key === "ArrowLeft") settings.explore.x = clamp(settings.explore.x - step);
  else if (event.key === "ArrowRight") settings.explore.x = clamp(settings.explore.x + step);
  else if (event.key === "ArrowUp") settings.explore.y = clamp(settings.explore.y - step);
  else if (event.key === "ArrowDown") settings.explore.y = clamp(settings.explore.y + step);
  else return;
  event.preventDefault();
  notifyExplore();
});

function adjacentExplore(offset: number) {
  const effect = currentExplore();
  if (!effect) return;
  const next = EXPLORE_EFFECTS[EXPLORE_EFFECTS.indexOf(effect) + offset];
  if (!next) return;
  clearSearch();
  select(`explore-${next.id}`);
}
exploreUi.previous.addEventListener("click", () => adjacentExplore(-1));
exploreUi.next.addEventListener("click", () => adjacentExplore(1));

/* ───── Recherche et liens directs : les identifiants historiques sont conservés ───── */

const search = document.querySelector<HTMLInputElement>("[data-sp-search]")!;
const searchCount = document.querySelector<HTMLElement>("[data-sp-search-count]")!;
function searchable(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}
function filterCatalog() {
  const query = searchable(search.value.trim());
  let total = 0;
  for (const category of side.querySelectorAll<HTMLDetailsElement>(".sp-cat")) {
    let shown = 0;
    for (const button of category.querySelectorAll<HTMLButtonElement>("[data-sample]")) {
      const matches = !query || button.dataset.search?.includes(query);
      button.parentElement!.hidden = !matches;
      if (matches) shown++;
    }
    category.hidden = shown === 0;
    if (query && shown) category.open = true;
    const count = category.querySelector<HTMLElement>(".sp-count");
    if (count) count.textContent = String(shown);
    total += shown;
  }
  searchCount.textContent = query
    ? `${total} résultat${total === 1 ? "" : "s"} pour « ${search.value.trim()} ».`
    : `${byId.size} échantillons, dont ${EXPLORE_EFFECTS.length} nouvelles études.`;
}
function clearSearch() {
  if (!search.value) return;
  search.value = "";
  filterCatalog();
}
search.addEventListener("input", filterCatalog);
document.querySelector("[data-sp-catalog-link]")?.addEventListener("click", () => {
  requestAnimationFrame(() => search.focus({ preventScroll: true }));
});
function followHash() {
  const id = location.hash.slice(1) || "explore-gravure";
  if (byId.has(id) && id !== current) {
    clearSearch();
    select(id, true);
  }
}
addEventListener("hashchange", followHash);
addEventListener("popstate", followHash);

info.action.addEventListener("click", () => byId.get(current)?.s.action?.run());
context.addEventListener("change", () => select(current, true));
addEventListener("pli:explore-change", syncExploreControls);
addEventListener("pli:motion-change", syncExploreControls);
for (const button of document.querySelectorAll("[data-action='pause']")) button.addEventListener("click", notifyExplore);
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", notifyExplore);
new MutationObserver(syncExploreControls).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

const start = location.hash.slice(1);
select(byId.has(start) ? start : "explore-gravure", true);
if (!start) history.replaceState(null, "", "#explore-gravure");
filterCatalog();
