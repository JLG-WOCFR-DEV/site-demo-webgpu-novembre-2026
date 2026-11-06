/**
 * Lave — le sol, le feu, les braises et la carte qui brûle, dans un canvas posé sur la liste (il laisse passer les
 * clics). Unités : pixels CSS de la section, y vers le bas ; la ligne de lave est `hor`.
 *
 * 1. Le feu est un fluide (fluides stables, Stam 1999 ; modèle : rune-fx `firesim.wgsl`, MIT) sur une grille de
 *    cellules de CELL px qui couvre la largeur, de la ligne jusqu'à FIRE_H px au-dessus. État rgba16float : vitesse
 *    (px/s), température, fumée. Un pas fixe de 1/60 s : rotationnel → forces (poussée, confinement des tourbillons,
 *    balancement, émission sur le combustible, refroidissement en fumée) → divergence → Jacobi (pression) →
 *    projection → advection semi-lagrangienne. Le combustible est un tableau par colonne écrit par le CPU.
 * 2. Le sol est un plan en perspective découpé en cellules de Voronoï dont les bords rougeoient ; la chaleur suit un
 *    bruit lent, la carte tenue près du bord et le feu l'avivent. Une ligne incandescente, un voile de chaleur.
 * 3. Les braises : trois couches de points qui montent, plus nombreuses quand ça brûle.
 * 4. La carte jetée : son impression (texture) tombe, s'enfonce sous la ligne (le sol, dessiné après, la couvre) et un
 *    front de bruit la consume depuis le bas.
 *
 * Variante « glace » (thème 1), le même moteur à l'envers : un lac gelé (fissures blanches en surface, d'autres en
 * profondeur, givre, reflets rasants, éclats), de la neige qui tombe au lieu de braises qui montent, et le même fluide
 * avec une poussée négative — un brouillard froid qui retombe sur la glace et s'y étale. La carte jetée se pose sur la
 * glace et y glisse (frottement faible), se couvre de givre depuis le bas, se fend, puis vole en éclats qui filent sur
 * la glace : chaque pixel cherche l'éclat (cellule de Voronoï) qui le couvre une fois déplacé.
 */

import { OneShots } from "../presse/oneshots.ts";
import { SPRING_WGSL } from "../gpu/springs.ts";

export const CELL = 4;
/** Cartes éclairées et porteuses d'ombre, au plus. */
export const MAX_RECTS = 12;
const STEP = 1 / 60;
const MAX_STEPS = 3;
const JACOBI = 14;

const SIM = /* wgsl */ `
struct P {
  dims: vec4f, // nx, ny, cellule (px), dt
  t: vec4f,    // temps, graine, profondeur de la source (cellules), montée (px/s)
  f: vec4f,    // poussée (px/s²), refroidissement (1/s), tourbillons, fumée produite
  f2: vec4f,   // dissipation de la fumée (1/s), balancement (px/s²), amortissement, 0
}
@group(0) @binding(0) var<uniform> u: P;
@group(0) @binding(1) var sIn: texture_2d<f32>;
@group(0) @binding(2) var sOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var aIn: texture_2d<f32>;
@group(0) @binding(4) var bIn: texture_2d<f32>;
@group(0) @binding(5) var rOut: texture_storage_2d<r32float, write>;
@group(0) @binding(6) var<storage, read> fuel: array<f32>;
@group(0) @binding(7) var samp: sampler;

fn n() -> vec2i { return vec2i(u.dims.xy); }
fn cl(c: vec2i) -> vec2i { return clamp(c, vec2i(0), n() - 1); }
fn S(c: vec2i) -> vec4f { return textureLoad(sIn, cl(c), 0); }
fn A(c: vec2i) -> f32 { return textureLoad(aIn, cl(c), 0).r; }
fn B(c: vec2i) -> f32 { return textureLoad(bIn, cl(c), 0).r; }
// Pression : ouverte en haut et sur les côtés (0), mur en bas (même valeur).
fn Pp(c: vec2i) -> f32 {
  if (c.y < 0 || c.x < 0 || c.x >= n().x) { return 0.0; }
  return A(cl(c));
}
fn h1(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2f(1.0, 0.0)), w.x), mix(h1(i + vec2f(0.0, 1.0)), h1(i + vec2f(1.0, 1.0)), w.x), w.y);
}
const X = vec2i(1, 0);
const Y = vec2i(0, 1);

@compute @workgroup_size(8, 8) fn curl(@builtin(global_invocation_id) g: vec3u) {
  let c = vec2i(g.xy);
  if (any(c >= n())) { return; }
  let w = (S(c + X).y - S(c - X).y - S(c + Y).x + S(c - Y).x) / (2.0 * u.dims.z);
  textureStore(rOut, c, vec4f(w, 0.0, 0.0, 0.0));
}

@compute @workgroup_size(8, 8) fn forces(@builtin(global_invocation_id) g: vec3u) {
  let c = vec2i(g.xy);
  if (any(c >= n())) { return; }
  let h = u.dims.z;
  let dt = u.dims.w;
  var s = S(c);
  var f = vec2f(0.0);
  // Confinement des tourbillons : rend aux volutes ce que la grille diffuse.
  let gw = vec2f(abs(A(c + X)) - abs(A(c - X)), abs(A(c + Y)) - abs(A(c - Y))) * 0.5;
  let gl = length(gw);
  let w = A(c);
  if (gl > 1e-5) {
    let nn = gw / gl;
    f += u.f.z * h * vec2f(nn.y * w, -nn.x * w);
  }
  let x = (f32(c.x) + 0.5) * h;
  let y = (f32(c.y) + 0.5) * h;
  // L'air chaud monte (y vers le bas), et se balance un peu.
  f.y -= u.f.x * s.z;
  f.x += u.f2.y * (vn(vec2f(x * 0.012 + u.t.y, y * 0.02 - u.t.x * 2.2)) - 0.5) * (0.3 + s.z);
  var v = s.xy + f * dt;
  // Le combustible, sur les rangées du bas : des langues, pas un mur.
  let fromBottom = n().y - 1 - c.y;
  let fu = fuel[c.x];
  if (f32(fromBottom) < u.t.z && fu > 0.002) {
    let a = vn(vec2f(x * 0.024 + u.t.y + u.t.x * 0.6, u.t.x * 2.4));
    let b = vn(vec2f(x * 0.075 - u.t.x * 1.6, u.t.x * 4.5 + 3.0));
    let tongue = smoothstep(0.25, 0.85, a * 0.62 + b * 0.48);
    s.z = max(s.z, fu * (0.3 + 0.95 * tongue));
    v.y = min(v.y, -u.t.w * fu * (0.35 + 0.85 * tongue));
  }
  // Refroidissement ; le gaz refroidi devient fumée, qui se dissipe.
  let cool = u.f.y * dt * (0.25 + 0.75 * s.z);
  s.w = s.w * exp(-u.f2.x * dt) + u.f.w * min(cool, s.z);
  s.z = max(0.0, s.z - cool);
  v *= exp(-u.f2.z * dt);
  if (fromBottom == 0) { v.y = min(v.y, 0.0); }
  textureStore(sOut, c, vec4f(v, s.z, min(s.w, 1.5)));
}

@compute @workgroup_size(8, 8) fn divergence(@builtin(global_invocation_id) g: vec3u) {
  let c = vec2i(g.xy);
  if (any(c >= n())) { return; }
  let d = (S(c + X).x - S(c - X).x + S(c + Y).y - S(c - Y).y) / (2.0 * u.dims.z);
  textureStore(rOut, c, vec4f(d, 0.0, 0.0, 0.0));
}

@compute @workgroup_size(8, 8) fn jacobi(@builtin(global_invocation_id) g: vec3u) {
  let c = vec2i(g.xy);
  if (any(c >= n())) { return; }
  let p = (Pp(c - X) + Pp(c + X) + Pp(c - Y) + Pp(c + Y) - B(c) * u.dims.z * u.dims.z) * 0.25;
  textureStore(rOut, c, vec4f(p, 0.0, 0.0, 0.0));
}

@compute @workgroup_size(8, 8) fn project(@builtin(global_invocation_id) g: vec3u) {
  let c = vec2i(g.xy);
  if (any(c >= n())) { return; }
  let s = S(c);
  let gp = vec2f(Pp(c + X) - Pp(c - X), Pp(c + Y) - Pp(c - Y)) / (2.0 * u.dims.z);
  textureStore(sOut, c, vec4f(s.xy - gp, s.zw));
}

@compute @workgroup_size(8, 8) fn advect(@builtin(global_invocation_id) g: vec3u) {
  let c = vec2i(g.xy);
  if (any(c >= n())) { return; }
  let s = S(c);
  let back = vec2f(c) + 0.5 - s.xy * u.dims.w / u.dims.z;
  let size = vec2f(n());
  var r = textureSampleLevel(sIn, samp, back / size, 0.0);
  // Ce qui viendrait d'au-dessus ou des côtés est de l'air frais ; le bas est un mur.
  if (back.x < 0.0 || back.x > size.x || back.y < 0.0) { r = vec4f(0.0); }
  textureStore(sOut, c, r);
}
`;

const COMMON = /* wgsl */ `
struct R {
  view: vec4f, // largeur, hauteur (px CSS), dpr, temps
  hor: vec4f,  // ligne de lave, haut du domaine du feu, hauteur du domaine, mouvement réduit
  hot: vec4f,  // carte tenue : x0, x1, proximité ; braises (densité)
  card: vec4f, // dernière carte : x0, x1, éclat ; thème (0 lave, 1 glace)
  light: vec4f, // nombre de cartes, intensité de la lumière du sol, 0, 0
  burst: array<vec4f, 4>,  // gerbes d'étincelles : x, y, âge (s), opacité
  burst2: array<vec4f, 4>, // largeur, graine, 0, 0
  rects: array<vec4f, 12>, // les cartes (px CSS) : x, y, largeur, hauteur
}
fn hash1(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn hash2(p: vec2f) -> vec2f {
  return fract(sin(vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)))) * 43758.5453);
}
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2f(1.0, 0.0)), w.x), mix(hash1(i + vec2f(0.0, 1.0)), hash1(i + vec2f(1.0, 1.0)), w.x), w.y);
}
fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var a = 0.5;
  var s = 0.0;
  for (var i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2f(17.0, 9.0);
    a *= 0.5;
  }
  return s;
}
`;

const RENDER = /* wgsl */ `
${COMMON}
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var fireTex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

// Couleur du corps noir, à peu près : rouge sombre, orange, jaune, presque blanc.
fn blackbody(t: f32) -> vec3f {
  let a = vec3f(0.45, 0.03, 0.0);
  let b = vec3f(1.0, 0.3, 0.03);
  let c = vec3f(1.0, 0.64, 0.16);
  let d = vec3f(1.0, 0.93, 0.66);
  var col = mix(a, b, smoothstep(0.0, 0.35, t));
  col = mix(col, c, smoothstep(0.35, 0.75, t));
  col = mix(col, d, smoothstep(0.75, 1.15, t));
  return col * (1.0 + 0.6 * smoothstep(0.6, 1.2, t));
}

// Le feu (prémultiplié) : la température en couleur, la fumée en voile sombre.
fn fire(p: vec2f) -> vec4f {
  // Les langues lèchent : un décalage horizontal qui ondule, nul au pied, grandissant avec la hauteur.
  let up = clamp((r.hor.x - p.y) / 90.0, 0.0, 1.0);
  let t = r.view.w;
  let wob = (vnoise(vec2f(p.x * 0.035, p.y * 0.03 + t * 2.6)) - 0.5) * 22.0 * up;
  let uv = vec2f((p.x + wob) / r.view.x, (p.y - r.hor.y) / r.hor.z);
  let s = textureSampleLevel(fireTex, samp, clamp(uv, vec2f(0.0), vec2f(1.0)), 0.0);
  let inside = select(0.0, 1.0, uv.y >= 0.0 && uv.y <= 1.0);
  // Du détail que la grille de 4 px n'a pas : un bruit qui monte avec les gaz, et une silhouette plus nette.
  let fine = fbm(vec2f(p.x * 0.055, p.y * 0.035 + t * 3.2));
  let temp = s.z * inside * (0.55 + 0.9 * fine);
  if (r.card.w > 0.5) {
    // Glace : la même grille porte un brouillard froid, laiteux et bleuté.
    let fa = smoothstep(0.02, 0.75, temp) * 0.8;
    return vec4f(vec3f(0.8, 0.89, 0.97) * fa, fa);
  }
  let a = smoothstep(0.1, 0.42, temp);
  let sm = clamp(s.w * 0.3, 0.0, 0.45) * inside * (1.0 - a);
  return vec4f(blackbody(temp) * a + vec3f(0.05, 0.045, 0.045) * sm, a + sm);
}

// Les braises : trois couches de points qui montent en ondulant.
fn embers(p: vec2f, t: f32) -> vec3f {
  var acc = vec3f(0.0);
  let above = r.hor.x - p.y;
  for (var l = 0; l < 3; l++) {
    let fl = f32(l);
    let g = 64.0 + fl * 46.0;
    let speed = 34.0 + fl * 20.0;
    let q = vec2f(p.x + sin(p.y * 0.012 + t * 0.7 + fl * 2.1) * 12.0, p.y + t * speed);
    let cell = floor(q / g);
    let f = q / g - cell;
    let h = hash2(cell + fl * 31.7);
    let h3 = hash1(cell * 1.7 + fl);
    let d = length((f - (0.15 + 0.7 * h)) * g);
    let size = 0.55 + 1.2 * h3;
    let flick = 0.55 + 0.45 * sin(t * (3.0 + h.x * 5.0) + h.y * 40.0);
    // Plus on monte, plus elles s'éteignent ; la densité suit le feu.
    let height = exp(-max(above, 0.0) / (150.0 + 110.0 * fl)) * smoothstep(-30.0, 10.0, above);
    let alive = step(1.0 - clamp(r.hot.w * (0.5 - 0.1 * fl), 0.0, 1.0), h3);
    let k = alive * height * flick;
    acc += vec3f(1.0, 0.55, 0.18) * k * (exp(-d * d / (size * size)) * 1.5 + exp(-d / (size * 3.0)) * 0.12);
  }
  return acc;
}

// La neige : trois couches de flocons qui descendent en se balançant, plus gros et plus lents devant.
fn snow(p: vec2f, t: f32) -> vec3f {
  var acc = vec3f(0.0);
  for (var l = 0; l < 3; l++) {
    let fl = f32(l);
    let g = 48.0 + fl * 34.0;
    let speed = 22.0 + fl * 14.0;
    let q = vec2f(p.x + sin(p.y * 0.02 + t * (0.6 + 0.2 * fl) + fl * 1.7) * (8.0 + 6.0 * fl), p.y - t * speed);
    let cell = floor(q / g);
    let f = q / g - cell;
    let h = hash2(cell + fl * 13.1);
    let h3 = hash1(cell * 2.3 + fl);
    let d = length((f - (0.15 + 0.7 * h)) * g);
    let size = 0.7 + 1.1 * h3 + 0.5 * fl;
    let alive = step(0.45, h3);
    acc += vec3f(0.85, 0.92, 1.0) * alive * (exp(-d * d / (size * size)) * (0.45 + 0.2 * fl));
  }
  // Rien sous la ligne (les flocons s'y posent).
  return acc * smoothstep(4.0, -2.0, p.y - r.hor.x);
}

/* ── Lumière du sol (d'après rune-light) : chaque carte est un rectangle arrondi connu. ── */

// erf (Abramowitz et Stegun 7.1.26) : assez juste pour une pénombre.
fn erf7(x: f32) -> f32 {
  let a = abs(x);
  let t = 1.0 / (1.0 + 0.3275911 * a);
  let y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-a * a);
  return sign(x) * y;
}
// L'ombre d'une carte éclairée par en dessous : une bande au-dessus d'elle, floue en forme close (une source étendue
// donne une pénombre qui s'élargit avec la distance), sans marche de rayons.
fn cardShadow(p: vec2f, rc: vec4f) -> f32 {
  let above = rc.y + rc.w - p.y;
  let up = max(0.0, rc.y - p.y);
  let sigma = 2.0 + 0.2 * up;
  let k = 0.70710678 / sigma;
  let cov = 0.5 * (erf7((p.x - rc.x) * k) - erf7((p.x - rc.x - rc.z) * k));
  return cov * smoothstep(0.0, 8.0, above) * exp(-up / 240.0);
}
// Ce que voit la ligne depuis p : le produit des ombres des cartes (sauf « skip »).
fn visibility(p: vec2f, skip: i32) -> f32 {
  var v = 1.0;
  let n = i32(r.light.x);
  for (var i = 0; i < 12; i++) {
    if (i >= n) { break; }
    if (i == skip) { continue; }
    v *= 1.0 - 0.8 * cardShadow(p, r.rects[i]);
  }
  return v;
}
fn sdRect(p: vec2f, rc: vec4f, rad: f32) -> f32 {
  let q = abs(p - (rc.xy + rc.zw * 0.5)) - rc.zw * 0.5 + rad;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - rad;
}
// La lumière reçue par une carte : plus forte près de la ligne, un liseré sur le bord tourné vers elle ; les cartes
// plus bas la masquent. Additive (alpha 0) : elle s'ajoute au HTML dessous.
fn cardLight(p: vec2f) -> vec3f {
  let n = i32(r.light.x);
  for (var i = 0; i < 12; i++) {
    if (i >= n) { break; }
    let rc = r.rects[i];
    let sd = sdRect(p, rc, 12.0);
    if (sd < 0.0) {
      let dist = max(0.0, r.hor.x - (rc.y + rc.w));
      let base = exp(-dist / 170.0);
      let fy = clamp((p.y - rc.y) / rc.w, 0.0, 1.0);
      let rim = exp(sd / 2.2) * smoothstep(0.35, 1.0, fy);
      let vis = visibility(vec2f(p.x, rc.y + rc.w + 1.0), i);
      var col = vec3f(1.0, 0.42, 0.1);
      if (r.card.w > 0.5) { col = vec3f(0.5, 0.75, 1.0) * 0.6; }
      let fl = textureSampleLevel(fireTex, samp, vec2f(clamp(p.x / r.view.x, 0.0, 1.0), 0.985), 0.0).z;
      return col * r.light.y * (1.0 + 1.6 * fl) * base * vis * (0.05 + 0.3 * pow(fy, 3.0) + 0.9 * rim);
    }
  }
  return vec3f(0.0);
}

// Les gerbes d'étincelles (un réservoir d'effets ponctuels côté CPU) : des traînées balistiques.
fn sparks(p: vec2f) -> vec3f {
  var acc = vec3f(0.0);
  let ice = r.card.w > 0.5;
  for (var b = 0; b < 4; b++) {
    let B = r.burst[b];
    if (B.w <= 0.0) { continue; }
    let w = r.burst2[b].x;
    let seed = r.burst2[b].y;
    if (abs(p.x - B.x) > w * 0.5 + 420.0 || p.y > B.y + 40.0 || p.y < B.y - 520.0) { continue; }
    for (var i = 0; i < 28; i++) {
      let h = hash2(vec2f(f32(i), seed));
      let h3 = hash1(vec2f(seed, f32(i) * 1.3));
      let life = select(0.5 + 0.7 * h3, 0.7 + 0.8 * h3, ice);
      let age = B.z - 0.15 * h3;
      if (age < 0.0 || age > life) { continue; }
      let ang = (h.x - 0.5) * 1.7;
      let speed = select(170.0 + 380.0 * h.y, 90.0 + 220.0 * h.y, ice);
      let g = select(900.0, 260.0, ice);
      let o = vec2f(B.x + (h3 - 0.5) * w, B.y);
      let v0 = vec2f(sin(ang), -cos(ang)) * speed;
      let pos = o + v0 * age + vec2f(0.0, 0.5 * g * age * age);
      let vel = v0 + vec2f(0.0, g * age);
      // Une traînée : la distance au segment parcouru pendant l'obturateur.
      let a = pos - vel * 0.018;
      let ab = pos - a;
      let ts = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
      let d = length(p - (a + ab * ts));
      let fade = (1.0 - age / life) * B.w;
      let col = select(vec3f(1.0, 0.62, 0.22), vec3f(0.85, 0.95, 1.0), ice);
      acc += col * fade * (exp(-d * d / 1.1) * 1.5 + exp(-d / 4.0) * 0.08);
    }
  }
  return acc;
}

// Ce qui est au-dessus du sol : la ligne, le voile, le feu, les braises.
fn sky(p: vec2f) -> vec4f {
  let t = r.view.w;
  let dy = p.y - r.hor.x;
  if (r.card.w > 0.5) {
    // Glace : une ligne froide et fine, un halo pâle, le brouillard, la neige.
    let line = exp(-abs(dy) / 0.9) * 0.85 + exp(-abs(dy) / 7.0) * 0.22;
    let haze = select(0.0, exp(dy / 170.0) * 0.16, dy < 0.0) * visibility(p, -1);
    var col = vec3f(0.78, 0.93, 1.0) * line + vec3f(0.3, 0.52, 0.72) * haze;
    var a = clamp(line + haze * 0.6, 0.0, 1.0);
    let fo = fire(p);
    col = fo.rgb + col * (1.0 - fo.a);
    a = fo.a + a * (1.0 - fo.a);
    let sn = snow(p, t) + sparks(p);
    col += sn + cardLight(p);
    a = clamp(a + sn.g, 0.0, 1.0);
    return vec4f(col, a);
  }
  let line = exp(-abs(dy) / 1.1) * 1.1 + exp(-abs(dy) / 9.0) * 0.32;
  // Le voile de chaleur éclaire la page ; les cartes y projettent leur ombre.
  let haze = select(0.0, exp(dy / 150.0) * (0.17 + 0.25 * r.light.y), dy < 0.0) * visibility(p, -1);
  var col = vec3f(1.0, 0.6, 0.22) * line + vec3f(0.9, 0.25, 0.05) * haze;
  var a = clamp(line + haze * 0.6, 0.0, 1.0);
  let fi = fire(p);
  col = fi.rgb + col * (1.0 - fi.a);
  a = fi.a + a * (1.0 - fi.a);
  let e = embers(p, t) + sparks(p);
  col += e + cardLight(p);
  a = clamp(a + max(e.r, max(e.g, e.b)), 0.0, 1.0);
  return vec4f(col, a);
}

@fragment fn fs_sky(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  return sky(pos.xy / r.view.z);
}

// Voronoï : distance au bord le plus proche (Inigo Quilez) et identité de la cellule.
fn voronoi(x: vec2f) -> vec2f {
  let ip = floor(x);
  let fp = fract(x);
  var mg = vec2f(0.0);
  var mr = vec2f(0.0);
  var md = 8.0;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let gg = vec2f(f32(i), f32(j));
      let o = hash2(ip + gg);
      let rr = gg + o - fp;
      let d = dot(rr, rr);
      if (d < md) { md = d; mr = rr; mg = gg; }
    }
  }
  md = 8.0;
  for (var j = -2; j <= 2; j++) {
    for (var i = -2; i <= 2; i++) {
      let gg = mg + vec2f(f32(i), f32(j));
      let o = hash2(ip + gg);
      let rr = gg + o - fp;
      if (dot(mr - rr, mr - rr) > 1e-5) { md = min(md, dot(0.5 * (mr + rr), normalize(rr - mr))); }
    }
  }
  return vec2f(md, hash1(ip + mg));
}

@fragment fn fs_lava(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy / r.view.z;
  let t = r.view.w;
  let d = max(p.y - r.hor.x, 0.35);
  // Un plan vu de près : profondeur Z = f/d, abscisse X = (x − cx)/d.
  // Un plan vu de biais : X = (x − cx)·h/d, Z = f·h/d (f = 300 px) ; les cellules s'aplatissent vers l'horizon.
  let hh = 3.4;
  let q = vec2f((p.x - r.view.x * 0.5) * hh / d, 300.0 * hh / d);
  let px = length(fwidth(q));
  // Un gauchissement : des fissures irrégulières, pas un nid d'abeilles.
  let qw = q + 0.32 * vec2f(vnoise(q * 1.1) - 0.5, vnoise(q * 1.1 + vec2f(7.3, 2.9)) - 0.5);
  let v1 = voronoi(qw);
  let q2 = qw * 2.3 + vec2f(5.2, 1.3);
  let v2 = voronoi(q2);
  let px2 = px * 2.3;
  // La chaleur bouge lentement sous la croûte.
  let heat = fbm(q * 0.55 + vec2f(t * 0.05, -t * 0.03));
  var k = mix(0.06, 1.6, pow(smoothstep(0.3, 0.78, heat), 1.6)) * (0.45 + 0.9 * v1.y);
  // La carte tenue au-dessus du bord, et le feu, avivent le sol en dessous.
  let dx = max(max(r.hot.x - p.x, p.x - r.hot.y), 0.0);
  let hot = r.hot.z * exp(-dx * dx / 9000.0) * exp(-d / 110.0);
  let flame = textureSampleLevel(fireTex, samp, vec2f(clamp(p.x / r.view.x, 0.0, 1.0), 0.985), 0.0).z;
  k *= 1.0 + 2.6 * hot + 1.8 * flame * exp(-d / 140.0);
  if (r.card.w > 0.5) {
    // Le lac gelé : du bleu profond, des fissures blanches en surface, d'autres plus bas, du givre, un reflet rasant.
    let far = smoothstep(0.15, 0.7, px);
    let deep = fbm(q * 0.25 + vec2f(0.0, t * 0.01));
    var ice = mix(vec3f(0.012, 0.045, 0.08), vec3f(0.04, 0.13, 0.2), deep);
    let low = (1.0 - smoothstep(0.0, 0.05 + px2 * 1.2, v2.x)) * mix(0.14, 0.04, smoothstep(0.15, 0.7, px2));
    ice += vec3f(0.25, 0.48, 0.65) * low;
    // Peu de fissures en surface : seulement là où la glace a travaillé (un masque lent), et pas sur toutes les plaques.
    let worked = smoothstep(0.45, 0.72, fbm(q * 0.3 + vec2f(11.0, 4.0))) * step(0.35, v1.y);
    let crackI = mix(1.0 - smoothstep(0.0, 0.01 + px * 1.1, v1.x), 0.02, far) * worked;
    ice = mix(ice, vec3f(0.8, 0.92, 0.99), clamp(crackI * 0.7, 0.0, 1.0));
    let frost = smoothstep(0.52, 0.8, fbm(q * 0.6 + vec2f(3.0, 1.0)));
    ice = mix(ice, vec3f(0.5, 0.62, 0.72), frost * 0.4);
    ice += vec3f(0.3, 0.5, 0.68) * exp(-d / 45.0) * 0.55;
    // Des éclats : un point sur mille, qui scintille.
    let gl = hash1(floor(p * 0.5));
    ice += vec3f(0.9, 0.97, 1.0) * step(0.9975, gl) * (0.5 + 0.5 * sin(t * 4.0 + gl * 100.0)) * (1.0 - far);
    // La carte tenue au-dessus : un froid bleuté dessous ; le brouillard éclaire le pied de la ligne.
    ice += vec3f(0.35, 0.6, 0.85) * hot * 0.45 + vec3f(0.5, 0.62, 0.72) * flame * exp(-d / 90.0) * 0.4;
    ice *= 1.0 - 0.22 * smoothstep(0.55, 1.0, (p.y - r.hor.x) / max(1.0, r.view.y - r.hor.x));
    let si = sky(p);
    return vec4f(si.rgb + ice * (1.0 - si.a), 1.0);
  }
  // Les fissures, nettes de près, moyennées au loin (une cellule plus petite qu'un pixel n'a plus de bord).
  let core1 = 1.0 - smoothstep(0.0, 0.016 + px * 1.1, v1.x);
  let halo1 = exp(-v1.x / (0.045 + px));
  let core2 = (1.0 - smoothstep(0.0, 0.012 + px2 * 1.1, v2.x)) * 0.45;
  let far = smoothstep(0.15, 0.7, px);
  let crack = mix(max(core1, core2 * smoothstep(0.4, 0.7, heat)), 0.1, far);
  let glow = mix(halo1 * 0.3, 0.1, far);
  // La croûte : sombre, un grain, une teinte par plaque.
  let grain = vnoise(q * 9.0) * 0.5 + vnoise(q * 23.0) * 0.25;
  var rock = vec3f(0.055, 0.034, 0.03) * (0.6 + 0.55 * grain) * (0.75 + 0.5 * v1.y);
  rock += vec3f(0.38, 0.07, 0.0) * glow * k * 0.5;
  let hotCol = mix(vec3f(0.85, 0.2, 0.015), vec3f(1.0, 0.68, 0.25), clamp(crack * heat * k * 0.55, 0.0, 1.0));
  var col = mix(rock, hotCol * (0.45 + 0.65 * k), clamp(crack * (0.15 + 0.85 * k), 0.0, 1.0));
  // L'horizon : un voile de chaleur sur les dernières rangées, le bas un peu plus sombre.
  col = mix(col, vec3f(0.24, 0.055, 0.015), exp(-d / 22.0) * 0.6);
  col *= 1.0 - 0.25 * smoothstep(0.55, 1.0, (p.y - r.hor.x) / max(1.0, r.view.y - r.hor.x));
  // Le ciel par-dessus (la ligne, le feu qui y prend racine, les braises qui en partent).
  let s = sky(p);
  return vec4f(s.rgb + col * (1.0 - s.a), 1.0);
}
`;

const CARD = /* wgsl */ `
${COMMON}
${SPRING_WGSL}
struct C {
  rect: vec4f, // x, y, largeur, hauteur (px CSS)
  m: vec4f,    // brûlé ou gelé (0 → 1,35), chaleur, graine, opacité
  view: vec4f, // largeur, hauteur, dpr, rayon des coins
  ext: vec4f,  // marge du quad (px), thème, 0, 0
  mo: vec4f,   // vitesse (px/s) x, y ; secondes depuis le bris ; 0
}
@group(0) @binding(0) var<uniform> c: C;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
struct O { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> O {
  let k = array<vec2f, 6>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0), vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0))[i];
  // Une marge autour de la carte : les éclats en sortent.
  let mg = c.ext.x;
  let p = c.rect.xy - mg + k * (c.rect.zw + 2.0 * mg);
  var o: O;
  o.pos = vec4f(p.x / c.view.x * 2.0 - 1.0, 1.0 - p.y / c.view.y * 2.0, 0.0, 1.0);
  o.uv = (p - c.rect.xy) / c.rect.zw;
  return o;
}

// Les éclats : les cellules d'un Voronoï sur la carte (une unité ≈ un éclat).
fn site(g: vec2f) -> vec2f { return g + 0.15 + 0.7 * hash2(g + c.m.z); }
fn nearest(x: vec2f) -> vec3f {
  let ip = floor(x);
  var best = vec2f(0.0);
  var md = 9.0;
  var md2 = 9.0;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let g = ip + vec2f(f32(i), f32(j));
      let d = length(site(g) - x);
      if (d < md) { md2 = md; md = d; best = g; } else if (d < md2) { md2 = d; }
    }
  }
  // Troisième composante : à quelle distance du bord de l'éclat (≈ écart aux deux plus proches).
  return vec3f(best, md2 - md);
}

fn freeze(uv0: vec2f) -> vec4f {
  let p = c.m.x;
  let aspect = c.rect.z / max(1.0, c.rect.w);
  let sc = vec2f(aspect * 1.9, 1.9);
  let x = uv0 * sc;
  // Le déplacement de chaque éclat : un ressort par éclat et par axe, évalué ici (src/gpu/springs.ts) ; parti de
  // zéro avec un élan, il dépasse un peu sa place puis s'y pose — l'éclat dérape sur la glace.
  let tsh = c.mo.z;
  var src = uv0;
  var edge = 1.0;
  var found = false;
  let ip = floor(x);
  for (var j = -2; j <= 2; j++) {
    for (var i = -2; i <= 2; i++) {
      let g = ip + vec2f(f32(i), f32(j));
      let st = site(g);
      let h = hash2(g * 3.1 + c.m.z);
      let dir = normalize(st - sc * 0.5 + vec2f(0.001, 0.0));
      let goal = (dir * vec2f(0.55, 0.25) + vec2f((h.x - 0.5) * 0.4, 0.9 + 1.2 * h.y)) * (0.6 + 0.6 * h.x);
      var off = vec2f(0.0);
      if (tsh > 0.0) {
        let w0 = 7.0 + 4.0 * h.y;
        off.x = spring_at(SpringTrack(vec4f(-goal.x, goal.x * 4.0, w0, 0.55), vec4f(goal.x, 0.0, 0.0, 0.0)), 0.0, tsh).x;
        off.y = spring_at(SpringTrack(vec4f(-goal.y, goal.y * 4.0, w0, 0.55), vec4f(goal.y, 0.0, 0.0, 0.0)), 0.0, tsh).x;
      }
      let back = x - off;
      let n = nearest(back);
      if (!found && all(n.xy == g)) {
        found = true;
        src = back / sc;
        edge = n.z;
      }
    }
  }
  let inside = select(0.0, 1.0, found && all(src >= vec2f(0.0)) && all(src <= vec2f(1.0)));
  // Flou d'obturateur : la carte qui glisse est échantillonnée là où elle était pendant la demi-image écoulée.
  let sh = vec2f(c.mo.x, 0.0) * (1.0 / 120.0) / c.rect.zw;
  var tx = vec4f(0.0);
  for (var k = 0; k < 4; k++) {
    let u = src - sh * (f32(k) / 3.0);
    let inU = select(0.0, 1.0, all(u >= vec2f(0.0)) && all(u <= vec2f(1.0)));
    tx += textureSample(tex, samp, clamp(u, vec2f(0.0), vec2f(1.0))) * inU;
  }
  tx *= inside * 0.25;
  // Le givre monte du bas et des bords, en ramifications.
  let n1 = fbm(src * vec2f(aspect * 4.0, 4.0) + c.m.z);
  let ridge = 1.0 - abs(fbm(src * vec2f(aspect * 11.0, 11.0) + 7.0) * 2.0 - 1.0);
  let field = (1.0 - src.y) * 0.55 + min(src.x, 1.0 - src.x) * 0.5 + n1 * 0.45;
  let fr = 1.0 - smoothstep(p * 1.25 - 0.2, p * 1.25, field);
  let lum = dot(tx.rgb, vec3f(0.3, 0.55, 0.15));
  var col = mix(tx.rgb, vec3f(lum) * vec3f(0.75, 0.88, 1.0) + vec3f(0.02, 0.05, 0.09) * tx.a, fr * 0.8);
  col = mix(col, vec3f(0.84, 0.92, 0.99) * tx.a, fr * (0.35 + 0.45 * pow(ridge, 4.0)));
  // Les fêlures apparaissent, puis chaque éclat garde un liseré clair.
  let crack = (1.0 - smoothstep(0.0, 0.05, edge)) * smoothstep(0.55, 0.78, p);
  col = mix(col, vec3f(0.95, 0.99, 1.0) * tx.a, crack * 0.9);
  // Le froid qui monte de la glace quand la carte approche.
  col += vec3f(0.35, 0.6, 0.9) * c.m.y * pow(clamp(src.y, 0.0, 1.0), 3.0) * 0.35 * tx.a;
  // Tout est prémultiplié par tx.a ; les éclats s'effacent à la fin.
  let fade = (1.0 - smoothstep(1.05, 1.35, p)) * c.m.w;
  return vec4f(col * fade, tx.a * fade);
}

@fragment fn fs(o: O) -> @location(0) vec4f {
  if (c.ext.y > 0.5) { return freeze(o.uv); }
  // Flou d'obturateur analytique : la position exacte de la carte à six instants de la demi-image écoulée (on connaît
  // sa vitesse), moyennée. À l'arrêt, les six échantillons tombent au même endroit : rien ne bave.
  let sh = c.mo.xy * (1.0 / 120.0) / c.rect.zw;
  var tx = vec4f(0.0);
  for (var k = 0; k < 6; k++) {
    let u = o.uv - sh * (f32(k) / 5.0);
    let inU = select(0.0, 1.0, all(u >= vec2f(0.0)) && all(u <= vec2f(1.0)));
    tx += textureSample(tex, samp, clamp(u, vec2f(0.0), vec2f(1.0))) * inU;
  }
  tx *= 1.0 / 6.0;
  let aspect = c.rect.z / max(1.0, c.rect.w);
  let n = fbm(o.uv * vec2f(aspect * 2.6, 2.6) + vec2f(c.m.z, c.m.z * 1.7));
  // Le front part du bas (le côté qui touche la lave) et des bords, rongé par le bruit.
  let f = (1.0 - o.uv.y) * 0.72 + n * 0.5 + abs(o.uv.x - 0.5) * 0.12;
  let e = f - c.m.x;
  let gone = 1.0 - smoothstep(-0.012, 0.012, e);
  let ember = exp(-max(e, 0.0) / 0.022) * (1.0 - gone);
  let charK = 1.0 - smoothstep(0.0, 0.24, e);
  let keep = 1.0 - gone;
  var col = tx.rgb * mix(1.0, 0.12, charK * 0.92) * keep;
  col += (vec3f(1.0, 0.42, 0.06) * 1.6 * ember + vec3f(1.0, 0.85, 0.45) * pow(ember, 5.0)) * tx.a;
  // La lave éclaire le bas de la carte.
  col += vec3f(1.0, 0.33, 0.05) * c.m.y * pow(o.uv.y, 3.0) * 0.45 * tx.a * keep;
  let a = (tx.a * keep + ember * tx.a * 0.6) * c.m.w;
  return vec4f(col * c.m.w, min(a, 1.0));
}
`;

export type Burn = { tex: GPUTexture; x: number; y: number; w: number; h: number; vx: number; vy: number; t0: number; touch: number; seed: number; done: boolean; buf: GPUBuffer; group: GPUBindGroup };
export type Frame = { hor: number; hot: { x0: number; x1: number; k: number }; reduced: boolean; theme: 0 | 1; rects: Float32Array; nrects: number };

export async function createLava(device: GPUDevice, canvas: HTMLCanvasElement) {
  const format = navigator.gpu.getPreferredCanvasFormat();
  const ctx = canvas.getContext("webgpu")!;
  ctx.configure({ device, format, alphaMode: "premultiplied" });

  const simMod = device.createShaderModule({ code: SIM, label: "lave:feu" });
  const pipe = (entryPoint: string) => device.createComputePipeline({ layout: "auto", compute: { module: simMod, entryPoint }, label: `lave:${entryPoint}` });
  const P = { curl: pipe("curl"), forces: pipe("forces"), div: pipe("divergence"), jacobi: pipe("jacobi"), project: pipe("project"), advect: pipe("advect") };
  const linear = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });

  const renderMod = device.createShaderModule({ code: RENDER, label: "lave:sol" });
  const blend: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } };
  const fsPipe = (entryPoint: string) =>
    device.createRenderPipeline({ layout: "auto", vertex: { module: renderMod, entryPoint: "vs" }, fragment: { module: renderMod, entryPoint, targets: [{ format, blend }] }, label: `lave:${entryPoint}` });
  // Les deux moitiés ont le même schéma de liaisons : une disposition commune, un groupe pour les deux.
  const skyPipe = fsPipe("fs_sky");
  const lavaPipe = fsPipe("fs_lava");
  const cardMod = device.createShaderModule({ code: CARD, label: "lave:carte" });
  const cardPipe = device.createRenderPipeline({ layout: "auto", vertex: { module: cardMod, entryPoint: "vs" }, fragment: { module: cardMod, entryPoint: "fs", targets: [{ format, blend }] }, label: "lave:carte" });

  const uni = device.createBuffer({ size: (5 + 8 + MAX_RECTS) * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const simUni = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

  // La grille du feu, refaite à chaque changement de taille.
  type Grid = {
    nx: number;
    ny: number;
    S: GPUTexture[];
    R: GPUTexture[]; // rotationnel, divergence, pression ×2
    fuel: GPUBuffer;
    fuelData: Float32Array;
    groups: { curl: GPUBindGroup; forces: GPUBindGroup; div: GPUBindGroup; jac: GPUBindGroup[]; project: GPUBindGroup; advect: GPUBindGroup };
    skyGroup: GPUBindGroup;
    lavaGroup: GPUBindGroup;
  };
  let grid: Grid | null = null;
  let W = 1;
  let H = 1;
  let dpr = 1;
  let fireH = 280;
  let fireTop = 0;
  let hor = 0;

  const makeGrid = () => {
    if (grid) {
      for (const t of [...grid.S, ...grid.R]) t.destroy();
      grid.fuel.destroy();
    }
    const nx = Math.max(8, Math.ceil(W / CELL));
    const ny = Math.max(8, Math.ceil(fireH / CELL));
    const st = () => device.createTexture({ size: [nx, ny], format: "rgba16float", usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    const sc = () => device.createTexture({ size: [nx, ny], format: "r32float", usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    const S = [st(), st(), st()];
    const R = [sc(), sc(), sc(), sc()];
    const fuelData = new Float32Array(nx);
    const fuel = device.createBuffer({ size: Math.max(16, nx * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const v = (t: GPUTexture) => t.createView();
    const bg = (p: GPUComputePipeline, entries: [number, GPUBindingResource][]) =>
      device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: entries.map(([binding, resource]) => ({ binding, resource })) });
    const [curlT, divT, p0, p1] = R as [GPUTexture, GPUTexture, GPUTexture, GPUTexture];
    const [a, b, c] = S as [GPUTexture, GPUTexture, GPUTexture];
    // a → (forces) b → (projection) c → (advection) a. Pression : p0 ↔ p1 (un nombre pair d'itérations : fin dans p0).
    const groups = {
      curl: bg(P.curl, [
        [0, { buffer: simUni }],
        [1, v(a)],
        [5, v(curlT)],
      ]),
      forces: bg(P.forces, [
        [0, { buffer: simUni }],
        [1, v(a)],
        [2, v(b)],
        [3, v(curlT)],
        [6, { buffer: fuel }],
      ]),
      div: bg(P.div, [
        [0, { buffer: simUni }],
        [1, v(b)],
        [5, v(divT)],
      ]),
      jac: [
        bg(P.jacobi, [
          [0, { buffer: simUni }],
          [3, v(p0)],
          [4, v(divT)],
          [5, v(p1)],
        ]),
        bg(P.jacobi, [
          [0, { buffer: simUni }],
          [3, v(p1)],
          [4, v(divT)],
          [5, v(p0)],
        ]),
      ],
      project: bg(P.project, [
        [0, { buffer: simUni }],
        [1, v(b)],
        [2, v(c)],
        [3, v(p0)],
      ]),
      advect: bg(P.advect, [
        [0, { buffer: simUni }],
        [1, v(c)],
        [2, v(a)],
        [7, linear],
      ]),
    };
    const rg = (p: GPURenderPipeline) =>
      device.createBindGroup({
        layout: p.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uni } },
          { binding: 1, resource: v(a) },
          { binding: 2, resource: linear },
        ],
      });
    grid = { nx, ny, S, R, fuel, fuelData, groups, skyGroup: rg(skyPipe), lavaGroup: rg(lavaPipe) };
  };

  const resize = (w: number, h: number, horizon: number) => {
    const ndpr = Math.min(2, devicePixelRatio || 1);
    const nfire = Math.round(Math.min(320, Math.max(160, horizon * 0.55)));
    const changed = Math.round(w) !== Math.round(W) || nfire !== fireH || !grid;
    W = w;
    H = h;
    hor = horizon;
    dpr = ndpr;
    fireH = nfire;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    if (changed) makeGrid();
  };

  /* ───── Le combustible : des foyers posés par le CPU, qui s'étendent et s'éteignent ───── */

  type Fire = { x0: number; x1: number; t0: number };
  const fires: Fire[] = [];
  let hotFuel = { x0: 0, x1: 0, k: 0 };
  let theme: 0 | 1 = 0;
  const fuelAt = (x: number, now: number) => {
    let f = 0;
    for (const e of fires) {
      const a = (now - e.t0) / 1000;
      if (a < 0) continue;
      // Ça prend vite, ça brûle fort deux secondes, puis ça baisse ; le feu gagne la ligne de part et d'autre.
      // Glace : une bouffée de froid au contact, plus brève, qui roule plus loin.
      const env = theme ? Math.min(1, a / 0.25) * (a < 0.8 ? 1 : Math.exp(-(a - 0.8) / 1.4)) : Math.min(1, a / 0.18) * (a < 2 ? 1 : Math.exp(-(a - 2) / 1.8));
      const spread = theme ? 60 + a * 230 : 40 + a * 160;
      const out = Math.max(e.x0 - x, x - e.x1, 0);
      const side = out <= 0 ? 1 : Math.max(0, 1 - out / spread) * 0.55;
      f += 0.95 * env * side;
    }
    // La carte tenue juste au-dessus de la ligne : de petites flammes qui lèchent.
    if (hotFuel.k > 0.55 && x > hotFuel.x0 && x < hotFuel.x1) f += (hotFuel.k - 0.55) * 0.9;
    return Math.min(1.25, f);
  };
  let lastFuel = -1e9;
  const ignite = (x0: number, x1: number, now: number) => {
    fires.push({ x0, x1, t0: now });
    lastFuel = now;
  };

  /* ───── Les cartes qui brûlent ───── */

  const burns: Burn[] = [];
  const addBurn = (source: HTMLCanvasElement, x: number, y: number, w: number, h: number, vx: number, vy: number, now: number) => {
    const tex = device.createTexture({ size: [source.width, source.height], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    device.queue.copyExternalImageToTexture({ source }, { texture: tex, premultipliedAlpha: true }, [source.width, source.height]);
    const buf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const group = device.createBindGroup({
      layout: cardPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buf } },
        { binding: 1, resource: tex.createView() },
        { binding: 2, resource: linear },
      ],
    });
    burns.push({ tex, x, y, w, h, vx, vy: Math.max(60, vy), t0: now, touch: -1, seed: Math.random() * 50, done: false, buf, group });
  };

  /* ───── Une image ───── */

  /** Les paramètres du fluide, par sol (réglables en direct : src/presse/knobs.ts). */
  const params = {
    feu: { montee: 70, poussee: 300, refroid: 2.3, tourb: 8, balance: 700, fumee: 0.8 },
    froid: { montee: 22, poussee: -140, refroid: 0.55, tourb: 6, balance: 380, fumee: 0 },
  };
  let simAcc = 0;
  let simTime = 0;
  const udata = new Float32Array((5 + 8 + MAX_RECTS) * 4);
  // Les gerbes : au plus quatre à la fois ; la plus ancienne s'efface au lieu d'être coupée.
  const bursts = new OneShots<{ x: number; y: number; w: number }>(4);
  const sdata = new Float32Array(16);
  const cdata = new Float32Array(20);
  /** Durée de la fin d'une carte (ms) : brûlée en 1,5 s, gelée puis brisée en 2,2 s. */
  const life = (reduced: boolean) => (reduced ? 500 : theme ? 2200 : 1500);
  let glowCard = { x0: 0, x1: 0, k: 0 };

  const frame = (now: number, dt: number, f: Frame) => {
    if (!grid) return;
    hor = f.hor;
    fireTop = hor - fireH + CELL;
    hotFuel = f.hot;
    const reduced = f.reduced;
    if (f.theme !== theme) {
      // Changer de sol : le feu ou le brouillard en cours s'éteint.
      theme = f.theme;
      fires.length = 0;
      lastFuel = -1e9;
    }

    // Les cartes : elles tombent jusqu'à la lave, puis s'y enfoncent en brûlant.
    for (const b of burns) {
      if (b.done) continue;
      const bottom = b.y + b.h;
      if (reduced) {
        if (b.touch < 0) {
          b.touch = now;
          ignite(b.x, b.x + b.w, now);
        }
      } else if (bottom < hor) {
        b.vy += 2600 * dt;
        b.y += b.vy * dt;
      } else if (theme) {
        // Glace : la carte se pose sur la ligne et glisse, presque sans frottement ; elle rebondit mollement aux bords.
        if (b.touch < 0) {
          b.touch = now;
          ignite(b.x, b.x + b.w, now);
          bursts.trigger(now / 1000, { x: b.x + b.w / 2, y: hor, w: b.w });
          b.vy = 0;
          b.y = hor - b.h + 3;
        }
        b.x += b.vx * dt;
        b.vx *= Math.exp(-dt * 0.45);
        if (b.x < 0 || b.x + b.w > W) {
          b.x = Math.max(0, Math.min(W - b.w, b.x));
          b.vx *= -0.35;
        }
      } else {
        if (b.touch < 0) {
          b.touch = now;
          ignite(b.x, b.x + b.w, now);
          glowCard = { x0: b.x, x1: b.x + b.w, k: 1 };
          bursts.trigger(now / 1000, { x: b.x + b.w / 2, y: hor, w: b.w });
          // La lave est épaisse : elle arrête la chute net, la carte s'y pose avant de s'enfoncer.
          b.vy = Math.min(b.vy, 30);
          b.y = Math.min(b.y, hor - b.h + 6);
        }
        // La lave freine : la carte s'enfonce lentement.
        b.vy += (40 - b.vy) * (1 - Math.exp(-dt * 3));
        b.y += b.vy * dt;
      }
      const p = b.touch < 0 ? 0 : (now - b.touch) / life(reduced);
      if (p > 1.35 || (!theme && b.y > hor + 10)) {
        b.done = true;
        b.tex.destroy();
        b.buf.destroy();
      }
    }
    for (let i = burns.length - 1; i >= 0; i--) if (burns[i]!.done) burns.splice(i, 1);
    for (let i = fires.length - 1; i >= 0; i--) if (now - fires[i]!.t0 > 12000) fires.splice(i, 1);
    glowCard.k *= Math.exp(-dt / 2.5);

    // Le feu : pas fixes, au plus trois par image ; rien à simuler quand tout est éteint depuis longtemps.
    const active = fires.length > 0 || hotFuel.k > 0.55 || now - lastFuel < 9000;
    if (hotFuel.k > 0.55) lastFuel = now;
    if (active && !reduced) {
      simAcc = Math.min(simAcc + dt, STEP * MAX_STEPS);
      while (simAcc >= STEP) {
        simAcc -= STEP;
        simTime += STEP;
        for (let i = 0; i < grid.nx; i++) grid.fuelData[i] = fuelAt((i + 0.5) * CELL, now);
        device.queue.writeBuffer(grid.fuel, 0, grid.fuelData);
        sdata.set([grid.nx, grid.ny, CELL, STEP], 0);
        // Montée 120 px/s, poussée 280 px/s², refroidissement 2,3/s : des flammes de 50 à 90 px, pas des colonnes.
        // Feu : poussée positive. Brouillard froid : poussée négative (l'air froid retombe), il s'étale et s'attarde.
        // Tourbillons : la force vaut ε·h·(N × ω), ω en 1/s ; il faut ε ≈ 8 pour qu'elle pèse face à la poussée.
        const q = theme ? params.froid : params.feu;
        sdata.set([simTime, 3.1, 3, q.montee], 4);
        sdata.set([q.poussee, q.refroid, q.tourb, q.fumee], 8);
        sdata.set([theme ? 1 : 0.95, q.balance, theme ? 0.5 : 0.8, 0], 12);
        device.queue.writeBuffer(simUni, 0, sdata);
        const gx = Math.ceil(grid.nx / 8);
        const gy = Math.ceil(grid.ny / 8);
        // Un encodeur par pas : chaque pas lit ses propres uniformes (écrits juste avant sa soumission).
        const enc = device.createCommandEncoder({ label: "lave:pas" });
        const pass = enc.beginComputePass();
        const run = (p: GPUComputePipeline, g: GPUBindGroup) => {
          pass.setPipeline(p);
          pass.setBindGroup(0, g);
          pass.dispatchWorkgroups(gx, gy);
        };
        run(P.curl, grid.groups.curl);
        run(P.forces, grid.groups.forces);
        run(P.div, grid.groups.div);
        for (let i = 0; i < JACOBI; i++) run(P.jacobi, grid.groups.jac[i & 1]!);
        run(P.project, grid.groups.project);
        run(P.advect, grid.groups.advect);
        pass.end();
        device.queue.submit([enc.finish()]);
      }
    }
    frame2(now, f, device.createCommandEncoder({ label: "lave" }));
  };

  const frame2 = (now: number, f: Frame, enc: GPUCommandEncoder) => {
    if (!grid) return;
    const t = f.reduced ? 12 : now / 1000;
    const burning = fires.reduce((m, e) => Math.max(m, Math.exp(-Math.max(0, now - e.t0 - 1500) / 3000)), 0);
    udata.set([W, H, dpr, t], 0);
    udata.set([hor, fireTop, fireH, f.reduced ? 1 : 0], 4);
    udata.set([f.hot.x0, f.hot.x1, f.hot.k, 0.55 + 1.2 * burning + 0.5 * f.hot.k], 8);
    udata.set([glowCard.x0, glowCard.x1, glowCard.k, theme], 12);
    // La lumière du sol : un fond, plus fort quand ça brûle et quand une carte chauffe au-dessus.
    udata.set([Math.min(MAX_RECTS, f.nrects), theme ? 0.45 : 0.35 + 0.9 * burning + 0.6 * f.hot.k, 0, 0], 16);
    udata.fill(0, 20, 52);
    bursts.live(now / 1000, 1.6).forEach((s, i) => {
      if (i >= 4) return;
      udata.set([s.shot.data.x, s.shot.data.y, s.age, s.k], 20 + i * 4);
      udata.set([s.shot.data.w, s.shot.seed, 0, 0], 36 + i * 4);
    });
    udata.set(f.rects.subarray(0, MAX_RECTS * 4), 52);
    device.queue.writeBuffer(uni, 0, udata);

    const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    const cards = () => {
      for (const b of burns) {
        const p = b.touch < 0 ? 0 : Math.min(1.35, (now - b.touch) / life(f.reduced));
        const heat = b.touch < 0 ? Math.max(0, 1 - (hor - b.y - b.h) / 160) : 1;
        cdata.set([b.x, b.y, b.w, b.h], 0);
        cdata.set([p, heat, b.seed, 1], 4);
        cdata.set([W, H, dpr, 12], 8);
        // Le flou d'obturateur a besoin de place autour de la carte qui bouge vite.
        const shutter = Math.min(80, (Math.abs(b.vy) + Math.abs(b.vx)) / 120);
        cdata.set([theme ? 110 : shutter, theme, 0, 0], 12);
        const since = b.touch < 0 ? 0 : (now - b.touch) / 1000 - 0.78 * (life(f.reduced) / 1000);
        cdata.set([theme ? b.vx : 0, theme ? 0 : b.vy, Math.max(0, since), 0], 16);
        device.queue.writeBuffer(b.buf, 0, cdata);
        pass.setPipeline(cardPipe);
        pass.setBindGroup(0, b.group);
        pass.draw(6);
      }
    };
    // Lave : d'abord les cartes (le sol, dessiné ensuite, couvre ce qui s'est enfoncé ; le feu passe devant).
    // Glace : après (la carte est posée sur la glace, ses éclats y glissent).
    if (!theme) cards();
    const horPx = Math.round(Math.max(0, Math.min(H, hor - 1)) * dpr);
    const cw = canvas.width;
    const ch = canvas.height;
    if (horPx > 0) {
      pass.setScissorRect(0, 0, cw, Math.min(ch, horPx));
      pass.setPipeline(skyPipe);
      pass.setBindGroup(0, grid.skyGroup);
      pass.draw(3);
    }
    if (horPx < ch) {
      pass.setScissorRect(0, horPx, cw, ch - horPx);
      pass.setPipeline(lavaPipe);
      pass.setBindGroup(0, grid.lavaGroup);
      pass.draw(3);
    }
    if (theme) {
      pass.setScissorRect(0, 0, cw, ch);
      cards();
    }
    pass.end();
    device.queue.submit([enc.finish()]);
  };

  return {
    params,
    resize,
    frame,
    addBurn,
    /** Le brouillard ou le feu s'arrête (changement de sol). */
    clear() {
      fires.length = 0;
    },
    get burning() {
      return burns.length > 0 || fires.some((e) => performance.now() - e.t0 < 6000);
    },
    destroy() {
      if (grid) for (const t of [...grid.S, ...grid.R]) t.destroy();
      for (const b of burns) b.tex.destroy();
    },
  };
}
export type Lava = Awaited<ReturnType<typeof createLava>>;
