[← Domain](../README.md) | [↑ src](../../README.md)

---

# 🏭 Factories

Safe entity construction with typed defaults for every field.

## 📄 Files

- 📄 [ResultFactory.ts](./ResultFactory.ts) — `create(partial)`, `createEmpty(overrides)`
- 📄 [OrderFactory.ts](./OrderFactory.ts) — `create(partial)`, `createDraft(patientId)`

## ⚙️ Rules

- Every field has a default (`""`, `0`, `null`, `[]`, `"unknown"`)
- `toStatus(raw)` validates against `VALID_STATUSES`; unknown → `"unknown"`
- `basedOn` always coerced to array; non-numeric `resultCount` → `0`

---

[⬆ Back to top](#)
