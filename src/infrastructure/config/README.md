[← Infrastructure](../README.md) | [↑ src](../../README.md)

---

# 🔑 Config

Server-side environment configuration — two complementary layers.

## 📄 Files

| File | When evaluated | Source |
|---|---|---|
| 📄 [EnvConfig.ts](./EnvConfig.ts) | Once at process startup | `process.env` |
| 📄 [RuntimeConfig.ts](./RuntimeConfig.ts) | Per request | `data/config.json` → `process.env` → default |

## ⚙️ Rules

- Only import these in `infrastructure` or `app/api` routes — never in `shared/` or `presentation/`
- `EnvConfig` for internal services (FHIR client, auth, logging)
- `RuntimeConfig` for GUI-editable overrides (no restart required)
- Client-safe config lives in `shared/config/AppConfig.ts`

---

[⬆ Back to top](#)
