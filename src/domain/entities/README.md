[← Domain](../README.md) | [↑ src](../../README.md)

---

# 🧱 Entities

Domain entity interfaces with status union types.

## 📄 Files

- 📄 [Order.ts](./Order.ts) — `Order` interface + `OrderStatus` union type
- 📄 [Result.ts](./Result.ts) — `Result` interface + `ResultStatus` union type

## ⚙️ Rules

- Entities are plain interfaces — no classes
- Status values come from union types only; never compare raw strings outside domain
- No `Partial<>` in production code

---

[⬆ Back to top](#)
