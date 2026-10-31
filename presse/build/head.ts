import type { Plugin } from "vite";

/**
 * Plugin Vite : complète le <head> de chaque page de ce qu'on oublie toujours.
 * Aujourd'hui : l'icône. Sans `<link rel="icon">`, le navigateur demande /favicon.ico à chaque chargement (404 dans la
 * console, et une requête perdue) ; on pose celle de Presse (trois disques CMJN en SVG, en ligne : aucun fichier).
 */
const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23f2efe6'/%3E%3Ccircle cx='12' cy='14' r='7' fill='%2300a3d7' opacity='.85'/%3E%3Ccircle cx='20' cy='14' r='7' fill='%23e5007d' opacity='.85'/%3E%3Ccircle cx='16' cy='20' r='7' fill='%23f6d500' opacity='.85'/%3E%3C/svg%3E";

export function presseHead(): Plugin {
  return {
    name: "presse-head",
    transformIndexHtml(html) {
      if (/<link[^>]+rel=["']?(?:shortcut )?icon/i.test(html)) return html;
      return html.replace(/<\/head>/i, `  <link rel="icon" href="${ICON}" />\n  </head>`);
    },
  };
}
