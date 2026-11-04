import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import type { Plugin } from "vite";

/**
 * Plugin Vite : la liste des fichiers d'un site autonome exporté par le Créateur.
 *
 * Après la construction, on part de la page gabarit (createur-site.html) et on suit tout ce qu'elle charge : scripts,
 * feuilles de style, puis, de proche en proche, les modules chargés à la demande (composants, shaders) et les fontes
 * citées par les CSS. Le Créateur lit dist/createur-export.json et emballe ces fichiers avec la page (un zip).
 */
export function presseExport(page = "createur-site.html"): Plugin {
  let outDir = "dist";
  return {
    name: "presse-export",
    apply: "build",
    configResolved(c) {
      outDir = c.build.outDir.startsWith("/") ? c.build.outDir : join(c.root, c.build.outDir);
    },
    closeBundle() {
      const html = join(outDir, page);
      if (!existsSync(html)) return;
      const seen = new Set<string>();
      const queue: string[] = [];
      const add = (from: string, ref: string) => {
        if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(ref)) return;
        const file = normalize(join(dirname(from), ref.split(/[?#]/)[0]!));
        const rel = relative(outDir, file);
        if (rel.startsWith("..") || seen.has(rel) || !existsSync(file)) return;
        seen.add(rel);
        queue.push(file);
      };
      const src = readFileSync(html, "utf8");
      for (const m of src.matchAll(/(?:src|href)="([^"]+)"/g)) add(html, m[1]!);
      while (queue.length) {
        const f = queue.shift()!;
        if (/\.js$/.test(f)) {
          // Imports statiques et dynamiques, et chemins d'assets écrits dans le code (« ./galerie-AbC.js », new URL(…)).
          for (const m of readFileSync(f, "utf8").matchAll(/["'`](\.{1,2}\/[\w./-]+\.(?:js|css|woff2?|ttf|png|jpe?g|webp|avif|svg|json|wasm|glb))["'`]/g)) add(f, m[1]!);
        } else if (/\.css$/.test(f)) {
          for (const m of readFileSync(f, "utf8").matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) add(f, m[1]!);
        }
      }
      const files = [...seen].filter((f) => f !== page).sort();
      writeFileSync(join(outDir, "createur-export.json"), JSON.stringify({ page, files }, null, 0));
    },
  };
}
