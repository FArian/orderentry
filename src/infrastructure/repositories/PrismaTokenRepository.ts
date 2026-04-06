/**
 * PrismaTokenRepository — DB-backed password reset tokens.
 *
 * Replaces the in-memory resetTokenStore.ts. Tokens survive container restarts
 * and work correctly on Vercel serverless (multiple function instances).
 */

import crypto from "crypto";
import { prisma } from "../db/prismaClient";

const TTL_MS = 60 * 60 * 1000; // 1 hour

export async function createResetToken(userId: string): Promise<string> {
  // Invalidate any existing token for this user before creating a new one.
  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  const token     = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await prisma.passwordResetToken.create({ data: { token, userId, expiresAt } });
  return token;
}

/** Validates and consumes the token (one-time use). Returns userId or null. */
export async function consumeResetToken(token: string): Promise<string | null> {
  const entry = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!entry) return null;

  // Always delete — expired or not (clean up either way).
  await prisma.passwordResetToken.delete({ where: { token } });

  if (entry.expiresAt <= new Date()) return null;
  return entry.userId;
}
