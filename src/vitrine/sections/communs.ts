/**
 * Vitrine — ce que partagent les sections : champs communs (fond, espacement), enveloppe `<section>`, liens.
 */
import type { Champ, Option, Reglages } from "../schema.ts";
import type { Contexte, Section } from "../types.ts";
import { attrs, cls, e } from "../html.ts";
import { COLLECTIONS, IDS_PHOTOS } from "../donnees.ts";

export const OPTIONS_COLLECTIONS: Option[] = COLLECTIONS.map((c) => ({ valeur: c.id, libelle: c.nom }));

export const FOND: Champ = {
  cle: "fond", type: "selecteur", libelle: "Fond", icone: "goutte", defaut: "papier", affichage: "segments", groupe: "Section",
  options: [
    { valeur: "papier", libelle: "Fond de page", icone: "bouton-contour" },
    { valeur: "surface", libelle: "Surface", icone: "calque" },
    { valeur: "sombre", libelle: "Sombre", icone: "bouton-plein" },
    { valeur: "accent", libelle: "Accent", icone: "etoile" },
  ],
};
export const ESPACE: Champ = {
  cle: "espace", type: "selecteur", libelle: "Marges verticales", icone: "densite", defaut: "normal", affichage: "segments", groupe: "Section",
  options: [
    { valeur: "aucun", libelle: "Aucune", icone: "densite-compacte" },
    { valeur: "serre", libelle: "Serrées", icone: "densite-compacte" },
    { valeur: "normal", libelle: "Normales", icone: "densite-normale" },
    { valeur: "ample", libelle: "Amples", icone: "densite-aeree" },
  ],
};
/** Les champs communs, ajoutés à la fin du schéma d'une section de contenu. */
export const avecCommuns = (champs: Champ[], fond = "papier", espace = "normal"): Champ[] => [...champs, { ...FOND, defaut: fond } as Champ, { ...ESPACE, defaut: espace } as Champ];

export const champCollection = (cle = "collection", libelle = "Collection", defaut = "tout", groupe?: string): Champ => ({ cle, type: "selecteur", libelle, icone: "collection", options: OPTIONS_COLLECTIONS, defaut, affichage: "liste", source: "collections", groupe });

export const texte = (cle: string, libelle: string, defaut: string, o: Partial<Extract<Champ, { type: "texte" }>> = {}): Champ => ({ cle, type: "texte", libelle, icone: o.icone ?? "texte", defaut, max: o.max ?? 160, ...o });
export const image = (cle: string, libelle: string, defaut: string, o: Partial<Champ> = {}): Champ => ({ cle, type: "image", libelle, icone: "image", defaut, ...o }) as Champ;
export const inter = (cle: string, libelle: string, defaut: boolean, icone = "coche", o: Partial<Champ> = {}): Champ => ({ cle, type: "interrupteur", libelle, icone, defaut, ...o }) as Champ;

/** Le texte d'une option de collection, pour un lien « Voir … ». */
export const nomCollection = (id: string) => COLLECTIONS.find((c) => c.id === id)?.nom ?? "la collection";

/** La clé d'une image valide, sinon la campagne. */
export const photoOu = (cle: unknown, repli = "campagne") => (typeof cle === "string" && IDS_PHOTOS.has(cle) ? cle : repli);

export const r = <T = string>(s: Section, cle: string) => s.reglages[cle] as T;

/** L'identifiant du titre d'une section (pour `aria-labelledby`). */
export const idTitre = (s: Section) => `v-t-${s.id}`;

/**
 * L'enveloppe d'une section de contenu : `<section>` nommée par son titre (ou par `etiquette` si elle n'en a pas),
 * classes de type et de variante, fond et marges, `data-v-section` (l'éditeur s'en sert pour viser la section).
 */
export function enveloppe(s: Section, contenu: string, o: { etiquette?: string; titre?: boolean; classe?: string; balise?: string; style?: string; extra?: Record<string, string | boolean | undefined> } = {}): string {
  const g = s.reglages as Reglages;
  const balise = o.balise ?? "section";
  const a = attrs({
    class: cls("v-s", `v-${s.type}`, `v-${s.type}--${s.variante}`, g.fond ? `v-fond--${g.fond}` : "", g.espace ? `v-esp--${g.espace}` : "", o.classe),
    id: `s-${s.id}`,
    "data-v-section": s.id,
    "data-v-type": s.type,
    "aria-labelledby": o.titre ? idTitre(s) : undefined,
    "aria-label": !o.titre ? o.etiquette : undefined,
    style: o.style,
    ...o.extra,
  });
  return `<${balise}${a}>${contenu}</${balise}>`;
}

/** L'en-tête de section : titre, sous-titre, et un lien « Voir tout » à droite. */
export function teteSection(s: Section, titre: string, sousTitre = "", lien?: { texte: string; href: string }, alignement = "gauche"): string {
  if (!titre && !sousTitre && !lien) return "";
  return `<div class="v-tete v-tete--${alignement}"><div class="v-tete-textes">${titre ? `<h2 class="v-titre" id="${idTitre(s)}">${e(titre)}</h2>` : ""}${sousTitre ? `<p class="v-sous-titre">${e(sousTitre)}</p>` : ""}</div>${lien ? `<a class="v-lien-tout" href="${e(lien.href)}">${e(lien.texte)}<span aria-hidden="true"> →</span></a>` : ""}</div>`;
}

export const lienDe = (ctx: Contexte, id: unknown) => ctx.lienCollection(typeof id === "string" ? id : "tout");
