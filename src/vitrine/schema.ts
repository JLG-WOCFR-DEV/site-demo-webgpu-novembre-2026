/**
 * Vitrine — le schéma de réglages déclaratif.
 *
 * Le moteur vit désormais dans src/registre/schema/index.ts (commun aux éditeurs : Vitrine, inspecteur des effets,
 * Studio) ; ce module le réexporte tel quel, sans changement de comportement (vitrine.test.ts).
 *
 * Vitrine n'emploie que les sept genres d'origine — curseur, selecteur, interrupteur, couleur, texte, image, liste — :
 * son type `Champ` reste restreint à eux (l'inspecteur de Vitrine ne sait pas dessiner une courbe ou une plage). Le
 * registre ajoute courbe, temps, angle et plage pour les effets.
 */
import type { ChampCouleur, ChampCurseur, ChampImage, ChampInterrupteur, ChampSelecteur, ChampTexte, Champ as ChampRegistre } from "../registre/schema/index.ts";

export * from "../registre/schema/index.ts";

/** Un champ de Vitrine : les sept genres d'origine (les sous-schémas de liste restent ceux du registre). */
export type Champ = ChampCurseur | ChampSelecteur | ChampInterrupteur | ChampCouleur | ChampTexte | ChampImage | ChampListe;
export interface ChampListe extends Omit<Extract<ChampRegistre, { type: "liste" }>, "element"> {
  element: readonly Champ[];
}
