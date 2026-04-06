# Datenbank — Übersicht

z2Lab OrderEntry unterstützt drei Datenbankprovider. Der Provider wird einmalig
via `ORDERENTRY_DB__PROVIDER` konfiguriert und gilt für die gesamte Laufzeit.

## Provider wählen

| Provider | Wann | Datei |
|---|---|---|
| **SQLite** (Standard) | Einzelner Server, lokale Entwicklung, einfaches Setup | [sqlite.md](./sqlite.md) |
| **PostgreSQL** | Multi-Node, hohe Last, Docker-Produktiv | [postgresql.md](./postgresql.md) |
| **SQL Server / MariaDB** | Bestehende MS/MySQL-Infrastruktur | [sqlserver.md](./sqlserver.md) |

## Schnellstart

```bash
# Provider setzen (Standard: sqlite — kann weggelassen werden)
ORDERENTRY_DB__PROVIDER=sqlite
DATABASE_URL="file:./data/orderentry.db"

# Schema initialisieren
npx prisma migrate deploy

# Health prüfen (nach Login)
GET /api/health/db
```

## Wichtig: DATABASE_URL Pfad bei SQLite

Prisma löst `file:` Pfade **relativ zur `schema.prisma`-Datei** auf.

```
schema.prisma liegt in:  frontend/zetlab/prisma/
DATABASE_URL=file:../data/orderentry.db
→ Datei:                 frontend/zetlab/data/orderentry.db  ✓

DATABASE_URL=file:./data/orderentry.db
→ Datei:                 frontend/zetlab/prisma/data/orderentry.db  ← häufiger Fehler!
```

## Migration Workflow

```
Schema ändern (prisma/schema.prisma)
    ↓
npx prisma migrate dev       ← Dev: erstellt + wendet Migration an
npx prisma migrate deploy    ← Prod: wendet vorhandene Migrations an
npx prisma generate          ← Client neu generieren (nach generate immer .next löschen)
```

## Fehlerdiagnose

→ [troubleshooting.md](./troubleshooting.md)

Der Health-Endpoint zeigt immer den aktuellen Zustand:
```
GET /api/health/db   (Admin-Session erforderlich)
```
