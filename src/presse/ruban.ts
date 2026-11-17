/**
 * Presse — « ruban » : une bande de tableaux dessinée d'un seul tenant par la carte graphique, qui se vrille, se
 * comprime, se bombe, passe sous une lentille ou tourne sur une roue selon la vitesse du défilement. D'après les
 * démonstrations d'Aristide Benoist (cadre maison DOM/WebGPU) ; rien n'en est repris que l'idée.
 *
 *   <div data-ruban="torsade" data-ruban-hauteur="320" aria-label="Douze tableaux">
 *     <img src="…" alt="…" width="1728" height="1150"> <img …> …
 *   </div>
 *
 * Attributs du conteneur :
 *   data-ruban            la figure : torsade (défaut) | accordeon | barillet | lentille | roue ;
 *   data-ruban-hauteur    px : l'épaisseur de la bande (torsade, accordeon, lentille ; défaut 300), la hauteur du
 *                         composant (barillet, roue ; défaut 520 et 460). La boîte du composant en découle ;
 *   data-ruban-joint      px entre deux images (défaut 6 ; 14 pour lentille) ;
 *   data-ruban-rayon      px, coins arrondis des images (défaut 0 ; 18 pour lentille) ;
 *   data-ruban-repos      torsade : torsion au repos, en radians (défaut 0.5 ; 0 = bande à plat), qui respire ;
 *   data-ruban-auto       défilement automatique, en écrans par seconde (ex. 0.4), suspendu au survol, au focus,
 *                         pendant un geste et en mouvement réduit (ignoré par la roue).
 * Les <img> enfants (ou <picture><img></picture> ; 30 au plus) restent dans le DOM : sources des textures, lues par les lecteurs d'écran,
 * focalisables (une seule à la fois dans l'ordre de tabulation, les flèches passent à la voisine). Quand la carte
 * graphique dessine, elles sont masquées visuellement (pas pour l'accessibilité) ; donnez-leur width/height pour que
 * la bande soit juste avant même leur chargement.
 *
 * Mouvement : glisser (souris, doigt), molette horizontale ou Maj + molette (molette verticale pour barillet et roue),
 * flèches ← → (↑ ↓ pour barillet et roue), avec inertie ; la bande boucle sans fin. Clic ou Entrée sur une image :
 * événement `ruban:choix` (detail : { index, src, alt }), et l'image vient au centre. L'image sous le pointeur est
 * trouvée par le calcul inverse de la figure (pas de lecture de pixels).
 *
 * JS : `initRuban(root?)` arme ce qui est là et ce qui arrive ; `ruban(el)` → { aller(index), vitesse(), detruire() }.
 *
 * Choix du rendu : un canvas par composant (dernier enfant, position absolue), un appareil, un module de shader et un
 * pipeline partagés. Pas de tampon de sommets : la bande est un maillage NX × NY engendré dans le nuanceur de sommets
 * à partir de vertex_index (la roue : un quad par instance) ; chaque sommet est placé par la figure (pour la torsade,
 * un point 3D (X, y cos θ(X), y sin θ(X)) projeté en perspective par la composante w, donc des UV corrigées en
 * perspective). Le nuanceur de fragments retrouve l'image d'après l'abscisse le long de la bande (bouclée), lit un
 * texture_2d_array (toutes les images ramenées à la même taille de calque, avec mipmaps) par textureSampleGrad (les
 * gradients viennent de la coordonnée continue : pas de couture de mipmap aux joints), et calcule la couverture des
 * bords, des joints et des coins par une distance signée divisée par sa pente à l'écran (antialiasing analytique).
 * Recto/verso par front_facing ; éclairage par la normale (la bande s'assombrit de chant).
 *
 * Sans WebGPU (ou après trois pertes d'appareil) : une bande CSS à défilement natif avec scroll-snap, images visibles.
 * La boucle d'animation ne tourne que si le composant est visible (IntersectionObserver), l'onglet affiché et que
 * quelque chose bouge (la torsade au repos respire : elle tourne tant qu'elle est visible, sauf en mouvement réduit).
 */
import { getDevice, onDeviceLost } from "../components/device.ts";
import { Ressort, REGLAGES, Vitesse, DECELERATION, projette } from "./gesture.ts";

/* ───────────────────────── Fonctions pures (testées sous Node) ───────────────────────── */

export type Figure = "torsade" | "accordeon" | "barillet" | "lentille" | "roue";
export const FIGURES: readonly Figure[] = ["torsade", "accordeon", "barillet", "lentille", "roue"];
export const figureDe = (v: string | null | undefined): Figure => (FIGURES.includes(v as Figure) ? (v as Figure) : "torsade");
/** Figures dont la bande court verticalement (molette verticale, flèches ↑ ↓). */
export const estVerticale = (f: Figure) => f === "barillet" || f === "roue";
export const MAX_IMAGES = 30;

/** Ramène x dans [0, L). */
export function boucler(x: number, L: number) {
  if (!(L > 0)) return 0;
  const r = x % L;
  return r < 0 ? r + L : r === L ? 0 : r;
}

/** La bande : début et longueur de chaque image (unité : l'épaisseur de la bande), le joint, la longueur totale. */
export type Disposition = { debuts: number[]; longueurs: number[]; joint: number; total: number };
export function disposer(longueurs: readonly number[], joint: number): Disposition {
  const debuts: number[] = [];
  let x = 0;
  for (const l of longueurs) {
    debuts.push(x);
    x += l + joint;
  }
  return { debuts, longueurs: [...longueurs], joint, total: x };
}

/** L'image à l'abscisse b (bouclée) : son index et l'abscisse locale ; null dans un joint ou sur une bande vide. */
export function indexEnB(b: number, d: Disposition): { index: number; local: number } | null {
  if (!d.longueurs.length || !(d.total > 0)) return null;
  const bb = boucler(b, d.total);
  for (let i = d.longueurs.length - 1; i >= 0; i--) {
    if (bb >= d.debuts[i]!) {
      const local = bb - d.debuts[i]!;
      return local < d.longueurs[i]! ? { index: i, local } : null;
    }
  }
  return null;
}

/** L'image la plus proche de l'abscisse b (joints compris : on prend la plus proche des deux voisines). */
export function indexProche(b: number, d: Disposition) {
  const n = d.longueurs.length;
  if (!n) return -1;
  const bb = boucler(b, d.total);
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const c = d.debuts[i]! + d.longueurs[i]! / 2;
    const dd = Math.abs(boucler(bb - c + d.total / 2, d.total) - d.total / 2);
    if (dd < bestD) ((bestD = dd), (best = i));
  }
  return best;
}

/** Le défilement qui centre l'image i, choisi parmi ses copies (bande bouclée) au plus près de s. */
export function cibleProche(s: number, i: number, d: Disposition) {
  const c = d.debuts[i]! + d.longueurs[i]! / 2;
  return c + Math.round((s - c) / d.total) * d.total;
}

/** La torsion de la bande à l'abscisse d'écran X (unités d'épaisseur, 0 au centre) : θ = amp · sin(κX − φ). */
export function torsion(X: number, amp: number, kappa: number, phi: number) {
  return amp * Math.sin(kappa * X - phi);
}
/** De la vitesse (unités/s) à l'intensité de la figure, 0 au repos, → 1 en défilement rapide. */
export function intensite(v: number, v0 = 1.6) {
  return 1 - Math.exp(-Math.abs(v) / v0);
}
export const AMP_MAX = 2.7;
/**
 * Les paramètres de la torsade pour une intensité e (0–1) au temps t (s). Au repos, une torsion douce (repos, rad)
 * qui respire ; en défilement, l'amplitude passe au-delà de π/2 (la bande se pince de chant et montre son verso) et
 * l'onde se resserre. Mouvement réduit : à plat.
 */
export function torsadeDe(e: number, repos: number, t: number, reduit = false) {
  if (reduit) return { amp: 0, kappa: 0.9 };
  const respire = repos * (0.78 + 0.22 * Math.sin(t * 0.9));
  return { amp: respire + (AMP_MAX - respire) * e, kappa: 0.95 + 0.4 * e };
}
/** θ(x, vitesse, temps) : la torsion à l'abscisse X pour une vitesse et un temps donnés (phase φ en sus). */
export function theta(X: number, vitesse: number, t: number, phi = 0, repos = 0.5, reduit = false) {
  const p = torsadeDe(intensite(vitesse), repos, t, reduit);
  return torsion(X, p.amp, p.kappa, phi);
}
/**
 * La phase avance d'elle-même (la respiration) et avec le défilement, mais moins vite que la bande : la torsion
 * « voyage » le long des images au lieu d'y être collée.
 */
export function avancerPhase(phi: number, v: number, kappa: number, dt: number) {
  return phi + dt * (0.32 + 0.45 * kappa * v);
}

/** L'inertie d'un lancer, en forme exacte (décélération d'iOS, par ms) : [s, v] après dt secondes. */
export function inertie(s: number, v: number, dt: number, rate: number = DECELERATION.normale): [number, number] {
  if (v === 0 || dt <= 0) return [s, v];
  const ms = dt * 1000;
  const f = Math.pow(rate, ms);
  const ns = s + (v * (f - 1)) / (1000 * Math.log(rate));
  const nv = v * f;
  return [ns, Math.abs(nv) < 0.01 ? 0 : nv];
}
/** Lissage exponentiel d'une vitesse mesurée (τ en s). */
export function lisserVitesse(vs: number, mesure: number, dt: number, tau = 0.07) {
  if (dt <= 0) return vs;
  return vs + (mesure - vs) * (1 - Math.exp(-dt / tau));
}
/** Approche d'une cible, vite en montée, plus doucement en descente (taux en 1/s). */
export function approcher(x: number, cible: number, dt: number, montee = 9, descente = 2.4) {
  const k = cible > x ? montee : descente;
  return cible + (x - cible) * Math.exp(-k * dt);
}

/** Ce qu'il faut pour placer la bande à l'écran (px CSS). */
export type Vue = {
  fig: Figure;
  W: number;
  H: number;
  /** Épaisseur de la bande, px CSS. */
  h: number;
  s: number;
  amp: number;
  kappa: number;
  phi: number;
  persp: number;
  sW: number;
  sH: number;
  bombe: number;
  beta: number;
};
export const PERSP = 3.6;

/** Les paramètres de chaque figure pour l'intensité e (les mêmes que ceux envoyés au shader). */
export function parametres(fig: Figure, e: number, t: number, repos: number, reduit: boolean) {
  const tor = torsadeDe(fig === "torsade" ? e : 0, fig === "torsade" ? repos : 0, t, reduit || fig !== "torsade");
  const sH = 1 - 0.68 * e;
  return {
    amp: tor.amp,
    kappa: tor.kappa,
    sW: fig === "accordeon" ? sH * (1 - 0.32 * e) : 1,
    sH: fig === "accordeon" ? sH : 1,
    bombe: fig === "accordeon" ? 0.45 * e * (1 - e) : 0,
    beta: fig === "barillet" ? 0.17 * e : 0,
  };
}

/** Un point de la bande (X le long, unités, 0 au centre de l'écran ; y en travers, −0,5…0,5) vers l'écran (px CSS). */
export function projeter(X: number, y: number, v: Vue): [number, number] {
  const cx = v.W / 2;
  const cy = v.H / 2;
  switch (v.fig) {
    case "torsade": {
      const th = torsion(X, v.amp, v.kappa, v.phi);
      const D = v.persp * v.h;
      const k = D / (D - y * Math.sin(th) * v.h);
      return [cx + X * v.h * k, cy + y * Math.cos(th) * v.h * k];
    }
    case "accordeon": {
      const xs = cx + X * v.h * v.sW;
      const xn = Math.max(-1, Math.min(1, (xs - cx) / cx));
      return [xs, cy + y * v.h * v.sH * (1 + v.bombe * (1 - xn * xn))];
    }
    case "barillet": {
      const ys = cy + X * v.h;
      const yn = Math.max(-1, Math.min(1, (ys - cy) / cy));
      return [cx + y * v.h * (1 + v.beta * (1 - yn * yn)), ys];
    }
    default:
      return [cx + X * v.h, cy + y * v.h];
  }
}

/** Le calcul inverse : un point de l'écran (px CSS, relatif au composant) vers la bande ({ b, v }), ou null. */
export function ecranVersBande(xs: number, ys: number, v: Vue): { b: number; v: number } | null {
  const cx = v.W / 2;
  const cy = v.H / 2;
  let X = 0;
  let y = 0;
  switch (v.fig) {
    case "torsade": {
      // Pour un X donné, l'ordonnée y qui tombe sur ys se calcule exactement ; reste à trouver X tel que l'abscisse
      // projetée tombe sur xs. Résidu à une variable : balayage des changements de signe puis dichotomie. Là où le
      // ruban se replie sur lui-même (près d'un pincement), plusieurs X conviennent : on garde le plus proche de l'œil.
      const D = v.persp * v.h;
      const dy = ys - cy;
      const yDe = (Xc: number) => {
        const th = torsion(Xc, v.amp, v.kappa, v.phi);
        const c = Math.cos(th);
        const sn = Math.sin(th);
        const den = v.h * (c * D + dy * sn);
        if (Math.abs(den) < 1e-9) return null;
        const yy = (dy * D) / den;
        const k = D / (D - yy * sn * v.h);
        return k > 0 ? { y: yy, k, z: yy * sn } : null;
      };
      const res = (Xc: number) => {
        const r = yDe(Xc);
        return r ? cx + Xc * v.h * r.k - xs : NaN;
      };
      // Le facteur de perspective k reste entre D/(D + h/2) et D/(D − h/2) : X = X0 / k est dans cet intervalle.
      const X0 = (xs - cx) / v.h;
      const N = 64;
      const kMin = D / (D + v.h / 2);
      const kMax = D / (D - v.h / 2);
      const lo = Math.min(X0 / kMin, X0 / kMax) - 0.05;
      const hi = Math.max(X0 / kMin, X0 / kMax) + 0.05;
      let best: { X: number; y: number; z: number } | null = null;
      let xa = lo;
      let ra = res(xa);
      for (let i = 1; i <= N; i++) {
        const xb = lo + ((hi - lo) * i) / N;
        const rb = res(xb);
        if (Number.isFinite(ra) && Number.isFinite(rb) && (ra === 0 || ra * rb < 0)) {
          let p = xa;
          let q = xb;
          let rp = ra;
          for (let it = 0; it < 50; it++) {
            const m = (p + q) / 2;
            const rm = res(m);
            if (!Number.isFinite(rm)) break;
            if (rp * rm <= 0) q = m;
            else ((p = m), (rp = rm));
          }
          const Xs = (p + q) / 2;
          const r = yDe(Xs);
          if (r && Math.abs(r.y) <= 0.5 && (!best || r.z > best.z)) best = { X: Xs, y: r.y, z: r.z };
        }
        xa = xb;
        ra = rb;
      }
      if (!best) return null;
      X = best.X;
      y = best.y;
      break;
    }
    case "accordeon": {
      X = (xs - cx) / (v.h * v.sW);
      const xn = Math.max(-1, Math.min(1, (xs - cx) / cx));
      y = (ys - cy) / (v.h * v.sH * (1 + v.bombe * (1 - xn * xn)));
      break;
    }
    case "barillet": {
      X = (ys - cy) / v.h;
      const yn = Math.max(-1, Math.min(1, (ys - cy) / cy));
      y = (xs - cx) / (v.h * (1 + v.beta * (1 - yn * yn)));
      break;
    }
    default:
      X = (xs - cx) / v.h;
      y = (ys - cy) / v.h;
  }
  if (Math.abs(y) > 0.5) return null;
  return { b: v.s + X, v: y + 0.5 };
}

/** L'image sous un point de l'écran (−1 si aucune) : calcul inverse, puis recherche le long de la bande. */
export function indexSous(xs: number, ys: number, v: Vue, d: Disposition) {
  const p = ecranVersBande(xs, ys, v);
  if (!p) return -1;
  return indexEnB(p.b, d)?.index ?? -1;
}

/* ── La roue ── */
export type RoueGeo = { th: number; Rw: number; dphi: number; colX: number; boite: [number, number, number, number] };
/** La géométrie de la roue pour un composant W × H (px CSS). */
export function roueGeo(W: number, H: number): RoueGeo {
  const th = Math.max(22, Math.min(56, H * 0.06));
  const Rw = H * 0.95;
  const colX = Math.max(th * 2.2, Math.min(W * 0.14, 150));
  const x0 = Math.max(colX + th * 2.4, W * 0.3);
  return { th, Rw, dphi: (th * 1.32) / Rw, colX, boite: [x0, H * 0.08, W - Math.max(16, W * 0.04), H * 0.92] };
}
/** Décalage de la vignette i par rapport à la position pos, ramené dans [−n/2, n/2]. */
export function ecartRoue(i: number, pos: number, n: number) {
  const d = i - pos;
  return d - Math.round(d / n) * n;
}
/** La vignette i : centre, taille, rotation, opacité (le même calcul que le shader). */
export function vignetteRoue(i: number, pos: number, n: number, aspect: number, g: RoueGeo, H: number) {
  const d = ecartRoue(i, pos, n);
  const phi = d * g.dphi;
  const k = 1 + 0.38 * Math.exp(-d * d * 2.5);
  const h = g.th * k;
  return {
    x: g.colX - g.Rw + g.Rw * Math.cos(phi),
    y: H / 2 + g.Rw * Math.sin(phi),
    w: h * aspect,
    h,
    rot: phi * 0.55,
    // Fondu au bord de l'arc, et à la couture de la roue (là où une vignette passe d'un bout à l'autre).
    alpha: Math.max(0, Math.min(1, (1.25 - Math.abs(phi)) / 0.22)) * Math.max(0, Math.min(1, n / 2 - Math.abs(d) - 0.5)),
  };
}
/** La grande image (contain dans la boîte) : x0, y0, x1, y1. */
export function grandeRoue(aspect: number, g: RoueGeo): [number, number, number, number] {
  const [x0, y0, x1, y1] = g.boite;
  const bw = x1 - x0;
  const bh = y1 - y0;
  let w = bw;
  let h = bw / aspect;
  if (h > bh) ((h = bh), (w = bh * aspect));
  const cx = x0 + bw / 2;
  const cy = y0 + bh / 2;
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
}
/** Ce qu'il y a sous un point de la roue : l'index d'une vignette, l'image courante (grande), ou −1. */
export function indexSousRoue(xs: number, ys: number, pos: number, courant: number, aspects: readonly number[], W: number, H: number) {
  const n = aspects.length;
  if (!n) return -1;
  const g = roueGeo(W, H);
  const [gx0, gy0, gx1, gy1] = grandeRoue(aspects[courant] ?? 1, g);
  if (xs >= gx0 && xs <= gx1 && ys >= gy0 && ys <= gy1) return courant;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const t = vignetteRoue(i, pos, n, aspects[i]!, g, H);
    if (t.alpha < 0.2) continue;
    const c = Math.cos(-t.rot);
    const s = Math.sin(-t.rot);
    const lx = (xs - t.x) * c - (ys - t.y) * s;
    const ly = (xs - t.x) * s + (ys - t.y) * c;
    if (Math.abs(lx) <= t.w / 2 + 2 && Math.abs(ly) <= t.h / 2 + 2) {
      const dd = Math.hypot(lx, ly);
      if (dd < bestD) ((bestD = dd), (best = i));
    }
  }
  return best;
}

/* ───────────────────────── CSS ───────────────────────── */

const CSS = `
[data-ruban] { position: relative; display: block; box-sizing: border-box; height: var(--ruban-boite, 480px); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
[data-ruban] img { -webkit-user-drag: none; }
[data-ruban] img:focus { outline: none; }
.ruban-canvas { position: absolute !important; inset: 0; width: 100%; height: 100%; display: block; margin: 0; padding: 0; border: 0; pointer-events: none; }
.ruban-gpu { overflow: hidden; cursor: grab; touch-action: pan-y; }
.ruban-gpu.ruban-vertical { touch-action: pan-x; }
.ruban-gpu.ruban-tenu { cursor: grabbing; }
.ruban-gpu > img, .ruban-gpu > picture, .ruban-gpu > picture > img { position: absolute !important; left: 0; top: 0; width: 1px !important; height: 1px !important; margin: 0 !important; padding: 0 !important; border: 0 !important; opacity: 0; overflow: hidden; clip-path: inset(50%); pointer-events: none; }
.ruban-repli { display: flex; align-items: center; gap: var(--ruban-joint, 6px); overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scroll-padding-inline: 16px; padding-inline: 16px; overscroll-behavior-x: contain; scrollbar-width: thin; }
.ruban-repli > picture { display: contents; }
.ruban-repli > img, .ruban-repli > picture > img { flex: none; display: block; height: var(--ruban-h, 300px); width: auto; max-width: none; object-fit: cover; scroll-snap-align: center; border-radius: var(--ruban-rayon, 0px); background: rgba(127,127,127,.18); }
.ruban-repli.ruban-vertical { flex-direction: column; align-items: stretch; overflow-x: hidden; overflow-y: auto; scroll-snap-type: y mandatory; padding: 0; scroll-padding-block: 16px; overscroll-behavior-y: contain; }
.ruban-repli.ruban-vertical > img, .ruban-repli.ruban-vertical > picture > img { width: 100%; height: auto; }
.ruban-repli img:focus-visible { outline: 3px solid var(--ruban-accent, #d9472b); outline-offset: -3px; }
`;
let cssPose = false;
function poserCss() {
  if (cssPose) return;
  cssPose = true;
  const st = document.createElement("style");
  st.dataset.presseRuban = "";
  st.textContent = CSS;
  document.head.append(st);
}

/* ───────────────────────── Shader ───────────────────────── */

const WGSL = /* wgsl */ `
struct U {
  res: vec4f,     // largeur, hauteur (px appareil), figure (0 torsade, 1 accordéon, 2 barillet, 3 lentille, 4 roue), nombre d'images
  bande: vec4f,   // épaisseur h (px appareil), étendue du maillage (unités), défilement s, longueur totale L
  geo: vec4f,     // torsade : amp, κ, φ, perspective | accordéon : sW, sH, bombé | barillet : β
  lens: vec4f,    // lentille : centre x, y (px appareil), rayon, force
  style: vec4f,   // joint (unités), rayon des coins (unités), image focalisée (−1 : aucune), éclat du verso
  accent: vec4f,  // couleur du filet de focus, dpr
  grille: vec4f,  // NX, NY, marge du maillage en travers (unités), bande verticale (0 / 1)
  roue: vec4f,    // position, image courante, précédente, fondu (0–1)
  roue2: vec4f,   // hauteur d'une vignette, rayon de l'arc, pas angulaire, abscisse du sommet de l'arc (px appareil)
  roue3: vec4f,   // boîte de la grande image : x0, y0, x1, y1 (px appareil)
  im: array<vec4f, 30>, // début, longueur (unités), rapport largeur/hauteur, chargée (0 / 1)
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d_array<f32>;

struct VO {
  @builtin(position) pos: vec4f,
  @location(0) b: f32,     // abscisse le long de la bande (unités), ou abscisse locale (roue)
  @location(1) v: f32,     // en travers, 0–1
  @location(2) lum: f32,   // cos θ : la bande de face (1) ou de chant (0)
  @location(3) @interpolate(flat) info: vec4f, // mode (0 bande, 1 image donnée), calque, opacité, longueur
};

fn versClip(p: vec2f, w: f32) -> vec4f {
  let n = vec2f(p.x / u.res.x * 2.0 - 1.0, 1.0 - p.y / u.res.y * 2.0);
  return vec4f(n * w, 0.0, w);
}
fn tourne(p: vec2f, a: f32) -> vec2f {
  let c = cos(a);
  let s = sin(a);
  return vec2f(p.x * c - p.y * s, p.x * s + p.y * c);
}

fn sommetRoue(ii: u32, c: vec2f) -> VO {
  var o: VO;
  let n = u32(u.res.w);
  let H = u.res.y;
  let dpr = u.accent.w;
  // Le quad déborde d'1,5 px : l'antialiasing des bords se fait dans le fragment.
  if (ii < n) {
    let a = u.im[ii].z;
    let fn_ = f32(n);
    var d = f32(ii) - u.roue.x;
    d = d - round(d / fn_) * fn_;
    let phi = d * u.roue2.z;
    let h = u.roue2.x * (1.0 + 0.38 * exp(-d * d * 2.5));
    let w = h * a;
    let e = vec2f(1.5 * dpr / w, 1.5 * dpr / h);
    let cc = -e + c * (1.0 + 2.0 * e);
    let centre = vec2f(u.roue2.w - u.roue2.y + u.roue2.y * cos(phi), H * 0.5 + u.roue2.y * sin(phi));
    let p = centre + tourne((cc - vec2f(0.5)) * vec2f(w, h), phi * 0.55);
    o.pos = versClip(p, 1.0);
    o.b = cc.x * a;
    o.v = cc.y;
    o.lum = 1.0;
    o.info = vec4f(1.0, f32(ii), clamp((1.25 - abs(phi)) / 0.22, 0.0, 1.0) * clamp(fn_ * 0.5 - abs(d) - 0.5, 0.0, 1.0), a);
    return o;
  }
  // Les deux grandes images : la précédente pleine, la courante par-dessus avec le fondu.
  let k = ii - n;
  let idx = select(u32(u.roue.y), u32(u.roue.z), k == 0u);
  let alpha = select(u.roue.w, 1.0, k == 0u);
  let a = u.im[idx].z;
  let bx = u.roue3;
  let bw = bx.z - bx.x;
  let bh = bx.w - bx.y;
  var w = bw;
  var h = bw / a;
  if (h > bh) { h = bh; w = bh * a; }
  let e = vec2f(1.5 * dpr / w, 1.5 * dpr / h);
  let cc = -e + c * (1.0 + 2.0 * e);
  let p = vec2f(bx.x + bw * 0.5, bx.y + bh * 0.5) + (cc - vec2f(0.5)) * vec2f(w, h);
  o.pos = versClip(p, 1.0);
  o.b = cc.x * a;
  o.v = cc.y;
  o.lum = 1.0;
  o.info = vec4f(1.0, f32(idx), alpha, a);
  return o;
}

@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var cxs = array<f32, 6>(0.0, 1.0, 0.0, 0.0, 1.0, 1.0);
  var cys = array<f32, 6>(0.0, 0.0, 1.0, 1.0, 0.0, 1.0);
  let q = vi / 6u;
  let k = vi % 6u;
  let c = vec2f(cxs[k], cys[k]);
  let fig = u32(u.res.z);
  if (fig == 4u) { return sommetRoue(ii, c); }
  let W = u.res.x;
  let H = u.res.y;
  let nx = u32(u.grille.x);
  let ny = u32(u.grille.y);
  let col = f32(q % nx) + c.x;
  let row = f32(q / nx) + c.y;
  let m = u.grille.z;
  let X = (col / f32(nx) - 0.5) * u.bande.y;
  let y = mix(-0.5 - m, 0.5 + m, row / f32(ny));
  let h = u.bande.x;
  var p = vec2f(W * 0.5 + X * h, H * 0.5 + y * h);
  var w = 1.0;
  var lum = 1.0;
  if (fig == 0u) {
    // Le ruban : l'ordonnée locale tourne de θ(X) autour de l'axe de la bande ; perspective par w.
    let th = u.geo.x * sin(u.geo.y * X - u.geo.z);
    let D = u.geo.w * h;
    let kk = D / (D - y * sin(th) * h);
    p = vec2f(W * 0.5 + X * h * kk, H * 0.5 + y * cos(th) * h * kk);
    w = 1.0 / kk;
    lum = cos(th);
  } else if (fig == 1u) {
    let xs = W * 0.5 + X * h * u.geo.x;
    let xn = clamp((xs - W * 0.5) / (W * 0.5), -1.0, 1.0);
    p = vec2f(xs, H * 0.5 + y * h * u.geo.y * (1.0 + u.geo.z * (1.0 - xn * xn)));
  } else if (fig == 2u) {
    let ys = H * 0.5 + X * h;
    let yn = clamp((ys - H * 0.5) / (H * 0.5), -1.0, 1.0);
    p = vec2f(W * 0.5 + y * h * (1.0 + u.geo.x * (1.0 - yn * yn)), ys);
  }
  var o: VO;
  o.pos = versClip(p, w);
  o.b = u.bande.z + X;
  o.v = y + 0.5;
  o.lum = lum;
  o.info = vec4f(0.0, 0.0, 1.0, 0.0);
  return o;
}

fn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}
// La normale de la distance au rectangle arrondi (pour sa pente à l'écran, sans dérivée d'une valeur discontinue).
fn ndrb(p: vec2f, b: vec2f, r: f32) -> vec2f {
  let q = abs(p) - b + vec2f(r);
  let sg = select(vec2f(-1.0), vec2f(1.0), p >= vec2f(0.0));
  if (max(q.x, q.y) > 0.0) { return normalize(max(q, vec2f(1e-6))) * sg; }
  if (q.x > q.y) { return vec2f(sg.x, 0.0); }
  return vec2f(0.0, sg.y);
}

@fragment fn fs(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let fig = u32(u.res.z);
  let h = u.bande.x;
  var b = i.b;
  var v = i.v;
  var dch = vec2f(0.0); // décalage chromatique de la lentille (unités de bande, pour le rouge ; opposé pour le bleu)
  var lensRim = 0.0;
  if (fig == 3u) {
    // La lentille : une bosse convexe ; chaque pixel lit plus près du centre (grossissement), le rouge et le bleu
    // un peu plus et un peu moins (frange colorée vers le bord).
    let p = i.pos.xy;
    let c = u.lens.xy;
    let R = u.lens.z;
    let dq = (p - c) / vec2f(R * 0.78, R);
    // Bords « en accolade » : la lentille s'effile en pointe à mi-hauteur.
    let ay = abs(dq.y);
    let r = length(vec2f(dq.x * (0.82 + 0.3 * ay), dq.y));
    let t = max(0.0, 1.0 - r * r);
    let f = u.lens.w * t * t;
    let pp = c + (p - c) * (1.0 - f);
    let pr = c + (p - c) * (1.0 - f * 1.09);
    b = u.bande.z + (pp.x - u.res.x * 0.5) / h;
    v = (pp.y - u.res.y * 0.5) / h + 0.5;
    dch = (pr - pp) / h;
    lensRim = smoothstep(0.55, 0.95, r) * (1.0 - smoothstep(0.95, 1.02, r)) * step(0.001, u.lens.w);
  }
  let gbx = dpdx(b);
  let gby = dpdy(b);
  let gvx = dpdx(v);
  let gvy = dpdy(v);

  var idx = -1;
  var la = 0.0;
  var len = 1.0;
  var alpha = 1.0;
  if (i.info.x > 0.5) {
    idx = i32(i.info.y);
    len = i.info.w;
    la = b;
    alpha = i.info.z;
  } else {
    let L = u.bande.w;
    let j = u.style.x;
    let bb = b - floor(b / L) * L;
    let n = i32(u.res.w);
    for (var k = 0; k < n; k++) {
      let d = u.im[k];
      if (bb >= d.x && bb < d.x + d.y + j) { idx = k; la = bb - d.x; len = d.y; }
    }
  }
  if (idx < 0) { return vec4f(0.0); }

  // Couverture : distance signée au rectangle (arrondi) de l'image, divisée par sa pente à l'écran.
  let half = vec2f(len * 0.5, 0.5);
  let pl = vec2f(la - half.x, v - 0.5);
  let rr = min(u.style.y, min(half.x, half.y));
  let dist = sdrb(pl, half, rr);
  let nn = ndrb(pl, half, rr);
  let g = vec2f(nn.x * gbx + nn.y * gvx, nn.x * gby + nn.y * gvy);
  let gl = max(length(g), 1e-6);
  let dpx = dist / gl; // en px appareil, négatif dedans
  let cov = clamp(0.5 - dpx, 0.0, 1.0);
  if (cov <= 0.0) { return vec4f(0.0); }

  let vert = u.grille.w > 0.5;
  let lu = clamp(la / len, 0.0, 1.0);
  let lv = clamp(v, 0.0, 1.0);
  let uv = select(vec2f(lu, lv), vec2f(lv, lu), vert);
  let ddx = select(vec2f(gbx / len, gvx), vec2f(gvx, gbx / len), vert);
  let ddy = select(vec2f(gby / len, gvy), vec2f(gvy, gby / len), vert);
  var col = textureSampleGrad(tex, samp, uv, idx, ddx, ddy).rgb;
  if (fig == 3u) {
    let du = vec2f(dch.x / len, dch.y);
    let cr = textureSampleGrad(tex, samp, clamp(uv + du, vec2f(0.0), vec2f(1.0)), idx, ddx, ddy).r;
    let cb = textureSampleGrad(tex, samp, clamp(uv - du, vec2f(0.0), vec2f(1.0)), idx, ddx, ddy).b;
    col = vec3f(cr, col.g, cb);
    col = col + vec3f(0.05) * lensRim;
  }
  if (u.im[idx].w < 0.5) {
    // Pas encore chargée : un aplat neutre.
    col = vec3f(0.42, 0.41, 0.39);
  }

  if (fig == 0u) {
    // La lumière vient de face : la bande s'assombrit de chant, un reflet glisse quand elle tourne.
    let face = abs(i.lum);
    var lit = 0.16 + 0.84 * pow(face, 0.75);
    if (!ff) { lit = lit * u.style.w; }
    let sheen = smoothstep(0.86, 0.97, face) * (1.0 - smoothstep(0.97, 1.0, face)) * 0.10;
    col = col * lit + vec3f(sheen);
  }

  // Le filet de focus (clavier) sur l'image focalisée.
  if (f32(idx) == u.style.z) {
    let dpr = u.accent.w;
    let ring = clamp(dpx + 4.5 * dpr, 0.0, 1.0) * clamp(-dpx - 1.0 * dpr, 0.0, 1.0);
    col = mix(col, u.accent.rgb, ring);
  }
  let a = cov * alpha;
  return vec4f(col * a, a);
}
`;

const MIP_WGSL = /* wgsl */ `
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var src: texture_2d<f32>;
struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let x = f32((i << 1u) & 2u);
  let y = f32(i & 2u);
  var o: VO;
  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  o.uv = vec2f(x, y);
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4f { return textureSampleLevel(src, samp, i.uv, 0.0); }
`;

/* ───────────────────────── GPU partagé ───────────────────────── */

type Partage = {
  device: GPUDevice;
  layout: GPUBindGroupLayout;
  mod: GPUShaderModule;
  pipes: Map<GPUTextureFormat, GPURenderPipeline>;
  samp: GPUSampler;
  mipPipe: GPURenderPipeline;
};
let partage: Partage | null = null;
function partageDe(device: GPUDevice): Partage {
  if (partage && partage.device === device) return partage;
  const mod = device.createShaderModule({ code: WGSL, label: "presse-ruban" });
  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d-array" } },
    ],
  });
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", maxAnisotropy: 8, addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  const mipMod = device.createShaderModule({ code: MIP_WGSL, label: "presse-ruban-mip" });
  const mipPipe = device.createRenderPipeline({
    label: "presse-ruban-mip",
    layout: "auto",
    vertex: { module: mipMod, entryPoint: "vs" },
    fragment: { module: mipMod, entryPoint: "fs", targets: [{ format: "rgba8unorm" }] },
    primitive: { topology: "triangle-list" },
  });
  partage = { device, layout, mod, pipes: new Map(), samp, mipPipe };
  return partage;
}
function pipeDe(s: Partage, format: GPUTextureFormat) {
  let p = s.pipes.get(format);
  if (!p) {
    const blend: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } };
    p = s.device.createRenderPipeline({
      label: `presse-ruban-${format}`,
      layout: s.device.createPipelineLayout({ bindGroupLayouts: [s.layout] }),
      vertex: { module: s.mod, entryPoint: "vs" },
      fragment: { module: s.mod, entryPoint: "fs", targets: [{ format, blend }] },
      // Le recto est le sens horaire à l'écran (le maillage va de gauche à droite, de haut en bas).
      primitive: { topology: "triangle-list", cullMode: "none", frontFace: "cw" },
    });
    s.pipes.set(format, p);
  }
  return p;
}

/** Mode banc d'essai (`globalThis.__presseBanc = true` ou `?presse-banc`) : pas de contexte WebGPU à l'écran ; `capturerRuban(el)` dessine hors écran. */
export const modeBanc = () => typeof globalThis !== "undefined" && (!!(globalThis as { __presseBanc?: boolean }).__presseBanc || (typeof location !== "undefined" && /[?&]presse-banc\b/.test(location.search)));

const UVEC = 10;
const UFLOATS = (UVEC + MAX_IMAGES) * 4;
const FIG_INDEX: Record<Figure, number> = { torsade: 0, accordeon: 1, barillet: 2, lentille: 3, roue: 4 };
/** Maillage par figure : colonnes le long de la bande, rangées en travers. */
const MAILLAGE: Record<Figure, [number, number]> = { torsade: [240, 2], accordeon: [96, 8], barillet: [120, 2], lentille: [8, 2], roue: [1, 1] };

type Gpu = {
  s: Partage;
  ctx: GPUCanvasContext | null;
  format: GPUTextureFormat;
  ubuf: GPUBuffer;
  tex: GPUTexture;
  bind: GPUBindGroup;
  data: Float32Array;
  Tw: number;
  Th: number;
  levels: number;
  charge: boolean[];
  pret: Promise<void>;
};

/** Lit une texture rgba8unorm (prémultipliée) et la rend en PNG (data URL), posée sur `fond` si donné. */
async function textureEnPng(device: GPUDevice, tex: GPUTexture, w: number, h: number, fond?: string): Promise<string> {
  const bpr = Math.ceil((w * 4) / 256) * 256;
  const buf = device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const enc = device.createCommandEncoder();
  enc.copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: bpr }, [w, h]);
  device.queue.submit([enc.finish()]);
  await buf.mapAsync(GPUMapMode.READ);
  const src = new Uint8Array(buf.getMappedRange());
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * bpr + x * 4;
      const o = (y * w + x) * 4;
      const a = src[i + 3]!;
      img.data[o] = a ? Math.min(255, (src[i]! * 255) / a) : 0;
      img.data[o + 1] = a ? Math.min(255, (src[i + 1]! * 255) / a) : 0;
      img.data[o + 2] = a ? Math.min(255, (src[i + 2]! * 255) / a) : 0;
      img.data[o + 3] = a;
    }
  buf.unmap();
  buf.destroy();
  const t = document.createElement("canvas");
  t.width = w;
  t.height = h;
  t.getContext("2d")!.putImageData(img, 0, 0);
  if (!fond) return t.toDataURL("image/png");
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = fond;
  g.fillRect(0, 0, w, h);
  g.drawImage(t, 0, 0);
  return c.toDataURL("image/png");
}

/** Une couleur CSS quelconque en [r, g, b] (0–1). */
let c2d: CanvasRenderingContext2D | null = null;
function rgb(css: string, repli: [number, number, number]): [number, number, number] {
  try {
    c2d ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
    if (!c2d || !css) return repli;
    c2d.clearRect(0, 0, 1, 1);
    c2d.fillStyle = "#000";
    c2d.fillStyle = css;
    c2d.fillRect(0, 0, 1, 1);
    const d = c2d.getImageData(0, 0, 1, 1).data;
    return [d[0]! / 255, d[1]! / 255, d[2]! / 255];
  } catch {
    return repli;
  }
}

/* ───────────────────────── Un ruban ───────────────────────── */

const reduitQ = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const num = (s: string | null | undefined, d: number) => {
  const n = Number.parseFloat(s ?? "");
  return Number.isFinite(n) ? n : d;
};

export type RubanApi = {
  /** Amène l'image `index` au centre (ressort ; posée d'un coup en mouvement réduit). */
  aller(index: number): void;
  /** La vitesse ressentie (unités d'épaisseur de bande par seconde ; images par seconde pour la roue). */
  vitesse(): number;
  detruire(): void;
};

const instances = new Map<HTMLElement, Ruban>();
let fige = false;
let pertes = 0;
let io: IntersectionObserver | null = null;

class Ruban {
  readonly el: HTMLElement;
  fig: Figure = "torsade";
  imgs: HTMLImageElement[] = [];
  aspects: number[] = [];
  disp: Disposition = disposer([], 0);
  hauteur = 300;
  joint = 6;
  rayon = 0;
  repos = 0.5;
  auto = 0;
  accent: [number, number, number] = [0.85, 0.28, 0.17];
  W = 0;
  H = 0;
  h = 300;
  dpr = 1;
  /* Mouvement */
  s = 0;
  v = 0;
  vs = 0;
  sPrev = 0;
  e = 0;
  phi = 0;
  temps = 0;
  mode: "libre" | "tenu" | "ressort" = "libre";
  ressort = new Ressort(0, REGLAGES.doux);
  vit = new Vitesse();
  drag: { id: number; x0: number; y0: number; s0: number; bouge: boolean } | null = null;
  survol = false;
  focus = false;
  focusIdx = -1;
  reduit = reduitQ();
  /* Lentille */
  lensX = 0;
  lensSuit = false;
  lensRessort = new Ressort(0, REGLAGES.place);
  /* Roue */
  pos = new Ressort(0, REGLAGES.lacher);
  courant = 0;
  precedent = 0;
  fondu = new Ressort(1, REGLAGES.doux, "effet");
  molette = 0;
  /* Rendu */
  gpu: Gpu | null = null;
  canvas: HTMLCanvasElement | null = null;
  visible = true;
  raf = 0;
  last = 0;
  sale = true;
  aMesurer = true;
  fin = false;
  ro: ResizeObserver | null = null;
  mo: MutationObserver;
  mq: MediaQueryList | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
    poserCss();
    el.classList.add("ruban-repli");
    if (!el.hasAttribute("role")) el.setAttribute("role", "region");
    if (!el.hasAttribute("aria-roledescription")) el.setAttribute("aria-roledescription", "ruban d'images");
    this.lireReglages();
    this.collecter();
    this.mo = new MutationObserver((ms) => {
      let recolle = false;
      let regle = false;
      for (const m of ms) {
        if (m.type === "childList") {
          for (const n of [...m.addedNodes, ...m.removedNodes]) if (n instanceof HTMLImageElement || n instanceof HTMLPictureElement) recolle = true;
        } else if (m.target === this.el) regle = true;
        else if (m.target instanceof HTMLImageElement && m.attributeName === "src") recolle = true;
      }
      if (regle) {
        const avant = this.fig;
        this.lireReglages();
        if (avant !== this.fig) recolle = true;
      }
      if (recolle) {
        this.collecter();
        if (this.gpu) (this.debrancher(), void this.brancher());
      }
      this.aMesurer = true;
      this.reveiller();
    });
    this.mo.observe(el, { childList: true, attributes: true, subtree: true, attributeFilter: ["data-ruban", "data-ruban-hauteur", "data-ruban-joint", "data-ruban-rayon", "data-ruban-repos", "data-ruban-auto", "src"] });
    if (typeof ResizeObserver === "function") {
      this.ro = new ResizeObserver(() => ((this.aMesurer = true), this.reveiller()));
      this.ro.observe(el);
    }
    io?.observe(el);
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("pointerenter", this.onEnter);
    el.addEventListener("pointerleave", this.onLeave);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("keydown", this.onKey);
    el.addEventListener("focusin", this.onFocusIn);
    el.addEventListener("focusout", this.onFocusOut);
    el.addEventListener("click", this.onClickRepli);
    el.addEventListener("dragstart", this.onDragStart);
    this.mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    this.mq?.addEventListener?.("change", this.onReduit);
    void this.brancher();
    this.reveiller();
  }

  /* ── Lecture du DOM ── */
  lireReglages() {
    const d = this.el.dataset;
    this.fig = figureDe(d.ruban);
    const vert = estVerticale(this.fig);
    this.hauteur = Math.max(80, num(d.rubanHauteur, this.fig === "barillet" ? 520 : this.fig === "roue" ? 460 : 300));
    this.joint = Math.max(0, num(d.rubanJoint, this.fig === "lentille" ? 14 : 6));
    this.rayon = Math.max(0, num(d.rubanRayon, this.fig === "lentille" ? 18 : 0));
    this.repos = Math.max(0, Math.min(1.5, num(d.rubanRepos, 0.5)));
    this.auto = this.fig === "roue" ? 0 : num(d.rubanAuto, 0);
    const boite = vert ? this.hauteur : this.hauteur * (this.fig === "torsade" ? 1.75 : this.fig === "accordeon" ? 1.3 : 1.28);
    const st = this.el.style;
    st.setProperty("--ruban-boite", `${Math.round(boite)}px`);
    st.setProperty("--ruban-h", `${this.hauteur}px`);
    st.setProperty("--ruban-joint", `${this.joint}px`);
    st.setProperty("--ruban-rayon", `${this.rayon}px`);
    this.el.classList.toggle("ruban-vertical", this.fig === "barillet");
    const acc = getComputedStyle(this.el).getPropertyValue("--ruban-accent").trim();
    this.accent = rgb(acc || "#d9472b", [0.85, 0.28, 0.17]);
  }
  collecter() {
    // Une image est un <img> enfant, ou l'<img> d'un <picture> enfant (sources avif/webp).
    const toutes = this.el.querySelectorAll<HTMLImageElement>(":scope > img, :scope > picture > img");
    this.imgs = [...toutes].slice(0, MAX_IMAGES);
    if (toutes.length > MAX_IMAGES) console.warn(`[presse:ruban] ${MAX_IMAGES} images au plus`, this.el);
    this.aspects = this.imgs.map((im) => this.aspectDe(im));
    // Une seule image dans l'ordre de tabulation (tabindex mobile).
    this.redisposer();
    const c = Math.max(0, this.courantIndex());
    this.imgs.forEach((im, i) => {
      im.tabIndex = i === c ? 0 : -1;
      im.draggable = false;
      if (!im.complete) im.addEventListener("load", () => this.surCharge(im), { once: true });
    });
  }
  aspectDe(im: HTMLImageElement) {
    if (im.naturalWidth && im.naturalHeight) return im.naturalWidth / im.naturalHeight;
    const w = Number(im.getAttribute("width"));
    const h = Number(im.getAttribute("height"));
    return w > 0 && h > 0 ? w / h : 1.5;
  }
  surCharge(im: HTMLImageElement) {
    const i = this.imgs.indexOf(im);
    if (i < 0) return;
    const a = this.aspectDe(im);
    if (Math.abs(a - this.aspects[i]!) > 1e-3) {
      this.aspects[i] = a;
      this.redisposer();
    }
  }
  /** Recalcule la bande ; l'image au centre (et la fraction où on en est) reste au centre. */
  redisposer() {
    const vieux = this.disp;
    const n = this.aspects.length;
    let garde: { index: number; f: number } | null = null;
    if (vieux.total > 0 && vieux.longueurs.length === n) {
      const k = indexProche(this.s, vieux);
      const c = cibleProche(this.s, k, vieux);
      garde = { index: k, f: (this.s - c) / vieux.longueurs[k]! };
    }
    const vert = estVerticale(this.fig);
    const longueurs = this.aspects.map((a) => (vert ? 1 / a : a));
    const joint = this.joint / Math.max(1, this.epaisseur());
    this.disp = disposer(longueurs, joint);
    if (garde && n) {
      const c = cibleProche(0, garde.index, this.disp);
      const ns = c + garde.f * this.disp.longueurs[garde.index]!;
      this.decaler(ns - this.s);
    } else if (n && vieux.total === 0) {
      const ns = this.disp.debuts[0]! + this.disp.longueurs[0]! / 2;
      this.decaler(ns - this.s);
    }
    this.sale = true;
  }
  /** Déplace tout l'état du défilement de ds (sans vitesse) : bouclage, nouvelle disposition. */
  decaler(ds: number) {
    this.s += ds;
    this.sPrev += ds;
    this.ressort.x += ds;
    this.ressort.cible += ds;
    if (this.drag) this.drag.s0 += ds;
  }
  /** L'épaisseur de la bande, px CSS. */
  epaisseur() {
    if (this.fig === "barillet") return Math.max(40, (this.W || this.el.clientWidth || 600) * 0.84);
    if (this.fig === "roue") return this.hauteur;
    return this.hauteur;
  }
  mesurer() {
    this.aMesurer = false;
    const W = this.el.clientWidth;
    const H = this.el.clientHeight;
    const changeH = Math.abs(this.epaisseur() - this.h) > 0.5;
    this.W = W;
    this.H = H;
    this.h = this.epaisseur();
    if (changeH || this.disp.joint * this.h !== this.joint) this.redisposer();
    this.dpr = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 2);
    if (this.canvas) {
      const cw = Math.max(1, Math.round(W * this.dpr));
      const ch = Math.max(1, Math.round(H * this.dpr));
      if (this.canvas.width !== cw || this.canvas.height !== ch) ((this.canvas.width = cw), (this.canvas.height = ch));
    }
    this.sale = true;
  }

  /* ── Mouvement ── */
  courantIndex() {
    if (this.fig === "roue") return this.courant;
    return indexProche(this.s, this.disp);
  }
  aller(index: number, focaliser = false) {
    const n = this.imgs.length;
    if (!n) return;
    const i = ((Math.round(index) % n) + n) % n;
    if (this.fig === "roue") {
      const cible = this.pos.cible + ecartRoue(i, this.pos.cible, n);
      if (this.reduit || !this.gpu) this.pos.pose(cible);
      else this.pos.vers(cible);
      this.majCourant();
    } else {
      const c = cibleProche(this.s, i, this.disp);
      if (this.reduit) {
        this.decalerVers(c);
      } else {
        this.ressort.x = this.s;
        this.ressort.v = this.vs;
        this.ressort.vers(c);
        this.mode = "ressort";
        this.v = 0;
      }
    }
    this.poserTab(i, focaliser);
    if (!this.gpu) this.imgs[i]?.scrollIntoView({ block: "nearest", inline: "center", behavior: this.reduit ? "auto" : "smooth" });
    this.reveiller();
  }
  decalerVers(c: number) {
    this.s = c;
    this.sPrev = c;
    this.v = 0;
    this.mode = "libre";
  }
  poserTab(i: number, focaliser: boolean) {
    this.imgs.forEach((im, k) => (im.tabIndex = k === i ? 0 : -1));
    // Le focus suit l'image courante s'il est déjà dans le composant (molette, glisser) : Entrée choisit ce qu'on voit.
    const dedans = document.activeElement instanceof HTMLImageElement && this.imgs.includes(document.activeElement);
    if ((focaliser || dedans) && document.activeElement !== this.imgs[i]) this.imgs[i]?.focus({ preventScroll: true });
  }
  majCourant() {
    const n = this.imgs.length;
    if (!n) return;
    const c = boucler(Math.round(this.pos.x), n);
    if (c !== this.courant) {
      this.precedent = this.courant;
      this.courant = c;
      if (this.reduit) this.fondu.pose(1);
      else (this.fondu.pose(0), this.fondu.vers(1));
      this.sale = true;
    }
  }
  autoActif() {
    return this.auto !== 0 && !this.reduit && !this.survol && !this.focus && !this.drag && this.mode === "libre" && !!this.gpu;
  }
  choisir(i: number) {
    const im = this.imgs[i];
    if (!im) return;
    this.el.dispatchEvent(new CustomEvent("ruban:choix", { detail: { index: i, src: im.currentSrc || im.src, alt: im.alt }, bubbles: true }));
  }
  vue(): Vue {
    const p = parametres(this.fig, this.e, this.temps, this.repos, this.reduit);
    return { fig: this.fig, W: this.W, H: this.H, h: this.h, s: this.s, amp: p.amp, kappa: p.kappa, phi: this.phi, persp: PERSP, sW: p.sW, sH: p.sH, bombe: p.bombe, beta: p.beta };
  }
  indexSous(clientX: number, clientY: number) {
    const r = this.el.getBoundingClientRect();
    const x = clientX - r.left - this.el.clientLeft;
    const y = clientY - r.top - this.el.clientTop;
    if (this.fig === "roue") return indexSousRoue(x, y, this.pos.x, this.courant, this.aspects, this.W, this.H);
    return indexSous(x, y, this.vue(), this.disp);
  }

  /* ── Événements ── */
  axe(e: { clientX: number; clientY: number }) {
    return estVerticale(this.fig) ? e.clientY : e.clientX;
  }
  /** Unité de défilement en px CSS (une épaisseur de bande ; un pas de vignette pour la roue). */
  unite() {
    return this.fig === "roue" ? roueGeo(this.W || 1, this.H || 1).th * 1.32 : this.h;
  }
  onDown = (e: PointerEvent) => {
    if (!this.gpu || e.button !== 0) return;
    this.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, s0: this.fig === "roue" ? this.pos.x : this.s, bouge: false };
    this.vit.reset();
    this.vit.add(e.timeStamp, this.axe(e));
    if (this.fig === "roue") this.pos.tiens(this.pos.x, 0);
    else ((this.mode = "tenu"), (this.v = 0));
    this.reveiller();
  };
  onMove = (e: PointerEvent) => {
    if (this.fig === "lentille" && e.pointerType !== "touch") {
      const r = this.el.getBoundingClientRect();
      if (!this.lensSuit) this.lensRessort.pose(this.lensX);
      this.lensSuit = true;
      this.lensRessort.vers(e.clientX - r.left);
      this.reveiller();
    }
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const list = e.getCoalescedEvents?.() ?? [];
    if (list.length) for (const c of list) this.vit.add(c.timeStamp, this.axe(c));
    else this.vit.add(e.timeStamp, this.axe(e));
    const delta = this.axe(e) - (estVerticale(this.fig) ? d.y0 : d.x0);
    if (!d.bouge && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) {
      d.bouge = true;
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
        /* pointeur déjà relâché */
      }
      this.el.classList.add("ruban-tenu");
    }
    if (!d.bouge) return;
    const ns = d.s0 - delta / this.unite();
    if (this.fig === "roue") (this.pos.tiens(ns, 0), this.majCourant());
    else this.s = ns;
    this.sale = true;
    this.reveiller();
  };
  onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    this.el.classList.remove("ruban-tenu");
    if (!d.bouge) {
      // Un clic : l'image sous le pointeur (calcul inverse).
      if (this.fig === "roue") this.pos.pose(this.pos.x);
      else this.mode = "libre";
      if (e.type === "pointerup") {
        const i = this.indexSous(e.clientX, e.clientY);
        if (i >= 0) (this.aller(i), this.choisir(i));
      }
      return;
    }
    const v = this.reduit ? 0 : -this.vit.get(e.timeStamp) / this.unite();
    if (this.fig === "roue") {
      // Le lancer projeté (décélération rapide d'iOS) choisit la vignette d'arrivée.
      const cible = Math.round(this.reduit ? this.pos.x : projette(this.pos.x, v, DECELERATION.rapide));
      if (this.reduit) this.pos.pose(cible);
      else this.pos.lacher(v, cible);
      this.majCourant();
    } else {
      this.mode = "libre";
      this.v = v;
    }
    this.reveiller();
  };
  onEnter = () => ((this.survol = true), this.reveiller());
  onLeave = () => {
    this.survol = false;
    if (this.lensSuit) ((this.lensSuit = false), this.reveiller());
  };
  onWheel = (e: WheelEvent) => {
    if (!this.gpu) return;
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.unite() * 4 : 1;
    let d = 0;
    if (estVerticale(this.fig)) d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * k;
    else d = (e.deltaX !== 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0) * k;
    if (!d) return;
    e.preventDefault();
    if (this.fig === "roue") {
      this.molette += d;
      const pas = 60;
      while (Math.abs(this.molette) >= pas) {
        const sg = Math.sign(this.molette);
        this.molette -= sg * pas;
        this.aller(this.courantCible() + sg);
      }
      return;
    }
    if (this.mode !== "libre") ((this.mode = "libre"), (this.v = 0));
    this.v = 0;
    this.s += d / this.unite();
    this.sale = true;
    this.reveiller();
  };
  courantCible() {
    const n = this.imgs.length;
    return n ? boucler(Math.round(this.pos.cible), n) : 0;
  }
  onKey = (e: KeyboardEvent) => {
    const n = this.imgs.length;
    if (!n) return;
    const vert = estVerticale(this.fig);
    const t = e.target as HTMLElement;
    const ki = t instanceof HTMLImageElement ? this.imgs.indexOf(t) : -1;
    const base = this.fig === "roue" ? this.courantCible() : ki >= 0 ? ki : this.courantIndex();
    let pas = 0;
    if (e.key === "ArrowRight" || (vert && e.key === "ArrowDown")) pas = 1;
    else if (e.key === "ArrowLeft" || (vert && e.key === "ArrowUp")) pas = -1;
    else if (e.key === "Home") return (e.preventDefault(), this.aller(0, true));
    else if (e.key === "End") return (e.preventDefault(), this.aller(n - 1, true));
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const i = ki >= 0 ? ki : base;
      this.aller(i);
      this.choisir(i);
      return;
    }
    if (!pas) return;
    e.preventDefault();
    this.aller(base + pas, true);
  };
  onFocusIn = (e: FocusEvent) => {
    this.focus = true;
    const t = e.target;
    const i = t instanceof HTMLImageElement ? this.imgs.indexOf(t) : -1;
    let vis = false;
    try {
      vis = t instanceof HTMLElement && t.matches(":focus-visible");
    } catch {
      vis = true;
    }
    this.focusIdx = vis ? i : -1;
    if (i >= 0 && vis && i !== (this.fig === "roue" ? this.courantCible() : this.courantIndex())) this.aller(i);
    this.sale = true;
    this.reveiller();
  };
  onFocusOut = (e: FocusEvent) => {
    if (e.relatedTarget instanceof Node && this.el.contains(e.relatedTarget)) return;
    this.focus = false;
    this.focusIdx = -1;
    this.sale = true;
    this.reveiller();
  };
  /** Repli : un clic sur une image la choisit (le défilement est natif). */
  onClickRepli = (e: MouseEvent) => {
    if (this.gpu) return;
    const t = e.target;
    const i = t instanceof HTMLImageElement ? this.imgs.indexOf(t) : -1;
    if (i >= 0) this.choisir(i);
  };
  onDragStart = (e: DragEvent) => e.preventDefault();
  onReduit = (e: MediaQueryListEvent) => {
    this.reduit = e.matches;
    this.reveiller();
  };

  /* ── GPU ── */
  async brancher() {
    if (pertes >= 3) return;
    try {
      const device = await getDevice();
      if (this.fin || this.gpu) return;
      void device.lost.then((info) => {
        if (info.reason === "destroyed" && this.gpu?.s.device === device) {
          pertes++;
          this.debrancher();
        }
      });
      const s = partageDe(device);
      if (this.aMesurer || !this.W) {
        this.mesurer();
      }
      const n = Math.max(1, this.imgs.length);
      // La taille de calque : la plus grande image telle qu'elle s'affiche (px appareil), bornée.
      const dpr = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 2);
      const amax = Math.max(1, ...this.aspects);
      const amin = Math.min(1, ...this.aspects);
      let dw: number;
      let dh: number;
      if (this.fig === "barillet") ((dw = this.epaisseur()), (dh = dw / amin));
      else if (this.fig === "roue") {
        const g = roueGeo(this.W || 800, this.H || this.hauteur);
        dw = g.boite[2] - g.boite[0];
        dh = g.boite[3] - g.boite[1];
      } else ((dh = this.hauteur * 1.35), (dw = dh * amax));
      const lim = Math.min(2048, device.limits.maxTextureDimension2D);
      let Tw = Math.min(lim, Math.max(64, Math.round(dw * dpr)));
      let Th = Math.min(lim, Math.max(64, Math.round(dh * dpr)));
      // Budget mémoire : 96 Mo au plus (mipmaps comprises).
      const budget = 96e6 / (4 * 1.34 * n);
      if (Tw * Th > budget) {
        const k = Math.sqrt(budget / (Tw * Th));
        Tw = Math.max(32, Math.floor(Tw * k));
        Th = Math.max(32, Math.floor(Th * k));
      }
      const levels = Math.floor(Math.log2(Math.max(Tw, Th))) + 1;
      const tex = device.createTexture({
        label: "presse-ruban-images",
        size: [Tw, Th, n],
        format: "rgba8unorm",
        mipLevelCount: levels,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      const ubuf = device.createBuffer({ size: UFLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bind = device.createBindGroup({
        layout: s.layout,
        entries: [
          { binding: 0, resource: { buffer: ubuf } },
          { binding: 1, resource: s.samp },
          { binding: 2, resource: tex.createView({ dimension: "2d-array" }) },
        ],
      });
      const c = this.canvas ?? document.createElement("canvas");
      c.className = "ruban-canvas";
      c.setAttribute("aria-hidden", "true");
      if (!c.isConnected) this.el.append(c);
      this.canvas = c;
      const format = navigator.gpu.getPreferredCanvasFormat();
      const ctx = modeBanc() ? null : c.getContext("webgpu");
      ctx?.configure({ device, format, alphaMode: "premultiplied" });
      const g: Gpu = { s, ctx, format, ubuf, tex, bind, data: new Float32Array(UFLOATS), Tw, Th, levels, charge: this.imgs.map(() => false), pret: Promise.resolve() };
      this.gpu = g;
      g.pret = Promise.all(this.imgs.map((im, i) => this.charger(g, im, i))).then(() => undefined);
      this.el.scrollLeft = 0;
      this.el.scrollTop = 0;
      this.el.classList.remove("ruban-repli");
      this.el.classList.add("ruban-gpu");
      // Les images, masquées, n'ont plus de raison d'attendre le défilement pour charger.
      for (const im of this.imgs) if (im.loading === "lazy") im.loading = "eager";
      this.aMesurer = true;
      this.sale = true;
      this.reveiller();
    } catch (e) {
      if (navigator.gpu) console.warn("[presse:ruban] WebGPU indisponible, repli CSS", e);
    }
  }
  async charger(g: Gpu, im: HTMLImageElement, i: number) {
    try {
      if (!im.complete || !im.naturalWidth) await im.decode();
      if (this.gpu !== g) return;
      this.surCharge(im);
      let bmp: ImageBitmap;
      try {
        bmp = await createImageBitmap(im, { resizeWidth: g.Tw, resizeHeight: g.Th, resizeQuality: "high" });
      } catch {
        // Repli : fetch + décodage hors du fil principal.
        const blob = await fetch(im.currentSrc || im.src).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))));
        bmp = await createImageBitmap(blob, { resizeWidth: g.Tw, resizeHeight: g.Th, resizeQuality: "high" });
      }
      if (this.gpu !== g) return bmp.close();
      const dev = g.s.device;
      dev.queue.copyExternalImageToTexture({ source: bmp }, { texture: g.tex, origin: [0, 0, i] }, [g.Tw, g.Th]);
      bmp.close();
      this.mips(g, i);
      g.charge[i] = true;
      this.sale = true;
      this.reveiller();
    } catch (e) {
      console.warn("[presse:ruban] image illisible", im.currentSrc || im.src, e);
    }
  }
  mips(g: Gpu, layer: number) {
    const dev = g.s.device;
    const enc = dev.createCommandEncoder();
    for (let l = 1; l < g.levels; l++) {
      const bind = dev.createBindGroup({
        layout: g.s.mipPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: g.s.samp },
          { binding: 1, resource: g.tex.createView({ dimension: "2d", baseArrayLayer: layer, arrayLayerCount: 1, baseMipLevel: l - 1, mipLevelCount: 1 }) },
        ],
      });
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: g.tex.createView({ dimension: "2d", baseArrayLayer: layer, arrayLayerCount: 1, baseMipLevel: l, mipLevelCount: 1 }), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }],
      });
      pass.setPipeline(g.s.mipPipe);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
    }
    dev.queue.submit([enc.finish()]);
  }
  debrancher() {
    const g = this.gpu;
    if (!g) return;
    this.gpu = null;
    try {
      g.ctx?.unconfigure();
    } catch {
      /* déjà perdu */
    }
    g.tex.destroy();
    g.ubuf.destroy();
    this.canvas?.remove();
    this.canvas = null;
    this.drag = null;
    this.el.classList.remove("ruban-gpu", "ruban-tenu");
    this.el.classList.add("ruban-repli");
    // Le repli montre l'image courante.
    const i = this.courantIndex();
    requestAnimationFrame(() => this.imgs[i]?.scrollIntoView({ block: "nearest", inline: "center" }));
  }

  /* ── Une image ── */
  reveiller() {
    if (!this.raf && !this.fin) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }
  frame = (now: number) => {
    this.raf = 0;
    if (!this.gpu) return;
    if (this.aMesurer) this.mesurer();
    const dt = fige ? 0 : Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const bouge = this.pas(dt);
    this.rendre();
    // Hors écran ou onglet caché : la boucle s'arrête ; elle repart à la visibilité (IntersectionObserver, visibilitychange).
    if ((bouge || fige) && this.visible && !document.hidden) this.reveiller();
  };
  /** Avance l'état de dt secondes ; rend vrai si quelque chose bouge encore. */
  pas(dt: number) {
    this.temps += dt;
    if (this.fig === "roue") return this.pasRoue(dt);
    if (this.mode === "ressort") {
      const encore = this.ressort.pas(dt);
      this.s = this.ressort.x;
      if (!encore) ((this.mode = "libre"), (this.v = 0));
    } else if (this.mode === "libre") {
      [this.s, this.v] = inertie(this.s, this.v, dt);
      if (this.autoActif()) this.s += this.auto * (this.W / Math.max(1, this.h)) * dt;
    }
    if (dt > 0) {
      this.vs = lisserVitesse(this.vs, (this.s - this.sPrev) / dt, dt);
      if (Math.abs(this.vs) < 1e-3 && this.s === this.sPrev) this.vs = 0;
    }
    this.sPrev = this.s;
    const cible = this.reduit ? 0 : intensite(this.vs);
    this.e = approcher(this.e, cible, dt);
    if (this.e < 1e-3 && cible === 0) this.e = 0;
    if (this.fig === "torsade" && !this.reduit) this.phi = avancerPhase(this.phi, this.vs, parametres("torsade", this.e, this.temps, this.repos, false).kappa, dt);
    // Bouclage : s reste dans [0, L) (précision des flottants du shader).
    const L = this.disp.total;
    if (L > 0 && (this.s < 0 || this.s >= L)) this.decaler(-Math.floor(this.s / L) * L);
    let lensBouge = false;
    if (this.fig === "lentille") {
      if (this.lensSuit) {
        lensBouge = this.lensRessort.pas(dt);
        this.lensX = this.lensRessort.x;
      } else {
        // La bosse traverse la rangée à mesure qu'elle défile (en sens contraire) ; au repos, elle reste où elle est.
        const R = this.h * 0.62;
        const P = Math.max(1, (this.W / this.h) * 0.8);
        const ph = boucler(this.s / P + 0.5, 1);
        this.lensX = -R + ph * (this.W + 2 * R);
      }
    }
    this.sale = true;
    const respire = this.fig === "torsade" && !this.reduit && this.repos > 0;
    return this.mode !== "libre" || this.v !== 0 || this.vs !== 0 || this.e > 0 || this.autoActif() || respire || lensBouge;
  }
  pasRoue(dt: number) {
    const a = this.pos.pas(dt);
    const b = this.fondu.pas(dt);
    if (a) this.majCourant();
    const p = this.pos.x;
    this.vs = dt > 0 ? lisserVitesse(this.vs, (p - this.sPrev) / dt, dt) : this.vs;
    if (!a && Math.abs(this.vs) < 1e-3) this.vs = 0;
    this.sPrev = p;
    this.sale = true;
    return a || b || !!this.drag || this.vs !== 0;
  }
  rendre() {
    const g = this.gpu;
    if (!g || !this.sale || !g.ctx) return;
    this.sale = false;
    this.remplir();
    try {
      this.dessinerDans(g.ctx.getCurrentTexture().createView(), g.format);
    } catch (e) {
      console.warn("[presse:ruban] dessin", e);
    }
  }
  remplir() {
    const g = this.gpu!;
    const d = g.data;
    const k = this.dpr;
    const fig = this.fig;
    const n = Math.min(this.imgs.length, MAX_IMAGES);
    const p = parametres(fig, this.e, this.temps, this.repos, this.reduit);
    const h = Math.max(1, this.h);
    d.fill(0);
    d[0] = Math.max(1, Math.round(this.W * k));
    d[1] = Math.max(1, Math.round(this.H * k));
    d[2] = FIG_INDEX[fig];
    d[3] = n;
    d[4] = h * k;
    let span = this.W / h + 0.5;
    if (fig === "torsade") span = this.W / h / 0.78 + 0.6;
    else if (fig === "accordeon") span = this.W / (h * p.sW) + 0.5;
    else if (fig === "barillet") span = this.H / h + 0.5;
    d[5] = span;
    d[6] = this.s;
    d[7] = Math.max(1e-3, this.disp.total);
    if (fig === "torsade") d.set([p.amp, p.kappa, this.phi, PERSP], 8);
    else if (fig === "accordeon") d.set([p.sW, p.sH, p.bombe, 0], 8);
    else if (fig === "barillet") d.set([p.beta, 0, 0, 0], 8);
    const R = h * 0.62;
    d.set([this.lensX * k, (this.H / 2) * k, R * k, this.reduit ? 0 : 0.5 + 0.12 * this.e], 12);
    d.set([this.disp.joint, this.rayon / h, this.focusIdx, 0.62], 16);
    d.set([this.accent[0], this.accent[1], this.accent[2], k], 20);
    const [nx, ny] = MAILLAGE[fig];
    d.set([nx, ny, fig === "lentille" ? 0.35 : (2 * 1) / h, fig === "barillet" ? 1 : 0], 24);
    if (fig === "roue") {
      const rg = roueGeo(this.W, this.H);
      d.set([this.pos.x, this.courant, this.precedent, this.reduit ? 1 : Math.min(1, Math.max(0, this.fondu.x))], 28);
      d.set([rg.th * k, rg.Rw * k, rg.dphi, rg.colX * k], 32);
      d.set(rg.boite.map((x) => x * k), 36);
    }
    for (let i = 0; i < n; i++) {
      const o = UVEC * 4 + i * 4;
      d[o] = this.disp.debuts[i] ?? 0;
      d[o + 1] = this.disp.longueurs[i] ?? 1;
      d[o + 2] = this.aspects[i] ?? 1;
      d[o + 3] = g.charge[i] ? 1 : 0;
    }
  }
  /** Dessine l'état courant dans une vue de texture quelconque (le canvas, ou une texture du banc). */
  dessinerDans(view: GPUTextureView, format: GPUTextureFormat) {
    const g = this.gpu!;
    const dev = g.s.device;
    dev.queue.writeBuffer(g.ubuf, 0, g.data);
    const enc = dev.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    pass.setPipeline(pipeDe(g.s, format));
    pass.setBindGroup(0, g.bind);
    const n = Math.min(this.imgs.length, MAX_IMAGES);
    if (n) {
      if (this.fig === "roue") pass.draw(6, n + 2);
      else {
        const [nx, ny] = MAILLAGE[this.fig];
        pass.draw(6 * nx * ny, 1);
      }
    }
    pass.end();
    dev.queue.submit([enc.finish()]);
  }

  detruire() {
    this.fin = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.debrancher();
    this.mo.disconnect();
    this.ro?.disconnect();
    io?.unobserve(this.el);
    this.mq?.removeEventListener?.("change", this.onReduit);
    const el = this.el;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.onUp);
    el.removeEventListener("pointerenter", this.onEnter);
    el.removeEventListener("pointerleave", this.onLeave);
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("keydown", this.onKey);
    el.removeEventListener("focusin", this.onFocusIn);
    el.removeEventListener("focusout", this.onFocusOut);
    el.removeEventListener("click", this.onClickRepli);
    el.removeEventListener("dragstart", this.onDragStart);
    el.classList.remove("ruban-repli", "ruban-gpu", "ruban-vertical");
    instances.delete(el);
  }

  api(): RubanApi {
    return {
      aller: (i: number) => this.aller(i),
      vitesse: () => this.vs,
      detruire: () => this.detruire(),
    };
  }
}

/* ───────────────────────── Banc d'essai ───────────────────────── */

/** Fige (ou relâche) le temps de tous les rubans. */
export function figerRuban(on: boolean) {
  fige = on;
  if (!on) for (const r of instances.values()) r.reveiller();
}
/** Avance tous les rubans de `ms` millisecondes, par pas de 1/60 s (à utiliser temps figé). */
export function avancerRuban(ms: number) {
  for (const r of instances.values()) {
    if (r.aMesurer) r.mesurer();
    for (let t = 0; t < ms - 1e-6; t += 1000 / 60) r.pas(Math.min(1000 / 60, ms - t) / 1000);
    r.sale = true;
    r.rendre();
  }
}
/** Lance un ruban à la vitesse v (unités d'épaisseur par seconde ; images par seconde pour la roue), comme un lâcher. */
export function lancerRuban(el: HTMLElement, v: number) {
  const r = instances.get(el);
  if (!r) return;
  if (r.fig === "roue") r.pos.lacher(v, Math.round(r.pos.x + v * 0.5));
  else ((r.mode = "libre"), (r.v = v));
  r.reveiller();
}
/** Pose l'état d'un ruban : défilement, temps, position de la lentille (px CSS, null : elle suit le défilement). */
export function poserRuban(el: HTMLElement, o: { s?: number; temps?: number; lentille?: number | null; vitesse?: number }) {
  const r = instances.get(el);
  if (!r) return;
  if (o.s !== undefined) (r.decalerVers(o.s), (r.vs = 0));
  if (o.temps !== undefined) r.temps = o.temps;
  if (o.vitesse !== undefined) ((r.vs = o.vitesse), (r.e = r.reduit ? 0 : intensite(o.vitesse)));
  if (o.lentille !== undefined) {
    r.lensSuit = o.lentille !== null;
    if (o.lentille !== null) (r.lensRessort.pose(o.lentille), (r.lensX = o.lentille));
  }
  r.sale = true;
  r.reveiller();
}
/** Promesse tenue quand les textures d'un ruban sont chargées. */
export async function rubanPret(el: HTMLElement) {
  for (let k = 0; k < 200; k++) {
    const r = instances.get(el);
    if (r?.gpu) return r.gpu.pret;
    await new Promise((res) => setTimeout(res, 25));
  }
}
/** Dessine un ruban hors écran (son état courant) et rend un PNG ; en mode banc, l'image est aussi posée dans son canvas. */
export async function capturerRuban(el: HTMLElement, fond?: string): Promise<string | null> {
  const r = instances.get(el);
  const g = r?.gpu;
  if (!r || !g) return null;
  if (r.aMesurer) r.mesurer();
  r.remplir();
  const w = g.data[0]!;
  const h = g.data[1]!;
  const dev = g.s.device;
  const tex = dev.createTexture({ size: [w, h], format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  r.dessinerDans(tex.createView(), "rgba8unorm");
  const url = await textureEnPng(dev, tex, w, h, fond);
  if (modeBanc() && r.canvas) {
    const im = new Image();
    im.src = fond ? await textureEnPng(dev, tex, w, h) : url;
    await im.decode();
    const c2 = r.canvas.getContext("2d");
    c2?.clearRect(0, 0, w, h);
    c2?.drawImage(im, 0, 0);
  }
  tex.destroy();
  return url;
}
/** Le diagnostic de compilation des shaders (banc d'essai). */
export async function compilerRuban(): Promise<string[]> {
  const d = await getDevice();
  const out: string[] = [];
  for (const code of [WGSL, MIP_WGSL]) {
    const info = await d.createShaderModule({ code }).getCompilationInfo();
    for (const x of info.messages) out.push(`${x.type} ${x.lineNum}:${x.linePos} ${x.message}`);
  }
  return out;
}

/* ───────────────────────── Armement ───────────────────────── */

/** Le ruban d'un conteneur [data-ruban] (armé au besoin). */
export function ruban(el: HTMLElement): RubanApi {
  let r = instances.get(el);
  if (!r) {
    armerGlobal();
    r = new Ruban(el);
    instances.set(el, r);
  }
  return r.api();
}

let arme = false;
function armerGlobal() {
  if (arme || typeof document === "undefined") return;
  arme = true;
  if (typeof IntersectionObserver === "function") {
    io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const r = instances.get(e.target as HTMLElement);
          if (!r) continue;
          r.visible = e.isIntersecting;
          if (r.visible) ((r.sale = true), r.reveiller());
        }
      },
      { rootMargin: "120px" },
    );
    for (const el of instances.keys()) io.observe(el);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) for (const r of instances.values()) ((r.sale = true), r.reveiller());
  });
  // Appareil perdu : chaque ruban repasse au repli CSS, puis se rebranche (pas après trois pertes).
  onDeviceLost(() => {
    pertes++;
    for (const r of instances.values()) r.debrancher();
    if (pertes >= 3) return console.warn("[presse:ruban] pertes d'appareil répétées : repli CSS");
    setTimeout(() => {
      for (const r of instances.values()) void r.brancher();
    }, 300);
  });
}

let surveille = false;
/** Arme les conteneurs [data-ruban] présents et ceux qui arrivent ensuite. */
export function initRuban(root: ParentNode = document) {
  if (typeof document === "undefined") return;
  armerGlobal();
  const armer = (el: HTMLElement) => void ruban(el);
  if (root instanceof HTMLElement && root.matches("[data-ruban]")) armer(root);
  root.querySelectorAll<HTMLElement>("[data-ruban]").forEach(armer);
  if (root === document && !surveille) {
    surveille = true;
    new MutationObserver((ms) => {
      for (const m of ms) {
        for (const n of m.addedNodes) if (n instanceof HTMLElement) (n.matches("[data-ruban]") ? armer(n) : n.querySelectorAll<HTMLElement>("[data-ruban]").forEach(armer));
        for (const n of m.removedNodes)
          if (n instanceof HTMLElement) for (const [el, r] of instances) if (!el.isConnected && (n === el || n.contains(el))) r.detruire();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
}
