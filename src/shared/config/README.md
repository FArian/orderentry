[← Shared](../README.md) | [↑ src](../../README.md)

---

# 🔑 App Config

Client-safe application configuration (`NEXT_PUBLIC_*` only).

## 📄 Files

- 📄 [AppConfig.ts](./AppConfig.ts) — Typed getters for `NEXT_PUBLIC_*` env vars

## 📋 Key Values

| Key | Variable | Default |
|---|---|---|
| `appVersion` | `NEXT_PUBLIC_APP_VERSION` | auto-generated |
| `forceLocalAuth` | `NEXT_PUBLIC_FORCE_LOCAL_AUTH` | `false` |
| `defaultPageSize` | — | `20` |
| `searchDebounceMs` | — | `350` |

## ⚙️ Rules

- Only `NEXT_PUBLIC_*` — never server-only vars
- Safe to import in `"use client"` components and hooks
- Server-side vars belong in `infrastructure/config/EnvConfig.ts`

---

[⬆ Back to top](#)
