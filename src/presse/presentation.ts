/**
 * Réglages de visite, partagés par toutes les pages (menu « Pages ») :
 *
 * - **Animations** : « comme le système » ou « toujours ». Le script en tête de page (presse/build/head.ts) interpose
 *   matchMedia ; ici, on n'a qu'à appeler `__presseMotion.set()`, et chaque composant reçoit un changement de
 *   « prefers-reduced-motion », comme si le système l'avait annoncé.
 * - **Mode présentation** (pour une conférence) : animations rallumées sans rien garder, débogage et ligne d'état
 *   masqués, Maj + → / ← pour passer à la démo suivante ou précédente (un geste explicite : un clic, lui, ne change
 *   jamais de page). Gardé le temps de la session ; `?presentation` l'allume, `?presentation=0` l'éteint.
 */
type MotionApi = { readonly force: boolean; readonly system: boolean; set(v: boolean, keep?: boolean): void };
const motionApi = () => (window as unknown as { __presseMotion?: MotionApi }).__presseMotion;
const KEY = "presse-presentation";

export const presenting = () => document.documentElement.classList.contains("presse-presentation");

const stored = () => {
  try {
    return localStorage.getItem("presse-animations") === "toujours";
  } catch {
    return false;
  }
};

export function setPresenting(on: boolean) {
  try {
    sessionStorage.setItem(KEY, on ? "1" : "");
  } catch {
    /* navigation privée : le mode vaut pour cette page */
  }
  document.documentElement.classList.toggle("presse-presentation", on);
  // En présentation, les animations tournent ; en sortant, on revient au choix gardé.
  motionApi()?.set(on || stored(), false);
  if (on) hint();
}

export const CSS = `
html.presse-presentation .dbg-btn,
html.presse-presentation .pages-debug,
html.presse-presentation .bar .status { display: none !important; }
.pages-settings { display: grid; gap: 2px; margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(127, 127, 127, 0.5); }
.pages-switch {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 2px 12px; width: 100%; min-height: 44px;
  padding: 8px 10px; border: 0; border-radius: 4px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.pages-switch:hover, .pages-switch:focus-visible { background: rgba(127, 127, 127, 0.14); }
.pages-switch .pages-text { grid-column: 1; }
.pages-switch-state {
  grid-column: 2; grid-row: 1 / span 2; min-width: 4.6em; padding: 4px 8px; border: 1px solid currentColor; border-radius: 99px;
  font: 500 11px/1 var(--f-mono, ui-monospace, monospace); letter-spacing: 0.08em; text-transform: uppercase; text-align: center;
}
.pages-switch[aria-pressed="true"] .pages-switch-state { background: currentColor; }
.pages-switch[aria-pressed="true"] .pages-switch-state span { filter: invert(1); }
.presse-hint {
  position: fixed; z-index: 60; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); translate: -50% 0;
  padding: 10px 16px; border-radius: 99px; background: rgba(22, 17, 13, 0.92); color: #efe6d2;
  font: 500 13px/1.2 var(--f-mono, ui-monospace, monospace); letter-spacing: 0.04em; pointer-events: none;
  transition: opacity 0.6s, translate 0.6s;
}
.presse-hint[data-out] { opacity: 0; translate: -50% 12px; }
`;

let hintEl: HTMLElement | null = null;
function hint() {
  hintEl?.remove();
  const h = document.createElement("p");
  h.className = "presse-hint";
  h.setAttribute("role", "status");
  h.textContent = "Présentation · Maj + → démo suivante · Maj + ← précédente";
  document.body.append(h);
  hintEl = h;
  setTimeout(() => h.setAttribute("data-out", ""), 3200);
  setTimeout(() => h.remove(), 4000);
}

/** Les réglages du menu, et le clavier du mode présentation. `pages` : l'ordre des démos. */
export function mountSettings(pop: HTMLElement, pages: { href: string }[], base: string) {
  const box = document.createElement("div");
  box.className = "pages-settings";
  const mk = (name: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pages-switch";
    b.innerHTML = '<span class="pages-name"></span><span class="pages-text"></span><span class="pages-switch-state"><span></span></span>';
    b.querySelector(".pages-name")!.textContent = name;
    box.append(b);
    return b;
  };
  const anim = mk("Animations");
  const pres = mk("Mode présentation");
  const sync = () => {
    const m = motionApi();
    const force = !!m?.force;
    const sys = !!m?.system;
    // Le choix n'a de sens que si le système demande moins d'animations (ou s'il a déjà été fait).
    anim.hidden = !sys && !stored();
    anim.setAttribute("aria-pressed", String(force));
    anim.querySelector(".pages-text")!.textContent = presenting()
      ? "Rallumées par le mode présentation"
      : sys
        ? force
          ? "Rallumées sur tout le site (votre système en demande moins)"
          : "Coupées : votre système demande moins d'animations"
        : "Comme le système";
    anim.querySelector(".pages-switch-state span")!.textContent = force ? "Toujours" : "Système";
    anim.disabled = presenting();
    pres.setAttribute("aria-pressed", String(presenting()));
    pres.querySelector(".pages-text")!.textContent = "Animations, sans débogage ; Maj + ← → entre les démos";
    pres.querySelector(".pages-switch-state span")!.textContent = presenting() ? "Oui" : "Non";
  };
  anim.addEventListener("click", () => {
    motionApi()?.set(!motionApi()?.force);
    sync();
  });
  pres.addEventListener("click", () => {
    setPresenting(!presenting());
    sync();
  });
  pop.addEventListener("toggle", sync);
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", sync);
  sync();
  pop.append(box);

  // Maj + → / ← : la démo suivante ou précédente, seulement en présentation.
  addEventListener("keydown", (e) => {
    if (!presenting() || !e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("input, textarea, select, [contenteditable]")) return;
    const demos = pages.filter((p) => !p.href.startsWith("legacy/"));
    const here = location.pathname.split("/").pop() || "index.html";
    const i = Math.max(0, demos.findIndex((p) => p.href === here));
    const next = demos[(i + (e.key === "ArrowRight" ? 1 : -1) + demos.length) % demos.length]!;
    e.preventDefault();
    location.href = base + next.href;
  });
  if (presenting()) hint();
}
