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

## Referenzen

- `CLAUDE.md` → Abschnitt "Orchestra Integration"
- `src/app/api/v1/proxy/hl7/` → HL7 Proxy Routes (bereits implementiert)
- `src/app/api/v1/agent/` → Agent Routes (teilweise implementiert)
- Memory: `project_client_architecture.md`
