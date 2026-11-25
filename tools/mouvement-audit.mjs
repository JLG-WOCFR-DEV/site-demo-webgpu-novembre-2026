#!/usr/bin/env node
// Presse — audit du mouvement (`improve-animations` d'Emil Kowalski, appliqué au dépôt) : le lint statique
// (tools/valider/mouvement-statique.ts) passé sur toutes les pages de vite.config.ts — leurs sources propres, puis,
// une fois chacune, les feuilles et modules partagés qu'elles chargent (src/presse, src/components, src/nav…).
// LECTURE SEULE sur le code : écrit docs/audit-mouvement.md, un rapport priorisé (règle × nombre × pages) avec, pour
// chaque règle, un plan autosuffisant (quoi, pourquoi, courbes et durées à employer, avant / après, où).
//
//   npm run mouvement:audit                 écrit docs/audit-mouvement.md
//   npm run mouvement:audit -- --stdout     le rapport sur la sortie, sans rien écrire
//   npm run mouvement:audit -- --json       les constats en JSON (pour un agent)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lintCss, lintJs, lintPage, REGLES_MOUVEMENT } from "./valider/mouvement-statique.ts";
import { lirePagesVite } from "./valider/pages-vite.ts";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const pages = lirePagesVite(fs.readFileSync(path.join(racine, "vite.config.ts"), "utf8"));

/** Ordre de priorité : ce qui coûte (mise en page, tout animer) ou se sent (lenteur, clavier) d'abord. */
const PRIORITE = {
  "propriete-animee": 1,
  "transition-all": 1,
  "clavier-anime": 1,
  "ease-in": 2,
  "scale-zero": 2,
  "origine-centre": 2,
  "keyframes-rapide": 2,
  "duree-longue": 3,
  "survol-sans-hover": 3,
  "ignore-sans-raison": 2,
  "ignore-inconnue": 2,
};

/** Le plan de chaque règle : autosuffisant (un agent ou une personne peut l'appliquer sans lire le reste). */
const PLANS = {
  "propriete-animee": {
    titre: "N'animer que transform, opacity, filter, clip-path et les couleurs",
    pourquoi: "Largeur, hauteur, marges, `top`/`left` recalculent la mise en page à chaque image (et décalent les voisins) ; ombre, `stroke-dashoffset`, rayon repeignent. Sur une machine lente, c'est là que les images se perdent.",
    comment: [
      "Largeur / hauteur qui s'ouvrent : `transform: scaleY()` sur un calque, ou `clip-path: inset(0 0 100% 0)` → `inset(0)` ; pour un accordéon, `grid-template-rows: 0fr → 1fr` reste une mise en page — à réserver aux ouvertures rares.",
      "Marge qui glisse : `translate: 4px 0` (ou `transform: translateX()`), la place reste réservée.",
      "Ombre au survol : un pseudo-élément qui porte l'ombre finale, dont on anime l'`opacity` ; ou `filter: drop-shadow()`.",
      "Garder les durées et courbes : 150–250 ms `var(--presse-ease-sortie)`.",
    ],
    avant: ".crochet::before { transition: margin 0.3s var(--ease); }\n.crochet:hover::before { margin-right: 0.6em; }",
    apres: ".crochet::before { transition: translate 200ms var(--presse-ease-sortie); }\n@media (hover: hover) and (pointer: fine) {\n  .crochet:hover::before { translate: -0.25em 0; }\n}",
  },
  "transition-all": {
    titre: "Nommer les propriétés de chaque transition",
    pourquoi: "`transition: all` (ou une transition sans propriété) anime aussi ce qu'on n'avait pas prévu : une largeur qui change au redimensionnement, une couleur de thème, une mise en page — et coûte à chaque changement de style.",
    comment: ["Lister ce qui change vraiment : `transition: transform 160ms var(--presse-ease-sortie), opacity 160ms var(--presse-ease-sortie)`.", "Couleurs seules : `transition: color 150ms ease, background-color 150ms ease`."],
    avant: ".bouton { transition: all .2s; }",
    apres: ".bouton { transition: background-color 150ms ease, scale 160ms var(--presse-ease-sortie); }",
  },
  "clavier-anime": {
    titre: "Aucune animation sur une action au clavier",
    pourquoi: "Un raccourci se répète des centaines de fois par jour : chaque animation devient une attente. Le Gate (PRESSE.md, « Mouvement ») : une action déclenchée au clavier n'est jamais animée. Heuristique : vérifier à la main.",
    comment: ["Dans le gestionnaire `keydown`, poser l'état final sans transition (`el.animate(…, { duration: 0 })`, ou une classe qui coupe la transition le temps d'une image).", "Défilement au clavier : `behavior: \"auto\"`.", "Si l'animation est voulue (diaporama : la transition fait partie du contenu), l'écrire : `// presse-lint-ignore: clavier-anime — pourquoi`."],
    avant: 'el.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") tl.play(); });',
    apres: 'el.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") tl.seek(tl.duration); });',
  },
  "ease-in": {
    titre: "Remplacer ease-in par une sortie franche",
    pourquoi: "`ease-in` part lentement : la réponse paraît en retard. Les entrées et sorties d'interface prennent `ui-sortie`.",
    comment: ["`ease-in` → `var(--presse-ease-sortie)` (cubic-bezier(0.23, 1, 0.32, 1)).", "Un déplacement à l'écran : `var(--presse-ease-ecran)` (0.77, 0, 0.175, 1).", "Une couleur, un survol : `ease`."],
    avant: ".panneau { transition: opacity 200ms ease-in; }",
    apres: ".panneau { transition: opacity 200ms var(--presse-ease-sortie); }",
  },
  "scale-zero": {
    titre: "Entrer depuis scale(0.95) et opacity 0, jamais depuis scale(0)",
    pourquoi: "Rien n'apparaît depuis rien : scale(0) donne un « pop » et trahit l'origine.",
    comment: ["Départ : `scale: 0.95; opacity: 0` (0,95–0,98), 200–250 ms `var(--presse-ease-sortie)`.", "Sans JS : `@starting-style { … }` ; sinon le repli `data-douceur-monte` de src/presse/douceur.ts."],
    avant: "@keyframes pop { from { transform: scale(0); } }",
    apres: "@keyframes pop { from { scale: 0.95; opacity: 0; } }",
  },
  "origine-centre": {
    titre: "Faire sortir popovers, menus et infobulles de leur déclencheur",
    pourquoi: "Un menu qui grandit depuis son centre semble flotter ; depuis son bouton, il dit d'où il vient. Une modale, elle, garde le centre.",
    comment: ["`transform-origin: top left` (ou le côté du déclencheur) ; avec l'ancrage CSS, `transform-origin: var(--origine)` calculé par le placement."],
    avant: ".menu { transform-origin: center; }",
    apres: ".menu { transform-origin: top right; }",
  },
  "keyframes-rapide": {
    titre: "Transitions plutôt que keyframes pour ce qui se déclenche vite",
    pourquoi: "Un toast ou une bascule peut être relancé à mi-course : une transition repart de l'état courant, une keyframe repart de zéro (saut).",
    comment: ["Deux états + `transition` (et `@starting-style` pour l'entrée).", "À vérifier : une keyframe qui ne se rejoue jamais en cours peut rester."],
    avant: ".toast { animation: entre 200ms ease-out; }",
    apres: ".toast { transition: translate 200ms var(--presse-ease-sortie), opacity 200ms; }\n@starting-style { .toast { translate: 0 8px; opacity: 0; } }",
  },
  "duree-longue": {
    titre: "Raccourcir les réponses d'interface (≤ 300 ms)",
    pourquoi: "Au-delà de 300 ms, une réponse d'interface se fait attendre. Modale, tiroir, toast : jusqu'à 500 ms ; marketing, explicatif, révélation au défilement : plus long permis (à ignorer avec raison).",
    comment: ["Appui 100–160 ms ; infobulle 125–200 ms ; menu déroulant 150–250 ms ; modale / tiroir 200–500 ms.", "Sortie plus courte que l'entrée (≈ 0,7 ×).", "Une entrée éditoriale voulue longue : `/* presse-lint-ignore: duree-longue — entrée éditoriale */`."],
    avant: ".lien-mono::after { transition: transform 0.35s var(--ease); }",
    apres: ".lien-mono::after { transition: transform 200ms var(--presse-ease-sortie); }",
  },
  "survol-sans-hover": {
    titre: "Entourer les :hover de @media (hover: hover) and (pointer: fine)",
    pourquoi: "Sur écran tactile, un toucher déclenche :hover et l'état colle jusqu'au toucher suivant.",
    comment: ["Déplacer le bloc `:hover` dans `@media (hover: hover) and (pointer: fine) { … }` ; garder `:focus-visible` dehors (le clavier en a besoin).", "Sans risque visuel sur ordinateur : la règle s'applique toujours avec une souris."],
    avant: ".carte:hover { translate: 0 -2px; }",
    apres: "@media (hover: hover) and (pointer: fine) {\n  .carte:hover { translate: 0 -2px; }\n}",
  },
  "ignore-sans-raison": { titre: "Donner sa raison à chaque presse-lint-ignore", pourquoi: "Sans raison, l'ignorance ne vaut rien.", comment: ["`/* presse-lint-ignore: regle — pourquoi */`."], avant: "/* presse-lint-ignore: duree-longue */", apres: "/* presse-lint-ignore: duree-longue — révélation au défilement */" },
  "ignore-inconnue": { titre: "Corriger le nom de la règle ignorée", pourquoi: "Une faute de frappe n'ignore rien.", comment: [`Règles : ${Object.keys(REGLES_MOUVEMENT).filter((r) => !r.startsWith("ignore-")).join(", ")}.`], avant: "", apres: "" },
};

/* ── 1. Les pages : constats propres, et qui charge quoi ── */
const constats = new Map(); // clé → constat + pages
const parFichier = new Map(); // fichier partagé → pages
const ajouter = (c, page) => {
  const k = `${c.regle}|${c.fichier}|${c.ligne}|${c.ou}|${c.extrait}`;
  const v = constats.get(k) ?? { ...c, pages: new Set() };
  v.pages.add(page);
  constats.set(k, v);
};
for (const p of pages) {
  const abs = path.join(racine, p);
  if (!fs.existsSync(abs)) continue;
  const r = lintPage(abs, racine);
  for (const c of r.constats) ajouter(c, p);
  for (const f of [...r.sources.feuilles, ...r.sources.scripts]) if (!r.sources.propres.includes(f)) parFichier.set(f, new Set([...(parFichier.get(f) ?? []), p]));
}
/* ── 2. Les fichiers partagés, une fois chacun ── */
for (const [f, ps] of parFichier) {
  const t = fs.readFileSync(path.join(racine, f), "utf8");
  for (const c of /\.css$/.test(f) ? lintCss(t, f) : lintJs(t, f)) for (const p of ps) ajouter(c, p);
}
const tous = [...constats.values()].sort((a, b) => (PRIORITE[a.regle] ?? 9) - (PRIORITE[b.regle] ?? 9) || a.fichier.localeCompare(b.fichier) || a.ligne - b.ligne);

if (args.has("--json")) {
  console.log(JSON.stringify(tous.map((c) => ({ ...c, pages: [...c.pages] })), null, 2));
  process.exit(0);
}

/* ── 3. Le rapport ── */
const parRegle = new Map();
for (const c of tous) parRegle.set(c.regle, [...(parRegle.get(c.regle) ?? []), c]);
const regles = [...parRegle.keys()].sort((a, b) => (PRIORITE[a] ?? 9) - (PRIORITE[b] ?? 9) || parRegle.get(b).length - parRegle.get(a).length);
const pagesDe = (cs) => new Set(cs.flatMap((c) => [...c.pages]));
const fichiersDe = (cs) => new Set(cs.map((c) => c.fichier));
const echap = (s) => String(s).replace(/\|/g, "\\|").replace(/`/g, "ʼ");

const L = [];
L.push("# Audit du mouvement — lint statique des pages du dépôt");
L.push("");
L.push(`Généré par \`npm run mouvement:audit\` (tools/mouvement-audit.mjs) — **lecture seule** : rien n'est corrigé ici. Règles : tools/valider/mouvement-statique.ts (d'après les skills d'Emil Kowalski, docs/REFERENCES-MOUVEMENT.md ; des défauts d'auteur, pas des normes). Pages lues : ${pages.length} (vite.config.ts) ; chaque constat est compté une fois, avec les pages qui le chargent. Les mêmes avertissements sortent de \`npm run valider\` (règle « mouvement », sources propres de chaque page seulement).`);
L.push("");
L.push(`**${tous.length} constats** dans ${fichiersDe(tous).size} fichiers, sur ${pagesDe(tous).size} pages.`);
L.push("");
L.push("## Par règle (priorité, nombre, pages)");
L.push("");
L.push("| Priorité | Règle | Constats | Fichiers | Pages |");
L.push("|---|---|---|---|---|");
for (const r of regles) {
  const cs = parRegle.get(r);
  L.push(`| P${PRIORITE[r] ?? 9} | \`${r}\` | ${cs.length} | ${fichiersDe(cs).size} | ${pagesDe(cs).size} |`);
}
L.push("");
L.push("P1 : coûte des images ou se sent à chaque usage (mise en page animée, tout animer, clavier) · P2 : se voit (ease-in, scale(0), origine, keyframes relancées) · P3 : à revoir sans urgence (durées, survol tactile).");
L.push("");
L.push("## Les 10 foyers les plus fréquents (fichier × règle)");
L.push("");
const foyers = new Map();
for (const c of tous) {
  const k = `${c.fichier}|${c.regle}`;
  foyers.set(k, [...(foyers.get(k) ?? []), c]);
}
L.push("| # | Fichier | Règle | Constats | Pages |");
L.push("|---|---|---|---|---|");
[...foyers.entries()]
  .sort((a, b) => b[1].length - a[1].length || (PRIORITE[a[1][0].regle] ?? 9) - (PRIORITE[b[1][0].regle] ?? 9))
  .slice(0, 10)
  .forEach(([k, cs], i) => {
    const [f, r] = k.split("|");
    const ps = [...pagesDe(cs)];
    L.push(`| ${i + 1} | \`${f}\` | \`${r}\` | ${cs.length} | ${ps.length > 4 ? `${ps.slice(0, 4).join(", ")} … (${ps.length})` : ps.join(", ")} |`);
  });
L.push("");
L.push("## Plans (un par règle, autosuffisants)");
for (const r of regles) {
  const cs = parRegle.get(r);
  const plan = PLANS[r];
  L.push("");
  L.push(`### P${PRIORITE[r] ?? 9} · \`${r}\` — ${plan?.titre ?? REGLES_MOUVEMENT[r]} (${cs.length})`);
  L.push("");
  if (plan) {
    L.push(`**Pourquoi.** ${plan.pourquoi}`);
    L.push("");
    L.push("**Comment.**");
    for (const x of plan.comment) L.push(`- ${x}`);
    if (plan.avant) {
      L.push("");
      L.push("Avant :");
      L.push("```css");
      L.push(plan.avant);
      L.push("```");
      L.push("Après :");
      L.push("```css");
      L.push(plan.apres);
      L.push("```");
    }
    L.push("");
  }
  L.push("**Où.**");
  L.push("");
  L.push("| Fichier:ligne | Où | Extrait | Pages |");
  L.push("|---|---|---|---|");
  const MAX = 40;
  for (const c of cs.slice(0, MAX)) {
    const ps = [...c.pages];
    L.push(`| \`${c.fichier}:${c.ligne}\` | ${echap(c.ou)} | \`${echap(c.extrait)}\` | ${ps.length > 3 ? `${ps.slice(0, 3).join(", ")} … (${ps.length})` : ps.join(", ")} |`);
  }
  if (cs.length > MAX) L.push(`| … | ${cs.length - MAX} de plus | \`npm run mouvement:audit -- --json\` | |`);
}
L.push("");
L.push("## Ignorer avec raison");
L.push("");
L.push("Un constat voulu (révélation éditoriale longue, transition de diaporama au clavier) s'ignore là où il est écrit, avec sa raison : `/* presse-lint-ignore: duree-longue — révélation au défilement */` (CSS, juste avant la règle ou dans son bloc), `// presse-lint-ignore: clavier-anime — …` (JS, sur l'une des trois lignes avant le gestionnaire), `<!-- presse-lint-ignore: … -->` (HTML, juste avant l'élément au `style=\"\"`). Sans raison, il ne vaut rien.");
L.push("");
const texte = L.join("\n");
if (args.has("--stdout")) console.log(texte);
else {
  fs.writeFileSync(path.join(racine, "docs/audit-mouvement.md"), texte);
  console.log(`docs/audit-mouvement.md : ${tous.length} constats, ${regles.map((r) => `${r} ${parRegle.get(r).length}`).join(", ")}.`);
}
