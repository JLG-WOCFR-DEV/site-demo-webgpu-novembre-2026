/**
 * Navigation — le déclencheur de la palette de commandes : Ctrl+K (⌘K sur Mac), tenu par le registre des raccourcis
 * (src/studio/raccourcis.ts, propriétaire de la réservation « Mod+K ») ; la palette elle-même (src/nav/palette.ts)
 * n'est chargée qu'à la première ouverture. Léger : c'est tout ce que pages-nav ajoute à chaque page.
 *
 * Règles (docs/ROADMAP-STUDIO.md §8, point 8) : Mod+K ouvre la palette partout, y compris depuis un champ de saisie
 * (raccourci explicite, il n'écrit rien) ; ⌘⇧K / Ctrl+Maj+K restent aux réglages Presse (knobs.ts) ; aucune lettre
 * seule n'ouvre la palette. Mod+K une seconde fois la referme. Ctrl+K est aussi le raccourci « rechercher » de
 * Chrome et Firefox : la page le prend (preventDefault) — le navigateur garde Ctrl+E / Ctrl+L.
 */
import { afficher, creerRaccourcis, PROPRIETAIRE_PALETTE } from "../studio/raccourcis.ts";

export type ContextePalette = {
  /** Chemin de la racine du site depuis la page (« ./ », « ../ »). */
  base: string;
  /** Ouvre le menu des pages (commande « Menu des pages »), s'il y en a un. */
  ouvrirMenu?: () => void;
};

type Module = typeof import("./palette.ts");
let module: Promise<Module> | null = null;
const charger = () => (module ??= import("./palette.ts"));

let contexte: ContextePalette = { base: "./" };
let ecoute = false;

/** Ouvre (ou referme) la palette ; `retour` : l'élément qui reprend le focus à la fermeture. */
export function ouvrirPalette(retour?: HTMLElement | null) {
  const r = retour ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  void charger().then((m) => m.basculerPalette(contexte, r));
}

/** Précharge le morceau (survol du bouton de recherche). */
export const prechargerPalette = () => void charger();

/** Le raccourci, pour l'affichage (« Ctrl K », « ⌘ K »). */
export const touchesPalette = (mac = estMac()): string => afficher("Mod+K", mac).join(" ");

function estMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** Branche Mod+K sur le document (une fois par page). */
export function ecouterPalette(c: ContextePalette) {
  contexte = c;
  if (ecoute) return;
  ecoute = true;
  const r = creerRaccourcis({ proprietaire: PROPRIETAIRE_PALETTE });
  r.ajouter({ id: "palette", touches: "Mod+K", libelle: "Palette de commandes", groupe: "Général", dansChamp: true, action: () => ouvrirPalette() });
  r.ecouter(document);
}
