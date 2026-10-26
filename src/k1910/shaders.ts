/**
 * Kerguéhennec, 1910 : un théâtre de papier en WebGPU.
 *
 * Deux passes.
 *  1. DÉCORS : des châssis plats (ciel, lointain, sujet, plan moyen, premier
 *     plan, cadre de scène) posés en profondeur dans une vraie scène 3D. Chaque
 *     châssis dessine son contenu par fonctions de distance, sans image.
 *  2. ÉPREUVE : la scène est relue comme une plaque autochrome gravée :
 *     hachures de taille-douce selon la valeur, grains de fécule colorés,
 *     papier, vignette, scintillement du projecteur, fermeture à l'iris.
 */

export const DECOR = /* wgsl */ `
struct Globals {
  vp: mat4x4f,     // vue × projection
  a: vec4f,        // temps, mouvement réduit, rideau (0 levé, 1 baissé), 0
};
struct Flat {
  r: vec4f,        // x, y (bas gauche, monde), largeur, hauteur
  p: vec4f,        // z, tableau (0…4), couche (0…5), opacité
  s: vec4f,        // aspect du châssis, échelle d'écran (marge), 0, 0
};

@group(0) @binding(0) var<uniform> g: Globals;
@group(1) @binding(0) var<uniform> f: Flat;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  let c = vec2f(f32(vi & 1u), f32(vi >> 1u));
  let world = vec4f(f.r.xy + c * f.r.zw, f.p.x, 1.0);
  var out: VsOut;
  out.clip = g.vp * world;
  out.uv = c;
  return out;
}

/* ───── Outils ───── */

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
  for (var i = 0; i < 5; i++) {
    v += a * vn(q);
    q = q * 2.03 + vec2f(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
fn sd_box(p: vec2f, c: vec2f, b: vec2f) -> f32 {
  let d = abs(p - c) - b;
  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
}
// Triangle isocèle : base centrée en c, demi-largeur w, hauteur h.
fn sd_gable(p: vec2f, c: vec2f, w: f32, h: f32) -> f32 {
  let q = vec2f(abs(p.x - c.x), p.y - c.y);
  let k = normalize(vec2f(h, w));
  let slope = dot(q - vec2f(w, 0.0), k);
  return max(max(slope, -q.y), q.y - h);
}
// Toit en croupe : trapèze de base b (demi-largeur), sommet t (demi-largeur).
fn sd_hip(p: vec2f, c: vec2f, b: f32, t: f32, h: f32) -> f32 {
  let y = p.y - c.y;
  let half = mix(b, t, clamp(y / h, 0.0, 1.0));
  return max(max(abs(p.x - c.x) - half, -y), y - h);
}
fn fill(d: f32, aa: f32) -> f32 {
  return 1.0 - smoothstep(-aa, aa, d);
}

struct Ink {
  col: vec3f,
  a: f32,
};
fn over(base: Ink, col: vec3f, a: f32) -> Ink {
  return Ink(mix(base.col, col, a), base.a + a * (1.0 - base.a));
}

// Palette autochrome : verts éteints, ocres, bleus de fécule, pierre chaude.
const STONE: vec3f = vec3f(0.80, 0.76, 0.67);
const STONE_D: vec3f = vec3f(0.55, 0.51, 0.45);
const SLATE: vec3f = vec3f(0.30, 0.33, 0.38);
const WINDOW: vec3f = vec3f(0.12, 0.13, 0.15);
const LEAF: vec3f = vec3f(0.30, 0.40, 0.25);
const LEAF_D: vec3f = vec3f(0.16, 0.23, 0.15);
const LAWN: vec3f = vec3f(0.52, 0.60, 0.36);
const GRAVEL: vec3f = vec3f(0.83, 0.78, 0.66);
const WATER: vec3f = vec3f(0.38, 0.48, 0.52);
const IRON: vec3f = vec3f(0.10, 0.10, 0.11);

/* ───── Le château : corps central, avant-corps à fronton, deux ailes,
   toits d'ardoise en croupe, cheminées, onze travées de fenêtres. ───── */
fn chateau(p: vec2f, o: vec2f, s: f32, aa: f32) -> Ink {
  var k = Ink(vec3f(0.0), 0.0);
  let q = (p - o) / s;
  let a = aa / s;
  // Ailes et corps.
  let body = sd_box(q, vec2f(0.0, 0.2), vec2f(0.62, 0.2));
  let pav = min(sd_box(q, vec2f(-0.55, 0.21), vec2f(0.1, 0.21)), sd_box(q, vec2f(0.55, 0.21), vec2f(0.1, 0.21)));
  let centre = sd_box(q, vec2f(0.0, 0.22), vec2f(0.15, 0.22));
  // Toits.
  let roof = sd_hip(q, vec2f(0.0, 0.4), 0.6, 0.42, 0.17);
  let roofP = min(sd_hip(q, vec2f(-0.55, 0.42), 0.12, 0.03, 0.2), sd_hip(q, vec2f(0.55, 0.42), 0.12, 0.03, 0.2));
  let pediment = sd_gable(q, vec2f(0.0, 0.44), 0.16, 0.11);
  var chim = 1e3;
  for (var i = -2; i <= 2; i++) {
    if (i == 0) { continue; }
    chim = min(chim, sd_box(q, vec2f(f32(i) * 0.22, 0.6), vec2f(0.022, 0.05)));
  }
  k = over(k, SLATE, fill(min(roof, roofP), a));
  k = over(k, STONE_D, fill(chim, a));
  k = over(k, STONE, fill(min(min(body, pav), centre), a));
  // L'avant-corps est éclairé d'un ton plus clair, son fronton aussi.
  k = over(k, STONE * 1.06, fill(centre, a));
  k = over(k, STONE * 0.98, fill(pediment, a));
  // Œil-de-bœuf du fronton.
  k = over(k, WINDOW, fill(length(q - vec2f(0.0, 0.5)) - 0.025, a));
  // Fenêtres : onze travées, deux niveaux ; porte au centre.
  for (var i = -5; i <= 5; i++) {
    let x = f32(i) * 0.105;
    for (var j = 0; j < 2; j++) {
      let y = 0.1 + f32(j) * 0.17;
      if (i == 0 && j == 0) { continue; }
      let w = sd_box(q, vec2f(x, y), vec2f(0.022, 0.05));
      k = over(k, STONE * 1.1, fill(w - 0.008, a));
      k = over(k, WINDOW, fill(w, a));
    }
  }
  let door = min(sd_box(q, vec2f(0.0, 0.08), vec2f(0.03, 0.08)), length(q - vec2f(0.0, 0.16)) - 0.03);
  k = over(k, WINDOW, fill(door, a));
  // Perron.
  k = over(k, STONE_D, fill(sd_box(q, vec2f(0.0, -0.01), vec2f(0.11, 0.015)), a));
  return k;
}

/* ───── Arbres ───── */
fn tree_round(p: vec2f, base: vec2f, r: f32, seed: f32, aa: f32) -> Ink {
  var k = Ink(vec3f(0.0), 0.0);
  let trunk = sd_box(p, base + vec2f(0.0, r * 0.5), vec2f(r * 0.07, r * 0.5));
  k = over(k, vec3f(0.24, 0.2, 0.16), fill(trunk, aa));
  let c = base + vec2f(0.0, r * 1.45);
  let n = fbm((p - c) / r * 2.2 + seed) - 0.5;
  let crown = length((p - c) / vec2f(1.0, 0.9)) - r * (0.95 + n * 0.55);
  let light = clamp(0.5 + (p.x - c.x) / r * -0.35 + (p.y - c.y) / r * 0.35 + n, 0.0, 1.0);
  k = over(k, mix(LEAF_D, LEAF, light), fill(crown, aa));
  return k;
}
// Cèdre : des étages de branches plates, comme ceux de l'arboretum.
fn tree_cedar(p: vec2f, base: vec2f, r: f32, seed: f32, aa: f32) -> Ink {
  var k = Ink(vec3f(0.0), 0.0);
  k = over(k, vec3f(0.22, 0.18, 0.15), fill(sd_box(p, base + vec2f(0.0, r * 1.1), vec2f(r * 0.06, r * 1.1)), aa));
  for (var i = 0; i < 5; i++) {
    let fi = f32(i);
    let c = base + vec2f((h21(vec2f(fi, seed)) - 0.5) * r * 0.4, r * (0.45 + fi * 0.42));
    let w = r * (1.25 - fi * 0.2);
    let n = fbm((p - c) / r * 3.0 + seed + fi) - 0.5;
    let tier = length((p - c) / vec2f(w, r * 0.17)) - 1.0 - n * 0.6;
    k = over(k, mix(LEAF_D, LEAF * 0.9, 0.35 + fi * 0.08), fill(tier * r * 0.17, aa));
  }
  return k;
}
fn tree_poplar(p: vec2f, base: vec2f, r: f32, seed: f32, aa: f32) -> Ink {
  let c = base + vec2f(0.0, r * 1.6);
  let n = fbm((p - c) / r * 3.0 + seed) - 0.5;
  let d = length((p - c) / vec2f(0.32, 1.5)) - r * (0.95 + n * 0.4);
  var k = Ink(vec3f(0.0), 0.0);
  k = over(k, vec3f(0.22, 0.2, 0.16), fill(sd_box(p, base + vec2f(0.0, r * 0.2), vec2f(r * 0.04, r * 0.2)), aa));
  return over(k, mix(LEAF_D, LEAF, 0.45 + n), fill(d, aa));
}

/* ───── Les dépendances : longues écuries à portes cintrées, campanile ;
   serre de verre et de fer. ───── */
fn ecuries(p: vec2f, o: vec2f, s: f32, aa: f32) -> Ink {
  var k = Ink(vec3f(0.0), 0.0);
  let q = (p - o) / s;
  let a = aa / s;
  k = over(k, SLATE, fill(sd_hip(q, vec2f(0.0, 0.22), 0.7, 0.62, 0.12), a));
  // Campanile et sa cloche.
  k = over(k, STONE, fill(sd_box(q, vec2f(0.0, 0.38), vec2f(0.045, 0.06)), a));
  k = over(k, SLATE, fill(sd_gable(q, vec2f(0.0, 0.44), 0.06, 0.09), a));
  k = over(k, WINDOW, fill(length(q - vec2f(0.0, 0.385)) - 0.018, a));
  k = over(k, STONE, fill(sd_box(q, vec2f(0.0, 0.11), vec2f(0.68, 0.11)), a));
  for (var i = -4; i <= 4; i++) {
    let x = f32(i) * 0.15;
    let arch = min(sd_box(q, vec2f(x, 0.05), vec2f(0.04, 0.05)), length(q - vec2f(x, 0.1)) - 0.04);
    k = over(k, STONE * 1.08, fill(arch - 0.012, a));
    k = over(k, vec3f(0.2, 0.15, 0.11), fill(arch, a));
  }
  return k;
}
fn serre(p: vec2f, o: vec2f, s: f32, aa: f32) -> Ink {
  var k = Ink(vec3f(0.0), 0.0);
  let q = (p - o) / s;
  let a = aa / s;
  // Voûte de verre : demi-ellipse sur un muret.
  let vault = max(length((q - vec2f(0.0, 0.08)) / vec2f(0.32, 0.22)) - 1.0, 0.08 - q.y);
  k = over(k, STONE_D, fill(sd_box(q, vec2f(0.0, 0.04), vec2f(0.32, 0.04)), a));
  k = over(k, vec3f(0.72, 0.82, 0.8), fill(vault * 0.2, a) * 0.85);
  // Côtes de fer.
  let rib = abs(fract((atan2(q.y - 0.08, q.x) / 3.14159) * 9.0) - 0.5) * 2.0;
  k = over(k, IRON, fill(vault * 0.2, a) * step(0.88, rib) * 0.8);
  k = over(k, IRON, fill(abs(vault * 0.2) - 0.004, a));
  return k;
}

/* ───── La grille d'entrée : piliers à pots à feu, ferronnerie. ───── */
fn grille(p: vec2f, o: vec2f, s: f32, aa: f32) -> Ink {
  var k = Ink(vec3f(0.0), 0.0);
  let q = (p - o) / s;
  let a = aa / s;
  for (var side = -1; side <= 1; side += 2) {
    let x = f32(side) * 0.42;
    k = over(k, STONE, fill(sd_box(q, vec2f(x, 0.26), vec2f(0.05, 0.26)), a));
    k = over(k, STONE * 1.08, fill(sd_box(q, vec2f(x, 0.535), vec2f(0.065, 0.015)), a));
    k = over(k, STONE_D, fill(length((q - vec2f(x, 0.6)) / vec2f(1.0, 1.3)) - 0.04, a));
    k = over(k, STONE_D, fill(sd_gable(q, vec2f(x, 0.64), 0.012, 0.05), a));
  }
  // Barreaux, fleurons, et la courbe du couronnement.
  let crown = 0.42 + 0.08 * cos(q.x / 0.37 * 1.5708);
  if (abs(q.x) < 0.37 && q.y > 0.0 && q.y < crown) {
    let bar = abs(fract(q.x / 0.03) - 0.5) * 0.03;
    k = over(k, IRON, fill(bar - 0.0035, a));
    let rail = min(abs(q.y - 0.06), abs(q.y - crown + 0.05));
    k = over(k, IRON, fill(rail - 0.005, a));
    let scroll = abs(length(vec2f(fract(q.x / 0.06) - 0.5, (q.y - crown + 0.11) / 0.06 * 0.5)) - 0.25);
    k = over(k, IRON, fill(scroll * 0.06 - 0.003, a));
  }
  return k;
}

// Une calèche : caisse, capote, deux roues à rayons.
fn caleche(p: vec2f, o: vec2f, s: f32, aa: f32) -> Ink {
  var k = Ink(vec3f(0.0), 0.0);
  let q = (p - o) / s;
  let a = aa / s;
  k = over(k, vec3f(0.18, 0.12, 0.1), fill(sd_box(q, vec2f(0.0, 0.16), vec2f(0.14, 0.05)), a));
  k = over(k, vec3f(0.12, 0.1, 0.09), fill(max(length((q - vec2f(0.05, 0.21)) / vec2f(0.1, 0.09)) - 1.0, 0.21 - q.y) * 0.09, a));
  for (var i = 0; i < 2; i++) {
    let c = vec2f(-0.1 + f32(i) * 0.22, 0.08);
    let d = length(q - c);
    let rim = abs(d - 0.075) - 0.008;
    let ang = atan2(q.y - c.y, q.x - c.x);
    let spoke = abs(fract(ang / 6.2832 * 10.0) - 0.5) * d * 6.2832 / 10.0 - 0.003;
    k = over(k, IRON, fill(min(rim, max(spoke, d - 0.075)), a));
  }
  return k;
}

/* ───── Composition des tableaux ───── */

fn sky(p: vec2f, t: f32) -> Ink {
  let v = p.y;
  var col = mix(vec3f(0.86, 0.84, 0.74), vec3f(0.62, 0.72, 0.74), smoothstep(0.25, 1.0, v));
  let n = fbm(vec2f(p.x * 1.6 + t * 0.012, v * 3.2));
  let cloud = smoothstep(0.52, 0.75, n) * smoothstep(0.35, 0.8, v);
  col = mix(col, vec3f(0.95, 0.93, 0.86), cloud * 0.8);
  return Ink(col, 1.0);
}

fn treeline(p: vec2f, seed: f32, height: f32, tone: vec3f, aa: f32) -> Ink {
  let n = fbm(vec2f(p.x * 4.0 + seed, seed));
  let top = height + (n - 0.5) * 0.09 + (vn(vec2f(p.x * 16.0, seed)) - 0.5) * 0.02;
  let a = fill(p.y - top, aa);
  let shade = fbm(p * vec2f(9.0, 14.0) + seed);
  return Ink(tone * (0.85 + shade * 0.3), a);
}

fn subject(scene: i32, p: vec2f, W: f32, aa: f32) -> Ink {
  let cx = W * 0.5;
  if (scene == 0) { return chateau(p, vec2f(cx, 0.3), 0.48, aa); }
  if (scene == 1) {
    var k = tree_cedar(p, vec2f(cx - 0.42, 0.26), 0.2, 1.0, aa);
    let b = tree_round(p, vec2f(cx + 0.18, 0.25), 0.17, 4.0, aa);
    k = over(k, b.col, b.a);
    let c = tree_poplar(p, vec2f(cx + 0.55, 0.27), 0.13, 7.0, aa);
    k = over(k, c.col, c.a);
    let d = tree_round(p, vec2f(cx - 0.05, 0.3), 0.1, 9.0, aa);
    return over(d, k.col, k.a);
  }
  if (scene == 2) { return chateau(p, vec2f(cx, 0.36), 0.3, aa); }
  if (scene == 3) {
    var k = ecuries(p, vec2f(cx - 0.2, 0.27), 0.42, aa);
    let s = serre(p, vec2f(cx + 0.48, 0.25), 0.32, aa);
    return over(k, s.col, s.a);
  }
  // Allée d'arbres vers la grille.
  var k = Ink(vec3f(0.0), 0.0);
  for (var i = 0; i < 4; i++) {
    let fi = f32(i);
    let off = 0.16 + fi * 0.11;
    let r = 0.05 + fi * 0.025;
    let y = 0.36 - fi * 0.04;
    let l = tree_round(p, vec2f(cx - off, y), r, fi * 3.0, aa);
    let rr = tree_round(p, vec2f(cx + off, y), r, fi * 3.0 + 1.0, aa);
    k = over(k, l.col, l.a);
    k = over(k, rr.col, rr.a);
  }
  return k;
}

fn midground(scene: i32, p: vec2f, W: f32, t: f32, aa: f32) -> Ink {
  let cx = W * 0.5;
  var k = Ink(vec3f(0.0), 0.0);
  if (scene == 2) {
    // Miroir d'eau : le château s'y reflète, brisé par des rides lentes.
    if (p.y < 0.35) {
      let ripple = sin(p.y * 260.0 + t * 1.4) * 0.0025 * (0.35 - p.y) / 0.35 + (vn(vec2f(p.x * 30.0, p.y * 80.0 - t * 0.3)) - 0.5) * 0.004;
      let mp = vec2f(p.x + ripple, 0.72 - p.y);
      let refl = chateau(mp, vec2f(cx, 0.36), 0.3, aa);
      let skyc = mix(vec3f(0.62, 0.72, 0.74), vec3f(0.86, 0.84, 0.74), smoothstep(0.0, 0.35, p.y));
      var c = mix(skyc * 0.92, WATER, 0.45);
      c = mix(c, refl.col * 0.72 + WATER * 0.2, refl.a * 0.85);
      let glint = smoothstep(0.92, 1.0, vn(vec2f(p.x * 60.0, p.y * 200.0 + t * 0.6))) * 0.25;
      k = Ink(c + glint, fill(p.y - 0.35, aa));
      // Berges.
      let bank = abs(p.y - 0.35 + (fbm(vec2f(p.x * 8.0, 2.0)) - 0.5) * 0.01) - 0.006;
      k = over(k, LEAF_D, fill(bank, aa));
    }
    return k;
  }
  // Pelouse jusqu'au pied des décors.
  let ground = 0.27;
  k = Ink(LAWN * (0.9 + fbm(p * vec2f(12.0, 30.0)) * 0.2), fill(p.y - ground, aa));
  if (scene == 0) {
    // Parterre à la française : allée de gravier, deux parterres bordés de
    // buis, un bassin rond et des ifs taillés en cône aux angles.
    let allee = abs(p.x - cx) - (0.04 + (ground - p.y) * 0.9);
    k = over(k, GRAVEL, fill(allee, aa) * step(p.y, ground));
    for (var side = -1; side <= 1; side += 2) {
      let c = vec2f(cx + f32(side) * 0.36, 0.165);
      let bed = sd_box(p, c, vec2f(0.22 - (0.165 - p.y) * 0.4, 0.065));
      k = over(k, LAWN * 1.08, fill(bed, aa));
      k = over(k, LEAF_D, fill(abs(bed) - 0.006, aa));
      k = over(k, LEAF_D, fill(abs(sd_box(p, c, vec2f(0.1, 0.028))) - 0.005, aa));
      for (var e = -1; e <= 1; e += 2) {
        let base = c + vec2f(f32(e) * 0.2, 0.06);
        k = over(k, LEAF_D * 0.9, fill(sd_gable(p, base, 0.017, 0.07), aa));
      }
    }
    let basin = length((p - vec2f(cx, 0.1)) / vec2f(1.0, 0.32)) - 0.075;
    k = over(k, STONE, fill(basin, aa));
    k = over(k, WATER * 1.15, fill(basin + 0.008, aa));
  } else if (scene == 1) {
    // Allée qui serpente vers l'arboretum.
    let path = abs(p.x - cx - sin(p.y * 14.0) * 0.12 * (0.3 - p.y) / 0.3) - (0.02 + (ground - p.y) * 0.25);
    k = over(k, GRAVEL, fill(path, aa) * step(p.y, ground));
  } else if (scene == 3) {
    // Cour pavée et une calèche.
    k = over(k, GRAVEL * 0.92, fill(p.y - 0.24, aa));
    let cal = caleche(p, vec2f(cx + 0.1, 0.13), 0.5, aa);
    k = over(k, cal.col, cal.a);
  } else {
    // L'avenue, qui file vers la grille.
    let av = abs(p.x - cx) - (0.06 + (ground - p.y) * 1.3);
    k = over(k, GRAVEL, fill(av, aa) * step(p.y, ground));
    let g = grille(p, vec2f(cx, 0.15), 0.45, aa);
    k = over(k, g.col, g.a);
  }
  return k;
}

fn foreground(scene: i32, p: vec2f, W: f32, aa: f32) -> Ink {
  var k = Ink(vec3f(0.0), 0.0);
  // Masses de feuillage aux coulisses, gauche et droite.
  for (var side = 0; side < 2; side++) {
    let x = select(W + 0.02, -0.02, side == 0);
    let c = vec2f(x, 0.62);
    let n = fbm((p - c) * 5.0 + f32(side) * 11.0 + f32(scene)) - 0.5;
    let d = length((p - c) / vec2f(0.32, 0.55)) - 1.0 - n * 0.5;
    k = over(k, mix(LEAF_D * 0.7, LEAF * 0.8, 0.3 + n), fill(d * 0.3, aa));
  }
  // Herbes ou roseaux au bas du cadre.
  let blades = vn(vec2f(p.x * 140.0, 0.0));
  let hgt = select(0.05 + blades * 0.05, 0.08 + blades * 0.1, scene == 2);
  let grass = p.y - hgt * (0.5 + 0.5 * sin(p.x * 420.0 + blades * 6.0));
  k = over(k, LEAF_D * 0.8, fill(grass, aa));
  return k;
}

// Le cadre de scène : arc de carton, bordure dorée, draperies, et le rideau.
fn proscenium(p: vec2f, W: f32, t: f32, curtain: f32, aa: f32) -> Ink {
  var k = Ink(vec3f(0.0), 0.0);
  let red = vec3f(0.42, 0.08, 0.07);
  let gold = vec3f(0.78, 0.62, 0.3);
  // Ouverture de scène, arrondie en haut.
  let inner = sd_box(p, vec2f(W * 0.5, 0.48), vec2f(W * 0.5 - 0.075, 0.44)) - 0.02;
  let frame = -inner;
  k = over(k, vec3f(0.17, 0.11, 0.09), fill(frame, aa));
  k = over(k, gold, fill(abs(inner) - 0.006, aa));
  // Lambrequin : le bandeau festonné du haut.
  let swag = p.y - (0.86 - 0.025 * abs(sin((p.x / W) * 3.14159 * 7.0)));
  let fold = 0.75 + 0.25 * sin(p.x * 90.0);
  k = over(k, red * fold, fill(-swag, aa) * step(0.0, -inner + 0.08));
  k = over(k, gold, fill(abs(swag) - 0.004, aa) * step(0.0, -inner + 0.08));
  // Draperies latérales, retenues par une embrasse.
  for (var side = 0; side < 2; side++) {
    let x = select(W - 0.03, 0.03, side == 0);
    let tie = 0.42;
    let width = 0.07 + 0.05 * smoothstep(0.86, tie, p.y) * smoothstep(0.0, tie, p.y);
    let d = abs(p.x - x) - width;
    let f2 = 0.7 + 0.3 * sin((p.x - x) * 160.0 + p.y * 3.0);
    k = over(k, red * f2, fill(d, aa));
    k = over(k, gold, fill(length(p - vec2f(x, tie)) - 0.018, aa));
  }
  // Le grand rideau, qui tombe des cintres.
  if (curtain > 0.001) {
    let bottom = 1.0 - curtain * 1.05;
    let hem = bottom + 0.01 * sin(p.x * 40.0);
    let pleat = 0.65 + 0.35 * pow(abs(sin(p.x * 48.0 + sin(p.y * 3.0 + t) * 0.2)), 0.6);
    let r = fill(hem - p.y, aa);
    k = over(k, red * pleat, r);
    k = over(k, gold, fill(abs(p.y - hem - 0.012) - 0.006, aa));
  }
  return k;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let scene = i32(f.p.y + 0.5);
  let layer = i32(f.p.z + 0.5);
  let t = g.a.x;
  // Coordonnées d'auteur : l'écran au repos va de 0 à 1 en hauteur ; le
  // châssis déborde un peu de chaque côté pour la parallaxe.
  let s = (in.uv - 0.5) * f.s.y + 0.5;
  let W = f.s.x;
  // uv.y vaut 0 au pied du châssis : l'axe y d'auteur monte, comme le décor.
  let p = vec2f(s.x * W, s.y);
  let aa = fwidth(p.y) * 1.2;
  var k: Ink;
  if (layer == 0) { k = sky(p, t); }
  else if (layer == 1) {
    k = treeline(p, f32(scene) * 3.1 + 1.0, select(0.33, 0.4, scene == 1), vec3f(0.42, 0.5, 0.43), aa);
  }
  else if (layer == 2) { k = subject(scene, p, W, aa); }
  else if (layer == 3) { k = midground(scene, p, W, t, aa); }
  else if (layer == 4) { k = foreground(scene, p, W, aa); }
  else { k = proscenium(p, W, t, g.a.z, aa); }
  let a = k.a * f.p.w;
  return vec4f(k.col * a, a);
}
`;

export const EPREUVE = /* wgsl */ `
struct Post {
  res: vec4f,    // largeur, hauteur (px), dpr, temps
  fx: vec4f,     // iris (0 fermé, 1 ouvert), scintillement, mouvement réduit, gravure
  iris: vec4f,   // centre de l'iris (px), 0, 0
};
@group(0) @binding(0) var<uniform> u: Post;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var scene: texture_2d<f32>;

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

fn h21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}
fn vn(p: vec2f) -> f32 {
  let i = floor(p);
  let q = fract(p);
  let s = q * q * (3.0 - 2.0 * q);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), s.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), s.x), s.y);
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let px = in.uv * u.res.xy;
  let dpr = u.res.z;
  let t = u.res.w;
  var col = textureSampleLevel(scene, samp, in.uv, 0.0).rgb;
  let lum = dot(col, vec3f(0.299, 0.587, 0.114));

  // Taille-douce : hachures dont l'épaisseur suit la valeur, puis contre-
  // hachures dans les ombres. Les traits suivent un léger tremblé de burin.
  let q = px / dpr;
  let wob = (vn(q * 0.05) - 0.5) * 2.0;
  let h1 = abs(fract((q.x + q.y * 0.55 + wob) / 4.2) - 0.5) * 2.0;
  let h2 = abs(fract((q.x * 0.6 - q.y + wob) / 4.6) - 0.5) * 2.0;
  let dark = 1.0 - lum;
  let line1 = 1.0 - smoothstep(dark * 0.95 - 0.12, dark * 0.95 + 0.06, h1);
  let line2 = (1.0 - smoothstep(dark * 0.8 - 0.4, dark * 0.8 - 0.25, h2)) * smoothstep(0.45, 0.7, dark);
  let engraved = 1.0 - 0.55 * max(line1 * smoothstep(0.12, 0.4, dark), line2);
  col = mix(col, col * engraved, u.fx.w);

  // Autochrome : l'image vue à travers des grains de fécule teints en
  // orange, vert et violet ; chaque grain filtre la lumière qui le traverse.
  let cell = 2.2 * dpr;
  let gq = px / cell;
  let gi = floor(gq + vec2f(vn(gq * 0.3) * 0.8));
  let pick = h21(gi);
  var grain = vec3f(1.0, 0.62, 0.36);
  if (pick > 0.66) { grain = vec3f(0.5, 0.82, 0.42); } else if (pick > 0.33) { grain = vec3f(0.52, 0.5, 0.95); }
  col = mix(col, col * grain * 1.45, 0.22);
  // Le vernis et l'âge : un léger voile chaud, poussières.
  col = mix(col, col * vec3f(1.04, 0.98, 0.86), 0.5);
  let f = floor(t * 18.0);
  let speck = step(0.9985, h21(floor(q / 2.0) + vec2f(f * 3.1, f)));
  col = mix(col, vec3f(0.15, 0.12, 0.1), speck * 0.7 * (1.0 - u.fx.z));

  // Scintillement du projecteur et vignette ronde de l'objectif.
  let flicker = 1.0 - u.fx.y * 0.06 * h21(vec2f(f, 2.0));
  let c = in.uv - 0.5;
  let vig = 1.0 - 0.6 * pow(length(c * vec2f(1.0, u.res.y / u.res.x) * 1.5), 2.6);
  col *= flicker * vig;

  // Fermeture à l'iris, comme au cinéma muet.
  let rmax = length(u.res.xy) * 0.6;
  let r = u.fx.x * rmax;
  let d = length(px - u.iris.xy);
  let iris = 1.0 - smoothstep(r - 2.0 * dpr, r + 1.0 * dpr, d);
  col = mix(vec3f(0.05, 0.045, 0.04), col, iris);

  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;
