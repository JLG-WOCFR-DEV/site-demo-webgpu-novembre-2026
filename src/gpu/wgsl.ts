/**
 * Tous les shaders de PLI. Une seule convention : le moteur travaille en
 * pixels CSS relatifs au viewport ; la conversion en pixels physiques
 * (× dpr) et en NDC se fait dans les vertex shaders.
 *
 * Les couleurs restent encodées sRGB (comme en CSS) : le papier vaut la même
 * valeur ici que dans la feuille de style. La cible de scène est en
 * rgba16float pour que les hautes lumières des photos puissent dépasser 1.
 */
import { CUI_WGSL, MAX_RIPPLES } from "./cui.ts";

export const FRAME_STRUCT = /* wgsl */ `
struct Frame {
  viewport: vec4f, // cssW, cssH, dpr, time
  pointer: vec4f,  // x, y (css), inside, reduced
  glyph: vec4f,    // wave, ink, scatter, glyphBoxes
  misc: vec4f,     // atlasSize, hdr, paperLum, fil de fer (0/1)
  motion: vec4f,   // vitesse de défilement (−1…1), inertie des plaques (0…), intensité du mouvement (0,4 sobre … 1,6), 0
};

// Débogage, fil de fer : chaque plan n'est plus que ses arêtes et la diagonale
// de ses deux triangles, à l'encre. Ce qui part vraiment vers le GPU.
const WIRE_INK: vec3f = vec3f(0.09, 0.09, 0.1);
fn wire_on(f: Frame) -> bool { return f.misc.w > 0.5; }
fn quad_wire(local: vec2f, size: vec2f) -> f32 {
  let pxw = 1.0 / max(size, vec2f(1.0));
  let e = min(min(local.x, 1.0 - local.x) / pxw.x, min(local.y, 1.0 - local.y) / pxw.y);
  let diag = abs(local.x + local.y - 1.0) / length(pxw) * 0.7071;
  return max(1.0 - smoothstep(0.5, 1.4, e), (1.0 - smoothstep(0.4, 1.2, diag)) * 0.45);
}

fn to_clip(p: vec2f, f: Frame) -> vec4f {
  let ndc = vec2f(p.x / f.viewport.x * 2.0 - 1.0, 1.0 - p.y / f.viewport.y * 2.0);
  return vec4f(ndc, 0.0, 1.0);
}

fn corner(vi: u32) -> vec2f {
  // Ordre triangle-strip : (0,0) (1,0) (0,1) (1,1).
  return vec2f(f32(vi & 1u), f32(vi >> 1u));
}

fn hash11(n: f32) -> f32 {
  return fract(sin(n * 127.1) * 43758.5453);
}

fn sd_round_box(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}
`;

/* ───────────────────────── Plans image ───────────────────────── */

export const PLANE = /* wgsl */ `
${FRAME_STRUCT}

struct Plane {
  rect: vec4f,    // x, y, w, h (css)
  uv: vec4f,      // u0, v0, u1, v1 (recadrage object-fit: cover)
  params: vec4f,  // radius, shadow, lift, alpha
  flags: vec4f,   // wire, mono (1 atlas, 2 négatif), hover, hdr
  peel: vec4f,    // décollement 0…1, 0, 0, 0
  fx: vec4f,      // survol (0 aucun, 1 deplacement, 2 rvb, 3 onde, 4 pixels), révélation (1 rideau, 2 dissolution, 3 pixels, 4 tri), progression 0…1, graine
};

/* D4 — survols et révélations d'une image (data-gl-hover, data-gl-reveal).
   Tout se joue sur la coordonnée de lecture de la photo et sur sa couverture ;
   le plan, ses coins et son ombre ne changent pas. */
fn fx_hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn fx_noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fx_hash(i), fx_hash(i + vec2f(1.0, 0.0)), u.x), mix(fx_hash(i + vec2f(0.0, 1.0)), fx_hash(i + vec2f(1.0, 1.0)), u.x), u.y);
}
/** La lecture de la photo, déformée par le survol et la révélation ; .z : couverture (0 … 1). */
fn fx_uv(local0: vec2f, size: vec2f, ptr: vec2f, hov: f32, t: f32) -> vec3f {
  let fx = plane.fx;
  var local = local0;
  var cover = 1.0;
  let hm = u32(fx.x + 0.5);
  if (hm > 0u && hov > 0.001 && frame.pointer.w < 0.5) {
    let d = (local - ptr) * size;
    let l = length(d);
    if (hm == 1u) {
      // Déplacement : la photo se bombe sous le pointeur, comme une goutte posée dessus.
      let fall = exp(-l * l / (2.0 * 110.0 * 110.0));
      local -= (local - ptr) * fall * 0.22 * hov;
    } else if (hm == 3u) {
      // Onde : des anneaux partent du pointeur et s'amortissent.
      let w = sin(l * 0.075 - t * 7.0) * exp(-l * 0.008);
      local += (d / max(l, 1.0)) * w * 9.0 / size * hov;
    } else if (hm == 4u) {
      // Pixels : la photo se pixélise loin du pointeur, nette sous lui.
      let fall = exp(-l * l / (2.0 * 140.0 * 140.0));
      let b = mix(1.0, 22.0, hov * (1.0 - fall));
      local = (floor(local * size / b) + 0.5) * b / size;
    }
  }
  let rm = u32(fx.y + 0.5);
  let p = fx.z;
  if (rm > 0u && p < 0.999) {
    let e = 1.0 - pow(1.0 - p, 3.0);
    if (rm == 1u) {
      // Rideau : il monte du bas, la photo glisse dessous et se pose (un léger zoom qui retombe).
      let front = 1.0 - e * 1.08 + 0.04;
      cover = smoothstep(front - 0.02, front + 0.02, local.y);
      local = 0.5 + (local - 0.5) / (1.0 + 0.18 * (1.0 - e));
    } else if (rm == 2u) {
      // Dissolution : la photo apparaît par taches, d'un bruit à deux échelles.
      let n = fx_noise(local * size / 46.0 + fx.w * 13.0) * 0.7 + fx_hash(floor(local * size / 3.0)) * 0.3;
      cover = smoothstep(n - 0.06, n + 0.06, e * 1.15 - 0.05);
    } else if (rm == 3u) {
      // Pixels : de gros pavés qui s'affinent jusqu'au pixel.
      let b = max(1.0, mix(64.0, 1.0, e));
      local = (floor(local * size / b) + 0.5) * b / size;
      cover = smoothstep(0.0, 0.18, p);
    } else if (rm == 4u) {
      // Tri : chaque colonne coule en traînée, puis se range.
      let col = floor(local.x * size.x / 4.0);
      let lag = fx_hash(vec2f(col, fx.w * 31.0));
      let k = clamp((e - lag * 0.45) / 0.55, 0.0, 1.0);
      local.y = local.y * k + (1.0 - k) * min(local.y, 0.02 + lag * 0.4) * 0.6;
      cover = smoothstep(0.0, 0.25, k + 0.05);
    }
  }
  return vec3f(local, cover);
}

@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var<uniform> plane: Plane;
@group(2) @binding(0) var samp: sampler;
@group(2) @binding(1) var tex: texture_2d<f32>;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) px: vec2f,
  @location(1) local: vec2f,
};

fn lifted_rect() -> vec4f {
  // L'élévation remonte le plan et l'agrandit d'un souffle.
  let lift = plane.params.z * (0.6 + 0.4 * plane.flags.z);
  let grow = 1.0 + 0.012 * lift;
  let c = plane.rect.xy + plane.rect.zw * 0.5 - vec2f(0.0, 6.0 * lift);
  let s = plane.rect.zw * grow;
  return vec4f(c - s * 0.5, s);
}

@vertex
fn vs_shadow(@builtin(vertex_index) vi: u32) -> VsOut {
  let r = lifted_rect();
  let spread = 10.0 + 40.0 * plane.params.y + 30.0 * plane.params.z;
  let off = vec2f(0.0, 4.0 + 18.0 * plane.params.z);
  let o = r.xy - vec2f(spread) + off;
  let s = r.zw + vec2f(spread * 2.0);
  let c = corner(vi);
  var out: VsOut;
  out.px = o + c * s;
  out.local = c;
  out.clip = to_clip(out.px, frame);
  return out;
}

@fragment
fn fs_shadow(in: VsOut) -> @location(0) vec4f {
  if (wire_on(frame)) { return vec4f(0.0); }
  let r = lifted_rect();
  let off = vec2f(0.0, 4.0 + 18.0 * plane.params.z);
  let half = r.zw * 0.5;
  let d = sd_round_box(in.px - (r.xy + half + off), half, min(plane.params.x, min(half.x, half.y)));
  let spread = 10.0 + 40.0 * plane.params.y + 30.0 * plane.params.z;
  let a = (1.0 - smoothstep(-spread * 0.35, spread, d)) * (0.10 + 0.22 * plane.params.y) * plane.params.w;
  // Ombre teintée encre chaude, jamais noire pure.
  return vec4f(vec3f(0.11, 0.09, 0.08) * a, a);
}

@vertex
fn vs_plane(@builtin(vertex_index) vi: u32) -> VsOut {
  let r = lifted_rect();
  let c = corner(vi);
  var out: VsOut;
  out.px = r.xy + c * r.zw;
  out.local = c;
  // Inertie (à la Aristide Benoist) : au défilement, la plaque se cisaille
  // et s'étire dans le sens de la course, puis se redresse. Seule la position
  // à l'écran bouge : les coins arrondis restent calculés sur le rectangle.
  var p = out.px;
  let sk = frame.motion.x * frame.motion.y;
  p.y += (c.x - 0.5) * r.z * sk * 0.12;
  p.y += (c.y - 0.5) * r.w * abs(sk) * 0.08;
  out.clip = to_clip(p, frame);
  return out;
}

@fragment
fn fs_plane(in: VsOut) -> @location(0) vec4f {
  let r = lifted_rect();
  let half = r.zw * 0.5;
  let rad = min(plane.params.x, min(half.x, half.y));
  let d = sd_round_box(in.px - (r.xy + half), half, rad);
  let aa = max(fwidth(d), 0.5);
  let fill = 1.0 - smoothstep(-aa, aa, d);
  // D4 : la lecture de la photo (survol, révélation). Dérivées prises sur la coordonnée lisse : pas de couture de mip.
  let ptr = (frame.pointer.xy - r.xy) / max(r.zw, vec2f(1.0));
  let fxr = fx_uv(in.local, r.zw, ptr, plane.flags.z, frame.viewport.w);
  let uv0 = mix(plane.uv.xy, plane.uv.zw, in.local);
  let uv = mix(plane.uv.xy, plane.uv.zw, fxr.xy);
  var col = textureSampleGrad(tex, samp, uv, dpdx(uv0), dpdy(uv0)).rgb;
  if (u32(plane.fx.x + 0.5) == 2u && plane.flags.z > 0.001) {
    // RVB : les trois couches se séparent dans l'axe du pointeur.
    let dir = normalize((in.local - ptr) * r.zw + vec2f(1e-3)) * 4.5 * plane.flags.z / r.zw * (plane.uv.zw - plane.uv.xy);
    col = vec3f(textureSampleGrad(tex, samp, uv + dir, dpdx(uv0), dpdy(uv0)).r, col.g, textureSampleGrad(tex, samp, uv - dir, dpdx(uv0), dpdy(uv0)).b);
  }
  if (wire_on(frame)) {
    let l = quad_wire(in.local, r.zw) * plane.params.w;
    return vec4f(WIRE_INK * l, l);
  }

  if (plane.flags.y > 1.5) {
    // Plaque offset sous l'épreuve : l'image en négatif, sur aluminium.
    let l = dot(col, vec3f(0.299, 0.587, 0.114));
    col = mix(vec3f(0.80, 0.82, 0.84), vec3f(0.16, 0.22, 0.30), l);
  } else if (plane.flags.y > 0.5) {
    // Atlas de champs de distance : le champ lui-même, en dégradé avec ses
    // courbes de niveau, et le contour tracé en rouge.
    let v = textureSample(tex, samp, uv).r;
    col = mix(vec3f(0.937, 0.933, 0.910), vec3f(0.36, 0.52, 0.66), clamp(v * 1.6, 0.0, 1.0));
    let lv = fract(v * 8.0);
    let iso = 1.0 - smoothstep(0.0, max(fwidth(v * 8.0) * 1.2, 1e-3), min(lv, 1.0 - lv));
    col = mix(col, col * 0.72, iso * step(0.02, v));
    // TinySDF (cutoff 0,25) place le contour exact à 0,75 : dedans, l'encre.
    col = mix(col, vec3f(0.08), smoothstep(0.75, 0.75 + max(fwidth(v), 1e-3), v) * 0.85);
    let edge = 1.0 - smoothstep(0.0, max(fwidth(v) * 1.5, 1e-3), abs(v - 0.75));
    col = mix(col, vec3f(0.85, 0.12, 0.1), edge);
  } else {
    // Expansion des hautes lumières : un JPEG plafonne à 1.0, le papier est
    // à 0,94. On rend aux reflets la marge que la compression leur a prise.
    let lum = max(col.r, max(col.g, col.b));
    let k = smoothstep(0.93, 1.0, lum);
    col = col * (1.0 + k * k * plane.flags.w);
  }

  if (plane.flags.x > 0.5) {
    // Les deux triangles du strip : bords et diagonale (1,0)→(0,1).
    let pxw = 1.0 / max(r.zw, vec2f(1.0));
    let e = min(min(in.local.x, 1.0 - in.local.x) / pxw.x, min(in.local.y, 1.0 - in.local.y) / pxw.y);
    let diag = abs(in.local.x + in.local.y - 1.0) / length(pxw) * 0.7071;
    let line = 1.0 - smoothstep(0.6, 1.6, min(e, diag));
    col = mix(col, vec3f(0.894, 0.0, 0.486), line);
    // Les quatre sommets.
    var cs = array<vec2f, 4>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0), vec2f(1.0, 1.0));
    for (var i = 0; i < 4; i++) {
      let dv = length((in.local - cs[i]) * r.zw);
      col = mix(col, vec3f(0.894, 0.0, 0.486), 1.0 - smoothstep(5.0, 6.5, dv));
    }
    return vec4f(col, 1.0) * select(fill, 1.0, line > 0.01) * plane.params.w;
  }

  let a = fill * plane.params.w * fxr.z;
  return vec4f(col * a, a);
}
`;

/* ───────────────────────── Épreuve qui se décolle ───────────────────────── */

// Même module que les plans (mêmes liaisons), d'autres points d'entrée. Un
// quad ne peut pas se courber : on tisse une grille de PEEL_X × PEEL_Y
// cellules, générée elle aussi depuis vertex_index, et on enroule la partie
// proche du coin autour d'un cylindre dont l'axe est la ligne de pli.
export const PEEL_X = 40;
export const PEEL_Y = 28;

export const PEEL = /* wgsl */ `
struct PeelOut {
  @builtin(position) clip: vec4f,
  @location(0) local: vec2f,
  @location(1) theta: f32,
  @location(2) z: f32,
  @location(3) s: f32,
};

const PX: u32 = ${PEEL_X}u;
const PY: u32 = ${PEEL_Y}u;

fn peel_frame() -> mat2x2f {
  // Direction du coin bas-droit vers l'intérieur de l'épreuve.
  let d = normalize(vec2f(-1.0, -0.8));
  return mat2x2f(d, vec2f(-d.y, d.x));
}

// La partie plate est dessinée sur la grille non déformée : la ligne de pli
// y reste droite, au lieu de suivre les arêtes des triangles.
@vertex
fn vs_peel_flat(@builtin(vertex_index) vi: u32) -> PeelOut {
  var out = peel_vertex(vi);
  let r = lifted_rect();
  out.clip = to_clip(r.xy + out.local * r.zw, frame);
  return out;
}

@vertex
fn vs_peel(@builtin(vertex_index) vi: u32) -> PeelOut {
  return peel_vertex(vi);
}

fn peel_vertex(vi: u32) -> PeelOut {
  let cell = vi / 6u;
  let k = vi % 6u;
  var corner_ = array<vec2u, 6>(vec2u(0u, 0u), vec2u(1u, 0u), vec2u(0u, 1u), vec2u(1u, 0u), vec2u(1u, 1u), vec2u(0u, 1u));
  let g = vec2u(cell % PX, cell / PX) + corner_[k];
  let local = vec2f(g) / vec2f(f32(PX), f32(PY));
  let r = lifted_rect();
  let p = r.xy + local * r.zw;

  let amount = plane.peel.x;
  let d = peel_frame()[0];
  let cornerPt = r.xy + r.zw;
  let diag = length(r.zw);
  let s = dot(p - cornerPt, d);           // distance au coin le long du pli
  let fold = amount * diag * 0.62;        // position de la ligne de pli
  let radius = max(18.0, diag * (0.035 + 0.05 * amount));
  var sp = s;
  var z = 0.0;
  var theta = 0.0;
  if (s < fold) {
    theta = (fold - s) / radius;
    if (theta <= 3.14159) {
      sp = fold - radius * sin(theta);
      z = radius * (1.0 - cos(theta));
    } else {
      sp = fold + (theta - 3.14159) * radius;
      z = 2.0 * radius;
    }
  }
  let q = p + d * (sp - s);
  var out: PeelOut;
  out.clip = to_clip(q, frame);
  out.local = local;
  out.theta = theta;
  out.z = z / radius;
  out.s = (s - fold) / radius;
  return out;
}

fn peel_front(in: PeelOut) -> vec3f {
  let uv = mix(plane.uv.xy, plane.uv.zw, in.local);
  return textureSample(tex, samp, uv).rgb;
}

// Partie restée à plat : l'image, et l'ombre portée du rabat juste après le pli.
fn peel_wire(in: PeelOut) -> f32 {
  let g = in.local * vec2f(f32(PX), f32(PY));
  let fw = max(fwidth(g), vec2f(1e-4));
  let f = abs(fract(g - 0.5) - 0.5) / fw;
  let c = fract(g);
  let diag = abs(c.x + c.y - 1.0) / max(fw.x + fw.y, 1e-4);
  return max(1.0 - smoothstep(0.4, 1.2, min(f.x, f.y)), (1.0 - smoothstep(0.4, 1.2, diag)) * 0.35);
}

@fragment
fn fs_peel_flat(in: PeelOut) -> @location(0) vec4f {
  let col = peel_front(in);
  let wl = peel_wire(in);
  if (in.s < 0.0) { discard; }
  if (wire_on(frame)) { return vec4f(WIRE_INK * wl, wl) * plane.params.w; }
  let shade = 1.0 - 0.35 * exp(-in.s * 1.6) * step(0.0, in.s) * step(0.001, plane.peel.x);
  let a = plane.params.w;
  return vec4f(col * shade * a, a);
}

// Partie enroulée : l'image s'assombrit en tournant, puis le verso du papier
// apparaît passé le quart de tour.
@fragment
fn fs_peel_curl(in: PeelOut) -> @location(0) vec4f {
  let col = peel_front(in);
  let wl = peel_wire(in);
  if (in.s >= 0.0) { discard; }
  if (wire_on(frame)) { return vec4f(vec3f(0.85, 0.12, 0.1) * wl, wl) * plane.params.w; }
  let back = in.theta > 1.5708;
  let light = 0.62 + 0.38 * abs(cos(in.theta));
  let paperBack = vec3f(0.93, 0.92, 0.89) * (0.78 + 0.22 * clamp(in.z * 0.5, 0.0, 1.0));
  let c = select(col * light, paperBack, back);
  let a = plane.params.w;
  return vec4f(c * a, a);
}
`;

/* ───────────────────────── Calques et modes de fusion ───────────────────────── */

export const LAYERS = /* wgsl */ `
${FRAME_STRUCT}

struct Layer {
  uv: vec4f,      // recadrage cover de la source
  params: vec4f,  // mode, opacité, source (0 photo A, 1 photo B, 2 aplat), visible
};

struct LayersU {
  rect: vec4f,    // plaque (css)
  mask: vec4f,    // type (0 aucun, 1 cercle au pointeur, 2 dégradé), cx, cy (0…1), 0
  spot: vec4f,    // couleur de l'aplat
  layers: array<Layer, 3>,  // du dessous vers le dessus
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var<uniform> L: LayersU;
@group(1) @binding(1) var samp: sampler;
@group(1) @binding(2) var texA: texture_2d<f32>;
@group(1) @binding(3) var texB: texture_2d<f32>;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) local: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  let c = corner(vi);
  var out: VsOut;
  out.clip = to_clip(L.rect.xy + c * L.rect.zw, frame);
  out.local = c;
  return out;
}

// Les formules des modes de fusion, telles que les définit la norme
// Compositing and Blending : b est le fond, s le calque posé dessus.
fn blend(b: vec3f, s: vec3f, mode: f32) -> vec3f {
  if (mode < 0.5) { return s; }                                   // normal
  if (mode < 1.5) { return b * s; }                               // produit
  if (mode < 2.5) { return 1.0 - (1.0 - b) * (1.0 - s); }         // écran
  if (mode < 3.5) {                                               // superposition
    return select(1.0 - 2.0 * (1.0 - b) * (1.0 - s), 2.0 * b * s, b <= vec3f(0.5));
  }
  if (mode < 4.5) {                                               // lumière tamisée
    let d = select(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, b <= vec3f(0.25));
    return select(b + (2.0 * s - 1.0) * (d - b), b - (1.0 - 2.0 * s) * b * (1.0 - b), s <= vec3f(0.5));
  }
  return abs(b - s);                                              // différence
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  // Les deux photos sont lues sans condition (contrôle uniforme).
  var samples: array<vec3f, 3>;
  for (var i = 0; i < 3; i++) {
    let l = L.layers[i];
    let uv = mix(l.uv.xy, l.uv.zw, in.local);
    let a = textureSample(texA, samp, uv).rgb;
    let b = textureSample(texB, samp, uv).rgb;
    samples[i] = select(select(a, b, l.params.z > 0.5), L.spot.rgb, l.params.z > 1.5);
  }
  var col = vec3f(0.937, 0.933, 0.910);
  for (var i = 0; i < 3; i++) {
    let l = L.layers[i];
    if (l.params.w < 0.5) { continue; }
    var m = 1.0;
    if (i == 2 && L.mask.x > 0.5) {
      if (L.mask.x < 1.5) {
        let d = length((in.local - L.mask.yz) * vec2f(L.rect.z / L.rect.w, 1.0));
        m = 1.0 - smoothstep(0.22, 0.30, d);
      } else {
        m = smoothstep(0.1, 0.9, in.local.x);
      }
    }
    col = mix(col, clamp(blend(col, samples[i], l.params.x), vec3f(0.0), vec3f(1.0)), l.params.y * m);
  }
  return vec4f(col, 1.0);
}
`;

/* ───────────────────────── Glyphes ───────────────────────── */

export const GLYPH = /* wgsl */ `
${FRAME_STRUCT}

struct Glyph {
  pos: vec2f,    // coin haut-gauche du quad, relatif à l'élément (css)
  size: vec2f,   // taille du quad (css)
  uv: vec4f,     // rectangle d'atlas, normalisé
  color: u32,    // RGBA8
  elem: u32,
  idx: f32,      // rang du glyphe dans l'élément
  px: f32,       // pixels CSS par pixel d'atlas
  src: vec2f,    // morphing : d'où part la lettre (css, relatif à sa place)
  mk: f32,       // 0 fixe, 1 voyage, 2 apparaît, 3 s'efface
  md: f32,       // retard dans le morphing (0…1)
};

struct Elem {
  origin: vec2f,
  reveal: f32,
  fx: f32,       // 0 texte courant, 1 ouverture, 2 spécimen
  count: f32,
  alpha: f32,
  morph: f32,    // progression du morphing de l'élément (0…1)
  _p: f32,
};

// État physique d'une lettre de l'ouverture, écrit par la passe de calcul.
struct Body {
  off: vec2f,
  vel: vec2f,
  ang: f32,
  avel: f32,
  delay: f32,
  _p: f32,
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var<storage, read> glyphs: array<Glyph>;
@group(1) @binding(1) var<storage, read> elems: array<Elem>;
@group(1) @binding(2) var samp: sampler;
@group(1) @binding(3) var atlas: texture_2d<f32>;
@group(1) @binding(4) var<storage, read> bodies: array<Body>;
@group(1) @binding(5) var msdf: texture_2d<f32>;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) local: vec2f,
  @location(3) @interpolate(flat) edge: f32,
  @location(4) @interpolate(flat) size: vec2f,
  @location(5) @interpolate(flat) multi: f32,
};

fn rot(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, s, -s, c);
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VsOut {
  let g = glyphs[ii];
  let e = elems[g.elem];
  let c = corner(vi);
  let t = frame.viewport.w;
  let reduced = frame.pointer.w > 0.5;

  var center = e.origin + g.pos + g.size * 0.5;
  var local = (c - 0.5) * g.size;
  var reveal = e.reveal;

  if (e.fx > 0.5 && e.fx < 1.5) {
    // Ouverture : chaque lettre est un caractère mobile simulé par la passe
    // de calcul (ressort, inertie, pointeur, défilement). Ici on ne fait que
    // lire son décalage et sa rotation.
    let stagger = 0.35;
    reveal = clamp(e.reveal * (1.0 + stagger) - stagger * g.idx / max(e.count, 1.0), 0.0, 1.0);
    if (!reduced) {
      let b = bodies[u32(g.idx)];
      center += b.off;
      local = rot(b.ang) * local;
    }
  }

  if (e.fx > 1.5) {
    // Spécimen : réglages du chapitre 03.
    let h = hash11(g.idx + 1.7);
    let wave = frame.glyph.x;
    let phase = select(t * 2.2, 0.0, reduced);
    center.y += sin(g.idx * 0.55 + phase) * wave * g.size.y * 0.16;
    let sc = frame.glyph.z;
    center += vec2f(h - 0.5, hash11(g.idx * 3.1) - 0.5) * sc * vec2f(140.0, 90.0);
    local = rot((h - 0.5) * sc * 1.4) * local;
  }

  if (g.mk > 0.5) {
    // Morphing (à la manière d'Aristide Benoist) : les lettres communes aux
    // deux textes voyagent en arc vers leur nouvelle place, les autres
    // naissent ou s'effacent à l'encre.
    let q = clamp((e.morph - g.md) / 0.55, 0.0, 1.0);
    let k = q * q * (3.0 - 2.0 * q);
    if (g.mk < 1.5) {
      center += g.src * (1.0 - k);
      center.y -= sin(3.14159 * k) * g.size.y * (0.18 + 0.25 * hash11(g.idx + 4.2)) * select(1.0, -1.0, g.src.x < 0.0) * frame.motion.z;
      local = rot(sin(3.14159 * k) * (hash11(g.idx * 1.3) - 0.5) * 0.5 * frame.motion.z) * local;
    } else if (g.mk < 2.5) {
      reveal = min(reveal, k);
      local *= 0.75 + 0.25 * k;
      center.y += (1.0 - k) * g.size.y * 0.2;
    } else {
      reveal = min(reveal, 1.0 - k);
      center.y -= k * g.size.y * 0.25;
    }
  }

  var out: VsOut;
  out.clip = to_clip(center + local, frame);
  out.uv = mix(g.uv.xy, g.uv.zw, c);
  out.color = unpack4x8unorm(g.color) * e.alpha;
  out.local = c;
  // Seuil de bord du champ de distance : 0,75 = contour exact de TinySDF.
  // Au-dessus, la lettre maigrit ; à 1,4 elle a disparu (apparition à l'encre).
  var ink = 0.0;
  if (e.fx > 1.5) { ink = frame.glyph.y; }
  out.edge = 0.75 - ink * 0.14 + (1.0 - reveal) * 0.65;
  out.size = g.size;
  out.multi = select(0.0, 1.0, g.px < 0.0);
  return out;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  // Les deux atlas sont lus sans condition (contrôle uniforme pour les
  // dérivées), puis on garde le bon. MTSDF : médiane des trois canaux, bord
  // à 0,5 ; ses angles restent vifs à toutes les tailles.
  let single = textureSample(atlas, samp, in.uv).r;
  let m = textureSample(msdf, samp, in.uv).rgb;
  let med = max(min(m.r, m.g), min(max(m.r, m.g), m.b));
  let isMulti = in.multi > 0.5;
  let d = select(single, med, isMulti);
  let edge = select(in.edge, 0.5 + (in.edge - 0.75) * 0.85, isMulti);
  let w = max(fwidth(d) * 0.75, 0.002);
  var a = smoothstep(edge - w, edge + w, d) * in.color.a;
  var col = in.color.rgb;
  if (wire_on(frame)) {
    let pxw = 1.0 / max(in.size, vec2f(1.0));
    let e = min(min(in.local.x, 1.0 - in.local.x) / pxw.x, min(in.local.y, 1.0 - in.local.y) / pxw.y);
    let l = (1.0 - smoothstep(0.4, 1.2, e)) * in.color.a;
    return vec4f(WIRE_INK * l, l);
  }

  if (frame.glyph.w > 0.5) {
    // Boîtes des quads : chaque lettre est un rectangle de l'atlas.
    let pxw = 1.0 / max(in.size, vec2f(1.0));
    let e = min(min(in.local.x, 1.0 - in.local.x) / pxw.x, min(in.local.y, 1.0 - in.local.y) / pxw.y);
    let line = (1.0 - smoothstep(0.4, 1.2, e)) * 0.85;
    col = mix(col, vec3f(0.0, 0.627, 0.863), line * (1.0 - a));
    a = max(a, line);
  }
  return vec4f(col * a, a);
}
`;

/* ───────────────────────── Calcul : caractères mobiles ───────────────────────── */

export const SIM = /* wgsl */ `
struct Glyph {
  pos: vec2f,
  size: vec2f,
  uv: vec4f,
  color: u32,
  elem: u32,
  idx: f32,
  px: f32,
  src: vec2f,
  mk: f32,
  md: f32,
};

struct Body {
  off: vec2f,
  vel: vec2f,
  ang: f32,
  avel: f32,
  delay: f32,
  _p: f32,
};

struct SimU {
  a: vec4f, // dt, temps depuis l'arrivée, 0, nombre de lettres
  b: vec4f, // pointeur (css, relatif à l'élément), dedans, premier glyphe
  c: vec4f, // vitesse du pointeur (css/s), vitesse de défilement (css/s), 0
};

@group(0) @binding(0) var<uniform> u: SimU;
@group(0) @binding(1) var<storage, read> glyphs: array<Glyph>;
@group(0) @binding(2) var<storage, read_write> bodies: array<Body>;

fn h1(n: f32) -> f32 {
  return fract(sin(n * 91.345) * 47453.5453);
}

// Une lettre = un ressort amorti vers sa place dans le DOM. Le pointeur la
// pousse et l'entraîne, le défilement la fait traîner : comme un caractère
// de plomb posé dans la forme, pas encore serré.
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (f32(i) >= u.a.w) { return; }
  let g = glyphs[i + u32(u.b.w)];
  var b = bodies[i];
  let dt = u.a.x;
  if (u.a.y < b.delay) {
    // Encore en l'air : la lettre attend son tour, immobile.
    bodies[i] = b;
    return;
  }
  let rest = g.pos + g.size * 0.5;
  let p = rest + b.off;
  let mass = 0.7 + h1(f32(i)) * 0.6;

  var acc = (-42.0 * b.off - 4.6 * b.vel) / mass;
  var aacc = (-38.0 * b.ang - 3.8 * b.avel) / mass;

  if (u.b.z > 0.5) {
    let d = p - u.b.xy;
    let dist = length(d);
    let w = max(0.0, 1.0 - dist / 210.0);
    let w2 = w * w;
    let n = d / max(dist, 1e-3);
    acc += n * w2 * 2200.0 / mass;
    acc += u.c.xy * w2 * 5.5 / mass;
    // Un balayage fait tourner la lettre autour du point de contact.
    aacc += (n.x * u.c.y - n.y * u.c.x) * w2 * 0.006 / mass;
  }
  // Le papier file sous les lettres : elles traînent, puis rattrapent.
  acc.y -= u.c.z * (0.9 + h1(f32(i) * 1.7) * 0.6);

  b.vel += acc * dt;
  b.off += b.vel * dt;
  b.avel += aacc * dt;
  b.ang += b.avel * dt;
  let len = length(b.off);
  if (len > 900.0) { b.off *= 900.0 / len; }
  b.ang = clamp(b.ang, -3.2, 3.2);
  bodies[i] = b;
}
`;

/* ───────────────────────── Calcul : encre ───────────────────────── */

export const INK = /* wgsl */ `
${FRAME_STRUCT}

struct Drop {
  pos: vec2f,   // coordonnées de la plaque, 0…1 en x, 0…aspect en y
  vel: vec2f,
  life: f32,
  src: f32,     // 0 cyan, 1 magenta, 2 noir
  seed: f32,
  _p: f32,
};

struct InkU {
  a: vec4f, // dt, temps, nombre de gouttes, aspect (h / w)
  b: vec4f, // plaque x, y, w, h (css)
  c: vec4f, // pointeur (coord. plaque), dedans, remous
  d: vec4f, // vitesse du pointeur (coord. plaque / s), courant, taille (css)
};

@group(0) @binding(0) var<uniform> u: InkU;
@group(0) @binding(1) var<storage, read_write> drops: array<Drop>;

fn hh(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn vn(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let s = f * f * (3.0 - 2.0 * f);
  return mix(mix(hh(i), hh(i + vec2f(1.0, 0.0)), s.x), mix(hh(i + vec2f(0.0, 1.0)), hh(i + vec2f(1.0, 1.0)), s.x), s.y);
}

fn potential(p: vec2f, t: f32) -> f32 {
  return vn(p * 2.3 + vec2f(t * 0.07, -t * 0.05)) + 0.5 * vn(p * 5.1 - vec2f(t * 0.11, t * 0.04));
}

// Bruit rotationnel : la vitesse est le rotationnel d'un potentiel, donc
// sans divergence. L'encre tourne et s'étire, elle ne s'accumule pas.
fn curl(p: vec2f, t: f32) -> vec2f {
  let e = 0.004;
  let dx = potential(p + vec2f(e, 0.0), t) - potential(p - vec2f(e, 0.0), t);
  let dy = potential(p + vec2f(0.0, e), t) - potential(p - vec2f(0.0, e), t);
  return vec2f(dy, -dx) / (2.0 * e);
}

fn source_at(src: f32, t: f32, aspect: f32) -> vec2f {
  // Trois gouttes posées sur la plaque, qui dérivent lentement.
  let a = src * 2.094 + t * 0.06;
  return vec2f(0.5 + cos(a) * 0.22, aspect * (0.5 + sin(a * 1.3) * 0.2));
}

@compute @workgroup_size(64)
fn sim(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (f32(i) >= u.a.z) { return; }
  var d = drops[i];
  let dt = u.a.x;
  let t = u.a.y;
  let aspect = u.a.w;

  d.life -= dt * (0.2 + d.seed * 0.16);
  if (d.life <= 0.0) {
    let k = hh(vec2f(f32(i), t));
    let r = sqrt(hh(vec2f(t, f32(i) * 0.37))) * 0.06;
    let a = k * 6.2832;
    d.pos = source_at(d.src, t, aspect) + vec2f(cos(a), sin(a)) * r;
    d.vel = vec2f(0.0);
    d.life = 1.0;
  }

  var v = curl(d.pos, t) * 0.032 * u.d.y;
  // Diffusion : sans elle, les gouttes se rangent sur les lignes de courant.
  let j = vec2f(hh(vec2f(f32(i), t * 13.1)), hh(vec2f(t * 7.7, f32(i)))) - 0.5;
  v += j * 0.022 * (0.3 + u.d.y * 0.7);
  if (u.c.z > 0.5) {
    let dp = d.pos - u.c.xy;
    let w = exp(-dot(dp, dp) / 0.006);
    v += u.d.xy * w * 0.9 * u.c.w;
  }
  d.vel = mix(d.vel, v, 1.0 - exp(-dt * 6.0));
  d.pos += d.vel * dt;
  d.pos.x = fract(d.pos.x);
  d.pos.y = d.pos.y - floor(d.pos.y / aspect) * aspect;
  drops[i] = d;
}

@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var<uniform> ink: InkU;
@group(1) @binding(1) var<storage, read> drawn: array<Drop>;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) color: vec4f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VsOut {
  let d = drawn[ii];
  let c = corner(vi);
  let st = ink.b;
  let center = st.xy + vec2f(d.pos.x, d.pos.y / ink.a.w) * st.zw;
  let s = ink.d.z * (0.8 + d.seed * 1.4);
  var out: VsOut;
  out.clip = to_clip(center + (c - 0.5) * s, frame);
  out.local = c - 0.5;
  var inks = array<vec3f, 3>(vec3f(0.0, 0.53, 0.78), vec3f(0.84, 0.0, 0.45), vec3f(0.07, 0.07, 0.08));
  // L'encre fraîche est dense, elle pâlit en s'étalant.
  let fade = smoothstep(0.0, 0.25, d.life) * (0.35 + 0.65 * d.life);
  out.color = vec4f(inks[u32(d.src)], 0.3 * fade);
  return out;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let r = length(in.local) * 2.0;
  let a = (1.0 - smoothstep(0.4, 1.0, r)) * in.color.a;
  return vec4f(in.color.rgb * a, a);
}
`;

/* ───────────────────────── Calcul : encre fraîche (fluide) ───────────────────────── */

// Fluides stables (Stam, 1999) sur une grille de vitesse, puis advection de
// la photo elle-même comme colorant. Coordonnées en uv de la plaque (0…1).
export const FLUID = /* wgsl */ `
struct FluidU {
  a: vec4f,    // dt, relâchement vers la photo, aspect (l/h), 0
  splat: vec4f, // pointeur (uv), dedans, rayon (uv)
  force: vec4f, // vitesse du pointeur (uv/s), intensité, 0
  photo: vec4f, // recadrage cover de la photo source
};

@group(0) @binding(0) var<uniform> u: FluidU;
@group(0) @binding(1) var samp: sampler;

// Advection de la vitesse + impulsion du pointeur.
@group(1) @binding(0) var velIn: texture_2d<f32>;
@group(1) @binding(1) var velOut: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn advect_vel(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(velOut);
  if (any(id.xy >= size)) { return; }
  let uv = (vec2f(id.xy) + 0.5) / vec2f(size);
  let v = textureSampleLevel(velIn, samp, uv, 0.0).xy;
  var nv = textureSampleLevel(velIn, samp, uv - v * u.a.x, 0.0).xy * 0.985;
  if (u.splat.z > 0.5) {
    let d = (uv - u.splat.xy) * vec2f(u.a.z, 1.0);
    nv += u.force.xy * u.force.z * exp(-dot(d, d) / (u.splat.w * u.splat.w)) * u.a.x * 6.0;
  }
  textureStore(velOut, id.xy, vec4f(nv, 0.0, 1.0));
}

// Divergence de la vitesse.
@group(1) @binding(0) var velTex: texture_2d<f32>;
@group(1) @binding(1) var divOut: texture_storage_2d<r32float, write>;

fn vel_at(p: vec2i) -> vec2f {
  let size = vec2i(textureDimensions(velTex));
  // Bords pleins : la vitesse normale s'y annule.
  if (p.x < 0 || p.y < 0 || p.x >= size.x || p.y >= size.y) { return vec2f(0.0); }
  return textureLoad(velTex, p, 0).xy;
}

@compute @workgroup_size(8, 8)
fn divergence(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(divOut);
  if (any(id.xy >= size)) { return; }
  let p = vec2i(id.xy);
  let h = 1.0 / vec2f(size);
  let dx = (vel_at(p + vec2i(1, 0)).x - vel_at(p - vec2i(1, 0)).x) / (2.0 * h.x);
  let dy = (vel_at(p + vec2i(0, 1)).y - vel_at(p - vec2i(0, 1)).y) / (2.0 * h.y);
  textureStore(divOut, id.xy, vec4f(dx + dy, 0.0, 0.0, 1.0));
}

// Pression : une itération de Jacobi.
@group(1) @binding(0) var pIn: texture_2d<f32>;
@group(1) @binding(1) var divTex: texture_2d<f32>;
@group(1) @binding(2) var pOut: texture_storage_2d<r32float, write>;

fn p_at(p: vec2i) -> f32 {
  let size = vec2i(textureDimensions(pIn));
  return textureLoad(pIn, clamp(p, vec2i(0), size - 1), 0).r;
}

@compute @workgroup_size(8, 8)
fn jacobi(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(pOut);
  if (any(id.xy >= size)) { return; }
  let p = vec2i(id.xy);
  let h = 1.0 / vec2f(size);
  let div = textureLoad(divTex, p, 0).r;
  let sum = p_at(p + vec2i(1, 0)) + p_at(p - vec2i(1, 0)) + p_at(p + vec2i(0, 1)) + p_at(p - vec2i(0, 1));
  textureStore(pOut, id.xy, vec4f((sum - div * h.x * h.y) * 0.25, 0.0, 0.0, 1.0));
}

// Projection : on retire le gradient de pression, la vitesse devient sans divergence.
@group(1) @binding(0) var pTex: texture_2d<f32>;
@group(1) @binding(1) var velSrc: texture_2d<f32>;
@group(1) @binding(2) var velDst: texture_storage_2d<rgba16float, write>;

fn pt_at(p: vec2i) -> f32 {
  let size = vec2i(textureDimensions(pTex));
  return textureLoad(pTex, clamp(p, vec2i(0), size - 1), 0).r;
}

@compute @workgroup_size(8, 8)
fn project(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(velDst);
  if (any(id.xy >= size)) { return; }
  let p = vec2i(id.xy);
  let h = 1.0 / vec2f(size);
  let g = vec2f(pt_at(p + vec2i(1, 0)) - pt_at(p - vec2i(1, 0)), pt_at(p + vec2i(0, 1)) - pt_at(p - vec2i(0, 1))) / (2.0 * h);
  let v = textureLoad(velSrc, p, 0).xy - g;
  textureStore(velDst, id.xy, vec4f(v, 0.0, 1.0));
}

// Le colorant est la photo : advectée par le fluide, rappelée doucement vers
// l'original pour que l'encre « sèche ».
@group(1) @binding(0) var dyeIn: texture_2d<f32>;
@group(1) @binding(1) var dyeVel: texture_2d<f32>;
@group(1) @binding(2) var photo: texture_2d<f32>;
@group(1) @binding(3) var dyeOut: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn advect_dye(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(dyeOut);
  if (any(id.xy >= size)) { return; }
  let uv = (vec2f(id.xy) + 0.5) / vec2f(size);
  let v = textureSampleLevel(dyeVel, samp, uv, 0.0).xy;
  let moved = textureSampleLevel(dyeIn, samp, uv - v * u.a.x, 0.0);
  let src = textureSampleLevel(photo, samp, mix(u.photo.xy, u.photo.zw, uv), 0.0);
  textureStore(dyeOut, id.xy, mix(moved, src, u.a.y));
}
`;

/* ───────────────────────── Boîtes de debug ───────────────────────── */

export const BOXES = /* wgsl */ `
${FRAME_STRUCT}

struct Box { rect: vec4f, color: vec4f };

@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var<storage, read> boxes: array<Box>;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) size: vec2f,
  @location(2) @interpolate(flat) color: vec4f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VsOut {
  let b = boxes[ii];
  let c = corner(vi);
  var out: VsOut;
  out.clip = to_clip(b.rect.xy + c * b.rect.zw, frame);
  out.local = c;
  out.size = b.rect.zw;
  out.color = b.color;
  return out;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let p = in.local * in.size;
  let e = min(min(p.x, in.size.x - p.x), min(p.y, in.size.y - p.y));
  // Trait d'un pixel CSS, tirets de 6 px.
  let dash = step(0.5, fract((p.x + p.y) / 12.0));
  let a = (1.0 - smoothstep(0.5, 1.5, e)) * mix(0.55, 1.0, dash) * in.color.a;
  return vec4f(in.color.rgb * a, a);
}
`;

/* ───────────────────────── Bloom ───────────────────────── */

const FULLSCREEN_VS = /* wgsl */ `
struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  var out: VsOut;
  out.clip = vec4f(p, 0.0, 1.0);
  out.uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return out;
}
`;

export const BLOOM = /* wgsl */ `
${FULLSCREEN_VS}

struct BloomU {
  texel: vec4f,   // 1/w, 1/h de la source, 0, 0
  thresh: vec4f,  // seuil, genou, 0, 0
};

@group(0) @binding(0) var<uniform> u: BloomU;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var src: texture_2d<f32>;

// Extraction : genou doux centré sur le seuil.
@fragment
fn fs_prefilter(in: VsOut) -> @location(0) vec4f {
  let o = u.texel.xy;
  // 4 taps pour réduire de moitié sans crénelage.
  var c = textureSample(src, samp, in.uv + vec2f(-o.x, -o.y) * 0.5).rgb;
  c += textureSample(src, samp, in.uv + vec2f(o.x, -o.y) * 0.5).rgb;
  c += textureSample(src, samp, in.uv + vec2f(-o.x, o.y) * 0.5).rgb;
  c += textureSample(src, samp, in.uv + vec2f(o.x, o.y) * 0.5).rgb;
  c *= 0.25;
  let b = max(c.r, max(c.g, c.b));
  let t = u.thresh.x;
  let k = max(u.thresh.y, 1e-4);
  var soft = clamp(b - t + k, 0.0, 2.0 * k);
  soft = soft * soft / (4.0 * k);
  let w = max(soft, b - t) / max(b, 1e-4);
  return vec4f(c * w, 1.0);
}

// Dual filter (Bjørge, 2015) : 5 taps en descente.
@fragment
fn fs_down(in: VsOut) -> @location(0) vec4f {
  let o = u.texel.xy;
  var c = textureSample(src, samp, in.uv).rgb * 4.0;
  c += textureSample(src, samp, in.uv + vec2f(-o.x, -o.y)).rgb;
  c += textureSample(src, samp, in.uv + vec2f(o.x, -o.y)).rgb;
  c += textureSample(src, samp, in.uv + vec2f(-o.x, o.y)).rgb;
  c += textureSample(src, samp, in.uv + vec2f(o.x, o.y)).rgb;
  return vec4f(c / 8.0, 1.0);
}

// 8 taps en remontée, ajoutés au niveau du dessous (blend additif).
@fragment
fn fs_up(in: VsOut) -> @location(0) vec4f {
  let o = u.texel.xy;
  var c = textureSample(src, samp, in.uv + vec2f(-o.x * 2.0, 0.0)).rgb;
  c += textureSample(src, samp, in.uv + vec2f(-o.x, o.y)).rgb * 2.0;
  c += textureSample(src, samp, in.uv + vec2f(0.0, o.y * 2.0)).rgb;
  c += textureSample(src, samp, in.uv + vec2f(o.x, o.y)).rgb * 2.0;
  c += textureSample(src, samp, in.uv + vec2f(o.x * 2.0, 0.0)).rgb;
  c += textureSample(src, samp, in.uv + vec2f(o.x, -o.y)).rgb * 2.0;
  c += textureSample(src, samp, in.uv + vec2f(0.0, -o.y * 2.0)).rgb;
  c += textureSample(src, samp, in.uv + vec2f(-o.x, -o.y)).rgb * 2.0;
  return vec4f(c / 12.0, 1.0);
}
`;

/* ───────────────────────── Mipmaps ───────────────────────── */

export const BLIT = /* wgsl */ `
${FULLSCREEN_VS}
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var src: texture_2d<f32>;
@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  return textureSample(src, samp, in.uv);
}
`;

/* ───────────────────────── Traces du pointeur (matières) ───────────────────────── */

// Une couche par matière, en 192 × 192 étirés sur sa plaque :
//   rg : vent ou peinture poussés par le pointeur (uv), b : présence (brume
//   écartée, peinture fraîche, buée essuyée, givre fondu).
// Chaque couche s'efface à son propre rythme. Lecture dans A, écriture dans
// B, puis copie B → A : le composite lit toujours A.
export const TRACE_SIZE = 192;
// Une couche de mémoire par plaque de matière visible, pas par matière :
// deux plaques de brume n'essuient pas la même buée.
export const TRACE_LAYERS = 9;
/** La dernière couche couvre l'écran entier : la mémoire du papier froissé. */
export const SCREEN_LAYER = TRACE_LAYERS - 1;
/** Bords déchirés : jusqu'à huit à l'écran. */
export const MAX_TEARS = 8;
export const TRACE = /* wgsl */ `
struct TraceU {
  a: vec4f,                       // dt, décalage de la couche d'écran (texels), couche d'écran, 0
  layer: array<vec4f, ${TRACE_LAYERS * 3}>,  // par couche : [actif (2 = remise à zéro), dedans, pointeur u, v], [vitesse u, v, aspect, rayon], [gain b, oubli b, gain rg, oubli rg]
};
@group(0) @binding(0) var<uniform> u: TraceU;
@group(0) @binding(1) var src: texture_2d_array<f32>;
@group(0) @binding(2) var dst: texture_storage_2d_array<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn trace(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(dst);
  if (any(id.xy >= size)) { return; }
  let l = i32(id.z);
  var v = textureLoad(src, id.xy, l, 0);
  // La couche d'écran suit le papier : au défilement, la mémoire remonte avec lui.
  if (l == i32(u.a.z) && abs(u.a.y) > 0.5) {
    let sy = i32(id.y) + i32(u.a.y);
    if (sy < 0 || sy >= i32(size.y)) { v = vec4f(0.0, 0.0, 0.0, 1.0); } else { v = textureLoad(src, vec2u(id.x, u32(sy)), l, 0); }
  }
  let p0 = u.layer[l * 3];
  let p1 = u.layer[l * 3 + 1];
  let p2 = u.layer[l * 3 + 2];
  if (p0.x > 1.5) { v = vec4f(0.0, 0.0, 0.0, 1.0); }
  if (p0.x > 0.5) {
    let dt = u.a.x;
    v = vec4f(v.xy * exp(-dt * p2.w), v.z * exp(-dt * p2.y), 1.0);
    if (p0.y > 0.5) {
      let uv = (vec2f(id.xy) + 0.5) / vec2f(size);
      let d = (uv - p0.zw) * vec2f(p1.z, 1.0);
      let g = exp(-dot(d, d) / (p1.w * p1.w));
      v.z = min(1.0, v.z + g * dt * p2.x);
      v = vec4f(clamp(v.xy + p1.xy * g * dt * p2.z, vec2f(-1.0), vec2f(1.0)), v.z, 1.0);
    }
  }
  textureStore(dst, id.xy, l, v);
}
`;

/* ───────────────────────── Feu (matières, en HDR) ───────────────────────── */

// Les flammes de la leçon 06.1 sont dessinées dans la scène en virgule
// flottante, avant le bloom : leur cœur dépasse 1, le bloom en tire un halo,
// et la passe composite n'ajoute plus que la chaleur et la fumée.
// Mélange prémultiplié : rgb = lumière émise (+ suie), a = ce qui assombrit le
// papier dessous. Le feu roussit la feuille, ce qui lui donne son contraste.
export const FIRE = /* wgsl */ `
${FRAME_STRUCT}

struct Fire {
  rect: vec4f, // x, y, l, h (css)
  p: vec4f,    // type (0 flammes, 1 enveloppe), intensité, marge (css), survol
  ptr: vec4f,  // pointeur x, y (css), dedans, 0
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var<uniform> fire: Fire;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) px: vec2f,
};

@vertex
fn vs_fire(@builtin(vertex_index) vi: u32) -> VsOut {
  let p = fire.rect.xy + corner(vi) * fire.rect.zw;
  var out: VsOut;
  out.clip = to_clip(p, frame);
  out.px = p;
  return out;
}

fn fh(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}
fn fnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let s = f * f * (3.0 - 2.0 * f);
  return mix(mix(fh(i), fh(i + vec2f(1.0, 0.0)), s.x), mix(fh(i + vec2f(0.0, 1.0)), fh(i + vec2f(1.0, 1.0)), s.x), s.y);
}
fn ffbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  for (var i = 0; i < 5; i++) {
    v += a * fnoise(q);
    q = q * 2.03 + vec2f(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

// Corps noir simplifié : rouge sombre, rouge, orange, ambre, jaune. Le
// composite n'a pas de courbe de compression : au-delà de 1, la couleur est
// écrêtée vers le blanc. On reste donc juste au-dessus de 1, assez pour que
// le bloom en tire un halo, sans brûler l'image en blanc.
fn blackbody(t: f32) -> vec3f {
  let k = clamp(t, 0.0, 1.0) * 4.0;
  let c0 = vec3f(0.22, 0.02, 0.0);
  let c1 = vec3f(0.8, 0.1, 0.02);
  let c2 = vec3f(1.2, 0.36, 0.04);
  let c3 = vec3f(1.35, 0.66, 0.14);
  let c4 = vec3f(1.45, 0.95, 0.32);
  if (k < 1.0) { return mix(c0, c1, k); }
  if (k < 2.0) { return mix(c1, c2, k - 1.0); }
  if (k < 3.0) { return mix(c2, c3, k - 2.0); }
  return mix(c3, c4, k - 3.0);
}

// Braises : une par cellule tirée au sort, qui monte en vacillant.
fn embers(p: vec2f, t: f32, cell: f32) -> f32 {
  var s = 0.0;
  for (var k = 0; k < 2; k++) {
    let fk = f32(k);
    let c = cell * (1.0 + fk * 0.7);
    let q = vec2f(p.x + sin(p.y / 23.0 + fk) * 6.0, p.y + t * (55.0 + 45.0 * fk)) / c;
    let id = floor(q);
    let h = fh(id + fk * 17.0);
    let pos = vec2f(fh(id + 3.1), fh(id + 7.7)) * 0.8 + 0.1;
    let d = length(fract(q) - pos) * c;
    let flick = step(0.8, h) * (0.55 + 0.45 * sin(t * 18.0 + h * 50.0));
    s += flick * exp(-d * d / 1.6);
  }
  return s;
}

fn sd_rbox(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

const SOOT: vec3f = vec3f(0.16, 0.07, 0.02);

@fragment
fn fs_fire(in: VsOut) -> @location(0) vec4f {
  let t = frame.viewport.w;
  let amt = fire.p.y;
  let r = fire.rect;
  let px = in.px;
  var f: f32;
  var up: f32;
  var molten = 0.0;
  var reachUp = 0.0;
  if (fire.p.x < 0.5) {
    // Flammes : des langues qui montent du pied de la plaque.
    let local = px - r.xy;
    let h = 1.0 - local.y / r.w;
    let lean = select(0.0, (fire.ptr.x - (r.x + r.z * 0.5)) / r.z, fire.ptr.z > 0.5);
    let q = vec2f(local.x / 80.0 - lean * h * 1.4, local.y / 150.0 + t * 1.15);
    let warp = vec2f(ffbm(q * 1.4 + vec2f(0.0, t * 0.35)), ffbm(q * 1.4 + vec2f(5.2, t * 0.45))) - 0.5;
    let n = ffbm(q * vec2f(1.0, 0.7) + warp * 1.3);
    let H = (0.3 + 0.42 * ffbm(vec2f(local.x / 130.0, t * 0.18))) * amt;
    // Des langues plutôt qu'un aplat : la hauteur varie d'une colonne à l'autre.
    let tongues = 0.55 + 0.45 * ffbm(vec2f(local.x / 46.0, t * 0.9));
    f = (H * tongues - h) / max(H, 0.05) + (n - 0.5) * 1.5;
    up = h;
    reachUp = H;
  } else {
    // Enveloppe : une bordure de feu autour de l'élément, plus haute au-dessus.
    let pad = fire.p.z;
    let inner = vec4f(r.xy + vec2f(pad), r.zw - vec2f(pad * 2.0));
    let c = inner.xy + inner.zw * 0.5;
    let d = sd_rbox(px - c, inner.zw * 0.5, 4.0);
    if (d < 0.0) { return vec4f(0.0); }
    up = clamp((c.y - px.y) / (inner.w * 0.5 + pad), -1.0, 1.0);
    let q = vec2f(px.x / 24.0, px.y / 40.0 + t * 1.9);
    let warp = vec2f(ffbm(q * 1.3 + vec2f(0.0, t * 0.4)), ffbm(q * 1.3 + vec2f(4.1, t * 0.5))) - 0.5;
    let n = ffbm(q + warp * 1.2);
    // La flamme ne doit jamais sortir de la plaque dessinée : avec la suie
    // (jusqu'à 1,5 fois la portée), elle reste sous la marge.
    let reach = min(mix(9.0, 38.0, up * 0.5 + 0.5) * (0.55 + n * 1.0) * (1.0 + 0.45 * fire.p.w) * amt, pad * 0.6);
    f = 1.0 - d / max(reach, 0.5) + (n - 0.5) * 0.6;
    molten = (1.0 - smoothstep(0.0, 2.2, d)) * (0.75 + 0.25 * sin(t * 9.0 + n * 12.0)) * min(amt, 1.0);
    reachUp = 1.0;
  }
  let body = smoothstep(0.0, 0.3, f);
  // La température monte vers le cœur ; le jaune reste au plus chaud.
  var light = blackbody(f * 0.72) * body * min(amt, 1.2);
  light += vec3f(1.5, 0.85, 0.3) * molten;
  // Braises au-dessus du feu.
  let ember = embers(px, t, 20.0) * smoothstep(-0.2, 0.4, up) * (1.0 - smoothstep(0.5, 1.0, up)) * min(amt, 1.0);
  light += vec3f(1.6, 0.6, 0.12) * ember;
  // Suie : la feuille roussit autour et sous les flammes ; sous le corps du
  // feu, le papier s'efface presque, pour que l'orange ne soit pas délavé.
  let soot = smoothstep(-0.5, 0.15, f) * 0.6 * min(amt, 1.0);
  // Filet de sécurité : tout s'éteint en douceur au bord du quad.
  let border = min(min(px.x - r.x, r.x + r.z - px.x), min(px.y - r.y, r.y + r.w - px.y));
  let keep = smoothstep(0.0, 18.0, border);
  let a = clamp(soot + body * 0.65, 0.0, 0.95) * keep;
  return vec4f((light + SOOT * soot) * keep, a);
}
`;

/* ───────────────────────── Sources animées (chapitre 06) ───────────────────────── */

// Des shaders animés à la place de la photo, pour essayer les filtres sur une
// image qui bouge : dégradé maillé, encre marbrée, ondes, métaballes.
export const PROC = /* wgsl */ `
${FRAME_STRUCT}

struct Proc {
  rect: vec4f, // x, y, l, h (css)
  p: vec4f,    // source (1…4), 0, 0, 0
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var<uniform> proc: Proc;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_proc(@builtin(vertex_index) vi: u32) -> VsOut {
  let c = corner(vi);
  var out: VsOut;
  out.clip = to_clip(proc.rect.xy + c * proc.rect.zw, frame);
  out.uv = c;
  return out;
}

fn ph(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}
fn pnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let s = f * f * (3.0 - 2.0 * f);
  return mix(mix(ph(i), ph(i + vec2f(1.0, 0.0)), s.x), mix(ph(i + vec2f(0.0, 1.0)), ph(i + vec2f(1.0, 1.0)), s.x), s.y);
}
fn pfbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  for (var i = 0; i < 5; i++) {
    v += a * pnoise(q);
    q = q * 2.02 + vec2f(1.3, 7.1);
    a *= 0.5;
  }
  return v;
}

// Dégradé maillé : cinq taches de couleur qui dérivent, mêlées à travers un
// champ déformé.
fn mesh(uv: vec2f, t: f32, aspect: f32) -> vec3f {
  var cols = array<vec3f, 5>(
    vec3f(0.96, 0.42, 0.22),
    vec3f(0.18, 0.36, 0.78),
    vec3f(0.98, 0.82, 0.46),
    vec3f(0.62, 0.18, 0.42),
    vec3f(0.12, 0.62, 0.58),
  );
  var p = (uv - 0.5) * vec2f(aspect, 1.0);
  p += (vec2f(pfbm(p * 1.6 + t * 0.07), pfbm(p * 1.6 + 4.0 - t * 0.06)) - 0.5) * 0.5;
  var acc = vec3f(0.0);
  var wsum = 0.0;
  for (var i = 0; i < 5; i++) {
    let fi = f32(i);
    let c = vec2f(sin(t * 0.21 + fi * 1.7) * 0.42 * aspect, cos(t * 0.17 + fi * 2.3) * 0.38);
    let d = length(p - c);
    let w = 1.0 / pow(d + 0.06, 2.6);
    acc += cols[i] * w;
    wsum += w;
  }
  return acc / wsum;
}

// Encre marbrée : bruit replié sur lui-même (domain warping), trois encres
// sur papier.
fn marble(uv: vec2f, t: f32, aspect: f32) -> vec3f {
  let p = uv * vec2f(aspect, 1.0) * 2.4;
  let q = vec2f(pfbm(p + vec2f(0.0, t * 0.05)), pfbm(p + vec2f(5.2, 1.3) - t * 0.04));
  let r = vec2f(pfbm(p + 3.5 * q + vec2f(1.7, 9.2) + t * 0.06), pfbm(p + 3.5 * q + vec2f(8.3, 2.8)));
  let f = pfbm(p + 3.5 * r);
  var col = vec3f(0.94, 0.93, 0.9);
  col = mix(col, vec3f(0.07, 0.25, 0.55), smoothstep(0.35, 0.75, f));
  col = mix(col, vec3f(0.85, 0.2, 0.14), smoothstep(0.55, 0.9, length(q)) * 0.8);
  col = mix(col, vec3f(0.06, 0.06, 0.07), smoothstep(0.62, 0.78, r.x) * 0.9);
  return col;
}

// Ondes : deux sources qui interfèrent, en courbes de niveau.
fn waves(uv: vec2f, t: f32, aspect: f32) -> vec3f {
  let p = (uv - 0.5) * vec2f(aspect, 1.0);
  let a = vec2f(sin(t * 0.3) * 0.3, cos(t * 0.23) * 0.2);
  let b = vec2f(-sin(t * 0.27) * 0.32, -cos(t * 0.31) * 0.22);
  let h = sin(length(p - a) * 48.0 - t * 2.4) + sin(length(p - b) * 52.0 - t * 2.1);
  let v = h * 0.25 + 0.5;
  let lines = 1.0 - smoothstep(0.0, 0.12, abs(fract(v * 6.0) - 0.5) * 2.0 - 0.75);
  let tone = mix(vec3f(0.95, 0.94, 0.9), vec3f(0.1, 0.1, 0.12), smoothstep(0.2, 0.85, v));
  return mix(tone, vec3f(0.78, 0.2, 0.1), lines * 0.35);
}

// Métaballes : des gouttes de mercure qui se rejoignent, éclairées.
fn metaballs(uv: vec2f, t: f32, aspect: f32) -> vec3f {
  let p = (uv - 0.5) * vec2f(aspect, 1.0);
  var f = 0.0;
  var g = vec2f(0.0);
  for (var i = 0; i < 6; i++) {
    let fi = f32(i);
    let c = vec2f(sin(t * (0.3 + fi * 0.07) + fi * 2.1) * 0.36 * aspect, cos(t * (0.25 + fi * 0.05) + fi * 1.3) * 0.32);
    let r = 0.08 + 0.03 * sin(fi * 3.0);
    let d = p - c;
    let k = r * r / max(dot(d, d), 1e-4);
    f += k;
    g += -2.0 * k * d / max(dot(d, d), 1e-4);
  }
  let inside = smoothstep(0.95, 1.05, f);
  let n = normalize(vec3f(-g * 0.03, 1.0));
  let l = normalize(vec3f(-0.5, -0.6, 0.65));
  let diff = max(dot(n, l), 0.0);
  let spec = pow(max(dot(reflect(-l, n), vec3f(0.0, 0.0, 1.0)), 0.0), 40.0);
  let metal = vec3f(0.16, 0.17, 0.19) + vec3f(0.62) * diff + vec3f(1.0) * spec;
  let bg = mix(vec3f(0.93, 0.92, 0.88), vec3f(0.8, 0.79, 0.75), uv.y);
  return mix(bg, metal, inside);
}

@fragment
fn fs_proc(in: VsOut) -> @location(0) vec4f {
  if (wire_on(frame)) {
    let l = quad_wire(in.uv, proc.rect.zw);
    return vec4f(WIRE_INK * l, l);
  }
  let t = frame.viewport.w;
  let aspect = proc.rect.z / max(proc.rect.w, 1.0);
  let k = proc.p.x;
  var col: vec3f;
  if (k < 1.5) { col = mesh(in.uv, t, aspect); }
  else if (k < 2.5) { col = marble(in.uv, t, aspect); }
  else if (k < 3.5) { col = waves(in.uv, t, aspect); }
  else { col = metaballs(in.uv, t, aspect); }
  return vec4f(col, 1.0);
}
`;

/* ───────────────────────── Sommaire en feuilles ───────────────────────── */

// Une feuille du sommaire : un rectangle plat, posé en 3D par une matrice que
// le DOM reçoit aussi (matrix3d). La matrice inclut la perspective de la
// scène ; le GPU fait la division par w et l'interpolation correcte en
// perspective des coordonnées de texture.
export const SHEET = /* wgsl */ `
${FRAME_STRUCT}

struct Sheet {
  m: mat4x4f,     // feuille (px css) → écran (px css, homogène)
  size: vec4f,    // largeur, hauteur, alpha, éclairage
  photo: vec4f,   // x, y, l, h de la photo dans la feuille
  uv: vec4f,      // recadrage object-fit: cover
  look: vec4f,    // papier, pli gauche, pli droit, pellicule
  fx: vec4f,      // décalage des plaques (px css), 0, 0, 0
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var<uniform> sheet: Sheet;
@group(2) @binding(0) var samp: sampler;
@group(2) @binding(1) var tex: texture_2d<f32>;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) local: vec2f,
};

@vertex
fn vs_sheet(@builtin(vertex_index) vi: u32) -> VsOut {
  let local = corner(vi) * sheet.size.xy;
  let h = sheet.m * vec4f(local, 0.0, 1.0);
  var out: VsOut;
  // Écran (px css) → clip, sans diviser : le GPU s'en charge.
  out.clip = vec4f(h.x * 2.0 / frame.viewport.x - h.w, h.w - h.y * 2.0 / frame.viewport.y, 0.0, h.w);
  out.local = local;
  return out;
}

const PAPER_CARD: vec3f = vec3f(0.962, 0.958, 0.938);
const FILM: vec3f = vec3f(0.075, 0.07, 0.065);

@fragment
fn fs_sheet(in: VsOut, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  let p = in.local;
  let sz = sheet.size.xy;
  // Antialiasing analytique des bords, en pixels écran.
  let fw = max(fwidth(p), vec2f(1e-4));
  let edge = min(min(p.x, sz.x - p.x) / fw.x, min(p.y, sz.y - p.y) / fw.y);
  let cover = clamp(edge + 0.5, 0.0, 1.0);
  if (wire_on(frame)) {
    let q = p / sz;
    let diag = abs(q.x + q.y - 1.0) / max(length(fw / sz), 1e-5) * 0.7071;
    let ph = sheet.photo;
    let pe = min(min(abs(p.x - ph.x), abs(p.x - ph.x - ph.z)) / fw.x * step(ph.y, p.y) * step(p.y, ph.y + ph.w) + 1e3 * (1.0 - step(ph.y, p.y) * step(p.y, ph.y + ph.w)),
                 min(abs(p.y - ph.y), abs(p.y - ph.y - ph.w)) / fw.y * step(ph.x, p.x) * step(p.x, ph.x + ph.z) + 1e3 * (1.0 - step(ph.x, p.x) * step(p.x, ph.x + ph.z)));
    let l = max(max(1.0 - smoothstep(0.5, 1.4, edge), (1.0 - smoothstep(0.4, 1.2, diag)) * 0.4), (1.0 - smoothstep(0.4, 1.2, pe)) * 0.7) * sheet.size.z;
    // front_facing est inversé ici (la matrice CSS retourne y) : vrai = verso, en rouge.
    let ink = select(WIRE_INK, vec3f(0.85, 0.12, 0.1), front);
    return vec4f(ink * l, l);
  }

  let ph = sheet.photo;
  let t = (p - ph.xy) / max(ph.zw, vec2f(1.0));
  let inPhotoD = min(min(p.x - ph.x, ph.x + ph.z - p.x) / fw.x, min(p.y - ph.y, ph.y + ph.w - p.y) / fw.y);
  let inPhoto = clamp(inPhotoD + 0.5, 0.0, 1.0);
  let uv = mix(sheet.uv.xy, sheet.uv.zw, clamp(t, vec2f(0.0), vec2f(1.0)));
  // Bande sans fin : à grande vitesse, les plaques cyan et jaune glissent de
  // part et d'autre du magenta (le rouge et le bleu, en lumière).
  let du = vec2f(sheet.fx.x / max(ph.z, 1.0) * (sheet.uv.z - sheet.uv.x), 0.0);
  let photo = vec3f(
    textureSample(tex, samp, uv + du).r,
    textureSample(tex, samp, uv).g,
    textureSample(tex, samp, uv - du).b,
  );

  var base = PAPER_CARD;
  var a = sheet.look.x;
  if (sheet.look.w > 0.5) {
    // Pellicule : bandes noires et perforations.
    base = FILM;
    a = 1.0;
    let band = ph.y;
    let inBand = p.y < band || p.y > ph.y + ph.w;
    if (inBand) {
      let cy = select(sz.y - band * 0.5, band * 0.5, p.y < band);
      let hx = abs(fract(p.x / 13.0) - 0.5) * 13.0;
      let hy = abs(p.y - cy);
      let hole = max(hx - 3.2, hy - band * 0.22);
      base = mix(vec3f(0.82, 0.8, 0.76), FILM, smoothstep(-0.6, 0.6, hole));
    }
  } else if (a > 0.0) {
    // Filet gris au bord de la feuille de papier.
    let rim = 1.0 - smoothstep(0.6, 1.6, edge);
    base = mix(base, vec3f(0.72, 0.71, 0.67), rim * 0.6);
  }
  // Le dos d'une feuille retournée : du papier nu, ni photo ni légende.
  // La matrice CSS retourne l'axe y : une feuille vue de face arrive ici
  // comme une face arrière pour le GPU.
  let back = select(0.0, 1.0, front) * step(0.5, sheet.look.x);
  let showPhoto = inPhoto * (1.0 - back);
  var col = mix(base, photo, showPhoto);
  col = mix(col, PAPER_CARD * 0.94, back);
  a = mix(a, 1.0, showPhoto) * cover;

  // Plis : le creux s'assombrit vers la charnière.
  let u = p.x / sz.x;
  let crease = sheet.look.y * (1.0 - smoothstep(0.0, 0.35, u)) + sheet.look.z * (1.0 - smoothstep(0.0, 0.35, 1.0 - u));
  col *= sheet.size.w * (1.0 - 0.32 * crease);

  let alpha = a * sheet.size.z;
  return vec4f(col * alpha, alpha);
}
`;

/* ───────────────────────── Composite ───────────────────────── */

export const MAX_STAGES = 8;
export const MAX_CHAPTERS = 12;

export const COMPOSITE = /* wgsl */ `
${FULLSCREEN_VS}

struct Post {
  res: vec4f,      // pw, ph, dpr, time
  pointer: vec4f,  // x, y (px), inside, reduced
  chain: vec4f,    // distorsion, rvb, trame, bloom (0/1)
  chain2: vec4f,   // grain (0 coupé, 1 réel, plus = loupe), split, splitX (px), intensité bloom
  trame: vec4f,    // cellule (px css), engraissement, repérage, mélange
  paper: vec4f,    // rgb du papier, glissement (vitesse de défilement −1…1)
  filt: vec4f,     // filtre (0…4), taille (css), intensité, 0
  stages: array<vec4f, ${MAX_STAGES}>, // x, y, w, h en px
  kinds: array<vec4f, ${MAX_STAGES / 4}>,
  print: vec4f,    // nombre de chapitres, largeur du front (px), actif, style
  chapters: array<vec4f, ${MAX_CHAPTERS}>, // haut, bas, profondeur imprimée (px), bord gauche (px)
  a11y: vec4f,     // vision simulée (0…4), encre délavée (0…1), 0, 0
  casse: vec4f,    // nombre de caractères, largeur et hauteur de l'atlas, corps (px d'atlas)
  ramp: array<vec4f, 16>, // x, y, l, h dans l'atlas MTSDF, du plus clair au plus noir
  matter: vec4f,   // intensité des matières, marge de l'enveloppe de feu (px), écran du sommaire (0, 1 CRT, 2 projecteur), désintégration (0…1)
  screen: vec4f,   // rectangle de la scène du sommaire (px)
  crease: vec4f,   // froissé de page : actif, profondeur, 0, défilement de la page (px)
  lensm: vec4f,    // matière lentille : pointeur amorti x, y (px), force au survol, force réglée
  tear: vec4f,     // bords déchirés : nombre, amplitude, réaction, 0
  tears: array<vec4f, ${MAX_TEARS}>, // y, gauche, droite (px), 0
  grid: vec4f,     // masque (1 colonnes, 2 rangées, 4 centre), x gauche, x droite, gouttière (px)
  grid2: vec4f,    // nombre de colonnes, pas des rangées (px), défilement (px), 0
  cui: vec4f,      // effet Canvas UI (0 aucun…10), intensité, taille, 0
  cui2: vec4f,     // pointeur amorti x, y (px), présent, défilement (px)
  ripples: array<vec4f, ${MAX_RIPPLES}>, // clics : x, y (px), départ (s), force
};

@group(0) @binding(0) var<uniform> u: Post;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var scene: texture_2d<f32>;
@group(0) @binding(3) var bloom: texture_2d<f32>;
@group(0) @binding(4) var msdf: texture_2d<f32>;
@group(0) @binding(5) var trace: texture_2d_array<f32>;

const LENS_R: f32 = 130.0;

// Matière « lentille » : une loupe discrète, centrée sur le pointeur amorti,
// qui ne déborde pas de son élément. Discrète, elle passe pour du verre.
fn lens_material(px: vec2f, st: vec4f) -> vec2f {
  let r = min(st.z, st.w) * 0.42;
  let d = px - u.lensm.xy;
  let t = length(d) / r;
  if (t >= 1.0 || u.lensm.z < 0.001) { return vec2f(0.0); }
  let k = (1.0 - t * t);
  return -d * k * k * 0.3 * u.lensm.z * u.lensm.w;
}

// Papier froissé de page : un relief de plis vifs, fixé au papier (il défile
// avec lui). Seule l'octave fine compte : les rampes lentes donnaient des
// taches claires et sombres, l'écueil que décrit l'article de Codrops.
fn crease_h(q: vec2f) -> f32 {
  return crumple(q * 2.0 + vec2f(3.1, 7.7)) - 0.6 * vnoise(q * 0.5);
}
fn crease_grad(px: vec2f) -> vec2f {
  let s = 110.0 * u.res.z;
  let q = (px + vec2f(0.0, u.crease.w * u.res.z)) / s;
  let e = 0.35 / s * u.res.z;
  return vec2f(crease_h(q + vec2f(e, 0.0)) - crease_h(q - vec2f(e, 0.0)), crease_h(q + vec2f(0.0, e)) - crease_h(q - vec2f(0.0, e))) / (2.0 * e * s);
}

// Bord déchiré : la feuille du dessus s'arrête sur une ligne irrégulière,
// avec un liseré de fibres plus claires et une ombre sur la feuille du dessous.
fn tear_edge(px: vec2f, col: vec3f) -> vec3f {
  let dpr = u.res.z;
  let t = u.res.w;
  var c = col;
  for (var i = 0; i < ${MAX_TEARS}; i++) {
    if (f32(i) >= u.tear.x) { break; }
    let e = u.tears[i];
    if (px.x < e.y || px.x > e.z || abs(px.y - e.x) > 90.0 * dpr) { continue; }
    let fi = f32(i);
    // Ondulation lente ; le défilement l'ouvre, le pointeur la tord.
    let slow = (fbm(vec2f(px.x / (60.0 * dpr), t * 0.12 + fi * 3.1)) - 0.5) * 26.0 * dpr;
    let open = 1.0 + abs(u.paper.w) * 5.0 * u.tear.z;
    let pd = (px.x - u.pointer.x) / (170.0 * dpr);
    let pull = select(0.0, clamp(u.pointer.y - e.x, -70.0 * dpr, 70.0 * dpr) * 0.45 * exp(-pd * pd) * u.tear.z, u.pointer.z > 0.5);
    let jag = (vnoise(vec2f(px.x / (2.6 * dpr), fi * 7.0)) - 0.5) * 4.0 * dpr + (vnoise(vec2f(px.x / (9.0 * dpr), fi)) - 0.5) * 6.0 * dpr;
    let y = e.x + (slow * open + jag) * u.tear.y + pull;
    let f = px.y - y;
    // Liseré : la tranche du papier déchiré, plus claire, en fibres.
    let rim = (2.5 + 5.0 * vnoise(vec2f(px.x / (5.0 * dpr), fi * 3.0))) * dpr * u.tear.y;
    let fib = vnoise(vec2f(px.x / (1.3 * dpr), px.y / (4.0 * dpr)));
    if (f < 0.0 && f > -rim) { c = mix(c, vec3f(0.985, 0.978, 0.962), 0.75 + 0.25 * fib); }
    // Ombre portée sur la feuille du dessous.
    if (f >= 0.0) { c *= 1.0 - 0.26 * exp(-f / (6.0 * dpr)) * min(u.tear.y, 1.5); }
  }
  return c;
}

// Débogage : la grille de mise en page, par-dessus l'image finale.
fn grid_overlay(px: vec2f, col: vec3f) -> vec3f {
  let m = i32(u.grid.x);
  var c = col;
  let one = u.res.z;
  if ((m & 1) != 0) {
    // Colonnes : bandes rouges translucides, bords plus nets.
    let n = u.grid2.x;
    let w = (u.grid.z - u.grid.y - u.grid.w * (n - 1.0)) / n;
    let x = px.x - u.grid.y;
    let k = floor(x / (w + u.grid.w));
    let inCol = x >= 0.0 && px.x <= u.grid.z && (x - k * (w + u.grid.w)) <= w;
    if (inCol) {
      c = mix(c, vec3f(0.92, 0.2, 0.2), 0.08);
      let fx = x - k * (w + u.grid.w);
      if (fx < one || fx > w - one) { c = mix(c, vec3f(0.92, 0.2, 0.2), 0.45); }
    }
  }
  if ((m & 2) != 0) {
    // Rangées : le rythme vertical, attaché à la page.
    let y = px.y + u.grid2.z;
    let r = y - floor(y / u.grid2.y) * u.grid2.y;
    if (r < one) { c = mix(c, vec3f(0.1, 0.45, 0.9), 0.3); }
  }
  if ((m & 4) != 0) {
    // Centre : les deux axes de l'écran.
    let ctr = u.res.xy * 0.5;
    if (abs(px.x - ctr.x) < one || abs(px.y - ctr.y) < one) { c = mix(c, vec3f(0.0, 0.62, 0.55), 0.8); }
    if (length(px - ctr) < 6.0 * one && length(px - ctr) > 4.5 * one) { c = mix(c, vec3f(0.0, 0.62, 0.55), 0.9); }
  }
  return c;
}

fn kind_of(i: i32) -> f32 {
  let v = u.kinds[i / 4];
  let j = i % 4;
  if (j == 0) { return v.x; }
  if (j == 1) { return v.y; }
  if (j == 2) { return v.z; }
  return v.w;
}

// Étape 1+2+3 : distorsion → bloom → séparation RVB, à un point donné.
fn source(px: vec2f, lens: vec2f) -> vec3f {
  let res = u.res.xy;
  var p = px + lens;
  var col: vec3f;
  if (u.chain.y > 0.5) {
    // Repérage des plaques : au repos, net ; en défilement, les canaux
    // glissent dans le sens du papier, comme une feuille qui file sous les rouleaux.
    let off = vec2f(0.0, u.paper.w * 4.0) * u.res.z;
    col = vec3f(
      textureSampleLevel(scene, samp, (p + off) / res, 0.0).r,
      textureSampleLevel(scene, samp, p / res, 0.0).g,
      textureSampleLevel(scene, samp, (p - off) / res, 0.0).b,
    );
  } else {
    col = textureSampleLevel(scene, samp, p / res, 0.0).rgb;
  }
  if (u.chain.w > 0.5) {
    col += textureSampleLevel(bloom, samp, p / res, 0.0).rgb * u.chain2.w;
  }
  return col;
}

fn rot2(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, s, -s, c);
}

fn to_cmyk(rgb: vec3f) -> vec4f {
  // Relatif au papier : le papier ne reçoit pas d'encre.
  let c = clamp(rgb / u.paper.rgb, vec3f(0.0), vec3f(1.0));
  let k = 1.0 - max(c.r, max(c.g, c.b));
  let d = max(1.0 - k, 1e-4);
  return vec4f((1.0 - c.r - k) / d, (1.0 - c.g - k) / d, (1.0 - c.b - k) / d, k);
}

// Étape 4 : trame quadrichromique, une grille tournée par encre.
fn halftone(px: vec2f, lens: vec2f, cellCss: f32, gain: f32, misreg: f32) -> vec3f {
  let cell = max(cellCss * u.res.z, 2.0);
  let angles = vec4f(0.2618, 1.309, 0.0, 0.7854); // 15°, 75°, 0°, 45°
  var offs = array<vec2f, 4>(vec2f(1.0, 0.2), vec2f(-0.3, 1.0), vec2f(-0.8, -0.6), vec2f(0.0, 0.0));
  // Filtres d'encre : ce que chaque encre laisse passer.
  var inks = array<vec3f, 4>(
    vec3f(0.0, 0.63, 0.86),
    vec3f(0.89, 0.0, 0.49),
    vec3f(1.0, 0.88, 0.0),
    vec3f(0.07, 0.07, 0.07),
  );
  var out = u.paper.rgb;
  for (var i = 0; i < 4; i++) {
    let o = offs[i] * misreg * 6.0 * u.res.z;
    let r = rot2(angles[i]);
    let q = (r * (px - o)) / cell;
    let cc = floor(q) + 0.5;
    let centerPx = transpose(r) * (cc * cell) + o;
    let cmyk = to_cmyk(source(centerPx, lens));
    var v = cmyk[i];
    v = clamp(v + gain * v * (1.0 - v) * 2.0, 0.0, 1.0);
    let radius = sqrt(v / 3.14159);
    let dist = length(q - cc);
    let aa = 0.75 / cell;
    let cov = 1.0 - smoothstep(radius - aa, radius + aa, dist);
    out *= mix(vec3f(1.0), inks[i], cov);
  }
  return out;
}

// Transition : chaque chapitre s'imprime en montant dans l'écran. La
// profondeur imprimée ne fait que croître ; ce qui la sépare du papier vierge
// est le front, dont la forme dépend du style choisi (u.print.w) :
//   0 impression (encre humide), 1 trame, 2 quadrichromie, 3 buvard,
//   4 massicot, 5 fondu, 6 rouleau, 7 composition, 8 ligne à ligne,
//   9 révélateur, 10 pli.
// Rend un masque par canal (r, g, b) et l'humidité de l'encre ; print_shade
// assombrit ou éclaire l'image finale, papier compris (ombre d'un pli,
// passage du rouleau, curseur).
var<private> print_shade: f32 = 1.0;

fn tr_hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

// Tri de pixels (style 12) : sous le front, chaque colonne de 2 px coule
// d'une longueur tirée au sort ; les pixels de la traînée relisent la ligne du
// front, étirée vers le bas. Renvoie la distance de relecture (px), 0 sinon.
fn sort_pull(px: vec2f) -> f32 {
  if (u.print.z < 0.5 || i32(u.print.w + 0.5) != 12) { return 0.0; }
  let n = i32(u.print.x);
  for (var i = 0; i < ${MAX_CHAPTERS}; i++) {
    if (i >= n) { break; }
    let c = u.chapters[i];
    if (px.y >= c.x && px.y < c.y && px.x >= c.w) {
      let front = u.print.y;
      let base = (c.z - (px.y - c.x)) / front;
      if (base >= 0.0 || base < -1.6) { return 0.0; }
      let h = tr_hash(vec2f(floor(px.x / (2.0 * u.res.z)), f32(i) * 13.0));
      let len = 0.12 + 1.3 * h * h;
      if (-base > len) { return 0.0; }
      return -base * front;
    }
  }
  return 0.0;
}

fn printed(px: vec2f, col: vec3f) -> vec4f {
  print_shade = 1.0;
  if (u.print.z < 0.5) { return vec4f(1.0, 1.0, 1.0, 0.0); }
  let n = i32(u.print.x);
  let style = i32(u.print.w + 0.5);
  let dpr = u.res.z;
  for (var i = 0; i < ${MAX_CHAPTERS}; i++) {
    if (i >= n) { break; }
    let c = u.chapters[i];
    if (px.y >= c.x && px.y < c.y) {
      // Le sommaire n'imprime que la colonne de son épreuve : à gauche de c.w, rien.
      if (px.x < c.w) { return vec4f(1.0, 1.0, 1.0, 0.0); }
      let front = u.print.y;
      let rel = px.y - c.x;
      // 0 sur la ligne déjà imprimée la plus basse, 1 une largeur de front plus haut.
      let base = (c.z - rel) / front;
      if (base > 2.5) { return vec4f(1.0, 1.0, 1.0, 0.0); }
      if (style == 12) {
        // Tri de pixels : les traînées (voir sort_pull) sont encrées, le reste attend.
        let h = tr_hash(vec2f(floor(px.x / (2.0 * dpr)), f32(i) * 13.0));
        let len = 0.12 + 1.3 * h * h;
        let m = select(0.0, 1.0, base >= 0.0 || -base <= len);
        print_shade = select(1.0, 0.94 + 0.06 * clamp(1.0 + base / max(len, 0.01), 0.0, 1.0), base < 0.0);
        return vec4f(m, m, m, 0.0);
      }
      if (style == 1) {
        // Trame : les points grossissent jusqu'à se toucher, puis l'aplat.
        let cell = 9.0 * dpr;
        let q = vec2f(px.x + px.y, px.y - px.x) * 0.70710678 / cell;
        let d = length(fract(q) - 0.5) * 1.41421356;
        let cov = clamp(base * 1.1 + (vnoise(px / (40.0 * dpr)) - 0.5) * 0.3, 0.0, 1.0);
        let r = sqrt(cov) * 1.02;
        let aa = 1.4 / cell * dpr;
        let m = select(1.0 - smoothstep(r - aa, r + aa, d), 1.0, cov >= 0.999);
        return vec4f(m, m, m, 0.0);
      }
      if (style == 2) {
        // Quadrichromie : jaune, puis magenta, puis cyan. Le jaune retient le
        // bleu, le magenta le vert, le cyan le rouge : épreuves progressives.
        let g = vnoise(px / (26.0 * dpr)) - 0.5;
        let ty = base * 1.6 + g * 0.5;
        let my = smoothstep(-0.04, 0.04, ty);
        let mm = smoothstep(-0.04, 0.04, ty - 0.55);
        let mc = smoothstep(-0.04, 0.04, ty - 1.1);
        return vec4f(mc, mm, my, 0.0);
      }
      if (style == 3) {
        // Buvard : l'encre gagne par taches, avec un halo plus sombre.
        let blot = vnoise(px / (110.0 * dpr)) * 0.6 + vnoise(px / (23.0 * dpr)) * 0.3 + vnoise(px / (5.0 * dpr)) * 0.1;
        let t = base * 0.9 + (blot - 0.5) * 3.2;
        let m = smoothstep(-0.03, 0.03, t);
        let wet = (1.0 - smoothstep(0.0, 0.35, t)) * m * 1.6;
        return vec4f(m, m, m, wet);
      }
      if (style == 4) {
        // Massicot : une coupe nette, en biais, sans bavure.
        let tilt = (px.x / u.res.x - 0.5) * front * 0.18;
        let edge = c.z - rel - tilt;
        let m = clamp(edge / dpr + 0.5, 0.0, 1.0);
        let wet = (1.0 - smoothstep(0.0, 6.0 * dpr, edge)) * m * 2.5;
        return vec4f(m, m, m, wet);
      }
      if (style == 5) {
        // Fondu : ce que ferait une transition CSS. Un dégradé d'opacité.
        let m = smoothstep(0.0, 1.0, base);
        return vec4f(m, m, m, 0.0);
      }
      if (style == 6) {
        // Rouleau encreur : stries verticales d'un rouleau peu chargé, et
        // l'ombre du rouleau qui passe juste devant le front.
        let n = vnoise(vec2f(px.x / (2.5 * dpr), px.y / (160.0 * dpr))) * 0.7
              + vnoise(vec2f(px.x / (9.0 * dpr), px.y / (400.0 * dpr))) * 0.3;
        let t = base + (n - 0.5) * 1.4;
        let m = smoothstep(-0.05, 0.05, t);
        let wet = (1.0 - smoothstep(0.0, 0.5, t)) * m * 1.2;
        print_shade = 1.0 - 0.045 * (1.0 - smoothstep(0.0, 0.08, abs(base + 0.18)));
        return vec4f(m, m, m, wet);
      }
      if (style == 7) {
        // Composition : des blocs de plomb posés un à un, au hasard dans la
        // ligne ; frais, ils gardent un filet de papier et l'encre est dense.
        let cs = vec2f(15.0, 26.0) * dpr;
        let id = floor(vec2f(px.x, rel) / cs);
        let tb = (c.z - id.y * cs.y) / front - tr_hash(id) * 0.9;
        let m0 = step(0.0, tb);
        let f = fract(vec2f(px.x, rel) / cs) * cs;
        let gap = step(dpr, f.x) * step(dpr, f.y);
        let fresh = 1.0 - smoothstep(0.0, 0.35, tb);
        let m = m0 * mix(1.0, gap, fresh);
        return vec4f(m, m, m, fresh * m0 * 1.4);
      }
      if (style == 8) {
        // Ligne à ligne : comme une linotype, chaque ligne se compose de gauche
        // à droite, la suivante démarre avant la fin de la précédente.
        let rowH = 26.0 * dpr;
        let row = floor(rel / rowH);
        let prog = (c.z - row * rowH) / (rowH + front * 0.35);
        let xn = px.x / u.res.x;
        let m = 1.0 - smoothstep(prog - 0.004, prog, xn);
        // Curseur : un trait d'encre au bout de la ligne en cours.
        let caret = step(0.0, prog) * step(prog, 1.0) * (1.0 - smoothstep(0.0, 2.0 * dpr, abs(xn - prog) * u.res.x));
        print_shade = 1.0 - 0.75 * caret;
        return vec4f(m, m, m, 0.0);
      }
      if (style == 9) {
        // Révélateur : comme une épreuve dans le bain, les noirs montent
        // d'abord, puis les gris, puis les blancs ; le canal rouge traîne, si
        // bien que l'épreuve paraît d'abord rouge, comme sous la lampe inactinique.
        let lum = dot(col, vec3f(0.2126, 0.7152, 0.0722));
        let pl = dot(u.paper.rgb, vec3f(0.2126, 0.7152, 0.0722));
        let dark = clamp(1.0 - lum / pl, 0.0, 1.0);
        let t = base * 1.4 - (1.0 - dark) * 1.1 + (vnoise(px / (60.0 * dpr)) - 0.5) * 0.2;
        return vec4f(smoothstep(-0.1, 0.25, t - 0.14), smoothstep(-0.1, 0.25, t), smoothstep(-0.1, 0.25, t + 0.04), 0.0);
      }
      if (style == 10) {
        // Pli : la feuille se déplie. Ombre portée au creux du pli, filet de la
        // pliure, revers du papier un peu plus clair devant.
        let tilt = (px.x / u.res.x - 0.5) * front * 0.06;
        let e = c.z - rel - tilt;
        let m = clamp(e / dpr + 0.5, 0.0, 1.0);
        var sh = 1.0;
        if (e > 0.0) { sh = 1.0 - 0.2 * exp(-e / (18.0 * dpr)); }
        else { sh = 1.0 + 0.035 * exp(e / (40.0 * dpr)); }
        sh *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 1.2 * dpr, abs(e)));
        print_shade = sh;
        return vec4f(m, m, m, 0.0);
      }
      // Impression : front d'encre irrégulier, plus sombre là où il est humide.
      let grain = vnoise(px / (34.0 * dpr)) * 0.65 + vnoise(px / (7.0 * dpr)) * 0.35;
      let t = base + (grain - 0.5) * 1.6;
      let m = smoothstep(-0.08, 0.08, t);
      let wet = (1.0 - smoothstep(0.0, 0.9, t)) * m;
      return vec4f(m, m, m, wet);
    }
  }
  return vec4f(1.0, 1.0, 1.0, 0.0);
}

// Étape 5 : grain et fibre du papier.
fn ign(p: vec2f) -> f32 {
  return fract(52.9829189 * fract(dot(p, vec2f(0.06711056, 0.00583715))));
}

fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let s = f * f * (3.0 - 2.0 * f);
  let a = fract(sin(dot(i, vec2f(127.1, 311.7))) * 43758.5453);
  let b = fract(sin(dot(i + vec2f(1.0, 0.0), vec2f(127.1, 311.7))) * 43758.5453);
  let c = fract(sin(dot(i + vec2f(0.0, 1.0), vec2f(127.1, 311.7))) * 43758.5453);
  let d = fract(sin(dot(i + vec2f(1.0, 1.0), vec2f(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}


// ───── Chapitre 06 : filtres d'image, d'après Paper Shaders ─────
// Chaque filtre relit la cible à travers la même fonction source(), donc
// après bloom et repérage : ils s'insèrent dans la chaîne, pas à côté.

fn in_stage(px: vec2f, st: vec4f) -> vec2f {
  return clamp(px, st.xy + vec2f(1.0), st.xy + st.zw - vec2f(1.0));
}

fn luma(c: vec3f) -> f32 {
  return dot(c, vec3f(0.299, 0.587, 0.114));
}

fn bayer2(a: vec2f) -> f32 {
  let f = floor(a);
  return fract(f.x * 0.5 + f.y * f.y * 0.75);
}
fn bayer8(a: vec2f) -> f32 {
  let b4 = bayer2(a * 0.25) * 0.25 + bayer2(a * 0.5);
  return b4 * 0.25 + bayer2(a);
}

const INK_C: vec3f = vec3f(0.07, 0.07, 0.07);
const SPOT_C: vec3f = vec3f(0.78, 0.2, 0.11);

// Trame noire : une grille à 45°, un point par cellule.
fn f_dots(px: vec2f, st: vec4f, size: f32, amt: f32) -> vec3f {
  let cell = max(size * u.res.z, 2.0);
  let r = rot2(0.7854);
  let q = (r * (px - st.xy)) / cell;
  let cc = floor(q) + 0.5;
  let center = transpose(r) * (cc * cell) + st.xy;
  let v = 1.0 - luma(source(in_stage(center, st), vec2f(0.0))) / u.paper.g;
  let radius = sqrt(clamp(v * (0.6 + amt), 0.0, 1.0) / 3.14159) * 1.05;
  let aa = 0.75 / cell;
  let cov = 1.0 - smoothstep(radius - aa, radius + aa, length(q - cc));
  return mix(u.paper.rgb, INK_C, cov);
}

// Tramage ordonné (Bayer 8×8) en trois tons : papier, rouge d'atelier, noir.
// C'est la logique d'une risographie à deux tambours.
fn f_dither(px: vec2f, st: vec4f, size: f32, amt: f32) -> vec3f {
  let cell = max(size * 0.5, 1.0) * u.res.z;
  let block = floor((px - st.xy) / cell);
  let center = st.xy + (block + 0.5) * cell;
  let c = source(in_stage(center, st), vec2f(0.0));
  let v = clamp((1.0 - luma(c) / u.paper.g) * (0.7 + amt * 0.9), 0.0, 1.0) * 2.0;
  let level = floor(v + bayer8(block));
  if (level < 0.5) { return u.paper.rgb; }
  if (level < 1.5) { return SPOT_C; }
  return INK_C;
}

// Verre cannelé : des cannelures verticales qui réfractent ce qui est derrière.
fn f_flute(px: vec2f, st: vec4f, size: f32, amt: f32) -> vec3f {
  let w = max(size * 3.0, 6.0) * u.res.z;
  let x = (px.x - st.x) / w;
  let f = fract(x);
  let bend = (f - 0.5) * w * (0.6 + amt * 2.2);
  var col = source(in_stage(px + vec2f(bend, 0.0), st), vec2f(0.0));
  // Reflet sur l'arête de chaque cannelure, creux sombre entre deux.
  let shade = 1.0 + 0.10 * amt * sin(f * 6.2832 - 1.2) - 0.18 * amt * pow(abs(f - 0.5) * 2.0, 8.0);
  col *= shade;
  return col;
}

// Lentille : distorsion en barillet centrée sur le pointeur (ou la plaque),
// avec aberration chromatique : chaque canal a son propre indice.
fn f_lens(px: vec2f, st: vec4f, size: f32, amt: f32) -> vec3f {
  var c = st.xy + st.zw * 0.5;
  if (u.pointer.z > 0.5 && all(u.pointer.xy > st.xy) && all(u.pointer.xy < st.xy + st.zw)) {
    c = u.pointer.xy;
  }
  let radius = max(size * 26.0 * u.res.z, 60.0);
  let d = (px - c) / radius;
  let r2 = dot(d, d);
  let k = amt * 0.85;
  let fall = exp(-r2 * 1.2);
  let pr = c + d * radius * (1.0 - k * fall);
  let pg = c + d * radius * (1.0 - k * 0.92 * fall);
  let pb = c + d * radius * (1.0 - k * 0.84 * fall);
  return vec3f(
    source(in_stage(pr, st), vec2f(0.0)).r,
    source(in_stage(pg, st), vec2f(0.0)).g,
    source(in_stage(pb, st), vec2f(0.0)).b,
  );
}

// Papier froissé : relief de bruit, éclairé de biais, multiplié sur l'image.
fn crumple(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  for (var i = 0; i < 4; i++) {
    v += a * (1.0 - abs(vnoise(q) * 2.0 - 1.0));
    q = q * 2.03 + vec2f(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
fn f_paper(px: vec2f, st: vec4f, size: f32, amt: f32) -> vec3f {
  let s = max(size * 9.0, 20.0) * u.res.z;
  let p = (px - st.xy) / s;
  let e = 0.5 / s * u.res.z;
  let hx = crumple(p + vec2f(e, 0.0)) - crumple(p - vec2f(e, 0.0));
  let hy = crumple(p + vec2f(0.0, e)) - crumple(p - vec2f(0.0, e));
  let n = normalize(vec3f(-hx, -hy, 0.04 / (0.2 + amt)));
  let l = normalize(vec3f(-0.5, -0.7, 0.6));
  let light = clamp(dot(n, l), 0.0, 1.0);
  let col = source(in_stage(px, st), vec2f(0.0));
  return col * mix(1.0, 0.72 + light * 0.42, amt);
}

// Casse de plomb : chaque cellule devient le caractère dont la noirceur
// correspond à la sienne, tiré de l'atlas MTSDF des titres. Même corps pour
// tous, comme dans une vraie casse : le point reste petit, le M reste lourd.
fn f_casse(px: vec2f, st: vec4f, size: f32, amt: f32) -> vec3f {
  let cell = max(size * 2.2, 5.0) * u.res.z;
  let rel = px - st.xy;
  let block = floor(rel / cell);
  let center = st.xy + (block + 0.5) * cell;
  let c = source(in_stage(center, st), vec2f(0.0));
  let dark = clamp(1.0 - luma(c) / u.paper.g, 0.0, 1.0);
  let n = u.casse.x;
  let idx = i32(floor(dark * (n + 0.999)) - 1.0);
  if (idx < 0) { return u.paper.rgb; }
  let g = u.ramp[min(idx, i32(n) - 1)];
  let k = cell / (0.8 * u.casse.w);            // px écran par px d'atlas
  let local = rel - block * cell;               // px dans la cellule
  let q = (local - cell * 0.5) / k + g.zw * 0.5; // px dans le glyphe
  if (any(q < vec2f(0.0)) || any(q > g.zw)) { return u.paper.rgb; }
  let m = textureSampleLevel(msdf, samp, (g.xy + q) / u.casse.yz, 0.0).rgb;
  let med = max(min(m.r, m.g), min(max(m.r, m.g), m.b));
  // Bord analytique : 8 px d'atlas de distance, ramenés en px d'écran.
  let a = clamp((med - 0.5) * 8.0 * k + 0.5, 0.0, 1.0);
  let ink = mix(INK_C, c * 0.85, amt);
  return mix(u.paper.rgb, ink, a);
}

/* ───── Matières sur le HTML vivant (leçon 06.1) ─────
   D'après les composants Blaze, Clouds, Canvas, Droplets, Flame Wrap et Frost
   de canvasui.dev, réécrits ici en WGSL. Toutes lisent l'image déjà peinte
   (texte GPU, photos) et ne travaillent que dans leur plaque. */

fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  for (var i = 0; i < 4; i++) {
    v += a * vnoise(q);
    q = q * 2.02 + vec2f(3.1, 1.7);
    a *= 0.5;
  }
  return v;
}

// Couche de traces de la plaque en cours, choisie par le moteur (voir fs).
var<private> tr_layer: i32 = 0;

fn trace_at(px: vec2f, st: vec4f, _kind_layer: i32) -> vec4f {
  let q = clamp((px - st.xy) / st.zw, vec2f(0.0), vec2f(1.0));
  return textureSampleLevel(trace, samp, q, tr_layer, 0.0);
}

// Désintégration (matière « poussiere », d'après la démo Pixel Disintegration
// de html-in-canvas) : la plaque se défait en carrés de 5 px qui montent en
// dérivant, rétrécissent et pâlissent, de gauche à droite ; à rebours, ils
// reviennent. Chaque pixel cherche, parmi les cellules voisines d'en dessous,
// la particule qui passe sur lui.
fn dh(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(41.3, 289.1))) * 43758.5453); }
fn m_dust(px: vec2f, st: vec4f, prog: f32) -> vec3f {
  let dpr = u.res.z;
  let cell = 5.0 * dpr;
  let own = floor((px - st.xy) / cell);
  let ncol = st.z / cell;
  var col = u.paper.rgb;
  // La cellule du pixel, si elle n'est pas encore partie.
  let h0 = dh(own);
  let s0 = (own.x / max(ncol, 1.0)) * 0.6 + h0 * 0.25;
  if (prog <= s0) { return stage_src(px, st); }
  var best = -1.0;
  for (var dy = 0; dy <= 8; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      let id = own + vec2f(f32(dx), f32(dy));
      if (id.x < 0.0 || id.y < 0.0 || id.x * cell >= st.z || id.y * cell >= st.w) { continue; }
      let h = dh(id);
      let start = (id.x / max(ncol, 1.0)) * 0.6 + h * 0.25;
      let t = clamp((prog - start) / 0.35, 0.0, 1.0);
      if (t <= 0.0 || t >= 1.0) { continue; }
      let h2 = dh(id + 17.3);
      let drift = vec2f((h2 - 0.35) * 2.0, -(0.55 + 0.45 * dh(id + 3.1)) * 7.0) * cell * t * (0.6 + 0.4 * t);
      let c = st.xy + (id + 0.5) * cell + drift;
      let half = cell * 0.5 * (1.0 - 0.75 * t);
      if (all(abs(px - c) <= vec2f(half)) && t > best) {
        best = t;
        let src = stage_src(st.xy + (id + 0.5) * cell, st);
        col = mix(src, u.paper.rgb, t * t);
      }
    }
  }
  return col;
}

fn stage_src(p: vec2f, st: vec4f) -> vec3f {
  return source(in_stage(p, st), vec2f(0.0));
}

// Flou sur un disque de huit prises, plus le centre.
fn stage_blur(p: vec2f, st: vec4f, r: f32) -> vec3f {
  var acc = stage_src(p, st);
  for (var i = 0; i < 8; i++) {
    let a = f32(i) * 0.7854 + 0.3;
    acc += stage_src(p + vec2f(cos(a), sin(a)) * r, st);
  }
  return acc / 9.0;
}

fn sd_rbox(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

// Flammes : le feu lui-même est dessiné dans la scène, en HDR (voir FIRE).
// Ici, l'air chaud ondule au-dessus et la fumée voile le haut de la plaque.
fn m_flames(px: vec2f, st: vec4f, amt: f32) -> vec3f {
  let t = u.res.w;
  let dpr = u.res.z;
  let h = 1.0 - (px.y - st.y) / st.w;
  let s = px / (dpr * 46.0);
  let heat = (1.0 - smoothstep(0.05, 0.85, h)) * amt;
  let off = vec2f(fbm(s * 1.3 + vec2f(0.0, t * 1.8)) - 0.47, fbm(s * 1.3 + vec2f(5.2, t * 2.1)) - 0.47) * 12.0 * dpr * heat;
  var col = stage_src(px + off, st);
  let smoke = smoothstep(0.4, 0.78, fbm(s * 0.55 + vec2f(t * 0.05, t * 0.32))) * smoothstep(0.3, 0.75, h) * (1.0 - smoothstep(0.88, 1.0, h));
  return mix(col, col * vec3f(0.62, 0.6, 0.58), smoke * 0.35 * min(amt, 1.0));
}

// Brume : un voile épais qui floute et dévie ce qu'il couvre ; le pointeur
// souffle dedans, l'écarte et le pousse, puis la brume revient.
fn m_clouds(px: vec2f, st: vec4f, amt: f32) -> vec3f {
  let t = u.res.w;
  let dpr = u.res.z;
  let tr = trace_at(px, st, 1);
  let s = px / (dpr * 120.0) - tr.xy * 2.0 + vec2f(t * 0.03, t * 0.01);
  let d0 = fbm(s) * 0.65 + fbm(s * 2.7 + vec2f(-t * 0.05, 0.0)) * 0.35;
  let dens = smoothstep(0.3, 0.7, d0 + 0.08 * amt) * (1.0 - smoothstep(0.05, 0.7, tr.z)) * min(amt, 1.2);
  let e = 0.05;
  let gx = fbm(s + vec2f(e, 0.0)) - fbm(s - vec2f(e, 0.0));
  let gy = fbm(s + vec2f(0.0, e)) - fbm(s - vec2f(0.0, e));
  let off = vec2f(gx, gy) / e * 5.0 * dpr * dens;
  let blurred = stage_blur(px + off, st, 7.0 * dpr * dens);
  return mix(blurred, vec3f(0.968, 0.966, 0.958), clamp(dens * 0.75, 0.0, 0.92));
}

// Toile : le HTML peint sur une toile de lin tissée. Le pointeur traîne la
// peinture fraîche, qui garde des crêtes brillantes avant de sécher.
fn m_canvas(px: vec2f, st: vec4f, amt: f32) -> vec3f {
  let dpr = u.res.z;
  let tr = trace_at(px, st, 2);
  let drag = -tr.xy * st.zw * 0.25;
  let jitter = (vec2f(vnoise(px / (dpr * 3.0)), vnoise(px / (dpr * 3.0) + 9.1)) - 0.5) * 2.5 * dpr * amt;
  var col = stage_src(px + drag + jitter, st);
  let paperish = 1.0 - smoothstep(0.03, 0.12, distance(col, u.paper.rgb));
  col = mix(col, vec3f(0.85, 0.81, 0.72), paperish * min(amt, 1.0));
  // Tissage : un fil sur deux passe dessus, en damier.
  let g = px / (5.0 * dpr);
  let cell = floor(g);
  let f = fract(g);
  let over = (i32(cell.x) + i32(cell.y)) % 2 == 0;
  let thread = select(sin(f.x * 3.14159), sin(f.y * 3.14159), over);
  let slope = select(cos(f.x * 3.14159) * 0.6, cos(f.y * 3.14159) * 0.8, over);
  col *= mix(1.0, 0.88 + 0.14 * thread - 0.06 * slope, min(amt, 1.0));
  // Crêtes : relief tiré de la trace, éclairé de biais, avec un reflet humide.
  let b0 = tr.z;
  let bx = trace_at(px + vec2f(3.0 * dpr, 0.0), st, 2).z;
  let by = trace_at(px + vec2f(0.0, 3.0 * dpr), st, 2).z;
  let n = normalize(vec3f((b0 - bx) * 8.0, (b0 - by) * 8.0, 0.25));
  let l = normalize(vec3f(-0.5, -0.6, 0.62));
  let ridge = min(b0 * 3.0, 1.0);
  let spec = pow(max(dot(reflect(-l, n), vec3f(0.0, 0.0, 1.0)), 0.0), 24.0);
  col *= mix(1.0, 0.8 + 0.4 * dot(n, l), ridge);
  return col + vec3f(spec * 0.35 * ridge);
}

// Une couche de gouttes posées : une goutte au plus par cellule.
fn drop_cell(p: vec2f, cell: f32, seed: f32, density: f32) -> vec3f {
  let q = p / cell;
  let id = floor(q);
  if (tr_hash(id + seed) > density) { return vec3f(0.0); }
  let c = vec2f(tr_hash(id + seed + 1.3), tr_hash(id + seed + 4.7)) * 0.6 + 0.2;
  let r = 0.1 + tr_hash(id + seed + 8.1) * 0.22;
  let d = (fract(q) - c) * vec2f(1.0, 0.9);
  let len = length(d) / r;
  if (len > 1.0) { return vec3f(0.0); }
  return vec3f(d / r, 1.0 - smoothstep(0.8, 1.0, len));
}

// Gouttes : de la buée, des gouttes posées qui retournent l'image comme des
// lentilles, et des gouttes qui coulent en laissant une trace claire. Le
// pointeur essuie la vitre.
fn m_drops(px: vec2f, st: vec4f, amt: f32) -> vec3f {
  let t = u.res.w;
  let dpr = u.res.z;
  let local = px - st.xy;
  let wipe = smoothstep(0.1, 0.7, trace_at(px, st, 3).z);
  // Gouttes qui coulent, une par colonne.
  let colW = 64.0 * dpr;
  let ci = floor(local.x / colW);
  let hs = tr_hash(vec2f(ci, 3.3));
  let yh = fract(t * (0.06 + hs * 0.1) + hs) * (st.w + 80.0 * dpr) - 40.0 * dpr;
  let x0 = (ci + 0.5 + (tr_hash(vec2f(ci, 9.1)) - 0.5) * 0.5) * colW;
  let xh = x0 + sin(yh / (dpr * 40.0) + hs * 6.0) * 6.0 * dpr;
  let xt = x0 + sin(local.y / (dpr * 40.0) + hs * 6.0) * 6.0 * dpr;
  let trail = (1.0 - smoothstep(3.0 * dpr, 7.0 * dpr, abs(local.x - xt))) * step(local.y, yh) * smoothstep(yh - st.w * 0.7, yh, local.y);
  var lens = vec2f(0.0);
  var mask = 0.0;
  let head = (local - vec2f(xh, yh)) / (9.0 * dpr) * vec2f(1.0, 0.8);
  if (length(head) < 1.0) {
    lens = head;
    mask = 1.0 - smoothstep(0.8, 1.0, length(head));
  }
  let a = drop_cell(local, 30.0 * dpr, 1.0, 0.5 * (1.0 - trail));
  let b = drop_cell(local + vec2f(11.0, 5.0) * dpr, 12.0 * dpr, 5.0, 0.55);
  let c = drop_cell(local, 6.0 * dpr, 11.0, 0.7 * trail);
  for (var i = 0; i < 3; i++) {
    let d = select(select(c, b, i == 1), a, i == 0);
    if (d.z > mask) {
      mask = d.z;
      lens = d.xy;
    }
  }
  mask *= (1.0 - wipe) * min(amt, 1.0);
  let fog = 0.5 * min(amt, 1.0) * (1.0 - trail) * (1.0 - wipe);
  let behind = mix(stage_src(px, st), stage_blur(px, st, 4.0 * dpr), min(fog * 2.0, 1.0));
  let fogged = mix(behind, vec3f(0.95, 0.955, 0.96), fog * 0.6);
  // La goutte est une lentille : elle montre ce qui est derrière, retourné.
  var drop = stage_src(px - lens * 14.0 * dpr, st);
  let hl = smoothstep(0.55, 0.95, dot(normalize(lens + vec2f(1e-4)), vec2f(-0.6, -0.8))) * smoothstep(0.3, 0.8, length(lens));
  drop = drop * (0.8 + 0.2 * (1.0 - length(lens))) + vec3f(0.6) * hl;
  drop *= 1.0 - 0.35 * smoothstep(0.75, 1.0, length(lens)) * step(0.0, lens.y);
  return mix(fogged, drop, mask);
}

// Enveloppe de feu : la bordure est dessinée dans la scène (voir FIRE) ; ici,
// seulement l'air qui ondule autour.
fn m_wrap(px: vec2f, st: vec4f, amt: f32) -> vec3f {
  let t = u.res.w;
  let dpr = u.res.z;
  let pad = u.matter.y;
  let inner = vec4f(st.xy + vec2f(pad), st.zw - vec2f(pad * 2.0));
  let d = sd_rbox(px - (inner.xy + inner.zw * 0.5), inner.zw * 0.5, 4.0 * dpr) / dpr;
  if (d < 0.0) { return stage_src(px, st); }
  let s = vec2f(px.x / (dpr * 22.0), px.y / (dpr * 30.0) + t * 2.2);
  let off = (vec2f(fbm(s * 1.7), fbm(s * 1.7 + 4.0)) - 0.47) * 8.0 * dpr * (1.0 - smoothstep(0.0, 60.0, d)) * amt;
  return stage_src(px + off, st);
}

// Givre : une vitre gelée, des cristaux qui dévient et blanchissent l'image.
// Sous le pointeur elle fond, avec un bord d'eau ; puis elle regèle.
fn m_frost(px: vec2f, st: vec4f, amt: f32) -> vec3f {
  let dpr = u.res.z;
  let tr = trace_at(px, st, 5);
  let s = px / (dpr * 40.0);
  let crystal = pow(crumple(s), 3.0) * 0.6 + pow(crumple(s * 3.1 + vec2f(7.3, 1.1)), 4.0) * 0.5;
  let frost = smoothstep(0.35, 0.65, 1.0 - tr.z * 1.25 + (vnoise(px / (dpr * 14.0)) - 0.5) * 0.35) * min(amt, 1.2);
  let e = 0.05;
  let gx = crumple(s + vec2f(e, 0.0)) - crumple(s - vec2f(e, 0.0));
  let gy = crumple(s + vec2f(0.0, e)) - crumple(s - vec2f(0.0, e));
  let off = vec2f(gx, gy) / e * 3.0 * dpr * frost;
  var col = stage_blur(px + off, st, 5.0 * dpr * frost);
  col = mix(col, vec3f(0.92, 0.95, 0.99), clamp(frost * (0.42 + crystal * 0.45), 0.0, 0.95));
  col += vec3f(0.08) * crystal * frost;
  let edge = clamp(frost * (1.0 - frost) * 4.0, 0.0, 1.0);
  return mix(col, col * 0.84, edge * 0.5 * step(0.02, tr.z));
}

fn matter(kind: f32, px: vec2f, st: vec4f) -> vec3f {
  let amt = u.matter.x;
  if (kind < 4.5) { return m_flames(px, st, amt); }
  if (kind < 5.5) { return m_clouds(px, st, amt); }
  if (kind < 6.5) { return m_canvas(px, st, amt); }
  if (kind < 7.5) { return m_drops(px, st, amt); }
  if (kind < 8.5) { return m_wrap(px, st, amt); }
  return m_frost(px, st, amt);
}

/* ───── Écrans du sommaire ───── */

fn in_screen(px: vec2f) -> bool {
  let r = u.screen;
  return u.matter.z > 0.5 && r.z > 0.0 && all(px >= r.xy) && all(px < r.xy + r.zw);
}

// CRT : l'image est bombée ; hors de la dalle, le cadre noir (z = 1).
fn screen_warp(px: vec2f) -> vec3f {
  if (!in_screen(px) || u.matter.z > 1.5) {
    if (in_screen(px)) {
      // Projecteur : la pellicule flotte dans le couloir (gate weave).
      let t = u.res.w;
      let f = floor(t * 24.0);
      return vec3f(sin(t * 1.7) * 1.2 * u.res.z, (tr_hash(vec2f(f, 1.0)) - 0.5) * 2.0 * u.res.z + sin(t * 0.9) * 2.0 * u.res.z, 0.0);
    }
    return vec3f(0.0);
  }
  let r = u.screen;
  let q = (px - r.xy) / r.zw * 2.0 - 1.0;
  let k = vec2f(0.035, 0.05);
  let w = q * (1.0 + k * (q.yx * q.yx)) * 1.02;
  if (any(abs(w) > vec2f(1.0))) { return vec3f(0.0, 0.0, 1.0); }
  let np = r.xy + (w * 0.5 + 0.5) * r.zw;
  return vec3f(np - px, 0.0);
}

fn screen_finish(c: vec3f, px: vec2f) -> vec3f {
  if (!in_screen(px)) { return c; }
  let r = u.screen;
  let t = u.res.w;
  let dpr = u.res.z;
  let q = (px - r.xy) / r.zw * 2.0 - 1.0;
  var col = c;
  if (u.matter.z < 1.5) {
    // CRT : lignes de balayage, masque d'ouverture RVB, lueur et vignettage.
    let line = 0.5 + 0.5 * cos((px.y / dpr) * 3.14159 * 1.0);
    col *= 0.78 + 0.22 * line;
    let triad = i32(floor(px.x / max(1.0, dpr))) % 3;
    var mask = vec3f(0.86);
    if (triad == 0) { mask.r = 1.08; } else if (triad == 1) { mask.g = 1.08; } else { mask.b = 1.08; }
    col *= mask;
    col = col * 1.12 + vec3f(0.012, 0.016, 0.014);
    let flick = 1.0 + 0.012 * sin(t * 60.0);
    col *= flick * (1.0 - 0.38 * pow(length(q * vec2f(0.82, 0.9)), 3.0));
    // Barre de rafraîchissement qui descend lentement.
    let bar = fract(t * 0.12 - (px.y - r.y) / r.w);
    col *= 1.0 + 0.035 * smoothstep(0.9, 1.0, bar);
  } else {
    // Projecteur : sépia, scintillement, poussières, rayures, vignette ronde.
    let f = floor(t * 24.0);
    let l = dot(col, vec3f(0.299, 0.587, 0.114));
    let sepia = vec3f(l * 1.07, l * 0.93, l * 0.74) + vec3f(0.03, 0.02, 0.0);
    col = mix(col, sepia, 0.78);
    col *= 0.93 + 0.07 * tr_hash(vec2f(f, 7.0));
    let local = (px - r.xy) / dpr;
    let dust = step(0.9965, tr_hash(floor(local / 3.0) + vec2f(f * 1.7, f)));
    col = mix(col, vec3f(0.12, 0.1, 0.08), dust * 0.8);
    let sx = tr_hash(vec2f(f, 3.0)) * r.z / dpr;
    let scratch = (1.0 - smoothstep(0.0, 1.2, abs(local.x - sx))) * step(0.6, tr_hash(vec2f(f, 5.0)));
    col = mix(col, vec3f(0.96, 0.94, 0.88), scratch * 0.5);
    col *= 1.0 - 0.55 * pow(length(q * vec2f(0.9, 1.05)), 2.4);
  }
  return col;
}

fn image_filter(px: vec2f, st: vec4f) -> vec3f {
  let id = u.filt.x;
  let size = u.filt.y;
  let amt = u.filt.z;
  if (id < 0.5) { return f_dots(px, st, size, amt); }
  if (id < 1.5) { return f_dither(px, st, size, amt); }
  if (id < 2.5) { return f_flute(px, st, size, amt); }
  if (id < 3.5) { return f_lens(px, st, size, amt); }
  if (id < 4.5) { return f_paper(px, st, size, amt); }
  return f_casse(px, st, size, amt);
}

${CUI_WGSL}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let px = in.uv * u.res.xy;

  if (u.chain2.y > 0.5 && px.x < u.chain2.z) {
    // Vue coupée : la cible brute, sans aucune passe.
    var raw = textureSampleLevel(scene, samp, in.uv, 0.0).rgb;
    if (abs(px.x - u.chain2.z) < 1.0 * u.res.z) { raw = vec3f(0.07); }
    return vec4f(raw, 1.0);
  }

  // Dans quelle plaque de démonstration est ce pixel ?
  var kind = 0.0;
  var stage = vec4f(0.0);
  for (var i = 0; i < ${MAX_STAGES}; i++) {
    let s = u.stages[i];
    if (s.z > 0.0 && px.x >= s.x && px.y >= s.y && px.x < s.x + s.z && px.y < s.y + s.w) {
      // Type + 16 × couche de traces.
      let raw = kind_of(i);
      kind = raw - floor(raw / 16.0) * 16.0;
      tr_layer = i32(floor(raw / 16.0));
      stage = s;
    }
  }

  // Étape 1 : distorsion de lentille sous le pointeur, dans l'ouverture.
  var lens = vec2f(0.0);
  var inLens = 0.0;
  if (u.chain.x > 0.5 && kind > 0.5 && kind < 1.5 && u.pointer.z > 0.5) {
    let d = px - u.pointer.xy;
    let r = LENS_R * u.res.z;
    let t = length(d) / r;
    if (t < 1.0) {
      inLens = 1.0 - smoothstep(0.86, 1.0, t);
      lens = -d * (1.0 - t * t) * 0.32;
    }
  }

  // Sommaire : l'écran CRT bombe l'image, on relit donc la scène ailleurs.
  let scr = screen_warp(px);
  if (scr.z > 0.5) { return vec4f(0.025, 0.025, 0.028, 1.0); }
  lens += scr.xy;

  // Matière lentille, sur n'importe quel élément qui la porte.
  if (kind > 9.5 && kind < 10.5) {
    lens += lens_material(px, stage);
  }

  // Papier froissé : là où le pointeur est passé, la page entière se plie,
  // texte et images compris ; puis elle se défroisse.
  var creaseG = vec2f(0.0);
  var creaseM = 0.0;
  if (u.crease.x > 0.5) {
    creaseM = textureSampleLevel(trace, samp, px / u.res.xy, ${SCREEN_LAYER}, 0.0).z * u.crease.y;
    if (creaseM > 0.002) {
      creaseG = crease_grad(px);
      var off = creaseG * creaseM * 55.0 * u.res.z;
      let ol = length(off);
      if (ol > 11.0 * u.res.z) { off *= 11.0 * u.res.z / ol; }
      lens += off;
    }
  }

  // Tri de pixels : la traînée relit la ligne du front, plus haut.
  lens.y -= sort_pull(px);
  // Effets d'après Canvas UI : d'abord la déviation de la lecture.
  lens += cui_offset(px);
  var col = source(px, lens);

  if (kind > 2.5 && kind < 3.5) {
    col = image_filter(px, stage);
  } else if (kind > 3.5 && kind < 9.5) {
    col = matter(kind, px, stage);
  } else if (kind > 10.5 && kind < 11.5 && u.matter.w > 0.001) {
    col = m_dust(px, stage, u.matter.w);
  }
  // … puis la couleur.
  col = cui_color(px, col, lens);

  if (u.chain.z > 0.5) {
    if (kind > 0.5 && kind < 1.5) {
      let ht = halftone(px, lens, 5.5, 0.06, 0.12);
      col = mix(ht, col, inLens);
      // Liseré de la lentille, au trait d'encre.
      let ring = abs(length(px - u.pointer.xy) - LENS_R * u.res.z * 0.93);
      col = mix(col, vec3f(0.07), (1.0 - smoothstep(0.0, 1.2 * u.res.z, ring)) * step(0.01, inLens) * 0.8);
    } else if (kind > 1.5 && kind < 2.5) {
      let ht = halftone(px, vec2f(0.0), u.trame.x, u.trame.y, u.trame.z);
      col = mix(col, ht, u.trame.w);
    }
  }

  let pr = printed(px, col);
  if (min(pr.x, min(pr.y, pr.z)) < 0.999 || pr.w > 0.001) {
    // Bord humide : l'encre fraîche est plus dense. On renforce l'écart au
    // papier, pas la couleur : le papier vierge reste vierge.
    let wetCol = u.paper.rgb - (u.paper.rgb - col) * (1.0 + 0.6 * pr.w);
    col = mix(u.paper.rgb, wetCol, pr.xyz);
  }
  col *= print_shade;

  if (creaseM > 0.002) {
    // Éclairage rasant venu du haut à gauche sur le relief des plis.
    let n = normalize(vec3f(-creaseG * creaseM * 2.4, 1.0));
    let L = normalize(vec3f(-0.55, -0.65, 0.55));
    let shade = clamp(dot(n, L) / L.z, 0.62, 1.22);
    col *= shade;
  }
  if (u.tear.x > 0.5) {
    col = tear_edge(px, col);
  }

  if (u.chain2.x > 0.5) {
    let amp = u.chain2.x;
    // Fibre : bruit lent, seulement là où il y a du papier.
    let paperish = 1.0 - smoothstep(0.02, 0.08, distance(col, u.paper.rgb));
    let fiber = vnoise(px / (2.0 * u.res.z) + vec2f(0.0, vnoise(px / (60.0 * u.res.z)) * 6.0));
    col *= 1.0 - paperish * (fiber - 0.5) * 0.016 * amp;
    // Grain : bruit entrelacé, animé sauf en mouvement réduit.
    let tt = select(floor(u.res.w * 24.0), 0.0, u.pointer.w > 0.5);
    let n = ign(px + vec2f(tt * 5.588238, tt * 3.31));
    col += (n - 0.5) * 0.028 * amp;
  }

  // Cours d'accessibilité : encre délavée (pour faire échouer la mesure de
  // contraste), puis simulation de vision sur l'image finale.
  col = mix(col, u.paper.rgb, u.a11y.y);
  col = simulate_vision(clamp(col, vec3f(0.0), vec3f(1.0)), u.a11y.x);

  col = screen_finish(col, px);
  if (u.grid.x > 0.5) { col = grid_overlay(px, col); }
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);
}

fn to_linear(c: vec3f) -> vec3f {
  return select(pow((c + 0.055) / 1.055, vec3f(2.4)), c / 12.92, c <= vec3f(0.04045));
}
fn to_srgb(c: vec3f) -> vec3f {
  return select(1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, c * 12.92, c <= vec3f(0.0031308));
}

// Machado, Oliveira, Fernandes (2009), sévérité 1. Matrices en lumière
// linéaire, écrites ligne par ligne.
fn simulate_vision(srgb: vec3f, kind: f32) -> vec3f {
  if (kind < 0.5) { return srgb; }
  let c = to_linear(srgb);
  var r0 = vec3f(0.0);
  var r1 = vec3f(0.0);
  var r2 = vec3f(0.0);
  if (kind < 1.5) {
    r0 = vec3f(0.152286, 1.052583, -0.204868);
    r1 = vec3f(0.114503, 0.786281, 0.099216);
    r2 = vec3f(-0.003882, -0.048116, 1.051998);
  } else if (kind < 2.5) {
    r0 = vec3f(0.367322, 0.860646, -0.227968);
    r1 = vec3f(0.280085, 0.672501, 0.047413);
    r2 = vec3f(-0.011820, 0.042940, 0.968881);
  } else if (kind < 3.5) {
    r0 = vec3f(1.255528, -0.076749, -0.178779);
    r1 = vec3f(-0.078411, 0.930809, 0.147602);
    r2 = vec3f(0.004733, 0.691367, 0.303900);
  } else {
    let y = dot(c, vec3f(0.2126, 0.7152, 0.0722));
    return to_srgb(vec3f(y));
  }
  let o = vec3f(dot(r0, c), dot(r1, c), dot(r2, c));
  return to_srgb(clamp(o, vec3f(0.0), vec3f(1.0)));
}
`;
