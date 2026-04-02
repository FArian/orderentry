[← Shared](../README.md) | [↑ src](../../README.md)

---

# 🛠️ Utils

Pure, framework-agnostic utility functions.

## 📄 Files

- 📄 [formatDate.ts](./formatDate.ts) — `formatDate(date?)` → `DD.MM.YYYY` (no date libraries)
- 📄 [base64.ts](./base64.ts) — `b64toDataUrl(b64, mime)`, `decodeB64Utf8(b64)`
- 📄 [envParser.ts](./envParser.ts) — `parseEnvFile(content)`, `applyEnvUpdates(original, updates)` — no I/O

## ⚙️ Rules

- All functions are pure — no side effects, no I/O
- No React or Next.js dependencies
- Reusable across all architectural layers

---

[⬆ Back to top](#)
