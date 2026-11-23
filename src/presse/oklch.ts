/**
 * Presse — couleurs en OKLCH (Björn Ottosson, 2020) : conversion vers et depuis sRGB, mise dans la gamme par baisse de
 * chroma, contraste WCAG 2.x, et l'étalonnage du look (src/presse/look.ts) évalué sur une couleur — pour que le contraste
 * se juge sur ce que la page montre vraiment, filtre SVG compris.
 *
 * Pur : ni DOM ni réseau (testé sous Node, src/presse/variations.test.ts).
 */
import { LOOKS } from "./look.ts";

/** [L 0…1, C ≥ 0, h en degrés]. */
export type Oklch = [number, number, number];
/** [r, g, b] en sRGB encodé, 0…1. */
export type Rvb = [number, number, number];

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const enc = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** sRGB encodé → OKLCH. */
export function versOklch([r8, g8, b8]: Rvb): Oklch {
  const r = lin(r8),
    g = lin(g8),
    b = lin(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, C, C < 1e-6 ? 0 : h];
}

/** OKLCH → sRGB linéaire, sans bornage (peut sortir de la gamme). */
function versLineaire([L, C, h]: Oklch): Rvb {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const dansGamme = (x: Rvb, e = 1e-4) => x.every((c) => c >= -e && c <= 1 + e);

/** OKLCH → sRGB encodé, dans la gamme : la chroma baisse (teinte et clarté gardées) jusqu'à y entrer. */
export function versRvb(o: Oklch): Rvb {
  const L = Math.min(1, Math.max(0, o[0]));
  let x = versLineaire([L, o[1], o[2]]);
  if (!dansGamme(x)) {
    let lo = 0,
      hi = o[1];
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (dansGamme(versLineaire([L, mid, o[2]]))) lo = mid;
      else hi = mid;
    }
    x = versLineaire([L, lo, o[2]]);
  }
  return x.map((c) => enc(Math.min(1, Math.max(0, c)))) as Rvb;
}
/** La chroma réellement affichable de cette couleur (après mise dans la gamme). */
export const dansLaGamme = (o: Oklch) => dansGamme(versLineaire(o));

export const hexDeRvb = (x: Rvb) => "#" + x.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");
export function rvbDeHex(hex: string): Rvb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`couleur illisible : ${hex}`);
  const n = Number.parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
/** OKLCH → « #rrggbb » (ce que le CSS reçoit, et ce sur quoi se juge le contraste). */
export const hex = (o: Oklch) => hexDeRvb(versRvb(o));
/** « oklch(62.4% 0.153 41.2) » : la forme CSS, pour l'export. */
export const cssOklch = ([L, C, h]: Oklch) => `oklch(${+(L * 100).toFixed(2)}% ${+C.toFixed(4)} ${+h.toFixed(2)})`;

/** Luminance relative WCAG d'un sRGB encodé. */
export const luminanceRvb = ([r, g, b]: Rvb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
/** Contraste WCAG 2.x (1 à 21) entre deux couleurs « #rrggbb » — quantifiées sur 8 bits, comme à l'écran. */
export function contrasteHex(a: string, b: string) {
  const q = (h: string) => rvbDeHex(h);
  const [x, y] = [luminanceRvb(q(a)), luminanceRvb(q(b))].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/* ───────────────────────── Étalonnage du look ───────────────────────── */

/**
 * Le filtre du look appliqué à une couleur, comme le fait le compositeur : `feColorMatrix type="saturate"` puis
 * `feComponentTransfer` en table de 33 valeurs, en sRGB encodé (`color-interpolation-filters="sRGB"`). Le grain et la
 * vignette (bruit centré, bords) ne sont pas comptés.
 */
export function etalonner(x: Rvb, nomLook: string): Rvb {
  const look = LOOKS[nomLook];
  if (!look) return x;
  let [r, g, b] = x;
  if (look.saturate !== undefined && look.saturate !== 1) {
    const s = look.saturate;
    const R = (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b;
    const G = (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b;
    const B = (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b;
    [r, g, b] = [R, G, B].map((c) => Math.min(1, Math.max(0, c))) as Rvb;
  }
  if (look.curves) {
    const t = look.curves.map(table);
    [r, g, b] = [lireTable(t[0]!, r), lireTable(t[1]!, g), lireTable(t[2]!, b)];
  }
  return [r, g, b];
}
/** Les 33 valeurs d'une courbe noir relevé → gamma → blanc (les mêmes, arrondies pareil, que look.ts). */
export const table = ([lo, gamma, hi]: readonly [number, number, number]) => Array.from({ length: 33 }, (_, i) => +(lo + (hi - lo) * Math.pow(i / 32, gamma)).toFixed(4));
function lireTable(t: number[], c: number) {
  const n = t.length - 1;
  const k = Math.min(n - 1, Math.floor(c * n));
  return t[k]! + (c * n - k) * (t[k + 1]! - t[k]!);
}
/** Contraste de deux « #rrggbb » une fois passées par l'étalonnage du look. */
export function contrasteSous(a: string, b: string, nomLook: string) {
  const ea = hexDeRvb(etalonner(rvbDeHex(a), nomLook));
  const eb = hexDeRvb(etalonner(rvbDeHex(b), nomLook));
  return contrasteHex(ea, eb);
}

/* ───────────────────────── Solveur de contraste ───────────────────────── */

const arr = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d + 0;
/** Arrondi de stockage (ce que garde le JSON) : le solveur juge la couleur arrondie, pour que l'aller-retour la garde sûre. */
export const arrondir = ([L, C, h]: Oklch): Oklch => [arr(Math.min(1, Math.max(0, L)), 4), arr(Math.max(0, C), 4), arr(((h % 360) + 360) % 360, 2)];

/** Contraste le plus faible d'une couleur contre des fonds, brut et sous l'étalonnage du look. */
export function contrasteMin(c: Oklch, fonds: readonly Oklch[], nomLook = "neutre") {
  const h = hex(c);
  let m = Infinity;
  for (const f of fonds) {
    const hf = hex(f);
    m = Math.min(m, contrasteHex(h, hf), contrasteSous(h, hf, nomLook));
  }
  return m;
}

/**
 * Le solveur : la couleur la plus proche de `c` (même teinte, même chroma si possible) dont le contraste contre chacun
 * des `fonds` atteint `cible`, brut et sous l'étalonnage. Il déplace la clarté L, du côté opposé aux fonds, plutôt que
 * de rejeter le tirage ; en dernier recours, noir ou blanc purs (l'un des deux tient toujours 4,58:1 sur un fond uni).
 */
export function ajusterContraste(c: Oklch, fonds: readonly Oklch[], cible: number, nomLook = "neutre"): { couleur: Oklch; ajuste: boolean } {
  const ok = (x: Oklch) => contrasteMin(x, fonds, nomLook) >= cible;
  const c0 = arrondir(c);
  if (ok(c0)) return { couleur: c0, ajuste: false };
  const Lf = fonds.reduce((s, f) => s + f[0], 0) / Math.max(1, fonds.length);
  // Vers le sombre si les fonds sont clairs, vers le clair sinon ; puis l'autre sens si le premier n'aboutit pas.
  for (const vers of Lf >= 0.6 ? [0, 1] : [1, 0]) {
    const pas = 48;
    let prec = c0[0];
    for (let i = 1; i <= pas; i++) {
      const L = c0[0] + ((vers - c0[0]) * i) / pas;
      const x = arrondir([L, c0[1], c0[2]]);
      if (ok(x)) {
        // Affinage entre le dernier échec et ce succès : la plus petite retouche qui tient.
        let lo = prec,
          hi = L;
        for (let k = 0; k < 18; k++) {
          const mid = (lo + hi) / 2;
          if (ok(arrondir([mid, c0[1], c0[2]]))) hi = mid;
          else lo = mid;
        }
        return { couleur: arrondir([hi, c0[1], c0[2]]), ajuste: true };
      }
      prec = L;
    }
  }
  const noir: Oklch = [0, 0, 0],
    blanc: Oklch = [1, 0, 0];
  return { couleur: contrasteMin(noir, fonds, nomLook) >= contrasteMin(blanc, fonds, nomLook) ? noir : blanc, ajuste: true };
}

/** Mélange dans OKLab (interpolation perceptive, sans détour de teinte). */
export function melanger(a: Oklch, b: Oklch, t: number): Oklch {
  const ab = (o: Oklch) => [o[0], o[1] * Math.cos((o[2] * Math.PI) / 180), o[1] * Math.sin((o[2] * Math.PI) / 180)];
  const [L1, a1, b1] = ab(a),
    [L2, a2, b2] = ab(b);
  const L = L1! + (L2! - L1!) * t,
    A = a1! + (a2! - a1!) * t,
    B = b1! + (b2! - b1!) * t;
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, Math.hypot(A, B), h];
}
