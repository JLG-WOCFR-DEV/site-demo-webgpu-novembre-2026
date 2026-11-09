#!/usr/bin/env node
/**
 * Carnet — parcours de bout en bout (fumée), sur la page construite :
 *   npm run build && npx vite preview --port 4317   puis   node tools/carnet-e2e.mjs [url]
 *
 * Écrire, garder une suggestion au crayon, la question du jour (note longue), migrer, rechercher, l'année
 * (future log), une version et le retour, l'export (en clair et chiffré), le rechargement (tout est enregistré), le téléphone (mise en page sans débordement). Sans WebGPU :
 * l'application doit fonctionner à l'identique, la page reste son HTML.
 * Sortie : une ligne par étape, code 1 au premier échec.
 */
import { chromium, devices } from "playwright";
import { existsSync, readdirSync } from "node:fs";

const url = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:4317/carnet.html";
const pw = "/opt/pw-browsers";
const exe = [process.env.PLI_CHROMIUM, ...(existsSync(pw) ? readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d)).map((d) => `${pw}/${d}/chrome-linux64/chrome`) : [])].find((x) => x && existsSync(x));
const b = await chromium.launch(exe ? { executablePath: exe } : {});
let failed = 0;
async function step(name, f) {
  const t = performance.now();
  try {
    await f();
    console.log(`ok   ${name} (${Math.round(performance.now() - t)} ms)`);
  } catch (e) {
    failed++;
    console.log(`ÉCHEC ${name} : ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  }
}
const eq = (a, b, what) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what} : ${JSON.stringify(a)} au lieu de ${JSON.stringify(b)}`);
};
const ok = (v, what) => {
  if (!v) throw new Error(what);
};

const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const live = () => p.evaluate(() => window.__carnet.core.all().filter((e) => !e.deletedAt).map((e) => e.text));

await step("démarrage, carnet d'exemple", async () => {
  await p.goto(url);
  await p.waitForFunction(() => window.__carnet?.core);
  ok((await live()).length > 5, "exemple vide");
});

await step("écrire une ligne au jour", async () => {
  await p.click('[data-view="day"]');
  const i = p.locator(".cn-form input").first();
  await i.fill(". Tester Carnet de bout en bout");
  await i.press("Enter");
  await p.waitForFunction(() => window.__carnet.core.all().some((e) => e.text === "Tester Carnet de bout en bout"));
  ok(await p.locator(".cn-text", { hasText: "Tester Carnet de bout en bout" }).count(), "ligne absente de la page");
});

await step("garder une suggestion au crayon", async () => {
  const n = await p.locator(".cn-ghost").count();
  ok(n > 0, "aucune suggestion");
  await p.locator(".cn-ghost .cn-keep").first().dispatchEvent("click");
  await p.waitForFunction((k) => document.querySelectorAll(".cn-ghost").length === k - 1, n);
});

await step("question du jour : écrire une note longue", async () => {
  const g = p.locator(".cn-ghost.is-prompt");
  ok(await g.count(), "pas de question du jour");
  await g.locator(".cn-keep").click();
  await p.waitForSelector("textarea.cn-edit.is-multiline");
  await p.keyboard.type("Première ligne de réponse");
  await p.keyboard.press("Enter");
  await p.keyboard.type("Seconde ligne");
  await p.keyboard.press("Control+Enter");
  await p.waitForSelector("textarea.cn-edit", { state: "detached" });
  const t = await p.evaluate(() => window.__carnet.core.all().find((e) => e.text.includes("Seconde ligne"))?.text);
  ok(t && t.split("\n").length === 3, `note : ${JSON.stringify(t)}`);
  eq(await g.count(), 0, "question encore affichée");
});

await step("migrer une tâche (menu « Déplacer vers… »)", async () => {
  const row = p.locator(".cn-row:not(.cn-ghost)", { hasText: "Tester Carnet de bout en bout" });
  await row.locator('[data-act="migrate"]').click();
  await p.waitForSelector('[role="menu"]');
  await p.locator('[role="menuitem"]', { hasText: /demain/i }).first().click();
  await p.waitForFunction(() => {
    const e = window.__carnet.core.all().find((x) => x.text === "Tester Carnet de bout en bout");
    return e && e.trail.length === 1;
  });
});

await step("rechercher (sans accents) et ouvrir le résultat", async () => {
  await p.keyboard.press("Escape");
  await p.click("#cn-search");
  await p.fill(".cn-search-input", "BOUT EN BOUT");
  await p.waitForSelector(".cn-hit");
  eq(await p.locator(".cn-hit").count(), 1, "résultats");
  await p.keyboard.press("Enter");
  await p.waitForSelector("li.is-found");
  ok((await p.textContent("#cn-title")).length > 3, "pas de page ouverte");
});

await step("année : noter au future log, ouvrir le mois", async () => {
  await p.click('[data-view="year"]');
  await p.waitForSelector(".cn-ymonth");
  eq(await p.locator(".cn-ymonth").count(), 12, "mois");
  const y = Number((await p.textContent("#cn-title")).match(/\d{4}/)[0]);
  const m = `${y}-12`;
  const i = p.locator(`#in-y-${m}`);
  await i.fill("24 o 19:00 Réveillon de test");
  await i.press("Enter");
  await p.waitForSelector(`.cn-ymonth[data-month="${m}"] .cn-yrow`);
  await p.click(`.cn-ymonth[data-month="${m}"] .cn-dname`);
  await p.waitForFunction(() => document.querySelector("#spread")?.dataset.view === "month");
  ok(await p.locator(".cn-text", { hasText: "Réveillon de test" }).count(), "absent de la page du mois");
});

await step("version, tout effacer, revenir à la version", async () => {
  const before = (await live()).sort();
  await p.evaluate(() => window.__carnet.autoVersion());
  await p.evaluate(() => {
    const c = window.__carnet.core;
    for (const e of c.all()) c.delete(e.id);
    window.__carnet.store.commit();
  });
  eq((await live()).length, 0, "effacement");
  await p.click("#cn-versions");
  const back = p.locator(".cn-version .cn-move-item").first();
  await back.click();
  await back.click();
  await p.waitForFunction((n) => window.__carnet.core.all().filter((e) => !e.deletedAt).length === n, before.length);
  eq((await live()).sort(), before, "contenu après retour");
});

await step("exporter", async () => {
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#cn-backup")]);
  ok(/^carnet-\d{4}-\d{2}-\d{2}\.carnet$/.test(dl.suggestedFilename()), dl.suggestedFilename());
});

await step("exporter chiffré (phrase générée), sans texte en clair", async () => {
  await p.click("#cn-versions");
  await p.locator(".cn-move-item", { hasText: "chiffrée" }).click();
  await p.locator(".cn-move-item", { hasText: "Générer" }).click();
  const [dl] = await Promise.all([p.waitForEvent("download"), p.locator(".cn-phrasepanel .is-primary").click()]);
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(await dl.path());
  eq(bytes.subarray(0, 3).toString(), "CNS", "en-tête");
  ok(!bytes.includes(Buffer.from("Tester Carnet")), "texte en clair dans le fichier chiffré");
});

await step("recharger : tout est enregistré", async () => {
  const before = (await live()).sort();
  await p.reload();
  await p.waitForFunction(() => window.__carnet?.core);
  eq((await live()).sort(), before, "contenu après rechargement");
});

await step("aucune erreur de page", async () => eq(errors, [], "erreurs"));

await step("téléphone : chaque vue sans débordement horizontal", async () => {
  const m = await b.newContext({ ...devices["Pixel 7"] });
  const q = await m.newPage();
  const errs = [];
  q.on("pageerror", (e) => errs.push(e.message));
  for (const v of ["", "?vue=jour", "?vue=mois", "?vue=annee", "?vue=collections"]) {
    await q.goto(url + v);
    await q.waitForFunction(() => window.__carnet?.core);
    const over = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(over <= 1, `${v || "semaine"} déborde de ${over} px`);
  }
  eq(errs, [], "erreurs");
  await m.close();
});

await b.close();
console.log(failed ? `\n${failed} échec(s)` : "\nTout passe.");
process.exit(failed ? 1 : 0);
