#!/usr/bin/env node
/**
 * Export fidèle d'un diaporama Presse : PPTX (niveau 1), PDF, HTML autonome — Node + Playwright.
 *
 *   npm run export:diapo -- diapo-demos.html [conference.html …] [--pptx] [--pdf] [--html] [--sortie dist-export/]
 *        [--diapos-seules] [--sans-notes] [--sans-transitions] [--notes-pdf] [--masquees] [--image auto|png|jpeg]
 *        [--largeur 1920] [--dev] [--construire] [--verifier]
 *
 * Sans format demandé : les trois. Pour chaque page, dans <sortie>/<nom>/ : <nom>.pptx, <nom>.pdf, <nom>.html,
 * images/dNN-eK.png (chaque diapo à chaque état : l'arrivée e0, puis un état par appui) et rapport.json.
 *
 * Comment : un serveur Vite local (aperçu de dist/ s'il est à jour, sinon serveur de développement ; --dev le force,
 * --construire lance d'abord `npm run build`), Chromium sans écran sur `<page>?export` : la page expose
 * window.__presseExport (src/diapo-export/page.ts), qui pose chaque état figé ; Playwright le capture. Le PPTX est
 * écrit ici (src/diapo-export/pptx.ts, OOXML direct), le PDF par Chromium (une page par état, signets = titres des
 * diapos), le HTML autonome par la page elle-même. --verifier : le PPTX rouvert par LibreOffice (s'il est là),
 * converti en PDF, ses pages comptées.
 *
 * WebGPU : Chromium sans écran n'a pas d'adaptateur (et SwiftShader rend un canvas vide en capture) : l'export montre
 * le rendu de repli DOM de Presse — mise en page et polices identiques, sans les effets du moteur. Le rapport le dit.
 * Réglages validés par le schéma partagé (src/diapo-export/options.ts), comme le menu Exporter du Créateur.
 * Lancer avec `node --experimental-strip-types` (le script npm le fait) : ce fichier importe les modules TypeScript.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { construirePptx } from "../src/diapo-export/pptx.ts";
import { hauteurDe, lireOptions } from "../src/diapo-export/options.ts";
import { nomEtat } from "../src/diapo-export/modele.ts";
import { avertissementTransition, correspondance } from "../src/diapo-export/transitions.ts";

const RACINE = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const drapeau = (n) => args.includes(`--${n}`);
const valeur = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d;
};
const AVEC_VALEUR = new Set(["sortie", "image", "largeur", "port"]);
const pages = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && AVEC_VALEUR.has(args[i - 1].replace(/^--/, ""))));
if (!pages.length || drapeau("aide")) {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(2, 22).map((l) => l.replace(/^ \*\s?/, "")).join("\n"));
  process.exit(pages.length ? 0 : 1);
}
let formats = ["pptx", "pdf", "html"].filter((f) => drapeau(f));
if (!formats.length) formats = ["pptx", "pdf", "html"];
const sortie = path.resolve(RACINE, valeur("sortie", "dist-export"));

const { options, corrections } = lireOptions({
  contenu: drapeau("diapos-seules") ? "diapos" : "etapes",
  notes: !drapeau("sans-notes"),
  transitions: !drapeau("sans-transitions"),
  masquees: drapeau("masquees"),
  image: valeur("image", "auto"),
  largeur: Number(valeur("largeur", "1920")),
});
for (const c of corrections) console.warn(`réglage corrigé — ${c}`);
const largeur = options.largeur;
const hauteur = hauteurDe(largeur);

/* ───────── Playwright et Chromium ───────── */

async function importerPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // Repli : l'installation globale (NODE_PATH), comme les autres outils de l'environnement.
    for (const dir of (process.env.NODE_PATH ?? "/home/claude/.npm-global/lib/node_modules").split(path.delimiter)) {
      try {
        return createRequire(path.join(dir, "x.js"))("playwright");
      } catch {
        /* suivant */
      }
    }
    throw new Error("playwright introuvable (npm install, ou NODE_PATH vers une installation globale)");
  }
}
function executable(chromium) {
  const env = process.env.PLI_CHROMIUM || process.env.PW_CHROMIUM;
  if (env && existsSync(env)) return env;
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return undefined; // celui de Playwright, tel quel
  } catch {
    /* pas installé */
  }
  // Les navigateurs déjà là (/opt/pw-browsers), du plus récent au plus ancien.
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!existsSync(base)) return undefined;
  const dirs = readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const d of dirs) for (const sous of ["chrome-linux64/chrome", "chrome-linux/chrome"]) if (existsSync(path.join(base, d, sous))) return path.join(base, d, sous);
  return undefined;
}

/* ───────── Serveur ───────── */

function distAJour(page) {
  const f = path.join(RACINE, "dist", page);
  if (!existsSync(f)) return false;
  const assets = path.join(RACINE, "dist", "assets");
  if (!existsSync(assets)) return false;
  // Le module d'export doit être dans le build (sinon dist/ précède E5).
  return readdirSync(assets).some((a) => a.endsWith(".js") && readFileSync(path.join(assets, a), "utf8").includes("__presseExport"));
}

async function serveur(page) {
  const vite = await import("vite");
  if (drapeau("construire")) {
    const t = performance.now();
    const r = spawnSync("npm", ["run", "build"], { cwd: RACINE, stdio: "inherit" });
    if (r.status !== 0) throw new Error("npm run build a échoué");
    console.log(`build : ${((performance.now() - t) / 1000).toFixed(1)} s`);
  }
  if (!drapeau("dev") && distAJour(page)) {
    const s = await vite.preview({ root: RACINE, logLevel: "silent", preview: { host: "127.0.0.1", port: Number(valeur("port", "0")) || 0, strictPort: false, open: false } });
    return { mode: "aperçu (vite preview, dist/)", url: s.resolvedUrls.local[0], fermer: () => s.close() };
  }
  if (!drapeau("dev")) console.log("dist/ absent ou antérieur à l'export : serveur de développement (npm run build, ou --construire, pour l'aperçu)");
  const s = await vite.createServer({ root: RACINE, logLevel: "silent", server: { host: "127.0.0.1", port: Number(valeur("port", "0")) || 0, strictPort: false, hmr: false, open: false } });
  await s.listen();
  return { mode: "développement (vite)", url: s.resolvedUrls.local[0], fermer: () => s.close() };
}

/* ───────── PDF ───────── */

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function htmlPdf(modele, images, avecNotes) {
  const pages = [];
  modele.diapos.forEach((d, di) => {
    d.etats.forEach((e, ei) => {
      const img = images[di][ei];
      const titre = ei === 0 ? `<h1>${esc(`${d.numero}. ${d.titre}`)}</h1>` : "";
      const notes = avecNotes && ei === d.etats.length - 1 ? `<div class="notes">${(d.notes.length ? d.notes : ["—"]).map((p) => `<p>${esc(p)}</p>`).join("")}</div>` : "";
      pages.push(`<section class="page">${titre}<img src="data:image/${img.type};base64,${Buffer.from(img.octets).toString("base64")}" alt="${esc(e.alt)}" />${notes}</section>`);
    });
  });
  const taille = avecNotes ? "size: A4 portrait; margin: 12mm;" : "size: 13.333in 7.5in; margin: 0;";
  return `<!doctype html><html lang="${esc(modele.langue)}"><head><meta charset="utf-8"><title>${esc(modele.titre)}</title><style>
@page { ${taille} }
html, body { margin: 0; padding: 0; }
.page { position: relative; break-after: page; ${avecNotes ? "" : "width: 13.333in; height: 7.5in; overflow: hidden;"} }
.page:last-child { break-after: auto; }
.page img { display: block; width: 100%; ${avecNotes ? "aspect-ratio: 16 / 9; border: 0.3mm solid #ccc; box-sizing: border-box;" : "height: 100%;"} object-fit: contain; }
/* Le titre fait le signet (plan du PDF) sans se voir. */
.page h1 { position: absolute; left: 0; top: 0; margin: 0; font-size: 2pt; line-height: 1; color: transparent; }
.notes { font: 11pt/1.45 "Archivo", system-ui, sans-serif; color: #16110d; padding-top: 6mm; }
.notes p { margin: 0 0 3mm; }
</style></head><body>${pages.join("\n")}</body></html>`;
}

/* ───────── Un export ───────── */

const ko = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} Mo` : `${(n / 1024).toFixed(0)} ko`);

async function exporter(navigateur, page) {
  const t0 = performance.now();
  const nom = path.basename(page, ".html");
  const dossier = path.join(sortie, nom);
  mkdirSync(path.join(dossier, "images"), { recursive: true });
  const srv = await serveur(page);
  const rapport = { page, serveur: srv.mode, options, corrections, rendu: "", webgpu: false, diapos: 0, etats: 0, temps: {}, fichiers: {}, transitions: [], avertissements: [] };
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  try {
    await p.goto(new URL(`${page}?export`, srv.url).href, { waitUntil: "load" });
    await p.waitForFunction(() => !!window.__presseExport, null, { timeout: 60000 });
    rapport.temps.chargement = Math.round(performance.now() - t0);
    rapport.webgpu = await p.evaluate(() => window.__presseExport.webgpu);
    rapport.rendu = rapport.webgpu ? "DOM (WebGPU présent mais non capturé : repli DOM imposé)" : "DOM (repli : pas d'adaptateur WebGPU dans Chromium sans écran)";
    const modele = await p.evaluate((o) => window.__presseExport.modele(o), options);
    rapport.diapos = modele.diapos.length;
    rapport.etats = modele.nbEtats;
    rapport.avertissements.push(...modele.avertissements);

    // Chaque état, capturé.
    const t1 = performance.now();
    const images = [];
    let octetsPng = 0;
    for (const d of modele.diapos) {
      const ligne = [];
      for (const e of d.etats) {
        await p.evaluate(([i, k, n, t]) => window.__presseExport.aller(i, k, n, t), [d.index, e.appuis, d.numero, modele.diapos.length]);
        const png = await p.screenshot({ type: "png" });
        writeFileSync(path.join(dossier, "images", `${nomEtat(d, e)}.png`), png);
        octetsPng += png.length;
        let img = { octets: new Uint8Array(png), type: "png" };
        if (options.image !== "png") {
          const jpg = await p.screenshot({ type: "jpeg", quality: 90 });
          if (options.image === "jpeg" || jpg.length < png.length) img = { octets: new Uint8Array(jpg), type: "jpeg" };
        }
        ligne.push(img);
      }
      images.push(ligne);
    }
    rapport.temps.rendu = Math.round(performance.now() - t1);
    rapport.fichiers.images = { nombre: modele.nbEtats, png: octetsPng, embarquees: images.flat().reduce((n, i) => n + i.octets.length, 0), jpeg: images.flat().filter((i) => i.type === "jpeg").length };
    rapport.transitions = modele.diapos.map((d) => {
      const c = correspondance(d.transition.nom);
      return { diapo: d.numero, presse: d.transition.nom, powerpoint: c.libelle, qualite: c.qualite, duree: d.transition.duree };
    });

    if (formats.includes("pptx")) {
      const t = performance.now();
      const r = construirePptx({ modele, images, options, application: "Presse · tools/export-diapo.mjs" });
      writeFileSync(path.join(dossier, `${nom}.pptx`), r.octets);
      rapport.temps.pptx = Math.round(performance.now() - t);
      rapport.fichiers.pptx = { octets: r.octets.length, diapos: r.diapos };
      rapport.avertissements.push(...r.avertissements);
    } else if (options.transitions) {
      for (const d of modele.diapos) {
        const a = avertissementTransition(d.transition.nom);
        if (a && !rapport.avertissements.includes(a)) rapport.avertissements.push(a);
      }
    }
    if (formats.includes("pdf")) {
      const t = performance.now();
      const avecNotes = drapeau("notes-pdf");
      const pdfPage = await ctx.newPage();
      await pdfPage.setContent(htmlPdf(modele, images, avecNotes), { waitUntil: "load" });
      const pdf = await pdfPage.pdf({ ...(avecNotes ? { format: "A4" } : { width: "13.333in", height: "7.5in" }), printBackground: true, outline: true, tagged: true, margin: { top: "0", right: "0", bottom: "0", left: "0" }, preferCSSPageSize: true });
      await pdfPage.close();
      writeFileSync(path.join(dossier, `${nom}.pdf`), pdf);
      rapport.temps.pdf = Math.round(performance.now() - t);
      rapport.fichiers.pdf = { octets: pdf.length, pages: modele.nbEtats, notes: avecNotes };
    }
    if (formats.includes("html")) {
      const t = performance.now();
      const r = await p.evaluate((o) => window.__presseExport.htmlAutonome(o), options);
      writeFileSync(path.join(dossier, `${nom}.html`), r.html);
      rapport.temps.html = Math.round(performance.now() - t);
      rapport.fichiers.html = { octets: r.octets, polices: r.polices, octetsPolices: r.octetsPolices, urlsExternes: r.externes };
      rapport.avertissements.push(...r.avertissements);
      if (r.externes.length) rapport.avertissements.push(`HTML autonome : ${r.externes.length} URL externe(s) : ${r.externes.join(", ")}`);
    }
    if (drapeau("verifier") && formats.includes("pptx")) rapport.verification = verifierLibreOffice(dossier, nom);
  } finally {
    await ctx.close();
    await srv.fermer();
  }
  if (erreurs.length) rapport.avertissements.push(...erreurs.map((e) => `erreur de page : ${e}`));
  rapport.temps.total = Math.round(performance.now() - t0);
  writeFileSync(path.join(dossier, "rapport.json"), `${JSON.stringify(rapport, null, 2)}\n`);
  return { dossier, rapport };
}

/** Le PPTX rouvert par LibreOffice (s'il est installé) : converti en PDF, pages comptées. */
function verifierLibreOffice(dossier, nom) {
  const soffice = spawnSync("sh", ["-c", "command -v soffice || command -v libreoffice"], { encoding: "utf8" }).stdout.trim();
  if (!soffice) return { libreoffice: false };
  const out = path.join(dossier, "verification");
  mkdirSync(out, { recursive: true });
  const t = performance.now();
  const r = spawnSync(soffice, ["--headless", "--convert-to", "pdf", "--outdir", out, path.join(dossier, `${nom}.pptx`)], { encoding: "utf8", timeout: 180000 });
  const pdf = path.join(out, `${nom}.pdf`);
  if (!existsSync(pdf)) return { libreoffice: true, ok: false, sortie: (r.stderr || r.stdout || "").slice(0, 400) };
  const info = spawnSync("pdfinfo", [pdf], { encoding: "utf8" }).stdout ?? "";
  return { libreoffice: true, ok: true, pdf: path.relative(RACINE, pdf), pages: Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0), ms: Math.round(performance.now() - t) };
}

/* ───────── Lancer ───────── */

const { chromium } = await importerPlaywright();
const navigateur = await chromium.launch({ executablePath: executable(chromium), args: ["--disable-gpu", "--font-render-hinting=none"] });
let echec = false;
try {
  for (const page of pages) {
    if (!existsSync(path.join(RACINE, page))) {
      console.error(`${page} : introuvable`);
      echec = true;
      continue;
    }
    const { dossier, rapport: r } = await exporter(navigateur, page);
    const f = r.fichiers;
    console.log(`\n${page} → ${path.relative(RACINE, dossier)}/`);
    console.log(`  ${r.diapos} diapos, ${r.etats} états · rendu ${r.rendu} · serveur ${r.serveur}`);
    if (f.pptx) console.log(`  PPTX  ${ko(f.pptx.octets)} (${f.pptx.diapos} diapos PowerPoint) en ${r.temps.pptx} ms`);
    if (f.pdf) console.log(`  PDF   ${ko(f.pdf.octets)} (${f.pdf.pages} pages) en ${r.temps.pdf} ms`);
    if (f.html) console.log(`  HTML  ${ko(f.html.octets)} (polices ${f.html.polices}, ${ko(f.html.octetsPolices)}) en ${r.temps.html} ms`);
    console.log(`  images ${ko(f.images.png)} en PNG, rendu ${r.temps.rendu} ms · total ${(r.temps.total / 1000).toFixed(1)} s`);
    if (r.verification) console.log(`  LibreOffice : ${r.verification.ok ? `${r.verification.pages} pages relues (${r.verification.ms} ms)` : r.verification.libreoffice ? "échec" : "absent"}`);
    for (const a of r.avertissements) console.log(`  ! ${a}`);
  }
} finally {
  await navigateur.close();
}
if (echec) process.exitCode = 1;
// Vite garde parfois des minuteries : on sort franchement.
setTimeout(() => process.exit(process.exitCode ?? 0), 50).unref();
