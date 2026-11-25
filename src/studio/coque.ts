/**
 * Studio — la coque commune des éditeurs (DOM) : applique une mise en page (src/studio/coque-plan.ts) à un conteneur
 * en grille, pose les poignées de redimension, bascule en onglets sous le seuil étroit, garde la mise en page dans le
 * navigateur (registre du stockage) et la rend exportable en JSON versionné.
 *
 *   const coque = monterCoque(racine, { schema: SCHEMA_DIAPO_CREATEUR, cle: CLES.coqueDiapoCreateur,
 *     poignees: [{ decoupe: "corps", index: 0, panneau: "diapos", libelle: "Largeur des diapos", zone: "apercu" }],
 *     vues: { diapos: elDiapos, apercu: elApercu, inspecteur: elInspecteur } });
 *   coque.onglet("inspecteur"); coque.choisirOnglet("inspecteur", "style"); coque.choisirVue("apercu");
 *
 * Le conteneur lit `--coque-<panneau>` (taille en px) dans sa grille, `data-coque-replie` (panneaux repliés),
 * `data-coque-mode` (`large` | `etroit`) et, en étroit, `data-coque-vue` (la vue montrée) ; il range les onglets du
 * mode étroit (`.coque-vues`, enfant direct, `grid-area: vues`) où il veut. Seule la mise en page vit ici : chaque
 * éditeur garde son modèle de document.
 *
 * Poignée : `role="separator"` (aria-valuenow / min / max, aria-controls), au pointeur, au clavier (← → ou ↑ ↓ :
 * 16 px, Maj : 64 px, Début / Fin : bornes, Entrée : replier / rouvrir), double-clic : taille par défaut. Elle se pose
 * dans la grille du conteneur (`zone`), ou dans celle d'un autre élément (`hote` : une découpe imbriquée).
 * Onglets du mode étroit : `role="tablist"`, une icône par vue (nom en `aria-label` et en infobulle), ← → Début Fin
 * (activation automatique, focus itinérant) ; chaque vue reçoit `role="tabpanel"` et `aria-labelledby` le temps du
 * mode étroit. Aucun raccourci global : les touches ne jouent que sur la poignée ou l'onglet qui a le focus.
 */
import "./coque.css";
import { basculerRepli, choisirOnglet as choisir, fixerTaille, lireMiseEnPage, modeDe, noeudsDe, redimensionner, serialiser, tailleDe, vueDe, vueVoisine, type MiseEnPage, type Mode, type Schema } from "./coque-plan.ts";
import { ic } from "./icones.ts";
import { ecrire, lire, type Cle } from "../registre/stockage.ts";

export type Poignee = {
  decoupe: string;
  /** Entre l'enfant `index` et `index + 1` de la découpe. */
  index: number;
  /** Le panneau de taille fixe que la poignée règle (pour aria-controls et les bornes). */
  panneau: string;
  libelle: string;
  /** La zone de grille où la poser (grid-area) : la poignée se colle au bord de début de cette zone. */
  zone: string;
  /** L'élément du panneau (aria-controls). */
  cible?: HTMLElement;
  /** La grille où poser la poignée (défaut : le conteneur de la coque) — pour une découpe imbriquée. */
  hote?: HTMLElement;
};

export type Coque = {
  mep(): MiseEnPage;
  mode(): Mode;
  onglet(groupe: string): string;
  choisirOnglet(groupe: string, onglet: string): void;
  /** La vue montrée en mode étroit. */
  vue(): string;
  choisirVue(id: string, focus?: boolean): void;
  /** Le JSON versionné de la mise en page (à copier, à joindre à un export). */
  exporter(): string;
  /** Recharge depuis un JSON ; rend les corrections faites. */
  importer(json: unknown): string[];
  reinitialiser(): void;
};

export type OptionsCoque = {
  schema: Schema;
  cle: Cle;
  poignees: Poignee[];
  /** Les éléments des vues du mode étroit (un par enfant de la racine du plan). */
  vues?: Record<string, HTMLElement>;
  /** Libellé du groupe d'onglets du mode étroit. */
  libelleVues?: string;
  /** Les onglets du mode étroit se posent juste après cet élément (la barre d'outils : ordre de tabulation) ; défaut : en tête. */
  apres?: HTMLElement;
  auChangement?: (m: MiseEnPage) => void;
  /** Le mode a changé (large ⇄ étroit), ou la vue montrée en étroit. */
  auMode?: (mode: Mode, vue: string) => void;
  /** Largeur de fenêtre (essais) ; défaut : `innerWidth`, suivi par `matchMedia`. */
  largeur?: () => number;
};

export function monterCoque(racine: HTMLElement, o: OptionsCoque): Coque {
  const s = o.schema;
  let mep = lireMiseEnPage(lire(o.cle), s).mep;
  const largeur = o.largeur ?? (() => window.innerWidth);
  let mode: Mode = modeDe(s, largeur());
  let minuteur = 0;
  const garder = () => {
    clearTimeout(minuteur);
    minuteur = window.setTimeout(() => ecrire(o.cle, serialiser(mep)), 200);
  };
  const appliquer = (persister = true) => {
    for (const id of noeudsDe(mep.racine)) {
      const t = tailleDe(mep, id);
      if (t === null) racine.style.removeProperty(`--coque-${id}`);
      else racine.style.setProperty(`--coque-${id}`, `${t}px`);
    }
    racine.dataset.coqueReplie = mep.replies.join(" ");
    for (const p of poignees) majPoignee(p);
    if (persister) garder();
    o.auChangement?.(mep);
  };

  const poignees: (Poignee & { el: HTMLElement })[] = o.poignees.map((p) => {
    const el = document.createElement("div");
    el.className = "coque-poignee";
    el.setAttribute("role", "separator");
    el.tabIndex = 0;
    const d = trouverSens(mep, p.decoupe);
    // Une découpe en ligne (côte à côte) a une poignée verticale.
    el.setAttribute("aria-orientation", d === "colonne" ? "horizontal" : "vertical");
    el.setAttribute("aria-label", p.libelle);
    el.title = `${p.libelle} — tirer, ou ${d === "colonne" ? "↑ ↓" : "← →"} ; double-clic : par défaut ; Entrée : replier`;
    el.style.gridArea = p.zone;
    el.dataset.panneau = p.panneau;
    if (p.cible) {
      if (!p.cible.id) p.cible.id = `coque-${p.panneau}`;
      el.setAttribute("aria-controls", p.cible.id);
    }
    const b = s.bornes[p.panneau];
    if (b) {
      el.setAttribute("aria-valuemin", String(b.min));
      el.setAttribute("aria-valuemax", String(b.max));
    }
    (p.hote ?? racine).append(el);
    const q = { ...p, el };
    brancher(q);
    return q;
  });

  function majPoignee(p: Poignee & { el?: HTMLElement }) {
    if (!p.el) return;
    const t = tailleDe(mep, p.panneau) ?? 0;
    p.el.setAttribute("aria-valuenow", String(t));
    p.el.setAttribute("aria-valuetext", t ? `${t} pixels` : "replié");
  }

  function brancher(p: Poignee & { el: HTMLElement }) {
    const { el } = p;
    const vertical = el.getAttribute("aria-orientation") === "vertical";
    el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      el.setPointerCapture(ev.pointerId);
      el.dataset.tire = "";
      document.body.classList.add("coque-tire");
      let dernier = vertical ? ev.clientX : ev.clientY;
      const bouge = (e: PointerEvent) => {
        const x = vertical ? e.clientX : e.clientY;
        mep = redimensionner(mep, p.decoupe, p.index, x - dernier, s.bornes);
        dernier = x;
        appliquer(false);
      };
      const fin = () => {
        delete el.dataset.tire;
        document.body.classList.remove("coque-tire");
        el.removeEventListener("pointermove", bouge);
        appliquer();
      };
      el.addEventListener("pointermove", bouge);
      el.addEventListener("pointerup", fin, { once: true });
      el.addEventListener("pointercancel", fin, { once: true });
    });
    el.addEventListener("dblclick", () => {
      mep = fixerTaille(mep, p.panneau, s.bornes[p.panneau]?.defaut ?? tailleDe(s.defaut, p.panneau) ?? 0, s.bornes);
      mep = { ...mep, replies: mep.replies.filter((x) => x !== p.panneau) };
      appliquer();
    });
    el.addEventListener("keydown", (ev) => {
      const pas = ev.shiftKey ? 64 : 16;
      const b = s.bornes[p.panneau];
      const plus = vertical ? "ArrowRight" : "ArrowDown";
      const moins = vertical ? "ArrowLeft" : "ArrowUp";
      if (ev.key === plus) mep = redimensionner(mep, p.decoupe, p.index, pas, s.bornes);
      else if (ev.key === moins) mep = redimensionner(mep, p.decoupe, p.index, -pas, s.bornes);
      else if (ev.key === "Home" && b) mep = fixerTaille(mep, p.panneau, b.min, s.bornes);
      else if (ev.key === "End" && b) mep = fixerTaille(mep, p.panneau, b.max, s.bornes);
      else if (ev.key === "Enter") mep = basculerRepli(mep, p.panneau);
      else return;
      ev.preventDefault();
      ev.stopPropagation();
      appliquer();
    });
  }

  /* ── Mode étroit : des onglets, une vue à la fois ── */
  const e = s.etroit;
  const vuesEl = o.vues ?? {};
  let liste: HTMLElement | null = null;
  const onglets = new Map<string, HTMLButtonElement>();
  if (e) {
    liste = document.createElement("div");
    liste.className = "coque-vues";
    liste.setAttribute("role", "tablist");
    liste.setAttribute("aria-label", o.libelleVues ?? "Panneaux");
    for (const v of e.vues) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "coque-vue";
      b.id = `coque-vue-${v.id}`;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", v.libelle);
      b.title = v.libelle;
      b.dataset.vue = v.id;
      b.innerHTML = ic(v.icone, 22);
      const el = vuesEl[v.id];
      if (el) {
        if (!el.id) el.id = `coque-panneau-${v.id}`;
        b.setAttribute("aria-controls", el.id);
      }
      b.addEventListener("click", () => choisirVue(v.id));
      liste.append(b);
      onglets.set(v.id, b);
    }
    liste.addEventListener("keydown", (ev) => {
      const actuelle = (ev.target as HTMLElement).closest<HTMLElement>("[data-vue]")?.dataset.vue;
      if (!actuelle) return;
      let v: string | null = null;
      if (ev.key === "ArrowRight") v = vueVoisine(s, actuelle, 1);
      else if (ev.key === "ArrowLeft") v = vueVoisine(s, actuelle, -1);
      else if (ev.key === "Home") v = e.vues[0]!.id;
      else if (ev.key === "End") v = e.vues[e.vues.length - 1]!.id;
      if (!v) return;
      ev.preventDefault();
      choisirVue(v, true);
    });
    if (o.apres) o.apres.after(liste);
    else racine.prepend(liste);
  }

  function majVues() {
    racine.dataset.coqueMode = mode;
    if (!e) return;
    const v = vueDe(mep, s);
    racine.dataset.coqueVue = v;
    for (const [id, b] of onglets) {
      const sel = id === v;
      b.setAttribute("aria-selected", String(sel));
      b.tabIndex = sel ? 0 : -1;
    }
    for (const [id, el] of Object.entries(vuesEl)) {
      if (mode === "etroit") {
        el.setAttribute("role", "tabpanel");
        el.setAttribute("aria-labelledby", `coque-vue-${id}`);
        el.toggleAttribute("data-coque-cache", id !== v);
      } else if (el.getAttribute("role") === "tabpanel") {
        el.removeAttribute("role");
        el.removeAttribute("aria-labelledby");
        el.removeAttribute("data-coque-cache");
      }
    }
  }

  function choisirVue(id: string, focus = false) {
    if (!e) return;
    const avant = vueDe(mep, s);
    mep = choisir(mep, e.groupe, id, s.onglets);
    majVues();
    if (focus) onglets.get(vueDe(mep, s))?.focus();
    if (vueDe(mep, s) !== avant) {
      garder();
      o.auMode?.(mode, vueDe(mep, s));
    }
  }

  if (e) {
    // Le seuil est inclusif (≤ seuil : étroit), comme modeDe.
    const mq = window.matchMedia(`(max-width: ${e.seuil}px)`);
    const suivre = () => {
      const m = o.largeur ? modeDe(s, largeur()) : mq.matches ? "etroit" : "large";
      if (m === mode) return;
      mode = m;
      majVues();
      o.auMode?.(mode, vueDe(mep, s));
    };
    mq.addEventListener("change", suivre);
    if (!o.largeur) mode = mq.matches ? "etroit" : "large";
  }

  appliquer(false);
  majVues();
  return {
    mep: () => mep,
    mode: () => mode,
    onglet: (g) => mep.onglets[g] ?? s.onglets[g]?.[0] ?? "",
    choisirOnglet(g, v) {
      mep = choisir(mep, g, v, s.onglets);
      garder();
    },
    vue: () => vueDe(mep, s),
    choisirVue,
    exporter: () => JSON.stringify(mep, null, 2),
    importer(json) {
      const r = lireMiseEnPage(json, s);
      mep = r.mep;
      appliquer();
      majVues();
      return r.corrections;
    },
    reinitialiser() {
      mep = lireMiseEnPage(null, s).mep;
      appliquer();
      majVues();
    },
  };
}

function trouverSens(m: MiseEnPage, id: string): "ligne" | "colonne" | undefined {
  const voir = (n: MiseEnPage["racine"]): "ligne" | "colonne" | undefined => (n.type === "panneau" ? undefined : n.id === id ? n.sens : n.enfants.map(voir).find(Boolean));
  return voir(m.racine);
}
