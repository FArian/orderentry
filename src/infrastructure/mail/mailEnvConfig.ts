/**
 * mailEnvConfig — builds MailConfig from server-side ENV vars.
 *
 * Returns null when MAIL_PROVIDER is unset or "none" so the factory
 * can return a NullMailService instead of a misconfigured transporter.
 */

import { EnvConfig } from "../config/EnvConfig";
import type { MailConfig, MailProvider, MailAuthType } from "./types/MailConfig";
import { MAIL_PROVIDERS, MAIL_AUTH_TYPES, PROVIDER_AUTH_MATRIX } from "./types/MailConfig";

function isValidProvider(value: string): value is MailProvider {
  return (MAIL_PROVIDERS as readonly string[]).includes(value);
}

function isValidAuthType(value: string): value is MailAuthType {
  return (MAIL_AUTH_TYPES as readonly string[]).includes(value);
}

export function buildMailConfig(): MailConfig | null {
  const rawProvider = EnvConfig.mailProvider;
  const rawAuthType = EnvConfig.mailAuthType;

  if (!rawProvider || rawProvider === "none") return null;
  if (!isValidProvider(rawProvider)) return null;
  if (!isValidAuthType(rawAuthType)) return null;

  const provider = rawProvider;
  const authType = rawAuthType;

  // Validate combination
  const allowed = PROVIDER_AUTH_MATRIX[provider] as readonly MailAuthType[];
  if (!allowed.includes(authType)) return null;

  const port = EnvConfig.mailPort ? parseInt(EnvConfig.mailPort, 10) : undefined;

  const config: MailConfig = {
    provider,
    authType,
    from: EnvConfig.mailFrom ||
          (EnvConfig.mailUser ? `OrderEntry <${EnvConfig.mailUser}>` : "noreply@localhost"),
    ...(EnvConfig.mailHost              ? { host:              EnvConfig.mailHost }              : {}),
    ...(!isNaN(port ?? NaN) && port     ? { port }                                               : {}),
    ...(EnvConfig.mailSecure            ? { secure:            true }                            : {}),
    ...(EnvConfig.mailUser              ? { user:              EnvConfig.mailUser }              : {}),
    ...(EnvConfig.mailPassword          ? { password:          EnvConfig.mailPassword }          : {}),
    ...(EnvConfig.mailOauthClientId     ? { oauthClientId:     EnvConfig.mailOauthClientId }     : {}),
    ...(EnvConfig.mailOauthClientSecret ? { oauthClientSecret: EnvConfig.mailOauthClientSecret } : {}),
    ...(EnvConfig.mailOauthRefreshToken ? { oauthRefreshToken: EnvConfig.mailOauthRefreshToken } : {}),
    ...(EnvConfig.mailAlias             ? { alias:             EnvConfig.mailAlias }             : {}),
    ...(EnvConfig.mailDomain            ? { domain:            EnvConfig.mailDomain }            : {}),
  };
  return config;
}
