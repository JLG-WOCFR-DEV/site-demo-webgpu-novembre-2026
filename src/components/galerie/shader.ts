/**
 * Galerie — un seul pipeline, des instances. Chaque image est un quad posé en
 * 3D (matrice de rotation et position calculées sur le CPU, mêmes calculs que
 * le test de clic), projeté avec la perspective CSS : un point à la
 * profondeur z est grossi de P / (P − z). w = P − z donne la correction de
 * perspective des UV.
 *
 * Les instances [0, n) sont les ombres, [n, 2n) les images : une ombre douce
 * par image, dessinée avant, triée de l'arrière vers l'avant comme les images.
 */
export const MAX_ITEMS = 512;
/** Floats par instance : 6 vec4. */
export const STRIDE = 24;

export const GALERIE = /* wgsl */ `
struct U {
  res: vec4f,   // largeur, hauteur (px css), dpr, perspective (px)
  misc: vec4f,  // nombre d'images, fil de fer, temps, ombre (0..1)
};
struct Item {
  r0: vec4f,    // ligne 0 de la rotation, x
  r1: vec4f,    // ligne 1, y
  r2: vec4f,    // ligne 2, z
  size: vec4f,  // largeur, hauteur, rayon des coins, couche
  uv: vec4f,    // fenêtre de lecture (recadrage « cover »)
  fx: vec4f,    // opacité, teinte, décalage des couleurs (px), surbrillance
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> items: array<Item>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var photos: texture_2d_array<f32>;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) local: vec2f,      // px, depuis le coin haut gauche du quad (marge comprise)
  @location(1) @interpolate(flat) i: u32,
  @location(2) @interpolate(flat) shadow: u32,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VsOut {
  let n = u32(u.misc.x);
  let shadow = select(0u, 1u, ii < n);
  let i = select(ii - n, ii, ii < n);
  let it = items[i];
  let c = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u));
  // L'ombre déborde de son image pour son flou.
  let pad = select(0.0, 24.0, shadow == 1u);
  let sz = it.size.xy + 2.0 * pad;
  var p = (c - 0.5) * sz;
  var o = vec3f(it.r0.w, it.r1.w, it.r2.w);
  if (shadow == 1u) {
    // Ombre : un peu plus bas, un peu derrière.
    o += vec3f(0.0, 14.0, -6.0);
  }
  let world = vec3f(dot(it.r0.xyz, vec3f(p, 0.0)), dot(it.r1.xyz, vec3f(p, 0.0)), dot(it.r2.xyz, vec3f(p, 0.0))) + o;
  let P = u.res.w;
  let w = max(P - world.z, 1.0);
  var out: VsOut;
  out.clip = vec4f(world.x * P * 2.0 / u.res.x, -world.y * P * 2.0 / u.res.y, 0.5 * w, w);
  out.local = c * sz - pad;
  out.i = i;
  out.shadow = shadow;
  return out;
}

fn sd_round_box(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

@fragment
fn fs(in: VsOut, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  let it = items[in.i];
  let half = it.size.xy * 0.5;
  let d = sd_round_box(in.local - half, half, min(it.size.z, min(half.x, half.y)));
  let aa = max(fwidth(d), 1e-3);
  // Lecture de la photo : toujours, pour rester en flux de contrôle uniforme
  // (textureSample calcule son niveau de mipmap sur les dérivées).
  let t = clamp(in.local / max(it.size.xy, vec2f(1.0)), vec2f(0.0), vec2f(1.0));
  let uv = mix(it.uv.xy, it.uv.zw, t);
  let du = vec2f(it.fx.z / max(it.size.x, 1.0) * (it.uv.z - it.uv.x), 0.0);
  let layer = i32(it.size.w);
  let g = textureSample(photos, samp, uv, layer);
  let r = textureSample(photos, samp, uv + du, layer).r;
  let b = textureSample(photos, samp, uv - du, layer).b;
  // Dérivées aussi avant tout branchement sur une donnée d'instance.
  let e = min(min(t.x, 1.0 - t.x) * it.size.x, min(t.y, 1.0 - t.y) * it.size.y);
  let fe = max(fwidth(e), 1e-3);

  if (in.shadow == 1u) {
    let a = (1.0 - smoothstep(-18.0, 22.0, d)) * 0.22 * u.misc.w * it.fx.x * it.fx.x;
    return vec4f(0.0, 0.0, 0.0, a);
  }
  if (u.misc.y > 0.5) {
    // Fil de fer : le contour du quad et sa diagonale.
    let dg = abs(t.x + t.y - 1.0) / length(1.0 / max(it.size.xy, vec2f(1.0))) * 0.7071;
    let l = max(1.0 - smoothstep(0.5, 1.4, e / fe * 0.7), (1.0 - smoothstep(0.4, 1.2, dg)) * 0.5) * it.fx.x;
    let col = select(vec3f(0.78, 0.2, 0.11), vec3f(0.07), front);
    return vec4f(col * l, l);
  }
  var col = vec3f(r, g.g, b);
  // Le dos d'une image (tonneau, hélice) : assombri.
  let shade = it.fx.y * select(0.42, 1.0, front);
  col *= shade;
  // Surbrillance (survol, image de tête) : un liseré clair.
  let rim = (1.0 - smoothstep(0.0, 2.0 * aa + 1.5, -d)) * it.fx.w;
  col = mix(col, vec3f(1.0), rim * 0.85);
  let a = (1.0 - smoothstep(-aa, aa, d)) * it.fx.x;
  return vec4f(col * a, a);
}
`;

/**
 * Fond dégradé (d'après le Gradient Carousel de React Bits) : trois taches
 * floues aux couleurs dominantes de l'image de tête, qui dérivent lentement.
 * Les couleurs sont préparées à la construction (tools/images.py) et fondues
 * sur le CPU pendant le défilement ; le flou est analytique (gaussiennes), pas
 * un filtre CSS sur un calque : il ne coûte qu'une passe plein écran.
 */
export const BACKDROP = /* wgsl */ `
struct B {
  res: vec4f,   // largeur, hauteur, temps, intensité
  look: vec4f,  // taille (0..1), flou (px), mouvement, 0
  c0: vec4f,
  c1: vec4f,
  c2: vec4f,
};
@group(0) @binding(0) var<uniform> b: B;

struct VsOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VsOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VsOut;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let aspect = b.res.x / max(b.res.y, 1.0);
  let q = vec2f((in.uv.x - 0.5) * aspect, in.uv.y - 0.5);
  let t = b.res.z * b.look.z;
  let cols = array<vec3f, 3>(b.c0.rgb, b.c1.rgb, b.c2.rgb);
  // Le flou élargit les taches : plus de flou, des bords plus doux.
  let r = max(0.08, b.look.x) * (0.55 + b.look.y / 96.0);
  var acc = vec3f(0.0);
  var wsum = 0.0;
  for (var i = 0; i < 3; i++) {
    let fi = f32(i);
    let c = vec2f(cos(t * 0.13 + fi * 2.1) * 0.32 * aspect, sin(t * 0.11 + fi * 2.4) * 0.26);
    let d = q - c;
    let w = exp(-dot(d, d) / (r * r));
    acc += cols[i] * w;
    wsum += w;
  }
  let col = acc / max(wsum, 1e-4);
  let a = clamp(wsum, 0.0, 1.0) * b.res.w;
  return vec4f(col * a, a);
}
`;
