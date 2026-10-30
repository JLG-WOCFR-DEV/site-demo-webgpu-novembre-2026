/**
 * Lettres en eau, en éclair, en feu. Trois fois la même idée : le mot est
 * dessiné dans un canvas, on en lit les pixels, et le GPU en fait une matière.
 *   eau     une surface d'eau au-dessus du mot : un champ de hauteur, l'équation
 *           des ondes en ping-pong (deux textures qui s'échangent), le pointeur
 *           y laisse tomber des gouttes ; le mot est vu à travers, dévié par la
 *           pente de l'eau, avec les reflets et les caustiques ;
 *   éclair  de vrais éclairs générés (point milieu, branches, arcs en retour),
 *           qui tombent sur les lettres, sautent de l'une à l'autre, rampent
 *           sur le contour et vers le pointeur ; HDR et bloom ; lettres en
 *           biseau éclairées par les arcs (eclair.ts) ;
 *   feu     un fluide 2D simulé (flottabilité, vorticité, projection), les
 *           lettres pour combustible ; corps noir, fumée, braises, étincelles,
 *           brume de chaleur ; HDR et bloom (feu.ts).
 *
 * D'après les « trois lettres » de しゅん / LIG (three.js, kanji 水 雷 炎) ;
 * refait en WebGPU, aucun code repris.
 */
import { renderScale } from "../gpu/governor.ts";
import { getDevice } from "../components/device.ts";
import { createEclair } from "./eclair.ts";
import { createFeu } from "./feu.ts";

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
  for (let i = 0; i < s.length; i++) {
    let d = Math.sqrt(out[i]!) - Math.sqrt(inn[i]!);
    // Correction sous-pixel : près du bord, la couverture antialiasée du masque dit où passe vraiment le contour
    // (sans elle, le seuil à 0,5 donne un escalier d'une cellule).
    // Distances mesurées de centre de cellule à centre de cellule : le bord est à mi-chemin (−0,5 en valeur absolue),
    // et dans une cellule à moitié couverte, la couverture donne la distance (0,5 − couverture).
    d -= Math.sign(d) * 0.5;
    const a = mask[i]!;
    if (a > 0.02 && a < 0.98) d = 0.5 - a;
    s[i] = d;
  }
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
    // v2 : éclairs générés, bloom, lettres en biseau éclairées (eclair.ts).
    const ec = await createEclair(device, format, pointer, canvas);
    rebuild = () => ec.rebuild({ W, H, GW, GH, mask, sd: signedDistance(mask, GW, GH) });
    draw = (enc, view, t) => ec.draw(enc, view, t, canvas.width, canvas.height);
  } else {
    // v2 : fluide simulé, corps noir, braises, étincelles, brume de chaleur (feu.ts).
    const fe = await createFeu(device, format, pointer);
    rebuild = () => fe.rebuild({ W, H, GW, GH, mask, wordTex: wordTex! });
    draw = (enc, view, t) => fe.draw(enc, view, t, canvas.width, canvas.height);
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
