#!/usr/bin/env bash
# =============================================================================
# backup-sqlite.sh — SQLite-Datenbank sichern
#
# Verwendung:
#   bash src/infrastructure/db/migrations/backup-sqlite.sh [db-pfad] [backup-verzeichnis]
#
# Beispiele:
#   bash src/infrastructure/db/migrations/backup-sqlite.sh
#   bash src/infrastructure/db/migrations/backup-sqlite.sh /app/data/orderentry.db /backups
#
# Das Backup verwendet SQLite's `.backup`-Befehl — sicher auch bei laufender App.
# =============================================================================

set -euo pipefail

DB_PATH="${1:-./data/orderentry.db}"
BACKUP_DIR="${2:-./data/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/orderentry_$TIMESTAMP.db"

if [ ! -f "$DB_PATH" ]; then
  echo "Fehler: DB-Datei nicht gefunden: $DB_PATH"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "→ Erstelle Backup..."
echo "  Quelle : $DB_PATH"
echo "  Ziel   : $BACKUP_FILE"

# .backup ist transaktionssicher — funktioniert auch bei laufendem WAL-Modus
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "✓ Backup erstellt ($SIZE): $BACKUP_FILE"

# Alte Backups aufräumen — nur die letzten 10 behalten
KEPT=$(ls -t "$BACKUP_DIR"/orderentry_*.db 2>/dev/null | head -10)
ls "$BACKUP_DIR"/orderentry_*.db 2>/dev/null | grep -vxF "$KEPT" | xargs -r rm --
echo "  (Ältere Backups bereinigt — 10 neueste behalten)"
