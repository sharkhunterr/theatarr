# Multi-stage Dockerfile for Theatarr (Backend + Frontend)
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
ARG THEATARR_PWA=true
ENV VITE_PWA=${THEATARR_PWA}
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.11-slim

LABEL maintainer="Theatarr"
LABEL description="Home Cinema Orchestration System"

ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.title="Theatarr" \
      org.opencontainers.image.description="Home Cinema Orchestration System" \
      org.opencontainers.image.source="https://github.com/sharkhunterr/theatarr"

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ffmpeg openssl gosu && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/pyproject.toml backend/README.md ./
COPY backend/src/ ./src/

RUN pip install --no-cache-dir .

# Copy alembic configuration
COPY backend/alembic.ini ./
COPY backend/src/alembic/ ./src/alembic/

# Copy built frontend as static files
COPY --from=frontend-build /app/frontend/dist ./static

# Create data directories (ownership set at runtime by entrypoint)
RUN mkdir -p /data/trailers /data/sounds /data/prerolls /data/certs

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Environment defaults
ENV THEATARR_PORT=8080 \
    THEATARR_LOG_LEVEL=INFO \
    DATA_PATH=/data \
    DATABASE_URL=sqlite+aiosqlite:////data/theatarr.db \
    TRAILER_PATH=/data/trailers \
    SOUND_PATH=/data/sounds \
    PREROLL_PATH=/data/prerolls \
    SECRET_KEY=change-me-in-production-at-least-32-chars \
    THEATARR_HTTPS=false \
    THEATARR_SSL_CERT=/data/certs/cert.pem \
    THEATARR_SSL_KEY=/data/certs/key.pem \
    PUID=1000 \
    PGID=1000 \
    TZ=UTC

EXPOSE 8080
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:${THEATARR_PORT}/health || curl -sf -k https://localhost:${THEATARR_PORT}/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
