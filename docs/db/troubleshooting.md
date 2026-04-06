# Datenbank — Fehlerbehebung

## Schnelldiagnose

```
GET /api/health/db   (Admin-Login erforderlich)
```

Gibt strukturierten JSON-Report mit Status, fehlenden Spalten und Schritt-für-Schritt-Anleitung zurück.

---

## Prisma Fehler-Codes

### P2022 — Spalte fehlt

```
The column `main.User.extraPermissions` does not exist in the current database.
```

**Ursache:** Eine neue Migration wurde zum Schema hinzugefügt, aber nicht auf die Datenbank angewendet. Häufig nach `git pull` oder nach dem Hinzufügen einer neuen Funktion.

**Lösung:**

```bash
# 1. Dev-Server stoppen (Ctrl+C)
# 2. Prisma-Client neu generieren
npx prisma generate
# 3. Migration anwenden
npx prisma migrate deploy
# 4. .next-Cache löschen (Windows PowerShell)
Remove-Item -Recurse -Force .next
# 5. Dev-Server neu starten
npm run dev
```

**Manuell (SQLite, wenn migrate deploy fehlschlägt):**

```bash
node -e "
const D = require('better-sqlite3');
const db = new D('./data/orderentry.db');
db.exec('ALTER TABLE \"User\" ADD COLUMN \"extraPermissions\" TEXT NOT NULL DEFAULT \"[]\"');
db.close(); console.log('OK');
"
```

> **SQLite-Pfad:** Prisma löst `file:` Pfade relativ zur `prisma/schema.prisma` auf.
> Die tatsächlich verwendete DB-Datei zeigt `GET /api/health/db` unter `databaseUrl`.

---

### P2021 — Tabelle fehlt

```
The table `main.User` does not exist in the current database.
```

**Ursache:** Datenbank wurde neu erstellt, aber Migrations wurden nie ausgeführt.

```bash
npx prisma migrate deploy
```

---

### P1001 — Datenbankserver nicht erreichbar

```
Can't reach database server at `localhost:5432`
```

**Checkliste:**
- [ ] DB-Dienst läuft? `docker ps` oder `systemctl status postgresql`
- [ ] HOST in `DATABASE_URL` korrekt? (Docker: Servicename statt `localhost`)
- [ ] PORT offen? `telnet HOST 5432`
- [ ] Firewall-Regel vorhanden?

---

### P1003 — Datenbank existiert nicht

```
Database `orderentry` does not exist at `localhost:5432`
```

```sql
-- PostgreSQL
CREATE DATABASE orderentry;

-- MariaDB/MySQL
CREATE DATABASE orderentry CHARACTER SET utf8mb4;
```

Danach: `npx prisma migrate deploy`

---

### P1010 — Zugriff verweigert

```
User `zetlab` was denied access on the database `orderentry`
```

```sql
-- PostgreSQL
GRANT ALL PRIVILEGES ON DATABASE orderentry TO zetlab;

-- MariaDB
GRANT ALL ON orderentry.* TO 'zetlab'@'%';
FLUSH PRIVILEGES;
```

---

### P3005 — Migration-Baseline fehlt

```
The database schema is not empty. Read more about how to baseline an existing production database.
```

**Ursache:** DB hat Daten, aber keine Prisma-Migrations-Tabelle (existierende DB wird zum ersten Mal mit Prisma verwaltet).

```bash
# Baseline erstellen (zeigt Prisma dass Migrations bereits applied sind)
npx prisma migrate resolve --applied 20260101000000_init
```

---

## Windows-spezifische Probleme

### DLL-Lock bei `prisma generate`

```
EPERM: operation not permitted, rename ... query_engine-windows.dll.node
```

**Ursache:** Dev-Server hält die Prisma-Engine-DLL gesperrt.

**Lösung:** Dev-Server stoppen → `npx prisma generate` → Dev-Server neu starten.

---

### `.env.local` Schreiben schlägt fehl (OneDrive)

Projekt liegt in OneDrive → OneDrive-Sync-Prozess kann die Datei sperren.

**Alternativen:**
1. ENV-Variablen als Windows-Systemvariablen setzen (bleibt persistent)
2. DB-Datei ausserhalb OneDrive ablegen: `DATABASE_URL=file:C:/ProgramData/zetlab/orderentry.db`
3. Für `npm run dev`: Variablen im Terminal-Start übergeben:
   ```powershell
   $env:DATABASE_URL="file:C:/ProgramData/zetlab/orderentry.db"; npm run dev
   ```

---

### Zwei verschiedene DB-Dateien (häufiger Fehler)

Symptom: Migration erfolgreich, Fehler bleibt.

**Ursache:** `.env` und `.env.local` haben unterschiedliche `DATABASE_URL` die auf verschiedene Dateien zeigen. Der Patch wurde an der falschen Datei vorgenommen.

**Diagnose:**
```bash
node -e "
const fs = require('fs');
['.env.local', '.env'].forEach(f => {
  try {
    const m = fs.readFileSync(f,'utf8').match(/DATABASE_URL=(.+)/);
    if (m) console.log(f + ': ' + m[1]);
  } catch {}
});
"
```

Die tatsächlich von Prisma verwendete Datei zeigt `GET /api/health/db`.

---

## Nützliche Befehle

```bash
# Schema-Status anzeigen
npx prisma migrate status

# DB direkt öffnen (SQLite)
npx prisma studio

# Alle Tabellen anzeigen (SQLite)
node -e "
const D=require('better-sqlite3');
const db=new D('./data/orderentry.db');
console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=\"table\"').all());
db.close();
"

# Spalten einer Tabelle anzeigen (SQLite)
node -e "
const D=require('better-sqlite3');
const db=new D('./data/orderentry.db');
console.log(db.prepare('PRAGMA table_info(\"User\")').all().map(c=>c.name));
db.close();
"
```
