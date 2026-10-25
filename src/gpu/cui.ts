/**
 * Effets d'après Canvas UI (canvasui.dev), refaits dans la passe composite du
 * moteur : ils agissent sur la page entière, texte et images compris, puisque
 * le moteur la repeint déjà. Aucun code repris : seulement les idées, d'après
 * les descriptions publiques des composants.
 *
 * Deux temps, comme le reste de la passe : cui_offset() dévie la lecture de la
 * scène (ondes, pli de cube, tuiles, déplacement, onde de choc, tranches du
 * glitch, ondulation de la bande VHS), puis cui_color() agit sur la couleur
 * (bavure de chroma, blocs corrompus, loupe ASCII ou tramée, laser…).
 */
export const CUI_EFFECTS = ["aucun", "ondes", "vhs", "glitch", "pli", "tuiles", "ascii", "tramage", "deplacement", "champ", "laser", "eclats", "particules", "sable", "tissu", "dechiffrer", "pluie", "hexagones"] as const;
export type CuiEffect = (typeof CUI_EFFECTS)[number];
export const MAX_RIPPLES = 8;

export const CUI_WGSL = /* wgsl */ `
const CUI_NONE: f32 = 0.0;
fn cui_is(id: f32) -> bool { return abs(u.cui.x - id) < 0.5; }
fn cui_h(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }

// Pli de cube : au-delà des bandes du haut et du bas, la page passe sur une
// face tournée, en perspective. Renvoie le point lu (px) et la profondeur relative.
fn cui_bend(px: vec2f) -> vec3f {
  let dpr = u.res.z;
  let B = u.res.y * 0.22 * u.cui.z;
  let a = radians(64.0) * u.cui.y;
  let P = 900.0 * dpr;
  var s = 0.0;
  var top = true;
  if (px.y < B) { s = B - px.y; }
  else if (px.y > u.res.y - B) { s = px.y - (u.res.y - B); top = false; }
  else { return vec3f(px, 0.0); }
  let den = P * cos(a) - s * sin(a);
  if (den <= 1.0) { return vec3f(px, -1.0); }
  let c = s * P / den;
  let cx = u.res.x * 0.5;
  let x = cx + (px.x - cx) * (P + c * sin(a)) / P;
  let y = select(u.res.y - B + c, B - c, top);
  return vec3f(x, y, c / (c + B));
}

// Tuiles : la page découpée en carreaux qui se soulèvent en vagues autour du pointeur.
fn cui_tile(px: vec2f) -> vec4f {
  let dpr = u.res.z;
  let cell = 56.0 * dpr * u.cui.z;
  let id = floor(px / cell);
  let c = (id + 0.5) * cell;
  let d = select(1e5, length(c - u.cui2.xy), u.cui2.z > 0.5);
  let t = u.res.w;
  let wave = exp(-d / (300.0 * dpr)) * (0.55 + 0.45 * sin(t * 5.0 - d / (46.0 * dpr)));
  let h = clamp(wave * u.cui.y, 0.0, 1.0);
  let s = 0.9 + 0.1 * h + 0.06 * h;
  let l = (px - c) / s;
  let inside = step(max(abs(l.x), abs(l.y)), cell * 0.5 - 1.5 * dpr);
  return vec4f(c + l, h, inside);
}

fn cui_h2(p: vec2f) -> vec2f { return vec2f(cui_h(p), cui_h(p + vec2f(17.3, 41.9))); }
fn cui_near(px: vec2f, r: f32) -> f32 { return select(0.0, exp(-length(px - u.cui2.xy) / r), u.cui2.z > 0.5); }

// Un caractère de la casse (rampe MTSDF, du plus clair au plus noir) dans une cellule.
fn cui_glyph(local: vec2f, cell: f32, idx: i32) -> f32 {
  let n = i32(u.casse.x);
  if (n < 1) { return 0.0; }
  let g = u.ramp[clamp(idx, 0, n - 1)];
  let k = cell / (0.8 * u.casse.w);
  let q = (local - cell * 0.5) / k + g.zw * 0.5;
  if (any(q < vec2f(0.0)) || any(q > g.zw)) { return 0.0; }
  let m = textureSampleLevel(msdf, samp, (g.xy + q) / u.casse.yz, 0.0).rgb;
  let med = max(min(m.r, m.g), min(max(m.r, m.g), m.b));
  return clamp((med - 0.5) * 8.0 * k + 0.5, 0.0, 1.0);
}

// Éclats : des cellules de Voronoï, soulevées et tournées près du pointeur.
// x, y : point lu ; z : distance au bord de l'éclat (px) ; w : soulèvement.
fn cui_shard(px: vec2f) -> vec4f {
  let dpr = u.res.z;
  let S = 92.0 * dpr * u.cui.z;
  let base = floor(px / S);
  var f1 = 1e9;
  var f2 = 1e9;
  var seed = vec2f(0.0);
  var sid = vec2f(0.0);
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let c = base + vec2f(f32(i), f32(j));
      let sp = (c + 0.15 + 0.7 * cui_h2(c)) * S;
      let d = length(px - sp);
      if (d < f1) { f2 = f1; f1 = d; seed = sp; sid = c; }
      else if (d < f2) { f2 = d; }
    }
  }
  let t = u.res.w;
  let h = clamp(cui_near(seed, 230.0 * dpr) * 1.4, 0.0, 1.0) * u.cui.y;
  let wob = sin(t * 1.3 + cui_h(sid) * 6.28) * 0.5 + 0.5;
  let lift = h * (0.75 + 0.25 * wob);
  let ang = (cui_h(sid + 3.3) - 0.5) * 0.5 * lift;
  let away = normalize(seed - u.cui2.xy + vec2f(1e-3));
  let tr = away * 22.0 * dpr * lift + vec2f(0.0, -12.0 * dpr * lift);
  let s = 1.0 + 0.1 * lift;
  let l = (px - seed - tr) / s;
  let ca = cos(-ang);
  let sa = sin(-ang);
  let src = seed + vec2f(ca * l.x - sa * l.y, sa * l.x + ca * l.y);
  return vec4f(src, (f2 - f1) * 0.5, lift);
}

// Tissu : une hauteur (px) faite de houle et des rides laissées par le pointeur.
fn cui_cloth_h(p: vec2f) -> f32 {
  let dpr = u.res.z;
  let t = u.res.w;
  let q = p / dpr;
  let pin = 0.3 + 0.7 * (p.y / u.res.y);
  var h = (sin(q.x * 0.012 + t * 1.7 + sin(q.y * 0.008 + t) * 1.5) * 0.65 + sin(q.x * 0.031 - t * 2.3 + q.y * 0.012) * 0.25) * pin;
  for (var i = 0; i < ${MAX_RIPPLES}; i++) {
    let r = u.ripples[i];
    if (r.w <= 0.0) { continue; }
    let age = t - r.z;
    if (age < 0.0 || age > 4.0) { continue; }
    let d = length(p - r.xy) / dpr;
    let behind = age * 260.0 - d;
    h += sin(behind * 0.09) * exp(-max(behind, 0.0) / 160.0) * smoothstep(-30.0, 10.0, behind) * exp(-age * 1.2) * r.w * 1.4;
  }
  return h * 13.0 * dpr * u.cui.y;
}

// Hexagones flottants : centre de la tuile, et position dans la tuile (unités).
fn cui_hex(px: vec2f, S: f32) -> vec4f {
  let p = px / S;
  let r = vec2f(1.0, 1.7320508);
  let h = r * 0.5;
  let a = p - r * floor(p / r) - h;
  let b = (p - h) - r * floor((p - h) / r) - h;
  let g = select(b, a, dot(a, a) < dot(b, b));
  return vec4f((p - g) * S, g);
}

fn cui_offset(px: vec2f) -> vec2f {
  if (u.cui.x < 0.5) { return vec2f(0.0); }
  let dpr = u.res.z;
  let t = u.res.w;
  let amt = u.cui.y;
  var off = vec2f(0.0);

  if (cui_is(1.0) || cui_is(9.0)) {
    // Ondes au clic (étang), ou onde de choc (champ de force).
    for (var i = 0; i < ${MAX_RIPPLES}; i++) {
      let r = u.ripples[i];
      if (r.w <= 0.0) { continue; }
      let age = t - r.z;
      if (age < 0.0 || age > 6.0) { continue; }
      let dv = px - r.xy;
      let d = length(dv);
      let dir = dv / max(d, 1e-3);
      if (cui_is(1.0)) {
        let front = age * 380.0 * dpr;
        let behind = front - d;
        // Le front s'adoucit (pas d'arête nette), les rides s'éteignent derrière lui et avec l'âge.
        let env = exp(-max(behind, 0.0) / (220.0 * dpr)) * smoothstep(-40.0 * dpr, 10.0 * dpr, behind) * exp(-age * 0.9);
        let w = sin(behind * 6.2831 / (46.0 * dpr));
        off += dir * w * env * 5.5 * dpr * amt * r.w;
      } else {
        let front = age * 950.0 * dpr;
        let k = exp(-pow((d - front) / (34.0 * dpr), 2.0)) * exp(-age * 2.2);
        off -= dir * k * 26.0 * dpr * amt * r.w;
      }
    }
  } else if (cui_is(2.0)) {
    // VHS : ondulation, bande de suivi, bruit de commutation des têtes en bas.
    let v = px.y / u.res.y;
    off.x += (sin(v * 12.0 + t * 2.3) * 1.2 + sin(v * 85.0 + t * 9.0) * 0.4) * dpr * amt;
    let band = fract(t * 0.07) * 1.3 - 0.15;
    if (abs(v - band) < 0.035) {
      off.x += (cui_h(vec2f(floor(px.y / (2.0 * dpr)), floor(t * 30.0))) - 0.5) * 16.0 * dpr * amt;
    }
    if (v > 0.94) {
      let k = pow((v - 0.94) / 0.06, 2.0);
      off.x += (cui_h(vec2f(floor(px.y / dpr), floor(t * 24.0))) - 0.2) * 26.0 * dpr * k * amt;
    }
  } else if (cui_is(3.0)) {
    // Glitch : par salves, des tranches de page décalées.
    let seed = floor(t * 7.0);
    let burst = step(0.58, cui_h(vec2f(seed, 3.1))) * amt;
    let sh = mix(6.0, 34.0, cui_h(vec2f(seed, 9.7))) * dpr;
    let row = floor(px.y / sh);
    let on = step(0.55, cui_h(vec2f(row, seed)));
    off.x += (cui_h(vec2f(row * 1.7, seed + 2.0)) - 0.5) * 90.0 * dpr * burst * on;
  } else if (cui_is(4.0)) {
    let b = cui_bend(px);
    if (b.z >= 0.0) { off += b.xy - px; }
  } else if (cui_is(5.0)) {
    let tl = cui_tile(px);
    off += tl.xy - px;
  } else if (cui_is(11.0)) {
    off += cui_shard(px).xy - px;
  } else if (cui_is(13.0)) {
    // Sable : sous la ligne, chaque grain vient d'ailleurs, de plus en plus loin.
    let ly = u.res.y * 0.62;
    let k = clamp((px.y - ly) / (u.res.y - ly), 0.0, 1.0) * amt;
    if (k > 0.0) {
      let cell = floor(px / (2.5 * dpr));
      let j = cui_h2(cell) - 0.5;
      off += j * k * 110.0 * dpr - vec2f(k * 34.0 * dpr, k * k * 70.0 * dpr) + vec2f(sin(t * 0.8 + cell.y * 0.07), 0.0) * k * 8.0 * dpr;
    }
  } else if (cui_is(14.0)) {
    let e = 1.5 * dpr;
    let gx = cui_cloth_h(px + vec2f(e, 0.0)) - cui_cloth_h(px - vec2f(e, 0.0));
    let gy = cui_cloth_h(px + vec2f(0.0, e)) - cui_cloth_h(px - vec2f(0.0, e));
    off += vec2f(gx, gy) / (2.0 * e) * 10.0 * dpr + vec2f(0.0, cui_cloth_h(px) * 0.35);
  } else if (cui_is(17.0)) {
    let S = 46.0 * dpr * u.cui.z;
    let hx = cui_hex(px, S);
    let lift = clamp(cui_near(hx.xy, 260.0 * dpr) * 1.3, 0.0, 1.0) * amt;
    let sc = 0.93 + 0.1 * lift;
    off += hx.xy + (px - hx.xy) / sc - px + vec2f(0.0, 6.0 * dpr * lift);
  } else if (cui_is(8.0)) {
    // Champ de déplacement : une grille qui s'écarte du pointeur.
    let cell = 22.0 * dpr * u.cui.z;
    let c = (floor(px / cell) + 0.5) * cell;
    let d = c - u.cui2.xy;
    let k = amt * 46.0 * dpr * exp(-length(d) / (190.0 * dpr)) * u.cui2.z;
    off -= normalize(d + vec2f(1e-3)) * k;
  }
  return off;
}

fn cui_lens_mask(px: vec2f) -> f32 {
  if (u.cui2.z < 0.5) { return 0.0; }
  let R = 170.0 * u.res.z * u.cui.z;
  return 1.0 - smoothstep(R * 0.86, R, length(px - u.cui2.xy));
}

fn cui_color(px: vec2f, col_in: vec3f, lens: vec2f) -> vec3f {
  if (u.cui.x < 0.5) { return col_in; }
  let dpr = u.res.z;
  let t = u.res.w;
  let amt = u.cui.y;
  var col = col_in;

  if (cui_is(1.0)) {
    // Reflets sur les crêtes : une lumière rasante sur l'onde.
    let o1 = cui_offset(px + vec2f(dpr, 0.0));
    let o0 = cui_offset(px - vec2f(dpr, 0.0));
    col *= 1.0 + clamp((o1.x - o0.x) / (2.0 * dpr), -1.0, 1.0) * 0.12;
  } else if (cui_is(2.0)) {
    // Bavure de chroma : luminance nette, couleur étalée vers la droite.
    let y = dot(col, vec3f(0.299, 0.587, 0.114));
    var iq = vec2f(0.0);
    for (var k = 1; k <= 4; k++) {
      let c = source(px, lens + vec2f(-f32(k) * 2.5 * dpr * amt, 0.0));
      iq += vec2f(dot(c, vec3f(0.596, -0.274, -0.322)), dot(c, vec3f(0.211, -0.523, 0.312)));
    }
    iq *= 0.25 * 1.15;
    col = vec3f(y + 0.956 * iq.x + 0.621 * iq.y, y - 0.272 * iq.x - 0.647 * iq.y, y - 1.106 * iq.x + 1.703 * iq.y);
    col = mix(col, col * vec3f(1.04, 1.0, 0.92), amt);
    col *= 0.93 + 0.07 * sin(px.y * 3.14159 / (1.5 * dpr));
    let v = px.y / u.res.y;
    if (v > 0.94) { col = mix(col, vec3f(cui_h(floor(px / dpr) + floor(t * 30.0))), 0.35 * amt * step(0.7, cui_h(vec2f(floor(px.y / dpr), floor(t * 24.0))))); }
    col += (cui_h(px + floor(t * 24.0)) - 0.5) * 0.08 * amt;
    let q = px / u.res.xy - 0.5;
    col *= 1.0 - dot(q, q) * 0.5 * amt;
  } else if (cui_is(3.0)) {
    let seed = floor(t * 7.0);
    let burst = step(0.58, cui_h(vec2f(seed, 3.1))) * amt;
    if (burst > 0.0) {
      let s = 7.0 * dpr * burst;
      col = vec3f(source(px, lens + vec2f(s, 0.0)).r, col.g, source(px, lens - vec2f(s, 0.0)).b);
      // Blocs corrompus : couleur aplatie, ou négatif.
      let blk = floor(px / (26.0 * dpr));
      let hb = cui_h(blk + seed * 1.37);
      if (hb > 0.965) {
        let c = source((blk + 0.5) * 26.0 * dpr, vec2f(40.0 * dpr * (hb - 0.98), 0.0));
        col = select(floor(c * 4.0) / 4.0, 1.0 - c, hb > 0.99);
      }
    }
  } else if (cui_is(4.0)) {
    let b = cui_bend(px);
    if (b.z < 0.0) { col = u.paper.rgb * 0.82; }
    else if (b.z > 0.0) {
      col *= 1.0 - 0.45 * b.z;
      // L'arête de la face : un filet clair.
      let B = u.res.y * 0.22 * u.cui.z;
      let e = min(abs(px.y - B), abs(px.y - (u.res.y - B)));
      col = mix(col, vec3f(1.0), (1.0 - smoothstep(0.0, 1.5 * dpr, e)) * 0.35);
    }
  } else if (cui_is(5.0)) {
    let tl = cui_tile(px);
    if (tl.w < 0.5) {
      // Joint entre les tuiles : l'ombre de la tuile soulevée.
      col = u.paper.rgb * (0.86 - 0.18 * tl.z);
    } else {
      col *= 1.0 + 0.12 * tl.z;
    }
  } else if (cui_is(6.0) || cui_is(7.0)) {
    let m = cui_lens_mask(px);
    if (m > 0.0) {
      let st = vec4f(0.0, 0.0, u.res.x, u.res.y);
      let fx = select(f_dither(px, st, 5.0 * u.cui.z, 0.55), f_casse(px, st, 3.2 * u.cui.z, 0.7), cui_is(6.0));
      col = mix(col, fx, m * amt);
      let ring = abs(length(px - u.cui2.xy) - 170.0 * dpr * u.cui.z * 0.93);
      col = mix(col, vec3f(0.07), (1.0 - smoothstep(0.0, 1.2 * dpr, ring)) * 0.6 * step(0.01, m));
    }
  } else if (cui_is(11.0)) {
    // Éclats : liseré réfractant au bord, ombre dans les joints des éclats soulevés.
    let sh = cui_shard(px);
    let rim = 1.0 - smoothstep(0.0, 2.2 * dpr, sh.z);
    let gap = 1.0 - smoothstep(0.0, (1.0 + 5.0 * sh.w) * dpr, sh.z);
    col = mix(col, u.paper.rgb * 0.55, gap * sh.w * 0.85);
    // Loin du pointeur, les fêlures restent à peine visibles.
    col += vec3f(0.9, 0.95, 1.0) * rim * (0.05 * u.cui.y + 0.5 * sh.w);
    col *= 1.0 + 0.08 * sh.w;
  } else if (cui_is(12.0)) {
    // Particules : hors de la loupe, la page n'est plus que des grains qui frémissent.
    let R = 170.0 * dpr * u.cui.z;
    let dc = select(1e9, length(px - u.cui2.xy), u.cui2.z > 0.5);
    let crisp = 1.0 - smoothstep(R * 0.7, R, dc);
    if (crisp < 0.999) {
      let cell = 3.0 * dpr;
      let id = floor(px / cell);
      var best = vec3f(u.paper.rgb);
      var cov = 0.0;
      let loose = 1.0 + 4.0 * smoothstep(R * 0.7, R * 1.6, dc) * (1.0 - smoothstep(R * 1.6, R * 3.0, dc));
      for (var j = -1; j <= 1; j++) {
        for (var i = -1; i <= 1; i++) {
          let c = id + vec2f(f32(i), f32(j));
          let jit = vec2f(sin(t * 2.1 + cui_h(c) * 6.28), cos(t * 1.7 + cui_h(c + 1.1) * 6.28)) * 0.6 * dpr * loose * amt;
          let dp = (c + 0.5) * cell + jit;
          let a = 1.0 - smoothstep(0.55 * dpr, 1.15 * dpr, length(px - dp));
          if (a > cov) { cov = a; best = source((c + 0.5) * cell, vec2f(0.0)); }
        }
      }
      let dots = mix(u.paper.rgb, best, cov);
      col = mix(dots, col, crisp);
    }
  } else if (cui_is(13.0)) {
    let ly = u.res.y * 0.62;
    let k = clamp((px.y - ly) / (u.res.y - ly), 0.0, 1.0) * amt;
    if (k > 0.0) {
      let cell = floor(px / (2.5 * dpr));
      // Les grains s'éclaircissent avec la profondeur.
      if (cui_h(cell + 7.7) < k * 0.9) { col = u.paper.rgb; }
      else { col = mix(col, u.paper.rgb, k * 0.25); }
    }
    let seam = exp(-abs(px.y - ly) / (2.0 * dpr));
    col = mix(col, vec3f(0.78, 0.2, 0.11), seam * 0.35 * amt);
  } else if (cui_is(14.0)) {
    let e = 1.5 * dpr;
    let gx = (cui_cloth_h(px + vec2f(e, 0.0)) - cui_cloth_h(px - vec2f(e, 0.0))) / (2.0 * e);
    let gy = (cui_cloth_h(px + vec2f(0.0, e)) - cui_cloth_h(px - vec2f(0.0, e))) / (2.0 * e);
    // Lumière venue du haut à gauche, et la trame du tissage.
    col *= clamp(1.0 - (gx * 0.6 + gy * 0.8) * 1.4, 0.7, 1.25);
    let weave = sin(px.x * 3.14159 / (1.6 * dpr)) * sin(px.y * 3.14159 / (1.6 * dpr));
    col *= 1.0 - 0.035 * amt * (weave * 0.5 + 0.5);
  } else if (cui_is(15.0) || cui_is(16.0)) {
    let cell = select(9.0, 12.0, cui_is(16.0)) * dpr * u.cui.z;
    let id = floor(px / cell);
    let local = px - id * cell;
    let c = source((id + 0.5) * cell, vec2f(0.0));
    let ink = clamp(1.0 - luma(c) / u.paper.g, 0.0, 1.0);
    if (cui_is(15.0)) {
      // Déchiffrer : la page est un chiffre ; autour du pointeur elle se déchiffre.
      let R = 170.0 * dpr * u.cui.z;
      let dc = select(1e9, length(px - u.cui2.xy), u.cui2.z > 0.5);
      let clear = 1.0 - smoothstep(R * 0.65, R, dc);
      if (clear < 0.999) {
        let rate = mix(9.0, 30.0, smoothstep(R * 1.5, R, dc));
        let idx = 6 + i32(cui_h(id + floor(t * rate + cui_h(id) * 7.0)) * 10.0);
        let g = cui_glyph(local, cell, idx) * step(0.1, ink);
        let cipher = mix(u.paper.rgb, mix(vec3f(0.07), c * 0.85, 0.5), g);
        col = mix(cipher, col, clear) * amt + col * (1.0 - amt);
      }
    } else {
      // Pluie de glyphes : des colonnes qui tombent et allument la page sous elles.
      let rows = u.res.y / cell;
      let nearX = select(0.0, exp(-abs((id.x + 0.5) * cell - u.cui2.x) / (120.0 * dpr)), u.cui2.z > 0.5);
      let sp = (2.5 + 9.0 * cui_h(vec2f(id.x, 1.0))) * (1.0 + 2.5 * nearX);
      let head = fract(t * sp / (rows + 24.0) + cui_h(vec2f(id.x, 2.0))) * (rows + 24.0) - 4.0;
      let d = head - id.y;
      let L = 14.0;
      if (d >= 0.0 && d < L) {
        let k = pow(1.0 - d / L, 1.6) * amt;
        let idx = 4 + i32(cui_h(id + floor(t * 12.0 + cui_h(id) * 5.0)) * 12.0);
        let g = cui_glyph(local, cell, idx);
        let hd = 1.0 - smoothstep(0.0, 1.2, d);
        let glyphCol = mix(vec3f(0.78, 0.2, 0.11), vec3f(1.0, 0.95, 0.9), hd);
        // L'encre de la page s'allume au passage de la colonne.
        col = mix(col, mix(col, vec3f(0.78, 0.2, 0.11), 0.65), ink * k);
        col = mix(col, glyphCol, g * k * 0.9);
      }
    }
  } else if (cui_is(17.0)) {
    let S = 46.0 * dpr * u.cui.z;
    let hx = cui_hex(px, S);
    let lift = clamp(cui_near(hx.xy, 260.0 * dpr) * 1.3, 0.0, 1.0) * amt;
    let sc = 0.93 + 0.1 * lift;
    let q = abs(hx.zw) / sc;
    let edge = 0.5 - max(q.x, dot(q, vec2f(0.5, 0.8660254)));
    if (edge < 0.0) {
      col = u.paper.rgb * (0.84 - 0.16 * lift);
    } else {
      // Tuile brillante : penchée vers le pointeur, un reflet qui la traverse.
      let tilt = dot(normalize(hx.xy - u.cui2.xy + vec2f(1e-3)), vec2f(-0.6, -0.8)) * lift;
      col *= 1.0 + 0.16 * tilt;
      let band = fract(dot(hx.zw, vec2f(0.7, 0.7)) * 0.9 - t * 0.25 + cui_h(floor(hx.xy / S)));
      col += vec3f(1.0) * (1.0 - smoothstep(0.0, 0.05, abs(band - 0.5))) * 0.12 * (0.3 + lift);
      col = mix(col, vec3f(1.0), (1.0 - smoothstep(0.0, 0.03, edge)) * 0.35);
    }
  } else if (cui_is(8.0)) {
    // Franges de couleur là où la grille s'écarte, et un grain fin.
    let o = cui_offset(px);
    let k = length(o) / (46.0 * dpr);
    col = vec3f(source(px, lens * 1.12).r, col.g, source(px, lens * 0.88).b);
    col += (cui_h(px + floor(t * 24.0)) - 0.5) * 0.05 * k;
  } else if (cui_is(9.0)) {
    // Champ de force : un bouclier hexagonal qui luit près du pointeur, et l'éclair des chocs.
    // Grille hexagonale : deux réseaux décalés, on garde le centre le plus proche.
    let s = 28.0 * dpr;
    let p = px / s;
    let r = vec2f(1.0, 1.7320508);
    let h = r * 0.5;
    let a = p - r * floor(p / r) - h;
    let b = (p - h) - r * floor((p - h) / r) - h;
    let g = select(b, a, dot(a, a) < dot(b, b));
    // Distance au bord de l'hexagone (pointe en haut), 0 au bord.
    let q = abs(g);
    let edge = 0.5 - max(q.x, dot(q, vec2f(0.5, 0.8660254)));
    let near = select(0.0, exp(-length(px - u.cui2.xy) / (220.0 * dpr)), u.cui2.z > 0.5);
    let line = (1.0 - smoothstep(0.0, 0.05, edge)) * (0.25 + near) * amt;
    col = mix(col, vec3f(0.35, 0.8, 1.0), line * 0.35);
    for (var i = 0; i < ${MAX_RIPPLES}; i++) {
      let rp = u.ripples[i];
      if (rp.w <= 0.0) { continue; }
      let age = t - rp.z;
      if (age < 0.0 || age > 2.0) { continue; }
      let d = length(px - rp.xy);
      let k = exp(-pow((d - age * 950.0 * dpr) / (30.0 * dpr), 2.0)) * exp(-age * 2.2) * amt;
      col = mix(col, vec3f(0.55, 0.9, 1.0), k * 0.55);
      col += vec3f(0.3, 0.6, 0.8) * exp(-d / (120.0 * dpr)) * exp(-age * 9.0) * amt;
    }
  } else if (cui_is(10.0)) {
    // Laser : sous le faisceau, la page attend dans le noir ; elle se révèle en passant au-dessus.
    let ly = u.res.y * (1.0 - 0.18 * u.cui.z);
    let d = px.y - ly;
    let flick = 0.85 + 0.15 * cui_h(vec2f(floor(t * 40.0), 1.0));
    if (d > 0.0) {
      let lum = dot(col, vec3f(0.299, 0.587, 0.114));
      let scan = 0.5 + 0.5 * sin(px.y * 3.14159 / (2.0 * dpr) + t * 6.0);
      col = mix(col, vec3f(0.05, 0.03, 0.03) + vec3f(0.5, 0.05, 0.04) * (1.0 - lum) * 0.2 * scan, clamp(amt * 0.95, 0.0, 0.95));
    } else {
      col = mix(col, col * vec3f(1.15, 0.75, 0.7), exp(d / (60.0 * dpr)) * 0.5 * amt);
    }
    let core = exp(-abs(d) / (1.2 * dpr));
    let glow = exp(-abs(d) / (14.0 * dpr));
    col += (vec3f(1.0, 0.95, 0.9) * core + vec3f(1.0, 0.12, 0.08) * glow * 0.9) * flick * amt;
    // Étincelles le long du faisceau.
    let sx = floor(px.x / (6.0 * dpr));
    let sp = cui_h(vec2f(sx, floor(t * 18.0)));
    if (sp > 0.985 && d < 0.0 && d > -40.0 * dpr * fract(sp * 97.0)) { col += vec3f(1.0, 0.4, 0.2) * amt * 0.8; }
  }
  return col;
}
`;
