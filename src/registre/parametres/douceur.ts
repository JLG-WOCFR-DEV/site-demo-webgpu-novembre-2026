/**
 * Fiche Studio de la douceur (src/presse/douceur.ts) : un bloc `data-douceur` avec un bouton, une carte, un menu
 * (popover), une liste, une image, des onglets, un compteur qui change et un bouton à maintenir. Défauts tirés du
 * module (`DEFAUTS`, `PAR_NIVEAU`, `NIVEAUX`), vérifiés par src/presse/douceur.test.ts.
 *
 * Les interrupteurs des micro-interactions suivent le niveau (`auto` : « selon le niveau ») ; réglés, ils écrivent
 * `oui` ou `non` sur le bloc. Le maintien n'est d'aucun niveau : il est posé sur son bouton (`cible`). La démo garde
 * trois gestes en attributs `onclick` (choisir un onglet, ajouter une ligne, changer le compteur) : la douceur anime
 * ce que la page change, elle ne change rien elle-même.
 */
import type { FicheParametres } from "./types.ts";

const AUTO = "selon le niveau";

export default {
  parametres: [
    {
      cle: "niveau",
      type: "selecteur",
      libelle: "Niveau",
      groupe: "Douceur",
      affichage: "segments",
      options: [
        { valeur: "subtil", libelle: "Subtil" },
        { valeur: "expressif", libelle: "Expressif" },
        { valeur: "non", libelle: "Aucune" },
      ],
      defaut: "subtil",
      attribut: "data-douceur",
      aide: "Subtil : appui, entrée, survol. Expressif : en plus cascade, révélation, onglets, flou. Le choix du visiteur (palette Ctrl+K) passe devant, sauf « non » ; l'aperçu montre la fiche.",
    },
    { cle: "appui", type: "interrupteur", libelle: "Appui", groupe: "Micro-interactions", defaut: true, attribut: "data-douceur-appui", auto: AUTO, ecriture: { oui: "oui", non: "non" }, aide: "scale(.97), 160 ms, ui-sortie : boutons et liens." },
    { cle: "entree", type: "interrupteur", libelle: "Entrée", groupe: "Micro-interactions", defaut: true, attribut: "data-douceur-entree", auto: AUTO, ecriture: { oui: "oui", non: "non" }, aide: "scale(.95) et opacité : popover, dialog, éléments insérés ou qui arrivent à l'écran." },
    { cle: "survol", type: "interrupteur", libelle: "Survol", groupe: "Micro-interactions", defaut: true, attribut: "data-douceur-survol", auto: AUTO, ecriture: { oui: "oui", non: "non" }, aide: "Levée et ombre, 150 ms, pointeur fin seulement." },
    { cle: "cascade", type: "interrupteur", libelle: "Cascade", groupe: "Micro-interactions", defaut: false, attribut: "data-douceur-cascade", auto: AUTO, ecriture: { oui: "oui", non: "non" }, aide: "Les éléments d'une liste entrent l'un après l'autre (8 au plus)." },
    { cle: "revele", type: "interrupteur", libelle: "Révélation", groupe: "Micro-interactions", defaut: false, attribut: "data-douceur-revele", auto: AUTO, ecriture: { oui: "oui", non: "non" }, aide: "L'image d'une figure se découvre au défilement, une fois." },
    { cle: "onglets", type: "interrupteur", libelle: "Onglets", groupe: "Micro-interactions", defaut: false, attribut: "data-douceur-onglets", auto: AUTO, ecriture: { oui: "oui", non: "non" }, aide: "L'indicateur glisse d'un onglet à l'autre (clip-path)." },
    { cle: "flou", type: "interrupteur", libelle: "Flou", groupe: "Micro-interactions", defaut: false, attribut: "data-douceur-flou", auto: AUTO, ecriture: { oui: "oui", non: "non" }, aide: "Un contenu qui change passe sous 2 px de flou." },
    { cle: "maintien", type: "interrupteur", libelle: "Maintien", groupe: "Micro-interactions", defaut: true, attribut: "data-douceur-maintien", cible: "[data-demo-maintien]", ecriture: { oui: "", non: "non" }, aide: "Maintenir deux secondes (ou activer deux fois) pour confirmer." },
    { cle: "duree", type: "temps", libelle: "Durée d'entrée", unite: "ms", min: 120, max: 400, pas: 10, defaut: 220, attribut: "data-douceur-duree", mouvement: "duree", aide: "Entrée ; la sortie d'une popover est 0,7 × plus courte. L'appui reste à 160 ms." },
    { cle: "pas", type: "temps", libelle: "Pas de cascade", unite: "ms", min: 30, max: 80, pas: 5, defaut: 50, attribut: "data-douceur-pas", mouvement: "cascade", aide: "Écart entre deux éléments d'une cascade (30 à 80 ms)." },
    { cle: "courbe", type: "courbe", libelle: "Courbe d'entrée", defaut: "ui-sortie", attribut: "data-douceur-courbe", mouvement: "entree" },
    { cle: "courbeSortie", type: "courbe", libelle: "Courbe de sortie", defaut: "ui-sortie", attribut: "data-douceur-courbe-sortie", mouvement: "sortie" },
  ],
  demo: {
    racine: "[data-douceur]",
    fond: "#f4f1ea",
    consigne: "Appuyez, survolez, ouvrez le menu, ajoutez une ligne, changez d'onglet, maintenez « Vider » ; Rejouer (R) rejoue les entrées. Au clavier, rien ne s'anime.",
    html: `<div class="scene-douceur" data-douceur="subtil">
  <div class="dz-rangee">
    <button type="button" class="dz-bouton">Ajouter au panier</button>
    <button type="button" class="dz-bouton dz-second" popovertarget="dz-menu">Options</button>
    <div popover id="dz-menu" class="dz-menu" aria-label="Options">
      <p>Taille : M</p>
      <p>Livraison : demain</p>
    </div>
    <button type="button" class="dz-bouton dz-danger" data-demo-maintien data-douceur-maintien>Vider le panier</button>
  </div>
  <a class="dz-carte" href="#dz-carte">
    <h2>Manteau de pluie</h2>
    <p>Coton ciré, doublure chaude. 240 €</p>
  </a>
  <div class="dz-onglets" role="tablist" aria-label="Rayons">
    <button type="button" role="tab" aria-selected="true" onclick="for (const t of this.parentNode.children) t.setAttribute('aria-selected', String(t === this))">Femme</button>
    <button type="button" role="tab" aria-selected="false" onclick="for (const t of this.parentNode.children) t.setAttribute('aria-selected', String(t === this))">Homme</button>
    <button type="button" role="tab" aria-selected="false" onclick="for (const t of this.parentNode.children) t.setAttribute('aria-selected', String(t === this))">Enfant</button>
  </div>
  <p class="dz-compte">Articles : <output>3</output> <button type="button" class="dz-bouton dz-second" onclick="const o = this.previousElementSibling; o.textContent = String(Number(o.textContent) + 1)">Un de plus</button></p>
  <ul class="dz-liste">
    <li>Écharpe en laine</li>
    <li>Bottes de pluie</li>
    <li>Parapluie pliant</li>
    <li>Bonnet côtelé</li>
  </ul>
  <button type="button" class="dz-bouton dz-second" onclick="const li = document.createElement('li'); li.textContent = 'Nouvelle ligne'; li.setAttribute('data-douceur-entree', ''); this.previousElementSibling.append(li)">Ajouter une ligne</button>
  <figure class="dz-figure">
    <img src="plates/dunes.jpg" alt="Dunes au soleil couchant" width="1728" height="1150" loading="lazy" />
    <figcaption>Révélation au défilement (niveau expressif)</figcaption>
  </figure>
</div>`,
    css: `.scene-douceur { min-height: 100vh; box-sizing: border-box; display: grid; gap: 28px; align-content: start; justify-items: start; max-width: 680px; margin: 0 auto; padding: 48px 24px 96px; color: #1d1b17; font: 16px/1.5 "Archivo Variable", system-ui, sans-serif; }
.dz-rangee { display: flex; flex-wrap: wrap; gap: 12px; }
.dz-bouton { min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: #1d1b17; color: #f4f1ea; font: inherit; font-weight: 600; cursor: pointer; }
.dz-second { background: transparent; color: #1d1b17; box-shadow: inset 0 0 0 1.5px #1d1b17; }
.dz-danger { background: #a3261b; color: #fff; }
.dz-menu { margin: 0; padding: 12px 16px; border: 1px solid #1d1b17; border-radius: 12px; background: #fffdf7; color: #1d1b17; }
.dz-menu p { margin: 4px 0; }
.dz-carte { display: block; width: min(360px, 100%); box-sizing: border-box; padding: 18px 20px; border-radius: 16px; background: #fffdf7; color: inherit; text-decoration: none; box-shadow: 0 0 0 1px rgb(29 27 23 / 0.12); }
.dz-carte h2 { margin: 0 0 4px; font-size: 20px; }
.dz-carte p { margin: 0; color: #5c574d; }
.dz-onglets { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: #e7e1d3; --douceur-onglet-fond: #1d1b17; --douceur-onglet-encre: #f4f1ea; }
.dz-onglets [role="tab"] { min-height: 40px; padding: 0 16px; border: 0; border-radius: 999px; background: transparent; color: #1d1b17; font: inherit; cursor: pointer; }
.dz-compte { display: flex; align-items: center; gap: 12px; margin: 0; }
.dz-compte output { min-width: 2ch; font-weight: 700; font-variant-numeric: tabular-nums; }
.dz-liste { margin: 0; padding-left: 20px; }
.dz-figure { margin: 0; width: min(560px, 100%); }
.dz-figure img { display: block; width: 100%; height: auto; border-radius: 12px; }
.dz-figure figcaption { margin-top: 6px; color: #5c574d; font-size: 14px; }`,
  },
} satisfies FicheParametres;
