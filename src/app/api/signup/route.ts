import { NextResponse } from "next/server";
import { createUser, validateCredentials, type UserProfile } from "@/lib/userStore";
import { ALLOW_LOCAL_AUTH } from "@/lib/appConfig";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const username  = String(body.username  || "");
    const password  = String(body.password  || "");
    const firstName = String(body.firstName || "").trim();
    const lastName  = String(body.lastName  || "").trim();
    const gln       = String(body.gln       || "").trim();
    const orgGln    = String(body.orgGln    || "").trim();

    const validationError = validateCredentials(username, password);
    if (validationError) {
      return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
    }

    if (!orgGln) {
      return NextResponse.json({ ok: false, error: "Organisations-GLN ist erforderlich." }, { status: 400 });
    }
    if (!/^\d{13}$/.test(orgGln)) {
      return NextResponse.json({ ok: false, error: "Organisations-GLN muss genau 13 Ziffern enthalten." }, { status: 400 });
    }
    if (gln && !/^\d{13}$/.test(gln)) {
      return NextResponse.json({ ok: false, error: "GLN muss genau 13 Ziffern enthalten." }, { status: 400 });
    }

    const profile: UserProfile = {
      orgGln,
      ...(firstName && { firstName }),
      ...(lastName  && { lastName }),
      ...(gln       && { gln }),
    };

    try {
      if (ALLOW_LOCAL_AUTH) {
        // Avoid touching the filesystem in serverless envs; instruct client to fallback
        return NextResponse.json({ ok: false, error: "Local auth only (server FS disabled)" }, { status: 503 });
      }
      const user = await createUser(username, password, profile as UserProfile);
      return NextResponse.json({ ok: true, user: { id: user.id, username: user.username, createdAt: user.createdAt } }, { status: 201 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("exists")) {
        return NextResponse.json({ ok: false, error: "Username already exists" }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: message || "Unable to create user" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
