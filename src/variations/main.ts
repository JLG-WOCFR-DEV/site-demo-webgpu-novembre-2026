/**
 * Variations — explorer des directions artistiques pour une page Presse (d'après l'idée de Shaper : des variations en
 * quelques secondes sur la même composition, des jetons qu'on règle en direct, des instantanés qu'on échange).
 *
 * Le modèle et le générateur sont dans src/presse/variations.ts (pur, testé) ; ici, l'interface :
 *   à gauche   les jetons, par famille, chacune avec son verrou et son re-tirage ;
 *   au centre  la composition de référence (une page Presse réduite), en grand, et le rideau A / B ;
 *              la bande d'instantanés ; la planche de vignettes (la même composition, N systèmes) ;
 *   à droite   l'aperçu du code (CSS, attributs, JSON), le téléchargement, le Créateur, le lien `?systeme=`.
 * Tout est DOM : chaque vignette est un clone de la composition, avec les variables du système posées sur elle et
 * l'étalonnage du look en filtre SVG (le même que src/presse/look.ts). `?webgpu` : la planche est aussi rendue par le
 * GPU (src/variations/planche-gpu.ts), avec repli sur le DOM.
 */
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/bodoni-moda/index.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./style.css";
import { mountPagesNav } from "../pages-nav.ts";
import { filtreLook, LOOKS, tuileGrain } from "../presse/look.ts";
import { contrasteHex, contrasteSous, hex, versRvb, type Oklch } from "../presse/oklch.ts";
import {
  attributsTexte,
  COURBES,
  couleurs,
  croiserSystemes,
  css,
  decoderSysteme,
  DECALAGES,
  EFFETS,
  empreinte,
  encoderSysteme,
  FAMILLES,
  genererSysteme,
  HARMONIES,
  INTENSITES,
  lireSysteme,
  LOOKS_IDS,
  muterSysteme,
  NOMS_COURBES,
  NOMS_FAMILLES,
  NOMS_HARMONIES,
  POLICES,
  POLICES_IDS,
  RAPPORTS,
  resoudrePalette,
  resume,
  serialiser,
  TRANSITIONS_DIAPO,
  TRANSITIONS_PAGE,
  variables,
  verrousDe,
  versCreateur,
  type Courbe,
  type Famille,
  type Harmonie,
  type Police,
  type Systeme,
} from "../presse/variations.ts";

/* ───────────────────────── Icônes (24 × 24, à traits) ───────────────────────── */

const svg = (d: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const ICO: Record<string, string> = {
  tirer: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  coeur: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  annuler: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  retablir: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  ab: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><path d="M6.5 14 8 9l1.5 5M7 12.5h2"/><path d="M15 9h2a1.2 1.2 0 0 1 0 2.5h-2V9zm0 2.5h2.4a1.3 1.3 0 0 1 0 2.5H15z"/>',
  rejouer: '<path d="M7 5v14l11-7z"/>',
  verrou: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ouvert: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  graine: '<path d="M12 21c-4 0-7-3-7-7 0-5 7-11 7-11s7 6 7 11c0 4-3 7-7 7z"/><path d="M12 21v-7"/>',
  jetons: '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  exporter: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  importer: '<path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  telecharger: '<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
  copier: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  lien: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  ouvrir: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  createur: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  planche: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  grille: '<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>',
  intensite: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6" stroke-dasharray="2 2.4"/><circle cx="12" cy="12" r="10" stroke-dasharray="1.5 3"/>',
  tirage: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>',
  voisines: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="1.6"/><circle cx="19" cy="7" r="1.6"/><circle cx="18" cy="18" r="1.6"/><circle cx="6" cy="18" r="1.6"/>',
  croisement: '<path d="M4 4c8 0 8 16 16 16M4 20c8 0 8-16 16-16"/>',
  soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  lune: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  teinte: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  clarte: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  chroma: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
  taille: '<path d="M4 18 9 6l5 12M5.8 14h6.4"/><path d="M15 18l3-7 3 7M15.9 16h4.2"/>',
  rapport: '<path d="M4 20h4v-4H4zM10 20h5v-7h-5zM17 20h4V8h-4z"/>',
  graisse: '<path d="M7 19V5h6a3.5 3.5 0 0 1 0 7H7m0 0h7a3.5 3.5 0 0 1 0 7H7" stroke-width="2.6"/>',
  largeur: '<path d="M3 12h18"/><path d="m6 9-3 3 3 3M18 9l3 3-3 3"/><path d="M8 5v3M16 5v3M8 16v3M16 16v3"/>',
  interligne: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M5 4v16"/><path d="m3 6 2-2 2 2M3 18l2 2 2-2"/>',
  approche: '<path d="M3 17 6 7l3 10M4 14h4"/><path d="M15 7v10"/><path d="m11 12 2-2v4zM21 12l-2-2v4z"/>',
  capitales: '<path d="M3 18 7 6l4 12M4.4 14h5.2"/><path d="M13 18l4-12 4 12M14.4 14h5.2"/>',
  espace: '<rect x="3" y="8" width="5" height="8" rx="1"/><rect x="16" y="8" width="5" height="8" rx="1"/><path d="M10 12h4"/><path d="m11 10.5-1.5 1.5 1.5 1.5M13 10.5l1.5 1.5-1.5 1.5"/>',
  rayon: '<path d="M4 20V12a8 8 0 0 1 8-8h8"/>',
  filet: '<path d="M3 8h18" stroke-width="1"/><path d="M3 15h18" stroke-width="3"/>',
  ombre: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M8 20h10a2 2 0 0 0 2-2V8" stroke-width="2.6" opacity="0.55"/>',
  duree: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4"/>',
  transitionPage: '<rect x="3" y="5" width="12" height="14" rx="1.5"/><path d="M9 5h10.5a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H9" stroke-dasharray="2 2"/>',
  transitionDiapo: '<rect x="2" y="6" width="14" height="10" rx="1.5"/><rect x="8" y="9" width="14" height="10" rx="1.5"/>',
  grain: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h.01M12 7h.01M16 9h.01M8 13h.01M13 12h.01M17 14h.01M7 17h.01M11 17h.01M15 18h.01" stroke-width="2.4"/>',
  vignette: '<rect x="3" y="4" width="18" height="16" rx="2"/><ellipse cx="12" cy="12" rx="5.5" ry="4.5" stroke-dasharray="2 2"/>',
  look: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  ajuste: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  retirer: '<path d="M6 6l12 12M18 6 6 18"/>',
  b: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9.5 8h3a2 2 0 0 1 0 4h-3zm0 4h3.5a2 2 0 0 1 0 4H9.5z"/>',
  // Familles
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-1 1.1-1.9-.6-1 .1-2.1 1.3-2.1H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  typo: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
  forme: '<rect x="3" y="3" width="8" height="8" rx="3"/><circle cx="17" cy="7" r="4"/><path d="M3 21l4-7 4 7z"/><rect x="13" y="13" width="8" height="8"/>',
  mouvement: '<path d="M3 17c4 0 5-10 9-10s5 10 9 10"/><circle cx="12" cy="7" r="1.6" fill="currentColor"/>',
  // Harmonies : la roue et les teintes prises
  analogue: '<circle cx="12" cy="12" r="9" opacity="0.35"/><circle cx="12" cy="3" r="2" fill="currentColor"/><circle cx="16.8" cy="4.4" r="2" fill="currentColor"/><circle cx="7.2" cy="4.4" r="2" fill="currentColor"/>',
  complementaire: '<circle cx="12" cy="12" r="9" opacity="0.35"/><circle cx="12" cy="3" r="2" fill="currentColor"/><circle cx="12" cy="21" r="2" fill="currentColor"/>',
  scindee: '<circle cx="12" cy="12" r="9" opacity="0.35"/><circle cx="12" cy="3" r="2" fill="currentColor"/><circle cx="16.5" cy="19.8" r="2" fill="currentColor"/><circle cx="7.5" cy="19.8" r="2" fill="currentColor"/>',
  triade: '<circle cx="12" cy="12" r="9" opacity="0.35"/><circle cx="12" cy="3" r="2" fill="currentColor"/><circle cx="19.8" cy="16.5" r="2" fill="currentColor"/><circle cx="4.2" cy="16.5" r="2" fill="currentColor"/>',
  tetrade: '<circle cx="12" cy="12" r="9" opacity="0.35"/><circle cx="12" cy="3" r="2" fill="currentColor"/><circle cx="21" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="21" r="2" fill="currentColor"/><circle cx="3" cy="12" r="2" fill="currentColor"/>',
  monochrome: '<circle cx="12" cy="12" r="9" opacity="0.35"/><circle cx="12" cy="3" r="2.6" fill="currentColor"/><circle cx="12" cy="3" r="5" opacity="0.6"/>',
  // Courbes
  out: '<path d="M4 20C6 6 12 4 20 4"/>',
  inOut: '<path d="M4 20c8 0 8-16 16-16"/>',
  ressort: '<path d="M4 20c3-14 6-18 9-15s4 3 7 1"/>',
  net: '<path d="M4 20c1-12 3-16 16-16"/>',
  // Intensités
  sobre: '<path d="M4 12h16"/>',
  normal: '<path d="M3 12c3-5 6-5 9 0s6 5 9 0"/>',
  expressif: '<path d="M2 12c2-8 4-8 5 0s3 8 5 0 3-8 5 0 3 8 5 0"/>',
  // Effets de chaîne
  loupe: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  rvb: '<circle cx="9" cy="10" r="5"/><circle cx="15" cy="10" r="5"/><circle cx="12" cy="15" r="5"/>',
  trame: '<circle cx="6" cy="6" r="1.8"/><circle cx="12" cy="6" r="1.2"/><circle cx="18" cy="6" r="0.7"/><circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="0.8"/><circle cx="6" cy="18" r="0.7"/>',
  bloom: '<circle cx="12" cy="12" r="3.5" fill="currentColor"/><circle cx="12" cy="12" r="7" opacity="0.5"/><circle cx="12" cy="12" r="10" opacity="0.25"/>',
  courbure: '<path d="M4 6c5-2 11-2 16 0v12c-5 2-11 2-16 0z"/>',
};
const ico = (n: string) => svg(ICO[n] ?? "");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ───────────────────────── Stockage (tout en try/catch) ───────────────────────── */

const CLE_COURANT = "presse-variations:courant";
const CLE_INSTANTANES = "presse-variations:instantanes";
const CLE_UI = "presse-variations:ui";
const CLE_CREATEUR = "presse-createur:v1";
const stock = {
  lire(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  ecrire(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
};

/* ───────────────────────── État ───────────────────────── */

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const params = new URLSearchParams(location.search);
const MOUVEMENT_REDUIT = matchMedia("(prefers-reduced-motion: reduce)");

type Mode = "tirage" | "voisines" | "croisement";
type Ui = { verrous: Famille[]; mode: Mode; nombre: number; intensite: number; onglet: "css" | "attributs" | "json"; tirage: number; couleur: string; lienPage: string };
const ui: Ui = (() => {
  const d: Ui = { verrous: [], mode: "tirage", nombre: 9, intensite: 0.35, onglet: "css", tirage: 2026, couleur: "papier", lienPage: "boutique.html" };
  try {
    return { ...d, ...(JSON.parse(stock.lire(CLE_UI) ?? "{}") as Partial<Ui>) };
  } catch {
    return d;
  }
})();
const sauverUi = () => stock.ecrire(CLE_UI, JSON.stringify(ui));
const verrous = new Set<Famille>(ui.verrous.filter((f) => (FAMILLES as readonly string[]).includes(f)));

let courant: Systeme = (() => {
  try {
    if (params.get("systeme")) return decoderSysteme(params.get("systeme")!);
  } catch {
    /* adresse abîmée : on prend le reste */
  }
  try {
    const raw = stock.lire(CLE_COURANT);
    if (raw) return lireSysteme(raw);
  } catch {
    /* stockage abîmé */
  }
  return genererSysteme(2026);
})();
let retouches: string[] = [];
let planche: Systeme[] = [];
let instantanes: Systeme[] = (() => {
  try {
    const raw = JSON.parse(stock.lire(CLE_INSTANTANES) ?? "[]") as unknown[];
    return Array.isArray(raw) ? raw.map((x) => lireSysteme(x)) : [];
  } catch {
    return [];
  }
})();
let systemeB: Systeme | null = null;
let abActif = false;
let rideau = 50;

/* ───────────────────────── Historique ───────────────────────── */

const passe: string[] = [];
const futur: string[] = [];
let cleRegroupe = "";
let tRegroupe = 0;

/**
 * Le seul chemin de modification du système courant. `cle` regroupe les changements rapprochés d'un même réglage (un
 * curseur qu'on tire) en une seule étape d'historique.
 */
function appliquer(s: Systeme, o: { cle?: string; histoire?: boolean; animer?: boolean; dire?: string } = {}) {
  const avant = serialiser(courant, 0);
  const apres = serialiser(s, 0);
  if (avant === apres) return;
  if (o.histoire !== false) {
    const t = performance.now();
    if (!(o.cle && o.cle === cleRegroupe && t - tRegroupe < 700)) {
      passe.push(avant);
      if (passe.length > 200) passe.shift();
    }
    cleRegroupe = o.cle ?? "";
    tRegroupe = t;
    futur.length = 0;
  }
  courant = s;
  stock.ecrire(CLE_COURANT, apres);
  rendre({ animer: o.animer ?? !o.cle });
  if (o.dire) dire(o.dire);
}
function annuler() {
  const x = passe.pop();
  if (!x) return dire("Rien à annuler.");
  futur.push(serialiser(courant, 0));
  courant = lireSysteme(x);
  cleRegroupe = "";
  stock.ecrire(CLE_COURANT, x);
  rendre({ animer: false });
  dire(`Annulé : ${courant.nom}.`);
}
function retablir() {
  const x = futur.pop();
  if (!x) return dire("Rien à rétablir.");
  passe.push(serialiser(courant, 0));
  courant = lireSysteme(x);
  cleRegroupe = "";
  stock.ecrire(CLE_COURANT, x);
  rendre({ animer: false });
  dire(`Rétabli : ${courant.nom}.`);
}

/** Un système tiré avec les verrous de l'interface. */
const tirerAvecVerrous = (graine: number) => genererSysteme(graine, {}, verrousDe(courant, verrous));

/* ───────────────────────── Composition (DOM) ───────────────────────── */

const modele = $<HTMLTemplateElement>("#vr-modele");
/** Les filtres SVG d'étalonnage, un par look (ceux de look.ts), posés une fois. */
function poserFiltres() {
  const NS = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("class", "vr-filtres");
  s.innerHTML = `<defs>${LOOKS_IDS.map((n) => filtreLook(n, `vr-look-${n}`)).join("")}</defs>`;
  document.body.prepend(s);
  document.documentElement.style.setProperty("--vr-grain-tuile", `url(${tuileGrain()})`);
}
/** Une composition neuve, dans son cadre (étalonnage, grain, vignette en couches). */
function composition(cls = "") {
  const cadre = document.createElement("div");
  cadre.className = `vr-compo-cadre ${cls}`;
  cadre.append(modele.content.cloneNode(true));
  const g = document.createElement("div");
  g.className = "vr-grain";
  const v = document.createElement("div");
  v.className = "vr-vignette";
  cadre.append(g, v);
  return cadre;
}
/** Pose un système sur une composition : variables CSS, étalonnage, grain, vignette, mouvement. */
function habiller(cadre: HTMLElement, s: Systeme) {
  const compo = cadre.querySelector<HTMLElement>(".vr-compo")!;
  for (const [k, v] of Object.entries(variables(s))) compo.style.setProperty(k, v);
  compo.style.setProperty("--vr-amplitude", s.mouvement.intensite === "sobre" ? "0.35em" : s.mouvement.intensite === "expressif" ? "1.4em" : "0.75em");
  compo.dataset.vrCapitales = String(s.typo.capitales);
  compo.dataset.vrSombre = String(s.palette.sombre);
  compo.style.filter = filtreLook(s.look.nom) ? `url(#vr-look-${s.look.nom})` : "";
  cadre.querySelector<HTMLElement>(".vr-grain")!.style.opacity = String(s.look.grain);
  cadre.querySelector<HTMLElement>(".vr-vignette")!.style.setProperty("--vr-vignette", String(s.look.vignette));
}
function rejouer(cadre: HTMLElement) {
  const compo = cadre.querySelector<HTMLElement>(".vr-compo")!;
  compo.classList.remove("vr-entre");
  void compo.offsetWidth;
  compo.classList.add("vr-entre");
}

const scene = $("[data-vr-scene]");
const calqueA = $("[data-vr-calque='a']");
const calqueB = $("[data-vr-calque='b']");
const cadreA = composition("vr-compo-grand");
calqueA.append(cadreA);
const cadreB = composition("vr-compo-grand");
cadreB.querySelector(".vr-compo")!.setAttribute("aria-hidden", "true");
cadreB.inert = true;
calqueB.append(cadreB);

/* ───────────────────────── Jetons (panneau de gauche) ───────────────────────── */

type Controle = { famille: Famille; el: HTMLElement; maj: () => void };
const controles: Controle[] = [];
const famillesEl = $("[data-vr-familles]");

function bouton(nom: string, label: string, extra = "") {
  return `<button type="button" class="vr-btn-ico vr-petit" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${ico(nom)}</button>`;
}
/** Un curseur à icône : libellé dit (lecteurs d'écran, infobulle), valeur affichée à côté. */
function curseur(f: Famille, o: { id: string; label: string; icone: string; min: number; max: number; pas: number; lire: () => number; ecrire: (v: number) => void; texte?: (v: number) => string; quand?: () => boolean; classe?: string }) {
  const el = document.createElement("div");
  el.className = `vr-champ ${o.classe ?? ""}`;
  el.title = o.label;
  el.innerHTML = `<label class="vr-champ-lab" for="vr-${o.id}"><span class="vr-ico" aria-hidden="true">${ico(o.icone)}</span><span class="sr-only">${esc(o.label)}</span></label><input id="vr-${o.id}" type="range" min="${o.min}" max="${o.max}" step="${o.pas}" /><output for="vr-${o.id}" aria-hidden="true"></output>`;
  const input = el.querySelector("input")!;
  const out = el.querySelector("output")!;
  input.addEventListener("input", () => {
    o.ecrire(Number(input.value));
    out.textContent = o.texte ? o.texte(Number(input.value)) : input.value;
  });
  const maj = () => {
    const v = o.lire();
    input.value = String(v);
    const t = o.texte ? o.texte(v) : String(v);
    out.textContent = t;
    input.setAttribute("aria-valuetext", t);
    el.hidden = o.quand ? !o.quand() : false;
  };
  controles.push({ famille: f, el, maj });
  return el;
}
/** Un groupe de boutons à icône, un seul choisi (radiogroup, flèches pour changer). */
function segments<T extends string>(f: Famille, o: { label: string; choix: readonly T[]; nom: (c: T) => string; icone?: (c: T) => string; html?: (c: T) => string; lire: () => T; ecrire: (c: T) => void }) {
  const el = document.createElement("div");
  el.className = "vr-seg";
  el.setAttribute("role", "radiogroup");
  el.setAttribute("aria-label", o.label);
  el.title = o.label;
  el.innerHTML = o.choix
    .map((c) => `<button type="button" role="radio" data-c="${esc(c)}" aria-label="${esc(o.nom(c))}" title="${esc(o.nom(c))}">${o.html ? o.html(c) : ico(o.icone ? o.icone(c) : c)}</button>`)
    .join("");
  const btns = [...el.querySelectorAll<HTMLButtonElement>("button")];
  btns.forEach((b, i) => {
    b.addEventListener("click", () => o.ecrire(b.dataset.c as T));
    b.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = btns[(i + d + btns.length) % btns.length]!;
      n.focus();
      o.ecrire(n.dataset.c as T);
    });
  });
  const maj = () => {
    const v = o.lire();
    for (const b of btns) {
      const on = b.dataset.c === v;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
  };
  controles.push({ famille: f, el, maj });
  return el;
}
/** Un menu déroulant à icône. */
function menu(f: Famille, o: { id: string; label: string; icone: string; choix: readonly (readonly [string, string])[]; lire: () => string; ecrire: (v: string) => void }) {
  const el = document.createElement("div");
  el.className = "vr-champ vr-champ-menu";
  el.title = o.label;
  el.innerHTML = `<label class="vr-champ-lab" for="vr-${o.id}"><span class="vr-ico" aria-hidden="true">${ico(o.icone)}</span><span class="sr-only">${esc(o.label)}</span></label><select id="vr-${o.id}">${o.choix.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("")}</select>`;
  const sel = el.querySelector("select")!;
  sel.addEventListener("change", () => o.ecrire(sel.value));
  controles.push({ famille: f, el, maj: () => (sel.value = o.lire()) });
  return el;
}
/** Un interrupteur à icône (aria-pressed). */
function bascule(f: Famille, o: { label: string; icone: string | (() => string); lire: () => boolean; ecrire: (v: boolean) => void }) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "vr-btn-ico vr-petit vr-bascule";
  el.setAttribute("aria-label", o.label);
  el.title = o.label;
  el.addEventListener("click", () => o.ecrire(!o.lire()));
  controles.push({
    famille: f,
    el,
    maj: () => {
      el.setAttribute("aria-pressed", String(o.lire()));
      el.innerHTML = ico(typeof o.icone === "function" ? o.icone() : o.icone);
    },
  });
  return el;
}

/** Modifie une famille du système courant (copie), en regroupant les gestes d'un même réglage. */
function modifier(cle: string, f: (s: Systeme) => void, o: { palette?: boolean } = {}) {
  const s = lireSysteme(JSON.parse(serialiser(courant, 0)));
  f(s);
  if (o.palette) {
    const r = resoudrePalette(s.palette, s.look.nom);
    s.palette = r.palette;
    retouches = r.retouches;
  } else if (cle.startsWith("look")) {
    // Un look qui assombrirait les noirs ou désaturerait : le solveur repasse, la palette se tient.
    const r = resoudrePalette(s.palette, s.look.nom);
    s.palette = r.palette;
    retouches = r.retouches;
  } else retouches = [];
  appliquer(s, { cle, animer: false });
}

/* Les couleurs : une rangée de pastilles, et trois curseurs L / C / h pour celle qu'on a choisie. */
type RoleCouleur = { id: string; nom: string; lire: (s: Systeme) => Oklch | undefined; ecrire: (s: Systeme, o: Oklch) => void; cible: number };
const ROLES: RoleCouleur[] = [
  { id: "papier", nom: "Papier", lire: (s) => s.palette.papier, ecrire: (s, o) => {
    const d = [s.palette.surfaces[0][0] - s.palette.papier[0], s.palette.surfaces[1][0] - s.palette.papier[0]];
    s.palette.papier = o;
    s.palette.surfaces = [[o[0] + d[0]!, s.palette.surfaces[0][1], o[2]], [o[0] + d[1]!, s.palette.surfaces[1][1], o[2]]];
  }, cible: 0 },
  { id: "encre", nom: "Encre", lire: (s) => s.palette.encre, ecrire: (s, o) => (s.palette.encre = o), cible: 4.5 },
  { id: "accent-0", nom: "Accent 1 (texte)", lire: (s) => s.palette.accents[0], ecrire: (s, o) => (s.palette.accents[0] = o), cible: 4.5 },
  { id: "accent-1", nom: "Accent 2", lire: (s) => s.palette.accents[1], ecrire: (s, o) => (s.palette.accents[1] = o), cible: 3 },
  { id: "accent-2", nom: "Accent 3", lire: (s) => s.palette.accents[2], ecrire: (s, o) => (s.palette.accents[2] = o), cible: 3 },
  { id: "surface-0", nom: "Surface 1", lire: (s) => s.palette.surfaces[0], ecrire: (s, o) => (s.palette.surfaces[0] = o), cible: 0 },
  { id: "surface-1", nom: "Surface 2", lire: (s) => s.palette.surfaces[1], ecrire: (s, o) => (s.palette.surfaces[1] = o), cible: 0 },
];
const role = () => ROLES.find((r) => r.id === ui.couleur && r.lire(courant)) ?? ROLES[0]!;

function pastilles() {
  const el = document.createElement("div");
  el.className = "vr-pastilles";
  el.setAttribute("role", "radiogroup");
  el.setAttribute("aria-label", "Couleur à régler");
  const maj = () => {
    const c = couleurs(courant);
    const pap = hex(c.papier);
    el.innerHTML = ROLES.filter((r) => r.lire(courant))
      .map((r) => {
        const h = hex(r.lire(courant)!);
        const cr = r.cible ? contrasteHex(h, pap) : 0;
        const aj = retouches.some((x) => (r.id === "encre" && x === "encre") || (r.id.startsWith("accent-") && x === `accent ${Number(r.id.slice(7)) + 1}`));
        const nom = `${r.nom} ${h}${r.cible ? `, contraste ${cr.toFixed(1)} sur le papier` : ""}${aj ? ", ajusté par le solveur" : ""}`;
        return `<button type="button" role="radio" class="vr-pastille" data-role="${r.id}" aria-checked="${r.id === role().id}" tabindex="${r.id === role().id ? 0 : -1}" aria-label="${esc(nom)}" title="${esc(nom)}" style="--c:${h}"><span class="vr-pastille-c" aria-hidden="true"></span>${r.cible ? `<span class="vr-pastille-cr" aria-hidden="true">${cr.toFixed(1)}</span>` : ""}${aj ? `<span class="vr-pastille-aj" aria-hidden="true">${ico("ajuste")}</span>` : ""}</button>`;
      })
      .join("");
    const btns = [...el.querySelectorAll<HTMLButtonElement>("button")];
    btns.forEach((b, i) => {
      b.addEventListener("click", () => {
        ui.couleur = b.dataset.role!;
        sauverUi();
        majControles();
        el.querySelector<HTMLButtonElement>(`[data-role="${ui.couleur}"]`)?.focus();
      });
      b.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        ui.couleur = btns[(i + d + btns.length) % btns.length]!.dataset.role!;
        majControles();
        el.querySelector<HTMLButtonElement>(`[data-role="${ui.couleur}"]`)?.focus();
      });
    });
  };
  controles.push({ famille: "palette", el, maj });
  return el;
}
function teinteFond(el: HTMLElement) {
  const o = role().lire(courant)!;
  const pas = Array.from({ length: 13 }, (_, i) => hex([o[0], Math.max(o[1], 0.08), i * 30])).join(", ");
  el.style.setProperty("--vr-piste", `linear-gradient(90deg, ${pas})`);
}

function construireFamilles() {
  const cadres: Record<Famille, (corps: HTMLElement) => void> = {
    palette: (c) => {
      const ligne = document.createElement("div");
      ligne.className = "vr-ligne";
      ligne.append(
        segments("palette", {
          label: "Harmonie",
          choix: HARMONIES,
          nom: (h) => `Harmonie ${NOMS_HARMONIES[h].toLowerCase()}`,
          lire: () => courant.palette.harmonie,
          ecrire: (h: Harmonie) => {
            // Une harmonie nouvelle : les accents reprennent ses teintes depuis la teinte de base.
            modifier("harmonie", (s) => {
              s.palette.harmonie = h;
              s.palette.accents = s.palette.accents.map((a, i) => [a[0], h === "monochrome" ? a[1] * 0.8 : a[1], (s.palette.teinte + DECALAGES[h][i]! + 360) % 360] as Oklch);
            }, { palette: true });
          },
        }),
      );
      c.append(ligne);
      const l2 = document.createElement("div");
      l2.className = "vr-ligne";
      l2.append(
        bascule("palette", {
          label: "Palette sombre",
          icone: () => (courant.palette.sombre ? "lune" : "soleil"),
          lire: () => courant.palette.sombre,
          ecrire: (v) => {
            // Bascule clair / sombre : on re-tire la palette de cette graine avec la contrainte, teinte et harmonie gardées.
            const s = genererSysteme(courant.graine, { sombre: v, teinte: courant.palette.teinte, harmonie: courant.palette.harmonie, accents: courant.palette.accents.length as 1 | 2 | 3 }, verrousDe(courant, ["typo", "forme", "mouvement", "look"]));
            appliquer({ ...s, nom: courant.nom }, { dire: v ? "Palette sombre." : "Palette claire." });
          },
        }),
        segments("palette", {
          label: "Nombre d'accents",
          choix: ["1", "2", "3"] as const,
          nom: (n) => `${n} accent${n === "1" ? "" : "s"}`,
          html: (n) => `<span class="vr-points" aria-hidden="true">${"●".repeat(Number(n))}</span>`,
          lire: () => String(courant.palette.accents.length) as "1" | "2" | "3",
          ecrire: (n) =>
            modifier("accents", (s) => {
              const k = Number(n);
              const dec = DECALAGES[s.palette.harmonie];
              while (s.palette.accents.length < k) {
                const i = s.palette.accents.length;
                const a0 = s.palette.accents[0]!;
                s.palette.accents.push([a0[0], a0[1], (s.palette.teinte + dec[i]! + 360) % 360]);
              }
              s.palette.accents.length = k;
              if (!s.palette.accents[Number(ui.couleur.slice(7))] && ui.couleur.startsWith("accent")) ui.couleur = "accent-0";
            }, { palette: true }),
        }),
      );
      c.append(l2, pastilles());
      c.append(
        curseur("palette", { id: "teinte-base", label: "Teinte de base (tourne toute la palette)", icone: "palette", min: 0, max: 359, pas: 1, lire: () => Math.round(courant.palette.teinte), texte: (v) => `${v}°`, ecrire: (v) => modifier("teinte-base", (s) => {
          const d = v - s.palette.teinte;
          s.palette.teinte = v;
          const t = (o: Oklch): Oklch => [o[0], o[1], (o[2] + d + 360) % 360];
          s.palette.papier = t(s.palette.papier);
          s.palette.encre = t(s.palette.encre);
          s.palette.accents = s.palette.accents.map(t);
          s.palette.surfaces = s.palette.surfaces.map(t) as [Oklch, Oklch];
        }, { palette: true }) }),
      );
      const lch = (k: 0 | 1 | 2, id: string, label: string, icone: string, min: number, max: number, pas: number, texte: (v: number) => string) =>
        curseur("palette", {
          id,
          label,
          icone,
          min,
          max,
          pas,
          texte,
          classe: k === 2 ? "vr-champ-teinte" : "",
          lire: () => {
            const o = role().lire(courant)!;
            return k === 2 ? Math.round(o[2]) : +o[k].toFixed(3);
          },
          ecrire: (v) =>
            modifier(`couleur-${ui.couleur}-${k}`, (s) => {
              const r = role();
              const o = [...r.lire(s)!] as Oklch;
              o[k] = v;
              r.ecrire(s, o);
            }, { palette: true }),
        });
      c.append(
        lch(0, "clarte", "Clarté (L) de la couleur choisie", "clarte", 0, 1, 0.005, (v) => `${Math.round(v * 100)} %`),
        lch(1, "chroma", "Chroma (C) de la couleur choisie", "chroma", 0, 0.32, 0.002, (v) => v.toFixed(3)),
        lch(2, "teinte", "Teinte (h) de la couleur choisie", "teinte", 0, 359, 1, (v) => `${v}°`),
      );
    },
    typo: (c) => {
      const police = (cle: "titre" | "texte", label: string, choix: Police[]) =>
        segments("typo", {
          label,
          choix,
          nom: (p) => `${label} : ${POLICES[p].nom}`,
          html: (p) => `<span class="vr-aa" style="font-family:${esc(POLICES[p].pile)}" aria-hidden="true">Aa</span>`,
          lire: () => courant.typo[cle],
          ecrire: (p) =>
            modifier(`police-${cle}`, (s) => {
              s.typo[cle] = p;
              if (cle === "titre") {
                const [g0, g1] = POLICES[p].graisses;
                s.typo.graisseTitre = Math.min(g1, Math.max(g0, s.typo.graisseTitre));
              }
            }),
        });
      const l1 = document.createElement("div");
      l1.className = "vr-ligne vr-ligne-polices";
      l1.innerHTML = `<span class="vr-mini-lab" aria-hidden="true">Titre</span>`;
      l1.append(police("titre", "Police des titres", POLICES_IDS));
      const l2 = document.createElement("div");
      l2.className = "vr-ligne vr-ligne-polices";
      l2.innerHTML = `<span class="vr-mini-lab" aria-hidden="true">Texte</span>`;
      l2.append(police("texte", "Police du texte", POLICES_IDS.filter((p) => POLICES[p].texte)));
      c.append(l1, l2);
      const NOMS_RAPPORTS = ["seconde majeure", "tierce mineure", "tierce majeure", "quarte", "quarte augmentée", "quinte", "nombre d'or"];
      c.append(
        curseur("typo", { id: "rapport", label: "Rapport de l'échelle typographique", icone: "rapport", min: 0, max: RAPPORTS.length - 1, pas: 1, lire: () => Math.max(0, RAPPORTS.indexOf(courant.typo.rapport as (typeof RAPPORTS)[number])), texte: (i) => `${RAPPORTS[i]} · ${NOMS_RAPPORTS[i]}`, ecrire: (i) => modifier("rapport", (s) => (s.typo.rapport = RAPPORTS[i]!)) }),
        curseur("typo", { id: "base", label: "Corps du texte", icone: "taille", min: 13, max: 22, pas: 1, lire: () => courant.typo.base, texte: (v) => `${v} px`, ecrire: (v) => modifier("base", (s) => (s.typo.base = v)) }),
        curseur("typo", { id: "graisse", label: "Graisse des titres", icone: "graisse", min: 100, max: 900, pas: 50, lire: () => courant.typo.graisseTitre, ecrire: (v) => modifier("graisse", (s) => {
          const [g0, g1] = POLICES[s.typo.titre].graisses;
          s.typo.graisseTitre = Math.min(g1, Math.max(g0, v));
        }) }),
        curseur("typo", { id: "largeur", label: "Largeur des titres (Archivo)", icone: "largeur", min: 62, max: 125, pas: 1, lire: () => courant.typo.largeur, quand: () => courant.typo.titre === "archivo", ecrire: (v) => modifier("largeur", (s) => (s.typo.largeur = v)) }),
        curseur("typo", { id: "interlignage", label: "Interlignage du texte", icone: "interligne", min: 1.2, max: 1.9, pas: 0.01, lire: () => courant.typo.interlignage, ecrire: (v) => modifier("interlignage", (s) => (s.typo.interlignage = v)) }),
        curseur("typo", { id: "approche", label: "Approche des titres", icone: "approche", min: -0.06, max: 0.08, pas: 0.002, lire: () => courant.typo.approche, texte: (v) => `${v.toFixed(3)} em`, ecrire: (v) => modifier("approche", (s) => (s.typo.approche = v)) }),
      );
      const l3 = document.createElement("div");
      l3.className = "vr-ligne";
      l3.append(bascule("typo", { label: "Titres en capitales", icone: "capitales", lire: () => courant.typo.capitales, ecrire: (v) => modifier("capitales", (s) => (s.typo.capitales = v)) }));
      c.append(l3);
    },
    forme: (c) => {
      c.append(
        curseur("forme", { id: "espace", label: "Unité d'espacement", icone: "espace", min: 2, max: 14, pas: 1, lire: () => courant.forme.espace, texte: (v) => `${v} px`, ecrire: (v) => modifier("espace", (s) => (s.forme.espace = v)) }),
        curseur("forme", { id: "rayon", label: "Rayon des coins", icone: "rayon", min: 0, max: 40, pas: 1, lire: () => courant.forme.rayon, texte: (v) => `${v} px`, ecrire: (v) => modifier("rayon", (s) => (s.forme.rayon = v)) }),
        curseur("forme", { id: "filet", label: "Épaisseur des filets", icone: "filet", min: 0, max: 4, pas: 1, lire: () => courant.forme.filet, texte: (v) => `${v} px`, ecrire: (v) => modifier("filet", (s) => (s.forme.filet = v)) }),
        curseur("forme", { id: "ombre", label: "Ombres", icone: "ombre", min: 0, max: 1, pas: 0.05, lire: () => courant.forme.ombre, texte: (v) => `${Math.round(v * 100)} %`, ecrire: (v) => modifier("ombre", (s) => (s.forme.ombre = v)) }),
      );
    },
    mouvement: (c) => {
      c.append(
        curseur("mouvement", { id: "duree", label: "Durées (échelle des jetons --dur-1 à --dur-4)", icone: "duree", min: 0.4, max: 2, pas: 0.05, lire: () => courant.mouvement.echelle, texte: (v) => `× ${v.toFixed(2)}`, ecrire: (v) => modifier("duree", (s) => (s.mouvement.echelle = v)) }),
      );
      const l1 = document.createElement("div");
      l1.className = "vr-ligne";
      l1.append(
        segments("mouvement", { label: "Courbe", choix: Object.keys(COURBES) as Courbe[], nom: (k) => `Courbe : ${NOMS_COURBES[k].toLowerCase()}`, lire: () => courant.mouvement.courbe, ecrire: (k) => { modifier("courbe", (s) => (s.mouvement.courbe = k)); rejouer(cadreA); } }),
        segments("mouvement", { label: "Intensité cinétique (data-presse-motion)", choix: INTENSITES, nom: (k) => `Intensité : ${k}`, lire: () => courant.mouvement.intensite, ecrire: (k) => { modifier("intensite", (s) => (s.mouvement.intensite = k)); rejouer(cadreA); } }),
      );
      c.append(
        l1,
        menu("mouvement", { id: "transition-page", label: "Transition de page (data-presse-transition)", icone: "transitionPage", choix: TRANSITIONS_PAGE.map((t) => [t, t[0]!.toUpperCase() + t.slice(1)] as const), lire: () => courant.mouvement.transitionPage, ecrire: (v) => modifier("transition-page", (s) => (s.mouvement.transitionPage = v)) }),
        menu("mouvement", { id: "transition-diapo", label: "Transition de diapo (data-transition)", icone: "transitionDiapo", choix: TRANSITIONS_DIAPO.map((t) => [t, t[0]!.toUpperCase() + t.slice(1)] as const), lire: () => courant.mouvement.transitionDiapo, ecrire: (v) => modifier("transition-diapo", (s) => (s.mouvement.transitionDiapo = v)) }),
      );
    },
    look: (c) => {
      const l1 = document.createElement("div");
      l1.className = "vr-ligne";
      l1.append(
        segments("look", {
          label: "Étalonnage (data-presse-look)",
          choix: LOOKS_IDS,
          nom: (n) => `Look ${n}`,
          html: (n) => `<span class="vr-look-pastille vr-look-${esc(n)}" aria-hidden="true">${esc(n.slice(0, 3))}</span>`,
          lire: () => courant.look.nom,
          ecrire: (n) =>
            modifier("look-nom", (s) => {
              s.look.nom = n;
              s.look.grain = LOOKS[n]?.grain ?? s.look.grain;
              s.look.vignette = LOOKS[n]?.vignette ?? s.look.vignette;
            }),
        }),
      );
      c.append(
        l1,
        curseur("look", { id: "grain", label: "Grain (data-presse-grain)", icone: "grain", min: 0, max: 0.15, pas: 0.005, lire: () => courant.look.grain, texte: (v) => v.toFixed(3), ecrire: (v) => modifier("look-grain", (s) => (s.look.grain = v)) }),
        curseur("look", { id: "vignette", label: "Vignette (data-presse-vignette)", icone: "vignette", min: 0, max: 0.7, pas: 0.01, lire: () => courant.look.vignette, texte: (v) => v.toFixed(2), ecrire: (v) => modifier("look-vignette", (s) => (s.look.vignette = v)) }),
      );
      const l2 = document.createElement("div");
      l2.className = "vr-ligne vr-effets";
      l2.setAttribute("role", "group");
      l2.setAttribute("aria-label", "Effets de la chaîne WebGPU (data-presse-effects)");
      const NOMS_EFFETS: Record<string, string> = { loupe: "Loupe", rvb: "Aberration RVB", trame: "Trame", bloom: "Halo (bloom)", grain: "Grain GPU", courbure: "Courbure" };
      for (const e of EFFETS)
        l2.append(
          bascule("look", {
            label: `Effet : ${NOMS_EFFETS[e]}`,
            icone: e,
            lire: () => courant.look.effets.includes(e),
            ecrire: (v) => modifier(`look-effet-${e}`, (s) => (s.look.effets = v ? [...s.look.effets, e] : s.look.effets.filter((x) => x !== e))),
          }),
        );
      c.append(l2);
    },
  };
  for (const f of FAMILLES) {
    const sec = document.createElement("section");
    sec.className = "vr-famille";
    sec.dataset.famille = f;
    sec.setAttribute("aria-labelledby", `vr-fam-${f}`);
    sec.innerHTML = `<div class="vr-famille-tete"><h2 id="vr-fam-${f}"><span class="vr-ico" aria-hidden="true">${ico(f)}</span>${NOMS_FAMILLES[f]}</h2>
      ${bouton("verrou", `Verrouiller : ${NOMS_FAMILLES[f].toLowerCase()}`, `data-vr-verrou="${f}" aria-pressed="false"`)}
      ${bouton("tirer", `Re-tirer : ${NOMS_FAMILLES[f].toLowerCase()}`, `data-vr-retirer="${f}"`)}</div>`;
    const corps = document.createElement("div");
    corps.className = "vr-famille-corps";
    cadres[f](corps);
    sec.append(corps);
    famillesEl.append(sec);
  }
  famillesEl.addEventListener("click", (e) => {
    const t = (e.target as Element).closest<HTMLButtonElement>("[data-vr-verrou], [data-vr-retirer]");
    if (!t) return;
    if (t.dataset.vrVerrou) {
      const f = t.dataset.vrVerrou as Famille;
      if (verrous.has(f)) verrous.delete(f);
      else verrous.add(f);
      ui.verrous = [...verrous];
      sauverUi();
      majVerrous();
      dire(`${NOMS_FAMILLES[f]} ${verrous.has(f) ? "verrouillée" : "déverrouillée"}.`);
      tirerPlanche();
    } else if (t.dataset.vrRetirer) {
      const f = t.dataset.vrRetirer as Famille;
      // Re-tirer une famille : toutes les autres sont gardées, celle-ci vient d'une graine neuve.
      const autres = FAMILLES.filter((x) => x !== f);
      const g = empreinte(`${courant.graine}:${f}:${performance.now()}`);
      const s = genererSysteme(g, {}, verrousDe(courant, autres));
      appliquer({ ...s, nom: courant.nom, graine: courant.graine }, { dire: `${NOMS_FAMILLES[f]} re-tirée.` });
    }
  });
}
function majVerrous() {
  for (const b of famillesEl.querySelectorAll<HTMLButtonElement>("[data-vr-verrou]")) {
    const on = verrous.has(b.dataset.vrVerrou as Famille);
    b.setAttribute("aria-pressed", String(on));
    b.innerHTML = ico(on ? "verrou" : "ouvert");
    b.closest(".vr-famille")!.classList.toggle("est-verrouillee", on);
    const rt = b.parentElement!.querySelector<HTMLButtonElement>("[data-vr-retirer]")!;
    rt.disabled = on;
  }
}
function majControles() {
  for (const c of controles) c.maj();
  const t = famillesEl.querySelector<HTMLElement>(".vr-champ-teinte");
  if (t) teinteFond(t);
}

/* ───────────────────────── Planche ───────────────────────── */

const grille = $("[data-vr-grille]");
const MODES: [Mode, string][] = [
  ["tirage", "Tirages libres (verrous gardés)"],
  ["voisines", "Voisines : variations proches du système courant"],
  ["croisement", "Croisements du système courant avec B (ou le dernier instantané)"],
];
function construireModes() {
  const el = $("[data-vr-mode]");
  el.innerHTML = MODES.map(([m, t]) => `<button type="button" role="radio" data-m="${m}" aria-label="${esc(t)}" title="${esc(t)}">${ico(m)}</button>`).join("");
  const btns = [...el.querySelectorAll<HTMLButtonElement>("button")];
  const choisirMode = (m: Mode) => {
    ui.mode = m;
    sauverUi();
    majModes();
    tirerPlanche();
  };
  btns.forEach((b, i) => {
    b.addEventListener("click", () => choisirMode(b.dataset.m as Mode));
    b.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = btns[(i + d + btns.length) % btns.length]!;
      n.focus();
      choisirMode(n.dataset.m as Mode);
    });
  });
}
function majModes() {
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-vr-mode] button")) {
    const on = b.dataset.m === ui.mode;
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
  }
  $("[data-vr-intensite-champ]").hidden = ui.mode !== "voisines";
}
/** La planche : N systèmes, selon le mode, à partir du compteur de tirage (déterministe). */
function tirerPlanche(nouvelle = false) {
  if (nouvelle) ui.tirage = (ui.tirage + 1) >>> 0;
  sauverUi();
  const n = ui.nombre;
  const base = empreinte(`planche:${ui.tirage}`);
  const partenaire = systemeB ?? instantanes[instantanes.length - 1] ?? genererSysteme(base ^ 0x9e3779b9);
  planche = Array.from({ length: n }, (_, i) => {
    const g = empreinte(`${base}:${i}`);
    if (ui.mode === "voisines") return muterSysteme(courant, g, ui.intensite, verrous);
    if (ui.mode === "croisement") return croiserSystemes(courant, partenaire, g, verrous);
    return tirerAvecVerrous(g);
  });
  rendrePlanche();
}
let tuiles: HTMLElement[] = [];
function rendrePlanche() {
  // On garde les cadres existants (images déjà décodées) et on n'ajoute ou retire que la différence.
  while (tuiles.length > planche.length) tuiles.pop()!.remove();
  while (tuiles.length < planche.length) {
    const li = document.createElement("li");
    li.className = "vr-tuile";
    // La composition est un frère du bouton (pas son contenu : un bouton ne contient que du texte courant) ; le bouton,
    // transparent, la recouvre et porte le nom accessible.
    const cadre = composition("vr-compo-mini");
    cadre.setAttribute("aria-hidden", "true");
    cadre.inert = true;
    li.append(cadre);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "vr-tuile-appliquer";
    const pied = document.createElement("span");
    pied.className = "vr-tuile-pied";
    pied.setAttribute("aria-hidden", "true");
    b.append(pied);
    const c = document.createElement("button");
    c.type = "button";
    c.className = "vr-btn-ico vr-petit vr-tuile-coeur";
    c.innerHTML = ico("coeur");
    li.append(b, c);
    grille.append(li);
    tuiles.push(li);
  }
  planche.forEach((s, i) => {
    const li = tuiles[i]!;
    li.dataset.i = String(i);
    const b = li.querySelector<HTMLButtonElement>(".vr-tuile-appliquer")!;
    b.setAttribute("aria-label", `Appliquer la variation ${i + 1} : ${resume(s)}`);
    b.title = `Appliquer : ${resume(s)}`;
    habiller(li.querySelector<HTMLElement>(".vr-compo-cadre")!, s);
    const c = couleurs(s);
    li.querySelector(".vr-tuile-pied")!.innerHTML = `<span class="vr-tuile-nom">${esc(s.nom)}</span><span class="vr-tuile-teintes">${[c.papier, c.encre, ...c.accents].map((x) => `<i style="background:${hex(x)}"></i>`).join("")}</span>`;
    const coeur = li.querySelector<HTMLButtonElement>(".vr-tuile-coeur")!;
    const garde = instantanes.some((x) => serialiser(x, 0) === serialiser(s, 0));
    coeur.setAttribute("aria-pressed", String(garde));
    coeur.setAttribute("aria-label", `Garder la variation ${i + 1} dans les instantanés`);
    coeur.title = "Garder dans les instantanés";
  });
  gpu?.dessiner(planche, tuiles.map((t) => t.querySelector<HTMLElement>(".vr-compo-cadre")!));
}
grille.addEventListener("click", (e) => {
  const t = e.target as Element;
  const li = t.closest<HTMLElement>(".vr-tuile");
  if (!li) return;
  const s = planche[Number(li.dataset.i)];
  if (!s) return;
  if (t.closest(".vr-tuile-coeur")) {
    basculerInstantane(s);
    return;
  }
  if (t.closest(".vr-tuile-appliquer")) {
    retouches = [];
    appliquer(s, { dire: `Appliqué : ${s.nom}.` });
    // La planche suit le système en mode voisines ou croisement (on explore autour du nouveau courant).
    if (ui.mode !== "tirage") tirerPlanche();
  }
});
// Flèches dans la planche : de vignette en vignette (lignes et colonnes de la grille).
grille.addEventListener("keydown", (e) => {
  const b = (e.target as Element).closest<HTMLElement>(".vr-tuile-appliquer");
  if (!b) return;
  const i = Number(b.closest<HTMLElement>(".vr-tuile")!.dataset.i);
  const cols = Math.max(1, Math.round(grille.clientWidth / (tuiles[0]?.offsetWidth || 1)));
  const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols } as Record<string, number>;
  if (!(e.key in d)) return;
  e.preventDefault();
  const j = Math.min(tuiles.length - 1, Math.max(0, i + d[e.key]!));
  tuiles[j]?.querySelector<HTMLElement>(".vr-tuile-appliquer")?.focus();
});
/** L'échelle des vignettes : la composition fait 960 px de large, réduite à la largeur de la tuile. */
new ResizeObserver(() => {
  const w = tuiles[0]?.querySelector<HTMLElement>(".vr-compo-cadre")?.clientWidth;
  if (w) grille.style.setProperty("--vr-k", String(w / 960));
}).observe(grille);

/* ───────────────────────── Instantanés ───────────────────────── */

const bande = $("[data-vr-bande]");
const sauverInstantanes = () => stock.ecrire(CLE_INSTANTANES, JSON.stringify(instantanes));
function basculerInstantane(s: Systeme) {
  const k = serialiser(s, 0);
  const i = instantanes.findIndex((x) => serialiser(x, 0) === k);
  if (i >= 0) {
    instantanes.splice(i, 1);
    dire(`${s.nom} retiré des instantanés.`);
  } else {
    instantanes.push(structuredClone(s) as Systeme);
    if (instantanes.length > 40) instantanes.shift();
    dire(`${s.nom} gardé (${instantanes.length} instantané${instantanes.length > 1 ? "s" : ""}).`);
  }
  sauverInstantanes();
  rendreBande();
  rendrePlanche();
  majBarre();
}
function rendreBande() {
  $("[data-vr-bande-vide]").hidden = instantanes.length > 0;
  bande.innerHTML = instantanes
    .map((s, i) => {
      const c = couleurs(s);
      const estB = systemeB && serialiser(systemeB, 0) === serialiser(s, 0);
      return `<li class="vr-inst${estB ? " est-b" : ""}" data-i="${i}" style="--p:${hex(c.papier)};--e:${hex(c.encre)};--a:${hex(c.accentsTexte[0]!)}">
        <button type="button" class="vr-inst-appliquer" aria-label="Appliquer l'instantané ${esc(resume(s))}" title="${esc(resume(s))}"><span class="vr-inst-aa" style="font-family:${esc(POLICES[s.typo.titre].pile)};font-weight:${s.typo.graisseTitre}" aria-hidden="true">Aa</span><span class="vr-inst-points" aria-hidden="true">${c.accents.map((a) => `<i style="background:${hex(a)}"></i>`).join("")}</span></button>
        <button type="button" class="vr-btn-ico vr-mini vr-inst-b" aria-pressed="${!!estB}" aria-label="Comparer ${esc(s.nom)} en B" title="Comparer en B">${ico("b")}</button>
        <button type="button" class="vr-btn-ico vr-mini vr-inst-retirer" aria-label="Retirer ${esc(s.nom)}" title="Retirer">${ico("retirer")}</button>
      </li>`;
    })
    .join("");
}
bande.addEventListener("click", (e) => {
  const t = e.target as Element;
  const li = t.closest<HTMLElement>(".vr-inst");
  if (!li) return;
  const i = Number(li.dataset.i);
  const s = instantanes[i]!;
  if (t.closest(".vr-inst-retirer")) {
    if (systemeB && serialiser(systemeB, 0) === serialiser(s, 0)) systemeB = null;
    instantanes.splice(i, 1);
    sauverInstantanes();
    rendreBande();
    rendrePlanche();
    majAB();
    dire(`${s.nom} retiré.`);
  } else if (t.closest(".vr-inst-b")) {
    systemeB = systemeB && serialiser(systemeB, 0) === serialiser(s, 0) ? null : s;
    if (systemeB && !abActif) abActif = true;
    rendreBande();
    majAB();
    dire(systemeB ? `B : ${s.nom}. Glisser le rideau pour comparer.` : "Plus de B.");
  } else if (t.closest(".vr-inst-appliquer")) {
    retouches = [];
    appliquer(structuredClone(s) as Systeme, { dire: `Appliqué : ${s.nom}.` });
  }
});

/* ───────────────────────── A / B au rideau ───────────────────────── */

const rideauEl = $("[data-vr-rideau]");
function majAB() {
  const b = systemeB ?? (passe.length ? lireSysteme(passe[passe.length - 1]!) : null);
  const on = abActif && !!b;
  calqueB.hidden = !on;
  rideauEl.hidden = !on;
  $("[data-vr-ab]").setAttribute("aria-pressed", String(on));
  scene.classList.toggle("est-ab", on);
  if (!on || !b) return;
  habiller(cadreB, b);
  calqueB.style.clipPath = `inset(0 0 0 ${rideau}%)`;
  rideauEl.style.left = `${rideau}%`;
  rideauEl.setAttribute("aria-valuenow", String(Math.round(rideau)));
  rideauEl.setAttribute("aria-valuetext", `A : ${courant.nom} à gauche, B : ${b.nom} à droite, rideau à ${Math.round(rideau)} %`);
  rideauEl.querySelector(".vr-rideau-b")!.textContent = `B · ${b.nom}`;
  rideauEl.querySelector(".vr-rideau-a")!.textContent = `A · ${courant.nom}`;
}
function placerRideau(x: number) {
  rideau = Math.min(100, Math.max(0, x));
  majAB();
}
rideauEl.addEventListener("pointerdown", (e) => {
  rideauEl.setPointerCapture(e.pointerId);
  const r = scene.getBoundingClientRect();
  const bouger = (ev: PointerEvent) => placerRideau(((ev.clientX - r.left) / r.width) * 100);
  rideauEl.addEventListener("pointermove", bouger);
  rideauEl.addEventListener("pointerup", () => rideauEl.removeEventListener("pointermove", bouger), { once: true });
});
scene.addEventListener("pointerdown", (e) => {
  if (!abActif || rideauEl.hidden || (e.target as Element).closest("[data-vr-rideau]")) return;
  const r = scene.getBoundingClientRect();
  placerRideau(((e.clientX - r.left) / r.width) * 100);
});
rideauEl.addEventListener("keydown", (e) => {
  const pas = e.shiftKey ? 10 : 2;
  const d: Record<string, number> = { ArrowLeft: -pas, ArrowDown: -pas, ArrowRight: pas, ArrowUp: pas, PageDown: -25, PageUp: 25 };
  if (e.key === "Home") placerRideau(0);
  else if (e.key === "End") placerRideau(100);
  else if (e.key in d) placerRideau(rideau + d[e.key]!);
  else return;
  e.preventDefault();
});
function basculerAB() {
  abActif = !abActif;
  if (abActif && !systemeB && !passe.length && instantanes.length) systemeB = instantanes[instantanes.length - 1]!;
  if (abActif && !systemeB && !passe.length) {
    abActif = false;
    dire("Rien à comparer : gardez un instantané (B) ou changez de système (le précédent devient B).");
  } else dire(abActif ? "Comparaison A / B : glisser le rideau, ou flèches." : "Comparaison fermée.");
  majAB();
  rendreBande();
}

/* ───────────────────────── Exports ───────────────────────── */

const codeEl = $("[data-vr-code]");
function texteCode() {
  if (ui.onglet === "attributs") return attributsTexte(courant);
  if (ui.onglet === "json") return serialiser(courant);
  return css(courant);
}
/** Surlignage simple, en lecture seule : commentaires, propriétés, couleurs (avec leur pastille), chaînes, nombres. */
function surligner(t: string, genre: Ui["onglet"]) {
  const e = esc(t);
  if (genre === "json")
    return e
      .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="k">$1</span>$2')
      .replace(/(:\s*)(&quot;[^&]*?&quot;)/g, '$1<span class="s">$2</span>')
      .replace(/(?<![\w#])(-?\d+(?:\.\d+)?)(?![\w])/g, '<span class="n">$1</span>');
  if (genre === "attributs")
    // Une seule passe : commentaire, nom de balise, ou attribut (et sa valeur) — les remplacements ne se relisent pas.
    return e.replace(/(&lt;!--.*?--&gt;)|(&lt;\/?)([a-z]+)|(\s)([a-z][a-z-]*)(=&quot;[^&]*&quot;)?/g, (m, com?: string, ouv?: string, bal?: string, sp?: string, at?: string, val?: string) => {
      if (com) return `<span class="c">${com}</span>`;
      if (ouv) return `${ouv}<span class="t">${bal}</span>`;
      if (at) return `${sp}<span class="k">${at}</span>${val ? `=<span class="s">${val.slice(1)}</span>` : ""}`;
      return m;
    });
  return e
    .replace(/(\/\*.*?\*\/)/g, '<span class="c">$1</span>')
    .replace(/(--[\w-]+)(:)/g, '<span class="k">$1</span>$2')
    .replace(/(#[0-9a-f]{6})\b/gi, '<i class="vr-code-pastille" style="background:$1"></i><span class="s">$1</span>');
}
function rendreCode() {
  codeEl.innerHTML = surligner(texteCode(), ui.onglet);
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-vr-onglet]")) {
    const on = b.dataset.vrOnglet === ui.onglet;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
    if (on) $("#vr-code").setAttribute("aria-labelledby", b.id);
  }
}
function rendreContrastes() {
  const c = couleurs(courant);
  const L = courant.look.nom;
  const pap = hex(c.papier);
  const lignes: [string, string, string, number][] = [
    ["Encre / papier", hex(c.encre), pap, 4.5],
    ["Encre douce / papier", hex(c.encreDouce), pap, 4.5],
    ["Encre / surface 2", hex(c.encre), hex(c.surfaces[1]), 4.5],
    ...c.accentsTexte.map((a, i) => [`Accent ${i + 1} texte / papier`, hex(a), pap, 4.5] as [string, string, string, number]),
    ...c.accents.slice(1).map((a, i) => [`Accent ${i + 2} / papier`, hex(a), pap, 3] as [string, string, string, number]),
  ];
  $("[data-vr-contrastes]").innerHTML =
    `<thead><tr><th scope="col">Paire</th><th scope="col">Brut</th><th scope="col">Look ${esc(L)}</th></tr></thead><tbody>` +
    lignes
      .map(([nom, a, b, min]) => {
        const brut = contrasteHex(a, b);
        const sous = contrasteSous(a, b, L);
        const ok = Math.min(brut, sous) >= min;
        return `<tr><th scope="row"><i style="background:${a};box-shadow:0 0 0 3px ${b}"></i>${esc(nom)}</th><td>${brut.toFixed(2)}</td><td class="${ok ? "ok" : "ko"}">${sous.toFixed(2)} <span class="sr-only">${ok ? "tenu" : "insuffisant"}</span><span aria-hidden="true">${ok ? "✓" : "✗"}</span></td></tr>`;
      })
      .join("") +
    "</tbody>";
}
const lienPage = $<HTMLSelectElement>("[data-vr-lien-page]");
const lien = $<HTMLAnchorElement>("[data-vr-lien]");
const urlSysteme = () => new URL(`./${ui.lienPage}?systeme=${encoderSysteme(courant)}`, location.href).href;
function majLien() {
  lienPage.value = ui.lienPage;
  lien.href = urlSysteme();
  lien.setAttribute("aria-label", `Ouvrir ${lienPage.selectedOptions[0]?.textContent ?? "la page"} avec ce système (nouvel onglet)`);
}
lienPage.addEventListener("change", () => {
  ui.lienPage = lienPage.value;
  sauverUi();
  majLien();
});
async function copier(t: string, quoi: string) {
  try {
    await navigator.clipboard.writeText(t);
    dire(`${quoi} copié.`);
  } catch {
    // Presse-papiers refusé (contexte non sûr, permission) : on sélectionne le texte, Ctrl C fait le reste.
    const r = document.createRange();
    r.selectNodeContents(codeEl);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(r);
    dire(`Copie refusée par le navigateur : le code est sélectionné, Ctrl C pour copier.`);
  }
}
function telecharger(nom: string, texte: string) {
  const url = URL.createObjectURL(new Blob([texte], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nom });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/**
 * « Appliquer au Créateur » : le Créateur garde son site dans localStorage (`presse-createur:v1`, src/createur/main.ts)
 * et le relit à son chargement. On y écrit les réglages de page que le système remplit (versCreateur) ; s'il n'y a pas
 * encore de site, on part de son premier modèle.
 */
async function appliquerAuCreateur() {
  const [{ normalize }, { TEMPLATES }] = await Promise.all([import("../createur/model.ts"), import("../createur/templates.ts")]);
  let site;
  try {
    const raw = stock.lire(CLE_CREATEUR);
    site = raw ? normalize(JSON.parse(raw)) : TEMPLATES[0]!.make();
  } catch {
    site = TEMPLATES[0]!.make();
  }
  site.page = { ...site.page, ...versCreateur(courant) };
  if (!stock.ecrire(CLE_CREATEUR, JSON.stringify(site))) return dire("Stockage du navigateur indisponible : le Créateur ne peut pas le relire. Téléchargez le JSON.");
  $("[data-vr-etat]").innerHTML = `« ${esc(courant.nom)} » écrit dans le Créateur (couleurs, type, look, transition, effets, mouvement, arrondi). <a href="./createur.html">Ouvrir le Créateur</a> — un onglet déjà ouvert doit être rechargé.`;
}
function importer(texte: string) {
  const o = JSON.parse(texte) as unknown;
  const liste = Array.isArray(o) ? o : (o as { format?: string; instantanes?: unknown[] }).format === "presse-instantanes" ? ((o as { instantanes: unknown[] }).instantanes ?? []) : null;
  if (liste) {
    const lus = liste.map((x) => lireSysteme(x));
    const vus = new Set(instantanes.map((x) => serialiser(x, 0)));
    for (const s of lus) if (!vus.has(serialiser(s, 0))) instantanes.push(s);
    sauverInstantanes();
    rendreBande();
    rendrePlanche();
    dire(`${lus.length} instantané${lus.length > 1 ? "s" : ""} importé${lus.length > 1 ? "s" : ""}.`);
  } else {
    const s = lireSysteme(o);
    appliquer(s, { dire: `Système importé : ${s.nom}.` });
  }
}

/* ───────────────────────── Barre, état, rendu ───────────────────────── */

const etat = $("[data-vr-etat]");
let tDire = 0;
function dire(t: string) {
  etat.textContent = t;
  clearTimeout(tDire);
  tDire = window.setTimeout(() => (etat.textContent = ""), 6000);
}
const graineEl = $<HTMLInputElement>("[data-vr-graine]");
function majBarre() {
  $("[data-vr-nom]").textContent = courant.nom;
  graineEl.value = String(courant.graine);
  const garde = instantanes.some((x) => serialiser(x, 0) === serialiser(courant, 0));
  const g = $("[data-vr-garder]");
  g.setAttribute("aria-pressed", String(garde));
  g.setAttribute("aria-label", garde ? "Retirer des instantanés" : "Garder dans les instantanés");
  ($("[data-vr-annuler]") as HTMLButtonElement).disabled = !passe.length;
  ($("[data-vr-retablir]") as HTMLButtonElement).disabled = !futur.length;
  $("[data-vr-retouches]").innerHTML = retouches.length
    ? `<span class="vr-ico" aria-hidden="true">${ico("ajuste")}</span>Contraste tenu : le solveur a déplacé la clarté de ${retouches.map(esc).join(", ")}.`
    : "";
}
function rendre(o: { animer?: boolean } = {}) {
  habiller(cadreA, courant);
  if (o.animer) rejouer(cadreA);
  majControles();
  majVerrous();
  majBarre();
  rendreCode();
  rendreContrastes();
  majLien();
  majAB();
  rendreBande();
  rendrePlanche();
}
// Pour les tests et la console : l'état lu à la demande (jamais une copie périmée).
(window as unknown as { __variations: unknown }).__variations = {
  get courant() { return courant; },
  get planche() { return planche; },
  get instantanes() { return instantanes; },
  get systemeB() { return systemeB; },
  get verrous() { return [...verrous]; },
  get passe() { return passe.length; },
  get futur() { return futur.length; },
  get gpu() { return gpu?.etat() ?? "dom"; },
  css: () => css(courant),
  lien: () => urlSysteme(),
};

/* ───────────────────────── Branchements ───────────────────────── */

for (const [sel, nom] of [
  ["[data-vr-tirer]", "tirer"],
  ["[data-vr-garder]", "coeur"],
  ["[data-vr-annuler]", "annuler"],
  ["[data-vr-retablir]", "retablir"],
  ["[data-vr-ab]", "ab"],
  ["[data-vr-rejouer]", "rejouer"],
  ["[data-vr-planche-tirer]", "tirer"],
  ["[data-vr-inst-exporter]", "exporter"],
  ["[data-vr-copier]", "copier"],
  ["[data-vr-lien-copier]", "copier"],
] as const)
  $(sel).innerHTML = ico(nom);
for (const el of document.querySelectorAll<HTMLElement>("[data-vr-ico]")) el.innerHTML = ico(el.dataset.vrIco!);

function tirerSysteme() {
  const g = (Math.random() * 4294967296) >>> 0;
  retouches = [];
  const s = tirerAvecVerrous(g);
  appliquer(s, { dire: `Tiré : ${s.nom} (graine ${s.graine}).` });
  if (ui.mode !== "tirage") tirerPlanche();
}
$("[data-vr-tirer]").addEventListener("click", tirerSysteme);
$("[data-vr-garder]").addEventListener("click", () => basculerInstantane(courant));
$("[data-vr-annuler]").addEventListener("click", annuler);
$("[data-vr-retablir]").addEventListener("click", retablir);
$("[data-vr-ab]").addEventListener("click", basculerAB);
$("[data-vr-rejouer]").addEventListener("click", () => rejouer(cadreA));
$("[data-vr-planche-tirer]").addEventListener("click", () => tirerPlanche(true));
graineEl.addEventListener("change", () => {
  const g = Number(graineEl.value);
  if (!Number.isFinite(g) || g < 0) return majBarre();
  retouches = [];
  appliquer(tirerAvecVerrous(g >>> 0), { dire: `Graine ${g >>> 0}.` });
});
const nombreEl = $<HTMLSelectElement>("[data-vr-nombre]");
nombreEl.value = String(ui.nombre);
nombreEl.addEventListener("change", () => {
  ui.nombre = Number(nombreEl.value);
  tirerPlanche();
});
const intensiteEl = $<HTMLInputElement>("[data-vr-intensite]");
intensiteEl.value = String(ui.intensite);
intensiteEl.addEventListener("input", () => {
  ui.intensite = Number(intensiteEl.value);
  intensiteEl.setAttribute("aria-valuetext", `${Math.round(ui.intensite * 100)} %`);
  tirerPlanche();
});
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-vr-onglet]")) {
  b.addEventListener("click", () => {
    ui.onglet = b.dataset.vrOnglet as Ui["onglet"];
    sauverUi();
    rendreCode();
  });
  b.addEventListener("keydown", (e) => {
    const tabs = [...document.querySelectorAll<HTMLButtonElement>("[data-vr-onglet]")];
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = tabs[(tabs.indexOf(b) + d + tabs.length) % tabs.length]!;
    n.focus();
    n.click();
  });
}
$("[data-vr-copier]").addEventListener("click", () => void copier(texteCode(), ui.onglet === "css" ? "CSS" : ui.onglet === "json" ? "JSON" : "Attributs"));
$("[data-vr-lien-copier]").addEventListener("click", () => void copier(urlSysteme(), "Lien"));
$("[data-vr-telecharger]").addEventListener("click", () => telecharger("presse-systeme.json", serialiser(courant)));
$("[data-vr-createur]").addEventListener("click", () => void appliquerAuCreateur());
$("[data-vr-inst-exporter]").addEventListener("click", () => {
  if (!instantanes.length) return dire("Aucun instantané à exporter.");
  telecharger("presse-instantanes.json", JSON.stringify({ format: "presse-instantanes", v: 1, instantanes: instantanes.map((s) => JSON.parse(serialiser(s, 0)) as unknown) }, null, 2));
});
$<HTMLInputElement>("[data-vr-inst-importer]").addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  try {
    importer(await f.text());
  } catch (err) {
    dire(`Import impossible : ${(err as Error).message}`);
  }
  input.value = "";
});

// Raccourcis : hors des champs de saisie.
document.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  const saisie = t.closest("input, select, textarea, [contenteditable]") && !(t as HTMLInputElement).type?.match(/range|checkbox|radio|button/);
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === "z" && !saisie) {
    e.preventDefault();
    if (e.shiftKey) retablir();
    else annuler();
    return;
  }
  if (mod && e.key.toLowerCase() === "y" && !saisie) {
    e.preventDefault();
    retablir();
    return;
  }
  if (mod || e.altKey || saisie) return;
  if (e.key === "r") tirerSysteme();
  else if (e.key === "R") tirerPlanche(true);
  else if (e.key === "g" || e.key === "G") basculerInstantane(courant);
  else if (e.key === "b" || e.key === "B") basculerAB();
});

// Panneaux : ouverts sur grand écran, repliables (fermés au départ) sur téléphone.
const etroit = matchMedia("(max-width: 899px)");
const majPanneaux = () => {
  for (const d of document.querySelectorAll<HTMLDetailsElement>("[data-vr-panneau]")) d.open = !etroit.matches;
};
etroit.addEventListener("change", majPanneaux);
majPanneaux();
MOUVEMENT_REDUIT.addEventListener("change", () => rejouer(cadreA));

/* ───────────────────────── Démarrage ───────────────────────── */

type Gpu = { dessiner(s: Systeme[], cadres: HTMLElement[]): void; etat(): string; lirePixels(s: Systeme): Promise<{ moyenne: number[]; coin: number[] }> };
let gpu: Gpu | null = null;
const renduEl = $("[data-vr-rendu]");
renduEl.textContent = "DOM";
renduEl.title = "Planche rendue en DOM (vignettes = clones de la composition). ?webgpu : rendu GPU de la planche, avec repli.";

poserFiltres();
construireFamilles();
construireModes();
majModes();
mountPagesNav();
rendre({ animer: true });
tirerPlanche();

if (params.has("webgpu")) {
  void import("./planche-gpu.ts").then(async (m) => {
    const horsEcran = params.get("webgpu") === "essai";
    const g = await m.creerPlancheGpu(grille, { horsEcran });
    if (!g) {
      renduEl.textContent = "DOM (repli)";
      renduEl.title = "WebGPU indisponible : la planche reste en DOM.";
      return;
    }
    gpu = g;
    renduEl.textContent = horsEcran ? "WebGPU (essai)" : "WebGPU";
    renduEl.title = "Planche rendue par le GPU : une texture et une étape d'étalonnage par vignette (couches, saturation, aberration, halo, grain, vignette).";
    rendrePlanche();
    (window as unknown as { __variationsGpu: Gpu }).__variationsGpu = g;
  });
}
// Pour les tests : quelques fonctions pures sous la main.
(window as unknown as { __variationsOutils: unknown }).__variationsOutils = { contrasteHex, versRvb, hex };
