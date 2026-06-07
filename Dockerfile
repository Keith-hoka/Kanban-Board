# Stage 1: build the Next.js frontend.
FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: runtime running both the Next.js server and the FastAPI backend.
FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Backend dependencies (use the container's system Python, matching requires-python).
ENV UV_PYTHON_PREFERENCE=only-system
COPY backend/pyproject.toml backend/uv.lock ./backend/
RUN cd backend && uv sync --no-dev --frozen
COPY backend/ ./backend/

# Built frontend (includes node_modules needed by `next start`).
COPY --from=frontend-build /app/frontend ./frontend

COPY scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENV NEXT_INTERNAL_URL=http://127.0.0.1:3000
# SQLite lives here; mount a volume at /app/backend/data to persist across runs.
ENV DATABASE_PATH=/app/backend/data/kanban.db
EXPOSE 8000
CMD ["bash", "docker-entrypoint.sh"]
