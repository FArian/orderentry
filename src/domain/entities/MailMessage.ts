/**
 * MailMessage — domain entity representing an outbound email.
 *
 * Kept intentionally minimal: the domain only cares about what a message
 * contains, not how it is delivered (that is infrastructure's concern).
 */

export interface MailMessage {
  /** Recipient address or array of addresses. */
  readonly to: string | readonly string[];
  /** Message subject line. */
  readonly subject: string;
  /** Plain-text body (always provided as fallback). */
  readonly text?: string;
  /** HTML body (optional; plain text is used when absent). */
  readonly html?: string;
  /**
   * Override sender address for this message.
   * Falls back to the service-level `from` configured via ENV.
   */
  readonly from?: string;
}
