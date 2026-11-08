// Carnet — effets P0 (roadmap § 3.6) : crayon, encre fraîche, papier éclairé.
//
// Source unique : incluse telle quelle par le moteur TypeScript (src/gpu/wgsl.ts, import ?raw) et par
// presse-rs (include_str!). Aucune ressource propre, aucun état : chaque effet est une fonction pure
// de la position, du temps écoulé depuis l'événement (calculé côté hôte) et d'une graine. Il n'y a
// donc rien à mettre en cache ni à reconstruire après une perte de l'appareil, et le mouvement
// réduit saute directement à l'état final (calculé, pas simulé).
//
// Contrat :
//   - unités : pixels CSS (position relative à l'élément pour les matières, à l'écran pour la
//     lumière, convertie depuis les pixels physiques avec le dpr) ;
//   - couleurs : sRGB encodé, non prémultiplié (comme le reste de Presse) ;
//   - état final : encre sèche = la lettre normale, à l'identique (lisibilité et parité) ;
//   - coût : matières, deux bruits de valeur par fragment de lettre ; lumière, sept bruits par pixel
//     d'écran, une fois par image peinte (le moteur dort entre deux changements).
//
// Version de l'algorithme : 2 (graphite argenté sur papier sombre ; changer les formules = changer ce numéro, roadmap § 3.6).

const CFX_VERSION: u32 = 2u;
const CFX_GRAPHITE: vec3f = vec3f(0.36, 0.37, 0.40);

fn cfx_hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn cfx_noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let s = f * f * (3.0 - 2.0 * f);
  let a = cfx_hash(i);
  let b = cfx_hash(i + vec2f(1.0, 0.0));
  let c = cfx_hash(i + vec2f(0.0, 1.0));
  let d = cfx_hash(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

/* ───── Matières de l'encre ───── */

// Ce qu'une lettre doit à sa matière : décalage du seuil du champ de distance (positif : plus
// maigre), facteur d'opacité, couleur.
struct CfxMat {
  edge: f32,
  alpha: f32,
  col: vec3f,
};

// Avant la couverture : le seuil. `pencil` 0…1 (1 = crayon), `wet` 0…1 (1 = encre qui vient de
// toucher le papier), `p` position de la lettre dans son élément (px css) décalée par la graine.
fn cfx_edge(pencil: f32, wet: f32, p: vec2f) -> f32 {
  // Le graphite dépose un trait plus fin ; l'encre mouillée s'étale, inégalement, le long des
  // fibres (capillarité) : bruit lent, étiré à l'horizontale.
  let bleed = 0.03 + 0.05 * cfx_noise(p * vec2f(0.16, 0.32));
  return pencil * 0.035 - wet * bleed;
}

// Après la couverture : opacité et couleur. `d` champ de distance, `edge` seuil final,
// `grad` gradient écran du champ (normalisé ou nul), `lightDir` d'où vient la lumière (écran),
// `paper` clarté du papier (0 nuit … 1 blanc).
fn cfx_mat(pencil: f32, wet: f32, p: vec2f, col: vec3f, d: f32, edge: f32, grad: vec2f, lightDir: vec2f, paper: f32) -> CfxMat {
  var m: CfxMat;
  m.edge = 0.0;
  // Crayon : le graphite n'accroche que les sommets de la dent du papier.
  let tooth = cfx_noise(p * 0.55) * 0.6 + cfx_noise(p * 1.7 + vec2f(3.1, 7.7)) * 0.4;
  let grain = clamp(0.42 + 0.8 * smoothstep(0.28, 0.78, tooth), 0.0, 1.0);
  m.alpha = mix(1.0, grain, pencil);
  // Sur papier sombre, l'encre est claire : le graphite y est argenté, pas sombre (sinon illisible).
  let graphite = select(CFX_GRAPHITE, vec3f(0.62, 0.63, 0.66), paper < 0.5);
  var c = mix(col, graphite, pencil * 0.6);
  // Encre fraîche : plus sombre, un peu bleutée, et brillante sur le bord tourné vers la lumière.
  // Le reflet suit le gradient du champ : il dessine le relief de la goutte, pas un contour.
  c = c * (1.0 - 0.2 * wet) + vec3f(0.0, 0.008, 0.04) * wet;
  let inside = smoothstep(0.0, 0.05, d - edge) * (1.0 - smoothstep(0.06, 0.16, d - edge));
  let facing = clamp(dot(-grad, lightDir), 0.0, 1.0);
  c = mix(c, vec3f(1.0), 0.38 * wet * inside * facing * facing);
  m.col = c;
  return m;
}

/* ───── Papier éclairé ───── */

// Relief de la feuille : fibres longues et dent fine (px css).
fn cfx_height(q: vec2f) -> f32 {
  let warp = cfx_noise(q / 42.0) * 4.0;
  return cfx_noise(q / 3.2) * 0.55 + cfx_noise(vec2f(q.x / 1.3, q.y / 0.9) + vec2f(0.0, warp)) * 0.45;
}

// `light` : direction vers la lumière à l'écran (x, y ; sa longueur = lumière rasante), force du
// relief (0 : éteint), 0. `lamp` : chaleur (−1 froid … 1 chaud), force de la flaque de lampe,
// centre de la flaque (uv). `paperish` 0…1 : 1 sur le papier vierge, plus faible sous l'encre.
fn cfx_paper_light(col: vec3f, px: vec2f, uv: vec2f, aspect: f32, dpr: f32, light: vec4f, lamp: vec4f, paperish: f32) -> vec3f {
  if (light.z <= 0.0) { return col; }
  let q = px / dpr;
  let h0 = cfx_height(q);
  let hx = cfx_height(q + vec2f(1.0, 0.0)) - h0;
  let hy = cfx_height(q + vec2f(0.0, 1.0)) - h0;
  let n = normalize(vec3f(-hx * 1.6, -hy * 1.6, 1.0));
  let rake = clamp(length(light.xy), 0.0, 0.95);
  let l = normalize(vec3f(light.xy, sqrt(1.0 - rake * rake)));
  // Relief : nul sur une feuille plane (n = z), visible en lumière rasante ; plus faible sous l'encre.
  let relief = clamp((dot(n, l) - l.z) / max(l.z, 0.2), -1.0, 1.0) * light.z * mix(0.4, 1.0, paperish);
  // Pente douce de la lumière à travers la page, côté lumière plus clair.
  let side = dot((uv - 0.5) * vec2f(aspect, 1.0), normalize(light.xy + vec2f(1e-4))) * rake;
  var k = 1.0 + relief * 0.05 + side * 0.03 * light.z;
  // Flaque de lampe : le soir, la page s'assombrit doucement loin de la lampe.
  let dl = distance(uv * vec2f(aspect, 1.0), lamp.zw * vec2f(aspect, 1.0));
  k *= 1.0 - lamp.y * 0.08 * smoothstep(0.15, 1.15, dl);
  // Chaleur : teinte légère, d'abord sur le papier.
  let warm = vec3f(1.025, 1.0, 0.95);
  let cool = vec3f(0.975, 0.99, 1.025);
  let tint = mix(vec3f(1.0), select(cool, warm, lamp.x > 0.0), abs(lamp.x) * mix(0.5, 1.0, paperish));
  return col * k * tint;
}
