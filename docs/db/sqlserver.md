# SQL Server / MariaDB — Setup & Betrieb

## SQL Server (Microsoft)

### Konfiguration

```env
ORDERENTRY_DB__PROVIDER=sqlserver
DATABASE_URL="sqlserver://HOST:1433;database=orderentry;user=zetlab;password=Geheim1!;trustServerCertificate=true"
```

### URL-Format

```
sqlserver://HOST:PORT;database=DB;user=USER;password=PWD;trustServerCertificate=true
```

`trustServerCertificate=true` ist für selbst-signierte Zertifikate (intern) nötig.
In Produktion mit gültigem Zertifikat auf `false` setzen.

### Setup

```sql
-- In SQL Server Management Studio oder sqlcmd:
CREATE DATABASE orderentry;
CREATE LOGIN zetlab WITH PASSWORD = 'Geheim1!';
USE orderentry;
CREATE USER zetlab FOR LOGIN zetlab;
ALTER ROLE db_owner ADD MEMBER zetlab;
```

```bash
npx prisma migrate deploy
npx prisma generate
```

### Flyway

```bash
docker run --rm \
  -v $(pwd)/flyway/migrations/sqlserver:/flyway/sql \
  flyway/flyway:9 \
  -url="jdbc:sqlserver://host:1433;databaseName=orderentry;trustServerCertificate=true" \
  -user=zetlab -password=Geheim1! \
  migrate
```

---

## MariaDB / MySQL

> ⚠️ Prisma unterstützt MariaDB via den MySQL-Provider. Vollständige Kompatibilität
> ist nicht garantiert — bevorzuge PostgreSQL für neue Deployments.

### Konfiguration

```env
# Prisma-Provider bleibt "mysql" (Prisma-intern)
# ORDERENTRY_DB__PROVIDER=mysql wird noch nicht unterstützt → postgresql als Alias
DATABASE_URL="mysql://zetlab:geheim@localhost:3306/orderentry"
```

> **Achtung:** Der `schema.prisma`-Provider muss auf `mysql` geändert werden —
> Prisma und MySQL/MariaDB sind nicht über `sqlserver` kompatibel.

### Setup

```sql
CREATE DATABASE orderentry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'zetlab'@'%' IDENTIFIED BY 'geheim';
GRANT ALL PRIVILEGES ON orderentry.* TO 'zetlab'@'%';
FLUSH PRIVILEGES;
```

```bash
npx prisma migrate deploy
```

### Bekannte Einschränkungen mit MariaDB

| Problem | Lösung |
|---|---|
| `Row size too large` | `ROW_FORMAT=DYNAMIC` in MariaDB-Config |
| `utf8` statt `utf8mb4` | `CHARACTER SET utf8mb4` beim CREATE DATABASE |
| Kein `RETURNING` Support | Prisma arbeitet mit separatem SELECT nach INSERT |
