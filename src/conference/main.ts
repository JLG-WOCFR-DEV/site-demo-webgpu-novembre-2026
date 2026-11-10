/**
 * Diaporama de conférence : une page Presse en mode diapo. Le moteur se lance comme ailleurs (options sur <html>) ;
 * mountDiapo prend la main sur les sections et imprime chacune à son arrivée.
 */
import "./style.css";
import { presseFromHtml } from "../presse/index.ts";
import { mountDiapo } from "../presse/diapo.ts";
import { applySavedEdits, mountEditor } from "../presse/diapo-editeur.ts";
import { initAnim } from "../presse/timeline.ts";

const root = document.querySelector<HTMLElement>("[data-diapo]");
// La vue présentateur (?presentateur) n'imprime rien : pas de moteur, pas de second contexte GPU.
const presenter = new URLSearchParams(location.search).has("presentateur");
// Les corrections gardées par l'éditeur (E) d'abord : le diaporama découpe ensuite les textes tels quels.
if (root) applySavedEdits(root);
if (root && presenter) mountDiapo(root, Promise.resolve(null));
else if (root) {
  mountEditor(root);
  let resolve!: (a: { replay: () => void; relayout: () => void } | null) => void;
  // Les diapos d'abord (data-gl-print="page", la première affichée), le moteur ensuite : il les trouve prêtes.
  mountDiapo(root, new Promise((r) => (resolve = r)));
  initAnim();
  void presseFromHtml()
    .then((api) => resolve(api.engine ? api : null))
    .catch(() => resolve(null));
}

/**
 * Les captures : déposer public/conference/<nom>.webp (ou .jpg, .png), ou <nom>.mp4, suffit. Le cadre pointillé
 * [data-capture="<nom>"] cherche le fichier et le remplace : une image devient un plan GPU (imprimé avec la diapo), une
 * vidéo est lue sur sa diapo seulement. Sans fichier, le cadre reste, avec ce qu'il attend.
 */
const exists = (url: string) => fetch(url, { method: "HEAD" }).then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html")).catch(() => false);
for (const fig of document.querySelectorAll<HTMLElement>("figure[data-capture]")) {
  const name = fig.dataset.capture!;
  void (async () => {
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
  })();
}

