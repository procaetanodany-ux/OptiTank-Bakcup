# OptiTank iOS App

WebView wrapper for optitank.online — Swift / iOS 16+.

## Ouvrir dans Xcode

1. Copier ce dossier `ios_app/` sur un Mac avec Xcode 15+
2. Ouvrir `OptiTank.xcodeproj` dans Xcode
3. Sélectionner l'équipe de signature : **Signing & Capabilities → Team**
4. Changer le Bundle ID si besoin : `online.optitank.app`
5. ⌘R pour compiler sur simulateur ou appareil réel

## Activer les Push Notifications

Dans Xcode, onglet **Signing & Capabilities** du target OptiTank :

1. Cliquer **+ Capability**
2. Ajouter **Push Notifications**
3. Ajouter **Background Modes** → cocher **Remote notifications**

Cela génère l'entitlement `.entitlements` nécessaire pour APNs.

## Utiliser le bridge JS ↔ Swift

Depuis le JavaScript du site, appeler le bridge natif :

```js
// Demander la permission de notifications
window.OptiTankBridge.post({ type: 'requestNotifications' });

// Récupérer le token APNs
window.OptiTankBridge.post({ type: 'getAPNSToken' });
window.addEventListener('apns-token', e => console.log('token:', e.detail));

// Naviguer vers une URL
window.OptiTankBridge.post({ type: 'navigate', url: 'https://optitank.online/map' });

// Détecter qu'on est dans l'app native
if (window.isOptiTankApp) {
  // Masquer le header de la vitrine, adapter l'UI, etc.
}
```

## Envoyer une notification push (test)

Utiliser le payload APNs suivant via Firebase Cloud Messaging ou directement via l'API APNs :

```json
{
  "aps": {
    "alert": {
      "title": "Prix mis à jour",
      "body": "SP95 maintenant à CHF 1.849 près de vous"
    },
    "badge": 1,
    "sound": "default"
  },
  "url": "https://optitank.online?station=12345"
}
```

Le champ `url` est optionnel — s'il est présent, l'app navigue vers cette URL quand l'utilisateur tape la notification.

## Structure des fichiers

```
ios_app/
├── OptiTank.xcodeproj/
│   └── project.pbxproj        — projet Xcode
└── OptiTank/
    ├── App.swift               — point d'entrée SwiftUI
    ├── AppDelegate.swift       — gestion APNs (token, background push)
    ├── ContentView.swift       — vue principale + splash de chargement
    ├── WebView.swift           — WKWebView + bridge JS↔Swift + pull-to-refresh
    ├── NotificationManager.swift — permission + affichage + tap notification
    └── Info.plist              — config app (permissions, background modes)
```
