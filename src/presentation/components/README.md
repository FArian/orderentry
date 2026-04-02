[← Presentation](../README.md) | [↑ src](../../README.md)

---

# 🧩 Components

Feature-level React components consumed by pages.

## 📄 Files

- 📄 [ResultList.tsx](./ResultList.tsx) — Result list + `DiagnosticReportStatusBadge` + `PreviewButtons`
- 📄 [SearchBar.tsx](./SearchBar.tsx) — Controlled input with 350ms internal debounce
- 📄 [PatientCard.tsx](./PatientCard.tsx) — Compact patient link → `/patient/[id]`
- 📄 [PreviewModal.tsx](./PreviewModal.tsx) — `ModalState` type + `PreviewButtons` + `PreviewModal`

## ⚙️ Rules

- Use design system components from [ui/](../ui/README.md)
- No inline `style={}` — Tailwind variants only
- Debounce lives in `SearchBar` — no redundant debounce in hooks

---

[⬆ Back to top](#)
