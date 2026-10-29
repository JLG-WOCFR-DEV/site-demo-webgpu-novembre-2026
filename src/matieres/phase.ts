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
 * aux incidences rasantes, ombre portée teintée et caustique au bord de
 * l'ombre. Eau, mercure, miel, huile, encre, ou la couleur de la palette.
 */
import { renderScale } from "../gpu/governor.ts";
import { getDevice } from "../components/device.ts";

const MAX = 24;
const HEAD = 13; // vec4 avant le tableau des formes
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
  liqB: vec4f,     // indice de réfraction, F0, métal, hauteur (px)
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
  if (kind < 0.5) { return length(v0) - r; }
  let v = rot(v0, a);
  if (kind < 1.5) {
    let q = abs(v) - vec2f(r * 0.8);
    return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r * 0.2;
  }
  let h = r * 0.95;
  return length(vec2f(v.x - clamp(v.x, -h, h), v.y)) - r * 0.55;
}
/** Le champ : union douce des formes, puis le pointeur (ajouté ou creusé), en px. */
fn field(p: vec2f) -> f32 {
  var d = 1e6;
  let k = max(u.cfgv.y, 0.5);
  for (var i = 0; i < i32(u.cfgv.x); i++) {
    let b = u.balls[i];
    d = smin(d, shape(aniso(p - b.xy), b.z, b.w), k);
  }
  if (u.ptr.z > 0.5) {
    let pd = length(aniso(p - u.ptr.xy)) - u.ptr.z;
    if (u.ptr.w > 0.0) { d = smin(d, pd, k); } else { d = -smin(-d, pd, k * 0.6); }
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

/** Hauteur du liquide (px) pour un champ d : un ménisque arrondi au bord, plat au cœur (une flaque). */
fn liquidH(d: f32) -> f32 {
  let H = u.liqB.w;
  let t = clamp(-d / (H * u.ren.z), 0.0, 1.0);
  return H * (1.0 - pow(1.0 - t, 2.5));
}
/** Pente dh/d(−d). */
fn liquidDH(d: f32) -> f32 {
  let H = u.liqB.w;
  let w = H * u.ren.z;
  let t = clamp(-d / w, 0.0, 1.0);
  return select(0.0, 2.5 * H * pow(1.0 - t, 1.5) / w, t < 1.0);
}
/** Un studio : plafond sombre, murs de la couleur du papier, une grande fenêtre du côté de la lumière, une petite boîte à lumière en face. */
fn env(r: vec3f) -> vec3f {
  let L = u.lit.xyz;
  let wall = mix(u.paper.rgb * 0.55, vec3f(0.4), 0.3);
  // Plafond gris, et au zénith un grand diffuseur : le cœur plat d'une flaque de mercure le reflète.
  var c = mix(wall, vec3f(0.2, 0.2, 0.21), smoothstep(0.05, 0.7, r.z));
  c += vec3f(0.62, 0.62, 0.6) * smoothstep(0.8, 0.985, r.z);
  c = select(c, u.paper.rgb * 0.75, r.z < 0.0);
  // La fenêtre : un rectangle doux autour de la direction de la lumière.
  let az = normalize(vec2f(L.x, L.y) + vec2f(1e-4, 0.0));
  let wdir = normalize(vec3f(az * 0.72, 0.69));
  let t1 = normalize(vec3f(-az.y, az.x, 0.0));
  let t2 = cross(wdir, t1);
  let q = vec2f(dot(r, t1), dot(r, t2)) / max(dot(r, wdir), 1e-3);
  let win = (1.0 - smoothstep(0.38, 0.5, abs(q.x))) * (1.0 - smoothstep(0.22, 0.32, abs(q.y))) * step(0.0, dot(r, wdir));
  // Les croisillons de la fenêtre, pour que le reflet se lise comme une fenêtre.
  let bars = 1.0 - 0.85 * (1.0 - smoothstep(0.008, 0.02, abs(q.x))) - 0.85 * (1.0 - smoothstep(0.008, 0.02, abs(q.y)));
  c += vec3f(5.0, 4.9, 4.7) * win * bars;
  // En face, une petite boîte à lumière plus faible.
  let o = normalize(vec3f(-az * 0.55, 0.83));
  c += vec3f(1.6) * smoothstep(0.985, 0.995, dot(r, o));
  return c;
}
/** Le sol (le papier sous le liquide) au point q : fond, ombre portée, caustique. */
fn ground(q: vec2f, fw: f32) -> vec3f {
  var col = u.paper.rgb;
  let fond = u.ren.y;
  if (fond > 1.5) {
    col = diagram(q, field(q), fw);
  } else if (fond > 0.5) {
    // Papier millimétré : un trait fin tous les 8 px, appuyé tous les 40.
    let a = abs(fract(q / 8.0 + 0.5) - 0.5) * 8.0;
    let b = abs(fract(q / 40.0 + 0.5) - 0.5) * 40.0;
    let fine = 1.0 - smoothstep(0.35, 1.0, min(a.x, a.y));
    let bold = 1.0 - smoothstep(0.6, 1.3, min(b.x, b.y));
    col = mix(col, vec3f(0.36, 0.55, 0.72), max(fine * 0.28, bold * 0.6));
  }
  // L'ombre : le point regarde vers la lumière ; s'il y trouve du liquide, il est à l'ombre.
  let L = u.lit.xyz;
  let H = u.liqB.w;
  let lxy = normalize(L.xy + vec2f(1e-4, 0.0)) * (length(L.xy) / max(L.z, 0.2));
  let ds = field(q + lxy * H * 0.9);
  let w = H * u.ren.z;
  let s = clamp(-ds / w, 0.0, 1.0);
  let soft = smoothstep(H * 0.5, -H * 0.6, ds);
  let opaque = 1.0 - u.liqA.w;
  let tint = mix(vec3f(1.0), u.liqA.rgb, 0.6);
  col *= mix(vec3f(1.0), mix(tint * 0.93, vec3f(0.42), opaque), soft);
  // La caustique : le bord bombé concentre la lumière juste à l'intérieur de l'ombre.
  let caustic = u.liqA.w * exp(-pow((s - 0.22) / 0.07, 2.0)) * 0.16 + u.liqA.w * smoothstep(0.6, 1.0, s) * 0.05;
  col += caustic * mix(vec3f(1.0, 0.98, 0.92), u.liqA.rgb, 0.5);
  return col;
}
fn fresnel(f0: f32, c: f32) -> f32 { return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let p = i.p.xy / u.res.z;
  let d = field(p);
  let fw = max(fwidth(d), 1e-3);
  var col: vec3f;
  if (u.ren.x < 0.5) {
    col = diagram(p, d, fw);
  } else {
    let g = vec2f(field(p + vec2f(1.0, 0.0)) - d, field(p + vec2f(0.0, 1.0)) - d);
    let gl = max(length(g), 1e-3);
    // Normale : ∇h = −h'(d)·∇d ; on renormalise ∇d (l'union douce l'étire un peu).
    let slope = liquidDH(d) * g / gl;
    let nrm = normalize(vec3f(slope, 1.0));
    let h = liquidH(d);
    let v = vec3f(0.0, 0.0, 1.0);
    let ior = u.liqB.x;
    let metal = u.liqB.z;
    let F = fresnel(u.liqB.y, nrm.z);
    // Réfraction : le rayon entre par la surface, traverse h px de liquide jusqu'au papier.
    let rt = refract(-v, nrm, 1.0 / ior);
    let off = rt.xy / max(-rt.z, 0.2) * h;
    var through = ground(p + off, fw);
    // Absorption (Beer–Lambert) : la teinte donnée correspond à une hauteur pleine, aller-retour.
    let path = h / max(u.liqB.w, 1.0) * (1.0 + (1.0 - nrm.z) * 2.0);
    through *= pow(max(u.liqA.rgb, vec3f(1e-3)), vec3f(path));
    // Au bord, le rayon qui ressort va chercher loin et rase : le bord s'assombrit (comme une vraie goutte).
    // (pente du ménisque : 1 − n.z va de 0 au cœur à ≈ 0,35 au bord)
    let grazing = smoothstep(0.04, 0.3, 1.0 - nrm.z);
    through *= 1.0 - 0.62 * grazing * u.liqA.w;
    let r = reflect(-v, nrm);
    var refl = env(r);
    // Le reflet spéculaire du soleil (Blinn–Phong très serré) en plus de la fenêtre.
    let hv = normalize(u.lit.xyz + v);
    let spec = pow(max(dot(nrm, hv), 0.0), 900.0) * 18.0 + pow(max(dot(nrm, hv), 0.0), 60.0) * 0.25;
    refl += vec3f(spec);
    var liquid: vec3f;
    if (metal > 0.5) {
      // Mercure : tout est reflet, teinté par le métal.
      liquid = refl * mix(u.liqA.rgb, vec3f(1.0), F);
    } else {
      let trans = u.liqA.w;
      let body = mix(u.liqA.rgb * 0.18, through, trans);
      liquid = mix(body, refl, F);
    }
    // Les reflets forts sont comprimés (pas de blanc cramé à plat).
    liquid = liquid / (1.0 + max(liquid - vec3f(0.85), vec3f(0.0)) * 0.6);
    let a = 1.0 - smoothstep(-fw, fw, d);
    col = mix(ground(p, fw), liquid, a);
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
 * indice de réfraction, F0 (réflectance de face), métal. « couleur » prend la
 * couleur des phases de la palette.
 */
export const LIQUIDS = {
  eau: { tint: [0.9, 0.96, 0.98], trans: 1, ior: 1.33, f0: 0.02, metal: 0 },
  mercure: { tint: [0.78, 0.79, 0.82], trans: 0, ior: 1, f0: 0.78, metal: 1 },
  miel: { tint: [0.95, 0.52, 0.1], trans: 0.92, ior: 1.49, f0: 0.04, metal: 0 },
  huile: { tint: [0.86, 0.8, 0.3], trans: 0.97, ior: 1.47, f0: 0.035, metal: 0 },
  encre: { tint: [0.03, 0.03, 0.05], trans: 0.03, ior: 1.4, f0: 0.045, metal: 0 },
  couleur: { tint: null, trans: 0.75, ior: 1.4, f0: 0.035, metal: 0 },
} as const;

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
    data.set([liq.ior, liq.f0, liq.metal, cfg.thickness], 48);
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
