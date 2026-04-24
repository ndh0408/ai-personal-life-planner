# syntax=docker/dockerfile:1.7
# ---- Build stage ------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /workspace

# Workspace manifests first for better layer caching.
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install ALL deps (dev included) for the build. We drop dev deps in runtime stage.
RUN npm ci --include=dev

# Sources
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Scrub any incremental build artifacts that slipped past .dockerignore —
# a stale *.tsbuildinfo causes tsc to skip .d.ts emit in shared.
RUN find /workspace -name "*.tsbuildinfo" -delete && rm -rf /workspace/packages/shared/dist /workspace/apps/api/dist

# Build order: shared types → prisma client → nest build
RUN npm run build -w @planner/shared
RUN npx -w @lifeos/api prisma generate
RUN npm run build -w @lifeos/api

# ---- Prune to production deps ----------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /workspace

COPY --from=builder /workspace/package.json /workspace/package-lock.json* ./
COPY --from=builder /workspace/packages/shared/package.json ./packages/shared/
COPY --from=builder /workspace/apps/api/package.json ./apps/api/
# Compiled shared output is needed because api imports from its dist.
COPY --from=builder /workspace/packages/shared ./packages/shared
# Prisma needs the schema in its expected location to generate the client.
COPY --from=builder /workspace/apps/api/prisma ./apps/api/prisma

RUN npm ci --omit=dev \
 && npx -w @lifeos/api prisma generate

# ---- Runtime stage ----------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Non-root user — Nest never needs root in production.
RUN addgroup -S lifeos && adduser -S lifeos -G lifeos

# Runtime deps:
#   - curl: container-internal healthcheck
#   - tini: PID 1 signal forwarder
#   - openssl + libssl3: Prisma query engine needs the shared library at runtime
RUN apk add --no-cache curl tini openssl libssl3

COPY --from=deps     /workspace/node_modules ./node_modules
COPY --from=deps     /workspace/packages/shared ./packages/shared
COPY --from=builder  /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=builder  /workspace/apps/api/dist ./apps/api/dist
COPY --from=builder  /workspace/apps/api/prisma ./apps/api/prisma

# App listens on 3000 internally; compose / nginx maps externally.
EXPOSE 3000

USER lifeos

# Healthcheck so the orchestrator (compose / k8s) knows when we're live.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

# tini is PID 1 so signals (SIGTERM from compose) shut Nest down cleanly.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
