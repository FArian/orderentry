[← Presentation](../README.md) | [↑ src](../../README.md)

---

# 🖼️ Design System

Tailwind-only, accessible components. Barrel export from `index.ts`.

## 📄 Components

| Component | Key Props |
|---|---|
| `Button` | `variant`: primary/secondary/danger/ghost · `size`: sm/md/lg · `loading` |
| `Input` | `label`, `error` (aria-invalid), `hint`, `prefix`/`suffix` |
| `Select` | `SelectOption[]`, `placeholder`, `label`, `error` |
| `Card` | `title`, `subtitle`, `headerAction` slot, `noPadding` |
| `Badge` | 7 color variants, `icon`, hover tooltip |
| `Loader` | `SkeletonRows`, `SkeletonBlock`, `PageLoader` |
| `EmptyState` | `icon`, `title`, `description`, action slot |

## 🎨 Theme

- Tokens defined in `src/app/globals.css` as CSS custom properties (`--zt-primary`, etc.)
- Tailwind utilities generated via `@theme inline`: `bg-zt-primary`, `text-zt-text-primary`, `border-zt-border`, …
- TypeScript ref object: `import { theme } from "@/presentation/ui"` (for canvas/SVG only)
- Dark theme ready: add `.dark` class to `<html>` — no other code changes needed

## ⚙️ Rules

- Import via barrel: `import { Button, Badge } from "@/presentation/ui"`
- All colors must use `zt-*` token classes — never hardcode hex or Tailwind color names
- No inline `style={}` overrides — Tailwind variants only
- No one-off wrapper components for single use cases

---

[⬆ Back to top](#)
