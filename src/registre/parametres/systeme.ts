/**
 * Fiche Studio (minimale, sans démo) du système de design (src/presse/systeme.ts). Le module lit `data-systeme` sur
 * `<html>` (ou `?systeme=` dans l'adresse) : un système entier encodé (base64url ou JSON), fabriqué dans
 * variations.html — pas une suite de réglages à curseur. `data-systeme-actif` est un état posé par le module (ne pas
 * l'écrire). Un fragment monté dans l'aperçu ne peut pas porter un attribut de `<html>` : pas de démo ici, la page
 * d'effet renvoie à variations.html.
 */
import type { FicheParametres } from "./types.ts";

export default {
  parametres: [],
  minimale: "Le système se pose sur <html> (data-systeme ou ?systeme=) et se fabrique entier dans variations.html : pas de réglage par attribut, pas d'aperçu en fragment.",
} satisfies FicheParametres;
