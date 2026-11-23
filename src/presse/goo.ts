/**
 * Presse — « goo » : des pièces d'interface qui se touchent fusionnent comme une pâte, s'étirent et se séparent en
 * gouttes. Équivalent par attributs de liquid-gooey (libraries.dev/gooey), sans filtre SVG flou + contraste : la forme
 * fusionnée est calculée par la carte graphique, en champ de distance signé.
 *
 *   <div data-goo data-goo-fill="#fff" data-goo-fusion="18" data-goo-ombre="0 2px 6px rgba(0,0,0,.08)">
 *     <button data-goo-item>☰</button>                                                  (la base, la bascule)
 *     <button data-goo-item data-goo-x="-54" data-goo-y="-34" data-goo-delai="0">…</button>
 *     <button data-goo-item data-goo-x="0" data-goo-y="-64" data-goo-delai="40">…</button>
 *   </div>
 *
 * Conteneur :
 *   data-goo-ouvert          présent = ouvert (chaque pièce va à son décalage), absent = fermé (à sa place d'origine) ;
 *   data-goo-fill            couleur de la pâte (défaut : le fond calculé de la première pièce) ;
 *   data-goo-fusion          rayon de fusion, px (défaut 16) : en deçà, deux pièces se rejoignent par un pont ;
 *   data-goo-ombre           ombre portée « x y flou couleur » (défaut « 0 4px 12px rgba(0,0,0,.14) », « aucune ») ;
 *   data-goo-relief          liseré de lumière en haut de la forme (valeur 0–1, défaut 0.5 si présent sans valeur) ;
 *   data-goo-fixe            l'état n'est piloté que par le script : pas de bascule au clic, pas d'Échap, pas d'inert.
 * Pièce :
 *   data-goo-item            une pièce (16 au plus) : sa boîte et son border-radius sont lus sur le DOM ;
 *   data-goo-x, data-goo-y   décalage à l'état ouvert, px (modifiables à chaud : la pièce y va par son ressort) ;
 *   data-goo-ressort         rebond (défaut) | vif | doux ;
 *   data-goo-duree           (pièce, ou conteneur pour toutes) un trajet minuté au lieu du ressort : durée en ms
 *                            (« 400 », « 400ms », « 0,4s » ; défaut 520 si seule la courbe est donnée) ;
 *   data-goo-courbe          (pièce ou conteneur) la courbe de ce trajet : un nom (`out` par défaut, `out-recul`,
 *                            `out-rebond`…) ou une écriture CSS (`cubic-bezier(.2,0,0,1)`, `steps(4)`, `linear(…)`),
 *                            lue par `easeOf` (src/presse/timeline.ts). Sans l'un ni l'autre : le ressort, inchangé.
 *                            Un trajet interrompu repart de la position courante. La pièce qui suit le pointeur garde
 *                            son ressort ;
 *   data-goo-delai           retard du départ, ms (à la fermeture, l'ordre s'inverse : la dernière sortie rentre d'abord) ;
 *   data-goo-suit            la pièce suit le pointeur dans le conteneur (une goutte qu'on promène) ;
 *   data-goo-bascule         (n'importe quel élément du conteneur) la bascule, à la place de la première pièce.
 *
 * JS : `initGoo(root?)` arme ce qui est là et ce qui arrive ; `goo(el)` → { ouvrir, fermer, basculer, ouvert, mesurer }.
 * Événement `goo:change` (detail.ouvert) sur le conteneur à chaque bascule.
 *
 * Choix du rendu : UN canvas PAR CONTENEUR, glissé dans le conteneur (dernier enfant, position absolue, z-index −1 dans
 * un contexte d'empilement isolé). C'est le plus simple et le plus robuste : il défile avec la page sans une image de
 * retard (un canvas fixe plein écran se redessine après le défilement composité et « nage »), il respecte l'empilement
 * et le rognage du conteneur (une modale ou un bloc sombre posés dessus le couvrent normalement), et il se glisse sous
 * le contenu des pièces sans rien changer à leur mise en page. Les conteneurs sont peu nombreux sur une page et
 * l'appareil, les pipelines et le shader sont partagés : chaque canvas ne coûte qu'une petite chaîne d'images.
 *
 * Sans WebGPU, les pièces gardent leur fond et bougent avec les mêmes ressorts, sans fusion. Mouvement réduit : pas de
 * ressort, les états sont posés. On ne dessine que si quelque chose bouge ; les boîtes ne sont relues qu'au
 * redimensionnement, à l'arrivée des polices et quand une pièce change.
 */
import { getDevice, onDeviceLost } from "../components/device.ts";
import { DUR, springStep, SPRINGS, type Spring } from "./tokens.ts";
import { easeOf, type Ease } from "./timeline.ts";
import { lireTemps } from "../registre/schema/index.ts";
import { lintOn, lintSample } from "./motion-lint.ts";

/* ───────────────────────── Fonctions pures (testées sous Node) ───────────────────────── */

/** Les ressorts de `data-goo-ressort`. « rebond » dépasse franchement sa cible : la goutte arrive, va trop loin, revient. */
export const RESSORTS: Record<"rebond" | "vif" | "doux", Spring> = {
  rebond: { k: 250, zeta: 0.42 },
  vif: SPRINGS.vif,
  doux: { k: 70, zeta: 0.92 },
};
export const MAX_PIECES = 16;
export const FUSION_DEFAUT = 16;
export const OMBRE_DEFAUT = "0 4px 12px rgba(0,0,0,.14)";

export type Ombre = { x: number; y: number; flou: number; couleur: string };

/** Lit une ombre au format CSS box-shadow simple (« x y [flou] couleur ») ; `null` pour « aucune » / « none ». */
export function lireOmbre(s: string | null | undefined): Ombre | null {
  const v = (s ?? OMBRE_DEFAUT).trim();
  if (!v || /^(aucune|none|0)$/i.test(v)) return null;
  // Découpe en jetons hors parenthèses (rgba(0, 0, 0, .1) reste entier).
  const jetons: string[] = [];
  let cur = "";
  let prof = 0;
  for (const ch of v) {
    if (ch === "(") prof++;
    if (ch === ")") prof--;
    if (/\s/.test(ch) && prof === 0) {
      if (cur) jetons.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) jetons.push(cur);
  const nums: number[] = [];
  const couleur: string[] = [];
  for (const j of jetons) {
    if (/^-?(\d+\.?\d*|\.\d+)(px)?$/.test(j)) nums.push(Number.parseFloat(j));
    else couleur.push(j);
  }
  if (nums.length < 2) return null;
  return { x: nums[0]!, y: nums[1]!, flou: Math.max(0, nums[2] ?? 0), couleur: couleur.join(" ") || "rgba(0,0,0,.2)" };
}

/** Minimum lissé polynomial (k = rayon de fusion) : le même que dans le shader. */
export function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Distance signée à un rectangle arrondi centré (demi-tailles hw, hh, rayon r) : la même que dans le shader. */
export function sdRect(px: number, py: number, hw: number, hh: number, r: number) {
  const rr = Math.min(r, hw, hh);
  const qx = Math.abs(px) - hw + rr;
  const qy = Math.abs(py) - hh + rr;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
}

/** Le retard d'une pièce : tel quel à l'ouverture, inversé à la fermeture (la dernière sortie rentre la première). */
export function delaiEffectif(delai: number, maxDelai: number, ouverture: boolean) {
  return Math.max(0, ouverture ? delai : maxDelai - delai);
}

/** Un rayon CSS calculé (« 12px », « 50% », « 12px 8px ») ramené en px pour une boîte w × h. */
export function rayonCss(v: string, w: number, h: number) {
  const t = v.trim().split(/\s+/)[0] ?? "0";
  const n = Number.parseFloat(t) || 0;
  const r = t.endsWith("%") ? (n / 100) * Math.min(w, h) : n;
  return Math.max(0, Math.min(r, w / 2, h / 2));
}

/** Avance un ressort de dt secondes par petits pas (stable même avec un ressort raide et une image lente). */
export function avancer(x: number, v: number, cible: number, dt: number, s: Spring): [number, number] {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) [x, v] = springStep(x, v, cible, h, s);
  return [x, v];
}

/** Un trajet minuté (`data-goo-duree` / `-courbe`) : durée (ms) et courbe. */
export type Trajet = { duree: number; f: Ease };
export const DUREE_TRAJET = DUR[2];
type DatasetGoo = { gooDuree?: string; gooCourbe?: string };
/** Le trajet d'une pièce (ses attributs, sinon ceux du conteneur) ; `null` : le ressort, comme avant. */
export function lireTrajet(piece: DatasetGoo, conteneur: DatasetGoo = {}): Trajet | null {
  const d = piece.gooDuree ?? conteneur.gooDuree;
  const c = piece.gooCourbe ?? conteneur.gooCourbe;
  if (d === undefined && c === undefined) return null;
  const ms = d === undefined ? null : lireTemps(d, "ms");
  return { duree: ms === null || ms <= 0 ? DUREE_TRAJET : Math.min(10000, Math.max(16, ms)), f: easeOf(c ?? "out") };
}
/** La position sur un trajet de `de` à `vers`, `ecoule` ms après son départ ; vrai s'il est fini. */
export function surTrajet(de: number, vers: number, ecoule: number, t: Trajet): [number, boolean] {
  const p = ecoule / t.duree;
  if (p >= 1 || de === vers) return [vers, true];
  return [de + (vers - de) * t.f(Math.max(0, p)), false];
}

/* ───────────────────────── CSS ───────────────────────── */

const CSS = `
[data-goo] { isolation: isolate; }
.goo-canvas { position: absolute !important; z-index: -1 !important; pointer-events: none; display: block; margin: 0; padding: 0; border: 0; }
.goo-gpu > [data-goo-item] { background: transparent !important; box-shadow: none !important; border-color: transparent !important; }
[data-goo] > [data-goo-item] { will-change: translate; }
[data-goo] > [data-goo-item][inert] { pointer-events: none; }
`;
let cssPose = false;
function poserCss() {
  if (cssPose) return;
  cssPose = true;
  const st = document.createElement("style");
  st.dataset.presseGoo = "";
  st.textContent = CSS;
  document.head.append(st);
}

/* ───────────────────────── Shader ───────────────────────── */

const WGSL = /* wgsl */ `
struct U {
  res: vec4f,      // largeur, hauteur du canvas (px appareil), dpr, nombre de pièces
  fill: vec4f,     // couleur de la pâte (non prémultipliée)
  ombre: vec4f,    // décalage x, y (px appareil), flou (px appareil), rayon de fusion k (px appareil)
  ombreCol: vec4f, // couleur de l'ombre (non prémultipliée)
  misc: vec4f,     // relief (0–1), _, _, _
  p: array<vec4f, 32>, // par pièce : (cx, cy, demi-largeur, demi-hauteur), (rayon, _, _, _)
};
@group(0) @binding(0) var<uniform> u: U;

struct VO { @builtin(position) pos: vec4f, @location(0) px: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  // Un triangle qui couvre tout le canvas.
  let c = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VO;
  o.pos = vec4f(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);
  o.px = c * u.res.xy;
  return o;
}

fn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}
// Minimum lissé : deux formes à moins de k l'une de l'autre se rejoignent par un pont, qui s'amincit puis casse.
fn smin(a: f32, b: f32, k: f32) -> f32 {
  if (k <= 0.0) { return min(a, b); }
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
// Le champ de la forme fusionnée, en px appareil (négatif dedans).
fn champ(p: vec2f) -> f32 {
  var d = 1e5;
  let n = u32(u.res.w);
  for (var i = 0u; i < n; i++) {
    let a = u.p[2u * i];
    let r = u.p[2u * i + 1u].x;
    d = smin(d, sdrb(p - a.xy, a.zw, min(r, min(a.z, a.w))), u.ombre.w);
  }
  return d;
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let p = i.px;
  let d = champ(p);
  // Bord antialiasé au pixel : la pente réelle du champ (moins de 1 dans un pont, où le minimum lissé l'adoucit).
  let g = vec2f(dpdx(d), dpdy(d));
  let gl = max(length(g), 1e-3);
  let cov = clamp(0.5 - d / gl, 0.0, 1.0);
  let n = g / gl; // normale sortante, en écran (y vers le bas)
  let dpr = u.res.z;

  // Relief : un liseré de lumière sur le haut de la forme, un soupçon d'ombre propre en bas.
  var col = u.fill.rgb;
  let rel = u.misc.x;
  if (rel > 0.0) {
    let bord = 1.0 - smoothstep(0.0, 2.2 * dpr, -d);
    let haut = max(0.0, -n.y);
    let bas = max(0.0, n.y);
    col = mix(col, vec3f(1.0), clamp(bord * haut * haut * rel * 0.85, 0.0, 1.0));
    col = col * (1.0 - (1.0 - smoothstep(0.0, 5.0 * dpr, -d)) * bas * rel * 0.16);
  }
  let fa = u.fill.a * cov;
  var out = vec4f(col * fa, fa);

  // Ombre portée : le même champ, décalé, passé dans une sigmoïde (≈ la répartition d'un flou gaussien).
  if (u.ombreCol.a > 0.0) {
    let ds = champ(p - u.ombre.xy);
    let sigma = max(u.ombre.z * 0.5, 0.5);
    let sa = u.ombreCol.a / (1.0 + exp(1.702 * ds / sigma));
    out = out + vec4f(u.ombreCol.rgb * sa, sa) * (1.0 - fa);
  }
  return out;
}
`;

/* ───────────────────────── GPU partagé ───────────────────────── */

type Partage = { device: GPUDevice; layout: GPUBindGroupLayout; mod: GPUShaderModule; pipes: Map<GPUTextureFormat, GPURenderPipeline> };
let partage: Partage | null = null;
function partageDe(device: GPUDevice): Partage {
  if (partage && partage.device === device) return partage;
  const mod = device.createShaderModule({ code: WGSL, label: "presse-goo" });
  const layout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }] });
  partage = { device, layout, mod, pipes: new Map() };
  return partage;
}
/** Le pipeline pour un format de cible (celui du canvas ; rgba8unorm pour une capture hors écran). */
function pipeDe(s: Partage, format: GPUTextureFormat) {
  let p = s.pipes.get(format);
  if (!p) {
    const blend: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } };
    p = s.device.createRenderPipeline({
      label: `presse-goo-${format}`,
      layout: s.device.createPipelineLayout({ bindGroupLayouts: [s.layout] }),
      vertex: { module: s.mod, entryPoint: "vs" },
      fragment: { module: s.mod, entryPoint: "fs", targets: [{ format, blend }] },
      primitive: { topology: "triangle-list" },
    });
    s.pipes.set(format, p);
  }
  return p;
}

/**
 * Mode banc d'essai (`globalThis.__presseBanc = true` avant l'armement, ou `?presse-banc` dans l'adresse) : aucun
 * contexte WebGPU n'est ouvert sur un canvas à l'écran ; tout le reste tourne (ressorts, uniformes), et
 * `capturerGoo(el)` dessine l'état courant dans une texture hors écran. Sert aux environnements où un canvas WebGPU
 * affiché perd l'appareil (conteneurs sans compositeur GPU).
 */
export const modeBanc = () => typeof globalThis !== "undefined" && (!!(globalThis as { __presseBanc?: boolean }).__presseBanc || (typeof location !== "undefined" && /[?&]presse-banc\b/.test(location.search)));

const UFLOATS = 4 * 5 + 4 * 32;

class GooGpu {
  readonly ctx: GPUCanvasContext | null;
  readonly format: GPUTextureFormat;
  readonly ubuf: GPUBuffer;
  readonly bind: GPUBindGroup;
  readonly data = new Float32Array(UFLOATS);
  readonly s: Partage;
  constructor(s: Partage, canvas: HTMLCanvasElement | null) {
    this.s = s;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.ctx = canvas ? canvas.getContext("webgpu") : null;
    this.ctx?.configure({ device: s.device, format: this.format, alphaMode: "premultiplied" });
    this.ubuf = s.device.createBuffer({ size: UFLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.bind = s.device.createBindGroup({ layout: s.layout, entries: [{ binding: 0, resource: { buffer: this.ubuf } }] });
  }
  /** Dessine les uniformes courants dans une vue de texture quelconque (le canvas, ou une texture du banc). */
  dessinerDans(view: GPUTextureView, format: GPUTextureFormat) {
    const dev = this.s.device;
    dev.queue.writeBuffer(this.ubuf, 0, this.data);
    const enc = dev.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    pass.setPipeline(pipeDe(this.s, format));
    pass.setBindGroup(0, this.bind);
    pass.draw(3);
    pass.end();
    dev.queue.submit([enc.finish()]);
  }
  dessiner() {
    if (this.ctx) this.dessinerDans(this.ctx.getCurrentTexture().createView(), this.format);
  }
  detruire() {
    this.ubuf.destroy();
    try {
      this.ctx?.unconfigure();
    } catch {
      /* déjà perdu */
    }
  }
}

/** Lit une texture rgba8unorm (prémultipliée) et la rend en PNG (data URL), posée sur `fond` si donné. */
export async function textureEnPng(device: GPUDevice, tex: GPUTexture, w: number, h: number, fond?: string): Promise<string> {
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
      // Prémultiplié → droit, pour le canvas 2D.
      img.data[o] = a ? Math.min(255, (src[i]! * 255) / a) : 0;
      img.data[o + 1] = a ? Math.min(255, (src[i + 1]! * 255) / a) : 0;
      img.data[o + 2] = a ? Math.min(255, (src[i + 2]! * 255) / a) : 0;
      img.data[o + 3] = a;
    }
  buf.unmap();
  buf.destroy();
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const t = document.createElement("canvas");
  t.width = w;
  t.height = h;
  t.getContext("2d")!.putImageData(img, 0, 0);
  if (fond) ((g.fillStyle = fond), g.fillRect(0, 0, w, h));
  g.drawImage(t, 0, 0);
  return c.toDataURL("image/png");
}

/** Une couleur CSS quelconque en [r, g, b, a] (0–1), lue par un petit canvas 2D (toutes les syntaxes CSS). */
let c2d: CanvasRenderingContext2D | null = null;
function rgba(css: string, repli: [number, number, number, number]): [number, number, number, number] {
  try {
    c2d ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
    if (!c2d) return repli;
    c2d.clearRect(0, 0, 1, 1);
    c2d.fillStyle = "#000";
    c2d.fillStyle = css;
    c2d.fillRect(0, 0, 1, 1);
    const d = c2d.getImageData(0, 0, 1, 1).data;
    const a = d[3]! / 255;
    if (a === 0) return [0, 0, 0, 0];
    return [d[0]! / 255 / a, d[1]! / 255 / a, d[2]! / 255 / a, a];
  } catch {
    return repli;
  }
}

/* ───────────────────────── Une pâte ───────────────────────── */

type Piece = {
  el: HTMLElement;
  /** Boîte au repos, relative au bord intérieur (padding box) du conteneur, sans notre translate. */
  bx: number;
  by: number;
  w: number;
  h: number;
  r: number;
  ox: number;
  oy: number;
  delai: number;
  ressort: Spring;
  /** Trajet minuté (data-goo-duree / -courbe) ; null : le ressort. */
  trajet: Trajet | null;
  /** Le trajet en cours : départ (position, horloge) et cible. */
  t0: number;
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  suit: boolean;
  satellite: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  /** La cible qui attend son retard. */
  px: number;
  py: number;
  depart: number;
  ecrit: string;
  /** Le translate réellement écrit sur l'élément (la mesure le retranche). */
  wx: number;
  wy: number;
  op: number;
};

const reduitQ = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const num = (s: string | undefined, d = 0) => {
  const n = Number.parseFloat(s ?? "");
  return Number.isFinite(n) ? n : d;
};

export type GooApi = { ouvrir(): void; fermer(): void; basculer(): void; readonly ouvert: boolean; mesurer(): void };

const instances = new Map<HTMLElement, Goo>();

class Goo {
  pieces: Piece[] = [];
  ouvert: boolean;
  gpu: GooGpu | null = null;
  canvas: HTMLCanvasElement | null = null;
  raf = 0;
  last = 0;
  /** L'horloge propre de la pâte (ms) : les retards s'y comptent, et le banc d'essai peut l'avancer pas à pas. */
  horloge = 0;
  reduit = reduitQ();
  /** Zone du canvas, relative à la padding box du conteneur (px CSS). */
  zone = { x: 0, y: 0, w: 0, h: 0 };
  dpr = 1;
  fill: [number, number, number, number] = [1, 1, 1, 1];
  ombre: Ombre | null = null;
  ombreCol: [number, number, number, number] = [0, 0, 0, 0];
  fusion = FUSION_DEFAUT;
  relief = 0;
  fixe: boolean;
  bascule: HTMLElement | null = null;
  rectCont: DOMRect | null = null;
  ptr: { x: number; y: number } | null = null;
  ro: ResizeObserver | null = null;
  mo: MutationObserver;
  aMesurer = true;
  sale = true;
  fin = false;
  readonly el: HTMLElement;
  constructor(el: HTMLElement) {
    this.el = el;
    poserCss();
    this.ouvert = el.hasAttribute("data-goo-ouvert");
    this.fixe = el.hasAttribute("data-goo-fixe");
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    this.collecter();
    this.lireReglages();
    this.lireCouleur();
    this.poserEtat(true);
    // Les attributs qui changent à chaud.
    this.mo = new MutationObserver((ms) => {
      let recolle = false;
      let recible = false;
      for (const m of ms) {
        if (m.type === "childList") {
          for (const n of [...m.addedNodes, ...m.removedNodes]) if (n !== this.canvas && n instanceof HTMLElement && (n.hasAttribute("data-goo-item") || n.querySelector("[data-goo-item]"))) recolle = true;
        } else if (m.target === el) {
          if (m.attributeName === "data-goo-ouvert") {
            const o = el.hasAttribute("data-goo-ouvert");
            if (o !== this.ouvert) this.changer(o, false);
          } else {
            this.lireReglages();
            this.lireCouleur();
            if (m.attributeName === "data-goo-duree" || m.attributeName === "data-goo-courbe") this.lireCibles();
            this.aMesurer = true;
            this.reveiller();
          }
        } else recible = true;
      }
      if (recolle) (this.collecter(), this.ombreRepli(), (this.aMesurer = true), this.poserEtat(false), this.reveiller());
      else if (recible) (this.lireCibles(), this.poserEtat(this.reduit, this.horloge, !this.reduit), (this.aMesurer = true), this.reveiller());
    });
    this.mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-goo-ouvert", "data-goo-fill", "data-goo-fusion", "data-goo-ombre", "data-goo-relief", "data-goo-x", "data-goo-y", "data-goo-delai", "data-goo-ressort", "data-goo-duree", "data-goo-courbe"] });
    if (typeof ResizeObserver === "function") {
      this.ro = new ResizeObserver(() => ((this.aMesurer = true), this.reveiller()));
      this.ro.observe(el);
      for (const p of this.pieces) this.ro.observe(p.el);
    }
    void document.fonts?.ready.then(() => ((this.aMesurer = true), this.reveiller()));
    // Clic : la bascule.
    el.addEventListener("click", this.onClick);
    el.addEventListener("pointermove", this.onPtr);
    el.addEventListener("pointerdown", this.onPtr);
    el.addEventListener("pointerleave", this.onLeave);
    addEventListener("scroll", this.onScroll, { passive: true, capture: true });
    addEventListener("resize", this.onScroll);
    matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", (e) => ((this.reduit = e.matches), this.reveiller()));
    void this.brancherGpu();
    this.reveiller();
  }

  /* ── Lecture du DOM (jamais à chaque image) ── */
  collecter() {
    const els = [...this.el.querySelectorAll<HTMLElement>(":scope > [data-goo-item]")].slice(0, MAX_PIECES);
    const vieux = new Map(this.pieces.map((p) => [p.el, p]));
    this.pieces = els.map(
      (e) =>
        vieux.get(e) ?? {
          el: e,
          bx: 0,
          by: 0,
          w: 0,
          h: 0,
          r: 0,
          ox: 0,
          oy: 0,
          delai: 0,
          ressort: RESSORTS.rebond,
          trajet: null,
          t0: 0,
          x0: 0,
          y0: 0,
          cx: Number.NaN,
          cy: Number.NaN,
          suit: false,
          satellite: false,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          tx: 0,
          ty: 0,
          px: 0,
          py: 0,
          depart: 0,
          ecrit: "",
          wx: 0,
          wy: 0,
          op: -1,
        },
    );
    for (const p of this.pieces) if (!vieux.has(p.el)) this.ro?.observe(p.el);
    if (this.el.querySelectorAll("[data-goo-item]").length > MAX_PIECES) console.warn(`[presse:goo] ${MAX_PIECES} pièces au plus par conteneur`, this.el);
    this.bascule = this.fixe ? null : (this.el.querySelector<HTMLElement>("[data-goo-bascule]") ?? this.pieces[0]?.el ?? null);
    this.lireCibles();
    // Sans WebGPU, les pièces se recouvrent par leur fond : la base passe devant celles qu'elle cache.
    this.pieces.forEach((p, k) => {
      if (getComputedStyle(p.el).position === "static") p.el.style.position = "relative";
      p.el.style.zIndex = p.el === this.bascule ? "3" : p.suit ? "2" : k === 0 ? "2" : "1";
    });
  }
  lireCibles() {
    for (const p of this.pieces) {
      const d = p.el.dataset;
      p.ox = num(d.gooX);
      p.oy = num(d.gooY);
      p.delai = Math.max(0, num(d.gooDelai));
      p.ressort = RESSORTS[(d.gooRessort ?? "rebond") as keyof typeof RESSORTS] ?? RESSORTS.rebond;
      p.trajet = lireTrajet(d, this.el.dataset);
      p.suit = d.gooSuit !== undefined;
      p.satellite = !p.suit && (d.gooX !== undefined || d.gooY !== undefined) && p.el !== this.bascule;
    }
  }
  lireReglages() {
    const d = this.el.dataset;
    this.fusion = Math.max(0, num(d.gooFusion, FUSION_DEFAUT));
    this.ombre = lireOmbre(d.gooOmbre);
    this.ombreCol = this.ombre ? rgba(this.ombre.couleur, [0, 0, 0, 0.15]) : [0, 0, 0, 0];
    this.relief = d.gooRelief === undefined ? 0 : d.gooRelief === "" ? 0.5 : Math.min(1, Math.max(0, num(d.gooRelief, 0.5)));
    this.ombreRepli();
  }
  /** Sans WebGPU, chaque pièce porte l'ombre en CSS (le rendu GPU l'efface : .goo-gpu > [data-goo-item]). */
  ombreRepli() {
    const o = this.ombre;
    const v = o ? `${o.x}px ${o.y}px ${o.flou}px ${o.couleur}` : "";
    for (const p of this.pieces) if (!p.suit || o) p.el.style.boxShadow = v;
  }
  lireCouleur() {
    const f = this.el.dataset.gooFill;
    if (f) this.fill = rgba(f, [1, 1, 1, 1]);
    else if (!this.gpu && this.pieces[0]) {
      // Le fond de la première pièce, lu avant que le rendu GPU ne le rende transparent.
      const c = rgba(getComputedStyle(this.pieces[0].el).backgroundColor, [1, 1, 1, 1]);
      this.fill = c[3] > 0 ? c : [1, 1, 1, 1];
    }
  }
  mesurer() {
    this.aMesurer = false;
    const cr = this.el.getBoundingClientRect();
    const ox = cr.left + this.el.clientLeft;
    const oy = cr.top + this.el.clientTop;
    this.rectCont = cr;
    let x0 = 0;
    let y0 = 0;
    let x1 = this.el.clientWidth;
    let y1 = this.el.clientHeight;
    for (const p of this.pieces) {
      const r = p.el.getBoundingClientRect();
      p.w = r.width;
      p.h = r.height;
      p.bx = r.left - ox - p.wx;
      p.by = r.top - oy - p.wy;
      p.r = rayonCss(getComputedStyle(p.el).borderTopLeftRadius, p.w, p.h);
      for (const [dx, dy] of [
        [0, 0],
        [p.ox, p.oy],
      ] as const) {
        x0 = Math.min(x0, p.bx + dx);
        y0 = Math.min(y0, p.by + dy);
        x1 = Math.max(x1, p.bx + dx + p.w);
        y1 = Math.max(y1, p.by + dy + p.h);
      }
    }
    // La marge : l'ombre, le dépassement d'un ressort qui rebondit, la fusion.
    const o = this.ombre;
    const m = Math.ceil((o ? o.flou * 1.6 + Math.max(Math.abs(o.x), Math.abs(o.y)) : 0) + this.fusion * 0.5 + 24);
    this.zone = { x: Math.floor(x0 - m), y: Math.floor(y0 - m), w: Math.ceil(x1 - x0 + 2 * m), h: Math.ceil(y1 - y0 + 2 * m) };
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    if (this.canvas) {
      const c = this.canvas;
      Object.assign(c.style, { left: `${this.zone.x}px`, top: `${this.zone.y}px`, width: `${this.zone.w}px`, height: `${this.zone.h}px` });
      const cw = Math.max(1, Math.round(this.zone.w * this.dpr));
      const ch = Math.max(1, Math.round(this.zone.h * this.dpr));
      if (c.width !== cw || c.height !== ch) ((c.width = cw), (c.height = ch));
    }
    this.sale = true;
  }

  /* ── État ── */
  /** Pose les cibles selon l'état ; `immediat` : sans ressort (premier armement, mouvement réduit). */
  poserEtat(immediat: boolean, now = this.horloge, avecDelai = false) {
    const maxD = Math.max(0, ...this.pieces.map((p) => p.delai));
    for (const p of this.pieces) {
      if (p.suit) continue;
      const cx = this.ouvert ? p.ox : 0;
      const cy = this.ouvert ? p.oy : 0;
      p.px = cx;
      p.py = cy;
      p.depart = avecDelai ? now + delaiEffectif(p.delai, maxD, this.ouvert) : now;
      if (immediat) ((p.x = p.tx = cx), (p.y = p.ty = cy), (p.vx = p.vy = 0));
    }
    this.poserAria();
  }
  poserAria() {
    if (this.fixe) return;
    this.bascule?.setAttribute("aria-expanded", String(this.ouvert));
    for (const p of this.pieces) {
      if (!p.satellite) continue;
      if (this.ouvert) p.el.inert = false;
      else {
        if (p.el.contains(document.activeElement)) this.bascule?.focus({ preventScroll: true });
        p.el.inert = true;
      }
    }
  }
  changer(ouvert: boolean, ecrireAttr = true) {
    if (ouvert === this.ouvert) return;
    this.ouvert = ouvert;
    if (ecrireAttr) this.el.toggleAttribute("data-goo-ouvert", ouvert);
    this.poserEtat(this.reduit, this.horloge, !this.reduit);
    if (ouvert) addEventListener("keydown", this.onKey, true);
    else removeEventListener("keydown", this.onKey, true);
    this.el.dispatchEvent(new CustomEvent("goo:change", { detail: { ouvert }, bubbles: true }));
    this.reveiller();
  }

  /* ── Événements ── */
  onClick = (e: MouseEvent) => {
    if (this.fixe || !this.bascule) return;
    const t = e.target as Element;
    if (this.bascule.contains(t)) this.changer(!this.ouvert);
  };
  onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !this.ouvert || this.fixe) return;
    const dedans = this.el.contains(document.activeElement);
    this.changer(false);
    if (dedans) this.bascule?.focus({ preventScroll: true });
    if (dedans) e.stopPropagation();
  };
  onScroll = () => {
    this.rectCont = null;
    if (!this.gpu) return;
    // La boîte du conteneur peut bouger sans changer de taille (mise en page autour) : relue au prochain mouvement.
  };
  onPtr = (e: PointerEvent) => {
    if (!this.pieces.some((p) => p.suit)) return;
    this.rectCont ??= this.el.getBoundingClientRect();
    this.ptr = { x: e.clientX - this.rectCont.left - this.el.clientLeft, y: e.clientY - this.rectCont.top - this.el.clientTop };
    this.ciblerSuiveurs();
  };
  onLeave = () => {
    if (!this.ptr) return;
    this.ptr = null;
    this.ciblerSuiveurs();
  };
  ciblerSuiveurs() {
    const now = this.horloge;
    for (const p of this.pieces) {
      if (!p.suit) continue;
      const cx = this.ptr ? this.ptr.x - p.bx - p.w / 2 : this.ouvert ? p.ox : 0;
      const cy = this.ptr ? this.ptr.y - p.by - p.h / 2 : this.ouvert ? p.oy : 0;
      p.px = cx;
      p.py = cy;
      p.depart = now;
      if (this.reduit) ((p.x = p.tx = cx), (p.y = p.ty = cy));
    }
    this.reveiller();
  }

  /* ── GPU ── */
  async brancherGpu() {
    try {
      const device = await getDevice();
      if (this.fin || this.gpu) return;
      // Une perte « destroyed » n'est pas relayée par device.ts (elle est d'ordinaire volontaire) : si l'appareil de
      // cette pâte s'en va quand même, elle repasse au repli DOM plutôt que de rester sans fond.
      void device.lost.then((info) => {
        if (info.reason === "destroyed" && this.gpu) this.perdreGpu();
      });
      const s = partageDe(device);
      const c = this.canvas ?? document.createElement("canvas");
      c.className = "goo-canvas";
      c.setAttribute("aria-hidden", "true");
      if (!c.isConnected) this.el.append(c);
      this.canvas = c;
      this.gpu = new GooGpu(s, modeBanc() ? null : c);
      this.el.classList.add("goo-gpu");
      this.aMesurer = true;
      this.reveiller();
    } catch {
      /* sans WebGPU : le repli DOM (les pièces gardent leur fond) */
    }
  }
  perdreGpu() {
    this.gpu?.detruire();
    this.gpu = null;
    this.canvas?.remove();
    this.canvas = null;
    this.el.classList.remove("goo-gpu");
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
    const bouge = this.pas(dt, now) || fige;
    this.rendre();
    if (bouge) this.reveiller();
  };
  rendre() {
    if (this.gpu && this.sale) {
      this.remplir();
      try {
        this.gpu.dessiner();
      } catch (e) {
        console.warn("[presse:goo] dessin", e);
      }
    }
    this.sale = false;
  }
  /** Avance les ressorts de dt secondes ; rend vrai si quelque chose bouge encore (ou attend son retard). */
  pas(dt: number, now: number) {
    this.horloge += dt * 1000;
    let bouge = false;
    for (const p of this.pieces) {
      if (this.horloge >= p.depart) ((p.tx = p.px), (p.ty = p.py));
      else bouge = true;
      if (this.reduit) ((p.x = p.tx), (p.y = p.ty), (p.vx = p.vy = 0));
      else if (p.trajet && !p.suit) {
        // Trajet minuté : une nouvelle cible repart de la position courante.
        if (p.tx !== p.cx || p.ty !== p.cy) ((p.x0 = p.x), (p.y0 = p.y), (p.t0 = this.horloge - dt * 1000), (p.cx = p.tx), (p.cy = p.ty));
        const ecoule = this.horloge - p.t0;
        const [x, finiX] = surTrajet(p.x0, p.cx, ecoule, p.trajet);
        const [y, finiY] = surTrajet(p.y0, p.cy, ecoule, p.trajet);
        p.vx = dt > 0 ? (x - p.x) / dt : 0;
        p.vy = dt > 0 ? (y - p.y) / dt : 0;
        p.x = x;
        p.y = y;
        if (finiX && finiY) p.vx = p.vy = 0;
        else bouge = true;
      } else {
        [p.x, p.vx] = avancer(p.x, p.vx, p.tx, dt, p.ressort);
        [p.y, p.vy] = avancer(p.y, p.vy, p.ty, dt, p.ressort);
        if (Math.abs(p.x - p.tx) < 0.02 && Math.abs(p.vx) < 0.3) ((p.x = p.tx), (p.vx = 0));
        else bouge = true;
        if (Math.abs(p.y - p.ty) < 0.02 && Math.abs(p.vy) < 0.3) ((p.y = p.ty), (p.vy = 0));
        else bouge = true;
      }
      const wx = Math.round(p.x * 100) / 100;
      const wy = Math.round(p.y * 100) / 100;
      if (wx !== p.wx || wy !== p.wy || !p.ecrit) {
        p.wx = wx;
        p.wy = wy;
        p.ecrit = `${wx}px ${wy}px`;
        p.el.style.translate = p.ecrit;
        this.sale = true;
      }
      // Un satellite caché derrière la base n'y montre pas son icône : son contenu paraît en sortant.
      if (p.satellite && !this.fixe) {
        const loin = Math.hypot(p.ox, p.oy);
        // Le contenu paraît sur la fin de la course (les 64 derniers px), pas au milieu d'un vol où il croiserait les autres.
        const fait = Math.hypot(p.x, p.y);
        const e = loin > 0 ? Math.min(1, Math.max(0, (fait - Math.max(loin * 0.2, loin - 64)) / Math.min(44, loin * 0.6))) : 1;
        const op = Math.round(e * e * (3 - 2 * e) * 100) / 100;
        if (op !== p.op) ((p.op = op), (p.el.style.opacity = String(op)));
      }
      if (lintOn()) {
        lintSample(p.el, "x", p.x, now);
        lintSample(p.el, "y", p.y, now);
      }
    }
    return bouge;
  }
  remplir() {
    const d = this.gpu!.data;
    const k = this.dpr;
    const z = this.zone;
    const n = Math.min(MAX_PIECES, this.pieces.length);
    d[0] = Math.round(z.w * k);
    d[1] = Math.round(z.h * k);
    d[2] = k;
    let m = 0;
    for (let i = 0; i < n; i++) {
      const p = this.pieces[i]!;
      if (p.w < 0.5 || p.h < 0.5) continue;
      const o = 20 + m * 8;
      d[o] = (p.bx + p.x + p.w / 2 - z.x) * k;
      d[o + 1] = (p.by + p.y + p.h / 2 - z.y) * k;
      d[o + 2] = (p.w / 2) * k;
      d[o + 3] = (p.h / 2) * k;
      d[o + 4] = p.r * k;
      m++;
    }
    d[3] = m;
    d.set(this.fill, 4);
    const o = this.ombre;
    d[8] = (o?.x ?? 0) * k;
    d[9] = (o?.y ?? 0) * k;
    d[10] = (o?.flou ?? 0) * k;
    d[11] = this.fusion * k;
    d.set(this.ombreCol, 12);
    d[16] = this.relief;
  }

  api(): GooApi {
    const g = this;
    return {
      ouvrir: () => g.changer(true),
      fermer: () => g.changer(false),
      basculer: () => g.changer(!g.ouvert),
      get ouvert() {
        return g.ouvert;
      },
      mesurer: () => ((g.aMesurer = true), g.reveiller()),
    };
  }
}

let fige = false;
/** Banc d'essai : fige (ou relâche) le temps de toutes les pâtes, pour capturer un instant précis d'un mouvement. */
export function figerGoo(on: boolean) {
  fige = on;
  if (!on) for (const g of instances.values()) g.reveiller();
}
/** Banc d'essai : avance toutes les pâtes de `ms` millisecondes, par pas de 1/60 s (à utiliser temps figé). */
export function avancerGoo(ms: number) {
  for (const g of instances.values()) {
    if (g.aMesurer) g.mesurer();
    for (let t = 0; t < ms - 1e-6; t += 1000 / 60) g.pas(Math.min(1000 / 60, ms - t) / 1000, performance.now());
    g.rendre();
  }
}

/**
 * Banc d'essai : dessine l'état courant d'une pâte dans une texture hors écran et rend un PNG (data URL). En mode
 * banc, l'image est aussi posée (canvas 2D) dans le canvas de la pâte : une capture d'écran de la page montre alors
 * la forme GPU sous le contenu DOM, comme en vrai.
 */
export async function capturerGoo(el: HTMLElement, fond?: string): Promise<string | null> {
  const g = instances.get(el);
  if (!g?.gpu) return null;
  if (g.aMesurer) g.mesurer();
  g.remplir();
  const w = g.gpu.data[0]!;
  const h = g.gpu.data[1]!;
  const dev = g.gpu.s.device;
  const tex = dev.createTexture({ size: [w, h], format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  g.gpu.dessinerDans(tex.createView(), "rgba8unorm");
  const url = await textureEnPng(dev, tex, w, h, fond);
  if (modeBanc() && g.canvas) {
    const im = new Image();
    im.src = fond ? await textureEnPng(dev, tex, w, h) : url;
    await im.decode();
    const c2 = g.canvas.getContext("2d");
    c2?.clearRect(0, 0, w, h);
    c2?.drawImage(im, 0, 0);
  }
  tex.destroy();
  return url;
}

/** La pâte d'un conteneur [data-goo] (armée au besoin). */
export function goo(el: HTMLElement): GooApi {
  let g = instances.get(el);
  if (!g) {
    g = new Goo(el);
    instances.set(el, g);
  }
  return g.api();
}

let surveille = false;
/** Arme les conteneurs [data-goo] présents et ceux qui arrivent ensuite. */
export function initGoo(root: ParentNode = document) {
  if (typeof document === "undefined") return;
  const armer = (el: HTMLElement) => void goo(el);
  if (root instanceof HTMLElement && root.matches("[data-goo]")) armer(root);
  root.querySelectorAll<HTMLElement>("[data-goo]").forEach(armer);
  if (root === document && !surveille) {
    surveille = true;
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement) (n.matches("[data-goo]") ? armer(n) : n.querySelectorAll<HTMLElement>("[data-goo]").forEach(armer));
    }).observe(document.body, { childList: true, subtree: true });
    // Appareil perdu : chaque pâte repasse au repli DOM, puis se rebranche sur le nouvel appareil.
    onDeviceLost(() => {
      for (const g of instances.values()) g.perdreGpu();
      setTimeout(() => {
        for (const g of instances.values()) void g.brancherGpu();
      }, 300);
    });
  }
}
