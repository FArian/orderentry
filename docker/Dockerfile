# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

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
RUN printf "NEXT_PUBLIC_LAB_ORG_ID=%s\n" "$NEXT_PUBLIC_LAB_ORG_ID" >> .env.local

# write-version.mjs runs as prebuild hook; skips git gracefully if .git is absent.
# If .env.local was pre-written above, prebuild updates it in-place (same key).
RUN npm run build

# ---- Stage 3: Production runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Default FHIR (kann überschrieben werden)
ENV FHIR_BASE_URL=http://hapi.fhir.org/baseR4

# Runtime environment variables — override via docker run -e or docker-compose
# AUTH_SECRET=<strong-secret>
# FHIR_BASE_URL=https://your-fhir-server/fhir
# SASIS_API_BASE=http://orchestra:8019/api/v1/in/sasis
# NEXT_PUBLIC_SASIS_ENABLED=true
# GLN_API_BASE=http://orchestra:8019/middleware/gln/api/v1/refdata/partner/
# NEXT_PUBLIC_GLN_ENABLED=true
# ALLOW_LOCAL_AUTH=true

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

# Ensure the data directory exists for the user store (server-side auth)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Ensure the logs directory exists for optional file logging (LOG_FILE=/app/logs/zetlab.log)
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
