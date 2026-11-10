#!/usr/bin/env node
/**
 * Carnet — parcours de bout en bout (fumée), sur la page construite :
 *   npm run build && npx vite preview --port 4317   puis   node tools/carnet-e2e.mjs [url]
 *
 * Écrire, garder une suggestion au crayon, la question du jour (note longue), migrer, rechercher, l'humeur, l'année
 * (future log), une version et le retour, l'export (en clair et chiffré), le stylet (écrire partout, formes, gomme, lasso, annuler), le rechargement (tout est enregistré), le téléphone (mise en page sans débordement). Sans WebGPU :
 * l'application doit fonctionner à l'identique, la page reste son HTML.
 * Sortie : une ligne par étape, code 1 au premier échec.
 */
import { chromium, devices } from "playwright";
import { existsSync, readdirSync, readFileSync } from "node:fs";

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
    console.log(`ÉCHEC ${name} : ${e instanceof Error ? (process.env.E2E_FULL ? e.message : e.message.split("\n")[0]) : e}`);
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
/** Les sauvegardes, la météo, etc. vivent dans les Réglages (P7-L1). */
const openSettings = async (page) => {
  if (await page.locator("#cn-settings").isHidden()) await page.click("#cn-settings-open");
  await page.waitForSelector("#cn-settings:not([hidden])");
};

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

await step("humeur du jour, puis l'année en pixels", async () => {
  await p.click('[data-view="day"]');
  await p.click("#today");
  const today = await p.evaluate(() => window.__carnet.ctx.now);
  await p.click(`.cn-mood[data-mood="${today}"]`);
  await p.locator(".cn-mood-choice", { hasText: "Bien" }).first().click();
  eq(await p.evaluate((d) => window.__carnet.core.mood(d), today), 4, "humeur");
  await p.click('[data-view="year"]');
  await p.click('[data-ymode="humeur"]');
  const cell = await p.evaluate((d) => {
    const m = document.querySelector(`.cn-ymonth[data-month="${d.slice(0, 7)}"] .cn-heat`);
    return m?.classList.contains("is-mood") ? [...m.querySelectorAll(".cn-heat-day")][Number(d.slice(8)) - 1]?.dataset.mood : null;
  }, today);
  eq(cell, "4", "case du jour");
  await p.click('[data-ymode="activite"]');
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
  await p.evaluate(() => window.__carnet.core.setPref("titres", "banniere"));
  await p.evaluate(() => window.__carnet.autoVersion());
  await p.evaluate(() => {
    const c = window.__carnet.core;
    for (const e of c.all()) c.delete(e.id);
    c.setPref("titres", null);
    window.__carnet.store.commit();
  });
  eq((await live()).length, 0, "effacement");
  await openSettings(p);
  await p.click("#cn-versions");
  const back = p.locator(".cn-version .cn-move-item").first();
  await back.click();
  await back.click();
  await p.waitForFunction((n) => window.__carnet.core.all().filter((e) => !e.deletedAt).length === n, before.length);
  eq((await live()).sort(), before, "contenu après retour");
  eq(await p.evaluate(() => window.__carnet.core.pref("titres")), "banniere", "préférence après retour");
});

await step("exporter", async () => {
  await openSettings(p);
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#cn-backup")]);
  ok(/^carnet-\d{4}-\d{2}-\d{2}\.carnet$/.test(dl.suggestedFilename()), dl.suggestedFilename());
});

await step("exporter chiffré (phrase générée), sans texte en clair", async () => {
  await openSettings(p);
  await p.click("#cn-versions");
  await p.locator(".cn-move-item", { hasText: "chiffrée" }).click();
  await p.locator(".cn-move-item", { hasText: "Générer" }).click();
  const [dl] = await Promise.all([p.waitForEvent("download"), p.locator(".cn-phrasepanel .is-primary").click()]);
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

/* ───── Stylet (P4d) : de vrais événements « pen » (pression, inclinaison) par le protocole DevTools ───── */
const cdp = await ctx.newCDPSession(p);
const pen = async (pts, o = {}) => {
  const base = { pointerType: o.pointerType ?? "pen", button: o.button ?? "left", buttons: o.button === "right" ? 2 : 1, tiltX: o.tiltX ?? 0, tiltY: 0 };
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pts[0][0], y: pts[0][1], clickCount: 1, force: 0.6, ...base });
  for (const [x, y, f] of pts.slice(1)) await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, force: f ?? 0.6, ...base });
  if (o.hold) await p.waitForTimeout(o.hold);
  const z = pts[pts.length - 1];
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: z[0], y: z[1], clickCount: 1, force: 0, ...base, buttons: 0 });
};
const strokes = () => p.evaluate(() => {
  const k = document.querySelector("#spread [data-block]").dataset.block;
  return window.__carnet.decor.items(k).filter((i) => i.type === "stroke");
});
/** Un coin libre du premier bloc (ni bouton, ni champ) : là où l'on écrit à la main. */
let free;
await step("stylet : écrire sur la page sans le mode Dessin ; souris et tape inchangées", async () => {
  await p.click('[data-view="day"]');
  await p.click("#today");
  free = await p.evaluate(() => {
    const b = document.querySelector("#spread [data-block]");
    b.scrollIntoView({ block: "start" });
    const r = b.getBoundingClientRect();
    const bad = 'button, a[href], input, textarea, select, label, [role="button"]:not([data-act="edit"]), [data-tracker], .cn-sticker';
    for (let y = r.bottom - 30; y > r.top + 40; y -= 12) {
      const ok = [0, 40, 80, 120].every((dx) => {
        const n = document.elementFromPoint(r.left + 40 + dx, y);
        return n && b.contains(n) && !n.closest(bad);
      });
      if (ok) return [r.left + 40, y];
    }
    return null;
  });
  ok(free, "pas de coin libre");
  const n0 = (await strokes()).length;
  await pen(Array.from({ length: 16 }, (_, i) => [free[0] + i * 7, free[1] + Math.sin(i / 2) * 6, 0.3 + i * 0.04]));
  await p.waitForFunction((n) => {
    const k = document.querySelector("#spread [data-block]").dataset.block;
    return window.__carnet.decor.items(k).filter((i) => i.type === "stroke").length === n + 1;
  }, n0);
  const s = (await strokes()).at(-1);
  const pr = s.points.filter((_, i) => i % 3 === 2);
  ok(Math.max(...pr) - Math.min(...pr) > 0.3, `pression non lue : ${pr.slice(0, 5)}`);
  // La souris, hors du mode Dessin, ne dessine pas.
  await pen([[free[0], free[1] - 4], [free[0] + 60, free[1] - 4]], { pointerType: "mouse" });
  eq((await strokes()).length, n0 + 1, "la souris a dessiné");
  // Une tape du stylet sur une ligne l'ouvre, comme le doigt.
  const t = await p.locator('#spread [data-block] .cn-text[data-act="edit"]').first().boundingBox();
  await pen([[t.x + 6, t.y + t.height / 2]]);
  await p.waitForSelector("textarea.cn-edit");
  await p.keyboard.press("Escape");
  eq((await strokes()).length, n0 + 1, "la tape a laissé un trait");
});

await step("stylet : pointe tenue → cercle ; Ctrl+Z, Ctrl+Maj+Z", async () => {
  const n0 = (await strokes()).length;
  const [cx, cy, R] = [free[0] + 50, free[1] - 30, 22];
  const circle = Array.from({ length: 40 }, (_, k) => {
    const a = (2 * Math.PI * k * 1.03) / 39;
    return [cx + R * Math.cos(a) + Math.sin(k * 1.7) * 1.5, cy + R * 1.06 * Math.sin(a) + Math.cos(k * 1.3) * 1.5, 0.6];
  });
  await pen(circle, { hold: 750 });
  await p.waitForFunction((n) => {
    const k = document.querySelector("#spread [data-block]").dataset.block;
    return window.__carnet.decor.items(k).filter((i) => i.type === "stroke").length === n + 1;
  }, n0);
  const s = (await strokes()).at(-1);
  const xy = [];
  for (let i = 0; i < s.points.length; i += 3) xy.push([s.points[i], s.points[i + 1]]);
  // Reconnu : les points tombent sur un cercle (le cadre du trait), au lieu de trembler comme la main.
  const xs = xy.map((q) => q[0]);
  const ys = xy.map((q) => q[1]);
  const [cx2, cy2] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const rs = xy.map((q) => Math.hypot(q[0] - cx2, q[1] - cy2));
  ok(Math.max(...rs) - Math.min(...rs) < 0.8, `pas un cercle : rayons ${Math.min(...rs).toFixed(1)}…${Math.max(...rs).toFixed(1)}`);
  ok(xy.length > circle.length, "pas repointé");
  await p.locator("body").press("Control+z");
  eq((await strokes()).length, n0, "Ctrl+Z");
  await p.locator("body").press("Control+Shift+z");
  eq((await strokes()).length, n0 + 1, "Ctrl+Maj+Z");
});

await step("gomme au bouton du stylet, d'un seul geste ; lasso : retirer, annuler", async () => {
  const n0 = (await strokes()).length;
  for (const dy of [0, 14]) await pen([[free[0] + 150, free[1] - 70 + dy], [free[0] + 200, free[1] - 70 + dy], [free[0] + 230, free[1] - 70 + dy]]);
  eq((await strokes()).length, n0 + 2, "deux traits");
  // Bouton du stylet enfoncé : la gomme, à travers les deux traits.
  await pen(Array.from({ length: 10 }, (_, i) => [free[0] + 190, free[1] - 85 + i * 4]), { button: "right" });
  eq((await strokes()).length, n0, "gomme");
  ok(/2 traits effacés/.test(await p.textContent("#cn-toast")), "toast");
  await p.locator("body").press("Control+z");
  eq((await strokes()).length, n0 + 2, "gomme annulée");
  // Lasso, en mode Dessin, à la souris : entourer les deux traits, les retirer, annuler.
  await p.click("#cn-draw");
  await p.click('#cn-drawbar [data-tool="lasso"]');
  const [x0, y0, x1, y1] = [free[0] + 135, free[1] - 82, free[0] + 245, free[1] - 48];
  await pen([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0 + 2]], { pointerType: "mouse" });
  await p.waitForSelector(".cn-pick");
  eq(await p.locator(".cn-ink path.is-picked").count(), 2, "traits pris au lasso");
  await p.keyboard.press("Delete");
  eq((await strokes()).length, n0, "lasso : retirer");
  await p.click('#cn-drawbar [aria-label^="Annuler"]');
  eq((await strokes()).length, n0 + 2, "bouton Annuler");
  await p.click("#cn-drawbar .cn-btn");
});

await step("accessibilité (axe, WCAG 2 A/AA) : vues, thèmes, panneaux", async () => {
  const axe = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
  const found = [];
  const audit = async (page, what) => {
    if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ content: axe });
    const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"] })).violations.map((x) => `${x.id} ×${x.nodes.length} (${x.nodes[0].target.join(" ")})`));
    for (const x of v) found.push(`${what} : ${x}`);
  };
  for (const scheme of ["light", "dark"]) {
    const c = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
    const q = await c.newPage();
    for (const v of ["", "?vue=jour", "?vue=mois", "?vue=annee", "?vue=collections"]) {
      await q.goto(url + v);
      await q.waitForFunction(() => window.__carnet?.core);
      await audit(q, `${scheme} ${v || "semaine"}`);
    }
    // Les douze pages de garde (thème du mois, P7-L2).
    for (let mo = 1; mo <= 12; mo++) {
      await q.goto(`${url}?vue=mois&date=2027-${String(mo).padStart(2, "0")}-15`);
      await q.waitForSelector(".cn-cover");
      await audit(q, `${scheme} thème ${mo}`);
    }
    await q.goto(url);
    await q.waitForFunction(() => window.__carnet?.core);
    await q.click("#cn-search");
    await q.fill(".cn-search-input", "plombier");
    await q.waitForSelector(".cn-hit");
    await audit(q, `${scheme} recherche`);
    await q.keyboard.press("Escape");
    await openSettings(q);
    await audit(q, `${scheme} réglages`);
    await q.click("#cn-versions");
    await q.waitForSelector(".cn-bkpanel");
    await audit(q, `${scheme} versions`);
    await q.keyboard.press("Escape");
    await q.keyboard.press("Escape");
    await q.click("#cn-stickers");
    await audit(q, `${scheme} autocollants`);
    await q.click("#cn-draw");
    await audit(q, `${scheme} dessin`);
    await q.keyboard.press("Escape");
    await c.close();
  }
  eq(found, [], "violations");
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
    // Comparé à l'écran, pas à innerWidth : un contenu trop large élargit la fenêtre de mise en page
    // du téléphone (innerWidth suit), et l'ancien test ne voyait rien.
    const over = await q.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) - screen.width);
    ok(over <= 1, `${v || "semaine"} déborde de ${over} px`);
  }
  eq(errs, [], "erreurs");
  await m.close();
});

await step("téléphone sans stylet actif : le doigt dessine, deux doigts défilent ou annulent, la paume est ignorée", async () => {
  const m = await b.newContext({ ...devices["Pixel 7"] });
  const q = await m.newPage();
  await q.goto(url);
  await q.waitForFunction(() => window.__carnet?.core);
  const t = await m.newCDPSession(q);
  const touch = async (frames, radius = 4) => {
    // frames : une liste de positions de doigts [[x, y], …] par instant ; le premier pose, le dernier lève.
    const pts = (f) => f.map(([x, y], id) => ({ x, y, id, radiusX: radius, radiusY: radius, force: 0.5 }));
    await t.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts(frames[0]) });
    for (const f of frames.slice(1)) await t.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pts(f) });
    await t.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const count = () => q.evaluate(() => {
    const k = document.querySelector("#spread [data-block]").dataset.block;
    return window.__carnet.decor.items(k).filter((i) => i.type === "stroke").length;
  });
  await q.tap("#cn-more-open");
  await q.tap('#cn-more [data-proxy="cn-draw"]');
  const at = await q.evaluate(() => {
    const b = document.querySelector("#spread [data-block]");
    b.scrollIntoView({ block: "start" });
    const r = b.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + 60];
  });
  const n0 = await count();
  await touch(Array.from({ length: 12 }, (_, i) => [[at[0] - 60 + i * 10, at[1] + Math.sin(i) * 5]]));
  eq(await count(), n0 + 1, "le doigt dessine");
  await touch(Array.from({ length: 10 }, (_, i) => [[at[0] - 40 + i * 8, at[1] + 20]]), 30);
  eq(await count(), n0 + 1, "la paume a dessiné");
  const y0 = await q.evaluate(() => scrollY);
  // Deux doigts glissent : la page défile dans le sens où elle le peut (vers le haut si l'on est en bas).
  const room = await q.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const sign = y0 > room / 2 ? 1 : -1;
  await touch(Array.from({ length: 12 }, (_, i) => [[at[0] - 40, at[1] + 160 + sign * i * 12], [at[0] + 40, at[1] + 160 + sign * i * 12]]));
  const dy = Math.abs(y0 - (await q.evaluate(() => scrollY)));
  ok(dy > 100, `deux doigts : défilé de ${dy} px (depuis ${y0}, marge ${room})`);
  eq(await count(), n0 + 1, "deux doigts ont dessiné");
  await touch([[[at[0] - 40, at[1] + 100], [at[0] + 40, at[1] + 100]], [[at[0] - 40, at[1] + 101], [at[0] + 40, at[1] + 100]]]);
  eq(await count(), n0, "toucher à deux doigts : annuler");
  await m.close();
});

await step("ordinateur : un pied de page sans liens techniques, Réglages au clavier", async () => {
  eq(await p.locator(".cn-foot a, .cn-foot button:not(.cn-link)").count(), 0, "liens dans le pied de page");
  await p.keyboard.press("Escape");
  await p.focus("#cn-settings-open");
  await p.keyboard.press("Enter");
  await p.waitForSelector("#cn-settings:not([hidden])");
  eq(await p.evaluate(() => document.activeElement?.id), "cn-settings-close", "focus dans les Réglages");
  await p.keyboard.press("Escape");
  await p.waitForSelector("#cn-settings", { state: "hidden" });
  eq(await p.evaluate(() => document.activeElement?.id), "cn-settings-open", "focus rendu");
});

await step("téléphone : la page d'abord ; barre basse, feuille « Plus », « + », Réglages", async () => {
  const m = await b.newContext({ ...devices["Pixel 7"] });
  const q = await m.newPage();
  await q.goto(url + "?vue=jour");
  await q.waitForFunction(() => window.__carnet?.core);
  const first = await q.evaluate(() => {
    const r = document.querySelector("#spread .cn-row:not(.cn-ghost), #spread .cn-ghost, #spread .cn-form")?.getBoundingClientRect();
    return { top: r?.top ?? 9999, h: innerHeight, head: document.querySelector("#spread")?.getBoundingClientRect().top ?? 9999 };
  });
  ok(first.top < first.h - 120, `première ligne à ${Math.round(first.top)} px sur ${first.h}`);
  ok(first.head < first.h * 0.22, `l'en-tête prend ${Math.round(first.head)} px sur ${first.h} (> 22 %)`);
  for (const [v, want] of [["week", "week"], ["month", "month"], ["year", "year"], ["day", "day"]]) {
    await q.tap(`#cn-tab [data-view="${v}"]`);
    eq(await q.evaluate(() => document.querySelector("#spread").dataset.view), want, `barre basse : ${v}`);
  }
  // « Plus » au clavier : focus dans la feuille, Tab y tourne, Échap la referme.
  await q.focus("#cn-more-open");
  await q.keyboard.press("Enter");
  await q.waitForSelector("#cn-more:not([hidden])");
  for (let i = 0; i < 6; i++) await q.keyboard.press("Tab");
  ok(await q.evaluate(() => document.querySelector("#cn-more").contains(document.activeElement)), "focus sorti de la feuille");
  const axe = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
  await q.addScriptTag({ content: axe });
  const v1 = await q.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"] })).violations.map((x) => `${x.id} (${x.nodes[0].target.join(" ")})`));
  await q.keyboard.press("Escape");
  await q.waitForSelector("#cn-more", { state: "hidden" });
  // « + » : le champ d'aujourd'hui, même depuis l'Année.
  await q.tap('#cn-tab [data-view="year"]');
  await q.tap("#cn-fab");
  await q.waitForFunction(() => document.activeElement?.closest?.(".cn-form")?.dataset.day === window.__carnet.ctx.now);
  await q.keyboard.press("Escape");
  // Réglages par « Plus ».
  await q.tap("#cn-more-open");
  await q.tap('#cn-more [data-proxy="cn-settings-open"]');
  await q.waitForSelector("#cn-settings:not([hidden])");
  const v2 = await q.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"] })).violations.map((x) => `${x.id} (${x.nodes[0].target.join(" ")})`));
  eq([...v1, ...v2], [], "violations (feuille, réglages)");
  const over = await q.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) - screen.width);
  ok(over <= 1, `déborde de ${over} px`);
  await m.close();
});

await step("carnet vidé : trois lignes pour démarrer, écartées pour de bon", async () => {
  const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const q = await c.newPage();
  await q.goto(url);
  await q.waitForFunction(() => window.__carnet?.core);
  await q.click("#cn-reset");
  await q.waitForSelector(".cn-help");
  await q.locator(".cn-help .cn-link").click();
  await q.waitForSelector(".cn-help", { state: "detached" });
  eq(await q.evaluate(() => window.__carnet.core.pref("nav.aide")), "non", "préférence");
  await q.reload();
  await q.waitForFunction(() => window.__carnet?.core);
  eq(await q.locator(".cn-help").count(), 0, "encart revenu");
  await c.close();
});

await step("exemple décoré : autocollants, surligneur, dessin, suivis et humeurs", async () => {
  const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const q = await c.newPage();
  await q.goto(url);
  await q.waitForFunction(() => window.__carnet?.core);
  await q.waitForFunction(() => document.querySelectorAll("#spread .cn-sticker").length >= 2);
  const r = await q.evaluate(() => {
    const t = window.__carnet.ctx.now;
    const items = window.__carnet.decor.items(`day:${t}`);
    const month = t.slice(0, 7);
    const trk = window.__carnet.core.trackers(month).map((x) => x.count);
    return { stickers: items.filter((i) => i.type === "sticker").length, strokes: items.map((i) => i.type === "stroke" && i.tool).filter(Boolean).sort() };
  });
  ok(r.stickers >= 2, `autocollants du jour : ${r.stickers}`);
  eq(r.strokes, ["encre", "surligneur"], "traits du jour");
  await c.close();
});

await step("thème du mois : page de garde, intention, choix gardé, la semaine prend le mois du jeudi", async () => {
  const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const q = await c.newPage();
  await q.goto(`${url}?vue=mois&date=2026-11-15`);
  await q.waitForFunction(() => window.__carnet?.core);
  await q.waitForSelector('.cn-cover[data-theme="brume"]');
  ok((await q.locator(".cn-cover-art .k").count()) >= 4, "motif au trait");
  // Intention du mois : écrite sur la page de garde, absente de la liste en dessous.
  await q.fill("#in-intent-2026-11", "Ralentir, marcher le soir");
  await q.press("#in-intent-2026-11", "Enter");
  await q.waitForSelector(".cn-intent .cn-text");
  eq((await q.textContent(".cn-intent .cn-text")).trim(), "Ralentir, marcher le soir", "intention");
  eq(await q.locator(".cn-mpage .cn-log .cn-text", { hasText: "Ralentir" }).count(), 0, "intention en double dans la liste");
  // Choisir « Sapin » pour novembre dans les Réglages : accent et page de garde suivent, et c'est gardé.
  await openSettings(q);
  await q.locator(".cn-theme", { hasText: "Sapin" }).click();
  await q.waitForSelector('.cn-cover[data-theme="sapin"]');
  const acc = await q.evaluate(() => getComputedStyle(document.querySelector("#spread")).getPropertyValue("--accent").trim());
  ok(acc && acc !== "#2c6a56", `accent : ${acc}`);
  await q.reload();
  await q.waitForSelector('.cn-cover[data-theme="sapin"]');
  // « Aucun » : plus de page de garde, l'accent de base.
  await openSettings(q);
  await q.locator(".cn-theme", { hasText: "Aucun" }).click();
  await q.waitForSelector(".cn-cover", { state: "detached" });
  eq(await q.evaluate(() => document.querySelector("#spread").dataset.monthTheme ?? null), null, "thème retiré");
  // Une semaine à cheval : lundi 30 novembre 2026 → jeudi 3 décembre → thème de décembre.
  await q.goto(`${url}?date=2026-11-30`);
  await q.waitForFunction(() => window.__carnet?.core);
  eq(await q.evaluate(() => document.querySelector("#spread").dataset.monthTheme), "sapin", "semaine du 30 novembre");
  await c.close();
});

await step("mouvement réduit : la page de garde est posée d'emblée", async () => {
  const c = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const q = await c.newPage();
  await q.goto(`${url}?vue=mois`);
  await q.waitForSelector(".cn-cover");
  const running = await q.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && a.effect?.target?.closest?.(".cn-cover")).length);
  eq(running, 0, "animations en cours");
  await c.close();
});

await b.close();
console.log(failed ? `\n${failed} échec(s)` : "\nTout passe.");
process.exit(failed ? 1 : 0);
