/**
 * Vitrine — le schéma de réglages déclaratif.
 *
 * Un type de section déclare ses champs une fois ; ce schéma pilote :
 *   - les valeurs par défaut (`valeursParDefaut`) ;
 *   - la validation et la correction d'un réglage reçu (JSON importé, lien partagé, ancienne version) :
 *     `validerReglages` borne, arrondit au pas, remet le défaut d'une option inconnue, et dit ce qu'il a corrigé ;
 *   - l'inspecteur de l'éditeur (src/vitrine/inspecteur.ts), qui en déduit curseurs, segments, interrupteurs… ;
 *   - le rendu, qui lit des réglages déjà valides (jamais `undefined`).
 *
 * Sept genres de champs : curseur, selecteur, interrupteur, couleur, texte, image, liste (une liste d'éléments, chacun
 * décrit par son propre sous-schéma). Un champ peut ne valoir que pour certaines variantes, ou que si un autre champ a
 * une valeur donnée (`si`) : la condition est déclarative (sérialisable, testable), pas une fonction.
 *
 * Pur : ni DOM ni réseau (vitrine.test.ts).
 */

/** Les icônes de l'interface (src/vitrine/icones.ts) : un nom, pas un dessin. */
export type NomIcone = string;

export interface Option<V extends string = string> {
  valeur: V;
  libelle: string;
  icone?: NomIcone;
}

/** Un champ n'est montré (et lu par le rendu) que si la condition tient. */
export interface Condition {
  /** Seulement pour ces variantes. */
  variantes?: readonly string[];
  /** Seulement si le champ `champ` vaut l'une de `valeurs` (ou est vrai, sans `valeurs`). */
  champ?: string;
  valeurs?: readonly (string | number | boolean)[];
}

interface Base {
  cle: string;
  libelle: string;
  icone?: NomIcone;
  /** Une phrase d'aide (infobulle, `aria-describedby`). */
  aide?: string;
  /** Groupe de l'inspecteur (« Mise en page », « Cartes »…). */
  groupe?: string;
  si?: Condition;
}

export interface ChampCurseur extends Base {
  type: "curseur";
  min: number;
  max: number;
  pas: number;
  defaut: number;
  unite?: string;
}
export interface ChampSelecteur extends Base {
  type: "selecteur";
  options: readonly Option[];
  defaut: string;
  /** `segments` (boutons à icônes, ≤ 5 options) ou `liste` (menu déroulant). */
  affichage?: "segments" | "liste";
  /** Options tirées des données (produits, catégories, photos) : `options` sert alors de repli. */
  source?: "produits" | "categories" | "collections";
}
export interface ChampInterrupteur extends Base {
  type: "interrupteur";
  defaut: boolean;
}
export interface ChampCouleur extends Base {
  type: "couleur";
  defaut: string;
}
export interface ChampTexte extends Base {
  type: "texte";
  defaut: string;
  max?: number;
  multiligne?: boolean;
  /** Vide permis (défaut : oui). */
  requis?: boolean;
}
export interface ChampImage extends Base {
  type: "image";
  /** Une clé de la photothèque (src/vitrine/donnees.ts, PHOTOTHEQUE), ou vide. */
  defaut: string;
}
export interface ChampListe extends Base {
  type: "liste";
  element: readonly Champ[];
  min: number;
  max: number;
  defaut: readonly Record<string, Valeur>[];
  /** Le champ de l'élément qui le nomme dans l'inspecteur. */
  titre?: string;
}

export type Champ = ChampCurseur | ChampSelecteur | ChampInterrupteur | ChampCouleur | ChampTexte | ChampImage | ChampListe;
export type Valeur = number | string | boolean | Record<string, Valeur>[];
export type Reglages = Record<string, Valeur>;

/** Ce que le schéma sait des données, pour valider les sources (`source`) et les images. */
export interface Connu {
  produits?: ReadonlySet<string>;
  categories?: ReadonlySet<string>;
  collections?: ReadonlySet<string>;
  photos?: ReadonlySet<string>;
}

export const HEX = /^#[0-9a-f]{6}$/i;

/* ───────── Défauts ───────── */

const copieListe = (l: readonly Record<string, Valeur>[]) => l.map((x) => ({ ...x }));

export function defautDe(c: Champ): Valeur {
  return c.type === "liste" ? copieListe(c.defaut) : c.defaut;
}

export function valeursParDefaut(champs: readonly Champ[]): Reglages {
  const r: Reglages = {};
  for (const c of champs) r[c.cle] = defautDe(c);
  return r;
}

/* ───────── Conditions ───────── */

export function conditionTient(si: Condition | undefined, reglages: Reglages, variante?: string): boolean {
  if (!si) return true;
  if (si.variantes && variante !== undefined && !si.variantes.includes(variante)) return false;
  if (si.champ !== undefined) {
    const v = reglages[si.champ];
    if (si.valeurs) return si.valeurs.includes(v as string | number | boolean);
    return Boolean(v);
  }
  return true;
}

/** Les champs visibles pour cette variante et ces réglages (l'inspecteur n'affiche qu'eux). */
export const champsVisibles = (champs: readonly Champ[], reglages: Reglages, variante?: string) => champs.filter((c) => conditionTient(c.si, reglages, variante));

/* ───────── Validation ───────── */

export interface Resultat {
  reglages: Reglages;
  /** Ce qui a été corrigé, en français (« colonnes : 9 ramené à 5 »). Vide si tout était bon. */
  corrections: string[];
}

const arrondiPas = (v: number, min: number, pas: number) => {
  const n = Math.round((v - min) / pas) * pas + min;
  // Les pas décimaux (0,1) laissent des queues binaires : on les coupe.
  const dec = (String(pas).split(".")[1] ?? "").length;
  return +n.toFixed(dec);
};

function validerChamp(c: Champ, brut: unknown, connu: Connu, chemin: string, corr: string[]): Valeur {
  const dire = (m: string) => corr.push(`${chemin} : ${m}`);
  switch (c.type) {
    case "curseur": {
      let v = typeof brut === "number" ? brut : typeof brut === "string" && brut.trim() !== "" ? Number(brut) : NaN;
      if (!Number.isFinite(v)) {
        if (brut !== undefined) dire(`valeur illisible, défaut ${c.defaut}`);
        return c.defaut;
      }
      const borne = Math.min(c.max, Math.max(c.min, v));
      if (borne !== v) dire(`${v} ramené à ${borne}`);
      v = arrondiPas(borne, c.min, c.pas);
      return Math.min(c.max, Math.max(c.min, v));
    }
    case "selecteur": {
      const permises = c.source ? connu[c.source] : undefined;
      // Une source sans liste connue (test, données pas encore là) : toute valeur non vide passe.
      const ok = typeof brut === "string" && (permises ? permises.has(brut) || c.options.some((o) => o.valeur === brut) : c.source ? brut !== "" : c.options.some((o) => o.valeur === brut));
      if (ok) return brut as string;
      if (brut !== undefined) dire(`« ${String(brut)} » inconnu, défaut « ${c.defaut} »`);
      return c.defaut;
    }
    case "interrupteur":
      if (typeof brut === "boolean") return brut;
      if (brut === "oui" || brut === "true" || brut === 1) return true;
      if (brut === "non" || brut === "false" || brut === 0) return false;
      if (brut !== undefined) dire(`ni vrai ni faux, défaut ${c.defaut ? "oui" : "non"}`);
      return c.defaut;
    case "couleur":
      if (typeof brut === "string" && HEX.test(brut)) return brut.toLowerCase();
      if (typeof brut === "string" && /^#[0-9a-f]{3}$/i.test(brut)) return ("#" + [...brut.slice(1)].map((x) => x + x).join("")).toLowerCase();
      if (brut !== undefined) dire(`couleur illisible, défaut ${c.defaut}`);
      return c.defaut;
    case "texte": {
      if (typeof brut !== "string") {
        if (brut !== undefined) dire("texte attendu, défaut remis");
        return c.defaut;
      }
      let t = c.multiligne ? brut : brut.replace(/\s*\n\s*/g, " ");
      if (c.max && t.length > c.max) {
        dire(`coupé à ${c.max} signes`);
        t = t.slice(0, c.max);
      }
      if (c.requis && !t.trim()) {
        dire("vide, défaut remis");
        return c.defaut;
      }
      return t;
    }
    case "image":
      if (typeof brut === "string" && (brut === "" || !connu.photos || connu.photos.has(brut))) return brut;
      if (brut !== undefined) dire(`image « ${String(brut)} » inconnue, défaut remis`);
      return c.defaut;
    case "liste": {
      if (!Array.isArray(brut)) {
        if (brut !== undefined) dire("liste attendue, défaut remis");
        return copieListe(c.defaut);
      }
      let items = brut.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
      if (items.length !== brut.length) dire(`${brut.length - items.length} élément(s) illisible(s) écarté(s)`);
      if (items.length > c.max) {
        dire(`${items.length} éléments, ${c.max} gardés`);
        items = items.slice(0, c.max);
      }
      const out = items.map((it, i) => validerObjet(c.element, it, connu, `${chemin}[${i + 1}]`, corr));
      while (out.length < c.min) {
        const d = c.defaut[out.length] ?? c.defaut[0];
        out.push(d ? { ...d } : valeursParDefaut(c.element));
        dire(`complétée à ${c.min} éléments`);
      }
      return out as Record<string, Valeur>[];
    }
  }
}

function validerObjet(champs: readonly Champ[], brut: Record<string, unknown>, connu: Connu, chemin: string, corr: string[]): Reglages {
  const r: Reglages = {};
  for (const c of champs) r[c.cle] = validerChamp(c, brut[c.cle], connu, chemin ? `${chemin}.${c.cle}` : c.cle, corr);
  return r;
}

/**
 * Les réglages d'une section, rendus valides : chaque champ du schéma présent (défaut s'il manque), clés inconnues
 * retirées (dites dans `corrections`), valeurs bornées et arrondies au pas.
 */
export function validerReglages(champs: readonly Champ[], brut: unknown, connu: Connu = {}): Resultat {
  const corrections: string[] = [];
  const o = brut && typeof brut === "object" && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {};
  if (brut !== undefined && o !== brut) corrections.push("réglages illisibles, défauts remis");
  const cles = new Set(champs.map((c) => c.cle));
  for (const k of Object.keys(o)) if (!cles.has(k)) corrections.push(`${k} : réglage inconnu, retiré`);
  return { reglages: validerObjet(champs, o, connu, "", corrections), corrections };
}

/** Vrai si les réglages sont déjà valides (aucune correction). */
export const sontValides = (champs: readonly Champ[], brut: unknown, connu: Connu = {}) => validerReglages(champs, brut, connu).corrections.length === 0;

/* ───────── Contrôle du schéma lui-même (pour les tests et le développement) ───────── */

/** Les incohérences d'un schéma : défaut hors bornes, option par défaut absente, clé en double, condition sur un champ inconnu. */
export function controlerSchema(champs: readonly Champ[], nom = "schéma"): string[] {
  const p: string[] = [];
  const vues = new Set<string>();
  for (const c of champs) {
    if (vues.has(c.cle)) p.push(`${nom}.${c.cle} : clé en double`);
    vues.add(c.cle);
    if (!c.libelle) p.push(`${nom}.${c.cle} : sans libellé`);
    if (c.type === "curseur" && (c.defaut < c.min || c.defaut > c.max || c.pas <= 0)) p.push(`${nom}.${c.cle} : défaut ${c.defaut} hors [${c.min}, ${c.max}] ou pas nul`);
    if (c.type === "selecteur" && !c.source && !c.options.some((o) => o.valeur === c.defaut)) p.push(`${nom}.${c.cle} : défaut « ${c.defaut} » absent des options`);
    if (c.type === "couleur" && !HEX.test(c.defaut)) p.push(`${nom}.${c.cle} : défaut « ${c.defaut} » n'est pas #rrggbb`);
    if (c.type === "liste") {
      if (c.defaut.length < c.min || c.defaut.length > c.max) p.push(`${nom}.${c.cle} : ${c.defaut.length} éléments par défaut, hors [${c.min}, ${c.max}]`);
      p.push(...controlerSchema(c.element, `${nom}.${c.cle}[]`));
      c.defaut.forEach((d, i) => {
        const r = validerReglages(c.element, d);
        if (r.corrections.length) p.push(`${nom}.${c.cle}[${i + 1}] : défaut invalide (${r.corrections.join(" ; ")})`);
      });
    }
  }
  for (const c of champs) if (c.si?.champ && !vues.has(c.si.champ)) p.push(`${nom}.${c.cle} : condition sur un champ inconnu « ${c.si.champ} »`);
  return p;
}
