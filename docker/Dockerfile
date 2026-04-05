# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
# Use BuildKit cache mount to avoid re-downloading packages on repeated builds.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --fetch-retry-maxtimeout=300000 --fetch-timeout=300000

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder
WORKDIR /app

# Git is needed by scripts/write-version.mjs
RUN apk add --no-cache git

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept git metadata as build args so the version string matches the source commit.
# Pass these when building:
#   docker buildx build \
#     --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
#     --build-arg GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) \
#     --build-arg GIT_COUNT=$(git rev-list --count HEAD) \
#     --build-arg NEXT_PUBLIC_LAB_ORG_ID=zlz \
#     --build-arg NEXT_PUBLIC_LAB_NAME="ZLZ Zentrallabor AG" \
#     --build-arg NEXT_PUBLIC_ORDER_SERVICE_TYPES=MIBI,ROUTINE,POC \
#     ...
ARG GIT_COMMIT=
ARG GIT_BRANCH=
ARG GIT_COUNT=
# Inject into .env.local so write-version.mjs can use them (or pre-write the value)
RUN if [ -n "$GIT_COMMIT" ]; then \
      PKG_VER=$(node -e "process.stdout.write(require('./package.json').version)"); \
      TS=$(date -u +"%Y%m%d%H%M"); \
      COUNT_PART=$([ -n "$GIT_COUNT" ] && echo "$GIT_COUNT" || echo "0"); \
      BRANCH_PART=$([ -n "$GIT_BRANCH" ] && echo "@$GIT_BRANCH" || echo ""); \
      printf "NEXT_PUBLIC_APP_VERSION=v%s+%s-%s%s (%s)\n" \
        "$PKG_VER" "$COUNT_PART" "$GIT_COMMIT" "$BRANCH_PART" "$TS" > .env.local; \
    fi

# NEXT_PUBLIC_* vars must be baked into the client bundle at build time.
# Runtime docker-compose env vars are ignored for these by the browser bundle.
ARG NEXT_PUBLIC_LAB_ORG_ID=zlz
ARG NEXT_PUBLIC_LAB_NAME=ZLZ Zentrallabor AG
ARG NEXT_PUBLIC_ORDER_SERVICE_TYPES=MIBI,ROUTINE,POC
RUN printf "NEXT_PUBLIC_LAB_ORG_ID=%s\n" "$NEXT_PUBLIC_LAB_ORG_ID" >> .env.local && \
    printf "NEXT_PUBLIC_LAB_NAME=%s\n" "$NEXT_PUBLIC_LAB_NAME" >> .env.local && \
    printf "NEXT_PUBLIC_ORDER_SERVICE_TYPES=%s\n" "$NEXT_PUBLIC_ORDER_SERVICE_TYPES" >> .env.local

# write-version.mjs runs as prebuild hook; skips git gracefully if .git is absent.
# If .env.local was pre-written above, prebuild updates it in-place (same key).
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ---- Stage 3: Production runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Runtime environment variables — override via docker run -e or docker-compose
# ORDERENTRY_AUTH__SECRET=<strong-secret>
# ORDERENTRY_FHIR__BASE_URL=https://your-fhir-server/fhir
# ORDERENTRY_FHIR__AUTH_TYPE=none
# ORDERENTRY_FHIR__SEED_ENABLED=true
# ORDERENTRY_FHIR__SEED_DEMO=false
# ORDERENTRY_FHIR__SEED_CATALOG=false
# ORDERENTRY_AUTH__ALLOW_LOCAL=false
# NEXT_PUBLIC_SASIS_ENABLED=true
# NEXT_PUBLIC_GLN_ENABLED=true

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

RUN apk add --no-cache curl

# Copy standalone output (server + node_modules subset)
COPY --from=builder /app/.next/standalone ./

# Copy static assets and build cache
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Carry the generated version into the runner so server.js loads it via @next/env
COPY --from=builder /app/.env.local ./.env.local

# Copy Prisma schema + migrations so `prisma migrate deploy` can run at startup
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Ensure the data directory exists (SQLite DB file lives here)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Ensure the logs directory exists for optional file logging (LOG_FILE=/app/logs/zetlab.log)
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

# Copy FHIR seed bundles — embedded in the image, applied on first startup
COPY --from=builder /app/seed /app/seed

# Copy FHIR seed bootstrap script
COPY --from=builder /app/scripts/fhir-seed.mjs /app/scripts/fhir-seed.mjs

# Copy Flyway SQL migration files — required by SqliteMigrationRunner at startup
# (reads flyway/migrations/sqlite/V*.sql to initialise the SQLite DB schema)
COPY --from=builder /app/flyway ./flyway

USER nextjs

EXPOSE 3000

# Startup sequence:
#   1. fhir-seed.mjs — waits for FHIR, applies masterdata + optional demo data (idempotent)
#   2. server.js     — Next.js production server
#
# SQLite migrations run automatically at startup via SqliteMigrationRunner
# (reads flyway/migrations/sqlite/*.sql — same files as the Flyway Docker service).
#
# PostgreSQL/MSSQL: run the Flyway service BEFORE starting this container:
#   docker compose --profile flyway up flyway
#   docker compose up orderentry
#
# Seed ENV vars:
#   ORDERENTRY_FHIR__SEED_ENABLED=true    (default: true)
#   ORDERENTRY_FHIR__SEED_DEMO=false      (default: false)
#   ORDERENTRY_FHIR__SEED_CATALOG=false   (default: false — set true for dev/demo)
CMD ["sh", "-c", "node /app/scripts/fhir-seed.mjs; node server.js"]
