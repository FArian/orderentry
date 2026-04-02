[← src](../README.md)

---

# 🗂️ Shared

Framework-agnostic utilities and client-safe config. Importable from **any** layer.

## 📦 Structure

| | Folder | Description |
|---|---|---|
| 🛠️ | [utils/](./utils/README.md) | `formatDate`, `base64`, `envParser` |
| 🔑 | [config/](./config/README.md) | `AppConfig` — `NEXT_PUBLIC_*` only |

## ⚙️ Rules

- No React imports
- No Node-only APIs (`fs`, `path`, server-only `process.env`)
- Only `NEXT_PUBLIC_*` environment variables are safe here
- All functions in `utils/` must be pure (no side effects, no I/O)

---

[⬆ Back to top](#)
