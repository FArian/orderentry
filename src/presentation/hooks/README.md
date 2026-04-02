[← Presentation](../README.md) | [↑ src](../../README.md)

---

# 🪝 Hooks

React state management wired to domain services via `ServiceFactory`.

## 📄 Files

- 📄 [useResults.ts](./useResults.ts) — `search(filters)`, `setPage(n)`, `reload()`
- 📄 [useOrders.ts](./useOrders.ts) — list, delete via `ServiceFactory`

## ⚙️ Rules

- No direct `fetch` calls — use repository methods from services
- Inject mock repositories via `ServiceFactory` in tests
- Hooks receive already-debounced values from `SearchBar`

---

[⬆ Back to top](#)
