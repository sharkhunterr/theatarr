# CLAUDE.md

## Git

- Ne jamais ajouter de ligne "Co-Authored-By" dans les messages de commit.
- Ne jamais mentionner Claude Code, Claude, ou Anthropic dans les messages de commit.
- Ne jamais créer de commit sauf si l'utilisateur le demande explicitement.

## Structure du projet

- Backend : `backend/` (FastAPI + SQLAlchemy + Alembic, SQLite)
- Frontend : `frontend/` (React + Vite + TailwindCSS + React Query)
- Data : `data/theatarr.db` (base SQLite)
- Backend venv : `backend/venv/` (PAS `.venv`)
- Alembic : lancer depuis `backend/` (ou se trouve `alembic.ini`), PAS depuis `src/`

## Login admin

- Username : `admin`
- Mot de passe : `adminadmin`

## Commandes de demarrage

### Backend (port 2273, accessible reseau local)

```bash
cd /home/jeremie/Documents/Developpement/theatarr/backend && \
source venv/bin/activate && \
python -m uvicorn theatarr.main:app --host 0.0.0.0 --port 2273 --reload --app-dir src
```

IMPORTANT : lancer depuis `backend/` (pas `src/`) car le `.env` est dans ce dossier.

### Frontend (port 2173, accessible reseau local)

```bash
cd /home/jeremie/Documents/Developpement/theatarr/frontend && \
npm run dev -- --host 0.0.0.0 --port 2173
```

### Migrations Alembic

```bash
cd /home/jeremie/Documents/Developpement/theatarr/backend && \
source venv/bin/activate && \
alembic upgrade head
```

## API (base URL : http://localhost:2273/api/v1)

### Authentification

```bash
# Obtenir un token
TOKEN=$(curl -s -X POST http://localhost:2273/api/v1/auth/login \
  -d "username=admin&password=adminadmin" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Utiliser dans les requetes
curl -s http://localhost:2273/api/v1/... -H "Authorization: Bearer $TOKEN"
```

### Endpoints principaux

| Categorie | Prefix | Exemples |
|-----------|--------|----------|
| Auth | `/auth` | `POST /login`, `GET /me` |
| Sessions | `/sessions` | CRUD + `/control`, `/participants`, `/reveal-mystery`, `/resolve-vote` |
| Votes | `/vote-sessions` | CRUD + `/open`, `/close`, `/results`, `/tokens`, `/participants` |
| Vote public | `/vote/{token}` | `GET` (infos) + `POST` (voter) |
| Movies | `/movies` | `/search`, `/details/{source}/{id}`, `/enrichment-status`, `/{id}/enrich` |
| Templates | `/templates` | CRUD + `/{id}/activate`, `/init-builtins` |
| Wallmount | `/wallmount` | `/state`, `/templates/active` (public) |
| Services | `/services` | CRUD + `/adapters`, `/{id}/test`, `/{id}/capabilities` |
| Users | `/users` | CRUD (admin) |
| Config | `/config` | `/settings`, `/export`, `/import` |
| Portal | `/portal` | `/sessions`, `/votes`, `/stats`, `/me` |
| Trailers | `/trailers` | CRUD + `/download`, `/rules`, `/stats` |
| Logs | `/logs` | `/system`, `/sessions/history`, `/activity/recent` |
| Health | | `GET /health`, `GET /api/v1/info` (public) |
| WebSocket | `/ws` | `?token=`, `?wallmount=true`, `?vote_token=` |

### Logs systeme (debug scheduler, etc.)

```bash
curl -s "http://localhost:2273/api/v1/logs/system?limit=30" -H "Authorization: Bearer $TOKEN"
# Filtres : ?level=ERROR&category=scheduler&search=vote
```

## Conventions techniques

- Langue par defaut : francais (`fr-FR` pour TMDB, `fr` pour Fanart)
- DB : datetimes naives locales pour sessions, `DateTime(timezone=True)` pour votes `opens_at`/`closes_at`
- Scheduler : utiliser `datetime.now()` (naif local), PAS `datetime.now(timezone.utc)`
- Frontend envoie les dates via `new Date(value).toISOString()` (UTC) — `_parse_dt()` cote backend convertit
- Async SQLAlchemy : le lazy loading echoue → utiliser `selectinload()` pour les relations dans le scheduler
- API routes : les routes specifiques AVANT les routes `/{param}` catch-all
