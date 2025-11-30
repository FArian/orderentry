// Centralized env flags for local auth fallback
// Client: NEXT_PUBLIC_FORCE_LOCAL_AUTH=true to force local-only auth flows
// Server: ALLOW_LOCAL_AUTH=true to allow localSession cookie on SSR/API

function flag(val: string | undefined): boolean {
  if (!val) return false;
  const v = val.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

export const FORCE_LOCAL_AUTH = flag(process.env.NEXT_PUBLIC_FORCE_LOCAL_AUTH);
export const ALLOW_LOCAL_AUTH = flag(process.env.ALLOW_LOCAL_AUTH);
