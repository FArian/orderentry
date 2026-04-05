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

## 🔐 Org-Filter-Regel (Mandantentrennung)

`PatientsController`, `OrdersController` und `ResultsController` unterstützen optionale Org-Parameter (`orgFhirId` / `orgGln`). Die **Route** entscheidet, ob der Filter gesetzt wird — nicht der Controller.

| User-Rolle | Org-Filter | Erklärung |
|---|---|---|
| `admin` | ❌ kein Filter | Interner ZLZ/ZetLab-Mitarbeiter — sieht alle Daten |
| `user` mit `orgFhirId` im Profil | ✅ Filter aktiv | Externer Auftraggeber — sieht nur seine Org |
| `user` ohne Profil-Org | ❌ kein Filter | Fallback (kein Auftraggeber konfiguriert) |

**Regel:** `role === "admin"` → `orgFhirId`/`orgGln` werden in der Route **nicht** an den Controller übergeben, auch wenn sie im User-Profil gesetzt sind. Admins haben ihre eigene ZLZ-Org im Profil — das ist kein Auftraggeber-Filter.

---

[⬆ Back to top](#)
