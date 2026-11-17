/**
 * Presse — le papier déchiré (DOM + SVG, sans GPU).
 *
 * 1. Un bord déchiré sur une section :
 *      <footer data-dechirure="haut">…</footer>
 *    data-dechirure            haut | bas | gauche | droite (défaut haut) :
 *                              le côté qui est déchiré. Le papier dépasse de
 *                              ce côté (au plus l'amplitude) par-dessus la
 *                              section voisine, avec un liseré blanc de fibre
 *                              et une ombre portée sur la voisine.
 *    data-dechirure-graine     un nombre ou un mot : la même graine donne la
 *                              même déchirure (défaut : tirée de l'id ou du rang).
 *    data-dechirure-amplitude  profondeur en px (défaut 22).
 *    data-dechirure-fibre      largeur moyenne du liseré en px (défaut 5 ; 0 = aucun).
 *    data-dechirure-couleur    couleur du papier (défaut : le fond calculé de
 *                              l'élément).
 *    data-dechirure-ombre      "0" retire l'ombre portée.
 *    L'élément ne doit pas rogner son débordement (pas d'overflow: hidden) :
 *    le bord est dessiné hors de sa boîte. Il passe en position relative et
 *    z-index 1 s'il n'en a pas.
 *
 * 2. Deux images séparées par une déchirure verticale qui suit le pointeur :
 *      <div data-dechirure-coupe="0.5">
 *        <img src="couleur.jpg" alt="…">     ← à gauche de la déchirure
 *        <img src="nb.jpg" alt="">           ← à droite
 *      </div>
 *    La valeur est la position de repos (0…1, défaut 0.5) ; la déchirure
 *    rejoint le pointeur (ou le doigt) avec inertie, et revient au repos
 *    quand il s'en va (data-dechirure-retour="0" : elle reste où elle est).
 *    data-dechirure-graine, -amplitude (défaut 16), -fibre (défaut 4) et
 *    -ombre valent ici aussi. Les deux enfants sont posés l'un sur l'autre
 *    (le conteneur fixe la taille : donnez-lui un aspect-ratio ou une hauteur).
 *    Mouvement réduit : la déchirure saute à sa place, sans inertie.
 *    data-dechirure-detoure    pour deux images détourées (PNG / WebP à fond
 *                              transparent, même masque) : le liseré et l'ombre
 *                              de la déchirure sont masqués par l'alpha de
 *                              l'image du haut (l'image de droite) ; ils ne se
 *                              dessinent que sur la silhouette, jamais sur le
 *                              fond transparent ; l'image de gauche est rognée
 *                              juste après le bord (ses franges ne
 *                              transparaissent pas sous le noir et blanc).
 *                              "0" le désactive.
 *
 * Tout est recalculé au redimensionnement (ResizeObserver) ; le suivi du
 * pointeur ne touche qu'à des transform (pas de mise en page par image).
 */

/* ---------------------------------------------------------------- bruit pur */

/** Générateur pseudo-aléatoire à graine (mulberry32) : [0, 1). */
export function alea(graine: number): () => number {
  let a = graine >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une graine depuis un texte (FNV-1a) ; un nombre écrit en chiffres est pris tel quel. */
export function graineDe(s: string | undefined | null, defaut = 1): number {
  if (s == null || s === "") return defaut >>> 0;
  if (/^\d+$/.test(s)) return Number(s) >>> 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Profil de déchirure : n valeurs dans [-1, 1], bruit de valeur à plusieurs
 * octaves (grandes ondulations + dents fines), plus quelques accrocs nets.
 * `echelle` : nombre d'ondulations de la plus grande octave sur la longueur.
 */
export function profil(n: number, graine: number, echelle = 3, octaves = 5): number[] {
  const r = alea(graine);
  const out = new Array<number>(Math.max(0, n)).fill(0);
  if (n <= 0) return out;
  let amp = 1, freq = echelle, somme = 0;
  for (let o = 0; o < octaves; o++) {
    const m = Math.ceil(freq) + 2;
    const treillis = Array.from({ length: m }, () => r() * 2 - 1);
    const dec = r();
    for (let i = 0; i < n; i++) {
      const t = (i / Math.max(1, n - 1)) * freq + dec;
      const k = Math.floor(t), f = t - k;
      const s = f * f * (3 - 2 * f);
      out[i]! += ((treillis[k % m]! * (1 - s)) + treillis[(k + 1) % m]! * s) * amp;
    }
    somme += amp;
    amp *= 0.6;
    freq *= 2.3;
  }
  // Accrocs : quelques dents brusques, comme une fibre qui a résisté.
  const accrocs = Math.max(1, Math.round(n / 40));
  for (let a = 0; a < accrocs; a++) {
    const c = Math.floor(r() * n), larg = 1 + Math.floor(r() * 3), h = (r() * 2 - 1) * 0.6;
    for (let i = Math.max(0, c - larg); i < Math.min(n, c + larg); i++) out[i]! += h * (1 - Math.abs(i - c) / larg);
  }
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs((out[i]! /= somme)));
  if (max > 0) for (let i = 0; i < n; i++) out[i]! /= max;
  return out;
}

/** Nombre d'échantillons pour une longueur en px (un tous les ~5 px, borné). */
export const echantillons = (longueur: number) => Math.max(8, Math.min(700, Math.round(longueur / 5)));

/** Profondeur (0…amp) de chaque échantillon, depuis un profil [-1, 1]. */
export const profondeurs = (p: readonly number[], amp: number) => p.map((v) => amp * (0.5 + 0.5 * v));

/** Chemin SVG fermé d'une bande déchirée vue dans son repère : le long de x (0…L), le papier plein sous y = d(x), jusqu'à y = base. */
export function cheminBande(d: readonly number[], longueur: number, base: number): string {
  const n = d.length;
  let s = `M0 ${base.toFixed(1)}`;
  for (let i = 0; i < n; i++) s += `L${((i / (n - 1)) * longueur).toFixed(1)} ${d[i]!.toFixed(1)}`;
  return s + `L${longueur.toFixed(1)} ${base.toFixed(1)}Z`;
}

/* ---------------------------------------------------------------- DOM commun */

const NS = "http://www.w3.org/2000/svg";
const CSS = `
.dch-bord { position: absolute; pointer-events: none; overflow: visible; display: block; }
.dch-bord[data-cote="haut"] { left: 0; bottom: calc(100% - 1px); width: 100%; }
.dch-bord[data-cote="bas"] { left: 0; top: calc(100% - 1px); width: 100%; }
.dch-bord[data-cote="gauche"] { top: 0; right: calc(100% - 1px); height: 100%; }
.dch-bord[data-cote="droite"] { top: 0; left: calc(100% - 1px); height: 100%; }
[data-dechirure-coupe] { position: relative; overflow: hidden; touch-action: pan-y; isolation: isolate; }
[data-dechirure-coupe] > :not(.dch-fibre) { position: absolute; inset: 0; width: 100%; height: 100%; }
[data-dechirure-coupe] > img, .dch-volet > img, .dch-volet > picture > img { object-fit: cover; display: block; width: 100%; height: 100%; }
.dch-volet { will-change: transform; }
.dch-volet > .dch-dedans { position: absolute; inset: 0; will-change: transform; }
.dch-volet > .dch-dedans > * { position: absolute; inset: 0; width: 100%; height: 100%; }
.dch-volet > .dch-dedans > img { object-fit: cover; }
.dch-fibre { position: absolute; top: 0; left: 0; height: 100%; pointer-events: none; z-index: 2; will-change: transform; overflow: visible; }
.dch-fibre[data-detoure] { -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-mode: alpha; mask-mode: alpha; }
`;
let cssPose = false;
let compteur = 0;
const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function poserCss() {
  if (cssPose) return;
  const s = document.createElement("style");
  s.dataset.presse = "dechirure";
  s.textContent = CSS;
  document.head.append(s);
  cssPose = true;
}

/** Le filtre de fibre (une fois par page) : le liseré blanc s'effiloche. */
function filtreFibre(): string {
  const id = "dch-filtre-fibre";
  if (!document.getElementById(id)) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.innerHTML = `<defs>
      <filter id="${id}" x="-5%" y="-50%" width="110%" height="200%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="2" seed="7" result="b"/>
        <feDisplacementMap in="SourceGraphic" in2="b" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="dch-flou" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>`;
    document.body.append(svg);
  }
  return id;
}

const nombre = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : d;
};

/* ---------------------------------------------------------------- 1. bord */

export type Cote = "haut" | "bas" | "gauche" | "droite";
const estCote = (s: string | undefined): s is Cote => s === "haut" || s === "bas" || s === "gauche" || s === "droite";

function bord(el: HTMLElement): () => void {
  const cote: Cote = estCote(el.dataset.dechirure) ? el.dataset.dechirure : "haut";
  const graine = graineDe(el.dataset.dechirureGraine ?? el.id, 1000 + compteur++);
  const amp = Math.max(2, nombre(el.dataset.dechirureAmplitude, 22));
  const fibre = Math.max(0, nombre(el.dataset.dechirureFibre, 5));
  const ombre = el.dataset.dechirureOmbre !== "0";
  const cs = getComputedStyle(el);
  if (cs.position === "static") el.style.position = "relative";
  if (cs.zIndex === "auto") el.style.zIndex = "1";
  filtreFibre();

  const svg = document.createElementNS(NS, "svg");
  svg.classList.add("dch-bord");
  svg.dataset.cote = cote;
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const g = document.createElementNS(NS, "g");
  const pOmbre = document.createElementNS(NS, "path");
  const pFibre = document.createElementNS(NS, "path");
  const pPapier = document.createElementNS(NS, "path");
  pOmbre.setAttribute("filter", "url(#dch-flou)");
  pOmbre.setAttribute("fill", "rgba(0,0,0,0.32)");
  pFibre.setAttribute("filter", "url(#dch-filtre-fibre)");
  pFibre.setAttribute("fill", "#fbf9f4");
  // L'ombre floutée ne doit pas déborder sur l'élément lui-même : rognée à sa limite.
  const idClip = `dch-clip-${compteur++}`;
  const clip = document.createElementNS(NS, "clipPath");
  clip.id = idClip;
  const rect = document.createElementNS(NS, "rect");
  clip.append(rect);
  pOmbre.setAttribute("clip-path", `url(#${idClip})`);
  g.append(clip);
  if (ombre) g.append(pOmbre);
  if (fibre > 0) g.append(pFibre);
  g.append(pPapier);
  svg.append(g);
  el.prepend(svg);

  let derniere = "";
  const dessiner = () => {
    const horizontal = cote === "haut" || cote === "bas";
    const L = horizontal ? el.offsetWidth : el.offsetHeight;
    if (L <= 0) return;
    const marge = fibre + 4;
    const H = amp + marge + 1;
    const cle = `${L}|${H}`;
    if (cle === derniere) return;
    derniere = cle;
    const n = echantillons(L);
    const pr = profil(n, graine, Math.max(2, L / 170));
    const fib = profil(n, graine ^ 0x5bd1e995, Math.max(4, L / 60), 3);
    // Dans le repère de la bande : y = 0 au bout du papier qui dépasse le plus, y = H contre l'élément.
    const dPapier = profondeurs(pr, amp).map((d) => marge + d);
    const dFibre = dPapier.map((d, i) => d - fibre * (0.35 + 0.65 * (0.5 + 0.5 * fib[i]!)));
    const dOmbre = dPapier.map((d) => d - 2);
    const couleur = el.dataset.dechirureCouleur || getComputedStyle(el).backgroundColor || "#fff";
    pPapier.setAttribute("fill", couleur);
    pPapier.setAttribute("d", cheminBande(dPapier, L, H + 2));
    // Le liseré s'arrête juste sous le papier (qui, lui, mord de 3 px dans l'élément) : déplacée par le filtre,
    // sa base reste cachée, et il n'y a jamais de jour entre les deux.
    pFibre.setAttribute("d", cheminBande(dFibre, L, H - 1));
    pOmbre.setAttribute("d", cheminBande(dOmbre, L, H - 1));
    rect.setAttribute("x", "-20");
    rect.setAttribute("y", "-60");
    rect.setAttribute("width", String(L + 40));
    rect.setAttribute("height", String(H - 1 + 60));
    // Repère de la bande → repère du côté.
    const T: Record<Cote, string> = {
      haut: "",
      bas: `translate(0 ${H}) scale(1 -1)`,
      gauche: `translate(0 ${L}) rotate(-90)`,
      droite: `translate(${H} 0) rotate(90)`,
    };
    g.setAttribute("transform", T[cote]);
    if (horizontal) {
      svg.setAttribute("width", String(L));
      svg.setAttribute("height", String(H));
      svg.setAttribute("viewBox", `0 0 ${L} ${H}`);
      svg.style.height = `${H}px`;
    } else {
      svg.setAttribute("width", String(H));
      svg.setAttribute("height", String(L));
      svg.setAttribute("viewBox", `0 0 ${H} ${L}`);
      svg.style.width = `${H}px`;
    }
  };
  const ro = new ResizeObserver(dessiner);
  ro.observe(el);
  dessiner();
  return () => {
    ro.disconnect();
    svg.remove();
  };
}

/* ---------------------------------------------------------------- 2. coupe */

/**
 * Position d'une image « object-fit » dans sa boîte, depuis `object-position`
 * (mots-clés, % ou px) : décalage en px, `libreX` / `libreY` = place libre
 * (boîte − image, négative quand l'image déborde).
 */
export function positionObjet(v: string | undefined | null, libreX: number, libreY: number): [number, number] {
  const mots = (v || "50% 50%").trim().split(/\s+/);
  const lire = (m: string | undefined, libre: number, axe: "x" | "y"): number => {
    if (!m || m === "center") return libre / 2;
    if (m === "left" || m === "top") return 0;
    if (m === "right" || m === "bottom") return libre;
    if (m.endsWith("%")) return (libre * parseFloat(m)) / 100;
    const n = parseFloat(m);
    return Number.isFinite(n) ? n : axe === "x" ? libre / 2 : libre / 2;
  };
  // « top left » : les mots-clés verticaux d'abord sont permis.
  let [a, b] = mots;
  if (a === "top" || a === "bottom" || ((b === "left" || b === "right") && a === "center")) [a, b] = [b, a];
  return [lire(a, libreX, "x"), lire(b ?? "center", libreY, "y")];
}

export interface ControleCoupe {
  /** Place la déchirure (0…1 de la largeur), sans inertie si `immediat`. */
  placer(f: number, immediat?: boolean): void;
  detruire(): void;
}

function coupe(el: HTMLElement): ControleCoupe | null {
  const enfants = [...el.children].filter((c) => !c.classList.contains("dch-fibre")) as HTMLElement[];
  const [gauche, droite] = enfants;
  if (!gauche || !droite) return null;
  const repos = Math.max(0, Math.min(1, nombre(el.dataset.dechirureCoupe, 0.5)));
  const retour = el.dataset.dechirureRetour !== "0";
  const graine = graineDe(el.dataset.dechirureGraine ?? el.id, 2000 + compteur++);
  const amp = Math.max(2, nombre(el.dataset.dechirureAmplitude, 16));
  const fibre = Math.max(0, nombre(el.dataset.dechirureFibre, 4));
  const ombre = el.dataset.dechirureOmbre !== "0";
  const detoure = el.hasAttribute("data-dechirure-detoure") && el.dataset.dechirureDetoure !== "0";
  filtreFibre();

  // Le volet : l'image de droite, dans un cadre rogné par le bord déchiré, qu'on translate (et l'image à rebours).
  const volet = document.createElement("div");
  volet.className = "dch-volet";
  const dedans = document.createElement("div");
  dedans.className = "dch-dedans";
  droite.replaceWith(volet);
  dedans.append(droite);
  volet.append(dedans);

  const svg = document.createElementNS(NS, "svg");
  svg.classList.add("dch-fibre");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const pOmbre = document.createElementNS(NS, "path");
  const pFibre = document.createElementNS(NS, "path");
  pOmbre.setAttribute("filter", "url(#dch-flou)");
  pOmbre.setAttribute("fill", "rgba(0,0,0,0.28)");
  pFibre.setAttribute("filter", "url(#dch-filtre-fibre)");
  pFibre.setAttribute("fill", "#fbf9f4");
  if (ombre) svg.append(pOmbre);
  if (fibre > 0) svg.append(pFibre);
  el.append(svg);

  // Détouré : le liseré et l'ombre sont masqués par l'alpha de l'image du haut (même masque des deux côtés).
  const imgHaut = (droite instanceof HTMLImageElement ? droite : droite.querySelector("img")) as HTMLImageElement | null;
  let mx = 0, my = 0, masquePret = false;
  const geometrieMasque = () => {
    if (!detoure || !imgHaut || !l || !h) return;
    const src = imgHaut.currentSrc || imgHaut.src;
    const nw = imgHaut.naturalWidth, nh = imgHaut.naturalHeight;
    if (!src || !nw || !nh) return;
    const cs = getComputedStyle(imgHaut);
    let mw = l, mh = h;
    if (cs.objectFit !== "fill") {
      const s = cs.objectFit === "contain" ? Math.min(l / nw, h / nh) : Math.max(l / nw, h / nh);
      mw = nw * s;
      mh = nh * s;
    }
    [mx, my] = positionObjet(cs.objectPosition, l - mw, h - mh);
    const url = `url("${src.replace(/["\\]/g, "\\$&")}")`;
    svg.dataset.detoure = "";
    for (const pre of ["-webkit-", ""]) {
      svg.style.setProperty(`${pre}mask-image`, url);
      svg.style.setProperty(`${pre}mask-size`, `${mw.toFixed(1)}px ${mh.toFixed(1)}px`);
    }
    masquePret = true;
  };
  if (detoure && imgHaut) {
    // Tant que l'image n'est pas là, ni liseré ni ombre (sinon un trait blanc flotterait sur le fond).
    svg.style.visibility = "hidden";
    const pret = () => {
      geometrieMasque();
      if (masquePret) svg.style.visibility = "";
      placerA(x);
    };
    imgHaut.addEventListener("load", pret);
    if (imgHaut.complete) queueMicrotask(pret);
  }

  let l = 0, h = 0, x = 0, cible = 0, raf = 0, dernier = 0, derniere = "";
  const marge = fibre + 10;

  const dessiner = () => {
    l = el.clientWidth;
    h = el.clientHeight;
    if (!l || !h) return;
    const cle = `${l}|${h}`;
    if (cle === derniere) return;
    derniere = cle;
    const n = echantillons(h);
    const pr = profil(n, graine, Math.max(2, h / 240));
    const fib = profil(n, graine ^ 0x27d4eb2f, Math.max(4, h / 50), 3);
    const d = profondeurs(pr, amp); // abscisse du bord dans le volet, 0…amp
    // Le volet couvre [bord, largeur] : polygone en px.
    const pts = d.map((v, i) => `${v.toFixed(1)}px ${((i / (n - 1)) * h).toFixed(1)}px`);
    volet.style.clipPath = `polygon(${pts.join(",")}, ${l + amp}px ${h}px, ${l + amp}px 0px)`;
    volet.style.width = `${l + amp}px`;
    // Le liseré : une bande blanche à gauche du bord, d'épaisseur variable ; l'ombre un peu plus à gauche.
    const W = amp + marge;
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(h));
    svg.setAttribute("viewBox", `0 0 ${W} ${h}`);
    svg.style.width = `${W}px`;
    const colonne = (dx: (v: number, i: number) => number) => {
      let s = "";
      for (let i = 0; i < n; i++) s += `${i ? "L" : "M"}${(marge + dx(d[i]!, i)).toFixed(1)} ${((i / (n - 1)) * h).toFixed(1)}`;
      return s;
    };
    const versBas = colonne((v) => v + 0.6);
    const largeurFibre = (i: number) => fibre * (0.3 + 0.7 * (0.5 + 0.5 * fib[i]!));
    const remonter = (dx: (v: number, i: number) => number) => {
      let s = "";
      for (let i = n - 1; i >= 0; i--) s += `L${(marge + dx(d[i]!, i)).toFixed(1)} ${((i / (n - 1)) * h).toFixed(1)}`;
      return s;
    };
    pFibre.setAttribute("d", versBas + remonter((v, i) => v - largeurFibre(i)) + "Z");
    pOmbre.setAttribute("d", colonne((v) => v) + remonter((v, i) => v - largeurFibre(i) - 5) + "Z");
    geometrieMasque();
    placerA(x);
  };

  const placerA = (px: number) => {
    // Le bord du volet est à `amp/2` en moyenne : on le centre sur px.
    const t = px - amp / 2;
    volet.style.transform = `translate3d(${t.toFixed(2)}px,0,0)`;
    dedans.style.transform = `translate3d(${(-t).toFixed(2)}px,0,0)`;
    svg.style.transform = `translate3d(${(t - marge).toFixed(2)}px,0,0)`;
    if (detoure) {
      // L'image de gauche s'arrête au plus loin du bord : sous la droite, ses franges semi-transparentes
      // (cheveux, franges d'écharpe) transparaîtraient en couleur à travers le noir et blanc.
      gauche.style.clipPath = `inset(0 ${Math.max(0, l - (t + amp)).toFixed(1)}px 0 0)`;
    }
    if (masquePret) {
      const pos = `${(mx - (t - marge)).toFixed(1)}px ${my.toFixed(1)}px`;
      svg.style.setProperty("-webkit-mask-position", pos);
      svg.style.setProperty("mask-position", pos);
    }
  };

  const pas = (tps: number) => {
    const dt = Math.min(0.05, dernier ? (tps - dernier) / 1000 : 0.016);
    dernier = tps;
    x += (cible - x) * (1 - Math.exp(-dt * 9));
    if (Math.abs(cible - x) < 0.25) x = cible;
    placerA(x);
    raf = x === cible ? 0 : requestAnimationFrame(pas);
    if (!raf) dernier = 0;
  };
  const viser = (px: number, immediat = false) => {
    cible = Math.max(-amp, Math.min(l + amp, px));
    if (immediat || reduit()) {
      x = cible;
      placerA(x);
      return;
    }
    if (!raf) raf = requestAnimationFrame(pas);
  };

  const surMouvement = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    viser(e.clientX - r.left);
  };
  const surSortie = () => {
    if (retour) viser(repos * l);
  };
  el.addEventListener("pointermove", surMouvement, { passive: true });
  el.addEventListener("pointerdown", surMouvement, { passive: true });
  el.addEventListener("pointerleave", surSortie, { passive: true });
  el.addEventListener("pointercancel", surSortie, { passive: true });

  const ro = new ResizeObserver(() => {
    const f = l ? x / l : repos;
    derniere = "";
    dessiner();
    x = cible = f * l;
    placerA(x);
  });
  ro.observe(el);
  dessiner();
  x = cible = repos * l;
  placerA(x);

  return {
    placer(f, immediat = false) {
      viser(Math.max(0, Math.min(1, f)) * l, immediat);
    },
    detruire() {
      ro.disconnect();
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", surMouvement);
      el.removeEventListener("pointerdown", surMouvement);
      el.removeEventListener("pointerleave", surSortie);
      el.removeEventListener("pointercancel", surSortie);
      if (detoure) gauche.style.clipPath = "";
    },
  };
}

/* ---------------------------------------------------------------- init */

export interface Dechirures {
  bords: Map<HTMLElement, () => void>;
  coupes: Map<HTMLElement, ControleCoupe>;
}

export function initDechirure(root: ParentNode = document): Dechirures {
  poserCss();
  const out: Dechirures = { bords: new Map(), coupes: new Map() };
  for (const el of root.querySelectorAll<HTMLElement>("[data-dechirure]")) {
    if (el.dataset.dechirurePrete) continue;
    el.dataset.dechirurePrete = "1";
    out.bords.set(el, bord(el));
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-dechirure-coupe]")) {
    if (el.dataset.dechirurePrete) continue;
    el.dataset.dechirurePrete = "1";
    const c = coupe(el);
    if (c) out.coupes.set(el, c);
  }
  return out;
}
