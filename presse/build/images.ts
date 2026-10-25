import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "node-html-parser";
import type { Plugin } from "vite";

/**
 * Presse — chaîne d'images, côté construction (feuille de route A6).
 *
 * Chaque <img> dont la source a été préparée par tools/images.py est réécrite :
 * - entourée d'un <picture> (AVIF, puis WebP, puis l'original), aux largeurs
 *   préparées, que le navigateur choisit selon `sizes` ;
 * - dimensions posées si elles manquent (pas de saut de mise en page) ;
 * - couleur moyenne en fond tant que l'image charge ;
 * - data-gl-tex (la plus grande largeur, pour les plans du moteur) et
 *   data-gl-mips (la chaîne de mipmaps filtrée à la construction, pour les
 *   tableaux de textures de la grille et du liquide).
 * Le <picture> est en display: contents : il ne change pas la mise en page,
 * l'<img> reste l'élément que lisent le CSS et le moteur.
 */
type Entry = { w: number; h: number; widths: number[]; base: string; mips: string; color: string };
const DEFAULT_SIZES = "(max-width: 760px) 100vw, 50vw";

export function presseImages(root: string): Plugin {
  const manPath = resolve(root, "public/img/manifest.json");
  const load = (): Record<string, Entry> => (existsSync(manPath) ? JSON.parse(readFileSync(manPath, "utf8")) : {});
  let manifest = load();
  return {
    name: "presse-images",
    configureServer(server) {
      server.watcher.add(manPath);
      server.watcher.on("change", (f) => {
        if (resolve(f) === manPath) manifest = load();
      });
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (!Object.keys(manifest).length || !/<img\b/.test(html)) return html;
        const doc = parse(html, { comment: true, blockTextElements: { script: true, style: true, pre: true, textarea: true } });
        let n = 0;
        for (const img of doc.querySelectorAll("img")) {
          const src = img.getAttribute("src") ?? "";
          const key = src.replace(/^\.?\//, "");
          const e = manifest[key];
          if (!e || img.parentNode?.rawTagName?.toLowerCase() === "picture" || img.hasAttribute("data-presse-raw")) continue;
          const prefix = src.startsWith("/") ? "/" : "./";
          const url = (f: string) => prefix + f;
          const set = (ext: string) => e.widths.map((w) => `${url(`${e.base}-${w}.${ext}`)} ${w}w`).join(", ");
          const sizes = img.getAttribute("sizes") ?? DEFAULT_SIZES;
          if (!img.hasAttribute("width")) img.setAttribute("width", String(e.w));
          if (!img.hasAttribute("height")) img.setAttribute("height", String(e.h));
          if (!img.hasAttribute("decoding")) img.setAttribute("decoding", "async");
          img.setAttribute("data-gl-tex", url(`${e.base}-${e.widths.at(-1)}.avif`));
          img.setAttribute("data-gl-mips", url(e.mips));
          const style = img.getAttribute("style");
          img.setAttribute("style", `${style ? `${style.replace(/;?\s*$/, ";")} ` : ""}background-color:${e.color}`);
          img.removeAttribute("sizes");
          img.replaceWith(
            `<picture><source type="image/avif" srcset="${set("avif")}" sizes="${sizes}" /><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}" />${img.toString()}</picture>`,
          );
          n++;
        }
        if (!n) return html;
        doc.querySelector("head")?.insertAdjacentHTML("beforeend", `<style data-presse-images>picture{display:contents}</style>\n`);
        return doc.toString();
      },
    },
  };
}
