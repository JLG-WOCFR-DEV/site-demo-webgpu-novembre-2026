import "./styles.css";
import { createEngine, type Engine } from "./gpu/engine.ts";
import { bindLayers } from "./layers-ui.ts";
import { motion, pointer, settings } from "./state.ts";
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

function fallback(reason: string) {
  root.classList.remove("gl-on");
  engine?.destroy();
  engine = null;
  setStatus(`HTML seul — ${reason}`);
  const btn = document.querySelector<HTMLButtonElement>("[data-action='toggle-gpu']");
  if (btn) btn.textContent = userOff ? "Rallumer WebGPU" : "Réessayer WebGPU";
}

const forced = matchMedia("(forced-colors: active)");

async function start() {
  if (forced.matches) {
    // Le système impose ses couleurs : un canvas les ignorerait.
    fallback("couleurs forcées par le système");
    return;
  }
  setStatus("Démarrage");
  try {
    // Les glyphes sont mesurés et dessinés avec la vraie fonte : on l'attend.
    await Promise.all([
      document.fonts.load('900 125% 96px "Archivo Variable"'),
      document.fonts.load('400 16px "Archivo Variable"'),
      document.fonts.load('500 12px "IBM Plex Mono"'),
    ]).catch(() => undefined);
    await document.fonts.ready;
    engine = await createEngine(canvas, {
      onTimings: showTimings,
      onLayout: showLayout,
      onContrast: showContrast,
      onLost: (reason) => {
        if (!retried) {
          retried = true;
          setStatus("GPU perdu, reprise");
          engine?.destroy();
          engine = null;
          setTimeout(() => void start(), 400);
        } else {
          fallback(`GPU perdu (${reason})`);
        }
      },
    });
    engine.pause(settings.dom.hideGpu);
    if (!settings.dom.hideGpu) root.classList.add("gl-on");
    setStatus(`WebGPU natif${engine.canTime ? " · horodaté" : ""}`);
    const btn = document.querySelector<HTMLButtonElement>("[data-action='toggle-gpu']");
    if (btn) btn.textContent = "Couper WebGPU";
  } catch (err) {
    console.warn("[pli]", err);
    fallback(err instanceof Error ? err.message.slice(0, 80) : "échec");
  }
}

bindControls(() => {
  applyA11y();
  if (!engine) return;
  const hide = settings.dom.hideGpu;
  root.classList.toggle("gl-on", !hide);
  engine.pause(hide);
});
trackChapters();
trackFocus();
bindLayers();
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
  });
}

matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => {
  motion.system = e.matches;
  showMotion();
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
