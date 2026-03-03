# Theatarr Docker Deployment

**Home Cinema Orchestration System - Complete deployment guide**

This guide covers Docker deployment of Theatarr. For Docker Hub overview, see [DOCKERHUB.md](DOCKERHUB.md).

---

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Download docker-compose.yml
curl -o docker-compose.yml https://raw.githubusercontent.com/sharkhunterr/theatarr/main/docker/docker-compose.yml

# Start Theatarr
docker compose up -d

# View logs
docker compose logs -f theatarr
```

**Access**: http://localhost:8080

### Option 2: Docker Run

```bash
docker run -d \
  --name theatarr \
  -p 8080:8080 \
  -v theatarr-data:/data \
  -e TZ=Europe/Paris \
  -e SECRET_KEY=your-secret-key-at-least-32-characters-long \
  --restart unless-stopped \
  sharkhunterr/theatarr:latest
```

---

## What's in the Image

The unified Theatarr image includes:

| Component | Description | Port |
|-----------|-------------|------|
| **Web UI** | React frontend (served by FastAPI) | 8080 |
| **API** | FastAPI backend + orchestration engine | 8080 |
| **Database** | SQLite WAL mode + Alembic migrations | - |

**Platforms**: `linux/amd64`, `linux/arm64`

---

## Configuration

### Docker Compose Example

```yaml
services:
  theatarr:
    image: sharkhunterr/theatarr:latest
    container_name: theatarr
    hostname: theatarr
    ports:
      - "8080:8080"
    volumes:
      - theatarr-data:/data
    environment:
      - SECRET_KEY=your-secret-key-at-least-32-characters-long
      - THEATARR_LOG_LEVEL=INFO
      - TZ=Europe/Paris
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

volumes:
  theatarr-data:
    driver: local
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | *(required)* | JWT signing key (min 32 chars) |
| `DATA_PATH` | `/data` | Persistent data directory |
| `THEATARR_PORT` | `8080` | Server port |
| `THEATARR_LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `THEATARR_HTTPS` | `false` | Enable HTTPS with auto-generated cert |
| `TMDB_API_KEY` | *(optional)* | TMDB API key for movie metadata |
| `TZ` | `UTC` | Container timezone |
| `PUID` | `1000` | User ID for file permissions |
| `PGID` | `1000` | Group ID for file permissions |

---

## Volumes

| Path | Content |
|------|---------|
| `/data/theatarr.db` | SQLite database |
| `/data/trailers/` | Downloaded trailers |
| `/data/sounds/` | Audio files |
| `/data/prerolls/` | Pre-roll videos |
| `/data/certs/` | SSL certificates (HTTPS) |

---

## Backup & Restore

### Via Web UI

1. **Settings > Export** to download encrypted backup
2. Import on another instance via **Settings > Import**

### Via Volume

```bash
# Backup
docker run --rm \
  -v theatarr-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/theatarr-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm \
  -v theatarr-data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/theatarr-YYYYMMDD.tar.gz"
```

---

## Updates

```bash
# Pull latest image
docker compose pull

# Recreate container
docker compose up -d

# Clean old images
docker image prune -f
```

### Version Pinning

```yaml
services:
  theatarr:
    image: sharkhunterr/theatarr:v1.0.0  # Pin to specific version
```

---

## Troubleshooting

### Container Won't Start

Check logs: `docker compose logs theatarr`

Common issues:
- Port conflict: Change ports in compose file
- Permission: `chmod -R 755 ./data`
- Database locked: Stop all instances

### Services Can't Connect

**Mac/Windows**: Use `host.docker.internal` instead of `localhost`

**Linux**: Use your machine's IP (not `localhost`)

Test: `docker compose exec theatarr curl -I http://localhost:8080/health`

---

## Resources

- **Docker Hub**: https://hub.docker.com/r/sharkhunterr/theatarr
- **GitHub**: https://github.com/sharkhunterr/theatarr
