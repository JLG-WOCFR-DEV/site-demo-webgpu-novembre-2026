/**
 * Studio — l'aperçu (studio-apercu.html?effet=<id>#v=1;…) : la démo de l'effet, montée avec les réglages du fragment,
 * puis armée par le chargeur du registre (`charger` + `armer`), sans le reste de Presse (ni menu, ni rideau, ni
 * curseur). Il vit dans un cadre de la page d'effet, qui lui parle par messages (même origine, vérifiée) :
 *   { type: "studio:etat", hash }   nouveaux réglages : le fragment est remplacé (sans entrée d'historique) et la
 *                                   démo remontée ;
 *   { type: "studio:rejouer" }      la démo est remontée telle quelle (l'entrée se rejoue).
 * Il répond { type: "studio:pret", effet, montages } après chaque montage. Ouvert seul, il marche aussi : le fragment
 * de l'adresse fait foi, `hashchange` remonte la démo.
 *
 * Remonter = remplacer le contenu de la scène par un HTML neuf, puis `armer(module, document)` : chaque module arme
 * ce qu'il ne connaît pas encore (et oublie, pour la plupart, ce qui a quitté la page). L'aperçu étant un document à
 * part, ce qu'un module garde des montages précédents ne déborde jamais sur la page du Studio.
 */
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/bodoni-moda/opsz.css";
import "./apercu.css";
import { EFFETS } from "../registre/effets.ts";
import { depuisHash } from "./etat.ts";
import { monterDemo } from "./demo.ts";

type Message = { type: "studio:etat"; hash: string } | { type: "studio:rejouer" };

const scene = document.getElementById("scene")!;
const id = new URLSearchParams(location.search).get("effet") ?? "";
const manifeste = EFFETS.find((e) => e.id === id);
let montages = 0;

function message(texte: string) {
  const p = document.createElement("p");
  p.className = "apercu-message";
  p.textContent = texte;
  scene.replaceChildren(p);
}

async function demarrer() {
  if (!manifeste?.parametres) {
    message(id ? `Aucune démonstration pour l'effet « ${id} ».` : "Aucun effet demandé (?effet=…).");
    return;
  }
  const fiche = (await manifeste.parametres()).default;
  const { demo } = fiche;
  if (demo.css) {
    const s = document.createElement("style");
    s.dataset.studio = "demo";
    s.textContent = demo.css;
    document.head.append(s);
  }
  if (demo.fond) document.body.style.setProperty("--apercu-fond", demo.fond);
  document.body.toggleAttribute("data-sombre", !!demo.sombre);
  let module: unknown = null;

  const monter = async () => {
    const { etat } = depuisHash(fiche, location.hash);
    const d = monterDemo(document, manifeste, fiche, etat);
    scene.replaceChildren(d.fragment);
    module ??= await manifeste.charger();
    manifeste.armer(module, document);
    montages++;
    if (parent !== window) parent.postMessage({ type: "studio:pret", effet: id, montages }, location.origin);
  };

  addEventListener("hashchange", () => void monter());
  addEventListener("message", (e: MessageEvent<Message>) => {
    if (e.origin !== location.origin || e.source !== parent) return;
    const m = e.data;
    if (m?.type === "studio:etat") {
      history.replaceState(null, "", `${location.pathname}${location.search}#${m.hash}`);
      void monter();
    } else if (m?.type === "studio:rejouer") void monter();
  });
  await monter();
}

const pret = demarrer().catch((err: unknown) => {
  console.error("[studio:apercu]", err);
  message("L'aperçu n'a pas pu monter la démonstration.");
});
// Pour les essais (Playwright) : la fin du premier montage, le nombre de montages.
(window as unknown as { __apercu: { pret: Promise<void>; montages: () => number } }).__apercu = { pret, montages: () => montages };
