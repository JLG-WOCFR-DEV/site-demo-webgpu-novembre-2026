/**
 * Tissu — une étoffe simulée en WebGPU, sur laquelle est imprimé du HTML.
 *
 * Simulation (passes de calcul) : une grille de particules (≈ 100 × 60) intégrée en Verlet, puis des contraintes de
 * distance résolues à la Jacobi (chaque particule lit ses voisines dans un tampon et écrit dans l'autre) : trame et
 * chaîne, biais (cisaillement), et un voisin sur deux pour la raideur en flexion. Deux sous-pas de 16 relaxations par
 * image. Le mur (la page) arrête le tissu : z ≥ 0.
 *
 * Trois façons de le tenir :
 *   drap      posé à plat sur la page, retenu par une accroche douce qui lâche quand on tire (il se décolle, puis
 *             revient se coller) ;
 *   rideau    accroché par le haut, froncé (des plis tous les six points), la pesanteur fait le reste ;
 *   suspendu  tenu par ses deux coins hauts, rapprochés : il pend en chaînette.
 *
 * La main : au clic, le GPU retient les particules proches du pointeur (avec leur décalage), puis les mène tant que
 * le bouton est enfoncé, en les soulevant vers l'œil ; au relâché, il les rend à la simulation.
 *
 * Rendu : le maillage est lu dans le tampon des positions par le vertex shader (normales par différences centrées),
 * en légère perspective ; l'étoffe est procédurale (jacquard, lin, velours) avec ses fils en relief ; le HTML est une
 * texture posée en coordonnées d'étoffe, imprimée à l'encre (l'encre prend moins au fond des sillons). Une ombre
 * portée, calculée à quart de résolution puis floutée, sous ce qui se soulève.
 */

export type ClothMode = "drap" | "rideau" | "suspendu";
export type Fabric = "jacquard" | "lin" | "velours";
const MODES: ClothMode[] = ["drap", "rideau", "suspendu"];
const FABRICS: Fabric[] = ["jacquard", "lin", "velours"];

const COMMON = /* wgsl */ `
struct U {
  grid: vec4f,   // nx, ny, pas x, pas y (px css)
  sim: vec4f,    // dt, pesanteur (px/s²), amortissement, mode (0 drap, 1 rideau, 2 suspendu)
  grab: vec4f,   // pointeur x, y (px, repère de l'étoffe), état (0 rien, 1 tenu, 2 saisi à l'instant), rayon
  misc: vec4f,   // temps (s), vent, soulèvement de la main (px), raideur de l'accroche
  view: vec4f,   // largeur, hauteur de l'étoffe (px), marge du canvas (px), focale (px)
  canv: vec4f,   // largeur, hauteur du canvas (px css), rappel du drap (0 → 1 après le relâché), étoffe (0 jacquard, 1 lin, 2 velours)
};
@group(0) @binding(0) var<uniform> u: U;
fn rest_of(i: u32, j: u32) -> vec3f { return vec3f(f32(i) * u.grid.z, f32(j) * u.grid.w, 0.0); }
/** Point d'attache imposé (xyz, w = 1 si attaché). */
fn pin_of(i: u32, j: u32) -> vec4f {
  let nx = u32(u.grid.x);
  let r = rest_of(i, j);
  let W = (u.grid.x - 1.0) * u.grid.z;
  let mode = u.sim.w;
  if (mode > 0.5 && mode < 1.5 && j == 0u) {
    // Rideau : la tête est froncée — resserrée à 80 %, un pli tous les six points.
    let x = W * 0.5 + (r.x - W * 0.5) * 0.8;
    let z = u.grid.z * 1.05 * (0.5 - 0.5 * cos(f32(i) * 6.2831853 / 6.0));
    return vec4f(x, r.y, z, 1.0);
  }
  if (mode > 1.5 && j == 0u && (i == 0u || i == nx - 1u)) {
    // Suspendu : deux coins, rapprochés.
    let x = W * 0.5 + (r.x - W * 0.5) * 0.84;
    return vec4f(x, r.y, 0.0, 1.0);
  }
  return vec4f(0.0);
}
`;

const SIM = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> prev: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> held: array<vec4f>;

@compute @workgroup_size(64)
fn integrate(@builtin(global_invocation_id) id: vec3u) {
  let n = u32(u.grid.x * u.grid.y);
  let k = id.x;
  if (k >= n) { return; }
  let nx = u32(u.grid.x);
  let i = k % nx;
  let j = k / nx;
  let p = pos[k].xyz;
  let q = prev[k].xyz;
  let dt = u.sim.x;
  let pin = pin_of(i, j);
  if (pin.w > 0.5) {
    pos[k] = vec4f(pin.xyz, 0.0);
    prev[k] = vec4f(pin.xyz, 0.0);
    held[k] = vec4f(0.0);
    return;
  }
  let r = rest_of(i, j);
  let v = (p - q) * u.sim.z;
  var acc = vec3f(0.0, u.sim.y, 0.0);
  if (u.sim.w < 0.5) {
    // Drap : une accroche douce vers sa place, qui lâche quand on l'en éloigne (la pesanteur ne prend que ce qui a
    // lâché) ; au relâché, le rappel remonte en une seconde et le drap revient se coller.
    let d = r - p;
    let attach = clamp(max(0.04 + u.canv.z, exp(-length(d) / 70.0)), 0.0, 1.0);
    acc = d * u.misc.w * attach + vec3f(0.0, u.sim.y * (1.0 - attach), 0.0);
  }
  if (u.misc.y > 0.0) {
    // Vent : des rafales qui traversent l'étoffe.
    let t = u.misc.x;
    let w = 0.5 * sin(r.x * 0.006 + t * 1.3) + 0.5 * sin(r.y * 0.011 - t * 2.1 + r.x * 0.003);
    acc += u.misc.y * vec3f(w * 160.0, 0.0, (0.55 + 0.45 * w) * 700.0);
  }
  var np = p + v + acc * dt * dt;
  // La main.
  var h = held[k];
  let g = u.grab;
  if (g.z > 1.5) {
    let d = length(p.xy - g.xy);
    h = vec4f(p - vec3f(g.xy, 0.0), 1.0 - smoothstep(g.w * 0.2, g.w, d));
  }
  if (g.z < 0.5) { h.w = 0.0; }
  if (h.w > 0.0) {
    let goal = vec3f(g.xy + h.xy, h.z + u.misc.z * h.w);
    np = mix(np, goal, h.w);
  }
  held[k] = h;
  np.z = max(np.z, 0.0);
  prev[k] = vec4f(p, 1.0);
  pos[k] = vec4f(np, 1.0);
}
`;

const RELAX = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> dst: array<vec4f>;
@group(0) @binding(3) var<storage, read> held: array<vec4f>;

// Voisins : trame et chaîne (1), biais (0,5), un sur deux pour la flexion (0,3).
var<private> NB: array<vec3i, 12> = array<vec3i, 12>(
  vec3i(1, 0, 10), vec3i(-1, 0, 10), vec3i(0, 1, 10), vec3i(0, -1, 10),
  vec3i(1, 1, 5), vec3i(-1, -1, 5), vec3i(1, -1, 5), vec3i(-1, 1, 5),
  vec3i(2, 0, 3), vec3i(-2, 0, 3), vec3i(0, 2, 3), vec3i(0, -2, 3));

@compute @workgroup_size(64)
fn relax(@builtin(global_invocation_id) id: vec3u) {
  let n = u32(u.grid.x * u.grid.y);
  let k = id.x;
  if (k >= n) { return; }
  let p = src[k];
  let hw = held[k].w;
  if (p.w < 0.5 || hw > 0.98) { dst[k] = p; return; }
  let nx = i32(u.grid.x);
  let ny = i32(u.grid.y);
  let i = i32(k) % nx;
  let j = i32(k) / nx;
  var corr = vec3f(0.0);
  var ws = 0.0;
  for (var c = 0; c < 12; c++) {
    let o = NB[c];
    let ii = i + o.x;
    let jj = j + o.y;
    if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) { continue; }
    let q = src[jj * nx + ii].xyz;
    let d = q - p.xyz;
    let l = length(d);
    let rest = length(vec2f(f32(o.x) * u.grid.z, f32(o.y) * u.grid.w));
    let w = f32(o.z) * 0.1;
    if (l > 1e-4) {
      corr += w * 0.5 * (l - rest) * d / l;
      ws += w;
    }
  }
  var np = p.xyz + corr * (1.55 / max(ws, 1e-3));
  np = mix(np, p.xyz, hw);
  np.z = max(np.z, 0.0);
  dst[k] = vec4f(np, 1.0);
}
`;

const RENDER = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var html: texture_2d<f32>;
@group(0) @binding(4) var shadow: texture_2d<f32>;

fn P(i0: i32, j0: i32) -> vec3f {
  let nx = i32(u.grid.x);
  let i = clamp(i0, 0, nx - 1);
  let j = clamp(j0, 0, i32(u.grid.y) - 1);
  return pos[j * nx + i].xyz;
}
/** Repère de l'étoffe (px) → écran (clip), en légère perspective autour du centre de l'étoffe. */
fn project(p: vec3f, depth: f32) -> vec4f {
  let c = u.view.xy * 0.5;
  let s = u.view.w / max(u.view.w - p.z, 1.0);
  let xy = c + (p.xy - c) * s + vec2f(u.view.z);
  return vec4f(xy.x / u.canv.x * 2.0 - 1.0, 1.0 - xy.y / u.canv.y * 2.0, depth, 1.0);
}
fn corner_of(vi: u32) -> vec2i {
  let nx = i32(u.grid.x);
  let cells = nx - 1;
  let cell = i32(vi / 6u);
  var o = array<vec2i, 6>(vec2i(0, 0), vec2i(1, 0), vec2i(0, 1), vec2i(1, 0), vec2i(1, 1), vec2i(0, 1));
  return vec2i(cell % cells, cell / cells) + o[vi % 6u];
}

struct VO {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) n: vec3f,
  @location(2) z: f32,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VO {
  let ij = corner_of(vi);
  let p = P(ij.x, ij.y);
  let dx = P(ij.x + 1, ij.y) - P(ij.x - 1, ij.y);
  let dy = P(ij.x, ij.y + 1) - P(ij.x, ij.y - 1);
  var o: VO;
  o.clip = project(p, 0.5 - p.z / 4000.0);
  o.uv = vec2f(f32(ij.x) / (u.grid.x - 1.0), f32(ij.y) / (u.grid.y - 1.0));
  o.n = normalize(cross(dx, dy));
  o.z = p.z;
  return o;
}

fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vn(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let s = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), s.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), s.x), s.y);
}
fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var a = 0.5;
  var v = 0.0;
  for (var i = 0; i < 4; i++) {
    v += a * vn(p);
    p = p * 2.03 + vec2f(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
/**
 * Un fil : 0,5 + 0,5 sin, filtré sur la largeur de deux pixels d'écran (moyenne exacte d'un sinus sur une fenêtre :
 * un sinus cardinal). Les fils trop fins pour l'écran se fondent en leur teinte moyenne au lieu de faire du moiré.
 */
fn thread(x: f32, period: f32, fp: f32) -> f32 {
  let w = 2.0 * fp / period;
  var k = 1.0;
  if (w > 1e-3) { k = sin(3.14159265 * w) / (3.14159265 * w); }
  k = select(clamp(k, 0.0, 1.0), 0.0, w >= 1.0);
  return 0.5 + 0.5 * sin(x * 6.2831853 / period) * k;
}
/** L'étoffe au point px (px css de l'étoffe) : couleur, et relief du fil (0 sillon, 1 crête). */
fn fabric(px: vec2f, uv: vec2f, kind: f32, fp: f32) -> vec4f {
  let aspect = u.view.x / max(u.view.y, 1.0);
  // Les fils s'effacent quand ils deviennent plus fins que deux pixels d'écran (sinon : moiré).
  let fine = smoothstep(1.6, 3.6, 3.0 / max(fp, 1e-3));
  if (kind < 0.5) {
    // Jacquard : de grandes bandes qui ondulent, trois verts, des côtes de chaîne qui penchent avec le motif.
    let f = vec2f(uv.x * aspect, uv.y) * 2.1;
    let w = fbm(f * 0.9 + 3.1);
    let s = f.x * 1.25 + 0.6 * sin(f.y * 2.2 + w * 3.0) + w * 1.7;
    // Deux fréquences mêlées : des bandes de largeurs inégales, quatre verts.
    let band = 0.5 + 0.5 * (0.65 * sin(s * 7.2) + 0.35 * sin(s * 3.1 + w * 4.0));
    let band2 = 0.5 + 0.5 * sin(s * 14.4 + 1.0);
    var c = mix(vec3f(0.19, 0.29, 0.18), vec3f(0.37, 0.43, 0.26), smoothstep(0.18, 0.45, band));
    c = mix(c, vec3f(0.55, 0.57, 0.39), smoothstep(0.45, 0.68, band));
    c = mix(c, vec3f(0.73, 0.71, 0.54), smoothstep(0.7, 0.93, band) * (0.55 + 0.45 * band2));
    let tilt = (band - 0.5) * 0.7;
    let rib = thread(px.x + px.y * tilt, 3.4, fp * (1.0 + abs(tilt)));
    let weft = thread(px.y + rib * 0.67, 2.1, fp);
    let fuzz = vn(px * vec2f(0.6, 0.15));
    let hgt = clamp(rib * 0.62 + weft * 0.16 + fuzz * 0.26, 0.0, 1.0);
    return vec4f(c * (0.7 + 0.42 * hgt), hgt);
  }
  if (kind < 1.5) {
    // Lin écru : toile serrée, fils irréguliers (flammes) et quelques fils plus épais.
    let warp = thread(px.x, 2.4, fp);
    let weft = thread(px.y, 2.4, fp);
    let row = floor(px.y / 2.4);
    let col = floor(px.x / 2.4);
    let slubY = vn(vec2f(px.x * 0.035, row * 1.7));
    let slubX = vn(vec2f(col * 1.3, px.y * 0.03));
    let over = step(0.5, fract((row + col) * 0.5));
    let hgt = clamp(mix(warp, weft, over) * 0.6 + max(slubX, slubY) * 0.4, 0.0, 1.0);
    var c = vec3f(0.85, 0.81, 0.72) * (0.92 + 0.12 * fbm(uv * vec2f(aspect, 1.0) * 6.0));
    c *= 1.0 - 0.18 * smoothstep(0.7, 1.0, max(slubX, slubY));
    return vec4f(c * (0.78 + 0.3 * hgt), hgt);
  }
  // Velours bordeaux : un poil fin, des plages écrasées qui accrochent la lumière autrement.
  let pile = mix(0.5, vn(px * 1.1), fine);
  let crush = fbm(vec2f(uv.x * aspect, uv.y) * 3.0);
  let hgt = clamp(pile * 0.5 + crush * 0.5, 0.0, 1.0);
  let c = mix(vec3f(0.30, 0.03, 0.06), vec3f(0.52, 0.07, 0.11), smoothstep(0.3, 0.75, crush));
  return vec4f(c * (0.85 + 0.25 * pile), hgt);
}

@fragment
fn fs(in: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let kind = u.canv.w;
  let px = in.uv * u.view.xy;
  // Empreinte d'un pixel d'écran sur l'étoffe (px css d'étoffe par pixel d'appareil).
  let fp = max(length(dpdx(px)), length(dpdy(px)));
  let fab = fabric(px, in.uv, kind, fp);
  let hgt = fab.a;
  let hx = dpdx(hgt);
  let hy = dpdy(hgt);
  let h = textureSample(html, samp, in.uv);
  var N = normalize(in.n);
  if (!ff) { N = -N; }
  N = normalize(N + vec3f(-hx, -hy, 0.0) * 0.5);
  var col = fab.rgb;
  if (ff) {
    // L'impression : l'encre prend moins au fond des sillons.
    let a = clamp(h.a * mix(0.72, 1.0, hgt), 0.0, 1.0);
    let ink = h.rgb / max(h.a, 1e-3);
    col = mix(col, ink * (0.86 + 0.14 * hgt), a);
  } else {
    col *= 0.68;
  }
  let L = normalize(vec3f(-0.35, -0.55, 0.76));
  let diff = 0.5 + 0.5 * dot(N, L);
  var sheenK = 0.18;
  var sheenC = vec3f(1.0);
  if (kind > 1.5) { sheenK = 0.9; sheenC = vec3f(0.95, 0.42, 0.48); }
  else if (kind > 0.5) { sheenK = 0.1; }
  let sheen = pow(1.0 - clamp(abs(N.z), 0.0, 1.0), 2.2) * sheenK;
  // Les creux des plis s'assombrissent : plus la normale fuit l'œil, moins de lumière ambiante.
  let occl = mix(0.72, 1.0, smoothstep(0.1, 0.9, abs(N.z)));
  col = col * (0.32 + 0.78 * diff) * occl + sheenC * sheen * (0.4 + 0.6 * diff);
  return vec4f(col, 1.0);
}

/* Ombre : le maillage projeté sur le mur, d'autant plus loin qu'il s'en écarte ; alpha selon la hauteur. */
struct SO { @builtin(position) clip: vec4f, @location(0) a: f32 };
@vertex
fn vs_shadow(@builtin(vertex_index) vi: u32) -> SO {
  let ij = corner_of(vi);
  let p = P(ij.x, ij.y);
  let off = vec2f(0.22, 0.5) * p.z * 1.3;
  var o: SO;
  o.clip = project(vec3f(p.xy + off, 0.0), 0.5);
  o.a = 0.42 * smoothstep(1.0, 70.0, p.z);
  return o;
}
@fragment
fn fs_shadow(in: SO) -> @location(0) vec4f { return vec4f(in.a, 0.0, 0.0, 1.0); }

/* L'ombre floutée, posée sous l'étoffe (plein écran). */
struct QO { @builtin(position) clip: vec4f, @location(0) uv: vec2f };
@vertex
fn vs_quad(@builtin(vertex_index) vi: u32) -> QO {
  let q = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  var o: QO;
  o.clip = vec4f(q, 0.0, 1.0);
  o.uv = vec2f(q.x * 0.5 + 0.5, 0.5 - q.y * 0.5);
  return o;
}
@fragment
fn fs_quad(in: QO) -> @location(0) vec4f {
  let ts = 1.0 / vec2f(textureDimensions(shadow));
  var a = 0.0;
  var w = 0.0;
  for (var y = -3; y <= 3; y++) {
    for (var x = -3; x <= 3; x++) {
      let k = exp(-f32(x * x + y * y) / 8.0);
      a += textureSampleLevel(shadow, samp, in.uv + vec2f(f32(x), f32(y)) * ts * 1.8, 0.0).r * k;
      w += k;
    }
  }
  a /= w;
  return vec4f(0.0, 0.0, 0.0, a);
}
`;

export type Cloth = {
  /** Repère : coin haut-gauche de l'étoffe (px css, relatif au canvas : la marge). */
  mode: ClothMode;
  fabric: Fabric;
  wind: number;
  /** Le pointeur, en px css relatifs au coin de l'étoffe. */
  grab(x: number, y: number): void;
  move(x: number, y: number): void;
  release(): void;
  /** Remet l'étoffe à plat. */
  reset(): void;
  /** Texture où peindre le HTML (taille en px d'appareil). */
  htmlTexture(): GPUTexture;
  /** La taille de l'étoffe a changé (px css). */
  resize(w: number, h: number): void;
  /** Dernier mouvement de la main (horloge performance.now). */
  lastTouch(): number;
  stop(): void;
};

export async function createCloth(device: GPUDevice, canvas: HTMLCanvasElement, opts: { width: number; height: number; margin: number; texScale: number }): Promise<Cloth> {
  const ctx = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "premultiplied" });

  const check = async (m: GPUShaderModule, name: string) => {
    const errs = (await m.getCompilationInfo()).messages.filter((x) => x.type === "error");
    if (errs.length) throw new Error(`[tissu] ${name} : ${errs.map((e) => `${e.lineNum}:${e.message}`).join(" | ")}`);
  };
  const simMod = device.createShaderModule({ code: SIM });
  const relaxMod = device.createShaderModule({ code: RELAX });
  const renderMod = device.createShaderModule({ code: RENDER });
  await Promise.all([check(simMod, "simulation"), check(relaxMod, "relaxation"), check(renderMod, "rendu")]);

  const [integratePipe, relaxPipe, clothPipe, shadowPipe, quadPipe] = await Promise.all([
    device.createComputePipelineAsync({ layout: "auto", compute: { module: simMod, entryPoint: "integrate" } }),
    device.createComputePipelineAsync({ layout: "auto", compute: { module: relaxMod, entryPoint: "relax" } }),
    device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module: renderMod, entryPoint: "vs" },
      fragment: { module: renderMod, entryPoint: "fs", targets: [{ format }] },
      // Le repère de l'étoffe a l'axe y vers le bas : vus de face, ses triangles tournent dans le sens horaire.
      primitive: { topology: "triangle-list", cullMode: "none", frontFace: "cw" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
    }),
    device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module: renderMod, entryPoint: "vs_shadow" },
      fragment: { module: renderMod, entryPoint: "fs_shadow", targets: [{ format: "r8unorm", blend: { color: { operation: "max", srcFactor: "one", dstFactor: "one" }, alpha: { operation: "max", srcFactor: "one", dstFactor: "one" } } }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
    }),
    device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module: renderMod, entryPoint: "vs_quad" },
      fragment: {
        module: renderMod,
        entryPoint: "fs_quad",
        targets: [{ format, blend: { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" } } }],
      },
      primitive: { topology: "triangle-list" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "always" },
    }),
  ]);

  const ubuf = device.createBuffer({ size: 6 * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const U = new Float32Array(24);
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });

  let W = opts.width;
  let H = opts.height;
  let NX = 0;
  let NY = 0;
  let N = 0;
  let posA!: GPUBuffer, posB!: GPUBuffer, prev!: GPUBuffer, held!: GPUBuffer;
  let simBind!: GPUBindGroup, relaxAB!: GPUBindGroup, relaxBA!: GPUBindGroup, clothBind!: GPUBindGroup, shadowBind!: GPUBindGroup, quadBind!: GPUBindGroup;
  let htmlTex!: GPUTexture;
  let shadowTex!: GPUTexture;
  let depthTex!: GPUTexture;

  const rest = () => {
    const data = new Float32Array(N * 4);
    const sx = W / (NX - 1);
    const sy = H / (NY - 1);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) data.set([i * sx, j * sy, 0, 1], (j * NX + i) * 4);
    return data;
  };
  const build = () => {
    for (const b of [posA, posB, prev, held]) b?.destroy();
    NX = Math.round(Math.min(120, Math.max(36, W / 13)));
    NY = Math.max(12, Math.round(((NX - 1) * H) / W) + 1);
    N = NX * NY;
    const mk = () => device.createBuffer({ size: N * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    posA = mk();
    posB = mk();
    prev = mk();
    held = mk();
    const r = rest();
    device.queue.writeBuffer(posA, 0, r);
    device.queue.writeBuffer(posB, 0, r);
    device.queue.writeBuffer(prev, 0, r);
    device.queue.writeBuffer(held, 0, new Float32Array(N * 4));
    htmlTex?.destroy();
    htmlTex = device.createTexture({
      size: [Math.max(1, Math.round(W * opts.texScale)), Math.max(1, Math.round(H * opts.texScale))],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    simBind = device.createBindGroup({
      layout: integratePipe.getBindGroupLayout(0),
      entries: [ubuf, posA, prev, held].map((b, i) => ({ binding: i, resource: { buffer: b } })),
    });
    const rb = (a: GPUBuffer, b: GPUBuffer) =>
      device.createBindGroup({ layout: relaxPipe.getBindGroupLayout(0), entries: [ubuf, a, b, held].map((x, i) => ({ binding: i, resource: { buffer: x } })) });
    relaxAB = rb(posA, posB);
    relaxBA = rb(posB, posA);
    sizeTargets();
  };
  const sizeTargets = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const cw = W + opts.margin * 2;
    const ch = H + opts.margin * 2;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    depthTex?.destroy();
    shadowTex?.destroy();
    depthTex = device.createTexture({ size: [canvas.width, canvas.height], format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT });
    shadowTex = device.createTexture({ size: [Math.max(1, canvas.width >> 2), Math.max(1, canvas.height >> 2)], format: "r8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    clothBind = device.createBindGroup({
      layout: clothPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: ubuf } },
        { binding: 1, resource: { buffer: posA } },
        { binding: 2, resource: sampler },
        { binding: 3, resource: htmlTex.createView() },
      ],
    });
    shadowBind = device.createBindGroup({
      layout: shadowPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: ubuf } },
        { binding: 1, resource: { buffer: posA } },
      ],
    });
    quadBind = device.createBindGroup({
      layout: quadPipe.getBindGroupLayout(0),
      entries: [
        { binding: 2, resource: sampler },
        { binding: 4, resource: shadowTex.createView() },
      ],
    });
  };
  build();

  const api: Cloth = {
    mode: "drap",
    fabric: "jacquard",
    wind: 0,
    grab(x, y) {
      grab = { x, y, state: 2 };
      touched = performance.now();
    },
    move(x, y) {
      if (grab.state) ((grab.x = x), (grab.y = y));
      touched = performance.now();
    },
    release() {
      grab.state = 0;
      touched = performance.now();
    },
    reset() {
      const r = rest();
      for (const b of [posA, posB, prev]) device.queue.writeBuffer(b, 0, r);
      device.queue.writeBuffer(held, 0, new Float32Array(N * 4));
    },
    htmlTexture: () => htmlTex,
    resize(w, h) {
      if (Math.abs(w - W) < 1 && Math.abs(h - H) < 1) return;
      W = w;
      H = h;
      build();
    },
    lastTouch: () => touched,
    stop() {
      stopped = true;
      for (const b of [posA, posB, prev, held, ubuf]) b.destroy();
      for (const t of [htmlTex, shadowTex, depthTex]) t.destroy();
    },
  };

  let grab = { x: 0, y: 0, state: 0 };
  let touched = 0;
  let stopped = false;
  const t0 = performance.now();
  const SUB = 2;
  const ITER = 16;

  const frame = () => {
    if (stopped) return;
    requestAnimationFrame(frame);
    const now = performance.now();
    const dt = 1 / 60 / SUB;
    const recall = grab.state ? 0 : Math.min(1, Math.max(0, (now - touched - 300) / 900));
    const modeI = MODES.indexOf(api.mode);
    U.set([NX, NY, W / (NX - 1), H / (NY - 1)], 0);
    U.set([dt, modeI === 0 ? 900 : 1500, modeI === 0 ? 0.975 : 0.992, modeI], 4);
    U.set([(now - t0) / 1000, api.wind, 46, 520], 12);
    U.set([W, H, opts.margin, 1600], 16);
    U.set([W + opts.margin * 2, H + opts.margin * 2, recall, FABRICS.indexOf(api.fabric)], 20);
    U[11] = Math.max(70, Math.min(W, H) * 0.14);
    const enc = device.createCommandEncoder();
    const groups = Math.ceil(N / 64);
    for (let s = 0; s < SUB; s++) {
      U.set([grab.x, grab.y, grab.state], 8);
      // Chaque sous-pas a ses données : on les pose dans le tampon avant chaque passe (copie dans l'encodeur).
      device.queue.writeBuffer(ubuf, 0, U);
      if (grab.state === 2) grab.state = 1;
      const enc2 = device.createCommandEncoder();
      const cp = enc2.beginComputePass();
      cp.setPipeline(integratePipe);
      cp.setBindGroup(0, simBind);
      cp.dispatchWorkgroups(groups);
      cp.setPipeline(relaxPipe);
      for (let it = 0; it < ITER; it++) {
        cp.setBindGroup(0, it % 2 === 0 ? relaxAB : relaxBA);
        cp.dispatchWorkgroups(groups);
      }
      cp.end();
      device.queue.submit([enc2.finish()]);
    }
    const sh = enc.beginRenderPass({ colorAttachments: [{ view: shadowTex.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    sh.setPipeline(shadowPipe);
    sh.setBindGroup(0, shadowBind);
    sh.draw((NX - 1) * (NY - 1) * 6);
    sh.end();
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }],
      depthStencilAttachment: { view: depthTex.createView(), depthLoadOp: "clear", depthStoreOp: "discard", depthClearValue: 1 },
    });
    pass.setPipeline(quadPipe);
    pass.setBindGroup(0, quadBind);
    pass.draw(3);
    pass.setPipeline(clothPipe);
    pass.setBindGroup(0, clothBind);
    pass.draw((NX - 1) * (NY - 1) * 6);
    pass.end();
    device.queue.submit([enc.finish()]);
  };
  requestAnimationFrame(frame);
  return api;
}
