import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse, type HTMLElement as Node } from "node-html-parser";
import type { Plugin } from "vite";
import { COMPONENTS, STYLES } from "./components.ts";

/**
 * Plugin Vite : déroule les balises <x-…> de chaque page, en développement
 * (rechargement à chaud compris) comme à la construction.
 */
export function presseComponents(): Plugin {
  return {
    name: "presse-components",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        if (!/<x-[a-z]/.test(html)) return html;
        const root = parse(html, { comment: true, blockTextElements: { script: true, style: true, pre: true, textarea: true } });
        const base = dirname(ctx.filename);
        const used = new Set<string>();
        // Les composants peuvent en contenir d'autres : on déroule jusqu'à épuisement.
        for (let pass = 0; pass < 6; pass++) {
          const tags = root.querySelectorAll("*").filter((n) => n.rawTagName?.toLowerCase().startsWith("x-"));
          if (!tags.length) break;
          for (const el of tags) {
            const name = el.rawTagName.toLowerCase().slice(2);
            const render = COMPONENTS[name];
            if (!render) throw new Error(`Presse : composant inconnu <x-${name}> dans ${ctx.filename}`);
            used.add(name);
            const out = render(el.attributes, el.childNodes.filter((c): c is Node => c.nodeType === 1), {
              read: (p) => readFileSync(resolve(base, p), "utf8"),
            });
            el.replaceWith(out);
          }
        }
        // La feuille de style de chaque composant employé, dans le <head> : la
        // page est mise en forme avant tout script (Vite la regroupe à la construction).
        const head = root.querySelector("head");
        const links = [...used].flatMap((n) => (STYLES[n] ? [`<link rel="stylesheet" href="${STYLES[n]}" data-presse-style="${n}" />`] : []));
        if (head && links.length) {
          const first = head.querySelector("script, link[rel=stylesheet]");
          if (first) first.insertAdjacentHTML("beforebegin", `${links.join("\n    ")}\n    `);
          else head.insertAdjacentHTML("beforeend", links.join("\n"));
        }
        return root.toString();
      },
    },
  };
}
