[← src](../README.md)

---

# 🔧 Infrastructure

Implements application interfaces. Contains all I/O: FHIR, HTTP, config, filesystem.

## 📦 Structure

| | Folder | Description |
|---|---|---|
| 🌐 | [api/](./api/README.md) | HTTP controllers, DTOs, OpenAPI spec |
| 🔑 | [config/](./config/README.md) | `EnvConfig` (startup) + `RuntimeConfig` (per-request) |
| 🧬 | [fhir/](./fhir/README.md) | `FhirClient` + FHIR → domain mappers |
| 🗄️ | [repositories/](./repositories/README.md) | Concrete `IResultRepository` + `IOrderRepository` |
| 📈 | [logging/](./logging/README.md) | Server-side logging utilities |

## ⚙️ Rules

- Only layer allowed to import `process.env` (server-side vars)
- Only layer allowed to call `fetch` or Node.js `fs`
- Never import from `presentation` or `app`

---

[⬆ Back to top](#)
