/**
 * Next.js 15 instrumentation entry point.
 *
 * Called once on server startup (Node.js runtime only — not Edge).
 * Dynamic imports inside the `nodejs` guard are safe: the Edge bundler
 * never follows runtime-conditional import() calls.
 *
 * Responsibilities:
 *  1. Run DB migrations (SQLite auto-migrate; PostgreSQL via Prisma migrate deploy)
 *  2. Start OpenTelemetry SDK (opt-in via ENABLE_TRACING + TRACING_URL)
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // ── 1. DB migrations ────────────────────────────────────────────────────────
  // webpackIgnore: true — prevents the Edge bundler from statically including
  // this Node.js-only module in the middleware/Edge bundle.
  try {
    const { runMigrations } = await import(
      /* webpackIgnore: true */ "@/infrastructure/db/runMigrations"
    );
    await runMigrations();
  } catch (err) {
    console.error("[db] Migration failed — server will not start:", err);
    process.exit(1);
  }

  // ── 2. OpenTelemetry tracing (opt-in) ───────────────────────────────────────
  // webpackIgnore: true — same reason: keeps OTel out of the Edge bundle.
  const { register: registerOtel } = await import(
    /* webpackIgnore: true */ "./instrumentation.node"
  );
  await registerOtel();
}
