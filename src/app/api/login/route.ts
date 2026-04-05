import { NextResponse } from "next/server";
import { validateCredentials, verifyUser, ensureBootstrapAdmin } from "@/lib/userStore";
import { signSession, ONE_DAY, cookieName } from "@/lib/auth";
import { logAuth } from "@/lib/logAuth";
import { classifyPrismaError, isSchemaError, isConnectionError } from "@/infrastructure/db/prismaError";
import { FhirAccessResolver } from "@/application/services/FhirAccessResolver";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

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
    } catch (dbErr) {
      const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logAuth("LOGIN_FS_ERROR", { username, error: message });

      const diagnosis = classifyPrismaError(dbErr);

      if (isSchemaError(dbErr)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Datenbank-Schema veraltet",
            diagnosis,
            hint: "GET /api/health/db für Details aufrufen. Kurz: Dev-Server stoppen → `npx prisma generate` → `.next` löschen → neu starten.",
          },
          { status: 503 },
        );
      }

      if (isConnectionError(dbErr)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Datenbank nicht erreichbar",
            diagnosis,
            hint: "GET /api/health/db für Details aufrufen.",
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Datenbankfehler — Login nicht möglich",
          diagnosis,
          hint: "GET /api/health/db für Details aufrufen.",
        },
        { status: 503 },
      );
    }

    if (!user) {
      logAuth("LOGIN_INVALID_CREDENTIALS", { username });
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    // Resolve FHIR-based access level (fail-safe: bootstrap admin bypasses this)
    const resolver = new FhirAccessResolver({
      fhirBaseUrl:       EnvConfig.fhirBaseUrl,
      internalOrgIds:    EnvConfig.labInternalOrgIds,
      internalRoleCodes: EnvConfig.snomedRoleInternal,
      orgAdminRoleCodes: EnvConfig.snomedRoleOrgAdmin,
    });

    let accessExtras = {};
    try {
      const access = await resolver.resolve(user.fhirPractitionerId ?? undefined, user.role ?? "user");
      accessExtras = {
        accessLevel:        access.level,
        practitionerFhirId: access.practitionerFhirId,
        isInternal:         access.isInternal,
        allowedOrgIds:      access.allowedOrgIds,
      };
    } catch (accessErr) {
      const accessMsg = accessErr instanceof Error ? accessErr.message : String(accessErr);
      logAuth("LOGIN_ACCESS_DENIED", { username, error: accessMsg });
      return NextResponse.json({ ok: false, error: accessMsg }, { status: 403 });
    }

    const token = signSession(user.id, user.username, ONE_DAY, accessExtras);
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
    const diagnosis = classifyPrismaError(err);
    return NextResponse.json(
      { ok: false, error: "Serverfehler beim Login", diagnosis },
      { status: 500 },
    );
  }
}
