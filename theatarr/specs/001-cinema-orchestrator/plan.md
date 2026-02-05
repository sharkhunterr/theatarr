# Implementation Plan: Theatarr - Home Cinema Orchestration System

**Branch**: `001-cinema-orchestrator` | **Date**: 2026-02-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-cinema-orchestrator/spec.md`

## Summary

Theatarr est un orchestrateur de sessions cinéma maison qui automatise l'éclairage, le son d'ambiance, l'affichage et la lecture média. Le cœur est un **moteur de séquences** exécutant des sessions composées de séquences ordonnées. L'architecture repose sur un système d'**adaptateurs modulaires** pour intégrer les services externes (Hue, Plex, Android TV, etc.) sans coupler le cœur applicatif.

**Approche technique**: Application web full-stack avec backend Python (FastAPI) + frontend React/TypeScript. Base SQLite pour la portabilité. WebSocket pour le temps réel. Architecture hexagonale avec adaptateurs plug-and-play.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy, React 18, React Flow (node editor), Vibrant.js (palette extraction)
**Storage**: SQLite (portable, cohérent écosystème *arr) + fichiers locaux (trailers, templates)
**Testing**: pytest (backend), Vitest (frontend), Playwright (E2E)
**Target Platform**: Linux server (Docker), compatible Unraid/NAS
**Project Type**: Web application (backend + frontend)
**Performance Goals**: <200ms transition sequences, 5 wallmounts simultanés, 100ms commande→service
**Constraints**: Offline-first (cloud optionnel), single admin, Docker-only deployment
**Scale/Scope**: 1 instance par foyer, ~10 sessions, ~50 séquences, ~100 trailers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Statut | Validation |
|----------|--------|------------|
| I. Modular Integration Architecture | ✅ PASS | Architecture adaptateurs avec interface `ServiceAdapter` standardisée |
| II. Sequence Engine First | ✅ PASS | Moteur de séquences au cœur, Session/Sequence comme entités principales |
| III. Display & Wallmount System | ✅ PASS | Templates JSON/YAML, extraction palette, page `/wallmount` publique |
| IV. Voting & User Access | ✅ PASS | Tokens temporaires, accès sans compte, wallmount public configurable |
| V. Trailer Management | ✅ PASS | Règles configurables, rotation automatique, sélection contextuelle |
| VI. Configuration Sovereignty | ✅ PASS | Export JSON/YAML, exclusion secrets, import avec merge |
| VII. Test-First & Quality | ✅ PASS | pytest + Vitest + Playwright, mocking adapters, 80% coverage cœur |
| VIII. Self-Hosted & Docker Native | ✅ PASS | Docker-compose only, variables env, aucun cloud obligatoire |

**Architecture Constraints**:
- ✅ API REST pour CRUD + WebSocket temps réel
- ✅ Logique 100% backend (UI via API)
- ✅ OpenAPI auto-généré (FastAPI)

## Project Structure

### Documentation (this feature)

```text
specs/001-cinema-orchestrator/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── theatarr/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entry
│   │   ├── config.py               # Settings & env vars
│   │   ├── database.py             # SQLAlchemy setup
│   │   │
│   │   ├── models/                 # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── session.py
│   │   │   ├── sequence.py
│   │   │   ├── service.py
│   │   │   ├── template.py
│   │   │   ├── vote.py
│   │   │   ├── trailer.py
│   │   │   └── movie.py
│   │   │
│   │   ├── schemas/                # Pydantic schemas (API)
│   │   │   ├── __init__.py
│   │   │   ├── session.py
│   │   │   ├── sequence.py
│   │   │   └── ...
│   │   │
│   │   ├── api/                    # FastAPI routers
│   │   │   ├── __init__.py
│   │   │   ├── sessions.py
│   │   │   ├── sequences.py
│   │   │   ├── services.py
│   │   │   ├── wallmount.py
│   │   │   ├── vote.py
│   │   │   ├── trailers.py
│   │   │   ├── config.py
│   │   │   └── ws.py               # WebSocket handlers
│   │   │
│   │   ├── services/               # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── engine.py           # Sequence execution engine
│   │   │   ├── scheduler.py        # Session scheduling
│   │   │   ├── palette.py          # Color extraction
│   │   │   ├── trailer_manager.py
│   │   │   └── config_manager.py   # Import/export
│   │   │
│   │   └── adapters/               # Service adapters (Constitution I)
│   │       ├── __init__.py
│   │       ├── base.py             # ServiceAdapter interface
│   │       ├── registry.py         # Adapter discovery & management
│   │       │
│   │       ├── lighting/
│   │       │   ├── __init__.py
│   │       │   ├── hue.py          # Philips Hue adapter
│   │       │   ├── homeassistant.py
│   │       │   ├── esphome.py
│   │       │   ├── govee.py
│   │       │   └── zigbee2mqtt.py
│   │       │
│   │       ├── players/
│   │       │   ├── __init__.py
│   │       │   ├── androidtv.py    # ADB-based
│   │       │   ├── appletv.py      # pyatv
│   │       │   └── chromecast.py   # pychromecast
│   │       │
│   │       ├── media/
│   │       │   ├── __init__.py
│   │       │   ├── plex.py
│   │       │   └── jellyfin.py
│   │       │
│   │       └── metadata/
│   │           ├── __init__.py
│   │           └── tmdb.py
│   │
│   └── alembic/                    # Database migrations
│       └── versions/
│
├── tests/
│   ├── unit/
│   │   ├── test_engine.py
│   │   ├── test_adapters/
│   │   └── ...
│   ├── integration/
│   │   ├── test_session_flow.py
│   │   └── ...
│   └── conftest.py                 # Fixtures, mocked adapters
│
├── pyproject.toml
├── Dockerfile
└── requirements.txt

frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/                        # API client (generated from OpenAPI)
│   │   └── client.ts
│   │
│   ├── components/
│   │   ├── common/
│   │   ├── sessions/
│   │   │   ├── SessionList.tsx
│   │   │   ├── SessionEditor.tsx
│   │   │   └── SequenceEditor.tsx
│   │   ├── sequences/
│   │   │   ├── LinearEditor.tsx    # Drag & drop mode
│   │   │   └── NodeEditor.tsx      # React Flow mode
│   │   ├── services/
│   │   ├── wallmount/
│   │   │   ├── WallmountPage.tsx
│   │   │   └── templates/
│   │   ├── vote/
│   │   │   └── VotePage.tsx
│   │   └── admin/
│   │       ├── Dashboard.tsx
│   │       ├── ServicesConfig.tsx
│   │       └── TrailersManager.tsx
│   │
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useSession.ts
│   │   └── ...
│   │
│   ├── stores/                     # Zustand or similar
│   │   └── sessionStore.ts
│   │
│   └── styles/
│
├── tests/
│   └── ...
│
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── Dockerfile

# Root level
docker-compose.yml
.env.example
README.md
```

**Structure Decision**: Architecture web application avec séparation backend/frontend. Le backend expose l'API REST + WebSocket, le frontend est une SPA React servie statiquement. Conforme à la constitution (toute logique passe par l'API).

## Complexity Tracking

> Aucune violation de la constitution détectée. Architecture alignée.

| Item | Justification |
|------|---------------|
| Séparation backend/frontend | Requis pour: (1) API consommable par wallmount standalone, (2) génération OpenAPI, (3) testabilité indépendante |
| React Flow pour node editor | Alternative (custom canvas) rejetée car React Flow est mature, maintenu, et réduit le temps de dev de ~80% |

---

*Plan généré. Voir research.md, data-model.md, contracts/, quickstart.md pour les détails techniques.*
