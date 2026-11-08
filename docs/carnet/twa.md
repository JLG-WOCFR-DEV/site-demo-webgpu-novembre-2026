# Carnet sur le Play Store (TWA)

Une TWA (Trusted Web Activity) est la PWA de Carnet ouverte par Chrome en plein écran, sans barre
d'adresse, livrée comme une application Android. Aucun code applicatif de plus : un petit projet
Android généré par Bubblewrap, signé, et lié au site par Digital Asset Links (roadmap D2).

## Ce qui est prêt dans le dépôt

- `public/carnet/manifest.webmanifest` : nom, icônes (dont l'icône adaptative), couleurs, raccourcis
  (Aujourd'hui, Le mois, Collections : `carnet.html?vue=…`).
- `android/twa-manifest.json` : configuration Bubblewrap, avec des valeurs `CHOISIR…` à remplacer.
- `public/.well-known/assetlinks.json` : le lien site ↔ application, avec l'empreinte à remplacer.
- Service worker : Carnet s'ouvre hors ligne, et ne se met jamais à jour de force.

## Ce qu'il faut décider

1. **Le domaine.** HTTPS, et Carnet servi de façon que `https://DOMAINE/.well-known/assetlinks.json`
   existe **à la racine du domaine**. Un site GitHub Pages de projet (`utilisateur.github.io/depot/`)
   ne convient pas tel quel (la racine appartient au site d'utilisateur) : domaine personnalisé,
   ou Netlify / Cloudflare Pages.
2. **L'identifiant de l'application** (`packageId`), définitif une fois publié : par exemple
   `fr.jerome.carnet`.

## Étapes

```bash
# 1. Remplacer CHOISIR-LE-DOMAINE et CHOISIR.carnet dans android/twa-manifest.json
#    et public/.well-known/assetlinks.json, puis déployer le site (npm run build → dist/).

# 2. Générer le projet Android (Node, JDK 17 et le SDK Android : Bubblewrap propose de les installer)
cd android
npx @bubblewrap/cli@1 init --manifest https://DOMAINE/carnet/manifest.webmanifest
#    (ou : npx @bubblewrap/cli@1 update, qui relit twa-manifest.json)

# 3. Construire et signer (crée la clé d'envoi à la première fois : la garder hors du dépôt)
npx @bubblewrap/cli@1 build

# 4. Empreinte de la clé → assetlinks.json
npx @bubblewrap/cli@1 fingerprint add <SHA256>   # ou keytool -list -v -keystore carnet-upload.keystore
#    Avec la signature d'application Google Play, utiliser l'empreinte de la clé de signature
#    affichée dans la Play Console (Intégrité de l'application), pas celle de la clé d'envoi.

# 5. Redéployer le site (assetlinks.json à jour), installer l'APK sur le téléphone, vérifier.
adb install app-release-signed.apk
```

## Recette avant la Play Console

- [ ] Pas de barre d'adresse au lancement (sinon : assetlinks.json introuvable ou empreinte fausse ;
      `adb logcat | grep -i "digital asset"`)
- [ ] Ouverture hors ligne, après une première ouverture en ligne
- [ ] Bouton retour : quitte l'application depuis la semaine, revient en arrière ailleurs
- [ ] Barres d'état et de navigation aux couleurs du papier, clair et sombre
- [ ] Raccourcis de l'icône (appui long) : Aujourd'hui, Le mois
- [ ] Recette TalkBack et clavier (carnet-recette.html) dans l'application installée
- [ ] Sauvegarde `.carnet` : le fichier se télécharge et se restaure

Puis Play Console : test interne d'abord (quelques testeurs, pas d'examen long), fiche, captures,
politique de confidentialité (Carnet ne collecte rien : tout reste sur l'appareil ; la météo
interroge Open-Meteo avec des coordonnées arrondies, seulement si on l'active).
