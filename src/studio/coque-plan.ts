/**
 * Studio — le plan de la coque commune : une mise en page à panneaux (découpes, onglets, tailles, panneaux repliés)
 * décrite en JSON versionné, comme le lien `#v=` des réglages (src/studio/etat.ts). Pur (coque.test.ts) ; le DOM est
 * dans src/studio/coque.ts.
 *
 *   { "v": 1, "racine": { "type": "decoupe", "id": "corps", "sens": "ligne",
 *       "enfants": [ { "type": "panneau", "id": "centre" }, { "type": "panneau", "id": "inspecteur" } ],
 *       "tailles": [null, 328] },
 *     "onglets": { "code": "html" }, "replies": [] }
 *
 * Règles :
 *   - une découpe (`ligne` : côte à côte, `colonne` : l'un sous l'autre) a une taille par enfant, en pixels, et
 *     exactement UN enfant souple (`null`) qui prend le reste ;
 *   - les bornes (min, max, défaut) sont données par l'application, par panneau, pas par le JSON (un JSON ancien ou
 *     retouché à la main est ramené dans les bornes, et la lecture dit ce qu'elle a corrigé) ;
 *   - un JSON d'une autre forme (panneaux inconnus ou manquants, version future) est refusé : on garde le défaut ;
 *   - `v` monte quand la forme change ; `MIGRATIONS[v]` passe de v à v + 1.
 */

export const VERSION = 1;

export type Panneau = { type: "panneau"; id: string };
export type Decoupe = { type: "decoupe"; id: string; sens: "ligne" | "colonne"; enfants: Noeud[]; tailles: (number | null)[] };
export type Noeud = Panneau | Decoupe;
export type MiseEnPage = {
  v: number;
  racine: Noeud;
  /** Groupe d'onglets → onglet choisi. */
  onglets: Record<string, string>;
  /** Panneaux repliés (taille 0, rouverts à leur taille). */
  replies: string[];
};
export type Bornes = Record<string, { min: number; max: number; defaut?: number }>;
/** Les onglets possibles par groupe (le premier est le défaut). */
export type OngletsPossibles = Record<string, readonly string[]>;

export type Schema = { defaut: MiseEnPage; bornes: Bornes; onglets: OngletsPossibles };

const MIGRATIONS: Record<number, (m: Record<string, unknown>) => Record<string, unknown>> = {};

export function panneauxDe(n: Noeud): string[] {
  return n.type === "panneau" ? [n.id] : n.enfants.flatMap(panneauxDe);
}
function decoupesDe(n: Noeud): Decoupe[] {
  return n.type === "panneau" ? [] : [n, ...n.enfants.flatMap(decoupesDe)];
}
const borne = (b: Bornes[string] | undefined, x: number) => (b ? Math.round(Math.min(b.max, Math.max(b.min, x))) : Math.round(x));
const copie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Vérifie un plan (défaut de l'application) : identifiants uniques, un seul enfant souple par découpe. */
export function verifierPlan(m: MiseEnPage): string[] {
  const fautes: string[] = [];
  const ids = [...panneauxDe(m.racine), ...decoupesDe(m.racine).map((d) => d.id)];
  if (new Set(ids).size !== ids.length) fautes.push("identifiants en double");
  for (const d of decoupesDe(m.racine)) {
    if (d.tailles.length !== d.enfants.length) fautes.push(`${d.id} : une taille par enfant`);
    if (d.tailles.filter((t) => t === null).length !== 1) fautes.push(`${d.id} : exactement un enfant souple (null)`);
    if (d.enfants.length < 2) fautes.push(`${d.id} : au moins deux enfants`);
  }
  return fautes;
}

/** Même arbre (types, ids, sens, enfants) que le défaut ? Les tailles peuvent différer. */
function memeForme(a: unknown, b: Noeud): boolean {
  const x = a as { type?: string; id?: string; sens?: string; enfants?: unknown[]; tailles?: unknown[] };
  if (!x || typeof x !== "object" || x.type !== b.type || x.id !== b.id) return false;
  if (b.type === "panneau") return true;
  if (x.sens !== b.sens || !Array.isArray(x.enfants) || x.enfants.length !== b.enfants.length || !Array.isArray(x.tailles) || x.tailles.length !== b.tailles.length) return false;
  return b.enfants.every((e, i) => memeForme(x.enfants![i], e));
}

/** Lit un JSON (chaîne ou objet) ; rend une mise en page valide et la liste de ce qui a été corrigé. */
export function lireMiseEnPage(brut: unknown, s: Schema): { mep: MiseEnPage; corrections: string[] } {
  const corrections: string[] = [];
  let o: Record<string, unknown> | null = null;
  try {
    o = (typeof brut === "string" ? JSON.parse(brut) : brut) as Record<string, unknown> | null;
  } catch {
    return { mep: copie(s.defaut), corrections: ["JSON illisible : mise en page par défaut"] };
  }
  if (!o || typeof o !== "object") return { mep: copie(s.defaut), corrections: brut == null ? [] : ["forme inconnue : mise en page par défaut"] };
  let v = typeof o.v === "number" ? o.v : 0;
  if (v > VERSION) return { mep: copie(s.defaut), corrections: [`version ${v} plus récente que ce Studio (${VERSION}) : mise en page par défaut`] };
  while (v < VERSION) {
    const f = MIGRATIONS[v];
    if (!f) return { mep: copie(s.defaut), corrections: [`version ${v} sans migration : mise en page par défaut`] };
    o = f(o);
    v++;
  }
  if (!memeForme(o.racine, s.defaut.racine)) return { mep: copie(s.defaut), corrections: ["panneaux différents de ceux du Studio : mise en page par défaut"] };
  const mep = copie(s.defaut);
  // Les tailles, une à une, ramenées dans les bornes du panneau ; l'enfant souple reste souple.
  const lues = decoupesDe(o.racine as Noeud);
  decoupesDe(mep.racine).forEach((d, i) => {
    d.enfants.forEach((e, j) => {
      if (d.tailles[j] === null) return;
      const t = lues[i]!.tailles[j];
      const id = e.id;
      if (typeof t !== "number" || !Number.isFinite(t)) return void corrections.push(`${id} : taille illisible, défaut`);
      const b = borne(s.bornes[id], t);
      if (b !== Math.round(t)) corrections.push(`${id} : ${Math.round(t)} px ramené à ${b} px`);
      d.tailles[j] = b;
    });
  });
  const ong = (o.onglets ?? {}) as Record<string, unknown>;
  for (const [g, possibles] of Object.entries(s.onglets)) {
    const x = ong[g];
    if (x === undefined) continue;
    if (typeof x === "string" && possibles.includes(x)) mep.onglets[g] = x;
    else corrections.push(`onglet « ${String(x)} » inconnu dans ${g}`);
  }
  const panneaux = new Set(panneauxDe(mep.racine));
  mep.replies = Array.isArray(o.replies) ? [...new Set((o.replies as unknown[]).filter((x): x is string => typeof x === "string" && panneaux.has(x)))] : [];
  return { mep, corrections };
}

export const serialiser = (m: MiseEnPage): string => JSON.stringify(m);

function trouverDecoupe(m: MiseEnPage, id: string): Decoupe | undefined {
  return decoupesDe(m.racine).find((d) => d.id === id);
}

/**
 * Tire la poignée `i` (entre l'enfant i et i + 1) de `delta` px : c'est l'enfant de taille fixe voisin qui change
 * (s'il est après la poignée, tirer vers la droite le rétrécit). Rend une copie.
 */
export function redimensionner(m: MiseEnPage, decoupe: string, i: number, delta: number, bornes: Bornes): MiseEnPage {
  const n = copie(m);
  const d = trouverDecoupe(n, decoupe);
  if (!d || i < 0 || i >= d.enfants.length - 1) return n;
  const [a, b] = [i, i + 1];
  const cible = d.tailles[b] !== null ? b : d.tailles[a] !== null ? a : -1;
  if (cible < 0) return n;
  const id = d.enfants[cible]!.id;
  const signe = cible === b ? -1 : 1;
  d.tailles[cible] = borne(bornes[id], (d.tailles[cible] as number) + signe * delta);
  n.replies = n.replies.filter((x) => x !== id);
  return n;
}

/** Fixe la taille d'un panneau (clavier : Début / Fin, double-clic : défaut). */
export function fixerTaille(m: MiseEnPage, panneau: string, taille: number, bornes: Bornes): MiseEnPage {
  const n = copie(m);
  for (const d of decoupesDe(n.racine)) d.enfants.forEach((e, j) => {
    if (e.id === panneau && d.tailles[j] !== null) d.tailles[j] = borne(bornes[panneau], taille);
  });
  return n;
}

export function tailleDe(m: MiseEnPage, panneau: string): number | null {
  if (m.replies.includes(panneau)) return 0;
  for (const d of decoupesDe(m.racine)) {
    const j = d.enfants.findIndex((e) => e.id === panneau);
    if (j >= 0) return d.tailles[j] ?? null;
  }
  return null;
}

export function choisirOnglet(m: MiseEnPage, groupe: string, onglet: string, possibles: OngletsPossibles): MiseEnPage {
  if (!possibles[groupe]?.includes(onglet)) return m;
  return { ...copie(m), onglets: { ...m.onglets, [groupe]: onglet } };
}

export function basculerRepli(m: MiseEnPage, panneau: string): MiseEnPage {
  const n = copie(m);
  n.replies = n.replies.includes(panneau) ? n.replies.filter((x) => x !== panneau) : [...n.replies, panneau];
  return n;
}

/** Pour un lien : base64url du JSON (`#coque=…`). */
export function encoder(m: MiseEnPage): string {
  const s = serialiser(m);
  const b = btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decoder(t: string): unknown {
  try {
    const b = t.replace(/-/g, "+").replace(/_/g, "/");
    const s = new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/* ───────────────────────── Studio d'effet ───────────────────────── */

/** La mise en page de studio-effet.html : l'aperçu (souple) et l'inspecteur (328 px par défaut), les onglets du code. */
export const SCHEMA_STUDIO_EFFET: Schema = {
  defaut: {
    v: VERSION,
    racine: { type: "decoupe", id: "corps", sens: "ligne", enfants: [{ type: "panneau", id: "centre" }, { type: "panneau", id: "inspecteur" }], tailles: [null, 328] },
    onglets: { code: "html" },
    replies: [],
  },
  bornes: { inspecteur: { min: 260, max: 560, defaut: 328 } },
  onglets: { code: ["html", "json"] },
};
