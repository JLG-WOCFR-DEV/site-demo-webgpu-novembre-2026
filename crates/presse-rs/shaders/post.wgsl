// Presse — composition finale : la scène (papier + encre), puis la fibre et le grain du papier.
// Formules reprises de l'étape 5 de src/gpu/wgsl.ts (POST), seules passes que Carnet active.

struct Post {
  res: vec4f,    // largeur, hauteur (px physiques), dpr, temps (s)
  paper: vec4f,  // couleur du papier (sRGB), 0
  opts: vec4f,   // amplitude du grain (0 coupé), mouvement réduit (0/1), 0, 0
};

@group(0) @binding(0) var<uniform> u: Post;
@group(0) @binding(1) var scene: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  // Un triangle qui couvre l'écran.
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u));
  var out: VsOut;
  out.clip = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(p.x, 1.0 - p.y);
  return out;
}

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
  var col = textureSampleLevel(scene, samp, in.uv, 0.0).rgb;
  let amp = u.opts.x;
  if (amp > 0.5) {
    // Fibre : bruit lent, seulement là où il y a du papier.
    let paperish = 1.0 - smoothstep(0.02, 0.08, distance(col, u.paper.rgb));
    let fiber = vnoise(px / (2.0 * u.res.z) + vec2f(0.0, vnoise(px / (60.0 * u.res.z)) * 6.0));
    col *= 1.0 - paperish * (fiber - 0.5) * 0.016 * amp;
    // Grain : bruit entrelacé, animé sauf en mouvement réduit.
    let tt = select(floor(u.res.w * 24.0), 0.0, u.opts.y > 0.5);
    let n = ign(px + vec2f(tt * 5.588238, tt * 3.31));
    col += (n - 0.5) * 0.028 * amp;
  }
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);
}
