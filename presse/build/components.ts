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
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
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
 * Liens vers la même photo sur d'autres pages : pages="Le mur=./grille.html|La galerie=./galerie.html"
 * (ou, pour un seul lien, page="./grille.html" page-label="…"). La photo y passe (src/presse/flight.ts).
 */
const pages = (a: Record<string, string>, label: string): [string, string][] => {
  const out: [string, string][] = a.page ? [[a["page-label"] ?? label, a.page]] : [];
  for (const p of (a.pages ?? "").split("|")) {
    const i = p.indexOf("=");
    if (i > 0) out.push([p.slice(0, i).trim(), p.slice(i + 1).trim()]);
  }
  return out;
};

/**
 * <x-liquide filters="eau:L'eau|terre:La terre" link="./grille.html?photo={id}">
 *   <img src="…" alt="…" data-cat="eau" data-caption="Le pont" data-id="pont">
 *
 * Avec link et data-id, la légende devient un lien et la photo vole jusqu'à
 * la page visée (src/presse/flight.ts).
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
      const id = im.getAttribute("data-id");
      const href = id && a.link ? a.link.replace("{id}", encodeURIComponent(id)) : "";
      const capHtml = cap ? (href ? `<a class="lq-cap" href="${esc(href)}" data-flight="${esc(id!)}" data-flight-title="${esc(id!)}">${esc(cap)}</a>` : `<p class="lq-cap">${esc(cap)}</p>`) : "";
      return `<li class="lq-card" data-cat="${esc(im.getAttribute("data-cat") ?? "")}"${id ? ` data-flight-id="${esc(id)}"` : ""} tabindex="0"><img class="lq-img" src="${esc(im.getAttribute("src") ?? "")}"${dims(im)} sizes="${esc(a.sizes ?? "(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 340px")}" alt="${esc(im.getAttribute("alt") ?? "")}" />${capHtml}</li>`;
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
 * <x-grille label="Photos" view="grille|canevas" canvas="false" drop="false" page="./grille.html">
 *
 * page : sur la page d'une photo, un lien vers la même photo sur une autre
 * page (le mur entier) ; l'image y vole (src/presse/flight.ts).
 *   <img src="…" alt="…" data-title="Le pont" data-body="…">
 * </x-grille>
 */
const grille: Render = (a, children) => {
  const items = imgs(children).map((im) => {
    const title = im.getAttribute("data-title") ?? im.getAttribute("alt") ?? "";
    return { id: im.getAttribute("data-id") ?? slug(title), title, body: im.getAttribute("data-body") ?? "", src: im.getAttribute("src") ?? "", alt: im.getAttribute("alt") ?? "", aspect: im.getAttribute("data-aspect") ?? "" };
  });
  const param = a.param ?? "photo";
  // Plein écran, la page d'une photo est la page : son titre est un h1.
  const hTag = a.full !== undefined ? "h1" : "h2";
  // Vue de départ : le mur infini, ou le canevas (les photos posées en piles).
  const view = a.view === "canevas" ? "canevas" : "grille";
  return `<section class="x-grille" data-presse-component="grille" data-param="${esc(param)}" data-view="${view}"${a.variety !== undefined ? ` data-variety="${esc(a.variety)}"` : ""}${a.full !== undefined ? " data-full" : ""} tabindex="0" aria-label="${esc(a.label ?? "Mur de photos : flèches pour le parcourir")}">
  <canvas class="gr-gl" aria-hidden="true"></canvas>
  <p class="gr-head">${a.kicker ? `<span class="gr-kicker">${esc(a.kicker)}</span>` : ""}<span class="gr-hint" data-gr-hint>${esc(a.hint ?? (a.full !== undefined ? "Tirez le mur, pincez pour zoomer. Cliquez une photo pour l'ouvrir." : "Tirez le mur de côté. Cliquez une photo pour l'ouvrir."))}</span><span class="gr-tools"><span class="gr-zoom"><button type="button" data-gr-zoom="-1" aria-label="Dézoomer">−</button><button type="button" data-gr-zoom="1" aria-label="Zoomer">+</button></span>${a.canvas === "false" ? "" : `<span class="gr-views" role="group" aria-label="Vue"><button type="button" data-gr-view="grille" aria-pressed="${view === "grille"}">Grille</button><button type="button" data-gr-view="canevas" aria-pressed="${view === "canevas"}">Canevas</button></span><button type="button" class="gr-tidy" data-gr-tidy>Ranger</button>`}${a.drop === "false" ? "" : `<label class="gr-add">Ajouter<span class="gr-long"> des photos</span><input type="file" accept="image/*" multiple data-gr-add /></label>`}</span>${grilleKeys(a.full !== undefined, a.canvas !== "false")}</p>
  <div class="gr-drop" aria-hidden="true"><span>Déposez vos photos sur le mur</span></div>
  <nav class="gr-index" aria-label="Photos"><ol>
${items.map((p) => `    <li><a href="?${esc(param)}=${esc(p.id)}" data-photo="${esc(p.id)}">${esc(p.title)}</a></li>`).join("\n")}
  </ol></nav>
  <div class="gr-photos" hidden>
${items.map((p) => `    <img src="${esc(p.src)}" data-photo="${esc(p.id)}" data-title="${esc(p.title)}" data-body="${esc(p.body)}"${p.aspect ? ` data-aspect="${esc(p.aspect)}"` : ""} alt="${esc(p.alt)}" loading="lazy" sizes="(max-width: 760px) 100vw, 60vw" />`).join("\n")}
  </div>
  <article class="gr-detail" data-gr-detail hidden>
    <div class="gr-hero" data-gr-hero></div>
    <div class="gr-text">
      <p class="gr-num" data-gr-num></p>
      <${hTag} class="gr-title" data-gr-title></${hTag}>
      <p class="gr-body" data-gr-body></p>
      <p class="gr-alt" data-gr-alt></p>
      <p class="gr-actions"><a class="gr-back" href="?" data-gr-back>← ${esc(a.back ?? "Le mur")}</a>${pages(a, "Sur le mur entier").map(([l, u]) => `<a class="gr-wide" href="${esc(u)}" data-gr-wide data-page="${esc(u)}">${esc(l)} ↗</a>`).join("")}<button type="button" class="gr-remove" data-gr-remove hidden>Retirer du mur</button></p>
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

/**
 * <x-galerie arrange="barrel" options="rotateX:-8" selection="detail" tilt="1">
 *   <img src="…" alt="…" data-title="Le pont" data-cat="eau">
 * </x-galerie>
 * Tous les attributs passent tels quels en data-* (voir src/components/galerie).
 * La fiche de chaque image (panneau révélé) est remplie ici avec de vraies
 * données de la chaîne d'images : dimensions, poids, couleurs dominantes.
 */
const GX_ATTRS = ["arrange", "options", "axis", "gap", "item", "loop", "snap", "tilt", "ripple", "follow", "drift", "selection", "detail-fit", "presence", "filter", "perspective", "shadow", "friction", "drag-sensitivity", "wheel-sensitivity", "backdrop", "backdrop-size", "backdrop-blur", "preset"];
let manifestCache: Record<string, { w: number; h: number; widths: number[]; base: string; palette?: string[] }> | null = null;
const manifest = () => {
  if (manifestCache) return manifestCache;
  try {
    manifestCache = JSON.parse(readFileSync(resolve(process.cwd(), "public/img/manifest.json"), "utf8"));
  } catch {
    manifestCache = {};
  }
  return manifestCache!;
};
const kb = (f: string) => {
  try {
    return `${Math.round(statSync(resolve(process.cwd(), "public", f)).size / 1024)} Ko`;
  } catch {
    return "";
  }
};
const galerie: Render = (a, children) => {
  const items = imgs(children);
  // Liens de la photo ouverte vers d'autres pages ; param : la photo ouverte dans l'adresse (?photo=pont).
  const links = pages(a, "Sur le mur").map(([l, u]) => `<a class="gx-page" href="${esc(u)}" data-gx-page data-page="${esc(u)}">${esc(l)} ↗</a>`).join("");
  const data = (a.param ? ` data-param="${esc(a.param)}"` : "") + GX_ATTRS.filter((k) => a[k] !== undefined).map((k) => ` data-${k}="${esc(a[k] === "" ? "true" : a[k]!)}"`).join("");
  const li = items
    .map((im, i) => {
      const src = (im.getAttribute("src") ?? "").replace(/^\.?\//, "");
      const title = im.getAttribute("data-title") ?? im.getAttribute("alt") ?? "";
      const cat = im.getAttribute("data-cat") ?? "";
      const m = manifest()[src];
      // Fiche : ce que l'auteur donne, sinon les données réelles du fichier.
      const spec =
        im.getAttribute("data-spec") ??
        [
          `Planche=${String(i + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`,
          cat ? `Catégorie=${cat}` : "",
          m ? `Original=${m.w} × ${m.h} px` : "",
          m ? `AVIF ${m.widths.at(-1)} px=${kb(`${m.base}-${m.widths.at(-1)}.avif`)}` : "",
          m ? `WebP ${m.widths.at(-1)} px=${kb(`${m.base}-${m.widths.at(-1)}.webp`)}` : "",
          m?.palette ? `Couleurs=${m.palette.join(" ")}` : "",
        ]
          .filter(Boolean)
          .join("|");
      const id = im.getAttribute("data-id") ?? slug(title);
      return `    <li class="gx-item" data-id="${esc(id)}" data-title="${esc(title)}" data-cat="${esc(cat)}" data-spec="${esc(spec)}"><button type="button" class="gx-btn" aria-label="${esc(title)}"><img src="${esc(im.getAttribute("src") ?? "")}"${dims(im)} alt="${esc(im.getAttribute("alt") ?? "")}" loading="lazy" sizes="(max-width: 760px) 60vw, 320px" /><span class="gx-cap" aria-hidden="true">${esc(title)}</span></button></li>`;
    })
    .join("\n");
  return `<section class="x-galerie" data-presse-component="galerie"${data}${a.full !== undefined ? " data-full" : ""} tabindex="0" aria-roledescription="galerie" aria-label="${esc(a.label ?? "Galerie : flèches pour parcourir, Entrée pour ouvrir")}">
  <canvas class="gx-gl" aria-hidden="true"></canvas>
  <ol class="gx-list" aria-label="${esc(a.label ?? "Photos")}">
${li}
  </ol>
  <div class="gx-detail" data-gx-detail hidden>
    <div class="gx-detail-frame"><div class="gx-detail-media"></div></div>
    <p class="gx-detail-cap"></p>
    <p class="gx-actions">${links}<button type="button" class="gx-close">Fermer</button></p>
  </div>
  <div class="gx-strip" data-gx-strip hidden></div>
  <aside class="gx-reveal" data-gx-reveal hidden aria-label="Fiche">
    <h3 class="gx-reveal-title" data-gx-reveal-title></h3>
    <dl></dl>
    <p class="gx-actions">${links}<button type="button" class="gx-close">Fermer</button></p>
  </aside>
  <p class="gx-zoom" data-gx-zoom><button type="button" data-gx-zoom-step="-1" aria-label="Dézoomer">−</button><button type="button" class="gx-zoom-val" data-gx-zoom-reset aria-label="Taille d'origine (0)"><span data-gx-zoom-val>100 %</span></button><button type="button" data-gx-zoom-step="1" aria-label="Zoomer">+</button><span class="gx-zoom-keys" aria-hidden="true"><kbd data-gx-mod>Ctrl</kbd>+<kbd>molette</kbd><kbd>+</kbd><kbd>−</kbd><kbd>0</kbd></span></p>
  <p class="sr-only" aria-live="polite" data-gx-live></p>
</section>`;
};

/**
 * <x-orbite full particles="42000" aperture="34" label="…">
 *   <a href="./liquide.html" data-id="liquide" data-title="Liquide" data-tag="…" data-color="#4aa3ff"><img src="…" alt="…"></a>
 *   …
 * </x-orbite>
 *
 * Un lanceur : chaque lien est une application, une carte de l'anneau 3D.
 * Sans WebGPU, la liste des liens est le lanceur.
 */
const OR_ATTRS = ["particles", "aperture", "radius", "exposure"];
/** La légende des raccourcis de la grille (cachée au doigt : rien à y apprendre). */
const grilleKeys = (full: boolean, canvas: boolean) => {
  const k = (...keys: string[]) => keys.map((x) => `<kbd>${x}</kbd>`).join("");
  const item = (keys: string, what: string, only = "") => `<span class="gr-key"${only ? ` data-gr-only="${only}"` : ""}>${keys}<span class="gr-key-what">${what}</span></span>`;
  return `<span class="gr-keys" aria-label="Raccourcis">${[
    item(`<kbd data-gr-mod>Ctrl</kbd>+${k("molette")}`, "zoomer sous le pointeur"),
    item(k("+", "−"), "zoomer"),
    item(k("0"), canvas ? `<span data-gr-only="grille">taille d'origine</span><span data-gr-only="canevas">tout voir</span>` : "taille d'origine"),
    item(full ? k("molette") : `${k("Maj")}+${k("molette")}`, "déplacer"),
    item(k("←", "↑", "→", "↓"), canvas ? `<span data-gr-only="grille">lancer le mur</span><span data-gr-only="canevas">lancer la table</span>` : "lancer le mur"),
    item(k("Échap"), "fermer la photo"),
  ].join("")}</span>`;
};

const orbite: Render = (a, children) => {
  const links = children.flatMap((c) => (c.tagName === "A" ? [c] : c.querySelectorAll("a")));
  const items = links.map((l) => {
    const im = l.querySelector("img");
    const title = l.getAttribute("data-title") ?? im?.getAttribute("alt") ?? "";
    return { id: l.getAttribute("data-id") ?? slug(title), title, tag: l.getAttribute("data-tag") ?? "", color: l.getAttribute("data-color") ?? "", href: l.getAttribute("href") ?? "#", src: im?.getAttribute("src") ?? "", alt: im?.getAttribute("alt") ?? "" };
  });
  const data = OR_ATTRS.filter((k) => a[k] !== undefined).map((k) => ` data-${k}="${esc(a[k]!)}"`).join("");
  const first = items[0];
  const hTag = a.full !== undefined ? "h1" : "h2";
  return `<section class="x-orbite" data-presse-component="orbite"${data}${a.full !== undefined ? " data-full" : ""} tabindex="0" aria-roledescription="carrousel" aria-label="${esc(a.label ?? "Applications : flèches pour tourner, Entrée pour ouvrir")}">
  <canvas class="or-gl" aria-hidden="true"></canvas>
  <ol class="or-list" aria-label="Applications">
${items.map((it) => `    <li class="or-item" data-id="${esc(it.id)}" data-title="${esc(it.title)}" data-tag="${esc(it.tag)}"${it.color ? ` data-color="${esc(it.color)}"` : ""}><a href="${esc(it.href)}" data-flight="${esc(it.id)}"><img src="${esc(it.src)}" alt="${esc(it.alt)}" loading="lazy" sizes="(max-width: 760px) 90vw, 50vw" /><span class="or-name">${esc(it.title)}</span><span class="or-tagline">${esc(it.tag)}</span></a></li>`).join("\n")}
  </ol>
  <div class="or-caption">
    ${a.kicker ? `<p class="or-kicker" data-intro>${esc(a.kicker)}</p>` : ""}
    <p class="or-num" data-intro data-or-num>01 / ${String(items.length).padStart(2, "0")}</p>
    <${hTag} class="or-title" data-intro data-or-title>${esc(first?.title ?? "")}</${hTag}>
    <p class="or-tag" data-intro data-or-tag>${esc(first?.tag ?? "")}</p>
    <a class="or-open" data-intro data-magnet="0.25" data-or-open href="${esc(first?.href ?? "#")}" data-flight="${esc(first?.id ?? "")}">${esc(a.open ?? "Entrer")} <span aria-hidden="true">↗</span></a>
  </div>
  <div class="or-nav" data-intro><button type="button" data-magnet="0.35" data-or-prev aria-label="Application précédente">←</button><button type="button" data-magnet="0.35" data-or-next aria-label="Application suivante">→</button></div>
  <p class="or-hint" aria-hidden="true">${esc(a.hint ?? "Glissez pour tourner autour du trou noir, ou ← →. La carte au point s’ouvre d’un clic.")}</p>
  <p class="sr-only" aria-live="polite" data-or-live></p>
</section>`;
};

/**
 * <x-objet style="verre" model="texte:UBS" label="Les lettres UBS en verre">
 * Styles : ascii, tramage, encre, verre, particules, liquide. Modèle : texte:…,
 * noeud, galet, vase, ou l'URL d'un GLB, d'un SVG, d'une image.
 */
const OB_ATTRS = ["style", "model", "cell", "amount", "frost", "spin"];
const objet: Render = (a) => {
  const data = OB_ATTRS.filter((k) => a[k] !== undefined).map((k) => ` data-${k}="${esc(a[k]!)}"`).join("");
  const label = a.label ?? "Objet en 3D : glisser pour le tourner, flèches au clavier ; déposez un fichier GLB, SVG ou une image pour le remplacer";
  return `<figure class="x-objet" data-presse-component="objet"${data}${a.full !== undefined ? " data-full" : ""} tabindex="0" role="img" aria-label="${esc(label)}">
  <canvas class="ob-gl" aria-hidden="true"></canvas>
  <figcaption class="ob-status" data-ob-status aria-live="polite">${esc(a.caption ?? "")}</figcaption>
</figure>`;
};

export const COMPONENTS: Record<string, Render> = { liquide, grille, lettres, include, galerie, objet, orbite };

/** Feuille de style de chaque composant, ajoutée au <head> des pages qui l'emploient. */
export const STYLES: Record<string, string> = {
  liquide: "/src/components/liquide/liquide.css",
  grille: "/src/components/grille/grille.css",
  lettres: "/src/components/lettres/lettres.css",
  galerie: "/src/components/galerie/galerie.css",
  objet: "/src/components/objet/objet.css",
  orbite: "/src/components/orbite/orbite.css",
};
