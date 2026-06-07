# Build and run the Kanban app container (Windows). Set $env:PORT to override the host port.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$image = "pm-app"
$port = if ($env:PORT) { $env:PORT } else { "8000" }

docker build -t $image $root

# Remove any existing container so re-running is idempotent.
docker rm -f pm-app 2>$null | Out-Null

$envArgs = @()
if (Test-Path "$root/.env") { $envArgs = @("--env-file", "$root/.env") }

docker run -d --rm --name pm-app -p "${port}:8000" -v pm-data:/app/backend/data @envArgs $image
Write-Host "Kanban app running at http://localhost:$port"
