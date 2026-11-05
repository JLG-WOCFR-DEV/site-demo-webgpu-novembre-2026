/**
 * Composant « tambour » : une liste posée sur un cylindre vu de face (le HTML vient de <x-tambour>, src/presse/render.ts).
 *
 * La liste est une bande déroulée ; le tambour la fait tourner. Une ligne à la distance d le long de la bande, mesurée
 * depuis le centre, fait l'angle θ = d / R : elle est vue à R·sin θ du centre, écrasée de cos θ, espacée et passée en
 * italique vers les bords. Rien n'est peint par le GPU ici : ce sont des transformations CSS (translate, scale) et une
 * variable d'approche, sur l'horloge commune du moteur de temps. Le texte reste du texte (sélection, lecteurs d'écran).
 *
 * Il tourne seul (speed, lignes par seconde), avec le défilement de la page (scroll) et au glisser, avec inertie. Hors de
 * l'écran, il s'arrête. Mouvement réduit : il ne tourne plus seul, mais suit encore la main.
 */
import { everyFrame, reducedMotion } from "../../presse/timeline.ts";

const TILT = 0.55;

export function mount(root: HTMLElement) {
  const list = root.querySelector<HTMLOListElement>(".tb-list")!;
  const speed = Number(root.dataset.speed ?? 0.3);
  const couple = Number(root.dataset.scroll ?? 1);

  // Assez de lignes pour faire le tour du tambour : sinon, on en répète (copies muettes).
  const originals = [...list.children] as HTMLLIElement[];
  root.classList.add("is-live");
  let items: { el: HTMLLIElement; h: number; y: number }[] = [];
  let L = 1;
  let R = 1;
  const measure = () => {
    for (const it of items) if (it.el.dataset.tbCopy !== undefined) it.el.remove();
    for (const el of originals) el.style.cssText = "";
    const H = root.clientHeight;
    R = H / 2;
    const gap = Number.parseFloat(getComputedStyle(root).getPropertyValue("--tb-gap")) || 0;
    const base = originals.map((el) => el.offsetHeight + gap);
    const one = base.reduce((a, b) => a + b, 0);
    // Une demi-circonférence visible (π·R) et un peu de marge pour la couture.
    const copies = Math.max(0, Math.ceil((Math.PI * R * 1.25) / Math.max(1, one)) - 1);
    const els = [...originals];
    for (let c = 0; c < copies; c++)
      for (const el of originals) {
        const k = el.cloneNode(true) as HTMLLIElement;
        k.dataset.tbCopy = "";
        k.setAttribute("aria-hidden", "true");
        list.append(k);
        els.push(k);
      }
    let y = 0;
    items = els.map((el, i) => {
      const h = base[i % originals.length]!;
      const it = { el, h, y: y + h / 2 };
      y += h;
      return it;
    });
    L = Math.max(1, y);
  };
  measure();

  let s = 0;
  let v = 0;
  let lastScroll = scrollY;
  let drag: { id: number; y: number; t: number } | null = null;
  let onScreen = true;
  const avgH = () => L / Math.max(1, items.length);

  const place = () => {
    for (const it of items) {
      // Distance enroulée le long de la bande, centrée sur le milieu du tambour.
      let d = (((it.y - s) % L) + L) % L;
      if (d > L / 2) d -= L;
      const th = d / R;
      const el = it.el;
      if (Math.abs(th) > Math.PI / 2 - 0.02) {
        if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
        continue;
      }
      const c = Math.cos(th);
      el.style.visibility = "";
      el.style.translate = `0 ${(R * Math.sin(th) - it.h / 2).toFixed(2)}px`;
      el.style.scale = `1 ${c.toFixed(4)}`;
      el.style.setProperty("--tb-c", c.toFixed(3));
      el.classList.toggle("is-tilt", Math.abs(th) > TILT);
    }
  };

  const clock = everyFrame((dt) => {
    if (!onScreen) return false;
    const ds = scrollY - lastScroll;
    lastScroll = scrollY;
    if (!drag) {
      // Inertie du glisser, qui retombe vers la rotation propre.
      const own = reducedMotion() ? 0 : speed * avgH();
      v += (own - v) * (1 - Math.exp(-dt * 2.2));
    }
    s += v * dt + (Math.abs(ds) < 800 ? ds * couple : 0);
    place();
    return true;
  });

  root.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    drag = { id: e.pointerId, y: e.clientY, t: performance.now() };
    root.setPointerCapture(e.pointerId);
    root.classList.add("is-dragging");
    v = 0;
  });
  root.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dy = drag.y - e.clientY;
    const now = performance.now();
    const dt = Math.max(1, now - drag.t) / 1000;
    s += dy;
    v = v * 0.6 + (dy / dt) * 0.4;
    drag.y = e.clientY;
    drag.t = now;
    place();
  });
  const end = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    drag = null;
    root.classList.remove("is-dragging");
  };
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);
  root.addEventListener("keydown", (e) => {
    const k = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!k) return;
    e.preventDefault();
    v += k * avgH() * 6;
  });

  const io = new IntersectionObserver(([e]) => {
    onScreen = !!e?.isIntersecting;
    if (onScreen) {
      lastScroll = scrollY;
      clock.wake();
    }
  });
  io.observe(root);
  const ro = new ResizeObserver(() => {
    measure();
    place();
  });
  ro.observe(root);
  place();

  return () => {
    clock.stop();
    io.disconnect();
    ro.disconnect();
    for (const it of items) if (it.el.dataset.tbCopy !== undefined) it.el.remove();
    for (const el of originals) el.style.cssText = "";
    root.classList.remove("is-live", "is-dragging");
  };
}
