/** Page d'essai du composant metal (metal.html). */
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/bodoni-moda/opsz.css";
import { initMetal, capturerMetal, figerMetal, poserMetal, compilerMetal } from "../metal.ts";
import { mountPagesNav } from "../../pages-nav.ts";

mountPagesNav();
initMetal();
// Banc d'essai (?presse-banc) : capture hors écran, temps posé à la main.
Object.assign(window as object, { __capturerMetal: capturerMetal, __figerMetal: figerMetal, __poserMetal: poserMetal, __compilerMetal: compilerMetal });
