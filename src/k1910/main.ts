import "./style.css";
import { DECOR, EPREUVE } from "./shaders.ts";
import { mountDebugPanel, setDebugCaps } from "../debug-panel.ts";
import { clockNow, recordable } from "../gpu/recorder.ts";
import { mountPagesNav } from "../pages-nav.ts";

mountPagesNav();
mountDebugPanel();

/**
 * Kerguéhennec, 1910. Le menu (cinq boutons du DOM) choisit un tableau ;
 * le GPU monte le décor correspondant comme un théâtre de papier : des
 * châssis plats posés en profondeur, qui glissent depuis les coulisses
 * pendant qu'un iris ferme puis rouvre l'image.
 */

type Tableau = { num: string; name: string; text: string; alt: string };

const TABLEAUX: Tableau[] = [
  {
    num: "I",
    name: "Le Château",
    text: "Bâti vers 1710 par Olivier Delourme pour les frères Hogguer, financiers suisses de la Compagnie des Indes. Le comte Paul-Henri de Lanjuinais l'achète en 1872 et le fait restaurer par Ernest Trilhe.",
    alt: "Le château vu de face : corps central à fronton, deux pavillons, toits d'ardoise et cheminées ; devant, un parterre de buis et l'allée de gravier.",
  },
  {
    num: "II",
    name: "Le Parc",
    text: "En 1872, Denis Bühler dessine les 170 hectares : jardin à la française devant le château, parc à l'anglaise au nord, et un arboretum.",
    alt: "Un cèdre aux branches en étages, un hêtre, un peuplier ; une allée serpente vers l'arboretum.",
  },
  {
    num: "III",
    name: "Le Miroir d'eau",
    text: "L'étang fut d'abord conçu comme un miroir d'eau : la façade s'y retourne, brisée par les rides.",
    alt: "Le château au loin, au-delà de l'étang, et son reflet tremblé dans l'eau ; des roseaux au premier plan.",
  },
  {
    num: "IV",
    name: "Les Dépendances",
    text: "Écuries, communs et serre autour de la cour. Une calèche attend ; depuis 1988, le centre d'art occupe ces bâtiments.",
    alt: "De longues écuries à portes cintrées sous un campanile, une serre de verre et de fer, une calèche dans la cour.",
  },
  {
    num: "V",
    name: "Visiter",
    text: "À Bignan, dans le Morbihan. Le domaine appartient au Département ; parc de sculptures depuis 1986, château monument historique depuis 1988.",
    alt: "La grille d'entrée entre deux piliers à pots à feu, au bout d'une avenue d'arbres.",
  },
];

/** Profondeur des châssis : ciel, lointain, sujet, plan moyen, premier plan, cadre. */
const DEPTH = [-30, -18, -10, -6, -2, 3];
const CAM_Z = 10;
const FOV = (32 * Math.PI) / 180;
const MARGIN = 1.22;
/** ?ralenti=10 : le temps de la page passe dix fois moins vite (démonstration, recette). */
const SLOW = Math.max(1, Number(new URLSearchParams(location.search).get("ralenti")) || 1);
const TRANSITION = 1.7 * SLOW;

const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
const state = {
  scene: 0,
  from: 0,
  to: 0,
  tr: 1, // 0…1 pendant une transition, 1 au repos
  trStart: 0,
  curtain: 1,
  curtainStart: -1,
  flicker: true,
  engraving: 1,
  pointer: [0, 0] as [number, number],
  cam: [0, 0] as [number, number],
};

/* ───── Interface ───── */

const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-scene]")];
const card = {
  num: document.querySelector<HTMLElement>("[data-card-num]")!,
  name: document.querySelector<HTMLElement>("[data-card-name]")!,
  text: document.querySelector<HTMLElement>("[data-card-text]")!,
  alt: document.querySelector<HTMLElement>("[data-card-alt]")!,
};

function showCard(i: number) {
  const t = TABLEAUX[i]!;
  card.num.textContent = `Tableau ${t.num}`;
  card.name.textContent = t.name;
  card.text.textContent = t.text;
  card.alt.textContent = `Image : ${t.alt}`;
  // Sans WebGPU, le décor se raconte : la scène affiche sa description.
  const fb = document.querySelector("[data-fallback-alt]");
  if (fb) fb.textContent = t.alt;
  for (const b of buttons) b.setAttribute("aria-pressed", String(Number(b.dataset.scene) === i));
  document.documentElement.dataset.scene = String(i);
}

function choose(i: number) {
  if (i === state.to && state.tr >= 1) return;
  if (reducedQuery.matches || !gpuReady) {
    state.scene = state.from = state.to = i;
    state.tr = 1;
  } else {
    state.from = state.scene;
    state.to = i;
    state.tr = 0;
    state.trStart = clockNow();
  }
  showCard(i);
}

buttons.forEach((b, idx) => {
  b.addEventListener("click", () => choose(Number(b.dataset.scene)));
  b.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = buttons[(idx + d + buttons.length) % buttons.length]!;
    n.focus();
    choose(Number(n.dataset.scene));
  });
});
const flickBtn = document.querySelector<HTMLButtonElement>("[data-flicker]");
flickBtn?.addEventListener("click", () => {
  state.flicker = !state.flicker;
  flickBtn.setAttribute("aria-pressed", String(state.flicker));
});
const engrBtn = document.querySelector<HTMLButtonElement>("[data-engraving]");
engrBtn?.addEventListener("click", () => {
  state.engraving = state.engraving > 0.5 ? 0 : 1;
  engrBtn.setAttribute("aria-pressed", String(state.engraving > 0.5));
});
showCard(0);

const stage = document.querySelector<HTMLElement>(".k-stage")!;
stage.addEventListener("pointermove", (e) => {
  const r = stage.getBoundingClientRect();
  state.pointer = [((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1];
});
stage.addEventListener("pointerleave", () => (state.pointer = [0, 0]));

/* ───── Matrices (colonnes) ───── */

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  // Profondeur WebGPU : 0…1.
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far / (near - far), -1, 0, 0, (near * far) / (near - far), 0]);
}
function lookAt(eye: number[], at: number[]) {
  const z = norm([eye[0]! - at[0]!, eye[1]! - at[1]!, eye[2]! - at[2]!]);
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  return new Float32Array([x[0]!, y[0]!, z[0]!, 0, x[1]!, y[1]!, z[1]!, 0, x[2]!, y[2]!, z[2]!, 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}
const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
const norm = (a: number[]) => {
  const l = Math.hypot(a[0]!, a[1]!, a[2]!);
  return [a[0]! / l, a[1]! / l, a[2]! / l];
};
function mul4(a: Float32Array, b: Float32Array) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
    o[c * 4 + r] = s;
  }
  return o;
}
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/* ───── WebGPU ───── */

let gpuReady = false;

async function start() {
  const canvas = document.getElementById("k-gl") as HTMLCanvasElement;
  if (!navigator.gpu) throw new Error("WebGPU absent");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("Aucun adaptateur WebGPU");
  const device = await adapter.requestDevice();
  const ctx = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "opaque", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  // Débogage : capture vidéo à pas fixe, comme sur la démo principale.
  const rec = recordable(device, canvas, format);
  setDebugCaps(rec.caps);

  const decorMod = device.createShaderModule({ code: DECOR });
  const postMod = device.createShaderModule({ code: EPREUVE });
  for (const m of [decorMod, postMod]) {
    const errs = (await m.getCompilationInfo()).messages.filter((x) => x.type === "error");
    if (errs.length) throw new Error(errs.map((e) => `${e.lineNum}:${e.message}`).join(" | "));
  }

  const gLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }] });
  const fLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: 48 } }],
  });
  const premul: GPUBlendState = {
    color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
  };
  const SCENE_FORMAT: GPUTextureFormat = "rgba16float";
  const decorPipe = await device.createRenderPipelineAsync({
    layout: device.createPipelineLayout({ bindGroupLayouts: [gLayout, fLayout] }),
    vertex: { module: decorMod, entryPoint: "vs" },
    fragment: { module: decorMod, entryPoint: "fs", targets: [{ format: SCENE_FORMAT, blend: premul }] },
    primitive: { topology: "triangle-strip" },
  });
  const postPipe = await device.createRenderPipelineAsync({
    layout: "auto",
    vertex: { module: postMod, entryPoint: "vs" },
    fragment: { module: postMod, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });

  const gBuf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const STRIDE = 256;
  const MAX = 16;
  const fBuf = device.createBuffer({ size: STRIDE * MAX, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const fData = new Float32Array((STRIDE * MAX) / 4);
  const pBuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const gBind = device.createBindGroup({ layout: gLayout, entries: [{ binding: 0, resource: { buffer: gBuf } }] });
  const fBind = device.createBindGroup({ layout: fLayout, entries: [{ binding: 0, resource: { buffer: fBuf, size: 48 } }] });
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

  let sceneTex: GPUTexture | null = null;
  let postBind: GPUBindGroup | null = null;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h && sceneTex) return dpr;
    canvas.width = w;
    canvas.height = h;
    sceneTex?.destroy();
    sceneTex = device.createTexture({ size: [w, h], format: SCENE_FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    postBind = device.createBindGroup({
      layout: postPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: pBuf } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: sceneTex.createView() },
      ],
    });
    return dpr;
  };

  gpuReady = true;
  document.documentElement.classList.add("k-gpu");
  const t0 = clockNow();
  let last = t0;

  const frame = () => {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    // Même horloge que celle du clic (performance.now) : l'horodatage passé
    // par requestAnimationFrame peut la devancer.
    const now = clockNow();
    const dpr = resize();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const reduced = reducedQuery.matches;
    const time = reduced ? 0 : (now - t0) / 1000;

    // Rideau d'ouverture, puis transitions entre tableaux, en temps réel :
    // elles durent autant, quelle que soit la cadence d'affichage.
    if (state.curtainStart < 0) state.curtainStart = now + 400;
    state.curtain = reduced ? 0 : clamp01(1 - (now - state.curtainStart) / (1600 * SLOW));
    if (state.tr < 1) {
      state.tr = reduced ? 1 : clamp01((now - state.trStart) / (TRANSITION * 1000));
      if (state.tr >= 0.45 && state.scene !== state.to) state.scene = state.to;
    }
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3);
    state.cam[0] += ((reduced ? 0 : state.pointer[0]) - state.cam[0]) * k;
    state.cam[1] += ((reduced ? 0 : state.pointer[1]) - state.cam[1]) * k;

    const aspect = canvas.width / canvas.height;
    // Caméra du stéréoscope : elle se déplace d'un souffle avec le pointeur.
    const eye = [state.cam[0] * 0.35, -state.cam[1] * 0.2, CAM_Z];
    const view = lookAt(eye, [state.cam[0] * 0.08, -state.cam[1] * 0.05, 0]);
    const vp = mul4(perspective(FOV, aspect, 0.5, 100), view);
    const curtain = ease(state.curtain);
    device.queue.writeBuffer(gBuf, 0, new Float32Array([...vp, time, reduced ? 1 : 0, curtain, 0]));

    // Châssis : pendant la première moitié de la transition, ceux du tableau
    // sortant filent vers les coulisses ; puis ceux du nouveau entrent par
    // l'autre côté, couche après couche.
    const jobs: number[] = [];
    let n = 0;
    const push = (layer: number, scene: number, slide: number, alpha: number) => {
      if (n >= MAX || alpha <= 0.001) return;
      const z = DEPTH[layer]!;
      const halfH = (CAM_Z - z) * Math.tan(FOV / 2);
      const h = 2 * halfH * MARGIN;
      const w = h * aspect;
      const o = (n * STRIDE) / 4;
      fData.set([-w / 2 + slide * w, -h / 2, w, h], o);
      fData.set([z, scene, layer, alpha], o + 4);
      fData.set([aspect, MARGIN, 0, 0], o + 8);
      jobs.push(n * STRIDE);
      n++;
    };
    const tr = state.tr;
    const out = clamp01(tr / 0.45);
    const inn = clamp01((tr - 0.45) / 0.55);
    for (let layer = 0; layer < 5; layer++) {
      const dir = layer % 2 ? -1 : 1;
      if (layer === 0) {
        push(0, state.scene, 0, 1);
        continue;
      }
      if (tr < 0.45) {
        push(layer, state.from, dir * ease(out) * (0.9 + layer * 0.08), 1);
      } else {
        const stagger = clamp01(inn * 1.4 - (4 - layer) * 0.1);
        push(layer, state.to, -dir * (1 - ease(stagger)) * (0.9 + layer * 0.08), 1);
      }
    }
    push(5, state.scene, 0, 1);
    device.queue.writeBuffer(fBuf, 0, fData, 0, (n * STRIDE) / 4);

    // Iris : il se ferme sur le sujet, puis se rouvre sur le nouveau tableau.
    const iris = tr >= 1 ? 1 : tr < 0.45 ? 1 - ease(out) : ease(inn);
    device.queue.writeBuffer(
      pBuf,
      0,
      new Float32Array([canvas.width, canvas.height, dpr, time, iris, state.flicker && !reduced ? 1 : 0, reduced ? 1 : 0, state.engraving, canvas.width * 0.5, canvas.height * 0.46, 0, 0]),
    );

    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: sceneTex!.createView(), loadOp: "clear", storeOp: "store", clearValue: [0.05, 0.045, 0.04, 1] }],
    });
    pass.setPipeline(decorPipe);
    pass.setBindGroup(0, gBind);
    for (const off of jobs) {
      pass.setBindGroup(1, fBind, [off]);
      pass.draw(4);
    }
    pass.end();
    const post = enc.beginRenderPass({
      colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }],
    });
    post.setPipeline(postPipe);
    post.setBindGroup(0, postBind!);
    post.draw(3);
    post.end();
    rec.copy(enc, ctx.getCurrentTexture());
    device.queue.submit([enc.finish()]);
    rec.after();
  };
  requestAnimationFrame(frame);
}

start().catch((err) => {
  console.warn("[kerguehennec]", err);
  document.documentElement.classList.add("k-nogpu");
  const s = document.querySelector("[data-k-status]");
  if (s) s.textContent = "Sans WebGPU : les tableaux restent décrits en texte.";
});
