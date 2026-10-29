/**
 * Le cadran d'angle de Presse, comme celui de Photoshop / InDesign /
 * Illustrator : un cercle, une aiguille du centre au bord ; on attrape le
 * cercle et on tourne. 0° pointe à droite, les angles croissent dans le sens
 * inverse des aiguilles d'une montre (la convention d'Adobe).
 *
 *  - glisser : l'aiguille suit le pointeur ; Maj cale sur 15° ;
 *  - molette : ±1° (Maj : ±15°) ;
 *  - clavier : flèches ±1°, Maj + flèches ±15°, Origine : 0° ;
 *  - double-clic : revient à la valeur par défaut.
 *
 * Il enrichit un <input type="number" data-angle> existant : l'input reste
 * la vérité (sa valeur, ses événements « input » et « change »), le cadran
 * n'est qu'une poignée posée devant lui. Sans JS, on tape l'angle.
 */
import "./angle.css";

const norm = (a: number) => {
  let x = ((((a + 180) % 360) + 360) % 360) - 180;
  if (x === -180) x = 180;
  return Math.round(x);
};

export function enhanceAngle(input: HTMLInputElement) {
  if (input.dataset.angleReady) return;
  input.dataset.angleReady = "1";
  const initial = Number(input.defaultValue || input.value) || 0;
  const dial = document.createElement("span");
  dial.className = "pr-angle";
  dial.tabIndex = 0;
  dial.setAttribute("role", "slider");
  dial.setAttribute("aria-valuemin", "-180");
  dial.setAttribute("aria-valuemax", "180");
  const label = input.closest("label")?.querySelector("span")?.textContent ?? "Angle";
  dial.setAttribute("aria-label", label);
  dial.innerHTML = `<svg viewBox="-16 -16 32 32" aria-hidden="true"><circle r="14.5" class="pr-angle-ring"/><line x1="0" y1="0" x2="13" y2="0" class="pr-angle-needle"/><circle r="1.6" class="pr-angle-hub"/></svg>`;
  const needle = dial.querySelector("line")!;
  input.before(dial);

  const show = () => {
    const a = Number(input.value) || 0;
    needle.setAttribute("transform", `rotate(${-a})`);
    dial.setAttribute("aria-valuenow", String(a));
    dial.setAttribute("aria-valuetext", `${a}°`);
  };
  const set = (a: number, commit = false) => {
    const v = norm(a);
    if (String(v) !== input.value) {
      input.value = String(v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (commit) input.dispatchEvent(new Event("change", { bubbles: true }));
    show();
  };
  const fromPointer = (e: PointerEvent) => {
    const r = dial.getBoundingClientRect();
    const a = (Math.atan2(-(e.clientY - (r.top + r.height / 2)), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
    return e.shiftKey ? Math.round(a / 15) * 15 : a;
  };

  dial.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dial.focus();
    dial.setPointerCapture(e.pointerId);
    dial.classList.add("is-drag");
    set(fromPointer(e));
  });
  dial.addEventListener("pointermove", (e) => {
    if (dial.hasPointerCapture(e.pointerId)) set(fromPointer(e));
  });
  const end = (e: PointerEvent) => {
    if (!dial.hasPointerCapture(e.pointerId)) return;
    dial.releasePointerCapture(e.pointerId);
    dial.classList.remove("is-drag");
    set(Number(input.value), true);
  };
  dial.addEventListener("pointerup", end);
  dial.addEventListener("pointercancel", end);
  dial.addEventListener("dblclick", () => set(initial, true));
  dial.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const step = e.shiftKey ? 15 : 1;
      set(Number(input.value) + (e.deltaY < 0 ? step : -step), true);
    },
    { passive: false },
  );
  dial.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 15 : 1;
    const k = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step } as Record<string, number>;
    if (e.key in k) set(Number(input.value) + k[e.key]!, true);
    else if (e.key === "Home") set(0, true);
    else return;
    e.preventDefault();
  });
  // L'input tapé à la main fait tourner l'aiguille.
  input.addEventListener("input", show);
  input.addEventListener("change", () => set(Number(input.value)));
  show();
  return dial;
}

/** Enrichit tous les <input data-angle> sous `root`. */
export function enhanceAngles(root: ParentNode = document) {
  root.querySelectorAll<HTMLInputElement>("input[data-angle]").forEach(enhanceAngle);
}
