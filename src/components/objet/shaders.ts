/**
 * Objets — shaders. Trois temps :
 * 1. GBUF : l'objet est rendu une fois dans deux cibles (normale + masque,
 *    luminance éclairée + profondeur) ;
 * 2. STYLE : une passe plein écran relit ces cibles et dessine le style
 *    (ASCII, tramage, encre, verre, liquide) sur le fond de studio ;
 * 3. PARTICULES : une passe de calcul fait de chaque point de la surface un
 *    ressort vers sa place projetée, chassé par le pointeur ; puis on les dessine.
 */
export const MAX_TRAIL = 16;

export const GBUF = /* wgsl */ `
struct U { mvp: mat4x4f, model: mat4x4f, res: vec4f, misc: vec4f };
@group(0) @binding(0) var<uniform> u: U;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) n: vec3f,
  @location(1) z: f32,
};

@vertex
fn vs(@location(0) pos: vec3f, @location(1) nrm: vec3f) -> VsOut {
  var o: VsOut;
  o.clip = u.mvp * vec4f(pos, 1.0);
  o.n = (u.model * vec4f(nrm, 0.0)).xyz;
  o.z = o.clip.w;
  return o;
}

struct GOut { @location(0) g0: vec4f, @location(1) g1: vec4f };

@fragment
fn fs(in: VsOut, @builtin(front_facing) ff: bool) -> GOut {
  var n = normalize(in.n);
  // Face arrière vue (maillage ouvert ou mal orienté) : la normale se retourne vers l'objectif.
  if (!ff) { n = -n; }
  if (n.z < -0.05) { n = -n; }
  // Studio : une lumière principale en haut à gauche, un débouché doux, un liseré.
  let key = max(dot(n, normalize(vec3f(-0.55, 0.7, 0.55))), 0.0);
  let fill = 0.5 + 0.5 * n.y;
  let rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
  let lum = clamp(0.12 + key * 0.72 + fill * 0.16 + rim * 0.3, 0.0, 1.0);
  var o: GOut;
  o.g0 = vec4f(n * 0.5 + 0.5, 1.0);
  o.g1 = vec4f(lum, in.z, 0.0, 1.0);
  return o;
}

/** Verre : les faces arrière (la sortie de la lumière), normale sortante et profondeur. */
@fragment
fn fs_back(in: VsOut) -> @location(0) vec4f {
  return vec4f(normalize(in.n), in.z);
}
`;

export const STYLE = /* wgsl */ `
struct S {
  res: vec4f,     // largeur, hauteur (px), dpr, temps
  ptr: vec4f,     // pointeur x, y (px), présent, 0
  st: vec4f,      // style, taille des cellules, intensité, givre
  ink: vec4f,
  paper: vec4f,
  accent: vec4f,
  shadow: vec4f,  // centre x, y, rayons x, y (px) de l'ombre au sol
  misc: vec4f,    // hauteur de l'objet au-dessus du sol (0..1), nombre de glyphes, 0, 0
  cam: vec4f,     // tan(demi-champ vertical), proportion, profondeur du fond, 0
  glass: vec4f,   // indice de réfraction, dispersion, absorption, épaisseur par défaut
  trail: array<vec4f, ${MAX_TRAIL}>, // liquide : x, y, vx, vy (px, px/s)
};
@group(0) @binding(0) var<uniform> s: S;
@group(0) @binding(1) var g0: texture_2d<f32>;
@group(0) @binding(2) var g1: texture_2d<f32>;
@group(0) @binding(3) var back: texture_2d<f32>;
@group(0) @binding(4) var glyphs: texture_2d<f32>;
@group(0) @binding(5) var samp: sampler;
@group(0) @binding(6) var gb: texture_2d<f32>;

struct VsOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex
fn vs(@builtin(vertex_index) i: u32) -> VsOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VsOut;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), u.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn bayer8(p: vec2f) -> f32 {
  let x = u32(p.x) & 7u;
  let y = u32(p.y) & 7u;
  let v = x ^ y;
  // Entrelacement des bits (matrice de Bayer 8×8).
  let b = ((v & 1u) << 5u) | ((x & 1u) << 4u) | ((v & 2u) << 2u) | ((x & 2u) << 1u) | ((v & 4u) >> 1u) | ((x & 4u) >> 2u);
  return (f32(b) + 0.5) / 64.0;
}

fn G0(p: vec2f) -> vec4f {
  let q = clamp(vec2i(p), vec2i(0), vec2i(s.res.xy) - 1);
  return textureLoad(g0, q, 0);
}
fn G1(p: vec2f) -> vec4f {
  let q = clamp(vec2i(p), vec2i(0), vec2i(s.res.xy) - 1);
  return textureLoad(g1, q, 0);
}

/** Fond de studio : papier, vignette douce, ombre portée au sol. 1 = clair. */
fn studio(px: vec2f) -> f32 {
  let q = px / s.res.xy - 0.5;
  var v = 1.0 - dot(q, q) * 0.35;
  let d = (px - s.shadow.xy) / max(s.shadow.zw, vec2f(1.0));
  let sh = exp(-dot(d, d) * 1.6) * (0.55 - 0.3 * s.misc.x);
  return clamp(v - sh, 0.0, 1.0);
}

/** Valeur de l'image (0 sombre, 1 clair), objet ou fond. Pour les styles à
    seuil, le fond est tiré vers le blanc : seule l'ombre au sol reste. */
fn tone(p: vec2f) -> f32 {
  let a = G0(p);
  if (a.a > 0.5) { return G1(p).r; }
  return smoothstep(0.2, 0.92, studio(p));
}

fn glyph(local: vec2f, idx: f32) -> f32 {
  let n = s.misc.y;
  let gs = vec2f(textureDimensions(glyphs, 0));
  let cw = gs.x / n;
  let uv = vec2f((clamp(idx, 0.0, n - 1.0) + local.x) * cw, local.y * gs.y) / gs;
  return textureSampleLevel(glyphs, samp, uv, 0.0).a;
}

/* ───── Verre : deux surfaces, réfraction à l'entrée et à la sortie ───── */

/** La composition derrière le verre, à un point de l'écran (uv), floutée d'un niveau de mipmap (givre). */
fn behind(uv: vec2f, lod: f32) -> vec3f {
  return textureSampleLevel(back, samp, uv, lod).rgb * studio(clamp(uv, vec2f(0.0), vec2f(1.0)) * s.res.xy);
}
/** Point de la vue → écran (uv). La caméra regarde vers −z, à l'origine. */
fn toUv(p: vec3f) -> vec2f {
  let q = p.xy / max(-p.z, 1e-3) / (s.cam.x * vec2f(s.cam.y, 1.0));
  return vec2f(q.x * 0.5 + 0.5, 0.5 - q.y * 0.5);
}
/** Le studio vu en reflet : un mur clair, un sol plus sombre, deux boîtes à lumière nettes. */
fn studioEnv(r: vec3f) -> vec3f {
  let paper = s.paper.rgb;
  var c = mix(paper * 0.55, paper * 1.02, smoothstep(-0.4, 0.5, r.y));
  // Grande boîte à lumière en haut à gauche (un rectangle, bords francs : le reflet « produit »).
  let k = normalize(vec3f(-0.55, 0.62, 0.56));
  let kx = normalize(cross(vec3f(0.0, 1.0, 0.0), k));
  let ky = cross(k, kx);
  let d = dot(r, k);
  if (d > 0.0) {
    let q = vec2f(dot(r, kx), dot(r, ky)) / d;
    let box = (1.0 - smoothstep(0.42, 0.47, abs(q.x))) * (1.0 - smoothstep(0.26, 0.31, abs(q.y)));
    c += vec3f(2.4) * box;
  }
  // Bandeau vertical à droite (le liseré).
  let strip = (1.0 - smoothstep(0.04, 0.07, abs(r.x - 0.82))) * (1.0 - smoothstep(0.55, 0.75, abs(r.y)));
  c += vec3f(1.4) * strip * step(0.0, r.z + 0.3);
  return c;
}
fn glass(px: vec2f) -> vec3f {
  let uv = px / s.res.xy;
  // Givre : un niveau de mipmap ; un rien de flou dans l'épaisseur, même sans givre.
  let a = G0(px);
  if (a.a < 0.5) { return behind(uv, 0.0); }
  let nF = normalize(a.rgb * 2.0 - 1.0);
  let wF = G1(px).g;
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let D = vec3f(ndc * s.cam.x * vec2f(s.cam.y, 1.0), -1.0);
  let I = normalize(D);
  let PF = D * wF;
  let bk = textureLoad(gb, clamp(vec2i(px), vec2i(0), vec2i(s.res.xy) - 1), 0);
  let hasBack = bk.w > wF + 1e-3;
  let thick = select(s.glass.w, bk.w - wF, hasBack);
  let lod = s.st.w * 5.0 + 0.6 + thick * 0.8;
  let zbg = -s.cam.z;
  // Six longueurs d'onde : chacune son indice (le bleu dévie plus), pondérées vers R, V, B.
  var acc = vec3f(0.0);
  var wsum = vec3f(0.0);
  const NW = 6;
  for (var k = 0; k < NW; k++) {
    let t = (f32(k) + 0.5) / f32(NW);   // 0 : bleu … 1 : rouge
    let ior = s.glass.x + s.glass.y * (0.5 - t) * 2.0;
    let T1 = refract(I, nF, 1.0 / ior);
    // Traversée jusqu'à la face arrière, à la profondeur lue sous le point d'entrée.
    let PE = PF + T1 * (thick / max(-T1.z, 0.3));
    let ep = clamp(vec2i(toUv(PE) * s.res.xy), vec2i(0), vec2i(s.res.xy) - 1);
    let bE = textureLoad(gb, ep, 0);
    var nB = select(-nF, normalize(bE.xyz), bE.w > 0.0);
    // Sortie : la normale tournée vers le rayon ; réflexion totale si la sortie est impossible.
    var T2 = refract(T1, -nB, ior);
    if (dot(T2, T2) < 1e-4) { T2 = reflect(T1, -nB); }
    if (T2.z > -0.05) { T2 = normalize(vec3f(T2.xy, -0.05)); }
    let H = PE + T2 * ((zbg - PE.z) / T2.z);
    let c = behind(toUv(H), lod);
    let w = vec3f(max(0.0, 1.0 - abs(t - 0.88) * 2.4), max(0.0, 1.0 - abs(t - 0.5) * 2.4), max(0.0, 1.0 - abs(t - 0.12) * 2.4));
    acc += c * w;
    wsum += w;
  }
  var refr = acc / max(wsum, vec3f(1e-3));
  // Absorption (Beer-Lambert) : un verre à peine teinté, plus dense là où il est épais.
  refr *= exp(-thick * s.glass.z * vec3f(0.55, 0.22, 0.12));
  // Fresnel (Schlick) et reflet du studio.
  let cosI = clamp(dot(-I, nF), 0.0, 1.0);
  let F = 0.04 + 0.96 * pow(1.0 - cosI, 5.0);
  let R = reflect(I, nF);
  var col = mix(refr, studioEnv(R), F);
  // Le bord du verre accroche un peu d'encre (épaisseur vue par la tranche).
  col = mix(col, s.ink.rgb, smoothstep(0.25, 0.0, cosI) * 0.12);
  return col;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let px = in.uv * s.res.xy;
  let dpr = s.res.z;
  let t = s.res.w;
  let style = s.st.x;
  let ink = s.ink.rgb;
  let paper = s.paper.rgb;
  let a = G0(px);
  let mask = a.a;
  let n = a.rgb * 2.0 - 1.0;
  var col = paper * studio(px);

  if (style < 0.5) {
    // ASCII : une cellule, un caractère de la rampe, plus dense dans l'ombre.
    let cs = vec2f(8.0, 13.0) * dpr * s.st.y;
    let id = floor(px / cs);
    let c = (id + 0.5) * cs;
    let v = tone(c);
    let onObj = G0(c).a;
    let dark = clamp((1.0 - v) * mix(1.25, 1.0, onObj), 0.0, 1.0);
    let idx = floor(dark * (s.misc.y - 0.001));
    let g = glyph((px - id * cs) / cs, idx);
    let tint = mix(ink, s.accent.rgb, onObj * smoothstep(0.75, 0.95, v) * s.st.z);
    col = mix(paper, tint, g);
  } else if (style < 1.5) {
    // Tramage 1 bit : un seuil ordonné de Bayer sur des pixels de 3 px.
    let ps = 3.0 * dpr * s.st.y;
    let id = floor(px / ps);
    let v = tone((id + 0.5) * ps);
    let k = mix(0.5, 1.0, s.st.z);
    col = select(ink, paper, pow(v, k) > bayer8(id));
  } else if (style < 2.5) {
    // Encre : hachures croisées selon la valeur, contours au pinceau, papier.
    let v = tone(px);
    let dark = 1.0 - v;
    let sp = 6.0 * dpr * s.st.y;
    let w0 = vnoise(px / (40.0 * dpr)) * 0.6;
    var m = 0.0;
    let dirs = array<vec2f, 3>(vec2f(0.7071, 0.7071), vec2f(0.7071, -0.7071), vec2f(1.0, 0.0));
    let starts = array<f32, 3>(0.18, 0.45, 0.72);
    for (var k = 0; k < 3; k++) {
      let l = abs(fract(dot(px, dirs[k]) / sp + w0 + f32(k) * 0.33) - 0.5) * sp;
      let w = (dark - starts[k]) * sp * 0.55 + 0.3 * dpr;
      m = max(m, (1.0 - smoothstep(w - 0.6 * dpr, w + 0.6 * dpr, l)) * step(starts[k], dark));
    }
    // Contours : saut de profondeur ou de normale (Sobel léger), et la silhouette.
    let e = 1.5 * dpr;
    let dz = abs(G1(px + vec2f(e, 0.0)).g - G1(px - vec2f(e, 0.0)).g) + abs(G1(px + vec2f(0.0, e)).g - G1(px - vec2f(0.0, e)).g);
    let dn = length(G0(px + vec2f(e, 0.0)).rgb - G0(px - vec2f(e, 0.0)).rgb) + length(G0(px + vec2f(0.0, e)).rgb - G0(px - vec2f(0.0, e)).rgb);
    let sil = abs(G0(px + vec2f(e, 0.0)).a - G0(px - vec2f(e, 0.0)).a) + abs(G0(px + vec2f(0.0, e)).a - G0(px - vec2f(0.0, e)).a);
    let edge = clamp(dz * 6.0 + dn * 1.1 * mask + sil, 0.0, 1.0);
    m = max(m, smoothstep(0.25, 0.6, edge));
    // Encre pressée à la main : la densité varie, le papier a du grain.
    let press = 0.75 + 0.25 * vnoise(px / (9.0 * dpr) + 3.0);
    let paperGrain = 1.0 - 0.04 * vnoise(px / (2.0 * dpr));
    col = mix(paper * paperGrain, ink, m * press * s.st.z);
  } else if (style < 3.5) {
    col = glass(px);
  } else if (style < 4.5) {
    // Particules : le fond seul, l'objet devient des points (passe suivante).
    col = paper * studio(px);
  } else {
    // Liquide : l'objet en deux tons, entraîné par le pointeur ; la lumière se sépare.
    var off = vec2f(0.0);
    for (var i = 0; i < ${MAX_TRAIL}; i++) {
      let tr = s.trail[i];
      let v = tr.zw;
      let sp = length(v);
      if (sp < 1.0) { continue; }
      let d = px - tr.xy;
      let r = 140.0 * dpr * s.st.y;
      let w = exp(-dot(d, d) / (r * r));
      // Tourbillon autour du passage, et entraînement dans le sens du geste.
      off += (vec2f(-d.y, d.x) / r * sp * 0.05 + v * 0.06) * w * s.st.z;
    }
    let disp = 1.0 + 0.12 * s.st.z;
    let ar = G0(px - off);
    let ag = G0(px - off * disp);
    let ab = G0(px - off * disp * disp);
    let lr = select(studio(px), G1(px - off).r, ar.a > 0.5);
    let lg = select(studio(px), G1(px - off * disp).r, ag.a > 0.5);
    let lb = select(studio(px), G1(px - off * disp * disp).r, ab.a > 0.5);
    // Deux tons : l'ombre à l'encre, la lumière à la couleur d'accent ; chaque canal lu à son décalage.
    let duo = (1.0 - vec3f(lr, lg, lb));
    let objR = mix(s.accent.r, s.ink.r, smoothstep(0.35, 0.95, duo.r));
    let objG = mix(s.accent.g, s.ink.g, smoothstep(0.35, 0.95, duo.g));
    let objB = mix(s.accent.b, s.ink.b, smoothstep(0.35, 0.95, duo.b));
    let bgc = paper * studio(px);
    col = vec3f(select(bgc.r, objR + 0.25 * lr, ar.a > 0.5), select(bgc.g, objG + 0.25 * lg, ag.a > 0.5), select(bgc.b, objB + 0.25 * lb, ab.a > 0.5));
  }
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;

const P_HEAD = /* wgsl */ `
struct PU {
  mvp: mat4x4f,
  model: mat4x4f,
  res: vec4f,    // largeur, hauteur (px), dpr, temps
  ptr: vec4f,    // x, y (px), présent, force
  sim: vec4f,    // dt, raideur, amortissement, rayon (px)
  ink: vec4f,
};
struct P { pos: vec2f, vel: vec2f };
@group(0) @binding(0) var<uniform> u: PU;
@group(0) @binding(1) var<storage, read> rest: array<vec4f>;   // position (xyz) et normale compressée (w)
@group(0) @binding(2) var<storage, read> nrm: array<vec4f>;


`;

export const PARTICLES_SIM = /* wgsl */ `${P_HEAD}
@group(0) @binding(3) var<storage, read_write> ps: array<P>;
fn goal(i: u32) -> vec3f {
  let c = u.mvp * vec4f(rest[i].xyz, 1.0);
  let ndc = c.xy / c.w;
  return vec3f((ndc * vec2f(0.5, -0.5) + 0.5) * u.res.xy, c.w);
}

@compute @workgroup_size(256)
fn sim(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&rest)) { return; }
  let tg = goal(i).xy;
  var p = ps[i];
  if (p.pos.x < -1e5) { p.pos = tg; p.vel = vec2f(0.0); }
  let dt = u.sim.x;
  var acc = (tg - p.pos) * u.sim.y - p.vel * u.sim.z;
  if (u.ptr.z > 0.5) {
    let d = p.pos - u.ptr.xy;
    let l = max(length(d), 1.0);
    // Le pointeur chasse les points : une poussée qui s'éteint avec la distance.
    acc += d / l * u.ptr.w * exp(-l / u.sim.w) * 9000.0;
  }
  p.vel += acc * dt;
  p.pos += p.vel * dt;
  ps[i] = p;
}

`;

export const PARTICLES_DRAW = /* wgsl */ `${P_HEAD}
@group(0) @binding(3) var<storage, read> ps: array<P>;
struct VsOut { @builtin(position) clip: vec4f, @location(0) a: f32, @location(1) uv: vec2f };

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VsOut {
  let c = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) - 0.5;
  let p = ps[ii].pos;
  let n = normalize((u.model * vec4f(nrm[ii].xyz, 0.0)).xyz);
  let key = max(dot(n, normalize(vec3f(-0.55, 0.7, 0.55))), 0.0);
  // Points de dos : estompés ; points dans l'ombre : plus denses (plus d'encre).
  let facing = smoothstep(-0.2, 0.3, n.z);
  let size = (1.1 + 0.8 * (1.0 - key)) * u.res.z;
  let q = p + c * size * 2.0;
  var o: VsOut;
  o.clip = vec4f(q.x / u.res.x * 2.0 - 1.0, 1.0 - q.y / u.res.y * 2.0, 0.0, 1.0);
  o.a = (0.25 + 0.75 * facing) * (0.55 + 0.45 * (1.0 - key));
  o.uv = c * 2.0;
  return o;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let r = 1.0 - smoothstep(0.6, 1.0, length(in.uv));
  let a = r * in.a;
  return vec4f(u.ink.rgb * a, a);
}
`;
