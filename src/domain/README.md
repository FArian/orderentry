[← src](../README.md)

---

# 🎯 Domain

Pure TypeScript business rules. Zero framework dependencies.

## 📦 Structure

| | Folder | Description |
|---|---|---|
| 🧱 | [entities/](./entities/README.md) | `Order`, `Result` — interfaces + status union types |
| 💎 | [valueObjects/](./valueObjects/README.md) | `OrderNumber`, `Identifier` — immutable, self-validating |
| ⚡ | [useCases/](./useCases/README.md) | `GetResults`, `SearchResults`, `GetOrders`, `CreateOrder` |
| 🏭 | [factories/](./factories/README.md) | `ResultFactory`, `OrderFactory` — safe entity construction |

## ⚙️ Rules

- No React, no `fetch`, no `process.env`
- No imports from `application`, `infrastructure`, or `presentation`
- All status values are union types — no raw string comparisons
- Value objects throw on invalid input; callers must not add defensive guards

---

[⬆ Back to top](#)
