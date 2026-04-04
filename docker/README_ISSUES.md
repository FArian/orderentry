# 🐳 Docker — Bekannte Probleme & Lösungen

Dieses Dokument dokumentiert aufgetretene Docker-Fehler mit Ursache, Lösung
und Checkliste für den nächsten Vorfall.

---

## ⛔ Problem 1: invalid file request .vercel/output/...

### Fehlermeldung

```
ERROR: failed to build: failed to solve: invalid file request .vercel/output/static/file.svg
```

### Datum

2026-04-04

### Ursache

`vercel dev` oder `vercel build` erstellt lokal das Verzeichnis `.vercel/output/`
mit statischen Dateien. Dieses Verzeichnis war zwar in `.gitignore` eingetragen,
aber **nicht** in `.dockerignore`. Docker hat deshalb versucht alle Dateien darunter
in den Build-Context zu laden — was mit dem obigen Fehler scheitert.

**Importkette:**
```
docker buildx build
  ↓ lädt Build-Context (alle Dateien ausser .dockerignore Einträge)
.vercel/output/static/file.svg  ← nicht Docker-kompatibel → Fehler
```

### Lösung

`.vercel` in `.dockerignore` eintragen:

```
# Vercel (local dev artifacts — never needed in Docker image)
.vercel
```

**Datei:** `.dockerignore` im Root des Next.js Projekts (`frontend/zetlab/`)

### Checkliste bei erneutem Auftreten

1. Wurde lokal `vercel dev` oder `vercel build` ausgeführt? → `.vercel/` Ordner prüfen
2. Ist `.vercel` in `.dockerignore` eingetragen? → falls nicht, sofort eintragen
3. Gibt es andere neu erstellte lokale Verzeichnisse? → ebenfalls in `.dockerignore` prüfen

---

## ⛔ Problem 2: Module not found — Node.js built-ins (fs, path, http, tls)

### Fehlermeldung

```
Module not found: Can't resolve 'fs'
Module not found: Can't resolve 'path'
Module not found: Can't resolve 'tls'
Module not found: Can't resolve 'http'
```

### Datum

2026-04-04

### Ursache

Node.js-only Packages (`@opentelemetry/*`, `better-sqlite3`, `@prisma/client`)
werden von webpack in den Server-Bundle eingebunden. Deren transitive
Abhängigkeiten (z.B. `instrumentation-aws-lambda`, `instrumentation-net`)
importieren Node.js Built-ins statisch — was webpack nicht bundeln kann.

### Lösung

Alle Node.js-only Packages in `serverExternalPackages` in `next.config.mjs`
eintragen — webpack lädt sie dann zur Laufzeit aus `node_modules` statt sie
zu bundeln:

```js
serverExternalPackages: [
  "@opentelemetry/api",
  "@opentelemetry/sdk-node",
  "@opentelemetry/exporter-trace-otlp-http",
  "@opentelemetry/auto-instrumentations-node",
  "@opentelemetry/resources",
  "@opentelemetry/semantic-conventions",
  "@grpc/grpc-js",
  "@grpc/proto-loader",
  "better-sqlite3",
  "@prisma/client",
  "prisma",
],
```

> ⚠️ **WICHTIG:** Kein zusätzlicher `webpack()` Block mit `isServer` Guard.
> `isServer === true` gilt für BEIDE Runtimes (Node.js UND Edge).
> Ein solcher Block fügt `commonjs`-Externals ins Edge-Bundle ein
> und verursacht den Vercel Edge-Fehler. Siehe `vercel/README.md`.

### Checkliste bei erneutem Auftreten

1. Welches neue Package wurde hinzugefügt? → in `serverExternalPackages` eintragen
2. Gibt es einen `webpack()` Block in `next.config.mjs`? → entfernen
3. Lokal `npx next build` ausführen → muss ohne Fehler durchlaufen

---

## 🔁 Generelle Docker Build Checkliste (vor jedem Build)

```bash
# 1. TypeScript prüfen
npx tsc --noEmit

# 2. Lokaler Production Build
npx next build

# 3. Docker Build
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --build-arg GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) \
  --build-arg GIT_COUNT=$(git rev-list --count HEAD) \
  --build-arg NEXT_PUBLIC_LAB_ORG_ID=zlz \
  -t farian/orderentry:latest \
  --push \
  -f docker/Dockerfile \
  .
```

---

## 📋 .dockerignore Pflichteinträge

Diese Einträge müssen IMMER in `.dockerignore` stehen:

```
.git
node_modules
.env
.env*
.next
.vercel          ← vercel dev Artefakte
data             ← SQLite DB, config.json
logs             ← Log-Dateien
```

---

## 🔗 Referenzen

- `vercel/README.md` — Vercel Edge Runtime Fehler & Lösungen
- `CLAUDE.md` → Abschnitt "Docker & Deployment"
- `next.config.mjs` — `serverExternalPackages` Konfiguration
- `.dockerignore` — Build-Context Ausschlüsse
