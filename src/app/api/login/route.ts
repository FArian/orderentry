import { NextResponse } from "next/server";
import { validateCredentials, verifyUser, ensureBootstrapAdmin } from "@/lib/userStore";
import { signSession, ONE_DAY, cookieName } from "@/lib/auth";
import { logAuth } from "@/lib/logAuth";

export async function POST(req: Request) {
  try {
    // Ensure at least one admin user exists on first boot (idempotent — fast no-op
    // once users.json is populated).
    await ensureBootstrapAdmin();

    const body = await req.json().catch(() => ({}));
    const username = String(body.username || "");
    const password = String(body.password || "");

    const validationError = validateCredentials(username, password);
    if (validationError) {
      logAuth("LOGIN_VALIDATION_FAILED", { username, error: validationError });
      return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
    }

    logAuth("LOGIN_ATTEMPT", { username });

    let user;
    try {
      user = await verifyUser(username, password);
    } catch (fsErr) {
      // userStore.ensureDataFile() throws when the filesystem is read-only
      // (Vercel, Docker with a ro mount, etc.). Surface this as 503 with a
      // clear diagnostic rather than swallowing it as "Invalid request".
      const message = fsErr instanceof Error ? fsErr.message : String(fsErr);
      logAuth("LOGIN_FS_ERROR", { username, error: message });
      return NextResponse.json(
        {
          ok: false,
          error:
            "User store unavailable (read-only filesystem). " +
            "Set NEXT_PUBLIC_FORCE_LOCAL_AUTH=true to use browser-local auth.",
        },
        { status: 503 },
      );
    }

    if (!user) {
      logAuth("LOGIN_INVALID_CREDENTIALS", { username });
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const token = signSession(user.id, user.username, ONE_DAY);
    const res = NextResponse.json(
      { ok: true, user: { id: user.id, username: user.username } },
      { status: 200 },
    );

    // SameSite=Lax is correct here: the frontend and API routes are always
    // co-deployed (same Next.js process, same origin). SameSite=None is only
    // needed when cookies cross origins — which does not apply to this setup.
    res.cookies.set({
      name: cookieName(),
      value: token,
      httpOnly: true,
      sameSite: "lax",
      maxAge: ONE_DAY,
      path: "/",
      // Traefik terminates TLS; the container itself runs plain HTTP.
      // NODE_ENV=production is set in the Docker image, so Secure is applied
      // when the browser communicates via HTTPS through Traefik. ✓
      secure: process.env.NODE_ENV === "production",
    });

    logAuth("LOGIN_SUCCESS", { username, userId: user.id });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logAuth("LOGIN_ERROR", { error: message });
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
