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
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "z2Lab OrderEntry API",
    version: "2.0.0",
    description:
      "REST API for the **z2Lab** OrderEntry system — *ZLZ Zentrallabor AG & ZetLab AG*.\n\n" +
      "**Autor:** Farhad Arian  \n" +
      "**Funktion:** CTO  \n" +
      "**Hauptlabor:** ZLZ Zentrallabor AG — [zlz.ch](https://www.zlz.ch)  \n" +
      "**Tochtergesellschaft:** ZetLab AG *(unter ZLZ Zentrallabor AG)* — [zetlab.ch](https://zetlab.ch)\n\n" +
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
      name: "Farhad Arian — ZLZ Zentrallabor AG & ZetLab AG",
      url: "https://zetlab.ch",
    },
    license: {
      name: "Proprietary — ZLZ Zentrallabor AG",
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
                          orderNumber: "ZLZ-2024-001",
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

    // ── Mail v1 (gateway-wrapped, recommended paths) ──────────────────────────
    "/v1/admin/mail/status": {
      get: {
        tags: ["Mail"],
        summary: "Mail configuration status (v1)",
        description:
          "Returns the current mail provider configuration via the API Gateway. " +
          "No secrets are ever included. Requires admin role.\n\n" +
          "**Preferred over** `GET /admin/mail/status` for all new integrations.",
        operationId: "getMailStatusV1",
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

    "/v1/admin/mail/test": {
      post: {
        tags: ["Mail"],
        summary: "Test mail connection (v1)",
        description:
          "Verifies the SMTP connection and optionally sends a test email, " +
          "routed through the API Gateway (request ID, structured logging, error normalisation). " +
          "Requires admin role.\n\n" +
          "**Preferred over** `POST /admin/mail/test` for all new integrations.",
        operationId: "testMailV1",
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
            description: "SMTP verification succeeded",
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
  },

  // ── Reusable schemas ───────────────────────────────────────────────────────
  components: {
    schemas: {
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
          profile: { $ref: "#/components/schemas/UserProfileSchema" },
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
