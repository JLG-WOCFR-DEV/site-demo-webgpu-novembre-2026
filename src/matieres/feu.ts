/**
 * Lettres en feu, v2 : une vraie flamme, simulée.
 *
 * Fluide 2D (grille ≈ 320 cellules de large, pas fixe 1/60 s), en calcul :
 *   1. rotationnel de la vitesse ;
 *   2. vitesse : advection semi-lagrangienne, flottabilité (la chaleur monte,
 *      la fumée pèse un peu), confinement de la vorticité (garde les volutes
 *      que la grille effacerait), turbulence en bruit rotationnel (sans
 *      divergence) pondérée par la chaleur, souffle du pointeur ;
 *   3. divergence, 24 itérations de Jacobi sur la pression, projection
 *      (le champ redevient incompressible : la flamme s'enroule au lieu de gonfler) ;
 *   4. température et fumée advectées ; la flamme refroidit (exponentielle),
 *      la fumée naît de ce qui brûle et se dissipe ; le combustible, ce sont
 *      les lettres : un peu partout, beaucoup sur les bords du haut et les
 *      contours, par plaques qui vacillent et montent.
 *
 * Rendu HDR : couleur de corps noir tirée de la température (rouge sombre →
 * orange → jaune → blanc, intensité ∝ T^1,8), fumée qui assombrit ; lettres en
 * charbon fendu de braises (réseau de Voronoï F2 − F1 chauffé par la flamme
 * qui passe dessus) ; étincelles (particules portées par la vitesse du fluide,
 * étirées selon leur vitesse) ; bloom ; brume de chaleur (l'image décalée par
 * le gradient de température).
 */
import { createBloom, HDR_FORMAT, TONEMAP } from "./hdr.ts";

type Pointer = { x: number; y: number; in: number };
export type FireWord = { W: number; H: number; GW: number; GH: number; mask: Float32Array; wordTex: GPUTexture };

const SPARKS = 700;
const JACOBI = 24;

const NOISE = /* wgsl */ `
fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), w.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), w.x), w.y);
}
fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var a = 0.5;
  var s = 0.0;
  for (var k = 0; k < 4; k++) { s += a * vnoise(p); p = p * 2.03 + vec2f(17.3, 9.1); a *= 0.5; }
  return s;
}
`;
const PARAMS = /* wgsl */ `
struct P {
  grid: vec4f,   // largeur, hauteur (cellules), dt, temps
  phys: vec4f,   // flottabilité, refroidissement, vorticité, turbulence
  ptr: vec4f,    // pointeur : x, y (cellules), vx, vy (cellules/s)
  ptr2: vec4f,   // rayon (cellules), présent, fumée, combustible
};
@group(0) @binding(0) var<uniform> P_: P;
fn inGrid(p: vec2i) -> vec2i { return clamp(p, vec2i(0), vec2i(P_.grid.xy) - 1); }
`;

const CURL = /* wgsl */ `
${PARAMS}
@group(0) @binding(1) var vel: texture_2d<f32>;
@group(0) @binding(2) var outC: texture_storage_2d<r32float, write>;
fn v(p: vec2i) -> vec2f { return textureLoad(vel, inGrid(p), 0).xy; }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let p = vec2i(id.xy);
  if (any(p >= vec2i(P_.grid.xy))) { return; }
  let c = (v(p + vec2i(1, 0)).y - v(p - vec2i(1, 0)).y - v(p + vec2i(0, 1)).x + v(p - vec2i(0, 1)).x) * 0.5;
  textureStore(outC, p, vec4f(c, 0.0, 0.0, 0.0));
}
`;

const VELOCITY = /* wgsl */ `
${PARAMS}
${NOISE}
@group(0) @binding(1) var vel: texture_2d<f32>;
@group(0) @binding(2) var curl: texture_2d<f32>;
@group(0) @binding(3) var scal: texture_2d<f32>;
@group(0) @binding(4) var samp: sampler;
@group(0) @binding(5) var outV: texture_storage_2d<rgba16float, write>;
fn c(p: vec2i) -> f32 { return textureLoad(curl, inGrid(p), 0).r; }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let p = vec2i(id.xy);
  let size = P_.grid.xy;
  if (any(p >= vec2i(size))) { return; }
  let dt = P_.grid.z;
  let t = P_.grid.w;
  let uv = (vec2f(p) + 0.5) / size;
  let v0 = textureLoad(vel, p, 0).xy;
  // Advection : on remonte la vitesse, on lit ce qui était là.
  var v = textureSampleLevel(vel, samp, uv - v0 * dt / size, 0.0).xy;
  let s = textureLoad(scal, p, 0);
  // Flottabilité : la chaleur monte (y vers le bas), la fumée pèse un peu.
  v.y -= (s.r * P_.phys.x - s.g * P_.phys.x * 0.12) * dt;
  // Confinement de la vorticité.
  let w = c(p);
  let g = vec2f(abs(c(p + vec2i(1, 0))) - abs(c(p - vec2i(1, 0))), abs(c(p + vec2i(0, 1))) - abs(c(p - vec2i(0, 1)))) * 0.5;
  let N = g / (length(g) + 1e-5);
  v += P_.phys.z * vec2f(N.y * w, -N.x * w) * dt;
  // Turbulence sans divergence (rotationnel d'un bruit), là où il fait chaud.
  let q = vec2f(p) * 0.09 + vec2f(0.0, t * 1.6);
  let e = 0.5;
  let dpy = fbm(q + vec2f(0.0, e)) - fbm(q - vec2f(0.0, e));
  let dpx = fbm(q + vec2f(e, 0.0)) - fbm(q - vec2f(e, 0.0));
  v += vec2f(dpy, -dpx) / (2.0 * e) * P_.phys.w * min(s.r, 1.0) * dt;
  // Le pointeur souffle.
  let d = vec2f(p) - P_.ptr.xy;
  let k = exp(-dot(d, d) / (P_.ptr2.x * P_.ptr2.x)) * P_.ptr2.y;
  v += P_.ptr.zw * k * 0.35;
  v *= 0.998;
  // Bords : rien ne sort par les côtés ni par le bas ; le haut est ouvert.
  if (p.x == 0 || p.x == i32(size.x) - 1) { v.x = 0.0; }
  if (p.y == i32(size.y) - 1) { v.y = min(v.y, 0.0); }
  textureStore(outV, p, vec4f(v, 0.0, 1.0));
}
`;

const DIVERGENCE = /* wgsl */ `
${PARAMS}
@group(0) @binding(1) var vel: texture_2d<f32>;
@group(0) @binding(2) var outD: texture_storage_2d<r32float, write>;
fn v(p: vec2i) -> vec2f { return textureLoad(vel, inGrid(p), 0).xy; }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let p = vec2i(id.xy);
  if (any(p >= vec2i(P_.grid.xy))) { return; }
  let d = 0.5 * (v(p + vec2i(1, 0)).x - v(p - vec2i(1, 0)).x + v(p + vec2i(0, 1)).y - v(p - vec2i(0, 1)).y);
  textureStore(outD, p, vec4f(d, 0.0, 0.0, 0.0));
}
`;

const JACOBI_WGSL = /* wgsl */ `
${PARAMS}
@group(0) @binding(1) var pres: texture_2d<f32>;
@group(0) @binding(2) var divT: texture_2d<f32>;
@group(0) @binding(3) var outP: texture_storage_2d<r32float, write>;
fn pr(p: vec2i) -> f32 {
  // Le haut est ouvert (pression nulle au-dessus) ; ailleurs, réflexion.
  if (p.y < 0) { return 0.0; }
  return textureLoad(pres, inGrid(p), 0).r;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let p = vec2i(id.xy);
  if (any(p >= vec2i(P_.grid.xy))) { return; }
  let d = textureLoad(divT, p, 0).r;
  let np = (pr(p + vec2i(1, 0)) + pr(p - vec2i(1, 0)) + pr(p + vec2i(0, 1)) + pr(p - vec2i(0, 1)) - d) * 0.25;
  textureStore(outP, p, vec4f(np, 0.0, 0.0, 0.0));
}
`;

const PROJECT = /* wgsl */ `
${PARAMS}
@group(0) @binding(1) var vel: texture_2d<f32>;
@group(0) @binding(2) var pres: texture_2d<f32>;
@group(0) @binding(3) var outV: texture_storage_2d<rgba16float, write>;
fn pr(p: vec2i) -> f32 {
  if (p.y < 0) { return 0.0; }
  return textureLoad(pres, inGrid(p), 0).r;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let p = vec2i(id.xy);
  if (any(p >= vec2i(P_.grid.xy))) { return; }
  var v = textureLoad(vel, p, 0).xy;
  v -= 0.5 * vec2f(pr(p + vec2i(1, 0)) - pr(p - vec2i(1, 0)), pr(p + vec2i(0, 1)) - pr(p - vec2i(0, 1)));
  textureStore(outV, p, vec4f(v, 0.0, 1.0));
}
`;

const SCALARS = /* wgsl */ `
${PARAMS}
${NOISE}
@group(0) @binding(1) var vel: texture_2d<f32>;
@group(0) @binding(2) var scal: texture_2d<f32>;
@group(0) @binding(3) var word: texture_2d<f32>;
@group(0) @binding(4) var samp: sampler;
@group(0) @binding(5) var outS: texture_storage_2d<rgba16float, write>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let p = vec2i(id.xy);
  let size = P_.grid.xy;
  if (any(p >= vec2i(size))) { return; }
  let dt = P_.grid.z;
  let t = P_.grid.w;
  let uv = (vec2f(p) + 0.5) / size;
  let v = textureLoad(vel, p, 0).xy;
  var s = textureSampleLevel(scal, samp, uv - v * dt / size, 0.0);
  var T = s.r;
  var smoke = s.g;
  // Refroidissement : rapide pour les petites flammes, lent pour le cœur chaud.
  T = T * exp(-P_.phys.y * dt) - 0.04 * dt;
  smoke = smoke * exp(-0.55 * dt) + max(T, 0.0) * P_.ptr2.z * dt;
  // Le combustible : les lettres, surtout leurs bords du haut et leurs contours.
  let m = textureSampleLevel(word, samp, uv, 0.0).r;
  let up = textureSampleLevel(word, samp, uv - vec2f(0.0, 3.0 / size.y), 0.0).r;
  let blur = textureSampleLevel(word, samp, uv, 2.5).r;
  let top = clamp(m - up, 0.0, 1.0);
  let rim = m * clamp(1.0 - blur, 0.0, 1.0);
  // Des plaques qui vacillent et montent : la flamme ne brûle jamais partout à la fois.
  let flick = smoothstep(0.3, 0.75, fbm(vec2f(p) * vec2f(0.07, 0.11) + vec2f(0.0, t * 2.2)));
  let src = m * (0.04 + 1.2 * top + 0.45 * rim) * (0.25 + 0.95 * flick) * P_.ptr2.w;
  T = min(T + src * dt * 5.5, 1.4);
  textureStore(outS, p, vec4f(max(T, 0.0), clamp(smoke, 0.0, 2.0), 0.0, 1.0));
}
`;

const SPARK_SIM = /* wgsl */ `
${PARAMS}
struct Sp { p: vec4f, v: vec4f };   // x, y (px css), graine, 0 ; vx, vy (px css/s), vie, vie max
@group(0) @binding(1) var<storage, read_write> sp: array<Sp>;
@group(0) @binding(2) var<storage, read> spawn: array<vec2f>;
@group(0) @binding(3) var vel: texture_2d<f32>;
@group(0) @binding(4) var samp: sampler;
@group(0) @binding(5) var<uniform> px: vec4f;   // px css par cellule, nombre de points de départ, 0, 0
fn hash(n: f32) -> f32 { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&sp)) { return; }
  var s = sp[i];
  let dt = P_.grid.z;
  let t = P_.grid.w;
  if (s.v.z <= 0.0) {
    // En attente (vie négative), puis renaissance sur un bord du haut des lettres.
    s.v.z += dt;
    if (s.v.z > 0.0) {
      let r = hash(s.p.z + t);
      let k = min(u32(r * px.y), u32(px.y) - 1u);
      s.p = vec4f(spawn[k] + vec2f(hash(r + 1.0) - 0.5, -2.0) * 6.0, fract(s.p.z + 0.618), 0.0);
      let life = 0.5 + 1.3 * hash(r + 2.0);
      s.v = vec4f((hash(r + 3.0) - 0.5) * 50.0, -50.0 - 90.0 * hash(r + 4.0), life, life);
    }
    sp[i] = s;
    return;
  }
  // Portée par la flamme (vitesse du fluide en px/s), un peu plus légère que l'air, un peu de hasard.
  let uv = s.p.xy / (px.x * P_.grid.xy);
  let fv = textureSampleLevel(vel, samp, uv, 0.0).xy * px.x;
  var v = s.v.xy;
  v += (fv - v) * 2.2 * dt + vec2f((hash(s.p.z + t * 7.0) - 0.5) * 220.0, -25.0) * dt;
  s.p = vec4f(s.p.xy + v * dt, s.p.z, 0.0);
  s.v = vec4f(v, s.v.z - dt, s.v.w);
  if (s.v.z <= 0.0) { s.v.z = -hash(s.p.z + t * 3.0) * 1.2; }
  sp[i] = s;
}
`;

const RENDER = /* wgsl */ `
${NOISE}
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return VO(vec4f(p * 2.0 - 1.0, 0.0, 1.0), vec2f(p.x, 1.0 - p.y));
}
struct U { res: vec4f };   // largeur, hauteur (px css), 0, temps
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var scal: texture_2d<f32>;
@group(0) @binding(2) var word: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;
/** Corps noir (≈ 900 K → 1800 K) : la couleur, et une intensité qui grimpe vite avec la température. */
fn fireColor(T: f32) -> vec3f {
  let t = clamp(T, 0.0, 1.6);
  var c = mix(vec3f(0.45, 0.025, 0.0), vec3f(1.0, 0.22, 0.02), smoothstep(0.08, 0.45, t));
  c = mix(c, vec3f(1.0, 0.58, 0.14), smoothstep(0.4, 0.85, t));
  c = mix(c, vec3f(1.0, 0.9, 0.68), smoothstep(0.85, 1.35, t));
  return c * pow(max(t - 0.06, 0.0), 2.0) * 2.0;
}
/** Voronoï : F2 − F1 (petit sur les arêtes : les fissures). */
fn cracks(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  var f1 = 9.0;
  var f2 = 9.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let o = vec2f(f32(x), f32(y));
      let c = i + o;
      let pt = o + vec2f(h21(c), h21(c + 31.7)) * 0.85 + 0.075 - f;
      let d = length(pt);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return f2 - f1;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let px = i.uv * u.res.xy;
  let t = u.res.w;
  let s = textureSampleLevel(scal, samp, i.uv, 0.0);
  let T = s.r;
  let smoke = s.g;
  let m = textureSampleLevel(word, samp, i.uv, 0.0).r;
  // Le fond : presque noir, une lueur chaude au sol.
  var col = vec3f(0.006, 0.004, 0.003) + vec3f(0.012, 0.004, 0.0) * smoothstep(0.6, 1.0, i.uv.y);
  // Les lettres : du charbon fendu de braises ; la flamme qui passe dessus les chauffe.
  let cr = 1.0 - smoothstep(0.02, 0.1, cracks(px * 0.05) + 0.06 * (vnoise(px * 0.2) - 0.5));
  let fine = 1.0 - smoothstep(0.015, 0.05, cracks(px * 0.13 + 7.0));
  let heat = clamp(0.32 + 0.75 * T + 0.35 * (fbm(px * 0.012 + vec2f(0.0, -t * 0.25)) - 0.5), 0.0, 1.3);
  let charc = vec3f(0.03, 0.024, 0.02) * (0.7 + 0.6 * vnoise(px * 0.35));
  let edge = m * clamp(1.0 - textureSampleLevel(word, samp, i.uv, 2.0).r, 0.0, 1.0);
  var letter = charc + fireColor(heat * 0.95) * (cr * 0.55 + fine * 0.18) + fireColor(heat * 0.55) * 0.18 + fireColor(0.7 + 0.4 * T) * edge * 0.35;
  col = mix(col, letter, m);
  // La fumée assombrit ce qui est derrière ; la flamme s'ajoute (moins dense devant les lettres, qu'on voie la braise).
  col *= exp(-smoke * 0.7);
  col += fireColor(T) * mix(1.0, 0.55, m);
  return vec4f(col, 1.0);
}
`;

const SPARK_DRAW = /* wgsl */ `
struct Sp { p: vec4f, v: vec4f };
@group(0) @binding(0) var<uniform> u: vec4f;   // largeur, hauteur (px css)
@group(0) @binding(1) var<storage, read> sp: array<Sp>;
struct VO { @builtin(position) clip: vec4f, @location(0) a: f32, @location(1) side: f32, @location(2) heat: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let s = sp[ii];
  var o: VO;
  if (s.v.z <= 0.0) { o.clip = vec4f(2.0, 2.0, 2.0, 1.0); return o; }
  let v = s.v.xy;
  let spd = length(v);
  let t = select(vec2f(0.0, -1.0), v / spd, spd > 1e-3);
  let n = vec2f(-t.y, t.x);
  let L = 1.5 + spd * 0.035;
  let w = 0.9;
  let c = array<vec2f, 6>(vec2f(0.0, -1.0), vec2f(1.0, -1.0), vec2f(0.0, 1.0), vec2f(0.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0))[vi];
  let p = s.p.xy - t * L * c.x + n * w * c.y;
  o.clip = vec4f(p / u.xy * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0), 0.0, 1.0);
  o.a = c.x;
  o.side = c.y;
  o.heat = s.v.z / s.v.w;
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let k = (1.0 - abs(i.side)) * (1.0 - i.a * 0.8);
  let h = i.heat;
  let col = mix(vec3f(1.0, 0.25, 0.03), vec3f(1.0, 0.8, 0.45), h) * (0.8 + 2.2 * h) * k * smoothstep(0.0, 0.15, h);
  return vec4f(col, 1.0);
}
`;

const FINAL = /* wgsl */ `
${TONEMAP}
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return VO(vec4f(p * 2.0 - 1.0, 0.0, 1.0), vec2f(p.x, 1.0 - p.y));
}
struct U { res: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var scene: texture_2d<f32>;
@group(0) @binding(2) var bloom: texture_2d<f32>;
@group(0) @binding(3) var scal: texture_2d<f32>;
@group(0) @binding(4) var samp: sampler;
@fragment fn fs(i: VO) -> @location(0) vec4f {
  // Brume de chaleur : l'image décalée par le gradient de température, qui tremble un peu.
  let e = 2.0 / vec2f(textureDimensions(scal));
  let Tx = textureSampleLevel(scal, samp, i.uv + vec2f(e.x, 0.0), 0.0).r - textureSampleLevel(scal, samp, i.uv - vec2f(e.x, 0.0), 0.0).r;
  let Ty = textureSampleLevel(scal, samp, i.uv + vec2f(0.0, e.y), 0.0).r - textureSampleLevel(scal, samp, i.uv - vec2f(0.0, e.y), 0.0).r;
  let wob = sin(i.uv.y * 90.0 - u.res.w * 9.0) * 0.5 + sin(i.uv.x * 70.0 + u.res.w * 6.0) * 0.5;
  let off = vec2f(Tx, Ty) * 0.006 + vec2f(wob, 0.0) * 0.0012 * clamp(textureSampleLevel(scal, samp, i.uv, 0.0).r, 0.0, 1.0);
  var col = textureSampleLevel(scene, samp, i.uv + off, 0.0).rgb;
  col += textureSampleLevel(bloom, samp, i.uv, 0.0).rgb * 0.3;
  return vec4f(display(col, i.p.xy), 1.0);
}
`;

export async function createFeu(device: GPUDevice, format: GPUTextureFormat, pointer: Pointer) {
  const bloom = await createBloom(device);
  const compile = async (code: string, name: string) => {
    const m = device.createShaderModule({ code });
    const errs = (await m.getCompilationInfo()).messages.filter((x) => x.type === "error");
    if (errs.length) throw new Error(`feu/${name} : ${errs.map((e) => `${e.lineNum}:${e.message}`).join("\n")}`);
    return m;
  };
  const cp = async (code: string, name: string) => device.createComputePipelineAsync({ layout: "auto", compute: { module: await compile(code, name), entryPoint: "main" } });
  const [curlP, velP, divP, jacP, projP, scalP, sparkP] = await Promise.all([
    cp(CURL, "curl"),
    cp(VELOCITY, "vitesse"),
    cp(DIVERGENCE, "divergence"),
    cp(JACOBI_WGSL, "jacobi"),
    cp(PROJECT, "projection"),
    cp(SCALARS, "scalaires"),
    cp(SPARK_SIM, "étincelles"),
  ]);
  const add: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } };
  const rMod = await compile(RENDER, "rendu");
  const sMod = await compile(SPARK_DRAW, "étincelles-dessin");
  const fMod = await compile(FINAL, "final");
  const renderP = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: rMod, entryPoint: "vs" }, fragment: { module: rMod, entryPoint: "fs", targets: [{ format: HDR_FORMAT }] }, primitive: { topology: "triangle-list" } });
  const sparkDrawP = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: sMod, entryPoint: "vs" }, fragment: { module: sMod, entryPoint: "fs", targets: [{ format: HDR_FORMAT, blend: add }] }, primitive: { topology: "triangle-list" } });
  const finalP = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: fMod, entryPoint: "vs" }, fragment: { module: fMod, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });

  const samp = bloom.samp;
  const PU = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const pxU = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const rU = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const sparkBuf = device.createBuffer({ size: SPARKS * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  {
    // Vies négatives et étalées : les étincelles naissent au fil des secondes.
    const init = new Float32Array(SPARKS * 8);
    for (let k = 0; k < SPARKS; k++) {
      init[k * 8 + 2] = Math.random();
      init[k * 8 + 6] = -Math.random() * 2;
      init[k * 8 + 7] = 1;
    }
    device.queue.writeBuffer(sparkBuf, 0, init);
  }

  let SW = 0;
  let SH = 0;
  let cs = 1;
  let info: FireWord | null = null;
  const tex: Record<string, GPUTexture[]> = {};
  let binds: {
    curl: GPUBindGroup[];
    vel: GPUBindGroup[];
    div: GPUBindGroup[];
    jac: GPUBindGroup[];
    proj: GPUBindGroup[];
    scal: GPUBindGroup[];
    spark: GPUBindGroup[];
    render: GPUBindGroup[];
    sparkDraw: GPUBindGroup;
    final: GPUBindGroup[];
  } | null = null;
  let spawnBuf: GPUBuffer | null = null;
  let spawnCount = 1;
  let vCur = 0;
  let sCur = 0;
  let lastP = { x: 0, y: 0, t: 0 };
  let started = false;

  const rebuild = (w: FireWord) => {
    info = w;
    SW = Math.max(120, Math.min(340, Math.round(w.W / 2.4)));
    SH = Math.max(60, Math.round((SW * w.H) / w.W));
    cs = w.W / SW;
    for (const k of Object.keys(tex)) for (const t of tex[k]!) t.destroy();
    const st = (fmt: GPUTextureFormat, n: number) =>
      Array.from({ length: n }, () => device.createTexture({ size: [SW, SH], format: fmt, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST }));
    tex.vel = st("rgba16float", 2);
    tex.scal = st("rgba16float", 2);
    tex.pres = st("r32float", 2);
    tex.div = st("r32float", 1);
    tex.curl = st("r32float", 1);
    // Points de départ des étincelles : le bord du haut des lettres (px css).
    const pts: number[] = [];
    const s = w.W / w.GW;
    for (let y = 2; y < w.GH; y++)
      for (let x = 0; x < w.GW; x++) {
        const i = y * w.GW + x;
        if (w.mask[i]! > 0.5 && w.mask[i - 2 * w.GW]! < 0.5) pts.push((x + 0.5) * s, y * s);
      }
    if (!pts.length) pts.push(w.W / 2, w.H / 2);
    spawnCount = pts.length / 2;
    spawnBuf?.destroy();
    spawnBuf = device.createBuffer({ size: pts.length * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(spawnBuf, 0, new Float32Array(pts));
    const V = (t: GPUTexture) => t.createView();
    const bg = (p: GPUComputePipeline | GPURenderPipeline, entries: GPUBindingResource[]) => device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: entries.map((resource, binding) => ({ binding, resource })) });
    const pu = { buffer: PU };
    binds = {
      curl: [0, 1].map((k) => bg(curlP, [pu, V(tex.vel![k]!), V(tex.curl![0]!)])),
      vel: [],
      div: [0, 1].map((k) => bg(divP, [pu, V(tex.vel![k]!), V(tex.div![0]!)])),
      jac: [0, 1].map((k) => bg(jacP, [pu, V(tex.pres![k]!), V(tex.div![0]!), V(tex.pres![1 - k]!)])),
      // projection : lit vel[k] et pres[0], écrit vel[1-k]
      proj: [0, 1].map((k) => bg(projP, [pu, V(tex.vel![k]!), V(tex.pres![0]!), V(tex.vel![1 - k]!)])),
      // scalaires : vitesse vel[k], lit scal[j], écrit scal[1-j] (indice 2k + j)
      scal: [0, 1, 2, 3].map((n) => bg(scalP, [pu, V(tex.vel![n >> 1]!), V(tex.scal![n & 1]!), V(w.wordTex), samp, V(tex.scal![1 - (n & 1)]!)])),
      spark: [0, 1].map((k) => bg(sparkP, [pu, { buffer: sparkBuf }, { buffer: spawnBuf! }, V(tex.vel![k]!), samp, { buffer: pxU }])),
      render: [0, 1].map((k) => bg(renderP, [{ buffer: rU }, V(tex.scal![k]!), V(w.wordTex), samp])),
      sparkDraw: bg(sparkDrawP, [{ buffer: rU }, { buffer: sparkBuf }]),
      final: [],
    };
    // La vitesse (lit vel[k], écrit vel[1-k]) lit aussi les scalaires de l'image courante : indice 2k + j.
    binds.vel = [0, 1, 2, 3].map((n) => bg(velP, [pu, V(tex.vel![n >> 1]!), V(tex.curl![0]!), V(tex.scal![n & 1]!), samp, V(tex.vel![1 - (n >> 1)]!)]));
    vCur = 0;
    sCur = 0;
    started = false;
  };

  const step = (enc: GPUCommandEncoder, simT: number, dt: number) => {
    const b = binds!;
    const wg = [Math.ceil(SW / 8), Math.ceil(SH / 8)] as const;
    const run = (p: GPUComputePipeline, g: GPUBindGroup, x = wg[0], y = wg[1]) => {
      const c = enc.beginComputePass();
      c.setPipeline(p);
      c.setBindGroup(0, g);
      c.dispatchWorkgroups(x, y);
      c.end();
    };
    void simT;
    void dt;
    run(curlP, b.curl[vCur]!);
    run(velP, b.vel[vCur * 2 + sCur]!);
    vCur = 1 - vCur;
    run(divP, b.div[vCur]!);
    for (let k = 0; k < JACOBI; k++) run(jacP, b.jac[k & 1]!);
    // JACOBI pair : la dernière pression est dans pres[0].
    run(projP, b.proj[vCur]!);
    vCur = 1 - vCur;
    run(scalP, b.scal[vCur * 2 + sCur]!);
    sCur = 1 - sCur;
    run(sparkP, b.spark[vCur]!, Math.ceil(SPARKS / 64), 1);
  };

  const writeParams = (simT: number, pv: { x: number; y: number; vx: number; vy: number; on: number }) => {
    // flottabilité, refroidissement (1/s), vorticité, turbulence ; pointeur ; rayon, présent, fumée, combustible
    device.queue.writeBuffer(PU, 0, new Float32Array([SW, SH, 1 / 60, simT, 165, 1.5, 26, 34, pv.x, pv.y, pv.vx, pv.vy, 26, pv.on, 0.5, 1]));
    device.queue.writeBuffer(pxU, 0, new Float32Array([cs, spawnCount, 0, 0]));
  };

  let simT = 0;
  return {
    rebuild,
    draw(enc: GPUCommandEncoder, view: GPUTextureView, t: number, pw: number, ph: number) {
      if (!info || !binds) return;
      const now = performance.now() / 1000;
      // Vitesse du pointeur (cellules/s), lissée.
      const dtp = Math.max(1e-3, now - lastP.t);
      const pv = { x: pointer.x / cs, y: pointer.y / cs, vx: 0, vy: 0, on: pointer.in };
      if (lastP.t) {
        pv.vx = Math.max(-400, Math.min(400, (pointer.x - lastP.x) / dtp / cs));
        pv.vy = Math.max(-400, Math.min(400, (pointer.y - lastP.y) / dtp / cs));
      }
      lastP = { x: pointer.x, y: pointer.y, t: now };
      // Au premier dessin, deux secondes de simulation : la flamme est déjà prise.
      const steps = started ? 1 : 120;
      started = true;
      for (let k = 0; k < steps; k++) {
        simT += 1 / 60;
        writeParams(simT, k === steps - 1 ? pv : { ...pv, on: 0 });
        step(enc, simT, 1 / 60);
        if (k < steps - 1) {
          device.queue.submit([enc.finish()]);
          enc = device.createCommandEncoder();
        }
      }
      if (bloom.resize(pw, ph) || !binds.final.length)
        binds.final = [0, 1].map((k) =>
          device.createBindGroup({
            layout: finalP.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: rU } },
              { binding: 1, resource: bloom.scene.createView() },
              { binding: 2, resource: bloom.bloom.createView() },
              { binding: 3, resource: tex.scal![k]!.createView() },
              { binding: 4, resource: samp },
            ],
          }),
        );
      device.queue.writeBuffer(rU, 0, new Float32Array([info.W, info.H, 0, t]));
      const p1 = enc.beginRenderPass({ colorAttachments: [{ view: bloom.scene.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      p1.setPipeline(renderP);
      p1.setBindGroup(0, binds.render[sCur]!);
      p1.draw(3);
      p1.setPipeline(sparkDrawP);
      p1.setBindGroup(0, binds.sparkDraw);
      p1.draw(6, SPARKS);
      p1.end();
      bloom.run(enc);
      const p2 = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      p2.setPipeline(finalP);
      p2.setBindGroup(0, binds.final[sCur]!);
      p2.draw(3);
      p2.end();
      device.queue.submit([enc.finish()]);
    },
  };
}
