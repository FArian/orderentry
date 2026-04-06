# Docker — z2Lab OrderEntry

Quick-start guide for running OrderEntry in Docker.

---

## Files

```
frontend/zetlab/
├── start.sh                          # Linux / macOS starter
├── start.bat                         # Windows starter
└── docker/
    ├── docker-compose.yml            # Base: prebuilt image + SQLite
    ├── docker-compose.build.yml      # Override: local build
    ├── docker-compose.sqlserver.yml  # Override: SQL Server
    ├── Dockerfile                    # Multi-stage build
    └── .env.example                  # Environment template
```

---

## Quickstart

### Linux / macOS

```bash
# Use prebuilt image (default)
./start.sh

# Force local build
./start.sh --build

# Docker Compose mode (recommended for production)
./start.sh --compose

# Compose + local build
./start.sh --compose --build

# Compose + SQL Server
./start.sh --sqlserver

# Stop
./start.sh --stop

# Follow logs
./start.sh --logs
```

### Windows

```bat
:: Use prebuilt image (default)
start.bat

:: Force local build
start.bat --build

:: Docker Compose mode (recommended for production)
start.bat --compose

:: Compose + local build
start.bat --compose --build

:: Compose + SQL Server
start.bat --sqlserver

:: Stop
start.bat --stop

:: Follow logs
start.bat --logs
```

---

## Environment Variables

Set before running (optional — all have defaults):

| Variable | Default | Purpose |
|---|---|---|
| `IMAGE` | `farian/orderentry:latest` | Docker image name |
| `PORT` | `3000` | Host port |
| `FHIR_URL` | `https://hapi.fhir.org/baseR4` | FHIR R4 server URL |
| `AUTH_SECRET` | `dev-only-change-in-production!!` | Session signing key |

### Linux / macOS

```bash
export IMAGE=farian/orderentry:v1.2.0
export PORT=8080
export FHIR_URL=http://your-hapi:8080/fhir
export AUTH_SECRET=$(openssl rand -hex 32)
./start.sh --compose
```

### Windows

```bat
set IMAGE=farian/orderentry:v1.2.0
set PORT=8080
set FHIR_URL=http://your-hapi:8080/fhir
set AUTH_SECRET=your-secret-here
start.bat --compose
```

---

## Docker Compose Modes

### Image mode (default)

Uses prebuilt image from Docker Hub. No build step.

```bash
docker compose -f docker/docker-compose.yml up -d
```

### Build mode

Builds image locally. Pass `NEXT_PUBLIC_*` build args here.

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.build.yml \
  up -d --build
```

### SQL Server mode

Starts SQL Server 2022 alongside OrderEntry. Requires `MSSQL_SA_PASSWORD`.

```bash
# Create docker/.env with:
# MSSQL_SA_PASSWORD=YourStrong!Password

docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.sqlserver.yml \
  up -d
```

First start only — run migrations after SQL Server is healthy (~30s):

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.sqlserver.yml \
  run --rm orderentry npx prisma migrate deploy
```

---

## After Starting

| Item | Value |
|---|---|
| URL | `http://localhost:3000` (or `PORT`) |
| Default login | `admin` / `Admin1234!` |
| Health check | `http://localhost:3000/api/health/db` |
| API docs | `http://localhost:3000/api/docs` |

**Change the admin password immediately after first login.**

---

## Data & Logs

Standalone mode (`docker run`) mounts local directories:

```
./data/orderentry.db   → /app/data/orderentry.db  (SQLite database)
./logs/zetlab.log      → /app/logs/zetlab.log      (structured log file)
```

Compose mode uses named Docker volumes (`orderentry-data`, `orderentry-logs`).

---

## Building for Production

Multi-arch build (AMD64 + ARM64) and push to Docker Hub:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --build-arg GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) \
  --build-arg GIT_COUNT=$(git rev-list --count HEAD) \
  --build-arg NEXT_PUBLIC_LAB_ORG_ID=7601009336904 \
  --build-arg NEXT_PUBLIC_LAB_NAME="ZLZ Zentrallabor AG" \
  -t farian/orderentry:latest \
  --push \
  -f docker/Dockerfile \
  .
```

`NEXT_PUBLIC_*` variables are **baked into the client bundle at build time** and cannot be changed via runtime environment variables in the browser.

---

## SQL Server — docker/.env Example

```env
MSSQL_SA_PASSWORD=YourStrong!Password
ORDERENTRY_DB_PASSWORD=OrderEntry1!
AUTH_SECRET=change-me-min-32-chars
FHIR_BASE_URL=https://hapi.fhir.org/baseR4
```
