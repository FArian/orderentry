/**
 * Prisma Client singleton — shared across all server-side code.
 *
 * In development, Next.js hot-reload creates new module instances on every
 * file change. Without the global guard, each reload would open a new DB
 * connection and exhaust the connection pool.
 *
 * The pattern below attaches the client to `globalThis` in dev so the same
 * instance is reused across reloads. In production a single import is enough.
 *
 * Never import this in client-side ("use client") code — it is Node.js-only.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["warn", "error"]
      : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
