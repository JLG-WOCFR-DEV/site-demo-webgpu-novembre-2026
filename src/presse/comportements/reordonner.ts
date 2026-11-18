/**
 * Réordonner — trier une liste au pointeur (souris, stylet, doigt) et au clavier, avec des annonces en français.
 *
 *   const r = creerReordonner(liste, {
 *     elements: "[data-layer]",
 *     cle: (el) => el.dataset.layer!,
 *     nom: (el) => el.querySelector("b")!.textContent!,
 *     surOrdre: (de, vers) => { deplacer(de, vers); redessiner(); },
 *   });
 *   r.detruire();
 *
 * Pointeur : on appuie, on tire au-delà de `seuil` px (un clic reste un clic), l'élément suit le pointeur et les autres
 * s'écartent (`translate`, rien d'autre n'est touché) ; au lâcher, `surOrdre(de, vers, "pointeur")`. Au doigt, un appui
 * long (`appuiLong` ms) prend l'élément, sinon le doigt fait défiler la liste. Échap pendant le glisser l'annule.
 * Les cibles `ignorer` (boutons, champs) ne lancent pas de glisser.
 *
 * Clavier, sur l'élément focalisé :
 * - Alt + ↑/↓ (← → en horizontal) : un cran, tout de suite ;
 * - Espace : prendre ; flèches, Début, Fin : déplacer ; Espace ou Entrée : poser ; Échap ou Tab : annuler.
 *   Tant qu'un élément est pris, les autres touches sont gardées (elles ne remontent pas aux raccourcis de la page).
 *
 * L'appli possède l'ordre : `surOrdre` l'applique (en redessinant ou avec `deplacerElement`). Pendant la prise au
 * clavier, l'élément est déplacé dans le DOM pour qu'on le voie bouger, puis remis en place avant `surOrdre`.
 * Après `surOrdre`, l'élément de même `cle` reprend le focus. Chaque étape est dite dans une région aria-live posée
 * après le conteneur ; une consigne cachée est reliée au conteneur par `aria-describedby`.
 *
 * État visible : `data-reordonner="glisse"` (au pointeur) ou `"pris"` (au clavier) sur l'élément.
 * Ciblage : écouteurs sur le conteneur (clavier en capture, pour passer avant le focus itinérant) ; pendant un
 * glisser seulement, `pointermove`/`pointerup` sur le conteneur (capture du pointeur) et `keydown` Échap sur `document`.
 */
import { ajouterId, annonceur, cleParDefaut, elementsDe, mouvementReduit, retrouver, texteCache } from "./commun.ts";

export type RaisonOrdre = "pointeur" | "clavier";

export interface MessageReordonner {
  type: "pris" | "deplace" | "pose" | "annule" | "cran";
  nom: string;
  /** Rang d'arrivée, à partir de 1. */
  position: number;
  total: number;
}

export interface OptionsReordonner {
  /** Les éléments, relatifs au conteneur. Défaut : `:scope > *`. */
  elements?: string;
  /** Défaut : `"vertical"`. */
  orientation?: "vertical" | "horizontal";
  /** Applique le nouvel ordre ; `false` le refuse. */
  surOrdre: (de: number, vers: number, raison: RaisonOrdre) => void | boolean;
  /** Identité d'un élément (pour retrouver le focus après rendu). Défaut : `data-cle`, `id`, premier `data-*`. */
  cle?: (el: HTMLElement) => string;
  /** Nom dit aux lecteurs d'écran. Défaut : le texte de l'élément, court. */
  nom?: (el: HTMLElement) => string;
  /** Poignée : seul ce sélecteur lance le glisser. Défaut : tout l'élément. */
  poignee?: string;
  /** Ce qui ne lance jamais le glisser. Défaut : boutons, liens, champs. */
  ignorer?: string;
  /** Distance avant que le glisser commence, en px. Défaut : 4. */
  seuil?: number;
  /** Au doigt : durée de l'appui qui prend l'élément, en ms. Défaut : 280. */
  appuiLong?: number;
  /** Alt + flèches. Défaut : `true`. */
  alt?: boolean;
  /** Espace pour prendre et poser. Défaut : `true`. */
  saisie?: boolean;
  /** Un élément qu'on ne peut pas prendre (il s'écarte quand même). */
  desactive?: (el: HTMLElement) => boolean;
  /** Les phrases dites. Défaut : `messageReordonner` (français). */
  message?: (m: MessageReordonner) => string;
  /** La consigne cachée. `""` : aucune. */
  consigne?: string;
}

export interface Reordonner {
  detruire(): void;
  /** Annule une prise ou un glisser en cours. */
  annuler(): void;
  /** L'élément pris ou glissé, s'il y en a un. */
  enCours(): HTMLElement | null;
}

/* ───────── Logique pure ───────── */

/** Le tableau avec l'élément `de` placé au rang `vers` (copie). */
export function deplace<T>(liste: readonly T[], de: number, vers: number): T[] {
  const r = liste.slice();
  if (de < 0 || de >= r.length) return r;
  const [x] = r.splice(de, 1);
  r.splice(Math.max(0, Math.min(r.length, vers)), 0, x!);
  return r;
}

/**
 * Le rang d'arrivée de l'élément `de` dont le centre est à `centre`, d'après les milieux des éléments à leur place
 * d'origine : autant de rangs que d'autres éléments dont le milieu est passé.
 */
export function rangCible(milieux: readonly number[], de: number, centre: number): number {
  let r = 0;
  for (let i = 0; i < milieux.length; i++) if (i !== de && milieux[i]! < centre) r++;
  return r;
}

/** Le décalage de l'élément `i` quand `de` va en `vers` : `-pas`, `+pas` ou 0 (les autres s'écartent). */
export function decalage(i: number, de: number, vers: number, pas: number): number {
  if (i === de) return 0;
  if (de < vers && i > de && i <= vers) return -pas;
  if (de > vers && i >= vers && i < de) return pas;
  return 0;
}

/** Le rang après une touche pendant une prise, ou `null` si la touche ne déplace pas. */
export function rangApresTouche(touche: string, rang: number, total: number, orientation: "vertical" | "horizontal"): number | null {
  const moins = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
  const plus = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
  if (touche === moins) return Math.max(0, rang - 1);
  if (touche === plus) return Math.min(total - 1, rang + 1);
  if (touche === "Home") return 0;
  if (touche === "End") return total - 1;
  return null;
}

/** Les phrases dites, en français. */
export function messageReordonner({ type, nom, position, total }: MessageReordonner): string {
  const ou = `position ${position} sur ${total}`;
  switch (type) {
    case "pris":
      return `${nom} pris, ${ou}. Flèches pour déplacer, Espace pour poser, Échap pour annuler.`;
    case "deplace":
      return `${nom}, ${ou}.`;
    case "pose":
      return `${nom} posé en ${ou}.`;
    case "cran":
      return `${nom} déplacé en ${ou}.`;
    case "annule":
      return `Déplacement annulé. ${nom} reste en ${ou}.`;
  }
}

/** Déplace l'élément `de` au rang `vers` parmi `elements` (pour une appli qui ne redessine pas). */
export function deplacerElement(elements: readonly HTMLElement[], de: number, vers: number) {
  const el = elements[de];
  if (!el || de === vers) return;
  const autres = elements.filter((x) => x !== el);
  const ref = autres[vers];
  if (ref) ref.before(el);
  else autres.at(-1)?.after(el);
}

/* ───────── Comportement ───────── */

const IGNORER = "button, a[href], input, select, textarea, label, [contenteditable]";
const CONSIGNE = "Pour déplacer un élément : Alt et flèches, ou Espace pour le prendre, flèches, puis Espace pour le poser.";

export function creerReordonner(conteneur: HTMLElement, options: OptionsReordonner): Reordonner {
  const sel = options.elements ?? ":scope > *";
  const vertical = (options.orientation ?? "vertical") === "vertical";
  const cle = options.cle ?? cleParDefaut;
  const nom = options.nom ?? ((el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || "Élément");
  const message = options.message ?? messageReordonner;
  const seuil = options.seuil ?? 4;
  const ignorer = options.ignorer ?? IGNORER;
  const desactive = options.desactive ?? (() => false);
  const liste = () => elementsDe(conteneur, sel);
  const voix = annonceur(conteneur);
  const consigne = options.consigne === "" ? null : texteCache(voix.el, options.consigne ?? CONSIGNE);
  const delier = consigne ? ajouterId(conteneur, "aria-describedby", consigne.id) : () => {};

  /** Applique l'ordre, puis rend le focus à l'élément (redessiné ou non). */
  function valider(el: HTMLElement, de: number, vers: number, raison: RaisonOrdre, type: "pose" | "cran") {
    const k = cle(el);
    const nomEl = nom(el);
    const total = liste().length;
    const focus = conteneur.contains(document.activeElement) || raison === "clavier";
    const ok = de === vers ? true : options.surOrdre(de, vers, raison) !== false;
    const fin = ok ? vers : de;
    voix.dire(message({ type, nom: nomEl, position: fin + 1, total }));
    if (!focus) return;
    const remettre = () => {
      const ici = el.isConnected ? el : retrouver(conteneur, sel, cle, k);
      if (ici && document.activeElement !== ici) ici.focus({ preventScroll: false });
      return !!ici;
    };
    if (!remettre()) requestAnimationFrame(remettre);
  }

  /* — Clavier — */

  let pris: { el: HTMLElement; de: number; rang: number; suivant: Node | null } | null = null;

  function lacherPris(annule: boolean) {
    if (!pris) return;
    const { el, de, rang, suivant } = pris;
    pris = null;
    el.removeAttribute("data-reordonner");
    // L'élément revient à sa place : c'est à l'appli d'appliquer l'ordre.
    if (el.parentNode) el.parentNode.insertBefore(el, suivant && suivant.parentNode === el.parentNode ? suivant : null);
    if (annule) {
      voix.dire(message({ type: "annule", nom: nom(el), position: de + 1, total: liste().length }));
      el.focus();
      return;
    }
    valider(el, de, rang, "clavier", "pose");
  }

  const surTouche = (e: KeyboardEvent) => {
    if (glisse) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finGlisser(true);
      }
      return;
    }
    const els = liste();
    if (pris) {
      e.stopPropagation();
      if (e.key === "Tab") return lacherPris(true);
      e.preventDefault();
      if (e.key === "Escape") return lacherPris(true);
      if (e.key === " " || e.key === "Enter") return lacherPris(false);
      const r = rangApresTouche(e.key, pris.rang, els.length, vertical ? "vertical" : "horizontal");
      if (r === null || r === pris.rang) return;
      const autres = els.filter((x) => x !== pris!.el);
      const ref = autres[r];
      if (ref) ref.before(pris.el);
      else autres.at(-1)?.after(pris.el);
      pris.rang = r;
      pris.el.focus();
      voix.dire(message({ type: "deplace", nom: nom(pris.el), position: r + 1, total: els.length }));
      return;
    }
    const el = els.find((x) => x === e.target);
    if (!el || desactive(el)) return; // une touche dans un bouton de l'élément reste au bouton
    const de = els.indexOf(el);
    if (options.alt !== false && e.altKey && !e.ctrlKey && !e.metaKey) {
      const r = rangApresTouche(e.key, de, els.length, vertical ? "vertical" : "horizontal");
      if (r === null || e.key === "Home" || e.key === "End") return;
      e.preventDefault();
      e.stopPropagation();
      if (r !== de) valider(el, de, r, "clavier", "cran");
      return;
    }
    if (options.saisie !== false && e.key === " " && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      pris = { el, de, rang: de, suivant: el.nextSibling };
      el.setAttribute("data-reordonner", "pris");
      voix.dire(message({ type: "pris", nom: nom(el), position: de + 1, total: els.length }));
    }
  };
  const surPerte = (e: FocusEvent) => {
    if (pris && e.target === pris.el && !conteneur.contains(e.relatedTarget as Node) && e.relatedTarget) lacherPris(true);
  };

  /* — Pointeur — */

  let depart: { el: HTMLElement; de: number; x: number; y: number; id: number; type: string; t: number } | null = null;
  let glisse: { el: HTMLElement; de: number; vers: number; milieux: number[]; pas: number; els: HTMLElement[]; centre0: number; position: string } | null = null;
  let minuterie = 0;
  let avaleClic = false;

  function commencer(p: { clientX: number; clientY: number }) {
    if (!depart) return;
    const els = liste();
    const rects = els.map((x) => x.getBoundingClientRect());
    const milieux = rects.map((r) => (vertical ? r.top + r.height / 2 : r.left + r.width / 2));
    const r0 = rects[depart.de]!;
    const voisin = rects[depart.de + 1] ?? rects[depart.de - 1];
    const taille = vertical ? r0.height : r0.width;
    const ecart = voisin ? Math.max(0, vertical ? Math.abs(voisin.top - r0.top) - r0.height : Math.abs(voisin.left - r0.left) - r0.width) : 0;
    glisse = { el: depart.el, de: depart.de, vers: depart.de, milieux, pas: taille + ecart, els, centre0: milieux[depart.de]!, position: depart.el.style.position };
    try {
      conteneur.setPointerCapture(depart.id);
    } catch {
      /* pointeur déjà relâché */
    }
    depart.el.setAttribute("data-reordonner", "glisse");
    if (getComputedStyle(depart.el).position === "static") depart.el.style.position = "relative";
    depart.el.style.zIndex = "2";
    const anim = mouvementReduit() ? "" : "translate 0.16s cubic-bezier(0.2, 0.8, 0.2, 1)";
    for (const x of els) if (x !== depart.el) x.style.transition = anim;
    document.addEventListener("keydown", surTouche, true);
    suivre(p);
  }

  function suivre(p: { clientX: number; clientY: number }) {
    if (!glisse || !depart) return;
    const d = vertical ? p.clientY - depart.y : p.clientX - depart.x;
    glisse.el.style.translate = vertical ? `0 ${d}px` : `${d}px 0`;
    const vers = rangCible(glisse.milieux, glisse.de, glisse.centre0 + d);
    if (vers === glisse.vers) return;
    glisse.vers = vers;
    glisse.els.forEach((x, i) => {
      if (x === glisse!.el) return;
      const o = decalage(i, glisse!.de, vers, glisse!.pas);
      x.style.translate = o ? (vertical ? `0 ${o}px` : `${o}px 0`) : "";
    });
    voix.dire(message({ type: "deplace", nom: nom(glisse.el), position: vers + 1, total: glisse.els.length }));
  }

  function finGlisser(annule: boolean) {
    clearTimeout(minuterie);
    const g = glisse;
    glisse = null;
    const id = depart?.id;
    depart = null;
    document.removeEventListener("keydown", surTouche, true);
    if (!g) return;
    if (id !== undefined && conteneur.hasPointerCapture?.(id)) conteneur.releasePointerCapture(id);
    for (const x of g.els) {
      x.style.translate = "";
      x.style.transition = "";
    }
    g.el.style.zIndex = "";
    g.el.style.position = g.position;
    g.el.removeAttribute("data-reordonner");
    avaleClic = true;
    setTimeout(() => (avaleClic = false), 0);
    if (annule) voix.dire(message({ type: "annule", nom: nom(g.el), position: g.de + 1, total: g.els.length }));
    else valider(g.el, g.de, g.vers, "pointeur", "pose");
  }

  const surAppui = (e: PointerEvent) => {
    if (e.button !== 0 || pris || glisse) return;
    const t = e.target as HTMLElement;
    const els = liste();
    const el = els.find((x) => x.contains(t));
    if (!el || desactive(el)) return;
    if (options.poignee ? !t.closest(options.poignee) : t.closest(ignorer) && t.closest(ignorer) !== el) return;
    depart = { el, de: els.indexOf(el), x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, t: performance.now() };
    if (e.pointerType === "touch") {
      const p = { clientX: e.clientX, clientY: e.clientY };
      minuterie = window.setTimeout(() => depart && commencer(p), options.appuiLong ?? 280);
    }
  };
  const surMouvement = (e: PointerEvent) => {
    if (!depart || e.pointerId !== depart.id) return;
    if (glisse) return suivre(e);
    const loin = Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > seuil;
    if (!loin) return;
    if (depart.type === "touch") {
      // Le doigt a bougé avant l'appui long : c'est un défilement.
      clearTimeout(minuterie);
      depart = null;
      return;
    }
    commencer(e);
  };
  const surLacher = (e: PointerEvent) => {
    if (!depart || e.pointerId !== depart.id) return;
    if (glisse) finGlisser(e.type === "pointercancel");
    else {
      clearTimeout(minuterie);
      depart = null;
    }
  };
  // Au doigt, une fois l'élément pris, la liste ne défile plus.
  const surToucheMove = (e: TouchEvent) => {
    if (glisse) e.preventDefault();
  };
  const surClic = (e: MouseEvent) => {
    if (!avaleClic) return;
    avaleClic = false;
    e.preventDefault();
    e.stopPropagation();
  };
  // Le glisser natif (HTML5) des images et des liens gênerait le nôtre.
  const surDragstart = (e: DragEvent) => {
    if (depart || glisse) e.preventDefault();
  };

  conteneur.addEventListener("keydown", surTouche, true);
  conteneur.addEventListener("focusout", surPerte);
  conteneur.addEventListener("pointerdown", surAppui);
  conteneur.addEventListener("pointermove", surMouvement);
  conteneur.addEventListener("pointerup", surLacher);
  conteneur.addEventListener("pointercancel", surLacher);
  conteneur.addEventListener("touchmove", surToucheMove, { passive: false });
  conteneur.addEventListener("click", surClic, true);
  conteneur.addEventListener("dragstart", surDragstart);

  return {
    detruire() {
      if (glisse) finGlisser(true);
      if (pris) lacherPris(true);
      conteneur.removeEventListener("keydown", surTouche, true);
      conteneur.removeEventListener("focusout", surPerte);
      conteneur.removeEventListener("pointerdown", surAppui);
      conteneur.removeEventListener("pointermove", surMouvement);
      conteneur.removeEventListener("pointerup", surLacher);
      conteneur.removeEventListener("pointercancel", surLacher);
      conteneur.removeEventListener("touchmove", surToucheMove);
      conteneur.removeEventListener("click", surClic, true);
      conteneur.removeEventListener("dragstart", surDragstart);
      delier();
      consigne?.remove();
      voix.detruire();
    },
    annuler() {
      if (glisse) finGlisser(true);
      if (pris) lacherPris(true);
    },
    enCours: () => glisse?.el ?? pris?.el ?? null,
  };
}
