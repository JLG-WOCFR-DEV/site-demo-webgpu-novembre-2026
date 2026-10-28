/**
 * Lettres en eau, en éclair, en feu. Trois fois la même idée : le mot est
 * dessiné dans un canvas, on en lit les pixels, et le GPU en fait une matière.
 *   eau     une surface d'eau au-dessus du mot : un champ de hauteur, l'équation
 *           des ondes en ping-pong (deux textures qui s'échangent), le pointeur
 *           y laisse tomber des gouttes ; le mot est vu à travers, dévié par la
 *           pente de l'eau, avec les reflets et les caustiques ;
 *   éclair  le contour des lettres (un champ de distance calculé une fois)
 *           parcouru d'arcs électriques : le contour déformé par un bruit
 *           fractal qui saute douze fois par seconde, un cœur blanc, un halo ;
 *   feu     des flammes qui partent du haut des lettres : un ruban par point
 *           du bord supérieur, dessiné en instances, qui ondule au bruit et
 *           s'éteint en montant ; les lettres rougeoient comme des braises.
 *
 * D'après les « trois lettres » de しゅん / LIG (three.js, kanji 水 雷 炎) ;
 * refait en WebGPU, aucun code repris.
 */
import { renderScale } from "../gpu/governor.ts";
import { getDevice } from "../components/device.ts";

type Kind = "eau" | "eclair" | "feu";

/** Le mot, en masque (1 dans les lettres), à la taille donnée. */
function wordMask(word: string, w: number, h: number) {
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = h * 0.62;
  g.font = `900 ${size}px "Archivo Variable", Archivo, sans-serif`;
  const tw = g.measureText(word).width;
  if (tw > w * 0.86) size *= (w * 0.86) / tw;
  g.font = `900 ${size}px "Archivo Variable", Archivo, sans-serif`;
  g.fillText(word, w / 2, h * 0.54);
  const px = g.getImageData(0, 0, w, h).data;
  const m = new Float32Array(w * h);
  for (let i = 0; i < m.length; i++) m[i] = px[i * 4]! / 255;
  return { mask: m, canvas: c };
}

/** Distance signée au bord des lettres (px, négative dedans) : transformée exacte de Felzenszwalb, deux fois. */
function signedDistance(mask: Float32Array, w: number, h: number) {
  const INF = 1e10;
  const edt = (inside: boolean) => {
    const f = new Float64Array(w * h);
    for (let i = 0; i < f.length; i++) f[i] = (mask[i]! > 0.5) === inside ? 0 : INF;
    const n = Math.max(w, h);
    const d = new Float64Array(n);
    const v = new Int32Array(n);
    const z = new Float64Array(n + 1);
    const pass = (get: (i: number) => number, set: (i: number, x: number) => void, len: number) => {
      let k = 0;
      v[0] = 0;
      z[0] = -INF;
      z[1] = INF;
      for (let q = 1; q < len; q++) {
        let s = (get(q) + q * q - (get(v[k]!) + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
        while (s <= z[k]!) {
          k--;
          s = (get(q) + q * q - (get(v[k]!) + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) {
        while (z[k + 1]! < q) k++;
        d[q] = (q - v[k]!) * (q - v[k]!) + get(v[k]!);
      }
      for (let q = 0; q < len; q++) set(q, d[q]!);
    };
    for (let x = 0; x < w; x++) pass((i) => f[i * w + x]!, (i, val) => (f[i * w + x] = val), h);
    for (let y = 0; y < h; y++) pass((i) => f[y * w + i]!, (i, val) => (f[y * w + i] = val), w);
    return f;
  };
  const out = edt(true); // distance aux lettres (pour les pixels dehors)
  const inn = edt(false); // distance au dehors (pour les pixels dedans)
  const s = new Float32Array(w * h);
  for (let i = 0; i < s.length; i++) s[i] = Math.sqrt(out[i]!) - Math.sqrt(inn[i]!);
  return s;
}

const VS_FULL = /* wgsl */ `
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return VO(vec4f(p * 2.0 - 1.0, 0.0, 1.0), vec2f(p.x, 1.0 - p.y));
}
`;
const NOISE = /* wgsl */ `
fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), u.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var a = 0.5;
  var s = 0.0;
  for (var k = 0; k < 5; k++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2f(17.3, 9.1);
    a *= 0.5;
  }
  return s;
}
`;

/* ───── Eau ───── */

const WATER_SIM = /* wgsl */ `
struct S { size: vec4f, drop: vec4f };   // largeur, hauteur de la grille, amortissement, 0 ; goutte : x, y (cellules), rayon, force
@group(0) @binding(0) var<uniform> s: S;
@group(0) @binding(1) var src: texture_2d<f32>;        // r : hauteur, g : hauteur précédente
@group(0) @binding(2) var dst: texture_storage_2d<rgba16float, write>;
fn at(p: vec2i) -> vec2f {
  let q = clamp(p, vec2i(0), vec2i(s.size.xy) - 1);
  return textureLoad(src, q, 0).rg;
}
@compute @workgroup_size(8, 8)
fn wave(@builtin(global_invocation_id) id: vec3u) {
  let p = vec2i(id.xy);
  if (p.x >= i32(s.size.x) || p.y >= i32(s.size.y)) { return; }
  let c = at(p);
  let lap = at(p + vec2i(1, 0)).r + at(p - vec2i(1, 0)).r + at(p + vec2i(0, 1)).r + at(p - vec2i(0, 1)).r - 4.0 * c.r;
  // Équation des ondes (vitesse² = 0,5 cellule² par pas), amortie.
  var h = (2.0 * c.r - c.g + 0.5 * lap) * s.size.z;
  let d = vec2f(p) - s.drop.xy;
  h += s.drop.w * exp(-dot(d, d) / max(1.0, s.drop.z * s.drop.z));
  textureStore(dst, p, vec4f(h, c.r, 0.0, 1.0));
}
`;
const WATER_DRAW = /* wgsl */ `
${VS_FULL}
struct D { res: vec4f, deep: vec4f, ink: vec4f, light: vec4f };
@group(0) @binding(0) var<uniform> d: D;
@group(0) @binding(1) var hT: texture_2d<f32>;
@group(0) @binding(2) var word: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let ts = vec2f(textureDimensions(hT));
  let e = 1.0 / ts;
  let h = textureSampleLevel(hT, samp, i.uv, 0.0).r;
  let hx = textureSampleLevel(hT, samp, i.uv + vec2f(e.x, 0.0), 0.0).r - textureSampleLevel(hT, samp, i.uv - vec2f(e.x, 0.0), 0.0).r;
  let hy = textureSampleLevel(hT, samp, i.uv + vec2f(0.0, e.y), 0.0).r - textureSampleLevel(hT, samp, i.uv - vec2f(0.0, e.y), 0.0).r;
  let n = normalize(vec3f(-hx * 6.0, -hy * 6.0, 1.0));
  // Le mot vu à travers l'eau : dévié par la pente.
  let uv = i.uv + n.xy * 0.018;
  let w = textureSampleLevel(word, samp, uv, 0.0).r;
  var col = mix(d.deep.rgb, d.ink.rgb, w);
  // Caustiques : la lumière se concentre là où la surface est creuse (courbure).
  let lap = (textureSampleLevel(hT, samp, i.uv + vec2f(e.x, 0.0), 0.0).r + textureSampleLevel(hT, samp, i.uv - vec2f(e.x, 0.0), 0.0).r + textureSampleLevel(hT, samp, i.uv + vec2f(0.0, e.y), 0.0).r + textureSampleLevel(hT, samp, i.uv - vec2f(0.0, e.y), 0.0).r - 4.0 * h);
  col += d.light.rgb * clamp(-lap * 9.0, 0.0, 0.6);
  // Reflet d'une fenêtre en haut à gauche.
  let L = normalize(vec3f(-0.4, -0.6, 0.7));
  let spec = pow(max(dot(reflect(-L, n), vec3f(0.0, 0.0, 1.0)), 0.0), 120.0);
  col += vec3f(spec * 0.9);
  // Un rien de profondeur : l'eau assombrit les bords.
  let q = i.uv - 0.5;
  col *= 1.0 - dot(q, q) * 0.5;
  return vec4f(col, 1.0);
}
`;

/* ───── Éclair ───── */

const BOLT = /* wgsl */ `
${VS_FULL}
${NOISE}
struct D { res: vec4f, glow: vec4f, ptr: vec4f };   // largeur, hauteur (px), dpr, temps ; couleur du halo ; pointeur (uv), présent
@group(0) @binding(0) var<uniform> d: D;
@group(0) @binding(1) var sdfT: texture_2d<f32>;   // r32float : lu sans filtre
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let t = d.res.w;
  // Le temps saute douze fois par seconde : l'éclair crépite, il ne coule pas.
  let tq = floor(t * 12.0);
  let ts = vec2f(textureDimensions(sdfT));
  let sd = textureLoad(sdfT, clamp(vec2i(i.uv * ts), vec2i(0), vec2i(ts) - 1), 0).r;     // px de la grille du masque
  let p = i.uv * ts;
  var e = 0.0;
  // Trois brins autour du contour, chacun son bruit, sa largeur.
  for (var k = 0; k < 3; k++) {
    let fk = f32(k);
    let amp = 5.0 + 4.0 * fk;
    let jag = (fbm(p * (0.045 + 0.02 * fk) + vec2f(tq * 0.37 + fk * 11.0, tq * 0.21)) - 0.5) * 2.0 * amp;
    let w = 0.55 + 0.25 * fk;
    let x = abs(sd + jag);
    // Le brin s'allume et s'éteint par morceaux.
    let on = step(0.35, vnoise(p * 0.02 + vec2f(tq * 0.9 + fk * 5.0, fk)));
    e += on * (exp(-x / w) + 0.25 * exp(-x / (w * 8.0)));
  }
  // Près du pointeur, le courant saute vers lui.
  let toP = length((i.uv - d.ptr.xy) * ts);
  e += d.ptr.z * exp(-abs(sd) / 6.0) * exp(-toP / 40.0) * 2.0;
  // Les lettres elles-mêmes : un violet sombre, chargé.
  var col = vec3f(0.02, 0.02, 0.05);
  col += select(vec3f(0.0), vec3f(0.06, 0.04, 0.16) * (0.6 + 0.4 * vnoise(p * 0.05 + tq)), sd < 0.0);
  col += d.glow.rgb * e * 0.7 + vec3f(1.0) * pow(min(e, 1.4), 3.0) * 0.6;
  return vec4f(col, 1.0);
}
`;

/* ───── Feu ───── */

const FIRE = /* wgsl */ `
${NOISE}
struct D { res: vec4f, ptr: vec4f };   // largeur, hauteur (px css), dpr, temps ; pointeur x, y, présent
@group(0) @binding(0) var<uniform> d: D;
@group(0) @binding(1) var<storage, read> roots: array<vec4f>;   // x, y (px css), hauteur, graine
const SEG = 14u;
struct VO { @builtin(position) clip: vec4f, @location(0) a: f32, @location(1) side: f32, @location(2) heat: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let r = roots[ii];
  let s = f32(vi / 2u) / f32(SEG);     // 0 en bas, 1 à la pointe
  let side = f32(vi & 1u) * 2.0 - 1.0;
  let t = d.res.w;
  // La flamme monte et ondule ; sa hauteur respire.
  let L = r.z * (0.75 + 0.5 * vnoise(vec2f(t * 1.7 + r.w * 13.0, r.w)));
  let sway = (vnoise(vec2f(r.w * 7.0, s * 2.0 - t * 3.0)) - 0.5) * 2.0;
  var x = r.x + sway * 14.0 * pow(s, 1.3);
  // Le pointeur souffle sur les flammes.
  let dp = vec2f(r.x, r.y) - d.ptr.xy;
  x += d.ptr.z * sign(dp.x) * 26.0 * pow(s, 1.5) * exp(-length(dp) / 120.0);
  let y = r.y - s * L;
  let w = (1.0 - s) * (1.0 - s) * 6.0 + 0.6;
  var o: VO;
  let px = vec2f(x + side * w, y);
  o.clip = vec4f(px / d.res.xy * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0), 0.5, 1.0);
  o.a = s;
  o.side = side;
  o.heat = 0.7 + 0.3 * vnoise(vec2f(r.w * 3.0, t * 5.0));
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  // Du blanc-jaune à la base au rouge à la pointe, qui s'éteint ; plus chaud au cœur du ruban.
  let core = 1.0 - abs(i.side);
  let c0 = vec3f(1.0, 0.95, 0.75);
  let c1 = vec3f(1.0, 0.55, 0.12);
  let c2 = vec3f(0.75, 0.12, 0.04);
  var col = mix(c0, c1, smoothstep(0.0, 0.35, i.a));
  col = mix(col, c2, smoothstep(0.35, 0.8, i.a));
  let a = (1.0 - smoothstep(0.55, 1.0, i.a)) * (0.35 + 0.65 * core) * i.heat * 0.22;
  return vec4f(col * a, a * 0.4);
}
`;
const EMBER = /* wgsl */ `
${VS_FULL}
${NOISE}
struct D { res: vec4f };
@group(0) @binding(0) var<uniform> d: D;
@group(0) @binding(1) var word: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let m = textureSampleLevel(word, samp, i.uv, 0.0).r;
  let t = d.res.w;
  let p = i.uv * d.res.xy;
  // Braise : des fissures qui brûlent, une lueur qui bouge lentement.
  let n = fbm(p * 0.03 + vec2f(0.0, -t * 0.4));
  let crack = smoothstep(0.55, 0.75, fbm(p * 0.08 + vec2f(t * 0.1, 0.0)));
  var col = vec3f(0.18, 0.03, 0.01) + vec3f(1.0, 0.35, 0.05) * crack * (0.5 + 0.8 * n) + vec3f(0.5, 0.08, 0.0) * n * 0.6;
  col *= m;
  // Le halo chaud autour des lettres.
  let halo = textureSampleLevel(word, samp, i.uv, 4.0).r;
  col += vec3f(0.35, 0.07, 0.01) * halo * (1.0 - m) * 0.8;
  return vec4f(col, 1.0);
}
`;

export async function mountElement(root: HTMLElement, kind: Kind, word: string) {
  const canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const device = await getDevice();
  const ctx = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "opaque" });
  const compile = async (code: string) => {
    const m = device.createShaderModule({ code });
    const errs = (await m.getCompilationInfo()).messages.filter((x) => x.type === "error");
    if (errs.length) throw new Error(`${kind} : ${errs.map((e) => `${e.lineNum}:${e.message}`).join("\n")}`);
    return m;
  };
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  await document.fonts.ready;

  const pointer = { x: 0, y: 0, in: 0, px: 0, py: 0, moved: 0 };
  canvas.addEventListener("pointermove", (e) => {
    const b = canvas.getBoundingClientRect();
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.x = e.clientX - b.left;
    pointer.y = e.clientY - b.top;
    pointer.in = 1;
    pointer.moved = performance.now();
  });
  canvas.addEventListener("pointerleave", () => (pointer.in = 0));

  // La grille du mot (et de l'eau) : un pixel pour 2 px css, au plus 640 de large.
  let W = 0;
  let H = 0;
  let GW = 0;
  let GH = 0;
  let mask: Float32Array = new Float32Array(0);
  let wordTex: GPUTexture | null = null;
  const makeWord = (cw: number, ch: number) => {
    W = cw;
    H = ch;
    const s = Math.min(0.5, 640 / cw);
    GW = Math.max(16, Math.round(cw * s));
    GH = Math.max(16, Math.round(ch * s));
    const wm = wordMask(word, GW, GH);
    mask = wm.mask;
    wordTex?.destroy();
    const levels = Math.floor(Math.log2(Math.max(GW, GH))) + 1;
    wordTex = device.createTexture({ size: [GW, GH], mipLevelCount: levels, format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    device.queue.copyExternalImageToTexture({ source: wm.canvas }, { texture: wordTex }, [GW, GH]);
    let src: OffscreenCanvas = wm.canvas;
    for (let l = 1; l < levels; l++) {
      const w = Math.max(1, GW >> l);
      const h = Math.max(1, GH >> l);
      const c = new OffscreenCanvas(w, h);
      c.getContext("2d")!.drawImage(src, 0, 0, w, h);
      device.queue.copyExternalImageToTexture({ source: c }, { texture: wordTex, mipLevel: l }, [w, h]);
      src = c;
    }
  };

  /* ───── Chaque matière : ses ressources et son dessin ───── */

  let draw: (enc: GPUCommandEncoder, view: GPUTextureView, t: number, dt: number, dpr: number) => void = () => {};
  let rebuild: () => void = () => {};

  if (kind === "eau") {
    const simMod = await compile(WATER_SIM);
    const drawMod = await compile(WATER_DRAW);
    const simPipe = await device.createComputePipelineAsync({ layout: "auto", compute: { module: simMod, entryPoint: "wave" } });
    const drawPipe = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: drawMod, entryPoint: "vs" }, fragment: { module: drawMod, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
    const sU = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const dU = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    let tex: GPUTexture[] = [];
    let simBind: GPUBindGroup[] = [];
    let drawBind: GPUBindGroup[] = [];
    let cur = 0;
    rebuild = () => {
      for (const t of tex) t.destroy();
      tex = [0, 1].map(() => device.createTexture({ size: [GW, GH], format: "rgba16float", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING }));
      simBind = [0, 1].map((k) =>
        device.createBindGroup({
          layout: simPipe.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: sU } },
            { binding: 1, resource: tex[k]!.createView() },
            { binding: 2, resource: tex[1 - k]!.createView() },
          ],
        }),
      );
      drawBind = [0, 1].map((k) =>
        device.createBindGroup({
          layout: drawPipe.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: dU } },
            { binding: 1, resource: tex[k]!.createView() },
            { binding: 2, resource: wordTex!.createView() },
            { binding: 3, resource: samp },
          ],
        }),
      );
      cur = 0;
    };
    let rain = 0;
    draw = (enc, view, t, dt) => {
      // Deux pas de simulation par image ; une goutte sous le pointeur qui bouge, une pluie fine au repos.
      const sx = GW / W;
      for (let k = 0; k < 2; k++) {
        let drop = [0, 0, 1, 0];
        const moving = pointer.in && performance.now() - pointer.moved < 80;
        if (moving && k === 0) drop = [pointer.x * sx, pointer.y * sx, 3, -0.6];
        else if (k === 1 && (rain -= dt) < 0) {
          rain = 0.25 + Math.random() * 0.6;
          drop = [Math.random() * GW, Math.random() * GH, 2, -0.7];
        }
        device.queue.writeBuffer(sU, 0, new Float32Array([GW, GH, 0.985, 0, ...drop]));
        const cp = enc.beginComputePass();
        cp.setPipeline(simPipe);
        cp.setBindGroup(0, simBind[cur]!);
        cp.dispatchWorkgroups(Math.ceil(GW / 8), Math.ceil(GH / 8));
        cp.end();
        cur = 1 - cur;
        // Les écritures d'uniformes s'appliquent avant la soumission : on soumet chaque pas.
        device.queue.submit([enc.finish()]);
        enc = device.createCommandEncoder();
      }
      device.queue.writeBuffer(dU, 0, new Float32Array([W, H, 1, t, 0.04, 0.16, 0.27, 1, 0.93, 0.95, 0.97, 1, 0.55, 0.85, 1, 1]));
      const pass = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      pass.setPipeline(drawPipe);
      pass.setBindGroup(0, drawBind[cur]!);
      pass.draw(3);
      pass.end();
      device.queue.submit([enc.finish()]);
    };
  } else if (kind === "eclair") {
    const mod = await compile(BOLT);
    const pipe = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: mod, entryPoint: "vs" }, fragment: { module: mod, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
    const dU = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    let sdfTex: GPUTexture | null = null;
    let bind: GPUBindGroup | null = null;
    rebuild = () => {
      const sd = signedDistance(mask, GW, GH);
      sdfTex?.destroy();
      sdfTex = device.createTexture({ size: [GW, GH], format: "r32float", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
      device.queue.writeTexture({ texture: sdfTex }, sd, { bytesPerRow: GW * 4 }, [GW, GH]);
      bind = device.createBindGroup({
        layout: pipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: dU } },
          { binding: 1, resource: sdfTex.createView() },
        ],
      });
    };
    draw = (enc, view, t) => {
      device.queue.writeBuffer(dU, 0, new Float32Array([W, H, 1, t, 0.45, 0.6, 1.0, 1, pointer.x / W, pointer.y / H, pointer.in, 0]));
      const pass = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      pass.setPipeline(pipe);
      pass.setBindGroup(0, bind!);
      pass.draw(3);
      pass.end();
      device.queue.submit([enc.finish()]);
    };
  } else {
    const fMod = await compile(FIRE);
    const eMod = await compile(EMBER);
    const add: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } };
    const fPipe = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: fMod, entryPoint: "vs" }, fragment: { module: fMod, entryPoint: "fs", targets: [{ format, blend: add }] }, primitive: { topology: "triangle-strip" } });
    const ePipe = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: eMod, entryPoint: "vs" }, fragment: { module: eMod, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
    const fU = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const eU = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    let rootsBuf: GPUBuffer | null = null;
    let count = 0;
    let fBind: GPUBindGroup | null = null;
    let eBind: GPUBindGroup | null = null;
    rebuild = () => {
      // Les racines des flammes : les pixels du bord supérieur des lettres (dedans, avec du vide au-dessus).
      const pts: number[] = [];
      const s = W / GW;
      for (let y = 2; y < GH; y++)
        for (let x = 0; x < GW; x++) {
          const i = y * GW + x;
          if (mask[i]! > 0.5 && mask[i - 2 * GW]! < 0.5 && Math.random() < 0.55) pts.push(x * s + (Math.random() - 0.5) * s, y * s, 30 + Math.random() * 60, Math.random());
        }
      // Et quelques braises au milieu des lettres, de petites flammes.
      for (let k = 0; k < 400; k++) {
        const x = Math.floor(Math.random() * GW);
        const y = Math.floor(Math.random() * GH);
        if (mask[y * GW + x]! > 0.5) pts.push(x * s, y * s, 10 + Math.random() * 20, Math.random());
      }
      count = pts.length / 4;
      rootsBuf?.destroy();
      rootsBuf = device.createBuffer({ size: Math.max(16, pts.length * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(rootsBuf, 0, new Float32Array(pts));
      fBind = device.createBindGroup({ layout: fPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: fU } }, { binding: 1, resource: { buffer: rootsBuf } }] });
      eBind = device.createBindGroup({ layout: ePipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: eU } }, { binding: 1, resource: wordTex!.createView() }, { binding: 2, resource: samp }] });
    };
    draw = (enc, view, t) => {
      device.queue.writeBuffer(fU, 0, new Float32Array([W, H, 1, t, pointer.x, pointer.y, pointer.in, 0]));
      device.queue.writeBuffer(eU, 0, new Float32Array([W, H, 1, t]));
      const pass = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      pass.setPipeline(ePipe);
      pass.setBindGroup(0, eBind!);
      pass.draw(3);
      pass.setPipeline(fPipe);
      pass.setBindGroup(0, fBind!);
      pass.draw(2 * 15, count);
      pass.end();
      device.queue.submit([enc.finish()]);
    };
  }

  let stopped = false;
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
  io.observe(root);
  const t0 = performance.now();
  let prev = t0;
  const frame = () => {
    if (stopped) return;
    requestAnimationFrame(frame);
    if (!visible) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const b = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2) * renderScale();
    const pw = Math.max(2, Math.round(b.width * dpr));
    const ph = Math.max(2, Math.round(b.height * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    if (Math.abs(b.width - W) > 1 || Math.abs(b.height - H) > 1) {
      makeWord(b.width, b.height);
      rebuild();
    }
    draw(device.createCommandEncoder(), ctx.getCurrentTexture().createView(), (now - t0) / 1000, dt, dpr);
  };
  requestAnimationFrame(frame);
  return {
    stop() {
      stopped = true;
      io.disconnect();
    },
  };
}
