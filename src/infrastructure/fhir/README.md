[← Infrastructure](../README.md) | [↑ src](../../README.md)

---

# 🧬 FHIR

Server-side FHIR client and resource-to-domain mappers.

## 📄 Files

- 📄 [FhirClient.ts](./FhirClient.ts) — HTTP client; reads `FHIR_BASE_URL`; `cache: "no-store"`
- 📄 [DiagnosticReportMapper.ts](./DiagnosticReportMapper.ts) — `FhirDiagnosticReport` → `Result` entity
- 📄 [ObservationMapper.ts](./ObservationMapper.ts) — FHIR `Observation` → `Analysis` entity

## ⚙️ Rules

- All FHIR field knowledge is isolated inside mapper classes
- No FHIR field names (`subject`, `effectiveDateTime`, …) outside this folder
- Content-Type: `application/fhir+json` on all requests

---

[⬆ Back to top](#)
