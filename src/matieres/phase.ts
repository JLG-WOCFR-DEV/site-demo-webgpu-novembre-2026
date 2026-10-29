/**
 * Diagramme de phase : des formes en champ de distance (SDF) dérivent
 * lentement ; là où elles se rapprochent, leurs champs fusionnent (union
 * douce). On ne dessine pas les formes mais les lignes de niveau du champ,
 * en couches, comme un diagramme de phase de matériaux : la frontière
 * (niveau 0) à l'encre, les isolignes de part et d'autre de plus en plus
 * fines, les « phases » entre elles en aplats.
 *
 * D'après « SDF Phase Diagram » de you tanaka (#fridaydebugview) ; refait en
 * WebGPU, aucun code repris. Les isolignes ont la même épaisseur partout
 * grâce à fwidth (la pente du champ à l'écran), comme un marching squares
 * sans maillage.
 *
 * Réglages : orientation (cadran) et étirement — la mesure des distances est
 * étirée le long de l'angle, les formes s'allongent en strates ; courant — les
 * formes dérivent dans ce sens ; relief — ombrage de carte, lumière réglable
 * (second cadran) ; courbes maîtresses (une sur cinq) ; cinq palettes ; trois
 * formes ; le pointeur ajoute une forme ou creuse le champ ; vitesse, pause,
 * tirage, export PNG. Chaque trame se coupe (isolignes, aplats, frontière,
 * grain).
 *
 * Rendu « liquide » : les mêmes formes deviennent un liquide posé sur le
 * papier, vu d'en haut. Hauteur tirée du champ (ménisque arrondi au bord,
 * plat au cœur : une flaque), normale par différences finies ; réfraction
 * (loi de Snell, le rayon traverse h px de liquide jusqu'au papier), absorption
 * de Beer–Lambert, Fresnel (Schlick), reflet d'un studio (fenêtre à
 * croisillons du côté de la lumière), reflet spéculaire serré, bord assombri
 * aux incidences rasantes. Optique réglable : indice (F0 en découle),
 * dispersion (trois réfractions, une par couleur), bombé (dôme qui fait
 * loupe), distance au papier (le liquide sur une plaque de verre : réfraction
 * à la sortie par le fond plat, loupe, foyers), caustiques par tracé de
 * rayons (le faisceau parallèle traverse la surface ; le jacobien de
 * l'application surface → papier donne la concentration), reflets, trouble
 * (diffusion), dépoli, irisation (film mince), ondes capillaires. Eau, verre,
 * diamant, mercure, miel, huile, lait, encre, ou la couleur de la palette.
 * Le champ est une union exponentielle (lisse à tous les ordres) : pas de
 * pli dans les gouttes fusionnées.
 */
import { renderScale } from "../gpu/governor.ts";
import { getDevice } from "../components/device.ts";

const MAX = 24;
const HEAD = 16; // vec4 avant le tableau des formes
const SHADER = /* wgsl */ `
struct U {
  res: vec4f,      // largeur, hauteur (px), dpr, temps
  cfgv: vec4f,     // nombre de formes, fusion k (px), écart entre isolignes (px), nombre de couches
  ink: vec4f,
  paper: vec4f,
  spot: vec4f,
  opt: vec4f,      // palette (0 aplats, 1 topographie, 2 thermique), courbes maîtresses, forme (0 disque, 1 carré, 2 capsule), relief
  dir: vec4f,      // cos, sin de l'orientation, étirement (≥ 1)
  lit: vec4f,      // direction de la lumière (écran, y vers le bas ; z vers l'observateur)
  ptr: vec4f,      // x, y, rayon, mode (+1 ajoute, −1 creuse)
  ren: vec4f,      // rendu (0 lignes, 1 liquide), fond sous le liquide (0 papier, 1 quadrillé, 2 diagramme), largeur du ménisque (× hauteur)
  tog: vec4f,      // isolignes, aplats (0 paliers, 1 dégradé, 2 aucun), frontière, grain
  liqA: vec4f,     // teinte du liquide (rgb, couleur après une épaisseur), transparence
  liqB: vec4f,     // —, F0 (métaux), métal, hauteur (px)
  opt2: vec4f,     // indice de réfraction, dispersion (Δn rouge ↔ bleu), bombé, distance au papier (px)
  opt3: vec4f,     // caustiques, reflets, trouble, dépoli
  opt4: vec4f,     // irisation, ondes
  balls: array<vec4f, ${MAX}>,  // x, y, rayon (px), rotation propre
};
@group(0) @binding(0) var<uniform> u: U;

struct VO { @builtin(position) p: vec4f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  return VO(vec4f(p, 0.0, 1.0));
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
/** Le repère étiré : composante le long de l'orientation divisée par l'étirement. */
fn aniso(v: vec2f) -> vec2f {
  let q = vec2f(dot(v, u.dir.xy), dot(v, vec2f(-u.dir.y, u.dir.x)));
  return vec2f(q.x / u.dir.z, q.y);
}
fn rot(v: vec2f, a: f32) -> vec2f {
  let c = cos(a);
  let s = sin(a);
  return vec2f(c * v.x + s * v.y, -s * v.x + c * v.y);
}
fn shape(v0: vec2f, r: f32, a: f32) -> f32 {
  let kind = u.opt.z;
  if (kind < 0.5) {
    // En liquide : une hyperbole plutôt qu'un cône (pas de pointe au sommet d'une goutte bombée).
    if (u.ren.x > 0.5) { let c = r * 0.6; return sqrt(dot(v0, v0) + c * c) - sqrt(r * r + c * c); }
    return length(v0) - r;
  }
  let v = rot(v0, a);
  if (kind < 1.5) {
    let q = abs(v) - vec2f(r * 0.8);
    return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r * 0.2;
  }
  let h = r * 0.95;
  return length(vec2f(v.x - clamp(v.x, -h, h), v.y)) - r * 0.55;
}
/**
 * Le champ : union douce des formes, puis le pointeur (ajouté ou creusé), en px.
 * Union exponentielle (log-somme-exp, en ligne et stable) : lisse à tous les
 * ordres, donc sans pli ni arête dans le relief (l'union polynomiale n'est que
 * C¹ : la réfraction en montrait les cassures).
 */
fn field(p: vec2f) -> f32 {
  let k = max(u.cfgv.y, 0.5) / 3.0;
  var m = 1e6;
  var acc = 0.0;
  let n = i32(u.cfgv.x);
  for (var i = 0; i <= n; i++) {
    var x: f32;
    if (i < n) {
      let b = u.balls[i];
      x = shape(aniso(p - b.xy), b.z, b.w);
    } else {
      if (u.ptr.z < 0.5 || u.ptr.w < 0.0) { break; }
      x = length(aniso(p - u.ptr.xy)) - u.ptr.z;
    }
    if (x < m) { acc = acc * exp((x - m) / k) + 1.0; m = x; } else { acc += exp((m - x) / k); }
  }
  var d = m - k * log(max(acc, 1.0));
  if (u.ptr.z > 0.5 && u.ptr.w < 0.0) {
    let pd = length(aniso(p - u.ptr.xy)) - u.ptr.z;
    d = -smin(-d, pd, k * 1.8);
  }
  return d;
}
fn ramp6(t: f32, c0: vec3f, c1: vec3f, c2: vec3f, c3: vec3f, c4: vec3f, c5: vec3f) -> vec3f {
  let x = clamp(t, 0.0, 1.0) * 5.0;
  if (x < 1.0) { return mix(c0, c1, x); }
  if (x < 2.0) { return mix(c1, c2, x - 1.0); }
  if (x < 3.0) { return mix(c2, c3, x - 2.0); }
  if (x < 4.0) { return mix(c3, c4, x - 3.0); }
  return mix(c4, c5, x - 4.0);
}

/**
 * Le diagramme « à plat » au point p (champ d déjà évalué, fw = sa pente à
 * l'écran) : aplats, relief de carte, isolignes, frontière. Chaque trame se
 * coupe à part (tog).
 */
fn diagram(p: vec2f, d: f32, fw: f32) -> vec3f {
  let gap = u.cfgv.z;
  let n = u.cfgv.w;
  let band = floor(d / gap);
  let inside = d < 0.0;
  let flats = u.tog.y;
  // Paliers : la profondeur par bande ; dégradé : la même, continue.
  let dc = select(clamp(abs(d) / (gap * n), 0.0, 1.0), clamp(abs(band + select(0.0, 1.0, inside)) / n, 0.0, 1.0), flats < 0.5);
  let depth = clamp(abs(band + select(0.0, 1.0, inside)) / n, 0.0, 1.0);
  let mode = u.opt.x;
  var col = u.paper.rgb;
  if (flats > 1.5) {
    // Aucun aplat : le papier, et la phase en une seule teinte.
    if (inside && mode < 0.5) { col = u.spot.rgb; }
    else if (inside && mode < 1.5) { col = vec3f(0.72, 0.78, 0.52); }
    else if (inside) { col = vec3f(0.87, 0.32, 0.23); }
  } else if (mode < 0.5) {
    if (inside) {
      col = mix(u.spot.rgb, mix(u.spot.rgb, u.paper.rgb, 0.55), dc);
    } else if (abs(d) < gap * n) {
      col = mix(mix(u.ink.rgb, u.paper.rgb, 0.9), u.paper.rgb, dc);
    }
  } else if (mode < 1.5) {
    if (inside) {
      col = ramp6(dc, vec3f(0.55, 0.69, 0.47), vec3f(0.72, 0.78, 0.52), vec3f(0.87, 0.82, 0.58), vec3f(0.80, 0.62, 0.42), vec3f(0.62, 0.45, 0.33), vec3f(0.95, 0.94, 0.92));
    } else {
      col = mix(vec3f(0.75, 0.86, 0.91), vec3f(0.36, 0.56, 0.72), dc);
    }
  } else {
    let sb = select(clamp(0.5 - d / (2.0 * gap * n), 0.0, 1.0), clamp(0.5 - (band + 0.5) / (2.0 * n), 0.0, 1.0), flats < 0.5);
    col = ramp6(sb, vec3f(0.0, 0.0, 0.02), vec3f(0.26, 0.04, 0.41), vec3f(0.58, 0.15, 0.40), vec3f(0.87, 0.32, 0.23), vec3f(0.99, 0.65, 0.04), vec3f(0.99, 1.0, 0.64));
  }
  // Relief de carte : le terrain h = −d.
  let relief = u.opt.w;
  if (relief > 0.001) {
    let g = vec2f(field(p + vec2f(1.0, 0.0)) - d, field(p + vec2f(0.0, 1.0)) - d);
    let nrm = normalize(vec3f(g * 0.7, 1.0));
    let L = u.lit.xyz;
    let w = 1.0 - smoothstep(gap * n, gap * (n + 3.0), d);
    let lam = dot(nrm, L) - L.z;
    col = col * (1.0 + relief * w * min(lam, 0.0) * 1.6) + relief * w * max(lam, 0.0) * 0.55;
  }
  if (u.tog.x > 0.5) {
    let f = abs(fract(d / gap + 0.5) - 0.5) * gap;
    var wLine = mix(0.6, 0.25, depth);
    var aLine = mix(0.75, 0.25, depth);
    let idx = i32(round(d / gap));
    if (u.opt.y > 0.5 && idx % 5 == 0) {
      wLine = wLine * 2.4 + 0.4;
      aLine = min(1.0, aLine + 0.3);
    }
    let iso = (1.0 - smoothstep(wLine * fw, (wLine + 1.0) * fw, f)) * step(abs(band), n + 0.5);
    col = mix(col, u.ink.rgb, iso * aLine);
  }
  if (u.tog.z > 0.5) {
    let edge = 1.0 - smoothstep(1.2 * fw, 2.4 * fw, abs(d));
    col = mix(col, u.ink.rgb, edge);
  }
  return col;
}

/* ───── Le liquide ───── */

/**
 * Géométrie : le papier en z = 0 ; le liquide posé sur une plaque de verre
 * invisible en z = D (distance au papier, 0 : sur le papier) ; sa surface en
 * z = D + h(x, y). Vue d'en haut, orthographique. La lumière vient de L.
 */
fn liquidH(d: f32) -> f32 {
  let H = u.liqB.w;
  let w = H * u.ren.z;
  let t = clamp(-d / w, 0.0, 1.0);
  // Ménisque arrondi au bord, puis (bombé) un dôme qui continue de monter vers le cœur.
  return H * (1.0 - pow(1.0 - t, 2.5)) + u.opt2.z * H * (1.0 - exp(-max(-d, 0.0) / (w * 2.5)));
}
/** dh / d(−d). */
fn liquidDH(d: f32) -> f32 {
  let H = u.liqB.w;
  let w = H * u.ren.z;
  let t = clamp(-d / w, 0.0, 1.0);
  let men = select(0.0, 2.5 * H * pow(1.0 - t, 1.5) / w, t < 1.0);
  let dome = select(0.0, u.opt2.z * H / (w * 2.5) * exp(-max(-d, 0.0) / (w * 2.5)), d < 0.0);
  return men + dome;
}
/** Les ondes : quatre trains de vagues capillaires ; renvoie −∇h (px/px), nul au bord (la ligne de contact est accrochée). */
fn ripples(p: vec2f, d: f32) -> vec2f {
  let a = u.opt4.y;
  if (a < 0.001) { return vec2f(0.0); }
  let t = u.res.w;
  var g = vec2f(0.0);
  var K = array<vec3f, 4>(vec3f(0.11, 0.03, 1.7), vec3f(-0.05, 0.12, 2.1), vec3f(0.08, -0.09, 1.3), vec3f(-0.15, -0.04, 2.6));
  for (var i = 0; i < 4; i++) {
    let k = K[i];
    g += k.xy * cos(dot(k.xy, p) - k.z * t + f32(i) * 1.7);
  }
  let mask = smoothstep(0.0, u.liqB.w * u.ren.z * 0.6, -d);
  return -g * a * 2.2 * mask;
}
/** La surface en s : (h, −∇h, d). */
fn surfaceAt(s: vec2f) -> vec4f {
  let d = field(s);
  let g = vec2f(field(s + vec2f(1.0, 0.0)) - d, field(s + vec2f(0.0, 1.0)) - d);
  // ∇d renormalisé (l'union l'étire) mais en douceur : aux cols entre deux gouttes, ∇d → 0 et la direction n'a plus de sens.
  let sl = liquidDH(d) * g / max(length(g), 0.6) + ripples(s, d);
  return vec4f(select(0.0, liquidH(d), d < 0.0), sl, d);
}
fn nrmOf(sf: vec4f) -> vec3f { return normalize(vec3f(sf.yz, 1.0)); }
/** Un rayon qui descend (direction dir) entre par la surface et ressort par le fond plat : où touche-t-il le papier ? */
fn throughLiquid(s: vec2f, sf: vec4f, dir: vec3f, ior: f32) -> vec2f {
  let D = u.opt2.w;
  if (sf.w >= 0.0) { return s + dir.xy / max(-dir.z, 0.15) * D; }
  let r1 = refract(dir, nrmOf(sf), 1.0 / ior);
  var o = r1.xy / max(-r1.z, 0.15) * sf.x;
  let r2 = refract(r1, vec3f(0.0, 0.0, 1.0), ior);
  let r2b = select(r1, r2, dot(r2, r2) > 0.0);
  o += r2b.xy / max(-r2b.z, 0.15) * D;
  return s + o;
}
fn dielectricF0(ior: f32) -> f32 { let r = (ior - 1.0) / (ior + 1.0); return r * r; }
fn fresnel(f0: f32, c: f32) -> f32 { return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }
/** Ce qui est imprimé sur le papier au point q (sans éclairage). */
fn albedo(q: vec2f, fw: f32) -> vec3f {
  let fond = u.ren.y;
  if (fond > 1.5) { return diagram(q, field(q), fw); }
  if (fond > 0.5) {
    let a = abs(fract(q / 8.0 + 0.5) - 0.5) * 8.0;
    let b = abs(fract(q / 40.0 + 0.5) - 0.5) * 40.0;
    let fine = 1.0 - smoothstep(0.35, 1.0, min(a.x, a.y));
    let bold = 1.0 - smoothstep(0.6, 1.3, min(b.x, b.y));
    return mix(u.paper.rgb, vec3f(0.36, 0.55, 0.72), max(fine * 0.28, bold * 0.6));
  }
  return u.paper.rgb;
}
/** Dépoli : quelques prises autour de q (disque de Vogel), rayon r. */
fn albedoFrost(q: vec2f, fw: f32, r: f32) -> vec3f {
  if (r < 0.3) { return albedo(q, fw); }
  var c = vec3f(0.0);
  for (var i = 0; i < 6; i++) {
    let a = f32(i) * 2.39996;
    let rr = r * sqrt((f32(i) + 0.5) / 6.0);
    c += albedo(q + vec2f(cos(a), sin(a)) * rr, fw);
  }
  return c / 6.0;
}
/**
 * La lumière reçue par le papier en q, rapportée au papier nu (1) :
 *  - on remonte le rayon de lumière qui arrive en q jusqu'à la surface (un pas de point fixe) ;
 *  - transmission : Fresnel à l'entrée, absorption (Beer–Lambert) sur le trajet, trouble ;
 *  - caustique : le faisceau parallèle se resserre ou s'étale ; le rapport des aires
 *    (jacobien de l'application surface → papier, par différences finies) donne la concentration ;
 *  - plus une occlusion douce (le liquide cache un peu du ciel).
 */
fn groundLight(q: vec2f) -> vec3f {
  let L = u.lit.xyz;
  let dir = -L;
  let ior = u.opt2.x;
  let D = u.opt2.w;
  let H = u.liqB.w;
  let k = dir.xy / max(-dir.z, 0.15);
  var s = q - k * (D + H * 0.6);
  var sf = surfaceAt(s);
  for (var it = 0; it < 2; it++) {
    s -= throughLiquid(s, sf, dir, ior) - q;
    sf = surfaceAt(s);
  }
  // Confiance : si le rayon retrouvé ne retombe pas en q (plis de la caustique, plusieurs rayons pour un point), on n'en croit pas la concentration.
  let miss = length(throughLiquid(s, sf, dir, ior) - q);
  let conf = exp(-miss / 3.0);
  var T = vec3f(1.0);
  if (sf.w < 0.0) {
    let n = nrmOf(sf);
    let r1 = refract(dir, n, 1.0 / ior);
    let path = sf.x / max(H, 1.0) / max(-r1.z, 0.2);
    let F = select(fresnel(dielectricF0(ior), dot(n, L)), 1.0, u.liqB.z > 0.5);
    T = (1.0 - F) * pow(max(u.liqA.rgb, vec3f(1e-3)), vec3f(path)) * (1.0 - u.opt3.z * 0.75 * min(path, 1.0));
    T *= mix(0.0, 1.0, u.liqA.w);
  }
  var E = 1.0;
  let caust = u.opt3.x;
  if (caust > 0.001) {
    // Pas de 3 px : assez large pour lisser les plis, assez fin pour garder les foyers.
    let e = 3.0;
    let sx = surfaceAt(s + vec2f(e, 0.0));
    let sy = surfaceAt(s + vec2f(0.0, e));
    let m0 = throughLiquid(s, sf, dir, ior);
    let mx = throughLiquid(s + vec2f(e, 0.0), sx, dir, ior) - m0;
    let my = throughLiquid(s + vec2f(0.0, e), sy, dir, ior) - m0;
    // La surface n'est pas à la même hauteur partout : le faisceau incident y est déjà « incliné ».
    let ax = vec2f(e, 0.0) + k * (sx.x - sf.x);
    let ay = vec2f(0.0, e) + k * (sy.x - sf.x);
    let jm = abs(mx.x * my.y - mx.y * my.x);
    let ja = abs(ax.x * ay.y - ax.y * ay.x);
    // Plancher à 0,3 : là où la lumière rase les flancs, le faisceau s'effondre (ja → 0) ; on garde une pénombre, pas un trait noir.
    E = mix(1.0, clamp(ja / max(jm, 1e-3), 0.3, 4.5), caust * conf);
  }
  let occ = smoothstep(H * 0.5, -H * 0.8, field(q)) * exp(-D / 90.0);
  let ao = 1.0 - 0.3 * (1.0 - 0.6 * u.liqA.w) * occ;
  return ao * (0.45 + 0.55 * T * E);
}
/** Un studio : murs, plafond, grand diffuseur au zénith, une fenêtre à croisillons du côté de la lumière, une petite boîte en face. */
fn env(r: vec3f) -> vec3f {
  let L = u.lit.xyz;
  let wall = mix(u.paper.rgb * 0.55, vec3f(0.4), 0.3);
  var c = mix(wall, vec3f(0.2, 0.2, 0.21), smoothstep(0.05, 0.7, r.z));
  c += vec3f(0.62, 0.62, 0.6) * smoothstep(0.8, 0.985, r.z);
  c = select(c, u.paper.rgb * 0.75, r.z < 0.0);
  let az = normalize(vec2f(L.x, L.y) + vec2f(1e-4, 0.0));
  let wdir = normalize(vec3f(az * 0.72, 0.69));
  let t1 = normalize(vec3f(-az.y, az.x, 0.0));
  let t2 = cross(wdir, t1);
  let q = vec2f(dot(r, t1), dot(r, t2)) / max(dot(r, wdir), 1e-3);
  let win = (1.0 - smoothstep(0.38, 0.5, abs(q.x))) * (1.0 - smoothstep(0.22, 0.32, abs(q.y))) * step(0.0, dot(r, wdir));
  let bars = 1.0 - 0.85 * (1.0 - smoothstep(0.008, 0.02, abs(q.x))) - 0.85 * (1.0 - smoothstep(0.008, 0.02, abs(q.y)));
  c += vec3f(5.0, 4.9, 4.7) * win * bars;
  let o = normalize(vec3f(-az * 0.55, 0.83));
  c += vec3f(1.6) * smoothstep(0.985, 0.995, dot(r, o));
  return c;
}
/** Couleur d'interférence d'un film mince (huile, savon) : épaisseur optique → teinte. */
fn thinFilm(x: f32) -> vec3f {
  return 0.5 + 0.5 * cos(6.2832 * (x + vec3f(0.0, 0.33, 0.67)));
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let p = i.p.xy / u.res.z;
  let d = field(p);
  let fw = max(fwidth(d), 1e-3);
  var col: vec3f;
  if (u.ren.x < 0.5) {
    col = diagram(p, d, fw);
  } else {
    let sf = surfaceAt(p);
    let nrm = nrmOf(sf);
    let h = sf.x;
    let v = vec3f(0.0, 0.0, 1.0);
    let ior = u.opt2.x;
    let disp = u.opt2.y;
    let metal = u.liqB.z > 0.5;
    let H = max(u.liqB.w, 1.0);
    let a = 1.0 - smoothstep(-fw, fw, d);
    // Réfraction, une par couleur (dispersion : le bleu dévie plus que le rouge).
    let qR = throughLiquid(p, sf, -v, ior - disp);
    let qG = throughLiquid(p, sf, -v, ior);
    let qB = throughLiquid(p, sf, -v, ior + disp);
    let frost = u.opt3.w * 14.0 * (h / H + 0.25);
    // La lumière sur le papier : là où l'on regarde à travers le liquide, ou juste sous le pixel.
    let light = groundLight(select(p, qG, a > 0.5));
    var liquid = vec3f(0.0);
    if (a > 0.0) {
      var through = vec3f(albedoFrost(qR, fw, frost).r, albedoFrost(qG, fw, frost).g, albedoFrost(qB, fw, frost).b) * light;
      // Absorption sur le trajet du regard (aller dans le liquide ; la lumière, elle, a déjà été filtrée).
      let path = h / H * (1.0 + (1.0 - nrm.z) * 2.0);
      through *= pow(max(u.liqA.rgb, vec3f(1e-3)), vec3f(path));
      // Bord : le rayon ressort en rasant et va chercher la lumière loin (anneau sombre d'une vraie goutte).
      let grazing = smoothstep(0.04, 0.3, 1.0 - nrm.z);
      through *= 1.0 - 0.38 * grazing * u.liqA.w * clamp((ior - 1.0) / 0.33, 0.0, 1.6);
      // Trouble : la lumière diffusée dans le liquide (lait, sirop) éclaire le corps lui-même.
      let L = u.lit.xyz;
      let scatter = (u.liqA.rgb * 0.85 + 0.15) * (0.6 + 0.4 * max(dot(nrm, L), 0.0));
      let turb = u.opt3.z * (1.0 - exp(-3.0 * h / H));
      let body = mix(mix(u.liqA.rgb * 0.18, through, u.liqA.w), scatter, turb);
      // Reflets : Fresnel (F0 tiré de l'indice), studio, soleil.
      var F = select(fresnel(dielectricF0(ior), nrm.z), fresnel(u.liqB.y, nrm.z), metal);
      var refl = env(reflect(-v, nrm));
      let hv = normalize(L + v);
      refl += vec3f(pow(max(dot(nrm, hv), 0.0), 900.0) * 18.0 + pow(max(dot(nrm, hv), 0.0), 60.0) * 0.25);
      refl *= u.opt3.y;
      // Irisation : un film mince sur la surface, son épaisseur suit la hauteur et dérive lentement.
      let iris = u.opt4.x;
      if (iris > 0.001) {
        let th = 1.2 + 1.4 * h / H + 0.35 * sin(p.x * 0.013 + u.res.w * 0.21) * sin(p.y * 0.017 - u.res.w * 0.17) + (1.0 - nrm.z) * 2.0;
        refl *= mix(vec3f(1.0), thinFilm(th) * 1.8, iris);
        F = mix(F, max(F, 0.14), iris);
      }
      if (metal) {
        liquid = refl * mix(u.liqA.rgb, vec3f(1.0), F);
      } else {
        liquid = mix(body, refl, F);
      }
      liquid = liquid / (1.0 + max(liquid - vec3f(0.85), vec3f(0.0)) * 0.6);
    }
    // Au bord (pixel à moitié couvert), le papier visible à côté reçoit sa propre lumière.
    var lo = light;
    if (a > 0.5 && a < 1.0) { lo = groundLight(p); }
    col = mix(albedo(p, fw) * lo, liquid, a);
  }
  if (u.tog.w > 0.5) {
    let hn = fract(sin(dot(i.p.xy, vec2f(12.9898, 78.233))) * 43758.5453);
    col += (hn - 0.5) * 0.02;
  }
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;

/** Bruit lisse 1D (somme de sinus décalés) : une dérive « organique », sans motif qui se répète vite. */
const drift = (t: number, s: number) => Math.sin(t * 0.31 + s) * 0.55 + Math.sin(t * 0.17 + s * 2.3) * 0.3 + Math.sin(t * 0.53 + s * 0.7) * 0.15;
const hex = (h: string) => {
  const n = Number.parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};

/** Les palettes : mode (0 aplats, 1 topographie, 2 thermique), encre, papier, couleur des phases. */
export const PALETTES = {
  vermillon: { mode: 0, ink: "#121212", paper: "#efeee8", spot: "#c8321c" },
  topographie: { mode: 1, ink: "#4a3a2a", paper: "#eef0ea", spot: "#8fae6f" },
  thermique: { mode: 2, ink: "#0a0a0a", paper: "#000004", spot: "#dd513a" },
  nuit: { mode: 0, ink: "#ece7dc", paper: "#0e0f13", spot: "#e2502f" },
  prusse: { mode: 0, ink: "#f3f1ea", paper: "#173f73", spot: "#dfe7ef" },
} as const;
const SHAPES = { disque: 0, carre: 1, capsule: 2 } as const;
const FLATS = { paliers: 0, degrade: 1, aucun: 2 } as const;
const FONDS = { papier: 0, quadrille: 1, diagramme: 2 } as const;
/**
 * Les liquides : teinte après une hauteur pleine (Beer–Lambert), transparence,
 * F0 (métaux seulement : pour les autres, il découle de l'indice), métal, et
 * les réglages d'optique qu'ils posent en arrivant (indice, dispersion,
 * trouble, irisation). « couleur » prend la couleur des phases de la palette.
 */
export const LIQUIDS = {
  eau: { tint: [0.9, 0.96, 0.98], trans: 1, f0: 0.02, metal: 0, ior: 1.333, dispersion: 0.006, trouble: 0, irisation: 0 },
  verre: { tint: [0.93, 0.98, 0.96], trans: 1, f0: 0.04, metal: 0, ior: 1.52, dispersion: 0.018, trouble: 0, irisation: 0 },
  diamant: { tint: [0.98, 0.98, 0.99], trans: 1, f0: 0.17, metal: 0, ior: 2.42, dispersion: 0.044, trouble: 0, irisation: 0 },
  mercure: { tint: [0.78, 0.79, 0.82], trans: 0, f0: 0.78, metal: 1, ior: 1.0, dispersion: 0, trouble: 0, irisation: 0 },
  miel: { tint: [0.95, 0.52, 0.1], trans: 0.92, f0: 0.04, metal: 0, ior: 1.49, dispersion: 0.008, trouble: 0.12, irisation: 0 },
  huile: { tint: [0.86, 0.8, 0.3], trans: 0.97, f0: 0.035, metal: 0, ior: 1.47, dispersion: 0.01, trouble: 0, irisation: 0.55 },
  lait: { tint: [0.97, 0.96, 0.92], trans: 1, f0: 0.02, metal: 0, ior: 1.35, dispersion: 0.004, trouble: 0.92, irisation: 0 },
  encre: { tint: [0.03, 0.03, 0.05], trans: 0.03, f0: 0.045, metal: 0, ior: 1.4, dispersion: 0, trouble: 0, irisation: 0 },
  couleur: { tint: null, trans: 0.75, f0: 0.035, metal: 0, ior: 1.4, dispersion: 0.01, trouble: 0, irisation: 0 },
} as const;
/** Les réglages qu'un liquide pose en arrivant. */
export const liquidPreset = (name: keyof typeof LIQUIDS) => {
  const l = LIQUIDS[name] ?? LIQUIDS.eau;
  return { ior: l.ior, dispersion: l.dispersion, trouble: l.trouble, irisation: l.irisation };
};

export async function mountPhase(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const device = await getDevice();
  const ctx = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "opaque" });
  const mod = device.createShaderModule({ code: SHADER });
  const errs = (await mod.getCompilationInfo()).messages.filter((m) => m.type === "error");
  if (errs.length) throw new Error(errs.map((e) => `${e.lineNum}:${e.message}`).join("\n"));
  const pipe = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: mod, entryPoint: "vs" }, fragment: { module: mod, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
  const ubuf = device.createBuffer({ size: (HEAD + MAX) * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  const data = new Float32Array((HEAD + MAX) * 4);

  const cfg = {
    count: 9,
    fusion: 90,
    gap: 14,
    layers: 7,
    /** Orientation (degrés, convention Adobe) : axe de l'étirement et sens du courant. */
    angle: 30,
    /** 0 : aucun ; 3 : les distances comptent quatre fois moins le long de l'axe. */
    stretch: 0,
    /** Courant : 0 immobile, 1 rapide. */
    flow: 0,
    relief: 0,
    /** Lumière du relief (degrés). */
    light: 135,
    master: false,
    palette: "vermillon" as keyof typeof PALETTES,
    shape: "disque" as keyof typeof SHAPES,
    pointer: "ajoute" as "ajoute" | "creuse",
    speed: 1,
    paused: false,
    seed: 0,
    /** Les trames, une par une. */
    isolines: true,
    flats: "paliers" as keyof typeof FLATS,
    frontier: true,
    grain: true,
    /** Rendu : le diagramme à plat, ou les formes en liquide posé sur le papier. */
    render: "lignes" as "lignes" | "liquide",
    liquid: "eau" as keyof typeof LIQUIDS,
    /** Hauteur du liquide (px) et largeur du ménisque (× hauteur). */
    thickness: 26,
    meniscus: 2.2,
    fond: "quadrille" as keyof typeof FONDS,
    /** Optique. */
    ior: 1.333,
    /** Δn entre le rouge et le bleu (aberration chromatique). */
    dispersion: 0.006,
    /** Dôme au cœur des flaques : c'est lui qui fait loupe. */
    bombe: 0,
    /** Le liquide posé sur une plaque de verre à cette hauteur au-dessus du papier (px) : loupe, caustiques focalisées. */
    distance: 0,
    caustics: 0.8,
    reflets: 1,
    trouble: 0,
    depoli: 0,
    irisation: 0,
    ondes: 0,
  };
  const pointer = { x: 0, y: 0, in: false, r: 0 };
  canvas.addEventListener("pointermove", (e) => {
    const b = canvas.getBoundingClientRect();
    pointer.x = e.clientX - b.left;
    pointer.y = e.clientY - b.top;
    pointer.in = true;
  });
  canvas.addEventListener("pointerleave", () => (pointer.in = false));

  let stopped = false;
  let visible = true;
  let wantPng = false;
  const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
  io.observe(root);
  let prev = performance.now();
  let t = 0; // le temps de la simulation (vitesse, pause)
  let travel = 0; // le chemin parcouru par le courant (px)
  const wrap = (x: number, size: number, m: number) => ((((x + m) % (size + 2 * m)) + size + 2 * m) % (size + 2 * m)) - m;
  const frame = () => {
    if (stopped) return;
    requestAnimationFrame(frame);
    if (!visible && !wantPng) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    if (!cfg.paused) {
      t += dt * cfg.speed;
      travel += dt * cfg.speed * cfg.flow * 140;
    }
    const b = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2) * renderScale();
    const pw = Math.max(2, Math.round(b.width * dpr));
    const ph = Math.max(2, Math.round(b.height * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    const W = b.width;
    const H = b.height;
    const m = Math.min(W, H);
    const a = (cfg.angle * Math.PI) / 180;
    // L'écran a y vers le bas : l'angle « Adobe » monte quand sin est positif.
    const ax = Math.cos(a);
    const ay = -Math.sin(a);
    const la = (cfg.light * Math.PI) / 180;
    const L = [Math.cos(la), -Math.sin(la), 0.9];
    const ll = Math.hypot(L[0]!, L[1]!, L[2]!);
    const pal = PALETTES[cfg.palette] ?? PALETTES.vermillon;
    data.set([pw, ph, dpr, t], 0);
    data.set([pal.mode, cfg.master ? 1 : 0, SHAPES[cfg.shape] ?? 0, cfg.relief], 20);
    data.set([ax, ay, 1 + cfg.stretch, 0], 24);
    data.set([L[0]! / ll, L[1]! / ll, L[2]! / ll, 0], 28);
    let n = 0;
    for (let i = 0; i < cfg.count && n < MAX; i++, n++) {
      const s = i * 7.31 + cfg.seed * 13.7;
      const r = m * (0.055 + 0.05 * (0.5 + 0.5 * Math.sin(s * 1.7)));
      // Le courant pousse tout le monde dans le sens de l'orientation ; on revient par le bord opposé.
      const x = wrap(W * (0.5 + 0.42 * drift(t, s)) + ax * travel * (0.8 + 0.4 * Math.sin(s)), W, m * 0.3);
      const y = wrap(H * (0.5 + 0.4 * drift(t * 0.9, s + 3.7)) + ay * travel * (0.8 + 0.4 * Math.sin(s)), H, m * 0.3);
      data.set([x, y, r, s * 2.1 + t * 0.12 * Math.sin(s * 3.1)], HEAD * 4 + n * 4);
    }
    // Le pointeur : une forme qui gonfle quand il entre, se dégonfle quand il sort.
    pointer.r += ((pointer.in ? m * 0.07 : 0) - pointer.r) * (1 - Math.exp(-dt * 6));
    data.set([pointer.x, pointer.y, pointer.r, cfg.pointer === "creuse" ? -1 : 1], 32);
    data.set([n, cfg.fusion, cfg.gap, cfg.layers], 4);
    data.set(hex(pal.ink), 8);
    data.set(hex(pal.paper), 12);
    data.set(hex(pal.spot), 16);
    const liq = LIQUIDS[cfg.liquid] ?? LIQUIDS.eau;
    const tint = liq.tint ?? hex(pal.spot).slice(0, 3);
    data.set([cfg.render === "liquide" ? 1 : 0, FONDS[cfg.fond] ?? 0, cfg.meniscus, 0], 36);
    data.set([cfg.isolines ? 1 : 0, FLATS[cfg.flats] ?? 0, cfg.frontier ? 1 : 0, cfg.grain ? 1 : 0], 40);
    data.set([tint[0]!, tint[1]!, tint[2]!, liq.trans], 44);
    data.set([0, liq.f0, liq.metal, cfg.thickness], 48);
    data.set([Math.max(1, cfg.ior), cfg.dispersion, cfg.bombe, cfg.distance], 52);
    data.set([cfg.caustics, cfg.reflets, cfg.trouble, cfg.depoli], 56);
    data.set([cfg.irisation, cfg.ondes, 0, 0], 60);
    device.queue.writeBuffer(ubuf, 0, data);
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [1, 1, 1, 1] }] });
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bind);
    pass.draw(3);
    pass.end();
    device.queue.submit([enc.finish()]);
    if (wantPng) {
      // Lu dans la même tâche que le rendu : la toile n'est pas encore présentée, l'image est là.
      wantPng = false;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `diagramme-de-phase-${cfg.render === "liquide" ? cfg.liquid : cfg.palette}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, "image/png");
    }
  };
  requestAnimationFrame(frame);
  return {
    cfg,
    /** Une autre disposition des formes. */
    reseed() {
      cfg.seed = (cfg.seed + 1 + Math.floor(Math.random() * 97)) % 1000;
    },
    /** Télécharge l'image telle qu'elle est (taille de l'écran × dpr). */
    exportPng() {
      wantPng = true;
    },
    stop() {
      stopped = true;
      io.disconnect();
    },
  };
}
