/**
 * Presse — le graffiti à la bombe (canvas 2D, sans GPU).
 *
 *      <p data-graffiti="Douceur"></p>
 *
 * Pose un mot peint à la bombe : lettres épaisses au bord flou, brume de
 * pulvérisation, éclaboussures à graine fixe autour, coulures qui descendent
 * des lettres. Le mot n'apparaît pas d'un coup : il est pulvérisé.
 *  - À l'entrée dans l'écran, une buse automatique le balaie de gauche à
 *    droite (en ondulant), puis la peinture se referme : le mot est entier.
 *  - Ensuite le pointeur (souris au survol, doigt au toucher ou au glisser
 *    horizontal) repasse de la peinture là où il va : un masque de
 *    pulvérisation est peint dans un second canvas (dégradé + grain), le
 *    rayon grossit avec la lenteur et l'attente, et les coulures qu'on
 *    insiste à arroser s'allongent (jusqu'au bas de la zone, jamais au-delà).
 *
 * Attributs (tous facultatifs) :
 *   data-graffiti            le mot (défaut : le texte de l'élément).
 *   data-graffiti-couleur    couleur de la peinture (défaut #e3122b).
 *   data-graffiti-police     famille de police (défaut "Rubik Wet Paint",
 *                            chargée par la page, ex. @fontsource/rubik-wet-paint ;
 *                            sinon repli sur une grasse du système).
 *   data-graffiti-taille     "86%" (défaut) : le mot occupe 86 % de la largeur ;
 *                            "120" ou "120px" : corps en px ; "14vw".
 *                            À défaut d'attribut, la propriété CSS
 *                            --graffiti-taille de l'élément (utile en media query).
 *   data-graffiti-graine     un nombre ou un mot : mêmes éclaboussures, mêmes
 *                            coulures (défaut : tirée du mot).
 *   data-graffiti-auto       "0" : pas de passage automatique (le mot reste à
 *                            peindre au pointeur ; le texte reste lisible dans le DOM).
 *   data-graffiti-effacable  présent : la peinture s'efface lentement quand on
 *                            ne la pulvérise plus (le passage automatique ne
 *                            revient pas : c'est au pointeur de repeindre).
 *   data-graffiti-indice     "0" : pas d'indice ; "#id" : l'indice (« Survolez
 *                            pour pulvériser » / « Touchez pour pulvériser »)
 *                            est posé dans cet élément plutôt qu'au pied de la zone.
 *
 * Accessibilité : le vrai texte reste dans le DOM (dans un span visuellement
 * caché), le canvas est aria-hidden. Rien n'est atteignable seulement par
 * l'effet. Mouvement réduit : le mot entier tout de suite, coulures fixes, pas
 * de bombe au pointeur.
 *
 * Le pointeur est suivi sur toute la zone `[data-derriere]` qui contient
 * l'élément s'il y en a une (une silhouette posée devant n'arrête pas la
 * bombe), sinon sur l'élément lui-même. L'élément reçoit une hauteur minimale
 * à la mesure du mot (et de ses coulures) ; le canvas le couvre exactement :
 * rien ne déborde. Recalcul au redimensionnement et à document.fonts.ready ;
 * dpr plafonné à 2 ; la boucle d'animation s'arrête hors écran et au repos.
 *
 * Contrôle : graffiti(el) → { jouer(), effacer(), detruire(), couverture }.
 * L'élément porte data-graffiti-etat = vide | pulverise | entier.
 */
import { alea, graineDe } from "./dechirure.ts";

/* ---------------------------------------------------------------- pur */

export const COULEUR_DEFAUT = "#e3122b";
export const POLICE_DEFAUT = "Rubik Wet Paint";
const POLICES_REPLI = `"Archivo Variable", "Arial Black", Impact, sans-serif`;

export interface Boite {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** dpr plafonné (2 par défaut), jamais sous 1. */
export const dprPlafonne = (dpr: number, max = 2) => Math.max(1, Math.min(max, Number.isFinite(dpr) && dpr > 0 ? dpr : 1));

export type Taille = { mode: "px"; px: number } | { mode: "part"; part: number };

/** Lit data-graffiti-taille : "86%" (part de la largeur), "120"/"120px", "14vw" (avec la largeur de fenêtre). */
export function lireTaille(v: string | undefined | null, vw = 1000): Taille {
  const s = (v ?? "").trim().toLowerCase();
  const n = parseFloat(s);
  if (!s || !Number.isFinite(n) || n <= 0) return { mode: "part", part: 0.86 };
  if (s.endsWith("%")) return { mode: "part", part: Math.min(1, n / 100) };
  if (s.endsWith("vw")) return { mode: "px", px: (n * vw) / 100 };
  return { mode: "px", px: n };
}

/** Corps (px) pour qu'un mot large de `largeurA100` à 100 px occupe `part` de `largeur`. */
export function ajusterTaille(largeurA100: number, largeur: number, part = 0.86, min = 18, max = 640): number {
  if (!(largeurA100 > 0) || !(largeur > 0)) return min;
  return Math.max(min, Math.min(max, (100 * largeur * part) / largeurA100));
}

/** Rayon de la bombe : plus on va lentement (px/s) et plus on attend (s), plus il grossit. */
export function rayonBombe(vitesse: number, attente: number, base: number): number {
  const lent = 1 - Math.min(1, Math.max(0, vitesse) / 900);
  return base * (0.55 + 0.7 * lent * lent + Math.min(0.75, Math.max(0, attente) * 0.6));
}

/** Points le long d'un segment a → b, espacés d'au plus `pas` (sans a, avec b). */
export function jalons(ax: number, ay: number, bx: number, by: number, pas: number): [number, number][] {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.ceil(d / Math.max(0.5, pas)));
  const out: [number, number][] = [];
  for (let i = 1; i <= n; i++) out.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  return out;
}

/** Douceur d'entrée-sortie. */
export const adoucir = (t: number) => {
  const u = Math.max(0, Math.min(1, t));
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
};

/** Le passage automatique : position de la buse à t ∈ [0, 1] sur la boîte du mot (gauche → droite, en ondulant). */
export function trajetAuto(t: number, b: Boite, ondulations = 3): { x: number; y: number } {
  const e = adoucir(t);
  const deb = b.x - b.h * 0.25, fin = b.x + b.w + b.h * 0.25;
  return { x: deb + e * (fin - deb), y: b.y + b.h * (0.5 + 0.34 * Math.sin(Math.max(0, Math.min(1, t)) * Math.PI * 2 * ondulations)) };
}

export interface Goutte {
  x: number;
  y: number;
  r: number;
  a: number;
}

/**
 * Éclaboussures déterministes autour de la boîte du mot : des grappes de
 * gouttes (beaucoup de petites, quelques grosses), toutes dans la zone
 * (largeur × hauteur) avec une marge.
 */
export function eclaboussures(graine: number, b: Boite, zone: { w: number; h: number }, n = 140): Goutte[] {
  const r = alea(graine ^ 0x5eed);
  const out: Goutte[] = [];
  const k = Math.max(3, Math.round(n / 11));
  const echelle = Math.max(0.4, b.h / 150);
  const gauss = () => (r() + r() + r() - 1.5) / 1.5;
  for (let c = 0; c < k; c++) {
    // Centre de grappe : au-dessus, au-dessous ou au bout du mot, rarement dedans.
    const cote = r();
    const cx = b.x - b.w * 0.06 + r() * b.w * 1.12;
    const cy = cote < 0.42 ? b.y - b.h * (0.08 + r() * 0.45) : cote < 0.84 ? b.y + b.h * (1.02 + r() * 0.42) : b.y + b.h * r();
    const etal = b.h * (0.1 + r() * 0.22);
    const m = Math.round((n / k) * (0.5 + r()));
    for (let i = 0; i < m; i++) {
      const g: Goutte = {
        x: cx + gauss() * etal * 1.6,
        y: cy + gauss() * etal,
        r: echelle * (0.55 + 4.2 * r() ** 4),
        a: 0.55 + r() * 0.45,
      };
      if (g.x - g.r > 2 && g.y - g.r > 2 && g.x + g.r < zone.w - 2 && g.y + g.r < zone.h - 2) out.push(g);
    }
  }
  return out;
}

/** Longueur visée d'une coulure selon la peinture reçue à son départ (`charge`). */
export function longueurCible(charge: number, base: number, max: number): number {
  if (charge < 0.6) return 0;
  return Math.min(max, base + (max - base) * (1 - Math.exp(-(charge - 0.6) / 3)));
}

/** La coulure rejoint sa longueur visée, lentement, en freinant ; elle ne remonte jamais. */
export function allonger(l: number, cible: number, dt: number, vitesse: number): number {
  if (l >= cible) return l;
  const reste = cible - l;
  return Math.min(cible, l + Math.max(0.2, Math.min(reste, vitesse * dt * (0.3 + 0.7 * Math.min(1, reste / 40)))));
}

/** Grille basse définition de la couverture du masque (0…1 par case), tenue à jour à chaque coup de bombe. */
export interface Grille {
  w: number;
  h: number;
  cellule: number;
  v: Float32Array;
}
export function nouvelleGrille(largeur: number, hauteur: number, cellule = 8): Grille {
  const w = Math.max(1, Math.ceil(largeur / cellule)), h = Math.max(1, Math.ceil(hauteur / cellule));
  return { w, h, cellule, v: new Float32Array(w * h) };
}
/** Ajoute un coup de bombe (centre x, y, rayon r, opacité a) : décroissance linéaire jusqu'au bord. */
export function pulveriserGrille(g: Grille, x: number, y: number, r: number, a: number) {
  const c = g.cellule;
  const i0 = Math.max(0, Math.floor((x - r) / c)), i1 = Math.min(g.w - 1, Math.floor((x + r) / c));
  const j0 = Math.max(0, Math.floor((y - r) / c)), j1 = Math.min(g.h - 1, Math.floor((y + r) / c));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const d = Math.hypot((i + 0.5) * c - x, (j + 0.5) * c - y);
      if (d >= r) continue;
      const k = j * g.w + i;
      const v = g.v[k]!;
      g.v[k] = v + (1 - v) * a * (1 - d / r);
    }
}
/** Remplit une boîte (la peinture qui se referme à la fin du passage). */
export function remplirGrille(g: Grille, b: Boite, a = 1) {
  const c = g.cellule;
  for (let j = Math.max(0, Math.floor(b.y / c)); j <= Math.min(g.h - 1, Math.floor((b.y + b.h) / c)); j++)
    for (let i = Math.max(0, Math.floor(b.x / c)); i <= Math.min(g.w - 1, Math.floor((b.x + b.w) / c)); i++) {
      const k = j * g.w + i;
      g.v[k] = g.v[k]! + (1 - g.v[k]!) * a;
    }
}
export function decroitreGrille(g: Grille, facteur: number) {
  for (let k = 0; k < g.v.length; k++) g.v[k] = g.v[k]! * facteur;
}
export function lireGrille(g: Grille, x: number, y: number): number {
  const i = Math.floor(x / g.cellule), j = Math.floor(y / g.cellule);
  if (i < 0 || j < 0 || i >= g.w || j >= g.h) return 0;
  return g.v[j * g.w + i]!;
}
/** Couverture moyenne (0…1) sur une boîte (toute la grille par défaut). */
export function couvertureGrille(g: Grille, b?: Boite): number {
  const c = g.cellule;
  const i0 = b ? Math.max(0, Math.floor(b.x / c)) : 0, i1 = b ? Math.min(g.w - 1, Math.floor((b.x + b.w - 1) / c)) : g.w - 1;
  const j0 = b ? Math.max(0, Math.floor(b.y / c)) : 0, j1 = b ? Math.min(g.h - 1, Math.floor((b.y + b.h - 1) / c)) : g.h - 1;
  let s = 0, n = 0;
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      s += Math.min(1, g.v[j * g.w + i]!);
      n++;
    }
  return n ? s / n : 0;
}

/** Les lettres une à une (graphèmes simples), avec leur petit dérèglement de main levée. */
export interface Lettre {
  c: string;
  rot: number;
  dy: number;
  ech: number;
}
export function dereglerLettres(texte: string, graine: number): Lettre[] {
  const r = alea(graine ^ 0x1e77e5);
  return Array.from(texte).map((c) => ({ c, rot: (r() - 0.5) * 0.08, dy: (r() - 0.5) * 0.07, ech: 1 + (r() - 0.5) * 0.07 }));
}

/* ---------------------------------------------------------------- DOM */

const CSS = `
.gft-toile { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
.gft-lu { position: absolute !important; width: 1px !important; height: 1px !important; margin: -1px !important; padding: 0 !important; border: 0 !important; overflow: hidden !important; clip-path: inset(50%) !important; white-space: nowrap !important; }
.gft-indice { display: inline-flex; align-items: center; gap: 0.5em; font: 600 12px/1.2 ui-monospace, "IBM Plex Mono", Menlo, monospace; letter-spacing: 0.03em; text-transform: uppercase; color: inherit; pointer-events: none; transition: opacity 0.6s; }
.gft-indice::before { content: ""; width: 0.7em; height: 0.7em; border-radius: 50%; background: var(--gft-couleur, #e3122b); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gft-couleur, #e3122b) 30%, transparent); }
[data-graffiti] > .gft-indice { position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%); white-space: nowrap; }
.gft-indice.gft-vu { opacity: 0; }
.gft-doigt { display: none; }
@media (hover: none) { .gft-souris { display: none; } .gft-doigt { display: inline; } }
@media (prefers-reduced-motion: reduce) { .gft-indice { display: none; } }
`;
let cssPose = false;
function poserCss() {
  if (cssPose) return;
  const s = document.createElement("style");
  s.dataset.presse = "graffiti";
  s.textContent = CSS;
  document.head.append(s);
  cssPose = true;
}

const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface ControleGraffiti {
  /** (Re)joue le passage automatique depuis un mur vierge. */
  jouer(): void;
  /** Efface tout (le mur redevient vierge). */
  effacer(): void;
  detruire(): void;
  /** Couverture du mot par la peinture, 0…1. */
  readonly couverture: number;
}

interface Coulure {
  x: number;
  y: number;
  w: number;
  base: number;
  max: number;
  l: number;
  charge: number;
  derive: number;
}

const toile = (w = 1, h = 1) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

export function graffiti(el: HTMLElement): ControleGraffiti {
  poserCss();
  const texte = (el.dataset.graffiti || el.textContent || "").trim();
  const motPeint = texte.toLocaleUpperCase("fr");
  const couleur = el.dataset.graffitiCouleur || COULEUR_DEFAUT;
  const police = el.dataset.graffitiPolice || POLICE_DEFAUT;
  const graine = graineDe(el.dataset.graffitiGraine ?? texte, 7);
  const auto = el.dataset.graffitiAuto !== "0";
  const effacable = el.hasAttribute("data-graffiti-effacable") && el.dataset.graffitiEffacable !== "0";
  const immobile = reduit();
  el.style.setProperty("--gft-couleur", couleur);

  // Le vrai texte, lisible par tous : les enfants existants (ou le mot) dans un span visuellement caché.
  const lu = document.createElement("span");
  lu.className = "gft-lu";
  const avaitTexte = !!el.textContent?.trim();
  if (avaitTexte) lu.append(...el.childNodes);
  else lu.textContent = texte;
  el.append(lu);

  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  const minHauteurAvant = el.style.minHeight;
  const canvas = toile();
  canvas.className = "gft-toile";
  canvas.setAttribute("aria-hidden", "true");
  el.prepend(canvas);
  const ctx = canvas.getContext("2d")!;

  // L'indice.
  let indice: HTMLElement | null = null;
  const ouIndice = el.dataset.graffitiIndice;
  if (ouIndice !== "0" && !immobile) {
    indice = document.createElement("span");
    indice.className = "gft-indice";
    indice.setAttribute("aria-hidden", "true");
    indice.innerHTML = `<span class="gft-souris">Survolez pour pulvériser</span><span class="gft-doigt">Touchez pour pulvériser</span>`;
    indice.style.setProperty("--gft-couleur", couleur);
    const hote = ouIndice && ouIndice !== "1" ? document.querySelector<HTMLElement>(ouIndice) : null;
    (hote ?? el).append(indice);
  }

  // Les couches hors écran.
  const encre = toile(); // le mot entier, peint, avec brume, grain et éclaboussures
  const masque = toile(); // la pulvérisation (alpha), en px CSS
  const finition = toile(); // la plaque floue qui referme la peinture sur le mot
  const mctx = masque.getContext("2d")!;
  const r = alea(graine ^ 0xb0b);

  let W = 0, H = 0, dpr = 1, taille = 0;
  let boite: Boite = { x: 0, y: 0, w: 0, h: 0 };
  let grille = nouvelleGrille(1, 1);
  let coulures: Coulure[] = [];
  let pret = false, visible = false, raf = 0, dernierT = 0;
  let etat: "vide" | "pulverise" | "entier" = "vide";
  // Passage automatique : -1 = pas commencé, 0…1 = en cours, puis finition.
  let tAuto = -1, tFin = -1, autoJoue = false;
  let dernierSpray = -1e9;
  let effaceDepuis = 0;
  // La buse du pointeur.
  const buse = { dedans: false, appuye: false, x: 0, y: 0, vx: 0, vitesse: 0, dernier: 0, immobileDepuis: 0, souris: true };
  let utilise = false;

  const marquer = (e: typeof etat) => {
    etat = e;
    el.dataset.graffitiEtat = e;
  };
  marquer("vide");

  /* ---- mise en page */
  const fontDe = (px: number) => `${px.toFixed(2)}px "${police}", ${POLICES_REPLI}`;

  const disposer = () => {
    const largeur = el.clientWidth;
    if (!largeur) return;
    // Corps : mesuré à 100 px.
    ctx.font = fontDe(100);
    const m100 = ctx.measureText(motPeint);
    const valeur = el.dataset.graffitiTaille || getComputedStyle(el).getPropertyValue("--graffiti-taille").trim();
    const t = lireTaille(valeur, innerWidth);
    taille = t.mode === "px" ? t.px : ajusterTaille(m100.width, largeur, t.part);
    // Pas plus large que la zone (avec une marge pour les éclaboussures).
    taille = Math.min(taille, ajusterTaille(m100.width, largeur, 0.96));
    const k = taille / 100;
    const asc = (m100.actualBoundingBoxAscent || 72) * k, desc = (m100.actualBoundingBoxDescent || 4) * k;
    const hMot = asc + desc;
    // Hauteur : de la place au-dessus pour les éclaboussures, au-dessous pour les coulures.
    const besoin = Math.ceil(hMot * 2.05 + 24);
    el.style.minHeight = `${besoin}px`;
    W = largeur;
    H = Math.max(el.clientHeight, besoin);
    dpr = dprPlafonne(devicePixelRatio);
    const largeurMot = m100.width * k;
    // Le mot un peu au-dessus du milieu : les coulures ont plus de place que les éclaboussures du haut.
    const haut = Math.round((H - hMot) * 0.4);
    boite = { x: (W - largeurMot) / 2, y: haut, w: largeurMot, h: hMot };

    // Les couches, à la nouvelle taille ; le masque garde ce qui était peint (mis à l'échelle).
    const ancienMasque = masque.width > 1 ? toile(masque.width, masque.height) : null;
    if (ancienMasque) ancienMasque.getContext("2d")!.drawImage(masque, 0, 0);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    encre.width = canvas.width;
    encre.height = canvas.height;
    masque.width = Math.ceil(W);
    masque.height = Math.ceil(H);
    if (ancienMasque) mctx.drawImage(ancienMasque, 0, 0, masque.width, masque.height);
    const ancienne = grille;
    grille = nouvelleGrille(W, H);
    if (ancienne.v.length > 1) {
      for (let j = 0; j < grille.h; j++)
        for (let i = 0; i < grille.w; i++) {
          const ii = Math.min(ancienne.w - 1, Math.floor((i / grille.w) * ancienne.w));
          const jj = Math.min(ancienne.h - 1, Math.floor((j / grille.h) * ancienne.h));
          grille.v[j * grille.w + i] = ancienne.v[jj * ancienne.w + ii]!;
        }
    }
    peindreEncre(asc);
    preparerFinition();
    trouverCoulures(asc);
    pret = true;
    if (immobile || etat === "entier") toutPeindre();
    composer();
  };

  /** Les lettres une à une, avec leur dérèglement, dans un contexte déjà placé. */
  const lettres = dereglerLettres(motPeint, graine);
  const tracerMot = (c: CanvasRenderingContext2D, asc: number) => {
    c.font = fontDe(taille);
    c.textBaseline = "alphabetic";
    let x = boite.x;
    let avant = "";
    for (const l of lettres) {
      // Avance avec l'approche de paire : mesure du préfixe.
      const xa = boite.x + c.measureText(avant).width;
      x = xa;
      avant += l.c;
      const lw = c.measureText(l.c).width;
      c.save();
      c.translate(x + lw / 2, boite.y + asc + l.dy * taille);
      c.rotate(l.rot);
      c.scale(l.ech, l.ech);
      c.fillText(l.c, -lw / 2, 0);
      c.restore();
    }
  };

  /** Dessine le mot flou : la forme est tracée hors toile, seule son ombre (floutée) tombe dedans. */
  const motFlou = (c: CanvasRenderingContext2D, asc: number, flou: number, alpha: number) => {
    const D = (W + taille * 4) * dpr;
    c.save();
    c.setTransform(dpr, 0, 0, dpr, -D, 0);
    c.shadowColor = couleur;
    c.shadowBlur = flou * dpr;
    c.shadowOffsetX = D;
    c.globalAlpha = alpha;
    c.fillStyle = "#000";
    tracerMot(c, asc);
    c.restore();
  };

  const peindreEncre = (asc: number) => {
    const c = encre.getContext("2d")!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, encre.width, encre.height);
    const rr = alea(graine ^ 0xe9c3e);
    // 1. La brume de pulvérisation, large et légère.
    motFlou(c, asc, taille * 0.16, 0.3);
    // 2. Le corps des lettres, bord doux.
    motFlou(c, asc, taille * 0.032, 1);
    motFlou(c, asc, taille * 0.012, 0.85);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 3. Le grain : de petits trous dans la peinture…
    c.globalCompositeOperation = "destination-out";
    const nTrous = Math.round((boite.w * boite.h) / 55);
    for (let i = 0; i < nTrous; i++) {
      c.globalAlpha = 0.18 + rr() * 0.4;
      c.beginPath();
      c.arc(boite.x + rr() * boite.w, boite.y - taille * 0.05 + rr() * (boite.h + taille * 0.1), 0.35 + rr() * 0.8, 0, Math.PI * 2);
      c.fill();
    }
    // … et les points de brume autour des lettres (échantillonnés sur une version très floue du mot).
    c.globalCompositeOperation = "source-over";
    c.fillStyle = couleur;
    const q = 4;
    const petite = toile(Math.ceil(W / q), Math.ceil(H / q));
    const pc = petite.getContext("2d")!;
    {
      const D = (W + taille * 4) / q;
      pc.setTransform(1 / q, 0, 0, 1 / q, -D, 0);
      pc.shadowColor = "#000";
      pc.shadowBlur = (taille * 0.22) / q;
      pc.shadowOffsetX = D;
      pc.font = fontDe(taille);
      tracerMot(pc, asc);
    }
    const halo = pc.getImageData(0, 0, petite.width, petite.height).data;
    const nPoints = Math.round((W * H) / 70);
    for (let i = 0; i < nPoints; i++) {
      const x = rr() * W, y = rr() * H;
      const a = halo[((Math.floor(y / q) * petite.width + Math.floor(x / q)) << 2) + 3]! / 255;
      if (a < 0.02 || rr() > a * 1.6) continue;
      c.globalAlpha = 0.35 + rr() * 0.55;
      c.beginPath();
      c.arc(x, y, 0.4 + rr() * rr() * 1.6, 0, Math.PI * 2);
      c.fill();
    }
    // 4. Les éclaboussures, à graine fixe.
    for (const g of eclaboussures(graine, boite, { w: W, h: H }, Math.round(90 + boite.w / 6))) {
      c.globalAlpha = g.a;
      c.beginPath();
      c.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      c.fill();
      if (g.r > 2.2) {
        // Une grosse goutte a sa petite traînée.
        c.beginPath();
        c.ellipse(g.x + g.r * 0.9, g.y + g.r * 0.6, g.r * 0.45, g.r * 0.3, 0.6, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;
  };

  /** La plaque qui referme la peinture : la boîte du mot élargie, aux bords très doux. */
  const preparerFinition = () => {
    finition.width = masque.width;
    finition.height = masque.height;
    const c = finition.getContext("2d")!;
    const m = taille * 0.22;
    const D = W + m * 8;
    c.clearRect(0, 0, finition.width, finition.height);
    c.save();
    c.setTransform(1, 0, 0, 1, -D, 0);
    c.shadowColor = "#000";
    c.shadowBlur = m * 0.9;
    c.shadowOffsetX = D;
    c.fillStyle = "#000";
    c.beginPath();
    c.roundRect(boite.x - m * 0.4, boite.y - m * 0.5, boite.w + m * 0.8, boite.h + m, m);
    c.fill();
    c.restore();
  };

  /** Les départs de coulures : le bas des lettres, colonne par colonne, sur un masque net du mot. */
  const trouverCoulures = (asc: number) => {
    const q = 2;
    const net = toile(Math.ceil(W / q), Math.ceil(H / q));
    const nc = net.getContext("2d")!;
    nc.setTransform(1 / q, 0, 0, 1 / q, 0, 0);
    nc.fillStyle = "#000";
    tracerMot(nc, asc);
    const d = nc.getImageData(0, 0, net.width, net.height).data;
    const rr = alea(graine ^ 0xc0c0);
    const n = Math.max(4, Math.round(lettres.length * 1.5));
    const bas = Math.min(net.height - 1, Math.ceil((boite.y + boite.h + taille * 0.12) / q));
    const haut = Math.max(0, Math.floor((boite.y + boite.h * 0.35) / q));
    const vieilles = coulures;
    coulures = [];
    for (let essai = 0; essai < n * 6 && coulures.length < n; essai++) {
      const x = boite.x + boite.w * (0.02 + rr() * 0.96);
      const i = Math.floor(x / q);
      let y = -1;
      for (let j = bas; j >= haut; j--)
        if (d[((j * net.width + i) << 2) + 3]! > 160) {
          y = j * q;
          break;
        }
      if (y < 0) continue;
      if (coulures.some((c) => Math.abs(c.x - x) < taille * 0.07)) continue;
      const w = Math.max(1.6, taille * (0.018 + rr() * 0.03));
      const place = H - y - w * 1.6 - 6; // jamais hors de la zone
      if (place < w * 3) continue;
      const max = Math.min(place, taille * (0.28 + rr() * 0.75));
      const base = max * (0.18 + rr() * 0.22);
      coulures.push({ x, y: y - w * 0.6, w, base, max, l: 0, charge: 0, derive: (rr() - 0.5) * w * 0.5 });
    }
    // Après un redimensionnement, les coulures gardent leur avancée relative.
    if (vieilles.length) {
      for (let k = 0; k < coulures.length && k < vieilles.length; k++) {
        const v = vieilles[k]!, c = coulures[k]!;
        c.charge = v.charge;
        c.l = Math.min(c.max, v.max ? (v.l / v.max) * c.max : 0);
      }
    }
  };

  /* ---- pulvérisation */
  const coup = (x: number, y: number, rayon: number, a: number) => {
    const g = mctx.createRadialGradient(x, y, 0, x, y, rayon);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    mctx.fillStyle = g;
    mctx.beginPath();
    mctx.arc(x, y, rayon, 0, Math.PI * 2);
    mctx.fill();
    // Le grain de la bombe : des points épars, plus serrés au centre.
    mctx.fillStyle = "#000";
    const n = Math.round(4 + rayon * 0.35);
    for (let i = 0; i < n; i++) {
      const ang = r() * Math.PI * 2, d = rayon * 1.15 * Math.sqrt(-2 * Math.log(1 - r() * 0.95)) * 0.5;
      mctx.globalAlpha = Math.min(1, a * (1.5 + r() * 2));
      mctx.beginPath();
      mctx.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, 0.5 + r() * 1.1, 0, Math.PI * 2);
      mctx.fill();
    }
    mctx.globalAlpha = 1;
    pulveriserGrille(grille, x, y, rayon, a);
    for (const c of coulures) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < rayon) c.charge += a * (1 - d / rayon) * 3;
    }
    dernierSpray = performance.now();
    if (etat === "vide") marquer("pulverise");
  };

  const toutPeindre = () => {
    mctx.globalAlpha = 1;
    mctx.drawImage(finition, 0, 0);
    mctx.drawImage(finition, 0, 0);
    mctx.drawImage(finition, 0, 0);
    remplirGrille(grille, { x: boite.x - taille * 0.1, y: boite.y - taille * 0.1, w: boite.w + taille * 0.2, h: boite.h + taille * 0.2 });
    for (const c of coulures) {
      c.charge = Math.max(c.charge, 1);
      if (immobile) c.l = longueurCible(c.charge, c.base, c.max);
    }
    marquer("entier");
  };

  /* ---- composition */
  const composer = () => {
    if (!pret) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(encre, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(masque, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = couleur;
    for (const c of coulures) {
      if (c.l < 0.5) continue;
      const a = Math.min(1, lireGrille(grille, c.x, c.y) * 1.25);
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      const bx = c.x + c.derive * (c.l / c.max);
      const yb = c.y + c.l;
      // Un filet qui s'affine, puis la goutte au bout.
      ctx.beginPath();
      ctx.moveTo(c.x - c.w / 2, c.y - c.w);
      ctx.quadraticCurveTo(c.x - c.w * 0.42, c.y + c.l * 0.5, bx - c.w * 0.3, yb);
      ctx.lineTo(bx + c.w * 0.3, yb);
      ctx.quadraticCurveTo(c.x + c.w * 0.42, c.y + c.l * 0.5, c.x + c.w / 2, c.y - c.w);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bx, yb, c.w * 0.5, c.w * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  /* ---- boucle */
  const DUREE_AUTO = 1.7, DUREE_FIN = 0.5;
  const pas = (t: number) => {
    raf = 0;
    const dt = Math.min(0.05, dernierT ? (t - dernierT) / 1000 : 1 / 60);
    dernierT = t;
    if (!pret || !visible) {
      dernierT = 0;
      return;
    }
    let encore = false;
    // Le passage automatique.
    if (tAuto >= 0 && tAuto < 1) {
      const avant = trajetAuto(tAuto, boite);
      tAuto = Math.min(1, tAuto + dt / DUREE_AUTO);
      const apres = trajetAuto(tAuto, boite);
      const rayon = boite.h * 0.55;
      for (const [x, y] of jalons(avant.x, avant.y, apres.x, apres.y, rayon * 0.2)) coup(x, y, rayon, 0.2);
      if (tAuto >= 1) tFin = 0;
      encore = true;
    } else if (tFin >= 0 && tFin < 1) {
      const a = Math.min(1, dt / DUREE_FIN);
      tFin = Math.min(1, tFin + a);
      mctx.globalAlpha = Math.min(1, a * 1.6);
      mctx.drawImage(finition, 0, 0);
      mctx.globalAlpha = 1;
      if (tFin >= 1) toutPeindre();
      encore = true;
    }
    // La bombe du pointeur.
    if (buse.dedans && (buse.souris || buse.appuye)) {
      const attente = (t - buse.immobileDepuis) / 1000;
      if (t - buse.dernier > 60) buse.vitesse *= Math.exp(-dt * 8);
      const rayon = rayonBombe(buse.vitesse, buse.vitesse < 60 ? attente : 0, boite.h * 0.3);
      coup(buse.x, buse.y, rayon, buse.vitesse < 60 ? 0.07 : 0.05);
      encore = true;
    }
    // Les coulures.
    for (const c of coulures) {
      const cible = longueurCible(c.charge, c.base, c.max);
      if (c.l < cible - 0.01) {
        c.l = allonger(c.l, cible, dt, taille * 0.32);
        encore = true;
      }
    }
    // L'effacement lent (la boucle reste en vie tant qu'il reste de la peinture).
    if (effacable && etat !== "vide" && t - dernierSpray <= 1600) encore = true;
    if (effacable && etat !== "vide" && t - dernierSpray > 1600) {
      effaceDepuis += dt;
      if (effaceDepuis >= 0.1) {
        effaceDepuis = 0;
        mctx.globalCompositeOperation = "destination-out";
        mctx.globalAlpha = 0.035;
        mctx.fillRect(0, 0, masque.width, masque.height);
        mctx.globalCompositeOperation = "source-over";
        mctx.globalAlpha = 1;
        decroitreGrille(grille, 0.965);
        for (const c of coulures) c.charge *= 0.965;
      }
      if (t - dernierSpray > 10000) {
        viderMur();
      } else encore = true;
      if (etat === "entier") marquer("pulverise");
    }
    composer();
    if (encore) demander();
    else dernierT = 0;
  };
  const demander = () => {
    if (!raf && visible && pret && !immobile) raf = requestAnimationFrame(pas);
  };

  const viderMur = () => {
    mctx.clearRect(0, 0, masque.width, masque.height);
    grille.v.fill(0);
    for (const c of coulures) {
      c.l = 0;
      c.charge = 0;
    }
    marquer("vide");
  };

  /* ---- pointeur */
  const zone = el.closest<HTMLElement>("[data-derriere]") ?? el;
  const local = (e: PointerEvent) => {
    const b = canvas.getBoundingClientRect();
    // La toile peut être étirée par une transformation : on ramène au repère CSS.
    const sx = b.width ? W / b.width : 1, sy = b.height ? H / b.height : 1;
    return { x: (e.clientX - b.left) * sx, y: (e.clientY - b.top) * sy, dans: e.clientX >= b.left - 20 && e.clientX <= b.right + 20 && e.clientY >= b.top - 20 && e.clientY <= b.bottom + 20 };
  };
  const surBouge = (e: PointerEvent) => {
    if (!pret) return;
    const p = local(e);
    const t = performance.now();
    buse.souris = e.pointerType === "mouse" || e.pointerType === "pen";
    if (!p.dans) {
      buse.dedans = false;
      return;
    }
    if (buse.dedans && (buse.souris || buse.appuye)) {
      const dtm = Math.max(1, t - buse.dernier) / 1000;
      const d = Math.hypot(p.x - buse.x, p.y - buse.y);
      buse.vitesse = buse.vitesse * 0.6 + (d / dtm) * 0.4;
      if (d > 3) buse.immobileDepuis = t;
      const rayon = rayonBombe(buse.vitesse, 0, boite.h * 0.3);
      for (const [x, y] of jalons(buse.x, buse.y, p.x, p.y, rayon * 0.35)) coup(x, y, rayon, 0.05);
    } else buse.immobileDepuis = t;
    buse.dedans = true;
    buse.x = p.x;
    buse.y = p.y;
    buse.dernier = t;
    if ((buse.souris || buse.appuye) && !utilise) {
      utilise = true;
      indice?.classList.add("gft-vu");
    }
    demander();
  };
  const surAppui = (e: PointerEvent) => {
    buse.appuye = true;
    buse.dedans = false;
    surBouge(e);
    // Au doigt, une touche suffit : une bouffée franche là où l'on touche.
    if (pret && buse.dedans && e.pointerType !== "mouse") {
      coup(buse.x, buse.y, boite.h * 0.5, 0.45);
      coup(buse.x, buse.y, boite.h * 0.32, 0.4);
    }
  };
  const surFin = () => {
    buse.appuye = false;
    if (buse.souris) return;
    buse.dedans = false;
  };
  const surSortie = () => {
    buse.dedans = false;
    buse.appuye = false;
  };
  const toucherAvant = zone.style.touchAction;
  if (!immobile) {
    zone.addEventListener("pointermove", surBouge, { passive: true });
    zone.addEventListener("pointerdown", surAppui, { passive: true });
    zone.addEventListener("pointerup", surFin, { passive: true });
    zone.addEventListener("pointercancel", surSortie, { passive: true });
    zone.addEventListener("pointerleave", surSortie, { passive: true });
    if (!zone.style.touchAction && getComputedStyle(zone).touchAction === "auto") zone.style.touchAction = "pan-y";
  }

  /* ---- observateurs */
  let attenteMesure = 0;
  const redisposer = () => {
    if (attenteMesure) return;
    attenteMesure = requestAnimationFrame(() => {
      attenteMesure = 0;
      disposer();
    });
  };
  const ro = new ResizeObserver(() => {
    if (el.clientWidth !== W) redisposer();
  });
  ro.observe(el);
  const io = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        visible = e.isIntersecting;
        if (visible && e.intersectionRatio >= 0.35 && auto && !autoJoue && !immobile && pret) {
          autoJoue = true;
          tAuto = 0;
        }
      }
      demander();
    },
    { threshold: [0, 0.35, 0.6] },
  );
  io.observe(el);

  let detruit = false;
  const charger = async () => {
    try {
      await document.fonts.load(fontDe(100), motPeint);
    } catch {
      /* la police de repli fera l'affaire */
    }
    if (detruit) return;
    disposer();
    // L'observateur a pu se prononcer avant la police : on relance le passage si la zone est déjà bien visible.
    const b = el.getBoundingClientRect();
    const vue = Math.max(0, Math.min(innerHeight, b.bottom) - Math.max(0, b.top)) / Math.max(1, b.height);
    if (auto && !autoJoue && !immobile && visible && vue >= 0.35) {
      autoJoue = true;
      tAuto = 0;
    }
    demander();
  };
  void charger();
  void document.fonts.ready.then(() => {
    if (!detruit) redisposer();
  });

  return {
    jouer() {
      viderMur();
      if (immobile) {
        toutPeindre();
        composer();
        return;
      }
      autoJoue = true;
      tAuto = 0;
      tFin = -1;
      demander();
    },
    effacer() {
      tAuto = -1;
      tFin = -1;
      viderMur();
      composer();
    },
    detruire() {
      detruit = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(attenteMesure);
      ro.disconnect();
      io.disconnect();
      zone.removeEventListener("pointermove", surBouge);
      zone.removeEventListener("pointerdown", surAppui);
      zone.removeEventListener("pointerup", surFin);
      zone.removeEventListener("pointercancel", surSortie);
      zone.removeEventListener("pointerleave", surSortie);
      zone.style.touchAction = toucherAvant;
      canvas.remove();
      indice?.remove();
      if (avaitTexte) el.append(...lu.childNodes);
      lu.remove();
      delete el.dataset.graffitiPret;
      el.style.minHeight = minHauteurAvant;
      delete el.dataset.graffitiEtat;
    },
    get couverture() {
      return couvertureGrille(grille, boite);
    },
  };
}

/* ---------------------------------------------------------------- init */

export function initGraffiti(root: ParentNode = document): Map<HTMLElement, ControleGraffiti> {
  poserCss();
  const out = new Map<HTMLElement, ControleGraffiti>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-graffiti]")) {
    if (el.dataset.graffitiPret) continue;
    el.dataset.graffitiPret = "1";
    out.set(el, graffiti(el));
  }
  return out;
}
