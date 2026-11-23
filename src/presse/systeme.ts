/**
 * Presse — appliquer un système de design (src/presse/variations.ts) à la page courante.
 *
 *   page.html?systeme=<base64url>                 l'adresse porte le système (lien « Appliquer » de variations.html)
 *   <html data-systeme="<base64url ou JSON>">     la page le porte elle-même
 *
 * Ce que ça pose :
 *   - un `<style data-presse-systeme>` : les variables `--presse-*` et, branchés dessus, les noms que les pages
 *     emploient déjà (kit de sections : `--paper`, `--ink`, `--spot`, `--ps-f-display`… ; boutique : `--papier`,
 *     `--encre`, `--rouge`…), sous `:root[data-systeme-actif]` — assez spécifique pour passer devant
 *     `html[data-ps-type=…]` et les surcharges locales d'une section ;
 *   - les attributs de `<html>` : `data-presse-look` (et grain, vignette, appliqués à chaud par src/presse/look.ts),
 *     `data-presse-effects`, `data-presse-transition`, `data-presse-motion`, `data-ps-type`, `data-ps-dark` ;
 *   - les fontes du système, si la page ne les charge pas déjà (fontsource, servies par le site).
 * Les effets et la transition du moteur WebGPU sont lus à son démarrage : posés avant (pages-nav arme ce module tôt),
 * ils comptent ; posés après, ils comptent au chargement suivant. Mouvement réduit : rien de plus à faire, le look et
 * les modules gardent leur repli.
 *
 * Armé par src/pages-nav.ts quand l'adresse a `?systeme=` ou que `<html>` porte `data-systeme`.
 */
import { applyLook } from "./look.ts";
import { attributs, css, decoderSysteme, type Police, type Systeme } from "./variations.ts";

/** Ce dont le module a besoin du document (un faux document suffit pour le tester sous Node). */
export type DocLike = {
  documentElement: { setAttribute(n: string, v: string): void; removeAttribute(n: string): void; getAttribute(n: string): string | null; hasAttribute(n: string): boolean };
  head: { append(n: unknown): void };
  querySelector(sel: string): unknown;
  createElement(tag: string): { textContent: string | null; setAttribute(n: string, v: string): void; remove?(): void };
};
export type Options = {
  doc?: DocLike;
  /** Poser le look (filtre, grain, vignette) à chaud ; faux pour un test. */
  look?: boolean | ((nom: string, o: { grain: number; vignette: number }) => void);
  /** Charger les fontes du système. */
  polices?: boolean;
};

/** Les fontes embarquées, chargées à la demande (Vite en fait des morceaux séparés). */
const CHARGEURS: Record<Police, () => Promise<unknown>[]> = {
  archivo: () => [import("@fontsource-variable/archivo/wdth.css")],
  bodoni: () => [import("@fontsource-variable/bodoni-moda/index.css")],
  cormorant: () => [import("@fontsource/cormorant-garamond/400.css"), import("@fontsource/cormorant-garamond/500.css"), import("@fontsource/cormorant-garamond/700.css")],
  plex: () => [import("@fontsource/ibm-plex-mono/400.css"), import("@fontsource/ibm-plex-mono/500.css"), import("@fontsource/ibm-plex-mono/600.css")],
};
const chargees = new Set<Police>();
export function chargerPolices(s: Systeme) {
  const voulues = new Set<Police>([s.typo.titre, s.typo.texte, "plex"]);
  return Promise.all(
    [...voulues]
      .filter((p) => !chargees.has(p))
      .flatMap((p) => {
        chargees.add(p);
        return CHARGEURS[p]();
      }),
  );
}

/** Les attributs que l'application a remplacés, pour les rendre (retirerSysteme). */
let avant: Record<string, string | null> | null = null;

/** Applique le système à la page (ou au faux document donné) ; rappelé, il remplace le précédent. */
export function appliquerSysteme(s: Systeme, o: Options = {}) {
  const doc = o.doc ?? (document as unknown as DocLike);
  const html = doc.documentElement;
  let style = doc.querySelector("style[data-presse-systeme]") as ReturnType<DocLike["createElement"]> | null;
  if (!style) {
    style = doc.createElement("style");
    style.setAttribute("data-presse-systeme", "");
    doc.head.append(style);
  }
  style.textContent = css(s, { racine: ":root[data-systeme-actif]", commentaires: false });
  const a = attributs(s);
  if (!avant) {
    avant = {};
    for (const k of [...Object.keys(a), "data-ps-dark"]) avant[k] = html.getAttribute(k);
  }
  if (!s.palette.sombre) html.removeAttribute("data-ps-dark");
  for (const [k, v] of Object.entries(a)) html.setAttribute(k, v);
  html.setAttribute("data-systeme-actif", s.nom);
  const look = o.look ?? true;
  if (typeof look === "function") look(s.look.nom, { grain: s.look.grain, vignette: s.look.vignette });
  else if (look) applyLook(s.look.nom, { grain: s.look.grain, vignette: s.look.vignette });
  // Les modules qui mesurent le texte (titre ajusté, rail, derrière…) l'ont fait avec les fontes de la page : une fois
  // celles du système arrivées, un « resize » les fait mesurer de nouveau.
  if (o.polices ?? true)
    void chargerPolices(s)
      .then(() => document.fonts.ready)
      .then(() => dispatchEvent(new Event("resize")));
  return style;
}

/** Retire le système : le style s'en va, les attributs de `<html>` retrouvent leurs valeurs d'avant. */
export function retirerSysteme(o: Options = {}) {
  const doc = o.doc ?? (document as unknown as DocLike);
  const html = doc.documentElement;
  (doc.querySelector("style[data-presse-systeme]") as { remove?(): void } | null)?.remove?.();
  html.removeAttribute("data-systeme-actif");
  if (avant)
    for (const [k, v] of Object.entries(avant)) {
      if (v === null) html.removeAttribute(k);
      else html.setAttribute(k, v);
    }
  avant = null;
  const look = o.look ?? true;
  const nom = html.getAttribute("data-presse-look") ?? "neutre";
  if (typeof look === "function") look(nom, { grain: Number(html.getAttribute("data-presse-grain") ?? NaN), vignette: Number(html.getAttribute("data-presse-vignette") ?? NaN) });
  else if (look) applyLook(nom);
}

/** Le système que la page demande : `?systeme=` d'abord, puis `data-systeme` sur `<html>`. Null s'il n'y en a pas. */
export function systemeDemande(search: string, attribut: string | null): Systeme | null {
  const v = new URLSearchParams(search).get("systeme") ?? attribut;
  if (!v) return null;
  return decoderSysteme(v);
}

/** Lit la demande de la page et l'applique (appelé par pages-nav). Une valeur illisible est dite dans la console. */
export function initSysteme() {
  if (typeof document === "undefined") return null;
  try {
    const s = systemeDemande(location.search, document.documentElement.getAttribute("data-systeme"));
    if (s) appliquerSysteme(s);
    return s;
  } catch (e) {
    console.warn("[presse] système illisible (?systeme= ou data-systeme) :", (e as Error).message);
    return null;
  }
}
