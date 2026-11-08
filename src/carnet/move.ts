/**
 * Carnet — « Déplacer vers… » (roadmap P4a) : la migration sans glisser-déposer.
 *
 * Un menu ancré au bouton › de la ligne : aujourd'hui, demain, lundi prochain, la page du mois
 * suivant, une collection, ou un jour choisi au calendrier natif. Au clavier : flèches, Entrée,
 * Échap (le focus revient au bouton). Au doigt : des cibles de 44 px. Avec TalkBack : un vrai
 * menu (role="menu"), chaque choix dit sa destination.
 */
import type { Collection, Place } from "./core.ts";
import { addDays, parseDay, weekStart, type Day } from "./model.ts";

export type MoveChoice = { label: string; place: Place; hint?: string };

const fDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fMonth = new Intl.DateTimeFormat("fr-FR", { month: "long" });

/** Les destinations proposées pour une entrée qui est en `from` (jour, mois ou collection). */
export function moveChoices(from: Place, now: Day, cols: Collection[]): MoveChoice[] {
  const out: MoveChoice[] = [];
  const day = (d: Day, label: string) => out.push({ label, hint: fDay.format(parseDay(d)), place: { scope: "day", day: d } });
  if (!(from.scope === "day" && from.day === now)) day(now, "Aujourd’hui");
  const tomorrow = addDays(from.scope === "day" && from.day && from.day > now ? from.day : now, 1);
  day(tomorrow, from.scope === "day" && from.day && from.day > now ? "Le lendemain" : "Demain");
  const nextMonday = addDays(weekStart(now), 7);
  if (nextMonday !== tomorrow) day(nextMonday, "Lundi prochain");
  const [y, m] = now.split("-").map(Number);
  const nm = new Date(y!, m!, 1);
  const month = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, "0")}`;
  if (from.scope !== `month:${month}`) out.push({ label: "Mois prochain", hint: `page de ${fMonth.format(nm)}`, place: { scope: `month:${month}`, day: null } });
  for (const c of cols.slice(0, 6)) {
    if (from.scope !== `collection:${c.id}`) out.push({ label: c.name, hint: "collection", place: { scope: `collection:${c.id}`, day: null } });
  }
  return out;
}

let open: { close: () => void } | null = null;

/** Ouvre le menu sous `anchor` ; `pick` reçoit la place choisie. */
export function openMoveMenu(anchor: HTMLElement, choices: MoveChoice[], pick: (p: Place) => void) {
  open?.close();
  const menu = document.createElement("div");
  menu.className = "cn-move";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Déplacer vers");
  menu.dataset.glIgnore = "";
  const items: HTMLElement[] = [];
  const add = (label: string, hint: string | undefined, run: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cn-move-item";
    b.setAttribute("role", "menuitem");
    b.tabIndex = -1;
    b.append(document.createTextNode(label));
    if (hint) {
      const h = document.createElement("span");
      h.className = "cn-move-hint";
      h.textContent = hint;
      b.append(h);
    }
    b.addEventListener("click", run);
    menu.append(b);
    items.push(b);
    return b;
  };
  for (const c of choices) {
    add(c.label, c.hint, () => {
      close();
      pick(c.place);
    });
  }
  // Un jour quelconque : le calendrier du système (accessible, et le bon sur Android).
  const date = document.createElement("input");
  date.type = "date";
  date.className = "cn-move-date";
  date.setAttribute("aria-label", "Choisir un jour");
  date.tabIndex = -1;
  date.addEventListener("change", () => {
    if (!date.value) return;
    close();
    pick({ scope: "day", day: date.value });
  });
  const pickDay = add("Choisir un jour…", undefined, () => {
    date.hidden = false;
    date.focus();
    (date as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
  });
  date.hidden = true;
  pickDay.after(date);
  items.push(date);

  const r = anchor.getBoundingClientRect();
  document.body.append(menu);
  const w = menu.offsetWidth;
  const h = menu.offsetHeight;
  const left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w));
  const below = r.bottom + 4 + h < innerHeight;
  menu.style.left = `${left + scrollX}px`;
  menu.style.top = `${(below ? r.bottom + 4 : Math.max(8, r.top - h - 4)) + scrollY}px`;

  const focusAt = (i: number) => items[(i + items.length) % items.length]?.focus();
  const onKey = (ev: KeyboardEvent) => {
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (ev.key === "Escape") {
      ev.preventDefault();
      close();
      anchor.focus();
    } else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      focusAt(i + 1);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      focusAt(i - 1);
    } else if (ev.key === "Home" || ev.key === "End") {
      ev.preventDefault();
      focusAt(ev.key === "Home" ? 0 : items.length - 1);
    } else if (ev.key === "Tab") {
      close();
    }
  };
  const onDown = (ev: PointerEvent) => {
    if (!menu.contains(ev.target as Node) && ev.target !== anchor) close();
  };
  function close() {
    menu.remove();
    removeEventListener("keydown", onKey, true);
    removeEventListener("pointerdown", onDown, true);
    anchor.setAttribute("aria-expanded", "false");
    open = null;
  }
  addEventListener("keydown", onKey, true);
  addEventListener("pointerdown", onDown, true);
  anchor.setAttribute("aria-expanded", "true");
  open = { close };
  focusAt(0);
}
