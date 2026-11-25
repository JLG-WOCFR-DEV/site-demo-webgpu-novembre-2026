#!/usr/bin/env node
// Presse — la CLI `presse` : piloter le framework depuis un terminal (ou un agent) sans lire la doc. Tout vient du
// registre et des outils du dépôt, par le cœur commun tools/presse/coeur.ts (le serveur MCP, tools/presse/mcp.mjs,
// en est l'autre face). `presse --aide` pour l'aide.
//
// Codes de sortie : 0 succès ; 1 constat (erreurs de validation, budget dépassé avec --strict, ajout qui introduit
// une erreur) ; 2 demande refusée (commande, option, effet ou réglage inconnu, chemin hors du dépôt) ; 3 introuvable
// (page, build) ; 4 erreur interne.
import fs from "node:fs";
import path from "node:path";
import * as coeur from "./coeur.ts";
import { rapport } from "../valider/valider.ts";
import { tableauBudgets } from "../valider/budget.ts";

const AIDE = `presse — le framework Presse en ligne de commande (registre : src/registre/effets.ts)

Usage : presse <commande> [arguments] [--json] [--racine <dossier>]
        npm run -s presse -- <commande> …        (-s : sans l'en-tête de npm, utile avec --json)

Lecture
  effets [--categorie <c>]          les effets du registre (id, nom, catégorie, rendu, statut, coût)
  effet <id>                        un effet : armement, attributs documentés, paramètres, coût, démo
  chercher <texte…> [--limite <n>]  recherche floue : effets, attributs data-*, courbes
  parametres <id>                   les réglages de la fiche Studio (clé, attribut, genre, défaut, bornes)
  valider [page] [--strict]         le validateur de pages (toutes celles de vite.config.ts sans page)
           [--sans-mouvement] [--sans-budget]
  courbes [<courbe> [t…]]           les préréglages ; avec une courbe (nom, cubic-bezier(), steps(), linear()) :
                                    ses valeurs en t (défaut : 0, 0.1 … 1)
  budget [page] [--strict]          le budget JS gzip par page (lu sur le dernier build : npm run build)
  audit [page]                      le lint statique du mouvement (une page, ou tout le dépôt)

Écriture
  ajouter <page> <effet>            ajoute un effet à une page — APERÇU (diff) par défaut, rien n'est écrit
      --option <cle>=<valeur>       un réglage de la fiche (clé ou attribut data-*), répétable
      --sur <sélecteur>             poser l'effet sur un élément existant (sinon : insérer la démo de la fiche)
      --dans <sélecteur>            où insérer la démo (défaut : main, sinon body)
      --css                         ajouter aussi la feuille de la démo dans <head>
      --ecrire                      écrire pour de bon (refusé si l'ajout introduit une erreur du validateur)
      --forcer                      avec --ecrire : écrire malgré les erreurs introduites
  installer-skill [--cible <dossier>]
                                    copie .claude/skills/presse-page/ dans <dossier> (défaut : le dossier courant)
                                    et y écrit (ou complète) un .mcp.json qui déclare le serveur MCP presse

Serveur MCP (stdio) : node tools/presse/mcp.mjs  —  dans Claude Code : claude mcp add presse -- node tools/presse/mcp.mjs

Codes de sortie : 0 succès · 1 constat (erreurs, dépassement avec --strict, ajout fautif) · 2 refus (inconnu, chemin)
· 3 introuvable (page, build) · 4 erreur interne`;

const VALEURS = new Set(["--option", "--sur", "--dans", "--cible", "--racine", "--limite", "--categorie"]);
const DRAPEAUX = new Set(["--json", "--ecrire", "--css", "--strict", "--sans-mouvement", "--sans-budget", "--forcer", "--aide", "-h"]);

/** Les arguments : positionnels, drapeaux, options à valeur (`--x v` ou `--x=v`), `--option` répétable. */
function lireArgs(argv) {
  const pos = [];
  const drap = new Set();
  const val = new Map();
  const options = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("-") || a === "-") {
      pos.push(a);
      continue;
    }
    const [nom, egal] = a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
    if (DRAPEAUX.has(nom) && egal === undefined) drap.add(nom);
    else if (VALEURS.has(nom)) {
      const v = egal ?? argv[++i];
      if (v === undefined) throw new coeur.ErreurPresse("usage", `${nom} attend une valeur`);
      if (nom === "--option") options.push(v);
      else val.set(nom, v);
    } else throw new coeur.ErreurPresse("usage", `option inconnue : ${nom} (presse --aide)`);
  }
  return { pos, drap, val, options };
}

const RACINE_SCRIPT = coeur.RACINE_DEPOT;
let json = false;
const sortir = (code) => process.exit(code);
const afficher = (objet, texte) => console.log(json ? JSON.stringify(objet, null, 2) : texte());

const ko = (n) => (n === null || n === undefined ? "—" : `${String(n).replace(".", ",")} ko`);
const colonnes = (lignes) => {
  const l = lignes.map((r) => r.map(String));
  const w = l[0].map((_, i) => Math.max(...l.map((r) => r[i].length)));
  return l.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(w[i]))).join("  ")).join("\n");
};

async function main() {
  const argv = process.argv.slice(2);
  json = argv.includes("--json");
  const { pos, drap, val, options } = lireArgs(argv);
  const racine = path.resolve(val.get("--racine") ?? RACINE_SCRIPT);
  const [cmd, ...reste] = pos;
  if (!cmd || drap.has("--aide") || drap.has("-h") || cmd === "aide") {
    console.log(AIDE);
    return 0;
  }
  const un = (quoi) => {
    if (!reste[0]) throw new coeur.ErreurPresse("usage", `${cmd} : ${quoi} manquant (presse --aide)`);
    return reste[0];
  };

  switch (cmd) {
    case "effets": {
      let l = coeur.listerEffets();
      const c = val.get("--categorie");
      if (c) l = l.filter((e) => e.categorie === c);
      afficher(l, () => colonnes([["id", "nom", "catégorie", "rendu", "statut", "GPU", "JS", "différé"], ...l.map((e) => [e.id, e.nom, e.categorie, e.rendu, e.statut, e.cout.gpu, ko(e.cout.js), ko(e.cout.differe)])]) + `\n\n${l.length} effet(s). presse effet <id> pour le détail.`);
      return 0;
    }
    case "effet": {
      const d = await coeur.decrireEffet(un("identifiant d'effet"), racine);
      afficher(d, () => {
        const L = [`${d.nom} (${d.id}) — ${d.resume}`, ""];
        L.push(`Catégorie ${d.categorie} · rendu ${d.rendu} · statut ${d.statut} · GPU ${d.cout.gpu} · JS ${ko(d.cout.js)} (+ ${ko(d.cout.differe)} différés)`);
        L.push(`Armement : ${d.armement}`, `Sélecteur : ${d.selecteur}`, `Module : ${d.module}`, `Exemple : ${d.exemple ?? "—"} · Studio : ${d.studio}`);
        if (d.renduSansGpu) L.push(`Sans carte graphique : ${d.renduSansGpu}`);
        if (d.minimale) L.push(`Fiche minimale : ${d.minimale}`);
        L.push("", "Attributs (PRESSE.md) :");
        for (const a of d.attributs) L.push(`  ${a.nom}${a.valeurs.length ? ` : ${a.valeurs.join(", ")}` : ""}${a.valeurRequise ? " (valeur requise)" : ""}${a.documente ? "" : "  [non documenté]"}`);
        if (d.parametres.length) L.push("", `Paramètres (${d.parametres.length}) : presse parametres ${d.id}`);
        if (d.demo) L.push("", "Démo :", d.demo.html);
        return L.join("\n");
      });
      return 0;
    }
    case "chercher": {
      if (!reste.length) throw new coeur.ErreurPresse("usage", "chercher : texte manquant");
      const limite = Number(val.get("--limite") ?? 20);
      if (!Number.isInteger(limite) || limite < 1) throw new coeur.ErreurPresse("usage", "--limite : un entier ≥ 1");
      const r = coeur.chercher(reste.join(" "), racine, limite);
      afficher(r, () => (r.length ? colonnes(r.map((x) => [x.genre, x.id, x.texte.length > 90 ? `${x.texte.slice(0, 89)}…` : x.texte])) : "Rien trouvé."));
      return 0;
    }
    case "parametres": {
      const p = await coeur.parametresEffet(un("identifiant d'effet"));
      afficher(p, () => {
        const borne = (x) => (x.min !== undefined ? `${x.min}–${x.max}${x.pas ? ` pas ${x.pas}` : ""}${x.unite ? ` ${x.unite}` : ""}` : x.options ? x.options.join("|") : "");
        const L = p.parametres.length ? [colonnes([["clé", "attribut", "genre", "défaut", "valeurs", "groupe"], ...p.parametres.map((x) => [x.cle, x.attribut + (x.cible ? ` (sur ${x.cible})` : ""), x.type, x.auto ? `auto : ${x.auto}` : JSON.stringify(x.defaut), borne(x), x.groupe ?? ""])])] : ["Aucun paramètre réglable."];
        if (p.prereglages) L.push("", `Préréglages (${p.prereglages.cle}) : ${p.prereglages.valeurs.join(", ")}`);
        if (p.minimale) L.push("", `Fiche minimale : ${p.minimale}`);
        L.push("", `Régler : presse ajouter <page> ${p.id} --option <clé>=<valeur>`);
        return L.join("\n");
      });
      return 0;
    }
    case "valider": {
      const v = coeur.valider(racine, reste[0] ?? null, { mouvement: !drap.has("--sans-mouvement"), budget: !drap.has("--sans-budget") });
      afficher(v, () => [...v.pages.map((p) => rapport(p.page, p.constats)), "", `${v.pages.length} page(s) : ${v.erreurs} erreur(s), ${v.avertissements} avertissement(s).`].join("\n"));
      return v.erreurs || (drap.has("--strict") && v.avertissements) ? 1 : 0;
    }
    case "courbes": {
      if (reste[0]) {
        const ts = reste.slice(1).map(Number);
        const r = coeur.evaluerCourbe(reste[0], ts.length ? ts : undefined);
        afficher(r, () => [`${r.courbe} → ${r.css}`, ...r.points.map((p) => `  t=${p.t.toFixed(2)}  ${p.valeur.toFixed(4)}  ${"█".repeat(Math.max(0, Math.round(p.valeur * 40)))}`)].join("\n"));
        return 0;
      }
      const l = coeur.courbes();
      afficher(l, () => colonnes([["nom", "famille", "libellé", "css"], ...l.map((c) => [c.nom, c.famille, c.libelle, c.css && c.css.length > 60 ? `${c.css.slice(0, 59)}…` : c.css ?? "—"])]) + "\n\npresse courbes <nom> [t…] pour l'évaluer.");
      return 0;
    }
    case "budget": {
      const b = coeur.budget(racine, reste[0] ?? null);
      afficher(b, () => `${tableauBudgets(b.pages)}\n\n${b.pages.length} page(s), ${b.depassements} au-delà du budget.`);
      return drap.has("--strict") && b.depassements ? 1 : 0;
    }
    case "audit": {
      const a = coeur.auditMouvement(racine, reste[0] ?? null);
      afficher(a, () => {
        const L = [`${a.constats.length} constat(s) sur ${a.pages} page(s).`, ""];
        if (a.parRegle.length) L.push(colonnes([["priorité", "règle", "nombre"], ...a.parRegle.map((r) => [`P${r.priorite}`, r.regle, r.nombre])]), "");
        for (const c of a.constats.slice(0, 40)) L.push(`  [${c.regle}] ${c.fichier}:${c.ligne} ${c.ou} — ${c.extrait}`);
        if (a.constats.length > 40) L.push(`  … ${a.constats.length - 40} de plus (--json, ou npm run mouvement:audit pour le rapport complet)`);
        return L.join("\n");
      });
      return 0;
    }
    case "ajouter": {
      const [page, effet] = reste;
      if (!page || !effet) throw new coeur.ErreurPresse("usage", "ajouter <page> <effet> [--option cle=valeur …] (presse --aide)");
      const reglages = {};
      for (const o of options) {
        const i = o.indexOf("=");
        if (i < 1) throw new coeur.ErreurPresse("usage", `--option attend cle=valeur (reçu « ${o} »)`);
        reglages[o.slice(0, i)] = o.slice(i + 1);
      }
      const a = await coeur.ajouterEffetAPage(racine, page, effet, { reglages, sur: val.get("--sur"), dans: val.get("--dans"), css: drap.has("--css") });
      let ecrit = false;
      let refus = null;
      if (drap.has("--ecrire")) {
        if (!a.diff) refus = "rien à écrire";
        else if (!a.ecrivable && !drap.has("--forcer")) refus = "l'ajout introduit une erreur du validateur (corriger, ou --forcer)";
        else {
          const c = coeur.verifierAvantEcriture(racine, a.page, a.empreinteAvant);
          fs.writeFileSync(c.abs, a.apres);
          ecrit = true;
        }
      }
      const { apres, ...sansContenu } = a;
      afficher({ ...sansContenu, ecrit, refus }, () => {
        const L = [a.diff || "(aucun changement)"];
        if (a.corrections.length) L.push("Corrections :", ...a.corrections.map((c) => `  ${c}`));
        if (a.notes.length) L.push("Notes :", ...a.notes.map((n) => `  ${n}`));
        if (a.nouveaux.length) L.push("Constats introduits :", ...a.nouveaux.map((c) => `  ${c.gravite === "erreur" ? "✗" : "!"} ${c.regle} l.${c.ligne} ${c.element} ${c.message}`));
        L.push(ecrit ? `Écrit : ${a.page}.` : refus ? `Non écrit : ${refus}.` : "Aperçu seulement : --ecrire pour écrire.");
        return L.join("\n");
      });
      if (refus && refus !== "rien à écrire") return 1;
      return a.ecrivable || ecrit ? 0 : 1;
    }
    case "installer-skill": {
      const cible = path.resolve(val.get("--cible") ?? process.cwd());
      if (!fs.existsSync(cible) || !fs.statSync(cible).isDirectory()) throw new coeur.ErreurPresse("absent", `dossier introuvable : ${cible}`);
      const source = path.join(racine, ".claude/skills/presse-page");
      const dest = path.join(cible, ".claude/skills/presse-page");
      const fichiers = [];
      if (path.resolve(source) !== path.resolve(dest)) {
        fs.mkdirSync(dest, { recursive: true });
        fs.cpSync(source, dest, { recursive: true });
        for (const f of fs.readdirSync(dest, { recursive: true })) fichiers.push(path.join(dest, String(f)));
      }
      const mcpJson = path.join(cible, ".mcp.json");
      let conf = { mcpServers: {} };
      if (fs.existsSync(mcpJson)) {
        try {
          conf = JSON.parse(fs.readFileSync(mcpJson, "utf8"));
        } catch {
          throw new coeur.ErreurPresse("usage", `${mcpJson} n'est pas du JSON : le corriger d'abord`);
        }
        conf.mcpServers ??= {};
      }
      conf.mcpServers.presse = { type: "stdio", command: "node", args: [path.join(racine, "tools/presse/mcp.mjs"), "--racine", racine] };
      fs.writeFileSync(mcpJson, `${JSON.stringify(conf, null, 2)}\n`);
      fichiers.push(mcpJson);
      const commande = `claude mcp add presse -- node ${path.join(racine, "tools/presse/mcp.mjs")} --racine ${racine}`;
      afficher({ cible, skill: path.resolve(source) === path.resolve(dest) ? "déjà en place (dépôt Presse)" : dest, fichiers, commande }, () => [`Skill : ${path.resolve(source) === path.resolve(dest) ? "déjà en place" : dest}`, `MCP : ${mcpJson} (serveur « presse »)`, `Ou, sans .mcp.json : ${commande}`].join("\n"));
      return 0;
    }
    default:
      throw new coeur.ErreurPresse("usage", `commande inconnue : ${cmd} (presse --aide)`, ["effets", "effet", "chercher", "parametres", "valider", "courbes", "budget", "audit", "ajouter", "installer-skill"].find((c) => c.startsWith(cmd.slice(0, 3))) ?? null);
  }
}

try {
  sortir(await main());
} catch (e) {
  if (e instanceof coeur.ErreurPresse) {
    if (json) console.log(JSON.stringify({ erreur: { code: e.code, message: e.message, suggestion: e.suggestion } }, null, 2));
    else console.error(`presse : ${e.message}`);
    sortir(e.code === "absent" ? 3 : 2);
  }
  if (json) console.log(JSON.stringify({ erreur: { code: "interne", message: String(e?.message ?? e) } }));
  console.error(e?.stack ?? e);
  sortir(4);
}
