#!/usr/bin/env node
// Presse — serveur MCP (stdio, JSON-RPC 2.0 délimité par des fins de ligne, écrit à la main : aucune dépendance).
// Les outils sont ceux de la CLI `presse`, par le même cœur (tools/presse/coeur.ts) : lecture (effets, effet,
// chercher, parametres, valider, courbes, budget, audit_mouvement) et une écriture en DEUX ÉTAPES —
// `ajouter_preparer` rend un diff et un jeton à usage unique (5 min), `ajouter_confirmer(jeton)` écrit. Aucune
// écriture sans jeton ; chemins confinés au dépôt (coeur.confiner). Ressources : le skill presse-page, le catalogue
// (presse-catalog.json, calculé comme au build) et le registre.
//
//   node tools/presse/mcp.mjs [--racine <dossier>]          Claude Code : claude mcp add presse -- node tools/presse/mcp.mjs
//   PRESSE_MCP_JETON_MS=<ms>  durée de vie d'un jeton (défaut 300000 ; les tests l'abaissent)
// Le journal va sur stderr ; stdout ne porte que le protocole.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import * as coeur from "./coeur.ts";

const i = process.argv.indexOf("--racine");
const RACINE = path.resolve(i > 0 ? process.argv[i + 1] : process.env.PRESSE_RACINE || coeur.RACINE_DEPOT);
const DUREE_JETON = Number(process.env.PRESSE_MCP_JETON_MS) || 5 * 60 * 1000;
const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const journal = (...m) => process.stderr.write(`[presse-mcp] ${m.join(" ")}\n`);

/* ── Schémas (stricts : additionalProperties false) et leur contrôle ── */
const obj = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const PAGE = { type: "string", minLength: 1, maxLength: 300, description: "Page HTML du dépôt, relative à sa racine (« goo.html », « src/x/page.html »)." };
const ID = { type: "string", enum: [...coeur.IDS_EFFETS], description: "Identifiant d'un effet du registre." };
const CATEGORIES = [...new Set(coeur.listerEffets().map((e) => e.categorie))];

function controler(s, v, ou = "arguments") {
  const t = Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) && s.type === "integer" ? "integer" : typeof v;
  if (s.type && s.type !== t && !(s.type === "number" && t === "integer")) return `${ou} : ${s.type} attendu`;
  if (s.enum && !s.enum.includes(v)) return `${ou} : valeur hors liste (${s.enum.slice(0, 20).join(", ")})`;
  if (t === "string" && ((s.minLength && v.length < s.minLength) || (s.maxLength && v.length > s.maxLength) || (s.pattern && !new RegExp(s.pattern).test(v)))) return `${ou} : chaîne invalide`;
  if ((t === "number" || t === "integer") && ((s.minimum !== undefined && v < s.minimum) || (s.maximum !== undefined && v > s.maximum))) return `${ou} : hors bornes`;
  if (t === "array") {
    if (s.maxItems !== undefined && v.length > s.maxItems) return `${ou} : ${s.maxItems} éléments au plus`;
    for (const [k, x] of v.entries()) { const e = controler(s.items ?? {}, x, `${ou}[${k}]`); if (e) return e; }
  }
  if (t === "object") {
    for (const r of s.required ?? []) if (!(r in v)) return `${ou}.${r} : requis`;
    for (const [k, x] of Object.entries(v)) {
      const sp = s.properties?.[k] ?? (typeof s.additionalProperties === "object" ? s.additionalProperties : null);
      if (!sp) return `${ou}.${k} : propriété inconnue`;
      const e = sp.anyOf ? (sp.anyOf.some((a) => !controler(a, x)) ? null : `${ou}.${k} : type invalide`) : controler(sp, x, `${ou}.${k}`);
      if (e) return e;
    }
  }
  return null;
}

/* ── Les jetons d'écriture : usage unique, durée limitée ── */
const jetons = new Map();
const LECTURE = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const OUTILS = {
  effets: { titre: "Effets du registre", description: "Liste les effets Presse du registre (src/registre/effets.ts) : id, nom, catégorie, rendu, statut, résumé, page d'exemple, coût GPU estimé et JS mesuré.", schema: obj({ categorie: { type: "string", enum: CATEGORIES } }), faire: (a) => coeur.listerEffets().filter((e) => !a.categorie || e.categorie === a.categorie) },
  effet: { titre: "Décrire un effet", description: "Tout sur un effet : armement, sélecteur, module, attributs data-* tels que PRESSE.md les documente (valeurs permises), paramètres de la fiche Studio, coût, démo HTML.", schema: obj({ id: ID }, ["id"]), faire: (a) => coeur.decrireEffet(a.id, RACINE) },
  chercher: { titre: "Chercher", description: "Recherche floue (sans accents, tolère une faute) dans les effets, les attributs data-* documentés et les courbes.", schema: obj({ texte: { type: "string", minLength: 1, maxLength: 200 }, limite: { type: "integer", minimum: 1, maximum: 50 } }, ["texte"]), faire: (a) => coeur.chercher(a.texte, RACINE, a.limite ?? 20) },
  parametres: { titre: "Paramètres d'un effet", description: "Les réglages de la fiche Studio d'un effet : clé, attribut data-* écrit, genre, défaut, bornes, options, condition. Les clés servent à ajouter_preparer.reglages.", schema: obj({ id: ID }, ["id"]), faire: (a) => coeur.parametresEffet(a.id) },
  valider: { titre: "Valider", description: "Le validateur de pages Presse (attributs, valeurs, armement, langue, images, mouvement, budget) sur une page, ou sur toutes celles de vite.config.ts sans « page ». Constats structurés : gravité, règle, ligne, élément, message.", schema: obj({ page: PAGE, mouvement: { type: "boolean" }, budget: { type: "boolean" } }), faire: (a) => coeur.valider(RACINE, a.page ?? null, { mouvement: a.mouvement, budget: a.budget }) },
  courbes: { titre: "Courbes", description: "Sans « courbe » : les préréglages de courbe (nom, famille, CSS). Avec : évalue la courbe (nom, cubic-bezier(), steps(), linear()) aux instants t (0–1).", schema: obj({ courbe: { type: "string", minLength: 1, maxLength: 2000 }, t: { type: "array", maxItems: 101, items: { type: "number", minimum: 0, maximum: 1 } } }), faire: (a) => (a.courbe ? coeur.evaluerCourbe(a.courbe, a.t?.length ? a.t : undefined) : coeur.courbes()) },
  budget: { titre: "Budget JS", description: "Le budget JavaScript gzip d'une page (ou de toutes) : statique, différé, seuil, effets armés. Lu sur le dernier build (dist/).", schema: obj({ page: PAGE }), faire: (a) => coeur.budget(RACINE, a.page ?? null) },
  audit_mouvement: { titre: "Audit du mouvement", description: "Le lint statique du mouvement (transition: all, ease-in, scale(0), durées, survol tactile, clavier…) sur une page ou tout le dépôt, avec priorités.", schema: obj({ page: PAGE }), faire: (a) => coeur.auditMouvement(RACINE, a.page ?? null) },
  ajouter_preparer: {
    titre: "Ajouter un effet (préparer)",
    description: "Prépare l'ajout d'un effet à une page SANS rien écrire : rend le diff, les attributs posés, les constats que l'ajout ferait naître, et un jeton à usage unique valable 5 minutes. Sans « sur », la démo de la fiche est insérée à la fin de « dans » (main, sinon body) ; avec « sur », l'effet est posé sur un élément existant. Pas de jeton si l'ajout introduit une erreur du validateur.",
    schema: obj({ page: PAGE, effet: ID, reglages: { type: "object", description: "Réglages par clé de paramètre (outil parametres) ou par attribut data-*.", additionalProperties: { anyOf: [{ type: "string", maxLength: 2000 }, { type: "number" }, { type: "boolean" }] } }, sur: { type: "string", minLength: 1, maxLength: 300 }, dans: { type: "string", minLength: 1, maxLength: 300 }, css: { type: "boolean" } }, ["page", "effet"]),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    faire: async (a) => {
      const r = await coeur.ajouterEffetAPage(RACINE, a.page, a.effet, { reglages: a.reglages, sur: a.sur, dans: a.dans, css: a.css });
      const { apres, ...vue } = r;
      if (!r.ecrivable) return { ...vue, jeton: null, raison: r.diff ? "l'ajout introduit une erreur du validateur : corriger les réglages ou la page" : "rien à écrire" };
      const jeton = randomBytes(16).toString("hex");
      const expire = Date.now() + DUREE_JETON;
      jetons.set(jeton, { page: r.page, empreinte: r.empreinteAvant, apres, expire });
      return { ...vue, jeton, expire: new Date(expire).toISOString() };
    },
  },
  ajouter_confirmer: {
    titre: "Ajouter un effet (confirmer)",
    description: "Écrit l'ajout préparé par ajouter_preparer. Le jeton ne sert qu'une fois et expire au bout de 5 minutes ; refusé aussi si la page a changé depuis la préparation.",
    schema: obj({ jeton: { type: "string", pattern: "^[0-9a-f]{32}$" } }, ["jeton"]),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    faire: (a) => {
      const j = jetons.get(a.jeton);
      jetons.delete(a.jeton);
      if (!j) throw new coeur.ErreurPresse("usage", "jeton inconnu ou déjà employé : refaire ajouter_preparer");
      if (Date.now() > j.expire) throw new coeur.ErreurPresse("usage", "jeton expiré : refaire ajouter_preparer");
      const c = coeur.verifierAvantEcriture(RACINE, j.page, j.empreinte);
      fs.writeFileSync(c.abs, j.apres);
      journal("écrit", c.rel);
      return { ecrit: c.rel, octets: Buffer.byteLength(j.apres) };
    },
  },
};

/* ── Ressources ── */
const RESSOURCES = {
  "presse://skill/presse-page": { name: "presse-page", title: "Skill presse-page", description: "Construire, modifier ou vérifier une page Presse (procédure, armement, mouvement, pièges, tableau intention → module).", mimeType: "text/markdown", lire: () => fs.readFileSync(path.join(RACINE, ".claude/skills/presse-page/SKILL.md"), "utf8") },
  "presse://catalogue": { name: "presse-catalog.json", title: "Catalogue Presse", description: "Composants <x-…>, attributs data-* et paramètres d'adresse, filtres d'image — calculé comme au build (presse/build/catalog.ts).", mimeType: "application/json", lire: async () => JSON.stringify((await import("../../presse/build/catalog.ts")).buildCatalog(RACINE).json, null, 2) },
  "presse://registre": { name: "registre", title: "Registre des effets", description: "Les effets du registre (src/registre/effets.ts), en JSON.", mimeType: "application/json", lire: () => JSON.stringify(coeur.listerEffets(), null, 2) },
};

/* ── Le protocole ── */
class ErreurRpc extends Error { constructor(code, message) { super(message); this.code = code; } }

async function traiter(methode, p = {}) {
  switch (methode) {
    case "initialize":
      return { protocolVersion: VERSIONS.includes(p.protocolVersion) ? p.protocolVersion : VERSIONS[0], capabilities: { tools: { listChanged: false }, resources: { listChanged: false } }, serverInfo: { name: "presse", title: "Presse", version: "1.0.0" }, instructions: "Framework Presse : HTML + attributs data-* armés par le registre. Lire la ressource presse://skill/presse-page, découvrir avec effets / effet / parametres, vérifier avec valider. Pour modifier une page : ajouter_preparer (diff + jeton), montrer le diff, puis ajouter_confirmer." };
    case "ping":
      return {};
    case "tools/list":
      return { tools: Object.entries(OUTILS).map(([name, o]) => ({ name, title: o.titre, description: o.description, inputSchema: o.schema, annotations: o.annotations ?? LECTURE })) };
    case "tools/call": {
      const o = Object.hasOwn(OUTILS, p.name) ? OUTILS[p.name] : null;
      if (!o) throw new ErreurRpc(-32602, `outil inconnu : ${p.name}`);
      const args = p.arguments ?? {};
      const e = controler(o.schema, args);
      if (e) throw new ErreurRpc(-32602, `${p.name} : ${e}`);
      try {
        const r = await o.faire(args);
        const content = [{ type: "text", text: JSON.stringify(r, null, 2) }];
        if (r?.diff) content.push({ type: "text", text: r.diff });
        return { content, structuredContent: Array.isArray(r) ? { resultats: r } : r, isError: false };
      } catch (err) {
        if (!(err instanceof coeur.ErreurPresse)) journal(err?.stack ?? err);
        return { content: [{ type: "text", text: `${err instanceof coeur.ErreurPresse ? `[${err.code}] ` : "[interne] "}${err?.message ?? err}` }], isError: true };
      }
    }
    case "resources/list":
      return { resources: Object.entries(RESSOURCES).map(([uri, r]) => ({ uri, name: r.name, title: r.title, description: r.description, mimeType: r.mimeType })) };
    case "resources/templates/list":
      return { resourceTemplates: [] };
    case "resources/read": {
      const r = Object.hasOwn(RESSOURCES, p.uri) ? RESSOURCES[p.uri] : null;
      if (!r) throw new ErreurRpc(-32002, `ressource inconnue : ${p.uri}`);
      return { contents: [{ uri: p.uri, mimeType: r.mimeType, text: await r.lire() }] };
    }
    default:
      throw new ErreurRpc(-32601, `méthode inconnue : ${methode}`);
  }
}

const envoyer = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
async function message(m) {
  if (!m || typeof m !== "object" || m.jsonrpc !== "2.0" || typeof m.method !== "string") {
    if (m && (m.result !== undefined || m.error !== undefined)) return; // une réponse du client : rien à faire
    return envoyer({ jsonrpc: "2.0", id: m?.id ?? null, error: { code: -32600, message: "requête JSON-RPC 2.0 invalide" } });
  }
  const notification = !("id" in m);
  try {
    const result = await traiter(m.method, m.params);
    if (!notification) envoyer({ jsonrpc: "2.0", id: m.id, result });
  } catch (e) {
    if (!notification) envoyer({ jsonrpc: "2.0", id: m.id, error: { code: e instanceof ErreurRpc ? e.code : -32603, message: String(e?.message ?? e) } });
  }
}

let tampon = "";
let file = Promise.resolve();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (morceau) => {
  tampon += morceau;
  let n;
  while ((n = tampon.indexOf("\n")) >= 0) {
    const ligne = tampon.slice(0, n).trim();
    tampon = tampon.slice(n + 1);
    if (!ligne) continue;
    let m;
    try {
      m = JSON.parse(ligne);
    } catch {
      file = file.then(() => envoyer({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON illisible" } }));
      continue;
    }
    // Dans l'ordre d'arrivée : une confirmation ne double jamais sa préparation.
    file = file.then(() => (Array.isArray(m) ? Promise.all(m.map(message)) : message(m)));
  }
});
process.stdin.on("end", () => file.then(() => process.exit(0)));
journal(`prêt — racine ${RACINE}`);
