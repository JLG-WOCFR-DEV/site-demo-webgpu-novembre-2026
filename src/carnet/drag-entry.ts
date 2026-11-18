/**
 * Carnet — glisser une ligne vers un autre jour : la migration du bullet journal, au geste.
 *
 * Construit sur les comportements de @ui-sdk/core (ui-sdk.dev) plutôt que refaits à la main :
 *   - bindDrag       suit le pointeur (capture, seuil, Échap annule, le clic qui suit est avalé) ;
 *   - bindHold       au doigt, un appui tenu prend la ligne (sinon le doigt fait défiler) ;
 *   - bindDragPreview une copie de la ligne suit le pointeur, au-dessus de tout (top layer) ;
 *   - createAutoScroll la page défile quand on approche du bord avec la ligne ;
 *   - announce       ce qui se passe est dit aux lecteurs d'écran.
 *
 * Souris et stylet : on tire la ligne (un simple clic l'ouvre toujours). Doigt : appui tenu, puis on
 * glisse. Clavier : « Déplacer vers… » (move.ts) reste l'équivalent. Lâchée sur un jour, la page du
 * mois, les notes de la semaine ou une collection, la ligne y migre (core.migrate) ; ailleurs, rien.
 */
import { announce, bindDrag, bindDragPreview, bindHold, createAutoScroll } from "@ui-sdk/core";
import type { Place } from "./core.ts";

export type DropTarget = { el: HTMLElement; place: Place; label: string };

export type EntryDragHooks = {
  /** Faux : pas de geste (lecture seule, mode Dessin, une ligne en cours d'édition…). */
  enabled(): boolean;
  /** La place visée sous le point (x, y), ou null ; jamais la place d'où part la ligne. */
  targetAt(x: number, y: number, id: string): DropTarget | null;
  /** La ligne lâchée sur une place. */
  drop(id: string, to: Place, label: string): void;
};

const ROW = "li.cn-row:not(.cn-ghost)";

/** Une ligne qu'on peut prendre : une entrée vivante (pas une trace « > », pas une suggestion). */
function draggable(row: Element | null): row is HTMLElement {
  return !!row && row instanceof HTMLElement && !!row.dataset.id && !!row.querySelector('.cn-text[data-act="edit"]') && !row.querySelector("textarea, input");
}

export function initEntryDrag(root: HTMLElement, h: EntryDragHooks) {
  let active = false;

  const start = (row: HTMLElement, down: PointerEvent, threshold: number) => {
    const id = row.dataset.id!;
    const text = row.querySelector(".cn-text")?.textContent?.trim() ?? "";
    let preview: ReturnType<typeof bindDragPreview> | null = null;
    let scroll: ReturnType<typeof createAutoScroll> | null = null;
    let target: DropTarget | null = null;
    let last = { x: down.clientX, y: down.clientY };
    const noScroll = (e: TouchEvent) => active && e.cancelable && e.preventDefault();

    const aim = () => {
      const t = h.targetAt(last.x, last.y, id);
      if (t?.el !== target?.el) {
        target?.el.classList.remove("is-drop-target");
        t?.el.classList.add("is-drop-target");
        if (t) announce(`Au-dessus de : ${t.label}`);
      }
      target = t;
      if (preview) preview.el.dataset.over = t ? "1" : "";
    };
    const finish = () => {
      active = false;
      preview?.remove();
      scroll?.stop();
      target?.el.classList.remove("is-drop-target");
      row.classList.remove("is-lifted");
      document.body.classList.remove("is-moving-entry");
      removeEventListener("touchmove", noScroll);
    };

    bindDrag(row, down, {
      threshold,
      cancelOnEscape: true,
      onStart: () => {
        if (!h.enabled()) return false;
        active = true;
        preview = bindDragPreview(row, { x: down.clientX, y: down.clientY });
        scroll = createAutoScroll({ ignore: () => preview?.el, onScroll: aim });
        row.classList.add("is-lifted");
        document.body.classList.add("is-moving-entry");
        addEventListener("touchmove", noScroll, { passive: false });
        navigator.vibrate?.(8);
        announce(`Ligne prise : ${text}. Lâche-la sur un autre jour, Échap pour annuler.`);
      },
      onMove: ({ x, y }) => {
        last = { x, y };
        preview?.move(x, y);
        scroll?.update(x, y);
        aim();
      },
      onEnd: (_e, canceled) => {
        const t = target;
        finish();
        if (canceled || !t) return void announce(canceled ? "Déplacement annulé" : "Lâchée hors d'une page : rien n'a bougé");
        h.drop(id, t.place, t.label);
        announce(`Déplacée ${t.label}`);
      },
    });
  };

  // Souris et stylet : on tire. (Le stylet qui écrit partout ne passe ici que sur les boutons.)
  root.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0 || active || !h.enabled()) return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, .cn-op, .cn-sticker, a")) return;
    const row = t.closest(ROW);
    if (!draggable(row)) return;
    // Pas de sélection de texte qui démarre sous la souris : le geste est à la ligne.
    if (e.pointerType === "mouse") e.preventDefault();
    start(row, e, 6);
  });

  // Doigt : un appui tenu prend la ligne. Lié à chaque ligne, une fois (les lignes gardent leur élément).
  const bound = new WeakSet<HTMLElement>();
  const bindRows = () => {
    for (const row of root.querySelectorAll<HTMLElement>(ROW)) {
      if (bound.has(row)) continue;
      bound.add(row);
      bindHold(row, {
        delay: 380,
        keys: [],
        onPress: (d) => d.input === "touch" && !active && h.enabled() && draggable(row) && !(d.event.target as HTMLElement).closest("input, textarea, .cn-op, .cn-sticker"),
        onHold: (d) => {
          start(row, d.event as PointerEvent, 0);
          return false;
        },
      });
    }
  };
  return { bindRows, get active() {
    return active;
  } };
}
