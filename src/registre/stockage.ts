/**
 * Registre du stockage du navigateur — l'inventaire des clés `localStorage` / `sessionStorage` du dépôt, un accès
 * protégé (try/catch : navigation privée, stockage plein ou bloqué, cadre sans droit), un préfixe et une version par
 * clé, et la migration des anciennes clés vers les nouvelles, sans perte. Pur : sous Node, on passe un faux stockage
 * (stockage.test.ts) ; en page, `localStorage` par défaut.
 *
 * Forme d'une clé neuve : `presse:<domaine>.<nom>@<version>` (ex. `presse:diapo-createur.notes@1`). Une version de
 * plus quand la FORME de la valeur change (on déclare alors l'ancienne clé dans `anciennes`, avec une `conversion`).
 *
 * Migration : paresseuse et idempotente. À la première lecture d'une clé neuve absente, la première ancienne clé
 * présente est recopiée (convertie au besoin) dans la neuve, PUIS retirée — seulement si l'écriture a réussi. Une clé
 * neuve déjà présente n'est jamais écrasée. `migrerTout()` fait le même travail d'un coup (essais, outil).
 *
 * Les clés que l'on ne renomme pas sont inventoriées dans `GARDEES` (src/registre/stockage-inventaire.ts, hors du
 * code chargé par les pages, comme le rôle de chaque clé), avec la raison : un script en tête de page qui
 * les lit avant tout module (presse/build/head.ts, flight.ts), l'export autonome des boutiques (vitrine/autonome.js,
 * qui tourne sur un autre site), ou un document partagé par trois modules (`presse-createur:v1`). Le test vérifie que
 * chaque appel à `localStorage` / `sessionStorage` du dépôt nomme une clé de cet inventaire.
 */

export type Portee = "local" | "session";

/** Ce qu'il faut d'un `Storage` (tests : une Map habillée). */
export type Magasin = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type Cle = {
  readonly domaine: string;
  readonly nom: string;
  readonly version: number;
  readonly portee: Portee;
  /** Les anciennes clés, de la plus récente à la plus vieille. */
  readonly anciennes: readonly string[];
  /** Convertit une valeur ancienne (chaîne brute) vers la forme neuve ; `null` : abandonnée. Défaut : telle quelle. */
  readonly conversion?: (ancienne: string, cle: string) => string | null;
  /** La clé complète (`presse:domaine.nom@v`). */
  readonly texte: string;
};

const PREFIXE = "presse:";
const FORME = /^[a-z][a-z0-9-]*$/;

/** Déclare une clé neuve. */
export function cle(o: { domaine: string; nom: string; version?: number; portee?: Portee; anciennes?: readonly string[]; conversion?: Cle["conversion"] }): Cle {
  if (!FORME.test(o.domaine) || !FORME.test(o.nom)) throw new Error(`stockage : domaine « ${o.domaine} » ou nom « ${o.nom} » mal formé (a-z, 0-9, -)`);
  const version = o.version ?? 1;
  if (!Number.isInteger(version) || version < 1) throw new Error(`stockage : version ${version} (entier ≥ 1)`);
  return {
    domaine: o.domaine,
    nom: o.nom,
    version,
    portee: o.portee ?? "local",
    anciennes: o.anciennes ?? [],
    conversion: o.conversion,
    texte: `${PREFIXE}${o.domaine}.${o.nom}@${version}`,
  };
}

/* ───────────────────────── Inventaire ───────────────────────── */

/** Les clés gérées par ce module (lecture, écriture, migration) ; ce que chacune garde : stockage-inventaire.ts. */
export const CLES = {
  navRecents: cle({ domaine: "nav", nom: "recents" }),
  navTheme: cle({ domaine: "nav", nom: "theme" }),
  coqueStudioEffet: cle({ domaine: "coque", nom: "studio-effet" }),
  couloirAttributs: cle({ domaine: "couloir", nom: "attributs", anciennes: ["couloir:attributs"] }),
  logosInstantanes: cle({ domaine: "logos", nom: "instantanes", anciennes: ["logos:instantanes"] }),
  diapoNotes: cle({ domaine: "diapo-createur", nom: "notes", anciennes: ["presse-diapo-createur:notes"] }),
  diapoBande: cle({ domaine: "diapo-createur", nom: "bande", anciennes: ["presse-diapo-createur:bande"] }),
  diapoLargeur: cle({ domaine: "diapo-createur", nom: "largeur", anciennes: ["presse-diapo-createur:largeur"] }),
  diapoExport: cle({ domaine: "diapo-createur", nom: "export", anciennes: ["presse-diapo-createur:export"] }),
  orbiteCourant: cle({ domaine: "orbite", nom: "courant", anciennes: ["presse:orbite:courant"] }),
  orbiteReglages: cle({ domaine: "orbite", nom: "reglages", anciennes: ["presse:orbite:reglages"] }),
} as const;


/* ───────────────────────── Accès ───────────────────────── */

/** Le stockage du navigateur, ou null (Node, cadre bloqué, cookies refusés : l'accesseur lui-même peut lever). */
export function magasinDe(portee: Portee): Magasin | null {
  try {
    const s = portee === "session" ? globalThis.sessionStorage : globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

const brut = {
  lire(m: Magasin | null, k: string): string | null {
    if (!m) return null;
    try {
      return m.getItem(k);
    } catch {
      return null;
    }
  },
  ecrire(m: Magasin | null, k: string, v: string): boolean {
    if (!m) return false;
    try {
      m.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
  retirer(m: Magasin | null, k: string): void {
    if (!m) return;
    try {
      m.removeItem(k);
    } catch {
      /* rien */
    }
  },
};

export type Migration = { cle: string; depuis: string; resultat: "recopiee" | "abandonnee" | "echec" };

/** Recopie dans `c` la première ancienne clé présente (si la neuve manque), puis retire l'ancienne. */
export function migrer(c: Cle, m: Magasin | null = magasinDe(c.portee)): Migration | null {
  if (!m || !c.anciennes.length || brut.lire(m, c.texte) !== null) return null;
  for (const ancienne of c.anciennes) {
    const v = brut.lire(m, ancienne);
    if (v === null) continue;
    const neuve = c.conversion ? c.conversion(v, ancienne) : v;
    if (neuve === null) {
      brut.retirer(m, ancienne);
      return { cle: c.texte, depuis: ancienne, resultat: "abandonnee" };
    }
    // Sans perte : l'ancienne n'est retirée que si la neuve est bien écrite (et relue).
    if (!brut.ecrire(m, c.texte, neuve) || brut.lire(m, c.texte) !== neuve) return { cle: c.texte, depuis: ancienne, resultat: "echec" };
    for (const a of c.anciennes) brut.retirer(m, a);
    return { cle: c.texte, depuis: ancienne, resultat: "recopiee" };
  }
  return null;
}

/** Toutes les migrations de l'inventaire (essais ; en page, chaque lecture migre déjà sa clé). */
export function migrerTout(m?: Magasin | null): Migration[] {
  const out: Migration[] = [];
  for (const c of Object.values(CLES)) {
    const r = migrer(c, m === undefined ? magasinDe(c.portee) : m);
    if (r) out.push(r);
  }
  return out;
}

/** Lit une clé (chaîne brute), après migration ; null si absente ou stockage indisponible. */
export function lire(c: Cle, m: Magasin | null = magasinDe(c.portee)): string | null {
  migrer(c, m);
  const v = brut.lire(m, c.texte);
  // Une ancienne clé que la migration n'a pas pu recopier (stockage plein) reste lisible.
  if (v === null) for (const a of c.anciennes) {
    const x = brut.lire(m, a);
    if (x !== null) return c.conversion ? c.conversion(x, a) : x;
  }
  return v;
}

/** Écrit une clé ; faux si le stockage refuse (la valeur vaut alors pour la visite). */
export function ecrire(c: Cle, v: string, m: Magasin | null = magasinDe(c.portee)): boolean {
  return brut.ecrire(m, c.texte, v);
}

/** Retire une clé (et ses anciennes). */
export function retirer(c: Cle, m: Magasin | null = magasinDe(c.portee)): void {
  brut.retirer(m, c.texte);
  for (const a of c.anciennes) brut.retirer(m, a);
}

/** Lit du JSON ; `defaut` si absent, illisible, ou refusé par `garde`. */
export function lireJson<T>(c: Cle, defaut: T, garde?: (v: unknown) => v is T, m?: Magasin | null): T {
  const s = lire(c, m === undefined ? magasinDe(c.portee) : m);
  if (s === null) return defaut;
  try {
    const v = JSON.parse(s) as unknown;
    return garde && !garde(v) ? defaut : (v as T);
  } catch {
    return defaut;
  }
}

export function ecrireJson(c: Cle, v: unknown, m?: Magasin | null): boolean {
  let s: string;
  try {
    s = JSON.stringify(v);
  } catch {
    return false;
  }
  return ecrire(c, s, m === undefined ? magasinDe(c.portee) : m);
}

/** Un faux stockage (tests, ou repli en mémoire). `refuse` : setItem lève (stockage plein). */
export function magasinMemoire(init: Record<string, string> = {}, refuse = false): Magasin & { donnees: Map<string, string> } {
  const donnees = new Map(Object.entries(init));
  return {
    donnees,
    getItem: (k) => (donnees.has(k) ? donnees.get(k)! : null),
    setItem: (k, v) => {
      if (refuse) throw new Error("QuotaExceededError");
      donnees.set(k, String(v));
    },
    removeItem: (k) => void donnees.delete(k),
  };
}
