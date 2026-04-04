[← Infrastructure](../README.md) | [↑ Source](../../README.md) | [↑↑ Project](../../../../../README.md)

# 📧 Mail Module — z2Lab OrderEntry

> **Production-grade, provider-agnostic email delivery for a Swiss clinical laboratory system.**
> All outbound mail (password resets, notifications, lab report delivery) passes through
> this module. Configuration is exclusively via environment variables — no secrets in code.

---

## 🏗️ Architecture

The mail module follows **Clean Architecture** strictly. Each layer knows only about the
layers below it — no infrastructure leaks into domain or application code.

```
┌──────────────────────────────────────────────────────────────────┐
│  domain/entities/MailMessage.ts                                  │
│  Pure data — what a message contains. No delivery logic.         │
├──────────────────────────────────────────────────────────────────┤
│  application/interfaces/IMailService.ts                          │
│  Contract: isConfigured() · verify() · send(message)            │
│  No import of nodemailer, SMTP, or any concrete transport.       │
├──────────────────────────────────────────────────────────────────┤
│  infrastructure/mail/                                            │
│  ├── types/MailConfig.ts          Provider + auth type enums     │
│  ├── mailEnvConfig.ts             ENV → MailConfig builder       │
│  ├── MailServiceFactory.ts        DI root (singleton)            │
│  └── NodemailerMailService.ts     Concrete impl + NullMailService│
├──────────────────────────────────────────────────────────────────┤
│  app/settings/mail/page.tsx       Admin UI (read-only display)   │
│  app/api/admin/mail/test/route.ts Test-send endpoint             │
└──────────────────────────────────────────────────────────────────┘
```

### Key design decisions

| Decision | Rationale |
|---|---|
| `IMailService` interface | Swap providers without touching callers |
| `NullMailService` pattern | Safe no-op when unconfigured — never throws at startup |
| `MailServiceFactory` singleton | One transport instance per process |
| ENV-only secrets | No secrets ever stored in DB or code |
| Fail-fast on `send()` | Unconfigured service throws immediately — no silent data loss |

---

## ⚠️ Medical & Legal Requirements (nDSG)

Das revidierte Schweizer Datenschutzgesetz (nDSG, in Kraft seit **1. September 2023**):

| Mailinhalt | Anforderung |
|---|---|
| Passwort-Reset-Links | ✅ Unverschlüsselt erlaubt (keine Patientendaten) |
| Laborbefunde per Mail | ❌ **Verschlüsselung Pflicht** — HIN oder S/MIME |
| Patientendaten jeglicher Art | ❌ **Verschlüsselung Pflicht** oder schriftliche Einwilligung |

**Rule:** Never configure an unencrypted provider (`smtp` without TLS) for sending lab results
or any patient-identifiable content. Use `hin` or an S/MIME-capable relay.

For ordering systems in Swiss hospitals, **HIN (Health Info Net)** is the recognised
standard — >90 % of Swiss healthcare professionals are HIN-addressable.

---

## 📦 Supported Providers

| Provider | `MAIL_PROVIDER` | Auth types | Use case |
|---|---|---|---|
| Generic SMTP | `smtp` | `APP_PASSWORD` `OAUTH2` | Hospital relay, Exchange internal, any SMTP |
| Gmail SMTP | `gmail` | `APP_PASSWORD` `OAUTH2` | **Development only** — not for production |
| SMTP + OAuth 2.0 | `smtp_oauth2` | `OAUTH2` | Office 365 / Exchange Online (Modern Auth) |
| Google Workspace Relay | `google_workspace_relay` | `NONE` `APP_PASSWORD` | Google Workspace org-wide relay |
| HIN (Health Info Net) | `hin` | `APP_PASSWORD` | 🇨🇭 Encrypted Swiss healthcare mail |

### Provider constraints

```
smtp               → primary. Works with any SMTP server worldwide.
gmail              → ⛔  MUST NOT be used in production. Dev/testing only.
smtp_oauth2        → Exchange Online, Microsoft 365 with Modern Auth.
google_workspace_relay → org must own a Google Workspace account.
hin                → requires HIN-certified mail account or gateway.
```

---

## ⚙️ Environment Variables

All configuration is via environment variables. **Never hardcode credentials in source code.**

### Core variables

| Variable | Required | Description |
|---|---|---|
| `MAIL_PROVIDER` | ✅ | Provider key from table above |
| `MAIL_AUTH_TYPE` | ✅ | `APP_PASSWORD` \| `OAUTH2` \| `NONE` |
| `MAIL_FROM` | ✅ | Sender display + address: `Labor ZLZ <noreply@zlz.ch>` |
| `MAIL_HOST` | ✅ (smtp/hin) | SMTP hostname (not required for `gmail`) |
| `MAIL_PORT` | — | SMTP port (default: `587`) |
| `MAIL_SECURE` | — | `true` = SSL/TLS on connect (port 465). Default: STARTTLS |
| `MAIL_USER` | ✅ (most) | Sender email / login username |
| `MAIL_PASSWORD` | ✅* | Password or App Password — keep secret |
| `MAIL_ALIAS` | — | Reply-To address (e.g. helpdesk@zlz.ch) |

### OAuth 2.0 variables (smtp_oauth2 / gmail OAuth)

| Variable | Required | Description |
|---|---|---|
| `MAIL_OAUTH_CLIENT_ID` | OAuth2 | Azure AD / Google Client ID |
| `MAIL_OAUTH_CLIENT_SECRET` | OAuth2 | Client Secret — keep secret |
| `MAIL_OAUTH_REFRESH_TOKEN` | OAuth2 | Long-lived refresh token — keep secret |

### Relay variable

| Variable | Required | Description |
|---|---|---|
| `MAIL_DOMAIN` | Relay | Your Google Workspace domain (e.g. `zlz.ch`) |

### Valid provider + auth combinations

```
smtp                + APP_PASSWORD ✅
smtp                + OAUTH2       ✅
gmail               + APP_PASSWORD ✅  (dev only)
gmail               + OAUTH2       ✅  (dev only)
smtp_oauth2         + OAUTH2       ✅
google_workspace_relay + NONE      ✅
google_workspace_relay + APP_PASSWORD ✅
hin                 + APP_PASSWORD ✅
```

Any other combination → factory returns `NullMailService` (mail disabled).

---

## 🚀 Configuration Examples

### 1. Hospital SMTP relay (Recommended for production)

```env
MAIL_PROVIDER=smtp
MAIL_AUTH_TYPE=APP_PASSWORD
MAIL_HOST=mail.zlz.ch
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=orderentry@zlz.ch
MAIL_PASSWORD=<service-account-password>
MAIL_FROM=Labor ZLZ <orderentry@zlz.ch>
MAIL_ALIAS=support@zlz.ch
```

> Use this for any internal Exchange, Postfix, or SMTP-capable mail server.
> If your server requires SSL on port 465, set `MAIL_SECURE=true` and `MAIL_PORT=465`.

---

### 2. HIN (Health Info Net) — required for lab reports

HIN uses standard SMTP under the hood. S/MIME encryption is applied transparently
at the HIN gateway. OrderEntry sends normal SMTP — no special library needed.

**Option A — Infomaniak HIN-certified mailbox:**

```env
MAIL_PROVIDER=hin
MAIL_AUTH_TYPE=APP_PASSWORD
MAIL_HOST=mail.infomaniak.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=labor@hin.ch
MAIL_PASSWORD=<infomaniak-app-password>
MAIL_FROM=Labor ZLZ <labor@hin.ch>
```

**Option B — Exchange already HIN-certified:**

```env
MAIL_PROVIDER=hin
MAIL_AUTH_TYPE=APP_PASSWORD
MAIL_HOST=mail.zlz.ch
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=noreply@zlz.ch
MAIL_PASSWORD=<exchange-service-password>
MAIL_FROM=Labor ZLZ <noreply@zlz.ch>
```

> If your Exchange server already holds a HIN certificate, simply use `MAIL_PROVIDER=hin`
> with your existing Exchange host. No Infomaniak account required.

---

### 3. Office 365 / Exchange Online (OAuth 2.0)

Requires an Azure App Registration with `Mail.Send` permission (Microsoft Graph).

```env
MAIL_PROVIDER=smtp_oauth2
MAIL_AUTH_TYPE=OAUTH2
MAIL_HOST=smtp.office365.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=noreply@zlz.ch
MAIL_OAUTH_CLIENT_ID=<azure-app-client-id>
MAIL_OAUTH_CLIENT_SECRET=<azure-client-secret>
MAIL_OAUTH_REFRESH_TOKEN=<oauth2-refresh-token>
MAIL_FROM=Labor ZLZ <noreply@zlz.ch>
```

> **Azure setup:** App Registration → API Permissions → Microsoft Graph → `Mail.Send`
> (Application permission) → Admin consent required.

---

### 4. Gmail — development only

> ⚠️ **Not for production.** Gmail imposes sending limits (500/day personal,
> 2000/day Workspace) and is not suitable for medical environments.

```env
# Only valid when NODE_ENV=development
MAIL_PROVIDER=gmail
MAIL_AUTH_TYPE=APP_PASSWORD
MAIL_USER=developer@gmail.com
MAIL_PASSWORD=<16-char-google-app-password>
MAIL_FROM=OrderEntry Dev <developer@gmail.com>
```

To generate a Gmail App Password:
1. Enable 2-Step Verification on your Google account
2. Google Account → Security → App Passwords → Create
3. Copy the 16-character password (no spaces) → `MAIL_PASSWORD`

---

### 5. Mailpit — local development (fake SMTP, no real delivery)

```env
MAIL_PROVIDER=smtp
MAIL_AUTH_TYPE=APP_PASSWORD
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_USER=test@localhost
MAIL_PASSWORD=test
MAIL_FROM=OrderEntry <noreply@localhost>
```

Start Mailpit via Docker:

```bash
# from frontend/zetlab/
docker compose -f src/infrastructure/db/docker/docker-compose.yml \
  --profile mail-test up -d

# Web UI:  http://localhost:8025
# SMTP:    localhost:1025
```

All outgoing emails are captured in the Mailpit web interface — nothing is delivered.

---

### 6. Ethereal Email — cloud test inbox (no Docker)

Free disposable SMTP inbox from the nodemailer team. No installation needed.

```env
MAIL_PROVIDER=smtp
MAIL_AUTH_TYPE=APP_PASSWORD
MAIL_HOST=smtp.ethereal.email
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=<generated-user@ethereal.email>
MAIL_PASSWORD=<generated-password>
MAIL_FROM=OrderEntry Test <noreply@ethereal.email>
```

Create a free account at [ethereal.email](https://ethereal.email) — credentials appear
instantly and the inbox is accessible in the browser.

---

## 🐳 Docker Deployment

### docker-compose.yml — production

```yaml
services:
  orderentry:
    image: farian/orderentry:latest
    environment:
      # Provider
      MAIL_PROVIDER: smtp
      MAIL_AUTH_TYPE: APP_PASSWORD
      # Server
      MAIL_HOST: mail.zlz.ch
      MAIL_PORT: "587"
      MAIL_SECURE: "false"
      # Credentials — use Docker secrets or external secret manager
      MAIL_USER: orderentry@zlz.ch
      MAIL_PASSWORD: "${MAIL_PASSWORD}"
      # Display
      MAIL_FROM: "Labor ZLZ <orderentry@zlz.ch>"
      MAIL_ALIAS: support@zlz.ch
```

```env
# devops/docker/.env  (never commit this file)
MAIL_PASSWORD=super-secret-service-account-password
```

> **Secret management:** For production, inject `MAIL_PASSWORD` and OAuth secrets via
> Docker secrets, HashiCorp Vault, or your CI/CD secret store — never hardcode in
> `docker-compose.yml`.

---

## ☁️ Vercel Deployment

Vercel injects environment variables at function invocation time from the project dashboard.

**Steps:**

1. Open the Vercel project → **Settings → Environment Variables**
2. Add each variable individually — Vercel encrypts secrets at rest
3. Select the target environments (Production / Preview / Development)
4. Redeploy to apply changes — no restart required on Vercel serverless

**Variables to add in Vercel dashboard:**

```
MAIL_PROVIDER        smtp
MAIL_AUTH_TYPE       APP_PASSWORD
MAIL_HOST            mail.zlz.ch
MAIL_PORT            587
MAIL_USER            orderentry@zlz.ch
MAIL_PASSWORD        ••••••••           ← mark as secret
MAIL_FROM            Labor ZLZ <orderentry@zlz.ch>
```

> **Vercel limitations:** `POST /api/env` returns `405` on Vercel (read-only filesystem).
> The Admin UI switches to a read-only informational view automatically.
> Always configure mail via the Vercel dashboard — not the in-app ENV editor.

---

## 🔒 Security

### Rules — never break these

1. **No secrets in code** — `MAIL_PASSWORD`, `MAIL_OAUTH_*` are ENV-only, always.
2. **No secrets in logs** — the logger records provider, host, and port but never
   passwords or tokens. Inspect `Logger.ts` if adding new log lines.
3. **No secrets via API** — `GET /api/env` blocks variables matching `PASSWORD`, `SECRET`,
   `TOKEN`, `PRIVATE` patterns. These are never returned or writable via the web UI.
4. **HIN for patient data** — nDSG legally requires encrypted transport for lab results.
   Use `MAIL_PROVIDER=hin` or an S/MIME-enabled relay for any patient-identifiable mail.
5. **TLS for production** — use `MAIL_PORT=587` (STARTTLS) or `MAIL_PORT=465`+`MAIL_SECURE=true`.
   Plain-text SMTP (port 25 without STARTTLS) is unacceptable in production.
6. **Gmail is development only** — enforced by documentation and the Admin UI warning
   banner. A future guard may also check `NODE_ENV` at factory level.

### SMTP TLS reference

| Port | Mode | Setting |
|---|---|---|
| `587` | STARTTLS (recommended) | `MAIL_PORT=587` `MAIL_SECURE=false` |
| `465` | SSL/TLS | `MAIL_PORT=465` `MAIL_SECURE=true` |
| `25` | Unencrypted | ❌ Do not use in production |
| `1025` | Mailpit (dev) | `MAIL_PORT=1025` `MAIL_SECURE=false` |

---

## 🌐 API Gateway

All mail endpoints in the versioned API (`/api/v1/...`) are routed through the
**ApiGateway** (`src/infrastructure/api/gateway/ApiGateway.ts`), which provides:

| Concern | Behaviour |
|---|---|
| **Request ID** | Every response carries `x-request-id` (UUID v4) |
| **Structured logging** | `→ METHOD /api/v1/path`, `✓ 200 (ms)`, `✗ 502 (ms)` — never logs credentials |
| **Auth enforcement** | `auth: "admin"` → calls `checkAdminAccess(req)` → `401` / `403` on failure |
| **Error normalisation** | Uncaught handler throws → RFC 7807 Problem Details `500` |

The unversioned paths (`/api/admin/mail/*`) bypass the gateway and remain for
backward compatibility with existing callers. All new integrations should use `/api/v1/`.

---

## 🔌 API

> Use `/api/v1/` paths for all new integrations — they go through the API Gateway.

### `POST /api/v1/admin/mail/test` *(recommended)*

Verifies the SMTP connection and optionally sends a test email.
Requires admin authentication. Routed through ApiGateway.

**Request**

```http
POST /api/v1/admin/mail/test
Content-Type: application/json
Cookie: session=<admin-session>

{ "to": "admin@zlz.ch" }
```

**Response — success `200`**

```json
{
  "ok":         true,
  "message":    "Mail-Server erreichbar und Authentifizierung erfolgreich",
  "provider":   "smtp",
  "from":       "Labor ZLZ <orderentry@zlz.ch>",
  "durationMs": 142
}
```

**Response — not configured `503`**

```json
{
  "ok":      false,
  "message": "Mail server not configured — set MAIL_PROVIDER in environment variables"
}
```

**Response — SMTP failure `502`**

```json
{
  "ok":         false,
  "message":    "connect ECONNREFUSED 127.0.0.1:587",
  "provider":   "smtp",
  "durationMs": 3012
}
```

**cURL example**

```bash
# Verify connection only
curl -X POST https://orderentry.z2lab.ddns.net/api/v1/admin/mail/test \
  -H "Cookie: session=<your-session-cookie>"

# Send test email
curl -X POST https://orderentry.z2lab.ddns.net/api/v1/admin/mail/test \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<your-session-cookie>" \
  -d '{"to":"farhad.arian@zlz.ch"}'
```

### `GET /api/v1/admin/mail/status` *(recommended)*

Returns the current mail configuration — no secrets, no credentials.

```http
GET /api/v1/admin/mail/status
Cookie: session=<admin-session>
```

```json
{
  "configured": true,
  "provider":   "smtp",
  "authType":   "APP_PASSWORD",
  "host":       "mail.zlz.ch",
  "port":       587,
  "from":       "Labor ZLZ <orderentry@zlz.ch>"
}
```

### Legacy paths (backward-compatible, no gateway)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/admin/mail/test` | Same logic, no request ID or gateway logging |
| `GET` | `/api/admin/mail/status` | Same response shape |

---

## 🖥️ Admin UI (`/settings/mail`)

The Settings → Mail page provides:

| Section | Description |
|---|---|
| **Status** | Active provider, auth type, sender address, configured/unconfigured badge |
| **Test** | "Test-Mail senden" button — calls `POST /api/admin/mail/test` |
| **Verbindungstest** | SMTP connection verify (no message sent) |
| **Provider guide** | ENV variable reference per selected provider |
| **Server presets** | Dropdown: Infomaniak, Exchange Online, Mailpit, Outlook.com, … |
| **HIN notice** | Green when HIN active, red when HIN not configured (nDSG reminder) |

> The Admin UI is **read-only for credentials** — `MAIL_PASSWORD` and OAuth tokens
> cannot be set via the UI. They must be changed as ENV variables with a server restart.

---

## 🔧 Adding a New Provider

The Strategy + Factory pattern means you add a new provider without modifying
any existing files:

1. **`types/MailConfig.ts`** — add the new provider key to `MailProvider` union,
   `MAIL_PROVIDERS` array, and `PROVIDER_AUTH_MATRIX`.

2. **`NodemailerMailService.ts`** — add a branch in `buildTransportOptions()` for
   the new provider key.

3. **`mailEnvConfig.ts`** — no changes needed (generic ENV reader).

4. **`app/settings/mail/page.tsx`** — add the provider to `PROVIDERS_WITH_HOST_SELECTOR`
   and write a `ProviderGuide` entry with the required ENV vars.

5. **`src/messages/*.json`** — add i18n keys for all 5 languages if the provider
   needs a UI label or help text.

**Example: adding Microsoft Graph API provider**

```typescript
// types/MailConfig.ts
export type MailProvider = "smtp" | "gmail" | "smtp_oauth2" | "google_workspace_relay" | "hin" | "ms_graph";
//                                                                                                 ^^^^^^^^

// PROVIDER_AUTH_MATRIX
ms_graph: ["OAUTH2"],
```

```typescript
// NodemailerMailService.ts — buildTransportOptions()
if (provider === "ms_graph") {
  return buildMsGraphTransport(config); // new private function
}
```

No other files change. Existing providers are unaffected.

---

## 🐛 Troubleshooting

### Mail is not sent — no error shown

**Cause:** `MAIL_PROVIDER` is not set or invalid → `NullMailService` is active.

**Fix:** Check `isConfigured()` is `true` in `/settings/mail`. Set `MAIL_PROVIDER`.

---

### `ECONNREFUSED` — connection refused

**Cause:** Wrong `MAIL_HOST` or `MAIL_PORT`, or the mail server is not reachable.

**Fix:**
```bash
# Test TCP reachability from the host running OrderEntry:
curl -v telnet://mail.zlz.ch:587
# or
nc -vz mail.zlz.ch 587
```

Inside Docker, use the container name, not `localhost`:
```yaml
MAIL_HOST: mailpit   # not localhost when running in Docker network
```

---

### `EAUTH` — authentication failed

**Cause:** Wrong `MAIL_USER` / `MAIL_PASSWORD`, or the account requires
App Passwords (2-FA enabled), or OAuth tokens are expired.

**Fix for Gmail:** Generate a new App Password at Google Account → Security → App Passwords.

**Fix for OAuth2:** Refresh token may be expired. Re-authorise the app and update
`MAIL_OAUTH_REFRESH_TOKEN`.

---

### `STARTTLS unavailable` / TLS handshake error

**Cause:** Port 465 used with `MAIL_SECURE=false`, or port 587 used with `MAIL_SECURE=true`.

**Fix:**
```env
# STARTTLS (port 587)
MAIL_PORT=587
MAIL_SECURE=false

# SSL/TLS (port 465)
MAIL_PORT=465
MAIL_SECURE=true
```

---

### HIN mails not encrypted at recipient

**Cause:** Recipient does not have a HIN address or the sender gateway is not HIN-certified.

**Fix:** Verify the sender account is a valid `@hin.ch` address or the sending gateway
(Infomaniak, SeppMail, Exchange) holds a current HIN certificate. The recipient must
also be a registered HIN participant.

---

### Vercel: `POST /api/env` returns 405

**Expected behaviour.** Vercel's filesystem is ephemeral — ENV vars must be managed
via the Vercel dashboard. The Admin UI displays a blue info banner in this case.
No action required.

---

## 📁 File Map

```
src/
├── domain/entities/MailMessage.ts          ← Entity: what a message contains
├── application/interfaces/IMailService.ts  ← Contract: isConfigured · verify · send
└── infrastructure/mail/
    ├── README.md                           ← This file
    ├── types/
    │   └── MailConfig.ts                  ← MailProvider, MailAuthType, PROVIDER_AUTH_MATRIX
    ├── mailEnvConfig.ts                    ← ENV → MailConfig builder (buildMailConfig)
    ├── MailServiceFactory.ts               ← DI root: create() + mailService singleton
    └── NodemailerMailService.ts            ← Nodemailer impl + NullMailService

src/app/
├── settings/mail/page.tsx                  ← Admin UI
└── api/admin/mail/
    ├── test/route.ts                       ← POST /api/admin/mail/test
    └── status/route.ts                     ← GET /api/admin/mail/status
```

---

## 📋 Rules

1. **No Gmail in production** — `MAIL_PROVIDER=gmail` is development-only.
2. **HIN for patient data** — nDSG Pflicht bei Laborbefunden per Mail.
3. **Secrets via ENV only** — `MAIL_PASSWORD`, `MAIL_OAUTH_*` never in code or DB.
4. **Restart after ENV changes** — variables are read once at process startup.
5. **Use Mailpit in development** — never configure a real mail server for local dev.
6. **TLS mandatory in production** — port 587 (STARTTLS) or port 465 (SSL/TLS).
7. **NullMailService is safe** — unconfigured mail silently no-ops `verify()`;
   `send()` throws clearly so callers can surface the error to the user.
8. **Logging never includes credentials** — log provider + host + port only.

---

## 📞 Support

For configuration questions or if mail delivery fails in a production environment:

**Farhad Arian** — [Farhad.Arian@zlz.ch](mailto:Farhad.Arian@zlz.ch)

Include in your message:
- `MAIL_PROVIDER` value
- `MAIL_HOST` and `MAIL_PORT`
- The error message from `/settings/mail` → Verbindungstest
- Whether the issue appears in Docker or on Vercel

---

[⬆ Back to top](#-mail-module--z2lab-orderentry)
