/**
 * Presse — le catalogue des attributs `data-*`, DÉRIVÉ de PRESSE.md (aucune liste tenue à la main ici, sauf les
 * COMPLEMENTS ci-dessous, chacun justifié).
 *
 * Étend `readAttributes` de presse/build/catalog.ts (qui alimente llms.txt et presse-catalog.json) : celui-ci ne lit
 * que la section « Attributs » et les lignes dont la première colonne n'a que des noms entre accents graves ; il manque
 * donc `data-transition` (suite), et les lignes posées en fin de fichier (graffiti, derrière, déchirure détourée).
 * Ici, on lit toutes les lignes de tableau dont la première colonne nomme un `data-*`, où qu'elles soient, et on en
 * tire, en plus des noms :
 *   - les valeurs permises (la liste de mots entre accents graves en tête de la colonne « Effet », puis, pour chaque
 *     option citée, la liste qui la suit immédiatement : « `-quand` (`entree`, `survol`) », « `data-vague-type` :
 *     `verticale`, … ») ;
 *   - le contexte (colonne « Sur ») : balise attendue, attribut compagnon (« avec `data-gl-img` »), enfants requis ;
 *   - le module parent des options (une option citée dans la ligne d'un module appartient à ce module) ;
 *   - les valeurs obligatoires (`data-favori="id"`, `data-metal-reflet="nom"`).
 *
 * Deux autres sources, lues elles aussi, jamais recopiées :
 *   - le code (src/presse, src/gpu, src/components, src/pages-nav.ts) : un attribut lu par le code mais absent de
 *     PRESSE.md n'est pas une faute de la page, c'est un trou de la documentation (avertissement « non documenté ») ;
 *   - src/registre/effets.ts : quels modules pages-nav arme lui-même, et lesquels seulement sans `data-presse-manuel`.
 */
import fs from "node:fs";
import path from "node:path";
import { EFFETS, TOUJOURS } from "../../src/registre/effets.ts";

/* ───────────────────────── Types ───────────────────────── */

/** La colonne « Sur », lue : où l'attribut a un sens. */
export type Sur = {
  brut: string;
  /** Balises attendues (vide : toute balise). */
  balises: string[];
  /** Balise exigée (html, img, input) : erreur si ailleurs ; sinon avertissement. */
  stricte: boolean;
  /** Attributs compagnons sur le même élément (« avec `data-gl-img` »). */
  avec: string[];
  /** Sélecteur exact (`section[data-diapo-slide]`). */
  attrsSelecteur: string[];
  /** Descendants requis, dits dans la colonne « Effet » (« ses `[data-goo-item]` ») ou « conteneur d'`img` ». */
  enfants: string[];
  /** Descendants cités dans la colonne « Sur » (« piste `[data-rail-piste]` ») : attendus, le module a parfois un repli. */
  conseilles: string[];
  /** Nombre minimal d'images descendantes (« deux images » : 2), 0 sinon. */
  images: number;
  /** Une img ou une vidéo descendante. */
  media: boolean;
};

export type Contexte = { type: "partout" } | { type: "sur"; sur: Sur } | { type: "dans"; attrs: string[] };

export type JeuDeValeurs = { valeurs: string[]; contexte: Contexte; source: string };

export type Attribut = {
  nom: string;
  documente: boolean;
  /** Ligne(s) de PRESSE.md où il est nommé (première colonne) ou cité. */
  lignesMd: number[];
  /** Lignes du tableau où il est nommé en première colonne. */
  lignes: Ligne[];
  /** Parents forts : l'option n'a de sens que sur (ou dans) un élément portant l'un d'eux. */
  parents: string[];
  /** Parents faibles : attribut sans préfixe commun cité dans la ligne d'un module (`data-compte` du diaporama). */
  parentsFaibles: string[];
  /** Énumérations, par contexte. */
  valeurs: JeuDeValeurs[];
  /** Valeurs citées en exemple (`attr="v"`) : ajoutées seulement si l'attribut a déjà une énumération. */
  exemples: string[];
  /** Une ligne sans énumération le décrit : sa valeur est libre (dans ce contexte). */
  libre: Contexte[];
  valeurRequise: boolean;
  /** Fichiers du code qui le lisent ou le posent. */
  code: string[];
  /** Module (src/presse/x.ts) qui l'anime, s'il est connu. */
  module?: string;
};

export type Ligne = {
  /** Numéro de ligne dans PRESSE.md (1…). */
  n: number;
  section: string;
  noms: string[];
  principal: string;
  /** Valeurs écrites en première colonne (`data-gl-print="page"`). */
  valeursCol1: string[];
  sur: Sur;
  texte: string;
  /** Ligne d'options (`-delay`…, ou « avec `X` ») : pas un module en soi. */
  options: boolean;
  /** Première colonne en abrégé (`data-anim-stagger`, `-delay`…) : pas d'énumération commune. */
  abrege: boolean;
};

export type Armement = { module: string; attrs: string[]; sansManuel: boolean };

export type Catalogue = {
  racine: string;
  attributs: Map<string, Attribut>;
  lignes: Ligne[];
  /** Paramètres d'adresse et variables CSS documentés (`?presse-lint`, `--paper`). */
  autres: string[];
  /** Armement par src/pages-nav.ts, lu dans le registre (src/registre/effets.ts). */
  armement: Armement[];
  /** Modules importés statiquement par pages-nav (armés dès qu'il est monté). */
  importsPagesNav: string[];
};

/* ───────────────────────── Compléments ───────────────────────── */

/**
 * Ce que PRESSE.md dit en prose et que la lecture mécanique ne peut pas tirer d'une liste. Chaque entrée cite la
 * phrase qui la justifie ; ajouter ici, c'est reconnaître que le tableau devrait le dire.
 */
export const COMPLEMENTS: Record<string, { valeurs?: string[]; valeursDe?: string; pistes?: boolean; ouvertId?: boolean; parentsSelecteurs?: string[]; texteOuValeur?: boolean; courbe?: boolean; pourquoi: string }> = {
  "data-transition": {
    valeursDe: "data-presse-transition",
    valeurs: ["deplacement"],
    pourquoi: "data-diapo : « imprimée à son arrivée avec sa data-transition » (les transitions de page), et « `deplacement` : Magic Move », après un point-virgule.",
  },
  "data-anim": { pistes: true, pourquoi: "« un motif (…) ou des pistes « propriété de vers » séparées par ; » : une valeur à espaces est une piste." },
  "data-forme": { ouvertId: true, pourquoi: "« (`eclair`, `goutte`, `cercle`, `etoile` ou l'id d'un path SVG) »." },
  "data-vague-type": { parentsSelecteurs: ['[data-transition="vague"]'], pourquoi: "« Dans un diaporama : data-transition=\"vague\" sur la diapo (avec data-vague-type, data-vague-palette) »." },
  "data-vague-palette": { parentsSelecteurs: ['[data-transition="vague"]'], pourquoi: "idem data-vague-type." },
  "data-anim-ease": { courbe: true, pourquoi: "« courbe (`out`, `in-out`…) » : un nom ou une écriture CSS, lue par src/registre/mouvement/courbes.ts (lireCourbe)." },
  "data-cinetique-courbe": { courbe: true, pourquoi: "idem data-anim-ease." },
  "data-cinetique-courbe-sortie": { courbe: true, pourquoi: "idem data-anim-ease." },
  "data-goo-courbe": { courbe: true, pourquoi: "idem data-anim-ease." },
  "data-couloir-courbe": { courbe: true, pourquoi: "idem data-anim-ease." },
  "data-graffiti": { texteOuValeur: true, pourquoi: "« bloc (p, div) avec le mot » : le mot en valeur, ou le texte de l'élément." },
};

/** Paires d'attributs qui se marchent dessus sur un même élément. */
export const COLLISIONS: { a: string; b: string; grave: boolean; pourquoi: string }[] = [
  { a: "data-cinetique", b: "data-typo", grave: true, pourquoi: "deux modules découpent et réécrivent le même texte" },
  { a: "data-cinetique", b: "data-gl-text", grave: true, pourquoi: "le GPU repeint des lettres que le DOM découpe et anime" },
  { a: "data-typo", b: "data-gl-text", grave: true, pourquoi: "le GPU repeint des lettres que data-typo découpe et anime" },
  { a: "data-graffiti", b: "data-gl-text", grave: true, pourquoi: "le mot est peint deux fois (canvas 2D et GPU)" },
  { a: "data-metal-texte", b: "data-gl-text", grave: true, pourquoi: "deux rendus GPU des mêmes lettres" },
  { a: "data-cinetique", b: "data-anim", grave: false, pourquoi: "deux moteurs de temps animent transform et opacity du même élément" },
  { a: "data-typo", b: "data-anim", grave: false, pourquoi: "deux moteurs de temps animent le même élément" },
  { a: "data-rail", b: "data-ruban", grave: true, pourquoi: "deux défilements au glisser sur la même rangée" },
  { a: "data-cinetique", b: "data-roule", grave: true, pourquoi: "data-roule est un composant de cinetique.ts : il remplace le texte que data-cinetique découpe" },
];

const SIMPLE = /^[a-z0-9][a-z0-9-]*$/;
/** Mots HTML / CSS qui suivent parfois une option sans en être une valeur (« `data-caption` ou `figcaption` »). */
const MOTS_HTML = new Set(["a", "img", "href", "src", "alt", "html", "body", "head", "figcaption", "figure", "picture", "video", "iframe", "input", "change", "nav", "main", "section", "aside", "button", "label", "sticky", "translate", "transform", "stroke-dashoffset", "clip-path", "object-fit", "pointer-events"]);
const estValeur = (s: string) => SIMPLE.test(s) && !s.startsWith("data-") && !s.startsWith("aria-") && !MOTS_HTML.has(s);
/** Profondeur de parenthèses après un texte, partant de `d`. */
const profondeur = (texte: string, d: number) => {
  let p = d;
  for (const c of texte) p += c === "(" ? 1 : c === ")" ? -1 : 0;
  return Math.max(0, p);
};

/* ───────────────────────── Lecture du markdown ───────────────────────── */

/** Découpe une ligne de tableau en cellules, sans couper dans les accents graves ni sur `\|`. */
export function cellules(ligne: string): string[] {
  const t = ligne.trim();
  if (!t.startsWith("|") || !t.endsWith("|")) return [];
  const out: string[] = [];
  let cur = "";
  let code = false;
  for (let i = 1; i < t.length - 1; i++) {
    const c = t[i]!;
    if (c === "`") code = !code;
    if (c === "\\" && t[i + 1] === "|") {
      cur += "|";
      i++;
      continue;
    }
    if (c === "|" && !code) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** Les spans entre accents graves d'un texte, avec le texte qui les précède. */
export function spans(texte: string): { avant: string; code: string }[] {
  const out: { avant: string; code: string }[] = [];
  const re = /`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texte))) {
    out.push({ avant: texte.slice(last, m.index), code: m[1]! });
    last = m.index + m[0].length;
  }
  return out;
}

const NOM = /data-[a-z0-9]+(?:-[a-z0-9]+)*/g;

/** La colonne « Sur ». */
export function lireSur(brut: string): Sur {
  const sur: Sur = { brut, balises: [], stricte: false, avec: [], attrsSelecteur: [], enfants: [], conseilles: [], images: 0, media: false };
  const t = brut.trim();
  for (const m of t.matchAll(/avec `(data-[a-z0-9-]+)`/g)) sur.avec.push(m[1]!);
  for (const m of t.matchAll(/`\[(data-[a-z0-9-]+)\]`/g)) sur.conseilles.push(`[${m[1]}]`);
  const codes = spans(t).map((s) => s.code);
  const premier = codes[0];
  if (premier && !sur.avec.length) {
    const sel = premier.match(/^([a-z]+)\[(data-[a-z0-9-]+)\]$/);
    const bal = premier.match(/^([a-z]+)(?: type="([a-z]+)")?$/);
    if (sel) {
      sur.balises.push(sel[1]!);
      sur.attrsSelecteur.push(sel[2]!);
    } else if (bal && t.startsWith("`")) {
      sur.balises.push(bal[1]!);
      sur.stricte = ["html", "img", "input"].includes(bal[1]!);
    } else if (/^conteneur d'`img`/.test(t)) sur.enfants.push("img");
  }
  const MOTS: Record<string, string[]> = { lien: ["a"], "lien, bouton": ["a", "button"], section: ["section"], nav: ["nav"] };
  if (MOTS[t]) sur.balises.push(...MOTS[t]!);
  if (/deux images/.test(t)) sur.images = 2;
  if (/une img ou une vidéo/.test(t)) sur.media = true;
  return sur;
}

/** Retire les parenthèses complètes d'un intervalle de texte. */
const sansParentheses = (s: string) => {
  let t = s;
  for (let i = 0; i < 4; i++) t = t.replace(/\([^()]*\)/g, "");
  return t;
};
/** Entre deux éléments d'une liste : ponctuation, « ou », « et », « avec », « sur », rien d'autre. */
const separateurDeListe = (gap: string) => /^[\s,:=()—+/]*(?:(?:ou|et|avec|sur)[\s,:=()—+/]+)*[\s,:=()—+/]*$/.test(sansParentheses(gap));
/** Une frontière : point-virgule, fin de phrase. */
const frontiere = (gap: string) => /;|\.(\s|$)/.test(gap);

type Mention = { nom: string; valeur?: string };

/** Les noms `data-…` d'un span (`[data-vague-vers="a|b"]`, `section[data-diapo-slide]`, `data-goo-x/y`). */
function mentionsDuSpan(code: string): Mention[] {
  const out: Mention[] = [];
  for (const m of code.matchAll(/(data-[a-z0-9]+(?:-[a-z0-9]+)*)(?:\/([a-z]+))?(?:="([^"]*)")?/g)) {
    const nom = m[1]!;
    out.push({ nom, valeur: m[3] });
    if (m[2]) out.push({ nom: nom.replace(/-[a-z0-9]+$/, `-${m[2]}`) });
  }
  return out;
}

export function lireCatalogue(racine: string): Catalogue {
  const md = fs.readFileSync(path.join(racine, "PRESSE.md"), "utf8").split("\n");
  const code = lireCode(racine);
  const attributs = new Map<string, Attribut>();
  const lignes: Ligne[] = [];
  const autres = new Set<string>();

  const attr = (nom: string, n: number, documente = true): Attribut => {
    let a = attributs.get(nom);
    if (!a) {
      a = { nom, documente, lignesMd: [], lignes: [], parents: [], parentsFaibles: [], valeurs: [], exemples: [], libre: [], valeurRequise: false, code: code.get(nom) ?? [] };
      attributs.set(nom, a);
    }
    if (documente) a.documente = true;
    if (n && !a.lignesMd.includes(n)) a.lignesMd.push(n);
    return a;
  };

  // 1. Les lignes d'attributs (première colonne : un `data-…`), où qu'elles soient.
  let section = "";
  let fence = false;
  md.forEach((brute, i) => {
    const n = i + 1;
    if (/^```/.test(brute)) fence = !fence;
    if (fence) return;
    if (/^## /.test(brute)) section = brute.slice(3).trim();
    const c = cellules(brute);
    if (c.length < 3 || /^-+$/.test(c[0]!.replace(/[:\s]/g, ""))) return;
    const col1 = spans(c[0]!).map((s) => s.code);
    for (const s of col1) if (/^(\?|--)/.test(s)) autres.add(s.replace(/=.*$/, ""));
    if (!col1.length || !col1[0]!.startsWith("data-")) return;
    const sur = lireSur(c[1]!);
    const premier = col1[0]!.replace(/=.*$/, "");
    const racineCourte = sur.avec[0] ?? premier;
    const noms: string[] = [];
    const valeursCol1: string[] = [];
    let abrege = false;
    for (const s of col1) {
      const m = s.match(/^(-?[a-z0-9-]+)(?:="([^"]*)")?$/);
      if (!m) continue;
      let nom = m[1]!;
      if (nom.startsWith("-")) {
        nom = racineCourte + nom;
        abrege = true;
      }
      if (!nom.startsWith("data-")) continue;
      noms.push(nom);
      if (m[2] !== undefined) valeursCol1.push(m[2]);
    }
    if (!noms.length) return;
    lignes.push({ n, section, noms, principal: noms[0]!, valeursCol1, sur, texte: c.slice(2).join(" | "), options: abrege || sur.avec.length > 0, abrege });
  });

  const principaux = new Set(lignes.flatMap((l) => l.noms));
  const estPrincipal = (nom: string) => principaux.has(nom);

  // 2. Chaque ligne : noms, contexte, valeurs, options citées.
  for (const L of lignes) {
    const ctxSur: Contexte = { type: "sur", sur: L.sur };
    for (const nom of L.noms) {
      const a = attr(nom, L.n);
      a.lignes.push(L);
      for (const p of L.sur.avec) if (!a.parents.includes(p)) a.parents.push(p);
      const mod = L.texte.match(/`src\/presse\/([a-z-]+)\.ts`/)?.[1] ?? (fs.existsSync(path.join(racine, `src/presse/${nom.replace(/^data-/, "")}.ts`)) ? nom.replace(/^data-/, "") : undefined);
      if (mod && !a.module && !L.options) a.module = mod;
    }
    // Les marqueurs cités dans la colonne « Sur » (« piste `[data-rail-piste]` ») : des options du module.
    for (const m of L.sur.brut.matchAll(NOM)) {
      if (L.noms.includes(m[0]) || estPrincipal(m[0])) continue;
      const a = attr(m[0], L.n);
      const cible = L.noms.some((p) => m[0].startsWith(`${p}-`)) ? a.parents : a.parentsFaibles;
      for (const p of L.noms) if (!cible.includes(p)) cible.push(p);
    }
    const sp = spans(L.texte);
    // Énumération principale : les mots simples avant la première option citée (pas pour une ligne d'options).
    const principale: string[] = [...L.valeursCol1];
    let d = 0;
    let saute = Infinity;
    for (const { avant, code: s } of sp) {
      d = profondeur(avant, d);
      if (d < saute) saute = Infinity;
      const autre = mentionsDuSpan(s).some((m) => !L.noms.includes(m.nom)) || /^-[a-z]/.test(s);
      // Une option citée entre parenthèses (« sauf `data-transition-dur`) : `zoom` … ») n'arrête pas la liste ; ses
      // propres valeurs (« (`data-metal-forme` : `anneau`, … ») sont sautées jusqu'à la parenthèse fermante.
      if (autre && d === 0) break;
      if (autre) saute = Math.min(saute, d);
      else if (d < saute && estValeur(s)) principale.push(s);
    }
    // Enfants requis, dits dans la colonne « Effet » : « ses `[data-goo-item]` », « des `[data-vague-vue]` »,
    // « chaque `section[data-diapo-slide]` », « chaque `img` », « Empile `[data-derriere-fond]` ».
    for (const { avant, code: s } of sp) {
      if (!/(?:^|\s)(ses|des|chaque|Empile)\s*$/.test(avant)) continue;
      const m = s.match(/^([a-z]*)\[(data-[a-z0-9-]+)\]$/);
      const sel = m ? `${m[1]}[${m[2]}]` : s === "img" ? "img" : null;
      if (sel && (!m || m[2]!.startsWith(`${L.principal}-`)) && !L.sur.enfants.includes(sel)) L.sur.enfants.push(sel);
    }
    for (const nom of L.noms) {
      const a = attributs.get(nom)!;
      if (!L.abrege && principale.length) a.valeurs.push({ valeurs: [...new Set(principale)], contexte: ctxSur, source: `PRESSE.md:${L.n}` });
      else if (L.valeursCol1.length) a.valeurs.push({ valeurs: L.valeursCol1, contexte: ctxSur, source: `PRESSE.md:${L.n}` });
      else a.libre.push(ctxSur);
    }
    lireOptions(L.texte, L.n, L, true);
  }

  // 3. Les options citées : `-x` (abrégé sur la racine courante), `data-x`, et la liste de valeurs qui les suit.
  function lireOptions(texte: string, n: number, L: Ligne | null, enumerer: boolean) {
    const sp = spans(texte);
    let racineAbr = L?.principal ?? "";
    let courant: string | null = null;
    let liste: string[] = [];
    let d = 0;
    let dMention = 0;
    const fermer = () => {
      if (courant && liste.length && enumerer) {
        const a = attributs.get(courant)!;
        const ctx: Contexte = L && courant.startsWith(`${L.principal}-`) ? { type: "dans", attrs: L.noms } : { type: "partout" };
        a.valeurs.push({ valeurs: [...new Set(liste)], contexte: ctx, source: `PRESSE.md:${n}` });
      }
      courant = null;
      liste = [];
      dMention = 0;
    };
    for (const { avant, code: s } of sp) {
      d = profondeur(avant, d);
      // Une frontière, ou la parenthèse qui contenait l'option se referme.
      if (frontiere(avant) || d < dMention) fermer();
      // Abrégé : `-quand` → data-cinetique-quand ; après `--rouleau-corps`, `-encre` est une variable CSS.
      let ms = mentionsDuSpan(s);
      const abr = s.match(/^-([a-z][a-z0-9-]*)(?:="([^"]*)")?$/);
      if (abr) {
        if (racineAbr.startsWith("--") || !racineAbr) {
          fermer();
          continue;
        }
        ms = [{ nom: choisirAbrege(racineAbr, abr[1]!, code), valeur: abr[2] }];
      }
      if (/^(--|\?)/.test(s)) {
        fermer();
        autres.add(s.replace(/=.*$/, ""));
        if (s.startsWith("--")) racineAbr = s.replace(/-[a-z0-9]+$/, "");
        continue;
      }
      if (ms.length) {
        fermer();
        for (const m of ms) {
          const a = attr(m.nom, n);
          if (L && !L.noms.includes(m.nom) && !estPrincipal(m.nom)) {
            const fort = L.noms.some((p) => m.nom.startsWith(`${p}-`)) || (L.principal.split("-").length > 2 && m.nom.startsWith(`${L.principal.replace(/-[a-z0-9]+$/, "")}-`));
            const cible = fort ? a.parents : a.parentsFaibles;
            for (const p of L.noms) if (!cible.includes(p)) cible.push(p);
          }
          if (m.valeur !== undefined) {
            if (m.valeur.includes("|")) {
              if (enumerer) a.valeurs.push({ valeurs: m.valeur.split("|"), contexte: { type: "partout" }, source: `PRESSE.md:${n}` });
            } else if (/^(id|nom|rang)$/.test(m.valeur)) a.valeurRequise = true;
            else a.exemples.push(m.valeur);
          }
          courant = m.nom;
          dMention = d;
        }
        if (!s.startsWith("data-") && !s.startsWith("[") && !abr) courant = null; // `<a data-rouleau-img>` : une balise, pas une option suivie de valeurs
        const last = ms.at(-1)!.nom;
        if (L && (last === L.principal || last.startsWith(`${L.principal}-`))) racineAbr = L.principal;
        continue;
      }
      if (courant && estValeur(s) && separateurDeListe(avant)) {
        liste.push(s);
        continue;
      }
      if (courant && liste.length && !separateurDeListe(avant)) fermer();
      else if (courant && !liste.length && !separateurDeListe(avant)) fermer();
    }
    fermer();
  }

  // 4. Le reste du document (hors blocs de code) : les noms cités sont connus ; les listes ne comptent que dans le kit
  //    de sections (`data-space` (`serre`, …)) et sa prose, pas dans la feuille de route.
  section = "";
  fence = false;
  let para: string[] = [];
  let debut = 0;
  const vider = () => {
    if (para.length) lireOptions(para.join(" "), debut, null, section === "Le kit de sections");
    para = [];
  };
  md.forEach((brute, i) => {
    if (/^```/.test(brute)) {
      vider();
      fence = !fence;
      return;
    }
    if (fence) return;
    if (/^#{2,} /.test(brute)) {
      vider();
      if (/^## /.test(brute)) section = brute.slice(3).trim();
      return;
    }
    if (/^\s*\|/.test(brute)) {
      vider();
      if (!lignes.some((l) => l.n === i + 1)) lireOptions(brute, i + 1, null, section === "Le kit de sections");
      return;
    }
    if (!brute.trim()) return vider();
    if (!para.length) debut = i + 1;
    para.push(brute);
  });
  vider();

  // 5. Valeurs : compléments, exemples cités.
  for (const [nom, c] of Object.entries(COMPLEMENTS)) {
    const a = attributs.get(nom);
    if (!a) continue;
    const plus = [...(c.valeurs ?? []), ...(c.valeursDe ? (attributs.get(c.valeursDe)?.valeurs.flatMap((v) => v.valeurs) ?? []) : [])];
    if (plus.length) a.valeurs.push({ valeurs: plus, contexte: { type: "partout" }, source: `complément (${c.pourquoi})` });
  }
  for (const a of attributs.values()) {
    if (a.valeurs.length && a.exemples.length) a.valeurs.push({ valeurs: [...new Set(a.exemples)], contexte: { type: "partout" }, source: "exemples de PRESSE.md" });
    // Un attribut principal (nommé en première colonne) n'a pas de parent faible.
    if (estPrincipal(a.nom)) a.parentsFaibles = [];
  }

  // 6. Les attributs du code, absents de PRESSE.md.
  for (const [nom, fichiers] of code) if (!attributs.has(nom)) attributs.set(nom, { nom, documente: false, lignesMd: [], lignes: [], parents: [], parentsFaibles: [], valeurs: [], exemples: [], libre: [], valeurRequise: false, code: fichiers });

  const { armement, imports } = lireArmement(racine);
  // Les attributs que pages-nav arme d'eux-mêmes (data-roule, data-marque…) sont des composants, pas des options.
  for (const ar of armement) for (const nom of ar.attrs) {
    const a = attributs.get(nom);
    if (a) a.parentsFaibles = [];
  }
  return { racine, attributs, lignes, autres: [...autres], armement, importsPagesNav: imports };
}

/** `-retour` dans la ligne de data-dechirure-coupe : data-dechirure-coupe-retour, ou data-dechirure-retour si c'est celui que le code lit. */
function choisirAbrege(racine: string, suffixe: string, code: Map<string, string[]>): string {
  const candidats: string[] = [];
  for (let r = racine; r.split("-").length >= 2 && r !== "data"; r = r.replace(/-[a-z0-9]+$/, "")) candidats.push(`${r}-${suffixe}`);
  return candidats.find((c) => code.has(c)) ?? candidats[0]!;
}

/* ───────────────────────── Le code ───────────────────────── */

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Les attributs `data-*` que le code lit ou pose (chaînes `data-…` et `dataset.xxx`). */
export function lireCode(racine: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const fichiers: string[] = [];
  const parcourir = (dir: string) => {
    const abs = path.join(racine, dir);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== "essais") parcourir(rel);
      else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) fichiers.push(rel);
    }
  };
  for (const d of ["src/presse", "src/gpu", "src/components"]) parcourir(d);
  fichiers.push("src/pages-nav.ts");
  for (const f of fichiers) {
    const abs = path.join(racine, f);
    if (!fs.existsSync(abs)) continue;
    const t = fs.readFileSync(abs, "utf8");
    const noms = new Set<string>();
    for (const m of t.matchAll(NOM)) if (!/[-$]$/.test(m[0]) && t[m.index! + m[0].length] !== "$") noms.add(m[0]);
    for (const m of t.matchAll(/dataset\.([a-zA-Z]+)/g)) noms.add(`data-${kebab(m[1]!)}`);
    for (const m of t.matchAll(/dataset\[["']([a-zA-Z]+)["']\]/g)) noms.add(`data-${kebab(m[1]!)}`);
    for (const nom of noms) out.set(nom, [...(out.get(nom) ?? []), f]);
  }
  return out;
}

/* ───────────────────────── Armement (src/registre/effets.ts) ───────────────────────── */

/**
 * Ce que src/pages-nav.ts arme de lui-même, lu dans le registre (plus de lecture du code de pages-nav) : chaque
 * manifeste donne son module, les attributs de son sélecteur et s'il cède la main à `data-presse-manuel` ; `TOUJOURS`
 * liste les modules que pages-nav importe statiquement. `racine` est gardé pour la signature.
 */
export function lireArmement(_racine?: string): { armement: Armement[]; imports: string[] } {
  const armement = EFFETS.map((e) => ({
    module: e.id,
    attrs: [...e.selecteur.matchAll(/\[([a-z0-9-]+)\]/g)].map((x) => x[1]!),
    sansManuel: !!e.manuel,
  }));
  return { armement, imports: [...TOUJOURS] };
}

/* ───────────────────────── Pour les autres outils ───────────────────────── */

/** Toutes les valeurs connues d'un attribut, contextes confondus (pour les messages et le tableau du skill). */
export function toutesValeurs(a: Attribut): string[] {
  return [...new Set(a.valeurs.flatMap((v) => v.valeurs))];
}

/** Distance d'édition (Levenshtein). */
export function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

/** Le plus proche parmi `parmi`, si assez proche. */
export function proche(v: string, parmi: Iterable<string>, seuil = Math.max(2, Math.floor(v.length / 4))): string | null {
  let best: string | null = null;
  let bd = Infinity;
  for (const c of parmi) {
    if (c === v) continue;
    const d = distance(v, c);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return bd <= seuil ? best : null;
}
