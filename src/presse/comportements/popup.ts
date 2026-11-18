/**
 * Popup — une fenêtre posée contre un déclencheur (choix, menu, panneau), ou un dialogue modal.
 *
 *   const p = creerPopup(panneau, { cote: "bas", alignement: "debut" });
 *   bouton.onclick = () => p.basculer(bouton);
 *   p.detruire();
 *
 * - Ouvrir : l'élément perd `hidden`, prend `position: fixed` et sa place contre le déclencheur (`placer`) : il se
 *   retourne s'il déborde de la fenêtre, puis reste dans la fenêtre à `marge` px des bords. Le focus va au premier
 *   élément focalisable (ou à `focusInitial`, ou nulle part avec `false`).
 * - Fermer : Échap, un appui à l'extérieur (`fermerExterieur`), le focus qui part ailleurs (popup non modale :
 *   `fermerSurPerteFocus`, ce qui couvre un clic dans une iframe). Le focus revient au déclencheur, sauf après un
 *   appui à l'extérieur (le focus va là où l'on a appuyé).
 * - `modal` : Tab et Maj+Tab tournent dans la popup (piège de focus), `aria-modal="true"`. Pour un vrai dialogue
 *   modal, `<dialog>.showModal()` reste préférable (le reste de la page devient inerte) : ce comportement s'y
 *   ajoute alors seulement pour le clic sur le fond (`fermerSurFond`).
 * - ARIA : `role` (défaut `dialog`) et un `id` sur la popup ; `aria-haspopup`, `aria-expanded`, `aria-controls` sur
 *   le déclencheur, mis à jour à chaque ouverture (le déclencheur peut changer d'une fois à l'autre).
 *
 * Ciblage : rien n'écoute tant que la popup est fermée ; ouverte, un `keydown` et un `pointerdown` sur `document`,
 * retirés à la fermeture. Échap traité ne remonte pas aux raccourcis de la page.
 */
import { focalisables, identifiant } from "./commun.ts";

export type Cote = "bas" | "haut" | "droite" | "gauche";
export type Alignement = "debut" | "centre" | "fin";
export type RaisonFermeture = "echap" | "exterieur" | "focus" | "programme" | "fond";

export interface Boite {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OptionsPopup {
  /** Le déclencheur par défaut (aussi passé à `ouvrir`). */
  declencheur?: HTMLElement | null;
  /** Défaut : `"dialog"`. */
  role?: string;
  /** Piège de focus. Défaut : `false`. */
  modal?: boolean;
  /** Défaut : `"bas"`. */
  cote?: Cote;
  /** Défaut : `"debut"`. */
  alignement?: Alignement;
  /** Écart au déclencheur, px. Défaut : 6. */
  decalage?: number;
  /** Écart minimal aux bords de la fenêtre, px. Défaut : 8. */
  marge?: number;
  /** Ne pas positionner (un `<dialog>` centré, une popup posée par la CSS). */
  sansPosition?: boolean;
  /** Défaut : `true`. */
  fermerEchap?: boolean;
  /** Défaut : `true`. */
  fermerExterieur?: boolean;
  /** Défaut : `true` si non modale. */
  fermerSurPerteFocus?: boolean;
  /** Sélecteur (ou sélecteurs essayés dans l'ordre) ou élément qui prend le focus à l'ouverture ; `false` : le focus ne bouge pas. Défaut : le premier focalisable. */
  focusInitial?: string | string[] | HTMLElement | false;
  /** Défaut : `true`. */
  rendreFocus?: boolean;
  surOuverture?: () => void;
  surFermeture?: (raison: RaisonFermeture) => void;
}

export interface Popup {
  ouvrir(declencheur?: HTMLElement | null): void;
  fermer(raison?: RaisonFermeture): void;
  basculer(declencheur?: HTMLElement | null): void;
  ouvert(): boolean;
  /** Replace la popup (après un changement de taille de son contenu). */
  positionner(): void;
  detruire(): void;
}

/* ───────── Logique pure ───────── */

/**
 * La place d'une popup de taille `taille` contre `ancre`, dans une vue `vue` : du `cote` demandé, retournée si elle
 * n'y tient pas et tient de l'autre côté, puis gardée dans la vue à `marge` px des bords.
 */
export function placer(ancre: Boite, taille: { width: number; height: number }, vue: { width: number; height: number }, o: { cote?: Cote; alignement?: Alignement; decalage?: number; marge?: number } = {}): { left: number; top: number; cote: Cote } {
  const d = o.decalage ?? 6;
  const m = o.marge ?? 8;
  const al = o.alignement ?? "debut";
  let cote = o.cote ?? "bas";
  const tient = (c: Cote) =>
    c === "bas" ? ancre.top + ancre.height + d + taille.height <= vue.height - m : c === "haut" ? ancre.top - d - taille.height >= m : c === "droite" ? ancre.left + ancre.width + d + taille.width <= vue.width - m : ancre.left - d - taille.width >= m;
  const oppose: Record<Cote, Cote> = { bas: "haut", haut: "bas", droite: "gauche", gauche: "droite" };
  if (!tient(cote) && tient(oppose[cote])) cote = oppose[cote];
  let left: number;
  let top: number;
  const aligne = (debut: number, longueur: number, l: number) => (al === "debut" ? debut : al === "fin" ? debut + longueur - l : debut + (longueur - l) / 2);
  if (cote === "bas" || cote === "haut") {
    top = cote === "bas" ? ancre.top + ancre.height + d : ancre.top - d - taille.height;
    left = aligne(ancre.left, ancre.width, taille.width);
  } else {
    left = cote === "droite" ? ancre.left + ancre.width + d : ancre.left - d - taille.width;
    top = aligne(ancre.top, ancre.height, taille.height);
  }
  const borne = (x: number, l: number, max: number) => Math.max(m, Math.min(max - m - l, x));
  return { left: Math.round(borne(left, taille.width, vue.width)), top: Math.round(borne(top, taille.height, vue.height)), cote };
}

/** Le rang suivant dans le piège de focus : de la fin au début (Tab), du début à la fin (Maj+Tab) ; `null` : laisser faire. */
export function rangPiege(rang: number, n: number, arriere: boolean): number | null {
  if (n === 0) return -1;
  if (rang < 0) return arriere ? n - 1 : 0;
  if (!arriere && rang === n - 1) return 0;
  if (arriere && rang === 0) return n - 1;
  return null;
}

/* ───────── Comportement ───────── */

export function creerPopup(el: HTMLElement, options: OptionsPopup = {}): Popup {
  const modal = options.modal ?? false;
  const perteFocus = options.fermerSurPerteFocus ?? !modal;
  const estDialog = el instanceof HTMLDialogElement;
  let declencheur: HTMLElement | null = options.declencheur ?? null;
  // Une popup commence fermée (un <dialog> déjà ouvert garde son état).
  let estOuvert = estDialog ? el.open : false;
  if (!el.id) el.id = identifiant("popup");
  if (!estDialog && !el.getAttribute("role")) el.setAttribute("role", options.role ?? "dialog");
  if (modal && !estDialog) el.setAttribute("aria-modal", "true");
  if (!estDialog) el.hidden = true;

  function lierDeclencheur(ouvert: boolean) {
    if (!declencheur) return;
    declencheur.setAttribute("aria-haspopup", el.getAttribute("role") === "menu" ? "menu" : el.getAttribute("role") === "listbox" ? "listbox" : "dialog");
    declencheur.setAttribute("aria-expanded", String(ouvert));
    declencheur.setAttribute("aria-controls", el.id);
  }

  function positionner() {
    if (options.sansPosition || estDialog || !declencheur) return;
    el.style.position = "fixed";
    el.style.margin = "0";
    const r = declencheur.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    const p = placer(r, t, { width: innerWidth, height: innerHeight }, options);
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
    el.dataset.cote = p.cote;
  }

  const dedans = (n: EventTarget | null) => n instanceof Node && (el.contains(n) || !!declencheur?.contains(n));

  const surTouche = (e: KeyboardEvent) => {
    if (!estOuvert || e.defaultPrevented) return;
    if (e.key === "Escape" && options.fermerEchap !== false) {
      // Une popup dans un <dialog> : Échap ferme la popup, pas le dialogue.
      e.preventDefault();
      e.stopPropagation();
      fermer("echap");
    } else if (e.key === "Tab" && modal) {
      const f = focalisables(el);
      const i = f.indexOf(document.activeElement as HTMLElement);
      const r = rangPiege(i, f.length, e.shiftKey);
      if (r === null) return;
      e.preventDefault();
      if (r >= 0) f[r]!.focus();
    }
  };
  const surAppui = (e: PointerEvent) => {
    if (!estOuvert) return;
    if (estDialog && e.target === el) {
      // Le fond d'un <dialog> modal : l'appui tombe sur le dialogue lui-même, hors de sa boîte.
      const r = el.getBoundingClientRect();
      const hors = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (hors && options.fermerExterieur !== false) {
        // Le focus revient au déclencheur : l'appui ne doit pas le reprendre (pas de mousedown qui suive).
        e.preventDefault();
        fermer("fond");
      }
      return;
    }
    if (!dedans(e.target) && options.fermerExterieur !== false) fermer("exterieur");
  };
  const surPerte = () => {
    if (!estOuvert || !perteFocus) return;
    setTimeout(() => {
      if (estOuvert && !dedans(document.activeElement)) fermer("focus");
    }, 0);
  };

  function ouvrir(d?: HTMLElement | null) {
    if (d !== undefined) {
      if (declencheur && declencheur !== d) declencheur.setAttribute("aria-expanded", "false");
      declencheur = d;
    }
    if (estOuvert) return positionner();
    estOuvert = true;
    if (estDialog) {
      if (!(el as HTMLDialogElement).open) modal ? (el as HTMLDialogElement).showModal() : (el as HTMLDialogElement).show();
    } else el.hidden = false;
    positionner();
    lierDeclencheur(true);
    document.addEventListener("keydown", surTouche);
    document.addEventListener("pointerdown", surAppui, true);
    el.addEventListener("focusout", surPerte);
    if (options.focusInitial !== false) {
      const f = options.focusInitial;
      const cible = typeof f === "string" || Array.isArray(f) ? ([f].flat().map((s) => el.querySelector<HTMLElement>(s)).find(Boolean) ?? focalisables(el)[0]) : f instanceof HTMLElement ? f : focalisables(el)[0];
      (cible ?? (el.tabIndex >= 0 ? el : null))?.focus({ preventScroll: true });
    }
    options.surOuverture?.();
  }

  function fermer(raison: RaisonFermeture = "programme") {
    if (!estOuvert) return;
    estOuvert = false;
    document.removeEventListener("keydown", surTouche);
    document.removeEventListener("pointerdown", surAppui, true);
    el.removeEventListener("focusout", surPerte);
    const avaitFocus = el.contains(document.activeElement);
    if (estDialog) (el as HTMLDialogElement).close();
    else el.hidden = true;
    lierDeclencheur(false);
    if (options.rendreFocus !== false && raison !== "exterieur" && raison !== "focus" && (avaitFocus || raison === "echap") && declencheur?.isConnected) declencheur.focus({ preventScroll: true });
    options.surFermeture?.(raison);
  }

  // Un <dialog> fermé par le navigateur (Échap natif, form method="dialog") : l'état suit.
  const surCloseNatif = () => {
    if (!estOuvert) return;
    estOuvert = false;
    document.removeEventListener("keydown", surTouche);
    document.removeEventListener("pointerdown", surAppui, true);
    el.removeEventListener("focusout", surPerte);
    lierDeclencheur(false);
    options.surFermeture?.("programme");
  };
  if (estDialog) el.addEventListener("close", surCloseNatif);
  if (estOuvert) {
    estOuvert = false;
    ouvrir();
  }

  return {
    ouvrir,
    fermer,
    basculer: (d) => (estOuvert && (d === undefined || d === declencheur) ? fermer() : ouvrir(d)),
    ouvert: () => estOuvert,
    positionner,
    detruire() {
      if (estOuvert) fermer();
      if (estDialog) el.removeEventListener("close", surCloseNatif);
    },
  };
}
