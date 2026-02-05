# Quickstart: Theatarr Development

**Feature**: 001-cinema-orchestrator
**Date**: 2026-02-05

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (frontend dev)
- Python 3.11+ (backend dev)
- Git

## Quick Start (Docker)

```bash
# Clone repository
git clone https://github.com/your-org/theatarr.git
cd theatarr

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Access
# - Frontend: http://localhost:3000
# - API: http://localhost:8080
# - API Docs: http://localhost:8080/docs
```

## Development Setup

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows

# Install dependencies
pip install -e ".[dev]"

# Setup database
alembic upgrade head

# Create admin user
python -m theatarr.cli create-user --username admin --password admin

# Run development server
uvicorn theatarr.main:app --reload --port 8080
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Access: http://localhost:3000
```

### Running Tests

```bash
# Backend tests
cd backend
pytest                          # All tests
pytest tests/unit               # Unit tests only
pytest tests/integration        # Integration tests
pytest --cov=theatarr           # With coverage

# Frontend tests
cd frontend
npm run test                    # Unit tests
npm run test:e2e               # E2E tests (Playwright)
```

## Project Structure

```
theatarr/
├── backend/
│   ├── src/theatarr/          # Source code
│   ├── tests/                 # Tests
│   ├── alembic/               # Migrations
│   └── pyproject.toml
│
├── frontend/
│   ├── src/                   # Source code
│   ├── tests/                 # Tests
│   └── package.json
│
├── specs/                     # Feature specifications
├── docker-compose.yml
└── .env.example
```

## Environment Variables

```bash
# .env
# Database
DATABASE_URL=sqlite:///./data/theatarr.db

# Security
SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# TMDB (optional)
TMDB_API_KEY=your-tmdb-api-key

# Storage
DATA_PATH=/data
TRAILER_PATH=/data/trailers

# Server
HOST=0.0.0.0
PORT=8080
DEBUG=true
```

## First Steps

### 1. Add a Service

```bash
# Via API
curl -X POST http://localhost:8080/api/v1/services \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Living Room Hue",
    "adapter_type": "hue",
    "config": {
      "bridge_ip": "192.168.1.10",
      "api_key": "your-hue-api-key"
    }
  }'
```

### 2. Create a Session

```bash
curl -X POST http://localhost:8080/api/v1/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Movie Night"
  }'
```

### 3. Add Sequences

```bash
curl -X POST http://localhost:8080/api/v1/sessions/<session_id>/sequences \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome",
    "duration_type": "fixed",
    "duration_ms": 60000,
    "actions": [
      {
        "action_type": "lighting",
        "command": "set_color",
        "parameters": {
          "color": "#FF5500",
          "intensity": 50,
          "targets": ["group:living-room"]
        }
      }
    ]
  }'
```

### 4. Start Session

```bash
curl -X POST http://localhost:8080/api/v1/sessions/<session_id>/control \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "play"}'
```

## Development Guidelines

### Adding a New Adapter

1. Create adapter file: `backend/src/theatarr/adapters/<category>/<name>.py`
2. Implement `ServiceAdapter` interface
3. Register in `adapters/registry.py`
4. Add unit tests in `tests/unit/test_adapters/`
5. Document configuration schema

```python
# Example adapter structure
from theatarr.adapters.base import ServiceAdapter, Capability, Command, Result

class MyAdapter(ServiceAdapter):
    adapter_type = "my_adapter"
    category = "lighting"

    def get_capabilities(self) -> list[Capability]:
        return [
            Capability(name="set_color", parameters=["color", "intensity"]),
            Capability(name="set_effect", parameters=["effect", "speed"]),
        ]

    async def execute(self, command: Command) -> Result:
        # Implementation
        pass

    async def test_connection(self) -> ConnectionStatus:
        # Test connectivity
        pass
```

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Code Style

```bash
# Backend
ruff check .                    # Linting
ruff format .                   # Formatting
mypy src/theatarr              # Type checking

# Frontend
npm run lint                    # ESLint
npm run format                  # Prettier
npm run typecheck              # TypeScript
```

## Docker Development

```bash
# Build images
docker-compose build

# Run with logs
docker-compose up

# Run specific service
docker-compose up backend

# Execute command in container
docker-compose exec backend python -m pytest

# View logs
docker-compose logs -f backend
```

## Debugging

### Backend

```python
# Add to code for debugging
import debugpy
debugpy.listen(5678)
debugpy.wait_for_client()
```

VS Code launch.json:
```json
{
  "name": "Attach to Backend",
  "type": "python",
  "request": "attach",
  "connect": {"host": "localhost", "port": 5678}
}
```

### Frontend

Use React DevTools and browser debugger. Vite provides HMR for fast iteration.

## Useful Commands

```bash
# Generate OpenAPI client for frontend
cd frontend
npm run generate-api

# Reset database
cd backend
rm data/theatarr.db
alembic upgrade head

# Check adapter health
curl http://localhost:8080/api/v1/services/<id>/test

# Export configuration
curl http://localhost:8080/api/v1/config/export \
  -H "Authorization: Bearer <token>" \
  -o backup.json
```

## Troubleshooting

### Common Issues

**WebSocket connection fails**
- Check CORS settings in backend
- Verify token is valid
- Check firewall/proxy settings

**Service adapter timeout**
- Verify network connectivity to device
- Check device is powered on
- Verify credentials/API keys

**Database locked (SQLite)**
- Only one writer at a time
- Check for zombie processes
- Use connection pooling

---

*Voir [plan.md](./plan.md) pour l'architecture complète et [data-model.md](./data-model.md) pour le schéma de données.*
