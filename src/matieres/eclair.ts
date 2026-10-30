/**
 * Lettres en éclair, v2. Des éclairs générés, pas un contour qui tremble :
 *
 *  - un coup de foudre = un chemin brisé par déplacement du point milieu
 *    (sept niveaux, amplitude divisée par ~1,8 à chaque niveau) et des
 *    branches qui en partent (angle 20–45°, plus fines, plus faibles), avec la
 *    vraie cadence : l'arc principal puis deux ou trois « arcs en retour » dans
 *    le même canal à quelques dizaines de ms, chacun une décroissance
 *    exponentielle (τ ≈ 45 ms) ;
 *  - quatre familles : la foudre qui tombe du haut sur le sommet des lettres,
 *    les arcs qui sautent d'une lettre à l'autre (bombés vers l'extérieur, le
 *    long des normales du champ de distance), les petits arcs qui rampent sur
 *    le contour, et ceux qui sautent vers le pointeur (un clic : la foudre y
 *    tombe) ;
 *  - rendu : chaque segment est une capsule (cœur gaussien blanc, gaine
 *    bleue, halo), écrite en mélange « max » (pas de perles aux jointures)
 *    dans une cible HDR, puis bloom ; la passe finale éclaire les lettres —
 *    un biseau tiré du champ de distance (lu avec interpolation bilinéaire :
 *    plus d'escalier) — avec la lumière du bloom et l'éclair global.
 */
import { createBloom, HDR_FORMAT, TONEMAP } from "./hdr.ts";

type Pointer = { x: number; y: number; in: number };
export type WordInfo = { W: number; H: number; GW: number; GH: number; mask: Float32Array; sd: Float32Array };

const MAX_SEGS = 6000;
const FLOATS = 8;

type Strike = {
  segs: number[];
  t0: number;
  strokes: { at: number; amp: number }[];
  tau: number;
  life: number;
  flash: number;
  cx: number;
  cy: number;
  flicker: boolean;
};

const SEG_WGSL = /* wgsl */ `
struct U { res: vec4f };   // largeur, hauteur (px css), 0, temps
@group(0) @binding(0) var<uniform> u: U;
struct Seg { a: vec4f, b: vec4f };   // x0, y0, x1, y1 ; largeur du cœur, intensité, rayon du halo, teinte (0 bleu, 1 violet)
@group(0) @binding(1) var<storage, read> segs: array<Seg>;
struct VO { @builtin(position) clip: vec4f, @location(0) px: vec2f, @location(1) @interpolate(flat) id: u32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let s = segs[ii];
  let a = s.a.xy;
  let b = s.a.zw;
  let R = s.b.z;
  let d = b - a;
  let L = max(length(d), 1e-3);
  let t = d / L;
  let n = vec2f(-t.y, t.x);
  let corner = array<vec2f, 6>(vec2f(0.0, -1.0), vec2f(1.0, -1.0), vec2f(0.0, 1.0), vec2f(0.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  let c = corner[vi];
  let p = mix(a - t * R, b + t * R, c.x) + n * R * c.y;
  var o: VO;
  o.clip = vec4f(p / u.res.xy * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0), 0.0, 1.0);
  o.px = p;
  o.id = ii;
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let s = segs[i.id];
  let a = s.a.xy;
  let b = s.a.zw;
  let ab = b - a;
  let h = clamp(dot(i.px - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  let d = length(i.px - a - ab * h);
  let w = s.b.x;
  let I = s.b.y;
  let R = s.b.z;
  let core = exp(-(d * d) / (w * w));
  let sheath = exp(-d / (w * 2.2));
  let halo = exp(-d / (R * 0.3)) * (1.0 - smoothstep(R * 0.6, R, d));
  let tint = mix(vec3f(0.45, 0.62, 1.0), vec3f(0.72, 0.5, 1.0), s.b.w);
  let col = I * (vec3f(1.0, 0.98, 1.0) * core * 9.0 + tint * sheath * 2.2 + tint * halo * 0.35);
  return vec4f(col, 1.0);
}
`;

const FINAL_WGSL = /* wgsl */ `
${TONEMAP}
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return VO(vec4f(p * 2.0 - 1.0, 0.0, 1.0), vec2f(p.x, 1.0 - p.y));
}
struct U {
  res: vec4f,     // largeur, hauteur (px css), px css par cellule de la grille, temps
  flash: vec4f,   // intensité de l'éclair global, x, y (px css) du coup, 0
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var scene: texture_2d<f32>;
@group(0) @binding(2) var bloom: texture_2d<f32>;
@group(0) @binding(3) var sdfT: texture_2d<f32>;
@group(0) @binding(4) var samp: sampler;
fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), w.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), w.x), w.y);
}
fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var a = 0.5;
  var s = 0.0;
  for (var k = 0; k < 4; k++) { s += a * vnoise(p); p = p * 2.03 + vec2f(17.3, 9.1); a *= 0.5; }
  return s;
}
/** Champ de distance (px css, négatif dedans), lu en bilinéaire à la main (r32float ne se filtre pas). */
fn sdf(px: vec2f) -> f32 {
  let ts = vec2i(textureDimensions(sdfT));
  let g = px / u.res.z - 0.5;
  let i = vec2i(floor(g));
  let f = g - floor(g);
  let l = vec2i(0);
  let hi = ts - 1;
  let a = textureLoad(sdfT, clamp(i, l, hi), 0).r;
  let b = textureLoad(sdfT, clamp(i + vec2i(1, 0), l, hi), 0).r;
  let c = textureLoad(sdfT, clamp(i + vec2i(0, 1), l, hi), 0).r;
  let d = textureLoad(sdfT, clamp(i + vec2i(1, 1), l, hi), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * u.res.z;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let px = i.uv * u.res.xy;
  let t = u.res.w;
  let F = u.flash.x;
  // Le ciel : un bleu de nuit, des nuées que l'éclair découvre.
  let cloud = fbm(px * 0.006 + vec2f(t * 0.02, 0.0));
  var col = mix(vec3f(0.006, 0.008, 0.02), vec3f(0.018, 0.022, 0.05), i.uv.y);
  col += vec3f(0.25, 0.32, 0.6) * cloud * cloud * F * 0.35 + vec3f(0.012, 0.015, 0.03) * F;
  // Les lettres : du métal sombre en biseau (normale tirée du champ de distance), éclairé par les arcs.
  let sd = sdf(px);
  let e = 1.0;
  let g = vec2f(sdf(px + vec2f(e, 0.0)) - sdf(px - vec2f(e, 0.0)), sdf(px + vec2f(0.0, e)) - sdf(px - vec2f(0.0, e))) / (2.0 * e);
  let bevelW = 7.0;
  let slope = (1.0 - smoothstep(0.0, bevelW, -sd)) * 1.6;
  let n = normalize(vec3f(g * slope, 1.0));
  let light = textureSampleLevel(bloom, samp, i.uv, 0.0).rgb;
  // Direction de l'éclair global : du pixel vers le coup, un peu en hauteur.
  let toF = normalize(vec3f(u.flash.yz - px, 220.0));
  let albedo = vec3f(0.07, 0.08, 0.12) * (0.9 + 0.2 * vnoise(px * vec2f(0.012, 0.08)));
  var letter = albedo * (0.35 + light * 2.4 * (0.55 + 0.45 * n.z) + vec3f(0.6, 0.7, 1.0) * F * 1.6 * max(dot(n, toF), 0.0));
  // Un liseré froid sur l'arête du biseau, toujours là : le mot se lit dans le noir.
  letter += vec3f(0.05, 0.07, 0.14) * (1.0 - n.z) * 0.9;
  // Reflet du biseau : l'arête renvoie la lumière des arcs.
  let spec = pow(max(dot(reflect(-toF, n), vec3f(0.0, 0.0, 1.0)), 0.0), 24.0);
  letter += (light * 0.6 + vec3f(0.7, 0.8, 1.0) * F) * spec * (1.0 - n.z) * 6.0;
  // Chargées : une lueur bleue très faible qui court sous la surface.
  letter += vec3f(0.05, 0.08, 0.2) * smoothstep(0.55, 0.9, fbm(px * 0.02 + vec2f(0.0, t * 0.6))) * 0.5;
  let inside = 1.0 - smoothstep(-0.75, 0.75, sd);
  col = mix(col, letter, inside);
  // Les arcs, puis leur halo.
  col += textureSampleLevel(scene, samp, i.uv, 0.0).rgb + light * 0.32;
  return vec4f(display(col, i.p.xy), 1.0);
}
`;

export async function createEclair(device: GPUDevice, format: GPUTextureFormat, pointer: Pointer, canvas: HTMLCanvasElement) {
  const bloom = await createBloom(device);
  const segMod = device.createShaderModule({ code: SEG_WGSL });
  const finMod = device.createShaderModule({ code: FINAL_WGSL });
  for (const m of [segMod, finMod]) {
    const errs = (await m.getCompilationInfo()).messages.filter((x) => x.type === "error");
    if (errs.length) throw new Error(`éclair : ${errs.map((e) => `${e.lineNum}:${e.message}`).join("\n")}`);
  }
  const segPipe = await device.createRenderPipelineAsync({
    layout: "auto",
    vertex: { module: segMod, entryPoint: "vs" },
    fragment: { module: segMod, entryPoint: "fs", targets: [{ format: HDR_FORMAT, blend: { color: { operation: "max", srcFactor: "one", dstFactor: "one" }, alpha: { operation: "max", srcFactor: "one", dstFactor: "one" } } }] },
    primitive: { topology: "triangle-list" },
  });
  const finPipe = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: finMod, entryPoint: "vs" }, fragment: { module: finMod, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
  const segU = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const finU = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const segBuf = device.createBuffer({ size: MAX_SEGS * FLOATS * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const segData = new Float32Array(MAX_SEGS * FLOATS);
  const segBind = device.createBindGroup({ layout: segPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: segU } }, { binding: 1, resource: { buffer: segBuf } }] });
  let sdfTex: GPUTexture | null = null;
  let finBind: GPUBindGroup | null = null;
  let info: WordInfo | null = null;

  /* ───── Le contour : points du bord et leur normale sortante ───── */
  let edge: Float32Array = new Float32Array(0); // x, y, nx, ny (px css)
  let tops: number[] = []; // indices des points du bord tournés vers le haut
  const rand = Math.random;

  const rebuildWord = (w: WordInfo) => {
    info = w;
    const { GW, GH, mask, sd } = w;
    const s = w.W / GW;
    const pts: number[] = [];
    tops = [];
    for (let y = 1; y < GH - 1; y++)
      for (let x = 1; x < GW - 1; x++) {
        const i = y * GW + x;
        if (mask[i]! < 0.5) continue;
        if (mask[i - 1]! >= 0.5 && mask[i + 1]! >= 0.5 && mask[i - GW]! >= 0.5 && mask[i + GW]! >= 0.5) continue;
        let nx = sd[i + 1]! - sd[i - 1]!;
        let ny = sd[i + GW]! - sd[i - GW]!;
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        if (ny < -0.7) tops.push(pts.length / 4);
        pts.push((x + 0.5) * s, (y + 0.5) * s, nx, ny);
      }
    edge = new Float32Array(pts);
    sdfTex?.destroy();
    sdfTex = device.createTexture({ size: [GW, GH], format: "r32float", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture: sdfTex }, sd, { bytesPerRow: GW * 4 }, [GW, GH]);
    finBind = null;
    strikes.length = 0;
  };
  const nEdge = () => edge.length / 4;
  const ep = (k: number) => [edge[k * 4]!, edge[k * 4 + 1]!, edge[k * 4 + 2]!, edge[k * 4 + 3]!] as const;

  /* ───── Un éclair : déplacement du point milieu, branches ───── */
  const path = (x0: number, y0: number, x1: number, y1: number, depth: number, disp: number, bow = [0, 0]) => {
    let p = [x0, y0, x1, y1];
    const len0 = Math.hypot(x1 - x0, y1 - y0);
    // Premier milieu courbé (arc bombé hors des lettres).
    const mx = (x0 + x1) / 2 + bow[0]! * len0;
    const my = (y0 + y1) / 2 + bow[1]! * len0;
    p = [x0, y0, mx, my, x1, y1];
    let amp = disp;
    for (let lv = 0; lv < depth; lv++) {
      const q: number[] = [p[0]!, p[1]!];
      for (let k = 0; k + 3 < p.length; k += 2) {
        const ax = p[k]!;
        const ay = p[k + 1]!;
        const bx = p[k + 2]!;
        const by = p[k + 3]!;
        const L = Math.hypot(bx - ax, by - ay);
        const o = (rand() - 0.5) * 2 * amp * L;
        q.push((ax + bx) / 2 + (-(by - ay) / (L || 1)) * o, (ay + by) / 2 + ((bx - ax) / (L || 1)) * o, bx, by);
      }
      p = q;
      amp *= 0.56;
    }
    return p;
  };
  const emit = (out: number[], p: number[], w: number, I: number, R: number, tint: number) => {
    for (let k = 0; k + 3 < p.length; k += 2) {
      // L'intensité baisse un peu vers la pointe (la charge s'épuise).
      const f = 1 - 0.35 * (k / p.length);
      out.push(p[k]!, p[k + 1]!, p[k + 2]!, p[k + 3]!, w, I * f, R, tint);
    }
  };
  const bolt = (out: number[], x0: number, y0: number, x1: number, y1: number, o: { depth: number; disp: number; w: number; I: number; R: number; branch: number; gen?: number; bow?: number[]; tint?: number }) => {
    const p = path(x0, y0, x1, y1, o.depth, o.disp, o.bow);
    emit(out, p, o.w, o.I, o.R, o.tint ?? 0);
    const gen = o.gen ?? 0;
    if (gen >= 2 || o.branch <= 0) return;
    const n = p.length / 2;
    for (let k = 2; k < n - 2; k++) {
      if (rand() > o.branch) continue;
      const ax = p[(k - 1) * 2]!;
      const ay = p[(k - 1) * 2 + 1]!;
      const bx = p[k * 2]!;
      const by = p[k * 2 + 1]!;
      const dx = bx - ax;
      const dy = by - ay;
      const L = Math.hypot(x1 - x0, y1 - y0) * (0.18 + 0.3 * rand()) * (1 - k / n);
      const a = Math.atan2(dy, dx) + (rand() < 0.5 ? -1 : 1) * (0.35 + 0.45 * rand());
      bolt(out, bx, by, bx + Math.cos(a) * L, by + Math.sin(a) * L, { ...o, depth: Math.max(3, o.depth - 2), w: o.w * 0.6, I: o.I * 0.55, R: o.R * 0.6, branch: o.branch * 0.5, gen: gen + 1, bow: [0, 0] });
    }
  };

  /* ───── Les coups ───── */
  const strikes: Strike[] = [];
  const add = (s: Omit<Strike, "t0">, now: number) => strikes.push({ ...s, t0: now });
  const nearestEdge = (x: number, y: number, tries = 220) => {
    let best = -1;
    let bd = Infinity;
    const N = nEdge();
    for (let k = 0; k < tries; k++) {
      const i = Math.floor(rand() * N);
      const d = Math.hypot(edge[i * 4]! - x, edge[i * 4 + 1]! - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  const skyStrike = (now: number, tx?: number, ty?: number) => {
    if (!info || !nEdge()) return;
    let x1: number;
    let y1: number;
    if (tx === undefined || ty === undefined) {
      const k = tops.length ? tops[Math.floor(rand() * tops.length)]! : Math.floor(rand() * nEdge());
      [x1, y1] = ep(k);
    } else {
      x1 = tx;
      y1 = ty;
    }
    const x0 = x1 + (rand() - 0.5) * info.W * 0.5;
    const segs: number[] = [];
    bolt(segs, x0, -20, x1, y1, { depth: 7, disp: 0.2, w: 1.3, I: 1, R: 26, branch: 0.1 });
    const r = rand();
    add({ segs, strokes: [{ at: 0, amp: 1 }, { at: 0.055 + r * 0.04, amp: 0.75 }, { at: 0.15 + r * 0.08, amp: 0.55 }, ...(r > 0.5 ? [{ at: 0.3, amp: 0.35 }] : [])], tau: 0.05, life: 0.6, flash: 1, cx: x1, cy: y1, flicker: false }, now);
  };
  const arcStrike = (now: number) => {
    if (!info || nEdge() < 2) return;
    const a = Math.floor(rand() * nEdge());
    const [x0, y0, nx0, ny0] = ep(a);
    // Un autre point du bord, à bonne distance.
    let b = -1;
    for (let k = 0; k < 40; k++) {
      const c = Math.floor(rand() * nEdge());
      const d = Math.hypot(edge[c * 4]! - x0, edge[c * 4 + 1]! - y0);
      if (d > 70 && d < info.W * 0.45) {
        b = c;
        break;
      }
    }
    if (b < 0) return;
    const [x1, y1, nx1, ny1] = ep(b);
    const bow = [((nx0 + nx1) / 2) * 0.35, ((ny0 + ny1) / 2) * 0.35 - 0.12];
    const segs: number[] = [];
    bolt(segs, x0, y0, x1, y1, { depth: 6, disp: 0.22, w: 0.95, I: 0.85, R: 18, branch: 0.06, bow, tint: 0.4 });
    add({ segs, strokes: [{ at: 0, amp: 1 }, ...(rand() > 0.4 ? [{ at: 0.07, amp: 0.6 }] : [])], tau: 0.045, life: 0.3, flash: 0.35, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, flicker: false }, now);
  };
  const crawl = (now: number) => {
    if (!info || nEdge() < 2) return;
    const a = Math.floor(rand() * nEdge());
    const [x0, y0, nx, ny] = ep(a);
    let b = -1;
    for (let k = 0; k < 30; k++) {
      const c = Math.floor(rand() * nEdge());
      const d = Math.hypot(edge[c * 4]! - x0, edge[c * 4 + 1]! - y0);
      if (d > 14 && d < 60) {
        b = c;
        break;
      }
    }
    if (b < 0) return;
    const [x1, y1] = ep(b);
    const segs: number[] = [];
    bolt(segs, x0, y0, x1, y1, { depth: 4, disp: 0.3, w: 0.6, I: 0.55, R: 9, branch: 0, bow: [nx * 0.25, ny * 0.25] });
    add({ segs, strokes: [{ at: 0, amp: 1 }], tau: 0.08, life: 0.06 + rand() * 0.1, flash: 0, cx: x0, cy: y0, flicker: true }, now);
  };
  let pointerAt = 0;
  const toPointer = (now: number) => {
    if (!info || !nEdge()) return;
    for (let j = 0; j < 3; j++) {
      const k = nearestEdge(pointer.x + (rand() - 0.5) * 80, pointer.y + (rand() - 0.5) * 80);
      if (k < 0) continue;
      const [x0, y0] = ep(k);
      if (Math.hypot(x0 - pointer.x, y0 - pointer.y) > 260) continue;
      const segs: number[] = [];
      bolt(segs, x0, y0, pointer.x + (rand() - 0.5) * 6, pointer.y + (rand() - 0.5) * 6, { depth: 5, disp: 0.24, w: 0.8, I: 0.8, R: 14, branch: 0.08, tint: 0.6 });
      add({ segs, strokes: [{ at: 0, amp: 1 }], tau: 0.06, life: 0.09, flash: 0.15, cx: pointer.x, cy: pointer.y, flicker: true }, now);
    }
  };
  canvas.addEventListener("pointerdown", (e) => {
    const b = canvas.getBoundingClientRect();
    skyStrike(performance.now() / 1000, e.clientX - b.left, e.clientY - b.top);
  });

  let nextSky = 0.6;
  let nextArc = 0.2;
  let nextCrawl = 0;
  let last = 0;

  return {
    rebuild: rebuildWord,
    draw(enc: GPUCommandEncoder, view: GPUTextureView, t: number, pw: number, ph: number) {
      if (!info || !sdfTex) return;
      const now = performance.now() / 1000;
      const dt = last ? Math.min(0.1, now - last) : 1 / 60;
      last = now;
      // L'horaire : la foudre toutes les 0,7–2,4 s, un arc toutes les 0,25–0,8 s, des arcs rampants en continu.
      if ((nextSky -= dt) < 0) {
        skyStrike(now);
        nextSky = 0.7 + rand() * 1.7;
      }
      if ((nextArc -= dt) < 0) {
        arcStrike(now);
        nextArc = 0.25 + rand() * 0.55;
      }
      if ((nextCrawl -= dt) < 0) {
        for (let k = 0; k < 3; k++) crawl(now);
        nextCrawl = 0.03 + rand() * 0.05;
      }
      if (pointer.in && now - pointerAt > 0.07) {
        pointerAt = now;
        toPointer(now);
      }
      // Enveloppes, éclair global, segments de l'image.
      let n = 0;
      let F = 0;
      let fx = info.W / 2;
      let fy = 0;
      let best = 0;
      for (let k = strikes.length - 1; k >= 0; k--) {
        const s = strikes[k]!;
        const age = now - s.t0;
        if (age > s.life) {
          strikes.splice(k, 1);
          continue;
        }
        let env = 0;
        for (const st of s.strokes) if (age >= st.at) env += st.amp * Math.exp(-(age - st.at) / s.tau);
        if (s.flicker) env *= 0.5 + 0.5 * (rand() > 0.3 ? 1 : 0.2);
        env = Math.min(env, 1.6);
        const contrib = env * s.flash;
        F += contrib;
        if (contrib > best) {
          best = contrib;
          fx = s.cx;
          fy = s.cy;
        }
        for (let j = 0; j + FLOATS <= s.segs.length && n < MAX_SEGS; j += FLOATS, n++) {
          const o = n * FLOATS;
          for (let q = 0; q < FLOATS; q++) segData[o + q] = s.segs[j + q]!;
          segData[o + 5]! *= env;
        }
      }
      if (n) device.queue.writeBuffer(segBuf, 0, segData, 0, n * FLOATS);
      if (bloom.resize(pw, ph) || !finBind)
        finBind = device.createBindGroup({
          layout: finPipe.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: finU } },
            { binding: 1, resource: bloom.scene.createView() },
            { binding: 2, resource: bloom.bloom.createView() },
            { binding: 3, resource: sdfTex.createView() },
            { binding: 4, resource: bloom.samp },
          ],
        });
      device.queue.writeBuffer(segU, 0, new Float32Array([info.W, info.H, 0, t]));
      device.queue.writeBuffer(finU, 0, new Float32Array([info.W, info.H, info.W / info.GW, t, Math.min(F, 1.5), fx, fy, 0]));
      const p1 = enc.beginRenderPass({ colorAttachments: [{ view: bloom.scene.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      if (n) {
        p1.setPipeline(segPipe);
        p1.setBindGroup(0, segBind);
        p1.draw(6, n);
      }
      p1.end();
      bloom.run(enc);
      const p2 = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      p2.setPipeline(finPipe);
      p2.setBindGroup(0, finBind);
      p2.draw(3);
      p2.end();
      device.queue.submit([enc.finish()]);
    },
  };
}
