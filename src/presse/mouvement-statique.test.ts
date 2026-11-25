/**
 * Le lint statique du mouvement (tools/valider/mouvement-statique.ts) : chaque règle, cas positifs ET négatifs ;
 * l'ignorance par commentaire (avec raison seulement) ; style="" et scripts en ligne d'une page ; le branchement au
 * validateur (avertissements, jamais d'erreurs).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { lintCss, lintJs, lintPage, lintStyleAttr, lireIgnore, type RegleMouvement } from "../../tools/valider/mouvement-statique.ts";
import { lireCatalogue } from "../../tools/valider/catalogue.ts";
import { validerHtml } from "../../tools/valider/valider.ts";

const RACINE = path.resolve(import.meta.dirname, "../..");
const regles = (css: string) => lintCss(css, "essai.css").map((c) => c.regle);
const a = (css: string, r: RegleMouvement, msg = css) => assert.ok(regles(css).includes(r), `${r} attendu : ${msg}`);
const pas = (css: string, r: RegleMouvement, msg = css) => assert.ok(!regles(css).includes(r), `${r} inattendu : ${msg} → ${regles(css).join(", ")}`);

test("lint mouvement : transition-all — explicite ou implicite ; propriétés nommées, none et 0s permis", () => {
  a(".x { transition: all 200ms ease-out }", "transition-all");
  a(".x { transition: 0.2s }", "transition-all", "sans propriété = all");
  a(".x { transition-property: all; transition-duration: .2s }", "transition-all");
  pas(".x { transition: transform 160ms ease-out, opacity 160ms }", "transition-all");
  pas(".x { transition: none }", "transition-all");
  pas(".x { transition: all 0s }", "transition-all");
});

test("lint mouvement : ease-in signalé, ease-in-out et ease-out non", () => {
  a(".x { transition: opacity 200ms ease-in }", "ease-in");
  a(".x { transition: opacity 200ms; transition-timing-function: ease-in }", "ease-in");
  pas(".x { transition: transform 200ms ease-in-out }", "ease-in");
  pas(".x { transition: transform 200ms ease-out }", "ease-in");
  pas(".x { transition: transform 200ms var(--presse-ease-sortie) }", "ease-in");
});

test("lint mouvement : scale-zero — keyframe de départ, @starting-style, état d'une transition ; scaleX(0) et scale(0.95) permis", () => {
  a("@keyframes pop { from { transform: scale(0) } to { transform: none } }", "scale-zero");
  a("@keyframes pop { 0% { scale: 0 } 100% { scale: 1 } }", "scale-zero");
  a("@starting-style { .x { transform: scale(0) } }", "scale-zero");
  a(".x { transition: transform 150ms; transform: scale(0) }", "scale-zero");
  pas(".x { transition: transform 150ms; transform: scaleX(0) }", "scale-zero", "un trait qui se dessine");
  pas("@starting-style { .x { scale: 0.95; opacity: 0 } }", "scale-zero");
  pas("@keyframes fin { to { transform: scale(0) } }", "scale-zero", "une sortie, pas une entrée");
  pas(".x { transform: scale(0) }", "scale-zero", "sans transition ni entrée : un état caché");
});

test("lint mouvement : duree-longue — > 300 ms hors modale / tiroir / dialog / toast / drawer ; boucles infinies permises", () => {
  a(".bouton { transition: transform 400ms ease-out }", "duree-longue");
  a(".carte { animation: monte 0.9s both }", "duree-longue");
  pas(".bouton { transition: transform 160ms ease-out }", "duree-longue");
  pas(".bouton { transition: transform 300ms ease-out }", "duree-longue", "300 ms pile");
  pas(".modale { transition: transform 450ms var(--presse-ease-tiroir) }", "duree-longue");
  pas(".tiroir-panier { transition: translate 500ms }", "duree-longue");
  pas("dialog[open] { transition: opacity 400ms }", "duree-longue");
  pas("@media (min-width: 1px) { .toast { transition: opacity 400ms ease } }", "duree-longue");
  pas(".spinner { animation: tourne 1.2s linear infinite }", "duree-longue");
});

test("lint mouvement : survol-sans-hover — :hover hors de @media (hover: hover)", () => {
  a(".x:hover { opacity: .8 }", "survol-sans-hover");
  a("@media (min-width: 600px) { .x:hover { opacity: .8 } }", "survol-sans-hover");
  pas("@media (hover: hover) and (pointer: fine) { .x:hover { opacity: .8 } }", "survol-sans-hover");
  pas("@media (any-hover:hover) { .x:hover { opacity: .8 } }", "survol-sans-hover");
  pas(".x { @media (hover: hover) { &:hover { opacity: .8 } } }", "survol-sans-hover", "imbrication CSS");
  pas(".x:focus-visible { outline: 2px solid }", "survol-sans-hover");
});

test("lint mouvement : origine-centre — popover, menu, infobulle ; une modale garde le centre", () => {
  a(".menu-deroulant { transform-origin: center }", "origine-centre");
  a("[popover] { transform-origin: 50% 50% }", "origine-centre");
  a(".infobulle { transform-origin: center center }", "origine-centre");
  pas(".modale { transform-origin: center }", "origine-centre");
  pas(".menu-deroulant { transform-origin: top left }", "origine-centre");
  pas(".carte { transform-origin: center }", "origine-centre");
});

test("lint mouvement : propriete-animee — largeur, hauteur, marges, ombre ; transform, opacity, filter, clip-path, couleurs, discrètes permises", () => {
  a(".x { transition: width 200ms }", "propriete-animee");
  a(".x { transition: height 200ms, margin-top 200ms }", "propriete-animee");
  a(".x { transition: box-shadow 200ms }", "propriete-animee");
  a("@keyframes grandit { from { height: 0 } to { height: 10px } }", "propriete-animee");
  pas(".x { transition: transform 200ms, opacity 200ms, filter 200ms, clip-path 200ms }", "propriete-animee");
  pas(".x { transition: color 150ms ease, background-color 150ms ease, border-color 150ms }", "propriete-animee");
  pas(".x { transition: scale 160ms, translate 150ms, rotate 150ms }", "propriete-animee");
  pas("[popover] { transition: opacity 200ms, display 200ms allow-discrete, overlay 200ms allow-discrete }", "propriete-animee");
  pas("@keyframes f { from { opacity: 0; transform: translateY(4px) } to { opacity: 1 } }", "propriete-animee");
  pas(".x { transition: --douceur-p 200ms }", "propriete-animee", "variable enregistrée : invérifiable ici");
});

test("lint mouvement : keyframes-rapide — toast, bascule ; une transition non", () => {
  a(".toast { animation: entre 200ms ease-out }", "keyframes-rapide");
  a('.bascule[aria-pressed="true"] { animation: clic 150ms }', "keyframes-rapide");
  pas(".toast { transition: transform 200ms, opacity 200ms }", "keyframes-rapide");
  pas(".carte { animation: entre 200ms }", "keyframes-rapide");
});

test("lint mouvement : presse-lint-ignore — avant la règle, dans son bloc, sur une at-règle ; sans raison il ne vaut rien", () => {
  assert.deepEqual(lireIgnore("presse-lint-ignore: duree-longue — un tiroir"), { regles: ["duree-longue"], raison: "un tiroir" });
  assert.deepEqual(lireIgnore(" presse-lint-ignore: duree-longue, transition-all (essai) "), { regles: ["duree-longue", "transition-all"], raison: "essai" });
  pas("/* presse-lint-ignore: duree-longue — révélation au défilement */\n.x { transition: clip-path 600ms }", "duree-longue");
  pas(".x { /* presse-lint-ignore: duree-longue — maintien pour confirmer */ transition: clip-path 2s linear }", "duree-longue");
  pas("/* presse-lint-ignore: survol-sans-hover — démo de bureau */\n@media (min-width: 1px) { .x:hover { opacity: .5 } }", "survol-sans-hover");
  // L'ignorance vise la règle suivante, pas les autres.
  a("/* presse-lint-ignore: duree-longue — la suivante seulement */\n.x { transition: opacity 600ms }\n.y { transition: opacity 600ms }", "duree-longue");
  // Une autre règle reste signalée.
  a("/* presse-lint-ignore: duree-longue — essai */\n.x { transition: all 600ms }", "transition-all");
  // Sans raison : rien n'est ignoré, et le commentaire se signale.
  const r = regles("/* presse-lint-ignore: duree-longue */\n.x { transition: opacity 600ms }");
  assert.ok(r.includes("duree-longue") && r.includes("ignore-sans-raison"), r.join(", "));
  assert.ok(regles("/* presse-lint-ignore: duree-longe — faute */\n.x { opacity: 1 }").includes("ignore-inconnue"));
});

test("lint mouvement : numéros de ligne, style=\"\", JS au clavier (heuristique)", () => {
  const c = lintCss("\n\n.x {\n  transition: all 1s;\n}", "f.css", 10);
  assert.equal(c.find((x) => x.regle === "transition-all")?.ligne, 13);
  assert.deepEqual(lintStyleAttr("transition: width 400ms ease-in", "<div style>", "p.html", 4).map((x) => x.regle).sort(), ["duree-longue", "ease-in", "propriete-animee"]);
  assert.deepEqual(lintStyleAttr("color: red", "<p style>", "p.html", 4), []);
  const js = `el.addEventListener("keydown", (e) => {\n  if (e.key === "ArrowRight") panneau.animate([{ opacity: 0 }, { opacity: 1 }], 200);\n});`;
  assert.deepEqual(lintJs(js, "x.ts").map((x) => x.regle), ["clavier-anime"]);
  const ref = `function surTouche(e) { tl.play(); }\ndoc.addEventListener("keyup", surTouche);`;
  assert.deepEqual(lintJs(ref, "x.ts").map((x) => x.regle), ["clavier-anime"], "gestionnaire par référence");
  assert.deepEqual(lintJs(`el.addEventListener("keydown", (e) => { if (e.key === "Escape") fermer(); });`, "x.ts"), [], "sans animation");
  assert.deepEqual(lintJs(`el.addEventListener("click", () => el.animate([], 200));`, "x.ts"), [], "pas un gestionnaire clavier");
  assert.deepEqual(lintJs(`// presse-lint-ignore: clavier-anime — défilement doux voulu au clavier\nel.addEventListener("keydown", () => el.scrollIntoView({ behavior: "smooth" }));`, "x.ts"), []);
});

test("lint mouvement : une page — <style>, style=\"\" (avec <!-- presse-lint-ignore -->), scripts en ligne ; branché au validateur en avertissements", () => {
  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8" /><title>Essai</title>
<style>
.b:hover { opacity: .8 }
</style>
</head>
<body>
<div style="transition: all 200ms">a</div>
<!-- presse-lint-ignore: duree-longue — un tiroir écrit en ligne -->
<aside style="transition: transform 500ms">b</aside>
<script type="module">document.addEventListener("keydown", () => document.body.animate([], 100));</script>
</body>
</html>`;
  const fichier = path.join(RACINE, "essai-mouvement.html");
  const { constats } = lintPage(fichier, RACINE, html);
  const vus = constats.map((c) => `${c.regle}@${c.ligne}`).sort();
  assert.deepEqual(vus, ["clavier-anime@12", "survol-sans-hover@5", "transition-all@9"]);
  const cat = lireCatalogue(RACINE);
  const v = validerHtml(html, cat, { fichier });
  const m = v.filter((c) => c.regle === "mouvement");
  assert.equal(m.length, 3);
  assert.ok(m.every((c) => c.gravite === "avertissement"), "jamais une erreur");
  assert.equal(validerHtml(html, cat, { fichier, mouvement: false }).filter((c) => c.regle === "mouvement").length, 0, "--sans-mouvement");
});
