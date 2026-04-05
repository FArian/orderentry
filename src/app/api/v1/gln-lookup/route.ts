// GET /api/v1/gln-lookup — stable versioned alias for /api/gln-lookup
// No duplicate logic: delegates entirely to the base route handler.
export const dynamic = "force-dynamic";
export { GET } from "@/app/api/gln-lookup/route";
