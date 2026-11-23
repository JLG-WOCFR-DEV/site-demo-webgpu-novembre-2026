/**
 * Logos — l'atelier de matières pour logos (logos.html), d'après Form (amirmushich.com/lab/form) : à gauche les
 * matières, au centre le logo en direct sur damier, à droite les réglages et les exports.
 *
 * Tout passe par le module Presse `data-logo` (src/presse/logo.ts) : la page tient une configuration, la donne au
 * contrôleur (`configurer`), et ce qu'on voit est exactement ce que redonnent le bloc HTML et le JSON copiés. L'état
 * vit dans l'adresse (#logo=…) ; l'historique (annuler, rétablir) garde des configurations entières.
 */
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";
import { mountPagesNav } from "../pages-nav.ts";
import { enhanceAngle } from "../presse/angle.ts";
import { creerFocusItinerant } from "../presse/comportements/focus-itinerant.ts";
import { zipBytes } from "../createur/zip.ts";
import {
  alea,
  blocHtml,
  COMMUNS,
  configParDefaut,
  depuisHash,
  echantillonner,
  ffmpegTxt,
  ICONES,
  initLogo,
  MATIERES,
  MATIERES_NOMS,
  nomImage,
  normaliserValeur,
  valeursDe,
  versHash,
  versJson,
  type ConfigLogo,
  type ControleLogo,
  type DefReglage,
  type Matiere,
} from "../presse/logo.ts";

mountPagesNav();

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const logoEl = $("#logo");
const scene = $("#scene");
const message = $("#message");
const svg = (corps: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${corps}</svg>`;
const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const dire = (t: string) => {
  message.textContent = t;
};

/* ───────────────────────── État ───────────────────────── */

function configDepart(): ConfigLogo {
  const h = depuisHash(location.hash);
  if (h) {
    if (!h.src && !h.texte) h.src = "conference/ubs-logo.svg";
    return h;
  }
  const c = configParDefaut("liquide-metal");
  c.src = "conference/ubs-logo.svg";
  return c;
}
let config = configDepart();
let nomSource = config.src ? config.src.split("/").pop()!.replace(/\.\w+$/, "") : "presse";
const verrous = new Set<string>();
let graine = (Date.now() % 100000) | 0;
let ctl: ControleLogo;

/** Historique : des configurations entières, en JSON. */
const pile: string[] = [];
let rang = -1;
function memoriser() {
  const j = JSON.stringify(config);
  if (pile[rang] === j) return;
  pile.splice(rang + 1);
  pile.push(j);
  if (pile.length > 80) pile.shift();
  rang = pile.length - 1;
  majHistorique();
}
function majHistorique() {
  $<HTMLButtonElement>("#annuler").disabled = rang <= 0;
  $<HTMLButtonElement>("#retablir").disabled = rang >= pile.length - 1;
}
async function revenir(d: number) {
  const r = rang + d;
  if (r < 0 || r >= pile.length) return;
  rang = r;
  majHistorique();
  await appliquer(JSON.parse(pile[rang]!) as ConfigLogo, { memoire: false });
}

let attente: number | undefined;
/** Une nouvelle configuration : au logo, au panneau, à l'adresse, à l'historique (`memoire`, différé pour un curseur). */
async function appliquer(c: ConfigLogo, o: { memoire?: boolean | "differe"; panneau?: boolean } = {}) {
  const avant = config;
  config = c;
  const sourceChange = avant.src !== c.src || avant.texte !== c.texte || avant.police !== c.police || avant.marge !== c.marge || avant.sansFond !== c.sansFond;
  if (o.panneau !== false) construirePanneau(avant.matiere !== c.matiere);
  majMatieres();
  majCode();
  majFondApercu();
  try {
    history.replaceState(null, "", `#${versHash(c)}`);
  } catch {
    /* adresse en lecture seule (aperçu) */
  }
  if (o.memoire !== false) {
    clearTimeout(attente);
    if (o.memoire === "differe") attente = window.setTimeout(memoriser, 350);
    else memoriser();
  }
  await ctl.configurer(c);
  majTempsMax();
  if (sourceChange) planifierVignettes();
}
const avec = (f: (c: ConfigLogo) => void) => {
  const c = structuredClone(config);
  f(c);
  return c;
};

/* ───────────────────────── Matières ───────────────────────── */

const liste = $("#liste-matieres");
liste.innerHTML = MATIERES_NOMS.map((m) => {
  const d = MATIERES[m];
  return `<li><button type="button" class="matiere" data-cle="${m}" aria-pressed="false" title="${echap(d.description)}">
    <span class="vignette" aria-hidden="true">${svg(d.icone)}<img alt="" hidden /></span>
    <span class="matiere-nom">${echap(d.nom)}</span>
    ${d.periode ? `<span class="badge" title="Boucle exacte">${svg('<path d="M4 12a6 6 0 0 1 10-4.5L16 9M20 12a6 6 0 0 1-10 4.5L8 15" /><path d="M16 4v5h-5M8 20v-5h5" />')}<span class="cache">, boucle exacte</span></span>` : ""}
  </button></li>`;
}).join("");
creerFocusItinerant(liste, { elements: "button.matiere", orientation: "les-deux", activation: "manuelle" });
liste.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button.matiere");
  if (!b) return;
  const m = b.dataset.cle as Matiere;
  if (m === config.matiere) return;
  void appliquer(
    avec((c) => {
      c.matiere = m;
      c.preset = "";
      c.valeurs = valeursDe(m);
      c.masque = MATIERES[m].masqueDefaut;
      c.instant = -1;
    }),
  );
});
function majMatieres() {
  for (const b of liste.querySelectorAll<HTMLButtonElement>("button.matiere")) b.setAttribute("aria-pressed", String(b.dataset.cle === config.matiere));
  logoEl.setAttribute("aria-label", `${config.texte || nomSource} en ${MATIERES[config.matiere].nom.toLowerCase()}`);
}

/** Les vignettes : chaque matière (réglages par défaut) sur le logo courant, rendues hors écran une à une. */
let jetonVignettes = 0;
let minuteurVignettes: number | undefined;
function planifierVignettes() {
  clearTimeout(minuteurVignettes);
  minuteurVignettes = window.setTimeout(() => void vignettes(), 400);
}
async function vignettes() {
  const j = ++jetonVignettes;
  const { vignette } = await import("../presse/logo-rendu.ts");
  for (const m of MATIERES_NOMS) {
    if (j !== jetonVignettes) return;
    const c = configParDefaut(m);
    c.src = config.src;
    c.texte = config.texte;
    c.police = config.police;
    c.marge = config.marge;
    c.sansFond = config.sansFond;
    try {
      const cv = await vignette(c, 112, 72, MATIERES[m].instantBeau, 2);
      if (j !== jetonVignettes) return;
      const img = liste.querySelector<HTMLImageElement>(`button[data-cle="${m}"] img`)!;
      img.src = cv.toDataURL("image/png");
      img.hidden = false;
      (img.previousElementSibling as SVGElement | null)?.style.setProperty("display", "none");
    } catch {
      /* l'icône reste */
    }
  }
}

/* ───────────────────────── Panneau de réglages ───────────────────────── */

const champs = $("#champs");
const communs = $("#communs");
const presets = $("#presets");
const ICONE_VERROU = svg('<rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />');
const ICONE_LIBRE = svg('<rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-2" />');

const affichage = (r: DefReglage, v: number) => (r.angle ? `${Math.round(v)}°` : r.pas && r.pas >= 1 ? String(Math.round(v)) : v.toFixed(2).replace(".", ","));
const couleur6 = (v: string) => (v === "transparent" ? "#000000" : v.slice(0, 7));

function ligneReglage(r: DefReglage, v: unknown, id: string): string {
  const verrou = `<button type="button" class="verrou" data-verrou="${r.cle}" aria-pressed="${verrous.has(r.cle)}" aria-label="Verrouiller : ${echap(r.libelle)}" title="Verrouiller (le hasard n'y touche pas)">${verrous.has(r.cle) ? ICONE_VERROU : ICONE_LIBRE}</button>`;
  const ic = `<span class="ic" title="${echap(r.libelle)}">${svg(r.icone)}</span>`;
  switch (r.type) {
    case "nombre":
      if (r.angle)
        return `<div class="ligne ligne-angle">${ic}<label class="angle-champ"><span class="cache">${echap(r.libelle)}</span><input type="number" data-angle data-cle="${r.cle}" id="${id}" min="-180" max="180" step="1" value="${Number(v) > 180 ? Number(v) - 360 : Number(v)}" /></label><output class="lu">${affichage(r, Number(v))}</output>${verrou}</div>`;
      return `<div class="ligne">${ic}<label class="curseur"><span class="cache">${echap(r.libelle)}</span><input type="range" data-cle="${r.cle}" id="${id}" min="${r.min}" max="${r.max}" step="${r.pas}" value="${v}" /></label><output class="lu" for="${id}">${affichage(r, Number(v))}</output>${verrou}</div>`;
    case "couleur":
      return `<div class="ligne">${ic}<label class="nuance"><span class="cache">${echap(r.libelle)}</span><input type="color" data-cle="${r.cle}" id="${id}" value="${couleur6(String(v))}" /></label><span class="lu code-couleur">${echap(String(v))}</span>${verrou}</div>`;
    case "couleurs": {
      const l = v as string[];
      return `<div class="ligne ligne-couleurs">${ic}<div class="nuances" role="group" aria-label="${echap(r.libelle)}">${l
        .map((c, i) =>
          c === "transparent"
            ? `<span class="nuance nuance-vide" title="Transparent (le froid laisse voir le fond)"><span class="cache">Couleur ${i + 1} : transparent</span></span>`
            : `<label class="nuance"><span class="cache">Couleur ${i + 1}</span><input type="color" data-cle="${r.cle}" data-i="${i}" value="${couleur6(c)}" /></label>`,
        )
        .join("")}
        <button type="button" class="mini" data-ajout="${r.cle}" aria-label="Ajouter une couleur" title="Ajouter une couleur" ${l.length >= (r.nombre ?? 6) ? "disabled" : ""}>${svg('<path d="M12 5v14M5 12h14" />')}</button>
        <button type="button" class="mini" data-retrait="${r.cle}" aria-label="Retirer la dernière couleur" title="Retirer la dernière couleur" ${l.filter((c) => c !== "transparent").length <= 1 ? "disabled" : ""}>${svg('<path d="M5 12h14" />')}</button>
      </div>${verrou}</div>`;
    }
    case "choix":
      return `<div class="ligne">${ic}<label class="choix"><span class="cache">${echap(r.libelle)}</span><select data-cle="${r.cle}" id="${id}">${r.choix!.map(([k, , lib]) => `<option value="${k}" ${k === v ? "selected" : ""}>${echap(lib)}</option>`).join("")}</select></label>${verrou}</div>`;
    case "bool":
      return `<div class="ligne">${ic}<label class="interrupteur"><input type="checkbox" data-cle="${r.cle}" id="${id}" ${v ? "checked" : ""} /><span>${echap(r.libelle)}</span></label>${verrou}</div>`;
  }
}

function construirePanneau(matiereChange: boolean) {
  const d = MATIERES[config.matiere];
  if (matiereChange) verrous.clear();
  $("#nom-matiere").textContent = d.nom;
  $("#desc-matiere").textContent = d.description + (d.periode ? ` — boucle exacte en ${(d.periode / 1000 / (config.vitesse || 1)).toFixed(2).replace(".", ",")} s` : " — sans période : la séquence boucle par fondu enchaîné");
  presets.innerHTML = Object.entries(d.presets)
    .map(([k, p], i) => `<button type="button" class="preset" data-preset="${k}" aria-pressed="${config.preset === k || (!config.preset && i === 0)}">${echap(p.nom)}</button>`)
    .join("");
  champs.innerHTML = d.reglages.map((r, i) => ligneReglage(r, config.valeurs[r.cle], `r-${i}`)).join("");
  const survols = [
    ["aucun", "Le pointeur ne change rien", '<circle cx="12" cy="12" r="8" /><path d="M6.5 6.5l11 11" />'],
    ["vitesse", "La vitesse suit le pointeur", ICONES.vitesse],
    ["distorsion", "La distorsion suit le pointeur", ICONES.distorsion],
  ] as const;
  communs.innerHTML = [
    `<div class="ligne"><span class="ic" title="Vitesse">${svg(ICONES.vitesse)}</span><label class="curseur"><span class="cache">Vitesse</span><input type="range" data-commun="vitesse" min="${COMMUNS.vitesse[0]}" max="${COMMUNS.vitesse[1]}" step="0.05" value="${config.vitesse}" /></label><output class="lu">${config.vitesse.toFixed(2).replace(".", ",")}</output><span></span></div>`,
    d.mouvement
      ? `<div class="ligne"><span class="ic" title="Mouvement ajouté au filtre">${svg(ICONES.mouvement)}</span><label class="curseur"><span class="cache">Ampleur du mouvement ajouté au filtre</span><input type="range" data-commun="mouvement" min="0" max="1" step="0.05" value="${config.mouvement}" /></label><output class="lu">${config.mouvement.toFixed(2).replace(".", ",")}</output><span></span></div>`
      : "",
    `<div class="ligne"><span class="ic" title="Survol">${svg(ICONES.survol)}</span><div class="segment" role="radiogroup" aria-label="Au survol">${survols
      .map(([k, lib, ic]) => `<label class="pastille" title="${lib}"><input type="radio" name="survol" value="${k}" ${config.survol === k ? "checked" : ""} />${svg(ic)}<span class="cache">${lib}</span></label>`)
      .join("")}</div><span></span><span></span></div>`,
    `<div class="ligne"><span class="ic" title="Marge autour du logo">${svg(ICONES.marge)}</span><label class="curseur"><span class="cache">Marge autour du logo</span><input type="range" data-commun="marge" min="0" max="0.5" step="0.01" value="${config.marge}" /></label><output class="lu">${config.marge.toFixed(2).replace(".", ",")}</output><span></span></div>`,
    `<div class="ligne"><span class="ic" title="Fond">${svg(ICONES.fond)}</span><div class="fond-ligne"><label class="nuance"><span class="cache">Couleur de fond</span><input type="color" data-commun="fond" value="${couleur6(config.fond)}" /></label><label class="interrupteur"><input type="checkbox" data-commun="transparent" ${config.fond === "transparent" ? "checked" : ""} /><span>Fond transparent</span></label></div></div>`,
    d.preparation
      ? ""
      : `<div class="ligne"><span class="ic" title="Découpe">${svg(ICONES.decoupe)}</span><label class="interrupteur"><input type="checkbox" data-commun="masque" ${config.masque ? "checked" : ""} /><span>Découper à la silhouette</span></label><span></span><span></span></div>`,
    `<div class="ligne"><span class="ic" title="Fond de l'image source">${svg(ICONES.image)}</span><label class="interrupteur"><input type="checkbox" data-commun="sans-fond" ${config.sansFond ? "checked" : ""} /><span>Retirer le fond uni du logo</span></label><span></span><span></span></div>`,
    config.texte && !config.src
      ? `<div class="ligne"><span class="ic" title="Texte">${svg('<path d="M5 6V4h14v2M12 4v16M9 20h6" />')}</span><label class="texte"><span class="cache">Texte du logo</span><input type="text" data-commun="texte" maxlength="40" value="${echap(config.texte)}" /></label><label class="choix"><span class="cache">Police</span><select data-commun="police"><option value="archivo" ${config.police === "archivo" ? "selected" : ""}>Archivo</option><option value="bodoni" ${config.police === "bodoni" ? "selected" : ""}>Bodoni</option></select></label><span></span></div>`
      : "",
  ].join("");
  for (const i of champs.querySelectorAll<HTMLInputElement>("input[data-angle]")) enhanceAngle(i);
}

function valeurDe(el: HTMLInputElement | HTMLSelectElement, r: DefReglage): unknown {
  if (r.type === "bool") return (el as HTMLInputElement).checked;
  if (r.type === "nombre" && r.angle) {
    let a = ((Number(el.value) % 360) + 360) % 360;
    if ((r.max ?? 360) < 360) a = Math.min(r.max!, a);
    return a;
  }
  if (r.type === "couleur") {
    const avant = String(config.valeurs[r.cle] ?? "");
    const alpha = avant.length === 9 ? avant.slice(7) : "";
    return el.value + alpha;
  }
  return el.value;
}

$("#reglages").addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
  const d = MATIERES[config.matiere];
  if (el.dataset.cle) {
    const r = d.reglages.find((x) => x.cle === el.dataset.cle)!;
    let v: unknown;
    if (r.type === "couleurs") {
      const l = [...(config.valeurs[r.cle] as string[])];
      l[Number(el.dataset.i)] = el.value;
      v = l;
    } else v = valeurDe(el, r);
    const nv = normaliserValeur(r, v);
    const lu = el.closest(".ligne")?.querySelector(".lu");
    if (lu) lu.textContent = typeof nv === "number" ? affichage(r, nv) : String(nv);
    void appliquer(
      avec((c) => {
        c.valeurs[r.cle] = nv;
      }),
      { panneau: false, memoire: el.type === "range" || el.type === "color" || el.type === "number" ? "differe" : true },
    );
    return;
  }
  const k = el.dataset.commun ?? (el.name === "survol" ? "survol" : "");
  if (!k) return;
  const lu = el.closest(".ligne")?.querySelector(".lu");
  const reconstruire = k === "transparent" || k === "masque";
  void appliquer(
    avec((c) => {
      if (k === "vitesse" || k === "marge" || k === "mouvement") {
        c[k] = Number(el.value);
        if (lu) lu.textContent = Number(el.value).toFixed(2).replace(".", ",");
      } else if (k === "survol") c.survol = el.value as ConfigLogo["survol"];
      else if (k === "fond") c.fond = el.value;
      else if (k === "transparent") c.fond = el.checked ? "transparent" : couleur6(($('input[data-commun="fond"]') as HTMLInputElement).value);
      else if (k === "masque") c.masque = el.checked;
      else if (k === "sans-fond") c.sansFond = el.checked;
      else if (k === "texte") c.texte = el.value || "Presse";
      else if (k === "police") c.police = el.value === "bodoni" ? "bodoni" : "archivo";
    }),
    { panneau: reconstruire, memoire: el.type === "range" || el.type === "color" || el.type === "text" ? "differe" : true },
  );
});
// Un champ de texte ne doit pas reconstruire le panneau à chaque lettre : seul « change » le fait (rien à faire ici).
$("#reglages").addEventListener("click", (e) => {
  const t = e.target as Element;
  const p = t.closest<HTMLButtonElement>("button[data-preset]");
  if (p) {
    const k = p.dataset.preset!;
    void appliquer(
      avec((c) => {
        const garde = Object.fromEntries([...verrous].filter((v) => c.valeurs[v] !== undefined).map((v) => [v, c.valeurs[v]!]));
        c.preset = k;
        c.valeurs = { ...valeursDe(c.matiere, k), ...garde };
      }),
    );
    return;
  }
  const v = t.closest<HTMLButtonElement>("button[data-verrou]");
  if (v) {
    const k = v.dataset.verrou!;
    if (verrous.has(k)) verrous.delete(k);
    else verrous.add(k);
    v.setAttribute("aria-pressed", String(verrous.has(k)));
    v.innerHTML = verrous.has(k) ? ICONE_VERROU : ICONE_LIBRE;
    return;
  }
  const a = t.closest<HTMLButtonElement>("button[data-ajout], button[data-retrait]");
  if (a) {
    const cle = a.dataset.ajout ?? a.dataset.retrait!;
    const r = MATIERES[config.matiere].reglages.find((x) => x.cle === cle)!;
    void appliquer(
      avec((c) => {
        const l = [...(c.valeurs[cle] as string[])];
        if (a.dataset.ajout) l.push(l[l.length - 1] === "transparent" ? "#ffffff" : l[l.length - 1]!);
        else l.pop();
        c.valeurs[cle] = normaliserValeur(r, l);
      }),
    );
  }
});

/* ───────────────────────── Outils ───────────────────────── */

$("#annuler").addEventListener("click", () => void revenir(-1));
$("#retablir").addEventListener("click", () => void revenir(1));
addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
  if ((e.target as Element).closest("input[type=text], textarea")) return;
  e.preventDefault();
  void revenir(e.shiftKey ? 1 : -1);
});
$("#alea").addEventListener("click", () => {
  graine = (graine * 1103515245 + 12345) >>> 0;
  void appliquer(
    avec((c) => {
      c.valeurs = alea(c.matiere, c.valeurs, graine, verrous);
      c.preset = "";
    }),
  );
  dire(`Au hasard (graine ${graine})${verrous.size ? `, ${verrous.size} réglage${verrous.size > 1 ? "s" : ""} verrouillé${verrous.size > 1 ? "s" : ""}` : ""}.`);
});
$("#lien").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}#${versHash(config)}`;
  const blob = config.src.startsWith("blob:");
  try {
    await navigator.clipboard.writeText(url);
    dire(blob ? "Lien copié — sans le fichier déposé, qui ne quitte pas ce navigateur (le lien montre le logo d'exemple)." : "Lien copié.");
  } catch {
    dire(url);
  }
});

/* Sources : exemples, fichier, glisser-déposer. */
const selExemple = $<HTMLSelectElement>("#exemple");
function choisirSource(v: string, nom?: string) {
  const texte = v.startsWith("texte:");
  nomSource = nom ?? (texte ? v.slice(6).toLowerCase() : v.split("/").pop()!.replace(/\.\w+$/, ""));
  void appliquer(
    avec((c) => {
      c.src = texte ? "" : v;
      c.texte = texte ? v.slice(6) : "";
    }),
  );
}
selExemple.value = config.src || (config.texte ? "texte:Presse" : "conference/ubs-logo.svg");
selExemple.addEventListener("change", () => choisirSource(selExemple.value));
const fichier = $<HTMLInputElement>("#fichier");
$("#ouvrir").addEventListener("click", () => fichier.click());
const ACCEPTE = /^image\/(svg\+xml|png|webp)$/;
function prendreFichier(f: File | undefined) {
  if (!f) return;
  if (!ACCEPTE.test(f.type) && !/\.(svg|png|webp)$/i.test(f.name)) {
    dire(`« ${f.name} » : un SVG, un PNG ou un WebP, s'il vous plaît.`);
    return;
  }
  const url = URL.createObjectURL(f);
  dire(`Logo : ${f.name}`);
  choisirSource(url, f.name.replace(/\.\w+$/, "").replace(/[^\w-]+/g, "-").toLowerCase() || "logo");
}
fichier.addEventListener("change", () => prendreFichier(fichier.files?.[0]));
let profondeur = 0;
addEventListener("dragenter", (e) => {
  if (!e.dataTransfer?.types.includes("Files")) return;
  profondeur++;
  scene.classList.add("depot-actif");
});
addEventListener("dragleave", () => {
  profondeur = Math.max(0, profondeur - 1);
  if (!profondeur) scene.classList.remove("depot-actif");
});
addEventListener("dragover", (e) => {
  if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
});
addEventListener("drop", (e) => {
  if (!e.dataTransfer?.files.length) return;
  e.preventDefault();
  profondeur = 0;
  scene.classList.remove("depot-actif");
  prendreFichier(e.dataTransfer.files[0]);
});

/* Fond de l'aperçu (le damier dit la transparence). */
const selFond = $<HTMLSelectElement>("#fond-apercu");
function majFondApercu() {
  scene.dataset.fond = config.fond !== "transparent" ? "couleur" : selFond.value === "couleur" ? "damier" : selFond.value;
}
selFond.addEventListener("change", majFondApercu);

/* ───────────────────────── Temps ───────────────────────── */

const btnLecture = $<HTMLButtonElement>("#lecture");
const curseurTemps = $<HTMLInputElement>("#temps");
const tempsLu = $("#temps-lu");
const reduit = matchMedia("(prefers-reduced-motion: reduce)");
function majTempsMax() {
  const d = MATIERES[config.matiere];
  curseurTemps.max = String(d.periode ? Math.round(d.periode * 2) : 12000);
}
function majLecture() {
  const on = ctl.lecture() && !reduit.matches;
  btnLecture.classList.toggle("en-pause", !on);
  btnLecture.setAttribute("aria-label", on ? "Pause" : "Lecture");
  btnLecture.title = reduit.matches ? "Mouvement réduit : image fixe (le curseur choisit l'instant)" : on ? "Pause" : "Lecture";
}
btnLecture.addEventListener("click", () => {
  ctl.lecture(!ctl.lecture());
  majLecture();
});
curseurTemps.addEventListener("input", () => {
  ctl.lecture(false);
  majLecture();
  ctl.allerA(Number(curseurTemps.value));
});
curseurTemps.addEventListener("change", () => {
  // L'instant choisi devient celui de l'image fixe et des exports PNG.
  void appliquer(
    avec((c) => {
      c.instant = Math.round(Number(curseurTemps.value));
    }),
    { panneau: false },
  );
});
function horloge() {
  if (ctl) {
    const t = ctl.temps();
    const max = Number(curseurTemps.max);
    if (document.activeElement !== curseurTemps) curseurTemps.value = String(t % max);
    tempsLu.textContent = `${(t / 1000).toFixed(2).replace(".", ",")} s`;
  }
  requestAnimationFrame(horloge);
}

/* ───────────────────────── Instantanés ───────────────────────── */

const CLE_INST = "logos:instantanes";
type Instantane = { config: ConfigLogo; image: string };
let instantanes: Instantane[] = [];
try {
  const o = JSON.parse(localStorage.getItem(CLE_INST) ?? "[]") as Instantane[];
  if (Array.isArray(o)) instantanes = o.filter((x) => x && x.config && typeof x.image === "string").slice(0, 12);
} catch {
  /* stockage indisponible */
}
function majInstantanes() {
  $("#instantanes").innerHTML = instantanes
    .map((s, i) => `<li><button type="button" class="instantane" data-inst="${i}" aria-label="Instantané ${i + 1} : ${echap(MATIERES[s.config.matiere].nom)}" title="${echap(MATIERES[s.config.matiere].nom)}"><img alt="" src="${s.image}" /></button></li>`)
    .join("");
  try {
    localStorage.setItem(CLE_INST, JSON.stringify(instantanes.filter((s) => !s.config.src.startsWith("blob:"))));
  } catch {
    /* rien */
  }
}
$("#instantane").addEventListener("click", async () => {
  const cv = await ctl.rendreImage(ctl.temps(), 1, { largeur: 96, hauteur: 64 });
  instantanes.unshift({ config: structuredClone(config), image: cv.toDataURL("image/png") });
  instantanes = instantanes.slice(0, 12);
  majInstantanes();
  dire("Instantané gardé.");
});
$("#instantanes").addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button[data-inst]");
  const s = b && instantanes[Number(b.dataset.inst)];
  if (s) void appliquer(structuredClone(s.config));
});

/* ───────────────────────── Onglets ───────────────────────── */

const onglets = $(".onglets");
creerFocusItinerant(onglets, { elements: "[role=tab]", orientation: "horizontal", activation: "auto" });
onglets.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("[role=tab]");
  if (!b) return;
  for (const t of onglets.querySelectorAll<HTMLButtonElement>("[role=tab]")) {
    const on = t === b;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute("aria-controls")}`).hidden = !on;
  }
  majCode();
});

/* ───────────────────────── Exports ───────────────────────── */

const base = () => `${nomSource || "logo"}-${config.matiere}`;
function telecharger(blob: Blob, nom: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const versPng = (c: HTMLCanvasElement) => new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("PNG impossible"))), "image/png"));
const facteur = () => Number((document.querySelector<HTMLInputElement>('input[name="facteur"]:checked') ?? { value: "2" }).value);
const progression = $<HTMLProgressElement>("#progression");
let occupe = false;
async function tache(f: () => Promise<void>) {
  if (occupe) return;
  occupe = true;
  document.body.classList.add("occupe");
  try {
    await f();
  } catch (e) {
    dire(`Export impossible : ${(e as Error).message}`);
    console.warn(e);
  } finally {
    occupe = false;
    document.body.classList.remove("occupe");
    progression.hidden = true;
  }
}
function majCode() {
  const nom = config.texte || ($("#logo").getAttribute("aria-label") ?? "Logo");
  const c = structuredClone(config);
  if (c.src.startsWith("blob:")) c.src = `${nomSource}.svg`;
  ($("#code-html") as HTMLTextAreaElement).value = blocHtml(c, nom);
  const r = logoEl.getBoundingClientRect();
  const k = facteur();
  $("#taille-lue").textContent = `${Math.round(r.width * k)} × ${Math.round(r.height * k)} px, fond ${config.fond === "transparent" ? "transparent" : config.fond}`;
  const d = MATIERES[config.matiere];
  const seq = sequence();
  $("#boucle-lue").textContent = `${seq.images.length} images, ${seq.duree.toFixed(2).replace(".", ",")} s — ${seq.boucle === "periode" ? "boucle exacte (durée calée sur la période)" : seq.boucle === "fondu" ? "boucle par fondu enchaîné (la matière n'a pas de période)" : "sans boucle"}${d.mouvement ? "" : ""}`;
}
const sequence = () =>
  echantillonner({
    duree: Number(($("#duree") as HTMLInputElement).value) || 4,
    ips: Number(($("#ips") as HTMLSelectElement).value) || 30,
    vitesse: config.vitesse || 1,
    debut: config.instant >= 0 ? config.instant : 0,
    periode: MATIERES[config.matiere].periode,
    boucle: ($("#boucle") as HTMLInputElement).checked,
  });
for (const s of ["#duree", "#ips", "#boucle"]) $(s).addEventListener("input", majCode);
for (const i of document.querySelectorAll('input[name="facteur"]')) i.addEventListener("change", majCode);

$("#export-png").addEventListener("click", () =>
  tache(async () => {
    dire("Rendu de l'image…");
    const cv = await ctl.rendreImage(ctl.temps(), facteur());
    telecharger(await versPng(cv), `${base()}.png`);
    dire(`PNG : ${cv.width} × ${cv.height} px.`);
  }),
);
$("#export-zip").addEventListener("click", () =>
  tache(async () => {
    const seq = sequence();
    const k = facteur();
    const fichiers: { name: string; data: Uint8Array }[] = [];
    progression.hidden = false;
    let l = 0;
    let h = 0;
    await ctl.rendreSequence(seq, k, async (cv, i) => {
      l = cv.width;
      h = cv.height;
      fichiers.push({ name: nomImage(base(), i), data: new Uint8Array(await (await versPng(cv)).arrayBuffer()) });
      progression.value = (i + 1) / seq.images.length;
      dire(`Image ${i + 1} sur ${seq.images.length}…`);
    });
    const enc = new TextEncoder();
    fichiers.push({ name: "ffmpeg.txt", data: enc.encode(ffmpegTxt({ base: base(), ips: seq.ips, largeur: l, hauteur: h, fond: config.fond })) });
    fichiers.push({ name: `${base()}.json`, data: enc.encode(versJson(config)) });
    telecharger(new Blob([zipBytes(fichiers) as BlobPart], { type: "application/zip" }), `${base()}-sequence.zip`);
    dire(`Séquence : ${seq.images.length} images ${l} × ${h} px, ${seq.ips} images/s, ${seq.boucle === "non" ? "sans boucle" : "en boucle"}. ffmpeg.txt dans l'archive.`);
  }),
);

/** WebM avec alpha : MediaRecorder sur un canvas 2D où l'on pose chaque image de la séquence (VP9 ou VP8). */
const typeWebm = typeof MediaRecorder !== "undefined" ? ["video/webm;codecs=vp9", "video/webm;codecs=vp8"].find((t) => MediaRecorder.isTypeSupported(t)) : undefined;
if (!typeWebm) {
  const b = $<HTMLButtonElement>("#export-webm");
  b.disabled = true;
  b.title = "Ce navigateur n'enregistre pas de WebM (MediaRecorder absent) : passez par la séquence PNG et ffmpeg.txt";
}
$("#export-webm").addEventListener("click", () =>
  tache(async () => {
    if (!typeWebm) {
      dire("Ce navigateur n'enregistre pas de WebM : la séquence PNG et ffmpeg.txt font la vidéo.");
      return;
    }
    const seq = sequence();
    const k = Math.min(2, facteur());
    const r = logoEl.getBoundingClientRect();
    const toile = document.createElement("canvas");
    toile.width = Math.round(r.width * k) & ~1;
    toile.height = Math.round(r.height * k) & ~1;
    const x = toile.getContext("2d")!;
    const flux = toile.captureStream(0);
    const piste = flux.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const rec = new MediaRecorder(flux, { mimeType: typeWebm, videoBitsPerSecond: 8_000_000 });
    const morceaux: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
    const fini = new Promise<void>((ok) => (rec.onstop = () => ok()));
    rec.start();
    progression.hidden = false;
    const pas = 1000 / seq.ips;
    let t0 = performance.now();
    await ctl.rendreSequence(seq, k, async (cv, i) => {
      x.clearRect(0, 0, toile.width, toile.height);
      x.drawImage(cv, 0, 0, toile.width, toile.height);
      piste.requestFrame();
      progression.value = (i + 1) / seq.images.length;
      // MediaRecorder horodate à l'horloge murale : une image par pas.
      const attente = t0 + (i + 1) * pas - performance.now();
      if (attente > 0) await new Promise((ok) => setTimeout(ok, attente));
      else t0 -= attente;
    });
    rec.stop();
    await fini;
    const blob = new Blob(morceaux, { type: "video/webm" });
    telecharger(blob, `${base()}.webm`);
    dire(`WebM (${typeWebm.includes("vp9") ? "VP9" : "VP8"}, alpha gardé par Chromium) : ${(blob.size / 1024).toFixed(0)} Ko, ${toile.width} × ${toile.height} px. Safari et Firefox : passer par ffmpeg.txt.`);
  }),
);
$("#copier-html").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(($("#code-html") as HTMLTextAreaElement).value);
    dire("Bloc HTML copié.");
  } catch {
    ($("#code-html") as HTMLTextAreaElement).select();
  }
});
$("#copier-json").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(versJson(config));
    dire("JSON copié.");
  } catch {
    dire("Copie refusée par le navigateur.");
  }
});
$("#telecharger-json").addEventListener("click", () => telecharger(new Blob([versJson(config)], { type: "application/json" }), `${base()}.json`));

/* ───────────────────────── Départ ───────────────────────── */

logoEl.addEventListener("logo:avertissement", (e) => dire((e as CustomEvent<{ message: string }>).detail.message));
logoEl.addEventListener("logo:etat", (e) => {
  const d = (e as CustomEvent<{ etat: string; erreur?: string }>).detail;
  if (d.etat === "repli") dire("WebGL2 indisponible : le logo d'origine, sans matière.");
  if (d.etat === "erreur") dire(`Logo illisible : ${d.erreur ?? ""}`);
  majLecture();
});
async function demarrer() {
  const [c] = await initLogo(logoEl);
  ctl = c!;
  construirePanneau(true);
  majMatieres();
  majInstantanes();
  memoriser();
  await appliquer(config, { memoire: false });
  majLecture();
  planifierVignettes();
  requestAnimationFrame(horloge);
  reduit.addEventListener("change", majLecture);
  // Pour les essais automatisés.
  (window as unknown as { __logos: unknown }).__logos = { ctl, config: () => config, appliquer, sequence };
}
void demarrer();
