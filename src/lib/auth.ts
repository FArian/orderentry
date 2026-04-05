import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { LOCAL_SESSION_COOKIE } from "@/lib/localAuthShared";
import { ALLOW_LOCAL_AUTH } from "@/lib/appConfig";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

type SessionPayload = {
  sub: string;
  username: string;
  iat: number; // issued at (seconds)
  exp: number; // expires at (seconds)
  /** Access level determined at login via FhirAccessResolver. */
  accessLevel?: "full" | "org" | "own";
  /** FHIR Practitioner ID linked to this user (e.g. "prac-von-rohr-anna"). */
  practitionerFhirId?: string;
  /** True when the practitioner belongs to an internal org (ZLZ/ZetLab). */
  isInternal?: boolean;
  /** Org IDs the user may access (Level org — managingOrganization filter). */
  allowedOrgIds?: string[];
};

const COOKIE_NAME = "session";
const ONE_DAY_SECONDS = 60 * 60 * 24;

function getSecret(): string {
  return EnvConfig.authSecret;
}

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export interface SessionExtras {
  accessLevel?: "full" | "org" | "own";
  practitionerFhirId?: string;
  isInternal?: boolean;
  allowedOrgIds?: string[];
}

export function signSession(userId: string, username: string, ttlSeconds = ONE_DAY_SECONDS, extras: SessionExtras = {}): string {
  const payload: SessionPayload = {
    sub: userId,
    username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    ...(extras.accessLevel        !== undefined && { accessLevel:        extras.accessLevel }),
    ...(extras.practitionerFhirId !== undefined && { practitionerFhirId: extras.practitionerFhirId }),
    ...(extras.isInternal         !== undefined && { isInternal:         extras.isInternal }),
    ...(extras.allowedOrgIds      !== undefined && { allowedOrgIds:      extras.allowedOrgIds }),
  };
  const json = JSON.stringify(payload);
  const body = b64url(json);
  const h = crypto.createHmac("sha256", getSecret());
  h.update(body);
  const sig = b64url(h.digest());
  return `${body}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const h = crypto.createHmac("sha256", getSecret());
  h.update(body);
  const expected = b64url(h.digest());
  if (expected !== sig) return null;
  try {
    const json = Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  return session as SessionPayload;
}

/** Require authenticated session AND admin role. Returns 403 NextResponse on failure. */
export async function getAdminSession(): Promise<SessionPayload | null> {
  const session = await getSessionFromCookies();
  if (!session) return null;
  // Import lazily to avoid circular deps
  const { getUserById } = await import("@/lib/userStore");
  const user = await getUserById(session.sub);
  if (!user || user.role !== "admin") return null;
  return session;
}

/**
 * Resolve admin identity from an HTTP request.
 * Checks session cookie first; falls back to Authorization: Bearer header (PAT or JWT).
 * Returns a minimal session payload or null.
 */
/**
 * Full admin access check with precise 401/403 distinction.
 * Checks Bearer token first (external clients), then session cookie.
 * Returns { authorized: true } or { authorized: false, httpStatus: 401|403 }.
 */
export async function checkAdminAccess(
  req: Request,
): Promise<{ authorized: true } | { authorized: false; httpStatus: 401 | 403 }> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { bearerAuthGuard } = await import("@/infrastructure/auth/BearerAuthGuard");
    const bearer = await bearerAuthGuard.resolve(authHeader);
    if (!bearer) return { authorized: false, httpStatus: 401 };
    return bearer.role === "admin"
      ? { authorized: true }
      : { authorized: false, httpStatus: 403 };
  }
  const session = await getAdminSession();
  if (session) return { authorized: true };
  const cookieSession = await getSessionFromCookies();
  return { authorized: false, httpStatus: cookieSession ? 403 : 401 };
}

export async function getAdminFromRequest(req: Request): Promise<SessionPayload | null> {
  // 1. Cookie auth (browser / Swagger UI)
  const cookieSession = await getAdminSession();
  if (cookieSession) return cookieSession;

  // 2. Bearer token auth (external clients)
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const { bearerAuthGuard } = await import("@/infrastructure/auth/BearerAuthGuard");
  const bearer = await bearerAuthGuard.resolve(authHeader);
  if (!bearer || bearer.role !== "admin") return null;
  return { sub: bearer.sub, username: bearer.username, iat: 0, exp: 0 };
}

/** Full session user including org context — used by API routes to enforce org-scoped access. */
export type SessionUserWithOrg = {
  sub:                  string;
  username:             string;
  role:                 string;
  orgGln?:              string;
  orgFhirId?:           string;
  orgName?:             string;
  /** Individual permissions granted beyond the base role. */
  extraPermissions:     string[];
  /** Access level from FhirAccessResolver — "full" | "org" | "own". Undefined = legacy admin. */
  accessLevel?:         "full" | "org" | "own";
  /** FHIR Practitioner ID — used for "own" filter (ServiceRequest.requester). */
  practitionerFhirId?:  string;
  /** True when practitioner is internal (ZLZ/ZetLab) — same as accessLevel "full". */
  isInternal?:          boolean;
  /** Org IDs allowed for "org" level filter (managingOrganization IN ...). */
  allowedOrgIds?:       string[];
};

/**
 * Reads the session cookie and enriches it with org data from the user store.
 * Returns null if the session is missing or invalid.
 * API routes use this to enforce org-scoped patient/order access.
 */
export async function getSessionUserWithOrg(): Promise<SessionUserWithOrg | null> {
  const session = await getSessionFromCookies();
  if (!session) return null;
  const { getUserById } = await import("@/lib/userStore");
  const user = await getUserById(session.sub).catch(() => null);
  return {
    sub:              session.sub,
    username:         session.username,
    role:             user?.role ?? "user",
    extraPermissions: user?.extraPermissions ?? [],
    ...(user?.profile?.orgGln    !== undefined && { orgGln:    user.profile.orgGln }),
    ...(user?.profile?.orgFhirId !== undefined && { orgFhirId: user.profile.orgFhirId }),
    ...(user?.profile?.orgName   !== undefined && { orgName:   user.profile.orgName }),
    ...(session.accessLevel        !== undefined && { accessLevel:        session.accessLevel }),
    ...(session.practitionerFhirId !== undefined && { practitionerFhirId: session.practitionerFhirId }),
    ...(session.isInternal         !== undefined && { isInternal:         session.isInternal }),
    ...(session.allowedOrgIds      !== undefined && { allowedOrgIds:      session.allowedOrgIds }),
  };
}

export function cookieName() {
  return COOKIE_NAME;
}

export const ONE_DAY = ONE_DAY_SECONDS;

export async function requireGuest(): Promise<void> {
  const s = await getSessionFromCookies();
  if (s) redirect("/patient");
}

// Extend cookie-based session retrieval to also support a local, unsigned
// fallback session cookie set by the client when filesystem-based user store
// is unavailable. This is intended for development or constrained environments.
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (token) {
    const verified = verifySession(token);
    if (verified) return verified;
  }
  const local = c.get(LOCAL_SESSION_COOKIE)?.value;
  if (local && ALLOW_LOCAL_AUTH) {
    try {
      const [id, username] = decodeURIComponent(local).split("|");
      if (id && username) {
        const now = Math.floor(Date.now() / 1000);
        return { sub: id, username, iat: now, exp: now + ONE_DAY_SECONDS };
      }
    } catch {
      // ignore
    }
  }
  return null;
}
