[← Domain](../README.md) | [↑ src](../../README.md)

---

# ⚡ Use Cases

Single-responsibility orchestrators — delegate to repository interfaces only.

## 📄 Files

- 📄 [GetResults.ts](./GetResults.ts) — Delegates to `IResultRepository.search()`
- 📄 [SearchResults.ts](./SearchResults.ts) — Normalises query (trim, page 1 min, pageSize 100 max)
- 📄 [GetOrders.ts](./GetOrders.ts) — Delegates to `IOrderRepository.list()`
- 📄 [CreateOrder.ts](./CreateOrder.ts) — Delegates to `IOrderRepository.create()`

## ⚙️ Rules

- Call only domain entities and repository interfaces
- No direct `fetch` or HTTP calls
- No React imports

---

[⬆ Back to top](#)
