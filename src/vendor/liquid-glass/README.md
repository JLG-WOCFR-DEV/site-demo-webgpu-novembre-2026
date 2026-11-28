# Liquid Glass (repris)

Le moteur de verre de [Liquid Glass UI](https://liquidglass.onemorethink.dev/) — dépôt
[bilalgursen/liquid-glass](https://github.com/bilalgursen/liquid-glass), licence MIT (`LICENSE`, © 2026 Bilal Abdullah
Gürşen). Commit repris et empreintes de l'original : `EMPREINTES.json`.

Utilisé par Presse **en option** : `data-verre-moteur="liquide"` sur un élément `data-verre` (ou sur son groupe). Le
module `src/presse/verre.ts` ne charge ce dossier (un morceau à part, à la demande) que si une page le demande ; sans
WebGL2, ou avant la première image, le verre CSS de Presse reste.

| Fichier | Origine | Modifié ? |
|---|---|---|
| `engine.ts` | `src/components/liquid-glass/engine.ts` : un contexte WebGL2 partagé dessine toutes les surfaces, copiées chacune dans son canvas 2D ; boucle arrêtée au repos | une ligne `// @ts-nocheck` ajoutée en tête, rien d'autre |
| `dom-snapshot.ts` | `src/components/liquid-glass/dom-snapshot.ts` : repeint le DOM sous le verre dans un canvas 2D (ce que le verre réfracte) | idem |
| `couche-amont.ts` | `glass-layer.tsx` : types, constantes, `GLASS_CSS` et le corps de l'effet React, sans React | généré : références React remplacées (liste dans le script), chaque remplacement vérifié |
| `couche.ts` | — | écrit pour Presse : `monterCouche(host, options)`, `assurerStyles()`, `moteurDisponible()` |
| `couche-amont.gabarit` | — | le gabarit de `couche-amont.ts` |

Mettre à jour : cloner le dépôt, puis `python3 tools/vendor-liquid-glass.py <clone>` (échoue si `glass-layer.tsx` a
changé de forme), puis `npm test` (`src/vendor/liquid-glass/vendor.test.ts` vérifie les empreintes et l'en-tête).

L'auteur demande de ne pas réécrire ni « simplifier » le shader (`engine.ts`) : l'allure tient à ses constantes. Ne pas
formater ces fichiers.

Non repris : les composants React (Button, Tabs, Badge, Slide to Confirm, Card, Slider, Switch, Checkbox, Select, Button
Group, Dropdown Menu, Popover, Menu, Search), qui reposent sur React 19, UI SDK (bêta) et, pour trois d'entre eux,
three.js. Presse pose la couche de verre sur ses propres éléments par attributs.
