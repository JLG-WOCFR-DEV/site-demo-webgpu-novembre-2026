/**
 * Presse — un dessin technique qui se trace, d'après les planches de
 * plotter.pasqualevitiello.com : traits fins, lignes de construction en
 * pointillés, cotes fléchées, hachures, posés une étape à la fois.
 *
 *   <svg data-trace viewBox="0 0 400 300" role="img" aria-label="…">
 *     <g data-trace-role="construction"> <line …/> </g>      pointillés pâles, tracés d'abord
 *     <path d="…"/>                                          formes principales (rôle par défaut)
 *     <line x1 y1 x2 y2 data-trace-cote="8 u"/>               cote automatique : flèches + valeur au milieu
 *     <g data-trace-role="hachure"> <line …/> … </g>          hachures, en dernier, vite
 *   </svg>
 *   <div data-trace data-trace-src="plan.svg"></div>          ou un fichier .svg chargé puis posé en ligne
 *
 * Attributs (sur le [data-trace], qu'il soit le <svg> ou son conteneur) :
 * data-trace-quand     entree (défaut : à l'entrée dans l'écran) | defilement (le tracé suit le
 *                      défilement) | manuel (rien d'automatique : API ou événement « trace:aller »).
 * data-trace-duree     durée d'un élément, en ms (défaut 700 ; × 0,7 construction, × 0,9 cote, × 0,35 hachure).
 * data-trace-delai     attente avant le premier trait, en ms (défaut 0).
 * data-trace-cascade   écart entre deux éléments d'un même rôle, en ms (défaut 90 ; × 0,35 pour les
 *                      hachures). Entre deux rôles : une pause de deux cascades.
 * data-trace-rejoue    redessine à chaque nouvelle entrée dans l'écran.
 * data-trace-src       URL d'un .svg à charger (même origine conseillée ; scripts et on… retirés).
 *
 * Sur les éléments du dessin :
 * data-trace-role      construction | forme | cote | hachure (ou la classe du même nom ; hérité des groupes).
 * data-trace-ordre     rang dans son rôle (défaut : l'ordre du document).
 * data-trace-ignore    laissé tel quel (fond, cadre).
 * data-trace-cote      sur une <line>, un <path> ou un <g> (sa première géométrie sert de ligne de
 *                      cote) : le texte de la cote (« 8 u », « 30° », « 42,5 cm »).
 * data-trace-cote-libelle   un libellé au-dessus de la valeur (« Poitrine »).
 * data-trace-cote-decalage  écart texte/ligne en px d'écran, signé (défaut 6 : côté gauche du sens de tracé,
 *                      soit au-dessus d'une ligne tracée de gauche à droite).
 * data-trace-cote-taille    corps du texte en px d'écran (défaut 13 ; libellé : 1 px de moins, au moins 12).
 * data-trace-cote-fleche    longueur des flèches en px d'écran (défaut 7).
 *
 * Le texte des cotes garde sa taille à l'écran quelle que soit l'échelle du SVG (recalculé au
 * redimensionnement) ; police : --trace-police (IBM Plex Mono). Couleurs : --trace-texte (texte),
 * --trace-fond (halo derrière le texte), --trace-maj (chiffre qui vient de changer).
 * Le SVG reçoit role="img" et, s'il a un <title>, aria-labelledby. Mouvement réduit : dessin complet
 * immédiat, chiffres changés sans animation.
 *
 * API : tracer(hôte) → { aller(p), jouer(), rejouer(), complet(), coter(source, texte), detruire() } ;
 * initTrace(racine) arme tous les [data-trace] ; controleTrace(hôte) retrouve le contrôle.
 * Événements : « trace:aller » (detail.progression, 0 à 1) reçu, « trace:fin » émis.
 * Limite : les traits en vector-effect="non-scaling-stroke" ne se tracent pas juste (longueurs en
 * unités du dessin).
 */

/* ---------------------------------------------------------------- pur */

export type Role = "construction" | "forme" | "cote" | "hachure";
export const ROLES: readonly Role[] = ["construction", "forme", "cote", "hachure"];
export type Quand = "entree" | "defilement" | "manuel";

export interface Reglages {
  quand: Quand;
  duree: number;
  delai: number;
  cascade: number;
  rejoue: boolean;
}
export const DEFAUTS: Readonly<Reglages> = { quand: "entree", duree: 700, delai: 0, cascade: 90, rejoue: false };

/** Durée et cascade de chaque rôle, en part des réglages : la construction file, les hachures crépitent. */
export const FACTEURS: Readonly<Record<Role, { duree: number; cascade: number }>> = {
  construction: { duree: 0.7, cascade: 1 },
  forme: { duree: 1, cascade: 1 },
  cote: { duree: 0.9, cascade: 1 },
  hachure: { duree: 0.35, cascade: 0.35 },
};

const lireNombre = (s: string | undefined, defaut: number) => {
  if (s == null || s.trim() === "") return defaut;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, n) : defaut;
};

/** Les réglages d'un hôte (son dataset : traceQuand, traceDuree…). */
export function lireReglages(ds: Readonly<Record<string, string | undefined>>): Reglages {
  const q = ds.traceQuand;
  const r = ds.traceRejoue;
  return {
    quand: q === "defilement" || q === "manuel" ? q : "entree",
    duree: lireNombre(ds.traceDuree, DEFAUTS.duree),
    delai: lireNombre(ds.traceDelai, DEFAUTS.delai),
    cascade: lireNombre(ds.traceCascade, DEFAUTS.cascade),
    rejoue: r !== undefined && r !== "0" && r !== "false",
  };
}

/** Le rôle porté par un élément (attribut, puis classe), ou null s'il n'en porte pas. */
export function roleDe(attribut: string | null | undefined, classes: string | Iterable<string> = "", estCote = false): Role | null {
  if (attribut && (ROLES as readonly string[]).includes(attribut)) return attribut as Role;
  const liste = typeof classes === "string" ? classes.split(/\s+/) : [...classes];
  for (const c of liste) {
    const nom = c.startsWith("trace-") ? c.slice(6) : c;
    if ((ROLES as readonly string[]).includes(nom)) return nom as Role;
  }
  return estCote ? "cote" : null;
}

export interface Rangeable {
  role: Role;
  index: number;
  ordre?: number;
}

/** L'ordre du tracé : construction, formes, cotes, hachures ; dans un rôle, data-trace-ordre puis le document. */
export function ordonner<T extends Rangeable>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || (a.ordre ?? 0) - (b.ordre ?? 0) || a.index - b.index);
}

export interface Creneau {
  debut: number;
  duree: number;
}

/**
 * Les créneaux (ms) d'éléments déjà ordonnés : dans un rôle, un départ toutes les cascades ; le rôle
 * suivant attend la fin du précédent, plus une pause de deux cascades. Le délai n'y est pas compté.
 */
export function planifier(roles: readonly Role[], r: Pick<Reglages, "duree" | "cascade">): { creneaux: Creneau[]; total: number } {
  const creneaux: Creneau[] = [];
  let t = 0;
  let fin = 0;
  let precedent: Role | null = null;
  for (const role of roles) {
    const f = FACTEURS[role];
    if (role !== precedent) {
      if (precedent !== null) t = fin + r.cascade * 2;
      precedent = role;
    } else t += r.cascade * f.cascade;
    const duree = r.duree * f.duree;
    creneaux.push({ debut: t, duree });
    fin = Math.max(fin, t + duree);
  }
  return { creneaux, total: fin };
}

export const borne = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

/** Où en est un élément (0 à 1) au temps t du tracé. */
export const avancement = (t: number, c: Creneau) => (c.duree <= 0 ? (t >= c.debut ? 1 : 0) : borne((t - c.debut) / c.duree));

/** La plume accélère puis freine. */
export const adoucir = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** Mode défilement : 0 quand le haut entre par le bas de l'écran, 1 quand le centre atteint le milieu. */
export function progressionDefilement(haut: number, hauteur: number, vh: number): number {
  const d = vh / 2 + hauteur / 2;
  return d <= 0 ? 1 : borne((vh - haut) / d);
}

export interface LectureCote {
  texte: string;
  /** La valeur, si le texte commence par un nombre. */
  nombre: number | null;
  decimales: number;
  /** « , » ou « . » (virgule par défaut). */
  separateur: string;
  /** Ce qui sépare le nombre de l'unité (« » pour « 30° », « 8u »). */
  espace: string;
  unite: string;
}

/** « 8 u », « 30° », « 42,5 cm », « Ø 1,2 cm » (pas de nombre en tête : texte seul). */
export function lireCote(s: string): LectureCote {
  const texte = s.trim();
  const m = /^([-+−]?\d+)(?:([.,])(\d+))?(\s*)(.*)$/.exec(texte);
  if (!m) return { texte, nombre: null, decimales: 0, separateur: ",", espace: "", unite: "" };
  const entier = m[1]!.replace("−", "-");
  const dec = m[3] ?? "";
  return {
    texte,
    nombre: Number(`${entier}${dec ? `.${dec}` : ""}`),
    decimales: dec.length,
    separateur: m[2] ?? ",",
    espace: m[4] ?? "",
    unite: (m[5] ?? "").trim(),
  };
}

export function formaterCote(n: number, decimales: number, unite = "", espace = " ", separateur = ","): string {
  const chiffre = n.toFixed(decimales).replace(".", separateur).replace("-", "−");
  return unite ? `${chiffre}${espace}${unite}` : chiffre;
}

/** Le chiffre qui roule d'une cote à l'autre (même unité) ; sinon le texte bascule à mi-course. */
export function interpolerCote(de: string, vers: string, t: number): string {
  if (t >= 1) return vers;
  if (t <= 0) return de;
  const a = lireCote(de);
  const b = lireCote(vers);
  if (a.nombre === null || b.nombre === null || a.unite !== b.unite) return t < 0.5 ? de : vers;
  const dec = Math.max(a.decimales, b.decimales);
  return formaterCote(a.nombre + (b.nombre - a.nombre) * t, dec, b.unite, b.espace, b.separateur);
}

/** Les premiers caractères d'un texte qui s'écrit (graphèmes simples). */
export function texteEcrit(texte: string, p: number): string {
  const c = Array.from(texte);
  return c.slice(0, Math.floor(borne(p) * c.length + 1e-9)).join("");
}

/**
 * Un angle ramené dans [-90°, 90°[ pour que le texte se lise sans tourner la tête ; une cote
 * verticale se lit de bas en haut, comme sur un plan.
 */
export function angleLisible(deg: number): { angle: number; retourne: boolean } {
  let a = ((((deg + 180) % 360) + 360) % 360) - 180; // [-180, 180[
  if (Math.abs(a) < 1e-9) a = 0;
  if (a >= 90) return { angle: a - 180, retourne: true };
  if (a < -90) return { angle: a + 180, retourne: true };
  return { angle: a, retourne: false };
}

/**
 * Où poser le texte d'une cote : au milieu (mx, my), décalé de `decalage` sur la normale gauche du
 * sens de tracé (tx, ty). `dessus` : le texte s'empile vers le haut de son repère tourné.
 */
export function repereCote(mx: number, my: number, tx: number, ty: number, decalage: number) {
  const l = Math.hypot(tx, ty) || 1;
  const ux = tx / l, uy = ty / l;
  const nx = uy, ny = -ux; // gauche du sens de tracé (y vers le bas)
  const { angle } = angleLisible((Math.atan2(uy, ux) * 180) / Math.PI);
  const r = (angle * Math.PI) / 180;
  // L'axe y local (vers le bas du texte), une fois tourné.
  const ly = [-Math.sin(r), Math.cos(r)] as const;
  const s = decalage < 0 ? -1 : 1;
  const dessus = (nx * s * ly[0] + ny * s * ly[1]) < 0;
  return { x: mx + nx * decalage, y: my + ny * decalage, angle, dessus };
}

/** Une flèche ouverte : pointe en (x, y), branches vers (dx, dy) (de la pointe vers l'intérieur de la cote). */
export function cheminFleche(x: number, y: number, dx: number, dy: number, longueur: number, ouverture = 24): string {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const a = (ouverture * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const b1 = [x + (ux * c - uy * s) * longueur, y + (ux * s + uy * c) * longueur];
  const b2 = [x + (ux * c + uy * s) * longueur, y + (-ux * s + uy * c) * longueur];
  const f = (n: number) => +n.toFixed(2);
  return `M${f(b1[0]!)} ${f(b1[1]!)}L${f(x)} ${f(y)}L${f(b2[0]!)} ${f(b2[1]!)}`;
}

/**
 * Le stroke-dasharray d'un trait en pointillés tracé jusqu'à p : le motif jusqu'à la plume, puis un
 * blanc qui couvre le reste. Sans motif : un seul tiret qui s'allonge.
 */
export function tiretsPartiels(motif: readonly number[], longueur: number, p: number): string {
  const trace = longueur * borne(p);
  const reste = longueur + 1;
  const m = motif.filter((x) => x >= 0);
  if (!m.length || m.every((x) => x === 0)) return `${+trace.toFixed(2)} ${+reste.toFixed(2)}`;
  const pair = m.length % 2 ? [...m, ...m] : m;
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; acc < trace && out.length < 4000; i++) {
    const seg = pair[i % pair.length]!;
    if (i % 2 === 0) out.push(Math.min(seg, trace - acc));
    else out.push(seg);
    acc += seg;
  }
  if (out.length % 2 === 0) out.push(0);
  out.push(reste);
  return out.map((x) => +x.toFixed(2)).join(" ");
}

/** Lit un stroke-dasharray calculé (« 3px, 4px », « none »). */
export function lireMotif(s: string | null | undefined): number[] | null {
  if (!s || s === "none") return null;
  const n = s.split(/[\s,]+/).filter(Boolean).map((x) => parseFloat(x));
  return n.length && n.every((x) => Number.isFinite(x)) && n.some((x) => x > 0) ? n : null;
}

/* ---------------------------------------------------------------- DOM */

const SVGNS = "http://www.w3.org/2000/svg";
const GEOMETRIE = "path, line, polyline, polygon, rect, circle, ellipse";
const HORS_DESSIN = "defs, clipPath, mask, pattern, marker, symbol, [data-trace-ignore], [data-trace-auto]";

const CSS = `
:where([data-trace]) :where([data-trace-role="construction"], .construction, .trace-construction) { opacity: 0.55; }
:where([data-trace]) :where([data-trace-role="construction"], .construction, .trace-construction):not([stroke-dasharray]) { stroke-dasharray: 2 4; }
.trace-cote-texte { font-family: var(--trace-police, "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace); fill: var(--trace-texte, currentColor);
  paint-order: stroke; stroke: var(--trace-fond, #fff); stroke-linejoin: round; transition: fill 0.5s; font-variant-numeric: tabular-nums; }
.trace-cote-valeur { font-weight: 600; }
.trace-cote-libelle { font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
.trace-cote-maj .trace-cote-valeur { fill: var(--trace-maj, #a3101f); transition: none; }
.trace-fleche { fill: none; stroke-linecap: round; stroke-linejoin: round; }
`;
let cssPose = false;
function poserCss() {
  if (cssPose) return;
  const st = document.createElement("style");
  st.dataset.presse = "trace";
  st.textContent = CSS;
  document.head.append(st);
  cssPose = true;
}

const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Trait {
  el: SVGGeometryElement;
  longueur: number;
  motif: number[] | null;
  sansTrait: boolean;
  dernier: number;
}

interface CoteRendu {
  source: Element;
  trait: Trait;
  groupe: SVGGElement;
  fleches: Trait[];
  libelle: SVGTextElement | null;
  valeur: SVGTextElement;
  libelleTexte: string;
  texte: string;
  /** Pendant le roulement du chiffre : ce qui s'affiche. */
  affiche: string;
  ecrit: string;
  anim: number;
  tempoMaj: number;
}

type Rendu = { genre: "trait"; trait: Trait } | { genre: "texte"; el: SVGTextContentElement; texte: string; dernier: number } | { genre: "cote"; cote: CoteRendu };

interface Item extends Rangeable {
  rendu: Rendu;
}

export interface ControleTrace {
  /** Le [data-trace]. */
  hote: Element;
  svg: SVGSVGElement;
  reglages: Reglages;
  /** Durée du tracé complet, en ms, délai non compris. */
  total: number;
  /** Pose le tracé à p (0 à 1), sans animation. */
  aller(p: number): void;
  progression(): number;
  /** Trace jusqu'au bout depuis l'état présent (après le délai). */
  jouer(): void;
  /** Efface puis trace. */
  rejouer(): void;
  /** Dessin complet, tout de suite. */
  complet(): void;
  /** Change le texte d'une cote (élément porteur de data-trace-cote) : le chiffre roule, brièvement. */
  coter(source: Element, texte: string): void;
  /** Recalcule la place des textes de cote (fait seul au redimensionnement). */
  placer(): void;
  detruire(): void;
}

const controles = new WeakMap<Element, ControleTrace>();
export const controleTrace = (hote: Element) => controles.get(hote);

function mesurerTrait(el: SVGGeometryElement): Trait {
  const pl = el.getAttribute("pathLength");
  let longueur = pl ? Number(pl) : 0;
  if (!(longueur > 0)) {
    try {
      longueur = el.getTotalLength();
    } catch {
      longueur = 0;
    }
  }
  const cs = getComputedStyle(el);
  return { el, longueur, motif: lireMotif(cs.strokeDasharray), sansTrait: cs.stroke === "none" || cs.stroke === "", dernier: -1 };
}

function peindreTrait(t: Trait, q: number) {
  if (q === t.dernier) return;
  t.dernier = q;
  const s = t.el.style;
  s.visibility = q <= 0 ? "hidden" : "";
  if (t.sansTrait || t.longueur <= 0) {
    s.opacity = q >= 1 ? "" : String(q);
    return;
  }
  if (q >= 1) {
    s.strokeDasharray = "";
    s.strokeDashoffset = "";
    return;
  }
  if (t.motif) {
    s.strokeDashoffset = "0";
    s.strokeDasharray = tiretsPartiels(t.motif, t.longueur, q);
  } else {
    s.strokeDasharray = `${t.longueur} ${t.longueur + 1}`;
    s.strokeDashoffset = String(t.longueur * (1 - q));
  }
}

function sansDanger(svg: SVGSVGElement) {
  for (const n of svg.querySelectorAll("script, foreignObject, iframe")) n.remove();
  for (const n of [svg, ...svg.querySelectorAll("*")]) {
    for (const a of [...n.attributes]) {
      if (/^on/i.test(a.name) || (/href$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
    }
  }
}

let numeroTitre = 0;
function accessible(svg: SVGSVGElement) {
  if (!svg.hasAttribute("role")) svg.setAttribute("role", "img");
  if (svg.hasAttribute("aria-label") || svg.hasAttribute("aria-labelledby")) return;
  const titre = svg.querySelector(":scope > title");
  if (titre) {
    if (!titre.id) titre.id = `trace-titre-${++numeroTitre}`;
    svg.setAttribute("aria-labelledby", titre.id);
  }
}

/** Arme un [data-trace] dont le <svg> est déjà là (lui-même ou un descendant). */
export function tracer(hote: Element, options: Partial<Reglages> = {}): ControleTrace {
  const deja = controles.get(hote);
  if (deja) return deja;
  poserCss();
  const svg = (hote instanceof SVGSVGElement ? hote : hote.querySelector("svg")) as SVGSVGElement;
  if (!svg) throw new Error("data-trace : aucun <svg> à tracer");
  const ds = (hote as HTMLElement | SVGElement).dataset;
  const reglages: Reglages = { ...lireReglages(ds), ...options };
  accessible(svg);

  /* Les éléments, avec leur rôle. */
  const roleDElement = (el: Element): Role => {
    for (let n: Element | null = el; n && n !== svg.parentElement; n = n.parentElement) {
      const r = roleDe(n.getAttribute("data-trace-role"), n.getAttribute("class") ?? "", n.hasAttribute("data-trace-cote"));
      if (r) return r;
      if (n === svg) break;
    }
    return "forme";
  };
  const geosDeCote = new Set<Element>();
  const brut: Item[] = [];
  const tous = [...svg.querySelectorAll(`${GEOMETRIE}, text, tspan, [data-trace-cote]`)];
  tous.forEach((el, index) => {
    if (el.closest(HORS_DESSIN)) return;
    const ordre = el.hasAttribute("data-trace-ordre") ? Number(el.getAttribute("data-trace-ordre")) || 0 : undefined;
    if (el.hasAttribute("data-trace-cote")) {
      const geo = (el.matches(GEOMETRIE) ? el : el.querySelector(GEOMETRIE)) as SVGGeometryElement | null;
      if (!geo) return;
      geosDeCote.add(geo);
      brut.push({ role: roleDElement(el), index, ordre, rendu: { genre: "cote", cote: creerCote(el, geo) } });
      return;
    }
    if (geosDeCote.has(el)) return;
    if (el.matches(GEOMETRIE)) {
      brut.push({ role: roleDElement(el), index, ordre, rendu: { genre: "trait", trait: mesurerTrait(el as SVGGeometryElement) } });
    } else if (!el.firstElementChild && el.textContent) {
      brut.push({ role: roleDElement(el), index, ordre, rendu: { genre: "texte", el: el as SVGTextContentElement, texte: el.textContent, dernier: -1 } });
    }
  });
  const items = ordonner(brut);
  const plan = planifier(items.map((i) => i.role), reglages);

  function creerCote(source: Element, geo: SVGGeometryElement): CoteRendu {
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("data-trace-auto", "");
    g.setAttribute("aria-hidden", "true");
    g.setAttribute("class", "trace-cote");
    const cs = getComputedStyle(geo);
    const fleches: Trait[] = [];
    for (let i = 0; i < 2; i++) {
      const f = document.createElementNS(SVGNS, "path");
      f.setAttribute("class", "trace-fleche");
      f.setAttribute("stroke", cs.stroke && cs.stroke !== "none" ? cs.stroke : "currentColor");
      f.setAttribute("stroke-width", cs.strokeWidth || "1");
      g.append(f);
      fleches.push({ el: f, longueur: 0, motif: null, sansTrait: false, dernier: -1 });
    }
    const libelleTexte = source.getAttribute("data-trace-cote-libelle") ?? "";
    let libelle: SVGTextElement | null = null;
    if (libelleTexte) {
      libelle = document.createElementNS(SVGNS, "text");
      libelle.setAttribute("class", "trace-cote-texte trace-cote-libelle");
      libelle.setAttribute("text-anchor", "middle");
      g.append(libelle);
    }
    const valeur = document.createElementNS(SVGNS, "text");
    valeur.setAttribute("class", "trace-cote-texte trace-cote-valeur");
    valeur.setAttribute("text-anchor", "middle");
    g.append(valeur);
    // Juste après la source : même calque, au-dessus d'elle.
    (source.parentNode ?? svg).insertBefore(g, source.nextSibling);
    const texte = source.getAttribute("data-trace-cote") ?? "";
    const trait = mesurerTrait(geo);
    return { source, trait, groupe: g, fleches, libelle, valeur, libelleTexte, texte, affiche: texte, ecrit: "", anim: 0, tempoMaj: 0 };
  }

  /* Placement des textes et des flèches : en px d'écran, convertis dans les unités du dessin. */
  let place = false;
  function placer() {
    // Un SVG retiré de la page sans detruire() : rien à placer (et getPointAtLength lèverait une erreur).
    if (!svg.isConnected) return;
    const m = svg.getScreenCTM();
    const echelle = m ? Math.hypot(m.a, m.b) : 0;
    if (!(echelle > 0)) return;
    const k = 1 / echelle;
    for (const it of items) {
      if (it.rendu.genre !== "cote") continue;
      const c = it.rendu.cote;
      const src = c.source;
      const geo = c.trait.el;
      const L = c.trait.longueur;
      if (!(L > 0)) continue;
      const corps = lireNombre(src.getAttribute("data-trace-cote-taille") ?? undefined, 13);
      const fs = corps * k;
      const fsLib = Math.max(12, corps - 1) * k;
      const brutDec = Number((src.getAttribute("data-trace-cote-decalage") ?? "6").replace(",", "."));
      const dec = (Number.isFinite(brutDec) ? brutDec : 6) * k;
      const lf = lireNombre(src.getAttribute("data-trace-cote-fleche") ?? undefined, 7) * k;
      const pt = (s: number) => geo.getPointAtLength(Math.max(0, Math.min(L, s)));
      const e = Math.min(1, L / 4);
      const a0 = pt(0), a1 = pt(e), b0 = pt(L), b1 = pt(L - e);
      c.fleches[0]!.el.setAttribute("d", cheminFleche(a0.x, a0.y, a1.x - a0.x, a1.y - a0.y, lf));
      c.fleches[1]!.el.setAttribute("d", cheminFleche(b0.x, b0.y, b1.x - b0.x, b1.y - b0.y, lf));
      for (const f of c.fleches) {
        f.longueur = (f.el as SVGPathElement).getTotalLength();
        f.dernier = -1;
      }
      const m0 = pt(L / 2 - e / 2), m1 = pt(L / 2 + e / 2), mm = pt(L / 2);
      const r = repereCote(mm.x, mm.y, m1.x - m0.x, m1.y - m0.y, dec);
      // Libellé puis valeur, dans l'ordre de lecture ; le bloc s'écarte de la ligne du côté voulu.
      const avecLib = !!c.libelle;
      const hautV = r.dessus ? -fs * 0.22 : (avecLib ? fsLib * 1.15 : 0) + fs * 0.86;
      const hautL = r.dessus ? hautV - fs * 1.15 : fsLib * 0.86;
      const pose = (t: SVGTextElement, y: number, taille: number) => {
        t.setAttribute("x", "0");
        t.setAttribute("y", y.toFixed(2));
        t.setAttribute("font-size", taille.toFixed(2));
        t.setAttribute("stroke-width", (3.5 * k).toFixed(2));
        t.setAttribute("transform", `translate(${r.x.toFixed(2)} ${r.y.toFixed(2)}) rotate(${r.angle.toFixed(2)})`);
      };
      pose(c.valeur, hautV, fs);
      if (c.libelle) pose(c.libelle, hautL, fsLib);
    }
    place = true;
    peindre(true);
  }

  /* Peinture à un temps donné. */
  let t = 0;
  function peindreCote(c: CoteRendu, q: number) {
    peindreTrait(c.trait, borne(q / 0.55));
    const qf = borne((q - 0.5) / 0.2);
    for (const f of c.fleches) peindreTrait(f, f.longueur > 0 ? qf : qf > 0 ? 1 : 0);
    const qt = borne((q - 0.6) / 0.4);
    const lib = Array.from(c.libelleTexte).length;
    const val = Array.from(c.affiche).length;
    const n = Math.floor(qt * (lib + val) + 1e-9);
    const l = Array.from(c.libelleTexte).slice(0, n).join("");
    const v = Array.from(c.affiche).slice(0, Math.max(0, n - lib)).join("");
    const cle = `${l}\u0000${v}`;
    if (cle === c.ecrit) return;
    c.ecrit = cle;
    if (c.libelle) c.libelle.textContent = l;
    c.valeur.textContent = v;
  }
  function peindre(force = false) {
    items.forEach((it, i) => {
      const q = avancement(t, plan.creneaux[i]!);
      const r = it.rendu;
      if (r.genre === "trait") {
        if (force) r.trait.dernier = -1;
        peindreTrait(r.trait, adoucir(q));
      } else if (r.genre === "texte") {
        if (q === r.dernier && !force) return;
        r.dernier = q;
        r.el.textContent = texteEcrit(r.texte, q);
      } else {
        if (force) {
          r.cote.trait.dernier = -1;
          r.cote.ecrit = "";
        }
        peindreCote(r.cote, q);
      }
    });
  }

  /* Le temps. */
  /** Piloté de l'extérieur (API, « trace:aller ») : l'entrée dans l'écran ne relance plus rien. */
  let pilote = false;
  let raf = 0;
  let tempo = 0;
  let fini = false;
  const arreter = () => {
    cancelAnimationFrame(raf);
    clearTimeout(tempo);
    raf = 0;
  };
  const signalerFin = () => {
    if (fini) return;
    fini = true;
    hote.dispatchEvent(new CustomEvent("trace:fin", { bubbles: true }));
  };
  function aller(p: number) {
    if (!place) placer();
    t = borne(p) * plan.total;
    fini = t < plan.total ? false : fini;
    peindre();
    if (t >= plan.total) signalerFin();
  }
  function complet() {
    arreter();
    aller(1);
  }
  function jouer() {
    arreter();
    if (reduit() || plan.total <= 0) return complet();
    const lancer = () => {
      if (!place) placer();
      const t0 = performance.now() - t;
      const pas = (now: number) => {
        t = Math.min(plan.total, now - t0);
        peindre();
        if (t < plan.total) raf = requestAnimationFrame(pas);
        else {
          raf = 0;
          signalerFin();
        }
      };
      raf = requestAnimationFrame(pas);
    };
    if (reglages.delai > 0 && t === 0) tempo = window.setTimeout(lancer, reglages.delai);
    else lancer();
  }
  function rejouer() {
    arreter();
    fini = false;
    aller(0);
    jouer();
  }

  function coter(source: Element, texte: string) {
    const it = items.find((i) => i.rendu.genre === "cote" && i.rendu.cote.source === source);
    if (!it || it.rendu.genre !== "cote") return;
    const c = it.rendu.cote;
    source.setAttribute("data-trace-cote", texte);
    const de = c.affiche;
    c.texte = texte;
    cancelAnimationFrame(c.anim);
    const i = items.indexOf(it);
    const ecrite = avancement(t, plan.creneaux[i]!) >= 1;
    if (reduit() || !ecrite || de === texte) {
      c.affiche = texte;
      peindreCote(c, avancement(t, plan.creneaux[i]!));
      return;
    }
    c.groupe.classList.add("trace-cote-maj");
    clearTimeout(c.tempoMaj);
    c.tempoMaj = window.setTimeout(() => c.groupe.classList.remove("trace-cote-maj"), 650);
    const t0 = performance.now();
    const pas = (now: number) => {
      const x = borne((now - t0) / 360);
      c.affiche = interpolerCote(de, texte, adoucir(x));
      peindreCote(c, 1);
      if (x < 1) c.anim = requestAnimationFrame(pas);
    };
    c.anim = requestAnimationFrame(pas);
  }

  /* Déclencheurs. */
  const nettoyages: (() => void)[] = [];
  const ro = new ResizeObserver(() => placer());
  ro.observe(svg);
  nettoyages.push(() => ro.disconnect());
  const surAller = (e: Event) => {
    const p = Number((e as CustomEvent<{ progression?: number }>).detail?.progression);
    if (Number.isFinite(p)) {
      pilote = true;
      arreter();
      aller(p);
    }
  };
  hote.addEventListener("trace:aller", surAller);
  nettoyages.push(() => hote.removeEventListener("trace:aller", surAller));

  if (reduit()) aller(1);
  else if (reglages.quand === "defilement") {
    let attente = 0;
    const suivre = () => {
      attente = 0;
      const r = hote.getBoundingClientRect();
      aller(progressionDefilement(r.top, r.height, innerHeight));
    };
    const demander = () => {
      if (!attente) attente = requestAnimationFrame(suivre);
    };
    addEventListener("scroll", demander, { passive: true, capture: true });
    addEventListener("resize", demander, { passive: true });
    nettoyages.push(() => {
      removeEventListener("scroll", demander, { capture: true });
      removeEventListener("resize", demander);
      cancelAnimationFrame(attente);
    });
    aller(0);
    demander();
  } else if (reglages.quand === "entree") {
    aller(0);
    if (typeof IntersectionObserver === "undefined") complet();
    else {
      let joue = false;
      const io = new IntersectionObserver(
        (entrees) => {
          for (const e of entrees) {
            if (pilote) return;
            if (e.isIntersecting) {
              if (!joue) {
                joue = true;
                rejouer();
              }
            } else if (reglages.rejoue && joue && !reduit()) {
              joue = false;
              arreter();
              aller(0);
            }
          }
        },
        { threshold: 0.2 },
      );
      io.observe(hote);
      nettoyages.push(() => io.disconnect());
    }
  } else aller(0);

  const ctl: ControleTrace = {
    hote,
    svg,
    reglages,
    total: plan.total,
    aller: (p) => {
      pilote = true;
      arreter();
      aller(p);
    },
    progression: () => (plan.total > 0 ? t / plan.total : 1),
    jouer: () => {
      pilote = true;
      jouer();
    },
    rejouer: () => {
      pilote = true;
      rejouer();
    },
    complet: () => {
      pilote = true;
      complet();
    },
    coter,
    placer,
    detruire() {
      arreter();
      for (const n of nettoyages) n();
      for (const it of items) if (it.rendu.genre === "cote") cancelAnimationFrame(it.rendu.cote.anim);
      controles.delete(hote);
    },
  };
  controles.set(hote, ctl);
  return ctl;
}

/** Charge le .svg d'un data-trace-src et le pose en ligne dans l'hôte. */
async function charger(hote: HTMLElement): Promise<boolean> {
  const url = hote.dataset.traceSrc;
  if (!url) return false;
  try {
    const r = await fetch(url);
    if (!r.ok) return false;
    const doc = new DOMParser().parseFromString(await r.text(), "image/svg+xml");
    const racine = doc.documentElement;
    if (racine.nodeName !== "svg" || doc.querySelector("parsererror")) return false;
    const svg = document.importNode(racine, true) as unknown as SVGSVGElement;
    sansDanger(svg);
    if (!svg.hasAttribute("aria-label") && hote.getAttribute("aria-label")) {
      svg.setAttribute("aria-label", hote.getAttribute("aria-label")!);
      hote.removeAttribute("aria-label");
    }
    hote.append(svg);
    return true;
  } catch {
    return false;
  }
}

/** Arme tous les [data-trace] de la racine (ceux à data-trace-src une fois chargés : « trace:pret »). */
export function initTrace(root: ParentNode = document): Map<Element, ControleTrace> {
  const out = new Map<Element, ControleTrace>();
  for (const h of root.querySelectorAll<HTMLElement>("[data-trace]")) {
    if (h.dataset.tracePret) continue;
    h.dataset.tracePret = "1";
    const pret = (c: ControleTrace) => {
      out.set(h, c);
      h.dispatchEvent(new CustomEvent("trace:pret", { bubbles: true, detail: c }));
    };
    if (h.dataset.traceSrc && !(h instanceof SVGSVGElement) && !h.querySelector("svg")) {
      void charger(h).then((ok) => ok && pret(tracer(h)));
    } else if (h instanceof SVGSVGElement || h.querySelector("svg")) pret(tracer(h));
  }
  return out;
}
