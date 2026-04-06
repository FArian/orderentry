[← Zurück zum Projekt](../README.md)

---

# 🔧 Environment Variables — z2Lab OrderEntry

Vollständige Referenz aller Umgebungsvariablen der Applikation.

**Wo setzen:**
- **Docker:** `devops/docker/.env` → wird von `docker-compose.yml` eingelesen
- **Lokal (Dev):** `frontend/zetlab/.env.local` → wird von Next.js automatisch geladen
- **Vercel:** Vercel Dashboard → Settings → Environment Variables

**Wichtig:** `NEXT_PUBLIC_*` Variablen werden beim **Build** in den Client-Bundle eingebettet — sie können zur Laufzeit NICHT geändert werden. Alle anderen Variablen erfordern einen **Container-Neustart**.

**Schema-Endpoint:** `GET /api/env/schema` — listet alle konfigurierbaren Variablen mit Beschreibung und Default-Wert auf.

---

## 📋 Inhaltsverzeichnis

1. [FHIR — Server](#-fhir--server)
2. [FHIR — Authentifizierung](#-fhir--authentifizierung-outbound)
3. [FHIR — Identifier-System-URIs](#-fhir--identifier-system-uris)
4. [FHIR — Validierungsregex](#-fhir--validierungsregex-client-build-time)
5. [Authentifizierung](#-authentifizierung)
6. [Datenbank](#-datenbank)
7. [Logging](#-logging)
8. [Observability](#-observability-metrics--tracing)
9. [E-Mail](#-e-mail-smtp)
10. [Externe APIs](#-externe-apis)
11. [Orchestra / HL7](#-orchestra--hl7)
12. [Deep Link / KIS-Integration](#-deep-link--kis-integration)
13. [Sicherheit](#-sicherheit)
14. [Client-Build (NEXT_PUBLIC)](#-client-build-next_public)

---

## 🏥 FHIR — Server

| Variable | Default | Pflicht | Bedeutung |
|---|---|---|---|
| `FHIR_BASE_URL` | `http://localhost:8080/fhir` | ✅ | Base-URL des HAPI FHIR R4 Servers. Alle FHIR-Proxies und Mapper lesen hieraus. |

**Verwendung im FHIR:**
Alle Requests an HAPI FHIR werden über diese URL aufgebaut:
```
GET {FHIR_BASE_URL}/Patient?name=...
GET {FHIR_BASE_URL}/Practitioner?identifier=...
POST {FHIR_BASE_URL} (transaction bundle)
```

---

## 🔐 FHIR — Authentifizierung (Outbound)

Steuert wie OrderEntry sich gegenüber dem HAPI FHIR-Server authentifiziert.
Standard: `none` (HAPI läuft im internen Docker-Netz, kein Auth nötig).

| Variable | Default | Bedeutung |
|---|---|---|
| `FHIR_AUTH_TYPE` | `none` | Auth-Methode: `none` \| `bearer` \| `basic` \| `apiKey` \| `oauth2` \| `digest` |
| `FHIR_AUTH_TOKEN` | — | Bearer-Token (wenn `FHIR_AUTH_TYPE=bearer`) |
| `FHIR_AUTH_USER` | — | Benutzername (wenn `basic` oder `digest`) |
| `FHIR_AUTH_PASSWORD` | — | Passwort (wenn `basic` oder `digest`) — **secret** |
| `FHIR_AUTH_API_KEY_NAME` | — | Header-/Parameter-Name des API-Keys (wenn `apiKey`) |
| `FHIR_AUTH_API_KEY_VALUE` | — | API-Key-Wert (wenn `apiKey`) — **secret** |
| `FHIR_AUTH_API_KEY_LOCATION` | `header` | Übertragungsort: `header` oder `query` |
| `FHIR_AUTH_CLIENT_ID` | — | OAuth2 Client-ID (wenn `oauth2`) |
| `FHIR_AUTH_CLIENT_SECRET` | — | OAuth2 Client-Secret (wenn `oauth2`) — **secret** |
| `FHIR_AUTH_TOKEN_URL` | — | OAuth2 Token-Endpoint-URL (wenn `oauth2`) |
| `FHIR_AUTH_SCOPES` | — | OAuth2 Scopes, leerzeichen-getrennt (wenn `oauth2`) |

---

## 🔑 FHIR — Identifier-System-URIs

Alle FHIR-Identifier-System-URIs für Schweizer und globale Register.
**Alle können via ENV überschrieben werden** — default sind die offiziellen URIs (Stand 2025, korrekt).

| Variable | Default | Identifier-Typ | FHIR-Verwendung |
|---|---|---|---|
| `FHIR_SYSTEM_GLN` | `https://www.gs1.org/gln` | GS1 Global Location Number | `Practitioner.identifier`, `Organization.identifier`, FHIR-Suche `identifier=system\|value` |
| `FHIR_SYSTEM_AHV` | `urn:oid:2.16.756.5.32` | Schweizer AHV/AVS-Nummer | `Patient.identifier` |
| `FHIR_SYSTEM_VEKA` | `urn:oid:2.16.756.5.30.1.123.100.1.1` | Versicherungskartennummer (VeKa) | `Patient.identifier` |
| `FHIR_SYSTEM_ZSR` | `urn:oid:2.16.756.5.30.1.123.100.2.1.1` | santésuisse Zahlstellenregister | `Practitioner.identifier`, `Organization.identifier` |
| `FHIR_SYSTEM_UID` | `urn:oid:2.16.756.5.35` | Unternehmens-ID (CHE-xxx.xxx.xxx) | `Organization.identifier` |
| `FHIR_SYSTEM_BUR` | `urn:oid:2.16.756.5.45` | Betriebseinheitsnummer BFS | `Organization.identifier` |

**Beispiel: GLN-Suche im FHIR-Server**
```
GET {FHIR_BASE_URL}/Practitioner?identifier={FHIR_SYSTEM_GLN}|7601009336904&_count=1
GET {FHIR_BASE_URL}/Organization?identifier={FHIR_SYSTEM_GLN}|7601009336904&_count=1
```

**Wann überschreiben?**
Nur wenn sich ein offizieller Standard-URI ändert (sehr selten). Die Defaults sind seit Jahren stabil.

**Wo im Code:** `src/infrastructure/config/EnvConfig.ts` → `EnvConfig.fhirSystems`

---

## ✅ FHIR — Validierungsregex (Client, Build-Time)

Steuern die clientseitige Eingabevalidierung der Schweizer Identifikationsnummern.
**ACHTUNG:** `NEXT_PUBLIC_*` Variablen werden beim Docker-Build eingebettet (`--build-arg`).

| Variable | Default-Regex | Bedeutung |
|---|---|---|
| `NEXT_PUBLIC_REGEX_GLN` | `^\d{13}$` | 13-stellige EAN-13 Nummer |
| `NEXT_PUBLIC_REGEX_AHV` | `^756\d{10}$` | Beginnt mit 756, 13 Stellen total |
| `NEXT_PUBLIC_REGEX_VEKA` | `^80\d{18}$` | Beginnt mit 80, 20 Stellen total |
| `NEXT_PUBLIC_REGEX_UID` | `^CHE-\d{3}\.\d{3}\.\d{3}$` | Format CHE-123.456.789 |
| `NEXT_PUBLIC_REGEX_ZSR` | `^[A-Z]\d{6}$` | Buchstabe + 6 Ziffern (z.B. A123456) |
| `NEXT_PUBLIC_REGEX_BUR` | `^\d{8}$` | 8 Stellen |

**Wo im Code:** `src/shared/utils/swissValidators.ts`, `src/shared/config/AppConfig.ts`

---

## 🔒 Authentifizierung

| Variable | Default | Pflicht | Bedeutung |
|---|---|---|---|
| `AUTH_SECRET` | `dev-secret-change-me` | ✅ | HMAC-SHA256-Schlüssel für Session-Cookies. **Muss ≥32 Zeichen sein in Produktion.** |
| `ALLOW_LOCAL_AUTH` | `false` | — | Erlaubt unsigned `localSession`-Cookie (Browser-only Auth-Fallback für Dev) |
| `ORCHESTRA_JWT_SECRET` | — | — | Geteiltes HS256-Secret für `/api/launch` JWT-Validierung von Orchestra. Generieren: `openssl rand -hex 32` |
| `BOOTSTRAP_ADMIN_USER` | `admin` | — | Admin-Benutzername der beim ersten Start erstellt wird (wenn kein Admin existiert) |
| `BOOTSTRAP_ADMIN_PASSWORD` | `Admin1234!` | — | Admin-Passwort beim ersten Start — **sofort ändern nach dem Login!** |

---

## 🗄️ Datenbank

| Variable | Default | Bedeutung |
|---|---|---|
| `DB_PROVIDER` | `sqlite` | Datenbank-Engine: `sqlite` \| `postgresql` \| `sqlserver` |
| `DATABASE_URL` | `file:./data/orderentry.db` | Verbindungsstring. SQLite: `file:/app/data/orderentry.db`. PG: `postgresql://user:pwd@host:5432/db` |

**Hinweis:** SQLite-Migrationen laufen automatisch beim Start. PostgreSQL/MSSQL erfordern Flyway vorher.

---

## 📝 Logging

| Variable | Default | Bedeutung |
|---|---|---|
| `LOG_LEVEL` | `info` | Mindest-Log-Level: `debug` \| `info` \| `warn` \| `error` \| `silent` |
| `LOG_FILE` | — | Absoluter Pfad für persistente Log-Datei (JSON-Lines). Leer = deaktiviert. |

---

## 📊 Observability (Metrics & Tracing)

| Variable | Default | Bedeutung |
|---|---|---|
| `ENABLE_TRACING` | `false` | `true` = OpenTelemetry Distributed Tracing aktivieren. Erfordert `TRACING_URL`. |
| `TRACING_URL` | — | OTLP/HTTP Collector Base-URL (z.B. `http://jaeger:4318` oder `http://tempo:4318`) |
| `TRACING_LABEL` | — | Anzeigename des Tracing-Systems in der UI (z.B. `Jaeger`, `Tempo`) |
| `MONITORING_URL` | — | Dashboard-URL (z.B. Grafana) — nur als Link in der Settings-UI angezeigt |
| `MONITORING_LABEL` | — | Anzeigename des Monitoring-Systems (z.B. `Grafana`) |
| `METRICS_TOKEN` | — | Bearer-Token für Prometheus-Scraper (`GET /api/metrics`). Leer = Admin-Auth. Generieren: `openssl rand -hex 32` |

**Prometheus-Scrape-Konfiguration:**
```yaml
- job_name: z2lab
  static_configs:
    - targets: ["orderentry:3000"]
  metrics_path: /api/metrics
  bearer_token: "<METRICS_TOKEN>"
```

---

## 📧 E-Mail (SMTP)

| Variable | Default | Bedeutung |
|---|---|---|
| `MAIL_PROVIDER` | — | Provider aktivieren: `smtp` \| `hin` \| `smtp_oauth2` \| `google_workspace_relay` \| `gmail` (nur Dev). Leer = deaktiviert. |
| `MAIL_AUTH_TYPE` | `APP_PASSWORD` | Auth-Methode: `APP_PASSWORD` \| `OAUTH2` \| `NONE` |
| `MAIL_HOST` | — | SMTP-Server-Hostname (z.B. `smtp.office365.com`) |
| `MAIL_PORT` | `587` | SMTP-Port (587 = STARTTLS, 465 = TLS) |
| `MAIL_SECURE` | `false` | `true` = implizites TLS (Port 465); `false` = STARTTLS (Port 587) |
| `MAIL_USER` | — | Absender-E-Mail / SMTP-Benutzername |
| `MAIL_PASSWORD` | — | SMTP-Passwort oder Gmail App-Passwort — **secret** |
| `MAIL_FROM` | — | From-Adresse, z.B. `"OrderEntry <noreply@example.com>"` |
| `MAIL_ALIAS` | — | Reply-To / Alias-Adresse (optional) |
| `MAIL_DOMAIN` | — | Google Workspace Domain (nur `google_workspace_relay`) |
| `MAIL_OAUTH_CLIENT_ID` | — | OAuth2 Client-ID (wenn `MAIL_AUTH_TYPE=OAUTH2`) |
| `MAIL_OAUTH_CLIENT_SECRET` | — | OAuth2 Client-Secret — **secret** |
| `MAIL_OAUTH_REFRESH_TOKEN` | — | OAuth2 Refresh-Token (langlebig) — **secret** |

**Produktions-Provider:** `smtp` oder `hin`. `gmail` nur für Entwicklung, nicht nDSG-konform.

---

## 🌐 Externe APIs

| Variable | Default | Bedeutung |
|---|---|---|
| `SASIS_API_BASE` | — | SASIS/OFAC Base-URL für VeKa-Kartenlookup via Orchestra. Leer = deaktiviert. |
| `GLN_API_BASE` | `http://orchestra:8019/middleware/gln/api/versionVal/refdata/partner/` | GLN-Register Base-URL via Orchestra-Middleware. |

---

## 🎵 Orchestra / HL7

| Variable | Default | Bedeutung |
|---|---|---|
| `ORCHESTRA_HL7_BASE` | — | Base-URL der Orchestra HL7 HTTP-API (z.B. `http://orchestra:8019`). Leer = deaktiviert. |
| `ORCHESTRA_HL7_INBOUND_PATH` | `/api/v1/in/hl7` | Pfad auf Orchestra für eingehende HL7-Nachrichten (POST) |
| `ORCHESTRA_HL7_OUTBOUND_PATH` | `/api/v1/out/hl7` | Pfad auf Orchestra für ausgehende HL7-Resultate (GET) |

**Hinweis:** OrderEntry verarbeitet kein HL7 — es ist ein reiner HTTP-Proxy. Orchestra ist für alle SOAP-Kommunikation zuständig.

---

## 🔗 Deep Link / KIS-Integration

Ermöglicht externen KIS/PIS-Systemen direkt in den Auftragserfassungs-Workflow zu springen.

| Variable | Default | Bedeutung |
|---|---|---|
| `DEEPLINK_ENABLED` | `false` | `true` = Endpoint `GET /api/deeplink/order-entry` aktivieren |
| `DEEPLINK_AUTH_TYPE` | `jwt` | Token-Validierung: `jwt` \| `hmac` |
| `DEEPLINK_JWT_SECRET` | — | HS256-Secret für JWT-Tokens von externen Systemen (≥32 Zeichen) — **secret** |
| `DEEPLINK_HMAC_SECRET` | — | HMAC-SHA256-Secret für kanonische URL-Signaturen — **secret** |
| `DEEPLINK_TOKEN_MAX_AGE_SECONDS` | `300` | Maximales Token-Alter in Sekunden (Standard: 5 Minuten) |
| `DEEPLINK_ALLOWED_SYSTEMS` | — | Komma-getrennte Liste erlaubter Quell-System-Identifier. Leer = alle erlaubt. |

---

## 🛡️ Sicherheit

| Variable | Default | Bedeutung |
|---|---|---|
| `SESSION_IDLE_TIMEOUT_MINUTES` | `30` | Idle-Session-Timeout in Minuten. `0` = deaktiviert. Empfehlung für medizinische Software: 15–30 Min. |

---

## 🖥️ Client-Build (NEXT_PUBLIC_*)

Diese Variablen werden beim **Docker-Build** eingebettet (`--build-arg`). Zur Laufzeit nicht änderbar.

| Variable | Default | Bedeutung |
|---|---|---|
| `NEXT_PUBLIC_APP_VERSION` | auto | Wird automatisch von `scripts/write-version.mjs` aus Git-Metadaten generiert |
| `NEXT_PUBLIC_LAB_ORG_ID` | `zlz` | FHIR Organization-ID des Labors (Auftragnehmer). Für Testkatalog-Filter. |
| `NEXT_PUBLIC_FORCE_LOCAL_AUTH` | `false` | Browser-only Auth erzwingen (kein Server-Session-Cookie) |
| `NEXT_PUBLIC_SASIS_ENABLED` | `false` | `true` = VeKa-Karten-Lookup in der UI anzeigen |
| `NEXT_PUBLIC_GLN_ENABLED` | `false` | `true` = GLN-Lookup in der UI anzeigen |

**Docker Build-Befehl mit NEXT_PUBLIC_* Variablen:**
```bash
docker buildx build \
  --build-arg NEXT_PUBLIC_LAB_ORG_ID=zlz \
  --build-arg NEXT_PUBLIC_SASIS_ENABLED=true \
  --build-arg NEXT_PUBLIC_GLN_ENABLED=true \
  -t farian/orderentry:latest \
  -f docker/Dockerfile \
  .
```

---

## 🔍 Schema-Endpoint aufrufen

Alle konfigurierbaren Server-Variablen mit Beschreibung, Default und Gruppe:

```bash
# Mit Admin-Session (Cookie)
curl -s https://orderentry.z2lab.ddns.net/api/env/schema \
  -H "Cookie: session=<dein-session-cookie>" | jq .

# Oder in der Admin-UI:
# https://orderentry.z2lab.ddns.net/admin/api → Abschnitt "ENV Schema"
```

**Antwort-Format:**
```json
[
  {
    "key": "FHIR_SYSTEM_GLN",
    "description": "FHIR identifier system URI for GS1 Global Location Number (GLN).",
    "default": "https://www.gs1.org/gln",
    "required": false,
    "writable": true,
    "restartRequired": true,
    "secret": false,
    "group": "FHIR"
  }
]
```

---

## ⚠️ Wichtige Regeln

1. **Secrets niemals committen** — `.env` und `.env.local` sind in `.gitignore`
2. **`NEXT_PUBLIC_*` = Build-Zeit** — Änderungen erfordern einen neuen Docker-Build mit `--build-arg`
3. **Server-Variablen = Neustart** — Nach Änderung in `.env.local` Container neustarten
4. **`AUTH_SECRET` muss ≥32 Zeichen** sein — in Produktion mit `openssl rand -hex 32` generieren
5. **`BOOTSTRAP_ADMIN_PASSWORD` sofort ändern** nach dem ersten Login
6. **Secrets** (PASSWORD, SECRET, TOKEN, PRIVATE) erscheinen nie in `GET /api/env` — nur im Schema als Typ-Info

---

[⬆ Back to top](#)
