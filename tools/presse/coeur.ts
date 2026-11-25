/**
 * Presse — le cœur commun de la CLI `presse` (tools/presse/cli.mjs) et du serveur MCP (tools/presse/mcp.mjs).
 *
 * Une seule source de vérité : le registre (src/registre/effets.ts et ses fiches src/registre/parametres/*.ts), le
 * catalogue dérivé de PRESSE.md (tools/valider/catalogue.ts), le validateur (tools/valider/valider.ts), le budget
 * (tools/valider/budget.ts), le lint du mouvement (tools/valider/mouvement-statique.ts) et la bibliothèque de courbes
 * (src/registre/mouvement/courbes.ts). Ce fichier ne recopie aucune documentation : il les assemble.
 *
 * Pur : aucune écriture. Les seules entrées-sorties sont des LECTURES du dépôt (`racine`) ; `ajouterEffetAPage` rend
 * le contenu proposé et son diff, l'appelant (CLI avec `--ecrire`, MCP après confirmation par jeton) écrit. Tout
 * chemin reçu passe par `confiner` (dans le dépôt, page HTML ou feuille CSS à la racine ou sous src/).
 *
 * Erreurs : `ErreurPresse` (code `inconnu` : identifiant ou réglage inconnu ; `chemin` : chemin refusé ; `absent` :
 * fichier ou build introuvable ; `usage` : demande mal formée), avec une suggestion quand il y en a une.
 *
 * Importable par Node (`node` ≥ 22.18, types effacés) : pas d'alias, pas de syntaxe TypeScript non effaçable.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parse, type HTMLElement } from "node-html-parser";
import { EFFETS, type Manifeste } from "../../src/registre/effets.ts";
import type { FicheParametres, Parametre } from "../../src/registre/parametres/types.ts";
import { PREREGLAGES, courbeCss, lireCourbe } from "../../src/registre/mouvement/courbes.ts";
import { chercher as chercherFlou } from "../../src/nav/recherche.ts";
import { attributsDe, etatInitial, regler, type Ecrit, type Etat } from "../../src/studio/etat.ts";
import { lireCatalogue, proche, toutesValeurs, type Catalogue } from "../valider/catalogue.ts";
import { validerHtml, validerFichier, type Constat } from "../valider/valider.ts";
import { budgetPage, budgets as tousLesBudgets, constatBudget, lireManifesteVite, type BudgetPage } from "../valider/budget.ts";
import { auditerMouvement, lintPage, PRIORITES_MOUVEMENT, REGLES_MOUVEMENT, type ConstatMouvement } from "../valider/mouvement-statique.ts";
import { lirePagesVite } from "../valider/pages-vite.ts";

/** La racine du dépôt qui contient ce fichier (défaut de toutes les fonctions ; les tests en donnent une copie). */
export const RACINE_DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export type CodeErreur = "inconnu" | "chemin" | "absent" | "usage";

export class ErreurPresse extends Error {
  code: CodeErreur;
  suggestion: string | null;
  constructor(code: CodeErreur, message: string, suggestion: string | null = null) {
    super(suggestion ? `${message} — vouliez-vous « ${suggestion} » ?` : message);
    this.name = "ErreurPresse";
    this.code = code;
    this.suggestion = suggestion;
  }
}

/* ───────────────────────── Catalogue (mis en cache tant que PRESSE.md ne change pas) ───────────────────────── */

const caches = new Map<string, { mtime: number; cat: Catalogue }>();

export function catalogue(racine = RACINE_DEPOT): Catalogue {
  const md = path.join(racine, "PRESSE.md");
  if (!fs.existsSync(md)) throw new ErreurPresse("absent", `${md} introuvable : la racine n'est pas un dépôt Presse`);
  const mtime = fs.statSync(md).mtimeMs;
  const vu = caches.get(racine);
  if (vu && vu.mtime === mtime) return vu.cat;
  const cat = lireCatalogue(racine);
  caches.set(racine, { mtime, cat });
  return cat;
}

/* ───────────────────────── Effets ───────────────────────── */

const studio = (id: string) => `studio-effet.html?effet=${id}`;

/** L'armement d'un effet, en clair (d'après le manifeste). */
export function armementDe(m: Manifeste): string {
  const parts = [m.manuel ? "pages-nav, sauf data-presse-manuel (la page appelle alors elle-même son init)" : "pages-nav (dès qu'un attribut du sélecteur est dans la page)"];
  if (m.parametre) parts.push(`ou par l'adresse ?${m.parametre}=…`);
  if (m.tot) parts.push("armé tôt, avant le rideau d'entrée");
  return parts.join(" ; ");
}

export type ResumeEffet = {
  id: string;
  nom: string;
  categorie: Manifeste["categorie"];
  rendu: Manifeste["rendu"];
  statut: Manifeste["statut"];
  resume: string;
  exemple: string | null;
  cout: Manifeste["cout"];
  manuel: boolean;
  studio: string;
};

const resumer = (m: Manifeste): ResumeEffet => ({
  id: m.id,
  nom: m.nom,
  categorie: m.categorie,
  rendu: m.rendu,
  statut: m.statut,
  resume: m.resume,
  exemple: m.exemple ?? null,
  cout: m.cout,
  manuel: !!m.manuel,
  studio: studio(m.id),
});

/** Les effets du registre, dans l'ordre d'armement. */
export function listerEffets(): ResumeEffet[] {
  return EFFETS.map(resumer);
}

export const IDS_EFFETS: readonly string[] = EFFETS.map((m) => m.id);

export function manifeste(id: string): Manifeste {
  const m = EFFETS.find((x) => x.id === id);
  if (!m) throw new ErreurPresse("inconnu", `effet inconnu : « ${id} » (presse effets pour la liste)`, proche(id, IDS_EFFETS));
  return m;
}

async function fiche(m: Manifeste): Promise<FicheParametres | null> {
  return m.parametres ? (await m.parametres()).default : null;
}

export type ParametreDecrit = {
  cle: string;
  attribut: string;
  type: Parametre["type"];
  libelle: string;
  groupe: string | null;
  defaut: unknown;
  min?: number;
  max?: number;
  pas?: number;
  unite?: string;
  options?: string[];
  auto?: string;
  cible?: string;
  mouvement?: string;
  si?: { champ: string; valeurs: readonly unknown[] };
  aide?: string;
};

function decrireParametre(p: Parametre): ParametreDecrit {
  const q = p as Parametre & { min?: number; max?: number; pas?: number; unite?: string; groupe?: string; aide?: string; options?: readonly { valeur: string }[]; si?: { champ: string; valeurs: readonly unknown[] } };
  const out: ParametreDecrit = { cle: p.cle, attribut: p.attribut, type: p.type, libelle: p.libelle, groupe: q.groupe ?? null, defaut: p.defaut };
  if (q.min !== undefined) out.min = q.min;
  if (q.max !== undefined) out.max = q.max;
  if (q.pas !== undefined) out.pas = q.pas;
  if (q.unite) out.unite = q.unite;
  if (q.options) out.options = q.options.map((o) => o.valeur);
  if (p.auto) out.auto = p.auto;
  if (p.cible) out.cible = p.cible;
  if (p.mouvement) out.mouvement = p.mouvement;
  if (q.si) out.si = { champ: q.si.champ, valeurs: q.si.valeurs };
  if (q.aide) out.aide = q.aide;
  return out;
}

export type Parametres = { id: string; parametres: ParametreDecrit[]; prereglages: { cle: string; valeurs: string[] } | null; minimale: string | null; rendu: string | null };

/** Les paramètres réglables d'un effet (sa fiche Studio). */
export async function parametresEffet(id: string): Promise<Parametres> {
  const m = manifeste(id);
  const f = await fiche(m);
  return {
    id,
    parametres: (f?.parametres ?? []).map(decrireParametre),
    prereglages: f?.prereglages ? { cle: f.prereglages.cle, valeurs: Object.keys(f.prereglages.valeurs) } : null,
    minimale: f?.minimale ?? null,
    rendu: f?.rendu ?? null,
  };
}

export type AttributDecrit = { nom: string; documente: boolean; valeurs: string[]; valeurRequise: boolean; parents: string[]; lignesPresse: number[] };

/** Un effet en entier : manifeste (sans ses fonctions), attributs tels que PRESSE.md les documente, fiche, coût, exemple. */
export async function decrireEffet(id: string, racine = RACINE_DEPOT) {
  const m = manifeste(id);
  const cat = catalogue(racine);
  const f = await fiche(m);
  const attributs: AttributDecrit[] = m.attributs.map((nom) => {
    const a = cat.attributs.get(nom);
    return { nom, documente: !!a?.documente, valeurs: a ? toutesValeurs(a) : [], valeurRequise: !!a?.valeurRequise, parents: a?.parents ?? [], lignesPresse: a?.lignesMd ?? [] };
  });
  const p = await parametresEffet(id);
  return {
    ...resumer(m),
    selecteur: m.selecteur,
    module: m.module,
    armement: armementDe(m),
    parametreAdresse: m.parametre ?? null,
    attributs,
    parametres: p.parametres,
    prereglages: p.prereglages,
    minimale: p.minimale,
    renduSansGpu: p.rendu,
    demo: f?.demo ? { html: f.demo.html, racine: f.demo.racine ?? null, consigne: f.demo.consigne ?? null, css: f.demo.css ?? null } : null,
  };
}

/* ───────────────────────── Recherche ───────────────────────── */

export type Resultat =
  | { genre: "effet"; id: string; titre: string; texte: string; score: number }
  | { genre: "attribut"; id: string; titre: string; texte: string; effet: string | null; score: number }
  | { genre: "courbe"; id: string; titre: string; texte: string; score: number };

/** Recherche floue (celle de la palette Ctrl+K, src/nav/recherche.ts) dans les effets, les attributs documentés et les courbes. */
export function chercher(texte: string, racine = RACINE_DEPOT, limite = 20): Resultat[] {
  const t = texte.trim();
  if (!t) throw new ErreurPresse("usage", "chercher : texte vide");
  const cat = catalogue(racine);
  const effetDe = new Map<string, string>();
  for (const m of EFFETS) for (const a of m.attributs) if (!effetDe.has(a)) effetDe.set(a, m.id);
  type C = { r: Omit<Resultat, "score">; titre: string; mots: string[]; texte: string };
  const candidats: C[] = [
    ...EFFETS.map((m) => ({ r: { genre: "effet" as const, id: m.id, titre: m.nom, texte: m.resume }, titre: m.nom, mots: [m.id, m.categorie, m.rendu, ...m.attributs], texte: m.resume })),
    ...[...cat.attributs.values()]
      .filter((a) => a.documente)
      .map((a) => {
        const ligne = a.lignes[0] ?? cat.lignes.find((l) => l.n === a.lignesMd[0]);
        const desc = (ligne?.texte ?? "").replace(/`/g, "").replace(/\*\*/g, "").slice(0, 160);
        return { r: { genre: "attribut" as const, id: a.nom, titre: a.nom, texte: desc, effet: effetDe.get(a.nom) ?? null }, titre: a.nom, mots: toutesValeurs(a), texte: desc };
      }),
    ...PREREGLAGES.map((p) => ({ r: { genre: "courbe" as const, id: p.nom, titre: p.nom, texte: p.libelle }, titre: p.nom, mots: [p.famille], texte: p.libelle })),
  ];
  return chercherFlou(t, candidats, (c) => ({ titre: c.titre, mots: c.mots, texte: c.texte }), limite).map((x) => ({ ...x.item.r, score: Math.round(x.score * 10) / 10 }) as Resultat);
}

/* ───────────────────────── Chemins ───────────────────────── */

export type Confine = { abs: string; rel: string };

/**
 * Un chemin reçu, confiné au dépôt : relatif à la racine (aucun segment `..`) ou absolu DANS la racine ; une page HTML
 * ou une feuille CSS (`extensions`), à la racine du dépôt ou sous src/ ; un lien symbolique qui sort du dépôt est
 * refusé. Rien d'autre (ni node_modules, ni dist, ni public, ni .git).
 */
export function confiner(racine: string, chemin: string, extensions: readonly string[] = [".html", ".css"]): Confine {
  if (typeof chemin !== "string" || !chemin.trim() || chemin.includes("\0")) throw new ErreurPresse("chemin", "chemin vide ou illisible");
  const brut = chemin.trim();
  if (brut.split(/[\\/]+/).includes("..")) throw new ErreurPresse("chemin", `chemin refusé (« .. ») : ${brut}`);
  const base = path.resolve(racine);
  const abs = path.isAbsolute(brut) ? path.resolve(brut) : path.resolve(base, brut);
  const rel = path.relative(base, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new ErreurPresse("chemin", `chemin hors du dépôt : ${brut}`);
  const relPosix = rel.split(path.sep).join("/");
  if (!extensions.includes(path.extname(relPosix).toLowerCase())) throw new ErreurPresse("chemin", `chemin refusé : seules les pages ${extensions.join(", ")} sont permises (${relPosix})`);
  if (relPosix.includes("/") && !relPosix.startsWith("src/")) throw new ErreurPresse("chemin", `chemin refusé : une page à la racine du dépôt ou sous src/, pas ${relPosix}`);
  if (relPosix.split("/").some((s) => s.startsWith("."))) throw new ErreurPresse("chemin", `chemin refusé (dossier ou fichier caché) : ${relPosix}`);
  if (fs.existsSync(abs)) {
    const reel = fs.realpathSync(abs);
    const reelBase = fs.realpathSync(base);
    const r = path.relative(reelBase, reel);
    if (!r || r.startsWith("..") || path.isAbsolute(r)) throw new ErreurPresse("chemin", `chemin refusé : lien qui sort du dépôt (${relPosix})`);
  }
  return { abs, rel: relPosix };
}

/** Les pages construites (vite.config.ts, `build.rollupOptions.input`). */
export function pagesDuDepot(racine = RACINE_DEPOT): string[] {
  const config = path.join(racine, "vite.config.ts");
  if (!fs.existsSync(config)) throw new ErreurPresse("absent", "vite.config.ts introuvable");
  return [...new Set(lirePagesVite(fs.readFileSync(config, "utf8")))];
}

const lirePage = (racine: string, chemin: string): Confine & { html: string } => {
  const c = confiner(racine, chemin, [".html"]);
  if (!fs.existsSync(c.abs)) throw new ErreurPresse("absent", `page introuvable : ${c.rel}`, proche(c.rel, pagesDuDepot(racine)));
  return { ...c, html: fs.readFileSync(c.abs, "utf8") };
};

/* ───────────────────────── Validation ───────────────────────── */

export type PageValidee = { page: string; erreurs: number; avertissements: number; constats: Constat[] };
export type Validation = { pages: PageValidee[]; erreurs: number; avertissements: number };
export type OptionsValidation = { mouvement?: boolean; budget?: boolean };

/** Valide une page (ou toutes celles de vite.config.ts si `chemin` est absent) : les constats du validateur, et du budget. */
export function valider(racine = RACINE_DEPOT, chemin?: string | null, opts: OptionsValidation = {}): Validation {
  const cat = catalogue(racine);
  const pages = chemin ? [lirePage(racine, chemin).rel] : pagesDuDepot(racine);
  if (!pages.length) throw new ErreurPresse("absent", "aucune page dans vite.config.ts (build.rollupOptions.input)");
  const out: PageValidee[] = [];
  for (const rel of pages) {
    const abs = path.join(racine, rel);
    if (!fs.existsSync(abs)) {
      out.push({ page: rel, erreurs: 1, avertissements: 0, constats: [{ gravite: "erreur", regle: "fichier", ligne: 0, element: "", message: "fichier introuvable" }] });
      continue;
    }
    const constats = validerFichier(abs, cat, { mouvement: opts.mouvement !== false });
    if (opts.budget !== false) {
      const b = constatBudget(racine, abs);
      if (b) constats.push(b);
    }
    const e = constats.filter((c) => c.gravite === "erreur").length;
    out.push({ page: rel, erreurs: e, avertissements: constats.length - e, constats });
  }
  return { pages: out, erreurs: out.reduce((s, p) => s + p.erreurs, 0), avertissements: out.reduce((s, p) => s + p.avertissements, 0) };
}

/* ───────────────────────── Courbes ───────────────────────── */

export type CourbeDecrite = { nom: string; libelle: string; famille: string; css: string | null; bezier: readonly number[] | null; dureeMs: number | null };

/** Les préréglages de courbe (src/registre/mouvement/courbes.ts), avec leur écriture CSS. */
export function courbes(): CourbeDecrite[] {
  return PREREGLAGES.map((p) => ({ nom: p.nom, libelle: p.libelle, famille: p.famille, css: courbeCss(p.nom), bezier: p.bezier ?? null, dureeMs: p.dureeMs ?? null }));
}

/** Évalue une courbe (nom de préréglage, mot-clé CSS, cubic-bezier(), steps(), linear()) en t (0–1, borné). */
export function evaluerCourbe(valeur: string, t: number | readonly number[] = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
  const l = lireCourbe(String(valeur ?? ""));
  if (!l.ok) throw new ErreurPresse("inconnu", `courbe illisible : « ${valeur} » (${l.erreur})`, proche(String(valeur), PREREGLAGES.map((p) => p.nom)));
  const ts = (Array.isArray(t) ? t : [t]) as number[];
  for (const x of ts) if (typeof x !== "number" || !Number.isFinite(x)) throw new ErreurPresse("usage", `t doit être un nombre entre 0 et 1 (reçu ${String(x)})`);
  const arr = (x: number) => Math.round(x * 1e6) / 1e6;
  return { courbe: l.nom ?? valeur, css: l.css, genre: l.genre, points: ts.map((x) => { const u = Math.min(1, Math.max(0, x)); return { t: u, valeur: arr(l.f(u)) }; }) };
}

/* ───────────────────────── Budget ───────────────────────── */

/** Le budget JS (gzip) d'une page ou de toutes, mesuré sur le dernier build (dist/). */
export function budget(racine = RACINE_DEPOT, page?: string | null): { pages: BudgetPage[]; depassements: number } {
  const m = lireManifesteVite(racine);
  if (!m) throw new ErreurPresse("absent", "dist/.vite/manifest.json introuvable : npm run build d'abord");
  let pages: BudgetPage[];
  if (page) {
    const c = lirePage(racine, page);
    const b = budgetPage(m, path.join(racine, "dist"), racine, c.rel);
    if (!b) throw new ErreurPresse("absent", `${c.rel} n'est pas dans le build (vite.config.ts, puis npm run build)`);
    pages = [b];
  } else pages = tousLesBudgets(racine) ?? [];
  return { pages, depassements: pages.filter((p) => p.depasse).length };
}

/* ───────────────────────── Audit du mouvement ───────────────────────── */

export type Audit = { pages: number; constats: (ConstatMouvement & { pages: string[]; priorite: number })[]; parRegle: { regle: string; priorite: number; nombre: number; regleTexte: string }[] };

/** Le lint statique du mouvement, sur une page (ses sources propres) ou tout le dépôt (comme npm run mouvement:audit). */
export function auditMouvement(racine = RACINE_DEPOT, page?: string | null): Audit {
  let constats: (ConstatMouvement & { pages: string[] })[];
  let n: number;
  if (page) {
    const c = lirePage(racine, page);
    constats = lintPage(c.abs, racine, c.html).constats.map((x) => ({ ...x, pages: [c.rel] }));
    n = 1;
  } else {
    const pages = pagesDuDepot(racine);
    constats = auditerMouvement(racine, pages).map((x) => ({ ...x, pages: [...x.pages] }));
    n = pages.length;
  }
  const compte = new Map<string, number>();
  for (const c of constats) compte.set(c.regle, (compte.get(c.regle) ?? 0) + 1);
  const prio = (r: string) => (PRIORITES_MOUVEMENT as Record<string, number>)[r] ?? 9;
  return {
    pages: n,
    constats: constats.map((c) => ({ ...c, priorite: prio(c.regle) })),
    parRegle: [...compte]
      .map(([regle, nombre]) => ({ regle, priorite: prio(regle), nombre, regleTexte: (REGLES_MOUVEMENT as Record<string, string>)[regle] ?? "" }))
      .sort((a, b) => a.priorite - b.priorite || b.nombre - a.nombre),
  };
}

/* ───────────────────────── Ajouter un effet à une page (aperçu, sans écrire) ───────────────────────── */

export const empreinte = (texte: string) => createHash("sha256").update(texte).digest("hex");

/** La fin de la balise ouvrante qui commence en `debut` (`<`), guillemets compris. */
function finBalise(s: string, debut: number): number {
  let q: string | null = null;
  for (let i = debut + 1; i < s.length; i++) {
    const c = s[i]!;
    if (q) {
      if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === ">") return i + 1;
  }
  throw new ErreurPresse("usage", "balise ouvrante non fermée dans la page");
}

const echapper = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const reNom = (n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pose (ou retire, valeur null) des attributs dans le TEXTE d'une balise ouvrante : le reste de la page est intact. */
export function poserDansBalise(balise: string, attrs: readonly (readonly [string, string | null])[]): string {
  let t = balise;
  for (const [nom, valeur] of attrs) {
    const re = new RegExp(`(\\s+)${reNom(nom)}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'>]+))?(?=[\\s/>])`, "i");
    const texte = valeur === "" ? nom : `${nom}="${echapper(valeur ?? "")}"`;
    if (re.test(t)) t = valeur === null ? t.replace(re, "") : t.replace(re, (_m, esp: string) => `${esp}${texte}`);
    else if (valeur !== null) t = t.replace(/\s*(\/?)>$/, (_m, barre: string) => ` ${texte}${barre ? " /" : ""}>`);
  }
  return t;
}

type Modif = { debut: number; fin: number; texte: string };
const appliquerModifs = (s: string, modifs: Modif[]) => [...modifs].sort((a, b) => b.debut - a.debut).reduce((acc, m) => acc.slice(0, m.debut) + m.texte + acc.slice(m.fin), s);

/** Les modifications de balises ouvrantes qui posent `ecrits` sur `racine` (et ses `cible`) dans `source`. */
function modifsEcrits(source: string, racineEl: HTMLElement, ecrits: readonly Ecrit[], principaux: readonly (readonly [string, string])[], decalage = 0): { modifs: Modif[]; manques: string[] } {
  const parEl = new Map<HTMLElement, [string, string | null][]>();
  const ajouter = (el: HTMLElement, nom: string, v: string | null) => parEl.set(el, [...(parEl.get(el) ?? []), [nom, v]]);
  for (const [n, v] of principaux) ajouter(racineEl, n, v);
  const manques: string[] = [];
  for (const e of ecrits) {
    const els = e.cible ? (racineEl.querySelectorAll(e.cible) as HTMLElement[]) : [racineEl];
    if (!els.length) manques.push(`${e.nom} : aucun ${e.cible} sous l'élément`);
    for (const el of els) ajouter(el, e.nom, e.valeur);
  }
  const modifs: Modif[] = [];
  for (const [el, attrs] of parEl) {
    const d = el.range[0] + decalage;
    const f = finBalise(source, d);
    modifs.push({ debut: d, fin: f, texte: poserDansBalise(source.slice(d, f), attrs) });
  }
  return { modifs, manques };
}

export type OptionsAjout = {
  /** Réglages de la fiche, par clé (`fusion`) ou par attribut (`data-goo-fusion`), en texte ou en valeur. */
  reglages?: Record<string, unknown>;
  /** Sélecteur d'un élément EXISTANT de la page : l'effet s'y pose (attributs seulement). Sinon : la démo est insérée. */
  sur?: string;
  /** Où insérer la démo (sélecteur, à la fin de l'élément) ; défaut : `main`, sinon `body`. */
  dans?: string;
  /** Vrai : la feuille de style de la démo est ajoutée dans <head> (`<style data-presse-ajout>`). */
  css?: boolean;
};

export type Ajout = {
  page: string;
  effet: string;
  mode: "sur" | "demo";
  empreinteAvant: string;
  apres: string;
  diff: string;
  ecrits: { nom: string; valeur: string | null; cible: string | null }[];
  corrections: string[];
  notes: string[];
  /** Constats que l'ajout fait naître (comparés à ceux de la page avant), et le total après. */
  nouveaux: Constat[];
  erreursApres: number;
  /** Vrai si l'ajout n'introduit aucune erreur : la CLI et le MCP refusent d'écrire sinon. */
  ecrivable: boolean;
};

const cleConstat = (c: Constat) => `${c.gravite}|${c.regle}|${c.element}|${c.message}`;

function indentationAvant(s: string, i: number): string {
  const debutLigne = s.lastIndexOf("\n", i - 1) + 1;
  return /^[ \t]*/.exec(s.slice(debutLigne))![0];
}

/**
 * Prépare l'ajout d'un effet à une page, SANS écrire : le contenu proposé, son diff unifié, les attributs écrits, les
 * corrections du schéma (valeur bornée, arrondie), les constats du validateur que l'ajout fait naître.
 *   - mode « démo » (défaut) : la démo de la fiche, réglée, insérée à la fin de `dans` (main, sinon body), précédée
 *     d'un commentaire `<!-- presse : <id> -->` ; `css` ajoute sa feuille dans <head> ;
 *   - mode « sur » : les attributs principaux de la démo (ceux du manifeste) et les réglages posés sur un élément
 *     existant ; seules ses balises ouvrantes changent.
 */
export async function ajouterEffetAPage(racine: string, page: string, effet: string, options: OptionsAjout = {}): Promise<Ajout> {
  const m = manifeste(effet);
  const p = lirePage(racine, page);
  const f = await fiche(m);
  if (!f) throw new ErreurPresse("absent", `${effet} n'a pas de fiche Studio`);
  // Les réglages : par clé ou par attribut, validés par le schéma (src/studio/etat.ts, `regler`).
  let etat: Etat = etatInitial(f);
  const corrections: string[] = [];
  const cles = f.parametres.map((x) => x.cle);
  for (const [k, v] of Object.entries(options.reglages ?? {})) {
    const par = f.parametres.find((x) => x.cle === k) ?? f.parametres.find((x) => x.attribut === k);
    if (!par) throw new ErreurPresse("inconnu", `${effet} : réglage inconnu « ${k} » (presse parametres ${effet})`, proche(k, [...cles, ...f.parametres.map((x) => x.attribut)]));
    const r = regler(f, etat, par.cle, v);
    etat = r.etat;
    corrections.push(...r.corrections);
  }
  const ecrits = attributsDe(f, etat);
  const notes: string[] = [];
  const html = p.html;
  const doc = parse(html, { comment: true, blockTextElements: { script: true, noscript: true, style: true, pre: true } });
  const modifs: Modif[] = [];
  let mode: Ajout["mode"];

  if (options.sur) {
    mode = "sur";
    let cible: HTMLElement | null;
    try {
      cible = doc.querySelector(options.sur);
    } catch {
      throw new ErreurPresse("usage", `sélecteur illisible : ${options.sur}`);
    }
    if (!cible) throw new ErreurPresse("absent", `aucun élément ne répond à « ${options.sur} » dans ${p.rel}`);
    // Les attributs principaux : ceux que la démo pose sur sa racine et que le manifeste documente (data-forme="goutte").
    const principaux: [string, string][] = [];
    const demoDoc = f.demo ? parse(f.demo.html) : null;
    const demoRacine = demoDoc?.querySelector(f.demo?.racine ?? m.selecteur.split(",")[0]!.trim()) ?? null;
    if (demoRacine) {
      for (const [n, v] of Object.entries(demoRacine.attributes)) if (m.attributs.includes(n.toLowerCase())) principaux.push([n.toLowerCase(), v]);
    } else principaux.push([[...m.selecteur.matchAll(/\[([a-z0-9-]+)\]/g)][0]![1]!, ""]);
    if (demoRacine) {
      const enfants = new Set<string>();
      for (const d of demoRacine.querySelectorAll("*")) for (const n of Object.keys(d.attributes)) if (m.attributs.includes(n.toLowerCase())) enfants.add(n.toLowerCase());
      if (enfants.size) notes.push(`La démo de ${effet} pose aussi ${[...enfants].join(", ")} sur des enfants : à ajouter dans l'élément si l'effet en a besoin (presse effet ${effet}).`);
    }
    const r = modifsEcrits(html, cible, ecrits, principaux);
    modifs.push(...r.modifs);
    notes.push(...r.manques);
  } else {
    mode = "demo";
    if (!f.demo) throw new ErreurPresse("usage", `${effet} n'a pas de démo (${f.minimale ?? "fiche minimale"}) : poser l'effet sur un élément avec --sur <sélecteur>`);
    // La démo réglée : ses balises ouvrantes modifiées dans son propre texte (le reste reste tel qu'écrit dans la fiche).
    const demoHtml = f.demo.html;
    const demoDoc = parse(demoHtml, { comment: true });
    const demoRacine = demoDoc.querySelector(f.demo.racine ?? m.selecteur.split(",")[0]!.trim());
    if (!demoRacine) throw new ErreurPresse("absent", `${effet} : la racine de la démo est introuvable`);
    const r = modifsEcrits(demoHtml, demoRacine, ecrits, []);
    notes.push(...r.manques);
    const fragment = appliquerModifs(demoHtml, r.modifs);
    const selDans = options.dans ?? (doc.querySelector("main") ? "main" : "body");
    let hote: HTMLElement | null;
    try {
      hote = doc.querySelector(selDans);
    } catch {
      throw new ErreurPresse("usage", `sélecteur illisible : ${selDans}`);
    }
    if (!hote) throw new ErreurPresse("absent", `aucun élément ne répond à « ${selDans} » dans ${p.rel}`);
    const tag = (hote.rawTagName ?? "").toLowerCase();
    const finEl = hote.range[1];
    const fermeture = html.toLowerCase().lastIndexOf(`</${tag}`, finEl);
    if (fermeture < hote.range[0]) throw new ErreurPresse("usage", `<${tag}> sans balise fermante : préciser --dans`);
    const indHote = indentationAvant(html, hote.range[0]);
    const ind = `${indHote}  `;
    const bloc = `\n${ind}<!-- presse : ${effet} (${studio(effet)}) -->\n${fragment.split("\n").map((l) => (l ? ind + l : l)).join("\n")}\n${indHote}`;
    // Coller au contenu : retirer l'espace de fin avant la balise fermante, puis remettre l'indentation.
    let debut = fermeture;
    while (debut > 0 && /[ \t\n\r]/.test(html[debut - 1]!)) debut--;
    modifs.push({ debut, fin: fermeture, texte: bloc });
    if (f.demo.consigne) notes.push(`Démo : ${f.demo.consigne}`);
    if (f.demo.css) {
      if (options.css) {
        const head = doc.querySelector("head");
        const finHead = head ? html.toLowerCase().lastIndexOf("</head", head.range[1]) : -1;
        if (finHead < 0) throw new ErreurPresse("usage", "pas de <head> où poser la feuille de la démo");
        const indH = indentationAvant(html, head!.range[0]);
        let d = finHead;
        while (d > 0 && /[ \t\n\r]/.test(html[d - 1]!)) d--;
        const css = f.demo.css.split("\n").map((l) => (l ? `${indH}    ${l}` : l)).join("\n");
        modifs.push({ debut: d, fin: finHead, texte: `\n${indH}  <style data-presse-ajout="${effet}">\n${css}\n${indH}  </style>\n${indH}` });
      } else notes.push("La démo a sa feuille de style (presse effet --json : demo.css) : --css pour l'ajouter dans <head>, ou styler l'élément dans la feuille de la page.");
    }
  }
  if (m.manuel && /<html\b[^>]*\sdata-presse-manuel\b/i.test(html)) notes.push(`La page porte data-presse-manuel : elle doit importer ${m.module} et appeler son init elle-même (voir « Armement » dans le skill presse-page).`);
  if (m.rendu !== "DOM") notes.push(`Rendu ${m.rendu} : se juge sur une vraie machine ; sans carte graphique, le repli du module (${f.rendu ?? "voir PRESSE.md"}).`);

  const apres = appliquerModifs(html, modifs);
  const cat = catalogue(racine);
  const avantC = validerHtml(html, cat, { fichier: p.abs });
  const apresC = validerHtml(apres, cat, { fichier: p.abs });
  const vus = new Map<string, number>();
  for (const c of avantC) vus.set(cleConstat(c), (vus.get(cleConstat(c)) ?? 0) + 1);
  const nouveaux: Constat[] = [];
  for (const c of apresC) {
    const k = cleConstat(c);
    const n = vus.get(k) ?? 0;
    if (n > 0) vus.set(k, n - 1);
    else nouveaux.push(c);
  }
  return {
    page: p.rel,
    effet,
    mode,
    empreinteAvant: empreinte(html),
    apres,
    diff: diffUnifie(html, apres, p.rel),
    ecrits: ecrits.map((e) => ({ nom: e.nom, valeur: e.valeur, cible: e.cible })),
    corrections,
    notes,
    nouveaux,
    erreursApres: apresC.filter((c) => c.gravite === "erreur").length,
    ecrivable: !nouveaux.some((c) => c.gravite === "erreur") && apres !== html,
  };
}

/* ───────────────────────── Diff unifié (lignes, 3 de contexte) ───────────────────────── */

/** Un diff unifié de deux textes (en-têtes a/ et b/), vide s'ils sont égaux. */
export function diffUnifie(avant: string, apres: string, nom: string, contexte = 3): string {
  if (avant === apres) return "";
  const a = avant.split("\n");
  const b = apres.split("\n");
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const am = a.slice(pre, a.length - suf);
  const bm = b.slice(pre, b.length - suf);
  // LCS sur le milieu (petit : l'ajout est local) ; au-delà de 4 M cases, tout le milieu est remplacé.
  type Op = { t: " " | "-" | "+"; l: string };
  let ops: Op[];
  if (am.length * bm.length <= 4_000_000) {
    const L = Array.from({ length: am.length + 1 }, () => new Uint32Array(bm.length + 1));
    for (let i = am.length - 1; i >= 0; i--) for (let j = bm.length - 1; j >= 0; j--) L[i]![j] = am[i] === bm[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
    ops = [];
    let i = 0;
    let j = 0;
    while (i < am.length || j < bm.length) {
      if (i < am.length && j < bm.length && am[i] === bm[j]) (ops.push({ t: " ", l: am[i]! }), i++, j++);
      else if (i < am.length && (j >= bm.length || L[i + 1]![j]! >= L[i]![j + 1]!)) (ops.push({ t: "-", l: am[i]! }), i++);
      else (ops.push({ t: "+", l: bm[j]! }), j++);
    }
  } else ops = [...am.map((l) => ({ t: "-" as const, l })), ...bm.map((l) => ({ t: "+" as const, l }))];
  const tout: Op[] = [...a.slice(0, pre).map((l) => ({ t: " " as const, l })), ...ops, ...a.slice(a.length - suf).map((l) => ({ t: " " as const, l }))];
  // Les blocs : chaque changement avec `contexte` lignes autour, fusionnés s'ils se touchent.
  const changes = tout.map((o, k) => (o.t === " " ? -1 : k)).filter((k) => k >= 0);
  const blocs: [number, number][] = [];
  for (const k of changes) {
    const d = Math.max(0, k - contexte);
    const f = Math.min(tout.length, k + contexte + 1);
    const der = blocs[blocs.length - 1];
    if (der && d <= der[1]) der[1] = Math.max(der[1], f);
    else blocs.push([d, f]);
  }
  const lignes = [`--- a/${nom}`, `+++ b/${nom}`];
  for (const [d, f] of blocs) {
    let na = 1;
    let nb = 1;
    for (let k = 0; k < d; k++) {
      if (tout[k]!.t !== "+") na++;
      if (tout[k]!.t !== "-") nb++;
    }
    const morceau = tout.slice(d, f);
    const ca = morceau.filter((o) => o.t !== "+").length;
    const cb = morceau.filter((o) => o.t !== "-").length;
    lignes.push(`@@ -${ca ? na : na - 1},${ca} +${cb ? nb : nb - 1},${cb} @@`);
    for (const o of morceau) lignes.push(`${o.t}${o.l}`);
  }
  return `${lignes.join("\n")}\n`;
}

/* ───────────────────────── Ce que l'appelant écrit ───────────────────────── */

/**
 * Le contrôle d'avant écriture (la CLI et le MCP l'appellent juste avant d'écrire) : le chemin reconfiné, et la page
 * inchangée depuis l'aperçu (même empreinte), sinon refus. Ne fait que lire.
 */
export function verifierAvantEcriture(racine: string, page: string, empreinteAvant: string): Confine {
  const c = confiner(racine, page, [".html", ".css"]);
  if (!fs.existsSync(c.abs)) throw new ErreurPresse("absent", `page introuvable : ${c.rel}`);
  if (empreinte(fs.readFileSync(c.abs, "utf8")) !== empreinteAvant) throw new ErreurPresse("usage", `${c.rel} a changé depuis l'aperçu : refaire l'aperçu`);
  return c;
}

