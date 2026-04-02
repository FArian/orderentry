[← src](../README.md)

---

# 🎨 Presentation

React hooks, feature-level components, and design system.

## 📦 Structure

| | Folder | Description |
|---|---|---|
| 🪝 | [hooks/](./hooks/README.md) | `useResults`, `useOrders` — state + `ServiceFactory` |
| 🧩 | [components/](./components/README.md) | `ResultList`, `SearchBar`, `PatientCard`, `PreviewModal` |
| 📐 | [pages/](./pages/README.md) | `ResultsPage`, `OrdersPage` — fully CA-wired |
| 🖼️ | [ui/](./ui/README.md) | Design system — `Button`, `Badge`, `Card`, … |

## ⚙️ Rules

- Never call `fetch` directly — use hooks which call repositories via `ServiceFactory`
- Never read `process.env` — use `AppConfig` for client-safe values
- All UI strings via `useTranslations()` — no hardcoded text in JSX

---

[⬆ Back to top](#)
