# 🧪 OptiTank — Protocole de Test Complet

> Version : 1.0 · Date : 2026-05-20  
> Environnement : PWA installée sur mobile ou desktop (mode standalone)

---

## 📋 Données de Test

| Champ              | Valeur                        |
|--------------------|-------------------------------|
| **Email (compte test)**  | `testeur@optitank.ch`    |
| **Mot de passe**   | `Test1234!`                   |
| **Prénom**         | `Alex`                        |
| **Nom**            | `Testeur`                     |
| **Ville de départ (Trajet)** | `Lausanne`          |
| **Ville d'arrivée (Trajet)** | `Genève`            |
| **Type de carburant** | `Essence (SP95-E10)`       |
| **Consommation simulée** | `8.0 L/100km`          |
| **Prix à signaler** | `1.89 CHF/L`                 |
| **Station à signaler** | `Migrol Lausanne Centre`  |

---

## 🚀 Bloc 0 — Préparation

### 0.1 Accès Vitrine (mode non-PWA)
- [ ] Ouvrir l'URL dans un navigateur ordinaire (pas en standalone)
- [ ] Vérifier que la page vitrine s'affiche (pas l'app)
- [ ] Le splash s'anime correctement : glow → logo spring-in → wordmark → tagline → dots → slide-up
- [ ] Vérifier le header avec logo sans fond + texte OptiTank.
- [ ] Les 3 sections de la vitrine sont visibles : Hero, Fonctionnalités, CTA
- [ ] Le bouton "Installer l'app →" est présent et cliquable
- [ ] Les éléments avec `.reveal` s'animent au scroll
- [ ] Le radar canvas de la vitrine tourne et affiche des blips colorés
- [ ] La navbar mobile fonctionne (icône hamburger → menu déroulant)

### 0.2 Installation PWA
- [ ] Cliquer sur "Installer l'app" ou utiliser le bouton d'installation du navigateur
- [ ] Confirmer l'installation
- [ ] L'icône OptiTank apparaît sur le bureau/écran d'accueil
- [ ] Relancer depuis l'icône → mode standalone détecté → l'**app** s'affiche (pas la vitrine)

---

## 🔐 Bloc 1 — Authentification

### 1.1 Inscription
- [ ] Écran de connexion visible au lancement
- [ ] Cliquer sur "Créer un compte"
- [ ] Remplir Email : `testeur@optitank.ch`
- [ ] Remplir Mot de passe : `Test1234!`
- [ ] Valider → connexion réussie, redirection vers le Radar IA
- [ ] Le nom affiché dans le profil correspond au compte créé

### 1.2 Déconnexion
- [ ] Aller dans l'onglet Profil (icône utilisateur)
- [ ] Cliquer sur "Se déconnecter"
- [ ] L'app retourne à l'écran de connexion

### 1.3 Reconnexion
- [ ] Saisir Email : `testeur@optitank.ch`
- [ ] Saisir Mot de passe : `Test1234!`
- [ ] Cliquer "Se connecter"
- [ ] Connexion réussie → Radar IA visible

### 1.4 Erreur de mot de passe
- [ ] Tenter de se connecter avec le mauvais mot de passe `Faux1234!`
- [ ] Un message d'erreur s'affiche (pas de crash)

---

## 📡 Bloc 2 — Radar IA

### 2.1 Affichage initial
- [ ] Le canvas Radar tourne avec l'animation sonar (balayage + anneaux)
- [ ] La bannière de scan s'affiche pendant le chargement
- [ ] Après 2–4 secondes, les résultats apparaissent

### 2.2 Résultats du scan
- [ ] Au moins 1 station est affichée (données TCS Switzerland)
- [ ] La station #1 est en vert avec un prix en CHF/L
- [ ] Le bouton "⚡ Aller maintenant →" est présent pour la station #1
- [ ] Les stations #2 à #5 sont affichées sous forme de rangées compactes
- [ ] La bannière d'économie "Vous économisez CHF X.XX" est visible

### 2.3 Action "Aller"
- [ ] Cliquer sur "⚡ Aller maintenant →"
- [ ] L'app passe à la vue Trajet avec la destination pré-remplie

### 2.4 KPI en bas / bannière économie
- [ ] La valeur CHF affichée est calculée (différence entre le meilleur prix et le prix moyen)
- [ ] Chiffre cohérent avec les prix listés

---

## 🗺️ Bloc 3 — Carte

### 3.1 Chargement de la carte
- [ ] La carte Leaflet se charge avec le thème sombre
- [ ] Les stations sont affichées sous forme de marqueurs/clusters
- [ ] Le zoom fonctionne (pinch sur mobile, scroll sur desktop)

### 3.2 Recherche sur la carte
- [ ] Taper `Lausanne` dans la barre de recherche
- [ ] Les résultats apparaissent et la carte se recentre sur Lausanne
- [ ] Les marqueurs de stations autour de Lausanne sont visibles

### 3.3 Popup de station
- [ ] Cliquer sur un marqueur
- [ ] Un popup s'ouvre avec le nom de la station, le prix, la distance
- [ ] Le bouton "Ajouter aux favoris" ⭐ est présent

### 3.4 Filtres carburant
- [ ] Changer le type de carburant (ex : passer de SP95 à Diesel)
- [ ] La carte actualise les prix affichés

---

## ⭐ Bloc 4 — Favoris

### 4.1 Ajout d'un favori
- [ ] Depuis la carte, ouvrir le popup d'une station
- [ ] Cliquer sur l'étoile / "Ajouter aux favoris"
- [ ] Un toast de confirmation s'affiche
- [ ] Naviguer vers l'onglet Favoris
- [ ] La station apparaît dans la liste des favoris

### 4.2 Suppression d'un favori
- [ ] Dans la liste des favoris, swiper ou long-press sur un favori
- [ ] Confirmer la suppression
- [ ] La station disparaît de la liste

### 4.3 Persistance
- [ ] Fermer et relancer l'app
- [ ] Le favori ajouté est toujours présent (stockage Firebase)

---

## 🛣️ Bloc 5 — Trajet

### 5.1 Calcul de trajet de base
- [ ] Aller dans l'onglet Trajet
- [ ] Départ : `Lausanne`
- [ ] Arrivée : `Genève`
- [ ] Cliquer sur "Calculer"
- [ ] L'animation de chargement en 4 étapes s'affiche (Calcul itinéraire → Scan des stations → Analyse des prix → Résultats prêts)
- [ ] Les résultats s'affichent avec la distance (km) et le temps estimé

### 5.2 Résultats du trajet
- [ ] La meilleure station sur le trajet est mise en avant
- [ ] Le coût estimé en CHF est affiché
- [ ] Le détour en minutes est indiqué

### 5.3 État vide
- [ ] Fermer le trajet calculé (ou effacer les champs)
- [ ] L'illustration de route SVG "Entrez un trajet" s'affiche correctement

### 5.4 Adresse invalide
- [ ] Entrer `zzzzinvalidxxx` comme départ
- [ ] Un message d'erreur s'affiche (pas de crash)

---

## 📊 Bloc 6 — Statistiques

### 6.1 Affichage des KPIs
- [ ] Aller dans l'onglet Stats
- [ ] Les 4 KPI cards sont visibles :
  - `Prix moyen` (CHF/L)
  - `Meilleur prix trouvé` (CHF/L)
  - `Économies totales` (CHF)
  - `Pleins effectués` (nombre)
- [ ] Les valeurs correspondent aux données réelles (ou affichent `—` si pas encore de données)

### 6.2 Graphiques
- [ ] Un graphique Chart.js est visible (évolution des prix)
- [ ] Le graphique est interactif (tap sur un point → tooltip)

### 6.3 Historique des pleins
- [ ] Après avoir signalé un prix (Bloc 7), revenir aux Stats
- [ ] L'historique s'actualise

---

## 📸 Bloc 7 — Signalement de Prix

### 7.1 Signalement manuel
- [ ] Aller sur la Carte, sélectionner une station
- [ ] Cliquer sur "Signaler un prix"
- [ ] Entrer le prix : `1.89`
- [ ] Sélectionner le carburant : `SP95-E10`
- [ ] Valider
- [ ] Un toast de confirmation apparaît
- [ ] Le prix est enregistré dans Firestore (vérifier dans la console Firebase)

### 7.2 Signalement OCR (photo)
- [ ] Cliquer sur l'icône appareil photo dans le formulaire de signalement
- [ ] Prendre une photo (ou importer une image) d'un affichage de prix
- [ ] Tesseract.js tente de lire le prix automatiquement
- [ ] Le champ prix se remplit (ou reste vide si illisible — pas de crash)

---

## 🏆 Bloc 8 — Gamification & Badges

### 8.1 Profil
- [ ] Aller dans l'onglet Profil
- [ ] Les infos utilisateur sont affichées (email, nom)
- [ ] La grille de badges est visible (12 badges)

### 8.2 Badges débloqués
- [ ] Les badges débloqués ont leur icône SVG en couleur avec effet de brillance
- [ ] Les badges verrouillés affichent un overlay avec un cadenas

### 8.3 Premier badge — "Explorateur"
- [ ] Ce badge se débloque à la première connexion
- [ ] Vérifier qu'il est affiché comme débloqué dans le profil

### 8.4 Toast de badge
- [ ] Déclencher une action qui débloque un badge (ex : premier signalement de prix)
- [ ] Un toast avec l'icône SVG du badge et son nom s'affiche en bas d'écran
- [ ] Le toast disparaît après 4 secondes

---

## ⚙️ Bloc 9 — Paramètres & Préférences

### 9.1 Changement de type de carburant
- [ ] Aller dans Paramètres (onglet ou modal)
- [ ] Changer le carburant de `SP95-E10` à `Diesel`
- [ ] Valider
- [ ] Retourner sur le Radar → les prix affichés sont pour le diesel

### 9.2 Profil véhicule
- [ ] Changer la consommation à `8.0 L/100km`
- [ ] Le calcul de coût du trajet utilise cette valeur

### 9.3 Persistance des paramètres
- [ ] Fermer et relancer l'app
- [ ] Les préférences (carburant, consommation) sont conservées (localStorage)

---

## 📱 Bloc 10 — PWA & Technique

### 10.1 Mode hors-ligne
- [ ] Activer le mode avion
- [ ] Relancer l'app
- [ ] L'app se charge (service worker cache)
- [ ] Un message "Hors-ligne" est affiché si une fonctionnalité requiert Internet

### 10.2 Splash screen
- [ ] Au lancement, le splash s'anime :
  1. Glow violet + teal apparaissent (300ms)
  2. Le logo teardrop entre en scène avec effet spring (500ms)
  3. Le wordmark "OptiTank." slide-up (400ms)
  4. La tagline "Carburant intelligent · Suisse 🇨🇭" fade-in (350ms)
  5. Les 3 points de chargement pulsent en teal (950ms)
  6. L'écran slide-up vers le haut et disparaît
- [ ] Aucun flash blanc visible
- [ ] Transition fluide vers l'app

### 10.3 Responsive
- [ ] Tester sur iPhone 13/14 Pro (393×852)
- [ ] Tester sur Android (360×800)
- [ ] Aucun élément ne déborde ou n'est tronqué

### 10.4 Performance
- [ ] Temps de premier affichage < 3s sur 4G
- [ ] Animations à 60fps (vérifier avec DevTools Performance)

---

## ✅ Checklist Finale

| Test                                          | Statut |
|-----------------------------------------------|--------|
| Vitrine visible hors PWA                      | ⬜     |
| Splash animé complet (6 phases)               | ⬜     |
| Inscription + connexion fonctionnelles        | ⬜     |
| Radar IA charge les stations réelles          | ⬜     |
| Carte Leaflet avec clusters                   | ⬜     |
| Ajout/suppression de favoris                  | ⬜     |
| Calcul de trajet Lausanne → Genève            | ⬜     |
| Signalement de prix enregistré Firebase       | ⬜     |
| 12 badges affichés (SVG gradient + cadenas)   | ⬜     |
| KPI Stats actualisés                          | ⬜     |
| Paramètres persistants (localStorage)         | ⬜     |
| Mode hors-ligne fonctionnel                   | ⬜     |
| 0 crash / 0 erreur console critique           | ⬜     |

---

## 🐛 Rapport de Bug

Pour chaque anomalie, noter :
```
[BLOC X.Y] Description courte du problème
Steps: 1. ... 2. ... 3. ...
Attendu: ...
Obtenu: ...
Device / Browser: ...
Screenshot: (si disponible)
```

---

*Protocole généré pour OptiTank v1.0 · Swiss PWA · Vite 5 + Firebase + Leaflet*
