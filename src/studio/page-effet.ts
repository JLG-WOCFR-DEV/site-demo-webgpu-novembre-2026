/**
 * Studio — le gabarit de page d'effet : `monterPageEffet(hote, id)` fait, depuis le seul registre, une page de
 * réglage « logiciel » pour l'effet `id` (studio-effet.html?effet=<id>) :
 *
 *   barre       menu Pages, retour au Sampler Presse, choix de l'effet, catégorie, rendu (« WebGPU requis » / « DOM ») ;
 *               appareil (bureau, tablette, téléphone), rejouer, comparer avant / après ; copier les attributs, le
 *               HTML, le JSON de réglages, le lien de partage ; réinitialiser ; aide (raccourcis) ;
 *   centre      l'aperçu : la démo de la fiche dans un cadre (studio-apercu.html, document à part), et en mode
 *               comparaison un second cadre aux réglages par défaut ; dessous, le code (HTML, JSON) ;
 *   droite      l'inspecteur GÉNÉRÉ depuis le schéma de la fiche (src/studio/inspecteur.ts), puis la liste des
 *               attributs `data-*` écrits, en direct.
 *
 * L'état vit dans le fragment de l'adresse (format v1, src/studio/etat.ts) : un lien copié rouvre la même page, et le
 * cadre d'aperçu lit le même fragment. Raccourcis : src/studio/raccourcis.ts (liste dans la fenêtre d'aide, « ? »).
 * Un effet sans fiche (`parametres`) ou inconnu : la page le dit et propose les effets réglables.
 */
import "./jetons.css";
import "./page-effet.css";
import { EFFETS, type Manifeste } from "../registre/effets.ts";
import type { FicheParametres } from "../registre/parametres/types.ts";
import { attributsDe, depuisHash, estRegle, etatInitial, texteAttributs, versHash, versJson, type Etat } from "./etat.ts";
import { monterDemo, ligneAttributs } from "./demo.ts";
import { monterInspecteur, type Inspecteur } from "./inspecteur.ts";
import { creerRaccourcis, type Registre } from "./raccourcis.ts";
import { ic } from "./icones.ts";
import { majPucesRendu, puceRendu } from "./rendu.ts";

const NOMS_CATEGORIES: Record<string, string> = { texte: "Texte", image: "Image", matiere: "Matière", interface: "Interface", transition: "Transition", forme: "Forme", dessin: "Dessin", page: "Page" };
const APPAREILS = [
  { id: "bureau", libelle: "Bureau", largeur: 0 },
  { id: "tablette", libelle: "Tablette (834 px)", largeur: 834 },
  { id: "mobile", libelle: "Téléphone (390 px)", largeur: 390 },
] as const;
type Appareil = (typeof APPAREILS)[number]["id"];

const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    // Repli : une zone de texte hors écran (presse-papiers refusé, page non sécurisée).
    const t = document.createElement("textarea");
    t.value = texte;
    t.setAttribute("readonly", "");
    t.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.append(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    t.remove();
    return ok;
  }
}

function pageIntrouvable(hote: HTMLElement, id: string) {
  const reglables = EFFETS.filter((x) => x.parametres);
  document.title = "Effet introuvable · Studio · Presse";
  hote.innerHTML = `<main class="st-vide" id="contenu" tabindex="-1">
  <h1>${id ? `Pas de page de réglage pour « ${e(id)} »` : "Choisir un effet"}</h1>
  <p>${id && EFFETS.some((x) => x.id === id) ? "Cet effet est dans le registre, mais n'a pas encore de fiche de paramètres." : "Les effets réglables dans le Studio :"}</p>
  <ul>${reglables.map((x) => `<li><a href="studio-effet.html?effet=${x.id}">${e(x.nom)}</a> — ${e(x.resume)}</li>`).join("")}</ul>
  <p><a href="sampler-presse.html">Tous les effets, dans le Sampler Presse</a></p>
</main>`;
}

export async function monterPageEffet(hote: HTMLElement, id: string): Promise<void> {
  const m = EFFETS.find((x) => x.id === id);
  if (!m?.parametres) return pageIntrouvable(hote, id);
  const fiche: FicheParametres = (await m.parametres()).default;
  const rendu = puceRendu(m, true);
  const lu = depuisHash(fiche, location.hash);
  let etat: Etat = lu.etat;
  let appareil: Appareil = "bureau";
  let compare = false;
  let onglet: "html" | "json" = "html";
  const raccourcis: Registre = creerRaccourcis();

  document.title = `${m.nom} · Studio · Presse`;
  const reglables = EFFETS.filter((x) => x.parametres);
  const bouton = (action: string, icone: string, libelle: string, extra = "") => `<button type="button" class="st-bouton" data-action="${action}" aria-label="${e(libelle)}" title="${e(libelle)}"${extra}>${ic(icone)}</button>`;

  hote.innerHTML = `<div class="st" data-appareil="bureau">
<header class="st-barre">
  <div class="st-barre-g">
    <button type="button" class="st-bouton" data-pages-trigger aria-label="Pages du dépôt" title="Pages du dépôt">${ic("pages")}</button>
    <a class="st-bouton" href="sampler-presse.html" aria-label="Sampler Presse : tous les effets" title="Sampler Presse : tous les effets">${ic("grille")}</a>
    <span class="st-sep" aria-hidden="true"></span>
    <label class="sr" for="st-effet">Effet</label>
    <select id="st-effet" class="st-effet">${reglables.map((x) => `<option value="${x.id}"${x.id === id ? " selected" : ""}>${e(x.nom)}</option>`).join("")}</select>
    <span class="st-puce">${e(NOMS_CATEGORIES[m.categorie] ?? m.categorie)}</span>
    <span class="st-puce ${rendu.classe}" title="${e(rendu.titre)}" data-puce-rendu data-rendu="${e(m.rendu)}">${ic(m.rendu === "DOM" || m.rendu === "canvas 2D" ? "dom" : "gpu", 14)}<span>${e(rendu.texte)}</span></span>
  </div>
  <div class="st-barre-c" role="toolbar" aria-label="Aperçu">
    <div class="st-segments" role="radiogroup" aria-label="Appareil">${APPAREILS.map(
      (a, i) => `<label class="st-segment" title="${e(a.libelle)} (${i + 1})"><input type="radio" name="st-appareil" value="${a.id}"${a.id === "bureau" ? " checked" : ""} />${ic(a.id)}<span class="sr">${e(a.libelle)}</span></label>`,
    ).join("")}</div>
    ${bouton("rejouer", "rejouer", "Rejouer l'aperçu (R)")}
    ${bouton("comparer", "comparer", "Comparer avant / après (B)", ' aria-pressed="false"')}
  </div>
  <div class="st-barre-d" role="toolbar" aria-label="Exporter">
    ${bouton("copier-attributs", "copier-attributs", "Copier les attributs (Maj+A)")}
    ${bouton("copier-html", "copier-html", "Copier le HTML (Maj+H)")}
    ${bouton("copier-json", "copier-json", "Copier le JSON de réglages (Maj+J)")}
    ${bouton("copier-lien", "lien", "Copier le lien de partage (Maj+L)")}
    <span class="st-sep" aria-hidden="true"></span>
    ${bouton("reinitialiser", "reinitialiser", "Réinitialiser les réglages (Maj+R)")}
    ${m.exemple ? `<a class="st-bouton" href="${e(m.exemple)}" aria-label="Page d'exemple : ${e(m.exemple)}" title="Page d'exemple : ${e(m.exemple)}">${ic("page")}</a>` : ""}
    ${bouton("aide", "clavier", "Raccourcis clavier (?)", ' aria-haspopup="dialog"')}
  </div>
</header>
<main class="st-centre" id="contenu" tabindex="-1">
  <h1 class="sr">Studio · ${e(m.nom)}</h1>
  <div class="st-scene">
    <figure class="st-cadre" data-role="avant" hidden>
      <figcaption>Avant · défauts</figcaption>
      <iframe title="Aperçu de ${e(m.nom)} aux réglages par défaut" loading="lazy"></iframe>
    </figure>
    <figure class="st-cadre" data-role="apres">
      <figcaption class="st-cadre-titre" hidden>Après · vos réglages</figcaption>
      <iframe title="Aperçu de ${e(m.nom)}"></iframe>
    </figure>
  </div>
  ${fiche.demo.consigne ? `<p class="st-consigne">${e(fiche.demo.consigne)}</p>` : ""}
  <section class="st-code" aria-label="Code">
    <div class="st-onglets" role="tablist" aria-label="Format">
      <button type="button" role="tab" id="st-o-html" aria-controls="st-code" aria-selected="true">HTML</button>
      <button type="button" role="tab" id="st-o-json" aria-controls="st-code" aria-selected="false" tabindex="-1">JSON</button>
    </div>
    <pre class="st-pre" id="st-code" role="tabpanel" aria-labelledby="st-o-html" tabindex="0"><code></code></pre>
  </section>
</main>
<aside class="st-inspecteur" aria-labelledby="st-t-reglages">
  <div class="st-ins-tete">
    <h2 id="st-t-reglages">Réglages</h2>
    <span class="st-ins-compte" aria-live="polite"></span>
  </div>
  <div class="st-ins-corps"></div>
  <section class="st-attributs" aria-labelledby="st-t-attributs">
    <h2 id="st-t-attributs">Attributs</h2>
    <ul class="st-liste-attributs"></ul>
  </section>
</aside>
<p class="st-statut" role="status" aria-live="polite"></p>
<dialog class="st-aide" aria-labelledby="st-t-aide">
  <div class="st-aide-tete"><h2 id="st-t-aide">Raccourcis clavier</h2><button type="button" class="st-bouton" data-action="fermer-aide" aria-label="Fermer" title="Fermer (Échap)">${ic("fermer")}</button></div>
  <div class="st-aide-corps"></div>
  <p class="st-aide-note">Les lettres seules ne jouent pas dans un champ de saisie. Le fragment de l'adresse (<code>#v=1;…</code>) garde les réglages.</p>
</dialog>
</div>`;

  const racine = hote.querySelector<HTMLElement>(".st")!;
  const q = <T extends Element = HTMLElement>(s: string) => racine.querySelector<T>(s)!;
  const cadreApres = q<HTMLIFrameElement>('[data-role="apres"] iframe');
  const cadreAvant = q<HTMLIFrameElement>('[data-role="avant"] iframe');
  const statut = q(".st-statut");
  const listeAttributs = q(".st-liste-attributs");
  const code = q("#st-code code");
  const compte = q(".st-ins-compte");
  const aide = q<HTMLDialogElement>(".st-aide");

  const srcApercu = (hash: string) => `studio-apercu.html?effet=${encodeURIComponent(id)}#${hash}`;
  let minuteurStatut = 0;
  const dire = (t: string) => {
    statut.textContent = t;
    clearTimeout(minuteurStatut);
    minuteurStatut = window.setTimeout(() => (statut.textContent = ""), 4000);
  };

  /* ── Rendu de l'état : adresse, aperçu, attributs, code ── */
  let minuteurApercu = 0;
  function majApercu(immediat = false) {
    clearTimeout(minuteurApercu);
    const envoyer = () => cadreApres.contentWindow?.postMessage({ type: "studio:etat", hash: versHash(fiche, etat) }, location.origin);
    if (immediat) envoyer();
    else minuteurApercu = window.setTimeout(envoyer, 90);
  }
  function majSorties() {
    const hash = versHash(fiche, etat);
    history.replaceState(null, "", `${location.pathname}${location.search}#${hash}`);
    const d = monterDemo(document, m!, fiche, etat);
    listeAttributs.innerHTML = d.attributsRacine.length || d.ecrits.some((x) => x.cible)
      ? [
          ...d.attributsRacine.map(([n, v]) => ({ n, v, cible: null as string | null, regle: d.ecrits.some((x) => x.nom === n && !x.cible) })),
          ...d.ecrits.filter((x) => x.cible).map((x) => ({ n: x.nom, v: x.valeur ?? "(retiré)", cible: x.cible, regle: true })),
        ]
          .map((a) => `<li${a.regle ? ' class="st-regle"' : ""}><code class="st-nom">${e(a.n)}</code>${a.v !== "" ? `<code class="st-val">${e(a.v)}</code>` : ""}${a.cible ? `<span class="st-cible">sur ${e(a.cible)}</span>` : ""}</li>`)
          .join("")
      : '<li class="st-aucun">Aucun attribut.</li>';
    const n = fiche.parametres.filter((p) => estRegle(fiche, etat, p)).length;
    compte.textContent = n ? `${n} réglé${n > 1 ? "s" : ""}` : "par défaut";
    code.textContent = onglet === "html" ? d.html : JSON.stringify(versJson(fiche, id, etat), null, 2);
  }
  const texteHtml = () => monterDemo(document, m!, fiche, etat).html;
  const texteAttrs = () => {
    const d = monterDemo(document, m!, fiche, etat);
    return texteAttributs(attributsDe(fiche, etat), d.attributsRacine);
  };
  const lien = () => `${location.origin}${location.pathname}?effet=${encodeURIComponent(id)}#${versHash(fiche, etat)}`;

  /* ── Inspecteur ── */
  const inspecteur: Inspecteur = monterInspecteur(
    q(".st-ins-corps"),
    fiche,
    () => etat,
    (neuf, c) => {
      etat = neuf;
      if (c.corrections.length) dire(c.corrections.join(" ; "));
      majApercu(c.final);
      majSorties();
    },
  );

  /* ── Aperçu ── */
  cadreApres.src = srcApercu(versHash(fiche, etat));
  // Le cadre « avant » ne se charge qu'à la première comparaison.
  addEventListener("message", (ev: MessageEvent<{ type?: string }>) => {
    if (ev.origin !== location.origin || ev.source !== cadreApres.contentWindow) return;
    if (ev.data?.type === "studio:pret") racine.dataset.pret = "oui";
  });

  const rejouer = () => {
    cadreApres.contentWindow?.postMessage({ type: "studio:rejouer" }, location.origin);
    if (compare) cadreAvant.contentWindow?.postMessage({ type: "studio:rejouer" }, location.origin);
    dire("Aperçu rejoué.");
  };
  const basculerComparer = (oui = !compare) => {
    compare = oui;
    racine.classList.toggle("st-compare", compare);
    q('[data-role="avant"]').hidden = !compare;
    q(".st-cadre-titre").hidden = !compare;
    q('[data-action="comparer"]').setAttribute("aria-pressed", String(compare));
    if (compare && !cadreAvant.src) cadreAvant.src = srcApercu(`v=1`);
    dire(compare ? "Comparaison : à gauche les défauts, à droite vos réglages." : "Comparaison fermée.");
  };
  const choisirAppareil = (a: Appareil) => {
    appareil = a;
    racine.dataset.appareil = a;
    const radio = racine.querySelector<HTMLInputElement>(`input[name="st-appareil"][value="${a}"]`);
    if (radio) radio.checked = true;
    const l = APPAREILS.find((x) => x.id === a)!;
    racine.style.setProperty("--st-largeur", l.largeur ? `${l.largeur}px` : "100%");
  };
  const reinitialiser = () => {
    etat = etatInitial(fiche);
    inspecteur.rafraichir();
    majApercu(true);
    majSorties();
    dire("Réglages remis par défaut.");
  };
  const copierEt = async (texte: string, quoi: string) => dire((await copier(texte)) ? `${quoi} copié${quoi.endsWith("s") ? "s" : ""}.` : `Copie refusée par le navigateur : ${quoi.toLowerCase()} est dans le panneau Code.`);
  const ACTIONS: Record<string, () => void> = {
    rejouer,
    comparer: () => basculerComparer(),
    reinitialiser,
    "copier-attributs": () => void copierEt(texteAttrs(), "Attributs"),
    "copier-html": () => void copierEt(texteHtml(), "HTML"),
    "copier-json": () => void copierEt(JSON.stringify(versJson(fiche, id, etat), null, 2), "JSON"),
    "copier-lien": () => void copierEt(lien(), "Lien"),
    aide: () => ouvrirAide(),
    "fermer-aide": () => aide.close(),
  };
  q(".st-barre").addEventListener("click", (ev) => {
    const b = (ev.target as Element).closest<HTMLElement>("button[data-action]");
    if (b) ACTIONS[b.dataset.action!]?.();
  });
  aide.addEventListener("click", (ev) => {
    const b = (ev.target as Element).closest<HTMLElement>("button[data-action]");
    if (b) ACTIONS[b.dataset.action!]?.();
    else if (ev.target === aide) aide.close();
  });
  q(".st-barre-c").addEventListener("change", (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.name === "st-appareil") choisirAppareil(t.value as Appareil);
  });
  q<HTMLSelectElement>("#st-effet").addEventListener("change", (ev) => {
    location.href = `studio-effet.html?effet=${encodeURIComponent((ev.target as HTMLSelectElement).value)}`;
  });

  /* ── Onglets du code (flèches gauche / droite) ── */
  const onglets = [q<HTMLButtonElement>("#st-o-html"), q<HTMLButtonElement>("#st-o-json")];
  const choisirOnglet = (o: "html" | "json", focus = false) => {
    onglet = o;
    for (const b of onglets) {
      const oui = b.id === `st-o-${o}`;
      b.setAttribute("aria-selected", String(oui));
      b.tabIndex = oui ? 0 : -1;
      if (oui && focus) b.focus();
    }
    q("#st-code").setAttribute("aria-labelledby", `st-o-${o}`);
    majSorties();
  };
  for (const b of onglets) b.addEventListener("click", () => choisirOnglet(b.id === "st-o-html" ? "html" : "json"));
  q(".st-onglets").addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      ev.preventDefault();
      choisirOnglet(onglet === "html" ? "json" : "html", true);
    }
  });

  /* ── Raccourcis ── */
  const ouvrirAide = () => {
    const groupes = new Map<string, string[]>();
    for (const r of raccourcis.lister()) {
      const g = r.groupe ?? "Général";
      groupes.set(g, [...(groupes.get(g) ?? []), `<div class="st-aide-ligne"><dt>${e(r.libelle)}</dt><dd>${raccourcis
        .touchesDe(r.id)
        .map((t) => `<kbd>${e(t)}</kbd>`)
        .join(" ")}</dd></div>`]);
    }
    q(".st-aide-corps").innerHTML = [...groupes].map(([g, l]) => `<section><h3>${e(g)}</h3><dl>${l.join("")}</dl></section>`).join("");
    aide.showModal();
  };
  const R = (id: string, touches: string, libelle: string, groupe: string, action: () => void, dansChamp = false) => raccourcis.ajouter({ id, touches, libelle, groupe, action, dansChamp, actif: () => !aide.open || id === "aide" });
  R("rejouer", "R", "Rejouer l'aperçu", "Aperçu", rejouer);
  R("comparer", "B", "Comparer avant / après", "Aperçu", () => basculerComparer());
  R("bureau", "1", "Aperçu bureau", "Aperçu", () => choisirAppareil("bureau"));
  R("tablette", "2", "Aperçu tablette", "Aperçu", () => choisirAppareil("tablette"));
  R("mobile", "3", "Aperçu téléphone", "Aperçu", () => choisirAppareil("mobile"));
  R("copier-attributs", "Maj+A", "Copier les attributs", "Copier", ACTIONS["copier-attributs"]!);
  R("copier-html", "Maj+H", "Copier le HTML", "Copier", ACTIONS["copier-html"]!);
  R("copier-json", "Maj+J", "Copier le JSON de réglages", "Copier", ACTIONS["copier-json"]!);
  R("copier-lien", "Maj+L", "Copier le lien de partage", "Copier", ACTIONS["copier-lien"]!);
  R("reinitialiser", "Maj+R", "Réinitialiser les réglages", "Réglages", reinitialiser);
  R("aide", "?", "Afficher les raccourcis", "Général", () => (aide.open ? aide.close() : ouvrirAide()));
  raccourcis.ecouter(document);

  /* ── Départ ── */
  if (m.rendu.includes("WebGPU")) void majPucesRendu(racine);
  choisirAppareil(appareil);
  majSorties();
  if (lu.corrections.length && location.hash.length > 1) dire(`Lien relu avec ${lu.corrections.length} correction${lu.corrections.length > 1 ? "s" : ""} : ${lu.corrections.join(" ; ")}`);
  // Pour les essais (Playwright).
  (window as unknown as { __studio: object }).__studio = { etat: () => etat, fiche, raccourcis, hash: () => versHash(fiche, etat), attributs: () => ligneAttributs(monterDemo(document, m, fiche, etat).attributsRacine) };
}
