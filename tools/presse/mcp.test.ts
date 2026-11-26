/**
 * Le serveur MCP presse (tools/presse/mcp.mjs), lancé pour de vrai sur stdio : poignée de main initialize, liste des
 * outils (schémas stricts), un appel de chaque outil en lecture, les ressources, le cycle préparer → confirmer sur une
 * copie temporaire du dépôt, et les refus (jeton rejoué, expiré, page changée, chemin hors du dépôt, arguments).
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { RACINE_DEPOT } from "./coeur.ts";
import { copierDepot, PAGE_ESSAI } from "./depot-temporaire.ts";

const MCP = path.join(RACINE_DEPOT, "tools/presse/mcp.mjs");
const tmp = copierDepot();

type Reponse = { jsonrpc: "2.0"; id: number | null; result?: any; error?: { code: number; message: string } };

/** Un client minimal : une requête, sa réponse (par id) ; les lignes sans id (erreurs de lecture) à part. */
function client(racine: string, env: Record<string, string> = {}) {
  const p: ChildProcessWithoutNullStreams = spawn(process.execPath, [MCP, "--racine", racine], { env: { ...process.env, ...env } });
  let tampon = "";
  let id = 0;
  const attentes = new Map<number, (r: Reponse) => void>();
  const orphelines: Reponse[] = [];
  const lignes: string[] = [];
  p.stdout.setEncoding("utf8");
  p.stdout.on("data", (m: string) => {
    tampon += m;
    let n;
    while ((n = tampon.indexOf("\n")) >= 0) {
      const l = tampon.slice(0, n);
      tampon = tampon.slice(n + 1);
      lignes.push(l);
      const r = JSON.parse(l) as Reponse;
      const f = typeof r.id === "number" ? attentes.get(r.id) : undefined;
      if (f) (attentes.delete(r.id as number), f(r));
      else orphelines.push(r);
    }
  });
  const envoyer = (o: unknown) => p.stdin.write(`${typeof o === "string" ? o : JSON.stringify(o)}\n`);
  const requete = (method: string, params?: unknown) =>
    new Promise<Reponse>((ok, ko) => {
      const n = ++id;
      const minuterie = setTimeout(() => ko(new Error(`pas de réponse à ${method}`)), 15000);
      attentes.set(n, (r) => (clearTimeout(minuterie), ok(r)));
      envoyer({ jsonrpc: "2.0", id: n, method, ...(params === undefined ? {} : { params }) });
    });
  const outil = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await requete("tools/call", { name, arguments: args });
    assert.ok(r.result, `${name} : ${r.error?.message}`);
    return r.result as { content: { type: string; text: string }[]; structuredContent?: any; isError: boolean };
  };
  const fermer = () => new Promise<void>((ok) => (p.once("exit", () => ok()), p.stdin.end()));
  return { requete, outil, envoyer, fermer, orphelines, lignes, processus: p };
}

const serveur = client(tmp.racine);
after(async () => {
  await serveur.fermer();
  tmp.nettoyer();
});

const LECTURES = ["effets", "effet", "chercher", "parametres", "valider", "courbes", "budget", "audit_mouvement"];

test("mcp : initialize, notification initialized sans réponse, ping", async () => {
  const r = await serveur.requete("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "essai", version: "0" } });
  assert.equal(r.result.protocolVersion, "2025-06-18");
  assert.equal(r.result.serverInfo.name, "presse");
  assert.ok(r.result.capabilities.tools && r.result.capabilities.resources);
  assert.match(r.result.instructions, /ajouter_preparer/);
  const avant = serveur.lignes.length;
  serveur.envoyer({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.deepEqual((await serveur.requete("ping")).result, {});
  assert.equal(serveur.lignes.length, avant + 1, "la notification n'a pas de réponse");
  const vieux = await serveur.requete("initialize", { protocolVersion: "1999-01-01", capabilities: {}, clientInfo: { name: "x", version: "0" } });
  assert.equal(vieux.result.protocolVersion, "2025-06-18", "version inconnue : la plus récente");
});

test("mcp : tools/list — dix outils, descriptions en français, schémas stricts", async () => {
  const { result } = await serveur.requete("tools/list");
  const noms = result.tools.map((t: { name: string }) => t.name);
  assert.deepEqual(noms.sort(), [...LECTURES, "ajouter_preparer", "ajouter_confirmer"].sort());
  for (const t of result.tools) {
    assert.equal(t.inputSchema.type, "object");
    assert.equal(t.inputSchema.additionalProperties, false, t.name);
    assert.ok(Array.isArray(t.inputSchema.required));
    assert.ok(t.description.length > 40 && /[éèàç]/.test(t.description), `${t.name} : description en français`);
    assert.equal(typeof t.annotations.readOnlyHint, "boolean");
  }
  assert.equal(result.tools.find((t: { name: string }) => t.name === "ajouter_confirmer").annotations.readOnlyHint, false);
  assert.ok(result.tools.filter((t: { name: string }) => LECTURES.includes(t.name)).every((t: { annotations: { readOnlyHint: boolean } }) => t.annotations.readOnlyHint));
});

test("mcp : un appel de chaque outil en lecture", async () => {
  const json = (r: { content: { text: string }[] }) => JSON.parse(r.content[0]!.text);
  const effets = await serveur.outil("effets");
  assert.equal(effets.isError, false);
  assert.ok(json(effets).some((e: { id: string }) => e.id === "goo"));
  assert.ok(Array.isArray(effets.structuredContent.resultats));
  assert.equal(json(await serveur.outil("effets", { categorie: "texte" })).every((e: { categorie: string }) => e.categorie === "texte"), true);
  assert.equal(json(await serveur.outil("effet", { id: "goo" })).module, "src/presse/goo.ts");
  assert.equal(json(await serveur.outil("chercher", { texte: "dechirure", limite: 3 }))[0].id, "dechirure");
  assert.ok(json(await serveur.outil("parametres", { id: "forme" })).parametres.length >= 5);
  const v = await serveur.outil("valider", { page: "goo.html" });
  assert.equal(v.isError, false);
  assert.equal(v.structuredContent.erreurs, 0);
  assert.ok(json(await serveur.outil("courbes")).some((c: { nom: string }) => c.nom === "ui-sortie"));
  assert.deepEqual(json(await serveur.outil("courbes", { courbe: "lineaire", t: [0.5] })).points, [{ t: 0.5, valeur: 0.5 }]);
  const b = await serveur.outil("budget", { page: "goo.html" });
  assert.equal(b.isError, true, "la copie n'est pas construite");
  assert.match(b.content[0]!.text, /^\[absent\].*npm run build/);
  assert.equal(json(await serveur.outil("audit_mouvement", { page: "goo.html" })).pages, 1);
});

test("mcp : budget sur le dépôt construit", async (t) => {
  if (!fs.existsSync(path.join(RACINE_DEPOT, "dist/.vite/manifest.json"))) return t.skip("dépôt non construit");
  const s = client(RACINE_DEPOT);
  const b = await s.outil("budget", { page: "goo.html" });
  assert.equal(b.isError, false);
  assert.equal(b.structuredContent.pages[0].page, "goo.html");
  await s.fermer();
});

test("mcp : ressources — skill presse-page, catalogue, registre", async () => {
  const { result } = await serveur.requete("resources/list");
  assert.deepEqual(result.resources.map((r: { uri: string }) => r.uri).sort(), ["presse://catalogue", "presse://registre", "presse://skill/presse-page"]);
  const skill = await serveur.requete("resources/read", { uri: "presse://skill/presse-page" });
  assert.equal(skill.result.contents[0].mimeType, "text/markdown");
  assert.match(skill.result.contents[0].text, /^---\nname: presse-page/);
  const cat = JSON.parse((await serveur.requete("resources/read", { uri: "presse://catalogue" })).result.contents[0].text);
  assert.equal(cat.version, 1);
  assert.ok(cat.attributes.some((a: { name: string }) => a.name.includes("data-goo")));
  assert.equal(JSON.parse((await serveur.requete("resources/read", { uri: "presse://registre" })).result.contents[0].text).length, 19);
  assert.equal((await serveur.requete("resources/read", { uri: "presse://rien" })).error?.code, -32002);
  assert.deepEqual((await serveur.requete("resources/templates/list")).result, { resourceTemplates: [] });
});

test("mcp : écriture en deux étapes — préparer (rien d'écrit), confirmer (écrit), jeton rejoué refusé", async () => {
  const abs = path.join(tmp.racine, PAGE_ESSAI);
  const avant = fs.readFileSync(abs, "utf8");
  const p = await serveur.outil("ajouter_preparer", { page: PAGE_ESSAI, effet: "forme", reglages: { taille: 0.6, quand: "entree" } });
  assert.equal(p.isError, false, p.content[0]!.text);
  const s = p.structuredContent;
  assert.match(s.jeton, /^[0-9a-f]{32}$/);
  assert.ok(Date.parse(s.expire) - Date.now() > 4 * 60 * 1000, "valable 5 minutes");
  assert.match(s.diff, /^\+.*data-forme-taille="0.6"/m);
  assert.equal(p.content[1]!.text, s.diff, "le diff, lisible, en second bloc");
  assert.equal(s.apres, undefined);
  assert.equal(fs.readFileSync(abs, "utf8"), avant, "préparer n'écrit rien");
  const c = await serveur.outil("ajouter_confirmer", { jeton: s.jeton });
  assert.equal(c.isError, false, c.content[0]!.text);
  assert.equal(c.structuredContent.ecrit, PAGE_ESSAI);
  assert.match(fs.readFileSync(abs, "utf8"), /data-forme-taille="0.6"/);
  const rejoue = await serveur.outil("ajouter_confirmer", { jeton: s.jeton });
  assert.equal(rejoue.isError, true);
  assert.match(rejoue.content[0]!.text, /déjà employé/);
  const invente = await serveur.outil("ajouter_confirmer", { jeton: "0".repeat(32) });
  assert.equal(invente.isError, true);
  fs.writeFileSync(abs, avant);
});

test("mcp : refus — page changée entre préparer et confirmer, ajout fautif sans jeton", async () => {
  const abs = path.join(tmp.racine, PAGE_ESSAI);
  const avant = fs.readFileSync(abs, "utf8");
  const p = (await serveur.outil("ajouter_preparer", { page: PAGE_ESSAI, effet: "cinetique", sur: "h1" })).structuredContent;
  fs.writeFileSync(abs, `${avant}<!-- touché -->\n`);
  const c = await serveur.outil("ajouter_confirmer", { jeton: p.jeton });
  assert.equal(c.isError, true);
  assert.match(c.content[0]!.text, /a changé depuis l'aperçu/);
  assert.equal(fs.readFileSync(abs, "utf8"), `${avant}<!-- touché -->\n`);
  fs.writeFileSync(abs, avant);
  const fautif = await serveur.outil("ajouter_preparer", { page: "cinetique.html", effet: "forme" });
  assert.equal(fautif.isError, false);
  assert.equal(fautif.structuredContent.jeton, null);
  assert.match(fautif.structuredContent.raison, /erreur du validateur/);
});

test("mcp : jeton expiré", async () => {
  const s = client(tmp.racine, { PRESSE_MCP_JETON_MS: "1" });
  const abs = path.join(tmp.racine, PAGE_ESSAI);
  const avant = fs.readFileSync(abs, "utf8");
  const p = (await s.outil("ajouter_preparer", { page: PAGE_ESSAI, effet: "forme" })).structuredContent;
  await new Promise((ok) => setTimeout(ok, 30));
  const c = await s.outil("ajouter_confirmer", { jeton: p.jeton });
  assert.equal(c.isError, true);
  assert.match(c.content[0]!.text, /expiré/);
  assert.equal(fs.readFileSync(abs, "utf8"), avant);
  await s.fermer();
});

test("mcp : chemins hors du dépôt refusés, en lecture comme en écriture", async () => {
  for (const page of ["../goo.html", "../../../etc/passwd.html", "/etc/hosts", path.join(RACINE_DEPOT, "goo.html"), "node_modules/vite/index.html", "dist/index.html", "src/presse/goo.ts"]) {
    const r = await serveur.outil("ajouter_preparer", { page, effet: "forme" });
    assert.equal(r.isError, true, page);
    assert.match(r.content[0]!.text, /^\[chemin\]/, page);
    const v = await serveur.outil("valider", { page });
    assert.equal(v.isError, true, page);
  }
});

test("mcp : protocole — arguments invalides, outil ou méthode inconnus, JSON illisible", async () => {
  const extra = await serveur.requete("tools/call", { name: "effet", arguments: { id: "goo", bonus: 1 } });
  assert.equal(extra.error?.code, -32602);
  assert.match(extra.error!.message, /propriété inconnue/);
  assert.equal((await serveur.requete("tools/call", { name: "effet", arguments: {} })).error?.code, -32602);
  assert.equal((await serveur.requete("tools/call", { name: "effet", arguments: { id: "gooo" } })).error?.code, -32602);
  assert.equal((await serveur.requete("tools/call", { name: "chercher", arguments: { texte: "x", limite: 1.5 } })).error?.code, -32602);
  assert.equal((await serveur.requete("tools/call", { name: "ajouter_confirmer", arguments: { jeton: "../x" } })).error?.code, -32602);
  assert.equal((await serveur.requete("tools/call", { name: "ajouter_preparer", arguments: { page: PAGE_ESSAI, effet: "forme", reglages: { taille: [1] } } })).error?.code, -32602);
  assert.equal((await serveur.requete("tools/call", { name: "ecrire_partout", arguments: {} })).error?.code, -32602);
  assert.equal((await serveur.requete("tools/call", { name: "constructor", arguments: {} })).error?.code, -32602);
  assert.equal((await serveur.requete("prompts/list")).error?.code, -32601);
  const n = serveur.orphelines.length;
  serveur.envoyer("{ pas du json");
  await serveur.requete("ping");
  assert.equal(serveur.orphelines[n]?.error?.code, -32700);
});
