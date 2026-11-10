/**
 * Presse — la visionneuse (lightbox), en WebGPU. D'après ramka (Artur Bień, MIT, https://ramka.dev) : la vignette se
 * transforme en grande image et y revient, on glisse vers le bas pour fermer, on pince, double-clique ou Ctrl + molette
 * pour zoomer, on glisse de côté pour passer d'une image à l'autre. Ici, tout est dessiné par la carte graphique :
 *
 * - le fond est l'image elle-même, très floue (un niveau de mipmap lointain), assombrie et vignettée : la visionneuse
 *   prend la couleur de chaque photo, et le fond se fond d'une photo à la suivante ;
 * - la photo a des coins arrondis antialiasés au pixel et une ombre douce, calculées dans le shader (champ de distance) ;
 * - le zoom lit la texture mipmappée : nette à toutes les tailles, sans scintillement au dézoom.
 *
 * Sans WebGPU, la même mécanique pilote des <img> (CSS) : mêmes gestes, mêmes ressorts.
 *
 *   <div data-lightbox>                                     (un groupe : ses images défilent ensemble)
 *     <a href="grande.jpg"><img src="petite.jpg" alt="…" /></a>          (href : l'image en grand ; sinon l'img)
 *     <figure><img src="…" alt="…" /><figcaption>Légende</figcaption></figure>
 *   </div>
 *
 * Clavier : ← → images, Échap ferme, + − 0 zoom, flèches déplacent l'image zoomée. Mouvement réduit : pas de vol.
 */
import { getDevice } from "../components/device.ts";
import { springStep, SPRINGS, type Spring } from "./tokens.ts";

type Item = { trigger: HTMLElement; thumb: HTMLImageElement; src: string; caption: string; alt: string };
type Rect = { x: number; y: number; w: number; h: number };
type Draw = { kind: 0 | 1 | 2; k: number; rect: Rect; alpha: number; radius: number; uv?: [number, number, number, number] };

const OPEN: Spring = SPRINGS.ouverture;
const SNAP: Spring = SPRINGS.vif;
const ZOOM: Spring = { k: 220, zeta: 1 };
const GAP = 40;
const reducedQ = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });
const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const CSS = `
.plb { position: fixed !important; inset: 0; z-index: 1000 !important; touch-action: none; user-select: none; -webkit-user-select: none; }
.plb[hidden] { display: none !important; }
.plb-canvas, .plb-dom { position: absolute; inset: 0; width: 100%; height: 100%; }
.plb-dom { overflow: hidden; pointer-events: none; }
.plb-dom .plb-bd { position: absolute; inset: 0; background: rgba(8, 8, 10, 0.9); }
.plb-dom img { position: absolute; left: 0; top: 0; object-fit: cover; will-change: transform; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45); }
.plb-ui { position: absolute; inset: 0; pointer-events: none; color: #f2efe8; font: 500 13px/1.3 var(--f-mono, ui-monospace, monospace); }
.plb-ui > * { pointer-events: auto; }
.plb-btn { position: absolute; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 99px; background: rgba(20, 20, 22, 0.55); color: inherit; font: 400 22px/1 system-ui, sans-serif; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.plb-btn:hover { background: rgba(40, 40, 44, 0.75); }
.plb-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.plb-btn[disabled] { opacity: 0.25; cursor: default; }
.plb-close { top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); }
.plb-prev, .plb-next { top: 50%; translate: 0 -50%; }
.plb-prev { left: max(12px, env(safe-area-inset-left)); }
.plb-next { right: max(12px, env(safe-area-inset-right)); }
.plb-count { position: absolute; top: max(24px, env(safe-area-inset-top)); left: 50%; translate: -50% 0; margin: 0; letter-spacing: 0.08em; opacity: 0.8; }
.plb-cap { position: absolute; left: 50%; bottom: 92px; translate: -50% 0; margin: 0; max-width: min(70ch, calc(100vw - 32px)); text-align: center; font: 400 15px/1.4 system-ui, sans-serif; text-wrap: balance; }
.plb-thumbs { position: absolute; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); translate: -50% 0; display: flex; gap: 6px; max-width: calc(100vw - 32px); overflow-x: auto; scrollbar-width: none; padding: 4px; }
.plb-thumbs button { flex: none; width: 52px; height: 52px; padding: 0; border: 0; border-radius: 6px; overflow: hidden; background: #222; opacity: 0.45; cursor: pointer; transition: opacity 0.2s, scale 0.2s; }
.plb-thumbs button[aria-current="true"] { opacity: 1; scale: 1.06; outline: 2px solid #fff; outline-offset: 1px; }
.plb-thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }
.plb-cap, .plb-thumbs, .plb-prev, .plb-next { transition: opacity 0.25s; }
.plb-zoomed .plb-cap, .plb-zoomed .plb-thumbs, .plb-zoomed .plb-prev, .plb-zoomed .plb-next { opacity: 0; pointer-events: none; }
.plb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 640px) { .plb-prev, .plb-next { display: none; } .plb-cap { bottom: 84px; } }
@media (hover: none) { .plb-prev, .plb-next { display: none; } }
[data-lightbox] img { cursor: zoom-in; }
`;

const WGSL = /* wgsl */ `
struct D { rect: vec4f, uv: vec4f, p: vec4f, q: vec4f };
// rect : x, y, w, h (px écran) ; uv : u0, v0, u1, v1 ; p : rayon, alpha, genre (0 image, 1 ombre, 2 fond), lod ;
// q : flou d'ombre (px), largeur, hauteur de l'écran (px), échelle (dpr).
@group(0) @binding(0) var<uniform> d: D;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

struct VO { @builtin(position) pos: vec4f, @location(0) px: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VO {
  let c = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u));
  var r = d.rect;
  let kind = i32(d.p.z + 0.5);
  if (kind == 1) { let g = d.q.x * 2.0; r = vec4f(r.x - g, r.y - g * 0.6, r.z + g * 2.0, r.w + g * 2.6); }
  if (kind == 2) { r = vec4f(0.0, 0.0, d.q.y, d.q.z); }
  let px = r.xy + c * r.zw;
  var o: VO;
  o.pos = vec4f(px.x / d.q.y * 2.0 - 1.0, 1.0 - px.y / d.q.z * 2.0, 0.0, 1.0);
  o.px = px;
  return o;
}
fn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let kind = i32(d.p.z + 0.5);
  let half = d.rect.zw * 0.5;
  let c = d.rect.xy + half;
  // La lecture de texture d'abord, hors de toute branche (dérivées, mipmaps).
  var t = (i.px - d.rect.xy) / max(d.rect.zw, vec2f(1.0));
  if (kind == 2) {
    // Fond : l'image en « cover » sur tout l'écran.
    let sa = d.q.y / d.q.z;
    let ia = d.rect.z / max(d.rect.w, 1.0);
    var s = vec2f(1.0);
    if (sa > ia) { s.y = ia / sa; } else { s.x = sa / ia; }
    t = (i.px / d.q.yz - 0.5) * s + 0.5;
  }
  let uv = mix(d.uv.xy, d.uv.zw, clamp(t, vec2f(0.0), vec2f(1.0)));
  let sharp = textureSample(tex, samp, uv);
  let blur = textureSampleLevel(tex, samp, uv, d.p.w);
  if (kind == 2) {
    // Fond : la photo noyée, assombrie, avec un vignettage ; une couleur par image.
    let v = length((i.px / d.q.yz - 0.5) * vec2f(1.1, 1.3));
    let col = blur.rgb * 0.42 * (1.0 - 0.55 * smoothstep(0.25, 0.95, v)) + vec3f(0.012);
    let a = d.p.y;
    return vec4f(col * a, a);
  }
  let sd = sdrb(i.px - c, half, min(d.p.x, min(half.x, half.y)));
  if (kind == 1) {
    // Ombre douce, un peu plus bas que l'image.
    let blurPx = d.q.x;
    let s2 = sdrb(i.px - c - vec2f(0.0, blurPx * 0.35), half, min(d.p.x, min(half.x, half.y)));
    let a = d.p.y * 0.55 * (1.0 - smoothstep(-blurPx * 0.4, blurPx, s2));
    return vec4f(0.0, 0.0, 0.0, a);
  }
  let aa = clamp(0.5 - sd / max(d.q.w, 1.0), 0.0, 1.0);
  let a = aa * d.p.y;
  return vec4f(sharp.rgb * a, a);
}
`;

const MIP_WGSL = /* wgsl */ `
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var src: texture_2d<f32>;
struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let x = f32((i << 1u) & 2u);
  let y = f32(i & 2u);
  var o: VO;
  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  o.uv = vec2f(x, y);
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4f { return textureSampleLevel(src, samp, i.uv, 0.0); }
`;

/** La partie de l'image que montre une vignette en object-fit: cover (ou toute l'image en contain/fill). */
function coverUv(box: Rect, aspect: number, im: HTMLImageElement): readonly [number, number, number, number] {
  const fitMode = getComputedStyle(im).objectFit;
  if (fitMode !== "cover" || !box.h || !aspect) return [0, 0, 1, 1];
  const ba = box.w / box.h;
  if (aspect > ba) {
    const f = ba / aspect;
    return [(1 - f) / 2, 0, (1 + f) / 2, 1];
  }
  const f = aspect / ba;
  return [0, (1 - f) / 2, 1, (1 + f) / 2];
}

/* ───────────────────────── Rendu WebGPU ───────────────────────── */

type Tex = { tex: GPUTexture; bind: GPUBindGroup; w: number; h: number; full: boolean };

class GpuView {
  private ctx: GPUCanvasContext;
  private pipe: GPURenderPipeline;
  private mipPipe: GPURenderPipeline;
  private layout: GPUBindGroupLayout;
  private ubuf: GPUBuffer;
  private samp: GPUSampler;
  private format = navigator.gpu.getPreferredCanvasFormat();
  private texs = new Map<string, Tex>();
  private loading = new Set<string>();
  private stride = 256;
  constructor(
    private device: GPUDevice,
    private canvas: HTMLCanvasElement,
    private onReady: () => void,
  ) {
    this.ctx = canvas.getContext("webgpu")!;
    this.ctx.configure({ device, format: this.format, alphaMode: "premultiplied" });
    const mod = device.createShaderModule({ code: WGSL });
    this.layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform", hasDynamicOffset: true } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      ],
    });
    const blend: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } };
    this.pipe = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
      vertex: { module: mod, entryPoint: "vs" },
      fragment: { module: mod, entryPoint: "fs", targets: [{ format: this.format, blend }] },
      primitive: { topology: "triangle-strip" },
    });
    const mipMod = device.createShaderModule({ code: MIP_WGSL });
    this.mipPipe = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: mipMod, entryPoint: "vs" },
      fragment: { module: mipMod, entryPoint: "fs", targets: [{ format: "rgba8unorm" }] },
      primitive: { topology: "triangle-list" },
    });
    this.samp = device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", maxAnisotropy: 8, addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
    this.ubuf = device.createBuffer({ size: this.stride * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  }

  /** La texture d'une image (la vignette déjà chargée d'abord, la grande ensuite, sans saut : c'est la même photo). */
  tex(item: Item): Tex | null {
    const have = this.texs.get(item.src) ?? this.texs.get(item.thumb.currentSrc || item.thumb.src);
    if (!this.texs.has(item.src) && !this.loading.has(item.src)) {
      this.loading.add(item.src);
      void this.load(item.src).then(() => this.onReady());
      const ts = item.thumb.currentSrc || item.thumb.src;
      if (ts !== item.src && !this.texs.has(ts) && !this.loading.has(ts) && item.thumb.complete) {
        this.loading.add(ts);
        void this.load(ts, item.thumb).then(() => this.onReady());
      }
    }
    return have ?? null;
  }

  private async load(src: string, el?: HTMLImageElement) {
    try {
      let bmp: ImageBitmap;
      if (el && el.complete && el.naturalWidth) bmp = await createImageBitmap(el);
      else {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.src = src;
        await im.decode();
        bmp = await createImageBitmap(im);
      }
      const max = this.device.limits.maxTextureDimension2D;
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * k));
      const h = Math.max(1, Math.round(bmp.height * k));
      if (k < 1) bmp = await createImageBitmap(bmp, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
      const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
      const tex = this.device.createTexture({ size: [w, h], format: "rgba8unorm", mipLevelCount: levels, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      this.device.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex }, [w, h]);
      bmp.close();
      this.mips(tex, levels);
      const bind = this.device.createBindGroup({
        layout: this.layout,
        entries: [
          { binding: 0, resource: { buffer: this.ubuf, size: 64 } },
          { binding: 1, resource: this.samp },
          { binding: 2, resource: tex.createView() },
        ],
      });
      this.texs.set(src, { tex, bind, w, h, full: !el });
    } catch (e) {
      console.warn("[presse:lightbox] image illisible", src, e);
    }
  }

  private mips(tex: GPUTexture, levels: number) {
    const enc = this.device.createCommandEncoder();
    for (let l = 1; l < levels; l++) {
      const bind = this.device.createBindGroup({
        layout: this.mipPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.samp },
          { binding: 1, resource: tex.createView({ baseMipLevel: l - 1, mipLevelCount: 1 }) },
        ],
      });
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: tex.createView({ baseMipLevel: l, mipLevelCount: 1 }), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
      pass.setPipeline(this.mipPipe);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
    }
    this.device.queue.submit([enc.finish()]);
  }

  draw(draws: Draw[], items: Item[], W: number, H: number, dpr: number) {
    const cw = Math.round(W * dpr);
    const ch = Math.round(H * dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    const list: { t: Tex; o: number }[] = [];
    const data = new Float32Array((this.stride / 4) * Math.min(16, draws.length));
    draws.slice(0, 16).forEach((dr, n) => {
      const t = this.tex(items[dr.k]!);
      if (!t) return;
      const o = (n * this.stride) / 4;
      const r = dr.rect;
      // Lod du fond : un très grand flou, à peu près 1/40 de l'écran.
      const lod = Math.max(0, Math.log2(Math.max(t.w, t.h) / 24));
      const uv = dr.uv ?? [0, 0, 1, 1];
      data.set([r.x * dpr, r.y * dpr, r.w * dpr, r.h * dpr, ...uv, dr.radius * dpr, dr.alpha, dr.kind, lod, 28 * dpr, cw, ch, 1], o);
      list.push({ t, o: n * this.stride });
    });
    this.device.queue.writeBuffer(this.ubuf, 0, data);
    const enc = this.device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    pass.setPipeline(this.pipe);
    for (const { t, o } of list) {
      pass.setBindGroup(0, t.bind, [o]);
      pass.draw(4);
    }
    pass.end();
    this.device.queue.submit([enc.finish()]);
  }

  /** Les proportions réelles d'une image, si sa texture est là. */
  aspect(item: Item) {
    const t = this.texs.get(item.src) ?? this.texs.get(item.thumb.currentSrc || item.thumb.src);
    return t ? t.w / t.h : 0;
  }
  destroy() {
    for (const t of this.texs.values()) t.tex.destroy();
    this.texs.clear();
    this.ubuf.destroy();
  }
}

/* ───────────────────────── Rendu DOM (sans WebGPU) ───────────────────────── */

class DomView {
  private bd = document.createElement("div");
  private imgs = new Map<number, HTMLImageElement>();
  constructor(private box: HTMLElement) {
    this.bd.className = "plb-bd";
    box.append(this.bd);
  }
  draw(draws: Draw[], items: Item[]) {
    const seen = new Set<number>();
    for (const d of draws) {
      if (d.kind === 2) {
        this.bd.style.opacity = String(d.alpha);
        continue;
      }
      if (d.kind === 1) continue;
      let im = this.imgs.get(d.k);
      if (!im) {
        im = document.createElement("img");
        im.alt = "";
        im.src = items[d.k]!.src;
        im.decoding = "async";
        this.box.append(im);
        this.imgs.set(d.k, im);
      }
      seen.add(d.k);
      Object.assign(im.style, { width: `${d.rect.w}px`, height: `${d.rect.h}px`, translate: `${d.rect.x}px ${d.rect.y}px`, borderRadius: `${d.radius}px`, opacity: String(d.alpha) });
    }
    for (const [k, im] of this.imgs) if (!seen.has(k)) ((im.remove(), this.imgs.delete(k)));
  }
  clear() {
    for (const im of this.imgs.values()) im.remove();
    this.imgs.clear();
  }
}

/* ───────────────────────── La visionneuse ───────────────────────── */

let overlay: ReturnType<typeof build> | null = null;

function build() {
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.append(st);
  const root = document.createElement("div");
  root.className = "plb";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Visionneuse d'images");
  root.innerHTML = `<canvas class="plb-canvas" aria-hidden="true"></canvas><div class="plb-dom" aria-hidden="true"></div>
    <div class="plb-ui">
      <p class="plb-count" aria-live="polite"></p>
      <p class="plb-sr" aria-live="polite"></p>
      <button type="button" class="plb-btn plb-close" aria-label="Fermer (Échap)">✕</button>
      <button type="button" class="plb-btn plb-prev" aria-label="Image précédente">‹</button>
      <button type="button" class="plb-btn plb-next" aria-label="Image suivante">›</button>
      <p class="plb-cap"></p>
      <div class="plb-thumbs" aria-label="Toutes les images"></div>
    </div>`;
  document.body.append(root);
  const q = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  return { root, canvas: q<HTMLCanvasElement>(".plb-canvas"), dom: q<HTMLElement>(".plb-dom"), ui: q<HTMLElement>(".plb-ui"), count: q<HTMLElement>(".plb-count"), sr: q<HTMLElement>(".plb-sr"), close: q<HTMLButtonElement>(".plb-close"), prev: q<HTMLButtonElement>(".plb-prev"), next: q<HTMLButtonElement>(".plb-next"), cap: q<HTMLElement>(".plb-cap"), thumbs: q<HTMLElement>(".plb-thumbs") };
}

function itemsOf(group: HTMLElement): Item[] {
  return [...group.querySelectorAll<HTMLImageElement>("img")]
    .filter((im) => !im.closest(".plb"))
    .map((thumb) => {
      const a = thumb.closest("a[href]") as HTMLAnchorElement | null;
      const fig = thumb.closest("figure");
      const cap = thumb.dataset.caption ?? fig?.querySelector("figcaption")?.textContent?.trim() ?? "";
      const big = thumb.dataset.full ?? (a && group.contains(a) && /\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(a.href) ? a.href : "");
      return { trigger: (a && group.contains(a) ? a : thumb) as HTMLElement, thumb, src: big || thumb.currentSrc || thumb.src, caption: cap, alt: thumb.alt };
    });
}

/** Ouvre la visionneuse sur l'image `index` du groupe. */
export async function openLightbox(group: HTMLElement, index: number) {
  overlay ??= build();
  const O = overlay;
  const items = itemsOf(group);
  if (!items.length) return;
  const reduced = reducedQ();
  let i = clamp(index, 0, items.length - 1);
  let W = innerWidth;
  let H = innerHeight;
  const back = document.activeElement as HTMLElement | null;

  // Le rendu : WebGPU si possible, sinon le DOM.
  let gpu: GpuView | null = null;
  let dom: DomView | null = null;
  try {
    const device = await getDevice();
    gpu = new GpuView(device, O.canvas, () => wake());
    O.canvas.hidden = false;
    O.dom.hidden = true;
  } catch {
    dom = new DomView(O.dom);
    O.canvas.hidden = true;
    O.dom.hidden = false;
  }

  // État.
  let o = reduced ? 1 : 0; // ouverture 0 → 1
  let ov = 0;
  let oT = 1;
  let closing = false;
  let frozen: Rect | null = null; // la boîte au moment de fermer (glissée, zoomée)
  let sx = 0; // décalage latéral (glisser d'une image à l'autre)
  let sxv = 0;
  let dy = 0; // glisser pour fermer
  let dyv = 0;
  let z = 1; // zoom
  let zv = 0;
  let zT = 1;
  let pan = { x: 0, y: 0 };
  let panT = { x: 0, y: 0 };
  let panV = { x: 0, y: 0 };
  let ptrs = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>();
  let drag: null | { mode: "?" | "x" | "y" | "pan" | "pinch"; x0: number; y0: number; sx0: number; dy0: number; px0: number; py0: number; d0: number; z0: number; vx: number; vy: number; lx: number; ly: number; lt: number } = null;
  let lastTap = { t: 0, x: 0, y: 0 };
  let raf = 0;
  let last = performance.now();
  const hidden = new Set<HTMLImageElement>();

  const aspectOf = (k: number) => {
    const it = items[k]!;
    return (gpu?.aspect(it) || 0) || (it.thumb.naturalWidth && it.thumb.naturalHeight ? it.thumb.naturalWidth / it.thumb.naturalHeight : it.thumb.width / Math.max(1, it.thumb.height)) || 1.5;
  };
  const fit = (k: number): Rect => {
    const mx = W < 640 ? 12 : 72;
    const top = W < 640 ? 64 : 72;
    const bottom = items.length > 1 ? 150 : 96;
    const aw = W - mx * 2;
    const ah = H - top - bottom;
    const a = aspectOf(k);
    let w = aw;
    let h = w / a;
    if (h > ah) ((h = ah), (w = h * a));
    return { x: (W - w) / 2, y: top + (ah - h) / 2, w, h };
  };
  const thumbRadius = (k: number) => Number.parseFloat(getComputedStyle(items[k]!.thumb).borderTopLeftRadius) || 0;
  const visible = (r: Rect) => r.w > 2 && r.x < W && r.y < H && r.x + r.w > 0 && r.y + r.h > 0;
  /** Les limites du déplacement de l'image zoomée (centrée tant qu'elle tient dans l'écran). */
  const panLimit = (k: number, zz: number) => {
    const f = fit(k);
    return { x: Math.max(0, (f.w * zz - W) / 2 + 24), y: Math.max(0, (f.h * zz - H) / 2 + 24) };
  };
  /** La boîte de l'image courante, ouverte : ajustée, zoomée, déplacée, glissée. */
  const live = (): Rect => {
    const f = fit(i);
    const s = 1 - Math.min(0.3, Math.abs(dy) / H) * 0.9;
    const w = f.w * z * s;
    const h = f.h * z * s;
    const cx = f.x + f.w / 2 + pan.x + sx;
    const cy = f.y + f.h / 2 + pan.y + dy;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  };

  const setUi = () => {
    const it = items[i]!;
    O.count.textContent = items.length > 1 ? `${i + 1} / ${items.length}` : "";
    O.cap.textContent = it.caption;
    O.sr.textContent = `${it.alt || it.caption}${items.length > 1 ? `, image ${i + 1} sur ${items.length}` : ""}`;
    O.prev.disabled = i === 0;
    O.next.disabled = i === items.length - 1;
    O.prev.hidden = O.next.hidden = items.length < 2;
    O.thumbs.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
    O.thumbs.querySelector<HTMLElement>(`button:nth-child(${i + 1})`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduced ? "auto" : "smooth" });
    // La vignette de l'image ouverte s'efface de la page (elle est dans la visionneuse) ; les autres reviennent.
    for (const im of hidden) if (im !== it.thumb) ((im.style.opacity = ""), hidden.delete(im));
    it.thumb.style.opacity = "0";
    hidden.add(it.thumb);
  };
  O.thumbs.replaceChildren(
    ...(items.length > 1
      ? items.map((it, k) => {
          const b = document.createElement("button");
          b.type = "button";
          b.setAttribute("aria-label", `Image ${k + 1} : ${it.alt || it.caption}`);
          const im = document.createElement("img");
          im.src = it.thumb.currentSrc || it.thumb.src;
          im.alt = "";
          b.append(im);
          b.addEventListener("click", () => goTo(k));
          return b;
        })
      : []),
  );

  const goTo = (k: number) => {
    if (k < 0 || k >= items.length || k === i) {
      // Au bord : un petit refus élastique.
      if (!reduced) sxv += k < 0 ? 900 : -900;
      wake();
      return;
    }
    const dir = k > i ? 1 : -1;
    // Le glissé repart de là où il en est : la nouvelle image arrive depuis le côté.
    sx += dir * (fit(i).w / 2 + fit(k).w / 2 + GAP) * (Math.abs(k - i) === 1 ? 1 : 1);
    i = k;
    z = zT = 1;
    pan = { x: 0, y: 0 };
    panT = { x: 0, y: 0 };
    if (reduced) sx = 0;
    setUi();
    wake();
  };
  const zoomAt = (target: number, px: number, py: number) => {
    const zz = clamp(target, 1, 6);
    const f = fit(i);
    const c = { x: f.x + f.w / 2 + panT.x, y: f.y + f.h / 2 + panT.y };
    const k = zz / zT;
    let nx = px - (px - c.x) * k - (f.x + f.w / 2);
    let ny = py - (py - c.y) * k - (f.y + f.h / 2);
    const lim = panLimit(i, zz);
    nx = clamp(nx, -lim.x, lim.x);
    ny = clamp(ny, -lim.y, lim.y);
    zT = zz;
    panT = zz <= 1.001 ? { x: 0, y: 0 } : { x: nx, y: ny };
    if (reduced) ((z = zT), (pan = { ...panT }));
    wake();
  };

  const close = () => {
    if (closing) return;
    closing = true;
    frozen = live();
    sx = dy = 0;
    z = zT = 1;
    pan = panT = { x: 0, y: 0 };
    oT = 0;
    // Les commandes partent tout de suite ; l'image revient dans sa vignette.
    if (reduced) o = 0;
    wake();
  };
  const finish = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    O.root.hidden = true;
    for (const im of hidden) im.style.opacity = "";
    hidden.clear();
    dom?.clear();
    gpu?.destroy();
    removeEventListener("keydown", onKey, true);
    removeEventListener("resize", onResize);
    O.root.onpointerdown = O.root.onpointermove = O.root.onpointerup = O.root.onpointercancel = null;
    O.root.onwheel = O.root.ondblclick = null;
    O.close.onclick = O.prev.onclick = O.next.onclick = null;
    document.documentElement.style.overflow = "";
    back?.focus?.({ preventScroll: true });
  };

  /* ── Une image ── */
  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let moving = false;
    const step = (x: number, v: number, t: number, s: Spring): [number, number] => {
      if (reduced) return [t, 0];
      const r = springStep(x, v, t, dt, s);
      if (Math.abs(r[0] - t) > 0.0005 || Math.abs(r[1]) > 0.005) moving = true;
      else return [t, 0];
      return r;
    };
    [o, ov] = step(o, ov, oT, OPEN);
    if (!drag || drag.mode !== "x") [sx, sxv] = step(sx, sxv, 0, SNAP);
    if (!drag || drag.mode !== "y") [dy, dyv] = step(dy, dyv, 0, SNAP);
    if (!drag || (drag.mode !== "pinch" && drag.mode !== "pan")) {
      // Inertie du déplacement après un lâcher, puis retour dans les limites.
      if (Math.hypot(panV.x, panV.y) > 5 && !reduced) {
        panT = { x: panT.x + panV.x * dt, y: panT.y + panV.y * dt };
        panV = { x: panV.x * Math.exp(-dt * 6), y: panV.y * Math.exp(-dt * 6) };
        const lim = panLimit(i, zT);
        panT = { x: clamp(panT.x, -lim.x, lim.x), y: clamp(panT.y, -lim.y, lim.y) };
        moving = true;
      }
      [z, zv] = step(z, zv, zT, ZOOM);
      // Le déplacement suit sa cible par un rattrapage exponentiel (sans dépassement : l'image ne rebondit pas hors champ).
      pan.x = lerp(pan.x, panT.x, reduced ? 1 : 1 - Math.exp(-dt * 18));
      pan.y = lerp(pan.y, panT.y, reduced ? 1 : 1 - Math.exp(-dt * 18));
      if (Math.abs(pan.x - panT.x) + Math.abs(pan.y - panT.y) > 0.3) moving = true;
    }

    const draws: Draw[] = [];
    const thumb = rectOf(items[i]!.thumb);
    const tr = thumbRadius(i);
    const fly = !closing || visible(thumb);
    const end = closing && frozen ? frozen : live();
    const r = fly ? lerpRect(thumb, end, o) : end;
    const dimDrag = 1 - Math.min(1, Math.abs(dy) / (H * 0.45));
    const bdA = clamp(o, 0, 1) * dimDrag;
    draws.push({ kind: 2, k: i, rect: fit(i), alpha: bdA, radius: 0 });
    // Les voisines, pendant un glissé.
    if (!closing && o > 0.98 && z < 1.02) {
      for (const k of [i - 1, i + 1]) {
        if (k < 0 || k >= items.length) continue;
        const f = fit(k);
        const cur = live();
        const x = k < i ? cur.x - GAP - f.w : cur.x + cur.w + GAP;
        const nr = { x, y: f.y, w: f.w, h: f.h };
        if (nr.x < W && nr.x + nr.w > 0) {
          draws.push({ kind: 1, k, rect: nr, alpha: 1, radius: 10 });
          draws.push({ kind: 0, k, rect: nr, alpha: 1, radius: 10 });
        }
      }
    }
    const rad = lerp(tr, 10, clamp(o, 0, 1));
    const a = fly ? 1 : clamp(o, 0, 1);
    // La vignette est souvent recadrée (object-fit: cover) : le vol part de ce recadrage et s'ouvre sur l'image entière.
    const crop = fly ? coverUv(thumb, aspectOf(i), items[i]!.thumb) : ([0, 0, 1, 1] as const);
    const e = clamp(o, 0, 1);
    const uv: [number, number, number, number] = [lerp(crop[0], 0, e), lerp(crop[1], 0, e), lerp(crop[2], 1, e), lerp(crop[3], 1, e)];
    draws.push({ kind: 1, k: i, rect: r, alpha: e * a, radius: rad });
    draws.push({ kind: 0, k: i, rect: r, alpha: a, radius: rad, uv });
    O.root.classList.toggle("plb-zoomed", zT > 1.02);
    if (gpu) gpu.draw(draws, items, W, H, Math.min(devicePixelRatio || 1, 2));
    else dom?.draw(draws, items);
    O.ui.style.opacity = String(clamp(o * 1.4 - 0.4, 0, 1) * (1 - Math.min(1, Math.abs(dy) / 160)) * (closing ? 0 : 1));

    if (closing && o <= 0.002) return finish();
    if (moving || drag) wake();
  };
  function wake() {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  /* ── Gestes ── */
  const R = O.root;
  R.onpointerdown = (e) => {
    if ((e.target as Element).closest(".plb-btn, .plb-thumbs") || closing) return;
    R.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    panV = { x: 0, y: 0 };
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      drag = { mode: "pinch", x0: (a!.x + b!.x) / 2, y0: (a!.y + b!.y) / 2, sx0: 0, dy0: 0, px0: panT.x, py0: panT.y, d0: Math.hypot(a!.x - b!.x, a!.y - b!.y), z0: zT, vx: 0, vy: 0, lx: 0, ly: 0, lt: 0 };
    } else drag = { mode: zT > 1.02 ? "pan" : "?", x0: e.clientX, y0: e.clientY, sx0: sx, dy0: dy, px0: panT.x, py0: panT.y, d0: 0, z0: zT, vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, lt: performance.now() };
    wake();
  };
  R.onpointermove = (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p || !drag) return;
    p.x = e.clientX;
    p.y = e.clientY;
    const now = performance.now();
    const idt = Math.max(1, now - drag.lt) / 1000;
    drag.vx = lerp(drag.vx, (e.clientX - drag.lx) / idt, 0.4);
    drag.vy = lerp(drag.vy, (e.clientY - drag.ly) / idt, 0.4);
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    drag.lt = now;
    const dx = e.clientX - drag.x0;
    const ddy = e.clientY - drag.y0;
    if (drag.mode === "pinch" && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const cx = (a!.x + b!.x) / 2;
      const cy = (a!.y + b!.y) / 2;
      zT = drag.z0;
      panT = { x: drag.px0 + (cx - drag.x0), y: drag.py0 + (cy - drag.y0) };
      zoomAt(drag.z0 * (d / Math.max(1, drag.d0)), cx, cy);
      z = zT;
      pan = { ...panT };
      return;
    }
    if (drag.mode === "?") {
      if (Math.hypot(dx, ddy) < 6) return;
      drag.mode = Math.abs(dx) > Math.abs(ddy) ? "x" : "y";
    }
    if (drag.mode === "x") {
      // Aux extrémités, l'image résiste (élastique).
      const edge = (i === 0 && dx > 0) || (i === items.length - 1 && dx < 0);
      sx = drag.sx0 + (edge ? dx * 0.3 : dx);
    } else if (drag.mode === "y") {
      dy = drag.dy0 + (ddy < 0 ? ddy * 0.35 : ddy);
    } else if (drag.mode === "pan") {
      const lim = panLimit(i, zT);
      const rub = (v: number, l: number) => (v > l ? l + (v - l) * 0.3 : v < -l ? -l + (v + l) * 0.3 : v);
      panT = { x: rub(drag.px0 + dx, lim.x), y: rub(drag.py0 + ddy, lim.y) };
      pan = { ...panT };
    }
    wake();
  };
  const release = (e: PointerEvent) => {
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (!drag || !p) return;
    const d = drag;
    if (d.mode === "pinch") {
      if (ptrs.size === 0) {
        drag = null;
        if (zT < 1.05) zoomAt(1, W / 2, H / 2);
      }
      return;
    }
    drag = null;
    const now = performance.now();
    const tap = Math.hypot(p.x - p.x0, p.y - p.y0) < 8 && now - p.t0 < 300;
    if (d.mode === "x") {
      const w = fit(i).w;
      if ((sx < -w * 0.2 || d.vx < -500) && i < items.length - 1) goTo(i + 1);
      else if ((sx > w * 0.2 || d.vx > 500) && i > 0) goTo(i - 1);
      sxv = d.vx;
    } else if (d.mode === "y") {
      if (dy > 120 || d.vy > 800) close();
      else dyv = d.vy;
    } else if (d.mode === "pan") {
      panV = { x: d.vx, y: d.vy };
      const lim = panLimit(i, zT);
      panT = { x: clamp(panT.x, -lim.x, lim.x), y: clamp(panT.y, -lim.y, lim.y) };
      if (tap) handleTap(p.x, p.y, now);
    } else if (tap) handleTap(p.x, p.y, now);
    wake();
  };
  const handleTap = (x: number, y: number, now: number) => {
    // Double-tap : zoom ici, ou retour ; un tap simple hors de l'image ferme.
    if (now - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 30) {
      lastTap.t = 0;
      zoomAt(zT > 1.05 ? 1 : 2.5, x, y);
      return;
    }
    lastTap = { t: now, x, y };
    const r = live();
    const out = x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h;
    if (out && zT <= 1.02) setTimeout(() => lastTap.t === now && close(), 330);
  };
  R.onpointerup = release;
  R.onpointercancel = release;
  // Molette : Ctrl (ou pincement du pavé) zoome au pointeur ; sinon, latérale = image suivante, verticale = fermer.
  let wheelIdle = 0;
  let wheelMode: "" | "x" | "y" = "";
  R.onwheel = (e) => {
    e.preventDefault();
    if (closing) return;
    if (e.ctrlKey) return zoomAt(zT * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    if (zT > 1.02) {
      const lim = panLimit(i, zT);
      panT = { x: clamp(panT.x - e.deltaX, -lim.x, lim.x), y: clamp(panT.y - e.deltaY, -lim.y, lim.y) };
      return wake();
    }
    if (!wheelMode) wheelMode = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? "x" : "y";
    if (wheelMode === "x") sx -= e.deltaX;
    else dy -= e.deltaY * 0.8;
    drag = null;
    clearTimeout(wheelIdle);
    wheelIdle = window.setTimeout(() => {
      if (wheelMode === "x") {
        const w = fit(i).w;
        if (sx < -w * 0.15 && i < items.length - 1) goTo(i + 1);
        else if (sx > w * 0.15 && i > 0) goTo(i - 1);
      } else if (Math.abs(dy) > 110) close();
      wheelMode = "";
      wake();
    }, 120);
    wake();
  };
  R.ondblclick = (e) => {
    if ((e.target as Element).closest(".plb-btn, .plb-thumbs")) return;
    e.preventDefault();
  };
  O.close.onclick = () => close();
  O.prev.onclick = () => goTo(i - 1);
  O.next.onclick = () => goTo(i + 1);

  /* ── Clavier ── */
  function onKey(e: KeyboardEvent) {
    if (closing) return;
    const k = e.key;
    let used = true;
    if (k === "Escape") close();
    else if (k === "ArrowRight" && zT <= 1.02) goTo(i + 1);
    else if (k === "ArrowLeft" && zT <= 1.02) goTo(i - 1);
    else if (k.startsWith("Arrow") && zT > 1.02) {
      const lim = panLimit(i, zT);
      const s = 80;
      panT = {
        x: clamp(panT.x + (k === "ArrowLeft" ? s : k === "ArrowRight" ? -s : 0), -lim.x, lim.x),
        y: clamp(panT.y + (k === "ArrowUp" ? s : k === "ArrowDown" ? -s : 0), -lim.y, lim.y),
      };
      wake();
    } else if (k === "+" || k === "=") zoomAt(zT * 1.5, W / 2, H / 2);
    else if (k === "-" || k === "_") zoomAt(zT / 1.5, W / 2, H / 2);
    else if (k === "0") zoomAt(1, W / 2, H / 2);
    else if (k === "Home") goTo(0);
    else if (k === "End") goTo(items.length - 1);
    else if (k === "Tab") {
      // Le focus reste dans la visionneuse.
      const f = [...O.root.querySelectorAll<HTMLElement>("button:not([disabled]):not([hidden])")].filter((b) => b.offsetParent);
      const at = f.indexOf(document.activeElement as HTMLElement);
      f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus();
    } else used = false;
    if (used) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  const onResize = () => {
    W = innerWidth;
    H = innerHeight;
    wake();
  };
  addEventListener("keydown", onKey, true);
  addEventListener("resize", onResize);

  O.root.hidden = false;
  O.ui.style.opacity = "0";
  document.documentElement.style.overflow = "hidden";
  setUi();
  O.close.focus({ preventScroll: true });
  wake();
}

/** Arme toutes les visionneuses de la page ([data-lightbox]) et celles qui arrivent ensuite. */
export function initLightbox(root: ParentNode = document) {
  if (typeof document === "undefined") return;
  const arm = (group: HTMLElement) => {
    if (group.dataset.lightboxReady !== undefined) return;
    group.dataset.lightboxReady = "";
    group.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const im = (e.target as Element).closest("img") ?? (e.target as Element).closest("a[href]")?.querySelector("img");
      if (!im || !group.contains(im)) return;
      const list = itemsOf(group);
      const k = list.findIndex((it) => it.thumb === im);
      if (k < 0) return;
      e.preventDefault();
      void openLightbox(group, k);
    });
    // Au clavier : chaque image s'ouvre avec Entrée (un lien la rend déjà atteignable ; sinon on la rend focalisable).
    for (const it of itemsOf(group)) {
      if (it.trigger.tagName === "A") continue;
      it.thumb.tabIndex = 0;
      it.thumb.setAttribute("role", "button");
      it.thumb.setAttribute("aria-label", `Agrandir : ${it.alt || it.caption || "image"}`);
      it.thumb.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        void openLightbox(group, itemsOf(group).findIndex((x) => x.thumb === it.thumb));
      });
    }
  };
  root.querySelectorAll<HTMLElement>("[data-lightbox]").forEach(arm);
  if (root === document) {
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement) (n.matches("[data-lightbox]") ? arm(n) : n.querySelectorAll<HTMLElement>("[data-lightbox]").forEach(arm));
    }).observe(document.body, { childList: true, subtree: true });
  }
}
