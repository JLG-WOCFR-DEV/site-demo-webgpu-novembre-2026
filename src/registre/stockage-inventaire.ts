/**
 * L'inventaire du stockage du navigateur (docs, essais — pas chargé par les pages) : ce que garde chaque clé de
 * `CLES` (src/registre/stockage.ts), et les clés que l'on ne renomme pas, avec la raison. stockage.test.ts vérifie
 * que chaque clé littérale du dépôt est ici ou dans `CLES`.
 */
import type { CLES, Portee } from "./stockage.ts";

export const ROLES: Record<keyof typeof CLES, string> = {
  navRecents: "Palette de commandes : les dernières entrées choisies (identifiants, 8 au plus).",
  navTheme: "Thème de l'interface Presse (menu, palette, Studio) : « clair » ou « sombre » ; absent : celui du système.",
  coqueStudioEffet: "Mise en page de la page d'effet du Studio (JSON versionné, src/studio/coque-plan.ts).",
  couloirAttributs: "Couloir (couloir.html) : les réglages data-couloir-* de la page.",
  logosInstantanes: "Logos (logos.html) : 12 instantanés au plus (réglages + vignette).",
  diapoNotes: "Créateur de diaporama : panneau des notes ouvert (« 1 ») ou fermé (« 0 »).",
  diapoBande: "Créateur de diaporama : vignettes en bande sous l'aperçu (« 1 »).",
  diapoLargeur: "Créateur de diaporama : largeur de la liste des diapos (« 240px »).",
  diapoExport: "Créateur de diaporama : réglages du menu Exporter (JSON).",
  orbiteCourant: "Orbite : le réglage courant (écarts aux défauts, JSON).",
  orbiteReglages: "Orbite : réglages du panneau (JSON).",
};

/** Les clés que l'on ne renomme pas (lues par du code qui ne passe pas par ce module), avec la raison. */
export const GARDEES: readonly { motif: string; portee: Portee; par: string; raison: string }[] = [
  { motif: "presse-animations", portee: "local", par: "presse/build/head.ts, src/presse/presentation.ts", raison: "lue par le script en tête de page, avant tout module" },
  { motif: "presse-presentation", portee: "session", par: "presse/build/head.ts, src/presse/presentation.ts", raison: "lue par le script en tête de page" },
  { motif: "presse-presentation-arrivee", portee: "session", par: "src/presse/presentation.ts", raison: "passage d'une page à la suivante, le temps d'un clic" },
  { motif: "presse:flight", portee: "session", par: "presse/build/flight.ts, src/presse/flight.ts, src/presse/sweep.ts", raison: "lue par le script en tête de page" },
  { motif: "presse:sweep", portee: "session", par: "presse/build/flight.ts, src/presse/sweep.ts", raison: "lue par le script en tête de page" },
  { motif: "presse:intro:<chemin>", portee: "session", par: "presse/build/flight.ts", raison: "lue par le script en tête de page" },
  { motif: "presse-createur:v1", portee: "local", par: "src/createur/main.ts, src/createur/apercu.ts, src/variations/main.ts", raison: "le document du Créateur, partagé par trois modules (déjà versionné)" },
  { motif: "presse-createur:ui", portee: "local", par: "src/createur/main.ts", raison: "à migrer avec le document du Créateur (coque commune)" },
  { motif: "presse-variations:courant", portee: "local", par: "src/variations/main.ts", raison: "à migrer avec la coque commune" },
  { motif: "presse-variations:instantanes", portee: "local", par: "src/variations/main.ts", raison: "à migrer avec la coque commune" },
  { motif: "presse-variations:ui", portee: "local", par: "src/variations/main.ts", raison: "à migrer avec la coque commune" },
  { motif: "presse-knobs:<chemin>:<groupe>", portee: "local", par: "src/presse/knobs.ts", raison: "famille par page (préréglages des réglages ⌘⇧K)" },
  { motif: "presse-diapo-doc:<chemin>", portee: "local", par: "src/presse/diapo-doc.ts, src/diapo-createur/main.ts", raison: "famille par page (document du diaporama)" },
  { motif: "presse-diapo-edits:<chemin>", portee: "local", par: "src/presse/diapo-editeur.ts", raison: "famille par page (retouches en place)" },
  { motif: "presse-diapo-createur:replie:<chemin>", portee: "local", par: "src/diapo-createur/main.ts", raison: "famille par page (sections repliées)" },
  { motif: "presse:panier", portee: "local", par: "src/presse/panier.ts", raison: "clé par défaut d'un module documenté (option `cle`), synchronisée entre onglets" },
  { motif: "eclaircie:panier", portee: "local", par: "src/boutique/main.ts", raison: "panier de la boutique d'essai (événement storage entre onglets)" },
  { motif: "eclaircie:intro", portee: "session", par: "src/boutique/main.ts", raison: "introduction vue, le temps de la session" },
  { motif: "vitrine:editeur", portee: "local", par: "src/vitrine/main.ts", raison: "document de Vitrine (à migrer avec la coque commune)" },
  { motif: "vitrine:panier", portee: "local", par: "src/vitrine/armer.ts, src/vitrine/autonome.js", raison: "lue par l'export autonome, qui tourne sur un autre site" },
  { motif: "vitrine:recents", portee: "local", par: "src/vitrine/armer.ts, src/vitrine/autonome.js", raison: "lue par l'export autonome" },
  { motif: "vitrine:pays", portee: "local", par: "src/vitrine/armer.ts, src/vitrine/autonome.js", raison: "lue par l'export autonome" },
  { motif: "vitrine-popup-<cle>", portee: "session", par: "src/vitrine/autonome.js", raison: "export autonome" },
  { motif: "grille-canevas:<chemin>:<param>", portee: "local", par: "src/components/grille/grille.ts", raison: "famille par page et par paramètre" },
  { motif: "pli-debug", portee: "session", par: "src/debug-panel.ts", raison: "PLI (fil de fer, grille), le temps de la session" },
  { motif: "ubs-motion", portee: "session", par: "src/motion-scale.ts", raison: "PLI, le temps de la session" },
];
