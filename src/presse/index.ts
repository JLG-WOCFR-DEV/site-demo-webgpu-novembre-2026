import "./presse.css";
import { mountDebugPanel, setDebugCaps } from "../debug-panel.ts";
import { createEngine, type Engine } from "../gpu/engine.ts";
import { setMotionLevel, type MotionLevel } from "../motion-scale.ts";
import { CUI_EFFECTS, type CuiEffect } from "../gpu/cui.ts";
import { mountComponents } from "./components.ts";
import { settings, TRANSITIONS } from "../state.ts";

/**
 * Presse : un « Webflow » WebGPU, sous forme de bibliothèque à attributs.
 *
 * On écrit une page HTML ordinaire ; quelques attributs disent ce que le GPU
 * doit en faire (data-gl-text, data-gl-img, data-gl-material, data-gl-print,
 * data-gl-morph…). Une ligne de script lance le moteur. Le HTML reste la
 * source de vérité : mise en page, liens, lecteurs d'écran, sélection,
 * recherche dans la page, tout vient du navigateur. Le GPU le relit à chaque
 * image et le repeint ; sans WebGPU, la page reste son HTML.
 *
 * Voir PRESSE.md pour la liste des attributs et le fonctionnement.
 */

export type Effect = "loupe" | "rvb" | "trame" | "bloom" | "grain";
export type PresseOptions = {
  /** Transition d'impression des sections [data-gl-print] (par nom : buvard, trame, pli, tri…). */
  transition?: (typeof TRANSITIONS)[number];
  /** Passes de la chaîne, par nom. Par défaut : loupe, bloom, grain. */
  effects?: Effect[];
  /** Intensité du mouvement de tous les effets. */
  motion?: MotionLevel;
  /** Panneau de débogage (fil de fer, grille, capture). */
  debug?: boolean;
  /** Canvas à utiliser ; sinon, Presse en crée un, fixe, derrière la page. */
  canvas?: HTMLCanvasElement;
  /** Un effet d'après Canvas UI sur toute la page (voir CUI_EFFECTS : ondes, vhs, glitch, pli, tuiles, ascii, éclats, sable, tissu…). */
  canvasUi?: CuiEffect;
  /** Polices à attendre avant de mesurer les lettres (descripteurs CSS font). */
  fonts?: string[];
};
export type Presse = {
  engine: Engine | null;
  /** Réglages du moteur, modifiables à chaud. */
  settings: typeof settings;
  /** Relire le DOM (après un changement de contenu). */
  relayout: () => void;
  /** Rejouer l'impression des sections. */
  replay: () => void;
};

const EFFECT_KEYS: Record<Effect, keyof typeof settings.chain> = { loupe: "distort", rvb: "rgb", trame: "trame", bloom: "bloom", grain: "grain" };

export async function presse(o: PresseOptions = {}): Promise<Presse> {
  const root = document.documentElement;
  // Réglages : on part d'un moteur sobre, puis on applique les options.
  const fx = new Set<Effect>(o.effects ?? ["loupe", "bloom", "grain"]);
  for (const [name, key] of Object.entries(EFFECT_KEYS) as [Effect, keyof typeof settings.chain][]) {
    (settings.chain as Record<string, boolean>)[key] = fx.has(name);
  }
  settings.chain.print = !!document.querySelector("[data-gl-print], .chapter");
  const ti = TRANSITIONS.indexOf(o.transition ?? "impression");
  settings.transition.style = ti >= 0 ? ti : 0;
  root.dataset.transition = TRANSITIONS[settings.transition.style];
  if (o.motion) setMotionLevel(o.motion);
  settings.cui.effect = Math.max(0, CUI_EFFECTS.indexOf(o.canvasUi ?? "aucun"));
  if (o.debug) mountDebugPanel();

  // Les composants (<x-liquide>, <x-grille>…) ont leur propre rendu et leur
  // repli sans WebGPU : ils démarrent quoi qu'il arrive au moteur.
  void mountComponents();

  const api: Presse = { engine: null, settings, relayout: () => {}, replay: () => {} };
  if (!navigator.gpu) return api;

  let canvas = o.canvas;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "presse-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
  }
  try {
    await Promise.all((o.fonts ?? []).map((f) => document.fonts.load(f))).catch(() => undefined);
    await document.fonts.ready;
    const engine = await createEngine(canvas);
    api.engine = engine;
    root.classList.add("gl-on");
    let pending = 0;
    api.relayout = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => engine.relayout());
    };
    api.replay = () => engine.replayPrint();
    new ResizeObserver(api.relayout).observe(document.body);
    document.fonts.addEventListener("loadingdone", api.relayout);
    addEventListener("pli:relayout", api.relayout);
    // Le contenu change (CMS, script) : on relit le DOM.
    new MutationObserver(api.relayout).observe(document.body, { subtree: true, childList: true, characterData: true });
    setDebugCaps({
      wire: (on) => (settings.debug.wire = on),
      grid: (g) => {
        Object.assign(settings.debug, g);
        return true;
      },
      record: (r) => engine.record(r),
      stopRecord: () => engine.stopRecording(),
      snapshot: (cb) => engine.snapshot(cb),
    });
  } catch (e) {
    console.warn("[presse]", e);
    root.classList.remove("gl-on");
  }
  return api;
}

/**
 * Démarrage déclaratif : les options se lisent sur <html>.
 *   <html data-presse-transition="buvard" data-presse-effects="bloom grain" data-presse-motion="sobre" data-presse-debug>
 */
export function presseFromHtml() {
  const d = document.documentElement.dataset;
  return presse({
    transition: (d.presseTransition as PresseOptions["transition"]) ?? undefined,
    effects: d.presseEffects ? (d.presseEffects.split(/\s+/).filter(Boolean) as Effect[]) : undefined,
    motion: (d.presseMotion as MotionLevel) ?? undefined,
    debug: d.presseDebug !== undefined,
    canvasUi: (d.presseCanvasUi as CuiEffect) ?? undefined,
  });
}
