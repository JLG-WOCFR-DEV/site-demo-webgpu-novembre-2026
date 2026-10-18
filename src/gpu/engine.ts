import { motion, pointer, settings } from "../state.ts";
import { TIMED } from "./chain.ts";
import { coverUV, ImageLayer } from "./images.ts";
import { ELEM_STRIDE, GLYPH_STRIDE, TextLayer } from "./text.ts";
import { BLOOM, BOXES, COMPOSITE, GLYPH, MAX_STAGES, PLANE } from "./wgsl.ts";

export type Timings = { ms: number[]; total: number; gpu: boolean; cpu: number; fps: number };

export type EngineHooks = {
  onTimings?: (t: Timings) => void;
  onLayout?: (info: { glyphs: number; atlas: number; textures: number }) => void;
  onLost?: (reason: string) => void;
};

const PAPER = [0.937, 0.933, 0.91] as const;
const SCENE_FORMAT: GPUTextureFormat = "rgba16float";
const PLANE_STRIDE = 256;
const MAX_PLANES = 16;
const BLOOM_LEVELS = 5;
const MAX_BOXES = 512;
const STAGE_KIND: Record<string, number> = { hero: 1, trame: 2 };

const premul: GPUBlendState = {
  color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
};
const additive: GPUBlendState = {
  color: { srcFactor: "one", dstFactor: "one", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
};

export async function createEngine(canvas: HTMLCanvasElement, hooks: EngineHooks = {}) {
  if (!navigator.gpu) throw new Error("WebGPU absent de ce navigateur");
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("Aucun adaptateur WebGPU");
  const canTime = adapter.features.has("timestamp-query");
  const device = await adapter.requestDevice({ requiredFeatures: canTime ? ["timestamp-query"] : [] });

  let destroyed = false;
  // Installé dès l'obtention du device : une perte pendant l'initialisation
  // est traitée comme les autres.
  void device.lost.then((info) => {
    if (destroyed || info.reason === "destroyed") return;
    hooks.onLost?.(info.message || "perte du device");
  });

  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("Contexte webgpu indisponible");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  device.pushErrorScope("validation");

  /* ───── Layouts ───── */
  const frameLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }],
  });
  const planeLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: 64 },
      },
    ],
  });
  const texLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });
  const glyphLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });
  const boxLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } }],
  });
  const bloomLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });
  const postLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });

  /* ───── Pipelines ───── */
  const planeMod = device.createShaderModule({ label: "plane", code: PLANE });
  const glyphMod = device.createShaderModule({ label: "glyph", code: GLYPH });
  const boxMod = device.createShaderModule({ label: "boxes", code: BOXES });
  const bloomMod = device.createShaderModule({ label: "bloom", code: BLOOM });
  const postMod = device.createShaderModule({ label: "composite", code: COMPOSITE });
  for (const m of [planeMod, glyphMod, boxMod, bloomMod, postMod]) {
    const info = await m.getCompilationInfo();
    const errors = info.messages.filter((x) => x.type === "error");
    if (errors.length) throw new Error(`WGSL ${m.label}: ${errors.map((e) => `${e.lineNum}:${e.message}`).join(" | ")}`);
  }

  const planePipeLayout = device.createPipelineLayout({ bindGroupLayouts: [frameLayout, planeLayout, texLayout] });
  const strip: GPUPrimitiveState = { topology: "triangle-strip" };
  const shadowPipe = device.createRenderPipeline({
    label: "shadow",
    layout: planePipeLayout,
    vertex: { module: planeMod, entryPoint: "vs_shadow" },
    fragment: { module: planeMod, entryPoint: "fs_shadow", targets: [{ format: SCENE_FORMAT, blend: premul }] },
    primitive: strip,
  });
  const planePipe = device.createRenderPipeline({
    label: "plane",
    layout: planePipeLayout,
    vertex: { module: planeMod, entryPoint: "vs_plane" },
    fragment: { module: planeMod, entryPoint: "fs_plane", targets: [{ format: SCENE_FORMAT, blend: premul }] },
    primitive: strip,
  });
  const glyphPipe = device.createRenderPipeline({
    label: "glyphs",
    layout: device.createPipelineLayout({ bindGroupLayouts: [frameLayout, glyphLayout] }),
    vertex: { module: glyphMod, entryPoint: "vs" },
    fragment: { module: glyphMod, entryPoint: "fs", targets: [{ format: SCENE_FORMAT, blend: premul }] },
    primitive: strip,
  });
  const boxPipe = device.createRenderPipeline({
    label: "boxes",
    layout: device.createPipelineLayout({ bindGroupLayouts: [frameLayout, boxLayout] }),
    vertex: { module: boxMod, entryPoint: "vs" },
    fragment: { module: boxMod, entryPoint: "fs", targets: [{ format, blend: premul }] },
    primitive: strip,
  });
  const bloomPipeLayout = device.createPipelineLayout({ bindGroupLayouts: [bloomLayout] });
  const bloomPipe = (entry: string, blend?: GPUBlendState) =>
    device.createRenderPipeline({
      label: entry,
      layout: bloomPipeLayout,
      vertex: { module: bloomMod, entryPoint: "vs" },
      fragment: { module: bloomMod, entryPoint: entry, targets: [{ format: SCENE_FORMAT, blend }] },
      primitive: { topology: "triangle-list" },
    });
  const prePipe = bloomPipe("fs_prefilter");
  const downPipe = bloomPipe("fs_down");
  const upPipe = bloomPipe("fs_up", additive);
  const postPipe = device.createRenderPipeline({
    label: "composite",
    layout: device.createPipelineLayout({ bindGroupLayouts: [postLayout] }),
    vertex: { module: postMod, entryPoint: "vs" },
    fragment: { module: postMod, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });

  const validation = await device.popErrorScope();
  if (validation) throw new Error(`Validation : ${validation.message}`);

  /* ───── Ressources ───── */
  const linear = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    maxAnisotropy: 8,
  });
  const frameBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const frameBind = device.createBindGroup({ layout: frameLayout, entries: [{ binding: 0, resource: { buffer: frameBuf } }] });
  const planeBuf = device.createBuffer({
    size: PLANE_STRIDE * MAX_PLANES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const planeBind = device.createBindGroup({
    layout: planeLayout,
    entries: [{ binding: 0, resource: { buffer: planeBuf, size: 64 } }],
  });
  const boxBuf = device.createBuffer({ size: 32 * MAX_BOXES, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const boxBind = device.createBindGroup({ layout: boxLayout, entries: [{ binding: 0, resource: { buffer: boxBuf } }] });
  const postBuf = device.createBuffer({
    size: 16 * (6 + MAX_STAGES + MAX_STAGES / 4),
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const text = new TextLayer(device);
  const images = new ImageLayer(device, texLayout, linear);
  const atlasBind = images.bindFor(text.texture);

  let glyphBuf: GPUBuffer | null = null;
  let elemBuf: GPUBuffer | null = null;
  let glyphBind: GPUBindGroup | null = null;

  const relayout = (dpr: number) => {
    text.layout(dpr);
    const gsize = Math.max(GLYPH_STRIDE, text.glyphCount * GLYPH_STRIDE);
    if (!glyphBuf || glyphBuf.size < gsize) {
      glyphBuf?.destroy();
      glyphBuf = device.createBuffer({ size: gsize * 1.25, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      glyphBind = null;
    }
    device.queue.writeBuffer(glyphBuf, 0, text.glyphData);
    const esize = Math.max(ELEM_STRIDE, text.elems.length * ELEM_STRIDE);
    if (!elemBuf || elemBuf.size < esize) {
      elemBuf?.destroy();
      elemBuf = device.createBuffer({ size: esize * 2, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      glyphBind = null;
    }
    if (!glyphBind) {
      glyphBind = device.createBindGroup({
        layout: glyphLayout,
        entries: [
          { binding: 0, resource: { buffer: glyphBuf } },
          { binding: 1, resource: { buffer: elemBuf } },
          { binding: 2, resource: linear },
          { binding: 3, resource: text.texture.createView() },
        ],
      });
    }
    hooks.onLayout?.({ glyphs: text.glyphCount, atlas: text.atlasGlyphs, textures: images.bytes });
  };

  /* ───── Cibles dépendantes de la taille ───── */
  let pw = 0;
  let ph = 0;
  let scene: GPUTexture | null = null;
  let bloomTex: GPUTexture | null = null;
  let postBind: GPUBindGroup | null = null;
  type BloomStep = { pipe: GPURenderPipeline; bind: GPUBindGroup; view: GPUTextureView; load: GPULoadOp };
  let bloomSteps: { pre: BloomStep; down: BloomStep[]; up: BloomStep[] } | null = null;
  const bloomUBufs: GPUBuffer[] = [];

  const resizeTargets = (w: number, h: number) => {
    pw = w;
    ph = h;
    scene?.destroy();
    bloomTex?.destroy();
    scene = device.createTexture({
      label: "scene",
      size: [w, h],
      format: SCENE_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const bw = Math.max(1, w >> 1);
    const bh = Math.max(1, h >> 1);
    const levels = Math.min(BLOOM_LEVELS, Math.floor(Math.log2(Math.min(bw, bh))) + 1);
    bloomTex = device.createTexture({
      label: "bloom",
      size: [bw, bh],
      format: SCENE_FORMAT,
      mipLevelCount: levels,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const level = (i: number) => bloomTex!.createView({ baseMipLevel: i, mipLevelCount: 1 });
    let ui = 0;
    const ubuf = (texelW: number, texelH: number) => {
      let b = bloomUBufs[ui];
      if (!b) {
        b = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        bloomUBufs[ui] = b;
      }
      ui++;
      device.queue.writeBuffer(b, 0, new Float32Array([texelW, texelH, 0, 0]));
      return b;
    };
    const step = (pipe: GPURenderPipeline, src: GPUTextureView, sw: number, sh: number, dst: GPUTextureView, load: GPULoadOp): BloomStep => ({
      pipe,
      view: dst,
      load,
      bind: device.createBindGroup({
        layout: bloomLayout,
        entries: [
          { binding: 0, resource: { buffer: ubuf(1 / sw, 1 / sh) } },
          { binding: 1, resource: linear },
          { binding: 2, resource: src },
        ],
      }),
    });
    const sizeAt = (i: number) => [Math.max(1, bw >> i), Math.max(1, bh >> i)] as const;
    const pre = step(prePipe, scene.createView(), w, h, level(0), "clear");
    const down: BloomStep[] = [];
    for (let i = 1; i < levels; i++) {
      const [sw, sh] = sizeAt(i - 1);
      down.push(step(downPipe, level(i - 1), sw, sh, level(i), "clear"));
    }
    const up: BloomStep[] = [];
    for (let i = levels - 2; i >= 0; i--) {
      const [sw, sh] = sizeAt(i + 1);
      up.push(step(upPipe, level(i + 1), sw, sh, level(i), "load"));
    }
    bloomSteps = { pre, down, up };
    postBind = device.createBindGroup({
      layout: postLayout,
      entries: [
        { binding: 0, resource: { buffer: postBuf } },
        { binding: 1, resource: linear },
        { binding: 2, resource: scene.createView() },
        { binding: 3, resource: bloomTex.createView({ baseMipLevel: 0, mipLevelCount: 1 }) },
      ],
    });
  };

  /* ───── Horodatages GPU ───── */
  const groups = TIMED.length;
  const querySet = canTime ? device.createQuerySet({ type: "timestamp", count: groups * 2 }) : null;
  const resolveBuf = canTime
    ? device.createBuffer({ size: groups * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC })
    : null;
  const readBufs: { buf: GPUBuffer; busy: boolean }[] = canTime
    ? [0, 1, 2].map(() => ({
        buf: device.createBuffer({ size: groups * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
        busy: false,
      }))
    : [];
  const avg = new Array<number>(groups).fill(0);
  let cpuAvg = 0;
  const ts = (group: number, edge: "start" | "end" | "both"): GPURenderPassTimestampWrites | undefined => {
    if (!querySet) return undefined;
    const w: GPURenderPassTimestampWrites = { querySet };
    if (edge !== "end") w.beginningOfPassWriteIndex = group * 2;
    if (edge !== "start") w.endOfPassWriteIndex = group * 2 + 1;
    return w;
  };

  /* ───── Boucle ───── */
  const frameData = new Float32Array(16);
  const planeData = new Float32Array((PLANE_STRIDE * MAX_PLANES) / 4);
  const postData = new Float32Array(4 * (6 + MAX_STAGES + MAX_STAGES / 4));
  const boxData = new Float32Array(8 * MAX_BOXES);
  let elemData = new Float32Array(0);
  let dpr = 1;
  let raf = 0;
  let paused = false;
  let needLayout = true;
  let fpsCount = 0;
  let fpsT = performance.now();
  let fps = 0;
  const t0 = performance.now();
  let lastTimings = 0;
  let lastScroll = scrollY;
  let velocity = 0;
  let lastNow = performance.now();

  const stages = () => [...document.querySelectorAll<HTMLElement>("[data-gl-stage]")];

  const frame = () => {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (paused) return;
    const cpuStart = performance.now();
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW < 2 || cssH < 2) return;
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cssW * nextDpr);
    const h = Math.round(cssH * nextDpr);
    if (canvas.width !== w || canvas.height !== h || nextDpr !== dpr) {
      canvas.width = w;
      canvas.height = h;
      dpr = nextDpr;
      resizeTargets(w, h);
      needLayout = true;
    }
    if (needLayout) {
      needLayout = false;
      relayout(dpr);
    }
    const now = performance.now();
    const time = (now - t0) / 1000;
    const reduced = motion.reduced;
    // Vitesse de défilement : les plaques glissent quand le papier court.
    // Un saut (ancre, sommaire) n'est pas un geste : on l'ignore.
    const dy = scrollY - lastScroll;
    lastScroll = scrollY;
    const dt = Math.min(0.1, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    const v = Math.abs(dy) > 600 ? 0 : dy / dt; // px/s
    velocity += (v - velocity) * (1 - Math.exp(-dt * 10));
    const slip = reduced ? 0 : Math.max(-1, Math.min(1, velocity / 4000));

    /* Frame uniforms */
    frameData.set([cssW, cssH, dpr, reduced ? 0 : time]);
    frameData.set([pointer.x, pointer.y, pointer.inside ? 1 : 0, reduced ? 1 : 0], 4);
    frameData.set([settings.glyph.wave, settings.glyph.ink, settings.glyph.scatter, settings.dom.boxes ? 1 : 0], 8);
    frameData.set([2048, 1.6, PAPER[0], 0], 12);
    device.queue.writeBuffer(frameBuf, 0, frameData);

    /* Éléments de texte : seule la boîte de l'élément est relue. */
    const elems = text.elems;
    if (elemData.length < elems.length * 8) elemData = new Float32Array(elems.length * 8);
    const boxes: number[] = [];
    elems.forEach((e, i) => {
      const r = e.el.getBoundingClientRect();
      if (e.revealStart < 0 && r.top < cssH * 0.92 && r.bottom > 0) e.revealStart = now;
      const dur = e.fx === 1 ? 1500 : 900;
      const reveal = reduced ? 1 : e.revealStart < 0 ? 0 : Math.min(1, (now - e.revealStart) / dur);
      const hideSpecimen = e.fx === 2 && settings.glyph.atlas;
      elemData.set([r.left, r.top, ease(reveal), e.fx, e.count, hideSpecimen ? 0 : 1, 0, 0], i * 8);
      if (settings.dom.boxes && r.bottom > 0 && r.top < cssH) boxes.push(r.left, r.top, r.width, r.height, 0, 0.627, 0.863, 0.9);
    });
    if (elemBuf && elems.length) device.queue.writeBuffer(elemBuf, 0, elemData, 0, elems.length * 8);

    /* Plans */
    type Job = { offset: number; bind: GPUBindGroup; shadow: boolean };
    const jobs: Job[] = [];
    let slot = 0;
    const pushPlane = (rect: DOMRect, uv: readonly number[], params: number[], flags: number[], bind: GPUBindGroup, shadow: boolean) => {
      if (slot >= MAX_PLANES) return;
      const o = (slot * PLANE_STRIDE) / 4;
      planeData.set([rect.left, rect.top, rect.width, rect.height], o);
      planeData.set(uv, o + 4);
      planeData.set(params, o + 8);
      planeData.set(flags, o + 12);
      jobs.push({ offset: slot * PLANE_STRIDE, bind, shadow });
      slot++;
    };
    for (const p of images.plates) {
      const r = p.img.getBoundingClientRect();
      const visible = r.bottom > -80 && r.top < cssH + 80 && r.width > 0;
      const over = pointer.inside && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
      p.hover += ((over ? 1 : 0) - p.hover) * (reduced ? 1 : 0.12);
      if (settings.dom.boxes && visible) boxes.push(r.left, r.top, r.width, r.height, 0.894, 0, 0.486, 0.95);
      if (!visible || !p.bind) continue;
      const q = settings.quad;
      const radius = p.quad ? q.radius : p.radius;
      const shadow = p.quad ? q.shadow : 0.32;
      const lift = p.quad ? q.lift : 0.15;
      pushPlane(r, coverUV(r.width, r.height, p.width, p.height), [radius, shadow, lift, 1], [p.quad && q.wire ? 1 : 0, 0, p.hover, 1.6], p.bind, shadow > 0.01);
    }

    /* Plaques de démonstration */
    const stageEls = stages();
    postData.fill(0);
    let si = 0;
    for (const s of stageEls) {
      const r = s.getBoundingClientRect();
      const kind = STAGE_KIND[s.dataset.glStage ?? ""] ?? 0;
      if (settings.dom.boxes && r.bottom > 0 && r.top < cssH) boxes.push(r.left - 6, r.top - 6, r.width + 12, r.height + 12, 0.07, 0.07, 0.07, 0.7);
      if (s.dataset.glStage === "glyph" && settings.glyph.atlas && r.bottom > 0 && r.top < cssH) {
        // Seule la bande occupée de l'atlas, à l'échelle de la plaque.
        const used = Math.max(0.05, text.atlasUsed);
        const aw = r.width - 24;
        const ah = Math.min(r.height - 24, aw * used);
        const a = new DOMRect(r.left + 12, r.top + 12, aw, ah);
        pushPlane(a, [0, 0, 1, (ah / aw)], [2, 0, 0, 1], [0, 1, 0, 0], atlasBind, false);
      }
      if (si < MAX_STAGES && kind > 0 && r.bottom > 0 && r.top < cssH) {
        postData.set([r.left * dpr, r.top * dpr, r.width * dpr, r.height * dpr], 24 + si * 4);
        postData[24 + MAX_STAGES * 4 + si] = kind;
        si++;
      }
    }
    if (slot) device.queue.writeBuffer(planeBuf, 0, planeData, 0, (slot * PLANE_STRIDE) / 4);

    const c = settings.chain;
    const L = settings.light;
    const T = settings.trame;
    const splitX = (pointer.inside ? pointer.x : cssW / 2) * dpr;
    postData.set([w, h, dpr, reduced ? 0 : time], 0);
    postData.set([pointer.x * dpr, pointer.y * dpr, pointer.inside && !reduced ? 1 : 0, reduced ? 1 : 0], 4);
    postData.set([c.distort ? 1 : 0, c.rgb ? 1 : 0, c.trame ? 1 : 0, c.bloom ? 1 : 0], 8);
    postData.set([c.grain ? 1 : 0, c.split ? 1 : 0, splitX, L.bloom], 12);
    postData.set([T.cell, T.gain, T.misreg, T.mix], 16);
    postData.set([PAPER[0], PAPER[1], PAPER[2], slip], 20);
    device.queue.writeBuffer(postBuf, 0, postData);

    const nBoxes = Math.min(MAX_BOXES, boxes.length / 8);
    if (nBoxes) {
      boxData.set(boxes.slice(0, nBoxes * 8));
      device.queue.writeBuffer(boxBuf, 0, boxData, 0, nBoxes * 8);
    }

    // Seuil : juste au-dessus du papier, ou le défaut naïf pour comparaison.
    const thresh = L.naive ? [0.62, 0.0001] : [PAPER[0] + L.threshold, 0.02];
    for (const b of bloomUBufs.slice(0, 1)) device.queue.writeBuffer(b, 16, new Float32Array(thresh));

    /* Encodage */
    const enc = device.createCommandEncoder({ label: "frame" });
    const scenePass = enc.beginRenderPass({
      label: "scene",
      colorAttachments: [
        { view: scene!.createView(), loadOp: "clear", storeOp: "store", clearValue: [PAPER[0], PAPER[1], PAPER[2], 1] },
      ],
      timestampWrites: ts(0, "both"),
    });
    scenePass.setBindGroup(0, frameBind);
    for (const j of jobs) {
      scenePass.setBindGroup(1, planeBind, [j.offset]);
      scenePass.setBindGroup(2, j.bind);
      if (j.shadow) {
        scenePass.setPipeline(shadowPipe);
        scenePass.draw(4);
      }
      scenePass.setPipeline(planePipe);
      scenePass.draw(4);
    }
    if (glyphBind && text.glyphCount) {
      scenePass.setPipeline(glyphPipe);
      scenePass.setBindGroup(1, glyphBind);
      scenePass.draw(4, text.glyphCount);
    }
    scenePass.end();

    const runStep = (s: BloomStep, group: number, edge: "start" | "end" | "both" | "none") =>
      (() => {
        const p = enc.beginRenderPass({
          colorAttachments: [{ view: s.view, loadOp: s.load, storeOp: "store", clearValue: [0, 0, 0, 1] }],
          timestampWrites: edge === "none" ? undefined : ts(group, edge),
        });
        p.setPipeline(s.pipe);
        p.setBindGroup(0, s.bind);
        p.draw(3);
        p.end();
      })();

    if (c.bloom && bloomSteps) {
      runStep(bloomSteps.pre, 1, "both");
      bloomSteps.down.forEach((s, i, a) =>
        runStep(s, 2, a.length === 1 ? "both" : i === 0 ? "start" : i === a.length - 1 ? "end" : "none"),
      );
      bloomSteps.up.forEach((s, i, a) =>
        runStep(s, 3, a.length === 1 ? "both" : i === 0 ? "start" : i === a.length - 1 ? "end" : "none"),
      );
    }

    const out = context.getCurrentTexture().createView();
    const post = enc.beginRenderPass({
      label: "composite",
      colorAttachments: [{ view: out, loadOp: "clear", storeOp: "store", clearValue: [PAPER[0], PAPER[1], PAPER[2], 1] }],
      timestampWrites: ts(4, "both"),
    });
    post.setPipeline(postPipe);
    post.setBindGroup(0, postBind!);
    post.draw(3);
    if (nBoxes) {
      post.setPipeline(boxPipe);
      post.setBindGroup(0, frameBind);
      post.setBindGroup(1, boxBind);
      post.draw(4, nBoxes);
    }
    post.end();

    let reader: (typeof readBufs)[number] | undefined;
    if (querySet && resolveBuf) {
      reader = readBufs.find((r) => !r.busy);
      if (reader) {
        enc.resolveQuerySet(querySet, 0, groups * 2, resolveBuf, 0);
        enc.copyBufferToBuffer(resolveBuf, 0, reader.buf, 0, groups * 16);
      }
    }
    device.queue.submit([enc.finish()]);

    if (reader) {
      const r = reader;
      r.busy = true;
      r.buf
        .mapAsync(GPUMapMode.READ)
        .then(() => {
          const v = new BigInt64Array(r.buf.getMappedRange());
          for (let g = 0; g < groups; g++) {
            const d = Number(v[g * 2 + 1]! - v[g * 2]!) / 1e6;
            const valid = Number.isFinite(d) && d >= 0 && d < 1000;
            const skipped = !c.bloom && g >= 1 && g <= 3;
            avg[g] = skipped ? 0 : valid ? avg[g]! * 0.9 + d * 0.1 : avg[g]!;
          }
          r.buf.unmap();
          r.busy = false;
        })
        .catch(() => {
          r.busy = false;
        });
    }

    cpuAvg = cpuAvg * 0.9 + (performance.now() - cpuStart) * 0.1;
    fpsCount++;
    if (now - fpsT > 1000) {
      fps = (fpsCount * 1000) / (now - fpsT);
      fpsCount = 0;
      fpsT = now;
    }
    if (now - lastTimings > 400) {
      lastTimings = now;
      hooks.onTimings?.({ ms: [...avg], total: avg.reduce((a, b) => a + b, 0), gpu: canTime, cpu: cpuAvg, fps });
    }
  };

  images.collect();
  raf = requestAnimationFrame(frame);

  return {
    device,
    canTime,
    relayout: () => {
      needLayout = true;
    },
    pause: (v: boolean) => {
      paused = v;
    },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      images.destroy();
      text.texture.destroy();
      scene?.destroy();
      bloomTex?.destroy();
      device.destroy();
    },
  };
}

export type Engine = Awaited<ReturnType<typeof createEngine>>;

function ease(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
