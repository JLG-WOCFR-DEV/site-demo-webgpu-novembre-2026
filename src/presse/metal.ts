/**
 * Presse — « metal » : boutons, textes et badges en chrome liquide, en temps réel. Équivalent par attributs de metal-fx
 * (libraries.dev/metal) ; shader WGSL original.
 *
 *   <button data-metal="chromatique" data-metal-force="1">Passer à Pro</button>   (la bordure du bouton en chrome)
 *   <span data-metal-texte>Pro</span>                                            (les lettres elles-mêmes)
 *   <span data-metal-badge>Nouveau</span>                                        (une pastille, texte lisible dessus)
 *   <button data-metal data-metal-forme="cercle" data-metal-nom="envoyer">→</button>
 *   <span data-metal-reflet="envoyer">Auto</span>                                (reçoit le reflet de « envoyer »)
 *
 * Attributs :
 *   data-metal / data-metal-texte / data-metal-badge   la valeur est le préréglage : chromatique (défaut), argent, or,
 *                                                      cuivre, noir ;
 *   data-metal-force         0–1 (défaut 1) : écoulement, dispersion, halo, attraction du pointeur ;
 *   data-metal-forme         anneau (défaut : la bordure épaisse, en forme de la boîte arrondie), plein (toute la
 *                            surface), cercle (anneau circulaire), disque (disque plein) ;
 *   data-metal-epaisseur     épaisseur de l'anneau, px (défaut 3) ;
 *   data-metal-ombre         ombre intérieure (présent = oui) ;
 *   data-metal-nom           nom d'un élément métal, que des voisins peuvent refléter ;
 *   data-metal-reflet="nom"  l'élément reçoit une lueur mobile qui suit le halo de l'élément nommé (variables CSS
 *                            --metal-reflet-x/-y/-a/-c posées par ce module, un dégradé en ::after ; pas de canvas).
 * JS : `initMetal(root?)` arme ce qui est là et ce qui arrive.
 *
 * Le shader : un champ de bandes (iso-lignes d'une fonction lisse : profondeur dans la forme, pente du biseau, bruit
 * lent, inclinaison, attraction du pointeur) passé dans une rampe « chrome » — ciel éclatant, horizon franc, sol noir
 * profond, un reflet secondaire fin — antialiasée par filtrage de boîte sur la largeur d'un pixel. Les canaux R, V, B
 * lisent la rampe à des phases décalées (dispersion), surtout sur les pentes du biseau. Un halo spéculaire fait
 * lentement le tour de la forme.
 *
 * Choix du rendu : UN canvas PAR ÉLÉMENT, posé dans l'élément (position absolue, z-index −1 dans un contexte isolé),
 * mais un seul appareil, un seul pipeline, une seule boucle, un seul encodeur et une seule soumission par image pour
 * tous les éléments visibles (IntersectionObserver). Un canvas partagé plein écran était l'autre option ; il a été
 * écarté parce qu'il dessine PAR-DESSUS la page : il aurait fallu repeindre dans le shader le libellé des boutons
 * pleins et des badges (le contenu DOM ne peut pas passer au-dessus d'un canvas fixe sans passer aussi au-dessus de
 * tout le reste), il aurait recouvert les modales et menus posés sur un bouton, ignoré le rognage des conteneurs à
 * défilement, et il se redessine une image après le défilement composité (le chrome « nage » à côté de son bouton).
 * Le canvas dans l'élément défile avec lui, se range sous son contenu, et ne coûte qu'une petite chaîne d'images.
 *
 * Sans WebGPU : un dégradé CSS conique / linéaire métallisé, statique. Mouvement réduit : une image fixe (pas
 * d'écoulement, halo posé), redessinée seulement au redimensionnement.
 */
import { getDevice, onDeviceLost } from "../components/device.ts";

/* ───────────────────────── Fonctions pures (testées sous Node) ───────────────────────── */

export type Teinte = { sombre: [number, number, number]; clair: [number, number, number]; dispersion: number; css: [string, string, string] };
/** Les préréglages : la couleur du « sol » (sombre), du « ciel » (clair), la dispersion chromatique, et le repli CSS. */
export const PRESETS: Record<"chromatique" | "argent" | "or" | "cuivre" | "noir", Teinte> = {
  chromatique: { sombre: [0.02, 0.025, 0.04], clair: [0.97, 0.98, 1.0], dispersion: 0.045, css: ["#2a2d33", "#9aa1ab", "#f7f9fc"] },
  argent: { sombre: [0.035, 0.035, 0.04], clair: [0.95, 0.955, 0.96], dispersion: 0.012, css: ["#2c2d30", "#a3a6aa", "#f4f5f6"] },
  or: { sombre: [0.17, 0.085, 0.01], clair: [1.0, 0.88, 0.52], dispersion: 0.012, css: ["#5a3a0a", "#c99a3b", "#ffe7a6"] },
  cuivre: { sombre: [0.14, 0.04, 0.02], clair: [1.0, 0.72, 0.55], dispersion: 0.014, css: ["#4a1d10", "#b8664a", "#ffd2bb"] },
  noir: { sombre: [0.0, 0.0, 0.006], clair: [0.6, 0.61, 0.64], dispersion: 0.02, css: ["#050506", "#3a3b3f", "#9a9ca2"] },
};
export type NomPreset = keyof typeof PRESETS;
export const presetDe = (v: string | null | undefined): NomPreset => (v && v in PRESETS ? (v as NomPreset) : "chromatique");

export type Forme = "anneau" | "plein" | "cercle" | "disque";
export const formeDe = (v: string | null | undefined): Forme => (v === "plein" || v === "cercle" || v === "disque" ? v : "anneau");

/** La rampe « chrome » (la même que dans le shader) : ciel, horizon franc, sol noir, reflet secondaire fin. */
export function rampe(x: number) {
  const g = x - Math.floor(x);
  if (g < 0.36) return 1 + (0.66 - 1) * (g / 0.36);
  if (g < 0.7) return 0.035 + (0.16 - 0.035) * ((g - 0.36) / 0.34);
  if (g < 0.76) return 0.92;
  return 0.22 + (0.5 - 0.22) * ((g - 0.76) / 0.24);
}
/** Le plafond de la rampe à l'intérieur d'un badge (le texte doit rester lisible dessus) : v → 0,05 + 0,22 v. */
export const BADGE_PLAFOND = 0.05 + 0.22 * 1;

/** Luminance relative WCAG d'une couleur sRGB (0–1). */
export function luminance([r, g, b]: readonly number[]) {
  const l = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * l(r!) + 0.7152 * l(g!) + 0.0722 * l(b!);
}
/** Rapport de contraste WCAG entre deux couleurs sRGB. */
export function contraste(a: readonly number[], b: readonly number[]) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Le texte des badges. */
export const BADGE_TEXTE: [number, number, number] = [0.965, 0.965, 0.955];

/** La position du halo sur la forme (même formule que le shader), relative au centre, en px CSS. */
export function posHalo(angle: number, hw: number, hh: number): [number, number] {
  return [Math.cos(angle) * hw * 0.85, Math.sin(angle) * hh * 0.85];
}
/** L'angle du halo à l'instant t (s) : un tour lent, propre à chaque élément (graine). Mouvement réduit : posé en haut à gauche. */
export const angleHalo = (t: number, graine: number, reduit: boolean) => (reduit ? -2.3 : -2.3 + t * 0.42 + graine * 6.283);

/**
 * La lueur reçue par un voisin : où (en % de sa boîte) et combien (0–1), d'après la position du halo de la source
 * (coordonnées de page) et la boîte du voisin. Plus fort quand le halo est du côté du voisin et proche de lui.
 */
export function lueurVoisin(
  halo: [number, number],
  centreSource: [number, number],
  voisin: { x: number; y: number; w: number; h: number },
  force: number,
): { x: number; y: number; a: number } {
  const px = Math.min(voisin.x + voisin.w, Math.max(voisin.x, halo[0]));
  const py = Math.min(voisin.y + voisin.h, Math.max(voisin.y, halo[1]));
  const dist = Math.hypot(px - halo[0], py - halo[1]);
  const cx = voisin.x + voisin.w / 2;
  const cy = voisin.y + voisin.h / 2;
  const hx = halo[0] - centreSource[0];
  const hy = halo[1] - centreSource[1];
  const vx = cx - centreSource[0];
  const vy = cy - centreSource[1];
  const face = Math.max(0, (hx * vx + hy * vy) / (Math.hypot(hx, hy) * Math.hypot(vx, vy) || 1));
  const a = Math.max(0, Math.min(1, force * Math.exp(-dist / 70) * (0.25 + 0.75 * face)));
  return { x: voisin.w ? ((px - voisin.x) / voisin.w) * 100 : 50, y: voisin.h ? ((py - voisin.y) / voisin.h) * 100 : 50, a };
}

/* ───────────────────────── CSS (y compris le repli sans WebGPU) ───────────────────────── */

const CSS = `
.metal-on { isolation: isolate; }
.metal-canvas { position: absolute !important; z-index: -1 !important; pointer-events: none; display: block; margin: 0; padding: 0; border: 0; max-width: none !important; }
.metal-gpu[data-metal-texte] { color: transparent !important; -webkit-text-fill-color: transparent !important; }
.metal-gpu[data-metal-texte]::selection, .metal-gpu[data-metal-texte] ::selection { background: rgba(120, 150, 255, 0.35); }
:where([data-metal-badge]) { display: inline-block; padding: 0.28em 0.8em; border-radius: 999px; font-weight: 650; font-size: 0.78em; letter-spacing: 0.04em; line-height: 1.2; }
[data-metal-badge] { color: rgb(246 246 244) !important; text-shadow: 0 1px 1px rgba(0, 0, 0, 0.55); }
:where([data-metal-texte]) { display: inline-block; }

/* Repli sans WebGPU : un métal CSS statique, propre, dans les couleurs du préréglage. */
.metal-repli { --metal-g: conic-gradient(from 215deg, var(--m-c), var(--m-b) 9%, var(--m-a) 17%, var(--m-c) 27%, var(--m-b) 40%, var(--m-a) 52%, var(--m-c) 63%, var(--m-b) 76%, var(--m-a) 88%, var(--m-c)); }
.metal-repli:not([data-metal-texte])::before { content: ""; position: absolute; inset: calc(-1 * var(--m-bord, 0px)); border-radius: inherit; z-index: -1; pointer-events: none; background: var(--metal-g); }
.metal-repli.metal-anneau::before { padding: var(--m-ep, 3px); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }
.metal-repli.metal-rond::before { border-radius: 50%; }
.metal-repli[data-metal-badge] { background: linear-gradient(180deg, #3a3c41, #141518 55%, #24262a); }
.metal-repli[data-metal-badge]::before { padding: 1.5px; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }
.metal-repli[data-metal-texte] { background: linear-gradient(180deg, var(--m-c) 0%, var(--m-b) 44%, var(--m-a) 50%, var(--m-b) 68%, var(--m-c) 100%); -webkit-background-clip: text; background-clip: text; color: transparent !important; -webkit-text-fill-color: transparent; }

/* Le reflet reçu par un voisin. */
.metal-reflet { isolation: isolate; }
.metal-reflet::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(circle at var(--metal-reflet-x, 0%) var(--metal-reflet-y, 50%), var(--metal-reflet-c, rgba(255,255,255,.9)), transparent 70%); z-index: -1;
  opacity: var(--metal-reflet-a, 0); mix-blend-mode: screen; }
`;
let cssPose = false;
function poserCss() {
  if (cssPose) return;
  cssPose = true;
  const st = document.createElement("style");
  st.dataset.presseMetal = "";
  st.textContent = CSS;
  document.head.append(st);
}

/* ───────────────────────── Shader ───────────────────────── */

export const WGSL = /* wgsl */ `
struct U {
  a: vec4f,      // largeur, hauteur du canvas (px appareil), dpr, marge (px appareil)
  b: vec4f,      // demi-largeur, demi-hauteur de la forme, rayon, épaisseur (px appareil)
  c: vec4f,      // forme (0 anneau, 1 plein, 2 texte, 3 badge), cercle, ombre intérieure, force
  d: vec4f,      // temps (s), angle du halo, influence du pointeur (0–1), graine
  e: vec4f,      // pointeur x, y (px appareil, repère du canvas), dispersion, largeur du biseau du texte (px appareil)
  sombre: vec4f,
  clair: vec4f,
  f: vec4f,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var masque: texture_2d<f32>;

struct VO { @builtin(position) pos: vec4f, @location(0) px: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let c = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VO;
  o.pos = vec4f(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);
  o.px = c * u.a.xy;
  return o;
}

fn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn bruit(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = mix(hash(i), hash(i + vec2f(1.0, 0.0)), w.x);
  let b = mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), w.x);
  return mix(a, b, w.y) * 2.0 - 1.0;
}
// La rampe chrome : ciel éclatant qui descend vers le gris clair, horizon franc, sol noir profond, un reflet
// secondaire fin et blanc, un gris moyen qui remonte vers le ciel.
fn rampe(x: f32) -> f32 {
  let g = fract(x);
  if (g < 0.36) { return mix(1.0, 0.66, g / 0.36); }
  if (g < 0.70) { return mix(0.035, 0.16, (g - 0.36) / 0.34); }
  if (g < 0.76) { return 0.92; }
  return mix(0.22, 0.5, (g - 0.76) / 0.24);
}
// Filtrage de boîte sur la largeur d'un pixel : bords francs, mais antialiasés.
fn rampeAA(x: f32, w: f32) -> f32 {
  return 0.25 * (rampe(x - 1.5 * w) + rampe(x - 0.5 * w) + rampe(x + 0.5 * w) + rampe(x + 1.5 * w));
}

// La forme en un point : (couverture, hauteur du biseau 0–1, profondeur normalisée, distance signée px appareil).
fn forme(p: vec2f) -> vec4f {
  let c = u.a.xy * 0.5;
  let q = p - c;
  let hw = u.b.x;
  let hh = u.b.y;
  let L = max(min(hw, hh), 1.0);
  let f = u32(u.c.x + 0.5);
  let th = max(u.b.w, 0.5);
  var d = sdrb(q, vec2f(hw, hh), min(u.b.z, L));
  if (u.c.y > 0.5) { d = length(q) - L; }
  if (f == 2u) {
    let mk = textureSampleLevel(masque, samp, p / u.a.xy, 0.0);
    return vec4f(mk.r, mk.g, 0.9 * mk.g, (0.5 - mk.r) * 2.0);
  }
  var cov = clamp(0.5 - d, 0.0, 1.0);
  if (f == 0u) {
    cov = cov * clamp(0.5 + d + th, 0.0, 1.0);
    return vec4f(cov, sin(3.14159 * clamp(-d / th, 0.0, 1.0)), -d / L, d);
  }
  let bev = biseau(L, th, f);
  let t = clamp(-d / bev, 0.0, 1.0);
  return vec4f(cov, 1.0 - (1.0 - t) * (1.0 - t), -d / L, d);
}
fn biseau(L: f32, th: f32, f: u32) -> f32 {
  if (f == 2u) { return u.e.w; }
  if (f == 0u) { return th; }
  return select(max(th * 2.0, L * 0.5), th * 1.6, f == 3u);
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let dpr = u.a.z;
  let p = i.px;
  let c = u.a.xy * 0.5;
  let q = p - c;
  let hw = u.b.x;
  let hh = u.b.y;
  let L = max(min(hw, hh), 1.0);
  let fm = u32(u.c.x + 0.5);
  let th = max(u.b.w, 0.5);
  let force = u.c.w;
  let bev = biseau(L, th, fm);

  let F = forme(p);
  let cov = F.x;
  let hgt = F.y;
  // La profondeur, arrondie au sommet (sinon le cône de la distance au centre d'un disque y dessine un point).
  let pp = clamp(F.z, -1.0, 1.0);
  let prof = select(pp, pp * (2.0 - pp), pp > 0.0);
  let d = F.w;
  // La pente du biseau par différences finies explicites (les dérivées d'écran, calculées par quad de 2 × 2 pixels,
  // laissaient des blocs), normalisée par sa largeur : de l'ordre de 1 sur le bord, 0 sur un plat.
  let e = 1.0;
  let sl = vec2f(forme(p + vec2f(e, 0.0)).y - forme(p - vec2f(e, 0.0)).y, forme(p + vec2f(0.0, e)).y - forme(p - vec2f(0.0, e)).y) * (0.5 * bev / e);
  var dedans = 0.0; // badge : la zone apaisée sous le texte
  if (fm == 3u) { dedans = smoothstep(0.7, 1.0, clamp(-d / bev, 0.0, 1.0)); }

  // Le champ des bandes.
  let t = u.d.x;
  let s = q / L;
  let ps = (u.e.xy - c) / L;
  let pd = s - ps;
  let pf = exp(-dot(pd, pd) * 1.3) * u.d.z;
  let s2 = s - pd * pf * 0.5; // le pointeur tire les bandes vers lui
  let g0 = u.d.w * 17.0;
  let n = bruit(s2 * 1.2 + vec2f(t * 0.13 + g0, -t * 0.09)) + 0.5 * bruit(s2 * 2.6 + vec2f(-t * 0.07, t * 0.05 - g0));
  // Un anneau fin : sa pente module la lumière (un tube) plutôt que de décaler les bandes, qui y deviendraient des paillettes.
  let pente = select(0.42, 0.1, fm == 0u);
  let calme = select(1.0, 0.55, fm == 2u); // le texte : moins de bruit, sinon les lettres se brouillent
  var f = s2.y * 0.55 + s2.x * 0.2 + prof * 1.1 + n * (0.14 + 0.26 * force) * calme + dot(sl, vec2f(0.3, 0.9)) * pente + pf * 0.55 + t * 0.05 * force;
  f = f * 1.25;
  let w = max(fwidth(f) * 0.7, 1e-4);

  // Dispersion : les trois canaux lisent la rampe à des phases décalées, davantage sur les pentes.
  let disp = u.e.z * (0.35 + 0.65 * min(length(sl), 1.2)) * (0.4 + 0.6 * force);
  var v = vec3f(rampeAA(f - disp, w), rampeAA(f, w), rampeAA(f + disp, w));
  v = mix(v, vec3f(0.05) + v * 0.22, dedans);
  var col = mix(u.sombre.rgb, u.clair.rgb, v);
  if (fm == 0u) { col = col * (0.62 + 0.48 * hgt); }

  // Le halo qui fait le tour de la forme.
  let a = u.d.y;
  let hp = vec2f(cos(a) * hw * 0.85, sin(a) * hh * 0.85);
  let hd = length(q - hp) / (L * 0.8 + 8.0 * dpr);
  let halo = exp(-hd * hd * 2.2) * (0.35 + 0.55 * force);
  col = col + u.clair.rgb * halo * 0.7 * (1.0 - dedans);

  // Arêtes : un filet sombre au bord extérieur (et intérieur pour l'anneau) détache le métal du fond.
  if (fm != 2u) {
    let e1 = smoothstep(0.0, 1.3 * dpr, -d);
    var e2 = 1.0;
    if (fm == 0u) { e2 = smoothstep(0.0, 1.3 * dpr, d + th); }
    col = col * mix(0.5, 1.0, min(e1, e2));
  }
  // Le texte : un filet sombre au bord des lettres, qui les détache d'un fond clair.
  if (fm == 2u) { col = col * mix(0.5, 1.0, smoothstep(0.18, 0.5, hgt)); }
  col = min(col, vec3f(1.0));
  var out = vec4f(col * cov, cov);

  // Ombre intérieure : sous l'anneau, sur le fond de l'élément ; ou au bord d'une forme pleine.
  if (u.c.z > 0.5) {
    if (fm == 0u) {
      let di = -(d + th);
      let sa = 0.38 * (1.0 - smoothstep(0.0, 10.0 * dpr, di)) * clamp(0.5 + di, 0.0, 1.0);
      out = out + vec4f(0.0, 0.0, 0.0, sa) * (1.0 - out.a);
    } else if (fm != 2u) {
      out = vec4f(out.rgb * (1.0 - 0.35 * (1.0 - smoothstep(0.0, 6.0 * dpr, -d))), out.a);
    }
  }
  // Une lueur du halo déborde un peu autour de la forme.
  if (fm != 2u) {
    let gl = halo * 0.22 * exp(-max(d, 0.0) / (5.0 * dpr)) * (1.0 - cov);
    out = out + vec4f(u.clair.rgb * gl, gl);
  }
  return out;
}
`;

/* ───────────────────────── GPU partagé ───────────────────────── */

type Partage = { device: GPUDevice; layout: GPUBindGroupLayout; mod: GPUShaderModule; pipes: Map<GPUTextureFormat, GPURenderPipeline>; samp: GPUSampler; vide: GPUTexture };
let partage: Partage | null = null;
function partageDe(device: GPUDevice): Partage {
  if (partage && partage.device === device) return partage;
  const mod = device.createShaderModule({ code: WGSL, label: "presse-metal" });
  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ],
  });
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  const vide = device.createTexture({ size: [1, 1], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  device.queue.writeTexture({ texture: vide }, new Uint8Array([0, 0, 0, 255]), { bytesPerRow: 4 }, [1, 1]);
  partage = { device, layout, mod, pipes: new Map(), samp, vide };
  return partage;
}
function pipeDe(s: Partage, format: GPUTextureFormat) {
  let p = s.pipes.get(format);
  if (!p) {
    const blend: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } };
    p = s.device.createRenderPipeline({
      label: `presse-metal-${format}`,
      layout: s.device.createPipelineLayout({ bindGroupLayouts: [s.layout] }),
      vertex: { module: s.mod, entryPoint: "vs" },
      fragment: { module: s.mod, entryPoint: "fs", targets: [{ format, blend }] },
      primitive: { topology: "triangle-list" },
    });
    s.pipes.set(format, p);
  }
  return p;
}

/** Mode banc d'essai (`globalThis.__presseBanc = true` ou `?presse-banc`) : pas de contexte WebGPU à l'écran ; `capturerMetal(el)` dessine hors écran. */
export const modeBanc = () => typeof globalThis !== "undefined" && (!!(globalThis as { __presseBanc?: boolean }).__presseBanc || (typeof location !== "undefined" && /[?&]presse-banc\b/.test(location.search)));

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

/* ───────────────────────── Un élément métal ───────────────────────── */

const UF = 32;
type Genre = "bord" | "texte" | "badge";
type Metal = {
  el: HTMLElement;
  genre: Genre;
  preset: NomPreset;
  forme: Forme;
  force: number;
  ep: number;
  ombre: boolean;
  nom: string;
  graine: number;
  visible: boolean;
  /** Boîte (bordure comprise), px CSS, en coordonnées de la fenêtre ; relue au défilement / redimensionnement. */
  rect: { x: number; y: number; w: number; h: number };
  rayon: number;
  marge: number;
  dpr: number;
  bordG: number;
  bordH: number;
  canvas: HTMLCanvasElement | null;
  ctx: GPUCanvasContext | null;
  ubuf: GPUBuffer | null;
  bind: GPUBindGroup | null;
  masque: GPUTexture | null;
  biseau: number;
  data: Float32Array;
  aMesurer: boolean;
  aMasquer: boolean;
  angle: number;
};

const els = new Map<HTMLElement, Metal>();
const reflets = new Set<HTMLElement>();
let gpu: Partage | null = null;
let format: GPUTextureFormat = "bgra8unorm";
let raf = 0;
let last = 0;
let temps = 0;
let fige = false;
let rectsSales = true;
let ptr: { x: number; y: number } | null = null;
let reduit = false;
let io: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;
let arme = false;

const SEL = "[data-metal], [data-metal-texte], [data-metal-badge]";
const num = (s: string | undefined, d: number) => {
  const n = Number.parseFloat(s ?? "");
  return Number.isFinite(n) ? n : d;
};

function lire(m: Metal) {
  const d = m.el.dataset;
  m.genre = d.metalTexte !== undefined ? "texte" : d.metalBadge !== undefined ? "badge" : "bord";
  m.preset = presetDe(m.genre === "texte" ? d.metalTexte : m.genre === "badge" ? d.metalBadge : d.metal);
  m.forme = m.genre === "bord" ? formeDe(d.metalForme) : "plein";
  m.force = Math.min(1, Math.max(0, num(d.metalForce, 1)));
  m.ep = Math.max(1, num(d.metalEpaisseur, m.genre === "badge" ? 1.5 : 3));
  m.ombre = d.metalOmbre !== undefined;
  m.nom = d.metalNom ?? "";
  const t = PRESETS[m.preset].css;
  const st = m.el.style;
  st.setProperty("--m-a", t[0]);
  st.setProperty("--m-b", t[1]);
  st.setProperty("--m-c", t[2]);
  st.setProperty("--m-ep", `${m.ep}px`);
  m.el.classList.toggle("metal-anneau", m.forme === "anneau" || m.forme === "cercle");
  m.el.classList.toggle("metal-rond", m.forme === "cercle" || m.forme === "disque");
  m.aMesurer = true;
  m.aMasquer = m.genre === "texte";
}

function armer(el: HTMLElement) {
  if (els.has(el)) return;
  poserCss();
  const cs = getComputedStyle(el);
  if (cs.position === "static") el.style.position = "relative";
  if (el.hasAttribute("data-metal-texte") && cs.display === "inline") el.style.display = "inline-block";
  el.classList.add("metal-on", "metal-repli");
  const m: Metal = {
    el,
    genre: "bord",
    preset: "chromatique",
    forme: "anneau",
    force: 1,
    ep: 3,
    ombre: false,
    nom: "",
    graine: Math.random(),
    visible: true,
    rect: { x: 0, y: 0, w: 0, h: 0 },
    rayon: 0,
    marge: 6,
    dpr: 1,
    bordG: 0,
    bordH: 0,
    canvas: null,
    ctx: null,
    ubuf: null,
    bind: null,
    masque: null,
    biseau: 2,
    data: new Float32Array(UF),
    aMesurer: true,
    aMasquer: false,
    angle: 0,
  };
  lire(m);
  els.set(el, m);
  io?.observe(el);
  ro?.observe(el);
  if (gpu) brancher(m);
  reveiller();
}

function armerReflet(el: HTMLElement) {
  if (reflets.has(el)) return;
  poserCss();
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.classList.add("metal-reflet");
  reflets.add(el);
  reveiller();
}

/* ── GPU ── */
function brancher(m: Metal) {
  const s = gpu!;
  const c = m.canvas ?? document.createElement("canvas");
  c.className = "metal-canvas";
  c.setAttribute("aria-hidden", "true");
  if (!c.isConnected) m.el.append(c);
  m.canvas = c;
  m.ctx = modeBanc() ? null : c.getContext("webgpu");
  m.ctx?.configure({ device: s.device, format, alphaMode: "premultiplied" });
  m.ubuf = s.device.createBuffer({ size: UF * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  m.masque?.destroy();
  m.masque = null;
  lier(m);
  m.el.classList.remove("metal-repli");
  m.el.classList.add("metal-gpu");
  m.aMesurer = true;
  m.aMasquer = m.genre === "texte";
}
function lier(m: Metal) {
  const s = gpu!;
  m.bind = s.device.createBindGroup({
    layout: s.layout,
    entries: [
      { binding: 0, resource: { buffer: m.ubuf! } },
      { binding: 1, resource: s.samp },
      { binding: 2, resource: (m.masque ?? s.vide).createView() },
    ],
  });
}
function debrancher(m: Metal) {
  try {
    m.ctx?.unconfigure();
  } catch {
    /* perdu */
  }
  m.ubuf?.destroy();
  m.masque?.destroy();
  m.canvas?.remove();
  Object.assign(m, { canvas: null, ctx: null, ubuf: null, bind: null, masque: null });
  m.el.classList.remove("metal-gpu");
  m.el.classList.add("metal-repli");
}

/** Mesure (au redimensionnement seulement) : boîte, rayon, bordures, taille du canvas. */
function mesurer(m: Metal) {
  m.aMesurer = false;
  const el = m.el;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  m.rect = { x: r.left, y: r.top, w: r.width, h: r.height };
  m.bordG = el.clientLeft;
  m.bordH = el.clientTop;
  const rr = cs.borderTopLeftRadius.split(/\s+/)[0] ?? "0";
  const n = Number.parseFloat(rr) || 0;
  m.rayon = Math.min(rr.endsWith("%") ? (n / 100) * Math.min(r.width, r.height) : n, r.width / 2, r.height / 2);
  // Le texte : les glyphes débordent souvent la boîte (line-height serré) ; la marge suit la taille de police.
  m.marge = m.genre === "texte" ? Math.ceil((Number.parseFloat(cs.fontSize) || 16) * 0.35) + 4 : 10;
  m.dpr = Math.min(devicePixelRatio || 1, 2);
  m.el.style.setProperty("--m-bord", `${m.bordG}px`);
  const c = m.canvas;
  if (!c) return;
  Object.assign(c.style, { left: `${-m.bordG - m.marge}px`, top: `${-m.bordH - m.marge}px`, width: `${r.width + 2 * m.marge}px`, height: `${r.height + 2 * m.marge}px` });
  const cw = Math.max(1, Math.round((r.width + 2 * m.marge) * m.dpr));
  const ch = Math.max(1, Math.round((r.height + 2 * m.marge) * m.dpr));
  if (c.width !== cw || c.height !== ch) {
    c.width = cw;
    c.height = ch;
    if (m.genre === "texte") m.aMasquer = true;
  }
}

/**
 * Le masque d'un texte métal : les lettres rendues (canvas 2D, police calculée de l'élément, chaque caractère posé
 * là où le DOM le place) en R, et les mêmes, floutées, en V : une distance approchée qui donne le biseau.
 */
function masquer(m: Metal) {
  m.aMasquer = false;
  const s = gpu;
  const c = m.canvas;
  if (!s || !c) return;
  const W = c.width;
  const H = c.height;
  const k = m.dpr;
  const cs = getComputedStyle(m.el);
  const taille = Number.parseFloat(cs.fontSize) || 16;
  const net = document.createElement("canvas");
  net.width = W;
  net.height = H;
  const g = net.getContext("2d")!;
  g.fillStyle = "#fff";
  g.textBaseline = "alphabetic";
  g.font = `${cs.fontStyle} ${cs.fontWeight} ${taille * k}px ${cs.fontFamily}`;
  if ("letterSpacing" in g) (g as unknown as { letterSpacing: string }).letterSpacing = "0px";
  const r0 = m.el.getBoundingClientRect();
  const ox = r0.left - m.marge;
  const oy = r0.top - m.marge;
  const met = g.measureText("Hg");
  const asc = met.fontBoundingBoxAscent / k;
  const desc = met.fontBoundingBoxDescent / k;
  const walker = document.createTreeWalker(m.el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent ?? "";
    for (let i = 0; i < t.length; i++) {
      const ch = t[i]!;
      if (/\s/.test(ch)) continue;
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      const rc = range.getBoundingClientRect();
      if (!rc.width) continue;
      // La ligne de base : la boîte du caractère est l'aire de contenu (ascendante + descendante) de la police.
      const base = rc.top + (rc.height - (asc + desc)) / 2 + asc;
      g.fillText(ch, (rc.left - ox) * k, (base - oy) * k);
    }
  }
  // Le flou se fait en flottant (trois flous de boîte séparables ≈ un gaussien) : un flou du canvas 2D, quantifié sur
  // 8 bits, donnait des pentes en escalier, donc un grain dans les lettres.
  const flou = Math.max(1.5, taille * 0.09 * k);
  const a = g.getImageData(0, 0, W, H).data;
  const net01 = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) net01[i] = a[i * 4 + 3]! / 255;
  const fl = flouBoite3(net01, W, H, Math.max(1, Math.round(flou * 0.9)));
  const px = new Uint16Array(W * H * 4);
  const un = demi(1);
  for (let i = 0; i < W * H; i++) {
    px[i * 4] = demi(net01[i]!);
    px[i * 4 + 1] = demi(Math.min(1, fl[i]! * 1.25));
    px[i * 4 + 3] = un;
  }
  m.masque?.destroy();
  m.masque = s.device.createTexture({ size: [W, H], format: "rgba16float", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  s.device.queue.writeTexture({ texture: m.masque }, px, { bytesPerRow: W * 8 }, [W, H]);
  m.biseau = flou * 2;
  lier(m);
}

/** Un nombre en demi-flottant IEEE 754 (16 bits), pour une texture rgba16float. */
function demi(v: number) {
  if (v === 0) return 0;
  const sgn = v < 0 ? 0x8000 : 0;
  v = Math.abs(v);
  let e = Math.floor(Math.log2(v));
  if (e < -14) return sgn | Math.round(v / 2 ** -24);
  if (e > 15) return sgn | 0x7c00;
  let mant = Math.round((v / 2 ** e - 1) * 1024);
  if (mant === 1024) ((mant = 0), e++);
  return sgn | ((e + 15) << 10) | mant;
}
/** Trois flous de boîte séparables de rayon r (≈ un flou gaussien), en flottant. */
function flouBoite3(src: Float32Array, W: number, H: number, r: number) {
  let a = Float32Array.from(src);
  let b = new Float32Array(W * H);
  const passe = (from: Float32Array, to: Float32Array, horiz: boolean) => {
    const n = horiz ? W : H;
    const lignes = horiz ? H : W;
    const inv = 1 / (2 * r + 1);
    for (let l = 0; l < lignes; l++) {
      const at = (i: number) => (horiz ? l * W + i : i * W + l);
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += from[at(Math.min(n - 1, Math.max(0, i)))]!;
      for (let i = 0; i < n; i++) {
        to[at(i)] = acc * inv;
        acc += from[at(Math.min(n - 1, i + r + 1))]! - from[at(Math.max(0, i - r))]!;
      }
    }
  };
  for (let k = 0; k < 3; k++) {
    passe(a, b, true);
    passe(b, a, false);
  }
  return a;
}

function remplir(m: Metal) {
  const d = m.data;
  const k = m.dpr;
  const c = m.canvas!;
  const T = PRESETS[m.preset];
  const hw = (m.rect.w / 2) * k;
  const hh = (m.rect.h / 2) * k;
  const rond = m.forme === "cercle" || m.forme === "disque";
  m.angle = angleHalo(temps, m.graine, reduit);
  d[0] = c.width;
  d[1] = c.height;
  d[2] = k;
  d[3] = m.marge * k;
  d[4] = hw;
  d[5] = hh;
  d[6] = m.rayon * k;
  d[7] = m.ep * k;
  d[8] = m.genre === "texte" ? 2 : m.genre === "badge" ? 3 : m.forme === "plein" || m.forme === "disque" ? 1 : 0;
  d[9] = rond ? 1 : 0;
  d[10] = m.ombre ? 1 : 0;
  d[11] = m.force;
  d[12] = reduit ? 0 : temps;
  d[13] = m.angle;
  // Le pointeur : son influence décroît avec sa distance à la boîte.
  let infl = 0;
  let px = -1e4;
  let py = -1e4;
  if (ptr && !reduit) {
    const r = m.rect;
    const dx = Math.max(r.x - ptr.x, 0, ptr.x - (r.x + r.w));
    const dy = Math.max(r.y - ptr.y, 0, ptr.y - (r.y + r.h));
    infl = m.force * Math.exp(-Math.hypot(dx, dy) / 90);
    px = (ptr.x - r.x + m.marge) * k;
    py = (ptr.y - r.y + m.marge) * k;
  }
  d[14] = infl;
  d[15] = m.graine;
  d[16] = px;
  d[17] = py;
  d[18] = T.dispersion;
  d[19] = m.biseau;
  d.set(T.sombre, 20);
  d.set(T.clair, 24);
}

/* ── La boucle ── */
function reveiller() {
  if (!raf && typeof requestAnimationFrame === "function") {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}
function frame(now: number) {
  raf = 0;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (!fige && !reduit) temps += dt;
  // Lectures d'abord (boîtes), écritures ensuite (variables des reflets) : une seule mise en page par image, au plus.
  const vis = [...els.values()].filter((m) => m.visible && m.el.isConnected);
  for (const m of vis) if (m.aMesurer) mesurer(m);
  if (rectsSales) {
    rectsSales = false;
    for (const m of els.values()) {
      if (!m.visible) continue;
      const r = m.el.getBoundingClientRect();
      m.rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    for (const el of reflets) (el as HTMLElement & { __r?: DOMRect }).__r = el.getBoundingClientRect();
  }
  for (const m of els.values()) m.angle = angleHalo(temps, m.graine, reduit);
  if (gpu) dessiner(vis);
  majReflets();
  const anime = !reduit && !document.hidden && vis.length > 0;
  if (anime || fige) reveiller();
}

function dessiner(vis: Metal[]) {
  const s = gpu!;
  const enc = s.device.createCommandEncoder();
  let n = 0;
  for (const m of vis) {
    if (!m.ctx || !m.bind || m.rect.w < 1) continue;
    if (m.aMasquer) masquer(m);
    remplir(m);
    s.device.queue.writeBuffer(m.ubuf!, 0, m.data);
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: m.ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    pass.setPipeline(pipeDe(s, format));
    pass.setBindGroup(0, m.bind);
    pass.draw(3);
    pass.end();
    n++;
  }
  // Un seul encodeur, une seule soumission pour tous les éléments visibles.
  if (n) s.device.queue.submit([enc.finish()]);
  else if (modeBanc()) for (const m of vis) if (m.aMasquer && m.canvas) masquer(m);
}

function majReflets() {
  if (!reflets.size) return;
  const parNom = new Map<string, Metal>();
  for (const m of els.values()) if (m.nom) parNom.set(m.nom, m);
  for (const el of reflets) {
    const src = parNom.get(el.dataset.metalReflet ?? "");
    const r = (el as HTMLElement & { __r?: DOMRect }).__r;
    if (!src || !r) continue;
    const sr = src.rect;
    const centre: [number, number] = [sr.x + sr.w / 2, sr.y + sr.h / 2];
    const [hx, hy] = posHalo(src.angle, sr.w / 2, sr.h / 2);
    const l = lueurVoisin([centre[0] + hx, centre[1] + hy], centre, { x: r.left, y: r.top, w: r.width, h: r.height }, src.force);
    const T = PRESETS[src.preset];
    // Le chromatique irise sa lueur : la teinte tourne avec le halo.
    const teinte =
      src.preset === "chromatique"
        ? `hsl(${Math.round(((src.angle * 180) / Math.PI) % 360)} 90% 78%)`
        : `rgb(${T.clair.map((v) => Math.round(v * 255)).join(" ")})`;
    const st = el.style;
    st.setProperty("--metal-reflet-x", `${l.x.toFixed(1)}%`);
    st.setProperty("--metal-reflet-y", `${l.y.toFixed(1)}%`);
    st.setProperty("--metal-reflet-a", (l.a * 0.85).toFixed(3));
    st.setProperty("--metal-reflet-c", teinte);
  }
}

/* ── Banc d'essai ── */
/** Fige (ou relâche) le temps du métal. */
export function figerMetal(on: boolean) {
  fige = on;
  reveiller();
}
/** Pose le temps du métal (s) et la position du pointeur (coordonnées de fenêtre, ou null). */
export function poserMetal(t: number, pointeur?: { x: number; y: number } | null) {
  temps = t;
  if (pointeur !== undefined) ptr = pointeur;
  reveiller();
}
/** Dessine un élément métal hors écran (son état courant) et rend un PNG ; en mode banc, l'image est aussi posée dans son canvas. */
export async function capturerMetal(el: HTMLElement, fond?: string): Promise<string | null> {
  const m = els.get(el);
  const s = gpu;
  if (!m || !s || !m.canvas || !m.bind) return null;
  if (m.aMesurer) mesurer(m);
  const r = el.getBoundingClientRect();
  m.rect = { x: r.left, y: r.top, w: r.width, h: r.height };
  if (m.aMasquer) masquer(m);
  remplir(m);
  s.device.queue.writeBuffer(m.ubuf!, 0, m.data);
  const W = m.canvas.width;
  const H = m.canvas.height;
  const tex = s.device.createTexture({ size: [W, H], format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  const enc = s.device.createCommandEncoder();
  const pass = enc.beginRenderPass({ colorAttachments: [{ view: tex.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
  pass.setPipeline(pipeDe(s, "rgba8unorm"));
  pass.setBindGroup(0, m.bind);
  pass.draw(3);
  pass.end();
  s.device.queue.submit([enc.finish()]);
  const url = await textureEnPng(s.device, tex, W, H, fond);
  if (modeBanc()) {
    const im = new Image();
    im.src = fond ? await textureEnPng(s.device, tex, W, H) : url;
    await im.decode();
    const g = m.canvas.getContext("2d");
    g?.clearRect(0, 0, W, H);
    g?.drawImage(im, 0, 0);
  }
  tex.destroy();
  majReflets();
  return url;
}
/** Le diagnostic de compilation du shader (banc d'essai). */
export async function compilerMetal(): Promise<string[]> {
  const d = await getDevice();
  const info = await d.createShaderModule({ code: WGSL }).getCompilationInfo();
  return info.messages.map((x) => `${x.type} ${x.lineNum}:${x.linePos} ${x.message}`);
}

/* ── Armement ── */
async function demarrerGpu() {
  try {
    const device = await getDevice();
    // Une perte « destroyed » n'est pas relayée par device.ts : si l'appareil s'en va quand même, tout repasse au
    // repli CSS plutôt que de laisser des lettres transparentes.
    void device.lost.then((info) => {
      if (info.reason !== "destroyed" || !gpu) return;
      for (const m of els.values()) debrancher(m);
      gpu = null;
    });
    gpu = partageDe(device);
    format = navigator.gpu.getPreferredCanvasFormat();
    for (const m of els.values()) brancher(m);
    reveiller();
  } catch {
    /* sans WebGPU : le repli CSS */
  }
}

/** Arme les éléments métal ([data-metal], [data-metal-texte], [data-metal-badge], [data-metal-reflet]) présents et à venir. */
export function initMetal(root: ParentNode = document) {
  if (typeof document === "undefined") return;
  const scan = (r: ParentNode) => {
    if (r instanceof HTMLElement) {
      if (r.matches(SEL)) armer(r);
      if (r.matches("[data-metal-reflet]")) armerReflet(r);
    }
    r.querySelectorAll<HTMLElement>(SEL).forEach(armer);
    r.querySelectorAll<HTMLElement>("[data-metal-reflet]").forEach(armerReflet);
  };
  if (!arme) {
    arme = true;
    reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", (e) => ((reduit = e.matches), reveiller()));
    io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const m = els.get(e.target as HTMLElement);
          if (m) m.visible = e.isIntersecting;
        }
        rectsSales = true;
        reveiller();
      },
      { rootMargin: "80px" },
    );
    ro = new ResizeObserver((es) => {
      for (const e of es) {
        const m = els.get(e.target as HTMLElement);
        if (m) m.aMesurer = true;
      }
      rectsSales = true;
      reveiller();
    });
    const sale = () => ((rectsSales = true), reveiller());
    addEventListener("scroll", sale, { passive: true, capture: true });
    addEventListener("resize", sale);
    addEventListener("pointermove", (e) => ((ptr = { x: e.clientX, y: e.clientY }), reveiller()), { passive: true });
    document.documentElement.addEventListener("pointerleave", () => (ptr = null));
    document.addEventListener("visibilitychange", () => reveiller());
    void document.fonts?.ready.then(() => {
      for (const m of els.values()) ((m.aMesurer = true), (m.aMasquer = m.genre === "texte"));
      reveiller();
    });
    new MutationObserver((ms) => {
      for (const mu of ms) {
        if (mu.type === "childList") {
          for (const n of mu.addedNodes) if (n instanceof HTMLElement && !n.classList.contains("metal-canvas")) scan(n);
          // Le texte d'un élément métal a changé : nouveau masque.
          const t = (mu.target instanceof HTMLElement ? mu.target : mu.target.parentElement)?.closest<HTMLElement>("[data-metal-texte]");
          const m = t && els.get(t);
          if (m) m.aMasquer = m.aMesurer = true;
        } else if (mu.type === "characterData") {
          const t = mu.target.parentElement?.closest<HTMLElement>("[data-metal-texte]");
          const m = t && els.get(t);
          if (m) m.aMasquer = m.aMesurer = true;
        } else if (mu.type === "attributes" && mu.target instanceof HTMLElement) {
          const m = els.get(mu.target);
          if (m) lire(m);
          else if (mu.target.matches(SEL)) armer(mu.target);
          if (mu.target.matches("[data-metal-reflet]")) armerReflet(mu.target);
        }
      }
      reveiller();
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-metal", "data-metal-texte", "data-metal-badge", "data-metal-force", "data-metal-forme", "data-metal-epaisseur", "data-metal-ombre", "data-metal-nom", "data-metal-reflet"],
    });
    onDeviceLost(() => {
      for (const m of els.values()) debrancher(m);
      gpu = null;
      setTimeout(() => void demarrerGpu(), 300);
    });
    void demarrerGpu();
  }
  scan(root);
}
