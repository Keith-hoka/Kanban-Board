# Scripts

Start/stop scripts for running the app as a single Docker container, plus the container entrypoint.

- `start.sh` / `stop.sh` - Mac/Linux. `start.sh` builds the image and runs it (`--name pm-app`), publishing container port 8000 to host `PORT` (default 8000); loads root `.env` if present; mounts the `pm-data` named volume at `/app/backend/data` so the SQLite database survives restarts; removes any existing `pm-app` first (idempotent). `stop.sh` stops the container.
- `start.ps1` / `stop.ps1` - Windows PowerShell equivalents.
- `docker-entrypoint.sh` - runs inside the container: starts `next start` on `127.0.0.1:3000` and uvicorn on `0.0.0.0:8000`, and tears both down when either exits. Not run directly on the host.

Usage:

```bash
./scripts/start.sh            # then open http://localhost:8000
PORT=9000 ./scripts/start.sh  # custom host port
./scripts/stop.sh
```
