# Research: Theatarr Technical Decisions

**Feature**: 001-cinema-orchestrator
**Date**: 2026-02-05

## 1. Backend Framework

**Decision**: FastAPI (Python 3.11+)

**Rationale**:
- Support natif async pour WebSocket et appels concurrents aux services externes
- Génération automatique OpenAPI/Swagger (constitution requirement)
- Écosystème Python riche pour les intégrations domotiques (phue, pyatv, plexapi, etc.)
- Cohérent avec l'écosystème *arr (majoritairement Python/C#)
- Type hints + Pydantic = validation robuste des données

**Alternatives considérées**:
- **Node.js/Express**: Bon pour temps réel mais écosystème domotique Python plus mature
- **Go**: Performant mais bibliothèques domotiques limitées, courbe d'apprentissage
- **C#/.NET**: Cohérent *arr mais overhead pour un projet de cette taille

## 2. Frontend Framework

**Decision**: React 18 + TypeScript + Vite

**Rationale**:
- React Flow (node editor) est une bibliothèque React mature et bien maintenue
- Écosystème large pour composants UI (drag & drop, animations)
- TypeScript pour la sécurité de type avec les schémas API
- Vite pour builds rapides et HMR

**Alternatives considérées**:
- **Vue 3**: Viable mais React Flow n'a pas d'équivalent aussi mature
- **Svelte**: Moins de bibliothèques pour node editors complexes
- **Vanilla JS**: Trop de code boilerplate pour l'UI admin

## 3. Base de données

**Decision**: SQLite avec SQLAlchemy

**Rationale**:
- Portable (fichier unique, backup trivial)
- Cohérent avec l'écosystème *arr (Sonarr, Radarr utilisent SQLite)
- Suffisant pour le volume de données (centaines d'entités, pas millions)
- Pas besoin de serveur séparé (self-hosted simplicity)
- SQLAlchemy permet de migrer vers PostgreSQL si besoin futur

**Alternatives considérées**:
- **PostgreSQL**: Overkill pour usage single-user, complexifie le déploiement
- **MongoDB**: Pas de schéma strict = risque de drift, moins adapté aux relations
- **Redis**: Bon pour cache mais pas pour persistence primaire

## 4. Communication temps réel

**Decision**: WebSocket natif (FastAPI + starlette)

**Rationale**:
- Requis pour: contrôle session (play/pause/skip), mise à jour wallmount, résultats vote
- FastAPI/Starlette ont un support WebSocket natif robuste
- Pas besoin de Socket.io (overhead pour des besoins simples)
- Pattern pub/sub simple avec channels par session

**Alternatives considérées**:
- **Server-Sent Events**: Unidirectionnel, insuffisant pour contrôle session
- **Socket.io**: Overhead, dépendance supplémentaire
- **Polling**: Latence inacceptable (<200ms requis)

## 5. Node Editor (Mode Graphique)

**Decision**: React Flow

**Rationale**:
- Bibliothèque mature (>15k stars GitHub, maintenue activement)
- Customisation complète des nœuds et edges
- Sérialisation/désérialisation JSON native
- Bonne documentation et exemples

**Alternatives considérées**:
- **rete.js**: Moins maintenu, API moins intuitive
- **Custom canvas**: 3-6 mois de développement vs 2-3 semaines avec React Flow
- **Blockly**: Orienté code blocks, pas adapté pour flux séquentiels

## 6. Extraction de palette de couleurs

**Decision**: Vibrant.js (frontend) + Pillow/colorthief (backend fallback)

**Rationale**:
- Vibrant.js est le standard pour extraction palette web
- Extraction côté frontend pour wallmount (évite aller-retour serveur)
- Backend fallback avec Pillow pour pré-calcul et cache
- Résultat: 5-6 couleurs (dominant, vibrant, muted, dark, light)

**Alternatives considérées**:
- **k-means custom**: Réinventer la roue, plus lent
- **ColorThief uniquement**: Moins de nuances que Vibrant.js
- **Service externe**: Contre constitution (no cloud dependency)

## 7. Téléchargement trailers

**Decision**: yt-dlp (via subprocess)

**Rationale**:
- Standard de facto pour téléchargement YouTube
- Maintenu activement, gère les changements YouTube
- Support qualité (720p/1080p/4K), formats, sous-titres
- Exécution async via subprocess pour ne pas bloquer

**Alternatives considérées**:
- **pytube**: Moins maintenu, casse fréquemment
- **youtube-dl**: Abandonné, remplacé par yt-dlp
- **API YouTube officielle**: Pas de téléchargement direct autorisé

## 8. Adaptateurs services externes

**Decision**: Pattern Adapter avec interface abstraite + registry

**Rationale**:
- Constitution exige: indépendance, testabilité, hot-swap
- Interface `ServiceAdapter` définit le contrat (capabilities, execute, test)
- Registry gère découverte et instanciation dynamique
- Chaque adapter est un module autonome importé dynamiquement

**Pattern retenu**:
```python
class ServiceAdapter(ABC):
    @abstractmethod
    def get_capabilities(self) -> list[Capability]

    @abstractmethod
    async def execute(self, command: Command) -> Result

    @abstractmethod
    async def test_connection(self) -> ConnectionStatus
```

## 9. Authentification admin

**Decision**: JWT avec credentials locaux (bcrypt)

**Rationale**:
- Cohérent écosystème *arr (login local)
- JWT pour sessions stateless (pas de session store)
- bcrypt pour hash passwords (standard sécurisé)
- Refresh token avec rotation pour sécurité

**Alternatives considérées**:
- **OAuth/OIDC**: Overhead, dépendance externe potentielle
- **API keys**: Moins adapté pour UI web (pas de refresh)
- **Session cookies**: Nécessite store côté serveur

## 10. Tokens publics (vote)

**Decision**: UUID v4 + expiration en base + HMAC signature

**Rationale**:
- UUID non devinable, unique
- Expiration stockée en DB (configurable par l'admin)
- HMAC signature pour détecter tampering sans DB lookup
- Stateless validation possible

---

## Dépendances clés identifiées

### Backend (Python)
- `fastapi` - Framework API
- `uvicorn` - ASGI server
- `sqlalchemy` - ORM
- `alembic` - Migrations
- `pydantic` - Validation
- `python-jose` - JWT
- `bcrypt` - Password hashing
- `httpx` - HTTP client async
- `websockets` - WebSocket support
- `phue` - Philips Hue
- `pyatv` - Apple TV
- `plexapi` - Plex
- `aiohttp` - Async HTTP (Jellyfin, HA)
- `Pillow` - Image processing
- `colorthief` - Palette extraction backend

### Frontend (TypeScript)
- `react` - UI framework
- `react-router-dom` - Routing
- `@xyflow/react` - Node editor (React Flow v12)
- `@tanstack/react-query` - Data fetching
- `zustand` - State management
- `node-vibrant` - Palette extraction
- `dnd-kit` - Drag & drop (linear editor)
- `tailwindcss` - Styling

---

*Toutes les décisions alignées avec la constitution. Aucun NEEDS CLARIFICATION restant.*
