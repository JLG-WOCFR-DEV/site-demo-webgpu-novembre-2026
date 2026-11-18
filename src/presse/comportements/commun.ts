/**
 * Comportements — outils communs, sans DOM au chargement du module (les tests les importent sous Node).
 *
 * - `retrouver` : l'élément d'une clé, après que l'appli a redessiné sa liste (innerHTML) ;
 * - `annonceur` : une région aria-live discrète, posée à côté du conteneur et retirée à la destruction ;
 * - `mouvementReduit` : la préférence du système, lue à chaque appel ;
 * - `FOCALISABLES` : le sélecteur des éléments qui prennent le focus au clavier.
 */

export const FOCALISABLES =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';

/** Les éléments focalisables d'un conteneur, dans l'ordre du document, sans ceux qui sont cachés ou inertes. */
export function focalisables(racine: ParentNode): HTMLElement[] {
  return [...racine.querySelectorAll<HTMLElement>(FOCALISABLES)].filter((el) => !el.closest("[hidden], [inert]") && el.getClientRects().length > 0);
}

export const mouvementReduit = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Les éléments d'un conteneur qui répondent au sélecteur (`:scope > *` : les enfants directs). */
export const elementsDe = (conteneur: HTMLElement, selecteur: string) => [...conteneur.querySelectorAll<HTMLElement>(selecteur)];

/** L'élément de clé `k` dans le conteneur, ou `null`. */
export function retrouver(conteneur: HTMLElement, selecteur: string, cle: (el: HTMLElement) => string, k: string): HTMLElement | null {
  return elementsDe(conteneur, selecteur).find((el) => cle(el) === k) ?? null;
}

/** La clé par défaut : `data-cle`, `id`, puis `data-*` le plus parlant, sinon le rang. */
export function cleParDefaut(el: HTMLElement): string {
  if (el.dataset.cle) return el.dataset.cle;
  if (el.id) return el.id;
  const ds = Object.values(el.dataset);
  if (ds[0]) return ds[0];
  return String(el.parentElement ? [...el.parentElement.children].indexOf(el) : 0);
}

let compteur = 0;
/** Un identifiant unique pour la page (aria-controls, aria-describedby). */
export const identifiant = (prefixe: string) => `${prefixe}-${(++compteur).toString(36)}`;

const CACHE = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0";

/** Un texte caché à l'œil, lu par les lecteurs d'écran (consigne, région vivante). */
export function texteCache(apres: Element, texte = "", vivant: "polite" | "assertive" | null = null): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("style", CACHE);
  el.id = identifiant("comportement");
  if (vivant) {
    el.setAttribute("aria-live", vivant);
    el.setAttribute("aria-atomic", "true");
  }
  el.textContent = texte;
  apres.after(el);
  return el;
}

/** Une région aria-live : `dire(m)` remplace le message (vidée d'abord, pour que la même phrase soit relue). */
export function annonceur(apres: Element) {
  const el = texteCache(apres, "", "assertive");
  let t = 0;
  return {
    el,
    dire(m: string) {
      el.textContent = "";
      clearTimeout(t);
      t = window.setTimeout(() => (el.textContent = m), 30);
    },
    detruire() {
      clearTimeout(t);
      el.remove();
    },
  };
}

/** Ajoute un identifiant à un attribut de liste (aria-describedby), et rend la fonction qui l'enlève. */
export function ajouterId(el: Element, attr: string, id: string): () => void {
  const avant = el.getAttribute(attr);
  el.setAttribute(attr, [avant, id].filter(Boolean).join(" "));
  return () => {
    const reste = (el.getAttribute(attr) ?? "").split(/\s+/).filter((x) => x && x !== id);
    if (reste.length) el.setAttribute(attr, reste.join(" "));
    else el.removeAttribute(attr);
  };
}
