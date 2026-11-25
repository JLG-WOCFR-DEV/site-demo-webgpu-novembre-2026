/**
 * Presse — le lint statique du mouvement : lit le CSS (et un peu de JS) d'une page, sans navigateur, et signale ce que
 * les règles d'Emil Kowalski (docs/REFERENCES-MOUVEMENT.md §3–§4) déconseillent. Des AVERTISSEMENTS, jamais des
 * erreurs : ce sont des défauts d'auteur, pas des normes. `src/presse/motion-lint.ts` (`?presse-lint`) juge les valeurs
 * écrites image par image ; celui-ci lit ce qui est écrit dans les feuilles.
 *
 * Règles (identifiants stables, cités par `presse-lint-ignore`) :
 *   transition-all       `transition: all …`, ou une transition sans propriété (= all) ;
 *   ease-in              `ease-in` sur une transition (départ lent = impression de lenteur ; `ease-in-out` permis) ;
 *   scale-zero           une entrée depuis `scale(0)` (keyframe de départ, `@starting-style`, état d'une transition) ;
 *   duree-longue         transition ou animation de plus de 300 ms hors modale, tiroir, dialog, toast, drawer ;
 *   survol-sans-hover    `:hover` hors de `@media (hover: hover)` (le survol colle après un toucher) ;
 *   clavier-anime        un gestionnaire keydown / keyup qui lance une animation (heuristique : à vérifier) ;
 *   origine-centre       `transform-origin: center` sur un popover, un menu, une infobulle (origine = le déclencheur) ;
 *   propriete-animee     propriété animée autre que transform, opacity, filter, clip-path ou une couleur ;
 *   keyframes-rapide     `@keyframes` sur un élément à déclenchement rapide (toast, bascule) : une transition garde
 *                        sa vitesse quand on l'interrompt, une keyframe repart de zéro (à vérifier).
 *
 * Sources lues pour une page : ses `<style>`, ses attributs `style=""`, ses feuilles liées locales, et les CSS / TS que
 * ses propres scripts importent statiquement (ceux du dossier de son script d'entrée : `src/boutique/…` pour
 * boutique.html) ; les feuilles partagées (src/presse, src/components…) sont lues une fois par l'audit
 * (`npm run mouvement:audit`, tools/mouvement-audit.mjs), pas à chaque page.
 *
 * Désactiver une règle : un commentaire `presse-lint-ignore: <regle> — <raison>` (plusieurs règles séparées par des
 * espaces ou des virgules), juste avant la règle CSS (ou l'at-règle) visée ou dans son bloc ; en JS, `//` sur l'une
 * des trois lignes avant le gestionnaire ou dans son corps ; en HTML, `<!-- … -->` juste avant l'élément. Sans raison,
 * le commentaire ne vaut rien et se signale lui-même (`ignore-sans-raison`).
 *
 * Pur (fichiers lus par `fs` seulement) : importable par Node, testé par src/presse/mouvement-statique.test.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { parse, type HTMLElement } from "node-html-parser";

export const REGLES_MOUVEMENT = {
  "transition-all": "« transition: all » anime tout ce qui change (mise en page comprise) : nommer les propriétés (transform, opacity…).",
  "ease-in": "ease-in part lentement : l'interface paraît lente. Préférer ui-sortie (--presse-ease-sortie) ; ease-in-out reste permis pour un déplacement.",
  "scale-zero": "Rien n'apparaît depuis rien : partir de scale(0.95) et opacity 0, pas de scale(0).",
  "duree-longue": "Plus de 300 ms pour une réponse d'interface : 100–160 ms pour un appui, 150–250 ms pour une popover (modale, tiroir, toast : jusqu'à 500 ms).",
  "survol-sans-hover": "Un :hover hors de @media (hover: hover) colle après un toucher sur écran tactile : l'entourer de @media (hover: hover) and (pointer: fine).",
  "clavier-anime": "Une action au clavier n'est jamais animée (raccourcis répétés 100 fois par jour) : à vérifier.",
  "origine-centre": "Une popover, un menu ou une infobulle sort de son déclencheur : transform-origin du côté du déclencheur (une modale, elle, garde le centre).",
  "propriete-animee": "N'animer que transform, opacity, filter, clip-path et les couleurs : le reste recalcule la mise en page ou repeint à chaque image.",
  "keyframes-rapide": "Élément déclenché vite (toast, bascule) : une transition garde sa vitesse si on l'interrompt, une keyframe repart de zéro (à vérifier).",
  "ignore-sans-raison": "presse-lint-ignore sans raison : il ne désactive rien (« presse-lint-ignore: regle — pourquoi »).",
  "ignore-inconnue": "presse-lint-ignore : règle inconnue.",
} as const;
export type RegleMouvement = keyof typeof REGLES_MOUVEMENT;
const NOMS_REGLES = Object.keys(REGLES_MOUVEMENT).filter((r) => !r.startsWith("ignore-")) as RegleMouvement[];

export type ConstatMouvement = {
  regle: RegleMouvement;
  /** Fichier relatif à la racine du dépôt (ou le chemin donné). */
  fichier: string;
  ligne: number;
  /** Le sélecteur, le nom des keyframes ou l'élément. */
  ou: string;
  /** La déclaration en cause, telle qu'écrite (raccourcie). */
  extrait: string;
  message: string;
};

/* ───────────────────────── Ignorer ───────────────────────── */

type Ignore = { regles: Set<string>; raison: string };

/** Lit un commentaire `presse-lint-ignore: regle … — raison` ; null si ce n'en est pas un. */
export function lireIgnore(texte: string): { regles: string[]; raison: string } | null {
  const m = /presse-lint-ignore\s*:\s*([\s\S]*)$/.exec(texte.trim());
  if (!m) return null;
  const reste = m[1]!.trim();
  const regles: string[] = [];
  let i = 0;
  const mots = reste.split(/([\s,]+)/);
  let consomme = 0;
  for (; i < mots.length; i++) {
    const w = mots[i]!;
    if (/^[\s,]*$/.test(w)) {
      consomme += w.length;
      continue;
    }
    if (/^[a-z][a-z-]*[a-z]$/.test(w) && (NOMS_REGLES as string[]).includes(w)) {
      regles.push(w);
      consomme += w.length;
      continue;
    }
    // Un mot en forme de règle mais inconnu, en tête : une faute de frappe.
    if (!regles.length && /^[a-z]+(-[a-z]+)+$/.test(w)) {
      regles.push(w);
      consomme += w.length;
      continue;
    }
    break;
  }
  const raison = reste.slice(consomme).replace(/^[\s—–:(-]+/, "").replace(/[)\s]+$/, "").trim();
  return { regles, raison };
}

/* ───────────────────────── Lecture du CSS ───────────────────────── */

export type Decl = { prop: string; valeur: string; ligne: number };
export type RegleCss = { selecteur: string; decls: Decl[]; ligne: number; contextes: string[]; ignores: Ignore[] };
export type Keyframes = { nom: string; images: { cle: string; decls: Decl[] }[]; ligne: number; contextes: string[]; ignores: Ignore[] };
export type FeuilleLue = { regles: RegleCss[]; keyframes: Keyframes[]; constats: ConstatMouvement[] };

/** Un lecteur de CSS minimal : règles (imbrication CSS comprise), at-règles, @keyframes, commentaires d'ignorance. */
export function lireCss(css: string, fichier = "feuille.css", ligneDepart = 1): FeuilleLue {
  const regles: RegleCss[] = [];
  const keyframes: Keyframes[] = [];
  const constats: ConstatMouvement[] = [];
  let i = 0;
  let ligne = ligneDepart;
  const n = css.length;
  const avance = (k: number) => {
    for (let j = 0; j < k && i < n; j++, i++) if (css[i] === "\n") ligne++;
  };
  const ignoresEnAttente: Ignore[] = [];
  const noterIgnore = (texte: string, l: number, cible: Ignore[]) => {
    const ig = lireIgnore(texte);
    if (!ig) return;
    const inconnues = ig.regles.filter((r) => !(NOMS_REGLES as string[]).includes(r));
    for (const r of inconnues) constats.push({ regle: "ignore-inconnue", fichier, ligne: l, ou: "commentaire", extrait: texte.trim().slice(0, 80), message: `${REGLES_MOUVEMENT["ignore-inconnue"]} (« ${r} » ; connues : ${NOMS_REGLES.join(", ")})` });
    if (!ig.raison) {
      constats.push({ regle: "ignore-sans-raison", fichier, ligne: l, ou: "commentaire", extrait: texte.trim().slice(0, 80), message: REGLES_MOUVEMENT["ignore-sans-raison"] });
      return;
    }
    cible.push({ regles: new Set(ig.regles.filter((r) => (NOMS_REGLES as string[]).includes(r))), raison: ig.raison });
  };
  /** Saute blancs et commentaires ; les commentaires d'ignorance vont dans `cible`. */
  const blancs = (cible: Ignore[]) => {
    for (;;) {
      while (i < n && /\s/.test(css[i]!)) avance(1);
      if (css.startsWith("/*", i)) {
        const fin = css.indexOf("*/", i + 2);
        const l = ligne;
        const texte = css.slice(i + 2, fin < 0 ? n : fin);
        avance((fin < 0 ? n : fin + 2) - i);
        noterIgnore(texte, l, cible);
        continue;
      }
      return;
    }
  };
  /** Lit jusqu'à `{`, `;` ou `}` au niveau courant (chaînes, parenthèses et commentaires respectés). */
  const jusqua = (): { texte: string; fin: string; ligne: number } => {
    let t = "";
    let par = 0;
    const l0 = ligne;
    while (i < n) {
      const c = css[i]!;
      if (c === '"' || c === "'") {
        const q = c;
        let j = i + 1;
        while (j < n && css[j] !== q) j += css[j] === "\\" ? 2 : 1;
        t += css.slice(i, j + 1);
        avance(j + 1 - i);
        continue;
      }
      if (css.startsWith("/*", i)) {
        const fin = css.indexOf("*/", i + 2);
        avance((fin < 0 ? n : fin + 2) - i);
        t += " ";
        continue;
      }
      if (c === "(") par++;
      if (c === ")") par = Math.max(0, par - 1);
      if (par === 0 && (c === "{" || c === ";" || c === "}")) return { texte: t, fin: c, ligne: l0 };
      t += c;
      avance(1);
    }
    return { texte: t, fin: "", ligne: l0 };
  };
  const decl = (texte: string, l: number): Decl | null => {
    const k = texte.indexOf(":");
    if (k < 0) return null;
    const prop = texte.slice(0, k).trim().toLowerCase();
    if (!/^(--)?[a-z-]+$/.test(prop)) return null;
    return { prop, valeur: texte.slice(k + 1).replace(/!important/i, "").trim(), ligne: l };
  };
  const combiner = (parent: string, enfant: string) => {
    if (!parent) return enfant;
    const ps = parent.split(",").map((s) => s.trim());
    return enfant
      .split(",")
      .map((e) => e.trim())
      .flatMap((e) => ps.map((p) => (e.includes("&") ? e.replace(/&/g, p) : `${p} ${e}`)))
      .join(", ");
  };

  /** Le corps d'un bloc : déclarations pour `regle` (si elle existe), règles et at-règles imbriquées. */
  const bloc = (contextes: string[], regle: RegleCss | null, ignoresParents: Ignore[]) => {
    for (;;) {
      const ici: Ignore[] = [];
      blancs(ici);
      if (regle) regle.ignores.push(...ici);
      else ignoresEnAttente.push(...ici);
      if (i >= n) return;
      if (css[i] === "}") {
        avance(1);
        return;
      }
      const { texte, fin, ligne: l } = jusqua();
      const t = texte.trim();
      if (fin === ";" || fin === "}" || fin === "") {
        if (fin === ";") avance(1);
        if (!regle) ignoresEnAttente.length = 0;
        if (regle && t && !t.startsWith("@")) {
          const d = decl(t, l);
          if (d) regle.decls.push(d);
        }
        if (fin === "}") {
          avance(1);
          return;
        }
        if (!fin) return;
        continue;
      }
      // `{` : une règle ou une at-règle.
      avance(1);
      const herites = [...ignoresParents, ...(regle ? [] : ignoresEnAttente.splice(0))];
      if (t.startsWith("@")) {
        const nom = /^@([a-z-]+)/i.exec(t)?.[1]?.toLowerCase() ?? "";
        if (nom === "keyframes" || nom.endsWith("-keyframes")) {
          const kf: Keyframes = { nom: t.replace(/^@[a-z-]+\s*/i, "").trim(), images: [], ligne: l, contextes, ignores: [...herites] };
          keyframes.push(kf);
          // Les images : « from { … } », « 50% { … } ».
          for (;;) {
            const ig: Ignore[] = [];
            blancs(ig);
            kf.ignores.push(...ig);
            if (i >= n) break;
            if (css[i] === "}") {
              avance(1);
              break;
            }
            const cle = jusqua();
            if (cle.fin !== "{") {
              avance(1);
              continue;
            }
            avance(1);
            const image: RegleCss = { selecteur: cle.texte.trim(), decls: [], ligne: cle.ligne, contextes: [], ignores: [] };
            bloc([], image, []);
            kf.images.push({ cle: image.selecteur, decls: image.decls });
            kf.ignores.push(...image.ignores);
          }
          continue;
        }
        // @media, @supports, @starting-style, @layer, @container… : les règles du dedans portent ce contexte. Dans une
        // règle (imbrication), une at-règle garde le sélecteur de la règle.
        if (regle) {
          const sous: RegleCss = { selecteur: regle.selecteur, decls: [], ligne: l, contextes: [...contextes, t], ignores: [...regle.ignores, ...herites] };
          regles.push(sous);
          bloc([...contextes, t], sous, sous.ignores);
        } else {
          const ig: Ignore[] = [...herites];
          bloc([...contextes, t], null, ig);
        }
        continue;
      }
      const sel = regle ? combiner(regle.selecteur, t) : t;
      const r: RegleCss = { selecteur: sel, decls: [], ligne: l, contextes, ignores: [...herites, ...(regle ? regle.ignores : [])] };
      regles.push(r);
      bloc(contextes, r, r.ignores);
    }
  };
  // Le niveau supérieur : les ignorances en attente vont à la règle (ou à l'at-règle) suivante.
  bloc([], null, []);
  return { regles, keyframes, constats };
}

/* ───────────────────────── Valeurs ───────────────────────── */

/** Coupe aux virgules de premier niveau (pas dans cubic-bezier(…)). */
const virgules = (v: string): string[] => {
  const out: string[] = [];
  let p = 0;
  let cur = "";
  for (const c of v) {
    if (c === "(") p++;
    if (c === ")") p--;
    if (c === "," && p === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};
/** Les mots d'une valeur, fonctions entières (`cubic-bezier(0.2, 0, 0, 1)` est un mot). */
const mots = (v: string): string[] => {
  const out: string[] = [];
  let p = 0;
  let cur = "";
  for (const c of v) {
    if (c === "(") p++;
    if (c === ")") p--;
    if (/\s/.test(c) && p === 0) {
      if (cur) out.push(cur);
      cur = "";
    } else cur += c;
  }
  if (cur) out.push(cur);
  return out;
};
const TEMPS = /^(-?\d*\.?\d+)(ms|s)$/i;
/** Une durée en ms ; `null` si ce n'est pas une durée écrite (var(), calc() : inconnue → undefined). */
const ms = (w: string): number | null | undefined => {
  const m = TEMPS.exec(w);
  if (m) return Number(m[1]) * (m[2]!.toLowerCase() === "s" ? 1000 : 1);
  if (/^(var|calc|env|min|max|clamp)\(/i.test(w)) return undefined;
  return null;
};
const COURBES = /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|cubic-bezier\(.*\)|steps\(.*\)|linear\(.*\))$/i;
const MOTS_CLES_TRANSITION = new Set(["allow-discrete", "normal", "initial", "inherit", "unset", "revert"]);

type Transition = { prop: string | null; duree: number | null | undefined; courbe: string | null; brut: string; ligne: number };

/** Les transitions d'une règle (raccourci et longues mains réunis). */
function transitions(r: RegleCss): Transition[] {
  const out: Transition[] = [];
  let props: string[] | null = null;
  let durees: (number | null | undefined)[] | null = null;
  let courbes: string[] | null = null;
  let ligneL = r.ligne;
  for (const d of r.decls) {
    if (d.prop === "transition") {
      if (/^(none|initial|unset|inherit|revert)$/i.test(d.valeur)) continue;
      for (const item of virgules(d.valeur)) {
        let prop: string | null = null;
        let duree: number | null | undefined = null;
        let courbe: string | null = null;
        let vu = 0;
        for (const w of mots(item)) {
          const t = ms(w);
          if (t !== null) {
            if (vu === 0) duree = t;
            vu++;
            continue;
          }
          if (COURBES.test(w)) {
            courbe = w.toLowerCase();
            continue;
          }
          if (MOTS_CLES_TRANSITION.has(w.toLowerCase())) continue;
          if (/^var\(/i.test(w)) {
            // var() : propriété, durée ou courbe, on ne sait pas — ni « all » implicite ni propriété connue.
            prop ??= "?";
            continue;
          }
          prop = w.toLowerCase();
        }
        out.push({ prop, duree: vu ? duree : 0, courbe, brut: `transition: ${d.valeur}`, ligne: d.ligne });
      }
    } else if (d.prop === "transition-property") ((props = virgules(d.valeur).map((x) => x.toLowerCase())), (ligneL = d.ligne));
    else if (d.prop === "transition-duration") durees = virgules(d.valeur).map((x) => ms(x));
    else if (d.prop === "transition-timing-function") courbes = virgules(d.valeur).map((x) => x.toLowerCase());
  }
  if (props || durees || courbes) {
    const p = props ?? [null];
    const k = Math.max(p.length, durees?.length ?? 1, courbes?.length ?? 1);
    for (let j = 0; j < k; j++) {
      const prop = props ? props[j % props.length]! : null;
      if (props === null && !durees && courbes) {
        // Seulement une courbe longue main : elle s'applique aux transitions du raccourci, déjà lues.
        for (const c of courbes) out.push({ prop: "?", duree: undefined, courbe: c, brut: `transition-timing-function: ${courbes.join(", ")}`, ligne: ligneL });
        break;
      }
      out.push({ prop: prop ?? "all", duree: durees ? durees[j % durees.length] : undefined, courbe: courbes ? courbes[j % courbes.length]! : null, brut: [props && `transition-property: ${props.join(", ")}`, durees && "transition-duration…"].filter(Boolean).join(" ; "), ligne: ligneL });
    }
  }
  return out;
}

type Animation = { nom: string | null; duree: number | null | undefined; infinie: boolean; brut: string; ligne: number };
const MOTS_ANIMATION = new Set(["infinite", "normal", "reverse", "alternate", "alternate-reverse", "none", "forwards", "backwards", "both", "running", "paused", "initial", "inherit", "unset"]);
function animations(r: RegleCss): Animation[] {
  const out: Animation[] = [];
  let noms: string[] | null = null;
  let durees: (number | null | undefined)[] | null = null;
  let infinie = false;
  let ligneL = r.ligne;
  for (const d of r.decls) {
    if (d.prop === "animation") {
      if (/^(none|initial|unset|inherit|revert)$/i.test(d.valeur)) continue;
      for (const item of virgules(d.valeur)) {
        let nom: string | null = null;
        let duree: number | null | undefined = null;
        let vu = 0;
        let inf = false;
        for (const w of mots(item)) {
          const t = ms(w);
          if (t !== null) {
            if (vu === 0) duree = t;
            vu++;
            continue;
          }
          if (COURBES.test(w) || /^\d+(\.\d+)?$/.test(w)) continue;
          if (w.toLowerCase() === "infinite") inf = true;
          if (MOTS_ANIMATION.has(w.toLowerCase()) || /^var\(/i.test(w)) continue;
          nom ??= w;
        }
        if (nom === null && !vu) continue;
        out.push({ nom, duree: vu ? duree : 0, infinie: inf, brut: `animation: ${d.valeur}`, ligne: d.ligne });
      }
    } else if (d.prop === "animation-name") ((noms = virgules(d.valeur).filter((x) => x !== "none")), (ligneL = d.ligne));
    else if (d.prop === "animation-duration") durees = virgules(d.valeur).map((x) => ms(x));
    else if (d.prop === "animation-iteration-count") infinie = /infinite/i.test(d.valeur);
  }
  if (noms?.length) for (let j = 0; j < noms.length; j++) out.push({ nom: noms[j]!, duree: durees ? durees[j % durees.length] : undefined, infinie, brut: `animation-name: ${noms.join(", ")}`, ligne: ligneL });
  return out;
}

/* ───────────────────────── Les règles ───────────────────────── */

const PERMISES = new Set([
  "transform", "translate", "scale", "rotate", "opacity", "filter", "backdrop-filter", "-webkit-backdrop-filter", "clip-path", "-webkit-clip-path",
  // Couleurs.
  "color", "background-color", "background", "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "outline-color", "fill", "stroke", "text-decoration-color", "caret-color", "accent-color", "column-rule-color", "text-emphasis-color", "stop-color", "flood-color", "lighting-color",
  // Discrètes (allow-discrete) : pas d'interpolation, pas de mise en page image par image.
  "display", "overlay", "visibility", "content-visibility",
]);
const MISE_EN_PAGE = /^(width|height|min-|max-|margin|padding|top|right|bottom|left|inset|font-size|line-height|border-width|border-(top|right|bottom|left)-width|border|gap|row-gap|column-gap|grid-template|flex|letter-spacing|word-spacing)/;
const ENCADRE = /modal|modale|tiroir|drawer|dialog|toast|sheet/i;
const POPOVER = /popover|menu|tooltip|infobulle|dropdown|deroulant|bulle|role=["']?(menu|tooltip|listbox)/i;
const RAPIDE = /toast|bascule|toggle|switch|interrupteur|notification|snackbar|aria-pressed|aria-checked|:checked/i;
const HOVER_MEDIA = /\(\s*(any-)?hover\s*:\s*hover\s*\)/i;
/** scale(0), scale(0, 0), scale3d(0, 0, …) : pas scaleX(0) (un trait qui se dessine depuis un bord, c'est voulu). */
const SCALE_ZERO = /(^|[\s(])(scale\(\s*0*\.?0+\s*(,\s*0*\.?0+\s*)?\)|scale3d\(\s*0*\.?0+\s*,\s*0*\.?0+\s*,)/i;
const animee = (p: string | null) => p !== null && p !== "?" && p !== "all" && p !== "none" && !p.startsWith("--");

const court = (s: string) => (s.length > 90 ? `${s.slice(0, 87)}…` : s);
const ignoree = (ignores: Ignore[], regle: RegleMouvement) => ignores.some((ig) => ig.regles.has(regle));

/** Juge une feuille lue. `ou` du constat : le sélecteur. */
export function jugerFeuille(f: FeuilleLue, fichier: string): ConstatMouvement[] {
  const out: ConstatMouvement[] = [...f.constats];
  const dire = (regle: RegleMouvement, ignores: Ignore[], ligne: number, ou: string, extrait: string, plus = "") => {
    if (ignoree(ignores, regle)) return;
    out.push({ regle, fichier, ligne, ou: court(ou), extrait: court(extrait), message: `${REGLES_MOUVEMENT[regle]}${plus ? ` ${plus}` : ""}` });
  };
  const utilisees = new Map<string, RegleCss[]>();
  for (const r of f.regles) for (const a of animations(r)) if (a.nom) utilisees.set(a.nom, [...(utilisees.get(a.nom) ?? []), r]);

  for (const r of f.regles) {
    const sel = r.selecteur;
    const ctx = r.contextes.join(" ");
    const encadre = ENCADRE.test(sel) || ENCADRE.test(ctx);
    const ts = transitions(r);
    const as = animations(r);
    // 1. transition: all (ou sans propriété).
    for (const t of ts) {
      if ((t.prop === null || t.prop === "all") && t.duree !== 0) dire("transition-all", r.ignores, t.ligne, sel, t.brut, t.prop === null ? "(Ici, aucune propriété n'est nommée : c'est « all ».)" : "");
    }
    // 2. ease-in (pas ease-in-out).
    for (const t of ts) if (t.courbe === "ease-in") dire("ease-in", r.ignores, t.ligne, sel, t.brut);
    // 4. Durée > 300 ms hors modale / tiroir / dialog / toast / drawer.
    if (!encadre) {
      for (const t of ts) if (typeof t.duree === "number" && t.duree > 300) dire("duree-longue", r.ignores, t.ligne, sel, t.brut, `(${Math.round(t.duree)} ms)`);
      for (const a of as) if (!a.infinie && typeof a.duree === "number" && a.duree > 300 && !(a.nom && ENCADRE.test(a.nom))) dire("duree-longue", r.ignores, a.ligne, sel, a.brut, `(${Math.round(a.duree)} ms)`);
    }
    // 8. Propriétés animées.
    for (const t of ts) {
      if (!animee(t.prop) || t.duree === 0) continue;
      if (PERMISES.has(t.prop!) || /-color$/.test(t.prop!)) continue;
      dire("propriete-animee", r.ignores, t.ligne, sel, t.brut, MISE_EN_PAGE.test(t.prop!) ? `(« ${t.prop} » : mise en page recalculée à chaque image)` : `(« ${t.prop} » : repeinture, à vérifier)`);
    }
    // 3. scale(0) : dans @starting-style, ou sur une règle qui fait la transition de transform.
    const transitionTransform = ts.some((t) => t.prop === null || t.prop === "all" || t.prop === "transform" || t.prop === "scale");
    const depart = /@starting-style/i.test(ctx);
    for (const d of r.decls) {
      const zero = (d.prop === "transform" && SCALE_ZERO.test(d.valeur)) || (d.prop === "scale" && /^0*\.?0+(\s+0*\.?0+)*$/.test(d.valeur));
      if (zero && (depart || transitionTransform)) dire("scale-zero", r.ignores, d.ligne, sel, `${d.prop}: ${d.valeur}`);
    }
    // 5. :hover hors de @media (hover: hover).
    if (/:hover\b/.test(sel) && !HOVER_MEDIA.test(ctx)) dire("survol-sans-hover", r.ignores, r.ligne, sel, sel);
    // 7. transform-origin: center sur popover / menu / infobulle.
    for (const d of r.decls)
      if (d.prop === "transform-origin" && /^(center|center center|50%|50% 50%|50% 50% 0)$/i.test(d.valeur) && POPOVER.test(sel) && !/modal|modale|dialog/i.test(sel)) dire("origine-centre", r.ignores, d.ligne, sel, `transform-origin: ${d.valeur}`);
    // 9. @keyframes sur un élément à déclenchement rapide.
    if (RAPIDE.test(sel)) for (const a of as) if (a.nom) dire("keyframes-rapide", r.ignores, a.ligne, sel, a.brut);
  }
  // Keyframes : propriétés animées, départ depuis scale(0).
  for (const k of f.keyframes) {
    const props = new Map<string, number>();
    for (const im of k.images) for (const d of im.decls) if (!/^(animation-timing-function|offset|animation-composition)$/.test(d.prop)) props.set(d.prop, props.get(d.prop) ?? d.ligne);
    for (const [p, l] of props) {
      if (p.startsWith("--") || PERMISES.has(p) || /-color$/.test(p)) continue;
      dire("propriete-animee", k.ignores, l, `@keyframes ${k.nom}`, `${p}`, MISE_EN_PAGE.test(p) ? `(« ${p} » : mise en page recalculée à chaque image)` : `(« ${p} » : repeinture, à vérifier)`);
    }
    for (const im of k.images) {
      if (!/^(from|0%)$/i.test(im.cle.trim()) && !im.cle.split(",").some((c) => /^(from|0%)$/i.test(c.trim()))) continue;
      for (const d of im.decls)
        if ((d.prop === "transform" && SCALE_ZERO.test(d.valeur)) || (d.prop === "scale" && /^0*\.?0+(\s+0*\.?0+)*$/.test(d.valeur))) dire("scale-zero", k.ignores, d.ligne, `@keyframes ${k.nom}`, `${im.cle} { ${d.prop}: ${d.valeur} }`);
    }
  }
  return out;
}

/** Lit et juge du CSS. */
export function lintCss(css: string, fichier = "feuille.css", ligneDepart = 1): ConstatMouvement[] {
  return jugerFeuille(lireCss(css, fichier, ligneDepart), fichier);
}

/** Un attribut `style=""` : une règle sans sélecteur, nommée par l'élément. */
export function lintStyleAttr(style: string, ou: string, fichier: string, ligne: number, ignores: Ignore[] = []): ConstatMouvement[] {
  const decls = virgules(style.replace(/;/g, "\u0000"))
    .join(",")
    .split("\u0000")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const k = s.indexOf(":");
      return k < 0 ? null : { prop: s.slice(0, k).trim().toLowerCase(), valeur: s.slice(k + 1).replace(/!important/i, "").trim(), ligne };
    })
    .filter((d): d is Decl => !!d);
  return jugerFeuille({ regles: [{ selecteur: ou, decls, ligne, contextes: [], ignores }], keyframes: [], constats: [] }, fichier);
}

/* ───────────────────────── JS : animations au clavier ───────────────────────── */

const SIGNES_ANIMATION = /\.animate\(|\.play\(\s*\)|\.reverse\(\s*\)|style\.(transition|animation)\b|startViewTransition|new Timeline\b|behavior:\s*["']smooth["']|classList\.(add|toggle)\(\s*["'][^"']*(anim|transition|entre|sort|glisse|ouvre)/;

/** Le texte entre une parenthèse (ou accolade) ouvrante et sa fermante, chaînes et gabarits sautés grossièrement. */
function equilibre(src: string, debut: number): string {
  const ouvre = src[debut]!;
  const ferme = ouvre === "(" ? ")" : "}";
  let p = 0;
  for (let j = debut; j < src.length; j++) {
    const c = src[j]!;
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      j++;
      while (j < src.length && src[j] !== q) j += src[j] === "\\" ? 2 : 1;
      continue;
    }
    if (c === ouvre) p++;
    else if (c === ferme && --p === 0) return src.slice(debut, j + 1);
  }
  return src.slice(debut);
}

/** Les gestionnaires keydown / keyup qui lancent une animation (heuristique). */
export function lintJs(src: string, fichier: string, ligneDepart = 1): ConstatMouvement[] {
  const out: ConstatMouvement[] = [];
  const ligneDe = (k: number) => ligneDepart + (src.slice(0, k).match(/\n/g)?.length ?? 0);
  const lignes = src.split("\n");
  const re = /addEventListener\(\s*["'](keydown|keyup)["']\s*,|\bon(keydown|keyup)\s*=/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const l = ligneDe(m.index);
    let corps: string;
    if (m[0].startsWith("addEventListener")) {
      corps = equilibre(src, src.indexOf("(", m.index));
      // Une référence (`addEventListener("keydown", surTouche)`) : son corps dans le fichier, s'il y est.
      const ref = /,\s*([A-Za-z_$][\w$]*)\s*[,)]/.exec(corps.slice(m[0].length - "addEventListener(".length));
      if (ref) {
        const def = new RegExp(`(?:function\\s+${ref[1]}\\s*\\(|(?:const|let|var)\\s+${ref[1]}\\s*=)`).exec(src);
        if (def) {
          const acc = src.indexOf("{", def.index);
          if (acc > 0) corps += equilibre(src, acc);
        }
      }
    } else {
      const acc = src.indexOf("{", m.index);
      corps = acc > 0 ? equilibre(src, acc) : "";
    }
    const signe = SIGNES_ANIMATION.exec(corps);
    if (!signe) continue;
    const avant = lignes.slice(Math.max(0, l - ligneDepart - 3), l - ligneDepart + 1).join("\n");
    const ig = [avant, corps].map((t) => /presse-lint-ignore\s*:[^\n*]*/.exec(t)?.[0]).find(Boolean);
    if (ig) {
      const lu = lireIgnore(ig);
      if (lu?.raison && lu.regles.includes("clavier-anime")) continue;
      if (lu && !lu.raison) out.push({ regle: "ignore-sans-raison", fichier, ligne: l, ou: m[1] ?? m[2] ?? "", extrait: ig.slice(0, 80), message: REGLES_MOUVEMENT["ignore-sans-raison"] });
    }
    out.push({ regle: "clavier-anime", fichier, ligne: l, ou: `gestionnaire ${m[1] ?? m[2]}`, extrait: court(signe[0]), message: REGLES_MOUVEMENT["clavier-anime"] });
  }
  return out;
}

/* ───────────────────────── Une page ───────────────────────── */

const rel = (racine: string, abs: string) => path.relative(racine, abs).split(path.sep).join("/");

/** Les modules (TS/JS) et feuilles (CSS) qu'une liste d'entrées importe statiquement, `@import` des CSS compris. */
export function grapheModules(entrees: string[], racine: string): { scripts: Set<string>; feuilles: Set<string> } {
  const scripts = new Set<string>();
  const feuilles = new Set<string>();
  const resoudre = (spec: string, depuis: string): string | null => {
    const s = spec.replace(/\?.*$/, "");
    if (s.startsWith("/")) return path.join(racine, s);
    if (s.startsWith(".")) return path.resolve(path.dirname(depuis), s);
    return null;
  };
  const suivre = (abs: string) => {
    if (!fs.existsSync(abs)) return;
    if (/\.css$/.test(abs)) {
      if (feuilles.has(abs)) return;
      feuilles.add(abs);
      for (const m of fs.readFileSync(abs, "utf8").matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g)) {
        const c = resoudre(m[1]!, abs);
        if (c) suivre(c);
      }
      return;
    }
    if (!/\.(ts|js|mjs)$/.test(abs) || scripts.has(abs)) return;
    scripts.add(abs);
    const src = fs.readFileSync(abs, "utf8");
    for (const m of src.matchAll(/(?:^|[\n;])\s*(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/g)) {
      const c = resoudre(m[1]!, abs);
      if (c) suivre(c);
    }
  };
  for (const e of entrees) suivre(e);
  return { scripts, feuilles };
}

/** Les fichiers qui « appartiennent » à la page : ceux du dossier de son script d'entrée (sauf src/ lui-même : seulement ses fichiers directs). */
export function proprietaire(entree: string, racine: string): (abs: string) => boolean {
  const dir = path.dirname(entree);
  const src = path.join(racine, "src");
  if (dir === src) return (abs) => path.dirname(abs) === src && !/(pages-nav|legacy-nav|html-in-canvas)\.ts$/.test(abs);
  if (dir === racine || !dir.startsWith(src)) return (abs) => abs === entree;
  return (abs) => abs.startsWith(dir + path.sep);
}

export type SourcesPage = {
  /** Toutes les feuilles et tous les scripts que la page charge statiquement (pour l'audit : qui sert quoi). */
  feuilles: string[];
  scripts: string[];
  /** Ceux qui sont à elle (jugés avec la page). */
  propres: string[];
};

/** Lint statique d'une page HTML : ses sources propres (inline, style="", feuilles liées locales, imports de son dossier). */
export function lintPage(fichier: string, racine: string, html = fs.readFileSync(fichier, "utf8")): { constats: ConstatMouvement[]; sources: SourcesPage } {
  const doc = parse(html, { comment: true, blockTextElements: { script: true, noscript: true, style: true, pre: true } });
  const debuts = [0];
  for (let k = 0; k < html.length; k++) if (html[k] === "\n") debuts.push(k + 1);
  const ligneDe = (off: number) => {
    let lo = 0;
    let hi = debuts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (debuts[mid]! <= off) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const nomPage = rel(racine, fichier);
  const out: ConstatMouvement[] = [];
  const tous = doc.querySelectorAll("*") as HTMLElement[];
  // <style> : le texte brut, numéroté depuis sa ligne dans la page.
  for (const s of doc.querySelectorAll("style")) {
    const debut = html.indexOf(s.rawText, s.range[0]);
    out.push(...lintCss(s.rawText, nomPage, ligneDe(debut >= 0 ? debut : s.range[0])));
  }
  // style="" : avec le commentaire qui précède l'élément.
  for (const el of tous) {
    const st = el.getAttribute("style");
    if (!st || !/transition|animation|transform|scale/i.test(st)) continue;
    const avant = html.slice(Math.max(0, el.range[0] - 240), el.range[0]);
    const ig = /<!--\s*(presse-lint-ignore\s*:[\s\S]*?)-->\s*$/.exec(avant);
    const ignores: Ignore[] = [];
    if (ig) {
      const lu = lireIgnore(ig[1]!);
      if (lu?.raison) ignores.push({ regles: new Set(lu.regles), raison: lu.raison });
    }
    const id = el.getAttribute("id");
    const cls = el.getAttribute("class")?.trim().split(/\s+/)[0];
    out.push(...lintStyleAttr(st, `<${el.rawTagName.toLowerCase()}${id ? `#${id}` : cls ? `.${cls}` : ""} style>`, nomPage, ligneDe(el.range[0]), ignores));
  }
  // Scripts en ligne : le JS (clavier).
  for (const s of doc.querySelectorAll("script")) {
    if (s.getAttribute("src") || !/^(module|text\/javascript|)$/.test(s.getAttribute("type") ?? "")) continue;
    out.push(...lintJs(s.rawText, nomPage, ligneDe(s.range[0])));
  }
  // Feuilles liées locales, scripts d'entrée et leurs imports.
  const resoudre = (href: string) => (href.startsWith("/") ? path.join(racine, href) : path.resolve(path.dirname(fichier), href));
  const liees = doc
    .querySelectorAll('link[rel~="stylesheet"]')
    .map((l) => l.getAttribute("href") ?? "")
    .filter((h) => h && !/^(https?:)?\/\//.test(h) && !h.startsWith("data:"))
    .map((h) => resoudre(h.replace(/\?.*$/, "")));
  const entrees = doc
    .querySelectorAll("script[src]")
    .map((s) => s.getAttribute("src") ?? "")
    .filter((h) => h && !/^(https?:)?\/\//.test(h))
    .map(resoudre);
  // Les imports des scripts en ligne comptent comme des entrées (sans dossier propre : rien n'est « à la page »).
  const enLigne: string[] = [];
  for (const s of doc.querySelectorAll("script"))
    if (!s.getAttribute("src")) for (const m of s.rawText.matchAll(/(?:^|[\n;])\s*import\s+(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/g)) if (/^[./]/.test(m[1]!)) enLigne.push(resoudre(m[1]!.replace(/\?.*$/, "")));
  const g = grapheModules([...liees, ...entrees, ...enLigne], racine);
  const estPropre = (abs: string) => liees.includes(abs) || entrees.some((e) => proprietaire(e, racine)(abs));
  const propres = [...g.feuilles, ...g.scripts].filter(estPropre);
  for (const f of propres) {
    if (!fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, "utf8");
    out.push(...(/\.css$/.test(f) ? lintCss(t, rel(racine, f)) : lintJs(t, rel(racine, f))));
  }
  return { constats: out, sources: { feuilles: [...g.feuilles].map((f) => rel(racine, f)), scripts: [...g.scripts].map((f) => rel(racine, f)), propres: propres.map((f) => rel(racine, f)) } };
}

/** Un constat, en une ligne lisible (validateur). */
export const texteConstat = (c: ConstatMouvement) => `[${c.regle}] ${c.fichier}:${c.ligne} ${c.ou} — ${c.extrait} : ${c.message}`;
