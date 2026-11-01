import "./style.css";
import { mountDebugPanel } from "../debug-panel.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { enhanceAngles } from "../presse/angle.ts";
import { recoverable } from "../components/device.ts";
import { INK_SETS, LIQUID_TINTS, PRESETS, mountFluide, type FluidApi, type FluidConfig, type Mode } from "./sph.ts";

/**
 * Page « Fluide » : une simulation SPH plein écran (src/fluide/sph.ts) et son panneau de réglages. Le panneau est
 * branché une fois et lit l'instance courante (elle change après une perte du GPU) ; chaque nouvelle instance reprend
 * ce que le panneau affiche.
 */
mountPagesNav();
mountDebugPanel();
enhanceAngles();

const stage = document.querySelector<HTMLElement>("[data-fl]")!;
const panel = document.querySelector<HTMLElement>(".fl-panel")!;
const details = panel.querySelector<HTMLDetailsElement>("[data-fl-details]")!;
if (matchMedia("(max-width: 720px)").matches) details.open = false;

let api: FluidApi | null = null;
const state: Partial<FluidConfig> & { mode: Mode } = { mode: "champ", speed: 1, paused: false, ...PRESETS.champ };

const COLORS: Record<FluidConfig["render"], { key: "points" | "tint" | "inks"; options: [string, string][] }> = {
  points: { key: "points", options: [["leitl", "Leitl (vitesse)"], ["braise", "Braise (vitesse)"], ["glace", "Glace (vitesse)"], ["encres", "Encres"]] },
  liquide: { key: "tint", options: Object.entries(LIQUID_TINTS).map(([k, v]) => [k, v.label]) },
  encres: { key: "inks", options: Object.entries(INK_SETS).map(([k, v]) => [k, v.label]) },
};

const inputs = [...panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-fl]")];
const colorSel = panel.querySelector<HTMLSelectElement>("[data-fl-colors]")!;
const fmt = (k: string, v: number) => (k === "radius" ? `${Math.round(v * 100)} %` : k === "density" || k === "speed" ? `×${v.toFixed(2)}` : k === "viscosity" ? v.toFixed(2) : String(v));

const set = (k: string, v: unknown) => {
  (state as Record<string, unknown>)[k] = v;
  if (api) (api.cfg as unknown as Record<string, unknown>)[k] = v;
};
const showOut = (k: string, v: number) => {
  const o = panel.querySelector<HTMLOutputElement>(`[data-fl-out=${k}]`);
  if (o) o.value = fmt(k, v);
};
const fillColors = () => {
  const r = (state.render ?? "points") as FluidConfig["render"];
  const c = COLORS[r];
  colorSel.innerHTML = c.options.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  colorSel.value = String((state as Record<string, unknown>)[c.key] ?? c.options[0]![0]);
  document.body.dataset.flRender = r;
  document.body.dataset.flLight = r !== "points" || state.points === "encres" ? "1" : "0";
};
/** Le panneau affiche l'état (après un changement de scène, tout bouge d'un coup). */
const syncPanel = () => {
  for (const el of inputs) {
    const k = el.dataset.fl!;
    const v = (state as Record<string, unknown>)[k];
    if (v === undefined) continue;
    el.value = String(v);
    if (el instanceof HTMLInputElement && el.type === "range") showOut(k, Number(v));
  }
  fillColors();
  panel.querySelectorAll<HTMLButtonElement>("[data-fl-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.flMode === state.mode)));
  panel.querySelectorAll<HTMLButtonElement>("[data-fl-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.flTool === state.tool)));
  // Le cadran suit son input (il écoute « input »).
  panel.querySelector<HTMLInputElement>("[data-fl=angle]")?.dispatchEvent(new Event("input"));
};

for (const el of inputs) {
  const k = el.dataset.fl!;
  const read = () => {
    const v = el instanceof HTMLSelectElement && k === "render" ? el.value : Number(el.value);
    set(k, v);
    if (el instanceof HTMLInputElement && el.type === "range") showOut(k, Number(v));
    if (k === "render") fillColors();
    if (el.dataset.flReset !== undefined) api?.reset();
  };
  el.addEventListener(el instanceof HTMLSelectElement ? "change" : "input", read);
}
colorSel.addEventListener("change", () => {
  set(COLORS[(state.render ?? "points") as FluidConfig["render"]].key, colorSel.value);
  fillColors();
});
panel.querySelectorAll<HTMLButtonElement>("[data-fl-mode]").forEach((b) =>
  b.addEventListener("click", () => {
    const mode = b.dataset.flMode as Mode;
    Object.assign(state, PRESETS[mode], { mode });
    api?.setMode(mode);
    syncPanel();
  }),
);
panel.querySelectorAll<HTMLButtonElement>("[data-fl-tool]").forEach((b) =>
  b.addEventListener("click", () => {
    set("tool", b.dataset.flTool);
    syncPanel();
  }),
);
const pauseBtn = panel.querySelector<HTMLButtonElement>("[data-fl-act=pause]")!;
const togglePause = () => {
  set("paused", !state.paused);
  pauseBtn.setAttribute("aria-pressed", String(!!state.paused));
};
pauseBtn.addEventListener("click", togglePause);
panel.querySelector<HTMLButtonElement>("[data-fl-act=reset]")!.addEventListener("click", () => api?.reset());
addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault();
    togglePause();
  } else if (e.key === "r" || e.key === "R") api?.reset();
});

const stats = panel.querySelector<HTMLElement>("[data-fl-stats]")!;
const nf = new Intl.NumberFormat("fr-FR");
// Images réellement calculées par seconde (la boucle saute les images quand la carte ne suit pas).
let lastTicks = 0;
let lastT = performance.now();
setInterval(() => {
  if (!api) return;
  const s = api.stats();
  const now = performance.now();
  const rate = s.ticks >= lastTicks ? ((s.ticks - lastTicks) * 1000) / (now - lastT) : 0;
  lastTicks = s.ticks;
  lastT = now;
  stats.textContent = `${nf.format(s.n)} particules · ${Math.round(rate)} i/s · ${nf.format(s.cells)} cellules`;
}, 1000);

syncPanel();
recoverable(
  () => mountFluide(stage, { ...state }),
  (a) => {
    api = a;
    Object.assign(a.cfg, state);
    (window as unknown as { __fluide?: FluidApi }).__fluide = a;
  },
  (e) => {
    console.warn("[fluide]", e);
    document.body.classList.add("fl-nogpu");
  },
);
