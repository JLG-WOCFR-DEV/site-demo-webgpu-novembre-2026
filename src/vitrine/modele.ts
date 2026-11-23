/**
 * Vitrine — le modèle : créer, valider, transformer, sérialiser un plan de page. Fonctions pures, sans DOM ;
 * l'éditeur s'en sert pour chaque action (et garde les états successifs pour annuler / rétablir).
 *
 * Format JSON : `{ format: "presse-vitrine", v: 2, depuis, plan: { marque, sections }, jetons }`.
 * Versions :
 *   v1 (premier essai) : `{ v: 1, marque, sections: [{ type, style, options }] }` — sans ids, la variante s'appelait
 *      « style », les réglages « options » ; jetons absents ; la collection « colonnes » était un texte.
 *   v2 : ce fichier. `migrer()` lit les deux.
 */
import { definition, definitions } from "./bibliotheque.ts";
import { validerReglages, valeursParDefaut, type Connu, type Reglages } from "./schema.ts";
import { IDS_CATEGORIES, IDS_COLLECTIONS, IDS_PHOTOS, IDS_PRODUITS } from "./donnees.ts";
import { JETONS_DEFAUT, lireJetons, type Jetons } from "./jetons.ts";
import type { DocumentVitrine, Plan, Section } from "./types.ts";

export const FORMAT = "presse-vitrine" as const;
export const VERSION = 2;

/** Ce que la validation sait des données (sources des sélecteurs, photothèque). */
export const CONNU: Connu = { produits: IDS_PRODUITS, categories: IDS_CATEGORIES, collections: IDS_COLLECTIONS, photos: IDS_PHOTOS };

/* ───────── Identifiants ───────── */

/** Un id court, unique dans le plan (`hero-2`, `collection-3`). */
export function nouvelId(plan: Plan | readonly Section[], type: string): string {
  const ids = new Set((Array.isArray(plan) ? plan : (plan as Plan).sections).map((s) => s.id));
  let i = 1;
  while (ids.has(`${type}-${i}`)) i++;
  return `${type}-${i}`;
}

/* ───────── Création et validation ───────── */

/** Une section neuve d'un type, avec sa première variante (ou celle donnée) et les réglages par défaut. */
export function creerSection(type: string, plan: Plan | readonly Section[] = [], variante?: string, reglages: Reglages = {}): Section {
  const d = definition(type);
  if (!d) throw new Error(`Type de section inconnu : « ${type} ».`);
  const v = variante && d.variantes.some((x) => x.id === variante) ? variante : d.variantes[0]!.id;
  return { id: nouvelId(plan, type), type, variante: v, reglages: validerReglages(d.champs, { ...valeursParDefaut(d.champs), ...reglages }, CONNU).reglages };
}

export interface Rapport {
  /** Ce qui a été corrigé, section par section. */
  corrections: string[];
  /** Sections écartées (type inconnu). */
  ecartees: string[];
}

/** Une section rendue valide (variante connue, réglages corrigés) ; `null` si son type est inconnu. */
export function validerSection(brut: unknown, ids: Set<string>, rapport?: Rapport): Section | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const d = typeof o.type === "string" ? definition(o.type) : undefined;
  if (!d) {
    rapport?.ecartees.push(String(o.type ?? "?"));
    return null;
  }
  let id = typeof o.id === "string" && /^[a-z0-9-]{1,40}$/.test(o.id) && !ids.has(o.id) ? o.id : "";
  if (!id) {
    let i = 1;
    while (ids.has(`${d.type}-${i}`)) i++;
    id = `${d.type}-${i}`;
  }
  ids.add(id);
  const variante = typeof o.variante === "string" && d.variantes.some((v) => v.id === o.variante) ? o.variante : d.variantes[0]!.id;
  if (variante !== o.variante && o.variante !== undefined) rapport?.corrections.push(`${id} : variante « ${String(o.variante)} » inconnue, « ${variante} » prise`);
  const r = validerReglages(d.champs, o.reglages, CONNU);
  for (const c of r.corrections) rapport?.corrections.push(`${id} · ${c}`);
  const s: Section = { id, type: d.type, variante, reglages: r.reglages };
  if (o.masque === true) s.masque = true;
  return s;
}

/** Un plan rendu valide : sections inconnues écartées, ids uniques, une seule section par type « unique ». */
export function validerPlan(brut: unknown, rapport: Rapport = { corrections: [], ecartees: [] }): Plan {
  const o = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const ids = new Set<string>();
  const vus = new Set<string>();
  const sections: Section[] = [];
  for (const x of Array.isArray(o.sections) ? o.sections : []) {
    const s = validerSection(x, ids, rapport);
    if (!s) continue;
    if (definition(s.type)?.unique) {
      if (vus.has(s.type)) {
        rapport.corrections.push(`${s.id} : un seul « ${definition(s.type)!.nom} » par page, doublon retiré`);
        continue;
      }
      vus.add(s.type);
    }
    sections.push(s);
  }
  const marque = typeof o.marque === "string" && o.marque.trim() ? o.marque.trim().slice(0, 40) : "Boutique";
  return { marque, sections };
}

/* ───────── Opérations (pures : rendent un nouveau plan) ───────── */

const avec = (p: Plan, sections: Section[]): Plan => ({ ...p, sections });

/** Ajoute une section : en haut / en bas selon son type (en-tête, pied…), sinon après `apres` (ou à la fin du contenu). */
export function ajouterSection(p: Plan, s: Section, apres?: string): Plan {
  const d = definition(s.type);
  if (d?.unique && p.sections.some((x) => x.type === s.type)) return p;
  const xs = p.sections.slice();
  if (d?.place === "haut") {
    // L'annonce tout en haut ; l'en-tête après l'annonce.
    const i = s.type === "annonce" ? 0 : xs.findIndex((x) => x.type !== "annonce");
    xs.splice(i < 0 ? xs.length : i, 0, s);
  } else if (d?.place === "bas") {
    const iPied = xs.findIndex((x) => x.type === "pied");
    xs.splice(s.type === "pied" || iPied < 0 ? xs.length : iPied + (s.type === "popup" ? 1 : 0), 0, s);
  } else {
    let i = apres ? xs.findIndex((x) => x.id === apres) + 1 : 0;
    if (i <= 0) {
      const iPied = xs.findIndex((x) => definition(x.type)?.place === "bas");
      i = iPied < 0 ? xs.length : iPied;
    }
    // Jamais au-dessus de l'en-tête ni sous le pied.
    const premier = xs.findIndex((x) => definition(x.type)?.place !== "haut");
    i = Math.max(i, premier < 0 ? xs.length : premier);
    xs.splice(i, 0, s);
  }
  return avec(p, xs);
}

export const retirerSection = (p: Plan, id: string): Plan => avec(p, p.sections.filter((s) => s.id !== id));

export function dupliquerSection(p: Plan, id: string): Plan {
  const i = p.sections.findIndex((s) => s.id === id);
  const s = p.sections[i];
  if (!s || definition(s.type)?.unique) return p;
  const copie: Section = { ...structuredClone(s), id: nouvelId(p, s.type) };
  const xs = p.sections.slice();
  xs.splice(i + 1, 0, copie);
  return avec(p, xs);
}

export const basculerMasque = (p: Plan, id: string): Plan => avec(p, p.sections.map((s) => (s.id === id ? (s.masque ? (({ masque: _, ...x }) => x)(s) : { ...s, masque: true }) : s)));

/** Déplace une section de `de` à `vers` (rangs) ; refuse de passer une section de contenu au-dessus de l'en-tête. */
export function deplacerSection(p: Plan, de: number, vers: number): Plan {
  if (de === vers || de < 0 || vers < 0 || de >= p.sections.length || vers >= p.sections.length) return p;
  const xs = p.sections.slice();
  const [s] = xs.splice(de, 1);
  xs.splice(vers, 0, s!);
  return avec(p, xs);
}

/** Change la variante (les réglages communs sont gardés ; le schéma est le même pour toutes les variantes d'un type). */
export const changerVariante = (p: Plan, id: string, variante: string): Plan => avec(p, p.sections.map((s) => (s.id === id && definition(s.type)?.variantes.some((v) => v.id === variante) ? { ...s, variante } : s)));

/** Change un réglage (validé : la valeur passe par le schéma). */
export function changerReglage(p: Plan, id: string, cle: string, valeur: unknown): Plan {
  return avec(
    p,
    p.sections.map((s) => {
      if (s.id !== id) return s;
      const d = definition(s.type)!;
      return { ...s, reglages: validerReglages(d.champs, { ...s.reglages, [cle]: valeur }, CONNU).reglages };
    }),
  );
}

/* ───────── Documents : sérialisation, migration ───────── */

export function documentDe(plan: Plan, jetons: Jetons, depuis?: string): DocumentVitrine {
  return { format: FORMAT, v: VERSION, depuis, plan, jetons };
}

/** Lit un document v1 ou v2 ; lève une erreur en français si ce n'est pas un document de vitrine. */
export function migrer(brut: unknown): { document: DocumentVitrine; rapport: Rapport & { depuisVersion: number } } {
  const o = (typeof brut === "string" ? JSON.parse(brut) : brut) as Record<string, unknown> | null;
  if (!o || typeof o !== "object") throw new Error("Document illisible : un objet JSON est attendu.");
  if (o.format !== undefined && o.format !== FORMAT) throw new Error(`Ce n'est pas un document Vitrine (format « ${String(o.format)} »).`);
  const v = o.v ?? 1;
  if (v !== 1 && v !== 2) throw new Error(`Version inconnue : ${String(v)} (attendu : 1 ou 2).`);
  const rapport: Rapport & { depuisVersion: number } = { corrections: [], ecartees: [], depuisVersion: v as number };
  let planBrut: unknown;
  let jetonsBrut: unknown;
  if (v === 1) {
    // v1 : sections à la racine, « style » et « options » ; les colonnes en texte (« 4 »).
    const secs = Array.isArray(o.sections) ? o.sections : [];
    planBrut = {
      marque: o.marque,
      sections: secs.map((x) => {
        const s = (x ?? {}) as Record<string, unknown>;
        const opts = { ...((s.options as Record<string, unknown>) ?? {}) };
        if (typeof opts.colonnes === "string") opts.colonnes = Number(opts.colonnes);
        return { type: s.type, variante: s.style, reglages: opts };
      }),
    };
    jetonsBrut = o.jetons ?? {};
    rapport.corrections.push("document v1 converti en v2 (ids créés, « style » → variante, « options » → réglages)");
  } else {
    planBrut = o.plan;
    jetonsBrut = o.jetons;
  }
  const plan = validerPlan(planBrut, rapport);
  const j = lireJetons(jetonsBrut ?? {});
  for (const c of j.corrections) rapport.corrections.push(`jetons · ${c}`);
  return { document: documentDe(plan, j.jetons, typeof o.depuis === "string" ? o.depuis : undefined), rapport };
}

export const serialiser = (d: DocumentVitrine, indent = 2) => JSON.stringify(d, null, indent);

/** Pour un lien partageable : le document en base64url (dans le fragment `#v=`). */
export function encoder(d: DocumentVitrine): string {
  const o = new TextEncoder().encode(JSON.stringify(d));
  let s = "";
  for (const b of o) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decoder(b: string): DocumentVitrine {
  const s = atob(b.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b.length + 3) % 4));
  return migrer(new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)))).document;
}

/** Le résumé d'une section pour la liste de l'éditeur (« Hero · Diaporama »). */
export function resumeSection(s: Section): { nom: string; variante: string; icone: string } {
  const d = definition(s.type);
  const v = d?.variantes.find((x) => x.id === s.variante)?.nom ?? s.variante;
  // Une section titrée se reconnaît à son titre (« Nouveautés »), le type passe en sous-titre.
  const titre = typeof s.reglages.titre === "string" && s.reglages.titre.trim() && !["hero", "entete", "pied", "popup", "newsletter"].includes(s.type) ? s.reglages.titre.trim() : "";
  return { nom: titre || (d?.nom ?? s.type), variante: titre ? `${d?.nom ?? s.type} · ${v}` : v, icone: d?.icone ?? "point" };
}

export { definitions, JETONS_DEFAUT };
