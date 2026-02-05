# Theatarr

**Home Cinema Orchestration System**

Theatarr orchestrates lighting, audio, and media for the ultimate movie experience. Create automated cinema sessions that dim your lights, play trailers, and start your movie - all with a single click.

## Features

- **Session Orchestration**: Create multi-sequence sessions with automated transitions
- **Service Integration**: Connect Philips Hue, Home Assistant, Plex, Jellyfin, and more
- **Wallmount Display**: Public display page with movie info, countdown, and dynamic theming
- **Vote System**: Token-based voting for movie selection with real-time results
- **Trailer Management**: Auto-download trailers with quality and storage rules
- **Configuration Export/Import**: Backup and restore settings with encrypted secrets

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for frontend development)
- Python 3.11+ (for backend development)

### Running with Docker

```bash
# Clone the repository
git clone https://github.com/theatarr/theatarr.git
cd theatarr

# Copy environment file
cp .env.example .env

# Edit .env with your settings
# At minimum, set:
# - JWT_SECRET (generate with: openssl rand -base64 32)
# - DATABASE_URL (default: sqlite:///./theatarr.db)

# Start the application
docker-compose up -d

# Create your first user
docker-compose exec backend theatarr create-user
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### Development Setup

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or: .venv\Scripts\activate  # Windows

# Install dependencies
pip install -e ".[dev]"

# Run migrations
alembic upgrade head

# Create a user
python -m theatarr.cli create-user

# Start development server
uvicorn theatarr.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens | Required |
| `DATABASE_URL` | Database connection string | `sqlite:///./theatarr.db` |
| `DEBUG` | Enable debug mode | `false` |
| `TMDB_API_KEY` | TMDB API key for movie metadata | Optional |

### Supported Services

#### Lighting
- **Philips Hue**: Bridge IP, username required
- **Home Assistant**: URL, access token required
- **ESPHome**: Device IP, optional password

#### Media Servers
- **Plex**: Server URL, token required
- **Jellyfin**: Server URL, API key required

#### Players
- **Android TV**: Device IP, ADB required
- **Apple TV**: Device IP, pyatv pairing required
- **Chromecast**: Device name or IP

## Usage

### Creating a Session

1. Navigate to **Sessions** > **New Session**
2. Add sequences (e.g., "Pre-show", "Movie", "Credits")
3. Configure actions for each sequence:
   - Lighting: Set colors, brightness, transitions
   - Audio: Play ambient sounds, adjust volume
   - Media: Start playback, display content
4. Save and start your session

### Wallmount Display

Access `/wallmount` on any browser for a public display showing:
- Movie poster and information
- Countdown timer
- Dynamic color theming extracted from poster
- Real-time session status

### Vote Sessions

1. Navigate to **Votes** > **New Vote**
2. Add movies to the ballot
3. Share the vote link with guests
4. Guests vote without needing accounts
5. Winner is automatically selected when voting closes

## CLI Commands

```bash
# User management
theatarr create-user --username admin --email admin@example.com
theatarr reset-password --username admin
theatarr list-users
theatarr delete-user --username olduser

# Database
theatarr db-init
theatarr db-upgrade
theatarr db-downgrade

# Utilities
theatarr generate-secret
theatarr check
theatarr version
```

## API Documentation

When running in debug mode, API documentation is available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Architecture

```
theatarr/
├── backend/                 # Python/FastAPI backend
│   ├── src/theatarr/
│   │   ├── adapters/       # Service integrations
│   │   ├── api/            # REST endpoints
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── services/       # Business logic
│   └── tests/
├── frontend/               # React/TypeScript frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── stores/         # Zustand stores
│   │   └── api/            # API client
│   └── tests/
└── docker-compose.yml
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [React](https://reactjs.org/) - Frontend library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [React Query](https://tanstack.com/query) - Data fetching and caching
