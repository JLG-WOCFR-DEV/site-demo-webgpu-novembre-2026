/**
 * Interprétations originales pour le sampler PLI, sans bibliothèque de shaders.
 *
 * Le programme hôte fournit fx_sample(uv, region), avec des UV locales 0…1 et
 * un clamp au spécimen. Ce module ne possède aucune texture ni aucun binding.
 * Il ne mélange pas l'effet à l'original : quantité et comparaison appartiennent
 * au programme hôte. Les couleurs d'entrée sont celles de la scène précomposée.
 *
 * Les motifs sont antialiasés en pixels CSS, sans dérivée implicite : le module
 * peut être appelé dans une région conditionnelle du fragment shader.
 * Lectures par fragment, hors programme hôte :
 *   0:1, 1:8, 2:5, 3:1, 4:1, 5:3, 6:5, 7:5, 8:1, 9:12, 10:3, 11:1.
 * Seuls 2, 3, 5, 6, 7, 9 et 11 utilisent le temps.
 */
export const SAMPLER_EFFECTS = /* wgsl */ `
struct FxParams {
  region: vec4f,
  size: vec2f,
  point: vec2f,
  time: f32,
  scale: f32,
  mode: u32,
};

fn sfx_sample(uv: vec2f, p: FxParams) -> vec3f {
  return fx_sample(clamp(uv, vec2f(0.0), vec2f(1.0)), p.region);
}

fn sfx_luma(c: vec3f) -> f32 {
  // Valeur de travail sur les couleurs encodées de PLI, pas une mesure physique.
  return clamp(dot(c, vec3f(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}

fn sfx_hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.17, 311.73))) * 43757.53);
}

fn sfx_noise(p: vec2f) -> f32 {
  let cell = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = mix(sfx_hash(cell), sfx_hash(cell + vec2f(1.0, 0.0)), w.x);
  let b = mix(sfx_hash(cell + vec2f(0.0, 1.0)), sfx_hash(cell + vec2f(1.0)), w.x);
  return mix(a, b, w.y);
}

fn sfx_band(position: f32, spacing: f32, halfWidth: f32) -> f32 {
  let distance = abs(fract(position / spacing) - 0.5) * spacing;
  return 1.0 - smoothstep(max(halfWidth - 0.55, 0.0), halfWidth + 0.55, distance);
}

fn sfx_normal(uv: vec2f, p: FxParams, radius: f32, height: f32) -> vec3f {
  let stepUv = vec2f(radius) / p.size;
  let left = sfx_luma(sfx_sample(uv - vec2f(stepUv.x, 0.0), p));
  let right = sfx_luma(sfx_sample(uv + vec2f(stepUv.x, 0.0), p));
  let top = sfx_luma(sfx_sample(uv - vec2f(0.0, stepUv.y), p));
  let bottom = sfx_luma(sfx_sample(uv + vec2f(0.0, stepUv.y), p));
  return normalize(vec3f((left - right) * height, (top - bottom) * height, 1.0));
}

fn sfx_light(p: FxParams) -> vec3f {
  let hand = (p.point - vec2f(0.5)) * 1.8;
  let orbit = vec2f(0.65 * cos(p.time * 0.24), -0.55 + 0.32 * sin(p.time * 0.24));
  return normalize(vec3f(hand + orbit, 1.1));
}

// 0 — Hachures fixes : la valeur règle la largeur de deux familles d'encre.
fn sfx_engraving(uv: vec2f, p: FxParams) -> vec3f {
  let source = sfx_sample(uv, p);
  let value = sfx_luma(source);
  let px = uv * p.size;
  let spacing = mix(3.0, 8.8, p.scale);
  let bend = sin(px.x / (31.0 + 37.0 * p.scale)) * spacing * 0.13 * (1.0 - value);
  let width = spacing * (0.025 + 0.40 * pow(1.0 - value, 0.85));
  let first = sfx_band(dot(px, vec2f(0.8, 0.6)) + bend, spacing, width)
    * (1.0 - smoothstep(0.86, 0.99, value));
  let dark = clamp((0.61 - value) / 0.61, 0.0, 1.0);
  let second = sfx_band(dot(px, vec2f(-0.68, 0.733)) - bend, spacing * 1.08, spacing * 0.36 * dark)
    * smoothstep(0.0, 0.12, dark);
  let ink = 1.0 - (1.0 - first) * (1.0 - second * 0.94);
  return mix(vec3f(0.969, 0.947, 0.895), vec3f(0.105, 0.128, 0.137), ink);
}

// 1 — Noyau Sobel 3×3 ; le centre a un poids nul, donc huit lectures.
fn sfx_sobel(uv: vec2f, p: FxParams) -> vec3f {
  let d = vec2f(mix(0.8, 3.4, p.scale)) / p.size;
  let tl = sfx_luma(sfx_sample(uv + vec2f(-d.x, -d.y), p));
  let tc = sfx_luma(sfx_sample(uv + vec2f(0.0, -d.y), p));
  let tr = sfx_luma(sfx_sample(uv + vec2f(d.x, -d.y), p));
  let ml = sfx_luma(sfx_sample(uv + vec2f(-d.x, 0.0), p));
  let mr = sfx_luma(sfx_sample(uv + vec2f(d.x, 0.0), p));
  let bl = sfx_luma(sfx_sample(uv + vec2f(-d.x, d.y), p));
  let bc = sfx_luma(sfx_sample(uv + vec2f(0.0, d.y), p));
  let br = sfx_luma(sfx_sample(uv + vec2f(d.x, d.y), p));
  let gx = tr + 2.0 * mr + br - tl - 2.0 * ml - bl;
  let gy = bl + 2.0 * bc + br - tl - 2.0 * tc - tr;
  let edge = smoothstep(0.035, 0.24, length(vec2f(gx, gy)) * 0.25);
  return mix(vec3f(0.969, 0.953, 0.917), vec3f(0.075, 0.115, 0.153), edge);
}

// 2 — Embossage de luminance. Aucune profondeur réelle n'est déduite de la photo.
fn sfx_relief(uv: vec2f, p: FxParams) -> vec3f {
  let source = sfx_sample(uv, p);
  let normal = sfx_normal(uv, p, mix(0.9, 3.5, p.scale), 7.5);
  let light = sfx_light(p);
  let diffuse = max(dot(normal, light), 0.0);
  let halfway = normalize(light + vec3f(0.0, 0.0, 1.0));
  let sheen = pow(max(dot(normal, halfway), 0.0), 22.0);
  let albedo = mix(vec3f(0.74, 0.69, 0.58), source, 0.22);
  return albedo * (0.35 + 0.70 * diffuse) * (0.66 + 0.34 * sfx_luma(source))
    + vec3f(sheen * 0.11);
}

// 3 — Secteurs miroirs avec correction du ratio ; une seule lecture remappée.
fn sfx_kaleidoscope(uv: vec2f, p: FxParams) -> vec3f {
  let aspect = p.size / min(p.size.x, p.size.y);
  let local = (uv - p.point) * aspect;
  let radius = length(local);
  var angle = 0.0;
  if (radius > 0.000001) {
    angle = atan2(local.y, local.x);
  }
  let segments = floor(mix(12.0, 4.0, p.scale) + 0.5);
  let wedge = 6.28318530718 / segments;
  let folded = abs(fract((angle + p.time * 0.12) / wedge + 0.5) - 0.5) * wedge;
  let sampleUv = p.point + vec2f(cos(folded), sin(folded)) * radius / aspect;
  let mirrored = vec2f(1.0) - abs(fract(sampleUv * 0.5) * 2.0 - vec2f(1.0));
  return sfx_sample(mirrored, p);
}

// 4 — Cellules de Voronoï fixes : neuf centres candidats, une lecture photo.
fn sfx_facets(uv: vec2f, p: FxParams) -> vec3f {
  let cellPx = mix(14.0, 68.0, p.scale);
  let grid = uv * p.size / cellPx;
  let anchor = floor(grid);
  var nearest = 1000000.0;
  var second = 1000000.0;
  var seed = vec2f(0.0);
  var seedCell = vec2f(0.0);
  for (var y: i32 = -1; y <= 1; y = y + 1) {
    for (var x: i32 = -1; x <= 1; x = x + 1) {
      let cell = anchor + vec2f(f32(x), f32(y));
      let jitter = vec2f(sfx_hash(cell), sfx_hash(cell + vec2f(19.7, 43.1)));
      let candidate = cell + vec2f(0.18) + jitter * 0.64;
      let delta = grid - candidate;
      let distance = dot(delta, delta);
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
        seed = candidate;
        seedCell = cell;
      } else if (distance < second) {
        second = distance;
      }
    }
  }
  let centerUv = seed * cellPx / p.size;
  let sampleUv = mix(uv, centerUv, 0.80);
  let source = sfx_sample(sampleUv, p);
  let facet = sfx_hash(seedCell + vec2f(73.1, 11.9));
  let border = smoothstep(0.35 / cellPx, 1.5 / cellPx, sqrt(second) - sqrt(nearest));
  let tint = vec3f(1.0 + 0.06 * facet, 1.0, 1.04 - 0.09 * facet);
  return source * tint * (0.84 + 0.25 * facet) * (0.84 + 0.16 * border);
}

// 5 — Bande analogique douce : trois canaux déplacés, sans flash ni coupe.
fn sfx_vhs(uv: vec2f, p: FxParams) -> vec3f {
  let px = uv * p.size;
  let bandCenter = fract(p.time * 0.036);
  let bandDistance = abs(uv.y - bandCenter);
  let wrapped = min(bandDistance, 1.0 - bandDistance);
  let band = exp(-pow(wrapped / 0.047, 2.0));
  let wave = sin(uv.y * 23.0 + p.time * 0.58) + 0.32 * sin(uv.y * 71.0 - p.time * 0.74);
  let wobble = (wave * mix(0.65, 2.0, p.scale) + band * 1.6) / p.size.x;
  let chroma = mix(0.65, 1.85, p.scale) / p.size.x;
  let sampleUv = uv + vec2f(wobble, 0.0);
  let r = sfx_sample(sampleUv + vec2f(chroma, 0.0), p).r;
  let g = sfx_sample(sampleUv, p).g;
  let b = sfx_sample(sampleUv - vec2f(chroma, 0.0), p).b;
  let scan = sin(px.y * 3.14159265359 / mix(1.25, 2.3, p.scale));
  let grain = sfx_noise(floor(px * 0.5) + vec2f(p.time * 0.71, p.time * 0.29)) - 0.5;
  return vec3f(r, g, b) * (0.96 + scan * 0.022 - band * 0.035) + vec3f(grain * 0.035);
}

// 6 — Reflets de studio procéduraux sur le relief de luminance, sans scène 3D.
fn sfx_chrome(uv: vec2f, p: FxParams) -> vec3f {
  let source = sfx_sample(uv, p);
  let value = sfx_luma(source);
  let normal = sfx_normal(uv, p, mix(0.9, 4.1, p.scale), 8.5);
  let reflected = reflect(vec3f(0.0, 0.0, -1.0), normal);
  let hand = (p.point - vec2f(0.5)) * 1.7;
  let phase = p.time * 0.18 + hand.x + hand.y * 0.65;
  let softbox = smoothstep(0.30, 0.94, sin(reflected.x * 4.7 + reflected.y * 1.3 + phase));
  let strip = pow(0.5 + 0.5 * cos(reflected.y * 7.2 - reflected.x * 1.4 - phase * 0.71), 7.0);
  let flag = smoothstep(0.70, 0.98, sin(reflected.x * 8.0 - reflected.y * 3.1 + phase * 0.43));
  let metal = vec3f(0.10, 0.135, 0.18)
    + vec3f(0.77, 0.80, 0.82) * softbox
    + vec3f(0.28, 0.19, 0.10) * strip
    - vec3f(0.13) * flag;
  return mix(vec3f(value), metal, 0.85) * (0.64 + 0.36 * value);
}

// 7 — Film coloré sur la surface ; aucune polarisation physique n'est simulée.
fn sfx_iridescence(uv: vec2f, p: FxParams) -> vec3f {
  let source = sfx_sample(uv, p);
  let normal = sfx_normal(uv, p, mix(0.8, 3.0, p.scale), 5.0);
  let hand = p.point - vec2f(0.5);
  let phase = dot(normal.xy, vec2f(3.8, -2.9))
    + dot(uv - vec2f(0.5), vec2f(5.1, -3.7)) * mix(1.7, 0.75, p.scale)
    + dot(hand, vec2f(4.0, -3.0)) + p.time * 0.26;
  let rainbow = vec3f(0.5) + 0.5 * cos(vec3f(phase) + vec3f(0.0, 2.0943951, 4.1887902));
  let highlight = pow(max(dot(normal, normalize(sfx_light(p) + vec3f(0.0, 0.0, 1.0))), 0.0), 12.0);
  let tint = mix(vec3f(0.73), rainbow, 0.62);
  return source * (vec3f(0.62) + tint * 0.68)
    + rainbow * (0.08 + 0.12 * sfx_luma(source) + 0.11 * highlight);
}

fn sfx_palette(value: f32) -> vec3f {
  let t = clamp(value, 0.0, 1.0) * 4.0;
  if (t < 1.0) {
    return mix(vec3f(0.075, 0.115, 0.20), vec3f(0.13, 0.36, 0.58), t);
  }
  if (t < 2.0) {
    return mix(vec3f(0.13, 0.36, 0.58), vec3f(0.74, 0.245, 0.19), t - 1.0);
  }
  if (t < 3.0) {
    return mix(vec3f(0.74, 0.245, 0.19), vec3f(0.98, 0.69, 0.30), t - 2.0);
  }
  return mix(vec3f(0.98, 0.69, 0.30), vec3f(1.0, 0.965, 0.84), t - 3.0);
}

// 8 — Fausses couleurs de la seule luminance, avec quantification légère.
fn sfx_luma_palette(uv: vec2f, p: FxParams) -> vec3f {
  let value = sfx_luma(sfx_sample(uv, p));
  let levels = floor(mix(15.0, 5.0, p.scale) + 0.5);
  let quantized = floor(value * (levels - 1.0) + 0.5) / (levels - 1.0);
  return sfx_palette(mix(value, quantized, 0.65));
}

// 9 — Douze lectures pondérées sur le rayon ; la respiration est lente et faible.
fn sfx_radial_blur(uv: vec2f, p: FxParams) -> vec3f {
  let direction = uv - p.point;
  let extent = mix(0.035, 0.24, p.scale) * (0.86 + 0.14 * sin(p.time * 0.65));
  var total = vec3f(0.0);
  var weightSum = 0.0;
  for (var i: u32 = 0u; i < 12u; i = i + 1u) {
    let t = f32(i) / 11.0;
    let weight = 1.0 - t * 0.65;
    total = total + sfx_sample(uv - direction * extent * t, p) * weight;
    weightSum = weightSum + weight;
  }
  return total / weightSum;
}

// 10 — Isolignes de valeur. Deux voisins estiment leur largeur en pixels CSS.
fn sfx_contours(uv: vec2f, p: FxParams) -> vec3f {
  let source = sfx_sample(uv, p);
  let value = sfx_luma(source);
  let d = vec2f(1.0) / p.size;
  let right = sfx_luma(sfx_sample(uv + vec2f(d.x, 0.0), p));
  let bottom = sfx_luma(sfx_sample(uv + vec2f(0.0, d.y), p));
  let slope = length(vec2f(right - value, bottom - value));
  let levels = floor(mix(18.0, 5.0, p.scale) + 0.5);
  let level = fract(value * levels);
  let distance = min(level, 1.0 - level);
  let width = clamp(slope * levels * 0.85, 0.012, 0.24);
  let line = (1.0 - smoothstep(width * 0.35, width * 1.3, distance))
    * smoothstep(0.0005, 0.004, slope);
  let paper = mix(vec3f(0.965, 0.947, 0.903), source, 0.26);
  return mix(paper, vec3f(0.10, 0.22, 0.27), line * 0.94);
}

// 11 — Trois rideaux lumineux superposés à l'image ; aucun remplacement de ciel.
fn sfx_aurora(uv: vec2f, p: FxParams) -> vec3f {
  let source = sfx_sample(uv, p);
  let aspect = p.size.x / p.size.y;
  let x = uv.x * aspect * mix(3.5, 1.6, p.scale);
  var glow = vec3f(0.0);
  var coverage = 0.0;
  for (var i: u32 = 0u; i < 3u; i = i + 1u) {
    let layer = f32(i);
    let field = sfx_noise(vec2f(x * 0.8 + p.time * 0.055, layer * 7.1 - p.time * 0.024));
    let curtain = 0.22 + layer * 0.20
      + 0.105 * sin(x * 1.5 + p.time * 0.14 + layer * 2.1)
      + (field - 0.5) * 0.19 + (p.point.y - 0.5) * 0.12;
    let distance = uv.y - curtain;
    let core = exp(-abs(distance) * 30.0);
    let tail = exp(-abs(distance) * 7.0) * (1.0 - smoothstep(-0.025, 0.10, distance));
    let rays = sfx_noise(vec2f(x * 31.0 + p.time * 0.08 + p.point.x * 0.5, layer * 13.2));
    let strength = (core * 0.64 + tail * 0.26) * (0.30 + 0.70 * rays * rays);
    let green = vec3f(0.16, 0.88, 0.59);
    let violet = vec3f(0.70, 0.30, 0.88);
    let color = mix(green, violet, layer * 0.5);
    glow = glow + color * strength;
    coverage = coverage + strength;
  }
  return source * (0.92 - 0.27 * min(coverage, 1.0)) + glow * 0.67;
}

fn sampler_effect(uv: vec2f, p: FxParams) -> vec3f {
  var safe = p;
  safe.size = max(p.size, vec2f(1.0));
  safe.point = clamp(p.point, vec2f(0.0), vec2f(1.0));
  safe.scale = clamp(p.scale, 0.0, 1.0);
  var color: vec3f;
  switch (p.mode) {
    case 0u: { color = sfx_engraving(uv, safe); }
    case 1u: { color = sfx_sobel(uv, safe); }
    case 2u: { color = sfx_relief(uv, safe); }
    case 3u: { color = sfx_kaleidoscope(uv, safe); }
    case 4u: { color = sfx_facets(uv, safe); }
    case 5u: { color = sfx_vhs(uv, safe); }
    case 6u: { color = sfx_chrome(uv, safe); }
    case 7u: { color = sfx_iridescence(uv, safe); }
    case 8u: { color = sfx_luma_palette(uv, safe); }
    case 9u: { color = sfx_radial_blur(uv, safe); }
    case 10u: { color = sfx_contours(uv, safe); }
    case 11u: { color = sfx_aurora(uv, safe); }
    default: { return sfx_sample(uv, safe); }
  }
  return clamp(color, vec3f(0.0), vec3f(1.0));
}
`;
