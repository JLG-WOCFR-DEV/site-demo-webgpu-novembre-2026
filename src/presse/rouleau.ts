/**
 * Presse — « rouleau » : un menu roulant plein écran. Une colonne de très grands titres numérotés qu'on fait défiler
 * verticalement ; derrière le titre courant, une photo en bandeau large dont les bords haut et bas ondulent comme une
 * étoffe tirée, selon la vitesse du défilement (le bandeau se pince d'un côté, s'évase de l'autre, puis rebondit
 * un instant quand on s'arrête).
 *
 *   <nav data-rouleau aria-label="Projets">
 *     <a href="…" data-rouleau-img="./plates/pont.jpg">Pont.</a>
 *     <a href="…"><img src="./plates/lac.jpg" alt="">Lac.</a>       (ou <picture><img></picture>)
 *     …
 *   </nav>
 *
 * Attributs du conteneur :
 *   data-rouleau-hauteur    hauteur du composant (CSS ; défaut 100vh) ;
 *   data-rouleau-largeur    largeur du bandeau, fraction de la largeur (défaut 0,655 ; 0,88 sous 640 px) ;
 *   data-rouleau-decalage   décalage du centre du bandeau vers la droite, fraction de la largeur (défaut 0,03) ;
 *   data-rouleau-ecart      écart entre deux bandeaux, en pas de titre (défaut 1,85 : les images défilent plus vite
 *                           que les titres, les voisines dépassent en haut et en bas comme sur la référence ; 1 :
 *                           chaque bandeau reste collé à son titre) ;
 *   data-rouleau-depart     index du titre centré au départ (défaut 0) ;
 *   data-rouleau-respire    « 0 » : pas de respiration au repos (la boucle s'arrête alors tout à fait) ;
 *   data-rouleau-invite     le texte en bas à droite (défaut « Glisser pour explorer. » ; vide : aucun).
 * Variables CSS : --rouleau-corps (corps des titres), --rouleau-encre (blanc), --rouleau-accent (compteur, focus),
 * --rouleau-trait (chevrons, invite), --rouleau-marge (retrait des titres).
 *
 * Mouvement : glisser vertical (souris, doigt), molette, ↑ ↓ / Page préc. / Page suiv., Début / Fin ; inertie au
 * lâcher puis aimantation (ressort) sur le titre visé ; la liste boucle. Les chevrons sont de vrais boutons.
 * Entrée ou clic sur le titre courant suit le lien ; un clic sur un autre titre l'amène au centre ; un glisser ne
 * suit jamais le lien. Événement `rouleau:change` (detail : { index }) quand le titre au centre change.
 *
 * JS : `initRouleau(root?)` arme ce qui est là et ce qui arrive ; `rouleau(el)` → { aller(index), index(), detruire() }.
 *
 * Rendu : les titres restent du DOM (vrais liens, lus une fois ; le numéro et les commandes sont aria-hidden),
 * placés par transform. Les bandeaux sont dessinés par un canvas WebGPU entre le fond et les titres : un seul appel
 * de dessin, une instance par bandeau visible (3 à 5), chacune un maillage 48 × 16 engendré depuis vertex_index. Le
 * nuanceur de sommets déplace chaque sommet verticalement : dy = −(P·cos πx + S·sin πx) · sin(π/2 · Yn) · pas, où x
 * est l'abscisse dans le bandeau (−½…½), Yn la position verticale à l'écran (−1 en haut, 1 en bas), P le pincement
 * (suit |vitesse|) et S l'asymétrie (suit la vitesse signée), tous deux menés par des ressorts sous-amortis : le
 * tissu traîne et rebondit. Le champ est le même pour tous les bandeaux (un seul tissu) : le bandeau courant se
 * pince, les bords de ses voisins se bombent vers le centre. Les UV sont attachées aux sommets (l'image se déforme
 * avec le tissu) ; cadrage « cover » avec une marge pour le parallaxe ; ombrage d'après la pente et la compression ;
 * bords antialiasés analytiquement. Les images sont dans un texture_2d_array (une taille de calque, mipmaps).
 *
 * Sans WebGPU (ou après trois pertes d'appareil) : chaque bandeau est un <img> en object-fit: cover, sans ondulation,
 * même défilement. Mouvement réduit : ni ondulation ni inertie, aimantation immédiate.
 * La boucle ne tourne que si le composant est visible, l'onglet affiché et que quelque chose bouge (ou respire).
 */
import { getDevice, onDeviceLost } from "../components/device.ts";
import { Ressort, REGLAGES, Vitesse, DECELERATION, projette, oscille, net } from "./gesture.ts";

/* ───────────────────────── Fonctions pures (testées sous Node) ───────────────────────── */

/** Ramène un index (entier ou non) dans [0, n). */
export function boucler(i: number, n: number) {
  if (!(n > 0)) return 0;
  const r = i % n;
  return r < 0 ? r + n : r >= n ? 0 : r;
}
/** L'index entier du titre le plus proche de la position s (bouclé). */
export function indexDe(s: number, n: number) {
  return n > 0 ? boucler(Math.round(s), n) : -1;
}
/** L'écart du titre i à la position s, ramené dans [−n/2, n/2) (liste bouclée). */
export function ecartBoucle(i: number, s: number, n: number) {
  if (!(n > 0)) return 0;
  return boucler(i - s + n / 2, n) - n / 2;
}
/** La position (continue) qui centre le titre i, choisie parmi ses copies au plus près de s. */
export function cibleVers(s: number, i: number, n: number) {
  return s + ecartBoucle(boucler(Math.round(i), n), s, n);
}
/**
 * Aimantation : le titre où s'arrête un lâcher parti de s à la vitesse v (titres/s). On projette le lancer
 * (décélération d'iOS) puis on prend le titre le plus proche du point d'arrivée.
 */
export function cibleAimant(s: number, v: number, rate: number = DECELERATION.rapide) {
  return Math.round(projette(s, v, rate));
}
/** L'inertie d'un lancer, en forme exacte (décélération par ms) : [s, v] après dt secondes. */
export function inertie(s: number, v: number, dt: number, rate = 0.996): [number, number] {
  if (v === 0 || dt <= 0) return [s, v];
  const f = Math.pow(rate, dt * 1000);
  return [s + (v * (f - 1)) / (1000 * Math.log(rate)), v * f];
}
/** Lissage exponentiel d'une vitesse mesurée (τ en s). */
export function lisserVitesse(vs: number, mesure: number, dt: number, tau = 0.06) {
  if (dt <= 0) return vs;
  return vs + (mesure - vs) * (1 - Math.exp(-dt / tau));
}

/** Pincement et asymétrie maximaux, respiration (fractions du pas des titres). */
export const P_MAX = 0.2;
export const S_MAX = 0.19;
export const RESPIRE = 0.014;
/** Vitesse (titres/s) à laquelle le pli atteint ~76 % de son maximum. */
export const V0 = 2.2;
/** Ce que visent les ressorts du pli pour une vitesse lissée vs : P suit |v|, S suit le sens (v > 0 : on descend). */
export function pliCible(vs: number, reduit = false) {
  if (reduit || !Number.isFinite(vs)) return { P: 0, S: 0 };
  return { P: P_MAX * Math.tanh(Math.abs(vs) / V0), S: -S_MAX * Math.tanh(vs / V0) };
}
/** La respiration au repos (temps t en s) : une ondulation très faible, nulle en mouvement réduit. */
export function respiration(t: number, reduit = false) {
  if (reduit) return { P: 0, S: 0 };
  return { P: RESPIRE * (0.55 + 0.45 * Math.sin(t * 1.15)), S: RESPIRE * 0.8 * Math.sin(t * 0.73 + 1.3) };
}
/** Le ressort du pli : sous-amorti (traîne et rebond). */
export const PLI_W0 = (2 * Math.PI) / 0.62;
export const PLI_ZETA = 0.3;
/** Avance une composante du pli (position x, vitesse v) vers sa cible de dt secondes (forme exacte). */
export function pasPli(x: number, v: number, cible: number, dt: number): [number, number] {
  const [y, nv] = oscille(x - cible, v, dt, PLI_W0, PLI_ZETA);
  return [cible + y, nv];
}
/**
 * La déformation d'étoffe, en pas de titre : le déplacement vertical d'un point d'abscisse x (−½…½ dans le bandeau)
 * à la hauteur d'écran Yn (−1 en haut, 1 en bas). f(x) = P cos πx + S sin πx (demi-onde, plus le terme qui pince un
 * côté et évase l'autre) ; g(Yn) = sin(π/2 · Yn) : sens opposés au-dessus et au-dessous du centre, presque rien au
 * milieu. Bornée par |P| + |S|. Le même calcul que le nuanceur de sommets.
 */
export function deformation(x: number, Yn: number, P: number, S: number) {
  const f = P * Math.cos(Math.PI * x) + S * Math.sin(Math.PI * x);
  const y = Math.max(-1, Math.min(1, Yn));
  return -f * Math.sin((Math.PI / 2) * y);
}
/** Le pas entre deux titres (px) : environ deux fois le corps, borné par la hauteur. */
export function pasDe(corps: number, H: number) {
  return Math.max(H * 0.24, Math.min(H * 0.36, corps * 1.95));
}
/** Le centre vertical (px) du bandeau du titre i pour la position s. */
export function centreBandeau(i: number, s: number, n: number, H: number, pas: number, ecart: number) {
  return H / 2 + ecartBoucle(i, s, n) * pas * ecart;
}
/** Le numéro affiché : « 01. », « 12. ». */
export const numero = (i: number) => `${String(i + 1).padStart(2, "0")}.`;

/* ───────────────────────── CSS ───────────────────────── */

const CSS = `
[data-rouleau] { position: relative; display: block; box-sizing: border-box; height: var(--rouleau-hauteur, 100vh); overflow: hidden; overflow: clip; isolation: isolate;
  --rouleau-corps: clamp(46px, 9.6vw, 220px); --rouleau-marge: max(20px, 12.8%); color: var(--rouleau-encre, #fff);
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; touch-action: pan-x; cursor: grab; }
[data-rouleau].rouleau-tenu { cursor: grabbing; }
[data-rouleau] > a.rouleau-titre { position: absolute; left: var(--rouleau-marge); top: 0; z-index: 2; display: block; margin: 0; padding: 0.02em 0.04em 0.06em;
  font-size: var(--rouleau-corps); font-weight: 700; line-height: 1; letter-spacing: -0.045em; white-space: nowrap; color: inherit; text-decoration: none;
  text-shadow: 0 0 1px rgba(0,0,0,.10), 0 1px 3px rgba(0,0,0,.10), 0 4px 30px rgba(0,0,0,.16); will-change: transform; outline: none; -webkit-user-drag: none; }
[data-rouleau] > a.rouleau-titre:focus-visible { outline: 3px solid var(--rouleau-accent, #e0352b); outline-offset: 0.08em; border-radius: 4px; }
[data-rouleau] > a.rouleau-titre img, [data-rouleau] > a.rouleau-titre picture { display: none !important; }
.rouleau-num { position: absolute; right: 100%; top: 0.1em; margin-right: 0.07em; font-size: max(10px, 0.095em); font-weight: 400; letter-spacing: 0.02em; line-height: 1; opacity: .92; }
.rouleau-plans { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
.rouleau-plans > img { position: absolute; left: 0; top: 0; display: block; margin: 0; max-width: none; object-fit: cover; will-change: transform; background: rgba(0,0,0,.12); -webkit-user-drag: none; }
.rouleau-gpu .rouleau-plans { visibility: hidden; }
.rouleau-canvas { position: absolute !important; inset: 0; z-index: 1; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; pointer-events: none; }
.rouleau-filet { position: absolute; left: 0; top: 50%; z-index: 2; width: min(7.4%, calc(var(--rouleau-marge) - 14px)); height: 1px; background: currentColor; opacity: .9; pointer-events: none; }
.rouleau-commandes { position: absolute; inset: 0; z-index: 3; pointer-events: none; font-size: 15px; }
.rouleau-compteur { position: absolute; top: 8%; right: 13.2%; color: var(--rouleau-accent, #e0352b); font-weight: 500; letter-spacing: 0.02em; }
.rouleau-fleches { position: absolute; right: max(8px, 5.4%); top: 26%; display: flex; flex-direction: column; gap: 20px; pointer-events: auto; }
.rouleau-fleches button { all: unset; box-sizing: border-box; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; color: var(--rouleau-trait, rgba(0,0,0,.62)); cursor: pointer; transition: background-color .2s; }
.rouleau-fleches button:hover { background: rgba(0,0,0,.06); }
.rouleau-fleches button:focus-visible { outline: 2px solid var(--rouleau-accent, #e0352b); outline-offset: 2px; }
.rouleau-fleches svg { width: 22px; height: 22px; }
.rouleau-invite { position: absolute; right: 13.2%; bottom: 6%; color: var(--rouleau-encre, #fff); font-weight: 500; text-shadow: 0 1px 6px rgba(0,0,0,.18); }
@media (max-width: 640px) {
  [data-rouleau] { --rouleau-corps: clamp(40px, 12.5vw, 90px); --rouleau-marge: 30px; }
  .rouleau-compteur { right: 20px; top: 20px; }
  .rouleau-invite { right: 20px; bottom: 20px; font-size: 13px; }
  .rouleau-fleches { top: auto; bottom: 56px; gap: 6px; right: 6px; }
  .rouleau-filet { width: 16px; }
}
`;
let cssPose = false;
function poserCss() {
  if (cssPose || typeof document === "undefined") return;
  cssPose = true;
  const st = document.createElement("style");
  st.dataset.presseRouleau = "";
  st.textContent = CSS;
  document.head.append(st);
}

/* ───────────────────────── Shader ───────────────────────── */

const NX = 48;
const NY = 16;
const MAX_VUES = 5;

const WGSL = /* wgsl */ `
const PI = 3.14159265;
struct U {
  res: vec4f,    // largeur, hauteur (px appareil), dpr, ombrage (force)
  bande: vec4f,  // largeur du bandeau, hauteur, centre x, pas des titres (px appareil)
  pli: vec4f,    // P, S (fractions du pas), parallaxe (0–1), zoom de marge
  grille: vec4f, // NX, NY, marge du maillage en x, en y (unités du bandeau)
  b: array<vec4f, ${MAX_VUES}>, // centre y (px appareil), calque, éclat (1 courant → 0 voisin), rapport l/h de l'image
  c: array<vec4f, ${MAX_VUES}>, // chargée (0 / 1)
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d_array<f32>;

struct VO {
  @builtin(position) pos: vec4f,
  @location(0) loc: vec2f,     // x, y dans le bandeau (−½…½, au-delà dans la marge d'antialiasing)
  @location(1) ombre: vec2f,   // pente d(dy)/dX, compression d(dy)/dY
  @location(2) @interpolate(flat) inst: u32,
};

fn versClip(p: vec2f) -> vec4f {
  return vec4f(p.x / u.res.x * 2.0 - 1.0, 1.0 - p.y / u.res.y * 2.0, 0.0, 1.0);
}

@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var cxs = array<f32, 6>(0.0, 1.0, 0.0, 0.0, 1.0, 1.0);
  var cys = array<f32, 6>(0.0, 0.0, 1.0, 1.0, 0.0, 1.0);
  let q = vi / 6u;
  let k = vi % 6u;
  let nx = u32(u.grille.x);
  let ny = u32(u.grille.y);
  let col = f32(q % nx) + cxs[k];
  let row = f32(q / nx) + cys[k];
  let x = mix(-0.5 - u.grille.z, 0.5 + u.grille.z, col / f32(nx));
  let y = mix(-0.5 - u.grille.w, 0.5 + u.grille.w, row / f32(ny));
  let B = u.b[ii];
  let H = u.res.y;
  let bw = u.bande.x;
  let bh = u.bande.y;
  let pas = u.bande.w;
  let X = u.bande.z + x * bw;
  let Y0 = B.x + y * bh;
  // Le tissu : un seul champ pour tous les bandeaux, fonction de la hauteur à l'écran.
  let Yn = clamp((Y0 - H * 0.5) / (H * 0.5), -1.0, 1.0);
  let g = sin(PI * 0.5 * Yn);
  let gp = select(cos(PI * 0.5 * Yn) * PI * 0.5 / (H * 0.5), 0.0, abs(Yn) >= 1.0);
  let P = u.pli.x;
  let S = u.pli.y;
  let f = P * cos(PI * x) + S * sin(PI * x);
  let fx = (-P * PI * sin(PI * x) + S * PI * cos(PI * x)) / bw;
  let dy = -f * g * pas;
  var o: VO;
  o.pos = versClip(vec2f(X, Y0 + dy));
  o.loc = vec2f(x, y);
  o.ombre = vec2f(-fx * g * pas, -f * gp * pas);
  o.inst = ii;
  return o;
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let B = u.b[i.inst];
  let x = i.loc.x;
  let y = i.loc.y;
  // Cadrage « cover » du bandeau (rapport ab) par l'image (rapport ai), agrandi de la marge du parallaxe.
  let ab = u.bande.x / u.bande.y;
  let ai = max(B.w, 0.01);
  var vis = vec2f(1.0, ai / ab);
  if (ai > ab) { vis = vec2f(ab / ai, 1.0); }
  vis = vis / u.pli.w;
  let par = clamp((B.x - u.res.y * 0.5) / (u.res.y * 0.5), -1.5, 1.5) * u.pli.z;
  let uv = clamp(vec2f(0.5 + x * vis.x, 0.5 + y * vis.y + par * (1.0 - vis.y) * 0.5), vec2f(0.0), vec2f(1.0));
  let gx = vec2f(dpdx(x), dpdy(x));
  let gy = vec2f(dpdx(y), dpdy(y));
  var col = textureSampleGrad(tex, samp, uv, i32(B.y), dpdx(uv), dpdy(uv)).rgb;
  if (u.c[i.inst].x < 0.5) { col = vec3f(0.36, 0.36, 0.37); }

  // Couverture : distance aux bords (unités du bandeau) divisée par sa pente à l'écran (px appareil).
  let dX = (abs(x) - 0.5) / max(length(gx), 1e-6);
  let dY = (abs(y) - 0.5) / max(length(gy), 1e-6);
  let cov = clamp(0.5 - max(dX, dY), 0.0, 1.0);
  if (cov <= 0.0) { discard; }

  // Les plis : la pente éclaire un flanc et assombrit l'autre ; la compression assombrit, l'étirement éclaircit.
  let k = u.res.w;
  let lum = clamp(1.0 + k * (1.6 * i.ombre.x + 0.9 * i.ombre.y), 0.68, 1.16);
  col = col * lum;
  // Les voisins : un peu assombris et désaturés.
  let gris = dot(col, vec3f(0.2126, 0.7152, 0.0722));
  let voisin = mix(vec3f(gris), col, 0.6) * 0.66;
  col = mix(voisin, col, clamp(B.z, 0.0, 1.0));
  return vec4f(col * cov, cov);
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
  const mod = device.createShaderModule({ code: WGSL, label: "presse-rouleau" });
  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d-array" } },
    ],
  });
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", maxAnisotropy: 8, addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  const mipMod = device.createShaderModule({ code: MIP_WGSL, label: "presse-rouleau-mip" });
  const mipPipe = device.createRenderPipeline({
    label: "presse-rouleau-mip",
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
      label: `presse-rouleau-${format}`,
      layout: s.device.createPipelineLayout({ bindGroupLayouts: [s.layout] }),
      vertex: { module: s.mod, entryPoint: "vs" },
      fragment: { module: s.mod, entryPoint: "fs", targets: [{ format, blend }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
    });
    s.pipes.set(format, p);
  }
  return p;
}

/** Mode banc d'essai (`globalThis.__presseBanc = true` ou `?presse-banc`) : pas de contexte WebGPU à l'écran ; `capturerRouleau(el)` dessine hors écran. */
export const modeBanc = () => typeof globalThis !== "undefined" && (!!(globalThis as { __presseBanc?: boolean }).__presseBanc || (typeof location !== "undefined" && /[?&]presse-banc\b/.test(location.search)));

const UVEC = 4;
const UFLOATS = (UVEC + 2 * MAX_VUES) * 4;

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

/* ───────────────────────── Un rouleau ───────────────────────── */

const reduitQ = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const num = (s: string | null | undefined, d: number) => {
  const n = Number.parseFloat(s ?? "");
  return Number.isFinite(n) ? n : d;
};
const SVG_HAUT = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15l7-7 7 7"/></svg>';
const SVG_BAS = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg>';

export type RouleauApi = {
  /** Amène le titre `index` au centre (ressort ; posé d'un coup en mouvement réduit). */
  aller(index: number): void;
  /** L'index du titre au centre (ou visé, pendant l'aimantation). */
  index(): number;
  detruire(): void;
};

const instances = new Map<HTMLElement, Rouleau>();
let fige = false;
let pertes = 0;
let io: IntersectionObserver | null = null;

type Mode = "repos" | "tenu" | "libre" | "ressort" | "molette";

class Rouleau {
  readonly el: HTMLElement;
  liens: HTMLAnchorElement[] = [];
  nums: HTMLSpanElement[] = [];
  plans: HTMLImageElement[] = [];
  aspects: number[] = [];
  plansBox: HTMLDivElement;
  commandes: HTMLDivElement;
  compteur: HTMLSpanElement;
  invite: HTMLSpanElement;
  filet: HTMLDivElement;
  /* Réglages */
  largeur = 0.655;
  decalage = 0.03;
  ecart = 1.85;
  respire = true;
  /* Mesures (px CSS) */
  W = 0;
  H = 0;
  pas = 300;
  dpr = 1;
  /* Mouvement (s en titres) */
  s = 0;
  sPrev = 0;
  vs = 0;
  v = 0;
  mode: Mode = "repos";
  ressort = new Ressort(0, REGLAGES.lacher);
  vit = new Vitesse();
  drag: { id: number; y0: number; x0: number; s0: number; bouge: boolean; affiche: number } | null = null;
  bloqueClic = false;
  molS0 = 0;
  molAge = 0;
  molRed = 0;
  glisse = 0; // banc : vitesse d'un glisser simulé (titres/s)
  P = 0;
  Pv = 0;
  S = 0;
  Sv = 0;
  temps = 0;
  affiche = -1;
  reduit = reduitQ();
  /* Rendu */
  gpu: Gpu | null = null;
  canvas: HTMLCanvasElement | null = null;
  visible = true;
  raf = 0;
  last = 0;
  aMesurer = true;
  fin = false;
  vues = new Float32Array(MAX_VUES * 4);
  hTitres: number[] = [];
  nVues = 0;
  ro: ResizeObserver | null = null;
  mo: MutationObserver;
  mq: MediaQueryList | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
    poserCss();
    this.plansBox = document.createElement("div");
    this.plansBox.className = "rouleau-plans";
    this.plansBox.setAttribute("aria-hidden", "true");
    this.filet = document.createElement("div");
    this.filet.className = "rouleau-filet";
    this.filet.setAttribute("aria-hidden", "true");
    this.commandes = document.createElement("div");
    this.commandes.className = "rouleau-commandes";
    this.compteur = document.createElement("span");
    this.compteur.className = "rouleau-compteur";
    this.compteur.setAttribute("aria-hidden", "true");
    const fl = document.createElement("div");
    fl.className = "rouleau-fleches";
    const bH = document.createElement("button");
    bH.type = "button";
    bH.setAttribute("aria-label", "Titre précédent");
    bH.innerHTML = SVG_HAUT;
    bH.addEventListener("click", () => this.aller(this.indexVise() - 1));
    const bB = document.createElement("button");
    bB.type = "button";
    bB.setAttribute("aria-label", "Titre suivant");
    bB.innerHTML = SVG_BAS;
    bB.addEventListener("click", () => this.aller(this.indexVise() + 1));
    fl.append(bH, bB);
    this.invite = document.createElement("span");
    this.invite.className = "rouleau-invite";
    this.invite.setAttribute("aria-hidden", "true");
    this.commandes.append(this.compteur, fl, this.invite);
    el.prepend(this.plansBox);
    el.append(this.filet, this.commandes);
    this.lireReglages();
    this.collecter();
    const depart = Math.round(num(el.dataset.rouleauDepart, 0));
    if (this.liens.length) this.poser(boucler(depart, this.liens.length));

    this.mo = new MutationObserver((ms) => {
      let recolle = false;
      for (const m of ms) {
        // Ce que le composant pose lui-même (plans, commandes) ne compte pas.
        if (m.target instanceof Node && (this.plansBox.contains(m.target) || this.commandes.contains(m.target))) continue;
        if (m.type === "childList") {
          for (const n of [...m.addedNodes, ...m.removedNodes]) if (n instanceof HTMLAnchorElement || n instanceof HTMLImageElement || n instanceof HTMLPictureElement) recolle = true;
        } else if (m.target === this.el) this.lireReglages();
        else recolle = true;
      }
      if (recolle) {
        this.collecter();
        if (this.gpu) (this.debrancher(), void this.brancher());
      }
      this.aMesurer = true;
      this.reveiller();
    });
    this.mo.observe(el, { childList: true, attributes: true, subtree: true, attributeFilter: ["data-rouleau-img", "data-rouleau-largeur", "data-rouleau-decalage", "data-rouleau-ecart", "data-rouleau-hauteur", "data-rouleau-respire", "data-rouleau-invite", "src"] });
    if (typeof ResizeObserver === "function") {
      this.ro = new ResizeObserver(() => ((this.aMesurer = true), this.reveiller()));
      this.ro.observe(el);
    }
    io?.observe(el);
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("keydown", this.onKey);
    el.addEventListener("focusin", this.onFocusIn);
    el.addEventListener("click", this.onClick, true);
    el.addEventListener("dragstart", this.onDragStart);
    el.addEventListener("scroll", this.onScroll);
    this.mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    this.mq?.addEventListener?.("change", this.onReduit);
    // Les polices arrivées, la hauteur des titres (et donc leur centrage) change.
    void document.fonts?.ready.then(() => ((this.aMesurer = true), this.reveiller()));
    void this.brancher();
    this.reveiller();
  }

  /* ── Lecture du DOM ── */
  lireReglages() {
    const d = this.el.dataset;
    const etroit = (this.W || this.el.clientWidth || 1024) < 640;
    this.largeur = Math.max(0.2, Math.min(1, num(d.rouleauLargeur, etroit ? 0.88 : 0.655)));
    this.decalage = Math.max(-0.5, Math.min(0.5, num(d.rouleauDecalage, etroit ? 0.04 : 0.03)));
    this.ecart = Math.max(1, Math.min(4, num(d.rouleauEcart, 1.85)));
    this.respire = d.rouleauRespire !== "0" && d.rouleauRespire !== "false";
    if (d.rouleauHauteur) this.el.style.setProperty("--rouleau-hauteur", /^\d+(\.\d+)?$/.test(d.rouleauHauteur) ? `${d.rouleauHauteur}px` : d.rouleauHauteur);
    this.invite.textContent = d.rouleauInvite ?? "Glisser pour explorer.";
    this.invite.hidden = !this.invite.textContent;
  }
  collecter() {
    const liens = [...this.el.querySelectorAll<HTMLAnchorElement>(":scope > a")];
    // Défaire ce qui a été posé (numéros, plans) avant de recoller.
    for (const n of this.nums) n.remove();
    for (const p of this.plans) p.remove();
    this.liens = liens;
    this.nums = [];
    this.plans = [];
    this.aspects = [];
    liens.forEach((a, i) => {
      a.classList.add("rouleau-titre");
      a.draggable = false;
      const nm = document.createElement("span");
      nm.className = "rouleau-num";
      nm.setAttribute("aria-hidden", "true");
      nm.textContent = numero(i);
      a.prepend(nm);
      this.nums.push(nm);
      // La source : data-rouleau-img, ou l'<img> (éventuellement dans un <picture>) du lien.
      const inner = a.querySelector<HTMLImageElement>(":scope > img, :scope > picture > img");
      const src = a.dataset.rouleauImg || inner?.currentSrc || inner?.getAttribute("src") || "";
      const im = document.createElement("img");
      im.alt = "";
      im.decoding = "async";
      im.draggable = false;
      if (src) im.src = new URL(src, document.baseURI).href;
      const w = Number(inner?.getAttribute("width"));
      const h = Number(inner?.getAttribute("height"));
      this.aspects.push(w > 0 && h > 0 ? w / h : 1.5);
      im.addEventListener("load", () => {
        if (im.naturalWidth && im.naturalHeight) this.aspects[i] = im.naturalWidth / im.naturalHeight;
        this.reveiller();
      });
      this.plansBox.append(im);
      this.plans.push(im);
    });
    this.affiche = -1;
  }

  mesurer() {
    this.aMesurer = false;
    const W = this.el.clientWidth;
    const H = this.el.clientHeight;
    const etroitAvant = this.W < 640;
    this.W = W;
    this.H = H;
    if (W < 640 !== etroitAvant) this.lireReglages();
    const corps = this.liens[0] ? Number.parseFloat(getComputedStyle(this.liens[0]).fontSize) || 120 : 120;
    this.pas = pasDe(corps, H || 800);
    this.hTitres = this.liens.map((a) => a.offsetHeight);
    this.dpr = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 2);
    if (this.canvas) {
      const cw = Math.max(1, Math.round(W * this.dpr));
      const ch = Math.max(1, Math.round(H * this.dpr));
      if (this.canvas.width !== cw || this.canvas.height !== ch) ((this.canvas.width = cw), (this.canvas.height = ch));
    }
  }
  /** Le bandeau : largeur, hauteur, centre x (px CSS). */
  bandeau() {
    const bw = this.W * this.largeur;
    const bh = this.pas * 1.1;
    const cx = this.W / 2 + this.W * this.decalage;
    return { bw, bh, cx: Math.min(this.W - bw / 2, Math.max(bw / 2, cx)) };
  }

  /* ── Mouvement ── */
  n() {
    return this.liens.length;
  }
  /** Le titre au centre de l'écran. */
  indexAffiche() {
    return indexDe(this.s, this.n());
  }
  /** Le titre visé : la cible du ressort pendant l'aimantation, sinon celui du centre. */
  indexVise() {
    return indexDe(this.mode === "ressort" ? this.ressort.cible : this.s, this.n());
  }
  poser(pos: number) {
    this.s = pos;
    this.sPrev = pos;
    this.v = 0;
    this.ressort.pose(pos);
    this.mode = "repos";
  }
  decaler(ds: number) {
    this.s += ds;
    this.sPrev += ds;
    this.molS0 += ds;
    this.ressort.x += ds;
    this.ressort.cible += ds;
    if (this.drag) this.drag.s0 += ds;
  }
  aller(index: number, focaliser = false) {
    const n = this.n();
    if (!n) return;
    const i = boucler(Math.round(index), n);
    const base = this.mode === "ressort" ? this.ressort.cible : this.s;
    const c = base + ecartBoucle(i, base, n);
    if (this.reduit) this.poser(c);
    else {
      if (this.mode !== "ressort") ((this.ressort.x = this.s), (this.ressort.v = this.vs));
      this.ressort.vers(c);
      this.mode = "ressort";
      this.v = 0;
    }
    if (focaliser) this.liens[i]?.focus({ preventScroll: true });
    this.reveiller();
  }
  /** Le lâcher : inertie, puis aimantation (mouvement réduit : aimantation immédiate, sans inertie). */
  lacher(v: number) {
    if (this.reduit) return this.poser(Math.round(this.s));
    this.mode = "libre";
    this.v = v;
    if (Math.abs(v) < 2.5) this.aimanter(v);
  }
  aimanter(v: number) {
    const cible = cibleAimant(this.s, v);
    this.ressort.x = this.s;
    this.ressort.lacher(v, cible);
    this.mode = "ressort";
    this.v = 0;
  }

  /* ── Événements ── */
  onDown = (e: PointerEvent) => {
    if (e.button !== 0 || (e.target as Element).closest?.(".rouleau-commandes")) return;
    this.drag = { id: e.pointerId, y0: e.clientY, x0: e.clientX, s0: this.s, bouge: false, affiche: this.indexAffiche() };
    this.vit.reset();
    this.vit.add(e.timeStamp, e.clientY);
    // On rattrape la liste au vol.
    this.mode = "tenu";
    this.v = 0;
    this.reveiller();
  };
  onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const list = e.getCoalescedEvents?.() ?? [];
    if (list.length) for (const c of list) this.vit.add(c.timeStamp, c.clientY);
    else this.vit.add(e.timeStamp, e.clientY);
    if (!d.bouge && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) {
      d.bouge = true;
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
        /* pointeur déjà relâché */
      }
      this.el.classList.add("rouleau-tenu");
    }
    if (!d.bouge) return;
    this.s = d.s0 - (e.clientY - d.y0) / this.pas;
    this.reveiller();
  };
  onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    this.el.classList.remove("rouleau-tenu");
    if (!d.bouge) {
      // Un simple appui : la liste se repose sur son titre ; le clic (s'il vient) décide du reste.
      if (Math.abs(this.s - Math.round(this.s)) > 1e-3) this.lacher(0);
      else this.mode = "repos";
      this.reveiller();
      return;
    }
    // Un glisser ne suit jamais le lien : le clic qui suit est mangé.
    this.bloqueClic = true;
    setTimeout(() => (this.bloqueClic = false), 0);
    this.lacher(e.type === "pointerup" ? -this.vit.get(e.timeStamp) / this.pas : 0);
    this.reveiller();
  };
  onClick = (e: MouseEvent) => {
    const a = (e.target as Element).closest?.("a");
    const i = a ? this.liens.indexOf(a as HTMLAnchorElement) : -1;
    if (i < 0) return;
    if (this.bloqueClic) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Clavier (detail 0) : le titre visé ; souris : celui qui était au centre à l'appui.
    const courant = e.detail === 0 ? this.indexVise() : this.indexAffiche();
    if (i !== courant) {
      e.preventDefault();
      this.aller(i);
    }
  };
  onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) return;
    const k = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? this.H : 1;
    const d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * k;
    if (!d) return;
    e.preventDefault();
    if (this.reduit) {
      // Pas d'à-coups continus : un titre par cran (ou par 90 px de pavé tactile).
      this.molRed += d;
      if (Math.abs(this.molRed) >= 90 || Math.abs(d) >= 50) {
        const sg = Math.sign(this.molRed || d);
        this.molRed = 0;
        this.aller(this.indexVise() + sg);
      }
      return;
    }
    if (this.mode !== "molette") {
      this.molS0 = this.s;
      this.mode = "molette";
      this.v = 0;
    }
    this.s += d / this.pas;
    this.molAge = 0;
    this.reveiller();
  };
  onKey = (e: KeyboardEvent) => {
    const n = this.n();
    if (!n || e.altKey || e.ctrlKey || e.metaKey) return;
    const base = this.indexVise();
    let cible: number | null = null;
    if (e.key === "ArrowDown" || e.key === "PageDown") cible = base + 1;
    else if (e.key === "ArrowUp" || e.key === "PageUp") cible = base - 1;
    else if (e.key === "Home") cible = 0;
    else if (e.key === "End") cible = n - 1;
    if (cible === null) return;
    e.preventDefault();
    // Le focus suit le titre s'il est déjà sur un titre (Entrée suit alors ce qu'on voit).
    const surTitre = this.liens.includes(document.activeElement as HTMLAnchorElement);
    this.aller(cible, surTitre);
  };
  onFocusIn = (e: FocusEvent) => {
    const t = e.target;
    const i = t instanceof HTMLAnchorElement ? this.liens.indexOf(t) : -1;
    if (i < 0) return;
    // Un overflow: hidden peut défiler pour montrer l'élément focalisé : on l'en empêche.
    this.el.scrollTop = 0;
    let vis = false;
    try {
      vis = t instanceof HTMLElement && t.matches(":focus-visible");
    } catch {
      vis = true;
    }
    if (vis && i !== this.indexVise()) this.aller(i);
  };
  onScroll = () => {
    if (this.el.scrollTop || this.el.scrollLeft) ((this.el.scrollTop = 0), (this.el.scrollLeft = 0));
  };
  onDragStart = (e: DragEvent) => e.preventDefault();
  onReduit = (e: MediaQueryListEvent) => {
    this.reduit = e.matches;
    if (this.reduit && this.mode !== "tenu") this.poser(Math.round(this.mode === "ressort" ? this.ressort.cible : this.s));
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
      if (this.aMesurer || !this.W) this.mesurer();
      const n = Math.max(1, this.liens.length);
      // La taille de calque : le bandeau tel qu'il s'affiche (px appareil), avec la marge du parallaxe, bornée.
      const dpr = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 2);
      const { bw } = this.bandeau();
      const lim = Math.min(2048, device.limits.maxTextureDimension2D);
      let Tw = Math.min(lim, Math.max(64, Math.round((bw || 900) * dpr * 1.12)));
      let Th = Math.min(lim, Math.max(64, Math.round(Tw / 1.5)));
      const budget = 96e6 / (4 * 1.34 * n);
      if (Tw * Th > budget) {
        const k = Math.sqrt(budget / (Tw * Th));
        Tw = Math.max(32, Math.floor(Tw * k));
        Th = Math.max(32, Math.floor(Th * k));
      }
      const levels = Math.floor(Math.log2(Math.max(Tw, Th))) + 1;
      const tex = device.createTexture({
        label: "presse-rouleau-images",
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
      c.className = "rouleau-canvas";
      c.setAttribute("aria-hidden", "true");
      if (!c.isConnected) this.plansBox.after(c);
      this.canvas = c;
      const format = navigator.gpu.getPreferredCanvasFormat();
      const ctx = modeBanc() ? null : c.getContext("webgpu");
      ctx?.configure({ device, format, alphaMode: "premultiplied" });
      const g: Gpu = { s, ctx, format, ubuf, tex, bind, data: new Float32Array(UFLOATS), Tw, Th, levels, charge: this.plans.map(() => false), pret: Promise.resolve() };
      this.gpu = g;
      g.pret = Promise.all(this.plans.map((im, i) => this.charger(g, im, i))).then(() => undefined);
      this.el.classList.add("rouleau-gpu");
      this.aMesurer = true;
      this.reveiller();
    } catch (e) {
      if (typeof navigator !== "undefined" && navigator.gpu) console.warn("[presse:rouleau] WebGPU indisponible, repli CSS", e);
    }
  }
  async charger(g: Gpu, im: HTMLImageElement, i: number) {
    try {
      if (!im.src) return;
      if (!im.complete || !im.naturalWidth) await im.decode();
      if (this.gpu !== g) return;
      if (im.naturalWidth && im.naturalHeight) this.aspects[i] = im.naturalWidth / im.naturalHeight;
      const bmp = await createImageBitmap(im, { resizeWidth: g.Tw, resizeHeight: g.Th, resizeQuality: "high" });
      if (this.gpu !== g) return bmp.close();
      g.s.device.queue.copyExternalImageToTexture({ source: bmp }, { texture: g.tex, origin: [0, 0, i] }, [g.Tw, g.Th]);
      bmp.close();
      this.mips(g, i);
      g.charge[i] = true;
      this.reveiller();
    } catch (e) {
      console.warn("[presse:rouleau] image illisible", im.src, e);
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
    this.el.classList.remove("rouleau-gpu");
    this.reveiller();
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
    if (this.aMesurer) this.mesurer();
    const dt = fige ? 0 : Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const bouge = this.pas_(dt);
    this.rendre();
    // Hors écran ou onglet caché : la boucle s'arrête ; elle repart à la visibilité.
    if ((bouge || fige) && this.visible && !document.hidden) this.reveiller();
  };
  respireActif() {
    return this.respire && !this.reduit && !!this.gpu;
  }
  /** Avance l'état de dt secondes ; rend vrai si quelque chose bouge encore. */
  pas_(dt: number) {
    const n = this.n();
    this.temps += dt;
    switch (this.mode) {
      case "tenu":
        if (this.glisse) this.s += this.glisse * dt;
        break;
      case "libre": {
        [this.s, this.v] = inertie(this.s, this.v, dt);
        if (Math.abs(this.v) < 2.5) this.aimanter(this.v);
        break;
      }
      case "molette": {
        this.molAge += dt;
        if (this.molAge > 0.14) {
          // Fin d'un geste de molette : le titre le plus proche, mais au moins un cran si l'on a vraiment tourné.
          const base = Math.round(this.molS0);
          let c = Math.round(this.s);
          if (c === base && Math.abs(this.s - this.molS0) > 0.08) c = base + Math.sign(this.s - this.molS0);
          this.ressort.x = this.s;
          this.ressort.lacher(this.vs * 0.5, c);
          this.mode = "ressort";
        }
        break;
      }
      case "ressort": {
        const encore = this.ressort.pas(dt);
        this.s = this.ressort.x;
        if (!encore) this.mode = "repos";
        break;
      }
    }
    if (dt > 0) {
      this.vs = lisserVitesse(this.vs, (this.s - this.sPrev) / dt, dt);
      if (Math.abs(this.vs) < 1e-3 && this.s === this.sPrev) this.vs = 0;
    }
    this.sPrev = this.s;
    // Le pli : deux ressorts sous-amortis qui suivent la vitesse (traîne, rebond à l'arrêt).
    const c = pliCible(this.vs, this.reduit || !this.gpu);
    if (this.reduit || !this.gpu) ((this.P = 0), (this.Pv = 0), (this.S = 0), (this.Sv = 0));
    else if (dt > 0) {
      [this.P, this.Pv] = pasPli(this.P, this.Pv, c.P, dt);
      [this.S, this.Sv] = pasPli(this.S, this.Sv, c.S, dt);
      const calme = (x: number, v: number, cb: number) => Math.abs(x - cb) < 2e-4 && Math.abs(v) < 2e-3;
      if (calme(this.P, this.Pv, c.P) && c.P === 0) ((this.P = 0), (this.Pv = 0));
      if (calme(this.S, this.Sv, c.S) && c.S === 0) ((this.S = 0), (this.Sv = 0));
    }
    // Bouclage : s reste dans [0, n).
    if (n > 0 && (this.s < 0 || this.s >= n)) this.decaler(-Math.floor(this.s / n) * n);
    const i = this.indexAffiche();
    if (i !== this.affiche && i >= 0) {
      const premier = this.affiche < 0;
      this.affiche = i;
      this.liens.forEach((a, k) => (k === i ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
      this.compteur.textContent = numero(i);
      if (!premier) this.el.dispatchEvent(new CustomEvent("rouleau:change", { detail: { index: i }, bubbles: true }));
    }
    const pli = this.P !== 0 || this.S !== 0 || this.Pv !== 0 || this.Sv !== 0;
    return this.mode !== "repos" || this.vs !== 0 || pli || this.respireActif();
  }
  rendre() {
    const n = this.n();
    if (!n || !this.W) return;
    const H = this.H;
    // Les titres : au pixel près (texte net).
    for (let i = 0; i < n; i++) {
      const a = this.liens[i]!;
      const y = H / 2 + ecartBoucle(i, this.s, n) * this.pas - (this.hTitres[i] ?? 0) / 2;
      a.style.transform = `translate3d(0, ${net(y, "y", false)}px, 0)`;
    }
    // Les bandeaux visibles (3 à 5), le courant en dernier (dessus).
    const { bw, bh, cx } = this.bandeau();
    const marge = bh / 2 + (P_MAX + S_MAX) * this.pas + 4;
    let k = 0;
    const ordre = [-2, 2, -1, 1, 0];
    const base = Math.round(this.s);
    for (const o of ordre) {
      const i = boucler(base + o, n);
      // Liste courte : un titre ne se dessine qu'une fois (sa copie la plus proche, celle de centreBandeau).
      if (Math.abs(ecartBoucle(i, this.s, n) - (base + o - this.s)) > 1e-4) continue;
      const yc = centreBandeau(i, this.s, n, H, this.pas, this.ecart);
      if (yc < -marge || yc > H + marge || k >= MAX_VUES) continue;
      const d = Math.abs(ecartBoucle(i, this.s, n));
      this.vues[k * 4] = yc;
      this.vues[k * 4 + 1] = i;
      this.vues[k * 4 + 2] = Math.max(0, 1 - d);
      this.vues[k * 4 + 3] = this.aspects[i] ?? 1.5;
      k++;
    }
    this.nVues = k;
    if (this.gpu) {
      if (this.gpu.ctx) {
        this.remplir();
        try {
          this.dessinerDans(this.gpu.ctx.getCurrentTexture().createView(), this.gpu.format);
        } catch (e) {
          console.warn("[presse:rouleau] dessin", e);
        }
      }
    } else {
      // Repli : un <img> par bandeau, même défilement, sans ondulation.
      for (let i = 0; i < n; i++) {
        const im = this.plans[i]!;
        const yc = centreBandeau(i, this.s, n, H, this.pas, this.ecart);
        const loin = yc < -marge || yc > H + marge;
        im.style.display = loin ? "none" : "";
        if (loin) continue;
        const d = Math.min(1, Math.abs(ecartBoucle(i, this.s, n)));
        im.style.width = `${bw}px`;
        im.style.height = `${bh}px`;
        im.style.transform = `translate3d(${cx - bw / 2}px, ${yc - bh / 2}px, 0)`;
        im.style.filter = d > 0.01 ? `brightness(${1 - 0.34 * d}) saturate(${1 - 0.4 * d})` : "";
      }
    }
    // Le filet à gauche, au niveau du titre courant.
    this.filet.style.top = `${H / 2}px`;
  }
  remplir() {
    const g = this.gpu!;
    const d = g.data;
    const k = this.dpr;
    const { bw, bh, cx } = this.bandeau();
    const r = respiration(this.temps, this.reduit || !this.respire);
    d.fill(0);
    d[0] = Math.max(1, Math.round(this.W * k));
    d[1] = Math.max(1, Math.round(this.H * k));
    d[2] = k;
    d[3] = 1;
    d[4] = bw * k;
    d[5] = bh * k;
    d[6] = cx * k;
    d[7] = this.pas * k;
    d[8] = this.P + r.P;
    d[9] = this.S + r.S;
    d[10] = this.reduit ? 0 : 0.85;
    d[11] = 1.14;
    // Marge du maillage : 2 px au-delà des bords, pour l'antialiasing.
    d.set([NX, NY, (2 * k) / Math.max(1, bw * k), (2 * k) / Math.max(1, bh * k)], 12);
    for (let i = 0; i < this.nVues; i++) {
      const o = UVEC * 4 + i * 4;
      d[o] = this.vues[i * 4]! * k;
      d[o + 1] = this.vues[i * 4 + 1]!;
      d[o + 2] = this.vues[i * 4 + 2]!;
      d[o + 3] = this.vues[i * 4 + 3]!;
      d[(UVEC + MAX_VUES) * 4 + i * 4] = g.charge[this.vues[i * 4 + 1]!] ? 1 : 0;
    }
  }
  /** Dessine l'état courant dans une vue de texture quelconque (le canvas, ou une texture du banc). */
  dessinerDans(view: GPUTextureView, format: GPUTextureFormat) {
    const g = this.gpu!;
    const dev = g.s.device;
    dev.queue.writeBuffer(g.ubuf, 0, g.data);
    const enc = dev.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    if (this.nVues) {
      pass.setPipeline(pipeDe(g.s, format));
      pass.setBindGroup(0, g.bind);
      pass.draw(6 * NX * NY, this.nVues);
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
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("keydown", this.onKey);
    el.removeEventListener("focusin", this.onFocusIn);
    el.removeEventListener("click", this.onClick, true);
    el.removeEventListener("dragstart", this.onDragStart);
    el.removeEventListener("scroll", this.onScroll);
    for (const n of this.nums) n.remove();
    for (const a of this.liens) {
      a.classList.remove("rouleau-titre");
      a.style.transform = "";
      a.removeAttribute("aria-current");
    }
    this.plansBox.remove();
    this.filet.remove();
    this.commandes.remove();
    el.classList.remove("rouleau-gpu", "rouleau-tenu");
    instances.delete(el);
  }

  api(): RouleauApi {
    return {
      aller: (i: number) => this.aller(i),
      index: () => this.indexVise(),
      detruire: () => this.detruire(),
    };
  }
}

/* ───────────────────────── Banc d'essai ───────────────────────── */

/** Fige (ou relâche) le temps de tous les rouleaux. */
export function figerRouleau(on: boolean) {
  fige = on;
  if (!on) for (const r of instances.values()) r.reveiller();
}
/** Avance tous les rouleaux de `ms` millisecondes, par pas de 1/60 s (à utiliser temps figé). */
export function avancerRouleau(ms: number) {
  for (const r of instances.values()) {
    if (r.aMesurer) r.mesurer();
    for (let t = 0; t < ms - 1e-6; t += 1000 / 60) r.pas_(Math.min(1000 / 60, ms - t) / 1000);
    r.rendre();
  }
}
/**
 * Pose l'état d'un rouleau : position s (titres), temps, et `tenir` : une vitesse de glisser tenu (titres/s ; le
 * banc fait alors défiler s comme une main), ou null pour relâcher sans vitesse.
 */
export function poserRouleau(el: HTMLElement, o: { s?: number; temps?: number; tenir?: number | null }) {
  const r = instances.get(el);
  if (!r) return;
  if (o.s !== undefined) (r.poser(o.s), (r.vs = 0), (r.P = r.Pv = r.S = r.Sv = 0));
  if (o.temps !== undefined) r.temps = o.temps;
  if (o.tenir !== undefined) {
    if (o.tenir === null) ((r.glisse = 0), r.lacher(0));
    else ((r.mode = "tenu"), (r.glisse = o.tenir));
  }
  r.reveiller();
}
/** Lâche un rouleau tenu avec la vitesse v (titres/s), comme à la fin d'un glisser. */
export function lacherRouleau(el: HTMLElement, v: number) {
  const r = instances.get(el);
  if (!r) return;
  r.glisse = 0;
  r.lacher(v);
  r.reveiller();
}
/** L'état d'un rouleau (banc d'essai). */
export function etatRouleau(el: HTMLElement) {
  const r = instances.get(el);
  if (!r) return null;
  return { s: r.s, vs: r.vs, P: r.P, S: r.S, mode: r.mode, index: r.indexVise(), affiche: r.indexAffiche(), gpu: !!r.gpu, vues: r.nVues, pas: r.pas };
}
/** Promesse tenue quand les textures d'un rouleau sont chargées. */
export async function rouleauPret(el: HTMLElement) {
  for (let k = 0; k < 200; k++) {
    const r = instances.get(el);
    if (r?.gpu) return r.gpu.pret;
    await new Promise((res) => setTimeout(res, 25));
  }
}
/** Dessine un rouleau hors écran (son état courant) et rend un PNG ; en mode banc, l'image est aussi posée dans son canvas. */
export async function capturerRouleau(el: HTMLElement, fond?: string): Promise<string | null> {
  const r = instances.get(el);
  const g = r?.gpu;
  if (!r || !g) return null;
  if (r.aMesurer) r.mesurer();
  r.rendre();
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
    if (r.canvas.width !== w || r.canvas.height !== h) ((r.canvas.width = w), (r.canvas.height = h));
    const c2 = r.canvas.getContext("2d");
    c2?.clearRect(0, 0, w, h);
    c2?.drawImage(im, 0, 0);
  }
  tex.destroy();
  return url;
}
/** Le diagnostic de compilation des shaders (banc d'essai). */
export async function compilerRouleau(): Promise<string[]> {
  const d = await getDevice();
  const out: string[] = [];
  for (const code of [WGSL, MIP_WGSL]) {
    const info = await d.createShaderModule({ code }).getCompilationInfo();
    for (const x of info.messages) out.push(`${x.type} ${x.lineNum}:${x.linePos} ${x.message}`);
  }
  return out;
}

/* ───────────────────────── Armement ───────────────────────── */

/** Le rouleau d'un conteneur [data-rouleau] (armé au besoin). */
export function rouleau(el: HTMLElement): RouleauApi {
  let r = instances.get(el);
  if (!r) {
    armerGlobal();
    r = new Rouleau(el);
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
          if (r.visible) r.reveiller();
        }
      },
      { rootMargin: "120px" },
    );
    for (const el of instances.keys()) io.observe(el);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) for (const r of instances.values()) r.reveiller();
  });
  // Appareil perdu : chaque rouleau repasse au repli CSS, puis se rebranche (pas après trois pertes).
  onDeviceLost(() => {
    pertes++;
    for (const r of instances.values()) r.debrancher();
    if (pertes >= 3) return console.warn("[presse:rouleau] pertes d'appareil répétées : repli CSS");
    setTimeout(() => {
      for (const r of instances.values()) void r.brancher();
    }, 300);
  });
}

let surveille = false;
/** Arme les conteneurs [data-rouleau] présents et ceux qui arrivent ensuite. */
export function initRouleau(root: ParentNode = document) {
  if (typeof document === "undefined") return;
  armerGlobal();
  const armer = (el: HTMLElement) => void rouleau(el);
  if (root instanceof HTMLElement && root.matches("[data-rouleau]")) armer(root);
  root.querySelectorAll<HTMLElement>("[data-rouleau]").forEach(armer);
  if (root === document && !surveille) {
    surveille = true;
    new MutationObserver((ms) => {
      for (const m of ms) {
        for (const n of m.addedNodes) if (n instanceof HTMLElement) (n.matches("[data-rouleau]") ? armer(n) : n.querySelectorAll<HTMLElement>("[data-rouleau]").forEach(armer));
        for (const n of m.removedNodes)
          if (n instanceof HTMLElement) for (const [el, r] of instances) if (!el.isConnected && (n === el || n.contains(el))) r.detruire();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
}
