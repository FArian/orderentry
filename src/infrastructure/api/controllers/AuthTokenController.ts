/**
 * AuthTokenController — exchange username + password for a JWT access token.
 *
 * POST /api/auth/token
 *   Body: { username, password, expiresIn? }
 *   Response: { accessToken, tokenType: "Bearer", expiresIn }
 *
 * Only admin users may obtain API tokens this way.
 * Non-admin users receive 403.
 */

import { verifyUser } from "@/lib/userStore";
import {
  userJwtService,
  EXPIRES_IN_SECONDS,
  type ExpiresIn,
} from "@/infrastructure/auth/UserJwtService";

export interface ExchangeCredentialsDto {
  username:   string;
  password:   string;
  expiresIn?: ExpiresIn;
}

export interface AccessTokenResponseDto {
  accessToken: string;
  tokenType:   "Bearer";
  expiresIn:   number; // seconds
}

export interface AuthTokenErrorDto {
  error:       string;
  httpStatus:  number;
}

const DEFAULT_EXPIRES_IN: ExpiresIn = "24h";

const VALID_EXPIRES: ExpiresIn[] = ["1h", "24h", "7d", "30d", "90d"];

export class AuthTokenController {
  async exchange(
    dto: ExchangeCredentialsDto,
  ): Promise<AccessTokenResponseDto | AuthTokenErrorDto> {
    const { username, password, expiresIn = DEFAULT_EXPIRES_IN } = dto;

    if (!username?.trim() || !password) {
      return { error: "username and password are required", httpStatus: 400 };
    }
    if (!VALID_EXPIRES.includes(expiresIn)) {
      return { error: `expiresIn must be one of: ${VALID_EXPIRES.join(", ")}`, httpStatus: 400 };
    }

    const user = await verifyUser(username.trim(), password);
    if (!user) {
      return { error: "Invalid credentials", httpStatus: 401 };
    }
    if (user.status && user.status !== "active") {
      return { error: "Account suspended", httpStatus: 403 };
    }
    if (user.role !== "admin") {
      return { error: "Admin role required to obtain API tokens", httpStatus: 403 };
    }

    const seconds = EXPIRES_IN_SECONDS[expiresIn];
    const accessToken = userJwtService.sign(
      { sub: user.id, username: user.username, role: user.role },
      seconds,
    );

    return { accessToken, tokenType: "Bearer", expiresIn: seconds };
  }
}

export const authTokenController = new AuthTokenController();
