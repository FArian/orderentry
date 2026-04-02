# ZetLab OrderEntry

Laboratory order entry system for ZLZ Zentrallabor AG.  
Clinicians search patients, browse the lab test catalog, and submit diagnostic orders (FHIR ServiceRequests).

---

## Architecture

Clean Architecture with strict layer separation:

```
domain          Pure business rules — entities, value objects, use cases
application     Orchestration — repository interfaces, services, strategies
infrastructure  FHIR adapters, HTTP clients, config, logging
presentation    React hooks, feature components, design system
app             Next.js App Router — thin route handlers and page wrappers
shared          Framework-agnostic utilities (formatDate, base64, AppConfig)
```

**Layer rules:**
- `domain` has zero external dependencies.
- `application` depends only on `domain`.
- `infrastructure` depends on `domain` and `application`; may use Node.js APIs.
- `presentation` depends on `application`/`domain` through `ServiceFactory`; no direct FHIR calls.
- `shared` is imported by every layer; never reads `process.env` (client-safe only).

---

## Features

| Area | Description |
|---|---|
| Patient search | Paginated patient list with name search and active/inactive filter |
| Order entry | Browse FHIR lab catalog, select analyses, submit `ServiceRequest` |
| Orders list | View, edit, and delete (hard or soft) all `ServiceRequest` resources |
| Results | View `DiagnosticReport` list with PDF/HL7 preview |
| Logging | Structured JSON logs in terminal (server) and browser console (client) |
| Settings | Runtime log-level control via `/settings` page |
| API | OpenAPI 3.0 spec at `/api/openapi.json`; Swagger UI at `/api/docs` |
| Auth | HMAC-SHA256 session cookies; optional browser-only localStorage fallback |

---

## Local Installation

### Prerequisites
- Node.js 20.x (`nvm use` if `.nvmrc` is present)
- A running HAPI FHIR R4 server (see Docker section below)

### Setup

```bash
cd frontend/zetlab
npm install
```

Create `.env.local`:

```env
FHIR_BASE_URL=http://localhost:8080/fhir
AUTH_SECRET=change-me-in-production-min-32-chars
LOG_LEVEL=debug
LOG_FILE=./logs/zetlab.log
NEXT_PUBLIC_GLN_ENABLED=false
NEXT_PUBLIC_SASIS_ENABLED=false
```

### Start development server

```bash
npm run dev
```

App is available at `http://localhost:3000`.  
Server logs appear in the **terminal**. Browser logs appear in **DevTools → Console**.

### Other commands

```bash
npm run build          # Production build
npm run start          # Start production server
npm run lint           # ESLint
npx tsc --noEmit       # Type-check
npm test               # Run all tests (Vitest)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

---

## Docker Setup

The full stack (Traefik, HAPI FHIR, OIE Juno/Orchestra, OrderEntry) runs via Docker Compose.

### Quick start

```bash
cd backend/docker
cp .env .env.local       # Edit secrets and domains
docker compose up --build -d
```

### Build the OrderEntry image only

```bash
cd frontend/zetlab
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --build-arg GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) \
  --build-arg GIT_COUNT=$(git rev-list --count HEAD) \
  -t farian/orderentry:latest \
  --push \
  .
```

### Log files in Docker

Logs are written to `/app/logs/zetlab.log` inside the container and mounted to `./logs/` on the host:

```bash
tail -f backend/docker/logs/zetlab.log
```

---

## Environment Variables

### Frontend / OrderEntry container

| Variable | Side | Default | Description |
|---|---|---|---|
| `FHIR_BASE_URL` | Server | `http://localhost:8080/fhir` | HAPI FHIR R4 base URL |
| `AUTH_SECRET` | Server | `dev-secret-change-me` | HMAC-SHA256 session signing key (>=32 chars in production) |
| `ALLOW_LOCAL_AUTH` | Server | `false` | Allow unsigned `localSession` cookie |
| `LOG_LEVEL` | Server | `info` | `debug` / `info` / `warn` / `error` / `silent` |
| `LOG_FILE` | Server | _(empty)_ | Absolute path to log file; empty = disabled |
| `SASIS_API_BASE` | Server | _(empty)_ | SASIS insurance card lookup API |
| `GLN_API_BASE` | Server | Orchestra URL | GLN registry lookup API |
| `NEXT_PUBLIC_APP_VERSION` | Client | _(build-time)_ | Auto-generated from git metadata |
| `NEXT_PUBLIC_FORCE_LOCAL_AUTH` | Client | `false` | Force browser-only auth |
| `NEXT_PUBLIC_SASIS_ENABLED` | Client | `false` | Show SASIS/VeKa card lookup UI |
| `NEXT_PUBLIC_GLN_ENABLED` | Client | `false` | Show GLN lookup UI |

---

## Testing

Tests use **Vitest** with React Testing Library.

```bash
cd frontend/zetlab
npm test                 # Run all tests once
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage with thresholds
```

Coverage thresholds: branches 70%, functions/lines/statements 80%.

Test structure:

```
tests/
├── unit/domain/         # Entities, value objects, use cases
├── unit/application/    # Strategies
├── integration/         # Mapper + controller tests (real objects, mock fetch)
└── mocks/               # In-memory repository implementations
```

---

## API Usage

| Endpoint | Description |
|---|---|
| `GET /api/docs` | Swagger UI (interactive) |
| `GET /api/openapi.json` | OpenAPI 3.0 spec (machine-readable) |
| `GET /api/patients` | Patient search (`q`, `page`, `pageSize`, `showInactive`) |
| `GET /api/service-requests` | All orders (ServiceRequests) |
| `DELETE /api/service-requests/{id}` | Hard delete; falls back to `entered-in-error` on 409 |
| `GET /api/diagnostic-reports` | Results (`patientId`, `patientName`, `orderNumber`, `status`, `page`) |
| `GET /api/settings` | Non-sensitive server config (read-only) |

All routes are documented in `src/infrastructure/api/openapi.ts`.

---

## Logging

### Server logs (terminal)

Structured JSON, one line per event:

```json
{"time":"2026-04-02T10:00:00.000Z","level":"info","ctx":"PatientsController","msg":"Patients fetched","count":5,"total":42}
```

Control with `LOG_LEVEL` env var. File output enabled with `LOG_FILE`.

### API request logging (middleware)

Every `GET/POST/DELETE /api/*` call is logged to the terminal by `src/middleware.ts`:

```json
{"time":"…","level":"info","ctx":"Middleware","msg":"GET /api/patients","search":"?q=Muster&page=1"}
```

### Browser logs (DevTools Console)

Controlled from the **Settings page** (`/settings`).  
Uses `createClientLogger(ctx)` from `src/shared/utils/clientLogger.ts`.  
Log level is persisted to `localStorage` and applied immediately without a page reload.

---

## Settings Page

Navigate to `/settings` (link in the header) to:

- Change the **browser log level** (debug / info / warn / error / silent) — persisted to `localStorage`
- View current **server config** (log level, file logging status, FHIR URL) — read-only
- Open the **API documentation** (Swagger UI)

---

## Troubleshooting

### Logs not visible

| Symptom | Cause | Fix |
|---|---|---|
| No logs in terminal | Server was running before Logger was added | Restart `npm run dev` |
| Only `info`+ logs visible | `LOG_LEVEL` not set or set to `info` | Add `LOG_LEVEL=debug` to `.env.local`, restart |
| No logs in browser DevTools | Default client log level is `info` | Go to `/settings`, set level to `debug` |
| File logging not working | `LOG_FILE` not set | Set `LOG_FILE=./logs/zetlab.log` in `.env.local` |
| FHIR URL not resolving | Wrong fallback URL | Set `FHIR_BASE_URL` in `.env.local` |

### FHIR connection errors

- Local dev: start HAPI FHIR via Docker (`docker compose up hapi -d` from `backend/docker/`)
- Docker production: `FHIR_BASE_URL` must use the Docker network service name (e.g. `http://hapi-fhir:8080/fhir`)

### Auth issues

- If login always fails: check `AUTH_SECRET` matches on all containers
- For read-only file systems (no `data/users.json`): set `ALLOW_LOCAL_AUTH=true` and `NEXT_PUBLIC_FORCE_LOCAL_AUTH=true`
