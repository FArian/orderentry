[← Presentation](../README.md) | [↑ src](../../README.md)

---

# 📐 Pages

Full CA-wired page components imported by Next.js `app/` routes.

## 📄 Files

- 📄 [ResultsPage.tsx](./ResultsPage.tsx) — Global `DiagnosticReport` results
- 📄 [OrdersPage.tsx](./OrdersPage.tsx) — Global `ServiceRequest` orders

## ⚙️ Rules

- Pages wire hooks, components, and i18n — no business logic here
- Thin wrappers: receive no props beyond what Next.js provides
- Use `SkeletonRows` from design system during loading

---

[⬆ Back to top](#)
