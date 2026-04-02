[← Infrastructure](../README.md) | [↑ src](../../README.md)

---

# 🌐 API

HTTP layer: thin Next.js routes → injectable controllers → typed DTOs.

## 📦 Structure

| | Folder / File | Description |
|---|---|---|
| 🎮 | [controllers/](./controllers/README.md) | Business logic per endpoint group |
| 📊 | [dto/](./dto/README.md) | Typed request/response contracts |
| 📄 | [openapi.ts](./openapi.ts) | OpenAPI 3.0 spec — single source of truth |

## ⚙️ Rules

- Routes are thin: parse params → call controller → return `NextResponse`
- Controllers return DTOs; no `NextResponse` inside controllers
- `httpStatus` is internal — strip before the JSON response body
- Add new endpoints to `openapi.ts` **before** writing the route handler

---

[⬆ Back to top](#)
