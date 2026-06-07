#!/usr/bin/env bash
# Build and run the Kanban app container (Mac/Linux). Set PORT to override the host port.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image="pm-app"
port="${PORT:-8000}"

docker build -t "$image" "$root"

# Remove any existing container so re-running is idempotent.
docker rm -f pm-app >/dev/null 2>&1 || true

env_args=()
if [ -f "$root/.env" ]; then
  env_args+=(--env-file "$root/.env")
fi

docker run -d --rm --name pm-app -p "${port}:8000" \
  -v pm-data:/app/backend/data \
  "${env_args[@]+"${env_args[@]}"}" "$image"
echo "Kanban app running at http://localhost:${port}"
