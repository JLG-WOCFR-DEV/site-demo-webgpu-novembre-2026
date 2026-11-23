/**
 * Presse — « logo » : des matières animées pour un logo, d'après Form (amirmushich.com/lab/form). Le rendu est celui de
 * Paper Shaders 0.0.82 (© 2026 Paper, Apache-2.0, `licenses/paper-shaders/`), utilisé tel quel (WebGL2, sans
 * dépendance) et enveloppé ici : attributs, préparation de l'image, boucle, pause, exports.
 *
 *   <div data-logo="liquide-metal" data-logo-src="conference/ubs-logo.svg" aria-label="Université Bretagne Sud"></div>
 *   <div data-logo="gemme-fumee" data-logo-texte="Presse" data-logo-presets="feu"></div>
 *   <div data-logo="chaleur" data-logo-src="logo.png" data-logo-couleurs="#11206a #ffe679 #ff4c00" data-logo-survol="vitesse"></div>
 *
 * Attributs (communs) :
 *   data-logo                la matière : liquide-metal, gemme-fumee, chaleur, eau, verre-cannele, trame-cmjn,
 *                            trame-points, tramage, lentille, papier ;
 *   data-logo-src            le logo : SVG, ou PNG / WebP à fond transparent (un `img` enfant sert aussi de source et de
 *                            repli) ; data-logo-texte : un texte rastérisé dans une police embarquée (-police : archivo,
 *                            bodoni) ;
 *   data-logo-presets        un préréglage de la matière (sa base ; les autres attributs la complètent) ;
 *   data-logo-fond           couleur derrière le logo (défaut : transparent) ;
 *   data-logo-vitesse        0–4 (défaut 1) ; data-logo-pause : image fixe ; data-logo-instant : l'instant montré à
 *                            l'arrêt (ms de l'horloge du shader ; défaut : l'« instant beau » de la matière) ;
 *   data-logo-survol         aucun (défaut), vitesse, distorsion : la vitesse ou la distorsion suit le pointeur ;
 *   data-logo-marge          marge autour du logo recadré, 0–0.5 de son grand côté (défaut 0.12) ;
 *   data-logo-masque         oui / non : l'effet est découpé à la silhouette du logo (filtres ; les matières à masque
 *                            le sont par nature) ;
 *   data-logo-sans-fond      retire le fond uni d'une image qui n'est pas détourée (la couleur de ses coins) ;
 *   data-logo-mouvement      0–1 : l'ampleur du mouvement ajouté aux filtres fixes de Paper (trames, verre, lentille,
 *                            papier) ;
 *   data-logo-<réglage>      les réglages de la matière (voir MATIERES : couleurs, contour, distorsion, angle, échelle…).
 * JS : `initLogo(root?)` arme ce qui est là ; `controleLogo(el)` rend le contrôleur (régler, temps, exports).
 *
 * Pur ici (testé sous Node) : définitions, lecture et normalisation des attributs, préréglages, sérialisation
 * (attributs, bloc HTML, JSON, adresse), hasard à graine, échantillonnage d'une séquence d'export, recadrage.
 * Le rendu (DOM, WebGL, exports) est dans `logo-rendu.ts`, chargé à la demande.
 */

/* ───────────────────────── Types ───────────────────────── */

export const MATIERES_NOMS = ["liquide-metal", "gemme-fumee", "chaleur", "eau", "verre-cannele", "trame-cmjn", "trame-points", "tramage", "lentille", "papier"] as const;
export type Matiere = (typeof MATIERES_NOMS)[number];
export type Valeur = number | string | boolean | string[];
export type Valeurs = Record<string, Valeur>;
export type TypeReglage = "nombre" | "couleur" | "couleurs" | "choix" | "bool";

export interface DefReglage {
  /** Le nom français, aussi le suffixe de l'attribut (`data-logo-<cle>`). */
  cle: string;
  /** L'uniforme de Paper Shaders. */
  uniforme: string;
  type: TypeReglage;
  libelle: string;
  icone: string;
  defaut: Valeur;
  min?: number;
  max?: number;
  pas?: number;
  /** Un angle en degrés (cadran). */
  angle?: boolean;
  /** Choix : [valeur française, valeur Paper, libellé]. */
  choix?: readonly (readonly [string, number, string])[];
  /** Couleurs : leur nombre maximal. */
  nombre?: number;
  /** Un des trois réglages principaux (bloc du Créateur, vignette). */
  principal?: boolean;
}

export interface Mouvement {
  /** Le réglage animé (`echelle` compris). */
  cle: string;
  forme: "sinus" | "tour";
  /** Ampleur à mouvement = 1 (unités du réglage ; « tour » : 360° par période). */
  ampleur: number;
  /** Période, en ms de l'horloge du shader. */
  periode: number;
}

export interface DefMatiere {
  id: Matiere;
  nom: string;
  description: string;
  /** L'export de Paper Shaders qui porte le fragment shader. */
  shader: string;
  /** Préparation de l'image par Paper (champ de distance) : la matière prend le logo comme masque. */
  preparation: "liquide-metal" | "gemme-fumee" | "chaleur" | null;
  /** Le shader lit u_time. */
  temps: boolean;
  /** Période exacte de l'animation (ms de l'horloge), si elle boucle. */
  periode: number | null;
  /** Mouvement ajouté par Presse à un filtre que Paper laisse fixe. */
  mouvement?: Mouvement;
  /** Uniformes fixes. */
  fixes: Record<string, number | boolean | number[]>;
  /** La matière a besoin de la texture de bruit de Paper. */
  bruit?: boolean;
  reglages: DefReglage[];
  presets: Record<string, { nom: string; valeurs: Valeurs }>;
  /** L'instant montré à l'arrêt et en mouvement réduit (ms de l'horloge). */
  instantBeau: number;
  /** Le réglage que le survol « distorsion » pousse. */
  cleSurvol: string;
  /** Découpé à la silhouette du logo par défaut (filtres). */
  masqueDefaut: boolean;
  /**
   * Matières à halo (gemme, chaleur) : la lueur déborde du logo ; un masque doux (la silhouette floutée de ce rayon,
   * fraction du grand côté du logo) la fond dans la transparence au lieu de la couper au bord du cadre.
   */
  halo?: (lueur: number) => number;
  /** Icône de la liste des matières (contenu d'un SVG 24 × 24 à traits). */
  icone: string;
}

/* ───────────────────────── Icônes (traits, 24 × 24) ───────────────────────── */

export const ICONES = {
  "liquide-metal": '<path d="M5 15c0-5 3-11 7-11s7 6 7 11a7 7 0 0 1-14 0z" /><path d="M9 15c1 2 3 2.5 5 1.5" />',
  "gemme-fumee": '<path d="M7 4h10l4 5-9 11L3 9z" /><path d="M3 9h18M9 4l3 5 3-5M12 9v11" />',
  chaleur: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-3-2 2-3 4-3 7a6 6 0 0 0 6 6z" />',
  eau: '<path d="M2 8c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5 0M2 13c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5 0M2 18c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5 0" />',
  "verre-cannele": '<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7.5 3v18M12 3v18M16.5 3v18" />',
  "trame-cmjn": '<circle cx="8" cy="8" r="3.5" /><circle cx="16" cy="8" r="2.5" /><circle cx="8" cy="16" r="2.5" /><circle cx="16" cy="16" r="1.5" />',
  "trame-points": '<circle cx="6" cy="6" r="2" /><circle cx="12" cy="6" r="1.4" /><circle cx="18" cy="6" r="0.8" /><circle cx="6" cy="12" r="2.4" /><circle cx="12" cy="12" r="2" /><circle cx="18" cy="12" r="1.4" /><circle cx="6" cy="18" r="2.8" /><circle cx="12" cy="18" r="2.4" /><circle cx="18" cy="18" r="2" />',
  tramage: '<path d="M4 4h4v4H4zM12 4h4v4h-4zM8 8h4v4H8zM16 8h4v4h-4zM4 12h4v4H4zM12 12h4v4h-4zM8 16h4v4H8zM16 16h4v4h-4z" />',
  lentille: '<circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /><path d="M12 7v10" />',
  papier: '<path d="M5 3h10l4 4v14H5z" /><path d="M15 3v4h4M8 11l3 2 2-3 3 4" />',
  // Réglages
  teinte: '<circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 0 0 16z" />',
  couleur: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" />',
  couleurs: '<circle cx="8" cy="9" r="4.5" /><circle cx="16" cy="9" r="4.5" /><circle cx="12" cy="16" r="4.5" />',
  repetition: '<path d="M4 4l16 16M4 10l10 10M10 4l10 10M4 16l4 4M16 4l4 4" />',
  adoucissement: '<circle cx="12" cy="12" r="8" stroke-dasharray="2 2.6" /><circle cx="12" cy="12" r="3" />',
  frangeRouge: '<circle cx="10" cy="12" r="6" /><path d="M16 7a6 6 0 0 1 0 10" />',
  frangeBleue: '<circle cx="14" cy="12" r="6" /><path d="M8 7a6 6 0 0 0 0 10" />',
  distorsion: '<path d="M3 12c3-6 5 6 9 0s6 6 9 0" />',
  contour: '<rect x="4" y="4" width="16" height="16" rx="4" /><rect x="8" y="8" width="8" height="8" rx="1.5" />',
  angle: '<path d="M3 20h18M3 20L17 6" /><path d="M10 20a7 7 0 0 0-2-5" />',
  echelle: '<path d="M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7" />',
  taille: '<rect x="3" y="3" width="8" height="8" /><rect x="13" y="13" width="8" height="8" />',
  lueurIn: '<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" opacity=".35" />',
  lueurOut: '<circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />',
  decalage: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />',
  grain: '<circle cx="6" cy="7" r=".8" /><circle cx="12" cy="5" r=".8" /><circle cx="17" cy="9" r=".8" /><circle cx="8" cy="13" r=".8" /><circle cx="15" cy="15" r=".8" /><circle cx="6" cy="19" r=".8" /><circle cx="19" cy="18" r=".8" />',
  vagues: '<path d="M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-2.5 5 0" />',
  caustique: '<path d="M4 8c4 2 6-3 9 0s5 1 7-1M3 15c3-2 6 2 9 0s6-3 9 1" />',
  couches: '<path d="M12 4l9 4.5-9 4.5-9-4.5z" /><path d="M3 13l9 4.5 9-4.5" />',
  bords: '<rect x="4" y="4" width="16" height="16" /><path d="M4 9h16M4 15h16" stroke-dasharray="1.5 2" />',
  reflets: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />',
  ombre: '<circle cx="10" cy="10" r="6" /><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 0 8 2 6 6 0 0 0-2-8z" fill="currentColor" stroke="none" opacity=".4" />',
  motif: '<path d="M4 20V4M9 20V4M14 20V4M19 20V4" />',
  relief: '<path d="M3 18l5-12 4 8 3-5 6 9z" />',
  etirement: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />',
  flou: '<path d="M2 8h8M4 12h10M2 16h8" /><circle cx="17" cy="12" r="4" />',
  contraste: '<circle cx="12" cy="12" r="8" /><path d="M12 4v16a8 8 0 0 0 0-16z" fill="currentColor" stroke="none" />',
  bruit: '<path d="M3 12l2-4 2 7 2-9 2 11 2-8 2 5 2-3 2 4 2-3" />',
  type: '<circle cx="7" cy="12" r="3.5" /><path d="M14 8.5h7v7h-7z" />',
  rayon: '<circle cx="12" cy="12" r="8" /><path d="M12 12h8" />',
  grille: '<path d="M4 4h16v16H4zM4 12h16M12 4v16" />',
  inverse: '<circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16" fill="currentColor" stroke="none" />',
  image: '<rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" />',
  pixel: '<rect x="5" y="5" width="6" height="6" /><rect x="13" y="13" width="6" height="6" /><rect x="13" y="5" width="6" height="6" opacity=".4" />',
  niveaux: '<path d="M4 20h3v-6H4zM10.5 20h3V9h-3zM17 20h3V4h-3z" />',
  ecart: '<circle cx="7" cy="12" r="4" /><circle cx="17" cy="12" r="4" /><path d="M11 12h2" />',
  biais: '<path d="M4 18h16M6 18L12 6l6 12" /><path d="M12 6v12" stroke-dasharray="1.5 2" />',
  perspective: '<path d="M4 6l16-3v18L4 18z" />',
  nombre: '<path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16" />',
  spectre: '<path d="M4 18a8 8 0 0 1 16 0M7 18a5 5 0 0 1 10 0M10 18a2 2 0 0 1 4 0" />',
  tourbillon: '<path d="M12 12a2 2 0 1 1 2-2 4 4 0 1 1-4-4 6 6 0 1 1-6 6" />',
  bombement: '<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12c6-3 12-3 18 0M12 3c-3 6-3 12 0 18" />',
  centre: '<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="1.5" fill="currentColor" />',
  papierCouleur: '<path d="M5 3h10l4 4v14H5z" />',
  melange: '<circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" opacity=".5" />',
  graine: '<rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.2" /><circle cx="15" cy="15" r="1.2" /><circle cx="15" cy="9" r="1.2" /><circle cx="9" cy="15" r="1.2" />',
  rugosite: '<path d="M3 15l2-2 2 2 2-3 2 3 2-2 2 2 2-3 2 3 2-2" />',
  fibres: '<path d="M4 8c3 0 3 4 6 4s3-4 6-4 3 4 4 4M4 16c3 0 3-3 6-3s3 3 6 3" />',
  plis: '<path d="M3 4h18v16H3zM12 4v16M3 12h18" />',
  froissage: '<path d="M3 5l5 3 4-4 4 5 5-2-2 6 2 5-6-1-3 4-3-4-6 1 2-5z" />',
  gouttes: '<circle cx="7" cy="8" r="2" /><circle cx="15" cy="6" r="1.2" /><circle cx="17" cy="15" r="2.5" /><circle cx="8" cy="17" r="1.5" />',
  decoupe: '<path d="M6 3v18M18 3v18M3 6h18M3 18h18" stroke-dasharray="2 2" />',
  // Interface
  vitesse: '<path d="M4 18a9 9 0 1 1 16 0" /><path d="M12 14l5-5" />',
  mouvement: '<path d="M4 12h3l2-6 4 12 2-6h5" />',
  marge: '<rect x="3" y="3" width="18" height="18" rx="1" stroke-dasharray="2 2" /><rect x="7" y="7" width="10" height="10" rx="1" />',
  fond: '<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h6V3M15 3v6h6M3 15h6v6M15 21v-6h6" />',
  survol: '<path d="M5 3l13 8-6 1.5L9 19z" />',
} as const;

/* ───────────────────────── Définitions des matières ───────────────────────── */

const n = (cle: string, uniforme: string, libelle: string, icone: string, defaut: number, min: number, max: number, pas = 0.01, extra: Partial<DefReglage> = {}): DefReglage => ({ cle, uniforme, type: "nombre", libelle, icone, defaut, min, max, pas, ...extra });
const col = (cle: string, uniforme: string, libelle: string, icone: string, defaut: string, extra: Partial<DefReglage> = {}): DefReglage => ({ cle, uniforme, type: "couleur", libelle, icone, defaut, ...extra });
const bool = (cle: string, uniforme: string, libelle: string, icone: string, defaut: boolean): DefReglage => ({ cle, uniforme, type: "bool", libelle, icone, defaut });
const choix = (cle: string, uniforme: string, libelle: string, icone: string, defaut: string, ch: readonly (readonly [string, number, string])[], extra: Partial<DefReglage> = {}): DefReglage => ({ cle, uniforme, type: "choix", libelle, icone, defaut, choix: ch, ...extra });
const angle = (uniforme: string, libelle: string, defaut: number, max = 360, extra: Partial<DefReglage> = {}): DefReglage => n("angle", uniforme, libelle, ICONES.angle, defaut, 0, max, 1, { angle: true, ...extra });
const echelle = (defaut: number): DefReglage => n("echelle", "u_scale", "Échelle", ICONES.echelle, defaut, 0.2, 1.6);
const grain = (uniforme = "u_grainOverlay", defaut = 0): DefReglage => n("grain", uniforme, "Grain", ICONES.grain, defaut, 0, 1);

const TAU = 2 * Math.PI;

export const MATIERES: Record<Matiere, DefMatiere> = {
  "liquide-metal": {
    id: "liquide-metal",
    nom: "Métal liquide",
    description: "Chrome qui coule dans la forme du logo, franges de couleur sur les bords",
    shader: "liquidMetalFragmentShader",
    preparation: "liquide-metal",
    temps: true,
    periode: null,
    fixes: { u_isImage: true, u_shape: 0 },
    reglages: [
      col("teinte", "u_colorTint", "Teinte du métal", ICONES.teinte, "#ffffff", { principal: true }),
      n("repetition", "u_repetition", "Répétition des bandes", ICONES.repetition, 2, 1, 10, 0.1, { principal: true }),
      n("adoucissement", "u_softness", "Adoucissement", ICONES.adoucissement, 0.1, 0, 1),
      n("frange-rouge", "u_shiftRed", "Frange rouge", ICONES.frangeRouge, 0.3, -1, 1),
      n("frange-bleue", "u_shiftBlue", "Frange bleue", ICONES.frangeBleue, 0.3, -1, 1),
      n("distorsion", "u_distortion", "Distorsion", ICONES.distorsion, 0.07, 0, 1, 0.01, { principal: true }),
      n("contour", "u_contour", "Contour", ICONES.contour, 0.4, 0, 1),
      angle("u_angle", "Angle de l'écoulement", 70),
      echelle(0.86),
    ],
    presets: {
      chrome: { nom: "Chrome", valeurs: {} },
      noir: { nom: "Noir", valeurs: { teinte: "#606060", adoucissement: 0.45, repetition: 1.5, "frange-rouge": 0, "frange-bleue": 0, distorsion: 0, contour: 0, angle: 90 } },
      or: { nom: "Or", valeurs: { teinte: "#f2c26b", repetition: 2.5, "frange-rouge": 0.15, "frange-bleue": -0.1, distorsion: 0.1, contour: 0.5 } },
      cuivre: { nom: "Cuivre", valeurs: { teinte: "#e3946a", repetition: 3, "frange-rouge": 0.2, "frange-bleue": 0, distorsion: 0.12, contour: 0.45, angle: 40 } },
      rayures: { nom: "Rayures", valeurs: { teinte: "#2c5d72", adoucissement: 0.8, repetition: 6, "frange-rouge": 1, "frange-bleue": -1, distorsion: 0.4, contour: 0.4, angle: 0 } },
    },
    instantBeau: 1400,
    cleSurvol: "distorsion",
    masqueDefaut: false,
    icone: ICONES["liquide-metal"],
  },
  "gemme-fumee": {
    id: "gemme-fumee",
    nom: "Gemme de fumée",
    description: "Une gemme de verre où tournent des volutes colorées, débordant en halo",
    shader: "gemSmokeFragmentShader",
    preparation: "gemme-fumee",
    temps: true,
    periode: TAU * 1000,
    fixes: { u_isImage: true, u_shape: 0 },
    reglages: [
      { cle: "couleurs", uniforme: "u_colors", type: "couleurs", libelle: "Couleurs de la fumée", icone: ICONES.couleurs, defaut: ["#333333", "#e7e6df"], nombre: 6, principal: true },
      col("interieur", "u_colorInner", "Couleur intérieure", ICONES.couleur, "#fafaf5"),
      n("distorsion-interieure", "u_innerDistortion", "Distorsion intérieure", ICONES.distorsion, 0.8, 0, 1, 0.01, { principal: true }),
      n("distorsion-exterieure", "u_outerDistortion", "Distorsion extérieure", ICONES.vagues, 0.6, 0, 1),
      n("lueur-interieure", "u_innerGlow", "Lueur intérieure", ICONES.lueurIn, 1, 0, 1),
      n("lueur-exterieure", "u_outerGlow", "Lueur extérieure", ICONES.lueurOut, 0.55, 0, 1, 0.01, { principal: true }),
      n("decalage", "u_offset", "Décalage vertical", ICONES.decalage, 0, -1, 1),
      angle("u_angle", "Direction de la fumée", 0),
      n("taille", "u_size", "Taille de la fumée", ICONES.taille, 0.8, 0, 1),
      echelle(0.82),
    ],
    presets: {
      fumee: { nom: "Fumée", valeurs: {} },
      feu: { nom: "Feu", valeurs: { couleurs: ["#fe5b16", "#f7ff61", "#ffffff"], interieur: "#000000", "lueur-exterieure": 1, "lueur-interieure": 0.65, "distorsion-interieure": 0.6, "distorsion-exterieure": 0.8 } },
      fluo: { nom: "Fluorescent", valeurs: { couleurs: ["#2fb64c", "#cdff61", "#ffffff"], interieur: "#000000", "lueur-exterieure": 0, "lueur-interieure": 1, "distorsion-interieure": 1, "distorsion-exterieure": 0.8 } },
      infrarouge: { nom: "Infrarouge", valeurs: { couleurs: ["#ff9900", "#fff67a", "#dcff52", "#00ffbb", "#0077ff"], interieur: "#cd28dc", "lueur-exterieure": 1, "lueur-interieure": 1, "distorsion-interieure": 1, "distorsion-exterieure": 1, decalage: 0.2, taille: 1 } },
    },
    instantBeau: 2200,
    cleSurvol: "distorsion-interieure",
    masqueDefaut: false,
    halo: (l) => 0.05 + 0.2 * l,
    icone: ICONES["gemme-fumee"],
  },
  chaleur: {
    id: "chaleur",
    nom: "Chaleur",
    description: "Une image thermique : la chaleur court dans le logo et rayonne autour",
    shader: "heatmapFragmentShader",
    preparation: "chaleur",
    temps: true,
    periode: 10_000,
    fixes: {},
    reglages: [
      { cle: "couleurs", uniforme: "u_colors", type: "couleurs", libelle: "Dégradé de chaleur", icone: ICONES.couleurs, defaut: ["#11206a", "#1f3ba2", "#2f63e7", "#6bd7ff", "#ffe679", "#ff991e", "#ff4c00"], nombre: 10, principal: true },
      n("contour", "u_contour", "Chaleur des bords", ICONES.contour, 0.5, 0, 1, 0.01, { principal: true }),
      angle("u_angle", "Direction des vagues de chaleur", 0),
      n("grain", "u_noise", "Grain", ICONES.grain, 0, 0, 1),
      n("lueur-interieure", "u_innerGlow", "Lueur intérieure", ICONES.lueurIn, 0.75, 0, 1),
      n("lueur-exterieure", "u_outerGlow", "Lueur extérieure", ICONES.lueurOut, 0.5, 0, 1, 0.01, { principal: true }),
      echelle(0.8),
    ],
    presets: {
      thermique: { nom: "Thermique", valeurs: {} },
      sepia: { nom: "Sépia", valeurs: { couleurs: ["#997f45", "#ffffff"], grain: 0.75 } },
      braise: { nom: "Braise", valeurs: { couleurs: ["#1a0503", "#6b0f06", "#d23a0b", "#ff9a1f", "#ffe9a8"], contour: 0.7, "lueur-exterieure": 0.35 } },
      givre: { nom: "Givre", valeurs: { couleurs: ["#0b1430", "#2a4fa8", "#8fd3ff", "#ffffff"], contour: 0.6, "lueur-interieure": 0.35, "lueur-exterieure": 0.25 } },
    },
    instantBeau: 3000,
    cleSurvol: "lueur-exterieure",
    masqueDefaut: false,
    halo: (l) => 0.04 + 0.14 * l,
    icone: ICONES.chaleur,
  },
  eau: {
    id: "eau",
    nom: "Eau",
    description: "Le logo vu sous une eau qui ondule, caustiques et reflets",
    shader: "waterFragmentShader",
    preparation: null,
    temps: true,
    periode: null,
    fixes: {},
    reglages: [
      n("caustique", "u_caustic", "Caustique", ICONES.caustique, 0.1, 0, 1, 0.01, { principal: true }),
      n("vagues", "u_waves", "Vagues", ICONES.vagues, 0.3, 0, 1, 0.01, { principal: true }),
      n("couches", "u_layering", "Seconde couche", ICONES.couches, 0.5, 0, 1),
      n("bords", "u_edges", "Bords", ICONES.bords, 0.8, 0, 1),
      n("taille", "u_size", "Taille du motif", ICONES.taille, 1, 0.01, 7, 0.01, { principal: true }),
      col("reflet", "u_colorHighlight", "Couleur des reflets", ICONES.couleur, "#ffffff"),
      n("reflets", "u_highlights", "Reflets", ICONES.reflets, 0, 0, 1),
      echelle(0.9),
    ],
    presets: {
      onde: { nom: "Onde", valeurs: {} },
      courant: { nom: "Courant", valeurs: { reflets: 0, couches: 0, bords: 0, vagues: 0.5, caustique: 0, taille: 0.5 } },
      piscine: { nom: "Piscine", valeurs: { reflets: 0.4, couches: 0.3, bords: 0.6, vagues: 0.2, caustique: 0.4, taille: 0.7 } },
      abstrait: { nom: "Abstrait", valeurs: { couches: 0, bords: 1, vagues: 1, caustique: 0.4, taille: 0.15 } },
    },
    instantBeau: 1800,
    cleSurvol: "vagues",
    masqueDefaut: false,
    icone: ICONES.eau,
  },
  "verre-cannele": {
    id: "verre-cannele",
    nom: "Verre cannelé",
    description: "Le logo derrière un verre strié qui glisse lentement",
    shader: "flutedGlassFragmentShader",
    preparation: null,
    temps: false,
    periode: 8000,
    mouvement: { cle: "decalage", forme: "sinus", ampleur: 0.5, periode: 8000 },
    fixes: { u_marginLeft: 0, u_marginRight: 0, u_marginTop: 0, u_marginBottom: 0, u_grainMixer: 0 },
    reglages: [
      n("taille", "u_size", "Largeur des cannelures", ICONES.taille, 0.55, 0, 1, 0.01, { principal: true }),
      n("distorsion", "u_distortion", "Distorsion", ICONES.distorsion, 0.8, 0, 1, 0.01, { principal: true }),
      choix("motif", "u_shape", "Motif", ICONES.motif, "lignes", [["lignes", 1, "Lignes"], ["irregulier", 2, "Lignes irrégulières"], ["vague", 3, "Vague"], ["zigzag", 4, "Zigzag"], ["motif", 5, "Motif"]], { principal: true }),
      choix("relief", "u_distortionShape", "Relief de la cannelure", ICONES.relief, "prisme", [["prisme", 1, "Prisme"], ["lentille", 2, "Lentille"], ["contour", 3, "Contour"], ["cascade", 4, "Cascade"], ["plat", 5, "Plat"]]),
      n("decalage", "u_shift", "Décalage", ICONES.decalage, 0, -1, 1),
      n("etirement", "u_stretch", "Étirement", ICONES.etirement, 0, 0, 1),
      n("flou", "u_blur", "Flou", ICONES.flou, 0, 0, 1),
      n("bords", "u_edges", "Bords", ICONES.bords, 0.25, 0, 1),
      col("ombre", "u_colorShadow", "Couleur des ombres", ICONES.ombre, "#000000"),
      n("ombres", "u_shadows", "Ombres", ICONES.ombre, 0.25, 0, 1),
      col("reflet", "u_colorHighlight", "Couleur des reflets", ICONES.couleur, "#ffffff"),
      n("reflets", "u_highlights", "Reflets", ICONES.reflets, 0.1, 0, 1),
      angle("u_angle", "Direction des cannelures", 0, 180),
      grain(),
      echelle(0.9),
    ],
    presets: {
      prisme: { nom: "Prisme", valeurs: {} },
      vagues: { nom: "Vagues", valeurs: { ombres: 0, taille: 0.9, relief: "contour", reflets: 0, motif: "vague", flou: 0.1, bords: 0.5, etirement: 1, grain: 0.05 } },
      plis: { nom: "Plis", valeurs: { ombres: 0.4, taille: 0.4, relief: "cascade", reflets: 0, distorsion: 0.75, flou: 0.25, bords: 0.5 } },
      abstrait: { nom: "Abstrait", valeurs: { ombres: 0, taille: 0.7, angle: 30, relief: "plat", reflets: 0, motif: "irregulier", distorsion: 1, flou: 1, bords: 0.5, etirement: 1, grain: 0.1 } },
    },
    instantBeau: 2000,
    cleSurvol: "distorsion",
    masqueDefaut: true,
    icone: ICONES["verre-cannele"],
  },
  "trame-cmjn": {
    id: "trame-cmjn",
    nom: "Trame CMJN",
    description: "Quadrichromie en points d'encre, comme une affiche imprimée",
    shader: "halftoneCmykFragmentShader",
    preparation: null,
    temps: false,
    periode: 6000,
    mouvement: { cle: "taille", forme: "sinus", ampleur: 0.035, periode: 6000 },
    bruit: true,
    fixes: { u_grainSize: 0.5, u_grainMixer: 0, u_floodC: 0.15, u_floodM: 0, u_floodY: 0, u_floodK: 0, u_gainC: 0.3, u_gainM: 0, u_gainY: 0.2, u_gainK: 0 },
    reglages: [
      n("taille", "u_size", "Taille des points", ICONES.taille, 0.2, 0, 1, 0.01, { principal: true }),
      n("contraste", "u_contrast", "Contraste", ICONES.contraste, 1, 0, 2, 0.01, { principal: true }),
      n("adoucissement", "u_softness", "Adoucissement", ICONES.adoucissement, 1, 0, 1),
      n("bruit", "u_gridNoise", "Bruit de la grille", ICONES.bruit, 0.2, 0, 1),
      choix("type", "u_type", "Forme des points", ICONES.type, "encre", [["points", 0, "Points"], ["encre", 1, "Encre"], ["net", 2, "Net"]], { principal: true }),
      col("cyan", "u_colorC", "Encre cyan", ICONES.couleur, "#00b4ff"),
      col("magenta", "u_colorM", "Encre magenta", ICONES.couleur, "#fc519f"),
      col("jaune", "u_colorY", "Encre jaune", ICONES.couleur, "#ffd800"),
      col("noir", "u_colorK", "Encre noire", ICONES.couleur, "#231f20"),
      grain(),
      echelle(0.9),
    ],
    presets: {
      quadri: { nom: "Quadri", valeurs: {} },
      gouttes: { nom: "Gouttes", valeurs: { cyan: "#00b2ff", magenta: "#fc4f4f", jaune: "#ffd900", taille: 0.88, contraste: 1.15, adoucissement: 0, bruit: 0.5, grain: 0.25 } },
      ancien: { nom: "Ancien", valeurs: { cyan: "#59afc5", magenta: "#d8697c", jaune: "#fad85c", noir: "#2d2824", contraste: 1.25, adoucissement: 0.4, bruit: 0.45, grain: 0.1, type: "net" } },
    },
    instantBeau: 0,
    cleSurvol: "taille",
    masqueDefaut: true,
    icone: ICONES["trame-cmjn"],
  },
  "trame-points": {
    id: "trame-points",
    nom: "Trame de points",
    description: "Le logo en points d'une seule encre, qui respirent",
    shader: "halftoneDotsFragmentShader",
    preparation: null,
    temps: false,
    periode: 5000,
    mouvement: { cle: "rayon", forme: "sinus", ampleur: 0.22, periode: 5000 },
    fixes: { u_grainMixer: 0.2, u_grainSize: 0.5 },
    reglages: [
      col("encre", "u_colorFront", "Encre", ICONES.couleur, "#2b2b2b", { principal: true }),
      n("taille", "u_size", "Taille de la grille", ICONES.taille, 0.5, 0, 1, 0.01, { principal: true }),
      n("rayon", "u_radius", "Rayon des points", ICONES.rayon, 1.25, 0, 2, 0.01, { principal: true }),
      n("contraste", "u_contrast", "Contraste", ICONES.contraste, 0.4, 0, 1),
      choix("grille", "u_grid", "Grille", ICONES.grille, "hex", [["carre", 0, "Carrée"], ["hex", 1, "Hexagonale"]]),
      choix("type", "u_type", "Forme des points", ICONES.type, "gluant", [["classique", 0, "Classique"], ["gluant", 1, "Gluant"], ["trous", 2, "Trous"], ["doux", 3, "Doux"]]),
      bool("inverse", "u_inverted", "Inverser la luminance", ICONES.inverse, false),
      bool("couleurs-image", "u_originalColors", "Couleurs du logo", ICONES.image, true),
      grain("u_grainOverlay", 0.2),
      echelle(0.9),
    ],
    presets: {
      encre: { nom: "Encre", valeurs: {} },
      led: { nom: "Écran LED", valeurs: { encre: "#29ff7b", rayon: 1.5, contraste: 0.3, grain: 0, grille: "carre", type: "doux", "couleurs-image": false } },
      mosaique: { nom: "Mosaïque", valeurs: { encre: "#b2aeae", taille: 0.6, rayon: 2, contraste: 0.01, grain: 0, type: "classique" } },
      trous: { nom: "Rond et carré", valeurs: { encre: "#ff8000", taille: 0.8, rayon: 1, contraste: 1, inverse: true, grain: 0.3, grille: "carre", type: "trous", "couleurs-image": false } },
    },
    instantBeau: 1250,
    cleSurvol: "rayon",
    masqueDefaut: true,
    icone: ICONES["trame-points"],
  },
  tramage: {
    id: "tramage",
    nom: "Tramage",
    description: "Pixels tramés d'écran ancien, le logo respire à travers la grille",
    shader: "imageDitheringFragmentShader",
    preparation: null,
    temps: false,
    periode: 4000,
    mouvement: { cle: "echelle", forme: "sinus", ampleur: 0.02, periode: 4000 },
    fixes: {},
    reglages: [
      col("encre", "u_colorFront", "Encre", ICONES.couleur, "#1d2bd8", { principal: true }),
      col("reflet", "u_colorHighlight", "Seconde encre", ICONES.couleur, "#ff5a36"),
      col("sombre", "u_colorBack", "Couleur des creux", ICONES.ombre, "transparent"),
      choix("type", "u_type", "Trame", ICONES.type, "8x8", [["aleatoire", 1, "Aléatoire"], ["2x2", 2, "Bayer 2 × 2"], ["4x4", 3, "Bayer 4 × 4"], ["8x8", 4, "Bayer 8 × 8"]], { principal: true }),
      n("pixel", "u_pxSize", "Taille des pixels", ICONES.pixel, 2, 0.5, 20, 0.5, { principal: true }),
      n("niveaux", "u_colorSteps", "Niveaux", ICONES.niveaux, 2, 1, 7, 1),
      bool("inverse", "u_inverted", "Inverser la luminance", ICONES.inverse, true),
      bool("couleurs-image", "u_originalColors", "Couleurs du logo", ICONES.image, false),
      echelle(0.9),
    ],
    presets: {
      encre: { nom: "Encre", valeurs: {} },
      phosphore: { nom: "Phosphore", valeurs: { encre: "#94ffaf", reflet: "#eaff94", sombre: "#000c38" } },
      retro: { nom: "Rétro", valeurs: { encre: "#eeeeee", reflet: "#eeeeee", sombre: "#5452ff", type: "2x2", pixel: 3, niveaux: 1, "couleurs-image": true } },
      bruit: { nom: "Bruit", valeurs: { encre: "#a2997c", reflet: "#ededed", type: "aleatoire", pixel: 1, niveaux: 1 } },
      naturel: { nom: "Naturel", valeurs: { encre: "#ffffff", reflet: "#ffffff", pixel: 2, niveaux: 5, "couleurs-image": true } },
    },
    instantBeau: 0,
    cleSurvol: "pixel",
    masqueDefaut: true,
    icone: ICONES.tramage,
  },
  lentille: {
    id: "lentille",
    nom: "Lentille",
    description: "Aberration chromatique d'une lentille qui tourne autour du logo",
    shader: "lensDistortionFragmentShader",
    preparation: null,
    temps: false,
    periode: 9000,
    mouvement: { cle: "angle", forme: "tour", ampleur: 360, periode: 9000 },
    fixes: { u_dispersionShift: 0, u_noise: 0, u_noiseFrequency: 0.25, u_noiseOffset: 0, u_lensCircle: 0, u_grainMixer: 0, u_imageX: 0, u_imageY: 0 },
    reglages: [
      n("ecart", "u_spread", "Écart des couleurs", ICONES.ecart, 0.25, 0, 1, 0.01, { principal: true }),
      n("dispersion", "u_dispersion", "Dispersion", ICONES.spectre, 1, 0, 1, 0.01, { principal: true }),
      n("tourbillon", "u_swirl", "Tourbillon", ICONES.tourbillon, 0.35, -1, 1, 0.01, { principal: true }),
      n("biais", "u_bias", "Biais", ICONES.biais, 1, -1, 1),
      angle("u_angle", "Direction de l'écart", 0),
      n("perspective", "u_perspective", "Perspective", ICONES.perspective, 0.1, 0, 1),
      n("nombre", "u_count", "Nombre de couches", ICONES.nombre, 24, 2, 50, 1),
      n("spectre", "u_dispersionColor", "Teinte du spectre", ICONES.teinte, 0.6, 0, 1),
      n("centre", "u_focusCenter", "Netteté au centre", ICONES.centre, 0.5, 0, 1),
      n("bords", "u_focusEdges", "Netteté aux bords", ICONES.bords, 0, 0, 1),
      n("bombement", "u_lensBulge", "Bombement", ICONES.bombement, 0, -1, 1),
      grain(),
      echelle(0.8),
    ],
    presets: {
      prisme: { nom: "Prisme", valeurs: {} },
      fisheye: { nom: "Fisheye", valeurs: { ecart: 0.5, perspective: 0.75, nombre: 15, spectre: 0.7, centre: 0.9, tourbillon: 1, bombement: 0.6 } },
      bichromie: { nom: "Bichromie", valeurs: { ecart: 0.1, biais: 0, perspective: 0, nombre: 2, spectre: 0.1, centre: 0, bords: 0, tourbillon: 0, grain: 0.3 } },
      fumee: { nom: "Fumée", valeurs: { ecart: 0.5, biais: -1, perspective: 0.4, nombre: 50, dispersion: 0, spectre: 0.31, centre: 0, bords: 0.6, tourbillon: 0 } },
    },
    instantBeau: 1500,
    cleSurvol: "ecart",
    masqueDefaut: false,
    icone: ICONES.lentille,
  },
  papier: {
    id: "papier",
    nom: "Papier",
    description: "Le logo à l'encre sur un papier froissé : fibres, plis, la lumière tourne",
    shader: "paperTextureFragmentShader",
    preparation: null,
    temps: false,
    periode: 12_000,
    mouvement: { cle: "angle", forme: "tour", ampleur: 360, periode: 12_000 },
    bruit: true,
    fixes: { u_isImage: true, u_roughnessSize: 0.5, u_roughnessRows: 0, u_fiberSize: 0.5, u_foldSizeX: 1, u_foldSizeY: 1, u_foldOffsetX: 0, u_foldOffsetY: 0, u_wrinkleSize: 0.65, u_crumpleCount: 6 },
    reglages: [
      n("froissage", "u_wrinkles", "Froissage", ICONES.froissage, 1, 0, 1, 0.01, { principal: true }),
      n("plis", "u_folds", "Plis", ICONES.plis, 0.5, 0, 1, 0.01, { principal: true }),
      n("distorsion", "u_distortion", "Le logo suit la feuille", ICONES.distorsion, 0.75, -1, 1, 0.01, { principal: true }),
      col("papier", "u_colorPaper", "Couleur du papier", ICONES.papierCouleur, "#ffffff"),
      col("ombre", "u_colorShadow", "Couleur des reliefs", ICONES.ombre, "#cccccc"),
      n("melange", "u_blending", "Mélange encre et papier", ICONES.melange, 1, 0, 1),
      angle("u_angle", "Direction de la lumière", 300),
      n("graine", "u_seed", "Graine", ICONES.graine, 4, 0, 1000, 1),
      n("rugosite", "u_roughness", "Rugosité", ICONES.rugosite, 0.4, 0, 1),
      n("fibres", "u_fiber", "Fibres", ICONES.fibres, 0.4, 0, 1),
      n("froisses", "u_crumples", "Grands froissés", ICONES.froissage, 0, 0, 1),
      n("gouttes", "u_drops", "Taches", ICONES.gouttes, 0.4, 0, 1),
      bool("feuille-coupee", "u_clip", "Feuille coupée au cadre du logo", ICONES.decoupe, true),
      echelle(0.9),
    ],
    presets: {
      froisse: { nom: "Froissé", valeurs: {} },
      plie: { nom: "Plié", valeurs: { ombre: "#b3b3b3", distorsion: -0.5, angle: 60, graine: 49, froissage: 0, plis: 0, froisses: 1, gouttes: 0 } },
      calque: { nom: "Calque", valeurs: { papier: "#ffffffb5", ombre: "#b3b3b3", distorsion: -0.3, angle: 236, graine: 613, rugosite: 0.15, fibres: 0.5, plis: 1, froissage: 0, gouttes: 0 } },
      verge: { nom: "Vergé", valeurs: { papier: "#ffffffa8", ombre: "#b3b3b3", distorsion: 0, angle: 0, graine: 455, rugosite: 1, fibres: 0.7, plis: 0, froissage: 0, gouttes: 0.2 } },
    },
    instantBeau: 3000,
    cleSurvol: "distorsion",
    masqueDefaut: false,
    icone: ICONES.papier,
  },
};

export const estMatiere = (v: unknown): v is Matiere => typeof v === "string" && (MATIERES_NOMS as readonly string[]).includes(v);
export const matiereDe = (v: unknown): Matiere => (estMatiere(v) ? v : "liquide-metal");

/* ───────────────────────── Configuration ───────────────────────── */

export const SURVOLS = ["aucun", "vitesse", "distorsion"] as const;
export type Survol = (typeof SURVOLS)[number];
export const POLICES = ["archivo", "bodoni"] as const;
export type Police = (typeof POLICES)[number];

export interface ConfigLogo {
  matiere: Matiere;
  /** Adresse du logo (SVG, PNG, WebP). */
  src: string;
  /** Ou un texte rastérisé. */
  texte: string;
  police: Police;
  /** Le préréglage de base ("" : aucun, les défauts de la matière). */
  preset: string;
  fond: string;
  vitesse: number;
  pause: boolean;
  /** Instant montré à l'arrêt (ms), -1 : l'instant beau de la matière. */
  instant: number;
  survol: Survol;
  marge: number;
  masque: boolean;
  sansFond: boolean;
  mouvement: number;
  valeurs: Valeurs;
}

export const COMMUNS = { vitesse: [0, 4, 1], marge: [0, 0.5, 0.12], mouvement: [0, 1, 1] } as const;
const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const arrondi = (x: number, pas = 0.001) => {
  const k = Math.round(x / pas) * pas;
  const d = Math.max(0, -Math.floor(Math.log10(pas) + 1e-9));
  return Number(k.toFixed(Math.min(6, d + 1)));
};

/** Une couleur CSS simple → [r, v, b, a] en 0–1, ou null. Accepte #rgb, #rgba, #rrggbb, #rrggbbaa, transparent. */
export function couleurRVBA(v: string): [number, number, number, number] | null {
  const s = v.trim().toLowerCase();
  if (s === "transparent" || s === "aucun" || s === "") return [0, 0, 0, 0];
  const m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  const k = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return [k(0), k(2), k(4), h.length === 8 ? k(6) : 1];
}
export const estCouleur = (v: unknown) => typeof v === "string" && couleurRVBA(v) !== null;
/** Une couleur normalisée (#rrggbb, ou #rrggbbaa si elle n'est pas opaque ; « transparent »). */
export function normaliserCouleur(v: string, defaut: string): string {
  const c = couleurRVBA(v);
  if (!c) return defaut;
  if (c[3] === 0) return "transparent";
  const h = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${h(c[0])}${h(c[1])}${h(c[2])}${c[3] < 1 ? h(c[3]) : ""}`;
}

/** La valeur d'un réglage, normalisée : bornée, arrondie à son pas, couleur valide, choix connu. */
export function normaliserValeur(def: DefReglage, brut: unknown): Valeur {
  switch (def.type) {
    case "nombre": {
      const x = typeof brut === "number" ? brut : Number(String(brut ?? "").replace(",", "."));
      if (!Number.isFinite(x) || String(brut ?? "").trim() === "") return def.defaut;
      return arrondi(borne(x, def.min ?? -Infinity, def.max ?? Infinity), def.pas ?? 0.001);
    }
    case "couleur":
      return typeof brut === "string" ? normaliserCouleur(brut, def.defaut as string) : def.defaut;
    case "couleurs": {
      const liste = Array.isArray(brut) ? brut.map(String) : typeof brut === "string" ? brut.split(/[\s,]+/) : [];
      const ok = liste.filter(estCouleur).slice(0, def.nombre ?? 10).map((c) => normaliserCouleur(c, "#000000"));
      return ok.length ? ok : [...(def.defaut as string[])];
    }
    case "choix": {
      const s = String(brut ?? "");
      return def.choix?.some(([v]) => v === s) ? s : def.defaut;
    }
    case "bool":
      if (typeof brut === "boolean") return brut;
      if (brut === "" || brut === "oui" || brut === "true" || brut === "1") return true;
      if (brut === "non" || brut === "false" || brut === "0") return false;
      return def.defaut;
  }
}

export const reglage = (m: Matiere, cle: string) => MATIERES[m].reglages.find((r) => r.cle === cle);

/** Les valeurs d'une matière : défauts, puis préréglage, puis valeurs données (toutes normalisées). */
export function valeursDe(m: Matiere, preset = "", donnees: Record<string, unknown> = {}): Valeurs {
  const d = MATIERES[m];
  const base = d.presets[preset]?.valeurs ?? {};
  const out: Valeurs = {};
  for (const r of d.reglages) {
    const brut = r.cle in donnees ? donnees[r.cle] : r.cle in base ? base[r.cle] : r.defaut;
    out[r.cle] = normaliserValeur(r, brut);
  }
  return out;
}

export function configParDefaut(m: Matiere = "liquide-metal"): ConfigLogo {
  return { matiere: m, src: "", texte: "", police: "archivo", preset: "", fond: "transparent", vitesse: 1, pause: false, instant: -1, survol: "aucun", marge: COMMUNS.marge[2], masque: MATIERES[m].masqueDefaut, sansFond: false, mouvement: 1, valeurs: valeursDe(m) };
}

const oui = (v: string | null | undefined) => v !== null && v !== undefined && v !== "non" && v !== "false" && v !== "0";

/**
 * La configuration lue sur des paires (suffixe d'attribut → valeur) : celles d'un élément (`data-logo-<suffixe>`, la
 * matière sous la clé "") ou d'une adresse (`logo=…&src=…`). Les clés inconnues sont ignorées.
 */
export function lirePaires(paires: Iterable<readonly [string, string]>): ConfigLogo {
  const p = new Map<string, string>();
  for (const [k, v] of paires) p.set(k === "logo" ? "" : k, v);
  const m = matiereDe(p.get(""));
  const d = MATIERES[m];
  const c = configParDefaut(m);
  c.src = (p.get("src") ?? "").trim();
  c.texte = (p.get("texte") ?? "").slice(0, 40);
  c.police = (POLICES as readonly string[]).includes(p.get("police") ?? "") ? (p.get("police") as Police) : "archivo";
  c.preset = p.get("presets") && d.presets[p.get("presets")!] ? p.get("presets")! : "";
  c.fond = normaliserCouleur(p.get("fond") ?? "transparent", "transparent");
  const nb = (k: keyof typeof COMMUNS) => {
    const [a, b, def] = COMMUNS[k];
    const x = Number(p.get(k));
    return p.has(k) && p.get(k) !== "" && Number.isFinite(x) ? arrondi(borne(x, a, b), 0.01) : def;
  };
  c.vitesse = nb("vitesse");
  c.marge = nb("marge");
  c.mouvement = nb("mouvement");
  c.pause = p.has("pause") && oui(p.get("pause"));
  const inst = Number(p.get("instant"));
  c.instant = p.has("instant") && Number.isFinite(inst) && inst >= 0 ? Math.round(inst) : -1;
  c.survol = (SURVOLS as readonly string[]).includes(p.get("survol") ?? "") ? (p.get("survol") as Survol) : "aucun";
  c.masque = p.has("masque") ? oui(p.get("masque")) : d.masqueDefaut;
  c.sansFond = p.has("sans-fond") && oui(p.get("sans-fond"));
  const donnees: Record<string, unknown> = {};
  for (const r of d.reglages) if (p.has(r.cle)) donnees[r.cle] = p.get(r.cle);
  c.valeurs = valeursDe(m, c.preset, donnees);
  return c;
}

/** Les paires d'un élément : ses attributs `data-logo` et `data-logo-*`. */
export function pairesElement(el: { attributes: ArrayLike<{ name: string; value: string }> }): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i]!;
    if (a.name === "data-logo") out.push(["", a.value]);
    else if (a.name.startsWith("data-logo-")) out.push([a.name.slice(10), a.value]);
  }
  return out;
}

const egal = (a: Valeur, b: Valeur) => (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => x === b[i]) : a === b);
const texteValeur = (v: Valeur) => (Array.isArray(v) ? v.join(" ") : typeof v === "boolean" ? (v ? "oui" : "non") : String(v));

/**
 * Les paires (suffixe → valeur) qui redonnent la configuration, les seules qui diffèrent des défauts (du préréglage
 * s'il y en a un). La matière vient d'abord, sous la clé "".
 */
export function versPaires(c: ConfigLogo): [string, string][] {
  const d = MATIERES[c.matiere];
  const out: [string, string][] = [["", c.matiere]];
  if (c.src) out.push(["src", c.src]);
  else if (c.texte) out.push(["texte", c.texte]);
  if (!c.src && c.texte && c.police !== "archivo") out.push(["police", c.police]);
  if (c.preset && d.presets[c.preset]) out.push(["presets", c.preset]);
  const base = valeursDe(c.matiere, c.preset);
  for (const r of d.reglages) {
    const v = c.valeurs[r.cle];
    if (v !== undefined && !egal(normaliserValeur(r, v), base[r.cle]!)) out.push([r.cle, texteValeur(normaliserValeur(r, v))]);
  }
  if (c.fond !== "transparent") out.push(["fond", c.fond]);
  if (c.vitesse !== COMMUNS.vitesse[2]) out.push(["vitesse", String(c.vitesse)]);
  if (c.pause) out.push(["pause", ""]);
  if (c.instant >= 0) out.push(["instant", String(c.instant)]);
  if (c.survol !== "aucun") out.push(["survol", c.survol]);
  if (c.marge !== COMMUNS.marge[2]) out.push(["marge", String(c.marge)]);
  if (c.masque !== d.masqueDefaut) out.push(["masque", c.masque ? "oui" : "non"]);
  if (c.sansFond) out.push(["sans-fond", ""]);
  if (d.mouvement && c.mouvement !== COMMUNS.mouvement[2]) out.push(["mouvement", String(c.mouvement)]);
  return out;
}

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Les attributs HTML de la configuration : `data-logo="…" data-logo-src="…" …`. */
export function attributsHtml(c: ConfigLogo): string {
  return versPaires(c)
    .map(([k, v]) => (k === "" ? `data-logo="${echapper(v)}"` : v === "" ? `data-logo-${k}` : `data-logo-${k}="${echapper(v)}"`))
    .join(" ");
}

/** Le bloc HTML Presse à copier. */
export function blocHtml(c: ConfigLogo, nom = ""): string {
  const label = nom || c.texte || "Logo";
  const repli = c.src ? `\n  <img src="${echapper(c.src)}" alt="" />` : "";
  return `<div ${attributsHtml(c)} role="img" aria-label="${echapper(label)}" style="width: 480px; aspect-ratio: 16 / 9">${repli}\n</div>`;
}

/** La configuration en JSON (complète et lisible ; relue par `depuisJson`). */
export function versJson(c: ConfigLogo): string {
  return JSON.stringify({ format: "presse-logo", version: 1, ...c }, null, 2);
}
export function depuisJson(texte: string): ConfigLogo | null {
  let o: unknown;
  try {
    o = JSON.parse(texte);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  if (!estMatiere(r.matiere)) return null;
  const paires: [string, string][] = [["", r.matiere]];
  const s = (k: string, nom = k) => {
    if (r[k] !== undefined && r[k] !== null) paires.push([nom, String(r[k])]);
  };
  s("src");
  s("texte");
  s("police");
  s("preset", "presets");
  s("fond");
  s("vitesse");
  s("instant");
  s("survol");
  s("marge");
  s("mouvement");
  if (r.pause === true) paires.push(["pause", ""]);
  if (typeof r.masque === "boolean") paires.push(["masque", r.masque ? "oui" : "non"]);
  if (r.sansFond === true) paires.push(["sans-fond", ""]);
  const c = lirePaires(paires);
  if (r.valeurs && typeof r.valeurs === "object") c.valeurs = valeursDe(c.matiere, "", { ...c.valeurs, ...(r.valeurs as Record<string, unknown>) });
  return c;
}

/** L'état dans l'adresse : `logo=liquide-metal&src=…&repetition=4` (le fichier déposé n'y passe pas). */
export function versHash(c: ConfigLogo): string {
  const u = new URLSearchParams();
  for (const [k, v] of versPaires(c)) {
    if (k === "src" && /^(blob:|data:)/.test(v)) continue;
    u.append(k === "" ? "logo" : k, v);
  }
  return u.toString();
}
export function depuisHash(hash: string): ConfigLogo | null {
  const u = new URLSearchParams(hash.replace(/^#/, ""));
  if (!estMatiere(u.get("logo"))) return null;
  return lirePaires(u.entries());
}

/* ───────────────────────── Hasard à graine ───────────────────────── */

/** mulberry32 : un générateur déterministe (la même graine, les mêmes tirages). */
export function generateur(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hsl = (h: number, s: number, l: number) => {
  const f = (k: number) => {
    const kk = (k + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1));
  };
  const x = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${x(f(0))}${x(f(8))}${x(f(4))}`;
};

/**
 * Un tirage des réglages d'une matière, à graine : les réglages `verrous` gardent leur valeur ; les nombres sont tirés
 * dans le tiers central de leur plage (pas d'extrême illisible), les couleurs en harmonie autour d'une teinte tirée.
 */
export function alea(m: Matiere, actuelles: Valeurs, graine: number, verrous: Iterable<string> = []): Valeurs {
  const r = generateur(graine);
  const v = new Set(verrous);
  const teinte = r() * 360;
  const out: Valeurs = { ...actuelles };
  for (const d of MATIERES[m].reglages) {
    if (v.has(d.cle)) continue;
    if (d.cle === "echelle" || d.cle === "graine" || d.cle === "nombre") continue;
    switch (d.type) {
      case "nombre": {
        const a = d.min ?? 0;
        const b = d.max ?? 1;
        const lo = a + (b - a) * (d.angle ? 0 : 0.15);
        const hi = a + (b - a) * (d.angle ? 1 : 0.85);
        out[d.cle] = normaliserValeur(d, lo + (hi - lo) * r());
        break;
      }
      case "couleur":
        out[d.cle] = actuelles[d.cle] === "transparent" ? "transparent" : hsl((teinte + (r() - 0.5) * 90 + 360) % 360, 0.55 + 0.4 * r(), 0.35 + 0.5 * r());
        break;
      case "couleurs": {
        const k = Math.max(2, Math.min(d.nombre ?? 6, 2 + Math.floor(r() * 4)));
        const l = Array.from({ length: k }, (_, i) => hsl((teinte + i * (40 + 40 * r())) % 360, 0.6 + 0.35 * r(), 0.15 + (0.75 * i) / (k - 1)));
        // Un dégradé qui part du transparent (la chaleur : le froid ne couvre pas le fond) le garde.
        const avant = actuelles[d.cle];
        out[d.cle] = Array.isArray(avant) && avant[0] === "transparent" ? ["transparent", ...l].slice(0, d.nombre ?? 10) : l;
        break;
      }
      case "choix":
        out[d.cle] = d.choix![Math.floor(r() * d.choix!.length)]![0];
        break;
      case "bool":
        break;
    }
  }
  return valeursDe(m, "", out);
}

/* ───────────────────────── Uniformes ───────────────────────── */

export type Uniformes = Record<string, number | boolean | number[] | number[][]>;

/** La valeur d'un réglage animé à l'instant t (ms de l'horloge), à l'ampleur `k` (0–1). */
export function valeurMouvement(mv: Mouvement, base: number, t: number, k: number, def?: DefReglage): number {
  const phase = (t / mv.periode) * 2 * Math.PI;
  let x = mv.forme === "tour" ? base + mv.ampleur * k * ((t / mv.periode) % 1) : base + mv.ampleur * k * Math.sin(phase);
  if (mv.forme === "tour") x = ((x % 360) + 360) % 360;
  if (def && mv.forme !== "tour") x = borne(x, def.min ?? -Infinity, def.max ?? Infinity);
  return x;
}

/**
 * Les uniformes Paper d'une matière (sans l'image ni la texture de bruit) à l'instant t. Le fond n'y est jamais : il
 * est peint derrière (CSS, export), u_colorBack reste transparent — sauf pour le tramage, où c'est une encre.
 * `pousse` : 0–1, le survol « distorsion ».
 */
export function uniformesDe(c: ConfigLogo, t = 0, pousse = 0): Uniformes {
  const d = MATIERES[c.matiere];
  const u: Uniformes = { u_colorBack: [0, 0, 0, 0], ...d.fixes, u_fit: 1, u_scale: 1, u_rotation: 0, u_offsetX: 0, u_offsetY: 0, u_originX: 0.5, u_originY: 0.5, u_worldWidth: 0, u_worldHeight: 0 };
  for (const r of d.reglages) {
    let v = c.valeurs[r.cle] ?? r.defaut;
    if (d.mouvement && d.mouvement.cle === r.cle && typeof v === "number") v = valeurMouvement(d.mouvement, v, t, c.mouvement, r);
    if (pousse > 0 && r.cle === d.cleSurvol && typeof v === "number") v = borne(v + ((r.max ?? 1) - v) * 0.6 * pousse, r.min ?? -Infinity, r.max ?? Infinity);
    switch (r.type) {
      case "nombre":
        u[r.uniforme] = v as number;
        break;
      case "couleur":
        u[r.uniforme] = couleurRVBA(String(v)) ?? [0, 0, 0, 1];
        break;
      case "couleurs": {
        const l = (v as string[]).map((x) => couleurRVBA(x) ?? [0, 0, 0, 1]);
        u[r.uniforme] = l;
        u[`${r.uniforme}Count`] = l.length;
        break;
      }
      case "choix":
        u[r.uniforme] = r.choix!.find(([k]) => k === v)?.[1] ?? 0;
        break;
      case "bool":
        u[r.uniforme] = Boolean(v);
        break;
    }
  }
  return u;
}

/** Le rayon du halo (fraction du grand côté du logo), ou null : la lueur extérieure, au plus fort si le survol la pousse. */
export function rayonHalo(c: ConfigLogo): number | null {
  const d = MATIERES[c.matiere];
  if (!d.halo) return null;
  const l = Number(c.valeurs["lueur-exterieure"] ?? 0.5);
  return Math.round(d.halo(c.survol === "distorsion" && d.cleSurvol === "lueur-exterieure" ? 1 : l) * 100) / 100;
}

/* ───────────────────────── Séquence d'export ───────────────────────── */

export interface ImageSequence {
  /** Instant de l'image (ms de l'horloge). */
  t: number;
  /** Fondu de bouclage : l'image se mêle à celle de cet instant, avec ce poids (0–1). */
  fondu?: { t: number; poids: number };
}
export interface Sequence {
  images: ImageSequence[];
  /** Durée réelle (s), ajustée à un nombre entier de périodes si la matière boucle. */
  duree: number;
  ips: number;
  /** "periode" : la matière revient exactement à son départ ; "fondu" : fondu enchaîné de la fin sur le début ; "non". */
  boucle: "periode" | "fondu" | "non";
}

/**
 * Les images d'une séquence : `duree` (s), `ips` (images par seconde), `vitesse` (l'horloge avance de 1000 × vitesse ms
 * par seconde), `debut` (ms). Avec `boucle` : si la matière a une période, la durée est calée sur un nombre entier de
 * périodes (l'image qui suivrait la dernière est la première) ; sinon un fondu enchaîné sur le premier quart rend la
 * boucle sans couture (même propriété). Déterministe : les instants ne dépendent que des arguments.
 */
export function echantillonner(o: { duree: number; ips: number; vitesse: number; debut?: number; periode: number | null; boucle: boolean }): Sequence {
  const ips = Math.round(borne(o.ips || 24, 1, 120));
  const vitesse = o.vitesse > 0 ? o.vitesse : 1;
  const debut = o.debut ?? 0;
  let duree = borne(o.duree || 3, 1 / ips, 60);
  if (o.boucle && o.periode) {
    const p = o.periode / vitesse / 1000; // période réelle (s)
    const k = Math.max(1, Math.round(duree / p));
    duree = k * p;
    const nb = Math.max(1, Math.round(duree * ips));
    const portee = k * o.periode;
    return { images: Array.from({ length: nb }, (_, i) => ({ t: debut + (i * portee) / nb })), duree, ips, boucle: "periode" };
  }
  const nb = Math.max(1, Math.round(duree * ips));
  duree = nb / ips;
  const pas = (1000 * vitesse) / ips;
  const portee = nb * pas;
  if (!o.boucle || nb < 4) return { images: Array.from({ length: nb }, (_, i) => ({ t: debut + i * pas })), duree, ips, boucle: "non" };
  const f = Math.max(2, Math.round(nb / 4));
  return {
    images: Array.from({ length: nb }, (_, i) => (i < f ? { t: debut + i * pas, fondu: { t: debut + i * pas + portee, poids: 1 - i / f } } : { t: debut + i * pas })),
    duree,
    ips,
    boucle: "fondu",
  };
}

/** Les matières qui bouclent exactement (période connue). */
export const bouclent = (): Matiere[] => MATIERES_NOMS.filter((m) => MATIERES[m].periode !== null);

/** Nom d'une image de la séquence. */
export const nomImage = (base: string, i: number) => `${base}-${String(i).padStart(4, "0")}.png`;

/** Le petit script ffmpeg joint à la séquence : ProRes 4444, HEVC avec alpha, VP9 avec alpha, MP4 sur fond. */
export function ffmpegTxt(o: { base: string; ips: number; largeur: number; hauteur: number; fond?: string }): string {
  const i = `-framerate ${o.ips} -i ${o.base}-%04d.png`;
  const pair = `-vf "pad=ceil(iw/2)*2:ceil(ih/2)*2:color=0x00000000"`;
  const fond = o.fond && o.fond !== "transparent" ? o.fond.replace("#", "0x").slice(0, 8) : "0x000000";
  return [
    `# Séquence PNG à fond transparent : ${o.base}-0000.png …, ${o.largeur} × ${o.hauteur} px, ${o.ips} images/s.`,
    `# Le navigateur ne sait pas écrire de MP4 ni de MOV transparents : ffmpeg les fait depuis la séquence.`,
    `# Lancer chaque commande dans ce dossier.`,
    ``,
    `# 1. MOV ProRes 4444 avec alpha (montage : Premiere, Final Cut, After Effects, DaVinci Resolve)`,
    `ffmpeg ${i} -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 -vendor apl0 ${o.base}.mov`,
    ``,
    `# 2. HEVC (H.265) avec alpha, lu par Safari et les appareils Apple`,
    `#    macOS (VideoToolbox) :`,
    `ffmpeg ${i} ${pair} -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.75 -vtag hvc1 -pix_fmt bgra ${o.base}-hevc.mov`,
    `#    ailleurs, ffmpeg ≥ 7.1 avec libx265 ≥ 4.0 :`,
    `ffmpeg ${i} ${pair} -c:v libx265 -pix_fmt yuva420p -crf 22 -tag:v hvc1 ${o.base}-hevc.mp4`,
    ``,
    `# 3. WebM VP9 avec alpha (Chrome, Firefox, Edge)`,
    `ffmpeg ${i} ${pair} -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 -auto-alt-ref 0 ${o.base}.webm`,
    ``,
    `# 4. MP4 H.264 sans transparence, sur un fond uni (partout, réseaux sociaux)`,
    `ffmpeg -f lavfi -i color=c=${fond}:s=${o.largeur + (o.largeur % 2)}x${o.hauteur + (o.hauteur % 2)}:r=${o.ips} ${i} -filter_complex "[0][1]overlay=shortest=1,format=yuv420p" -c:v libx264 -crf 18 -movflags +faststart ${o.base}-fond.mp4`,
    ``,
  ].join("\n");
}

/* ───────────────────────── Image source ───────────────────────── */

/** La boîte des pixels dont l'alpha dépasse `seuil` (données RVBA), ou null si l'image est vide. */
export function boiteAlpha(data: ArrayLike<number>, largeur: number, hauteur: number, seuil = 8): { x: number; y: number; l: number; h: number } | null {
  let x0 = largeur;
  let y0 = hauteur;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < hauteur; y++) {
    const ligne = y * largeur * 4;
    for (let x = 0; x < largeur; x++) {
      if (data[ligne + x * 4 + 3]! > seuil) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, l: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Le recadrage : la boîte du logo, plus la marge (fraction de son grand côté) de chaque côté. Dimensions entières. */
export function recadrage(boite: { x: number; y: number; l: number; h: number }, marge: number) {
  const m = Math.round(Math.max(boite.l, boite.h) * borne(marge, 0, 0.5));
  return { sx: boite.x, sy: boite.y, sl: boite.l, sh: boite.h, l: boite.l + 2 * m, h: boite.h + 2 * m, m };
}

/** La taille de rastérisation d'un vecteur : grand côté = taille affichée × dpr (≤ 2), entre 512 et 2048, ≤ plafond de pixels. */
export function tailleRaster(rapport: number, cotePx: number, dpr: number, plafond = 4_194_304): { l: number; h: number } {
  const r = rapport > 0 && Number.isFinite(rapport) ? rapport : 1;
  let grand = Math.round(borne(cotePx * Math.min(2, Math.max(1, dpr)), 512, 2048));
  let l = r >= 1 ? grand : Math.round(grand * r);
  let h = r >= 1 ? Math.round(grand / r) : grand;
  if (l * h > plafond) {
    const k = Math.sqrt(plafond / (l * h));
    grand = Math.floor(grand * k);
    l = Math.max(1, Math.floor(l * k));
    h = Math.max(1, Math.floor(h * k));
  }
  return { l: Math.max(1, l), h: Math.max(1, h) };
}

/** Le fond uni d'une image non détourée : la couleur moyenne de ses quatre coins, si les coins sont opaques et proches. */
export function couleurDesCoins(data: ArrayLike<number>, largeur: number, hauteur: number): [number, number, number] | null {
  const coins = [0, largeur - 1, (hauteur - 1) * largeur, hauteur * largeur - 1].map((i) => [data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!, data[i * 4 + 3]!]);
  if (coins.some((c) => c[3]! < 250)) return null;
  const moy = [0, 1, 2].map((k) => coins.reduce((s, c) => s + c[k]!, 0) / 4) as [number, number, number];
  const ecart = Math.max(...coins.map((c) => Math.abs(c[0]! - moy[0]) + Math.abs(c[1]! - moy[1]) + Math.abs(c[2]! - moy[2])));
  return ecart < 40 ? moy : null;
}

/** Retire un fond uni (sur place) : alpha 0 près de la couleur, rampe douce sur la tolérance, frange décontaminée. */
export function retirerFond(data: Uint8ClampedArray | number[], fond: [number, number, number], tolerance = 48) {
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i]! - fond[0];
    const dg = data[i + 1]! - fond[1];
    const db = data[i + 2]! - fond[2];
    const d = Math.sqrt(dr * dr + dg * dg + db * db);
    if (d >= tolerance * 2) continue;
    const a = d <= tolerance ? 0 : (d - tolerance) / tolerance;
    const k = a > 0 ? 1 / a : 0;
    // La couleur sans la part du fond (« décontamination » de la frange).
    if (a > 0) for (let c = 0; c < 3; c++) data[i + c] = Math.round(borne(fond[c]! + (data[i + c]! - fond[c]!) * k, 0, 255));
    data[i + 3] = Math.round(data[i + 3]! * a);
  }
}

/** Nettoie l'alpha (sur place) : sous le seuil, pixel vide (Paper prend tout alpha non nul pour la forme). */
export function nettoyerAlpha(data: Uint8ClampedArray | number[], seuil = 6) {
  for (let i = 3; i < data.length; i += 4) if (data[i]! <= seuil) data[i] = 0;
}

/* ───────────────────────── Armement ───────────────────────── */

export interface ControleLogo {
  el: HTMLElement;
  /** Relit les attributs (configuration, source si elle a changé). */
  regler(): Promise<void>;
  /** Remplace la configuration (sans passer par les attributs). */
  configurer(c: ConfigLogo): Promise<void>;
  config(): ConfigLogo;
  /** L'instant affiché (ms de l'horloge du shader). */
  temps(): number;
  allerA(t: number): void;
  lecture(on?: boolean): boolean;
  /** Une image rendue hors écran : `k` × la taille affichée, à l'instant t, avec le fond. */
  rendreImage(t: number, k?: number, opts?: { fond?: boolean; largeur?: number; hauteur?: number }): Promise<HTMLCanvasElement>;
  /** Une séquence rendue image par image (rappel par image, dans l'ordre). */
  rendreSequence(seq: Sequence, k: number, surImage: (c: HTMLCanvasElement, i: number) => Promise<void> | void, opts?: { fond?: boolean }): Promise<void>;
  /** L'état du rendu : "attente", "pret", "repli" (WebGL absent), "erreur". */
  etat(): "attente" | "pret" | "repli" | "erreur";
  /** Le logo préparé (recadré, transparent), tel que la matière le reçoit. */
  source(): HTMLCanvasElement | null;
  detruire(): void;
}

const controles = new WeakMap<HTMLElement, ControleLogo>();
export const controleLogo = (el: Element) => controles.get(el as HTMLElement) ?? null;
export const _enregistrer = (el: HTMLElement, c: ControleLogo | null) => (c ? controles.set(el, c) : controles.delete(el));

/** Arme les `[data-logo]` de `root` (le rendu se charge à la demande, une fois). */
export async function initLogo(root: ParentNode = document): Promise<ControleLogo[]> {
  const els = [...root.querySelectorAll<HTMLElement>("[data-logo]")];
  if ((root as Element).matches?.("[data-logo]")) els.unshift(root as HTMLElement);
  const neufs = els.filter((el) => !controles.has(el));
  if (!neufs.length) return els.map((el) => controles.get(el)!).filter(Boolean);
  const { monterLogo } = await import("./logo-rendu.ts");
  for (const el of neufs) if (!controles.has(el)) controles.set(el, monterLogo(el));
  return els.map((el) => controles.get(el)!).filter(Boolean);
}
