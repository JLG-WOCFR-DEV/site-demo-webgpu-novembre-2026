import "./style.css";
import { mountDebugPanel } from "../debug-panel.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { enhanceAngles } from "../presse/angle.ts";
import { mountComponents } from "../presse/components.ts";
import { mountPaillettes } from "./paillettes.ts";
import { liquidPreset, mountPhase } from "./phase.ts";
import { recoverable } from "../components/device.ts";

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

// Paillettes : l'interface est branchée une fois, sur l'instance courante (elle change après une perte du GPU).
const seq = document.querySelector<HTMLElement>("[data-mt=paillettes]");
if (seq) {
  let api: Awaited<ReturnType<typeof mountPaillettes>> | null = null;
  const st = { img: "mot" as "mot" | "photo", metal: "argent" as "argent" | "or" | "noir" };
  const press = (sel: string, b: HTMLElement) => document.querySelectorAll(sel).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  const nap = seq.querySelector<HTMLInputElement>("[data-seq-nap]");
  seq.querySelectorAll<HTMLButtonElement>("[data-seq-img]").forEach((b) =>
    b.addEventListener("click", () => {
      press("[data-seq-img]", b);
      st.img = b.dataset.seqImg as "mot" | "photo";
      void api?.setImage(st.img);
    }),
  );
  seq.querySelectorAll<HTMLButtonElement>("[data-seq-metal]").forEach((b) =>
    b.addEventListener("click", () => {
      press("[data-seq-metal]", b);
      st.metal = b.dataset.seqMetal as "argent" | "or" | "noir";
      api?.setMetal(st.metal);
    }),
  );
  nap?.addEventListener("input", () => api?.setNap(Number(nap.value)));
  seq.querySelectorAll<HTMLButtonElement>("[data-seq-fill]").forEach((b) => b.addEventListener("click", () => api?.fill(Number(b.dataset.seqFill) as 0 | 1)));
  lazy(seq, async () =>
    recoverable(
      () => mountPaillettes(seq, { image: "./plates/flower.jpg", word: "UBS" }),
      (a) => {
        api = a;
        a.setMetal(st.metal);
        if (st.img !== "mot") void a.setImage(st.img);
        if (nap) a.setNap(Number(nap.value));
      },
      fail(seq),
    ),
  );
}

// Eau, éclair, feu : trois <x-matiere> (src/components/matiere), montés par le registre des composants.

const ph = document.querySelector<HTMLElement>("[data-mt=phase]");
if (ph) {
  let api: Awaited<ReturnType<typeof mountPhase>> | null = null;
  const reads: (() => void)[] = [];
  // Chaque réglage [data-ph] écrit sa clé dans la configuration courante : case → booléen, liste → texte, le reste → nombre.
  ph.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-ph]").forEach((el) => {
    const read = () => {
      const cfg = api?.cfg as unknown as Record<string, unknown> | undefined;
      if (cfg) cfg[el.dataset.ph!] = el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : el instanceof HTMLSelectElement ? el.value : Number(el.value);
      // Les groupes qui ne valent que pour un rendu (le liquide) n'apparaissent qu'avec lui.
      if (el.dataset.ph === "render") ph.querySelectorAll<HTMLElement>("[data-ph-show]").forEach((g) => (g.hidden = g.dataset.phShow !== el.value));
    };
    el.addEventListener("input", read);
    el.addEventListener("change", read);
    // Un liquide pose son indice, sa dispersion, son trouble, son irisation : les curseurs suivent (au changement seulement).
    if (el.dataset.ph === "liquid")
      el.addEventListener("change", () => {
        for (const [k, v] of Object.entries(liquidPreset(el.value as Parameters<typeof liquidPreset>[0]))) {
          const input = ph.querySelector<HTMLInputElement>(`[data-ph=${k}]`);
          if (input) input.value = String(v);
          const cfg = api?.cfg as unknown as Record<string, unknown> | undefined;
          if (cfg) cfg[k] = v;
        }
      });
    reads.push(read);
  });
  ph.querySelectorAll<HTMLButtonElement>("[data-ph-act]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!api) return;
      const act = b.dataset.phAct;
      if (act === "pause") b.setAttribute("aria-pressed", String((api.cfg.paused = !api.cfg.paused)));
      if (act === "seed") api.reseed();
      if (act === "png") api.exportPng();
    }),
  );
  lazy(ph, async () =>
    recoverable(
      () => mountPhase(ph),
      (a) => {
        api = a;
        // Nouvelle instance (premier montage ou reprise) : elle reprend tous les réglages affichés.
        for (const r of reads) r();
      },
      fail(ph),
    ),
  );
}
