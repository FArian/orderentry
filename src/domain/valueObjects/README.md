[← Domain](../README.md) | [↑ src](../../README.md)

---

# 💎 Value Objects

Immutable, self-validating value objects.

## 📄 Files

- 📄 [OrderNumber.ts](./OrderNumber.ts) — Wraps order number string; validates format; `equals()`, `toString()`
- 📄 [Identifier.ts](./Identifier.ts) — FHIR system+value pair; `toToken()` → `"system|value"`

## ⚙️ Rules

- No setters — re-create instead of mutating
- Constructor throws on invalid input
- Do not add defensive checks in callers — trust the value object

---

[⬆ Back to top](#)
