/**
 * Focus itinérant (« roving tabindex », WAI-ARIA) — un seul arrêt de Tab pour tout un groupe (onglets, segments,
 * barre d'outils, liste), et les flèches pour aller d'un élément à l'autre.
 *
 *   const fi = creerFocusItinerant(liste, { elements: "[role=tab]", orientation: "horizontal", activation: "auto" });
 *   fi.detruire();
 *
 * Règles :
 * - un seul élément porte `tabindex="0"`, les autres `-1` : l'élément `actif` (sélectionné, pressé) s'il y en a un,
 *   sinon le dernier focalisé (retrouvé par sa `cle`, même si l'appli a redessiné la liste), sinon le premier activable ;
 * - flèches selon l'`orientation` (gauche et droite inversées en écriture de droite à gauche), Début et Fin ;
 *   `boucle` : passer d'un bout à l'autre ; les éléments `desactive` sont sautés et ne portent jamais l'arrêt ;
 * - les touches avec Alt, Ctrl, ⌘ ou Maj ne sont pas prises (Alt + flèches reste au réordonnancement) ;
 *   un événement déjà traité (`defaultPrevented`) non plus ;
 * - `activation: "auto"` : arriver sur un élément le clique (onglets) ; `"manuelle"` : Entrée ou Espace (segments) ;
 * - la liste peut être redessinée : un MutationObserver, limité au conteneur, recalcule les tabindex ; après
 *   `surDeplacement`, l'élément est retrouvé par sa clé et reprend le focus.
 *
 * Ciblage : un seul écouteur `keydown` et un `focusin`, sur le conteneur. Rien sur `document`.
 */
import { cleParDefaut, elementsDe, retrouver } from "./commun.ts";

export type Orientation = "horizontal" | "vertical" | "les-deux";

export interface OptionsFocusItinerant {
  /** Les éléments du groupe, relatifs au conteneur. Défaut : `:scope > *`. */
  elements?: string;
  /** Défaut : `"horizontal"`. */
  orientation?: Orientation;
  /** Passer de la fin au début. Défaut : `true`. */
  boucle?: boolean;
  /** Arriver sur un élément le clique (`"auto"`, des onglets) ou non (`"manuelle"`, défaut). */
  activation?: "auto" | "manuelle";
  /** Un élément qu'on saute. Défaut : `disabled`, `aria-disabled="true"`, `hidden`. */
  desactive?: (el: HTMLElement) => boolean;
  /** L'élément qui porte l'arrêt avant tout focus. Défaut : `aria-selected`, `aria-pressed`, `aria-checked` ou `aria-current` vrais. */
  actif?: (el: HTMLElement) => boolean;
  /** L'identité d'un élément, pour le retrouver après un nouveau rendu. Défaut : `data-cle`, `id`, premier `data-*`. */
  cle?: (el: HTMLElement) => string;
  /** Appelé après un déplacement aux flèches (l'élément peut avoir été redessiné ensuite). */
  surDeplacement?: (el: HTMLElement, index: number) => void;
}

export interface FocusItinerant {
  detruire(): void;
  /** Recalcule les tabindex (automatique quand la liste change ; utile après un changement d'état hors attributs). */
  actualiser(): void;
  /** Donne le focus à un élément (rang ou élément), ou à celui qui porte l'arrêt. */
  focaliser(cible?: number | HTMLElement): void;
  elements(): HTMLElement[];
}

/** La touche → le sens : -1, +1, « début », « fin », ou `null` si la touche n'est pas au groupe. */
export function sensDeTouche(touche: string, orientation: Orientation, rtl = false): -1 | 1 | "debut" | "fin" | null {
  const h = orientation !== "vertical";
  const v = orientation !== "horizontal";
  if (touche === "Home") return "debut";
  if (touche === "End") return "fin";
  if (h && touche === "ArrowRight") return rtl ? -1 : 1;
  if (h && touche === "ArrowLeft") return rtl ? 1 : -1;
  if (v && touche === "ArrowDown") return 1;
  if (v && touche === "ArrowUp") return -1;
  return null;
}

/**
 * Le rang d'arrivée depuis `courant` parmi `n` éléments, en sautant ceux pour lesquels `saute(i)` est vrai.
 * Sans boucle, au bout : reste sur place (rend `courant`). Rend `-1` si aucun élément n'est activable.
 */
export function prochainIndex(sens: -1 | 1 | "debut" | "fin", courant: number, n: number, boucle: boolean, saute: (i: number) => boolean = () => false): number {
  if (n <= 0) return -1;
  if (sens === "debut" || sens === "fin") {
    const pas = sens === "debut" ? 1 : -1;
    for (let k = 0, i = sens === "debut" ? 0 : n - 1; k < n; k++, i += pas) if (!saute(i)) return i;
    return -1;
  }
  let i = courant;
  for (let k = 0; k < n; k++) {
    i += sens;
    if (i < 0 || i >= n) {
      if (!boucle) return courant;
      i = (i + n) % n;
    }
    if (!saute(i)) return i;
  }
  return saute(courant) ? -1 : courant;
}

/** Le rang qui porte l'arrêt de Tab : l'actif, sinon le mémorisé, sinon le premier activable ; `-1` si aucun. */
export function rangDeLArret(n: number, saute: (i: number) => boolean, actif: (i: number) => boolean, memorise: number): number {
  for (let i = 0; i < n; i++) if (actif(i) && !saute(i)) return i;
  if (memorise >= 0 && memorise < n && !saute(memorise)) return memorise;
  for (let i = 0; i < n; i++) if (!saute(i)) return i;
  return -1;
}

const vrai = (el: HTMLElement, a: string) => el.getAttribute(a) === "true" || (a === "aria-current" && !!el.getAttribute(a) && el.getAttribute(a) !== "false");
const actifParDefaut = (el: HTMLElement) => ["aria-selected", "aria-pressed", "aria-checked", "aria-current"].some((a) => vrai(el, a));
const desactiveParDefaut = (el: HTMLElement) => (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true" || el.hidden !== false;

export function creerFocusItinerant(conteneur: HTMLElement, options: OptionsFocusItinerant = {}): FocusItinerant {
  const sel = options.elements ?? ":scope > *";
  const orientation = options.orientation ?? "horizontal";
  const boucle = options.boucle ?? true;
  const desactive = options.desactive ?? desactiveParDefaut;
  const actif = options.actif ?? actifParDefaut;
  const cle = options.cle ?? cleParDefaut;
  let memo = ""; // la clé du dernier élément focalisé
  let enCours = false;

  const liste = () => elementsDe(conteneur, sel);
  const rtl = () => getComputedStyle(conteneur).direction === "rtl";

  function actualiser() {
    if (enCours) return;
    enCours = true;
    const els = liste();
    const m = memo ? els.findIndex((el) => cle(el) === memo) : -1;
    const r = rangDeLArret(els.length, (i) => desactive(els[i]!), (i) => actif(els[i]!), m);
    els.forEach((el, i) => {
      const t = i === r ? "0" : "-1";
      if (el.getAttribute("tabindex") !== t) el.setAttribute("tabindex", t);
    });
    enCours = false;
  }

  function aller(el: HTMLElement, i: number) {
    const k = cle(el);
    memo = k;
    el.focus();
    if (options.activation === "auto") el.click();
    options.surDeplacement?.(el, i);
    // L'appli a pu redessiner la liste : l'élément de même clé reprend le focus.
    const ici = el.isConnected ? el : retrouver(conteneur, sel, cle, k);
    actualiser();
    if (ici && document.activeElement !== ici) ici.focus();
  }

  const surTouche = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const els = liste();
    const de = els.findIndex((el) => el === e.target || el.contains(e.target as Node));
    if (de < 0) return;
    // Une touche tapée dans un champ, dans l'élément, reste au champ.
    if (e.target !== els[de] && (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
    const sens = sensDeTouche(e.key, orientation, rtl());
    if (sens === null) return;
    e.preventDefault();
    const vers = prochainIndex(sens, de, els.length, boucle, (i) => desactive(els[i]!));
    if (vers < 0 || vers === de) return;
    aller(els[vers]!, vers);
  };

  const surFocus = (e: FocusEvent) => {
    const el = liste().find((x) => x === e.target);
    if (!el || desactive(el)) return;
    memo = cle(el);
    // L'élément focalisé (au clic, par le programme) porte l'arrêt, sauf si un élément actif le garde (onglets).
    const els = liste();
    if (!els.some((x) => actif(x) && !desactive(x))) els.forEach((x) => x.setAttribute("tabindex", x === el ? "0" : "-1"));
  };

  const obs = typeof MutationObserver === "function" ? new MutationObserver(() => actualiser()) : null;
  obs?.observe(conteneur, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-selected", "aria-pressed", "aria-checked", "aria-current", "disabled", "aria-disabled", "hidden"] });
  conteneur.addEventListener("keydown", surTouche);
  conteneur.addEventListener("focusin", surFocus);
  actualiser();

  return {
    detruire() {
      obs?.disconnect();
      conteneur.removeEventListener("keydown", surTouche);
      conteneur.removeEventListener("focusin", surFocus);
    },
    actualiser,
    focaliser(cible) {
      const els = liste();
      const el = typeof cible === "number" ? els[cible] : (cible ?? els.find((x) => x.getAttribute("tabindex") === "0") ?? els[0]);
      el?.focus();
    },
    elements: liste,
  };
}
