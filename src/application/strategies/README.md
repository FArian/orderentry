[← Application](../README.md) | [↑ src](../../README.md)

---

# 🔀 Strategies

Strategy pattern for resolving patient search input to a query type.

## 📄 Files

- 📄 [PatientSearchStrategy.ts](./PatientSearchStrategy.ts) — `PatientIdStrategy`, `PatientNameStrategy`, `patientSearchSelector`

## 🔍 Behaviour

| Input | Result |
|---|---|
| `/^\d{5,}$/` or UUID | `{ patientId: "…" }` |
| any other string | `{ patientName: "…" }` |
| empty string | `{}` |

## ⚙️ Rules

- UI always calls `patientSearchSelector.resolve()` — never inline the heuristic

---

[⬆ Back to top](#)
