// Presse — glyphes : texte SDF (courant) et MTSDF (titres), apparition à l'encre, morphing.
//
// Portage du périmètre Carnet de src/gpu/wgsl.ts (GLYPH) : mêmes structures, mêmes formules, pour
// que la parité TS / Rust se mesure à l'image (roadmap § 3.5). Laissés de côté : lettres mobiles de
// l'ouverture, spécimen, typographie cinétique, débogage.
//
// Convention : pixels CSS relatifs au viewport ; la conversion en NDC se fait ici.

struct Frame {
  viewport: vec4f, // cssW, cssH, dpr, time
  pointer: vec4f,  // x, y (css), inside, reduced
  glyph: vec4f,    // wave, ink, scatter, glyphBoxes (inutilisés ici)
  misc: vec4f,     // atlasSize, hdr, paperLum, fil de fer
  motion: vec4f,   // vitesse de défilement, inertie, intensité du mouvement, 0
};

struct Glyph {
  pos: vec2f,    // coin haut-gauche du quad, relatif à l'élément (css)
  size: vec2f,   // taille du quad (css)
  uv: vec4f,     // rectangle d'atlas, normalisé
  color: u32,    // RGBA8
  elem: u32,
  idx: f32,      // rang du glyphe dans l'élément
  px: f32,       // < 0 : atlas multicanal (MTSDF)
  src: vec2f,    // morphing : d'où part la lettre (css, relatif à sa place)
  mk: f32,       // 0 fixe, 1 voyage, 2 apparaît, 3 s'efface
  md: f32,       // retard dans le morphing (0…1)
};

struct Elem {
  origin: vec2f,
  reveal: f32,
  fx: f32,
  count: f32,
  alpha: f32,
  morph: f32,    // progression du morphing de l'élément (0…1)
  kin: f32,
  ink: f32,      // Carnet : crayon → encre, 0 crayon … 1 encre (tracé de gauche à droite)
  wet: f32,      // Carnet : encre fraîche, 1 mouillée … 0 sèche
  seed: f32,     // graine de la matière
  _pad: f32,
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var<storage, read> glyphs: array<Glyph>;
@group(1) @binding(1) var<storage, read> elems: array<Elem>;
@group(1) @binding(2) var samp: sampler;
@group(1) @binding(3) var atlas: texture_2d<f32>;
@group(1) @binding(4) var msdf: texture_2d<f32>;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) @interpolate(flat) edge: f32,
  @location(3) @interpolate(flat) multi: f32,
  @location(4) @interpolate(flat) mat: vec2f,  // Carnet : crayon, encre mouillée (0…1) pour cette lettre
  @location(5) mpos: vec2f,                    // position dans l'élément (px css) + graine
};

fn to_clip(p: vec2f) -> vec4f {
  let ndc = vec2f(p.x / frame.viewport.x * 2.0 - 1.0, 1.0 - p.y / frame.viewport.y * 2.0);
  return vec4f(ndc, 0.0, 1.0);
}

fn corner(vi: u32) -> vec2f {
  // Ordre triangle-strip : (0,0) (1,0) (0,1) (1,1).
  return vec2f(f32(vi & 1u), f32(vi >> 1u));
}

fn hash11(n: f32) -> f32 {
  return fract(sin(n * 127.1) * 43758.5453);
}

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

  var center = e.origin + g.pos + g.size * 0.5;
  var local = (c - 0.5) * g.size;
  var reveal = e.reveal;

  if (g.mk > 0.5) {
    // Morphing : les lettres communes aux deux textes voyagent en arc vers leur nouvelle place,
    // les autres naissent ou s'effacent à l'encre.
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
  out.clip = to_clip(center + local);
  out.uv = mix(g.uv.xy, g.uv.zw, c);
  out.color = unpack4x8unorm(g.color) * e.alpha;
  // Seuil de bord du champ : 0,75 = contour exact de TinySDF ; au-dessus la lettre maigrit, à 1,4
  // elle a disparu (apparition à l'encre).
  out.edge = 0.75 + (1.0 - reveal) * 0.65;
  // Crayon → encre : la plume passe de gauche à droite, quatre lettres de fondu (carnet-fx.wgsl).
  let inked = clamp((e.ink * (e.count + 4.0) - g.idx) / 4.0, 0.0, 1.0);
  out.mat = vec2f(1.0 - inked, e.wet * inked);
  out.mpos = g.pos + c * g.size + vec2f(e.seed * 97.0, e.seed * 41.0);
  out.edge += cfx_edge(out.mat.x, out.mat.y, g.pos + vec2f(e.seed * 97.0, e.seed * 41.0));
  out.multi = select(0.0, 1.0, g.px < 0.0);
  return out;
}

fn sdf_cov(uv: vec2f, edge: f32, w: f32) -> f32 {
  return smoothstep(edge - w, edge + w, textureSampleLevel(atlas, samp, uv, 0.0).r);
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  // Les deux atlas sont lus sans condition (contrôle uniforme pour les dérivées).
  let single = textureSample(atlas, samp, in.uv).r;
  let m = textureSample(msdf, samp, in.uv).rgb;
  let med = max(min(m.r, m.g), min(max(m.r, m.g), m.b));
  let is_multi = in.multi > 0.5;
  let d = select(single, med, is_multi);
  let edge = select(in.edge, 0.5 + (in.edge - 0.75) * 0.85, is_multi);
  let w = max(fwidth(d) * 0.75, 0.002);
  // Texte courant : quatre lectures en grille tournée dans le pixel (les traits fins d'un champ
  // réduit ne disparaissent pas).
  let gx = dpdx(in.uv);
  let gy = dpdy(in.uv);
  let ws = max(w * 0.6, 0.002);
  let ss = sdf_cov(in.uv + gx * -0.125 + gy * -0.375, edge, ws)
    + sdf_cov(in.uv + gx * 0.375 + gy * -0.125, edge, ws)
    + sdf_cov(in.uv + gx * 0.125 + gy * 0.375, edge, ws)
    + sdf_cov(in.uv + gx * -0.375 + gy * 0.125, edge, ws);
  var a = select(ss * 0.25, smoothstep(edge - w, edge + w, d), is_multi) * in.color.a;
  var col = in.color.rgb;
  // Matières de Carnet (crayon, encre fraîche) : neutres sur une lettre normale (0, 0).
  let dg = vec2f(dpdx(d), dpdy(d));
  let gl = length(dg);
  let la = frame.motion.w;
  let cm = cfx_mat(in.mat.x, in.mat.y, in.mpos, col, d, edge, select(vec2f(0.0), dg / gl, gl > 1e-6), vec2f(cos(la), sin(la)));
  if (in.mat.x + in.mat.y > 0.001) {
    a *= cm.alpha;
    col = cm.col;
  }
  return vec4f(col * a, a);
}
