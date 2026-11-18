/**
 * Carnet — une seule tabulation par groupe, puis les flèches (planche d'autocollants, thèmes, feuille
 * « Plus », onglets). Les flèches suivent la disposition à l'écran : `nearestInDirection` de
 * @ui-sdk/core choisit l'élément le plus proche dans la direction pressée, quel que soit le nombre
 * de colonnes (la planche n'en a pas autant sur téléphone que sur ordinateur).
 */
import { nearestInDirection } from "@ui-sdk/core";

const DIRS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** Rend `container` navigable aux flèches entre ses `selector` ; appeler `refresh()` après un nouveau rendu. */
export function arrowGroup(container: HTMLElement, selector: string, o: { activate?: boolean } = {}) {
  const items = () => [...container.querySelectorAll<HTMLElement>(selector)].filter((el) => !el.hidden && el.offsetParent !== null);
  const refresh = (focused?: HTMLElement) => {
    const all = [...container.querySelectorAll<HTMLElement>(selector)];
    const stop = focused ?? all.find((el) => el.getAttribute("aria-pressed") === "true" || el.getAttribute("aria-selected") === "true") ?? all[0];
    for (const el of all) el.tabIndex = el === stop ? 0 : -1;
  };
  container.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const from = (e.target as HTMLElement).closest<HTMLElement>(selector);
    if (!from || !container.contains(from)) return;
    const list = items();
    let next: HTMLElement | undefined;
    if (e.key === "Home") next = list[0];
    else if (e.key === "End") next = list[list.length - 1];
    else if (DIRS[e.key]) {
      const k = nearestInDirection(
        from.getBoundingClientRect(),
        list.filter((el) => el !== from).map((el, i) => ({ key: String(i), rect: el.getBoundingClientRect() })),
        DIRS[e.key]!,
      );
      next = k === undefined ? undefined : list.filter((el) => el !== from)[Number(k)];
    }
    if (!next) return;
    e.preventDefault();
    refresh(next);
    next.focus();
    if (o.activate) next.click();
  });
  container.addEventListener("focusin", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(selector);
    if (el) refresh(el);
  });
  refresh();
  return { refresh: () => refresh() };
}
