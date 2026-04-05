/**
 * Prisma error classifier.
 *
 * Translates Prisma client error codes into human-readable diagnostics with
 * actionable remediation steps. Used in API routes and the health endpoint
 * to surface DB problems clearly instead of leaking stack traces.
 *
 * Reference: https://www.prisma.io/docs/reference/api-reference/error-reference
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type DbErrorSeverity = "fatal" | "config" | "schema" | "data";

export interface DbErrorDiagnosis {
  /** Prisma error code (e.g. "P2022") or "UNKNOWN". */
  code: string;
  /** Severity category. */
  severity: DbErrorSeverity;
  /** Short title shown in UIs and logs. */
  title: string;
  /** Full explanation of what went wrong. */
  detail: string;
  /** Ordered list of remediation steps the operator should follow. */
  steps: string[];
  /** Which DB providers are affected (undefined = all). */
  providers?: string[];
}

// ── Prisma error shape (minimal — only what we need) ──────────────────────────

interface PrismaClientError {
  code?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

function isPrismaError(err: unknown): err is PrismaClientError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as Record<string, unknown>).code === "string"
  );
}

// ── Classifier ────────────────────────────────────────────────────────────────

/**
 * Classify a caught error into a structured diagnosis.
 * Always returns a result — never throws.
 */
export function classifyPrismaError(err: unknown): DbErrorDiagnosis {
  if (!isPrismaError(err)) {
    return unknownDiagnosis(err);
  }

  const code = err.code ?? "UNKNOWN";
  const meta = err.meta ?? {};

  switch (code) {
    // ── Connection errors ────────────────────────────────────────────────────
    case "P1001":
      return {
        code, severity: "fatal",
        title: "Datenbankserver nicht erreichbar",
        detail: "Der Datenbankserver antwortet nicht. Entweder läuft er nicht oder die Adresse ist falsch.",
        steps: [
          "Prüfen ob der DB-Server läuft (z.B. `docker ps` oder `systemctl status postgresql`)",
          "DATABASE_URL auf korrekte Host/Port-Kombination prüfen",
          "Firewall-Regeln zwischen App und DB prüfen",
          "Für SQLite: Prüfen ob die .db-Datei am konfigurierten Pfad existiert",
        ],
      };

    case "P1002":
      return {
        code, severity: "fatal",
        title: "Datenbankverbindung Timeout",
        detail: "Der Server wurde erreicht, hat aber nicht rechtzeitig geantwortet.",
        steps: [
          "DB-Server-Last prüfen (CPU, Speicher, Verbindungsanzahl)",
          "Verbindungs-Timeout in DATABASE_URL erhöhen (z.B. `connect_timeout=30`)",
          "Für PostgreSQL: max_connections und pg_stat_activity prüfen",
        ],
      };

    case "P1003":
      return {
        code, severity: "config",
        title: "Datenbank existiert nicht",
        detail: `Die Datenbank "${String(meta.database_name ?? "")}" wurde nicht gefunden.`,
        steps: [
          "Für SQLite: Prüfen ob der Ordner `prisma/data/` existiert und beschreibbar ist",
          "Für PostgreSQL/MariaDB: Datenbank manuell erstellen: `CREATE DATABASE orderentry;`",
          "DATABASE_URL auf korrekte Datenbankname prüfen",
          "`npx prisma migrate deploy` ausführen um Schema + Daten anzulegen",
        ],
      };

    case "P1008":
      return {
        code, severity: "fatal",
        title: "Datenbank-Operation Timeout",
        detail: "Eine DB-Abfrage hat das Timeout überschritten.",
        steps: [
          "DB-Server-Performance prüfen",
          "Langsame Abfragen im DB-Log identifizieren",
          "Für PostgreSQL: `EXPLAIN ANALYZE` auf betroffene Queries ausführen",
        ],
      };

    case "P1010":
      return {
        code, severity: "config",
        title: "Datenbankzugriff verweigert",
        detail: "Der Datenbankbenutzer hat keine Berechtigung.",
        steps: [
          "Benutzername und Passwort in DATABASE_URL prüfen",
          "Für PostgreSQL: `GRANT ALL PRIVILEGES ON DATABASE orderentry TO username;`",
          "Für MariaDB: `GRANT ALL ON orderentry.* TO 'user'@'host';`",
        ],
        providers: ["postgresql", "mysql", "sqlserver"],
      };

    case "P1017":
      return {
        code, severity: "fatal",
        title: "Datenbankserver hat Verbindung geschlossen",
        detail: "Der Server hat die Verbindung unerwartet beendet.",
        steps: [
          "DB-Server-Logs auf Fehler prüfen",
          "Verbindungslimit prüfen (max_connections bei PostgreSQL)",
          "App neu starten — Prisma-Connection-Pool neu aufbauen",
        ],
      };

    // ── Schema errors ─────────────────────────────────────────────────────────
    case "P2021": {
      const table = String(meta.table ?? "unbekannte Tabelle");
      return {
        code, severity: "schema",
        title: `Tabelle fehlt: ${table}`,
        detail: `Die Tabelle "${table}" existiert nicht in der Datenbank. Migration wurde wahrscheinlich nicht ausgeführt.`,
        steps: [
          "Dev:  `npx prisma migrate dev` ausführen",
          "Prod: `npx prisma migrate deploy` ausführen",
          "Prüfen ob DATABASE_URL auf die richtige Datenbankdatei zeigt",
          "Für SQLite: Pfad relativ zur schema.prisma-Datei prüfen",
        ],
      };
    }

    case "P2022": {
      const column = String(meta.column ?? "unbekannte Spalte");
      return {
        code, severity: "schema",
        title: `Spalte fehlt: ${column}`,
        detail: `Die Spalte "${column}" existiert nicht. Eine neue Migration wurde zum Schema hinzugefügt aber noch nicht auf die Datenbank angewendet.`,
        steps: [
          "1. Dev-Server stoppen",
          "2. `npx prisma generate` ausführen (Client neu generieren)",
          "3. `npx prisma migrate deploy` oder Migration manuell anwenden",
          "4. .next-Cache löschen: `Remove-Item -Recurse -Force .next`",
          "5. Dev-Server neu starten: `npm run dev`",
          `Betroffene Spalte: ${column}`,
        ],
      };
    }

    // ── Data errors ───────────────────────────────────────────────────────────
    case "P2002": {
      const target = String(meta.target ?? "");
      return {
        code, severity: "data",
        title: "Eindeutigkeitsverletzung",
        detail: `Ein Datensatz mit diesem Wert existiert bereits (Unique Constraint: ${target}).`,
        steps: [
          "Den duplizierten Wert ändern (z.B. anderen Benutzernamen wählen)",
          "Bestehende Einträge mit diesem Wert zuerst löschen",
        ],
      };
    }

    case "P2025":
      return {
        code, severity: "data",
        title: "Datensatz nicht gefunden",
        detail: "Der gesuchte Datensatz existiert nicht (mehr) in der Datenbank.",
        steps: [
          "ID/Username prüfen",
          "Datensatz wurde möglicherweise von einem anderen Prozess gelöscht",
        ],
      };

    default:
      return unknownDiagnosis(err);
  }
}

function unknownDiagnosis(err: unknown): DbErrorDiagnosis {
  const message = err instanceof Error ? err.message : String(err);
  const code = isPrismaError(err) ? (err.code ?? "UNKNOWN") : "UNKNOWN";
  return {
    code,
    severity: "fatal",
    title: "Unbekannter Datenbankfehler",
    detail: message,
    steps: [
      "Server-Logs prüfen für vollständigen Stack-Trace",
      "DB-Server-Status prüfen",
      "App neu starten",
      "Falls das Problem anhält: GitHub Issue mit dem Fehlercode öffnen",
    ],
  };
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** True when the error is a Prisma schema error (missing table/column). */
export function isSchemaError(err: unknown): boolean {
  if (!isPrismaError(err)) return false;
  return err.code === "P2021" || err.code === "P2022";
}

/** True when the error is a Prisma connection error. */
export function isConnectionError(err: unknown): boolean {
  if (!isPrismaError(err)) return false;
  const connectionCodes = ["P1001", "P1002", "P1003", "P1008", "P1010", "P1017"];
  return connectionCodes.includes(err.code ?? "");
}
