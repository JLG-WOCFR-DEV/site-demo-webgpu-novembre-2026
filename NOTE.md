# Ce que disent les tweets

PLI lit une série de posts d’Aristide Benoist, de janvier à octobre 2026. Ce n’est pas une reprise de son code. En janvier il disait pouvoir ouvrir le dépôt une fois le moteur fini. Il ne l’est pas. Le zip est le nôtre : sources de la démo et brief de revue.

## 31 janvier — la chaîne

https://x.com/AristideBenoist/status/2017627985034326112

> Chaining global passes like blur, bloom, and pixelate, on top of a disturb pipeline with its own options: distortion, black and white, lighten, darken, noise, RGB split, and more. […] Planes can have optional shadows and rounded borders. Behind-the-scenes split view shows the raw pass vs final composite.

API WebGPU JavaScript, sans dépendance. Le 1er février, à une question sur le coût de ces passes, il répond que tout n’est pas facile à expliquer ici.

PLI reprend le vocabulaire : coins, ombre, distorsion, séparation, trame, flou, bloom, grain, et la vue coupée en deux. Ce n’est pas sa chaîne. Un seul fragment shader fait tout. Le bloom, seuillé trop bas, allume le papier. L’ordre réel — trame, puis canaux — ne suit pas la liste écrite dans la démo. Le repli canvas n’a ni bloom ni grain.

## 5 février — le texte

https://x.com/AristideBenoist/status/2019400587088118052

> My MTSDF generator is ready, built in Rust. […] Text now aligns perfectly between canvas and HTML, whatever the font used, with accurate position, letter spacing and line height.

Glyphes instanciés, pas une bitmap de paragraphe. PLI rasterise Archivo dans un canvas, puis envoie l’image au GPU. Si la fonte arrive après le premier dessin, le cache ne s’invalide pas.

## Septembre et octobre — le front entier

https://x.com/AristideBenoist/status/2105033187344658729

> A WebGPU engine built from scratch around a layer-based system.

https://x.com/AristideBenoist/status/2111540505137885388

> Front fully rendered via native WebGPU, SEO friendly.

Autour : un framework HTML en Rust. Le 18 octobre il précise l’ordre — Rust, templating, déploiement, CMS, formulaires — et la couche WebGPU ensuite.

Sous le post du 17 octobre, la question utile est celle du DOM parallèle : recherche, sélection, clavier, lecteurs d’écran. PLI répond petit. Un article masqué reprend la copie. La barre, le rack et cette note restent en HTML. Ils ne passent pas dans la chaîne. « Le front entier, composé sur le GPU » est donc trop fort. Le texte des pages, oui. Le chrome, non.

## Ce que la démo montre quand même

Trois pages. Des photos qui sont des rectangles, pas des meshes. Un clic isole un plan. Les curseurs écrivent les uniformes de la dernière passe. WebGPU si le navigateur l’a, canvas sinon.

Le zip est là pour qu’un autre modèle cherche les angles — fidélité de la chaîne d’un côté, envoi des images et tests de placement de l’autre. Pas une invitation à réécrire l’app.
