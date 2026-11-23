/**
 * Studio — les vignettes du Sampler Presse : un dessin léger par effet (SVG, 120 × 72, currentColor + un accent),
 * à défaut celui de sa catégorie. Pas de capture d'écran : rien à charger, nettes à toute taille, et un effet
 * WebGPU a sa vignette même sans carte graphique. Décoratives (`aria-hidden`).
 */
const D: Record<string, string> = {
  goo: '<circle cx="46" cy="44" r="14" class="a"/><circle cx="74" cy="30" r="10" class="a"/><path d="M56 36c4-4 8-6 12-6" class="a" stroke-width="12" stroke-linecap="round"/><circle cx="86" cy="50" r="6" class="a"/>',
  couloir: '<path d="M8 8l46 14v28L8 64z" class="p"/><path d="M58 23l20 6v14l-20 6z" class="p"/><path d="M80 30l10 3v6l-10 3z" class="p"/><path d="M92 33.5l20 1.5v2l-20 1.5z" class="t"/>',
  cinetique: '<rect x="14" y="40" width="22" height="8" rx="2" class="t"/><rect x="40" y="32" width="26" height="16" rx="2" class="a"/><rect x="70" y="24" width="30" height="24" rx="2" class="p"/><path d="M14 56h86" class="t"/>',
  typo: '<path d="M22 54l12-36 12 36M26 42h16" class="t" stroke-width="4"/><path d="M56 20l8 6-6 8zM66 44l10-4 2 10zM84 22l12 2-4 10z" class="a"/>',
  ruban: '<path d="M6 30c18 0 18 14 36 14s18-14 36-14 18 14 36 14" class="p" stroke-width="14"/><path d="M6 30c18 0 18 14 36 14s18-14 36-14 18 14 36 14" class="a" stroke-width="2"/>',
  rouleau: '<path d="M20 16h44M20 34h60M20 52h40" class="t" stroke-width="5"/><path d="M58 28c14-4 30-4 46 0v20c-16 4-32 4-46 0z" class="a"/>',
  metal: '<rect x="20" y="22" width="80" height="28" rx="14" class="p"/><path d="M28 30c16 8 30-6 44 2s20 4 22 0" class="a"/>',
  voix: '<rect x="16" y="20" width="88" height="22" rx="11" class="p"/><path d="M16 64c20-22 68-22 88 0" class="a" stroke-width="5"/>',
  vague: '<rect x="12" y="12" width="96" height="48" rx="6" class="p"/><path d="M12 44c18-10 30 10 48 0s30 10 48 0" class="a" stroke-width="3"/>',
  lightbox: '<rect x="16" y="26" width="26" height="20" rx="2" class="p"/><rect x="54" y="12" width="52" height="48" rx="3" class="a"/><path d="M42 36l12-6" class="t"/>',
  logo: '<path d="M44 18h32l12 18-28 22-28-22z" class="a"/><path d="M48 30c8 4 16-4 24 0" class="t"/>',
  dechirure: '<rect x="12" y="12" width="96" height="22" class="p"/><path d="M12 34l8 4 6-3 9 5 7-4 8 4 7-3 9 4 8-5 7 4 9-3 10 4v29H12z" class="a"/>',
  forme: '<rect x="12" y="10" width="96" height="52" rx="4" class="p"/><path d="M66 12l-18 26h14l-8 22 22-30H62z" class="a"/>',
  autocollant: '<path d="M18 56l36-36" class="t" stroke-dasharray="3 5"/><circle cx="72" cy="30" r="16" class="a"/><path d="M64 30h16M72 22v16" class="t" stroke-width="2.5"/>',
  rail: '<rect x="8" y="16" width="30" height="36" rx="4" class="p"/><rect x="44" y="16" width="30" height="36" rx="4" class="a"/><rect x="80" y="16" width="30" height="36" rx="4" class="p"/><path d="M8 62h40" class="t" stroke-width="3"/>',
  trace: '<rect x="24" y="16" width="56" height="34" class="t"/><path d="M24 58h56M24 54v8M80 54v8" class="a"/><path d="M30 22l14 22M38 22l14 22M46 22l14 22" class="p"/>',
  systeme: '<rect x="14" y="16" width="20" height="40" rx="3" class="a"/><rect x="40" y="16" width="20" height="40" rx="3" class="p"/><path d="M68 24h38M68 36h30M68 48h34" class="t" stroke-width="3"/>',
};
const PAR_CATEGORIE: Record<string, string> = {
  texte: D.cinetique!,
  image: D.couloir!,
  matiere: D.metal!,
  interface: D.goo!,
  transition: D.vague!,
  forme: D.forme!,
  dessin: D.trace!,
  page: D.systeme!,
};

export function vignette(id: string, categorie: string): string {
  const d = D[id] ?? PAR_CATEGORIE[categorie] ?? D.systeme!;
  return `<svg class="sp-vignette" viewBox="0 0 120 72" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${d}</svg>`;
}
