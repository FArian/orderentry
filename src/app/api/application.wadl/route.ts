/**
 * GET /api/application.wadl — Web Application Description Language (WADL)
 *
 * Generates a WADL document describing all API resources and methods.
 * The WADL is derived from the same source as the OpenAPI spec so it
 * stays in sync automatically.
 *
 * WADL spec: https://www.w3.org/Submission/wadl/
 */

import { NextResponse } from "next/server";

const WADL = `<?xml version="1.0" encoding="UTF-8"?>
<application xmlns="http://wadl.dev.java.net/2009/02"
             xmlns:xsd="http://www.w3.org/2001/XMLSchema">

  <doc xml:lang="de" title="z2Lab OrderEntry API">
    REST API for the z2Lab laboratory order entry system (ZLZ Zentrallabor AG &amp; ZetLab AG).
    Authentication uses HMAC-SHA256 signed session cookies.
    All data access is proxied through a FHIR R4 server.
  </doc>

  <resources base="/api">

    <!-- ── Auth ──────────────────────────────────────────────────────── -->

    <resource path="/login">
      <method name="POST" id="login">
        <doc>Authenticate and receive a signed session cookie.</doc>
        <request>
          <representation mediaType="application/json">
            <param name="username" style="plain" type="xsd:string" required="true"/>
            <param name="password" style="plain" type="xsd:string" required="true"/>
          </representation>
        </request>
        <response status="200"><doc>Login successful — session cookie set.</doc></response>
        <response status="401"><doc>Invalid credentials.</doc></response>
      </method>
    </resource>

    <resource path="/logout">
      <method name="POST" id="logout">
        <doc>Clear the session cookie.</doc>
        <response status="200"><doc>Logged out.</doc></response>
      </method>
    </resource>

    <resource path="/me">
      <method name="GET" id="getMe">
        <doc>Return the currently authenticated user.</doc>
        <response status="200"><doc>Current user object.</doc></response>
        <response status="401"><doc>Not authenticated.</doc></response>
      </method>
    </resource>

    <!-- ── Orchestra / Launch ───────────────────────────────────────── -->

    <resource path="/launch">
      <method name="POST" id="launch">
        <doc>
          Orchestra context launch — creates a session and returns a redirect URL.
          Requires a signed HS256 JWT (iss=orchestra, max 5 min, secret=ORCHESTRA_JWT_SECRET).
          Error responses follow RFC 7807 Problem Details.
        </doc>
        <request>
          <representation mediaType="application/json">
            <param name="patientId"      style="plain" type="xsd:string" required="true"/>
            <param name="practitionerId" style="plain" type="xsd:string" required="true"/>
            <param name="organizationId" style="plain" type="xsd:string" required="true"/>
            <param name="token"          style="plain" type="xsd:string" required="true"/>
          </representation>
        </request>
        <response status="200"><doc>Session created — { redirectUrl: "/order/new?patientId=..." }</doc></response>
        <response status="400"><doc>Missing or malformed request body (Problem Details).</doc></response>
        <response status="401"><doc>JWT invalid, expired, or missing claims (Problem Details).</doc></response>
      </method>
    </resource>

    <!-- ── Results (DiagnosticReports) ───────────────────────────────── -->

    <resource path="/diagnostic-reports">
      <method name="GET" id="listResults">
        <doc>List DiagnosticReports (lab results) with pagination and filtering.</doc>
        <request>
          <param name="q"           style="query" type="xsd:string"  required="false"/>
          <param name="status"      style="query" type="xsd:string"  required="false"/>
          <param name="patientId"   style="query" type="xsd:string"  required="false"/>
          <param name="patientName" style="query" type="xsd:string"  required="false"/>
          <param name="orderNumber" style="query" type="xsd:string"  required="false"/>
          <param name="page"        style="query" type="xsd:integer" required="false" default="1"/>
          <param name="pageSize"    style="query" type="xsd:integer" required="false" default="20"/>
        </request>
        <response status="200"><doc>Paginated list of results.</doc></response>
        <response status="500"><doc>FHIR server error.</doc></response>
      </method>
    </resource>

    <!-- ── Orders (ServiceRequests) ──────────────────────────────────── -->

    <resource path="/service-requests">
      <method name="GET" id="listOrders">
        <doc>List ServiceRequests (laboratory orders).</doc>
        <response status="200"><doc>List of orders.</doc></response>
        <response status="500"><doc>FHIR server error.</doc></response>
      </method>

      <resource path="/{id}">
        <param name="id" style="template" type="xsd:string" required="true"/>
        <method name="GET" id="getOrder">
          <doc>Get a single ServiceRequest by FHIR ID.</doc>
          <response status="200"><doc>FHIR ServiceRequest resource.</doc></response>
          <response status="404"><doc>Not found.</doc></response>
        </method>
        <method name="PUT" id="updateOrder">
          <doc>Replace a ServiceRequest (PUT semantics).</doc>
          <request><representation mediaType="application/fhir+json"/></request>
          <response status="200"><doc>Updated FHIR ServiceRequest.</doc></response>
          <response status="400"><doc>Invalid FHIR resource.</doc></response>
        </method>
        <method name="DELETE" id="deleteOrder">
          <doc>Hard delete; falls back to soft-delete (status=entered-in-error) on 409.</doc>
          <response status="200"><doc>Delete result.</doc></response>
          <response status="404"><doc>Not found.</doc></response>
        </method>
      </resource>
    </resource>

    <!-- ── Patients ───────────────────────────────────────────────────── -->

    <resource path="/patients">
      <method name="GET" id="listPatients">
        <doc>Search FHIR Patient resources with pagination.</doc>
        <request>
          <param name="q"            style="query" type="xsd:string"  required="false"/>
          <param name="page"         style="query" type="xsd:integer" required="false" default="1"/>
          <param name="pageSize"     style="query" type="xsd:integer" required="false" default="10"/>
          <param name="showInactive" style="query" type="xsd:boolean" required="false" default="false"/>
        </request>
        <response status="200"><doc>Paginated list of patients.</doc></response>
        <response status="500"><doc>FHIR server error.</doc></response>
      </method>

      <resource path="/{id}">
        <param name="id" style="template" type="xsd:string" required="true"/>
        <method name="GET" id="getPatient">
          <doc>Get a single FHIR Patient resource.</doc>
          <response status="200"><doc>FHIR Patient resource.</doc></response>
          <response status="404"><doc>Not found.</doc></response>
        </method>
        <method name="PUT" id="updatePatient">
          <doc>Update insurance identifiers on the FHIR Patient.</doc>
          <request><representation mediaType="application/json"/></request>
          <response status="200"><doc>Updated FHIR Patient.</doc></response>
        </method>

        <resource path="/service-requests">
          <method name="GET" id="listPatientOrders">
            <doc>List ServiceRequests for a specific patient.</doc>
            <response status="200"><doc>List of orders for the patient.</doc></response>
          </method>
        </resource>

        <resource path="/diagnostic-reports">
          <method name="GET" id="listPatientResults">
            <doc>List DiagnosticReports for a specific patient.</doc>
            <response status="200"><doc>List of results for the patient.</doc></response>
          </method>
        </resource>
      </resource>
    </resource>

    <!-- ── Deep Linking (KIS/PIS integration) ──────────────────────── -->

    <resource path="/deeplink/order-entry">
      <method name="GET" id="deepLinkOrderEntry">
        <doc>
          Deep-link entry point for KIS/PIS systems.
          Validates a signed token (JWT or HMAC-SHA256), verifies the FHIR Patient,
          and issues a 302 redirect to the order-entry workflow.
          Requires DEEPLINK_ENABLED=true. Every request is audit-logged.
          On error: redirects to /deeplink/error?code=CODE.
        </doc>
        <request>
          <param name="token"       style="query" type="xsd:string"  required="false" description="HS256 JWT (auth_type=jwt)"/>
          <param name="patientId"   style="query" type="xsd:string"  required="false" description="FHIR Patient ID (auth_type=hmac)"/>
          <param name="ts"          style="query" type="xsd:integer" required="false" description="Unix timestamp (auth_type=hmac)"/>
          <param name="nonce"       style="query" type="xsd:string"  required="false" description="Unique nonce (auth_type=hmac)"/>
          <param name="source"      style="query" type="xsd:string"  required="false" description="Source system ID (auth_type=hmac)"/>
          <param name="sig"         style="query" type="xsd:string"  required="false" description="HMAC-SHA256 hex digest (auth_type=hmac)"/>
          <param name="context"     style="query" type="xsd:string"  required="false" description="order-entry | patient | results"/>
          <param name="encounterId" style="query" type="xsd:string"  required="false" description="FHIR Encounter ID (optional)"/>
        </request>
        <response status="302"><doc>Redirect to order workflow or /deeplink/error page.</doc></response>
      </method>
    </resource>

    <!-- ── Mail (Admin) ─────────────────────────────────────────────── -->
    <!-- Preferred paths: /v1/admin/mail/status and /v1/admin/mail/test  -->

    <resource path="/admin/mail/status">
      <method name="GET" id="getMailStatus">
        <doc>
          Returns the current mail provider configuration status.
          No credentials or secrets are ever included in the response.
          Admin role required.
        </doc>
        <response status="200">
          <doc>{ configured: boolean, provider?: string, authType?: string, host?: string, port?: number, from?: string }</doc>
        </response>
        <response status="401"><doc>Not authenticated.</doc></response>
        <response status="403"><doc>Admin role required.</doc></response>
      </method>
    </resource>

    <resource path="/admin/mail/test">
      <method name="POST" id="testMail">
        <doc>
          Verifies the configured SMTP connection (MAIL_PROVIDER + MAIL_AUTH_TYPE).
          If "to" is provided, a real test email is also sent.
          Admin role required.
        </doc>
        <request>
          <representation mediaType="application/json">
            <param name="to" style="plain" type="xsd:string" required="false"
                   description="Recipient address — if provided, a test email is sent after SMTP verify"/>
          </representation>
        </request>
        <response status="200"><doc>{ ok: true,  message: string, provider?: string, from?: string, durationMs?: number }</doc></response>
        <response status="502"><doc>{ ok: false, message: string, provider?: string, durationMs?: number } — SMTP unreachable</doc></response>
        <response status="503"><doc>{ ok: false, message: string } — MAIL_PROVIDER not configured</doc></response>
        <response status="401"><doc>Not authenticated.</doc></response>
        <response status="403"><doc>Admin role required.</doc></response>
      </method>
    </resource>

    <!-- ── Settings & FHIR health (Admin) ──────────────────────────── -->

    <resource path="/settings">
      <method name="GET" id="getSettings">
        <doc>
          Returns non-secret application settings for the browser: FHIR base URL,
          active FHIR auth type, monitoring/tracing dashboard URLs and labels.
          Used by the sidebar navigation and the /account/system status page.
        </doc>
        <response status="200"><doc>Settings object (fhirBaseUrl, fhirAuthType, monitoringUrl, monitoringLabel, tracingUrl, tracingLabel).</doc></response>
        <response status="401"><doc>Not authenticated.</doc></response>
      </method>
    </resource>

    <resource path="/fhir-health">
      <method name="GET" id="fhirHealthCheck">
        <doc>
          Tests the FHIR server connection using the currently configured FHIR_AUTH_TYPE.
          Calls GET /metadata (CapabilityStatement). Always returns HTTP 200;
          use the "ok" field to determine success. Admin role required.
        </doc>
        <response status="200"><doc>{ ok: boolean, message: string, fhirVersion?: string, server?: string }</doc></response>
        <response status="401"><doc>Not authenticated.</doc></response>
        <response status="403"><doc>Admin role required.</doc></response>
      </method>
    </resource>

    <!-- ── Admin — Config ────────────────────────────────────────────── -->

    <resource path="/env/schema">
      <method name="GET" id="getEnvSchema">
        <doc>Complete catalog of all ENV variables with descriptions, defaults, and group. Admin only.</doc>
        <response status="200"><doc>Array of ENV schema entries.</doc></response>
        <response status="401"><doc>Not authenticated.</doc></response>
        <response status="403"><doc>Admin role required.</doc></response>
      </method>
    </resource>

    <resource path="/env">
      <method name="GET" id="getEnv">
        <doc>Returns current values of whitelisted ENV variables (secrets masked). Admin only.</doc>
        <response status="200"><doc>Array of { key, value } pairs.</doc></response>
        <response status="401"><doc>Not authenticated.</doc></response>
        <response status="403"><doc>Admin role required.</doc></response>
      </method>
      <method name="POST" id="setEnv">
        <doc>Writes changes to .env.local (Docker/local only). Returns 405 on Vercel. Admin only.</doc>
        <request><representation mediaType="application/json"/></request>
        <response status="200"><doc>Save result.</doc></response>
        <response status="405"><doc>Not available in this environment (Vercel).</doc></response>
        <response status="401"><doc>Not authenticated.</doc></response>
        <response status="403"><doc>Admin role required.</doc></response>
      </method>
    </resource>

    <resource path="/config">
      <method name="GET" id="getConfig">
        <doc>Returns all config entries with source metadata (env / override / default). Admin only.</doc>
        <response status="200"><doc>Config entries array.</doc></response>
        <response status="401"><doc>Not authenticated.</doc></response>
        <response status="403"><doc>Admin role required.</doc></response>
      </method>
      <method name="POST" id="setConfig">
        <doc>Saves runtime overrides to data/config.json. Takes effect immediately, no restart needed. Returns 405 on Vercel.</doc>
        <request><representation mediaType="application/json"/></request>
        <response status="200"><doc>Save result.</doc></response>
        <response status="405"><doc>Not available in this environment (Vercel).</doc></response>
        <response status="401"><doc>Not authenticated.</doc></response>
        <response status="403"><doc>Admin role required.</doc></response>
      </method>
    </resource>

    <resource path="/metrics">
      <method name="GET" id="getMetrics">
        <doc>
          Prometheus text exposition metrics. Auth: Bearer METRICS_TOKEN if set,
          otherwise admin session. Used by Prometheus scrapers.
        </doc>
        <response status="200"><doc>Prometheus text format (text/plain).</doc></response>
        <response status="401"><doc>Not authenticated.</doc></response>
        <response status="403"><doc>Admin role required.</doc></response>
      </method>
    </resource>

    <!-- ── Users (Admin) ─────────────────────────────────────────────── -->

    <resource path="/users">
      <doc>Admin-only user management. Requires role=admin session cookie.</doc>
      <method name="GET" id="listUsers">
        <doc>List local users with pagination and filtering.</doc>
        <request>
          <param name="q"        style="query" type="xsd:string"  required="false"/>
          <param name="role"     style="query" type="xsd:string"  required="false"/>
          <param name="status"   style="query" type="xsd:string"  required="false"/>
          <param name="page"     style="query" type="xsd:integer" required="false" default="1"/>
          <param name="pageSize" style="query" type="xsd:integer" required="false" default="20"/>
        </request>
        <response status="200"><doc>Paginated list of users.</doc></response>
        <response status="401"><doc>Not authenticated.</doc></response>
        <response status="403"><doc>Forbidden — admin role required.</doc></response>
      </method>
      <method name="POST" id="createUser">
        <doc>Create a new local or external user.</doc>
        <request><representation mediaType="application/json"/></request>
        <response status="201"><doc>Created user object.</doc></response>
        <response status="400"><doc>Invalid request body.</doc></response>
        <response status="409"><doc>Username already exists.</doc></response>
      </method>

      <resource path="/{id}">
        <param name="id" style="template" type="xsd:string" required="true"/>
        <method name="GET" id="getUser">
          <doc>Get a single user by ID.</doc>
          <response status="200"><doc>User object.</doc></response>
          <response status="404"><doc>User not found.</doc></response>
        </method>
        <method name="PUT" id="updateUser">
          <doc>Update role, status, or profile of a user.</doc>
          <request><representation mediaType="application/json"/></request>
          <response status="200"><doc>Updated user object.</doc></response>
          <response status="404"><doc>User not found.</doc></response>
        </method>
        <method name="DELETE" id="deleteUser">
          <doc>Permanently remove a user from the local store.</doc>
          <response status="200"><doc>Delete confirmation.</doc></response>
          <response status="404"><doc>User not found.</doc></response>
        </method>

        <resource path="/sync">
          <method name="POST" id="syncUserToFhir">
            <doc>
              Sync user profile to FHIR. Creates/updates Practitioner,
              PractitionerRole, and Organization resources. Idempotent.
            </doc>
            <response status="200"><doc>Sync result with FHIR resource IDs.</doc></response>
            <response status="404"><doc>User not found.</doc></response>
            <response status="422"><doc>User profile incomplete (ptype required).</doc></response>
          </method>
        </resource>
      </resource>
    </resource>

  </resources>

</application>`;

export async function GET() {
  return new NextResponse(WADL, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'inline; filename="application.wadl"',
    },
  });
}
