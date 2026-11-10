/**
 * Presse — le document d'un diaporama, tel que le Créateur de diaporama (diapo-createur.html) le garde.
 *
 * Le Créateur travaille sur le HTML des diapos (l'intérieur de `[data-diapo]`) et l'enregistre dans ce navigateur ;
 * le diaporama le reprend au chargement (`applySavedDoc`, avant tout le reste). Chaque élément porte un identifiant
 * (`data-cid`) : c'est par lui que le Créateur retrouve, dans l'aperçu, l'élément de son modèle. Les identifiants sont
 * posés dans l'ordre du document : les mêmes des deux côtés tant que le HTML est le même ; ils sont retirés à l'export.
 */
export type SavedDoc = { v: 1; html: string; transition?: string; at: number };
export const docKey = (pathname: string) => `presse-diapo-doc:${pathname}`;

export function readDoc(pathname: string): SavedDoc | null {
  try {
    const d = JSON.parse(localStorage.getItem(docKey(pathname)) ?? "") as SavedDoc;
    return d && d.v === 1 && typeof d.html === "string" ? d : null;
  } catch {
    return null;
  }
}

/** Donne un identifiant à chaque élément qui n'en a pas. */
export function tagIds(root: Element) {
  let max = 0;
  for (const el of root.querySelectorAll("[data-cid]")) max = Math.max(max, Number(el.getAttribute("data-cid")!.slice(1)) || 0);
  for (const el of root.querySelectorAll("*")) if (!el.hasAttribute("data-cid")) el.setAttribute("data-cid", `c${++max}`);
}

/** Au chargement du diaporama : les diapos gardées par le Créateur remplacent celles de la page. */
export function applySavedDoc(root: HTMLElement, pathname = location.pathname) {
  const d = readDoc(pathname);
  if (!d) return false;
  root.innerHTML = d.html;
  if (d.transition) root.dataset.transition = d.transition;
  return true;
}
