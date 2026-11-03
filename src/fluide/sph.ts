/**
 * Fluide SPH 2D, tout en calcul WebGPU.
 *
 * D'après « GPGPU 2D SPH » de Robert Leitl (WebGL 2, MIT) pour l'idée et la mise en scène : un champ de particules
 * qu'on remue au pointeur, colorées par leur vitesse. La physique n'est pas la sienne (Müller 2003, poly6 / spiky) : on
 * prend la variante « densité + densité proche » (Clavet 2005, popularisée par Sebastian Lague), bien plus stable — la
 * pression proche empêche les particules de s'agglutiner, le fluide tient sans exploser même très comprimé.
 *
 * Chaque sous-pas (3 par image par défaut), neuf passes de calcul dans une seule passe de commande :
 *   1. vider   : les compteurs de la grille à zéro ;
 *   2. dehors  : gravité (orientable), pointeur (remuer, attirer, repousser), position prédite (v / 120 s plus loin) ;
 *                la particule s'inscrit dans sa cellule (atomicAdd : son rang dans la cellule) ;
 *   3. somme   : préfixe exclusif des compteurs (un groupe de 256 fils) → début de chaque cellule ;
 *   4. ranger  : chaque particule recopiée à sa place, triée par cellule (les voisines sont contiguës en mémoire),
 *                puis, dans chaque cellule, par indice d'origine (ordre stable : la simulation est déterministe) ;
 *   5. densité : densité et densité proche (noyaux spiky² et spiky³), 3 × 3 cellules de côté h ;
 *   6. forces  : pression partagée, pression proche, viscosité (poly6) → nouvelle vitesse ;
 *   7. avancer : position, rebond amorti sur les bords, sur place dans le tableau principal, déjà trié
 *                (le tri suivant n'a presque rien à déplacer) ;
 *   8. (au redimensionnement seulement) mise à l'échelle des positions.
 *
 * Unités : le monde fait W × H (y vers le bas, comme l'écran), h = 0,35, densité au repos 55 particules / u².
 * La taille du monde suit le nombre de particules et le rapport de l'écran ; la physique ne change pas d'échelle.
 *
 * Rendus : points (comme Leitl) ; liquide (particules étalées dans une texture, seuil, normale, réfraction d'un papier
 * quadrillé, Fresnel, Beer–Lambert, écume aux vitesses fortes) ; encres (mélange soustractif cyan / magenta / jaune,
 * comme une marbrure sur papier).
 */
import { getDevice } from "../components/device.ts";
import { renderScale } from "../gpu/governor.ts";

export const H = 0.35;
export const REST = 55;
export const MAX_N = 65536;
const MAX_CELLS = 65536;
const WG = 128;

export type Mode = "champ" | "bassin" | "marbrure";
export type Render = "points" | "liquide" | "encres";
export type Tool = "remuer" | "attirer" | "repousser";

/** Les couleurs, par rendu. Points : palette cosinus (t = vitesse) ou encres ; liquide : teinte ; encres : quatre encres. */
export const POINT_PALETTES = {
  leitl: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [2, 1, 0], d: [0.5, 0.2, 0.25], bg: "#050506" },
  braise: { a: [0.5, 0.3, 0.2], b: [0.5, 0.35, 0.25], c: [1, 1, 1], d: [0.5, 0.55, 0.65], bg: "#0b0706" },
  glace: { a: [0.55, 0.7, 0.85], b: [0.45, 0.35, 0.2], c: [1, 1, 1], d: [0.5, 0.5, 0.55], bg: "#04070c" },
  encres: { a: [0, 0, 0], b: [0, 0, 0], c: [0, 0, 0], d: [0, 0, 0], bg: "#efeee8" },
} as const;
export const LIQUID_TINTS = {
  eau: { color: "#9fd3e3", label: "Eau" },
  menthe: { color: "#7fd6b4", label: "Menthe" },
  vermillon: { color: "#e2553a", label: "Vermillon" },
  encre: { color: "#1d2236", label: "Encre" },
} as const;
export const INK_SETS = {
  cmj: { inks: ["#00a0dc", "#e5007e", "#ffe100", "#ffffff"], label: "Cyan, magenta, jaune" },
  sumi: { inks: ["#16161a", "#ffffff", "#5c5c66", "#ffffff"], label: "Sumi (encre noire)" },
  vermillon: { inks: ["#c8321c", "#1f2f6b", "#ffffff", "#e9b44c"], label: "Vermillon, indigo, or" },
} as const;

export type FluidConfig = {
  mode: Mode;
  render: Render;
  tool: Tool;
  points: keyof typeof POINT_PALETTES;
  tint: keyof typeof LIQUID_TINTS;
  inks: keyof typeof INK_SETS;
  count: number;
  /** Gravité (u/s²) et sa direction (degrés, convention Adobe : 0 à droite, -90 vers le bas). */
  gravity: number;
  angle: number;
  /** Raideur de la pression, de la pression proche ; viscosité. */
  pressure: number;
  near: number;
  viscosity: number;
  /** Densité cible, en fraction de la densité de départ : < 1 le fluide gonfle, > 1 il se resserre. */
  density: number;
  substeps: number;
  /** Pointeur : rayon (fraction de la hauteur), force. */
  radius: number;
  strength: number;
  /** Vitesse du temps. */
  speed: number;
  paused: boolean;
  /**
   * Inclinaison de l'appareil : la gravité projetée sur l'écran (x à droite, y vers le bas, longueur 0 à plat, 1 debout),
   * multipliée par `gravity`. Elle remplace la direction du cadran tant qu'elle est là.
   */
  tilt?: [number, number] | null;
};

export const PRESETS: Record<Mode, Partial<FluidConfig>> = {
  champ: { render: "points", points: "leitl", tool: "remuer", count: 8192, gravity: 0, angle: -90, pressure: 500, near: 18, viscosity: 0.12, density: 1, substeps: 3, radius: 0.12, strength: 24 },
  bassin: { render: "liquide", tint: "eau", tool: "attirer", count: 16384, gravity: 12, angle: -90, pressure: 500, near: 18, viscosity: 0.06, density: 1, substeps: 3, radius: 0.14, strength: 90 },
  marbrure: { render: "encres", inks: "cmj", tool: "remuer", count: 32768, gravity: 0, angle: -90, pressure: 400, near: 22, viscosity: 0.3, density: 1, substeps: 3, radius: 0.1, strength: 18 },
};
/** Part de la boîte remplie au départ (1 : tout l'écran). */
const FILL: Record<Mode, number> = { champ: 1.04, bassin: 0.4, marbrure: 1.04 };

const SIM = /* wgsl */ `
struct S {
  dom: vec4f,   // W, H, h, N
  grid: vec4f,  // gx, gy, cellules, dt
  phys: vec4f,  // densité cible, raideur, raideur proche, viscosité
  grav: vec4f,  // gx, gy, amorti des rebonds, vitesse max
  ptr: vec4f,   // pointeur x, y, vx, vy (monde)
  ptr2: vec4f,  // rayon, force, outil (0 rien, 1 remuer, 2 attirer, 3 repousser), anticipation (s)
  resc: vec4f,  // mise à l'échelle x, y
};
struct P { pos: vec2f, vel: vec2f, pred: vec2f, dye: f32, k: f32 };
@group(0) @binding(0) var<uniform> U: S;
@group(0) @binding(1) var<storage, read_write> A: array<P>;
@group(0) @binding(2) var<storage, read_write> B: array<P>;
@group(0) @binding(3) var<storage, read_write> dens: array<vec2f>;
@group(0) @binding(4) var<storage, read_write> vout: array<vec2f>;
@group(0) @binding(5) var<storage, read_write> key: array<vec2u>;
@group(0) @binding(6) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> starts: array<u32>;

const PI = 3.14159265;
fn N() -> u32 { return u32(U.dom.w); }
fn cellOf(p: vec2f) -> vec2i {
  let g = vec2i(U.grid.xy);
  return clamp(vec2i(floor(p / U.dom.z)), vec2i(0), g - 1);
}
fn cid(c: vec2i) -> u32 { return u32(c.y) * u32(U.grid.x) + u32(c.x); }

@compute @workgroup_size(${WG}) fn clear(@builtin(global_invocation_id) id: vec3u) {
  if (id.x < u32(U.grid.z)) { atomicStore(&counts[id.x], 0u); }
}

@compute @workgroup_size(${WG}) fn rescale(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= N()) { return; }
  A[i].pos *= U.resc.xy;
  A[i].pred *= U.resc.xy;
}

@compute @workgroup_size(${WG}) fn outside(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= N()) { return; }
  let dt = U.grid.w;
  let p = A[i].pos;
  var v = A[i].vel;
  let g = U.grav.xy;
  let tool = U.ptr2.z;
  let R = U.ptr2.x;
  var acc = g;
  if (tool > 0.5) {
    let off = U.ptr.xy - p;
    let d2 = dot(off, off);
    if (d2 < R * R) {
      let d = sqrt(d2);
      let edge = d / R;
      let centre = 1.0 - edge;
      if (tool < 1.5) {
        // Remuer : la particule prend la vitesse du pointeur, d'autant plus qu'elle est près du centre.
        let w = centre * centre;
        v = mix(v, U.ptr.zw, clamp(w * U.ptr2.y * dt, 0.0, 1.0));
      } else {
        // Attirer / repousser (à la Lague) : la gravité s'efface sous le pointeur, la vitesse s'amortit.
        let s = select(-U.ptr2.y, U.ptr2.y, tool < 2.5);
        let dir = select(vec2f(0.0), off / d, d > 1e-5);
        let gw = 1.0 - centre * clamp(s / 10.0, 0.0, 1.0);
        acc = g * gw + dir * centre * s - v * centre;
      }
    }
  }
  v += acc * dt;
  let pred = p + v * U.ptr2.w;
  A[i].vel = v;
  A[i].pred = pred;
  let c = cid(cellOf(pred));
  key[i] = vec2u(c, atomicAdd(&counts[c], 1u));
}

var<workgroup> sums: array<u32, 256>;
@compute @workgroup_size(256) fn scan(@builtin(local_invocation_index) t: u32) {
  let C = u32(U.grid.z);
  let per = (C + 255u) / 256u;
  let a = min(t * per, C);
  let b = min(a + per, C);
  var s = 0u;
  for (var k = a; k < b; k++) { s += atomicLoad(&counts[k]); }
  sums[t] = s;
  workgroupBarrier();
  for (var off = 1u; off < 256u; off = off << 1u) {
    var add = 0u;
    if (t >= off) { add = sums[t - off]; }
    workgroupBarrier();
    sums[t] += add;
    workgroupBarrier();
  }
  var run = 0u;
  if (t > 0u) { run = sums[t - 1u]; }
  for (var k = a; k < b; k++) {
    starts[k] = run;
    run += atomicLoad(&counts[k]);
  }
  if (t == 255u) { starts[C] = sums[255]; }
}

@compute @workgroup_size(${WG}) fn place(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= N()) { return; }
  let k = key[i];
  let slot = starts[k.x] + k.y;
  B[slot] = A[i];
  // L'indice d'origine, pour l'ordre stable qui suit (vout ne sert qu'aux forces, plus tard).
  vout[slot] = vec2f(bitcast<f32>(i), 0.0);
}

// Ordre stable : dans chaque cellule, les particules rangées par indice d'origine (l'ordre des atomicAdd change d'une
// exécution à l'autre ; l'ordre des sommes aussi, et un fluide est chaotique). Même scène, même film, à chaque fois.
@compute @workgroup_size(${WG}) fn order(@builtin(global_invocation_id) id: vec3u) {
  let s = id.x;
  if (s >= N()) { return; }
  let c = cid(cellOf(B[s].pred));
  let a = starts[c];
  let e = starts[c + 1u];
  let me = bitcast<u32>(vout[s].x);
  var r = 0u;
  for (var j = a; j < e; j++) {
    if (bitcast<u32>(vout[j].x) < me) { r++; }
  }
  A[a + r] = B[s];
}

@compute @workgroup_size(${WG}) fn density(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= N()) { return; }
  let h = U.dom.z;
  let h2 = h * h;
  let k2 = 6.0 / (PI * h2 * h2);
  let k3 = 10.0 / (PI * h2 * h2 * h);
  let pi = A[i].pred;
  let c = cellOf(pi);
  let g = vec2i(U.grid.xy);
  var rho = 0.0;
  var near = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    let y = c.y + dy;
    if (y < 0 || y >= g.y) { continue; }
    for (var dx = -1; dx <= 1; dx++) {
      let x = c.x + dx;
      if (x < 0 || x >= g.x) { continue; }
      let cc = cid(vec2i(x, y));
      let e = starts[cc + 1u];
      for (var j = starts[cc]; j < e; j++) {
        let d = A[j].pred - pi;
        let r2 = dot(d, d);
        if (r2 < h2) {
          let q = h - sqrt(r2);
          rho += q * q * k2;
          near += q * q * q * k3;
        }
      }
    }
  }
  dens[i] = vec2f(rho, near);
}

// Pression : la dépression (densité sous la cible) ne tire qu'à 15 % — assez pour une surface nette, trop peu pour
// que le fluide se déchire en réseau de trous (instabilité de traction du SPH).
fn pressure(rho: f32) -> f32 {
  let p = (rho - U.phys.x) * U.phys.y;
  return select(p * 0.15, p, p > 0.0);
}

fn hashDir(a: u32, b: u32) -> vec2f {
  var x = a * 747796405u + b * 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  let ang = f32(x & 65535u) / 65536.0 * 6.2831853;
  return vec2f(cos(ang), sin(ang));
}

@compute @workgroup_size(${WG}) fn forces(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= N()) { return; }
  let dt = U.grid.w;
  let h = U.dom.z;
  let h2 = h * h;
  let dk2 = 12.0 / (PI * h2 * h2);
  let dk3 = 30.0 / (PI * h2 * h2 * h);
  let kv = 4.0 / (PI * h2 * h2 * h2 * h2);
  let pi = A[i].pred;
  let vi = A[i].vel;
  let di = dens[i];
  let Pi = pressure(di.x);
  let Ni = di.y * U.phys.z;
  let c = cellOf(pi);
  let g = vec2i(U.grid.xy);
  var F = vec2f(0.0);
  var V = vec2f(0.0);
  for (var dy = -1; dy <= 1; dy++) {
    let y = c.y + dy;
    if (y < 0 || y >= g.y) { continue; }
    for (var dx = -1; dx <= 1; dx++) {
      let x = c.x + dx;
      if (x < 0 || x >= g.x) { continue; }
      let cc = cid(vec2i(x, y));
      let e = starts[cc + 1u];
      for (var j = starts[cc]; j < e; j++) {
        if (j == i) { continue; }
        let off = A[j].pred - pi;
        let r2 = dot(off, off);
        if (r2 >= h2) { continue; }
        let r = sqrt(r2);
        let dir = select(hashDir(i, j), off / r, r > 1e-5);
        let q = h - r;
        let dj = dens[j];
        let Pj = pressure(dj.x);
        let Nj = dj.y * U.phys.z;
        // Dérivées des noyaux (négatives) : la pression pousse loin de la voisine.
        F -= dir * (q * dk2 * 0.5 * (Pi + Pj) / max(dj.x, 1e-4) + q * q * dk3 * 0.5 * (Ni + Nj) / max(dj.y, 1e-4));
        let w = h2 - r2;
        V += (A[j].vel - vi) * (w * w * w * kv);
      }
    }
  }
  var v = vi + F / max(di.x, 1e-4) * dt + V * U.phys.w * dt;
  let sp = length(v);
  if (sp > U.grav.w) { v *= U.grav.w / sp; }
  vout[i] = v;
}

@compute @workgroup_size(${WG}) fn advance(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= N()) { return; }
  let dt = U.grid.w;
  var v = vout[i];
  var p = A[i].pos + v * dt;
  let m = 0.02;
  let W = U.dom.xy - m;
  let damp = U.grav.z;
  if (p.x < m) { p.x = m; v.x = abs(v.x) * damp; }
  if (p.x > W.x) { p.x = W.x; v.x = -abs(v.x) * damp; }
  if (p.y < m) { p.y = m; v.y = abs(v.y) * damp; }
  if (p.y > W.y) { p.y = W.y; v.y = -abs(v.y) * damp; }
  var o = A[i];
  o.pos = p;
  o.vel = v;
  o.k = dens[i].x;
  A[i] = o;
}
`;

const DRAW = /* wgsl */ `
struct R {
  dom: vec4f,   // W, H, N, rendu (0 points, 1 liquide, 2 encres)
  view: vec4f,  // largeur, hauteur (px), dpr, temps
  look: vec4f,  // rayon des points (monde), rayon d'étalement (monde), vitesse de référence, somme attendue
  pa: vec4f, pb: vec4f, pc: vec4f, pd: vec4f, // palette cosinus (a, b, c, d) ; pd.w : points colorés par encre
  ink0: vec4f, ink1: vec4f, ink2: vec4f, ink3: vec4f, // absorption de chaque encre (−ln couleur)
  tint: vec4f,  // absorption du liquide ; w : réfraction (px)
  paper: vec4f, // couleur du papier ; w : seuil de la surface
  bg: vec4f,    // fond des points
};
struct P { pos: vec2f, vel: vec2f, pred: vec2f, dye: f32, k: f32 };
@group(0) @binding(0) var<uniform> U: R;
@group(0) @binding(1) var<storage, read> A: array<P>;

struct VO { @builtin(position) pos: vec4f, @location(0) q: vec2f, @location(1) col: vec4f };

fn corner(i: u32) -> vec2f {
  var c = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  return c[i];
}

fn inkAbs(d: f32) -> vec3f {
  let k = i32(d + 0.5);
  if (k == 0) { return U.ink0.rgb; }
  if (k == 1) { return U.ink1.rgb; }
  if (k == 2) { return U.ink2.rgb; }
  return U.ink3.rgb;
}
// La fenêtre : le monde moins une marge (bg.w) — sans gravité, les particules tassées contre les bords restent hors champ.
fn viewSize() -> vec2f { return U.dom.xy - 2.0 * U.bg.w; }
fn toClip(p: vec2f) -> vec2f {
  let q = (p - U.bg.w) / viewSize();
  return vec2f(q.x * 2.0 - 1.0, 1.0 - q.y * 2.0);
}

@vertex fn vsPoint(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let p = A[ii];
  let q = corner(vi);
  // Au moins 1,5 px de rayon : les petits nombres de particules restent lisibles, les grands ne disparaissent pas.
  let rpx = max(U.look.x / viewSize().y * U.view.y, 1.5 * U.view.z);
  let r = vec2f(rpx / U.view.x * 2.0, rpx / U.view.y * 2.0);
  var o: VO;
  o.pos = vec4f(toClip(p.pos) + q * r, 0.0, 1.0);
  o.q = q;
  if (U.pd.w > 0.5) {
    o.col = vec4f(exp(-inkAbs(p.dye)) * 0.92, 1.0);
  } else {
    let t = length(p.vel) / U.look.z;
    o.col = vec4f(clamp(U.pa.rgb + U.pb.rgb * cos(6.2831853 * (U.pc.rgb * t + U.pd.rgb)), vec3f(0.0), vec3f(1.0)) * 1.15, 1.0);
  }
  return o;
}
@fragment fn fsPoint(i: VO) -> @location(0) vec4f {
  let d = length(i.q);
  let aa = fwidth(d) * 1.2;
  let m = 1.0 - smoothstep(1.0 - aa, 1.0, d);
  return vec4f(i.col.rgb * m, m);
}

@vertex fn vsSplat(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let p = A[ii];
  let q = corner(vi);
  let r = U.look.y / viewSize() * 2.0;
  var o: VO;
  o.pos = vec4f(toClip(p.pos) + q * r, 0.0, 1.0);
  o.q = q;
  if (U.dom.w > 1.5) { o.col = vec4f(inkAbs(p.dye), 0.0); } else { o.col = vec4f(length(p.vel), 0.0, 0.0, 0.0); }
  return o;
}
@fragment fn fsSplat(i: VO) -> @location(0) vec4f {
  let r2 = dot(i.q, i.q);
  if (r2 >= 1.0) { discard; }
  let w = (1.0 - r2) * (1.0 - r2) * (1.0 - r2);
  return vec4f(i.col.rgb * w, w);
}

@group(0) @binding(2) var field: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;

struct FO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vsFull(@builtin(vertex_index) i: u32) -> FO {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: FO;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), w.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), w.x), w.y);
}
// Le papier (px de l'écran) : fibre légère ; quadrillé en option (sous le liquide, c'est lui qu'on voit se tordre).
fn paper(px: vec2f, grid: bool) -> vec3f {
  var c = U.paper.rgb * (0.975 + 0.035 * vnoise(px * 0.35) + 0.02 * vnoise(px * 0.05));
  if (grid) {
    let s = 28.0 * U.view.z;
    let g = abs(fract(px / s + 0.5) - 0.5) * s;
    let line = 1.0 - smoothstep(0.0, 1.1 * U.view.z, min(g.x, g.y));
    let g5 = abs(fract(px / (s * 5.0) + 0.5) - 0.5) * s * 5.0;
    let major = 1.0 - smoothstep(0.0, 1.4 * U.view.z, min(g5.x, g5.y));
    c = mix(c, vec3f(0.55, 0.62, 0.72), max(line * 0.28, major * 0.45));
  }
  return c;
}

@fragment fn fsLiquid(i: FO) -> @location(0) vec4f {
  let px = i.uv * U.view.xy;
  let C = U.look.w;
  let f = textureSampleLevel(field, samp, i.uv, 0.0);
  let F = f.a / C;
  let ts = 1.5 / vec2f(textureDimensions(field));
  let fx = (textureSampleLevel(field, samp, i.uv + vec2f(ts.x, 0.0), 0.0).a - textureSampleLevel(field, samp, i.uv - vec2f(ts.x, 0.0), 0.0).a) / C;
  let fy = (textureSampleLevel(field, samp, i.uv + vec2f(0.0, ts.y), 0.0).a - textureSampleLevel(field, samp, i.uv - vec2f(0.0, ts.y), 0.0).a) / C;
  // Hauteur : ménisque au bord, plat au cœur.
  let thr = U.paper.w;
  let hgt = smoothstep(thr, thr + 0.55, F);
  let slope = 1.0 - smoothstep(thr + 0.08, thr + 0.5, F);
  let n = normalize(vec3f(-fx * 2.2 * slope, -fy * 2.2 * slope, 1.0));
  let base = paper(px, true);
  // Réfraction : le quadrillé vu à travers le liquide se décale selon la pente.
  let under = paper(px + n.xy * U.tint.w * U.view.z, true);
  let speed = f.r / max(f.a, 1e-4);
  var col = under * exp(-U.tint.rgb * (0.35 + 0.9 * hgt));
  // Caustique douce : la lumière se concentre là où la surface se creuse.
  col *= 1.0 + 0.25 * clamp(-(fx + fy) * 3.0, -0.5, 1.0) * slope;
  // Fresnel (eau, n = 1,33 → F0 ≈ 0,02) et reflet d'un ciel de studio, plus clair vers le haut.
  let fres = 0.02 + 0.98 * pow(1.0 - n.z, 5.0);
  let sky = mix(vec3f(0.92, 0.94, 0.97), vec3f(1.0), clamp(-n.y * 2.0 + 0.5, 0.0, 1.0));
  col = mix(col, sky, clamp(fres * 3.0, 0.0, 0.85));
  let L = normalize(vec3f(-0.45, -0.6, 0.66));
  let hv = normalize(L + vec3f(0.0, 0.0, 1.0));
  col += vec3f(pow(max(dot(n, hv), 0.0), 90.0)) * 0.9;
  // Écume : là où ça va vite, près de la surface.
  let foam = smoothstep(9.0, 22.0, speed) * (0.4 + 0.6 * slope) * smoothstep(0.3, 0.7, vnoise(px * 0.25 / U.view.z));
  col = mix(col, vec3f(1.0), foam * 0.75);
  // Bord : ombre portée légère sur le papier, puis la surface antialiasée.
  let fw = max(fwidth(F), 1e-4);
  let a = smoothstep(thr - fw, thr + fw, F);
  let shadow = smoothstep(thr * 0.35, thr, F) * (1.0 - a) * 0.12;
  let outCol = mix(base * (1.0 - shadow), col, a);
  return vec4f(outCol, 1.0);
}

@fragment fn fsInk(i: FO) -> @location(0) vec4f {
  let px = i.uv * U.view.xy;
  let f = textureSampleLevel(field, samp, i.uv, 0.0);
  let F = f.a / U.look.w;
  let ab = f.rgb / max(f.a, 1e-4);
  let cover = smoothstep(0.12, 0.55, F);
  // Mélange soustractif : chaque encre absorbe sa part ; le papier boit un peu (bord plus soutenu).
  let rim = 1.0 + 0.25 * (1.0 - smoothstep(0.55, 1.0, F)) * cover;
  let col = paper(px, false) * exp(-ab * cover * rim);
  return vec4f(col, 1.0);
}
`;

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
const absorb = (h: string) => hexRgb(h).map((c) => -Math.log(Math.min(1, Math.max(0.03, c)))) as [number, number, number];

/** Graine fixe pour les positions de départ : la même scène à chaque réinitialisation (et dans les tests). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FluidApi = Awaited<ReturnType<typeof mountFluide>>;

export async function mountFluide(root: HTMLElement, init: Partial<FluidConfig> = {}) {
  const canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const device = await getDevice();
  const ctx = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "opaque" });

  const check = async (m: GPUShaderModule, name: string) => {
    const errs = (await m.getCompilationInfo()).messages.filter((x) => x.type === "error");
    if (errs.length) throw new Error(`${name} : ` + errs.map((e) => `${e.lineNum}:${e.linePos} ${e.message}`).join("\n"));
  };
  const simMod = device.createShaderModule({ code: SIM });
  const drawMod = device.createShaderModule({ code: DRAW });
  await Promise.all([check(simMod, "simulation"), check(drawMod, "rendu")]);

  // --- Simulation : une disposition partagée, une liaison, huit pipelines.
  const S = GPUBufferUsage.STORAGE;
  const ubuf = device.createBuffer({ size: 7 * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bufA = device.createBuffer({ size: MAX_N * 32, usage: S | GPUBufferUsage.COPY_DST });
  const bufB = device.createBuffer({ size: MAX_N * 32, usage: S });
  const bufDens = device.createBuffer({ size: MAX_N * 8, usage: S });
  const bufVout = device.createBuffer({ size: MAX_N * 8, usage: S });
  const bufKey = device.createBuffer({ size: MAX_N * 8, usage: S });
  const bufCounts = device.createBuffer({ size: MAX_CELLS * 4, usage: S });
  const bufStarts = device.createBuffer({ size: (MAX_CELLS + 1) * 4, usage: S });
  const simLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      ...[1, 2, 3, 4, 5, 6, 7].map((binding) => ({ binding, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" as const } })),
    ],
  });
  const simBind = device.createBindGroup({
    layout: simLayout,
    entries: [ubuf, bufA, bufB, bufDens, bufVout, bufKey, bufCounts, bufStarts].map((buffer, binding) => ({ binding, resource: { buffer } })),
  });
  const simPL = device.createPipelineLayout({ bindGroupLayouts: [simLayout] });
  const mk = (entryPoint: string) => device.createComputePipelineAsync({ layout: simPL, compute: { module: simMod, entryPoint } });
  const [pClear, pRescale, pOutside, pScan, pPlace, pOrder, pDensity, pForces, pAdvance] = await Promise.all([
    mk("clear"),
    mk("rescale"),
    mk("outside"),
    mk("scan"),
    mk("place"),
    mk("order"),
    mk("density"),
    mk("forces"),
    mk("advance"),
  ]);

  // --- Rendu.
  const rbuf = device.createBuffer({ size: 15 * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const FIELD = "rgba16float" as const;
  const add: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one", operation: "add" } };
  const over: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" } };
  const ptLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
    ],
  });
  const fullLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
    ],
  });
  const ptPL = device.createPipelineLayout({ bindGroupLayouts: [ptLayout] });
  const fullPL = device.createPipelineLayout({ bindGroupLayouts: [fullLayout] });
  const [pPoints, pSplat, pLiquid, pInk] = await Promise.all([
    device.createRenderPipelineAsync({ layout: ptPL, vertex: { module: drawMod, entryPoint: "vsPoint" }, fragment: { module: drawMod, entryPoint: "fsPoint", targets: [{ format, blend: over }] } }),
    device.createRenderPipelineAsync({ layout: ptPL, vertex: { module: drawMod, entryPoint: "vsSplat" }, fragment: { module: drawMod, entryPoint: "fsSplat", targets: [{ format: FIELD, blend: add }] } }),
    device.createRenderPipelineAsync({ layout: fullPL, vertex: { module: drawMod, entryPoint: "vsFull" }, fragment: { module: drawMod, entryPoint: "fsLiquid", targets: [{ format }] } }),
    device.createRenderPipelineAsync({ layout: fullPL, vertex: { module: drawMod, entryPoint: "vsFull" }, fragment: { module: drawMod, entryPoint: "fsInk", targets: [{ format }] } }),
  ]);
  const ptBind = device.createBindGroup({ layout: ptLayout, entries: [{ binding: 0, resource: { buffer: rbuf } }, { binding: 1, resource: { buffer: bufA } }] });
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  let field: GPUTexture | null = null;
  let fullBind: GPUBindGroup | null = null;

  const cfg: FluidConfig = {
    mode: "champ",
    tint: "eau",
    inks: "cmj",
    points: "leitl",
    speed: 1,
    paused: false,
    ...PRESETS.champ,
    ...init,
  } as FluidConfig;

  // --- Le monde : W × H (unités), suit le nombre de particules et le rapport de la toile.
  let n = 0;
  let area = 1;
  let W = 1;
  let Hh = 1;
  let gx = 1;
  let gy = 1;
  let restDensity = REST;
  let pendingRescale: [number, number] | null = null;
  const sizeFor = (aspect: number) => {
    const w = Math.sqrt(area * aspect);
    return [w, area / w] as const;
  };
  const setGrid = () => {
    gx = Math.max(1, Math.ceil(W / H));
    gy = Math.max(1, Math.ceil(Hh / H));
    // Écran très allongé et beaucoup de particules : la grille ne déborde pas (les cellules grandissent un peu).
    while (gx * gy > MAX_CELLS) {
      gx = Math.ceil(gx * 0.9);
      gy = Math.ceil(gy * 0.9);
    }
  };
  let aspect = 16 / 9;

  /** Place les particules du mode courant (positions sur une grille légèrement bruitée, encres par bandes). */
  const spawn = () => {
    n = Math.min(MAX_N, Math.max(256, Math.round(cfg.count)));
    const fill = FILL[cfg.mode];
    area = n / (REST * fill);
    [W, Hh] = sizeFor(aspect);
    setGrid();
    const rand = rng(1910 + n);
    const data = new Float32Array(n * 8);
    let bx0 = 0,
      by0 = 0,
      bw = W,
      bh = Hh;
    if (cfg.mode === "bassin") {
      // Une colonne d'eau à gauche, retenue par un barrage qui vient de céder.
      const blockArea = n / REST;
      bw = Math.min(W * 0.42, Math.sqrt(blockArea * 0.9));
      bh = Math.min(Hh * 0.96, blockArea / bw);
      bw = blockArea / bh;
      bx0 = W * 0.03;
      by0 = Hh - bh - 0.05;
    } else {
      const s = Math.sqrt((W * Hh) / n);
      bw = W - s * 0.5;
      bh = Hh - s * 0.5;
      bx0 = s * 0.25;
      by0 = s * 0.25;
    }
    const cols = Math.max(1, Math.round(bw / Math.sqrt((bw * bh) / n)));
    const rows = Math.ceil(n / cols);
    const dx = bw / cols;
    const dy = bh / rows;
    const bands = 13;
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = bx0 + (c + 0.5 + (rand() - 0.5) * 0.3) * dx;
      const y = by0 + (r + 0.5 + (rand() - 0.5) * 0.3) * dy;
      let dye = 0;
      if (cfg.mode === "marbrure") {
        // Bandes verticales d'encre, ondulées, séparées de papier clair : la marbrure se dessine en remuant.
        const u = (x / W + 0.03 * Math.sin((y / Hh) * 9)) * bands;
        const k = Math.floor(u);
        dye = u - k > 0.72 ? 3 : k % 3;
      } else {
        dye = Math.min(2, Math.floor((y / Hh) * 3));
      }
      data.set([x, y, 0, 0, x, y, dye, REST], i * 8);
    }
    device.queue.writeBuffer(bufA, 0, data);
    restDensity = REST;
    pendingRescale = null;
  };

  // --- Pointeur (monde), vitesse lissée ; pilote automatique tant que personne n'a touché.
  const ptr = { x: 0, y: 0, vx: 0, vy: 0, inside: false, down: false, button: 0, touched: false, lastX: 0, lastY: 0, moved: false };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let auto = !reduce.matches && init.mode !== "bassin";
  /** Marge hors champ (monde) : hors du bassin, les bords ne servent qu'à tasser les particules. */
  const insetFor = () => (cfg.mode === "bassin" ? 0 : 0.45);
  const toWorld = (e: PointerEvent) => {
    const b = canvas.getBoundingClientRect();
    const m = insetFor();
    return [m + ((e.clientX - b.left) / b.width) * (W - 2 * m), m + ((e.clientY - b.top) / b.height) * (Hh - 2 * m)] as const;
  };
  const onMove = (e: PointerEvent) => {
    const [x, y] = toWorld(e);
    if (!ptr.inside || !ptr.moved) {
      ptr.lastX = x;
      ptr.lastY = y;
    }
    ptr.x = x;
    ptr.y = y;
    ptr.inside = true;
    ptr.moved = true;
    if (auto) auto = false;
    ptr.touched = true;
  };
  const onDown = (e: PointerEvent) => {
    onMove(e);
    ptr.down = true;
    ptr.button = e.button;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onUp = (e: PointerEvent) => {
    ptr.down = false;
    if (e.pointerType !== "mouse") ptr.inside = false;
  };
  const onLeave = (e: PointerEvent) => {
    if (!ptr.down || e.pointerType === "mouse") ptr.inside = false;
  };
  const noMenu = (e: Event) => e.preventDefault();
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("contextmenu", noMenu);

  let stopped = false;
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
  io.observe(root);
  const simData = new Float32Array(7 * 4);
  const rData = new Float32Array(15 * 4);
  let prev = performance.now();
  let t = 0;
  let fps = 60;
  let spawned = false;
  let needSpawn = true;
  let inflight = 0;
  let ticks = 0;
  let manual = false;

  const resize = () => {
    const b = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2) * renderScale();
    const pw = Math.max(2, Math.round(b.width * dpr));
    const ph = Math.max(2, Math.round(b.height * dpr));
    if (canvas.width !== pw || canvas.height !== ph || !field) {
      canvas.width = pw;
      canvas.height = ph;
      field?.destroy();
      field = device.createTexture({ size: [Math.max(2, pw >> 1), Math.max(2, ph >> 1)], format: FIELD, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      fullBind = device.createBindGroup({
        layout: fullLayout,
        entries: [
          { binding: 0, resource: { buffer: rbuf } },
          { binding: 2, resource: field.createView() },
          { binding: 3, resource: samp },
        ],
      });
      const na = b.width / Math.max(1, b.height);
      if (Math.abs(na - aspect) > 1e-3) {
        aspect = na;
        if (spawned) {
          // L'écran change de forme : le monde aussi (même aire), les particules suivent.
          const [w2, h2] = sizeFor(aspect);
          pendingRescale = [w2 / W, h2 / Hh];
          W = w2;
          Hh = h2;
          setGrid();
        }
      }
    }
    return dpr;
  };

  const frame = () => {
    if (stopped) return;
    requestAnimationFrame(frame);
    if (!visible) {
      prev = performance.now();
      return;
    }
    // Carte lente (ou logicielle) : on n'empile pas plus de deux images d'avance, la simulation ralentit au lieu de
    // prendre du retard sur l'écran.
    if (inflight >= 2 || manual) return;
    const now = performance.now();
    const raw = Math.max(0, (now - prev) / 1000);
    prev = now;
    if (raw > 0) fps += (1 / raw - fps) * 0.08;
    tick(Math.min(1 / 30, raw));
  };
  /** Une image : simulation (sous-pas) puis rendu, avançant de `realDt` secondes. */
  const tick = (realDt: number) => {
    ticks++;
    const dpr = resize();
    if (needSpawn) {
      spawn();
      spawned = true;
      needSpawn = false;
    }
    const dt = cfg.paused ? 0 : realDt * cfg.speed;
    t += dt;

    // Pointeur : vitesse (monde / s) d'une image à l'autre, lissée ; le pilote automatique trace une boucle lente.
    if (auto && !cfg.paused) {
      const a = t * 0.9;
      ptr.x = W * (0.5 + 0.36 * Math.sin(a * 1.0));
      ptr.y = Hh * (0.5 + 0.32 * Math.sin(a * 1.7 + 0.6));
      if (!ptr.moved) {
        ptr.lastX = ptr.x;
        ptr.lastY = ptr.y;
        ptr.moved = true;
      }
      ptr.inside = true;
    }
    if (realDt > 0) {
      const k = 1 - Math.exp(-realDt * 18);
      const cap = 45;
      const vx = Math.max(-cap, Math.min(cap, (ptr.x - ptr.lastX) / Math.max(dt, 1e-3)));
      const vy = Math.max(-cap, Math.min(cap, (ptr.y - ptr.lastY) / Math.max(dt, 1e-3)));
      ptr.vx += ((dt > 0 ? vx : 0) - ptr.vx) * k;
      ptr.vy += ((dt > 0 ? vy : 0) - ptr.vy) * k;
    }
    ptr.lastX = ptr.x;
    ptr.lastY = ptr.y;
    // Outil : remuer au survol (souris) ou au toucher ; attirer / repousser bouton enfoncé (clic droit : repousser).
    let tool = 0;
    if (ptr.inside) {
      if (ptr.down && ptr.button === 2) tool = 3;
      else if (cfg.tool === "remuer") tool = 1;
      else if (ptr.down) tool = cfg.tool === "attirer" ? 2 : 3;
      if (auto) tool = 1;
    }

    const sub = Math.max(1, Math.min(8, Math.round(cfg.substeps)));
    const sdt = dt / sub;
    const ga = (cfg.angle * Math.PI) / 180;
    restDensity = REST * cfg.density;
    simData.set([W, Hh, H, n], 0);
    simData.set([gx, gy, gx * gy, sdt], 4);
    simData.set([restDensity, cfg.pressure, cfg.near, cfg.viscosity], 8);
    const gv = cfg.tilt ? [cfg.tilt[0] * cfg.gravity, cfg.tilt[1] * cfg.gravity] : [Math.cos(ga) * cfg.gravity, -Math.sin(ga) * cfg.gravity];
    simData.set([gv[0]!, gv[1]!, 0.6, 80], 12);
    simData.set([ptr.x, ptr.y, ptr.vx, ptr.vy], 16);
    simData.set([cfg.radius * Hh, cfg.strength, tool, 1 / 120], 20);
    simData.set([pendingRescale?.[0] ?? 1, pendingRescale?.[1] ?? 1, 0, 0], 24);
    device.queue.writeBuffer(ubuf, 0, simData);

    const enc = device.createCommandEncoder();
    const groups = Math.ceil(n / WG);
    const cells = gx * gy;
    if (pendingRescale || dt > 0) {
      const cp = enc.beginComputePass();
      cp.setBindGroup(0, simBind);
      if (pendingRescale) {
        cp.setPipeline(pRescale);
        cp.dispatchWorkgroups(groups);
        pendingRescale = null;
      }
      if (dt > 0)
        for (let s = 0; s < sub; s++) {
          cp.setPipeline(pClear);
          cp.dispatchWorkgroups(Math.ceil(cells / WG));
          cp.setPipeline(pOutside);
          cp.dispatchWorkgroups(groups);
          cp.setPipeline(pScan);
          cp.dispatchWorkgroups(1);
          cp.setPipeline(pPlace);
          cp.dispatchWorkgroups(groups);
          cp.setPipeline(pOrder);
          cp.dispatchWorkgroups(groups);
          cp.setPipeline(pDensity);
          cp.dispatchWorkgroups(groups);
          cp.setPipeline(pForces);
          cp.dispatchWorkgroups(groups);
          cp.setPipeline(pAdvance);
          cp.dispatchWorkgroups(groups);
        }
      cp.end();
    }

    // Rendu.
    const inset = insetFor();
    const renderId = cfg.render === "points" ? 0 : cfg.render === "liquide" ? 1 : 2;
    const pal = POINT_PALETTES[cfg.points] ?? POINT_PALETTES.leitl;
    const inks = (INK_SETS[cfg.inks] ?? INK_SETS.cmj).inks.map(absorb);
    const tint = absorb((LIQUID_TINTS[cfg.tint] ?? LIQUID_TINTS.eau).color);
    const sp = 1 / Math.sqrt(REST);
    const splatR = renderId === 2 ? 1.4 * sp : 2.6 * sp;
    const expected = (REST * Math.PI * splatR * splatR) / 4;
    const paperHex = renderId === 0 ? pal.bg : "#efeee8";
    rData.set([W, Hh, n, renderId], 0);
    rData.set([canvas.width, canvas.height, dpr, t], 4);
    rData.set([0.36 * sp, splatR, 10, expected], 8);
    rData.set([...pal.a, 0], 12);
    rData.set([...pal.b, 0], 16);
    rData.set([...pal.c, 0], 20);
    rData.set([...pal.d, cfg.points === "encres" ? 1 : 0], 24);
    inks.forEach((a, k) => rData.set([...a, 0], 28 + k * 4));
    rData.set([tint[0], tint[1], tint[2], 14], 44);
    rData.set([...hexRgb(paperHex), 0.42], 48);
    rData.set([...hexRgb(pal.bg), inset], 52);
    device.queue.writeBuffer(rbuf, 0, rData);
    const view = ctx.getCurrentTexture().createView();
    if (renderId === 0) {
      const bg = hexRgb(pal.bg);
      const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [bg[0], bg[1], bg[2], 1] }] });
      rp.setPipeline(pPoints);
      rp.setBindGroup(0, ptBind);
      rp.draw(6, n);
      rp.end();
    } else {
      const sp1 = enc.beginRenderPass({ colorAttachments: [{ view: field!.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
      sp1.setPipeline(pSplat);
      sp1.setBindGroup(0, ptBind);
      sp1.draw(6, n);
      sp1.end();
      const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [1, 1, 1, 1] }] });
      rp.setPipeline(renderId === 1 ? pLiquid : pInk);
      rp.setBindGroup(0, fullBind!);
      rp.draw(3);
      rp.end();
    }
    device.queue.submit([enc.finish()]);
    inflight++;
    void device.queue.onSubmittedWorkDone().then(() => inflight--);
  };
  requestAnimationFrame(frame);

  return {
    cfg,
    /** Réapplique un mode (ses réglages), puis replace les particules. */
    setMode(mode: Mode) {
      Object.assign(cfg, PRESETS[mode], { mode });
      auto = !reduce.matches && mode !== "bassin" && !ptr.touched;
      needSpawn = true;
    },
    reset() {
      needSpawn = true;
    },
    /**
     * Avance de `frames` images à 1/60 s, sans attendre l'écran (tests, captures, cartes lentes) ; la boucle
     * d'affichage est suspendue le temps du calcul.
     */
    async run(frames: number) {
      manual = true;
      try {
        for (let i = 0; i < frames; i++) {
          tick(1 / 60);
          if (i % 4 === 3) await device.queue.onSubmittedWorkDone();
        }
        await device.queue.onSubmittedWorkDone();
      } finally {
        manual = false;
        prev = performance.now();
      }
    },
    stats: () => ({ n, ticks, W, H: Hh, cells: gx * gy }),
    stop() {
      stopped = true;
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("contextmenu", noMenu);
      field?.destroy();
      for (const b of [ubuf, rbuf, bufA, bufB, bufDens, bufVout, bufKey, bufCounts, bufStarts]) b.destroy();
    },
  };
}
