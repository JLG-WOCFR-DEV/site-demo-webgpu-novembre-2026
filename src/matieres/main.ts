import "./style.css";
import { mountDebugPanel } from "../debug-panel.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { enhanceAngles } from "../presse/angle.ts";
import { mountComponents } from "../presse/components.ts";
import { mountElement } from "./elements.ts";
import { mountPaillettes } from "./paillettes.ts";
import { mountPhase } from "./phase.ts";

/**
 * Page « Matières » : trois démos GPU autonomes (src/matieres/*), montées à
 * l'approche de l'écran. Sans WebGPU, chaque section garde son texte.
 */
mountPagesNav();
mountDebugPanel();
await mountComponents();
enhanceAngles();

const fail = (el: HTMLElement) => (e: unknown) => {
  console.warn("[matières]", e);
  el.classList.add("mt-nogl");
};
const lazy = (el: HTMLElement, start: () => Promise<unknown>) => {
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      start().catch(fail(el));
    },
    { rootMargin: "300px" },
  );
  io.observe(el);
};

const seq = document.querySelector<HTMLElement>("[data-mt=paillettes]");
if (seq)
  lazy(seq, async () => {
    const api = await mountPaillettes(seq, { image: "./plates/flower.jpg", word: "UBS" });
    const press = (sel: string, b: HTMLElement) => document.querySelectorAll(sel).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    seq.querySelectorAll<HTMLButtonElement>("[data-seq-img]").forEach((b) =>
      b.addEventListener("click", () => {
        press("[data-seq-img]", b);
        void api.setImage(b.dataset.seqImg as "mot" | "photo");
      }),
    );
    seq.querySelectorAll<HTMLButtonElement>("[data-seq-metal]").forEach((b) =>
      b.addEventListener("click", () => {
        press("[data-seq-metal]", b);
        api.setMetal(b.dataset.seqMetal as "argent" | "or" | "noir");
      }),
    );
    const nap = seq.querySelector<HTMLInputElement>("[data-seq-nap]");
    nap?.addEventListener("input", () => api.setNap(Number(nap.value)));
    if (nap) api.setNap(Number(nap.value));
    seq.querySelectorAll<HTMLButtonElement>("[data-seq-fill]").forEach((b) => b.addEventListener("click", () => api.fill(Number(b.dataset.seqFill) as 0 | 1)));
  });

for (const el of document.querySelectorAll<HTMLElement>(".mt-el")) lazy(el, () => mountElement(el, el.dataset.mt as "eau" | "eclair" | "feu", el.dataset.word ?? ""));

const ph = document.querySelector<HTMLElement>("[data-mt=phase]");
if (ph)
  lazy(ph, async () => {
    const api = await mountPhase(ph);
    const cfg = api.cfg as unknown as Record<string, unknown>;
    // Chaque réglage [data-ph] écrit sa clé : case → booléen, liste → texte, le reste → nombre.
    ph.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-ph]").forEach((el) => {
      const read = () => {
        cfg[el.dataset.ph!] = el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : el instanceof HTMLSelectElement ? el.value : Number(el.value);
        // Les groupes qui ne valent que pour un rendu (le liquide) n'apparaissent qu'avec lui.
        if (el.dataset.ph === "render") ph.querySelectorAll<HTMLElement>("[data-ph-show]").forEach((g) => (g.hidden = g.dataset.phShow !== el.value));
      };
      el.addEventListener("input", read);
      el.addEventListener("change", read);
      read();
    });
    ph.querySelectorAll<HTMLButtonElement>("[data-ph-act]").forEach((b) =>
      b.addEventListener("click", () => {
        const act = b.dataset.phAct;
        if (act === "pause") b.setAttribute("aria-pressed", String((api.cfg.paused = !api.cfg.paused)));
        if (act === "seed") api.reseed();
        if (act === "png") api.exportPng();
      }),
    );
  });
