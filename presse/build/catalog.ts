import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { SCHEMAS } from "./validate.ts";
import { PAPER_FILTERS, PAPER_ALIASES } from "../../src/gpu/paper.ts";

/**
 * Presse — le catalogue pour les agents (d'après Rune, recherche 16) : une seule source de vérité, générée à la
 * construction, pas réécrite à la main.
 *
 * - `presse-catalog.json` : les composants `<x-…>` et leurs attributs (avec les valeurs permises, depuis le schéma du
 *   validateur), les attributs `data-*` et les paramètres d'adresse (depuis le tableau « Attributs » de PRESSE.md),
 *   les filtres d'image (depuis src/gpu/paper.ts).
 * - `llms.txt` : le même, en texte court, à donner à un agent qui compose une page Presse.
 *
 * Le validateur (presse/build/validate.ts) refuse ce que le catalogue ne connaît pas : un agent qui suit le
 * catalogue écrit des pages valides.
 */
type Attr = { name: string; on: string; text: string };

export function readAttributes(root: string): Attr[] {
  const md = fs.readFileSync(path.join(root, "PRESSE.md"), "utf8");
  const start = md.indexOf("## Attributs");
  const end = md.indexOf("\n## ", start + 5);
  const out: Attr[] = [];
  for (const line of md.slice(start, end).split("\n")) {
    const m = line.match(/^\| (`[^|]+`(?:, `[^|]+`)*) \| ([^|]+) \| (.+) \|$/);
    if (!m) continue;
    const plain = (s: string) => s.replace(/`/g, "").trim();
    out.push({ name: plain(m[1]!), on: plain(m[2]!), text: plain(m[3]!) });
  }
  return out;
}

export function buildCatalog(root: string) {
  const components = Object.fromEntries(
    Object.entries(SCHEMAS).map(([tag, spec]) => [
      `x-${tag}`,
      Object.fromEntries(Object.entries(spec.attrs).map(([k, v]) => [k, Array.isArray(v) ? v : v === "num" ? "nombre" : "texte"])),
    ]),
  );
  const filters = Object.keys(PAPER_FILTERS);
  const aliases = PAPER_ALIASES;
  const attributes = readAttributes(root);
  const json = { version: 1, generated: "à la construction (presse/build/catalog.ts)", components, attributes, filters: { names: filters, aliases } };
  const lines = [
    "# Presse",
    "",
    "> Un framework de pages web où le DOM compose et le GPU imprime : du HTML ordinaire, des attributs data-* qui disent au GPU quoi en faire, des balises <x-…> déroulées en HTML statique à la construction. Sans WebGPU, la page reste du HTML complet.",
    "",
    "## Règles",
    "- Écrire du HTML sémantique d'abord (titres, listes, liens, boutons, alt) ; les effets s'ajoutent par attributs.",
    "- N'utiliser que les attributs et valeurs ci-dessous ; le validateur signale le reste à la construction.",
    "- Le mouvement doit passer le linter (?presse-lint) : pas de saut, d'apparition sèche, d'arrêt net.",
    "",
    "## Composants",
    ...Object.entries(components).map(([tag, attrs]) => `- <${tag}> : ${Object.entries(attrs).map(([k, v]) => (Array.isArray(v) ? `${k}=${v.join("|")}` : `${k} (${v})`)).join(", ")}`),
    "",
    "## Attributs et paramètres d'adresse",
    ...attributes.map((a) => `- ${a.name} (sur ${a.on}) : ${a.text}`),
    "",
    "## Filtres d'image (data-gl-filter)",
    `- ${filters.join(", ")}`,
    `- alias : ${Object.entries(aliases).map(([k, v]) => `${k} → ${v}`).join(", ")}`,
    "",
  ];
  return { json, text: lines.join("\n") };
}

export function presseCatalog(root: string): Plugin {
  return {
    name: "presse-catalog",
    apply: "build",
    generateBundle() {
      const { json, text } = buildCatalog(root);
      this.emitFile({ type: "asset", fileName: "presse-catalog.json", source: `${JSON.stringify(json, null, 2)}\n` });
      this.emitFile({ type: "asset", fileName: "llms.txt", source: text });
    },
  };
}
