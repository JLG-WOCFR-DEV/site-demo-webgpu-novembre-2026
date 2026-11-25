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
 *   - `v` monte quand la forme change ; `MIGRATIONS[v]` passe de v à v + 1 ;
 *   - forme courte `{ "v": 1, "tailles": { "diapos": 240 } }` (sans `racine`) : le défaut, avec ces tailles (bornées) —
 *     c'est ce qu'écrit la `conversion` d'une ancienne clé de largeur (src/registre/stockage.ts), sans rien connaître
 *     de l'arbre ;
 *   - étroit (`etroit`, facultatif) : sous `seuil` px de large, un seul panneau à la fois, choisi par des onglets
 *     (groupe `etroit.groupe` de `onglets`, une vue par enfant de la racine) ; tailles et replis sont gardés pour le
 *     retour au large. Le choix de la vue est gardé comme les autres onglets.
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

/** Une vue du mode étroit : un enfant de la racine (panneau ou découpe), son nom et son icône (src/studio/icones.ts). */
export type Vue = { id: string; libelle: string; icone: string };
export type Etroit = { seuil: number; groupe: string; vues: readonly Vue[] };
export type Schema = { defaut: MiseEnPage; bornes: Bornes; onglets: OngletsPossibles; etroit?: Etroit };
export type Mode = "large" | "etroit";

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
  if (o.racine === undefined && o.tailles && typeof o.tailles === "object" && !Array.isArray(o.tailles)) {
    // Forme courte (migration d'une ancienne clé) : le défaut, avec ces tailles.
    let mep = copie(s.defaut);
    for (const [id, t] of Object.entries(o.tailles as Record<string, unknown>)) {
      if (tailleDe(mep, id) === null) {
        corrections.push(`${id} : pas un panneau de taille fixe, ignoré`);
        continue;
      }
      if (typeof t !== "number" || !Number.isFinite(t)) {
        corrections.push(`${id} : taille illisible, défaut`);
        continue;
      }
      const b = borne(s.bornes[id], t);
      if (b !== Math.round(t)) corrections.push(`${id} : ${Math.round(t)} px ramené à ${b} px`);
      mep = fixerTaille(mep, id, b, s.bornes);
    }
    return { mep, corrections };
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

/* ───────────────────────── Mode étroit ───────────────────────── */

/** Large ou étroit, pour une largeur de fenêtre (CSS px). */
export function modeDe(s: Schema, largeur: number): Mode {
  return s.etroit && largeur <= s.etroit.seuil ? "etroit" : "large";
}

/** La vue montrée en mode étroit (la première si rien n'est choisi). */
export function vueDe(m: MiseEnPage, s: Schema): string {
  if (!s.etroit) return "";
  const v = m.onglets[s.etroit.groupe];
  return v && s.etroit.vues.some((x) => x.id === v) ? v : s.etroit.vues[0]!.id;
}

/** Les panneaux montrés : en large, tous sauf les repliés ; en étroit, ceux de la vue choisie (repliés compris). */
export function panneauxMontres(m: MiseEnPage, s: Schema, mode: Mode): string[] {
  if (mode === "large" || !s.etroit) return panneauxDe(m.racine).filter((p) => !m.replies.includes(p));
  const v = vueDe(m, s);
  const n = m.racine.type === "decoupe" ? m.racine.enfants.find((e) => e.id === v) : m.racine;
  return n ? panneauxDe(n) : [];
}

/** La vue voisine (flèches du clavier dans les onglets), en boucle. */
export function vueVoisine(s: Schema, actuelle: string, pas: number): string {
  const vs = s.etroit?.vues ?? [];
  if (!vs.length) return actuelle;
  const i = Math.max(0, vs.findIndex((v) => v.id === actuelle));
  return vs[(((i + pas) % vs.length) + vs.length) % vs.length]!.id;
}

/** Vérifie un schéma d'application : le plan, les bornes (min ≤ défaut ≤ max), les vues du mode étroit. */
export function verifierSchema(s: Schema): string[] {
  const fautes = verifierPlan(s.defaut);
  const fixes = new Set<string>();
  for (const d of decoupesDe(s.defaut.racine)) d.enfants.forEach((e, j) => d.tailles[j] !== null && fixes.add(e.id));
  for (const id of fixes) {
    const b = s.bornes[id];
    if (!b) fautes.push(`${id} : taille fixe sans bornes`);
    else {
      const t = tailleDe(s.defaut, id)!;
      if (!(b.min <= t && t <= b.max)) fautes.push(`${id} : défaut ${t} hors de [${b.min}, ${b.max}]`);
      if (b.defaut !== undefined && b.defaut !== t) fautes.push(`${id} : bornes.defaut ${b.defaut} ≠ plan ${t}`);
    }
  }
  if (s.etroit) {
    const e = s.etroit;
    const enfants = s.defaut.racine.type === "decoupe" ? s.defaut.racine.enfants.map((x) => x.id) : [s.defaut.racine.id];
    const ids = e.vues.map((v) => v.id);
    if (ids.join() !== enfants.join()) fautes.push(`étroit : une vue par enfant de la racine, dans l'ordre (${enfants.join(", ")})`);
    if ((s.onglets[e.groupe] ?? []).join() !== ids.join()) fautes.push(`étroit : onglets.${e.groupe} doit lister les vues`);
    if (!(e.seuil > 0)) fautes.push("étroit : seuil > 0");
  }
  for (const [g, v] of Object.entries(s.defaut.onglets)) if (!s.onglets[g]?.includes(v)) fautes.push(`onglet par défaut « ${v} » inconnu dans ${g}`);
  return fautes;
}

/* ───────────────────────── Les trois éditeurs (E8) ───────────────────────── */

/** Sous ce seuil (une tablette en portrait, un téléphone), les éditeurs passent en onglets. */
export const SEUIL_ETROIT = 860;

const trois = (o: { gauche: Noeud; tailles: [number, number]; onglets?: Record<string, string> }): MiseEnPage => ({
  v: VERSION,
  racine: { type: "decoupe", id: "corps", sens: "ligne", enfants: [o.gauche, { type: "panneau", id: "apercu" }, { type: "panneau", id: "inspecteur" }], tailles: [o.tailles[0], null, o.tailles[1]] },
  onglets: { vue: "apercu", ...(o.onglets ?? {}) },
  replies: [],
});

/**
 * Créateur de diaporama : diapos (200 px) | aperçu | inspecteur (300 px). La taille des diapos reprend l'ancienne clé
 * `presse:diapo-createur.largeur@1` (« 240px », bornée autrefois à [130, moitié de la fenêtre]).
 */
export const SCHEMA_DIAPO_CREATEUR: Schema = {
  defaut: trois({ gauche: { type: "panneau", id: "diapos" }, tailles: [200, 300] }),
  bornes: { diapos: { min: 130, max: 640, defaut: 200 }, inspecteur: { min: 240, max: 560, defaut: 300 } },
  onglets: { vue: ["diapos", "apercu", "inspecteur"] },
  etroit: {
    seuil: SEUIL_ETROIT,
    groupe: "vue",
    vues: [
      { id: "diapos", libelle: "Diapos", icone: "pages" },
      { id: "apercu", libelle: "Aperçu", icone: "bureau" },
      { id: "inspecteur", libelle: "Réglages", icone: "reglages" },
    ],
  },
};

/** Vitrine : sections (300 px) | aperçu | inspecteur (340 px, onglets Section / Style). */
export const SCHEMA_VITRINE: Schema = {
  defaut: trois({ gauche: { type: "panneau", id: "sections" }, tailles: [300, 340], onglets: { inspecteur: "section" } }),
  bornes: { sections: { min: 220, max: 520, defaut: 300 }, inspecteur: { min: 280, max: 600, defaut: 340 } },
  onglets: { vue: ["sections", "apercu", "inspecteur"], inspecteur: ["section", "style"] },
  etroit: {
    seuil: SEUIL_ETROIT,
    groupe: "vue",
    vues: [
      { id: "sections", libelle: "Sections", icone: "pages" },
      { id: "apercu", libelle: "Aperçu", icone: "bureau" },
      { id: "inspecteur", libelle: "Réglages", icone: "reglages" },
    ],
  },
};

/**
 * Créateur : à gauche, une colonne pages (160 px) / calques (souple) ; puis l'aperçu ; l'inspecteur (312 px, onglets
 * Bloc / Site). L'onglet de gauche (Calques / Ajouter) est gardé aussi.
 */
export const SCHEMA_CREATEUR: Schema = {
  defaut: trois({
    gauche: { type: "decoupe", id: "gauche", sens: "colonne", enfants: [{ type: "panneau", id: "pages" }, { type: "panneau", id: "calques" }], tailles: [160, null] },
    tailles: [272, 312],
    onglets: { gauche: "layers", inspecteur: "block" },
  }),
  bornes: { gauche: { min: 220, max: 480, defaut: 272 }, pages: { min: 72, max: 480, defaut: 160 }, inspecteur: { min: 260, max: 560, defaut: 312 } },
  onglets: { vue: ["gauche", "apercu", "inspecteur"], gauche: ["layers", "add"], inspecteur: ["block", "page"] },
  etroit: {
    seuil: SEUIL_ETROIT,
    groupe: "vue",
    vues: [
      { id: "gauche", libelle: "Calques", icone: "calques" },
      { id: "apercu", libelle: "Aperçu", icone: "bureau" },
      { id: "inspecteur", libelle: "Réglages", icone: "reglages" },
    ],
  },
};
