import { settings, type LayerId } from "./state.ts";

const fmt = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Chapitre 04.2 : la pile de calques. Le formulaire affiche le calque du
 * dessus en premier, comme un logiciel de retouche ; le moteur reçoit
 * l'ordre inverse (du dessous vers le dessus). Tous les réglages sont des
 * contrôles natifs ; monter ou descendre déplace la ligne et garde le focus.
 */
export function bindLayers() {
  const form = document.querySelector<HTMLFormElement>("form[data-layers]");
  const stack = form?.querySelector<HTMLElement>("[data-layer-stack]");
  if (!form || !stack) return;
  form.addEventListener("submit", (e) => e.preventDefault());

  const sync = () => {
    const rows = [...stack.querySelectorAll<HTMLElement>("[data-layer]")];
    settings.layers.order = rows.map((r) => r.dataset.layer as LayerId).reverse();
    rows.forEach((row, i) => {
      const id = row.dataset.layer as LayerId;
      settings.layers.mode[id] = Number(row.querySelector<HTMLSelectElement>("select[name=mode]")!.value);
      const op = row.querySelector<HTMLInputElement>("input[name=opacity]")!;
      settings.layers.opacity[id] = Number(op.value);
      const out = op.parentElement?.querySelector("output");
      if (out) out.textContent = fmt(Number(op.value));
      settings.layers.visible[id] = row.querySelector<HTMLInputElement>("input[name=visible]")!.checked;
      row.querySelector<HTMLButtonElement>("[data-move=up]")!.disabled = i === 0;
      row.querySelector<HTMLButtonElement>("[data-move=down]")!.disabled = i === rows.length - 1;
    });
    const mask = form.querySelector<HTMLInputElement>("input[name=mask]:checked");
    settings.layers.mask = mask ? Number(mask.value) : 0;
    applyCss();
  };

  // Repli sans WebGPU : CSS connaît les mêmes modes de fusion.
  const CSS_MODES = ["normal", "multiply", "screen", "overlay", "soft-light", "difference"];
  const applyCss = () => {
    const L = settings.layers;
    L.order.forEach((id, i) => {
      const el = document.querySelector<HTMLElement>(`[data-css-layer="${id}"]`);
      if (!el) return;
      el.style.zIndex = String(i + 1);
      el.style.mixBlendMode = CSS_MODES[L.mode[id]] ?? "normal";
      el.style.opacity = String(L.opacity[id]);
      el.style.visibility = L.visible[id] ? "visible" : "hidden";
      const top = i === L.order.length - 1;
      const mask =
        !top || L.mask === 0
          ? "none"
          : L.mask === 1
            ? "radial-gradient(circle at 62% 42%, #000 0 22%, transparent 30%)"
            : "linear-gradient(to right, transparent 10%, #000 90%)";
      el.style.maskImage = mask;
      el.style.webkitMaskImage = mask;
    });
  };

  form.addEventListener("input", sync);
  form.addEventListener("change", sync);
  stack.addEventListener("click", (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>("[data-move]");
    if (!btn) return;
    const row = btn.closest<HTMLElement>("[data-layer]")!;
    if (btn.dataset.move === "up" && row.previousElementSibling) stack.insertBefore(row, row.previousElementSibling);
    if (btn.dataset.move === "down" && row.nextElementSibling) stack.insertBefore(row.nextElementSibling, row);
    sync();
    // Le bouton peut devenir inactif en bout de pile : on garde le focus sur la ligne.
    (btn.disabled ? row.querySelector<HTMLButtonElement>("[data-move]:not(:disabled)") : btn)?.focus();
  });
  sync();
}
