[← Tests](../README.md) | [↑ OrderEntry](../../../../README.md)

---

# 🔗 Integration Tests

Real object graphs wired together — no external services required.

## 📦 Structure

- 📁 `infrastructure/api/` — Controller tests with injected mock `fetchFn`

## ⚙️ Rules

- Use real class instances (not mocked)
- Inject `jest.fn()` as `fetchFn` into controllers — no real FHIR server required
- Never mock the repository in integration tests
- Tests verify URL construction, response mapping, and error cases

---

[⬆ Back to top](#)
