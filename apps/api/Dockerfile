# syntax=docker/dockerfile:1.6

# ----- Builder -----
FROM node:20.12.2-alpine AS builder
WORKDIR /repo

# Copy workspace manifests first for better cache
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN npm ci

# Copy sources
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build --workspace @lifeos/shared --if-present
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace @lifeos/api

# ----- Runner -----
FROM node:20.12.2-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Only copy what we need
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/apps/api/package.json ./package.json
COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/packages/shared ./packages/shared

EXPOSE 4000
CMD ["node", "dist/main.js"]
