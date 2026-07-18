# FretByW00d — Guide de publication sur les stores (P4)

Les projets natifs sont **déjà générés et configurés** dans `android/` et `ios/`.
Il reste la compilation et la mise en ligne, qui se font sur ta machine.

## Flux de travail permanent

À chaque évolution de l'app web, pour mettre à jour les versions natives :

```bash
npm run build && npx cap sync
```

C'est tout : le contenu de `dist/` est recopié dans les deux projets natifs.

---

## 1. Android (à faire en premier : 25 $ une fois, review rapide)

### Prérequis
- Android Studio (inclut le SDK et le JDK)
- Un compte [Google Play Console](https://play.google.com/console) (25 $, paiement unique)

### Compiler et tester
```bash
npx cap open android    # ouvre le projet dans Android Studio
```
- Lancer sur un appareil branché ou un émulateur (bouton ▶).
- Vérifier : sons, accordeur (autoriser le micro), boucles, chansonnier, offline.

### Créer la clé de signature (une seule fois, à conserver précieusement)
```bash
keytool -genkey -v -keystore fretbywood-release.keystore \
  -alias fretbywood -keyalg RSA -keysize 2048 -validity 10000
```
> ⚠️ Sauvegarde ce fichier + les mots de passe hors du dépôt Git.
> Une clé perdue = impossible de mettre à jour l'app publiée.

### Générer le bundle signé
Android Studio → **Build → Generate Signed App Bundle** → choisir le keystore
→ variante `release` → produit `app-release.aab`.

### Publier
1. Play Console → **Créer une application** (nom : FretByW00d, langue : français).
2. Remplir la fiche : description, icône 512 (réutilise `public/icons/icon-512.png`),
   bannière 1024×500, 2+ captures d'écran par format.
3. **Questionnaires obligatoires** : classification du contenu, sécurité des données
   (déclarer : micro utilisé pour l'accordeur, aucune donnée collectée ni transmise —
   tout reste en local).
4. Téléverser l'AAB dans une release (piste interne d'abord, puis production).
5. Politique de confidentialité : une URL est exigée dès qu'on déclare le micro.
   Une page statique suffit (ex. `https://accordguitare.joefr.cloud/confidentialite.html`
   disant : aucune donnée collectée, micro traité localement, rien ne quitte l'appareil).

### Versions suivantes
Dans `android/app/build.gradle` : incrémenter `versionCode` (+1 obligatoire)
et `versionName` (affiché), puis regénérer l'AAB.

---

## 2. iOS (nécessite un Mac + 99 $/an)

### Prérequis
- Xcode 15+, CocoaPods (`sudo gem install cocoapods`)
- Compte [Apple Developer](https://developer.apple.com) (99 $/an)

### Compiler et tester
```bash
npx cap sync ios        # sur le Mac : installe aussi les pods
npx cap open ios
```
- Dans Xcode : cible **App** → onglet *Signing & Capabilities* → choisir ton équipe.
- Lancer sur iPhone branché. Autoriser le micro à la première ouverture de l'accordeur
  (le message d'usage est déjà configuré dans `Info.plist`).

### Publier
1. Xcode → **Product → Archive** → *Distribute App* → App Store Connect.
2. Sur [App Store Connect](https://appstoreconnect.apple.com) : créer l'app
   (bundle `cloud.joefr.fretbywood`), remplir fiche + captures, joindre l'URL
   de politique de confidentialité, soumettre à la review.
3. **Note pour la review Apple** (guideline 4.2 « minimum functionality ») : préciser
   dans les notes de soumission que l'app fonctionne 100 % hors ligne et embarque
   des fonctionnalités riches côté appareil : accordeur temps réel par micro,
   métronome, détection d'accords, boucles d'entraînement, chansonnier.
   C'est ce qui la distingue d'un simple site encapsulé.

---

## 3. Récapitulatif de ce qui est déjà fait

- `capacitor.config.ts` : appId `cloud.joefr.fretbywood`, fond `#0c0c0e`.
- Projets `android/` et `ios/` générés et synchronisés avec le build web.
- Icônes et écrans de démarrage **toutes densités** générés (100 fichiers Android,
  13 iOS) depuis `assets/icon.png` et `assets/splash.png` — pour les refaire :
  `npx capacitor-assets generate --android --ios`.
- Permissions micro : `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` (Android),
  `NSMicrophoneUsageDescription` en français (iOS).
- Zones sûres (encoches) gérées : `viewport-fit=cover` + `safe-area-inset`.
- Le service worker PWA est désactivé dans l'app native (assets locaux, inutile).
- Version Android alignée : `versionName 1.9`.
