/**
 * Les pages construites, lues dans vite.config.ts : `build.rollupOptions.input`, un LITTÉRAL objet
 * (`input: { cle: "page.html", … }`, sur une ou plusieurs lignes, guillemets simples ou doubles). Pas d'évaluation de
 * la configuration : une liste calculée (`input: pages()`, `Object.fromEntries(…)`) n'est pas lue, et le validateur
 * échoue alors (0 page) plutôt que de valider en silence une liste vide.
 */
export function lirePagesVite(source: string): string[] {
  const input = source.match(/\binput:\s*\{([^}]*)\}/)?.[1] ?? "";
  return [...input.matchAll(/["']([^"']+\.html)["']/g)].map((m) => m[1]!);
}
