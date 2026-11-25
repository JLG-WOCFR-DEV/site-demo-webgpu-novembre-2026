/**
 * Vitrine — le schéma de réglages déclaratif.
 *
 * Le moteur vit désormais dans src/registre/schema/index.ts (commun aux éditeurs : Vitrine, inspecteur des effets,
 * Studio) ; ce module le réexporte tel quel, sans changement de comportement (vitrine.test.ts).
 *
 * Vitrine n'emploie que les sept genres d'origine — curseur, selecteur, interrupteur, couleur, texte, image, liste — :
 * son type `Champ` reste restreint à eux (ses sections n'en ont pas d'autres). Le registre ajoute courbe, temps, angle
 * et plage pour les effets ; le rendu de schéma commun (src/studio/inspecteur-plan.ts, E8) les dessine tous.
 */
import type { ChampCouleur, ChampCurseur, ChampImage, ChampInterrupteur, ChampSelecteur, ChampTexte, Champ as ChampRegistre } from "../registre/schema/index.ts";

export * from "../registre/schema/index.ts";

/** Un champ de Vitrine : les sept genres d'origine (les sous-schémas de liste restent ceux du registre). */
export type Champ = ChampCurseur | ChampSelecteur | ChampInterrupteur | ChampCouleur | ChampTexte | ChampImage | ChampListe;
export interface ChampListe extends Omit<Extract<ChampRegistre, { type: "liste" }>, "element"> {
  element: readonly Champ[];
}
