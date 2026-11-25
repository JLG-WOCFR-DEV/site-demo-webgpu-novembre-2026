/**
 * Pour les tests de la CLI et du MCP presse : une copie temporaire du dépôt (ce que le cœur lit : pages de la racine,
 * PRESSE.md, vite.config.ts, src/, presse/, tools/valider/, le skill), dans le dossier temporaire du système. Les
 * tests d'écriture n'écrivent QUE là, jamais dans le dépôt. Ni dist/ (pas de build : le budget y est « introuvable »),
 * ni public/, ni node_modules (le code du cœur est celui du dépôt ; seule la racine lue change).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RACINE_DEPOT } from "./coeur.ts";

export function copierDepot(): { racine: string; nettoyer: () => void } {
  const racine = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "presse-essai-")));
  for (const f of fs.readdirSync(RACINE_DEPOT)) if (/\.(html|md)$/.test(f) || f === "vite.config.ts" || f === "package.json") fs.copyFileSync(path.join(RACINE_DEPOT, f), path.join(racine, f));
  for (const d of ["src", "presse", "tools/valider", ".claude/skills/presse-page"]) fs.cpSync(path.join(RACINE_DEPOT, d), path.join(racine, d), { recursive: true });
  return { racine, nettoyer: () => fs.rmSync(racine, { recursive: true, force: true }) };
}

/** La page qui sert aux essais d'écriture : sans data-presse-manuel, avec un <main> et un <h1>. */
export const PAGE_ESSAI = "goo.html";
