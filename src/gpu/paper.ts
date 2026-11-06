/**
 * Les filtres d'image de Paper Shaders (https://shaders.paper.design, @paper-design/shaders 0.0.82, Apache-2.0,
 * © 2026 Paper), portés de GLSL en WGSL pour la passe composite de Presse.
 *
 * Portés : halftone-dots, halftone-cmyk, image-dithering, fluted-glass, water, lens-distortion — mêmes paramètres, mêmes
 * défauts que les préréglages « Default » de la bibliothèque, mêmes formules. Adaptations, et elles seules :
 *   - l'image est ce que la page a déjà peint dans la boîte de l'élément (photo, texte, composant), relue par source() ;
 *     la boîte tient lieu de cadre (fit « cover », sans échelle ni rotation d'objet) ;
 *   - les dérivées (fwidth, dFdx) sont calculées à la main : la passe composite choisit le filtre pixel par pixel, hors du
 *     contrôle uniforme qu'exige WGSL ;
 *   - la texture de bruit de Paper est remplacée par son hachage procédural (hash22) ;
 *   - fluted-glass : sans marges ; flou plafonné à 2 × 16 prises ; lens-distortion : sans noise, lensCircle ni grain ;
 *     halftone-cmyk : encres C, M, J, N fixes (celles du préréglage), fond réglable ;
 *   - le résultat, prémultiplié, est posé sur le papier de la page.
 *
 * Dans une page : <img data-gl-img data-gl-filter="halftone-dots" data-gl-filter-opts="type: classic; grid: square;
 * size: .4; contrast: .6; colorFront: #1d2bd8"> — sur n'importe quel élément, comme une matière. Les options gardent
 * les noms de Paper : un réglage copié depuis shaders.paper.design se colle tel quel.
 */

type Spec = { slot: number; def: number | string; enum?: Record<string, number> };
type Filter = { id: number; params: Record<string, Spec>; colors: Record<string, [number, string]> };

/** Paramètres de chaque filtre : place dans le paquet (s0…s11 : trois vec4) et défaut du préréglage « Default » de Paper. */
export const PAPER_FILTERS: Record<string, Filter> = {
  "halftone-dots": {
    id: 1,
    params: {
      size: { slot: 0, def: 0.5 },
      radius: { slot: 1, def: 1.25 },
      contrast: { slot: 2, def: 0.4 },
      originalColors: { slot: 3, def: 0 },
      inverted: { slot: 4, def: 0 },
      grainMixer: { slot: 5, def: 0.2 },
      grainOverlay: { slot: 6, def: 0.2 },
      grainSize: { slot: 7, def: 0.5 },
      grid: { slot: 8, def: "hex", enum: { square: 0, hex: 1 } },
      type: { slot: 9, def: "gooey", enum: { classic: 0, gooey: 1, holes: 2, soft: 3 } },
    },
    colors: { colorFront: [0, "#2b2b2b"], colorBack: [1, "#f2f1e8"] },
  },
  "halftone-cmyk": {
    id: 2,
    params: {
      size: { slot: 0, def: 0.2 },
      contrast: { slot: 1, def: 1 },
      softness: { slot: 2, def: 1 },
      grainSize: { slot: 3, def: 0.5 },
      grainMixer: { slot: 4, def: 0 },
      grainOverlay: { slot: 5, def: 0 },
      gridNoise: { slot: 6, def: 0.2 },
      floodC: { slot: 7, def: 0.15 },
      floodM: { slot: 8, def: 0 },
      floodY: { slot: 9, def: 0 },
      floodK: { slot: 10, def: 0 },
      type: { slot: 11, def: "ink", enum: { dots: 0, ink: 1, sharp: 2 } },
      // Gains : dans le troisième vec4 de couleur.
      gainC: { slot: 20, def: 0.3 },
      gainM: { slot: 21, def: 0 },
      gainY: { slot: 22, def: 0.2 },
      gainK: { slot: 23, def: 0 },
    },
    colors: { colorBack: [0, "#fbfaf5"] },
  },
  "image-dithering": {
    id: 3,
    params: {
      size: { slot: 0, def: 2 },
      colorSteps: { slot: 1, def: 2 },
      type: { slot: 2, def: "8x8", enum: { random: 1, "2x2": 2, "4x4": 3, "8x8": 4 } },
      originalColors: { slot: 3, def: 0 },
      inverted: { slot: 4, def: 0 },
    },
    colors: { colorFront: [0, "#94ffaf"], colorBack: [1, "#000c38"], colorHighlight: [2, "#eaff94"] },
  },
  "fluted-glass": {
    id: 4,
    params: {
      size: { slot: 0, def: 0.5 },
      shadows: { slot: 1, def: 0.25 },
      angle: { slot: 2, def: 0 },
      stretch: { slot: 3, def: 0 },
      shape: { slot: 4, def: "lines", enum: { lines: 1, linesIrregular: 2, wave: 3, zigzag: 4, pattern: 5 } },
      distortion: { slot: 5, def: 0.5 },
      highlights: { slot: 6, def: 0.1 },
      distortionShape: { slot: 7, def: "prism", enum: { prism: 1, lens: 2, contour: 3, cascade: 4, flat: 5 } },
      shift: { slot: 8, def: 0 },
      blur: { slot: 9, def: 0 },
      edges: { slot: 10, def: 0.25 },
      grainMixer: { slot: 11, def: 0 },
    },
    colors: { colorBack: [0, "#00000000"], colorShadow: [1, "#000000"], colorHighlight: [2, "#ffffff"] },
  },
  water: {
    id: 5,
    params: {
      size: { slot: 0, def: 1 },
      highlights: { slot: 1, def: 0.07 },
      layering: { slot: 2, def: 0.5 },
      edges: { slot: 3, def: 0.8 },
      caustic: { slot: 4, def: 0.1 },
      waves: { slot: 5, def: 0.3 },
      speed: { slot: 6, def: 1 },
    },
    colors: { colorBack: [0, "#909090"], colorHighlight: [1, "#ffffff"] },
  },
  "lens-distortion": {
    id: 6,
    params: {
      spread: { slot: 0, def: 0.6 },
      bias: { slot: 1, def: 1 },
      angle: { slot: 2, def: 0 },
      perspective: { slot: 3, def: 0.1 },
      count: { slot: 4, def: 35 },
      dispersion: { slot: 5, def: 1 },
      dispersionShift: { slot: 6, def: 0 },
      dispersionColor: { slot: 7, def: 0.6 },
      focusCenter: { slot: 8, def: 0.8 },
      focusEdges: { slot: 9, def: 1 },
      swirl: { slot: 10, def: 0.35 },
      lensBulge: { slot: 11, def: 0 },
    },
    colors: {},
  },
};
/** Noms français, pour rester dans la langue des autres attributs. */
export const PAPER_ALIASES: Record<string, string> = {
  trame: "halftone-dots",
  cmjn: "halftone-cmyk",
  tramage: "image-dithering",
  cannele: "fluted-glass",
  eau: "water",
  dispersion: "lens-distortion",
};
export const paperName = (n: string) => (PAPER_FILTERS[n] ? n : PAPER_ALIASES[n] ?? null);

/** 24 flottants par élément : s0…s11, puis trois couleurs RGBA. */
export const PAPER_FLOATS = 24;

/** « #rgb », « #rrggbb », « #rrggbbaa » → RGBA 0…1. */
export function hexColor(v: string): [number, number, number, number] | null {
  const m = /^#?([0-9a-f]{3,8})$/i.exec(v.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 1];
}

/** « type: classic; size: .4; colorFront: #123 » → paquet de 24 flottants (défauts de Paper pour le reste). Null : filtre inconnu. */
export function packPaper(name: string, opts = "", out = new Float32Array(PAPER_FLOATS)): Float32Array | null {
  const key = paperName(name);
  if (!key) return null;
  const f = PAPER_FILTERS[key]!;
  const given = new Map<string, string>();
  for (const part of opts.split(";")) {
    const i = part.indexOf(":");
    if (i > 0) given.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  out.fill(0);
  for (const [k, sp] of Object.entries(f.params)) {
    const raw = given.get(k) ?? sp.def;
    let v: number;
    if (sp.enum) v = sp.enum[String(raw)] ?? sp.enum[String(sp.def)]!;
    else if (raw === "true" || raw === "false") v = raw === "true" ? 1 : 0;
    else v = Number(raw);
    if (!Number.isFinite(v)) v = Number(sp.def);
    out[sp.slot] = v;
  }
  for (const [k, [slot, def]] of Object.entries(f.colors)) {
    const c = hexColor(given.get(k) ?? def) ?? hexColor(def)!;
    out.set(c, 12 + slot * 4);
  }
  return out;
}

/* ───────────────────────── WGSL ───────────────────────── */

/** À inclure dans la passe composite, après source(), in_stage() et u (Post). Point d'entrée : paper_filter(px, st, i). */
export const PAPER_WGSL = /* wgsl */ `
// ───── Filtres d'image de Paper Shaders (Apache-2.0, © 2026 Paper, shaders.paper.design), portés en WGSL ─────
const PP_PI: f32 = 3.14159265358979;
const PP_TWO_PI: f32 = 6.28318530718;
var<private> pp_st: vec4f;
var<private> pp_s: array<f32, 12>;
var<private> pp_c0: vec4f;
var<private> pp_c1: vec4f;
var<private> pp_c2: vec4f;

fn pp_img(uv: vec2f) -> vec3f { return source(in_stage(pp_st.xy + uv * pp_st.zw, pp_st), vec2f(0.0)); }
fn pp_aspect() -> f32 { return pp_st.z / max(pp_st.w, 1.0); }
fn pp_mod(x: f32, y: f32) -> f32 { return x - y * floor(x / y); }
fn pp_hash21(p0: vec2f) -> f32 {
  var p = fract(p0 * vec2f(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}
fn pp_hash22(p0: vec2f) -> vec2f {
  var p = fract(p0 * vec2f(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p.yx + 19.19);
  return fract(vec2f(p.x * p.y, p.x + p.y));
}
fn pp_rot(uv: vec2f, th: f32) -> vec2f { return mat2x2f(cos(th), sin(th), -sin(th), cos(th)) * uv; }
fn pp_vnoise(st: vec2f) -> f32 {
  let i = floor(st);
  let f = fract(st);
  let a = pp_hash21(i);
  let b = pp_hash21(i + vec2f(1.0, 0.0));
  let c = pp_hash21(i + vec2f(0.0, 1.0));
  let d = pp_hash21(i + vec2f(1.0, 1.0));
  let u2 = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u2.x), mix(c, d, u2.x), u2.y);
}
fn pp_lst(e0: f32, e1: f32, x: f32) -> f32 { return clamp((x - e0) / (e1 - e0), 0.0, 1.0); }
/** Grain posé par-dessus (grainOverlay) : couleur (noir ou blanc) et force. */
fn pp_grain_overlay(grainUV: vec2f, amount: f32) -> vec2f {
  var g = pp_vnoise(pp_rot(grainUV, 1.0) + vec2f(3.0));
  g = mix(g, pp_vnoise(pp_rot(grainUV, 2.0) + vec2f(-1.0)), 0.5);
  g = pow(g, 1.3);
  let v = g * 2.0 - 1.0;
  return vec2f(step(0.0, v), pow(amount * abs(v), 0.8));
}

/* ── halftone-dots ── */
fn pp_ht_lum(uv: vec2f, contrast: f32, inverted: bool) -> f32 {
  let t = pp_img(uv);
  let c = 1.0 / (1.0 + exp(-contrast * (t - vec3f(0.5))));
  let lum = dot(vec3f(0.2126, 0.7152, 0.0722), c);
  return select(lum, 1.0 - lum, inverted);
}
fn pp_frame_pad(uv: vec2f, pad: vec2f) -> f32 {
  let aa = 0.0001;
  return smoothstep(-pad.x, -pad.x + aa, uv.x) * smoothstep(1.0 + pad.x, 1.0 + pad.x - aa, uv.x)
    * smoothstep(-pad.y, -pad.y + aa, uv.y) * smoothstep(1.0 + pad.y, 1.0 + pad.y - aa, uv.y);
}
fn pp_ball(uvf: vec2f, lum: f32, baseR: f32, ty: i32, grid: f32, aa: f32) -> f32 {
  let d = length(uvf - 0.5);
  if (ty == 0) {
    let r = mix(0.25 * baseR, 0.0, lum);
    return 1.0 - smoothstep(r - aa, r + aa, d);
  }
  if (ty == 1) {
    var sr = select(0.3, 0.42, grid == 1.0);
    sr = mix(sr * baseR, 0.0, lum);
    return pow(1.0 - smoothstep(0.0, sr, d), 2.0 + baseR);
  }
  if (ty == 2) {
    let inside = step(0.0, uvf.x) * (1.0 - step(1.0, uvf.x)) * step(0.0, uvf.y) * (1.0 - step(1.0, uvf.y));
    let r = mix(0.75 * baseR, 0.0, lum);
    let rm = pp_mod(r, 0.5);
    let circle = 1.0 - smoothstep(rm - aa, rm + aa, d);
    return select(inside - circle, circle, r < 0.5);
  }
  let sr = mix(0.5 * clamp(baseR, 0.0, 1.0), 0.0, lum);
  let v = 1.0 - pp_lst(0.0, sr, d);
  return pow(v, 4.0 + 3.0 * (1.0 - pp_lst(0.0, 2.0, baseR)));
}
fn pp_halftone_dots(uv0: vec2f) -> vec4f {
  let size = pp_s[0];
  let original = pp_s[3] > 0.5;
  let inverted = pp_s[4] > 0.5;
  let grid = pp_s[8];
  let ty = i32(pp_s[9] + 0.5);
  var mult = 1.0;
  if (ty == 0) { mult = 2.0; } else if (ty == 1 || ty == 3) { mult = 6.0; }
  let cells = mix(300.0, 7.0, pow(size, 0.7)) / mult;
  var pad = (1.0 / cells) * vec2f(1.0 / pp_aspect(), 1.0);
  if (ty == 1 && grid == 1.0) { pad *= 0.7; }
  let uv = (uv0 - 0.5) / pad;
  // fwidth(distance dans la cellule) : cellules par pixel.
  let aa = 1.0 / max(pad.y * pp_st.w, 1.0);
  var contrast = mix(0.0, 15.0, pow(pp_s[2], 1.5));
  var baseR = pp_s[1];
  if (original) {
    contrast = mix(0.1, 4.0, pow(pp_s[2], 2.0));
    baseR = 2.0 * pow(0.5 * pp_s[1], 0.3);
  }
  var tShape = 0.0;
  var tColor = vec3f(0.0);
  let stepSize = 1.0 / mult;
  let n = i32(mult);
  for (var ix = 0; ix < n; ix++) {
    for (var iy = 0; iy < n; iy++) {
      let x = -0.5 + f32(ix) * stepSize;
      let y = -0.5 + f32(iy) * stepSize;
      var off = vec2f(x, y);
      var skip = false;
      if (grid == 1.0) {
        var row = floor((y + 0.5) / stepSize);
        var col = floor((x + 0.5) / stepSize);
        if (stepSize == 1.0) {
          row = floor(uv.y + y + 1.0);
          if (ty == 1) { col = floor(uv.x + x + 1.0); }
        }
        if (ty == 1) {
          skip = pp_mod(row + col, 2.0) == 1.0;
        } else if (pp_mod(row, 2.0) == 1.0) {
          off.x += 0.5 * stepSize;
        }
      }
      if (skip) { continue; }
      let p = uv + off;
      let ui = floor(p);
      let uf = fract(p);
      let suv = (ui + 0.5 - off) * pad + vec2f(0.5);
      let frame = pp_frame_pad(suv, pad * stepSize);
      let lum = pp_ht_lum(suv, contrast, inverted);
      let ball = pp_ball(uf, lum, baseR, ty, grid, aa) * frame;
      tColor += pp_img(suv) * frame * ball;
      tShape += ball;
    }
  }
  let eps = 1e-4;
  tColor /= max(tShape, eps);
  let tOpacity = select(0.0, 1.0, tShape > eps);
  var shape = min(1.0, tShape);
  if (ty == 1) { shape = smoothstep(0.5 - 0.04, 0.5 + 0.04, tShape); }
  if (ty == 3) { shape = tShape; }
  let gs = mix(2000.0, 200.0, pp_s[7]) * vec2f(1.0, 1.0 / pp_aspect());
  let grainUV = (uv0 - 0.5) * gs + 0.5;
  if (pp_s[5] > 0.0) {
    var gr = pp_vnoise(grainUV);
    gr = smoothstep(0.55, 0.7 + 0.2 * pp_s[5], gr) * pp_s[5];
    shape = mix(shape, 0.0, gr);
  }
  var color: vec3f;
  var opacity: f32;
  if (original) {
    color = tColor * shape;
    opacity = tOpacity * shape;
    color += pp_c1.rgb * pp_c1.a * (1.0 - opacity);
    opacity += pp_c1.a * (1.0 - opacity);
  } else {
    color = pp_c0.rgb * pp_c0.a * shape;
    opacity = pp_c0.a * shape;
    color += pp_c1.rgb * pp_c1.a * (1.0 - opacity);
    opacity += pp_c1.a * (1.0 - opacity);
  }
  if (pp_s[6] > 0.0) {
    let g = pp_grain_overlay(grainUV, pp_s[6]);
    color = mix(color, vec3f(g.x), 0.5 * g.y);
    opacity += 0.5 * g.y;
  }
  return vec4f(color, clamp(opacity, 0.0, 1.0));
}

/* ── halftone-cmyk ── */
const PP_CMYK_C: vec3f = vec3f(0.0, 0.70588, 1.0);
const PP_CMYK_M: vec3f = vec3f(0.98824, 0.31765, 0.62353);
const PP_CMYK_Y: vec3f = vec3f(1.0, 0.84706, 0.0);
const PP_CMYK_K: vec3f = vec3f(0.13725, 0.12157, 0.12549);
fn pp_hash23(p: vec2f) -> vec3f {
  var p3 = fract(vec3f(p.x, p.y, p.x) * vec3f(0.3183099, 0.3678794, 0.3141592)) + 0.1;
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3f(p3.x * p3.y, p3.y * p3.z, p3.z * p3.x));
}
fn pp_vnoise3(st: vec2f) -> vec3f {
  let i = floor(st);
  let f = fract(st);
  let u2 = f * f * (3.0 - 2.0 * f);
  return mix(mix(pp_hash23(i), pp_hash23(i + vec2f(1.0, 0.0)), u2.x), mix(pp_hash23(i + vec2f(0.0, 1.0)), pp_hash23(i + vec2f(1.0, 1.0)), u2.x), u2.y);
}
fn pp_cmyk_of(rgb: vec3f, contrast: f32) -> vec4f {
  let c = clamp((rgb - 0.5) * contrast + 0.5, vec3f(0.0), vec3f(1.0));
  let mx = max(max(c.r, c.g), c.b);
  let inv = select(0.0, 1.0 / mx, mx > 1e-5);
  return vec4f((mx - c.r) * inv, (mx - c.g) * inv, (mx - c.b) * inv, 1.0 - mx);
}
fn pp_cell_center(uv: vec2f, off: vec2f, ch: f32, gridNoise: f32) -> vec2f {
  let cc = floor(uv) + 0.5 + off;
  return cc + (pp_hash22(floor(cc + ch * 50.0)) - 0.5) * gridNoise;
}
fn pp_grid_to_uv(cc: vec2f, ca: f32, sa: f32, shift: f32, pad: vec2f) -> vec2f {
  return (mat2x2f(ca, -sa, sa, ca) * (cc - shift)) * pad + 0.5;
}
fn pp_dot_mask(pos: vec2f, cc: vec2f, rad: f32, transparency: f32, grain: f32, addon: f32, gain: f32, comp: f32, joined: bool, softness: f32) -> f32 {
  let dist = length(pos - cc);
  var r = rad * (1.0 + comp);
  r += 0.15 + gain * r;
  r = max(0.0, r);
  r = mix(0.0, r, transparency);
  r += addon;
  r *= 1.0 - grain;
  var m = 1.0 - smoothstep(0.0, r, dist);
  if (joined) { m = pow(m, 1.2); } else { m = smoothstep(0.5 - 0.5 * softness, 0.51 + 0.49 * softness, m); }
  return m * mix(1.0, mix(0.5, 1.0, 1.5 * r), softness);
}
fn pp_halftone_cmyk(uv: vec2f) -> vec4f {
  let size = pp_s[0];
  let contrast = pp_s[1];
  let softness = pp_s[2];
  let gridNoise = pp_s[6];
  let ty = pp_s[11];
  let gains = pp_c2;
  let cells = mix(400.0, 7.0, pow(size, 0.7));
  let pad = (1.0 / cells) * vec2f(1.0 / pp_aspect(), 1.0);
  let g = (uv - 0.5) / pad;
  let inside = 1.0;
  let comp = 0.1 * softness + 0.1 * gridNoise + 0.1 * (1.0 - step(0.5, ty)) * (1.5 - softness);
  // Angles des quatre trames : 15°, 75°, 0°, 45°, et leurs décalages.
  let cC = 0.9659258; let sC = 0.2588190;
  let cM = 0.2588190; let sM = 0.9659258;
  let cK = 0.7071068; let sK = 0.7071068;
  let uvC = mat2x2f(cC, sC, -sC, cC) * g - 0.5;
  let uvM = mat2x2f(cM, sM, -sM, cM) * g - 0.25;
  let uvY = g + 0.2;
  let uvK = mat2x2f(cK, sK, -sK, cK) * g;
  let gs = mix(2000.0, 200.0, pp_s[3]) * vec2f(1.0, 1.0 / pp_aspect());
  let grainUV = (uv - 0.5) * gs + 0.5;
  var nv = vec3f(0.0);
  if (pp_s[4] > 0.0 || pp_s[5] > 0.0) { nv = pp_vnoise3(grainUV); }
  let grain = smoothstep(0.55, 1.0, nv.r) * pp_s[4];
  var m = vec4f(0.0);
  let joined = ty > 0.5;
  // Matrices inverses (transposées) pour revenir de la trame à l'image.
  if (ty < 1.5) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let o = vec2f(f32(dx), f32(dy));
        let ccC = pp_cell_center(uvC, o, 0.0, gridNoise);
        let ccM = pp_cell_center(uvM, o, 1.0, gridNoise);
        let ccY = pp_cell_center(uvY, o, 2.0, gridNoise);
        let ccK = pp_cell_center(uvK, o, 3.0, gridNoise);
        let kC = pp_cmyk_of(pp_img(pp_grid_to_uv(ccC, cC, sC, -0.5, pad)), contrast);
        let kM = pp_cmyk_of(pp_img(pp_grid_to_uv(ccM, cM, sM, -0.25, pad)), contrast);
        let kY = pp_cmyk_of(pp_img(pp_grid_to_uv(ccY, 1.0, 0.0, 0.2, pad)), contrast);
        let kK = pp_cmyk_of(pp_img(pp_grid_to_uv(ccK, cK, sK, 0.0, pad)), contrast);
        m.x += pp_dot_mask(uvC, ccC, kC.x, inside, grain, pp_s[7], gains.x, comp, joined, softness);
        m.y += pp_dot_mask(uvM, ccM, kM.y, inside, grain, pp_s[8], gains.y, comp, joined, softness);
        m.z += pp_dot_mask(uvY, ccY, kY.z, inside, grain, pp_s[9], gains.z, comp, joined, softness);
        m.w += pp_dot_mask(uvK, ccK, kK.w, inside, grain, pp_s[10], gains.w, comp, joined, softness);
      }
    }
  } else {
    let t = clamp((pp_img(uv) - 0.5) * contrast + 0.5, vec3f(0.0), vec3f(1.0));
    let k = 1.0 - max(max(t.r, t.g), t.b);
    let den = 1.0 - k;
    let cmy = select(vec3f(0.0), (1.0 - t - vec3f(k)) / den, den > 1e-5);
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let o = vec2f(f32(dx), f32(dy));
        m.x += pp_dot_mask(uvC, pp_cell_center(uvC, o, 0.0, gridNoise), cmy.x, inside, grain, pp_s[7], gains.x, comp, joined, softness);
        m.y += pp_dot_mask(uvM, pp_cell_center(uvM, o, 1.0, gridNoise), cmy.y, inside, grain, pp_s[8], gains.y, comp, joined, softness);
        m.z += pp_dot_mask(uvY, pp_cell_center(uvY, o, 2.0, gridNoise), cmy.z, inside, grain, pp_s[9], gains.z, comp, joined, softness);
        m.w += pp_dot_mask(uvK, pp_cell_center(uvK, o, 3.0, gridNoise), k, inside, grain, pp_s[10], gains.w, comp, joined, softness);
      }
    }
  }
  if (joined) {
    let th = 0.5;
    let sl = th * softness;
    let sr = (1.0 - th) * softness + 0.01;
    let fw = 0.03;
    m = smoothstep(vec4f(th - sl - fw), vec4f(th + sr), m);
  }
  var ink = vec3f(1.0);
  ink *= mix(vec3f(1.0), PP_CMYK_K, clamp(m.w, 0.0, 1.0));
  ink *= mix(vec3f(1.0), PP_CMYK_C, clamp(m.x, 0.0, 1.0));
  ink *= mix(vec3f(1.0), PP_CMYK_M, clamp(m.y, 0.0, 1.0));
  ink *= mix(vec3f(1.0), PP_CMYK_Y, clamp(m.z, 0.0, 1.0));
  let shape = clamp(max(max(m.x, m.y), max(m.z, m.w)), 0.0, 1.0);
  var color = mix(pp_c0.rgb * pp_c0.a, ink, shape);
  var opacity = clamp(pp_c0.a + shape, 0.0, 1.0);
  var go = mix(nv.g, nv.b, 0.5);
  go = pow(go, 1.3);
  let gv = go * 2.0 - 1.0;
  let gStrength = pow(pp_s[5] * abs(gv), 0.8);
  color = mix(color, vec3f(step(0.0, gv)), 0.5 * gStrength);
  opacity = clamp(opacity + 0.5 * gStrength, 0.0, 1.0);
  return vec4f(color, opacity);
}

/* ── image-dithering ── */
var<private> PP_B8: array<f32, 64> = array<f32, 64>(
  0., 32., 8., 40., 2., 34., 10., 42., 48., 16., 56., 24., 50., 18., 58., 26.,
  12., 44., 4., 36., 14., 46., 6., 38., 60., 28., 52., 20., 62., 30., 54., 22.,
  3., 35., 11., 43., 1., 33., 9., 41., 51., 19., 59., 27., 49., 17., 57., 25.,
  15., 47., 7., 39., 13., 45., 5., 37., 63., 31., 55., 23., 61., 29., 53., 21.);
var<private> PP_B4: array<f32, 16> = array<f32, 16>(0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
var<private> PP_B2: array<f32, 4> = array<f32, 4>(0., 2., 3., 1.);
fn pp_bayer(uv: vec2f, size: i32) -> f32 {
  let s = f32(size);
  let pos = vec2i(fract(uv / s) * s);
  let i = pos.y * size + pos.x;
  if (size == 2) { return PP_B2[i] / 4.0; }
  if (size == 4) { return PP_B4[i] / 16.0; }
  return PP_B8[i] / 64.0;
}
fn pp_image_dithering(px: vec2f) -> vec4f {
  let pxSize = max(pp_s[0], 0.5) * u.res.z;
  let center = pp_st.xy + pp_st.zw * 0.5;
  let q = (px - center) / pxSize;
  let pix = (floor(q) + 0.5) * pxSize;
  let uv = pix / pp_st.zw + 0.5;
  let img = pp_img(uv);
  let fpad = pxSize / pp_st.zw;
  let frame = pp_frame_pad(uv, fpad);
  let ty = i32(pp_s[2] + 0.5);
  var lum = dot(vec3f(0.2126, 0.7152, 0.0722), img);
  lum = select(lum, 1.0 - lum, pp_s[4] > 0.5);
  var dith = 0.0;
  if (ty == 1) { dith = step(pp_hash21(pix), lum); }
  else if (ty == 2) { dith = pp_bayer(q, 2); }
  else if (ty == 3) { dith = pp_bayer(q, 4); }
  else { dith = pp_bayer(q, 8); }
  let steps = max(floor(pp_s[1]), 1.0);
  dith -= 0.5;
  var bright = clamp(lum + dith / steps, 0.0, 1.0);
  bright = mix(0.0, bright, frame);
  var ql = floor(bright * steps + 0.5) / steps;
  ql = mix(0.0, ql, frame);
  var color: vec3f;
  var opacity = 1.0;
  if (pp_s[3] > 0.5) {
    color = img / max(lum, 0.001) * ql;
  } else {
    let hl = step(1.02 - 0.02 * pp_s[1], bright);
    let fg = mix(pp_c0.rgb * pp_c0.a, pp_c2.rgb * pp_c2.a, hl);
    let fgA = mix(pp_c0.a, pp_c2.a, hl);
    color = fg * ql;
    opacity = fgA * ql;
    color += pp_c1.rgb * pp_c1.a * (1.0 - opacity);
    opacity += pp_c1.a * (1.0 - opacity);
  }
  return vec4f(color, opacity);
}

/* ── fluted-glass ── */
fn pp_rot_aspect(p0: vec2f, a: f32, aspect: f32) -> vec2f {
  var p = p0;
  p.x *= aspect;
  p = pp_rot(p, a);
  p.x /= aspect;
  return p;
}
/** La coordonnée de cannelure (avant fract) au point uv : la forme du motif est là. */
fn pp_flute_x(uv0: vec2f, size: f32, rotation: f32, shape: f32) -> vec2f {
  let aspect = pp_aspect();
  var uv = (uv0 - 0.5) * mix(200.0, 5.0, size);
  uv = pp_rot_aspect(uv, rotation, aspect);
  let py = uv.y / aspect;
  var curve = 0.0;
  if (shape > 4.5) { curve = 0.5 + 0.5 * sin(0.5 * PP_PI * uv.x) * cos(0.5 * PP_PI * py); }
  else if (shape > 3.5) { curve = 10.0 * abs(fract(0.1 * py) - 0.5); }
  else if (shape > 2.5) { curve = 4.0 * sin(0.23 * py); }
  else if (shape > 1.5) { curve = 0.5 + 0.5 * sin(0.5 * uv.x) * sin(1.7 * uv.x); }
  return vec2f(uv.x + curve, uv.y + curve);
}
fn pp_frame_soft(uv: vec2f, softness: f32) -> f32 {
  let aa = 2.0 / pp_st.zw;
  return smoothstep(0.0, aa.x + softness, uv.x) * (1.0 - smoothstep(1.0 - softness - aa.x, 1.0, uv.x))
    * smoothstep(0.0, aa.y + softness, uv.y) * (1.0 - smoothstep(1.0 - softness - aa.y, 1.0, uv.y));
}
fn pp_fluted_glass(uv0: vec2f) -> vec4f {
  let size = pp_s[0];
  let rotation = -pp_s[2] * PP_PI / 180.0;
  let shape = pp_s[4];
  let psize = mix(200.0, 5.0, size);
  let aspect = pp_aspect();
  var uv = (uv0 - 0.5) * psize;
  uv = pp_rot_aspect(uv, rotation, aspect);
  let toFract = pp_flute_x(uv0, size, rotation, shape);
  // Dérivée de la coordonnée de cannelure, par différences finies d'un pixel (au lieu de fwidth).
  let dX = pp_flute_x(uv0 + vec2f(1.0 / pp_st.z, 0.0), size, rotation, shape).x - toFract.x;
  let dY = pp_flute_x(uv0 + vec2f(0.0, 1.0 / pp_st.w), size, rotation, shape).x - toFract.x;
  let fw = max(abs(dX) + abs(dY), 1e-4);
  var fo = fract(uv);
  var fl = floor(uv);
  // smoothFract
  let f0 = fract(toFract.x);
  let edge = abs(f0 - 0.5) - 0.5;
  var x = mix(f0, 1.0 - f0, smoothstep(-fw, fw, edge));
  let xn = fract(toFract.x) + 0.0001;
  let hw = 2.0 * max(0.001, fw);
  var highlights = 1.0 - smoothstep(0.0, hw, xn) * smoothstep(1.0, 1.0 - hw, xn);
  highlights = clamp(highlights * pp_s[6], 0.0, 1.0);
  var shadows = pow(x, 1.3);
  var distortion = 0.0;
  var fadeX = 1.0;
  var frameFade = 0.0;
  var aa = max(fw, 0.0001);
  let ds = pp_s[7];
  let shift = pp_s[8];
  if (ds == 1.0) {
    distortion = -pow(1.5 * x, 3.0) + (0.5 - shift);
    frameFade = pow(1.5 * x, 3.0);
    aa = max(0.2, aa) + mix(0.2, 0.0, size);
    fadeX = smoothstep(0.0, aa, xn) * smoothstep(1.0, 1.0 - aa, xn);
    distortion = mix(0.5, distortion, fadeX);
  } else if (ds == 2.0) {
    distortion = 2.0 * pow(x, 2.0) - (0.5 + shift);
    frameFade = pow(abs(x - 0.5), 4.0);
    aa = max(0.2, aa) + mix(0.2, 0.0, size);
    fadeX = smoothstep(0.0, aa, xn) * smoothstep(1.0, 1.0 - aa, xn);
    distortion = mix(0.5, distortion, fadeX);
    frameFade = mix(1.0, frameFade, 0.5 * fadeX);
  } else if (ds == 3.0) {
    distortion = pow(2.0 * (xn - 0.5), 6.0) - 0.25 - shift;
    frameFade = 1.0 - 2.0 * pow(abs(x - 0.4), 2.0);
    aa = 0.15 + mix(0.1, 0.0, size);
    fadeX = smoothstep(0.0, aa, xn) * smoothstep(1.0, 1.0 - aa, xn);
    frameFade = mix(1.0, frameFade, fadeX);
  } else if (ds == 4.0) {
    x = xn;
    distortion = sin((x + 0.25) * PP_TWO_PI);
    shadows = 0.5 + 0.5 * asin(distortion) / (0.5 * PP_PI);
    distortion = distortion * 0.5 - shift;
    frameFade = 0.5 + 0.5 * sin(x * PP_TWO_PI);
  } else if (ds == 5.0) {
    distortion = (-pow(abs(x), 0.2) * x + 0.33 - 3.0 * shift) * 0.33;
    frameFade = 0.3 * smoothstep(0.0, 1.0, x);
    shadows = pow(x, 2.5);
    aa = max(0.1, aa) + mix(0.1, 0.0, size);
    fadeX = smoothstep(0.0, aa, xn) * smoothstep(1.0, 1.0 - aa, xn);
    distortion *= fadeX;
  }
  let grainUV = (uv0 - 0.5) * 0.8 * pp_st.zw + 0.5;
  if (pp_s[11] > 0.0) {
    let gr = smoothstep(0.4, 0.7, pp_vnoise(grainUV)) * pp_s[11];
    distortion = mix(distortion, 0.0, gr);
  }
  shadows = clamp(min(shadows, 1.0) * pow(pp_s[1], 2.0), 0.0, 1.0);
  distortion *= 3.0 * pp_s[5];
  frameFade *= pp_s[5];
  fo.x += distortion;
  fl = pp_rot_aspect(fl, -rotation, aspect);
  fo = pp_rot_aspect(fo, -rotation, aspect);
  var suv = (fl + fo) / psize + vec2f(0.5);
  let edges = mix(0.0, 0.04, pp_s[10]) + 0.06 * frameFade * pp_s[10];
  let frame = pp_frame_soft(suv, edges);
  var stretch = 1.0 - smoothstep(0.0, 0.5, xn) * smoothstep(1.0, 0.5, xn);
  stretch = pow(stretch, 2.0) * pp_frame_soft(suv, 0.1 + 0.05 * frameFade);
  suv.y = mix(suv.y, 0.5, pp_s[3] * stretch);
  // Flou vertical (gaussien), 2 × 16 prises au plus.
  var img = pp_img(suv);
  let sigma = mix(0.0, 50.0, pp_s[9]) * u.res.z;
  if (sigma > 0.5) {
    let stepPx = max(1.0, 3.0 * sigma / 16.0);
    var sum = img;
    var wsum = 1.0;
    for (var i = 1; i <= 16; i++) {
      let d = f32(i) * stepPx;
      let w = exp(-(d * d) / (2.0 * sigma * sigma));
      let o = vec2f(0.0, d / pp_st.w);
      sum += (pp_img(suv + o) + pp_img(suv - o)) * w;
      wsum += 2.0 * w;
    }
    img = sum / wsum;
  }
  var color = pp_c2.rgb * pp_c2.a * highlights;
  var opacity = pp_c2.a * highlights;
  shadows = mix(shadows * pp_c1.a, 0.0, highlights);
  color = mix(color, pp_c1.rgb * pp_c1.a, 0.5 * shadows);
  color += 0.5 * pow(shadows, 0.5) * pp_c1.rgb;
  opacity += shadows;
  color = clamp(color, vec3f(0.0), vec3f(1.0));
  opacity = clamp(opacity, 0.0, 1.0);
  color += img * (1.0 - opacity) * frame;
  opacity += (1.0 - opacity) * frame;
  color += pp_c0.rgb * pp_c0.a * (1.0 - opacity);
  opacity += pp_c0.a * (1.0 - opacity);
  return vec4f(color, clamp(opacity, 0.0, 1.0));
}

/* ── water ── */
fn pp_mod289v3(x: vec3f) -> vec3f { return x - 289.0 * floor(x / 289.0); }
fn pp_permute(x: vec3f) -> vec3f { return pp_mod289v3((x * 34.0 + 1.0) * x); }
fn pp_snoise(v: vec2f) -> f32 {
  let C = vec4f(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  var i = floor(v + dot(v, C.yy));
  let x0 = v - i + dot(i, C.xx);
  let i1 = select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), x0.x > x0.y);
  var x12 = x0.xyxy + C.xxzz;
  x12 = vec4f(x12.xy - i1, x12.zw);
  i = i - 289.0 * floor(i / 289.0);
  let p = pp_permute(pp_permute(i.y + vec3f(0.0, i1.y, 1.0)) + i.x + vec3f(0.0, i1.x, 1.0));
  var m = max(vec3f(0.5) - vec3f(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3f(0.0));
  m = m * m;
  m = m * m;
  let x = 2.0 * fract(p * C.www) - 1.0;
  let h = abs(x) - 0.5;
  let ox = floor(x + 0.5);
  let a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  let g = vec3f(a0.x * x0.x + h.x * x0.y, a0.y * x12.x + h.y * x12.y, a0.z * x12.z + h.z * x12.w);
  return 130.0 * dot(m, g);
}
fn pp_caustic(uv0: vec2f, t: f32, scale0: f32) -> f32 {
  var uv = uv0;
  var n = vec2f(0.1);
  var N = vec2f(0.1);
  var scale = scale0;
  let m = mat2x2f(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (var j = 0; j < 6; j++) {
    uv = m * uv;
    n = m * n;
    let fj = f32(j);
    let q = uv * scale + fj + n + (0.5 + 0.5 * fj) * (pp_mod(fj, 2.0) - 1.0) * t;
    n += sin(q);
    N += cos(q) / scale;
    scale *= 1.1;
  }
  return N.x + N.y + 1.0;
}
fn pp_water(uv0: vec2f) -> vec4f {
  var puv = (uv0 - 0.5) * vec2f(pp_aspect(), 1.0);
  puv /= 0.01 + 0.09 * pp_s[0];
  let t = select(u.res.w * pp_s[6], 0.0, u.pointer.w > 0.5);
  let waves = pp_s[5];
  let wn = pp_snoise((0.3 + 0.1 * sin(t)) * 0.1 * puv + vec2f(0.0, 0.4 * t));
  var cn = pp_caustic(puv + waves * vec2f(1.0, -1.0) * wn, 2.0 * t, 1.5);
  if (pp_s[2] > 0.0) { cn += pp_s[2] * pp_caustic(puv + 2.0 * waves * vec2f(1.0, -1.0) * wn, 1.5 * t, 2.0); }
  cn = cn * cn;
  var ed = smoothstep(0.0, 0.1, uv0.x) * smoothstep(0.0, 0.1, uv0.y);
  ed *= smoothstep(1.0, 1.1, uv0.x) + (1.0 - smoothstep(0.8, 0.95, uv0.x));
  ed *= 1.0 - smoothstep(0.9, 1.0, uv0.y);
  ed = mix(ed, 1.0, pp_s[3]);
  var iuv = uv0;
  let wd = 0.1 * waves * wn;
  iuv += vec2f(wd, -wd);
  iuv += pp_s[4] * 0.02 * cn * ed;
  let frame = pp_frame_soft(iuv, 0.0);
  let img = pp_img(iuv);
  var color = mix(pp_c0.rgb * pp_c0.a, img, frame);
  var opacity = pp_c0.a + frame;
  cn = max(-0.2, cn);
  let hl = 0.025 * pp_s[1] * cn * pp_c1.a;
  color = mix(color, pp_c1.rgb, 0.05 * pp_s[1] * cn * pp_c1.a);
  opacity += hl;
  color += hl * (0.5 + 0.5 * wn);
  opacity += hl * (0.5 + 0.5 * wn);
  return vec4f(color, clamp(opacity, 0.0, 1.0));
}

/* ── lens-distortion ── */
fn pp_hue(h: f32) -> vec3f {
  var rgb = clamp(abs((h * 6.0 + vec3f(0.0, 4.0, 2.0)) - 6.0 * floor((h * 6.0 + vec3f(0.0, 4.0, 2.0)) / 6.0) - 3.0) - 1.0, vec3f(0.0), vec3f(1.0));
  return rgb * rgb * (3.0 - 2.0 * rgb);
}
fn pp_lens(uv0: vec2f) -> vec4f {
  let aspect = pp_aspect();
  let spreadP = pp_s[0];
  let bias = pp_s[1];
  let perspective = pp_s[3];
  let bulgeP = pp_s[11];
  let inradius = 0.5 * min(aspect, 1.0);
  let outradius = 0.5 * length(vec2f(aspect, 1.0));
  let reach = 0.7 * pow(spreadP, 1.3 + 2.7 * spreadP);
  var fc = uv0 - 0.5;
  fc.x *= aspect;
  let radius = length(fc);
  // Bombé de lentille (lensBulge).
  var wf = fc;
  var bulgeFade = 1.0;
  if (bulgeP != 0.0 && radius > 1e-5) {
    let rn = radius / inradius;
    let bulge = abs(bulgeP) * select(1.2, 1.4, bulgeP > 0.0);
    if (bulgeP > 0.0) { bulgeFade = 1.0 - smoothstep(1.45, 1.53, rn * bulge); }
    let map = select(atan(rn * tan(bulge)) / bulge, tan(min(rn * bulge, 1.53)) / tan(bulge), bulgeP > 0.0);
    wf *= map / rn;
  }
  let baseUV = vec2f(wf.x / aspect, wf.y) + 0.5;
  let edgeAA = clamp(2.0 * max(1.0 / pp_st.z, 1.0 / pp_st.w), 0.001, 0.02);
  // Éventail : direction uniforme (angle) mêlée à la direction radiale (perspective).
  let ar = radians(pp_s[2]);
  let uniformDir = vec2f(cos(ar), sin(ar));
  var radialDir = fc / inradius;
  let maxLen = (outradius + reach) / inradius;
  let rl = radius / inradius;
  if (rl > maxLen) { radialDir *= maxLen / rl; }
  let spreadDir = mix(uniformDir, radialDir, perspective);
  let wa = abs(baseUV - 0.5);
  let inner = mix(1.0, smoothstep(0.0, mix(inradius, outradius, pp_s[8]), radius), pp_s[8]);
  let boxDist = max(wa.x, wa.y) * 2.0;
  let outer = mix(1.0, 1.0 - min(boxDist, 1.0), pp_s[9]);
  var strength = inner * outer;
  let outside = max(wa - 0.5, vec2f(0.0));
  let margin = max(reach * length(spreadDir), edgeAA);
  strength *= 1.0 - smoothstep(0.0, margin, length(outside));
  var axis = spreadDir * (reach * strength);
  axis.x /= aspect;
  let count = clamp(floor(pp_s[4]), 1.0, 50.0);
  let n = i32(count);
  let invCount = 1.0 / count;
  let invSpan = 1.0 / max(count - 1.0, 1.0);
  let hueBase = pp_s[7] + 0.5;
  let biasPow = 1.0 + 2.0 * abs(bias);
  let centerAmt = clamp(1.0 - pp_s[6], 0.0, 1.0);
  let edgesAmt = clamp(1.0 + pp_s[6], 0.0, 1.0);
  let innerMask = 1.0 - smoothstep(0.5 * inradius, 1.1 * inradius, radius);
  let dispersion = pp_s[5] * mix(edgesAmt, centerAmt, innerMask);
  let dpow = pow(dispersion, 0.8);
  let swirlAngle = pp_s[10] * 0.4 * PP_PI * strength * spreadP * min(1.0, inradius / max(length(wf), 1e-4));
  var cs = vec3f(0.0);
  var ws = vec3f(0.0);
  var cover = 0.0;
  for (var i = 0; i < 50; i++) {
    if (i >= n) { break; }
    let layer = f32(i);
    let hue = hueBase + layer * invCount;
    var sp = layer * invSpan;
    if (bias != 0.0) {
      let mt = select(sp, 1.0 - sp, bias < 0.0);
      let cv = pow(mt, biasPow);
      sp = select(cv, 1.0 - cv, bias < 0.0);
    }
    let fan = 1.0 - 2.0 * sp;
    var tuv = baseUV + axis * fan - 0.5;
    if (pp_s[10] != 0.0) {
      tuv.x *= aspect;
      tuv = pp_rot(tuv, swirlAngle * fan);
      tuv.x /= aspect;
    }
    tuv += 0.5;
    let fr = pp_frame_soft(tuv, 0.0);
    let tap = mix(vec3f(1.0), pp_img(tuv), fr);
    let w = 1.0 - dpow * pp_hue(hue);
    cs += tap * w;
    ws += w;
    cover += fr;
  }
  let color = cs / max(ws, vec3f(1e-4));
  let ground = min(color.r, min(color.g, color.b));
  let alpha = max(cover * invCount, 1.0 - ground);
  return vec4f(max(color - (1.0 - alpha), vec3f(0.0)), alpha) * bulgeFade;
}

/** Le filtre de Paper du pixel px, dans la boîte st, réglé par le paquet n° i (24 flottants). */
fn paper_filter(px: vec2f, st: vec4f, i: i32) -> vec3f {
  pp_st = st;
  let b = i * 6;
  let a = u.pfx[b];
  let a1 = u.pfx[b + 1];
  let a2 = u.pfx[b + 2];
  pp_s = array<f32, 12>(a.x, a.y, a.z, a.w, a1.x, a1.y, a1.z, a1.w, a2.x, a2.y, a2.z, a2.w);
  pp_c0 = u.pfx[b + 3];
  pp_c1 = u.pfx[b + 4];
  pp_c2 = u.pfx[b + 5];
  let id = i32(u.pfk[i / 4][i % 4] + 0.5);
  let uv = (px - st.xy) / st.zw;
  var r = vec4f(0.0);
  if (id == 1) { r = pp_halftone_dots(uv); }
  else if (id == 2) { r = pp_halftone_cmyk(uv); }
  else if (id == 3) { r = pp_image_dithering(px); }
  else if (id == 4) { r = pp_fluted_glass(uv); }
  else if (id == 5) { r = pp_water(uv); }
  else if (id == 6) { r = pp_lens(uv); }
  else { return source(px, vec2f(0.0)); }
  // Prémultiplié, posé sur le papier de la page.
  return r.rgb + u.paper.rgb * (1.0 - r.a);
}
`;

/** Paquet d'un élément, gardé tant que ses attributs ne changent pas. */
const packs = new Map<string, { id: number; data: Float32Array } | null>();
export function paperPack(name: string, opts: string) {
  const key = `${name}|${opts}`;
  let p = packs.get(key);
  if (p === undefined) {
    const n = paperName(name);
    const data = n ? packPaper(n, opts) : null;
    p = data && n ? { id: PAPER_FILTERS[n]!.id, data } : null;
    if (!p && name) console.warn(`[presse] data-gl-filter="${name}" inconnu (${[...Object.keys(PAPER_FILTERS), ...Object.keys(PAPER_ALIASES)].join(", ")})`);
    if (packs.size > 256) packs.clear();
    packs.set(key, p);
  }
  return p;
}

/** La taille de Paper (0…1) qui donne `cells` cellules sur la hauteur, pour une grille de base `base` divisée par `mult`. */
function sizeForCells(cells: number, base: number, mult: number) {
  const t = (base - cells * mult) / (base - 7);
  return Math.min(1, Math.max(0, t)) ** (1 / 0.7);
}

/**
 * Chapitre 06 : la plaque « filtre » et ses réglages (genre, taille 2…16 px, intensité 0…1) traduits en filtres de Paper.
 * Genres 0 trame, 1 tramage, 2 verre cannelé, 6 CMJN, 7 eau, 8 dispersion ; les autres (lentille, papier froissé,
 * casse de plomb) restent ceux de Presse.
 */
export function chapterPaper(f: { kind: number; size: number; amount: number }, heightPx: number) {
  const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  const cells = (px: number) => Math.max(4, heightPx / (px * dpr));
  const a = f.amount;
  const k = f.kind;
  const n = (v: number) => +v.toFixed(3);
  let opts: string | null = null;
  let name = "";
  if (k === 0) {
    name = "halftone-dots";
    opts = `type: classic; grid: square; size: ${n(sizeForCells(cells(f.size * 1.6), 300, 2))}; radius: 1.25; contrast: ${n(0.25 + a * 0.6)}; grainMixer: 0; grainOverlay: 0; colorFront: #121212; colorBack: #efeee8`;
  } else if (k === 1) {
    name = "image-dithering";
    opts = `type: 8x8; size: ${n(f.size * 0.5)}; colorSteps: ${1 + Math.round(a * 3)}; colorFront: #efeee8; colorBack: #121212; colorHighlight: #efeee8`;
  } else if (k === 2) {
    name = "fluted-glass";
    opts = `size: ${n(0.55 + ((f.size - 2) / 14) * 0.4)}; distortion: ${n(a)}; shape: lines; distortionShape: prism; highlights: 0.1; shadows: 0.25; edges: 0.25`;
  } else if (k === 6) {
    name = "halftone-cmyk";
    opts = `type: ink; size: ${n(sizeForCells(cells(f.size * 1.4), 400, 1))}; contrast: ${n(0.6 + a * 0.8)}; softness: 1`;
  } else if (k === 7) {
    name = "water";
    opts = `size: ${n(0.6 + ((f.size - 2) / 14) * 0.4)}; caustic: ${n(0.03 + a * 0.14)}; waves: ${n(0.1 + a * 0.4)}; highlights: 0.07; layering: 0.5; edges: 0.8; colorBack: #efeee8`;
  } else if (k === 8) {
    name = "lens-distortion";
    opts = `spread: ${n(0.25 + a * 0.6)}; count: ${Math.round(12 + (f.size - 2) * 2)}; dispersion: 1; swirl: 0.35; perspective: 0.1`;
  }
  return opts ? paperPack(name, opts) : null;
}
