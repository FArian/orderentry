# SQLite — Setup & Betrieb

Standard-Provider für lokale Entwicklung und Einzel-Server-Deployments.
Kein zusätzlicher Datenbankdienst nötig — die Datei wird automatisch erstellt.

## Konfiguration

```env
ORDERENTRY_DB__PROVIDER=sqlite
DATABASE_URL="file:../data/orderentry.db"
```

> **Pfad-Regel:** `file:` ist relativ zur `prisma/schema.prisma`.
> `../data/` zeigt auf `frontend/zetlab/data/orderentry.db`.

## Erstes Setup

```bash
cd frontend/zetlab

# 1. Ordner anlegen
mkdir -p data

# 2. Schema auf DB anwenden
npx prisma migrate deploy

# 3. Prisma-Client generieren
npx prisma generate

# 4. App starten
npm run dev
```

## Migration hinzufügen

```bash
# Neue Spalte/Tabelle in prisma/schema.prisma eintragen, dann:
npx prisma migrate dev --name add_extra_permissions

# Erzeugt: prisma/migrations/20260405_add_extra_permissions/migration.sql
# Wendet sie sofort auf die Dev-DB an.
```

## Manuelle Migration (Notfall)

Wenn `prisma migrate` nicht läuft (z.B. DLL-Lock auf Windows):

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/orderentry.db');
db.exec('ALTER TABLE \"User\" ADD COLUMN \"extraPermissions\" TEXT NOT NULL DEFAULT \"[]\"');
db.close();
console.log('OK');
"
```

## Backup

```bash
# Einfache Kopie
cp data/orderentry.db data/orderentry.db.bak

# Mit Timestamp
cp data/orderentry.db "data/orderentry_$(date +%Y%m%d_%H%M%S).db.bak"
```

## Bekannte Einschränkungen

| Einschränkung | Auswirkung |
|---|---|
| Kein `ALTER COLUMN` | Spaltentypen können nicht nachträglich geändert werden |
| Kein `DROP COLUMN` (SQLite < 3.35) | Prisma erzeugt neue Tabelle + Datenmigration |
| Kein Netzwerkzugriff | Nur ein Prozess gleichzeitig (kein Multi-Node) |
| Windows DLL-Lock | `prisma generate` erfordert gestoppten Dev-Server |

## Windows + OneDrive

Wenn das Projekt in OneDrive liegt:
- `.env.local`-Writes via UI können fehlschlagen (OneDrive-Sync-Lock)
- DB-Datei besser in `C:\ProgramData\zetlab\` oder ähnlichem Nicht-OneDrive-Pfad ablegen
- `DATABASE_URL` dann als absoluten Pfad setzen: `file:C:/ProgramData/zetlab/orderentry.db`
