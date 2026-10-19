import { DEFAULT_LAB, materialFor } from "./lab.ts";
import { labClock, motion, settings } from "./state.ts";

/** Commandes HTML du laboratoire ; le canvas global ne reçoit aucun événement. */
export function bindLabControls() {
  const form = document.querySelector<HTMLFormElement>('form[data-controls="lab"]');
  const surface = document.querySelector<HTMLButtonElement>("[data-lab-surface]");
  const image = surface?.querySelector<HTMLImageElement>("img[data-gl-lab]");
  const readout = document.querySelector<HTMLElement>('[data-readout="lab"]');
  let currentMode = settings.lab.mode;
  let ready = false;

  const setText = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  };
  const say = (text: string) => {
    if (readout && readout.textContent !== text) readout.textContent = text;
  };

  function sync() {
    const lab = settings.lab;
    const material = materialFor(lab.mode);
    lab.mode = material.mode;
    if (currentMode !== lab.mode) {
      labClock.reset();
      currentMode = lab.mode;
    }
    ready = document.documentElement.classList.contains("gl-on") && !!image?.hasAttribute("data-gl-ready");
    setText("lab-effect-title", material.title);
    setText("lab-effect-description", material.description);
    setText("lab-effect-technique", material.technique);
    setText("lab-effect-use", material.use);
    const source = document.getElementById("lab-effect-source") as HTMLAnchorElement | null;
    if (source) {
      source.href = `https://canvasui.dev/docs/components/${material.source}`;
      source.textContent = `Voir ${material.reference} sur Canvas UI`;
    }
    for (const input of form?.querySelectorAll<HTMLInputElement>("input") ?? []) {
      // Le sélecteur reste utilisable sans GPU pour lire chaque explication.
      input.disabled = input.type !== "radio" && !ready;
      if (input.name === "speed") input.disabled = !ready || !material.animated || motion.reduced || lab.paused;
      if (input.name === "paused") input.disabled = !ready || motion.reduced;
    }
    if (surface) {
      surface.disabled = !ready;
      surface.setAttribute("aria-label", `Planche interactive : ${material.title}. Flèches pour déplacer le point, Entrée pour déclencher.`);
    }
    const replay = form?.querySelector<HTMLButtonElement>('[data-action="lab-replay"]');
    if (replay) {
      replay.disabled = !ready;
      replay.textContent = lab.mode === 1 ? "Déclencher au centre" : "Recentrer l’interaction";
    }
    const chapter = document.getElementById("ch-lab");
    chapter?.classList.toggle("lab-comparing", ready && lab.compare);
    chapter?.classList.toggle("lab-ready", ready);
    if (!ready) {
      labClock.suspend();
      say(image?.hasAttribute("data-gl-error")
        ? "La texture GPU n’a pas pu être chargée. La photographie HTML et les explications restent disponibles."
        : document.documentElement.classList.contains("gl-on")
          ? "Chargement de la photographie dans le GPU…"
          : "Mode HTML : la photo et les six explications restent disponibles. Les matières s’activent avec WebGPU.");
    } else if (motion.reduced) {
      say("Mouvement réduit : aperçu fixe, sans animation ni suivi du pointeur. Les réglages et les flèches de la planche permettent de l’explorer.");
    } else if (lab.paused) {
      say("Matière figée : temps et suivi du pointeur arrêtés. Les réglages restent disponibles ; la reprise conserve cet instant.");
    } else {
      say(material.animated
        ? `${material.title} en mouvement. Cliquez dans la planche ou utilisez ses flèches et la touche Entrée. Le calcul de la matière est inclus dans « Scène ».`
        : `${material.title} : réglage fixe${lab.mode === 2 || lab.mode === 5 ? ", centre déplaçable au pointeur ou avec les flèches" : ""}. Le calcul de la matière est inclus dans « Scène ».`);
    }
  }

  const positionFromEvent = (e: PointerEvent | MouseEvent) => {
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    if (rect.width && rect.height) labClock.point((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  };

  surface?.addEventListener("pointermove", (e) => {
    if (!ready || settings.lab.paused || motion.reduced) return;
    if (e.pointerType === "touch" && e.pressure === 0) return;
    positionFromEvent(e);
  });
  surface?.addEventListener("click", (e) => {
    if (!ready) return;
    // detail=0 : clic généré par Entrée/Espace, conserver le centre choisi au clavier.
    if (e.detail > 0) positionFromEvent(e);
    labClock.trigger(motion.reduced || settings.lab.paused);
    say(`${settings.lab.mode === 1 ? "Onde déclenchée" : "Point placé"} à ${Math.round(labClock.x * 100)} % horizontalement et ${Math.round(labClock.y * 100)} % verticalement.`);
  });
  surface?.addEventListener("keydown", (e) => {
    if (!ready) return;
    const step = e.shiftKey ? 0.02 : 0.08;
    const moves: Record<string, readonly [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (e.key !== "Home" && !move) return;
    e.preventDefault();
    if (move) labClock.point(labClock.x + move[0], labClock.y + move[1]);
    else labClock.point(0.5, 0.5);
    if (settings.lab.mode === 1 && (motion.reduced || settings.lab.paused)) labClock.trigger(true);
    say(`Point : ${Math.round(labClock.x * 100)} % horizontalement, ${Math.round(labClock.y * 100)} % verticalement. Entrée déclenche à cette position.`);
  });

  form?.querySelector('[data-action="lab-replay"]')?.addEventListener("click", () => {
    if (!ready) return;
    labClock.point(0.5, 0.5);
    labClock.trigger(motion.reduced || settings.lab.paused);
    say(settings.lab.mode === 1 ? "Onde déclenchée au centre de la planche." : "Point d’interaction recentré.");
  });
  form?.querySelector('[data-action="lab-reset"]')?.addEventListener("click", () => {
    Object.assign(settings.lab, DEFAULT_LAB);
    labClock.reset();
    for (const input of form.querySelectorAll<HTMLInputElement>("input[name]")) {
      const value = settings.lab[input.name as keyof typeof settings.lab];
      if (value === undefined) continue;
      if (input.type === "checkbox") input.checked = Boolean(value);
      else if (input.type === "radio") input.checked = Number(input.value) === value;
      else input.value = String(value);
    }
    // Réutiliser le contrôleur commun pour mettre à jour les sorties des curseurs.
    for (const input of form.querySelectorAll<HTMLInputElement>('input[type="range"]')) {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    sync();
  });

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  if (image) observer.observe(image, { attributes: true, attributeFilter: ["data-gl-ready", "data-gl-error"] });
  sync();
  return { sync };
}
