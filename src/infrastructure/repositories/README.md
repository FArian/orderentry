[← Infrastructure](../README.md) | [↑ src](../../README.md)

---

# 🗄️ Repositories

Concrete implementations of application repository interfaces.

## 📄 Files

- 📄 [FhirResultRepository.ts](./FhirResultRepository.ts) — `IResultRepository` via `/api/diagnostic-reports`
- 📄 [FhirOrderRepository.ts](./FhirOrderRepository.ts) — `IOrderRepository` via `/api/service-requests`

## ⚙️ Rules

- Implement only the interface — no extra public methods
- Use `HttpClient` for all HTTP calls
- Wired by `ServiceFactory`; never instantiated directly in hooks or pages

---

[⬆ Back to top](#)
