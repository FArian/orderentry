#!/usr/bin/env bash
# =============================================================================
# setup-postgres.sh — Neue PostgreSQL-Datenbank für z2Lab OrderEntry anlegen
#
# Verwendung:
#   bash src/infrastructure/db/migrations/setup-postgres.sh [host] [port] [superuser]
#
# Beispiele:
#   bash src/infrastructure/db/migrations/setup-postgres.sh
#   bash src/infrastructure/db/migrations/setup-postgres.sh localhost 5432 postgres
#   PGPASSWORD=secret bash src/infrastructure/db/migrations/setup-postgres.sh prod-host
#
# Voraussetzungen: psql muss installiert und im PATH sein.
# =============================================================================

set -euo pipefail

PG_HOST="${1:-localhost}"
PG_PORT="${2:-5432}"
PG_SUPERUSER="${3:-postgres}"

DB_NAME="orderentry"
DB_USER="zetlab"
DB_PASS="zetlab"   # In Produktion durch starkes Passwort ersetzen!

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   z2Lab OrderEntry — PostgreSQL Setup        ║"
echo "╚══════════════════════════════════════════════╝"
echo "  Host  : $PG_HOST:$PG_PORT"
echo "  DB    : $DB_NAME"
echo "  User  : $DB_USER"
echo ""

PSQL="psql -h $PG_HOST -p $PG_PORT -U $PG_SUPERUSER"

# ── User anlegen ──────────────────────────────────────────────────────────────
echo "→ Erstelle User '$DB_USER'..."
$PSQL -c "DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
    RAISE NOTICE 'User $DB_USER erstellt.';
  ELSE
    RAISE NOTICE 'User $DB_USER existiert bereits — übersprungen.';
  END IF;
END
\$\$;" postgres

# ── Datenbank anlegen ─────────────────────────────────────────────────────────
echo "→ Erstelle Datenbank '$DB_NAME'..."
$PSQL -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" postgres \
  | grep -q 1 && echo "  Datenbank existiert bereits — übersprungen." || \
  $PSQL -c "CREATE DATABASE $DB_NAME OWNER $DB_USER ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8';" postgres

# ── Berechtigungen ────────────────────────────────────────────────────────────
echo "→ Setze Berechtigungen..."
$PSQL -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
$PSQL -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

echo ""
echo "✓ Setup abgeschlossen."
echo ""
echo "  Nächste Schritte:"
echo "  1. Migrationsdateien ausführen:"
echo "     docker compose --profile flyway up flyway"
echo "     — oder —"
echo "     npm run db:migrate:pg"
echo ""
echo "  2. ENV setzen:"
echo "     DB_PROVIDER=postgresql"
echo "     DATABASE_URL=postgresql://$DB_USER:$DB_PASS@$PG_HOST:$PG_PORT/$DB_NAME"
echo ""
