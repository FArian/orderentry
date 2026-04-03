/**
 * IMailService — application-layer interface for outbound email delivery.
 *
 * Infrastructure implements this; domain and application layers only depend
 * on this interface — never on nodemailer or any concrete transport.
 */

import type { MailMessage } from "@/domain/entities/MailMessage";

export interface MailVerifyResult {
  readonly ok: boolean;
  readonly message: string;
}

export interface IMailService {
  /**
   * Returns true when the service has been initialised with a valid config.
   * NullMailService returns false (MAIL_PROVIDER not set).
   */
  isConfigured(): boolean;

  /**
   * Opens a test connection to the mail server and verifies authentication.
   * Never throws — always returns a typed result.
   */
  verify(): Promise<MailVerifyResult>;

  /**
   * Sends a single email message.
   * Throws when the service is not configured or delivery fails.
   */
  send(message: MailMessage): Promise<void>;
}
