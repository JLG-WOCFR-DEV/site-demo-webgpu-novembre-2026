/**
 * L'orbite : quatre cartes (les applications) posées dans le disque
 * d'accrétion d'un trou noir, et une mise au point qui va de l'une à l'autre.
 *
 * Le disque est un portage fidèle de « Black Hole Particles Bokeh »
 * (michael0884, compute.toys #202 — la vitrine de react-native-webgpu) :
 *   la physique   chaque particule suit une géodésique de Kerr (trou noir en
 *                 rotation, coordonnées de Kerr-Schild), intégrée en
 *                 hamiltonien ; elle naît dans une boîte aplatie avec une
 *                 vitesse orbitale, s'enroule, précesse, tombe sous l'horizon
 *                 (r < 0,9) ou s'échappe (r > 30), et renaît ;
 *   la couleur    une teinte de l'arc-en-ciel lue dans la direction de sa
 *                 vitesse (± un tirage), d'où la roue de couleurs du disque ;
 *   le bokeh      un disque à bord net dont le rayon est l'écart à la mise au
 *                 point (2 × 0,743 px par unité, de 1,5 à 32 px), d'énergie
 *                 20 / R² : nette, une particule est un point vif ; floue,
 *                 une grande pastille pâle qui ne compte qu'en nombre ;
 *   l'exposition  1 − exp(−k·c), puis une gamma de 2,48 : le noir reste noir,
 *                 seules les accumulations brillent.
 * Les pixels de l'original sont ceux d'un rendu de 896 × 504 : on les garde
 * comme unité (« px de référence ») et on les met à l'échelle de l'écran,
 * pour que l'image soit la même à toutes les tailles.
 *
 * Ce qu'on y ajoute : les cartes (des panneaux face à la caméra, sur un anneau
 * dans le plan du disque), leur flou de profondeur (même loi que les
 * particules, voir SCENE), et la mise au
 * point qui suit la carte de face ou survolée. Glisser fait tourner la caméra
 * autour du trou noir, comme dans l'original.
 *
 * Passes : calcul des géodésiques → cartes (floues par construction, de la
 * plus lointaine à la plus proche) → cartes en profondeur seule, à la
 * résolution des particules → particules (additives, cachées par les cartes)
 * → exposition et composition dans le canvas.
 */

export const MAX_CARDS = 8;

const COMMON = /* wgsl */ `
struct U {
  viewProj: mat4x4f,
  view: mat4x4f,
  cam: vec4f,      // position caméra, temps (s)
  sim: vec4f,      // pas de temps, images à simuler, distance de mise au point, rayon de flou (px réf. par unité)
  screen: vec4f,   // largeur, hauteur (px), px par px de référence, flou maximal des cartes (px)
  pscreen: vec4f,  // largeur, hauteur du tampon des particules, px par px de référence, exposition
  kerr: vec4f,     // image n°, spin a, vitesse initiale, épaisseur initiale
  ring: vec4f,     // rayon de l'anneau, hauteur, nombre de cartes, carte de face
  clip: vec4f,     // near, far, gamma, mouvement (0 : réduit)
  colors: array<vec4f, ${MAX_CARDS}>,
  cards: array<vec4f, ${MAX_CARDS}>, // demi-largeur, demi-hauteur, proportion de l'image, mise en avant
};
@group(0) @binding(0) var<uniform> u: U;

const TAU = 6.28318530718;
fn hash(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }
fn pcg4d(a: vec4u) -> vec4u {
  var v = a * 1664525u + 1013904223u;
  v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
  v = v ^ (v >> vec4u(16u));
  v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
  return v;
}
fn rand4s(seed: vec4u) -> vec4f { return vec4f(pcg4d(seed)) / f32(0xffffffffu); }
/** Le flou en px de référence : l'écart à la mise au point, comme l'original. */
fn blurRef(z: f32) -> f32 { return 2.0 * u.sim.w * abs(z - u.sim.z); }
`;

/* ───── Les géodésiques de Kerr (portage de l'original) ───── */

export const SIM = /* wgsl */ `
${COMMON}
struct P { q: vec4f, p: vec4f };  // position (t, x, y, z) et impulsion
@group(0) @binding(1) var<storage, read_write> parts: array<P>;

const STEPS = 7;      // int(Steps · 16 + 1), Steps = 0,387
const KerrM = 1.0;
fn sqr(x: f32) -> f32 { return x * x; }
fn diag(a: vec4f) -> mat4x4f {
  return mat4x4f(a.x, 0.0, 0.0, 0.0, 0.0, a.y, 0.0, 0.0, 0.0, 0.0, a.z, 0.0, 0.0, 0.0, 0.0, a.w);
}
fn KerrGetR2(p: vec3f) -> f32 {
  let A = u.kerr.y;
  let rho = dot(p, p) - sqr(A);
  return 0.5 * (rho + sqrt(sqr(rho) + sqr(2.0 * A * p.z)));
}
fn KerrGetK(p: vec3f) -> vec4f {
  let A = u.kerr.y;
  let r2 = KerrGetR2(p);
  let r = sqrt(r2);
  let invr2 = 1.0 / (r2 + sqr(A) + 1e-3);
  let k = vec3f((r * p.x - A * p.y) * invr2, (r * p.y + A * p.x) * invr2, p.z / (r + 1e-4));
  let f = r2 * (2.0 * KerrM * r) / (r2 * r2 + sqr(A * p.z) + 1e-3);
  return vec4f(k, f);
}
/** La métrique de Kerr en coordonnées de Kerr-Schild, et son inverse. */
fn G(q: vec4f) -> mat4x4f {
  let k = KerrGetK(q.yzw);
  let kf = k.w * vec4f(1.0, k.xyz);
  return diag(vec4f(-1.0, 1.0, 1.0, 1.0)) + mat4x4f(kf, k.x * kf, k.y * kf, k.z * kf);
}
fn Ginv(q: vec4f) -> mat4x4f {
  let k = KerrGetK(q.yzw);
  let kf = k.w * vec4f(1.0, -k.xyz) / dot(k.xyz, k.xyz);
  return diag(vec4f(-1.0, 1.0, 1.0, 1.0)) + mat4x4f(-kf, k.x * kf, k.y * kf, k.z * kf);
}
fn Lmat(qt: vec4f, g: mat4x4f) -> f32 {
  return g[0][0] * qt.x * qt.x + g[1][1] * qt.y * qt.y + g[2][2] * qt.z * qt.z + g[3][3] * qt.w * qt.w +
    2.0 * (g[0][1] * qt.x * qt.y + g[0][2] * qt.x * qt.z + g[0][3] * qt.x * qt.w +
           g[1][2] * qt.y * qt.z + g[1][3] * qt.y * qt.w + g[2][3] * qt.z * qt.w);
}
fn HamiltonianGradient(q: vec4f, qt: vec4f, p: vec4f) -> vec4f {
  let H0 = Lmat(p, Ginv(q));
  let d = 0.1;
  return (vec4f(
    Lmat(qt, G(q + vec4f(d, 0.0, 0.0, 0.0))),
    Lmat(qt, G(q + vec4f(0.0, d, 0.0, 0.0))),
    Lmat(qt, G(q + vec4f(0.0, 0.0, d, 0.0))),
    Lmat(qt, G(q + vec4f(0.0, 0.0, 0.0, d)))) - H0) / d;
}

@compute @workgroup_size(64)
fn sim(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= arrayLength(&parts)) { return; }
  var q = parts[i].q;
  var p = parts[i].p;
  let frames = u32(u.sim.y);
  let f0 = u32(u.kerr.x);
  let speed = u.kerr.z;
  let thick = u.kerr.w;
  for (var f = 0u; f < frames; f++) {
    // Sous l'horizon ou trop loin : on renaît dans la boîte aplatie, en orbite.
    let r = sqrt(KerrGetR2(q.yzw));
    if (r < 0.9 || r > 30.0) {
      let rng = rand4s(vec4u(i, f0 + f, 17u, 1u));
      let rng1 = rand4s(vec4u(i, f0 + f, 29u, 2u));
      let nq = 30.0 * vec4f(1.0, 1.0, 1.0, thick) * vec4f(0.0, 2.0 * rng.xyz - 1.0);
      let r01 = sqrt(KerrGetR2(nq.yzw));
      q = nq;
      if (r01 < 0.9) { continue; }
      var v = normalize(cross(nq.yzw, vec3f(0.0, 0.0, 1.0)));
      v += 0.3 * (rng1.xyz * 0.5 - 0.25);
      let vscale = clamp(1.0 / (0.2 + 0.08 * r01), 0.0, 1.0);
      p = vec4f(-1.0, 2.0 * (speed - 0.5) * v * vscale);
    }
    // Intégration symplectique (à la façon de l'original : impulsion, puis position).
    var qt = Ginv(q) * p;
    for (var s = 0; s < STEPS; s++) {
      qt = Ginv(q) * p;
      let qt0 = qt;
      let dt = 0.5 * u.sim.x / (abs(qt.x) + 0.01);
      p += HamiltonianGradient(q, qt, p) * dt;
      qt = Ginv(q) * p;
      q += (qt + qt0) * dt;
    }
    p = p / length(qt);
  }
  parts[i] = P(q, p);
}
`;

/* ───── Les particules : des disques de bokeh ───── */

export const DRAW = /* wgsl */ `
${COMMON}
struct P { q: vec4f, p: vec4f };
@group(0) @binding(1) var<storage, read> parts: array<P>;

struct VO {
  @builtin(position) clip: vec4f,
  @location(0) px: vec2f,     // décalage au centre (px)
  @location(1) col: vec3f,    // couleur × énergie
  @location(2) disc: vec2f,   // rayon (px), largeur du bord (px)
};

fn hue(v: f32) -> vec3f { return 0.6 + 0.6 * cos(6.3 * v + vec3f(0.0, 23.0, 21.0)); }

@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let pr = parts[ii];
  // Le disque de Kerr est dans le plan (x, y), l'axe en z : on le couche (y en haut).
  let world = vec4f(pr.q.y, pr.q.w, pr.q.z, 1.0);
  let vel = vec3f(pr.p.y, pr.p.w, pr.p.z);
  var o: VO;
  let z = -(u.view * world).z;
  if (z < 0.5) { o.clip = vec4f(0.0, 0.0, 2.0, 1.0); return o; }
  let k = u.pscreen.z;
  let Rref = clamp(blurRef(z), 1.5, 32.0);
  let R = Rref * k;
  let aa = max(k, 0.75);
  let ext = R + aa;
  var ang = atan2(vel.x, vel.z + 0.000001) / 6.28;
  ang += (rand4s(vec4u(ii, 0u, 0u, 0u)).x - 0.5) * 0.33;
  let corner = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  var c = u.viewProj * world;
  c = vec4f(c.xy + corner * ext / u.pscreen.xy * 2.0 * c.w, c.zw);
  o.clip = c;
  o.px = corner * ext;
  o.col = hue(ang) * 20.0 / (Rref * Rref);
  o.disc = vec2f(R, aa);
  return o;
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  // Un disque plein, au bord net (la forme du diaphragme).
  let m = smoothstep(i.disc.x, i.disc.x - i.disc.y, length(i.px));
  return vec4f(i.col * m, 0.0);
}
`;

/* ───── Les cartes, floues par construction ───── */

/**
 * Une carte est un plan à profondeur presque constante : son image floue est
 * sa photo lissée (un niveau de mipmap plus haut) et son bord adouci sur la
 * largeur du cercle de confusion. Pas de passe de flou sur l'écran entier,
 * pas d'échos : un seul dessin par carte, avec la même loi de flou que les
 * particules.
 */
export const SCENE = /* wgsl */ `
${COMMON}
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var photos: texture_2d_array<f32>;

struct CO {
  @builtin(position) clip: vec4f,
  @location(0) local: vec2f,   // position dans la carte (unités du monde, centre 0)
  @location(1) @interpolate(flat) k: u32,
  @location(2) @interpolate(flat) blur: vec2f,  // flou en px, en unités du monde
};

fn cardCenter(k: u32) -> vec3f {
  // Au fond de l'anneau quand elle est choisie (en face de la caméra, de l'autre côté du trou noir).
  let a = f32(k) / u.ring.z * TAU;
  let c = vec3f(-sin(a) * u.ring.x, u.ring.y, -cos(a) * u.ring.x);
  // La carte mise en avant s'avance vers l'objectif.
  return c + normalize(u.cam.xyz - c) * u.cards[k].w * 1.6;
}

@vertex fn vs_card(@builtin(vertex_index) vi: u32, @builtin(instance_index) k: u32) -> CO {
  // Face à la caméra : les axes de l'image, lus dans la vue.
  let right = vec3f(u.view[0][0], u.view[1][0], u.view[2][0]);
  let up = vec3f(u.view[0][1], u.view[1][1], u.view[2][1]);
  let card = u.cards[k];
  let c = cardCenter(k);
  let z = max(0.5, -(u.view * vec4f(c, 1.0)).z);
  let coc = min(u.screen.w, blurRef(z) * u.screen.z);
  // Unités du monde par px à cette profondeur (focale en px : 630 px de référence).
  let wpp = z / (u.screen.z * 630.0);
  // Le quadrilatère déborde du flou, pour que le bord adouci y tienne.
  let half = card.xy + (coc + 2.0) * wpp;
  let corner = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  let w = c + right * corner.x * half.x + up * corner.y * half.y;
  var o: CO;
  o.clip = u.viewProj * vec4f(w, 1.0);
  o.local = corner * half;
  o.k = k;
  o.blur = vec2f(coc, max(coc, 0.75) * wpp);
  return o;
}

fn rbox(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + r;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

@fragment fn fs_card(i: CO) -> @location(0) vec4f {
  let card = u.cards[i.k];
  // Recadrage « cover » de la capture dans la carte.
  var uv = clamp(i.local / (card.xy * 2.0) * vec2f(1.0, -1.0) + 0.5, vec2f(0.0), vec2f(1.0));
  let box = card.x / card.y;
  if (card.z > box) { uv.x = 0.5 + (uv.x - 0.5) * box / card.z; } else { uv.y = 0.5 + (uv.y - 0.5) * card.z / box; }
  // Le flou de l'image : le niveau de mipmap monte avec le cercle de confusion.
  var col = textureSampleBias(photos, samp, uv, i.k, log2(max(1.0, i.blur.x * 1.3))).rgb;
  // La carte de face s'allume ; les autres restent dans la pénombre du disque.
  col *= 0.55 + 0.45 * card.w;
  let d = rbox(i.local, card.xy, 0.22);
  // Un liseré de la couleur de l'app, aussi flou que la carte.
  let line = max(0.05, i.blur.y);
  let edge = smoothstep(-line * 2.0, 0.0, d);
  col = mix(col, u.colors[i.k].rgb, edge * (0.45 + 0.55 * card.w));
  // Le bord : une rampe sur la largeur du flou. Les cartes non choisies sont des fantômes,
  // d'autant plus pâles qu'elles sont floues : l'horizon du trou noir reste noir.
  let ghost = 0.5 * (1.0 - 0.7 * smoothstep(4.0, 24.0, i.blur.x / u.screen.z));
  let a = (1.0 - smoothstep(-i.blur.y, i.blur.y, d)) * mix(ghost, 1.0, card.w);
  return vec4f(col * a, a);
}
/** Les mêmes cartes, en profondeur seule (forme nette), pour cacher les particules derrière elles. */
@fragment fn fs_card_depth(i: CO) -> @location(0) vec4f {
  // Seule la carte choisie, opaque, cache ce qui passe derrière elle.
  if (u.cards[i.k].w < 0.5 || rbox(i.local, u.cards[i.k].xy, 0.22) > 0.0) { discard; }
  return vec4f(0.0);
}
`;

/* ───── Exposition et composition, dans le canvas ───── */

export const GRADE = /* wgsl */ `
${COMMON}
@group(0) @binding(1) var cardsT: texture_2d<f32>;
@group(0) @binding(2) var partsT: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;
struct BO { @builtin(position) clip: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> BO {
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  return BO(vec4f(p, 0.0, 1.0));
}
@fragment fn fs(i: BO) -> @location(0) vec4f {
  let uv = i.clip.xy / u.screen.xy;
  // Les particules : l'exposition et la gamma de l'original.
  var c = textureSampleLevel(partsT, samp, uv, 0.0).rgb;
  c = 1.0 - exp(-u.pscreen.w * c);
  c = pow(c, vec3f(u.clip.z));
  // Les cartes dessous, en lumière « écran » : les particules passent devant sans les brûler.
  let base = clamp(textureLoad(cardsT, vec2i(i.clip.xy), 0).rgb, vec3f(0.0), vec3f(1.0));
  var o = 1.0 - (1.0 - base) * (1.0 - c);
  // Un souffle de grain, contre les marches dans les noirs.
  o += (hash(vec3f(i.clip.xy, fract(u.cam.w))) - 0.5) * 0.006;
  return vec4f(o, 1.0);
}
`;
