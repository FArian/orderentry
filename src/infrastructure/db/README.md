[← Infrastructure](../README.md) | [↑ src](../../README.md)

# 🗄️ Database Layer

Datenbankabstraktion für z2Lab OrderEntry.  
**Default: SQLite 3** — eingebettet, kein externer Dienst nötig.  
Wechsel zu PostgreSQL oder MSSQL durch zwei ENV-Variablen — kein Code-Änderung.

---

## 🗂️ Struktur

```
src/infrastructure/db/
├── DatabaseConfig.ts          — DB_PROVIDER + DATABASE_URL auflösen, URL maskieren
├── prismaClient.ts            — Prisma-Singleton (Hot-Reload-sicher, Node.js only)
├── runMigrations.ts           — Router: SQLite → SqliteMigrationRunner; PG/MSSQL → No-op
├── SqliteMigrationRunner.ts   — Flyway-kompatibler Node.js-Runner (better-sqlite3, kein Java)
├── run-migrations-cli.ts      — CLI-Einstieg für npm run db:migrate:sqlite
├── migrate-users-json-cli.ts  — Einmaliger Import: data/users.json → SQLite
├── docker/
│   ├── Dockerfile.postgres    — PostgreSQL 16 Alpine, DB + Tabellen vorkonfiguriert
│   └── docker-compose.yml     — Stack: Postgres + pgAdmin (optional, Profile)
└── migrations/
    ├── setup-postgres.sh      — PostgreSQL User + DB anlegen
    ├── seed-dev.sql           — Testdaten (SQLite / PG / MSSQL)
    └── backup-sqlite.sh       — SQLite-Backup (letzte 10 behalten)

flyway/migrations/             — SQL-Quelldateien (Flyway-Namenskonvention)
├── sqlite/     V1__create_users.sql · V2__create_password_reset_tokens.sql
├── postgresql/  (gleiche Dateien, PG-Dialect)
└── sqlserver/   (gleiche Dateien, MSSQL-Dialect)
```

---

## ⚙️ Standard-Konfiguration: SQLite 3

| Eigenschaft | Wert |
|---|---|
| Engine | SQLite 3 via `better-sqlite3` |
| Datei | `./data/orderentry.db` |
| Modus | WAL + Foreign Keys ON |
| Migrationen | automatisch beim App-Start (`instrumentation.node.ts`) |
| Client (GUI) | [DB Browser for SQLite](https://sqlitebrowser.org/) · `npm run db:studio` · `sqlite3` CLI |

```env
DB_PROVIDER=sqlite
DATABASE_URL=file:./data/orderentry.db
```

---

## 🔄 Wechsel zu PostgreSQL

```env
DB_PROVIDER=postgresql
DATABASE_URL=postgresql://zetlab:zetlab@localhost:5432/orderentry
```

```bash
# 1. Dev-Container starten (Tabellen werden automatisch eingespielt)
docker compose -f src/infrastructure/db/docker/docker-compose.yml up -d

# 1a. Mit pgAdmin Web-GUI (http://localhost:5050)
docker compose -f src/infrastructure/db/docker/docker-compose.yml --profile pgadmin up -d

# 2. App starten
npm run dev
```

> Für Flyway-Migrationen (V3+): `docker compose --profile flyway up flyway`

**SQL-Clients:** [pgAdmin](https://www.pgadmin.org/) · [DBeaver](https://dbeaver.io/) · [TablePlus](https://tableplus.com/) · `psql -h localhost -U zetlab -d orderentry`

---

## 🔄 Wechsel zu MSSQL

```env
DB_PROVIDER=sqlserver
DATABASE_URL=sqlserver://localhost:1433;database=orderentry;user=sa;password=Pass!;trustServerCertificate=true
```

```bash
docker compose --profile flyway up flyway
npm run dev
```

---

## 🛠️ Migrations-Tools

| Tool | Wann | Hinweis |
|---|---|---|
| **SqliteMigrationRunner** | SQLite — automatisch beim Start | Node.js, kein Java/Docker |
| **Flyway Docker** | PG / MSSQL — vor App-Start | `docker compose --profile flyway up flyway` |
| **Flyway CLI** | lokal ohne Docker | `flyway migrate` |
| **`psql -f` / `sqlite3 <`** | Einmalige Scripts | Kein Migration-Tracking |
| ~~`prisma migrate`~~ | **Nicht verwendet** | Inkompatibel mit Multi-Dialect |

---

## 🆕 Neue DB bereitstellen

```bash
# SQLite — kein Setup, automatisch beim ersten Start
npm run dev

# PostgreSQL
docker compose -f src/infrastructure/db/docker/docker-compose.yml up -d
# oder manuell: bash src/infrastructure/db/migrations/setup-postgres.sh
npm run dev

# Bestehende Benutzer aus users.json importieren (Einmalig)
node scripts/migrate-users-json.mjs
```

---

## 🌐 ENV per API abrufen

| Endpoint | Gibt zurück |
|---|---|
| `GET /api/env` *(Admin)* | `DB_PROVIDER` |
| `GET /api/health/db` *(public)* | `{ ok, provider, url (maskiert), latencyMs }` |

`DATABASE_URL` wird nie zurückgegeben — Passwort-Schutz. Maskierte URL: `postgresql://zetlab:***@host/db`

---

## 💻 Befehle

```bash
# Migrationen (SQLite automatisch beim Start, oder manuell:)
npm run db:migrate:sqlite

# Prisma Studio (Web-GUI im Browser)
npm run db:studio

# SQLite CLI
sqlite3 data/orderentry.db

# SQLite-Backup
bash src/infrastructure/db/migrations/backup-sqlite.sh

# PostgreSQL Dev-Container
docker compose -f src/infrastructure/db/docker/docker-compose.yml up -d
docker compose -f src/infrastructure/db/docker/docker-compose.yml down
docker compose -f src/infrastructure/db/docker/docker-compose.yml down -v   # + Daten löschen
docker exec -it zetlab-postgres-dev psql -U zetlab -d orderentry

# PostgreSQL-Image manuell bauen
docker build -f src/infrastructure/db/docker/Dockerfile.postgres -t zetlab-postgres .
```

---

## ⚠️ Regeln

1. `prisma generate` läuft automatisch als `predev`/`prebuild`-Hook — nie manuell nötig.
2. `prisma migrate` wird **nicht** verwendet — Flyway ist das einzige Migrations-Tool.
3. `prisma/migrations/` ist in `.gitignore` — nicht committen.
4. SQLite nur für Einzelinstanz-Deployments — bei mehreren App-Instanzen → PostgreSQL.
5. Neustart erforderlich nach ENV-Änderungen.

[⬆ Back to top](#️-database-layer)
