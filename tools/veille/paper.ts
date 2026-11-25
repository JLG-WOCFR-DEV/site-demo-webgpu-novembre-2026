/**
 * Veille Paper Shaders — la partie pure de tools/veille-paper.mjs (testée par src/registre/veille-paper.test.ts sur un
 * faux paquet) : lire les shaders qu'exporte un paquet `@paper-design/shaders` déballé, les comparer à ce que Presse
 * couvre, écrire le rapport docs/veille-paper.md.
 *
 * Rien n'est inventé : la liste des shaders est celle des exports `<nom>FragmentShader` de `dist/index.js` du paquet
 * (le nom kebab vient du fichier `dist/shaders/<nom>.js` qui l'exporte) ; un shader « prend une image » si son source
 * déclare l'uniforme `u_image`. La couverture vient du code :
 *   - WGSL : les filtres portés dans src/gpu/paper.ts (`PAPER_FILTERS`, attribut `data-gl-filter`) ;
 *   - WebGL2 : les matières du logo (src/presse/logo.ts, `MATIERES[m].shader`, attribut `data-logo`) ;
 *   - mentions : un nom (kebab ou camelCase) cité dans src/components (indicatif : une implémentation maison, pas Paper).
 */
import fs from "node:fs";
import path from "node:path";

export type ShaderPaper = { nom: string; exporte: string; image: boolean; uniformes: string[] };
export type Paquet = { version: string; shaders: ShaderPaper[] };

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
export const camel = (s: string) => s.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

/** Lit un paquet déballé (le dossier qui contient package.json et dist/). */
export function lirePaquet(dossier: string): Paquet {
  const pj = JSON.parse(fs.readFileSync(path.join(dossier, "package.json"), "utf8")) as { name?: string; version: string };
  const index = fs.readFileSync(path.join(dossier, "dist/index.js"), "utf8");
  const shaders: ShaderPaper[] = [];
  // import { …xFragmentShader… } from "./shaders/<fichier>.js"
  for (const m of index.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']\.\/shaders\/([\w-]+)\.js["']/g)) {
    const noms = m[1]!.split(",").map((x) => x.trim().split(/\s+as\s+/).pop()!).filter((x) => /FragmentShader$/.test(x));
    const fichier = path.join(dossier, "dist/shaders", `${m[2]}.js`);
    const src = fs.existsSync(fichier) ? fs.readFileSync(fichier, "utf8") : "";
    for (const exporte of noms) {
      const uniformes = [...new Set([...src.matchAll(/uniform\s+\w+\s+(u_\w+)/g)].map((u) => u[1]!))].sort();
      shaders.push({ nom: m[2]!, exporte, image: uniformes.includes("u_image"), uniformes });
    }
  }
  // Repli : un export direct `export { xFragmentShader }` sans import de fichier.
  if (!shaders.length)
    for (const m of index.matchAll(/\b(\w+)FragmentShader\b/g)) if (!shaders.some((s) => s.exporte === `${m[1]}FragmentShader`)) shaders.push({ nom: kebab(m[1]!), exporte: `${m[1]}FragmentShader`, image: false, uniformes: [] });
  // Les exports réels seulement (un import non réexporté ne compte pas).
  const exportes = new Set([...index.matchAll(/export\s*\{([^}]*)\}/g)].flatMap((m) => m[1]!.split(",").map((x) => x.trim().split(/\s+as\s+/).pop()!)));
  const out = exportes.size ? shaders.filter((s) => exportes.has(s.exporte)) : shaders;
  return { version: pj.version, shaders: out.sort((a, b) => a.nom.localeCompare(b.nom)) };
}

export type Couverture = { wgsl: Set<string>; webgl2: Map<string, string[]>; mentions: Map<string, string[]> };

/** Ce que Presse couvre, lu dans le code du dépôt (`racine`). */
export function lireCouverture(racine: string, filtresWgsl: Iterable<string>, matieres: Iterable<{ id: string; shader: string }>, noms: Iterable<string>): Couverture {
  const wgsl = new Set(filtresWgsl);
  const webgl2 = new Map<string, string[]>();
  for (const m of matieres) {
    const n = kebab(m.shader.replace(/FragmentShader$/, ""));
    webgl2.set(n, [...(webgl2.get(n) ?? []), m.id]);
  }
  const mentions = new Map<string, string[]>();
  const fichiers: string[] = [];
  const marcher = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) marcher(p);
      else if (/\.(ts|js|wgsl|glsl)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) fichiers.push(p);
    }
  };
  marcher(path.join(racine, "src/components"));
  const textes = fichiers.map((f) => [path.relative(racine, f).split(path.sep).join("/"), fs.readFileSync(f, "utf8")] as const);
  for (const n of noms) {
    const re = new RegExp(`\\b(${n}|${camel(n)})\\b`, "i");
    const ou = textes.filter(([, t]) => re.test(t)).map(([f]) => f);
    if (ou.length) mentions.set(n, ou);
  }
  return { wgsl, webgl2, mentions };
}

export type Ligne = { nom: string; image: boolean; palette: boolean; wgsl: boolean; webgl2: string[]; mentions: string[]; nouveau: boolean };
export type Analyse = { installee: string; derniere: string | null; reseau: string; lignes: Ligne[]; disparus: string[] };

export function analyser(installe: Paquet, dernier: Paquet | null, c: Couverture, reseau: string): Analyse {
  const ref = dernier ?? installe;
  const avant = new Set(installe.shaders.map((s) => s.nom));
  const lignes = ref.shaders.map((s) => ({ nom: s.nom, image: s.image, palette: s.uniformes.includes("u_colors"), wgsl: c.wgsl.has(s.nom), webgl2: c.webgl2.get(s.nom) ?? [], mentions: c.mentions.get(s.nom) ?? [], nouveau: !!dernier && !avant.has(s.nom) }));
  const disparus = dernier ? installe.shaders.map((s) => s.nom).filter((n) => !dernier.shaders.some((s) => s.nom === n)) : [];
  return { installee: installe.version, derniere: dernier?.version ?? null, reseau, lignes, disparus };
}

export type Idee = { priorite: 1 | 2 | 3; shader: string; idee: string };

/**
 * Les idées d'intégration, classées par effet rapporté à l'effort :
 *   1. un shader à image déjà joué en WebGL2 par le logo mais pas porté en WGSL : le moteur l'aurait en
 *      `data-gl-filter` sur toute la page, sans second contexte (une idée par shader) ;
 *   2. les shaders génératifs à palette (`u_colors`) : un fond de section animé dont les couleurs viennent du système
 *      de design (variables `--presse-*`), joué par le rendu WebGL2 du logo (une idée pour le groupe) ;
 *   3. les autres génératifs (deux couleurs, motifs) : matières du logo ou fonds ; et les nouveautés d'une version.
 */
export function idees(a: Analyse): Idee[] {
  const out: Idee[] = [];
  const liste = (l: Ligne[]) => l.map((x) => `\`${x.nom}\``).join(", ");
  for (const l of a.lignes) {
    if (l.nouveau) out.push({ priorite: 3, shader: l.nom, idee: `nouveau dans ${a.derniere} : lire son source et sa licence avant de monter de version` });
    else if (l.image && !l.wgsl && l.webgl2.length) out.push({ priorite: 1, shader: l.nom, idee: `porter en WGSL (src/gpu/paper.ts, \`data-gl-filter="${l.nom}"\`) : déjà joué en WebGL2 par le logo (${l.webgl2.join(", ")}) ; porté, il s'ouvre à toute la page, dans la composition du moteur` });
    else if (l.image && !l.wgsl) out.push({ priorite: 1, shader: l.nom, idee: "shader à image non couvert : matière du logo d'abord (WebGL2, src/presse/logo.ts), puis port WGSL" });
  }
  const gen = a.lignes.filter((l) => !l.image && !l.wgsl && !l.webgl2.length && !l.nouveau);
  const pal = gen.filter((l) => l.palette);
  const autres = gen.filter((l) => !l.palette);
  if (pal.length) out.push({ priorite: 2, shader: pal.map((l) => l.nom).join(", "), idee: `génératifs à palette (${liste(pal)}) : un effet « fond de section » du registre, couleurs tirées du système de design (\`--presse-*\`), rendu WebGL2 réutilisé de logo-rendu.ts ; une fiche Studio par shader` });
  if (autres.length) out.push({ priorite: 3, shader: autres.map((l) => l.nom).join(", "), idee: `autres génératifs (${liste(autres)}) : matières supplémentaires du logo ou fonds, après le groupe à palette${autres.some((l) => l.mentions.length) ? ` ; versions maison possibles : ${autres.filter((l) => l.mentions.length).map((l) => `${l.nom} (${l.mentions.join(", ")})`).join(", ")}` : ""}` });
  return out.sort((x, y) => x.priorite - y.priorite || x.shader.localeCompare(y.shader));
}

/** Le rapport Markdown (docs/veille-paper.md). */
export function rapportMarkdown(a: Analyse, date: string): string {
  const couverts = a.lignes.filter((l) => l.wgsl || l.webgl2.length);
  const non = a.lignes.filter((l) => !l.wgsl && !l.webgl2.length);
  const L: string[] = [
    "# Veille Paper Shaders",
    "",
    `Généré par \`npm run veille:paper\` (tools/veille-paper.mjs) le ${date}. Ne pas éditer à la main.`,
    "",
    `- Version installée : **${a.installee}** (package.json, node_modules)`,
    `- Dernière version publiée (npm, dist-tag \`latest\`) : **${a.derniere ?? "inconnue"}** — ${a.reseau}`,
    `- Shaders exportés (${a.derniere ? `version ${a.derniere}` : `version installée ${a.installee}`}) : ${a.lignes.length} ; couverts par Presse : ${couverts.length} ; non couverts : ${non.length}.`,
    a.derniere && a.derniere !== a.installee ? `- **Montée possible** : ${a.installee} → ${a.derniere}.` : "- Aucune montée de version à faire : la version installée est la dernière publiée.",
    a.disparus.length ? `- Disparus depuis la version installée : ${a.disparus.join(", ")}.` : "",
    "",
    "Couverture lue dans le code : WGSL = `PAPER_FILTERS` de src/gpu/paper.ts (`data-gl-filter`) ; WebGL2 = matières de src/presse/logo.ts (`data-logo`, Paper tel quel) ; mentions = nom cité dans src/components (indicatif).",
    "",
    "## Couverts",
    "",
    "| Shader | Image | WGSL (moteur) | WebGL2 (logo) |",
    "|---|---|---|---|",
    ...couverts.map((l) => `| \`${l.nom}\` | ${l.image ? "oui" : "non"} | ${l.wgsl ? "oui" : "—"} | ${l.webgl2.join(", ") || "—"} |`),
    "",
    "## Non couverts",
    "",
    "| Shader | Image | Palette (`u_colors`) | Nouveau | Mentions dans src/components |",
    "|---|---|---|---|---|",
    ...non.map((l) => `| \`${l.nom}\` | ${l.image ? "oui" : "non"} | ${l.palette ? "oui" : "non"} | ${l.nouveau ? "oui" : "—"} | ${l.mentions.join(", ") || "—"} |`),
    "",
    "## Idées d'intégration (par priorité)",
    "",
    ...idees(a).map((i) => `- **P${i.priorite}** ${i.shader.includes(",") ? "" : `\`${i.shader}\` — `}${i.idee}.`),
    "",
  ];
  return L.filter((x, i, t) => !(x === "" && t[i - 1] === "")).join("\n");
}
