/**
 * Banc Carnet : ce que coûtent les effets sur l'appareil où on l'ouvre.
 *
 * Chaque test tient le moteur éveillé (wake), mesure l'intervalle entre deux
 * images avec sa propre boucle, et lit les temps du moteur (onTimings : temps
 * GPU par passe si le navigateur expose timestamp-query). Verdict rapporté à
 * la cadence de l'écran que le gouverneur a déduite (60, 90, 120 Hz).
 *
 *   Tenu         p95 ≤ 1,25 × budget d'une image
 *   Limite       p95 ≤ 2 × budget
 *   Trop lourd   au-delà
 */
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";
import "./banc.css";
import { CUI_EFFECTS, governorState, presse, type Presse } from "../presse/lib.ts";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const status = $("#status");
const tbody = $("#results");

type Row = { test: string; fps: number; p95: number; jank: number; gpu: number | null; scale: number; verdict: string; note?: string };
const rows: Row[] = [];
let timings: { total: number; gpu: boolean }[] = [];
let p: Presse | null = null;

// Images demandées par d'autres que le banc (le moteur, le gouverneur) : pour le test de sommeil.
let foreignRafs = 0;
let ownRaf = false;
const nativeRaf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (cb: FrameRequestCallback) => {
  if (!ownRaf) foreignRafs++;
  return nativeRaf(cb);
};
const raf = (cb: FrameRequestCallback) => {
  ownRaf = true;
  const id = window.requestAnimationFrame(cb);
  ownRaf = false;
  return id;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Intervalles entre images pendant `ms` millisecondes, moteur tenu éveillé. */
function measure(ms: number, during?: (t: number) => void): Promise<number[]> {
  return new Promise((res) => {
    const out: number[] = [];
    timings = [];
    p?.wake(ms + 300);
    const t0 = performance.now();
    let last = t0;
    // performance.now() plutôt que l'horodatage de l'image : certains navigateurs le répètent d'un rappel à l'autre.
    const tick = () => {
      const now = performance.now();
      out.push(now - last);
      last = now;
      during?.(now - t0);
      if (now - t0 < ms) raf(tick);
      else res(out.slice(3)); // les premières images portent le démarrage du test
    };
    raf(tick);
  });
}

function row(test: string, dts: number[], note?: string): Row {
  const sorted = [...dts].sort((a, b) => a - b);
  const q = (x: number) => sorted[Math.min(sorted.length - 1, Math.floor(x * sorted.length))] ?? 0;
  const budget = 1000 / Math.max(30, governorState().hz);
  const p95 = q(0.95);
  const jank = dts.filter((d) => d > budget * 1.5).length / Math.max(1, dts.length);
  const gpuT = timings.filter((t) => t.gpu);
  const gpu = gpuT.length ? gpuT.reduce((a, t) => a + t.total, 0) / gpuT.length : null;
  // Trop peu d'images pour juger (rendu logiciel, onglet en arrière-plan) : on ne conclut pas.
  if (dts.length < 10) return { test, fps: 0, p95: 0, jank: 0, gpu: null, scale: governorState().scale, verdict: "Mesure impossible", note: `${dts.length} image(s) seulement` };
  const verdict = p95 <= budget * 1.25 ? "Tenu" : p95 <= budget * 2 ? "Limite" : "Trop lourd";
  return { test, fps: Math.round(1000 / Math.max(1, q(0.5))), p95: Math.round(p95 * 10) / 10, jank: Math.round(jank * 1000) / 10, gpu: gpu === null ? null : Math.round(gpu * 100) / 100, scale: governorState().scale, verdict, note };
}

function show(r: Row) {
  rows.push(r);
  const tr = document.createElement("tr");
  const cells = [r.test + (r.note ? ` — ${r.note}` : ""), String(r.fps), String(r.p95), `${r.jank} %`, r.gpu === null ? "—" : String(r.gpu), `× ${r.scale}`, r.verdict];
  cells.forEach((c, i) => {
    const td = document.createElement(i === 0 ? "th" : "td");
    if (i === 0) td.setAttribute("scope", "row");
    td.textContent = c;
    if (i === 6) td.dataset.verdict = r.verdict;
    tr.append(td);
  });
  tbody.append(tr);
}

/* ───── Scène ───── */
const WORDS = ["Rappeler le plombier", "Acheter du café", "Réserver le train", "Écrire à Camille", "Arroser les plantes", "Relire le brief", "Payer la cantine", "Trier les photos", "Rendre les livres", "Changer les draps"];
function fillSource(n: number) {
  const src = $("#src");
  src.replaceChildren();
  $("#dst").replaceChildren();
  for (let i = 0; i < n; i++) {
    const li = document.createElement("li");
    li.className = "cn-row";
    li.innerHTML = `<span class="cn-mark"></span><span class="cn-bullet">•</span><span class="cn-time"></span><span class="cn-body"><span class="cn-text" data-gl-text data-gl-morph-id="b:${i}">${WORDS[i % WORDS.length]}</span></span>`;
    src.append(li);
  }
}
function migrateAll(n: number, round: number) {
  const dst = $("#dst");
  dst.replaceChildren();
  for (let i = 0; i < n; i++) {
    const li = document.createElement("li");
    li.className = "cn-row";
    li.innerHTML = `<span class="cn-mark"></span><span class="cn-bullet">•</span><span class="cn-time"></span><span class="cn-body"><span class="cn-text" data-gl-text data-gl-morph-from="b:${i}" data-r="${round}">${WORDS[i % WORDS.length]}</span></span>`;
    dst.append(li);
  }
}

/* ───── Tests ───── */
async function testSleep() {
  status.textContent = "Sommeil : 5 s sans rien toucher…";
  await sleep(2200); // laisser la fenêtre d'éveil se fermer
  const n0 = foreignRafs;
  let asleepTicks = 0;
  for (let i = 0; i < 50; i++) {
    await sleep(100);
    if (p?.engine?.asleep) asleepTicks++;
  }
  const n = foreignRafs - n0;
  const r: Row = { test: "Sommeil du moteur", fps: 0, p95: 0, jank: 0, gpu: null, scale: governorState().scale, verdict: n === 0 ? "Tenu" : n < 30 ? "Limite" : "Trop lourd", note: `${n} image(s) en 5 s, endormi ${asleepTicks * 2} % du temps` };
  show(r);
}
async function testMorph() {
  status.textContent = "Morphing : 20 tâches migrent en même temps…";
  fillSource(20);
  p?.relayout();
  await sleep(1800);
  migrateAll(20, 1);
  show(row("Migration ×20", await measure(2000)));
}
async function testDust() {
  status.textContent = "Poussière : 4 s…";
  $("#dust").dataset.glMaterial = "poussiere";
  p?.relayout();
  await sleep(300);
  show(row("Matière poussière", await measure(4000)));
  delete $("#dust").dataset.glMaterial;
  p?.relayout();
}
async function testCui(name: (typeof CUI_EFFECTS)[number], label: string) {
  status.textContent = `${label} : 4 s, pointeur simulé…`;
  if (!p) return;
  p.settings.cui.effect = CUI_EFFECTS.indexOf(name);
  const w = innerWidth;
  const h = innerHeight;
  const dts = await measure(4000, (t) => {
    // Un pointeur qui balaie l'écran en huit, pour que l'effet travaille.
    const x = w / 2 + Math.sin(t / 420) * w * 0.38;
    const y = h / 2 + Math.sin(t / 210) * h * 0.3;
    dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, pointerType: "mouse", bubbles: true }));
  });
  p.settings.cui.effect = 0;
  show(row(label, dts));
}
async function runAll() {
  if (!p?.engine) return;
  rows.length = 0;
  tbody.replaceChildren();
  for (const b of document.querySelectorAll<HTMLButtonElement>("button")) b.disabled = true;
  await testSleep();
  await testMorph();
  await testDust();
  await testCui("tissu", "Tissu");
  await testCui("particules", "Particules");
  for (const b of document.querySelectorAll<HTMLButtonElement>("button")) b.disabled = false;
  status.textContent = "Terminé. « Copier les résultats » pour me les envoyer.";
}

type BatteryLike = { level: number; charging: boolean };
async function runBattery() {
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
  if (!nav.getBattery) {
    status.textContent = "Ce navigateur ne donne pas le niveau de batterie.";
    return;
  }
  const b = await nav.getBattery();
  if (b.charging) {
    status.textContent = "Débranche le téléphone : la mesure n'a de sens que sur batterie.";
    return;
  }
  for (const x of document.querySelectorAll<HTMLButtonElement>("button")) x.disabled = true;
  const l0 = b.level;
  fillSource(20);
  p?.relayout();
  const t0 = performance.now();
  let round = 0;
  // Usage soutenu, pire cas réaliste : une migration de 20 tâches toutes les 1,5 s pendant 2 minutes.
  while (performance.now() - t0 < 120_000) {
    migrateAll(20, ++round);
    status.textContent = `Batterie : ${Math.round((performance.now() - t0) / 1000)} / 120 s…`;
    await sleep(1500);
  }
  const drop = (l0 - b.level) * 100;
  const r: Row = { test: "Batterie, usage soutenu", fps: 0, p95: 0, jank: 0, gpu: null, scale: governorState().scale, verdict: drop * 30 <= 15 ? "Tenu" : drop * 30 <= 30 ? "Limite" : "Trop lourd", note: `${drop.toFixed(1)} % en 2 min, soit ≈ ${(drop * 30).toFixed(0)} %/h (résolution : 1 %)` };
  show(r);
  for (const x of document.querySelectorAll<HTMLButtonElement>("button")) x.disabled = false;
  status.textContent = "Mesure de batterie terminée. Au pas de 1 %, refais-la si elle affiche 0.";
}

$("#run-all").addEventListener("click", () => void runAll());
$("#run-battery").addEventListener("click", () => void runBattery());
$("#copy").addEventListener("click", () => {
  const data = JSON.stringify({ device: $("#device").textContent, ua: navigator.userAgent, dpr: devicePixelRatio, screen: [screen.width, screen.height], governor: governorState(), rows }, null, 2);
  navigator.clipboard.writeText(data).then(
    () => (status.textContent = "Résultats copiés."),
    () => (status.textContent = "Copie refusée par le navigateur."),
  );
});

/* ───── Démarrage ───── */
async function describeDevice() {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  const base = `écran ${screen.width}×${screen.height} @${devicePixelRatio}`;
  if (!gpu) return `Sans WebGPU · ${base}`;
  const a = await gpu.requestAdapter();
  const info = a?.info;
  const name = info ? [info.vendor, info.architecture, info.description].filter(Boolean).join(" · ") : "adaptateur inconnu";
  return `WebGPU · ${name || "adaptateur sans nom"} · ${a?.features.has("timestamp-query") ? "temps GPU mesurés" : "temps GPU non exposés"} · ${base}`;
}
void describeDevice().then((d) => ($("#device").textContent = `Appareil : ${d}`));
void presse({ onDemand: true, effects: ["grain"], motion: "normal", onTimings: (t) => timings.push({ total: t.total, gpu: t.gpu }) }).then((x) => {
  p = x;
  if (!x.engine) {
    status.textContent = "WebGPU indisponible : Carnet tournera sans effets sur cet appareil (la page reste son HTML).";
    for (const b of document.querySelectorAll<HTMLButtonElement>("#run-all, #run-battery")) b.disabled = true;
    return;
  }
  fillSource(20);
  status.textContent = "Prêt.";
  (window as unknown as { __banc: object }).__banc = { runAll, rows, presse: x };
});
