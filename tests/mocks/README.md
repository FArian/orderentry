[← Tests](../README.md) | [↑ OrderEntry](../../../../README.md)

---

# 📦 Mocks

Shared in-memory repository implementations for unit tests.

## 📄 Files

- 📄 [MockResultRepository.ts](./MockResultRepository.ts) — Implements `IResultRepository`; `seed()`, `reset()`
- 📄 [MockOrderRepository.ts](./MockOrderRepository.ts) — Implements `IOrderRepository`; tracks `deletedIds`, `createdOrders`

## ⚙️ Rules

- Used only in unit tests and `ServiceFactory` test injection
- Never used in integration tests (use real implementations there)
- Call `reset()` in `beforeEach` to ensure test isolation

---

[⬆ Back to top](#)
