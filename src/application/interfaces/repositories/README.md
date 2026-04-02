[← Interfaces](../README.md) | [↑ Application](../../README.md)

---

# 🗄️ Repository Interfaces

Contracts for all data access operations.

## 📄 Files

- 📄 [IResultRepository.ts](./IResultRepository.ts) — `search(query)`, `getById(id)`
- 📄 [IOrderRepository.ts](./IOrderRepository.ts) — `list`, `getById`, `create`, `delete`

## ⚙️ Rules

- Interfaces only — no implementation details
- Never call `fetch` here; that belongs in `infrastructure/repositories/`
- `ServiceFactory` wires the concrete implementation at runtime

---

[⬆ Back to top](#)
