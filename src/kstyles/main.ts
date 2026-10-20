import "../k1910/style.css";
import "./style.css";
import { LIGHT, SCENE, STYLE } from "./shaders.ts";

/**
 * Kerguéhennec, huit regards. La même scène 3D, rendue de huit façons ; chaque
 * regard a son menu de cinq entrées, qui dit ce qu'il raconte : l'heure, le
 * lieu, le calque, l'époque, la lumière, la coupe.
 */

type V3 = [number, number, number];
type Cam = { pos: V3; tgt: V3; fov: number };
type Params = {
  cam: Cam;
  sun: V3;
  sunCol: V3;
  sky0: V3;
  sky1: V3;
  fog: [number, number, number, number];
  epoch: number;
  cut: number;
  lights: [number, number, number, number];
};
type Entry = { label: string; text: string; set: Partial<Params> };
type Style = { id: string; name: string; about: string; menu: string; base: Partial<Params>; entries: Entry[]; motion?: "pop" | "points" };

const CAM = {
  chateau: { pos: [5, 2.3, 13.5], tgt: [0, 1.2, 0], fov: 36 } as Cam,
  parc: { pos: [-11.5, 2.6, 8.5], tgt: [-3, 1.8, -4], fov: 44 } as Cam,
  miroir: { pos: [1.6, 0.8, 17], tgt: [0, 1.4, 0], fov: 34 } as Cam,
  dep: { pos: [-1.5, 2.8, 7], tgt: [-9, 0.9, -3], fov: 46 } as Cam,
  entree: { pos: [0, 1.8, 24], tgt: [0, 1.3, 10], fov: 40 } as Cam,
  large: { pos: [9.5, 6, 19], tgt: [0, 0.6, 2], fov: 46 } as Cam,
};

const NATURAL: Params = {
  cam: CAM.chateau,
  sun: [0.55, 0.62, 0.48],
  sunCol: [1.0, 0.95, 0.86],
  sky0: [0.86, 0.88, 0.9],
  sky1: [0.42, 0.6, 0.86],
  fog: [0.82, 0.86, 0.9, 0.012],
  epoch: 2,
  cut: 99,
  lights: [1, 1, 1, 1],
};

const LIEUX = (style: string): Entry[] => [
  { label: "Le Château", text: "Bâti vers 1710 par Olivier Delourme pour les frères Hogguer, restauré après 1872 par Ernest Trilhe pour le comte de Lanjuinais.", set: { cam: CAM.chateau } },
  { label: "Le Parc", text: "Les 170 hectares dessinés en 1872 par Denis Bühler : à la française devant le château, à l'anglaise au nord, avec un arboretum.", set: { cam: CAM.parc } },
  { label: "Le Miroir d'eau", text: "L'étang, conçu comme un miroir d'eau : la façade s'y retourne.", set: { cam: CAM.miroir } },
  { label: "Les Dépendances", text: style === "points" ? "Écuries et communs ; le centre d'art y est installé depuis 1988." : "Écuries, communs et serre autour de la cour.", set: { cam: CAM.dep } },
  { label: "L'Entrée", text: "La grille entre ses deux piliers, au bout de l'avenue.", set: { cam: CAM.entree } },
];

const STYLES: Style[] = [
  {
    id: "monet",
    name: "Série de Monet",
    menu: "Heures",
    about: "La même façade à cinq heures, comme les Cathédrales de Rouen : rendu peint en touches, ombres colorées.",
    base: { cam: { pos: [7, 2.1, 13], tgt: [0, 1.3, 0], fov: 36 }, epoch: 2 },
    entries: [
      { label: "Aube", text: "Lumière rasante de l'est, ombres mauves, brume rose sur le parterre.", set: { sun: [-0.8, 0.14, 0.35], sunCol: [1.05, 0.72, 0.55], sky0: [0.98, 0.8, 0.7], sky1: [0.55, 0.62, 0.82], fog: [0.95, 0.8, 0.76, 0.03] } },
      { label: "Plein midi", text: "Soleil haut, pierre blanche, ombres courtes et bleues.", set: { sun: [0.2, 0.95, 0.3], sunCol: [1.08, 1.02, 0.92], sky0: [0.86, 0.9, 0.98], sky1: [0.32, 0.55, 0.88], fog: [0.86, 0.9, 0.96, 0.008] } },
      { label: "Couchant", text: "La façade s'embrase, les toits virent au violet.", set: { sun: [0.85, 0.16, -0.15], sunCol: [1.15, 0.56, 0.3], sky0: [1.0, 0.62, 0.36], sky1: [0.36, 0.3, 0.56], fog: [0.96, 0.62, 0.45, 0.025] } },
      { label: "Nuit de lune", text: "Une lumière froide, le bleu prend tout.", set: { sun: [0.4, 0.6, 0.5], sunCol: [0.24, 0.3, 0.46], sky0: [0.1, 0.12, 0.22], sky1: [0.02, 0.03, 0.09], fog: [0.08, 0.1, 0.18, 0.02] } },
      { label: "Brume", text: "Le parc s'efface, le château n'est plus qu'une masse.", set: { sun: [0.3, 0.5, 0.6], sunCol: [0.75, 0.75, 0.76], sky0: [0.86, 0.86, 0.85], sky1: [0.8, 0.81, 0.82], fog: [0.86, 0.86, 0.85, 0.12] } },
    ],
  },
  {
    id: "lavis",
    name: "Relevé au lavis",
    menu: "Planches",
    about: "Les planches d'architecte des Beaux-Arts : trait d'encre, lavis d'aquarelle, papier. Le menu passe du plan à la perspective.",
    base: { epoch: 2, sun: [0.45, 0.8, 0.45], sky0: [0.95, 0.92, 0.85], sky1: [0.95, 0.92, 0.85], fog: [0.95, 0.92, 0.85, 0.004] },
    entries: [
      { label: "Plan masse", text: "Le domaine vu d'en haut : château, parterre, miroir d'eau, dépendances.", set: { cam: { pos: [0, 34, 7], tgt: [0, 0, 3], fov: 40 } } },
      { label: "Élévation", text: "La façade presque sans perspective, comme un relevé : onze travées, fronton, pavillons.", set: { cam: { pos: [0, 1.6, 75], tgt: [0, 1.4, 0], fov: 5.6 } } },
      { label: "Le Parc", text: "Le cèdre, les hêtres, les peupliers du parc de Bühler.", set: { cam: CAM.parc } },
      { label: "Les Dépendances", text: "Les écuries à arcades et leur campanile, la serre de verre et de fer.", set: { cam: CAM.dep } },
      { label: "Perspective", text: "La vue d'ensemble, au lavis.", set: { cam: CAM.chateau } },
    ],
  },
  {
    id: "popup",
    name: "Livre animé",
    menu: "Doubles pages",
    about: "Un livre pop-up : à chaque page, le décor se couche puis se redresse, en carton découpé.",
    base: { epoch: 2, sky0: [0.95, 0.92, 0.84], sky1: [0.9, 0.86, 0.76], fog: [0.95, 0.92, 0.84, 0.01], sun: [0.5, 0.75, 0.5] },
    entries: LIEUX("popup"),
    motion: "pop",
  },
  {
    id: "cyano",
    name: "Cyanotype",
    menu: "Calques",
    about: "Le tirage bleu des plans d'architecte. Chaque entrée fait ressortir un calque du domaine.",
    base: { epoch: 4, cam: CAM.large, sun: [0.4, 0.8, 0.5] },
    entries: [
      { label: "Le bâti", text: "Château, écuries, serre, grille : ce qui est construit.", set: { lights: [1, 0.12, 0.12, 0.12] } },
      { label: "Le parc", text: "Les arbres et les buis : ce qui a été planté.", set: { lights: [0.12, 1, 0.12, 0.12] } },
      { label: "Les eaux", text: "Le miroir d'eau et le bassin du parterre.", set: { lights: [0.12, 0.12, 1, 0.12] } },
      { label: "Les œuvres", text: "Les sculptures du parc, installées à partir de 1986.", set: { lights: [0.12, 0.12, 0.12, 1] } },
      { label: "L'ensemble", text: "Tous les calques superposés.", set: { lights: [1, 1, 1, 1] } },
    ],
  },
  {
    id: "temps",
    name: "Le temps du domaine",
    menu: "Époques",
    about: "Le même point de vue à cinq dates : le parc pousse, la serre apparaît, les sculptures arrivent ; chaque époque a son tirage. Reconstitution imaginée.",
    base: { cam: { pos: [7, 3.2, 14], tgt: [0, 1.1, 0], fov: 44 } },
    entries: [
      { label: "1710", text: "Le château neuf de Delourme, un jardin régulier ; gravé en taille-douce.", set: { epoch: 0 } },
      { label: "1872", text: "Le comte de Lanjuinais achète le domaine ; Bühler plante le parc. Lithographie.", set: { epoch: 1 } },
      { label: "1910", text: "Le parc a grandi. Plaque autochrome.", set: { epoch: 2 } },
      { label: "1986", text: "Les premières sculptures entrent dans le parc. Film couleur.", set: { epoch: 3 } },
      { label: "Aujourd'hui", text: "Le domaine du Département, centre d'art et parc de sculptures.", set: { epoch: 4 } },
    ],
  },
  {
    id: "nuit",
    name: "Nocturne",
    menu: "Lumières",
    about: "Le château la nuit : chaque entrée allume une partie du domaine. Brume, lune, lucioles.",
    base: {
      epoch: 4,
      cam: { pos: [6.5, 1.7, 18], tgt: [-2.5, 1.3, 0], fov: 50 },
      sun: [-0.25, 0.32, -0.9],
      sunCol: [0.3, 0.37, 0.55],
      sky0: [0.07, 0.09, 0.16],
      sky1: [0.01, 0.02, 0.06],
      fog: [0.07, 0.09, 0.15, 0.018],
    },
    entries: [
      { label: "Le salon", text: "Les fenêtres de l'avant-corps s'allument.", set: { lights: [1, 0, 0, 0.35] } },
      { label: "Les ailes", text: "Des chambres éclairées, ici et là.", set: { lights: [0, 1, 0, 0.35] } },
      { label: "Les écuries", text: "Les lanternes de la cour.", set: { lights: [0, 0, 1, 0.35] } },
      { label: "La lune", text: "La lune se lève derrière le château et se reflète dans le miroir d'eau.", set: { lights: [0, 0, 0, 1] } },
      { label: "Toutes", text: "Le domaine entier, la nuit d'une fête.", set: { lights: [1, 1, 1, 1] } },
    ],
  },
  {
    id: "maquette",
    name: "Maquette en plâtre",
    menu: "Coupes",
    about: "Une maquette blanche sous une lumière qui tourne ; un plan de coupe ouvre le bâtiment.",
    base: { epoch: 2, cam: { pos: [6.5, 7.5, 12], tgt: [0, 0.8, 0], fov: 38 }, sky0: [0.86, 0.86, 0.85], sky1: [0.72, 0.72, 0.72], fog: [0.86, 0.86, 0.85, 0.0] },
    entries: [
      { label: "Façade", text: "Le volume entier : corps, pavillons, avant-corps à fronton.", set: { cut: 99 } },
      { label: "Rez-de-chaussée", text: "Coupe à hauteur d'homme : refends, enfilade, coquille des murs.", set: { cut: 0.72 } },
      { label: "Étage", text: "Coupe de l'étage noble.", set: { cut: 1.62 } },
      { label: "Combles", text: "Les toits sont tranchés : on voit la charpente en creux.", set: { cut: 2.25 } },
      { label: "Plan", text: "Vu d'en haut, le plan du rez-de-chaussée, poché.", set: { cut: 0.72, cam: { pos: [0, 22, 3.5], tgt: [0, 0, 0.5], fov: 36 } } },
    ],
  },
  {
    id: "points",
    name: "Relevé en points",
    menu: "Lieux",
    about: "Le domaine fait de points, comme un relevé laser ; à chaque lieu, les points se dispersent puis se regroupent.",
    base: { epoch: 4, sky0: [0.05, 0.06, 0.08], sky1: [0.02, 0.02, 0.03], fog: [0.04, 0.05, 0.06, 0.02] },
    entries: LIEUX("points"),
    motion: "points",
  },
];

/* ───── État ───── */

const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
const clone = <T>(p: T): T => JSON.parse(JSON.stringify(p));
/** Réglages d'une entrée : le naturel, puis ceux du style, puis ceux de l'entrée. */
const target = (si: number, ei: number): Params => {
  const s = STYLES[si]!;
  const t = clone(NATURAL);
  Object.assign(t, clone(s.base));
  Object.assign(t, clone(s.entries[ei]!.set));
  return t;
};
const state = {
  style: 0,
  entry: 0,
  cur: target(0, 0),
  goal: target(0, 0),
  phase: 1, // transition propre au style (livre, points)
  phaseStart: 0,
  pendingCam: null as Cam | null,
};

/* ───── Interface ───── */

const tabs = document.querySelector<HTMLElement>("[data-styles]")!;
const menu = document.querySelector<HTMLElement>("[data-entries]")!;
const menuTitle = document.querySelector<HTMLElement>("[data-menu-title]")!;
const card = {
  num: document.querySelector<HTMLElement>("[data-card-num]")!,
  name: document.querySelector<HTMLElement>("[data-card-name]")!,
  text: document.querySelector<HTMLElement>("[data-card-text]")!,
  about: document.querySelector<HTMLElement>("[data-style-about]")!,
};

STYLES.forEach((s, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = s.name;
  b.dataset.style = String(i);
  b.setAttribute("aria-pressed", String(i === 0));
  b.addEventListener("click", () => chooseStyle(i));
  tabs.append(b);
});

const ROMAN = ["I", "II", "III", "IV", "V"];
function buildMenu() {
  const s = STYLES[state.style]!;
  menuTitle.textContent = s.menu;
  menu.textContent = "";
  s.entries.forEach((e, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.entry = String(i);
    b.setAttribute("aria-pressed", String(i === state.entry));
    b.innerHTML = `<span class="k-num">${ROMAN[i]}</span><span class="k-name"></span>`;
    b.querySelector(".k-name")!.textContent = e.label;
    b.addEventListener("click", () => chooseEntry(i));
    b.addEventListener("keydown", (ev) => {
      const d = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      ev.preventDefault();
      const j = (i + d + 5) % 5;
      (menu.querySelectorAll("button")[j] as HTMLButtonElement).focus();
      chooseEntry(j);
    });
    li.append(b);
    menu.append(li);
  });
  showCard();
}

function showCard() {
  const s = STYLES[state.style]!;
  const e = s.entries[state.entry]!;
  card.num.textContent = `${s.name} · ${ROMAN[state.entry]}`;
  card.name.textContent = e.label;
  card.text.textContent = e.text;
  card.about.textContent = s.about;
  for (const b of menu.querySelectorAll("button")) b.setAttribute("aria-pressed", String(Number((b as HTMLElement).dataset.entry) === state.entry));
  for (const b of tabs.querySelectorAll("button")) b.setAttribute("aria-pressed", String(Number((b as HTMLElement).dataset.style) === state.style));
  document.documentElement.dataset.style = s.id;
}

function chooseStyle(i: number) {
  state.style = i;
  state.entry = 0;
  state.goal = target(i, 0);
  state.cur = clone(state.goal);
  state.phase = 1;
  state.pendingCam = null;
  buildMenu();
}

function chooseEntry(i: number) {
  if (i === state.entry) return;
  state.entry = i;
  const goal = target(state.style, i);
  const s = STYLES[state.style]!;
  if (s.motion && !reducedQuery.matches) {
    // Le livre se replie (ou les points se dispersent) avant que la caméra parte.
    state.phase = 0;
    state.phaseStart = performance.now();
    state.pendingCam = goal.cam;
    goal.cam = state.goal.cam;
  }
  state.goal = goal;
  showCard();
}

buildMenu();

/* ───── WebGPU ───── */

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (t: number) => t * t * (3 - 2 * t);

async function start() {
  const canvas = document.getElementById("k-gl") as HTMLCanvasElement;
  if (!navigator.gpu) throw new Error("WebGPU absent");
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("Aucun adaptateur WebGPU");
  const device = await adapter.requestDevice();
  const ctx = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "opaque" });

  const mods = [SCENE, LIGHT, STYLE].map((code) => device.createShaderModule({ code }));
  for (const m of mods) {
    const errs = (await m.getCompilationInfo()).messages.filter((x) => x.type === "error");
    if (errs.length) throw new Error(errs.map((e) => `${e.lineNum}:${e.message}`).join(" | "));
  }
  const [sceneMod, lightMod, styleMod] = mods as [GPUShaderModule, GPUShaderModule, GPUShaderModule];
  const F = GPUShaderStage.FRAGMENT;
  const uLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: F, buffer: { type: "uniform" } }] });
  const uf = { sampleType: "unfilterable-float" as const };
  const gLayout = device.createBindGroupLayout({
    entries: [0, 1, 2].map((binding) => ({ binding, visibility: F, texture: uf })),
  });
  const sLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: F, texture: { sampleType: "float" } },
      { binding: 1, visibility: F, texture: uf },
      { binding: 2, visibility: F, texture: uf },
      { binding: 3, visibility: F, sampler: { type: "filtering" } },
    ],
  });
  const G: GPUTextureFormat = "rgba16float";
  const pipe = (mod: GPUShaderModule, layouts: GPUBindGroupLayout[], targets: GPUColorTargetState[]) =>
    device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: layouts }),
      vertex: { module: mod, entryPoint: "vs" },
      fragment: { module: mod, entryPoint: "fs", targets },
      primitive: { topology: "triangle-list" },
    });
  const scenePipe = pipe(sceneMod, [uLayout], [{ format: G }, { format: G }, { format: G }]);
  const lightPipe = pipe(lightMod, [uLayout, gLayout], [{ format: G }]);
  const stylePipe = pipe(styleMod, [uLayout, sLayout], [{ format }]);

  const uBuf = device.createBuffer({ size: 12 * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const uBind = device.createBindGroup({ layout: uLayout, entries: [{ binding: 0, resource: { buffer: uBuf } }] });
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

  let scale = 0.55;
  let tex: GPUTexture[] = [];
  let gBind: GPUBindGroup | null = null;
  let sBind: GPUBindGroup | null = null;
  let gw = 0;
  let gh = 0;
  const alloc = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    const nw = Math.max(2, Math.round(w * scale));
    const nh = Math.max(2, Math.round(h * scale));
    if (canvas.width === w && canvas.height === h && nw === gw && nh === gh && tex.length) return dpr;
    canvas.width = w;
    canvas.height = h;
    gw = nw;
    gh = nh;
    for (const t of tex) t.destroy();
    tex = [0, 1, 2, 3].map(() => device.createTexture({ size: [gw, gh], format: G, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }));
    gBind = device.createBindGroup({ layout: gLayout, entries: [0, 1, 2].map((i) => ({ binding: i, resource: tex[i]!.createView() })) });
    sBind = device.createBindGroup({
      layout: sLayout,
      entries: [
        { binding: 0, resource: tex[3]!.createView() },
        { binding: 1, resource: tex[0]!.createView() },
        { binding: 2, resource: tex[1]!.createView() },
        { binding: 3, resource: sampler },
      ],
    });
    return dpr;
  };

  document.documentElement.classList.add("k-gpu");
  const t0 = performance.now();
  let last = t0;
  let slowFrames = 0;
  let fastFrames = 0;
  const uData = new Float32Array(48);

  const frame = () => {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const now = performance.now();
    const dtMs = now - last;
    const dt = Math.min(0.1, dtMs / 1000);
    last = now;
    // La résolution du lancer de rayons suit le temps réel des images.
    if (dtMs > 30) slowFrames++;
    else if (dtMs < 14) fastFrames++;
    if (slowFrames > 20 && scale > 0.34) {
      scale -= 0.07;
      slowFrames = 0;
    }
    if (fastFrames > 90 && scale < 0.8) {
      scale += 0.05;
      fastFrames = 0;
    }
    const dpr = alloc();
    const reduced = reducedQuery.matches;
    const time = reduced ? 0 : (now - t0) / 1000;
    const s = STYLES[state.style]!;

    // Transition propre au style.
    let pop = 1;
    let scatter = 0;
    if (state.phase < 1) {
      state.phase = Math.min(1, (now - state.phaseStart) / 1800);
      const ph = state.phase;
      if (ph >= 0.4 && state.pendingCam) {
        state.goal.cam = state.pendingCam;
        state.pendingCam = null;
      }
      if (s.motion === "pop") pop = ph < 0.4 ? 1 - ease(ph / 0.4) : ph < 0.55 ? 0 : ease((ph - 0.55) / 0.45);
      if (s.motion === "points") scatter = Math.sin(ph * Math.PI);
    }

    // Les réglages glissent vers ceux de l'entrée choisie.
    const k = reduced ? 1 : 1 - Math.exp(-dt * 2.4);
    const c = state.cur;
    const g = state.goal;
    for (let i = 0; i < 3; i++) {
      c.cam.pos[i] = lerp(c.cam.pos[i]!, g.cam.pos[i]!, k);
      c.cam.tgt[i] = lerp(c.cam.tgt[i]!, g.cam.tgt[i]!, k);
      c.sun[i] = lerp(c.sun[i]!, g.sun[i]!, k);
      c.sunCol[i] = lerp(c.sunCol[i]!, g.sunCol[i]!, k);
      c.sky0[i] = lerp(c.sky0[i]!, g.sky0[i]!, k);
      c.sky1[i] = lerp(c.sky1[i]!, g.sky1[i]!, k);
    }
    for (let i = 0; i < 4; i++) {
      c.fog[i] = lerp(c.fog[i]!, g.fog[i]!, k);
      c.lights[i] = lerp(c.lights[i]!, g.lights[i]!, k);
    }
    c.cam.fov = lerp(c.cam.fov, g.cam.fov, k);
    c.epoch = lerp(c.epoch, g.epoch, k * 0.8);
    c.cut = g.cut > 50 || c.cut > 50 ? g.cut : lerp(c.cut, g.cut, k);
    // Maquette : la lumière du studio tourne lentement autour de la scène.
    let sun = c.sun;
    if (s.id === "maquette") {
      const a = reduced ? 0.9 : time * 0.18 + 0.9;
      sun = [Math.cos(a) * 0.8, 0.5, Math.sin(a) * 0.8];
    }

    uData.set([...c.cam.pos, (c.cam.fov * Math.PI) / 180], 0);
    uData.set([...c.cam.tgt, 0], 4);
    uData.set([gw, gh, time, reduced ? 1 : 0], 8);
    uData.set([...sun, 0], 12);
    uData.set([state.style, state.entry, state.phase, c.cut], 16);
    uData.set([c.epoch, pop, scatter, 0], 20);
    uData.set(c.lights, 24);
    uData.set([...c.sunCol, 0], 28);
    uData.set([...c.sky0, 0], 32);
    uData.set([...c.sky1, 0], 36);
    uData.set(c.fog, 40);
    uData.set([canvas.width, canvas.height, dpr, 0], 44);
    device.queue.writeBuffer(uBuf, 0, uData);

    const enc = device.createCommandEncoder();
    const a = enc.beginRenderPass({
      colorAttachments: [0, 1, 2].map((i) => ({ view: tex[i]!.createView(), loadOp: "clear" as const, storeOp: "store" as const, clearValue: [0, 0, 0, 0] })),
    });
    a.setPipeline(scenePipe);
    a.setBindGroup(0, uBind);
    a.draw(3);
    a.end();
    const b = enc.beginRenderPass({ colorAttachments: [{ view: tex[3]!.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
    b.setPipeline(lightPipe);
    b.setBindGroup(0, uBind);
    b.setBindGroup(1, gBind!);
    b.draw(3);
    b.end();
    const cpass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
    cpass.setPipeline(stylePipe);
    cpass.setBindGroup(0, uBind);
    cpass.setBindGroup(1, sBind!);
    cpass.draw(3);
    cpass.end();
    device.queue.submit([enc.finish()]);
  };
  requestAnimationFrame(frame);
}

start().catch((err) => {
  console.warn("[kerguehennec-styles]", err);
  document.documentElement.classList.add("k-nogpu");
  const s = document.querySelector("[data-k-status]");
  if (s) s.textContent = "Sans WebGPU : les regards restent décrits en texte.";
});
