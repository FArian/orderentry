/**
 * POST /api/auth/reset-password/request
 *
 * Accepts a username, looks up the user's email, sends a password-reset link.
 * Always returns 200 with a generic message — never reveals whether the user
 * or email exists (prevents user enumeration).
 *
 * Body: { username: string }
 */

import { NextResponse } from "next/server";
import { findUser } from "@/lib/userStore";
import { createResetToken } from "@/lib/resetTokenStore";
import { mailService } from "@/infrastructure/mail/MailServiceFactory";
import { logAuth } from "@/lib/logAuth";

const GENERIC_OK = { ok: true, message: "Wenn ein Konto existiert, wird eine E-Mail gesendet." };

function buildResetUrl(req: Request, token: string): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/reset-password?token=${token}`;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body  = await req.json().catch(() => ({}));
    const username = String(body.username ?? "").trim().toLowerCase();

    if (!username) {
      return NextResponse.json(GENERIC_OK, { status: 200 });
    }

    const user = await findUser(username);

    // User not found or no email — return generic response (no enumeration).
    if (!user || !user.profile?.email) {
      logAuth("RESET_REQUEST_NO_EMAIL", { username });
      return NextResponse.json(GENERIC_OK, { status: 200 });
    }

    if (!mailService.isConfigured()) {
      logAuth("RESET_REQUEST_MAIL_NOT_CONFIGURED", { username });
      // Return a specific message so the admin knows mail is not set up.
      return NextResponse.json(
        { ok: false, message: "E-Mail-Versand nicht konfiguriert. Bitte Administrator kontaktieren." },
        { status: 503 },
      );
    }

    const token   = await createResetToken(user.id);
    const resetUrl = buildResetUrl(req, token);

    await mailService.send({
      to:      user.profile.email,
      subject: "z2Lab OrderEntry — Passwort zurücksetzen",
      text:
        `Hallo ${user.profile.firstName ?? user.username},\n\n` +
        `Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.\n\n` +
        `Bitte klicken Sie auf den folgenden Link (gültig für 1 Stunde):\n${resetUrl}\n\n` +
        `Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.\n\n` +
        `z2Lab OrderEntry`,
      html:
        `<p>Hallo ${user.profile.firstName ?? user.username},</p>` +
        `<p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>` +
        `<p><a href="${resetUrl}">Passwort zurücksetzen</a> (gültig für 1 Stunde)</p>` +
        `<p>Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p>` +
        `<p>z2Lab OrderEntry</p>`,
    });

    logAuth("RESET_REQUEST_SENT", { username, email: user.profile.email });
    return NextResponse.json(GENERIC_OK, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logAuth("RESET_REQUEST_ERROR", { error: message });
    return NextResponse.json({ ok: false, message: "Fehler beim Senden der E-Mail." }, { status: 500 });
  }
}
