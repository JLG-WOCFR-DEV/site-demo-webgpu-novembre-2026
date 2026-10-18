/**
 * Tous les shaders de PLI. Une seule convention : le moteur travaille en
 * pixels CSS relatifs au viewport ; la conversion en pixels physiques
 * (× dpr) et en NDC se fait dans les vertex shaders.
 *
 * Les couleurs restent encodées sRGB (comme en CSS) : le papier vaut la même
 * valeur ici que dans la feuille de style. La cible de scène est en
 * rgba16float pour que les hautes lumières des photos puissent dépasser 1.
 */

export const FRAME_STRUCT = /* wgsl */ `
struct Frame {
  viewport: vec4f, // cssW, cssH, dpr, time
  pointer: vec4f,  // x, y (css), inside, reduced
  glyph: vec4f,    // wave, ink, scatter, glyphBoxes
  misc: vec4f,     // atlasSize, hdr, paperLum, 0
};

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
  flags: vec4f,   // wire, mono, hover, hdr
};

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
  out.clip = to_clip(out.px, frame);
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
  let uv = mix(plane.uv.xy, plane.uv.zw, in.local);
  var col = textureSample(tex, samp, uv).rgb;

  if (plane.flags.y > 0.5) {
    // Atlas de champs de distance : on l'imprime encre sur papier.
    let v = textureSample(tex, samp, uv).r;
    col = mix(vec3f(0.937, 0.933, 0.910), vec3f(0.07), v);
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

  let a = fill * plane.params.w;
  return vec4f(col * a, a);
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
};

struct Elem {
  origin: vec2f,
  reveal: f32,
  fx: f32,       // 0 texte courant, 1 ouverture, 2 spécimen
  count: f32,
  alpha: f32,
  _p: vec2f,
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(1) @binding(0) var<storage, read> glyphs: array<Glyph>;
@group(1) @binding(1) var<storage, read> elems: array<Elem>;
@group(1) @binding(2) var samp: sampler;
@group(1) @binding(3) var atlas: texture_2d<f32>;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) local: vec2f,
  @location(3) @interpolate(flat) edge: f32,
  @location(4) @interpolate(flat) size: vec2f,
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
    // Ouverture : les lettres arrivent en ordre de lecture, puis s'écartent
    // du pointeur comme des caractères mobiles sous le doigt.
    let stagger = 0.75;
    reveal = clamp(e.reveal * (1.0 + stagger) - stagger * g.idx / max(e.count, 1.0), 0.0, 1.0);
    if (!reduced && frame.pointer.z > 0.5) {
      let d = center - frame.pointer.xy;
      let dist = length(d);
      let radius = 180.0;
      let k = pow(max(0.0, 1.0 - dist / radius), 2.0);
      center += normalize(d + vec2f(0.0001)) * k * 26.0;
      local = rot(k * 0.25 * sign(d.x + 0.0001)) * local;
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
  return out;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let d = textureSample(atlas, samp, in.uv).r;
  let w = max(fwidth(d) * 0.75, 0.002);
  var a = smoothstep(in.edge - w, in.edge + w, d) * in.color.a;
  var col = in.color.rgb;

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

/* ───────────────────────── Composite ───────────────────────── */

export const MAX_STAGES = 8;

export const COMPOSITE = /* wgsl */ `
${FULLSCREEN_VS}

struct Post {
  res: vec4f,      // pw, ph, dpr, time
  pointer: vec4f,  // x, y (px), inside, reduced
  chain: vec4f,    // distorsion, rvb, trame, bloom (0/1)
  chain2: vec4f,   // grain, split, splitX (px), intensité bloom
  trame: vec4f,    // cellule (px css), engraissement, repérage, mélange
  paper: vec4f,    // rgb du papier, glissement (vitesse de défilement −1…1)
  stages: array<vec4f, ${MAX_STAGES}>, // x, y, w, h en px
  kinds: array<vec4f, ${MAX_STAGES / 4}>,
};

@group(0) @binding(0) var<uniform> u: Post;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var scene: texture_2d<f32>;
@group(0) @binding(3) var bloom: texture_2d<f32>;

const LENS_R: f32 = 130.0;

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
      kind = kind_of(i);
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

  var col = source(px, lens);

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

  if (u.chain2.x > 0.5) {
    // Fibre : bruit lent, seulement là où il y a du papier.
    let paperish = 1.0 - smoothstep(0.02, 0.08, distance(col, u.paper.rgb));
    let fiber = vnoise(px / (2.0 * u.res.z) + vec2f(0.0, vnoise(px / (60.0 * u.res.z)) * 6.0));
    col *= 1.0 - paperish * (fiber - 0.5) * 0.016;
    // Grain : bruit entrelacé, animé sauf en mouvement réduit.
    let tt = select(floor(u.res.w * 24.0), 0.0, u.pointer.w > 0.5);
    let n = ign(px + vec2f(tt * 5.588238, tt * 3.31));
    col += (n - 0.5) * 0.028;
  }

  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;
