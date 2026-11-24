/**
 * Navigation — le méga-menu des pages (ouvert par le bouton `[data-pages-trigger]` ou la pastille « Pages ») : les
 * sept groupes de la taxonomie (src/nav/taxonomie.ts) en onglets, leurs sections en colonnes ; la recherche ouvre la
 * palette de commandes (Ctrl+K / ⌘K, chargée à la demande) ; en pied, le débogage et les réglages de visite
 * (`mountSettings`, inchangés).
 *
 * Accessibilité : panneau `popover` (Échap et clic extérieur ferment, le focus revient au bouton), focus piégé (Tab
 * tourne dans le panneau), onglets à flèches (↑ ↓ sur bureau, ← → sur téléphone, Début / Fin), dans un groupe ↑ ↓
 * d'un lien à l'autre et ← pour revenir aux onglets ; `aria-current="page"` sur la page ouverte ; le contenu des
 * groupes n'est construit qu'à la première ouverture (rien de plus à charger sur la page).
 */
import { construireTaxonomie, type Entree, type GroupeId } from "./taxonomie.ts";

const SVG = (d: string, t = 18) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
export const ICONES_MENU = {
  chercher: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  studio: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M17.5 8h1M17.5 11h1M17.5 14h1"/>',
};

export const CSS_MENU = `
.pages-pop {
  --pn-fond: #f6f1e4; --pn-encre: #16110d; --pn-doux: #5a5047; --pn-filet: rgba(22, 17, 13, 0.16);
  --pn-survol: rgba(127, 127, 127, 0.14); --pn-choisi: rgba(200, 50, 28, 0.1); --pn-accent: #c8321c; --pn-focus: #a12614;
  --pn-ombre: 6px 6px 0 rgba(0, 0, 0, 0.18);
  inset: auto; margin: 0; padding: 0;
  width: min(920px, calc(100vw - 16px));
  border: 1px solid currentColor; border-radius: 8px;
  /* Ses propres couleurs, pas celles de la page : sur une page sombre (Lave), --ink est clair. */
  background: var(--pn-fond); color: var(--pn-encre); box-shadow: var(--pn-ombre);
  font: 15px/1.35 "Archivo Variable", "Archivo", system-ui, sans-serif;
  overflow: hidden; overscroll-behavior: contain;
}
.pages-pop:popover-open { display: flex; flex-direction: column; }
@media (prefers-color-scheme: dark) {
  :root:not([data-presse-theme="clair"]) .pages-pop { --pn-fond: #1d1915; --pn-encre: #efe6d2; --pn-doux: #b9ae9c; --pn-filet: rgba(239, 230, 210, 0.18); --pn-choisi: rgba(255, 122, 92, 0.14); --pn-accent: #ff7a5c; --pn-focus: #ff9a85; --pn-ombre: 0 18px 48px rgba(0, 0, 0, 0.5); color-scheme: dark; }
}
:root[data-presse-theme="sombre"] .pages-pop { --pn-fond: #1d1915; --pn-encre: #efe6d2; --pn-doux: #b9ae9c; --pn-filet: rgba(239, 230, 210, 0.18); --pn-choisi: rgba(255, 122, 92, 0.14); --pn-accent: #ff7a5c; --pn-focus: #ff9a85; --pn-ombre: 0 18px 48px rgba(0, 0, 0, 0.5); color-scheme: dark; }
@media (prefers-reduced-motion: no-preference) {
  .pages-pop:popover-open { animation: pn-entre 0.16s cubic-bezier(0.2, 0, 0, 1); }
  @keyframes pn-entre { from { opacity: 0; translate: 0 -6px; } }
}
html.presse-anim-reduite .pages-pop:popover-open { animation: none; }
.pages-pop :focus-visible { outline: 2px solid var(--pn-focus); outline-offset: 2px; }
.pages-pop ul { list-style: none; margin: 0; padding: 0; }
.pn-tete { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 16px; border-bottom: 1px solid var(--pn-filet); }
.pn-titre { margin: 0 auto 0 0; font-weight: 800; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; }
.pn-chercher, .pn-fermer {
  display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border: 1px solid var(--pn-filet);
  border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer;
}
.pn-chercher { min-width: min(260px, 52vw); justify-content: flex-start; color: var(--pn-doux); }
.pn-chercher kbd { margin-left: auto; font: 500 11px/1 "IBM Plex Mono", ui-monospace, monospace; padding: 4px 6px; border: 1px solid var(--pn-filet); border-radius: 4px; color: var(--pn-encre); }
.pn-fermer { width: 40px; padding: 0; justify-content: center; }
.pn-chercher:hover, .pn-fermer:hover { background: var(--pn-survol); }
.pn-corps { display: grid; grid-template-columns: 196px minmax(0, 1fr); min-height: 0; flex: 1 1 auto; }
.pn-groupes { display: flex; flex-direction: column; gap: 2px; padding: 8px; border-right: 1px solid var(--pn-filet); overflow: auto; }
.pn-groupe {
  display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 10px; border: 0; border-radius: 6px;
  background: transparent; color: inherit; font: 600 15px/1.2 inherit; text-align: left; cursor: pointer;
}
.pn-groupe:hover { background: var(--pn-survol); }
.pn-groupe[aria-selected="true"] { background: var(--pn-choisi); box-shadow: inset 3px 0 0 var(--pn-accent); }
.pn-groupe-n { margin-left: auto; font: 500 11px/1 "IBM Plex Mono", ui-monospace, monospace; color: var(--pn-doux); }
.pn-panneau { padding: 12px 16px 16px; overflow: auto; overscroll-behavior: contain; min-height: 0; }
.pn-panneau[hidden] { display: none; }
.pn-resume { margin: 0 0 10px; color: var(--pn-doux); font-size: 13px; }
.pn-sections { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px 20px; align-items: start; }
/* Un groupe d'une seule section (Studio, Outils…) : ses entrées en colonnes. */
.pn-sections-seul { grid-template-columns: minmax(0, 1fr); }
.pn-sections-seul ul { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 2px 20px; }
.pn-section h3 { margin: 4px 0 4px 10px; font: 700 11px/1.2 "IBM Plex Mono", ui-monospace, monospace; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pn-doux); }
.pn-entree { display: flex; align-items: stretch; gap: 2px; }
.pages-pop a.pn-lien { display: grid; gap: 1px; flex: 1 1 auto; min-width: 0; padding: 7px 10px; border-radius: 6px; color: inherit; text-decoration: none; }
.pages-pop a.pn-lien:hover { background: var(--pn-survol); }
.pages-pop a.pn-lien[aria-current="page"] { box-shadow: inset 3px 0 0 var(--pn-accent); background: var(--pn-choisi); }
.pages-pop .pages-name { font-weight: 700; font-size: 15px; }
.pages-pop .pages-text { font-size: 13px; color: var(--pn-doux); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pages-pop a.pn-studio { display: inline-grid; place-items: center; flex: 0 0 36px; border-radius: 6px; color: var(--pn-doux); }
.pages-pop a.pn-studio:hover { background: var(--pn-survol); color: var(--pn-encre); }
.pn-pied { display: flex; flex-wrap: wrap; align-items: stretch; gap: 4px 8px; padding: 6px 8px; border-top: 1px solid var(--pn-filet); }
.pages-pop .pages-debug {
  display: grid; gap: 2px; padding: 8px 10px; border: 0; border-radius: 6px; background: transparent; color: inherit;
  font: inherit; text-align: left; cursor: pointer; flex: 0 1 220px; min-height: 44px;
}
.pages-pop .pages-debug:hover { background: var(--pn-survol); }
.pages-pop .pn-pied .pages-settings { margin: 0; padding: 0; border: 0; flex: 1 1 360px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.pages-pop .pages-switch .pages-text { -webkit-line-clamp: 2; }
@media (max-width: 719px) {
  .pages-pop { width: calc(100vw - 16px); }
  .pn-corps { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .pn-groupes { flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--pn-filet); scrollbar-width: thin; }
  .pn-groupe { flex: 0 0 auto; white-space: nowrap; }
  .pn-groupe[aria-selected="true"] { box-shadow: inset 0 -3px 0 var(--pn-accent); }
  .pn-groupe-n { display: none; }
  .pn-chercher { min-width: 0; flex: 1 1 auto; }
  .pn-titre { display: none; }
  .pn-sections, .pn-sections-seul ul { grid-template-columns: minmax(0, 1fr); }
  /* Sur téléphone, tout le panneau défile (en-tête et groupes collés en haut) : la liste garde la hauteur. */
  .pages-pop:popover-open { display: block; overflow: auto; }
  .pn-tete { position: sticky; top: 0; z-index: 2; background: var(--pn-fond); }
  .pn-corps { display: block; }
  .pn-groupes { position: sticky; top: 57px; z-index: 1; background: var(--pn-fond); }
  .pn-panneau { overflow: visible; }
}
`;

const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type OptionsMenu = {
  pop: HTMLElement;
  trigger: HTMLElement;
  base: string;
  /** Raccourci affiché sur le bouton de recherche (« Ctrl K », « ⌘ K »). */
  raccourci: string;
  ouvrirPalette: (declencheur: HTMLElement) => void;
};

/** Construit le menu dans `pop` (le pied — débogage, réglages — est posé par l'appelant, dans `.pn-pied`). */
export function monterMenu(o: OptionsMenu): { pied: HTMLElement } {
  const { pop, trigger, base } = o;
  pop.innerHTML = `<div class="pn-tete">
  <p class="pn-titre" id="pn-titre">Pages</p>
  <button type="button" class="pn-chercher" aria-keyshortcuts="${o.raccourci.startsWith("⌘") ? "Meta+K" : "Control+K"}">${SVG(ICONES_MENU.chercher)}<span>Rechercher</span><kbd>${echap(o.raccourci)}</kbd></button>
  <button type="button" class="pn-fermer" aria-label="Fermer le menu" title="Fermer (Échap)">${SVG(ICONES_MENU.fermer)}</button>
</div>
<div class="pn-corps"></div>
<div class="pn-pied"></div>`;
  const corps = pop.querySelector<HTMLElement>(".pn-corps")!;
  const pied = pop.querySelector<HTMLElement>(".pn-pied")!;
  pop.querySelector(".pn-fermer")!.addEventListener("click", () => pop.hidePopover());
  pop.querySelector(".pn-chercher")!.addEventListener("click", () => {
    pop.hidePopover();
    o.ouvrirPalette(trigger);
  });

  const etroit = matchMedia("(max-width: 719px)");
  let construit = false;
  let onglets: HTMLButtonElement[] = [];
  const here = new URL(location.pathname.endsWith("/") ? "index.html" : "", location.href).href.split("#")[0]!.split("?")[0];

  // Une seule entrée porte aria-current : la page elle-même, sinon le premier effet qui y mène.
  let courantPose = false;
  let pageIciId = "";
  const lien = (e: Entree) => {
    const a = document.createElement("a");
    a.className = "pn-lien";
    a.href = base + e.href;
    if (!courantPose && a.href === here && (!pageIciId || e.id === pageIciId)) {
      a.setAttribute("aria-current", "page");
      courantPose = true;
    }
    a.innerHTML = `<span class="pages-name">${echap(e.nom)}</span><span class="pages-text">${echap(e.texte)}</span>`;
    return a;
  };

  function construire() {
    construit = true;
    const t = construireTaxonomie();
    const ici = (e: Entree) => new URL(base + e.href, location.href).href === here;
    const courant = (t.find((g) => g.sections.some((s) => s.entrees.some((e) => e.id.startsWith("page:") && ici(e)))) ?? t.find((g) => g.sections.some((s) => s.entrees.some(ici))))?.id ?? "studio";
    // La page elle-même d'abord (pas un effet du même exemple, dans un autre groupe).
    const pageIci = t.flatMap((g) => g.sections.flatMap((s) => s.entrees)).find((e) => e.id.startsWith("page:") && ici(e));
    pageIciId = pageIci?.id ?? "";
    corps.innerHTML = `<div class="pn-groupes" role="tablist" aria-label="Groupes de pages"></div>`;
    const liste = corps.firstElementChild as HTMLElement;
    for (const g of t) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pn-groupe";
      b.id = `pn-o-${g.id}`;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", `pn-p-${g.id}`);
      const n = g.sections.reduce((k, s) => k + s.entrees.length, 0);
      b.innerHTML = `<span>${echap(g.nom)}</span><span class="pn-groupe-n" aria-hidden="true">${n}</span>`;
      b.dataset.groupe = g.id;
      liste.append(b);
      const p = document.createElement("div");
      p.className = "pn-panneau";
      p.id = `pn-p-${g.id}`;
      p.setAttribute("role", "tabpanel");
      p.setAttribute("aria-labelledby", b.id);
      const seul = g.sections.filter((x) => x.entrees.length).length === 1;
      p.innerHTML = `<p class="pn-resume">${echap(g.resume)}</p><div class="pn-sections${seul ? " pn-sections-seul" : ""}"></div>`;
      const box = p.querySelector(".pn-sections")!;
      for (const s of g.sections) {
        if (!s.entrees.length) continue;
        const sec = document.createElement("section");
        sec.className = "pn-section";
        const hid = `pn-s-${s.id.replace(/[^a-z0-9-]/gi, "-")}`;
        sec.innerHTML = g.sections.length > 1 ? `<h3 id="${hid}">${echap(s.nom)}</h3><ul aria-labelledby="${hid}"></ul>` : `<ul aria-label="${echap(g.nom)}"></ul>`;
        const ul = sec.querySelector("ul")!;
        for (const e of s.entrees) {
          const li = document.createElement("li");
          li.className = "pn-entree";
          li.append(lien(e));
          if (e.studio) {
            const st = document.createElement("a");
            st.className = "pn-studio";
            st.href = base + e.studio;
            st.setAttribute("aria-label", `Ouvrir ${e.nom} dans le Studio`);
            st.title = `Ouvrir ${e.nom} dans le Studio`;
            st.tabIndex = -1;
            st.innerHTML = SVG(ICONES_MENU.studio);
            li.append(st);
          }
          ul.append(li);
        }
        box.append(sec);
      }
      corps.append(p);
    }
    onglets = [...liste.querySelectorAll<HTMLButtonElement>(".pn-groupe")];
    choisir(courant as GroupeId, false);
    orienter();
    liste.addEventListener("click", (ev) => {
      const b = (ev.target as Element).closest<HTMLButtonElement>(".pn-groupe");
      if (b) choisir(b.dataset.groupe as GroupeId, true);
    });
  }
  const orienter = () => corps.querySelector(".pn-groupes")?.setAttribute("aria-orientation", etroit.matches ? "horizontal" : "vertical");
  etroit.addEventListener("change", orienter);

  function choisir(id: GroupeId, focus: boolean) {
    for (const b of onglets) {
      const oui = b.dataset.groupe === id;
      b.setAttribute("aria-selected", String(oui));
      b.tabIndex = oui ? 0 : -1;
      pop.querySelector<HTMLElement>(`#pn-p-${b.dataset.groupe}`)!.hidden = !oui;
      if (oui && focus) {
        b.focus();
        b.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
  }
  const ongletChoisi = () => onglets.find((b) => b.getAttribute("aria-selected") === "true") ?? onglets[0]!;
  const panneauChoisi = () => pop.querySelector<HTMLElement>(`#pn-p-${ongletChoisi().dataset.groupe}`)!;
  const liensDu = (p: HTMLElement) => [...p.querySelectorAll<HTMLAnchorElement>("a.pn-lien")];

  pop.addEventListener("keydown", (ev) => {
    const cible = ev.target as HTMLElement;
    // Focus piégé : Tab tourne dans le panneau.
    if (ev.key === "Tab") {
      const f = [...pop.querySelectorAll<HTMLElement>('button:not([disabled]):not([hidden]), a[href], [tabindex="0"]')].filter((x) => x.offsetParent !== null && x.tabIndex >= 0);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (ev.shiftKey && i <= 0) (ev.preventDefault(), f[f.length - 1]!.focus());
      else if (!ev.shiftKey && i === f.length - 1) (ev.preventDefault(), f[0]!.focus());
      return;
    }
    const horizontal = etroit.matches;
    if (cible.classList.contains("pn-groupe")) {
      const i = onglets.indexOf(cible as HTMLButtonElement);
      const avant = horizontal ? "ArrowLeft" : "ArrowUp";
      const apres = horizontal ? "ArrowRight" : "ArrowDown";
      let j = -1;
      if (ev.key === apres) j = (i + 1) % onglets.length;
      else if (ev.key === avant) j = (i - 1 + onglets.length) % onglets.length;
      else if (ev.key === "Home") j = 0;
      else if (ev.key === "End") j = onglets.length - 1;
      else if ((ev.key === "ArrowRight" && !horizontal) || (ev.key === "ArrowDown" && horizontal)) {
        ev.preventDefault();
        liensDu(panneauChoisi())[0]?.focus();
        return;
      }
      if (j >= 0) {
        ev.preventDefault();
        choisir(onglets[j]!.dataset.groupe as GroupeId, true);
      }
      return;
    }
    if (cible.classList.contains("pn-lien")) {
      const l = liensDu(panneauChoisi());
      const i = l.indexOf(cible as HTMLAnchorElement);
      let j = -1;
      if (ev.key === "ArrowDown") j = Math.min(l.length - 1, i + 1);
      else if (ev.key === "ArrowUp") {
        if (i === 0 && horizontal) return void (ev.preventDefault(), ongletChoisi().focus());
        j = Math.max(0, i - 1);
      } else if (ev.key === "Home") j = 0;
      else if (ev.key === "End") j = l.length - 1;
      else if (ev.key === "ArrowLeft" && !horizontal) return void (ev.preventDefault(), ongletChoisi().focus());
      if (j >= 0) {
        ev.preventDefault();
        l[j]!.focus();
      }
    }
  });

  const placer = () => {
    const r = trigger.getBoundingClientRect();
    const large = Math.min(920, innerWidth - 16);
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - large - 8))}px`;
    pop.style.top = `${r.bottom + 8}px`;
    pop.style.maxHeight = `${Math.max(240, innerHeight - r.bottom - 20)}px`;
  };
  pop.addEventListener("beforetoggle", (e) => {
    if ((e as ToggleEvent).newState !== "open") return;
    if (!construit) construire();
    placer();
  });
  pop.addEventListener("toggle", (e) => {
    const ouvert = (e as ToggleEvent).newState === "open";
    trigger.setAttribute("aria-expanded", String(ouvert));
    if (!ouvert) return;
    if (!construit) construire();
    placer();
    // Le focus va au groupe choisi (le lecteur d'écran annonce « Studio, onglet 1 sur 7 »).
    ongletChoisi()?.focus();
  });
  return { pied };
}

