/** Nombre maximal de cartes (photos à l'écran, entrées et sorties comprises). */
export const MAX_CARDS = 12;

/**
 * Une seule passe plein écran. Pour chaque pixel : la distance signée à chaque
 * carte (rectangle arrondi, déformé par sa matrice d'étirement), fusionnées
 * par un minimum lissé ; la couleur est un mélange des photos pondéré par la
 * proximité ; le bord du verre dévie la lecture (réfraction, dispersion) et
 * accroche la lumière. Hors des cartes : le papier, ses filets, les ombres.
 */
export const LIQUID = /* wgsl */ `
struct Card {
  a: vec4f, // centre x, y, demi-largeur, demi-hauteur (px écran)
  b: vec4f, // rayon des coins, k de fusion (px), couche de texture, opacité
  m: vec4f, // inverse de la déformation : m00, m01, m10, m11
  c: vec4f, // échelle de distance, niveau de mipmap, érosion (px), 0
};
struct U {
  res: vec4f,   // largeur, hauteur (px écran), dpr, temps
  look: vec4f,  // réfraction, dispersion, largeur de la lentille (px css), fusion
  misc: vec4f,  // nombre de cartes, fil de fer, défilement (px css), intégré (1 : fond transparent, la page se voit)
  cards: array<Card, ${MAX_CARDS}>,
};

@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var photos: texture_2d_array<f32>;

struct VsOut { @builtin(position) clip: vec4f, @location(0) uv: vec2f };

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u));
  var o: VsOut;
  o.clip = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

fn sd_round_box(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
  if (k <= 0.0001) { return min(a, b); }
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

fn local_of(i: i32, px: vec2f) -> vec2f {
  let c = u.cards[i];
  let d = px - c.a.xy;
  return vec2f(c.m.x * d.x + c.m.y * d.y, c.m.z * d.x + c.m.w * d.y);
}

fn card_d(i: i32, px: vec2f) -> f32 {
  let c = u.cards[i];
  let h = max(c.a.zw - vec2f(c.c.z), vec2f(1.0));
  let r = min(c.b.x, min(h.x, h.y));
  // Une carte qui s'efface rentre dans le papier : sa distance est repoussée.
  return sd_round_box(local_of(i, px), h, r) * c.c.x + (1.0 - c.b.w) * 400.0 * u.res.z;
}

fn field(px: vec2f) -> f32 {
  var d = 1e9;
  let n = i32(u.misc.x);
  for (var i = 0; i < n; i++) {
    d = smin(d, card_d(i, px), u.cards[i].b.y * u.look.w);
  }
  return d;
}

// Couleur du verre en px : les photos, pondérées par leur proximité.
fn glass_color(px: vec2f, D: f32) -> vec3f {
  let n = i32(u.misc.x);
  var acc = vec3f(0.0);
  var wsum = 0.0;
  for (var i = 0; i < n; i++) {
    let c = u.cards[i];
    let di = card_d(i, px);
    let s = 0.3 * c.b.y * u.look.w + 2.0 * u.res.z;
    let w = exp(-max(di - D, 0.0) / s) * c.b.w;
    if (w < 0.004) { continue; }
    let h = max(c.a.zw, vec2f(1.0));
    let uv = clamp(local_of(i, px) / (2.0 * h) + 0.5, vec2f(0.002), vec2f(0.998));
    acc += textureSampleLevel(photos, samp, uv, i32(c.b.z), c.c.y).rgb * w;
    wsum += w;
  }
  if (wsum < 1e-4) { return vec3f(0.9); }
  return acc / wsum;
}

const PAPER: vec3f = vec3f(0.937, 0.933, 0.910);

fn backdrop(px: vec2f) -> vec3f {
  let dpr = u.res.z;
  let q = vec2f(px.x, px.y + u.misc.z * dpr) / dpr;
  // Filets du papier : 24 px, un fort tous les cinq.
  let g = abs(fract(q / 24.0 - 0.5) - 0.5) * 24.0 * dpr;
  let G = abs(fract(q / 120.0 - 0.5) - 0.5) * 120.0 * dpr;
  let fine = 1.0 - smoothstep(0.0, 1.0, min(g.x, g.y));
  let major = 1.0 - smoothstep(0.0, 1.0, min(G.x, G.y));
  var col = PAPER * (1.0 - 0.05 * fine - 0.07 * major);
  // Une lumière douce venue du haut à gauche.
  let l = length((px / u.res.xy) - vec2f(0.2, -0.1));
  col *= 1.02 - 0.06 * l;
  return col;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let px = in.uv * u.res.xy;
  let dpr = u.res.z;
  let D = field(px);
  let e = 1.0;
  let grad = vec2f(field(px + vec2f(e, 0.0)) - field(px - vec2f(e, 0.0)), field(px + vec2f(0.0, e)) - field(px - vec2f(0.0, e))) / (2.0 * e);
  let nrm = grad / max(length(grad), 1e-4);

  if (u.misc.y > 0.5) {
    // Fil de fer : le champ en courbes de niveau, et le contour exact de chaque carte.
    var col = PAPER;
    let iso = abs(fract(D / (12.0 * dpr) + 0.5) - 0.5) * 12.0 * dpr;
    col = mix(col, vec3f(0.55), (1.0 - smoothstep(0.0, 1.0, iso)) * 0.35 * step(-60.0 * dpr, -abs(D)));
    col = mix(col, vec3f(0.09), 1.0 - smoothstep(0.5, 1.6, abs(D)));
    let n = i32(u.misc.x);
    for (var i = 0; i < n; i++) {
      let di = abs(card_d(i, px));
      col = mix(col, vec3f(0.85, 0.12, 0.1), (1.0 - smoothstep(0.4, 1.2, di)) * 0.8);
    }
    return vec4f(col, 1.0);
  }

  // Intégré dans une page : pas de papier ni de filets, la page se voit au
  // travers ; l'ombre devient un voile noir translucide.
  let embedded = u.misc.w > 0.5;
  var col = backdrop(px);
  var alpha = 1.0;
  // Ombre portée, sous le verre et un peu plus bas.
  let Ds = field(px - vec2f(0.0, 10.0 * dpr));
  let shade = 0.16 * (1.0 - smoothstep(-6.0 * dpr, 26.0 * dpr, Ds));
  if (embedded) {
    col = vec3f(0.0);
    alpha = shade;
  } else {
    col *= 1.0 - shade;
  }

  let aa = 1.2;
  let cover = 1.0 - smoothstep(-aa, aa, D);
  if (cover > 0.0) {
    // Lentille : dans la bande du bord, la lecture est déviée vers l'intérieur.
    let L = max(u.look.z * dpr, 2.0);
    let t = clamp(-D / L, 0.0, 1.0);
    let bend = (1.0 - t) * (1.0 - t);
    // nrm pointe vers l'extérieur : on lit vers l'intérieur, comme une loupe au bord du verre.
    let off = -nrm * bend * u.look.x * 5.0 * dpr;
    var g: vec3f;
    if (bend > 0.002) {
      let disp = u.look.y * bend * 3.0 * dpr;
      g = vec3f(
        glass_color(px + off - nrm * disp, D).r,
        glass_color(px + off, D).g,
        glass_color(px + off + nrm * disp * 0.5, D).b,
      );
    } else {
      g = glass_color(px, D);
    }
    // Lumière : un reflet sur le bord tourné vers la lumière, un liseré clair.
    let lightDir = normalize(vec2f(-0.6, -0.8));
    let spec = pow(max(dot(-nrm, lightDir), 0.0), 6.0) * bend;
    let rim = 1.0 - smoothstep(0.0, 1.6 * dpr, -D);
    g = g * (1.0 - 0.12 * bend) + vec3f(0.55) * spec + vec3f(0.35) * rim;
    col = mix(col, g, cover);
    alpha = mix(alpha, 1.0, cover);
  }
  // Sortie prémultipliée (le canvas intégré compose avec la page).
  if (embedded) { return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), alpha); }
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;
