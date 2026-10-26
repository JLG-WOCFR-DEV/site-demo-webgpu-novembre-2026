/**
 * L'orbite : un anneau de cartes en 3D, un disque de particules qui tourne
 * autour, et une mise au point (profondeur de champ).
 *
 * D'après « Black Hole Particles Bokeh » (michael0884, compute.toys #202,
 * vitrine de react-native-webgpu) pour le flou des particules : chaque
 * particule est un disque dont le rayon est son cercle de confusion, et dont
 * l'intensité baisse comme l'aire — une particule floue devient une grande
 * pastille pâle, une particule nette un point vif. Les cartes, elles, passent
 * par un flou de profondeur classique (un disque d'échantillons, « scatter as
 * gather ») lu dans la profondeur de la scène.
 *
 * Quatre passes : calcul des particules → scène (fond, cartes, profondeur) →
 * profondeur de champ → particules par-dessus (testées contre la profondeur
 * des cartes) → étalonnage dans le canvas.
 */

export const MAX_CARDS = 8;

const COMMON = /* wgsl */ `
struct U {
  viewProj: mat4x4f,
  view: mat4x4f,
  cam: vec4f,      // position caméra, temps
  sim: vec4f,      // dt, vitesse de l'anneau (rad/s), distance de mise au point, ouverture (px de flou à 1 m d'écart)
  screen: vec4f,   // largeur, hauteur (px), dpr, flou maximal (px)
  pointer: vec4f,  // point du monde sous le pointeur, actif
  attract: vec4f,  // centre de la carte qu'on ouvre, force
  ring: vec4f,     // rayon, angle de l'anneau, nombre de cartes, carte au premier plan
  clip: vec4f,     // near, far, mouvement (0 : réduit), énergie des particules
  colors: array<vec4f, ${MAX_CARDS}>,
  cards: array<vec4f, ${MAX_CARDS}>, // demi-largeur, demi-hauteur, proportion de l'image, mise en avant
};
@group(0) @binding(0) var<uniform> u: U;

const TAU = 6.28318530718;
fn hash(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }
/** Cercle de confusion en px (lentille mince) : nul au plan de netteté, croît avec l'écart rapporté à la distance. */
fn coc(z: f32) -> f32 {
  return min(u.screen.w, u.sim.w * abs(z - u.sim.z) / max(z, 0.05) * u.screen.z);
}
`;

/* ───── Particules : la simulation ───── */

export const SIM = /* wgsl */ `
${COMMON}
struct P { pos: vec4f, vel: vec4f };  // pos.w : vie ; vel.w : graine
@group(0) @binding(1) var<storage, read_write> parts: array<P>;

fn curl(p: vec3f, t: f32) -> vec3f {
  // Un champ tourbillonnaire bon marché : dérivées croisées de sinus décalés.
  let a = vec3f(sin(p.y * 1.3 + t * 0.21), sin(p.z * 1.1 - t * 0.17), sin(p.x * 1.7 + t * 0.13));
  let b = vec3f(cos(p.z * 0.9 - t * 0.11), cos(p.x * 1.2 + t * 0.19), cos(p.y * 1.5 - t * 0.23));
  return a.yzx * b.zxy - a.zxy * b.yzx;
}

@compute @workgroup_size(256)
fn sim(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= arrayLength(&parts)) { return; }
  var p = parts[i];
  let dt = u.sim.x * u.clip.z;
  let t = u.cam.w;
  let R = u.ring.x;
  var pos = p.pos.xyz;
  var vel = p.vel.xyz;
  let r = max(length(pos.xz), 0.05);
  // Orbite képlérienne autour de l'axe de l'anneau, entraînée par sa rotation (le vent).
  let tang = vec3f(-pos.z, 0.0, pos.x) / r;
  let omega = 0.32 * pow(R / r, 1.5) + u.sim.y * 0.55;
  var goal = tang * omega * r;
  // Turbulence, plus forte loin de l'anneau.
  goal += curl(pos * 0.55, t) * (0.10 + 0.08 * abs(r - R));
  // Le disque : rappel vers le plan et vers la bande [0.45 R, 2.4 R].
  goal.y -= pos.y * 0.9;
  goal += (pos / vec3f(r, 1.0, r)) * vec3f(1.0, 0.0, 1.0) * (clamp(r, 0.5 * R, 2.1 * R) - r) * 0.8;
  // Le pointeur écarte les particules autour de lui.
  if (u.pointer.w > 0.5) {
    let d = pos - u.pointer.xyz;
    let l = length(d);
    goal += d / max(l, 0.05) * 1.6 * exp(-l * l * 3.0);
  }
  // Ouverture d'une carte : tout le disque s'y engouffre.
  if (u.attract.w > 0.0) {
    let d = u.attract.xyz - pos;
    goal += normalize(d) * u.attract.w * 6.0 + cross(normalize(d), vec3f(0.0, 1.0, 0.0)) * u.attract.w * 2.0;
  }
  vel = mix(vel, goal, 1.0 - exp(-dt * 1.8));
  pos += vel * dt;
  var life = p.pos.w - dt * 0.05;
  // Renaissance : trop loin, trop près de l'axe, ou en fin de vie.
  if (life <= 0.0 || length(pos.xz) > 3.2 * R || abs(pos.y) > 1.5 * R) {
    let s = p.vel.w + t;
    let a = hash(vec3f(s, 1.0, f32(i))) * TAU;
    let rr = R * (0.55 + 1.5 * pow(hash(vec3f(f32(i), s, 2.0)), 0.8));
    pos = vec3f(cos(a) * rr, (hash(vec3f(s, f32(i), 3.0)) - 0.5) * 0.25 * rr / R, sin(a) * rr);
    vel = vec3f(-pos.z, 0.0, pos.x) / rr * 0.32 * pow(R / rr, 1.5) * rr;
    life = 0.6 + hash(vec3f(f32(i), 4.0, s));
  }
  parts[i] = P(vec4f(pos, life), vec4f(vel, p.vel.w));
}
`;

/* ───── Particules : le dessin, en pastilles de bokeh ───── */

export const DRAW = /* wgsl */ `
${COMMON}
struct P { pos: vec4f, vel: vec4f };
@group(0) @binding(1) var<storage, read> parts: array<P>;

struct VO {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) col: vec4f,  // couleur prémultipliée par l'énergie
  @location(2) blur: f32,
};

@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let p = parts[ii];
  let corner = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  let world = vec4f(p.pos.xyz, 1.0);
  var c = u.viewProj * world;
  let z = -(u.view * world).z;
  // Taille : un point net (≈ 1,6 px) agrandi de son cercle de confusion.
  let cc = coc(z);
  let size = 1.6 * u.screen.z + cc;
  c = vec4f(c.xy + corner * size / u.screen.xy * 2.0 * c.w, c.zw);
  // Couleur : celle de la carte la plus proche en angle, fondue avec sa voisine ; quelques étincelles blanches.
  let n = u.ring.z;
  let ang = atan2(p.pos.x, p.pos.z) - u.ring.y;
  let f = fract(ang / TAU) * n;
  let k0 = u32(floor(f)) % u32(n);
  let k1 = (k0 + 1u) % u32(n);
  var col = mix(u.colors[k0].rgb, u.colors[k1].rgb, smoothstep(0.35, 0.65, fract(f)));
  let seed = fract(p.vel.w * 0.618);
  col = mix(col, vec3f(1.0, 0.97, 0.92), step(0.86, seed));
  // L'énergie se conserve : une pastille deux fois plus large est quatre fois plus pâle.
  let base = 1.6 * u.screen.z;
  // Les particules tout près de l'objectif voilent l'image : elles s'effacent.
  let fade = smoothstep(0.0, 0.25, p.pos.w) * smoothstep(1.0, 3.2, z);
  let e = u.clip.w * (base * base) / (size * size) * fade * (0.55 + 0.9 * fract(seed * 7.0));
  var o: VO;
  o.clip = c;
  o.uv = corner;
  o.col = vec4f(col * e, e);
  o.blur = clamp(cc / 8.0, 0.0, 1.0);
  return o;
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let d = length(i.uv);
  // Un disque net au bord (la forme du diaphragme), un peu plus lumineux sur son pourtour quand il est flou.
  let disc = 1.0 - smoothstep(0.86, 1.0, d);
  let rim = 1.0 + 0.45 * i.blur * smoothstep(0.55, 0.95, d);
  let core = mix(exp(-d * d * 3.0), 1.0, i.blur);
  return i.col * disc * rim * core;
}
`;

/* ───── La scène : fond et cartes ───── */

export const SCENE = /* wgsl */ `
${COMMON}
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var photos: texture_2d_array<f32>;

struct BO { @builtin(position) clip: vec4f, @location(0) uv: vec2f };
@vertex fn vs_bg(@builtin(vertex_index) vi: u32) -> BO {
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  var o: BO;
  o.clip = vec4f(p, 1.0, 1.0);
  o.uv = p * vec2f(0.5, -0.5) + 0.5;
  return o;
}
@fragment fn fs_bg(i: BO) -> @location(0) vec4f {
  // Nuit profonde, une lueur de la couleur de la carte au premier plan.
  let front = u32(u.ring.w);
  let glow = u.colors[front].rgb;
  let q = (i.uv - vec2f(0.5, 0.56)) * vec2f(u.screen.x / u.screen.y, 1.0);
  let g = exp(-dot(q, q) * 2.6);
  let col = vec3f(0.018, 0.02, 0.03) + glow * g * 0.10;
  return vec4f(col, 1.0);
}

struct CO {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) @interpolate(flat) k: u32,
  @location(2) nv: f32,     // face vue de face (1) ou de dos (−1)
  @location(3) world: vec3f,
};

fn cardCenter(k: u32) -> vec3f {
  let a = u.ring.y + f32(k) / u.ring.z * TAU;
  return vec3f(sin(a), 0.0, cos(a)) * u.ring.x;
}

@vertex fn vs_card(@builtin(vertex_index) vi: u32, @builtin(instance_index) k: u32) -> CO {
  let a = u.ring.y + f32(k) / u.ring.z * TAU;
  let c = cardCenter(k);
  let right = vec3f(cos(a), 0.0, -sin(a));
  let corner = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  let card = u.cards[k];
  // La carte mise en avant sort un peu de l'anneau.
  let lift = vec3f(sin(a), 0.0, cos(a)) * card.w * 0.35;
  let w = c + lift + right * corner.x * card.x + vec3f(0.0, 1.0, 0.0) * corner.y * card.y;
  var o: CO;
  o.clip = u.viewProj * vec4f(w, 1.0);
  o.uv = corner * vec2f(0.5, -0.5) + 0.5;
  o.k = k;
  let n = vec3f(sin(a), 0.0, cos(a));
  o.nv = sign(dot(n, u.cam.xyz - w));
  o.world = w;
  return o;
}

fn rbox(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + r;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

@fragment fn fs_card(i: CO) -> @location(0) vec4f {
  let card = u.cards[i.k];
  // Coins arrondis : en dehors, on jette (la profondeur ne doit pas garder les coins).
  let px = (i.uv - 0.5) * card.xy * 2.0;
  let d = rbox(px, card.xy, 0.07);
  if (d > 0.0) { discard; }
  // Recadrage « cover » de la capture dans la carte.
  let box = card.x / card.y;
  var uv = i.uv;
  if (card.z > box) { uv.x = 0.5 + (uv.x - 0.5) * box / card.z; } else { uv.y = 0.5 + (uv.y - 0.5) * card.z / box; }
  // Vue de dos : l'image en miroir, sombre, comme à travers une vitre.
  if (i.nv < 0.0) { uv.x = 1.0 - uv.x; }
  var col = textureSampleLevel(photos, samp, uv, i.k, 0.0).rgb;
  let viewDir = normalize(u.cam.xyz - i.world);
  if (i.nv < 0.0) { col = col * 0.3 + u.colors[i.k].rgb * 0.06; }
  else {
    // Mise en avant : la carte s'allume ; les autres restent un peu dans l'ombre.
    col *= 0.62 + 0.38 * card.w;
  }
  // Liseré lumineux, de la couleur de l'app.
  let edge = 1.0 - smoothstep(0.0, 0.012, -d);
  col = mix(col, u.colors[i.k].rgb * 1.4, edge * (0.35 + 0.65 * card.w));
  return vec4f(col, 1.0);
}
`;

/* ───── Profondeur de champ (cartes et fond) ───── */

export const DOF = /* wgsl */ `
${COMMON}
@group(0) @binding(1) var sceneT: texture_2d<f32>;
@group(0) @binding(2) var depthT: texture_depth_2d;

struct BO { @builtin(position) clip: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> BO {
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  return BO(vec4f(p, 0.0, 1.0));
}

fn linZ(d: f32) -> f32 {
  let n = u.clip.x;
  let f = u.clip.y;
  return n * f / (f - d * (f - n));
}
fn zAt(p: vec2i) -> f32 {
  let d = textureLoad(depthT, p, 0);
  if (d >= 1.0) { return u.sim.z * 3.0; }  // le fond : loin derrière le plan de netteté
  return linZ(d);
}

@fragment fn fs(i: BO) -> @location(0) vec4f {
  let dims = vec2i(textureDimensions(sceneT));
  let p0 = vec2i(i.clip.xy);
  let z0 = zAt(p0);
  let c0 = coc(z0);
  var acc = textureLoad(sceneT, p0, 0).rgb;
  var wsum = 1.0;
  let maxR = u.screen.w;
  if (maxR < 0.5) { return vec4f(acc, 1.0); }
  // Disque de 40 échantillons (angle d'or). Un voisin compte s'il est assez flou pour couvrir ce pixel ;
  // un voisin plus lointain ne bave pas sur un premier plan net.
  const N = 40;
  for (var k = 1; k <= N; k++) {
    let r = sqrt(f32(k) / f32(N)) * maxR;
    let a = f32(k) * 2.39996323;
    let q = clamp(p0 + vec2i(vec2f(cos(a), sin(a)) * r), vec2i(0), dims - 1);
    let zs = zAt(q);
    var w = smoothstep(r - 1.5, r, coc(zs));
    if (zs > z0 + 0.05) { w *= smoothstep(r - 1.5, r, c0); }
    acc += textureLoad(sceneT, q, 0).rgb * w;
    wsum += w;
  }
  return vec4f(acc / wsum, 1.0);
}
`;

/* ───── Étalonnage, dans le canvas ───── */

export const GRADE = /* wgsl */ `
${COMMON}
@group(0) @binding(1) var hdrT: texture_2d<f32>;
struct BO { @builtin(position) clip: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> BO {
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  return BO(vec4f(p, 0.0, 1.0));
}
@fragment fn fs(i: BO) -> @location(0) vec4f {
  let p = vec2i(i.clip.xy);
  var c = textureLoad(hdrT, p, 0).rgb;
  // Courbe douce : les pastilles qui se superposent saturent sans brûler.
  c = c * (1.0 + c / 9.0) / (1.0 + c);
  let uv = i.clip.xy / u.screen.xy;
  let q = uv - 0.5;
  c *= 1.0 - dot(q, q) * 0.55;
  c += (hash(vec3f(i.clip.xy, fract(u.cam.w))) - 0.5) * 0.018;
  return vec4f(c, 1.0);
}
`;
