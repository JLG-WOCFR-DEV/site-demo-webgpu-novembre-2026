/**
 * Navigation — la palette de commandes (Ctrl+K, ⌘K sur Mac), chargée à la demande par src/nav/declencheur.ts.
 *
 * Une boîte modale (`<dialog>` : focus piégé, fond inerte, Échap) qui porte une **combobox ARIA** : le champ
 * (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`) pilote une liste (`role="listbox"`)
 * d'options (`role="option"`, `aria-selected`) rangées en groupes (`role="group"`) ; le nombre de résultats est annoncé
 * (`role="status"`). Le focus reste dans le champ ; ↑ ↓ (Pg préc. / Pg suiv. par cinq) changent l'option active,
 * Entrée l'ouvre (Mod+Entrée : dans un nouvel onglet), Échap vide le champ puis ferme.
 *
 * On y trouve : les pages (taxonomie), les effets et leurs attributs `data-*` (registre), et des commandes — thème,
 * mouvement réduit, douceur (aucune / subtile / expressive), copier le lien, ouvrir dans le Studio, page précédente / suivante, menu des pages, mode
 * présentation, débogage. Recherche floue sans accents (src/nav/recherche.ts) ; récents gardés (stockage protégé).
 */
import { EFFETS, type Manifeste } from "../registre/effets.ts";
import { afficher } from "../studio/raccourcis.ts";
import { presenting, setPresenting } from "../presse/presentation.ts";
import { openDebugPanel } from "../debug-panel.ts";
import { chercher, decouper } from "./recherche.ts";
import { commandesDouceur, creerCommandes, lireRecents, noterRecent, texteDe, type Commande } from "./commandes.ts";
import { GROUPES, NOMS_CATEGORIES, entreesAPlat, voisine } from "./taxonomie.ts";
import { appliquerTheme, basculerTheme, themeChoisi, themeEffectif } from "./theme.ts";
import type { ContextePalette } from "./declencheur.ts";

type Genre = "commande" | "page" | "effet" | "attribut";
type Item = {
  id: string;
  genre: Genre;
  titre: string;
  texte: string;
  mots: readonly string[];
  /** À droite : le groupe, ou les touches. */
  etiquette?: string;
  touches?: string[];
  icone: string;
  href?: string;
  commande?: Commande;
};

const NOMS_GENRES: Record<Genre | "recents", string> = { recents: "Récents", commande: "Commandes", page: "Pages", effet: "Effets", attribut: "Attributs data-*" };
const LIMITE = { commande: 8, page: 8, effet: 8, attribut: 8 } as const;

const I: Record<string, string> = {
  page: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  effet: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
  attribut: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  theme: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  mouvement: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  douceur: '<path d="M4 16c3-6 5-6 8 0s5 6 8 0"/><circle cx="12" cy="7" r="1.6"/>',
  lien: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  studio: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M17.5 8h1M17.5 11h1M17.5 14h1"/>',
  precedente: '<path d="M15 6l-6 6 6 6"/>',
  suivante: '<path d="M9 6l6 6-6 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  presentation: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/>',
  debogage: '<path d="M9 9h6v8a3 3 0 0 1-6 0z"/><path d="M12 9V6M9 5l1.5 1.5M15 5l-1.5 1.5M5 12h4M15 12h4M5 17h4M15 17h4"/>',
  recent: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  chercher: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
};
const svg = (n: string, t = 18) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${I[n] ?? I.page}</svg>`;
const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSS = `
.pal {
  --pl-fond: #f6f1e4; --pl-encre: #16110d; --pl-doux: #5a5047; --pl-filet: rgba(22, 17, 13, 0.16); --pl-actif: rgba(200, 50, 28, 0.12);
  --pl-accent: #c8321c; --pl-marque: rgba(200, 50, 28, 0.2); --pl-ombre: 0 24px 64px rgba(0, 0, 0, 0.28);
  width: min(640px, calc(100vw - 16px)); max-height: min(560px, calc(100dvh - 16px)); margin: max(8px, 12vh) auto auto; padding: 0;
  border: 1px solid var(--pl-filet); border-radius: 10px; background: var(--pl-fond); color: var(--pl-encre); box-shadow: var(--pl-ombre);
  font: 15px/1.35 "Archivo Variable", "Archivo", system-ui, sans-serif; overflow: hidden;
}
.pal[open] { display: flex; flex-direction: column; }
.pal::backdrop { background: rgba(10, 8, 6, 0.42); }
@media (prefers-color-scheme: dark) {
  :root:not([data-presse-theme="clair"]) .pal { --pl-fond: #1d1915; --pl-encre: #efe6d2; --pl-doux: #b9ae9c; --pl-filet: rgba(239, 230, 210, 0.18); --pl-actif: rgba(255, 122, 92, 0.16); --pl-accent: #ff7a5c; --pl-marque: rgba(255, 122, 92, 0.28); --pl-ombre: 0 24px 64px rgba(0, 0, 0, 0.6); color-scheme: dark; }
}
:root[data-presse-theme="sombre"] .pal { --pl-fond: #1d1915; --pl-encre: #efe6d2; --pl-doux: #b9ae9c; --pl-filet: rgba(239, 230, 210, 0.18); --pl-actif: rgba(255, 122, 92, 0.16); --pl-accent: #ff7a5c; --pl-marque: rgba(255, 122, 92, 0.28); --pl-ombre: 0 24px 64px rgba(0, 0, 0, 0.6); color-scheme: dark; }
@media (prefers-reduced-motion: no-preference) {
  html:not(.presse-anim-reduite) .pal[open] { animation: pl-entre 0.16s cubic-bezier(0.2, 0, 0, 1); }
  @keyframes pl-entre { from { opacity: 0; translate: 0 -8px; scale: 0.99; } }
}
.pal .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.pal-champ { display: flex; align-items: center; gap: 10px; padding: 0 12px 0 16px; border-bottom: 1px solid var(--pl-filet); color: var(--pl-doux); }
.pal-champ input {
  flex: 1 1 auto; min-width: 0; min-height: 54px; border: 0; background: transparent; color: var(--pl-encre); font: 500 17px/1.2 inherit; outline: none;
}
.pal-champ input::placeholder { color: var(--pl-doux); opacity: 1; }
.pal-champ:focus-within { box-shadow: inset 0 -2px 0 var(--pl-accent); }
.pal kbd { display: inline-block; min-width: 1.6em; padding: 3px 5px; border: 1px solid var(--pl-filet); border-radius: 4px; font: 500 11px/1 "IBM Plex Mono", ui-monospace, monospace; color: var(--pl-encre); text-align: center; }
.pal-liste { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 6px; scroll-padding: 6px; }
.pal-g { padding: 10px 10px 4px; font: 700 11px/1.2 "IBM Plex Mono", ui-monospace, monospace; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pl-doux); }
.pal-o { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.pal-o[aria-selected="true"] { background: var(--pl-actif); box-shadow: inset 3px 0 0 var(--pl-accent); }
.pal-o[aria-disabled="true"] { opacity: 0.5; cursor: default; }
.pal-i { flex: 0 0 auto; display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--pl-filet); color: var(--pl-doux); }
.pal-t { display: grid; flex: 1 1 auto; min-width: 0; }
.pal-nom { font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pal-nom mark { background: var(--pl-marque); color: inherit; border-radius: 2px; }
.pal-d { font-size: 13px; color: var(--pl-doux); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pal-x { flex: 0 0 auto; display: flex; gap: 3px; font-size: 12px; color: var(--pl-doux); }
.pal-vide { margin: 0; padding: 24px 16px; color: var(--pl-doux); text-align: center; }
.pal-pied { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 8px 14px; border-top: 1px solid var(--pl-filet); font-size: 12px; color: var(--pl-doux); }
.pal-pied span { display: inline-flex; align-items: center; gap: 4px; }
.pal-toast {
  position: fixed; z-index: 2147483600; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); translate: -50% 0; margin: 0;
  padding: 10px 16px; border-radius: 99px; background: rgba(22, 17, 13, 0.92); color: #efe6d2; font: 500 13px/1.2 system-ui, sans-serif; pointer-events: none;
}
.pal-toast:empty { display: none; }
@media (max-width: 560px) {
  .pal { margin-top: 8px; max-height: calc(100dvh - 16px); }
  .pal-pied { display: none; }
  .pal-x { display: none; }
}
`;

let dialogue: HTMLDialogElement | null = null;
let retourFocus: HTMLElement | null = null;
let toast: HTMLElement | null = null;

function dire(t: string) {
  if (!toast) {
    toast = document.createElement("p");
    toast.className = "pal-toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  toast.textContent = t;
  setTimeout(() => toast && toast.textContent === t && (toast.textContent = ""), 2600);
}

async function copier(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    const z = document.createElement("textarea");
    z.value = t;
    z.style.cssText = "position:fixed;opacity:0";
    document.body.append(z);
    z.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      /* refusé */
    }
    z.remove();
    return ok;
  }
}

type ApiMouvement = { force: boolean; system: boolean; reduit?: boolean; set(v: boolean, garder?: boolean): void; reduire?(v: boolean): void };
const mouvement = () => (window as unknown as { __presseMotion?: ApiMouvement }).__presseMotion;
const reduitMaintenant = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** La page ouverte, depuis la racine du site (« goo.html », « legacy/index.html »). */
function pageIci(base: string): string {
  const racine = new URL(base, location.href).pathname;
  const p = location.pathname.startsWith(racine) ? location.pathname.slice(racine.length) : location.pathname.split("/").pop() ?? "";
  return p === "" || p.endsWith("/") ? `${p}index.html` : p;
}

function commandes(c: ContextePalette) {
  const r = creerCommandes();
  const ici = pageIci(c.base);
  const aller = (href: string) => void (location.href = c.base + href);
  r.ajouter({
    id: "theme",
    titre: "Basculer le thème clair / sombre",
    groupe: "Affichage",
    texte: () => `Menu, palette et Studio · ${themeEffectif() === "sombre" ? "sombre" : "clair"}${themeChoisi() ? "" : " (système)"}`,
    mots: ["mode sombre", "clair", "nuit", "couleurs"],
    icone: "theme",
    executer: () => dire(`Thème ${basculerTheme()}.`),
  });
  r.ajouter({
    id: "mouvement",
    titre: reduitMaintenant() ? "Rallumer les animations" : "Réduire les animations",
    groupe: "Affichage",
    texte: () => (reduitMaintenant() ? "Mouvement réduit en ce moment" : "Mouvement complet en ce moment") + (mouvement()?.system ? " · le système en demande moins" : ""),
    mots: ["mouvement réduit", "animations", "prefers-reduced-motion", "accessibilité"],
    icone: "mouvement",
    disponible: () => !!mouvement() && !presenting(),
    executer: () => {
      const m = mouvement()!;
      if (reduitMaintenant()) {
        if (m.reduit) m.reduire?.(false);
        if (reduitMaintenant()) m.set(true);
      } else {
        if (m.force) m.set(false);
        if (!reduitMaintenant()) m.reduire?.(true);
      }
      dire(reduitMaintenant() ? "Mouvement réduit." : "Animations rallumées.");
    },
  });
  // Douceur (src/presse/douceur.ts) : le niveau des micro-interactions, pour toutes les pages qui l'arment.
  for (const k of commandesDouceur({ dire })) r.ajouter(k);
  r.ajouter({
    id: "lien",
    titre: "Copier le lien de cette page",
    groupe: "Page",
    texte: () => location.href.replace(/^https?:\/\//, ""),
    mots: ["url", "adresse", "partager"],
    icone: "lien",
    executer: async () => dire((await copier(location.href)) ? "Lien copié." : "Copie refusée par le navigateur."),
  });
  // « Ouvrir dans le Studio » : les effets réglables dont cette page se sert (ou dont elle est l'exemple).
  if (ici !== "studio-effet.html") {
    const surPage = EFFETS.filter((e: Manifeste) => e.parametres && (e.exemple === ici || safeQuery(e.selecteur)));
    for (const e of surPage)
      r.ajouter({ id: `studio:${e.id}`, titre: `Ouvrir dans le Studio : ${e.nom}`, groupe: "Page", texte: "Régler l'effet en direct : inspecteur, courbes, attributs", mots: ["studio", "régler", e.id], icone: "studio", executer: () => aller(`studio-effet.html?effet=${e.id}`) });
  }
  const prec = voisine(ici, -1);
  const suiv = voisine(ici, 1);
  r.ajouter({ id: "precedente", titre: "Aller à la page précédente", groupe: "Aller", texte: prec.name, raccourci: presenting() ? "Maj+Gauche" : undefined, mots: ["précédent", "retour"], icone: "precedente", executer: () => aller(prec.href) });
  r.ajouter({ id: "suivante", titre: "Aller à la page suivante", groupe: "Aller", texte: suiv.name, raccourci: presenting() ? "Maj+Droite" : undefined, mots: ["suivant"], icone: "suivante", executer: () => aller(suiv.href) });
  if (c.ouvrirMenu) r.ajouter({ id: "menu", titre: "Menu des pages", groupe: "Aller", texte: "Les pages par groupe : Studio, Effets, Interfaces…", mots: ["pages", "navigation"], icone: "menu", executer: () => c.ouvrirMenu!() });
  r.ajouter({ id: "presentation", titre: presenting() ? "Quitter le mode présentation" : "Mode présentation", groupe: "Affichage", texte: "Animations, sans débogage ; Maj + ← → entre les démos", raccourci: presenting() ? "Maj+Echap" : undefined, mots: ["conférence", "télécommande"], icone: "presentation", executer: () => setPresenting(!presenting()) });
  r.ajouter({ id: "debogage", titre: "Débogage", groupe: "Page", texte: "Fil de fer, grille, capture vidéo", mots: ["debug", "fil de fer"], icone: "debogage", executer: () => openDebugPanel(retourFocus ?? document.body) });
  return r;
}

function safeQuery(sel: string): boolean {
  try {
    return !!document.querySelector(sel);
  } catch {
    return false;
  }
}

function items(c: ContextePalette, mac: boolean): Item[] {
  const out: Item[] = [];
  const nomGroupe = Object.fromEntries(GROUPES.map((g) => [g.id, g.nom]));
  for (const k of commandes(c).lister())
    out.push({ id: `cmd:${k.id}`, genre: "commande", titre: k.titre, texte: texteDe(k), mots: [...(k.mots ?? []), k.groupe], touches: k.raccourci ? afficher(k.raccourci, mac) : undefined, etiquette: k.groupe, icone: k.icone ?? "effet", commande: k });
  for (const e of entreesAPlat()) {
    const effet = e.id.startsWith("effet:");
    out.push({ id: e.id, genre: effet ? "effet" : "page", titre: e.nom, texte: e.texte, mots: e.mots, etiquette: nomGroupe[e.groupe], icone: effet ? "effet" : "page", href: e.href });
  }
  const vus = new Set<string>();
  for (const m of EFFETS)
    for (const a of m.attributs) {
      if (vus.has(a)) continue;
      vus.add(a);
      out.push({ id: `attr:${a}`, genre: "attribut", titre: a, texte: `${m.nom} · ${NOMS_CATEGORIES[m.categorie]}`, mots: [m.nom, m.id], etiquette: m.parametres ? "Studio" : m.exemple?.replace(/\.html$/, ""), icone: "attribut", href: m.parametres ? `studio-effet.html?effet=${m.id}` : m.exemple ?? "presse.html" });
    }
  return out;
}

type Rang = { genre: Genre | "recents"; liste: { item: Item; positions: number[] }[] };

function ranger(q: string, tous: Item[]): Rang[] {
  const vers = (x: Item) => ({ titre: x.titre, mots: x.mots, texte: x.texte });
  if (!q.trim()) {
    const parId = new Map(tous.map((x) => [x.id, x]));
    const recents = lireRecents().map((id) => parId.get(id)).filter((x): x is Item => !!x);
    return [
      { genre: "recents" as const, liste: recents.map((item) => ({ item, positions: [] as number[] })) },
      ...(["commande", "page", "effet"] as const).map((genre): Rang => ({ genre, liste: tous.filter((x) => x.genre === genre).map((item) => ({ item, positions: [] as number[] })) })),
    ].filter((r) => r.liste.length);
  }
  const rangs = (["commande", "page", "effet", "attribut"] as const).map((genre) => {
    const t = chercher(q, tous.filter((x) => x.genre === genre), vers, LIMITE[genre]);
    return { genre, liste: t.map((r) => ({ item: r.item, positions: r.positions })), meilleur: t[0]?.score ?? -Infinity };
  });
  // Le groupe du meilleur résultat d'abord.
  return rangs.filter((r) => r.liste.length).sort((a, b) => b.meilleur - a.meilleur);
}

function construire(): HTMLDialogElement {
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.append(st);
  const d = document.createElement("dialog");
  d.className = "pal";
  d.setAttribute("aria-labelledby", "pal-titre");
  d.innerHTML = `<h2 id="pal-titre" class="sr">Palette de commandes</h2>
<div class="pal-champ">${svg("chercher", 20)}
  <input id="pal-q" type="text" role="combobox" aria-label="Rechercher une page, un effet, un attribut ou une commande" aria-expanded="true" aria-controls="pal-liste" aria-autocomplete="list" aria-haspopup="listbox"
    autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-describedby="pal-aide" placeholder="Pages, effets, attributs, commandes…" />
  <kbd aria-hidden="true">Échap</kbd>
</div>
<div class="pal-liste" id="pal-liste" role="listbox" aria-label="Résultats"></div>
<p class="pal-vide" hidden></p>
<div class="pal-pied" id="pal-aide"><span><kbd>↑</kbd><kbd>↓</kbd> choisir</span><span><kbd>Entrée</kbd> ouvrir</span><span><kbd>Échap</kbd> fermer</span><span class="sr">; recherche sans accents, une faute tolérée.</span></div>
<p class="sr" role="status" aria-live="polite" aria-atomic="true" id="pal-annonce"></p>`;
  document.body.append(d);
  return d;
}

export function basculerPalette(c: ContextePalette, retour: HTMLElement | null) {
  if (dialogue?.open) return fermer();
  ouvrir(c, retour);
}

function fermer() {
  if (!dialogue?.open) return;
  dialogue.close();
}

export function ouvrir(c: ContextePalette, retour: HTMLElement | null) {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  retourFocus = retour;
  appliquerTheme();
  // Le menu des pages (popover) se referme : la palette prend sa place.
  document.querySelector<HTMLElement>(".pages-pop:popover-open")?.hidePopover();
  const d = (dialogue ??= construire());
  const champ = d.querySelector<HTMLInputElement>("#pal-q")!;
  const liste = d.querySelector<HTMLElement>("#pal-liste")!;
  const vide = d.querySelector<HTMLElement>(".pal-vide")!;
  const annonce = d.querySelector<HTMLElement>("#pal-annonce")!;
  let tous = items(c, mac);
  let options: { el: HTMLElement; item: Item }[] = [];
  let actif = -1;
  let minuteur = 0;

  const activer = (i: number, voir = true) => {
    if (!options.length) {
      actif = -1;
      champ.removeAttribute("aria-activedescendant");
      return;
    }
    actif = (i + options.length) % options.length;
    options.forEach((o, k) => o.el.setAttribute("aria-selected", String(k === actif)));
    const el = options[actif]!.el;
    champ.setAttribute("aria-activedescendant", el.id);
    if (voir) el.scrollIntoView({ block: "nearest" });
  };

  const dessiner = () => {
    const q = champ.value;
    const rangs = ranger(q, tous);
    let n = 0;
    options = [];
    liste.innerHTML = rangs
      .map((r, g) => {
        const lignes = r.liste
          .map(({ item, positions }) => {
            const id = `pal-o-${n++}`;
            const nom = decouper(item.titre, positions).map((m) => (m.marque ? `<mark>${echap(m.texte)}</mark>` : echap(m.texte))).join("");
            const off = item.commande?.disponible && !item.commande.disponible();
            const droite = item.touches ? item.touches.map((t) => `<kbd>${echap(t)}</kbd>`).join("") : item.etiquette ? echap(item.etiquette) : "";
            return `<div role="option" id="${id}" class="pal-o" data-id="${echap(item.id)}" aria-selected="false"${off ? ' aria-disabled="true"' : ""}><span class="pal-i">${svg(r.genre === "recents" ? "recent" : item.icone)}</span><span class="pal-t"><span class="pal-nom">${nom}</span>${item.texte ? `<span class="pal-d">${echap(item.texte)}</span>` : ""}</span><span class="pal-x" aria-hidden="true">${droite}</span></div>`;
          })
          .join("");
        return `<div role="group" aria-labelledby="pal-g-${g}"><div role="presentation" class="pal-g" id="pal-g-${g}">${NOMS_GENRES[r.genre]}</div>${lignes}</div>`;
      })
      .join("");
    const parId = new Map(tous.map((x) => [x.id, x]));
    options = [...liste.querySelectorAll<HTMLElement>('[role="option"]')].map((el) => ({ el, item: parId.get(el.dataset.id!)! }));
    vide.hidden = options.length > 0;
    vide.textContent = options.length ? "" : `Rien pour « ${q.trim()} ». Essayez un nom de page, d'effet ou un attribut (data-goo).`;
    champ.setAttribute("aria-expanded", String(options.length > 0));
    activer(0);
    clearTimeout(minuteur);
    minuteur = window.setTimeout(() => {
      annonce.textContent = options.length ? `${options.length} résultat${options.length > 1 ? "s" : ""}${q.trim() ? "" : ", récents et commandes d'abord"}. Flèches pour choisir, Entrée pour ouvrir.` : vide.textContent;
    }, q ? 350 : 60);
  };

  const jouer = async (i: number, nouvelOnglet = false) => {
    const o = options[i];
    if (!o || o.el.getAttribute("aria-disabled") === "true") return;
    noterRecent(o.item.id);
    if (o.item.commande) {
      fermer();
      await o.item.commande.executer();
    } else if (o.item.href) {
      const url = c.base + o.item.href;
      if (nouvelOnglet) {
        open(url, "_blank", "noopener");
        fermer();
      } else location.href = url;
    }
  };

  champ.oninput = () => dessiner();
  champ.onkeydown = (ev) => {
    if (ev.isComposing) return;
    const mod = mac ? ev.metaKey : ev.ctrlKey;
    if (ev.key === "ArrowDown") (ev.preventDefault(), activer(actif + 1));
    else if (ev.key === "ArrowUp") (ev.preventDefault(), activer(actif - 1));
    else if (ev.key === "PageDown") (ev.preventDefault(), activer(Math.min(options.length - 1, actif + 5)));
    else if (ev.key === "PageUp") (ev.preventDefault(), activer(Math.max(0, actif - 5)));
    else if (ev.key === "Enter") (ev.preventDefault(), void jouer(actif, mod));
    else if (ev.key === "Escape") {
      ev.preventDefault();
      if (champ.value) {
        champ.value = "";
        dessiner();
      } else fermer();
    } else if (ev.key === "Tab") ev.preventDefault();
  };
  // Les touches tapées ici ne vont pas aux raccourcis de la page (diaporama : lettres, Échap…).
  d.onkeydown = (ev) => {
    if (ev.key.toLowerCase() === "k" && (mac ? ev.metaKey : ev.ctrlKey) && !ev.shiftKey) {
      ev.preventDefault();
      fermer();
    }
    ev.stopPropagation();
  };
  d.onkeyup = (ev) => ev.stopPropagation();
  liste.onpointermove = (ev) => {
    const el = (ev.target as Element).closest<HTMLElement>('[role="option"]');
    const i = options.findIndex((o) => o.el === el);
    if (i >= 0 && i !== actif) activer(i, false);
  };
  liste.onclick = (ev) => {
    const el = (ev.target as Element).closest<HTMLElement>('[role="option"]');
    const i = options.findIndex((o) => o.el === el);
    if (i >= 0) void jouer(i, ev.metaKey || ev.ctrlKey);
  };
  liste.onmousedown = (ev) => ev.preventDefault(); // le focus reste dans le champ
  d.onclick = (ev) => {
    if (ev.target === d) fermer();
  };
  d.oncancel = (ev) => {
    // Échap natif : même règle que dans le champ (vider d'abord).
    if (champ.value) {
      ev.preventDefault();
      champ.value = "";
      dessiner();
    }
  };
  d.onclose = () => {
    clearTimeout(minuteur);
    const r = retourFocus;
    retourFocus = null;
    if (r?.isConnected) r.focus({ preventScroll: true });
  };
  champ.value = "";
  tous = items(c, mac);
  dessiner();
  d.showModal();
  champ.focus();
}

