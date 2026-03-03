<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version Change: [TEMPLATE] → 1.0.0 (Initial ratification)

Modified Principles: N/A (Initial version)

Added Sections:
- Core Principles (8 principles: Modular Integration Architecture, Sequence Engine First,
  Display & Wallmount System, Voting & User Access, Trailer Management, Configuration
  Sovereignty, Test-First & Quality, Self-Hosted & Docker Native)
- Architecture Constraints (API Design, Data Model, Node Editor, TMDB Integration)
- Development Workflow (Branching, Code Standards, Release Cycle)
- Governance

Removed Sections: N/A (Initial version)

Templates Requiring Updates:
- plan-template.md: ⚠️ PENDING - Constitution Check section should be updated to
  reflect the 8 principles (adapter testability, sequence engine centrality, 80% coverage
  on core, Docker-native deployment)
- spec-template.md: ✅ No changes needed - template is generic and compatible
- tasks-template.md: ✅ No changes needed - template is generic and compatible

Follow-up TODOs: None
================================================================================
-->

# Theatarr Constitution
> Home Cinema Orchestration System — Écosystème Xenocloud

## Core Principles

### I. Modular Integration Architecture
Theatarr est un **orchestrateur**, pas un monolithe. Chaque service externe (éclairage,
son, lecteur vidéo, source média) est encapsulé dans un **adaptateur** autonome avec une
interface unifiée. L'ajout d'un nouveau service ne doit jamais nécessiter de modifier le
cœur applicatif. Chaque adaptateur est indépendamment testable, documenté, et expose ses
capacités via un contrat standardisé (`ServiceAdapter` interface). Un service peut être
activé, désactivé ou remplacé à chaud sans affecter les autres.

**Services supportés (non exhaustif, extensible) :**
- **Éclairage** : Philips Hue, IKEA TRÅDFRI, Govee, ESPHome, Zigbee2MQTT, Home Assistant
- **Lecteurs vidéo** : Android TV (ADB), Apple TV (pyatv), Fire TV, Chromecast (Cast API)
- **Sources média** : Plex, Jellyfin
- **Métadonnées** : TMDB (enrichissement + cache local), affiches, bandes-annonces
- **Audio d'ambiance** : Fichiers locaux, SoundCloud, Home Assistant Media Player
- **Actionneurs** : Vidéoprojecteurs, écrans motorisés, rideaux, ventilateurs (via ESPHome/HA)

### II. Sequence Engine First
Le **moteur de séquences** est le cœur absolu de Theatarr. Tout tourne autour du concept
de **Session** composée de **Séquences** ordonnées. Chaque séquence définit un état
complet de l'environnement :
- **Éclairage** : couleur, intensité, effet, transition (fade, flash, pulse…)
- **Audio** : source, playlist, volume, fade in/out
- **Affichage** : contenu écran (page web, média, noir, wallmount)
- **Média** : contenu vidéo à lancer ou arrêter
- **Durée** : fixe (timer), dynamique (durée du contenu), ou manuelle (action utilisateur)
- **Actionneurs** : tout dispositif domotique contrôlable

Les séquences sont infiniment créables, réordonnables, duplicables, et exportables. Le
moteur supporte deux modes de création : **mode linéaire** (liste ordonnée classique) et
**mode graphique** (éditeur de nœuds visuels avec connexions conditionnelles).

### III. Display & Wallmount System
Theatarr expose des **pages web publiques** dédiées à l'affichage sur écran
(ex: `/wallmount`). Ces pages sont pilotées par des **templates personnalisables** définis
dans des fichiers de configuration (JSON/YAML) supportant :
- Contenu dynamique : affiche du film, titre, durée, synopsis, compteur, heure
- Animations CSS/JS natives : textes défilants, transitions, effets parallaxe
- Thème de couleurs **auto-extrait de l'affiche** du film (palette dominante)
- Choix entre affiche principale ou alternative comme source de palette
- Templates partageables et importables par la communauté

### IV. Voting & User Access
Le système de vote est une fonctionnalité sociale clé. L'administrateur propose 2 à 6
films (sélection manuelle ou aléatoire par filtres : genre, année, note, non vus). Un
**lien unique** est généré et envoyé aux invités. La page de vote est accessible **sans
compte** via token temporaire. Le film gagnant est automatiquement programmé dans la
session. L'accès utilisateur est strictement contrôlé : seules les pages de vote et le
wallmount public sont accessibles aux invités ; l'administration reste protégée.

### V. Trailer Management
Theatarr gère un **système autonome de bandes-annonces** :
- Téléchargement automatique via TMDB/YouTube selon filtres (genre, année, popularité,
  langue, qualité)
- Rotation intelligente : suppression des plus anciennes, limite d'espace configurable
- Catégorisation et tagging automatique
- Sélection contextuelle pour les sessions (par genre du film principal, aléatoire,
  manuelle)
- Exclusion optionnelle des films déjà dans la bibliothèque

### VI. Configuration Sovereignty
Toute la configuration de Theatarr est **portable et souveraine** :
- Import/Export complet en JSON et YAML
- Inclut : intégrations, séquences, templates wallmount, règles trailers, préférences
- Les identifiants sensibles (API keys, tokens) sont exclus de l'export par défaut
- Sauvegarde/restauration complète avec assets (templates, images)
- Versionning des configurations pour rollback

### VII. Test-First & Quality
- Tests unitaires obligatoires pour chaque adaptateur de service
- Tests d'intégration pour les flux de séquences complets
- Mocking systématique des services externes (pas de dépendance réseau pour les tests)
- CI/CD avec validation automatique avant merge
- Coverage minimum : 80% sur le cœur métier (moteur de séquences)

### VIII. Self-Hosted & Docker Native
Theatarr est conçu pour le self-hosting exclusivement :
- Déploiement via Docker / docker-compose uniquement
- Compatible Unraid Community Apps template
- Aucune dépendance cloud obligatoire (TMDB/SoundCloud sont optionnels)
- Toutes les données restent locales
- Configuration via variables d'environnement et fichiers de config montés

## Architecture Constraints

### API Design
- API REST pour toutes les opérations CRUD
- WebSocket pour le contrôle temps réel des séquences (play, pause, skip, état)
- Toute action UI doit passer par l'API (pas de logique côté client)
- Endpoints documentés via OpenAPI/Swagger auto-généré

### Data Model
- **Session** : conteneur principal, contient N séquences ordonnées + film associé
- **Sequence** : bloc atomique d'orchestration (éclairage + audio + affichage + média +
  durée + actionneurs)
- **Service** : représentation d'un service externe connecté (type, config, état)
- **Template** : définition d'affichage wallmount (layout, animations, variables)
- **TrailerRule** : règle de téléchargement/gestion de bandes-annonces
- **VoteSession** : session de vote avec films candidats et votes reçus
- **ColorPalette** : palette extraite d'une affiche, liée à un film

### Node Editor (Mode Graphique)
L'éditeur visuel de séquences est un **mode alternatif** au mode linéaire :
- Chaque nœud représente une séquence ou une condition
- Les connexions définissent l'ordre et les branchements
- Support de conditions : timer expiré, action utilisateur, événement externe
- Le graphe est sérialisé en JSON et exécuté par le même moteur de séquences
- Conversion bidirectionnelle possible entre mode linéaire et graphique

### TMDB Integration
- Compte TMDB optionnel mais recommandé
- Cache local des métadonnées avec TTL configurable
- Données enrichies : synopsis, casting, notes, classification, affiches alternatives
- Source primaire pour les URLs de bandes-annonces
- Fallback gracieux si indisponible (fonctionnement dégradé avec données Plex/Jellyfin)

## Development Workflow

### Branching
- `main` : stable, déployable
- `develop` : intégration continue
- `feature/*` : fonctionnalités isolées
- `fix/*` : corrections
- Merge via PR avec review obligatoire

### Code Standards
- Linting et formatting automatiques (pré-commit hooks)
- Typage strict (TypeScript strict mode / Python type hints)
- Documentation inline obligatoire pour les interfaces publiques
- Changelog maintenu à chaque release

### Release Cycle
- Versioning SemVer : MAJOR.MINOR.PATCH
- Breaking changes uniquement en MAJOR
- Release notes générées automatiquement depuis les commits conventionnels
- Image Docker taguée à chaque release + `latest`

## Governance

Cette constitution est le document de référence pour toute décision technique et
architecturale concernant Theatarr. Elle prime sur les pratiques ad hoc et les préférences
individuelles.

- Toute modification architecturale doit être validée contre cette constitution
- Les amendements nécessitent : documentation de la motivation, revue, plan de migration
- Le moteur de séquences et le système d'adaptateurs sont les invariants fondamentaux
- La simplicité est privilégiée : pas de sur-ingénierie, YAGNI appliqué

**Version**: 1.0.0 | **Ratified**: 2026-02-05 | **Last Amended**: 2026-02-05
