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
 *
 * Le tableau u.ripples (huit vec4) porte selon l'effet : les ondes des clics (x, y, date, force) ; pour « deplacement »,
 * les poussées du pointeur (x, y, poussée x, y) ; pour « bulle », la traîne de la goutte (x, y, rayon relatif, présence).
 * u.cui.w : l'activité du défilement (laser).
 */
export const CUI_EFFECTS = ["aucun", "ondes", "vhs", "glitch", "pli", "tuiles", "ascii", "tramage", "deplacement", "champ", "laser", "eclats", "particules", "sable", "tissu", "dechiffrer", "pluie", "hexagones", "bulle", "gouttes"] as const;
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
  // Le vent souffle par rafales lentes ; l'étoffe se gonfle vers le bas, libre.
  let gust = 0.62 + 0.38 * sin(t * 0.37) * sin(t * 0.21 + 1.3);
  var h = (sin(q.x * 0.012 + t * 1.7 + sin(q.y * 0.008 + t) * 1.5) * 0.65 + sin(q.x * 0.031 - t * 2.3 + q.y * 0.012) * 0.25) * pin * gust;
  h += pin * pin * 0.5 * (gust - 0.62);
  // Le pointeur soulève l'étoffe sous lui ; l'empreinte le suit avec un temps de retard (pointeur amorti).
  if (u.cui2.z > 0.5) {
    let dv = (p - u.cui2.xy) / (150.0 * dpr);
    h += exp(-dot(dv, dv) * 2.2) * 1.5;
  }
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

fn cui_vn(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(cui_h(i), cui_h(i + vec2f(1.0, 0.0)), w.x), mix(cui_h(i + vec2f(0.0, 1.0)), cui_h(i + vec2f(1.0, 1.0)), w.x), w.y);
}

// Déplacement : la page en cellules ; chaque cellule reçoit la somme des poussées du pointeur qui l'atteignent,
// plus le désordre du chargement, qui se range en une seconde.
fn cui_push(px: vec2f) -> vec2f {
  let dpr = u.res.z;
  let cell = max(u.res.x / 50.0, 12.0 * dpr) * u.cui.z;
  let id = floor(px / cell);
  let c = (id + 0.5) * cell;
  let reach = 6.0 * cell;
  var p = vec2f(0.0);
  for (var i = 0; i < ${MAX_RIPPLES}; i++) {
    let r = u.ripples[i];
    p += r.zw * (1.0 - smoothstep(0.0, 1.0, length(c - r.xy) / reach));
  }
  p += (cui_h2(id + 5.5) - 0.5) * 90.0 * dpr * exp(-u.res.w * 4.0);
  return p * u.cui.y;
}

// Bulle : la hauteur (px) d'une goutte de verre faite de sphères fondues (la tête et sa traîne).
// Chaque sphère est un paraboloïde ; leur maximum lissé (log-somme-exp) les soude ; la racine rend le dôme.
fn cui_bub_h(px: vec2f) -> f32 {
  let R = 44.0 * u.res.z * u.cui.z;
  let k = 7.0 / R;
  var sum = 1e-12;
  for (var i = 0; i < ${MAX_RIPPLES}; i++) {
    let b = u.ripples[i];
    let r = R * b.z;
    let v = px - b.xy;
    sum += exp(k * (r * r - dot(v, v)) / (2.0 * r));
  }
  return sqrt(max(log(sum) / k * 2.0 * R, 0.0));
}
fn cui_bub_n(px: vec2f) -> vec3f {
  let e = 1.25 * u.res.z;
  let gx = cui_bub_h(px + vec2f(e, 0.0)) - cui_bub_h(px - vec2f(e, 0.0));
  let gy = cui_bub_h(px + vec2f(0.0, e)) - cui_bub_h(px - vec2f(0.0, e));
  return normalize(vec3f(-gx, -gy, 2.0 * e));
}

// Gouttes : une couche de gouttes qui glissent sur la vitre. La page est découpée en colonnes ; chaque colonne
// descend à sa vitesse, par à-coups (elle colle, puis file) ; dans chaque case, une goutte en forme d'œuf, et
// au-dessus d'elle la traînée qu'elle laisse, semée de perles. Renvoie (hauteur 0–1, vitre essuyée 0–1).
fn cui_rain_layer(uv: vec2f, t: f32, seed: f32) -> vec2f {
  let tall = 3.6;
  let colId = floor(uv.x);
  let cr = cui_h(vec2f(colId, seed));
  let tt = t * (0.16 + 0.34 * cr) + cr * 23.0;
  let slide = tt + 0.36 * sin(tt * 2.4 + cr * 6.2831);
  let y = uv.y / tall - slide;
  let row = floor(y);
  let n = cui_h2(vec2f(colId, row) + vec2f(seed * 7.1, seed));
  if (n.y > u.cui.y * 0.62) { return vec2f(0.0); }
  let fy = fract(y);
  let lx = fract(uv.x);
  // La trajectoire serpente : la traînée, lue à la hauteur de chaque point, suit le même chemin.
  let cx = 0.5 + (n.x - 0.5) * 0.3 + sin(uv.y * 1.9 + n.x * 6.2831) * 0.07;
  let cy = 0.82;
  var q = vec2f(lx - cx, (fy - cy) * tall);
  q.y *= select(1.0, 0.55, q.y < 0.0);
  let r = 0.12 + 0.08 * fract(n.y * 13.7);
  let d = length(q) / r;
  let drop = max(1.0 - d * d, 0.0);
  let above = (cy - fy) * tall;
  let reach = 2.7;
  let fade = clamp(1.0 - above / reach, 0.0, 1.0);
  let w = r * 0.6 * (0.35 + 0.65 * fade);
  let trail = step(0.0, above) * fade * (1.0 - smoothstep(w * 0.4, w, abs(lx - cx)));
  let b = vec2f((lx - cx) / (r * 0.42), (fract(uv.y * 4.5 + n.x) - 0.5) / 0.42);
  let bead = max(1.0 - dot(b, b), 0.0) * trail;
  return vec2f(max(drop, bead * 0.3), max(step(d, 1.0), trail));
}
// Les perles immobiles : elles se forment, tiennent, puis s'évaporent.
fn cui_rain_static(uv: vec2f, t: f32) -> f32 {
  let id = floor(uv);
  let n = cui_h2(id + 31.7);
  let life = fract(t * 0.045 + n.x);
  // La perle tient tout entière dans sa case : pas d'arête à la frontière, donc pas de pente parasite.
  let v = fract(uv) - 0.3 - 0.4 * cui_h2(id + 3.3);
  let r = 0.08 + 0.14 * n.y;
  let grow = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.7, 1.0, life));
  return max(1.0 - dot(v, v) / (r * r), 0.0) * grow * step(n.y, 0.7);
}
// La vitre entière : deux couches de gouttes, les perles, et l'essuyage autour du pointeur. (hauteur en px, vitre claire)
fn cui_rain(px: vec2f) -> vec2f {
  let dpr = u.res.z;
  let t = u.res.w;
  let S = 96.0 * dpr * u.cui.z;
  let a = cui_rain_layer(px / S, t, 1.0);
  let b = cui_rain_layer(px / (S * 0.56) + vec2f(3.7, 1.3), t * 1.25, 2.0);
  let clear = max(a.y, b.y);
  let st = cui_rain_static(px / (S * 0.3), t) * (1.0 - clear) * 0.55;
  let wipe = 1.0 - 0.92 * select(0.0, 1.0 - smoothstep(0.55, 1.0, length(px - u.cui2.xy) / (u.res.y * 0.2)), u.cui2.z > 0.5);
  return vec2f((a.x * 0.5 + b.x * 0.28 + st * 0.16) * S * 0.3 * wipe, clear * wipe);
}
fn cui_rain_g(px: vec2f) -> vec2f {
  let e = 1.25 * u.res.z;
  return vec2f(cui_rain(px + vec2f(e, 0.0)).x - cui_rain(px - vec2f(e, 0.0)).x, cui_rain(px + vec2f(0.0, e)).x - cui_rain(px - vec2f(0.0, e)).x) / (2.0 * e);
}

// Laser : la ligne du faisceau (y, px), son enveloppe sur la largeur (0–1), et la bande de révélation au-dessus (0–1).
fn cui_laser(px: vec2f) -> vec3f {
  let dpr = u.res.z;
  let t = u.res.w;
  let nx = (px.x - u.res.x * 0.5) / (u.res.x * 0.5 * 0.72);
  let env = pow(max(1.0 - nx * nx, 0.0), 1.5);
  let wav = (cui_vn(vec2f(px.x / (170.0 * dpr), t * 0.35)) - 0.5) * 20.0 * dpr * env;
  let ly = u.res.y - 140.0 * dpr * u.cui.z + wav;
  let k = clamp((ly - px.y) / (400.0 * dpr * u.cui.z), 0.0, 1.0);
  let band = exp(-3.0 * k) * (1.0 - smoothstep(0.8, 1.0, k)) * step(px.y, ly) * (0.25 + 0.75 * env);
  return vec3f(ly, env, band);
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
    // Déplacement : chaque cellule glisse d'un bloc, de la poussée qu'elle a reçue.
    off -= cui_push(px);
  } else if (cui_is(10.0)) {
    // Laser : au-dessus du faisceau, l'air chaud fait trembler la page.
    let L = cui_laser(px);
    let q = px / (38.0 * dpr) + vec2f(0.0, t * 1.4);
    off += (vec2f(cui_vn(q), cui_vn(q + 19.3)) - 0.5) * 2.0 * 12.0 * dpr * L.z * (0.35 + 0.9 * u.cui.w) * amt;
  } else if (cui_is(18.0)) {
    // Bulle : la goutte réfracte (loi de Snell, indice 1,33) ; presque rien au centre, de plus en plus vers le bord.
    let h = cui_bub_h(px);
    if (h > 0.0) {
      let n = cui_bub_n(px);
      let rf = refract(vec3f(0.0, 0.0, -1.0), n, 1.0 / 1.33);
      off += rf.xy * (80.0 * dpr * amt) / max(abs(rf.z), 0.35) * smoothstep(0.0, 3.0 * dpr, h) * u.ripples[0].w;
    }
  } else if (cui_is(19.0)) {
    // Gouttes : chaque goutte est une petite lentille ; la pente de sa surface dévie la lecture.
    off -= cui_rain_g(px) * 34.0 * dpr;
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
    // Un lustre sur la crête des plis.
    let nn = normalize(vec3f(-gx, -gy, 0.35));
    col += vec3f(1.0) * pow(max(dot(nn, normalize(vec3f(-0.45, -0.6, 0.66))), 0.0), 22.0) * 0.1 * amt;
    let weave = sin(px.x * 3.14159 / (1.6 * dpr)) * sin(px.y * 3.14159 / (1.6 * dpr));
    col *= 1.0 - 0.035 * amt * (weave * 0.5 + 0.5);
  } else if (cui_is(15.0) || cui_is(16.0)) {
    let cell = select(9.0, 12.0, cui_is(16.0)) * dpr * u.cui.z;
    let id = floor(px / cell);
    let local = px - id * cell;
    let c = source((id + 0.5) * cell, vec2f(0.0));
    let ink = clamp(1.0 - luma(c) / u.paper.g, 0.0, 1.0);
    if (cui_is(15.0)) {
      // Déchiffrer : la page est un chiffre ; autour du pointeur elle se déchiffre. Au bord du cercle, un front
      // d'onde : les signes s'y affolent, s'éclairent et verdissent, et la page déchiffrée y est frangée de couleur.
      let R = 300.0 * dpr * u.cui.z;
      let on = step(0.5, u.cui2.z);
      let dc = select(1e9, length(px - u.cui2.xy), on > 0.5);
      let clear = 1.0 - smoothstep(R * 0.5, R, dc);
      let bw = R * 0.1;
      let bd = dc - R * 0.75;
      let ring = exp(-bd * bd / (2.0 * bw * bw)) * on;
      let green = vec3f(0.29, 0.87, 0.5);
      if (ring > 0.01) {
        let ab = vec2f(10.0 * dpr * ring, 0.0);
        col = vec3f(source(px, lens + ab).r, col.g, source(px, lens - ab).b);
        col = mix(col, col * 0.75 + green * 0.25, ring * 0.35);
      }
      if (clear < 0.999) {
        // Au repos, un signe sur dix continue de changer ; dans le front, tous.
        let live = step(cui_h(id + 3.1), 0.1 + ring);
        let idx = 6 + i32(cui_h(id + live * floor(t * mix(6.0, 30.0, ring) + cui_h(id) * 7.0)) * 10.0);
        let g = cui_glyph(local, cell, idx) * step(0.1, ink);
        let signe = mix(mix(vec3f(0.07), c * 0.85, 0.5), green * 0.62, ring * 0.75);
        var cipher = mix(u.paper.rgb, signe, g * min(1.0, 1.0 + ring));
        cipher = mix(cipher, col, 0.15);
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
    // Les cellules déplacées se frangent de couleur et prennent du grain ; les autres restent nettes.
    let p = cui_push(px);
    let k = smoothstep(1.5 * dpr, 18.0 * dpr, length(p));
    if (k > 0.0) {
      col = vec3f(source(px, lens + p * 0.3).r, col.g, source(px, lens - p * 0.3).b);
      col += (cui_h(floor(px / dpr) + floor(t * 24.0) * 1.7) - 0.5) * 0.16 * k;
    }
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
    // Laser : un faisceau effilé près du bas de l'écran. Sous lui la page attend dans le noir ; en le franchissant
    // (faites défiler) elle sort chauffée : une lueur, des paillettes, qui s'éteignent en montant.
    let L = cui_laser(px);
    let d = px.y - L.x;
    let act = u.cui.w;
    let beam = vec3f(0.05, 0.35, 1.0);
    let flick = 1.0 - 0.2 * cui_h(vec2f(floor(t * 30.0), 1.0));
    if (d > 0.0) {
      let hide = smoothstep(0.0, 8.0 * dpr, d) * clamp(amt * 0.96, 0.0, 0.96);
      col = mix(col, vec3f(0.02, 0.025, 0.05), hide);
    } else {
      let ink = clamp(1.0 - luma(col) / u.paper.g, 0.0, 1.0);
      let heat = L.z * (1.0 + act) * amt;
      // L'encre fraîchement révélée luit ; le papier se teinte à peine.
      col = mix(col, beam * 1.25 + vec3f(0.25), ink * clamp(heat * 1.5, 0.0, 0.9));
      col = mix(col, col * (vec3f(0.82, 0.9, 1.08)), clamp(heat, 0.0, 1.0) * 0.6);
      let q = px / (7.0 * dpr) + vec2f(0.0, t * 2.0);
      let sp = pow(cui_vn(q) * cui_vn(q * 0.37 + 11.0), 3.0);
      col += beam * sp * 2.2 * heat * 0.25 * 4.0;
    }
    let ad = abs(d);
    let core = exp(-pow(ad / (3.0 * dpr), 2.0)) * L.y;
    let rad = 20.0 * dpr;
    let glow = pow(rad / (ad + rad * 0.25), 0.9) * exp(-0.55 * ad / rad) * L.y;
    let emit = (beam * glow * 2.0 * (0.6 + 0.8 * act) + vec3f(1.0) * core * 2.5) * flick * amt;
    col = 1.0 - (1.0 - col) * exp(-emit);
  } else if (cui_is(18.0)) {
    // Bulle : dispersion des couleurs, bord assombri, éclat, et un film irisé qui roule sur la surface.
    let h = cui_bub_h(px);
    let m = smoothstep(0.0, 2.0 * dpr, h) * u.ripples[0].w;
    if (m > 0.0) {
      let n = cui_bub_n(px);
      col = vec3f(source(px, lens * 1.07).r, col.g, source(px, lens * 0.93).b);
      let edge = pow(1.0 - n.z, 1.5);
      col *= 1.0 - 0.5 * edge * m;
      let rfl = reflect(vec3f(0.0, 0.0, -1.0), n);
      let s1 = cui_vn(rfl.xy * 2.6 + vec2f(t * 0.5, 0.0) + n.z);
      let s2 = cui_vn(rfl.yx * 3.4 - vec2f(0.0, t * 0.4) + 7.0);
      let film = (vec3f(0.29, 0.455, 0.72) * s1 + vec3f(0.62, 0.45, 0.75) * s2) * (0.25 + 0.75 * edge);
      col += film * 0.28 * amt * m;
      col += vec3f(1.0) * pow(s1 * s2 * 1.6, 7.0) * 0.4 * edge * m;
      col += vec3f(1.0) * pow(max(dot(rfl, normalize(vec3f(-0.5, -0.7, 0.6))), 0.0), 60.0) * 0.6 * m;
    }
  } else if (cui_is(19.0)) {
    // Gouttes : hors des gouttes la vitre est un peu embuée ; sur chaque goutte, un bord sombre et un éclat.
    let r = cui_rain(px);
    let g = cui_rain_g(px);
    let slope = length(g);
    let on = smoothstep(0.0, 1.5 * dpr, r.x);
    col = mix(col, mix(col, u.paper.rgb, 0.1) * 0.97, (1.0 - r.y) * (1.0 - on) * amt);
    col *= 1.0 - 0.2 * smoothstep(0.5, 1.3, slope) * on;
    let n = normalize(vec3f(-g, 0.9));
    col += vec3f(1.0) * pow(max(dot(n, normalize(vec3f(-0.45, -0.65, 0.6))), 0.0), 34.0) * 0.55 * on;
  }
  return col;
}
`;
