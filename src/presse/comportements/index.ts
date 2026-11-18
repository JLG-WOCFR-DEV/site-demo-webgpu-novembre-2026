/**
 * Comportements Presse — clavier, focus, réordonnancement, panoramique-zoom, popups : écrits une fois, sans style ni
 * framework, branchés sur le DOM existant. Chaque `creer…(el, options)` rend `{ detruire(), … }`.
 * API inspirée des comportements d'UI SDK (Vercel, Apache-2.0) ; code propre à Presse.
 */
export { creerFocusItinerant, prochainIndex, rangDeLArret, sensDeTouche, type FocusItinerant, type OptionsFocusItinerant, type Orientation } from "./focus-itinerant.ts";
export { creerPopup, placer, rangPiege, type OptionsPopup, type Popup, type RaisonFermeture } from "./popup.ts";
export { creerReordonner, decalage, deplace, deplacerElement, messageReordonner, rangApresTouche, rangCible, type MessageReordonner, type OptionsReordonner, type Reordonner } from "./reordonner.ts";
export { actionTouche, bornerVue, creerPanoramiqueZoom, facteurMolette, pincement, zoomAutour, VUE_NEUTRE, type OptionsPanoramiqueZoom, type PanoramiqueZoom, type Vue } from "./panoramique-zoom.ts";
