#!/usr/bin/env bash
# Starts the Next.js server and the FastAPI backend in one container.
# FastAPI (port 8000) is the entrypoint and proxies non-/api paths to Next (port 3000).
set -euo pipefail

cd /app/frontend
HOSTNAME=127.0.0.1 PORT=3000 node server.js &
next_pid=$!

cd /app/backend
uv run --no-dev uvicorn app.main:app --host 0.0.0.0 --port 8000 &
api_pid=$!

terminate() {
  kill "$next_pid" "$api_pid" 2>/dev/null || true
}
trap terminate TERM INT

# Exit (and tear down the other process) as soon as either one stops.
wait -n
terminate
