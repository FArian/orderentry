[← src](../README.md)

---

# 📝 Messages (i18n)

Translation files for all 4 supported languages.

## 📄 Files

- 📄 [de.json](./de.json) — 🇩🇪 German (primary UI language)
- 📄 [en.json](./en.json) — 🇬🇧 English
- 📄 [fr.json](./fr.json) — 🇫🇷 French
- 📄 [it.json](./it.json) — 🇮🇹 Italian

## 📦 Namespaces

`common` · `nav` · `home` · `patient` · `insurance` · `orders` · `order` · `results` · `befunde` · `settings` · `bs` · `profile`

## ⚙️ Rules

- All 4 files must be updated simultaneously when adding new keys
- Key format: `namespace.camelCaseKey` (e.g. `results.noResults`)
- Never hardcode user-visible strings in JSX — always use `useTranslations()`
- German is the primary language; other translations must match semantically

---

[⬆ Back to top](#)
