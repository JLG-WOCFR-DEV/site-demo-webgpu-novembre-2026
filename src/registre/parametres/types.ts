/**
 * Registre — les paramètres réglables d'un effet (le Studio) et sa démonstration.
 *
 * Un manifeste de `src/registre/effets.ts` peut porter `parametres: () => import("./parametres/<id>.ts")` : une
 * FICHE, chargée à la demande (elle n'alourdit pas `pages-nav`, chargé sur chaque page). La fiche dit :
 *   - `parametres` : chaque réglage, typé par le schéma partagé (src/registre/schema/index.ts : genre, bornes, pas,
 *     défaut, libellé court, groupe, aide, condition `si`), plus l'attribut `data-*` qu'il écrit et où ;
 *   - `demo` : le HTML d'exemple, monté par l'aperçu du Studio (src/studio/apercu.ts), écrit AVEC les valeurs par
 *     défaut (un paramètre à son défaut n'écrit rien : l'attribut de la démo, ou son absence, fait foi) ;
 *   - `prereglages` (facultatif) : un paramètre qui donne une base aux autres (`data-couloir-presets`) ; les défauts
 *     affichés et comparés suivent alors la base choisie, comme dans le module.
 *
 * Règle d'écriture d'un paramètre (src/studio/etat.ts, `attributsDe`) :
 *   - masqué par sa condition `si` : rien ;
 *   - `auto` (le module décide, souvent selon d'autres réglages) et non réglé : rien ;
 *   - à son défaut (effectif) : rien ;
 *   - sinon l'attribut, sur la racine de la démo ou sur chaque `cible`.
 *
 *   - `minimale` (facultatif) : la raison d'une fiche courte ou sans démo ; `rendu` : ce que l'aperçu montre d'un
 *     effet GPU sans carte graphique (le repli du module) — l'aperçu ne simule rien que le module ne fasse.
 *
 * Des types seulement (aucun code : une fiche s'écrit `export default { … } satisfies FicheParametres`) ; importable
 * par Node (tests). Les fiches sont dans ce dossier.
 */
import type { ChampAngle, ChampCouleur, ChampCourbe, ChampCurseur, ChampInterrupteur, ChampSelecteur, ChampTemps, ChampTexte, Valeur } from "../schema/index.ts";

/** Le rôle d'un paramètre dans le bloc « Mouvement » de l'inspecteur. */
export type RoleMouvement = "duree" | "delai" | "cascade" | "entree" | "sortie";

export type Ecriture = {
  /** Interrupteur : texte écrit pour vrai / faux ; `null` = attribut absent, "" = attribut présent sans valeur. */
  oui?: string | null;
  non?: string | null;
  /** Ajouté au nombre (« vh », « px ») quand l'attribut attend une longueur CSS. */
  suffixe?: string;
};

type Extra = {
  /** L'attribut écrit. Il doit être dans `attributs` du manifeste (donc documenté dans PRESSE.md). */
  attribut: string;
  /** Sélecteur, relatif à la racine de la démo, des éléments qui reçoivent l'attribut (défaut : la racine). */
  cible?: string;
  /** Le module décide quand l'attribut est absent : ce texte le dit (« ressort », « selon le préréglage »). */
  auto?: string;
  mouvement?: RoleMouvement;
  ecriture?: Ecriture;
};

/** Les genres du schéma qui ont un sens dans un attribut (ni liste, ni image de la photothèque, ni plage). */
export type ChampParametre = ChampCurseur | ChampSelecteur | ChampInterrupteur | ChampCouleur | ChampTexte | ChampCourbe | ChampTemps | ChampAngle;
export type Parametre = ChampParametre & Extra;

export type Demo = {
  /** Le HTML d'exemple (un fragment), valeurs par défaut. Images : chemins relatifs à la racine du site. */
  html: string;
  /** Sélecteur de l'élément qui porte l'effet (défaut : le premier qui répond au sélecteur du manifeste). */
  racine?: string;
  /** Styles de la scène, posés dans l'aperçu seulement. */
  css?: string;
  /** Fond de la scène (couleur CSS). */
  fond?: string;
  /** Scène sombre (texte clair) : l'aperçu s'y accorde. */
  sombre?: boolean;
  /** Une phrase sous l'aperçu : quoi faire pour voir l'effet (« Cliquez le bouton rond »). */
  consigne?: string;
};

export type Prereglages = {
  /** La clé du paramètre qui choisit la base. */
  cle: string;
  /** Pour chaque valeur de ce paramètre, les défauts qu'elle impose aux autres (par clé). */
  valeurs: Readonly<Record<string, Readonly<Record<string, Valeur>>>>;
};

export type FicheParametres = {
  parametres: readonly Parametre[];
  /** La démonstration montée par l'aperçu. Absente (fiche minimale) : `minimale` dit pourquoi, l'aperçu le dit aussi. */
  demo?: Demo;
  prereglages?: Prereglages;
  /**
   * Fiche minimale (moins de quatre paramètres, ou pas de démo) : la raison, en une phrase (le module n'a pas d'autre
   * attribut réglable, l'effet se pose sur `<html>`…). Affichée par l'inspecteur du Studio.
   */
  minimale?: string;
  /**
   * Ce que l'aperçu du Studio montre d'un effet GPU (rendu WebGPU / WebGL2 du manifeste, ou moteur Presse) quand la
   * carte ou le moteur manquent : le repli DOM du module, dit en une phrase. Obligatoire pour un rendu GPU.
   */
  rendu?: string;
};
