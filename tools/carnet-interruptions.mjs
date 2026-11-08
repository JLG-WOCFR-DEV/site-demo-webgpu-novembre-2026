#!/usr/bin/env node
/**
 * Protocole d'interruptions (roadmap P1/P2), version automatique : ce qui a été annoncé
 * « Enregistré » survit à une page tuée (Page.crash), à un onglet fermé, à un navigateur fermé.
 *   npm run build && npm run preview   puis   node tools/carnet-interruptions.mjs [url]
 * Le téléphone garde sa recette manuelle (carnet-recette.html, § 5) : élimination par le système,
 * redémarrage, hors ligne.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = process.argv[2] ?? "http://127.0.0.1:8080/carnet.html";
const profile = mkdtempSync(join(tmpdir(), "carnet-int-"));
// Chromium de la machine si la version de Playwright du dépôt n'a pas le sien (même règle que tools/shot.mjs).
const pw = "/opt/pw-browsers";
const exe =
  [process.env.PLI_CHROMIUM, ...(existsSync(pw) ? readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d)).map((d) => `${pw}/${d}/chrome-linux64/chrome`) : [])].find((x) => x && existsSync(x)) ??
  chromium.executablePath();
/**
 * Un vrai processus Chromium sur un profil persistant, piloté par CDP : on peut le tuer net (SIGKILL),
 * comme le système tue une application en arrière-plan, puis le relancer sur le même profil.
 */
async function launch() {
  const proc = spawn(exe, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--disable-gpu", "--no-first-run", ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []), "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const ws = await new Promise((res, rej) => {
    let buf = "";
    proc.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\S+)/);
      if (m) res(m[1]);
    });
    proc.on("exit", () => rej(new Error("Chromium s'est arrêté au lancement")));
  });
  const browser = await chromium.connectOverCDP(ws);
  return { browser, ctx: browser.contexts()[0], kill: () => proc.kill("SIGKILL"), proc };
}
const results = [];
const ok = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "OK " : "KO "} ${name} — ${detail}`);
};

async function open(ctx) {
  const p = ctx.pages()[0] ?? (await ctx.newPage());
  await p.goto(URL);
  await p.waitForFunction(() => window.__carnet?.core);
  return p;
}
const count = (p) => p.evaluate(() => window.__carnet.core.all().filter((e) => e.text.startsWith("int ")).length);
/** Ajoute n entrées par la saisie, comme un utilisateur. */
async function type(p, n, tag) {
  const day = await p.evaluate(() => window.__carnet.ctx.now);
  for (let i = 0; i < n; i++) {
    await p.fill(`#in-w-${day}`, `. int ${tag} ${i}`);
    await p.press(`#in-w-${day}`, "Enter");
  }
}

let b = await launch();
let p = await open(b.ctx);

// 1. Navigateur tué net (SIGKILL) juste après une écriture annoncée, avec un lot en cours.
await type(p, 20, "a");
await p.waitForFunction(() => window.__carnet.store.state === "saved" && window.__carnet.store.waiting === 0);
const announced = await count(p);
await type(p, 5, "b"); // en cours : pas encore annoncées
b.kill();
await new Promise((r) => b.proc.on("exit", r));
b = await launch();
p = await open(b.ctx);
let after = await count(p);
ok("navigateur tué pendant l'usage", after >= announced, `annoncées ${announced}, retrouvées ${after} (dont du lot en cours : ${after - announced} / 5)`);

// 2. Onglet fermé pendant un lot (pagehide déclenche l'écriture).
const before2 = await count(p);
await type(p, 10, "c");
const p2 = await b.ctx.newPage(); // garder le navigateur ouvert
await p.close({ runBeforeUnload: true });
p = p2;
await p.goto(URL);
await p.waitForFunction(() => window.__carnet?.core);
after = await count(p);
ok("onglet fermé pendant un lot", after === before2 + 10, `avant ${before2}, +10 tapées, retrouvées ${after}`);

// 3. Navigateur fermé proprement puis rouvert.
const before3 = await count(p);
await b.browser.close();
b.kill();
await new Promise((r) => (b.proc.exitCode !== null ? r() : b.proc.on("exit", r)));
b = await launch();
p = await open(b.ctx);
after = await count(p);
ok("navigateur fermé et rouvert", after === before3, `avant ${before3}, retrouvées ${after}`);

// 4. Compaction, puis navigateur tué juste après : rien ne se perd.
await p.evaluate(() => window.__carnet.store.compact());
b.kill();
await new Promise((r) => b.proc.on("exit", r));
b = await launch();
p = await open(b.ctx);
after = await count(p);
ok("compaction puis navigateur tué", after === before3, `avant ${before3}, retrouvées ${after}`);

b.kill();
const pass = results.every((r) => r.pass);
console.log(JSON.stringify({ format: "carnet-interruptions/1", at: new Date().toISOString(), pass, results }, null, 2));
process.exit(pass ? 0 : 1);
