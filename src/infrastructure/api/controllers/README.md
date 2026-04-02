[← API](../README.md) | [↑ Infrastructure](../../README.md)

---

# 🎮 Controllers

Business logic for each API endpoint group. Constructor-injectable for testing.

## 📄 Files

| File | Endpoint | Notes |
|---|---|---|
| 📄 [ResultsController.ts](./ResultsController.ts) | `GET /api/diagnostic-reports` | |
| 📄 [OrdersController.ts](./OrdersController.ts) | `GET`, `DELETE /api/service-requests` | |
| 📄 [PatientsController.ts](./PatientsController.ts) | `GET /api/patients` | |
| 📄 [EnvController.ts](./EnvController.ts) | `GET`, `POST /api/env` | Writes `.env.local`; requires restart |
| 📄 [ConfigController.ts](./ConfigController.ts) | `GET`, `POST /api/config` | Writes `data/config.json`; immediate effect |

## ⚙️ Rules

- Constructor accepts `fhirBase` and `fetchFn` for testability
- Module-level singleton: `export const xyzController = new XyzController()`
- `EnvController.update()` and `ConfigController.update()` return `405` on Vercel
- `ConfigController.get()` reads `process.env` — never parses `.env.local` at runtime

---

[⬆ Back to top](#)
