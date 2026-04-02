[← OrderEntry](../../../README.md)

---

# 🏗️ Source Architecture

Clean Architecture — dependency direction: `domain ← application ← infrastructure / presentation ← app`.

## 📦 Layers

| | Layer | Description |
|---|---|---|
| 🎯 | [domain/](./domain/README.md) | Pure business rules — no framework deps |
| 📋 | [application/](./application/README.md) | Use cases, services, repository interfaces |
| 🔧 | [infrastructure/](./infrastructure/README.md) | FHIR, HTTP, config, API controllers |
| 🎨 | [presentation/](./presentation/README.md) | React hooks, components, design system |
| 🗂️ | [shared/](./shared/README.md) | Framework-agnostic utilities + client-safe config |
| 🖥️ | [app/](./app/README.md) | Next.js App Router (pages + API routes) |
| 📝 | [messages/](./messages/README.md) | i18n JSON files (de, en, fr, it) |

## ⚙️ Rules

- `domain` has zero external dependencies
- `infrastructure` and `presentation` depend on `application`; never on each other
- `shared` is importable from any layer
- `process.env` only in `infrastructure`; `NEXT_PUBLIC_*` only in `shared/config`
- Legacy folders (`components/`, `lib/`) must not be restructured

---

[⬆ Back to top](#)
