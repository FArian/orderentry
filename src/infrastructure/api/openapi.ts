/**
 * OpenAPI 3.0 specification for the ZetLab OrderEntry API.
 *
 * This module is the single source of truth for the API contract.
 * It is served at GET /api/openapi.json and rendered by the Swagger UI
 * at GET /api/docs.
 *
 * Rule: "If it is not documented here, it does not exist."
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "ZetLab OrderEntry API",
    version: "1.0.0",
    description:
      "REST API for the ZetLab laboratory order entry system (ZLZ Zentrallabor AG). " +
      "All data access is proxied through a FHIR R4 server. " +
      "Authentication uses HMAC-SHA256 signed session cookies.",
    contact: {
      name: "ZLZ Zentrallabor AG",
      url: "https://www.zlz.ch",
    },
    license: {
      name: "Proprietary",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Current deployment",
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

      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
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
    },
  },

  security: [{ sessionCookie: [] }],
} as const;

export type OpenApiSpec = typeof openApiSpec;
