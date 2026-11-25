/**
 * Presse — le poids JavaScript, mesuré sur le build (dist/.vite/manifest.json, `build.manifest: true` dans
 * vite.config.ts) : par effet du registre (tools/mesurer-effets.mjs → src/registre/couts.json) et par page (budget,
 * avertissement du validateur, rapport `npm run budgets`).
 *
 * Règles de mesure (gzip niveau 9, en ko de 1024 octets, arrondis au dixième) :
 *   - la FERMETURE statique d'un morceau : son fichier et, de proche en proche, ses `imports` (pas ses `import()`) ;
 *     seulement les `.js` (le budget est un budget JS ; les CSS et les polices sont à part) ;
 *   - un EFFET coûte la fermeture de son module (`src/presse/<id>.ts`, entrée dynamique) MOINS celle de pages-nav
 *     (déjà payée par toute page Presse) : ce que la page télécharge en plus quand elle arme l'effet ; son DIFFÉRÉ est
 *     ce que ses `import()` internes ajoutent ensuite (le rendu de logo, Paper Shaders…), hors pages-nav ;
 *   - une PAGE coûte sa fermeture statique (son entrée HTML : pages-nav compris) PLUS ses différés : les effets du
 *     registre dont le sélecteur répond à son HTML source (ce que pages-nav ou la page armeront), avec leur différé.
 *     Limite : un effet posé par script (cartes de boutique.html construites en JS) n'est pas vu dans le HTML source ;
 *     les `import()` propres à une page (palette Ctrl+K, éditeurs) ne sont pas comptés.
 * Seuil par défaut : 250 ko gzip par page ; une page peut avoir une dérogation, avec sa raison, dans
 * tools/valider/budgets.json. Dépasser est un AVERTISSEMENT du validateur, jamais une erreur.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { parse } from "node-html-parser";
import { EFFETS, type Manifeste } from "../../src/registre/effets.ts";
import { lirePagesVite } from "./pages-vite.ts";

export type Morceau = { file: string; src?: string; name?: string; isEntry?: boolean; isDynamicEntry?: boolean; imports?: string[]; dynamicImports?: string[]; css?: string[] };
export type ManifesteVite = Record<string, Morceau>;

export const SEUIL_DEFAUT = 250;

export type Budgets = { seuil: number; derogations: Record<string, { seuil: number; raison: string }> };

/** budgets.json lu (ou les défauts s'il manque) ; une dérogation sans raison est refusée. */
export function lireBudgets(racine: string): Budgets {
  const p = path.join(racine, "tools/valider/budgets.json");
  if (!fs.existsSync(p)) return { seuil: SEUIL_DEFAUT, derogations: {} };
  const j = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<Budgets>;
  const derogations = j.derogations ?? {};
  for (const [page, d] of Object.entries(derogations)) if (!d.raison?.trim() || !(d.seuil > 0)) throw new Error(`tools/valider/budgets.json : la dérogation de ${page} demande un seuil (ko) et une raison`);
  return { seuil: j.seuil ?? SEUIL_DEFAUT, derogations };
}

export function lireManifesteVite(racine: string): ManifesteVite | null {
  const p = path.join(racine, "dist/.vite/manifest.json");
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as ManifesteVite) : null;
}

/** Les clés de la fermeture statique de `cles` (elles comprises). */
export function fermeture(m: ManifesteVite, cles: Iterable<string>, vus = new Set<string>()): Set<string> {
  const pile = [...cles];
  while (pile.length) {
    const k = pile.pop()!;
    if (vus.has(k) || !m[k]) continue;
    vus.add(k);
    pile.push(...(m[k].imports ?? []));
  }
  return vus;
}

/** Les `import()` atteints depuis `cles`, et leur fermeture statique (puis leurs propres `import()`). */
export function fermetureDifferee(m: ManifesteVite, cles: Iterable<string>, exclure: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  const statique = fermeture(m, cles);
  let front = [...statique].flatMap((k) => m[k]?.dynamicImports ?? []);
  while (front.length) {
    const neuf = [...fermeture(m, front)].filter((k) => !out.has(k) && !statique.has(k) && !exclure.has(k));
    for (const k of neuf) out.add(k);
    front = neuf.flatMap((k) => m[k]?.dynamicImports ?? []);
  }
  return out;
}

/** La clé du morceau partagé de pages-nav (`_pages-nav-<hash>.js`), base de tout effet. */
export const clePagesNav = (m: ManifesteVite) => Object.keys(m).find((k) => /^_pages-nav-[\w-]+\.js$/.test(k)) ?? null;

const cacheGzip = new Map<string, number>();
/** ko gzip -9 d'un fichier de dist. */
export function koGzip(dist: string, fichier: string): number {
  let n = cacheGzip.get(fichier);
  if (n === undefined) {
    n = zlib.gzipSync(fs.readFileSync(path.join(dist, fichier)), { level: 9 }).length / 1024;
    cacheGzip.set(fichier, n);
  }
  return n;
}
const arrondi = (x: number) => Math.round(x * 10) / 10;
/** Les fichiers .js des clés, et leur somme en ko gzip. */
export function poids(m: ManifesteVite, dist: string, cles: Iterable<string>): { ko: number; fichiers: string[] } {
  const fichiers = [...new Set([...cles].map((k) => m[k]?.file).filter((f): f is string => !!f && f.endsWith(".js")))].sort();
  return { ko: arrondi(fichiers.reduce((s, f) => s + koGzip(dist, f), 0)), fichiers };
}

export type CoutMesure = { js: number; differe: number; fichiers: string[] };

/** Le coût mesuré de chaque effet du registre (voir l'en-tête). */
export function mesurerEffets(m: ManifesteVite, dist: string, effets: readonly Pick<Manifeste, "id" | "module">[] = EFFETS): Record<string, CoutMesure> {
  const pn = clePagesNav(m);
  const base = pn ? fermeture(m, [pn]) : new Set<string>();
  const out: Record<string, CoutMesure> = {};
  for (const e of effets) {
    if (!m[e.module]) throw new Error(`${e.id} : ${e.module} absent du manifeste du build (npm run build d'abord)`);
    const propre = [...fermeture(m, [e.module])].filter((k) => !base.has(k));
    const differe = fermetureDifferee(m, propre, base);
    out[e.id] = { js: poids(m, dist, propre).ko, differe: poids(m, dist, differe).ko, fichiers: poids(m, dist, propre).fichiers };
  }
  return out;
}

export type BudgetPage = { page: string; statique: number; differe: number; total: number; seuil: number; effets: string[]; raison?: string; depasse: boolean };

/** Les effets du registre dont le sélecteur répond au HTML source de la page. */
export function effetsDeLaPage(html: string, effets: readonly Pick<Manifeste, "id" | "selecteur">[] = EFFETS): string[] {
  const doc = parse(html);
  return effets.filter((e) => e.selecteur.split(",").some((s) => doc.querySelector(s.trim()))).map((e) => e.id);
}

/**
 * Les morceaux qu'une page construite charge d'emblée : ses `<script type="module" src>` et `<link rel="modulepreload">`
 * dans dist/<page> (le manifeste seul ne suffit pas : une page dont le script est partagé — conference et
 * diapo-demos, index — n'y a pas d'entrée HTML). `null` si la page n'est pas construite.
 */
export function entreesPage(m: ManifesteVite, dist: string, page: string): string[] | null {
  const p = path.join(dist, page);
  if (!fs.existsSync(p)) return null;
  const doc = parse(fs.readFileSync(p, "utf8"));
  const urls = [...doc.querySelectorAll('script[type="module"][src]').map((x) => x.getAttribute("src")!), ...doc.querySelectorAll('link[rel="modulepreload"][href]').map((x) => x.getAttribute("href")!)];
  const parFichier = new Map(Object.entries(m).map(([k, v]) => [v.file, k]));
  const cles = new Set<string>();
  for (const u of urls) {
    const f = path.posix.normalize(path.posix.join(path.posix.dirname(page), u.replace(/^\.\//, ""))).replace(/^\//, "");
    const k = parFichier.get(f) ?? (m[page]?.file === f ? page : undefined);
    if (k) cles.add(k);
  }
  if (m[page]) cles.add(page);
  return [...cles];
}

/** Le budget d'une page (`page` : son chemin relatif à la racine, une page de vite.config.ts construite dans dist/). */
export function budgetPage(m: ManifesteVite, dist: string, racine: string, page: string, b: Budgets = lireBudgets(racine)): BudgetPage | null {
  const entrees = entreesPage(m, dist, page);
  if (!entrees || !fs.existsSync(path.join(racine, page))) return null;
  const statiques = fermeture(m, entrees);
  const html = fs.readFileSync(path.join(racine, page), "utf8");
  const effets = effetsDeLaPage(html);
  const cles = new Set<string>();
  for (const id of effets) {
    const e = EFFETS.find((x) => x.id === id)!;
    for (const k of fermeture(m, [e.module])) if (!statiques.has(k)) cles.add(k);
  }
  for (const k of fermetureDifferee(m, [...cles], statiques)) cles.add(k);
  const s = poids(m, dist, statiques).ko;
  const d = poids(m, dist, cles).ko;
  const der = b.derogations[page];
  const seuil = der?.seuil ?? b.seuil;
  return { page, statique: s, differe: d, total: arrondi(s + d), seuil, effets, ...(der ? { raison: der.raison } : {}), depasse: s + d > seuil };
}

/** Tous les budgets (pages HTML du manifeste, dans l'ordre alphabétique). */
export function budgets(racine: string): BudgetPage[] | null {
  const m = lireManifesteVite(racine);
  if (!m) return null;
  const dist = path.join(racine, "dist");
  const b = lireBudgets(racine);
  const pages = lirePagesVite(fs.readFileSync(path.join(racine, "vite.config.ts"), "utf8"));
  return [...new Set(pages)]
    .sort()
    .map((p) => budgetPage(m, dist, racine, p, b))
    .filter((x): x is BudgetPage => !!x);
}

/** Le constat du validateur pour une page (avertissement), ou rien. */
export function constatBudget(racine: string, fichier: string): { gravite: "avertissement"; regle: "budget"; ligne: number; element: string; message: string } | null {
  const m = lireManifesteVite(racine);
  if (!m) return null;
  const page = path.relative(racine, path.resolve(fichier)).split(path.sep).join("/");
  const r = budgetPage(m, path.join(racine, "dist"), racine, page);
  if (!r || !r.depasse) return null;
  return {
    gravite: "avertissement",
    regle: "budget",
    ligne: 1,
    element: "",
    message: `JavaScript ${r.total} ko gzip (statique ${r.statique} + différé ${r.differe}) pour un budget de ${r.seuil} ko${r.raison ? ` (dérogation : ${r.raison})` : ""} — npm run budgets ; une dérogation se documente dans tools/valider/budgets.json`,
  };
}

/** Le rapport tabulaire (Markdown) de `npm run budgets`. */
export function tableauBudgets(lignes: readonly BudgetPage[]): string {
  const f = (n: number) => n.toFixed(1).replace(".", ",");
  const t = ["| Page | Statique | Différé | Total | Budget | État | Effets armés |", "|---|--:|--:|--:|--:|---|---|"];
  for (const l of lignes) t.push(`| ${l.page} | ${f(l.statique)} | ${f(l.differe)} | ${f(l.total)} | ${l.seuil}${l.raison ? " *" : ""} | ${l.depasse ? "dépasse" : "ok"} | ${l.effets.join(", ") || "—"} |`);
  const der = lignes.filter((l) => l.raison);
  if (der.length) t.push("", ...der.map((l) => `\\* ${l.page} : ${l.raison}`));
  return t.join("\n");
}
