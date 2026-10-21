import { SAMPLER_EFFECTS } from "./gpu/sampler-effects.wgsl.ts";
import { EXPLORE_EFFECTS } from "./sampler-catalog.ts";
import { getExploreTime } from "./sampler-runtime.ts";
import { motion, settings } from "./state.ts";

/**
 * Amélioration expérimentale d'une carte HTML existante, avec le device de PLI.
 * API moderne uniquement : content="drawable", drawable, paint/requestPaint,
 * drawElementImageToTexture et updateElementGeometry. Le premier upload attend
 * un vrai paint : avant lui, le navigateur n'a encore enregistré aucun snapshot.
 *
 * Références du contrat (29 septembre 2026) :
 * https://developer.chrome.com/blog/html-in-canvas-ot-changes
 * https://github.com/WICG/html-in-canvas
 */
type DrawQueue = GPUQueue & {
  drawElementImageToTexture?: (
    source: { source: Element },
    destination: { texture: GPUTexture; size: GPUExtent3DDict },
  ) => void;
};
type DrawableCanvas = HTMLCanvasElement & {
  content?: string;
  requestPaint?: () => void;
  updateElementGeometry?: (element: Element, options: { canvasTransform: DOMMatrixInit }) => void;
  clearElementGeometry?: (element: Element) => void;
};
type PaintEvent = Event & { changedElements?: readonly Element[] };

// 48 octets : frame (taille CSS, temps, échelle), control (mélange, séparation,
// comparaison, original forcé), point, mode u32, active u32.
export const HIC_SHADER = /* wgsl */ `
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
struct HicParams {
  frame: vec4f,
  control: vec4f,
  point: vec2f,
  mode: u32,
  enabled: u32,
};
@group(0) @binding(2) var<uniform> hic: HicParams;

fn hic_source(uv: vec2f) -> vec4f {
  let halfTexel = vec2f(0.5) / vec2f(textureDimensions(tex));
  return textureSampleLevel(tex, samp, clamp(uv, halfTexel, vec2f(1.0) - halfTexel), 0.0);
}

fn fx_sample(uv: vec2f, region: vec4f) -> vec3f {
  let halfTexel = vec2f(0.5) / vec2f(textureDimensions(tex));
  let low = region.xy + halfTexel;
  let high = max(low, region.xy + region.zw - halfTexel);
  return textureSampleLevel(tex, samp, clamp(region.xy + uv * region.zw, low, high), 0.0).rgb;
}

${SAMPLER_EFFECTS}

struct V { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  let q = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  return V(vec4f(q, 0.0, 1.0), vec2f(q.x * 0.5 + 0.5, 0.5 - q.y * 0.5));
}

fn hic_legacy_trame(uv: vec2f) -> vec4f {
  // La leçon 10.1 conserve son traitement de trame noire à 45°.
  let px = uv * vec2f(textureDimensions(tex));
  let c = cos(0.7854); let s = sin(0.7854);
  let r = mat2x2f(c, s, -s, c);
  let q = (r * px) / 5.0;
  let cc = floor(q) + 0.5;
  let center = transpose(r) * (cc * 5.0);
  let col = hic_source(center / vec2f(textureDimensions(tex)));
  let paper = vec3f(0.937, 0.933, 0.91);
  let v = 1.0 - dot(mix(paper, col.rgb, col.a), vec3f(0.299, 0.587, 0.114)) / 0.93;
  let rad = sqrt(clamp(v, 0.0, 1.0) / 3.14159);
  let cov = 1.0 - smoothstep(rad - 0.1, rad + 0.1, length(q - cc));
  return vec4f(mix(paper, vec3f(0.07), cov), 1.0);
}

@fragment fn fs(in: V) -> @location(0) vec4f {
  let source = hic_source(in.uv);
  // Ces modes déplacent les pixels ; le DOM conserve toujours sa géométrie.
  let displaces = hic.mode == 3u || hic.mode == 4u || hic.mode == 5u || hic.mode == 9u;
  if (hic.control.w > 0.5 || (hic.enabled != 0u && displaces)) { return source; }
  if (hic.enabled == 0u) { return hic_legacy_trame(in.uv); }
  if (hic.control.x <= 0.0 || (hic.control.z > 0.5 && in.uv.x < hic.control.y)) {
    return source;
  }
  let p = FxParams(vec4f(0.0, 0.0, 1.0, 1.0), hic.frame.xy, hic.point,
    hic.frame.z, hic.frame.w, hic.mode);
  return vec4f(mix(source.rgb, sampler_effect(in.uv, p), clamp(hic.control.x, 0.0, 1.0)), source.a);
}
`;

/** Aucune branche de compatibilité avec les anciennes API layoutsubtree/copy*. */
export function supportsHtmlInCanvas(queue?: GPUQueue): boolean {
  if (typeof HTMLCanvasElement === "undefined") return false;
  const canvas = HTMLCanvasElement.prototype as DrawableCanvas;
  const candidate = queue ?? (typeof GPUQueue === "undefined" ? undefined : GPUQueue.prototype);
  return typeof (candidate as DrawQueue | undefined)?.drawElementImageToTexture === "function" &&
    "content" in canvas && typeof canvas.requestPaint === "function" &&
    typeof canvas.updateElementGeometry === "function";
}

/**
 * Toutes les scopes sont retirées dans le même tour synchrone que leur ajout.
 * Attendre createRenderPipelineAsync ou popErrorScope avec une scope encore
 * empilée capturerait des erreurs du renderer principal, qui partage le device.
 */
function checkedGpu<T>(device: GPUDevice, work: () => T | Promise<T>): Promise<T> {
  const errors: Promise<GPUError | null>[] = [];
  let opened = 0;
  let result: Promise<T>;
  try {
    for (const filter of ["internal", "out-of-memory", "validation"] as const) {
      device.pushErrorScope(filter);
      opened++;
    }
    result = Promise.resolve(work());
  } catch (error) {
    result = Promise.reject(error);
  } finally {
    while (opened-- > 0) {
      try { errors.push(device.popErrorScope()); }
      catch (error) { errors.push(Promise.reject(error)); }
    }
  }
  return Promise.allSettled([result, ...errors]).then((settled) => {
    for (const item of settled) if (item.status === "rejected") throw item.reason;
    for (const item of settled.slice(1)) {
      if (item.status === "fulfilled" && item.value) throw new Error((item.value as GPUError).message);
    }
    return (settled[0] as PromiseFulfilledResult<T>).value;
  });
}

const CONTROL = "button, a[href], input, select, textarea, summary, [role='button'], [contenteditable='true']";
let active: HtmlCard | null = null;

class HtmlCard {
  private readonly device: GPUDevice;
  private readonly host: HTMLElement;
  private readonly card: HTMLElement;
  private readonly out: Element;
  private readonly canvas = document.createElement("canvas") as DrawableCanvas;
  private readonly marker = document.createComment("HTML-in-Canvas");
  private readonly cleanups: (() => void)[] = [];
  private readonly originalWidth: string;
  private readonly originalWidthPriority: string;
  private readonly originalDrawable: string | null;
  private readonly data = new ArrayBuffer(48);
  private readonly floats = new Float32Array(this.data);
  private readonly ints = new Uint32Array(this.data);
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private uniform: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private texture: GPUTexture | null = null;
  private bind: GPUBindGroup | null = null;
  private textureWidth = 0;
  private textureHeight = 0;
  private cssWidth = 0;
  private cssHeight = 0;
  private hoveredControl: Element | null = null;
  private disposed = false;
  private mounted = false;
  private moving = false;
  private painting = false;
  private paintRequested = false;
  private needsPaint = true;
  private sourceDirty = true;
  private hasPainted = false;
  private firstPaintTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    device: GPUDevice,
    host: HTMLElement,
    card: HTMLElement,
    out: Element,
  ) {
    this.device = device;
    this.host = host;
    this.card = card;
    this.out = out;
    this.originalWidth = card.style.getPropertyValue("width");
    this.originalWidthPriority = card.style.getPropertyPriority("width");
    this.originalDrawable = card.getAttribute("drawable");
    this.canvas.className = "hic-canvas";
    this.canvas.setAttribute("content", "drawable");
    this.canvas.style.width = "100%";
    // Le canvas n'est pas aria-hidden : son sous-arbre garde texte et contrôles.
  }

  private current(): boolean { return !this.disposed && active === this; }

  private status(message: string): void {
    if (this.current() && this.out.textContent !== message) this.out.textContent = message;
  }

  private visible(): boolean {
    if (document.hidden || settings.dom.hideGpu || !this.host.isConnected || this.host.closest("[hidden], [inert]")) return false;
    const r = this.host.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 &&
      r.top < innerHeight && r.left < innerWidth;
  }

  private listen(target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener);
    this.cleanups.push(() => target.removeEventListener(type, listener));
  }

  async start(): Promise<void> {
    try {
      if (this.canvas.content !== "drawable") throw new Error("content=drawable indisponible");
      this.context = this.canvas.getContext("webgpu");
      if (!this.context) throw new Error("Contexte WebGPU indisponible pour la carte");
      this.listen(this.canvas, "paint", (event) => this.paint(event as PaintEvent));
      const refresh = () => this.refresh();
      for (const type of ["pli:explore-change", "pli:motion-change", "resize"]) this.listen(window, type, refresh);
      this.listen(document, "visibilitychange", refresh);
      this.listen(this.card, "focusin", refresh);
      this.listen(this.card, "focusout", () => queueMicrotask(refresh));
      this.listen(document, "selectionchange", refresh);
      this.listen(this.card, "pointerover", (event) => this.hover((event as PointerEvent).target));
      this.listen(this.card, "pointerout", (event) => this.hover((event as PointerEvent).relatedTarget));
      // Les événements paint couvrent aussi CSS :hover, focus, fontes et images.
      const resize = new ResizeObserver(refresh);
      resize.observe(this.host);
      resize.observe(this.card);
      this.cleanups.push(() => resize.disconnect());
      const intersection = new IntersectionObserver(refresh);
      intersection.observe(this.host);
      this.cleanups.push(() => intersection.disconnect());
      const mutations = new MutationObserver(() => { this.sourceDirty = true; this.refresh(); });
      mutations.observe(this.card, { subtree: true, childList: true, characterData: true, attributes: true });
      this.cleanups.push(() => mutations.disconnect());
      const visibility = new MutationObserver(refresh);
      for (let el: HTMLElement | null = this.host; el; el = el.parentElement) {
        visibility.observe(el, { attributes: true, attributeFilter: ["hidden", "inert"] });
      }
      this.cleanups.push(() => visibility.disconnect());
      this.watchDpr();
      void this.device.lost.then(
        () => this.fail(new Error("Le device WebGPU a été perdu")),
        (error: unknown) => this.fail(error),
      );
      const format = navigator.gpu.getPreferredCanvasFormat();
      const pipeline = await checkedGpu(this.device, () => {
        this.context!.configure({ device: this.device, format, alphaMode: "opaque" });
        this.uniform = this.device.createBuffer({ label: "PLI · carte HTML", size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.sampler = this.device.createSampler({ magFilter: "linear", minFilter: "linear" });
        const module = this.device.createShaderModule({ label: "PLI · effets HTML", code: HIC_SHADER });
        return this.device.createRenderPipelineAsync({
          label: "PLI · carte HTML", layout: "auto",
          vertex: { module, entryPoint: "vs" },
          fragment: { module, entryPoint: "fs", targets: [{ format }] },
        });
      });
      if (!this.current()) return;
      this.pipeline = pipeline;
      this.refresh();
    } catch (error) { this.fail(error); }
  }

  private watchDpr(): void {
    let query: MediaQueryList | null = null;
    const change = () => {
      query?.removeEventListener("change", change);
      query = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
      query.addEventListener("change", change);
      this.refresh();
    };
    change();
    this.cleanups.push(() => query?.removeEventListener("change", change));
  }

  private hover(target: EventTarget | null): void {
    const control = target instanceof Element ? target.closest(CONTROL) : null;
    const next = control && this.card.contains(control) ? control : null;
    if (this.hoveredControl === next) return;
    this.hoveredControl = next;
    this.sourceDirty = true;
    this.refresh();
  }

  private protectedInteraction(): boolean {
    const selection = document.getSelection();
    return Boolean(this.hoveredControl || this.card.contains(document.activeElement) ||
      (selection && !selection.isCollapsed &&
        (this.card.contains(selection.anchorNode) || this.card.contains(selection.focusNode))));
  }

  private updateActivity(): void {
    const e = settings.explore;
    const contributes = this.hasPainted && this.mounted && e.active && e.amount > 0 &&
      Boolean(EXPLORE_EFFECTS[e.mode]?.htmlSafe) && !this.protectedInteraction() && this.visible() &&
      !(e.compare && e.split >= 1);
    if (contributes) this.host.dataset.hicActive = "true";
    else delete this.host.dataset.hicActive;
  }

  private moveCard(work: () => void): void {
    const focused = this.card.contains(document.activeElement) ? document.activeElement : null;
    this.moving = true;
    try {
      work();
      // Déplacer le même nœud conserve les handlers ; rétablir aussi son focus.
      if (focused instanceof HTMLElement && focused.isConnected && document.activeElement !== focused &&
        (!document.activeElement || document.activeElement === document.body)) focused.focus({ preventScroll: true });
    } finally { this.moving = false; }
  }

  private syncSize(): boolean {
    const width = this.card.offsetWidth;
    const height = this.card.offsetHeight;
    if (width <= 0 || height <= 0) return false;
    const ratio = Math.min(2, Math.max(1, devicePixelRatio || 1),
      this.device.limits.maxTextureDimension2D / width, this.device.limits.maxTextureDimension2D / height);
    const pixelWidth = Math.min(this.device.limits.maxTextureDimension2D, Math.max(1, Math.ceil(width * ratio)));
    const pixelHeight = Math.min(this.device.limits.maxTextureDimension2D, Math.max(1, Math.ceil(height * ratio)));
    const changed = width !== this.cssWidth || height !== this.cssHeight ||
      pixelWidth !== this.canvas.width || pixelHeight !== this.canvas.height;
    if (!changed) return false;
    this.cssWidth = width;
    this.cssHeight = height;
    this.canvas.style.height = `${height}px`;
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.sourceDirty = true;
    return true;
  }

  private refresh(): void {
    if (!this.current() || this.moving) return;
    this.needsPaint = true;
    try {
      this.updateActivity();
      if (!this.visible()) {
        this.paintRequested = false;
        this.clearFirstPaintTimer();
        return;
      }
      if (!this.pipeline) return;
      if (!this.mounted) {
        this.canvas.style.height = `${this.card.offsetHeight}px`;
        this.card.setAttribute("drawable", "");
        this.card.style.width = "100%";
        this.moveCard(() => {
          this.card.before(this.marker, this.canvas);
          this.canvas.append(this.card);
        });
        this.mounted = true;
      }
      this.syncSize();
      this.requestPaint();
    } catch (error) { this.fail(error); }
  }

  private requestPaint(): void {
    if (!this.current() || !this.mounted || this.paintRequested || this.painting || !this.visible()) return;
    this.paintRequested = true;
    try {
      this.canvas.requestPaint!();
      if (!this.hasPainted && this.firstPaintTimer === undefined) {
        this.firstPaintTimer = setTimeout(() => {
          this.firstPaintTimer = undefined;
          if (this.current() && this.visible() && !this.hasPainted) this.fail(new Error("Premier paint HTML absent"));
        }, 3000);
      }
    } catch (error) { this.fail(error); }
  }

  private clearFirstPaintTimer(): void {
    if (this.firstPaintTimer !== undefined) clearTimeout(this.firstPaintTimer);
    this.firstPaintTimer = undefined;
  }

  private ensureTexture(): void {
    if (this.texture && this.textureWidth === this.canvas.width && this.textureHeight === this.canvas.height) return;
    this.texture?.destroy();
    this.texture = this.device.createTexture({
      label: "PLI · snapshot HTML", size: [this.canvas.width, this.canvas.height], format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.textureWidth = this.canvas.width;
    this.textureHeight = this.canvas.height;
    this.bind = this.device.createBindGroup({
      layout: this.pipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler! },
        { binding: 1, resource: this.texture.createView() },
        { binding: 2, resource: { buffer: this.uniform! } },
      ],
    });
    this.sourceDirty = true;
  }

  private animated(): boolean {
    const e = settings.explore;
    const effect = EXPLORE_EFFECTS[e.mode];
    return e.active && !e.paused && !motion.reduced && e.amount > 0 && Boolean(effect?.animated && effect.htmlSafe) &&
      !(e.compare && e.split >= 1) && !this.protectedInteraction() && this.visible();
  }

  private announce(): void {
    const e = settings.explore;
    const effect = EXPLORE_EFFECTS[e.mode];
    if (e.active && !effect?.htmlSafe) {
      this.status(`${effect?.name ?? "Cet effet"} s’applique à la photo. La carte HTML garde son aspect et ses zones de clic.`);
    } else {
      const name = e.active ? (e.amount <= 0 ? "carte d’origine" : effect!.name) : "trame noire";
      this.status(`HTML-in-Canvas actif · ${name}. Texte et bouton restent natifs ; l’aspect d’origine revient au focus ou au survol du bouton.`);
    }
  }

  private paint(event: PaintEvent): void {
    this.paintRequested = false;
    if (!this.current() || !this.mounted) return;
    if (!event.changedElements || event.changedElements.some((el) => el === this.card || this.card.contains(el))) this.sourceDirty = true;
    if (this.painting) { this.needsPaint = true; return; }
    try {
      if (!this.visible()) { this.needsPaint = true; this.clearFirstPaintTimer(); return; }
      // Une modification du DOM pendant paint n'entre que dans le snapshot
      // suivant. En cas de reflow, attendre ce paint plutôt que lire l'ancien.
      if (this.syncSize()) { this.requestPaint(); return; }
      this.painting = true;
      this.needsPaint = false;
      void checkedGpu(this.device, () => {
        this.ensureTexture();
        if (this.sourceDirty) {
          (this.device.queue as DrawQueue).drawElementImageToTexture!(
            { source: this.card },
            { texture: this.texture!, size: { width: this.canvas.width, height: this.canvas.height } },
          );
          this.sourceDirty = false;
        }
        const e = settings.explore;
        const raw = this.protectedInteraction() || (e.active && !EXPLORE_EFFECTS[e.mode]?.htmlSafe);
        this.updateActivity();
        this.floats.set([this.cssWidth, this.cssHeight, getExploreTime(), e.scale,
          e.amount, e.split, Number(e.compare), Number(raw), e.x, e.y]);
        this.ints[10] = e.mode;
        this.ints[11] = Number(e.active);
        this.device.queue.writeBuffer(this.uniform!, 0, this.data);
        const encoder = this.device.createCommandEncoder({ label: "PLI · carte HTML" });
        const pass = encoder.beginRenderPass({
          colorAttachments: [{ view: this.context!.getCurrentTexture().createView(),
            loadOp: "clear", storeOp: "store", clearValue: [0.937, 0.933, 0.91, 1] }],
        });
        pass.setPipeline(this.pipeline!);
        pass.setBindGroup(0, this.bind!);
        pass.draw(3);
        pass.end();
        this.device.queue.submit([encoder.finish()]);
        // Le border-box est dessiné à plat dans le même rectangle CSS.
        // Le DPR concerne le bitmap ; la géométrie DOM reste en pixels CSS.
        this.canvas.updateElementGeometry!(this.card, { canvasTransform: { a: 1, d: 1 } });
      }).then(() => {
        this.painting = false;
        if (!this.current()) return;
        this.hasPainted = true;
        this.clearFirstPaintTimer();
        this.updateActivity();
        this.announce();
        if (this.needsPaint || this.animated()) this.requestPaint();
      }).catch((error: unknown) => this.fail(error));
    } catch (error) { this.fail(error); }
  }

  private fail(error: unknown): void {
    if (!this.current()) return;
    console.warn("[pli] HTML-in-Canvas : retour à la carte HTML", error);
    this.status("La capture HTML n’est pas disponible ici ; la carte reste du HTML ordinaire, avec son texte et son bouton.");
    this.dispose();
    if (active === this) active = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    delete this.host.dataset.hicActive;
    this.clearFirstPaintTimer();
    for (const cleanup of this.cleanups.splice(0)) {
      try { cleanup(); } catch { /* Continuer le nettoyage des autres ressources. */ }
    }
    try { if (this.mounted) this.canvas.clearElementGeometry?.(this.card); } catch { /* Device ou API déjà indisponible. */ }
    this.moveCard(() => {
      if (this.marker.parentNode) this.marker.replaceWith(this.card);
      else if (this.card.parentNode === this.canvas) this.canvas.before(this.card);
      if (this.originalWidth) this.card.style.setProperty("width", this.originalWidth, this.originalWidthPriority);
      else this.card.style.removeProperty("width");
      if (this.originalDrawable === null) this.card.removeAttribute("drawable");
      else this.card.setAttribute("drawable", this.originalDrawable);
      this.canvas.remove();
    });
    this.mounted = false;
    try { this.context?.unconfigure(); } catch { /* Un device perdu ne doit pas empêcher le retour au DOM. */ }
    try { this.texture?.destroy(); } catch { /* Device déjà perdu. */ }
    try { this.uniform?.destroy(); } catch { /* Device déjà perdu. */ }
    this.texture = null;
    this.uniform = null;
    this.bind = null;
    this.pipeline = null;
  }
}

export function setupHtmlInCanvas(device: GPUDevice | null): void {
  active?.dispose();
  active = null;
  const host = document.querySelector<HTMLElement>("[data-hic]");
  const card = host?.querySelector<HTMLElement>("[data-hic-card]");
  const out = host?.querySelector("[data-readout='hic']") ?? document.querySelector("[data-readout='hic']");
  if (!host || !card || !out) return;
  delete host.dataset.hicActive;
  if (!device) {
    out.textContent = "WebGPU est désactivé : la carte garde son texte et son bouton en HTML ordinaire.";
    return;
  }
  if (!supportsHtmlInCanvas(device.queue)) {
    out.textContent = "HTML-in-Canvas n’est pas exposé par ce navigateur. Cette API expérimentale demande une prise en charge spécifique ; la carte reste du HTML ordinaire.";
    return;
  }
  try {
    active = new HtmlCard(device, host, card, out);
    void active.start();
  } catch (error) {
    console.warn("[pli] HTML-in-Canvas : préparation indisponible", error);
    active?.dispose();
    active = null;
    out.textContent = "La capture HTML n’est pas disponible ici ; la carte reste du HTML ordinaire, avec son texte et son bouton.";
  }
}
