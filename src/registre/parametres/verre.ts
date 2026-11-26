/**
 * Fiche Studio du verre (src/presse/verre.ts) : un bouton, des onglets, une carte et un badge de verre posés sur un
 * fond rayé et coloré (le trait fin de 1 px est ce qui montre la réfraction). Défauts tirés du module (`DEFAUTS`,
 * `BORNES`), vérifiés par src/presse/verre.test.ts.
 *
 * Les réglages sont écrits sur le groupe (`data-verre-groupe`, la racine de la démo) : chaque verre qui n'a pas sa
 * propre valeur les lit de ses ancêtres. Le matériau est la valeur du groupe (`clair` par défaut, `teinte` l'écrit) ;
 * la teinte n'apparaît que pour le verre teinté. L'aperçu
 * d'un moteur sans filtre SVG dans `backdrop-filter` (Firefox, Safari) montre le repli « flou », sans déformation.
 */
import type { FicheParametres } from "./types.ts";

export default {
  parametres: [
    {
      cle: "materiau",
      type: "selecteur",
      libelle: "Matériau",
      groupe: "Verre",
      affichage: "segments",
      options: [
        { valeur: "clair", libelle: "Clair" },
        { valeur: "teinte", libelle: "Teinté" },
      ],
      defaut: "clair",
      attribut: "data-verre-groupe",
      aide: "Clair : le fond traverse. Teinté : un voile de couleur, utile pour la lisibilité du texte.",
    },
    { cle: "teinte", type: "couleur", libelle: "Teinte", groupe: "Verre", defaut: "#7aa8ff", attribut: "data-verre-teinte", si: { champ: "materiau", valeurs: ["teinte"] }, aide: "Couleur du voile du verre teinté." },
    { cle: "refraction", type: "curseur", libelle: "Réfraction", groupe: "Lentille", min: 0, max: 80, pas: 1, unite: "px", defaut: 44, attribut: "data-verre-refraction", aide: "Déplacement du fond au bord, en px. 0 : plus de déformation (le flou reste)." },
    { cle: "biseau", type: "curseur", libelle: "Biseau", groupe: "Lentille", min: 6, max: 48, pas: 1, unite: "px", defaut: 18, attribut: "data-verre-biseau", aide: "Largeur de la bande du bord qui réfracte. Au centre, le fond passe sans bouger." },
    { cle: "flou", type: "curseur", libelle: "Flou", groupe: "Lentille", min: 0, max: 24, pas: 1, unite: "px", defaut: 6, attribut: "data-verre-flou", aide: "Flou du fond, appliqué après la déformation." },
    { cle: "ressort", type: "curseur", libelle: "Ressort ζ", groupe: "Appui", min: 0.2, max: 1, pas: 0.02, defaut: 0.42, attribut: "data-verre-ressort", aide: "Amortissement du retour d'appui : 0,2 rebondit, 1 revient sans dépasser. Fréquence fixe (4 Hz)." },
  ],
  demo: {
    racine: "[data-verre-groupe]",
    fond: "#0d1020",
    sombre: true,
    consigne: "Survolez pour le reflet, appuyez puis relâchez pour le ressort. La réfraction se voit sur les traits fins derrière le verre (moteur Chromium) ; ailleurs, le repli est un verre flou.",
    html: `<div class="scene-verre" data-verre-groupe="clair">
  <div class="vr-rangee">
    <button type="button" class="vr-bouton" data-verre>Acheter</button>
    <div class="vr-onglets" role="tablist" aria-label="Rayons" data-verre>
      <button type="button" role="tab" aria-selected="true" onclick="for (const t of this.parentNode.children) t.setAttribute('aria-selected', String(t === this))">Femme</button>
      <button type="button" role="tab" aria-selected="false" onclick="for (const t of this.parentNode.children) t.setAttribute('aria-selected', String(t === this))">Homme</button>
      <button type="button" role="tab" aria-selected="false" onclick="for (const t of this.parentNode.children) t.setAttribute('aria-selected', String(t === this))">Enfant</button>
    </div>
    <span class="vr-badge" data-verre>Nouveau</span>
  </div>
  <article class="vr-carte" data-verre>
    <h2>Manteau de pluie</h2>
    <p>Coton ciré, doublure chaude. 240 €</p>
  </article>
</div>`,
    css: `.scene-verre { min-height: 100vh; box-sizing: border-box; display: grid; gap: 40px; align-content: center; justify-items: start; padding: 48px 28px; color: #fff; font: 16px/1.5 "Archivo Variable", system-ui, sans-serif;
  background:
    repeating-linear-gradient(0deg, rgb(255 255 255 / 0.55) 0 1px, transparent 1px 28px),
    repeating-linear-gradient(90deg, rgb(255 255 255 / 0.28) 0 1px, transparent 1px 28px),
    radial-gradient(circle at 18% 22%, #ff5f8d, transparent 42%),
    radial-gradient(circle at 82% 70%, #35c8ff, transparent 46%),
    #1b1f3a; }
.vr-rangee { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; }
.vr-bouton { min-height: 48px; padding: 0 26px; border: 0; border-radius: 999px; color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
.vr-onglets { display: flex; gap: 4px; padding: 4px; border-radius: 999px; }
.vr-onglets [role="tab"] { min-height: 40px; padding: 0 16px; border: 0; border-radius: 999px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.vr-onglets [aria-selected="true"] { background: rgb(255 255 255 / 0.28); }
.vr-badge { padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 14px; }
.vr-carte { width: min(360px, 100%); box-sizing: border-box; padding: 22px 24px; border-radius: 28px; }
.vr-carte h2 { margin: 0 0 4px; font-size: 22px; }
.vr-carte p { margin: 0; opacity: 0.9; }`,
  },
} satisfies FicheParametres;
