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

# write-version.mjs runs as prebuild hook and needs git history;
# if .git is not present (e.g. in CI), it falls back gracefully.
RUN npm run build

# ---- Stage 3: Production runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Runtime environment variables — override via docker run -e or docker-compose
# AUTH_SECRET=<strong-secret>
# FHIR_BASE_URL=https://your-fhir-server/fhir
# SASIS_API_BASE=https://junoprod:8419/api/v1/in/sasis
# NEXT_PUBLIC_SASIS_ENABLED=true
# GLN_API_BASE=http://orchestra:8019/middleware/gln/api/versionVal/refdata/partner/
# NEXT_PUBLIC_GLN_ENABLED=true
# ALLOW_LOCAL_AUTH=true

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone output (server + node_modules subset)
COPY --from=builder /app/.next/standalone ./

# Copy static assets and build cache
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Ensure the data directory exists for the user store (server-side auth)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
