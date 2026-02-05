# Theatarr Backend Dockerfile
# Multi-stage build for smaller production image

# Build stage
FROM python:3.11-slim as builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY pyproject.toml ./
COPY src/ ./src/

# Build wheel
RUN pip install --no-cache-dir build && \
    python -m build --wheel

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --create-home --shell /bin/bash theatarr

# Copy wheel and install
COPY --from=builder /build/dist/*.whl /tmp/
RUN pip install --no-cache-dir /tmp/*.whl && rm /tmp/*.whl

# Copy alembic configuration
COPY src/alembic/ /app/alembic/
COPY alembic.ini /app/

# Create data directory
RUN mkdir -p /data/trailers && chown -R theatarr:theatarr /data

# Switch to non-root user
USER theatarr

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DATA_PATH=/data \
    TRAILER_PATH=/data/trailers

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run migrations and start server
CMD ["sh", "-c", "alembic upgrade head && uvicorn theatarr.main:app --host 0.0.0.0 --port 8080"]
