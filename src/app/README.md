[← src](../README.md)

---

# 🖥️ App (Next.js App Router)

Thin page wrappers and server-side API route handlers.

## 📦 Key Pages

| Route | Description |
|---|---|
| `/` | Home |
| `/patient`, `/patient/[id]` | Patient search + detail *(legacy — do not restructure)* |
| `/order/[id]` | Order entry *(legacy — do not restructure)* |
| `/orders` | Global orders list |
| `/results` | Global results list |
| `/settings` | Application settings |

## 🌐 Key API Routes

| Route | Description |
|---|---|
| `/api/patients` | Patient search |
| `/api/service-requests` | Orders (list, get, update, delete) |
| `/api/diagnostic-reports` | Results |
| `/api/env` | Env var viewer/editor (writes `.env.local`; restart needed) |
| `/api/config` | Runtime overrides (writes `data/config.json`; immediate effect) |
| `/api/docs` · `/api/openapi.json` | Swagger UI + OpenAPI spec |

## ⚙️ Rules

- Pages are thin: import from `presentation/pages/`
- API routes delegate to `infrastructure/api/controllers/`
- Legacy pages (`patient/`, `order/`) must not be restructured

---

[⬆ Back to top](#)
