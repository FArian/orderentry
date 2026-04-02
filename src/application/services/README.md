[← Application](../README.md) | [↑ src](../../README.md)

---

# ⚙️ Services

Orchestrate use cases; consumed by presentation hooks via `ServiceFactory`.

## 📄 Files

- 📄 [ResultService.ts](./ResultService.ts) — Coordinates `GetResults` + `SearchResults`
- 📄 [OrderService.ts](./OrderService.ts) — Coordinates `GetOrders` + `CreateOrder`

## ⚙️ Rules

- Accept repository via constructor (injected by `ServiceFactory`)
- No direct FHIR or HTTP calls
- Services are the boundary between `application` and `presentation`

---

[⬆ Back to top](#)
