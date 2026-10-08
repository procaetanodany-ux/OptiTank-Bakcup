# Audit OptiTank — 8 octobre 2026

Périmètre : `webapp/` (site Vite + Firebase), `OptiTank1/ios_app/` (app iOS), et le site en
ligne optitank.online. Les points marqués « corrigé » le sont dans le code de ce dossier ;
rien n'a été déployé sur Firebase.

## 1. Pourquoi la connexion Apple / Google ne marchait plus

- Le site en ligne a été redéployé le 8 août 2026 avec une version **plus ancienne** que le
  code de ce dossier. Elle ouvre Apple et Google dans une popup, ce qui ne fonctionne pas
  dans la vue web de l'app iOS. Google refuse de toute façon toute connexion dans une vue
  web intégrée.
- Cette ancienne version n'a plus le pont avec l'app native : localisation native, widget et
  enregistrement du jeton de notification ne sont plus appelés depuis l'app.
- Elle ne contient pas non plus `support.html` ni `privacy.html` : ces deux adresses
  renvoient la page d'accueil. Ce sont les URL d'assistance et de confidentialité de la fiche
  App Store.
- Le code local, lui, n'avait pas de bouton Google.
- Les fournisseurs Apple et Google sont bien activés dans Firebase.

**Corrigé**
- App iOS : connexion Apple (feuille système) et Google (session d'authentification du
  système, OAuth + PKCE avec le client iOS de `GoogleService-Info.plist`) dans
  `OptiTank1/ios_app/OptiTank/NativeAuth.swift`, reliées à la page par le message
  `nativeSignIn` dans `WebView.swift`.
- Web : boutons Google ajoutés (connexion et inscription), `handleSocialAuth` réécrit dans
  `webapp/src/main.js`. App récente → jeton natif ; navigateur → popup ; ancienne app →
  redirection Apple comme avant, et message « mets à jour l'app » pour Google.
- Suppression de compte : la ré-authentification utilise maintenant le fournisseur réel du
  compte (elle forçait Apple et appelait une popup dans l'app).

**Reste à faire** : redéployer le site depuis `webapp/`. Tant que ce n'est pas fait, même la
nouvelle app reste sur l'ancien site et la connexion ne fonctionnera pas.

**Non testé** : une vraie connexion Apple ou Google de bout en bout (il faut un compte réel,
et le site corrigé en ligne). Vérifié : compilation iOS, archive, et le parcours web avec un
pont natif simulé (les deux boutons envoient bien la demande native, l'erreur s'affiche, la
case CGU bloque l'inscription).

## 2. Sécurité — à décider, rien n'a été modifié

| Gravité | Constat | Où |
|---|---|---|
| Haute | `app_config` est modifiable par n'importe qui, sans connexion (`allow write: if true`). On peut activer/désactiver des pays ou changer `app_version` pour tous les utilisateurs. | `webapp/firestore.rules` |
| Haute | Tout utilisateur connecté peut lire tous les jetons de notification, et la fonction `sendPushNotif` accepte n'importe quel utilisateur connecté : n'importe qui peut envoyer une notification à tous les utilisateurs. | `webapp/firestore.rules`, `webapp/functions/src/index.ts` |
| Haute | Une clé privée Apple (`AuthKey_….p8`) est enregistrée dans git et présente sur GitHub. À régénérer dans le compte développeur Apple, puis à retirer du dépôt. | `webapp/` |
| Moyenne | Le mot de passe admin est écrit en clair dans le JavaScript envoyé aux visiteurs. Le panneau vérifie aussi l'e-mail, mais ce mot de passe est à considérer comme public : à changer s'il sert ailleurs. | `webapp/src/main.js` (`openAdminLogin`) |
| Moyenne | `tcsProxy` relaie n'importe quel chemin vers Firestore et l'API TCS : proxy ouvert. | `webapp/optitank/index.js` |
| Moyenne | `planRoute` (clé Gemini) et `syncPortugalNow` (9 min, 512 Mo) sont publiques sans authentification : risque de facture. | `webapp/functions/src/index.ts`, `webapp/optitank/index.js` |

## 3. Fonctionnel

- **Notifications** : `sendAPNS` utilise `production: false`. Les apps installées depuis
  l'App Store ou TestFlight ont des jetons de production et ne reçoivent donc pas les
  alertes de prix. Non modifié.
- **Widget** : sa version était figée à 1.0 (1) alors que l'app était en 1.1. Corrigé, il
  suit maintenant la version de l'app.
- **Projet Xcode** : une cible « OptiTank copy » pointe vers un Info.plist en chemin absolu.
  Elle n'est pas utilisée pour l'App Store ; à supprimer si elle ne sert plus.
- **Langue** : l'interface est uniquement en français, alors qu'une fiche allemande est
  prévue.

## 4. Optimisation

**Fait**
- `chart.js` n'est plus chargé au démarrage, seulement à l'ouverture d'un graphique.
- Firebase et Leaflet sont dans des fichiers séparés, qui restent en cache quand le code de
  l'app change.
- JavaScript chargé au démarrage : 1 280 kB → 1 069 kB (335 → 263 kB compressé).

**Pistes restantes**
- Icônes Phosphor : trois graisses complètes sont importées (270 kB de CSS, environ 150 kB
  de police par graisse). Ne garder que les icônes utilisées ferait gagner le plus.
- `main.js` fait 325 kB dans un seul fichier, panneau admin compris. Charger l'admin à la
  demande allégerait le démarrage pour tous les autres utilisateurs.

## 5. App Store

- Build **1.2 (9)** envoyé sur App Store Connect le 8 octobre 2026. La 1.1 était déjà
  approuvée, Apple refuse un nouveau build sous ce numéro.
- Fiche FR/DE : `AppStore/fiche-app-store.md`.
