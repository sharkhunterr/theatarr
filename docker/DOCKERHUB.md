# Theatarr - Home Cinema Orchestration System

[![GitHub](https://img.shields.io/github/v/tag/sharkhunterr/theatarr?label=version&color=blue)](https://github.com/sharkhunterr/theatarr/releases)
[![Docker Pulls](https://img.shields.io/docker/pulls/sharkhunterr/theatarr?color=2496ED)](https://hub.docker.com/r/sharkhunterr/theatarr)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/sharkhunterr/theatarr/blob/main/LICENSE)

**Home Cinema Orchestration System** — Orchestrate lighting, audio, and media for the ultimate movie experience. Connect smart home devices, manage trailers, run interactive votes, and control everything from a beautiful web interface.

---

## Quick Start

```yaml
services:
  theatarr:
    image: sharkhunterr/theatarr:latest
    ports:
      - "8080:8080"
    volumes:
      - theatarr-data:/data
    environment:
      - SECRET_KEY=your-secret-key-at-least-32-characters-long
      - TZ=Europe/Paris
    restart: unless-stopped

volumes:
  theatarr-data:
```

```bash
docker compose up -d
```

**Access**: http://localhost:8080

---

## Features

**Session Orchestration**
- Multi-sequence workflows with parallel action execution
- Lighting scenes, audio playback, media control, display overlays
- Real-time session control with live timeline

**Smart Home Integration**
- **Lighting**: Philips Hue, WLED, Home Assistant, Zigbee2MQTT, ESPHome
- **Media**: Plex, Jellyfin, Chromecast, Apple TV, Android TV
- **Metadata**: TMDB, Fanart.tv

**Interactive Features**
- Token-based movie voting with QR codes
- AI-powered quiz generation
- Wallmount display with 37+ templates

**Media Management**
- Automatic trailer discovery and download
- Pre-roll and sound library
- Movie enrichment with posters, backdrops, and logos

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | *(required)* | JWT signing key (min 32 chars) |
| `DATA_PATH` | `/data` | Persistent data directory |
| `THEATARR_PORT` | `8080` | Server port |
| `THEATARR_LOG_LEVEL` | `INFO` | Log level |
| `TZ` | `UTC` | Container timezone |

### Volumes

| Path | Content |
|------|---------|
| `/data/theatarr.db` | SQLite database |
| `/data/trailers/` | Downloaded trailers |
| `/data/sounds/` | Audio files |
| `/data/prerolls/` | Pre-roll videos |

---

## Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `v1.x.x` | Specific version |

```bash
docker pull sharkhunterr/theatarr:latest
```

---

## Update

```bash
docker compose pull
docker compose up -d
docker image prune -f
```

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Backend | Python 3.11, FastAPI, SQLAlchemy, Alembic |
| Frontend | React 18, Vite, TailwindCSS, React Query |
| Data | SQLite WAL, WebSocket |

**Platforms**: `linux/amd64`, `linux/arm64`

---

## Links

- [Documentation](https://github.com/sharkhunterr/theatarr#readme)
- [Report Issues](https://github.com/sharkhunterr/theatarr/issues)
- [Star on GitHub](https://github.com/sharkhunterr/theatarr)

---

## License

MIT License - [LICENSE](https://github.com/sharkhunterr/theatarr/blob/main/LICENSE)
