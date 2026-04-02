import { NextResponse } from "next/server";
import { openApiSpec } from "@/infrastructure/api/openapi";

/**
 * GET /api/openapi.json
 *
 * Serves the OpenAPI 3.0 specification as JSON.
 * Consumed by GET /api/docs (Swagger UI) and any external API tooling.
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Content-Type": "application/json",
      // Allow external tools (Postman, Insomnia, etc.) to import the spec
      "Access-Control-Allow-Origin": "*",
    },
  });
}
