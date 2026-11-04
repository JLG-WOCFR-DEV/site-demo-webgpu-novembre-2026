/**
 * Créateur — le modèle d'un site et sa compilation en page Presse.
 *
 * Un site est un objet JSON : des réglages de page et une suite de blocs. Chaque bloc a un type, des propriétés et,
 * selon le type, une liste d'éléments (photos, cartes, liens). La compilation produit le HTML source d'une page Presse :
 * sections .ps-sec du kit (src/presse/sections.css), attributs data-gl-* pour le moteur et balises <x-…> pour les
 * composants. C'est ce HTML que le Créateur exporte (à poser dans un projet Presse, `npm run build`), et c'est le même
 * qui s'affiche dans l'aperçu, où les balises <x-…> sont déroulées à chaud (src/presse/render.ts).
 *
 * Pur : ni DOM ni réseau (testé sous Node).
 */
import { CUI_EFFECTS } from "../gpu/cui.ts";
import { TRANSITIONS } from "../state.ts";

export type Value = string | number | boolean;
export type Props = Record<string, Value>;
export type Item = Record<string, Value>;
export type Block = { id: string; type: string; props: Props; items?: Item[]; hidden?: boolean };
export type Page = {
  title: string;
  description: string;
  lang: string;
  palette: string;
  paper: string;
  ink: string;
  spot: string;
  type: string;
  look: string;
  transition: string;
  effects: string[];
  motion: string;
  canvasUi: string;
  cursor: boolean;
  scroll: boolean;
  intro: boolean;
  width: string;
  radius: number;
};
export type Site = { v: 1; name: string; page: Page; blocks: Block[] };

export type FieldType = "text" | "area" | "select" | "range" | "toggle" | "image" | "color" | "link";
export type Field = {
  key: string;
  label: string;
  type: FieldType;
  choices?: readonly (readonly [string, string])[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
  /** Le champ n'a de sens que si… (masqué sinon). */
  when?: (p: Props) => boolean;
  /** Groupe de l'inspecteur. */
  group?: string;
};
export type ItemSpec = { label: string; noun: string; fields: Field[]; min: number; max: number; make: (i: number) => Item };
export type RenderCtx = {
  /** Aperçu du Créateur : chaque bloc porte son identifiant, chaque texte modifiable sur place son champ. */
  preview: boolean;
  site: Site;
};
export type BlockDef = {
  type: string;
  label: string;
  group: "Structure" | "Texte" | "Image" | "Matière" | "Composant";
  desc: string;
  /** Glyphe de la bibliothèque (un caractère). */
  glyph: string;
  fields: Field[];
  items?: ItemSpec;
  defaults: Props;
  defaultItems?: () => Item[];
  render: (b: Block, ctx: RenderCtx) => string;
};

/* ───────────────────────── Bibliothèque ───────────────────────── */

export type Photo = { src: string; w: number; h: number; alt: string; title: string; cat: string };
export const PHOTOS: Photo[] = [
  { src: "./plates/pont.jpg", w: 1728, h: 1150, alt: "Le Golden Gate depuis la côte : l'écume des vagues au pied d'une falaise verte.", title: "Le pont", cat: "eau" },
  { src: "./plates/alcatraz.jpg", w: 1728, h: 1150, alt: "L'île d'Alcatraz, son phare et ses bâtiments, au milieu de la baie bleue.", title: "Alcatraz", cat: "eau" },
  { src: "./plates/lac.jpg", w: 1728, h: 1150, alt: "Un lac de barrage entre des collines dorées, ciel strié de traînées d'avion.", title: "Le lac", cat: "eau" },
  { src: "./plates/yosemite.jpg", w: 1728, h: 1150, alt: "La vallée de Yosemite vue d'en haut : parois de granit, une cascade, la brume au fond.", title: "Yosemite", cat: "terre" },
  { src: "./plates/dunes.jpg", w: 1728, h: 1150, alt: "Des dunes de sable au soleil rasant, crêtes nettes et ombres longues.", title: "Les dunes", cat: "terre" },
  { src: "./plates/jardin.jpg", w: 1728, h: 1150, alt: "Un jardin japonais au printemps : azalées rouges, lanterne de pierre et maison de thé sous les pins.", title: "Le jardin", cat: "terre" },
  { src: "./plates/cerf.jpg", w: 1728, h: 1150, alt: "Un jeune cerf dans un jardin en pente, herbe verte et lumière rasante.", title: "Le cerf", cat: "terre" },
  { src: "./plates/fig.jpg", w: 1408, h: 1408, alt: "Une figue ouverte sur une pierre calcaire.", title: "La figue", cat: "objet" },
  { src: "./plates/flower.jpg", w: 1408, h: 1408, alt: "Une renoncule blanche sur fond gris.", title: "La renoncule", cat: "objet" },
  { src: "./plates/steel.jpg", w: 1408, h: 1408, alt: "Un cylindre d'acier brossé sur une ardoise sombre.", title: "L'acier", cat: "objet" },
  { src: "./plates/bowl.jpg", w: 1728, h: 1152, alt: "Un bol de grès blanc sur une table claire.", title: "Le bol", cat: "objet" },
  { src: "./plates/glass.jpg", w: 1728, h: 1152, alt: "Un verre d'eau dans la lumière, reflets et ombre portée.", title: "Le verre", cat: "objet" },
  { src: "./plates/vanilla.jpg", w: 1728, h: 1152, alt: "Des gousses de vanille sur un linge clair.", title: "La vanille", cat: "objet" },
];
export const photo = (src: string) => PHOTOS.find((p) => p.src === src);

const OBJET_MODELS = [
  ["texte", "Lettres gonflées"],
  ["noeud", "Nœud"],
  ["galet", "Galet"],
  ["vase", "Vase"],
  ["vase-glb", "Vase (GLB)"],
  ["dragon", "Dragon"],
  ["lapin", "Lapin"],
  ["bouddha", "Bouddha"],
  ["nefertiti", "Néfertiti"],
  ["spot", "Vache"],
] as const;

/* ───────────────────────── Listes ───────────────────────── */

const c = <T extends string>(...xs: (readonly [T, string])[]) => xs;
export const PALETTES: Record<string, { label: string; paper: string; ink: string; spot: string; dark?: boolean }> = {
  papier: { label: "Papier", paper: "#efeee8", ink: "#121212", spot: "#c8321c" },
  craie: { label: "Craie", paper: "#f6f4ef", ink: "#1c2430", spot: "#2f5bea" },
  sable: { label: "Sable", paper: "#e9e1d3", ink: "#2a2118", spot: "#b4541c" },
  menthe: { label: "Menthe", paper: "#e3ece6", ink: "#13241c", spot: "#0f8a5f" },
  nuit: { label: "Nuit", paper: "#0d0d10", ink: "#f0ede6", spot: "#ff5a36", dark: true },
  encre: { label: "Encre", paper: "#101522", ink: "#e9edf5", spot: "#7aa2ff", dark: true },
  libre: { label: "Libre", paper: "", ink: "", spot: "" },
};
/** Directions complètes : palette, typographie, étalonnage, impression, passes — un clic. */
export const STYLE_PRESETS: { id: string; label: string; page: Partial<Page> }[] = [
  { id: "editorial", label: "Éditorial", page: { palette: "papier", type: "grotesque", look: "papier", transition: "buvard", effects: ["loupe", "bloom", "grain"], radius: 10 } },
  { id: "nuit", label: "Galerie de nuit", page: { palette: "nuit", type: "didone", look: "argentique", transition: "revelateur", effects: ["loupe", "bloom", "grain"], radius: 4 } },
  { id: "technique", label: "Technique", page: { palette: "encre", type: "technique", look: "nuit", transition: "trame", effects: ["loupe", "rvb", "bloom", "grain"], radius: 2 } },
  { id: "classique", label: "Classique", page: { palette: "sable", type: "garalde", look: "argentique", transition: "impression", effects: ["loupe", "grain"], radius: 0 } },
  { id: "frais", label: "Frais", page: { palette: "menthe", type: "grotesque", look: "neutre", transition: "fondu", effects: ["loupe", "bloom"], radius: 18 } },
  { id: "craie", label: "Craie", page: { palette: "craie", type: "didone", look: "presse", transition: "quadri", effects: ["loupe", "trame", "grain"], radius: 6 } },
];
export const TYPES = c(["grotesque", "Grotesque (Archivo)"], ["didone", "Didone (Bodoni)"], ["garalde", "Garalde (Cormorant)"], ["technique", "Technique (étroite, mono)"]);
export const LOOK_NAMES = c(["neutre", "Neutre"], ["papier", "Papier"], ["argentique", "Argentique"], ["nuit", "Nuit"], ["presse", "Presse"]);
export const MOTIONS = c(["sobre", "Sobre"], ["normal", "Normal"], ["expressif", "Expressif"]);
export const EFFECTS = c(["loupe", "Loupe"], ["rvb", "Séparation RVB"], ["trame", "Trame"], ["bloom", "Halo"], ["grain", "Grain"]);
export const WIDTHS = c(["etroite", "Étroite"], ["normale", "Normale"], ["large", "Large"]);
const WIDTH_PX: Record<string, string> = { etroite: "980px", normale: "1240px", large: "1520px" };
export const TRANSITION_CHOICES = TRANSITIONS.map((t) => [t, t[0]!.toUpperCase() + t.slice(1)] as const);
export const CUI_CHOICES = CUI_EFFECTS.map((t) => [t, t === "aucun" ? "Aucun" : t[0]!.toUpperCase() + t.slice(1)] as const);

const MATERIALS = c(["", "Aucune"], ["lentille", "Lentille"], ["poussiere", "Poussière"], ["gouttes", "Gouttes"], ["toile", "Toile"], ["givre", "Givre"], ["nuages", "Brume"]);
const STAGES = c(["", "Aucun"], ["flammes", "Flammes"], ["nuages", "Brume"], ["givre", "Givre"], ["toile", "Toile"]);
const CARD_MATERIALS = c(["", "Aucune"], ["givre", "Givre"], ["nuages", "Brume"], ["flammes", "Flammes"], ["toile", "Toile (photo)"], ["gouttes", "Gouttes (photo)"]);
const REVEALS = c(["", "Aucune"], ["rideau", "Rideau"], ["dissolution", "Dissolution"], ["pixels", "Pixels"], ["tri", "Tri de pixels"]);
const HOVERS = c(["", "Aucun"], ["deplacement", "Bombé"], ["rvb", "RVB"], ["onde", "Onde"], ["pixels", "Pixels"]);
const KINETICS = c(["", "Aucune"], ["respire", "Respire"], ["contour", "Contour"], ["vague", "Vague"], ["vitesse", "Vitesse"]);
const SIZES = c(["l", "Grand"], ["xl", "Très grand"], ["xxl", "Immense"]);
const ALIGNS = c(["gauche", "Gauche"], ["centre", "Centre"]);
const SIDES = c(["droite", "Média à droite"], ["gauche", "Média à gauche"]);
const RATIOS = c(["", "D'origine"], ["16/9", "16 : 9"], ["3/2", "3 : 2"], ["4/3", "4 : 3"], ["1/1", "Carré"], ["4/5", "4 : 5"], ["21/9", "21 : 9"]);
const SPACES = c(["serre", "Serré"], ["normal", "Normal"], ["ample", "Ample"], ["aucun", "Aucun"]);

/* ───────────────────────── Aides de rendu ───────────────────────── */

export const esc = (s: Value | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const str = (v: Value | undefined) => (v === undefined || v === false ? "" : String(v));
const on = (v: Value | undefined) => v === true || v === "true" || v === 1;
/** ` nom="valeur"` si la valeur est non vide. */
const attr = (name: string, v: Value | undefined) => (str(v) === "" ? "" : ` ${name}="${esc(v)}"`);
const flag = (name: string, v: Value | undefined) => (on(v) ? ` ${name}` : "");
/** Champ modifiable sur place, dans l'aperçu seulement. */
const ed = (ctx: RenderCtx, key: string, item?: number) => (ctx.preview ? ` data-cr-field="${key}"${item !== undefined ? ` data-cr-item="${item}"` : ""}` : "");
/** Paragraphes : une ligne vide les sépare. */
const paras = (text: Value | undefined, ctx: RenderCtx, key: string, cls = "ps-p") =>
  str(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => `<p class="${cls}" data-gl-text${ctx.preview ? ` data-cr-field="${key}" data-cr-para="${i}"` : ""}>${esc(p).replace(/\n/g, "<br />")}</p>`)
    .join("\n      ");
/** L'ouverture d'une section : classes, attributs communs (ancre, impression, espacement, filet), identifiant d'aperçu. */
function open(b: Block, ctx: RenderCtx, cls: string, extra = "", tag = "section") {
  const p = b.props;
  const label = str(p.title) || str(p.word) || str(p.kicker);
  return (
    `<${tag} class="ps-sec ${cls}"` +
    attr("id", p.anchor) +
    (ctx.preview ? ` data-cr-id="${esc(b.id)}"` : "") +
    (on(p.print) ? " data-gl-print" : "") +
    (str(p.space) && p.space !== "normal" ? ` data-space="${esc(p.space)}"` : "") +
    flag("data-rule", p.rule) +
    (tag === "section" && label ? ` aria-label="${esc(label)}"` : "") +
    extra +
    ">"
  );
}
const kicker = (b: Block, ctx: RenderCtx) => (str(b.props.kicker) ? `<p class="ps-kicker" data-gl-text${ed(ctx, "kicker")}>${esc(b.props.kicker)}</p>` : "");
const h2 = (b: Block, ctx: RenderCtx, key = "title") => (str(b.props[key]) ? `<h2 class="ps-h2" data-gl-text${ed(ctx, key)}>${esc(b.props[key])}</h2>` : "");
/** Une image GPU dans son cadre : matière, révélation, survol, proportion. */
function figure(src: Value | undefined, alt: Value | undefined, o: { material?: Value; reveal?: Value; hover?: Value; ratio?: Value; caption?: Value; cls?: string; ctx: RenderCtx; capKey?: string }) {
  const ph = photo(str(src));
  const ratio = str(o.ratio);
  return `<figure class="ps-fig${o.cls ? ` ${o.cls}` : ""}"${attr("data-gl-material", o.material)}${ratio ? ` data-ratio style="--ratio: ${esc(ratio)}"` : ""}><img data-gl-img${attr("data-gl-reveal", o.reveal)}${attr("data-gl-hover", o.hover)} src="${esc(src)}"${ph ? ` width="${ph.w}" height="${ph.h}"` : ""} alt="${esc(alt)}" />${str(o.caption) ? `<figcaption class="ps-cap"${ed(o.ctx, o.capKey ?? "caption")}>${esc(o.caption)}</figcaption>` : ""}</figure>`;
}
const button = (label: Value | undefined, href: Value | undefined, fill: boolean, ctx: RenderCtx, key: string) =>
  str(label) ? `<a class="ps-btn${fill ? " ps-btn--fill" : ""}" href="${esc(str(href) || "#")}" data-magnet="0.25"><span${ed(ctx, key)}>${esc(label)}</span> <span aria-hidden="true">↗</span></a>` : "";

/* ───────────────────────── Champs communs ───────────────────────── */

const COMMON: Field[] = [
  { key: "anchor", label: "Ancre", type: "text", hint: "Identifiant de la section (lien #ancre)", group: "Section" },
  { key: "space", label: "Espacement", type: "select", choices: SPACES, group: "Section" },
  { key: "rule", label: "Filet au-dessus", type: "toggle", group: "Section" },
  { key: "print", label: "Imprimée au défilement", type: "toggle", hint: "La transition de la page la fait apparaître", group: "Section" },
];
const COMMON_DEFAULTS: Props = { anchor: "", space: "normal", rule: false, print: true };
const imageFields = (prefix = "", g = "Image"): Field[] => [
  { key: `${prefix}src`, label: "Photo", type: "image", group: g },
  { key: `${prefix}alt`, label: "Texte alternatif", type: "text", hint: "Ce que voit un lecteur d'écran (vide : image décorative)", group: g },
];
const gpuFields = (g = "Effets GPU"): Field[] => [
  { key: "material", label: "Matière", type: "select", choices: MATERIALS, group: g },
  { key: "reveal", label: "Révélation", type: "select", choices: REVEALS, group: g },
  { key: "hover", label: "Survol", type: "select", choices: HOVERS, group: g },
];
const photoItem = (extra: Field[] = []): ItemSpec => ({
  label: "Photos",
  noun: "photo",
  min: 2,
  max: 24,
  fields: [{ key: "src", label: "Photo", type: "image" }, { key: "title", label: "Titre", type: "text" }, { key: "alt", label: "Texte alternatif", type: "text" }, ...extra],
  make: (i) => {
    const p = PHOTOS[i % PHOTOS.length]!;
    return { src: p.src, title: p.title, alt: p.alt, cat: p.cat, body: "" };
  },
});
const photos = (n: number, from = 0) => () => Array.from({ length: n }, (_, i) => photoItem().make(from + i));
const linkItem = (noun = "lien"): ItemSpec => ({
  label: "Liens",
  noun,
  min: 0,
  max: 8,
  fields: [
    { key: "label", label: "Libellé", type: "text" },
    { key: "href", label: "Adresse", type: "link" },
  ],
  make: (i) => ({ label: `Lien ${i + 1}`, href: "#" }),
});

/* ───────────────────────── Blocs ───────────────────────── */

const defs: BlockDef[] = [];
const def = (d: Omit<BlockDef, "fields" | "defaults"> & { fields: Field[]; defaults: Props; common?: boolean }) => {
  const common = d.common !== false;
  defs.push({ ...d, fields: common ? [...d.fields, ...COMMON] : d.fields, defaults: common ? { ...COMMON_DEFAULTS, ...d.defaults } : d.defaults });
};

def({
  type: "nav",
  label: "Navigation",
  group: "Structure",
  glyph: "☰",
  desc: "Barre du haut : marque, liens, bouton",
  common: false,
  fields: [
    { key: "brand", label: "Marque", type: "text" },
    { key: "cta", label: "Bouton", type: "text" },
    { key: "ctaHref", label: "Adresse du bouton", type: "link" },
    { key: "sticky", label: "Reste en haut", type: "toggle" },
  ],
  defaults: { brand: "Atelier Nord", cta: "Contact", ctaHref: "#contact", sticky: true },
  items: linkItem(),
  defaultItems: () => [
    { label: "Travaux", href: "#travaux" },
    { label: "Studio", href: "#studio" },
    { label: "Journal", href: "#journal" },
  ],
  render: (b, ctx) => {
    const p = b.props;
    return `<header class="ps-nav"${ctx.preview ? ` data-cr-id="${esc(b.id)}"` : ""}${flag("data-sticky", p.sticky)}>
  <a class="ps-brand" href="#"${ed(ctx, "brand")}>${esc(p.brand)}</a>
  <nav class="ps-nav-links" aria-label="Sections">${(b.items ?? []).map((it, i) => `<a href="${esc(str(it.href) || "#")}"${ed(ctx, "label", i)}>${esc(it.label)}</a>`).join("")}</nav>
  ${button(p.cta, p.ctaHref, true, ctx, "cta")}
</header>`;
  },
});

def({
  type: "hero",
  label: "Ouverture",
  group: "Texte",
  glyph: "A",
  desc: "Grand titre, chapô, boutons ; typographie cinétique, fond de matière",
  fields: [
    { key: "kicker", label: "Surtitre", type: "text", group: "Contenu" },
    { key: "title", label: "Titre", type: "area", group: "Contenu" },
    { key: "lede", label: "Chapô", type: "area", group: "Contenu" },
    { key: "cta", label: "Bouton principal", type: "text", group: "Boutons" },
    { key: "ctaHref", label: "Adresse", type: "link", group: "Boutons" },
    { key: "cta2", label: "Second bouton", type: "text", group: "Boutons" },
    { key: "cta2Href", label: "Adresse", type: "link", group: "Boutons" },
    { key: "fire", label: "Bouton en flammes", type: "toggle", group: "Boutons", hint: "Une enveloppe de feu autour du bouton principal" },
    { key: "size", label: "Taille du titre", type: "select", choices: SIZES, group: "Mise en page" },
    { key: "align", label: "Alignement", type: "select", choices: ALIGNS, group: "Mise en page" },
    { key: "height", label: "Hauteur", type: "select", choices: c(["auto", "Contenu"], ["ecran", "Plein écran"]), group: "Mise en page" },
    { key: "kinetic", label: "Typo cinétique", type: "select", choices: KINETICS, group: "Effets GPU" },
    { key: "morph", label: "Morphing des lettres", type: "toggle", hint: "Quand le titre change, les lettres communes voyagent", group: "Effets GPU" },
    { key: "stage", label: "Fond de matière", type: "select", choices: STAGES, group: "Effets GPU" },
  ],
  defaults: {
    kicker: "Studio de création · Depuis 2026",
    title: "Des images qui respirent",
    lede: "Un site imprimé par le GPU : le texte reste du texte, les photos des photos, et chaque section arrive comme une épreuve qui sort de la presse.",
    cta: "Voir les travaux",
    ctaHref: "#travaux",
    cta2: "Le studio",
    cta2Href: "#studio",
    fire: false,
    size: "xl",
    align: "gauche",
    height: "ecran",
    kinetic: "respire",
    morph: true,
    stage: "",
    space: "normal",
  },
  render: (b, ctx) => {
    const p = b.props;
    const main = button(p.cta, p.ctaHref, true, ctx, "cta");
    return `${open(b, ctx, "ps-hero", attr("data-align", p.align === "centre" ? "centre" : "") + attr("data-height", p.height) + attr("data-gl-stage", p.stage) + (str(p.stage) ? " data-stage" : ""))}
  <div class="ps-in">
    ${kicker(b, ctx)}
    <h1 class="ps-display" data-size="${esc(p.size)}" data-gl-text${flag("data-gl-morph", p.morph)}${attr("data-gl-kinetic", p.kinetic)}${ed(ctx, "title")}>${esc(p.title).replace(/\n/g, "<br />")}</h1>
    ${str(p.lede) ? `<p class="ps-lede" data-gl-text${ed(ctx, "lede")}>${esc(p.lede)}</p>` : ""}
    ${main || str(p.cta2) ? `<div class="ps-actions">${on(p.fire) && main ? `<span class="ps-fire" data-gl-stage="enveloppe">${main}</span>` : main}${button(p.cta2, p.cta2Href, false, ctx, "cta2")}</div>` : ""}
  </div>
</section>`;
  },
});

def({
  type: "texte",
  label: "Texte",
  group: "Texte",
  glyph: "¶",
  desc: "Titre et paragraphes ; une colonne, deux colonnes, ou titre à côté",
  fields: [
    { key: "kicker", label: "Surtitre", type: "text", group: "Contenu" },
    { key: "title", label: "Titre", type: "text", group: "Contenu" },
    { key: "body", label: "Texte", type: "area", hint: "Une ligne vide sépare deux paragraphes", group: "Contenu" },
    { key: "layout", label: "Disposition", type: "select", choices: c(["simple", "Une colonne"], ["colonnes", "Deux colonnes"], ["cote", "Titre à côté"]), group: "Mise en page" },
    { key: "size", label: "Corps", type: "select", choices: c(["normal", "Normal"], ["grand", "Grand"]), group: "Mise en page" },
    { key: "align", label: "Alignement", type: "select", choices: ALIGNS, group: "Mise en page" },
  ],
  defaults: {
    kicker: "Le studio",
    title: "La page reste un document",
    body: "Le DOM compose, le GPU imprime. La mise en page, les liens, la sélection et la recherche dans la page viennent du navigateur ; le moteur relit chaque boîte et chaque lettre, puis repeint tout dans un seul canvas.\n\nSans WebGPU, rien ne manque : la page est son HTML, lisible, indexable, accessible.",
    layout: "cote",
    size: "grand",
    align: "gauche",
    rule: true,
  },
  render: (b, ctx) => {
    const p = b.props;
    const head = `<div>${kicker(b, ctx)}${h2(b, ctx)}</div>`;
    return `${open(b, ctx, "ps-text", attr("data-layout", p.layout) + attr("data-align", p.align === "centre" ? "centre" : ""))}
  <div class="ps-in">
    ${head}
    <div class="ps-body" data-size="${esc(p.size)}">
      ${paras(p.body, ctx, "body")}
    </div>
  </div>
</section>`;
  },
});

def({
  type: "image",
  label: "Image",
  group: "Image",
  glyph: "▣",
  desc: "Une photo imprimée par le GPU : matière, révélation, survol",
  fields: [
    ...imageFields(),
    { key: "caption", label: "Légende", type: "text", group: "Image" },
    { key: "width", label: "Largeur", type: "select", choices: c(["contenue", "Contenue"], ["etroite", "Étroite"], ["pleine", "Pleine page"]), group: "Mise en page" },
    { key: "ratio", label: "Proportion", type: "select", choices: RATIOS, group: "Mise en page" },
    ...gpuFields(),
  ],
  defaults: { src: "./plates/yosemite.jpg", alt: photo("./plates/yosemite.jpg")!.alt, caption: "Yosemite, au petit matin.", width: "contenue", ratio: "21/9", material: "lentille", reveal: "rideau", hover: "", space: "serre" },
  render: (b, ctx) => {
    const p = b.props;
    return `${open(b, ctx, "ps-image", attr("data-width", p.width))}
  <div class="ps-in">
    ${figure(p.src, p.alt, { material: p.material, reveal: p.reveal, hover: p.hover, ratio: p.ratio, caption: p.caption, ctx })}
  </div>
</section>`;
  },
});

def({
  type: "duo",
  label: "Texte et image",
  group: "Image",
  glyph: "◧",
  desc: "Un texte à côté d'une photo",
  fields: [
    { key: "kicker", label: "Surtitre", type: "text", group: "Contenu" },
    { key: "title", label: "Titre", type: "text", group: "Contenu" },
    { key: "body", label: "Texte", type: "area", group: "Contenu" },
    { key: "cta", label: "Bouton", type: "text", group: "Contenu" },
    { key: "ctaHref", label: "Adresse", type: "link", group: "Contenu" },
    ...imageFields(),
    { key: "side", label: "Côté", type: "select", choices: SIDES, group: "Mise en page" },
    { key: "ratio", label: "Proportion", type: "select", choices: RATIOS, group: "Mise en page" },
    ...gpuFields(),
  ],
  defaults: {
    kicker: "Matières",
    title: "La photo se défait, puis se recompose",
    body: "Chaque image est un plan GPU : coins et ombre calculés par pixel, et une matière qui s'y pose — lentille, poussière, gouttes, givre.",
    cta: "",
    ctaHref: "#",
    src: "./plates/jardin.jpg",
    alt: photo("./plates/jardin.jpg")!.alt,
    side: "droite",
    ratio: "4/5",
    material: "poussiere",
    reveal: "",
    hover: "",
  },
  render: (b, ctx) => {
    const p = b.props;
    return `${open(b, ctx, "ps-duo", attr("data-side", p.side))}
  <div class="ps-in">
    <div>
      ${kicker(b, ctx)}
      ${h2(b, ctx)}
      <div class="ps-body">${paras(p.body, ctx, "body")}</div>
      ${str(p.cta) ? `<div class="ps-actions">${button(p.cta, p.ctaHref, false, ctx, "cta")}</div>` : ""}
    </div>
    ${figure(p.src, p.alt, { material: p.material, reveal: p.reveal, hover: p.hover, ratio: p.ratio, ctx })}
  </div>
</section>`;
  },
});

def({
  type: "cinetique",
  label: "Typo cinétique",
  group: "Texte",
  glyph: "≋",
  desc: "Des mots immenses qui respirent, se remplissent, ondulent ou s'étirent",
  fields: [
    { key: "lines", label: "Lignes", type: "area", hint: "Une ligne par mot ou groupe", group: "Contenu" },
    { key: "mode", label: "Effet", type: "select", choices: c(["mixte", "Un par ligne"], ["respire", "Respire"], ["contour", "Contour"], ["vague", "Vague"], ["vitesse", "Vitesse"]), group: "Effets GPU" },
    { key: "size", label: "Taille", type: "select", choices: SIZES, group: "Mise en page" },
    { key: "align", label: "Alignement", type: "select", choices: ALIGNS, group: "Mise en page" },
  ],
  defaults: { lines: "Respire\nContour\nVague\nVitesse", mode: "mixte", size: "xl", align: "gauche", space: "normal" },
  render: (b, ctx) => {
    const p = b.props;
    const modes = ["respire", "contour", "vague", "vitesse"];
    const lines = str(p.lines)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return `${open(b, ctx, "ps-kin", attr("data-size", p.size) + attr("data-align", p.align === "centre" ? "centre" : ""))}
  <div class="ps-in">
    ${lines.map((l, i) => `<p class="ps-kin-line" data-gl-text data-gl-kinetic="${p.mode === "mixte" ? modes[i % 4] : esc(p.mode)}"${ctx.preview ? ` data-cr-field="lines" data-cr-line="${i}"` : ""}>${esc(l)}</p>`).join("\n    ")}
  </div>
</section>`;
  },
});

def({
  type: "cartes",
  label: "Cartes à matières",
  group: "Matière",
  glyph: "❖",
  desc: "Trois cartes vivantes : givre qui fond, brume qu'on écarte, flammes, toile",
  fields: [
    { key: "kicker", label: "Surtitre", type: "text", group: "Contenu" },
    { key: "title", label: "Titre", type: "text", group: "Contenu" },
    { key: "cols", label: "Colonnes", type: "range", min: 2, max: 4, step: 1, group: "Mise en page" },
  ],
  defaults: { kicker: "Services", title: "Ce que nous faisons", cols: 3 },
  items: {
    label: "Cartes",
    noun: "carte",
    min: 1,
    max: 8,
    fields: [
      { key: "kicker", label: "Surtitre", type: "text" },
      { key: "title", label: "Titre", type: "text" },
      { key: "text", label: "Texte", type: "area" },
      { key: "material", label: "Matière", type: "select", choices: CARD_MATERIALS },
      { key: "src", label: "Photo", type: "image", when: (it) => it.material === "toile" || it.material === "gouttes" },
    ],
    make: (i) => ({ kicker: `0${i + 1}`, title: "Nouvelle carte", text: "Un texte court.", material: "givre", src: "./plates/pont.jpg" }),
  },
  defaultItems: () => [
    { kicker: "01 · Identité", title: "Vitre gelée", text: "Gardez le pointeur dessus : la glace fond, avec un bord d'eau, puis regèle.", material: "givre", src: "" },
    { kicker: "02 · Sites", title: "Soufflez dessus", text: "Un voile épais floute ce qu'il couvre ; le pointeur l'écarte, il revient.", material: "nuages", src: "" },
    { kicker: "03 · Images", title: "L'épreuve brûle", text: "Le feu monte du pied de la carte et penche vers le pointeur.", material: "flammes", src: "" },
  ],
  render: (b, ctx) => {
    const p = b.props;
    const cards = (b.items ?? []).map((it, i) => {
      const photoIn = (it.material === "toile" || it.material === "gouttes") && str(it.src);
      return `<div class="ps-card"${attr("data-gl-stage", it.material)}>
        <div data-gl-text>${str(it.kicker) ? `<p class="ps-kicker"${ed(ctx, "kicker", i)}>${esc(it.kicker)}</p>` : ""}<p class="ps-h3"${ed(ctx, "title", i)}>${esc(it.title)}</p><p class="ps-p"${ed(ctx, "text", i)}>${esc(it.text)}</p></div>
        ${photoIn ? `<figure class="ps-fig"><img data-gl-img src="${esc(it.src)}" alt="" /></figure>` : ""}
      </div>`;
    });
    return `${open(b, ctx, "ps-cards")}
  <div class="ps-in">
    ${kicker(b, ctx)}
    ${h2(b, ctx)}
    <div class="ps-cards-grid" style="--cols: ${Number(p.cols) || 3}">
      ${cards.join("\n      ")}
    </div>
  </div>
</section>`;
  },
});

def({
  type: "chiffres",
  label: "Chiffres",
  group: "Texte",
  glyph: "#",
  desc: "Quelques nombres en très grand, avec leur légende",
  fields: [
    { key: "kicker", label: "Surtitre", type: "text", group: "Contenu" },
    { key: "title", label: "Titre", type: "text", group: "Contenu" },
  ],
  defaults: { kicker: "En chiffres", title: "", rule: false },
  items: {
    label: "Chiffres",
    noun: "chiffre",
    min: 1,
    max: 6,
    fields: [
      { key: "value", label: "Valeur", type: "text" },
      { key: "label", label: "Légende", type: "text" },
    ],
    make: () => ({ value: "42", label: "Une légende" }),
  },
  defaultItems: () => [
    { value: "1", label: "canvas pour toute la page" },
    { value: "60", label: "images par seconde, tenues" },
    { value: "0", label: "ligne de JavaScript à écrire" },
  ],
  render: (b, ctx) =>
    `${open(b, ctx, "ps-stats")}
  <div class="ps-in">
    ${kicker(b, ctx)}
    ${h2(b, ctx)}
    <div class="ps-stats-grid">
      ${(b.items ?? []).map((it, i) => `<figure class="ps-stat" data-gl-text><p class="ps-stat-value"${ed(ctx, "value", i)}>${esc(it.value)}</p><figcaption class="ps-stat-label"${ed(ctx, "label", i)}>${esc(it.label)}</figcaption></figure>`).join("\n      ")}
    </div>
  </div>
</section>`,
});

def({
  type: "citation",
  label: "Citation",
  group: "Texte",
  glyph: "❝",
  desc: "Une phrase, son auteur",
  fields: [
    { key: "quote", label: "Citation", type: "area", group: "Contenu" },
    { key: "by", label: "Auteur", type: "text", group: "Contenu" },
    { key: "kinetic", label: "Typo cinétique", type: "select", choices: KINETICS, group: "Effets GPU" },
    { key: "align", label: "Alignement", type: "select", choices: ALIGNS, group: "Mise en page" },
  ],
  defaults: { quote: "« Ce qui peut être calculé à la construction l'est, pour laisser à l'exécution presque rien à faire. »", by: "Principe de fabrication", kinetic: "", align: "gauche" },
  render: (b, ctx) => {
    const p = b.props;
    return `${open(b, ctx, "ps-quote", attr("data-align", p.align === "centre" ? "centre" : ""))}
  <figure class="ps-in" style="margin-block: 0">
    <blockquote class="ps-quote-text" style="margin-inline: ${p.align === "centre" ? "auto" : "0"}" data-gl-text${attr("data-gl-kinetic", p.kinetic)}${ed(ctx, "quote")}>${esc(p.quote)}</blockquote>
    ${str(p.by) ? `<figcaption class="ps-quote-by" data-gl-text${ed(ctx, "by")}>${esc(p.by)}</figcaption>` : ""}
  </figure>
</section>`;
  },
});

def({
  type: "matiere",
  label: "Matière vivante",
  group: "Matière",
  glyph: "✺",
  desc: "Feu simulé, foudre, eau, paillettes, diagramme de phase — avec ou sans texte",
  fields: [
    { key: "kind", label: "Matière", type: "select", choices: c(["feu", "Feu (fluide simulé)"], ["eclair", "Éclair"], ["eau", "Eau (ondes)"], ["paillettes", "Paillettes"], ["phase", "Diagramme de phase"]), group: "Matière" },
    { key: "word", label: "Mot", type: "text", group: "Matière" },
    { key: "metal", label: "Métal", type: "select", choices: c(["argent", "Argent"], ["or", "Or"], ["noir", "Noir"]), when: (p) => p.kind === "paillettes", group: "Matière" },
    { key: "ratio", label: "Proportion", type: "select", choices: c(["4/5", "4 : 5"], ["1/1", "Carré"], ["4/3", "4 : 3"], ["16/9", "16 : 9"], ["21/9", "21 : 9"]), group: "Matière" },
    { key: "caption", label: "Légende", type: "text", group: "Matière" },
    { key: "layout", label: "Disposition", type: "select", choices: c(["texte", "Avec un texte"], ["seul", "Seule"]), group: "Mise en page" },
    { key: "side", label: "Côté", type: "select", choices: SIDES, when: (p) => p.layout !== "seul", group: "Mise en page" },
    { key: "kicker", label: "Surtitre", type: "text", when: (p) => p.layout !== "seul", group: "Contenu" },
    { key: "title", label: "Titre", type: "text", when: (p) => p.layout !== "seul", group: "Contenu" },
    { key: "body", label: "Texte", type: "area", when: (p) => p.layout !== "seul", group: "Contenu" },
  ],
  defaults: {
    kind: "feu",
    word: "Feu",
    metal: "argent",
    ratio: "4/5",
    caption: "",
    layout: "texte",
    side: "droite",
    kicker: "Simulation",
    title: "Un feu qui brûle vraiment",
    body: "Un fluide 2D simulé sur le GPU : corps noir, braises, étincelles et brume de chaleur. Le mot reste en HTML : c'est ce que lit un lecteur d'écran.",
  },
  render: (b, ctx) => {
    const p = b.props;
    const solo = p.layout === "seul";
    const tag = `<x-matiere kind="${esc(p.kind)}"${attr("word", p.word)}${p.kind === "paillettes" ? attr("metal", p.metal) : ""}${attr("ratio", p.ratio)}${attr("caption", p.caption)}></x-matiere>`;
    return `${open(b, ctx, "ps-split ps-matiere", attr("data-layout", solo ? "seul" : "") + attr("data-side", p.side))}
  <div class="ps-in">
    ${solo ? "" : `<div>${kicker(b, ctx)}${h2(b, ctx)}<div class="ps-body">${paras(p.body, ctx, "body")}</div></div>`}
    <div class="ps-split-media">${tag}</div>
  </div>
</section>`;
  },
});

def({
  type: "objet",
  label: "Objet 3D",
  group: "Composant",
  glyph: "◆",
  desc: "Un modèle dans un studio : verre, encre, ASCII, tramage, particules, liquide",
  fields: [
    { key: "style", label: "Rendu", type: "select", choices: c(["verre", "Verre"], ["encre", "Encre"], ["ascii", "ASCII"], ["tramage", "Tramage"], ["particules", "Particules"], ["liquide", "Liquide"]), group: "Objet" },
    { key: "model", label: "Modèle", type: "select", choices: OBJET_MODELS, group: "Objet" },
    { key: "letters", label: "Lettres", type: "text", when: (p) => p.model === "texte", group: "Objet" },
    { key: "spin", label: "Rotation", type: "range", min: 0, max: 2, step: 0.05, group: "Objet" },
    { key: "layout", label: "Disposition", type: "select", choices: c(["texte", "Avec un texte"], ["seul", "Seul"]), group: "Mise en page" },
    { key: "side", label: "Côté", type: "select", choices: SIDES, when: (p) => p.layout !== "seul", group: "Mise en page" },
    { key: "kicker", label: "Surtitre", type: "text", when: (p) => p.layout !== "seul", group: "Contenu" },
    { key: "title", label: "Titre", type: "text", when: (p) => p.layout !== "seul", group: "Contenu" },
    { key: "body", label: "Texte", type: "area", when: (p) => p.layout !== "seul", group: "Contenu" },
  ],
  defaults: {
    style: "verre",
    model: "texte",
    letters: "UBS",
    spin: 0.4,
    layout: "texte",
    side: "gauche",
    kicker: "Atelier 3D",
    title: "Du verre qui réfracte la page",
    body: "Deux surfaces, six longueurs d'onde, Fresnel et givre. Glissez pour tourner l'objet ; déposez un GLB, un SVG ou une image dessus.",
  },
  render: (b, ctx) => {
    const p = b.props;
    const solo = p.layout === "seul";
    const model = p.model === "texte" ? `texte:${str(p.letters) || "UBS"}` : str(p.model);
    const tag = `<x-objet style="${esc(p.style)}" model="${esc(model)}"${attr("spin", p.spin)} label="${esc(str(p.title) || "Objet 3D")} : glisser pour le tourner"></x-objet>`;
    return `${open(b, ctx, "ps-split ps-objet", attr("data-layout", solo ? "seul" : "") + attr("data-side", p.side))}
  <div class="ps-in">
    ${solo ? "" : `<div>${kicker(b, ctx)}${h2(b, ctx)}<div class="ps-body">${paras(p.body, ctx, "body")}</div></div>`}
    <div class="ps-split-media">${tag}</div>
  </div>
</section>`;
  },
});

const compHead = (b: Block, ctx: RenderCtx) => (str(b.props.kicker) || str(b.props.title) ? `<div class="ps-comp-head">${kicker(b, ctx)}${h2(b, ctx)}</div>` : "");
const imgTag = (it: Item, extra: string) => {
  const ph = photo(str(it.src));
  return `<img src="${esc(it.src)}"${ph ? ` width="${ph.w}" height="${ph.h}"` : ""} alt="${esc(it.alt)}"${extra} />`;
};

def({
  type: "galerie",
  label: "Galerie 3D",
  group: "Composant",
  glyph: "◎",
  desc: "Carrousel, tonneau, hélice, sphère… un appel de dessin, fiche ou boîte à l'ouverture",
  fields: [
    { key: "kicker", label: "Surtitre", type: "text", group: "Contenu" },
    { key: "title", label: "Titre", type: "text", group: "Contenu" },
    { key: "arrange", label: "Arrangement", type: "select", choices: c(["carousel", "Carrousel"], ["barrel", "Tonneau"], ["coverflow", "Coverflow"], ["helix", "Hélice"], ["ring", "Anneau"], ["sphere", "Sphère"], ["stack", "Pile"], ["grid", "Grille"], ["list", "Liste"]), group: "Galerie" },
    { key: "selection", label: "À l'ouverture", type: "select", choices: c(["reveal", "Fiche"], ["detail", "Boîte et vignettes"], ["inline", "En place"]), group: "Galerie" },
    { key: "size", label: "Taille des photos", type: "select", choices: c(["180x225", "Petites"], ["220x275", "Moyennes"], ["280x350", "Grandes"]), group: "Galerie" },
    { key: "backdrop", label: "Fond dégradé", type: "range", min: 0, max: 1, step: 0.05, group: "Galerie" },
    { key: "tilt", label: "Inclinaison à la vitesse", type: "range", min: 0, max: 2, step: 0.05, group: "Galerie" },
  ],
  defaults: { kicker: "Travaux", title: "Six planches", arrange: "carousel", selection: "reveal", size: "220x275", backdrop: 0.6, tilt: 0.6, anchor: "travaux", print: false },
  items: photoItem([{ key: "cat", label: "Catégorie", type: "text" }]),
  defaultItems: photos(6),
  render: (b, ctx) => {
    const p = b.props;
    const n = Number(p.size === "180x225" ? 18 : p.size === "280x350" ? 26 : 22);
    return `${open(b, ctx, "ps-comp ps-galerie")}
  <div class="ps-in">
    ${compHead(b, ctx)}
    <x-galerie arrange="${esc(p.arrange)}" selection="${esc(p.selection)}" item="${esc(p.size)}" gap="${n}" backdrop="${esc(p.backdrop)}" tilt="${esc(p.tilt)}" label="${esc(str(p.title) || "Galerie")} : flèches pour parcourir, Entrée pour ouvrir">
      ${(b.items ?? []).map((it) => imgTag(it, `${attr("data-title", it.title)}${attr("data-cat", it.cat)}`)).join("\n      ")}
    </x-galerie>
  </div>
</section>`;
  },
});

def({
  type: "mur",
  label: "Mur infini",
  group: "Composant",
  glyph: "▦",
  desc: "Un mur de photos sans fin, zoom, canevas à piles, dépôt de photos",
  fields: [
    { key: "kicker", label: "Surtitre", type: "text", group: "Contenu" },
    { key: "title", label: "Titre", type: "text", group: "Contenu" },
    { key: "variety", label: "Variété des tailles", type: "range", min: 0, max: 1, step: 0.05, group: "Mur" },
    { key: "view", label: "Vue de départ", type: "select", choices: c(["grille", "Mur"], ["canevas", "Canevas (piles)"]), group: "Mur" },
    { key: "canvas", label: "Bascule vers le canevas", type: "toggle", group: "Mur" },
    { key: "drop", label: "Dépôt de photos", type: "toggle", group: "Mur" },
  ],
  defaults: { kicker: "", title: "Le mur", variety: 0.6, view: "grille", canvas: true, drop: false, print: false },
  items: photoItem([{ key: "body", label: "Texte de la page photo", type: "area" }]),
  defaultItems: photos(9, 2),
  render: (b, ctx) => {
    const p = b.props;
    return `${open(b, ctx, "ps-comp ps-mur")}
  <div class="ps-in">
    ${compHead(b, ctx)}
    <x-grille param="${esc(`photo-${b.id}`)}" variety="${esc(p.variety)}" view="${esc(p.view)}"${on(p.canvas) ? "" : ' canvas="false"'}${on(p.drop) ? "" : ' drop="false"'}${attr("kicker", p.kicker)} label="${esc(str(p.title) || "Mur de photos")} : flèches pour le parcourir">
      ${(b.items ?? []).map((it) => imgTag(it, `${attr("data-title", it.title)}${attr("data-body", it.body)}`)).join("\n      ")}
    </x-grille>
  </div>
</section>`;
  },
});

def({
  type: "liquide",
  label: "Grille liquide",
  group: "Composant",
  glyph: "◍",
  desc: "Photos en verre qui fusionnent, réordonnables, filtres par catégorie",
  fields: [
    { key: "kicker", label: "Surtitre", type: "text", group: "Contenu" },
    { key: "title", label: "Titre", type: "text", group: "Contenu" },
    { key: "filters", label: "Filtres par catégorie", type: "toggle", group: "Grille" },
  ],
  defaults: { kicker: "Sélection", title: "En verre liquide", filters: true, print: false },
  items: photoItem([{ key: "cat", label: "Catégorie", type: "text" }]),
  defaultItems: photos(4, 3),
  render: (b, ctx) => {
    const p = b.props;
    const cats = [...new Set((b.items ?? []).map((it) => str(it.cat)).filter(Boolean))];
    const filters = on(p.filters) && cats.length > 1 ? ` filters="${esc(cats.map((k) => `${k}:${k[0]!.toUpperCase()}${k.slice(1)}`).join("|"))}"` : "";
    return `${open(b, ctx, "ps-comp ps-liquide")}
  <div class="ps-in">
    ${compHead(b, ctx)}
    <x-liquide${filters} label="${esc(str(p.title) || "Photos")} : glisser, ou Alt + flèches au clavier">
      ${(b.items ?? []).map((it) => imgTag(it, `${attr("data-cat", it.cat)}${attr("data-caption", it.title)}`)).join("\n      ")}
    </x-liquide>
  </div>
</section>`;
  },
});

def({
  type: "epingle",
  label: "Section épinglée",
  group: "Image",
  glyph: "⇣",
  desc: "La section reste à l'écran ; la photo grandit, les mots arrivent un à un",
  fields: [
    ...imageFields(),
    { key: "words", label: "Phrase", type: "text", group: "Contenu" },
    { key: "material", label: "Matière", type: "select", choices: MATERIALS, group: "Effets GPU" },
  ],
  defaults: { src: "./plates/alcatraz.jpg", alt: photo("./plates/alcatraz.jpg")!.alt, words: "Une section épinglée, une photo qui grandit.", material: "lentille", print: false, space: "aucun" },
  render: (b, ctx) => {
    const p = b.props;
    const words = str(p.words)
      .split(/\s+/)
      .filter(Boolean)
      .map((w, i) => `<span style="--i: ${i}">${esc(w)}</span>`)
      .join(" ");
    return `${open(b, ctx, "ps-pin", ' data-scroll="pin"')}
  <div class="ps-pin-stage">
    ${figure(p.src, p.alt, { material: p.material, cls: "ps-pin-fig", ctx })}
    ${words ? `<p class="ps-pin-words"${ed(ctx, "words")}>${words}</p>` : ""}
  </div>
</section>`;
  },
});

def({
  type: "bandeau",
  label: "Bandeau défilant",
  group: "Texte",
  glyph: "↔",
  desc: "Une ligne de mots qui défile sans fin",
  fields: [
    { key: "text", label: "Mots", type: "text", hint: "Séparés par des virgules", group: "Contenu" },
    { key: "speed", label: "Durée d'un tour", type: "range", min: 8, max: 80, step: 1, unit: "s", group: "Mouvement" },
    { key: "reverse", label: "Sens inverse", type: "toggle", group: "Mouvement" },
  ],
  defaults: { text: "Identité, Sites, Images, Mouvement, WebGPU", speed: 32, reverse: false, print: false, space: "serre" },
  render: (b, ctx) => {
    const p = b.props;
    const words = str(p.text)
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);
    const run = words.map((w) => `<span class="ps-marquee-item">${esc(w)}</span>`).join("");
    return `${open(b, ctx, "ps-marquee", ` style="--speed: ${Number(p.speed) || 32}s"${flag("data-reverse", p.reverse)}`)}
  <p class="sr-only">${esc(words.join(", "))}</p>
  <div class="ps-marquee-track" aria-hidden="true">${run}${run}${run}${run}</div>
</section>`;
  },
});

def({
  type: "sommaire",
  label: "Sommaire en lettres",
  group: "Structure",
  glyph: "≡",
  desc: "Les sections de la page, titres découpés en lettres (pur CSS)",
  fields: [
    { key: "kicker", label: "Surtitre", type: "text", group: "Contenu" },
    { key: "auto", label: "Liens automatiques", type: "toggle", hint: "Une entrée par section qui a une ancre et un titre", group: "Contenu" },
  ],
  defaults: { kicker: "Sommaire", auto: true, print: false },
  items: linkItem("entrée"),
  defaultItems: () => [],
  render: (b, ctx) => {
    const p = b.props;
    const links: Item[] = on(p.auto)
      ? ctx.site.blocks.filter((x) => !x.hidden && str(x.props.anchor) && (str(x.props.title) || str(x.props.word))).map((x) => ({ label: str(x.props.title) || str(x.props.word), href: `#${str(x.props.anchor)}` }))
      : (b.items ?? []);
    return `${open(b, ctx, "ps-sommaire", "", "section")}
  <div class="ps-in">
    ${kicker(b, ctx)}
    <x-lettres label="${esc(str(p.kicker) || "Sommaire")}">
      ${links.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join("\n      ")}
    </x-lettres>
  </div>
</section>`;
  },
});

def({
  type: "appel",
  label: "Appel à l'action",
  group: "Matière",
  glyph: "↗",
  desc: "Une phrase, un bouton — en flammes si l'on veut",
  fields: [
    { key: "kicker", label: "Surtitre", type: "text", group: "Contenu" },
    { key: "title", label: "Titre", type: "area", group: "Contenu" },
    { key: "cta", label: "Bouton", type: "text", group: "Contenu" },
    { key: "ctaHref", label: "Adresse", type: "link", group: "Contenu" },
    { key: "fire", label: "Bouton en flammes", type: "toggle", group: "Effets GPU" },
    { key: "stage", label: "Fond de matière", type: "select", choices: STAGES, group: "Effets GPU" },
    { key: "kinetic", label: "Typo cinétique", type: "select", choices: KINETICS, group: "Effets GPU" },
    { key: "align", label: "Alignement", type: "select", choices: ALIGNS, group: "Mise en page" },
  ],
  defaults: { kicker: "Contact", title: "Un projet ? Parlons-en.", cta: "Écrire au studio", ctaHref: "mailto:bonjour@exemple.fr", fire: true, stage: "", kinetic: "", align: "centre", anchor: "contact", space: "ample" },
  render: (b, ctx) => {
    const p = b.props;
    const btn = button(p.cta, p.ctaHref, true, ctx, "cta");
    return `${open(b, ctx, "ps-cta", attr("data-align", p.align === "centre" ? "centre" : "") + attr("data-gl-stage", p.stage) + (str(p.stage) ? " data-stage" : ""))}
  <div class="ps-in">
    ${kicker(b, ctx)}
    <h2 class="ps-display" data-size="l" data-gl-text${attr("data-gl-kinetic", p.kinetic)}${ed(ctx, "title")}>${esc(p.title).replace(/\n/g, "<br />")}</h2>
    ${btn ? `<div class="ps-actions">${on(p.fire) ? `<span class="ps-fire" data-gl-stage="enveloppe">${btn}</span>` : btn}</div>` : ""}
  </div>
</section>`;
  },
});

def({
  type: "pied",
  label: "Pied de page",
  group: "Structure",
  glyph: "▁",
  desc: "Marque en très grand, liens, mentions",
  fields: [
    { key: "brand", label: "Marque", type: "text", group: "Contenu" },
    { key: "legal", label: "Mentions", type: "text", group: "Contenu" },
  ],
  defaults: { brand: "Atelier Nord", legal: "© 2026 Atelier Nord · Imprimé par le GPU, lisible sans lui.", print: false, space: "serre" },
  items: linkItem(),
  defaultItems: () => [
    { label: "Instagram", href: "#" },
    { label: "Journal", href: "#" },
    { label: "Mentions légales", href: "#" },
  ],
  render: (b, ctx) => {
    const p = b.props;
    return `${open(b, ctx, "ps-foot", "", "footer")}
  <div class="ps-in">
    <p class="ps-foot-brand" data-gl-text${ed(ctx, "brand")}>${esc(p.brand)}</p>
    <ul class="ps-foot-links">${(b.items ?? []).map((it, i) => `<li><a href="${esc(str(it.href) || "#")}"${ed(ctx, "label", i)}>${esc(it.label)}</a></li>`).join("")}</ul>
    ${str(p.legal) ? `<p class="ps-foot-legal"${ed(ctx, "legal")}>${esc(p.legal)}</p>` : ""}
  </div>
</footer>`;
  },
});

export const BLOCKS: Record<string, BlockDef> = Object.fromEntries(defs.map((d) => [d.type, d]));
export const BLOCK_LIST = defs;
export const GROUPS = ["Structure", "Texte", "Image", "Matière", "Composant"] as const;

/* ───────────────────────── Construction ───────────────────────── */

let seq = 0;
export const newId = (type: string) => `${type}-${Date.now().toString(36).slice(-4)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function makeBlock(type: string, props: Props = {}, items?: Item[]): Block {
  const d = BLOCKS[type];
  if (!d) throw new Error(`Créateur : bloc inconnu « ${type} »`);
  const b: Block = { id: newId(type), type, props: { ...d.defaults, ...props } };
  if (d.items) b.items = items ?? d.defaultItems?.() ?? [];
  return b;
}

export const DEFAULT_PAGE: Page = {
  title: "Atelier Nord",
  description: "Un site imprimé par le GPU, fait avec le Créateur de Presse.",
  lang: "fr",
  palette: "papier",
  paper: "#efeee8",
  ink: "#121212",
  spot: "#c8321c",
  type: "grotesque",
  look: "papier",
  transition: "buvard",
  effects: ["loupe", "bloom", "grain"],
  motion: "normal",
  canvasUi: "aucun",
  cursor: true,
  scroll: true,
  intro: true,
  width: "normale",
  radius: 10,
};

/** Un site réparé : champs manquants remis à leur valeur par défaut, blocs inconnus écartés (import d'un JSON). */
export function normalize(raw: unknown): Site {
  const r = (raw ?? {}) as Partial<Site>;
  const page = { ...DEFAULT_PAGE, ...(r.page ?? {}) } as Page;
  if (!Array.isArray(page.effects)) page.effects = [...DEFAULT_PAGE.effects];
  const blocks = (Array.isArray(r.blocks) ? r.blocks : [])
    .filter((b): b is Block => !!b && typeof b === "object" && typeof (b as Block).type === "string" && !!BLOCKS[(b as Block).type])
    .map((b) => {
      const d = BLOCKS[b.type]!;
      const out: Block = { id: typeof b.id === "string" && b.id ? b.id : newId(b.type), type: b.type, props: { ...d.defaults, ...(b.props ?? {}) } };
      if (d.items) out.items = Array.isArray(b.items) ? b.items.map((it) => ({ ...it })) : (d.defaultItems?.() ?? []);
      if (b.hidden) out.hidden = true;
      return out;
    });
  // Identifiants uniques (un JSON édité à la main peut en dupliquer).
  const seen = new Set<string>();
  for (const b of blocks) {
    if (seen.has(b.id)) b.id = newId(b.type);
    seen.add(b.id);
  }
  return { v: 1, name: typeof r.name === "string" && r.name ? r.name : page.title, page, blocks };
}

/* ───────────────────────── Compilation ───────────────────────── */

/** Couleurs de la page : palette nommée, ou couleurs libres. */
export function colors(page: Page) {
  const pal = PALETTES[page.palette];
  const libre = !pal || page.palette === "libre";
  const paper = libre ? page.paper : pal.paper;
  const ink = libre ? page.ink : pal.ink;
  const spot = libre ? page.spot : pal.spot;
  const dark = libre ? luminance(paper) < 0.4 : !!pal.dark;
  return { paper, ink, spot, dark };
}
export function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = Number.parseInt(m[1]!, 16);
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}
/** Contraste WCAG entre deux couleurs (1 à 21). */
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

/** Les attributs de <html> qui règlent le moteur et le kit. */
export function htmlAttrs(page: Page, o: { preview?: boolean } = {}): Record<string, string> {
  const col = colors(page);
  const a: Record<string, string> = {
    lang: page.lang || "fr",
    "data-presse-look": page.look,
    "data-presse-transition": page.transition,
    "data-presse-effects": page.effects.join(" "),
    "data-presse-motion": page.motion,
    "data-ps-type": page.type,
  };
  if (page.canvasUi && page.canvasUi !== "aucun") a["data-presse-canvas-ui"] = page.canvasUi;
  if (page.scroll) a["data-presse-scroll"] = "doux";
  if (page.cursor) a["data-presse-cursor"] = "";
  if (page.intro && !o.preview) a["data-presse-intro"] = col.paper;
  if (col.dark) a["data-ps-dark"] = "";
  return a;
}
/** Les jetons CSS de :root. */
export function rootCss(page: Page) {
  const col = colors(page);
  return `:root { --paper: ${col.paper}; --ink: ${col.ink}; --spot: ${col.spot}; --ps-max: ${WIDTH_PX[page.width] ?? WIDTH_PX.normale}; --ps-radius: ${Math.max(0, Number(page.radius) || 0)}px; }`;
}

export function renderBlock(b: Block, site: Site, preview = false) {
  const d = BLOCKS[b.type];
  if (!d) return "";
  return d.render(b, { preview, site });
}
export const renderBody = (site: Site, preview = false) =>
  site.blocks
    .filter((b) => !b.hidden)
    .map((b) => renderBlock(b, site, preview))
    .join("\n\n");

/**
 * La page source complète, à poser à la racine d'un projet Presse (à côté de index.html) : `npm run build` la déroule,
 * prépare ses images, en fait l'atlas des titres. `entry` : le module du kit (par défaut celui du projet).
 */
export function compileSite(site: Site, o: { entry?: string } = {}) {
  const page = site.page;
  const attrs = Object.entries(htmlAttrs(page))
    .map(([k, v]) => (v === "" ? ` ${k}` : ` ${k}="${esc(v)}"`))
    .join("");
  // La navigation en tête et le pied en fin restent hors de <main> (repères de page).
  const shown = site.blocks.filter((b) => !b.hidden);
  let a0 = 0;
  while (a0 < shown.length && shown[a0]!.type === "nav") a0++;
  let a1 = shown.length;
  while (a1 > a0 && shown[a1 - 1]!.type === "pied") a1--;
  const part = (bs: Block[], pad: string) =>
    bs
      .map((b) => renderBlock(b, site))
      .join("\n\n")
      .split("\n")
      .map((l) => (l ? pad + l : l))
      .join("\n");
  const head = part(shown.slice(0, a0), "    ");
  const main = part(shown.slice(a0, a1), "      ");
  const foot = part(shown.slice(a1), "    ");
  return `<!doctype html>
<html${attrs}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(page.title)}</title>
    <meta name="description" content="${esc(page.description)}" />
    <meta name="generator" content="Presse — Créateur" />
    <style>
      ${rootCss(page)}
    </style>
    <script type="module" src="${esc(o.entry ?? "/src/presse/site.ts")}"></script>
  </head>
  <body class="ps">
${head ? head + "\n" : ""}    <main>
${main}
    </main>
${foot ? foot + "\n" : ""}  </body>
</html>
`;
}
