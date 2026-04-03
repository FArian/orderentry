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
| `NEXT_PUBLIC_REGEX_GLN` | Client | _(built-in)_ | Override GLN validation regex (e.g. `^\d{13}$`) |
| `NEXT_PUBLIC_REGEX_AHV` | Client | _(built-in)_ | Override AHV validation regex (e.g. `^756\d{10}$`) |
| `NEXT_PUBLIC_REGEX_VEKA` | Client | _(built-in)_ | Override VEKA validation regex (e.g. `^80\d{18}$`) |
| `NEXT_PUBLIC_REGEX_UID` | Client | _(built-in)_ | Override UID validation regex (e.g. `^CHE-\d{3}\.\d{3}\.\d{3}$`) |
| `NEXT_PUBLIC_REGEX_ZSR` | Client | _(built-in)_ | Override ZSR validation regex (e.g. `^[A-Z]\d{6}$`) |
| `NEXT_PUBLIC_REGEX_BUR` | Client | _(built-in)_ | Override BUR validation regex (e.g. `^\d{8}$`) |

> **Note:** `NEXT_PUBLIC_*` variables are baked into the client bundle at build time.
> Pass them as `--build-arg` in Docker builds (see Docker section).
> Regex values use standard JavaScript regex syntax without slashes.

---

## Swiss Identifier Validation

All identifier validation lives in `src/shared/utils/swissValidators.ts`.
The logic is centralised — never inline in components.

### Supported identifiers

| Identifier | Description | Format | Example |
|---|---|---|---|
| **GLN** | Global Location Number (EAN-13) | 13 digits, check-digit validated | `7601002145985` |
| **AHV** | Sozialversicherungsnummer (NAVS13) | 13 digits starting with `756`, dots optional | `756.1234.5678.90` |
| **VEKA** | Europäische Krankenversicherungskarte | 20 digits starting with `80` + ISO country code | `80756000080102360798` |
| **UID** | Unternehmens-Identifikationsnummer | `CHE-XXX.XXX.XXX` | `CHE-123.456.789` |
| **ZSR** | Zahlstellenregisternummer (TARMED/TARDOC) | 1 letter + 6 digits | `Z123456` |
| **BUR** | Betriebs- und Unternehmensregister | 8 digits | `12345678` |

### AHV details

- Always starts with `756` (Swiss country code)
- Can be entered with or without dots: `7561234567890` or `756.1234.5678.90`
- Dots are auto-inserted as the user types
- Liechtenstein patients do **not** have an AHV — use their national identifier instead

### VEKA / European Health Insurance Card

The card number encodes the country of insurance in digits 3–5 (ISO 3166-1 numeric):

| Prefix | Country |
|---|---|
| `80756…` | Schweiz (CH) |
| `80438…` | Liechtenstein (LI) |
| `80276…` | Deutschland (DE) |
| `80040…` | Österreich (AT) |
| `80250…` | Frankreich (FR) |
| `80380…` | Italien (IT) |
| `80528…` | Niederlande (NL) |
| `80724…` | Spanien (ES) |
| _(+ all other EU/EEA members)_ | |

The country is auto-detected from the number as the user types.
Liechtenstein patients (prefix `80438`) are explicitly supported alongside Swiss cards.

### FHIR OID systems

These are the canonical FHIR identifier systems used when writing identifiers to HAPI:

```json
{
  "AHV":  "urn:oid:2.16.756.5.32",
  "GLN":  "urn:oid:2.51.1.3",
  "UID":  "urn:oid:2.16.756.5.35",
  "ZSR":  "urn:oid:2.16.756.5.30.1.123.100.2.1.1",
  "BUR":  "urn:oid:2.16.756.5.45",
  "VEKA": "urn:oid:2.16.756.5.30.1.123.100.1.1"
}
```

### Overriding regex via environment (Docker / .env.local)

All validation patterns can be overridden without code changes:

```env
# .env.local or docker-compose environment / --build-arg
NEXT_PUBLIC_REGEX_GLN=^\d{13}$
NEXT_PUBLIC_REGEX_AHV=^756\d{10}$
NEXT_PUBLIC_REGEX_VEKA=^80\d{18}$
NEXT_PUBLIC_REGEX_UID=^CHE-\d{3}\.\d{3}\.\d{3}$
NEXT_PUBLIC_REGEX_ZSR=^[A-Z]\d{6}$
NEXT_PUBLIC_REGEX_BUR=^\d{8}$
```

> These are `NEXT_PUBLIC_*` variables — they must be passed as `--build-arg` in Docker builds
> to be included in the client-side bundle. Setting them only in `docker-compose environment:`
> has no effect for browser code.

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
