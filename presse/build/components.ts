/**
 * Presse — composants, côté construction (feuille de route A2).
 *
 * Une balise <x-nom> dans une page HTML est déroulée en HTML statique à la
 * construction : le navigateur reçoit une page complète, lisible sans
 * JavaScript, avec ses attributs data-gl-* et data-presse-component. Le
 * comportement (WebGPU, glisser, routeur) est chargé ensuite, à la demande,
 * par src/presse/components.ts.
 *
 * Chaque composant est une fonction pure (attributs, enfants) → HTML. Ce qui
 * peut être calculé ici l'est : découpage des titres en lettres, ordre
 * d'apparition, liste d'accès clavier.
 */
import type { HTMLElement as Node } from "node-html-parser";

export type Render = (attrs: Record<string, string>, children: Node[], ctx: { read: (path: string) => string }) => string;

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const imgs = (children: Node[]) => children.flatMap((c) => (c.tagName === "IMG" ? [c] : c.querySelectorAll("img")));
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36).slice(0, 6);
};
/** Dimensions recopiées si l'auteur les a données (sinon la chaîne d'images les pose). */
const dims = (im: Node) => ["width", "height"].map((k) => (im.getAttribute(k) ? ` ${k}="${esc(im.getAttribute(k)!)}"` : "")).join("");
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Titre coupé en lettres, à la construction : chaque lettre a son masque et son rang. */
export function letters(text: string, row = 0) {
  const parts = [...text].map((ch, i) => {
    const c = ch === " " ? "&nbsp;" : esc(ch);
    return `<span class="ltr" aria-hidden="true"><span style="--i:${i}" data-c="${ch === " " ? "\u00a0" : esc(ch)}">${c}</span></span>`;
  });
  return `<span class="sr-only">${esc(text)}</span><span class="ltrs" style="--row-i:${row}">${parts.join("")}</span>`;
}

/**
 * <x-liquide filters="eau:L'eau|terre:La terre">
 *   <img src="…" alt="…" data-cat="eau" data-caption="Le pont">
 * </x-liquide>
 */
const liquide: Render = (a, children) => {
  const items = imgs(children);
  const filters = (a.filters ?? "")
    .split("|")
    .map((f) => f.split(":"))
    .filter((f) => f[0] && f[1]);
  // Nom du groupe de boutons radio : stable d'une construction à l'autre.
  const name = `lq-filter-${hash(items.map((i) => i.getAttribute("src") ?? "").join("|") + (a.filters ?? ""))}`;
  const chips = filters.length
    ? `<fieldset class="lq-chips"><legend class="lq-legend">Filtrer</legend>
        <label><input type="radio" name="${name}" value="tout" checked /> Tout</label>
        ${filters.map(([v, l]) => `<label><input type="radio" name="${name}" value="${esc(v!)}" /> ${esc(l!)}</label>`).join("\n")}
      </fieldset>`
    : "";
  const cards = items
    .map((im) => {
      const cap = im.getAttribute("data-caption") ?? "";
      return `<li class="lq-card" data-cat="${esc(im.getAttribute("data-cat") ?? "")}" tabindex="0"><img class="lq-img" src="${esc(im.getAttribute("src") ?? "")}"${dims(im)} sizes="${esc(a.sizes ?? "(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 340px")}" alt="${esc(im.getAttribute("alt") ?? "")}" />${cap ? `<p class="lq-cap">${esc(cap)}</p>` : ""}</li>`;
    })
    .join("\n");
  return `<div class="x-liquide" data-presse-component="liquide"${a.full !== undefined ? " data-full" : ""}>
  <canvas class="lq-gl" aria-hidden="true"></canvas>
  <div class="lq-tools">
    ${chips}
    <button type="button" class="lq-btn" data-lq-shuffle>Mélanger</button>
    <label class="lq-range"><span>Fusion</span><input type="range" name="fusion" min="0" max="2.5" step="0.05" value="1" /></label>
    <label class="lq-range"><span>Réfraction</span><input type="range" name="refraction" min="0" max="2.5" step="0.05" value="1" /></label>
    <p class="lq-status" data-lq-status role="status"></p>
  </div>
  <ul class="lq-grid" aria-label="${esc(a.label ?? "Photos, réordonnables : glisser, ou Alt + flèches au clavier")}">
${cards}
  </ul>
  <p class="sr-only" aria-live="polite" data-lq-live></p>
</div>`;
};

/**
 * <x-grille label="Photos">
 *   <img src="…" alt="…" data-title="Le pont" data-body="…">
 * </x-grille>
 */
const grille: Render = (a, children) => {
  const items = imgs(children).map((im) => {
    const title = im.getAttribute("data-title") ?? im.getAttribute("alt") ?? "";
    return { id: im.getAttribute("data-id") ?? slug(title), title, body: im.getAttribute("data-body") ?? "", src: im.getAttribute("src") ?? "", alt: im.getAttribute("alt") ?? "" };
  });
  const param = a.param ?? "photo";
  // Plein écran, la page d'une photo est la page : son titre est un h1.
  const hTag = a.full !== undefined ? "h1" : "h2";
  return `<section class="x-grille" data-presse-component="grille" data-param="${esc(param)}"${a.full !== undefined ? " data-full" : ""} tabindex="0" aria-label="${esc(a.label ?? "Mur de photos : flèches pour le parcourir")}">
  <canvas class="gr-gl" aria-hidden="true"></canvas>
  <p class="gr-head">${a.kicker ? `<span class="gr-kicker">${esc(a.kicker)}</span>` : ""}<span class="gr-hint" data-gr-hint>${esc(a.hint ?? (a.full !== undefined ? "Tirez le mur dans tous les sens, ou utilisez les flèches. Cliquez une photo pour l'ouvrir." : "Tirez le mur de côté, ou flèches au clavier. Cliquez une photo pour l'ouvrir."))}</span></p>
  <nav class="gr-index" aria-label="Photos"><ol>
${items.map((p) => `    <li><a href="?${esc(param)}=${esc(p.id)}" data-photo="${esc(p.id)}">${esc(p.title)}</a></li>`).join("\n")}
  </ol></nav>
  <div class="gr-photos" hidden>
${items.map((p) => `    <img src="${esc(p.src)}" data-photo="${esc(p.id)}" data-title="${esc(p.title)}" data-body="${esc(p.body)}" alt="${esc(p.alt)}" loading="lazy" sizes="(max-width: 760px) 100vw, 60vw" />`).join("\n")}
  </div>
  <article class="gr-detail" data-gr-detail hidden>
    <div class="gr-hero" data-gr-hero></div>
    <div class="gr-text">
      <p class="gr-num" data-gr-num></p>
      <${hTag} class="gr-title" data-gr-title></${hTag}>
      <p class="gr-body" data-gr-body></p>
      <p class="gr-alt" data-gr-alt></p>
      <a class="gr-back" href="?" data-gr-back>← ${esc(a.back ?? "Le mur")}</a>
    </div>
  </article>
  <p class="sr-only" aria-live="polite" data-gr-live></p>
</section>`;
};

/**
 * <x-lettres label="Sommaire">
 *   <a href="#un">Premier chapitre</a> …
 * </x-lettres>
 * Pas de JavaScript : les lettres sont découpées ici, le reste est du CSS.
 */
const lettres: Render = (a, children) => {
  const links = children.flatMap((c) => (c.tagName === "A" ? [c] : c.querySelectorAll("a")));
  return `<nav class="x-lettres" aria-label="${esc(a.label ?? "Sommaire")}"><ol>
${links
  .map(
    (l, i) =>
      `  <li><a href="${esc(l.getAttribute("href") ?? "#")}"><span class="xl-num">${String(i + 1).padStart(2, "0")}</span> <span class="xl-title">${letters(l.text.trim(), i)}</span></a></li>`,
  )
  .join("\n")}
</ol></nav>`;
};

/** <x-include src="partials/pied.html" annee="2026"> : fragment HTML, {{attribut}} remplacés, <slot></slot> pour le contenu. */
const include: Render = (a, children, ctx) => {
  let html = ctx.read(a.src ?? "");
  for (const [k, v] of Object.entries(a)) html = html.replaceAll(`{{${k}}}`, esc(v));
  return html.replace("<slot></slot>", children.map((c) => c.toString()).join(""));
};

export const COMPONENTS: Record<string, Render> = { liquide, grille, lettres, include };

/** Feuille de style de chaque composant, ajoutée au <head> des pages qui l'emploient. */
export const STYLES: Record<string, string> = {
  liquide: "/src/components/liquide/liquide.css",
  grille: "/src/components/grille/grille.css",
  lettres: "/src/components/lettres/lettres.css",
};
