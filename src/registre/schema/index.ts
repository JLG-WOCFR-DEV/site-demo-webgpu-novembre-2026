/**
 * Registre — le schéma de réglages déclaratif, commun aux éditeurs (Vitrine, inspecteur des effets, Studio).
 *
 * Un objet (une section de Vitrine, un effet Presse) déclare ses champs une fois ; ce schéma pilote :
 *   - les valeurs par défaut (`valeursParDefaut`) ;
 *   - la validation et la correction d'un réglage reçu (JSON importé, lien partagé, attribut `data-*`, ancienne
 *     version) : `validerReglages` borne, arrondit au pas, remet le défaut d'une option inconnue, et dit en français
 *     ce qu'il a corrigé ;
 *   - la sérialisation en texte (`versTexte`, `versAttributs`) : ce qu'on écrit dans un attribut `data-*`, relu par
 *     la même validation ;
 *   - l'inspecteur (src/vitrine/inspecteur.ts, puis l'inspecteur d'effet), qui en déduit curseurs, segments… ;
 *   - le rendu, qui lit des réglages déjà valides (jamais `undefined`).
 *
 * Onze genres de champs :
 *   curseur, selecteur, interrupteur, couleur, texte, image, liste (les sept de Vitrine, inchangés) ;
 *   courbe   une courbe de mouvement, en chaîne CSS : nom (`out`, `in-out-cubic`…), `cubic-bezier(a, b, c, d)`,
 *            `steps(n, position)` ou `linear(…)` (src/registre/mouvement/courbes.ts) ;
 *   temps    une durée dans l'unité du champ (`ms` ou `s`), bornée, au pas ; lit « 300ms », « 0,3 s », « 0.3s » ;
 *   angle    des degrés, bornés ou ramenés dans le tour (`boucle`) ; lit « 45deg », « 0.25turn », « 1rad » ;
 *   plage    deux bornes [a, b] dans [min, max], au pas, remises dans l'ordre ; lit [a, b], { min, max }, « a–b ».
 * Un champ peut ne valoir que pour certaines variantes, ou que si un autre champ a une valeur donnée (`si`) : la
 * condition est déclarative (sérialisable, testable), pas une fonction.
 *
 * Pur : ni DOM ni réseau ; importable par Node (--experimental-strip-types), imports relatifs avec extension.
 * src/vitrine/schema.ts le réexporte (vitrine.test.ts), src/registre/schema/schema.test.ts teste le reste.
 */
import { lireCourbe } from "../mouvement/courbes.ts";

/** Les icônes de l'interface : un nom, pas un dessin. */
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
/** Une courbe de mouvement : la valeur est sa chaîne CSS normalisée (ou un nom de la bibliothèque, gardé tel quel). */
export interface ChampCourbe extends Base {
  type: "courbe";
  defaut: string;
  /** Les écritures permises (défaut : toutes). `nom` : noms de la maison, préréglages et mots-clés CSS. */
  genres?: readonly ("nom" | "cubic-bezier" | "steps" | "linear")[];
}
/** Une durée, exprimée dans `unite`. */
export interface ChampTemps extends Base {
  type: "temps";
  unite: "ms" | "s";
  min: number;
  max: number;
  pas: number;
  defaut: number;
}
/** Un angle, en degrés. */
export interface ChampAngle extends Base {
  type: "angle";
  /** Bornes en degrés (défaut 0 et 360). */
  min?: number;
  max?: number;
  pas: number;
  defaut: number;
  /** Ramène dans [min, max) par tours entiers au lieu de borner (une aiguille de cadran). Défaut : oui si [0, 360]. */
  boucle?: boolean;
}
/** Deux bornes [a, b], a ≤ b. */
export interface ChampPlage extends Base {
  type: "plage";
  min: number;
  max: number;
  pas: number;
  defaut: readonly [number, number];
  /** Écart minimal entre les deux bornes (défaut 0). */
  ecartMin?: number;
  unite?: string;
}

export type Champ = ChampCurseur | ChampSelecteur | ChampInterrupteur | ChampCouleur | ChampTexte | ChampImage | ChampListe | ChampCourbe | ChampTemps | ChampAngle | ChampPlage;
/** Le genre d'un champ (`type`). */
export type GenreChamp = Champ["type"];
export const GENRES: readonly GenreChamp[] = ["curseur", "selecteur", "interrupteur", "couleur", "texte", "image", "liste", "courbe", "temps", "angle", "plage"];

export type Plage = readonly [number, number];
export type Valeur = number | string | boolean | Record<string, Valeur>[] | Plage;
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
  if (c.type === "liste") return copieListe(c.defaut);
  if (c.type === "plage") return [c.defaut[0], c.defaut[1]] as const;
  return c.defaut;
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
export const champsVisibles = <C extends Champ>(champs: readonly C[], reglages: Reglages, variante?: string): C[] => champs.filter((c) => conditionTient(c.si, reglages, variante));

/* ───────── Lecture des unités ───────── */

const NOMBRE = /^[+-]?(\d+[.,]?\d*|[.,]\d+)(e[+-]?\d+)?$/i;
/** Un nombre écrit à la française ou non (« 0,5 », « .5 », « 1e3 ») ; `null` sinon. */
export function lireNombre(s: string): number | null {
  const t = s.trim();
  if (!NOMBRE.test(t)) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Une durée écrite (« 300ms », « 0,3 s », « 0.3s », un nombre nu = `unite`), convertie dans `unite` ; `null` si illisible. */
export function lireTemps(brut: unknown, unite: "ms" | "s"): number | null {
  if (typeof brut === "number") return Number.isFinite(brut) ? brut : null;
  if (typeof brut !== "string") return null;
  const m = /^\s*(.+?)\s*(ms|s)?\s*$/i.exec(brut);
  if (!m) return null;
  const n = lireNombre(m[1]!);
  if (n === null) return null;
  const u = (m[2] ?? unite).toLowerCase();
  if (u === unite) return n;
  return u === "s" ? n * 1000 : n / 1000;
}

/** Un angle écrit (« 45 », « 45deg », « 0.25turn », « 1rad », « 50grad »), en degrés ; `null` si illisible. */
export function lireAngle(brut: unknown): number | null {
  if (typeof brut === "number") return Number.isFinite(brut) ? brut : null;
  if (typeof brut !== "string") return null;
  const m = /^\s*(.+?)\s*(deg|°|turn|tour|rad|grad)?\s*$/i.exec(brut);
  if (!m) return null;
  const n = lireNombre(m[1]!);
  if (n === null) return null;
  switch ((m[2] ?? "deg").toLowerCase()) {
    case "turn":
    case "tour":
      return n * 360;
    case "rad":
      return (n * 180) / Math.PI;
    case "grad":
      return n * 0.9;
    default:
      return n;
  }
}

/** Deux bornes écrites ([a, b], { min, max }, « a–b », « a..b », « a / b », « a b ») ; `null` si illisible. */
export function lirePlage(brut: unknown): [number, number] | null {
  let a: unknown;
  let b: unknown;
  if (Array.isArray(brut) && brut.length === 2) [a, b] = brut;
  else if (brut && typeof brut === "object" && "min" in brut && "max" in brut) ({ min: a, max: b } = brut as { min: unknown; max: unknown });
  else if (typeof brut === "string") {
    const m = /^\s*([^\s–—/]+?)\s*(?:–|—|\.\.|\/|\s|(?<=\d)-)\s*([^\s–—/]+)\s*$/.exec(brut);
    if (!m) return null;
    [a, b] = [m[1], m[2]];
  } else return null;
  const na = typeof a === "number" ? a : typeof a === "string" ? lireNombre(a) : null;
  const nb = typeof b === "number" ? b : typeof b === "string" ? lireNombre(b) : null;
  return na !== null && nb !== null && Number.isFinite(na) && Number.isFinite(nb) ? [na, nb] : null;
}

/* ───────── Validation ───────── */

export interface Resultat {
  reglages: Reglages;
  /** Ce qui a été corrigé, en français (« colonnes : 9 ramené à 5 »). Vide si tout était bon. */
  corrections: string[];
}

const decimalesDe = (pas: number) => (String(pas).split(".")[1] ?? "").length;
const arrondiPas = (v: number, min: number, pas: number) => {
  const n = Math.round((v - min) / pas) * pas + min;
  // Les pas décimaux (0,1) laissent des queues binaires : on les coupe.
  return +n.toFixed(decimalesDe(pas));
};
/** Borne puis arrondit au pas (en disant ce qui a été ramené). */
function nombreBorne(v: number, min: number, max: number, pas: number, dire: (m: string) => void, unite = ""): number {
  const borne = Math.min(max, Math.max(min, v));
  if (borne !== v) dire(`${v}${unite} ramené à ${borne}${unite}`);
  const r = arrondiPas(borne, min, pas);
  return Math.min(max, Math.max(min, r));
}
const fr = (n: number) => String(n).replace(".", ",");

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
    case "courbe": {
      if (typeof brut !== "string") {
        if (brut !== undefined) dire(`courbe attendue, défaut « ${c.defaut} »`);
        return c.defaut;
      }
      const l = lireCourbe(brut);
      if (!l.ok) {
        dire(`${l.erreur}, défaut « ${c.defaut} »`);
        return c.defaut;
      }
      if (c.genres && !c.genres.includes(l.genre)) {
        dire(`écriture ${l.genre} non permise ici (${c.genres.join(", ")}), défaut « ${c.defaut} »`);
        return c.defaut;
      }
      // Un nom reste un nom (lisible, stable) ; une écriture CSS est normalisée (espaces, zéros) sans le signaler :
      // c'est la même courbe.
      if (l.genre === "nom") {
        if (l.nom !== brut.trim()) dire(`« ${brut.trim()} » lu « ${l.nom} »`);
        return l.nom!;
      }
      return l.css;
    }
    case "temps": {
      const v = lireTemps(brut, c.unite);
      if (v === null) {
        if (brut !== undefined) dire(`durée illisible, défaut ${fr(c.defaut)} ${c.unite}`);
        return c.defaut;
      }
      return nombreBorne(v, c.min, c.max, c.pas, dire, ` ${c.unite}`);
    }
    case "angle": {
      const v = lireAngle(brut);
      if (v === null) {
        if (brut !== undefined) dire(`angle illisible, défaut ${fr(c.defaut)}°`);
        return c.defaut;
      }
      const min = c.min ?? 0;
      const max = c.max ?? 360;
      const boucle = c.boucle ?? (min === 0 && max === 360);
      if (boucle) {
        const tour = max - min;
        let r = ((((v - min) % tour) + tour) % tour) + min;
        r = arrondiPas(r, min, c.pas);
        if (r >= max) r = min;
        return Object.is(r, -0) ? 0 : r;
      }
      return nombreBorne(v, min, max, c.pas, dire, "°");
    }
    case "plage": {
      const p = lirePlage(brut);
      if (!p) {
        if (brut !== undefined) dire(`plage illisible, défaut ${c.defaut[0]}–${c.defaut[1]}`);
        return [c.defaut[0], c.defaut[1]] as const;
      }
      let [a, b] = p;
      if (a > b) {
        dire(`bornes inversées, remises dans l'ordre (${b}–${a})`);
        [a, b] = [b, a];
      }
      a = nombreBorne(a, c.min, c.max, c.pas, dire, c.unite ?? "");
      b = nombreBorne(b, c.min, c.max, c.pas, dire, c.unite ?? "");
      const ecart = c.ecartMin ?? 0;
      if (b - a < ecart) {
        const nb = Math.min(c.max, +(a + ecart).toFixed(decimalesDe(c.pas)));
        const na = Math.max(c.min, +(nb - ecart).toFixed(decimalesDe(c.pas)));
        dire(`écart ${+(b - a).toFixed(6)} < ${ecart}, élargi à ${na}–${nb}`);
        [a, b] = [na, nb];
      }
      return [a, b] as const;
    }
  }
}

function validerObjet(champs: readonly Champ[], brut: Record<string, unknown>, connu: Connu, chemin: string, corr: string[]): Reglages {
  const r: Reglages = {};
  for (const c of champs) r[c.cle] = validerChamp(c, brut[c.cle], connu, chemin ? `${chemin}.${c.cle}` : c.cle, corr);
  return r;
}

/** Une seule valeur, rendue valide pour son champ (chemin des corrections : la clé du champ). */
export function validerValeur(c: Champ, brut: unknown, connu: Connu = {}): { valeur: Valeur; corrections: string[] } {
  const corrections: string[] = [];
  return { valeur: validerChamp(c, brut, connu, c.cle, corrections), corrections };
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

/* ───────── Sérialisation en texte (attributs data-*) ───────── */

/**
 * Une valeur valide en texte, pour un attribut : relue par `validerValeur`, elle redonne la même valeur.
 * temps : « 300ms » / « 0.3s » ; angle : « 45deg » ; plage : « 2–8 » ; interrupteur : « oui » / « non » ;
 * liste : son JSON.
 */
export function versTexte(c: Champ, v: Valeur): string {
  switch (c.type) {
    case "temps":
      return `${v as number}${c.unite}`;
    case "angle":
      return `${v as number}deg`;
    case "plage": {
      const [a, b] = v as Plage;
      return `${a}–${b}`;
    }
    case "interrupteur":
      return v ? "oui" : "non";
    case "liste":
      return JSON.stringify(v);
    default:
      return String(v);
  }
}

/** Relit un texte d'attribut (pour un champ liste : du JSON). */
export function depuisTexte(c: Champ, s: string, connu: Connu = {}): { valeur: Valeur; corrections: string[] } {
  if (c.type === "liste") {
    try {
      return validerValeur(c, JSON.parse(s), connu);
    } catch {
      return validerValeur(c, null, connu);
    }
  }
  if (c.type === "curseur") return validerValeur(c, s.replace(",", "."), connu);
  return validerValeur(c, s, connu);
}

/**
 * Les attributs `data-<prefixe>-<cle>="…"` qui redonnent ces réglages, seulement pour ce qui diffère du défaut (les
 * listes ne vont pas dans un attribut). Les clés en camelCase deviennent kebab-case (`dureeSortie` → `duree-sortie`).
 */
export function versAttributs(champs: readonly Champ[], reglages: Reglages, prefixe: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of champs) {
    if (c.type === "liste" || !(c.cle in reglages)) continue;
    const v = reglages[c.cle]!;
    const t = versTexte(c, v);
    if (t === versTexte(c, defautDe(c))) continue;
    out[`data-${prefixe}-${c.cle.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`] = t;
  }
  return out;
}

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
    if (c.type === "courbe" || c.type === "temps" || c.type === "angle" || c.type === "plage") {
      if ((c.type === "temps" || c.type === "plage") && (c.pas <= 0 || c.min > c.max)) p.push(`${nom}.${c.cle} : bornes [${c.min}, ${c.max}] ou pas ${c.pas} incohérents`);
      if (c.type === "angle" && c.pas <= 0) p.push(`${nom}.${c.cle} : pas nul`);
      const r = validerValeur(c, defautDe(c));
      if (r.corrections.length) p.push(`${nom}.${c.cle} : défaut invalide (${r.corrections.join(" ; ")})`);
    }
  }
  for (const c of champs) if (c.si?.champ && !vues.has(c.si.champ)) p.push(`${nom}.${c.cle} : condition sur un champ inconnu « ${c.si.champ} »`);
  return p;
}
