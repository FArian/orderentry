# ZetLab Local Agent

Dieses Verzeichnis dokumentiert die Architektur und den Entwicklungsstand
des **Local Agent** — der Brücke zwischen Klinik/Praxis (lokal) und
OrderEntry (Cloud).

---

## Gesamtarchitektur

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   CLOUD                                      │
│                                                                              │
│   ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐  │
│   │                  │      │                  │      │                  │  │
│   │   OrderEntry     │◄────►│    Orchestra     │◄────►│   HAPI FHIR      │  │
│   │   (Vercel)       │      │  (Integration    │      │   (Cloud)        │  │
│   │                  │      │    Server)       │      │                  │  │
│   │  /proxy/hl7/     │      │  ADT  → Patient  │      │  Patient         │  │
│   │  inbound         │      │  ORU  → DiagRep  │      │  DiagnosticRep.  │  │
│   │  outbound        │      │  ORM  → HL7      │      │  ServiceRequest  │  │
│   │  /agent/jobs     │      │                  │      │                  │  │
│   │  /agent/status   │      │                  │      │                  │  │
│   └────────┬─────────┘      └────────┬─────────┘      └──────────────────┘  │
│            │                         │                                       │
└────────────┼─────────────────────────┼───────────────────────────────────────┘
             │                         │
             │ HTTPS outbound only      │ HL7 ORM/ORU
             │ kein Port-Forwarding     │ (bereits verbunden)
             │                         │
┌────────────▼─────────────┐  ┌────────▼─────────────────────────────────────┐
│   KLINIK / PRAXIS         │  │   LABOR                                       │
│                           │  │                                               │
│  ┌──────────────────────┐ │  │   LIS / Vianova                               │
│  │   LOCAL AGENT         │ │  │                                               │
│  │   (Binary / Docker)   │ │  │   ◄── HL7 ORM  (Aufträge rein)               │
│  │                       │ │  │   ──► HL7 ORU  (Befunde raus)                │
│  │  1. Dir Watcher       │ │  │                                               │
│  │  /adt/*.hl7 → Cloud   │ │  └──────────────────────────────────────────────┘
│  │                       │ │
│  │  2. ORU File Writer   │ │
│  │  Cloud → /oru/*.hl7   │ │
│  │  Cloud → /pdf/*.pdf   │ │
│  │                       │ │
│  │  3. Print Client      │ │
│  │  PDF  → Drucker       │ │
│  │  ZPL  → Zebra/Dymo    │ │
│  └──────────┬────────────┘ │
│             │               │
│   ┌─────────▼────────────┐  │
│   │   PIS / KIS          │  │
│   │                      │  │
│   │  legt ADT ab         │  │
│   │  liest ORU ein       │  │
│   │  druckt Begleitschein│  │
│   └──────────────────────┘  │
└──────────────────────────────┘
```

---

## Verbindungspunkte

| Seite | Verbindung | Status |
|---|---|---|
| **Orchestra → LIS** | HL7 ORM/ORU (Labor) | ✅ bereits vorhanden |
| **OrderEntry → HAPI FHIR** | FHIR Proxy Routes | ✅ bereits gebaut |
| **Agent → Klinik/PIS** | Directory + Druck + ORU | 🔜 noch zu bauen |

---

## Agent — 3 Aufgaben

| # | Aufgabe | Richtung | Protokoll |
|---|---|---|---|
| 1 | **ADT empfangen** | Klinik/Dir → Cloud | POST /api/v1/proxy/hl7/inbound |
| 2 | **ORU/PDF liefern** | Cloud → Klinik/Dir | GET /api/v1/proxy/hl7/outbound |
| 3 | **Drucken** | Cloud → lokaler Drucker | GET /api/v1/agent/jobs (print) |

**Polling-Prinzip:** Agent verbindet sich nur ausgehend (outbound-only).
Kein Port-Forwarding, keine Firewall-Änderungen nötig.

---

## Deployment-Varianten

### Modell 2 — Agent (Standard: Praxen + kleine Kliniken)

```
Cloud:  OrderEntry + Orchestra + HAPI FHIR
Lokal:  NUR Agent (1 Binary oder 1 Docker Container)
```

- Windows: `zetlab-agent.exe` als Windows Service
- macOS: `zetlab-agent` als LaunchAgent
- Linux: `zetlab-agent` als systemd Service
- Docker: `docker run zetlab/agent` (wo Docker verfügbar)

### Modell 3 — Hybrid (grosse Kliniken mit Datenschutz)

```
Cloud:  OrderEntry UI + Orchestra
Lokal:  HAPI FHIR (Patientendaten bleiben lokal) + Agent
        Verbindung via Cloudflare Tunnel (kein Port-Forwarding)
```

---

## Was bereits in OrderEntry gebaut ist ✅

### Agent API Routes

| Route | Methode | Funktion | Status |
|---|---|---|---|
| `/api/v1/agent/status` | GET | Connectivity-Check, Token-Validierung, HL7-Proxy-Status | ✅ |
| `/api/v1/agent/token` | POST | JWT/PAT Token für Agent-Auth | ✅ |

### HL7 Proxy Routes

| Route | Methode | Funktion | Status |
|---|---|---|---|
| `/api/v1/proxy/hl7/inbound` | POST | HL7 von Agent → Orchestra (ADT, ORU) | ✅ |
| `/api/v1/proxy/hl7/outbound` | GET | HL7 von Orchestra → Agent (ORU, polling) | ✅ |

### FHIR Proxy Routes

| Route | Methode | Funktion | Status |
|---|---|---|---|
| `/api/v1/proxy/fhir/patients` | GET | Patientenliste | ✅ |
| `/api/v1/proxy/fhir/patients/[id]` | GET | Einzelpatient | ✅ |
| `/api/v1/proxy/fhir/patients/[id]/service-requests` | GET | Aufträge je Patient | ✅ |
| `/api/v1/proxy/fhir/patients/[id]/diagnostic-reports` | GET | Befunde je Patient | ✅ |
| `/api/v1/proxy/fhir/service-requests` | GET | Alle Aufträge | ✅ |
| `/api/v1/proxy/fhir/service-requests/[id]` | GET | Einzelauftrag | ✅ |
| `/api/v1/proxy/fhir/diagnostic-reports` | GET | Alle Befunde | ✅ |

### Auth (für Agent nutzbar)

| Route | Methode | Funktion | Status |
|---|---|---|---|
| `/api/v1/auth/token` | POST | JWT/PAT ausstellen (Bearer Auth) | ✅ |
| `/api/v1/users/[id]/token` | POST | PAT pro User/Klinik | ✅ |

---

## Was noch fehlt ❌

### 1. Print Job Queue (OrderEntry — Server-side)

```
POST /api/v1/agent/jobs/print        ← erstellt Druckjob nach Auftragserfassung
GET  /api/v1/agent/jobs              ← Agent pollt: offene Print- + ORU-Jobs
POST /api/v1/agent/jobs/[id]/done   ← Agent bestätigt Job erledigt
```

Kein Druckjob-System existiert. Nach Auftragserfassung muss OrderEntry
automatisch einen Druckjob (PDF Begleitschein + ZPL Barcode) erstellen.

### 2. PDF / ZPL Generierung (OrderEntry — Server-side)

- Begleitschein als PDF (mit Patientendaten, Aufträgen, Barcodes)
- Barcode-Etikette als ZPL (für Zebra/Dymo Drucker)
- Bibliothek: `pdf-lib` oder `puppeteer` für PDF, ZPL als Template

### 3. Agent Registration / Management

```
POST /api/v1/agent/register          ← Klinik registriert Agent (erhält API-Key)
GET  /api/v1/agent/list              ← Admin: alle registrierten Agents
DELETE /api/v1/agent/[id]            ← Admin: Agent deaktivieren
```

Jede Klinik braucht einen eigenen API-Key. Aktuell kein Registrierungs-System.

### 4. Admin UI — Agent-Verwaltung

- Seite `/admin/agents`
- Zeigt: registrierte Kliniken, letzter Kontakt, Version, Status
- Aktionen: neuen Agent-Key erstellen, deaktivieren

### 5. ENV Konfiguration Agent-seitig

```
AGENT_POLL_INTERVAL_MS=5000          # Polling-Intervall (default: 5s)
AGENT_ORDERENTRY_URL=https://...     # OrderEntry Cloud URL
AGENT_API_KEY=...                    # Klinik-spezifischer API-Key
AGENT_ADT_WATCH_DIR=/var/adt/        # Ordner für ADT HL7 Dateien
AGENT_ORU_OUTPUT_DIR=/var/oru/       # Ordner für ORU HL7 Ausgabe
AGENT_PDF_OUTPUT_DIR=/var/pdf/       # Ordner für PDF Ausgabe
AGENT_PRINTER_NAME=HP_LaserJet       # Drucker für PDF
AGENT_ZEBRA_IP=192.168.1.50          # Zebra Drucker IP (optional)
AGENT_ZEBRA_PORT=9100                # Zebra RAW Port
```

### 6. Orchestra Konfiguration — ADT Szenario

Orchestra muss ein Szenario für ADT → FHIR Patient haben:
- Eingehende ADT-Nachrichten (A01/A08/A28/A31) → FHIR Patient erstellen/updaten
- Aktuell nur ORM-Szenario vorhanden

### 7. Der Agent selbst (separates Projekt)

```
zetlab-agent/
├── main.go                 # Entry point, Service-Registrierung
├── watcher/
│   └── adtWatcher.go       # Directory Watcher → POST /inbound
├── poller/
│   └── jobPoller.go        # GET /agent/jobs → Drucken + ORU schreiben
├── printer/
│   ├── pdfPrinter.go       # PDF → CUPS/WinPrint
│   └── zplPrinter.go       # ZPL → TCP:9100
├── writer/
│   └── oruWriter.go        # HL7 ORU → lokales Verzeichnis
├── config/
│   └── config.go           # ENV Konfiguration
└── Dockerfile
```

Technologie: **Go** (cross-platform, single binary, kein Runtime nötig)

---

## Reihenfolge der Implementierung

```
Phase 1 — OrderEntry Server-side (Voraussetzung für Agent)
  1. Print Job Queue API  (/api/v1/agent/jobs/*)
  2. PDF Generierung      (Begleitschein)
  3. ZPL Generierung      (Barcode-Etikette)
  4. Agent Registration   (/api/v1/agent/register)

Phase 2 — Orchestra Konfiguration
  5. ADT Szenario in Orchestra  (ADT → FHIR Patient)

Phase 3 — Agent (separates Projekt)
  6. Directory Watcher    (ADT)
  7. Job Poller           (Drucken + ORU)
  8. PDF Print Client
  9. ZPL Print Client
 10. ORU File Writer

Phase 4 — Admin UI
 11. /admin/agents         (Agent-Verwaltung)
```

---

## Auth-Konzept

```
Klinik registriert sich → erhält API-Key (PAT)
Agent konfiguriert API-Key → sendet bei jedem Request als Bearer Token
OrderEntry validiert Bearer Token → identifiziert Klinik
```

Pro Klinik ein eigener API-Key — Revocation möglich ohne andere Kliniken zu beeinflussen.

---

## Vorschläge / Offene Punkte (noch nicht eingeplant)

Die folgenden Punkte fehlen noch im aktuellen Design und sollten vor oder während
Phase 3 entschieden werden.

---

### A. Offline-Puffer (Resilienz)

**Problem:** Was passiert, wenn die Cloud vorübergehend nicht erreichbar ist?

**Vorschlag:** Agent puffert ADT-Dateien lokal in einem Warteverzeichnis:

```
/var/adt/pending/    ← neue ADT-Dateien vom PIS
/var/adt/sent/       ← erfolgreich hochgeladen (behalten für Audit)
/var/adt/failed/     ← nach N Retries → manuell prüfen
```

- Retry-Logik: exponentielles Backoff (5s → 30s → 5min)
- Nach Wiederherstellung der Verbindung: Pending-Queue automatisch abarbeiten
- Timeout pro Datei konfigurierbar (`AGENT_RETRY_MAX_HOURS=24`)

**Warum wichtig:** Kliniken arbeiten rund um die Uhr. Kurze Cloud-Ausfälle (Update,
Netzwerkproblem) dürfen den lokalen Ablauf nicht unterbrechen.

---

### B. Datei-Deduplizierung (Doppel-Upload verhindern)

**Problem:** Dir-Watcher könnte dieselbe HL7-Datei zweimal senden (Neustart,
Crash, Retry).

**Vorschlag:** Gelesene Dateien mit SHA-256 Hash in einer lokalen SQLite-DB
(oder `.sent`-Datei) markieren:

```
/var/adt/sent.db    ← Tabelle: (filename, sha256, uploaded_at)
```

- Vor Upload: Hash prüfen → wenn bekannt, überspringen + loggen
- Hash wird nach erfolgreichem Upload gespeichert
- DB-Grösse begrenzen: Einträge älter als 30 Tage löschen

---

### C. Health Endpoint (lokale Überwachung)

**Vorschlag:** Agent öffnet einen lokalen HTTP-Port nur für Health-Checks:

```
GET http://localhost:7890/health   → 200 { status: "ok", version: "1.2.0", lastPoll: "..." }
GET http://localhost:7890/metrics  → Prometheus text (optional)
```

- Nur lokal erreichbar (`127.0.0.1`) — kein Netzwerkzugang von aussen
- Erlaubt Docker `HEALTHCHECK` und systemd/Windows-Service-Monitor
- OrderEntry `/api/v1/agent/status` bleibt der Cloud-seitige Check

**ENV:** `AGENT_HEALTH_PORT=7890` (0 = deaktiviert)

---

### D. Agent Auto-Update

**Vorschlag:** Agent vergleicht beim `/api/v1/agent/status` Poll seine eigene
Version mit der vom Server gemeldeten Mindestversion:

```json
{ "minAgentVersion": "1.3.0", "latestAgentVersion": "1.4.2" }
```

- Wenn `minAgentVersion > current` → Agent loggt kritische Warnung, Admin-Mail
- Wenn `latestAgentVersion > current` → optionaler Auto-Download + Neustart
- Download-URL: `AGENT_UPDATE_URL` (default: GitHub Releases oder interner Server)

**Warum wichtig:** Kliniken installieren selten manuell. Auto-Update verhindert
veraltete Agents im Feld.

---

### E. `X-Clinic-ID` Header (Multi-Tenant Logging)

**Vorschlag:** Agent sendet bei jedem Request einen zusätzlichen Header:

```
X-Clinic-ID: org-123
X-Agent-Version: 1.2.0
```

- OrderEntry loggt `clinicId` in jedem strukturierten Log-Eintrag
- Ermöglicht spätere Auswertung: welche Klinik sendet wie viele ADT/ORU?
- `X-Clinic-ID` = FHIR Organization ID (aus Agent-Config)

---

### F. Startup-Validierung

**Vorschlag:** Beim Start prüft der Agent alle Voraussetzungen bevor er in den
Polling-Loop eintritt:

```
[ ] AGENT_ORDERENTRY_URL erreichbar (HTTP 200/401)
[ ] API-Key gültig (GET /api/v1/agent/status → 200)
[ ] ADT_WATCH_DIR existiert und ist lesbar
[ ] ORU_OUTPUT_DIR existiert und ist schreibbar
[ ] PDF_OUTPUT_DIR existiert und ist schreibbar
[ ] Drucker erreichbar (CUPS-Abfrage oder TCP-Ping auf Zebra-IP)
```

- Bei kritischem Fehler: Agent beendet sich mit Exit-Code 1 (systemd/Windows
  Service startet nicht → sofortige Fehlermeldung statt stilles Versagen)
- Nicht-kritische Fehler (Drucker fehlt): Warnung loggen, Agent startet trotzdem

---

### G. Graceful Shutdown

**Vorschlag:** SIGTERM / SIGINT abfangen — laufenden Job fertig verarbeiten,
dann sauber beenden:

```
SIGTERM empfangen
  → polling-Loop stoppen
  → aktuellen Job (ORU schreiben / Druckjob) abschliessen
  → pending ADT-Dateien in Queue schieben (nicht verlieren)
  → Exit 0
```

Wichtig für:
- Windows-Service-Stop (SCM wartet auf sauberes Exit)
- Docker `docker stop` (sendet SIGTERM, wartet 10s, dann SIGKILL)
- systemd `systemctl stop`

---

### H. Audit Log (lokal)

**Vorschlag:** Agent schreibt ein lokales Audit-Log (append-only):

```
/var/log/zetlab-agent.log
2026-04-04T14:32:01Z  ADT  SENT     patient_123.hl7  sha256:abc123
2026-04-04T14:32:06Z  ORU  WRITTEN  oru_456.hl7      → /var/oru/
2026-04-04T14:32:07Z  PDF  PRINTED  job_789.pdf      → HP_LaserJet
2026-04-04T14:35:00Z  ADT  RETRY    patient_124.hl7  attempt=2
```

- Format: structured JSON oder TSV (maschinenlesbar)
- Rotation: täglich, max. 30 Tage aufbewahren
- Wichtig für Datenschutz-Audit (nDSG): was wurde wann übertragen?

**ENV:** `AGENT_LOG_FILE=/var/log/zetlab-agent.log`, `AGENT_LOG_RETENTION_DAYS=30`

---

### I. Watchdog / Hang Detection

**Problem:** Job-Poller könnte bei einem fehlerhaften Druckjob oder einem
blockierten Netzwerk-Call hängen bleiben.

**Vorschlag:** Jeder Job-Lauf hat ein konfigurierbares Timeout:

```
AGENT_JOB_TIMEOUT_MS=30000   # 30 Sekunden pro Job
```

- Wenn ein Job nicht innerhalb Timeout abgeschlossen: abbrechen, als `failed`
  markieren, nächster Poll-Zyklus beginnt
- Separater Watchdog-Thread: wenn Haupt-Loop > 5× Polling-Intervall keine
  Aktivität → Alert loggen + optional Neustart

---

## Auth-Konzept

```
Klinik registriert sich → erhält API-Key (PAT)
Agent konfiguriert API-Key → sendet bei jedem Request als Bearer Token
OrderEntry validiert Bearer Token → identifiziert Klinik
```

Pro Klinik ein eigener API-Key — Revocation möglich ohne andere Kliniken zu beeinflussen.

---

## Referenzen

- `CLAUDE.md` → Abschnitt "Orchestra Integration"
- `src/app/api/v1/proxy/hl7/` → HL7 Proxy Routes (bereits implementiert)
- `src/app/api/v1/agent/` → Agent Routes (teilweise implementiert)
- Memory: `project_client_architecture.md`
