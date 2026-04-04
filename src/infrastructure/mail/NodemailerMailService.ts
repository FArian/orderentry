/**
 * NodemailerMailService — nodemailer-backed implementation of IMailService.
 *
 * Library: nodemailer (https://nodemailer.com)
 * Why nodemailer: de-facto Node.js email library; supports all required
 * providers (SMTP, Gmail, OAuth2) with a stable, well-tested API.
 * No need to implement transport logic manually.
 *
 * Provider → nodemailer transport mapping:
 *   smtp + APP_PASSWORD     → { host, port, secure, auth: { user, pass } }
 *   smtp + OAUTH2           → { host, port, secure, auth: { type:"OAuth2", … } }
 *   smtp_oauth2 + OAUTH2    → same as smtp + OAUTH2
 *   gmail + APP_PASSWORD    → { service:"gmail", auth: { user, pass } }
 *   gmail + OAUTH2          → { service:"gmail", auth: { type:"OAuth2", … } }
 *   google_workspace_relay  → { host:"smtp-relay.gmail.com", port:587, … }
 *   hin + APP_PASSWORD      → standard SMTP (HIN encryption is transparent at gateway level)
 */

import nodemailer, { type Transporter, type TransportOptions } from "nodemailer";
import type { IMailService, MailVerifyResult } from "@/application/interfaces/IMailService";
import type { MailMessage } from "@/domain/entities/MailMessage";
import type { MailConfig } from "./types/MailConfig";

// ── Transport builder ─────────────────────────────────────────────────────────

function buildTransportOptions(config: MailConfig): TransportOptions {
  const { provider, authType } = config;

  if (provider === "gmail") {
    if (authType === "OAUTH2") {
      return {
        service: "gmail",
        auth: {
          type: "OAuth2",
          user:         config.user,
          clientId:     config.oauthClientId,
          clientSecret: config.oauthClientSecret,
          refreshToken: config.oauthRefreshToken,
        },
      } as TransportOptions;
    }
    // Gmail + APP_PASSWORD (2-step verification with App Password)
    return {
      service: "gmail",
      auth: { user: config.user, pass: config.password },
    } as TransportOptions;
  }

  if (provider === "google_workspace_relay") {
    const base = {
      host:   config.host ?? "smtp-relay.gmail.com",
      port:   config.port ?? 587,
      secure: config.secure ?? false,
    };
    if (authType === "APP_PASSWORD" && config.user) {
      return { ...base, auth: { user: config.user, pass: config.password } } as TransportOptions;
    }
    return base as TransportOptions;
  }

  // smtp / smtp_oauth2
  const smtp = {
    host:   config.host,
    port:   config.port ?? 587,
    secure: config.secure ?? false,
  };

  if (authType === "OAUTH2") {
    return {
      ...smtp,
      auth: {
        type:         "OAuth2",
        user:         config.user,
        clientId:     config.oauthClientId,
        clientSecret: config.oauthClientSecret,
        refreshToken: config.oauthRefreshToken,
      },
    } as TransportOptions;
  }

  // smtp + APP_PASSWORD (default)
  return {
    ...smtp,
    auth: { user: config.user, pass: config.password },
  } as TransportOptions;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class NodemailerMailService implements IMailService {
  private readonly config: MailConfig;
  private readonly transporter: Transporter;

  constructor(config: MailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport(buildTransportOptions(config));
  }

  isConfigured(): boolean { return true; }

  async verify(): Promise<MailVerifyResult> {
    try {
      await this.transporter.verify();
      return { ok: true, message: "Mail server reachable and authentication successful" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, message };
    }
  }

  async send(message: MailMessage): Promise<void> {
    const toAddress: string = typeof message.to === "string"
      ? message.to
      : Array.from(message.to).join(", ");
    await this.transporter.sendMail({
      from:    message.from ?? this.config.from,
      to:      toAddress,
      replyTo: this.config.alias,
      subject: message.subject,
      text:    message.text,
      html:    message.html,
    });
  }
}

// ── Null / no-op service ──────────────────────────────────────────────────────

/** Returned by the factory when MAIL_PROVIDER is not set. */
export class NullMailService implements IMailService {
  isConfigured(): boolean { return false; }

  async verify(): Promise<MailVerifyResult> {
    return { ok: false, message: "Mail server not configured (MAIL_PROVIDER is not set)" };
  }

  async send(): Promise<void> {
    throw new Error("Mail server not configured — set MAIL_PROVIDER in environment variables");
  }
}
