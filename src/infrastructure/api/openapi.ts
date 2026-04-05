/**
 * OpenAPI 3.0 specification for the z2Lab OrderEntry API.
 *
 * This module is the single source of truth for the API contract.
 * It is served at GET /api/openapi.json and rendered by the Swagger UI
 * at GET /api/docs.
 *
 * Rule: "If it is not documented here, it does not exist."
 *
 * Authentication:
 *   Browser / Swagger UI:  session cookie (POST /api/login)
 *   External clients:      Bearer token via one of:
 *     - JWT:  POST /api/auth/token  → { accessToken, tokenType, expiresIn }
 *     - PAT:  POST /api/users/{id}/token  → { token, createdAt }  (admin only, one-time)
 *
 * Dynamic values: all lab-specific identifiers (org ID, name, code) are read from
 * EnvConfig at module load time — no hardcoded organisation strings in this file.
 */

import { EnvConfig } from "@/infrastructure/config/EnvConfig";

/** Short lab code derived from labOrgId (the segment before the first hyphen). */
const labCode = EnvConfig.labOrgId.split("-")[0] ?? EnvConfig.labOrgId;

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "z2Lab OrderEntry API",
    version: "2.0.0",
    description:
      `REST API for the **z2Lab** OrderEntry system — *${EnvConfig.labName} & ZetLab AG*.\n\n` +
      "**Autor:** Farhad Arian  \n" +
      "**Funktion:** CTO  \n" +
      `**Hauptlabor:** ${EnvConfig.labName} — [zlz.ch](https://www.zlz.ch)  \n` +
      `**Tochtergesellschaft:** ZetLab AG *(unter ${EnvConfig.labName})* — [zetlab.ch](https://zetlab.ch)\n\n` +
      "All FHIR data is proxied through a HAPI FHIR R4 server.\n\n" +
      "## Authentication\n\n" +
      "**Session cookie (browser / Swagger UI)**\n" +
      "Log in via `POST /api/login` — receives a signed HMAC-SHA256 session cookie.\n\n" +
      "**Bearer JWT (external clients — short-lived)**\n" +
      "```\nPOST /api/auth/token\nBody: { username, password, expiresIn: '24h' }\n" +
      "→ { accessToken: 'eyJ...', tokenType: 'Bearer', expiresIn: 86400 }\n```\n\n" +
      "**Bearer PAT (external clients — long-lived)**\n" +
      "Admin generates a Personal Access Token via `POST /api/users/{id}/token`.\n" +
      "Token format: `ztk_<64 hex chars>`. Stored hashed, shown once.\n\n" +
      "Use the `Authorize` button above to set your Bearer token.",
    contact: {
      name: `Farhad Arian — ${EnvConfig.labName} & ZetLab AG`,
      url: "https://zetlab.ch",
    },
    license: {
      name: `Proprietary — ${EnvConfig.labName}`,
      url: "https://www.zlz.ch",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1 — stable, recommended for all external clients and integrations",
    },
    {
      url: "/api",
      description: "Unversioned — legacy path, maintained for backward compatibility",
    },
  ],
  tags: [
    {
      name: "Results",
      description:
        "FHIR DiagnosticReport resources — lab results linked to patients and orders.",
    },
    {
      name: "Orders",
      description:
        "FHIR ServiceRequest resources — laboratory orders placed for patients.",
    },
    {
      name: "Patients",
      description: "FHIR Patient resources.",
    },
    {
      name: "Auth",
      description: "Session authentication endpoints.",
    },
    {
      name: "Users",
      description:
        "Admin user management — CRUD for local users and FHIR Practitioner sync. " +
        "All endpoints require admin role (session cookie or Bearer token).",
    },
    {
      name: "Admin — Registry",
      description:
        "FHIR Organization and Practitioner registry management. " +
        "Create, update, and delete Organizations and Practitioners in the FHIR server. " +
        "All endpoints require admin role.",
    },
    {
      name: "Admin — Merge",
      description:
        "Detect and merge duplicate registry entries (same GLN). " +
        "All endpoints require admin role.",
    },
    {
      name: "Admin — Tasks",
      description:
        "Detect incomplete registry entries (missing GLN). " +
        "All endpoints require admin role.",
    },
    {
      name: "Admin — Config",
      description:
        "Runtime configuration and environment variable management. " +
        "All endpoints require admin role.",
    },
    {
      name: "Tokens",
      description:
        "API token management — obtain JWT access tokens and manage Personal Access Tokens (PAT).",
    },
    {
      name: "Mail",
      description:
        "Outbound mail configuration and test endpoints. " +
        "Provider and credentials are configured via `MAIL_*` ENV variables. " +
        "All endpoints require admin role.",
    },
    {
      name: "Orchestra",
      description:
        "OIE Juno integration — context launch from Orchestra into OrderEntry. " +
        "Orchestra calls `POST /api/launch` with a signed HS256 JWT to create a session " +
        "and redirect the clinician directly to the order entry screen.",
    },
    {
      name: "Integration",
      description:
        "Deep-link and system integration endpoints. " +
        "Allows external KIS/PIS systems to open OrderEntry directly with a pre-loaded patient. " +
        "Requires DEEPLINK_ENABLED=true and a shared secret (JWT or HMAC-SHA256). " +
        "Every request is audit-logged.",
    },
    {
      name: "Agent",
      description:
        "Local Agent job queue — print jobs (ZPL barcode labels + Begleitschein PDF) and ORU dispatch. " +
        "The Agent polls `GET /agent/jobs` every few seconds and marks completed jobs via `POST /agent/jobs/{id}/done`. " +
        "Authentication: Bearer JWT or PAT (`ztk_...`). " +
        "Routing: `orgId` (mandatory) selects the organisation; `locationId` (optional) targets a department agent — " +
        "omitting it broadcasts the job to all agents of that organisation.",
    },
    {
      name: "FHIR Proxy",
      description:
        "Server-side proxies for FHIR resources on the HAPI FHIR R4 server. " +
        "Used by the Local Agent (e.g. fetching DocumentReference PDFs) and by the UI. " +
        "Authentication: Bearer JWT, PAT, or session cookie.",
    },
    {
      name: "Orders — Numbers",
      description:
        "Order number generation via the strategy engine. " +
        "Requests a new unique order number for a given organisation (by GLN) and service type " +
        "(MIBI, ROUTINE, POC). Orchestra API is tried first; pre-reserved pool is used as fallback. " +
        "If the pool is exhausted the request is blocked until an admin replenishes the pool.",
    },
    {
      name: "Admin — Org Rules",
      description:
        "Organisation-specific configuration rules — HL7 MSH segments, patient/case number prefixes, " +
        "and routing metadata per organisation (identified by FHIR ID or GLN). " +
        "All endpoints require admin role.",
    },
    {
      name: "Admin — Number Pool",
      description:
        "Pre-reserved order number pool management. " +
        "Admins can add numbers, delete unused entries, and configure alert thresholds (Info / Warn / Error). " +
        "Threshold breaches trigger email notifications (anti-spam: one email per level until pool is refilled). " +
        "All endpoints require admin role.",
    },
  ],
  paths: {
    // ── Results ───────────────────────────────────────────────────────────────
    "/diagnostic-reports": {
      get: {
        tags: ["Results"],
        summary: "List DiagnosticReports (lab results)",
        description:
          "Returns a paginated list of FHIR DiagnosticReport resources mapped to " +
          "the domain Result DTO. Supports filtering by patient ID, patient name, " +
          "order number, status, and free-text code search.",
        operationId: "listResults",
        parameters: [
          {
            name: "q",
            in: "query",
            description: "Free-text code search (forwarded to FHIR ?code=)",
            schema: { type: "string" },
          },
          {
            name: "status",
            in: "query",
            description: "FHIR DiagnosticReport status",
            schema: {
              type: "string",
              enum: [
                "registered",
                "partial",
                "preliminary",
                "final",
                "amended",
                "corrected",
                "cancelled",
              ],
            },
          },
          {
            name: "patientId",
            in: "query",
            description: "Exact FHIR Patient ID (preferred over patientName)",
            schema: { type: "string" },
          },
          {
            name: "patientName",
            in: "query",
            description:
              "Patient name search — used only when patientId is absent " +
              "(FHIR chained search: subject:Patient.name)",
            schema: { type: "string" },
          },
          {
            name: "orderNumber",
            in: "query",
            description:
              "Filter by ServiceRequest identifier (order number). " +
              "Uses FHIR chained search: based-on:ServiceRequest.identifier",
            schema: { type: "string" },
          },
          {
            name: "page",
            in: "query",
            description: "1-based page number",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            description: "Results per page",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of results",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PagedResultsResponse" },
                examples: {
                  success: {
                    summary: "Two final reports",
                    value: {
                      data: [
                        {
                          id: "dr-001",
                          status: "final",
                          codeText: "Blutbild",
                          category: "Hämatologie",
                          effectiveDate: "2024-03-15T10:00:00Z",
                          resultCount: 12,
                          conclusion: "",
                          basedOn: ["ServiceRequest/sr-001"],
                          patientId: "p-123",
                          patientDisplay: "Müller Hans",
                          pdfData: null,
                          pdfTitle: null,
                          hl7Data: null,
                          hl7Title: null,
                        },
                      ],
                      total: 1,
                      page: 1,
                      pageSize: 20,
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "FHIR server unreachable or internal error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    // ── Orders ────────────────────────────────────────────────────────────────
    "/service-requests": {
      get: {
        tags: ["Orders"],
        summary: "List ServiceRequests (orders)",
        description:
          "Returns the 50 most recently updated laboratory orders from the FHIR server.",
        operationId: "listOrders",
        responses: {
          "200": {
            description: "List of orders",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListOrdersResponse" },
                examples: {
                  success: {
                    summary: "One active order",
                    value: {
                      data: [
                        {
                          id: "sr-001",
                          status: "active",
                          intent: "order",
                          codeText: "Grosses Blutbild",
                          authoredOn: "2024-03-15T09:00:00Z",
                          orderNumber: `${labCode}-2024-001`,
                          specimenCount: 1,
                          patientId: "p-123",
                        },
                      ],
                      total: 1,
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "FHIR server unreachable or internal error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/service-requests/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Get a single ServiceRequest",
        description: "Returns the raw FHIR ServiceRequest resource by ID.",
        operationId: "getOrder",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "FHIR resource ID",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "FHIR ServiceRequest resource",
            content: { "application/fhir+json": { schema: { type: "object" } } },
          },
          "404": { description: "Not found" },
          "500": {
            description: "FHIR server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Orders"],
        summary: "Update a ServiceRequest",
        description:
          "Replaces a FHIR ServiceRequest resource with the provided body (PUT semantics).",
        operationId: "updateOrder",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/fhir+json": { schema: { type: "object" } },
          },
        },
        responses: {
          "200": { description: "Updated FHIR ServiceRequest" },
          "400": { description: "Invalid FHIR resource" },
          "500": {
            description: "FHIR server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Orders"],
        summary: "Delete a ServiceRequest (hard or soft)",
        description:
          "Attempts a hard DELETE. If the FHIR server returns 409 (referential integrity " +
          "violation), falls back to soft-delete by setting status to 'entered-in-error'.",
        operationId: "deleteOrder",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Delete result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeleteOrderResponse" },
                examples: {
                  hardDelete: {
                    summary: "Hard delete succeeded",
                    value: { deleted: true },
                  },
                  softDelete: {
                    summary: "Soft delete (409 fallback)",
                    value: { deleted: true, soft: true },
                  },
                },
              },
            },
          },
          "404": { description: "Not found" },
          "500": {
            description: "FHIR server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    // ── Patients ──────────────────────────────────────────────────────────────
    "/patients": {
      get: {
        tags: ["Patients"],
        summary: "Search patients",
        description:
          "Returns a paginated list of active (or inactive) FHIR Patient resources. " +
          "Filters by name when ?q= is provided.",
        operationId: "listPatients",
        parameters: [
          {
            name: "q",
            in: "query",
            description: "Name search string",
            schema: { type: "string" },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 10 },
          },
          {
            name: "showInactive",
            in: "query",
            description: "When true, returns inactive patients instead of active",
            schema: { type: "boolean", default: false },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of patients",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PagedPatientsResponse" },
              },
            },
          },
          "500": {
            description: "FHIR server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/patients/{id}": {
      get: {
        tags: ["Patients"],
        summary: "Get a single patient",
        description: "Returns the raw FHIR Patient resource by ID.",
        operationId: "getPatient",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "FHIR Patient resource",
            content: { "application/fhir+json": { schema: { type: "object" } } },
          },
          "404": { description: "Not found" },
          "500": {
            description: "FHIR server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Patients"],
        summary: "Update patient insurance identifiers",
        description:
          "Updates AHV, VeKa, IK, and VNR identifiers on the FHIR Patient resource " +
          "while preserving all other existing identifiers.",
        operationId: "updatePatient",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ahv: {
                    type: "string",
                    description: "Swiss AHV number (OID 2.16.756.5.32)",
                  },
                  veka: {
                    type: "string",
                    description: "VeKa card number (OID 2.16.756.5.30.1.123.100.1.1)",
                  },
                  ik: {
                    type: "string",
                    description: "Swiss insurer IK code",
                  },
                  vnr: {
                    type: "string",
                    description: "Insurance policy number (VNR)",
                  },
                  insurerName: {
                    type: "string",
                    description: "Display name of the insurer (used as IK assigner)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated FHIR Patient resource" },
          "400": { description: "Missing patient ID" },
          "500": {
            description: "FHIR server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/patients/{id}/service-requests": {
      get: {
        tags: ["Patients", "Orders"],
        summary: "List orders for a patient",
        description: "Returns all ServiceRequests where subject = Patient/{id}.",
        operationId: "listPatientOrders",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "FHIR Patient ID",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "List of orders for the patient",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListOrdersResponse" },
              },
            },
          },
          "400": { description: "Missing patient ID" },
          "500": {
            description: "FHIR server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/patients/{id}/diagnostic-reports": {
      get: {
        tags: ["Patients", "Results"],
        summary: "List results for a patient",
        description: "Returns all DiagnosticReports where subject = Patient/{id}.",
        operationId: "listPatientResults",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "FHIR Patient ID",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "List of results for the patient",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PagedResultsResponse" },
              },
            },
          },
          "400": { description: "Missing patient ID" },
          "500": {
            description: "FHIR server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    // ── Users (admin) ─────────────────────────────────────────────────────────
    "/users": {
      get: {
        tags: ["Users"],
        summary: "List users",
        description: "Returns a paginated list of local users. Requires admin role.",
        operationId: "listUsers",
        parameters: [
          {
            name: "q",
            in: "query",
            description: "Username search string",
            schema: { type: "string" },
          },
          {
            name: "role",
            in: "query",
            description: "Filter by role",
            schema: { type: "string", enum: ["admin", "user"] },
          },
          {
            name: "status",
            in: "query",
            description: "Filter by status",
            schema: { type: "string", enum: ["active", "pending", "suspended"] },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of users",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PagedUsersResponse" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Forbidden — admin role required" },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Create a user",
        description: "Creates a new local or external user. Requires admin role.",
        operationId: "createUser",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateUserRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          "400": { description: "Invalid request body" },
          "401": { description: "Not authenticated" },
          "403": { description: "Forbidden — admin role required" },
          "409": { description: "Username already exists" },
        },
      },
    },

    "/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Get a user by ID",
        description: "Returns a single user. Requires admin role.",
        operationId: "getUser",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "User",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Forbidden — admin role required" },
          "404": { description: "User not found" },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update a user",
        description: "Updates role, status, or profile of a user. Requires admin role.",
        operationId: "updateUser",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateUserRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Forbidden — admin role required" },
          "404": { description: "User not found" },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete a user",
        description: "Permanently removes a user from the local store. Requires admin role.",
        operationId: "deleteUser",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Delete confirmation",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeleteUserResponse" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Forbidden — admin role required" },
          "404": { description: "User not found" },
        },
      },
    },

    "/users/{id}/sync": {
      post: {
        tags: ["Users"],
        summary: "Sync user to FHIR",
        description:
          "Creates or updates Practitioner / PractitionerRole / Organization " +
          "resources in the FHIR server based on the user profile. " +
          "Idempotent — safe to call multiple times. Requires admin role.",
        operationId: "syncUserToFhir",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Sync result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserSyncResponse" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Forbidden — admin role required" },
          "404": { description: "User not found" },
        },
      },
    },

    // ── User permissions ──────────────────────────────────────────────────────
    "/users/{id}/permissions": {
      put: {
        tags: ["Users"],
        summary: "Update individual user permissions",
        description:
          "Assigns extra permissions to a user beyond their base role. " +
          "Permissions must be from the ASSIGNABLE_PERMISSIONS whitelist. " +
          "Requires admin role.",
        operationId: "updateUserPermissions",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["permissions"],
                properties: {
                  permissions: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of permission strings to assign (replaces existing).",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated permissions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id:               { type: "string" },
                    extraPermissions: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Forbidden — admin role required" },
          "404": { description: "User not found" },
          "422": { description: "Unknown permission in list" },
        },
      },
    },

    // ── Patient status ────────────────────────────────────────────────────────
    "/patients/{id}/status": {
      patch: {
        tags: ["Patients"],
        summary: "Activate or deactivate a patient",
        description:
          "Sets the FHIR Patient.active flag. " +
          "Requires permission patient:activate (admin or individually granted).",
        operationId: "setPatientStatus",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["active"],
                properties: {
                  active: { type: "boolean", description: "true = activate, false = deactivate" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Status updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id:     { type: "string" },
                    active: { type: "boolean" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid body" },
          "401": { description: "Not authenticated" },
          "403": { description: "Permission patient:activate required" },
          "404": { description: "Patient not found" },
        },
      },
    },

    // ── Mail (admin) ──────────────────────────────────────────────────────────
    "/admin/mail/status": {
      get: {
        tags: ["Mail"],
        summary: "Mail configuration status",
        description:
          "Returns the current mail provider configuration. " +
          "No secrets (passwords, tokens) are ever included. Requires admin role.",
        operationId: "getMailStatus",
        responses: {
          "200": {
            description: "Current mail status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MailStatusResponse" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Forbidden — admin role required" },
        },
      },
    },

    "/admin/mail/test": {
      post: {
        tags: ["Mail"],
        summary: "Test mail connection",
        description:
          "Verifies the SMTP connection and optionally sends a test email to the given address. " +
          "Requires admin role. Never logs credentials.",
        operationId: "testMail",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MailTestRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "SMTP verification succeeded (optionally: test email sent)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MailTestResponse" },
              },
            },
          },
          "502": {
            description: "SMTP unreachable or authentication failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MailTestResponse" },
              },
            },
          },
          "503": {
            description: "MAIL_PROVIDER not configured",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MailTestResponse" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Forbidden — admin role required" },
        },
      },
    },

    // ── Auth ──────────────────────────────────────────────────────────────────
    "/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        description:
          "Authenticates a user and sets a signed HMAC-SHA256 session cookie.",
        operationId: "login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Login successful" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout",
        description: "Clears the session cookie.",
        operationId: "logout",
        responses: {
          "200": { description: "Logged out" },
        },
      },
    },
    "/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current session",
        description: "Returns the currently authenticated user.",
        operationId: "getMe",
        responses: {
          "200": {
            description: "Current user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },

    // ── Token endpoints ────────────────────────────────────────────────────────
    "/auth/token": {
      post: {
        tags: ["Tokens"],
        summary: "Exchange credentials for a JWT access token",
        description:
          "Admin users can exchange their username and password for a short-lived JWT. " +
          "Use the returned `accessToken` as `Authorization: Bearer <token>` on subsequent requests.",
        operationId: "exchangeCredentialsForJwt",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ExchangeCredentialsRequest" },
              examples: {
                default: {
                  value: { username: "admin", password: "Admin1234!", expiresIn: "24h" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "JWT issued",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AccessTokenResponse" },
                examples: {
                  success: {
                    value: {
                      accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                      tokenType: "Bearer",
                      expiresIn: 86400,
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Missing or invalid fields" },
          "401": { description: "Invalid credentials" },
          "403": { description: "User does not have admin role" },
        },
      },
    },

    "/users/{id}/token": {
      post: {
        tags: ["Tokens"],
        summary: "Generate a Personal Access Token (PAT)",
        description:
          "Generates a new PAT for the specified admin user. " +
          "The plaintext token (`ztk_...`) is returned **once** and cannot be retrieved again. " +
          "Store it securely immediately. Replaces any existing token.",
        operationId: "generatePat",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "User ID" },
        ],
        responses: {
          "201": {
            description: "PAT generated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenerateTokenResponse" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Not an admin user" },
          "404": { description: "User not found" },
        },
      },
      delete: {
        tags: ["Tokens"],
        summary: "Revoke a Personal Access Token",
        description: "Deletes the stored PAT hash for the user. The token immediately stops working.",
        operationId: "revokePat",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "User ID" },
        ],
        responses: {
          "200": {
            description: "PAT revoked",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RevokeTokenResponse" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Not an admin user" },
          "404": { description: "User not found" },
        },
      },
    },

    // ── Orchestra / Launch ────────────────────────────────────────────────────
    "/launch": {
      post: {
        tags: ["Orchestra"],
        summary: "Orchestra context launch (JWT-secured)",
        description:
          "Called by OIE Juno (Orchestra) to launch OrderEntry in the context of a specific " +
          "patient and clinician. Creates a signed session cookie and returns a redirect URL " +
          "so the browser lands directly on the order entry screen.\n\n" +
          "**JWT contract:**\n" +
          "- Algorithm: `HS256`\n" +
          "- Secret: `ORCHESTRA_JWT_SECRET` (shared between Orchestra and OrderEntry)\n" +
          "- Issuer (`iss`): `orchestra`\n" +
          "- Required claims: `sub`, `patientId`, `practitionerId`, `organizationId`, `exp`, `iss`\n" +
          "- Max expiry: 5 minutes from issuance\n\n" +
          "**Error format:** RFC 7807 Problem Details — Orchestra parses `status` and `detail`.",
        operationId: "launch",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LaunchRequest" },
              example: {
                patientId: "Patient/p-123",
                practitionerId: "Practitioner/prac-456",
                organizationId: "Organization/org-789",
                token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Session created — redirect URL returned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LaunchResponse" },
                example: { redirectUrl: "/order/new?patientId=Patient%2Fp-123" },
              },
            },
          },
          "400": {
            description: "Missing or malformed request body",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProblemDetails" },
              },
            },
          },
          "401": {
            description: "JWT invalid, expired, or missing required claims",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProblemDetails" },
                example: {
                  type: "https://tools.ietf.org/html/rfc7807",
                  title: "Unauthorized",
                  status: 401,
                  detail: "JWT signature invalid or expired",
                  instance: "/api/launch",
                },
              },
            },
          },
        },
      },
    },

    // ── Admin — Registry: Organizations ──────────────────────────────────────
    "/fhir/organizations": {
      get: {
        tags: ["Admin — Registry"],
        summary: "List all FHIR Organizations",
        description: "Returns a FHIR searchset Bundle of all Organization resources.",
        operationId: "listOrganizations",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "FHIR Bundle of Organizations",
            content: { "application/fhir+json": { schema: { $ref: "#/components/schemas/FhirBundle" } } },
          },
          "401": { description: "Not authenticated" },
        },
      },
      post: {
        tags: ["Admin — Registry"],
        summary: "Create a FHIR Organization",
        description: "Creates a new Organization in FHIR (idempotent PUT by GLN-derived ID).",
        operationId: "createOrganization",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateOrganizationRequest" },
              examples: {
                default: { value: { name: "Praxis Müller", gln: "7601234567890" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Organization resource created/updated", content: { "application/fhir+json": { schema: { $ref: "#/components/schemas/FhirResource" } } } },
          "400": { description: "Validation error (GLN required)" },
          "401": { description: "Not authenticated" },
          "409": { description: "GLN already registered" },
        },
      },
    },

    "/fhir/organizations/{id}": {
      put: {
        tags: ["Admin — Registry"],
        summary: "Update a FHIR Organization",
        operationId: "updateOrganization",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateOrganizationRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Updated Organization resource", content: { "application/fhir+json": { schema: { $ref: "#/components/schemas/FhirResource" } } } },
          "400": { description: "Validation error" },
          "401": { description: "Not authenticated" },
        },
      },
      delete: {
        tags: ["Admin — Registry"],
        summary: "Delete a FHIR Organization",
        operationId: "deleteOrganization",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OperationOutcome (success)", content: { "application/fhir+json": { schema: { $ref: "#/components/schemas/FhirOperationOutcome" } } } },
          "401": { description: "Not authenticated" },
          "502": { description: "FHIR server error" },
        },
      },
    },

    // ── Admin — Registry: Practitioners ──────────────────────────────────────
    "/fhir/practitioners": {
      get: {
        tags: ["Admin — Registry"],
        summary: "List all FHIR Practitioners and their roles",
        description: "Returns a FHIR Bundle with PractitionerRole resources + included Practitioner and Organization.",
        operationId: "listPractitioners",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "FHIR Bundle (PractitionerRole + includes)",
            content: { "application/fhir+json": { schema: { $ref: "#/components/schemas/FhirBundle" } } },
          },
          "401": { description: "Not authenticated" },
        },
      },
      post: {
        tags: ["Admin — Registry"],
        summary: "Create a FHIR Practitioner and PractitionerRole",
        description: "Writes a FHIR transaction bundle: Practitioner + PractitionerRole linked to org.",
        operationId: "createPractitioner",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePractitionerRequest" },
              examples: {
                default: {
                  value: {
                    firstName: "Hans",
                    lastName: "Müller",
                    gln: "7601001234567",
                    organizationId: "org-7601234567890",
                    roleCode: "GrpPra",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "PractitionerRole resource", content: { "application/fhir+json": { schema: { $ref: "#/components/schemas/FhirResource" } } } },
          "400": { description: "Validation error (GLN, name, org required)" },
          "401": { description: "Not authenticated" },
          "409": { description: "GLN already registered" },
        },
      },
    },

    "/fhir/practitioners/{id}": {
      put: {
        tags: ["Admin — Registry"],
        summary: "Update a PractitionerRole",
        description: "Updates the role code and organization on an existing PractitionerRole. Optionally updates the GLN on the linked Practitioner.",
        operationId: "updatePractitioner",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "PractitionerRole ID" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdatePractitionerRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Updated PractitionerRole resource", content: { "application/fhir+json": { schema: { $ref: "#/components/schemas/FhirResource" } } } },
          "400": { description: "Validation error" },
          "401": { description: "Not authenticated" },
        },
      },
    },

    // ── Admin — Merge ─────────────────────────────────────────────────────────
    "/admin/merge": {
      get: {
        tags: ["Admin — Merge"],
        summary: "List duplicate GLN groups",
        description:
          "Scans all Organizations and Practitioners for duplicate GLNs. " +
          "Returns groups of resources sharing the same GLN.",
        operationId: "getMergeStatus",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "Duplicate groups",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdminMergeStatus" },
                examples: {
                  noDuplicates: { value: { total: 0, orgGroups: [], practGroups: [] } },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },

    "/admin/merge/organizations": {
      post: {
        tags: ["Admin — Merge"],
        summary: "Merge two duplicate Organizations",
        description:
          "Remaps all PractitionerRoles from `deleteId` to `keepId`, then deletes the duplicate Organization.",
        operationId: "mergeOrganizations",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MergeOrgsRequest" },
              examples: {
                default: { value: { keepId: "org-7601234567890", deleteId: "org-7601234567891" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Merge result",
            content: { "application/json": { schema: { $ref: "#/components/schemas/MergeResult" } } },
          },
          "400": { description: "Missing or equal IDs" },
          "401": { description: "Not authenticated" },
          "502": { description: "FHIR error during merge" },
        },
      },
    },

    "/admin/merge/practitioners": {
      post: {
        tags: ["Admin — Merge"],
        summary: "Merge two duplicate Practitioners",
        description:
          "Deletes the duplicate PractitionerRole and its Practitioner resource (if no remaining roles).",
        operationId: "mergePractitioners",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MergePractsRequest" },
              examples: {
                default: {
                  value: {
                    keepPractitionerRoleId: "role-7601001234567",
                    deletePractitionerRoleId: "role-7601001234568",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Merge result",
            content: { "application/json": { schema: { $ref: "#/components/schemas/MergeResult" } } },
          },
          "400": { description: "Missing or equal IDs" },
          "401": { description: "Not authenticated" },
        },
      },
    },

    // ── Admin — Tasks ─────────────────────────────────────────────────────────
    "/admin/tasks": {
      get: {
        tags: ["Admin — Tasks"],
        summary: "List records with missing GLN",
        description: "Returns Organizations and Practitioners that are missing a GLN identifier.",
        operationId: "getAdminTasks",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "Incomplete records",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdminTasksResponse" },
                examples: {
                  withTasks: {
                    value: {
                      total: 2,
                      orgsWithoutGln: [{ id: "org-abc", name: "Klinik ABC", gln: "" }],
                      practitionersWithoutGln: [],
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },

    // ── Admin — Config ────────────────────────────────────────────────────────
    "/env/schema": {
      get: {
        tags: ["Admin — Config"],
        summary: "Complete catalog of all supported ENV variables",
        description:
          "Returns every environment variable the application understands, with description, " +
          "default value, current value (secrets masked), writable flag, restart-required flag, " +
          "and logical group. Use this to discover all available configuration options.",
        operationId: "getEnvSchema",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "ENV schema catalog",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EnvSchemaResponse" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
    },

    "/env": {
      get: {
        tags: ["Admin — Config"],
        summary: "Read whitelisted environment variables",
        description: "Returns the current values of non-secret environment variables.",
        operationId: "getEnv",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "Environment variable map", content: { "application/json": { schema: { type: "object" } } } },
          "401": { description: "Not authenticated" },
        },
      },
      post: {
        tags: ["Admin — Config"],
        summary: "Update environment variables in .env.local",
        description: "Writes key-value pairs to .env.local. Returns 405 on Vercel (read-only filesystem).",
        operationId: "updateEnv",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["vars"],
                properties: {
                  vars: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["key", "value"],
                      properties: { key: { type: "string" }, value: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Update result", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "Invalid request body" },
          "401": { description: "Not authenticated" },
          "405": { description: "Not available (Vercel — read-only filesystem)" },
        },
      },
    },

    "/config": {
      get: {
        tags: ["Admin — Config"],
        summary: "Read runtime configuration with source metadata",
        description: "Returns all config values with their source (override / env / default).",
        operationId: "getConfig",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        responses: {
          "200": { description: "Config entries", content: { "application/json": { schema: { type: "object" } } } },
          "401": { description: "Not authenticated" },
        },
      },
      post: {
        tags: ["Admin — Config"],
        summary: "Save runtime config overrides",
        description: "Saves overrides to data/config.json. Changes take effect immediately (no restart). Returns 405 on Vercel.",
        operationId: "updateConfig",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["overrides"],
                properties: {
                  overrides: {
                    type: "object",
                    description: "Key-value map of config overrides. Set value to null to remove.",
                    additionalProperties: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Save result" },
          "400": { description: "Invalid request body" },
          "401": { description: "Not authenticated" },
          "405": { description: "Not available (Vercel)" },
        },
      },
    },

    // ── Mail (legacy — use /admin/mail/test or /v1/admin/mail/test) ──────────
    "/mail/test": {
      post: {
        tags: ["Mail"],
        summary: "Test mail server connection (deprecated — use /admin/mail/test)",
        description:
          "**Deprecated.** Use `POST /admin/mail/test` (or preferably `POST /v1/admin/mail/test`) instead.\n\n" +
          "This path is kept for backward compatibility only and may be removed in a future version.",
        operationId: "testMailLegacy",
        deprecated: true,
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MailTestRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Test result — see POST /admin/mail/test for full schema",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MailTestResponse" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
    },

    // ── Deep Linking ─────────────────────────────────────────────────────────
    "/deeplink/order-entry": {
      get: {
        tags: ["Integration"],
        summary: "Deep-link entry point for KIS/PIS → order-entry workflow",
        description:
          "Validates a signed token from an external system, verifies the FHIR Patient, " +
          "and issues a **302 redirect** to the order-entry workflow with the patient pre-loaded.\n\n" +
          "**Must be enabled:** Set `DEEPLINK_ENABLED=true` and configure a shared secret.\n\n" +
          "**Auth strategies** (`DEEPLINK_AUTH_TYPE`):\n" +
          "- `jwt` (default) — HS256 JWT in `?token=`. Claims: `iss`, `sub` (patientId), `jti` (nonce), `exp`.\n" +
          "- `hmac` — HMAC-SHA256 of the canonical URL in `?sig=`. Requires `?patientId=`, `?ts=`, `?nonce=`, `?source=`.\n\n" +
          "**Security:** nonce replay protection · source-system allowlist · FHIR patient verification · full audit log.\n\n" +
          "**On error:** redirects to `/deeplink/error?code=<CODE>` — never exposes raw errors to the browser.",
        operationId: "deepLinkOrderEntry",
        parameters: [
          {
            name: "token",
            in: "query",
            required: false,
            description: "HS256 JWT (required for auth_type=jwt)",
            schema: { type: "string" },
          },
          {
            name: "patientId",
            in: "query",
            required: false,
            description: "FHIR Patient ID (required for auth_type=hmac)",
            schema: { type: "string" },
          },
          {
            name: "ts",
            in: "query",
            required: false,
            description: "Unix timestamp of signature (required for auth_type=hmac)",
            schema: { type: "integer" },
          },
          {
            name: "nonce",
            in: "query",
            required: false,
            description: "Unique nonce/UUID for replay protection (required for auth_type=hmac)",
            schema: { type: "string" },
          },
          {
            name: "source",
            in: "query",
            required: false,
            description: "Source system identifier (required for auth_type=hmac)",
            schema: { type: "string" },
          },
          {
            name: "sig",
            in: "query",
            required: false,
            description: "HMAC-SHA256 hex digest of canonical URL (required for auth_type=hmac)",
            schema: { type: "string" },
          },
          {
            name: "context",
            in: "query",
            required: false,
            description: "Workflow to open: order-entry | patient | results (default: order-entry)",
            schema: { type: "string", enum: ["order-entry", "patient", "results"] },
          },
          {
            name: "encounterId",
            in: "query",
            required: false,
            description: "FHIR Encounter ID for billing context (optional)",
            schema: { type: "string" },
          },
        ],
        responses: {
          "302": {
            description:
              "Redirect to order-entry workflow (success) or /deeplink/error page (failure). " +
              "The redirect target is always a relative URL on the same origin.",
            headers: {
              Location: {
                description: "Redirect target URL",
                schema: { type: "string" },
              },
            },
          },
        },
      },
    },

    // ── Settings & FHIR health ────────────────────────────────────────────────
    "/settings": {
      get: {
        tags: ["Admin — Config"],
        summary: "Application settings (non-secret)",
        description:
          "Returns a subset of the running configuration that is safe to expose to " +
          "the browser. Includes FHIR base URL, current FHIR auth type, and monitoring/tracing " +
          "dashboard URLs (display-only). Secrets are never included.\n\n" +
          "Used by the sidebar navigation to show connected-system links and by " +
          "`/account/system` to render the connection status overview.",
        operationId: "getSettings",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "Current application settings",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SettingsResponse" },
                example: {
                  fhirBaseUrl: "http://hapi-fhir:8080/fhir",
                  fhirAuthType: "none",
                  monitoringUrl: "https://grafana.example.com",
                  monitoringLabel: "Grafana",
                  tracingUrl: "https://jaeger.example.com",
                  tracingLabel: "Jaeger",
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },

    "/fhir-health": {
      get: {
        tags: ["Admin — Config"],
        summary: "FHIR server connection health check",
        description:
          "Tests the configured FHIR server connection by calling `GET /metadata` " +
          "(FHIR CapabilityStatement). Uses whatever auth method is currently configured " +
          "via `FHIR_AUTH_TYPE`.\n\n" +
          "Useful for verifying that the selected authentication strategy works after " +
          "changing `FHIR_AUTH_*` environment variables.\n\n" +
          "Always returns HTTP 200; use the `ok` field in the body to determine success.",
        operationId: "fhirHealthCheck",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "Health check result (ok: true = reachable, ok: false = error)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FhirHealthResponse" },
                examples: {
                  ok: {
                    summary: "Server reachable",
                    value: { ok: true, message: "FHIR server reachable", fhirVersion: "4.0.1", server: "HAPI FHIR" },
                  },
                  error: {
                    summary: "Server unreachable",
                    value: { ok: false, message: "Connection refused" },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
    },

    // ── Observability ─────────────────────────────────────────────────────────
    "/metrics": {
      get: {
        tags: ["Admin — Config"],
        summary: "Prometheus metrics (text exposition format)",
        description:
          "Returns application metrics in the Prometheus text exposition format.\n\n" +
          "**Scrape configuration:**\n" +
          "```yaml\n" +
          "- job_name: zetlab\n" +
          "  static_configs:\n" +
          "    - targets: ['orderentry:3000']\n" +
          "  metrics_path: /api/metrics\n" +
          "  bearer_token: <METRICS_TOKEN>\n" +
          "```\n\n" +
          "**Authentication:**\n" +
          "- If `METRICS_TOKEN` env var is set: `Authorization: Bearer <METRICS_TOKEN>`\n" +
          "- Otherwise: standard admin session or Bearer JWT/PAT\n\n" +
          "**Available metric families:**\n" +
          "- `zetlab_process_*` — CPU, memory, open file descriptors\n" +
          "- `zetlab_nodejs_*` — event loop lag, GC, heap\n" +
          "- `zetlab_fhir_requests_total{resource,method,status}` — FHIR request counter\n" +
          "- `zetlab_fhir_request_duration_seconds{resource,method,status}` — FHIR latency histogram",
        operationId: "getMetrics",
        security: [{ sessionCookie: [] }, { bearerAuth: [] }],
        responses: {
          "200": {
            description: "Prometheus text exposition format",
            content: {
              "text/plain; version=0.0.4; charset=utf-8": {
                schema: { type: "string", example: "# HELP zetlab_process_cpu_seconds_total...\n" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
    },

    // ── Agent job queue ───────────────────────────────────────────────────────

    "/agent/jobs": {
      get: {
        tags: ["Agent"],
        summary: "Poll pending Agent jobs",
        description:
          "Returns all pending jobs (print and ORU) for the given organisation and optional location.\n\n" +
          "**Routing logic:**\n" +
          "- `locationId` provided → returns jobs targeted at that location **plus** broadcast jobs (`locationId = null`)\n" +
          "- `locationId` omitted → returns broadcast-only jobs\n\n" +
          "The Agent polls this endpoint every few seconds and processes returned jobs sequentially.",
        operationId: "listAgentJobs",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        parameters: [
          {
            name: "orgId",
            in: "query",
            required: true,
            description: "FHIR Organization ID — identifies the lab or clinic",
            schema: { type: "string", example: EnvConfig.labOrgId },
          },
          {
            name: "locationId",
            in: "query",
            required: false,
            description: "FHIR Location ID of the department/station running this Agent instance",
            schema: { type: "string", example: "loc-notaufnahme" },
          },
        ],
        responses: {
          "200": {
            description: "List of pending jobs",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListAgentJobsResponse" },
              },
            },
          },
          "400": { description: "Missing orgId" },
          "401": { description: "Not authenticated" },
        },
      },
      post: {
        tags: ["Agent"],
        summary: "Create a print job (after order submission)",
        description:
          "Creates a pending print job containing ZPL barcode labels (one per specimen) " +
          "and a reference to the Begleitschein PDF stored in HAPI FHIR as a DocumentReference.\n\n" +
          "Called automatically by OrderEntry after every successful order submission.\n\n" +
          `**ZPL format:** CODE128 barcode \`{orderNumber} {materialCode}\` — required by the ${EnvConfig.labName} LIS scanner.\n\n` +
          "**PDF retrieval:** The Agent fetches the DocumentReference PDF via " +
          "`GET /api/v1/proxy/fhir/document-references/{documentReferenceId}`.",
        operationId: "createPrintJob",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePrintJobRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Print job created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreatePrintJobResponse" },
              },
            },
          },
          "400": { description: "Missing required fields (orgId, documentReferenceId, orderNumber)" },
          "401": { description: "Not authenticated" },
        },
      },
    },

    "/agent/jobs/{id}/done": {
      post: {
        tags: ["Agent"],
        summary: "Mark Agent job as completed",
        description:
          "The Agent calls this endpoint after successfully completing a job " +
          "(print sent to printer, ORU delivered to LIS). " +
          "Sets `status → done` and records `doneAt` timestamp.",
        operationId: "markAgentJobDone",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "AgentJob UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Job marked done",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JobDoneResponse" },
              },
            },
          },
          "400": { description: "Missing job id" },
          "401": { description: "Not authenticated" },
          "404": { description: "Job not found" },
        },
      },
    },

    "/proxy/fhir/document-references/{id}": {
      get: {
        tags: ["FHIR Proxy"],
        summary: "Get FHIR DocumentReference (PDF for Agent printing)",
        description:
          "Proxies a single `DocumentReference` resource from HAPI FHIR. " +
          "Used by the Local Agent to retrieve the Begleitschein PDF attachment before printing.\n\n" +
          "The PDF is encoded in `content[].attachment.data` (Base64) with `contentType: application/pdf`.",
        operationId: "getFhirDocumentReference",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "FHIR DocumentReference ID",
            schema: { type: "string", example: "doc-ref-abc123" },
          },
        ],
        responses: {
          "200": {
            description: "FHIR DocumentReference resource",
            content: {
              "application/fhir+json": {
                schema: { type: "object", description: "FHIR R4 DocumentReference resource" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "404": { description: "DocumentReference not found in HAPI FHIR" },
        },
      },
    },

    // ── Order Numbers ─────────────────────────────────────────────────────────
    "/orders/number": {
      post: {
        tags: ["Orders — Numbers"],
        summary: "Generate order number",
        description:
          "Generates a unique order number for a given organisation and service type. " +
          "Strategy: (1) Orchestra API → (2) pre-reserved pool fallback → (3) 503 if pool is empty. " +
          "The `source` field in the response indicates which path was used.",
        operationId: "generateOrderNumber",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OrderNumberRequest" },
              example: { orgGln: "7601000000000", serviceType: "ROUTINE" },
            },
          },
        },
        responses: {
          "200": {
            description: "Order number generated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderNumberResponse" },
              },
            },
          },
          "400": {
            description: "Invalid request — missing orgGln, unknown serviceType",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProblemDetails" },
              },
            },
          },
          "503": {
            description: "Order pool exhausted — no numbers available",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProblemDetails" },
              },
            },
          },
        },
      },
    },

    // ── Org Rules ─────────────────────────────────────────────────────────────
    "/admin/org-rules": {
      get: {
        tags: ["Admin — Org Rules"],
        summary: "List org rules",
        description: "Returns all organisation rules ordered by orgName.",
        operationId: "listOrgRules",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        responses: {
          "200": {
            description: "Array of org rules",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/OrgRule" },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
      post: {
        tags: ["Admin — Org Rules"],
        summary: "Create org rule",
        description: "Creates a new organisation rule. `orgFhirId` or `orgGln` is required.",
        operationId: "createOrgRule",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OrgRule" },
              example: {
                orgFhirId: `org-${labCode.toLowerCase()}`,
                orgGln: "7601000000000",
                orgName: EnvConfig.labName,
                patientPrefix: labCode,
                casePrefix: "F",
                hl7Msh3: "ORDERENTRY",
                hl7Msh4: labCode,
                hl7Msh5: "LIS",
                hl7Msh6: labCode,
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Org rule created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrgRule" },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
          "409": { description: "Conflict — orgFhirId or orgGln already exists" },
        },
      },
    },
    "/admin/org-rules/{id}": {
      get: {
        tags: ["Admin — Org Rules"],
        summary: "Get org rule",
        operationId: "getOrgRule",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Org rule",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/OrgRule" } },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
          "404": { description: "Not found" },
        },
      },
      put: {
        tags: ["Admin — Org Rules"],
        summary: "Update org rule",
        operationId: "updateOrgRule",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OrgRule" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated org rule",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/OrgRule" } },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        tags: ["Admin — Org Rules"],
        summary: "Delete org rule",
        operationId: "deleteOrgRule",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Deleted" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
          "404": { description: "Not found" },
        },
      },
    },

    // ── FHIR Organization Search ──────────────────────────────────────────────
    "/proxy/fhir/organizations": {
      get: {
        tags: ["Admin — Org Rules"],
        summary: "Search FHIR organizations by GLN or name",
        description:
          "Searches FHIR Organization resources by name or identifier (GLN). " +
          "Used to auto-fill the OrgRule form and the Number Pool org picker. " +
          "Requires at least 2 characters.",
        operationId: "searchFhirOrganizations",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        parameters: [
          {
            name: "q", in: "query", required: true,
            schema: { type: "string", minLength: 2 },
            description: "Search term — GLN number or organisation name",
          },
        ],
        responses: {
          "200": {
            description: "List of matching organisations",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: { $ref: "#/components/schemas/FhirOrgSearchResult" },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
    },

    // ── Number Pool ───────────────────────────────────────────────────────────
    "/admin/number-pool": {
      get: {
        tags: ["Admin — Number Pool"],
        summary: "List pool numbers + stats",
        description:
          "Returns all entries in the pre-reserved order number pool along with aggregate stats " +
          "(total, available, used) per service type.",
        operationId: "listNumberPool",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        responses: {
          "200": {
            description: "Pool entries and stats",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    entries: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ReservedOrderNumber" },
                    },
                    stats: {
                      type: "object",
                      additionalProperties: {
                        type: "object",
                        properties: {
                          total:     { type: "integer" },
                          available: { type: "integer" },
                          used:      { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
      post: {
        tags: ["Admin — Number Pool"],
        summary: "Add numbers to pool",
        description: "Bulk-inserts pre-reserved order numbers. Duplicates are silently skipped.",
        operationId: "addNumbersToPool",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["numbers", "serviceType"],
                properties: {
                  numbers:     { type: "array", items: { type: "string" }, minItems: 1 },
                  serviceType: { type: "string", enum: ["MIBI", "ROUTINE", "POC"] },
                  orgFhirId:   { type: "string", nullable: true, description: "FHIR Organization.id — null/omit for shared pool" },
                },
              },
              example: {
                numbers: ["7004003000", "7004003001", "7004003002"],
                serviceType: "ROUTINE",
                orgFhirId: null,
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Numbers added",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    added:      { type: "integer" },
                    skipped:    { type: "integer" },
                    serviceType: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
    },
    "/admin/number-pool/{id}": {
      delete: {
        tags: ["Admin — Number Pool"],
        summary: "Delete pool number",
        description: "Deletes an unused pool entry. Returns 409 if the entry has already been used.",
        operationId: "deletePoolNumber",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Deleted" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
          "404": { description: "Not found" },
          "409": { description: "Conflict — number already used" },
        },
      },
    },
    "/admin/number-pool/thresholds": {
      get: {
        tags: ["Admin — Number Pool"],
        summary: "Get pool alert thresholds",
        description:
          "Returns the configured alert thresholds for the pre-reserved number pool. " +
          "Rule: errorAt < warnAt < infoAt.",
        operationId: "getPoolThresholds",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        responses: {
          "200": {
            description: "Current threshold configuration",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PoolThreshold" },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
      put: {
        tags: ["Admin — Number Pool"],
        summary: "Update pool alert thresholds",
        description:
          "Updates the alert thresholds. All three values are required. " +
          "Validation rule: `errorAt` < `warnAt` < `infoAt`.",
        operationId: "updatePoolThresholds",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PoolThreshold" },
              example: { infoAt: 50, warnAt: 20, errorAt: 5 },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated thresholds",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PoolThreshold" },
              },
            },
          },
          "400": { description: "Validation error — thresholds must satisfy errorAt < warnAt < infoAt" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
    },

    // ── Service Types ─────────────────────────────────────────────────────────

    "/config/service-types": {
      get: {
        tags: ["Admin — Config"],
        summary: "Get active order service types",
        description:
          "Returns the list of active order service types used across the application " +
          "(number pool, org rules, order entry).\n\n" +
          "**Priority order:**\n" +
          "1. `ORDER_SERVICE_TYPES` environment variable (explicit override — takes effect after restart)\n" +
          "2. Distinct `ActivityDefinition.topic.coding.code` values from the FHIR server " +
          "   (system: `FHIR_SYSTEM_CATEGORY`, 5-minute in-process cache)\n" +
          "3. Built-in fallback: `[\"MIBI\", \"ROUTINE\", \"POC\"]`\n\n" +
          "The response includes a `source` field indicating which tier was used:\n" +
          "`env` | `fhir` | `fhir-cached` | `fallback`\n\n" +
          "The UI reads this endpoint on mount and updates all service type dropdowns " +
          "dynamically — no rebuild required when new service types are added to FHIR.",
        operationId: "getServiceTypes",
        security: [{ bearerAuth: [] }, { sessionCookie: [] }],
        responses: {
          "200": {
            description: "Active service types",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceTypesResponse" },
                examples: {
                  env: {
                    summary: "Overridden via ORDER_SERVICE_TYPES env var",
                    value: { types: ["MIBI", "ROUTINE", "POC", "CHEMO"], source: "env" },
                  },
                  fhir: {
                    summary: "Auto-discovered from FHIR ActivityDefinition.topic",
                    value: { types: ["MIBI", "Routine"], source: "fhir" },
                  },
                  fallback: {
                    summary: "FHIR unreachable — built-in defaults used",
                    value: { types: ["MIBI", "ROUTINE", "POC"], source: "fallback" },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
    },
    "/idle-timeout": {
      get: {
        tags: ["Auth"],
        summary: "Get session idle timeout",
        description: "Returns the configured idle session timeout in minutes. `0` = disabled. Used by the client-side inactivity guard.",
        operationId: "getIdleTimeout",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": {
            description: "Idle timeout config",
            content: { "application/json": { schema: { type: "object", required: ["minutes"], properties: { minutes: { type: "number", description: "0 = disabled" } } } } },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },

    "/me/profile": {
      get: {
        tags: ["Auth"],
        summary: "Get current user profile",
        description: "Returns the authenticated user's extended profile (GLN, address, org data).",
        operationId: "getMyProfile",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": {
            description: "User with profile",
            content: { "application/json": { schema: {
              type: "object",
              properties: {
                id:        { type: "string" },
                username:  { type: "string" },
                createdAt: { type: "string", format: "date-time" },
                profile:   { type: "object", description: "Key-value profile fields (gln, firstName, lastName, orgGln, …)" },
              },
            } } },
          },
          "401": { description: "Not authenticated" },
          "404": { description: "User not found" },
        },
      },
      put: {
        tags: ["Auth"],
        summary: "Update current user profile",
        description:
          "Updates allowed profile fields for the authenticated user.\n\n" +
          "**Allowed fields:** `gln`, `localId`, `ptype`, `roleType`, `firstName`, `lastName`, `organization`, " +
          "`street`, `streetNo`, `zip`, `city`, `canton`, `country`, `email`, `phone`, `orgGln`, `orgName`, `orgFhirId`.\n\n" +
          "**PTYPE rules:** `JUR` → firstName/lastName removed; `NAT` → organization removed.",
        operationId: "updateMyProfile",
        security: [{ sessionCookie: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", description: "Partial profile — only send fields to update" } } },
        },
        responses: {
          "200": { description: "Updated profile" },
          "400": { description: "Invalid JSON" },
          "401": { description: "Not authenticated" },
        },
      },
    },

    "/me/permissions": {
      get: {
        tags: ["Auth"],
        summary: "Get permissions for the current user",
        description:
          "Returns the role and full permission set for the authenticated user.\n\n" +
          "The frontend uses this to conditionally show/hide features and actions.\n\n" +
          "**Phase 1 (current):** permissions are derived from the role via a static map.\n" +
          "**Phase 2 (future):** permissions will be stored in DB and manageable via admin UI.",
        operationId: "getMyPermissions",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": {
            description: "Role and granted permissions",
            content: { "application/json": { schema: {
              type: "object",
              properties: {
                role:        { type: "string", example: "user", description: "Resolved role name" },
                permissions: {
                  type:  "array",
                  items: { type: "string" },
                  example: ["gln:read", "order:create", "order:read", "patient:read"],
                  description: "Sorted list of granted permission strings",
                },
              },
            } } },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },

    "/practitioners": {
      get: {
        tags: ["Practitioners"],
        summary: "Search practitioners (org-scoped)",
        description:
          "Returns Practitioners filtered by organisation.\n\n" +
          "**Priority for org filter:**\n" +
          "1. `orgFhirId` query param (patient's managing org)\n" +
          "2. Logged-in user's `orgFhirId` (external Auftraggeber)\n" +
          "3. Unfiltered (admin / internal users)\n\n" +
          "Returns `{ id, name }` pairs for use in order-form dropdowns.",
        operationId: "listPractitioners",
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: "q",          in: "query", schema: { type: "string" }, description: "Name search term" },
          { name: "orgFhirId",  in: "query", schema: { type: "string" }, description: "FHIR Organization ID to filter by (overrides user profile org)" },
        ],
        responses: {
          "200": {
            description: "List of practitioners",
            content: { "application/json": { schema: { type: "object", properties: {
              data: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } } },
            } } } },
          },
        },
      },
    },

    "/roles": {
      get: {
        tags: ["Roles"],
        summary: "List PractitionerRole catalog entries",
        description: "Returns all role catalog entries. Public — no auth required (needed by user-form dropdown).",
        operationId: "listRoles",
        responses: {
          "200": {
            description: "Role list",
            content: { "application/json": { schema: { type: "object", properties: {
              data: { type: "array", items: { $ref: "#/components/schemas/RoleCatalogEntry" } },
            } } } },
          },
        },
      },
      post: {
        tags: ["Roles"],
        summary: "Create a PractitionerRole catalog entry",
        description: "Adds a new role to the catalog. Admin only.",
        operationId: "createRole",
        security: [{ sessionCookie: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateRoleRequest" } } },
        },
        responses: {
          "201": { description: "Role created", content: { "application/json": { schema: { $ref: "#/components/schemas/RoleCatalogEntry" } } } },
          "400": { description: "Validation error" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
          "409": { description: "Code already exists" },
        },
      },
    },

    "/roles/{id}": {
      get: {
        tags: ["Roles"],
        summary: "Get a PractitionerRole catalog entry",
        operationId: "getRoleById",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Role entry", content: { "application/json": { schema: { $ref: "#/components/schemas/RoleCatalogEntry" } } } },
          "404": { description: "Not found" },
        },
      },
      put: {
        tags: ["Roles"],
        summary: "Update a PractitionerRole catalog entry",
        operationId: "updateRole",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateRoleRequest" } } },
        },
        responses: {
          "200": { description: "Updated role", content: { "application/json": { schema: { $ref: "#/components/schemas/RoleCatalogEntry" } } } },
          "400": { description: "Validation error" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        tags: ["Roles"],
        summary: "Delete a PractitionerRole catalog entry",
        operationId: "deleteRole",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "204": { description: "Deleted" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
          "404": { description: "Not found" },
        },
      },
    },

    "/insurance-lookup": {
      get: {
        tags: ["Insurance"],
        summary: "Look up VeKa insurance card (SASIS)",
        description:
          "Queries the SASIS/OFAC VeKa card API for patient insurance data.\n\n" +
          "Requires `SASIS_API_BASE` to be configured (503 otherwise).\n" +
          "Feature flag: `NEXT_PUBLIC_SASIS_ENABLED=true`.",
        operationId: "insuranceLookup",
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: "cardNumber", in: "query", required: true, schema: { type: "string", pattern: "^80\\d{18}$" }, description: "20-digit VeKa card number (starts with 80)" },
          { name: "date",       in: "query", schema: { type: "string", format: "date" }, description: "Reference date (default: today)" },
        ],
        responses: {
          "200": { description: "Patient insurance data from SASIS" },
          "400": { description: "Missing or invalid cardNumber" },
          "401": { description: "Not authenticated" },
          "503": { description: "SASIS not configured" },
        },
      },
    },

    "/logs": {
      get: {
        tags: ["Observability"],
        summary: "Tail structured server log file",
        description:
          "Returns the last N lines from the structured JSON log file.\n\n" +
          "Supports filtering by level and search term.\n\n" +
          "Admin only. Returns `enabled: false` when `LOG_FILE` is not configured.",
        operationId: "getLogs",
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: "tail",   in: "query", schema: { type: "integer", default: 200, maximum: 1000 }, description: "Number of lines from end of file" },
          { name: "level",  in: "query", schema: { type: "string", enum: ["debug", "info", "warn", "error"] }, description: "Minimum log level filter" },
          { name: "search", in: "query", schema: { type: "string" }, description: "Case-insensitive search in msg/ctx fields" },
        ],
        responses: {
          "200": {
            description: "Log entries",
            content: { "application/json": { schema: { type: "object", properties: {
              enabled: { type: "boolean" },
              logFile: { type: "string", description: "Basename of the log file (path masked)" },
              total:   { type: "integer" },
              entries: { type: "array", items: { type: "object", description: "Structured log entry (time, level, ctx, msg, …)" } },
            } } } },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
    },

    "/fhir/locations": {
      get: {
        tags: ["FHIR"],
        summary: "List FHIR Location resources",
        description: "Returns FHIR Location resources, optionally filtered by organization. Admin only.",
        operationId: "listFhirLocations",
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: "organization", in: "query", schema: { type: "string" }, description: "FHIR Organization ID to filter by" },
        ],
        responses: {
          "200": { description: "FHIR Bundle of Locations", content: { "application/fhir+json": { schema: { type: "object" } } } },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin role required" },
        },
      },
    },

    "/patients/{id}/activate": {
      post: {
        tags: ["Patients"],
        summary: "Reactivate a merged patient",
        description:
          "Sets `active: true` and removes all `replaced-by` links from a patient.\n\n" +
          "Used to undo a patient merge operation.",
        operationId: "activatePatient",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Patient FHIR ID" }],
        responses: {
          "200": { description: "Patient reactivated", content: { "application/json": { schema: { type: "object", properties: { activated: { type: "boolean" }, id: { type: "string" } } } } } },
          "401": { description: "Not authenticated" },
          "404": { description: "Patient not found" },
          "502": { description: "FHIR update failed" },
        },
      },
    },

    "/patients/{id}/document-references": {
      get: {
        tags: ["Patients"],
        summary: "List DocumentReferences for a patient",
        description: "Returns DocumentReference resources linked to the patient. Extracts PDF and HL7 attachments from `content[].attachment`.",
        operationId: "listPatientDocumentReferences",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Patient FHIR ID" }],
        responses: {
          "200": { description: "List of DocumentReferences with attachment data" },
          "401": { description: "Not authenticated" },
        },
      },
    },

    "/patients/{id}/merge": {
      post: {
        tags: ["Patients"],
        summary: "Merge source patient into target patient",
        description:
          "Merges `sourceId` into the target patient (`id` from URL path).\n\n" +
          "**Strategy 1:** FHIR `$merge` operation (HAPI FHIR).\n" +
          "**Strategy 2 (fallback):** Sets source `active: false` and adds a `replaced-by` link.\n\n" +
          "The target patient survives; source is deactivated.",
        operationId: "mergePatient",
        security: [{ sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Target patient FHIR ID (survives)" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["sourceId"], properties: { sourceId: { type: "string", description: "FHIR ID of the patient to be merged (deactivated)" } } } } },
        },
        responses: {
          "200": {
            description: "Merge successful",
            content: { "application/json": { schema: { type: "object", properties: {
              merged:   { type: "boolean" },
              targetId: { type: "string" },
              sourceId: { type: "string" },
              method:   { type: "string", enum: ["fhir-merge", "patient-link"] },
            } } } },
          },
          "400": { description: "Missing sourceId" },
          "401": { description: "Not authenticated" },
          "404": { description: "Source patient not found" },
          "502": { description: "FHIR update failed" },
        },
      },
    },

    "/orders/submit": {
      post: {
        tags: ["Orders"],
        summary: "Submit a new order (FHIR transaction bundle)",
        description:
          "Accepts a FHIR transaction Bundle (Encounter + ServiceRequest + Specimen + DocumentReference) " +
          "and forwards it to HAPI FHIR server-side.\n\n" +
          "Replaces the legacy direct client-side FHIR POST.",
        operationId: "submitOrder",
        security: [{ sessionCookie: [] }],
        requestBody: {
          required: true,
          content: { "application/fhir+json": { schema: { type: "object", description: "FHIR transaction Bundle" } } },
        },
        responses: {
          "200": { description: "Order submitted — returns created resource IDs" },
          "400": { description: "Invalid JSON body" },
          "401": { description: "Not authenticated" },
          "502": { description: "FHIR server error" },
        },
      },
    },

    "/gln-lookup": {
      get: {
        tags: ["External — GLN"],
        summary: "Look up a GLN in the RefData partner registry",
        description:
          "Queries the Swiss RefData SOAP service (`Partner.asmx`) for a 13-digit GLN.\n\n" +
          "Returns the partner's name, address, and role type.\n\n" +
          "Available at both:\n" +
          "- `GET /api/gln-lookup` — legacy path (backward-compatible)\n" +
          "- `GET /api/v1/gln-lookup` — stable versioned path (recommended)\n\n" +
          "**PTYPE logic:**\n" +
          "- `NAT` (natural person): `DESCR1` = family name, `DESCR2` = given name\n" +
          "- `JUR` (organisation): `DESCR1` = organisation name\n\n" +
          "**ENV:** `REFDATA_SOAP_URL` (default: `https://refdatabase.refdata.ch/Service/Partner.asmx`)\n\n" +
          "Replaces the former `GLN_API_BASE` / Orchestra REST middleware integration.",
        operationId: "glnLookup",
        security: [{ sessionCookie: [] }],
        parameters: [
          {
            name: "gln",
            in: "query",
            required: true,
            description: "13-digit GS1 Global Location Number",
            schema: { type: "string", pattern: "^\\d{13}$", example: "7601000123456" },
          },
        ],
        responses: {
          "200": {
            description: "GLN found — partner data returned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GlnLookupResult" },
                example: {
                  gln: "7601000123456", ptype: "NAT", roleType: "HPC",
                  organization: "", lastName: "Müller", firstName: "Hans",
                  street: "Bahnhofstrasse", streetNo: "1",
                  zip: "8001", city: "Zürich", canton: "ZH", country: "CH",
                },
              },
            },
          },
          "400": { description: "GLN is not 13 digits (`error: invalidGln`)" },
          "401": { description: "Not authenticated" },
          "404": { description: "GLN not found in RefData (`error: glnNotFound`)" },
          "502": { description: "SOAP call failed — network error or timeout" },
          "503": { description: "`REFDATA_SOAP_URL` not configured (`error: noGlnApi`)" },
        },
      },
    },
    "/v2/gln-lookup": {
      get: {
        tags: ["External — GLN"],
        summary: "Look up a GLN — v2 (nested structure)",
        description:
          "Same RefData SOAP lookup as `GET /api/gln-lookup` (v1), but returns a richer, " +
          "nested response structure.\n\n" +
          "**Breaking changes from v1:**\n" +
          "- `ptype` renamed to `partnerType`\n" +
          "- `roleType` renamed to `role`\n" +
          "- Flat address fields moved into `address{}` object\n" +
          "- `lastName`/`firstName` moved into `person{}` object (null for JUR)\n" +
          "- `organization` is `null` (not `\"\"`) for NAT partners\n" +
          "- New computed field `displayName`\n\n" +
          "**ENV:** `REFDATA_SOAP_URL` — same endpoint as v1.",
        operationId: "glnLookupV2",
        security: [{ sessionCookie: [] }],
        parameters: [
          {
            name: "gln",
            in: "query",
            required: true,
            description: "13-digit GS1 Global Location Number",
            schema: { type: "string", pattern: "^\\d{13}$", example: "7601000123456" },
          },
        ],
        responses: {
          "200": {
            description: "GLN found — v2 partner data returned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GlnResponseV2" },
                examples: {
                  nat: {
                    summary: "Natural person (NAT)",
                    value: {
                      gln: "7601000123456", partnerType: "NAT", role: "HPC",
                      displayName: "Müller Hans",
                      person: { lastName: "Müller", firstName: "Hans" },
                      organization: null,
                      address: { street: "Bahnhofstrasse", streetNo: "1", zip: "8001", city: "Zürich", canton: "ZH", country: "CH" },
                    },
                  },
                  jur: {
                    summary: "Juridical entity (JUR)",
                    value: {
                      gln: "7601001234567", partnerType: "JUR", role: "ORG",
                      displayName: "Hirslanden AG",
                      person: null,
                      organization: "Hirslanden AG",
                      address: { street: "Witellikerstrasse", streetNo: "40", zip: "8032", city: "Zürich", canton: "ZH", country: "CH" },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "GLN is not 13 digits" },
          "401": { description: "Not authenticated" },
          "404": { description: "GLN not found in RefData" },
          "502": { description: "SOAP call failed — network error or timeout" },
          "503": { description: "`REFDATA_SOAP_URL` not configured" },
        },
      },
    },
  },

  // ── Reusable schemas ───────────────────────────────────────────────────────
  components: {
    schemas: {
      RoleCatalogEntry: {
        type: "object",
        required: ["id", "code", "display", "createdAt"],
        description: "A PractitionerRole catalog entry (GET /api/roles).",
        properties: {
          id:        { type: "string", format: "uuid" },
          code:      { type: "string", description: "Unique role code (e.g. HPC)" },
          display:   { type: "string", description: "Human-readable label" },
          system:    { type: "string", description: "Optional FHIR coding system URI / OID" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateRoleRequest: {
        type: "object",
        required: ["code", "display"],
        properties: {
          code:    { type: "string", description: "Unique role code (case-insensitive, must be unique)" },
          display: { type: "string", description: "Human-readable display name" },
          system:  { type: "string", description: "Optional FHIR coding system URI" },
        },
      },
      UpdateRoleRequest: {
        type: "object",
        properties: {
          code:    { type: "string" },
          display: { type: "string" },
          system:  { type: "string" },
        },
      },
      GlnResponseV2: {
        type: "object",
        required: ["gln", "partnerType", "role", "displayName", "person", "organization", "address"],
        description: "v2 GLN partner response — nested structure (GET /api/v2/gln-lookup).",
        properties: {
          gln:          { type: "string", description: "13-digit GLN", example: "7601000123456" },
          partnerType:  { type: "string", enum: ["NAT", "JUR", ""], description: "NAT = natural person, JUR = juridical entity" },
          role:         { type: "string", description: "RefData role type code (e.g. HPC, ORG)", example: "HPC" },
          displayName:  { type: "string", description: "Computed display name: 'Müller Hans' (NAT) or organisation name (JUR)" },
          person: {
            nullable: true,
            description: "Person details — populated for NAT, null for JUR",
            type: "object",
            required: ["lastName", "firstName"],
            properties: {
              lastName:  { type: "string" },
              firstName: { type: "string" },
            },
          },
          organization: {
            type: "string", nullable: true,
            description: "Organisation name — populated for JUR, null for NAT",
          },
          address: {
            type: "object",
            required: ["street", "streetNo", "zip", "city", "canton", "country"],
            properties: {
              street:   { type: "string" },
              streetNo: { type: "string" },
              zip:      { type: "string" },
              city:     { type: "string" },
              canton:   { type: "string", example: "ZH" },
              country:  { type: "string", example: "CH" },
            },
          },
        },
      },
      GlnLookupResult: {
        type: "object",
        required: ["gln", "ptype", "roleType", "organization", "lastName", "firstName", "street", "streetNo", "zip", "city", "canton", "country"],
        description: "Partner data returned by the RefData GLN lookup (GET /api/gln-lookup).",
        properties: {
          gln:          { type: "string", description: "13-digit GLN as confirmed by RefData", example: "7601000123456" },
          ptype:        { type: "string", enum: ["NAT", "JUR", ""], description: "NAT = natural person, JUR = juridical entity" },
          roleType:     { type: "string", description: "RefData role type code (e.g. HPC, ORG)", example: "HPC" },
          organization: { type: "string", description: "Organisation name — populated for JUR, empty for NAT" },
          lastName:     { type: "string", description: "Family name — populated for NAT, empty for JUR" },
          firstName:    { type: "string", description: "Given name — populated for NAT, empty for JUR" },
          street:       { type: "string", description: "Street name from the primary ROLE" },
          streetNo:     { type: "string", description: "Street number" },
          zip:          { type: "string", description: "Postal code" },
          city:         { type: "string", description: "City" },
          canton:       { type: "string", description: "Swiss canton abbreviation (e.g. ZH, BE)", example: "ZH" },
          country:      { type: "string", description: "Country code (e.g. CH)", example: "CH" },
        },
      },
      ServiceTypesResponse: {
        type: "object",
        required: ["types", "source"],
        properties: {
          types: {
            type: "array",
            items: { type: "string" },
            description: "Ordered list of active service type codes (e.g. MIBI, ROUTINE, POC)",
            example: ["MIBI", "ROUTINE", "POC"],
          },
          source: {
            type: "string",
            enum: ["env", "fhir", "fhir-cached", "fallback"],
            description:
              "Which resolution tier produced this list. " +
              "`env` = ORDER_SERVICE_TYPES override; " +
              "`fhir` = freshly fetched from FHIR; " +
              "`fhir-cached` = served from 5-min in-process cache; " +
              "`fallback` = FHIR unavailable, built-in defaults used.",
          },
        },
      },

      ResultResponse: {
        type: "object",
        required: [
          "id", "status", "codeText", "category", "effectiveDate",
          "resultCount", "conclusion", "basedOn", "patientId", "patientDisplay",
        ],
        properties: {
          id: { type: "string", description: "FHIR DiagnosticReport ID" },
          status: {
            type: "string",
            enum: [
              "registered", "partial", "preliminary", "final",
              "amended", "corrected", "cancelled", "unknown",
            ],
          },
          codeText: { type: "string" },
          category: { type: "string" },
          effectiveDate: {
            type: "string",
            format: "date-time",
            description:
              "effectiveDateTime → issued → meta.lastUpdated (cascade)",
          },
          resultCount: { type: "integer" },
          conclusion: { type: "string" },
          basedOn: {
            type: "array",
            items: { type: "string" },
            description: "References to linked ServiceRequests",
          },
          patientId: { type: "string" },
          patientDisplay: { type: "string" },
          pdfData: {
            type: "string",
            nullable: true,
            description: "Base64-encoded PDF (application/pdf attachment)",
          },
          pdfTitle: { type: "string", nullable: true },
          hl7Data: {
            type: "string",
            nullable: true,
            description: "Base64-encoded HL7 v2 ORU^R01 message",
          },
          hl7Title: { type: "string", nullable: true },
        },
      },

      PagedResultsResponse: {
        type: "object",
        required: ["data", "total", "page", "pageSize"],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/ResultResponse" },
          },
          total: { type: "integer" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
          error: { type: "string", description: "Present only on error" },
        },
      },

      OrderResponse: {
        type: "object",
        required: [
          "id", "status", "intent", "codeText",
          "authoredOn", "orderNumber", "specimenCount", "patientId",
        ],
        properties: {
          id: { type: "string", description: "FHIR ServiceRequest ID" },
          status: { type: "string" },
          intent: { type: "string" },
          codeText: { type: "string" },
          authoredOn: { type: "string", format: "date-time" },
          orderNumber: { type: "string" },
          specimenCount: { type: "integer" },
          patientId: { type: "string" },
        },
      },

      ListOrdersResponse: {
        type: "object",
        required: ["data", "total"],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/OrderResponse" },
          },
          total: { type: "integer" },
          error: { type: "string", description: "Present only on error" },
        },
      },

      DeleteOrderResponse: {
        type: "object",
        required: ["deleted"],
        properties: {
          deleted: { type: "boolean" },
          soft: {
            type: "boolean",
            description:
              "true when hard DELETE was not possible (409) and the order was " +
              "soft-deleted by setting status to entered-in-error",
          },
        },
      },

      PatientResponse: {
        type: "object",
        required: ["id", "name", "address", "createdAt"],
        properties: {
          id: { type: "string", description: "FHIR Patient ID" },
          name: { type: "string" },
          address: { type: "string" },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "meta.lastUpdated from FHIR",
          },
        },
      },

      PagedPatientsResponse: {
        type: "object",
        required: ["data", "total", "page", "pageSize"],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/PatientResponse" },
          },
          total: { type: "integer" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
          error: { type: "string", description: "Present only on error" },
        },
      },

      UserProfileSchema: {
        type: "object",
        description: "Optional profile information for a user (Practitioner/Organization data)",
        properties: {
          ptype: { type: "string", enum: ["NAT", "JUR"], description: "NAT = natural person (Practitioner), JUR = legal entity (Organization)" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          organization: { type: "string" },
          gln: { type: "string", description: "13-digit GLN number" },
          orgGln: { type: "string", description: "GLN of affiliated/parent organization" },
          localId: { type: "string" },
          street: { type: "string" },
          streetNo: { type: "string" },
          zip: { type: "string" },
          city: { type: "string" },
          canton: { type: "string" },
          country: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
        },
      },

      UserResponse: {
        type: "object",
        required: ["id", "username", "role", "status", "providerType", "createdAt", "fhirSyncStatus"],
        properties: {
          id: { type: "string" },
          username: { type: "string" },
          role: { type: "string", enum: ["admin", "user"] },
          status: { type: "string", enum: ["active", "pending", "suspended"] },
          providerType: { type: "string", enum: ["local", "external"] },
          externalId: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          profile: { $ref: "#/components/schemas/UserProfileSchema" },
          fhirSyncStatus: { type: "string", enum: ["not_synced", "synced", "error"] },
          fhirSyncedAt: { type: "string", format: "date-time" },
          fhirSyncError: { type: "string" },
          fhirPractitionerId: { type: "string" },
          fhirPractitionerRoleId: { type: "string" },
          extraPermissions: {
            type: "array",
            items: { type: "string" },
            description: "Individual permissions granted beyond the base role.",
          },
        },
      },

      PagedUsersResponse: {
        type: "object",
        required: ["data", "total", "page", "pageSize"],
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/UserResponse" } },
          total: { type: "integer" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
        },
      },

      CreateUserRequest: {
        type: "object",
        required: ["username", "providerType"],
        properties: {
          username: { type: "string", minLength: 3 },
          password: { type: "string", format: "password", description: "Required for providerType=local" },
          role: { type: "string", enum: ["admin", "user"], default: "user" },
          status: { type: "string", enum: ["active", "pending", "suspended"], default: "active" },
          providerType: { type: "string", enum: ["local", "external"] },
          externalId: { type: "string", description: "Required for providerType=external" },
          profile: { $ref: "#/components/schemas/UserProfileSchema" },
        },
      },

      UpdateUserRequest: {
        type: "object",
        properties: {
          role: { type: "string", enum: ["admin", "user"] },
          status: { type: "string", enum: ["active", "pending", "suspended"] },
          externalId: { type: "string", description: "External IdP identifier" },
          profile: { $ref: "#/components/schemas/UserProfileSchema" },
          fhirPractitionerId: {
            type: "string",
            description: "FHIR Practitioner ID linked to this user. Determines data access level (full/org/own) at next login via PractitionerRole lookup.",
            example: "prac-von-rohr-anna",
          },
        },
      },

      DeleteUserResponse: {
        type: "object",
        required: ["deleted"],
        properties: {
          deleted: { type: "boolean" },
          id: { type: "string" },
        },
      },

      UserSyncResponse: {
        type: "object",
        required: ["synced"],
        properties: {
          synced: { type: "boolean" },
          practitionerId: { type: "string" },
          practitionerRoleId: { type: "string" },
          organizationId: { type: "string" },
          error: { type: "string" },
        },
      },

      EnvSchemaEntry: {
        type: "object",
        required: ["key", "description", "default", "currentValue", "required", "writable", "restartRequired", "secret", "group"],
        properties: {
          key:             { type: "string", description: "Exact environment variable name (e.g. FHIR_BASE_URL)" },
          description:     { type: "string", description: "What this variable controls" },
          default:         { type: "string", description: "Value used when the variable is not set" },
          currentValue:    { type: "string", description: "Current value from process.env. Secret values are masked as ••••••••" },
          required:        { type: "boolean", description: "App degrades significantly without this variable" },
          writable:        { type: "boolean", description: "Can be changed via POST /api/env" },
          restartRequired: { type: "boolean", description: "Restart required for the change to take effect" },
          secret:          { type: "boolean", description: "Value is sensitive — masked in the API response" },
          group:           { type: "string", description: "Logical category", enum: ["FHIR", "Authentication", "Logging", "Observability", "External APIs", "Build-time"] },
        },
      },

      EnvSchemaResponse: {
        type: "object",
        required: ["entries"],
        properties: {
          entries: {
            type: "array",
            items: { $ref: "#/components/schemas/EnvSchemaEntry" },
          },
        },
      },

      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },

      // ── Token schemas ─────────────────────────────────────────────────────────

      AccessTokenResponse: {
        type: "object",
        required: ["accessToken", "tokenType", "expiresIn"],
        properties: {
          accessToken: { type: "string", description: "Signed JWT — include as Authorization: Bearer <token>" },
          tokenType: { type: "string", enum: ["Bearer"] },
          expiresIn: { type: "integer", description: "Token lifetime in seconds" },
        },
      },

      GenerateTokenResponse: {
        type: "object",
        required: ["token", "createdAt"],
        properties: {
          token: { type: "string", description: "Personal Access Token (ztk_<64 hex>). Shown only once — store immediately." },
          createdAt: { type: "string", format: "date-time" },
        },
      },

      RevokeTokenResponse: {
        type: "object",
        required: ["revoked"],
        properties: {
          revoked: { type: "boolean" },
        },
      },

      // ── FHIR registry schemas ─────────────────────────────────────────────────

      FhirResource: {
        type: "object",
        description: "Generic FHIR R4 resource",
        properties: {
          resourceType: { type: "string" },
          id: { type: "string" },
        },
        additionalProperties: true,
      },

      FhirBundle: {
        type: "object",
        description: "FHIR R4 Bundle (searchset or collection)",
        required: ["resourceType", "type"],
        properties: {
          resourceType: { type: "string", enum: ["Bundle"] },
          type: { type: "string", enum: ["searchset", "collection"] },
          total: { type: "integer" },
          entry: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fullUrl: { type: "string" },
                resource: { $ref: "#/components/schemas/FhirResource" },
              },
            },
          },
        },
      },

      FhirOperationOutcome: {
        type: "object",
        description: "FHIR R4 OperationOutcome — returned on errors",
        required: ["resourceType", "issue"],
        properties: {
          resourceType: { type: "string", enum: ["OperationOutcome"] },
          issue: {
            type: "array",
            items: {
              type: "object",
              required: ["severity", "code"],
              properties: {
                severity: { type: "string", enum: ["fatal", "error", "warning", "information"] },
                code: { type: "string" },
                diagnostics: { type: "string" },
              },
            },
          },
        },
      },

      CreateOrganizationRequest: {
        type: "object",
        required: ["name", "gln"],
        properties: {
          name: { type: "string", description: "Organization display name" },
          gln: { type: "string", description: "13-digit GLN" },
          parentId: { type: "string", description: "FHIR Organization ID of the parent org (optional)" },
        },
      },

      UpdateOrganizationRequest: {
        type: "object",
        required: ["name", "gln"],
        properties: {
          name: { type: "string" },
          gln: { type: "string" },
          parentId: { type: "string" },
        },
      },

      CreatePractitionerRequest: {
        type: "object",
        required: ["firstName", "lastName", "gln"],
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          gln: { type: "string", description: "13-digit GLN" },
          orgFhirId: { type: "string", description: "FHIR Organization ID to link via PractitionerRole" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
        },
      },

      UpdatePractitionerRequest: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          gln: { type: "string" },
          orgFhirId: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
        },
      },

      // ── Admin — Merge schemas ─────────────────────────────────────────────────

      AdminMergeStatus: {
        type: "object",
        description: "Summary of pending duplicate entries across all registry types",
        properties: {
          organizations: { type: "integer", description: "Number of duplicate Organization groups" },
          practitioners: { type: "integer", description: "Number of duplicate Practitioner groups" },
          lastChecked: { type: "string", format: "date-time" },
        },
      },

      MergeOrgsRequest: {
        type: "object",
        required: ["keepId", "mergeIds"],
        properties: {
          keepId: { type: "string", description: "FHIR Organization ID to keep" },
          mergeIds: { type: "array", items: { type: "string" }, description: "FHIR Organization IDs to merge into keepId and then delete" },
        },
      },

      MergePractsRequest: {
        type: "object",
        required: ["keepId", "mergeIds"],
        properties: {
          keepId: { type: "string", description: "FHIR Practitioner ID to keep" },
          mergeIds: { type: "array", items: { type: "string" }, description: "FHIR Practitioner IDs to merge into keepId and then delete" },
        },
      },

      MergeResult: {
        type: "object",
        required: ["merged", "kept"],
        properties: {
          merged: { type: "integer", description: "Number of entries merged and deleted" },
          kept: { type: "string", description: "FHIR ID of the surviving resource" },
          errors: { type: "array", items: { type: "string" } },
        },
      },

      // ── Admin — Tasks schemas ─────────────────────────────────────────────────

      AdminTasksResponse: {
        type: "object",
        description: "Registry quality report — entries that need attention",
        properties: {
          missingGln: {
            type: "object",
            properties: {
              organizations: { type: "integer" },
              practitioners: { type: "integer" },
            },
          },
          unlinkedPractitioners: { type: "integer", description: "Practitioners without a PractitionerRole" },
          total: { type: "integer" },
        },
      },

      // ── Admin — Config schemas ────────────────────────────────────────────────

      ConfigEntry: {
        type: "object",
        required: ["key", "value", "source"],
        properties: {
          key: { type: "string" },
          value: { type: "string", nullable: true },
          source: { type: "string", enum: ["override", "env", "default"], description: "Where this value was resolved from" },
        },
      },

      ConfigResponse: {
        type: "object",
        properties: {
          entries: { type: "array", items: { $ref: "#/components/schemas/ConfigEntry" } },
        },
      },

      UpdateConfigRequest: {
        type: "object",
        required: ["overrides"],
        properties: {
          overrides: {
            type: "object",
            additionalProperties: { type: "string", nullable: true },
            description: "Key-value pairs to set. Pass null to remove an override.",
          },
        },
      },

      EnvEntry: {
        type: "object",
        required: ["key", "value"],
        properties: {
          key: { type: "string" },
          value: { type: "string", nullable: true },
        },
      },

      EnvResponse: {
        type: "object",
        properties: {
          vars: { type: "array", items: { $ref: "#/components/schemas/EnvEntry" } },
        },
      },

      UpdateEnvRequest: {
        type: "object",
        required: ["vars"],
        properties: {
          vars: {
            type: "array",
            items: { $ref: "#/components/schemas/EnvEntry" },
            description: "Array of key-value pairs to write to .env.local",
          },
        },
      },

      // ── Mail schemas ──────────────────────────────────────────────────────────

      MailTestRequest: {
        type: "object",
        properties: {
          to: { type: "string", format: "email", description: "If provided, a test email is sent to this address after SMTP verify" },
        },
      },

      MailTestResponse: {
        type: "object",
        required: ["ok", "message"],
        properties: {
          ok:         { type: "boolean", description: "`true` = SMTP verify (and optional send) succeeded" },
          message:    { type: "string",  description: "Human-readable result or error description" },
          provider:   { type: "string",  nullable: true, description: "Active provider key (smtp|gmail|smtp_oauth2|google_workspace_relay|hin)" },
          from:       { type: "string",  nullable: true, description: "Sender address used" },
          durationMs: { type: "integer", nullable: true, description: "Round-trip duration in milliseconds" },
        },
      },

      // ── Orchestra / Launch schemas ────────────────────────────────────────────

      LaunchRequest: {
        type: "object",
        required: ["patientId", "practitionerId", "organizationId", "token"],
        properties: {
          patientId:      { type: "string", description: "FHIR relative reference, e.g. `Patient/p-123`" },
          practitionerId: { type: "string", description: "FHIR relative reference, e.g. `Practitioner/prac-456`" },
          organizationId: { type: "string", description: "FHIR relative reference, e.g. `Organization/org-789`" },
          token:          { type: "string", description: "Signed HS256 JWT issued by Orchestra (`iss=orchestra`, max 5 min expiry)" },
        },
      },

      LaunchResponse: {
        type: "object",
        required: ["redirectUrl"],
        properties: {
          redirectUrl: { type: "string", description: "Absolute path to redirect the browser to after session creation" },
        },
      },

      ProblemDetails: {
        type: "object",
        required: ["type", "title", "status", "detail", "instance"],
        description: "RFC 7807 Problem Details — used by non-FHIR error responses.",
        properties: {
          type:     { type: "string", description: "URI reference identifying the problem type" },
          title:    { type: "string", description: "Short human-readable summary" },
          status:   { type: "integer", description: "HTTP status code" },
          detail:   { type: "string", description: "Explanation specific to this occurrence" },
          instance: { type: "string", description: "URI reference of the specific request (e.g. `/api/launch`)" },
        },
      },

      // ── Settings & FHIR health schemas ───────────────────────────────────────

      SettingsResponse: {
        type: "object",
        properties: {
          fhirBaseUrl:    { type: "string", nullable: true, description: "FHIR_BASE_URL — base URL of the HAPI FHIR server" },
          fhirAuthType:   { type: "string", enum: ["none", "bearer", "basic", "apiKey", "oauth2", "digest"], description: "Active FHIR auth strategy" },
          monitoringUrl:  { type: "string", nullable: true, description: "MONITORING_URL — display-only link (e.g. Grafana)" },
          monitoringLabel:{ type: "string", nullable: true, description: "MONITORING_LABEL — display name (default: 'Monitoring')" },
          tracingUrl:     { type: "string", nullable: true, description: "TRACING_URL — display-only link (e.g. Jaeger, Tempo)" },
          tracingLabel:   { type: "string", nullable: true, description: "TRACING_LABEL — display name (default: 'Tracing')" },
          mailProvider:   { type: "string", nullable: true, description: "Active mail provider (smtp|gmail|smtp_oauth2|google_workspace_relay). Empty = disabled." },
          mailAuthType:   { type: "string", nullable: true, description: "Active mail auth method (APP_PASSWORD|OAUTH2|NONE)" },
          mailFrom:       { type: "string", nullable: true, description: "Configured sender address (display-only)" },
        },
      },

      // ── Mail status schema ───────────────────────────────────────────────────

      MailStatusResponse: {
        type: "object",
        required: ["configured"],
        properties: {
          configured: { type: "boolean", description: "true when MAIL_PROVIDER is set and valid" },
          provider:   { type: "string",  nullable: true, description: "Active provider key (smtp|gmail|smtp_oauth2|google_workspace_relay|hin)" },
          authType:   { type: "string",  nullable: true, description: "Active auth type (APP_PASSWORD|OAUTH2|NONE)" },
          host:       { type: "string",  nullable: true, description: "SMTP hostname (absent for gmail)" },
          port:       { type: "integer", nullable: true, description: "SMTP port" },
          from:       { type: "string",  nullable: true, description: "Configured sender address (display-only)" },
        },
      },

      FhirHealthResponse: {
        type: "object",
        required: ["ok", "message"],
        properties: {
          ok:          { type: "boolean", description: "`true` = FHIR server reachable and returned a CapabilityStatement" },
          message:     { type: "string", description: "Human-readable status or error message" },
          fhirVersion: { type: "string", nullable: true, description: "FHIR version from CapabilityStatement (e.g. `4.0.1`)" },
          server:      { type: "string", nullable: true, description: "Server software name (e.g. `HAPI FHIR`)" },
        },
      },

      // ── Agent job schemas ──────────────────────────────────────────────────

      AgentJobResponse: {
        type: "object",
        required: ["id", "type", "orgId", "orderNumber", "zpl", "createdAt"],
        properties: {
          id:                  { type: "string", format: "uuid", description: "Unique job identifier" },
          type:                { type: "string", enum: ["print", "oru"], description: "Job type" },
          orgId:               { type: "string", description: "FHIR Organization ID" },
          locationId:          { type: "string", nullable: true, description: "FHIR Location ID (null = broadcast)" },
          documentReferenceId: { type: "string", description: "FHIR DocumentReference ID — use to fetch the Begleitschein PDF" },
          serviceRequestId:    { type: "string", nullable: true, description: "FHIR ServiceRequest ID" },
          patientId:           { type: "string", nullable: true, description: "FHIR Patient ID" },
          orderNumber:         { type: "string", description: `${labCode} order number (Auftragsnummer)` },
          zpl:                 { type: "string", description: "Concatenated ZPL label data — one label per specimen (CODE128 barcode)" },
          createdAt:           { type: "string", format: "date-time", description: "ISO 8601 creation timestamp" },
        },
      },

      ListAgentJobsResponse: {
        type: "object",
        required: ["jobs"],
        properties: {
          jobs: {
            type: "array",
            items: { $ref: "#/components/schemas/AgentJobResponse" },
          },
        },
      },

      CreatePrintJobRequest: {
        type: "object",
        required: ["orgId", "documentReferenceId", "orderNumber"],
        properties: {
          orgId:               { type: "string", description: "FHIR Organization ID (mandatory for routing)" },
          locationId:          { type: "string", description: "FHIR Location ID — targets a specific department Agent (omit for broadcast)" },
          documentReferenceId: { type: "string", description: "FHIR DocumentReference ID — Begleitschein PDF stored in HAPI FHIR" },
          serviceRequestId:    { type: "string", description: "FHIR ServiceRequest ID" },
          patientId:           { type: "string", description: "FHIR Patient ID" },
          orderNumber:         { type: "string", description: `${labCode} order number (Auftragsnummer)` },
          specimens: {
            type: "array",
            description: "Specimen list — one ZPL label per entry",
            items: {
              type: "object",
              required: ["materialCode", "materialName"],
              properties: {
                materialCode: { type: "string", description: `${labCode} LIS material code (specimen_additionalinfo)` },
                materialName: { type: "string", description: "Material display name (German)" },
              },
            },
          },
        },
      },

      CreatePrintJobResponse: {
        type: "object",
        required: ["id", "status", "createdAt"],
        properties: {
          id:        { type: "string", format: "uuid", description: "Created job ID" },
          status:    { type: "string", enum: ["pending"], description: "Always `pending` at creation" },
          createdAt: { type: "string", format: "date-time" },
        },
      },

      JobDoneResponse: {
        type: "object",
        required: ["id", "status"],
        properties: {
          id:     { type: "string", format: "uuid" },
          status: { type: "string", enum: ["done"] },
        },
      },
    },

    // ── Order Number Engine schemas ──────────────────────────────────────────
    OrgRule: {
      type: "object",
      required: ["id", "orgFhirId", "orgGln", "orgName"],
      properties: {
        id:            { type: "string", format: "uuid" },
        orgFhirId:     { type: "string", description: "FHIR Organization.id" },
        orgGln:        { type: "string", description: "GS1 GLN of the organization" },
        orgName:       { type: "string" },
        patientPrefix: { type: "string", description: "Prefix for patient IDs" },
        casePrefix:    { type: "string", description: "Prefix for case/Fallnummer" },
        hl7Msh3:       { type: "string", description: "HL7 MSH-3 Sending Application" },
        hl7Msh4:       { type: "string", description: "HL7 MSH-4 Sending Facility" },
        hl7Msh5:       { type: "string", description: "HL7 MSH-5 Receiving Application" },
        hl7Msh6:       { type: "string", description: "HL7 MSH-6 Receiving Facility" },
        mibiPrefix:    { type: "string", description: "MIBI prefix override (empty = global ENV)" },
        mibiStart:     { type: "string", description: "MIBI start digit after prefix (empty = global ENV)" },
        mibiLength:    { type: "integer", nullable: true, description: "MIBI total length (null = global ENV)" },
        pocPrefix:     { type: "string", description: "POC prefix override (empty = global ENV)" },
        pocLength:     { type: "integer", nullable: true, description: "POC total length (null = global ENV)" },
        routineLength: { type: "integer", nullable: true, description: "Routine digit count (null = global ENV)" },
        serviceTypeMapping: {
          type: "object",
          additionalProperties: { type: "string", enum: ["MIBI", "ROUTINE", "POC"] },
          description: "Maps external department codes to ServiceType. E.g. {\"MIKRO\":\"MIBI\"}",
        },
        createdAt:     { type: "string", format: "date-time" },
        updatedAt:     { type: "string", format: "date-time" },
      },
    },
    FhirOrgSearchResult: {
      type: "object",
      required: ["orgFhirId", "orgGln", "orgName"],
      properties: {
        orgFhirId: { type: "string" },
        orgGln:    { type: "string" },
        orgName:   { type: "string" },
      },
    },
    ReservedOrderNumber: {
      type: "object",
      required: ["id", "number", "serviceType", "status", "createdAt"],
      properties: {
        id:                      { type: "string", format: "uuid" },
        number:                  { type: "string" },
        serviceType:             { type: "string", enum: ["MIBI", "ROUTINE", "POC"] },
        status:                  { type: "string", enum: ["available", "used"] },
        orgFhirId:               { type: "string", nullable: true, description: "null = shared pool; value = org-specific" },
        usedAt:                  { type: "string", format: "date-time" },
        usedForPatientId:        { type: "string" },
        usedForServiceRequestId: { type: "string" },
        createdAt:               { type: "string", format: "date-time" },
      },
    },
    PoolThreshold: {
      type: "object",
      required: ["infoAt", "warnAt", "errorAt", "notificationEmail"],
      properties: {
        infoAt:            { type: "integer", description: "Send INFO email when available ≤ this" },
        warnAt:            { type: "integer", description: "Send WARN email when available ≤ this" },
        errorAt:           { type: "integer", description: "Send ERROR email when available ≤ this" },
        notificationEmail: { type: "string", format: "email" },
      },
    },
    OrderNumberRequest: {
      type: "object",
      required: ["orgGln", "serviceType"],
      properties: {
        orgGln:      { type: "string" },
        serviceType: { type: "string", enum: ["MIBI", "ROUTINE", "POC"] },
        patientId:   { type: "string" },
      },
    },
    OrderNumberResponse: {
      type: "object",
      required: ["orderNumber", "serviceType", "source"],
      properties: {
        orderNumber: { type: "string" },
        serviceType: { type: "string", enum: ["MIBI", "ROUTINE", "POC"] },
        source:      { type: "string", enum: ["orchestra", "pool"] },
      },
    },

    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "session",
        description:
          "HMAC-SHA256 signed session cookie set by POST /api/login",
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT or PAT",
        description:
          "Bearer token for external API clients.\n\n" +
          "**JWT** — obtain via `POST /api/auth/token`. Short-lived (configurable expiry).\n\n" +
          "**PAT** — generate via `POST /api/users/{id}/token` (admin only). " +
          "Long-lived personal access token. Format: `ztk_<64 hex chars>`.",
      },
    },
  },

  security: [{ sessionCookie: [] }, { bearerAuth: [] }],
} as const;

export type OpenApiSpec = typeof openApiSpec;
