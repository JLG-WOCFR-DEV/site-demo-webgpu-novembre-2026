/**
 * Navigation — les redirections d'URL. Politique (docs/ROADMAP-STUDIO.md, E6) : on ne déplace pas une page publiée ;
 * si un déplacement devient nécessaire, l'ancienne adresse reste servie par une page de redirection générée au build
 * (`<meta http-equiv="refresh">` + `<link rel="canonical">` + un lien visible, sans JavaScript), déclarée ici.
 * docs/urls-publiees.json garde toutes les adresses déjà publiées ; urls.test.ts échoue si l'une disparaît (ni page
 * construite, ni redirection vers une page construite).
 *
 * Aujourd'hui : aucune page n'a bougé (la taxonomie range sans déplacer), la liste est vide. Pur (Node, tests).
 */

export type Redirection = { de: string; vers: string; raison: string };

export const REDIRECTIONS: readonly Redirection[] = [];

const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Le chemin relatif de `de` vers `vers` (les deux depuis la racine du site). */
export function cheminRelatif(de: string, vers: string): string {
  const profondeur = de.split("/").length - 1;
  return "../".repeat(profondeur) + vers;
}

/** La page de redirection : lisible sans JS, indexée vers la nouvelle adresse, la requête et le fragment gardés. */
export function pageRedirection(r: Redirection): string {
  const cible = echap(cheminRelatif(r.de, r.vers));
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page déplacée</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${cible}">
<meta http-equiv="refresh" content="0; url=${cible}">
<script>location.replace(${JSON.stringify(cheminRelatif(r.de, r.vers))} + location.search + location.hash)</script>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:24px 16px;background:#f6f1e4;color:#16110d}a{color:#a12614}@media (prefers-color-scheme:dark){body{background:#16110d;color:#efe6d2}a{color:#ff9a85}}</style>
</head>
<body>
<p>Cette page a déménagé : <a href="${cible}">${echap(r.vers)}</a>.</p>
</body>
</html>
`;
}

/** Vérifie la liste : pas de doublon, pas de chaîne, pas de cible absente. `existe` : la page est construite. */
export function verifierRedirections(liste: readonly Redirection[], existe: (page: string) => boolean): string[] {
  const fautes: string[] = [];
  const de = new Set<string>();
  for (const r of liste) {
    if (de.has(r.de)) fautes.push(`${r.de} : redirigée deux fois`);
    de.add(r.de);
    if (existe(r.de)) fautes.push(`${r.de} : la page existe encore, la redirection l'écraserait`);
    if (!existe(r.vers)) fautes.push(`${r.de} → ${r.vers} : la cible n'est pas construite`);
    if (liste.some((x) => x.de === r.vers)) fautes.push(`${r.de} → ${r.vers} : chaîne de redirections`);
  }
  return fautes;
}
