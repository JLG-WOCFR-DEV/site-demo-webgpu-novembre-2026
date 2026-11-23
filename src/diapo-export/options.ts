/**
 * Export des diaporamas — les réglages d'un export, déclarés une fois avec le schéma partagé
 * (src/registre/schema/index.ts) : la ligne de commande (tools/export-diapo.mjs) et le menu Exporter du Créateur de
 * diaporama les lisent et les valident de la même façon (`lireOptions` : bornes, options inconnues corrigées et dites
 * en français). Pur, importable par Node.
 */
import { validerReglages, type Champ } from "../registre/schema/index.ts";

export type Contenu = "etapes" | "diapos";
export type FormatImage = "auto" | "png" | "jpeg";

export type OptionsExport = {
  /** `etapes` : une image par appui (chaque apparition) ; `diapos` : une image par diapo, toutes ses étapes visibles. */
  contenu: Contenu;
  /** Les notes de l'orateur : volet Notes (PPTX), sous la diapo (PDF). */
  notes: boolean;
  /** Les transitions natives (PPTX) et les fondus (HTML autonome). */
  transitions: boolean;
  /** Les diapos masquées (`data-masquee`) aussi. */
  masquees: boolean;
  /** Le format des images d'un PPTX ou d'un PDF : `auto` garde la plus légère de PNG et JPEG. */
  image: FormatImage;
  /** Largeur des images (px) ; la hauteur suit, en 16:9. */
  largeur: number;
};

export const CHAMPS_EXPORT: readonly Champ[] = [
  {
    cle: "contenu",
    type: "selecteur",
    libelle: "Contenu",
    icone: "etapes",
    defaut: "etapes",
    affichage: "segments",
    options: [
      { valeur: "etapes", libelle: "Une image par étape", icone: "etapes" },
      { valeur: "diapos", libelle: "Une image par diapo", icone: "diapo" },
    ],
    aide: "Étapes : chaque apparition devient une diapo PowerPoint ou une page. Diapos : la diapo finie, une fois.",
  },
  { cle: "notes", type: "interrupteur", libelle: "Notes de l'orateur", icone: "notes", defaut: true, aide: "PPTX : volet Notes. PDF : sous chaque diapo (page A4)." },
  { cle: "transitions", type: "interrupteur", libelle: "Transitions", icone: "transition", defaut: true, aide: "Transitions natives de PowerPoint, les plus proches ; fondu sinon." },
  { cle: "masquees", type: "interrupteur", libelle: "Diapos masquées", icone: "masquee", defaut: false },
  {
    cle: "image",
    type: "selecteur",
    libelle: "Images",
    defaut: "auto",
    options: [
      { valeur: "auto", libelle: "La plus légère (PNG ou JPEG)" },
      { valeur: "png", libelle: "PNG (sans perte)" },
      { valeur: "jpeg", libelle: "JPEG (qualité 90)" },
    ],
  },
  { cle: "largeur", type: "curseur", libelle: "Largeur", unite: "px", min: 960, max: 3840, pas: 160, defaut: 1920 },
] as Champ[];

export const OPTIONS_DEFAUT: OptionsExport = { contenu: "etapes", notes: true, transitions: true, masquees: false, image: "auto", largeur: 1920 };

/** Des réglages bruts (JSON, drapeaux de la ligne de commande, formulaire) → des options sûres et ce qui a été corrigé. */
export function lireOptions(brut: unknown): { options: OptionsExport; corrections: string[] } {
  const r = validerReglages(CHAMPS_EXPORT, brut ?? {});
  return { options: { ...OPTIONS_DEFAUT, ...(r.reglages as Partial<OptionsExport>) }, corrections: r.corrections };
}

/** La hauteur 16:9 d'une largeur (paire, pour les encodeurs). */
export const hauteurDe = (largeur: number) => Math.round((largeur * 9) / 16 / 2) * 2;
