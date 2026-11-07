/**
 * Carnet — l'édition d'une ligne (roadmap P2) : un vrai <textarea>, visible pendant l'édition.
 *
 * Le clavier du téléphone (suggestions, correction, dictée, composition, sélection) ne fonctionne
 * pleinement que dans un champ natif ; le texte imprimé par Presse est masqué le temps de l'édition.
 * Chaque changement part au core comme une opération sur Y.Text, en offsets UTF-16 (ceux du DOM) :
 * jamais « remplacer toute la chaîne », pour que deux appareils qui éditent la même ligne fusionnent.
 */

/**
 * Le plus petit remplacement qui change `old` en `now`, en unités UTF-16, sans couper une paire de
 * substitution (un emoji reste entier). `null` si rien n'a changé.
 */
export function utf16Splice(old: string, now: string): { start: number; del: number; ins: string } | null {
  if (old === now) return null;
  let p = 0;
  const max = Math.min(old.length, now.length);
  while (p < max && old.charCodeAt(p) === now.charCodeAt(p)) p++;
  // Ne pas finir le préfixe au milieu d'une paire.
  if (p > 0 && isHigh(old.charCodeAt(p - 1))) p--;
  let s = 0;
  while (s < old.length - p && s < now.length - p && old.charCodeAt(old.length - 1 - s) === now.charCodeAt(now.length - 1 - s)) s++;
  // Ni commencer le suffixe au milieu d'une paire.
  if (s > 0 && isLow(old.charCodeAt(old.length - s))) s--;
  return { start: p, del: old.length - p - s, ins: now.slice(p, now.length - s) };
}
const isHigh = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLow = (c: number) => c >= 0xdc00 && c <= 0xdfff;

export type EditorHooks = {
  /** Une opération sur le texte de l'entrée. */
  splice: (start: number, del: number, ins: string) => void;
  /** Fin de l'édition ; `text` est le texte final (vide : l'entrée est à supprimer). */
  done: (text: string) => void;
};

/** Ouvre l'éditeur sur un texte imprimé (`.cn-text`). Rend la fonction qui le ferme. */
export function openEditor(span: HTMLElement, text: string, hooks: EditorHooks): () => void {
  const ta = document.createElement("textarea");
  ta.className = "cn-edit";
  ta.rows = 1;
  ta.value = text;
  ta.spellcheck = true;
  ta.enterKeyHint = "done";
  ta.setAttribute("aria-label", "Modifier l’entrée");
  // Le champ est peint par le navigateur : Presse ne le relit pas.
  ta.dataset.glIgnore = "";
  let prev = text;
  let composing = false;
  let closed = false;

  const fit = () => {
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  };
  const sync = () => {
    if (ta.value.includes("\n")) {
      // Une ligne de carnet tient sur une ligne : un retour collé devient une espace.
      const at = ta.selectionStart;
      ta.value = ta.value.replace(/\r?\n/g, " ");
      ta.setSelectionRange(at, at);
    }
    const d = utf16Splice(prev, ta.value);
    if (d) hooks.splice(d.start, d.del, d.ins);
    prev = ta.value;
    fit();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    sync();
    // Espaces de bord retirées à la sortie, par les mêmes opérations.
    const final = prev.trim();
    if (final && final !== prev) {
      const d = utf16Splice(prev, final)!;
      hooks.splice(d.start, d.del, d.ins);
    }
    ta.remove();
    span.hidden = false;
    hooks.done(final);
  };

  ta.addEventListener("compositionstart", () => (composing = true));
  ta.addEventListener("compositionend", () => {
    composing = false;
    sync();
  });
  ta.addEventListener("input", (ev) => {
    // Pendant une composition (accents, clavier asiatique), on attend le mot fini.
    if (composing || (ev as InputEvent).isComposing) return fit();
    sync();
  });
  ta.addEventListener("keydown", (ev) => {
    if (ev.isComposing || composing) return;
    if (ev.key === "Enter" || ev.key === "Escape") {
      ev.preventDefault();
      close();
    }
  });
  ta.addEventListener("blur", close);

  span.hidden = true;
  span.after(ta);
  fit();
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(ta.value.length, ta.value.length);
  return close;
}
