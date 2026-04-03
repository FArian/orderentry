/**
 * MailServiceFactory — DI root for the mail subsystem.
 *
 * Usage:
 *   const mail = MailServiceFactory.create();
 *   if (!mail.isConfigured()) { ... }
 *   await mail.send({ to, subject, text });
 *
 * In tests, inject a mock IMailService directly — do not call this factory.
 */

import type { IMailService } from "@/application/interfaces/IMailService";
import { NodemailerMailService, NullMailService } from "./NodemailerMailService";
import { buildMailConfig } from "./mailEnvConfig";

export const MailServiceFactory = {
  create(): IMailService {
    const config = buildMailConfig();
    if (!config) return new NullMailService();
    return new NodemailerMailService(config);
  },
} as const;

/**
 * Module-level singleton — initialised once at process startup.
 * Used by API routes via `import { mailService } from "…/MailServiceFactory"`.
 */
export const mailService: IMailService = MailServiceFactory.create();
