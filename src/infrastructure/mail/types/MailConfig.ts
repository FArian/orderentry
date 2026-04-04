/**
 * MailConfig — runtime mail server configuration (built from ENV vars).
 *
 * The combination of `provider` + `authType` determines which fields are used.
 * nodemailer's transport layer is the only consumer of this type.
 *
 * ENV variable mapping:
 *   MAIL_PROVIDER      smtp | gmail | smtp_oauth2 | google_workspace_relay | hin
 *   MAIL_AUTH_TYPE     APP_PASSWORD | OAUTH2 | NONE
 *   MAIL_HOST          SMTP host (required for smtp, smtp_oauth2, relay)
 *   MAIL_PORT          SMTP port (default: 587)
 *   MAIL_SECURE        true = TLS/SSL on connect (default: false → STARTTLS)
 *   MAIL_USER          Username / email address
 *   MAIL_PASSWORD      Password or App Password (secret — ENV only)
 *   MAIL_FROM          Default sender, e.g. "OrderEntry <noreply@example.com>"
 *   MAIL_ALIAS         Reply-To / alias address (optional)
 *   MAIL_OAUTH_CLIENT_ID
 *   MAIL_OAUTH_CLIENT_SECRET    OAuth2 client credentials (secret — ENV only)
 *   MAIL_OAUTH_REFRESH_TOKEN    Long-lived refresh token (secret — ENV only)
 *   MAIL_DOMAIN        Google Workspace domain for relay (optional)
 */

export type MailProvider =
  | "smtp"
  | "gmail"
  | "smtp_oauth2"
  | "google_workspace_relay"
  | "hin";

export type MailAuthType = "APP_PASSWORD" | "OAUTH2" | "NONE";

export const MAIL_PROVIDERS: readonly MailProvider[] = [
  "smtp",
  "gmail",
  "smtp_oauth2",
  "google_workspace_relay",
  "hin",
];

export const MAIL_AUTH_TYPES: readonly MailAuthType[] = [
  "APP_PASSWORD",
  "OAUTH2",
  "NONE",
];

/**
 * Valid provider → auth-type combinations.
 * The factory enforces these; invalid combos fall back to NullMailService.
 */
export const PROVIDER_AUTH_MATRIX: Record<MailProvider, readonly MailAuthType[]> = {
  smtp:                    ["APP_PASSWORD", "OAUTH2"],
  gmail:                   ["APP_PASSWORD", "OAUTH2"],
  smtp_oauth2:             ["OAUTH2"],
  google_workspace_relay:  ["NONE", "APP_PASSWORD"],
  hin:                     ["APP_PASSWORD"],
};

export interface MailConfig {
  readonly provider:           MailProvider;
  readonly authType:           MailAuthType;
  readonly host?:              string;
  readonly port?:              number;
  readonly secure?:            boolean;
  readonly user?:              string;
  readonly password?:          string;
  readonly oauthClientId?:     string;
  readonly oauthClientSecret?: string;
  readonly oauthRefreshToken?: string;
  readonly from:               string;
  readonly alias?:             string;
  readonly domain?:            string;
}
