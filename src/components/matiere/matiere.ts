/**
 * <x-matiere> côté navigateur : monte la matière demandée quand la figure approche de l'écran (300 px), et seulement
 * alors (cinq matières sur une page ne compilent pas cinq jeux de shaders au chargement). Sans WebGPU, la figure garde
 * son mot en HTML ; avec, elle reçoit `.is-gl` et le mot HTML s'efface. L'arrêt (démontage, perte de l'appareil GPU :
 * src/presse/components.ts) arrête la boucle de dessin et l'observateur.
 */
type Stoppable = { stop(): void };

export function mount(root: HTMLElement) {
  const kind = root.dataset.kind ?? "feu";
  const word = root.dataset.word ?? "";
  let inst: Stoppable | null = null;
  let stopped = false;
  const start = async () => {
    if (kind === "paillettes") {
      const { mountPaillettes } = await import("../../matieres/paillettes.ts");
      const api = await mountPaillettes(root, { image: root.dataset.image, word: word || "UBS" });
      if (root.dataset.metal) api.setMetal(root.dataset.metal as "argent" | "or" | "noir");
      return api;
    }
    if (kind === "phase") {
      const { mountPhase } = await import("../../matieres/phase.ts");
      return mountPhase(root);
    }
    const { mountElement } = await import("../../matieres/elements.ts");
    return mountElement(root, kind as "eau" | "eclair" | "feu", word);
  };
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      start()
        .then((i) => {
          if (stopped) return i.stop();
          inst = i;
          root.classList.add("is-gl");
        })
        .catch((err) => {
          console.warn(`[presse] matière ${kind}`, err);
          root.classList.add("mx-nogl");
        });
    },
    { rootMargin: "300px" },
  );
  io.observe(root);
  return () => {
    stopped = true;
    io.disconnect();
    inst?.stop();
    inst = null;
    root.classList.remove("is-gl");
  };
}
