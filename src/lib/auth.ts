import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { LOCAL_SESSION_COOKIE } from "@/lib/localAuthShared";
import { ALLOW_LOCAL_AUTH } from "@/lib/appConfig";

type SessionPayload = {
  sub: string;
  username: string;
  iat: number; // issued at (seconds)
  exp: number; // expires at (seconds)
};

const COOKIE_NAME = "session";
const ONE_DAY_SECONDS = 60 * 60 * 24;

function getSecret(): string {
  return process.env.AUTH_SECRET || "dev-secret-change-me";
}

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signSession(userId: string, username: string, ttlSeconds = ONE_DAY_SECONDS): string {
  const payload: SessionPayload = {
    sub: userId,
    username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
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
