/**
 * POST /api/auth/reset-password/confirm
 *
 * Validates the reset token and sets the new password.
 * The token is consumed (one-time use) regardless of success or failure.
 *
 * Body: { token: string; password: string }
 */

import { NextResponse } from "next/server";
import { updateUserPassword, validateCredentials } from "@/lib/userStore";
import { consumeResetToken } from "@/lib/resetTokenStore";
import { logAuth } from "@/lib/logAuth";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body     = await req.json().catch(() => ({}));
    const token    = String(body.token    ?? "").trim();
    const password = String(body.password ?? "");

    if (!token || !password) {
      return NextResponse.json({ ok: false, message: "Token und Passwort erforderlich." }, { status: 400 });
    }

    const passwordError = validateCredentials("placeholder", password);
    if (passwordError) {
      return NextResponse.json({ ok: false, message: "Passwort muss mindestens 8 Zeichen enthalten." }, { status: 400 });
    }

    const userId = await consumeResetToken(token);
    if (!userId) {
      logAuth("RESET_CONFIRM_INVALID_TOKEN", {});
      return NextResponse.json({ ok: false, message: "Link ungültig oder abgelaufen." }, { status: 400 });
    }

    await updateUserPassword(userId, password);
    logAuth("RESET_CONFIRM_SUCCESS", { userId });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logAuth("RESET_CONFIRM_ERROR", { error: message });
    return NextResponse.json({ ok: false, message: "Fehler beim Zurücksetzen des Passworts." }, { status: 500 });
  }
}
