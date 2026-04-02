[← src](../README.md)

---

# 📋 Application

Orchestrates domain. Defines repository interfaces. No HTTP, no DOM.

## 📦 Structure

| | Folder | Description |
|---|---|---|
| 🛡️ | [interfaces/](./interfaces/README.md) | Repository interface contracts |
| ⚙️ | [services/](./services/README.md) | `ResultService`, `OrderService` |
| 🔀 | [strategies/](./strategies/README.md) | `PatientSearchStrategy` |

## ⚙️ Rules

- May import `domain` only
- No React, no `fetch`, no `process.env`
- Repository interfaces define the contract; `infrastructure` implements them

---

[⬆ Back to top](#)
