/**
 * MailController — business logic for the Mail Admin API.
 *
 * Responsibilities:
 *   - Return current mail configuration status (no secrets exposed)
 *   - Verify SMTP connection and optionally send a test email
 *   - Log provider + outcome; NEVER log credentials
 *
 * Constructor-injectable for tests:
 *   const ctrl = new MailController(new MockMailService());
 *
 * Module-level singleton for production use:
 *   import { mailController } from "./MailController"
 */

import type { IMailService } from "@/application/interfaces/IMailService";
import { mailService } from "@/infrastructure/mail/MailServiceFactory";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { createLogger } from "@/infrastructure/logging/Logger";
import type { MailTestRequestDto, MailTestResponseDto, MailStatusResponseDto } from "../dto/MailDto";

const log = createLogger("MailController");

export class MailController {
  constructor(private readonly service: IMailService = mailService) {}

  // ── GET /api/admin/mail/status ───────────────────────────────────────────────

  getStatus(): MailStatusResponseDto {
    const configured = this.service.isConfigured();
    if (!configured) return { configured: false };

    const port = EnvConfig.mailPort ? parseInt(EnvConfig.mailPort, 10) : undefined;

    return {
      configured: true,
      provider:  EnvConfig.mailProvider  || undefined,
      authType:  EnvConfig.mailAuthType  || undefined,
      host:      EnvConfig.mailHost      || undefined,
      port:      !isNaN(port ?? NaN) ? port : undefined,
      from:      EnvConfig.mailFrom      ||
                 (EnvConfig.mailUser ? `OrderEntry <${EnvConfig.mailUser}>` : undefined),
    };
  }

  // ── POST /api/admin/mail/test ────────────────────────────────────────────────

  async test(body: MailTestRequestDto): Promise<MailTestResponseDto> {
    const provider = EnvConfig.mailProvider || "unknown";

    if (!this.service.isConfigured()) {
      log.warn("Mail test requested but no provider configured");
      return {
        ok:         false,
        message:    "Mail server not configured — set MAIL_PROVIDER in environment variables",
        httpStatus: 503,
      };
    }

    log.info(`Mail test: verifying SMTP connection (provider=${provider})`);
    const start = Date.now();

    const verify = await this.service.verify();
    if (!verify.ok) {
      log.warn(`Mail verify failed (provider=${provider}): ${verify.message}`);
      return {
        ok:         false,
        message:    verify.message,
        provider,
        durationMs: Date.now() - start,
        httpStatus: 502,
      };
    }

    if (body.to) {
      try {
        await this.service.send({
          to:      body.to,
          subject: "z2Lab OrderEntry — Test-E-Mail",
          text:    buildTestText(provider),
          html:    buildTestHtml(provider),
        });
        log.info(`Mail test: test email sent to ${body.to} via ${provider}`);
        return {
          ok:         true,
          message:    `Verbindung erfolgreich und Test-E-Mail an ${body.to} gesendet`,
          provider,
          from:       EnvConfig.mailFrom || EnvConfig.mailUser || undefined,
          durationMs: Date.now() - start,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Send failed";
        log.warn(`Mail send failed (provider=${provider}): ${message}`);
        return {
          ok:         false,
          message,
          provider,
          durationMs: Date.now() - start,
          httpStatus: 502,
        };
      }
    }

    log.info(`Mail test: SMTP verify OK (provider=${provider})`);
    return {
      ok:         true,
      message:    "Mail-Server erreichbar und Authentifizierung erfolgreich",
      provider,
      from:       EnvConfig.mailFrom || EnvConfig.mailUser || undefined,
      durationMs: Date.now() - start,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTestText(provider: string): string {
  return (
    "Diese E-Mail wurde vom z2Lab OrderEntry Mail-System gesendet.\n\n" +
    `Provider: ${provider}\n` +
    `Auth:     ${EnvConfig.mailAuthType}\n\n` +
    "Falls Sie diese E-Mail erhalten haben, ist die Mail-Konfiguration korrekt."
  );
}

function buildTestHtml(provider: string): string {
  return (
    "<p>Diese E-Mail wurde vom <strong>z2Lab OrderEntry</strong> Mail-System gesendet.</p>" +
    "<table style=\"border-collapse:collapse;font-size:13px\">" +
    `<tr><td style="padding:2px 12px 2px 0;color:#666">Provider</td><td><code>${provider}</code></td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#666">Auth</td><td><code>${EnvConfig.mailAuthType}</code></td></tr>` +
    "</table>" +
    "<p style=\"color:#28a745\">✓ Mail-Konfiguration ist korrekt.</p>"
  );
}

// ── Module-level singleton ────────────────────────────────────────────────────

export const mailController = new MailController();
