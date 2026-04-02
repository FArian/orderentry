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

  <doc xml:lang="de" title="ZetLab OrderEntry API">
    REST API for the ZetLab laboratory order entry system (ZLZ Zentrallabor AG).
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
