/**
 * Presse — composants, côté navigateur (feuille de route C).
 *
 * Le HTML a été déroulé à la construction (presse/build) : chaque composant y
 * porte data-presse-component="nom". Ce registre charge à la demande le
 * module qui l'anime, une seule fois par type, et seulement si la page en
 * contient un. Un composant sans comportement (le sommaire en lettres, pur
 * CSS) n'a pas d'entrée.
 */
import { onDeviceLost, simulateDeviceLoss } from "../components/device.ts";
import { flightSettled, initFlights } from "./flight.ts";
import { initSweep } from "./sweep.ts";

type Mount = (root: HTMLElement) => () => void;

/**
 * Un seul registre par page, partagé par toutes les copies de ce module : en développement, après qu'un fichier a été
 * modifié, Vite réimporte les modules rechargés avec un horodatage (`?t=…`) et peut créer une seconde copie de
 * celui-ci. Sans ce partage, la copie neuve aurait un registre vide et rebrancherait vols, balayage et reprise.
 */
type Shared = { mounted: Map<HTMLElement, () => void>; hotSwap?: (kind: string, mount: Mount) => void };
const G = globalThis as { __presseRegistry?: Shared };
const FIRST = !G.__presseRegistry;
const shared: Shared = (G.__presseRegistry ??= { mounted: new Map() });

// Le passage (une photo qui vole d'une page à l'autre) est branché sur toute page à composants.
if (FIRST) {
  initFlights();
  initSweep();
}

const REGISTRY: Record<string, () => Promise<{ mount: Mount }>> = {
  liquide: () => import("../components/liquide/liquide.ts"),
  grille: () => import("../components/grille/grille.ts"),
  galerie: () => import("../components/galerie/galerie.ts"),
  objet: () => import("../components/objet/objet.ts"),
  orbite: () => import("../components/orbite/orbite.ts"),
  matiere: () => import("../components/matiere/matiere.ts"),
  tambour: () => import("../components/tambour/tambour.ts"),
};

// Map (et non WeakMap) : après une perte de l'appareil GPU, il faut pouvoir parcourir les composants montés.
const mounted = shared.mounted;

/** Anime tous les composants présents sous `root` ; renvoie le nombre de composants montés. */
export async function mountComponents(root: ParentNode = document) {
  const els = [...root.querySelectorAll<HTMLElement>("[data-presse-component]")].filter((el) => !mounted.has(el));
  let n = 0;
  await Promise.all(
    els.map(async (el) => {
      const load = REGISTRY[el.dataset.presseComponent ?? ""];
      if (!load) return;
      try {
        const { mount } = await load();
        mounted.set(el, mount(el));
        n++;
      } catch (e) {
        console.warn(`[presse] composant ${el.dataset.presseComponent}`, e);
      }
    }),
  );
  flightSettled();
  return n;
}

/**
 * Perte de l'appareil GPU (D11) : chaque composant est arrêté puis remonté sur un appareil neuf, dès que la page est
 * visible. Au plus trois reprises par minute : au-delà, le pilote est malade, on laisse le HTML (le repli).
 * La page reçoit `presse:gpu-lost` puis `presse:gpu-restored` (ou `presse:gpu-failed`).
 */
const recoveries: number[] = [];
if (FIRST) onDeviceLost((reason) => {
  const now = performance.now();
  while (recoveries.length && now - recoveries[0]! > 60_000) recoveries.shift();
  const els = [...mounted.keys()].filter((el) => el.isConnected);
  for (const [el, stop] of mounted) {
    try {
      stop();
    } catch (e) {
      console.warn("[presse] arrêt après perte", e);
    }
    mounted.delete(el);
  }
  dispatchEvent(new CustomEvent("presse:gpu-lost", { detail: { reason } }));
  if (recoveries.length >= 3) {
    dispatchEvent(new CustomEvent("presse:gpu-failed", { detail: { reason } }));
    return;
  }
  recoveries.push(now);
  const resume = async () => {
    if (document.hidden) return void document.addEventListener("visibilitychange", resume, { once: true });
    const parents = new Set(els.map((el) => el.parentElement ?? document));
    let n = 0;
    for (const p of parents) n += await mountComponents(p);
    dispatchEvent(new CustomEvent("presse:gpu-restored", { detail: { components: n } }));
  };
  // Laisser le pilote se remettre un instant avant de redemander un appareil.
  setTimeout(() => void resume(), 250);
});

// Recette : `__presse.loseDevice()` dans la console simule une perte de l'appareil (test de la reprise).
if (FIRST) (globalThis as { __presse?: object }).__presse = { ...(globalThis as { __presse?: object }).__presse, loseDevice: simulateDeviceLoss, mounted: () => mounted.size };

/**
 * Rechargement à chaud (A1, développement seulement) : quand Vite remplace le module d'un composant — ou un module
 * dont il dépend, ses shaders par exemple —, seuls les composants de ce type sont arrêtés puis remontés avec le
 * nouveau code, sur le même appareil GPU. La page ne se recharge pas : défilement, réglages, autres composants restent.
 * Chaque module de composant s'inscrit avec `hot(import.meta.hot, "nom")`.
 */
export function hotSwap(kind: string, mount: Mount) {
  // Toujours la copie d'origine du module : c'est elle qui tient les composants (voir `shared`).
  if (shared.hotSwap && shared.hotSwap !== hotSwap) return shared.hotSwap(kind, mount);
  let n = 0;
  for (const [el, stop] of [...mounted]) {
    if (el.dataset.presseComponent !== kind) continue;
    try {
      stop();
    } catch (e) {
      console.warn("[presse] arrêt à chaud", e);
    }
    mounted.set(el, mount(el));
    n++;
  }
  console.info(`[presse] ${kind} : ${n} composant(s) remonté(s) à chaud`);
  dispatchEvent(new CustomEvent("presse:hot", { detail: { kind, count: n } }));
}

/**
 * Le rappel d'acceptation de chaque module de composant. Vite ne reconnaît un module rechargeable à chaud que si
 * `import.meta.hot.accept(` est écrit tel quel dans sa source : d'où, en tête de chaque module,
 * `if (import.meta.hot) import.meta.hot.accept((m) => hot(m, "galerie"));` plutôt qu'une fonction qui recevrait `import.meta.hot`.
 */
export function hot(mod: unknown, kind: string) {
  const m = (mod as { mount?: Mount } | undefined)?.mount;
  if (m) hotSwap(kind, m);
  else location.reload();
}

shared.hotSwap ??= hotSwap;

/** Arrête les composants sous `root` (avant de retirer leur HTML de la page). */
export function unmountComponents(root: ParentNode = document) {
  const els = [...root.querySelectorAll<HTMLElement>("[data-presse-component]")];
  // La racine elle-même peut être un composant (le Créateur remplace un composant seul).
  if (root instanceof HTMLElement && root.dataset.presseComponent) els.push(root);
  for (const el of els) {
    mounted.get(el)?.();
    mounted.delete(el);
  }
}
