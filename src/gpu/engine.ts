import { motionScale } from "../motion-scale.ts";
import { menuGL } from "../menu.ts";
import { cuiRipples, motion, pointer, pushRipple, settings, TRANSITION_NONE } from "../state.ts";
import { MAX_RIPPLES } from "./cui.ts";
import { TIMED } from "./chain.ts";
import { coverUV, ImageLayer } from "./images.ts";
import { Recorder, Snapshot, clockNow, type RecordOptions } from "./recorder.ts";
import { ATLAS_SIZE, ELEM_STRIDE, GLYPH_STRIDE, MORPH_MS, TextLayer, type BakedAtlas, type MsdfMeta } from "./text.ts";
import { BLOOM, BOXES, COMPOSITE, FLUID, GLYPH, INK, LAYERS, MAX_CHAPTERS, MAX_STAGES, PEEL, PEEL_X, PEEL_Y, FIRE, PLANE, PROC, SHEET, SIM, TRACE, TRACE_LAYERS, TRACE_SIZE, SCREEN_LAYER, MAX_TEARS } from "./wgsl.ts";

export type Timings = { ms: number[]; total: number; gpu: boolean; cpu: number; fps: number };

export type EngineHooks = {
  onTimings?: (t: Timings) => void;
  onLayout?: (info: { glyphs: number; atlas: number; msdf: number; textures: number; drops: number }) => void;
  onLost?: (reason: string) => void;
  /** Contraste WCAG mesuré sur l'image finale (leçon 10.2). */
  onContrast?: (ratio: number) => void;
};

/**
 * Couleur du papier : lue sur le jeton CSS --paper s'il existe, pour que le
 * DOM et le GPU partagent une seule source de vérité (sinon, le papier de PLI).
 * Les valeurs sont en sRGB, comme le reste de la chaîne.
 */
const PAPER: [number, number, number] = [0.937, 0.933, 0.91];
function readPaper() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
  const m = v.match(/^#([0-9a-f]{6})$/i);
  if (!m) return;
  const n = Number.parseInt(m[1]!, 16);
  PAPER[0] = ((n >> 16) & 255) / 255;
  PAPER[1] = ((n >> 8) & 255) / 255;
  PAPER[2] = (n & 255) / 255;
}
const SCENE_FORMAT: GPUTextureFormat = "rgba16float";
const PLANE_STRIDE = 256;
const MAX_PLANES = 16;
const MAX_SHEETS = 24;
const SHEET_BYTES = 144;
const BLOOM_LEVELS = 5;
const MAX_BOXES = 512;
const STAGE_KIND: Record<string, number> = {
  hero: 1,
  trame: 2,
  filtre: 3,
  // Leçon 06.1 : matières sur le HTML vivant. Couche de traces = type − 4.
  flammes: 4,
  nuages: 5,
  toile: 6,
  gouttes: 7,
  enveloppe: 8,
  givre: 9,
  // Matières déclarées dans le HTML (data-gl-material) : n'importe quel élément.
  lentille: 10,
  poussiere: 11,
};
/** Nom de la plaque : data-gl-stage (démonstrations), sinon data-gl-material. */
const stageName = (s: HTMLElement) => s.dataset.glStage ?? s.dataset.glMaterial ?? "";
/**
 * Mémoire du pointeur par matière : gain et oubli de la présence (b), gain et
 * oubli du vent ou de la peinture (rg), en 1/s. Les flammes et l'enveloppe
 * n'en ont pas besoin.
 */
const TRACE_RATES: [number, number, number, number][] = [
  [0, 1, 0, 1],
  [7, 0.55, 1.2, 0.8], // brume : s'écarte vite, revient en deux secondes
  [9, 0.12, 0.9, 0.03], // toile : la peinture reste, sèche lentement
  [10, 0.1, 0, 1], // gouttes : la buée revient lentement
  [0, 1, 0, 1],
  [2.2, 0.25, 0, 1], // givre : fond en restant dessus, regèle en quatre secondes
];
/** Marge autour de l'élément enveloppé de flammes (px css). */
export const WRAP_PAD = 112;
const BODY_STRIDE = 32;
const DROP_STRIDE = 32;
const POST_VEC4 = 7 + MAX_STAGES + MAX_STAGES / 4 + 1 + MAX_CHAPTERS + 1 + 1 + 16 + 1 + 1 + 3 + MAX_TEARS + 2 + 2 + MAX_RIPPLES;
const PRINT_AT = 4 * (7 + MAX_STAGES + MAX_STAGES / 4);
const A11Y_AT = PRINT_AT + 4 + MAX_CHAPTERS * 4;
const CASSE_AT = A11Y_AT + 4;
const MATTER_AT = CASSE_AT + 4 + 16 * 4;
const SCREEN_AT = MATTER_AT + 4;
const CREASE_AT = SCREEN_AT + 4;
const LENSM_AT = CREASE_AT + 4;
const TEAR_AT = LENSM_AT + 4;
const GRID_AT = TEAR_AT + 4 + MAX_TEARS * 4;
const CUI_AT = GRID_AT + 8;

const premul: GPUBlendState = {
  color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
};
const additive: GPUBlendState = {
  color: { srcFactor: "one", dstFactor: "one", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
};

export async function createEngine(canvas: HTMLCanvasElement, hooks: EngineHooks = {}) {
  readPaper();
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
  // COPY_SRC : la leçon 10.2 relit l'image finale pour en mesurer le contraste.
  context.configure({ device, format, alphaMode: "opaque", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });

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
  const glyphLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });
  const simLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
    ],
  });
  const inkSimLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
    ],
  });
  const inkDrawLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
    ],
  });
  const layersLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
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
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float", viewDimension: "2d-array" } },
    ],
  });

  /* ───── Pipelines ───── */
  const planeMod = device.createShaderModule({ label: "plane", code: `${PLANE}\n${PEEL}` });
  const glyphMod = device.createShaderModule({ label: "glyph", code: GLYPH });
  const boxMod = device.createShaderModule({ label: "boxes", code: BOXES });
  const bloomMod = device.createShaderModule({ label: "bloom", code: BLOOM });
  const postMod = device.createShaderModule({ label: "composite", code: COMPOSITE });
  const simMod = device.createShaderModule({ label: "sim", code: SIM });
  const layersMod = device.createShaderModule({ label: "layers", code: LAYERS });
  const sheetMod = device.createShaderModule({ label: "sheet", code: SHEET });
  const traceMod = device.createShaderModule({ label: "trace", code: TRACE });
  const fireMod = device.createShaderModule({ label: "fire", code: FIRE });
  const procMod = device.createShaderModule({ label: "proc", code: PROC });
  const inkMod = device.createShaderModule({ label: "ink", code: INK });
  for (const m of [planeMod, glyphMod, boxMod, bloomMod, postMod, simMod, inkMod, layersMod, sheetMod, traceMod, fireMod, procMod]) {
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
  const peelPipe = (entry: string) =>
    device.createRenderPipeline({
      label: entry,
      layout: planePipeLayout,
      vertex: { module: planeMod, entryPoint: entry === "fs_peel_flat" ? "vs_peel_flat" : "vs_peel" },
      fragment: { module: planeMod, entryPoint: entry, targets: [{ format: SCENE_FORMAT, blend: premul }] },
      primitive: { topology: "triangle-list" },
    });
  const peelFlatPipe = peelPipe("fs_peel_flat");
  const peelCurlPipe = peelPipe("fs_peel_curl");
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

  const simPipe = device.createComputePipeline({
    label: "sim",
    layout: device.createPipelineLayout({ bindGroupLayouts: [simLayout] }),
    compute: { module: simMod, entryPoint: "main" },
  });
  const inkSimPipe = device.createComputePipeline({
    label: "ink-sim",
    layout: device.createPipelineLayout({ bindGroupLayouts: [inkSimLayout] }),
    compute: { module: inkMod, entryPoint: "sim" },
  });
  const inkDrawPipe = device.createRenderPipeline({
    label: "ink-draw",
    layout: device.createPipelineLayout({ bindGroupLayouts: [frameLayout, inkDrawLayout] }),
    vertex: { module: inkMod, entryPoint: "vs" },
    fragment: { module: inkMod, entryPoint: "fs", targets: [{ format: SCENE_FORMAT, blend: premul }] },
    primitive: strip,
  });

  const layersPipe = device.createRenderPipeline({
    label: "layers",
    layout: device.createPipelineLayout({ bindGroupLayouts: [frameLayout, layersLayout] }),
    vertex: { module: layersMod, entryPoint: "vs" },
    fragment: { module: layersMod, entryPoint: "fs", targets: [{ format: SCENE_FORMAT, blend: premul }] },
    primitive: strip,
  });

  // Sommaire : une feuille par appel, matrice et photo dans un uniforme à décalage dynamique.
  const sheetLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: SHEET_BYTES },
      },
    ],
  });
  // Matières : traces du pointeur, une couche par matière.
  const traceLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "unfilterable-float", viewDimension: "2d-array" } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba16float", viewDimension: "2d-array" } },
    ],
  });
  const tracePipe = device.createComputePipeline({
    label: "trace",
    layout: device.createPipelineLayout({ bindGroupLayouts: [traceLayout] }),
    compute: { module: traceMod, entryPoint: "trace" },
  });
  const traceTex = (label: string, usage: number) =>
    device.createTexture({ label, size: [TRACE_SIZE, TRACE_SIZE, TRACE_LAYERS], format: "rgba16float", usage });
  const traceA = traceTex("trace-a", GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST);
  const traceB = traceTex("trace-b", GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC);
  const traceBuf = device.createBuffer({ size: 16 + TRACE_LAYERS * 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const traceData = new Float32Array(4 + TRACE_LAYERS * 12);
  const traceBind = device.createBindGroup({
    layout: traceLayout,
    entries: [
      { binding: 0, resource: { buffer: traceBuf } },
      { binding: 1, resource: traceA.createView({ dimension: "2d-array" }) },
      { binding: 2, resource: traceB.createView({ dimension: "2d-array" }) },
    ],
  });

  // Matières : le feu, dessiné dans la scène en HDR avant le bloom.
  const fireLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: 48 } }],
  });
  const firePipe = device.createRenderPipeline({
    label: "fire",
    layout: device.createPipelineLayout({ bindGroupLayouts: [frameLayout, fireLayout] }),
    vertex: { module: fireMod, entryPoint: "vs_fire" },
    fragment: { module: fireMod, entryPoint: "fs_fire", targets: [{ format: SCENE_FORMAT, blend: premul }] },
    primitive: strip,
  });
  // Chapitre 06 : sources animées, à la place de la photo.
  const procLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform", hasDynamicOffset: true } }],
  });
  const procPipe = device.createRenderPipeline({
    label: "proc",
    layout: device.createPipelineLayout({ bindGroupLayouts: [frameLayout, procLayout] }),
    vertex: { module: procMod, entryPoint: "vs_proc" },
    fragment: { module: procMod, entryPoint: "fs_proc", targets: [{ format: SCENE_FORMAT }] },
    primitive: strip,
  });
  // Une source par photo concernée : toutes les plaques, pas seulement la première.
  const MAX_PROCS = 8;
  const procBuf = device.createBuffer({ size: PLANE_STRIDE * MAX_PROCS, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const procBind = device.createBindGroup({ layout: procLayout, entries: [{ binding: 0, resource: { buffer: procBuf, size: 32 } }] });
  const procData = new Float32Array((PLANE_STRIDE * MAX_PROCS) / 4);
  const MAX_FIRES = 8;
  const traceLayers = new Map<HTMLElement, number>();
  const traceKind = new Map<HTMLElement, string | undefined>();
  const fireBuf = device.createBuffer({ size: PLANE_STRIDE * MAX_FIRES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const fireBind = device.createBindGroup({ layout: fireLayout, entries: [{ binding: 0, resource: { buffer: fireBuf, size: 48 } }] });
  const fireData = new Float32Array((PLANE_STRIDE * MAX_FIRES) / 4);

  const sheetPipe = device.createRenderPipeline({
    label: "sheet",
    layout: device.createPipelineLayout({ bindGroupLayouts: [frameLayout, sheetLayout, texLayout] }),
    vertex: { module: sheetMod, entryPoint: "vs_sheet" },
    fragment: { module: sheetMod, entryPoint: "fs_sheet", targets: [{ format: SCENE_FORMAT, blend: premul }] },
    primitive: strip,
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
  const frameBuf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const frameBind = device.createBindGroup({ layout: frameLayout, entries: [{ binding: 0, resource: { buffer: frameBuf } }] });
  const planeBuf = device.createBuffer({
    size: PLANE_STRIDE * MAX_PLANES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const planeBind = device.createBindGroup({
    layout: planeLayout,
    entries: [{ binding: 0, resource: { buffer: planeBuf, size: 80 } }],
  });
  const sheetBuf = device.createBuffer({ size: PLANE_STRIDE * MAX_SHEETS, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const sheetBind = device.createBindGroup({ layout: sheetLayout, entries: [{ binding: 0, resource: { buffer: sheetBuf, size: SHEET_BYTES } }] });
  const sheetData = new Float32Array((PLANE_STRIDE * MAX_SHEETS) / 4);
  const boxBuf = device.createBuffer({ size: 32 * MAX_BOXES, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const boxBind = device.createBindGroup({ layout: boxLayout, entries: [{ binding: 0, resource: { buffer: boxBuf } }] });
  const postBuf = device.createBuffer({
    size: 16 * POST_VEC4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const text = new TextLayer(device);
  // Atlas SDF du texte courant, précalculé à la construction (tools/bake.mjs) :
  // les glyphes qu'il contient ne sont plus dessinés au démarrage.
  try {
    if (new URLSearchParams(location.search).has("presse-nobake")) throw new Error("atlas précalculé désactivé");
    const [meta, blob] = await Promise.all([
      fetch(new URL("./sdf/text.json", document.baseURI)).then((r) => (r.ok ? (r.json() as Promise<BakedAtlas>) : null)),
      fetch(new URL("./sdf/text.png", document.baseURI)).then((r) => (r.ok ? r.blob() : null)),
    ]);
    if (meta && blob) {
      const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(bmp, 0, 0);
      const rgba = g.getImageData(0, 0, bmp.width, bmp.height).data;
      const r8 = new Uint8Array(bmp.width * bmp.height);
      for (let i = 0; i < r8.length; i++) r8[i] = rgba[i * 4]!;
      bmp.close();
      text.useBaked(meta, r8);
    }
  } catch {
    // Pas d'atlas précalculé : tout est dessiné à l'exécution, comme avant.
  }
  if (text.bakeLog) (window as unknown as { __presseBake: () => unknown }).__presseBake = () => text.bakeLog;
  const casseData = new Float32Array(4 + 16 * 4);
  // Atlas MTSDF des titres. S'il manque, les titres restent en SDF simple.
  let msdfTex = device.createTexture({ size: [1, 1], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING });
  try {
    const [meta, blob] = await Promise.all([
      fetch(new URL("./msdf/display.json", document.baseURI)).then((r) => (r.ok ? (r.json() as Promise<MsdfMeta>) : null)),
      fetch(new URL("./msdf/display.png", document.baseURI)).then((r) => (r.ok ? r.blob() : null)),
    ]);
    if (meta && blob) {
      const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      msdfTex.destroy();
      msdfTex = device.createTexture({
        label: "atlas-mtsdf",
        size: [bmp.width, bmp.height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      device.queue.copyExternalImageToTexture({ source: bmp }, { texture: msdfTex, premultipliedAlpha: false }, [bmp.width, bmp.height]);
      bmp.close();
      text.msdf = meta;
      // Casse de plomb : la rampe de caractères, du plus clair au plus noir.
      const chars = meta.fonts["900|125"]?.chars ?? {};
      const ramp = (meta.ramp ?? []).filter((c) => chars[c]).slice(0, 16);
      casseData[0] = ramp.length;
      casseData.set([meta.width, meta.height, meta.size], 1);
      ramp.forEach((c, i) => {
        const [x, y, w, h] = chars[c]!;
        casseData.set([x, y, w, h], 4 + i * 4);
      });
    }
  } catch (err) {
    console.warn("[pli] atlas MTSDF indisponible", err);
  }
  const images = new ImageLayer(device, texLayout, linear);
  const atlasBind = images.bindFor(text.texture);

  /* Calcul : lettres de l'ouverture */
  const simBuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  let bodyBuf = device.createBuffer({ size: BODY_STRIDE, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  let simBind: GPUBindGroup | null = null;
  let hero = { index: -1, first: 0, count: 0 };
  let introPending = !motion.reduced;
  let introStart = -1;

  /* Calcul : encre */
  const inkCount = innerWidth < 900 ? 16384 : 65536;
  const inkBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const dropBuf = device.createBuffer({ size: inkCount * DROP_STRIDE, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  {
    const init = new Float32Array(inkCount * 8);
    for (let i = 0; i < inkCount; i++) {
      // Vies négatives et étalées : les gouttes naissent au fil des secondes.
      init.set([Math.random(), Math.random() * 0.66, 0, 0, -Math.random() * 1.5, i % 3, Math.random(), 0], i * 8);
    }
    device.queue.writeBuffer(dropBuf, 0, init);
  }
  const inkSimBind = device.createBindGroup({
    layout: inkSimLayout,
    entries: [
      { binding: 0, resource: { buffer: inkBuf } },
      { binding: 1, resource: { buffer: dropBuf } },
    ],
  });
  const inkDrawBind = device.createBindGroup({
    layout: inkDrawLayout,
    entries: [
      { binding: 0, resource: { buffer: inkBuf } },
      { binding: 1, resource: { buffer: dropBuf } },
    ],
  });
  const inkData = new Float32Array(16);
  const simData = new Float32Array(12);
  let inkTime = 0;
  /* Chapitre 08.2 : encre fraîche, fluides stables */
  const fluid = createFluid(device, linear);
  /* Chapitre 04.2 : calques */
  const layersBuf = device.createBuffer({ size: 144, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const layersData = new Float32Array(36);
  let layersBind: GPUBindGroup | null = null;
  let layersKey = "";
  let contrastBuf: GPUBuffer | null = null;
  let contrastBusy = false;
  let lastContrast = 0;
  let inkPrerolled = false;

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
    // Corps simulés : un par lettre de l'ouverture.
    const hi = text.elems.findIndex((e) => e.fx === 1);
    const he = hi >= 0 ? text.elems[hi]! : null;
    const count = he?.count ?? 0;
    if (count !== hero.count || hi !== hero.index) {
      const need = Math.max(BODY_STRIDE, count * BODY_STRIDE);
      if (bodyBuf.size < need) {
        bodyBuf.destroy();
        bodyBuf = device.createBuffer({ size: need, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        glyphBind = null;
      }
      const init = new Float32Array(Math.max(8, count * 8));
      if (introPending && count) {
        // Arrivée : les caractères tombent de haut, en ordre de lecture, et
        // rebondissent dans la forme.
        for (let i = 0; i < count; i++) {
          const k = i / count;
          init.set(
            [(Math.random() - 0.5) * 260, -innerHeight * (0.55 + Math.random() * 0.5), 0, 0, (Math.random() - 0.5) * 2.4, 0, 0.15 + k * 0.9 + Math.random() * 0.08, 0],
            i * 8,
          );
        }
        introPending = false;
        introStart = -2; // démarre à la première frame visible
      }
      device.queue.writeBuffer(bodyBuf, 0, init);
    }
    hero = { index: hi, first: he?.first ?? 0, count };
    simBind = device.createBindGroup({
      layout: simLayout,
      entries: [
        { binding: 0, resource: { buffer: simBuf } },
        { binding: 1, resource: { buffer: glyphBuf! } },
        { binding: 2, resource: { buffer: bodyBuf } },
      ],
    });
    if (!glyphBind) {
      glyphBind = device.createBindGroup({
        layout: glyphLayout,
        entries: [
          { binding: 0, resource: { buffer: glyphBuf } },
          { binding: 1, resource: { buffer: elemBuf } },
          { binding: 2, resource: linear },
          { binding: 3, resource: text.texture.createView() },
          { binding: 4, resource: { buffer: bodyBuf } },
          { binding: 5, resource: msdfTex.createView() },
        ],
      });
    }
    hooks.onLayout?.({ glyphs: text.glyphCount, atlas: text.atlasGlyphs, msdf: text.msdfGlyphs, textures: images.bytes, drops: inkCount });
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
        { binding: 4, resource: msdfTex.createView() },
        { binding: 5, resource: traceA.createView({ dimension: "2d-array" }) },
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
  const frameData = new Float32Array(20);
  const planeData = new Float32Array((PLANE_STRIDE * MAX_PLANES) / 4);
  const postData = new Float32Array(4 * POST_VEC4);
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
  // Profondeur imprimée de chaque chapitre (px css), qui ne fait que croître.
  const printDepth = new WeakMap<Element, { shown: number; target: number }>();
  // Ce que le DOM peint lui-même (réglages, code, liens) apparaît quand le
  // front d'impression l'atteint. Le focus clavier imprime tout le chapitre.
  const DOM_INK = ".controls, .meter, .wgsl, .readout, .stage--type, .stage--ink, .stage--layers, .code-inline, a, button";
  const onFocus = (e: FocusEvent) => {
    const ch = (e.target as Element | null)?.closest?.(".chapter, .colophon, [data-gl-print]");
    const st = ch ? printDepth.get(ch) : undefined;
    if (st) st.target = 1e6;
  };
  addEventListener("focusin", onFocus);
  let lastPx = pointer.x;
  let lastPy = pointer.y;
  let pvx = 0;
  let pvy = 0;

  const stages = () => [...document.querySelectorAll<HTMLElement>("[data-gl-stage], [data-gl-material]")].filter((s) => stageName(s) !== "dechirure");
  // Pointeur amorti de la matière lentille, et sa force au survol.
  const lensP = { x: 0, y: 0, k: 0 };
  // Ondes et champ de force (effets Canvas UI) : chaque clic sur la page lance une onde.
  addEventListener("pointerdown", (e) => {
    const fx = settings.cui.effect;
    if (fx !== 1 && fx !== 9) return;
    if ((e.target as Element | null)?.closest?.("button, a, input, select, textarea, label, summary, [role=button]")) return;
    pushRipple(e.clientX, e.clientY);
  });
  // Couche d'écran du froissé : décalage de défilement en reste (texels), et remise à zéro.
  let creaseCarry = 0;
  let creaseWas = false;
  // Mode capture : une horloge virtuelle avance d'un pas fixe par image, et
  // chaque image rendue devient une image de la vidéo, quelle que soit la
  // vitesse réelle de la machine.
  let recorder: Recorder | null = null;
  const snapshot = new Snapshot(device, format);
  let gridCache: { gl: number; gr: number; gap: number; w: number } | null = null;

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
    const now = clockNow();
    const time = (now - t0) / 1000;
    const reduced = motion.reduced;
    // Sommaire ouvert : la page est masquée (inert), le GPU ne peint que les feuilles.
    const menuOpen = menuGL.open;
    if (menuOpen) menuGL.step?.(now);
    // Vitesse de défilement : les plaques glissent quand le papier court.
    // Un saut (ancre, sommaire) n'est pas un geste : on l'ignore.
    const dy = scrollY - lastScroll;
    lastScroll = scrollY;
    const dt = Math.min(0.1, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    const v = Math.abs(dy) > 600 ? 0 : dy / dt; // px/s
    velocity += (v - velocity) * (1 - Math.exp(-dt * 10));
    const slip = reduced ? 0 : Math.max(-1, Math.min(1, velocity / 4000));
    // Vitesse du pointeur, lissée : c'est elle qui « balaie » les lettres et l'encre.
    const k = 1 - Math.exp(-dt * 18);
    pvx += ((pointer.x - lastPx) / dt - pvx) * k;
    pvy += ((pointer.y - lastPy) / dt - pvy) * k;
    lastPx = pointer.x;
    lastPy = pointer.y;
    if (!pointer.inside) {
      pvx = 0;
      pvy = 0;
    }

    /* Frame uniforms */
    frameData.set([cssW, cssH, dpr, reduced ? 0 : time]);
    frameData.set([pointer.x, pointer.y, pointer.inside ? 1 : 0, reduced ? 1 : 0], 4);
    frameData.set([settings.glyph.wave, settings.glyph.ink, settings.glyph.scatter, settings.dom.boxes ? 1 : 0], 8);
    frameData.set([2048, 1.6, PAPER[0], settings.debug.wire ? 1 : 0], 12);
    frameData.set([slip, settings.inertia.amount * motionScale(), motionScale(), 0], 16);
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
      const ms = text.morphSince.get(e.el);
      const morph = ms === undefined || reduced ? 1 : Math.min(1, (now - ms) / MORPH_MS);
      elemData.set([r.left, r.top, ease(reveal), e.fx, e.count, hideSpecimen ? 0 : 1, morph, 0], i * 8);
      if (settings.dom.boxes && r.bottom > 0 && r.top < cssH) boxes.push(r.left, r.top, r.width, r.height, 0, 0.627, 0.863, 0.9);
    });
    if (elemBuf && elems.length) device.queue.writeBuffer(elemBuf, 0, elemData, 0, elems.length * 8);

    /* Plans */
    type Job = { offset: number; bind: GPUBindGroup; shadow: boolean; peel: boolean };
    let fluidPlate: { plate: (typeof images.plates)[number]; rect: DOMRect } | null = null;
    const jobs: Job[] = [];
    let slot = 0;
    const pushPlane = (rect: DOMRect, uv: readonly number[], params: number[], flags: number[], bind: GPUBindGroup, shadow: boolean, peel = 0) => {
      if (slot >= MAX_PLANES) return;
      const o = (slot * PLANE_STRIDE) / 4;
      planeData.set([rect.left, rect.top, rect.width, rect.height], o);
      planeData.set(uv, o + 4);
      planeData.set(params, o + 8);
      planeData.set(flags, o + 12);
      planeData.set([peel, 0, 0, 0], o + 16);
      jobs.push({ offset: slot * PLANE_STRIDE, bind, shadow, peel: peel > 0.001 });
      slot++;
    };
    let procs = 0;
    for (const p of menuOpen ? [] : images.plates) {
      const r = p.img.getBoundingClientRect();
      const visible = r.bottom > -80 && r.top < cssH + 80 && r.width > 0;
      const over = pointer.inside && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
      p.hover += ((over ? 1 : 0) - p.hover) * (reduced ? 1 : 0.12);
      if (settings.dom.boxes && visible) boxes.push(r.left, r.top, r.width, r.height, 0.894, 0, 0.486, 0.95);
      if (!visible || !p.bind) continue;
      if (settings.filter.source > 0 && p.img.closest('[data-gl-stage="filtre"], [data-gl-source]')) {
        // Une source animée remplace la photo du chapitre 06.
        if (procs < MAX_PROCS) procData.set([r.left, r.top, r.width, r.height, settings.filter.source, 0, 0, 0], (procs++ * PLANE_STRIDE) / 4);
        continue;
      }
      if (p.fluid && p.texture && !reduced) {
        // Chapitre 08.2 : la plaque est dessinée depuis le colorant advecté.
        fluidPlate = { plate: p, rect: r };
        pushPlane(r, [0, 0, 1, 1], [p.radius, 0.32, 0.15, 1], [0, 0, 0, 1.6], fluid.dyeBind(images), true);
        continue;
      }
      const q = settings.quad;
      const radius = p.quad ? q.radius : p.radius;
      const shadow = p.quad ? q.shadow : 0.32;
      const lift = p.quad ? q.lift : 0.15;
      const uv = coverUV(r.width, r.height, p.width, p.height);
      // Chapitre 02 : l'épreuve se décolle au réglage, et d'un souffle au survol.
      const wantPeel = p.quad ? Math.max(q.peel, reduced || !q.hoverPeel ? 0 : p.hover * 0.22) : 0;
      p.peel += (wantPeel - p.peel) * (reduced ? 1 : 1 - Math.exp(-dt * 7));
      if (p.peel > 0.001) {
        // Dessous : la plaque offset, en négatif ; dessus : l'épreuve maillée.
        pushPlane(r, uv, [radius, shadow, lift, 1], [0, 2, p.hover, 0], p.bind, shadow > 0.01);
        pushPlane(r, uv, [radius, 0, lift, 1], [0, 0, p.hover, 1.6], p.bind, false, p.peel);
      } else {
        pushPlane(r, uv, [radius, shadow, lift, 1], [p.quad && q.wire ? 1 : 0, 0, p.hover, 1.6], p.bind, shadow > 0.01);
      }
    }

    /* Plaques de démonstration */
    const stageEls = menuOpen ? [] : stages();
    postData.fill(0);
    traceData.fill(0);
    let traceOn = false;
    let fires = 0;
    let si = 0;
    // Couches de traces : une par plaque de matière visible. Une plaque garde
    // sa couche tant qu'elle reste à l'écran ; une couche reprise est remise à zéro.
    const visibleMatters = stageEls.filter((s) => {
      const r = s.getBoundingClientRect();
      const kd = STAGE_KIND[stageName(s)] ?? 0;
      return kd >= 4 && kd <= 9 && r.width > 0 && r.bottom > 0 && r.top < cssH;
    });
    for (const [el] of traceLayers) if (!visibleMatters.includes(el) || traceKind.get(el) !== stageName(el)) traceLayers.delete(el);
    const fresh = new Set<number>();
    for (const el of visibleMatters) {
      if (traceLayers.has(el)) continue;
      const taken = new Set(traceLayers.values());
      for (let l = 0; l < SCREEN_LAYER; l++) {
        if (!taken.has(l)) {
          traceLayers.set(el, l);
          traceKind.set(el, stageName(el));
          fresh.add(l);
          break;
        }
      }
    }
    for (const s of stageEls) {
      const r = s.getBoundingClientRect();
      const kind = STAGE_KIND[stageName(s)] ?? 0;
      if (kind >= 4 && kind <= 9 && r.width > 0 && r.bottom > 0 && r.top < cssH) {
        // Matière visible : sa couche de traces avance d'un pas.
        const layer = traceLayers.get(s) ?? -1;
        const rates = TRACE_RATES[kind - 4]!;
        const inside = pointer.inside && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
        const o = 4 + Math.max(0, layer) * 12;
        if (layer >= 0) traceData.set([fresh.has(layer) ? 2 : 1, inside ? 1 : 0, (pointer.x - r.left) / r.width, (pointer.y - r.top) / r.height], o);
        if (layer >= 0) {
          traceData.set([pvx / r.width, pvy / r.height, r.width / r.height, 0.09], o + 4);
          traceData.set(rates, o + 8);
          traceOn = traceOn || rates[0] > 0;
        }
        if ((kind === 4 || kind === 8) && fires < MAX_FIRES) {
          const o2 = (fires * PLANE_STRIDE) / 4;
          fireData.set([r.left, r.top, r.width, r.height], o2);
          fireData.set([kind === 4 ? 0 : 1, settings.matter.intensity, WRAP_PAD, inside ? 1 : 0], o2 + 4);
          fireData.set([pointer.x, pointer.y, inside ? 1 : 0, 0], o2 + 8);
          fires++;
        }
      }
      if (settings.dom.boxes && r.bottom > 0 && r.top < cssH) boxes.push(r.left - 6, r.top - 6, r.width + 12, r.height + 12, 0.07, 0.07, 0.07, 0.7);
      if (s.dataset.glStage === "glyph" && settings.glyph.atlas && r.bottom > 0 && r.top < cssH) {
        // Seule la bande occupée de l'atlas, à l'échelle de la plaque.
        // Une fenêtre agrandie sur le coin occupé (0,6 texel par pixel CSS) :
        // réduit en entier, l'atlas de 2048 texels ne montrait que des miettes.
        const used = Math.max(0.02, text.atlasUsed);
        const aw = r.width - 24;
        const zoom = 0.6 / ATLAS_SIZE;
        const ah = Math.min(r.height - 24, (used * ATLAS_SIZE) / 0.6);
        const a = new DOMRect(r.left + 12, r.top + 12, aw, ah);
        pushPlane(a, [0, 0, Math.min(1, aw * zoom), Math.min(used, ah * zoom)], [2, 0, 0, 1], [0, 1, 0, 0], atlasBind, false);
      }
      if (si < MAX_STAGES && kind > 0 && r.bottom > 0 && r.top < cssH) {
        postData.set([r.left * dpr, r.top * dpr, r.width * dpr, r.height * dpr], 28 + si * 4);
        // Pour une matière, le type porte aussi sa couche de traces : type + 16 × couche.
        postData[28 + MAX_STAGES * 4 + si] = kind >= 4 && kind <= 9 ? kind + 16 * Math.max(0, traceLayers.get(s) ?? 0) : kind;
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
    postData.set([c.grain ? settings.grain.amp : 0, c.split ? 1 : 0, splitX, L.bloom], 12);
    postData.set([T.cell, T.gain, T.misreg, T.mix], 16);
    postData.set([PAPER[0], PAPER[1], PAPER[2], slip], 20);
    const F = settings.filter;
    postData.set([F.kind, F.size, F.amount, 0], 24);

    /* Transition : impression des chapitres */
    const P = settings.transition;
    const printOn = c.print && !reduced && P.style !== TRANSITION_NONE;
    const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    let nch = 0;
    const printEase = 1 - Math.exp(-dt * P.speed);
    for (const ch of menuOpen ? [] : document.querySelectorAll(".chapter, .colophon, [data-gl-print]")) {
      const r = ch.getBoundingClientRect();
      let st = printDepth.get(ch);
      if (!st) {
        st = { shown: 0, target: 0 };
        printDepth.set(ch, st);
      }
      // La ligne d'impression est à une fraction réglable de la hauteur de
      // l'écran (86 % par défaut). En bas de page, rien ne peut plus monter :
      // tout ce qui est visible s'imprime.
      st.target = Math.max(st.target, atBottom && r.top < cssH ? 1e6 : cssH * P.line - r.top);
      // Arrivé par une ancre au milieu d'un long chapitre : le front part du
      // haut de l'écran, pas du haut du chapitre, sinon l'écran reste vierge.
      if (st.target > -r.top) st.shown = Math.max(st.shown, -r.top - cssH * P.width);
      st.shown = Math.max(st.shown, st.shown + (st.target - st.shown) * printEase);
      if (nch < MAX_CHAPTERS && r.bottom > 0 && r.top < cssH) {
        postData.set([r.top * dpr, r.bottom * dpr, st.shown * dpr, 0], PRINT_AT + 4 + nch * 4);
        nch++;
        for (const el of ch.querySelectorAll<HTMLElement>(DOM_INK)) {
          const on = !printOn || el.getBoundingClientRect().top - r.top < st.shown - cssH * 0.08;
          if (el.classList.contains("is-printed") !== on) el.classList.toggle("is-printed", on);
        }
      }
    }
    if (menuOpen && menuGL.print) {
      // Index du sommaire : l'épreuve choisie s'imprime avec la même transition.
      const mp = menuGL.print;
      postData.set([mp.top * dpr, mp.bottom * dpr, mp.depth * dpr, mp.x0 * dpr], PRINT_AT + 4);
      nch = 1;
    }
    postData.set([nch, cssH * P.width * dpr, printOn ? 1 : 0, P.style], PRINT_AT);

    /* Sommaire : feuilles en perspective */
    const sheetJobs: { offset: number; bind: GPUBindGroup }[] = [];
    if (menuOpen) {
      for (const q of menuGL.quads) {
        if (sheetJobs.length >= MAX_SHEETS) break;
        const plate = images.plates.find((p) => p.bind && p.img.src.endsWith(q.src.replace(/^\.\//, "")));
        if (!plate?.bind) continue;
        const o = (sheetJobs.length * PLANE_STRIDE) / 4;
        sheetData.set(q.m, o);
        sheetData.set([q.w, q.h, q.alpha, q.shade], o + 16);
        sheetData.set(q.photo, o + 20);
        sheetData.set(coverUV(q.photo[2], q.photo[3], plate.width, plate.height), o + 24);
        sheetData.set(q.look, o + 28);
        sheetData.set([q.misreg, 0, 0, 0], o + 32);
        sheetJobs.push({ offset: sheetJobs.length * PLANE_STRIDE, bind: plate.bind });
      }
      if (sheetJobs.length) device.queue.writeBuffer(sheetBuf, 0, sheetData, 0, (sheetJobs.length * PLANE_STRIDE) / 4);
    }
    postData.set([settings.a11y.vision, settings.a11y.fade, 0, 0], A11Y_AT);
    postData.set(casseData, CASSE_AT);
    // Désintégration : la progression avance vers sa cible en 1,6 s.
    const Du = settings.dust;
    Du.value = reduced ? Du.target : Du.value + Math.sign(Du.target - Du.value) * Math.min(Math.abs(Du.target - Du.value), dt / 1.6);
    postData.set([settings.matter.intensity, WRAP_PAD * dpr, menuOpen ? menuGL.screen : 0, Du.value], MATTER_AT);
    const sr = menuGL.screenRect;
    postData.set([sr[0] * dpr, sr[1] * dpr, sr[2] * dpr, sr[3] * dpr], SCREEN_AT);

    // Matière lentille : le centre suit le pointeur avec du retard ; elle se
    // renforce sur l'élément survolé et s'éteint ailleurs.
    let overLens = false;
    if (!menuOpen && pointer.inside) {
      for (const el of stageEls) {
        if (stageName(el) !== "lentille") continue;
        const r = el.getBoundingClientRect();
        if (pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom) overLens = true;
      }
    }
    const lk = reduced ? 1 : 1 - Math.exp(-dt * settings.lens.follow);
    lensP.x += (pointer.x - lensP.x) * lk;
    lensP.y += (pointer.y - lensP.y) * lk;
    lensP.k += ((overLens && !reduced ? 1 : 0) - lensP.k) * (reduced ? 1 : 1 - Math.exp(-dt * 6));
    postData.set([lensP.x * dpr, lensP.y * dpr, lensP.k, settings.lens.force], LENSM_AT);

    // Papier froissé : couche d'écran des traces, qui suit le défilement.
    const C = settings.crease;
    const creaseOn = C.on && !menuOpen && !reduced;
    postData.set([creaseOn ? 1 : 0, C.depth, 0, scrollY], CREASE_AT);
    traceData[1] = 0;
    traceData[2] = SCREEN_LAYER;
    if (creaseOn) {
      creaseCarry += (dy / cssH) * TRACE_SIZE;
      const shift = Math.round(creaseCarry);
      creaseCarry -= shift;
      traceData[1] = shift;
      const o = 4 + SCREEN_LAYER * 12;
      const speed = Math.hypot(pvx, pvy);
      // Le pli vient du geste : un pointeur immobile ne froisse pas.
      const gain = 8 * Math.min(1.5, speed / 600);
      traceData.set([creaseWas ? 1 : 2, pointer.inside ? 1 : 0, pointer.x / cssW, pointer.y / cssH], o);
      traceData.set([0, 0, cssW / cssH, 0.075], o + 4);
      traceData.set([gain, C.heal, 0, 1], o + 8);
      traceOn = true;
    }
    creaseWas = creaseOn;

    // Bords déchirés : le haut de chaque élément data-gl-material="dechirure".
    let nt = 0;
    if (!menuOpen) {
      for (const el of document.querySelectorAll<HTMLElement>('[data-gl-material="dechirure"]')) {
        const r = el.getBoundingClientRect();
        if (r.top < -60 || r.top > cssH + 60 || r.width <= 0 || nt >= MAX_TEARS) continue;
        postData.set([r.top * dpr, r.left * dpr, r.right * dpr, 0], TEAR_AT + 4 + nt * 4);
        nt++;
      }
    }
    postData.set([nt, settings.tear.amp, settings.tear.react, 0], TEAR_AT);

    // Débogage : grille de mise en page (12 colonnes entre les marges, rangées de 8 px).
    const D = settings.debug;
    const gm = (D.col ? 1 : 0) | (D.row ? 2 : 0) | (D.ctr ? 4 : 0);
    if (gm) {
      const cs = getComputedStyle(document.documentElement);
      const px = (v: string, fb: number) => {
        const probe = document.createElement("div");
        probe.style.width = v;
        document.body.append(probe);
        const r = probe.getBoundingClientRect().width;
        probe.remove();
        return r || fb;
      };
      gridCache ??= { gl: px(cs.getPropertyValue("--gutter") || "16px", 16), gr: px(cs.getPropertyValue("--gutter-r") || "16px", 16), gap: px(cs.getPropertyValue("--col-gap") || "24px", 24), w: cssW };
      if (gridCache.w !== cssW) gridCache = null;
    }
    const gc = gridCache;
    postData.set(gm && gc ? [gm, gc.gl * dpr, (cssW - gc.gr) * dpr, gc.gap * dpr] : [0, 0, 0, 0], GRID_AT);
    postData.set([12, 8 * dpr, scrollY * dpr, 0], GRID_AT + 4);

    // Effets d'après Canvas UI : pointeur amorti (celui de la lentille) et ondes des clics.
    const cu = settings.cui;
    postData.set([menuOpen ? 0 : cu.effect, cu.amount, cu.scale, 0], CUI_AT);
    postData.set([lensP.x * dpr, lensP.y * dpr, pointer.inside && !menuOpen && !reduced ? 1 : 0, scrollY * dpr], CUI_AT + 4);
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = cuiRipples[i];
      if (r && r.t < 0) r.t = time;
      postData.set(r ? [r.x * dpr, r.y * dpr, r.t, r.s] : [0, 0, 0, 0], CUI_AT + 8 + i * 4);
    }
    device.queue.writeBuffer(postBuf, 0, postData);

    const nBoxes = Math.min(MAX_BOXES, boxes.length / 8);
    if (nBoxes) {
      boxData.set(boxes.slice(0, nBoxes * 8));
      device.queue.writeBuffer(boxBuf, 0, boxData, 0, nBoxes * 8);
    }

    // Seuil : juste au-dessus du papier, ou le défaut naïf pour comparaison.
    const thresh = L.naive ? [0.62, 0.0001] : [PAPER[0] + L.threshold, 0.02];
    for (const b of bloomUBufs.slice(0, 1)) device.queue.writeBuffer(b, 16, new Float32Array(thresh));

    /* Chapitre 04.2 : la pile de calques */
    let layersOn = false;
    const layersEl = document.querySelector<HTMLElement>('[data-gl-stage="calques"]');
    const lr = layersEl?.getBoundingClientRect();
    const plateA = images.plates.find((p) => p.img.src.includes("/plates/pont.") && p.texture);
    const plateB = images.plates.find((p) => p.img.src.includes("/plates/dunes.") && p.texture);
    if (!menuOpen && lr && lr.width > 0 && lr.bottom > 0 && lr.top < cssH && plateA?.texture && plateB?.texture) {
      const key = `${plateA.texture.label}|${plateB.texture.label}`;
      if (!layersBind || key !== layersKey) {
        layersKey = key;
        layersBind = device.createBindGroup({
          layout: layersLayout,
          entries: [
            { binding: 0, resource: { buffer: layersBuf } },
            { binding: 1, resource: linear },
            { binding: 2, resource: plateA.texture.createView() },
            { binding: 3, resource: plateB.texture.createView() },
          ],
        });
      }
      const Ls = settings.layers;
      const inside = pointer.inside && pointer.x >= lr.left && pointer.x <= lr.right && pointer.y >= lr.top && pointer.y <= lr.bottom;
      layersData.fill(0);
      layersData.set([lr.left, lr.top, lr.width, lr.height], 0);
      layersData.set([Ls.mask, inside ? (pointer.x - lr.left) / lr.width : 0.62, inside ? (pointer.y - lr.top) / lr.height : 0.42, 0], 4);
      layersData.set([0.78, 0.2, 0.11, 1], 8);
      Ls.order.forEach((id, i) => {
        const src = id === "glass" ? plateA : id === "flower" ? plateB : null;
        const uv = src ? coverUV(lr.width, lr.height, src.width, src.height) : [0, 0, 1, 1];
        layersData.set(uv, 12 + i * 8);
        layersData.set([Ls.mode[id], Ls.opacity[id], id === "glass" ? 0 : id === "flower" ? 1 : 2, Ls.visible[id] ? 1 : 0], 16 + i * 8);
      });
      device.queue.writeBuffer(layersBuf, 0, layersData);
      layersOn = true;
    }

    /* Encodage */
    const enc = device.createCommandEncoder({ label: "frame" });

    /* Calcul : lettres de l'ouverture, encre */
    const heroEl = hero.index >= 0 ? text.elems[hero.index]!.el : null;
    const heroBox = heroEl?.getBoundingClientRect();
    const heroOn = !menuOpen && !reduced && !!heroBox && hero.count > 0 && simBind && heroBox.bottom > -200 && heroBox.top < cssH + 200;
    if (heroOn && introStart === -2) introStart = now;
    const inkEl = document.querySelector<HTMLElement>('[data-gl-stage="ink"]');
    const inkBox = inkEl?.getBoundingClientRect();
    const inkOn = !menuOpen && !!inkBox && inkBox.width > 0 && inkBox.bottom > 0 && inkBox.top < cssH;
    if (heroOn || inkOn || fluidPlate) {
      const cp = enc.beginComputePass({ label: "calcul", timestampWrites: ts(0, "both") });
      if (heroOn && heroBox) {
        const sub = 2;
        simData.set([dt / sub, introStart < 0 ? 99 : (now - introStart) / 1000, 0, hero.count], 0);
        simData.set([pointer.x - heroBox.left, pointer.y - heroBox.top, pointer.inside ? 1 : 0, hero.first], 4);
        simData.set([pvx, pvy, Math.max(-3000, Math.min(3000, velocity)), 0], 8);
        device.queue.writeBuffer(simBuf, 0, simData);
        cp.setPipeline(simPipe);
        cp.setBindGroup(0, simBind!);
        for (let i = 0; i < sub; i++) cp.dispatchWorkgroups(Math.ceil(hero.count / 64));
      }
      if (fluidPlate) {
        const fr = fluidPlate.rect;
        const inside = pointer.inside && pointer.x >= fr.left && pointer.x <= fr.right && pointer.y >= fr.top && pointer.y <= fr.bottom;
        fluid.step(cp, {
          dt,
          photo: fluidPlate.plate,
          uv: coverUV(fr.width, fr.height, fluidPlate.plate.width, fluidPlate.plate.height),
          aspect: fr.width / Math.max(1, fr.height),
          pointer: [(pointer.x - fr.left) / fr.width, (pointer.y - fr.top) / fr.height],
          inside,
          force: [pvx / fr.width, pvy / fr.height],
          strength: settings.fluid.force,
          dry: settings.fluid.dry,
        });
      }
      if (inkOn && inkBox) {
        const motionScale = reduced ? 0 : 1;
        inkTime += dt * motionScale;
        const aspect = inkBox.height / Math.max(1, inkBox.width);
        const inside = pointer.inside && pointer.x >= inkBox.left && pointer.x <= inkBox.right && pointer.y >= inkBox.top && pointer.y <= inkBox.bottom;
        inkData.set([dt * motionScale, inkTime, inkCount, aspect], 0);
        inkData.set([inkBox.left, inkBox.top, inkBox.width, inkBox.height], 4);
        inkData.set([(pointer.x - inkBox.left) / inkBox.width, ((pointer.y - inkBox.top) / inkBox.width), inside ? 1 : 0, settings.ink.stir], 8);
        inkData.set([pvx / inkBox.width, pvy / inkBox.width, settings.ink.flow, 2.4], 12);
        device.queue.writeBuffer(inkBuf, 0, inkData);
        cp.setPipeline(inkSimPipe);
        cp.setBindGroup(0, inkSimBind);
        if (!reduced) {
          cp.dispatchWorkgroups(Math.ceil(inkCount / 64));
        } else if (!inkPrerolled) {
          // Mouvement réduit : on laisse l'encre s'étaler une fois, hors champ,
          // puis l'image reste fixe.
          inkPrerolled = true;
          inkData[0] = 1 / 30;
          device.queue.writeBuffer(inkBuf, 0, inkData);
          for (let i = 0; i < 240; i++) cp.dispatchWorkgroups(Math.ceil(inkCount / 64));
        }
      }
      cp.end();
    }
    if (traceOn) {
      traceData[0] = dt;
      device.queue.writeBuffer(traceBuf, 0, traceData);
      const tp = enc.beginComputePass({ label: "traces" });
      tp.setPipeline(tracePipe);
      tp.setBindGroup(0, traceBind);
      tp.dispatchWorkgroups(TRACE_SIZE / 8, TRACE_SIZE / 8, TRACE_LAYERS);
      tp.end();
      enc.copyTextureToTexture({ texture: traceB }, { texture: traceA }, [TRACE_SIZE, TRACE_SIZE, TRACE_LAYERS]);
    }
    const scenePass = enc.beginRenderPass({
      label: "scene",
      colorAttachments: [
        { view: scene!.createView(), loadOp: "clear", storeOp: "store", clearValue: [PAPER[0], PAPER[1], PAPER[2], 1] },
      ],
      timestampWrites: ts(1, "both"),
    });
    scenePass.setBindGroup(0, frameBind);
    for (const j of jobs) {
      scenePass.setBindGroup(1, planeBind, [j.offset]);
      scenePass.setBindGroup(2, j.bind);
      if (j.shadow) {
        scenePass.setPipeline(shadowPipe);
        scenePass.draw(4);
      }
      if (j.peel) {
        // D'abord ce qui reste à plat, puis le rabat par-dessus.
        scenePass.setPipeline(peelFlatPipe);
        scenePass.draw(PEEL_X * PEEL_Y * 6);
        scenePass.setPipeline(peelCurlPipe);
        scenePass.draw(PEEL_X * PEEL_Y * 6);
        continue;
      }
      scenePass.setPipeline(planePipe);
      scenePass.draw(4);
    }
    if (procs) {
      device.queue.writeBuffer(procBuf, 0, procData, 0, (procs * PLANE_STRIDE) / 4);
      scenePass.setPipeline(procPipe);
      for (let i = 0; i < procs; i++) {
        scenePass.setBindGroup(1, procBind, [i * PLANE_STRIDE]);
        scenePass.draw(4);
      }
    }
    if (layersOn && layersBind) {
      scenePass.setPipeline(layersPipe);
      scenePass.setBindGroup(1, layersBind);
      scenePass.draw(4);
    }
    if (inkOn) {
      scenePass.setPipeline(inkDrawPipe);
      scenePass.setBindGroup(1, inkDrawBind);
      scenePass.draw(4, inkCount);
    }
    if (menuOpen) {
      for (const j of sheetJobs) {
        scenePass.setPipeline(sheetPipe);
        scenePass.setBindGroup(1, sheetBind, [j.offset]);
        scenePass.setBindGroup(2, j.bind);
        scenePass.draw(4);
      }
    }
    if (!menuOpen && glyphBind && text.glyphCount) {
      scenePass.setPipeline(glyphPipe);
      scenePass.setBindGroup(1, glyphBind);
      scenePass.draw(4, text.glyphCount);
    }
    if (fires && settings.matter.intensity > 0) {
      // Par-dessus le texte : la feuille brûle avec ce qu'elle porte.
      device.queue.writeBuffer(fireBuf, 0, fireData, 0, (fires * PLANE_STRIDE) / 4);
      scenePass.setPipeline(firePipe);
      for (let i = 0; i < fires; i++) {
        scenePass.setBindGroup(1, fireBind, [i * PLANE_STRIDE]);
        scenePass.draw(4);
      }
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
      runStep(bloomSteps.pre, 2, "both");
      bloomSteps.down.forEach((s, i, a) =>
        runStep(s, 3, a.length === 1 ? "both" : i === 0 ? "start" : i === a.length - 1 ? "end" : "none"),
      );
      bloomSteps.up.forEach((s, i, a) =>
        runStep(s, 4, a.length === 1 ? "both" : i === 0 ? "start" : i === a.length - 1 ? "end" : "none"),
      );
    }

    const outTex = context.getCurrentTexture();
    const out = outTex.createView();
    const post = enc.beginRenderPass({
      label: "composite",
      colorAttachments: [{ view: out, loadOp: "clear", storeOp: "store", clearValue: [PAPER[0], PAPER[1], PAPER[2], 1] }],
      timestampWrites: ts(5, "both"),
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
    // Leçon 10.2 : copie de la zone du paragraphe témoin, deux fois par seconde.
    let probeRead: { bytesPerRow: number; w: number; h: number } | null = null;
    if (!menuOpen && !contrastBusy && now - lastContrast > 500 && hooks.onContrast) {
      const probe = document.querySelector<HTMLElement>("[data-contrast-probe]");
      const pr = probe?.getBoundingClientRect();
      // On ne mesure qu'un paragraphe entièrement imprimé : sinon on lirait du
      // papier vierge et le rapport tomberait à 1:1.
      const ch = probe?.closest(".chapter");
      const st = ch ? printDepth.get(ch) : undefined;
      const printedOk = !printOn || (!!st && !!pr && st.shown >= pr.bottom - ch!.getBoundingClientRect().top);
      // Les lettres apparaissent aussi une à une : on attend la fin de leur entrée.
      const te = probe ? text.elems.find((e) => e.el === probe || e.el.contains(probe) || probe.contains(e.el)) : undefined;
      const inked = printedOk && (reduced || !te || (te.revealStart >= 0 && now - te.revealStart > 1000));
      if (pr && inked && pr.bottom > 0 && pr.top < cssH && pr.width > 0) {
        const x0 = Math.max(0, Math.floor(pr.left * dpr));
        const y0 = Math.max(0, Math.floor(pr.top * dpr));
        const x1 = Math.min(w, Math.ceil(pr.right * dpr));
        const y1 = Math.min(h, Math.ceil(pr.bottom * dpr));
        const rw = Math.min(1600, x1 - x0);
        const rh = Math.min(600, y1 - y0);
        if (rw > 8 && rh > 8) {
          const bytesPerRow = Math.ceil((rw * 4) / 256) * 256;
          const need = bytesPerRow * rh;
          if (!contrastBuf || contrastBuf.size < need) {
            contrastBuf?.destroy();
            contrastBuf = device.createBuffer({ size: need, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
          }
          enc.copyTextureToBuffer({ texture: outTex, origin: [x0, y0] }, { buffer: contrastBuf, bytesPerRow }, [rw, rh]);
          probeRead = { bytesPerRow, w: rw, h: rh };
          lastContrast = now;
        }
      }
    }
    recorder?.copy(enc, outTex);
    snapshot.copy(enc, outTex);
    device.queue.submit([enc.finish()]);
    snapshot.after();
    if (recorder) {
      recorder.afterSubmit();
      if (recorder.done) recorder = null;
    }
    if (probeRead && contrastBuf) {
      const buf = contrastBuf;
      const pr = probeRead;
      contrastBuf = null; // pas réutilisé pendant la lecture
      contrastBusy = true;
      buf
        .mapAsync(GPUMapMode.READ)
        .then(() => {
          hooks.onContrast?.(measureContrast(new Uint8Array(buf.getMappedRange()), pr.bytesPerRow, pr.w, pr.h, format === "bgra8unorm"));
          buf.unmap();
          contrastBuf ??= buf;
        })
        .catch(() => undefined)
        .finally(() => {
          contrastBusy = false;
        });
    }

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
            const skipped = (!c.bloom && g >= 2 && g <= 4) || (g === 0 && !heroOn && !inkOn && !fluidPlate);
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
    /**
     * Capture vidéo du canvas à pas fixe (WebCodecs, VP9 en WebM). Pendant la
     * capture, l'horloge du moteur est virtuelle : la vidéo est fluide même si
     * la machine ne l'est pas. Les commandes DOM n'apparaissent pas : seul ce
     * que le GPU peint est enregistré.
     */
    record: (o: RecordOptions) => {
      if (recorder) return false;
      recorder = new Recorder(device, canvas, format, performance.now(), o);
      return true;
    },
    stopRecording: () => recorder?.stop(),
    /** Instantané PNG de l'image suivante. */
    snapshot: (cb: (png: Blob | null) => void) => snapshot.request(cb),
    get recording() {
      return recorder !== null;
    },
    /** Remet chaque chapitre au papier vierge : les transitions se rejouent. */
    replayPrint: () => {
      for (const ch of document.querySelectorAll(".chapter, .colophon, [data-gl-print]")) printDepth.set(ch, { shown: 0, target: 0 });
      for (const el of document.querySelectorAll(".is-printed")) el.classList.remove("is-printed");
    },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      removeEventListener("focusin", onFocus);
      for (const el of document.querySelectorAll(".is-printed")) el.classList.remove("is-printed");
      images.destroy();
      text.texture.destroy();
      msdfTex.destroy();
      contrastBuf?.destroy();
      fluid.destroy();
      sheetBuf.destroy();
      traceA.destroy();
      traceB.destroy();
      traceBuf.destroy();
      fireBuf.destroy();
      procBuf.destroy();
      bodyBuf.destroy();
      dropBuf.destroy();
      scene?.destroy();
      bloomTex?.destroy();
      device.destroy();
    },
  };
}

export type Engine = Awaited<ReturnType<typeof createEngine>>;

/**
 * Rapport de contraste WCAG d'une zone de texte : le papier est la luminance
 * médiane, l'encre le 1er centile (le cœur des lettres, pas leurs bords lissés).
 */
export function measureContrast(px: Uint8Array, bytesPerRow: number, w: number, h: number, bgra: boolean) {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L: number[] = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const o = y * bytesPerRow + x * 4;
      const r = px[o + (bgra ? 2 : 0)]!;
      const g = px[o + 1]!;
      const b = px[o + (bgra ? 0 : 2)]!;
      L.push(0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b));
    }
  }
  L.sort((a, b) => a - b);
  const ink = L[Math.floor(L.length * 0.01)] ?? 0;
  const paper = L[Math.floor(L.length * 0.5)] ?? 1;
  return (paper + 0.05) / (ink + 0.05);
}

function ease(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/* ───────────────────────── Fluide (chapitre 08.2) ───────────────────────── */

const VEL_W = 160;
const VEL_H = 120;
const DYE_W = 512;
const DYE_H = 384;
const JACOBI = 20;

type FluidStep = {
  dt: number;
  photo: { texture: GPUTexture | null };
  uv: readonly number[];
  aspect: number;
  pointer: [number, number];
  inside: boolean;
  force: [number, number];
  strength: number;
  dry: number;
};

function createFluid(device: GPUDevice, sampler: GPUSampler) {
  const C = GPUShaderStage.COMPUTE;
  const tex = (w: number, h: number, format: GPUTextureFormat, label: string) =>
    device.createTexture({
      label,
      size: [w, h],
      format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    });
  const velA = tex(VEL_W, VEL_H, "rgba16float", "vel-a");
  const velB = tex(VEL_W, VEL_H, "rgba16float", "vel-b");
  const div = tex(VEL_W, VEL_H, "r32float", "div");
  const pA = tex(VEL_W, VEL_H, "r32float", "p-a");
  const pB = tex(VEL_W, VEL_H, "r32float", "p-b");
  const dye = [tex(DYE_W, DYE_H, "rgba16float", "dye-a"), tex(DYE_W, DYE_H, "rgba16float", "dye-b")] as const;
  let cur: 0 | 1 = 0;
  let primed = false;

  const ubuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const g0Layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: C, buffer: { type: "uniform" } },
      { binding: 1, visibility: C, sampler: { type: "filtering" } },
    ],
  });
  const g0 = device.createBindGroup({
    layout: g0Layout,
    entries: [
      { binding: 0, resource: { buffer: ubuf } },
      { binding: 1, resource: sampler },
    ],
  });
  const t = (sampleType: GPUTextureSampleType = "float"): GPUBindGroupLayoutEntry["texture"] => ({ sampleType });
  const st = (format: GPUTextureFormat): GPUBindGroupLayoutEntry["storageTexture"] => ({ access: "write-only", format });
  const layout = (...entries: Omit<GPUBindGroupLayoutEntry, "binding" | "visibility">[]) =>
    device.createBindGroupLayout({ entries: entries.map((e, i) => ({ binding: i, visibility: C, ...e })) });

  const advLayout = layout({ texture: t() }, { storageTexture: st("rgba16float") });
  const divLayout = layout({ texture: t() }, { storageTexture: st("r32float") });
  const jacLayout = layout({ texture: t("unfilterable-float") }, { texture: t("unfilterable-float") }, { storageTexture: st("r32float") });
  const projLayout = layout({ texture: t("unfilterable-float") }, { texture: t() }, { storageTexture: st("rgba16float") });
  const dyeLayout = layout({ texture: t() }, { texture: t() }, { texture: t() }, { storageTexture: st("rgba16float") });

  const mod = device.createShaderModule({ label: "fluid", code: FLUID });
  const pipe = (entryPoint: string, l: GPUBindGroupLayout) =>
    device.createComputePipeline({
      label: entryPoint,
      layout: device.createPipelineLayout({ bindGroupLayouts: [g0Layout, l] }),
      compute: { module: mod, entryPoint },
    });
  const advPipe = pipe("advect_vel", advLayout);
  const divPipe = pipe("divergence", divLayout);
  const jacPipe = pipe("jacobi", jacLayout);
  const projPipe = pipe("project", projLayout);
  const dyePipe = pipe("advect_dye", dyeLayout);

  const bg = (l: GPUBindGroupLayout, ...res: GPUTexture[]) =>
    device.createBindGroup({ layout: l, entries: res.map((r, i) => ({ binding: i, resource: r.createView() })) });
  const advBind = bg(advLayout, velA, velB);
  const divBind = bg(divLayout, velB, div);
  const jacAB = bg(jacLayout, pA, div, pB);
  const jacBA = bg(jacLayout, pB, div, pA);
  const projBind = bg(projLayout, pA, velB, velA);
  let dyeBinds: GPUBindGroup[] | null = null;
  let dyePhoto: GPUTexture | null = null;
  const planeBinds = new Map<GPUTexture, GPUBindGroup>();
  const data = new Float32Array(16);

  return {
    /** Groupe de liaison du colorant courant, pour le dessin du plan. */
    dyeBind(images: { bindFor: (t: GPUTexture) => GPUBindGroup }) {
      const d = dye[cur];
      let b = planeBinds.get(d);
      if (!b) {
        b = images.bindFor(d);
        planeBinds.set(d, b);
      }
      return b;
    },
    step(cp: GPUComputePassEncoder, s: FluidStep) {
      if (!s.photo.texture) return;
      if (dyePhoto !== s.photo.texture) {
        dyePhoto = s.photo.texture;
        dyeBinds = [bg(dyeLayout, dye[0], velA, dyePhoto, dye[1]), bg(dyeLayout, dye[1], velA, dyePhoto, dye[0])];
        primed = false;
      }
      const dt = Math.min(1 / 30, s.dt);
      // Séchage : part de la photo d'origine réinjectée par seconde.
      const relax = primed ? 1 - Math.exp(-dt * (0.15 + s.dry * 1.6)) : 1;
      primed = true;
      data.set([dt, relax, s.aspect, 0], 0);
      data.set([s.pointer[0], s.pointer[1], s.inside ? 1 : 0, 0.07], 4);
      data.set([s.force[0], s.force[1], s.strength, 0], 8);
      data.set(s.uv, 12);
      device.queue.writeBuffer(ubuf, 0, data);
      const wg = (w: number, h: number) => [Math.ceil(w / 8), Math.ceil(h / 8)] as const;
      cp.setBindGroup(0, g0);
      cp.setPipeline(advPipe);
      cp.setBindGroup(1, advBind);
      cp.dispatchWorkgroups(...wg(VEL_W, VEL_H));
      cp.setPipeline(divPipe);
      cp.setBindGroup(1, divBind);
      cp.dispatchWorkgroups(...wg(VEL_W, VEL_H));
      cp.setPipeline(jacPipe);
      for (let i = 0; i < JACOBI; i++) {
        cp.setBindGroup(1, i % 2 === 0 ? jacAB : jacBA);
        cp.dispatchWorkgroups(...wg(VEL_W, VEL_H));
      }
      cp.setPipeline(projPipe);
      cp.setBindGroup(1, projBind);
      cp.dispatchWorkgroups(...wg(VEL_W, VEL_H));
      cp.setPipeline(dyePipe);
      cp.setBindGroup(1, dyeBinds![cur]!);
      cp.dispatchWorkgroups(...wg(DYE_W, DYE_H));
      cur = cur === 0 ? 1 : 0;
    },
    destroy() {
      for (const x of [velA, velB, div, pA, pB, ...dye]) x.destroy();
      ubuf.destroy();
    },
  };
}
