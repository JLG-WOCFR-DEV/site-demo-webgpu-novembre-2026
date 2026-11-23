/**
 * Export des diaporamas — le côté page : `conference.html?export` (et tout diaporama Presse) charge ce module après
 * `mountDiapo` (repli DOM, sans moteur) et expose `window.__presseExport`, que pilotent la ligne de commande
 * (tools/export-diapo.mjs, Playwright) et le menu Exporter du Créateur de diaporama (iframe cachée) :
 *
 *   modele(options)            le modèle neutre (src/diapo-export/modele.ts), lu sur les diapos d'origine ;
 *   aller(index, appuis, …)    pose la diapo `index` (rang dans le document) après `appuis` appuis, figée, et attend
 *                              ses images et ses polices : la capture peut suivre ;
 *   htmlAutonome(options)      le fichier unique (src/diapo-export/html-autonome.ts) : CSS, polices (woff2 en data:,
 *                              sous BUDGET_POLICES, sinon polices du système) et images dedans ;
 *   rasteriser(largeur)        la diapo posée en PNG, dans la page, par un SVG `foreignObject` (le PPTX du Créateur) ;
 *   pptx(options, progres)     le PPTX niveau 1 entièrement dans la page (rasteriser + src/diapo-export/pptx.ts).
 *
 * Le moteur WebGPU n'est pas lancé : la capture d'un canvas WebGPU sans écran (SwiftShader) sort vide, et le rendu
 * DOM est celui de repli de Presse — même mise en page, mêmes polices, sans les effets du GPU (impression, trame,
 * bloom, grain).
 */
import { lireDiaporama, type DiaporamaExport, type ElementLike } from "./modele.ts";
import { lireOptions, hauteurDe, type OptionsExport } from "./options.ts";
import { construireHtmlAutonome, preparerDiapos, urlsExternes, type ElementModifiable } from "./html-autonome.ts";
import { construirePptx, type ImageEtat } from "./pptx.ts";

/** Le délai laissé aux images et polices d'un SVG-image avant de le dessiner (ms). */
const ATTENTE_RASTER = 350;

/** Au-delà, le HTML autonome garde les polices du système (les familles de repli de chaque pile CSS). */
export const BUDGET_POLICES = 3 * 1024 * 1024;

export type ResultatHtml = { html: string; octets: number; polices: "incluses" | "systeme"; octetsPolices: number; avertissements: string[]; externes: string[] };

export type ApiExport = {
  version: 1;
  /** La page a WebGPU (un adaptateur) — l'export ne s'en sert pas, il le dit. */
  webgpu: Promise<boolean>;
  modele(options?: unknown): DiaporamaExport & { corrections: string[] };
  aller(index: number, appuis: number, numero?: number, total?: number): Promise<void>;
  htmlAutonome(options?: unknown): Promise<ResultatHtml>;
  rasteriser(largeur?: number): Promise<Uint8Array>;
  pptx(options?: unknown, progres?: (fait: number, total: number) => void): Promise<{ octets: Uint8Array; diapos: number; avertissements: string[] }>;
};

declare global {
  interface Window {
    __presseExport?: ApiExport;
  }
}

/* ───────── data: ───────── */

const cache = new Map<string, Promise<string | null>>();
function base64(octets: Uint8Array) {
  let s = "";
  for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(s);
}
const TYPES: Record<string, string> = { woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", mp4: "video/mp4" };
/** Une URL en `data:` (null si elle ne se charge pas). Gardée : une image répétée n'est lue qu'une fois. */
export function enData(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return Promise.resolve(url);
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then(async (r) => {
        if (!r.ok) return null;
        const b = new Uint8Array(await r.arrayBuffer());
        const ext = (new URL(url, location.href).pathname.split(".").pop() ?? "").toLowerCase();
        const type = (r.headers.get("content-type") ?? "").split(";")[0]!.trim() || TYPES[ext] || "application/octet-stream";
        return `data:${type === "text/html" ? TYPES[ext] ?? type : type};base64,${base64(b)}`;
      })
      .catch(() => null);
    cache.set(url, p);
  }
  return p;
}

/* ───────── CSS autonome ───────── */

const sansGuillemets = (s: string) => s.trim().replace(/^["']|["']$/g, "");
/** Une plage unicode, normalisée : « U+0000-00FF,U+0131 » (CSS) et « U+0-FF, U+131 » (FontFace) se valent. */
const normPlage = (s: string) =>
  s
    .split(",")
    .map((t) => {
      const m = /U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/i.exec(t.trim());
      if (!m) return "";
      const a = parseInt(m[1]!.replace(/\?/g, "0"), 16);
      const b = m[2] ? parseInt(m[2], 16) : m[1]!.includes("?") ? parseInt(m[1]!.replace(/\?/g, "F"), 16) : a;
      return `${a.toString(16)}-${b.toString(16)}`;
    })
    .filter(Boolean)
    .join(",");

/** Charge les polices dont toutes les diapos ont besoin (même cachées : le style calculé suffit), pour leurs textes. */
async function chargerPolices(racine: Element) {
  const vus = new Map<string, Set<string>>();
  for (const el of racine.querySelectorAll<HTMLElement>("*")) {
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? "").join("");
    const cs = getComputedStyle(el);
    const texte = t.trim() ? t : el.matches("[data-diapo-slide]") ? (cs.getPropertyValue("--titre-courant") || "") + "0123456789 /·" : "";
    if (!texte) continue;
    const spec = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontStretch} 16px ${cs.fontFamily}`;
    const set = vus.get(spec) ?? new Set<string>();
    for (const c of texte) set.add(c);
    vus.set(spec, set);
  }
  await Promise.all([...vus].map(([spec, cars]) => document.fonts.load(spec, [...cars].join("")).catch(() => [])));
}

type Css = { css: string; octetsPolices: number; polices: "incluses" | "systeme"; avertissements: string[] };
let cssPromesse: Promise<Css> | null = null;

/**
 * Toutes les feuilles de la page en un texte : polices réellement chargées en woff2 `data:`, images en `data:`.
 * Le texte SOURCE des feuilles (contenu de <style>, fichier de <link>), pas `cssText` : Chrome sérialise mal une
 * déclaration raccourcie à var() suivie d'une sous-propriété (`font: … var(--display); font-stretch: …` devient des
 * sous-propriétés vides), et la règle tomberait.
 */
function cssAutonome(): Promise<Css> {
  cssPromesse ??= (async () => {
    const racine = document.querySelector("[data-diapo]");
    if (racine) await chargerPolices(racine);
    await document.fonts.ready;
    const avertissements: string[] = [];
    const chargees = [...document.fonts].filter((f) => f.status === "loaded");
    const descripteur = (bloc: string, nom: string) => new RegExp(`(?:^|[;{\\s])${nom}\\s*:\\s*([^;}]+)`, "i").exec(bloc)?.[1]?.trim() ?? "";
    const utile = (bloc: string) => {
      const fam = sansGuillemets(descripteur(bloc, "font-family"));
      const plage = normPlage(descripteur(bloc, "unicode-range") || "U+0-10FFFF");
      const style = descripteur(bloc, "font-style") || "normal";
      return chargees.some((f) => sansGuillemets(f.family) === fam && normPlage(f.unicodeRange) === plage && (f.style || "normal") === style);
    };
    const sources: { texte: string; base: string }[] = [];
    for (const f of document.styleSheets) {
      const noeud = f.ownerNode;
      if (noeud instanceof HTMLStyleElement) sources.push({ texte: noeud.textContent ?? "", base: location.href });
      else if (f.href) {
        const t = await fetch(f.href)
          .then((r) => (r.ok ? r.text() : null))
          .catch(() => null);
        if (t === null) avertissements.push(`feuille illisible : ${f.href}`);
        else sources.push({ texte: t, base: f.href });
      }
    }
    let octetsPolices = 0;
    const faces: string[] = [];
    const sorties: string[] = [];
    for (const src of sources) {
      // Les @import restants (rares : Vite les a déjà résolus) ne voyageraient pas : signalés, retirés.
      let texte = src.texte.replace(/@import\s+[^;]+;/g, (m) => (avertissements.push(`CSS : ${m.trim()} ignoré`), ""));
      // Les polices : seules les faces chargées par la page, leur source woff2 en data:.
      const blocs: string[] = [];
      texte = texte.replace(/@font-face\s*\{[^}]*\}/gi, (b) => (blocs.push(b), ""));
      for (const bloc of blocs) {
        if (!utile(bloc)) continue;
        const decl = descripteur(bloc, "src");
        const urls = [...decl.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)\s*(?:format\(\s*["']?([\w-]+)["']?\s*\))?/gi)].map((m) => ({ url: m[1]!, format: (m[2] ?? "").toLowerCase() }));
        const choix = urls.find((u) => u.format === "woff2" || u.url.split("?")[0]!.endsWith(".woff2")) ?? urls[0];
        if (!choix) continue;
        const d = await enData(new URL(choix.url, src.base).href);
        if (!d) continue;
        octetsPolices += Math.round((d.length - d.indexOf(",") - 1) * 0.75);
        faces.push(bloc.replace(/src\s*:[^;}]+/i, `src: url("${d}") format("${choix.format || "woff2"}")`));
      }
      // Les autres url() (motifs, fonds) en data:, ou retirées si introuvables.
      const urls = [...new Set([...texte.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((m) => m[1]!.trim()))].filter((u) => !u.startsWith("data:") && !u.startsWith("#"));
      for (const u of urls) {
        const d = await enData(new URL(u, src.base).href);
        if (!d) avertissements.push(`CSS : ${u} introuvable, retiré`);
        texte = texte.split(u).join(d ?? "");
      }
      sorties.push(texte.replace(/url\(\s*["']?\s*["']?\s*\)/g, "none").replace(/\/\*# sourceMappingURL=[^*]*\*\//g, ""));
    }
    const garder = octetsPolices <= BUDGET_POLICES;
    if (!garder) avertissements.push(`polices : ${(octetsPolices / 1048576).toFixed(1)} Mo > ${BUDGET_POLICES / 1048576} Mo, polices du système à la place`);
    return { css: `${garder ? faces.join("\n") : ""}\n${sorties.join("\n")}`, octetsPolices, polices: garder ? "incluses" : "systeme", avertissements };
  })();
  return cssPromesse;
}

/** Les images d'un sous-arbre en data: (src, poster, styles en ligne). */
async function imagesEnData(racine: Element, avert: string[]) {
  for (const img of racine.querySelectorAll<HTMLImageElement | HTMLVideoElement | HTMLSourceElement>("img[src], video[poster], source[src]")) {
    const attr = img instanceof HTMLVideoElement ? "poster" : "src";
    const u = img.getAttribute(attr)!;
    if (u.startsWith("data:")) continue;
    if (img instanceof HTMLSourceElement) continue;
    const d = await enData(new URL(u, location.href).href);
    if (d) img.setAttribute(attr, d);
    else avert.push(`image introuvable : ${u}`);
  }
  for (const el of racine.querySelectorAll<HTMLElement>("[style*='url(']")) {
    let st = el.getAttribute("style")!;
    for (const m of st.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      if (m[1]!.startsWith("data:")) continue;
      const d = await enData(new URL(m[1]!, location.href).href);
      st = st.split(m[1]!).join(d ?? "");
    }
    el.setAttribute("style", st);
  }
}

/* ───────── Attendre une diapo ───────── */

const image = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
async function attendreRendu(el: HTMLElement) {
  for (const img of el.querySelectorAll("img")) img.loading = "eager";
  await Promise.all(
    [...el.querySelectorAll("img")].map((img) =>
      img.complete
        ? img.decode().catch(() => {})
        : new Promise<void>((r) => {
            img.addEventListener("load", () => r(), { once: true });
            img.addEventListener("error", () => r(), { once: true });
            setTimeout(r, 8000);
          }),
    ),
  );
  await document.fonts.ready;
  await image();
}

/* ───────── Monter ───────── */

export function monterExport(root: HTMLElement, source: HTMLElement) {
  const html = document.documentElement;
  const toutes = () => [...root.querySelectorAll<HTMLElement>("[data-diapo-slide]")];
  const webgpu = (async () => {
    try {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      return !!(gpu && (await gpu.requestAdapter()));
    } catch {
      return false;
    }
  })();

  const modele = (brut?: unknown) => {
    const { options, corrections } = lireOptions(brut);
    return { ...lireDiaporama(source as unknown as ElementLike, options, html as unknown as ElementLike), corrections };
  };

  const aller = async (index: number, appuis: number, numero?: number, total?: number) => {
    dispatchEvent(new CustomEvent("diapo:etat", { detail: { i: index, step: appuis } }));
    const el = toutes()[index];
    if (!el) throw new Error(`diapo ${index} absente`);
    // La numérotation du modèle (les masquées ne comptent pas, sauf si on les exporte).
    if (numero) el.dataset.num = String(numero).padStart(2, "0");
    if (total) el.dataset.total = String(total).padStart(2, "0");
    await attendreRendu(el);
  };

  const htmlAutonome = async (brut?: unknown): Promise<ResultatHtml> => {
    const { options, corrections } = lireOptions(brut);
    const m = lireDiaporama(source as unknown as ElementLike, options, html as unknown as ElementLike);
    const css = await cssAutonome();
    const copie = source.cloneNode(true) as HTMLElement;
    const avertissements = [...corrections, ...css.avertissements];
    await imagesEnData(copie, avertissements);
    for (const v of copie.querySelectorAll<HTMLVideoElement>("video[src]")) {
      // Une vidéo courte voyage dans le fichier ; au-delà de 4 Mo, elle reste dehors (avertissement de preparerDiapos).
      const u = new URL(v.getAttribute("src")!, location.href).href;
      const taille = Number((await fetch(u, { method: "HEAD" }).catch(() => null))?.headers.get("content-length")) || Infinity;
      if (taille <= 4 * 1048576) {
        const d = await enData(u);
        if (d) v.setAttribute("src", d);
      }
    }
    avertissements.push(...preparerDiapos(copie as unknown as ElementModifiable, m, options));
    const htmlAttributs: Record<string, string> = {};
    for (const a of html.attributes) if (a.name === "lang" || a.name.startsWith("data-presse")) htmlAttributs[a.name] = a.value;
    const texte = construireHtmlAutonome({
      modele: m,
      diapos: copie.outerHTML,
      css: css.css,
      htmlAttributs,
      bodyClasse: document.body.className,
      note: `${m.titre} — exporté de ${location.pathname.split("/").pop()} le ${new Date().toLocaleDateString("fr-FR")}`,
    });
    return { html: texte, octets: new TextEncoder().encode(texte).length, polices: css.polices, octetsPolices: css.octetsPolices, avertissements, externes: urlsExternes(texte) };
  };

  /** La diapo posée → PNG, sans capture d'écran : son HTML et le CSS autonome dans un SVG foreignObject. */
  const canevas = async (largeur: number): Promise<HTMLCanvasElement> => {
    const el = toutes().find((s) => s.classList.contains("is-active"));
    if (!el) throw new Error("aucune diapo posée");
    const hauteur = hauteurDe(largeur);
    const css = await cssAutonome();
    const copie = el.cloneNode(true) as HTMLElement;
    copie.querySelectorAll("[data-notes]").forEach((n) => n.remove());
    // Une image paresseuse ne se charge jamais dans un SVG-image ; les sources d'un <picture> sortiraient du SVG.
    copie.querySelectorAll("picture source").forEach((x) => x.remove());
    copie.querySelectorAll("img").forEach((i) => (i.removeAttribute("loading"), i.removeAttribute("srcset")));
    await imagesEnData(copie, []);
    const doc = document.implementation.createHTMLDocument("");
    const enveloppe = doc.createElement("html");
    enveloppe.setAttribute("class", `${html.className} diapo-on`);
    enveloppe.setAttribute("style", `width:${largeur}px;height:${hauteur}px;overflow:hidden;--u:${largeur / 100}px`);
    const tete = doc.createElement("head");
    const st = doc.createElement("style");
    // Les unités d'écran (vw, vh) d'un SVG en image valent celles de l'image : la diapo garde son cadre.
    st.textContent = `${css.css}\n[data-diapo-slide]{width:${largeur}px!important;height:${hauteur}px!important}`;
    tete.append(st);
    const corps = doc.createElement("body");
    corps.setAttribute("class", document.body.className);
    corps.setAttribute("style", "margin:0");
    const main = doc.createElement("main");
    for (const a of root.attributes) main.setAttribute(a.name, a.value);
    main.append(doc.importNode(copie, true));
    corps.append(main);
    enveloppe.append(tete, corps);
    const xhtml = new XMLSerializer().serializeToString(enveloppe);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
    const img = new Image(largeur, hauteur);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    // Images et polices en data: d'un SVG-image se décodent après lui (une photo de 1 700 px : ~100 ms) : on attend
    // qu'elles soient là avant de dessiner.
    await new Promise((r) => setTimeout(r, ATTENTE_RASTER));
    const c = document.createElement("canvas");
    c.width = largeur;
    c.height = hauteur;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, largeur, hauteur);
    return c;
  };
  const octetsDe = async (c: HTMLCanvasElement, type: "png" | "jpeg") => {
    // toBlob lève (ou rend null) si le canevas est « sali » : le navigateur refuse alors la rastérisation.
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, `image/${type}`, 0.9));
    if (!blob) throw new Error("rastérisation refusée par le navigateur");
    return new Uint8Array(await blob.arrayBuffer());
  };
  const rasteriser = async (largeur = 1920) => octetsDe(await canevas(largeur), "png");

  const pptx = async (brut?: unknown, progres?: (fait: number, total: number) => void) => {
    const { options, corrections } = lireOptions(brut);
    const m = lireDiaporama(source as unknown as ElementLike, options, html as unknown as ElementLike);
    const images: ImageEtat[][] = [];
    let fait = 0;
    for (const d of m.diapos) {
      const ligne: ImageEtat[] = [];
      for (const e of d.etats) {
        await aller(d.index, e.appuis, d.numero, m.diapos.length);
        const c = await canevas(options.largeur);
        let img: ImageEtat = { octets: await octetsDe(c, options.image === "jpeg" ? "jpeg" : "png"), type: options.image === "jpeg" ? "jpeg" : "png" };
        if (options.image === "auto") {
          const jpg = await octetsDe(c, "jpeg");
          if (jpg.length < img.octets.length) img = { octets: jpg, type: "jpeg" };
        }
        ligne.push(img);
        progres?.(++fait, m.nbEtats);
      }
      images.push(ligne);
    }
    const r = construirePptx({ modele: m, images, options: options as Partial<OptionsExport>, application: "Presse · Créateur de diaporama (export navigateur)" });
    return { ...r, avertissements: [...corrections, ...m.avertissements, ...r.avertissements] };
  };

  window.__presseExport = { version: 1, webgpu, modele, aller, htmlAutonome, rasteriser, pptx };
  html.dataset.exportPret = "";
  dispatchEvent(new Event("presse-export:pret"));
}
