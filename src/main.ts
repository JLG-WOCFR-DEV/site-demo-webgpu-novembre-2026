import "./styles.css";
import { createEngine, type Engine } from "./gpu/engine.ts";
import { setupHtmlInCanvas } from "./html-in-canvas.ts";
import { bindLayers } from "./layers-ui.ts";
import { setupMenu } from "./menu.ts";
import { mountDebugPanel, setDebugCaps } from "./debug-panel.ts";
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
/** Le moteur en cours, pour le sampler (capture vidéo). */
export const currentEngine = () => engine;
let retried = false;
let userOff = false;

function fallback(reason: string) {
  setupHtmlInCanvas(null);
  root.classList.remove("gl-on");
  engine?.destroy();
  engine = null;
  setStatus(`HTML seul — ${reason}`);
  const btn = document.querySelector<HTMLButtonElement>("[data-action='toggle-gpu']");
  if (btn) btn.textContent = userOff ? "Rallumer WebGPU" : "Réessayer WebGPU";
}

const forced = matchMedia("(forced-colors: active)");

/*
 * Un démarrage qui traîne (GPU occupé, pilote qui compile, onglet revenu d'arrière-plan) : au bout de 8 s, on le dit,
 * au lieu de laisser « Démarrage » sans explication. La page reste lisible : c'est du HTML. Deux sorties : recharger,
 * ou fermer l'avis (le GPU prendra la main s'il finit par démarrer).
 */
function slowStart() {
  let note: HTMLElement | null = null;
  const t = setTimeout(() => {
    note = document.createElement("div");
    note.className = "slow-start";
    note.setAttribute("role", "status");
    note.innerHTML =
      '<p>Le GPU met du temps à démarrer. La page reste lisible : c\'est du HTML ; l\'impression arrivera dès qu\'il sera prêt.</p><div><button type="button" data-slow="reload">Recharger</button><button type="button" data-slow="close">Fermer</button></div>';
    note.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-slow]");
      if (b?.dataset.slow === "reload") location.reload();
      else if (b) note?.remove();
    });
    document.body.append(note);
  }, 8000);
  return {
    done() {
      clearTimeout(t);
      note?.remove();
    },
  };
}

async function start() {
  if (forced.matches) {
    // Le système impose ses couleurs : un canvas les ignorerait.
    fallback("couleurs forcées par le système");
    return;
  }
  setStatus("Démarrage · fontes");
  const slow = slowStart();
  try {
    // Les glyphes sont mesurés et dessinés avec la vraie fonte : on l'attend, mais pas plus de 3 s (une fonte qui
    // arrive plus tard fait remesurer le texte ; un réseau lent ne doit pas retenir le GPU).
    const fonts = Promise.all([
      document.fonts.load('900 125% 96px "Archivo Variable"'),
      document.fonts.load('400 16px "Archivo Variable"'),
      document.fonts.load('500 12px "IBM Plex Mono"'),
    ])
      .catch(() => undefined)
      .then(() => document.fonts.ready);
    await Promise.race([fonts, new Promise((r) => setTimeout(r, 3000))]);
    setStatus("Démarrage · GPU");
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
    slow.done();
    setStatus(`WebGPU natif${engine.canTime ? " · horodaté" : ""}`);
    const eng = engine;
    setDebugCaps({
      wire: (on) => (settings.debug.wire = on),
      grid: (g) => {
        Object.assign(settings.debug, g);
        return true;
      },
      record: (o) => eng.record(o),
      stopRecord: () => eng.stopRecording(),
      snapshot: (cb) => eng.snapshot(cb),
    });
    setupHtmlInCanvas(engine.device);
    const btn = document.querySelector<HTMLButtonElement>("[data-action='toggle-gpu']");
    if (btn) btn.textContent = "Couper WebGPU";
  } catch (err) {
    slow.done();
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
// Débogage : l'icône prend place dans la barre, avant le bouton Sommaire.
{
  const bar = document.querySelector<HTMLElement>(".bar");
  mountDebugPanel(bar ? { parent: bar, before: bar.querySelector(".pause-btn") } : undefined);
}
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
    // Système en mouvement réduit : « Animer » rallume les animations pour tout le site (le même réglage que le menu
    // Pages) ; le changement revient par matchMedia, comme si le système l'avait annoncé.
    const api = (window as unknown as { __presseMotion?: { set(v: boolean): void } }).__presseMotion;
    if (motion.system && api) api.set(true);
    else motion.paused = !motion.paused;
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
