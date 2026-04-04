/**
 * resetTokenStore — re-exports from PrismaTokenRepository.
 *
 * Previously: in-memory Map (lost on restart, broken on Vercel).
 * Now:        DB-backed via Prisma — persistent, multi-instance safe.
 *
 * All callers continue to import from here — no breaking changes.
 */

export { createResetToken, consumeResetToken } from "@/infrastructure/repositories/PrismaTokenRepository";
