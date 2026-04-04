[← Presentation](../README.md) | [↑ src](../../README.md)

---

# 📐 Pages

Full CA-wired page components imported by Next.js `app/` routes.

## 📄 Files

- 📄 [ResultsPage.tsx](./ResultsPage.tsx) — Global `DiagnosticReport` results list
- 📄 [OrdersPage.tsx](./OrdersPage.tsx) — Global `ServiceRequest` orders list
- 📄 [UsersPage.tsx](./UsersPage.tsx) — Admin: User-Management (CRUD + FHIR-Sync)
- 📄 [ApiDocsPage.tsx](./ApiDocsPage.tsx) — Admin: API-Dokumentation (Swagger + Connection Guide)

---

## 👤 UsersPage — User-Management nach FHIR R4

### Formular-Logik nach ptype

| ptype | Beschreibung | GLN | AHV | Org | Location | PractitionerRole | FHIR-Sync |
|---|---|---|---|---|---|---|---|
| `NAT` | Practitioner (Arzt, MPA) | **Pflicht** | Optional | **Pflicht** | **Pflicht** | **Pflicht** | `Practitioner` + `PractitionerRole` |
| `JUR` | Organisation (Auftraggeber) | **Pflicht** | — | — | — | ❌ | `Organization` + `OrganizationAffiliation → ZLZ` |
| andere | Normale Person (IT, Admin) | Optional | Optional | Optional | — | ❌ | kein FHIR-Sync |

### Zugriffskontrolle

- **ZLZ / ZetLab User** → sehen alle Patienten und Aufträge (Systembetreiber)
- **Externe Org User (JUR/NAT)** → sehen nur eigene Daten (`ServiceRequest.requester` → ihre Org)
- Filter-Basis: `PractitionerRole.organization` bzw. `OrganizationAffiliation.participatingOrganization`

### FHIR-Beziehungen bei User-Sync

```
NAT-User sync →
  Practitioner (GLN-Identifier)
    └── PractitionerRole
          ├── organization → Organization/{orgId}   (Auftraggeber)
          └── location[]  → Location/{locationId}

JUR-User sync →
  Organization (GLN-Identifier)
    └── OrganizationAffiliation
          ├── organization         → Organization/zlz   (Labor/Auftragnehmer)
          └── participatingOrg     → Organization/{id}  (Auftraggeber)
```

### Organization Dropdown

Lädt via `GET /api/fhir/organizations` (FHIR Bundle). Parst `entry[].resource` — **nicht** `{ organizations: [] }`.
Locations werden gefiltert nach gewählter Organisation: `GET /fhir/Location?organization={orgId}`.

---

## ⚙️ Regeln

- Pages wire hooks, components, und i18n — keine Business-Logik hier
- Thin wrappers: erhalten keine Props ausser was Next.js bereitstellt
- `SkeletonRows` aus Design-System während Loading
- Alle Strings via `useTranslations()` — kein hartkodierter Text in JSX
- ptype-abhängige Formular-Felder: nur anzeigen was für den jeweiligen Typ gilt

---

[⬆ Back to top](#)
