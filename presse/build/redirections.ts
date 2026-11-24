import type { Plugin } from "vite";
import { REDIRECTIONS, pageRedirection } from "../../src/nav/redirections.ts";

/**
 * Les pages de redirection (src/nav/redirections.ts) : une page HTML par ancienne adresse, écrite dans dist au build.
 * Liste vide aujourd'hui (aucune page n'a bougé) : le greffon ne produit rien.
 */
export function presseRedirections(): Plugin {
  return {
    name: "presse-redirections",
    apply: "build",
    generateBundle() {
      for (const r of REDIRECTIONS) this.emitFile({ type: "asset", fileName: r.de, source: pageRedirection(r) });
    },
  };
}
