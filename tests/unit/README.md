[← Tests](../README.md) | [↑ OrderEntry](../../../../README.md)

---

# 🔬 Unit Tests

Fast tests with no I/O, no HTTP, no DOM.

## 📦 Structure

- 📁 `domain/factories/` — `ResultFactory`, `OrderFactory`
- 📁 `domain/useCases/` — `GetResults`, `SearchResults`, `GetOrders`, `CreateOrder`
- 📁 `domain/valueObjects/` — `OrderNumber`, `Identifier`
- 📁 `application/strategies/` — `PatientSearchStrategy`

## ⚙️ Rules

- Use `MockResultRepository` / `MockOrderRepository` from [mocks/](../mocks/README.md)
- No `fetch` mocking — if you need HTTP, it belongs in integration tests
- Call `reset()` in `beforeEach` to ensure test isolation

---

[⬆ Back to top](#)
