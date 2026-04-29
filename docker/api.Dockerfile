# Multi-stage build for the LifeOS API (round 25).
#
# Stage 1 installs the full workspace + builds @lifeos/shared and @lifeos/api.
# Stage 2 is a slim runtime image with only the production deps + dist.

FROM node:20.12-alpine AS build
WORKDIR /app

# Copy workspace manifests first so npm install can cache.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspaces --include-workspace-root

# Copy sources after install — small change in code shouldn't bust the npm cache.
COPY packages/shared packages/shared
COPY apps/api apps/api

# Build shared first (api compiles against it), then the api itself.
RUN npm --workspace @lifeos/shared run build
RUN npm --workspace @lifeos/api run build
# Generate Prisma client into node_modules/@prisma/client.
RUN cd apps/api && npx prisma generate

# Drop dev deps to slim the next stage.
RUN npm prune --omit=dev

FROM node:20.12-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/shared /app/packages/shared
COPY --from=build /app/apps/api /app/apps/api
COPY --from=build /app/package.json /app/

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
