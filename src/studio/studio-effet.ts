/** La page d'effet du Studio (studio-effet.html?effet=<id>) : le gabarit, puis le menu Pages (sur le bouton de la barre). */
import "@fontsource-variable/archivo/standard.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { mountPagesNav } from "../pages-nav.ts";
import { monterPageEffet } from "./page-effet.ts";

const hote = document.getElementById("studio")!;
const id = new URLSearchParams(location.search).get("effet") ?? "goo";
void monterPageEffet(hote, id)
  .catch((err: unknown) => {
    console.error("[studio]", err);
    hote.innerHTML = '<main class="st-vide" id="contenu"><h1>Le Studio n\'a pas pu s\'ouvrir</h1><p>La fiche de cet effet n\'a pas pu être chargée.</p></main>';
  })
  .finally(() => mountPagesNav());
