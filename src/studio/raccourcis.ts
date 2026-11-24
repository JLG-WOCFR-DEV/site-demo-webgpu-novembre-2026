/**
 * Studio — le registre des raccourcis clavier : une seule table par page, déclarée, listable (fenêtre d'aide « ? »),
 * sans conflit. Pur pour l'essentiel (raccourcis.test.ts, sous Node) ; `ecouter` branche le registre sur un document.
 *
 *   const r = creerRaccourcis({ mac: false });
 *   r.ajouter({ id: "rejouer", touches: "R", libelle: "Rejouer l'aperçu", groupe: "Aperçu", action: rejouer });
 *   r.ajouter({ id: "lien", touches: "Maj+L", libelle: "Copier le lien", groupe: "Copier", action: copierLien });
 *   const fin = r.ecouter(document);
 *
 * Écriture d'une combinaison : des modificateurs puis une touche, séparés par « + » : `Mod` (⌘ sur Mac, Ctrl
 * ailleurs), `Ctrl`, `Alt`, `Maj`, puis une lettre, un chiffre, un signe (`?`, `[`), ou un nom (`Echap`, `Entree`,
 * `Espace`, `Haut`, `Bas`, `Gauche`, `Droite`, `Suppr`, `Retour`). Comparaison sur `KeyboardEvent.key`, sans casse ;
 * pour un signe produit par Maj (`?`), Maj est ignorée.
 *
 * Règles :
 *   - deux raccourcis ne partagent pas une combinaison dans la même portée (erreur à l'ajout, pas en silence) ;
 *   - RESERVES : les combinaisons tenues ailleurs dans le dépôt (Mod+K de la palette, ⌘⇧K des réglages,
 *     touches du diaporama) sont refusées hors de leur propriétaire ;
 *   - dans un champ de saisie (input, textarea, select, contenteditable), seuls les raccourcis `dansChamp` jouent ;
 *     sur un bouton ou un lien, Entrée et Espace restent au navigateur ;
 *   - un raccourci joué empêche l'action par défaut du navigateur.
 */

export type Raccourci = {
  id: string;
  touches: string;
  libelle: string;
  groupe?: string;
  action: (e: EvenementClavier) => void;
  /** Joue aussi dans un champ de saisie (Échap, Mod+Entrée). */
  dansChamp?: boolean;
  /** Portée : deux portées différentes peuvent tenir la même combinaison (une fenêtre ouverte, la page). */
  portee?: string;
  /** Vrai : actif ; une fonction : actif si elle rend vrai (ex. seulement quand la fenêtre d'aide est ouverte). */
  actif?: boolean | (() => boolean);
};

/** Ce qu'il faut d'un KeyboardEvent (tests : un objet simple). */
export type EvenementClavier = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: unknown;
  defaultPrevented?: boolean;
  isComposing?: boolean;
  preventDefault?: () => void;
};

/** Le propriétaire de Mod+K : src/nav/declencheur.ts crée son registre avec `{ proprietaire: PROPRIETAIRE_PALETTE }`. */
export const PROPRIETAIRE_PALETTE = "palette de commandes (src/nav/declencheur.ts)";
/** Le propriétaire de Mod+Maj+K (knobs.ts écoute lui-même, hors registre : la réservation empêche qu'on la reprenne). */
export const PROPRIETAIRE_REGLAGES = "réglages Presse (knobs.ts)";

/**
 * Les combinaisons tenues par d'autres parties du dépôt (roadmap §8, point 8). Mod+K et Mod+Maj+K ne se gênent pas :
 * la forme canonique distingue Maj (« ctrl+k » ≠ « ctrl+maj+k »). Sur Mac, Mod = ⌘ : Ctrl+K y reste au système
 * (effacer jusqu'à la fin de la ligne dans un champ).
 */
export const RESERVES: readonly { touches: string; par: string }[] = [
  { touches: "Mod+K", par: PROPRIETAIRE_PALETTE },
  { touches: "Mod+Maj+K", par: PROPRIETAIRE_REGLAGES },
];

const NOMS: Record<string, string> = {
  echap: "escape",
  "échap": "escape",
  entree: "enter",
  "entrée": "enter",
  espace: " ",
  haut: "arrowup",
  bas: "arrowdown",
  gauche: "arrowleft",
  droite: "arrowright",
  suppr: "delete",
  retour: "backspace",
  tab: "tab",
};
const AFFICHES: Record<string, string> = { escape: "Échap", enter: "Entrée", " ": "Espace", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", delete: "Suppr", backspace: "Retour", tab: "Tab" };
/** Les touches qui sont un signe obtenu avec Maj sur la plupart des claviers : Maj n'y compte pas. */
const SIGNES = new Set(["?", "!", ":", "/", "+", "*", "%", "\"", "_", "<", ">", "|", "{", "}", "~", "#", "@", "&"]);

export type Combinaison = { mod: boolean; ctrl: boolean; alt: boolean; maj: boolean; touche: string };

/** Lit « Mod+Maj+L » ; erreur si illisible. */
export function lireTouches(t: string): Combinaison {
  const parts = t.split("+").map((x) => x.trim());
  // « Maj++ » : la touche +.
  if (t.endsWith("++")) parts.splice(parts.length - 2, 2, "+");
  const c: Combinaison = { mod: false, ctrl: false, alt: false, maj: false, touche: "" };
  parts.forEach((x, i) => {
    const b = x.toLowerCase();
    if (i < parts.length - 1) {
      if (b === "mod") c.mod = true;
      else if (b === "ctrl") c.ctrl = true;
      else if (b === "alt" || b === "option") c.alt = true;
      else if (b === "maj" || b === "shift") c.maj = true;
      else throw new Error(`raccourci « ${t} » : modificateur inconnu « ${x} »`);
    } else {
      if (!x) throw new Error(`raccourci « ${t} » : touche manquante`);
      c.touche = NOMS[b] ?? b;
    }
  });
  if (SIGNES.has(c.touche)) c.maj = false;
  return c;
}

/** Forme canonique (pour comparer deux écritures) : « mod+alt+maj+l ». Sur Mac, Ctrl et Mod restent distincts. */
export function canon(c: Combinaison, mac: boolean): string {
  // Hors Mac, Mod est Ctrl.
  const ctrl = c.ctrl || (!mac && c.mod);
  const meta = mac && c.mod;
  return [meta && "meta", ctrl && "ctrl", c.alt && "alt", c.maj && "maj", c.touche].filter(Boolean).join("+");
}

/** La combinaison d'un événement, sous la même forme canonique. */
export function combinaisonDe(e: EvenementClavier): string {
  let touche = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  if (touche === "spacebar") touche = " ";
  if (touche === "esc") touche = "escape";
  const maj = !!e.shiftKey && !SIGNES.has(touche);
  return [e.metaKey && "meta", e.ctrlKey && "ctrl", e.altKey && "alt", maj && "maj", touche].filter(Boolean).join("+");
}

/** Pour l'affichage (fenêtre d'aide, infobulles) : « ⌘ ⇧ L » sur Mac, « Ctrl Maj L » ailleurs. */
export function afficher(t: string, mac: boolean): string[] {
  const c = lireTouches(t);
  const out: string[] = [];
  if (c.mod) out.push(mac ? "⌘" : "Ctrl");
  if (c.ctrl) out.push(mac ? "⌃" : "Ctrl");
  if (c.alt) out.push(mac ? "⌥" : "Alt");
  if (c.maj) out.push(mac ? "⇧" : "Maj");
  out.push(AFFICHES[c.touche] ?? (c.touche.length === 1 ? c.touche.toUpperCase() : c.touche));
  return out;
}

/** Vrai si la cible est un champ de saisie (où une lettre s'écrit). */
export function estChamp(cible: unknown): boolean {
  const el = cible as { tagName?: string; isContentEditable?: boolean; type?: string } | null;
  if (!el || typeof el !== "object") return false;
  if (el.isContentEditable) return true;
  const t = (el.tagName ?? "").toUpperCase();
  if (t === "TEXTAREA" || t === "SELECT") return true;
  if (t === "INPUT") return !["checkbox", "radio", "button", "submit", "reset", "range", "color"].includes((el.type ?? "text").toLowerCase());
  return false;
}
/** Vrai si Entrée / Espace / flèches y ont un sens natif (bouton, lien, curseur, radio). */
function estActivable(cible: unknown): boolean {
  const el = cible as { tagName?: string; type?: string } | null;
  const t = (el?.tagName ?? "").toUpperCase();
  return t === "BUTTON" || t === "A" || t === "SUMMARY" || (t === "INPUT" && ["checkbox", "radio", "range", "color", "button", "submit"].includes((el?.type ?? "").toLowerCase()));
}
const TOUCHES_NATIVES = new Set(["enter", " ", "arrowup", "arrowdown", "arrowleft", "arrowright", "home", "end", "pageup", "pagedown"]);

export type Registre = {
  ajouter(r: Raccourci): void;
  retirer(id: string): void;
  /** Les raccourcis, dans l'ordre d'ajout (groupés par l'appelant). */
  lister(): readonly Raccourci[];
  /** Le raccourci qui répond à l'événement, sans le jouer. */
  trouver(e: EvenementClavier): Raccourci | null;
  /** Joue le raccourci de l'événement ; vrai s'il y en avait un. */
  traiter(e: EvenementClavier): boolean;
  /** Les touches d'un raccourci, pour l'affichage. */
  touchesDe(id: string): string[];
  ecouter(cible: { addEventListener(t: "keydown", f: (e: KeyboardEvent) => void): void; removeEventListener(t: "keydown", f: (e: KeyboardEvent) => void): void }): () => void;
  readonly mac: boolean;
};

export function creerRaccourcis(opts: { mac?: boolean; proprietaire?: string } = {}): Registre {
  const mac = opts.mac ?? (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  const liste: (Raccourci & { cle: string })[] = [];
  const reserves = RESERVES.map((r) => ({ ...r, cle: canon(lireTouches(r.touches), mac) }));
  const actif = (r: Raccourci) => (typeof r.actif === "function" ? r.actif() : r.actif !== false);

  const reg: Registre = {
    mac,
    ajouter(r) {
      if (liste.some((x) => x.id === r.id)) throw new Error(`raccourci « ${r.id} » : identifiant déjà pris`);
      const cle = canon(lireTouches(r.touches), mac);
      const res = reserves.find((x) => x.cle === cle);
      if (res && res.par !== opts.proprietaire) throw new Error(`raccourci « ${r.id} » (${r.touches}) : combinaison réservée à ${res.par}`);
      const autre = liste.find((x) => x.cle === cle && (x.portee ?? "") === (r.portee ?? ""));
      if (autre) throw new Error(`raccourci « ${r.id} » (${r.touches}) : déjà tenu par « ${autre.id} »`);
      liste.push({ ...r, cle });
    },
    retirer(id) {
      const i = liste.findIndex((x) => x.id === id);
      if (i >= 0) liste.splice(i, 1);
    },
    lister: () => liste,
    trouver(e) {
      if (e.isComposing) return null;
      const cle = combinaisonDe(e);
      const champ = estChamp(e.target);
      const touche = e.key.toLowerCase();
      // Une portée nommée (une fenêtre ouverte) passe avant la page.
      const candidats = liste.filter((r) => r.cle === cle && actif(r)).sort((a, b) => Number(!!b.portee) - Number(!!a.portee));
      for (const r of candidats) {
        if (champ && !r.dansChamp) continue;
        if (!champ && TOUCHES_NATIVES.has(touche) && estActivable(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) continue;
        return r;
      }
      return null;
    },
    traiter(e) {
      if (e.defaultPrevented) return false;
      const r = reg.trouver(e);
      if (!r) return false;
      e.preventDefault?.();
      r.action(e);
      return true;
    },
    touchesDe(id) {
      const r = liste.find((x) => x.id === id);
      return r ? afficher(r.touches, mac) : [];
    },
    ecouter(cible) {
      const f = (e: KeyboardEvent) => void reg.traiter(e);
      cible.addEventListener("keydown", f);
      return () => cible.removeEventListener("keydown", f);
    },
  };
  return reg;
}
