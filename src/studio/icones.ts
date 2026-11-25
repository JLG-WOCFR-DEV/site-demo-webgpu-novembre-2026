/**
 * Studio — les icônes (trait 1,6, currentColor, 24 × 24), par nom. Pur : des chaînes SVG, sans DOM.
 * Une icône est toujours décorative (`aria-hidden`) : le bouton qui la porte a son `aria-label` et son `title`.
 */
const P: Record<string, string> = {
  // Barre d'outils.
  "copier-attributs": '<path d="M7 8l-4 4 4 4M17 8l4 4-4 4"/><path d="M10 12h.01M14 12h.01" stroke-width="2.6"/>',
  "copier-html": '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"/>',
  "copier-json": '<path d="M9 4H8a2 2 0 0 0-2 2v3.5a2 2 0 0 1-2 2.5 2 2 0 0 1 2 2.5V18a2 2 0 0 0 2 2h1M15 4h1a2 2 0 0 1 2 2v3.5a2 2 0 0 0 2 2.5 2 2 0 0 0-2 2.5V18a2 2 0 0 1-2 2h-1"/>',
  lien: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  reinitialiser: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  rejouer: '<path d="M7 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  comparer: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 3v18"/><path d="M6.5 10l-1.5 2 1.5 2M17.5 10l1.5 2-1.5 2"/>',
  aide: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.6"/><path d="M12 17h.01" stroke-width="2.6"/>',
  clavier: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" stroke-width="1.8"/>',
  bureau: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
  tablette: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>',
  mobile: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  pages: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  grille: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  ouvrir: '<path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  page: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  auto: '<path d="M7 18l5-12 5 12M8.8 14h6.4"/>',
  defaut: '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 5v4h4"/>',
  copie: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  chercher: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  studio: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M17.5 8h1M17.5 11h1M17.5 14h1"/>',
  gpu: '<rect x="4" y="7" width="16" height="10" rx="1.5"/><path d="M8 7V4M12 7V4M16 7V4M8 20v-3M12 20v-3M16 20v-3"/><rect x="9" y="10" width="6" height="4" rx=".5"/>',
  dom: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
  inspecter: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M10 9l6 3-2.6 1L12 16z"/>',
  poids: '<path d="M7 9h10l2 11H5z"/><circle cx="12" cy="6" r="2.4"/>',
  hic: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 12h10M7 15h4"/>',
  attention: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01" stroke-width="1.8"/>',
  // Paramètres.
  ouvert: '<circle cx="12" cy="16" r="3.5"/><circle cx="6" cy="8" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="18" cy="8" r="2"/>',
  pot: '<path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10z"/>',
  fusion: '<circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/><path d="M11 10.5h2M11 13.5h2"/>',
  relief: '<path d="M4 16a8 8 0 0 1 16 0"/><path d="M7.5 11.5a5 5 0 0 1 4.5-2.5" stroke-width="2.2"/>',
  ombre: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M8 20h10a2 2 0 0 0 2-2V8" opacity=".55"/>',
  "ombre-aucune": '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  "ombre-legere": '<rect x="4" y="4" width="14" height="14" rx="2"/><path d="M7 20h11a2 2 0 0 0 2-2V7" opacity=".35"/>',
  "ombre-normale": '<rect x="4" y="4" width="13" height="13" rx="2"/><path d="M7 20h11a2 2 0 0 0 2-2V7" opacity=".6" stroke-width="2.4"/>',
  "ombre-forte": '<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M7 21h12a2 2 0 0 0 2-2V7" stroke-width="3.4" opacity=".75"/>',
  ressort: '<path d="M3 12h2l1.5-5 3 10 3-10 3 10 3-10L20 12h1"/>',
  "ressort-rebond": '<path d="M3 18c3 0 3-13 6-13s2 9 4 9 2-5 4-5 2 3 4 3"/>',
  "ressort-vif": '<path d="M3 18c2 0 3-13 6-13 2 0 2 3 4 3h8"/>',
  "ressort-doux": '<path d="M3 18c6 0 8-12 18-12"/>',
  base: '<path d="M4 7h10M4 12h16M4 17h7"/><circle cx="17" cy="7" r="2"/><circle cx="14" cy="17" r="2"/>',
  "fleche-gauche": '<path d="M20 12H5M11 6l-6 6 6 6"/>',
  "fleche-droite": '<path d="M4 12h15M13 6l6 6-6 6"/>',
  mur: '<path d="M3 5l18 5v4L3 19z"/>',
  sol: '<path d="M3 20l5-12h8l5 12z"/>',
  "murs-un": '<path d="M4 4l16 6.5v3L4 20z"/>',
  "murs-deux": '<path d="M4 3l16 7v1.5L4 9zM4 21l16-7v-1.5L4 15z"/>',
  "murs-trois": '<path d="M4 3l16 7v1.5L4 9zM4 21l16-7v-1.5L4 15z"/><path d="M2 9.5v5" stroke-width="2.4"/>',
  boucle: '<path d="M17 4l3 3-3 3"/><path d="M20 7H8a4 4 0 0 0-4 4v1M7 20l-3-3 3-3"/><path d="M4 17h12a4 4 0 0 0 4-4v-1"/>',
  "sens-avant": '<path d="M12 20V6M6 12l6-6 6 6"/><path d="M8 20h8" opacity=".5"/>',
  "sens-arriere": '<path d="M12 4v14M6 12l6 6 6-6"/><path d="M8 4h8" opacity=".5"/>',
  "clic-aucun": '<path d="M9 4v8l-2-2-2 2 5 6h7l2-8-5-1V4a1.5 1.5 0 0 0-3 0"/><path d="M4 4l16 16" opacity=".7"/>',
  visionneuse: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  texte: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  "par-ligne": '<path d="M4 7h16M4 12h16M4 17h11"/>',
  "par-mot": '<rect x="3" y="9" width="7" height="6" rx="1.5"/><rect x="12" y="9" width="9" height="6" rx="1.5"/>',
  "par-lettre": '<rect x="3" y="9" width="4" height="6" rx="1"/><rect x="10" y="9" width="4" height="6" rx="1"/><rect x="17" y="9" width="4" height="6" rx="1"/>',
  "ordre-debut": '<path d="M4 12h2M9 12h3M15 12h5" stroke-width="2.4"/><path d="M4 7v10" />',
  "ordre-fin": '<path d="M4 12h5M12 12h3M18 12h2" stroke-width="2.4"/><path d="M20 7v10"/>',
  "ordre-centre": '<path d="M4 12h3M10 12h4M17 12h3" stroke-width="2.4"/><path d="M12 6v12"/>',
  "ordre-bords": '<path d="M4 12h3M10 12h4M17 12h3" stroke-width="2.4"/><path d="M3 6v12M21 6v12"/>',
  "ordre-hasard": '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" stroke-width="2.8"/>',
  torsade: '<path d="M2 9c5 0 5 6 10 6s5-6 10-6M2 15c5 0 5-6 10-6s5 6 10 6"/>',
  accordeon: '<path d="M3 7v10l4-3V10zM7 10v4l3 3V7zM10 7v10l4-3V10zM14 10v4l3 3V7zM17 7v10l4-3V10z"/>',
  barillet: '<path d="M6 4h12M4 9h16M4 15h16M6 20h12"/><path d="M6 4c-3 5-3 11 0 16M18 4c3 5 3 11 0 16" opacity=".6"/>',
  lentille: '<path d="M2 15h20"/><path d="M5 15c2-6 12-6 14 0" /><rect x="3" y="15" width="4" height="4" rx=".8"/><rect x="10" y="15" width="4" height="4" rx=".8"/><rect x="17" y="15" width="4" height="4" rx=".8"/>',
  roue: '<path d="M4 18a10 10 0 0 1 16 0"/><rect x="5" y="11" width="3" height="3" rx=".6"/><rect x="10.5" y="7.5" width="3" height="3" rx=".6"/><rect x="16" y="11" width="3" height="3" rx=".6"/>',
  respire: '<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
  mouvement: '<path d="M4 18C9 18 10 6 20 6"/><circle cx="20" cy="6" r="1.6" fill="currentColor"/>',
};

/** L'icône `nom`, ou `null` si elle n'existe pas (le libellé s'affiche alors). */
export function icone(nom: string | undefined, taille = 20): string | null {
  const d = nom ? P[nom] : undefined;
  if (!d) return null;
  return `<svg viewBox="0 0 24 24" width="${taille}" height="${taille}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

/** Comme `icone`, mais une icône manquante est une erreur (barres d'outils : jamais de bouton vide). */
export function ic(nom: string, taille = 20): string {
  const s = icone(nom, taille);
  if (!s) throw new Error(`[studio] icône inconnue : ${nom}`);
  return s;
}

export const NOMS_ICONES: readonly string[] = Object.keys(P);
