/**
 * Le cadre de <x-liquide frame> : une largeur qu'on tire pour voir la grille se recomposer sans redimensionner la fenêtre.
 *
 * Poignée sur le bord droit (pointeur, ou flèches au clavier), largeurs types, balayage automatique, bascule Grid / Flex,
 * et un relevé : largeur du cadre, cartes par rangée, largeur d'une carte. La grille compte sur son conteneur, pas
 * sur la fenêtre (ses écarts sont en cqi) : le cadre est une fenêtre miniature.
 */
const MIN = 300;
const SWEEP_S = 7;

export function mountFrame(root: HTMLElement, relayout: (mutate: () => void) => void) {
  const frame = root.querySelector<HTMLElement>("[data-lq-frame]");
  if (!frame) return () => {};
  const bar = frame.querySelector<HTMLElement>("[data-lq-frame-bar]")!;
  const stage = frame.querySelector<HTMLElement>("[data-lq-stage]")!;
  const grid = stage.querySelector<HTMLElement>(".lq-grid")!;
  const handle = frame.querySelector<HTMLElement>("[data-lq-handle]")!;
  const out = frame.querySelector<HTMLOutputElement>("[data-lq-size]");
  const sweepBtn = frame.querySelector<HTMLButtonElement>("[data-lq-sweep]");
  const sizes = [...frame.querySelectorAll<HTMLButtonElement>("button[data-w]")];
  const layouts = [...frame.querySelectorAll<HTMLButtonElement>("button[data-layout]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  bar.hidden = false;
  handle.hidden = false;
  frame.classList.add("is-live");

  // Largeur voulue (px, bord compris) ; null : toute la place.
  let want: number | null = null;
  let raf = 0;
  const max = () => Math.max(MIN, frame.clientWidth);
  const now = () => stage.getBoundingClientRect().width;
  const apply = (w: number | null) => {
    want = w == null ? null : Math.round(Math.min(max(), Math.max(MIN, w)));
    stage.style.width = want == null ? "" : `${want}px`;
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    sweepBtn?.setAttribute("aria-pressed", "false");
  };

  /** Va en douceur vers une largeur (null : toute la place). */
  const tween = (target: number | null) => {
    stop();
    const from = now();
    const to = target == null ? max() : Math.min(max(), Math.max(MIN, target));
    if (reduced.matches || Math.abs(to - from) < 1) return apply(target);
    const t0 = performance.now();
    const dur = 520;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      apply(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        raf = 0;
        apply(target);
      }
    };
    raf = requestAnimationFrame(step);
  };

  const sweep = () => {
    if (raf && sweepBtn?.getAttribute("aria-pressed") === "true") return stop();
    stop();
    sweepBtn?.setAttribute("aria-pressed", "true");
    // Repart de la largeur actuelle : phase choisie pour ne pas sauter.
    const lo = MIN;
    const span = () => max() - lo;
    const x0 = Math.min(1, Math.max(0, (now() - lo) / Math.max(1, span())));
    const phase = Math.acos(1 - 2 * x0);
    const t0 = performance.now();
    const step = (t: number) => {
      const a = phase + (((t - t0) / 1000) * 2 * Math.PI) / SWEEP_S;
      apply(lo + span() * (0.5 - 0.5 * Math.cos(a)));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  /* ───── Poignée ───── */

  let drag: { id: number; x: number; w: number } | null = null;
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    stop();
    drag = { id: e.pointerId, x: e.clientX, w: now() };
    handle.setPointerCapture(e.pointerId);
    frame.classList.add("is-resizing");
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const w = drag.w + e.clientX - drag.x;
    apply(w >= max() - 2 ? null : w);
  });
  const end = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    drag = null;
    frame.classList.remove("is-resizing");
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
  handle.addEventListener("dblclick", () => tween(null));
  handle.addEventListener("keydown", (e) => {
    const k = e.shiftKey ? 100 : 10;
    const w = now();
    let to: number | null | undefined;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = w - k;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") to = w + k >= max() ? null : w + k;
    else if (e.key === "Home") to = MIN;
    else if (e.key === "End") to = null;
    else return;
    e.preventDefault();
    stop();
    apply(to);
  });

  /* ───── Largeurs types, balayage, Grid / Flex ───── */

  for (const b of sizes) b.addEventListener("click", () => tween(b.dataset.w ? Number(b.dataset.w) : null));
  sweepBtn?.addEventListener("click", sweep);
  for (const b of layouts)
    b.addEventListener("click", () => {
      const v = b.dataset.layout === "flex" ? "flex" : "grid";
      if ((grid.dataset.layout ?? "grid") === v) return;
      relayout(() => {
        if (v === "flex") grid.dataset.layout = "flex";
        else delete grid.dataset.layout;
      });
      for (const o of layouts) o.setAttribute("aria-pressed", String(o === b));
    });

  /* ───── Relevé ───── */

  const read = () => {
    const w = Math.round(now());
    const m = max();
    const cards = [...grid.querySelectorAll<HTMLElement>(".lq-card:not([hidden]):not(.is-out)")];
    // Cartes par rangée : celles qui partagent le haut de la première (le décalage FLIP n'y est pour rien : offsetTop).
    const top = cards[0]?.offsetTop ?? 0;
    const row = cards.filter((c) => Math.abs(c.offsetTop - top) < 2).length;
    const cw = Math.round(cards[0]?.offsetWidth ?? 0);
    const text = `${w} px · ${row} par rangée · cartes de ${cw} px`;
    if (out) out.textContent = text;
    handle.setAttribute("aria-valuemin", String(MIN));
    handle.setAttribute("aria-valuemax", String(Math.round(m)));
    handle.setAttribute("aria-valuenow", String(w));
    handle.setAttribute("aria-valuetext", text);
    for (const b of sizes) {
      const bw = b.dataset.w ? Number(b.dataset.w) : null;
      b.setAttribute("aria-pressed", String(bw == null ? want == null : want === bw));
      b.disabled = bw != null && bw >= m;
    }
  };
  const ro = new ResizeObserver(read);
  ro.observe(stage);
  ro.observe(frame);
  // Un filtre ou un mélange change la première rangée sans changer la taille.
  const mo = new MutationObserver(read);
  mo.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "data-layout"] });

  return () => {
    stop();
    ro.disconnect();
    mo.disconnect();
  };
}
