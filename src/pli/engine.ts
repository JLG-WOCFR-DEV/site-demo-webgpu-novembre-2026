import { layoutPage, type Measure, type World } from "@/pli/content";
import { getRaster, rasterKey, retainRasters } from "@/pli/raster";
import { createStage, type Placed } from "@/pli/stage";

export type FrameInfo = {
  scroll: number;
  max: number;
  mode: "webgpu" | "canvas";
};

export type EngineHandle = {
  mode: "webgpu" | "canvas";
  destroy: () => void;
  pick: (x: number, y: number) => string | null;
  addScroll: (dy: number) => void;
};

const PAPER_RGB = [0.953, 0.945, 0.925, 1] as const;

const LAYER_VS = /* wgsl */ `
struct VsOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) px: vec2<f32>,
};
struct Uni {
  resolution: vec4<f32>,
  origin_size: vec4<f32>,
  rect: vec4<f32>,
  params: vec4<f32>,
  extra: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  var c = vec2<f32>(0.0, 0.0);
  if (vi == 1u) { c = vec2<f32>(1.0, 0.0); }
  else if (vi == 2u) { c = vec2<f32>(0.0, 1.0); }
  else if (vi == 3u) { c = vec2<f32>(1.0, 1.0); }
  let p = u.origin_size.xy + c * u.origin_size.zw;
  let ndc = vec2<f32>(p.x / u.resolution.x * 2.0 - 1.0, 1.0 - p.y / u.resolution.y * 2.0);
  var o: VsOut;
  o.clip = vec4<f32>(ndc, 0.0, 1.0);
  o.px = p;
  return o;
}

fn sd_round_box(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
  let q = abs(p) - b + vec2<f32>(r, r);
  return length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0) - r;
}
`;

const SHADOW_FS = /* wgsl */ `
@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let half = u.rect.zw * 0.5;
  let center = u.rect.xy + half + vec2<f32>(0.0, u.extra.x);
  let radius = min(u.params.x, min(half.x, half.y));
  let d = sd_round_box(in.px - center, half, radius);
  let spread = max(u.params.y, 1.0);
  let sh = 1.0 - smoothstep(0.0, spread, d);
  return vec4<f32>(0.10, 0.08, 0.07, sh * u.params.z);
}
`;

const CONTENT_FS = /* wgsl */ `
@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var tex: texture_2d<f32>;

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let half = max(u.rect.zw * 0.5, vec2<f32>(0.5));
  let center = u.rect.xy + u.rect.zw * 0.5;
  let radius = min(u.params.x, min(half.x, half.y));
  let d = sd_round_box(in.px - center, half, radius);
  let aa = max(fwidth(d), 0.75);
  let fill = 1.0 - smoothstep(-aa, aa, d);
  let uv = (in.px - u.rect.xy) / max(u.rect.zw, vec2<f32>(1.0));
  let col = textureSample(tex, samp, clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0)));
  let a = col.a * fill * u.params.w;
  if (a < 0.004) { discard; }
  return vec4<f32>(col.rgb, a);
}
`;

const POST = /* wgsl */ `
struct VsOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) uv: vec2<f32>,
};
struct PostU {
  resolution: vec4<f32>,
  fx: vec4<f32>,
  fx2: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: PostU;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var scene_tex: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  var p = vec2<f32>(-1.0, -1.0);
  if (vi == 1u) { p = vec2<f32>(3.0, -1.0); }
  else if (vi == 2u) { p = vec2<f32>(-1.0, 3.0); }
  var o: VsOut;
  o.clip = vec4<f32>(p, 0.0, 1.0);
  o.uv = vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return o;
}

fn grade(p: vec2<f32>) -> vec3<f32> {
  let off = u.fx.y * 0.014;
  let c0 = clamp(p, vec2<f32>(0.0), vec2<f32>(1.0));
  return vec3<f32>(
    textureSample(scene_tex, samp, clamp(p + vec2<f32>(off, 0.0), vec2<f32>(0.0), vec2<f32>(1.0))).r,
    textureSample(scene_tex, samp, c0).g,
    textureSample(scene_tex, samp, clamp(p - vec2<f32>(off, 0.0), vec2<f32>(0.0), vec2<f32>(1.0))).b,
  );
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let res = max(u.resolution.xy, vec2<f32>(1.0));
  var uv = in.uv;
  let raw = textureSample(scene_tex, samp, clamp(in.uv, vec2<f32>(0.0), vec2<f32>(1.0))).rgb;

  let wave = vec2<f32>(
    sin(uv.y * 18.0 + u.resolution.z),
    cos(uv.x * 14.0 - u.resolution.z * 0.7),
  );
  uv = uv + wave * u.fx.x * 0.012;

  let block = mix(1.0, 28.0, clamp(u.fx.z, 0.0, 1.0));
  let step_uv = max(block, 1.0) / res;
  uv = (floor(uv / step_uv) + 0.5) * step_uv;

  var col = grade(uv);
  let blur = u.fx.w;
  if (blur > 0.001) {
    let r = blur * 7.0 / res;
    var acc = col;
    acc = acc + grade(uv + vec2<f32>(r.x, 0.0));
    acc = acc + grade(uv - vec2<f32>(r.x, 0.0));
    acc = acc + grade(uv + vec2<f32>(0.0, r.y));
    acc = acc + grade(uv - vec2<f32>(0.0, r.y));
    acc = acc + grade(uv + r);
    acc = acc + grade(uv - r);
    acc = acc + grade(uv + vec2<f32>(r.x, -r.y));
    acc = acc + grade(uv + vec2<f32>(-r.x, r.y));
    col = acc / 9.0;
  }

  let glow = max(col - vec3<f32>(0.62), vec3<f32>(0.0)) * u.fx2.x * 1.7;
  col = col + glow;

  let n = fract(sin(dot(in.uv * res + vec2<f32>(u.resolution.z * 13.0, u.resolution.z * 7.0), vec2<f32>(127.1, 311.7))) * 43758.5453);
  col = col + (n - 0.5) * u.fx2.y * 0.22;

  if (u.resolution.w > 0.5 && in.uv.x < 0.5) {
    col = raw;
  }
  let hair = 1.25 / res.x;
  if (u.resolution.w > 0.5 && abs(in.uv.x - 0.5) < hair) {
    col = vec3<f32>(0.08, 0.08, 0.08);
  }
  return vec4<f32>(col, 1.0);
}
`;

const STRIDE = 256;
const MAX_LAYERS = 48;

function blend(): GPUBlendState {
  return {
    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
  };
}

async function shaderOk(module: GPUShaderModule) {
  const info = await module.getCompilationInfo();
  return !info.messages.some((m) => m.type === "error");
}

export async function createEngine(
  canvas: HTMLCanvasElement,
  getWorld: () => World,
  onFrame: (info: FrameInfo) => void,
): Promise<EngineHandle> {
  await Promise.race([
    (async () => {
      await document.fonts.load("700 64px Archivo");
      await document.fonts.load("500 16px Archivo");
      await document.fonts.load("400 16px Archivo");
      await document.fonts.ready;
    })(),
    new Promise((resolve) => setTimeout(resolve, 1800)),
  ]);

  const gpu = await tryWebGPU(canvas, getWorld, onFrame).catch(() => null);
  if (gpu) return gpu;
  return startCanvas(canvas, getWorld, onFrame);
}

async function tryWebGPU(
  canvas: HTMLCanvasElement,
  getWorld: () => World,
  onFrame: (info: FrameInfo) => void,
): Promise<EngineHandle | null> {
  const nav = navigator as Navigator & { gpu?: GPU };
  if (!nav.gpu) return null;
  let adapter: GPUAdapter | null = null;
  try {
    adapter = await nav.gpu.requestAdapter({ powerPreference: "high-performance" });
  } catch {
    return null;
  }
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const shadowMod = device.createShaderModule({
    label: "shadow",
    code: `${LAYER_VS}\n${SHADOW_FS}`,
  });
  const contentMod = device.createShaderModule({
    label: "content",
    code: `${LAYER_VS}\n${CONTENT_FS}`,
  });
  const postMod = device.createShaderModule({ label: "post", code: POST });
  const ok =
    (await shaderOk(shadowMod)) && (await shaderOk(contentMod)) && (await shaderOk(postMod));
  if (!ok) {
    device.destroy();
    return null;
  }

  const context = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!context) {
    device.destroy();
    return null;
  }
  const format = nav.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const uniLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: 80 },
      },
    ],
  });
  const texLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });
  const postLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });

  const shadowPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [uniLayout] }),
    vertex: { module: shadowMod, entryPoint: "vs" },
    fragment: {
      module: shadowMod,
      entryPoint: "fs",
      targets: [{ format: "rgba8unorm", blend: blend() }],
    },
    primitive: { topology: "triangle-strip" },
  });
  const contentPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [uniLayout, texLayout] }),
    vertex: { module: contentMod, entryPoint: "vs" },
    fragment: {
      module: contentMod,
      entryPoint: "fs",
      targets: [{ format: "rgba8unorm", blend: blend() }],
    },
    primitive: { topology: "triangle-strip" },
  });
  const postPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [postLayout] }),
    vertex: { module: postMod, entryPoint: "vs" },
    fragment: { module: postMod, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });

  const uniBuffer = device.createBuffer({
    size: STRIDE * MAX_LAYERS,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const postBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const uniBind = device.createBindGroup({
    layout: uniLayout,
    entries: [{ binding: 0, resource: { buffer: uniBuffer, size: 80 } }],
  });
  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  const slab = new Float32Array((STRIDE * MAX_LAYERS) / 4);
  const postSlab = new Float32Array(16);
  const textTextures = new Map<string, GPUTexture>();
  const textBinds = new Map<string, GPUBindGroup>();
  const imageBits = new Map<string, HTMLImageElement>();
  const imageTextures = new Map<string, GPUTexture>();
  const imageBinds = new Map<string, GPUBindGroup>();
  const loading = new Set<string>();

  let scene: GPUTexture | null = null;
  let sceneW = 0;
  let sceneH = 0;
  let postBind: GPUBindGroup | null = null;
  let alive = true;
  let raf = 0;
  let frameDpr = 1;
  const stage = stageFor(() => frameDpr);

  const uploadRGBA = (width: number, height: number, pixels: Uint8ClampedArray) => {
    const texture = device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const row = width * 4;
    const bytesPerRow = Math.ceil(row / 256) * 256;
    let data: Uint8Array;
    if (bytesPerRow === row) {
      data = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
    } else {
      data = new Uint8Array(bytesPerRow * height);
      for (let y = 0; y < height; y++)
        data.set(pixels.subarray(y * row, (y + 1) * row), y * bytesPerRow);
    }
    device.queue.writeTexture(
      { texture },
      data,
      { bytesPerRow, rowsPerImage: height },
      { width, height },
    );
    return texture;
  };

  const uploadCanvas = (source: HTMLCanvasElement) => {
    const context2d = source.getContext("2d");
    if (!context2d || source.width < 1 || source.height < 1) return null;
    const pixels = context2d.getImageData(0, 0, source.width, source.height);
    return uploadRGBA(source.width, source.height, pixels.data);
  };

  const uploadImage = (img: HTMLImageElement) => {
    const scratch = document.createElement("canvas");
    scratch.width = img.naturalWidth;
    scratch.height = img.naturalHeight;
    const context2d = scratch.getContext("2d", { willReadFrequently: true });
    if (!context2d || scratch.width < 1 || scratch.height < 1) return null;
    context2d.drawImage(img, 0, 0);
    const pixels = context2d.getImageData(0, 0, scratch.width, scratch.height);
    return uploadRGBA(scratch.width, scratch.height, pixels.data);
  };

  const bindFor = (texture: GPUTexture) =>
    device.createBindGroup({
      layout: texLayout,
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView() },
      ],
    });

  const ensureImage = (src: string) => {
    if (imageBits.has(src) || loading.has(src)) return;
    loading.add(src);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      loading.delete(src);
      if (!alive) return;
      imageBits.set(src, img);
      const texture = uploadImage(img);
      if (!texture) return;
      imageTextures.set(src, texture);
      imageBinds.set(src, bindFor(texture));
    };
    img.onerror = () => loading.delete(src);
    img.src = src;
  };

  const ensureScene = (pw: number, ph: number) => {
    if (scene && sceneW === pw && sceneH === ph) return;
    scene?.destroy();
    scene = device.createTexture({
      size: [pw, ph],
      format: "rgba8unorm",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    sceneW = pw;
    sceneH = ph;
    postBind = device.createBindGroup({
      layout: postLayout,
      entries: [
        { binding: 0, resource: { buffer: postBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: scene.createView() },
      ],
    });
  };

  const frame = () => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const world = getWorld();
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW < 2 || cssH < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, cssW < 800 ? 1.5 : 2);
    const pw = Math.max(1, Math.round(cssW * dpr));
    const ph = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      context.configure({ device, format, alphaMode: "opaque" });
    }
    ensureScene(pw, ph);

    frameDpr = dpr;
    const placed = stage.place(world, cssW, cssH);
    checkLayerBudget(placed.layers.length);
    const usedText = new Set<string>();
    let slot = 0;

    const writeSlot = (
      p: Placed,
      spread: number,
      shadowA: number,
      offY: number,
      alpha: number,
      radius: number,
    ) => {
      const o = (slot * STRIDE) / 4;
      const margin = spread + Math.abs(offY) + 2;
      slab[o + 0] = pw;
      slab[o + 1] = ph;
      slab[o + 4] = p.x * dpr - margin;
      slab[o + 5] = p.y * dpr - margin;
      slab[o + 6] = p.w * dpr + margin * 2;
      slab[o + 7] = p.h * dpr + margin * 2;
      slab[o + 8] = p.x * dpr;
      slab[o + 9] = p.y * dpr;
      slab[o + 10] = p.w * dpr;
      slab[o + 11] = p.h * dpr;
      slab[o + 12] = radius;
      slab[o + 13] = Math.max(spread, 1);
      slab[o + 14] = shadowA;
      slab[o + 15] = alpha;
      slab[o + 16] = offY;
      slot += 1;
      return slot - 1;
    };

    type Job = { index: number; bind: GPUBindGroup | null; shadow: boolean };
    const jobs: Job[] = [];

    for (const p of placed.layers) {
      if (slot >= MAX_LAYERS - 1 || p.layer.alpha < 0.01) continue;
      const radius = p.layer.kind === "image" ? world.fx.radius * dpr : 0;
      const spread =
        p.layer.kind === "image" ? (8 + 26 * world.fx.shadow) * dpr * p.layer.shadow : 0;
      const shadowA =
        p.layer.kind === "image" ? 0.2 * world.fx.shadow * p.layer.shadow * p.layer.alpha : 0;
      const offY = 8 * dpr * world.fx.shadow;
      let bind: GPUBindGroup | null = null;
      if (p.layer.kind === "text" && p.layer.text) {
        const raster = getRaster(p.layer.text, dpr);
        const key = rasterKey(p.layer.text, dpr);
        usedText.add(key);
        let texture = textTextures.get(key);
        if (!texture) {
          const uploaded = uploadCanvas(raster.canvas);
          if (!uploaded) continue;
          texture = uploaded;
          textTextures.set(key, texture);
          textBinds.set(key, bindFor(texture));
        }
        bind = textBinds.get(key) ?? null;
        p.w = raster.cssW;
        p.h = raster.cssH;
      } else if (p.layer.src) {
        ensureImage(p.layer.src);
        bind = imageBinds.get(p.layer.src) ?? null;
        if (!bind) continue;
      }
      const index = writeSlot(p, spread, shadowA, offY, p.layer.alpha, radius);
      jobs.push({ index, bind, shadow: shadowA > 0.004 });
    }

    retainRasters(usedText);
    for (const [key, texture] of textTextures) {
      if (!usedText.has(key)) {
        texture.destroy();
        textTextures.delete(key);
        textBinds.delete(key);
      }
    }

    device.queue.writeBuffer(uniBuffer, 0, slab.buffer, slab.byteOffset, slab.byteLength);
    const fx = world.fx;
    postSlab[0] = pw;
    postSlab[1] = ph;
    postSlab[2] = stage.clock;
    postSlab[3] = fx.split ? 1 : 0;
    postSlab[4] = fx.distort;
    postSlab[5] = fx.rgb;
    postSlab[6] = fx.pixel;
    postSlab[7] = fx.blur;
    postSlab[8] = fx.bloom;
    postSlab[9] = fx.grain;
    device.queue.writeBuffer(postBuffer, 0, postSlab.buffer, postSlab.byteOffset, 64);

    const encoder = device.createCommandEncoder();
    const sceneView = scene!.createView();
    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: sceneView,
          clearValue: { r: PAPER_RGB[0], g: PAPER_RGB[1], b: PAPER_RGB[2], a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    for (const job of jobs) {
      const offset = job.index * STRIDE;
      if (job.shadow) {
        scenePass.setPipeline(shadowPipe);
        scenePass.setBindGroup(0, uniBind, [offset]);
        scenePass.draw(4);
      }
      if (job.bind) {
        scenePass.setPipeline(contentPipe);
        scenePass.setBindGroup(0, uniBind, [offset]);
        scenePass.setBindGroup(1, job.bind);
        scenePass.draw(4);
      }
    }
    scenePass.end();

    const canvasView = context.getCurrentTexture().createView();
    const postPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: canvasView,
          clearValue: { r: PAPER_RGB[0], g: PAPER_RGB[1], b: PAPER_RGB[2], a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    if (postBind) {
      postPass.setPipeline(postPipe);
      postPass.setBindGroup(0, postBind);
      postPass.draw(3);
    }
    postPass.end();
    device.queue.submit([encoder.finish()]);
    onFrame({ scroll: stage.scroll, max: stage.max, mode: "webgpu" });
  };

  raf = requestAnimationFrame(frame);

  return {
    mode: "webgpu",
    destroy: () => {
      alive = false;
      cancelAnimationFrame(raf);
      scene?.destroy();
      for (const texture of textTextures.values()) texture.destroy();
      for (const texture of imageTextures.values()) texture.destroy();
      uniBuffer.destroy();
      postBuffer.destroy();
      device.destroy();
    },
    pick: (x, y) => stage.pick(x, y),
    addScroll: (dy) => stage.addScroll(dy, getWorld()),
  };
}

/** Layout de page pour un DPR donné : le raster sert de mesureur de texte. */
function stageFor(getDpr: () => number) {
  const measure: Measure = (style) => getRaster(style, getDpr());
  return createStage({ layout: (page, cssW) => layoutPage(page, cssW, measure) });
}

let warnedLayers = false;
/** Garde-fou dev : au-delà de MAX_LAYERS - 1, des calques ne sont pas dessinés. */
function checkLayerBudget(count: number) {
  if (!import.meta.env.DEV || warnedLayers || count < MAX_LAYERS - 4) return;
  warnedLayers = true;
  console.warn(
    `[pli] ${count} calques placés pour ${MAX_LAYERS - 1} emplacements : au-delà, ils sont ignorés.`,
  );
}

function startCanvas(
  canvas: HTMLCanvasElement,
  getWorld: () => World,
  onFrame: (info: FrameInfo) => void,
): EngineHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      mode: "canvas",
      destroy: () => {},
      pick: () => null,
      addScroll: () => {},
    };
  }
  let frameDpr = 1;
  const stage = stageFor(() => frameDpr);
  const images = new Map<string, HTMLImageElement>();
  const loading = new Set<string>();
  let alive = true;
  let raf = 0;
  const scratch = document.createElement("canvas");
  const sctx = scratch.getContext("2d");

  const ensure = (src: string) => {
    if (images.has(src) || loading.has(src)) return;
    loading.add(src);
    const img = new Image();
    img.onload = () => {
      loading.delete(src);
      images.set(src, img);
    };
    img.onerror = () => loading.delete(src);
    img.src = src;
  };

  const paintLayers = (target: CanvasRenderingContext2D, layers: Placed[], world: World) => {
    for (const p of layers) {
      if (p.layer.alpha < 0.01) continue;
      target.save();
      target.globalAlpha = p.layer.alpha;
      if (p.layer.kind === "image" && p.layer.src) {
        ensure(p.layer.src);
        const img = images.get(p.layer.src);
        if (!img) {
          target.restore();
          continue;
        }
        const radius = Math.min(world.fx.radius, Math.min(p.w, p.h) / 2);
        if (world.fx.shadow > 0.02) {
          target.save();
          target.filter = `blur(${6 + 16 * world.fx.shadow}px)`;
          target.fillStyle = `rgba(28, 22, 18, ${0.22 * world.fx.shadow})`;
          target.beginPath();
          target.roundRect(p.x, p.y + 8 * world.fx.shadow, p.w, p.h, radius);
          target.fill();
          target.restore();
        }
        target.beginPath();
        target.roundRect(p.x, p.y, p.w, p.h, radius);
        target.clip();
        target.drawImage(img, p.x, p.y, p.w, p.h);
      } else if (p.layer.kind === "text" && p.layer.text) {
        const raster = getRaster(p.layer.text, Math.min(window.devicePixelRatio || 1, 2));
        target.drawImage(raster.canvas, p.x, p.y, raster.cssW, raster.cssH);
      }
      target.restore();
    }
  };

  const frame = () => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const world = getWorld();
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW < 2 || cssH < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#f3f1ec";
    ctx.fillRect(0, 0, cssW, cssH);
    frameDpr = dpr;
    const { layers } = stage.place(world, cssW, cssH);
    const fx = world.fx;
    const post =
      fx.distort > 0.01 ||
      fx.rgb > 0.01 ||
      fx.pixel > 0.01 ||
      fx.blur > 0.01 ||
      fx.grain > 0.01 ||
      fx.split;
    if (!post || !sctx) {
      paintLayers(ctx, layers, world);
    } else {
      if (scratch.width !== pw || scratch.height !== ph) {
        scratch.width = pw;
        scratch.height = ph;
      }
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.fillStyle = "#f3f1ec";
      sctx.fillRect(0, 0, cssW, cssH);
      paintLayers(sctx, layers, world);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (fx.blur > 0.01) ctx.filter = `blur(${fx.blur * 8}px)`;
      if (fx.distort > 0.01) {
        const slices = 48;
        const sh = Math.ceil(ph / slices);
        for (let i = 0; i < slices; i++) {
          const shift = Math.sin(i * 0.35 + stage.clock) * fx.distort * 18 * dpr;
          ctx.drawImage(scratch, 0, i * sh, pw, sh, shift, i * sh, pw, sh);
        }
      } else if (fx.pixel > 0.01) {
        const factor = Math.max(2, Math.round(1 + fx.pixel * 16));
        const sw = Math.max(1, Math.floor(pw / factor));
        const sh = Math.max(1, Math.floor(ph / factor));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(scratch, 0, 0, sw, sh);
        ctx.drawImage(ctx.canvas, 0, 0, sw, sh, 0, 0, pw, ph);
        ctx.imageSmoothingEnabled = true;
      } else {
        ctx.drawImage(scratch, 0, 0);
      }
      ctx.filter = "none";
      if (fx.rgb > 0.01) {
        ctx.globalAlpha = 0.35 * fx.rgb;
        ctx.drawImage(scratch, fx.rgb * 10 * dpr, 0);
        ctx.drawImage(scratch, -fx.rgb * 10 * dpr, 0);
        ctx.globalAlpha = 1;
      }
      if (fx.split) {
        ctx.drawImage(scratch, 0, 0, pw / 2, ph, 0, 0, pw / 2, ph);
        ctx.fillStyle = "#141414";
        ctx.fillRect(pw / 2 - 1, 0, 2, ph);
      }
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    onFrame({ scroll: stage.scroll, max: stage.max, mode: "canvas" });
  };

  raf = requestAnimationFrame(frame);
  return {
    mode: "canvas",
    destroy: () => {
      alive = false;
      cancelAnimationFrame(raf);
    },
    pick: (x, y) => stage.pick(x, y),
    addScroll: (dy) => stage.addScroll(dy, getWorld()),
  };
}
