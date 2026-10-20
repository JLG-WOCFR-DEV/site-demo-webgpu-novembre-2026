/**
 * Kerguéhennec, huit regards. Une seule scène, huit rendus.
 *
 *  A. SCÈNE : lancer de rayons sur fonctions de distance. Le domaine est
 *     modélisé une fois (château, parterre, miroir d'eau, arbres, écuries,
 *     serre, grille, sculptures). Sortie : trois tampons (normale et
 *     profondeur ; matière, ombre, occlusion, reflet ; position).
 *  B. LUMIÈRE : éclairage propre à chaque style.
 *  C. STYLE : la passe qui fait le regard (touches, lavis, découpe, traits
 *     de cyanotype, virage d'époque, halo nocturne, plâtre, points).
 */

export const UNIFORMS = /* wgsl */ `
struct U {
  cam: vec4f,     // position, champ vertical (rad)
  tgt: vec4f,     // cible, 0
  res: vec4f,     // largeur, hauteur de la cible, temps, mouvement réduit
  sun: vec4f,     // direction vers la lumière, 0
  st: vec4f,      // style (0…7), entrée, transition (0…1), hauteur de coupe
  ep: vec4f,      // époque (0…4), dressage du livre (0…1), dispersion des points, 0
  lights: vec4f,  // nocturne : salon, ailes, écuries, lune ; cyanotype : poids des calques
  sunCol: vec4f,  // couleur de la lumière, 0
  sky0: vec4f,    // ciel à l'horizon
  sky1: vec4f,    // ciel au zénith
  fog: vec4f,     // couleur de brume, densité
  out: vec4f,     // largeur, hauteur de sortie, dpr, 0
};
@group(0) @binding(0) var<uniform> u: U;

fn h21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}
fn vn(p: vec2f) -> f32 {
  let i = floor(p);
  let q = fract(p);
  let s = q * q * (3.0 - 2.0 * q);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), s.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), s.x), s.y);
}
fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  for (var i = 0; i < 4; i++) {
    v += a * vn(q);
    q = q * 2.03 + vec2f(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

fn camera_ray(uv: vec2f) -> vec3f {
  // uv dans [-1, 1], y vers le haut.
  let fwd = normalize(u.tgt.xyz - u.cam.xyz);
  let right = normalize(cross(fwd, vec3f(0.0, 1.0, 0.0)));
  let up = cross(right, fwd);
  let th = tan(u.cam.w * 0.5);
  let aspect = u.res.x / u.res.y;
  return normalize(fwd + right * uv.x * aspect * th + up * uv.y * th);
}
`;

export const SCENE = /* wgsl */ `
${UNIFORMS}

/* ───── Primitives ───── */

fn sd_box(p: vec3f, b: vec3f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}
fn sd_box2(p: vec2f, b: vec2f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0);
}
// Toit en croupe posé sur un rectangle (demi-côtés a, b), pente s.
fn sd_hip(q: vec3f, a: f32, b: f32, s: f32) -> f32 {
  let k = 1.0 / sqrt(1.0 + s * s);
  let d1 = (abs(q.x) - a + q.y / s) * k;
  let d2 = (abs(q.z) - b + q.y / s) * k;
  return max(max(d1, d2), -q.y);
}
fn sd_ell(p: vec3f, r: vec3f) -> f32 {
  let k0 = length(p / r);
  return (k0 - 1.0) * min(r.x, min(r.y, r.z));
}
fn pick(a: vec2f, b: vec2f) -> vec2f {
  return select(a, b, b.x < a.x);
}

/* ───── Livre animé : chaque objet se couche sur la page autour de sa
   charnière (son pied, côté spectateur), puis se redresse. ───── */
fn fold(p: vec3f, hinge: vec3f) -> vec3f {
  let a = (1.0 - u.ep.y) * 1.5;
  if (a < 0.001) { return p; }
  let w = p - hinge;
  let c = cos(a);
  let s = sin(a);
  return vec3f(w.x, w.y * c + w.z * s, -w.y * s + w.z * c) + hinge;
}

/* ───── Coupe d'architecte ───── */
fn cut(d: f32, p: vec3f) -> f32 {
  return max(d, p.y - u.st.w);
}
// Murs creux : une coquille, des planchers, des refends, seulement si l'on coupe.
fn shell(walls: f32, p: vec3f, floorY: f32, step: f32) -> f32 {
  if (u.st.w > 4.0) { return walls; }
  var d = abs(walls + 0.08) - 0.08;
  let slab = max(abs(p.y - floorY) - 0.04, walls);
  let rx = p.x - step * round(p.x / step);
  let wall = max(abs(rx) - 0.04, walls);
  d = min(d, min(slab, wall));
  return d;
}

/* ───── Le château ───── */
fn chateau(p0: vec3f) -> vec2f {
  let p = fold(p0, vec3f(0.0, 0.0, 1.3));
  let bb = sd_box(p - vec3f(0.0, 1.6, 0.1), vec3f(3.6, 1.9, 1.3));
  if (bb > 0.6) { return vec2f(bb, 3.0); }
  let body = sd_box(p - vec3f(0.0, 0.95, 0.0), vec3f(2.55, 0.95, 0.8));
  let pav = sd_box(vec3f(abs(p.x) - 2.95, p.y - 1.0, p.z - 0.1), vec3f(0.5, 1.0, 0.95));
  let avc = sd_box(p - vec3f(0.0, 1.0, 0.1), vec3f(0.7, 1.0, 0.95));
  var walls = min(min(body, pav), avc);
  walls = shell(walls, p, 1.0, 1.04);
  // Fenêtres : onze travées, deux niveaux ; la porte au centre.
  let cellX = clamp(round(p.x / 0.52), -5.0, 5.0);
  let lx = p.x - cellX * 0.52;
  let ry = select(1.5, 0.58, p.y < 1.04);
  let hy = select(0.28, 0.34, p.y < 1.04);
  let hole = sd_box(vec3f(lx, p.y - ry, p.z - 1.0), vec3f(0.13, hy, 0.45));
  walls = max(walls, -hole);
  walls = cut(walls, p);
  var r = vec2f(walls, 3.0);
  let paneZ = select(0.68, 0.93, abs(p.x) < 0.72 || abs(p.x) > 2.42);
  let pane = sd_box(vec3f(lx, p.y - ry, p.z - paneZ), vec3f(0.13, hy, 0.012));
  r = pick(r, vec2f(cut(pane, p), 5.0));
  // Toits d'ardoise.
  let roofB = sd_hip(p - vec3f(0.0, 1.9, 0.0), 2.55, 0.8, 1.25);
  let roofP = sd_hip(vec3f(abs(p.x) - 2.95, p.y - 2.0, p.z - 0.1), 0.5, 0.95, 1.0);
  let roofs = cut(min(roofB, roofP), p);
  r = pick(r, vec2f(roofs, 4.0));
  // Fronton de l'avant-corps.
  let q = p - vec3f(0.0, 2.0, 1.0);
  let tri = max((abs(q.x) - 0.72 + q.y * 1.9) * 0.46, -q.y);
  r = pick(r, vec2f(cut(max(tri, abs(q.z) - 0.06), p), 3.0));
  // Cheminées.
  let cx = abs(p.x) - select(1.2, 2.0, abs(p.x) > 1.6);
  let chim = sd_box(vec3f(cx, p.y - 2.55, p.z + 0.1), vec3f(0.1, 0.3, 0.12));
  r = pick(r, vec2f(cut(chim, p), 3.0));
  // Perron.
  r = pick(r, vec2f(sd_box(p - vec3f(0.0, 0.06, 1.2), vec3f(0.9, 0.06, 0.25)), 3.0));
  return r;
}

/* ───── Arbres : rond, cèdre en étages, peuplier ───── */
fn tree(p0: vec3f, base: vec3f, r: f32, kind: i32) -> vec2f {
  if (r < 0.02) { return vec2f(1e3, 6.0); }
  let p = fold(p0, base);
  let q = p - base;
  let c = q - vec3f(0.0, r * 1.7, 0.0);
  let bound = length(c) - r * 2.3;
  if (bound > 0.4) { return vec2f(bound, 6.0); }
  let trunk = max(length(q.xz) - r * 0.08, abs(q.y - r * 0.8) - r * 0.8);
  var crown: f32;
  if (kind == 1) {
    crown = 1e3;
    for (var i = 0; i < 4; i++) {
      let fi = f32(i);
      let w = r * (1.3 - fi * 0.26);
      crown = min(crown, sd_ell(q - vec3f(0.0, r * (0.7 + fi * 0.5), 0.0), vec3f(w, r * 0.17, w)));
    }
  } else if (kind == 2) {
    crown = sd_ell(q - vec3f(0.0, r * 2.0, 0.0), vec3f(r * 0.38, r * 1.6, r * 0.38));
  } else {
    crown = sd_ell(c, vec3f(r, r * 0.92, r));
  }
  crown += (sin(q.x * 9.0 / r) * sin(q.y * 8.0 / r) * sin(q.z * 9.0 / r)) * 0.06 * r;
  return pick(vec2f(trunk, 7.0), vec2f(crown * 0.85, 6.0));
}

fn tree_scale(kind: i32) -> f32 {
  // Époque : 0 = 1710, 1 = 1872, 2 = 1910, 3 = 1986, 4 = aujourd'hui.
  let e = u.ep.x;
  if (kind == 0) {
    // Arbres du parc à l'anglaise : plantés par Bühler en 1872.
    return smoothstep(0.6, 1.0, e) * mix(0.35, 1.0, smoothstep(1.0, 3.0, e)) * (1.0 + 0.1 * smoothstep(3.0, 4.0, e));
  }
  // Allée d'entrée : plus ancienne, présente dès l'origine.
  return mix(0.45, 1.0, smoothstep(0.0, 2.5, e));
}

fn park(p: vec3f) -> vec2f {
  var r = vec2f(1e3, 6.0);
  let s = tree_scale(0);
  r = pick(r, tree(p, vec3f(-6.0, 0.0, -6.0), 1.3 * s, 0));
  r = pick(r, tree(p, vec3f(-3.2, 0.0, -7.8), 1.15 * s, 1));
  r = pick(r, tree(p, vec3f(4.2, 0.0, -6.6), 1.4 * s, 0));
  r = pick(r, tree(p, vec3f(6.8, 0.0, -4.2), 0.95 * s, 2));
  r = pick(r, tree(p, vec3f(-7.6, 0.0, 1.8), 1.05 * s, 0));
  r = pick(r, tree(p, vec3f(7.6, 0.0, 2.6), 1.2 * s, 1));
  r = pick(r, tree(p, vec3f(-8.6, 0.0, 7.4), 1.0 * s, 2));
  r = pick(r, tree(p, vec3f(8.8, 0.0, 9.5), 1.1 * s, 0));
  // L'avenue d'entrée : deux rangs d'arbres, répétés le long de l'allée.
  let sa = tree_scale(1);
  let zz = clamp(round((p.z - 14.0) / 2.3), 0.0, 4.0) * 2.3 + 14.0;
  let side = select(-1.0, 1.0, p.x > 0.0);
  r = pick(r, tree(p, vec3f(side * 2.5, 0.0, zz), 0.75 * sa, 0));
  return r;
}

/* ───── Parterre, bassin, miroir d'eau, sol ───── */
fn garden(p0: vec3f) -> vec2f {
  var r = vec2f(1e3, 9.0);
  for (var i = -1; i <= 1; i += 2) {
    let c = vec3f(f32(i) * 2.7, 0.0, 3.6);
    let p = fold(p0, c + vec3f(0.0, 0.0, 1.1));
    let bed = sd_box2(p.xz - c.xz, vec2f(1.55, 1.05));
    r = pick(r, vec2f(max(abs(bed) - 0.09, max(p.y - 0.22, -p.y)), 9.0));
    // Ifs taillés en cône aux angles.
    for (var j = -1; j <= 1; j += 2) {
      let b = c + vec3f(f32(j) * 1.55, 0.0, 1.05);
      let q = fold(p0, b) - b;
      let cone = max(length(q.xz) - 0.24 * (1.0 - q.y / 0.95), max(-q.y, q.y - 0.95)) * 0.8;
      r = pick(r, vec2f(cone, 9.0));
    }
  }
  // Bassin rond.
  let bq = p0 - vec3f(0.0, 0.0, 3.6);
  r = pick(r, vec2f(max(abs(length(bq.xz) - 0.7) - 0.07, max(p0.y - 0.14, -p0.y)), 3.0));
  r = pick(r, vec2f(max(p0.y - 0.07, length(bq.xz) - 0.64), 8.0));
  return r;
}

fn ground(p: vec3f) -> vec2f {
  // Le miroir d'eau est creusé dans la pelouse.
  let lake = sd_box2(p.xz - vec2f(0.0, 9.5), vec2f(5.5, 3.0));
  let g = max(p.y, -lake);
  let w = max(p.y + 0.06, lake);
  return pick(vec2f(g, 1.0), vec2f(w, 8.0));
}

/* ───── Écuries, serre, grille ───── */
fn ecuries(p0: vec3f) -> vec2f {
  let p = fold(p0, vec3f(-9.5, 0.0, -2.3));
  let q = p - vec3f(-9.5, 0.0, -3.0);
  let bb = sd_box(q - vec3f(0.0, 1.0, 0.0), vec3f(3.3, 1.4, 1.0));
  if (bb > 0.6) { return vec2f(bb, 3.0); }
  var walls = sd_box(q - vec3f(0.0, 0.62, 0.0), vec3f(3.0, 0.62, 0.65));
  walls = shell(walls, q, 2.0, 1.0);
  let cellX = clamp(round(q.x / 1.0), -2.0, 2.0);
  let lx = q.x - cellX * 1.0;
  let arch = min(sd_box(vec3f(lx, q.y - 0.3, q.z - 0.65), vec3f(0.28, 0.3, 0.2)), length(vec2f(lx, q.y - 0.6)) - 0.28);
  walls = max(walls, -max(arch, abs(q.z - 0.65) - 0.2));
  var r = vec2f(cut(walls, p), 3.0);
  r = pick(r, vec2f(cut(sd_hip(q - vec3f(0.0, 1.24, 0.0), 3.0, 0.65, 1.3), p), 4.0));
  // Campanile.
  r = pick(r, vec2f(cut(sd_box(q - vec3f(0.0, 1.85, 0.0), vec3f(0.22, 0.32, 0.22)), p), 3.0));
  r = pick(r, vec2f(cut(sd_hip(q - vec3f(0.0, 2.17, 0.0), 0.24, 0.24, 1.6), p), 4.0));
  // Lanternes (allumées la nuit).
  let lq = vec3f(q.x - clamp(round(q.x / 2.0), -1.0, 1.0) * 2.0, q.y - 0.95, q.z - 0.74);
  r = pick(r, vec2f(length(lq) - 0.07, 16.0));
  return r;
}

fn serre(p0: vec3f) -> vec2f {
  // Elle n'existe pas encore en 1710.
  let grow = smoothstep(0.5, 1.0, u.ep.x);
  if (grow < 0.01) { return vec2f(1e3, 11.0); }
  let p = fold(p0, vec3f(8.5, 0.0, -1.4));
  let q = (p - vec3f(8.5, 0.0, -2.5)) * vec3f(1.0, 1.0 / grow, 1.0);
  let vault = max(max(length(q.yz) - 1.0, abs(q.x) - 1.6), -q.y) * grow;
  let rx = q.x - 0.4 * round(q.x / 0.4);
  let ribs = max(max(abs(length(q.yz) - 1.0) - 0.035, abs(rx) - 0.025), max(abs(q.x) - 1.62, -q.y)) * grow;
  return pick(vec2f(cut(vault, p), 11.0), vec2f(cut(ribs, p), 10.0));
}

fn grille(p0: vec3f) -> vec2f {
  let p = fold(p0, vec3f(0.0, 0.0, 15.7));
  let q = p - vec3f(0.0, 0.0, 15.5);
  let bb = sd_box(q - vec3f(0.0, 1.0, 0.0), vec3f(2.1, 1.3, 0.4));
  if (bb > 0.5) { return vec2f(bb, 3.0); }
  let pil = sd_box(vec3f(abs(q.x) - 1.7, q.y - 0.95, q.z), vec3f(0.22, 0.95, 0.22));
  var r = vec2f(pil, 3.0);
  r = pick(r, vec2f(length(vec3f(abs(q.x) - 1.7, q.y - 2.08, q.z)) - 0.17, 3.0));
  let top = 1.55 + 0.25 * cos(q.x / 1.45 * 1.5708);
  let rx = q.x - 0.14 * round(q.x / 0.14);
  let bars = max(max(length(vec2f(rx, q.z)) - 0.018, abs(q.x) - 1.46), max(-q.y, q.y - top));
  r = pick(r, vec2f(bars, 10.0));
  let rails = max(max(abs(q.y - 0.25) - 0.03, abs(q.x) - 1.46), abs(q.z) - 0.03);
  r = pick(r, vec2f(rails, 10.0));
  return r;
}

/* ───── Sculptures du parc (à partir de 1986) : formes génériques. ───── */
fn sculptures(p: vec3f) -> vec2f {
  let g = smoothstep(2.5, 3.0, u.ep.x);
  if (g < 0.01) { return vec2f(1e3, 12.0); }
  // Cercle de pierres dressées.
  let q = p - vec3f(8.2, 0.0, 5.6);
  let a = atan2(q.z, q.x);
  let sec = 6.2832 / 9.0;
  let ai = round(a / sec) * sec;
  let lq = vec3f(cos(ai) * q.x + sin(ai) * q.z - 1.1, q.y, -sin(ai) * q.x + cos(ai) * q.z);
  let stone = sd_box(lq - vec3f(0.0, 0.3 * g, 0.0), vec3f(0.1, 0.3 * g, 0.16));
  var r = vec2f(stone, 12.0);
  // Colonne de bronze torse.
  let c = p - vec3f(-7.4, 0.0, 5.2);
  let tw = c.y * 2.0;
  let cc = vec2f(c.x * cos(tw) - c.z * sin(tw), c.x * sin(tw) + c.z * cos(tw));
  let col = max(sd_box2(cc, vec2f(0.1, 0.06)), max(-c.y, c.y - 2.4 * g)) * 0.7;
  r = pick(r, vec2f(col, 13.0));
  return r;
}

fn map(p: vec3f) -> vec2f {
  var r = ground(p);
  r = pick(r, chateau(p));
  r = pick(r, garden(p));
  r = pick(r, park(p));
  r = pick(r, ecuries(p));
  r = pick(r, serre(p));
  r = pick(r, grille(p));
  r = pick(r, sculptures(p));
  return r;
}

fn normal_at(p: vec3f) -> vec3f {
  let e = vec2f(0.004, 0.0);
  return normalize(vec3f(
    map(p + e.xyy).x - map(p - e.xyy).x,
    map(p + e.yxy).x - map(p - e.yxy).x,
    map(p + e.yyx).x - map(p - e.yyx).x,
  ));
}

struct Hit {
  t: f32,
  mat: f32,
};

fn march(ro: vec3f, rd: vec3f, tmax: f32) -> Hit {
  var t = 0.02;
  for (var i = 0; i < 140; i++) {
    let r = map(ro + rd * t);
    if (r.x < 0.0015 * t) { return Hit(t, r.y); }
    t += r.x * 0.9;
    if (t > tmax) { break; }
  }
  return Hit(-1.0, 0.0);
}

fn soft_shadow(ro: vec3f, rd: vec3f) -> f32 {
  var res = 1.0;
  var t = 0.05;
  for (var i = 0; i < 40; i++) {
    let h = map(ro + rd * t).x;
    res = min(res, 9.0 * h / t);
    t += clamp(h, 0.03, 0.6);
    if (res < 0.01 || t > 22.0) { break; }
  }
  return clamp(res, 0.0, 1.0);
}

fn occlusion(p: vec3f, n: vec3f) -> f32 {
  var occ = 0.0;
  var w = 1.0;
  for (var i = 1; i <= 5; i++) {
    let h = 0.06 * f32(i);
    occ += (h - map(p + n * h).x) * w;
    w *= 0.7;
  }
  return clamp(1.0 - occ * 2.4, 0.0, 1.0);
}

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  let c = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u));
  var out: VsOut;
  out.clip = vec4f(c * 2.0 - 1.0, 0.0, 1.0);
  out.uv = c * 2.0 - 1.0;
  return out;
}

struct GOut {
  @location(0) nd: vec4f,   // normale (ou direction du ciel), distance
  @location(1) ms: vec4f,   // matière, ombre, occlusion, 0
  @location(2) pos: vec4f,  // position du point vu, reflet de l'eau (0…1)
};

@fragment
fn fs(in: VsOut) -> GOut {
  let ro = u.cam.xyz;
  let rd = camera_ray(in.uv);
  var out: GOut;
  let h = march(ro, rd, 90.0);
  if (h.t < 0.0) {
    out.nd = vec4f(rd, 1e4);
    out.ms = vec4f(0.0, 1.0, 1.0, 0.0);
    out.pos = vec4f(ro + rd * 90.0, 0.0);
    return out;
  }
  var p = ro + rd * h.t;
  var n = normal_at(p);
  var mat = h.mat;
  var refl = 0.0;
  let L = normalize(u.sun.xyz);
  if (mat > 7.5 && mat < 8.5) {
    // Eau : on suit le rayon réfléchi, ridé d'un souffle, et l'on rend ce
    // qu'il touche ; la passe de lumière teinte le tout.
    let t = u.res.z;
    let ripple = vec3f(vn(p.xz * 3.0 + t * 0.4) - 0.5, 0.0, vn(p.xz * 3.0 + 7.0 - t * 0.3) - 0.5) * 0.06;
    let wn = normalize(vec3f(0.0, 1.0, 0.0) + ripple);
    let rr = reflect(rd, wn);
    refl = 0.25 + 0.75 * pow(1.0 - max(dot(-rd, wn), 0.0), 3.0);
    let h2 = march(p + wn * 0.03, rr, 60.0);
    if (h2.t < 0.0) {
      out.nd = vec4f(rr, h.t);
      out.ms = vec4f(0.0, 1.0, 1.0, 0.0);
      out.pos = vec4f(p, refl);
      return out;
    }
    p = p + wn * 0.03 + rr * h2.t;
    n = normal_at(p);
    mat = h2.mat;
  }
  let sh = soft_shadow(p + n * 0.02, L);
  let ao = occlusion(p, n);
  out.nd = vec4f(n, h.t);
  out.ms = vec4f(mat, sh, ao, 0.0);
  out.pos = vec4f(p, refl);
  return out;
}
`;

/* ───── B. Lumière ───── */

export const LIGHT = /* wgsl */ `
${UNIFORMS}
@group(1) @binding(0) var gnd: texture_2d<f32>;
@group(1) @binding(1) var gms: texture_2d<f32>;
@group(1) @binding(2) var gpos: texture_2d<f32>;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
};
@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  let c = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u));
  var out: VsOut;
  out.clip = vec4f(c * 2.0 - 1.0, 0.0, 1.0);
  out.uv = c * 2.0 - 1.0;
  return out;
}

fn sky_col(d: vec3f) -> vec3f {
  let k = clamp(d.y * 1.6, 0.0, 1.0);
  var c = mix(u.sky0.rgb, u.sky1.rgb, sqrt(k));
  let L = normalize(u.sun.xyz);
  c += u.sunCol.rgb * pow(max(dot(d, L), 0.0), 64.0) * 0.6;
  let style = i32(u.st.x + 0.5);
  if (style == 5) {
    // Nuit : la lune et des étoiles.
    let moon = smoothstep(0.9993, 0.9996, dot(d, L));
    c = mix(c, vec3f(0.95, 0.93, 0.85), moon * (0.3 + 0.7 * u.lights.w));
    let st = step(0.9975, h21(floor(d.xy * 400.0 / max(d.z + 1.5, 0.2)))) * k;
    c += vec3f(0.7) * st;
  }
  return c;
}

// Albédo par matière ; le sol dépend de l'endroit (allées, cour, pelouse).
fn albedo(mat: i32, p: vec3f) -> vec3f {
  if (mat == 1) {
    let gravel = (abs(p.x) < 0.75 && p.z > 1.3 && p.z < 6.4) || (abs(p.x) < 1.2 && p.z > 12.5) || (p.x < -5.5 && p.z > -2.3 && p.z < 1.0);
    let n = vn(p.xz * 4.0) * 0.1;
    if (gravel) { return vec3f(0.78, 0.72, 0.6) + n; }
    return vec3f(0.36, 0.48, 0.24) * (0.9 + n * 2.0);
  }
  if (mat == 3) { return vec3f(0.84, 0.8, 0.71); }
  if (mat == 4) { return vec3f(0.27, 0.3, 0.35); }
  if (mat == 5) { return vec3f(0.1, 0.12, 0.14); }
  if (mat == 6) { return vec3f(0.22, 0.34, 0.18); }
  if (mat == 7) { return vec3f(0.3, 0.24, 0.18); }
  if (mat == 8) { return vec3f(0.3, 0.4, 0.42); }
  if (mat == 9) { return vec3f(0.16, 0.3, 0.14); }
  if (mat == 10) { return vec3f(0.08, 0.08, 0.09); }
  if (mat == 11) { return vec3f(0.62, 0.78, 0.76); }
  if (mat == 12) { return vec3f(0.6, 0.58, 0.52); }
  if (mat == 13) { return vec3f(0.45, 0.3, 0.16); }
  if (mat == 16) { return vec3f(0.2, 0.18, 0.12); }
  return vec3f(0.7);
}

// Calques du cyanotype : bâti, parc, eaux, œuvres.
fn layer_of(mat: i32) -> i32 {
  if (mat == 3 || mat == 4 || mat == 5 || mat == 10 || mat == 11 || mat == 16) { return 0; }
  if (mat == 6 || mat == 7 || mat == 9) { return 1; }
  if (mat == 8) { return 2; }
  if (mat == 12 || mat == 13) { return 3; }
  return -1;
}

// Fenêtres et lanternes allumées (nocturne).
fn emission(mat: i32, p: vec3f) -> vec3f {
  let warm = vec3f(1.0, 0.68, 0.32);
  if (mat == 5) {
    let salon = select(0.0, u.lights.x, abs(p.x) < 0.72 && p.z > 0.0 && p.y < 1.04);
    let ailes = select(0.0, u.lights.y, !(abs(p.x) < 0.72 && p.y < 1.04));
    let flick = 0.85 + 0.15 * vn(vec2f(p.x * 3.0, u.res.z * 2.0));
    let lit = step(0.35, h21(floor(vec2f(p.x / 0.52, p.y * 2.0)) + 3.0));
    return warm * (salon + ailes * lit) * flick * 2.6;
  }
  if (mat == 16) { return warm * u.lights.z * 6.0; }
  return vec3f(0.0);
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let px = vec2i(in.clip.xy);
  let nd = textureLoad(gnd, px, 0);
  let ms = textureLoad(gms, px, 0);
  let ps = textureLoad(gpos, px, 0);
  let style = i32(u.st.x + 0.5);
  let mat = i32(ms.x + 0.5);
  let rd = camera_ray(in.uv);
  let L = normalize(u.sun.xyz);
  var col: vec3f;
  if (mat == 0) {
    col = sky_col(nd.xyz);
  } else {
    let n = nd.xyz;
    let p = ps.xyz;
    var a = albedo(mat, p);
    let diff = max(dot(n, L), 0.0) * ms.y;
    let ao = ms.z;
    if (style == 0) {
      // Série de Monet : ombres colorées, lumières chaudes.
      let shadowTint = mix(vec3f(0.38, 0.36, 0.62), u.sky1.rgb, 0.35);
      col = a * (u.sunCol.rgb * diff * 1.15 + shadowTint * (0.55 + 0.25 * n.y) * ao);
    } else if (style == 1) {
      // Lavis : un éclairage doux, la couleur porte la lecture.
      col = a * (0.72 + 0.35 * diff) * mix(0.8, 1.0, ao);
    } else if (style == 2) {
      // Livre animé : papier cartonné, deux tons, ombres franches.
      a = mix(a, vec3f(0.95, 0.92, 0.84), select(0.0, 0.85, mat == 1));
      col = a * (0.62 + 0.45 * step(0.3, diff)) * mix(0.75, 1.0, ao);
    } else if (style == 3) {
      // Cyanotype : la valeur seule, la passe de style trace le reste.
      col = vec3f(0.35 + 0.65 * diff) * ao;
    } else if (style == 5) {
      // Nocturne : lune froide, fenêtres chaudes.
      col = a * (u.sunCol.rgb * diff + vec3f(0.07, 0.09, 0.15) * ao) + emission(mat, p);
    } else if (style == 6) {
      // Maquette : du plâtre partout ; le plan de coupe est poché.
      a = vec3f(0.92, 0.91, 0.88);
      if (abs(p.y - u.st.w) < 0.012 && n.y > 0.9) { a = vec3f(0.42, 0.16, 0.12); }
      if (mat == 1 || mat == 8) { a = vec3f(0.86, 0.85, 0.82); }
      col = a * (0.25 + 0.85 * diff) * (0.35 + 0.65 * ao * ao);
    } else {
      // Temps du domaine, relevé en points : un éclairage naturel.
      col = a * (u.sunCol.rgb * diff * 1.1 + u.sky1.rgb * 0.45 * (0.6 + 0.4 * n.y) * ao);
      let spec = pow(max(dot(reflect(-L, n), -rd), 0.0), 24.0) * select(0.0, 0.5, mat == 5 || mat == 11);
      col += vec3f(spec) * ms.y;
    }
    // Brume de distance.
    let fogk = 1.0 - exp(-nd.w * u.fog.w);
    col = mix(col, u.fog.rgb, fogk);
  }
  // Eau : ce que montre le reflet, teinté par l'eau.
  if (ps.w > 0.0) {
    let water = select(vec3f(0.18, 0.26, 0.28), vec3f(0.03, 0.05, 0.07), style == 5);
    col = mix(water, col * 0.92, ps.w);
    // Livre animé : l'eau est un aplat bleu imprimé sur la page.
    if (style == 2) { col = mix(vec3f(0.6, 0.74, 0.82), col, 0.15); }
    if (style == 5) { col += vec3f(0.9, 0.88, 0.8) * u.lights.w * pow(max(dot(reflect(rd, vec3f(0.0, 1.0, 0.0)), L), 0.0), 400.0) * 3.0; }
  }
  return vec4f(col, select(0.0, 1.0, mat == 0));
}
`;

/* ───── C. Style ───── */

export const STYLE = /* wgsl */ `
${UNIFORMS}
@group(1) @binding(0) var colTex: texture_2d<f32>;
@group(1) @binding(1) var gnd: texture_2d<f32>;
@group(1) @binding(2) var gms: texture_2d<f32>;
@group(1) @binding(3) var samp: sampler;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
};
@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  let c = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u));
  var out: VsOut;
  out.clip = vec4f(c * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(c.x, 1.0 - c.y);
  return out;
}

fn col_at(uv: vec2f) -> vec3f {
  return textureSampleLevel(colTex, samp, uv, 0.0).rgb;
}
fn g_px(uv: vec2f) -> vec2i {
  return vec2i(clamp(uv, vec2f(0.0), vec2f(0.9999)) * u.res.xy);
}

// Arêtes : ruptures de profondeur, de normale ou de matière.
fn edges(uv: vec2f, w: f32) -> f32 {
  let o = vec2f(w) / u.out.xy;
  let c = g_px(uv);
  let n0 = textureLoad(gnd, c, 0);
  let m0 = textureLoad(gms, c, 0).x;
  var e = 0.0;
  for (var i = 0; i < 4; i++) {
    let d = select(select(vec2f(0.0, o.y), vec2f(0.0, -o.y), i == 3), select(vec2f(o.x, 0.0), vec2f(-o.x, 0.0), i == 1), i < 2);
    let pp = g_px(uv + d);
    let n1 = textureLoad(gnd, pp, 0);
    let m1 = textureLoad(gms, pp, 0).x;
    let dz = abs(n1.w - n0.w) / max(min(n1.w, n0.w), 0.5);
    e = max(e, smoothstep(0.04, 0.12, dz));
    e = max(e, smoothstep(0.25, 0.6, 1.0 - dot(n0.xyz, n1.xyz)) * step(n0.w, 5e3));
    e = max(e, step(0.5, abs(m1 - m0)));
  }
  return e;
}

fn luma(c: vec3f) -> f32 {
  return dot(c, vec3f(0.299, 0.587, 0.114));
}

// Monet : filtre de Kuwahara (quatre quadrants), touches orientées, toile.
fn kuwahara(uv: vec2f, r: f32) -> vec3f {
  let px = 1.0 / u.out.xy;
  var best = vec3f(0.0);
  var bestV = 1e9;
  for (var q = 0; q < 4; q++) {
    let sx = select(-1.0, 1.0, (q & 1) == 1);
    let sy = select(-1.0, 1.0, (q & 2) == 2);
    var m = vec3f(0.0);
    var m2 = vec3f(0.0);
    for (var j = 0; j < 3; j++) {
      for (var i = 0; i < 3; i++) {
        let c = col_at(uv + vec2f(sx * f32(i), sy * f32(j)) * r * px);
        m += c;
        m2 += c * c;
      }
    }
    m /= 9.0;
    let v = m2 / 9.0 - m * m;
    let s = v.r + v.g + v.b;
    if (s < bestV) {
      bestV = s;
      best = m;
    }
  }
  return best;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let uv = in.uv;
  let style = i32(u.st.x + 0.5);
  let dpr = u.out.z;
  let px = uv * u.out.xy;
  let t = u.res.z;
  var col = col_at(uv);
  let q = px / dpr;

  if (style == 0) {
    // Série de Monet.
    let ang = vn(q * 0.02) * 6.2832;
    let dir = vec2f(cos(ang), sin(ang));
    let stroke = vn(vec2f(dot(q, dir) * 0.06, dot(q, vec2f(-dir.y, dir.x)) * 0.45));
    col = kuwahara(uv + dir * (stroke - 0.5) * 3.0 / u.out.xy * dpr, 2.6 * dpr);
    col *= 0.94 + 0.12 * stroke;
    let weave = (sin(q.x * 2.2) * sin(q.y * 2.2)) * 0.02;
    col += weave;
    col = mix(vec3f(luma(col)), col, 1.18);
  } else if (style == 1) {
    // Relevé au lavis : couleur lavée, bords plus sombres où l'eau s'est
    // arrêtée, granulation du pigment, trait d'encre brun.
    let b = (col_at(uv + vec2f(1.5, 0.7) / u.out.xy * dpr) + col_at(uv - vec2f(1.2, 1.4) / u.out.xy * dpr) + col) / 3.0;
    var wash = mix(vec3f(0.96, 0.93, 0.86), b, 0.72);
    let gx = luma(col_at(uv + vec2f(2.0, 0.0) / u.out.xy * dpr)) - luma(col_at(uv - vec2f(2.0, 0.0) / u.out.xy * dpr));
    let gy = luma(col_at(uv + vec2f(0.0, 2.0) / u.out.xy * dpr)) - luma(col_at(uv - vec2f(0.0, 2.0) / u.out.xy * dpr));
    wash *= 1.0 - smoothstep(0.02, 0.15, length(vec2f(gx, gy))) * 0.25;
    wash *= 0.94 + 0.1 * vn(q * 0.7);
    let ink = edges(uv + (vec2f(vn(q * 0.08), vn(q * 0.08 + 5.0)) - 0.5) * 1.5 / u.out.xy, 1.0 * dpr);
    col = mix(wash, vec3f(0.24, 0.16, 0.1), ink * 0.85);
    col *= 0.97 + 0.03 * vn(q * 0.35);
  } else if (style == 2) {
    // Livre animé : bords de découpe blancs, fibre du papier.
    let e = edges(uv, 1.2 * dpr);
    col = mix(col, vec3f(0.98, 0.97, 0.94), e * 0.85);
    col *= 0.97 + 0.04 * vn(q * vec2f(0.3, 1.6));
  } else if (style == 3) {
    // Cyanotype : blanc sur bleu de Prusse, traits et hachures par calque.
    let mat = i32(textureLoad(gms, g_px(uv), 0).x + 0.5);
    var lw = 0.0;
    if (mat == 3 || mat == 4 || mat == 5 || mat == 10 || mat == 11 || mat == 16) { lw = u.lights.x; }
    else if (mat == 6 || mat == 7 || mat == 9) { lw = u.lights.y; }
    else if (mat == 8) { lw = u.lights.z; }
    else if (mat == 12 || mat == 13) { lw = u.lights.w; }
    let base = vec3f(0.06, 0.2, 0.44) * (0.9 + 0.15 * vn(q * 0.05) + 0.06 * vn(q * 0.6));
    let e = edges(uv, 1.0 * dpr) * (0.25 + 0.75 * lw);
    let v = luma(col);
    let hatch = (1.0 - smoothstep(0.0, 0.18, abs(fract((q.x + q.y) / 5.0) - 0.5) * 2.0 - v)) * (1.0 - v) * lw * 0.5;
    col = base + vec3f(0.85, 0.9, 0.95) * clamp(e * 0.9 + hatch * 0.3, 0.0, 1.0);
  } else if (style == 4) {
    // Le temps du domaine : chaque époque a son tirage.
    let e = u.ep.x;
    let l = luma(col);
    // Taille-douce : hachures espacées, plus épaisses dans les ombres, contre-
    // hachures dans les noirs, sur un papier crème.
    let lv = smoothstep(0.12, 0.8, l);
    let h1 = abs(fract((q.x + q.y * 0.55) / 6.0) - 0.5) * 2.0;
    let h2 = abs(fract((q.x * 0.5 - q.y) / 6.5) - 0.5) * 2.0;
    let ink1 = 1.0 - smoothstep((1.0 - lv) * 0.9 - 0.08, (1.0 - lv) * 0.9 + 0.08, h1);
    let ink2 = (1.0 - smoothstep(0.5 - lv * 0.6, 0.62 - lv * 0.6, h2)) * step(lv, 0.45);
    let engraved = mix(vec3f(0.95, 0.91, 0.82), vec3f(0.18, 0.13, 0.1), max(ink1 * (1.0 - lv * 0.5), ink2));
    let litho = mix(vec3f(0.28, 0.22, 0.16), vec3f(0.92, 0.86, 0.72), smoothstep(0.1, 0.9, l + (vn(q * 0.9) - 0.5) * 0.25));
    let pick = h21(floor(q / 2.2));
    let tint = col * select(select(vec3f(1.0, 0.62, 0.36), vec3f(0.52, 0.5, 0.95), pick > 0.33), vec3f(0.5, 0.82, 0.42), pick > 0.66) * 1.4;
    let autochrome = mix(col, tint, 0.25) * vec3f(1.03, 0.98, 0.86);
    let film = pow(col, vec3f(0.92, 0.98, 1.08)) * vec3f(1.06, 1.0, 0.9) + (h21(q + t) - 0.5) * 0.05;
    if (e < 1.0) { col = mix(engraved, litho, e); }
    else if (e < 2.0) { col = mix(litho, autochrome, e - 1.0); }
    else if (e < 3.0) { col = mix(autochrome, film, e - 2.0); }
    else { col = mix(film, col, e - 3.0); }
  } else if (style == 5) {
    // Nocturne : halo des fenêtres, lucioles dans le parc.
    var glow = vec3f(0.0);
    for (var i = 0; i < 8; i++) {
      let a = f32(i) * 0.785 + 0.3;
      let s = col_at(uv + vec2f(cos(a), sin(a)) * 9.0 * dpr / u.out.xy);
      glow += max(s - vec3f(0.7), vec3f(0.0));
    }
    col += glow * 0.18;
    for (var k = 0; k < 2; k++) {
      let cell = 38.0 * (1.0 + f32(k) * 0.6);
      let g = (q + vec2f(sin(t * 0.3 + f32(k)) * 20.0, t * 4.0)) / cell;
      let id = floor(g);
      let pos = vec2f(h21(id), h21(id + 3.3)) * 0.8 + 0.1 + vec2f(sin(t + h21(id) * 9.0), cos(t * 0.8 + h21(id) * 7.0)) * 0.06;
      let d = length(fract(g) - pos) * cell;
      let on = step(0.86, h21(id + 1.7)) * (0.5 + 0.5 * sin(t * 3.0 + h21(id) * 20.0)) * step(0.45, uv.y);
      col += vec3f(0.85, 1.0, 0.45) * on * exp(-d * d / 3.0) * 0.8;
    }
  } else if (style == 6) {
    // Maquette : le plâtre sous la lumière du studio.
    col = mix(col, vec3f(luma(col)), 0.7);
  } else if (style == 7) {
    // Relevé en points : une grille de points, dispersés à chaque changement.
    let cell = 4.0 * dpr;
    let g = px / cell;
    var acc = vec3f(0.035, 0.04, 0.05);
    for (var oy = -1; oy <= 1; oy++) {
      for (var ox = -1; ox <= 1; ox++) {
        let id = floor(g) + vec2f(f32(ox), f32(oy));
        let h = h21(id);
        let jit = vec2f(h, h21(id + 5.1)) * 0.8 + 0.1;
        let ang = h21(id + 9.3) * 6.2832;
        let scat = vec2f(cos(ang), sin(ang)) * u.ep.z * (6.0 + h * 30.0);
        let center = (id + jit) * cell + scat * dpr;
        let suv = (id + jit) * cell / u.out.xy;
        let c = col_at(suv);
        let sky = textureLoad(gms, g_px(suv), 0).x < 0.5;
        let r = cell * (0.22 + 0.25 * luma(c)) * select(1.0, 0.35, sky);
        let d = length(px - center);
        acc = mix(acc, c * 1.25, 1.0 - smoothstep(r - 0.8 * dpr, r + 0.6 * dpr, d));
      }
    }
    col = acc;
  }

  // Vignette commune, légère.
  let c = uv - 0.5;
  col *= 1.0 - 0.28 * pow(length(c * vec2f(1.0, u.out.y / u.out.x) * 1.4), 2.6);
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;
