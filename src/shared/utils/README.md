[← Shared](../README.md) | [↑ src](../../README.md)

---

# 🛠️ Utils

Pure, framework-agnostic utility functions.

## 📄 Files

- 📄 [formatDate.ts](./formatDate.ts) — `formatDate(date?)` → `DD.MM.YYYY` (no date libraries)
- 📄 [base64.ts](./base64.ts) — `b64toDataUrl(b64, mime)`, `decodeB64Utf8(b64)`
- 📄 [envParser.ts](./envParser.ts) — `parseEnvFile(content)`, `applyEnvUpdates(original, updates)` — no I/O
- 📄 [swissValidators.ts](./swissValidators.ts) — Swiss healthcare identifier validation and formatting

## 🇨🇭 swissValidators

Centralised validation for all Swiss/European healthcare identifiers.
**Never inline these patterns in components** — always import from this module.

| Export | Purpose |
|---|---|
| `validateGln(raw)` | EAN-13 check-digit validation; returns `{ valid, error? }` |
| `sanitizeGln(raw)` | Strip non-digits, max 13 |
| `validateAhv(raw)` | NAVS13: must start with `756`, 13 digits (dots allowed) |
| `sanitizeAhv(raw)` | Auto-insert dots as `756.XXXX.XXXX.XX` |
| `formatAhv(raw)` | Format 13-digit string as dotted form |
| `validateVeka(raw)` | 20 digits, `80` + ISO country code |
| `sanitizeVeka(raw)` | Strip non-digits, max 20 |
| `detectVekaCountry(raw)` | Returns ISO numeric code or `null` |
| `validateUid(raw)` | `CHE-XXX.XXX.XXX` format |
| `sanitizeUid(raw)` | Auto-format as user types |
| `validateZsr(raw)` | Letter + 6 digits (e.g. `Z123456`) |
| `sanitizeZsr(raw)` | Uppercase + only digits after first char |
| `validateBur(raw)` | 8 digits exactly |
| `sanitizeBur(raw)` | Strip non-digits, max 8 |
| `VEKA_COUNTRIES` | Map of ISO numeric → country display name (all EU/EEA) |
| `VEKA_COUNTRY_OPTIONS` | Sorted dropdown options (CH + LI first) |
| `IDENTIFIER_SYSTEMS` | FHIR OID URN for each identifier type |

**Regex override via ENV** (all optional — defaults are Swiss-correct):

```
NEXT_PUBLIC_REGEX_GLN   NEXT_PUBLIC_REGEX_AHV   NEXT_PUBLIC_REGEX_VEKA
NEXT_PUBLIC_REGEX_UID   NEXT_PUBLIC_REGEX_ZSR   NEXT_PUBLIC_REGEX_BUR
```

## ⚙️ Rules

- All functions are pure — no side effects, no I/O
- No React or Next.js dependencies
- Reusable across all architectural layers

---

[⬆ Back to top](#)
