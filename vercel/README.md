# Vercel Deployment — Bekannte Probleme & Lösungen

---

## ⛔ Problem: Edge Function referencing unsupported modules

### Fehlermeldung

```
The Edge Function "src/middleware" is referencing unsupported modules:
- __vc__ns__/0/index.js: @opentelemetry/api
```

### Datum

2026-04-04 — Problem ist **4x** aufgetreten bevor die endgültige Lösung gefunden wurde.

---

### Ursache

Vercels Edge-Bundler (`__vc__ns__`) verwendet **esbuild** — nicht webpack.

esbuild folgt **alle** `import()` Aufrufe statisch, auch wenn sie hinter einem
`if (process.env.NEXT_RUNTIME === "nodejs")` Guard stehen.

Die Importkette die das Problem verursacht hat:

```
middleware.ts (Edge Runtime)
  ↓ Next.js lädt instrumentation.ts für alle Runtimes
instrumentation.ts
  ↓ await import("./instrumentation.node")  ← esbuild folgt diesem Import
instrumentation.node.ts
  ↓ import { NodeSDK } from "@opentelemetry/sdk-node"
@opentelemetry/sdk-node
  ↓ transitive Abhängigkeit
@opentelemetry/api  ← ❌ nicht Edge-kompatibel
```

---

### Lösung (die EINZIGE die funktioniert)

Next.js hat ein eingebautes webpack-Plugin das `*.node.ts` Dateien **physisch**
aus dem Edge-Bundle entfernt. Vercels `__vc__ns__` Bundler respektiert diese
Konvention.

#### `src/instrumentation.ts` — minimal, Edge-safe

```ts
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
```

#### `src/instrumentation.node.ts` — statische Top-Level Imports

```ts
// Statische Imports sind SICHER hier — diese Datei wird nie ins Edge-Bundle eingebunden
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

// DB Migrations
async function runStartupMigrations() { ... }
await runStartupMigrations();

// OTel Setup
if (process.env.ENABLE_TRACING === "true") {
  const sdk = new NodeSDK({ ... });
  sdk.start();
}
```

#### `next.config.mjs` — NUR serverExternalPackages, KEIN webpack()

```js
const nextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",

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

  // ⛔ KEIN webpack() Block — isServer === true gilt für BEIDE Runtimes
  // Eine webpack() Funktion mit isServer-Check fügt commonjs-Externals ins
  // Edge-Bundle ein und VERURSACHT exakt diesen Fehler statt ihn zu lösen.
};
```

---

### Verbotene Ansätze — alle wurden versucht, alle haben versagt

| Ansatz | Warum er scheitert |
|---|---|
| `/* webpackIgnore: true */` | esbuild ignoriert webpack-Kommentare |
| Dynamische `import()` in `register()` | esbuild folgt String-Literalen statisch |
| Leere `instrumentation.ts` (kein Import) | DB-Migrations und OTel laufen dann nicht |
| `webpack()` Funktion mit `isServer` Guard | Läuft auch für Edge-Runtime — fügt `commonjs` Externals ins Edge-Bundle ein |
| Webpack `resolve.alias` für Edge-Runtime | `__vc__ns__` ignoriert webpack-Konfiguration |
| Intermediate-Files (`initTelemetry.ts`) | `__vc__ns__` folgt static re-exports |
| `typeof window` Guard | Wird von esbuild statisch analysiert |

---

### Checkliste bei erneutem Auftreten

1. `src/instrumentation.ts` — enthält es irgendetwas ausser dem `NEXT_RUNTIME` Guard? → entfernen
2. `next.config.mjs` — gibt es einen `webpack()` Block? → entfernen
3. `src/instrumentation.node.ts` — sind die OTel-Imports statisch auf Top-Level? → muss so sein
4. Gibt es ein neues Node.js-only Package das direkt in `instrumentation.ts` importiert wird? → nach `instrumentation.node.ts` verschieben
5. `serverExternalPackages` — ist das neue Package dort eingetragen? → eintragen

---

### Referenzen

- `CLAUDE.md` → Abschnitt "⛔ Vercel Edge / OTel — KRITISCHE REGELN"
- Memory: `feedback_otel_edge.md`
- Git-Commits die das Problem gelöst haben: `d271f78`, `1ef3802`
