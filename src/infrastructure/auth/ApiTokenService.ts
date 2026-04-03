/**
 * ApiTokenService — Personal Access Token (PAT) generation and verification.
 *
 * Token format: ztk_<64 hex chars>  (256 bits of crypto-random entropy)
 * Storage:      SHA-256 hash in users.json (fast lookup; tokens are already
 *               high-entropy random values, so scrypt is not needed)
 * Security:     Timing-safe comparison via crypto.timingSafeEqual
 */

import crypto from "crypto";

const PREFIX      = "ztk_";
const TOKEN_BYTES = 32; // 256 bits → 64 hex chars

export class ApiTokenService {
  /** Generate a new PAT.  The plaintext value is returned once; store only the hash. */
  generate(): string {
    return PREFIX + crypto.randomBytes(TOKEN_BYTES).toString("hex");
  }

  /** SHA-256 hash of a token for storage. */
  hash(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /** Timing-safe verification of a plaintext token against a stored hash. */
  verify(token: string, storedHash: string): boolean {
    const tokenHash = this.hash(token);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(tokenHash, "hex"),
        Buffer.from(storedHash, "hex"),
      );
    } catch {
      return false;
    }
  }

  /** Returns true when the value has the PAT prefix. */
  static isPat(token: string): boolean {
    return token.startsWith(PREFIX);
  }
}

export const apiTokenService = new ApiTokenService();
