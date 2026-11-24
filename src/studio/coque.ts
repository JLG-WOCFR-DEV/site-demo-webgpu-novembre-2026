/**
 * Studio — la coque commune des éditeurs (DOM) : applique une mise en page (src/studio/coque-plan.ts) à un conteneur
 * en grille, pose les poignées de redimension, garde la mise en page dans le navigateur (registre du stockage) et la
 * rend exportable en JSON versionné.
 *
 *   const coque = monterCoque(racine, { schema: SCHEMA_STUDIO_EFFET, cle: CLES.coqueStudioEffet,
 *     poignees: [{ decoupe: "corps", index: 0, panneau: "inspecteur", libelle: "Largeur de l'inspecteur", zone: "ins" }] });
 *   coque.onglet("code"); coque.choisirOnglet("code", "json");
 *
 * Le conteneur lit `--coque-<panneau>` (taille en px) dans sa grille, et `data-coque-replie` (liste des panneaux
 * repliés). Poignée : `role="separator"` (aria-valuenow / min / max, aria-controls), au pointeur, au clavier
 * (← → : 16 px, Maj : 64 px, Début / Fin : bornes, Entrée : replier / rouvrir), double-clic : taille par défaut.
 *
 * Adoption par les trois éditeurs (Créateur, Vitrine, diapo-createur) : chacun décrit SON plan (colonnes gauche /
 * aperçu / inspecteur, onglets d'inspecteur) dans un `Schema`, garde son modèle de document, et remplace ses
 * redimensions maison (diapo-createur : `--dc-left` et sa poignée) par `monterCoque` — voir docs/ROADMAP-STUDIO.md, E6.
 */
import { basculerRepli, choisirOnglet as choisir, fixerTaille, lireMiseEnPage, panneauxDe, redimensionner, serialiser, tailleDe, type MiseEnPage, type Schema } from "./coque-plan.ts";
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
};

export type Coque = {
  mep(): MiseEnPage;
  onglet(groupe: string): string;
  choisirOnglet(groupe: string, onglet: string): void;
  /** Le JSON versionné de la mise en page (à copier, à joindre à un export). */
  exporter(): string;
  /** Recharge depuis un JSON ; rend les corrections faites. */
  importer(json: unknown): string[];
  reinitialiser(): void;
};

export const CSS_COQUE = `
.coque-poignee { position: relative; z-index: 4; justify-self: start; align-self: stretch; width: 10px; margin-left: -5px; padding: 0; border: 0; background: transparent; cursor: col-resize; touch-action: none; }
.coque-poignee::after { content: ""; position: absolute; inset: 0 4px; background: transparent; transition: background-color 0.12s; }
.coque-poignee:hover::after, .coque-poignee:focus-visible::after, .coque-poignee[data-tire]::after { background: var(--st-accent, #5b8cff); }
.coque-poignee:focus-visible { outline: none; }
.coque-poignee[aria-orientation="horizontal"] { justify-self: stretch; align-self: start; width: auto; height: 10px; margin: -5px 0 0; cursor: row-resize; }
.coque-poignee[aria-orientation="horizontal"]::after { inset: 4px 0; }
body.coque-tire iframe { pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .coque-poignee::after { transition: none; } }
`;

let styleColle = false;

export function monterCoque(racine: HTMLElement, o: { schema: Schema; cle: Cle; poignees: Poignee[]; auChangement?: (m: MiseEnPage) => void }): Coque {
  if (!styleColle) {
    styleColle = true;
    const st = document.createElement("style");
    st.textContent = CSS_COQUE;
    document.head.append(st);
  }
  const s = o.schema;
  let mep = lireMiseEnPage(lire(o.cle), s).mep;
  let minuteur = 0;
  const garder = () => {
    clearTimeout(minuteur);
    minuteur = window.setTimeout(() => ecrire(o.cle, serialiser(mep)), 200);
  };
  const appliquer = (persister = true) => {
    for (const id of panneauxDe(mep.racine)) {
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
    el.title = `${p.libelle} — tirer, ou ← → ; double-clic : par défaut ; Entrée : replier`;
    el.style.gridArea = p.zone;
    if (p.cible) {
      if (!p.cible.id) p.cible.id = `coque-${p.panneau}`;
      el.setAttribute("aria-controls", p.cible.id);
    }
    const b = s.bornes[p.panneau];
    if (b) {
      el.setAttribute("aria-valuemin", String(b.min));
      el.setAttribute("aria-valuemax", String(b.max));
    }
    racine.append(el);
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

  appliquer(false);
  return {
    mep: () => mep,
    onglet: (g) => mep.onglets[g] ?? s.onglets[g]?.[0] ?? "",
    choisirOnglet(g, v) {
      mep = choisir(mep, g, v, s.onglets);
      garder();
    },
    exporter: () => JSON.stringify(mep, null, 2),
    importer(json) {
      const r = lireMiseEnPage(json, s);
      mep = r.mep;
      appliquer();
      return r.corrections;
    },
    reinitialiser() {
      mep = lireMiseEnPage(null, s).mep;
      appliquer();
    },
  };
}

function trouverSens(m: MiseEnPage, id: string): "ligne" | "colonne" | undefined {
  const voir = (n: MiseEnPage["racine"]): "ligne" | "colonne" | undefined => (n.type === "panneau" ? undefined : n.id === id ? n.sens : n.enfants.map(voir).find(Boolean));
  return voir(m.racine);
}
