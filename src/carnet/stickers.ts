/**
 * Carnet — le catalogue d'autocollants (P4b). Dessins originaux, en SVG 64 × 64.
 *
 * Couleurs par emplacement, pas par valeur : --a (principale), --b (seconde), --c (rehaut),
 * --k (trait). La saison choisie fournit la palette ; elle est enregistrée avec l'autocollant posé,
 * pour qu'une feuille d'automne reste rousse en été. Le bord blanc découpé et l'ombre légère
 * viennent d'un seul filtre SVG (#cn-die), partagé par tous.
 */

export type Season = "printemps" | "ete" | "automne" | "hiver";
export type StickerGroup = "saisons" | "activites" | "rdv";
export type Sticker = { id: string; name: string; group: StickerGroup; body: string };

export const SEASONS: { id: Season; name: string; palette: [string, string, string, string] }[] = [
  { id: "printemps", name: "Printemps", palette: ["#8cc084", "#f4a6b8", "#f7d774", "#33402f"] },
  { id: "ete", name: "Été", palette: ["#f2b134", "#ef6f5e", "#4fb3bf", "#3b2f2a"] },
  { id: "automne", name: "Automne", palette: ["#c8662f", "#e0a33a", "#8b2e3c", "#3a271f"] },
  { id: "hiver", name: "Hiver", palette: ["#7fa7c9", "#eef3f6", "#b8c7d3", "#263446"] },
];

/** La saison d'un jour (hémisphère nord, aux équinoxes et solstices près). */
export function seasonOf(day: string): Season {
  const md = day.slice(5);
  if (md >= "03-20" && md < "06-21") return "printemps";
  if (md >= "06-21" && md < "09-23") return "ete";
  if (md >= "09-23" && md < "12-21") return "automne";
  return "hiver";
}

export const GROUPS: { id: StickerGroup; name: string }[] = [
  { id: "saisons", name: "Saisons" },
  { id: "activites", name: "Activités" },
  { id: "rdv", name: "Rendez-vous" },
];

const K = 'stroke="var(--k)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';

export const STICKERS: Sticker[] = [
  /* ───── Saisons ───── */
  {
    id: "saison/feuille",
    name: "Feuille",
    group: "saisons",
    body: `<path d="M12 50 C10 28 26 10 52 10 C54 34 38 52 14 52 Z" fill="var(--a)" ${K}/><path d="M14 50 L44 20 M26 38 L26 28 M34 30 L42 30" fill="none" ${K}/>`,
  },
  {
    id: "saison/fleur",
    name: "Fleur",
    group: "saisons",
    body: `<g fill="var(--b)" ${K}><circle cx="32" cy="17" r="9"/><circle cx="46" cy="27" r="9"/><circle cx="41" cy="43" r="9"/><circle cx="23" cy="43" r="9"/><circle cx="18" cy="27" r="9"/></g><circle cx="32" cy="31" r="7" fill="var(--c)" ${K}/>`,
  },
  {
    id: "saison/champignon",
    name: "Champignon",
    group: "saisons",
    body: `<path d="M24 34 L22 54 Q32 58 42 54 L40 34 Z" fill="#f6efe2" ${K}/><path d="M8 34 Q10 10 32 10 Q54 10 56 34 Z" fill="var(--a)" ${K}/><g fill="#fff8ec"><circle cx="22" cy="22" r="4"/><circle cx="38" cy="18" r="3"/><circle cx="45" cy="28" r="3.5"/></g>`,
  },
  {
    id: "saison/maisonnette",
    name: "Maisonnette",
    group: "saisons",
    body: `<path d="M44 14 L44 22" ${K}/><path d="M47 9 q4 -3 8 0" fill="none" ${K}/><path d="M14 30 L14 54 L50 54 L50 30" fill="#fbf4e6" ${K}/><path d="M8 32 L32 12 L56 32 Z" fill="var(--c)" ${K}/><rect x="27" y="38" width="10" height="16" rx="5" fill="var(--a)" ${K}/><rect x="17" y="36" width="7" height="7" fill="var(--b)" ${K}/><rect x="40" y="36" width="7" height="7" fill="var(--b)" ${K}/>`,
  },
  {
    id: "saison/sapin",
    name: "Sapin",
    group: "saisons",
    body: `<rect x="28" y="48" width="8" height="9" fill="#8a5a3b" ${K}/><path d="M32 8 L50 30 L40 30 L54 48 L10 48 L24 30 L14 30 Z" fill="var(--a)" ${K}/><circle cx="32" cy="8" r="3.5" fill="var(--c)" ${K}/><g fill="var(--b)"><circle cx="26" cy="38" r="2.5"/><circle cx="39" cy="40" r="2.5"/><circle cx="33" cy="26" r="2.5"/></g>`,
  },
  {
    id: "saison/flocon",
    name: "Flocon",
    group: "saisons",
    body: `<circle cx="32" cy="32" r="24" fill="var(--b)" ${K}/><g fill="none" stroke="var(--a)" stroke-width="3.2" stroke-linecap="round"><path d="M32 14 V50 M16.4 23 L47.6 41 M16.4 41 L47.6 23"/><path d="M27 18 L32 23 L37 18 M27 46 L32 41 L37 46"/></g>`,
  },
  {
    id: "saison/soleil",
    name: "Soleil",
    group: "saisons",
    body: `<g ${K}><path d="M32 4 V12 M32 52 V60 M4 32 H12 M52 32 H60 M12 12 L18 18 M46 46 L52 52 M52 12 L46 18 M12 52 L18 46"/></g><circle cx="32" cy="32" r="15" fill="var(--a)" ${K}/><path d="M26 34 Q32 40 38 34" fill="none" ${K}/><g fill="var(--k)"><circle cx="27" cy="28" r="1.8"/><circle cx="37" cy="28" r="1.8"/></g>`,
  },
  {
    id: "saison/nuage",
    name: "Nuage de pluie",
    group: "saisons",
    body: `<path d="M16 38 Q6 38 8 29 Q10 21 19 23 Q22 12 33 13 Q44 14 45 24 Q56 23 56 31 Q56 38 48 38 Z" fill="#fbfbfa" ${K}/><g fill="var(--c)" ${K}><path d="M20 46 q-3 5 0 7 q3 -2 0 -7Z"/><path d="M32 46 q-3 5 0 7 q3 -2 0 -7Z"/><path d="M44 46 q-3 5 0 7 q3 -2 0 -7Z"/></g>`,
  },
  {
    id: "saison/escargot",
    name: "Escargot",
    group: "saisons",
    body: `<path d="M6 50 Q20 52 46 50 Q56 49 56 42 L56 30" fill="var(--b)" ${K}/><path d="M52 30 L50 20 M56 30 L58 21" ${K}/><circle cx="30" cy="34" r="16" fill="var(--a)" ${K}/><path d="M30 34 m0 -6 a6 6 0 1 1 -6 6 a10 10 0 1 1 10 10" fill="none" ${K}/>`,
  },
  {
    id: "saison/pomme",
    name: "Pomme, petit personnage",
    group: "saisons",
    body: `<path d="M32 18 Q32 10 38 6" fill="none" ${K}/><path d="M34 12 Q44 4 50 12 Q42 16 34 12Z" fill="var(--b)" ${K}/><path d="M32 18 Q20 10 12 22 Q6 36 16 48 Q24 58 32 52 Q40 58 48 48 Q58 36 52 22 Q44 10 32 18Z" fill="var(--a)" ${K}/><g fill="var(--k)"><circle cx="25" cy="33" r="2.4"/><circle cx="39" cy="33" r="2.4"/></g><path d="M28 40 Q32 44 36 40" fill="none" ${K}/><g fill="#f4a6b8" opacity=".85"><ellipse cx="20" cy="39" rx="3.5" ry="2.2"/><ellipse cx="44" cy="39" rx="3.5" ry="2.2"/></g>`,
  },
  {
    id: "saison/chat",
    name: "Chat endormi",
    group: "saisons",
    body: `<path d="M10 46 Q8 26 26 24 L22 14 L32 21 L40 14 L40 25 Q56 30 54 46 Q52 54 32 54 Q12 54 10 46Z" fill="var(--c)" ${K}/><path d="M52 44 Q60 40 56 32" fill="none" ${K}/><path d="M24 36 q3 2 6 0 M36 36 q3 2 6 0" fill="none" ${K}/><path d="M31 41 h4" ${K}/>`,
  },
  {
    id: "saison/glands",
    name: "Glands",
    group: "saisons",
    body: `<g transform="rotate(-14 22 34)"><path d="M12 30 Q12 50 22 54 Q32 50 32 30Z" fill="var(--b)" ${K}/><path d="M10 30 Q10 20 22 20 Q34 20 34 30Z" fill="var(--a)" ${K}/><path d="M22 20 V14" ${K}/></g><g transform="rotate(16 44 38)"><path d="M35 36 Q35 54 44 58 Q53 54 53 36Z" fill="var(--b)" ${K}/><path d="M33 36 Q33 26 44 26 Q55 26 55 36Z" fill="var(--a)" ${K}/><path d="M44 26 V21" ${K}/></g>`,
  },

  /* ───── Activités ───── */
  {
    id: "activite/cuisine",
    name: "Cuisine",
    group: "activites",
    body: `<path d="M20 14 q-4 5 0 9 q4 4 0 9 M32 10 q-4 5 0 9 q4 4 0 9 M44 14 q-4 5 0 9 q4 4 0 9" fill="none" ${K}/><path d="M10 34 H54 V46 Q54 54 46 54 H18 Q10 54 10 46Z" fill="var(--a)" ${K}/><path d="M4 38 H10 M54 38 H60" ${K}/><rect x="8" y="31" width="48" height="5" rx="2.5" fill="var(--c)" ${K}/>`,
  },
  {
    id: "activite/ecriture",
    name: "Écriture",
    group: "activites",
    body: `<path d="M44 6 L58 20 L26 52 L10 56 L14 40 Z" fill="var(--a)" ${K}/><path d="M14 40 L26 52" ${K}/><path d="M40 10 L54 24" ${K}/><path d="M10 56 L16 50" ${K}/><path d="M18 58 Q30 54 40 58 Q50 62 58 56" fill="none" stroke="var(--c)" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  {
    id: "activite/musique",
    name: "Musique",
    group: "activites",
    body: `<path d="M22 46 V14 L50 8 V40" fill="none" ${K}/><path d="M22 18 L50 12 L50 20 L22 26Z" fill="var(--c)" ${K}/><ellipse cx="16" cy="46" rx="8" ry="6" fill="var(--a)" ${K}/><ellipse cx="44" cy="40" rx="8" ry="6" fill="var(--a)" ${K}/>`,
  },
  {
    id: "activite/films",
    name: "Films",
    group: "activites",
    body: `<rect x="8" y="24" width="48" height="30" rx="3" fill="#3a3a3f" ${K}/><path d="M8 24 L54 12 L56 20 L10 32" fill="var(--b)" ${K}/><g fill="#fdfaf3"><path d="M17 20 l6 -1.6 l-4 6z"/><path d="M29 17 l6 -1.6 l-4 6z"/><path d="M41 14 l6 -1.6 l-4 6z"/></g><path d="M16 38 H48 M16 46 H36" stroke="#fdfaf3" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  {
    id: "activite/series",
    name: "Séries",
    group: "activites",
    body: `<path d="M24 8 L32 16 L42 6" fill="none" ${K}/><rect x="6" y="16" width="52" height="36" rx="8" fill="var(--c)" ${K}/><rect x="12" y="22" width="34" height="24" rx="4" fill="#fdfaf3" ${K}/><g fill="var(--a)" ${K}><circle cx="52" cy="26" r="2.5"/><circle cx="52" cy="36" r="2.5"/></g><path d="M18 56 L22 52 M46 56 L42 52" ${K}/><path d="M24 30 L32 34 L24 38Z" fill="var(--b)" ${K}/>`,
  },
  {
    id: "activite/lecture",
    name: "Lecture",
    group: "activites",
    body: `<path d="M32 16 Q20 8 6 12 V50 Q20 46 32 54 Q44 46 58 50 V12 Q44 8 32 16Z" fill="#fdfaf3" ${K}/><path d="M32 16 V54" ${K}/><path d="M12 20 Q20 18 26 22 M12 28 Q20 26 26 30 M38 22 Q44 18 52 20 M38 30 Q44 26 52 28" fill="none" stroke="var(--a)" stroke-width="2.4" stroke-linecap="round"/><path d="M44 10 V24 L48 20 L52 24 V10" fill="var(--b)" ${K}/>`,
  },
  {
    id: "activite/sport",
    name: "Sport",
    group: "activites",
    body: `<path d="M8 46 Q8 34 18 32 L28 20 Q32 16 36 22 L40 28 Q52 30 56 40 V46 Z" fill="var(--a)" ${K}/><path d="M6 46 H58 V52 Q58 54 56 54 H8 Q6 54 6 52Z" fill="#fdfaf3" ${K}/><path d="M24 30 L30 34 M28 26 L34 30" ${K}/><path d="M40 28 Q36 36 42 40" fill="none" stroke="var(--c)" stroke-width="2.4"/>`,
  },
  {
    id: "activite/jardinage",
    name: "Jardinage",
    group: "activites",
    body: `<path d="M14 26 H42 L40 54 H16Z" fill="var(--c)" ${K}/><path d="M42 32 L58 18 L60 22 L44 38" fill="var(--c)" ${K}/><path d="M18 26 Q28 10 38 26" fill="none" ${K}/><g fill="var(--a)"><circle cx="58" cy="12" r="1.8"/><circle cx="62" cy="16" r="1.8"/><circle cx="54" cy="9" r="1.8"/></g><path d="M20 38 h16" stroke="var(--b)" stroke-width="3" stroke-linecap="round"/>`,
  },

  /* ───── Rendez-vous ───── */
  {
    id: "rdv/medecin",
    name: "Médecin",
    group: "rdv",
    body: `<path d="M32 54 Q8 38 8 22 Q8 10 20 10 Q28 10 32 18 Q36 10 44 10 Q56 10 56 22 Q56 38 32 54Z" fill="var(--b)" ${K}/><path d="M32 22 V40 M23 31 H41" stroke="#fdfaf3" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "rdv/anniversaire",
    name: "Anniversaire",
    group: "rdv",
    body: `<path d="M32 8 q-3 4 0 7 q3 -3 0 -7Z" fill="var(--a)" ${K}/><rect x="29.5" y="15" width="5" height="11" fill="var(--c)" ${K}/><rect x="12" y="26" width="40" height="14" rx="4" fill="var(--b)" ${K}/><rect x="8" y="40" width="48" height="16" rx="4" fill="var(--a)" ${K}/><path d="M12 34 q5 4 10 0 q5 4 10 0 q5 4 10 0 q5 4 10 0" fill="none" stroke="#fdfaf3" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  {
    id: "rdv/voyage",
    name: "Voyage",
    group: "rdv",
    body: `<path d="M24 18 V12 H40 V18" fill="none" ${K}/><rect x="8" y="18" width="48" height="36" rx="6" fill="var(--a)" ${K}/><path d="M20 18 V54 M44 18 V54" stroke="var(--c)" stroke-width="4"/><circle cx="16" cy="57" r="3" fill="var(--k)"/><circle cx="48" cy="57" r="3" fill="var(--k)"/><rect x="26" y="30" width="12" height="8" rx="2" fill="#fdfaf3" ${K}/>`,
  },
  {
    id: "rdv/reunion",
    name: "Réunion",
    group: "rdv",
    body: `<path d="M6 12 H38 Q42 12 42 16 V32 Q42 36 38 36 H20 L12 44 V36 H10 Q6 36 6 32Z" fill="var(--a)" ${K}/><path d="M26 28 H54 Q58 28 58 32 V46 Q58 50 54 50 H52 V58 L44 50 H30 Q26 50 26 46Z" fill="var(--c)" ${K}/><g fill="var(--k)"><circle cx="16" cy="24" r="2"/><circle cx="24" cy="24" r="2"/><circle cx="32" cy="24" r="2"/></g>`,
  },
  {
    id: "rdv/cafe",
    name: "Café entre amis",
    group: "rdv",
    body: `<path d="M22 6 q-3 4 0 8 q3 4 0 8 M32 6 q-3 4 0 8 q3 4 0 8" fill="none" ${K}/><path d="M10 26 H46 V40 Q46 54 28 54 Q10 54 10 40Z" fill="var(--a)" ${K}/><path d="M46 30 Q58 30 56 40 Q54 46 44 46" fill="none" ${K}/><path d="M4 56 H52" ${K}/><path d="M22 36 q6 6 12 0" fill="none" stroke="#fdfaf3" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  {
    id: "rdv/courrier",
    name: "Courrier, papiers",
    group: "rdv",
    body: `<rect x="6" y="14" width="52" height="36" rx="4" fill="#fdfaf3" ${K}/><path d="M6 18 L32 36 L58 18" fill="none" ${K}/><rect x="44" y="20" width="9" height="10" fill="var(--b)" ${K}/><circle cx="20" cy="42" r="5" fill="var(--c)" ${K}/>`,
  },
  {
    id: "rdv/coiffeur",
    name: "Coiffeur",
    group: "rdv",
    body: `<path d="M24 34 L48 8 M40 34 L16 8" fill="none" stroke="var(--k)" stroke-width="3.2" stroke-linecap="round"/><circle cx="20" cy="44" r="9" fill="var(--a)" ${K}/><circle cx="44" cy="44" r="9" fill="var(--a)" ${K}/><circle cx="20" cy="44" r="3.5" fill="#fdfaf3" ${K}/><circle cx="44" cy="44" r="3.5" fill="#fdfaf3" ${K}/><circle cx="32" cy="22" r="2.4" fill="var(--c)"/>`,
  },
];

export const stickerById = new Map(STICKERS.map((s) => [s.id, s]));

/** Variables CSS d'une palette, à poser sur l'élément de l'autocollant. */
export function paletteStyle(season: string) {
  const p = (SEASONS.find((s) => s.id === season) ?? SEASONS[2]!).palette;
  return `--a:${p[0]};--b:${p[1]};--c:${p[2]};--k:${p[3]}`;
}

/** Le SVG d'un autocollant (bord découpé compris). */
export function stickerSvg(id: string) {
  const s = stickerById.get(id);
  const body = s?.body ?? `<circle cx="32" cy="32" r="20" fill="var(--a)" ${K}/>`;
  return `<svg viewBox="-4 -4 72 72" aria-hidden="true" focusable="false"><g filter="url(#cn-die)">${body}</g></svg>`;
}

/** Filtre partagé : bord blanc découpé (dilatation) et ombre portée douce. Inséré une fois. */
export function ensureDieFilter() {
  if (document.getElementById("cn-die")) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.innerHTML = `<defs><filter id="cn-die" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
    <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="d"/>
    <feGaussianBlur in="d" stdDeviation="1.6" result="b"/>
    <feOffset in="b" dx="0.6" dy="1.4" result="o"/>
    <feComponentTransfer in="o" result="sh"><feFuncA type="linear" slope="0.28"/></feComponentTransfer>
    <feFlood flood-color="#fffdf8" result="w"/><feComposite in="w" in2="d" operator="in" result="edge"/>
    <feMerge><feMergeNode in="sh"/><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter></defs>`;
  document.body.append(svg);
}
