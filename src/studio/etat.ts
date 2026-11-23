/**
 * Studio — l'état d'un effet réglé, et ses quatre écritures : attributs `data-*`, HTML de la démo, JSON de réglages,
 * lien de partage. Pur (ni DOM ni réseau) : testé sous Node (etat.test.ts).
 *
 * L'état, ce sont les valeurs des paramètres de la fiche (src/registre/parametres/types.ts) :
 *   - un paramètre ordinaire a toujours une valeur (son défaut effectif tant qu'on n'y touche pas) ;
 *   - un paramètre `auto` n'a de valeur que si on l'a réglé ; absent, le module décide.
 * Le défaut EFFECTIF d'un paramètre est son `defaut`, sauf si un préréglage (`fiche.prereglages`) en impose un autre.
 *
 * ── Lien de partage, format v1 ──
 *
 *   studio-effet.html?effet=<id>#v=1;<cle>=<valeur>;<cle>=<valeur>…
 *
 *   - l'effet est dans la requête (`?effet=goo`), les réglages dans le fragment (rien ne part au serveur) ;
 *   - le fragment commence TOUJOURS par `v=1` (la version du format) ; une autre version est lue au mieux et signalée ;
 *   - puis, séparés par `;`, seulement les réglages qui diffèrent du défaut effectif (et les `auto` réglés), dans
 *     l'ordre de la fiche, le préréglage en premier : `#v=1` seul = tout par défaut ;
 *   - `<cle>` est la clé du paramètre dans la fiche (`fusion`, `courbeSortie`), pas le nom de l'attribut : renommer un
 *     attribut ne casse pas les liens ;
 *   - `<valeur>` est passée par `encodeURIComponent` ; nombres en notation JS (`0.75`, `-5`), durées dans l'unité du
 *     paramètre sans suffixe, interrupteurs `oui` / `non`, couleurs `#rrggbb`, courbes en écriture CSS ou par nom ;
 *   - à la lecture, chaque valeur repasse par la validation du schéma (bornée, arrondie au pas, option connue) ; une
 *     clé inconnue ou une valeur illisible est écartée et dite dans les corrections, jamais une erreur.
 * L'aperçu (studio-apercu.html) lit exactement le même fragment.
 *
 * ── JSON de réglages ──
 *   { "effet": "goo", "v": 1, "reglages": { "<cle>": <valeur> | null } } — tous les paramètres ; `null` = auto.
 */
import { conditionTient, validerValeur, versTexte, type Reglages, type Valeur } from "../registre/schema/index.ts";
import type { FicheParametres, Parametre } from "../registre/parametres/types.ts";

export const VERSION_PARTAGE = 1;

export type Etat = { valeurs: Reglages };

/** Un attribut écrit par un paramètre : sur la racine de la démo (`cible` nulle) ou sur ses `cible`. `valeur` nulle : retiré. */
export type Ecrit = { cle: string; nom: string; valeur: string | null; cible: string | null };

/* ───────── Défauts ───────── */

const baseDe = (p: Parametre): Valeur => p.defaut as Valeur;

/** Les défauts effectifs : le `defaut` de chaque paramètre, corrigé par le préréglage choisi dans `valeurs`. */
export function defautsEffectifs(fiche: FicheParametres, valeurs: Reglages): Reglages {
  const out: Reglages = {};
  for (const p of fiche.parametres) out[p.cle] = baseDe(p);
  const pr = fiche.prereglages;
  if (pr) {
    const choix = String(valeurs[pr.cle] ?? out[pr.cle] ?? "");
    const base = pr.valeurs[choix];
    if (base) for (const [k, v] of Object.entries(base)) if (k in out && k !== pr.cle) out[k] = v;
  }
  return out;
}

/** L'état de départ : chaque paramètre ordinaire à son défaut, aucun `auto` réglé. */
export function etatInitial(fiche: FicheParametres): Etat {
  const valeurs: Reglages = {};
  for (const p of fiche.parametres) if (!p.auto) valeurs[p.cle] = baseDe(p);
  const d = defautsEffectifs(fiche, valeurs);
  for (const p of fiche.parametres) if (!p.auto) valeurs[p.cle] = d[p.cle]!;
  return { valeurs };
}

/** La valeur montrée par l'inspecteur : la valeur réglée, sinon le défaut effectif. */
export const valeurDe = (fiche: FicheParametres, etat: Etat, p: Parametre): Valeur => etat.valeurs[p.cle] ?? defautsEffectifs(fiche, etat.valeurs)[p.cle]!;

/** Les valeurs complètes (défauts effectifs pour les `auto` non réglés) : pour les conditions `si`. */
export function valeursCompletes(fiche: FicheParametres, etat: Etat): Reglages {
  return { ...defautsEffectifs(fiche, etat.valeurs), ...etat.valeurs };
}

/** Les paramètres montrés (condition `si` tenue). */
export function parametresVisibles(fiche: FicheParametres, etat: Etat): Parametre[] {
  const v = valeursCompletes(fiche, etat);
  return fiche.parametres.filter((p) => conditionTient(p.si, v));
}

/* ───────── Écritures ───────── */

/** Le texte d'une valeur dans le fragment de partage (relu par `validerValeur`). */
export function texteBrut(p: Parametre, v: Valeur): string {
  if (p.type === "interrupteur") return v ? "oui" : "non";
  if (p.type === "temps" || p.type === "angle" || p.type === "curseur") return String(v);
  return String(v);
}

/** Le texte d'une valeur dans l'attribut ; `null` : l'attribut est absent. */
export function texteAttribut(p: Parametre, v: Valeur): string | null {
  if (p.type === "interrupteur") {
    const e = { oui: "", non: null, ...p.ecriture };
    return (v ? e.oui : e.non) ?? null;
  }
  if (p.type === "temps" || p.type === "angle" || p.type === "curseur") return `${v as number}${p.ecriture?.suffixe ?? ""}`;
  return versTexte(p, v);
}

/** Vrai si le paramètre est réglé autrement que par défaut (donc écrit, dans l'attribut et dans le lien). */
export function estRegle(fiche: FicheParametres, etat: Etat, p: Parametre, defauts = defautsEffectifs(fiche, etat.valeurs)): boolean {
  if (!(p.cle in etat.valeurs)) return false;
  if (p.auto) return true;
  return texteBrut(p, etat.valeurs[p.cle]!) !== texteBrut(p, defauts[p.cle]!);
}

/** Les attributs à poser sur la démo : seulement les paramètres visibles et réglés. */
export function attributsDe(fiche: FicheParametres, etat: Etat): Ecrit[] {
  const d = defautsEffectifs(fiche, etat.valeurs);
  const out: Ecrit[] = [];
  for (const p of parametresVisibles(fiche, etat)) {
    if (!estRegle(fiche, etat, p, d)) continue;
    out.push({ cle: p.cle, nom: p.attribut, valeur: texteAttribut(p, etat.valeurs[p.cle]!), cible: p.cible ?? null });
  }
  return out;
}

/* ───────── Modifications ───────── */

/**
 * Règle un paramètre (valeur brute : texte d'un champ, nombre, booléen), validée par le schéma. Changer le préréglage
 * déplace avec lui les paramètres restés à leur défaut effectif ; ceux qu'on a réglés gardent leur valeur.
 */
export function regler(fiche: FicheParametres, etat: Etat, cle: string, brut: unknown): { etat: Etat; corrections: string[] } {
  const p = fiche.parametres.find((x) => x.cle === cle);
  if (!p) return { etat, corrections: [`${cle} : réglage inconnu`] };
  const { valeur, corrections } = validerValeur(p, brut);
  // Une valeur illisible pour un paramètre `auto` : on ne règle rien (le module garde la main), plutôt que d'écrire
  // le défaut de la fiche comme si on l'avait choisi.
  if (p.auto && corrections.length && texteBrut(p, valeur) === texteBrut(p, baseDe(p)) && String(brut) !== texteBrut(p, baseDe(p)))
    return { etat, corrections: corrections.map((c) => `${c} (laissé automatique)`) };
  const valeurs: Reglages = { ...etat.valeurs, [cle]: valeur };
  if (fiche.prereglages?.cle === cle) {
    const avant = defautsEffectifs(fiche, etat.valeurs);
    const apres = defautsEffectifs(fiche, valeurs);
    for (const q of fiche.parametres) {
      if (q.cle === cle || q.auto || !(q.cle in etat.valeurs)) continue;
      if (texteBrut(q, etat.valeurs[q.cle]!) === texteBrut(q, avant[q.cle]!)) valeurs[q.cle] = apres[q.cle]!;
    }
  }
  return { etat: { valeurs }, corrections };
}

/** Rend un paramètre `auto` au module (ou un paramètre ordinaire à son défaut effectif). */
export function rendreAuto(fiche: FicheParametres, etat: Etat, cle: string): Etat {
  const p = fiche.parametres.find((x) => x.cle === cle);
  if (!p) return etat;
  const valeurs = { ...etat.valeurs };
  if (p.auto) delete valeurs[cle];
  else valeurs[cle] = defautsEffectifs(fiche, valeurs)[cle]!;
  return { valeurs };
}

/* ───────── Lien de partage ───────── */

/** Le fragment `v=1;cle=valeur…` (sans `#`). */
export function versHash(fiche: FicheParametres, etat: Etat): string {
  const d = defautsEffectifs(fiche, etat.valeurs);
  const morceaux = [`v=${VERSION_PARTAGE}`];
  const ordre = fiche.prereglages ? [...fiche.parametres.filter((p) => p.cle === fiche.prereglages!.cle), ...fiche.parametres.filter((p) => p.cle !== fiche.prereglages!.cle)] : fiche.parametres;
  for (const p of ordre) if (estRegle(fiche, etat, p, d)) morceaux.push(`${p.cle}=${encodeURIComponent(texteBrut(p, etat.valeurs[p.cle]!))}`);
  return morceaux.join(";");
}

/** Relit un fragment (avec ou sans `#`). Rien d'illisible n'arrête la lecture : c'est dit dans `corrections`. */
export function depuisHash(fiche: FicheParametres, hash: string): { etat: Etat; corrections: string[]; version: number | null } {
  const corrections: string[] = [];
  const brut = hash.replace(/^#/, "").trim();
  let etat = etatInitial(fiche);
  if (!brut) return { etat, corrections, version: null };
  const paires: [string, string][] = [];
  for (const m of brut.split(";")) {
    if (!m) continue;
    const i = m.indexOf("=");
    const k = i < 0 ? m : m.slice(0, i);
    let v = i < 0 ? "" : m.slice(i + 1);
    try {
      v = decodeURIComponent(v);
    } catch {
      corrections.push(`${k} : valeur mal encodée, écartée`);
      continue;
    }
    paires.push([k, v]);
  }
  let version: number | null = null;
  if (paires[0]?.[0] === "v") {
    version = Number(paires.shift()![1]);
    if (version !== VERSION_PARTAGE) corrections.push(`lien en version ${Number.isFinite(version) ? version : "illisible"} : lu comme la version ${VERSION_PARTAGE}`);
  } else corrections.push(`lien sans version : lu comme la version ${VERSION_PARTAGE}`);
  // Le préréglage d'abord : il fixe les défauts des autres.
  const pr = fiche.prereglages?.cle;
  paires.sort((a, b) => Number(b[0] === pr) - Number(a[0] === pr));
  const vus = new Set<string>();
  for (const [k, v] of paires) {
    if (vus.has(k)) {
      corrections.push(`${k} : donné deux fois, la première valeur est gardée`);
      continue;
    }
    vus.add(k);
    if (!fiche.parametres.some((p) => p.cle === k)) {
      corrections.push(`${k} : réglage inconnu, écarté`);
      continue;
    }
    const r = regler(fiche, etat, k, v);
    etat = r.etat;
    corrections.push(...r.corrections);
  }
  return { etat, corrections, version };
}

/* ───────── JSON ───────── */

export type ReglagesJson = { effet: string; v: number; reglages: Record<string, Valeur | null> };

export function versJson(fiche: FicheParametres, id: string, etat: Etat): ReglagesJson {
  const reglages: Record<string, Valeur | null> = {};
  for (const p of fiche.parametres) reglages[p.cle] = p.cle in etat.valeurs ? etat.valeurs[p.cle]! : null;
  return { effet: id, v: VERSION_PARTAGE, reglages };
}

export function depuisJson(fiche: FicheParametres, json: unknown): { etat: Etat; corrections: string[] } {
  const corrections: string[] = [];
  let etat = etatInitial(fiche);
  const o = json && typeof json === "object" ? (json as Partial<ReglagesJson>) : {};
  const r = o.reglages && typeof o.reglages === "object" ? o.reglages : {};
  if (o.v !== undefined && o.v !== VERSION_PARTAGE) corrections.push(`réglages en version ${String(o.v)} : lus comme la version ${VERSION_PARTAGE}`);
  const pr = fiche.prereglages?.cle;
  const cles = Object.keys(r).sort((a, b) => Number(b === pr) - Number(a === pr));
  for (const k of cles) {
    const v = (r as Record<string, unknown>)[k];
    if (!fiche.parametres.some((p) => p.cle === k)) {
      corrections.push(`${k} : réglage inconnu, écarté`);
      continue;
    }
    if (v === null) {
      etat = rendreAuto(fiche, etat, k);
      continue;
    }
    const x = regler(fiche, etat, k, v);
    etat = x.etat;
    corrections.push(...x.corrections);
  }
  return { etat, corrections };
}

/* ───────── La démo ───────── */

/** Ce qu'il faut d'un élément (DOM, ou node-html-parser sous Node) pour lui poser des attributs. */
export interface ElementLike {
  setAttribute(nom: string, valeur: string): unknown;
  removeAttribute(nom: string): unknown;
  querySelectorAll(selecteur: string): ArrayLike<ElementLike> | Iterable<ElementLike>;
}

/** Pose les attributs écrits sur la racine de la démo et ses cibles. */
export function appliquer(racine: ElementLike, ecrits: readonly Ecrit[]): void {
  for (const e of ecrits) {
    const els = e.cible ? Array.from(racine.querySelectorAll(e.cible) as ArrayLike<ElementLike>) : [racine];
    for (const el of els) {
      if (e.valeur === null) el.removeAttribute(e.nom);
      else el.setAttribute(e.nom, e.valeur);
    }
  }
}

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Un attribut écrit tel qu'en HTML : `nom` (vide) ou `nom="valeur"`. */
export const enHtml = (nom: string, valeur: string) => (valeur === "" ? nom : `${nom}="${echapper(valeur)}"`);

/**
 * Les attributs à copier, en texte : ceux de la racine sur une ligne (l'attribut principal de l'effet en tête, même à
 * sa valeur par défaut), puis une ligne par cible. `principal` : les attributs que la démo pose d'office sur la racine.
 */
export function texteAttributs(ecrits: readonly Ecrit[], principal: readonly [string, string][] = []): string {
  const racine = new Map<string, string | null>(principal.map(([n, v]) => [n, v]));
  const cibles = new Map<string, Map<string, string | null>>();
  for (const e of ecrits) {
    if (!e.cible) racine.set(e.nom, e.valeur);
    else {
      const m = cibles.get(e.cible) ?? new Map<string, string | null>();
      m.set(e.nom, e.valeur);
      cibles.set(e.cible, m);
    }
  }
  const ligne = (m: Map<string, string | null>) =>
    [...m]
      .filter(([, v]) => v !== null)
      .map(([n, v]) => enHtml(n, v!))
      .join(" ");
  const lignes = [ligne(racine)];
  for (const [c, m] of cibles) {
    const l = ligne(m);
    if (l) lignes.push(`<!-- sur chaque ${c} --> ${l}`);
  }
  return lignes.filter(Boolean).join("\n");
}
