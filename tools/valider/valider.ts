/**
 * Presse — valider une page HTML contre le catalogue dérivé de PRESSE.md (tools/valider/catalogue.ts).
 *
 * Contrôles statiques, sans navigateur (le reste — mouvement, contraste réel, mise en page — est à `npm run check`) :
 *   attribut      inconnu (avec « vouliez-vous … »), ou lu par le code mais non documenté ;
 *   valeur        hors de l'énumération documentée pour ce contexte ; valeur obligatoire absente ;
 *   parent        option (`-par`, `-quand`…) sans son module sur l'élément ou un ancêtre ;
 *   collision     deux modules sur le même élément, ou attribut d'un module employé hors de lui ;
 *   structure     balise attendue, enfants requis (`[data-rail-piste]`, deux images…) ;
 *   armement      module employé mais chargé par personne (pages-nav, data-presse-manuel, script de la page) ;
 *   composant     balises `<x-…>` (schémas de presse/build/validate.ts) ;
 *   langue        `<html lang="fr">`, texte d'interface visiblement anglais ;
 *   image         `alt`, `width` / `height` ;
 *   libelle       cible interactive sans nom accessible ;
 *   id            identifiant en double (les références par id cassent).
 */
import fs from "node:fs";
import path from "node:path";
import { parse, type HTMLElement, type Node } from "node-html-parser";
import { SCHEMAS, validate as validerComposant } from "../../presse/build/validate.ts";
import { lireCourbe } from "../../src/registre/mouvement/courbes.ts";
import { COLLISIONS, COMPLEMENTS, proche, toutesValeurs, type Attribut, type Catalogue, type Contexte, type Sur } from "./catalogue.ts";

export type Gravite = "erreur" | "avertissement";
export type Constat = { gravite: Gravite; regle: string; ligne: number; element: string; message: string };

/* ───────────────────────── Outils DOM ───────────────────────── */

const ELEMENT = 1;
const TEXTE = 3;
const elements = (n: Node): HTMLElement[] => n.childNodes.filter((c): c is HTMLElement => c.nodeType === ELEMENT);
const balise = (el: HTMLElement) => (el.rawTagName ?? "").toLowerCase();
const attrs = (el: HTMLElement): [string, string][] => Object.entries(el.attributes).map(([k, v]) => [k.toLowerCase(), v]);
const a = (el: HTMLElement, nom: string): string | undefined => {
  for (const [k, v] of attrs(el)) if (k === nom) return v;
  return undefined;
};
const has = (el: HTMLElement, nom: string) => a(el, nom) !== undefined;
function* ancetresEtSoi(el: HTMLElement): Generator<HTMLElement> {
  for (let e: HTMLElement | null = el; e && e.rawTagName; e = e.parentNode as HTMLElement | null) yield e;
}
function* descendants(el: HTMLElement): Generator<HTMLElement> {
  for (const c of elements(el)) {
    yield c;
    yield* descendants(c);
  }
}
const decrire = (el: HTMLElement) => {
  const id = a(el, "id");
  const cls = a(el, "class")?.trim().split(/\s+/)[0];
  return `<${balise(el)}${id ? `#${id}` : cls ? `.${cls}` : ""}>`;
};

/** Le texte que lit un lecteur d'écran (approché) : sans les sous-arbres aria-hidden, avec les alt et les <title> de SVG. */
function texteAccessible(n: Node): string {
  if (n.nodeType === TEXTE) return n.rawText.replace(/&nbsp;/g, " ");
  if (n.nodeType !== ELEMENT) return "";
  const el = n as HTMLElement;
  if (a(el, "aria-hidden") === "true" || has(el, "hidden")) return "";
  const t = balise(el);
  if (t === "img") return a(el, "alt") ?? "";
  if (t === "script" || t === "style" || t === "template") return "";
  if (t === "svg") return elements(el).find((c) => balise(c) === "title")?.text ?? "";
  const lab = a(el, "aria-label");
  if (lab?.trim()) return lab;
  return n.childNodes.map(texteAccessible).join(" ");
}

/* ───────────────────────── Le contrôle ───────────────────────── */

type Options = { fichier?: string };

export function validerHtml(html: string, cat: Catalogue, opts: Options = {}): Constat[] {
  const fichier = opts.fichier ?? path.join(cat.racine, "page.html");
  const doc = parse(html, { comment: false, blockTextElements: { script: true, noscript: true, style: true, pre: true } });
  const debuts = [0];
  for (let i = 0; i < html.length; i++) if (html[i] === "\n") debuts.push(i + 1);
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
  const out: Constat[] = [];
  const dire = (gravite: Gravite, regle: string, el: HTMLElement | null, message: string) =>
    out.push({ gravite, regle, ligne: el ? ligneDe(el.range[0]) : 1, element: el ? decrire(el) : "", message });

  const tous = [...descendants(doc)];
  const racineHtml = tous.find((e) => balise(e) === "html") ?? null;
  const ids = new Map<string, HTMLElement[]>();
  for (const el of tous) {
    const id = a(el, "id");
    if (id) ids.set(id, [...(ids.get(id) ?? []), el]);
  }
  const parId = (v: string) => ids.get(v.replace(/^#/, ""))?.[0] ?? null;
  const selection = (sel: string): HTMLElement[] => {
    try {
      return doc.querySelectorAll(sel);
    } catch {
      return [];
    }
  };
  const documentes = [...cat.attributs.values()].filter((x) => x.documente).map((x) => x.nom);
  // Pour « vouliez-vous » hors préfixe Presse : seulement les modules et leurs options (pas data-id, data-gl… cités en prose).
  const familles = [...cat.attributs.values()].filter((x) => x.documente && (x.lignes.length || x.parents.length)).map((x) => x.nom);
  const prefixes = documentes.map((d) => `${d}-`);
  // Un nom « de Presse » : préfixe du moteur, d'un attribut documenté, ou d'un module armé par pages-nav (data-trace-…),
  // ou lu par pages-nav lui-même (data-pages-trigger).
  const armes = cat.armement.flatMap((x) => x.attrs.map((n) => `${n}-`));
  const candidat = (nom: string) =>
    nom.startsWith("data-gl-") || nom.startsWith("data-presse-") || prefixes.some((p) => nom.startsWith(p)) || armes.some((p) => nom.startsWith(p)) || !!cat.attributs.get(nom)?.code.includes("src/pages-nav.ts");
  const moduleDe = (nom: string) => cat.attributs.get(nom)?.module ?? cat.armement.find((x) => x.attrs.includes(nom))?.module;
  const dansComposant = (el: HTMLElement) => [...ancetresEtSoi(el)].some((e) => balise(e).startsWith("x-"));
  const enfantsVides = (el: HTMLElement) =>
    [el, ...descendants(el)].some((d) => /^(ul|ol|div|section|tbody|template|main)$/.test(balise(d)) && !elements(d).length && !d.text.trim());

  /* ── scripts de la page ── */
  const erreursScripts: string[] = [];
  const { graphe, entrees } = grapheScripts(doc, fichier, cat.racine, (m) => erreursScripts.push(m));
  for (const m of erreursScripts) dire("erreur", "armement", null, m);
  // Le code Presse qui tourne sur cette page : ce que ses scripts importent (hors leurs propres fichiers d'entrée),
  // et les modules que pages-nav charge parce que la page s'en sert.
  const charges = new Set([...graphe].filter((f) => !entrees.has(f)));
  if (graphe.has("src/pages-nav.ts")) for (const ar of cat.armement) if (ar.attrs.some((x) => tous.some((e) => has(e, x)))) charges.add(`src/presse/${ar.module}.ts`);

  /* ── attributs data-* ── */
  const modulesUtilises = new Map<string, HTMLElement>();
  for (const el of tous) {
    for (const [nom, valeur] of attrs(el)) {
      if (!nom.startsWith("data-")) continue;
      const at = cat.attributs.get(nom);
      if (!at) {
        if (candidat(nom)) {
          const s = proche(nom, cat.attributs.keys());
          dire("erreur", "attribut", el, `${nom} : attribut inconnu de Presse${s ? ` — vouliez-vous « ${s} » ?` : ""}`);
        } else {
          const s = nom.length >= 10 ? proche(nom, familles, nom.length >= 14 ? 2 : 1) : null;
          // À une lettre d'un module ou d'une de ses options : une faute de frappe, pas un attribut de la page.
          if (s) dire("erreur", "attribut", el, `${nom} : attribut inconnu — vouliez-vous « ${s} » ? (si c'est un attribut propre à la page, choisissez un nom moins proche)`);
        }
        continue;
      }
      if (!at.documente) {
        if (candidat(nom) || cat.armement.some((x) => x.attrs.includes(nom)))
          dire("avertissement", "attribut", el, `${nom} : lu par le code (${at.code.join(", ")}) mais absent de PRESSE.md — trou de la documentation (ou un état posé par le module : ne pas l'écrire)`);
        else {
          // Attribut de la page dont le nom est aussi lu par du code Presse : collision seulement si ce code tourne ici.
          const lus = at.code.filter((f) => charges.has(f));
          if (lus.length) dire("avertissement", "collision", el, `${nom} : attribut de la page, mais ${lus.join(", ")} (chargé par cette page) lit aussi ce nom — renommez-le`);
        }
        continue;
      }
      if (at.module) modulesUtilises.set(at.module, modulesUtilises.get(at.module) ?? el);
      verifierValeur(el, at, valeur);
      if (!dansComposant(el)) verifierParent(el, at, valeur);
      verifierStructure(el, at);
    }
    for (const ar of cat.armement) if (ar.attrs.some((x) => has(el, x)) && !modulesUtilises.has(ar.module)) modulesUtilises.set(ar.module, el);
    for (const c of COLLISIONS)
      if (has(el, c.a) && has(el, c.b)) dire(c.grave ? "erreur" : "avertissement", "collision", el, `${c.a} et ${c.b} sur le même élément : ${c.pourquoi}`);
    // Composants <x-…>.
    const t = balise(el);
    if (t.startsWith("x-")) {
      const nomC = t.slice(2);
      if (!SCHEMAS[nomC]) {
        const s = proche(nomC, Object.keys(SCHEMAS), 2);
        dire("erreur", "composant", el, `<${t}> : composant inconnu${s ? ` — vouliez-vous « x-${s} » ?` : ""}`);
      } else for (const m of validerComposant(nomC, Object.fromEntries(attrs(el)))) dire("erreur", "composant", el, `<${t}> : ${m}`);
    }
  }

  function contexteVrai(ctx: Contexte, el: HTMLElement): boolean | null {
    if (ctx.type === "partout") return null;
    if (ctx.type === "dans") return [...ancetresEtSoi(el)].some((e) => ctx.attrs.some((x) => has(e, x)));
    return surVrai(ctx.sur, el);
  }
  function surVrai(sur: Sur, el: HTMLElement): boolean | null {
    if (sur.avec.length) return sur.avec.some((x) => has(el, x));
    if (sur.attrsSelecteur.length) return sur.balises.includes(balise(el)) && sur.attrsSelecteur.every((x) => has(el, x));
    if (sur.balises.length) return sur.balises.includes(balise(el));
    return null;
  }

  function verifierValeur(el: HTMLElement, at: Attribut, valeur: string) {
    const comp = COMPLEMENTS[at.nom];
    const v = valeur.trim();
    if (!v) {
      if (at.valeurRequise) dire("erreur", "valeur", el, `${at.nom} : valeur obligatoire (PRESSE.md:${at.lignesMd[0]})`);
      if (comp?.texteOuValeur && !el.text.trim()) dire("erreur", "valeur", el, `${at.nom} : ni valeur ni texte — le mot est obligatoire`);
      return;
    }
    if (comp?.courbe) {
      // Une courbe : un nom (liste documentée ou bibliothèque) ou cubic-bezier(), steps(), linear().
      const l = lireCourbe(v);
      if (!l.ok) dire("erreur", "valeur", el, `${at.nom}="${v}" : ${l.erreur} (un nom comme out, in-out, out-rebond, ou cubic-bezier(), steps(), linear())`);
      return;
    }
    if (at.libre.some((c) => contexteVrai(c, el) !== false)) return;
    const jeux = at.valeurs.filter((j) => contexteVrai(j.contexte, el) !== false);
    if (!jeux.length) return;
    const permis = new Set(jeux.flatMap((j) => j.valeurs));
    if (comp?.pistes && /[\s;]/.test(v)) return;
    for (const t of v.split(/\s+/)) {
      if (permis.has(t)) continue;
      if (permis.has("rang") && /^\d+$/.test(t)) continue;
      if (comp?.ouvertId && parId(t)) continue;
      const s = proche(t, permis, Math.max(2, Math.floor(t.length / 3)));
      const liste = [...permis].filter((x) => x !== "rang");
      dire("erreur", "valeur", el, `${at.nom}="${v}" : « ${t} » n'est pas une valeur documentée${s ? ` — vouliez-vous « ${s} » ?` : ""} (possibles : ${liste.join(", ")}${permis.has("rang") ? ", un rang" : ""}${comp?.ouvertId ? ", ou l'id d'un élément de la page" : ""})`);
    }
  }

  function verifierParent(el: HTMLElement, at: Attribut, valeur: string) {
    const memeElement = [...new Set(at.lignes.flatMap((l) => l.sur.avec))];
    if (memeElement.length) {
      if (!memeElement.some((p) => has(el, p))) dire("erreur", "parent", el, `${at.nom} demande ${memeElement.join(" ou ")} sur le même élément (PRESSE.md:${at.lignesMd[0]})`);
      return;
    }
    const forts = at.parents;
    const faibles = at.parentsFaibles;
    const parents = [...forts, ...faibles];
    if (!parents.length) return;
    const ancetres = [...ancetresEtSoi(el)];
    if (ancetres.some((e) => parents.some((p) => has(e, p)))) return;
    if (COMPLEMENTS[at.nom]?.parentsSelecteurs?.some((sel) => ancetres.some((e) => selection(sel).includes(e)))) return;
    // Une référence : la valeur désigne le module (id, sélecteur, ou valeur sœur : data-metal-reflet="nom" ↔ data-metal-nom="nom").
    const porteParent = (e: HTMLElement) => [...ancetresEtSoi(e)].some((x) => parents.some((p) => has(x, p)));
    const v = valeur.trim();
    if (v) {
      const cibles = [parId(v), ...(/^[#.[]/.test(v) ? selection(v) : []), ...tous.filter((e) => e !== el && attrs(e).some(([k, w]) => w === v && parents.some((p) => k.startsWith(`${p}-`) || k.startsWith(`${p.replace(/-[a-z]+$/, "")}-`))))];
      if (cibles.some((c) => c && porteParent(c))) return;
    }
    // …ou le module la désigne (data-rail-barre="#nouv-barre" sur le rail, data-rail-barre seul sur la barre).
    const id = a(el, "id");
    if (id && tous.some((e) => parents.some((p) => has(e, p)) && attrs(e).some(([, w]) => w.split(/[\s,]+/).includes(`#${id}`) || w === id))) return;
    // Parent proche : un autre attribut du même module (data-dechirure-graine sur data-dechirure-coupe,
    // data-cinetique-delai sur data-marque, composant de cinetique.ts).
    const mods = new Set(forts.map(moduleDe).filter(Boolean));
    const voisin = mods.size ? ancetres.flatMap((e) => attrs(e).map(([k]) => k)).find((k) => k !== at.nom && !forts.includes(k) && mods.has(moduleDe(k)) && !cat.attributs.get(k)?.lignes.some((l) => l.options)) : undefined;
    if (voisin) {
      dire("avertissement", "parent", el, `${at.nom} : PRESSE.md le documente pour ${forts.join(", ")}, pas pour ${voisin}${at.code.length ? ` (le code le lit : ${at.code.join(", ")} — trou de la documentation)` : ""}`);
      return;
    }
    if (forts.length) dire("erreur", "parent", el, `${at.nom} : option sans son module — ${forts.join(" ou ")} attendu sur l'élément ou un ancêtre (PRESSE.md:${at.lignesMd[0]})`);
    else dire("avertissement", "collision", el, `${at.nom} est un attribut de ${faibles.join(", ")} (PRESSE.md:${at.lignesMd[0]}) ; hors de ce module Presse l'ignore — si c'est un attribut de la page, renommez-le pour éviter la collision`);
  }

  function verifierStructure(el: HTMLElement, at: Attribut) {
    const lignes = at.lignes.filter((l) => !l.options);
    if (!lignes.length) return;
    // La balise attendue.
    const contraintes = lignes.filter((l) => l.sur.balises.length && !l.sur.avec.length);
    if (contraintes.length && contraintes.length === lignes.length && !contraintes.some((l) => surVrai(l.sur, el))) {
      const strict = contraintes.some((l) => l.sur.stricte);
      dire(strict ? "erreur" : "avertissement", "structure", el, `${at.nom} attend ${[...new Set(contraintes.map((l) => `« ${l.sur.brut.replace(/`/g, "")} »`))].join(" ou ")}, pas <${balise(el)}>${strict ? " : il y est ignoré" : ""}`);
    }
    for (const l of lignes) {
      const manque: string[] = [];
      for (const sel of l.sur.enfants) if (!el.querySelector(sel)) manque.push(sel);
      if (l.sur.images && el.querySelectorAll("img").length < l.sur.images) manque.push(`${l.sur.images} img`);
      if (l.sur.media && !el.querySelector("img, video")) manque.push("img ou video");
      const conseil = l.sur.conseilles.filter((sel) => !el.querySelector(sel));
      if (conseil.length) {
        if (enfantsVides(el)) dire("avertissement", "structure", el, `${at.nom} : ${conseil.join(", ")} absent du HTML — rempli par script ? (invérifiable ici)`);
        else dire("avertissement", "structure", el, `${at.nom} : pas de ${conseil.join(", ")} dedans — PRESSE.md l'attend (« ${l.sur.brut.replace(/`/g, "")} », l.${l.n}) ; le module se rabat peut-être sur un repli`);
      }
      if (!manque.length) continue;
      if (enfantsVides(el)) dire("avertissement", "structure", el, `${at.nom} : ${manque.join(", ")} absent du HTML — rempli par script ? (invérifiable ici ; sinon le module n'a rien à animer)`);
      else dire("erreur", "structure", el, `${at.nom} : il manque ${manque.join(", ")} dedans (PRESSE.md:${l.n})`);
    }
  }

  /* ── armement ── */
  if (modulesUtilises.size) {
    const manuel = racineHtml ? has(racineHtml, "data-presse-manuel") : false;
    const pagesNav = graphe.has("src/pages-nav.ts");
    for (const [mod, el] of modulesUtilises) {
      if (graphe.has(`src/presse/${mod}.ts`)) continue;
      const ar = cat.armement.find((x) => x.module === mod);
      if (pagesNav && ar && !(ar.sansManuel && manuel)) continue;
      if (pagesNav && cat.importsPagesNav.includes(mod)) continue;
      const pourquoi = !pagesNav
        ? "aucun script de la page n'importe src/pages-nav.ts ni le module"
        : ar
          ? "la page porte data-presse-manuel : pages-nav ne l'arme pas, et son script ne l'importe pas"
          : "pages-nav ne l'arme pas : le script de la page doit l'importer et l'initialiser";
      dire("erreur", "armement", el, `module ${mod} (src/presse/${mod}.ts) employé mais non armé — ${pourquoi}`);
    }
  }

  /* ── langue ── */
  const lang = racineHtml ? a(racineHtml, "lang") : undefined;
  if (!lang) dire("erreur", "langue", racineHtml, `<html> sans lang : écrire lang="fr"`);
  else if (!/^fr\b/i.test(lang)) dire("erreur", "langue", racineHtml, `<html lang="${lang}"> : le site est en français (lang="fr")`);
  // Le lang le plus proche fait foi (body lang="fr" sous html lang="en" : du français).
  const etranger = (el: HTMLElement) => {
    const chaine = [...ancetresEtSoi(el)];
    if (chaine.some((e) => /^(script|style|code|pre|kbd|samp|svg|template|noscript)$/.test(balise(e)))) return true;
    const l = chaine.map((e) => a(e, "lang")).find((x) => x !== undefined);
    return l !== undefined && !/^fr\b/i.test(l);
  };
  for (const el of tous) {
    if (etranger(el)) continue;
    const textes: [string, string][] = [];
    for (const c of el.childNodes) if (c.nodeType === TEXTE && c.rawText.trim()) textes.push(["texte", c.rawText.trim()]);
    for (const k of ["aria-label", "title", "alt", "placeholder"]) {
      const v = a(el, k);
      if (v?.trim()) textes.push([k, v.trim()]);
    }
    if (balise(el) === "input" && /^(button|submit|reset)$/.test(a(el, "type") ?? "")) textes.push(["value", a(el, "value") ?? ""]);
    for (const [ou, t] of textes) {
      const verdict = anglais(t);
      if (verdict) dire(verdict === "interface" ? "erreur" : "avertissement", "langue", el, `${ou === "texte" ? "texte" : ou} « ${t.slice(0, 60)} » : visiblement pas en français${verdict === "phrase" ? " (ajoutez lang=\"en\" si c'est voulu, une citation)" : ""}`);
    }
  }

  /* ── images ── */
  const manifeste = lireManifeste(cat.racine);
  for (const el of tous) {
    if (balise(el) !== "img") continue;
    if (!has(el, "alt")) dire("erreur", "image", el, `img sans alt (alt="" si elle est décorative)${a(el, "src") ? ` : ${a(el, "src")}` : ""}`);
    if (!has(el, "width") || !has(el, "height")) {
      const src = (a(el, "src") ?? "").replace(/^\.?\//, "");
      if (!manifeste.has(src)) dire("avertissement", "image", el, `img sans width/height (saut de mise en page ; la chaîne d'images ne les pose que pour public/img/manifest.json) : ${a(el, "src") ?? "?"}`);
    }
  }

  /* ── libellés ── */
  const labels = tous.filter((e) => balise(e) === "label");
  for (const el of tous) {
    const t = balise(el);
    const role = a(el, "role");
    const cible =
      (t === "a" && has(el, "href")) ||
      t === "button" ||
      t === "summary" ||
      t === "select" ||
      t === "textarea" ||
      (t === "input" && a(el, "type") !== "hidden") ||
      /^(button|link|tab|menuitem|checkbox|switch|slider)$/.test(role ?? "");
    if (!cible || has(el, "hidden") || [...ancetresEtSoi(el)].some((e) => a(e, "aria-hidden") === "true")) continue;
    let nom = a(el, "aria-label")?.trim() ?? "";
    if (!nom && a(el, "aria-labelledby")) nom = a(el, "aria-labelledby")!.split(/\s+/).map((id) => (parId(id) ? texteAccessible(parId(id)!) : "")).join(" ").trim();
    if (!nom && /^(input|select|textarea)$/.test(t)) {
      const id = a(el, "id");
      const lab = (id && labels.find((l) => a(l, "for") === id)) || [...ancetresEtSoi(el)].find((e) => balise(e) === "label");
      if (lab) nom = texteAccessible(lab).trim();
      if (!nom && t === "input" && /^(submit|reset|button|image)$/.test(a(el, "type") ?? "")) nom = a(el, "value") ?? a(el, "alt") ?? (a(el, "type") === "button" ? "" : "défaut");
      if (!nom && a(el, "placeholder")) {
        dire("avertissement", "libelle", el, `champ nommé par son seul placeholder (« ${a(el, "placeholder")} ») : ajoutez un <label>`);
        continue;
      }
    }
    if (!nom && !/^(input|select|textarea)$/.test(t)) nom = texteAccessible(el).replace(/\s+/g, " ").trim();
    if (!nom) nom = a(el, "title")?.trim() ?? "";
    if (nom) continue;
    if (/^(input|select|textarea)$/.test(t)) dire("erreur", "libelle", el, `champ sans libellé : <label for>, label englobant ou aria-label`);
    else if (!el.childNodes.length) dire("avertissement", "libelle", el, `cible vide dans le HTML, sans aria-label : remplie par script ? sinon, sans nom accessible`);
    else dire("erreur", "libelle", el, `cible sans nom accessible (texte, aria-label ou <label>) — une icône seule ne dit rien au lecteur d'écran`);
  }

  /* ── identifiants ── */
  for (const [id, els] of ids) if (els.length > 1) dire("erreur", "id", els[1]!, `id="${id}" en double (${els.length} fois) : les références (#${id}, for, aria-*) visent le premier`);

  return out.sort((x, y) => x.ligne - y.ligne);
}

/* ───────────────────────── Langue ───────────────────────── */

/** Libellés d'interface anglais courants (texte entier). */
const UI_ANGLAIS = new Set(
  "add to cart|cart|search|close|next|previous|prev|submit|send|loading|click here|read more|learn more|see more|view all|show more|show less|sign in|sign up|log in|login|logout|log out|home|back|play|open|settings|share|download|subscribe|contact us|about|about us|welcome|hello|buy now|shop now|checkout|wishlist|favorites|favourites|sort by|filter|filters|apply|cancel|delete|remove|edit|save|reset|toggle|skip to content|scroll|drag|swipe|explore|discover|more|less|yes|no|error|success|warning|replay|restart|tap|hover|menu close|open menu|close menu|dark mode|light mode|previous slide|next slide|copy|copied|undo|redo|zoom in|zoom out|fullscreen|exit fullscreen|mute|unmute".split("|"),
);
const EN = new Set("the and of to your with for is this that you are be it from by at an or our all click here what how why when which will can".split(" "));
const FR = new Set("le la les de des du un une et à au aux en pour sur dans par avec est que qui ne pas ce cette ces vous nous il elle ou se sa son ses d l qu j y".split(" "));

/** « interface » : un libellé anglais connu ; « phrase » : une phrase anglaise ; null : rien d'évident. */
export function anglais(t: string): "interface" | "phrase" | null {
  const s = t.toLowerCase().replace(/[.…!?:→←↓↑✕×+]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (UI_ANGLAIS.has(s)) return "interface";
  const mots = s.split(/[\s'’,;()«»"]+/).filter(Boolean);
  if (mots.length < 3) return null;
  const en = mots.filter((m) => EN.has(m)).length;
  const fr = mots.filter((m) => FR.has(m)).length;
  return en >= 2 && en > fr * 2 ? "phrase" : null;
}

/* ───────────────────────── Scripts de la page ───────────────────────── */

/** Les fichiers (relatifs à la racine) que la page charge statiquement : ses scripts module et leurs `import … from`. */
export function grapheScripts(doc: HTMLElement, fichier: string, racine: string, erreur: (m: string) => void): { graphe: Set<string>; entrees: Set<string> } {
  const vus = new Set<string>();
  const entrees = new Set<string>();
  const resoudre = (spec: string, depuis: string): string | null => {
    if (spec.startsWith("/")) return path.join(racine, spec);
    if (spec.startsWith(".")) return path.resolve(path.dirname(depuis), spec);
    return null; // paquet npm
  };
  const suivre = (abs: string) => {
    const rel = path.relative(racine, abs).split(path.sep).join("/");
    if (vus.has(rel) || !/\.(ts|js|mjs)$/.test(abs) || !fs.existsSync(abs)) return;
    vus.add(rel);
    lireImports(fs.readFileSync(abs, "utf8"), abs);
  };
  const lireImports = (src: string, depuis: string) => {
    for (const m of src.matchAll(/(?:^|[\n;])\s*(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/g)) {
      const abs = resoudre(m[1]!, depuis);
      if (abs) suivre(abs);
    }
  };
  for (const s of doc.querySelectorAll("script")) {
    if ((s.getAttribute("type") ?? "") !== "module") continue;
    const src = s.getAttribute("src");
    if (src) {
      const abs = resoudre(src, fichier);
      if (abs && !fs.existsSync(abs)) erreur(`script introuvable : ${src}`);
      else if (abs) {
        entrees.add(path.relative(racine, abs).split(path.sep).join("/"));
        suivre(abs);
      }
    } else lireImports(s.rawText, fichier);
  }
  return { graphe: vus, entrees };
}

function lireManifeste(racine: string): Set<string> {
  const p = path.join(racine, "public/img/manifest.json");
  try {
    return new Set(Object.keys(JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>));
  } catch {
    return new Set();
  }
}

export function validerFichier(fichier: string, cat: Catalogue): Constat[] {
  return validerHtml(fs.readFileSync(fichier, "utf8"), cat, { fichier: path.resolve(fichier) });
}

/** Rapport lisible. */
export function rapport(fichier: string, constats: Constat[]): string {
  const e = constats.filter((c) => c.gravite === "erreur").length;
  const w = constats.length - e;
  const lignes = [`${fichier} — ${e ? `${e} erreur${e > 1 ? "s" : ""}` : "aucune erreur"}, ${w} avertissement${w > 1 ? "s" : ""}`];
  // Un même constat sur plusieurs éléments : une ligne, avec les numéros de ligne.
  const groupes = new Map<string, Constat[]>();
  for (const c of constats) {
    const k = `${c.gravite}|${c.regle}|${c.message}`;
    groupes.set(k, [...(groupes.get(k) ?? []), c]);
  }
  for (const g of groupes.values()) {
    const c = g[0]!;
    const ou = g.length > 1 ? `${g.length}× (l.${[...new Set(g.map((x) => x.ligne))].slice(0, 6).join(", ")}${g.length > 6 ? "…" : ""})` : `l.${c.ligne}`;
    lignes.push(`  ${c.gravite === "erreur" ? "✗ erreur " : "! avert. "} ${ou.padEnd(7)} ${c.regle.padEnd(10)} ${g.length === 1 && c.element ? `${c.element} ` : ""}${c.message}`);
  }
  return lignes.join("\n");
}

export { toutesValeurs };
