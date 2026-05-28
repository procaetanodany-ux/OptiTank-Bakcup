# Design Brief — OptiTank (Fillz)
**Pour Claude Design · Version 1.0 · Mai 2026**

---

## Contexte du projet

**OptiTank** est une PWA mobile-first destinée aux conducteurs suisses. Elle compare les prix des carburants en temps réel (3 000+ stations via l'API TCS), optimise les trajets pour économiser sur le plein, et suit les consommations personnelles.

L'app est fonctionnellement ~80% complète. Le code tourne, les données réelles arrivent, la logique métier est solide. Ce brief porte **uniquement sur le design visuel et l'expérience utilisateur** : ce qui manque de polish, ce qui est incohérent, et ce qui reste à imaginer.

---

## Stack & contraintes techniques

- Vanilla JS + Vite (pas de framework UI — pas de composants React/Vue)
- CSS pur (style.css + components.css) — pas de Tailwind ni CSS-in-JS
- Leaflet pour la carte
- Chart.js pour les graphiques
- Phosphor Icons pour les icônes
- Mobile-first (iPhone 14 Pro = référence)
- Mode PWA installable (standalone, pas de barre navigateur)
- Support dark mode (déjà partiellement en place)

---

## Design actuel — ce qui existe déjà

### Identité visuelle
- **Couleur principale :** `#6C63FF` (violet/indigo)
- **Accent :** `#00D4AA` (vert menthe/teal)
- **Fond dark :** `#0A0A0F` (quasi-noir)
- **Cards :** `rgba(255,255,255,0.05)` avec `backdrop-filter: blur(20px)` → glassmorphism
- **Bordures :** `rgba(108,99,255,0.2)`
- **Police :** Inter (Google Fonts)
- **Radius général :** 16–24px

### Navigation
- Bottom navigation pill flottant (5 tabs : Carte, Radar IA, Trajet, Stats, Profil)
- Transitions slide entre les vues (CSS transform)
- Bottom sheet swipeable pour les détails de station

### État des écrans
| Écran | État design |
|---|---|
| Onboarding / Auth | ✅ Propre, cohérent |
| Carte interactive | ⚠️ Fonctionnel, manque de finition |
| Radar IA | ⚠️ Animation basique, résultats peu lisibles |
| Détail station | ✅ Bon, quelques incohérences |
| Trajet intelligent | ⚠️ Dense, peu aéré |
| Statistiques | ⚠️ Chart.js brut, pas stylisé |
| Profil | ⚠️ Incomplet visuellement |
| Alertes prix | ❌ Modal sans identité visuelle propre |
| Suivi consommation | ⚠️ Formulaire fonctionnel, UX rugueuse |
| Badges / Gamification | ❌ UI présente mais vide, pas de design système |

---

## Ce qu'on demande à Claude Design

### 1. Design System complet (livrables prioritaires)

Créer un **design system cohérent** pour l'app sous forme de fichier CSS ou de spécifications visuelles :

**Tokens de design :**
```
Couleurs (light + dark)
- Primary : #6C63FF
- Primary light : #8B84FF
- Accent : #00D4AA
- Success : #22C55E
- Warning : #F59E0B
- Danger : #EF4444
- Background : #0A0A0F / #F8F8FF
- Surface : rgba(255,255,255,0.05) / rgba(0,0,0,0.04)
- Text primary, secondary, tertiary

Espacements : 4 / 8 / 12 / 16 / 24 / 32 / 48px
Radius : 8 / 12 / 16 / 24 / 32px (pill = 999px)
Shadows : 3 niveaux (sm, md, lg)
Blur glassmorphism : 12px / 20px / 40px
```

**Composants à spécifier :**
- Boutons (primary, secondary, ghost, danger) + états hover/active/disabled
- Cards (standard, cliquable, sélectionnée)
- Badges / chips (statut, prix, carburant)
- Inputs & formulaires (texte, select, toggle)
- Bottom sheet (handle, backdrop, animation)
- Toast notifications (success, warning, error, info)
- Skeleton loaders
- Marqueurs carte (vert/rouge/gris + selected)

---

### 2. Refonte de l'écran Radar IA

C'est l'écran signature de l'app, il doit être **mémorable et premium**.

**Problème actuel :**
- Animation radar = simple cercle pulsant générique
- Les 5 résultats sont listés en cards basiques sans hiérarchie visuelle
- Le calcul "coût total = prix pompe + détour" n'est pas mis en valeur

**Ce qu'on veut :**
- Une **animation radar réelle** : lignes tournantes, balayage sonar, particules/dots représentant les stations sur le radar pendant le scan
- Un **podium visuel** pour le top 3 : #1 mis en évidence (grande card), #2 et #3 plus petites
- **Économies estimées** affichées en grand, avec animation de comptage (ex: "Vous économisez CHF 4.20")
- Indicateur de distance + détour sous forme de mini-badge coloré
- Bouton "Aller" intégré dans la card #1 directement

**Moodboard souhaité :** Apple Maps + Waze + app fintech premium

---

### 3. Refonte de la carte interactive

**Problèmes actuels :**
- Toolbar filtre en haut = visuellement chargée, prend trop de place
- Les marqueurs Leaflet par défaut sont remplacés par des cercles CSS — manquent de lisibilité aux petits zooms
- Le bottom sheet s'ouvre mais son handle + transition ne sont pas fluides visuellement

**Ce qu'on veut :**
- **Toolbar filtres** : collapsible pill en haut, s'étend en drawer latéral ou bottom sheet sur tap
- **Marqueurs repensés** : petites bulles de prix (ex: "1.89") avec fond coloré (vert/orange/rouge selon écart à la moyenne), ombre portée, bordure blanche
- **Bottom sheet station** : header avec photo/logo de la marque, gradient de fond, boutons d'action en ligne (Naviguer / Alerter / Favori) bien espacés
- **FAB GPS** : plus visible, position plus intuitive (bas droite, au-dessus de la navbar)

---

### 4. Écran Statistiques & Graphiques

**Problème actuel :**
- Chart.js en thème par défaut — courbes sans identité
- Pas de résumé KPI en haut de l'écran
- Comparaison multi-stations = liste de checkboxes peu attrayante

**Ce qu'on veut :**
- **Header KPI** : 3 métriques en card horizontale scrollable (Ex: "Moy. 30j : 1.85 CHF", "Meilleur prix trouvé : 1.72 CHF", "Économies total : CHF 32")
- **Graphique stylisé** : gradient fill sous les courbes, axes minimalistes, tooltip custom avec fond glassmorphism
- **Sélecteur de stations** : chips avec couleur correspondant à la courbe (max 5), design pill avec X pour déselectionner
- **Sélecteur de période** : tabs segmentés (7j / 30j / 90j) style iOS

---

### 5. Écran Profil repensé

**Problème actuel :**
- Avatar + infos = layout basique
- Badges = grid vide non stylisée
- Historique plein = liste dense

**Ce qu'on veut :**
- **Hero section** : grande bannière en haut avec gradient, avatar centré avec anneau de progression (% de badges débloqués), nom + véhicule dessous
- **Savings card** : encart vert prominent "Vous avez économisé CHF 47.30 ce mois" avec graphique sparkline
- **Section badges** : grille 3×N avec badges bien designés — état verrouillé (gris + cadenas) vs débloqué (couleur + glow subtil), nom du badge sous chaque icône
- **Historique** : liste avec icône carburant, date, station, litres, coût — séparateurs par mois, swipe-to-delete

---

### 6. Système de badges / Gamification

Les badges sont le coeur de la rétention. Aucun design système n'existe encore.

**Ce qu'on veut :**
Créer **12–15 badges** avec :
- Une icône centrale (phosphor ou custom SVG)
- Un nom court (ex: "Économe", "Grand Explorateur", "Fidèle Migrol")
- Un fond circulaire avec gradient thématique (chaque badge = palette propre)
- Un état locked (niveaux de gris + flou léger)
- Un état unlocked (couleurs vives + subtle glow animation)
- Un état "nouveau" (confetti / pulse animation au débloquage)

**Liste de badges suggérés :**
| Badge | Condition | Couleur |
|---|---|---|
| Premier plein | 1er enregistrement | Or |
| Économe | Économiser 10 CHF | Vert |
| Grand explorateur | 10 stations différentes | Bleu |
| Radar addict | 50 scans radar | Violet |
| Fidèle | 7 jours consécutifs | Orange |
| Chasseur de prix | Trouver -0.20 CHF vs moy | Rouge |
| Routard | 5 trajets planifiés | Teal |
| Scanner | 5 tickets scannés | Jaune |
| Communauté | 3 prix signalés | Rose |
| Vétéran | 3 mois d'utilisation | Argent |

---

### 7. Onboarding — amélioration des étapes véhicule

**Problème actuel :**
- La sélection du véhicule est un formulaire select classique (marque → modèle → année)
- Pas de preview visuelle du véhicule sélectionné
- Aucune animation entre les étapes

**Ce qu'on veut :**
- **Sélection de marque** : grille de logos de marques (Shell, Migrol, AVIA, Volvo, BMW…) sur cards tactiles
- **Preview véhicule** : silhouette SVG générique (berline / SUV / break) qui s'affiche après sélection
- **Barre de progression** : 4 étapes visualisées avec step indicator animé
- **Transition entre étapes** : slide horizontal (step 1 → 2 → 3 → 4)

---

### 8. États vides & erreurs

Actuellement inexistants pour la plupart des écrans.

**À créer pour chaque écran :**
- **État vide** (pas de données encore) : illustration SVG minimaliste + message encourageant + CTA
- **État erreur réseau** : icône Wi-Fi coupé + bouton "Réessayer"
- **État chargement** : skeleton animé (pas de spinner générique)

**Illustrations vides souhaitées :**
- Radar : "Aucune station trouvée dans ce rayon" → illustration radar vide
- Trajet : "Entrez votre destination" → illustration voiture sur route
- Stats : "Enregistrez votre premier plein" → illustration graphique vide
- Profil / badges : "Débloquez votre premier badge" → illustration trophée

---

### 9. Mode clair (Light Mode)

Actuellement le dark mode est le seul mode stable. Le light mode existe mais n'est pas cohérent.

**Ce qu'on veut :**
- Fond : `#F5F5F7` (style Apple)
- Cards : blanc pur avec ombre légère (pas de glassmorphism en light mode)
- Textes : `#1C1C1E` / `#3A3A3C` / `#8E8E93`
- Primary violet conservé
- Carte Leaflet : thème clair (CartoDB Light)
- Tous les composants revisités pour le light mode

---

### 10. Micro-interactions & animations

**À définir / ajouter :**
- Tap feedback sur tous les éléments cliquables (scale 0.96 + haptic-like)
- Animation d'ajout aux favoris (coeur qui pulse + particules)
- Transition de vue : slide horizontal entre les onglets, pas juste un fade
- Chart.js : animation d'entrée (draw from left)
- Bottom sheet : spring physics (overshoot léger à l'ouverture)
- Badge unlock : confetti burst + son (optionnel)
- Radar scan : rotation fluide 60fps, particules qui apparaissent progressivement

---

## Livrables attendus

Voici ce que le brief doit produire, par ordre de priorité :

| # | Livrable | Format |
|---|---|---|
| 1 | Design system CSS (tokens + composants) | `.css` ou spécifications |
| 2 | Maquettes Radar IA (scan + résultats) | Figma / image annotée |
| 3 | Maquettes Carte (filtres + marqueurs + bottom sheet) | Figma / image annotée |
| 4 | Maquettes Profil (hero + badges + historique) | Figma / image annotée |
| 5 | Système de badges (12-15 badges illustrés) | SVG / PNG set |
| 6 | Maquettes Statistiques (KPI + chart stylisé) | Figma / image annotée |
| 7 | États vides + erreurs (illustrations) | SVG set |
| 8 | Spécifications animations / micro-interactions | Description détaillée ou prototype |
| 9 | Light mode tokens & composants | `.css` ou spécifications |

---

## Références visuelles

**Apps à s'inspirer :**
- **Waze** — carte, marqueurs de prix, gamification
- **Revolut** — statistiques, graphiques premium, dark mode
- **Apple Maps** — qualité des transitions, bottom sheet
- **Duolingo** — système de badges, gamification engageante
- **Linear** — design system cohérent, micro-animations
- **Robinhood** — graphiques financiers stylisés

**Style général souhaité :**
> Dark-first, glassmorphism subtil, violet/teal comme couleurs d'accentuation, très mobile-native, animations rapides (200–350ms), sentiment de qualité premium sans être clinquant.

crée egalement une mascotte et un nom pour elle 

---



## Ce qu'on ne veut PAS

- Redesign complet qui casserait le code existant
- Animations lentes (> 500ms) ou complexes (WebGL)
- Typographies fantaisistes (Inter reste la référence)
- Illustrations trop chargées ou cartoonesques
- Changement de l'identité couleur (violet #6C63FF est fixé)
- UI qui ne passe pas sur iPhone SE (375px min-width)

---

*Brief rédigé le 20 mai 2026 · Projet OptiTank (fillz) · Pour usage interne Claude Design*
