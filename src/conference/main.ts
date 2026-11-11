/**
 * Diaporama de conférence : une page Presse en mode diapo. Le moteur se lance comme ailleurs (options sur <html>) ;
 * mountDiapo prend la main sur les sections et imprime chacune à son arrivée.
 */
import "./style.css";
import { presseFromHtml } from "../presse/index.ts";
import { mountDiapo } from "../presse/diapo.ts";
import { applySavedEdits, mountEditor } from "../presse/diapo-editeur.ts";
import { initAnim } from "../presse/timeline.ts";
import { applySavedDoc, applySavedFiles, notesParas, tagIds } from "../presse/diapo-doc.ts";

const root = document.querySelector<HTMLElement>("[data-diapo]");
const params = new URLSearchParams(location.search);
// La vue présentateur (?presentateur) n'imprime rien : pas de moteur, pas de second contexte GPU. Une vignette du
// Créateur (?vignette) non plus : la diapo en HTML, toutes ses étapes visibles.
const presenter = params.has("presentateur");
const vignette = params.has("vignette");
// L'impression (?impression, &notes : les notes de l'orateur sous chaque diapo) : ni moteur ni clavier, les diapos
// l'une sous l'autre, une par page — « Enregistrer en PDF » dans la fenêtre d'impression.
const impression = params.has("impression");
void (async () => {
  if (!root) return;
  // D'abord le document gardé par le Créateur de diaporama (diapo-createur.html), s'il y en a un, et ses images
  // importées ; dans son aperçu (?createur), chaque élément reçoit l'identifiant par lequel le Créateur le retrouve.
  applySavedDoc(root);
  if (params.has("createur")) tagIds(root);
  await applySavedFiles(root).catch(() => {});
  // Les corrections gardées par l'éditeur (E) : le diaporama découpe ensuite les textes tels quels.
  applySavedEdits(root);
  if (impression) return void (await printDeck(root, params.has("notes")));
  if (presenter || vignette) {
    if (vignette) document.documentElement.classList.add("diapo-vignette");
    mountDiapo(root, Promise.resolve(null));
    if (vignette) requestAnimationFrame(() => dispatchEvent(new Event("diapo:reveal")));
    return;
  }
  mountEditor(root);
  let resolve!: (a: { replay: () => void; relayout: () => void } | null) => void;
  // Les diapos d'abord (data-gl-print="page", la première affichée), le moteur ensuite : il les trouve prêtes.
  mountDiapo(root, new Promise((r) => (resolve = r)));
  initAnim();
  void presseFromHtml()
    .then((api) => resolve(api.engine ? api : null))
    .catch(() => resolve(null));
  captures();
})();

/**
 * Les captures : déposer public/conference/<nom>.webp (ou .jpg, .png), ou <nom>.mp4, suffit. Le cadre pointillé
 * [data-capture="<nom>"] cherche le fichier et le remplace : une image devient un plan GPU (imprimé avec la diapo), une
 * vidéo est lue sur sa diapo seulement. Sans fichier, le cadre reste, avec ce qu'il attend.
 */
function captures() {
const found: Promise<void>[] = [];
const exists = (url: string) => fetch(url, { method: "HEAD" }).then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html")).catch(() => false);
for (const fig of document.querySelectorAll<HTMLElement>("figure[data-capture]")) {
  const name = fig.dataset.capture!;
  found.push((async () => {
    for (const ext of ["webp", "jpg", "png"]) {
      const url = `./conference/${name}.${ext}`;
      if (!(await exists(url))) continue;
      const img = new Image();
      img.src = url;
      img.alt = fig.querySelector("span")?.textContent ?? "";
      img.setAttribute("data-gl-img", "");
      await img.decode().catch(() => {});
      fig.replaceChildren(img);
      fig.classList.add("is-filled");
      return;
    }
    if (await exists(`./conference/${name}.mp4`)) {
      const v = document.createElement("video");
      Object.assign(v, { src: `./conference/${name}.mp4`, muted: true, loop: true, playsInline: true, preload: "auto" });
      v.setAttribute("data-diapo-video", "");
      v.setAttribute("aria-label", fig.querySelector("span")?.textContent ?? "");
      fig.replaceChildren(v);
      fig.classList.add("is-filled");
    }
  })());
}
return Promise.all(found);
}

/**
 * Le diaporama à imprimer (?impression) : les diapos non masquées l'une sous l'autre, toutes leurs étapes visibles, une
 * par page 16:9 (13,333 × 7,5 pouces) ; avec &notes, une page A4 par diapo, ses notes dessous. La fenêtre d'impression
 * s'ouvre quand fontes, captures et images sont là (&sansdialogue : non, pour les tests).
 */
async function printDeck(root: HTMLElement, withNotes: boolean) {
  const html = document.documentElement;
  html.classList.add("diapo-impression");
  html.classList.toggle("diapo-impression-notes", withNotes);
  const page = document.createElement("style");
  page.textContent = withNotes ? "@page { size: A4 portrait; margin: 12mm; }" : "@page { size: 13.333in 7.5in; margin: 0; }";
  document.head.append(page);
  let k = 0;
  for (const s of [...root.querySelectorAll<HTMLElement>("[data-diapo-slide]")]) {
    if (s.hasAttribute("data-masquee")) {
      s.remove();
      continue;
    }
    // Le numéro de l'habillage (CSS attr(data-num)), comme en conférence : les diapos masquées ne comptent pas.
    s.dataset.num = String(++k).padStart(2, "0");
    s.setAttribute("aria-label", s.getAttribute("aria-label") ?? `Diapo ${k}`);
    const sheet = document.createElement("div");
    sheet.className = "diapo-page";
    s.before(sheet);
    sheet.append(s);
    if (withNotes) {
      const box = document.createElement("div");
      box.className = "diapo-page-notes";
      const paras = [...s.querySelectorAll("[data-notes]")].flatMap(notesParas);
      box.replaceChildren(...(paras.length ? paras : ["—"]).map((p) => Object.assign(document.createElement("p"), { textContent: p })));
      sheet.append(box);
    }
  }
  // Les barres à leur valeur (en conférence, elles montent à l'arrivée de la diapo).
  for (const b of root.querySelectorAll<HTMLElement>("[data-barre]")) b.style.setProperty("--h", String(Number(b.dataset.barre) || 0));
  await captures();
  await document.fonts.ready;
  await Promise.all(
    [...document.images].map((img) => {
      img.loading = "eager";
      return img.complete ? img.decode().catch(() => {}) : new Promise<void>((r) => {
            img.addEventListener("load", () => r(), { once: true });
            img.addEventListener("error", () => r(), { once: true });
          });
    }),
  );
  html.classList.add("diapo-impression-prete");
  if (!params.has("sansdialogue")) window.print();
}
