import "./styles.css";
import { createEngine, type Engine } from "./gpu/engine.ts";
import { setupHtmlInCanvas } from "./html-in-canvas.ts";
import { bindLayers } from "./layers-ui.ts";
import { setupMenu } from "./menu.ts";
import { mountPagesNav } from "./pages-nav.ts";
import { motion, pointer, settings, TRANSITIONS } from "./state.ts";
import { applyA11y, bindControls, setStatus, showContrast, showForced, showLayout, showMotion, showTimings, trackChapters, trackFocus } from "./ui.ts";

/**
 * Démarrage. Sans WebGPU, ou si quoi que ce soit échoue, la page reste son
 * HTML : la classe gl-on n'est posée qu'une fois la première frame prête.
 */

const root = document.documentElement;
const canvas = document.getElementById("gl") as HTMLCanvasElement;
let engine: Engine | null = null;
let retried = false;
let userOff = false;
let hicDevice: GPUDevice | null | undefined;
let startGeneration = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let engineCreation: Promise<Engine> | null = null;

function invalidateStart(): number {
  if (retryTimer !== undefined) clearTimeout(retryTimer);
  retryTimer = undefined;
  return ++startGeneration;
}

function syncHtmlInCanvas(device: GPUDevice | null) {
  if (hicDevice === device) return;
  hicDevice = device;
  setupHtmlInCanvas(device);
}

function fallback(reason: string) {
  invalidateStart();
  syncHtmlInCanvas(null);
  root.classList.remove("gl-on");
  engine?.destroy();
  engine = null;
  dispatchEvent(new Event("pli:motion-change"));
  setStatus(`HTML seul — ${reason}`);
  const btn = document.querySelector<HTMLButtonElement>("[data-action='toggle-gpu']");
  if (btn) btn.textContent = userOff ? "Rallumer WebGPU" : "Réessayer WebGPU";
}

const forced = matchMedia("(forced-colors: active)");

async function start() {
  const generation = invalidateStart();
  const obsolete = () => generation !== startGeneration || forced.matches || userOff;
  if (userOff) return;
  if (forced.matches) {
    // Le système impose ses couleurs : un canvas les ignorerait.
    fallback("couleurs forcées par le système");
    return;
  }
  setStatus("Démarrage");
  let candidate: Engine | null = null;
  let construction: Promise<Engine> | null = null;
  try {
    // Les glyphes sont mesurés et dessinés avec la vraie fonte : on l'attend.
    await Promise.all([
      document.fonts.load('900 125% 96px "Archivo Variable"'),
      document.fonts.load('400 16px "Archivo Variable"'),
      document.fonts.load('500 12px "IBM Plex Mono"'),
    ]).catch(() => undefined);
    if (obsolete()) return;
    await document.fonts.ready;
    if (obsolete()) return;
    // Deux demandes concurrentes ne doivent pas configurer le même canvas.
    // Le démarrage antérieur détruit son candidat obsolète avant de nous céder.
    if (engineCreation) await engineCreation.catch(() => undefined);
    if (obsolete()) return;
    construction = createEngine(canvas, {
      onTimings: showTimings,
      onLayout: showLayout,
      onContrast: showContrast,
      onLost: (reason) => {
        if (obsolete()) return;
        if (!retried) {
          const retryGeneration = invalidateStart();
          retried = true;
          setStatus("GPU perdu, reprise");
          syncHtmlInCanvas(null);
          root.classList.remove("gl-on");
          dispatchEvent(new Event("pli:motion-change"));
          engine?.destroy();
          engine = null;
          retryTimer = setTimeout(() => {
            retryTimer = undefined;
            if (retryGeneration === startGeneration && !forced.matches && !userOff) void start();
          }, 400);
        } else {
          fallback(`GPU perdu (${reason})`);
        }
      },
    });
    engineCreation = construction;
    candidate = await construction;
    // Un arrêt, les couleurs forcées ou un autre démarrage peuvent survenir
    // pendant l'attente du GPU. Ne jamais remonter un moteur devenu obsolète.
    if (obsolete()) { candidate.destroy(); return; }
    engine = candidate;
    engine.pause(settings.dom.hideGpu);
    if (!settings.dom.hideGpu) root.classList.add("gl-on");
    setStatus(`WebGPU natif${engine.canTime ? " · horodaté" : ""}`);
    syncHtmlInCanvas(settings.dom.hideGpu ? null : engine.device);
    dispatchEvent(new Event("pli:motion-change"));
    const btn = document.querySelector<HTMLButtonElement>("[data-action='toggle-gpu']");
    if (btn) btn.textContent = "Couper WebGPU";
  } catch (err) {
    if (obsolete()) { candidate?.destroy(); return; }
    console.warn("[pli]", err);
    fallback(err instanceof Error ? err.message.slice(0, 80) : "échec");
  } finally {
    if (construction && engineCreation === construction) engineCreation = null;
  }
}

bindControls(() => {
  applyA11y();
  if (!engine) return;
  const hide = settings.dom.hideGpu;
  root.classList.toggle("gl-on", !hide);
  engine.pause(hide);
  syncHtmlInCanvas(hide ? null : engine.device);
  dispatchEvent(new Event("pli:motion-change"));
});
trackChapters();
trackFocus();

/* Transitions au défilement : changer de style rejoue l'impression de la page. */
const showTransition = () => {
  root.dataset.transition = TRANSITIONS[settings.transition.style] ?? "impression";
};
showTransition();
for (const form of document.querySelectorAll<HTMLFormElement>("form[data-controls='transition']")) {
  form.addEventListener("input", (e) => {
    showTransition();
    if ((e.target as HTMLInputElement).name === "style") engine?.replayPrint();
  });
}
for (const b of document.querySelectorAll("[data-action='replay']")) {
  b.addEventListener("click", () => engine?.replayPrint());
}
// Le lien du panneau mène à la leçon : on referme le panneau en y allant.
document.querySelector("#tr-pop a")?.addEventListener("click", () => document.getElementById("tr-pop")?.hidePopover?.());
bindLayers();
setupMenu();
mountPagesNav();
// La carte de la leçon 10.1 est un vrai bouton, qu'elle soit dessinée par le GPU ou non.
document.querySelector("[data-hic-button]")?.addEventListener("click", (e) => {
  const b = e.currentTarget as HTMLButtonElement;
  b.textContent = b.textContent === "Tamponner" ? "Tamponné" : "Tamponner";
});
showMotion();
showForced(forced.matches);
forced.addEventListener("change", () => {
  showForced(forced.matches);
  if (forced.matches) fallback("couleurs forcées par le système");
  else if (!userOff) void start();
});
for (const b of document.querySelectorAll("[data-action='pause']")) {
  b.addEventListener("click", () => {
    motion.paused = !motion.paused;
    showMotion();
    dispatchEvent(new Event("pli:motion-change"));
  });
}

matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => {
  motion.system = e.matches;
  showMotion();
  dispatchEvent(new Event("pli:motion-change"));
});

addEventListener("pointermove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.inside = e.pointerType !== "touch" || e.pressure > 0;
});
document.documentElement.addEventListener("pointerleave", () => {
  pointer.inside = false;
});

// Toute modification de mise en page relance la mesure des glyphes.
let pending = 0;
const relayout = () => {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => engine?.relayout());
};
new ResizeObserver(relayout).observe(document.body);
// Une page qui change son contenu (le sampler) demande une nouvelle mesure.
addEventListener("pli:relayout", relayout);
document.fonts.addEventListener("loadingdone", relayout);

document.querySelector("[data-action='toggle-gpu']")?.addEventListener("click", () => {
  if (engine) {
    userOff = true;
    fallback("coupé à la main");
  } else {
    userOff = false;
    retried = false;
    void start();
  }
});

void start();
