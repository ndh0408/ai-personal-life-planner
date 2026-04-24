# syntax=docker/dockerfile:1.7
# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /workspace

# Copy workspace manifests first for better caching
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm ci --include=dev

# Copy sources
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build --workspace @planner/shared
RUN npx -w @planner/api prisma generate
RUN npm run build --workspace @planner/api

# ---- Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/package-lock.json* ./
COPY --from=builder /workspace/packages/shared ./packages/shared
COPY --from=builder /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=builder /workspace/apps/api/dist ./apps/api/dist
COPY --from=builder /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=builder /workspace/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
