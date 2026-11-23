/**
 * Export des diaporamas — le modèle neutre : ce qu'un diaporama Presse (`main[data-diapo]`) contient, indépendamment
 * du format de sortie (PPTX, PDF, HTML autonome).
 *
 * Pour chaque diapo présentée, dans l'ordre : son titre (comme la vue présentateur : `aria-label`, sinon son premier
 * titre), ses notes de l'orateur en paragraphes, sa transition d'entrée (nom, famille, durée, d'où elle vient), sa
 * durée prévue (`data-duree`), sa section (`data-section`), ses médias, et ses ÉTATS : l'arrivée (appui 0) puis un état
 * par appui, selon l'ordre des apparitions de src/presse/diapo-etapes.ts (`data-step-ordre`, `data-step-depart` :
 * « avec » et « après » ne coûtent pas d'appui). Chaque état porte son texte alternatif : le titre, puis le texte et les
 * images visibles à cet état (`data-diapo-alt` sur la diapo le remplace).
 *
 * Pur : lit un arbre « comme le DOM » (`ElementLike`) — le vrai DOM dans la page, node-html-parser sous Node (tests,
 * ligne de commande). Ni style calculé ni réseau : ce qui se voit dépend du rendu, pas du modèle.
 */
import { SLIDE_TRANSITION_DUREES, type SlideTransition } from "../gpu/slide-transition.ts";
import { planSteps } from "../presse/diapo-etapes.ts";
import { familleDe, type Famille } from "./transitions.ts";
import { OPTIONS_DEFAUT, type OptionsExport } from "./options.ts";

/** Ce que le modèle lit d'un nœud : le DOM et node-html-parser le donnent tous deux. */
export interface NoeudLike {
  nodeType: number;
  textContent: string | null;
}
export interface ElementLike extends NoeudLike {
  tagName: string;
  getAttribute(nom: string): string | null | undefined;
  hasAttribute(nom: string): boolean;
  querySelector(sel: string): ElementLike | null;
  querySelectorAll(sel: string): ArrayLike<ElementLike> & Iterable<ElementLike>;
  readonly childNodes: ArrayLike<NoeudLike> & Iterable<NoeudLike>;
  readonly children: ArrayLike<ElementLike> & Iterable<ElementLike>;
}

export type TransitionExport = {
  nom: string;
  famille: Famille;
  /** Secondes. */
  duree: number;
  /** D'où vient le nom : la diapo, le diaporama (`[data-diapo]`), ou le défaut de Presse (`impression`). */
  source: "diapo" | "diaporama" | "defaut";
};

export type EtatExport = {
  /** Les appuis joués (0 : l'arrivée de la diapo). */
  appuis: number;
  /** Le dernier état de la diapo (toutes ses étapes visibles). */
  dernier: boolean;
  /** Texte alternatif de l'image de cet état. */
  alt: string;
};

export type MediaExport = { genre: "image" | "video" | "page"; src: string; alt: string };

export type DiapoExport = {
  /** Rang présenté, à partir de 1 (les diapos masquées ne comptent pas, comme dans le diaporama). */
  numero: number;
  /** Rang dans le document, à partir de 0 (masquées comprises). */
  index: number;
  titre: string;
  notes: string[];
  transition: TransitionExport;
  /** Secondes prévues (`data-duree`), ou null. */
  duree: number | null;
  section: string | null;
  masquee: boolean;
  /** Nombre d'appuis de la diapo (ses étapes qui demandent un appui). */
  appuis: number;
  etats: EtatExport[];
  medias: MediaExport[];
};

export type DiaporamaExport = {
  titre: string;
  langue: string;
  description: string;
  /** La transition par défaut du diaporama (`[data-diapo]`). */
  transition: string;
  /** Minutes visées (`data-duree-visee`), ou null. */
  dureeVisee: number | null;
  diapos: DiapoExport[];
  /** Total des états (les images à rendre). */
  nbEtats: number;
  avertissements: string[];
};

const blanc = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const attr = (el: ElementLike, nom: string) => el.getAttribute(nom) ?? null;
const ELEMENT = 1;
const TEXTE = 3;

/** Le titre d'une diapo, comme src/presse/diapo.ts (`titleOf`). */
export function titreDe(el: ElementLike): string {
  return blanc(attr(el, "aria-label") || el.querySelector("h1, h2, h3")?.textContent || "");
}

/** Les paragraphes des notes : les <p> de `aside[data-notes]`, ou son texte coupé aux lignes vides (comme `notesParas`). */
export function notesDe(el: ElementLike): string[] {
  const out: string[] = [];
  for (const aside of el.querySelectorAll("[data-notes]")) {
    const ps = [...aside.children].filter((c) => c.tagName === "P");
    const brut = ps.length ? ps.map((p) => p.textContent ?? "") : (aside.textContent ?? "").split(/\n[ \t]*\n/);
    for (const p of brut) {
      const t = blanc(p);
      if (t) out.push(t);
    }
  }
  return out;
}

/** La durée d'une transition, comme le diaporama : `data-transition-dur`, sinon la conseillée, sinon 1,15 s. */
export function dureeTransition(nom: string, famille: Famille, brut: string | null): number {
  const n = Number.parseFloat(brut ?? "");
  if (Number.isFinite(n) && n >= 0) return n;
  if (famille === "deplacement") return 0.85;
  if (nom === "enchaine") return 0.7;
  if (famille === "deux-images") return SLIDE_TRANSITION_DUREES[nom as SlideTransition] ?? 1.15;
  return 1.15;
}

/** Le texte visible d'une diapo après `appuis` appuis : sans les notes, sans les étapes pas encore parues. */
function texteVisible(el: ElementLike, cache: Set<ElementLike>): string {
  const parts: string[] = [];
  const marcher = (n: NoeudLike) => {
    if (n.nodeType === TEXTE) {
      parts.push(n.textContent ?? "");
      return;
    }
    if (n.nodeType !== ELEMENT) return;
    const e = n as ElementLike;
    if (cache.has(e) || e.hasAttribute("data-notes")) return;
    const tag = e.tagName.toUpperCase();
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEMPLATE") return;
    if (tag === "IMG") {
      const a = blanc(attr(e, "alt"));
      if (a) parts.push(` (image : ${a}) `);
      return;
    }
    if (tag === "BR") parts.push(" ");
    for (const c of e.childNodes) marcher(c);
    // Les blocs se séparent d'une espace (un <li> ne colle pas au suivant).
    parts.push(" ");
  };
  for (const c of el.childNodes) marcher(c);
  // Les blancs ordinaires seulement : les espaces fines insécables (« ensuite ? ») restent, comme la typographie.
  return parts
    .join("")
    .replace(/[ \t\n\r\f\v]+/g, " ")
    .replace(/ ([,.)])/g, "$1")
    .trim();
}

const LIMITE_ALT = 1200;
const couper = (s: string) => (s.length > LIMITE_ALT ? `${s.slice(0, LIMITE_ALT - 1).trimEnd()}…` : s);

/** L'élément <html> : `doc` lui-même (document.documentElement) ou son descendant (racine de node-html-parser). */
const htmlDe = (doc: ElementLike | null | undefined) => (doc ? ((doc.tagName ?? "").toUpperCase() === "HTML" ? doc : doc.querySelector("html")) : null);

/** Lit le diaporama. `racine` : le `main[data-diapo]` ; `doc` (facultatif) : le document, pour son titre. */
export function lireDiaporama(racine: ElementLike, options: Partial<OptionsExport> = {}, doc?: ElementLike | null): DiaporamaExport {
  const o = { ...OPTIONS_DEFAUT, ...options };
  const avertissements: string[] = [];
  const defaut = attr(racine, "data-transition") || "impression";
  const toutes = [...racine.querySelectorAll("[data-diapo-slide]")];
  let section: string | null = null;
  let numero = 0;
  const diapos: DiapoExport[] = [];
  toutes.forEach((el, index) => {
    const s = attr(el, "data-section");
    if (s !== null && blanc(s)) section = blanc(s);
    const masquee = el.hasAttribute("data-masquee");
    if (masquee && !o.masquees) return;
    numero++;
    const propre = attr(el, "data-transition");
    const nom = propre || defaut;
    const famille = familleDe(nom);
    const transition: TransitionExport = {
      nom,
      famille,
      duree: dureeTransition(nom, famille, attr(el, "data-transition-dur")),
      source: propre ? "diapo" : attr(racine, "data-transition") ? "diaporama" : "defaut",
    };
    // L'ordre des apparitions, comme le diaporama.
    const etapes = [...el.querySelectorAll("[data-step]")];
    const plan = planSteps(etapes.map((e) => ({ ordre: attr(e, "data-step-ordre"), depart: attr(e, "data-step-depart") })));
    const appuiDe = new Map<ElementLike, number>();
    for (const p of plan) appuiDe.set(etapes[p.index]!, p.click);
    const appuis = plan.reduce((m, p) => Math.max(m, p.click), 0);
    const titre = titreDe(el) || `Diapo ${numero}`;
    const altFixe = blanc(attr(el, "data-diapo-alt"));
    const altDe = (k: number) => {
      if (altFixe) return couper(altFixe);
      const cache = new Set(etapes.filter((e) => (appuiDe.get(e) ?? 0) > k));
      const texte = texteVisible(el, cache);
      // Le titre en tête, sans le répéter s'il ouvre déjà le texte.
      return couper(texte.toLowerCase().startsWith(titre.toLowerCase()) ? texte : `${titre}. ${texte}`.trim());
    };
    const ks = o.contenu === "diapos" ? [appuis] : Array.from({ length: appuis + 1 }, (_, k) => k);
    const etats: EtatExport[] = ks.map((k) => ({ appuis: k, dernier: k === appuis, alt: altDe(k) }));
    const medias: MediaExport[] = [];
    for (const m of el.querySelectorAll("img[src], video, iframe[data-diapo-live]")) {
      const tag = m.tagName.toUpperCase();
      if (tag === "IMG") medias.push({ genre: "image", src: attr(m, "src") ?? "", alt: blanc(attr(m, "alt")) });
      else if (tag === "VIDEO") medias.push({ genre: "video", src: attr(m, "src") ?? "", alt: blanc(attr(m, "aria-label") || attr(m, "title")) });
      else medias.push({ genre: "page", src: attr(m, "data-src") ?? "", alt: blanc(attr(m, "title")) });
    }
    if (medias.some((m) => m.genre === "video")) avertissements.push(`diapo ${numero} (${titre}) : vidéo exportée en image fixe`);
    if (medias.some((m) => m.genre === "page")) avertissements.push(`diapo ${numero} (${titre}) : page vivante exportée en image fixe`);
    const d = Number.parseFloat(attr(el, "data-duree") ?? "");
    diapos.push({
      numero,
      index,
      titre,
      notes: notesDe(el),
      transition,
      duree: Number.isFinite(d) && d > 0 ? d : null,
      section,
      masquee,
      appuis,
      etats,
      medias,
    });
  });
  const visee = Number.parseFloat(attr(racine, "data-duree-visee") ?? "");
  const titreDoc = blanc(doc?.querySelector("title")?.textContent) || blanc(attr(racine, "aria-label")) || diapos[0]?.titre || "Diaporama";
  return {
    titre: titreDoc,
    langue: (htmlDe(doc) && attr(htmlDe(doc)!, "lang")) || "fr",
    description: blanc(attr(doc?.querySelector('meta[name="description"]') ?? racine, "content")),
    transition: defaut,
    dureeVisee: Number.isFinite(visee) && visee > 0 ? visee : null,
    diapos,
    nbEtats: diapos.reduce((n, d) => n + d.etats.length, 0),
    avertissements,
  };
}

/** Le nom de fichier d'un état : `d03-e1` (diapo 3, après un appui). */
export const nomEtat = (d: Pick<DiapoExport, "numero">, e: Pick<EtatExport, "appuis">) => `d${String(d.numero).padStart(2, "0")}-e${e.appuis}`;
