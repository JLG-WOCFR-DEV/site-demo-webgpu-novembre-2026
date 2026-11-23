/**
 * Export des diaporamas — les transitions de Presse traduites en transitions natives de PowerPoint.
 *
 * Presse a trois familles de transitions (src/presse/diapo.ts) :
 *   - `impression` : le moteur réimprime la diapo qui arrive (TRANSITIONS de src/state.ts : impression, trame…) ;
 *   - `deux-images` : un shader garde l'image de la diapo qui part et la défait par-dessus la suivante
 *     (SLIDE_TRANSITIONS de src/gpu/slide-transition.ts : enchaine, feuille, bavure…) ;
 *   - `deplacement` : Magic Move (les `[data-move]` volent d'une diapo à l'autre).
 * PowerPoint n'en a aucune à l'identique : chaque nom reçoit la plus proche de ses transitions natives, avec une
 * qualité dite franchement :
 *   - `fidele`  le même geste (fondu enchaîné → Fondu) ;
 *   - `proche`  la même idée, un autre dessin (onde → Ondulation, portes → Portes) ;
 *   - `repli`   rien d'approchant : Fondu, et un avertissement dans le rapport d'export.
 * Un nom inconnu (faute de frappe, transition future) tombe aussi en `repli`.
 *
 * Les transitions d'Office 2010 (espace `p14`) sont écrites dans un `mc:AlternateContent`, avec un Fondu de repli pour
 * les lecteurs qui ne les connaissent pas (LibreOffice, anciens PowerPoint) — c'est ce qu'écrit PowerPoint lui-même.
 * Pur : ni DOM ni réseau, importable par Node.
 */
import { SLIDE_TRANSITIONS } from "../gpu/slide-transition.ts";
import { TRANSITIONS } from "../state.ts";

export type Famille = "impression" | "deux-images" | "deplacement";
export type Qualite = "fidele" | "proche" | "repli";

/** Une transition native : l'élément XML (sans préfixe d'espace), ses attributs, et s'il est d'Office 2010 (`p14`). */
export type Native = { element: string; attributs?: Readonly<Record<string, string>>; p14?: boolean };

export type Correspondance = {
  nom: string;
  famille: Famille;
  /** Le nom affiché dans PowerPoint (français, menu Transitions). */
  libelle: string;
  native: Native | null;
  qualite: Qualite;
};

const fondu: Native = { element: "fade" };
const C = (nom: string, famille: Famille, libelle: string, native: Native | null, qualite: Qualite): Correspondance => ({ nom, famille, libelle, native, qualite });

/** La table complète : chaque nom connu de Presse, une ligne. Testée contre TRANSITIONS et SLIDE_TRANSITIONS. */
export const TABLE_TRANSITIONS: readonly Correspondance[] = [
  // Impression par le moteur : la diapo qui arrive s'imprime ; l'ancienne disparaît d'un coup.
  C("impression", "impression", "Balayer (vers le bas)", { element: "wipe", attributs: { dir: "d" } }, "proche"),
  C("trame", "impression", "Dissoudre", { element: "dissolve" }, "proche"),
  C("quadri", "impression", "Fondu", fondu, "repli"),
  C("buvard", "impression", "Dissoudre", { element: "dissolve" }, "proche"),
  C("massicot", "impression", "Fractionner (horizontal)", { element: "split", attributs: { orient: "horz", dir: "out" } }, "proche"),
  C("fondu", "impression", "Fondu", fondu, "fidele"),
  C("rouleau", "impression", "Pousser (vers le haut)", { element: "push", attributs: { dir: "u" } }, "proche"),
  C("composition", "impression", "Barres aléatoires", { element: "randomBar", attributs: { dir: "vert" } }, "proche"),
  C("ligne", "impression", "Balayer (vers la droite)", { element: "wipe", attributs: { dir: "r" } }, "proche"),
  C("revelateur", "impression", "Fondu", fondu, "proche"),
  C("pli", "impression", "Fondu", fondu, "repli"),
  C("aucune", "impression", "Aucune (coupe)", { element: "cut" }, "fidele"),
  C("tri", "impression", "Damier", { element: "checker", attributs: { dir: "horz" } }, "proche"),
  // Deux images : l'ancienne diapo se défait par-dessus la nouvelle.
  C("enchaine", "deux-images", "Fondu", fondu, "fidele"),
  C("feuille", "deux-images", "Découvrir (vers le haut)", { element: "pull", attributs: { dir: "u" } }, "proche"),
  C("bavure", "deux-images", "Dissoudre", { element: "dissolve" }, "proche"),
  C("mosaique", "deux-images", "Damier", { element: "checker", attributs: { dir: "horz" } }, "proche"),
  C("fonte", "deux-images", "Barres aléatoires (verticales)", { element: "randomBar", attributs: { dir: "vert" } }, "proche"),
  C("onde", "deux-images", "Ondulation", { element: "ripple", p14: true }, "proche"),
  C("portes", "deux-images", "Portes", { element: "doors", attributs: { dir: "vert" }, p14: true }, "fidele"),
  C("points", "deux-images", "Dissoudre", { element: "dissolve" }, "proche"),
  C("vague", "deux-images", "Ondulation", { element: "ripple", p14: true }, "proche"),
  C("zoom", "deux-images", "Zoom", { element: "zoom", attributs: { dir: "in" } }, "proche"),
  C("tranches", "deux-images", "Stores (horizontaux)", { element: "blinds", attributs: { dir: "horz" } }, "proche"),
  C("parasite", "deux-images", "Fondu", fondu, "repli"),
  C("pile", "deux-images", "Couvrir (vers le haut)", { element: "cover", attributs: { dir: "u" } }, "proche"),
  C("foyer", "deux-images", "Fondu", fondu, "proche"),
  C("bascule", "deux-images", "Fondu", fondu, "repli"),
  C("prisme", "deux-images", "Prisme", { element: "prism", p14: true }, "proche"),
  C("sable", "deux-images", "Dissoudre", { element: "dissolve" }, "proche"),
  C("rayons", "deux-images", "Balayer (vers la droite)", { element: "wipe", attributs: { dir: "r" } }, "proche"),
  C("marbrure", "deux-images", "Fondu", fondu, "repli"),
  // Magic Move : en images, rien ne peut voler (Morphose demande des objets) : fondu.
  C("deplacement", "deplacement", "Fondu", fondu, "repli"),
];

const PAR_NOM = new Map(TABLE_TRANSITIONS.map((c) => [c.nom, c]));

/** Tous les noms que Presse connaît (pour les tests et l'inspecteur). */
export const NOMS_TRANSITIONS: readonly string[] = [...TRANSITIONS, ...SLIDE_TRANSITIONS, "deplacement"];

/** La correspondance d'un nom ; un nom inconnu : Fondu, en repli. */
export function correspondance(nom: string): Correspondance {
  return PAR_NOM.get(nom) ?? { nom, famille: "impression", libelle: "Fondu", native: fondu, qualite: "repli" };
}

/** La famille d'un nom, comme le diaporama la lit (src/presse/diapo.ts). */
export function familleDe(nom: string): Famille {
  if (nom === "deplacement") return "deplacement";
  return (SLIDE_TRANSITIONS as readonly string[]).includes(nom) ? "deux-images" : "impression";
}

/** L'avertissement d'une transition en repli (null sinon), en français. */
export function avertissementTransition(nom: string): string | null {
  const c = correspondance(nom);
  if (!PAR_NOM.has(nom)) return `transition « ${nom} » inconnue : Fondu`;
  if (c.qualite !== "repli") return null;
  if (nom === "deplacement") return "Magic Move (deplacement) : impossible en images, Fondu (pas de Morphose sans objets)";
  return `transition « ${nom} » sans équivalent PowerPoint : Fondu`;
}

/** La vitesse PowerPoint 2007 (`spd`) la plus proche d'une durée. */
export const vitesse = (s: number) => (s <= 0.5 ? "fast" : s <= 0.75 ? "med" : "slow");

const attrs = (a: Readonly<Record<string, string>> | undefined) =>
  Object.entries(a ?? {})
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");

/**
 * Le XML `<p:transition>` d'une diapo (à placer après `p:clrMapOvr`). `duree` en secondes. `null` : pas de transition.
 * Une transition d'Office 2010 est enveloppée dans `mc:AlternateContent` (Fondu en repli) ; les autres portent aussi
 * leur durée exacte (`p14:dur`) dans la même enveloppe, la vitesse `spd` restant lue partout.
 */
export function xmlTransition(native: Native | null, duree: number): string {
  if (!native) return "";
  const ms = Math.max(0, Math.round(duree * 1000));
  const spd = vitesse(duree);
  if (native.element === "cut") return `<p:transition spd="fast"><p:cut/></p:transition>`;
  const prefixe = native.p14 ? "p14" : "p";
  const choix = `<p:transition spd="${spd}" p14:dur="${ms}"><${prefixe}:${native.element}${attrs(native.attributs)}/></p:transition>`;
  const repli = native.p14 ? `<p:transition spd="${spd}"><p:fade/></p:transition>` : `<p:transition spd="${spd}"><p:${native.element}${attrs(native.attributs)}/></p:transition>`;
  return `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" Requires="p14">${choix}</mc:Choice><mc:Fallback>${repli}</mc:Fallback></mc:AlternateContent>`;
}
