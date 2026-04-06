# PostgreSQL — Setup & Betrieb

Empfohlen für Produktiv-Deployments mit Docker Compose.

## Konfiguration

```env
ORDERENTRY_DB__PROVIDER=postgresql
DATABASE_URL="postgresql://zetlab:geheimesPasswort@localhost:5432/orderentry"
```

### URL-Format

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&sslmode=prefer
```

| Parameter | Wert | Beschreibung |
|---|---|---|
| `USER` | z.B. `zetlab` | DB-Benutzer |
| `PASSWORD` | — | Niemals ins Git committen |
| `HOST` | `localhost` / `postgres` (Docker) | DB-Hostname |
| `PORT` | `5432` | Standard PostgreSQL-Port |
| `DATABASE` | `orderentry` | Datenbankname |
| `sslmode` | `prefer` / `require` | TLS-Modus |

## Docker Compose Setup

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB:       orderentry
      POSTGRES_USER:     zetlab
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zetlab"]
      interval: 10s
      retries: 5

  orderentry:
    environment:
      ORDERENTRY_DB__PROVIDER: postgresql
      DATABASE_URL: postgresql://zetlab:${POSTGRES_PASSWORD}@postgres:5432/orderentry
    depends_on:
      postgres:
        condition: service_healthy
```

## Erstes Setup

```bash
# 1. PostgreSQL läuft (Docker oder lokal)

# 2. Datenbank erstellen (falls nicht via Docker)
psql -U postgres -c "CREATE DATABASE orderentry;"
psql -U postgres -c "CREATE USER zetlab WITH PASSWORD 'geheim';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE orderentry TO zetlab;"

# 3. Schema anwenden
DATABASE_URL="postgresql://zetlab:geheim@localhost:5432/orderentry" \
npx prisma migrate deploy

# 4. Client generieren
npx prisma generate
```

## Migration

```bash
# Neue Migration erstellen (Dev)
npx prisma migrate dev --name beschreibung

# Migration in Prod anwenden
npx prisma migrate deploy
```

## Flyway (Alternative für Prod)

Flyway-Migrations liegen in `flyway/migrations/postgresql/`.

```bash
docker run --rm \
  -v $(pwd)/flyway/migrations/postgresql:/flyway/sql \
  flyway/flyway:9 \
  -url=jdbc:postgresql://host:5432/orderentry \
  -user=zetlab -password=geheim \
  migrate
```

## Verbindung prüfen

```bash
# Direkt
psql "postgresql://zetlab:geheim@localhost:5432/orderentry" -c "SELECT version();"

# Via App
GET /api/health/db   (Admin-Login erforderlich)
```

## Tuning

| Parameter | Empfehlung | Beschreibung |
|---|---|---|
| `max_connections` | 100 | Erhöhen wenn viele gleichzeitige Requests |
| `shared_buffers` | 25% RAM | Query-Cache |
| `work_mem` | 4MB–64MB | Sort/Join-Speicher |
| `connection_limit` im URL | `?connection_limit=5` | Prisma-Pool begrenzen |

## Backup

```bash
pg_dump -U zetlab -h localhost orderentry > backup_$(date +%Y%m%d).sql
pg_restore -U zetlab -h localhost -d orderentry backup_20260401.sql
```
