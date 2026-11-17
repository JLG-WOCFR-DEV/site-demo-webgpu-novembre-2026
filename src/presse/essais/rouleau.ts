/** Page d'essai du composant rouleau (rouleau.html). */
import "@fontsource-variable/archivo/standard.css";
import { initRouleau, rouleau, capturerRouleau, figerRouleau, avancerRouleau, poserRouleau, lacherRouleau, etatRouleau, rouleauPret, compilerRouleau } from "../rouleau.ts";
import { mountPagesNav } from "../../pages-nav.ts";

mountPagesNav();
initRouleau();

// Banc d'essai (?presse-banc) : capture hors écran, temps figé.
Object.assign(window as object, {
  __rouleau: rouleau,
  __capturerRouleau: capturerRouleau,
  __figerRouleau: figerRouleau,
  __avancerRouleau: avancerRouleau,
  __poserRouleau: poserRouleau,
  __lacherRouleau: lacherRouleau,
  __etatRouleau: etatRouleau,
  __rouleauPret: rouleauPret,
  __compilerRouleau: compilerRouleau,
});
