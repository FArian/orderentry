# FHIR Seed Bootstrap

Embeds base FHIR data inside the Docker image and applies it automatically on container startup.

---

## Files

```
frontend/zetlab/
├── seed/fhir/
│   ├── masterdata.json       # Required: Organizations, Practitioner, ActivityDefinitions
│   └── demo-data.json        # Optional: Patients, ServiceRequests, DiagnosticReports
└── scripts/
    └── fhir-seed.mjs         # Bootstrap loader — runs before server.js
```

---

## How It Works

On every container startup:

```
1. Wait for FHIR server (retry 12×, 5s interval)
2. GET Organization/zlz → check meta.tag seed version
3. If missing or version differs → POST masterdata.json bundle
4. If FHIR__SEED_DEMO=true → POST demo-data.json bundle
5. Start Next.js server (server.js)
```

The seed is **idempotent** — it uses `PUT` with fixed resource IDs. Running it twice creates no duplicates.

---

## ENV Variables

| Variable | Default | Purpose |
|---|---|---|
| `ORDERENTRY_FHIR__SEED_ENABLED` | `true` | Enable seed on startup |
| `ORDERENTRY_FHIR__SEED_DEMO` | `false` | Also load demo data (never in production) |
| `ORDERENTRY_FHIR__BASE_URL` | `http://localhost:8080/fhir` | FHIR R4 server |
| `FHIR_BASE_URL` | — | Legacy alias (checked if namespaced var is absent) |

---

## Masterdata Contents (v1)

| Resource | ID | Purpose |
|---|---|---|
| Organization | `zlz-gruppe` | Parent lab group |
| Organization | `zlz` | ZLZ Zentrallabor AG (the lab, anchor resource) |
| Organization | `zetlab` | ZetLab AG (subsidiary) |
| Organization | `klinik-hirslanden` | Demo client organisation |
| Organization | `versicherung-css` | Demo insurance company |
| Practitioner | `prac-001` | Dr. med. Hans Müller (demo requester) |
| PractitionerRole | `role-001` | Müller @ Klinik Hirslanden |
| ActivityDefinition | `service-type-mibi` | MIBI service type marker |
| ActivityDefinition | `service-type-routine` | ROUTINE service type marker |
| ActivityDefinition | `service-type-poc` | POC service type marker |

The ActivityDefinitions carry `topic.coding.code` values (`MIBI`, `ROUTINE`, `POC`) which the `/api/v1/config/service-types` endpoint reads to auto-discover available service types.

---

## Demo Data Contents (demo-v1)

| Resource | ID | Description |
|---|---|---|
| Patient | `demo-001` | Anna Muster, Zürich |
| Patient | `demo-002` | Beat Schreiber, Winterthur |
| Patient | `demo-003` | Claudia Weber, Küsnacht |
| ServiceRequest | `demo-sr-001` | Routine — Grosse Hämatologie (completed) |
| ServiceRequest | `demo-sr-002` | MIBI — Blutkultur (active) |
| ServiceRequest | `demo-sr-003` | POC — Troponin STAT (active) |
| DiagnosticReport | `demo-dr-001` | Final result for Muster |
| DiagnosticReport | `demo-dr-002` | Preliminary result for Weber |

---

## Versioning

Each resource carries a seed version tag:

```json
"meta": {
  "tag": [{
    "system": "https://www.zetlab.ch/fhir/seed",
    "code": "v1"
  }]
}
```

**Version upgrade procedure:**

1. Edit the resources in `masterdata.json`
2. Bump the `code` value: `"v1"` → `"v2"`
3. Update `SEED_VERSION = "v2"` in `scripts/fhir-seed.mjs`
4. Rebuild the image — existing installations update automatically on next restart

---

## Manual Re-seed

Run the seed script in a running container without restarting:

```bash
# Linux / macOS
docker exec orderentry node /app/scripts/fhir-seed.mjs

# With demo data
ORDERENTRY_FHIR__SEED_DEMO=true docker exec orderentry node /app/scripts/fhir-seed.mjs
```

Or locally in development:

```bash
cd frontend/zetlab
ORDERENTRY_FHIR__BASE_URL=http://localhost:8080/fhir node scripts/fhir-seed.mjs
```

---

## Disabling the Seed

```yaml
# docker-compose.yml
environment:
  ORDERENTRY_FHIR__SEED_ENABLED: "false"
```

The server starts immediately without waiting for the FHIR server.

---

## Adding Resources to Masterdata

1. Add the entry to `seed/fhir/masterdata.json` with `request.method: "PUT"` and a fixed `request.url`.
2. Include the version tag in `meta.tag`.
3. Rebuild the image or run the seed script manually.

Do **not** use `POST` — only `PUT` with a fixed ID is idempotent.
