/**
 * Export des diaporamas — le HTML autonome : un seul fichier qui rejoue le diaporama, sans serveur ni réseau.
 *
 * Les diapos restent du HTML (texte sélectionnable, lisible par un lecteur d'écran, net à toute taille) ; CSS, images
 * et polices sont dans le fichier (`data:`), un petit lecteur (LECTEUR_JS, sans dépendance) remplace le diaporama :
 *   → Espace Page suiv. Entrée, clic : avancer (étape, puis diapo) ; ← Page préc. Retour arrière : reculer ;
 *   Début / Fin ; F plein écran ; P notes de l'orateur ; B ou . écran noir ; ? aide ; l'adresse garde la diapo (#7).
 * Les apparitions (`data-step`) suivent l'ordre du diaporama, calculé ici une fois pour toutes (`data-appui="n"`) ;
 * les transitions deviennent des fondus (leur durée, plafonnée à 0,8 s ; aucun en mouvement réduit) ; nombres et
 * barres sont posés à leur valeur. Pas de moteur WebGPU : c'est le rendu de repli de Presse, en DOM.
 *
 * Deux temps : `preparerDiapos` (pur : des attributs posés sur un arbre comme le DOM, testé sous Node) et
 * `construireHtmlAutonome` (pur : des chaînes). Le CSS autonome (polices et images en `data:`) est réuni dans la page
 * par src/diapo-export/page.ts, qui seule a les feuilles de style.
 */
import { planSteps } from "../presse/diapo-etapes.ts";
import type { DiaporamaExport, ElementLike } from "./modele.ts";
import { OPTIONS_DEFAUT, type OptionsExport } from "./options.ts";

/** Ce que la préparation modifie : des attributs, et retirer un élément. */
export interface ElementModifiable extends ElementLike {
  setAttribute(nom: string, valeur: string): unknown;
  removeAttribute(nom: string): unknown;
  remove(): unknown;
  querySelectorAll(sel: string): ArrayLike<ElementModifiable> & Iterable<ElementModifiable>;
}

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Prépare une copie de `main[data-diapo]` (images déjà en `data:`) : retire les identifiants du Créateur et les diapos
 * masquées, numérote, pose `data-appui` sur chaque étape et `data-x-dur` (fondu d'entrée, s) sur chaque diapo, fige
 * nombres et barres, remplace pages vivantes et vidéos externes. Rend les avertissements.
 */
export function preparerDiapos(racine: ElementModifiable, modele: DiaporamaExport, options: Partial<OptionsExport> = {}): string[] {
  const o = { ...OPTIONS_DEFAUT, ...options };
  const avert: string[] = [];
  for (const el of racine.querySelectorAll("[data-cid]")) el.removeAttribute("data-cid");
  const toutes = [...racine.querySelectorAll("[data-diapo-slide]")];
  const parIndex = new Map(modele.diapos.map((d) => [d.index, d]));
  const total = String(modele.diapos.length).padStart(2, "0");
  toutes.forEach((el, index) => {
    const d = parIndex.get(index);
    if (!d) {
      el.remove();
      return;
    }
    el.setAttribute("data-num", String(d.numero).padStart(2, "0"));
    el.setAttribute("data-total", total);
    el.setAttribute("role", "group");
    el.setAttribute("aria-roledescription", "diapositive");
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", `${d.numero}. ${d.titre}`);
    el.removeAttribute("data-masquee");
    const dur = !o.transitions || d.transition.nom === "aucune" ? 0 : Math.min(0.8, d.transition.duree);
    el.setAttribute("data-x-dur", String(Math.round(dur * 100) / 100));
    const etapes = [...el.querySelectorAll("[data-step]")];
    const plan = planSteps(etapes.map((e) => ({ ordre: e.getAttribute("data-step-ordre"), depart: e.getAttribute("data-step-depart") })));
    for (const p of plan) etapes[p.index]!.setAttribute("data-appui", String(p.click));
    el.setAttribute("data-appuis", String(d.appuis));
    for (const b of el.querySelectorAll("[data-barre]")) {
      const v = Number(b.getAttribute("data-barre")) || 0;
      const st = (b.getAttribute("style") ?? "").trim();
      b.setAttribute("style", `${st}${st && !st.endsWith(";") ? ";" : ""}--h:${v}`);
    }
    for (const c of el.querySelectorAll("[data-compte]")) {
      const brut = c.getAttribute("data-compte") ?? "0";
      const dec = (brut.split(".")[1] ?? "").length;
      // Le texte du nombre : remplacé par un enfant unique (attribut puis contenu, sans innerHTML).
      c.setAttribute("data-x-valeur", (Number(brut) || 0).toFixed(dec).replace(".", ","));
    }
    for (const f of el.querySelectorAll("iframe[data-diapo-live]")) {
      const titre = f.getAttribute("title") ?? "page vivante";
      f.removeAttribute("src");
      f.removeAttribute("data-src");
      f.setAttribute(
        "srcdoc",
        `<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;height:100vh;background:#efebe1;color:#16110d;font:16px/1.4 system-ui,sans-serif;text-align:center"><p>${echapper(titre)}<br><small>Page vivante : non incluse dans l'export autonome.</small></p>`,
      );
      avert.push(`diapo ${d.numero} : page vivante « ${titre} » remplacée par un cartouche`);
    }
    for (const v of el.querySelectorAll("video")) {
      const src = v.getAttribute("src") ?? "";
      if (src && !src.startsWith("data:")) {
        v.removeAttribute("src");
        avert.push(`diapo ${d.numero} : vidéo non incluse (${src})`);
      }
    }
    for (const s of el.querySelectorAll("source[src]")) if (!(s.getAttribute("src") ?? "").startsWith("data:")) s.remove();
    // Les variantes d'un <picture> (avif, webp) restent dehors : l'<img> en data: suffit.
    for (const s of el.querySelectorAll("picture source")) s.remove();
    for (const i of el.querySelectorAll("img[srcset], source[srcset]")) i.removeAttribute("srcset");
    for (const i of el.querySelectorAll("img[loading]")) i.removeAttribute("loading");
  });
  return avert;
}

/** Les URL qui sortiraient du fichier (ni `data:`, ni ancre, ni `about:`) : vide pour un export autonome. */
export function urlsExternes(html: string): string[] {
  const out = new Set<string>();
  const ok = (u: string) => {
    const t = u.trim().replace(/^['"]|['"]$/g, "");
    return !t || t.startsWith("data:") || t.startsWith("#") || t.startsWith("about:") || t.startsWith("blob:");
  };
  // Le contenu des srcdoc (cartouches) est du texte échappé : hors de portée des attributs ci-dessous.
  const sansScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/\ssrcdoc="[^"]*"/gi, "");
  for (const m of sansScripts.matchAll(/\s(?:src|href|poster|data-src|action|srcset)\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    const u = m[2] ?? m[3] ?? "";
    if (!ok(u)) out.add(u.slice(0, 120));
  }
  for (const m of sansScripts.matchAll(/url\(\s*("([^"]*)"|'([^']*)'|[^)'"]*)\s*\)/gi)) {
    const u = m[2] ?? m[3] ?? m[1] ?? "";
    if (!ok(u)) out.add(u.slice(0, 120));
  }
  for (const m of sansScripts.matchAll(/@import\s+["']([^"']+)["']/gi)) out.add(m[1]!);
  return [...out];
}

/** Le lecteur : du JavaScript sans dépendance (ES2017), écrit tel quel dans le fichier. */
export const LECTEUR_JS = String.raw`(function () {
  var html = document.documentElement;
  var root = document.querySelector("[data-diapo]");
  var slides = Array.prototype.slice.call(document.querySelectorAll("[data-diapo-slide]"));
  var n = slides.length;
  if (!n) return;
  var reduit = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cur = -1, appui = 0;
  Array.prototype.forEach.call(document.querySelectorAll("[data-x-valeur]"), function (c) { c.textContent = c.getAttribute("data-x-valeur"); });
  var bar = document.createElement("div"); bar.className = "diapo-progress"; bar.setAttribute("aria-hidden", "true");
  var noir = document.createElement("div"); noir.className = "diapo-noir"; noir.hidden = true;
  var live = document.createElement("p"); live.className = "diapo-sr"; live.setAttribute("aria-live", "polite");
  var notes = document.createElement("aside"); notes.className = "x-notes"; notes.hidden = true; notes.setAttribute("aria-label", "Notes de l'orateur");
  var aide = document.createElement("div"); aide.className = "diapo-aide"; aide.hidden = true;
  aide.innerHTML = "<h2>Clavier</h2><dl><dt>→ Espace Page suiv. Entrée, clic</dt><dd>avancer</dd><dt>← Page préc. Retour arrière</dt><dd>reculer</dd><dt>Début / Fin</dt><dd>première / dernière diapo</dd><dt>F</dt><dd>plein écran</dd><dt>P</dt><dd>notes de l'orateur</dd><dt>B ou .</dt><dd>écran noir</dd><dt>?</dt><dd>cette aide · Échap la ferme</dd></dl>";
  document.body.append(bar, noir, live, notes, aide);
  function appuisDe(s) { return Number(s.getAttribute("data-appuis")) || 0; }
  function titreDe(s) { return (s.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim(); }
  function poser(s, k) {
    Array.prototype.forEach.call(s.querySelectorAll("[data-appui]"), function (e) {
      e.classList.toggle("x-cache", Number(e.getAttribute("data-appui")) > k);
    });
  }
  function dessinerNotes(s) {
    var ps = [];
    Array.prototype.forEach.call(s.querySelectorAll("[data-notes]"), function (a) {
      var kids = Array.prototype.filter.call(a.children, function (c) { return c.tagName === "P"; });
      var brut = kids.length ? kids.map(function (p) { return p.textContent || ""; }) : (a.textContent || "").split(/\n[ \t]*\n/);
      brut.forEach(function (t) { t = t.replace(/\s+/g, " ").trim(); if (t) ps.push(t); });
    });
    notes.textContent = "";
    var h = document.createElement("h2"); h.textContent = (cur + 1) + " / " + n + " · " + titreDe(s) + (appuisDe(s) ? " · étape " + appui + " / " + appuisDe(s) : "");
    notes.append(h);
    (ps.length ? ps : ["—"]).forEach(function (t) { var p = document.createElement("p"); p.textContent = t; notes.append(p); });
  }
  function aller(i, fin) {
    i = Math.max(0, Math.min(n - 1, i));
    var s = slides[i];
    if (i !== cur) {
      if (cur >= 0) { var a = slides[cur]; a.classList.remove("is-active", "x-entre"); a.setAttribute("aria-hidden", "true"); a.inert = true; }
      var dur = Number(s.getAttribute("data-x-dur")) || 0;
      s.style.setProperty("--x-dur", dur + "s");
      s.classList.remove("x-entre");
      if (dur > 0 && !reduit && cur >= 0) { void s.offsetWidth; s.classList.add("x-entre"); }
      s.classList.add("is-active"); s.removeAttribute("aria-hidden"); s.inert = false;
      cur = i;
      live.textContent = "Diapositive " + (i + 1) + " sur " + n + " : " + titreDe(s);
      bar.style.setProperty("--p", String(n > 1 ? i / (n - 1) : 1));
      if (history.replaceState) history.replaceState(null, "", "#" + (i + 1));
    }
    appui = fin ? appuisDe(s) : 0;
    poser(s, appui);
    dessinerNotes(s);
  }
  function suivant() {
    var s = slides[cur];
    if (appui < appuisDe(s)) { appui++; poser(s, appui); dessinerNotes(s); return; }
    if (cur < n - 1) aller(cur + 1, false);
  }
  function precedent() {
    var s = slides[cur];
    if (appui > 0) { appui--; poser(s, appui); dessinerNotes(s); return; }
    if (cur > 0) aller(cur - 1, true);
  }
  slides.forEach(function (s) { s.setAttribute("aria-hidden", "true"); s.inert = true; });
  addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key, used = true;
    if (!aide.hidden && (k === "Escape" || k === "?")) aide.hidden = true;
    else if (!noir.hidden && (k === "b" || k === "B" || k === "." || k === "Escape")) noir.hidden = true;
    else if (k === "Escape" && !notes.hidden) notes.hidden = true;
    else if ((k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === "Enter" || k === " ") && !(k === " " && e.shiftKey)) suivant();
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace" || (k === " " && e.shiftKey)) precedent();
    else if (k === "Home") aller(0, false);
    else if (k === "End") aller(n - 1, false);
    else if (k === "f" || k === "F") { if (document.fullscreenElement) document.exitFullscreen(); else if (html.requestFullscreen) html.requestFullscreen().catch(function () {}); }
    else if (k === "p" || k === "P" || k === "n" || k === "N") notes.hidden = !notes.hidden;
    else if (k === "b" || k === "B" || k === ".") noir.hidden = false;
    else if (k === "?") aide.hidden = false;
    else used = false;
    if (used) e.preventDefault();
  });
  root.addEventListener("click", function (e) { if (!e.target.closest("a, button, input, textarea, select, video, iframe")) suivant(); });
  addEventListener("hashchange", function () { var h = Number(location.hash.slice(1)); if (h >= 1 && h - 1 !== cur) aller(h - 1, false); });
  var h0 = Number(location.hash.slice(1));
  aller(h0 >= 1 ? h0 - 1 : 0, false);
})();`;

/** Les styles du lecteur (en plus de ceux de la page) : étapes cachées, fondu d'entrée, notes. */
export const LECTEUR_CSS = `
html.diapo-autonome [data-diapo-slide] [data-appui] { transition: opacity 0.45s ease, translate 0.45s ease; }
html.diapo-autonome [data-diapo-slide] [data-appui].x-cache { opacity: 0 !important; visibility: hidden; translate: 0 0.4em; transition: none; }
html.diapo-autonome [data-diapo-slide].x-entre { animation: x-fondu var(--x-dur, 0.6s) ease both; }
@keyframes x-fondu { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  html.diapo-autonome [data-diapo-slide] [data-appui], html.diapo-autonome [data-diapo-slide].x-entre { transition: none; animation: none; }
}
.x-notes { position: fixed !important; z-index: 80 !important; left: 0; right: 0; bottom: 0; max-height: 42vh; overflow: auto; margin: 0; padding: 18px 28px 22px; box-sizing: border-box; background: rgba(22, 17, 13, 0.95); color: #efe6d2; font: 400 18px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
.x-notes h2 { margin: 0 0 8px; font: 500 13px/1.3 ui-monospace, Menlo, monospace; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.75; }
.x-notes p { margin: 0 0 8px; max-width: 75ch; }
@media print {
  html.diapo-autonome, html.diapo-autonome body { height: auto !important; overflow: visible !important; }
  html.diapo-autonome [data-diapo] { position: static !important; }
  html.diapo-autonome [data-diapo-slide] { display: grid !important; position: relative; left: auto; top: auto; translate: none; width: 100vw; height: 56.25vw; break-after: page; }
  html.diapo-autonome [data-appui].x-cache { opacity: 1 !important; visibility: visible; translate: none; }
  .x-notes, .diapo-progress, .diapo-aide, .diapo-noir { display: none !important; }
}
`;

export type EntreeHtml = {
  modele: DiaporamaExport;
  /** `main[data-diapo]` préparé (preparerDiapos), en HTML. */
  diapos: string;
  /** Le CSS de la page, autonome (polices et images en data:). */
  css: string;
  /** Les attributs de <html> (lang, data-presse-*) et la classe de <body>. */
  htmlAttributs?: Readonly<Record<string, string>>;
  bodyClasse?: string;
  /** Une ligne pour le pied de source (« Exporté le … »). */
  note?: string;
};

export function construireHtmlAutonome(e: EntreeHtml): string {
  const attrs: Record<string, string> = { lang: e.modele.langue || "fr", ...e.htmlAttributs };
  const classes = new Set(`${attrs.class ?? ""} diapo-on diapo-autonome`.split(/\s+/).filter(Boolean));
  for (const c of ["diapo-export", "diapo-idle", "diapo-vignette", "gl-on"]) classes.delete(c);
  attrs.class = [...classes].join(" ");
  const htmlAttrs = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${echapper(v)}"`)
    .join("");
  // Une balise </style> ou </script> dans le contenu fermerait l'élément trop tôt.
  const css = e.css.replace(/<\/style/gi, "<\\/style");
  return `<!doctype html>
<!-- ${echapper(e.note ?? "Diaporama Presse, export autonome")} : → avancer, ← reculer, F plein écran, P notes, ? aide. -->
<html${htmlAttrs}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="generator" content="Presse · export de diaporama" />
<title>${echapper(e.modele.titre)}</title>
${e.modele.description ? `<meta name="description" content="${echapper(e.modele.description)}" />\n` : ""}<style>
${css}
</style>
<style>${LECTEUR_CSS}</style>
</head>
<body${e.bodyClasse ? ` class="${echapper(e.bodyClasse)}"` : ""}>
${e.diapos}
<script>${LECTEUR_JS.replace(/<\/script/gi, "<\\/script")}</script>
</body>
</html>
`;
}
