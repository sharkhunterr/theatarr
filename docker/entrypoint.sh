#!/bin/sh
# Theatarr Docker entrypoint
# Runs as root to fix permissions, then drops to PUID:PGID via gosu

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
PORT="${THEATARR_PORT:-8080}"
DATA_DIR="${DATA_PATH:-/data}"

# ---- Create data directories and fix ownership (runs as root) ----
echo "Theatarr: Setting up data directories (PUID=${PUID}, PGID=${PGID})..."
for dir in trailers sounds prerolls certs; do
  mkdir -p "${DATA_DIR}/${dir}"
done
chown -R "${PUID}:${PGID}" "${DATA_DIR}"

# ---- Run database migrations ----
echo "Theatarr: Running database migrations..."
alembic upgrade head

# ---- HTTPS: generate self-signed certificate if needed (as root) ----
if [ "${THEATARR_HTTPS}" = "true" ]; then
  SSL_CERT="${THEATARR_SSL_CERT:-${DATA_DIR}/certs/cert.pem}"
  SSL_KEY="${THEATARR_SSL_KEY:-${DATA_DIR}/certs/key.pem}"

  if [ ! -f "$SSL_CERT" ] || [ ! -f "$SSL_KEY" ]; then
    echo "Theatarr: No SSL certificates found, generating self-signed certificate..."
    mkdir -p "$(dirname "$SSL_CERT")" "$(dirname "$SSL_KEY")"
    if openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout "$SSL_KEY" \
      -out "$SSL_CERT" \
      -days 365 \
      -subj "/CN=theatarr/O=Theatarr Self-Signed"; then
      echo "Theatarr: Self-signed certificate generated (valid 365 days)"
      chown "${PUID}:${PGID}" "$SSL_CERT" "$SSL_KEY"
    else
      echo "Theatarr: ERROR - Failed to generate certificate, falling back to HTTP"
      THEATARR_HTTPS=false
    fi
  fi
fi

# ---- Build uvicorn command ----
CMD="uvicorn theatarr.main:app --host 0.0.0.0 --port ${PORT}"

if [ "${THEATARR_HTTPS}" = "true" ]; then
  echo "Theatarr: HTTPS enabled on port ${PORT}"
  CMD="${CMD} --ssl-certfile=${SSL_CERT} --ssl-keyfile=${SSL_KEY}"
else
  echo "Theatarr: HTTP on port ${PORT}"
fi

# ---- Drop privileges and exec ----
exec gosu "${PUID}:${PGID}" $CMD
