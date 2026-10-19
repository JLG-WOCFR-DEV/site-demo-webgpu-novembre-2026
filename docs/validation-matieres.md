# Validation du laboratoire de matières

Les six effets ont été rendus avec le shader `PLANE` réel, hors navigateur. Les contrôles numériques décrits ci-dessous passent et les images ont été inspectées visuellement. **Cette vérification ne valide pas l'intégration dans un navigateur.**

Exécution documentée : **19 octobre 2026, 18:51 UTC**. Les aperçus et mesures ci-dessous ont été nouvellement calculés depuis les sources restaurées du projet.

![Original, six effets et exemples d'interaction](./matieres-apercu.png)

Le [rapport JSON](./validation-matieres.json) conserve les paramètres, les empreintes des sources, les mesures détaillées et les limites. La [planche d'aperçu](./matieres-apercu.png) présente l'original, les six matières, une comparaison et le déplacement du givre.

## Méthode

L'export `PLANE` de [`src/gpu/wgsl.ts`](../src/gpu/wgsl.ts), qui incorpore [`materials.wgsl.ts`](../src/gpu/materials.wgsl.ts), est exécuté par `wgpu-py 0.32.0` et `wgpu-native`. L'adaptateur disponible est **llvmpipe, de type CPU, via OpenGL**. Le WGSL est traduit par Naga puis rendu sur cet adaptateur logiciel.

Le rendu utilise les entrypoints `vs_plane` et `fs_plane`, les uniforms réels **Frame : 64 octets** et **Plane : 112 octets**, ainsi que la photographie [`fig.jpg`](../public/plates/fig.jpg). Les 11 niveaux de mipmap sont construits sur CPU avec Pillow pour cet exercice. La cible est en `rgba8unorm`, avec mélange prémultiplié et valeurs colorimétriques encodées comme dans le shader.

Paramètres de référence : **640 × 534 pixels**, DPR 1, recadrage `cover`, intensité 0,8, échelle 0,5, temps 1,45 s et pointeur centré. Des variantes ajoutent une marge contrastée de 32 pixels, changent le temps ou déplacent le pointeur.

Empreinte SHA-256 du shader `PLANE` exporté et testé :

```text
87b532d68927e2dbdb5311f1a18d66aef292163bc56339ac7238c53a2f213912
```

## Contrôles réussis

Pour chaque effet, les différences RGB maximales sont **nulles** dans les trois contrôles suivants :

- Intensité zéro : résultat identique à l'original.
- Comparaison : moitié gauche identique à l'original, hors séparateur central.
- Confinement : pixels hors du quad identiques au fond contrasté.

Les six résultats sont distincts de l'original et les uns des autres. Leur écart moyen RGB avec l'original, dans la zone intérieure testée, vaut :

| Effet | Écart moyen sur 255 |
|---|---:|
| Ondes | 11,92 |
| Givre | 26,27 |
| Tissu | 13,70 |
| Tramage | 60,60 |
| Lentille | 5,88 |
| ASCII | 72,63 |

Ces valeurs mesurent des différences d'image ; elles ne constituent pas des scores de qualité.

Entre 1,45 s et 2,7 s, les ondes et le tissu changent visiblement. Le givre, le tramage, la lentille et l'ASCII restent exactement stables lorsque seul le temps change. Déplacer le pointeur modifie correctement le givre et la lentille. Le mode réduit des ondes conserve exactement le même résultat malgré un changement d'âge.

L'inspection visuelle confirme des effets lisibles, sans image noire ni corruption visible. Le rendu ASCII individuel a également été inspecté à 640 × 534 : les caractères sont distincts et la figure reste reconnaissable. Cette image intermédiaire n'est pas jointe séparément ; son aperçu figure dans la planche.

## Limites précises

- Aucun navigateur n'a été utilisé : Chrome/Dawn, l'intégration DOM, les événements de pointeur, les commandes de pause et le repli HTML ne sont pas validés ici.
- llvmpipe est un adaptateur logiciel. Aucune performance sur GPU physique n'est mesurée ou revendiquée.
- Seul `PLANE` est rendu directement : la chaîne `COMPOSITE` complète et la génération des mipmaps par l'application ne sont pas exercées.
- Le flag de mouvement réduit fige l'âge des ondes dans le shader. Pour le tissu, le contrôleur doit figer `plane.material.w` ; ce comportement du contrôleur n'est pas vérifié par ces rendus.
- Les conclusions concernent les paramètres et l'empreinte de shader consignés dans le rapport, et ne valent pas validation de toutes les combinaisons de réglages ou de tous les appareils.
