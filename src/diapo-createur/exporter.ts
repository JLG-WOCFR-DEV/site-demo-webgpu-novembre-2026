/**
 * Créateur de diaporama — le menu Exporter (chemin navigateur, au mieux ; la ligne de commande
 * `npm run export:diapo` reste l'export fidèle, captures de Chromium à l'appui).
 *
 *   HTML autonome   un seul fichier qui rejoue le diaporama (src/diapo-export/html-autonome.ts) ;
 *   PDF             le diaporama à imprimer (`?impression`, `&etapes` une page par appui, `&notes` les notes) :
 *                   la fenêtre d'impression du navigateur, « Enregistrer en PDF » ;
 *   PPTX            niveau 1 : chaque état rastérisé dans la page (SVG foreignObject → PNG), transitions natives,
 *                   notes, texte alternatif (src/diapo-export/pptx.ts, sans dépendance). Si le navigateur refuse la
 *                   rastérisation, le bouton se désactive et renvoie à la ligne de commande.
 * Le diaporama est chargé dans une iframe cachée en mode `?export` (même document gardé que l'aperçu) ; ses
 * réglages viennent du schéma partagé (CHAMPS_EXPORT), rendus en boutons à icônes, gardés dans ce navigateur.
 */
import { CHAMPS_EXPORT, lireOptions, type OptionsExport } from "../diapo-export/options.ts";
import type { ApiExport } from "../diapo-export/page.ts";
import { creerPopup } from "../presse/comportements/popup.ts";

type Contexte = {
  bouton: HTMLButtonElement;
  /** Le chemin du diaporama (`/conference.html`). */
  chemin: string;
  fichier: string;
  icone: (nom: string) => string;
};

const CLE = "presse-diapo-createur:export";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function lireReglages(): OptionsExport {
  try {
    return lireOptions(JSON.parse(localStorage.getItem(CLE) ?? "{}")).options;
  } catch {
    return lireOptions({}).options;
  }
}

export function monterExport(c: Contexte) {
  let reglages = lireReglages();
  const panneau = document.createElement("div");
  panneau.className = "dc-export";
  panneau.hidden = true;
  panneau.setAttribute("aria-label", "Exporter le diaporama");
  const champs = CHAMPS_EXPORT.filter((ch) => ch.type === "interrupteur" || (ch.type === "selecteur" && ch.affichage === "segments"));
  const dessiner = () => {
    const ctrl = champs
      .map((ch) => {
        if (ch.type === "interrupteur") {
          const on = Boolean(reglages[ch.cle as keyof OptionsExport]);
          return `<button type="button" class="dc-ic" data-reglage="${ch.cle}" aria-pressed="${on}" title="${esc(`${ch.libelle} : ${on ? "oui" : "non"}${ch.aide ? ` — ${ch.aide}` : ""}`)}" aria-label="${esc(ch.libelle)}">${c.icone(ch.icone ?? "")}</button>`;
        }
        if (ch.type !== "selecteur") return "";
        const v = String(reglages[ch.cle as keyof OptionsExport]);
        return `<span class="dc-seg" role="radiogroup" aria-label="${esc(ch.libelle)}">${ch.options
          .map((o) => `<button type="button" class="dc-ic" role="radio" data-reglage="${ch.cle}" data-valeur="${esc(o.valeur)}" aria-checked="${o.valeur === v}" aria-pressed="${o.valeur === v}" title="${esc(o.libelle)}${ch.aide ? ` — ${esc(ch.aide)}` : ""}" aria-label="${esc(o.libelle)}">${c.icone(o.icone ?? "")}</button>`)
          .join("")}</span>`;
      })
      .join("");
    panneau.innerHTML = `<div class="dc-export-ligne" role="group" aria-label="Format">
  <button type="button" class="dc-ic dc-export-format" data-format="html" title="HTML autonome : un seul fichier, polices et images dedans, qui rejoue le diaporama sans serveur (→ ← F P ?)" aria-label="Exporter en HTML autonome">${c.icone("html")}</button>
  <button type="button" class="dc-ic dc-export-format" data-format="pdf" title="PDF : le diaporama à imprimer, une page par diapo (ou par étape), notes en option — « Enregistrer en PDF »" aria-label="Exporter en PDF">${c.icone("printer")}</button>
  <button type="button" class="dc-ic dc-export-format" data-format="pptx" title="PowerPoint (niveau 1) : une image par état, notes de l'orateur, transitions natives, texte alternatif" aria-label="Exporter en PowerPoint">${c.icone("pptx")}</button>
</div>
<div class="dc-export-ligne" role="group" aria-label="Réglages de l'export">${ctrl}</div>
<p class="dc-export-etat" aria-live="polite"></p>`;
  };
  dessiner();
  document.body.append(panneau);
  const pop = creerPopup(panneau, { cote: "bas", alignement: "fin", decalage: 6, focusInitial: "[data-format]" });
  c.bouton.addEventListener("click", () => pop.basculer(c.bouton));
  const etat = (t: string) => {
    const p = panneau.querySelector<HTMLElement>(".dc-export-etat");
    if (p) p.textContent = t;
  };

  panneau.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button");
    if (!b || b.disabled) return;
    if (b.dataset.reglage) {
      const k = b.dataset.reglage;
      const brut = { ...reglages, [k]: b.dataset.valeur ?? !reglages[k as keyof OptionsExport] };
      reglages = lireOptions(brut).options;
      try {
        localStorage.setItem(CLE, JSON.stringify(reglages));
      } catch {
        /* gardé pour cette session seulement */
      }
      const garde = panneau.querySelector(".dc-export-etat")?.textContent ?? "";
      dessiner();
      etat(garde);
      panneau.querySelector<HTMLElement>(`[data-reglage="${k}"]${b.dataset.valeur ? `[data-valeur="${b.dataset.valeur}"]` : ""}`)?.focus();
    } else if (b.dataset.format) void lancer(b.dataset.format as "html" | "pdf" | "pptx", b);
  });

  /* ── L'iframe d'export ── */
  let cadre: HTMLIFrameElement | null = null;
  const api = async (): Promise<ApiExport> => {
    // Rechargée à chaque export : le document gardé a pu changer depuis.
    cadre?.remove();
    cadre = document.createElement("iframe");
    cadre.className = "dc-export-cadre";
    cadre.setAttribute("aria-hidden", "true");
    cadre.tabIndex = -1;
    cadre.title = "Export (caché)";
    cadre.src = `${c.chemin}?export`;
    document.body.append(cadre);
    const f = cadre;
    const t0 = performance.now();
    for (;;) {
      const a = f.contentWindow?.__presseExport;
      if (a) return a;
      if (performance.now() - t0 > 30000) throw new Error("le diaporama ne répond pas en mode export");
      await new Promise((r) => setTimeout(r, 100));
    }
  };
  const telecharger = (donnees: BlobPart, type: string, nom: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([donnees], { type }));
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const base = c.fichier.replace(/\.html$/, "");
  let occupe = false;

  async function lancer(format: "html" | "pdf" | "pptx", b: HTMLButtonElement) {
    if (format === "pdf") {
      const u = `${c.chemin}?impression${reglages.contenu === "etapes" ? "&etapes" : ""}${reglages.notes ? "&notes" : ""}`;
      if (!window.open(u, "_blank")) etat(`Onglet bloqué : ouvrez ${u}`);
      else etat("PDF : la fenêtre d'impression s'ouvre dans l'onglet (« Enregistrer en PDF »).");
      return;
    }
    if (occupe) return;
    occupe = true;
    b.setAttribute("aria-busy", "true");
    const t0 = performance.now();
    try {
      etat("Préparation…");
      const x = await api();
      if (format === "html") {
        const r = await x.htmlAutonome(reglages);
        telecharger(r.html, "text/html", `${base}-autonome.html`);
        etat(`HTML autonome : ${(r.octets / 1048576).toFixed(1)} Mo, polices ${r.polices === "incluses" ? "incluses" : "du système"}${r.avertissements.length ? ` · ${r.avertissements.length} avertissement(s) (console)` : ""}.`);
        if (r.avertissements.length) console.warn("[export]", r.avertissements);
      } else {
        const r = await x.pptx(reglages, (fait, total) => etat(`PowerPoint : image ${fait} / ${total}…`));
        telecharger(r.octets as BlobPart, "application/vnd.openxmlformats-officedocument.presentationml.presentation", `${base}.pptx`);
        etat(`PowerPoint : ${r.diapos} diapos, ${(r.octets.length / 1048576).toFixed(1)} Mo en ${((performance.now() - t0) / 1000).toFixed(1)} s${r.avertissements.length ? ` · ${r.avertissements.join(" ; ")}` : ""}.`);
      }
    } catch (err) {
      console.error("[export]", err);
      if (format === "pptx") {
        b.disabled = true;
        b.title = `PowerPoint indisponible dans ce navigateur (${String((err as Error).message ?? err)}) : npm run export:diapo -- ${c.fichier} --pptx`;
        etat(`PowerPoint impossible ici. Export fidèle : npm run export:diapo -- ${c.fichier} --pptx`);
      } else etat(`Export impossible : ${String((err as Error).message ?? err)}`);
    } finally {
      occupe = false;
      b.removeAttribute("aria-busy");
      pop.positionner();
    }
  }
}
