export const dynamic = "force-dynamic";
// v1 — FHIR proxy: patient list
// Delegates to the same controller as /api/patients — no logic duplication.
export { GET } from "@/app/api/patients/route";
